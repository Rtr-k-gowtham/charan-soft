<?php
// backend/controllers/TemplatesController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class TemplatesController {
    public function index(): void {
        $type = $_GET['type'] ?? null;
        try {
            $pdo = Database::getConnection();
            $sql = "
                SELECT t.*, c.name as category_name
                FROM templates t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.status = 'active'
            ";
            $params = [];
            if ($type) {
                $sql .= " AND t.template_type = :type";
                $params[':type'] = $type;
            }
            $sql .= " ORDER BY t.name ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $templates = $stmt->fetchAll();

            foreach ($templates as &$tmpl) {
                $fStmt = $pdo->prepare("
                    SELECT tf.*, cf.field_name, cf.field_label, cf.field_type
                    FROM template_fields tf
                    JOIN category_fields cf ON tf.category_field_id = cf.id
                    WHERE tf.template_id = ?
                    ORDER BY tf.sort_order ASC
                ");
                $fStmt->execute([$tmpl['id']]);
                $tmpl['fields'] = $fStmt->fetchAll();
            }

            Response::success($templates);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function store(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');
        $type = trim($data['template_type'] ?? 'po');
        $categoryId = (int)($data['category_id'] ?? 1);
        $fields = $data['fields'] ?? [];

        if (empty($name)) {
            Response::error("Template name is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("
                INSERT INTO templates (category_id, name, template_type, is_default, status)
                VALUES (?, ?, ?, ?, 'active')
            ");
            $stmt->execute([$categoryId, $name, $type, !empty($data['is_default']) ? 1 : 0]);
            $templateId = (int)$pdo->lastInsertId();

            if (!empty($fields) && is_array($fields)) {
                $tfStmt = $pdo->prepare("INSERT INTO template_fields (template_id, category_field_id, sort_order, is_required) VALUES (?, ?, ?, ?)");
                foreach ($fields as $idx => $fId) {
                    $tfStmt->execute([$templateId, (int)$fId, $idx, 0]);
                }
            }

            $pdo->commit();
            AuditLogger::log('Templates', 'CREATE', $templateId, null, $data);
            Response::success(['id' => $templateId, 'name' => $name], "Template created successfully", 201);
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }
}
