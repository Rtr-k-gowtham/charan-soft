<?php
// backend/controllers/SettingsController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class SettingsController {
    // -------------------------------------------------------------
    // USERS
    // -------------------------------------------------------------
    public function getUsers(): void {
        try {
            // Require Admin role
            Auth::requireRole('Admin');

            $pdo = Database::getConnection();

            $stmt = $pdo->query("
                SELECT u.id, u.name, u.email, u.phone, u.status, u.role_id, r.name as role_name, r.display_name as role_display_name, u.created_at
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.deleted_at IS NULL
                ORDER BY u.id ASC
            ");
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($users as &$u) {
                $u['role_name'] = Auth::normalizeRoleName((string)$u['role_name']);
                $u['username'] = $u['name'];
            }
            Response::success($users);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createUser(): void {
        // Require Admin role
        Auth::requireRole('Admin');

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');
        $email = trim($data['email'] ?? '');
        $password = $data['password'] ?? 'Cheran@123';
        $roleId = (int)($data['role_id'] ?? 2);
        $phone = trim($data['phone'] ?? '');

        if (empty($name) || empty($email)) {
            Response::error("Name and email are required", 422);
            return;
        }

        // Validate role_id: Must be 1 (Admin), 2 (Role 1), or 3 (Role 2)
        if (!in_array($roleId, [1, 2, 3], true)) {
            Response::error("Invalid role ID. Allowed roles are: 1 (Admin), 2 (Role 1), 3 (Role 2)", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $hash = password_hash($password, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("
                INSERT INTO users (role_id, name, email, password_hash, phone, status)
                VALUES (?, ?, ?, ?, ?, 'active')
            ");
            $stmt->execute([$roleId, $name, $email, $hash, $phone]);
            $id = (int)$pdo->lastInsertId();
            AuditLogger::log('Users', 'CREATE', $id, null, ['name' => $name, 'email' => $email, 'role_id' => $roleId]);
            Response::success(['id' => $id, 'name' => $name, 'email' => $email, 'role_id' => $roleId], "User created successfully", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function updateUser(int $id): void {
        // Require Admin role
        Auth::requireRole('Admin');

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $roleId = (int)($data['role_id'] ?? 2);

        // Validate role_id: Must be 1 (Admin), 2 (Role 1), or 3 (Role 2)
        if (!in_array($roleId, [1, 2, 3], true)) {
            Response::error("Invalid role ID. Allowed roles are: 1 (Admin), 2 (Role 1), 3 (Role 2)", 422);
            return;
        }

        $name = trim($data['name'] ?? '');
        $email = trim($data['email'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $status = $data['status'] ?? 'active';

        if (empty($name) || empty($email)) {
            Response::error("Name and email are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();

            // Verify user exists and is not deleted
            $stmt = $pdo->prepare("SELECT id, name, email FROM users WHERE id = ? AND deleted_at IS NULL");
            $stmt->execute([$id]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$existing) {
                Response::error("User not found or deleted", 404);
                return;
            }

            // Check email uniqueness if email changed
            $check = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ? AND deleted_at IS NULL LIMIT 1");
            $check->execute([$email, $id]);
            if ($check->fetch()) {
                Response::error("Email already in use by another user", 422);
                return;
            }

            if (!empty($data['password'])) {
                $pwdHash = password_hash((string)$data['password'], PASSWORD_BCRYPT);
                $stmt = $pdo->prepare("UPDATE users SET name = ?, email = ?, phone = ?, role_id = ?, status = ?, password_hash = ? WHERE id = ?");
                $stmt->execute([$name, $email, $phone ?: null, $roleId, $status, $pwdHash, $id]);
            } else {
                $stmt = $pdo->prepare("UPDATE users SET name = ?, email = ?, phone = ?, role_id = ?, status = ? WHERE id = ?");
                $stmt->execute([$name, $email, $phone ?: null, $roleId, $status, $id]);
            }

            AuditLogger::log('Users', 'UPDATE', $id, $existing, ['name' => $name, 'email' => $email, 'role_id' => $roleId, 'status' => $status]);
            Response::success(['id' => $id, 'name' => $name, 'email' => $email, 'role_id' => $roleId, 'status' => $status], "User updated successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function deleteUser(int $id): void {
        // Require Admin role
        $currentUser = Auth::requireRole('Admin');

        // Prevent deleting primary admin (id: 1) or self
        if ($id === 1 || (int)($currentUser['id'] ?? 0) === $id) {
            Response::error("Primary administrator or currently logged-in account cannot be deleted.", 400);
            return;
        }

        try {
            $pdo = Database::getConnection();

            // Check if user exists and is active
            $stmt = $pdo->prepare("SELECT id, name, email, role_id FROM users WHERE id = ? AND deleted_at IS NULL");
            $stmt->execute([$id]);
            $target = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$target) {
                Response::error("User not found or already deleted", 404);
                return;
            }

            // Soft-delete user
            $del = $pdo->prepare("UPDATE users SET deleted_at = NOW(), status = 'inactive' WHERE id = ?");
            $del->execute([$id]);

            AuditLogger::log('Users', 'DELETE', $id, $target, null);
            Response::success(['id' => $id], "User '{$target['name']}' deleted successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    // -------------------------------------------------------------
    // ROLES & PERMISSIONS
    // -------------------------------------------------------------
    public function getRoles(): void {
        try {
            $pdo = Database::getConnection();
            // Return only the 3 supported roles
            $stmt = $pdo->query("SELECT id, name, display_name, description, status FROM roles WHERE id IN (1, 2, 3) ORDER BY id ASC");
            $roles = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Add stage access matrix metadata
            foreach ($roles as &$r) {
                $norm = Auth::normalizeRoleName((string)$r['name']);
                $r['name'] = $norm;
                $r['display_name'] = $norm;
                $r['allowed_stages'] = Auth::STAGE_MATRIX[$norm] ?? [];
            }

            Response::success($roles);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function getPermissions(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM permissions ORDER BY module ASC, name ASC");
            Response::success($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    // -------------------------------------------------------------
    // PRODUCTION STAGES
    // -------------------------------------------------------------
    public function getStages(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM production_stages ORDER BY sequence_order ASC");
            Response::success($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createStage(): void {
        Auth::requireRole('Admin');

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');
        $code = strtoupper(trim($data['code'] ?? 'STG'));
        $seq = (int)($data['sequence_order'] ?? 1);
        $color = $data['color_badge'] ?? '#3b82f6';
        $time = (float)($data['standard_cycle_time_mins'] ?? 30);

        if (empty($name)) {
            Response::error("Stage name is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                INSERT INTO production_stages (name, code, sequence_order, color_badge, standard_cycle_time_mins, status)
                VALUES (?, ?, ?, ?, ?, 'active')
            ");
            $stmt->execute([$name, $code, $seq, $color, $time]);
            Response::success(['id' => (int)$pdo->lastInsertId()], "Stage created", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    // -------------------------------------------------------------
    // COMPANY SETTINGS
    // -------------------------------------------------------------
    public function getCompanySettings(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM company_settings LIMIT 1");
            $settings = $stmt->fetch(PDO::FETCH_ASSOC) ?: [
                'company_name' => 'Cheran Soft Goods Private Limited',
                'address' => '124, Textile Park, Palladam Road, Tiruppur - 641604, Tamil Nadu',
                'gstin' => '33AABCC1234F1Z5',
                'phone' => '+91 421 2478900',
                'email' => 'operations@cheransoftgoods.com',
                'currency' => 'INR',
                'financial_year_start' => '04-01'
            ];
            Response::success($settings);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function updateCompanySettings(): void {
        Auth::requireRole('Admin');

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                UPDATE company_settings 
                SET company_name = ?, address = ?, phone = ?, email = ?, gstin = ?
                WHERE id = 1
            ");
            $stmt->execute([
                $data['company_name'] ?? 'Cheran Soft Goods',
                $data['address'] ?? '',
                $data['phone'] ?? '',
                $data['email'] ?? '',
                $data['gstin'] ?? ''
            ]);
            Response::success(null, "Settings saved successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
