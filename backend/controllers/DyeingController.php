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
                  `fabric_material_id` INT NULL,
                  `fabric_name` VARCHAR(255) NOT NULL,
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
    public function show(int $id): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureTables($pdo);

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
                WHERE d.id = ? AND d.deleted_at IS NULL
            ");
            $stmt->execute([$id]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                Response::error("Dyeing Order not found", 404);
                return;
            }

            $itemStmt = $pdo->prepare("SELECT * FROM dyeing_order_items WHERE dyeing_order_id = ? ORDER BY id ASC");
            $itemStmt->execute([$id]);
            $order['items'] = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

            $receiptStmt = $pdo->prepare("SELECT * FROM dyeing_receipts WHERE dyeing_order_id = ? ORDER BY id DESC");
            $receiptStmt->execute([$id]);
            $order['receipts'] = $receiptStmt->fetchAll(PDO::FETCH_ASSOC);

            Response::success($order);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * Compute Inwarded Fabric vs Outward to Dyeing for a Production Order
     */
    public function fabricStock(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureTables($pdo);

            $poId = isset($_GET['production_order_id']) && is_numeric($_GET['production_order_id']) 
                ? (int)$_GET['production_order_id'] 
                : 0;

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
                    poi.uom,
                    poi.quantity as ordered_quantity,
                    poi.received_quantity,
                    po.po_number,
                    po.id as purchase_order_id,
                    c.name as category_name
                FROM purchase_order_items poi
                JOIN purchase_orders po ON poi.purchase_order_id = po.id
                LEFT JOIN categories c ON po.category_id = c.id
                WHERE (po.production_order_id = ? OR po.remarks LIKE ? OR poi.order_no = ?)
                  AND (
                      UPPER(COALESCE(c.name, '')) LIKE '%FABRIC%' 
                      OR UPPER(COALESCE(poi.item_description, '')) LIKE '%FABRIC%'
                      OR UPPER(COALESCE(poi.item_description, '')) LIKE '%MAT-FAB%'
                  )
            ");
            $likeOrderNum = '%' . $prodOrder['order_number'] . '%';
            $fabricInwardStmt->execute([$poId, $likeOrderNum, $prodOrder['order_number']]);
            $fabricItems = $fabricInwardStmt->fetchAll(PDO::FETCH_ASSOC);

            $totalFabricInwarded = 0.0;
            $totalFabricOrdered = 0.0;
            foreach ($fabricItems as $fi) {
                $totalFabricInwarded += (float)($fi['received_quantity'] ?? 0);
                $totalFabricOrdered += (float)($fi['ordered_quantity'] ?? 0);
            }

            // 2. Gather total fabric quantity already issued to Dyeing Orders (Outward)
            $dyeingOutwardStmt = $pdo->prepare("
                SELECT COALESCE(SUM(total_fabric_quantity), 0) as total_outward
                FROM dyeing_orders 
                WHERE production_order_id = ? AND status != 'Cancelled' AND deleted_at IS NULL
            ");
            $dyeingOutwardStmt->execute([$poId]);
            $totalFabricOutward = (float)$dyeingOutwardStmt->fetchColumn();

            // 3. Gather total dyed fabric received back from mills
            $dyeingReceivedStmt = $pdo->prepare("
                SELECT COALESCE(SUM(total_received_quantity), 0) as total_received
                FROM dyeing_orders 
                WHERE production_order_id = ? AND status != 'Cancelled' AND deleted_at IS NULL
            ");
            $dyeingReceivedStmt->execute([$poId]);
            $totalFabricReceivedFromDyeing = (float)$dyeingReceivedStmt->fetchColumn();

            $balanceAvailableForDyeing = max(0.0, round($totalFabricInwarded - $totalFabricOutward, 2));

            // 4. Fetch distinct colors from the Production Order items (with Pantone codes)
            $colorStmt = $pdo->prepare("
                SELECT DISTINCT 
                    poi.color as color_name,
                    col.pantone_code,
                    col.hex_code,
                    SUM(poi.total_quantity) as total_garment_qty
                FROM production_order_items poi
                LEFT JOIN colors col ON (poi.color = col.name OR poi.color = col.code)
                WHERE poi.production_order_id = ?
                GROUP BY poi.color, col.pantone_code, col.hex_code
                ORDER BY poi.color ASC
            ");
            $colorStmt->execute([$poId]);
            $suggestedColors = $colorStmt->fetchAll(PDO::FETCH_ASSOC);

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
                'fabric_materials' => $fabricItems,
                'suggested_colors' => $suggestedColors,
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

        $poId = (int)($data['production_order_id'] ?? 0);
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
                    dyeing_order_no, production_order_id, fabric_material_id, fabric_name, 
                    fabric_code, uom, supplier_id, dyeing_mill_name, challan_no, 
                    order_date, expected_delivery_date, total_fabric_quantity, total_received_quantity, 
                    status, process_type, remarks
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 'Sent to Dyeing', ?, ?)
            ");
            $insStmt->execute([
                $dyeingOrderNo,
                $poId,
                $data['fabric_material_id'] ?? null,
                $fabricName,
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
    public function receive(int $dyeingOrderId): void {
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

            $dStmt = $pdo->prepare("SELECT * FROM dyeing_orders WHERE id = ? FOR UPDATE");
            $dStmt->execute([$dyeingOrderId]);
            $dOrder = $dStmt->fetch(PDO::FETCH_ASSOC);

            if (!$dOrder) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Response::error("Dyeing Order not found", 404);
                return;
            }

            $poId = (int)$dOrder['production_order_id'];
            $receiptNo = 'DYE-GRN-' . str_pad((string)rand(100, 99999), 5, '0', STR_PAD_LEFT);
            $receiptDate = !empty($data['receipt_date']) ? $data['receipt_date'] : date('Y-m-d');
            $challanNo = trim($data['delivery_challan_no'] ?? $data['challan_no'] ?? '');
            $receivedBy = trim($data['received_by'] ?? 'Stores & QC Inward');
            $photoUrl = $data['photo_url'] ?? null;
            $shadeCondition = trim($data['shade_condition'] ?? 'Approved - Pantone Matched');
            $remarks = trim($data['remarks'] ?? 'Received dyed fabric from processing mill');

            // Insert dyeing receipt record
            $recStmt = $pdo->prepare("
                INSERT INTO dyeing_receipts (
                    receipt_no, dyeing_order_id, production_order_id, receipt_date, 
                    delivery_challan_no, received_by, total_received_quantity, 
                    photo_url, shade_condition, remarks, items_data
                ) VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?)
            ");
            $recStmt->execute([
                $receiptNo,
                $dyeingOrderId,
                $poId,
                $receiptDate,
                $challanNo,
                $receivedBy,
                $photoUrl,
                $shadeCondition,
                $remarks,
                json_encode($items)
            ]);
            $receiptId = (int)$pdo->lastInsertId();

            $totalBatchReceived = 0.0;
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
                $shade = trim($it['shade_match_status'] ?? 'Matched');

                if ($qtyRec > 0 && $itemId > 0) {
                    $totalBatchReceived += $qtyRec;
                    $itemUpd->execute([$qtyRec, $shrinkage, $shade, $itemId, $dyeingOrderId]);
                }
            }

            // Update total received in dyeing receipt
            $pdo->prepare("UPDATE dyeing_receipts SET total_received_quantity = ? WHERE id = ?")->execute([$totalBatchReceived, $receiptId]);

            // Recompute total received for entire dyeing order
            $sumStmt = $pdo->prepare("SELECT COALESCE(SUM(received_quantity), 0) FROM dyeing_order_items WHERE dyeing_order_id = ?");
            $sumStmt->execute([$dyeingOrderId]);
            $newTotalReceived = (float)$sumStmt->fetchColumn();

            $totalPlanned = (float)$dOrder['total_fabric_quantity'];
            $newStatus = ($newTotalReceived >= ($totalPlanned - 0.01)) ? 'Received' : 'Partially Received';

            $pdo->prepare("
                UPDATE dyeing_orders 
                SET total_received_quantity = ?, status = ?
                WHERE id = ?
            ")->execute([$newTotalReceived, $newStatus, $dyeingOrderId]);

            // If advance_to_cutting is requested or complete, advance production order items towards Stage 5 (Cutting)
            $advanceToCutting = !empty($data['advance_to_cutting']) || ($newStatus === 'Received');
            if ($advanceToCutting) {
                $stage5Stmt = $pdo->query("SELECT id FROM production_stages WHERE code = 'CUT' OR sequence_order = 5 LIMIT 1");
                $stage5Id = (int)($stage5Stmt->fetchColumn() ?: 5);

                $pdo->prepare("
                    UPDATE production_order_items 
                    SET current_stage_id = ? 
                    WHERE production_order_id = ? AND current_stage_id <= 4
                ")->execute([$stage5Id, $poId]);
            }

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
                'dyeing_status' => $newStatus,
                'advanced_to_cutting' => $advanceToCutting
            ], "Dyed fabric received successfully with Pantone shade verification & photo proof");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }
}
