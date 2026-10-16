<?php
// backend/controllers/SettingsController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class SettingsController {
    // -------------------------------------------------------------
    // USERS
    // -------------------------------------------------------------
    public function getUsers(): void {
        try {
            $pdo = Database::getConnection();
            try {
                $pdo->exec("UPDATE users SET name = 'Admin' WHERE id = 1 OR email = 'admin@cheransoftgoods.com'");
                $pdo->exec("DELETE FROM users WHERE id > 1 AND (email LIKE '%@cheransoftgoods.com' OR name IN ('M. Ramesh Kumar', 'P. Anand', 'S. Divya', 'R. Muralidharan', 'P. Arumugam', 'V. Kannan', 'S. Vijayalakshmi'))");
            } catch (Exception $cleanupEx) {}

            $stmt = $pdo->query("
                SELECT u.id, u.name, u.email, u.phone, u.status, u.role_id, r.name as role_name, r.display_name as role_display_name, u.created_at
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.deleted_at IS NULL
                ORDER BY u.id ASC
            ");
            $users = $stmt->fetchAll();
            foreach ($users as &$u) {
                if ($u['id'] == 1 || $u['email'] === 'admin@cheransoftgoods.com') {
                    $u['name'] = 'Admin';
                    $u['username'] = 'admin';
                }
            }
            Response::success($users);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createUser(): void {
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

        try {
            $pdo = Database::getConnection();
            $hash = password_hash($password, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("
                INSERT INTO users (role_id, name, email, password_hash, phone, status)
                VALUES (?, ?, ?, ?, ?, 'active')
            ");
            $stmt->execute([$roleId, $name, $email, $hash, $phone]);
            $id = (int)$pdo->lastInsertId();
            AuditLogger::log('Users', 'CREATE', $id, null, ['name' => $name, 'email' => $email]);
            Response::success(['id' => $id, 'name' => $name, 'email' => $email], "User created successfully", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function updateUser(int $id): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("UPDATE users SET name = ?, phone = ?, role_id = ?, status = ? WHERE id = ?");
            $stmt->execute([
                $data['name'] ?? 'User',
                $data['phone'] ?? null,
                (int)($data['role_id'] ?? 2),
                $data['status'] ?? 'active',
                $id
            ]);
            Response::success(['id' => $id], "User updated successfully");
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
            $stmt = $pdo->query("SELECT * FROM roles ORDER BY id ASC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function getPermissions(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM permissions ORDER BY module ASC, name ASC");
            Response::success($stmt->fetchAll());
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
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createStage(): void {
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
            $settings = $stmt->fetch() ?: [
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
