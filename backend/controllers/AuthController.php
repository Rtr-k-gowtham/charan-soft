<?php
// backend/controllers/AuthController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../config/database.php';

class AuthController {
    public function login(): void {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = trim($body['email'] ?? $body['username'] ?? '');
        $password = trim($body['password'] ?? '');

        if (empty($email) || empty($password)) {
            Response::error('Username or email and password are required', 422);
            return;
        }

        $emailLower = strtolower($email);

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                SELECT u.*, r.name as role_name 
                FROM users u 
                JOIN roles r ON u.role_id = r.id 
                WHERE (LOWER(u.email) = :email OR LOWER(u.name) = :emailLower) 
                  AND u.status = 'active'
                  AND u.deleted_at IS NULL
                ORDER BY u.id ASC
                LIMIT 1
            ");
            $stmt->execute([':email' => $emailLower, ':emailLower' => $emailLower]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user || empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
                Response::error('Invalid username or password', 401);
                return;
            }

            unset($user['password_hash']);
            $normRole = Auth::normalizeRoleName((string)$user['role_name']);
            $user['role'] = $normRole;
            $user['role_name'] = $normRole;
            $user['username'] = $user['name'];
            $user['allowed_stages'] = Auth::getAllowedStagesForRole($normRole);
            $user['token'] = base64_encode(json_encode(['id' => (int)$user['id'], 'time' => time()]));

            Response::success($user, 'Login successful');
        } catch (Exception $e) {
            Response::error('Database authentication error: ' . $e->getMessage(), 500);
        }
    }

    public function me(): void {
        $user = Auth::getAuthenticatedUser();
        if ($user) {
            Response::success($user);
            return;
        }

        Response::error('Unauthenticated', 401);
    }
}
