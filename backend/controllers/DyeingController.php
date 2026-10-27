<?php
// backend/controllers/DyeingController.php
// Stage 04: Fabric Dyeing Orders & Inward Receiving with Pantone Color Management
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class DyeingController {

    /**
     * Ensure database tables exist without triggering implicit commit inside active transactions
     */
    private function ensureTables(PDO $pdo): void {
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `dyeing_orders` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `dyeing_order_no` VARCHAR(50) NOT NULL UNIQUE,
                  `production_order_id` INT NOT NULL,
                  `fabric_name` VARCHAR(255) NULL DEFAULT 'Fabric Material',
                  `fabric_code` VARCHAR(50) NULL,
                  `uom` VARCHAR(20) DEFAULT 'MTR',
                  `supplier_id` INT NULL,
                  `dyeing_mill_name` VARCHAR(255) NULL,
                  `challan_no` VARCHAR(100) NULL,
                  `order_date` DATE NOT NULL,
                  `expected_delivery_date` DATE NULL,
                  `total_fabric_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `total_received_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `status` ENUM('Sent to Dyeing', 'In Process', 'Partially Received', 'Received', 'Cancelled') DEFAULT 'Sent to Dyeing',
                  `process_type` VARCHAR(100) DEFAULT 'Fabric Dyeing',
                  `remarks` TEXT NULL,
                  `created_by_user_id` INT NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  `deleted_at` TIMESTAMP NULL,
                  INDEX `idx_dye_po` (`production_order_id`),
                  INDEX `idx_dye_status` (`status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            try {
                $pdo->exec("ALTER TABLE `dyeing_orders` DROP COLUMN `fabric_material_id`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `dyeing_orders` MODIFY COLUMN `fabric_name` VARCHAR(255) NULL DEFAULT 'Fabric Material'");
            } catch (Exception $e) {}

            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `dyeing_order_items` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `dyeing_order_id` INT NOT NULL,
                  `color_id` INT NULL,
                  `color_name` VARCHAR(100) NOT NULL,
                  `pantone_code` VARCHAR(100) NULL,
                  `hex_code` VARCHAR(20) NULL,
                  `planned_quantity` DECIMAL(12, 2) NOT NULL,
                  `received_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `rate_per_unit` DECIMAL(10, 2) DEFAULT 0.00,
                  `shrinkage_loss_percent` DECIMAL(5, 2) DEFAULT 0.00,
                  `shade_match_status` VARCHAR(50) DEFAULT 'Pending',
                  `notes` TEXT NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_doi_order` (`dyeing_order_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `dyeing_receipts` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `receipt_no` VARCHAR(50) NOT NULL UNIQUE,
                  `dyeing_order_id` INT NOT NULL,
                  `production_order_id` INT NOT NULL,
                  `receipt_date` DATE NOT NULL,
                  `delivery_challan_no` VARCHAR(100) NULL,
                  `received_by` VARCHAR(255) NULL,
                  `total_received_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `photo_url` LONGTEXT NULL,
                  `shade_condition` VARCHAR(100) DEFAULT 'Approved - Pantone Matched',
                  `remarks` TEXT NULL,
                  `items_data` JSON NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_dr_order` (`dyeing_order_id`),
                  INDEX `idx_dr_po` (`production_order_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            try {
                $pdo->exec("ALTER TABLE `dyeing_receipts` ADD COLUMN `total_accepted_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `total_received_quantity`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `dyeing_receipts` ADD COLUMN `total_rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `total_accepted_quantity`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `dyeing_orders` ADD COLUMN `total_accepted_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `total_received_quantity`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `dyeing_orders` ADD COLUMN `total_rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `total_accepted_quantity`");
            } catch (Exception $e) {}
        } catch (Exception $e) {
            // Ignore if tables already exist
        }
    }

    /**
     * List all Dyeing Orders, optionally filtered by production_order_id
     */
    public function index(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureTables($pdo);

            $poId = isset($_GET['production_order_id']) && is_numeric($_GET['production_order_id']) 
                ? (int)$_GET['production_order_id'] 
                : null;

            $sql = "
                SELECT d.*, 
                       po.order_number as production_order_number, 
                       po.title as production_order_title,
                       s.name as supplier_name,
                       s.code as supplier_code,
                       s.phone as supplier_phone
                FROM dyeing_orders d
                LEFT JOIN production_orders po ON d.production_order_id = po.id
                LEFT JOIN suppliers s ON d.supplier_id = s.id
                WHERE d.deleted_at IS NULL
            ";
            $params = [];

            if ($poId) {
                $sql .= " AND d.production_order_id = ?";
                $params[] = $poId;
            }

            $sql .= " ORDER BY d.id DESC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch items and receipts for each dyeing order
            $itemStmt = $pdo->prepare("SELECT * FROM dyeing_order_items WHERE dyeing_order_id = ? ORDER BY id ASC");
            $receiptStmt = $pdo->prepare("SELECT * FROM dyeing_receipts WHERE dyeing_order_id = ? ORDER BY id DESC");

            foreach ($orders as &$ord) {
                $itemStmt->execute([(int)$ord['id']]);
                $ord['items'] = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

                $receiptStmt->execute([(int)$ord['id']]);
                $ord['receipts'] = $receiptStmt->fetchAll(PDO::FETCH_ASSOC);
            }

            Response::success($orders);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * Get single Dyeing Order by ID
     */
    public function show($rawId): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureTables($pdo);

            $rawKey = trim((string)$rawId);
            $stmt = $pdo->prepare("
                SELECT d.*, 
                       po.order_number as production_order_number, 
                       po.title as production_order_title,
                       s.name as supplier_name,
                       s.code as supplier_code,
                       s.phone as supplier_phone
                FROM dyeing_orders d
                LEFT JOIN production_orders po ON d.production_order_id = po.id
                LEFT JOIN suppliers s ON d.supplier_id = s.id
                WHERE (d.id = ? OR d.dyeing_order_no = ?) AND d.deleted_at IS NULL
            ");
            $stmt->execute([$rawKey, $rawKey]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                Response::error("Dyeing Order not found", 404);
                return;
            }

            $id = (int)$order['id'];
            $itemStmt = $pdo->prepare("SELECT * FROM dyeing_order_items WHERE dyeing_order_id = ? ORDER BY id ASC");
            $itemStmt->execute([$id]);
            $order['items'] = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

            $receiptStmt = $pdo->prepare("SELECT * FROM dyeing_receipts WHERE dyeing_order_id = ? ORDER BY id DESC");
            $receiptStmt->execute([$id]);
            $order['receipts'] = $receiptStmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch quality inspections for this dyeing order / production order
            try {
                $insStmt = $pdo->prepare("SELECT * FROM quality_inspections WHERE (production_order_id = ? OR reference_id = ?) AND stage_id = 4 ORDER BY id DESC");
                $insStmt->execute([(int)$order['production_order_id'], $order['dyeing_order_no']]);
                $order['inspections'] = $insStmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (Exception $ie) {
                $order['inspections'] = [];
            }

            // Fetch rework records for this dyeing order / production order
            try {
                $rwStmt = $pdo->prepare("
                    SELECT rw.*, 
                           src_ps.name as source_stage_name,
                           src_ps.code as source_stage_code
                    FROM rework_records rw
                    LEFT JOIN production_stages src_ps ON rw.stage_id = src_ps.id
                    WHERE (rw.production_order_id = ? OR rw.reference_id = ?) AND rw.stage_id = 4
                    ORDER BY rw.id DESC
                ");
                $rwStmt->execute([(int)$order['production_order_id'], $order['dyeing_order_no']]);
                $order['rework_records'] = $rwStmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (Exception $reEx) {
                $order['rework_records'] = [];
            }

            Response::success($order);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * Compute Required, Allocated, and Remaining Eligible Quantities for each Color/Pantone requirement
     * under a Production Order.
     * 
     * Concurrency-safe when run within a transaction with row locking ($forUpdate = true).
     */
    public function calculateOrderColorAllocations(PDO $pdo, int $poId, ?int $excludeDyeingOrderId = null, bool $forUpdate = false): array {
        // 1. Fetch Production Order
        $lockSql = $forUpdate ? " FOR UPDATE" : "";
        $poStmt = $pdo->prepare("SELECT id, order_number, title, total_quantity, customer_id FROM production_orders WHERE id = ?" . $lockSql);
        $poStmt->execute([$poId]);
        $prodOrder = $poStmt->fetch(PDO::FETCH_ASSOC);
        if (!$prodOrder) {
            return [];
        }

        // 2. Fetch distinct colors and their garment quantities from PO items
        // Group strictly by poi.color to avoid duplicate cartesian joins across multiple Pantone records
        $colorStmt = $pdo->prepare("
            SELECT 
                poi.color as color_name,
                MAX(COALESCE(col.pantone_code, '')) as pantone_code,
                MAX(COALESCE(col.hex_code, '#6366f1')) as hex_code,
                SUM(poi.total_quantity) as total_garment_qty
            FROM production_order_items poi
            LEFT JOIN colors col ON (
                LOWER(TRIM(poi.color)) = LOWER(TRIM(col.name)) 
                OR LOWER(TRIM(poi.color)) = LOWER(TRIM(col.code))
                OR LOWER(TRIM(poi.color)) = LOWER(TRIM(col.pantone_code))
            )
            WHERE poi.production_order_id = ?
            GROUP BY poi.color
            ORDER BY poi.color ASC
        ");
        $colorStmt->execute([$poId]);
        $colors = $colorStmt->fetchAll(PDO::FETCH_ASSOC);

        // Enrich missing Pantone codes
        foreach ($colors as &$c) {
            if (empty($c['pantone_code']) && !empty($c['color_name'])) {
                try {
                    $pSearch = $pdo->prepare("SELECT pantone_code, hex_code FROM pantone_colors WHERE LOWER(pantone_name) LIKE ? OR LOWER(pantone_code) LIKE ? LIMIT 1");
                    $cTerm = '%' . strtolower(trim((string)$c['color_name'])) . '%';
                    $pSearch->execute([$cTerm, $cTerm]);
                    $foundP = $pSearch->fetch(PDO::FETCH_ASSOC);
                    if ($foundP) {
                        $c['pantone_code'] = $foundP['pantone_code'];
                        if (!empty($foundP['hex_code'])) $c['hex_code'] = $foundP['hex_code'];
                    }
                } catch (Exception $e) {}
            }
        }
        unset($c);

        // 3. Gather total inwarded fabric from Stage 03 Purchase Orders
        $fabInwardStmt = $pdo->prepare("
            SELECT COALESCE(SUM(poi.received_quantity), 0)
            FROM purchase_order_items poi
            JOIN purchase_orders po ON poi.purchase_order_id = po.id
            LEFT JOIN categories c ON po.category_id = c.id
            WHERE (po.production_order_id = ? OR po.remarks LIKE ?)
              AND (
                  UPPER(COALESCE(c.name, '')) LIKE '%FABRIC%' 
                  OR UPPER(COALESCE(poi.item_description, '')) LIKE '%FABRIC%'
                  OR UPPER(COALESCE(poi.item_description, '')) LIKE '%COTTON%'
                  OR UPPER(COALESCE(poi.item_description, '')) LIKE '%JERSEY%'
                  OR UPPER(COALESCE(poi.item_description, '')) LIKE '%MAT-FAB%'
              )
        ");
        $likeOrder = '%' . $prodOrder['order_number'] . '%';
        $fabInwardStmt->execute([$poId, $likeOrder]);
        $totalFabricInwarded = (float)$fabInwardStmt->fetchColumn();

        $totalOrderGarments = 0.0;
        foreach ($colors as $c) {
            $totalOrderGarments += (float)($c['total_garment_qty'] ?? 0);
        }

        // Total fabric requirement: if inwarded > 0, use inwarded fabric; else order total quantity
        $totalFabricRequired = ($totalFabricInwarded > 0) ? $totalFabricInwarded : (($totalOrderGarments > 0) ? $totalOrderGarments : (float)($prodOrder['total_quantity'] ?? 100));

        // 4. Fetch all active Dyeing Order Items for this Production Order
        // Exclude cancelled and soft-deleted orders. Also exclude $excludeDyeingOrderId if specified.
        $excludeSql = ($excludeDyeingOrderId !== null && $excludeDyeingOrderId > 0) ? " AND d.id != " . (int)$excludeDyeingOrderId : "";
        $activeDoiStmt = $pdo->prepare("
            SELECT 
                doi.id,
                doi.dyeing_order_id,
                doi.color_id,
                doi.color_name,
                doi.pantone_code,
                doi.hex_code,
                doi.planned_quantity,
                doi.received_quantity,
                d.dyeing_order_no,
                d.status as order_status,
                d.fabric_name
            FROM dyeing_order_items doi
            JOIN dyeing_orders d ON doi.dyeing_order_id = d.id
            WHERE d.production_order_id = ?
              AND d.status != 'Cancelled'
              AND d.deleted_at IS NULL
              {$excludeSql}
            " . $lockSql);
        $activeDoiStmt->execute([$poId]);
        $activeItems = $activeDoiStmt->fetchAll(PDO::FETCH_ASSOC);

        // 5. Match active dyeing order items to each required color variant
        $allocations = [];
        $totalRequiredSum = 0.0;
        $totalAllocatedSum = 0.0;
        $totalRemainingSum = 0.0;

        foreach ($colors as $c) {
            $cName = trim((string)$c['color_name']);
            $pCode = trim((string)$c['pantone_code']);
            $gQty = (float)($c['total_garment_qty'] ?? 0);

            // Proportional fabric requirement
            if ($totalOrderGarments > 0 && $totalFabricRequired > 0) {
                $reqQty = round($totalFabricRequired * ($gQty / $totalOrderGarments), 2);
            } else {
                $reqQty = $gQty;
            }

            // Find matching active order items
            $allocatedQty = 0.0;
            $matchingOrders = [];
            $cLower = strtolower($cName);
            $pLower = strtolower($pCode);

            foreach ($activeItems as $ai) {
                $aiColor = strtolower(trim((string)$ai['color_name']));
                $aiPantone = strtolower(trim((string)$ai['pantone_code']));

                $isMatch = false;
                if ($cLower !== '' && $aiColor === $cLower) {
                    $isMatch = true;
                } elseif ($pLower !== '' && ($aiPantone === $pLower || $aiColor === $pLower)) {
                    $isMatch = true;
                } elseif ($aiPantone !== '' && $cLower === $aiPantone) {
                    $isMatch = true;
                } elseif ($cLower !== '' && ($aiPantone !== '' && (str_contains($cLower, $aiPantone) || str_contains($aiPantone, $cLower)))) {
                    $isMatch = true;
                } elseif ($cLower !== '' && ($aiColor !== '' && (str_contains($cLower, $aiColor) || str_contains($aiColor, $cLower)))) {
                    $isMatch = true;
                }

                if ($isMatch) {
                    $planQty = (float)($ai['planned_quantity'] ?? 0);
                    $recQty = (float)($ai['received_quantity'] ?? 0);
                    $allocatedQty += max($planQty, $recQty);
                    $matchingOrders[$ai['dyeing_order_no']] = $ai['order_status'];
                }
            }

            $allocatedQty = round($allocatedQty, 2);
            $remainingEligible = max(0.0, round($reqQty - $allocatedQty, 2));

            $totalRequiredSum += $reqQty;
            $totalAllocatedSum += $allocatedQty;
            $totalRemainingSum += $remainingEligible;

            $allocations[] = [
                'color_name' => $cName,
                'pantone_code' => $pCode,
                'hex_code' => $c['hex_code'],
                'garment_quantity' => $gQty,
                'required_quantity' => $reqQty,
                'allocated_quantity' => $allocatedQty,
                'remaining_eligible_quantity' => $remainingEligible,
                'is_fully_allocated' => ($remainingEligible <= 0.001),
                'existing_orders' => array_keys($matchingOrders)
            ];
        }

        // Adjust rounding drift on total required
        $drift = round($totalFabricRequired - $totalRequiredSum, 2);
        if (abs($drift) > 0 && abs($drift) < 1 && count($allocations) > 0) {
            $lastIdx = count($allocations) - 1;
            $allocations[$lastIdx]['required_quantity'] = round($allocations[$lastIdx]['required_quantity'] + $drift, 2);
            $allocations[$lastIdx]['remaining_eligible_quantity'] = max(0.0, round($allocations[$lastIdx]['required_quantity'] - $allocations[$lastIdx]['allocated_quantity'], 2));
            $allocations[$lastIdx]['is_fully_allocated'] = ($allocations[$lastIdx]['remaining_eligible_quantity'] <= 0.001);
            $totalRequiredSum = round($totalRequiredSum + $drift, 2);
            $totalRemainingSum = max(0.0, round($totalRequiredSum - $totalAllocatedSum, 2));
        }

        return [
            'total_fabric_required' => round($totalFabricRequired, 2),
            'total_fabric_inwarded' => round($totalFabricInwarded, 2),
            'total_allocated_fabric' => round($totalAllocatedSum, 2),
            'total_remaining_eligible_fabric' => round($totalRemainingSum, 2),
            'has_eligible_quantity' => ($totalRemainingSum > 0.001),
            'color_allocations' => $allocations,
            'active_orders_count' => count(array_unique(array_column($activeItems, 'dyeing_order_no')))
        ];
    }

    /**
     * Compute Inwarded Fabric vs Outward to Dyeing for a Production Order
     */
    public function fabricStock(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureTables($pdo);

            $rawPoId = trim((string)($_GET['production_order_id'] ?? $_GET['id'] ?? $_GET['order_id'] ?? ''));
            $poId = is_numeric($rawPoId) ? (int)$rawPoId : 0;

            if ($poId <= 0 && !empty($rawPoId)) {
                $lookup = $pdo->prepare("SELECT id FROM production_orders WHERE order_number = ? OR id = ? LIMIT 1");
                $lookup->execute([$rawPoId, $rawPoId]);
                $poId = (int)$lookup->fetchColumn();
            }

            if ($poId <= 0) {
                Response::error("Valid production_order_id is required", 422);
                return;
            }

            // Fetch production order
            $poStmt = $pdo->prepare("
                SELECT po.*, c.name as category_name, cu.name as customer_name
                FROM production_orders po
                LEFT JOIN categories c ON po.category_id = c.id
                LEFT JOIN customers cu ON po.customer_id = cu.id
                WHERE po.id = ?
            ");
            $poStmt->execute([$poId]);
            $prodOrder = $poStmt->fetch(PDO::FETCH_ASSOC);

            if (!$prodOrder) {
                Response::error("Production order not found", 404);
                return;
            }

            // 1. Gather all FABRIC items received across all Purchase Orders for this production order
            // Fabric items are identified by category name containing 'FABRIC' or item_description containing 'Fabric' / 'MAT-FAB'
            $fabricInwardStmt = $pdo->prepare("
                SELECT 
                    poi.id as po_item_id,
                    poi.material_id,
                    poi.item_description,
                    poi.received_quantity,
                    poi.dynamic_data,
                    po.po_number,
                    po.id as purchase_order_id,
                    c.name as category_name
                FROM purchase_order_items poi
                JOIN purchase_orders po ON poi.purchase_order_id = po.id
                LEFT JOIN categories c ON po.category_id = c.id
                WHERE (po.production_order_id = ? OR po.remarks LIKE ?)
                  AND (
                      UPPER(COALESCE(c.name, '')) LIKE '%FABRIC%' 
                      OR UPPER(COALESCE(poi.item_description, '')) LIKE '%FABRIC%'
                      OR UPPER(COALESCE(poi.item_description, '')) LIKE '%COTTON%'
                      OR UPPER(COALESCE(poi.item_description, '')) LIKE '%JERSEY%'
                      OR UPPER(COALESCE(poi.item_description, '')) LIKE '%MAT-FAB%'
                  )
            ");
            $likeOrderNum = '%' . $prodOrder['order_number'] . '%';
            $fabricInwardStmt->execute([$poId, $likeOrderNum]);
            $fabricItems = $fabricInwardStmt->fetchAll(PDO::FETCH_ASSOC);

            // Group fabric items by material_id with accurate available balance
            $fabricMap = [];
            $totalFabricInwarded = 0.0;
            $totalFabricOrdered = 0.0;

            foreach ($fabricItems as $fi) {
                $dyn = !empty($fi['dynamic_data']) ? json_decode($fi['dynamic_data'], true) : [];
                $mId = (int)($fi['material_id'] ?: ($dyn['material_id'] ?? 0));
                $key = (string)$mId;
                $rcvQty = (float)($fi['received_quantity'] ?? $dyn['received_quantity'] ?? 0);
                $ordQty = (float)($dyn['quantity'] ?? $rcvQty);

                if (!isset($fabricMap[$key])) {
                    $fabricMap[$key] = [
                        'material_id' => $mId,
                        'material_code' => $dyn['material_code'] ?? ('MAT-' . $mId),
                        'material_name' => $fi['item_description'] ?: ($dyn['item_description'] ?? 'Cotton Fabric'),
                        'uom' => $dyn['uom'] ?? 'MTR',
                        'inward_quantity' => 0.0,
                        'outward_quantity' => 0.0,
                        'available_quantity' => 0.0
                    ];
                }
                $fabricMap[$key]['inward_quantity'] += $rcvQty;
                $totalFabricInwarded += $rcvQty;
                $totalFabricOrdered += $ordQty;
            }

            // Fetch material codes and names from materials master
            if (!empty($fabricMap)) {
                $matIds = array_keys($fabricMap);
                $inClause = implode(',', array_map('intval', $matIds));
                try {
                    $mQuery = $pdo->query("SELECT id, code, name, uom FROM materials WHERE id IN ($inClause)");
                    while ($mRow = $mQuery->fetch(PDO::FETCH_ASSOC)) {
                        $k = (string)$mRow['id'];
                        if (isset($fabricMap[$k])) {
                            $fabricMap[$k]['material_code'] = $mRow['code'] ?: $fabricMap[$k]['material_code'];
                            $fabricMap[$k]['material_name'] = $mRow['name'] ?: $fabricMap[$k]['material_name'];
                            $fabricMap[$k]['uom'] = $mRow['uom'] ?: $fabricMap[$k]['uom'];
                        }
                    }
                } catch (Exception $e) {}
            }

            // If no fabric has been inwarded yet from POs, populate from order BOM requirements with actual 0 inward stock
            if (empty($fabricMap)) {
                try {
                    $bomStmt = $pdo->prepare("
                        SELECT bom.*, m.code as material_code, m.name as material_name, m.uom as material_uom
                        FROM order_material_requirements bom
                        LEFT JOIN materials m ON bom.material_id = m.id
                        WHERE bom.production_order_id = ?
                          AND (UPPER(bom.category) LIKE '%FABRIC%' OR UPPER(bom.material_name) LIKE '%FABRIC%' OR UPPER(COALESCE(m.name, '')) LIKE '%FABRIC%')
                    ");
                    $bomStmt->execute([$poId]);
                    $bomFabrics = $bomStmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($bomFabrics as $bf) {
                        $k = (string)($bf['material_id'] ?: $bf['id']);
                        $fabricMap[$k] = [
                            'material_id' => (int)($bf['material_id'] ?: $bf['id']),
                            'material_code' => $bf['material_code'] ?: ('MAT-' . $k),
                            'material_name' => $bf['material_name'] ?: ($bf['name'] ?? 'Fabric'),
                            'uom' => $bf['material_uom'] ?: ($bf['uom'] ?? 'MTR'),
                            'inward_quantity' => 0.0,
                            'outward_quantity' => 0.0,
                            'available_quantity' => 0.0
                        ];
                    }
                } catch (Exception $e) {}
            }

            // 2. Gather total fabric quantity already issued to Dyeing Orders (Outward)
            $dyeingOutwardStmt = $pdo->prepare("
                SELECT COALESCE(SUM(total_fabric_quantity), 0) as total_outward
                FROM dyeing_orders 
                WHERE production_order_id = ? AND status != 'Cancelled' AND deleted_at IS NULL
            ");
            $dyeingOutwardStmt->execute([$poId]);
            $totalFabricOutward = (float)$dyeingOutwardStmt->fetchColumn();

            // Fetch existing dyeing orders for this production order to allocate outward quantity accurately
            $dOrderStmt = $pdo->prepare("
                SELECT id, fabric_name, total_fabric_quantity
                FROM dyeing_orders
                WHERE production_order_id = ? AND status != 'Cancelled' AND deleted_at IS NULL
            ");
            $dOrderStmt->execute([$poId]);
            $existingDyeOrders = $dOrderStmt->fetchAll(PDO::FETCH_ASSOC);

            // Allocate outward quantity to specific materials
            $firstKey = !empty($fabricMap) ? array_key_first($fabricMap) : null;
            foreach ($existingDyeOrders as $edo) {
                $edoQty = (float)($edo['total_fabric_quantity'] ?? 0);
                $matched = false;
                if (!empty($edo['fabric_name'])) {
                    foreach ($fabricMap as $k => &$fm) {
                        if (stripos($fm['material_name'], $edo['fabric_name']) !== false || stripos($edo['fabric_name'], $fm['material_name']) !== false) {
                            $fm['outward_quantity'] += $edoQty;
                            $matched = true;
                            break;
                        }
                    }
                    unset($fm);
                }
                if (!$matched && $firstKey && isset($fabricMap[$firstKey])) {
                    $fabricMap[$firstKey]['outward_quantity'] += $edoQty;
                }
            }

            foreach ($fabricMap as $k => &$fm) {
                $fm['available_quantity'] = max(0.0, round($fm['inward_quantity'] - $fm['outward_quantity'], 2));
            }
            unset($fm);

            $fabricMaterialsList = array_values($fabricMap);

            // 3. Gather total dyed fabric received back from mills
            $dyeingReceivedStmt = $pdo->prepare("
                SELECT COALESCE(SUM(total_received_quantity), 0) as total_received
                FROM dyeing_orders 
                WHERE production_order_id = ? AND status != 'Cancelled' AND deleted_at IS NULL
            ");
            $dyeingReceivedStmt->execute([$poId]);
            $totalFabricReceivedFromDyeing = (float)$dyeingReceivedStmt->fetchColumn();

            // Calculate comprehensive variant & quantity allocations
            $allocData = $this->calculateOrderColorAllocations($pdo, $poId);
            $suggestedColors = $allocData['color_allocations'] ?? [];
            $balanceAvailableForDyeing = (float)($allocData['total_remaining_eligible_fabric'] ?? 0.0);

            // 5. Fetch dyeing suppliers / mills
            $suppStmt = $pdo->query("
                SELECT s.id, s.code, s.name, s.phone, s.contact_person
                FROM suppliers s
                LEFT JOIN categories c ON s.category_id = c.id
                WHERE s.status = 'active' 
                  AND (UPPER(COALESCE(c.name, '')) LIKE '%DYEING%' OR UPPER(s.name) LIKE '%DYE%' OR s.category_id IS NULL)
                ORDER BY s.name ASC
            ");
            $dyeingMills = $suppStmt->fetchAll(PDO::FETCH_ASSOC);

            Response::success([
                'production_order' => [
                    'id' => $prodOrder['id'],
                    'order_number' => $prodOrder['order_number'],
                    'title' => $prodOrder['title'],
                    'customer_name' => $prodOrder['customer_name'] ?? 'N/A'
                ],
                'total_fabric_ordered' => $totalFabricOrdered,
                'total_fabric_inwarded' => $totalFabricInwarded,
                'total_fabric_outward' => $totalFabricOutward,
                'balance_available_for_dyeing' => $balanceAvailableForDyeing,
                'total_fabric_received_from_dyeing' => $totalFabricReceivedFromDyeing,
                'total_fabric_required' => $allocData['total_fabric_required'] ?? $totalFabricInwarded,
                'total_allocated_fabric' => $allocData['total_allocated_fabric'] ?? $totalFabricOutward,
                'total_remaining_eligible_fabric' => $allocData['total_remaining_eligible_fabric'] ?? 0.0,
                'has_eligible_quantity' => $allocData['has_eligible_quantity'] ?? false,
                'fabric_materials' => $fabricMaterialsList,
                'raw_inward_items' => $fabricItems,
                'suggested_colors' => $suggestedColors,
                'color_allocations' => $suggestedColors,
                'dyeing_mills' => $dyeingMills
            ]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * Create Dyeing Order (Outward to Dyeing with Color Breakdown + Pantone Codes)
     */
    public function store(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $rawPo = trim((string)($data['production_order_id'] ?? $data['order_number'] ?? ''));
        $poId = is_numeric($rawPo) ? (int)$rawPo : 0;
        if ($poId <= 0 && !empty($rawPo)) {
            try {
                $pdoCheck = Database::getConnection();
                $pLookup = $pdoCheck->prepare("SELECT id FROM production_orders WHERE order_number = ? OR id = ? LIMIT 1");
                $pLookup->execute([$rawPo, $rawPo]);
                $poId = (int)$pLookup->fetchColumn();
            } catch (Exception $e) {}
        }
        $fabricName = trim($data['fabric_name'] ?? 'Cotton Fabric');
        $uom = trim($data['uom'] ?? 'MTR');
        $items = $data['items'] ?? [];

        if ($poId <= 0) {
            Response::error("Valid production_order_id is required", 422);
            return;
        }

        if (empty($items) || !is_array($items)) {
            Response::error("At least one color item is required for Dyeing Order", 422);
            return;
        }

        // Calculate total quantity from colors
        $totalFabricQty = 0.0;
        foreach ($items as $it) {
            $qty = (float)($it['planned_quantity'] ?? $it['quantity'] ?? 0);
            if ($qty <= 0) {
                Response::error("Each color must have a positive quantity (e.g. Green: 20, Red: 20)", 422);
                return;
            }
            $totalFabricQty += $qty;
        }

        try {
            $pdo = Database::getConnection();
            $this->ensureTables($pdo);

            $pdo->beginTransaction();

            // Verify production order exists
            $pStmt = $pdo->prepare("SELECT id, order_number FROM production_orders WHERE id = ? FOR UPDATE");
            $pStmt->execute([$poId]);
            $pOrder = $pStmt->fetch(PDO::FETCH_ASSOC);

            if (!$pOrder) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Response::error("Production Order not found", 404);
                return;
            }



            // Concurrency-safe calculation of authoritative color & material allocations for this production order
            $allocData = $this->calculateOrderColorAllocations($pdo, $poId, null, true);
            $allocations = $allocData['color_allocations'] ?? [];
            $totalRemainingEligible = (float)($allocData['total_remaining_eligible_fabric'] ?? 0.0);

            // Collect all existing active dyeing order numbers across the PO for clear user guidance
            $allExistingOrders = [];
            foreach ($allocations as $al) {
                if (!empty($al['existing_orders'])) {
                    foreach ($al['existing_orders'] as $ordNo) {
                        $allExistingOrders[$ordNo] = true;
                    }
                }
            }
            $existingOrdersRef = !empty($allExistingOrders) ? " (" . implode(', ', array_keys($allExistingOrders)) . ")" : "";

            // 1. Overall PO quantity check: if zero eligible balance remains
            if ($totalRemainingEligible <= 0.001) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Response::error("A dyeing order already exists for this material and Pantone color under this production order. The quantity has already been processed. Please check the existing dyeing order{$existingOrdersRef} before creating another.", 422);
                return;
            }

            // If total requested exceeds total eligible remaining
            if ($totalFabricQty > ($totalRemainingEligible + 0.01)) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Response::error("Total requested outward quantity ({$totalFabricQty} {$uom}) exceeds the remaining eligible requirement ({$totalRemainingEligible} {$uom}) under this production order.{$existingOrdersRef} Please check the existing dyeing order before creating another.", 422);
                return;
            }

            // 2. Per-color variant validation (quantity-aware & variant-aware)
            foreach ($items as $it) {
                $qty = (float)($it['planned_quantity'] ?? $it['quantity'] ?? 0);
                $cName = trim($it['color_name'] ?? '');
                $pantone = trim($it['pantone_code'] ?? '');

                $matchedIdx = -1;
                $cLower = strtolower($cName);
                $pLower = strtolower($pantone);

                foreach ($allocations as $idx => $v) {
                    $vColor = strtolower(trim((string)$v['color_name']));
                    $vPantone = strtolower(trim((string)$v['pantone_code']));

                    $isMatch = false;
                    if ($cLower !== '' && $vColor === $cLower) {
                        $isMatch = true;
                    } elseif ($pLower !== '' && ($vPantone === $pLower || $vColor === $pLower)) {
                        $isMatch = true;
                    } elseif ($vPantone !== '' && $cLower === $vPantone) {
                        $isMatch = true;
                    } elseif ($cLower !== '' && ($vPantone !== '' && (str_contains($cLower, $vPantone) || str_contains($vPantone, $cLower)))) {
                        $isMatch = true;
                    } elseif ($cLower !== '' && ($vColor !== '' && (str_contains($cLower, $vColor) || str_contains($vColor, $cLower)))) {
                        $isMatch = true;
                    }

                    if ($isMatch) {
                        $matchedIdx = $idx;
                        break;
                    }
                }

                if ($matchedIdx >= 0) {
                    $variant = $allocations[$matchedIdx];
                    $rem = (float)$variant['remaining_eligible_quantity'];
                    $varExisting = !empty($variant['existing_orders']) ? " (" . implode(', ', $variant['existing_orders']) . ")" : $existingOrdersRef;

                    if ($rem <= 0.001) {
                        if ($pdo->inTransaction()) $pdo->rollBack();
                        Response::error("A dyeing order already exists for this material and Pantone color under this production order. The quantity has already been processed. Please check the existing dyeing order{$varExisting} before creating another.", 422);
                        return;
                    }

                    if ($qty > ($rem + 0.01)) {
                        if ($pdo->inTransaction()) $pdo->rollBack();
                        Response::error("Requested quantity ({$qty} {$uom}) for '{$cName}' exceeds remaining eligible requirement ({$rem} {$uom}) under this production order.{$varExisting} Please check the existing dyeing order before creating another.", 422);
                        return;
                    }

                    // Deduct from variant pool in case multiple rows request the same color
                    $allocations[$matchedIdx]['remaining_eligible_quantity'] = max(0.0, round($rem - $qty, 2));
                }
            }

            // Generate clean unique Dyeing Order Number
            $dyeingOrderNo = 'DYE-' . date('dmy') . '-' . str_pad((string)rand(10, 999), 3, '0', STR_PAD_LEFT);

            // Resolve dyeing mill / supplier
            $supplierId = !empty($data['supplier_id']) ? (int)$data['supplier_id'] : null;
            $millName = trim($data['dyeing_mill_name'] ?? '');
            if ($supplierId && empty($millName)) {
                $sStmt = $pdo->prepare("SELECT name FROM suppliers WHERE id = ?");
                $sStmt->execute([$supplierId]);
                $millName = (string)($sStmt->fetchColumn() ?: '');
            }

            $orderDate = !empty($data['order_date']) ? $data['order_date'] : date('Y-m-d');
            $deliveryDate = !empty($data['expected_delivery_date']) ? $data['expected_delivery_date'] : date('Y-m-d', strtotime('+10 days'));

            $insStmt = $pdo->prepare("
                INSERT INTO dyeing_orders (
                    dyeing_order_no, production_order_id, fabric_name, 
                    fabric_code, uom, supplier_id, dyeing_mill_name, challan_no, 
                    order_date, expected_delivery_date, total_fabric_quantity, total_received_quantity, 
                    status, process_type, remarks
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 'Sent to Dyeing', ?, ?)
            ");
            $insStmt->execute([
                $dyeingOrderNo,
                $poId,
                $fabricName ?: 'Fabric Material',
                $data['fabric_code'] ?? null,
                $uom,
                $supplierId,
                $millName,
                $data['challan_no'] ?? ('DC-DYE-' . rand(1000, 9999)),
                $orderDate,
                $deliveryDate,
                $totalFabricQty,
                $data['process_type'] ?? 'Fabric Dyeing',
                $data['remarks'] ?? 'Outward sent to dyeing mill'
            ]);
            $dyeingOrderId = (int)$pdo->lastInsertId();

            // Insert color items breakdown with Pantone code
            $itemIns = $pdo->prepare("
                INSERT INTO dyeing_order_items (
                    dyeing_order_id, color_id, color_name, pantone_code, hex_code, 
                    planned_quantity, received_quantity, rate_per_unit, notes
                ) VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, ?)
            ");

            foreach ($items as $it) {
                $cName = trim($it['color_name'] ?? 'Custom Color');
                $pantone = trim($it['pantone_code'] ?? '');
                $hex = trim($it['hex_code'] ?? '#6366f1');
                $qty = (float)($it['planned_quantity'] ?? $it['quantity'] ?? 0);
                $rate = (float)($it['rate_per_unit'] ?? 0);
                $notes = trim($it['notes'] ?? '');

                $itemIns->execute([
                    $dyeingOrderId,
                    $it['color_id'] ?? null,
                    $cName,
                    $pantone,
                    $hex,
                    $qty,
                    $rate,
                    $notes
                ]);
            }

            // Update production order items to Stage 4 (Dyeing) if they were still at Stage 3 (Inward)
            $findStage4 = $pdo->query("SELECT id FROM production_stages WHERE code = 'DYE' OR sequence_order = 4 LIMIT 1");
            $dyeStageId = (int)($findStage4->fetchColumn() ?: 4);

            $pdo->prepare("
                UPDATE production_order_items 
                SET current_stage_id = ? 
                WHERE production_order_id = ? AND current_stage_id < ?
            ")->execute([$dyeStageId, $poId, $dyeStageId]);

            if ($pdo->inTransaction()) {
                $pdo->commit();
            }

            AuditLogger::log('DyeingOrders', 'CREATE', $dyeingOrderId, null, [
                'dyeing_order_no' => $dyeingOrderNo,
                'production_order_id' => $poId,
                'total_quantity' => $totalFabricQty,
                'colors_count' => count($items)
            ]);

            Response::success([
                'id' => $dyeingOrderId,
                'dyeing_order_no' => $dyeingOrderNo,
                'total_fabric_quantity' => $totalFabricQty,
                'status' => 'Sent to Dyeing'
            ], "Dyeing Order created successfully with color & Pantone breakdown", 201);
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * Inward Receiving from Dyeing (Receive dyed fabric per color with Pantone verification & photo proof)
     */
    public function receive($rawDyeingOrderId): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $items = $data['items'] ?? [];

        if (empty($items) || !is_array($items)) {
            Response::error("Received quantities for color items are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $this->ensureTables($pdo);

            $pdo->beginTransaction();

            $rawKey = trim((string)$rawDyeingOrderId);
            $dStmt = $pdo->prepare("SELECT * FROM dyeing_orders WHERE (id = ? OR dyeing_order_no = ?) FOR UPDATE");
            $dStmt->execute([$rawKey, $rawKey]);
            $dOrder = $dStmt->fetch(PDO::FETCH_ASSOC);

            if (!$dOrder) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Response::error("Dyeing Order not found", 404);
                return;
            }

            $dyeingOrderId = (int)$dOrder['id'];

            $poId = (int)($dOrder['production_order_id'] ?? 0);
            if ($poId <= 0) {
                $rawPo = trim((string)($data['production_order_id'] ?? $data['order_number'] ?? ''));
                if (is_numeric($rawPo)) {
                    $poId = (int)$rawPo;
                } elseif (!empty($rawPo)) {
                    $pLookup = $pdo->prepare("SELECT id FROM production_orders WHERE order_number = ? OR id = ? LIMIT 1");
                    $pLookup->execute([$rawPo, $rawPo]);
                    $poId = (int)$pLookup->fetchColumn();
                }
            }
            // Calculate batch total received quantity
            $totalBatchReceived = 0.0;

            foreach ($items as &$chkIt) {
                $rQty = (float)($chkIt['received_quantity'] ?? 0);
                if ($rQty < 0) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    Response::error("Received quantity cannot be negative", 422);
                    return;
                }
                $chkIt['received_quantity'] = $rQty;
                $chkIt['accepted_quantity'] = 0.00;
                $chkIt['rework_quantity'] = 0.00;
                $totalBatchReceived += $rQty;
            }
            unset($chkIt);

            if ($totalBatchReceived <= 0) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Response::error("At least one color item must have a received quantity greater than zero", 422);
                return;
            }

            $receiptNo = 'DYE-GRN-' . str_pad((string)rand(100, 99999), 5, '0', STR_PAD_LEFT);
            $receiptDate = !empty($data['receipt_date']) ? $data['receipt_date'] : date('Y-m-d');
            $challanNo = trim($data['delivery_challan_no'] ?? $data['challan_no'] ?? '');
            $receivedBy = trim($data['received_by'] ?? 'Stores & QC Inward');
            $photoUrl = $data['photo_url'] ?? null;
            $shadeCondition = trim($data['shade_condition'] ?? 'Approved - Pantone Matched');
            $remarks = trim($data['remarks'] ?? 'Received dyed fabric from processing mill');

            // Insert dyeing receipt record with pending inspection status
            $recStmt = $pdo->prepare("
                INSERT INTO dyeing_receipts (
                    receipt_no, dyeing_order_id, production_order_id, receipt_date, 
                    delivery_challan_no, received_by, total_received_quantity, 
                    total_accepted_quantity, total_rework_quantity,
                    photo_url, shade_condition, remarks, items_data, inspection_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?, ?, ?, ?, 'Pending Inspection')
            ");
            $recStmt->execute([
                $receiptNo,
                $dyeingOrderId,
                $poId,
                $receiptDate,
                $challanNo,
                $receivedBy,
                $totalBatchReceived,
                $photoUrl,
                $shadeCondition,
                $remarks,
                json_encode($items)
            ]);
            $receiptId = (int)$pdo->lastInsertId();

            $itemUpd = $pdo->prepare("
                UPDATE dyeing_order_items 
                SET received_quantity = received_quantity + ?,
                    shrinkage_loss_percent = ?,
                    shade_match_status = ?
                WHERE id = ? AND dyeing_order_id = ?
            ");

            foreach ($items as $it) {
                $itemId = (int)($it['item_id'] ?? $it['id'] ?? 0);
                $qtyRec = (float)($it['received_quantity'] ?? 0);
                $shrinkage = (float)($it['shrinkage_loss_percent'] ?? 0);
                $shade = trim($it['shade_match_status'] ?? 'Approved - Pantone Matched');
                $colorName = trim($it['color_name'] ?? ($dOrder['fabric_name'] ?? 'Dyed Fabric Material'));

                if ($qtyRec > 0) {
                    if ($itemId > 0) {
                        $itemUpd->execute([$qtyRec, $shrinkage, $shade, $itemId, $dyeingOrderId]);
                    } else {
                        $insItem = $pdo->prepare("
                            INSERT INTO dyeing_order_items (
                                dyeing_order_id, color_name, planned_quantity, received_quantity,
                                shrinkage_loss_percent, shade_match_status, notes
                            ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        ");
                        $insItem->execute([
                            $dyeingOrderId,
                            $colorName,
                            (float)($it['planned_quantity'] ?? $qtyRec),
                            $qtyRec,
                            $shrinkage,
                            $shade,
                            $it['notes'] ?? ''
                        ]);
                    }

                    // Ledger log for physical fabric received inward
                    if ($poId > 0) {
                        try {
                            $lStmt = $pdo->prepare("
                                INSERT INTO production_quantity_ledger 
                                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                                VALUES (?, ?, 4, 'DYE', 'RECEIVED_INWARD', ?, ?, ?, ?, 'Dyeing Receipt', ?, ?)
                            ");
                            $lStmt->execute([
                                $poId,
                                $itemId,
                                $qtyRec,
                                $dOrder['dyeing_order_no'],
                                $receivedBy,
                                '',
                                $receiptNo,
                                "Dyed fabric physically received ({$colorName}) from {$dOrder['dyeing_mill_name']}; pending quality inspection"
                            ]);
                        } catch (Exception $lex) {}
                    }
                }
            }

            // Recompute total physical received for entire dyeing order
            $sumStmt = $pdo->prepare("SELECT COALESCE(SUM(received_quantity), 0) FROM dyeing_order_items WHERE dyeing_order_id = ?");
            $sumStmt->execute([$dyeingOrderId]);
            $newTotalReceived = (float)$sumStmt->fetchColumn();

            $totalPlanned = (float)$dOrder['total_fabric_quantity'];
            $newStatus = ($newTotalReceived >= ($totalPlanned - 0.01)) ? 'Received' : 'Partially Received';

            $pdo->prepare("
                UPDATE dyeing_orders 
                SET total_received_quantity = ?, 
                    status = ?
                WHERE id = ?
            ")->execute([$newTotalReceived, $newStatus, $dyeingOrderId]);

            if ($pdo->inTransaction()) {
                $pdo->commit();
            }

            AuditLogger::log('DyeingReceipts', 'RECEIVE', $receiptId, null, [
                'receipt_no' => $receiptNo,
                'dyeing_order_id' => $dyeingOrderId,
                'quantity_received' => $totalBatchReceived,
                'status' => $newStatus
            ]);

            Response::success([
                'receipt_no' => $receiptNo,
                'dyeing_order_id' => $dyeingOrderId,
                'quantity_received' => $totalBatchReceived,
                'total_accepted_quantity' => 0.00,
                'inspection_status' => 'Pending Inspection',
                'dyeing_status' => $newStatus
            ], "Dyed fabric inward received successfully. Available for quality inspection.");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * Handover / transfer dyed fabric to Stage 05 (Cutting)
     */
    public function transferToCutting(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureTables($pdo);

            $pId = (int)($data['production_order_id'] ?? 0);
            $receiptId = (int)($data['receipt_id'] ?? 0);
            $qty = (float)($data['quantity'] ?? 0);
            $transferredBy = trim($data['transferred_by'] ?? 'Dyeing Dept / Stores Inward');
            $notes = trim($data['notes'] ?? 'Dyed fabric dispatched to Stage 05 Cutting store');

            if ($pId <= 0) {
                Response::error("Valid production_order_id is required", 422);
                return;
            }

            // Record in quantity ledger
            try {
                $lStmt = $pdo->prepare("
                    INSERT INTO production_quantity_ledger 
                    (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                    VALUES (?, 0, 4, 'DYE', 'TRANSFERRED_TO_CUTTING', ?, 'HANDOVER', ?, ?, 'Dyeing Handover', ?, ?)
                ");
                $lStmt->execute([
                    $pId,
                    $qty,
                    $transferredBy,
                    $transferredBy,
                    $receiptId > 0 ? (string)$receiptId : 'STAGE-04-HANDOVER',
                    $notes
                ]);
            } catch (Exception $lex) {}

            // Advance current_stage_id on production order items if currently at dyeing (stage 4)
            try {
                $pdo->prepare("
                    UPDATE production_order_items 
                    SET current_stage_id = 5 
                    WHERE production_order_id = ? AND current_stage_id <= 4
                ")->execute([$pId]);
            } catch (Exception $uex) {}

            Response::success([
                'production_order_id' => $pId,
                'quantity' => $qty,
                'status' => 'Transferred to Cutting'
            ], "Dyed fabric successfully transferred to Stage 05 Cutting");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}

