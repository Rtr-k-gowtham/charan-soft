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

            // Fetch dynamic fields and terms for each category safely
            $this->ensureTermsTable($pdo);
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
                    $cat['terms'] = $this->fetchCategoryTerms($pdo, (int)$cat['id']);
                }
            } catch (Exception $cfErr) {
                foreach ($categories as &$cat) {
                    $cat['fields'] = [];
                    $cat['terms'] = [];
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
            $this->ensureTermsTable($pdo);
            $category['terms'] = $this->fetchCategoryTerms($pdo, $id);

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

            $stmt = $pdo->prepare("INSERT INTO categories (name, code, type, description, icon) VALUES (:name, :code, :type, :desc, :icon)");
            $stmt->execute([
                ':name' => $name,
                ':code' => $code,
                ':type' => $type,
                ':desc' => $description,
                ':icon' => !empty($data['icon']) ? trim($data['icon']) : null
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

            $this->ensureTermsTable($pdo);
            if (!empty($data['terms']) && is_array($data['terms'])) {
                $tStmt = $pdo->prepare("
                    INSERT INTO category_terms (category_id, term_key, title, content, display_order, is_active)
                    VALUES (:cat_id, :term_key, :title, :content, :display_order, :is_active)
                ");
                foreach ($data['terms'] as $tIdx => $t) {
                    $tTitle = trim((string)($t['title'] ?? ''));
                    if (empty($tTitle)) continue;
                    $tKey = !empty($t['term_key']) ? trim((string)$t['term_key']) : strtolower(preg_replace('/[^a-zA-Z0-9]+/', '_', $tTitle)) . '_' . ($tIdx + 1);
                    $tStmt->execute([
                        ':cat_id' => $categoryId,
                        ':term_key' => $tKey,
                        ':title' => $tTitle,
                        ':content' => trim((string)($t['content'] ?? '')),
                        ':display_order' => isset($t['display_order']) ? (int)$t['display_order'] : ($tIdx + 1),
                        ':is_active' => isset($t['is_active']) ? ($t['is_active'] ? 1 : 0) : 1
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

            $icon = isset($data['icon']) ? trim($data['icon']) : null;
            $stmt = $pdo->prepare("UPDATE categories SET name = :name, description = :desc, icon = :icon WHERE id = :id");
            $stmt->execute([':name' => $name, ':desc' => $description, ':icon' => $icon, ':id' => $id]);
            AuditLogger::log('Categories', 'UPDATE', $id, null, ['name' => $name, 'description' => $description, 'icon' => $icon]);
            Response::success(['id' => $id, 'name' => $name, 'icon' => $icon], "Category updated successfully");
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

    public function getTerms(int $categoryId): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureTermsTable($pdo);
            $terms = $this->fetchCategoryTerms($pdo, $categoryId);
            Response::success($terms);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function saveTerms(int $categoryId): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $terms = $data['terms'] ?? $data;
        if (!is_array($terms)) {
            Response::error("Terms must be an array", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $this->ensureTermsTable($pdo);
            $pdo->beginTransaction();

            $catStmt = $pdo->prepare("SELECT id, name FROM categories WHERE id = ?");
            $catStmt->execute([$categoryId]);
            $category = $catStmt->fetch();
            if (!$category) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Response::error("Category not found", 404);
                return;
            }

            // Remove existing terms
            $delStmt = $pdo->prepare("DELETE FROM category_terms WHERE category_id = ?");
            $delStmt->execute([$categoryId]);

            $insStmt = $pdo->prepare("
                INSERT INTO category_terms (category_id, term_key, title, content, display_order, is_active)
                VALUES (:cat_id, :term_key, :title, :content, :display_order, :is_active)
            ");

            foreach ($terms as $idx => $t) {
                $title = trim((string)($t['title'] ?? ''));
                if (empty($title)) continue;
                $content = trim((string)($t['content'] ?? ''));
                $termKey = trim((string)($t['term_key'] ?? ''));
                if (empty($termKey)) {
                    $termKey = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '_', $title)) . '_' . ($idx + 1);
                }
                $displayOrder = isset($t['display_order']) ? (int)$t['display_order'] : ($idx + 1);
                $isActive = isset($t['is_active']) ? ($t['is_active'] ? 1 : 0) : 1;

                $insStmt->execute([
                    ':cat_id' => $categoryId,
                    ':term_key' => $termKey,
                    ':title' => $title,
                    ':content' => $content,
                    ':display_order' => $displayOrder,
                    ':is_active' => $isActive
                ]);
            }

            $pdo->commit();
            $saved = $this->fetchCategoryTerms($pdo, $categoryId);
            AuditLogger::log('CategoryTerms', 'UPDATE', $categoryId, null, [
                'category_id' => $categoryId,
                'category_name' => $category['name'],
                'terms_count' => count($saved)
            ]);

            Response::success($saved, "Category Terms & Conditions saved successfully");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    private function ensureTermsTable(PDO $pdo): void {
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS category_terms (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    category_id INT NOT NULL,
                    term_key VARCHAR(50) NOT NULL,
                    title VARCHAR(150) NOT NULL,
                    content TEXT NOT NULL,
                    display_order INT NOT NULL DEFAULT 0,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_ct_category_id (category_id),
                    CONSTRAINT fk_category_terms_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
        } catch (Exception $e) {}
    }

    private function fetchCategoryTerms(PDO $pdo, int $categoryId): array {
        try {
            $stmt = $pdo->prepare("SELECT * FROM category_terms WHERE category_id = :cat_id ORDER BY display_order ASC, id ASC");
            $stmt->execute([':cat_id' => $categoryId]);
            $terms = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($terms as &$t) {
                $t['id'] = (int)$t['id'];
                $t['category_id'] = (int)$t['category_id'];
                $t['display_order'] = (int)$t['display_order'];
                $t['is_active'] = (int)$t['is_active'];
            }
            return $terms;
        } catch (Exception $e) {
            return [];
        }
    }
}

