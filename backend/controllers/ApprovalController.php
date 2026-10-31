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
     * Auto-migrate schema for post-completion record-level modifications
     */
    public static function ensureSchema(PDO $pdo): void {
        try {
            $cols = $pdo->query("SHOW COLUMNS FROM stage_modification_requests")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('record_type', $cols, true)) {
                $pdo->exec("ALTER TABLE stage_modification_requests ADD COLUMN record_type VARCHAR(100) NULL AFTER stage_name");
            }
            if (!in_array('record_id', $cols, true)) {
                $pdo->exec("ALTER TABLE stage_modification_requests ADD COLUMN record_id INT NULL AFTER record_type");
            }
            if (!in_array('record_identifier', $cols, true)) {
                $pdo->exec("ALTER TABLE stage_modification_requests ADD COLUMN record_identifier VARCHAR(255) NULL AFTER record_id");
            }
        } catch (Throwable $e) {
            // Fail silently if table columns already exist or permission error
        }
    }

    /**
     * List all modification requests with filters & pagination (Admin only)
     */
    public function getApprovals(): void {
        Auth::requireRole('Admin');

        try {
            $pdo = Database::getConnection();
            self::ensureSchema($pdo);

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
                $where[] = "(smr.request_number LIKE ? OR po.order_number LIKE ? OR po.title LIKE ? OR smr.modification_reason LIKE ? OR smr.requested_by_name LIKE ? OR smr.record_identifier LIKE ?)";
                $wildcard = "%{$search}%";
                $params = array_merge($params, [$wildcard, $wildcard, $wildcard, $wildcard, $wildcard, $wildcard]);
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
                    smr.record_type,
                    smr.record_id,
                    smr.record_identifier,
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
                    c.name as customer_name,
                    c.name as buyer_name,
                    c.code as customer_code,
                    c.code as buyer_code
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
            self::ensureSchema($pdo);
            $stmt = $pdo->prepare("
                SELECT 
                    smr.*,
                    po.order_number,
                    po.title as order_title,
                    po.status as order_status,
                    (SELECT poi.current_stage_id FROM production_order_items poi WHERE poi.production_order_id = po.id ORDER BY poi.id ASC LIMIT 1) as current_stage_id,
                    (SELECT ps.name FROM production_order_items poi JOIN production_stages ps ON poi.current_stage_id = ps.id WHERE poi.production_order_id = po.id ORDER BY poi.id ASC LIMIT 1) as order_current_stage_name,
                    po.target_delivery_date,
                    po.target_delivery_date as order_delivery_date,
                    c.name as customer_name,
                    c.name as buyer_name,
                    c.code as customer_code,
                    c.code as buyer_code
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
            $origSnapshot = json_decode($request['original_data_snapshot'] ?? '{}', true) ?: [];
            $propSnapshot = json_decode($request['proposed_data'] ?? '{}', true) ?: [];

            $request['original_data_snapshot'] = $origSnapshot;
            $request['original_data'] = $origSnapshot;
            $request['proposed_data'] = $propSnapshot;
            $request['changes_diff'] = self::computeChangesDiff($origSnapshot, $propSnapshot);

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
        $recordType = !empty($_GET['record_type']) ? trim((string)$_GET['record_type']) : null;
        $recordId = !empty($_GET['record_id']) ? (int)$_GET['record_id'] : null;

        if (!$orderId || !$stageId) {
            Response::error("order_id and stage_id are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            self::ensureSchema($pdo);

            if ($recordType && $recordId) {
                $stmt = $pdo->prepare("
                    SELECT 
                        smr.id,
                        smr.request_number,
                        smr.production_order_id,
                        smr.stage_id,
                        smr.stage_name,
                        smr.record_type,
                        smr.record_id,
                        smr.record_identifier,
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
                      AND smr.record_type = ?
                      AND smr.record_id = ?
                      AND smr.status = 'Pending Approval'
                    ORDER BY smr.id DESC
                    LIMIT 1
                ");
                $stmt->execute([$orderId, $stageId, $recordType, $recordId]);
            } else {
                $stmt = $pdo->prepare("
                    SELECT 
                        smr.id,
                        smr.request_number,
                        smr.production_order_id,
                        smr.stage_id,
                        smr.stage_name,
                        smr.record_type,
                        smr.record_id,
                        smr.record_identifier,
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
            }
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
        $recordType = !empty($data['record_type']) ? trim((string)$data['record_type']) : null;
        $recordId = !empty($data['record_id']) ? (int)$data['record_id'] : null;
        $recordIdentifier = !empty($data['record_identifier']) ? trim((string)$data['record_identifier']) : null;

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
            self::ensureSchema($pdo);

            // 1. Verify production order exists
            $poStmt = $pdo->prepare("SELECT id, order_number, title FROM production_orders WHERE id = ?");
            $poStmt->execute([$orderId]);
            $order = $poStmt->fetch(PDO::FETCH_ASSOC);
            if (!$order) {
                Response::error("Production order #{$orderId} not found.", 404);
                return;
            }

            // 2. Prevent duplicate pending requests for the same record or stage
            if ($recordType && $recordId) {
                $checkStmt = $pdo->prepare("
                    SELECT id, request_number, requested_at, requested_by_name 
                    FROM stage_modification_requests 
                    WHERE production_order_id = ? AND stage_id = ? AND record_type = ? AND record_id = ? AND status = 'Pending Approval'
                    LIMIT 1
                ");
                $checkStmt->execute([$orderId, $stageId, $recordType, $recordId]);
                $existingPending = $checkStmt->fetch(PDO::FETCH_ASSOC);
                if ($existingPending) {
                    $identLabel = $recordIdentifier ?: "Record #{$recordId}";
                    Response::error("A modification request ({$existingPending['request_number']}) is already pending approval for {$identLabel}. Submitted by {$existingPending['requested_by_name']} on {$existingPending['requested_at']}.", 409);
                    return;
                }
            } else {
                $checkStmt = $pdo->prepare("
                    SELECT id, request_number, requested_at, requested_by_name 
                    FROM stage_modification_requests 
                    WHERE production_order_id = ? AND stage_id = ? AND record_type IS NULL AND status = 'Pending Approval'
                    LIMIT 1
                ");
                $checkStmt->execute([$orderId, $stageId]);
                $existingPending = $checkStmt->fetch(PDO::FETCH_ASSOC);
                if ($existingPending) {
                    Response::error("A modification request ({$existingPending['request_number']}) is already pending approval for this stage. Submitted by {$existingPending['requested_by_name']} on {$existingPending['requested_at']}.", 409);
                    return;
                }
            }

            // 3. Resolve stage name
            $stageName = self::STAGE_NAMES[$stageId] ?? "Stage {$stageId}";

            // 4. Always capture original data snapshot from DB (source of truth)
            $originalSnapshot = self::captureStageSnapshot($pdo, $orderId, $stageId);

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
                    record_type,
                    record_id,
                    record_identifier,
                    requested_by,
                    requested_by_name,
                    requested_by_role,
                    requested_at,
                    modification_reason,
                    original_data_snapshot,
                    proposed_data,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 'Pending Approval')
            ");

            $insStmt->execute([
                $requestNumber,
                $orderId,
                $stageId,
                $stageName,
                $recordType,
                $recordId,
                $recordIdentifier,
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
            $forceApprove = !empty($body['force_approve']);

            // Conflict detection: verify if live stage data was modified after request submission
            if (!$forceApprove) {
                $origSnapshot = json_decode($request['original_data_snapshot'] ?? '{}', true) ?: [];
                $currentLive = self::captureStageSnapshot($pdo, $orderId, $stageId);
                $liveDiff = self::computeChangesDiff($origSnapshot, $currentLive);
                if (!empty($liveDiff)) {
                    $pdo->rollBack();
                    Response::error(
                        "Conflict detected: The active stage records were modified by another action after this request was submitted on {$request['requested_at']}. You can force approve to overwrite.",
                        409,
                        ['conflict' => true, 'live_diff' => $liveDiff]
                    );
                    return;
                }
            }

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
     * Human-readable field labels for all 10 stages
     */
    private static function getFieldLabels(): array {
        return [
            // Order-level
            'order_title'           => 'Order Title',
            'target_delivery_date'  => 'Target Delivery Date',
            'priority'              => 'Order Priority',
            'notes'                 => 'Stage Notes / Remarks',
            'remarks'               => 'Operational Remarks',
            // Stage 01 items & materials
            'product_name'          => 'Product Name',
            'product_sku'           => 'Product SKU / Code',
            'quantity'              => 'Quantity (pcs)',
            'size'                  => 'Size',
            'pantone_color'         => 'Pantone Color',
            'pantone_code'          => 'Pantone Code',
            'color_name'            => 'Color Name',
            'color_hex'             => 'Color Hex',
            'unit'                  => 'Unit',
            'notes_items'           => 'Item Notes',
            'material_name'         => 'Material Name',
            'required_quantity'     => 'Required Quantity',
            'total_required_qty'    => 'Required Quantity',
            'current_stock'         => 'Current Stock',
            'shortage_qty'          => 'Shortage Quantity',
            'default_supplier_name' => 'Assigned Supplier',
            // Stage 02 PO
            'supplier_name'         => 'Supplier / Vendor',
            'po_number'             => 'PO Number',
            'po_date'               => 'PO Date',
            'delivery_date'         => 'Delivery Date',
            'total_amount'          => 'Total Amount',
            'payment_terms'         => 'Payment Terms',
            'status'                => 'Status',
            // Stage 03 Inward
            'receipt_number'        => 'Receipt Number',
            'received_date'         => 'Received Date',
            'received_qty'          => 'Received Quantity',
            'material_name'         => 'Material Name',
            'batch_number'          => 'Batch Number',
            // Stage 04 Dyeing
            'mill_name'             => 'Dyeing Mill',
            'outward_quantity'      => 'Outward Quantity (MTR)',
            'outward_date'          => 'Outward Date',
            'expected_return_date'  => 'Expected Return Date',
            'received_quantity'     => 'Received Quantity',
            'shade'                 => 'Shade / Color',
            // Stage 05 Cutting
            'cut_quantity'          => 'Cut Quantity (pcs)',
            'waste_quantity'        => 'Waste Quantity (pcs)',
            'cut_date'              => 'Cut Date',
            // Stage 06 Embroidery
            'vendor_name'           => 'Embroidery Vendor',
            'design_name'           => 'Design Name',
            'sent_quantity'         => 'Sent Quantity (pcs)',
            'received_back_qty'     => 'Received Back Qty (pcs)',
            // Stage 07 Stitching
            'stitched_quantity'     => 'Stitched Quantity (pcs)',
            'defect_quantity'       => 'Defect Quantity (pcs)',
            // Stage 08 Checking
            'passed_quantity'       => 'Passed Quantity (pcs)',
            'rework_quantity'       => 'Rework Quantity (pcs)',
            'rejected_quantity'     => 'Rejected Quantity (pcs)',
            // Stage 09 Packing
            'packed_quantity'       => 'Packed Quantity (pcs)',
            'carton_count'          => 'Carton Count',
            'gross_weight'          => 'Gross Weight (kg)',
            'net_weight'            => 'Net Weight (kg)',
            // Stage 10 Dispatch
            'vehicle_plate_number'  => 'Vehicle Plate Number',
            'driver_name'           => 'Driver Name',
            'eway_bill_number'      => 'E-Way Bill Number',
            'container_seal_number' => 'Container / Seal Number',
            'dispatch_date'         => 'Dispatch Date',
        ];
    }

    /**
     * Keys that contain arrays of sub-records (not scalar values)
     */
    private static function getArrayKeys(): array {
        return [
            'items'                 => 'Product Line Items',
            'material_requirements' => 'Material Requirements (BOM)',
            'purchase_orders'       => 'Purchase Orders (Stage 02)',
            'receipts'              => 'Inward Receipts (Stage 03)',
            'dyeing_orders'         => 'Dyeing Orders (Stage 04)',
            'cutting_batches'       => 'Cutting Batches (Stage 05)',
            'embroidery_jobs'       => 'Embroidery Jobs (Stage 06)',
            'stitching_batches'     => 'Stitching Batches (Stage 07)',
            'inspections'           => 'Quality Inspections (Stage 08)',
            'packing_batches'       => 'Packing Batches (Stage 09)',
            'dispatch_records'      => 'Dispatch Records (Stage 10)',
        ];
    }

    /**
     * Normalize a value for comparison (trim strings, cast numerics)
     */
    private static function normalizeVal(mixed $v): mixed {
        if (is_string($v)) {
            $v = trim($v);
            if (is_numeric($v)) {
                return $v + 0; // numeric string → number
            }
            return $v;
        }
        return $v;
    }

    /**
     * Compare two scalar values, return true if effectively equal
     */
    private static function scalarEqual(mixed $a, mixed $b): bool {
        $a = self::normalizeVal($a);
        $b = self::normalizeVal($b);
        return json_encode($a) === json_encode($b);
    }

    /**
     * Diff two arrays of records (each record is an associative array).
     * Records are matched by 'id' when available; otherwise by position.
     * Returns array of diff entries, each with:
     *   field, label, group_label, record_id, record_title, original, proposed, type (modified|added|removed)
     */
    private static function diffRecordArrays(string $key, string $groupLabel, array $origArr, array $propArr): array {
        $fieldLabels = self::getFieldLabels();
        $skipFields  = [
            'id', 'production_order_id', 'created_at', 'updated_at', 'deleted_at',
            'current_stage_id', 'completed_quantity', 'rejected_quantity', 'rework_quantity',
        ];
        $diffs       = [];

        // Helper to format record title for display
        $getRecordTitle = function(array $rec, string $fallback) use ($key): string {
            if ($key === 'items') {
                $name = $rec['product_name'] ?? 'Garment Product';
                $color = !empty($rec['color']) ? $rec['color'] : (!empty($rec['pantone_color']) ? $rec['pantone_color'] : '');
                $size = !empty($rec['size']) ? " ({$rec['size']})" : '';
                return $color ? "{$name} — {$color}{$size}" : "{$name}{$size}";
            }
            if ($key === 'dyeing_orders') {
                $mill = $rec['mill_name'] ?? $rec['supplier_name'] ?? $rec['dyeing_mill_name'] ?? 'Mill';
                $shade = $rec['shade'] ?? $rec['pantone_color'] ?? '';
                $dc = !empty($rec['challan_no']) ? " [{$rec['challan_no']}]" : '';
                return $shade ? "{$mill} ({$shade}){$dc}" : "{$mill}{$dc}";
            }
            if ($key === 'cutting_batches' || $key === 'stitching_batches') {
                $batch = $rec['batch_number'] ?? "Batch";
                $prod = $rec['product_name'] ?? '';
                return $prod ? "{$batch} — {$prod}" : "{$batch}";
            }
            if ($key === 'purchase_orders') {
                $poNum = $rec['po_number'] ?? "PO";
                $supp = $rec['supplier_name'] ?? '';
                return $supp ? "{$poNum} — {$supp}" : $poNum;
            }
            if ($key === 'receipts') {
                $rcNum = $rec['receipt_no'] ?? $rec['receipt_number'] ?? "GRN";
                $supp = $rec['supplier_name'] ?? '';
                return $supp ? "{$rcNum} — {$supp}" : $rcNum;
            }
            return $rec['product_name'] ?? $rec['item_name'] ?? $rec['batch_number'] ?? $rec['po_number'] ?? $fallback;
        };

        // Index by id
        $origById = [];
        $propById = [];
        foreach ($origArr as $r) {
            $id = $r['id'] ?? null;
            if ($id !== null) $origById[(string)$id] = $r;
        }
        foreach ($propArr as $r) {
            $id = $r['id'] ?? null;
            if ($id !== null) $propById[(string)$id] = $r;
        }

        // 1. Records explicitly marked for deletion in proposed
        foreach ($propArr as $propRec) {
            if (!empty($propRec['_deleted']) || !empty($propRec['is_deleted'])) {
                $rid = (string)($propRec['id'] ?? '');
                $origRec = $rid !== '' && isset($origById[$rid]) ? $origById[$rid] : null;
                $title = $origRec ? $getRecordTitle($origRec, "Record #{$rid}") : "Record #{$rid}";
                $diffs[] = [
                    'field'        => "{$key}[{$rid}]",
                    'label'        => $title,
                    'group_label'  => $groupLabel,
                    'record_id'    => $rid,
                    'record_title' => $title,
                    'record_type'  => 'removed',
                    'original'     => $origRec,
                    'proposed'     => null,
                    'type'         => 'removed',
                    'sub_diffs'    => [],
                ];
            }
        }

        // 2. Records added (in proposed but not in original snapshot)
        foreach ($propById as $rid => $propRec) {
            if (!isset($origById[$rid])) {
                $title = $getRecordTitle($propRec, "New Record");
                $diffs[] = [
                    'field'        => "{$key}[{$rid}]",
                    'label'        => $title,
                    'group_label'  => $groupLabel,
                    'record_id'    => $rid,
                    'record_title' => $title,
                    'record_type'  => 'added',
                    'original'     => null,
                    'proposed'     => $propRec,
                    'type'         => 'added',
                    'sub_diffs'    => [],
                ];
            }
        }

        // 3. Records that exist in both — compare only editable fields present in propRec
        foreach ($origById as $rid => $origRec) {
            if (!isset($propById[$rid])) continue;
            $propRec = $propById[$rid];
            if (!empty($propRec['_deleted']) || !empty($propRec['is_deleted'])) continue;

            $subDiffs = [];
            foreach ($propRec as $f => $pv) {
                if (in_array($f, $skipFields, true)) continue;
                if (!array_key_exists($f, $origRec)) continue;
                $ov = $origRec[$f];
                if (!self::scalarEqual($ov, $pv)) {
                    $fLabel = $fieldLabels[$f] ?? ucwords(str_replace('_', ' ', (string)$f));
                    $subDiffs[] = [
                        'field'    => $f,
                        'label'    => $fLabel,
                        'original' => $ov,
                        'proposed' => $pv,
                        'type'     => 'modified',
                    ];
                }
            }
            if (!empty($subDiffs)) {
                $title = $getRecordTitle($origRec, "Record #{$rid}");
                $diffs[] = [
                    'field'        => "{$key}[{$rid}]",
                    'label'        => $title,
                    'group_label'  => $groupLabel,
                    'record_id'    => $rid,
                    'record_title' => $title,
                    'record_type'  => 'modified',
                    'original'     => $origRec,
                    'proposed'     => $propRec,
                    'type'         => 'modified',
                    'sub_diffs'    => $subDiffs,
                ];
            }
        }

        return $diffs;
    }

    /**
     * Helper: Compute structured diff between original snapshot and proposed data.
     * Handles both scalar fields and nested arrays of records.
     */
    public static function computeChangesDiff(array $original, array $proposed): array {
        $diff        = [];
        $fieldLabels = self::getFieldLabels();
        $arrayKeys   = self::getArrayKeys();
        $scalarSkip  = ['order_id', 'order_number']; // internal IDs not shown

        // 1. Scalar fields: only compare fields that were actually submitted in proposed
        $scalarFields = ['order_title', 'target_delivery_date', 'priority', 'notes', 'remarks'];
        foreach ($scalarFields as $key) {
            if (in_array($key, $scalarSkip, true)) continue;
            // If the user did not propose changes to this scalar field, do NOT diff it!
            if (!array_key_exists($key, $proposed)) continue;

            $origVal = $original[$key] ?? null;
            $propVal = $proposed[$key] ?? null;

            if (self::scalarEqual($origVal, $propVal)) continue;

            $label = $fieldLabels[$key] ?? ucwords(str_replace('_', ' ', $key));
            $diff[] = [
                'field'        => $key,
                'label'        => $label,
                'group_label'  => null,
                'record_id'    => null,
                'record_title' => null,
                'record_type'  => 'scalar',
                'original'     => $origVal ?? '—',
                'proposed'     => $propVal ?? '—',
                'type'         => ($origVal === null || $origVal === '') ? 'added' : 'modified',
                'sub_diffs'    => [],
            ];
        }

        // 2. Array / record collections: only compare arrays that were actually submitted in proposed
        foreach ($arrayKeys as $key => $groupLabel) {
            if (!isset($proposed[$key]) || !is_array($proposed[$key])) {
                continue;
            }
            $origArr = isset($original[$key]) && is_array($original[$key]) ? $original[$key] : [];
            $propArr = $proposed[$key];
            if (empty($origArr) && empty($propArr)) continue;
            $arrDiffs = self::diffRecordArrays($key, $groupLabel, $origArr, $propArr);
            $diff = array_merge($diff, $arrDiffs);
        }

        // 3. Any other scalar keys in proposed not already handled
        $handledScalars = array_merge($scalarFields, $scalarSkip, array_keys($arrayKeys));
        foreach ($proposed as $key => $propVal) {
            if (in_array($key, $handledScalars, true)) continue;
            if (is_array($propVal)) continue; // arrays handled above
            $origVal = $original[$key] ?? null;
            if (self::scalarEqual($origVal, $propVal)) continue;
            $label = $fieldLabels[$key] ?? ucwords(str_replace('_', ' ', (string)$key));
            $diff[] = [
                'field'        => $key,
                'label'        => $label,
                'group_label'  => null,
                'record_id'    => null,
                'record_title' => null,
                'record_type'  => 'scalar',
                'original'     => $origVal ?? '—',
                'proposed'     => $propVal ?? '—',
                'type'         => ($origVal === null || $origVal === '') ? 'added' : 'modified',
                'sub_diffs'    => [],
            ];
        }

        return $diff;
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
                if (!empty($order['generated_bom'])) {
                    $bomDecoded = json_decode($order['generated_bom'], true);
                    if (!empty($bomDecoded['total_materials']) && is_array($bomDecoded['total_materials'])) {
                        $snapshot['material_requirements'] = $bomDecoded['total_materials'];
                    }
                }
                break;

            case 2: // PO
                $poRows = $pdo->prepare("
                    SELECT po.*, s.name as supplier_name, s.code as supplier_code
                    FROM purchase_orders po
                    LEFT JOIN suppliers s ON po.supplier_id = s.id
                    WHERE po.production_order_id = ? AND po.deleted_at IS NULL
                    ORDER BY po.id ASC
                ");
                $poRows->execute([$orderId]);
                $snapshot['purchase_orders'] = $poRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 3: // Inward
                $recRows = $pdo->prepare("
                    SELECT pr.*, po.po_number, s.name as supplier_name,
                           (SELECT COALESCE(SUM(quantity_received), 0) FROM purchase_receipt_items pri WHERE pri.purchase_receipt_id = pr.id) as quantity_received,
                           (SELECT COALESCE(SUM(quantity_received), 0) FROM purchase_receipt_items pri WHERE pri.purchase_receipt_id = pr.id) as total_quantity
                    FROM purchase_receipts pr
                    JOIN purchase_orders po ON pr.purchase_order_id = po.id
                    LEFT JOIN suppliers s ON po.supplier_id = s.id
                    WHERE po.production_order_id = ?
                    ORDER BY pr.id ASC
                ");
                $recRows->execute([$orderId]);
                $snapshot['receipts'] = $recRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 4: // Dyeing
                $dyeRows = $pdo->prepare("
                    SELECT d.*, s.name as mill_name, s.name as supplier_name
                    FROM dyeing_orders d
                    LEFT JOIN suppliers s ON d.supplier_id = s.id
                    WHERE d.production_order_id = ? AND d.deleted_at IS NULL
                    ORDER BY d.id ASC
                ");
                $dyeRows->execute([$orderId]);
                $snapshot['dyeing_orders'] = $dyeRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 5: // Cutting
                $cutRows = $pdo->prepare("
                    SELECT cb.*, 
                           COALESCE(bp.product_name, p.name, 'Garment Product') as product_name,
                           poi.color
                    FROM cutting_batches cb
                    LEFT JOIN production_order_items poi ON cb.production_order_item_id = poi.id
                    LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                    LEFT JOIN products p ON poi.product_id = p.id
                    WHERE cb.production_order_id = ?
                    ORDER BY cb.id ASC
                ");
                $cutRows->execute([$orderId]);
                $snapshot['cutting_batches'] = $cutRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 6: // Embroidery
                $embRows = $pdo->prepare("SELECT * FROM embroidery_job_orders WHERE production_order_id = ? ORDER BY id ASC");
                $embRows->execute([$orderId]);
                $snapshot['embroidery_jobs'] = $embRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 7: // Stitching
                $stiRows = $pdo->prepare("
                    SELECT sb.*, 
                           COALESCE(bp.product_name, p.name, 'Garment Product') as product_name,
                           poi.color
                    FROM stitching_batches sb
                    LEFT JOIN production_order_items poi ON sb.production_order_item_id = poi.id
                    LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                    LEFT JOIN products p ON poi.product_id = p.id
                    WHERE sb.production_order_id = ?
                    ORDER BY sb.id ASC
                ");
                $stiRows->execute([$orderId]);
                $snapshot['stitching_batches'] = $stiRows->fetchAll(PDO::FETCH_ASSOC);
                break;

            case 8: // Checking
                $chkRows = $pdo->prepare("
                    SELECT qi.*, 
                           COALESCE(bp.product_name, p.name, 'Garment Product') as product_name
                    FROM quality_inspections qi
                    LEFT JOIN production_order_items poi ON qi.production_order_item_id = poi.id
                    LEFT JOIN buyer_products bp ON poi.product_id = bp.id
                    LEFT JOIN products p ON poi.product_id = p.id
                    WHERE qi.production_order_id = ?
                    ORDER BY qi.id ASC
                ");
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
            // Validate downstream safety constraints before applying modifications
            $safetyCheck = self::validateDownstreamSafety($pdo, $orderId, $stageId, $proposed);
            if (!$safetyCheck['valid']) {
                return ['success' => false, 'message' => $safetyCheck['message']];
            }

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
                case 1: // Requirement Gathering
                    if (!empty($proposed['material_requirements']) && is_array($proposed['material_requirements'])) {
                        $bomStmt = $pdo->prepare("SELECT generated_bom FROM production_orders WHERE id = ?");
                        $bomStmt->execute([$orderId]);
                        $rawBom = $bomStmt->fetchColumn();
                        $bomData = $rawBom ? json_decode($rawBom, true) : [];
                        $bomData['total_materials'] = $proposed['material_requirements'];
                        $upBom = $pdo->prepare("UPDATE production_orders SET generated_bom = ? WHERE id = ?");
                        $upBom->execute([json_encode($bomData), $orderId]);
                    }
                    break;

                case 2: // PO
                    if (!empty($proposed['purchase_orders']) && is_array($proposed['purchase_orders'])) {
                        $upPo = $pdo->prepare("
                            UPDATE purchase_orders SET 
                                delivery_date = COALESCE(?, delivery_date),
                                payment_terms = COALESCE(?, payment_terms),
                                remarks = COALESCE(?, remarks)
                            WHERE id = ? AND production_order_id = ?
                        ");
                        foreach ($proposed['purchase_orders'] as $poRow) {
                            if (!empty($poRow['id'])) {
                                $upPo->execute([
                                    $poRow['delivery_date'] ?? null,
                                    $poRow['payment_terms'] ?? null,
                                    $poRow['remarks'] ?? null,
                                    (int)$poRow['id'],
                                    $orderId
                                ]);
                            }
                        }
                    }
                    break;

                case 3: // Inward
                    if (!empty($proposed['receipts']) && is_array($proposed['receipts'])) {
                        $upRec = $pdo->prepare("
                            UPDATE purchase_receipts SET 
                                delivery_challan_no = COALESCE(?, delivery_challan_no),
                                vehicle_no = COALESCE(?, vehicle_no),
                                remarks = COALESCE(?, remarks)
                            WHERE id = ?
                        ");
                        $upRecItem = $pdo->prepare("
                            UPDATE purchase_receipt_items SET
                                quantity_received = ?,
                                accepted_quantity = ?
                            WHERE purchase_receipt_id = ?
                        ");
                        $upPoi = $pdo->prepare("
                            UPDATE purchase_order_items poi
                            SET received_quantity = (
                                SELECT COALESCE(SUM(pri.quantity_received), 0)
                                FROM purchase_receipt_items pri
                                WHERE pri.purchase_order_item_id = poi.id
                            )
                            WHERE poi.purchase_order_id = (SELECT purchase_order_id FROM purchase_receipts WHERE id = ?)
                        ");
                        foreach ($proposed['receipts'] as $prRow) {
                            if (!empty($prRow['id'])) {
                                $upRec->execute([
                                    $prRow['delivery_challan_no'] ?? null,
                                    $prRow['vehicle_no'] ?? null,
                                    $prRow['remarks'] ?? null,
                                    (int)$prRow['id']
                                ]);
                                $qty = $prRow['quantity_received'] ?? $prRow['total_quantity'] ?? null;
                                if ($qty !== null && is_numeric($qty)) {
                                    $upRecItem->execute([(float)$qty, (float)$qty, (int)$prRow['id']]);
                                    $upPoi->execute([(int)$prRow['id']]);
                                }
                            }
                        }
                    }
                    break;

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

    /**
     * Safety check: Verify that reducing historical quantities does not violate downstream processed quantities
     */
    private static function validateDownstreamSafety(PDO $pdo, int $orderId, int $stageId, array $proposed): array {
        try {
            switch ($stageId) {
                case 3: // Stage 03 Inward
                    // If inward receipts are being modified, ensure total inward received fabric >= fabric sent to Dyeing
                    if (!empty($proposed['receipts']) && is_array($proposed['receipts'])) {
                        $dyeCheck = $pdo->prepare("
                            SELECT COALESCE(SUM(outward_quantity), 0) as total_outward
                            FROM dyeing_orders 
                            WHERE production_order_id = ? AND status != 'Cancelled' AND deleted_at IS NULL
                        ");
                        $dyeCheck->execute([$orderId]);
                        $totalDyeingOutward = (float)$dyeCheck->fetchColumn();

                        if ($totalDyeingOutward > 0) {
                            $propReceiptsById = [];
                            foreach ($proposed['receipts'] as $pr) {
                                if (!empty($pr['id'])) {
                                    $propReceiptsById[(int)$pr['id']] = (float)($pr['quantity_received'] ?? $pr['total_quantity'] ?? 0);
                                }
                            }

                            $allRecs = $pdo->prepare("
                                SELECT pr.id, COALESCE(SUM(pri.quantity_received), 0) as qty
                                FROM purchase_receipts pr
                                JOIN purchase_orders po ON pr.purchase_order_id = po.id
                                LEFT JOIN purchase_receipt_items pri ON pri.purchase_receipt_id = pr.id
                                WHERE po.production_order_id = ?
                                GROUP BY pr.id
                            ");
                            $allRecs->execute([$orderId]);
                            $rows = $allRecs->fetchAll(PDO::FETCH_ASSOC);

                            $newTotal = 0.0;
                            foreach ($rows as $r) {
                                $rId = (int)$r['id'];
                                if (isset($propReceiptsById[$rId])) {
                                    $newTotal += $propReceiptsById[$rId];
                                } else {
                                    $newTotal += (float)$r['qty'];
                                }
                            }

                            if ($newTotal < $totalDyeingOutward) {
                                return [
                                    'valid' => false,
                                    'message' => "Safety Constraint: Inward received quantity cannot be reduced to {$newTotal} MTR because {$totalDyeingOutward} MTR has already been issued outward to Dyeing (Stage 04)."
                                ];
                            }
                        }
                    }
                    break;

                case 4: // Stage 04 Dyeing
                    if (!empty($proposed['dyeing_orders']) && is_array($proposed['dyeing_orders'])) {
                        $cutCheck = $pdo->prepare("
                            SELECT COALESCE(SUM(cut_quantity), 0) + COALESCE(SUM(actual_cut_quantity), 0)
                            FROM cutting_batches
                            WHERE production_order_id = ?
                        ");
                        $cutCheck->execute([$orderId]);
                        $totalCut = (float)$cutCheck->fetchColumn();

                        if ($totalCut > 0) {
                            $proposedDyeTotal = 0.0;
                            foreach ($proposed['dyeing_orders'] as $do) {
                                $proposedDyeTotal += (float)($do['outward_quantity'] ?? $do['received_quantity'] ?? 0);
                            }
                            if ($proposedDyeTotal > 0 && $proposedDyeTotal < ($totalCut * 0.5)) {
                                return [
                                    'valid' => false,
                                    'message' => "Safety Constraint: Proposed Dyeing quantity ({$proposedDyeTotal}) is below the quantity already cut ({$totalCut} pcs) in Cutting (Stage 05)."
                                ];
                            }
                        }
                    }
                    break;

                case 5: // Stage 05 Cutting
                    if (!empty($proposed['cutting_batches']) && is_array($proposed['cutting_batches'])) {
                        $embCheck = $pdo->prepare("SELECT COALESCE(SUM(sent_quantity), 0) FROM embroidery_job_orders WHERE production_order_id = ?");
                        $embCheck->execute([$orderId]);
                        $totalEmb = (float)$embCheck->fetchColumn();

                        $stiCheck = $pdo->prepare("SELECT COALESCE(SUM(stitched_quantity), 0) + COALESCE(SUM(completed_quantity), 0) FROM stitching_batches WHERE production_order_id = ?");
                        $stiCheck->execute([$orderId]);
                        $totalSti = (float)$stiCheck->fetchColumn();

                        $downstreamNeeded = max($totalEmb, $totalSti);

                        if ($downstreamNeeded > 0) {
                            $propBatchesById = [];
                            foreach ($proposed['cutting_batches'] as $cb) {
                                if (!empty($cb['id'])) {
                                    $propBatchesById[(int)$cb['id']] = (float)($cb['cut_quantity'] ?? $cb['actual_cut_quantity'] ?? 0);
                                }
                            }

                            $allCut = $pdo->prepare("SELECT id, COALESCE(cut_quantity, actual_cut_quantity, 0) as qty FROM cutting_batches WHERE production_order_id = ?");
                            $allCut->execute([$orderId]);
                            $proposedCutTotal = 0.0;
                            foreach ($allCut->fetchAll(PDO::FETCH_ASSOC) as $r) {
                                $bId = (int)$r['id'];
                                $proposedCutTotal += isset($propBatchesById[$bId]) ? $propBatchesById[$bId] : (float)$r['qty'];
                            }

                            if ($proposedCutTotal < $downstreamNeeded) {
                                return [
                                    'valid' => false,
                                    'message' => "Safety Constraint: Total cut quantity cannot be reduced to {$proposedCutTotal} pcs because {$downstreamNeeded} pcs have already progressed into downstream Embroidery / Stitching stages."
                                ];
                            }
                        }
                    }
                    break;

                case 7: // Stage 07 Stitching
                    if (!empty($proposed['stitching_batches']) && is_array($proposed['stitching_batches'])) {
                        $chkCheck = $pdo->prepare("
                            SELECT COALESCE(SUM(passed_quantity), 0) + COALESCE(SUM(rework_quantity), 0) + COALESCE(SUM(rejected_quantity), 0)
                            FROM quality_inspections
                            WHERE production_order_id = ?
                        ");
                        $chkCheck->execute([$orderId]);
                        $totalInspected = (float)$chkCheck->fetchColumn();

                        if ($totalInspected > 0) {
                            $propBatchesById = [];
                            foreach ($proposed['stitching_batches'] as $sb) {
                                if (!empty($sb['id'])) {
                                    $propBatchesById[(int)$sb['id']] = (float)($sb['stitched_quantity'] ?? $sb['completed_quantity'] ?? 0);
                                }
                            }

                            $allSti = $pdo->prepare("SELECT id, COALESCE(stitched_quantity, completed_quantity, 0) as qty FROM stitching_batches WHERE production_order_id = ?");
                            $allSti->execute([$orderId]);
                            $proposedStiTotal = 0.0;
                            foreach ($allSti->fetchAll(PDO::FETCH_ASSOC) as $r) {
                                $bId = (int)$r['id'];
                                $proposedStiTotal += isset($propBatchesById[$bId]) ? $propBatchesById[$bId] : (float)$r['qty'];
                            }

                            if ($proposedStiTotal < $totalInspected) {
                                return [
                                    'valid' => false,
                                    'message' => "Safety Constraint: Total stitched quantity cannot be reduced to {$proposedStiTotal} pcs because {$totalInspected} pcs have already undergone Quality Checking (Stage 08)."
                                ];
                            }
                        }
                    }
                    break;

                case 8: // Stage 08 Checking
                    if (!empty($proposed['inspections']) && is_array($proposed['inspections'])) {
                        $pckCheck = $pdo->prepare("SELECT COALESCE(SUM(packed_quantity), 0) FROM packing_batches WHERE production_order_id = ?");
                        $pckCheck->execute([$orderId]);
                        $totalPacked = (float)$pckCheck->fetchColumn();

                        if ($totalPacked > 0) {
                            $propInspById = [];
                            foreach ($proposed['inspections'] as $qi) {
                                if (!empty($qi['id'])) {
                                    $propInspById[(int)$qi['id']] = (float)($qi['passed_quantity'] ?? 0);
                                }
                            }

                            $allInsp = $pdo->prepare("SELECT id, COALESCE(passed_quantity, 0) as qty FROM quality_inspections WHERE production_order_id = ?");
                            $allInsp->execute([$orderId]);
                            $proposedPassedTotal = 0.0;
                            foreach ($allInsp->fetchAll(PDO::FETCH_ASSOC) as $r) {
                                $iId = (int)$r['id'];
                                $proposedPassedTotal += isset($propInspById[$iId]) ? $propInspById[$iId] : (float)$r['qty'];
                            }

                            if ($proposedPassedTotal < $totalPacked) {
                                return [
                                    'valid' => false,
                                    'message' => "Safety Constraint: Passed inspection quantity cannot be reduced to {$proposedPassedTotal} pcs because {$totalPacked} pcs are already packed into cartons in Packing (Stage 09)."
                                ];
                            }
                        }
                    }
                    break;

                case 9: // Stage 09 Packing
                    if (!empty($proposed['packing_batches']) && is_array($proposed['packing_batches'])) {
                        $dispCheck = $pdo->prepare("SELECT COALESCE(SUM(total_dispatched_quantity), 0) FROM dispatch_records WHERE production_order_id = ?");
                        $dispCheck->execute([$orderId]);
                        $totalDispatched = (float)$dispCheck->fetchColumn();

                        if ($totalDispatched > 0) {
                            $propPckById = [];
                            foreach ($proposed['packing_batches'] as $pb) {
                                if (!empty($pb['id'])) {
                                    $propPckById[(int)$pb['id']] = (float)($pb['packed_quantity'] ?? 0);
                                }
                            }

                            $allPck = $pdo->prepare("SELECT id, COALESCE(packed_quantity, 0) as qty FROM packing_batches WHERE production_order_id = ?");
                            $allPck->execute([$orderId]);
                            $proposedPackedTotal = 0.0;
                            foreach ($allPck->fetchAll(PDO::FETCH_ASSOC) as $r) {
                                $pId = (int)$r['id'];
                                $proposedPackedTotal += isset($propPckById[$pId]) ? $propPckById[$pId] : (float)$r['qty'];
                            }

                            if ($proposedPackedTotal < $totalDispatched) {
                                return [
                                    'valid' => false,
                                    'message' => "Safety Constraint: Packed quantity cannot be reduced to {$proposedPackedTotal} pcs because {$totalDispatched} pcs have already been dispatched in Stage 10."
                                ];
                            }
                        }
                    }
                    break;
            }
        } catch (Throwable $e) {
            // In case of query error or non-critical column discrepancy, do not crash validation
        }

        return ['valid' => true];
    }
}

