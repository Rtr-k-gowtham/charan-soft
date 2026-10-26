-- =========================================================================
-- CHERAN SOFT GOODS - REWORK RECORDS & STAGE TRANSFER MIGRATION
-- Fixes missing columns in rework_records (color, production_order_id, etc.)
-- Ensures seamless cross-stage rework logging across Stages 04 to 08
-- =========================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Ensure rework_records table exists with all required fields
CREATE TABLE IF NOT EXISTS `rework_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rework_order_no` VARCHAR(100) NOT NULL DEFAULT '',
  `production_order_id` INT NOT NULL DEFAULT 0,
  `production_order_item_id` INT NULL,
  `stage_id` INT NOT NULL DEFAULT 4,
  `stage_code` VARCHAR(20) NOT NULL DEFAULT 'DYE',
  `rework_stage_id` INT NULL,
  `qc_record_id` INT NULL,
  `batch_number` VARCHAR(100) NULL,
  `reference_id` VARCHAR(100) NULL,
  `reference_type` VARCHAR(100) NULL,
  `product_id` INT NULL,
  `product_name` VARCHAR(255) NULL,
  `color` VARCHAR(100) NULL,
  `size` VARCHAR(50) NULL,
  `uom` VARCHAR(50) DEFAULT 'Pieces',
  `rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `accepted_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `rejected_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `pending_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `defect_reason` VARCHAR(255) NULL,
  `rework_reason` VARCHAR(255) NULL,
  `defect_category` VARCHAR(100) NULL,
  `remarks` TEXT NULL,
  `rework_remarks` TEXT NULL,
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
  `cycle_number` INT NOT NULL DEFAULT 1,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Pending Rework',
  `metadata_json` JSON NULL,
  `created_by_user_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_rwk_order` (`production_order_id`),
  INDEX `idx_rwk_stage` (`stage_id`),
  INDEX `idx_rwk_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Stored procedure to safely add missing columns if table already existed
DROP PROCEDURE IF EXISTS CSG_AddColumnSafely;
DELIMITER $$
CREATE PROCEDURE CSG_AddColumnSafely(
    IN tableName VARCHAR(64),
    IN colName VARCHAR(64),
    IN colDef TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = tableName 
        AND COLUMN_NAME = colName
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', tableName, '` ADD COLUMN `', colName, '` ', colDef);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL CSG_AddColumnSafely('rework_records', 'production_order_id', 'INT NOT NULL DEFAULT 0');
CALL CSG_AddColumnSafely('rework_records', 'production_order_item_id', 'INT NULL');
CALL CSG_AddColumnSafely('rework_records', 'stage_id', 'INT NOT NULL DEFAULT 4');
CALL CSG_AddColumnSafely('rework_records', 'stage_code', 'VARCHAR(20) NOT NULL DEFAULT "DYE"');
CALL CSG_AddColumnSafely('rework_records', 'rework_stage_id', 'INT NULL');
CALL CSG_AddColumnSafely('rework_records', 'rework_order_no', 'VARCHAR(100) NOT NULL DEFAULT ""');
CALL CSG_AddColumnSafely('rework_records', 'batch_number', 'VARCHAR(100) NULL');
CALL CSG_AddColumnSafely('rework_records', 'reference_id', 'VARCHAR(100) NULL');
CALL CSG_AddColumnSafely('rework_records', 'reference_type', 'VARCHAR(100) NULL');
CALL CSG_AddColumnSafely('rework_records', 'product_id', 'INT NULL');
CALL CSG_AddColumnSafely('rework_records', 'product_name', 'VARCHAR(255) NULL');
CALL CSG_AddColumnSafely('rework_records', 'color', 'VARCHAR(100) NULL');
CALL CSG_AddColumnSafely('rework_records', 'size', 'VARCHAR(50) NULL');
CALL CSG_AddColumnSafely('rework_records', 'uom', 'VARCHAR(50) DEFAULT "Pieces"');
CALL CSG_AddColumnSafely('rework_records', 'rework_quantity', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00');
CALL CSG_AddColumnSafely('rework_records', 'quantity', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00');
CALL CSG_AddColumnSafely('rework_records', 'accepted_quantity', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00');
CALL CSG_AddColumnSafely('rework_records', 'rejected_quantity', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00');
CALL CSG_AddColumnSafely('rework_records', 'pending_quantity', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00');
CALL CSG_AddColumnSafely('rework_records', 'defect_reason', 'VARCHAR(255) NULL');
CALL CSG_AddColumnSafely('rework_records', 'rework_reason', 'VARCHAR(255) NULL');
CALL CSG_AddColumnSafely('rework_records', 'defect_category', 'VARCHAR(100) NULL');
CALL CSG_AddColumnSafely('rework_records', 'remarks', 'TEXT NULL');
CALL CSG_AddColumnSafely('rework_records', 'rework_remarks', 'TEXT NULL');
CALL CSG_AddColumnSafely('rework_records', 'destination_process', 'VARCHAR(255) NULL');
CALL CSG_AddColumnSafely('rework_records', 'vendor_id', 'INT NULL');
CALL CSG_AddColumnSafely('rework_records', 'vendor_name', 'VARCHAR(255) NULL');
CALL CSG_AddColumnSafely('rework_records', 'dc_challan_no', 'VARCHAR(100) NULL');
CALL CSG_AddColumnSafely('rework_records', 'sent_date', 'DATE NULL');
CALL CSG_AddColumnSafely('rework_records', 'received_date', 'DATE NULL');
CALL CSG_AddColumnSafely('rework_records', 'reinspection_date', 'DATE NULL');
CALL CSG_AddColumnSafely('rework_records', 'reinspection_result', 'VARCHAR(100) NULL');
CALL CSG_AddColumnSafely('rework_records', 'reinspection_notes', 'TEXT NULL');
CALL CSG_AddColumnSafely('rework_records', 'inspector_name', 'VARCHAR(150) NULL');
CALL CSG_AddColumnSafely('rework_records', 'cycle_number', 'INT NOT NULL DEFAULT 1');
CALL CSG_AddColumnSafely('rework_records', 'status', 'VARCHAR(50) NOT NULL DEFAULT "Pending Rework"');
CALL CSG_AddColumnSafely('rework_records', 'metadata_json', 'JSON NULL');
CALL CSG_AddColumnSafely('rework_records', 'created_by_user_id', 'INT NULL');
CALL CSG_AddColumnSafely('rework_records', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

DROP PROCEDURE IF EXISTS CSG_AddColumnSafely;

-- 3. Relax legacy constraints
ALTER TABLE `rework_records` MODIFY COLUMN `qc_record_id` INT NULL;
ALTER TABLE `rework_records` MODIFY COLUMN `production_order_item_id` INT NULL;
ALTER TABLE `rework_records` MODIFY COLUMN `rework_stage_id` INT NULL;
ALTER TABLE `rework_records` MODIFY COLUMN `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE `rework_records` MODIFY COLUMN `status` VARCHAR(50) DEFAULT 'Pending Rework';

SET FOREIGN_KEY_CHECKS = 1;
