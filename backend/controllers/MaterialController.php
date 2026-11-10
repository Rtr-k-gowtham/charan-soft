<?php
// backend/controllers/MaterialController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class MaterialController {
    private function ensureMaterialColumns(PDO $pdo): void {
        try {
            $cols = $pdo->query("SHOW COLUMNS FROM materials")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('buyer_id', $cols)) {
                $pdo->exec("ALTER TABLE materials ADD COLUMN buyer_id INT NULL DEFAULT NULL");
            }
        } catch (Exception $e) {}

        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS stock_balances (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    material_id INT NOT NULL,
                    current_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                    available_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_stock_mat (material_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
            $sbCols = $pdo->query("SHOW COLUMNS FROM stock_balances")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('current_quantity', $sbCols)) {
                $pdo->exec("ALTER TABLE stock_balances ADD COLUMN current_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0.00");
                if (in_array('quantity', $sbCols)) {
                    $pdo->exec("UPDATE stock_balances SET current_quantity = quantity");
                }
            }
            if (!in_array('available_quantity', $sbCols)) {
                $pdo->exec("ALTER TABLE stock_balances ADD COLUMN available_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0.00");
            }
        } catch (Exception $e) {}
    }

    private function saveDynamicFieldValues(PDO $pdo, int $materialId, int $categoryId, array $dynamicValues): void {
        if (empty($dynamicValues)) return;

        // Fetch existing category fields for this category
        $catFields = [];
        try {
            $cfStmt = $pdo->prepare("SELECT id, field_name FROM category_fields WHERE category_id = ?");
            $cfStmt->execute([$categoryId]);
            $catFields = $cfStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $catFields = [];
        }

        $fieldMap = []; // lowercase field_name => id
        $validIds = []; // id => true
        foreach ($catFields as $cf) {
            $fid = (int)$cf['id'];
            $validIds[$fid] = true;
            if (!empty($cf['field_name'])) {
                $fieldMap[strtolower(trim($cf['field_name']))] = $fid;
            }
        }

        $fvStmt = $pdo->prepare("
            INSERT INTO material_field_values (material_id, category_field_id, field_value) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE field_value = VALUES(field_value)
        ");

        foreach ($dynamicValues as $fieldKey => $val) {
            if ($val === null || $val === '') continue; // Skip empty fields

            $targetFieldId = null;

            if (is_numeric($fieldKey) && (int)$fieldKey > 0) {
                $numericId = (int)$fieldKey;
                if (isset($validIds[$numericId])) {
                    $targetFieldId = $numericId;
                } else {
                    $chk = $pdo->prepare("SELECT id FROM category_fields WHERE id = ?");
                    $chk->execute([$numericId]);
                    if ($chk->fetchColumn()) {
                        $targetFieldId = $numericId;
                    }
                }
            } else {
                $cleanKey = strtolower(trim((string)$fieldKey));
                if (isset($fieldMap[$cleanKey])) {
                    $targetFieldId = $fieldMap[$cleanKey];
                } else {
                    // Create dynamic field definition in category_fields so the FK constraint is satisfied
                    try {
                        $label = ucwords(str_replace('_', ' ', $cleanKey));
                        $insCf = $pdo->prepare("
                            INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order)
                            VALUES (?, ?, ?, 'text', 0, 1, 99)
                        ");
                        $insCf->execute([$categoryId, $cleanKey, $label]);
                        $targetFieldId = (int)$pdo->lastInsertId();
                        $validIds[$targetFieldId] = true;
                        $fieldMap[$cleanKey] = $targetFieldId;
                    } catch (Exception $insEx) {
                        try {
                            $findStmt = $pdo->prepare("SELECT id FROM category_fields WHERE category_id = ? AND field_name = ? LIMIT 1");
                            $findStmt->execute([$categoryId, $cleanKey]);
                            $foundId = $findStmt->fetchColumn();
                            if ($foundId) {
                                $targetFieldId = (int)$foundId;
                            }
                        } catch (Exception $e2) {}
                    }
                }
            }

            if ($targetFieldId && $targetFieldId > 0) {
                try {
                    $fvStmt->execute([$materialId, $targetFieldId, (string)$val]);
                } catch (Exception $fvEx) {
                    error_log("Defensive material field value warning: " . $fvEx->getMessage());
                }
            }
        }
    }

    public function index(): void {
        $categoryId = $_GET['category_id'] ?? null;
        try {
            $pdo = Database::getConnection();
            $this->ensureMaterialColumns($pdo);

            // Check columns in materials table safely
            $mCols = [];
            try {
                $mCols = $pdo->query("DESCRIBE materials")->fetchAll(PDO::FETCH_COLUMN);
            } catch (Exception $e) {
                Response::success([]);
                return;
            }

            $hasDeletedAt = in_array('deleted_at', $mCols);
            $hasBuyerId = in_array('buyer_id', $mCols);
            $hasStockBalances = false;
            try {
                $sbCols = $pdo->query("DESCRIBE stock_balances")->fetchAll(PDO::FETCH_COLUMN);
                $hasStockBalances = in_array('current_quantity', $sbCols);
            } catch (Exception $e) {
                $hasStockBalances = false;
            }

            $stockSelect = $hasStockBalances 
                ? "COALESCE(sb.current_quantity, m.current_stock) as live_stock, COALESCE(sb.available_quantity, m.current_stock) as available_stock"
                : "m.current_stock as live_stock, m.current_stock as available_stock";
            $stockJoin = $hasStockBalances ? " LEFT JOIN stock_balances sb ON m.id = sb.material_id" : "";

            $buyerSelect = $hasBuyerId
                ? ", COALESCE(cust.name, '') as buyer_name, COALESCE(cust.code, '') as buyer_code"
                : ", '' as buyer_name, '' as buyer_code";
            $buyerJoin = $hasBuyerId
                ? " LEFT JOIN customers cust ON m.buyer_id = cust.id"
                : "";

            $sql = "
                SELECT m.*, 
                       COALESCE(c.name, 'General Material') as category_name, 
                       s.name as supplier_name
                       {$buyerSelect},
                       {$stockSelect}
                FROM materials m
                LEFT JOIN categories c ON m.category_id = c.id
                LEFT JOIN suppliers s ON m.supplier_id = s.id
                {$buyerJoin}
                {$stockJoin}
            ";

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
        $buyerId = !empty($data['buyer_id']) ? (int)$data['buyer_id'] : null;

        if (empty($code)) {
            $code = 'MAT-' . str_pad((string)(time() % 100000), 5, '0', STR_PAD_LEFT);
        }

        if (!$categoryId || empty($name)) {
            Response::error("Category and material name are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $this->ensureMaterialColumns($pdo);
            $pdo->beginTransaction();

            $mCols = $pdo->query("DESCRIBE materials")->fetchAll(PDO::FETCH_COLUMN);
            $hasBuyerId = in_array('buyer_id', $mCols);

            if ($hasBuyerId) {
                $stmt = $pdo->prepare("
                    INSERT INTO materials (category_id, supplier_id, buyer_id, code, name, uom, purchase_rate, tax_percent, min_stock_level, current_stock)
                    VALUES (:cat_id, :sup_id, :buyer_id, :code, :name, :uom, :rate, :tax, :min_stock, 0.00)
                ");
                $stmt->execute([
                    ':cat_id' => $categoryId,
                    ':sup_id' => $supplierId,
                    ':buyer_id' => $buyerId,
                    ':code' => $code,
                    ':name' => $name,
                    ':uom' => $uom,
                    ':rate' => $rate,
                    ':tax' => $tax,
                    ':min_stock' => $minStock
                ]);
            } else {
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
            }
            $materialId = (int)$pdo->lastInsertId();

            // Initial stock balance row
            try {
                $sStmt = $pdo->prepare("INSERT INTO stock_balances (material_id, current_quantity, available_quantity) VALUES (?, 0.00, 0.00)");
                $sStmt->execute([$materialId]);
            } catch (Exception $sbEx) {}

            // Save dynamic field values safely without FK violation
            if (!empty($data['dynamic_values']) && is_array($data['dynamic_values'])) {
                $this->saveDynamicFieldValues($pdo, $materialId, $categoryId, $data['dynamic_values']);
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
            $this->ensureMaterialColumns($pdo);

            $mCols = $pdo->query("DESCRIBE materials")->fetchAll(PDO::FETCH_COLUMN);
            $hasBuyerId = in_array('buyer_id', $mCols);
            $buyerSelect = $hasBuyerId ? ", COALESCE(cust.name, '') as buyer_name, COALESCE(cust.code, '') as buyer_code" : "";
            $buyerJoin = $hasBuyerId ? " LEFT JOIN customers cust ON m.buyer_id = cust.id" : "";

            $hasStockBalances = false;
            try {
                $sbCols = $pdo->query("DESCRIBE stock_balances")->fetchAll(PDO::FETCH_COLUMN);
                $hasStockBalances = in_array('current_quantity', $sbCols);
            } catch (Exception $e) {
                $hasStockBalances = false;
            }
            $stockSelect = $hasStockBalances 
                ? "COALESCE(sb.current_quantity, m.current_stock, 0) as live_stock, COALESCE(sb.available_quantity, m.current_stock, 0) as available_stock"
                : "COALESCE(m.current_stock, 0) as live_stock, COALESCE(m.current_stock, 0) as available_stock";
            $stockJoin = $hasStockBalances ? " LEFT JOIN stock_balances sb ON m.id = sb.material_id" : "";

            $stmt = $pdo->prepare("
                SELECT m.*, 
                       COALESCE(c.name, 'General Material') as category_name, 
                       s.name as supplier_name
                       {$buyerSelect},
                       {$stockSelect}
                FROM materials m
                LEFT JOIN categories c ON m.category_id = c.id
                LEFT JOIN suppliers s ON m.supplier_id = s.id
                {$buyerJoin}
                {$stockJoin}
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
        $buyerId = !empty($data['buyer_id']) ? (int)$data['buyer_id'] : null;
        $status = !empty($data['status']) ? trim($data['status']) : 'active';

        if (!$categoryId || empty($name)) {
            Response::error("Category and material name are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $this->ensureMaterialColumns($pdo);
            $pdo->beginTransaction();

            $checkStmt = $pdo->prepare("SELECT * FROM materials WHERE id = ? FOR UPDATE");
            $checkStmt->execute([$id]);
            $existing = $checkStmt->fetch();

            if (!$existing) {
                $pdo->rollBack();
                Response::error("Material not found", 404);
                return;
            }

            $mCols = $pdo->query("DESCRIBE materials")->fetchAll(PDO::FETCH_COLUMN);
            $hasBuyerId = in_array('buyer_id', $mCols);

            if ($hasBuyerId) {
                $updStmt = $pdo->prepare("
                    UPDATE materials 
                    SET category_id = :cat_id,
                        supplier_id = :sup_id,
                        buyer_id = :buyer_id,
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
                    ':buyer_id' => $buyerId,
                    ':name' => $name,
                    ':uom' => $uom,
                    ':rate' => $rate,
                    ':tax' => $tax,
                    ':min_stock' => $minStock,
                    ':status' => $status,
                    ':id' => $id
                ]);
            } else {
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
            }

            // Save dynamic field values safely without FK violation
            if (isset($data['dynamic_values']) && is_array($data['dynamic_values'])) {
                $this->saveDynamicFieldValues($pdo, $id, $categoryId, $data['dynamic_values']);
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
                $sbCols = $pdo->query("DESCRIBE stock_balances")->fetchAll(PDO::FETCH_COLUMN);
                if (in_array('current_quantity', $sbCols)) {
                    $sbStmt = $pdo->prepare("SELECT current_quantity FROM stock_balances WHERE material_id = ?");
                    $sbStmt->execute([$id]);
                    $currentStock = (float)($sbStmt->fetchColumn() ?: 0.0);
                }
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
                $pdo->prepare("DELETE FROM stock_balances WHERE material_id = ?")->execute([$id]);
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
