-- ==============================================================================
-- Migration: Remove Size Field from Production Orders Module
-- Date: 2026-10-15
-- Objective:
--   1. Drop foreign key constraint on products(id) so buyer products can be safely referenced.
--   2. Drop the unused 'size' column from production_order_items table.
--   3. Maintain backup table for historical rollback.
-- ==============================================================================

-- Backup existing data before modification
CREATE TABLE IF NOT EXISTS `production_order_items_backup` LIKE `production_order_items`;
INSERT IGNORE INTO `production_order_items_backup` SELECT * FROM `production_order_items`;

-- Step 1: Drop foreign key constraint on product_id referencing products(id) if present
-- (Allows production orders to reference configured buyer_products)
SET @fk_exists = (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'production_order_items'
      AND CONSTRAINT_NAME = 'production_order_items_ibfk_2'
);
SET @drop_fk_sql = IF(@fk_exists > 0, 'ALTER TABLE production_order_items DROP FOREIGN KEY production_order_items_ibfk_2', 'SELECT 1');
PREPARE stmt_fk FROM @drop_fk_sql;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- Step 2: Drop the 'size' column from production_order_items
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'production_order_items'
      AND COLUMN_NAME = 'size'
);
SET @drop_col_sql = IF(@col_exists > 0, 'ALTER TABLE production_order_items DROP COLUMN size', 'SELECT 1');
PREPARE stmt_col FROM @drop_col_sql;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- ==============================================================================
-- ROLLBACK / REVERSIBLE PROCEDURE:
-- To revert this migration, run:
--   ALTER TABLE production_order_items ADD COLUMN size VARCHAR(20) NULL DEFAULT NULL AFTER color;
--   UPDATE production_order_items poi
--     JOIN production_order_items_backup b ON poi.id = b.id
--     SET poi.size = b.size;
--   ALTER TABLE production_order_items ADD CONSTRAINT production_order_items_ibfk_2 FOREIGN KEY (product_id) REFERENCES products (id);
-- ==============================================================================
