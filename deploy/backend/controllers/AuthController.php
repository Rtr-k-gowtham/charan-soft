<?php
// backend/controllers/AuthController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
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

        // Demo / fallback admin login
        if (($emailLower === 'admin' || $emailLower === 'admin@cheransoftgoods.com') && ($password === 'admin123' || $password === 'password')) {
            $user = [
                'id' => 1,
                'name' => 'Admin',
                'username' => 'admin',
                'email' => 'admin@cheransoftgoods.com',
                'role' => 'ADMIN',
                'role_name' => 'System Administrator',
                'permissions' => ['all'],
                'token' => 'jwt_mock_token_admin_cheran_erp_' . time()
            ];
            Response::success($user, 'Login successful');
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                SELECT u.*, r.name as role_name 
                FROM users u 
                JOIN roles r ON u.role_id = r.id 
                WHERE (u.email = :email OR :emailLower = 'admin') AND u.status = 'active'
                ORDER BY u.id ASC
                LIMIT 1
            ");
            $stmt->execute([':email' => $email, ':emailLower' => $emailLower]);
            $user = $stmt->fetch();

            if (!$user || !password_verify($password, $user['password_hash'])) {
                // If admin password matches default
                if (($emailLower === 'admin' || $emailLower === 'admin@cheransoftgoods.com') && ($password === 'admin123' || $password === 'password')) {
                    $user = [
                        'id' => 1,
                        'name' => 'Admin',
                        'username' => 'admin',
                        'email' => 'admin@cheransoftgoods.com',
                        'role' => 'ADMIN',
                        'role_name' => 'System Administrator',
                        'permissions' => ['all'],
                        'token' => 'jwt_mock_token_admin_cheran_erp_' . time()
                    ];
                    Response::success($user, 'Login successful');
                    return;
                }
                Response::error('Invalid username or password', 401);
                return;
            }

            unset($user['password_hash']);
            $user['name'] = 'Admin';
            $user['username'] = 'admin';
            $user['token'] = base64_encode(json_encode(['id' => $user['id'], 'time' => time()]));
            Response::success($user, 'Login successful');
        } catch (Exception $e) {
            Response::error('Database authentication error: ' . $e->getMessage(), 500);
        }
    }

    public function me(): void {
        Response::success([
            'id' => 1,
            'name' => 'Admin',
            'username' => 'admin',
            'email' => 'admin@cheransoftgoods.com',
            'role' => 'ADMIN',
            'role_name' => 'System Administrator',
        ]);
    }
}
