-- Migration: Create po_excluded_materials table to track required materials excluded/removed from Purchase Orders
-- Date: 2026-10-26

CREATE TABLE IF NOT EXISTS `po_excluded_materials` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `production_order_id` INT NOT NULL,
  `purchase_order_id` INT NULL,
  `purchase_order_number` VARCHAR(100) NULL,
  `material_id` INT NULL,
  `material_code` VARCHAR(50) NULL,
  `material_name` VARCHAR(150) NOT NULL,
  `category_name` VARCHAR(100) NULL,
  `uom` VARCHAR(20) NOT NULL DEFAULT 'PCS',
  `required_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `excluded_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `supplier_id` INT NULL,
  `supplier_name` VARCHAR(150) NULL,
  `reason` VARCHAR(255) DEFAULT 'Removed from purchase order before issuance',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_po_excl_pord` (`production_order_id`),
  INDEX `idx_po_excl_po` (`purchase_order_id`),
  INDEX `idx_po_excl_mat` (`material_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
