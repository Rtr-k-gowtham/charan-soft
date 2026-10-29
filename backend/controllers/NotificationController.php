<?php
// backend/controllers/NotificationController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/NotificationService.php';
require_once __DIR__ . '/../config/database.php';

class NotificationController {
    /**
     * GET /api/notifications
     * Return list of notifications for the current authenticated user
     */
    public function index(): void {
        $user = Auth::requireUser();
        try {
            $pdo = Database::getConnection();
            $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 40;
            $notifs = NotificationService::getUserNotifications($pdo, (int)$user['id'], $limit);
            $unreadCount = NotificationService::getUnreadCount($pdo, (int)$user['id']);

            Response::success([
                'notifications' => $notifs,
                'unread_count' => $unreadCount
            ]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * GET /api/notifications/unread-count
     * Fast lightweight check for unread count
     */
    public function unreadCount(): void {
        $user = Auth::requireUser();
        try {
            $pdo = Database::getConnection();
            $count = NotificationService::getUnreadCount($pdo, (int)$user['id']);
            Response::success(['unread_count' => $count]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * POST /api/notifications/read
     * Mark single notification or all notifications as read
     */
    public function markRead(): void {
        $user = Auth::requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $notifId = !empty($data['id']) ? (int)$data['id'] : null;
        $markAll = !empty($data['all']) || empty($notifId);

        try {
            $pdo = Database::getConnection();
            NotificationService::markAsRead($pdo, (int)$user['id'], $notifId, $markAll);
            $count = NotificationService::getUnreadCount($pdo, (int)$user['id']);
            Response::success([
                'unread_count' => $count,
                'marked_all' => $markAll,
                'id' => $notifId
            ], "Notifications updated");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}

