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
            $stmt = $pdo->query("
                SELECT po.*, c.name as category_name, cu.name as customer_name
                FROM production_orders po
                JOIN categories c ON po.category_id = c.id
                LEFT JOIN customers cu ON po.customer_id = cu.id
                WHERE po.deleted_at IS NULL
                ORDER BY po.id DESC
            ");
            $orders = $stmt->fetchAll();

            foreach ($orders as &$ord) {
                $iStmt = $pdo->prepare("
                    SELECT poi.*, p.name as product_name, p.code as product_code, ps.name as current_stage_name, ps.color_badge
                    FROM production_order_items poi
                    JOIN products p ON poi.product_id = p.id
                    JOIN production_stages ps ON poi.current_stage_id = ps.id
                    WHERE poi.production_order_id = ?
                ");
                $iStmt->execute([$ord['id']]);
                $ord['items'] = $iStmt->fetchAll();
            }

            Response::success($orders);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function store(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $categoryId = (int)($data['category_id'] ?? 1);
        $title = trim($data['title'] ?? '');
        $items = $data['items'] ?? [];

        if (empty($title) || empty($items)) {
            Response::error("Order title and at least one item line are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            // First stage in pipeline
            $stgStmt = $pdo->query("SELECT id FROM production_stages WHERE status = 'active' ORDER BY sequence_order ASC LIMIT 1");
            $firstStageId = (int)$stgStmt->fetchColumn();

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
                ':cust_id' => !empty($data['customer_id']) ? (int)$data['customer_id'] : null,
                ':title' => $title,
                ':prio' => $data['priority'] ?? 'Medium',
                ':sdate' => $data['start_date'] ?? date('Y-m-d'),
                ':tdate' => $data['target_delivery_date'] ?? date('Y-m-d', strtotime('+20 days')),
                ':tqty' => $totalQty,
                ':notes' => $data['notes'] ?? null
            ]);
            $orderId = (int)$pdo->lastInsertId();

            $itemStmt = $pdo->prepare("
                INSERT INTO production_order_items (production_order_id, product_id, color, size, total_quantity, current_stage_id, current_stage_quantity, completed_quantity, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'In Progress')
            ");

            foreach ($items as $it) {
                $q = (int)($it['total_quantity'] ?? $it['qty'] ?? 0);
                $itemStmt->execute([
                    $orderId,
                    (int)$it['product_id'],
                    $it['color'] ?? 'White',
                    $it['size'] ?? 'M',
                    $q,
                    $firstStageId,
                    $q
                ]);
            }

            $pdo->commit();
            AuditLogger::log('ProductionOrders', 'CREATE', $orderId, null, ['order_number' => $orderNo, 'total_qty' => $totalQty]);
            Response::success(['id' => $orderId, 'order_number' => $orderNo], "Production order created successfully", 201);
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function moveStage(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $orderItemId = (int)($data['order_item_id'] ?? 0);
        $toStageId = (int)($data['to_stage_id'] ?? 0);
        $moveQty = (int)($data['quantity_moved'] ?? 0);
        $remarks = trim($data['remarks'] ?? '');

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
        $orderItemId = (int)($data['order_item_id'] ?? 0);
        $stageId = (int)($data['stage_id'] ?? 6);
        $inputQty = (int)($data['input_quantity'] ?? 0);
        $passedQty = (int)($data['passed_quantity'] ?? 0);
        $rejectedQty = (int)($data['rejected_quantity'] ?? 0);
        $reworkQty = (int)($data['rework_quantity'] ?? 0);
        $remarks = trim($data['remarks'] ?? '');
        $reworkStageId = (int)($data['rework_stage_id'] ?? 5); // Default rework goes back to stitching

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

            // If rework quantity > 0, route back into production workflow!
            if ($reworkQty > 0) {
                $rwkStmt = $pdo->prepare("
                    INSERT INTO rework_records (qc_record_id, production_order_item_id, rework_stage_id, quantity, status, resolution_notes)
                    VALUES (?, ?, ?, ?, 'IN REWORK', ?)
                ");
                $rwkStmt->execute([$qcId, $orderItemId, $reworkStageId, $reworkQty, $remarks]);
            }

            // Update item counters
            $updItem = $pdo->prepare("
                UPDATE production_order_items 
                SET rejected_quantity = rejected_quantity + ?, rework_quantity = rework_quantity + ?
                WHERE id = ?
            ");
            $updItem->execute([$rejectedQty, $reworkQty, $orderItemId]);

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
                       p.name as product_name, p.code as product_code, ps.name as stage_name, ps.code as stage_code
                FROM production_order_items poi
                JOIN production_orders po ON poi.production_order_id = po.id
                JOIN products p ON poi.product_id = p.id
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
                SELECT rw.*, poi.color, poi.size, po.order_number, p.name as product_name, ps.name as target_stage_name
                FROM rework_records rw
                JOIN production_order_items poi ON rw.production_order_item_id = poi.id
                JOIN production_orders po ON poi.production_order_id = po.id
                JOIN products p ON poi.product_id = p.id
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
                SELECT qc.*, ps.name as stage_name, u.name as inspector_name, poi.color, poi.size, p.name as product_name, po.order_number
                FROM qc_records qc
                LEFT JOIN production_stages ps ON qc.stage_id = ps.id
                LEFT JOIN users u ON qc.inspector_user_id = u.id
                LEFT JOIN production_order_items poi ON qc.production_order_item_id = poi.id
                LEFT JOIN products p ON poi.product_id = p.id
                LEFT JOIN production_orders po ON poi.production_order_id = po.id
                ORDER BY qc.id DESC LIMIT 100
            ");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}

