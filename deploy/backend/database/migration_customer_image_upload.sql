-- ==============================================================================
-- Migration: Add image_url and avatar_url to customers table
-- Purpose: Persist custom logo and profile photo uploads in Buyer Master
-- ==============================================================================

-- 1. Add image_url and avatar_url columns if they don't already exist
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS image_url LONGTEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS avatar_url LONGTEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS avatar_style VARCHAR(50) DEFAULT 'lorelei',
    ADD COLUMN IF NOT EXISTS avatar_seed VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS avatar_config LONGTEXT DEFAULT NULL;

-- Note for older MySQL / MariaDB versions without IF NOT EXISTS:
-- ALTER TABLE customers ADD COLUMN image_url LONGTEXT NULL;
-- ALTER TABLE customers ADD COLUMN avatar_url LONGTEXT NULL;
-- ALTER TABLE customers ADD COLUMN avatar_style VARCHAR(50) DEFAULT 'lorelei';
-- ALTER TABLE customers ADD COLUMN avatar_seed VARCHAR(100) DEFAULT NULL;
-- ALTER TABLE customers ADD COLUMN avatar_config LONGTEXT DEFAULT NULL;

-- 2. Populate Vegetable Figures Organic Apparel record if missing
INSERT INTO customers (id, code, name, contact_person, phone, email, billing_address, gstin, city, state, status, avatar_style, avatar_seed)
SELECT 6, 'BUY-006', 'Vegetable Figures Organic Apparel', 'Kavitha Sundaram', '+91 98422 77112', 'sourcing@vegetablefigures.com', 'Plot No. 42, Green Earth Eco-Industrial Park, Angeripalayam Road, Tiruppur, Tamil Nadu - 641602', '33AABCV9812A1Z4', 'Tiruppur', 'Tamil Nadu', 'Active', 'lorelei', 'VegetableFigures-Lorelei-6'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE id = 6 OR code = 'BUY-006');
