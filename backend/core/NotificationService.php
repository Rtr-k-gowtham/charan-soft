<?php
// backend/core/NotificationService.php
declare(strict_types=1);

require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/../config/database.php';

class NotificationService {
    // Stage route prefix mapping
    public const STAGE_ROUTES = [
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

    /**
     * Ensure the notifications table exists
     */
    public static function ensureTable(PDO $pdo): void {
        static $checked = false;
        if ($checked) return;

        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS \`notifications\` (
                  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
                  \`user_id\` INT NOT NULL,
                  \`event_type\` VARCHAR(50) NOT NULL,
                  \`production_order_id\` INT NOT NULL,
                  \`order_number\` VARCHAR(50) NULL,
                  \`order_title\` VARCHAR(255) NULL,
                  \`source_stage_id\` INT NULL,
                  \`destination_stage_id\` INT NULL,
                  \`source_stage_name\` VARCHAR(100) NULL,
                  \`destination_stage_name\` VARCHAR(100) NULL,
                  \`title\` VARCHAR(255) NOT NULL,
                  \`message\` TEXT NOT NULL,
                  \`action_url\` VARCHAR(255) NULL,
                  \`is_read\` TINYINT(1) NOT NULL DEFAULT 0,
                  \`idempotency_key\` VARCHAR(120) NULL,
                  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  \`read_at\` DATETIME NULL,
                  INDEX \`idx_notif_user_read\` (\`user_id\`, \`is_read\`, \`created_at\`),
                  INDEX \`idx_notif_order\` (\`production_order_id\`),
                  UNIQUE INDEX \`idx_notif_idempotency\` (\`idempotency_key\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            $checked = true;
        } catch (Throwable $e) {
            error_log("Failed to ensure notifications table: " . $e->getMessage());
        }
    }

    /**
     * Notify all active users across Role 1, Role 2, and Admin when a new production order is created
     */
    public static function notifyOrderCreated(PDO $pdo, int $orderId, string $orderNumber, string $orderTitle): void {
        self::ensureTable($pdo);
        try {
            $stmt = $pdo->query("
                SELECT u.id, u.name, u.email, r.name as role_name
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.status = 'active' AND u.deleted_at IS NULL
            ");
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $insStmt = $pdo->prepare("
                INSERT IGNORE INTO notifications 
                (user_id, event_type, production_order_id, order_number, order_title, source_stage_id, destination_stage_id, source_stage_name, destination_stage_name, title, message, action_url, idempotency_key)
                VALUES (?, 'ORDER_CREATED', ?, ?, ?, NULL, 1, NULL, 'Requirement Gathering', ?, ?, ?, ?)
            ");

            foreach ($users as $u) {
                $role = Auth::normalizeRoleName((string)$u['role_name']);
                $actionUrl = ($role === 'Admin') 
                    ? "/production/orders/{$orderId}" 
                    : "/tasks";

                $title = "New production order {$orderNumber} created";
                $msg = "New production order {$orderNumber} — {$orderTitle} was created and is available for processing.";
                $idempKey = "ORD_CREATED_{$orderId}_USER_{$u['id']}";

                $insStmt->execute([
                    $u['id'],
                    $orderId,
                    $orderNumber,
                    $orderTitle,
                    $title,
                    $msg,
                    $actionUrl,
                    $idempKey
                ]);
            }
        } catch (Throwable $e) {
            error_log("Error generating new order notifications: " . $e->getMessage());
        }
    }

    /**
     * Notify authorized destination stage roles + Admin when an order moves to a new stage
     */
    public static function notifyStageTransition(
        PDO $pdo,
        int $orderId,
        ?int $fromStageId,
        int $toStageId,
        string $orderNumber,
        string $orderTitle,
        string $notes = ''
    ): void {
        self::ensureTable($pdo);
        try {
            // Resolve stage names
            $stages = $pdo->query("SELECT id, name, code, sequence_order FROM production_stages")->fetchAll(PDO::FETCH_ASSOC);
            $stageMap = [];
            foreach ($stages as $s) {
                $stageMap[(int)$s['id']] = $s;
            }

            $destStage = $stageMap[$toStageId] ?? [
                'name' => "Stage {$toStageId}",
                'sequence_order' => $toStageId,
                'code' => 'STG'
            ];
            $destStageName = $destStage['name'];
            $fromStageName = ($fromStageId && isset($stageMap[$fromStageId])) 
                ? $stageMap[$fromStageId]['name'] 
                : 'Previous Stage';

            // Determine authorized roles for destination stage
            // Stage 1, 2, 3, 9, 10 -> Role 1 and Admin
            // Stage 4, 5, 6, 7, 8 -> Role 2 and Admin
            $isRole1Stage = in_array($toStageId, Auth::STAGE_MATRIX['Role 1'], true);
            $isRole2Stage = in_array($toStageId, Auth::STAGE_MATRIX['Role 2'], true);

            $allowedRoleNames = ['Admin'];
            if ($isRole1Stage) $allowedRoleNames[] = 'Role 1';
            if ($isRole2Stage) $allowedRoleNames[] = 'Role 2';

            $inPlaceholders = implode(',', array_fill(0, count($allowedRoleNames), '?'));
            $uStmt = $pdo->prepare("
                SELECT u.id, u.name, u.email, r.name as role_name
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.status = 'active' AND u.deleted_at IS NULL
                  AND (r.name IN ({$inPlaceholders}) OR r.display_name IN ({$inPlaceholders}))
            ");
            $uStmt->execute(array_merge($allowedRoleNames, $allowedRoleNames));
            $users = $uStmt->fetchAll(PDO::FETCH_ASSOC);

            $insStmt = $pdo->prepare("
                INSERT IGNORE INTO notifications 
                (user_id, event_type, production_order_id, order_number, order_title, source_stage_id, destination_stage_id, source_stage_name, destination_stage_name, title, message, action_url, idempotency_key)
                VALUES (?, 'STAGE_TRANSITION', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $routePrefix = self::STAGE_ROUTES[$toStageId] ?? '/tasks';
            $baseActionUrl = "{$routePrefix}/{$orderId}";

            // Idempotency window bucket: 1 minute
            $timeBucket = floor(time() / 60);

            foreach ($users as $u) {
                $role = Auth::normalizeRoleName((string)$u['role_name']);
                $actionUrl = ($role === 'Admin' || Auth::isStageAllowed($role, $toStageId)) 
                    ? $baseActionUrl 
                    : '/tasks';

                $title = "{$orderNumber} moved to {$destStageName}";
                $msg = "Order {$orderNumber} ({$orderTitle}) transitioned from {$fromStageName} to {$destStageName}. Action is now available.";
                if (!empty($notes)) {
                    $msg .= " Handover notes: {$notes}";
                }

                $idempKey = "STAGE_TRANS_{$orderId}_{$toStageId}_USER_{$u['id']}_{$timeBucket}";

                $insStmt->execute([
                    $u['id'],
                    $orderId,
                    $orderNumber,
                    $orderTitle,
                    $fromStageId,
                    $toStageId,
                    $fromStageName,
                    $destStageName,
                    $title,
                    $msg,
                    $actionUrl,
                    $idempKey
                ]);
            }
        } catch (Throwable $e) {
            error_log("Error generating stage transition notifications: " . $e->getMessage());
        }
    }

    /**
     * Get recent notifications for a user
     */
    public static function getUserNotifications(PDO $pdo, int $userId, int $limit = 30): array {
        self::ensureTable($pdo);
        $stmt = $pdo->prepare("
            SELECT * FROM notifications 
            WHERE user_id = ? 
            ORDER BY id DESC 
            LIMIT ?
        ");
        $stmt->bindValue(1, $userId, PDO::PARAM_INT);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get count of unread notifications for a user
     */
    public static function getUnreadCount(PDO $pdo, int $userId): int {
        self::ensureTable($pdo);
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0");
        $stmt->execute([$userId]);
        return (int)$stmt->fetchColumn();
    }

    /**
     * Mark single notification or all notifications as read for a user
     */
    public static function markAsRead(PDO $pdo, int $userId, ?int $notificationId = null, bool $markAll = false): void {
        self::ensureTable($pdo);
        if ($markAll || !$notificationId) {
            $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0");
            $stmt->execute([$userId]);
        } else {
            $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND id = ?");
            $stmt->execute([$userId, $notificationId]);
        }
    }
}

