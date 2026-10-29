<?php
// backend/core/Auth.php
declare(strict_types=1);

require_once __DIR__ . '/Response.php';
require_once __DIR__ . '/../config/database.php';

class Auth {
    // Stage Access Matrix Source of Truth
    // Role 1: Stages 01, 02, 03, 09, 10
    // Role 2: Stages 04, 05, 06, 07, 08
    // Admin: All 10 stages (01 - 10)
    public const STAGE_MATRIX = [
        'Role 1' => [1, 2, 3, 9, 10],
        'Role 2' => [4, 5, 6, 7, 8],
        'Admin'  => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    ];

    private static ?array $cachedUser = null;

    /**
     * Get the currently authenticated user from Bearer token
     */
    public static function getAuthenticatedUser(): ?array {
        if (self::$cachedUser !== null) {
            return self::$cachedUser;
        }

        $token = self::extractBearerToken();
        if (empty($token)) {
            return null;
        }

        // 1. Direct mock token shortcuts for demo/testing
        if (str_starts_with($token, 'jwt_mock_token_admin') || $token === 'admin_token') {
            self::$cachedUser = [
                'id' => 1,
                'name' => 'Admin',
                'username' => 'admin',
                'email' => 'admin@cheransoftgoods.com',
                'role_id' => 1,
                'role' => 'Admin',
                'role_name' => 'Admin',
                'allowed_stages' => self::STAGE_MATRIX['Admin']
            ];
            return self::$cachedUser;
        }

        if (str_starts_with($token, 'jwt_mock_token_role1')) {
            self::$cachedUser = [
                'id' => 8,
                'name' => 'Role 1 User',
                'username' => 'role1',
                'email' => 'role1@cheransoftgoods.com',
                'role_id' => 2,
                'role' => 'Role 1',
                'role_name' => 'Role 1',
                'allowed_stages' => self::STAGE_MATRIX['Role 1']
            ];
            return self::$cachedUser;
        }

        if (str_starts_with($token, 'jwt_mock_token_role2')) {
            self::$cachedUser = [
                'id' => 9,
                'name' => 'Role 2 User',
                'username' => 'role2',
                'email' => 'role2@cheransoftgoods.com',
                'role_id' => 3,
                'role' => 'Role 2',
                'role_name' => 'Role 2',
                'allowed_stages' => self::STAGE_MATRIX['Role 2']
            ];
            return self::$cachedUser;
        }

        // 2. Decode base64 payload
        try {
            $json = base64_decode($token, true);
            if ($json) {
                $payload = json_decode($json, true);
                if (is_array($payload) && !empty($payload['id'])) {
                    $userId = (int)$payload['id'];
                    $pdo = Database::getConnection();
                    $stmt = $pdo->prepare("
                        SELECT u.id, u.name, u.email, u.phone, u.role_id, u.status, r.name as role_name
                        FROM users u
                        JOIN roles r ON u.role_id = r.id
                        WHERE u.id = ? AND u.status = 'active' AND u.deleted_at IS NULL
                        LIMIT 1
                    ");
                    $stmt->execute([$userId]);
                    $user = $stmt->fetch();
                    if ($user) {
                        $roleName = self::normalizeRoleName((string)$user['role_name']);
                        $user['role'] = $roleName;
                        $user['role_name'] = $roleName;
                        $user['allowed_stages'] = self::getAllowedStagesForRole($roleName);
                        self::$cachedUser = $user;
                        return self::$cachedUser;
                    }
                }
            }
        } catch (Throwable $e) {
            error_log("Auth token decode error: " . $e->getMessage());
        }

        return null;
    }

    /**
     * Require that a user is authenticated
     */
    public static function requireUser(): array {
        $user = self::getAuthenticatedUser();
        if (!$user) {
            Response::error('Unauthenticated: Access token is missing or invalid.', 401);
            exit;
        }
        return $user;
    }

    /**
     * Require that authenticated user has one of the allowed roles
     */
    public static function requireRole(array|string $allowedRoles): array {
        $user = self::requireUser();
        $allowed = is_array($allowedRoles) ? $allowedRoles : [$allowedRoles];
        $allowedNorm = array_map([self::class, 'normalizeRoleName'], $allowed);

        // Admin always has full access
        if (in_array('Admin', $allowedNorm, true) && self::normalizeRoleName($user['role']) === 'Admin') {
            return $user;
        }

        if (!in_array(self::normalizeRoleName($user['role']), $allowedNorm, true)) {
            Response::error("Forbidden: Your role ({$user['role_name']}) does not have permission to access this resource.", 403);
            exit;
        }

        return $user;
    }

    /**
     * Require that authenticated user has access to a specific production stage
     */
    public static function requireStageAccess(int $stageId): array {
        $user = self::requireUser();
        $role = self::normalizeRoleName($user['role']);

        if (!self::isStageAllowed($role, $stageId)) {
            Response::error("Forbidden: {$role} does not have access to Production Stage {$stageId}.", 403);
            exit;
        }

        return $user;
    }

    /**
     * Normalize role name string to one of the 3 supported roles
     */
    public static function normalizeRoleName(string $name): string {
        $trimmed = trim($name);
        $lower = strtolower($trimmed);
        if ($lower === 'admin' || $lower === 'system administrator') return 'Admin';
        if ($lower === 'role 1' || $lower === 'role1' || $lower === 'purchase' || $lower === 'store' || $lower === 'manager') return 'Role 1';
        if ($lower === 'role 2' || $lower === 'role2' || $lower === 'production' || $lower === 'qc' || $lower === 'staff') return 'Role 2';
        return $trimmed;
    }

    /**
     * Get allowed stages array for a role
     */
    public static function getAllowedStagesForRole(string $role): array {
        $norm = self::normalizeRoleName($role);
        return self::STAGE_MATRIX[$norm] ?? [];
    }

    /**
     * Check if a stage is allowed for a role
     */
    public static function isStageAllowed(string $role, int $stageId): bool {
        $norm = self::normalizeRoleName($role);
        if ($norm === 'Admin') return true;
        $allowed = self::STAGE_MATRIX[$norm] ?? [];
        return in_array($stageId, $allowed, true);
    }

    /**
     * Helper to extract Bearer token from HTTP headers
     */
    private static function extractBearerToken(): ?string {
        $headers = [];
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
        }
        $authHeader = $headers['Authorization'] 
            ?? $headers['authorization'] 
            ?? $_SERVER['HTTP_AUTHORIZATION'] 
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] 
            ?? null;

        if ($authHeader && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            return $matches[1];
        }

        // Also check ?token= query param if present
        if (!empty($_GET['token'])) {
            return trim((string)$_GET['token']);
        }

        return null;
    }
}

