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
                       COALESCE(c.name, 'General Material') as category_name, 
                       s.name as supplier_name,
                       COALESCE(sb.current_quantity, m.current_stock, 0) as current_stock,
                       COALESCE(sb.available_quantity, m.current_stock, 0) as available_stock,
                       COALESCE(sb.reserved_quantity, 0) as reserved_stock,
                       ROUND(COALESCE(sb.current_quantity, m.current_stock, 0) * m.purchase_rate, 2) as stock_value,
                       CASE WHEN COALESCE(sb.current_quantity, m.current_stock, 0) <= m.min_stock_level THEN 1 ELSE 0 END as is_low_stock
                FROM materials m
                LEFT JOIN categories c ON m.category_id = c.id
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
                SELECT it.*, m.name as material_name, m.uom, m.code as material_code
                FROM inventory_transactions it
                JOIN materials m ON it.material_id = m.id
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
                       COALESCE(c.name, 'General Material') as category_name, 
                       s.name as supplier_name, 
                       s.phone as supplier_phone,
                       COALESCE(sb.current_quantity, m.current_stock, 0) as current_stock,
                       (m.min_stock_level - COALESCE(sb.current_quantity, m.current_stock, 0)) as shortage_qty
                FROM materials m
                LEFT JOIN categories c ON m.category_id = c.id
                LEFT JOIN suppliers s ON m.supplier_id = s.id
                LEFT JOIN stock_balances sb ON m.id = sb.material_id
                WHERE m.deleted_at IS NULL AND COALESCE(sb.current_quantity, m.current_stock, 0) <= m.min_stock_level
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
        $items = [];
        if (!empty($data['items']) && is_array($data['items'])) {
            $items = $data['items'];
        } elseif (!empty($data['material_id'])) {
            $items = [
                [
                    'material_id' => $data['material_id'],
                    'quantity' => $data['quantity'] ?? 0,
                    'notes' => $data['notes'] ?? ''
                ]
            ];
        }

        if (empty($items)) {
            Response::error("No consumption items specified", 422);
            return;
        }

        $orderId = !empty($data['production_order_id']) ? (int)$data['production_order_id'] : null;
        $orderRef = trim((string)($data['production_order_ref'] ?? $data['production_order'] ?? ''));
        $generalNotes = trim((string)($data['general_notes'] ?? $data['notes'] ?? 'Material consumed for production'));

        // 1. Group and validate requested quantities per material
        $totalReqByMat = [];
        foreach ($items as $idx => $it) {
            $mid = (int)($it['material_id'] ?? 0);
            $qty = (float)($it['quantity'] ?? 0);
            if (!$mid || $qty <= 0) {
                Response::error("Item line #" . ($idx + 1) . ": Valid material and quantity greater than zero are required", 422);
                return;
            }
            $totalReqByMat[$mid] = ($totalReqByMat[$mid] ?? 0.0) + $qty;
        }

        try {
            $pdo->beginTransaction();

            // 2. Authoritative available stock validation across all selected materials
            foreach ($totalReqByMat as $mid => $reqTotal) {
                $mStmt = $pdo->prepare("SELECT id, code, name, uom, current_stock FROM materials WHERE id = ? FOR UPDATE");
                $mStmt->execute([$mid]);
                $mat = $mStmt->fetch();

                if (!$mat) {
                    $pdo->rollBack();
                    Response::error("Material #{$mid} not found in database", 404);
                    return;
                }

                $sbStmt = $pdo->prepare("SELECT current_quantity, available_quantity FROM stock_balances WHERE material_id = ? FOR UPDATE");
                $sbStmt->execute([$mid]);
                $sb = $sbStmt->fetch();

                $availStock = $sb !== false ? (float)$sb['available_quantity'] : (float)($mat['current_stock'] ?? 0);

                if ($reqTotal > ($availStock + 0.0001)) {
                    $pdo->rollBack();
                    $shortage = round($reqTotal - $availStock, 4);
                    Response::error(
                        "Insufficient stock for material '{$mat['name']}' ({$mat['code']}). Total requested across rows: {$reqTotal} {$mat['uom']}, but available stock is only {$availStock} {$mat['uom']} (Shortage: {$shortage} {$mat['uom']}).",
                        422
                    );
                    return;
                }
            }

            // 3. Apply deductions and record inventory transactions
            foreach ($items as $it) {
                $mid = (int)$it['material_id'];
                $qty = (float)$it['quantity'];
                $note = trim((string)($it['notes'] ?? ''));
                if (empty($note)) {
                    $note = !empty($orderRef) ? "Consumed for Order {$orderRef}" : $generalNotes;
                }

                // Fetch current balances
                $sbStmt = $pdo->prepare("SELECT current_quantity, available_quantity FROM stock_balances WHERE material_id = ? FOR UPDATE");
                $sbStmt->execute([$mid]);
                $sb = $sbStmt->fetch();

                $oldQty = $sb !== false ? (float)$sb['current_quantity'] : 0.0;
                $oldAvail = $sb !== false ? (float)$sb['available_quantity'] : 0.0;
                $newQty = max(0.0, $oldQty - $qty);
                $newAvail = max(0.0, $oldAvail - $qty);

                // Update stock_balances
                $updSb = $pdo->prepare("
                    INSERT INTO stock_balances (material_id, current_quantity, available_quantity)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE current_quantity = ?, available_quantity = ?
                ");
                $updSb->execute([$mid, $newQty, $newAvail, $newQty, $newAvail]);

                // Update materials table current_stock
                $pdo->prepare("UPDATE materials SET current_stock = ? WHERE id = ?")->execute([$newQty, $mid]);

                // Insert ledger transaction
                $tStmt = $pdo->prepare("
                    INSERT INTO inventory_transactions (material_id, transaction_type, reference_type, reference_id, quantity, previous_stock, new_stock, notes)
                    VALUES (?, 'ISSUE', 'PRODUCTION_ORDER', ?, ?, ?, ?, ?)
                ");
                $tStmt->execute([$mid, $orderId, -$qty, $oldQty, $newQty, $note]);
            }

            $pdo->commit();
            AuditLogger::log('Inventory', 'CONSUMPTION', 0, ['items_count' => count($items), 'order_ref' => $orderRef]);
            Response::success([
                'items_count' => count($items),
                'order_ref' => $orderRef
            ], "Material consumption recorded and stock updated successfully", 201);
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }
}
