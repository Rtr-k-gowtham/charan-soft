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
                           ps.name as current_stage_name, ps.code as stage_code, ps.color_badge, ps.sequence_order as stage_sequence,
                           col.pantone_code as color_pantone_code, col.hex_code as color_hex_code
                    FROM production_order_items poi
                    LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                    LEFT JOIN products p ON poi.product_id = p.id
                    JOIN production_stages ps ON poi.current_stage_id = ps.id
                    LEFT JOIN colors col ON (poi.color = col.name OR poi.color = col.code OR poi.color = col.pantone_code)
                    WHERE poi.production_order_id = ? AND (poi.total_quantity > 0 OR poi.current_stage_quantity > 0)
                    ORDER BY poi.id ASC
                ");
                $iStmt->execute([$ord['id']]);
                $ord['items'] = $iStmt->fetchAll();

                // Compute unique products count
                $uSet = [];
                foreach ($ord['items'] as $it) {
                    $uSet[$it['product_id'] . '_' . trim((string)$it['color'])] = true;
                }
                $ord['unique_products_count'] = count($uSet);

                $items = $ord['items'];
                $orderStageName = 'Requirement Gathering';
                $orderStageId = 1;
                if (!empty($items)) {
                    $allCompleted = true;
                    $incompleteItems = [];
                    foreach ($items as $it) {
                        $isComp = ($it['status'] === 'Completed' || (int)$it['current_stage_id'] === 10 || strtolower((string)($it['current_stage_name'] ?? '')) === 'completed');
                        if (!$isComp) {
                            $allCompleted = false;
                            $incompleteItems[] = $it;
                        }
                    }
                    if ($allCompleted) {
                        $orderStageName = 'Completed';
                        $orderStageId = 10;
                    } else {
                        usort($incompleteItems, fn($a, $b) => ((int)($a['stage_sequence'] ?? 1)) <=> ((int)($b['stage_sequence'] ?? 1)));
                        $orderStageName = $incompleteItems[0]['current_stage_name'] ?? 'Requirement Gathering';
                        $orderStageId = (int)($incompleteItems[0]['current_stage_id'] ?? 1);
                    }
                } elseif (strtoupper((string)($ord['status'] ?? '')) === 'COMPLETED') {
                    $orderStageName = 'Completed';
                    $orderStageId = 10;
                }
                $ord['current_stage_name'] = $orderStageName;
                $ord['current_stage_id'] = $orderStageId;
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
                       COALESCE(cat.name, po_cat.name, 'General') as category_name,
                       ps.name as current_stage_name, ps.code as stage_code, ps.color_badge, ps.sequence_order as stage_sequence,
                       col.pantone_code as color_pantone_code, col.hex_code as color_hex_code
                FROM production_order_items poi
                JOIN production_orders po ON poi.production_order_id = po.id
                LEFT JOIN categories po_cat ON po.category_id = po_cat.id
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                LEFT JOIN products p ON poi.product_id = p.id
                LEFT JOIN categories cat ON p.category_id = cat.id
                JOIN production_stages ps ON poi.current_stage_id = ps.id
                LEFT JOIN colors col ON (poi.color = col.name OR poi.color = col.code OR poi.color = col.pantone_code)
                WHERE poi.production_order_id = ? AND (poi.total_quantity > 0 OR poi.current_stage_quantity > 0)
                ORDER BY poi.id ASC
            ");
            $iStmt->execute([$id]);
            $order['items'] = $iStmt->fetchAll();

            $items = $order['items'];
            $orderStageName = 'Requirement Gathering';
            $orderStageId = 1;
            if (!empty($items)) {
                $allCompleted = true;
                $incompleteItems = [];
                foreach ($items as $it) {
                    $isComp = ($it['status'] === 'Completed' || (int)$it['current_stage_id'] === 10 || strtolower((string)($it['current_stage_name'] ?? '')) === 'completed');
                    if (!$isComp) {
                        $allCompleted = false;
                        $incompleteItems[] = $it;
                    }
                }
                if ($allCompleted) {
                    $orderStageName = 'Completed';
                    $orderStageId = 10;
                } else {
                    usort($incompleteItems, fn($a, $b) => ((int)($a['stage_sequence'] ?? 1)) <=> ((int)($b['stage_sequence'] ?? 1)));
                    $orderStageName = $incompleteItems[0]['current_stage_name'] ?? 'Requirement Gathering';
                    $orderStageId = (int)($incompleteItems[0]['current_stage_id'] ?? 1);
                }
            } elseif (strtoupper((string)($order['status'] ?? '')) === 'COMPLETED') {
                $orderStageName = 'Completed';
                $orderStageId = 10;
            }
            $order['current_stage_name'] = $orderStageName;
            $order['current_stage_id'] = $orderStageId;

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
        $prodOrderId = (int)($data['production_order_id'] ?? $data['order_id'] ?? 0);
        $toStageId = (int)($data['to_stage_id'] ?? $data['next_stage_id'] ?? 0);
        $moveQty = (int)($data['quantity_moved'] ?? $data['quantity'] ?? 0);
        $remarks = trim($data['remarks'] ?? $data['notes'] ?? '');

        if (!$toStageId) {
            Response::error("Destination stage is required", 422);
            return;
        }

        if (!$orderItemId && !$prodOrderId) {
            Response::error("Order item, destination stage, and positive move quantity are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $destStageStmt = $pdo->prepare("SELECT is_final_stage FROM production_stages WHERE id = ?");
            $destStageStmt->execute([$toStageId]);
            $isFinal = (bool)$destStageStmt->fetchColumn();

            // Support order-level stage movement if no specific item id was passed
            if (!$orderItemId && $prodOrderId > 0) {
                $stmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? FOR UPDATE");
                $stmt->execute([$prodOrderId]);
                $items = $stmt->fetchAll();

                if (empty($items)) {
                    $pdo->rollBack();
                    Response::error("No items found for production order #{$prodOrderId}", 404);
                    return;
                }

                $totalMoved = 0;
                $tStmt = $pdo->prepare("
                    INSERT INTO production_stage_transactions (production_order_item_id, from_stage_id, to_stage_id, quantity_moved, remarks)
                    VALUES (?, ?, ?, ?, ?)
                ");
                $upd = $pdo->prepare("
                    UPDATE production_order_items 
                    SET current_stage_id = ?, current_stage_quantity = ?, completed_quantity = ?, status = ?
                    WHERE id = ?
                ");

                foreach ($items as $item) {
                    $curStage = (int)$item['current_stage_id'];
                    $curQty = (int)$item['current_stage_quantity'];
                    $qToMove = $curQty > 0 ? $curQty : (int)$item['total_quantity'];
                    $newCompleted = (int)$item['completed_quantity'] + ($isFinal ? $qToMove : 0);
                    $status = $isFinal ? 'Completed' : 'In Progress';

                    $tStmt->execute([$item['id'], $curStage, $toStageId, $qToMove, $remarks]);
                    $upd->execute([$toStageId, $qToMove, $newCompleted, $status, $item['id']]);
                    $totalMoved += $qToMove;
                }

                if ($isFinal) {
                    $pordStmt = $pdo->prepare("UPDATE production_orders SET completed_quantity = completed_quantity + ? WHERE id = ?");
                    $pordStmt->execute([$totalMoved, $prodOrderId]);
                }

                $pdo->commit();
                AuditLogger::log('ProductionStages', 'MOVE_ALL', $prodOrderId, [], ['to_stage_id' => $toStageId, 'total_moved' => $totalMoved]);
                Response::success([
                    'moved_items_count' => count($items),
                    'total_moved_quantity' => $totalMoved,
                    'is_completed' => $isFinal,
                    'to_stage_id' => $toStageId
                ], "All order items moved to destination stage successfully");
                return;
            }

            if ($moveQty <= 0) {
                $pdo->rollBack();
                Response::error("Positive move quantity is required", 422);
                return;
            }

            $stmt = $pdo->prepare("SELECT * FROM production_order_items WHERE id = ? FOR UPDATE");
            $stmt->execute([$orderItemId]);
            $item = $stmt->fetch();

            if (!$item) {
                $pdo->rollBack();
                Response::error("Production order item not found", 404);
                return;
            }

            $currentStageId = (int)$item['current_stage_id'];
            $currentQty = (int)$item['current_stage_quantity'];
            if ($currentQty <= 0 && (int)$item['total_quantity'] > 0) {
                $currentQty = (int)$item['total_quantity'];
            }

            if ($moveQty > $currentQty) {
                $moveQty = $currentQty;
            }

            // Log stage transaction
            $tStmt = $pdo->prepare("
                INSERT INTO production_stage_transactions (production_order_item_id, from_stage_id, to_stage_id, quantity_moved, remarks)
                VALUES (?, ?, ?, ?, ?)
            ");
            $tStmt->execute([$orderItemId, $currentStageId, $toStageId, $moveQty, $remarks]);

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
                       COALESCE(cat.name, po_cat.name, 'General') as category_name,
                       ps.name as current_stage_name, ps.code as stage_code, ps.color_badge, ps.sequence_order as stage_sequence,
                       bp.buyer_id
                FROM production_order_items poi
                JOIN production_orders po ON poi.production_order_id = po.id
                LEFT JOIN categories po_cat ON po.category_id = po_cat.id
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                LEFT JOIN products p ON poi.product_id = p.id
                LEFT JOIN categories cat ON p.category_id = cat.id
                LEFT JOIN production_stages ps ON poi.current_stage_id = ps.id
                WHERE poi.production_order_id = ?
                ORDER BY poi.id ASC
            ");
            $iStmt->execute([$orderId]);
            $items = $iStmt->fetchAll();
            $order['items'] = $items;

            $orderStageName = 'Requirement Gathering';
            $orderStageId = 1;
            if (!empty($items)) {
                $allCompleted = true;
                $incompleteItems = [];
                foreach ($items as $it) {
                    $isComp = ($it['status'] === 'Completed' || (int)$it['current_stage_id'] === 10 || strtolower((string)($it['current_stage_name'] ?? '')) === 'completed');
                    if (!$isComp) {
                        $allCompleted = false;
                        $incompleteItems[] = $it;
                    }
                }
                if ($allCompleted) {
                    $orderStageName = 'Completed';
                    $orderStageId = 10;
                } else {
                    usort($incompleteItems, fn($a, $b) => ((int)($a['stage_sequence'] ?? 1)) <=> ((int)($b['stage_sequence'] ?? 1)));
                    $orderStageName = $incompleteItems[0]['current_stage_name'] ?? 'Requirement Gathering';
                    $orderStageId = (int)($incompleteItems[0]['current_stage_id'] ?? 1);
                }
            } elseif (strtoupper((string)($order['status'] ?? '')) === 'COMPLETED') {
                $orderStageName = 'Completed';
                $orderStageId = 10;
            }
            $order['current_stage_name'] = $orderStageName;
            $order['current_stage_id'] = $orderStageId;

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

                    $size = trim((string)($c['size'] ?? ''));
                    $model = trim((string)($c['model'] ?? ''));
                    $length = trim((string)($c['length'] ?? ''));
                    $thickness = trim((string)($c['thickness'] ?? ''));

                    // Required quantity with wastage percentage calculation
                    $lineRequired = round($itemQty * $perPiece * (1 + ($wastage / 100)), 3);
                    $productLineComps[] = [
                        'material_id' => $matId,
                        'material_code' => $matCode,
                        'name' => $matName,
                        'category' => $category,
                        'uom' => $uom,
                        'size' => $size ?: null,
                        'model' => $model ?: null,
                        'length' => $length ?: null,
                        'thickness' => $thickness ?: null,
                        'quantity_per_product' => $perPiece,
                        'wastage_percent' => $wastage,
                        'required_quantity' => $lineRequired,
                    ];

                    // Aggregation key considering specifications
                    $specKey = trim(($size ? "s:{$size}" : '') . ';' . ($model ? "m:{$model}" : '') . ';' . ($length ? "l:{$length}" : '') . ';' . ($thickness ? "t:{$thickness}" : ''));
                    $aggKey = $matId 
                        ? ($specKey ? "id_{$matId}_{$specKey}" : "id_{$matId}") 
                        : "name_" . strtolower($matName . '_' . $uom . ($specKey ? '_' . $specKey : ''));

                    if (!isset($materialsMap[$aggKey])) {
                        $materialsMap[$aggKey] = [
                            'material_id' => $matId,
                            'material_code' => $matCode,
                            'name' => $matName,
                            'category' => $category,
                            'uom' => $uom,
                            'size' => $size ?: null,
                            'model' => $model ?: null,
                            'length' => $length ?: null,
                            'thickness' => $thickness ?: null,
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
                        'size' => $size ?: null,
                        'model' => $model ?: null,
                        'length' => $length ?: null,
                        'thickness' => $thickness ?: null,
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
                    'category_name' => $item['category_name'] ?? 'General',
                    'color' => $item['color'],
                    'size' => $item['size'] ?? null,
                    'total_quantity' => $itemQty,
                    'components' => $productLineComps,
                ];
            }

            // Check if customized/saved BOM exists in production_orders and force recalculation is not requested
            $savedBom = !empty($order['generated_bom']) ? json_decode($order['generated_bom'], true) : null;
            if ($savedBom && !empty($savedBom['total_materials']) && empty($_GET['force']) && empty($_GET['recalculate'])) {
                $totalMaterialsList = $savedBom['total_materials'];
                $matIds = array_filter(array_column($totalMaterialsList, 'material_id'));
                if (!empty($matIds)) {
                    $inPlaceholders = implode(',', array_fill(0, count($matIds), '?'));
                    $mStmt = $pdo->prepare("SELECT id, current_stock, purchase_rate FROM materials WHERE id IN ($inPlaceholders)");
                    $mStmt->execute(array_values($matIds));
                    $liveStockMap = [];
                    foreach ($mStmt->fetchAll() as $row) {
                        $liveStockMap[$row['id']] = $row;
                    }
                    foreach ($totalMaterialsList as &$sm) {
                        if (!empty($sm['material_id']) && isset($liveStockMap[$sm['material_id']])) {
                            $sm['current_stock'] = (float)$liveStockMap[$sm['material_id']]['current_stock'];
                            $req = (float)($sm['total_required_qty'] ?? 0);
                            $stk = (float)$sm['current_stock'];
                            $sm['shortage_qty'] = max(0.0, round($req - $stk, 3));
                            if ($sm['shortage_qty'] > 0) {
                                $sm['status'] = ($stk > 0) ? 'Partial Stock' : 'Needs Procurement';
                            } else {
                                $sm['status'] = 'In Stock';
                            }
                        }
                    }
                    unset($sm);
                }

                // Enrich saved materials with size, model, length, thickness from buyer product components if missing
                foreach ($totalMaterialsList as &$sm) {
                    if (empty($sm['model']) && empty($sm['length']) && empty($sm['thickness']) && empty($sm['size'])) {
                        foreach ($materialsMap as $mappedMat) {
                            $match = (!empty($sm['material_id']) && $mappedMat['material_id'] == $sm['material_id']) ||
                                     (strtolower(trim($sm['name'])) === strtolower(trim($mappedMat['name'])));
                            if ($match) {
                                if (!empty($mappedMat['size'])) $sm['size'] = $mappedMat['size'];
                                if (!empty($mappedMat['model'])) $sm['model'] = $mappedMat['model'];
                                if (!empty($mappedMat['length'])) $sm['length'] = $mappedMat['length'];
                                if (!empty($mappedMat['thickness'])) $sm['thickness'] = $mappedMat['thickness'];
                                break;
                            }
                        }
                    }
                }
                unset($sm);

                $summary = $savedBom['summary'] ?? [
                    'total_products_count' => count($productsBreakdown),
                    'total_order_garments' => $totalGarments,
                    'total_distinct_materials' => count($totalMaterialsList),
                    'in_stock_count' => count(array_filter($totalMaterialsList, fn($x) => ($x['status'] ?? '') === 'In Stock')),
                    'shortage_count' => count(array_filter($totalMaterialsList, fn($x) => ($x['status'] ?? '') !== 'In Stock')),
                    'total_estimated_cost' => array_sum(array_column($totalMaterialsList, 'total_estimated_cost')),
                ];

                Response::success([
                    'order' => $order,
                    'products' => !empty($savedBom['products']) ? $savedBom['products'] : $productsBreakdown,
                    'total_materials' => $totalMaterialsList,
                    'summary' => $summary,
                    'generated_at' => $savedBom['updated_at'] ?? date('Y-m-d H:i:s'),
                    'is_persisted' => true,
                ]);
                return;
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
                    'size' => $m['size'] ?? null,
                    'model' => $m['model'] ?? null,
                    'length' => $m['length'] ?? null,
                    'thickness' => $m['thickness'] ?? null,
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

    public function saveMaterialRequirements(int $orderId): void {
        try {
            $pdo = Database::getConnection();
            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            $stmt = $pdo->prepare("SELECT id FROM production_orders WHERE id = ? AND deleted_at IS NULL");
            $stmt->execute([$orderId]);
            $ord = $stmt->fetch();
            if (!$ord) {
                Response::error("Production order not found", 404);
                return;
            }

            $bomPayload = [
                'total_materials' => $data['total_materials'] ?? $data['materials'] ?? [],
                'summary' => $data['summary'] ?? [],
                'products' => $data['products'] ?? [],
                'updated_at' => date('Y-m-d H:i:s'),
            ];

            $upd = $pdo->prepare("UPDATE production_orders SET generated_bom = ? WHERE id = ?");
            $upd->execute([json_encode($bomPayload), $orderId]);

            Response::success($bomPayload, "Material requirements (BOM) persisted successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    private function ensureWorkflowTables(PDO $pdo): void {
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `production_quantity_ledger` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `production_order_id` INT NOT NULL,
                  `production_order_item_id` INT NOT NULL,
                  `stage_id` INT NOT NULL,
                  `stage_code` VARCHAR(20) NOT NULL,
                  `transaction_type` VARCHAR(50) NOT NULL,
                  `quantity` DECIMAL(12, 2) NOT NULL,
                  `batch_number` VARCHAR(100) NULL,
                  `operator_name` VARCHAR(150) NULL,
                  `supervisor_name` VARCHAR(150) NULL,
                  `reference_type` VARCHAR(100) NULL,
                  `reference_id` VARCHAR(100) NULL,
                  `remarks` TEXT NULL,
                  `metadata_json` JSON NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_pql_ord` (`production_order_id`),
                  INDEX `idx_pql_itm` (`production_order_item_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");

            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `cutting_batches` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `production_order_id` INT NOT NULL,
                  `production_order_item_id` INT NOT NULL,
                  `batch_number` VARCHAR(100) NOT NULL,
                  `cutting_date` DATE NOT NULL,
                  `assigned_quantity` DECIMAL(12, 2) NOT NULL,
                  `actual_cut_quantity` DECIMAL(12, 2) NOT NULL,
                  `rejected_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `accepted_output_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `pending_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `operator` VARCHAR(150) NULL,
                  `supervisor` VARCHAR(150) NULL,
                  `machine_line` VARCHAR(100) NULL,
                  `remarks` TEXT NULL,
                  `photo_urls` JSON NULL,
                  `transferred_to_next_stage_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `destination_stage_id` INT NULL,
                  `destination_stage_name` VARCHAR(100) NULL,
                  `status` VARCHAR(50) DEFAULT 'In Progress',
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_cut_ord` (`production_order_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");

            try {
                $pdo->exec("ALTER TABLE `cutting_batches` ADD COLUMN `destination_stage_id` INT NULL AFTER `transferred_to_next_stage_quantity`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `cutting_batches` ADD COLUMN `destination_stage_name` VARCHAR(100) NULL AFTER `destination_stage_id`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `embroidery_job_orders` ADD COLUMN `items_json` JSON NULL");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `embroidery_job_orders` ADD COLUMN `attachments` JSON NULL");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `embroidery_job_orders` ADD COLUMN `notes` TEXT NULL");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `embroidery_job_orders` ADD COLUMN `transport_courier` VARCHAR(255) NULL");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `embroidery_job_orders` ADD COLUMN `sent_by` VARCHAR(150) NULL");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `embroidery_receipts` ADD COLUMN `items_data` JSON NULL");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `embroidery_receipts` ADD COLUMN `photo_urls` JSON NULL");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `packing_batches` ADD COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'Packed' AFTER `photo_urls`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `color` VARCHAR(100) NULL AFTER `defect_description`");
            } catch (Exception $e) {}

            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `embroidery_job_orders` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `job_order_number` VARCHAR(100) NOT NULL UNIQUE,
                  `production_order_id` INT NOT NULL,
                  `vendor_name` VARCHAR(255) NOT NULL,
                  `job_order_date` DATE NOT NULL,
                  `dispatch_date` DATE NOT NULL,
                  `expected_return_date` DATE NULL,
                  `delivery_challan_no` VARCHAR(100) NULL,
                  `transport_courier` VARCHAR(255) NULL,
                  `sent_by` VARCHAR(150) NULL,
                  `total_quantity_sent` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `total_quantity_received` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `total_quantity_accepted` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `total_quantity_rejected` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `total_quantity_rework` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `total_quantity_outstanding` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `status` VARCHAR(50) DEFAULT 'Sent to Vendor',
                  `notes` TEXT NULL,
                  `attachments` JSON NULL,
                  `items_json` JSON NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_emb_ord` (`production_order_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");

            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `embroidery_receipts` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `receipt_number` VARCHAR(100) NOT NULL UNIQUE,
                  `job_order_id` INT NOT NULL,
                  `production_order_id` INT NOT NULL,
                  `vendor_name` VARCHAR(255) NOT NULL,
                  `receipt_date` DATE NOT NULL,
                  `vendor_challan_no` VARCHAR(100) NULL,
                  `received_by` VARCHAR(150) NULL,
                  `total_received_qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `total_accepted_qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `total_rejected_qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `total_rework_qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `remarks` TEXT NULL,
                  `photo_urls` JSON NULL,
                  `items_data` JSON NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_er_job` (`job_order_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");

            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `stitching_batches` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `production_order_id` INT NOT NULL,
                  `production_order_item_id` INT NOT NULL,
                  `batch_number` VARCHAR(100) NOT NULL,
                  `assigned_quantity` DECIMAL(12, 2) NOT NULL,
                  `received_quantity` DECIMAL(12, 2) NOT NULL,
                  `completed_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `accepted_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `rejected_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `balance_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `operator_team` VARCHAR(150) NULL,
                  `production_line` VARCHAR(100) NULL,
                  `start_date` DATE NOT NULL,
                  `completion_date` DATE NULL,
                  `supervisor` VARCHAR(150) NULL,
                  `remarks` TEXT NULL,
                  `photo_urls` JSON NULL,
                  `status` VARCHAR(50) DEFAULT 'Completed',
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_sti_ord` (`production_order_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");

            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `quality_inspections` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `production_order_id` INT NOT NULL,
                  `production_order_item_id` INT NOT NULL,
                  `batch_number` VARCHAR(100) NULL,
                  `submitted_quantity` DECIMAL(12, 2) NOT NULL,
                  `checked_quantity` DECIMAL(12, 2) NOT NULL,
                  `passed_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `failed_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `rejected_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `defect_category` VARCHAR(100) NULL,
                  `defect_description` TEXT NULL,
                  `color` VARCHAR(100) NULL,
                  `inspector` VARCHAR(150) NULL,
                  `inspection_date` DATE NOT NULL,
                  `is_reinspection` TINYINT(1) DEFAULT 0,
                  `original_inspection_id` INT NULL,
                  `remarks` TEXT NULL,
                  `photo_urls` JSON NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_qi_ord` (`production_order_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");

            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `packing_batches` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `production_order_id` INT NOT NULL,
                  `production_order_item_id` INT NOT NULL,
                  `batch_number` VARCHAR(100) NOT NULL,
                  `packing_date` DATE NOT NULL,
                  `approved_quantity` DECIMAL(12, 2) NOT NULL,
                  `packed_quantity` DECIMAL(12, 2) NOT NULL,
                  `remaining_unpacked_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `units_per_box` INT NOT NULL DEFAULT 1,
                  `number_of_boxes` INT NOT NULL DEFAULT 0,
                  `boxes_per_master_carton` INT NOT NULL DEFAULT 1,
                  `number_of_master_cartons` INT NOT NULL DEFAULT 0,
                  `partial_box_quantity` INT NOT NULL DEFAULT 0,
                  `partial_carton_quantity` INT NOT NULL DEFAULT 0,
                  `carton_serial_numbers` TEXT NULL,
                  `gross_weight` DECIMAL(10, 2) NULL,
                  `net_weight` DECIMAL(10, 2) NULL,
                  `packing_operator` VARCHAR(150) NULL,
                  `packing_supervisor` VARCHAR(150) NULL,
                  `remarks` TEXT NULL,
                  `photo_urls` JSON NULL,
                  `status` VARCHAR(50) DEFAULT 'Packed',
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_pb_ord` (`production_order_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");

            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `packing_cartons` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `carton_serial_number` VARCHAR(100) NOT NULL UNIQUE,
                  `packing_batch_id` INT NOT NULL,
                  `production_order_id` INT NOT NULL,
                  `production_order_item_id` INT NOT NULL,
                  `product_name` VARCHAR(255) NOT NULL,
                  `product_code` VARCHAR(100) NULL,
                  `color` VARCHAR(100) NULL,
                  `size` VARCHAR(50) NULL,
                  `box_name` VARCHAR(150) NULL,
                  `items_count` INT NOT NULL DEFAULT 0,
                  `is_full` TINYINT(1) DEFAULT 1,
                  `gross_weight` DECIMAL(10, 2) NULL,
                  `status` VARCHAR(50) DEFAULT 'Packed',
                  `dispatch_id` INT NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_pc_ord` (`production_order_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");

            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `dispatch_records` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `dispatch_number` VARCHAR(100) NOT NULL UNIQUE,
                  `production_order_id` INT NOT NULL,
                  `buyer_name` VARCHAR(255) NOT NULL,
                  `dispatch_date` DATE NOT NULL,
                  `dispatch_time` TIME NULL,
                  `total_dispatched_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `total_boxes` INT NOT NULL DEFAULT 0,
                  `total_master_cartons` INT NOT NULL DEFAULT 0,
                  `vehicle_number` VARCHAR(100) NOT NULL,
                  `driver_name` VARCHAR(150) NULL,
                  `driver_contact` VARCHAR(50) NULL,
                  `transporter_name` VARCHAR(255) NULL,
                  `delivery_challan_number` VARCHAR(100) NULL,
                  `invoice_reference` VARCHAR(100) NULL,
                  `destination_notes` TEXT NULL,
                  `remarks` TEXT NULL,
                  `truck_photo_urls` JSON NULL,
                  `loaded_cartons_photo_urls` JSON NULL,
                  `labels_photo_urls` JSON NULL,
                  `document_urls` JSON NULL,
                  `status` VARCHAR(50) DEFAULT 'Dispatched',
                  `carton_serial_numbers` JSON NULL,
                  `items_breakdown` JSON NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_dr_ord` (`production_order_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");
        } catch (Exception $e) {}
    }

    public function dashboardStats(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $stmt = $pdo->query("SELECT * FROM production_orders WHERE deleted_at IS NULL");
            $orders = $stmt->fetchAll();

            $activeOrders = array_filter($orders, fn($o) => $o['status'] !== 'COMPLETED' && $o['status'] !== 'Cancelled');
            $totalOrderedQty = array_reduce($activeOrders, fn($sum, $o) => $sum + (float)$o['total_quantity'], 0.0);

            $iStmt = $pdo->query("SELECT * FROM production_order_items");
            $items = $iStmt->fetchAll();

            $cutPending = 0; $stiPending = 0; $chkPending = 0; $pckPending = 0; $totalInProd = 0;
            foreach ($items as $it) {
                $q = (float)($it['current_stage_quantity'] ?? 0);
                $stgId = (int)$it['current_stage_id'];
                if ($stgId < 10) $totalInProd += $q;
                if ($stgId === 5) $cutPending += $q;
                if ($stgId === 7) $stiPending += $q;
                if ($stgId === 8) $chkPending += $q;
                if ($stgId === 9) $pckPending += $q;
            }

            $embOutward = (float)$pdo->query("SELECT COALESCE(SUM(total_quantity_sent), 0) FROM embroidery_job_orders WHERE status != 'Cancelled'")->fetchColumn();
            $embInward = (float)$pdo->query("SELECT COALESCE(SUM(total_quantity_received), 0) FROM embroidery_job_orders WHERE status != 'Cancelled'")->fetchColumn();
            $embOutstanding = max(0.0, $embOutward - $embInward);

            $completedCount = count(array_filter($orders, fn($o) => $o['status'] === 'COMPLETED' || $o['status'] === 'Fully Dispatched'));
            $partiallyDispatched = count(array_filter($orders, fn($o) => $o['status'] === 'Partially Dispatched'));

            $today = date('Y-m-d');
            $overdueCount = count(array_filter($orders, fn($o) => $o['status'] !== 'COMPLETED' && !empty($o['target_delivery_date']) && $o['target_delivery_date'] < $today));

            Response::success([
                'total_active_orders' => count($activeOrders),
                'total_ordered_quantity' => $totalOrderedQty,
                'total_quantity_in_production' => $totalInProd,
                'cutting_pending_quantity' => $cutPending,
                'embroidery_outward_quantity' => $embOutward,
                'embroidery_outstanding_quantity' => $embOutstanding,
                'stitching_pending_quantity' => $stiPending,
                'checking_pending_quantity' => $chkPending,
                'packing_pending_quantity' => $pckPending,
                'completed_orders' => $completedCount,
                'partially_dispatched_orders' => $partiallyDispatched,
                'overdue_orders' => $overdueCount
            ]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function orderProductQuantities(int $orderId): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $ordStmt = $pdo->prepare("SELECT po.*, cu.name as customer_name FROM production_orders po LEFT JOIN customers cu ON po.customer_id = cu.id WHERE po.id = ?");
            $ordStmt->execute([$orderId]);
            $ord = $ordStmt->fetch();
            if (!$ord) { Response::error("Order not found", 404); return; }

            $iStmt = $pdo->prepare("SELECT poi.*, COALESCE(bp.product_name, p.name) as product_name, COALESCE(bp.product_code, p.code) as product_code, ps.name as current_stage_name FROM production_order_items poi LEFT JOIN buyer_products bp ON poi.product_id = bp.id LEFT JOIN products p ON poi.product_id = p.id JOIN production_stages ps ON poi.current_stage_id = ps.id WHERE poi.production_order_id = ?");
            $iStmt->execute([$orderId]);
            $items = $iStmt->fetchAll();

            $products = [];
            foreach ($items as $it) {
                $itemId = (int)$it['id'];
                $totalQty = (float)$it['total_quantity'];

                $cStmt = $pdo->prepare("SELECT COALESCE(SUM(actual_cut_quantity), 0) as cut, COALESCE(SUM(accepted_output_quantity), 0) as acc, COALESCE(SUM(rejected_quantity), 0) as rej, COALESCE(SUM(rework_quantity), 0) as rwk FROM cutting_batches WHERE production_order_item_id = ?");
                $cStmt->execute([$itemId]);
                $cut = $cStmt->fetch();

                $sStmt = $pdo->prepare("SELECT COALESCE(SUM(completed_quantity), 0) as comp, COALESCE(SUM(accepted_quantity), 0) as acc, COALESCE(SUM(rejected_quantity), 0) as rej, COALESCE(SUM(rework_quantity), 0) as rwk FROM stitching_batches WHERE production_order_item_id = ?");
                $sStmt->execute([$itemId]);
                $sti = $sStmt->fetch();

                $qStmt = $pdo->prepare("SELECT COALESCE(SUM(submitted_quantity), 0) as sub, COALESCE(SUM(passed_quantity), 0) as passed, COALESCE(SUM(failed_quantity), 0) as failed, COALESCE(SUM(rework_quantity), 0) as rwk, COALESCE(SUM(rejected_quantity), 0) as rej FROM quality_inspections WHERE production_order_item_id = ?");
                $qStmt->execute([$itemId]);
                $chk = $qStmt->fetch();

                $pStmt = $pdo->prepare("SELECT COALESCE(SUM(packed_quantity), 0) as packed, COALESCE(SUM(number_of_boxes), 0) as boxes, COALESCE(SUM(number_of_master_cartons), 0) as cartons FROM packing_batches WHERE production_order_item_id = ?");
                $pStmt->execute([$itemId]);
                $pck = $pStmt->fetch();

                $dispatchedQty = (float)($it['completed_quantity'] ?? 0);

                $products[] = [
                    'item_id' => $itemId,
                    'product_id' => (int)$it['product_id'],
                    'product_name' => $it['product_name'],
                    'product_code' => $it['product_code'],
                    'color' => $it['color'],
                    'size' => $it['size'] ?? 'M',
                    'order_quantity' => $totalQty,
                    'current_stage_id' => (int)$it['current_stage_id'],
                    'current_stage_name' => $it['current_stage_name'],
                    'current_stage_quantity' => (float)$it['current_stage_quantity'],
                    'status' => $it['status'],
                    'cutting' => [
                        'cut_quantity' => (float)$cut['cut'],
                        'accepted_quantity' => (float)$cut['acc'],
                        'rejected_quantity' => (float)$cut['rej'],
                        'rework_quantity' => (float)$cut['rwk'],
                        'pending_quantity' => max(0.0, $totalQty - (float)$cut['acc']),
                    ],
                    'stitching' => [
                        'completed_quantity' => (float)$sti['comp'],
                        'accepted_quantity' => (float)$sti['acc'],
                        'rejected_quantity' => (float)$sti['rej'],
                        'rework_quantity' => (float)$sti['rwk'],
                    ],
                    'checking' => [
                        'submitted_quantity' => (float)$chk['sub'],
                        'passed_quantity' => (float)$chk['passed'],
                        'failed_quantity' => (float)$chk['failed'],
                        'rework_quantity' => (float)$chk['rwk'],
                        'rejected_quantity' => (float)$chk['rej'],
                    ],
                    'packing' => [
                        'packed_quantity' => (float)$pck['packed'],
                        'boxes_count' => (int)$pck['boxes'],
                        'cartons_count' => (int)$pck['cartons'],
                        'unpacked_quantity' => max(0.0, ((float)$chk['passed'] ?: $totalQty) - (float)$pck['packed']),
                    ],
                    'dispatch' => [
                        'dispatched_quantity' => $dispatchedQty,
                        'pending_dispatch_quantity' => max(0.0, (float)$pck['packed'] - $dispatchedQty),
                    ],
                    'progress_percent' => $totalQty > 0 ? min(100, round(($dispatchedQty / $totalQty) * 100)) : 0,
                    'overall_pending_quantity' => max(0.0, $totalQty - $dispatchedQty),
                ];
            }

            Response::success([
                'order_id' => $ord['id'],
                'order_number' => $ord['order_number'],
                'title' => $ord['title'],
                'customer_name' => $ord['customer_name'],
                'total_order_quantity' => (float)$ord['total_quantity'],
                'completed_quantity' => (float)$ord['completed_quantity'],
                'products' => $products
            ]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function orderQuantityLedger(int $orderId): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $stmt = $pdo->prepare("SELECT * FROM production_quantity_ledger WHERE production_order_id = ? ORDER BY id DESC");
            $stmt->execute([$orderId]);
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function cuttingOrders(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);
            $stmt = $pdo->query("SELECT po.*, cu.name as customer_name, (SELECT COUNT(*) FROM cutting_batches WHERE production_order_id = po.id) as batches_count FROM production_orders po LEFT JOIN customers cu ON po.customer_id = cu.id WHERE po.deleted_at IS NULL ORDER BY po.id DESC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function cuttingOrderDetails(int $orderId): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $ordStmt = $pdo->prepare("SELECT po.*, cu.name as customer_name, cu.code as customer_code FROM production_orders po LEFT JOIN customers cu ON po.customer_id = cu.id WHERE po.id = ?");
            $ordStmt->execute([$orderId]);
            $ord = $ordStmt->fetch();
            if (!$ord) { Response::error("Order not found", 404); return; }

            $bStmt = $pdo->prepare("
                SELECT cb.*, 
                       poi.product_id, 
                       COALESCE(bp.product_name, p.name) as product_name, 
                       poi.color,
                       COALESCE(cb.destination_stage_name, ps.name) as stage_target_name
                FROM cutting_batches cb 
                LEFT JOIN production_order_items poi ON cb.production_order_item_id = poi.id 
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id 
                LEFT JOIN products p ON poi.product_id = p.id 
                LEFT JOIN production_stages ps ON cb.destination_stage_id = ps.id
                WHERE cb.production_order_id = ? 
                ORDER BY cb.id DESC
            ");
            $bStmt->execute([$orderId]);
            $batches = $bStmt->fetchAll();
            foreach ($batches as &$b) {
                if (isset($b['photo_urls']) && is_string($b['photo_urls'])) {
                    $b['photo_urls'] = json_decode($b['photo_urls'], true) ?: [];
                }
            }
            unset($b);

            $iStmt = $pdo->prepare("SELECT poi.*, COALESCE(bp.product_name, p.name) as product_name, COALESCE(bp.product_code, p.code) as product_code FROM production_order_items poi LEFT JOIN buyer_products bp ON poi.product_id = bp.id LEFT JOIN products p ON poi.product_id = p.id WHERE poi.production_order_id = ?");
            $iStmt->execute([$orderId]);
            $rawItems = $iStmt->fetchAll();

            // Aggregate items by product_id and color so order-level product line is coherent
            $groupedItems = [];
            foreach ($rawItems as $rawIt) {
                $grpKey = $rawIt['product_id'] . '_' . ($rawIt['color'] ?? '');
                if (!isset($groupedItems[$grpKey])) {
                    $groupedItems[$grpKey] = $rawIt;
                    $groupedItems[$grpKey]['total_quantity'] = (float)$rawIt['total_quantity'];
                } else {
                    $groupedItems[$grpKey]['total_quantity'] += (float)$rawIt['total_quantity'];
                }
            }
            $items = array_values($groupedItems);

            foreach ($items as &$it) {
                $pId = (int)$it['product_id'];
                $color = $it['color'] ?? '';
                $itemBatches = array_filter($batches, fn($b) => (int)$b['product_id'] === $pId && ($b['color'] ?? '') === $color);

                $itCut = array_reduce($itemBatches, fn($s, $b) => $s + (float)$b['actual_cut_quantity'], 0.0);
                $itAcc = array_reduce($itemBatches, fn($s, $b) => $s + (float)$b['accepted_output_quantity'], 0.0);
                $itRej = array_reduce($itemBatches, fn($s, $b) => $s + (float)$b['rejected_quantity'], 0.0);
                $itRwk = array_reduce($itemBatches, fn($s, $b) => $s + (float)$b['rework_quantity'], 0.0);
                $itTrf = array_reduce($itemBatches, fn($s, $b) => $s + (float)$b['transferred_to_next_stage_quantity'], 0.0);

                $it['total_cut_quantity'] = $itCut;
                $it['accepted_output_quantity'] = $itAcc;
                $it['rejected_quantity'] = $itRej;
                $it['rework_quantity'] = $itRwk;
                $it['transferred_quantity'] = $itTrf;
                $it['pending_cut_quantity'] = max(0.0, (float)$it['total_quantity'] - $itCut);
            }
            unset($it);

            Response::success(['order' => $ord, 'items' => $items, 'batches' => $batches]);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function createCuttingBatch(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $pId = (int)($data['production_order_id'] ?? 0);
            $itemId = (int)($data['production_order_item_id'] ?? 0);
            $actual = (float)($data['actual_cut_quantity'] ?? 0);
            $rej = (float)($data['rejected_quantity'] ?? 0);
            $rwk = (float)($data['rework_quantity'] ?? 0);
            $assigned = (float)($data['assigned_quantity'] ?? $actual);
            $acc = max(0.0, $actual - $rej - $rwk);

            if ($pId <= 0 || $actual <= 0) {
                Response::error("Production order and valid cut quantity are required", 422);
                return;
            }

            // Verify order item exists
            $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE id = ?");
            $iStmt->execute([$itemId]);
            $item = $iStmt->fetch();
            if (!$item || (int)$item['production_order_id'] !== $pId) {
                $pIdReq = (int)($data['product_id'] ?? 0);
                $colReq = trim((string)($data['color'] ?? ''));
                if ($pIdReq > 0) {
                    $fStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? AND product_id = ? AND color = ? LIMIT 1");
                    $fStmt->execute([$pId, $pIdReq, $colReq]);
                    $item = $fStmt->fetch();
                    if ($item) {
                        $itemId = (int)$item['id'];
                    }
                }
                if (!$item) {
                    $fStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? LIMIT 1");
                    $fStmt->execute([$pId]);
                    $item = $fStmt->fetch();
                    if ($item) {
                        $itemId = (int)$item['id'];
                    }
                }
            }

            $batchNo = 'CUT-' . rand(1000, 9999);
            $stmt = $pdo->prepare("
                INSERT INTO cutting_batches 
                (production_order_id, production_order_item_id, batch_number, cutting_date, assigned_quantity, actual_cut_quantity, rejected_quantity, rework_quantity, accepted_output_quantity, pending_quantity, operator, supervisor, machine_line, remarks, photo_urls, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'In Progress')
            ");
            $stmt->execute([
                $pId, 
                $itemId, 
                $batchNo, 
                $data['cutting_date'] ?? date('Y-m-d'), 
                $assigned, 
                $actual, 
                $rej, 
                $rwk, 
                $acc, 
                $data['operator'] ?? null, 
                $data['supervisor'] ?? null, 
                $data['machine_line'] ?? null, 
                $data['remarks'] ?? ($data['notes'] ?? ''), 
                json_encode($data['photo_urls'] ?? [])
            ]);

            // Ledger
            $lStmt = $pdo->prepare("
                INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 5, 'CUT', 'ACCEPTED', ?, ?, ?, ?, 'Cutting Batch', ?, ?)
            ");
            $lStmt->execute([$pId, $itemId, $acc, $batchNo, $data['operator'] ?? '', $data['supervisor'] ?? '', $batchNo, $data['remarks'] ?? ($data['notes'] ?? '')]);

            Response::success(['batch_number' => $batchNo, 'accepted' => $acc], "Cutting batch recorded successfully", 201);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function transferCuttingOutput(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $bId = (int)($data['batch_id'] ?? 0);
            $qty = (float)($data['transfer_quantity'] ?? 0);
            $destStageId = (int)($data['destination_stage_id'] ?? 6);
            $remarks = trim($data['remarks'] ?? ($data['notes'] ?? ''));

            if ($bId <= 0 || $qty <= 0) {
                Response::error("Batch ID and positive transfer quantity are required", 422);
                return;
            }

            // Fetch batch
            $bStmt = $pdo->prepare("SELECT * FROM cutting_batches WHERE id = ?");
            $bStmt->execute([$bId]);
            $batch = $bStmt->fetch();
            if (!$batch) {
                Response::error("Cutting batch not found", 404);
                return;
            }

            $avail = (float)$batch['accepted_output_quantity'] - (float)$batch['transferred_to_next_stage_quantity'];
            if ($qty > $avail + 0.001) {
                Response::error("Transfer quantity ({$qty}) exceeds available accepted output ({$avail})", 422);
                return;
            }

            // Lookup destination stage info
            $stgStmt = $pdo->prepare("SELECT id, name, code FROM production_stages WHERE id = ?");
            $stgStmt->execute([$destStageId]);
            $destStage = $stgStmt->fetch();
            $destName = $destStage ? $destStage['name'] : ($destStageId === 7 ? 'Stitching — Color-wise Tracking' : 'Embroidery — Outward / Inward');
            $destCode = $destStage ? $destStage['code'] : ($destStageId === 7 ? 'STI' : 'EMB');

            $pdo->beginTransaction();

            // 1. Update cutting batch
            $newTrf = (float)$batch['transferred_to_next_stage_quantity'] + $qty;
            $newStatus = ($newTrf >= (float)$batch['accepted_output_quantity'] - 0.001) ? 'Transferred' : 'Partial Transfer';

            $updBatch = $pdo->prepare("
                UPDATE cutting_batches 
                SET transferred_to_next_stage_quantity = ?,
                    destination_stage_id = ?,
                    destination_stage_name = ?,
                    status = ?
                WHERE id = ?
            ");
            $updBatch->execute([$newTrf, $destStageId, $destName, $newStatus, $bId]);

            // 2. Insert into production_quantity_ledger
            $lStmt = $pdo->prepare("
                INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 5, 'CUT', 'TRANSFER_OUT', ?, ?, '', '', 'Cutting Stage Transfer', ?, ?)
            ");
            $lStmt->execute([$batch['production_order_id'], $batch['production_order_item_id'], $qty, $batch['batch_number'], (string)$destStageId, "Transferred to {$destName}"]);

            $lInStmt = $pdo->prepare("
                INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, ?, ?, 'TRANSFER_IN', ?, ?, '', '', 'Cutting Stage Transfer', ?, ?)
            ");
            $lInStmt->execute([$batch['production_order_id'], $batch['production_order_item_id'], $destStageId, $destCode, $qty, $batch['batch_number'], (string)$bId, "Transferred from Cutting Batch {$batch['batch_number']}"]);

            // 3. Update production_order_items for stage routing
            $pId = (int)$batch['production_order_id'];
            $itemId = (int)$batch['production_order_item_id'];

            // Get the item
            $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE id = ? FOR UPDATE");
            $iStmt->execute([$itemId]);
            $item = $iStmt->fetch();

            if ($item && ((int)$item['current_stage_id'] !== 5 || (float)$item['current_stage_quantity'] < $qty - 0.001)) {
                $cStmt = $pdo->prepare("
                    SELECT * FROM production_order_items 
                    WHERE production_order_id = ? AND product_id = ? AND color = ? AND current_stage_id = 5 AND current_stage_quantity >= ?
                    ORDER BY id ASC
                    LIMIT 1
                ");
                $cStmt->execute([$pId, $item['product_id'], $item['color'], $qty]);
                $altItem = $cStmt->fetch();
                if ($altItem) {
                    $item = $altItem;
                    $itemId = (int)$item['id'];
                }
            }

            if ($item) {
                // Check if an item already exists at this destination stage for the same order, product, and color
                $matchStmt = $pdo->prepare("
                    SELECT id FROM production_order_items 
                    WHERE production_order_id = ? AND product_id = ? AND color = ? AND current_stage_id = ?
                    LIMIT 1
                ");
                $matchStmt->execute([$pId, $item['product_id'], $item['color'], $destStageId]);
                $existingDestItemId = $matchStmt->fetchColumn();

                if ($existingDestItemId) {
                    // Add quantity to existing item in destination stage
                    $addStmt = $pdo->prepare("
                        UPDATE production_order_items 
                        SET current_stage_quantity = current_stage_quantity + ?,
                            total_quantity = total_quantity + ?
                        WHERE id = ?
                    ");
                    $addStmt->execute([$qty, $qty, $existingDestItemId]);

                    // Deduct from current item
                    $remQty = max(0.0, (float)$item['current_stage_quantity'] - $qty);
                    $remTotal = max(0.0, (float)$item['total_quantity'] - $qty);
                    if ($remQty <= 0.001) {
                        $pdo->prepare("DELETE FROM production_order_items WHERE id = ?")->execute([$itemId]);
                    } else {
                        $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = ?, total_quantity = ? WHERE id = ?")->execute([$remQty, $remTotal, $itemId]);
                    }
                } else {
                    $curStageQty = (float)$item['current_stage_quantity'];
                    if ($curStageQty <= $qty + 0.001) {
                        // Whole item advances to destination stage!
                        $updItem = $pdo->prepare("
                            UPDATE production_order_items 
                            SET current_stage_id = ?,
                                current_stage_quantity = ?,
                                status = 'In Progress'
                            WHERE id = ?
                        ");
                        $updItem->execute([$destStageId, $qty, $itemId]);
                    } else {
                        // Split item: reduce current item in cutting, create new item in destination stage
                        $remStageQty = $curStageQty - $qty;
                        $remTotalQty = max($remStageQty, (float)$item['total_quantity'] - $qty);

                        $pdo->prepare("
                            UPDATE production_order_items 
                            SET current_stage_quantity = ?,
                                total_quantity = ?
                            WHERE id = ?
                        ")->execute([$remStageQty, $remTotalQty, $itemId]);

                        $insNewItem = $pdo->prepare("
                            INSERT INTO production_order_items 
                            (production_order_id, product_id, color, total_quantity, current_stage_id, current_stage_quantity, completed_quantity, rejected_quantity, rework_quantity, status) 
                            VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 'In Progress')
                        ");
                        $insNewItem->execute([
                            $pId,
                            $item['product_id'],
                            $item['color'],
                            $qty,
                            $destStageId,
                            $qty
                        ]);
                    }
                }
            }

            // Log stage transaction
            $tStmt = $pdo->prepare("
                INSERT INTO production_stage_transactions (production_order_item_id, from_stage_id, to_stage_id, quantity_moved, remarks)
                VALUES (?, 5, ?, ?, ?)
            ");
            $tStmt->execute([$itemId, $destStageId, $qty, "Transferred from Cutting Batch {$batch['batch_number']} to {$destName}"]);

            $pdo->commit();
            Response::success([
                'batch_id' => $bId,
                'transferred_quantity' => $qty,
                'destination_stage_id' => $destStageId,
                'destination_stage_name' => $destName,
            ], "Successfully transferred {$qty} pcs to {$destName}");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function embroideryJobOrders(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);
            $stmt = $pdo->query("SELECT * FROM embroidery_job_orders ORDER BY id DESC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function embroideryOrderDetails(int $orderId): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $ordStmt = $pdo->prepare("
                SELECT po.*, 
                       cu.name as customer_name, 
                       cu.code as customer_code
                FROM production_orders po 
                LEFT JOIN customers cu ON po.customer_id = cu.id 
                WHERE po.id = ?
            ");
            $ordStmt->execute([$orderId]);
            $ord = $ordStmt->fetch();
            if (!$ord) { Response::error("Production order not found", 404); return; }

            // Fetch Job Orders
            $jStmt = $pdo->prepare("SELECT * FROM embroidery_job_orders WHERE production_order_id = ? ORDER BY id DESC");
            $jStmt->execute([$orderId]);
            $jobs = $jStmt->fetchAll();
            foreach ($jobs as &$job) {
                if (isset($job['attachments']) && is_string($job['attachments'])) {
                    $job['attachments'] = json_decode($job['attachments'], true) ?: [];
                }
                if (isset($job['items_json']) && is_string($job['items_json'])) {
                    $job['items_json'] = json_decode($job['items_json'], true) ?: [];
                }
            }
            unset($job);

            // Fetch Receipts
            $rStmt = $pdo->prepare("SELECT * FROM embroidery_receipts WHERE production_order_id = ? ORDER BY id DESC");
            $rStmt->execute([$orderId]);
            $receipts = $rStmt->fetchAll();
            foreach ($receipts as &$rcpt) {
                if (isset($rcpt['photo_urls']) && is_string($rcpt['photo_urls'])) {
                    $rcpt['photo_urls'] = json_decode($rcpt['photo_urls'], true) ?: [];
                }
                if (isset($rcpt['items_data']) && is_string($rcpt['items_data'])) {
                    $rcpt['items_data'] = json_decode($rcpt['items_data'], true) ?: [];
                }
            }
            unset($rcpt);

            // Query items for this production order
            $iStmt = $pdo->prepare("
                SELECT poi.*, 
                       COALESCE(bp.product_name, p.name) as product_name,
                       COALESCE(bp.product_code, p.code) as product_code
                FROM production_order_items poi 
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id 
                LEFT JOIN products p ON poi.product_id = p.id 
                WHERE poi.production_order_id = ?
            ");
            $iStmt->execute([$orderId]);
            $rawItems = $iStmt->fetchAll();

            // Aggregate items by product_id and color
            $groupedItems = [];
            foreach ($rawItems as $rawIt) {
                $grpKey = $rawIt['product_id'] . '_' . trim((string)($rawIt['color'] ?? ''));
                if (!isset($groupedItems[$grpKey])) {
                    $groupedItems[$grpKey] = $rawIt;
                    $groupedItems[$grpKey]['order_quantity'] = (float)$rawIt['total_quantity'];
                    $groupedItems[$grpKey]['current_stage_quantity'] = (int)$rawIt['current_stage_id'] === 6 ? (float)$rawIt['current_stage_quantity'] : 0.0;
                    $groupedItems[$grpKey]['arrived_from_cutting'] = (int)$rawIt['current_stage_id'] === 6 ? (float)$rawIt['current_stage_quantity'] : 0.0;
                    $groupedItems[$grpKey]['active_embroidery_item_id'] = (int)$rawIt['id'];
                    $groupedItems[$grpKey]['at_embroidery_stage'] = ((int)$rawIt['current_stage_id'] === 6);
                } else {
                    $groupedItems[$grpKey]['order_quantity'] += (float)$rawIt['total_quantity'];
                    if ((int)$rawIt['current_stage_id'] === 6) {
                        $groupedItems[$grpKey]['current_stage_quantity'] += (float)$rawIt['current_stage_quantity'];
                        $groupedItems[$grpKey]['arrived_from_cutting'] += (float)$rawIt['current_stage_quantity'];
                        $groupedItems[$grpKey]['active_embroidery_item_id'] = (int)$rawIt['id'];
                        $groupedItems[$grpKey]['at_embroidery_stage'] = true;
                    }
                }
            }

            // Tally outward dispatched, inward received, accepted, rejected from job orders and receipts
            foreach ($groupedItems as &$gIt) {
                $pId = (int)$gIt['product_id'];
                $color = trim((string)($gIt['color'] ?? ''));

                $sent = 0.0;
                $received = 0.0;
                $accepted = 0.0;
                $rejected = 0.0;
                $rework = 0.0;

                foreach ($jobs as $job) {
                    $jItems = $job['items_json'] ?? [];
                    foreach ($jItems as $ji) {
                        $m = false;
                        if (!empty($ji['production_order_item_id']) && $ji['production_order_item_id'] == $gIt['active_embroidery_item_id']) $m = true;
                        if (!empty($ji['product_id']) && $ji['product_id'] == $pId && trim((string)($ji['color'] ?? '')) === $color) $m = true;
                        if ($m) {
                            $sent += (float)($ji['quantity_sent'] ?? 0);
                        }
                    }
                }

                foreach ($receipts as $rcpt) {
                    $rItems = $rcpt['items_data'] ?? [];
                    foreach ($rItems as $ri) {
                        $m = false;
                        if (!empty($ri['production_order_item_id']) && $ri['production_order_item_id'] == $gIt['active_embroidery_item_id']) $m = true;
                        if (!empty($ri['product_id']) && $ri['product_id'] == $pId && trim((string)($ri['color'] ?? '')) === $color) $m = true;
                        if ($m) {
                            $received += (float)($ri['received_quantity'] ?? 0);
                            $accepted += (float)($ri['accepted_quantity'] ?? 0);
                            $rejected += (float)($ri['rejected_quantity'] ?? 0);
                            $rework += (float)($ri['rework_quantity'] ?? 0);
                        }
                    }
                }

                if ($sent > $gIt['arrived_from_cutting']) {
                    $gIt['arrived_from_cutting'] = $sent;
                }

                $gIt['sent_to_vendor'] = $sent;
                $gIt['received_inward'] = $received;
                $gIt['accepted_inward'] = $accepted;
                $gIt['rejected_quantity'] = $rejected;
                $gIt['rework_quantity'] = $rework;
                $gIt['outstanding_quantity'] = max(0.0, $sent - $received);
                $gIt['available_to_dispatch'] = max(0.0, (float)$gIt['arrived_from_cutting'] - $sent);
                $gIt['ready_to_transfer'] = max(0.0, $accepted);
            }
            unset($gIt);

            $items = array_values($groupedItems);

            Response::success([
                'order' => $ord,
                'items' => $items,
                'job_orders' => $jobs,
                'receipts' => $receipts
            ]);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function createEmbroideryJobOrder(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $pId = (int)($data['production_order_id'] ?? 0);
            if ($pId <= 0) {
                Response::error("Production order ID is required", 422);
                return;
            }

            $jobNo = 'EMB-JOB-' . rand(1000, 9999);
            $items = $data['items'] ?? [];
            $totalSent = array_reduce($items, fn($s, $i) => $s + (float)($i['quantity_sent'] ?? 0), 0.0);

            if ($totalSent <= 0) {
                Response::error("Please specify at least one item with quantity sent > 0", 422);
                return;
            }

            $stmt = $pdo->prepare("INSERT INTO embroidery_job_orders 
                (job_order_number, production_order_id, vendor_name, job_order_date, dispatch_date, expected_return_date, delivery_challan_no, transport_courier, sent_by, total_quantity_sent, total_quantity_outstanding, status, notes, attachments, items_json) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Sent to Vendor', ?, ?, ?)");
            $stmt->execute([
                $jobNo, 
                $pId, 
                $data['vendor_name'] ?? 'Apex Embroidery Works', 
                $data['job_order_date'] ?? date('Y-m-d'), 
                $data['dispatch_date'] ?? date('Y-m-d'), 
                $data['expected_return_date'] ?? null, 
                $data['delivery_challan_no'] ?? ('DC-EMB-' . rand(1000, 9999)), 
                $data['transport_courier'] ?? null, 
                $data['sent_by'] ?? null, 
                $totalSent, 
                $totalSent, 
                $data['notes'] ?? '', 
                json_encode($data['attachments'] ?? []), 
                json_encode($items)
            ]);
            $jobId = (int)$pdo->lastInsertId();

            // Log outward dispatch in quantity ledger for each item
            foreach ($items as $it) {
                $itId = (int)($it['production_order_item_id'] ?? 0);
                $itQty = (float)($it['quantity_sent'] ?? 0);
                if ($itQty > 0) {
                    $lStmt = $pdo->prepare("
                        INSERT INTO production_quantity_ledger 
                        (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                        VALUES (?, ?, 6, 'EMB', 'OUTWARD', ?, ?, ?, ?, 'Embroidery Job Order', ?, ?)
                    ");
                    $lStmt->execute([
                        $pId, 
                        $itId, 
                        $itQty, 
                        $jobNo, 
                        $data['sent_by'] ?? '', 
                        '', 
                        $jobNo, 
                        "Dispatched to {$data['vendor_name']}"
                    ]);
                }
            }

            Response::success([
                'id' => $jobId,
                'job_order_number' => $jobNo, 
                'total_sent' => $totalSent
            ], "Embroidery job order created successfully", 201);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function receiveEmbroideryJobOrder(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $jId = (int)($data['job_order_id'] ?? 0);
            $recNo = 'EMB-INW-' . rand(1000, 9999);
            $items = $data['items'] ?? [];
            $recTotal = array_reduce($items, fn($s, $i) => $s + (float)($i['received_quantity'] ?? 0), 0.0);
            $accTotal = array_reduce($items, fn($s, $i) => $s + (float)($i['accepted_quantity'] ?? 0), 0.0);
            $rejTotal = array_reduce($items, fn($s, $i) => $s + (float)($i['rejected_quantity'] ?? 0), 0.0);
            $rwkTotal = array_reduce($items, fn($s, $i) => $s + (float)($i['rework_quantity'] ?? 0), 0.0);

            if ($jId <= 0 || $recTotal <= 0) {
                Response::error("Job order ID and positive received quantity are required", 422);
                return;
            }

            $jStmt = $pdo->prepare("SELECT * FROM embroidery_job_orders WHERE id = ?");
            $jStmt->execute([$jId]);
            $job = $jStmt->fetch();
            if (!$job) { Response::error("Job order not found", 404); return; }

            // Insert receipt
            $stmt = $pdo->prepare("INSERT INTO embroidery_receipts 
                (receipt_number, job_order_id, production_order_id, vendor_name, receipt_date, vendor_challan_no, received_by, total_received_qty, total_accepted_qty, total_rejected_qty, total_rework_qty, remarks, photo_urls, items_data) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $recNo, 
                $jId, 
                $job['production_order_id'], 
                $job['vendor_name'], 
                $data['receipt_date'] ?? date('Y-m-d'), 
                $data['vendor_challan_no'] ?? '', 
                $data['received_by'] ?? '', 
                $recTotal, 
                $accTotal, 
                $rejTotal, 
                $rwkTotal, 
                $data['remarks'] ?? '', 
                json_encode($data['photo_urls'] ?? []), 
                json_encode($items)
            ]);

            // Update job order totals
            $newRec = (float)$job['total_quantity_received'] + $recTotal;
            $newAcc = (float)$job['total_quantity_accepted'] + $accTotal;
            $newRej = (float)$job['total_quantity_rejected'] + $rejTotal;
            $newRwk = (float)$job['total_quantity_rework'] + $rwkTotal;
            $sent = (float)$job['total_quantity_sent'];
            $newOut = max(0.0, $sent - $newRec);
            $newStatus = ($newOut <= 0.01) ? 'Completed' : 'Partially Received';

            $upd = $pdo->prepare("UPDATE embroidery_job_orders SET 
                total_quantity_received = ?, 
                total_quantity_accepted = ?, 
                total_quantity_rejected = ?, 
                total_quantity_rework = ?, 
                total_quantity_outstanding = ?,
                status = ?
                WHERE id = ?");
            $upd->execute([$newRec, $newAcc, $newRej, $newRwk, $newOut, $newStatus, $jId]);

            // Log to ledger
            foreach ($items as $it) {
                $itId = (int)($it['production_order_item_id'] ?? 0);
                $itAcc = (float)($it['accepted_quantity'] ?? 0);
                $itRej = (float)($it['rejected_quantity'] ?? 0);

                if ($itAcc > 0) {
                    $lStmt = $pdo->prepare("
                        INSERT INTO production_quantity_ledger 
                        (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                        VALUES (?, ?, 6, 'EMB', 'ACCEPTED', ?, ?, ?, ?, 'Embroidery Inward Receipt', ?, ?)
                    ");
                    $lStmt->execute([
                        $job['production_order_id'], 
                        $itId, 
                        $itAcc, 
                        $job['job_order_number'], 
                        $data['received_by'] ?? '', 
                        '', 
                        $recNo, 
                        "Inward accepted from {$job['vendor_name']}"
                    ]);
                }
                if ($itRej > 0) {
                    $lStmt = $pdo->prepare("
                        INSERT INTO production_quantity_ledger 
                        (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                        VALUES (?, ?, 6, 'EMB', 'REJECTED', ?, ?, ?, ?, 'Embroidery Inward Receipt', ?, ?)
                    ");
                    $lStmt->execute([
                        $job['production_order_id'], 
                        $itId, 
                        $itRej, 
                        $job['job_order_number'], 
                        $data['received_by'] ?? '', 
                        '', 
                        $recNo, 
                        "Rejected in embroidery QC"
                    ]);
                }
            }

            Response::success([
                'receipt_number' => $recNo,
                'received_qty' => $recTotal,
                'accepted_qty' => $accTotal,
                'outstanding_qty' => $newOut,
                'status' => $newStatus
            ], "Embroidery inward recorded successfully", 201);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function transferEmbroideryOutput(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $pId = (int)($data['production_order_id'] ?? 0);
            $qty = (float)($data['transfer_quantity'] ?? 0);
            $destStageId = (int)($data['destination_stage_id'] ?? 7);
            $destName = trim($data['destination_stage_name'] ?? 'Stitching — Color-wise Tracking');
            $itemId = (int)($data['item_id'] ?? 0);
            $remarks = trim($data['remarks'] ?? 'Transferred completed embroidery to Stitching');

            if ($pId <= 0 || $qty <= 0) {
                Response::error("Production order ID and positive transfer quantity are required", 422);
                return;
            }

            $pdo->beginTransaction();

            // Find item at stage 6
            $item = null;
            if ($itemId > 0) {
                $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE id = ?");
                $iStmt->execute([$itemId]);
                $item = $iStmt->fetch();
            }
            if (!$item || (int)$item['current_stage_id'] !== 6) {
                $fStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? AND current_stage_id = 6 LIMIT 1");
                $fStmt->execute([$pId]);
                $item = $fStmt->fetch();
            }
            if (!$item) {
                $fStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? LIMIT 1");
                $fStmt->execute([$pId]);
                $item = $fStmt->fetch();
            }

            if ($item) {
                $curStageQty = (float)($item['current_stage_quantity'] ?? 0);
                if ($qty >= $curStageQty && $curStageQty > 0) {
                    $pdo->prepare("UPDATE production_order_items SET current_stage_id = ? WHERE id = ?")
                        ->execute([$destStageId, $item['id']]);
                } else {
                    $remQty = max(0.0, $curStageQty - $qty);
                    $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = ? WHERE id = ?")
                        ->execute([$remQty, $item['id']]);

                    $sStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? AND product_id = ? AND color = ? AND current_stage_id = ?");
                    $sStmt->execute([$pId, $item['product_id'], $item['color'], $destStageId]);
                    $stitchingItem = $sStmt->fetch();

                    if ($stitchingItem) {
                        $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = current_stage_quantity + ?, total_quantity = total_quantity + ? WHERE id = ?")
                            ->execute([$qty, $qty, $stitchingItem['id']]);
                    } else {
                        $ins = $pdo->prepare("INSERT INTO production_order_items 
                            (production_order_id, product_id, color, total_quantity, current_stage_id, current_stage_quantity, completed_quantity, rejected_quantity, rework_quantity, status) 
                            VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 'In Progress')");
                        $ins->execute([$pId, $item['product_id'], $item['color'], $qty, $destStageId, $qty]);
                    }
                }
            }

            // Log stage transaction
            $tStmt = $pdo->prepare("
                INSERT INTO production_stage_transactions (production_order_item_id, from_stage_id, to_stage_id, quantity_moved, remarks)
                VALUES (?, 6, ?, ?, ?)
            ");
            $tStmt->execute([$item['id'] ?? 0, $destStageId, $qty, $remarks]);

            // Log quantity ledger
            $lStmt = $pdo->prepare("
                INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 6, 'EMB', 'TRANSFER_OUT', ?, '', ?, ?, 'Embroidery Transfer', ?, ?)
            ");
            $lStmt->execute([$pId, $item['id'] ?? 0, $qty, $data['operator_name'] ?? '', $data['supervisor_name'] ?? '', (string)$destStageId, "Transferred to {$destName}"]);

            $lStmtIn = $pdo->prepare("
                INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, ?, 'STI', 'TRANSFER_IN', ?, '', ?, ?, 'Embroidery Transfer', ?, ?)
            ");
            $lStmtIn->execute([$pId, $item['id'] ?? 0, $destStageId, $qty, $data['operator_name'] ?? '', $data['supervisor_name'] ?? '', (string)$destStageId, "Received from Embroidery"]);

            $pdo->commit();
            Response::success([
                'transferred_quantity' => $qty,
                'destination_stage_id' => $destStageId,
                'destination_stage_name' => $destName
            ], "Successfully transferred {$qty} pcs to {$destName}");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function vendorOutstandingEmbroidery(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);
            $stmt = $pdo->query("SELECT vendor_name, COUNT(*) as total_job_orders, SUM(total_quantity_sent) as total_sent, SUM(total_quantity_received) as total_received, SUM(total_quantity_outstanding) as total_outstanding FROM embroidery_job_orders GROUP BY vendor_name");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function stitchingOrders(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);
            $stmt = $pdo->query("SELECT po.*, cu.name as customer_name, (SELECT COUNT(*) FROM stitching_batches WHERE production_order_id = po.id) as batches_count FROM production_orders po LEFT JOIN customers cu ON po.customer_id = cu.id WHERE po.deleted_at IS NULL ORDER BY po.id DESC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function stitchingOrderDetails(int $orderId): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $ord = $pdo->query("SELECT po.*, cu.name as customer_name, cu.code as customer_code, cu.avatar_style as customer_avatar_style, cu.avatar_seed as customer_avatar_seed, cu.avatar_config as customer_avatar_config FROM production_orders po LEFT JOIN customers cu ON po.customer_id = cu.id WHERE po.id = {$orderId}")->fetch();
            if (!$ord) {
                Response::error("Production order not found", 404);
                return;
            }

            // All base items
            $iStmt = $pdo->prepare("
                SELECT poi.*, 
                       COALESCE(bp.product_name, p.name, 'Garment Product') as product_name,
                       COALESCE(bp.product_code, p.code, 'PRD') as product_code
                FROM production_order_items poi 
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id 
                LEFT JOIN products p ON poi.product_id = p.id 
                WHERE poi.production_order_id = ?
            ");
            $iStmt->execute([$orderId]);
            $rawItems = $iStmt->fetchAll();

            // Stitching batches
            $bStmt = $pdo->prepare("
                SELECT sb.*, 
                       COALESCE(bp.product_name, p.name, 'Garment Product') as product_name,
                       COALESCE(bp.product_code, p.code, 'PRD') as product_code,
                       poi.color
                FROM stitching_batches sb
                LEFT JOIN production_order_items poi ON sb.production_order_item_id = poi.id
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                LEFT JOIN products p ON poi.product_id = p.id
                WHERE sb.production_order_id = ?
                ORDER BY sb.id DESC
            ");
            $bStmt->execute([$orderId]);
            $batches = $bStmt->fetchAll();
            foreach ($batches as &$b) {
                if (isset($b['photo_urls']) && is_string($b['photo_urls'])) {
                    $b['photo_urls'] = json_decode($b['photo_urls'], true) ?: [];
                }
            }
            unset($b);

            // Cutting batches
            $cStmt = $pdo->prepare("SELECT * FROM cutting_batches WHERE production_order_id = ?");
            $cStmt->execute([$orderId]);
            $cuttingBatches = $cStmt->fetchAll();

            // Embroidery job orders and receipts
            $ejStmt = $pdo->prepare("SELECT * FROM embroidery_job_orders WHERE production_order_id = ?");
            $ejStmt->execute([$orderId]);
            $embJobs = $ejStmt->fetchAll();
            foreach ($embJobs as &$ej) {
                if (isset($ej['items_json']) && is_string($ej['items_json'])) {
                    $ej['items_json'] = json_decode($ej['items_json'], true) ?: [];
                }
            }
            unset($ej);

            $erStmt = $pdo->prepare("SELECT * FROM embroidery_receipts WHERE production_order_id = ?");
            $erStmt->execute([$orderId]);
            $embReceipts = $erStmt->fetchAll();
            foreach ($embReceipts as &$er) {
                if (isset($er['items_data']) && is_string($er['items_data'])) {
                    $er['items_data'] = json_decode($er['items_data'], true) ?: [];
                }
            }
            unset($er);

            // Group items by product_id and color
            $groupedItems = [];
            foreach ($rawItems as $rawIt) {
                $grpKey = $rawIt['product_id'] . '_' . trim((string)($rawIt['color'] ?? ''));
                if (!isset($groupedItems[$grpKey])) {
                    $groupedItems[$grpKey] = $rawIt;
                    $groupedItems[$grpKey]['order_quantity'] = (float)$rawIt['total_quantity'];
                    $groupedItems[$grpKey]['active_stitching_item_id'] = (int)$rawIt['id'];
                    $groupedItems[$grpKey]['current_stage_quantity'] = ((int)$rawIt['current_stage_id'] === 7) ? (float)$rawIt['current_stage_quantity'] : 0.0;
                } else {
                    $groupedItems[$grpKey]['order_quantity'] += (float)$rawIt['total_quantity'];
                    if ((int)$rawIt['current_stage_id'] === 7) {
                        $groupedItems[$grpKey]['current_stage_quantity'] += (float)$rawIt['current_stage_quantity'];
                        $groupedItems[$grpKey]['active_stitching_item_id'] = (int)$rawIt['id'];
                    }
                }
            }

            // Calculate arriving quantities from Cutting & Embroidery, and stitched quantities
            foreach ($groupedItems as &$gIt) {
                $pId = (int)$gIt['product_id'];
                $color = trim((string)($gIt['color'] ?? ''));

                // 1. Arrived from Cutting directly to Stitching (destination_stage_id = 7)
                $arrivedFromCutting = 0.0;
                foreach ($cuttingBatches as $cb) {
                    $cbDest = (int)($cb['destination_stage_id'] ?? 6);
                    if ($cbDest === 7) {
                        if ((int)$cb['product_id'] === $pId && trim((string)($cb['color'] ?? '')) === $color) {
                            $arrivedFromCutting += (float)($cb['transferred_quantity'] > 0 ? $cb['transferred_quantity'] : $cb['actual_cut_quantity']);
                        }
                    }
                }

                // 2. Arrived from Embroidery (accepted pieces transferred to Stitching)
                $arrivedFromEmbroidery = 0.0;
                foreach ($embReceipts as $rcpt) {
                    $rItems = $rcpt['items_data'] ?? [];
                    foreach ($rItems as $ri) {
                        $m = false;
                        if (!empty($ri['product_id']) && (int)$ri['product_id'] === $pId && trim((string)($ri['color'] ?? '')) === $color) $m = true;
                        if ($m) {
                            $arrivedFromEmbroidery += (float)($ri['accepted_quantity'] ?? 0);
                        }
                    }
                }
                // Fallback check job orders accepted
                if ($arrivedFromEmbroidery <= 0) {
                    foreach ($embJobs as $job) {
                        $jItems = $job['items_json'] ?? [];
                        foreach ($jItems as $ji) {
                            if (!empty($ji['product_id']) && (int)$ji['product_id'] === $pId && trim((string)($ji['color'] ?? '')) === $color) {
                                $arrivedFromEmbroidery += (float)($ji['received_quantity'] ?? $ji['quantity_sent'] ?? 0);
                            }
                        }
                    }
                }

                // Total Arrived at Stitching
                $totalArrived = $arrivedFromCutting + $arrivedFromEmbroidery;
                if ($totalArrived <= 0 && $gIt['current_stage_quantity'] > 0) {
                    $totalArrived = (float)$gIt['current_stage_quantity'];
                }

                // 3. Stitched batches recorded
                $stitchedComp = 0.0;
                $stitchedAcc = 0.0;
                $stitchedRej = 0.0;
                $stitchedRwk = 0.0;
                $stitchedTrans = 0.0;
                foreach ($batches as &$b) {
                    $bAcc = (float)($b['accepted_quantity'] ?? 0);
                    $bTrans = (float)($b['transferred_quantity'] ?? 0);
                    $isTr = ($b['status'] === 'Transferred to Checking' || ($bTrans > 0 && $bTrans >= $bAcc));
                    $b['is_transferred'] = $isTr;
                    if ($isTr) {
                        $b['status'] = 'Transferred to Checking';
                    }

                    $m = false;
                    if ((int)$b['production_order_item_id'] === (int)$gIt['active_stitching_item_id']) $m = true;
                    if (trim((string)($b['color'] ?? '')) === $color) $m = true;
                    if ($m) {
                        $stitchedComp += (float)($b['completed_quantity'] ?? 0);
                        $stitchedAcc += $bAcc;
                        $stitchedRej += (float)($b['rejected_quantity'] ?? 0);
                        $stitchedRwk += (float)($b['rework_quantity'] ?? 0);
                        if ($isTr) {
                            $stitchedTrans += ($bTrans > 0 ? $bTrans : $bAcc);
                        }
                    }
                }
                unset($b);

                // Check ledger for transfers out to Stage 8
                $lStmtOut = $pdo->prepare("
                    SELECT COALESCE(SUM(quantity), 0) 
                    FROM production_quantity_ledger 
                    WHERE production_order_id = ? AND stage_id = 7 AND (transaction_type = 'TRANSFER_OUT' OR reference_type = 'Stitching Transfer')
                      AND (production_order_item_id = ? OR remarks LIKE ?)
                ");
                $lStmtOut->execute([$orderId, $gIt['active_stitching_item_id'], "%{$color}%"]);
                $ledgerOutQty = (float)$lStmtOut->fetchColumn();

                $transferredToChecking = max($stitchedTrans, $ledgerOutQty);

                $gIt['arrived_from_cutting'] = $arrivedFromCutting;
                $gIt['arrived_from_embroidery'] = $arrivedFromEmbroidery;
                $gIt['total_arrived'] = $totalArrived;
                $gIt['completed_quantity'] = $stitchedComp;
                $gIt['accepted_quantity'] = $stitchedAcc;
                $gIt['rejected_quantity'] = $stitchedRej;
                $gIt['rework_quantity'] = $stitchedRwk;
                $gIt['transferred_to_checking'] = $transferredToChecking;
                $gIt['available_to_stitch'] = max(0.0, $totalArrived - $stitchedComp);
                $gIt['assigned_quantity'] = $gIt['available_to_stitch'];
                $gIt['pending_stitching'] = max(0.0, $totalArrived - $stitchedComp);
                $gIt['ready_to_transfer'] = max(0.0, $stitchedAcc - $transferredToChecking);
            }
            unset($gIt);

            $items = array_values($groupedItems);

            Response::success([
                'order' => $ord,
                'items' => $items,
                'batches' => $batches
            ]);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function createStitchingBatch(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $pId = (int)($data['production_order_id'] ?? 0);
            $itemId = (int)($data['production_order_item_id'] ?? 0);
            $assigned = (float)($data['assigned_quantity'] ?? 0);
            $comp = (float)($data['completed_quantity'] ?? 0);
            $rej = (float)($data['rejected_quantity'] ?? 0);
            $rwk = (float)($data['rework_quantity'] ?? 0);
            $acc = max(0.0, $comp - $rej - $rwk);
            $batchNo = 'STI-' . rand(1000, 9999);

            if ($pId <= 0) {
                Response::error("Production order ID is required", 422);
                return;
            }
            if ($comp <= 0) {
                Response::error("Completed quantity must be greater than zero", 422);
                return;
            }

            // Clean defaults for removed operator/machine/supervisor fields
            $operatorTeam = trim($data['operator_team'] ?? 'Stitching Line #1');
            $prodLine = trim($data['production_line'] ?? 'Direct Drive Machine Line');
            $supervisor = trim($data['supervisor'] ?? 'Sewing Floor Head');
            $startDate = !empty($data['start_date']) ? $data['start_date'] : date('Y-m-d');
            $compDate = !empty($data['completion_date']) ? $data['completion_date'] : date('Y-m-d');
            $remarks = trim($data['remarks'] ?? '');
            $photoUrls = json_encode($data['photo_urls'] ?? []);

            $stmt = $pdo->prepare("INSERT INTO stitching_batches 
                (production_order_id, production_order_item_id, batch_number, assigned_quantity, received_quantity, completed_quantity, accepted_quantity, rejected_quantity, rework_quantity, balance_quantity, operator_team, production_line, start_date, completion_date, supervisor, remarks, photo_urls) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $pId, 
                $itemId, 
                $batchNo, 
                $assigned > 0 ? $assigned : $comp, 
                $assigned > 0 ? $assigned : $comp, 
                $comp, 
                $acc, 
                $rej, 
                $rwk, 
                $operatorTeam, 
                $prodLine, 
                $startDate, 
                $compDate, 
                $supervisor, 
                $remarks, 
                $photoUrls
            ]);
            $bId = (int)$pdo->lastInsertId();

            // Log to quantity ledger
            $lStmt = $pdo->prepare("
                INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 7, 'STI', 'PROCESSED', ?, ?, ?, ?, 'Stitching Output', ?, ?)
            ");
            $lStmt->execute([$pId, $itemId, $comp, $batchNo, $operatorTeam, $supervisor, (string)$bId, $remarks]);

            if ($acc > 0) {
                $lStmtAcc = $pdo->prepare("
                    INSERT INTO production_quantity_ledger 
                    (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                    VALUES (?, ?, 7, 'STI', 'ACCEPTED', ?, ?, ?, ?, 'Stitching Passed', ?, ?)
                ");
                $lStmtAcc->execute([$pId, $itemId, $acc, $batchNo, $operatorTeam, $supervisor, (string)$bId, "Passed stitching QC"]);
            }

            Response::success([
                'id' => $bId,
                'batch_number' => $batchNo,
                'assigned' => $assigned,
                'completed' => $comp,
                'accepted' => $acc,
                'rejected' => $rej,
                'rework' => $rwk
            ], "Stitching batch recorded successfully", 201);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function transferStitchingOutput(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $bId = (int)($data['batch_id'] ?? 0);
            $pId = (int)($data['production_order_id'] ?? 0);
            $itemId = (int)($data['item_id'] ?? 0);
            $qty = (float)($data['transfer_quantity'] ?? 0);
            $destStageId = 8; // Stage 08: Checking
            $remarks = trim($data['remarks'] ?? 'Transferred completed stitching to Stage 08: Checking');

            if ($bId > 0) {
                $bStmt = $pdo->prepare("SELECT * FROM stitching_batches WHERE id = ?");
                $bStmt->execute([$bId]);
                $b = $bStmt->fetch();
                if ($b) {
                    $pId = (int)$b['production_order_id'];
                    $itemId = (int)$b['production_order_item_id'];
                    if ($qty <= 0) $qty = (float)$b['accepted_quantity'];
                }
            }

            if ($pId <= 0 || $qty <= 0) {
                Response::error("Production order ID and positive transfer quantity are required", 422);
                return;
            }

            $pdo->beginTransaction();

            // Find item strictly belonging to this production order
            $item = null;
            if ($itemId > 0) {
                $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE id = ? AND production_order_id = ?");
                $iStmt->execute([$itemId, $pId]);
                $item = $iStmt->fetch();
            }
            if (!$item) {
                $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? AND (current_stage_id = 7 OR current_stage_id = 6) ORDER BY id DESC LIMIT 1");
                $iStmt->execute([$pId]);
                $item = $iStmt->fetch();
            }
            if (!$item) {
                $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? ORDER BY id DESC LIMIT 1");
                $iStmt->execute([$pId]);
                $item = $iStmt->fetch();
            }

            if ($item) {
                $chkStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? AND product_id = ? AND color = ? AND current_stage_id = 8");
                $chkStmt->execute([$pId, $item['product_id'], $item['color']]);
                $checkingItem = $chkStmt->fetch();

                $curQty = (float)$item['current_stage_quantity'];
                $isFullMove = ($curQty <= $qty + 0.001);

                if ($checkingItem) {
                    // Add moved quantity to existing checking item
                    $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = current_stage_quantity + ?, total_quantity = total_quantity + ? WHERE id = ?")
                        ->execute([$qty, $qty, $checkingItem['id']]);

                    if ($isFullMove) {
                        $pdo->prepare("DELETE FROM production_order_items WHERE id = ?")->execute([$item['id']]);
                    } else {
                        $remQty = $curQty - $qty;
                        $remTotal = max($remQty, (float)$item['total_quantity'] - $qty);
                        $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = ?, total_quantity = ? WHERE id = ?")
                            ->execute([$remQty, $remTotal, $item['id']]);
                    }
                } else {
                    if ($isFullMove) {
                        // Advance the existing item to Stage 8
                        $pdo->prepare("UPDATE production_order_items SET current_stage_id = 8, current_stage_quantity = ?, status = 'In Progress' WHERE id = ?")
                            ->execute([$qty, $item['id']]);
                    } else {
                        // Partial move: deduct from source and insert new row for destination
                        $remQty = $curQty - $qty;
                        $remTotal = max($remQty, (float)$item['total_quantity'] - $qty);
                        $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = ?, total_quantity = ? WHERE id = ?")
                            ->execute([$remQty, $remTotal, $item['id']]);

                        $ins = $pdo->prepare("INSERT INTO production_order_items 
                            (production_order_id, product_id, color, total_quantity, current_stage_id, current_stage_quantity, completed_quantity, rejected_quantity, rework_quantity, status) 
                            VALUES (?, ?, ?, ?, 8, ?, 0, 0, 0, 'In Progress')");
                        $ins->execute([$pId, $item['product_id'], $item['color'], $qty, $qty]);
                    }
                }
            }

            // Update batch status to Transferred
            if ($bId > 0) {
                $pdo->prepare("UPDATE stitching_batches SET status = 'Transferred to Checking', transferred_quantity = ? WHERE id = ?")
                    ->execute([$qty, $bId]);
            } else if ($item) {
                $pdo->prepare("UPDATE stitching_batches SET status = 'Transferred to Checking', transferred_quantity = accepted_quantity WHERE production_order_id = ? AND (production_order_item_id = ? OR color = ?)")
                    ->execute([$pId, $item['id'], $item['color']]);
            }

            $realItemId = $item ? (int)$item['id'] : $itemId;

            $tStmt = $pdo->prepare("INSERT INTO production_stage_transactions (production_order_item_id, from_stage_id, to_stage_id, quantity_moved, remarks) VALUES (?, 7, 8, ?, ?)");
            $tStmt->execute([$realItemId, $qty, $remarks]);

            $lStmtOut = $pdo->prepare("INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 7, 'STI', 'TRANSFER_OUT', ?, '', '', '', 'Stitching Transfer', '8', ?)");
            $lStmtOut->execute([$pId, $realItemId, $qty, "Transferred to Stage 08: Checking"]);

            $lStmtIn = $pdo->prepare("INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 8, 'CHK', 'TRANSFER_IN', ?, '', '', '', 'Stitching Transfer', '8', ?)");
            $lStmtIn->execute([$pId, $realItemId, $qty, "Received from Stitching"]);

            $pdo->commit();
            Response::success([
                'transferred_quantity' => $qty,
                'destination_stage_id' => 8,
                'destination_stage_name' => 'Checking'
            ], "Successfully transferred {$qty} pcs to Stage 08: Checking");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function checkingOrders(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);
            $stmt = $pdo->query("SELECT po.*, cu.name as customer_name, (SELECT COUNT(*) FROM quality_inspections WHERE production_order_id = po.id) as inspections_count FROM production_orders po LEFT JOIN customers cu ON po.customer_id = cu.id WHERE po.deleted_at IS NULL ORDER BY po.id DESC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function checkingOrderDetails(int $orderId): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $ord = $pdo->query("SELECT po.*, cu.name as customer_name, cu.code as customer_code, cu.avatar_style as customer_avatar_style, cu.avatar_seed as customer_avatar_seed, cu.avatar_config as customer_avatar_config FROM production_orders po LEFT JOIN customers cu ON po.customer_id = cu.id WHERE po.id = {$orderId}")->fetch();
            if (!$ord) {
                Response::error("Production order not found", 404);
                return;
            }

            // All base items
            $iStmt = $pdo->prepare("
                SELECT poi.*, 
                       COALESCE(bp.product_name, p.name, 'Garment Product') as product_name,
                       COALESCE(bp.product_code, p.code, 'PRD') as product_code
                FROM production_order_items poi 
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id 
                LEFT JOIN products p ON poi.product_id = p.id 
                WHERE poi.production_order_id = ?
            ");
            $iStmt->execute([$orderId]);
            $rawItems = $iStmt->fetchAll();

            // Stitching batches (to know accepted stitching output)
            $sbStmt = $pdo->prepare("
                SELECT sb.*, poi.color 
                FROM stitching_batches sb 
                LEFT JOIN production_order_items poi ON sb.production_order_item_id = poi.id 
                WHERE sb.production_order_id = ?
            ");
            $sbStmt->execute([$orderId]);
            $stitchingBatches = $sbStmt->fetchAll();

            // Quality inspections
            $qiStmt = $pdo->prepare("
                SELECT qi.*, 
                       COALESCE(bp.product_name, p.name, 'Garment Product') as product_name,
                       COALESCE(bp.product_code, p.code, 'PRD') as product_code,
                       poi.color
                FROM quality_inspections qi
                LEFT JOIN production_order_items poi ON qi.production_order_item_id = poi.id
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                LEFT JOIN products p ON poi.product_id = p.id
                WHERE qi.production_order_id = ?
                ORDER BY qi.id DESC
            ");
            $qiStmt->execute([$orderId]);
            $inspections = $qiStmt->fetchAll();
            foreach ($inspections as &$ins) {
                if (isset($ins['photo_urls']) && is_string($ins['photo_urls'])) {
                    $ins['photo_urls'] = json_decode($ins['photo_urls'], true) ?: [];
                }
                $iPass = (float)($ins['passed_quantity'] ?? 0);
                $iTrans = (float)($ins['transferred_quantity'] ?? 0);
                $isTr = ($ins['status'] === 'Transferred to Packing' || ($iTrans > 0 && $iTrans >= $iPass));
                $ins['is_transferred'] = $isTr;
                if ($isTr) {
                    $ins['status'] = 'Transferred to Packing';
                }
            }
            unset($ins);

            // Group items by product_id and color
            $groupedItems = [];
            foreach ($rawItems as $rawIt) {
                $grpKey = $rawIt['product_id'] . '_' . trim((string)($rawIt['color'] ?? ''));
                if (!isset($groupedItems[$grpKey])) {
                    $groupedItems[$grpKey] = $rawIt;
                    $groupedItems[$grpKey]['order_quantity'] = (float)$rawIt['total_quantity'];
                    $groupedItems[$grpKey]['active_checking_item_id'] = (int)$rawIt['id'];
                    $groupedItems[$grpKey]['current_stage_quantity'] = ((int)$rawIt['current_stage_id'] === 8) ? (float)$rawIt['current_stage_quantity'] : 0.0;
                } else {
                    $groupedItems[$grpKey]['order_quantity'] += (float)$rawIt['total_quantity'];
                    if ((int)$rawIt['current_stage_id'] === 8) {
                        $groupedItems[$grpKey]['current_stage_quantity'] += (float)$rawIt['current_stage_quantity'];
                        $groupedItems[$grpKey]['active_checking_item_id'] = (int)$rawIt['id'];
                    }
                }
            }

            // Ledger transfers into Stage 8
            $lStmt = $pdo->prepare("
                SELECT production_order_item_id, SUM(quantity) as qty 
                FROM production_quantity_ledger 
                WHERE production_order_id = ? AND stage_id = 8 AND transaction_type = 'TRANSFER_IN' 
                GROUP BY production_order_item_id
            ");
            $lStmt->execute([$orderId]);
            $ledgerIn = $lStmt->fetchAll(PDO::FETCH_KEY_PAIR);

            // Calculate arriving quantities from Stitching and inspection totals
            foreach ($groupedItems as &$gIt) {
                $pId = (int)$gIt['product_id'];
                $color = trim((string)($gIt['color'] ?? ''));
                $itemId = (int)$gIt['active_checking_item_id'];

                // 1. Arrived from Stitching
                $fromStitching = 0.0;
                foreach ($stitchingBatches as $sb) {
                    $cMatch = trim((string)($sb['color'] ?? ''));
                    if ($cMatch === $color || (int)$sb['production_order_item_id'] === $itemId) {
                        $fromStitching += (float)($sb['accepted_quantity'] ?? 0);
                    }
                }

                if (isset($ledgerIn[$itemId])) {
                    $fromStitching = max($fromStitching, (float)$ledgerIn[$itemId]);
                }
                if ($gIt['current_stage_quantity'] > 0) {
                    $fromStitching = max($fromStitching, (float)$gIt['current_stage_quantity']);
                }

                // 2. Tally quality inspections
                $checked = 0.0;
                $passed = 0.0;
                $rejected = 0.0;
                $rework = 0.0;
                $insTransferred = 0.0;
                foreach ($inspections as $ins) {
                    $cMatch = trim((string)($ins['color'] ?? ''));
                    if ($cMatch === $color || (int)$ins['production_order_item_id'] === $itemId) {
                        $checked += (float)($ins['checked_quantity'] ?? $ins['submitted_quantity'] ?? 0);
                        $passed += (float)($ins['passed_quantity'] ?? 0);
                        $rejected += (float)($ins['rejected_quantity'] ?? 0);
                        $rework += (float)($ins['rework_quantity'] ?? 0);
                        if (!empty($ins['is_transferred']) || $ins['status'] === 'Transferred to Packing') {
                            $tQty = (float)($ins['transferred_quantity'] ?? 0);
                            $insTransferred += ($tQty > 0 ? $tQty : (float)$ins['passed_quantity']);
                        }
                    }
                }

                // Check ledger for transfers out to Stage 9
                $lStmtOut9 = $pdo->prepare("
                    SELECT COALESCE(SUM(quantity), 0) 
                    FROM production_quantity_ledger 
                    WHERE production_order_id = ? AND stage_id = 8 AND (transaction_type = 'TRANSFER_OUT' OR reference_type = 'Checking Transfer')
                      AND (production_order_item_id = ? OR remarks LIKE ?)
                ");
                $lStmtOut9->execute([$orderId, $itemId, "%{$color}%"]);
                $ledgerOut9Qty = (float)$lStmtOut9->fetchColumn();

                $transferredToPacking = max($insTransferred, $ledgerOut9Qty);

                $gIt['arrived_from_stitching'] = $fromStitching;
                $gIt['total_arrived'] = $fromStitching;
                $gIt['checked_quantity'] = $checked;
                $gIt['passed_quantity'] = $passed;
                $gIt['rejected_quantity'] = $rejected;
                $gIt['rework_quantity'] = $rework;
                $gIt['failed_quantity'] = $rejected + $rework;
                $gIt['transferred_to_packing'] = $transferredToPacking;
                $gIt['available_to_inspect'] = max(0.0, $fromStitching - $checked);
                $gIt['pending_inspection'] = max(0.0, $fromStitching - $checked);
                $gIt['ready_to_pack'] = max(0.0, $passed - $transferredToPacking);
                $gIt['pass_rate'] = $checked > 0 ? round(($passed / $checked) * 100, 1) : 100.0;
            }
            unset($gIt);

            $items = array_values($groupedItems);

            Response::success([
                'order' => $ord,
                'items' => $items,
                'inspections' => $inspections
            ]);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function recordQualityInspection(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $pId = (int)($data['production_order_id'] ?? 0);
            $itemId = (int)($data['production_order_item_id'] ?? 0);
            $sub = (float)($data['submitted_quantity'] ?? 0);
            $checked = (float)($data['checked_quantity'] ?? $sub);
            $rej = (float)($data['rejected_quantity'] ?? 0);
            $rwk = (float)($data['rework_quantity'] ?? 0);
            $failed = (float)($data['failed_quantity'] ?? ($rej + $rwk));
            $passed = (float)($data['passed_quantity'] ?? 0);
            if ($passed <= 0 && $checked > 0) {
                $passed = max(0.0, $checked - $rej - $rwk);
            }

            if ($checked <= 0) {
                Response::error("Checked quantity must be greater than zero", 422);
                return;
            }

            $batchNo = 'CHK-' . rand(1000, 9999);
            $stmt = $pdo->prepare("
                INSERT INTO quality_inspections 
                (production_order_id, production_order_item_id, batch_number, submitted_quantity, checked_quantity, passed_quantity, failed_quantity, rework_quantity, rejected_quantity, defect_category, defect_description, inspector, inspection_date, remarks, photo_urls) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $pId, 
                $itemId, 
                $batchNo, 
                $sub > 0 ? $sub : $checked, 
                $checked, 
                $passed, 
                $failed, 
                $rwk, 
                $rej, 
                $data['defect_category'] ?? 'Finishing & Seams', 
                $data['defect_description'] ?? '', 
                $data['inspector'] ?? 'Lead QC Inspector', 
                $data['inspection_date'] ?? date('Y-m-d'), 
                $data['remarks'] ?? '', 
                json_encode($data['photo_urls'] ?? [])
            ]);
            $insId = (int)$pdo->lastInsertId();

            // Log to quantity ledger
            $lStmt = $pdo->prepare("
                INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 8, 'CHK', 'INSPECTED', ?, ?, '', ?, 'Quality Inspection', ?, ?)
            ");
            $lStmt->execute([$pId, $itemId, $checked, $batchNo, $data['inspector'] ?? 'Inspector', (string)$insId, $data['remarks'] ?? '']);

            if ($passed > 0) {
                $lStmtPass = $pdo->prepare("
                    INSERT INTO production_quantity_ledger 
                    (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                    VALUES (?, ?, 8, 'CHK', 'PASSED', ?, ?, '', ?, 'Quality Passed', ?, 'Passed quality audit')
                ");
                $lStmtPass->execute([$pId, $itemId, $passed, $batchNo, $data['inspector'] ?? 'Inspector', (string)$insId]);
            }

            Response::success([
                'id' => $insId,
                'batch_number' => $batchNo,
                'checked' => $checked,
                'passed' => $passed,
                'rejected' => $rej,
                'rework' => $rwk
            ], "Quality inspection recorded successfully", 201);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function transferCheckingOutput(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $insId = (int)($data['inspection_id'] ?? 0);
            $pId = (int)($data['production_order_id'] ?? 0);
            $itemId = (int)($data['item_id'] ?? 0);
            $qty = (float)($data['transfer_quantity'] ?? 0);
            $remarks = trim($data['remarks'] ?? 'Transferred passed inspection output to Stage 09: Packing');

            if ($insId > 0) {
                $qStmt = $pdo->prepare("SELECT * FROM quality_inspections WHERE id = ?");
                $qStmt->execute([$insId]);
                $insRow = $qStmt->fetch();
                if ($insRow) {
                    $pId = (int)$insRow['production_order_id'];
                    $itemId = (int)$insRow['production_order_item_id'];
                    if ($qty <= 0) $qty = (float)$insRow['passed_quantity'];
                }
            }

            if ($pId <= 0 || $qty <= 0) {
                Response::error("Production order ID and positive transfer quantity are required", 422);
                return;
            }

            $pdo->beginTransaction();

            // Find item strictly belonging to this production order
            $item = null;
            if ($itemId > 0) {
                $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE id = ? AND production_order_id = ?");
                $iStmt->execute([$itemId, $pId]);
                $item = $iStmt->fetch();
            }
            if (!$item) {
                $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? AND current_stage_id = 8 ORDER BY id DESC LIMIT 1");
                $iStmt->execute([$pId]);
                $item = $iStmt->fetch();
            }
            if (!$item) {
                $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? ORDER BY id DESC LIMIT 1");
                $iStmt->execute([$pId]);
                $item = $iStmt->fetch();
            }

            if ($item) {
                $pckStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? AND product_id = ? AND color = ? AND current_stage_id = 9");
                $pckStmt->execute([$pId, $item['product_id'], $item['color']]);
                $packingItem = $pckStmt->fetch();

                $curQty = (float)$item['current_stage_quantity'];
                $isFullMove = ($curQty <= $qty + 0.001);

                if ($packingItem) {
                    $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = current_stage_quantity + ?, total_quantity = total_quantity + ? WHERE id = ?")
                        ->execute([$qty, $qty, $packingItem['id']]);

                    if ($isFullMove) {
                        $pdo->prepare("DELETE FROM production_order_items WHERE id = ?")->execute([$item['id']]);
                    } else {
                        $remQty = $curQty - $qty;
                        $remTotal = max($remQty, (float)$item['total_quantity'] - $qty);
                        $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = ?, total_quantity = ? WHERE id = ?")
                            ->execute([$remQty, $remTotal, $item['id']]);
                    }
                } else {
                    if ($isFullMove) {
                        $pdo->prepare("UPDATE production_order_items SET current_stage_id = 9, current_stage_quantity = ?, status = 'In Progress' WHERE id = ?")
                            ->execute([$qty, $item['id']]);
                    } else {
                        $remQty = $curQty - $qty;
                        $remTotal = max($remQty, (float)$item['total_quantity'] - $qty);
                        $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = ?, total_quantity = ? WHERE id = ?")
                            ->execute([$remQty, $remTotal, $item['id']]);

                        $ins = $pdo->prepare("INSERT INTO production_order_items 
                            (production_order_id, product_id, color, total_quantity, current_stage_id, current_stage_quantity, completed_quantity, rejected_quantity, rework_quantity, status) 
                            VALUES (?, ?, ?, ?, 9, ?, 0, 0, 0, 'In Progress')");
                        $ins->execute([$pId, $item['product_id'], $item['color'], $qty, $qty]);
                    }
                }
            }

            // Update inspection status to Transferred
            if ($insId > 0) {
                $pdo->prepare("UPDATE quality_inspections SET status = 'Transferred to Packing', transferred_quantity = ? WHERE id = ?")
                    ->execute([$qty, $insId]);
            } else if ($item) {
                $mStmt = $pdo->prepare("SELECT id FROM production_order_items WHERE production_order_id = ? AND (id = ? OR (color = ? AND product_id = ?))");
                $mStmt->execute([$pId, $item['id'], $item['color'], $item['product_id']]);
                $matchedIds = $mStmt->fetchAll(PDO::FETCH_COLUMN);

                if (!empty($matchedIds)) {
                    $inPlaceholders = implode(',', array_fill(0, count($matchedIds), '?'));
                    $pdo->prepare("UPDATE quality_inspections SET status = 'Transferred to Packing', transferred_quantity = passed_quantity WHERE production_order_id = ? AND (production_order_item_id IN ($inPlaceholders) OR color = ?)")
                        ->execute(array_merge([$pId], $matchedIds, [$item['color']]));
                } else {
                    $pdo->prepare("UPDATE quality_inspections SET status = 'Transferred to Packing', transferred_quantity = passed_quantity WHERE production_order_id = ? AND (production_order_item_id = ? OR color = ?)")
                        ->execute([$pId, $item['id'], $item['color']]);
                }
            }

            $realItemId = $item ? (int)$item['id'] : $itemId;

            $tStmt = $pdo->prepare("INSERT INTO production_stage_transactions (production_order_item_id, from_stage_id, to_stage_id, quantity_moved, remarks) VALUES (?, 8, 9, ?, ?)");
            $tStmt->execute([$realItemId, $qty, $remarks]);

            $lStmtOut = $pdo->prepare("INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 8, 'CHK', 'TRANSFER_OUT', ?, '', '', '', 'Checking Transfer', '9', ?)");
            $lStmtOut->execute([$pId, $realItemId, $qty, "Transferred to Stage 09: Packing"]);

            $lStmtIn = $pdo->prepare("INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 9, 'PCK', 'TRANSFER_IN', ?, '', '', '', 'Checking Transfer', '9', ?)");
            $lStmtIn->execute([$pId, $realItemId, $qty, "Received from Checking"]);

            $pdo->commit();
            Response::success([
                'transferred_quantity' => $qty,
                'destination_stage_id' => 9,
                'destination_stage_name' => 'Packing'
            ], "Successfully transferred {$qty} pcs to Stage 09: Packing");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function packingOrders(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);
            $stmt = $pdo->query("
                SELECT DISTINCT po.*, cu.name as customer_name,
                       (SELECT COUNT(*) FROM packing_batches WHERE production_order_id = po.id) as batches_count,
                       (SELECT COUNT(*) FROM packing_cartons WHERE production_order_id = po.id) as cartons_count
                FROM production_orders po 
                LEFT JOIN customers cu ON po.customer_id = cu.id 
                WHERE po.deleted_at IS NULL 
                  AND (
                    EXISTS (SELECT 1 FROM production_order_items WHERE production_order_id = po.id AND current_stage_id = 9)
                    OR EXISTS (SELECT 1 FROM production_quantity_ledger WHERE production_order_id = po.id AND stage_id = 9)
                    OR EXISTS (SELECT 1 FROM packing_batches WHERE production_order_id = po.id)
                  )
                ORDER BY po.id DESC
            ");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function packingOrderDetails(int $orderId): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $ord = $pdo->query("SELECT po.*, cu.name as customer_name, cu.code as customer_code, cu.avatar_style as customer_avatar_style, cu.avatar_seed as customer_avatar_seed, cu.avatar_config as customer_avatar_config FROM production_orders po LEFT JOIN customers cu ON po.customer_id = cu.id WHERE po.id = {$orderId}")->fetch();
            if (!$ord) {
                Response::error("Production order not found", 404);
                return;
            }

            $batches = $pdo->query("SELECT * FROM packing_batches WHERE production_order_id = {$orderId} ORDER BY id DESC")->fetchAll();
            foreach ($batches as &$b) {
                if (isset($b['photo_urls']) && is_string($b['photo_urls'])) {
                    $b['photo_urls'] = json_decode($b['photo_urls'], true) ?: [];
                }
            }
            unset($b);

            $cartons = $pdo->query("SELECT * FROM packing_cartons WHERE production_order_id = {$orderId} ORDER BY id DESC")->fetchAll();

            $iStmt = $pdo->prepare("
                SELECT poi.*, 
                       COALESCE(bp.product_name, p.name, 'Garment Product') as product_name, 
                       COALESCE(bp.product_code, p.code, 'PRD') as product_code,
                       bp.dimensions_json 
                FROM production_order_items poi 
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id 
                LEFT JOIN products p ON poi.product_id = p.id 
                WHERE poi.production_order_id = ?
            ");
            $iStmt->execute([$orderId]);
            $rawItems = $iStmt->fetchAll();

            // Quantity ledger arrivals into Stage 9
            $lStmt = $pdo->prepare("
                SELECT production_order_item_id, SUM(quantity) as qty 
                FROM production_quantity_ledger 
                WHERE production_order_id = ? AND stage_id = 9 AND (transaction_type = 'TRANSFER_IN' OR reference_type = 'Checking Transfer') 
                GROUP BY production_order_item_id
            ");
            $lStmt->execute([$orderId]);
            $ledgerIn = $lStmt->fetchAll(PDO::FETCH_KEY_PAIR);

            // Group items by product_id and color
            $groupedItems = [];
            foreach ($rawItems as $rawIt) {
                $grpKey = $rawIt['product_id'] . '_' . trim((string)($rawIt['color'] ?? ''));
                if (!isset($groupedItems[$grpKey])) {
                    $groupedItems[$grpKey] = $rawIt;
                    $groupedItems[$grpKey]['order_quantity'] = (float)$rawIt['total_quantity'];
                    $groupedItems[$grpKey]['active_packing_item_id'] = (int)$rawIt['id'];
                    $groupedItems[$grpKey]['stage_9_qty'] = ((int)$rawIt['current_stage_id'] === 9) ? (float)$rawIt['current_stage_quantity'] : 0.0;
                } else {
                    $groupedItems[$grpKey]['order_quantity'] += (float)$rawIt['total_quantity'];
                    if ((int)$rawIt['current_stage_id'] === 9) {
                        $groupedItems[$grpKey]['stage_9_qty'] += (float)$rawIt['current_stage_quantity'];
                        $groupedItems[$grpKey]['active_packing_item_id'] = (int)$rawIt['id'];
                    }
                }
            }

            // Tally arrivals from Checking and packed quantities
            foreach ($groupedItems as &$gIt) {
                $pId = (int)$gIt['product_id'];
                $color = trim((string)($gIt['color'] ?? ''));
                $itemId = (int)$gIt['active_packing_item_id'];

                $fromChecking = (float)($gIt['stage_9_qty'] ?? 0);
                if (isset($ledgerIn[$itemId])) {
                    $fromChecking = max($fromChecking, (float)$ledgerIn[$itemId]);
                }

                // Tally packing batches
                $packed = 0.0;
                $boxes = 0;
                $cartonsCount = 0;
                foreach ($batches as $b) {
                    if ((int)$b['production_order_item_id'] === $itemId) {
                        $packed += (float)($b['packed_quantity'] ?? 0);
                        $boxes += (int)($b['number_of_boxes'] ?? 0);
                        $cartonsCount += (int)($b['number_of_master_cartons'] ?? 0);
                    }
                }

                $gIt['arrived_from_checking'] = $fromChecking;
                $gIt['total_arrived'] = $fromChecking;
                $gIt['packed_quantity'] = $packed;
                $gIt['total_boxes'] = $boxes;
                $gIt['total_cartons'] = $cartonsCount;
                $gIt['available_to_pack'] = max(0.0, $fromChecking - $packed);
                $gIt['unpacked_balance'] = max(0.0, $fromChecking - $packed);
                $gIt['quantity'] = $gIt['order_quantity'];
            }
            unset($gIt);

            $items = array_values($groupedItems);

            Response::success([
                'order' => $ord,
                'items' => $items,
                'batches' => $batches,
                'cartons' => $cartons
            ]);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function createPackingBatch(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $pId = (int)($data['production_order_id'] ?? 0);
            $itemId = (int)($data['production_order_item_id'] ?? 0);
            $packed = (float)($data['packed_quantity'] ?? 0);
            $unitsBox = max(1, (int)($data['units_per_box'] ?? 20));
            $boxesMaster = max(1, (int)($data['boxes_per_master_carton'] ?? 1));

            $totalBoxes = (int)ceil($packed / $unitsBox);
            $totalCartons = (int)ceil($totalBoxes / $boxesMaster);
            $batchNo = 'PCK-' . rand(1000, 9999);

            $iStmt = $pdo->prepare("SELECT poi.*, COALESCE(bp.product_name, p.name, 'Garment Product') as prod_name FROM production_order_items poi LEFT JOIN buyer_products bp ON poi.product_id = bp.id LEFT JOIN products p ON poi.product_id = p.id WHERE poi.id = ?");
            $iStmt->execute([$itemId]);
            $itemRow = $iStmt->fetch();
            $prodName = $itemRow['prod_name'] ?? 'Garment Product';

            $stmt = $pdo->prepare("INSERT INTO packing_batches (
                production_order_id, production_order_item_id, batch_number, packing_date, 
                approved_quantity, packed_quantity, remaining_unpacked_quantity,
                units_per_box, number_of_boxes, boxes_per_master_carton, number_of_master_cartons, 
                partial_box_quantity, partial_carton_quantity,
                gross_weight, net_weight, packing_operator, packing_supervisor, remarks, photo_urls, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Packed')");
            $stmt->execute([
                $pId, $itemId, $batchNo, $data['packing_date'] ?? date('Y-m-d'), 
                $data['approved_quantity'] ?? $packed, $packed, (float)($data['remaining_unpacked_quantity'] ?? 0),
                $unitsBox, $totalBoxes, $boxesMaster, $totalCartons, 
                (int)($data['partial_box_quantity'] ?? ($packed % $unitsBox)), 
                (int)($data['partial_carton_quantity'] ?? ($totalBoxes % $boxesMaster)),
                !empty($data['gross_weight']) ? (float)$data['gross_weight'] : null,
                !empty($data['net_weight']) ? (float)$data['net_weight'] : null,
                $data['packing_operator'] ?? null, $data['packing_supervisor'] ?? null, 
                $data['remarks'] ?? '', json_encode($data['photo_urls'] ?? [])
            ]);
            $bId = (int)$pdo->lastInsertId();

            // Insert individual cartons
            $cStmt = $pdo->prepare("INSERT INTO packing_cartons (
                carton_serial_number, packing_batch_id, production_order_id, production_order_item_id, 
                product_name, product_code, color, size, items_count, is_full, gross_weight, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Packed')");
            $itemsPerCarton = $unitsBox * $boxesMaster;
            for ($i = 1; $i <= $totalCartons; $i++) {
                $serial = "CTN-{$pId}-{$itemId}-{$bId}-{$i}";
                $isFull = ($i < $totalCartons || ($packed % $itemsPerCarton === 0)) ? 1 : 0;
                $cQty = ($i === $totalCartons && ($packed % $itemsPerCarton !== 0)) ? ($packed % $itemsPerCarton) : $itemsPerCarton;
                $cStmt->execute([
                    $serial, $bId, $pId, $itemId, 
                    $prodName, $itemRow['product_sku'] ?? $itemRow['product_code'] ?? null, 
                    $itemRow['color'] ?? null, $itemRow['size'] ?? null, 
                    $cQty, $isFull, !empty($data['gross_weight']) ? (float)$data['gross_weight'] : null
                ]);
            }

            // Record in ledger
            $lStmt = $pdo->prepare("INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 9, 'PCK', 'PACKED', ?, ?, ?, ?, 'Packing Batch', ?, ?)");
            $lStmt->execute([$pId, $itemId, $packed, $batchNo, $data['packing_operator'] ?? '', $data['packing_supervisor'] ?? '', (string)$bId, $data['remarks'] ?? 'Cartons packed']);

            // Update item completed quantity in Stage 9 (without moving to Stage 10 yet)
            $pdo->prepare("UPDATE production_order_items SET completed_quantity = completed_quantity + ? WHERE id = ?")->execute([$packed, $itemId]);

            Response::success(['batch_number' => $batchNo, 'cartons' => $totalCartons, 'boxes' => $totalBoxes], "Packing batch and cartons generated successfully", 201);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function transferPackingOutput(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $pId = (int)($data['production_order_id'] ?? 0);
            $itemId = (int)($data['item_id'] ?? 0);
            $qty = (float)($data['transfer_quantity'] ?? 0);
            $remarks = trim($data['remarks'] ?? 'Transferred master cartons from Stage 09 Packing to Stage 10 Completed / Dispatch');

            if ($pId <= 0) {
                Response::error("Production order ID is required", 422);
                return;
            }

            if ($qty <= 0) {
                $qStmt = $pdo->prepare("SELECT COALESCE(SUM(packed_quantity), 0) FROM packing_batches WHERE production_order_id = ?");
                $qStmt->execute([$pId]);
                $qty = (float)$qStmt->fetchColumn();
            }

            $pdo->beginTransaction();

            $item = null;
            if ($itemId > 0) {
                $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE id = ? AND production_order_id = ?");
                $iStmt->execute([$itemId, $pId]);
                $item = $iStmt->fetch();
            }
            if (!$item) {
                $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? AND current_stage_id = 9 ORDER BY id DESC LIMIT 1");
                $iStmt->execute([$pId]);
                $item = $iStmt->fetch();
            }
            if (!$item) {
                $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? ORDER BY id DESC LIMIT 1");
                $iStmt->execute([$pId]);
                $item = $iStmt->fetch();
            }

            if ($item) {
                $compStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? AND product_id = ? AND color = ? AND current_stage_id = 10");
                $compStmt->execute([$pId, $item['product_id'], $item['color']]);
                $compItem = $compStmt->fetch();

                $curQty = (float)$item['current_stage_quantity'];
                $isFullMove = ($curQty <= $qty + 0.001);

                if ($compItem) {
                    $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = current_stage_quantity + ?, total_quantity = total_quantity + ?, completed_quantity = completed_quantity + ? WHERE id = ?")
                        ->execute([$qty, $qty, $qty, $compItem['id']]);

                    if ($isFullMove) {
                        $pdo->prepare("DELETE FROM production_order_items WHERE id = ?")->execute([$item['id']]);
                    } else {
                        $remQty = $curQty - $qty;
                        $remTotal = max($remQty, (float)$item['total_quantity'] - $qty);
                        $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = ?, total_quantity = ? WHERE id = ?")
                            ->execute([$remQty, $remTotal, $item['id']]);
                    }
                } else {
                    if ($isFullMove) {
                        $pdo->prepare("UPDATE production_order_items SET current_stage_id = 10, current_stage_quantity = ?, completed_quantity = ?, status = 'Completed' WHERE id = ?")
                            ->execute([$qty, $qty, $item['id']]);
                    } else {
                        $remQty = $curQty - $qty;
                        $remTotal = max($remQty, (float)$item['total_quantity'] - $qty);
                        $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = ?, total_quantity = ? WHERE id = ?")
                            ->execute([$remQty, $remTotal, $item['id']]);

                        $ins = $pdo->prepare("INSERT INTO production_order_items 
                            (production_order_id, product_id, color, total_quantity, current_stage_id, current_stage_quantity, completed_quantity, rejected_quantity, rework_quantity, status) 
                            VALUES (?, ?, ?, ?, 10, ?, ?, 0, 0, 'Completed')");
                        $ins->execute([$pId, $item['product_id'], $item['color'], $qty, $qty, $qty]);
                    }
                }
            }

            $pdo->prepare("UPDATE packing_batches SET status = 'Transferred to Dispatch' WHERE production_order_id = ?")
                ->execute([$pId]);

            $realItemId = $item ? (int)$item['id'] : $itemId;

            $tStmt = $pdo->prepare("INSERT INTO production_stage_transactions (production_order_item_id, from_stage_id, to_stage_id, quantity_moved, remarks) VALUES (?, 9, 10, ?, ?)");
            $tStmt->execute([$realItemId, $qty, $remarks]);

            $lStmtOut = $pdo->prepare("INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 9, 'PCK', 'TRANSFER_OUT', ?, '', '', '', 'Packing Transfer', '10', ?)");
            $lStmtOut->execute([$pId, $realItemId, $qty, "Transferred to Stage 10: Dispatch"]);

            $lStmtIn = $pdo->prepare("INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 10, 'COMP', 'TRANSFER_IN', ?, '', '', '', 'Packing Transfer', '10', ?)");
            $lStmtIn->execute([$pId, $realItemId, $qty, "Received from Packing"]);

            $pdo->commit();
            Response::success([
                'transferred_quantity' => $qty,
                'destination_stage_id' => 10,
                'destination_stage_name' => 'Completed / Dispatch'
            ], "Successfully transferred {$qty} pcs to Stage 10: Completed / Dispatch");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function packingCartons(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);
            $orderId = isset($_GET['production_order_id']) ? (int)$_GET['production_order_id'] : 0;
            if ($orderId > 0) {
                $stmt = $pdo->prepare("SELECT * FROM packing_cartons WHERE production_order_id = ? ORDER BY id DESC");
                $stmt->execute([$orderId]);
            } else {
                $stmt = $pdo->query("SELECT * FROM packing_cartons ORDER BY id DESC LIMIT 100");
            }
            Response::success($stmt->fetchAll());
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function getCartonBySerial(string $serial): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT * FROM packing_cartons WHERE carton_serial_number = ?");
            $stmt->execute([$serial]);
            $carton = $stmt->fetch();
            if (!$carton) { Response::error("Carton not found", 404); return; }
            Response::success($carton);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function dispatchOrders(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);
            $stmt = $pdo->query("SELECT po.*, cu.name as customer_name, (SELECT COUNT(*) FROM dispatch_records WHERE production_order_id = po.id) as dispatches_count FROM production_orders po LEFT JOIN customers cu ON po.customer_id = cu.id WHERE po.deleted_at IS NULL ORDER BY po.id DESC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function dispatchOrderDetails(int $orderId): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $ord = $pdo->query("SELECT po.*, cu.name as customer_name FROM production_orders po LEFT JOIN customers cu ON po.customer_id = cu.id WHERE po.id = {$orderId}")->fetch();
            $dispatches = $pdo->query("SELECT * FROM dispatch_records WHERE production_order_id = {$orderId} ORDER BY id DESC")->fetchAll();
            foreach ($dispatches as &$dsp) {
                foreach (['truck_photo_urls', 'loaded_cartons_photo_urls', 'labels_photo_urls', 'document_urls', 'carton_serial_numbers', 'items_breakdown'] as $fld) {
                    if (isset($dsp[$fld]) && is_string($dsp[$fld])) {
                        $dsp[$fld] = json_decode($dsp[$fld], true) ?: [];
                    }
                }
            }
            unset($dsp);
            $cartons = $pdo->query("SELECT * FROM packing_cartons WHERE production_order_id = {$orderId} ORDER BY id DESC")->fetchAll();

            Response::success(['order' => $ord, 'dispatches' => $dispatches, 'cartons' => $cartons]);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function recordOrderDispatch(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $pId = (int)($data['production_order_id'] ?? 0);
            if ($pId <= 0) {
                Response::error("Production order ID is required", 422);
                return;
            }

            $ordStmt = $pdo->prepare("SELECT * FROM production_orders WHERE id = ?");
            $ordStmt->execute([$pId]);
            $ord = $ordStmt->fetch();
            if (!$ord) {
                Response::error("Production order not found", 404);
                return;
            }

            // 1. Check for Duplicate Delivery Challan Number
            $dcNo = trim((string)($data['delivery_challan_number'] ?? ''));
            if (!empty($dcNo)) {
                $dupDcStmt = $pdo->prepare("SELECT id, dispatch_number FROM dispatch_records WHERE production_order_id = ? AND LOWER(TRIM(delivery_challan_number)) = LOWER(?)");
                $dupDcStmt->execute([$pId, $dcNo]);
                $dupDc = $dupDcStmt->fetch();
                if ($dupDc) {
                    Response::error("Duplicate Dispatch Error: Delivery Challan '{$dcNo}' has already been recorded for this order (Dispatch {$dupDc['dispatch_number']}). Duplicate dispatch is not allowed.", 422);
                    return;
                }
            }

            // 2. Check for Duplicate Tax Invoice Reference
            $invRef = trim((string)($data['invoice_reference'] ?? ''));
            if (!empty($invRef)) {
                $dupInvStmt = $pdo->prepare("SELECT id, dispatch_number FROM dispatch_records WHERE production_order_id = ? AND LOWER(TRIM(invoice_reference)) = LOWER(?)");
                $dupInvStmt->execute([$pId, $invRef]);
                $dupInv = $dupInvStmt->fetch();
                if ($dupInv) {
                    Response::error("Duplicate Dispatch Error: Invoice reference '{$invRef}' has already been recorded for this order (Dispatch {$dupInv['dispatch_number']}). Duplicate dispatch is not allowed.", 422);
                    return;
                }
            }

            // 3. Check if all cartons for this order have already been dispatched
            $cartonCheckStmt = $pdo->prepare("SELECT COUNT(*) as total_ctns, SUM(IF(status = 'Dispatched', 1, 0)) as dispatched_ctns FROM packing_cartons WHERE production_order_id = ?");
            $cartonCheckStmt->execute([$pId]);
            $ctnCounts = $cartonCheckStmt->fetch();
            $totalCtns = (int)($ctnCounts['total_ctns'] ?? 0);
            $dispatchedCtns = (int)($ctnCounts['dispatched_ctns'] ?? 0);

            if ($totalCtns > 0 && $dispatchedCtns >= $totalCtns) {
                Response::error("All master cartons ({$totalCtns} cartons) for Order {$ord['order_number']} have already been dispatched. No pending cartons remain in the dispatch bay.", 422);
                return;
            }

            // 4. Resolve and validate selected cartons
            $cartonIds = array_values(array_filter(array_map('intval', (array)($data['carton_ids'] ?? []))));
            $serials = (array)($data['carton_serial_numbers'] ?? []);

            $selectedCartons = [];
            if (!empty($cartonIds)) {
                $inClause = implode(',', array_fill(0, count($cartonIds), '?'));
                $cStmt = $pdo->prepare("SELECT * FROM packing_cartons WHERE id IN ($inClause)");
                $cStmt->execute($cartonIds);
                $selectedCartons = $cStmt->fetchAll();
            } else if (!empty($serials)) {
                $inClause = implode(',', array_fill(0, count($serials), '?'));
                $cStmt = $pdo->prepare("SELECT * FROM packing_cartons WHERE carton_serial_number IN ($inClause)");
                $cStmt->execute($serials);
                $selectedCartons = $cStmt->fetchAll();
                $cartonIds = array_column($selectedCartons, 'id');
            } else {
                // If neither passed, find all non-dispatched cartons for this order
                $cStmt = $pdo->prepare("SELECT * FROM packing_cartons WHERE production_order_id = ? AND status != 'Dispatched'");
                $cStmt->execute([$pId]);
                $selectedCartons = $cStmt->fetchAll();
                $cartonIds = array_column($selectedCartons, 'id');
            }

            if (empty($selectedCartons)) {
                Response::error("Please select at least one master carton to dispatch.", 422);
                return;
            }

            // Check if ANY selected carton is already dispatched
            foreach ($selectedCartons as $c) {
                if ($c['status'] === 'Dispatched') {
                    Response::error("Carton '{$c['carton_serial_number']}' has already been dispatched. Duplicate dispatch of the same carton is not allowed.", 422);
                    return;
                }
            }

            // 5. Calculate total dispatched pieces & boxes
            $calcPcs = array_reduce($selectedCartons, fn($s, $c) => $s + (float)$c['items_count'], 0.0);
            $totalDispatched = (float)($data['total_dispatched_quantity'] ?? 0);
            if ($totalDispatched <= 0) {
                $totalDispatched = $calcPcs;
            }
            if ($totalDispatched <= 0) {
                Response::error("Dispatched quantity must be greater than zero.", 422);
                return;
            }

            $totalBoxes = (int)($data['total_boxes'] ?? (count($selectedCartons) * 5));
            $cartonSerialList = array_column($selectedCartons, 'carton_serial_number');

            $dspNo = 'DSP-2026-' . rand(1000, 9999);

            $pdo->beginTransaction();

            $stmt = $pdo->prepare("INSERT INTO dispatch_records (
                dispatch_number, production_order_id, buyer_name, dispatch_date, dispatch_time, 
                total_dispatched_quantity, total_boxes, vehicle_number, driver_name, driver_contact, 
                transporter_name, delivery_challan_number, invoice_reference, destination_notes, 
                remarks, truck_photo_urls, loaded_cartons_photo_urls, labels_photo_urls, 
                document_urls, carton_serial_numbers, items_breakdown
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            $stmt->execute([
                $dspNo, 
                $pId, 
                $data['buyer_name'] ?? ($ord['customer_name'] ?? 'Buyer'), 
                $data['dispatch_date'] ?? date('Y-m-d'), 
                $data['dispatch_time'] ?? date('H:i:s'), 
                $totalDispatched, 
                $totalBoxes, 
                $data['vehicle_number'] ?? '', 
                $data['driver_name'] ?? null, 
                $data['driver_contact'] ?? null, 
                $data['transporter_name'] ?? null, 
                $dcNo ?: null, 
                $invRef ?: null, 
                $data['destination_notes'] ?? null, 
                $data['remarks'] ?? '', 
                json_encode($data['truck_photo_urls'] ?? []), 
                json_encode($data['loaded_cartons_photo_urls'] ?? []), 
                json_encode($data['labels_photo_urls'] ?? []), 
                json_encode($data['document_urls'] ?? []), 
                json_encode($cartonSerialList), 
                json_encode($data['items_breakdown'] ?? [])
            ]);
            $dspId = (int)$pdo->lastInsertId();

            // 6. Mark selected cartons as Dispatched in packing_cartons
            if (!empty($cartonIds)) {
                $updClause = implode(',', array_fill(0, count($cartonIds), '?'));
                $updCtnStmt = $pdo->prepare("UPDATE packing_cartons SET status = 'Dispatched', dispatch_id = ? WHERE id IN ($updClause)");
                $updCtnStmt->execute(array_merge([$dspId], $cartonIds));
            }

            // 7. Update parent production order completed_quantity and status
            $pdo->prepare("UPDATE production_orders SET completed_quantity = completed_quantity + ?, status = IF(completed_quantity >= total_quantity, 'COMPLETED', 'Partially Dispatched') WHERE id = ?")
                ->execute([$totalDispatched, $pId]);

            // 8. Record in production quantity ledger
            $firstPoiId = (int)($selectedCartons[0]['production_order_item_id'] ?? 0);
            $lStmt = $pdo->prepare("INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 10, 'COMP', 'DISPATCHED', ?, ?, ?, ?, 'Vehicle Dispatch', ?, ?)");
            $lStmt->execute([
                $pId, 
                $firstPoiId, 
                $totalDispatched, 
                $dspNo, 
                $data['driver_name'] ?? 'Driver', 
                $data['transporter_name'] ?? 'Transporter', 
                (string)$dspId, 
                "Dispatched via " . ($data['vehicle_number'] ?? 'Vehicle') . ($dcNo ? " (DC: {$dcNo})" : '')
            ]);

            $pdo->commit();

            Response::success([
                'dispatch_number' => $dspNo, 
                'dispatched_quantity' => $totalDispatched,
                'cartons_dispatched' => count($selectedCartons)
            ], "Dispatch recorded successfully with " . count($selectedCartons) . " master cartons ({$totalDispatched} pcs)", 201);
        } catch (Exception $e) { 
            if (isset($pdo) && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            Response::error($e->getMessage(), 500); 
        }
    }

    public function dispatchHistory(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);
            $stmt = $pdo->query("SELECT * FROM dispatch_records ORDER BY id DESC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function detailedReports(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $stmt = $pdo->query("SELECT po.*, cu.name as buyer_name FROM production_orders po LEFT JOIN customers cu ON po.customer_id = cu.id WHERE po.deleted_at IS NULL ORDER BY po.id DESC");
            $orders = $stmt->fetchAll();

            $reportData = [];
            foreach ($orders as $ord) {
                $totalQty = (float)$ord['total_quantity'];
                $doneQty = (float)$ord['completed_quantity'];
                $reportData[] = [
                    'order_id' => $ord['id'],
                    'order_number' => $ord['order_number'],
                    'title' => $ord['title'],
                    'buyer_name' => $ord['buyer_name'],
                    'target_delivery_date' => $ord['target_delivery_date'],
                    'total_quantity' => $totalQty,
                    'dispatched_quantity' => $doneQty,
                    'pending_quantity' => max(0.0, $totalQty - $doneQty),
                    'status' => $ord['status'],
                    'completion_percent' => $totalQty > 0 ? min(100, round(($doneQty / $totalQty) * 100)) : 0,
                ];
            }

            Response::success([
                'generated_at' => date('Y-m-d H:i:s'),
                'total_orders_analyzed' => count($reportData),
                'items' => $reportData
            ]);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }
}


