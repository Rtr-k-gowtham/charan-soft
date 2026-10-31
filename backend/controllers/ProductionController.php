<?php
// backend/controllers/ProductionController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/AuditLogger.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/NotificationService.php';

class ProductionController {
    
    public function tasks(): void {
        $user = Auth::requireUser();
        $allowedStages = $user['allowed_stages'] ?? Auth::getAllowedStagesForRole($user['role'] ?? 'Admin');
        if (empty($allowedStages)) {
            Response::success([]);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $inStages = implode(',', array_map('intval', $allowedStages));

            $stmt = $pdo->prepare("
                SELECT 
                    po.id as order_id,
                    po.order_number,
                    po.title as order_title,
                    po.target_delivery_date,
                    po.total_quantity as order_quantity,
                    po.status as order_status,
                    cu.name as customer_name,
                    cu.code as customer_code,
                    poi.id as item_id,
                    poi.current_stage_id,
                    poi.current_stage_quantity,
                    poi.status as item_status,
                    poi.color,
                    COALESCE(bp.product_name, p.name, 'Garment Product') as product_name,
                    COALESCE(bp.product_code, p.code, '') as product_code,
                    ps.name as stage_name,
                    ps.code as stage_code,
                    ps.sequence_order as stage_sequence,
                    ps.color_badge
                FROM production_order_items poi
                JOIN production_orders po ON poi.production_order_id = po.id
                JOIN production_stages ps ON poi.current_stage_id = ps.id
                LEFT JOIN customers cu ON po.customer_id = cu.id
                LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                LEFT JOIN products p ON poi.product_id = p.id
                WHERE po.deleted_at IS NULL
                  AND po.status != 'Cancelled'
                  AND poi.current_stage_id IN ({$inStages})
                  AND poi.status != 'Completed'
                  AND poi.current_stage_id != 10
                  AND (poi.current_stage_quantity > 0 OR poi.total_quantity > 0)
                ORDER BY po.id DESC, ps.sequence_order ASC
            ");
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $stageRoutes = [
                1 => '/production/requirement',
                2 => '/production/po',
                3 => '/production/inward',
                4 => '/production/dyeing',
                5 => '/production/cutting',
                6 => '/production/embroidery',
                7 => '/production/stitching',
                8 => '/production/checking',
                9 => '/production/packing',
                10 => '/production/completed'
            ];

            $tasksMap = [];
            foreach ($rows as $r) {
                $taskKey = $r['order_id'] . '_' . $r['current_stage_id'];
                $qty = (float)($r['current_stage_quantity'] > 0 ? $r['current_stage_quantity'] : $r['order_quantity']);

                if (!isset($tasksMap[$taskKey])) {
                    $seqPadded = str_pad((string)$r['stage_sequence'], 2, '0', STR_PAD_LEFT);
                    $tasksMap[$taskKey] = [
                        'task_id' => $taskKey,
                        'order_id' => (int)$r['order_id'],
                        'order_number' => $r['order_number'],
                        'order_title' => $r['order_title'],
                        'customer_name' => $r['customer_name'] ?: 'Customer',
                        'customer_code' => $r['customer_code'] ?: '',
                        'target_delivery_date' => $r['target_delivery_date'] ?: '2026-12-05',
                        'order_quantity' => (float)$r['order_quantity'],
                        'status' => $r['order_status'] ?: 'IN PRODUCTION',
                        'stage_id' => (int)$r['current_stage_id'],
                        'stage_name' => $r['stage_name'],
                        'stage_code' => $r['stage_code'],
                        'stage_sequence' => (int)$r['stage_sequence'],
                        'stage_quantity' => $qty,
                        'stage_status' => "{$seqPadded}. {$r['stage_name']} (" . number_format($qty) . " pcs)",
                        'color_badge' => $r['color_badge'] ?: '#3b82f6',
                        'action_url' => ($stageRoutes[(int)$r['current_stage_id']] ?? '/tasks') . '/' . $r['order_id'],
                        'products' => [
                            [
                                'item_id' => (int)$r['item_id'],
                                'product_name' => $r['product_name'],
                                'product_code' => $r['product_code'],
                                'color' => $r['color'],
                                'quantity' => $qty
                            ]
                        ]
                    ];
                } else {
                    $tasksMap[$taskKey]['stage_quantity'] += $qty;
                    $seqPadded = str_pad((string)$tasksMap[$taskKey]['stage_sequence'], 2, '0', STR_PAD_LEFT);
                    $tasksMap[$taskKey]['stage_status'] = "{$seqPadded}. {$tasksMap[$taskKey]['stage_name']} (" . number_format($tasksMap[$taskKey]['stage_quantity']) . " pcs)";
                    $tasksMap[$taskKey]['products'][] = [
                        'item_id' => (int)$r['item_id'],
                        'product_name' => $r['product_name'],
                        'product_code' => $r['product_code'],
                        'color' => $r['color'],
                        'quantity' => $qty
                    ];
                }
            }

            Response::success(array_values($tasksMap));
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

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
                try {
                    $iStmt = $pdo->prepare("
                        SELECT poi.*, 
                               COALESCE(bp.product_name, p.name) as product_name, 
                               COALESCE(bp.product_code, p.code) as product_code, 
                               ps.name as current_stage_name, ps.code as stage_code, ps.color_badge, ps.sequence_order as stage_sequence,
                               COALESCE(col.pantone_code, pcol.pantone_code, '') as color_pantone_code,
                               COALESCE(col.hex_code, pcol.hex_code, '#0F2042') as color_hex_code
                        FROM production_order_items poi
                        LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                        LEFT JOIN products p ON poi.product_id = p.id
                        JOIN production_stages ps ON poi.current_stage_id = ps.id
                        LEFT JOIN colors col ON (poi.color COLLATE utf8mb4_unicode_ci = col.name COLLATE utf8mb4_unicode_ci OR poi.color COLLATE utf8mb4_unicode_ci = col.code COLLATE utf8mb4_unicode_ci OR poi.color COLLATE utf8mb4_unicode_ci = col.pantone_code COLLATE utf8mb4_unicode_ci)
                        LEFT JOIN pantone_colors pcol ON (poi.color COLLATE utf8mb4_unicode_ci = pcol.pantone_name COLLATE utf8mb4_unicode_ci OR poi.color COLLATE utf8mb4_unicode_ci = pcol.pantone_code COLLATE utf8mb4_unicode_ci OR poi.color COLLATE utf8mb4_unicode_ci = pcol.unique_code COLLATE utf8mb4_unicode_ci)
                        WHERE poi.production_order_id = ? AND (poi.total_quantity > 0 OR poi.current_stage_quantity > 0)
                        ORDER BY poi.id ASC
                    ");
                    $iStmt->execute([$ord['id']]);
                    $ord['items'] = $iStmt->fetchAll();
                } catch (Exception $colEx) {
                    $iStmt = $pdo->prepare("
                        SELECT poi.*, 
                               COALESCE(bp.product_name, p.name) as product_name, 
                               COALESCE(bp.product_code, p.code) as product_code, 
                               ps.name as current_stage_name, ps.code as stage_code, ps.color_badge, ps.sequence_order as stage_sequence,
                               '' as color_pantone_code,
                               '#0F2042' as color_hex_code
                        FROM production_order_items poi
                        LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                        LEFT JOIN products p ON poi.product_id = p.id
                        JOIN production_stages ps ON poi.current_stage_id = ps.id
                        WHERE poi.production_order_id = ? AND (poi.total_quantity > 0 OR poi.current_stage_quantity > 0)
                        ORDER BY poi.id ASC
                    ");
                    $iStmt->execute([$ord['id']]);
                    $ord['items'] = $iStmt->fetchAll();
                }

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

            try {
                $iStmt = $pdo->prepare("
                    SELECT poi.*, 
                           COALESCE(bp.product_name, p.name) as product_name, 
                           COALESCE(bp.product_code, p.code) as product_code, 
                           COALESCE(cat.name, po_cat.name, 'General') as category_name,
                           ps.name as current_stage_name, ps.code as stage_code, ps.color_badge, ps.sequence_order as stage_sequence,
                           COALESCE(col.pantone_code, pcol.pantone_code, '') as color_pantone_code,
                           COALESCE(col.hex_code, pcol.hex_code, '#0F2042') as color_hex_code
                    FROM production_order_items poi
                    JOIN production_orders po ON poi.production_order_id = po.id
                    LEFT JOIN categories po_cat ON po.category_id = po_cat.id
                    LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                    LEFT JOIN products p ON poi.product_id = p.id
                    LEFT JOIN categories cat ON p.category_id = cat.id
                    JOIN production_stages ps ON poi.current_stage_id = ps.id
                    LEFT JOIN colors col ON (poi.color COLLATE utf8mb4_unicode_ci = col.name COLLATE utf8mb4_unicode_ci OR poi.color COLLATE utf8mb4_unicode_ci = col.code COLLATE utf8mb4_unicode_ci OR poi.color COLLATE utf8mb4_unicode_ci = col.pantone_code COLLATE utf8mb4_unicode_ci)
                    LEFT JOIN pantone_colors pcol ON (poi.color COLLATE utf8mb4_unicode_ci = pcol.pantone_name COLLATE utf8mb4_unicode_ci OR poi.color COLLATE utf8mb4_unicode_ci = pcol.pantone_code COLLATE utf8mb4_unicode_ci OR poi.color COLLATE utf8mb4_unicode_ci = pcol.unique_code COLLATE utf8mb4_unicode_ci)
                    WHERE poi.production_order_id = ? AND (poi.total_quantity > 0 OR poi.current_stage_quantity > 0)
                    ORDER BY poi.id ASC
                ");
                $iStmt->execute([$id]);
                $order['items'] = $iStmt->fetchAll();
            } catch (Exception $colEx) {
                $iStmt = $pdo->prepare("
                    SELECT poi.*, 
                           COALESCE(bp.product_name, p.name) as product_name, 
                           COALESCE(bp.product_code, p.code) as product_code, 
                           COALESCE(cat.name, po_cat.name, 'General') as category_name,
                           ps.name as current_stage_name, ps.code as stage_code, ps.color_badge, ps.sequence_order as stage_sequence,
                           '' as color_pantone_code,
                           '#0F2042' as color_hex_code
                    FROM production_order_items poi
                    JOIN production_orders po ON poi.production_order_id = po.id
                    LEFT JOIN categories po_cat ON po.category_id = po_cat.id
                    LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                    LEFT JOIN products p ON poi.product_id = p.id
                    LEFT JOIN categories cat ON p.category_id = cat.id
                    JOIN production_stages ps ON poi.current_stage_id = ps.id
                    WHERE poi.production_order_id = ? AND (poi.total_quantity > 0 OR poi.current_stage_quantity > 0)
                    ORDER BY poi.id ASC
                ");
                $iStmt->execute([$id]);
                $order['items'] = $iStmt->fetchAll();
            }

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
            try { NotificationService::notifyOrderCreated($pdo, $orderId, $orderNo, $title); } catch (Throwable $ne) {}
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

            $destStageStmt = $pdo->prepare("SELECT id, sequence_order, code, is_final_stage FROM production_stages WHERE id = ?");
            $destStageStmt->execute([$toStageId]);
            $destStage = $destStageStmt->fetch();
            $isFinal = (bool)($destStage['is_final_stage'] ?? false);

            // Validation: Moving to Stage 02 (PO Stage) requires assigned suppliers for procurement materials
            if ($destStage && ((int)$destStage['sequence_order'] === 2 || strtoupper($destStage['code'] ?? '') === 'PO')) {
                $targetPOId = $prodOrderId;
                if (!$targetPOId && $orderItemId) {
                    $poiStmt = $pdo->prepare("SELECT production_order_id FROM production_order_items WHERE id = ?");
                    $poiStmt->execute([$orderItemId]);
                    $targetPOId = (int)$poiStmt->fetchColumn();
                }
                if ($targetPOId) {
                    $bomStmt = $pdo->prepare("SELECT generated_bom FROM production_orders WHERE id = ?");
                    $bomStmt->execute([$targetPOId]);
                    $rawBom = $bomStmt->fetchColumn();
                    if ($rawBom) {
                        $parsedBom = json_decode($rawBom, true);
                        $mats = $parsedBom['total_materials'] ?? [];
                        $unassigned = [];
                        foreach ($mats as $mat) {
                            $reqQty = (float)($mat['total_required_qty'] ?? 0);
                            $supId = $mat['preferred_supplier_id'] ?? null;
                            if ($reqQty > 0 && empty($supId)) {
                                $unassigned[] = $mat['name'] ?? 'Material';
                            }
                        }
                        if (!empty($unassigned)) {
                            $pdo->rollBack();
                            Response::error("Cannot move to Stage 02 (PO Stage): The following materials require an assigned Preferred Supplier: " . implode(', ', array_unique($unassigned)), 422);
                            return;
                        }
                    }
                }
            }

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
                try {
                    $pInfo = $pdo->query("SELECT order_number, title FROM production_orders WHERE id = {$prodOrderId}")->fetch();
                    if ($pInfo) {
                        $fStg = isset($items[0]['current_stage_id']) ? (int)$items[0]['current_stage_id'] : null;
                        NotificationService::notifyStageTransition($pdo, $prodOrderId, $fStg, $toStageId, $pInfo['order_number'], $pInfo['title'], $remarks);
                    }
                } catch (Throwable $ne) {}
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
            $this->ensureWorkflowTables($pdo);

            $pId = isset($_GET['production_order_id']) && is_numeric($_GET['production_order_id']) ? (int)$_GET['production_order_id'] : 0;
            $stageId = isset($_GET['stage_id']) && is_numeric($_GET['stage_id']) ? (int)$_GET['stage_id'] : 0;
            $status = isset($_GET['status']) ? trim($_GET['status']) : '';

            $where = [];
            $params = [];

            if ($pId > 0) {
                $where[] = "(rw.production_order_id = ? OR poi.production_order_id = ?)";
                $params[] = $pId;
                $params[] = $pId;
            }
            if ($stageId > 0) {
                $where[] = "rw.stage_id = ?";
                $params[] = $stageId;
            }
            if (!empty($status) && $status !== 'all') {
                $where[] = "rw.status = ?";
                $params[] = $status;
            }

            $whereSql = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

            $stmt = $pdo->prepare("
                SELECT rw.*, 
                       COALESCE(poi.color, rw.color) as item_color, 
                       COALESCE(po.order_number, CONCAT('ORD-', rw.production_order_id)) as order_number, 
                       COALESCE(bp.product_name, p.name, rw.product_name, 'Garment Unit') as display_product_name,
                       COALESCE(bp.product_code, p.code) as display_product_code,
                       src_ps.name as source_stage_name,
                       src_ps.code as source_stage_code,
                       dest_ps.name as target_stage_name,
                       dest_ps.code as target_stage_code
                FROM rework_records rw
                LEFT JOIN production_order_items poi ON rw.production_order_item_id = poi.id
                LEFT JOIN production_orders po ON (rw.production_order_id = po.id OR poi.production_order_id = po.id)
                LEFT JOIN buyer_products bp ON (rw.product_id = bp.id OR poi.product_id = bp.id)
                LEFT JOIN products p ON (rw.product_id = p.id OR poi.product_id = p.id)
                LEFT JOIN production_stages src_ps ON rw.stage_id = src_ps.id
                LEFT JOIN production_stages dest_ps ON rw.rework_stage_id = dest_ps.id
                {$whereSql}
                ORDER BY rw.id DESC
            ");
            $stmt->execute($params);
            $records = $stmt->fetchAll();

            foreach ($records as &$r) {
                $r['rework_quantity'] = (float)$r['rework_quantity'];
                $r['accepted_quantity'] = (float)$r['accepted_quantity'];
                $r['rejected_quantity'] = (float)$r['rejected_quantity'];
                $r['pending_quantity'] = (float)$r['pending_quantity'];
                $r['cycle_number'] = (int)$r['cycle_number'];
            }
            unset($r);

            Response::success($records);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createRework(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $pId = (int)($data['production_order_id'] ?? ($data['order_id'] ?? 0));
            $stageId = (int)($data['stage_id'] ?? 0);
            $stageCode = trim($data['stage_code'] ?? '');
            $qty = (float)($data['rework_quantity'] ?? ($data['quantity'] ?? 0));

            if ($pId <= 0 || $stageId <= 0 || $qty <= 0) {
                Response::error("Production order ID, stage ID, and positive rework quantity are required", 422);
                return;
            }

            if (empty($stageCode)) {
                $stg = $pdo->prepare("SELECT code FROM production_stages WHERE id = ?");
                $stg->execute([$stageId]);
                $stageCode = $stg->fetchColumn() ?: 'STG';
            }

            $orderNo = 'RWK-' . $stageCode . '-' . rand(1000, 9999);
            $reason = trim((string)($data['defect_reason'] ?? ($data['rework_reason'] ?? 'Quality correction required')));
            $remarks = trim((string)($data['remarks'] ?? ($data['rework_remarks'] ?? '')));

            $stmt = $pdo->prepare("
                INSERT INTO rework_records (
                    production_order_id, production_order_item_id, stage_id, stage_code, 
                    rework_stage_id, rework_order_no, batch_number, reference_id,
                    product_id, product_name, color, size, uom, rework_quantity, quantity,
                    pending_quantity, defect_reason, rework_reason, defect_category, remarks, rework_remarks,
                    destination_process, vendor_id, vendor_name, status, cycle_number
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Rework', 1)
            ");
            $stmt->execute([
                $pId,
                $data['production_order_item_id'] ?? null,
                $stageId,
                $stageCode,
                $data['rework_stage_id'] ?? null,
                $orderNo,
                $data['batch_number'] ?? null,
                $data['reference_id'] ?? null,
                $data['product_id'] ?? null,
                $data['product_name'] ?? null,
                $data['color'] ?? null,
                $data['size'] ?? null,
                $data['uom'] ?? 'Pieces',
                $qty,
                $qty,
                $qty,
                $reason,
                $reason,
                $data['defect_category'] ?? 'Defect',
                $remarks,
                $remarks,
                $data['destination_process'] ?? 'Correction Workflow',
                $data['vendor_id'] ?? null,
                $data['vendor_name'] ?? null
            ]);
            $id = (int)$pdo->lastInsertId();

            if ($stageId === 5) {
                $batchNo = trim((string)($data['batch_number'] ?? ''));
                $bId = (int)($data['reference_id'] ?? 0);
                if (!empty($batchNo) || $bId > 0) {
                    $pdo->prepare("
                        UPDATE cutting_batches 
                        SET rework_quantity = rework_quantity + ?,
                            accepted_output_quantity = GREATEST(0.0, accepted_output_quantity - ?),
                            status = 'In Rework'
                        WHERE batch_number = ? OR id = ?
                    ")->execute([$qty, $qty, $batchNo, $bId]);
                }
            }

            Response::success(['id' => $id, 'rework_order_no' => $orderNo, 'quantity' => $qty], "Rework created successfully", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function sendRework(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $rwkId = (int)($data['rework_id'] ?? $data['id'] ?? 0);
            if ($rwkId <= 0) {
                Response::error("Rework record ID is required", 422);
                return;
            }

            $rStmt = $pdo->prepare("SELECT * FROM rework_records WHERE id = ? FOR UPDATE");
            $rStmt->execute([$rwkId]);
            $rwk = $rStmt->fetch();
            if (!$rwk) { Response::error("Rework record not found", 404); return; }

            if ($rwk['status'] === 'Sent for Rework' || $rwk['status'] === 'Accepted After Rework' || $rwk['status'] === 'Completed') {
                Response::error("This rework order ({$rwk['rework_order_no']}) has already been dispatched.", 422);
                return;
            }

            $pdo->beginTransaction();

            $sentDate = !empty($data['sent_date']) ? $data['sent_date'] : date('Y-m-d');
            $destProcess = trim($data['destination_process'] ?? ($rwk['destination_process'] ?? 'Correction Process'));
            $vendorName = trim($data['vendor_name'] ?? ($rwk['vendor_name'] ?? ''));
            $remarks = trim($data['remarks'] ?? '');

            $upd = $pdo->prepare("
                UPDATE rework_records 
                SET status = 'Sent for Rework',
                    sent_date = ?,
                    destination_process = ?,
                    vendor_name = ?,
                    remarks = CASE WHEN ? != '' THEN ? ELSE remarks END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ");
            $upd->execute([$sentDate, $destProcess, $vendorName, $remarks, $remarks, $rwkId]);

            // Ledger log
            $lStmt = $pdo->prepare("
                INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, ?, ?, 'REWORK_SENT', ?, ?, '', '', 'Rework Outward', ?, ?)
            ");
            $lStmt->execute([
                $rwk['production_order_id'],
                $rwk['production_order_item_id'] ?? 0,
                $rwk['stage_id'],
                $rwk['stage_code'],
                $rwk['rework_quantity'],
                $rwk['rework_order_no'],
                $rwk['rework_order_no'],
                "Sent for correction: {$destProcess}" . ($vendorName ? " ({$vendorName})" : "")
            ]);

            if ($pdo->inTransaction()) $pdo->commit();

            Response::success(['id' => $rwkId, 'status' => 'Sent for Rework', 'sent_date' => $sentDate], "Rework dispatched successfully");
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function receiveRework(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $rwkId = (int)($data['rework_id'] ?? $data['id'] ?? 0);
            if ($rwkId <= 0) {
                Response::error("Rework record ID is required", 422);
                return;
            }

            $rStmt = $pdo->prepare("SELECT * FROM rework_records WHERE id = ? FOR UPDATE");
            $rStmt->execute([$rwkId]);
            $rwk = $rStmt->fetch();
            if (!$rwk) { Response::error("Rework record not found", 404); return; }

            $pdo->beginTransaction();

            $recvDate = !empty($data['received_date']) ? $data['received_date'] : date('Y-m-d');
            $remarks = trim($data['remarks'] ?? '');
            $dcChallan = trim($data['dc_challan_no'] ?? ($data['delivery_challan_no'] ?? ''));
            $lotNumber = trim($data['lot_number'] ?? ($data['batch_number'] ?? ''));
            $inspector = trim($data['received_by'] ?? ($data['inspector_name'] ?? ''));

            $upd = $pdo->prepare("
                UPDATE rework_records 
                SET status = 'Rework Received',
                    received_date = ?,
                    dc_challan_no = CASE WHEN ? != '' THEN ? ELSE dc_challan_no END,
                    batch_number = CASE WHEN ? != '' THEN ? ELSE batch_number END,
                    inspector_name = CASE WHEN ? != '' THEN ? ELSE inspector_name END,
                    remarks = CASE WHEN ? != '' THEN ? ELSE remarks END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ");
            $upd->execute([$recvDate, $dcChallan, $dcChallan, $lotNumber, $lotNumber, $inspector, $inspector, $remarks, $remarks, $rwkId]);

            // Ledger log
            $lStmt = $pdo->prepare("
                INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, ?, ?, 'REWORK_RECEIVED', ?, ?, '', '', 'Rework Inward', ?, ?)
            ");
            $lStmt->execute([
                $rwk['production_order_id'],
                $rwk['production_order_item_id'] ?? 0,
                $rwk['stage_id'],
                $rwk['stage_code'],
                $rwk['rework_quantity'],
                $rwk['rework_order_no'],
                $rwk['rework_order_no'],
                "Received back from correction: {$remarks}"
            ]);

            if ($pdo->inTransaction()) $pdo->commit();

            Response::success(['id' => $rwkId, 'status' => 'Rework Received', 'received_date' => $recvDate], "Rework return recorded successfully");
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function reinspectRework(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $rwkId = (int)($data['rework_id'] ?? $data['id'] ?? 0);
            $acceptedQty = (float)($data['accepted_quantity'] ?? 0);
            $rejectedQty = (float)($data['rejected_quantity'] ?? 0);
            $furtherReworkQty = (float)($data['rework_quantity'] ?? 0);
            $inspector = trim($data['inspector_name'] ?? 'QC Inspector');
            $notes = trim($data['reinspection_notes'] ?? ($data['remarks'] ?? ''));
            $resStatus = trim($data['reinspection_result'] ?? '');

            if ($rwkId <= 0) {
                Response::error("Rework record ID is required", 422);
                return;
            }

            $rStmt = $pdo->prepare("SELECT * FROM rework_records WHERE id = ? FOR UPDATE");
            $rStmt->execute([$rwkId]);
            $rwk = $rStmt->fetch();
            if (!$rwk) {
                Response::error("Rework record not found", 404);
                return;
            }

            $origQty = (float)$rwk['rework_quantity'];
            $alreadyAcc = (float)$rwk['accepted_quantity'];
            $alreadyRej = (float)$rwk['rejected_quantity'];
            $outstanding = max(0.0, $origQty - $alreadyAcc - $alreadyRej);

            if ($outstanding <= 0.001 || in_array($rwk['status'], ['Accepted After Rework', 'Rework Received', 'Completed', 'Transferred'])) {
                $dispAcc = $alreadyAcc > 0 ? $alreadyAcc : $origQty;
                Response::error("The rework quantity ({$dispAcc} pcs) for {$rwk['rework_order_no']} has already been received.", 422);
                return;
            }

            $testedTotal = $acceptedQty + $rejectedQty + $furtherReworkQty;
            if ($testedTotal > $outstanding + 0.001) {
                Response::error("The sum of Accepted ({$acceptedQty}) + Rejected ({$rejectedQty}) + Further Rework ({$furtherReworkQty}) cannot exceed outstanding rework quantity ({$outstanding})", 422);
                return;
            }

            $pdo->beginTransaction();

            $newAcc = $alreadyAcc + $acceptedQty;
            $newRej = $alreadyRej + $rejectedQty;
            $newPending = max(0.0, $origQty - $newAcc - $newRej);

            // Determine final status
            if ($furtherReworkQty > 0 || $newPending > 0.001) {
                $status = 'Pending Rework';
                $cycleNumber = (int)$rwk['cycle_number'] + 1;
            } else if ($newAcc > 0) {
                $status = 'Accepted After Rework';
                $cycleNumber = (int)$rwk['cycle_number'];
            } else {
                $status = 'Rejected';
                $cycleNumber = (int)$rwk['cycle_number'];
            }

            $updRwk = $pdo->prepare("
                UPDATE rework_records 
                SET accepted_quantity = ?,
                    rejected_quantity = ?,
                    pending_quantity = ?,
                    status = ?,
                    cycle_number = ?,
                    reinspection_date = ?,
                    reinspection_result = ?,
                    reinspection_notes = ?,
                    inspector_name = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ");
            $updRwk->execute([
                $newAcc,
                $newRej,
                $newPending,
                $status,
                $cycleNumber,
                $data['reinspection_date'] ?? date('Y-m-d'),
                $resStatus ?: ($status === 'Accepted After Rework' ? 'Accepted - Passed Audit' : 'Inspection Recorded'),
                $notes,
                $inspector,
                $rwkId
            ]);

            $pId = (int)$rwk['production_order_id'];
            $itemId = (int)($rwk['production_order_item_id'] ?? 0);
            $stageId = (int)$rwk['stage_id'];
            $stageCode = trim((string)$rwk['stage_code']);
            $batchNo = trim((string)($rwk['batch_number'] ?? ''));

            // Log acceptance in ledger
            if ($acceptedQty > 0) {
                $lStmt = $pdo->prepare("
                    INSERT INTO production_quantity_ledger 
                    (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                    VALUES (?, ?, ?, ?, 'ACCEPTED', ?, ?, '', ?, 'Rework Re-inspection', ?, ?)
                ");
                $lStmt->execute([
                    $pId, 
                    $itemId, 
                    $stageId, 
                    $stageCode, 
                    $acceptedQty, 
                    $batchNo ?: $rwk['rework_order_no'], 
                    $inspector, 
                    $rwk['rework_order_no'], 
                    "Accepted after rework cycle {$rwk['cycle_number']}: {$notes}"
                ]);
            }

            if ($rejectedQty > 0) {
                $lStmtRej = $pdo->prepare("
                    INSERT INTO production_quantity_ledger 
                    (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                    VALUES (?, ?, ?, ?, 'REJECTED', ?, ?, '', ?, 'Rework Re-inspection', ?, ?)
                ");
                $lStmtRej->execute([
                    $pId, 
                    $itemId, 
                    $stageId, 
                    $stageCode, 
                    $rejectedQty, 
                    $batchNo ?: $rwk['rework_order_no'], 
                    $inspector, 
                    $rwk['rework_order_no'], 
                    "Rejected during rework re-inspection: {$notes}"
                ]);
            }

            // Stage-specific quantity reconciliation:
            if ($acceptedQty > 0 || $rejectedQty > 0) {
                if ($stageId === 4) {
                    // Stage 04 Dyeing: update dyeing_receipts & dyeing_orders
                    $refId = trim((string)$rwk['reference_id']);
                    if (!empty($refId)) {
                        $pdo->prepare("UPDATE dyeing_receipts SET total_accepted_quantity = total_accepted_quantity + ?, total_rework_quantity = GREATEST(0.0, total_rework_quantity - ?) WHERE id = ? OR receipt_no = ?")
                            ->execute([$acceptedQty, $acceptedQty + $rejectedQty, $refId, $refId]);

                        $pdo->prepare("UPDATE dyeing_orders SET total_accepted_quantity = total_accepted_quantity + ?, total_rework_quantity = GREATEST(0.0, total_rework_quantity - ?) WHERE id = (SELECT dyeing_order_id FROM dyeing_receipts WHERE id = ? OR receipt_no = ? LIMIT 1) OR id = ? OR dyeing_order_no = ?")
                            ->execute([$acceptedQty, $acceptedQty + $rejectedQty, $refId, $refId, $refId, $refId]);
                    } else if ($pId > 0) {
                        $pdo->prepare("UPDATE dyeing_orders SET total_accepted_quantity = total_accepted_quantity + ?, total_rework_quantity = GREATEST(0.0, total_rework_quantity - ?) WHERE production_order_id = ? ORDER BY id DESC LIMIT 1")
                            ->execute([$acceptedQty, $acceptedQty + $rejectedQty, $pId]);
                    }
                } else if ($stageId === 5) {
                    // Stage 05 Cutting: update cutting_batches accepted_output_quantity
                    if (!empty($batchNo)) {
                        $pdo->prepare("UPDATE cutting_batches SET accepted_output_quantity = accepted_output_quantity + ?, rework_quantity = GREATEST(0.0, rework_quantity - ?), rejected_quantity = rejected_quantity + ?, rework_status = 'Accepted After Rework' WHERE batch_number = ? OR id = ?")
                            ->execute([$acceptedQty, $acceptedQty + $rejectedQty, $rejectedQty, $batchNo, (int)$rwk['reference_id']]);
                    } else if ($itemId > 0) {
                        $pdo->prepare("UPDATE cutting_batches SET accepted_output_quantity = accepted_output_quantity + ?, rework_quantity = GREATEST(0.0, rework_quantity - ?), rejected_quantity = rejected_quantity + ?, rework_status = 'Accepted After Rework' WHERE production_order_item_id = ? ORDER BY id DESC LIMIT 1")
                            ->execute([$acceptedQty, $acceptedQty + $rejectedQty, $rejectedQty, $itemId]);
                    }
                } else if ($stageId === 6) {
                    // Stage 06 Embroidery: update embroidery_receipts & embroidery_job_orders
                    $refId = trim((string)$rwk['reference_id']);
                    $targetJobOrderId = 0;
                    $targetRcptId = 0;
                    $rcpt = null;

                    // 1. Locate matching receipt
                    if (!empty($refId)) {
                        $rcptStmt = $pdo->prepare("SELECT id, job_order_id, items_data, total_accepted_qty, total_rework_qty, total_rejected_qty FROM embroidery_receipts WHERE receipt_number = ? OR id = ? LIMIT 1");
                        $rcptStmt->execute([$refId, is_numeric($refId) ? (int)$refId : 0]);
                        $rcpt = $rcptStmt->fetch();
                        if ($rcpt) {
                            $targetRcptId = (int)$rcpt['id'];
                            $targetJobOrderId = (int)$rcpt['job_order_id'];
                        }
                    }

                    if ($targetRcptId <= 0 && $pId > 0) {
                        $rcptStmt = $pdo->prepare("SELECT id, job_order_id, items_data, total_accepted_qty, total_rework_qty, total_rejected_qty FROM embroidery_receipts WHERE production_order_id = ? ORDER BY id DESC LIMIT 1");
                        $rcptStmt->execute([$pId]);
                        $rcpt = $rcptStmt->fetch();
                        if ($rcpt) {
                            $targetRcptId = (int)$rcpt['id'];
                            $targetJobOrderId = (int)$rcpt['job_order_id'];
                        }
                    }

                    // Update receipt accepted and rework quantities
                    if ($targetRcptId > 0) {
                        $pdo->prepare("
                            UPDATE embroidery_receipts 
                            SET total_accepted_qty = total_accepted_qty + ?,
                                total_rework_qty = GREATEST(0.0, total_rework_qty - ?),
                                total_rejected_qty = total_rejected_qty + ?
                            WHERE id = ?
                        ")->execute([$acceptedQty, $acceptedQty + $rejectedQty, $rejectedQty, $targetRcptId]);

                        if ($rcpt && !empty($rcpt['items_data'])) {
                            $rItems = json_decode($rcpt['items_data'], true);
                            if (is_array($rItems)) {
                                foreach ($rItems as &$rit) {
                                    if (($itemId > 0 && ($rit['production_order_item_id'] ?? 0) == $itemId) || count($rItems) === 1) {
                                        $rit['accepted_quantity'] = (float)($rit['accepted_quantity'] ?? 0) + $acceptedQty;
                                        $rit['rework_quantity'] = max(0.0, (float)($rit['rework_quantity'] ?? 0) - ($acceptedQty + $rejectedQty));
                                        $rit['rejected_quantity'] = (float)($rit['rejected_quantity'] ?? 0) + $rejectedQty;
                                        break;
                                    }
                                }
                                unset($rit);
                                $pdo->prepare("UPDATE embroidery_receipts SET items_data = ? WHERE id = ?")
                                    ->execute([json_encode($rItems), $targetRcptId]);
                            }
                        }
                    }

                    // 2. Locate and update job order
                    if ($targetJobOrderId > 0) {
                        $pdo->prepare("
                            UPDATE embroidery_job_orders 
                            SET total_quantity_accepted = total_quantity_accepted + ?,
                                total_quantity_rework = GREATEST(0.0, total_quantity_rework - ?),
                                total_quantity_rejected = total_quantity_rejected + ?
                            WHERE id = ?
                        ")->execute([$acceptedQty, $acceptedQty + $rejectedQty, $rejectedQty, $targetJobOrderId]);
                    } else if (!empty($refId)) {
                        $updJob = $pdo->prepare("
                            UPDATE embroidery_job_orders 
                            SET total_quantity_accepted = total_quantity_accepted + ?,
                                total_quantity_rework = GREATEST(0.0, total_quantity_rework - ?),
                                total_quantity_rejected = total_quantity_rejected + ?
                            WHERE id = ? OR job_order_number = ?
                        ");
                        $updJob->execute([$acceptedQty, $acceptedQty + $rejectedQty, $rejectedQty, is_numeric($refId) ? (int)$refId : 0, $refId]);
                        if ($updJob->rowCount() === 0 && $pId > 0) {
                            $pdo->prepare("
                                UPDATE embroidery_job_orders 
                                SET total_quantity_accepted = total_quantity_accepted + ?,
                                    total_quantity_rework = GREATEST(0.0, total_quantity_rework - ?),
                                    total_quantity_rejected = total_quantity_rejected + ?
                                WHERE production_order_id = ?
                                ORDER BY id DESC LIMIT 1
                            ")->execute([$acceptedQty, $acceptedQty + $rejectedQty, $rejectedQty, $pId]);
                        }
                    } else if ($pId > 0) {
                        $pdo->prepare("
                            UPDATE embroidery_job_orders 
                            SET total_quantity_accepted = total_quantity_accepted + ?,
                                total_quantity_rework = GREATEST(0.0, total_quantity_rework - ?),
                                total_quantity_rejected = total_quantity_rejected + ?
                            WHERE production_order_id = ?
                            ORDER BY id DESC LIMIT 1
                        ")->execute([$acceptedQty, $acceptedQty + $rejectedQty, $rejectedQty, $pId]);
                    }
                } else if ($stageId === 7) {
                    // Stage 07 Stitching: update stitching_batches accepted_quantity
                    if (!empty($batchNo)) {
                        $pdo->prepare("UPDATE stitching_batches SET accepted_quantity = accepted_quantity + ?, rework_quantity = GREATEST(0.0, rework_quantity - ?), rejected_quantity = rejected_quantity + ?, rework_status = 'Accepted After Rework' WHERE batch_number = ? OR id = ?")
                            ->execute([$acceptedQty, $acceptedQty + $rejectedQty, $rejectedQty, $batchNo, (int)$rwk['reference_id']]);
                    } else if ($itemId > 0) {
                        $pdo->prepare("UPDATE stitching_batches SET accepted_quantity = accepted_quantity + ?, rework_quantity = GREATEST(0.0, rework_quantity - ?), rejected_quantity = rejected_quantity + ?, rework_status = 'Accepted After Rework' WHERE production_order_item_id = ? ORDER BY id DESC LIMIT 1")
                            ->execute([$acceptedQty, $acceptedQty + $rejectedQty, $rejectedQty, $itemId]);
                    }
                } else if ($stageId === 8) {
                    // Stage 08 Checking: update quality_inspections passed_quantity
                    if (!empty($batchNo)) {
                        $pdo->prepare("UPDATE quality_inspections SET passed_quantity = passed_quantity + ?, rework_quantity = GREATEST(0.0, rework_quantity - ?), rejected_quantity = rejected_quantity + ?, rework_status = 'Accepted After Rework' WHERE batch_number = ? OR id = ?")
                            ->execute([$acceptedQty, $acceptedQty + $rejectedQty, $rejectedQty, $batchNo, (int)$rwk['reference_id']]);
                    } else if ($itemId > 0) {
                        $pdo->prepare("UPDATE quality_inspections SET passed_quantity = passed_quantity + ?, rework_quantity = GREATEST(0.0, rework_quantity - ?), rejected_quantity = rejected_quantity + ?, rework_status = 'Accepted After Rework' WHERE production_order_item_id = ? ORDER BY id DESC LIMIT 1")
                            ->execute([$acceptedQty, $acceptedQty + $rejectedQty, $rejectedQty, $itemId]);
                    }
                }
            }

            if ($pdo->inTransaction()) {
                $pdo->commit();
            }

            Response::success([
                'id' => $rwkId,
                'accepted_quantity' => $acceptedQty,
                'rejected_quantity' => $rejectedQty,
                'total_accepted' => $newAcc,
                'total_rejected' => $newRej,
                'pending_quantity' => $newPending,
                'status' => $status,
                'cycle_number' => $cycleNumber
            ], "Rework re-inspection recorded successfully");
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
            $data = $this->calculateMaterialRequirements($orderId);
            Response::success($data);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function calculateMaterialRequirements(int $orderId, ?PDO $pdo = null): array {
        if ($pdo === null) {
            $pdo = Database::getConnection();
        }

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
                throw new Exception("Production order not found", 404);
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
                    SELECT bpc.*, m.code as material_code, m.purchase_rate, m.current_stock, m.uom as material_uom,
                           m.supplier_id as default_supplier_id, s.name as default_supplier_name, s.code as default_supplier_code
                    FROM buyer_product_components bpc
                    LEFT JOIN materials m ON bpc.material_id = m.id
                    LEFT JOIN suppliers s ON m.supplier_id = s.id
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
                                   bi.wastage_percent, 'Fabric' as category,
                                   m.supplier_id as default_supplier_id, s.name as default_supplier_name, s.code as default_supplier_code
                            FROM bom_items bi
                            JOIN boms b ON bi.bom_id = b.id
                            LEFT JOIN materials m ON bi.material_id = m.id
                            LEFT JOIN suppliers s ON m.supplier_id = s.id
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
                            'preferred_supplier_id' => !empty($c['default_supplier_id']) ? (int)$c['default_supplier_id'] : null,
                            'preferred_supplier_name' => !empty($c['default_supplier_name']) ? (string)$c['default_supplier_name'] : null,
                            'preferred_supplier_code' => !empty($c['default_supplier_code']) ? (string)$c['default_supplier_code'] : null,
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
                    $mStmt = $pdo->prepare("
                        SELECT m.id, m.current_stock, m.purchase_rate, m.supplier_id as default_supplier_id, 
                               s.name as default_supplier_name, s.code as default_supplier_code
                        FROM materials m
                        LEFT JOIN suppliers s ON m.supplier_id = s.id
                        WHERE m.id IN ($inPlaceholders)
                    ");
                    $mStmt->execute(array_values($matIds));
                    $liveStockMap = [];
                    foreach ($mStmt->fetchAll() as $row) {
                        $liveStockMap[$row['id']] = $row;
                    }
                    foreach ($totalMaterialsList as &$sm) {
                        if (!empty($sm['material_id']) && isset($liveStockMap[$sm['material_id']])) {
                            $liveMat = $liveStockMap[$sm['material_id']];
                            $sm['current_stock'] = (float)$liveMat['current_stock'];
                            $req = (float)($sm['total_required_qty'] ?? 0);
                            $stk = (float)$sm['current_stock'];
                            $sm['shortage_qty'] = max(0.0, round($req - $stk, 3));
                            if ($sm['shortage_qty'] > 0) {
                                $sm['status'] = ($stk > 0) ? 'Partial Stock' : 'Needs Procurement';
                            } else {
                                $sm['status'] = 'In Stock';
                            }

                            // If preferred supplier not yet assigned on saved BOM, use material default
                            if (empty($sm['preferred_supplier_id']) && !empty($liveMat['default_supplier_id'])) {
                                $sm['preferred_supplier_id'] = (int)$liveMat['default_supplier_id'];
                                $sm['preferred_supplier_name'] = $liveMat['default_supplier_name'];
                                $sm['preferred_supplier_code'] = $liveMat['default_supplier_code'];
                            }
                        }
                    }
                    unset($sm);
                }

                // Ensure live supplier name and code are enriched for all assigned preferred_supplier_ids
                $assignedSupIds = array_filter(array_column($totalMaterialsList, 'preferred_supplier_id'));
                if (!empty($assignedSupIds)) {
                    $supPlaceholders = implode(',', array_fill(0, count($assignedSupIds), '?'));
                    $sStmt = $pdo->prepare("SELECT id, name, code FROM suppliers WHERE id IN ($supPlaceholders)");
                    $sStmt->execute(array_values($assignedSupIds));
                    $supLiveMap = [];
                    foreach ($sStmt->fetchAll() as $sRow) {
                        $supLiveMap[$sRow['id']] = $sRow;
                    }
                    foreach ($totalMaterialsList as &$sm) {
                        if (!empty($sm['preferred_supplier_id']) && isset($supLiveMap[$sm['preferred_supplier_id']])) {
                            $sm['preferred_supplier_name'] = $supLiveMap[$sm['preferred_supplier_id']]['name'];
                            $sm['preferred_supplier_code'] = $supLiveMap[$sm['preferred_supplier_id']]['code'];
                        }
                    }
                    unset($sm);
                }

                // Enrich saved materials with size, model, length, thickness from buyer product components if missing
                foreach ($totalMaterialsList as &$sm) {
                    foreach ($materialsMap as $mappedMat) {
                        $match = (!empty($sm['material_id']) && $mappedMat['material_id'] == $sm['material_id']) ||
                                 (strtolower(trim((string)($sm['name'] ?? ''))) === strtolower(trim((string)($mappedMat['name'] ?? ''))));
                        if ($match) {
                            if (empty($sm['size']) && !empty($mappedMat['size'])) $sm['size'] = $mappedMat['size'];
                            if (empty($sm['model']) && !empty($mappedMat['model'])) $sm['model'] = $mappedMat['model'];
                            if (empty($sm['length']) && !empty($mappedMat['length'])) $sm['length'] = $mappedMat['length'];
                            if (empty($sm['thickness']) && !empty($mappedMat['thickness'])) $sm['thickness'] = $mappedMat['thickness'];
                            if (empty($sm['preferred_supplier_id']) && !empty($mappedMat['preferred_supplier_id'])) {
                                $sm['preferred_supplier_id'] = $mappedMat['preferred_supplier_id'];
                                $sm['preferred_supplier_name'] = $mappedMat['preferred_supplier_name'];
                                $sm['preferred_supplier_code'] = $mappedMat['preferred_supplier_code'];
                            }
                            break;
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

                return [
                    'order' => $order,
                    'products' => !empty($savedBom['products']) ? $savedBom['products'] : $productsBreakdown,
                    'total_materials' => $totalMaterialsList,
                    'summary' => $summary,
                    'generated_at' => $savedBom['updated_at'] ?? date('Y-m-d H:i:s'),
                    'is_persisted' => true,
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
                    'preferred_supplier_id' => $m['preferred_supplier_id'] ?? null,
                    'preferred_supplier_name' => $m['preferred_supplier_name'] ?? null,
                    'preferred_supplier_code' => $m['preferred_supplier_code'] ?? null,
                    'product_contributions' => $m['per_product_contributions'],
                ];
            }

            // Sort materials by category then name
            usort($totalMaterialsList, function($a, $b) {
                $cmp = strcmp($a['category'], $b['category']);
                return ($cmp !== 0) ? $cmp : strcmp($a['name'], $b['name']);
            });

            return [
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
            ];
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

            $rawMaterials = $data['total_materials'] ?? $data['materials'] ?? [];

            // Query live suppliers to validate and sanitize preferred vendor assignments
            $supIds = [];
            foreach ($rawMaterials as $mat) {
                if (!empty($mat['preferred_supplier_id'])) {
                    $supIds[] = (int)$mat['preferred_supplier_id'];
                }
            }
            $supIds = array_values(array_unique($supIds));
            $supMap = [];
            if (!empty($supIds)) {
                $inQuery = implode(',', array_fill(0, count($supIds), '?'));
                $sStmt = $pdo->prepare("SELECT id, name, code, status FROM suppliers WHERE id IN ($inQuery)");
                $sStmt->execute($supIds);
                foreach ($sStmt->fetchAll() as $s) {
                    $supMap[$s['id']] = $s;
                }
            }

            $sanitizedMaterials = [];
            foreach ($rawMaterials as $mat) {
                $sId = !empty($mat['preferred_supplier_id']) ? (int)$mat['preferred_supplier_id'] : null;
                $sName = $mat['preferred_supplier_name'] ?? null;
                $sCode = $mat['preferred_supplier_code'] ?? null;

                if ($sId && isset($supMap[$sId])) {
                    $sName = $supMap[$sId]['name'];
                    $sCode = $supMap[$sId]['code'];
                }

                $mat['preferred_supplier_id'] = $sId;
                $mat['preferred_supplier_name'] = $sName;
                $mat['preferred_supplier_code'] = $sCode;
                $sanitizedMaterials[] = $mat;
            }

            $bomPayload = [
                'total_materials' => $sanitizedMaterials,
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
            try {
                $pdo->exec("ALTER TABLE `embroidery_job_orders` MODIFY COLUMN `status` VARCHAR(50) DEFAULT 'Sent to Vendor'");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `embroidery_job_orders` ADD COLUMN `transferred_to_stitching_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `total_quantity_outstanding`");
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
                  `size` VARCHAR(50) NULL,
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
                  `eway_bill_number` VARCHAR(100) NULL,
                  `destination_notes` TEXT NULL,
                  `remarks` TEXT NULL,
                  `truck_photo_urls` JSON NULL,
                  `loaded_cartons_photo_urls` JSON NULL,
                  `eway_bill_photo_urls` JSON NULL,
                  `labels_photo_urls` JSON NULL,
                  `document_urls` JSON NULL,
                  `status` VARCHAR(50) DEFAULT 'Dispatched',
                  `carton_serial_numbers` JSON NULL,
                  `items_breakdown` JSON NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_dr_ord` (`production_order_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");

            try {
                $cols = $pdo->query("SHOW COLUMNS FROM dispatch_records")->fetchAll(PDO::FETCH_COLUMN);
                if (!in_array('eway_bill_number', $cols)) {
                    $pdo->exec("ALTER TABLE dispatch_records ADD COLUMN eway_bill_number VARCHAR(100) NULL AFTER invoice_reference");
                }
                if (!in_array('eway_bill_filename', $cols)) {
                    $pdo->exec("ALTER TABLE dispatch_records ADD COLUMN eway_bill_filename VARCHAR(255) NULL AFTER eway_bill_number");
                }
                if (!in_array('eway_bill_filesize', $cols)) {
                    $pdo->exec("ALTER TABLE dispatch_records ADD COLUMN eway_bill_filesize INT NULL AFTER eway_bill_filename");
                }
                if (!in_array('eway_bill_photo_urls', $cols)) {
                    $pdo->exec("ALTER TABLE dispatch_records ADD COLUMN eway_bill_photo_urls JSON NULL AFTER loaded_cartons_photo_urls");
                }
            } catch (Exception $colEx) {}

            // Rework Management across Stages 4, 5, 6, 7, 8
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `rework_records` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `rework_order_no` VARCHAR(100) NOT NULL DEFAULT '',
                  `production_order_id` INT NOT NULL DEFAULT 0,
                  `production_order_item_id` INT NULL,
                  `stage_id` INT NOT NULL DEFAULT 4,
                  `stage_code` VARCHAR(20) NOT NULL DEFAULT 'DYE',
                  `qc_record_id` INT NULL,
                  `product_id` INT NULL,
                  `product_name` VARCHAR(255) NULL,
                  `color` VARCHAR(100) NULL,
                  `size` VARCHAR(50) NULL,
                  `batch_number` VARCHAR(100) NULL,
                  `rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `uom` VARCHAR(50) DEFAULT 'Pieces',
                  `rework_reason` VARCHAR(255) NULL,
                  `rework_remarks` TEXT NULL,
                  `rework_stage_id` INT NULL,
                  `destination_process` VARCHAR(255) NULL,
                  `vendor_id` INT NULL,
                  `vendor_name` VARCHAR(255) NULL,
                  `dc_challan_no` VARCHAR(100) NULL,
                  `sent_date` DATE NULL,
                  `received_date` DATE NULL,
                  `reinspection_date` DATE NULL,
                  `reinspection_result` VARCHAR(100) NULL,
                  `reinspection_notes` TEXT NULL,
                  `inspector_name` VARCHAR(150) NULL,
                  `accepted_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `rejected_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `pending_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                  `defect_reason` VARCHAR(255) NULL,
                  `defect_category` VARCHAR(100) NULL,
                  `remarks` TEXT NULL,
                  `cycle_number` INT NOT NULL DEFAULT 1,
                  `status` VARCHAR(50) NOT NULL DEFAULT 'Pending Rework',
                  `reference_type` VARCHAR(100) NULL,
                  `reference_id` VARCHAR(100) NULL,
                  `metadata_json` JSON NULL,
                  `created_by_user_id` INT NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  INDEX `idx_rr_pord` (`production_order_id`),
                  INDEX `idx_rr_stage` (`stage_id`),
                  INDEX `idx_rr_status` (`status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");

            try {
                $rwCols = $pdo->query("SHOW COLUMNS FROM rework_records")->fetchAll(PDO::FETCH_COLUMN);
                $rwNeeded = [
                    'rework_order_no' => "VARCHAR(100) NOT NULL DEFAULT ''",
                    'production_order_id' => "INT NOT NULL DEFAULT 0",
                    'production_order_item_id' => "INT NULL",
                    'stage_id' => "INT NOT NULL DEFAULT 4",
                    'stage_code' => "VARCHAR(20) NOT NULL DEFAULT 'DYE'",
                    'qc_record_id' => "INT NULL",
                    'product_id' => "INT NULL",
                    'product_name' => "VARCHAR(255) NULL",
                    'color' => "VARCHAR(100) NULL",
                    'size' => "VARCHAR(50) NULL",
                    'batch_number' => "VARCHAR(100) NULL",
                    'rework_quantity' => "DECIMAL(12, 2) NOT NULL DEFAULT 0.00",
                    'quantity' => "DECIMAL(12, 2) NOT NULL DEFAULT 0.00",
                    'uom' => "VARCHAR(50) DEFAULT 'Pieces'",
                    'rework_reason' => "VARCHAR(255) NULL",
                    'rework_remarks' => "TEXT NULL",
                    'rework_stage_id' => "INT NULL",
                    'destination_process' => "VARCHAR(255) NULL",
                    'vendor_id' => "INT NULL",
                    'vendor_name' => "VARCHAR(255) NULL",
                    'dc_challan_no' => "VARCHAR(100) NULL",
                    'sent_date' => "DATE NULL",
                    'received_date' => "DATE NULL",
                    'reinspection_date' => "DATE NULL",
                    'reinspection_result' => "VARCHAR(100) NULL",
                    'reinspection_notes' => "TEXT NULL",
                    'inspector_name' => "VARCHAR(150) NULL",
                    'accepted_quantity' => "DECIMAL(12, 2) NOT NULL DEFAULT 0.00",
                    'rejected_quantity' => "DECIMAL(12, 2) NOT NULL DEFAULT 0.00",
                    'pending_quantity' => "DECIMAL(12, 2) NOT NULL DEFAULT 0.00",
                    'defect_reason' => "VARCHAR(255) NULL",
                    'defect_category' => "VARCHAR(100) NULL",
                    'remarks' => "TEXT NULL",
                    'cycle_number' => "INT NOT NULL DEFAULT 1",
                    'status' => "VARCHAR(50) NOT NULL DEFAULT 'Pending Rework'",
                    'reference_type' => "VARCHAR(100) NULL",
                    'reference_id' => "VARCHAR(100) NULL",
                    'metadata_json' => "JSON NULL",
                    'created_by_user_id' => "INT NULL",
                    'updated_at' => "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
                ];
                foreach ($rwNeeded as $col => $colType) {
                    if (!in_array($col, $rwCols)) {
                        try {
                            $pdo->exec("ALTER TABLE `rework_records` ADD COLUMN `{$col}` {$colType}");
                        } catch (Exception $e) {}
                    }
                }
                // Relax legacy constraints if existing table had NOT NULL or ENUM restrictions
                try { $pdo->exec("ALTER TABLE `rework_records` MODIFY COLUMN `qc_record_id` INT NULL"); } catch (Exception $e) {}
                try { $pdo->exec("ALTER TABLE `rework_records` MODIFY COLUMN `production_order_item_id` INT NULL"); } catch (Exception $e) {}
                try { $pdo->exec("ALTER TABLE `rework_records` MODIFY COLUMN `rework_stage_id` INT NULL"); } catch (Exception $e) {}
                try { $pdo->exec("ALTER TABLE `rework_records` MODIFY COLUMN `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00"); } catch (Exception $e) {}
                try { $pdo->exec("ALTER TABLE `rework_records` MODIFY COLUMN `status` VARCHAR(50) DEFAULT 'Pending Rework'"); } catch (Exception $e) {}
            } catch (Exception $rwEx) {}

            try {
                $pdo->exec("ALTER TABLE `cutting_batches` ADD COLUMN `rework_status` VARCHAR(50) DEFAULT 'Normal' AFTER `status`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `stitching_batches` ADD COLUMN `rework_status` VARCHAR(50) DEFAULT 'Normal' AFTER `status`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `rework_stage_id` INT NULL AFTER `color`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `rework_status` VARCHAR(50) DEFAULT 'Normal' AFTER `remarks`");
            } catch (Exception $e) {}
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
            // Cross-Stage Inspection Workflow Columns
            try {
                $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `stage_id` INT NOT NULL DEFAULT 8 AFTER `production_order_item_id`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `stage_code` VARCHAR(20) DEFAULT 'CHK' AFTER `stage_id`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `reference_id` VARCHAR(100) NULL AFTER `stage_code`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `reference_type` VARCHAR(100) NULL AFTER `reference_id`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `uom` VARCHAR(20) DEFAULT 'PCS' AFTER `rejected_quantity`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `size` VARCHAR(50) NULL AFTER `color`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `rework_records` ADD COLUMN `size` VARCHAR(50) NULL AFTER `color`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `rework_destination` VARCHAR(100) NULL AFTER `color`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `rework_reason` VARCHAR(255) NULL AFTER `rework_destination`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `status` VARCHAR(50) DEFAULT 'Inspected' AFTER `remarks`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `dyeing_receipts` ADD COLUMN `inspection_status` VARCHAR(50) DEFAULT 'Pending Inspection' AFTER `total_rework_quantity`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `cutting_batches` ADD COLUMN `inspection_status` VARCHAR(50) DEFAULT 'Pending Inspection' AFTER `accepted_output_quantity`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `embroidery_receipts` ADD COLUMN `inspection_status` VARCHAR(50) DEFAULT 'Pending Inspection' AFTER `total_rework_qty`");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `stitching_batches` ADD COLUMN `inspection_status` VARCHAR(50) DEFAULT 'Pending Inspection' AFTER `accepted_quantity`");
            } catch (Exception $e) {}

            // One-time self-healing data repair for Order 57 (Organic Cotton Bedsheet and Test Product V1)
            try {
                $checkItem121 = $pdo->query("SELECT id, total_quantity, current_stage_quantity FROM production_order_items WHERE id = 121 AND production_order_id = 57")->fetch();
                if ($checkItem121 && (float)$checkItem121['total_quantity'] > 100.01) {
                    // Restore Item 121 order qty to 100
                    $pdo->exec("UPDATE production_order_items SET total_quantity = 100.00, current_stage_quantity = 100.00, current_stage_id = 7, status = 'In Progress' WHERE id = 121 AND production_order_id = 57");

                    // Move items 124 and 125 that were also received from embroidery job order to stage 7 with 100 pcs
                    $pdo->exec("UPDATE production_order_items SET current_stage_id = 7, current_stage_quantity = 100.00, total_quantity = 100.00, status = 'In Progress' WHERE id IN (124, 125) AND production_order_id = 57");

                    // Fix ledger quantities: update 300 to 100 for item 121
                    $pdo->exec("UPDATE production_quantity_ledger SET quantity = 100.00 WHERE production_order_id = 57 AND production_order_item_id = 121 AND quantity = 300.00 AND transaction_type IN ('TRANSFER_OUT', 'TRANSFER_IN')");

                    // Ensure items 124 and 125 have transfer ledger records
                    $has124 = $pdo->query("SELECT id FROM production_quantity_ledger WHERE production_order_id = 57 AND production_order_item_id = 124 AND stage_id = 7 AND transaction_type = 'TRANSFER_IN'")->fetchColumn();
                    if (!$has124) {
                        $pdo->exec("INSERT INTO production_quantity_ledger (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) VALUES (57, 124, 6, 'EMB', 'TRANSFER_OUT', 100.00, '', 'M. Ramesh', 'K. Balan', 'Embroidery Transfer', '7', 'Transferred to Stitching — Color-wise Tracking')");
                        $pdo->exec("INSERT INTO production_quantity_ledger (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) VALUES (57, 124, 7, 'STI', 'TRANSFER_IN', 100.00, '', 'M. Ramesh', 'K. Balan', 'Embroidery Transfer', '7', 'Received from Embroidery')");
                    }

                    $has125 = $pdo->query("SELECT id FROM production_quantity_ledger WHERE production_order_id = 57 AND production_order_item_id = 125 AND stage_id = 7 AND transaction_type = 'TRANSFER_IN'")->fetchColumn();
                    if (!$has125) {
                        $pdo->exec("INSERT INTO production_quantity_ledger (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) VALUES (57, 125, 6, 'EMB', 'TRANSFER_OUT', 100.00, '', 'M. Ramesh', 'K. Balan', 'Embroidery Transfer', '7', 'Transferred to Stitching — Color-wise Tracking')");
                        $pdo->exec("INSERT INTO production_quantity_ledger (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) VALUES (57, 125, 7, 'STI', 'TRANSFER_IN', 100.00, '', 'M. Ramesh', 'K. Balan', 'Embroidery Transfer', '7', 'Received from Embroidery')");
                    }
                }
            } catch (Exception $e) {}
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
        Auth::requireStageAccess(5);
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

            $rwkStmt = $pdo->prepare("
                SELECT rw.*, 
                       COALESCE(bp.product_name, p.name, rw.product_name) as display_product_name,
                       COALESCE(bp.product_code, p.code) as display_product_code
                FROM rework_records rw
                LEFT JOIN production_order_items poi ON rw.production_order_item_id = poi.id
                LEFT JOIN buyer_products bp ON (rw.product_id = bp.id OR poi.product_id = bp.id)
                LEFT JOIN products p ON (rw.product_id = p.id OR poi.product_id = p.id)
                WHERE rw.production_order_id = ? AND rw.stage_id = 5
                ORDER BY rw.id DESC
            ");
            $rwkStmt->execute([$orderId]);
            $reworks = $rwkStmt->fetchAll();

            foreach ($batches as &$b) {
                if (isset($b['photo_urls']) && is_string($b['photo_urls'])) {
                    $b['photo_urls'] = json_decode($b['photo_urls'], true) ?: [];
                }
                $bNo = $b['batch_number'] ?? '';
                $bId = (string)($b['id'] ?? '');

                // Filter rework records belonging to this batch
                $batchReworks = array_filter($reworks, function($r) use ($bNo, $bId) {
                    return (!empty($r['batch_number']) && $r['batch_number'] === $bNo) ||
                           (!empty($r['reference_id']) && ((string)$r['reference_id'] === $bId || (string)$r['reference_id'] === $bNo));
                });

                $activeRwk = 0.0;
                $receivedRwk = 0.0;
                $totalRwk = 0.0;
                foreach ($batchReworks as $rwk) {
                    $rQty = (float)($rwk['rework_quantity'] ?? 0);
                    $totalRwk += $rQty;
                    $st = $rwk['status'] ?? '';
                    if ($st === 'Rework Received' || $st === 'Accepted After Rework' || $st === 'Completed') {
                        $receivedRwk += (float)($rwk['accepted_quantity'] ?? $rQty);
                    } else {
                        // Still away at recut line
                        $activeRwk += $rQty;
                    }
                }

                $cut = (float)($b['actual_cut_quantity'] ?? 0);
                $rej = (float)($b['rejected_quantity'] ?? 0);
                $trf = (float)($b['transferred_to_next_stage_quantity'] ?? 0);

                // Accepted in hand right now = Cut - Active Rework (at recut line) - Scrap
                // Available to transfer = Accepted in hand - Transferred
                $acceptedOutput = max(0.0, $cut - $activeRwk - $rej);
                $availableInHand = max(0.0, $acceptedOutput - $trf);

                $b['rework_quantity'] = $totalRwk;
                $b['active_rework_quantity'] = $activeRwk;
                $b['received_rework_quantity'] = $receivedRwk;
                $b['accepted_output_quantity'] = $acceptedOutput;
                $b['available_quantity'] = $availableInHand;
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

            $rwkStmt = $pdo->prepare("
                SELECT rw.*, 
                       COALESCE(bp.product_name, p.name, rw.product_name) as display_product_name,
                       COALESCE(bp.product_code, p.code) as display_product_code
                FROM rework_records rw
                LEFT JOIN production_order_items poi ON rw.production_order_item_id = poi.id
                LEFT JOIN buyer_products bp ON (rw.product_id = bp.id OR poi.product_id = bp.id)
                LEFT JOIN products p ON (rw.product_id = p.id OR poi.product_id = p.id)
                WHERE rw.production_order_id = ? AND rw.stage_id = 5
                ORDER BY rw.id DESC
            ");
            $rwkStmt->execute([$orderId]);
            $reworks = $rwkStmt->fetchAll();

            $insStmt = $pdo->prepare("SELECT * FROM quality_inspections WHERE production_order_id = ? AND stage_id = 5 ORDER BY id DESC");
            $insStmt->execute([$orderId]);
            $inspections = $insStmt->fetchAll();

            // Fetch dyed fabric received from Stage 04 Dyeing
            $dyeReceipts = [];
            $totalDyedReceived = 0.0;
            $totalDyedAccepted = 0.0;
            $totalDyedTransferred = 0.0;
            try {
                $dyeStmt = $pdo->prepare("
                    SELECT dr.*, do.fabric_name, do.dyeing_mill_name, do.uom
                    FROM dyeing_receipts dr
                    LEFT JOIN dyeing_orders do ON dr.dyeing_order_id = do.id
                    WHERE dr.production_order_id = ?
                    ORDER BY dr.id DESC
                ");
                $dyeStmt->execute([$orderId]);
                $dyeReceipts = $dyeStmt->fetchAll() ?: [];
                $totalDyedReceived = array_reduce($dyeReceipts, fn($s, $r) => $s + (float)($r['total_received_quantity'] ?? 0), 0.0);
                $totalDyedAccepted = array_reduce($dyeReceipts, fn($s, $r) => $s + (float)($r['total_accepted_quantity'] ?? 0), 0.0);
            } catch (Exception $dyeEx) {}

            try {
                $tStmt = $pdo->prepare("
                    SELECT COALESCE(SUM(quantity), 0)
                    FROM production_quantity_ledger
                    WHERE production_order_id = ? 
                      AND (stage_id = 4 OR stage_code = 'DYE') 
                      AND (transaction_type = 'TRANSFERRED_TO_CUTTING' OR transaction_type = 'TRANSFER_OUT')
                      AND reference_id != 'STAGE-04-HANDOVER'
                ");
                $tStmt->execute([$orderId]);
                $totalDyedTransferred = (float)$tStmt->fetchColumn();
            } catch (Exception $tEx) {}

            Response::success([
                'order' => $ord, 
                'items' => $items, 
                'batches' => $batches,
                'inspections' => $inspections,
                'rework_records' => $reworks,
                'dyeing_receipts' => $dyeReceipts,
                'total_dyed_fabric_received' => $totalDyedReceived,
                'total_dyed_fabric_accepted' => $totalDyedAccepted,
                'total_dyed_fabric_transferred' => $totalDyedTransferred
            ]);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function createCuttingBatch(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $pId = (int)($data['production_order_id'] ?? 0);
            if ($pId <= 0) {
                Response::error("Production order ID is required", 422);
                return;
            }

            // Support atomic bulk cutting batches
            if (!empty($data['batches']) && is_array($data['batches'])) {
                $batchRows = $data['batches'];
                $validBatches = [];
                foreach ($batchRows as $bRow) {
                    $cutQty = (float)($bRow['actual_cut_quantity'] ?? 0);
                    if ($cutQty > 0) {
                        $validBatches[] = $bRow;
                    }
                }

                if (empty($validBatches)) {
                    Response::error("Please enter a valid actual cut quantity greater than 0 for at least one product line", 422);
                    return;
                }

                $pdo->beginTransaction();
                $createdBatches = [];
                $cutDate = $data['cutting_date'] ?? date('Y-m-d');
                $photoUrls = json_encode($data['photo_urls'] ?? []);
                $remarks = $data['remarks'] ?? ($data['notes'] ?? '');

                foreach ($validBatches as $vb) {
                    $itemId = (int)($vb['production_order_item_id'] ?? 0);
                    $actual = (float)($vb['actual_cut_quantity'] ?? 0);
                    $assigned = (float)($vb['assigned_quantity'] ?? $actual);

                    if ($itemId > 0) {
                        $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE id = ? AND production_order_id = ?");
                        $iStmt->execute([$itemId, $pId]);
                        $item = $iStmt->fetch();
                    } else {
                        $item = null;
                    }
                    if (!$item) {
                        $pIdReq = (int)($vb['product_id'] ?? 0);
                        $colReq = trim((string)($vb['color'] ?? ''));
                        if ($pIdReq > 0) {
                            $fStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? AND product_id = ? AND color = ? LIMIT 1");
                            $fStmt->execute([$pId, $pIdReq, $colReq]);
                            $item = $fStmt->fetch();
                            if ($item) $itemId = (int)$item['id'];
                        }
                    }

                    $batchNo = 'CUT-' . rand(1000, 9999);
                    $stmt = $pdo->prepare("
                        INSERT INTO cutting_batches 
                        (production_order_id, production_order_item_id, batch_number, cutting_date, assigned_quantity, actual_cut_quantity, rejected_quantity, rework_quantity, accepted_output_quantity, pending_quantity, operator, supervisor, machine_line, remarks, photo_urls, status, inspection_status) 
                        VALUES (?, ?, ?, ?, ?, ?, 0.00, 0.00, 0.00, 0, ?, ?, ?, ?, ?, 'In Progress', 'Pending Inspection')
                    ");
                    $stmt->execute([
                        $pId, 
                        $itemId, 
                        $batchNo, 
                        $cutDate, 
                        $assigned, 
                        $actual, 
                        $data['operator'] ?? null, 
                        $data['supervisor'] ?? null, 
                        $data['machine_line'] ?? null, 
                        $vb['remarks'] ?? $remarks, 
                        $photoUrls
                    ]);
                    $batchId = (int)$pdo->lastInsertId();

                    $lStmt = $pdo->prepare("
                        INSERT INTO production_quantity_ledger 
                        (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                        VALUES (?, ?, 5, 'CUT', 'PROCESSED', ?, ?, ?, ?, 'Cutting Batch', ?, ?)
                    ");
                    $lStmt->execute([
                        $pId, 
                        $itemId, 
                        $actual, 
                        $batchNo, 
                        $data['operator'] ?? '', 
                        $data['supervisor'] ?? '', 
                        $batchNo, 
                        $vb['remarks'] ?? ($remarks ?: 'Fabric cutting completed, awaiting quality inspection')
                    ]);

                    $createdBatches[] = [
                        'id' => $batchId,
                        'batch_number' => $batchNo,
                        'production_order_item_id' => $itemId,
                        'actual_cut_quantity' => $actual,
                        'assigned_quantity' => $assigned,
                        'inspection_status' => 'Pending Inspection'
                    ];
                }

                $pdo->commit();

                Response::success([
                    'batches' => $createdBatches,
                    'count' => count($createdBatches),
                    'total_actual_cut' => array_reduce($createdBatches, fn($s, $b) => $s + $b['actual_cut_quantity'], 0)
                ], count($createdBatches) . " cutting batches recorded successfully. Ready for quality inspection.", 201);
                return;
            }

            $itemId = (int)($data['production_order_item_id'] ?? 0);
            $actual = (float)($data['actual_cut_quantity'] ?? 0);
            $assigned = (float)($data['assigned_quantity'] ?? $actual);

            if ($actual <= 0) {
                Response::error("Valid cut quantity is required", 422);
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
                (production_order_id, production_order_item_id, batch_number, cutting_date, assigned_quantity, actual_cut_quantity, rejected_quantity, rework_quantity, accepted_output_quantity, pending_quantity, operator, supervisor, machine_line, remarks, photo_urls, status, inspection_status) 
                VALUES (?, ?, ?, ?, ?, ?, 0.00, 0.00, 0.00, 0, ?, ?, ?, ?, ?, 'In Progress', 'Pending Inspection')
            ");
            $stmt->execute([
                $pId, 
                $itemId, 
                $batchNo, 
                $data['cutting_date'] ?? date('Y-m-d'), 
                $assigned, 
                $actual, 
                $data['operator'] ?? null, 
                $data['supervisor'] ?? null, 
                $data['machine_line'] ?? null, 
                $data['remarks'] ?? ($data['notes'] ?? ''), 
                json_encode($data['photo_urls'] ?? [])
            ]);
            $batchId = (int)$pdo->lastInsertId();

            // Ledger log for physical cutting output completed
            $lStmt = $pdo->prepare("
                INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 5, 'CUT', 'PROCESSED', ?, ?, ?, ?, 'Cutting Batch', ?, ?)
            ");
            $lStmt->execute([$pId, $itemId, $actual, $batchNo, $data['operator'] ?? '', $data['supervisor'] ?? '', $batchNo, $data['remarks'] ?? ($data['notes'] ?? 'Fabric cutting completed, awaiting quality inspection')]);

            Response::success([
                'id' => $batchId, 
                'batch_id' => $batchId, 
                'batch_number' => $batchNo, 
                'actual_cut_quantity' => $actual,
                'accepted_output_quantity' => 0.00,
                'inspection_status' => 'Pending Inspection'
            ], "Cutting batch recorded successfully. Available for quality inspection.", 201);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function transferCuttingOutput(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $bId = (int)($data['batch_id'] ?? 0);
            $bNo = trim($data['batch_number'] ?? '');
            $reworkId = (int)($data['rework_id'] ?? 0);
            $qty = (float)($data['transfer_quantity'] ?? 0);
            $destStageId = (int)($data['destination_stage_id'] ?? 6);
            $remarks = trim($data['remarks'] ?? ($data['notes'] ?? ''));

            if (($bId <= 0 && empty($bNo) && $reworkId <= 0) || $qty <= 0) {
                Response::error("Batch ID or batch number and positive transfer quantity are required", 422);
                return;
            }

            // Fetch rework record if provided
            $reworkRecord = null;
            if ($reworkId > 0) {
                $rwkCheckStmt = $pdo->prepare("SELECT * FROM rework_records WHERE id = ?");
                $rwkCheckStmt->execute([$reworkId]);
                $reworkRecord = $rwkCheckStmt->fetch();
            }

            // Fetch cutting batch
            $batch = null;
            if ($bId > 0) {
                $bStmt = $pdo->prepare("SELECT * FROM cutting_batches WHERE id = ?");
                $bStmt->execute([$bId]);
                $batch = $bStmt->fetch();
            }
            if (!$batch && !empty($bNo)) {
                $bStmt = $pdo->prepare("SELECT * FROM cutting_batches WHERE batch_number = ?");
                $bStmt->execute([$bNo]);
                $batch = $bStmt->fetch();
            }
            if (!$batch && $reworkRecord) {
                if (!empty($reworkRecord['batch_number'])) {
                    $bStmt = $pdo->prepare("SELECT * FROM cutting_batches WHERE batch_number = ?");
                    $bStmt->execute([$reworkRecord['batch_number']]);
                    $batch = $bStmt->fetch();
                }
                if (!$batch && !empty($reworkRecord['reference_id'])) {
                    $bStmt = $pdo->prepare("SELECT * FROM cutting_batches WHERE id = ? OR batch_number = ?");
                    $bStmt->execute([$reworkRecord['reference_id'], $reworkRecord['reference_id']]);
                    $batch = $bStmt->fetch();
                }
            }

            if (!$batch) {
                Response::error("Cutting batch not found", 404);
                return;
            }
            $bId = (int)$batch['id'];
            $bNo = $batch['batch_number'];
            $pOrderId = (int)$batch['production_order_id'];

            // Query active rework for this batch (pieces currently away at recut line)
            $rwkStmt = $pdo->prepare("
                SELECT COALESCE(SUM(rework_quantity), 0) 
                FROM rework_records 
                WHERE production_order_id = ? 
                  AND stage_id = 5 
                  AND (batch_number = ? OR reference_id = ? OR reference_id = ?)
                  AND status NOT IN ('Rework Received', 'Accepted After Rework', 'Completed', 'Transferred')
            ");
            $rwkStmt->execute([$pOrderId, $bNo, (string)$bId, $bNo]);
            $activeRwk = (float)$rwkStmt->fetchColumn();

            $cut = (float)$batch['actual_cut_quantity'];
            $rej = (float)$batch['rejected_quantity'];
            $trf = (float)$batch['transferred_to_next_stage_quantity'];

            // Available in hand right now = Cut - Active Rework (at recut line) - Scrap - Transferred
            $avail = max(0.0, $cut - $activeRwk - $rej - $trf);

            if ($qty > $avail + 0.001) {
                Response::error("Transfer quantity ({$qty} pcs) exceeds available cut output in hand ({$avail} pcs). " . ($activeRwk > 0 ? "{$activeRwk} pcs are currently sent for rework." : ""), 422);
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
            $newTrf = $trf + $qty;
            $maxEligible = max(0.0, $cut - $rej);
            $newStatus = ($newTrf >= $maxEligible - 0.001) ? 'Transferred' : 'Partial Transfer';

            $updBatch = $pdo->prepare("
                UPDATE cutting_batches 
                SET transferred_to_next_stage_quantity = ?,
                    accepted_output_quantity = GREATEST(accepted_output_quantity, ?),
                    destination_stage_id = ?,
                    destination_stage_name = ?,
                    status = ?
                WHERE id = ?
            ");
            $updBatch->execute([$newTrf, $newTrf, $destStageId, $destName, $newStatus, $bId]);

            // If this transfer was initiated from a rework record, mark that rework as 'Transferred'
            if ($reworkId > 0) {
                $updRwk = $pdo->prepare("UPDATE rework_records SET status = 'Transferred' WHERE id = ?");
                $updRwk->execute([$reworkId]);
            } else if ($newStatus === 'Transferred') {
                // If entire batch is transferred, mark any completed/received rework for this batch as Transferred
                $pdo->prepare("
                    UPDATE rework_records 
                    SET status = 'Transferred' 
                    WHERE production_order_id = ? 
                      AND stage_id = 5 
                      AND (batch_number = ? OR reference_id = ? OR reference_id = ?)
                      AND status IN ('Rework Received', 'Accepted After Rework', 'Completed')
                ")->execute([$pOrderId, $bNo, (string)$bId, $bNo]);
            }

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
        Auth::requireStageAccess(6);
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
            $rStmt = $pdo->prepare("
                SELECT er.*, ejo.job_order_number 
                FROM embroidery_receipts er 
                LEFT JOIN embroidery_job_orders ejo ON er.job_order_id = ejo.id 
                WHERE er.production_order_id = ? 
                ORDER BY er.id DESC
            ");
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

            // Fetch cutting transfers to Stage 6 from ledger and cutting_batches
            $cbStmt = $pdo->prepare("
                SELECT cb.*, poi.product_id, poi.color 
                FROM cutting_batches cb
                JOIN production_order_items poi ON cb.production_order_item_id = poi.id
                WHERE cb.production_order_id = ? AND cb.destination_stage_id = 6
            ");
            $cbStmt->execute([$orderId]);
            $cutBatchesToEmb = $cbStmt->fetchAll();

            $clStmt = $pdo->prepare("
                SELECT pql.*, poi.product_id, poi.color
                FROM production_quantity_ledger pql
                LEFT JOIN production_order_items poi ON pql.production_order_item_id = poi.id
                WHERE pql.production_order_id = ? AND pql.stage_id = 6 AND pql.transaction_type = 'TRANSFER_IN'
            ");
            $clStmt->execute([$orderId]);
            $cutLedgerToEmb = $clStmt->fetchAll();

            // Fetch transfers out of Stage 6 to Stitching
            $trfStmt = $pdo->prepare("
                SELECT pql.*, poi.product_id, poi.color 
                FROM production_quantity_ledger pql
                LEFT JOIN production_order_items poi ON pql.production_order_item_id = poi.id
                WHERE pql.production_order_id = ? AND pql.stage_id = 6 AND pql.transaction_type = 'TRANSFER_OUT'
                  AND (pql.reference_type LIKE '%Embroidery%' OR pql.remarks LIKE '%Stitching%')
            ");
            $trfStmt->execute([$orderId]);
            $transferredOutRows = $trfStmt->fetchAll();
            $totalOrderTransferredToStitching = array_reduce($transferredOutRows, fn($acc, $r) => $acc + (float)$r['quantity'], 0.0);

            // Fetch accepted rework records for this order
            $rwkStmt = $pdo->prepare("
                SELECT reference_id, reference_type, SUM(accepted_quantity) as sum_accepted 
                FROM rework_records 
                WHERE production_order_id = ? AND stage_id = 6 AND status = 'Accepted After Rework'
                GROUP BY reference_id, reference_type
            ");
            $rwkStmt->execute([$orderId]);
            $acceptedReworks = $rwkStmt->fetchAll();

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

                // Accurate Arrived from Cutting
                $cutToEmbQty = 0.0;
                foreach ($cutLedgerToEmb as $cl) {
                    $m = false;
                    if (!empty($cl['product_id']) && (int)$cl['product_id'] === $pId && trim((string)($cl['color'] ?? '')) === $color) $m = true;
                    if (!$m && count($groupedItems) === 1) $m = true;
                    if ($m) $cutToEmbQty += (float)$cl['quantity'];
                }
                if ($cutToEmbQty <= 0.001) {
                    foreach ($cutBatchesToEmb as $cb) {
                        $m = false;
                        if (!empty($cb['product_id']) && (int)$cb['product_id'] === $pId && trim((string)($cb['color'] ?? '')) === $color) $m = true;
                        if (!$m && count($groupedItems) === 1) $m = true;
                        if ($m) {
                            $trf = (float)($cb['transferred_to_next_stage_quantity'] ?? 0);
                            $cutToEmbQty += ($trf > 0 ? $trf : (float)$cb['accepted_output_quantity']);
                        }
                    }
                }
                if ($cutToEmbQty > 0) {
                    $gIt['arrived_from_cutting'] = $cutToEmbQty;
                }

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
                    $matchedInReceipt = false;
                    $itemAcceptedFound = false;

                    foreach ($rItems as $ri) {
                        $m = false;
                        if (!empty($ri['production_order_item_id']) && $ri['production_order_item_id'] == $gIt['active_embroidery_item_id']) $m = true;
                        if (!empty($ri['product_id']) && $ri['product_id'] == $pId && trim((string)($ri['color'] ?? '')) === $color) $m = true;
                        if ($m) {
                            $matchedInReceipt = true;
                            $received += (float)($ri['received_quantity'] ?? 0);
                            if (isset($ri['accepted_quantity']) && (float)$ri['accepted_quantity'] > 0) {
                                $accepted += (float)$ri['accepted_quantity'];
                                $itemAcceptedFound = true;
                            }
                            $rejected += (float)($ri['rejected_quantity'] ?? 0);
                            $rework += (float)($ri['rework_quantity'] ?? 0);
                        }
                    }

                    if (!$matchedInReceipt && count($groupedItems) === 1) {
                        $matchedInReceipt = true;
                        $received += (float)($rcpt['total_received_qty'] ?? 0);
                    }

                    // Fallback to receipt-level totals if items_data has no accepted_quantity key
                    if ($matchedInReceipt && !$itemAcceptedFound && (float)($rcpt['total_accepted_qty'] ?? 0) > 0) {
                        $accepted += (float)$rcpt['total_accepted_qty'];
                        $rejected += (float)($rcpt['total_rejected_qty'] ?? 0);
                        $rework += (float)($rcpt['total_rework_qty'] ?? 0);
                    }
                }

                // Cross-check: If accepted quantity is still 0 or less than job orders' accepted quantity
                $jobAccForThisItem = 0.0;
                $jobRejForThisItem = 0.0;
                $jobRwkForThisItem = 0.0;
                foreach ($jobs as $job) {
                    $jItems = $job['items_json'] ?? [];
                    $jMatched = false;
                    foreach ($jItems as $ji) {
                        $m = false;
                        if (!empty($ji['production_order_item_id']) && $ji['production_order_item_id'] == $gIt['active_embroidery_item_id']) $m = true;
                        if (!empty($ji['product_id']) && (int)$ji['product_id'] === $pId && trim((string)($ji['color'] ?? '')) === $color) $m = true;
                        if ($m) {
                            $jMatched = true;
                            if (isset($ji['accepted_quantity']) && (float)$ji['accepted_quantity'] > 0) {
                                $jobAccForThisItem += (float)$ji['accepted_quantity'];
                            }
                        }
                    }
                    if (!$jMatched && count($groupedItems) === 1) {
                        $jobAccForThisItem += (float)($job['total_quantity_accepted'] ?? 0);
                        $jobRejForThisItem += (float)($job['total_quantity_rejected'] ?? 0);
                        $jobRwkForThisItem += (float)($job['total_quantity_rework'] ?? 0);
                    }
                }

                if ($jobAccForThisItem > $accepted) {
                    $accepted = $jobAccForThisItem;
                    if ($rejected <= 0) $rejected = $jobRejForThisItem;
                    if ($rework <= 0) $rework = $jobRwkForThisItem;
                }

                // If single-item order, reconcile with total receipts accepted
                if (count($groupedItems) === 1) {
                    $totalAllReceiptsAccepted = array_reduce($receipts, fn($s, $r) => $s + (float)($r['total_accepted_qty'] ?? 0), 0.0);
                    if ($totalAllReceiptsAccepted > $accepted) {
                        $accepted = $totalAllReceiptsAccepted;
                    }
                }

                // Check accepted rework matching this item or job orders
                foreach ($acceptedReworks as $ar) {
                    $ref = trim((string)$ar['reference_id']);
                    $matchesRwk = false;
                    foreach ($jobs as $job) {
                        if ($ref === (string)$job['id'] || $ref === (string)$job['job_order_number']) {
                            $matchesRwk = true;
                            break;
                        }
                    }
                    if (!$matchesRwk) {
                        foreach ($receipts as $rc) {
                            if ($ref === (string)$rc['id'] || $ref === (string)$rc['receipt_number']) {
                                $matchesRwk = true;
                                break;
                            }
                        }
                    }
                    if ($matchesRwk && $accepted < $sent) {
                        $accepted = min($sent, $accepted + (float)$ar['sum_accepted']);
                    }
                }

                if ($received < $accepted) {
                    $received = $accepted;
                }

                if ($sent > $gIt['arrived_from_cutting']) {
                    $gIt['arrived_from_cutting'] = $sent;
                }

                // Transferred out to Stitching
                $transferredToStitching = 0.0;
                foreach ($transferredOutRows as $tRow) {
                    $m = false;
                    if (!empty($tRow['product_id']) && (int)$tRow['product_id'] === $pId && trim((string)($tRow['color'] ?? '')) === $color) $m = true;
                    if (!$m && count($groupedItems) === 1) $m = true;
                    if ($m) $transferredToStitching += (float)$tRow['quantity'];
                }
                $transferredToStitching = min($accepted, $transferredToStitching);

                $gIt['sent_to_vendor'] = $sent;
                $gIt['received_inward'] = $received;
                $gIt['accepted_inward'] = $accepted;
                $gIt['rejected_quantity'] = $rejected;
                $gIt['rework_quantity'] = $rework;
                $gIt['outstanding_quantity'] = max(0.0, $sent - $received);
                $gIt['available_to_dispatch'] = max(0.0, (float)$gIt['arrived_from_cutting'] - $sent);
                $gIt['transferred_to_stitching'] = $transferredToStitching;
                $gIt['ready_to_transfer'] = max(0.0, $received - $transferredToStitching);
            }
            unset($gIt);

            // Update each job order with transferred, received, and ready_to_transfer quantities
            foreach ($jobs as &$job) {
                $jRec = (float)($job['total_quantity_received'] ?? 0);
                $jTrf = (float)($job['transferred_to_stitching_quantity'] ?? 0);
                if ($jTrf <= 0 && $totalOrderTransferredToStitching > 0) {
                    $jTrf = min($jRec, $totalOrderTransferredToStitching);
                }
                $job['transferred_to_stitching_quantity'] = $jTrf;
                $job['ready_to_transfer'] = max(0.0, $jRec - $jTrf);
                $job['total_quantity_available_to_transfer'] = max(0.0, $jRec - $jTrf);
                if ($job['ready_to_transfer'] <= 0.001 && $jRec > 0) {
                    $job['status'] = 'Transferred to Stitching';
                }
            }
            unset($job);

            // Update each receipt with transferred and available_to_transfer
            foreach ($receipts as &$rcpt) {
                $jId = (int)($rcpt['job_order_id'] ?? 0);
                $matchedJob = null;
                foreach ($jobs as $j) {
                    if ((int)$j['id'] === $jId) {
                        $matchedJob = $j;
                        break;
                    }
                }
                $rRec = (float)($rcpt['total_received_qty'] ?? 0);
                $jTrf = $matchedJob ? (float)($matchedJob['transferred_to_stitching_quantity'] ?? 0) : 0.0;
                $rcpt['transferred_to_stitching_quantity'] = min($rRec, $jTrf);
                $rcpt['available_to_transfer'] = max(0.0, $rRec - $rcpt['transferred_to_stitching_quantity']);
            }
            unset($rcpt);

            $items = array_values($groupedItems);

            $rwkStmt = $pdo->prepare("
                SELECT rw.*, 
                       COALESCE(bp.product_name, p.name, rw.product_name) as display_product_name,
                       COALESCE(bp.product_code, p.code) as display_product_code
                FROM rework_records rw
                LEFT JOIN production_order_items poi ON rw.production_order_item_id = poi.id
                LEFT JOIN buyer_products bp ON (rw.product_id = bp.id OR poi.product_id = bp.id)
                LEFT JOIN products p ON (rw.product_id = p.id OR poi.product_id = p.id)
                WHERE rw.production_order_id = ? AND rw.stage_id = 6
                ORDER BY rw.id DESC
            ");
            $rwkStmt->execute([$orderId]);
            $reworks = $rwkStmt->fetchAll();

            $insStmt = $pdo->prepare("SELECT * FROM quality_inspections WHERE production_order_id = ? AND stage_id = 6 ORDER BY id DESC");
            $insStmt->execute([$orderId]);
            $inspections = $insStmt->fetchAll();

            Response::success([
                'order' => $ord,
                'items' => $items,
                'job_orders' => $jobs,
                'receipts' => $receipts,
                'inspections' => $inspections,
                'rework_records' => $reworks
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
                $data['vendor_name'] ?? 'Embroidery Unit', 
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

            if ($jId <= 0 || $recTotal <= 0) {
                Response::error("Job order ID and positive received quantity are required", 422);
                return;
            }

            $jStmt = $pdo->prepare("SELECT * FROM embroidery_job_orders WHERE id = ?");
            $jStmt->execute([$jId]);
            $job = $jStmt->fetch();
            if (!$job) { Response::error("Job order not found", 404); return; }

            // Insert receipt with initial accepted/rework/rejected at 0 pending inspection
            $stmt = $pdo->prepare("INSERT INTO embroidery_receipts 
                (receipt_number, job_order_id, production_order_id, vendor_name, receipt_date, vendor_challan_no, received_by, total_received_qty, total_accepted_qty, total_rejected_qty, total_rework_qty, remarks, photo_urls, items_data, inspection_status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, 0.00, ?, ?, ?, 'Pending Inspection')");
            $stmt->execute([
                $recNo, 
                $jId, 
                $job['production_order_id'], 
                $job['vendor_name'], 
                $data['receipt_date'] ?? date('Y-m-d'), 
                $data['vendor_challan_no'] ?? '', 
                $data['received_by'] ?? '', 
                $recTotal, 
                $data['remarks'] ?? '', 
                json_encode($data['photo_urls'] ?? []), 
                json_encode($items)
            ]);
            $receiptId = (int)$pdo->lastInsertId();

            // Update job order physical inward totals (accepted totals updated separately upon inspection)
            $newRec = (float)$job['total_quantity_received'] + $recTotal;
            $sent = (float)$job['total_quantity_sent'];
            $newOut = max(0.0, $sent - $newRec);
            $newStatus = ($newOut <= 0.01) ? 'Received' : 'Partially Received';

            $upd = $pdo->prepare("UPDATE embroidery_job_orders SET 
                total_quantity_received = ?, 
                total_quantity_outstanding = ?,
                status = ?
                WHERE id = ?");
            $upd->execute([$newRec, $newOut, $newStatus, $jId]);

            // Log physical inward receipt in quantity ledger
            foreach ($items as $it) {
                $itId = (int)($it['production_order_item_id'] ?? 0);
                $itRec = (float)($it['received_quantity'] ?? 0);

                if ($itRec > 0) {
                    $lStmt = $pdo->prepare("
                        INSERT INTO production_quantity_ledger 
                        (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                        VALUES (?, ?, 6, 'EMB', 'RECEIVED_INWARD', ?, ?, ?, ?, 'Embroidery Inward Receipt', ?, ?)
                    ");
                    $lStmt->execute([
                        $job['production_order_id'], 
                        $itId, 
                        $itRec, 
                        $job['job_order_number'], 
                        $data['received_by'] ?? '', 
                        '', 
                        $recNo, 
                        "Physical inward received from {$job['vendor_name']}; pending quality inspection"
                    ]);
                }
            }

            Response::success([
                'id' => $receiptId,
                'receipt_number' => $recNo,
                'received_qty' => $recTotal,
                'accepted_qty' => 0.00,
                'outstanding_qty' => $newOut,
                'status' => $newStatus,
                'inspection_status' => 'Pending Inspection'
            ], "Embroidery physical inward recorded successfully. Ready for quality inspection.", 201);
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
            $jobId = (int)($data['job_order_id'] ?? 0);
            $reworkId = (int)($data['rework_id'] ?? 0);
            $remarks = trim($data['remarks'] ?? 'Transferred completed embroidery to Stitching');

            if ($pId <= 0 || $qty <= 0) {
                Response::error("Production order ID and positive transfer quantity are required", 422);
                return;
            }

            $pdo->beginTransaction();

            // 1. Calculate total eligible received embroidery and already transferred quantity
            $recStmt = $pdo->prepare("SELECT COALESCE(SUM(total_received_qty), 0) FROM embroidery_receipts WHERE production_order_id = ?");
            $recStmt->execute([$pId]);
            $totalReceived = (float)$recStmt->fetchColumn();

            $jRecStmt = $pdo->prepare("SELECT COALESCE(SUM(total_quantity_received), 0) FROM embroidery_job_orders WHERE production_order_id = ?");
            $jRecStmt->execute([$pId]);
            $jobReceived = (float)$jRecStmt->fetchColumn();

            $rwkStmt = $pdo->prepare("SELECT COALESCE(SUM(accepted_quantity), 0) FROM rework_records WHERE production_order_id = ? AND stage_id = 6 AND status IN ('Accepted After Rework', 'Rework Received', 'Completed')");
            $rwkStmt->execute([$pId]);
            $reworkAccepted = (float)$rwkStmt->fetchColumn();

            $eligibleReceived = max($totalReceived, $jobReceived);

            // Calculate active rework at stage 6 (still away at vendor)
            $rwkActiveStmt = $pdo->prepare("
                SELECT COALESCE(SUM(rework_quantity), 0) 
                FROM rework_records 
                WHERE production_order_id = ? AND stage_id = 6 
                  AND status NOT IN ('Accepted After Rework', 'Rework Received', 'Transferred', 'Scrapped', 'Completed')
            ");
            $rwkActiveStmt->execute([$pId]);
            $activeRework = (float)$rwkActiveStmt->fetchColumn();

            $trfStmt = $pdo->prepare("
                SELECT COALESCE(SUM(quantity), 0) 
                FROM production_quantity_ledger 
                WHERE production_order_id = ? AND stage_id = 6 AND transaction_type = 'TRANSFER_OUT' 
                  AND (reference_type LIKE '%Embroidery%' OR remarks LIKE '%Stitching%')
                FOR UPDATE
            ");
            $trfStmt->execute([$pId]);
            $alreadyTransferred = (float)$trfStmt->fetchColumn();

            $eligibleToTransfer = max(0.0, $eligibleReceived - $activeRework - $alreadyTransferred);

            if ($eligibleToTransfer <= 0.001) {
                $pdo->rollBack();
                Response::error("All received embroidery pieces ({$eligibleReceived} pcs) have already been transferred to Stitching.", 422);
                return;
            }

            if ($qty > $eligibleToTransfer + 0.001) {
                $pdo->rollBack();
                Response::error("Transfer quantity ({$qty}) exceeds available received output ({$eligibleToTransfer})", 422);
                return;
            }

            // 2. Build transfer entries (supports individual item transfer or itemized job order transfer)
            $transferEntries = [];
            if (!empty($data['items']) && is_array($data['items'])) {
                foreach ($data['items'] as $itEntry) {
                    $entryQty = (float)($itEntry['quantity'] ?? $itEntry['transfer_quantity'] ?? 0);
                    $entryItemId = (int)($itEntry['item_id'] ?? $itEntry['production_order_item_id'] ?? 0);
                    if ($entryQty > 0 && $entryItemId > 0) {
                        $transferEntries[] = ['item_id' => $entryItemId, 'quantity' => $entryQty];
                    }
                }
            } else if ($jobId > 0 && ($itemId <= 0 || empty($data['item_id']))) {
                // If a job order was transferred without specifying item_id, read its items_json
                $jStmt = $pdo->prepare("SELECT * FROM embroidery_job_orders WHERE id = ?");
                $jStmt->execute([$jobId]);
                $jOrder = $jStmt->fetch();
                if ($jOrder && !empty($jOrder['items_json'])) {
                    $jItems = json_decode($jOrder['items_json'], true) ?: [];
                    foreach ($jItems as $ji) {
                        $jItemQty = (float)($ji['quantity_sent'] ?? 0);
                        $jItemId = (int)($ji['production_order_item_id'] ?? 0);
                        if ($jItemQty > 0 && $jItemId > 0) {
                            $transferEntries[] = ['item_id' => $jItemId, 'quantity' => $jItemQty];
                        }
                    }
                }
            }

            if (empty($transferEntries)) {
                $transferEntries[] = ['item_id' => $itemId, 'quantity' => $qty];
            }

            $lastEffectiveDestItemId = 0;
            foreach ($transferEntries as $entry) {
                $eItemId = $entry['item_id'];
                $eQty = $entry['quantity'];
                if ($eQty <= 0) continue;

                $item = null;
                if ($eItemId > 0) {
                    $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE id = ? FOR UPDATE");
                    $iStmt->execute([$eItemId]);
                    $item = $iStmt->fetch();
                }
                if (!$item || (int)$item['current_stage_id'] !== 6) {
                    $fStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? AND current_stage_id = 6 ORDER BY id ASC LIMIT 1 FOR UPDATE");
                    $fStmt->execute([$pId]);
                    $item = $fStmt->fetch();
                }
                if (!$item) {
                    $fStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? ORDER BY id ASC LIMIT 1 FOR UPDATE");
                    $fStmt->execute([$pId]);
                    $item = $fStmt->fetch();
                }
                if (!$item) continue;

                $effectiveDestItemId = 0;
                // Check if an item already exists in Stage 7 for the same order, product, and color
                $matchStmt = $pdo->prepare("
                    SELECT id FROM production_order_items 
                    WHERE production_order_id = ? AND product_id = ? AND color = ? AND current_stage_id = ?
                    LIMIT 1
                ");
                $matchStmt->execute([$pId, $item['product_id'], $item['color'], $destStageId]);
                $existingDestItemId = $matchStmt->fetchColumn();

                if ($existingDestItemId && (int)$existingDestItemId !== (int)$item['id']) {
                    $effectiveDestItemId = (int)$existingDestItemId;
                    // Add quantity to existing item at Stitching stage - NEVER inflate total_quantity!
                    $pdo->prepare("
                        UPDATE production_order_items 
                        SET current_stage_quantity = current_stage_quantity + ?,
                            status = 'In Progress'
                        WHERE id = ?
                    ")->execute([$eQty, $existingDestItemId]);

                    // Deduct from current item at Embroidery stage
                    $remQty = max(0.0, (float)$item['current_stage_quantity'] - $eQty);
                    if ($remQty <= 0.001 && (int)$item['current_stage_id'] === 6) {
                        $pdo->prepare("DELETE FROM production_order_items WHERE id = ?")->execute([$item['id']]);
                    } else {
                        $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = ? WHERE id = ?")->execute([$remQty, $item['id']]);
                    }
                } else {
                    $curStageQty = (float)($item['current_stage_quantity'] ?? 0);
                    if (($eQty >= $curStageQty - 0.001 && $curStageQty > 0) || (int)$item['current_stage_id'] === 6) {
                        // Entire item advances to destination stage! NEVER mutate total_quantity!
                        $pdo->prepare("
                            UPDATE production_order_items 
                            SET current_stage_id = ?,
                                current_stage_quantity = ?,
                                status = 'In Progress'
                            WHERE id = ?
                        ")->execute([$destStageId, $eQty, $item['id']]);
                        $effectiveDestItemId = (int)$item['id'];
                    } else {
                        // Split item: reduce current item in embroidery, create new item in stitching
                        $remStageQty = max(0.0, $curStageQty - $eQty);
                        $pdo->prepare("UPDATE production_order_items SET current_stage_quantity = ? WHERE id = ?")
                            ->execute([$remStageQty, $item['id']]);

                        $insNewItem = $pdo->prepare("
                            INSERT INTO production_order_items 
                            (production_order_id, product_id, color, total_quantity, current_stage_id, current_stage_quantity, completed_quantity, rejected_quantity, rework_quantity, status) 
                            VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 'In Progress')
                        ");
                        $insNewItem->execute([
                            $pId,
                            $item['product_id'],
                            $item['color'],
                            $item['total_quantity'],
                            $destStageId,
                            $eQty
                        ]);
                        $effectiveDestItemId = (int)$pdo->lastInsertId();
                    }
                }
                $lastEffectiveDestItemId = $effectiveDestItemId;

                // Log stage transaction per item
                $tStmt = $pdo->prepare("
                    INSERT INTO production_stage_transactions (production_order_item_id, from_stage_id, to_stage_id, quantity_moved, remarks)
                    VALUES (?, 6, ?, ?, ?)
                ");
                $tStmt->execute([$effectiveDestItemId ?: ($item['id'] ?? 0), $destStageId, $eQty, $remarks]);

                // Log quantity ledger per item (both OUT from Stage 6 and IN to Stage 7)
                $lStmt = $pdo->prepare("
                    INSERT INTO production_quantity_ledger 
                    (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                    VALUES (?, ?, 6, 'EMB', 'TRANSFER_OUT', ?, '', ?, ?, 'Embroidery Transfer', ?, ?)
                ");
                $lStmt->execute([$pId, $item['id'] ?? 0, $eQty, $data['operator_name'] ?? '', $data['supervisor_name'] ?? '', (string)$destStageId, "Transferred to {$destName}"]);

                $lStmtIn = $pdo->prepare("
                    INSERT INTO production_quantity_ledger 
                    (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                    VALUES (?, ?, ?, 'STI', 'TRANSFER_IN', ?, '', ?, ?, 'Embroidery Transfer', ?, ?)
                ");
                $lStmtIn->execute([$pId, $effectiveDestItemId ?: ($item['id'] ?? 0), $destStageId, $eQty, $data['operator_name'] ?? '', $data['supervisor_name'] ?? '', (string)$destStageId, "Received from Embroidery"]);
            }

            // 3. Update embroidery_job_orders transferred quantity and status
            if ($jobId > 0) {
                $pdo->prepare("
                    UPDATE embroidery_job_orders 
                    SET transferred_to_stitching_quantity = transferred_to_stitching_quantity + ?,
                        status = IF(total_quantity_received > 0 AND (transferred_to_stitching_quantity + ?) >= (total_quantity_received - 0.001), 'Transferred to Stitching', status)
                    WHERE id = ?
                ")->execute([$qty, $qty, $jobId]);
            } else {
                $jList = $pdo->prepare("SELECT id, total_quantity_received, total_quantity_accepted, transferred_to_stitching_quantity FROM embroidery_job_orders WHERE production_order_id = ? AND total_quantity_received > 0 ORDER BY id ASC");
                $jList->execute([$pId]);
                $remToAlloc = $qty;
                foreach ($jList->fetchAll() as $jRow) {
                    if ($remToAlloc <= 0) break;
                    $jRec = (float)($jRow['total_quantity_received'] ?: $jRow['total_quantity_accepted']);
                    $jAvail = max(0.0, $jRec - (float)$jRow['transferred_to_stitching_quantity']);
                    if ($jAvail > 0) {
                        $alloc = min($remToAlloc, $jAvail);
                        $newTrf = (float)$jRow['transferred_to_stitching_quantity'] + $alloc;
                        $newSt = ($newTrf >= $jRec - 0.001) ? 'Transferred to Stitching' : 'Received';
                        $pdo->prepare("UPDATE embroidery_job_orders SET transferred_to_stitching_quantity = ?, status = ? WHERE id = ?")->execute([$newTrf, $newSt, $jRow['id']]);
                        $remToAlloc -= $alloc;
                    }
                }
            }

            // 3b. Update rework record status if transferring from rework
            if ($reworkId > 0) {
                $pdo->prepare("UPDATE rework_records SET status = 'Transferred' WHERE id = ?")->execute([$reworkId]);
            }

            $pdo->commit();

            try {
                $pInfo = $pdo->query("SELECT order_number, title FROM production_orders WHERE id = {$pId}")->fetch();
                if ($pInfo) {
                    NotificationService::notifyStageTransition($pdo, $pId, 6, $destStageId, $pInfo['order_number'], $pInfo['title'], "Transferred {$qty} pcs from Embroidery to Stitching");
                }
            } catch (Throwable $ne) {}
            $newRemaining = max(0.0, $eligibleToTransfer - $qty);
            Response::success([
                'transferred_quantity' => $qty,
                'remaining_eligible_quantity' => $newRemaining,
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
            $stmt = $pdo->query("
                SELECT po.*, cu.name as customer_name,
                       (SELECT COUNT(*) FROM stitching_batches WHERE production_order_id = po.id) as batches_count,
                       (SELECT COALESCE(SUM(quantity), 0) FROM production_quantity_ledger WHERE production_order_id = po.id AND stage_id = 7 AND transaction_type = 'TRANSFER_IN') as arrived_quantity,
                       (SELECT COALESCE(SUM(completed_quantity), 0) FROM stitching_batches WHERE production_order_id = po.id) as completed_quantity
                FROM production_orders po 
                LEFT JOIN customers cu ON po.customer_id = cu.id 
                WHERE po.deleted_at IS NULL 
                ORDER BY po.id DESC
            ");
            $orders = $stmt->fetchAll();
            foreach ($orders as &$ord) {
                $arr = (float)($ord['arrived_quantity'] ?? 0);
                $comp = (float)($ord['completed_quantity'] ?? 0);
                $tot = (float)($ord['total_quantity'] ?? 0);
                $ord['pending_stitching'] = max(0.0, $arr - $comp);
                $ord['awaiting_transfer'] = max(0.0, $tot - $arr);
            }
            unset($ord);
            Response::success($orders);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function stitchingOrderDetails(int $orderId): void {
        Auth::requireStageAccess(7);
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

            $rwkStmt = $pdo->prepare("
                SELECT rw.*, 
                       COALESCE(bp.product_name, p.name, rw.product_name) as display_product_name,
                       COALESCE(bp.product_code, p.code) as display_product_code
                FROM rework_records rw
                LEFT JOIN production_order_items poi ON rw.production_order_item_id = poi.id
                LEFT JOIN buyer_products bp ON (rw.product_id = bp.id OR poi.product_id = bp.id)
                LEFT JOIN products p ON (rw.product_id = p.id OR poi.product_id = p.id)
                WHERE rw.production_order_id = ? AND rw.stage_id = 7
                ORDER BY rw.id DESC
            ");
            $rwkStmt->execute([$orderId]);
            $reworks = $rwkStmt->fetchAll();

            foreach ($batches as &$b) {
                if (isset($b['photo_urls']) && is_string($b['photo_urls'])) {
                    $b['photo_urls'] = json_decode($b['photo_urls'], true) ?: [];
                }
                $bNo = $b['batch_number'] ?? '';
                $bId = (string)($b['id'] ?? '');

                // Filter rework records belonging to this batch
                $batchReworks = array_filter($reworks, function($r) use ($bNo, $bId) {
                    return (!empty($r['batch_number']) && $r['batch_number'] === $bNo) ||
                           (!empty($r['reference_id']) && ((string)$r['reference_id'] === $bId || (string)$r['reference_id'] === $bNo));
                });

                $activeRwk = 0.0;
                $receivedRwk = 0.0;
                $totalRwk = 0.0;
                foreach ($batchReworks as $rwk) {
                    $rQty = (float)($rwk['rework_quantity'] ?? 0);
                    $totalRwk += $rQty;
                    $st = $rwk['status'] ?? '';
                    if ($st === 'Rework Received' || $st === 'Accepted After Rework' || $st === 'Completed') {
                        $receivedRwk += (float)($rwk['accepted_quantity'] ?? $rQty);
                    } else {
                        // Still away at alteration line
                        $activeRwk += $rQty;
                    }
                }

                $comp = (float)($b['completed_quantity'] ?? 0);
                $acc = (float)($b['accepted_quantity'] ?? 0);
                $rej = (float)($b['rejected_quantity'] ?? 0);
                $trf = (float)($b['transferred_quantity'] ?? 0);

                // Output in hand right now = Completed - Active Rework (at alteration/rework line)
                // Available to transfer = Output in hand - Transferred
                $stitchedInHand = max(0.0, $comp - $activeRwk);
                $availableInHand = max(0.0, $stitchedInHand - $trf);

                $b['rework_quantity'] = $totalRwk;
                $b['active_rework_quantity'] = $activeRwk;
                $b['received_rework_quantity'] = $receivedRwk;
                $b['completed_output_quantity'] = $comp;
                $b['accepted_output_quantity'] = $comp;
                $b['available_quantity'] = $availableInHand;
                $b['ready_to_transfer'] = $availableInHand;
            }
            unset($b);

            // Cutting batches with destination stage 7
            $cStmt = $pdo->prepare("
                SELECT cb.*, poi.product_id, poi.color 
                FROM cutting_batches cb
                JOIN production_order_items poi ON cb.production_order_item_id = poi.id
                WHERE cb.production_order_id = ?
            ");
            $cStmt->execute([$orderId]);
            $cuttingBatches = $cStmt->fetchAll();

            // Incoming ledger transfers directly from Cutting to Stage 7
            $lStmtInCut = $pdo->prepare("
                SELECT pql.*, poi.product_id, poi.color
                FROM production_quantity_ledger pql
                LEFT JOIN production_order_items poi ON pql.production_order_item_id = poi.id
                WHERE pql.production_order_id = ? AND pql.stage_id = 7 AND pql.transaction_type = 'TRANSFER_IN'
                  AND (pql.reference_type = 'Cutting Stage Transfer' OR pql.remarks LIKE '%Cutting%')
            ");
            $lStmtInCut->execute([$orderId]);
            $cuttingLedgerIn = $lStmtInCut->fetchAll();

            // Incoming ledger transfers from Embroidery to Stage 7
            $lStmtInEmb = $pdo->prepare("
                SELECT pql.*, poi.product_id, poi.color
                FROM production_quantity_ledger pql
                LEFT JOIN production_order_items poi ON pql.production_order_item_id = poi.id
                WHERE pql.production_order_id = ? AND pql.stage_id = 7 AND pql.transaction_type = 'TRANSFER_IN'
                  AND (pql.reference_type LIKE '%Embroidery%' OR pql.remarks LIKE '%Embroidery%')
            ");
            $lStmtInEmb->execute([$orderId]);
            $embroideryLedgerIn = $lStmtInEmb->fetchAll();

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
                foreach ($cuttingLedgerIn as $lin) {
                    $m = false;
                    if (!empty($lin['product_id']) && (int)$lin['product_id'] === $pId && trim((string)($lin['color'] ?? '')) === $color) $m = true;
                    if (!$m && count($groupedItems) === 1) $m = true;
                    if ($m) {
                        $arrivedFromCutting += (float)$lin['quantity'];
                    }
                }
                if ($arrivedFromCutting <= 0.001) {
                    foreach ($cuttingBatches as $cb) {
                        $cbDest = (int)($cb['destination_stage_id'] ?? 6);
                        if ($cbDest === 7) {
                            $m = false;
                            if (!empty($cb['product_id']) && (int)$cb['product_id'] === $pId && trim((string)($cb['color'] ?? '')) === $color) $m = true;
                            if (!$m && count($groupedItems) === 1) $m = true;
                            if ($m) {
                                $trf = (float)($cb['transferred_to_next_stage_quantity'] ?? 0);
                                $arrivedFromCutting += ($trf > 0 ? $trf : (float)$cb['accepted_output_quantity']);
                            }
                        }
                    }
                }

                // 2. Arrived from Embroidery (accepted pieces transferred to Stitching)
                $arrivedFromEmbroidery = 0.0;
                foreach ($embroideryLedgerIn as $lein) {
                    $m = false;
                    if (!empty($lein['product_id']) && (int)$lein['product_id'] === $pId && trim((string)($lein['color'] ?? '')) === $color) $m = true;
                    if (!$m && count($groupedItems) === 1) $m = true;
                    if ($m) {
                        $arrivedFromEmbroidery += (float)$lein['quantity'];
                    }
                }

                // Total accepted from embroidery receipts for this product/color
                $accEmbThisItem = 0.0;
                foreach ($embReceipts as $rcpt) {
                    $rItems = $rcpt['items_data'] ?? [];
                    foreach ($rItems as $ri) {
                        $m = false;
                        if (!empty($ri['product_id']) && (int)$ri['product_id'] === $pId && trim((string)($ri['color'] ?? '')) === $color) $m = true;
                        if (!$m && count($groupedItems) === 1) $m = true;
                        if ($m) {
                            $accEmbThisItem += (float)($ri['accepted_quantity'] ?? 0);
                        }
                    }
                }
                if ($accEmbThisItem <= 0.001) {
                    foreach ($embJobs as $job) {
                        $jItems = $job['items_json'] ?? [];
                        foreach ($jItems as $ji) {
                            $m = false;
                            if (!empty($ji['product_id']) && (int)$ji['product_id'] === $pId && trim((string)($ji['color'] ?? '')) === $color) $m = true;
                            if (!$m && count($groupedItems) === 1) $m = true;
                            if ($m) {
                                $accEmbThisItem += (float)($ji['total_quantity_accepted'] ?? $ji['received_quantity'] ?? 0);
                            }
                        }
                    }
                }
                if ($accEmbThisItem <= 0.001 && count($groupedItems) === 1) {
                    foreach ($embReceipts as $rcpt) {
                        $accEmbThisItem += (float)($rcpt['total_accepted_qty'] ?? 0);
                    }
                }
                if ($accEmbThisItem <= 0.001) {
                    foreach ($embJobs as $job) {
                        $accEmbThisItem += (float)($job['total_quantity_accepted'] ?? 0);
                    }
                }
                if ($accEmbThisItem > 0) {
                    // Prevent duplicate ledger transfers from exceeding total accepted embroidery
                    $arrivedFromEmbroidery = min($arrivedFromEmbroidery, $accEmbThisItem);
                }

                // Total Arrived at Stitching
                $totalArrived = $arrivedFromCutting + $arrivedFromEmbroidery;
                if ($totalArrived <= 0 && $gIt['current_stage_quantity'] > 0) {
                    $totalArrived = (float)$gIt['current_stage_quantity'];
                }

                // Original order quantity
                $orderQty = (float)$gIt['order_quantity'];
                if (count($groupedItems) === 1 && !empty($ord['total_quantity'])) {
                    $orderQty = max($orderQty, (float)$ord['total_quantity']);
                }
                $gIt['order_quantity'] = $orderQty;

                // 3. Stitched batches recorded
                $stitchedComp = 0.0;
                $stitchedAcc = 0.0;
                $stitchedRej = 0.0;
                $stitchedRwk = 0.0;
                $stitchedTrans = 0.0;
                foreach ($batches as &$b) {
                    $bComp = (float)($b['completed_quantity'] ?? 0);
                    $bAcc = (float)($b['accepted_quantity'] ?? 0);
                    $bTrans = (float)($b['transferred_quantity'] ?? 0);
                    $isTr = ($b['status'] === 'Transferred to Checking' || ($bTrans > 0 && $bTrans >= ($bComp - 0.001)));
                    $b['is_transferred'] = $isTr;
                    if ($isTr) {
                        $b['status'] = 'Transferred to Checking';
                    }

                    $m = false;
                    if ((int)$b['production_order_item_id'] === (int)$gIt['active_stitching_item_id']) $m = true;
                    if (trim((string)($b['color'] ?? '')) === $color) $m = true;
                    if ($m) {
                        $stitchedComp += $bComp;
                        $stitchedAcc += $bAcc;
                        $stitchedRej += (float)($b['rejected_quantity'] ?? 0);
                        $stitchedRwk += (float)($b['rework_quantity'] ?? 0);
                        if ($isTr) {
                            $stitchedTrans += ($bTrans > 0 ? $bTrans : $bComp);
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
                $gIt['awaiting_transfer'] = max(0.0, $orderQty - $totalArrived);
                $gIt['ready_to_transfer'] = max(0.0, $stitchedComp - $transferredToChecking);
            }
            unset($gIt);

            $items = array_values($groupedItems);

            $rwkStmt = $pdo->prepare("
                SELECT rw.*, 
                       COALESCE(bp.product_name, p.name, rw.product_name) as display_product_name,
                       COALESCE(bp.product_code, p.code) as display_product_code
                FROM rework_records rw
                LEFT JOIN production_order_items poi ON rw.production_order_item_id = poi.id
                LEFT JOIN buyer_products bp ON (rw.product_id = bp.id OR poi.product_id = bp.id)
                LEFT JOIN products p ON (rw.product_id = p.id OR poi.product_id = p.id)
                WHERE rw.production_order_id = ? AND rw.stage_id = 7
                ORDER BY rw.id DESC
            ");
            $rwkStmt->execute([$orderId]);
            $reworks = $rwkStmt->fetchAll();

            $insStmt = $pdo->prepare("SELECT * FROM quality_inspections WHERE production_order_id = ? AND stage_id = 7 ORDER BY id DESC");
            $insStmt->execute([$orderId]);
            $inspections = $insStmt->fetchAll();

            Response::success([
                'order' => $ord,
                'items' => $items,
                'batches' => $batches,
                'inspections' => $inspections,
                'rework_records' => $reworks
            ]);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function createStitchingBatch(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $pId = (int)($data['production_order_id'] ?? 0);
            if ($pId <= 0) {
                Response::error("Production order ID is required", 422);
                return;
            }

            // Support atomic bulk stitching batches
            if (!empty($data['batches']) && is_array($data['batches'])) {
                $batchRows = $data['batches'];
                $validBatches = [];
                foreach ($batchRows as $bRow) {
                    $comp = (float)($bRow['completed_quantity'] ?? 0);
                    if ($comp > 0) {
                        $validBatches[] = $bRow;
                    }
                }

                if (empty($validBatches)) {
                    Response::error("Please enter a valid completed quantity greater than 0 for at least one product line", 422);
                    return;
                }

                $pdo->beginTransaction();
                $createdBatches = [];
                $operatorTeam = trim($data['operator_team'] ?? 'Stitching Line #1');
                $prodLine = trim($data['production_line'] ?? 'Direct Drive Machine Line');
                $supervisor = trim($data['supervisor'] ?? 'Sewing Floor Head');
                $startDate = !empty($data['start_date']) ? $data['start_date'] : date('Y-m-d');
                $compDate = !empty($data['completion_date']) ? $data['completion_date'] : date('Y-m-d');
                $remarks = trim($data['remarks'] ?? '');
                $photoUrls = json_encode($data['photo_urls'] ?? []);

                foreach ($validBatches as $vb) {
                    $itemId = (int)($vb['production_order_item_id'] ?? 0);
                    $comp = (float)($vb['completed_quantity'] ?? 0);
                    $assigned = (float)($vb['assigned_quantity'] ?? $comp);
                    $batchNo = 'STI-' . rand(1000, 9999);

                    if ($itemId > 0) {
                        $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE id = ? AND production_order_id = ?");
                        $iStmt->execute([$itemId, $pId]);
                        $item = $iStmt->fetch();
                    } else {
                        $item = null;
                    }
                    if (!$item) {
                        $pIdReq = (int)($vb['product_id'] ?? 0);
                        $colReq = trim((string)($vb['color'] ?? ''));
                        if ($pIdReq > 0) {
                            $fStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? AND product_id = ? AND color = ? LIMIT 1");
                            $fStmt->execute([$pId, $pIdReq, $colReq]);
                            $item = $fStmt->fetch();
                            if ($item) $itemId = (int)$item['id'];
                        }
                    }

                    $stmt = $pdo->prepare("INSERT INTO stitching_batches 
                        (production_order_id, production_order_item_id, batch_number, assigned_quantity, received_quantity, completed_quantity, accepted_quantity, rejected_quantity, rework_quantity, balance_quantity, operator_team, production_line, start_date, completion_date, supervisor, remarks, photo_urls, status, inspection_status) 
                        VALUES (?, ?, ?, ?, ?, ?, 0.00, 0.00, 0.00, 0, ?, ?, ?, ?, ?, ?, ?, 'In Progress', 'Pending Inspection')");
                    $stmt->execute([
                        $pId, 
                        $itemId, 
                        $batchNo, 
                        $assigned > 0 ? $assigned : $comp, 
                        $assigned > 0 ? $assigned : $comp, 
                        $comp, 
                        $operatorTeam, 
                        $prodLine, 
                        $startDate, 
                        $compDate, 
                        $supervisor, 
                        $vb['remarks'] ?? $remarks, 
                        $photoUrls
                    ]);
                    $bId = (int)$pdo->lastInsertId();

                    $lStmt = $pdo->prepare("
                        INSERT INTO production_quantity_ledger 
                        (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                        VALUES (?, ?, 7, 'STI', 'PROCESSED', ?, ?, ?, ?, 'Stitching Output', ?, ?)
                    ");
                    $lStmt->execute([
                        $pId, 
                        $itemId, 
                        $comp, 
                        $batchNo, 
                        $operatorTeam, 
                        $supervisor, 
                        (string)$bId, 
                        $vb['remarks'] ?? ($remarks ?: 'Stitching completed; awaiting quality inspection')
                    ]);

                    $createdBatches[] = [
                        'id' => $bId,
                        'batch_number' => $batchNo,
                        'production_order_item_id' => $itemId,
                        'completed_quantity' => $comp,
                        'assigned_quantity' => $assigned,
                        'inspection_status' => 'Pending Inspection'
                    ];
                }

                $pdo->commit();

                Response::success([
                    'batches' => $createdBatches,
                    'count' => count($createdBatches),
                    'total_completed' => array_reduce($createdBatches, fn($s, $b) => $s + $b['completed_quantity'], 0)
                ], count($createdBatches) . " stitching batches recorded successfully. Ready for quality inspection.", 201);
                return;
            }

            $itemId = (int)($data['production_order_item_id'] ?? 0);
            $assigned = (float)($data['assigned_quantity'] ?? 0);
            $comp = (float)($data['completed_quantity'] ?? 0);
            $batchNo = 'STI-' . rand(1000, 9999);

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
                (production_order_id, production_order_item_id, batch_number, assigned_quantity, received_quantity, completed_quantity, accepted_quantity, rejected_quantity, rework_quantity, balance_quantity, operator_team, production_line, start_date, completion_date, supervisor, remarks, photo_urls, status, inspection_status) 
                VALUES (?, ?, ?, ?, ?, ?, 0.00, 0.00, 0.00, 0, ?, ?, ?, ?, ?, ?, ?, 'In Progress', 'Pending Inspection')");
            $stmt->execute([
                $pId, 
                $itemId, 
                $batchNo, 
                $assigned > 0 ? $assigned : $comp, 
                $assigned > 0 ? $assigned : $comp, 
                $comp, 
                $operatorTeam, 
                $prodLine, 
                $startDate, 
                $compDate, 
                $supervisor, 
                $remarks, 
                $photoUrls
            ]);
            $bId = (int)$pdo->lastInsertId();

            // Log physical stitching output to quantity ledger
            $lStmt = $pdo->prepare("
                INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 7, 'STI', 'PROCESSED', ?, ?, ?, ?, 'Stitching Output', ?, ?)
            ");
            $lStmt->execute([$pId, $itemId, $comp, $batchNo, $operatorTeam, $supervisor, (string)$bId, $remarks ?: 'Stitching completed; awaiting quality inspection']);

            Response::success([
                'id' => $bId,
                'batch_number' => $batchNo,
                'assigned' => $assigned,
                'completed' => $comp,
                'accepted' => 0.00,
                'rejected' => 0.00,
                'rework' => 0.00,
                'inspection_status' => 'Pending Inspection'
            ], "Stitching batch recorded successfully. Available for quality inspection.", 201);
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
            $reworkId = (int)($data['rework_id'] ?? 0);
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

            // Calculate total completed stitching and already transferred quantity
            $compStmt = $pdo->prepare("SELECT COALESCE(SUM(completed_quantity), 0) FROM stitching_batches WHERE production_order_id = ?");
            $compStmt->execute([$pId]);
            $totalCompleted = (float)$compStmt->fetchColumn();

            $rwkStmt = $pdo->prepare("SELECT COALESCE(SUM(accepted_quantity), 0) FROM rework_records WHERE production_order_id = ? AND stage_id = 7 AND status IN ('Accepted After Rework', 'Rework Received', 'Completed')");
            $rwkStmt->execute([$pId]);
            $reworkAccepted = (float)$rwkStmt->fetchColumn();

            $totalCompleted = max($totalCompleted, $reworkAccepted);

            $rwkActiveStmt = $pdo->prepare("
                SELECT COALESCE(SUM(rework_quantity), 0) 
                FROM rework_records 
                WHERE production_order_id = ? AND stage_id = 7 
                  AND status NOT IN ('Accepted After Rework', 'Rework Received', 'Transferred', 'Scrapped', 'Completed')
            ");
            $rwkActiveStmt->execute([$pId]);
            $activeRework = (float)$rwkActiveStmt->fetchColumn();

            $trfStmt = $pdo->prepare("
                SELECT COALESCE(SUM(quantity), 0) 
                FROM production_quantity_ledger 
                WHERE production_order_id = ? AND stage_id = 7 AND transaction_type = 'TRANSFER_OUT' 
                  AND (reference_type LIKE '%Stitching%' OR remarks LIKE '%Checking%')
                FOR UPDATE
            ");
            $trfStmt->execute([$pId]);
            $alreadyTransferred = (float)$trfStmt->fetchColumn();

            $eligibleToTransfer = max(0.0, $totalCompleted - $activeRework - $alreadyTransferred);

            if ($eligibleToTransfer <= 0.001) {
                $pdo->rollBack();
                Response::error("All completed stitching pieces ({$totalCompleted} pcs) have already been transferred to Checking.", 422);
                return;
            }

            if ($qty > $eligibleToTransfer + 0.001) {
                $pdo->rollBack();
                Response::error("Transfer quantity ({$qty}) exceeds available stitched output ({$eligibleToTransfer})", 422);
                return;
            }

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
                $pdo->prepare("UPDATE stitching_batches SET status = 'Transferred to Checking', transferred_quantity = transferred_quantity + ? WHERE id = ?")
                    ->execute([$qty, $bId]);
            } else if ($item) {
                $pdo->prepare("UPDATE stitching_batches SET status = 'Transferred to Checking', transferred_quantity = completed_quantity WHERE production_order_id = ? AND (production_order_item_id = ? OR color = ?)")
                    ->execute([$pId, $item['id'], $item['color']]);
            }

            if ($reworkId > 0) {
                $pdo->prepare("UPDATE rework_records SET status = 'Transferred' WHERE id = ?")->execute([$reworkId]);
            }

            $realItemId = $item ? (int)$item['id'] : $itemId;

            $tStmt = $pdo->prepare("INSERT INTO production_stage_transactions (production_order_item_id, from_stage_id, to_stage_id, quantity_moved, remarks) VALUES (?, 7, 8, ?, ?)");
            $tStmt->execute([$realItemId, $qty, $remarks]);

            $lStmtOut = $pdo->prepare("INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 7, 'STI', 'TRANSFER_OUT', ?, '', '', '', 'Stitching Transfer', '8', ?)");
            $lStmtOut->execute([$pId, $realItemId, $qty, "Transferred to Stage 08: Checking (Ready for Inspection)"]);

            $lStmtIn = $pdo->prepare("INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, 8, 'CHK', 'TRANSFER_IN', ?, '', '', '', 'Stitching Transfer', '8', ?)");
            $lStmtIn->execute([$pId, $realItemId, $qty, "Received from Stitching; Ready for Quality Inspection"]);

            $pdo->commit();
            try {
                $pInfo = $pdo->query("SELECT order_number, title FROM production_orders WHERE id = {$pId}")->fetch();
                if ($pInfo) {
                    NotificationService::notifyStageTransition($pdo, $pId, 7, 8, $pInfo['order_number'], $pInfo['title'], "Transferred {$qty} pcs from Stitching to Checking");
                }
            } catch (Throwable $ne) {}
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
        Auth::requireStageAccess(8);
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

            $rwkStmt = $pdo->prepare("
                SELECT rw.*, 
                       COALESCE(bp.product_name, p.name, rw.product_name) as display_product_name,
                       COALESCE(bp.product_code, p.code) as display_product_code,
                       dest_ps.name as target_stage_name,
                       dest_ps.code as target_stage_code
                FROM rework_records rw
                LEFT JOIN production_order_items poi ON rw.production_order_item_id = poi.id
                LEFT JOIN buyer_products bp ON (rw.product_id = bp.id OR poi.product_id = bp.id)
                LEFT JOIN products p ON (rw.product_id = p.id OR poi.product_id = p.id)
                LEFT JOIN production_stages dest_ps ON rw.rework_stage_id = dest_ps.id
                WHERE rw.production_order_id = ? AND rw.stage_id = 8
                ORDER BY rw.id DESC
            ");
            $rwkStmt->execute([$orderId]);
            $reworks = $rwkStmt->fetchAll();

            Response::success([
                'order' => $ord,
                'items' => $items,
                'inspections' => $inspections,
                'rework_records' => $reworks
            ]);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function recordQualityInspection(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (!empty($data['inspections']) && is_array($data['inspections'])) {
            $this->recordBulkQualityInspection();
            return;
        }
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $pId = (int)($data['production_order_id'] ?? 0);
            $itemId = (int)($data['production_order_item_id'] ?? 0);
            $stageId = (int)($data['stage_id'] ?? 8);
            $stageCode = strtoupper(trim((string)($data['stage_code'] ?? 'CHK')));
            $refId = trim((string)($data['reference_id'] ?? $data['batch_number'] ?? ''));
            $refType = trim((string)($data['reference_type'] ?? 'Quality Inspection'));
            $uom = trim((string)($data['uom'] ?? 'PCS'));

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

            // Quantity balance validation
            $allocatedTotal = round($passed + $rwk + $rej, 2);
            if (abs($allocatedTotal - round($checked, 2)) > 0.01) {
                Response::error("Inspected quantity ({$checked} {$uom}) must equal Accepted ({$passed}) + Rework ({$rwk}) + Rejected ({$rej})", 422);
                return;
            }

            $pdo->beginTransaction();

            $batchNo = !empty($data['batch_number']) ? trim((string)$data['batch_number']) : ($stageCode . '-QC-' . rand(1000, 9999));
            $inspector = trim((string)($data['inspector'] ?? 'QC Inspector'));
            $inspDate = !empty($data['inspection_date']) ? $data['inspection_date'] : date('Y-m-d');
            $defectCategory = trim((string)($data['defect_category'] ?? 'Quality Defect'));
            $defectDesc = trim((string)($data['defect_description'] ?? ($data['remarks'] ?? '')));
            $reworkDest = trim((string)($data['rework_destination'] ?? ($stageId === 8 ? 'STITCHING' : "{$stageCode} Line")));
            $reworkReason = trim((string)($data['rework_reason'] ?? $defectCategory));
            $color = !empty($data['color']) ? trim((string)$data['color']) : null;
            $size = !empty($data['size']) ? trim((string)$data['size']) : null;
            $remarks = trim((string)($data['remarks'] ?? ''));

            $qiCols = $pdo->query("SHOW COLUMNS FROM quality_inspections")->fetchAll(PDO::FETCH_COLUMN);
            $hasQiSize = in_array('size', $qiCols);
            if (!$hasQiSize) {
                try {
                    $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `size` VARCHAR(50) NULL AFTER `color`");
                    $hasQiSize = true;
                } catch (Exception $e) {}
            }

            if ($hasQiSize) {
                $stmt = $pdo->prepare("
                    INSERT INTO quality_inspections 
                    (production_order_id, production_order_item_id, stage_id, stage_code, reference_id, reference_type, batch_number, submitted_quantity, checked_quantity, passed_quantity, failed_quantity, rework_quantity, rejected_quantity, uom, defect_category, defect_description, color, size, rework_destination, rework_reason, inspector, inspection_date, remarks, photo_urls, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Inspected')
                ");
                $stmt->execute([
                    $pId, 
                    $itemId, 
                    $stageId,
                    $stageCode,
                    $refId,
                    $refType,
                    $batchNo, 
                    $sub > 0 ? $sub : $checked, 
                    $checked, 
                    $passed, 
                    $failed, 
                    $rwk, 
                    $rej, 
                    $uom,
                    $defectCategory, 
                    $defectDesc, 
                    $color,
                    $size,
                    $reworkDest,
                    $reworkReason,
                    $inspector, 
                    $inspDate, 
                    $remarks, 
                    json_encode($data['photo_urls'] ?? [])
                ]);
            } else {
                $stmt = $pdo->prepare("
                    INSERT INTO quality_inspections 
                    (production_order_id, production_order_item_id, stage_id, stage_code, reference_id, reference_type, batch_number, submitted_quantity, checked_quantity, passed_quantity, failed_quantity, rework_quantity, rejected_quantity, uom, defect_category, defect_description, color, rework_destination, rework_reason, inspector, inspection_date, remarks, photo_urls, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Inspected')
                ");
                $stmt->execute([
                    $pId, 
                    $itemId, 
                    $stageId,
                    $stageCode,
                    $refId,
                    $refType,
                    $batchNo, 
                    $sub > 0 ? $sub : $checked, 
                    $checked, 
                    $passed, 
                    $failed, 
                    $rwk, 
                    $rej, 
                    $uom,
                    $defectCategory, 
                    $defectDesc, 
                    $color,
                    $reworkDest,
                    $reworkReason,
                    $inspector, 
                    $inspDate, 
                    $remarks, 
                    json_encode($data['photo_urls'] ?? [])
                ]);
            }
            $insId = (int)$pdo->lastInsertId();

            // Reconcile and update source stage receipts/batches
            if ($stageId === 4) {
                // Stage 04 Dyeing: update dyeing_receipts & dyeing_orders
                if (!empty($refId)) {
                    $pdo->prepare("
                        UPDATE dyeing_receipts 
                        SET total_accepted_quantity = total_accepted_quantity + ?,
                            total_rework_quantity = total_rework_quantity + ?,
                            inspection_status = 'Inspected'
                        WHERE id = ? OR receipt_no = ?
                    ")->execute([$passed, $rwk, $refId, $refId]);

                    $pdo->prepare("
                        UPDATE dyeing_orders 
                        SET total_accepted_quantity = total_accepted_quantity + ?,
                            total_rework_quantity = total_rework_quantity + ?
                        WHERE id = (SELECT dyeing_order_id FROM dyeing_receipts WHERE id = ? OR receipt_no = ? LIMIT 1)
                    ")->execute([$passed, $rwk, $refId, $refId]);
                } else if ($pId > 0) {
                    $pdo->prepare("
                        UPDATE dyeing_orders 
                        SET total_accepted_quantity = total_accepted_quantity + ?,
                            total_rework_quantity = total_rework_quantity + ?
                        WHERE production_order_id = ?
                        ORDER BY id DESC LIMIT 1
                    ")->execute([$passed, $rwk, $pId]);
                }
            } else if ($stageId === 5) {
                // Stage 05 Cutting: update cutting_batches
                if (!empty($refId)) {
                    $pdo->prepare("
                        UPDATE cutting_batches 
                        SET accepted_output_quantity = accepted_output_quantity + ?,
                            rework_quantity = rework_quantity + ?,
                            rejected_quantity = rejected_quantity + ?,
                            inspection_status = 'Inspected'
                        WHERE id = ? OR batch_number = ?
                    ")->execute([$passed, $rwk, $rej, $refId, $refId]);
                } else if ($itemId > 0) {
                    $pdo->prepare("
                        UPDATE cutting_batches 
                        SET accepted_output_quantity = accepted_output_quantity + ?,
                            rework_quantity = rework_quantity + ?,
                            rejected_quantity = rejected_quantity + ?,
                            inspection_status = 'Inspected'
                        WHERE production_order_item_id = ?
                        ORDER BY id DESC LIMIT 1
                    ")->execute([$passed, $rwk, $rej, $itemId]);
                }
            } else if ($stageId === 6) {
                // Stage 06 Embroidery: update embroidery_receipts & embroidery_job_orders
                if (!empty($refId)) {
                    $pdo->prepare("
                        UPDATE embroidery_receipts 
                        SET total_accepted_qty = total_accepted_qty + ?,
                            total_rework_qty = total_rework_qty + ?,
                            total_rejected_qty = total_rejected_qty + ?,
                            inspection_status = 'Inspected'
                        WHERE id = ? OR receipt_number = ?
                    ")->execute([$passed, $rwk, $rej, $refId, $refId]);

                    $pdo->prepare("
                        UPDATE embroidery_job_orders 
                        SET total_quantity_accepted = total_quantity_accepted + ?,
                            total_quantity_rework = total_quantity_rework + ?,
                            total_quantity_rejected = total_quantity_rejected + ?
                        WHERE id = (SELECT job_order_id FROM embroidery_receipts WHERE id = ? OR receipt_number = ? LIMIT 1)
                    ")->execute([$passed, $rwk, $rej, $refId, $refId]);

                    // Update items_data inside receipt
                    $rcptStmt = $pdo->prepare("SELECT id, items_data FROM embroidery_receipts WHERE id = ? OR receipt_number = ? LIMIT 1");
                    $rcptStmt->execute([$refId, $refId]);
                    $rcptRow = $rcptStmt->fetch();
                    if ($rcptRow && !empty($rcptRow['items_data'])) {
                        $rItems = json_decode($rcptRow['items_data'], true);
                        if (is_array($rItems)) {
                            foreach ($rItems as &$rit) {
                                if (($itemId > 0 && ($rit['production_order_item_id'] ?? 0) == $itemId) || count($rItems) === 1) {
                                    $rit['accepted_quantity'] = (float)($rit['accepted_quantity'] ?? 0) + $passed;
                                    $rit['rework_quantity'] = (float)($rit['rework_quantity'] ?? 0) + $rwk;
                                    $rit['rejected_quantity'] = (float)($rit['rejected_quantity'] ?? 0) + $rej;
                                    break;
                                }
                            }
                            unset($rit);
                            $pdo->prepare("UPDATE embroidery_receipts SET items_data = ? WHERE id = ?")
                                ->execute([json_encode($rItems), $rcptRow['id']]);
                        }
                    }
                }
            } else if ($stageId === 7) {
                // Stage 07 Stitching: update stitching_batches
                if (!empty($refId)) {
                    $pdo->prepare("
                        UPDATE stitching_batches 
                        SET accepted_quantity = accepted_quantity + ?,
                            rework_quantity = rework_quantity + ?,
                            rejected_quantity = rejected_quantity + ?,
                            inspection_status = 'Inspected'
                        WHERE id = ? OR batch_number = ?
                    ")->execute([$passed, $rwk, $rej, $refId, $refId]);
                } else if ($itemId > 0) {
                    $pdo->prepare("
                        UPDATE stitching_batches 
                        SET accepted_quantity = accepted_quantity + ?,
                            rework_quantity = rework_quantity + ?,
                            rejected_quantity = rejected_quantity + ?,
                            inspection_status = 'Inspected'
                        WHERE production_order_item_id = ?
                        ORDER BY id DESC LIMIT 1
                    ")->execute([$passed, $rwk, $rej, $itemId]);
                }
            }

            // Log to quantity ledger
            $lStmt = $pdo->prepare("
                INSERT INTO production_quantity_ledger 
                (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                VALUES (?, ?, ?, ?, 'INSPECTED', ?, ?, '', ?, ?, ?, ?)
            ");
            $lStmt->execute([$pId, $itemId, $stageId, $stageCode, $checked, $batchNo, $inspector, $refType, (string)$insId, $remarks]);

            if ($passed > 0) {
                $lStmtPass = $pdo->prepare("
                    INSERT INTO production_quantity_ledger 
                    (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                    VALUES (?, ?, ?, ?, 'ACCEPTED', ?, ?, '', ?, ?, ?, 'Passed quality inspection')
                ");
                $lStmtPass->execute([$pId, $itemId, $stageId, $stageCode, $passed, $batchNo, $inspector, $refType, (string)$insId]);
            }

            // Insert rework record if rework > 0
            if ($rwk > 0) {
                $rwkOrderNo = 'RWK-' . $stageCode . '-' . strtoupper(bin2hex(random_bytes(3)));
                $destStageId = 7;
                if ($reworkDest === 'EMBROIDERY') $destStageId = 6;
                else if ($reworkDest === 'CUTTING') $destStageId = 5;
                else if ($reworkDest === 'DYEING') $destStageId = 4;
                else if ($reworkDest === 'ALTERATION' || $reworkDest === 'STITCHING') $destStageId = 7;
                else $destStageId = $stageId;

                $rwkCols = $pdo->query("SHOW COLUMNS FROM rework_records")->fetchAll(PDO::FETCH_COLUMN);
                $hasRwkSize = in_array('size', $rwkCols);
                if (!$hasRwkSize) {
                    try {
                        $pdo->exec("ALTER TABLE `rework_records` ADD COLUMN `size` VARCHAR(50) NULL AFTER `color`");
                        $hasRwkSize = true;
                    } catch (Exception $e) {}
                }

                if ($hasRwkSize) {
                    $insRwk = $pdo->prepare("
                        INSERT INTO rework_records 
                        (rework_order_no, production_order_id, production_order_item_id, stage_id, stage_code, qc_record_id, color, size, batch_number, rework_quantity, pending_quantity, uom, rework_reason, rework_remarks, rework_stage_id, destination_process, vendor_name, status, reference_type, reference_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Rework', ?, ?)
                    ");
                    $insRwk->execute([
                        $rwkOrderNo,
                        $pId,
                        $itemId,
                        $stageId,
                        $stageCode,
                        $insId,
                        $color,
                        $size,
                        $batchNo,
                        $rwk,
                        $rwk,
                        $uom,
                        $reworkReason,
                        $defectDesc,
                        $destStageId,
                        $reworkDest,
                        $data['vendor_name'] ?? null,
                        $refType,
                        $refId ?: (string)$insId
                    ]);
                } else {
                    $insRwk = $pdo->prepare("
                        INSERT INTO rework_records 
                        (rework_order_no, production_order_id, production_order_item_id, stage_id, stage_code, qc_record_id, color, batch_number, rework_quantity, pending_quantity, uom, rework_reason, rework_remarks, rework_stage_id, destination_process, vendor_name, status, reference_type, reference_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Rework', ?, ?)
                    ");
                    $insRwk->execute([
                        $rwkOrderNo,
                        $pId,
                        $itemId,
                        $stageId,
                        $stageCode,
                        $insId,
                        $color,
                        $batchNo,
                        $rwk,
                        $rwk,
                        $uom,
                        $reworkReason,
                        $defectDesc,
                        $destStageId,
                        $reworkDest,
                        $data['vendor_name'] ?? null,
                        $refType,
                        $refId ?: (string)$insId
                    ]);
                }

                $lStmtRwk = $pdo->prepare("
                    INSERT INTO production_quantity_ledger 
                    (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                    VALUES (?, ?, ?, ?, 'REWORK_LOGGED', ?, ?, '', ?, ?, ?, ?)
                ");
                $lStmtRwk->execute([$pId, $itemId, $stageId, $stageCode, $rwk, $batchNo, $inspector, $refType, (string)$insId, "Quality inspection rework identified: {$reworkReason}"]);
            }

            if ($rej > 0) {
                $lStmtRej = $pdo->prepare("
                    INSERT INTO production_quantity_ledger 
                    (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                    VALUES (?, ?, ?, ?, 'REJECTED', ?, ?, '', ?, ?, ?, ?)
                ");
                $lStmtRej->execute([$pId, $itemId, $stageId, $stageCode, $rej, $batchNo, $inspector, $refType, (string)$insId, "Rejected / Scrapped in Quality Inspection"]);
            }

            $pdo->commit();

            Response::success([
                'id' => $insId,
                'batch_number' => $batchNo,
                'stage_id' => $stageId,
                'stage_code' => $stageCode,
                'checked' => $checked,
                'passed' => $passed,
                'rejected' => $rej,
                'rework' => $rwk,
                'uom' => $uom
            ], "Quality inspection recorded successfully", 201);
        } catch (Exception $e) { 
            if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500); 
        }
    }

    public function recordBulkQualityInspection(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $pId = (int)($data['production_order_id'] ?? 0);
            if ($pId <= 0) {
                Response::error("Production order ID is required", 422);
                return;
            }

            $inspectionsList = $data['inspections'] ?? [];
            if (!is_array($inspectionsList) || empty($inspectionsList)) {
                Response::error("No inspection entries provided", 422);
                return;
            }

            $validLines = [];
            foreach ($inspectionsList as $line) {
                $chk = (float)($line['checked_quantity'] ?? 0);
                if ($chk > 0) {
                    $validLines[] = $line;
                }
            }

            if (empty($validLines)) {
                Response::error("Please specify a checked inspection quantity greater than 0 for at least one product line", 422);
                return;
            }

            // Common metadata
            $inspDate = !empty($data['inspection_date']) ? $data['inspection_date'] : date('Y-m-d');
            $inspector = trim((string)($data['inspector'] ?? 'Lead QC Auditor'));
            $commonRemarks = trim((string)($data['remarks'] ?? ''));
            $photoUrls = json_encode($data['photo_urls'] ?? []);

            $qiCols = $pdo->query("SHOW COLUMNS FROM quality_inspections")->fetchAll(PDO::FETCH_COLUMN);
            $hasQiSize = in_array('size', $qiCols);
            if (!$hasQiSize) {
                try {
                    $pdo->exec("ALTER TABLE `quality_inspections` ADD COLUMN `size` VARCHAR(50) NULL AFTER `color`");
                    $hasQiSize = true;
                } catch (Exception $e) {}
            }

            $rwkCols = $pdo->query("SHOW COLUMNS FROM rework_records")->fetchAll(PDO::FETCH_COLUMN);
            $hasRwkSize = in_array('size', $rwkCols);
            if (!$hasRwkSize) {
                try {
                    $pdo->exec("ALTER TABLE `rework_records` ADD COLUMN `size` VARCHAR(50) NULL AFTER `color`");
                    $hasRwkSize = true;
                } catch (Exception $e) {}
            }

            $pdo->beginTransaction();
            $created = [];

            foreach ($validLines as $line) {
                $itemId = (int)($line['production_order_item_id'] ?? 0);
                $checked = (float)($line['checked_quantity'] ?? 0);
                $rej = max(0.0, (float)($line['rejected_quantity'] ?? 0));
                $rwk = max(0.0, (float)($line['rework_quantity'] ?? 0));
                $passed = isset($line['passed_quantity']) && $line['passed_quantity'] !== ''
                    ? (float)$line['passed_quantity']
                    : max(0.0, $checked - $rej - $rwk);

                // Line quantity balance validation: Checked = Passed + Rework + Rejected
                $allocated = round($passed + $rwk + $rej, 2);
                if (abs($allocated - round($checked, 2)) > 0.01) {
                    $pdo->rollBack();
                    $prodName = $line['product_name'] ?? 'Product';
                    $color = $line['color'] ?? '';
                    Response::error("Quantity mismatch for {$prodName} ({$color}): Inspected ({$checked}) must equal Passed ({$passed}) + Rework ({$rwk}) + Rejected ({$rej})", 422);
                    return;
                }

                // Verify item belongs to production order
                $item = null;
                if ($itemId > 0) {
                    $iStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE id = ? AND production_order_id = ?");
                    $iStmt->execute([$itemId, $pId]);
                    $item = $iStmt->fetch();
                }
                if (!$item) {
                    $pIdReq = (int)($line['product_id'] ?? 0);
                    $colReq = trim((string)($line['color'] ?? ''));
                    if ($pIdReq > 0) {
                        $fStmt = $pdo->prepare("SELECT * FROM production_order_items WHERE production_order_id = ? AND product_id = ? AND color = ? LIMIT 1");
                        $fStmt->execute([$pId, $pIdReq, $colReq]);
                        $item = $fStmt->fetch();
                    }
                }
                if ($item) {
                    $itemId = (int)$item['id'];
                }

                $batchNo = 'CHK-QC-' . rand(1000, 9999);
                $defectCat = trim((string)($line['defect_category'] ?? (($rej > 0 || $rwk > 0) ? 'Quality Defect' : 'Passed Inspection')));
                $defectDesc = trim((string)($line['defect_description'] ?? ''));
                $reworkDest = trim((string)($line['rework_destination'] ?? 'Stitching Correction & Alteration'));
                $reworkReason = trim((string)($line['rework_reason'] ?? $defectCat));
                $destStageId = (int)($line['rework_stage_id'] ?? 7);
                $lineRemarks = trim((string)($line['remarks'] ?? $commonRemarks));
                $color = !empty($line['color']) ? trim((string)$line['color']) : ($item['color'] ?? null);
                $size = !empty($line['size']) ? trim((string)$line['size']) : ($item['size'] ?? null);

                if ($hasQiSize) {
                    $insStmt = $pdo->prepare("
                        INSERT INTO quality_inspections 
                        (production_order_id, production_order_item_id, stage_id, stage_code, reference_id, reference_type, batch_number, submitted_quantity, checked_quantity, passed_quantity, failed_quantity, rework_quantity, rejected_quantity, uom, defect_category, defect_description, color, size, rework_destination, rework_reason, inspector, inspection_date, remarks, photo_urls, status) 
                        VALUES (?, ?, 8, 'CHK', ?, 'Checking QC', ?, ?, ?, ?, ?, ?, ?, 'PCS', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Inspected')
                    ");
                    $insStmt->execute([
                        $pId, $itemId, (string)$itemId, $batchNo, $checked, $checked, $passed, ($rej + $rwk), $rwk, $rej,
                        $defectCat, $defectDesc, $color, $size, $reworkDest, $reworkReason, $inspector, $inspDate, $lineRemarks, $photoUrls
                    ]);
                } else {
                    $insStmt = $pdo->prepare("
                        INSERT INTO quality_inspections 
                        (production_order_id, production_order_item_id, stage_id, stage_code, reference_id, reference_type, batch_number, submitted_quantity, checked_quantity, passed_quantity, failed_quantity, rework_quantity, rejected_quantity, uom, defect_category, defect_description, color, rework_destination, rework_reason, inspector, inspection_date, remarks, photo_urls, status) 
                        VALUES (?, ?, 8, 'CHK', ?, 'Checking QC', ?, ?, ?, ?, ?, ?, ?, 'PCS', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Inspected')
                    ");
                    $insStmt->execute([
                        $pId, $itemId, (string)$itemId, $batchNo, $checked, $checked, $passed, ($rej + $rwk), $rwk, $rej,
                        $defectCat, $defectDesc, $color, $reworkDest, $reworkReason, $inspector, $inspDate, $lineRemarks, $photoUrls
                    ]);
                }
                $insId = (int)$pdo->lastInsertId();

                // Quantity ledger
                $lStmt = $pdo->prepare("
                    INSERT INTO production_quantity_ledger 
                    (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                    VALUES (?, ?, 8, 'CHK', 'INSPECTED', ?, ?, '', ?, 'Checking QC', ?, ?)
                ");
                $lStmt->execute([$pId, $itemId, $checked, $batchNo, $inspector, (string)$insId, $lineRemarks]);

                if ($passed > 0) {
                    $lStmtPass = $pdo->prepare("
                        INSERT INTO production_quantity_ledger 
                        (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                        VALUES (?, ?, 8, 'CHK', 'ACCEPTED', ?, ?, '', ?, 'Checking QC', ?, 'Passed quality inspection')
                    ");
                    $lStmtPass->execute([$pId, $itemId, $passed, $batchNo, $inspector, (string)$insId]);
                }

                if ($rwk > 0) {
                    $rwkOrderNo = 'RWK-CHK-' . strtoupper(bin2hex(random_bytes(3)));
                    if ($hasRwkSize) {
                        $insRwk = $pdo->prepare("
                            INSERT INTO rework_records 
                            (rework_order_no, production_order_id, production_order_item_id, stage_id, stage_code, qc_record_id, color, size, batch_number, rework_quantity, pending_quantity, uom, rework_reason, rework_remarks, rework_stage_id, destination_process, status, reference_type, reference_id)
                            VALUES (?, ?, ?, 8, 'CHK', ?, ?, ?, ?, ?, ?, 'PCS', ?, ?, ?, ?, 'Pending Rework', 'Checking QC', ?)
                        ");
                        $insRwk->execute([
                            $rwkOrderNo, $pId, $itemId, $insId, $color, $size, $batchNo, $rwk, $rwk,
                            $reworkReason, $defectDesc, $destStageId, $reworkDest, (string)$insId
                        ]);
                    } else {
                        $insRwk = $pdo->prepare("
                            INSERT INTO rework_records 
                            (rework_order_no, production_order_id, production_order_item_id, stage_id, stage_code, qc_record_id, color, batch_number, rework_quantity, pending_quantity, uom, rework_reason, rework_remarks, rework_stage_id, destination_process, status, reference_type, reference_id)
                            VALUES (?, ?, ?, 8, 'CHK', ?, ?, ?, ?, ?, 'PCS', ?, ?, ?, ?, 'Pending Rework', 'Checking QC', ?)
                        ");
                        $insRwk->execute([
                            $rwkOrderNo, $pId, $itemId, $insId, $color, $batchNo, $rwk, $rwk,
                            $reworkReason, $defectDesc, $destStageId, $reworkDest, (string)$insId
                        ]);
                    }

                    $lStmtRwk = $pdo->prepare("
                        INSERT INTO production_quantity_ledger 
                        (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                        VALUES (?, ?, 8, 'CHK', 'REWORK_LOGGED', ?, ?, '', ?, 'Checking QC', ?, ?)
                    ");
                    $lStmtRwk->execute([$pId, $itemId, $rwk, $batchNo, $inspector, (string)$insId, "Quality inspection rework identified: {$reworkReason}"]);
                }

                if ($rej > 0) {
                    $lStmtRej = $pdo->prepare("
                        INSERT INTO production_quantity_ledger 
                        (production_order_id, production_order_item_id, stage_id, stage_code, transaction_type, quantity, batch_number, operator_name, supervisor_name, reference_type, reference_id, remarks) 
                        VALUES (?, ?, 8, 'CHK', 'REJECTED', ?, ?, '', ?, 'Checking QC', ?, ?)
                    ");
                    $lStmtRej->execute([$pId, $itemId, $rej, $batchNo, $inspector, (string)$insId, "Rejected / Scrapped in Quality Inspection"]);
                }

                $created[] = [
                    'id' => $insId,
                    'batch_number' => $batchNo,
                    'checked' => $checked,
                    'passed' => $passed,
                    'rejected' => $rej,
                    'rework' => $rwk
                ];
            }

            $pdo->commit();
            Response::success([
                'count' => count($created),
                'inspections' => $created
            ], "Bulk quality inspection recorded successfully for " . count($created) . " product lines", 201);
        } catch (Exception $e) {
            if (isset($pdo) && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            Response::error($e->getMessage(), 500);
        }
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
            try {
                $pInfo = $pdo->query("SELECT order_number, title FROM production_orders WHERE id = {$pId}")->fetch();
                if ($pInfo) {
                    NotificationService::notifyStageTransition($pdo, $pId, 8, 9, $pInfo['order_number'], $pInfo['title'], "Transferred {$qty} pcs from Checking to Packing");
                }
            } catch (Throwable $ne) {}
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
        Auth::requireStageAccess(9);
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
                $cut = (float)($b['actual_cut_quantity'] ?? 0);
                $acc = (float)($b['accepted_output_quantity'] ?? 0);
                $rwk = (float)($b['rework_quantity'] ?? 0);
                $rej = (float)($b['rejected_quantity'] ?? 0);
                if ($acc <= 0 && $cut > 0) {
                    $b['accepted_output_quantity'] = max(0.0, $cut - $rwk - $rej);
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
            try {
                $pInfo = $pdo->query("SELECT order_number, title FROM production_orders WHERE id = {$pId}")->fetch();
                if ($pInfo) {
                    NotificationService::notifyStageTransition($pdo, $pId, 9, 10, $pInfo['order_number'], $pInfo['title'], "Transferred {$qty} pcs from Packing to Completed / Dispatch");
                }
            } catch (Throwable $ne) {}
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
        Auth::requireStageAccess(10);
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $ordStmt = $pdo->prepare("SELECT po.*, cu.name as customer_name FROM production_orders po LEFT JOIN customers cu ON po.customer_id = cu.id WHERE po.id = ?");
            $ordStmt->execute([$orderId]);
            $ord = $ordStmt->fetch();

            $dispStmt = $pdo->prepare("SELECT * FROM dispatch_records WHERE production_order_id = ? ORDER BY id DESC");
            $dispStmt->execute([$orderId]);
            $dispatches = $dispStmt->fetchAll();
            foreach ($dispatches as &$dsp) {
                foreach (['truck_photo_urls', 'loaded_cartons_photo_urls', 'eway_bill_photo_urls', 'labels_photo_urls', 'document_urls', 'carton_serial_numbers', 'items_breakdown'] as $fld) {
                    if (isset($dsp[$fld]) && is_string($dsp[$fld])) {
                        $dsp[$fld] = json_decode($dsp[$fld], true) ?: [];
                    }
                }
            }
            unset($dsp);

            $cartonStmt = $pdo->prepare("SELECT * FROM packing_cartons WHERE production_order_id = ? ORDER BY id DESC");
            $cartonStmt->execute([$orderId]);
            $cartons = $cartonStmt->fetchAll();

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

            // 2b. Mandatory E-Way Bill Number Validation & Duplicate Check
            $ewayBillNo = trim((string)($data['eway_bill_number'] ?? ''));
            if (empty($ewayBillNo)) {
                Response::error("E-Way Bill Number is mandatory before dispatch and order completion.", 422);
                return;
            }

            $dupEwStmt = $pdo->prepare("SELECT id, dispatch_number FROM dispatch_records WHERE production_order_id = ? AND LOWER(TRIM(COALESCE(eway_bill_number, ''))) = LOWER(?)");
            $dupEwStmt->execute([$pId, $ewayBillNo]);
            $dupEw = $dupEwStmt->fetch();
            if ($dupEw) {
                Response::error("Duplicate Dispatch Error: E-Way Bill number '{$ewayBillNo}' has already been recorded for this order (Dispatch {$dupEw['dispatch_number']}).", 422);
                return;
            }

            // 2c. Mandatory E-Way Bill PDF Document Validation & Processing
            $rawEwayDoc = trim((string)($data['eway_bill_pdf'] ?? ''));
            if (empty($rawEwayDoc)) {
                $rawArr = (array)($data['document_urls'] ?? $data['eway_bill_photo_urls'] ?? []);
                $ewayDocs = array_values(array_filter($rawArr, fn($p) => !empty(trim((string)$p))));
                $rawEwayDoc = $ewayDocs[0] ?? '';
            }

            if (empty($rawEwayDoc)) {
                Response::error("Mandatory E-Way Bill PDF document is missing. Please upload the original multi-page E-Way Bill PDF before dispatch can be completed.", 422);
                return;
            }

            $docUrl = $rawEwayDoc;
            $fileName = trim((string)($data['eway_bill_filename'] ?? ''));
            $fileSize = (int)($data['eway_bill_filesize'] ?? 0);

            // If base64 payload, validate file type (%PDF- header) and size limit (10MB)
            if (preg_match('/^data:([^;]+);base64,(.+)$/', $rawEwayDoc, $matches)) {
                $b64Data = $matches[2];
                $binary = base64_decode($b64Data, true);

                if ($binary === false) {
                    Response::error("Corrupt or invalid document data received.", 422);
                    return;
                }

                $binSize = strlen($binary);
                // 10MB limit
                if ($binSize > 10 * 1024 * 1024) {
                    Response::error("Uploaded E-Way Bill PDF exceeds the 10 MB limit (" . round($binSize / (1024 * 1024), 2) . " MB).", 422);
                    return;
                }

                // Check magic bytes: must start with %PDF- (or JPEG/PNG for backward compatibility)
                $isPdf = (strncmp($binary, '%PDF-', 5) === 0);
                $isJpeg = (strncmp($binary, "\xFF\xD8\xFF", 3) === 0);
                $isPng = (strncmp($binary, "\x89PNG", 4) === 0);

                if (!$isPdf && !$isJpeg && !$isPng) {
                    Response::error("Invalid file format. The uploaded E-Way Bill document must be a valid PDF file.", 422);
                    return;
                }

                if ($isPdf) {
                    $binary = $this->repairPdfBytesIfNeeded($binary);
                    $binSize = strlen($binary);
                }

                if ($fileSize <= 0) $fileSize = $binSize;
                if (empty($fileName)) {
                    $ext = $isPdf ? 'pdf' : ($isPng ? 'png' : 'jpg');
                    $fileName = 'Eway_Bill_' . preg_replace('/[^a-zA-Z0-9_-]/', '', $ewayBillNo) . '.' . $ext;
                }

                // Attempt to write to uploads directory
                $uploadRelDir = '/uploads/eway_bills';
                $uploadAbsDir = dirname(__DIR__, 2) . $uploadRelDir;
                if (!is_dir($uploadAbsDir)) {
                    @mkdir($uploadAbsDir, 0755, true);
                }
                if (is_dir($uploadAbsDir) && is_writable($uploadAbsDir)) {
                    $cleanExt = $isPdf ? 'pdf' : ($isPng ? 'png' : 'jpg');
                    $safeFileName = 'EWB_' . $pId . '_' . time() . '_' . substr(md5($binary), 0, 8) . '.' . $cleanExt;
                    $fullPath = $uploadAbsDir . '/' . $safeFileName;
                    if (@file_put_contents($fullPath, $binary) !== false) {
                        $docUrl = $uploadRelDir . '/' . $safeFileName;
                    }
                }
            }

            $ewayDocs = [$docUrl];

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

            $cols = $pdo->query("SHOW COLUMNS FROM dispatch_records")->fetchAll(PDO::FETCH_COLUMN);
            $hasEwayCol = in_array('eway_bill_number', $cols);
            $hasEwayPhotoCol = in_array('eway_bill_photo_urls', $cols);
            $hasFnCol = in_array('eway_bill_filename', $cols);
            $hasFsCol = in_array('eway_bill_filesize', $cols);

            if ($hasEwayCol && $hasEwayPhotoCol) {
                if ($hasFnCol && $hasFsCol) {
                    $stmt = $pdo->prepare("INSERT INTO dispatch_records (
                        dispatch_number, production_order_id, buyer_name, dispatch_date, dispatch_time, 
                        total_dispatched_quantity, total_boxes, vehicle_number, driver_name, driver_contact, 
                        transporter_name, delivery_challan_number, invoice_reference, eway_bill_number, eway_bill_filename, eway_bill_filesize, destination_notes, 
                        remarks, truck_photo_urls, loaded_cartons_photo_urls, eway_bill_photo_urls, labels_photo_urls, 
                        document_urls, carton_serial_numbers, items_breakdown
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

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
                        $ewayBillNo ?: null,
                        $fileName ?: null,
                        $fileSize ?: null,
                        $data['destination_notes'] ?? null, 
                        $data['remarks'] ?? '', 
                        json_encode($data['truck_photo_urls'] ?? []), 
                        json_encode($data['loaded_cartons_photo_urls'] ?? []), 
                        json_encode($ewayDocs),
                        json_encode($data['labels_photo_urls'] ?? []), 
                        json_encode($ewayDocs), 
                        json_encode($cartonSerialList), 
                        json_encode($data['items_breakdown'] ?? [])
                    ]);
                } else {
                    $stmt = $pdo->prepare("INSERT INTO dispatch_records (
                        dispatch_number, production_order_id, buyer_name, dispatch_date, dispatch_time, 
                        total_dispatched_quantity, total_boxes, vehicle_number, driver_name, driver_contact, 
                        transporter_name, delivery_challan_number, invoice_reference, eway_bill_number, destination_notes, 
                        remarks, truck_photo_urls, loaded_cartons_photo_urls, eway_bill_photo_urls, labels_photo_urls, 
                        document_urls, carton_serial_numbers, items_breakdown
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

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
                        $ewayBillNo ?: null,
                        $data['destination_notes'] ?? null, 
                        $data['remarks'] ?? '', 
                        json_encode($data['truck_photo_urls'] ?? []), 
                        json_encode($data['loaded_cartons_photo_urls'] ?? []), 
                        json_encode($ewayDocs),
                        json_encode($data['labels_photo_urls'] ?? []), 
                        json_encode($ewayDocs), 
                        json_encode($cartonSerialList), 
                        json_encode($data['items_breakdown'] ?? [])
                    ]);
                }
            } else {
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
                    json_encode($ewayDocs), 
                    json_encode($cartonSerialList), 
                    json_encode($data['items_breakdown'] ?? [])
                ]);
            }
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
            $pId = isset($_GET['production_order_id']) ? (int)$_GET['production_order_id'] : (isset($_GET['order_id']) ? (int)$_GET['order_id'] : 0);
            if ($pId > 0) {
                $stmt = $pdo->prepare("SELECT * FROM dispatch_records WHERE production_order_id = ? ORDER BY id DESC");
                $stmt->execute([$pId]);
            } else {
                $stmt = $pdo->query("SELECT * FROM dispatch_records ORDER BY id DESC");
            }
            $dispatches = $stmt->fetchAll();
            foreach ($dispatches as &$dsp) {
                foreach (['truck_photo_urls', 'loaded_cartons_photo_urls', 'eway_bill_photo_urls', 'labels_photo_urls', 'document_urls', 'carton_serial_numbers', 'items_breakdown'] as $fld) {
                    if (isset($dsp[$fld]) && is_string($dsp[$fld])) {
                        $dsp[$fld] = json_decode($dsp[$fld], true) ?: [];
                    }
                }
            }
            unset($dsp);
            Response::success($dispatches);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }

    public function dispatchDocument(?int $routeId = null): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $dispatchId = $routeId ?: (int)($_GET['dispatch_id'] ?? $_GET['id'] ?? 0);
            $orderId = (int)($_GET['production_order_id'] ?? $_GET['order_id'] ?? 0);

            $record = null;
            if ($dispatchId > 0) {
                $stmt = $pdo->prepare("SELECT * FROM dispatch_records WHERE id = ?");
                $stmt->execute([$dispatchId]);
                $record = $stmt->fetch();
            } else if ($orderId > 0) {
                $stmt = $pdo->prepare("SELECT * FROM dispatch_records WHERE production_order_id = ? ORDER BY id DESC LIMIT 1");
                $stmt->execute([$orderId]);
                $record = $stmt->fetch();
            }

            if (!$record) {
                http_response_code(404);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['success' => false, 'error' => 'Dispatch record not found']);
                exit;
            }

            // Extract document URLs
            $docs = [];
            foreach (['document_urls', 'eway_bill_photo_urls'] as $col) {
                if (!empty($record[$col])) {
                    $val = is_string($record[$col]) ? (json_decode($record[$col], true) ?: [$record[$col]]) : (array)$record[$col];
                    if (is_array($val)) {
                        foreach ($val as $u) {
                            if (is_string($u) && trim($u) !== '') {
                                $docs[] = trim($u);
                            }
                        }
                    }
                }
            }

            $docIndex = (int)($_GET['doc_index'] ?? 0);
            $targetDoc = $docs[$docIndex] ?? ($docs[0] ?? '');

            if (empty($targetDoc)) {
                http_response_code(404);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['success' => false, 'error' => 'No document attached to this dispatch record']);
                exit;
            }

            $filename = !empty($record['eway_bill_filename']) 
                ? $record['eway_bill_filename'] 
                : (!empty($record['eway_bill_number']) ? 'Eway_Bill_' . preg_replace('/[^a-zA-Z0-9_-]/', '', $record['eway_bill_number']) . '.pdf' : 'Eway_Bill_Document.pdf');

            // Case 1: Base64 data URL
            if (preg_match('/^data:([^;]+);base64,(.+)$/', $targetDoc, $matches)) {
                $mimeType = $matches[1] ?: 'application/pdf';
                $binary = base64_decode($matches[2], true);
                if ($binary !== false) {
                    $this->streamDocumentBytes($binary, $mimeType, $filename);
                    return;
                }
            }

            // Case 2: Stored file path on server
            $targetPath = ltrim(str_replace(['\\', '..'], ['/', ''], parse_url($targetDoc, PHP_URL_PATH) ?: $targetDoc), '/');
            
            $possibleRoots = [
                dirname(__DIR__, 2),
                dirname(__DIR__, 2) . '/deploy',
                dirname(__DIR__, 1),
            ];

            $foundFilePath = null;
            foreach ($possibleRoots as $root) {
                $checkPath = $root . '/' . $targetPath;
                if (file_exists($checkPath) && is_file($checkPath)) {
                    $foundFilePath = realpath($checkPath);
                    break;
                }
            }

            if ($foundFilePath && is_file($foundFilePath)) {
                $mime = mime_content_type($foundFilePath) ?: 'application/pdf';
                $handle = @fopen($foundFilePath, 'rb');
                if ($handle) {
                    $header = fread($handle, 5);
                    fclose($handle);
                    if (strncmp($header, '%PDF-', 5) === 0) {
                        $mime = 'application/pdf';
                    }
                }

                header('Content-Type: ' . $mime);
                header('Content-Length: ' . filesize($foundFilePath));
                header('Content-Disposition: inline; filename="' . basename($filename) . '"');
                header('Cache-Control: private, max-age=3600');
                header('X-Content-Type-Options: nosniff');
                readfile($foundFilePath);
                exit;
            }

            // Case 3: External URL redirect
            if (filter_var($targetDoc, FILTER_VALIDATE_URL)) {
                header('Location: ' . $targetDoc);
                exit;
            }

            http_response_code(404);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'error' => 'Document file not found on storage server']);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }
    }

    private function streamDocumentBytes(string $bytes, string $mimeType, string $filename): void {
        if (strncmp($bytes, '%PDF-', 5) === 0) {
            $mimeType = 'application/pdf';
        }
        header('Content-Type: ' . $mimeType);
        header('Content-Length: ' . strlen($bytes));
        header('Content-Disposition: inline; filename="' . basename($filename) . '"');
        header('Cache-Control: private, max-age=3600');
        header('X-Content-Type-Options: nosniff');
        echo $bytes;
        exit;
    }

    public function detailedReports(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureWorkflowTables($pdo);

            $stmt = $pdo->query("SELECT po.*, cu.name as buyer_name FROM production_orders po LEFT JOIN customers cu ON po.customer_id = cu.id WHERE po.deleted_at IS NULL ORDER BY po.id DESC");
            $orders = $stmt ? $stmt->fetchAll() : [];

            // Load all items for these orders to determine canonical stage and requirement gathering status
            $itemsByOrder = [];
            try {
                $itemStmt = $pdo->query("
                    SELECT poi.*, ps.name as current_stage_name, ps.code as stage_code, ps.sequence_order as stage_sequence
                    FROM production_order_items poi
                    LEFT JOIN production_stages ps ON poi.current_stage_id = ps.id
                    WHERE (poi.total_quantity > 0 OR poi.current_stage_quantity > 0)
                    ORDER BY poi.id ASC
                ");
                $allItems = $itemStmt ? $itemStmt->fetchAll() : [];
                foreach ($allItems as $it) {
                    $itemsByOrder[(int)$it['production_order_id']][] = $it;
                }
            } catch (Exception $e) {}

            // Load all POs
            $posByOrder = [];
            try {
                $poStmt = $pdo->query("
                    SELECT p.id, p.production_order_id, p.po_number, p.status, p.net_amount, p.remarks,
                           (SELECT COUNT(*) FROM purchase_receipts pr WHERE pr.purchase_order_id = p.id) as receipts_count
                    FROM purchase_orders p
                    WHERE p.deleted_at IS NULL
                ");
                $allPOs = $poStmt ? $poStmt->fetchAll() : [];
                foreach ($allPOs as $p) {
                    $pId = (int)($p['production_order_id'] ?? 0);
                    if ($pId > 0) {
                        $posByOrder[$pId][] = $p;
                    }
                }
            } catch (Exception $e) {}

            // Load Dyeing Orders
            $dyeByOrder = [];
            try {
                $dyeStmt = $pdo->query("
                    SELECT id, production_order_id, dyeing_order_no, total_fabric_quantity, total_received_quantity, uom, status 
                    FROM dyeing_orders 
                    WHERE deleted_at IS NULL
                ");
                $allDye = $dyeStmt ? $dyeStmt->fetchAll() : [];
                foreach ($allDye as $d) {
                    $pId = (int)($d['production_order_id'] ?? 0);
                    if ($pId > 0) $dyeByOrder[$pId][] = $d;
                }
            } catch (Exception $e) {}

            // Load Cutting Batches
            $cutByOrder = [];
            try {
                $cutStmt = $pdo->query("
                    SELECT production_order_id, SUM(actual_cut_quantity) as total_cut, SUM(accepted_output_quantity) as total_accepted 
                    FROM cutting_batches 
                    GROUP BY production_order_id
                ");
                $allCut = $cutStmt ? $cutStmt->fetchAll() : [];
                foreach ($allCut as $c) {
                    $cutByOrder[(int)$c['production_order_id']] = $c;
                }
            } catch (Exception $e) {}

            // Load Embroidery Job Orders
            $embByOrder = [];
            try {
                $embStmt = $pdo->query("
                    SELECT production_order_id, 
                           SUM(total_quantity_sent) as total_sent, 
                           SUM(total_quantity_received) as total_received,
                           SUM(total_quantity_accepted) as total_accepted,
                           SUM(total_quantity_rejected) as total_rejected,
                           SUM(total_quantity_rework) as total_rework
                    FROM embroidery_job_orders 
                    GROUP BY production_order_id
                ");
                $allEmb = $embStmt ? $embStmt->fetchAll() : [];
                foreach ($allEmb as $e) {
                    $embByOrder[(int)$e['production_order_id']] = $e;
                }
            } catch (Exception $e) {}

            // Load Stitching Batches
            $stiByOrder = [];
            try {
                $stiStmt = $pdo->query("
                    SELECT production_order_id, SUM(completed_quantity) as total_completed, SUM(accepted_quantity) as total_accepted 
                    FROM stitching_batches 
                    GROUP BY production_order_id
                ");
                $allSti = $stiStmt ? $stiStmt->fetchAll() : [];
                foreach ($allSti as $s) {
                    $stiByOrder[(int)$s['production_order_id']] = $s;
                }
            } catch (Exception $e) {}

            // Load Checking Inspections
            $chkByOrder = [];
            try {
                $chkStmt = $pdo->query("
                    SELECT production_order_id, 
                           SUM(COALESCE(checked_quantity, submitted_quantity, 0)) as total_inspected,
                           SUM(passed_quantity) as total_passed,
                           SUM(COALESCE(rejected_quantity, failed_quantity, 0)) as total_rejected,
                           SUM(rework_quantity) as total_rework
                    FROM quality_inspections 
                    GROUP BY production_order_id
                ");
                $allChk = $chkStmt ? $chkStmt->fetchAll() : [];
                foreach ($allChk as $k) {
                    $chkByOrder[(int)$k['production_order_id']] = $k;
                }
            } catch (Exception $e) {}

            // Load Packing Batches
            $pckByOrder = [];
            try {
                $pckStmt = $pdo->query("
                    SELECT production_order_id, SUM(packed_quantity) as total_packed 
                    FROM packing_batches 
                    GROUP BY production_order_id
                ");
                $allPck = $pckStmt ? $pckStmt->fetchAll() : [];
                foreach ($allPck as $pk) {
                    $pckByOrder[(int)$pk['production_order_id']] = $pk;
                }
            } catch (Exception $e) {}

            // Load Dispatches
            $dspByOrder = [];
            try {
                $dspStmt = $pdo->query("
                    SELECT production_order_id, SUM(total_dispatched_quantity) as total_dispatched 
                    FROM dispatch_records 
                    GROUP BY production_order_id
                ");
                $allDsp = $dspStmt ? $dspStmt->fetchAll() : [];
                foreach ($allDsp as $dp) {
                    $dspByOrder[(int)$dp['production_order_id']] = (float)$dp['total_dispatched'];
                }
            } catch (Exception $e) {}

            $reportData = [];
            foreach ($orders as $ord) {
                $oId = (int)$ord['id'];
                $totalQty = (float)$ord['total_quantity'];
                $dispatchedQty = (float)($dspByOrder[$oId] ?? 0.0);
                $doneQty = max((float)$ord['completed_quantity'], $dispatchedQty);
                $pendingQty = max(0.0, $totalQty - $doneQty);

                $items = $itemsByOrder[$oId] ?? [];
                
                // Determine Current Canonical Stage
                $orderStageName = 'Requirement Gathering';
                if (!empty($items)) {
                    $allComp = true;
                    $incomplete = [];
                    foreach ($items as $it) {
                        $isC = ($it['status'] === 'Completed' || (int)$it['current_stage_id'] === 10 || strtolower((string)($it['current_stage_name'] ?? '')) === 'completed');
                        if (!$isC) {
                            $allComp = false;
                            $incomplete[] = $it;
                        }
                    }
                    if ($allComp) {
                        $orderStageName = 'Completed';
                    } else {
                        usort($incomplete, fn($a, $b) => ((int)($a['stage_sequence'] ?? 1)) <=> ((int)($b['stage_sequence'] ?? 1)));
                        $orderStageName = $incomplete[0]['current_stage_name'] ?? 'Requirement Gathering';
                    }
                } elseif (strtoupper((string)($ord['status'] ?? '')) === 'COMPLETED') {
                    $orderStageName = 'Completed';
                }

                // Stage 01: Requirement Gathering (Only "Draft" or "Completed")
                $hasMovedPastReq = false;
                foreach ($items as $it) {
                    if ((int)($it['current_stage_id'] ?? 1) > 1 || ((string)($it['stage_code'] ?? '')) !== 'REQ') {
                        $hasMovedPastReq = true;
                        break;
                    }
                }
                $pos = $posByOrder[$oId] ?? [];
                $hasPOs = count($pos) > 0;
                $isReqCompleted = $hasMovedPastReq || $hasPOs || (strtoupper((string)($ord['status'] ?? '')) === 'IN PRODUCTION');
                $stage01Display = $isReqCompleted ? 'Completed' : 'Draft';

                // Stage 02: Purchase Order (PO) ("Issued / Total" or "—")
                $activePOs = array_values(array_filter($pos, fn($p) => !in_array(strtoupper((string)($p['status'] ?? '')), ['CANCELLED', 'VOID'])));
                $totalPOs = count($activePOs);
                $issuedPOs = count(array_filter($activePOs, fn($p) => strtoupper((string)($p['status'] ?? '')) !== 'DRAFT'));
                $stage02Display = $totalPOs > 0 ? "{$issuedPOs} / {$totalPOs}" : '—';
                $stage02Tooltip = $totalPOs > 0 ? "Total POs: {$totalPOs}, Issued: {$issuedPOs}, Draft: " . ($totalPOs - $issuedPOs) : 'No applicable purchase orders';

                // Stage 03: Inward (Received POs / Total Issued POs or "—")
                if ($issuedPOs > 0) {
                    $receivedPOs = count(array_filter($activePOs, function($p) {
                        $st = strtoupper((string)($p['status'] ?? ''));
                        return $st === 'RECEIVED' || ($st === 'ORDERED' && ((int)($p['receipts_count'] ?? 0)) > 0);
                    }));
                    $stage03Display = "{$receivedPOs} / {$issuedPOs} POs";
                    $stage03Tooltip = "Received POs: {$receivedPOs}, Pending Receipt: " . max(0, $issuedPOs - $receivedPOs) . " POs";
                } else {
                    $stage03Display = '—';
                    $stage03Tooltip = 'No issued purchase orders to receive';
                }

                // Stage 04: Dyeing
                $dOrders = $dyeByOrder[$oId] ?? [];
                if (!empty($dOrders)) {
                    $dSent = 0.0;
                    $dRcvd = 0.0;
                    $dUom = $dOrders[0]['uom'] ?? 'MTR';
                    foreach ($dOrders as $d) {
                        $dSent += (float)($d['total_fabric_quantity'] ?? 0);
                        $dRcvd += (float)($d['total_received_quantity'] ?? 0);
                    }
                    $stage04Display = (round($dRcvd) == $dRcvd ? (int)$dRcvd : round($dRcvd, 1)) . " / " . (round($dSent) == $dSent ? (int)$dSent : round($dSent, 1)) . " {$dUom} received";
                    $stage04Tooltip = "Sent: {$dSent} {$dUom}, Received: {$dRcvd} {$dUom}, Pending: " . max(0.0, $dSent - $dRcvd) . " {$dUom}";
                } else {
                    $stage04Display = '—';
                    $stage04Tooltip = 'Dyeing not applicable or not started';
                }

                // Stage 05: Cutting — Product-wise
                $cutRec = $cutByOrder[$oId] ?? null;
                $cutQty = $cutRec ? (float)$cutRec['total_cut'] : 0.0;
                $cutAcc = $cutRec ? (float)$cutRec['total_accepted'] : 0.0;
                $stage05Display = round($cutQty) . " / " . round($totalQty) . " pcs";
                $stage05Tooltip = "Cut: {$cutQty} pcs, Accepted: {$cutAcc} pcs, Required: {$totalQty} pcs";

                // Stage 06: Embroidery — Outward / Inward
                $embRec = $embByOrder[$oId] ?? null;
                if ($embRec && ((float)$embRec['total_sent'] > 0 || (float)$embRec['total_received'] > 0)) {
                    $eSent = (float)$embRec['total_sent'];
                    $eRcvd = (float)$embRec['total_received'];
                    $eAcc = (float)$embRec['total_accepted'];
                    $eRej = (float)$embRec['total_rejected'];
                    $eRwk = (float)$embRec['total_rework'];
                    $stage06Display = round($eRcvd) . " / " . round($eSent) . " pcs received";
                    $stage06Tooltip = "Sent: {$eSent} pcs, Received: {$eRcvd} pcs (Passed: {$eAcc}, Rej: {$eRej}, Rework: {$eRwk}), Pending: " . max(0.0, $eSent - $eRcvd) . " pcs";
                } else {
                    $stage06Display = '—';
                    $stage06Tooltip = 'Embroidery not applicable or not started';
                }

                // Stage 07: Stitching — Color-wise Tracking
                $stiRec = $stiByOrder[$oId] ?? null;
                $stiQty = $stiRec ? (float)$stiRec['total_completed'] : 0.0;
                $stage07Display = round($stiQty) . " / " . round($totalQty) . " pcs";
                $stage07Tooltip = "Completed Stitched: {$stiQty} pcs, Required: {$totalQty} pcs";

                // Stage 08: Checking
                $chkRec = $chkByOrder[$oId] ?? null;
                $chkInsp = $chkRec ? (float)$chkRec['total_inspected'] : 0.0;
                $chkPassed = $chkRec ? (float)$chkRec['total_passed'] : 0.0;
                $chkRej = $chkRec ? (float)$chkRec['total_rejected'] : 0.0;
                $chkRwk = $chkRec ? (float)$chkRec['total_rework'] : 0.0;
                $stage08Display = round($chkInsp) . " / " . round($totalQty) . " inspected";
                $stage08Tooltip = "Inspected: {$chkInsp} pcs, Passed: {$chkPassed} pcs, Rejected: {$chkRej} pcs, Rework: {$chkRwk} pcs";

                // Stage 09: Packing
                $pckRec = $pckByOrder[$oId] ?? null;
                $pckQty = $pckRec ? (float)$pckRec['total_packed'] : 0.0;
                $stage09Display = round($pckQty) . " / " . round($totalQty) . " pcs";
                $stage09Tooltip = "Packed: {$pckQty} pcs, Target: {$totalQty} pcs";

                // Stage 10: Completed
                $stage10Display = round($doneQty) . " / " . round($totalQty) . " pcs";
                $stage10Tooltip = "Completed: {$doneQty} pcs, Target: {$totalQty} pcs";

                // Overall Progress
                $completionPercent = $totalQty > 0 ? min(100, (int)round(($doneQty / $totalQty) * 100)) : 0;
                if (strtoupper((string)($ord['status'] ?? '')) === 'COMPLETED') {
                    $completionPercent = 100;
                }

                $reportData[] = [
                    'order_id' => $ord['id'],
                    'order_number' => $ord['order_number'],
                    'title' => $ord['title'],
                    'buyer_name' => $ord['buyer_name'],
                    'target_delivery_date' => $ord['target_delivery_date'],
                    'total_quantity' => $totalQty,
                    'cut_quantity' => $cutQty,
                    'stitched_quantity' => $stiQty,
                    'checked_passed_quantity' => $chkPassed,
                    'checked_inspected_quantity' => $chkInsp,
                    'packed_quantity' => $pckQty,
                    'dispatched_quantity' => $dispatchedQty,
                    'completed_quantity' => $doneQty,
                    'pending_quantity' => $pendingQty,
                    'status' => $orderStageName,
                    'current_stage_name' => $orderStageName,
                    'raw_status' => $ord['status'],
                    'completion_percent' => $completionPercent,
                    'stage_01_requirement' => [
                        'status' => $stage01Display,
                        'display' => $stage01Display
                    ],
                    'stage_02_po' => [
                        'issued_count' => $issuedPOs,
                        'total_count' => $totalPOs,
                        'display' => $stage02Display,
                        'tooltip' => $stage02Tooltip
                    ],
                    'stage_03_inward' => [
                        'display' => $stage03Display,
                        'tooltip' => $stage03Tooltip
                    ],
                    'stage_04_dyeing' => [
                        'display' => $stage04Display,
                        'tooltip' => $stage04Tooltip
                    ],
                    'stage_05_cutting' => [
                        'cut_quantity' => $cutQty,
                        'display' => $stage05Display,
                        'tooltip' => $stage05Tooltip
                    ],
                    'stage_06_embroidery' => [
                        'display' => $stage06Display,
                        'tooltip' => $stage06Tooltip
                    ],
                    'stage_07_stitching' => [
                        'stitched_quantity' => $stiQty,
                        'display' => $stage07Display,
                        'tooltip' => $stage07Tooltip
                    ],
                    'stage_08_checking' => [
                        'inspected_quantity' => $chkInsp,
                        'passed_quantity' => $chkPassed,
                        'display' => $stage08Display,
                        'tooltip' => $stage08Tooltip
                    ],
                    'stage_09_packing' => [
                        'packed_quantity' => $pckQty,
                        'display' => $stage09Display,
                        'tooltip' => $stage09Tooltip
                    ],
                    'stage_10_completed' => [
                        'completed_quantity' => $doneQty,
                        'display' => $stage10Display,
                        'tooltip' => $stage10Tooltip
                    ],
                ];
            }

            Response::success([
                'generated_at' => date('Y-m-d H:i:s'),
                'total_orders_analyzed' => count($reportData),
                'summary' => [
                    'total_orders_analyzed' => count($reportData),
                    'total_order_qty' => array_sum(array_column($reportData, 'total_quantity')),
                    'total_dispatched_qty' => array_sum(array_column($reportData, 'completed_quantity')),
                    'total_pending_qty' => array_sum(array_column($reportData, 'pending_quantity')),
                ],
                'items' => $reportData
            ]);
        } catch (Exception $e) { Response::error($e->getMessage(), 500); }
    }
}


