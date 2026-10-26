-- Migration: Remove fabric_material_id from dyeing_orders table
-- Date: 2026-10-26

SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'dyeing_orders' 
      AND COLUMN_NAME = 'fabric_material_id'
);

SET @stmt = IF(@col_exists > 0, 'ALTER TABLE `dyeing_orders` DROP COLUMN `fabric_material_id`', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

ALTER TABLE `dyeing_orders` MODIFY COLUMN `fabric_name` VARCHAR(255) NULL DEFAULT 'Fabric Material';
