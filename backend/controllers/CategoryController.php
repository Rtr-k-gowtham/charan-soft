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
            if ($type) {
                $sql .= " AND type = :type";
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
                    $cat['fields'] = $fStmt->fetchAll();
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
            $category['fields'] = $fStmt->fetchAll();

            Response::success($category);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function store(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');
        $code = trim($data['code'] ?? '');
        $type = trim($data['type'] ?? 'order');

        if (empty($name) || empty($code)) {
            Response::error("Category name and code are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("INSERT INTO categories (name, code, type, description) VALUES (:name, :code, :type, :desc)");
            $stmt->execute([
                ':name' => $name,
                ':code' => $code,
                ':type' => $type,
                ':desc' => $data['description'] ?? null
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
            AuditLogger::log('Categories', 'CREATE', $categoryId, null, $data);
            Response::success(['id' => $categoryId], "Category created successfully", 201);
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
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
