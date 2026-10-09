-- ==========================================================
-- CHERAN SOFT GOODS - FIX PURCHASE ORDER ITEMS COLUMNS
-- Run this in phpMyAdmin (Database: u868013330_cheran)
-- ==========================================================

-- 1. Add line_number (Fixes: Unknown column 'line_number' in 'INSERT INTO')
ALTER TABLE purchase_order_items ADD COLUMN line_number INT NOT NULL DEFAULT 1;

-- 2. Add other item fields if missing
ALTER TABLE purchase_order_items ADD COLUMN spec VARCHAR(150) NULL;
ALTER TABLE purchase_order_items ADD COLUMN weight_kg DECIMAL(12, 2) NULL;
ALTER TABLE purchase_order_items ADD COLUMN received_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE purchase_order_items ADD COLUMN taxable_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE purchase_order_items ADD COLUMN tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE purchase_order_items ADD COLUMN tax_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE purchase_order_items ADD COLUMN net_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE purchase_order_items ADD COLUMN dynamic_data JSON NULL;
