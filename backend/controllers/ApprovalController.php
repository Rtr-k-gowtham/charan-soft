<?php
// backend/controllers/ApprovalController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/AuditLogger.php';
require_once __DIR__ . '/../core/NotificationService.php';
require_once __DIR__ . '/../config/database.php';

class ApprovalController {
    public const STAGE_NAMES = [
        1 => '01. Requirement Gathering',
        2 => '02. PO (Purchase Order)',
        3 => '03. Inward',
        4 => '04. Dyeing',
        5 => '05. Cutting — Product-wise',
        6 => '06. Embroidery — Outward / Inward',
        7 => '07. Stitching — Color-wise Tracking',
        8 => '08. Checking',
        9 => '09. Packing',
        10 => '10. Completed'
    ];

    /**
     * List all modification requests with filters & pagination (Admin only)
     */
    public function getApprovals(): void {
        Auth::requireRole('Admin');

        try {
            $pdo = Database::getConnection();

            $status = trim($_GET['status'] ?? '');
            $stageId = !empty($_GET['stage_id']) ? (int)$_GET['stage_id'] : null;
            $requestedBy = !empty($_GET['requested_by']) ? (int)$_GET['requested_by'] : null;
            $search = trim($_GET['search'] ?? '');
            $page = max(1, (int)($_GET['page'] ?? 1));
            $limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
            $offset = ($page - 1) * $limit;

            // Summary counts
            $summaryStmt = $pdo->query("
                SELECT 
                    COUNT(*) as total_requests,
                    COALESCE(SUM(CASE WHEN status = 'Pending Approval' THEN 1 ELSE 0 END), 0) as pending_approval,
                    COALESCE(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END), 0) as approved,
                    COALESCE(SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END), 0) as rejected
                FROM stage_modification_requests
            ");
            $rawSummary = $summaryStmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $summary = [
                'total_requests' => (int)($rawSummary['total_requests'] ?? 0),
                'pending_approval' => (int)($rawSummary['pending_approval'] ?? 0),
                'approved' => (int)($rawSummary['approved'] ?? 0),
                'rejected' => (int)($rawSummary['rejected'] ?? 0),
            ];

            // Build query
            $where = ["1=1"];
            $params = [];

            if (!empty($status) && $status !== 'All') {
                $where[] = "smr.status = ?";
                $params[] = $status;
            }

            if ($stageId) {
                $where[] = "smr.stage_id = ?";
                $params[] = $stageId;
            }

            if ($requestedBy) {
                $where[] = "smr.requested_by = ?";
                $params[] = $requestedBy;
            }

            if (!empty($search)) {
                $where[] = "(smr.request_number LIKE ? OR po.order_number LIKE ? OR po.title LIKE ? OR smr.modification_reason LIKE ? OR smr.requested_by_name LIKE ?)";
                $wildcard = "%{$search}%";
                $params = array_merge($params, [$wildcard, $wildcard, $wildcard, $wildcard, $wildcard]);
            }

            $whereSql = implode(' AND ', $where);

            // Count filtered
            $countStmt = $pdo->prepare("
                SELECT COUNT(*) 
                FROM stage_modification_requests smr
                JOIN production_orders po ON smr.production_order_id = po.id
                WHERE {$whereSql}
            ");
            $countStmt->execute($params);
            $totalFiltered = (int)$countStmt->fetchColumn();

            // Order by: Pending Approval first, then newest
            $sql = "
                SELECT 
                    smr.id,
                    smr.request_number,
                    smr.production_order_id,
                    smr.stage_id,
                    smr.stage_name,
                    smr.requested_by,
                    smr.requested_by_name,
                    smr.requested_by_role,
                    smr.requested_at,
                    smr.modification_reason,
                    smr.status,
                    smr.reviewed_by,
                    smr.reviewed_by_name,
                    smr.reviewed_at,
                    smr.rejection_reason,
                    smr.approval_remarks,
                    smr.created_at,
                    po.order_number,
                    po.title as order_title,
                    po.status as order_status,
                    po.target_delivery_date,
                    c.name as customer_name
                FROM stage_modification_requests smr
                JOIN production_orders po ON smr.production_order_id = po.id
                LEFT JOIN customers c ON po.customer_id = c.id
                WHERE {$whereSql}
                ORDER BY 
                    CASE WHEN smr.status = 'Pending Approval' THEN 0 ELSE 1 END ASC,
                    smr.id DESC
                LIMIT {$limit} OFFSET {$offset}
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

            Response::success([
                'summary' => $summary,
                'stats' => $summary,
                'requests' => $requests,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $totalFiltered,
                    'pages' => ceil($totalFiltered / $limit)
                ]
            ]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * Get single modification request with original and proposed snapshots
     */
    public function getApproval(int $id): void {
        $user = Auth::requireUser();
        $role = Auth::normalizeRoleName((string)$user['role']);

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                SELECT 
                    smr.*,
                    po.order_number,
                    po.title as order_title,
                    po.status as order_status,
                    po.current_stage_id,
                    po.target_delivery_date,
                    c.name as customer_name,
                    c.code as customer_code
                FROM stage_modification_requests smr
                JOIN production_orders po ON smr.production_order_id = po.id
                LEFT JOIN customers c ON po.customer_id = c.id
                WHERE smr.id = ?
            ");
            $stmt->execute([$id]);
            $request = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$request) {
                Response::error("Modification request not found", 404);
                return;
            }

            // Non-admin can only view their own requests or requests for stages they are permitted to view
            if ($role !== 'Admin') {
                if ((int)$request['requested_by'] !== (int)$user['id'] && !Auth::isStageAllowed($role, (int)$request['stage_id'])) {
                    Response::error("Forbidden: You do not have permission to view this modification request.", 403);
                    return;
                }
            }

            // Parse snapshots
            $request['original_data'] = json_decode($request['original_data_snapshot'] ?? '{}', true) ?: [];
            $request['proposed_data'] = json_decode($request['proposed_data'] ?? '{}', true) ?: [];

            Response::success($request);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * Check if a pending modification request exists for a specific order and stage
     */
    public function getPendingForStage(): void {
        Auth::requireUser();

        $orderId = (int)($_GET['order_id'] ?? 0);
        $stageId = (int)($_GET['stage_id'] ?? 0);

        if (!$orderId || !$stageId) {
            Response::error("order_id and stage_id are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                SELECT 
                    smr.id,
                    smr.request_number,
                    smr.production_order_id,
                    smr.stage_id,
                    smr.stage_name,
                    smr.requested_by,
                    smr.requested_by_name,
                    smr.requested_by_role,
                    smr.requested_at,
                    smr.modification_reason,
                    smr.proposed_data,
                    smr.status
                FROM stage_modification_requests smr
                WHERE smr.production_order_id = ? 
                  AND smr.stage_id = ? 
                  AND smr.status = 'Pending Approval'
                ORDER BY smr.id DESC
                LIMIT 1
            ");
            $stmt->execute([$orderId, $stageId]);
            $pending = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($pending && !empty($pending['proposed_data'])) {
                $pending['proposed_data'] = json_decode($pending['proposed_data'], true) ?: [];
            }

            Response::success([
                'has_pending' => !empty($pending),
                'request' => $pending ?: null
            ]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * Submit a modification request (Role 1, Role 2, or Admin)
     */
    public function createRequest(): void {
        $user = Auth::requireUser();
        $role = Auth::normalizeRoleName((string)$user['role']);

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $orderId = (int)($data['production_order_id'] ?? 0);
        $stageId = (int)($data['stage_id'] ?? 0);
        $reason = trim($data['modification_reason'] ?? '');
        $proposedData = $data['proposed_data'] ?? null;
        $originalSnapshot = $data['original_data_snapshot'] ?? null;

        if (!$orderId || !$stageId) {
            Response::error("Production order ID and Stage ID are required.", 422);
            return;
        }

        if (empty($reason)) {
            Response::error("Modification reason is required.", 422);
            return;
        }

        if (empty($proposedData) || !is_array($proposedData)) {
            Response::error("Proposed modification data must be provided as an object.", 422);
            return;
        }

        // Validate role stage permissions
        if ($role !== 'Admin' && !Auth::isStageAllowed($role, $stageId)) {
            Response::error("Forbidden: Your role ({$role}) does not have permission to modify Stage {$stageId}.", 403);
            return;
        }

        try {
            $pdo = Database::getConnection();

            // 1. Verify production order exists
            $poStmt = $pdo->prepare("SELECT id, order_number, title FROM production_orders WHERE id = ?");
            $poStmt->execute([$orderId]);
            $order = $poStmt->fetch(PDO::FETCH_ASSOC);
            if (!$order) {
                Response::error("Production order #{$orderId} not found.", 404);
                return;
            }

            // 2. Prevent duplicate pending requests for the same order and stage
            $checkStmt = $pdo->prepare("
                SELECT id, request_number, requested_at, requested_by_name 
                FROM stage_modification_requests 
                WHERE production_order_id = ? AND stage_id = ? AND status = 'Pending Approval'
                LIMIT 1
            ");
            $checkStmt->execute([$orderId, $stageId]);
            $existingPending = $checkStmt->fetch(PDO::FETCH_ASSOC);
            if ($existingPending) {
                Response::error("A modification request ({$existingPending['request_number']}) is already pending approval for this stage. Submitted by {$existingPending['requested_by_name']} on {$existingPending['requested_at']}.", 409);
                return;
            }

            // 3. Resolve stage name
            $stageName = self::STAGE_NAMES[$stageId] ?? "Stage {$stageId}";

            // 4. Capture original data snapshot if not provided
            if (empty($originalSnapshot)) {
                $originalSnapshot = self::captureStageSnapshot($pdo, $orderId, $stageId);
            }

            // 5. Generate unique request number (e.g. MOD-2026-0001)
            $year = date('Y');
            $countStmt = $pdo->query("SELECT MAX(id) FROM stage_modification_requests");
            $nextSeq = ((int)$countStmt->fetchColumn()) + 1;
            $requestNumber = sprintf("MOD-%s-%04d", $year, $nextSeq);

            // 6. Insert modification request
            $insStmt = $pdo->prepare("
                INSERT INTO stage_modification_requests (
                    request_number,
                    production_order_id,
                    stage_id,
                    stage_name,
                    requested_by,
                    requested_by_name,
                    requested_by_role,
                    requested_at,
                    modification_reason,
                    original_data_snapshot,
                    proposed_data,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 'Pending Approval')
            ");

            $insStmt->execute([
                $requestNumber,
                $orderId,
                $stageId,
                $stageName,
                $user['id'],
                $user['name'] ?? 'Operational User',
                $role,
                $reason,
                json_encode($originalSnapshot),
                json_encode($proposedData)
            ]);

            $requestId = (int)$pdo->lastInsertId();

            // 7. Notify Admins
            NotificationService::notifyModificationSubmitted(
                $pdo,
                $requestId,
                $requestNumber,
                $orderId,
                $stageId,
                $order['order_number'],
                $order['title'] ?? '',
                $stageName,
                $user['name'] ?? 'User',
                (int)$user['id']
            );

            // 8. Log in Audit Logger
            AuditLogger::log(
                'StageModification',
                'SUBMIT_REQUEST',
                $requestId,
                null,
                ['order_id' => $orderId, 'stage_id' => $stageId, 'request_number' => $requestNumber, 'reason' => $reason],
                (int)$user['id']
            );

            Response::success([
                'id' => $requestId,
                'request_number' => $requestNumber,
                'status' => 'Pending Approval',
                'message' => "Modification request {$requestNumber} submitted successfully for Admin approval."
            ], "Modification request submitted successfully", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * Admin Approve Request
     */
    public function approve(int $id): void {
        $admin = Auth::requireRole('Admin');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $remarks = trim($body['approval_remarks'] ?? '');

        $pdo = Database::getConnection();

        try {
            $pdo->beginTransaction();

            // Lock request row
            $stmt = $pdo->prepare("
                SELECT smr.*, po.order_number, po.title as order_title
                FROM stage_modification_requests smr
                JOIN production_orders po ON smr.production_order_id = po.id
                WHERE smr.id = ? FOR UPDATE
            ");
            $stmt->execute([$id]);
            $request = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$request) {
                $pdo->rollBack();
                Response::error("Modification request #{$id} not found.", 404);
                return;
            }

            if ($request['status'] !== 'Pending Approval') {
                $pdo->rollBack();
                Response::error("This request has already been processed with status '{$request['status']}'.", 400);
                return;
            }

            $orderId = (int)$request['production_order_id'];
            $stageId = (int)$request['stage_id'];
            $proposedData = json_decode($request['proposed_data'] ?? '{}', true) ?: [];

            // 1. Apply proposed modifications to live active tables
            $applyResult = self::applyStageModifications($pdo, $orderId, $stageId, $proposedData);
            if (!$applyResult['success']) {
                $pdo->rollBack();
                Response::error("Cannot safely apply modification: " . $applyResult['message'], 422);
                return;
            }

            // 2. Update request status to Approved
            $upStmt = $pdo->prepare("
                UPDATE stage_modification_requests SET
                    status = 'Approved',
                    reviewed_by = ?,
                    reviewed_by_name = ?,
                    reviewed_at = NOW(),
                    approval_remarks = ?
                WHERE id = ?
            ");
            $upStmt->execute([
                $admin['id'],
                $admin['name'] ?? 'Administrator',
                $remarks ?: null,
                $id
            ]);

            // 3. Notify the requesting user
            NotificationService::notifyModificationDecision(
                $pdo,
                $id,
                $request['request_number'],
                $orderId,
                $stageId,
                $request['order_number'],
                $request['order_title'] ?? '',
                $request['stage_name'],
                (int)$request['requested_by'],
                'Approved',
                $remarks
            );

            // 4. Audit log
            AuditLogger::log(
                'StageModification',
                'APPROVE_REQUEST',
                $id,
                ['status' => 'Pending Approval'],
                ['status' => 'Approved', 'remarks' => $remarks],
                (int)$admin['id']
            );

            $pdo->commit();

            Response::success([
                'id' => $id,
                'request_number' => $request['request_number'],
                'status' => 'Approved',
                'reviewed_at' => date('Y-m-d H:i:s'),
                'reviewed_by_name' => $admin['name'] ?? 'Administrator',
            ], "Modification request approved and active stage data updated successfully.");
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            Response::error("Approval failed: " . $e->getMessage(), 500);
        }
    }

    /**
     * Admin Reject Request
     */
    public function reject(int $id): void {
        $admin = Auth::requireRole('Admin');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $rejectionReason = trim($body['rejection_reason'] ?? '');

        if (empty($rejectionReason)) {
            Response::error("A rejection reason is required.", 422);
            return;
        }

        $pdo = Database::getConnection();

        try {
            $pdo->beginTransaction();

            // Lock request row
            $stmt = $pdo->prepare("
                SELECT smr.*, po.order_number, po.title as order_title
                FROM stage_modification_requests smr
                JOIN production_orders po ON smr.production_order_id = po.id
                WHERE smr.id = ? FOR UPDATE
            ");
            $stmt->execute([$id]);
            $request = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$request) {
                $pdo->rollBack();
                Response::error("Modification request #{$id} not found.", 404);
                return;
            }

            if ($request['status'] !== 'Pending Approval') {
                $pdo->rollBack();
                Response::error("This request has already been processed with status '{$request['status']}'.", 400);
                return;
            }

            // Update request status to Rejected (active data remains completely untouched)
            $upStmt = $pdo->prepare("
                UPDATE stage_modification_requests SET
                    status = 'Rejected',
                    reviewed_by = ?,
                    reviewed_by_name = ?,
                    reviewed_at = NOW(),
                    rejection_reason = ?
                WHERE id = ?
            ");
            $upStmt->execute([
                $admin['id'],
                $admin['name'] ?? 'Administrator',
                $rejectionReason,
                $id
            ]);

            // Notify the requesting user
            NotificationService::notifyModificationDecision(
                $pdo,
                $id,
                $request['request_number'],
                (int)$request['production_order_id'],
                (int)$request['stage_id'],
                $request['order_number'],
                $request['order_title'] ?? '',
                $request['stage_name'],
                (int)$request['requested_by'],
                'Rejected',
                $rejectionReason
            );

            // Audit log
            AuditLogger::log(
                'StageModification',
                'REJECT_REQUEST',
                $id,
                ['status' => 'Pending Approval'],
                ['status' => 'Rejected', 'reason' => $rejectionReason],
                (int)$admin['id']
            );

            $pdo->commit();

            Response::success([
                'id' => $id,
                'request_number' => $request['request_number'],
                'status' => 'Rejected',
                'reviewed_at' => date('Y-m-d H:i:s'),
                'reviewed_by_name' => $admin['name'] ?? 'Administrator',
                'rejection_reason' => $rejectionReason
            ], "Modification request rejected. Existing active production data preserved.");
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            Response::error("Rejection failed: " . $e->getMessage(), 500);
        }
    }

    /**
     * Helper: Capture active database snapshot for any of the 10 stages
     */
    public static function captureStageSnapshot(PDO $pdo, int $orderId, int $stageId): array {
        $snapshot = [];

        // Base order details
        $poStmt = $pdo->prepare("
            SELECT po.*, c.name as customer_name
            FROM production_orders po
            LEFT JOIN customers c ON po.customer_id = c.id
            WHERE po.id = ?
        ");
        $poStmt->execute([$orderId]);
        $order = $poStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $snapshot['order_id'] = $orderId;
        $snapshot['order_number'] = $order['order_number'] ?? '';
        $snapshot['order_title'] = $order['title'] ?? '';
        $snapshot['target_delivery_date'] = $order['target_delivery_date'] ?? null;
        $snapshot['priority'] = $order['priority'] ?? 'Medium';
        $snapshot['notes'] = $order['notes'] ?? '';

        // Product line items
        $itemsStmt = $pdo->prepare("
            SELECT poi.*, COALESCE(bp.product_name, p.name, 'Garment Product') as product_name
            FROM production_order_items poi
            LEFT JOIN buyer_products bp ON poi.product_id = bp.id
            LEFT JOIN products p ON poi.product_id = p.id
            WHERE poi.production_order_id = ?
            ORDER BY poi.id ASC
        ");
        $itemsStmt->execute([$orderId]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
        $snapshot['items'] = $items;

        switch ($stageId) {
            case 1: // Requirement Gathering
                break;

            case 2: // PO
                $poRows = $pdo->prepare("SELECT * FROM purchase_orders WHERE production_order_id = ? ORDER BY id ASC");
                $poRows->execute([$orderId]);
                $snapshot['purchase_orders'] = $poRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 3: // Inward
                $recRows = $pdo->prepare("SELECT * FROM purchase_receipts WHERE production_order_id = ? ORDER BY id ASC");
                $recRows->execute([$orderId]);
                $snapshot['receipts'] = $recRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 4: // Dyeing
                $dyeRows = $pdo->prepare("
                    SELECT d.*, s.name as supplier_name
                    FROM dyeing_orders d
                    LEFT JOIN suppliers s ON d.supplier_id = s.id
                    WHERE d.production_order_id = ? AND d.deleted_at IS NULL
                    ORDER BY d.id ASC
                ");
                $dyeRows->execute([$orderId]);
                $snapshot['dyeing_orders'] = $dyeRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 5: // Cutting
                $cutRows = $pdo->prepare("SELECT * FROM cutting_batches WHERE production_order_id = ? ORDER BY id ASC");
                $cutRows->execute([$orderId]);
                $snapshot['cutting_batches'] = $cutRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 6: // Embroidery
                $embRows = $pdo->prepare("SELECT * FROM embroidery_job_orders WHERE production_order_id = ? ORDER BY id ASC");
                $embRows->execute([$orderId]);
                $snapshot['embroidery_jobs'] = $embRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 7: // Stitching
                $stiRows = $pdo->prepare("SELECT * FROM stitching_batches WHERE production_order_id = ? ORDER BY id ASC");
                $stiRows->execute([$orderId]);
                $snapshot['stitching_batches'] = $stiRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 8: // Checking
                $chkRows = $pdo->prepare("SELECT * FROM quality_inspections WHERE production_order_id = ? ORDER BY id ASC");
                $chkRows->execute([$orderId]);
                $snapshot['inspections'] = $chkRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 9: // Packing
                $pckRows = $pdo->prepare("SELECT * FROM packing_batches WHERE production_order_id = ? ORDER BY id ASC");
                $pckRows->execute([$orderId]);
                $snapshot['packing_batches'] = $pckRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 10: // Completed / Dispatch
                $dispRows = $pdo->prepare("SELECT * FROM dispatch_records WHERE production_order_id = ? ORDER BY id ASC");
                $dispRows->execute([$orderId]);
                $snapshot['dispatch_records'] = $dispRows->fetchAll(PDO::FETCH_ASSOC);
                break;
        }

        return $snapshot;
    }

    /**
     * Helper: Apply approved stage modifications to active live tables
     */
    public static function applyStageModifications(PDO $pdo, int $orderId, int $stageId, array $proposed): array {
        try {
            // 1. Base order updates (title, target_delivery_date, priority, notes)
            $orderUpdates = [];
            $orderParams = [];

            if (isset($proposed['order_title']) && !empty($proposed['order_title'])) {
                $orderUpdates[] = "title = ?";
                $orderParams[] = trim((string)$proposed['order_title']);
            }
            if (isset($proposed['target_delivery_date']) && !empty($proposed['target_delivery_date'])) {
                $orderUpdates[] = "target_delivery_date = ?";
                $orderParams[] = trim((string)$proposed['target_delivery_date']);
            }
            if (isset($proposed['priority']) && !empty($proposed['priority'])) {
                $orderUpdates[] = "priority = ?";
                $orderParams[] = trim((string)$proposed['priority']);
            }
            if (isset($proposed['notes'])) {
                $orderUpdates[] = "notes = ?";
                $orderParams[] = trim((string)$proposed['notes']);
            }

            if (!empty($orderUpdates)) {
                $orderParams[] = $orderId;
                $sql = "UPDATE production_orders SET " . implode(', ', $orderUpdates) . " WHERE id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($orderParams);
            }

            // 2. Line item quantity updates
            if (!empty($proposed['items']) && is_array($proposed['items'])) {
                $upItemStmt = $pdo->prepare("UPDATE production_order_items SET quantity = ? WHERE id = ? AND production_order_id = ?");
                foreach ($proposed['items'] as $item) {
                    if (!empty($item['id']) && isset($item['quantity'])) {
                        $newQty = max(0, (int)$item['quantity']);
                        $upItemStmt->execute([$newQty, (int)$item['id'], $orderId]);
                    }
                }
            }

            // 3. Stage-specific updates
            switch ($stageId) {
                case 4: // Dyeing
                    if (!empty($proposed['dyeing_orders']) && is_array($proposed['dyeing_orders'])) {
                        $upDye = $pdo->prepare("
                            UPDATE dyeing_orders SET 
                                outward_quantity = COALESCE(?, outward_quantity),
                                expected_return_date = COALESCE(?, expected_return_date),
                                notes = COALESCE(?, notes)
                            WHERE id = ? AND production_order_id = ?
                        ");
                        foreach ($proposed['dyeing_orders'] as $d) {
                            if (!empty($d['id'])) {
                                $upDye->execute([
                                    $d['outward_quantity'] ?? null,
                                    $d['expected_return_date'] ?? null,
                                    $d['notes'] ?? $d['remarks'] ?? null,
                                    (int)$d['id'],
                                    $orderId
                                ]);
                            }
                        }
                    }
                    break;

                case 5: // Cutting
                    if (!empty($proposed['cutting_batches']) && is_array($proposed['cutting_batches'])) {
                        $upCut = $pdo->prepare("
                            UPDATE cutting_batches SET 
                                cut_quantity = COALESCE(?, cut_quantity),
                                waste_quantity = COALESCE(?, waste_quantity),
                                remarks = COALESCE(?, remarks)
                            WHERE id = ? AND production_order_id = ?
                        ");
                        foreach ($proposed['cutting_batches'] as $b) {
                            if (!empty($b['id'])) {
                                $upCut->execute([
                                    $b['cut_quantity'] ?? null,
                                    $b['waste_quantity'] ?? null,
                                    $b['remarks'] ?? null,
                                    (int)$b['id'],
                                    $orderId
                                ]);
                            }
                        }
                    }
                    break;

                case 6: // Embroidery
                    if (!empty($proposed['embroidery_jobs']) && is_array($proposed['embroidery_jobs'])) {
                        $upEmb = $pdo->prepare("
                            UPDATE embroidery_job_orders SET 
                                sent_quantity = COALESCE(?, sent_quantity),
                                stitches_count = COALESCE(?, stitches_count),
                                remarks = COALESCE(?, remarks)
                            WHERE id = ? AND production_order_id = ?
                        ");
                        foreach ($proposed['embroidery_jobs'] as $ej) {
                            if (!empty($ej['id'])) {
                                $upEmb->execute([
                                    $ej['sent_quantity'] ?? $ej['outward_quantity'] ?? null,
                                    $ej['stitches_count'] ?? null,
                                    $ej['remarks'] ?? null,
                                    (int)$ej['id'],
                                    $orderId
                                ]);
                            }
                        }
                    }
                    break;

                case 7: // Stitching
                    if (!empty($proposed['stitching_batches']) && is_array($proposed['stitching_batches'])) {
                        $upSti = $pdo->prepare("
                            UPDATE stitching_batches SET 
                                stitched_quantity = COALESCE(?, stitched_quantity),
                                defect_quantity = COALESCE(?, defect_quantity),
                                remarks = COALESCE(?, remarks)
                            WHERE id = ? AND production_order_id = ?
                        ");
                        foreach ($proposed['stitching_batches'] as $sb) {
                            if (!empty($sb['id'])) {
                                $upSti->execute([
                                    $sb['stitched_quantity'] ?? null,
                                    $sb['defect_quantity'] ?? null,
                                    $sb['remarks'] ?? null,
                                    (int)$sb['id'],
                                    $orderId
                                ]);
                            }
                        }
                    }
                    break;

                case 8: // Checking
                    if (!empty($proposed['inspections']) && is_array($proposed['inspections'])) {
                        $upChk = $pdo->prepare("
                            UPDATE quality_inspections SET 
                                passed_quantity = COALESCE(?, passed_quantity),
                                rework_quantity = COALESCE(?, rework_quantity),
                                rejected_quantity = COALESCE(?, rejected_quantity),
                                remarks = COALESCE(?, remarks)
                            WHERE id = ? AND production_order_id = ?
                        ");
                        foreach ($proposed['inspections'] as $qi) {
                            if (!empty($qi['id'])) {
                                $upChk->execute([
                                    $qi['passed_quantity'] ?? null,
                                    $qi['rework_quantity'] ?? null,
                                    $qi['rejected_quantity'] ?? null,
                                    $qi['remarks'] ?? null,
                                    (int)$qi['id'],
                                    $orderId
                                ]);
                            }
                        }
                    }
                    break;

                case 9: // Packing
                    if (!empty($proposed['packing_batches']) && is_array($proposed['packing_batches'])) {
                        $upPck = $pdo->prepare("
                            UPDATE packing_batches SET 
                                packed_quantity = COALESCE(?, packed_quantity),
                                carton_count = COALESCE(?, carton_count),
                                remarks = COALESCE(?, remarks)
                            WHERE id = ? AND production_order_id = ?
                        ");
                        foreach ($proposed['packing_batches'] as $pb) {
                            if (!empty($pb['id'])) {
                                $upPck->execute([
                                    $pb['packed_quantity'] ?? null,
                                    $pb['carton_count'] ?? null,
                                    $pb['remarks'] ?? null,
                                    (int)$pb['id'],
                                    $orderId
                                ]);
                            }
                        }
                    }
                    break;

                case 10: // Completed / Dispatch
                    if (!empty($proposed['dispatch_records']) && is_array($proposed['dispatch_records'])) {
                        $upDisp = $pdo->prepare("
                            UPDATE dispatch_records SET 
                                vehicle_plate_number = COALESCE(?, vehicle_plate_number),
                                driver_name = COALESCE(?, driver_name),
                                eway_bill_number = COALESCE(?, eway_bill_number),
                                container_seal_number = COALESCE(?, container_seal_number),
                                remarks = COALESCE(?, remarks)
                            WHERE id = ? AND production_order_id = ?
                        ");
                        foreach ($proposed['dispatch_records'] as $dr) {
                            if (!empty($dr['id'])) {
                                $upDisp->execute([
                                    $dr['vehicle_plate_number'] ?? null,
                                    $dr['driver_name'] ?? null,
                                    $dr['eway_bill_number'] ?? null,
                                    $dr['container_seal_number'] ?? null,
                                    $dr['remarks'] ?? null,
                                    (int)$dr['id'],
                                    $orderId
                                ]);
                            }
                        }
                    }
                    break;
            }

            return ['success' => true];
        } catch (Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

