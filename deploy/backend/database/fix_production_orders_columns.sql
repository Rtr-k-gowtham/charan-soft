-- ==========================================================
-- CHERAN SOFT GOODS - FIX PRODUCTION ORDERS COLUMNS
-- ==========================================================

-- 1. Add missing category_id to production_orders (Fixes: Unknown column 'po.category_id')
-- ALTER TABLE production_orders ADD COLUMN category_id INT NOT NULL DEFAULT 1;

-- 2. Add total_quantity, completed_quantity, notes to production_orders
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS total_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS completed_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS notes TEXT NULL;
