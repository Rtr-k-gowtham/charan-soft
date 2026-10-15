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
            $stmt = $pdo->query("
                SELECT s.*, 
                       c.name AS category_name, 
                       c.code AS category_code, 
                       c.icon AS category_icon
                FROM suppliers s
                LEFT JOIN categories c ON s.category_id = c.id
                WHERE s.deleted_at IS NULL
                ORDER BY s.name ASC
            ");
            Response::success($stmt->fetchAll());
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function getSupplier(int $id): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                SELECT s.*, 
                       c.name AS category_name, 
                       c.code AS category_code, 
                       c.icon AS category_icon
                FROM suppliers s
                LEFT JOIN categories c ON s.category_id = c.id
                WHERE s.id = ? AND s.deleted_at IS NULL
                LIMIT 1
            ");
            $stmt->execute([$id]);
            $supplier = $stmt->fetch();
            if (!$supplier) {
                Response::error("Supplier not found", 404);
                return;
            }
            Response::success($supplier);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createSupplier(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');
        $categoryId = !empty($data['category_id']) ? (int)$data['category_id'] : null;
        $contactPerson = trim($data['contact_person'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $gstin = trim($data['gstin'] ?? '');
        $address = trim($data['address'] ?? ($data['city'] ?? ''));
        $paymentTerms = (int)($data['payment_terms_days'] ?? 30);
        $status = trim($data['status'] ?? 'active');

        if (empty($name)) {
            Response::error("Supplier name is required", 422);
            return;
        }

        if (empty($categoryId)) {
            Response::error("Supplier category is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();

            // Validate category exists in categories master
            $catCheck = $pdo->prepare("SELECT id, name FROM categories WHERE id = ?");
            $catCheck->execute([$categoryId]);
            $catRow = $catCheck->fetch();
            if (!$catRow) {
                Response::error("Selected category is invalid or does not exist", 422);
                return;
            }

            $code = trim($data['code'] ?? 'SUP-' . rand(100, 999));
            $stmt = $pdo->prepare("
                INSERT INTO suppliers (name, category_id, code, contact_person, phone, email, gstin, address, payment_terms_days, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$name, $categoryId, $code, $contactPerson, !empty($phone) ? $phone : 'N/A', $email, $gstin, $address, $paymentTerms, $status]);
            $id = (int)$pdo->lastInsertId();
            AuditLogger::log('Suppliers', 'CREATE', $id, null, $data);
            Response::success([
                'id' => $id, 
                'code' => $code, 
                'name' => $name, 
                'category_id' => $categoryId, 
                'category_name' => $catRow['name']
            ], "Supplier created successfully", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function updateSupplier(int $id): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');
        $categoryId = !empty($data['category_id']) ? (int)$data['category_id'] : null;
        $contactPerson = trim($data['contact_person'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $gstin = trim($data['gstin'] ?? '');
        $address = trim($data['address'] ?? ($data['city'] ?? ''));
        $paymentTerms = (int)($data['payment_terms_days'] ?? 30);
        $status = trim($data['status'] ?? 'active');

        if (empty($name)) {
            Response::error("Supplier name is required", 422);
            return;
        }

        if (empty($categoryId)) {
            Response::error("Supplier category is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();

            // Check supplier exists
            $supCheck = $pdo->prepare("SELECT id FROM suppliers WHERE id = ? AND deleted_at IS NULL");
            $supCheck->execute([$id]);
            if (!$supCheck->fetch()) {
                Response::error("Supplier not found", 404);
                return;
            }

            // Validate category exists in categories master
            $catCheck = $pdo->prepare("SELECT id, name FROM categories WHERE id = ?");
            $catCheck->execute([$categoryId]);
            $catRow = $catCheck->fetch();
            if (!$catRow) {
                Response::error("Selected category is invalid or does not exist", 422);
                return;
            }

            $stmt = $pdo->prepare("
                UPDATE suppliers 
                SET name = ?, category_id = ?, contact_person = ?, phone = ?, email = ?, gstin = ?, address = ?, payment_terms_days = ?, status = ?
                WHERE id = ?
            ");
            $stmt->execute([$name, $categoryId, $contactPerson, !empty($phone) ? $phone : 'N/A', $email, $gstin, $address, $paymentTerms, $status, $id]);
            AuditLogger::log('Suppliers', 'UPDATE', $id, null, $data);
            Response::success([
                'id' => $id, 
                'name' => $name, 
                'category_id' => $categoryId, 
                'category_name' => $catRow['name']
            ], "Supplier updated successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function deleteSupplier(int $id): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("UPDATE suppliers SET deleted_at = NOW() WHERE id = ?");
            $stmt->execute([$id]);
            AuditLogger::log('Suppliers', 'DELETE', $id, null, null);
            Response::success(null, "Supplier deleted successfully");
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

        $avatarStyle = trim($data['avatar_style'] ?? 'lorelei');
        $avatarSeed = trim($data['avatar_seed'] ?? ('buyer-' . $code));
        $avatarConfig = isset($data['avatar_config']) ? (is_string($data['avatar_config']) ? $data['avatar_config'] : json_encode($data['avatar_config'])) : null;

        try {
            $pdo = Database::getConnection();
            try {
                $stmt = $pdo->prepare("
                    INSERT INTO customers (name, code, contact_person, phone, email, gstin, billing_address, avatar_style, avatar_seed, avatar_config)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([$name, $code, $contactPerson, $phone, $email, $gstin, $billingAddress, $avatarStyle, $avatarSeed, $avatarConfig]);
            } catch (Exception $colEx) {
                // Fallback if avatar columns don't exist yet in active table
                $stmt = $pdo->prepare("
                    INSERT INTO customers (name, code, contact_person, phone, email, gstin, billing_address)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([$name, $code, $contactPerson, $phone, $email, $gstin, $billingAddress]);
            }
            $id = (int)$pdo->lastInsertId();
            AuditLogger::log('Customers', 'CREATE', $id, null, $data);
            Response::success([
                'id' => $id, 
                'code' => $code, 
                'name' => $name,
                'avatar_style' => $avatarStyle,
                'avatar_seed' => $avatarSeed,
                'avatar_config' => $avatarConfig
            ], "Customer created successfully", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function updateCustomer(int $id): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');
        $code = trim($data['code'] ?? '');
        $contactPerson = trim($data['contact_person'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $gstin = trim($data['gstin'] ?? '');
        $billingAddress = trim($data['billing_address'] ?? ($data['address'] ?? ''));
        $avatarStyle = isset($data['avatar_style']) ? trim($data['avatar_style']) : null;
        $avatarSeed = isset($data['avatar_seed']) ? trim($data['avatar_seed']) : null;
        $avatarConfig = isset($data['avatar_config']) ? (is_string($data['avatar_config']) ? $data['avatar_config'] : json_encode($data['avatar_config'])) : null;

        try {
            $pdo = Database::getConnection();

            // Fetch existing customer to resolve fields without SQL NULLIF collation conflicts
            $stmtFind = $pdo->prepare("SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL");
            $stmtFind->execute([$id]);
            $existing = $stmtFind->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                Response::error("Customer not found", 404);
                return;
            }

            $finalName = ($name !== '') ? $name : $existing['name'];
            $finalCode = ($code !== '') ? $code : $existing['code'];
            $finalContact = ($contactPerson !== '') ? $contactPerson : ($existing['contact_person'] ?? null);
            $finalPhone = ($phone !== '') ? $phone : $existing['phone'];
            $finalEmail = ($email !== '') ? $email : ($existing['email'] ?? null);
            $finalGstin = ($gstin !== '') ? $gstin : ($existing['gstin'] ?? null);
            $finalAddress = ($billingAddress !== '') ? $billingAddress : ($existing['billing_address'] ?? null);
            $finalAvatarStyle = ($avatarStyle !== null && $avatarStyle !== '') ? $avatarStyle : ($existing['avatar_style'] ?? 'lorelei');
            $finalAvatarSeed = ($avatarSeed !== null && $avatarSeed !== '') ? $avatarSeed : ($existing['avatar_seed'] ?? ('buyer-' . $finalCode));
            $finalAvatarConfig = ($avatarConfig !== null && $avatarConfig !== '') ? $avatarConfig : ($existing['avatar_config'] ?? null);

            try {
                $stmt = $pdo->prepare("
                    UPDATE customers 
                    SET name = ?,
                        code = ?,
                        contact_person = ?,
                        phone = ?,
                        email = ?,
                        gstin = ?,
                        billing_address = ?,
                        avatar_style = ?,
                        avatar_seed = ?,
                        avatar_config = ?
                    WHERE id = ? AND deleted_at IS NULL
                ");
                $stmt->execute([
                    $finalName,
                    $finalCode,
                    $finalContact,
                    $finalPhone,
                    $finalEmail,
                    $finalGstin,
                    $finalAddress,
                    $finalAvatarStyle,
                    $finalAvatarSeed,
                    $finalAvatarConfig,
                    $id
                ]);
            } catch (Exception $colEx) {
                // Fallback for tables where avatar columns are not yet added
                $stmt = $pdo->prepare("
                    UPDATE customers 
                    SET name = ?,
                        code = ?,
                        contact_person = ?,
                        phone = ?,
                        email = ?,
                        gstin = ?,
                        billing_address = ?
                    WHERE id = ? AND deleted_at IS NULL
                ");
                $stmt->execute([
                    $finalName,
                    $finalCode,
                    $finalContact,
                    $finalPhone,
                    $finalEmail,
                    $finalGstin,
                    $finalAddress,
                    $id
                ]);
            }

            AuditLogger::log('Customers', 'UPDATE', $id, null, $data);
            Response::success([
                'id' => $id,
                'name' => $finalName,
                'code' => $finalCode,
                'avatar_style' => $finalAvatarStyle,
                'avatar_seed' => $finalAvatarSeed,
                'avatar_config' => $finalAvatarConfig
            ], "Customer updated successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    // -------------------------------------------------------------
    // BUYER PRODUCTS & PACKING
    // -------------------------------------------------------------
    private function getStoreData(): array {
        $storeFile = __DIR__ . '/../data/store.json';
        if (file_exists($storeFile)) {
            $json = json_decode(file_get_contents($storeFile), true);
            if (is_array($json)) return $json;
        }
        return [];
    }

    private function saveStoreData(array $data): void {
        $storeFile = __DIR__ . '/../data/store.json';
        file_put_contents($storeFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }

    private function ensureBuyerProductsTable(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS buyer_products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                buyer_id INT NOT NULL,
                product_name VARCHAR(150) NOT NULL,
                product_code VARCHAR(50) NOT NULL,
                uom VARCHAR(30) DEFAULT 'Pieces',
                notes TEXT NULL,
                image_url LONGTEXT NULL,
                dimensions_json LONGTEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_buyer_id (buyer_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS buyer_product_components (
                id INT AUTO_INCREMENT PRIMARY KEY,
                buyer_product_id INT NOT NULL,
                material_id INT NULL,
                category_id INT NULL,
                name VARCHAR(150) NOT NULL,
                category VARCHAR(100) NOT NULL,
                uom VARCHAR(30) DEFAULT 'Meters',
                quantity_per_product DECIMAL(12,4) DEFAULT 1.0000,
                wastage_percent DECIMAL(5,2) DEFAULT 0.00,
                notes VARCHAR(255) NULL,
                INDEX idx_bp_comp_id (buyer_product_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        try {
            $cols = $pdo->query("DESCRIBE buyer_product_components")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('material_id', $cols)) {
                $pdo->exec("ALTER TABLE buyer_product_components ADD COLUMN material_id INT NULL AFTER buyer_product_id;");
            }
        } catch (Exception $e) {}

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS buyer_product_boxes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                buyer_product_id INT NOT NULL,
                box_name VARCHAR(100) NOT NULL,
                box_code VARCHAR(50) NULL,
                length DECIMAL(10,2) NOT NULL,
                width DECIMAL(10,2) NOT NULL,
                height DECIMAL(10,2) NOT NULL,
                dimension_unit ENUM('mm', 'cm', 'm') DEFAULT 'cm',
                items_per_box INT NOT NULL DEFAULT 1,
                max_packing_qty INT NULL,
                notes VARCHAR(255) NULL,
                INDEX idx_bp_box_id (buyer_product_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    }

    public function getBuyerProducts(int $buyerId): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureBuyerProductsTable($pdo);

            $stmt = $pdo->prepare("SELECT * FROM buyer_products WHERE buyer_id = ? ORDER BY id ASC");
            $stmt->execute([$buyerId]);
            $productRows = $stmt->fetchAll();

            $products = [];
            foreach ($productRows as $r) {
                $prodId = (int)$r['id'];

                // Load BOM components
                $compStmt = $pdo->prepare("SELECT * FROM buyer_product_components WHERE buyer_product_id = ? ORDER BY id ASC");
                $compStmt->execute([$prodId]);
                $compRows = $compStmt->fetchAll();
                $components = array_map(function($c) {
                    return [
                        'id' => (string)$c['id'],
                        'material_id' => !empty($c['material_id']) ? (int)$c['material_id'] : null,
                        'category_id' => $c['category_id'] ? (int)$c['category_id'] : null,
                        'name' => $c['name'],
                        'category' => $c['category'],
                        'uom' => $c['uom'] ?? 'Meters',
                        'quantity_per_product' => (float)$c['quantity_per_product'],
                        'wastage_percent' => (float)$c['wastage_percent'],
                        'notes' => $c['notes'] ?? ''
                    ];
                }, $compRows);

                // Load Boxes
                $boxStmt = $pdo->prepare("SELECT * FROM buyer_product_boxes WHERE buyer_product_id = ? ORDER BY id ASC");
                $boxStmt->execute([$prodId]);
                $boxRows = $boxStmt->fetchAll();
                $boxes = array_map(function($b) {
                    return [
                        'id' => (string)$b['id'],
                        'box_name' => $b['box_name'],
                        'box_code' => $b['box_code'] ?? '',
                        'length' => (float)$b['length'],
                        'width' => (float)$b['width'],
                        'height' => (float)$b['height'],
                        'dimension_unit' => $b['dimension_unit'] ?? 'cm',
                        'items_per_box' => (int)$b['items_per_box'],
                        'max_packing_qty' => $b['max_packing_qty'] ? (int)$b['max_packing_qty'] : null,
                        'notes' => $b['notes'] ?? ''
                    ];
                }, $boxRows);

                $dimensions = !empty($r['dimensions_json']) ? json_decode($r['dimensions_json'], true) : null;

                $products[] = [
                    'id' => $prodId,
                    'buyer_id' => (int)$r['buyer_id'],
                    'product_name' => $r['product_name'],
                    'product_code' => $r['product_code'],
                    'uom' => $r['uom'] ?? 'Pieces',
                    'notes' => $r['notes'] ?? '',
                    'image_url' => $r['image_url'] ?? '',
                    'dimensions' => $dimensions,
                    'components' => $components,
                    'boxes' => $boxes,
                    'status' => (!empty($components) && !empty($boxes)) ? 'Ready' : 'Incomplete',
                    'created_at' => $r['created_at'],
                    'updated_at' => $r['updated_at'] ?? $r['created_at']
                ];
            }

            Response::success($products);
        } catch (Exception $e) {
            // Fallback to store.json
            $db = $this->getStoreData();
            $buyerProducts = $db['buyer_products'] ?? [];
            $filtered = array_values(array_filter($buyerProducts, fn($p) => (int)($p['buyer_id'] ?? 0) === $buyerId));
            Response::success($filtered);
        }
    }

    public function getBuyerProduct(int $buyerId, int $productId): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureBuyerProductsTable($pdo);

            $stmt = $pdo->prepare("SELECT * FROM buyer_products WHERE id = ? AND buyer_id = ?");
            $stmt->execute([$productId, $buyerId]);
            $r = $stmt->fetch();

            if (!$r) {
                Response::error("Buyer product not found", 404);
                return;
            }

            // Load BOM components
            $compStmt = $pdo->prepare("SELECT * FROM buyer_product_components WHERE buyer_product_id = ? ORDER BY id ASC");
            $compStmt->execute([$productId]);
            $compRows = $compStmt->fetchAll();
            $components = array_map(function($c) {
                return [
                    'id' => (string)$c['id'],
                    'material_id' => !empty($c['material_id']) ? (int)$c['material_id'] : null,
                    'category_id' => $c['category_id'] ? (int)$c['category_id'] : null,
                    'name' => $c['name'],
                    'category' => $c['category'],
                    'uom' => $c['uom'] ?? 'Meters',
                    'quantity_per_product' => (float)$c['quantity_per_product'],
                    'wastage_percent' => (float)$c['wastage_percent'],
                    'notes' => $c['notes'] ?? ''
                ];
            }, $compRows);

            // Load Boxes
            $boxStmt = $pdo->prepare("SELECT * FROM buyer_product_boxes WHERE buyer_product_id = ? ORDER BY id ASC");
            $boxStmt->execute([$productId]);
            $boxRows = $boxStmt->fetchAll();
            $boxes = array_map(function($b) {
                return [
                    'id' => (string)$b['id'],
                    'box_name' => $b['box_name'],
                    'box_code' => $b['box_code'] ?? '',
                    'length' => (float)$b['length'],
                    'width' => (float)$b['width'],
                    'height' => (float)$b['height'],
                    'dimension_unit' => $b['dimension_unit'] ?? 'cm',
                    'items_per_box' => (int)$b['items_per_box'],
                    'max_packing_qty' => $b['max_packing_qty'] ? (int)$b['max_packing_qty'] : null,
                    'notes' => $b['notes'] ?? ''
                ];
            }, $boxRows);

            $dimensions = !empty($r['dimensions_json']) ? json_decode($r['dimensions_json'], true) : null;

            $product = [
                'id' => (int)$r['id'],
                'buyer_id' => (int)$r['buyer_id'],
                'product_name' => $r['product_name'],
                'product_code' => $r['product_code'],
                'uom' => $r['uom'] ?? 'Pieces',
                'notes' => $r['notes'] ?? '',
                'image_url' => $r['image_url'] ?? '',
                'dimensions' => $dimensions,
                'components' => $components,
                'boxes' => $boxes,
                'status' => (!empty($components) && !empty($boxes)) ? 'Ready' : 'Incomplete',
                'created_at' => $r['created_at'],
                'updated_at' => $r['updated_at'] ?? $r['created_at']
            ];

            Response::success($product);
        } catch (Exception $e) {
            // Fallback to store.json
            $db = $this->getStoreData();
            $buyerProducts = $db['buyer_products'] ?? [];
            foreach ($buyerProducts as $p) {
                if ((int)($p['buyer_id'] ?? 0) === $buyerId && (int)($p['id'] ?? 0) === $productId) {
                    Response::success($p);
                    return;
                }
            }
            Response::error("Buyer product not found", 404);
        }
    }

    public function createBuyerProduct(int $buyerId): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $productName = trim($data['product_name'] ?? ($data['name'] ?? ''));
        if (empty($productName)) {
            Response::error("Product name is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $this->ensureBuyerProductsTable($pdo);

            $productCode = trim($data['product_code'] ?? '');
            if (empty($productCode)) {
                $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM buyer_products WHERE buyer_id = ?");
                $cntStmt->execute([$buyerId]);
                $cnt = (int)$cntStmt->fetchColumn();
                $productCode = 'BPRD-' . str_pad((string)($cnt + 1), 3, '0', STR_PAD_LEFT);
            }

            $uom = trim($data['uom'] ?? 'Pieces');
            $notes = trim($data['notes'] ?? '');
            $imageUrl = trim($data['image_url'] ?? '');
            $dimensionsJson = isset($data['dimensions']) ? json_encode($data['dimensions']) : null;

            $stmt = $pdo->prepare("
                INSERT INTO buyer_products (buyer_id, product_name, product_code, uom, notes, image_url, dimensions_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$buyerId, $productName, $productCode, $uom, $notes, $imageUrl, $dimensionsJson]);
            $newId = (int)$pdo->lastInsertId();

            // Insert BOM components
            $savedComponents = [];
            if (!empty($data['components']) && is_array($data['components'])) {
                $compIns = $pdo->prepare("
                    INSERT INTO buyer_product_components (buyer_product_id, material_id, category_id, name, category, uom, quantity_per_product, wastage_percent, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                foreach ($data['components'] as $c) {
                    $cName = trim($c['name'] ?? '');
                    if (empty($cName) && empty($c['material_id'])) continue;
                    $matId = !empty($c['material_id']) ? (int)$c['material_id'] : null;
                    $catId = !empty($c['category_id']) ? (int)$c['category_id'] : null;
                    $cat = trim($c['category'] ?? 'Raw Material');
                    $cUom = trim($c['uom'] ?? 'Meters');
                    $qty = (float)($c['quantity_per_product'] ?? 1);
                    $wastage = (float)($c['wastage_percent'] ?? 0);
                    $cNotes = trim($c['notes'] ?? '');
                    $compIns->execute([$newId, $matId, $catId, $cName, $cat, $cUom, $qty, $wastage, $cNotes]);
                    $c['id'] = (string)$pdo->lastInsertId();
                    $c['material_id'] = $matId;
                    $savedComponents[] = $c;
                }
            }

            // Insert Boxes
            $savedBoxes = [];
            if (!empty($data['boxes']) && is_array($data['boxes'])) {
                $boxIns = $pdo->prepare("
                    INSERT INTO buyer_product_boxes (buyer_product_id, box_name, box_code, length, width, height, dimension_unit, items_per_box, max_packing_qty, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                foreach ($data['boxes'] as $b) {
                    $bName = trim($b['box_name'] ?? '');
                    if (empty($bName)) continue;
                    $bCode = trim($b['box_code'] ?? '');
                    $bLen = (float)($b['length'] ?? 0);
                    $bWid = (float)($b['width'] ?? 0);
                    $bHgt = (float)($b['height'] ?? 0);
                    $bUnit = in_array($b['dimension_unit'] ?? 'cm', ['mm', 'cm', 'm']) ? $b['dimension_unit'] : 'cm';
                    $bItems = (int)($b['items_per_box'] ?? 1);
                    $bMax = !empty($b['max_packing_qty']) ? (int)$b['max_packing_qty'] : null;
                    $bNotes = trim($b['notes'] ?? '');
                    $boxIns->execute([$newId, $bName, $bCode, $bLen, $bWid, $bHgt, $bUnit, $bItems, $bMax, $bNotes]);
                    $b['id'] = (string)$pdo->lastInsertId();
                    $savedBoxes[] = $b;
                }
            }

            $created = [
                'id' => $newId,
                'buyer_id' => $buyerId,
                'product_name' => $productName,
                'product_code' => $productCode,
                'uom' => $uom,
                'notes' => $notes,
                'image_url' => $imageUrl,
                'dimensions' => $data['dimensions'] ?? null,
                'components' => $savedComponents,
                'boxes' => $savedBoxes,
                'status' => (!empty($savedComponents) && !empty($savedBoxes)) ? 'Ready' : 'Incomplete',
                'created_at' => date('Y-m-d H:i:s')
            ];

            // Secondary file sync
            try {
                $db = $this->getStoreData();
                if (!isset($db['buyer_products'])) $db['buyer_products'] = [];
                $db['buyer_products'][] = $created;
                $this->saveStoreData($db);
            } catch (Exception $ex) {}

            AuditLogger::log('BuyerProducts', 'CREATE', $newId, null, $data);

            Response::success($created, "Buyer product created successfully", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function updateBuyerProduct(int $buyerId, int $productId): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $productName = trim($data['product_name'] ?? ($data['name'] ?? ''));
        if (empty($productName)) {
            Response::error("Product name is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $this->ensureBuyerProductsTable($pdo);

            $productCode = trim($data['product_code'] ?? '');
            $uom = trim($data['uom'] ?? 'Pieces');
            $notes = trim($data['notes'] ?? '');
            $imageUrl = trim($data['image_url'] ?? '');
            $dimensionsJson = isset($data['dimensions']) ? json_encode($data['dimensions']) : null;

            $stmt = $pdo->prepare("
                UPDATE buyer_products
                SET product_name = ?, product_code = ?, uom = ?, notes = ?, image_url = ?, dimensions_json = ?
                WHERE id = ? AND buyer_id = ?
            ");
            $stmt->execute([$productName, $productCode, $uom, $notes, $imageUrl, $dimensionsJson, $productId, $buyerId]);

            // Replace BOM components
            $pdo->prepare("DELETE FROM buyer_product_components WHERE buyer_product_id = ?")->execute([$productId]);
            $savedComponents = [];
            if (!empty($data['components']) && is_array($data['components'])) {
                $compIns = $pdo->prepare("
                    INSERT INTO buyer_product_components (buyer_product_id, material_id, category_id, name, category, uom, quantity_per_product, wastage_percent, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                foreach ($data['components'] as $c) {
                    $cName = trim($c['name'] ?? '');
                    if (empty($cName) && empty($c['material_id'])) continue;
                    $matId = !empty($c['material_id']) ? (int)$c['material_id'] : null;
                    $catId = !empty($c['category_id']) ? (int)$c['category_id'] : null;
                    $cat = trim($c['category'] ?? 'Raw Material');
                    $cUom = trim($c['uom'] ?? 'Meters');
                    $qty = (float)($c['quantity_per_product'] ?? 1);
                    $wastage = (float)($c['wastage_percent'] ?? 0);
                    $cNotes = trim($c['notes'] ?? '');
                    $compIns->execute([$productId, $matId, $catId, $cName, $cat, $cUom, $qty, $wastage, $cNotes]);
                    $c['id'] = (string)$pdo->lastInsertId();
                    $c['material_id'] = $matId;
                    $savedComponents[] = $c;
                }
            }

            // Replace Boxes
            $pdo->prepare("DELETE FROM buyer_product_boxes WHERE buyer_product_id = ?")->execute([$productId]);
            $savedBoxes = [];
            if (!empty($data['boxes']) && is_array($data['boxes'])) {
                $boxIns = $pdo->prepare("
                    INSERT INTO buyer_product_boxes (buyer_product_id, box_name, box_code, length, width, height, dimension_unit, items_per_box, max_packing_qty, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                foreach ($data['boxes'] as $b) {
                    $bName = trim($b['box_name'] ?? '');
                    if (empty($bName)) continue;
                    $bCode = trim($b['box_code'] ?? '');
                    $bLen = (float)($b['length'] ?? 0);
                    $bWid = (float)($b['width'] ?? 0);
                    $bHgt = (float)($b['height'] ?? 0);
                    $bUnit = in_array($b['dimension_unit'] ?? 'cm', ['mm', 'cm', 'm']) ? $b['dimension_unit'] : 'cm';
                    $bItems = (int)($b['items_per_box'] ?? 1);
                    $bMax = !empty($b['max_packing_qty']) ? (int)$b['max_packing_qty'] : null;
                    $bNotes = trim($b['notes'] ?? '');
                    $boxIns->execute([$productId, $bName, $bCode, $bLen, $bWid, $bHgt, $bUnit, $bItems, $bMax, $bNotes]);
                    $b['id'] = (string)$pdo->lastInsertId();
                    $savedBoxes[] = $b;
                }
            }

            $updated = [
                'id' => $productId,
                'buyer_id' => $buyerId,
                'product_name' => $productName,
                'product_code' => $productCode,
                'uom' => $uom,
                'notes' => $notes,
                'image_url' => $imageUrl,
                'dimensions' => $data['dimensions'] ?? null,
                'components' => $savedComponents,
                'boxes' => $savedBoxes,
                'status' => (!empty($savedComponents) && !empty($savedBoxes)) ? 'Ready' : 'Incomplete'
            ];

            // Secondary file sync
            try {
                $db = $this->getStoreData();
                if (isset($db['buyer_products'])) {
                    foreach ($db['buyer_products'] as &$bp) {
                        if ((int)($bp['id'] ?? 0) === $productId && (int)($bp['buyer_id'] ?? 0) === $buyerId) {
                            $bp = array_merge($bp, $updated);
                            break;
                        }
                    }
                    $this->saveStoreData($db);
                }
            } catch (Exception $ex) {}

            AuditLogger::log('BuyerProducts', 'UPDATE', $productId, null, $data);

            Response::success($updated, "Buyer product updated successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function deleteBuyerProduct(int $buyerId, int $productId): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureBuyerProductsTable($pdo);

            $pdo->prepare("DELETE FROM buyer_product_components WHERE buyer_product_id = ?")->execute([$productId]);
            $pdo->prepare("DELETE FROM buyer_product_boxes WHERE buyer_product_id = ?")->execute([$productId]);

            $stmt = $pdo->prepare("DELETE FROM buyer_products WHERE id = ? AND buyer_id = ?");
            $stmt->execute([$productId, $buyerId]);

            // Secondary file sync
            try {
                $db = $this->getStoreData();
                if (isset($db['buyer_products'])) {
                    $db['buyer_products'] = array_values(array_filter(
                        $db['buyer_products'],
                        fn($p) => !((int)($p['id'] ?? 0) === $productId && (int)($p['buyer_id'] ?? 0) === $buyerId)
                    ));
                    $this->saveStoreData($db);
                }
            } catch (Exception $ex) {}

            AuditLogger::log('BuyerProducts', 'DELETE', $productId, null, null);

            Response::success(null, "Buyer product deleted successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    // -------------------------------------------------------------
    // COLORS, SIZES, UNITS, DESIGNS
    // -------------------------------------------------------------
    public function lookupPantoneColor(): void {
        try {
            $pdo = Database::getConnection();

            // Check if pantone_colors table exists
            $tableCheck = $pdo->query("SHOW TABLES LIKE 'pantone_colors'")->fetch();
            if (!$tableCheck) {
                Response::success([
                    'found' => false,
                    'items' => [],
                    'total' => 0,
                    'message' => 'pantone_colors table not yet created'
                ]);
                return;
            }

            $singleCode = trim($_GET['code'] ?? '');
            $isLookup = !empty($singleCode) && !isset($_GET['page']) && !isset($_GET['list']) && !isset($_GET['search']);

            // 1. Single Color Lookup mode (by code or name)
            if ($isLookup) {
                $clean = preg_replace('/^PANTONE\s+/i', '', $singleCode);
                $withPantone = 'PANTONE ' . $clean;

                $stmt = $pdo->prepare("
                    SELECT id, pantone_name, pantone_code, unique_code, hex_code, red, green, blue, color_system
                    FROM pantone_colors
                    WHERE pantone_name = ? 
                       OR pantone_code = ? 
                       OR pantone_name = ? 
                       OR pantone_code = ?
                       OR unique_code = ?
                    LIMIT 1
                ");
                $stmt->execute([$singleCode, $singleCode, $withPantone, $clean, $singleCode]);
                $row = $stmt->fetch();

                if (!$row) {
                    $stmt = $pdo->prepare("
                        SELECT id, pantone_name, pantone_code, unique_code, hex_code, red, green, blue, color_system
                        FROM pantone_colors
                        WHERE pantone_code LIKE ? OR pantone_name LIKE ?
                        LIMIT 1
                    ");
                    $like = '%' . $clean . '%';
                    $stmt->execute([$like, $like]);
                    $row = $stmt->fetch();
                }

                if ($row) {
                    Response::success([
                        'found' => true,
                        'pantone_name' => $row['pantone_name'],
                        'pantone_code' => $row['pantone_code'],
                        'unique_code' => $row['unique_code'],
                        'hex_code' => $row['hex_code'],
                        'red' => (int)$row['red'],
                        'green' => (int)$row['green'],
                        'blue' => (int)$row['blue'],
                        'color_system' => $row['color_system'] ?? 'PMS Coated'
                    ]);
                    return;
                }

                Response::success(['found' => false, 'message' => 'Pantone color not found']);
                return;
            }

            // 2. All Colors mode (e.g. for production order dropdowns)
            $isAll = isset($_GET['all']) || ((int)($_GET['limit'] ?? 0) >= 3000);
            if ($isAll) {
                $stmt = $pdo->query("
                    SELECT id, pantone_name, pantone_code, unique_code, hex_code, red, green, blue, color_system, created_at
                    FROM pantone_colors
                    ORDER BY pantone_code ASC
                ");
                $items = $stmt->fetchAll();
                Response::success([
                    'items' => $items,
                    'total' => count($items),
                    'page' => 1,
                    'limit' => count($items),
                    'total_pages' => 1
                ]);
                return;
            }

            // 3. Table / List search mode with pagination
            $search = trim($_GET['search'] ?? ($_GET['q'] ?? ''));
            $page = max(1, (int)($_GET['page'] ?? 1));
            $limit = max(10, min(200, (int)($_GET['limit'] ?? 25)));
            $offset = ($page - 1) * $limit;

            $whereSql = "WHERE 1=1";
            $params = [];

            if (!empty($search)) {
                $cleanSearch = preg_replace('/^PANTONE\s+/i', '', $search);
                $whereSql .= " AND (pantone_name LIKE ? OR pantone_code LIKE ? OR unique_code LIKE ? OR hex_code LIKE ? OR color_system LIKE ?)";
                $like = '%' . $cleanSearch . '%';
                $params = [$like, $like, $like, $like, $like];
            }

            // Count total
            $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM pantone_colors {$whereSql}");
            $cntStmt->execute($params);
            $total = (int)$cntStmt->fetchColumn();

            // Fetch records
            $dataStmt = $pdo->prepare("
                SELECT id, pantone_name, pantone_code, unique_code, hex_code, red, green, blue, color_system, created_at
                FROM pantone_colors
                {$whereSql}
                ORDER BY id ASC
                LIMIT {$limit} OFFSET {$offset}
            ");
            $dataStmt->execute($params);
            $items = $dataStmt->fetchAll();

            Response::success([
                'items' => $items,
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'total_pages' => ceil($total / $limit)
            ]);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function createPantoneColor(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $pantoneCode = trim($data['pantone_code'] ?? '');
        $pantoneName = trim($data['pantone_name'] ?? ($data['name'] ?? ''));
        $hex = trim($data['hex_code'] ?? '#000000');
        if ($hex !== '' && !str_starts_with($hex, '#')) {
            $hex = '#' . $hex;
        }
        $red = isset($data['red']) ? (int)$data['red'] : 0;
        $green = isset($data['green']) ? (int)$data['green'] : 0;
        $blue = isset($data['blue']) ? (int)$data['blue'] : 0;
        $system = trim($data['color_system'] ?? 'PMS Coated');
        $uniqueCode = trim($data['unique_code'] ?? ('CUST-' . rand(1000, 9999)));

        if (empty($pantoneCode)) {
            Response::error("Pantone code is required", 422);
            return;
        }
        if (empty($pantoneName)) {
            Response::error("Pantone color name is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();

            // Insert into pantone_colors
            $stmt = $pdo->prepare("
                INSERT INTO pantone_colors (pantone_name, pantone_code, unique_code, hex_code, red, green, blue, color_system, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
            ");
            $stmt->execute([$pantoneName, $pantoneCode, $uniqueCode, $hex, $red, $green, $blue, $system]);
            $newId = (int)$pdo->lastInsertId();

            // Also keep legacy colors table in sync
            try {
                $chk = $pdo->prepare("SELECT id FROM colors WHERE pantone_code = ? OR name = ? LIMIT 1");
                $chk->execute([$pantoneCode, $pantoneName]);
                if (!$chk->fetch()) {
                    $internalCode = 'CLR-' . str_pad((string)$newId, 4, '0', STR_PAD_LEFT);
                    $ins = $pdo->prepare("INSERT INTO colors (code, name, hex_code, pantone_code) VALUES (?, ?, ?, ?)");
                    $ins->execute([$internalCode, $pantoneName, $hex, $pantoneCode]);
                }
            } catch (Exception $e) {}

            AuditLogger::log('PantoneColors', 'CREATE', $newId, null, $data);

            Response::success([
                'id' => $newId,
                'pantone_name' => $pantoneName,
                'pantone_code' => $pantoneCode,
                'unique_code' => $uniqueCode,
                'hex_code' => $hex,
                'red' => $red,
                'green' => $green,
                'blue' => $blue,
                'color_system' => $system
            ], "Pantone color created successfully", 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function updatePantoneColor(int $id): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $pantoneCode = trim($data['pantone_code'] ?? '');
        $pantoneName = trim($data['pantone_name'] ?? ($data['name'] ?? ''));
        $hex = trim($data['hex_code'] ?? '#000000');
        if ($hex !== '' && !str_starts_with($hex, '#')) {
            $hex = '#' . $hex;
        }
        $red = isset($data['red']) ? (int)$data['red'] : 0;
        $green = isset($data['green']) ? (int)$data['green'] : 0;
        $blue = isset($data['blue']) ? (int)$data['blue'] : 0;
        $system = trim($data['color_system'] ?? 'PMS Coated');

        if (empty($pantoneCode) || empty($pantoneName)) {
            Response::error("Pantone code and name are required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                UPDATE pantone_colors
                SET pantone_name = ?, pantone_code = ?, hex_code = ?, red = ?, green = ?, blue = ?, color_system = ?
                WHERE id = ?
            ");
            $stmt->execute([$pantoneName, $pantoneCode, $hex, $red, $green, $blue, $system, $id]);

            // Sync with legacy colors table
            try {
                $updColors = $pdo->prepare("UPDATE colors SET name = ?, hex_code = ? WHERE pantone_code = ?");
                $updColors->execute([$pantoneName, $hex, $pantoneCode]);
            } catch (Exception $e) {}

            AuditLogger::log('PantoneColors', 'UPDATE', $id, null, $data);

            Response::success([
                'id' => $id,
                'pantone_name' => $pantoneName,
                'pantone_code' => $pantoneCode,
                'hex_code' => $hex,
                'red' => $red,
                'green' => $green,
                'blue' => $blue,
                'color_system' => $system
            ], "Pantone color updated successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function deletePantoneColor(int $id): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("DELETE FROM pantone_colors WHERE id = ?");
            $stmt->execute([$id]);

            AuditLogger::log('PantoneColors', 'DELETE', $id, null, null);

            Response::success(null, "Pantone color deleted successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function getColors(): void {
        try {
            $pdo = Database::getConnection();
            // Ensure pantone_code column exists (idempotent)
            try {
                $pdo->exec("ALTER TABLE colors ADD COLUMN pantone_code VARCHAR(50) NULL DEFAULT NULL");
            } catch (Exception $alterEx) {
                // Column already exists — ignore
            }
            $stmt = $pdo->query("SELECT id, code, name, hex_code, COALESCE(pantone_code, '') AS pantone_code, created_at FROM colors ORDER BY name ASC");
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
        $pantoneCode = trim($data['pantone_code'] ?? '');

        if (empty($name)) {
            Response::error("Color name is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            // Ensure pantone_code column exists
            try {
                $pdo->exec("ALTER TABLE colors ADD COLUMN pantone_code VARCHAR(50) NULL DEFAULT NULL");
            } catch (Exception $alterEx) {
                // Column already exists — ignore
            }
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

            $stmt = $pdo->prepare("INSERT INTO colors (code, name, hex_code, pantone_code) VALUES (?, ?, ?, ?)");
            $stmt->execute([$code, $name, $hex ?: null, $pantoneCode ?: null]);
            $id = (int)$pdo->lastInsertId();

            $pdo->commit();
            AuditLogger::log('Colors', 'CREATE', $id, null, ['code' => $code, 'name' => $name, 'pantone_code' => $pantoneCode]);
            Response::success([
                'id' => $id,
                'code' => $code,
                'name' => $name,
                'hex_code' => $hex ?: null,
                'pantone_code' => $pantoneCode ?: null
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

    public function updateColor(int $id): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');
        $hex = trim($data['hex_code'] ?? '#000000');
        if ($hex !== '' && !str_starts_with($hex, '#')) {
            $hex = '#' . $hex;
        }
        $code = trim($data['code'] ?? '');
        $pantoneCode = trim($data['pantone_code'] ?? '');

        if (empty($name)) {
            Response::error("Color name is required", 422);
            return;
        }

        try {
            $pdo = Database::getConnection();
            try {
                $pdo->exec("ALTER TABLE colors ADD COLUMN pantone_code VARCHAR(50) NULL DEFAULT NULL");
            } catch (Exception $alterEx) {}

            $stmtCurr = $pdo->prepare("SELECT code FROM colors WHERE id = ?");
            $stmtCurr->execute([$id]);
            $currCode = $stmtCurr->fetchColumn();
            $finalCode = $currCode ?: ($code ?: sprintf('CLR-%04d', $id));

            $stmt = $pdo->prepare("UPDATE colors SET name = ?, hex_code = ?, pantone_code = ? WHERE id = ?");
            $stmt->execute([$name, $hex ?: null, $pantoneCode ?: null, $id]);

            AuditLogger::log('Colors', 'UPDATE', $id, null, ['code' => $finalCode, 'name' => $name, 'pantone_code' => $pantoneCode]);
            Response::success([
                'id' => $id,
                'name' => $name,
                'code' => $finalCode,
                'hex_code' => $hex ?: null,
                'pantone_code' => $pantoneCode ?: null
            ], "Color updated successfully");
        } catch (Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function deleteColor(int $id): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT * FROM colors WHERE id = ?");
            $stmt->execute([$id]);
            $color = $stmt->fetch();
            if (!$color) {
                Response::error("Color not found", 404);
                return;
            }

            // Referential integrity checks across transactional and master tables
            $refChecks = [];
            $searchColors = array_values(array_filter([
                $color['name'] ?? null,
                $color['code'] ?? null,
                $color['pantone_code'] ?? null
            ]));

            // 1. Production order items
            try {
                $poiCols = $pdo->query("DESCRIBE production_order_items")->fetchAll(PDO::FETCH_COLUMN);
                if (in_array('color', $poiCols) && !empty($searchColors)) {
                    $placeholders = implode(',', array_fill(0, count($searchColors), '?'));
                    $poiStmt = $pdo->prepare("SELECT COUNT(*) FROM production_order_items WHERE color IN ($placeholders)");
                    $poiStmt->execute($searchColors);
                    $poiCount = (int)$poiStmt->fetchColumn();
                    if ($poiCount > 0) {
                        $refChecks[] = "{$poiCount} production order item(s)";
                    }
                }
                if (in_array('color_id', $poiCols)) {
                    $poiIdStmt = $pdo->prepare("SELECT COUNT(*) FROM production_order_items WHERE color_id = ?");
                    $poiIdStmt->execute([$id]);
                    $poiIdCount = (int)$poiIdStmt->fetchColumn();
                    if ($poiIdCount > 0) {
                        $refChecks[] = "{$poiIdCount} production order item(s)";
                    }
                }
            } catch (Exception $e) {
                // Table might not exist
            }

            // 2. Purchase order items
            try {
                $poCols = $pdo->query("DESCRIBE purchase_order_items")->fetchAll(PDO::FETCH_COLUMN);
                if (in_array('color', $poCols) && !empty($searchColors)) {
                    $placeholders = implode(',', array_fill(0, count($searchColors), '?'));
                    $poStmt = $pdo->prepare("SELECT COUNT(*) FROM purchase_order_items WHERE color IN ($placeholders)");
                    $poStmt->execute($searchColors);
                    $poCount = (int)$poStmt->fetchColumn();
                    if ($poCount > 0) {
                        $refChecks[] = "{$poCount} purchase order item(s)";
                    }
                }
                if (in_array('color_id', $poCols)) {
                    $poIdStmt = $pdo->prepare("SELECT COUNT(*) FROM purchase_order_items WHERE color_id = ?");
                    $poIdStmt->execute([$id]);
                    $poIdCount = (int)$poIdStmt->fetchColumn();
                    if ($poIdCount > 0) {
                        $refChecks[] = "{$poIdCount} purchase order item(s)";
                    }
                }
            } catch (Exception $e) {
                // Table might not exist
            }

            // 3. Product variants
            try {
                $pvCols = $pdo->query("DESCRIBE product_variants")->fetchAll(PDO::FETCH_COLUMN);
                if (in_array('color_id', $pvCols)) {
                    $pvStmt = $pdo->prepare("SELECT COUNT(*) FROM product_variants WHERE color_id = ?");
                    $pvStmt->execute([$id]);
                    $pvCount = (int)$pvStmt->fetchColumn();
                    if ($pvCount > 0) {
                        $refChecks[] = "{$pvCount} product variant(s)";
                    }
                }
            } catch (Exception $e) {
                // Table might not exist
            }

            if (!empty($refChecks)) {
                $reason = implode(' and ', $refChecks);
                Response::error(
                    "Cannot delete color '{$color['name']}' ({$color['code']}) because it is actively referenced in {$reason}. Historical production records must be preserved.",
                    422
                );
                return;
            }

            $del = $pdo->prepare("DELETE FROM colors WHERE id = ?");
            $del->execute([$id]);

            AuditLogger::log('Colors', 'DELETE', $id, $color, null);
            Response::success([
                'id' => $id,
                'name' => $color['name'],
                'code' => $color['code']
            ], "Color '{$color['name']}' ({$color['code']}) deleted successfully");
        } catch (Exception $e) {
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
