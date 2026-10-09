<?php
// backend/core/AuditLogger.php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

class AuditLogger {
    public static function log(string $module, string $action, ?int $recordId = null, $oldValue = null, $newValue = null, ?int $userId = 1): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                INSERT INTO audit_logs (user_id, module, action, record_id, old_value, new_value, ip_address)
                VALUES (:user_id, :module, :action, :record_id, :old_value, :new_value, :ip_address)
            ");
            $stmt->execute([
                ':user_id' => $userId,
                ':module' => $module,
                ':action' => $action,
                ':record_id' => $recordId,
                ':old_value' => $oldValue ? json_encode($oldValue) : null,
                ':new_value' => $newValue ? json_encode($newValue) : null,
                ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
            ]);
        } catch (Exception $e) {
            error_log("Audit log failed: " . $e->getMessage());
        }
    }
}
