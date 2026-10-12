<?php
// backend/controllers/MastersController.php
declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class MastersController {
    // -------------------------------------------------------------
    // PRODUCTS
    // -------------------------------------------------------------
    public function getProducts(): void {
        try {
            $pdo = Database::getConnection();
            try {
                $stmt = $pdo->query("
                    SELECT p.*, p.image_url as image
                    FROM products p
                    WHERE p.deleted_at IS NULL
                    ORDER BY p.name ASC
                ");
                Response::success($stmt->fetchAll());
            } catch (Exception $e) {
                $stmt = $pdo->query("
                    SELECT p.*
                    FROM products p
                    WHERE p.deleted_at IS NULL
                    ORDER BY p.name ASC
                ");
                Response::success($stmt->fetchAll());
            }
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createProduct(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $code = trim($data['code'] ?? 'PRD-' . rand(1000, 9999));
        $name = trim($data['name'] ?? '');
        $design = $data['design'] ?? null;
        $uom = $data['uom'] ?? 'PCS';
        $price = (float)($data['selling_price'] ?? 0);
        $tax = (float)($data['tax_percent'] ?? 5);
        $imageUrl = $data['image_url'] ?? ($data['image'] ?? null);

        if (empty($name)) {
            Response::error("Product name is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            try {
                $stmt = $pdo->prepare("
                    INSERT INTO products (code, name, design, uom, selling_price, tax_percent, image_url)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([$code, $name, $design, $uom, $price, $tax, $imageUrl]);
            } catch (Exception $colEx) {
                $stmt = $pdo->prepare("
                    INSERT INTO products (code, name, design, uom, selling_price, tax_percent)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([$code, $name, $design, $uom, $price, $tax]);
            }
            $id = (int)$pdo->lastInsertId();
            AuditLogger::log('Products', 'CREATE', $id, null, $data);
            Response::success([
                'id' => $id,
                'code' => $code,
                'name' => $name,
                'image_url' => $imageUrl,
                'image' => $imageUrl
            ], "Product created successfully", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function updateProduct(int $id): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $imageUrl = $data['image_url'] ?? ($data['image'] ?? null);
        try {
            $pdo = Database::getConnection();
            try {
                $stmt = $pdo->prepare("
                    UPDATE products 
                    SET name = ?, code = ?, design = ?, uom = ?, selling_price = ?, tax_percent = ?, image_url = COALESCE(?, image_url)
                    WHERE id = ?
                ");
                $stmt->execute([
                    $data['name'] ?? 'Product',
                    $data['code'] ?? 'PRD-001',
                    $data['design'] ?? null,
                    $data['uom'] ?? 'PCS',
                    (float)($data['selling_price'] ?? 0),
                    (float)($data['tax_percent'] ?? 5),
                    $imageUrl,
                    $id
                ]);
            } catch (Exception $colEx) {
                $stmt = $pdo->prepare("
                    UPDATE products 
                    SET name = ?, code = ?, design = ?, uom = ?, selling_price = ?, tax_percent = ?
                    WHERE id = ?
                ");
                $stmt->execute([
                    $data['name'] ?? 'Product',
                    $data['code'] ?? 'PRD-001',
                    $data['design'] ?? null,
                    $data['uom'] ?? 'PCS',
                    (float)($data['selling_price'] ?? 0),
                    (float)($data['tax_percent'] ?? 5),
                    $id
                ]);
            }
            Response::success([
                'id' => $id,
                'image_url' => $imageUrl,
                'image' => $imageUrl
            ], "Product updated successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function deleteProduct(int $id): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("UPDATE products SET deleted_at = NOW() WHERE id = ?");
            $stmt->execute([$id]);
            Response::success(null, "Product deleted successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    // -------------------------------------------------------------
    // SUPPLIERS
    // -------------------------------------------------------------
    public function getSuppliers(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM suppliers WHERE deleted_at IS NULL ORDER BY name ASC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createSupplier(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');
        $contactPerson = trim($data['contact_person'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $gstin = trim($data['gstin'] ?? '');
        $address = trim($data['address'] ?? ($data['city'] ?? ''));
        $paymentTerms = (int)($data['payment_terms_days'] ?? 30);

        if (empty($name)) {
            Response::error("Supplier name is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $code = trim($data['code'] ?? 'SUP-' . rand(100, 999));
            $stmt = $pdo->prepare("
                INSERT INTO suppliers (name, code, contact_person, phone, email, gstin, address, payment_terms_days)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$name, $code, $contactPerson, $phone, $email, $gstin, $address, $paymentTerms]);
            $id = (int)$pdo->lastInsertId();
            AuditLogger::log('Suppliers', 'CREATE', $id, null, $data);
            Response::success(['id' => $id, 'code' => $code, 'name' => $name], "Supplier created successfully", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    // -------------------------------------------------------------
    // CUSTOMERS
    // -------------------------------------------------------------
    public function getCustomers(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM customers WHERE deleted_at IS NULL ORDER BY name ASC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createCustomer(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');
        $code = trim($data['code'] ?? 'CUST-' . rand(100, 999));
        $contactPerson = trim($data['contact_person'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $gstin = trim($data['gstin'] ?? '');
        $billingAddress = trim($data['billing_address'] ?? ($data['address'] ?? ($data['city'] ?? '')));

        if (empty($name)) {
            Response::error("Customer name is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                INSERT INTO customers (name, code, contact_person, phone, email, gstin, billing_address)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$name, $code, $contactPerson, $phone, $email, $gstin, $billingAddress]);
            $id = (int)$pdo->lastInsertId();
            AuditLogger::log('Customers', 'CREATE', $id, null, $data);
            Response::success(['id' => $id, 'code' => $code, 'name' => $name], "Customer created successfully", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    // -------------------------------------------------------------
    // COLORS, SIZES, UNITS, DESIGNS
    // -------------------------------------------------------------
    public function getColors(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM colors ORDER BY name ASC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createColor(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');
        $hex = trim($data['hex_code'] ?? '#000000');
        if ($hex !== '' && !str_starts_with($hex, '#')) {
            $hex = '#' . $hex;
        }
        $inputCode = trim($data['code'] ?? '');

        if (empty($name)) {
            Response::error("Color name is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $code = $inputCode;
            if ($code !== '') {
                // Check if manually provided code already exists
                $dupCheck = $pdo->prepare("SELECT id FROM colors WHERE code = ?");
                $dupCheck->execute([$code]);
                if ($dupCheck->fetch()) {
                    $pdo->rollBack();
                    Response::error("Color code '{$code}' already exists. Please choose a different code.", 422);
                    return;
                }
            } else {
                // Auto-generate unique code in CLR-0001, CLR-0002... format
                $stmtMax = $pdo->query("
                    SELECT code FROM colors 
                    WHERE code LIKE 'CLR-%' 
                    ORDER BY CAST(SUBSTRING(code, 5) AS UNSIGNED) DESC 
                    LIMIT 1 
                    FOR UPDATE
                ");
                $maxCode = $stmtMax ? $stmtMax->fetchColumn() : null;
                $nextNum = 1;
                if ($maxCode && preg_match('/^CLR-(\d+)$/', (string)$maxCode, $m)) {
                    $nextNum = ((int)$m[1]) + 1;
                } else {
                    $cnt = (int)$pdo->query("SELECT COUNT(*) FROM colors")->fetchColumn();
                    $nextNum = max(1, $cnt + 1);
                }

                // Check and increment until an unused code is found
                do {
                    $code = sprintf('CLR-%04d', $nextNum);
                    $checkStmt = $pdo->prepare("SELECT id FROM colors WHERE code = ?");
                    $checkStmt->execute([$code]);
                    $exists = (bool)$checkStmt->fetchColumn();
                    if ($exists) {
                        $nextNum++;
                    }
                } while ($exists);
            }

            $stmt = $pdo->prepare("INSERT INTO colors (code, name, hex_code) VALUES (?, ?, ?)");
            $stmt->execute([$code, $name, $hex]);
            $id = (int)$pdo->lastInsertId();

            $pdo->commit();
            AuditLogger::log('Colors', 'CREATE', $id, null, ['code' => $code, 'name' => $name, 'hex_code' => $hex]);
            Response::success([
                'id' => $id,
                'code' => $code,
                'name' => $name,
                'hex_code' => $hex
            ], "Color created successfully", 201);
        } catch (Exception $e) {
            if (isset($pdo) && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if (str_contains($e->getMessage(), '1062 Duplicate entry')) {
                Response::error("Duplicate color entry detected. Code must be unique.", 422);
                return;
            }
            Response::error($e->getMessage(), 500);
        }
    }

    public function getSizes(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM sizes ORDER BY sort_order ASC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createSize(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $code = trim($data['code'] ?? '');
        $name = trim($data['name'] ?? $code);
        $order = (int)($data['sort_order'] ?? 0);
        if (empty($code)) {
            Response::error("Size code is required", 422);
            return;
        }
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("INSERT INTO sizes (code, name, sort_order) VALUES (?, ?, ?)");
            $stmt->execute([$code, $name, $order]);
            Response::success(['id' => (int)$pdo->lastInsertId()], "Size created", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function getUnits(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM units ORDER BY code ASC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createUnit(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $code = trim($data['code'] ?? '');
        $name = trim($data['name'] ?? $code);
        if (empty($code)) {
            Response::error("Unit code is required", 422);
            return;
        }
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("INSERT INTO units (code, name) VALUES (?, ?)");
            $stmt->execute([$code, $name]);
            Response::success(['id' => (int)$pdo->lastInsertId()], "Unit created", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function getDesigns(): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM designs ORDER BY name ASC");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createDesign(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $code = trim($data['code'] ?? 'DSN-' . rand(100, 999));
        $name = trim($data['name'] ?? '');
        $pattern = trim($data['pattern'] ?? 'Solid');
        if (empty($name)) {
            Response::error("Design name is required", 422);
            return;
        }
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("INSERT INTO designs (code, name, pattern) VALUES (?, ?, ?)");
            $stmt->execute([$code, $name, $pattern]);
            Response::success(['id' => (int)$pdo->lastInsertId()], "Design created", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
