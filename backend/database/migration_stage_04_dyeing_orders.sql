-- ==========================================================
-- CHERAN SOFT GOODS - STAGE 04: DYEING ORDERS & INWARD SCHEMA
-- Database: cheran_erp / u868013330_cheran
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Table for Outward Dyeing Orders
CREATE TABLE IF NOT EXISTS `dyeing_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `dyeing_order_no` VARCHAR(50) NOT NULL UNIQUE,
  `production_order_id` INT NOT NULL,
  `fabric_material_id` INT NULL,
  `fabric_name` VARCHAR(255) NOT NULL,
  `fabric_code` VARCHAR(50) NULL,
  `uom` VARCHAR(20) DEFAULT 'MTR',
  `supplier_id` INT NULL,
  `dyeing_mill_name` VARCHAR(255) NULL,
  `challan_no` VARCHAR(100) NULL,
  `order_date` DATE NOT NULL,
  `expected_delivery_date` DATE NULL,
  `total_fabric_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total_received_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `status` ENUM('Sent to Dyeing', 'In Process', 'Partially Received', 'Received', 'Cancelled') DEFAULT 'Sent to Dyeing',
  `process_type` VARCHAR(100) DEFAULT 'Fabric Dyeing',
  `remarks` TEXT NULL,
  `created_by_user_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL,
  INDEX `idx_dye_po` (`production_order_id`),
  INDEX `idx_dye_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Line Items Breakdown per Color with Pantone Codes
CREATE TABLE IF NOT EXISTS `dyeing_order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `dyeing_order_id` INT NOT NULL,
  `color_id` INT NULL,
  `color_name` VARCHAR(100) NOT NULL,
  `pantone_code` VARCHAR(100) NULL,
  `hex_code` VARCHAR(20) NULL,
  `planned_quantity` DECIMAL(12, 2) NOT NULL,
  `received_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `rate_per_unit` DECIMAL(10, 2) DEFAULT 0.00,
  `shrinkage_loss_percent` DECIMAL(5, 2) DEFAULT 0.00,
  `shade_match_status` VARCHAR(50) DEFAULT 'Pending',
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_doi_order` (`dyeing_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Receipts & Inward from Dyeing Mill with Photo Proof
CREATE TABLE IF NOT EXISTS `dyeing_receipts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `receipt_no` VARCHAR(50) NOT NULL UNIQUE,
  `dyeing_order_id` INT NOT NULL,
  `production_order_id` INT NOT NULL,
  `receipt_date` DATE NOT NULL,
  `delivery_challan_no` VARCHAR(100) NULL,
  `received_by` VARCHAR(255) NULL,
  `total_received_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `photo_url` LONGTEXT NULL,
  `shade_condition` VARCHAR(100) DEFAULT 'Approved - Pantone Matched',
  `remarks` TEXT NULL,
  `items_data` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_dr_order` (`dyeing_order_id`),
  INDEX `idx_dr_po` (`production_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
