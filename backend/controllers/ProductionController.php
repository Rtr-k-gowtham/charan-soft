<?php
// backend/controllers/ProductionController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class ProductionController {
    public function stages(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM production_stages WHERE status = 'active' ORDER BY sequence_order ASC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function index(): void {
        try {
            $pdo = Database::getConnection();
            try {
                $stmt = $pdo->query("
                    SELECT po.*, c.name as category_name, cu.name as customer_name, cu.code as customer_code,
                           cu.avatar_style as customer_avatar_style, cu.avatar_seed as customer_avatar_seed, cu.avatar_config as customer_avatar_config
                    FROM production_orders po
                    JOIN categories c ON po.category_id = c.id
                    LEFT JOIN customers cu ON po.customer_id = cu.id
                    WHERE po.deleted_at IS NULL
                    ORDER BY po.id DESC
                ");
            } catch (Exception $colEx) {
                $stmt = $pdo->query("
                    SELECT po.*, c.name as category_name, cu.name as customer_name
                    FROM production_orders po
                    JOIN categories c ON po.category_id = c.id
                    LEFT JOIN customers cu ON po.customer_id = cu.id
                    WHERE po.deleted_at IS NULL
                    ORDER BY po.id DESC
                ");
            }
            $orders = $stmt->fetchAll();

            foreach ($orders as &$ord) {
                $iStmt = $pdo->prepare("
                    SELECT poi.*, 
                           COALESCE(bp.product_name, p.name) as product_name, 
                           COALESCE(bp.product_code, p.code) as product_code, 
                           ps.name as current_stage_name, ps.color_badge, ps.sequence_order as stage_sequence,
                           col.pantone_code as color_pantone_code, col.hex_code as color_hex_code
                    FROM production_order_items poi
                    LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                    LEFT JOIN products p ON poi.product_id = p.id
                    JOIN production_stages ps ON poi.current_stage_id = ps.id
                    LEFT JOIN colors col ON (poi.color = col.name OR poi.color = col.code OR poi.color = col.pantone_code)
                    WHERE poi.production_order_id = ?
                    ORDER BY poi.id ASC
                ");
                $iStmt->execute([$ord['id']]);
                $ord['items'] = $iStmt->fetchAll();
            }

            Response::success($orders);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function show(int $id): void {
        try {
            $pdo = Database::getConnection();
            try {
                $stmt = $pdo->prepare("
                    SELECT po.*, c.name as category_name, cu.name as customer_name, cu.code as customer_code,
                           cu.avatar_style as customer_avatar_style, cu.avatar_seed as customer_avatar_seed, cu.avatar_config as customer_avatar_config
                    FROM production_orders po
                    JOIN categories c ON po.category_id = c.id
                    LEFT JOIN customers cu ON po.customer_id = cu.id
                    WHERE po.id = ? AND po.deleted_at IS NULL
                ");
            } catch (Exception $colEx) {
                $stmt = $pdo->prepare("
                    SELECT po.*, c.name as category_name, cu.name as customer_name
                    FROM production_orders po
                    JOIN categories c ON po.category_id = c.id
                    LEFT JOIN customers cu ON po.customer_id = cu.id
                    WHERE po.id = ? AND po.deleted_at IS NULL
                ");
            }
            $stmt->execute([$id]);
            $order = $stmt->fetch();

            if (!$order) {
                Response::error("Production order not found", 404);
                return;
            }

            $iStmt = $pdo->prepare("
                SELECT poi.*, 
                       COALESCE(bp.product_name, p.name) as product_name, 
                       COALESCE(bp.product_code, p.code) as product_code, 
                       ps.name as current_stage_name, ps.color_badge, ps.sequence_order as stage_sequence,
                       col.pantone_code as color_pantone_code, col.hex_code as color_hex_code
                FROM production_order_items poi
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                LEFT JOIN products p ON poi.product_id = p.id
                JOIN production_stages ps ON poi.current_stage_id = ps.id
                LEFT JOIN colors col ON (poi.color = col.name OR poi.color = col.code OR poi.color = col.pantone_code)
                WHERE poi.production_order_id = ?
                ORDER BY poi.id ASC
            ");
            $iStmt->execute([$id]);
            $order['items'] = $iStmt->fetchAll();

            Response::success($order);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function store(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $categoryId = (int)($data['category_id'] ?? 0);
        $customerId = !empty($data['customer_id']) ? (int)$data['customer_id'] : 0;
        $title = trim($data['title'] ?? '');
        $items = $data['items'] ?? [];

        if (empty($title)) {
            Response::error("Order title is required", 422);
            return;
        }

        if (empty($items) || !is_array($items)) {
            Response::error("At least one product line is required", 422);
            return;
        }

        if (!$customerId) {
            Response::error("A valid Buyer is required for production order creation", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();

            // Validate that selected buyer exists
            $cCheck = $pdo->prepare("SELECT id, name FROM customers WHERE id = ?");
            $cCheck->execute([$customerId]);
            $customerRow = $cCheck->fetch();
            if (!$customerRow) {
                Response::error("Selected buyer does not exist", 422);
                return;
            }

            // Validate that every product belongs to the selected buyer in buyer_products
            $bpCheck = $pdo->prepare("SELECT id, product_name FROM buyer_products WHERE id = ? AND buyer_id = ?");
            foreach ($items as $idx => $it) {
                $lineNo = $idx + 1;
                $pId = (int)($it['product_id'] ?? 0);
                if (!$pId) {
                    Response::error("Line #{$lineNo}: Product is required", 422);
                    return;
                }

                $bpCheck->execute([$pId, $customerId]);
                $bpRow = $bpCheck->fetch();
                if (!$bpRow) {
                    Response::error("Line #{$lineNo}: Product does not belong to the selected buyer", 422);
                    return;
                }

                if (empty(trim((string)($it['color'] ?? '')))) {
                    Response::error("Line #{$lineNo}: Color is required", 422);
                    return;
                }

                $q = (int)($it['total_quantity'] ?? $it['qty'] ?? 0);
                if ($q <= 0) {
                    Response::error("Line #{$lineNo}: Quantity must be greater than zero", 422);
                    return;
                }
            }

            $pdo->beginTransaction();

            // Derive category if not provided
            if (!$categoryId) {
                $cRow = $pdo->query("SELECT id FROM categories WHERE type = 'product' OR type = 'order' ORDER BY id ASC LIMIT 1")->fetch();
                $categoryId = $cRow ? (int)$cRow['id'] : 1;
            }

            // First stage in pipeline
            $stgStmt = $pdo->query("SELECT id FROM production_stages WHERE status = 'active' ORDER BY sequence_order ASC, id ASC LIMIT 1");
            $firstStageId = (int)($stgStmt ? $stgStmt->fetchColumn() : 0);
            if ($firstStageId <= 0) {
                $stgFallback = $pdo->query("SELECT id FROM production_stages ORDER BY sequence_order ASC, id ASC LIMIT 1");
                $firstStageId = (int)($stgFallback ? $stgFallback->fetchColumn() : 0);
            }

            // Auto-heal: If production_stages table has no rows, seed standard stages
            if ($firstStageId <= 0) {
                try {
                    // Detect available columns in production_stages to avoid missing-column SQL errors
                    $colStmt = $pdo->query("SHOW COLUMNS FROM production_stages");
                    $existingCols = $colStmt ? $colStmt->fetchAll(PDO::FETCH_COLUMN) : [];
                    $hasDesc = in_array('description', $existingCols);
                    $hasColor = in_array('color_badge', $existingCols);
                    $hasQc = in_array('is_qc_stage', $existingCols);
                    $hasFinal = in_array('is_final_stage', $existingCols);

                    $cols = ['id', 'code', 'name', 'sequence_order', 'status'];
                    if ($hasColor) $cols[] = 'color_badge';
                    if ($hasDesc) $cols[] = 'description';
                    if ($hasQc) $cols[] = 'is_qc_stage';
                    if ($hasFinal) $cols[] = 'is_final_stage';

                    $colList = implode(', ', array_map(fn($c) => "`$c`", $cols));
                    
                    $stagesData = [
                        [1, 'REQ', 'Requirement Gathering', 1, 'Production Requirement created for the product.', '#6366f1', 0, 0],
                        [2, 'PO', 'Purchase Order (PO)', 2, 'Purchase order creation and tracking.', '#0284c7', 0, 0],
                        [3, 'INW', 'Inward', 3, 'Receive materials or products into inventory.', '#0d9488', 0, 0],
                        [4, 'DYE', 'Dyeing', 4, 'Send material for dyeing and track color-wise processing.', '#7c3aed', 0, 0],
                        [5, 'CUT', 'Cutting — Product-wise', 5, 'Track cutting quantities separately for each product and size.', '#d97706', 0, 0],
                        [6, 'EMB', 'Embroidery — Outward / Inward', 6, 'Track material sent to the embroidery unit and the quantity received back.', '#ec4899', 0, 0],
                        [7, 'STI', 'Stitching — Color-wise Tracking', 7, 'Track stitching progress by product, color, size and quantity.', '#2563eb', 0, 0],
                        [8, 'CHK', 'Checking', 8, 'Quality inspection, defect recording and approval.', '#ef4444', 1, 0],
                        [9, 'PCK', 'Packing', 9, 'Pack approved products and track packed quantities.', '#059669', 0, 0],
                        [10, 'COMP', 'Completed', 10, 'Production order completed with final quantities recorded.', '#16a34a', 0, 1]
                    ];

                    foreach ($stagesData as $s) {
                        $vals = [$s[0], $s[1], $s[2], $s[3], 'active'];
                        if ($hasColor) $vals[] = $s[5];
                        if ($hasDesc) $vals[] = $s[4];
                        if ($hasQc) $vals[] = $s[6];
                        if ($hasFinal) $vals[] = $s[7];

                        $placeholders = implode(', ', array_fill(0, count($vals), '?'));
                        $insStmt = $pdo->prepare("INSERT INTO production_stages ($colList) VALUES ($placeholders) ON DUPLICATE KEY UPDATE status = 'active'");
                        $insStmt->execute($vals);
                    }

                    $stgStmt = $pdo->query("SELECT id FROM production_stages ORDER BY sequence_order ASC, id ASC LIMIT 1");
                    $firstStageId = (int)($stgStmt ? $stgStmt->fetchColumn() : 1);
                } catch (Exception $seedEx) {
                    $firstStageId = 1;
                }
            }

            $orderNo = 'ORD-' . rand(1000, 9999);
            $totalQty = 0;
            foreach ($items as $it) {
                $totalQty += (int)($it['total_quantity'] ?? $it['qty'] ?? 0);
            }

            $stmt = $pdo->prepare("
                INSERT INTO production_orders (order_number, category_id, customer_id, title, priority, start_date, target_delivery_date, total_quantity, completed_quantity, status, notes)
                VALUES (:ord_no, :cat_id, :cust_id, :title, :prio, :sdate, :tdate, :tqty, 0, 'IN PRODUCTION', :notes)
            ");
            $stmt->execute([
                ':ord_no' => $orderNo,
                ':cat_id' => $categoryId,
                ':cust_id' => $customerId,
                ':title' => $title,
                ':prio' => $data['priority'] ?? 'Medium',
                ':sdate' => $data['start_date'] ?? date('Y-m-d'),
                ':tdate' => $data['target_delivery_date'] ?? date('Y-m-d', strtotime('+20 days')),
                ':tqty' => $totalQty,
                ':notes' => $data['notes'] ?? null
            ]);
            $orderId = (int)$pdo->lastInsertId();

            // Insert items without Size column
            $itemStmt = $pdo->prepare("
                INSERT INTO production_order_items (production_order_id, product_id, color, total_quantity, current_stage_id, current_stage_quantity, completed_quantity, status)
                VALUES (?, ?, ?, ?, ?, ?, 0, 'In Progress')
            ");

            foreach ($items as $it) {
                $q = (int)($it['total_quantity'] ?? $it['qty'] ?? 0);
                $itemStmt->execute([
                    $orderId,
                    (int)$it['product_id'],
                    trim((string)($it['color'] ?? 'White')),
                    $q,
                    $firstStageId,
                    $q
                ]);
            }

            $pdo->commit();
            AuditLogger::log('ProductionOrders', 'CREATE', $orderId, null, ['order_number' => $orderNo, 'customer_id' => $customerId, 'total_qty' => $totalQty]);
            Response::success(['id' => $orderId, 'order_number' => $orderNo], "Production order created successfully", 201);
        } catch (Exception $e) {
            if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function moveStage(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $orderItemId = (int)($data['order_item_id'] ?? $data['item_id'] ?? 0);
        $toStageId = (int)($data['to_stage_id'] ?? $data['next_stage_id'] ?? 0);
        $moveQty = (int)($data['quantity_moved'] ?? $data['quantity'] ?? 0);
        $remarks = trim($data['remarks'] ?? $data['notes'] ?? '');

        if (!$orderItemId || !$toStageId || $moveQty <= 0) {
            Response::error("Order item, destination stage, and positive move quantity are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("SELECT * FROM production_order_items WHERE id = ? FOR UPDATE");
            $stmt->execute([$orderItemId]);
            $item = $stmt->fetch();

            if (!$item) {
                Response::error("Production order item not found", 404);
                return;
            }

            $currentStageId = (int)$item['current_stage_id'];
            $currentQty = (int)$item['current_stage_quantity'];

            if ($moveQty > $currentQty) {
                Response::error("Move quantity ({$moveQty}) cannot exceed current stage quantity ({$currentQty})", 422);
                return;
            }

            // Log stage transaction
            $tStmt = $pdo->prepare("
                INSERT INTO production_stage_transactions (production_order_item_id, from_stage_id, to_stage_id, quantity_moved, remarks)
                VALUES (?, ?, ?, ?, ?)
            ");
            $tStmt->execute([$orderItemId, $currentStageId, $toStageId, $moveQty, $remarks]);

            // Check if toStage is final "Completed"
            $destStageStmt = $pdo->prepare("SELECT is_final_stage FROM production_stages WHERE id = ?");
            $destStageStmt->execute([$toStageId]);
            $isFinal = (bool)$destStageStmt->fetchColumn();

            $remainingAtCurrent = $currentQty - $moveQty;
            $newCompleted = (int)$item['completed_quantity'] + ($isFinal ? $moveQty : 0);

            // Update item record: if full batch moved, advance stage. If partial, update stage and quantities!
            if ($remainingAtCurrent == 0) {
                $upd = $pdo->prepare("
                    UPDATE production_order_items 
                    SET current_stage_id = ?, current_stage_quantity = ?, completed_quantity = ?, status = ?
                    WHERE id = ?
                ");
                $status = $isFinal ? 'Completed' : 'In Progress';
                $upd->execute([$toStageId, $moveQty, $newCompleted, $status, $orderItemId]);
            } else {
                // Partial quantity advance
                $upd = $pdo->prepare("
                    UPDATE production_order_items 
                    SET current_stage_quantity = ?, completed_quantity = ?
                    WHERE id = ?
                ");
                $upd->execute([$remainingAtCurrent, $newCompleted, $orderItemId]);
            }

            // Update parent order total completed quantity if final
            if ($isFinal) {
                $pordStmt = $pdo->prepare("UPDATE production_orders SET completed_quantity = completed_quantity + ? WHERE id = ?");
                $pordStmt->execute([$moveQty, $item['production_order_id']]);
            }

            $pdo->commit();
            AuditLogger::log('ProductionStages', 'MOVE', $orderItemId, ['from' => $currentStageId], ['to' => $toStageId, 'qty' => $moveQty]);
            Response::success([
                'moved_quantity' => $moveQty,
                'remaining_quantity' => $remainingAtCurrent,
                'is_completed' => $isFinal
            ], "Stage movement recorded successfully");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function recordQC(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $orderItemId = (int)($data['order_item_id'] ?? $data['item_id'] ?? 0);
        $stageId = (int)($data['stage_id'] ?? 6);
        $passedQty = (int)($data['passed_quantity'] ?? $data['passed'] ?? 0);
        $rejectedQty = (int)($data['rejected_quantity'] ?? $data['rejected'] ?? 0);
        $reworkQty = (int)($data['rework_quantity'] ?? $data['rework'] ?? 0);
        $remarks = trim($data['remarks'] ?? '');
        $reworkStageId = (int)($data['rework_stage_id'] ?? 7); // Default rework goes to stage 7 (Rework)
        $inputQty = (int)($data['input_quantity'] ?? ($passedQty + $rejectedQty + $reworkQty));

        if ($inputQty <= 0) {
            Response::error("QC input quantity must be greater than zero", 422);
            return;
        }

        $sum = $passedQty + $rejectedQty + $reworkQty;
        if ($sum > $inputQty) {
            Response::error("Sum of Passed ({$passedQty}) + Rejected ({$rejectedQty}) + Rework ({$reworkQty}) cannot exceed Input ({$inputQty})", 422);
            return;
        }
        $pendingQty = $inputQty - $sum;

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $qcStmt = $pdo->prepare("
                INSERT INTO qc_records (production_order_item_id, stage_id, input_quantity, passed_quantity, rejected_quantity, rework_quantity, pending_quantity, defect_reason, remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $qcStmt->execute([
                $orderItemId,
                $stageId,
                $inputQty,
                $passedQty,
                $rejectedQty,
                $reworkQty,
                $pendingQty,
                $data['defect_reason'] ?? 'Visual & measurement audit',
                $remarks
            ]);
            $qcId = (int)$pdo->lastInsertId();

            // If rework quantity > 0, route item to rework stage
            if ($reworkQty > 0) {
                $rwkStmt = $pdo->prepare("
                    INSERT INTO rework_records (qc_record_id, production_order_item_id, rework_stage_id, quantity, status, resolution_notes)
                    VALUES (?, ?, ?, ?, 'IN REWORK', ?)
                ");
                $rwkStmt->execute([$qcId, $orderItemId, $reworkStageId, $reworkQty, $remarks]);

                $updItem = $pdo->prepare("
                    UPDATE production_order_items 
                    SET current_stage_id = ?, current_stage_quantity = ?, rejected_quantity = rejected_quantity + ?, rework_quantity = rework_quantity + ?, status = 'In Rework'
                    WHERE id = ?
                ");
                $updItem->execute([$reworkStageId, $reworkQty, $rejectedQty, $reworkQty, $orderItemId]);
            } else if ($passedQty > 0) {
                // Passed: advance to final stage (Stage 8 Completed)
                $finalStageStmt = $pdo->query("SELECT id FROM production_stages WHERE is_final_stage = 1 LIMIT 1");
                $finalStageId = (int)($finalStageStmt->fetchColumn() ?: 8);

                $updItem = $pdo->prepare("
                    UPDATE production_order_items 
                    SET current_stage_id = ?, current_stage_quantity = ?, completed_quantity = completed_quantity + ?, rejected_quantity = rejected_quantity + ?, status = 'Completed'
                    WHERE id = ?
                ");
                $updItem->execute([$finalStageId, $passedQty, $passedQty, $rejectedQty, $orderItemId]);

                // Update parent production order completed_quantity
                $orderItemStmt = $pdo->prepare("SELECT production_order_id FROM production_order_items WHERE id = ?");
                $orderItemStmt->execute([$orderItemId]);
                $pOrderId = (int)$orderItemStmt->fetchColumn();
                if ($pOrderId) {
                    $pdo->prepare("UPDATE production_orders SET completed_quantity = completed_quantity + ? WHERE id = ?")->execute([$passedQty, $pOrderId]);
                }
            } else {
                // Rejected only
                $updItem = $pdo->prepare("
                    UPDATE production_order_items 
                    SET rejected_quantity = rejected_quantity + ?, current_stage_quantity = GREATEST(0, current_stage_quantity - ?)
                    WHERE id = ?
                ");
                $updItem->execute([$rejectedQty, $rejectedQty, $orderItemId]);
            }

            $pdo->commit();
            AuditLogger::log('QC', 'INSPECT', $orderItemId, null, ['passed' => $passedQty, 'rejected' => $rejectedQty, 'rework' => $reworkQty]);
            Response::success([
                'qc_id' => $qcId,
                'passed' => $passedQty,
                'rejected' => $rejectedQty,
                'rework' => $reworkQty,
                'pending' => $pendingQty
            ], "QC record and rework route saved successfully");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function stageOrders(string $code): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                SELECT poi.*, po.order_number, po.title as order_title, po.priority, po.target_delivery_date,
                       COALESCE(bp.product_name, p.name) as product_name, 
                       COALESCE(bp.product_code, p.code) as product_code, 
                       ps.name as stage_name, ps.code as stage_code
                FROM production_order_items poi
                JOIN production_orders po ON poi.production_order_id = po.id
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                LEFT JOIN products p ON poi.product_id = p.id
                JOIN production_stages ps ON poi.current_stage_id = ps.id
                WHERE UPPER(ps.code) = UPPER(?) AND po.deleted_at IS NULL
                ORDER BY poi.id DESC
            ");
            $stmt->execute([$code]);
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function reworkList(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("
                SELECT rw.*, poi.color, po.order_number, 
                       COALESCE(bp.product_name, p.name) as product_name, 
                       ps.name as target_stage_name
                FROM rework_records rw
                JOIN production_order_items poi ON rw.production_order_item_id = poi.id
                JOIN production_orders po ON poi.production_order_id = po.id
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                LEFT JOIN products p ON poi.product_id = p.id
                LEFT JOIN production_stages ps ON rw.rework_stage_id = ps.id
                ORDER BY rw.id DESC
            ");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function qcList(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("
                SELECT qc.*, ps.name as stage_name, u.name as inspector_name, poi.color, 
                       COALESCE(bp.product_name, p.name) as product_name, po.order_number
                FROM qc_records qc
                LEFT JOIN production_stages ps ON qc.stage_id = ps.id
                LEFT JOIN users u ON qc.inspector_user_id = u.id
                LEFT JOIN production_order_items poi ON qc.production_order_item_id = poi.id
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                LEFT JOIN products p ON poi.product_id = p.id
                LEFT JOIN production_orders po ON poi.production_order_id = po.id
                ORDER BY qc.id DESC LIMIT 100
            ");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    public function materialRequirements(int $orderId): void {
        try {
            $pdo = Database::getConnection();

            // 1. Fetch Order Details
            $stmt = $pdo->prepare("
                SELECT po.*, c.name as category_name, cu.name as customer_name, cu.code as customer_code,
                       cu.avatar_style as customer_avatar_style, cu.avatar_seed as customer_avatar_seed, cu.avatar_config as customer_avatar_config
                FROM production_orders po
                JOIN categories c ON po.category_id = c.id
                LEFT JOIN customers cu ON po.customer_id = cu.id
                WHERE po.id = ? AND po.deleted_at IS NULL
            ");
            $stmt->execute([$orderId]);
            $order = $stmt->fetch();
            if (!$order) {
                Response::error("Production order not found", 404);
                return;
            }

            // 2. Fetch Order Items
            $iStmt = $pdo->prepare("
                SELECT poi.*, 
                       COALESCE(bp.product_name, p.name) as product_name, 
                       COALESCE(bp.product_code, p.code) as product_code,
                       bp.buyer_id
                FROM production_order_items poi
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                LEFT JOIN products p ON poi.product_id = p.id
                WHERE poi.production_order_id = ?
                ORDER BY poi.id ASC
            ");
            $iStmt->execute([$orderId]);
            $items = $iStmt->fetchAll();

            $materialsMap = [];
            $productsBreakdown = [];
            $totalGarments = 0;

            foreach ($items as $item) {
                $pId = (int)$item['product_id'];
                $itemQty = (int)($item['total_quantity'] ?? 0);
                $totalGarments += $itemQty;

                // Load BOM components from buyer_product_components (configured in /masters/buyers/:id/products)
                $compStmt = $pdo->prepare("
                    SELECT bpc.*, m.code as material_code, m.purchase_rate, m.current_stock, m.uom as material_uom
                    FROM buyer_product_components bpc
                    LEFT JOIN materials m ON bpc.material_id = m.id
                    WHERE bpc.buyer_product_id = ?
                    ORDER BY bpc.id ASC
                ");
                $compStmt->execute([$pId]);
                $comps = $compStmt->fetchAll();

                // Fallback to bom_items if buyer_product_components empty
                if (empty($comps)) {
                    try {
                        $fallbackStmt = $pdo->prepare("
                            SELECT bi.*, m.name as name, m.code as material_code, m.uom as uom, 
                                   m.purchase_rate, m.current_stock, bi.quantity_required as quantity_per_product,
                                   bi.wastage_percent, 'Fabric' as category
                            FROM bom_items bi
                            JOIN boms b ON bi.bom_id = b.id
                            LEFT JOIN materials m ON bi.material_id = m.id
                            WHERE b.product_id = ?
                        ");
                        $fallbackStmt->execute([$pId]);
                        $comps = $fallbackStmt->fetchAll();
                    } catch (Exception $fbEx) {
                        $comps = [];
                    }
                }

                $productLineComps = [];
                foreach ($comps as $c) {
                    $matId = !empty($c['material_id']) ? (int)$c['material_id'] : null;
                    $matName = trim((string)($c['name'] ?? ''));
                    $category = trim((string)($c['category'] ?? 'Raw Material'));
                    $uom = trim((string)($c['uom'] ?? $c['material_uom'] ?? 'Units'));
                    $perPiece = (float)($c['quantity_per_product'] ?? 0);
                    $wastage = (float)($c['wastage_percent'] ?? 0);
                    $rate = (float)($c['purchase_rate'] ?? 0);
                    $stock = isset($c['current_stock']) ? (float)$c['current_stock'] : 0.0;
                    $matCode = $c['material_code'] ?? null;

                    // Required quantity with wastage percentage calculation
                    $lineRequired = round($itemQty * $perPiece * (1 + ($wastage / 100)), 3);
                    $productLineComps[] = [
                        'material_id' => $matId,
                        'material_code' => $matCode,
                        'name' => $matName,
                        'category' => $category,
                        'uom' => $uom,
                        'quantity_per_product' => $perPiece,
                        'wastage_percent' => $wastage,
                        'required_quantity' => $lineRequired,
                    ];

                    // Aggregation key
                    $aggKey = $matId ? "id_{$matId}" : "name_" . strtolower($matName . '_' . $uom);
                    if (!isset($materialsMap[$aggKey])) {
                        $materialsMap[$aggKey] = [
                            'material_id' => $matId,
                            'material_code' => $matCode,
                            'name' => $matName,
                            'category' => $category,
                            'uom' => $uom,
                            'unit_cost' => $rate,
                            'current_stock' => $stock,
                            'total_required_qty' => 0.0,
                            'per_product_contributions' => [],
                        ];
                    }

                    $materialsMap[$aggKey]['total_required_qty'] += $lineRequired;
                    $materialsMap[$aggKey]['per_product_contributions'][] = [
                        'product_id' => $pId,
                        'product_name' => $item['product_name'],
                        'product_code' => $item['product_code'],
                        'color' => $item['color'],
                        'garment_qty' => $itemQty,
                        'per_piece_qty' => $perPiece,
                        'wastage_percent' => $wastage,
                        'required_qty' => $lineRequired,
                    ];
                }

                $productsBreakdown[] = [
                    'item_id' => (int)$item['id'],
                    'product_id' => $pId,
                    'product_name' => $item['product_name'],
                    'product_code' => $item['product_code'],
                    'color' => $item['color'],
                    'size' => $item['size'] ?? null,
                    'total_quantity' => $itemQty,
                    'components' => $productLineComps,
                ];
            }

            // Calculate Stock, Shortage, and Status for each aggregated material
            $totalMaterialsList = [];
            $totalEstimatedCost = 0.0;
            $inStockCount = 0;
            $shortageCount = 0;

            foreach ($materialsMap as $m) {
                $req = round($m['total_required_qty'], 3);
                $stk = round($m['current_stock'], 3);
                $shortage = max(0.0, round($req - $stk, 3));
                $cost = round($req * $m['unit_cost'], 2);
                $totalEstimatedCost += $cost;

                $status = 'In Stock';
                if ($shortage > 0) {
                    $status = ($stk > 0) ? 'Partial Stock' : 'Needs Procurement';
                    $shortageCount++;
                } else {
                    $inStockCount++;
                }

                $totalMaterialsList[] = [
                    'material_id' => $m['material_id'],
                    'material_code' => $m['material_code'],
                    'name' => $m['name'],
                    'category' => $m['category'],
                    'uom' => $m['uom'],
                    'total_required_qty' => $req,
                    'current_stock' => $stk,
                    'shortage_qty' => $shortage,
                    'unit_cost' => $m['unit_cost'],
                    'total_estimated_cost' => $cost,
                    'status' => $status,
                    'product_contributions' => $m['per_product_contributions'],
                ];
            }

            // Sort materials by category then name
            usort($totalMaterialsList, function($a, $b) {
                $cmp = strcmp($a['category'], $b['category']);
                return ($cmp !== 0) ? $cmp : strcmp($a['name'], $b['name']);
            });

            Response::success([
                'order' => $order,
                'products' => $productsBreakdown,
                'total_materials' => $totalMaterialsList,
                'summary' => [
                    'total_products_count' => count($productsBreakdown),
                    'total_order_garments' => $totalGarments,
                    'total_distinct_materials' => count($totalMaterialsList),
                    'in_stock_count' => $inStockCount,
                    'shortage_count' => $shortageCount,
                    'total_estimated_cost' => round($totalEstimatedCost, 2),
                ],
                'generated_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}

