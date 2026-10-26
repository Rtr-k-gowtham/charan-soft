-- Migration: Fix rework_records columns and add Stage 04 -> Stage 05 transfer support
-- Date: 2026-10-26

-- Create table if not exists with all required fields
CREATE TABLE IF NOT EXISTS `rework_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rework_order_no` VARCHAR(100) NOT NULL DEFAULT '',
  `production_order_id` INT NOT NULL DEFAULT 0,
  `production_order_item_id` INT NULL,
  `stage_id` INT NOT NULL DEFAULT 4,
  `stage_code` VARCHAR(20) NOT NULL DEFAULT 'DYE',
  `qc_record_id` INT NULL,
  `product_id` INT NULL,
  `product_name` VARCHAR(255) NULL,
  `color` VARCHAR(100) NULL,
  `size` VARCHAR(50) NULL,
  `batch_number` VARCHAR(100) NULL,
  `rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `uom` VARCHAR(50) DEFAULT 'Pieces',
  `rework_reason` VARCHAR(255) NULL,
  `rework_remarks` TEXT NULL,
  `rework_stage_id` INT NULL,
  `destination_process` VARCHAR(255) NULL,
  `vendor_id` INT NULL,
  `vendor_name` VARCHAR(255) NULL,
  `dc_challan_no` VARCHAR(100) NULL,
  `sent_date` DATE NULL,
  `received_date` DATE NULL,
  `reinspection_date` DATE NULL,
  `reinspection_result` VARCHAR(100) NULL,
  `reinspection_notes` TEXT NULL,
  `inspector_name` VARCHAR(150) NULL,
  `accepted_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `rejected_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `pending_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `defect_reason` VARCHAR(255) NULL,
  `defect_category` VARCHAR(100) NULL,
  `remarks` TEXT NULL,
  `cycle_number` INT NOT NULL DEFAULT 1,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Pending Rework',
  `reference_type` VARCHAR(100) NULL,
  `reference_id` VARCHAR(100) NULL,
  `metadata_json` JSON NULL,
  `created_by_user_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_rr_pord` (`production_order_id`),
  INDEX `idx_rr_stage` (`stage_id`),
  INDEX `idx_rr_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stored procedure or direct ALTERs to add missing columns safely
SET @dbname = DATABASE();

-- Add production_order_id if missing
SET @query = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'rework_records' AND COLUMN_NAME = 'production_order_id') = 0,
    'ALTER TABLE rework_records ADD COLUMN production_order_id INT NOT NULL DEFAULT 0 AFTER rework_order_no',
    'SELECT "production_order_id already exists"'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add color if missing
SET @query = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'rework_records' AND COLUMN_NAME = 'color') = 0,
    'ALTER TABLE rework_records ADD COLUMN color VARCHAR(100) NULL AFTER product_name',
    'SELECT "color already exists"'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add size if missing
SET @query = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'rework_records' AND COLUMN_NAME = 'size') = 0,
    'ALTER TABLE rework_records ADD COLUMN size VARCHAR(50) NULL AFTER color',
    'SELECT "size already exists"'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add product_id if missing
SET @query = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'rework_records' AND COLUMN_NAME = 'product_id') = 0,
    'ALTER TABLE rework_records ADD COLUMN product_id INT NULL AFTER qc_record_id',
    'SELECT "product_id already exists"'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add product_name if missing
SET @query = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'rework_records' AND COLUMN_NAME = 'product_name') = 0,
    'ALTER TABLE rework_records ADD COLUMN product_name VARCHAR(255) NULL AFTER product_id',
    'SELECT "product_name already exists"'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add uom if missing
SET @query = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'rework_records' AND COLUMN_NAME = 'uom') = 0,
    'ALTER TABLE rework_records ADD COLUMN uom VARCHAR(50) DEFAULT "Pieces" AFTER rework_quantity',
    'SELECT "uom already exists"'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add quantity if missing
SET @query = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'rework_records' AND COLUMN_NAME = 'quantity') = 0,
    'ALTER TABLE rework_records ADD COLUMN quantity DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER rework_quantity',
    'SELECT "quantity already exists"'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add defect_reason if missing
SET @query = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'rework_records' AND COLUMN_NAME = 'defect_reason') = 0,
    'ALTER TABLE rework_records ADD COLUMN defect_reason VARCHAR(255) NULL',
    'SELECT "defect_reason already exists"'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add defect_category if missing
SET @query = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'rework_records' AND COLUMN_NAME = 'defect_category') = 0,
    'ALTER TABLE rework_records ADD COLUMN defect_category VARCHAR(100) NULL',
    'SELECT "defect_category already exists"'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add remarks if missing
SET @query = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'rework_records' AND COLUMN_NAME = 'remarks') = 0,
    'ALTER TABLE rework_records ADD COLUMN remarks TEXT NULL',
    'SELECT "remarks already exists"'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add created_by_user_id if missing
SET @query = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'rework_records' AND COLUMN_NAME = 'created_by_user_id') = 0,
    'ALTER TABLE rework_records ADD COLUMN created_by_user_id INT NULL',
    'SELECT "created_by_user_id already exists"'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
