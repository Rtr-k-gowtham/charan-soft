-- ==========================================================
-- CHERAN SOFT GOODS - FIX MISSING TABLES MIGRATION
-- Run this in phpMyAdmin (Database: u868013330_cheran)
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Create category_fields table (stores dynamic field definitions)
CREATE TABLE IF NOT EXISTS category_fields (
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

-- 2. Create material_field_values table (stores dynamic field values for materials)
CREATE TABLE IF NOT EXISTS material_field_values (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    category_field_id INT NOT NULL,
    field_value TEXT NULL,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (category_field_id) REFERENCES category_fields(id) ON DELETE CASCADE,
    UNIQUE KEY uq_material_field (material_id, category_field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create stock_balances table (stores live physical and available stocks)
CREATE TABLE IF NOT EXISTS stock_balances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL UNIQUE,
    current_quantity DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    reserved_quantity DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    available_quantity DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Sync Stock Balances for all existing materials
INSERT INTO stock_balances (material_id, current_quantity, available_quantity)
SELECT m.id, m.current_stock, m.current_stock
FROM materials m
ON DUPLICATE KEY UPDATE 
    current_quantity = VALUES(current_quantity),
    available_quantity = VALUES(available_quantity);

SET FOREIGN_KEY_CHECKS = 1;
