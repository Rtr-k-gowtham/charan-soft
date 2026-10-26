-- Add size column to quality_inspections and rework_records if missing
ALTER TABLE `quality_inspections` ADD COLUMN `size` VARCHAR(50) NULL AFTER `color`;
ALTER TABLE `rework_records` ADD COLUMN `size` VARCHAR(50) NULL AFTER `color`;
