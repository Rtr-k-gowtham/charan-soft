-- ==========================================================
-- CHERAN SOFT GOODS - FIX PRODUCTION ORDERS COLUMNS
-- Run this in phpMyAdmin (Database: u868013330_cheran)
-- ==========================================================

-- 1. Add missing category_id to production_orders (Fixes: Unknown column 'po.category_id')
ALTER TABLE production_orders ADD COLUMN category_id INT NOT NULL DEFAULT 1;

-- 2. Optional: Add foreign key to categories if categories table is populated
-- ALTER TABLE production_orders ADD CONSTRAINT fk_prod_order_cat FOREIGN KEY (category_id) REFERENCES categories(id);
