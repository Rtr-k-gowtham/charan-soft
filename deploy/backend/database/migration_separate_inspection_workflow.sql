-- =========================================================================
-- CHERAN SOFT GOODS - SEPARATE INWARD RECEIPT, QUALITY INSPECTION & REWORK
-- Database Migration: Cross-Stage Inspection & Rework Decoupling
-- Stages: 04 Dyeing, 05 Cutting, 06 Embroidery, 07 Stitching, 08 Checking
-- =========================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Ensure quality_inspections table supports all 5 production stages
CREATE TABLE IF NOT EXISTS `quality_inspections` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `production_order_id` INT NOT NULL,
  `production_order_item_id` INT NOT NULL DEFAULT 0,
  `stage_id` INT NOT NULL DEFAULT 8,
  `stage_code` VARCHAR(20) DEFAULT 'CHK',
  `reference_id` VARCHAR(100) NULL,
  `reference_type` VARCHAR(100) NULL,
  `batch_number` VARCHAR(100) NULL,
  `submitted_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `checked_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `passed_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `failed_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `rejected_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `uom` VARCHAR(20) DEFAULT 'PCS',
  `defect_category` VARCHAR(100) NULL,
  `defect_description` TEXT NULL,
  `color` VARCHAR(100) NULL,
  `size` VARCHAR(50) NULL,
  `rework_destination` VARCHAR(100) NULL,
  `rework_reason` VARCHAR(255) NULL,
  `rework_stage_id` INT NULL,
  `rework_status` VARCHAR(50) DEFAULT 'Pending Rework',
  `inspector` VARCHAR(150) NULL,
  `inspection_date` DATE NOT NULL,
  `is_reinspection` TINYINT(1) DEFAULT 0,
  `original_inspection_id` INT NULL,
  `status` VARCHAR(50) DEFAULT 'Inspected',
  `remarks` TEXT NULL,
  `photo_urls` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_qi_ord` (`production_order_id`),
  INDEX `idx_qi_stage` (`stage_id`),
  INDEX `idx_qi_ref` (`reference_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add columns if quality_inspections already exists
ALTER TABLE `quality_inspections` ADD COLUMN IF NOT EXISTS `stage_id` INT NOT NULL DEFAULT 8 AFTER `production_order_item_id`;
ALTER TABLE `quality_inspections` ADD COLUMN IF NOT EXISTS `stage_code` VARCHAR(20) DEFAULT 'CHK' AFTER `stage_id`;
ALTER TABLE `quality_inspections` ADD COLUMN IF NOT EXISTS `reference_id` VARCHAR(100) NULL AFTER `stage_code`;
ALTER TABLE `quality_inspections` ADD COLUMN IF NOT EXISTS `reference_type` VARCHAR(100) NULL AFTER `reference_id`;
ALTER TABLE `quality_inspections` ADD COLUMN IF NOT EXISTS `uom` VARCHAR(20) DEFAULT 'PCS' AFTER `rejected_quantity`;
ALTER TABLE `quality_inspections` ADD COLUMN IF NOT EXISTS `rework_destination` VARCHAR(100) NULL AFTER `color`;
ALTER TABLE `quality_inspections` ADD COLUMN IF NOT EXISTS `rework_reason` VARCHAR(255) NULL AFTER `rework_destination`;
ALTER TABLE `quality_inspections` ADD COLUMN IF NOT EXISTS `status` VARCHAR(50) DEFAULT 'Inspected' AFTER `remarks`;

-- 3. Ensure dyeing_receipts inspection tracking columns
ALTER TABLE `dyeing_receipts` ADD COLUMN IF NOT EXISTS `inspection_status` VARCHAR(50) DEFAULT 'Pending Inspection' AFTER `total_rework_quantity`;

-- 4. Ensure cutting_batches inspection tracking columns
ALTER TABLE `cutting_batches` ADD COLUMN IF NOT EXISTS `inspection_status` VARCHAR(50) DEFAULT 'Pending Inspection' AFTER `accepted_output_quantity`;

-- 5. Ensure embroidery_receipts inspection tracking columns
ALTER TABLE `embroidery_receipts` ADD COLUMN IF NOT EXISTS `inspection_status` VARCHAR(50) DEFAULT 'Pending Inspection' AFTER `total_rework_qty`;

-- 6. Ensure stitching_batches inspection tracking columns
ALTER TABLE `stitching_batches` ADD COLUMN IF NOT EXISTS `inspection_status` VARCHAR(50) DEFAULT 'Pending Inspection' AFTER `accepted_quantity`;

SET FOREIGN_KEY_CHECKS = 1;
