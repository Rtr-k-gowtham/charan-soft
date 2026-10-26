-- =========================================================================
-- CHERAN SOFT GOODS - REWORK MANAGEMENT ACROSS FIVE PRODUCTION STAGES
-- Database Migration: Rework Records & Quality Reconciliation Schema
-- Stages: 04 Dyeing, 05 Cutting, 06 Embroidery, 07 Stitching, 08 Checking
-- Zero-Regression & Full Auditable Lifecycle Tracking
-- =========================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Ensure rework_records table exists with all required fields
CREATE TABLE IF NOT EXISTS `rework_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `production_order_id` INT NOT NULL,
  `production_order_item_id` INT NULL,
  `stage_id` INT NOT NULL,
  `stage_code` VARCHAR(20) NOT NULL,
  `rework_stage_id` INT NULL,
  `rework_order_no` VARCHAR(100) NOT NULL,
  `batch_number` VARCHAR(100) NULL,
  `reference_id` VARCHAR(100) NULL,
  `product_id` INT NULL,
  `product_name` VARCHAR(255) NULL,
  `color` VARCHAR(100) NULL,
  `size` VARCHAR(50) NULL,
  `uom` VARCHAR(50) DEFAULT 'Pieces',
  `rework_quantity` DECIMAL(12, 2) NOT NULL,
  `accepted_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `rejected_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `pending_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `defect_reason` VARCHAR(255) NULL,
  `defect_category` VARCHAR(100) NULL,
  `remarks` TEXT NULL,
  `destination_process` VARCHAR(255) NULL,
  `vendor_id` INT NULL,
  `vendor_name` VARCHAR(255) NULL,
  `status` VARCHAR(50) DEFAULT 'Pending Rework',
  `cycle_number` INT NOT NULL DEFAULT 1,
  `sent_date` DATE NULL,
  `received_date` DATE NULL,
  `reinspection_date` DATE NULL,
  `reinspection_result` VARCHAR(100) NULL,
  `reinspection_notes` TEXT NULL,
  `inspector_name` VARCHAR(150) NULL,
  `qc_record_id` INT NULL,
  `created_by_user_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_rwk_order` (`production_order_id`),
  INDEX `idx_rwk_stage` (`stage_id`),
  INDEX `idx_rwk_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Modify existing rework_records columns if table existed previously
ALTER TABLE `rework_records` MODIFY COLUMN `qc_record_id` INT NULL;
ALTER TABLE `rework_records` MODIFY COLUMN `rework_stage_id` INT NULL;
ALTER TABLE `rework_records` MODIFY COLUMN `status` VARCHAR(50) DEFAULT 'Pending Rework';

-- 3. Ensure dyeing_receipts and dyeing_orders have accepted/rework tracking columns
ALTER TABLE `dyeing_receipts` ADD COLUMN `total_accepted_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `total_received_quantity`;
ALTER TABLE `dyeing_receipts` ADD COLUMN `total_rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `total_accepted_quantity`;

ALTER TABLE `dyeing_orders` ADD COLUMN `total_accepted_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `total_received_quantity`;
ALTER TABLE `dyeing_orders` ADD COLUMN `total_rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `total_accepted_quantity`;

-- 4. Ensure cutting_batches has rework tracking columns
ALTER TABLE `cutting_batches` ADD COLUMN `rework_reason` VARCHAR(255) NULL AFTER `rework_quantity`;
ALTER TABLE `cutting_batches` ADD COLUMN `rework_status` VARCHAR(50) DEFAULT 'Pending Rework' AFTER `rework_reason`;

-- 5. Ensure stitching_batches has rework tracking columns
ALTER TABLE `stitching_batches` ADD COLUMN `rework_reason` VARCHAR(255) NULL AFTER `rework_quantity`;
ALTER TABLE `stitching_batches` ADD COLUMN `rework_status` VARCHAR(50) DEFAULT 'Pending Rework' AFTER `rework_reason`;

-- 6. Ensure quality_inspections has rework destination columns
ALTER TABLE `quality_inspections` ADD COLUMN `rework_destination_stage_id` INT NULL AFTER `rework_quantity`;
ALTER TABLE `quality_inspections` ADD COLUMN `rework_destination_name` VARCHAR(100) NULL AFTER `rework_destination_stage_id`;
ALTER TABLE `quality_inspections` ADD COLUMN `rework_status` VARCHAR(50) DEFAULT 'Pending Rework' AFTER `rework_destination_name`;

SET FOREIGN_KEY_CHECKS = 1;
