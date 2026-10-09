<?php
// backend/controllers/InventoryController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class InventoryController {
    public function index(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("
                SELECT m.id, m.code, m.name, m.uom, m.purchase_rate, m.min_stock_level, 
                       c.name as category_name, s.name as supplier_name,
                       COALESCE(sb.current_quantity, 0) as current_stock,
                       COALESCE(sb.available_quantity, 0) as available_stock,
                       COALESCE(sb.reserved_quantity, 0) as reserved_stock,
                       ROUND(COALESCE(sb.current_quantity, 0) * m.purchase_rate, 2) as stock_value,
                       CASE WHEN COALESCE(sb.current_quantity, 0) <= m.min_stock_level THEN 1 ELSE 0 END as is_low_stock
                FROM materials m
                JOIN categories c ON m.category_id = c.id
                LEFT JOIN suppliers s ON m.supplier_id = s.id
                LEFT JOIN stock_balances sb ON m.id = sb.material_id
                WHERE m.deleted_at IS NULL
                ORDER BY is_low_stock DESC, m.name ASC
            ");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function ledger(): void {
        $materialId = isset($_GET['material_id']) ? (int)$_GET['material_id'] : null;
        try {
            $pdo = Database::getConnection();
            $sql = "
                SELECT it.*, m.name as material_name, m.uom, m.code as material_code, u.name as user_name
                FROM inventory_transactions it
                JOIN materials m ON it.material_id = m.id
                LEFT JOIN users u ON it.user_id = u.id
                WHERE 1=1
            ";
            $params = [];
            if ($materialId) {
                $sql .= " AND it.material_id = :mid";
                $params[':mid'] = $materialId;
            }
            $sql .= " ORDER BY it.created_at DESC, it.id DESC LIMIT 200";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function lowStock(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("
                SELECT m.id, m.code, m.name, m.uom, m.purchase_rate, m.min_stock_level, 
                       c.name as category_name, s.name as supplier_name, s.phone as supplier_phone,
                       COALESCE(sb.current_quantity, 0) as current_stock,
                       (m.min_stock_level - COALESCE(sb.current_quantity, 0)) as shortage_qty
                FROM materials m
                JOIN categories c ON m.category_id = c.id
                LEFT JOIN suppliers s ON m.supplier_id = s.id
                LEFT JOIN stock_balances sb ON m.id = sb.material_id
                WHERE m.deleted_at IS NULL AND COALESCE(sb.current_quantity, 0) <= m.min_stock_level
                ORDER BY shortage_qty DESC
            ");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function adjustStock(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $materialId = (int)($data['material_id'] ?? 0);
        $adjustmentType = strtoupper($data['adjustment_type'] ?? 'ADD'); // 'ADD' or 'SUBTRACT' or 'SET'
        $quantity = (float)($data['quantity'] ?? 0);
        $reason = trim($data['reason'] ?? 'Manual Stock Adjustment');

        if (!$materialId || $quantity <= 0) {
            Response::error("Material ID and valid quantity are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $sbStmt = $pdo->prepare("SELECT current_quantity FROM stock_balances WHERE material_id = ? FOR UPDATE");
            $sbStmt->execute([$materialId]);
            $currentQty = (float)($sbStmt->fetchColumn() ?: 0);

            $newQty = match($adjustmentType) {
                'ADD' => $currentQty + $quantity,
                'SUBTRACT' => max(0.0, $currentQty - $quantity),
                'SET' => $quantity,
                default => $currentQty
            };

            $diffQty = $newQty - $currentQty;

            $uStmt = $pdo->prepare("
                INSERT INTO stock_balances (material_id, current_quantity, available_quantity)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE current_quantity = ?, available_quantity = ?
            ");
            $uStmt->execute([$materialId, $newQty, $newQty, $newQty, $newQty]);

            // Record transaction
            $tStmt = $pdo->prepare("
                INSERT INTO inventory_transactions (material_id, transaction_type, reference_type, quantity, previous_stock, new_stock, notes)
                VALUES (?, 'ADJUSTMENT', 'MANUAL_COUNT', ?, ?, ?, ?)
            ");
            $tStmt->execute([$materialId, $diffQty, $currentQty, $newQty, $reason]);

            $pdo->commit();
            AuditLogger::log('Inventory', 'STOCK_ADJUSTMENT', $materialId, ['old' => $currentQty], ['new' => $newQty, 'reason' => $reason]);
            Response::success([
                'material_id' => $materialId,
                'previous_stock' => $currentQty,
                'new_stock' => $newQty,
                'adjustment_quantity' => $diffQty
            ], "Stock adjusted successfully");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function consumption(): void {
        $method = $_SERVER['REQUEST_METHOD'];
        $pdo = Database::getConnection();

        if ($method === 'GET') {
            try {
                $stmt = $pdo->query("
                    SELECT it.*, m.name as material_name, m.uom, po.order_number
                    FROM inventory_transactions it
                    JOIN materials m ON it.material_id = m.id
                    LEFT JOIN production_orders po ON it.reference_id = po.id
                    WHERE it.transaction_type = 'ISSUE'
                    ORDER BY it.created_at DESC LIMIT 100
                ");
                Response::success($stmt->fetchAll());
            } catch (Exception $e) {
                Response::error($e->getMessage(), 500);
            }
            return;
        }

        // POST Consumption
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $materialId = (int)($data['material_id'] ?? 0);
        $qty = (float)($data['quantity'] ?? 0);
        $orderId = !empty($data['production_order_id']) ? (int)$data['production_order_id'] : null;
        $notes = $data['notes'] ?? 'Material consumed for production';

        if (!$materialId || $qty <= 0) {
            Response::error("Material ID and quantity are required", 422);
            return;
        }

        try {
            $pdo->beginTransaction();
            $sbStmt = $pdo->prepare("SELECT current_quantity FROM stock_balances WHERE material_id = ? FOR UPDATE");
            $sbStmt->execute([$materialId]);
            $currentQty = (float)($sbStmt->fetchColumn() ?: 0);

            if ($currentQty < $qty) {
                Response::error("Insufficient stock. Available: {$currentQty}", 422);
                return;
            }

            $newQty = $currentQty - $qty;
            $uStmt = $pdo->prepare("UPDATE stock_balances SET current_quantity = ?, available_quantity = ? WHERE material_id = ?");
            $uStmt->execute([$newQty, $newQty, $materialId]);

            $tStmt = $pdo->prepare("
                INSERT INTO inventory_transactions (material_id, transaction_type, reference_type, reference_id, quantity, previous_stock, new_stock, notes)
                VALUES (?, 'ISSUE', 'PRODUCTION_ORDER', ?, ?, ?, ?, ?)
            ");
            $tStmt->execute([$materialId, $orderId, -$qty, $currentQty, $newQty, $notes]);

            $pdo->commit();
            AuditLogger::log('Inventory', 'CONSUMPTION', $materialId, ['qty' => $qty, 'order_id' => $orderId]);
            Response::success(['new_stock' => $newQty], "Material consumption recorded", 201);
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }
}
