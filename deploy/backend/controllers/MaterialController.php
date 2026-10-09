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

            // Auto-seed default materials if table is completely empty
            if (empty($materials)) {
                try {
                    $catRow = $pdo->query("SELECT id FROM categories LIMIT 1")->fetch();
                    $defCatId = $catRow ? (int)$catRow['id'] : 1;
                    $defMaterials = [
                        ['MAT-FAB-001', 'Cotton Fabric 100% Grey', 'MTR', 160.00, 5.00],
                        ['MAT-FAB-002', 'Cotton Satin 300TC', 'MTR', 295.00, 5.00],
                        ['MAT-FAB-003', 'Linen Fabric Raw', 'MTR', 320.00, 5.00],
                        ['MAT-FAB-004', 'Canvas Heavy Fabric', 'MTR', 210.00, 5.00],
                        ['MAT-YRN-001', 'Cotton Yarn 30s Cone', 'CONE', 240.00, 5.00],
                        ['MAT-YRN-002', 'Cotton Yarn 40s Cone', 'CONE', 280.00, 5.00],
                        ['MAT-SEW-001', 'Sewing Thread 3 Ply', 'CONE', 65.00, 12.00],
                        ['MAT-SEW-002', 'Overlock Thread', 'CONE', 55.00, 12.00],
                        ['MAT-ACC-001', 'YKK Nylon Coil Zipper #5', 'PCS', 18.50, 18.00],
                        ['MAT-ACC-002', 'Poly Horn Buttons 18L', 'PCS', 0.85, 12.00],
                        ['MAT-FIL-001', 'Polyester Fiber Fill', 'KG', 115.00, 12.00],
                        ['MAT-FIL-002', 'Polyfill Microfiber', 'KG', 145.00, 12.00],
                        ['MAT-PKG-001', 'Woven Brand Main Label', 'PCS', 2.20, 12.00],
                        ['MAT-PKG-002', 'Wash Care Satin Label', 'PCS', 1.50, 12.00]
                    ];
                    $insStmt = $pdo->prepare("
                        INSERT INTO materials (code, name, category_id, uom, purchase_rate, tax_percent, min_stock_level, current_stock, status)
                        VALUES (?, ?, ?, ?, ?, ?, 100, 500, 'active')
                    ");
                    foreach ($defMaterials as $dm) {
                        try {
                            $insStmt->execute([$dm[0], $dm[1], $defCatId, $dm[2], $dm[3], $dm[4]]);
                        } catch (Exception $ie) {}
                    }
                    $stmt->execute($params);
                    $materials = $stmt->fetchAll();
                } catch (Exception $seedErr) {}
            }

            // Load dynamic field values
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
}
