-- ==========================================================
-- CHERAN SOFT GOODS - TEXTILE MANUFACTURING ERP
-- DATABASE SCHEMA (MySQL 8.0+ / MariaDB)
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS rework_records;
DROP TABLE IF EXISTS qc_records;
DROP TABLE IF EXISTS production_stage_transactions;
DROP TABLE IF EXISTS production_order_items;
DROP TABLE IF EXISTS production_orders;
DROP TABLE IF EXISTS production_stages;
DROP TABLE IF EXISTS bom_items;
DROP TABLE IF EXISTS boms;
DROP TABLE IF EXISTS stock_adjustments;
DROP TABLE IF EXISTS stock_balances;
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS purchase_returns;
DROP TABLE IF EXISTS purchase_receipt_items;
DROP TABLE IF EXISTS purchase_receipts;
DROP TABLE IF EXISTS purchase_payments;
DROP TABLE IF EXISTS purchase_order_items;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS product_field_values;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS material_field_values;
DROP TABLE IF EXISTS materials;
DROP TABLE IF EXISTS template_fields;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS category_fields;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS specifications;
DROP TABLE IF EXISTS designs;
DROP TABLE IF EXISTS units;
DROP TABLE IF EXISTS sizes;
DROP TABLE IF EXISTS colors;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS company_settings;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------
-- 1. AUTHENTICATION & ACCESS CONTROL
-- ----------------------------------------------------------
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NULL,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 2. DYNAMIC CATEGORY & TEMPLATE ENGINE
-- ----------------------------------------------------------
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    type ENUM('order', 'material', 'product', 'process') NOT NULL,
    description TEXT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE category_fields (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_label VARCHAR(150) NOT NULL,
    field_type ENUM('text', 'number', 'decimal', 'select', 'textarea', 'date', 'checkbox', 'calculated') NOT NULL DEFAULT 'text',
    is_required BOOLEAN DEFAULT FALSE,
    is_visible BOOLEAN DEFAULT TRUE,
    is_readonly BOOLEAN DEFAULT FALSE,
    default_value VARCHAR(255) NULL,
    options JSON NULL,
    calculation_formula VARCHAR(255) NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    INDEX idx_category_fields_cat (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE templates (
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

CREATE TABLE template_fields (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_id INT NOT NULL,
    category_field_id INT NOT NULL,
    sort_order INT DEFAULT 0,
    is_required BOOLEAN DEFAULT FALSE,
    column_width INT DEFAULT 120,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    FOREIGN KEY (category_field_id) REFERENCES category_fields(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 3. STANDARD MASTERS
-- ----------------------------------------------------------
CREATE TABLE units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE colors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    hex_code VARCHAR(10) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sizes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE designs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE specifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    spec_value VARCHAR(255) NOT NULL,
    category_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100) NULL,
    phone VARCHAR(25) NOT NULL,
    email VARCHAR(100) NULL,
    address TEXT NULL,
    gstin VARCHAR(30) NULL,
    payment_terms_days INT DEFAULT 30,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100) NULL,
    phone VARCHAR(25) NOT NULL,
    email VARCHAR(100) NULL,
    billing_address TEXT NULL,
    shipping_address TEXT NULL,
    gstin VARCHAR(30) NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    avatar_style VARCHAR(50) DEFAULT 'lorelei',
    avatar_seed VARCHAR(100) NULL,
    avatar_config LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 4. MATERIAL & PRODUCT MASTERS (DYNAMIC VALUES)
-- ----------------------------------------------------------
CREATE TABLE materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    supplier_id INT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    uom VARCHAR(20) NOT NULL DEFAULT 'KG',
    hsn_code VARCHAR(20) NULL,
    purchase_rate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
    min_stock_level DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    current_stock DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    INDEX idx_material_cat (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE material_field_values (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    category_field_id INT NOT NULL,
    field_value TEXT NULL,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (category_field_id) REFERENCES category_fields(id) ON DELETE CASCADE,
    UNIQUE KEY uq_material_field (material_id, category_field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    design VARCHAR(100) NULL,
    uom VARCHAR(20) NOT NULL DEFAULT 'PCS',
    selling_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
    image_url LONGTEXT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_product_cat (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_field_values (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    category_field_id INT NOT NULL,
    field_value TEXT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (category_field_id) REFERENCES category_fields(id) ON DELETE CASCADE,
    UNIQUE KEY uq_product_field (product_id, category_field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 5. BILL OF MATERIALS (BOM)
-- ----------------------------------------------------------
CREATE TABLE boms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    batch_size INT NOT NULL DEFAULT 1,
    status ENUM('active', 'archived') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bom_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bom_id INT NOT NULL,
    material_id INT NOT NULL,
    quantity_required DECIMAL(12, 4) NOT NULL,
    uom VARCHAR(20) NOT NULL,
    wastage_percent DECIMAL(5, 2) DEFAULT 0.00,
    FOREIGN KEY (bom_id) REFERENCES boms(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 6. PURCHASE MANAGEMENT & RECEIPTS
-- ----------------------------------------------------------
CREATE TABLE purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_number VARCHAR(50) NOT NULL UNIQUE,
    category_id INT NOT NULL,
    supplier_id INT NOT NULL,
    po_date DATE NOT NULL,
    delivery_due_date DATE NULL,
    payment_due_date DATE NULL,
    subtotal DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    net_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    balance_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(50) DEFAULT 'Unpaid',
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    ordered_at TIMESTAMP NULL,
    created_by_user_id INT NULL,
    remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_po_supplier (supplier_id),
    INDEX idx_po_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id INT NOT NULL,
    material_id INT NULL,
    line_number INT NOT NULL DEFAULT 1,
    item_description VARCHAR(255) NOT NULL,
    spec VARCHAR(150) NULL,
    design VARCHAR(100) NULL,
    color VARCHAR(100) NULL,
    size VARCHAR(50) NULL,
    uom VARCHAR(20) NOT NULL DEFAULT 'KG',
    quantity DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    weight_kg DECIMAL(12, 2) NULL,
    received_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    rate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    taxable_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    net_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    dynamic_data JSON NULL,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL,
    INDEX idx_poi_order (purchase_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id INT NOT NULL,
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    payment_date DATE NOT NULL,
    amount DECIMAL(14, 2) NOT NULL,
    payment_mode ENUM('NEFT', 'RTGS', 'UPI', 'Cheque', 'Cash', 'Other') DEFAULT 'NEFT',
    reference_number VARCHAR(100) NULL,
    notes TEXT NULL,
    recorded_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_no VARCHAR(50) NOT NULL UNIQUE,
    purchase_order_id INT NOT NULL,
    receipt_date DATE NOT NULL,
    delivery_challan_no VARCHAR(100) NULL,
    vehicle_no VARCHAR(50) NULL,
    received_by_user_id INT NULL,
    remarks TEXT NULL,
    status ENUM('Verified', 'Pending Inspection') DEFAULT 'Verified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (received_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_receipt_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_receipt_id INT NOT NULL,
    purchase_order_item_id INT NOT NULL,
    material_id INT NOT NULL,
    quantity_received DECIMAL(12, 2) NOT NULL,
    weight_received DECIMAL(12, 2) NULL,
    lot_number VARCHAR(50) NULL,
    accepted_quantity DECIMAL(12, 2) NOT NULL,
    rejected_quantity DECIMAL(12, 2) DEFAULT 0.00,
    remarks VARCHAR(255) NULL,
    FOREIGN KEY (purchase_receipt_id) REFERENCES purchase_receipts(id) ON DELETE CASCADE,
    FOREIGN KEY (purchase_order_item_id) REFERENCES purchase_order_items(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_returns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    return_no VARCHAR(50) NOT NULL UNIQUE,
    purchase_order_id INT NOT NULL,
    material_id INT NOT NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    reason TEXT NOT NULL,
    return_date DATE NOT NULL,
    status ENUM('PENDING', 'ACCEPTED', 'REPLACED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
    FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 7. INVENTORY LEDGER & STOCK
-- ----------------------------------------------------------
CREATE TABLE stock_balances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL UNIQUE,
    current_quantity DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    reserved_quantity DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    available_quantity DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    transaction_type ENUM('STOCK IN', 'STOCK OUT', 'PURCHASE RECEIPT', 'MATERIAL CONSUMPTION', 'STOCK ADJUSTMENT', 'DAMAGE', 'RETURN') NOT NULL,
    reference_type VARCHAR(50) NULL,
    reference_id INT NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    previous_stock DECIMAL(12, 2) NOT NULL,
    new_stock DECIMAL(12, 2) NOT NULL,
    notes TEXT NULL,
    user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_inv_tx_mat (material_id),
    INDEX idx_inv_tx_type (transaction_type),
    INDEX idx_inv_tx_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_adjustments (
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

-- ----------------------------------------------------------
-- 8. PRODUCTION STAGES & ORDERS
-- ----------------------------------------------------------
CREATE TABLE production_stages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    sequence_order INT NOT NULL,
    description TEXT NULL,
    color_badge VARCHAR(20) DEFAULT '#0284c7',
    is_qc_stage BOOLEAN DEFAULT FALSE,
    is_final_stage BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE production_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    category_id INT NOT NULL,
    customer_id INT NULL,
    title VARCHAR(150) NOT NULL,
    priority ENUM('Low', 'Medium', 'High', 'Urgent') DEFAULT 'Medium',
    start_date DATE NOT NULL,
    target_delivery_date DATE NOT NULL,
    total_quantity INT NOT NULL DEFAULT 0,
    completed_quantity INT NOT NULL DEFAULT 0,
    status ENUM('DRAFT', 'CONFIRMED', 'IN PRODUCTION', 'QC', 'COMPLETED', 'CANCELLED') DEFAULT 'CONFIRMED',
    notes TEXT NULL,
    created_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_prod_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE production_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    production_order_id INT NOT NULL,
    product_id INT NOT NULL,
    color VARCHAR(50) NOT NULL,
    size VARCHAR(50) NOT NULL,
    total_quantity INT NOT NULL,
    current_stage_id INT NOT NULL,
    current_stage_quantity INT NOT NULL,
    completed_quantity INT NOT NULL DEFAULT 0,
    rejected_quantity INT NOT NULL DEFAULT 0,
    rework_quantity INT NOT NULL DEFAULT 0,
    status ENUM('Pending', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'In Progress',
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (current_stage_id) REFERENCES production_stages(id),
    INDEX idx_poi_order (production_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE production_stage_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    production_order_item_id INT NOT NULL,
    from_stage_id INT NOT NULL,
    to_stage_id INT NOT NULL,
    quantity_moved INT NOT NULL,
    operator_user_id INT NULL,
    remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (production_order_item_id) REFERENCES production_order_items(id) ON DELETE CASCADE,
    FOREIGN KEY (from_stage_id) REFERENCES production_stages(id),
    FOREIGN KEY (to_stage_id) REFERENCES production_stages(id),
    FOREIGN KEY (operator_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE qc_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    production_order_item_id INT NOT NULL,
    stage_id INT NOT NULL,
    input_quantity INT NOT NULL,
    passed_quantity INT NOT NULL,
    rejected_quantity INT NOT NULL DEFAULT 0,
    rework_quantity INT NOT NULL DEFAULT 0,
    pending_quantity INT NOT NULL DEFAULT 0,
    defect_reason VARCHAR(255) NULL,
    remarks TEXT NULL,
    inspector_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (production_order_item_id) REFERENCES production_order_items(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES production_stages(id),
    FOREIGN KEY (inspector_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rework_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    qc_record_id INT NOT NULL,
    production_order_item_id INT NOT NULL,
    rework_stage_id INT NOT NULL,
    quantity INT NOT NULL,
    status ENUM('IN REWORK', 'RESOLVED', 'SCRAPPED') DEFAULT 'IN REWORK',
    resolved_at TIMESTAMP NULL,
    resolution_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (qc_record_id) REFERENCES qc_records(id) ON DELETE CASCADE,
    FOREIGN KEY (production_order_item_id) REFERENCES production_order_items(id) ON DELETE CASCADE,
    FOREIGN KEY (rework_stage_id) REFERENCES production_stages(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 9. AUDIT LOGS & SETTINGS
-- ----------------------------------------------------------
CREATE TABLE audit_logs (
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

CREATE TABLE company_settings (
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

-- ==========================================================
-- 10. INITIAL SEED DATA
-- ==========================================================

-- Company Settings
INSERT INTO company_settings (id, company_name, tagline, address, phone, email, gstin)
VALUES (1, 'Cheran Soft Goods Private Limited', 'Premier Textile Manufacturing ERP', '124 Textile Park, Palladam Road, Tiruppur - 641604, Tamil Nadu', '+91 421 2478900', 'operations@cheransoftgoods.com', '33AABCC1234F1Z5')
ON DUPLICATE KEY UPDATE company_name = VALUES(company_name);

-- Roles
INSERT INTO roles (id, name, display_name, description) VALUES
(1, 'admin', 'System Administrator', 'Full access to all modules and configurations'),
(2, 'production_manager', 'Production Manager', 'Manages production orders, line routing, and floor tracking'),
(3, 'inventory_manager', 'Inventory Manager', 'Manages raw materials, stock ledger, and adjustments'),
(4, 'purchase_manager', 'Purchase Manager', 'Handles suppliers, purchase orders, receipts, and payments'),
(5, 'qc_inspector', 'QC Inspector', 'Performs stage inspections, defect recording, and rework routing')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

-- Default Admin User (Password: admin123)
INSERT INTO users (id, role_id, name, email, password_hash, status)
VALUES (1, 1, 'Cheran Administrator', 'admin@cheransoftgoods.com', '$2y$10$tZ2xS8uY7hVvM5vK2iL4U.m3a4j7g1w2e5r6t7y8u9i0o1p2q3r4s', 'active')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Production Stages (10 Core Stages)
INSERT INTO production_stages (id, code, name, sequence_order, standard_cycle_time_mins, color_badge, is_qc_stage, is_final_stage, status) VALUES
(1, 'REQ', 'Requirement Gathering', 1, 60, '#6366f1', 0, 0, 'active'),
(2, 'PO', 'Purchase Order (PO)', 2, 120, '#0284c7', 0, 0, 'active'),
(3, 'INW', 'Inward', 3, 60, '#0d9488', 0, 0, 'active'),
(4, 'DYE', 'Dyeing', 4, 240, '#7c3aed', 0, 0, 'active'),
(5, 'CUT', 'Cutting — Product-wise', 5, 180, '#d97706', 0, 0, 'active'),
(6, 'EMB', 'Embroidery — Outward / Inward', 6, 180, '#ec4899', 0, 0, 'active'),
(7, 'STI', 'Stitching — Color-wise Tracking', 7, 300, '#2563eb', 0, 0, 'active'),
(8, 'CHK', 'Checking', 8, 60, '#ef4444', 1, 0, 'active'),
(9, 'PCK', 'Packing', 9, 90, '#059669', 0, 0, 'active'),
(10, 'COMP', 'Completed', 10, 30, '#16a34a', 0, 1, 'active')
ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code), sequence_order = VALUES(sequence_order), color_badge = VALUES(color_badge), is_qc_stage = VALUES(is_qc_stage), is_final_stage = VALUES(is_final_stage);

-- Units of Measure
INSERT INTO units (id, code, name) VALUES
(1, 'KG', 'Kilograms'),
(2, 'MTR', 'Meters'),
(3, 'PCS', 'Pieces'),
(4, 'CONE', 'Cones'),
(5, 'ROLL', 'Rolls'),
(6, 'BOX', 'Boxes'),
(7, 'SET', 'Sets')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Colors
INSERT INTO colors (id, code, name, hex_code) VALUES
(1, 'COL-001', 'Jet Black', '#111827'),
(2, 'COL-002', 'Navy Blue', '#1e3a8a'),
(3, 'COL-003', 'Heather Grey', '#9ca3af'),
(4, 'COL-004', 'Pure White', '#ffffff'),
(5, 'COL-005', 'Forest Green', '#14532d'),
(6, 'COL-006', 'Burgundy Crimson', '#881337')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Sizes
INSERT INTO sizes (id, code, name, sort_order) VALUES
(1, 'XS', 'Extra Small', 1),
(2, 'S', 'Small', 2),
(3, 'M', 'Medium', 3),
(4, 'L', 'Large', 4),
(5, 'XL', 'Extra Large', 5),
(6, 'XXL', 'Double Extra Large', 6)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Designs
INSERT INTO designs (id, code, name, description) VALUES
(1, 'DSN-001', 'Classic Solid Plain', 'Solid piece dyed finish'),
(2, 'DSN-002', 'Breton Feeder Stripe', 'Yarn dyed circular knit stripe'),
(3, 'DSN-003', 'Vintage Melange Texture', 'Cross dyed poly-cotton effect'),
(4, 'DSN-004', 'Graphic Chest Typography', 'Discharge screen print design')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Categories
INSERT INTO categories (id, code, name, type, description) VALUES
(1, 'CAT_FABRIC', 'Fabric & Greige', 'material', 'Knitted and woven fabric lots'),
(2, 'CAT_YARN', 'Yarn & Thread', 'material', 'Spun cotton, polyester, and sewing yarns'),
(3, 'CAT_TRIMS', 'Trims & Accessories', 'material', 'Buttons, zippers, labels, and tapes'),
(4, 'CAT_PKG', 'Packaging Materials', 'material', 'Poly bags, cartons, and hang tags'),
(5, 'CAT_CHEM', 'Dyes & Chemicals', 'material', 'Reactive dyes and softening auxiliaries'),
(6, 'CAT_PO_FAB', 'Fabric PO', 'order', 'Fabric bulk purchase order workflow'),
(7, 'CAT_PO_TRIM', 'Trims PO', 'order', 'Trims procurement workflow'),
(8, 'CAT_APPAREL', 'Finished Apparel', 'product', 'Ready-to-wear finished garment products')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Category Fields
INSERT INTO category_fields (id, category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(1, 1, 'gsm', 'Fabric GSM', 'number', 1, 1, 1),
(2, 1, 'width_inches', 'Width (Inches)', 'number', 1, 1, 2),
(3, 1, 'composition', 'Composition', 'text', 1, 1, 3),
(4, 2, 'yarn_count', 'Yarn Count', 'text', 1, 1, 1),
(5, 2, 'twist_direction', 'Twist (S/Z)', 'select', 0, 1, 2)
ON DUPLICATE KEY UPDATE field_label = VALUES(field_label);

-- Suppliers
INSERT INTO suppliers (id, code, name, contact_person, phone, email, address, gstin, payment_terms_days) VALUES
(1, 'SUP-001', 'ABC Textiles Mills Ltd', 'Naveen Kumar', '+91 94432 11000', 'orders@abctextiles.in', '142 Mill Road, Tirupur, Tamil Nadu', '33AABCT1234F1Z9', 30),
(2, 'SUP-002', 'Sri Balaji Yarn Spinners', 'R. Balasubramaniam', '+91 94433 22000', 'sales@balajiyarn.com', '54 Palladam High Road, Coimbatore', '33AABCS4455G1Z5', 15),
(3, 'SUP-003', 'Apex Trims & Accessories', 'Mohit Shah', '+91 98201 55440', 'mohit@apextrims.com', '78 Industrial Estate, Erode', '33AACCA9988H1Z2', 45)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Customers
INSERT INTO customers (id, code, name, contact_person, phone, email, billing_address, gstin) VALUES
(1, 'CUST-001', 'Heritage Home Linen LLC', 'David Miller', '+1 415 555 2671', 'procurement@heritagelinen.com', '850 Market Street, San Francisco, CA', '06AAACH1234D1ZQ'),
(2, 'CUST-002', 'Prestige Hospitality Group', 'A. Ramakrishnan', '+91 98410 77889', 'sourcing@prestigehospitality.in', 'MG Road, Bengaluru, Karnataka', '29AAACP8877K1ZZ'),
(3, 'CUST-003', 'Zara Living Exports', 'K. Anand', '+91 97890 12345', 'anand@zaraliving.in', 'Exports Enclave, Chennai, Tamil Nadu', '33AAACZ7766L1ZX')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Materials
INSERT INTO materials (id, category_id, supplier_id, code, name, uom, purchase_rate, tax_percent, min_stock_level, current_stock) VALUES
(1, 1, 1, 'MAT-1001', '100% Combed Cotton 30s Single Jersey', 'KG', 340.00, 5.00, 100.00, 450.00),
(2, 1, 1, 'MAT-1002', 'Cotton Poly French Terry 280 GSM', 'KG', 420.00, 5.00, 80.00, 320.00),
(3, 2, 2, 'MAT-1003', '2/20s Spun Polyester Sewing Thread', 'CONE', 85.00, 12.00, 50.00, 140.00),
(4, 2, 2, 'MAT-1004', '100% Organic Ring-Spun Greige Yarn', 'KG', 290.00, 5.00, 200.00, 180.00),
(5, 3, 3, 'MAT-1005', 'Nylon Metaluxe Zipper 60cm', 'PCS', 18.50, 18.00, 500.00, 1200.00),
(6, 4, 3, 'MAT-1006', 'Recycled Biodegradable Poly Bag 12x18', 'PCS', 4.20, 18.00, 1000.00, 3500.00)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Products
INSERT INTO products (id, category_id, code, name, design, uom, selling_price, tax_percent, status) VALUES
(1, 8, 'PRD-001', 'Classic Crew Neck T-Shirt', 'Solid Minimalist', 'PCS', 285.00, 5.00, 'active'),
(2, 8, 'PRD-002', 'French Terry Hooded Sweatshirt', 'Raglan Sleeve Kangaroo Pocket', 'PCS', 650.00, 5.00, 'active'),
(3, 8, 'PRD-003', 'Cotton Pique Polo Shirt', '2-Button Ribbed Collar', 'PCS', 420.00, 5.00, 'active'),
(4, 8, 'PRD-004', 'Heavyweight Fleece Jogger Pant', 'Elasticated Ankle Cuff', 'PCS', 520.00, 5.00, 'active')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ----------------------------------------------------------
-- 13. BUYER PRODUCTS & PACKING CONFIGURATION
-- ----------------------------------------------------------
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

