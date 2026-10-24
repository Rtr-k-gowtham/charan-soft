-- ==========================================================
-- CHERAN SOFT GOODS - PURCHASE ORDERS CANCEL & REISSUE COLUMNS
-- Database: u868013330_cheran
-- ==========================================================

ALTER TABLE `purchase_orders` ADD COLUMN `cancellation_reason` TEXT NULL;
ALTER TABLE `purchase_orders` ADD COLUMN `cancelled_at` DATETIME NULL;
ALTER TABLE `purchase_orders` ADD COLUMN `cancelled_by` VARCHAR(150) NULL;
ALTER TABLE `purchase_orders` ADD COLUMN `reissued_at` DATETIME NULL;
ALTER TABLE `purchase_orders` ADD COLUMN `reissued_by` VARCHAR(150) NULL;
