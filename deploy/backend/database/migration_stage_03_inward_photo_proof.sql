-- ==============================================================================
-- CHERAN SOFT GOODS ERP - Migration: Stage 03 Inward & Photo Proof Support
-- Run this in phpMyAdmin or MySQL console on your database
-- ==============================================================================

-- 1. Ensure purchase_receipts has photo proof, received_by, and condition_status columns
ALTER TABLE `purchase_receipts`
  ADD COLUMN IF NOT EXISTS `photo_url` LONGTEXT NULL AFTER `remarks`,
  ADD COLUMN IF NOT EXISTS `received_by` VARCHAR(255) NULL AFTER `vehicle_no`,
  ADD COLUMN IF NOT EXISTS `condition_status` VARCHAR(100) NULL DEFAULT 'Good & Verified' AFTER `received_by`;

-- 2. Ensure purchase_orders has production_order_id linking it to production orders
ALTER TABLE `purchase_orders`
  ADD COLUMN IF NOT EXISTS `production_order_id` INT NULL AFTER `remarks`;

-- Create index for faster PO lookups by production order
CREATE INDEX IF NOT EXISTS `idx_po_production_order_id` ON `purchase_orders` (`production_order_id`);

-- 3. Ensure Stage 03 is officially named "Inward" in production_stages
UPDATE `production_stages`
SET `name` = 'Inward',
    `code` = 'INW',
    `sequence_order` = 3,
    `status` = 'active'
WHERE `sequence_order` = 3 OR `code` = 'INW';

-- If Stage 03 doesn't exist, insert it
INSERT INTO `production_stages` (`id`, `code`, `name`, `sequence_order`, `standard_cycle_time_mins`, `color_badge`, `status`, `is_qc_stage`, `is_final_stage`)
SELECT 3, 'INW', 'Inward', 3, 60, '#6366f1', 'active', 0, 0
WHERE NOT EXISTS (SELECT 1 FROM `production_stages` WHERE `code` = 'INW' OR `id` = 3);
