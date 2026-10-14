<?php
// backend/controllers/MaterialController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class MaterialController {
    public function index(): void {
        $categoryId = $_GET['category_id'] ?? null;
        try {
            $pdo = Database::getConnection();

            // Check columns in materials table safely
            $mCols = [];
            try {
                $mCols = $pdo->query("DESCRIBE materials")->fetchAll(PDO::FETCH_COLUMN);
            } catch (Exception $e) {
                Response::success([]);
                return;
            }

            $hasDeletedAt = in_array('deleted_at', $mCols);
            $hasStockBalances = false;
            try {
                $pdo->query("SELECT 1 FROM stock_balances LIMIT 1");
                $hasStockBalances = true;
            } catch (Exception $e) {
                $hasStockBalances = false;
            }

            $stockSelect = $hasStockBalances 
                ? "COALESCE(sb.current_quantity, m.current_stock) as live_stock, COALESCE(sb.available_quantity, m.current_stock) as available_stock"
                : "m.current_stock as live_stock, m.current_stock as available_stock";

            $sql = "
                SELECT m.*, 
                       COALESCE(c.name, 'General Material') as category_name, 
                       s.name as supplier_name,
                       {$stockSelect}
                FROM materials m
                LEFT JOIN categories c ON m.category_id = c.id
                LEFT JOIN suppliers s ON m.supplier_id = s.id
            ";

            if ($hasStockBalances) {
                $sql .= " LEFT JOIN stock_balances sb ON m.id = sb.material_id";
            }

            $sql .= " WHERE 1=1";
            if ($hasDeletedAt) {
                $sql .= " AND m.deleted_at IS NULL";
            }

            $params = [];
            if ($categoryId) {
                $sql .= " AND m.category_id = :cat_id";
                $params[':cat_id'] = $categoryId;
            }
            $sql .= " ORDER BY m.name ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $materials = $stmt->fetchAll();

            // Load dynamic field values
            if (!empty($materials)) {
                try {
                    $fStmt = $pdo->prepare("
                        SELECT cf.field_name, cf.field_label, mfv.field_value
                        FROM material_field_values mfv
                        JOIN category_fields cf ON mfv.category_field_id = cf.id
                        WHERE mfv.material_id = :mat_id
                    ");
                    foreach ($materials as &$mat) {
                        $fStmt->execute([':mat_id' => $mat['id']]);
                        $mat['dynamic_fields'] = $fStmt->fetchAll();
                    }
                } catch (Exception $dfErr) {
                    foreach ($materials as &$mat) {
                        $mat['dynamic_fields'] = [];
                    }
                }
            }

            Response::success($materials);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function store(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $categoryId = (int)($data['category_id'] ?? 0);
        $name = trim($data['name'] ?? '');
        $code = trim($data['code'] ?? '');
        $uom = trim($data['uom'] ?? 'KG');
        $rate = (float)($data['purchase_rate'] ?? 0.0);
        $tax = (float)($data['tax_percent'] ?? 5.0);
        $minStock = (float)($data['min_stock_level'] ?? 0.0);
        $supplierId = !empty($data['supplier_id']) ? (int)$data['supplier_id'] : null;

        if (empty($code)) {
            $code = 'MAT-' . str_pad((string)(time() % 100000), 5, '0', STR_PAD_LEFT);
        }

        if (!$categoryId || empty($name)) {
            Response::error("Category and material name are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("
                INSERT INTO materials (category_id, supplier_id, code, name, uom, purchase_rate, tax_percent, min_stock_level, current_stock)
                VALUES (:cat_id, :sup_id, :code, :name, :uom, :rate, :tax, :min_stock, 0.00)
            ");
            $stmt->execute([
                ':cat_id' => $categoryId,
                ':sup_id' => $supplierId,
                ':code' => $code,
                ':name' => $name,
                ':uom' => $uom,
                ':rate' => $rate,
                ':tax' => $tax,
                ':min_stock' => $minStock
            ]);
            $materialId = (int)$pdo->lastInsertId();

            // Initial stock balance row
            $sStmt = $pdo->prepare("INSERT INTO stock_balances (material_id, current_quantity, available_quantity) VALUES (?, 0.00, 0.00)");
            $sStmt->execute([$materialId]);

            // Save dynamic field values
            if (!empty($data['dynamic_values']) && is_array($data['dynamic_values'])) {
                $fvStmt = $pdo->prepare("INSERT INTO material_field_values (material_id, category_field_id, field_value) VALUES (?, ?, ?)");
                foreach ($data['dynamic_values'] as $fieldId => $val) {
                    $fvStmt->execute([$materialId, (int)$fieldId, (string)$val]);
                }
            }

            $pdo->commit();
            AuditLogger::log('Materials', 'CREATE', $materialId, null, $data);
            Response::success(['id' => $materialId], "Material created successfully", 201);
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function show(int $id): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                SELECT m.*, 
                       COALESCE(c.name, 'General Material') as category_name, 
                       s.name as supplier_name,
                       COALESCE(sb.current_quantity, m.current_stock, 0) as live_stock, 
                       COALESCE(sb.available_quantity, m.current_stock, 0) as available_stock
                FROM materials m
                LEFT JOIN categories c ON m.category_id = c.id
                LEFT JOIN suppliers s ON m.supplier_id = s.id
                LEFT JOIN stock_balances sb ON m.id = sb.material_id
                WHERE m.id = ? AND m.deleted_at IS NULL
            ");
            $stmt->execute([$id]);
            $material = $stmt->fetch();

            if (!$material) {
                Response::error("Material not found", 404);
                return;
            }

            // Load dynamic fields
            try {
                $fStmt = $pdo->prepare("
                    SELECT cf.field_name, cf.field_label, mfv.field_value
                    FROM material_field_values mfv
                    JOIN category_fields cf ON mfv.category_field_id = cf.id
                    WHERE mfv.material_id = ?
                ");
                $fStmt->execute([$id]);
                $material['dynamic_fields'] = $fStmt->fetchAll();
            } catch (Exception $e) {
                $material['dynamic_fields'] = [];
            }

            Response::success($material);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function update(int $id): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $categoryId = (int)($data['category_id'] ?? 0);
        $name = trim($data['name'] ?? '');
        $uom = trim($data['uom'] ?? 'KG');
        $rate = (float)($data['purchase_rate'] ?? 0.0);
        $tax = (float)($data['tax_percent'] ?? 5.0);
        $minStock = (float)($data['min_stock_level'] ?? 0.0);
        $supplierId = !empty($data['supplier_id']) ? (int)$data['supplier_id'] : null;
        $status = !empty($data['status']) ? trim($data['status']) : 'active';

        if (!$categoryId || empty($name)) {
            Response::error("Category and material name are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $checkStmt = $pdo->prepare("SELECT * FROM materials WHERE id = ? FOR UPDATE");
            $checkStmt->execute([$id]);
            $existing = $checkStmt->fetch();

            if (!$existing) {
                $pdo->rollBack();
                Response::error("Material not found", 404);
                return;
            }

            // Strictly preserve the existing material code! Do NOT change code during editing.
            $updStmt = $pdo->prepare("
                UPDATE materials 
                SET category_id = :cat_id,
                    supplier_id = :sup_id,
                    name = :name,
                    uom = :uom,
                    purchase_rate = :rate,
                    tax_percent = :tax,
                    min_stock_level = :min_stock,
                    status = :status,
                    updated_at = NOW()
                WHERE id = :id
            ");
            $updStmt->execute([
                ':cat_id' => $categoryId,
                ':sup_id' => $supplierId,
                ':name' => $name,
                ':uom' => $uom,
                ':rate' => $rate,
                ':tax' => $tax,
                ':min_stock' => $minStock,
                ':status' => $status,
                ':id' => $id
            ]);

            // Save dynamic field values if provided
            if (isset($data['dynamic_values']) && is_array($data['dynamic_values'])) {
                foreach ($data['dynamic_values'] as $fieldKey => $val) {
                    if (is_numeric($fieldKey) && (int)$fieldKey > 0) {
                        $fvStmt = $pdo->prepare("
                            INSERT INTO material_field_values (material_id, category_field_id, field_value) 
                            VALUES (?, ?, ?)
                            ON DUPLICATE KEY UPDATE field_value = VALUES(field_value)
                        ");
                        $fvStmt->execute([$id, (int)$fieldKey, (string)$val]);
                    }
                }
            }

            $pdo->commit();
            AuditLogger::log('Materials', 'UPDATE', $id, $existing, $data);
            Response::success(['id' => $id, 'code' => $existing['code']], "Material updated successfully");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function destroy(int $id): void {
        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $checkStmt = $pdo->prepare("SELECT * FROM materials WHERE id = ? FOR UPDATE");
            $checkStmt->execute([$id]);
            $material = $checkStmt->fetch();

            if (!$material) {
                $pdo->rollBack();
                Response::error("Material not found", 404);
                return;
            }

            $matName = $material['name'];
            $matCode = $material['code'];

            // 1. Check purchase order items
            $poCount = 0;
            try {
                $poiStmt = $pdo->prepare("SELECT COUNT(*) FROM purchase_order_items WHERE material_id = ?");
                $poiStmt->execute([$id]);
                $poCount = (int)$poiStmt->fetchColumn();
            } catch (Exception $e) {}

            // 2. Check purchase receipt items
            $receiptCount = 0;
            try {
                $priStmt = $pdo->prepare("SELECT COUNT(*) FROM purchase_receipt_items WHERE material_id = ?");
                $priStmt->execute([$id]);
                $receiptCount = (int)$priStmt->fetchColumn();
            } catch (Exception $e) {}

            // 3. Check inventory transactions (stock ledger)
            $txCount = 0;
            try {
                $txStmt = $pdo->prepare("SELECT COUNT(*) FROM inventory_transactions WHERE material_id = ?");
                $txStmt->execute([$id]);
                $txCount = (int)$txStmt->fetchColumn();
            } catch (Exception $e) {}

            // 4. Check current stock balance
            $currentStock = 0.0;
            try {
                $sbStmt = $pdo->prepare("SELECT current_quantity FROM stock_balances WHERE material_id = ?");
                $sbStmt->execute([$id]);
                $currentStock = (float)($sbStmt->fetchColumn() ?: 0.0);
            } catch (Exception $e) {}
            if ($currentStock <= 0.0 && !empty($material['current_stock'])) {
                $currentStock = (float)$material['current_stock'];
            }

            // If there are existing references or stock balance > 0, PREVENT DELETION!
            if ($poCount > 0 || $receiptCount > 0 || $txCount > 0 || $currentStock > 0.0) {
                $pdo->rollBack();
                $reasons = [];
                if ($poCount > 0) $reasons[] = "{$poCount} purchase order item(s)";
                if ($receiptCount > 0) $reasons[] = "{$receiptCount} material receipt(s)";
                if ($txCount > 0) $reasons[] = "{$txCount} inventory transaction(s)";
                if ($currentStock > 0.0) $reasons[] = "active stock balance ({$currentStock} {$material['uom']})";

                Response::error(
                    "Cannot delete material '{$matName}' ({$matCode}) because it has existing transactions or dependencies: " . implode(', ', $reasons) . ". Deletion prevented to preserve historical data.",
                    422
                );
                return;
            }

            // Safe to delete or soft-delete
            $mCols = $pdo->query("DESCRIBE materials")->fetchAll(PDO::FETCH_COLUMN);
            if (in_array('deleted_at', $mCols)) {
                $delStmt = $pdo->prepare("UPDATE materials SET deleted_at = NOW() WHERE id = ?");
                $delStmt->execute([$id]);
            } else {
                $delStmt = $pdo->prepare("DELETE FROM materials WHERE id = ?");
                $delStmt->execute([$id]);
            }

            // Clean up 0-stock balance row and dynamic values
            try {
                $pdo->prepare("DELETE FROM stock_balances WHERE material_id = ? AND current_quantity = 0")->execute([$id]);
                $pdo->prepare("DELETE FROM material_field_values WHERE material_id = ?")->execute([$id]);
            } catch (Exception $e) {}

            $pdo->commit();
            AuditLogger::log('Materials', 'DELETE', $id, $material, null);
            Response::success(null, "Material '{$matName}' ({$matCode}) deleted successfully");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }
}

