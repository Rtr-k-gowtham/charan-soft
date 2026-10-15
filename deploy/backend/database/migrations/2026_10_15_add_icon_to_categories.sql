-- Migration: Add icon column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT NULL AFTER description;

-- Update existing standard categories with designated icons
UPDATE categories SET icon = 'grid' WHERE code = 'CAT_WEAVING_ORDER' OR name LIKE '%WEAVING ORDER%';
UPDATE categories SET icon = 'repeat' WHERE code = 'CAT_FABRIC_WEAVING_PROC' OR name LIKE '%FABRIC WEAVING PROCESS%';
UPDATE categories SET icon = 'droplets' WHERE code = 'CAT_FABRIC_DYEING_PROC' OR name LIKE '%DYEING%';
UPDATE categories SET icon = 'sparkles' WHERE code = 'CAT_FABRIC_KITTY_JIGGAR' OR name LIKE '%KITTY%';
UPDATE categories SET icon = 'feather' WHERE code = 'CAT_FILLING_ORDER' OR name LIKE '%FILLING%';
UPDATE categories SET icon = 'shopping-bag' WHERE code = 'CAT_FABRIC_PO' OR name LIKE '%FABRIC PURCHASE%' OR name = 'FABRIC PO';
UPDATE categories SET icon = 'scissors' WHERE code = 'CAT_STITCHING_ORDER' OR name LIKE '%STICH%' OR name LIKE '%STITCH%';
UPDATE categories SET icon = 'tags' WHERE code = 'CAT_ACCESSORY_PO' OR name LIKE '%ACCESSORY%';
