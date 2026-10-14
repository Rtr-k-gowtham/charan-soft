<?php
// backend/controllers/CategoryController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class CategoryController {
    public function index(): void {
        $type = $_GET['type'] ?? null;
        try {
            $pdo = Database::getConnection();
            $sql = "SELECT * FROM categories WHERE (status = 'active' OR status IS NULL)";
            $params = [];
            if ($type && $type !== 'all') {
                $sql .= " AND (type = :type OR type IS NULL OR type = '')";
                $params[':type'] = $type;
            }
            $sql .= " ORDER BY sort_order ASC, name ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $categories = $stmt->fetchAll();

            // Fetch dynamic fields for each category safely
            try {
                $fStmt = $pdo->prepare("SELECT * FROM category_fields WHERE category_id = :cat_id ORDER BY sort_order ASC");
                foreach ($categories as &$cat) {
                    $fStmt->execute([':cat_id' => $cat['id']]);
                    $catFields = $fStmt->fetchAll();
                    foreach ($catFields as &$cf) {
                        if ($cf['field_name'] === 'order_no' || $cf['field_name'] === 'order_number') {
                            $cf['is_visible'] = 0;
                        }
                    }
                    $cat['fields'] = $catFields;
                }
            } catch (Exception $cfErr) {
                foreach ($categories as &$cat) {
                    $cat['fields'] = [];
                }
            }

            Response::success($categories);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function show(int $id): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT * FROM categories WHERE id = :id");
            $stmt->execute([':id' => $id]);
            $category = $stmt->fetch();

            if (!$category) {
                Response::error("Category not found", 404);
                return;
            }

            $fStmt = $pdo->prepare("SELECT * FROM category_fields WHERE category_id = :id ORDER BY sort_order ASC");
            $fStmt->execute([':id' => $id]);
            $catFields = $fStmt->fetchAll();
            foreach ($catFields as &$cf) {
                if ($cf['field_name'] === 'order_no' || $cf['field_name'] === 'order_number') {
                    $cf['is_visible'] = 0;
                }
            }
            $category['fields'] = $catFields;

            Response::success($category);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function store(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');
        $code = trim($data['code'] ?? '');
        $type = !empty($data['type']) ? trim($data['type']) : null;
        $description = !empty($data['description']) ? trim($data['description']) : null;

        if (empty($name)) {
            Response::error("Category name is required", 422);
            return;
        }

        // Auto-generate code if empty
        if (empty($code)) {
            $slug = preg_replace('/[^A-Z0-9]/', '_', strtoupper($name));
            $slug = preg_replace('/_+/', '_', $slug);
            $slug = trim($slug, '_');
            $code = 'CAT_' . ($slug ?: 'CATEGORY');
        }

        try {
            $pdo = Database::getConnection();

            // Case-insensitive duplicate check on Category Name
            $dupStmt = $pdo->prepare("SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(:name)) LIMIT 1");
            $dupStmt->execute([':name' => $name]);
            if ($dupStmt->fetch()) {
                Response::error("A category with the name '{$name}' already exists", 409);
                return;
            }

            // Ensure unique code if collision occurs
            $baseCode = $code;
            $counter = 1;
            while (true) {
                $checkCode = $pdo->prepare("SELECT id FROM categories WHERE code = :code LIMIT 1");
                $checkCode->execute([':code' => $code]);
                if (!$checkCode->fetch()) {
                    break;
                }
                $counter++;
                $code = $baseCode . '_' . $counter;
            }

            $pdo->beginTransaction();

            $stmt = $pdo->prepare("INSERT INTO categories (name, code, type, description) VALUES (:name, :code, :type, :desc)");
            $stmt->execute([
                ':name' => $name,
                ':code' => $code,
                ':type' => $type,
                ':desc' => $description
            ]);
            $categoryId = (int)$pdo->lastInsertId();

            if (!empty($data['fields']) && is_array($data['fields'])) {
                $fStmt = $pdo->prepare("
                    INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order)
                    VALUES (:cat_id, :fname, :flabel, :ftype, :req, :vis, :sort)
                ");
                foreach ($data['fields'] as $idx => $f) {
                    $fStmt->execute([
                        ':cat_id' => $categoryId,
                        ':fname' => $f['field_name'],
                        ':flabel' => $f['field_label'],
                        ':ftype' => $f['field_type'] ?? 'text',
                        ':req' => !empty($f['is_required']) ? 1 : 0,
                        ':vis' => isset($f['is_visible']) ? ($f['is_visible'] ? 1 : 0) : 1,
                        ':sort' => $idx + 1
                    ]);
                }
            }

            $pdo->commit();
            AuditLogger::log('Categories', 'CREATE', $categoryId, null, [
                'id' => $categoryId,
                'name' => $name,
                'code' => $code,
                'type' => $type,
                'description' => $description
            ]);
            Response::success(['id' => $categoryId, 'name' => $name, 'code' => $code, 'type' => $type], "Category created successfully", 201);
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function update(int $id): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');
        $description = isset($data['description']) ? trim($data['description']) : null;

        if (empty($name)) {
            Response::error("Category name is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $dupStmt = $pdo->prepare("SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(:name)) AND id != :id LIMIT 1");
            $dupStmt->execute([':name' => $name, ':id' => $id]);
            if ($dupStmt->fetch()) {
                Response::error("A category with the name '{$name}' already exists", 409);
                return;
            }

            $stmt = $pdo->prepare("UPDATE categories SET name = :name, description = :desc WHERE id = :id");
            $stmt->execute([':name' => $name, ':desc' => $description, ':id' => $id]);
            AuditLogger::log('Categories', 'UPDATE', $id, null, ['name' => $name, 'description' => $description]);
            Response::success(['id' => $id, 'name' => $name], "Category updated successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function addField(int $categoryId): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $fieldName = trim($data['field_name'] ?? strtolower(str_replace(' ', '_', $data['field_label'] ?? 'item')));
        $fieldLabel = trim($data['field_label'] ?? $data['name'] ?? 'Item');
        $fieldType = trim($data['field_type'] ?? 'text');

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $categoryId,
                $fieldName,
                $fieldLabel,
                $fieldType,
                !empty($data['is_required']) ? 1 : 0,
                isset($data['is_visible']) ? ($data['is_visible'] ? 1 : 0) : 1,
                (int)($data['sort_order'] ?? 1)
            ]);
            $fieldId = (int)$pdo->lastInsertId();
            Response::success(['id' => $fieldId, 'field_name' => $fieldName, 'field_label' => $fieldLabel], "Item/Field added successfully", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function deleteField(int $categoryId, int $fieldId): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("DELETE FROM category_fields WHERE id = ? AND category_id = ?");
            $stmt->execute([$fieldId, $categoryId]);
            Response::success(null, "Item/Field deleted successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function destroy(int $id): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("DELETE FROM categories WHERE id = ?");
            $stmt->execute([$id]);
            Response::success(null, "Category deleted successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
