-- ==========================================================
-- CHERAN SOFT GOODS - CREATE MISSING TABLES MIGRATION
-- Database: u868013330_cheran
-- Run this in phpMyAdmin SQL tab
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Permissions (User access rights)
CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Role Permissions (Mapping roles to permissions)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Templates (Dynamic PO & form print templates)
CREATE TABLE IF NOT EXISTS templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    template_type ENUM('po', 'order', 'material', 'product', 'receipt') NOT NULL,
    is_default BOOLEAN DEFAULT TRUE,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Template Fields (Field mappings for templates)
CREATE TABLE IF NOT EXISTS template_fields (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_id INT NOT NULL,
    category_field_id INT NOT NULL,
    sort_order INT DEFAULT 0,
    is_required BOOLEAN DEFAULT FALSE,
    column_width INT DEFAULT 120,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    FOREIGN KEY (category_field_id) REFERENCES category_fields(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Specifications (Category specifications master)
CREATE TABLE IF NOT EXISTS specifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    spec_value VARCHAR(255) NOT NULL,
    category_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Product Field Values (Dynamic attributes for finished products)
CREATE TABLE IF NOT EXISTS product_field_values (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    category_field_id INT NOT NULL,
    field_value TEXT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (category_field_id) REFERENCES category_fields(id) ON DELETE CASCADE,
    UNIQUE KEY uq_product_field (product_id, category_field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. BOMs (Bill of Materials Header)
CREATE TABLE IF NOT EXISTS boms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    batch_size INT NOT NULL DEFAULT 1,
    status ENUM('active', 'archived') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. BOM Items (Bill of Materials raw material items & consumption)
CREATE TABLE IF NOT EXISTS bom_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bom_id INT NOT NULL,
    material_id INT NOT NULL,
    quantity_required DECIMAL(12, 4) NOT NULL,
    uom VARCHAR(20) NOT NULL,
    wastage_percent DECIMAL(5, 2) DEFAULT 0.00,
    FOREIGN KEY (bom_id) REFERENCES boms(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Stock Adjustments (Physical inventory audits & reconciliation)
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    adjustment_no VARCHAR(50) NOT NULL UNIQUE,
    material_id INT NOT NULL,   
    adjustment_type ENUM('increase', 'decrease') NOT NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Audit Logs (System audit trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    record_id INT NULL,
    old_value JSON NULL,
    new_value JSON NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_module (module),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Company Settings (Company profile, GST, Currency)
CREATE TABLE IF NOT EXISTS company_settings (
    id INT PRIMARY KEY DEFAULT 1,
    company_name VARCHAR(150) NOT NULL DEFAULT 'CHERAN SOFT GOODS',
    tagline VARCHAR(200) DEFAULT 'Premier Textile Manufacturing ERP',
    address TEXT NULL,
    phone VARCHAR(30) NULL,
    email VARCHAR(100) NULL,
    gstin VARCHAR(30) NULL,
    currency_symbol VARCHAR(10) DEFAULT '₹',
    currency_code VARCHAR(10) DEFAULT 'INR',
    fiscal_year_start VARCHAR(10) DEFAULT '04-01',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Buyer Products (Buyer specific master catalog)
CREATE TABLE IF NOT EXISTS buyer_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    buyer_id INT NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    product_code VARCHAR(50) NULL,
    uom VARCHAR(30) NOT NULL DEFAULT 'Pieces',
    notes TEXT NULL,
    image_url LONGTEXT NULL,
    dimensions_json JSON NULL,
    cutting_size_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (buyer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Buyer Product Components (BOM for buyer products)
CREATE TABLE IF NOT EXISTS buyer_product_components (
    id INT AUTO_INCREMENT PRIMARY KEY,
    buyer_product_id INT NOT NULL,
    material_id INT NULL,
    category_id INT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Fabric',
    uom VARCHAR(30) NOT NULL DEFAULT 'Meter',
    size VARCHAR(100) NULL,
    model VARCHAR(100) NULL,
    length VARCHAR(100) NULL,
    thickness VARCHAR(100) NULL,
    quantity_per_product DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
    wastage_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    notes VARCHAR(255) NULL,
    FOREIGN KEY (buyer_product_id) REFERENCES buyer_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Buyer Product Boxes (Carton & packaging configuration)
CREATE TABLE IF NOT EXISTS buyer_product_boxes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    buyer_product_id INT NOT NULL,
    box_name VARCHAR(100) NOT NULL,
    box_code VARCHAR(50) NULL,
    length DECIMAL(10, 2) NOT NULL,
    width DECIMAL(10, 2) NOT NULL,
    height DECIMAL(10, 2) NOT NULL,
    dimension_unit ENUM('mm', 'cm', 'm') DEFAULT 'cm',
    items_per_box INT NOT NULL DEFAULT 1,
    max_packing_qty INT NULL,
    notes VARCHAR(255) NULL,
    FOREIGN KEY (buyer_product_id) REFERENCES buyer_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- SEED ESSENTIAL DEFAULT DATA
-- -------------------------------------------------------------

-- Default Company Settings
INSERT INTO company_settings (id, company_name, tagline, address, phone, email, gstin, currency_symbol, currency_code)
VALUES (1, 'Cheran Soft Goods Private Limited', 'Premier Textile Manufacturing ERP', '124 Textile Park, Palladam Road, Tiruppur - 641604, Tamil Nadu', '+91 421 2478900', 'operations@cheransoftgoods.com', '33AABCC1234F1Z5', '₹', 'INR')
ON DUPLICATE KEY UPDATE company_name = VALUES(company_name);

-- Default System Permissions
INSERT IGNORE INTO permissions (id, code, module, name, description) VALUES
(1, 'MANAGE_USERS', 'SETTINGS', 'Manage Users', 'Create, edit and manage ERP user accounts'),
(2, 'VIEW_REPORTS', 'REPORTS', 'View Reports', 'Access analytics, production and ledger reports'),
(3, 'MANAGE_INVENTORY', 'INVENTORY', 'Manage Stock', 'Material transactions, physical stock adjustments'),
(4, 'MANAGE_PRODUCTION', 'PRODUCTION', 'Manage Production', 'Create orders, move stages, track QC'),
(5, 'MANAGE_PURCHASE', 'PURCHASE', 'Manage Purchase', 'PO creation, goods receipts, supplier payments');

-- Assign all permissions to Administrator (role_id = 1)
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5);

SET FOREIGN_KEY_CHECKS = 1;
