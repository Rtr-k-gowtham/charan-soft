-- ==========================================================
-- CHERAN SOFT GOODS - SEED DATA: RAW MATERIALS MASTER
-- Matched to Active Database Categories from categories.sql
-- ==========================================================
-- Category Mapping:
--   Category ID 6 : FABRIC PURCHASE ORDER (CAT_FABRIC_PO)
--   Category ID 8 : ACCESSORY PURCHASE ORDER (CAT_ACCESSORY_PO)
--   Category ID 5 : FILLING ORDER (CAT_FILLING_ORDER)
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------
-- Insert Clean Raw Materials Master
-- ----------------------------------------------------------
INSERT INTO `materials` (
    `id`, 
    `category_id`, 
    `supplier_id`, 
    `code`, 
    `name`, 
    `uom`, 
    `purchase_rate`, 
    `tax_percent`, 
    `min_stock_level`, 
    `current_stock`, 
    `status`, 
    `created_at`, 
    `updated_at`, 
    `deleted_at`
) VALUES
-- ----------------------------------------------------------
-- 1. FABRICS -> Category ID 6: FABRIC PURCHASE ORDER
-- ----------------------------------------------------------
(86, 6, 1, 'MAT-FAB-001', 'Cotton Fabric', 'MTR', 160.00, 5.00, 200.00, 6.00, 'active', NOW(), NOW(), NULL),
(87, 6, 1, 'MAT-FAB-002', 'Linen Fabric', 'MTR', 320.00, 5.00, 100.00, 0.00, 'active', NOW(), NOW(), NULL),
(88, 6, 1, 'MAT-FAB-003', 'Velvet Fabric', 'MTR', 280.00, 5.00, 80.00, 0.00, 'active', NOW(), NOW(), NULL),
(89, 6, 1, 'MAT-FAB-004', 'Canvas Fabric', 'MTR', 210.00, 5.00, 150.00, 80.00, 'active', NOW(), NOW(), NULL),

-- ----------------------------------------------------------
-- 2. SEWING & TRIMS -> Category ID 8: ACCESSORY PURCHASE ORDER
-- ----------------------------------------------------------
(90, 8, 3, 'MAT-SEW-001', 'Sewing Thread', 'CONE', 65.00, 12.00, 50.00, 0.00, 'active', NOW(), NOW(), NULL),
(91, 8, 3, 'MAT-SEW-002', 'Overlock Thread', 'CONE', 55.00, 12.00, 40.00, 0.00, 'active', NOW(), NOW(), NULL),
(92, 8, 3, 'MAT-SEW-003', 'Elastic', 'MTR', 8.50, 12.00, 300.00, 17.00, 'active', NOW(), NOW(), NULL),
(93, 8, 3, 'MAT-SEW-004', 'Zipper', 'PCS', 12.00, 18.00, 500.00, 2000.00, 'active', NOW(), NOW(), NULL),
(94, 8, 3, 'MAT-SEW-005', 'Velcro', 'MTR', 15.00, 12.00, 100.00, 0.00, 'active', NOW(), NOW(), NULL),
(95, 8, 3, 'MAT-SEW-006', 'Rope', 'MTR', 18.00, 12.00, 150.00, 0.00, 'active', NOW(), NOW(), NULL),

-- ----------------------------------------------------------
-- 3. LABELS & PACKAGING -> Category ID 8: ACCESSORY PURCHASE ORDER
-- ----------------------------------------------------------
(96, 8, 3, 'MAT-PKG-001', 'Main Label', 'PCS', 2.20, 12.00, 2000.00, 0.00, 'active', NOW(), NOW(), NULL),
(97, 8, 3, 'MAT-PKG-002', 'Size Label', 'PCS', 1.10, 12.00, 2000.00, 0.00, 'active', NOW(), NOW(), NULL),
(98, 8, 3, 'MAT-PKG-003', 'Care Label', 'PCS', 1.50, 12.00, 2000.00, 5.00, 'active', NOW(), NOW(), NULL),
(99, 8, 3, 'MAT-PKG-004', 'Hang Tag', 'PCS', 3.50, 12.00, 1000.00, 0.00, 'active', NOW(), NOW(), NULL),
(100, 8, 3, 'MAT-PKG-005', 'Barcode Sticker', 'PCS', 0.75, 12.00, 3000.00, 35.00, 'active', NOW(), NOW(), NULL),
(101, 8, 3, 'MAT-PKG-006', 'Poly Bag', 'PCS', 4.20, 18.00, 1500.00, 0.00, 'active', NOW(), NOW(), NULL),
(102, 8, 3, 'MAT-PKG-007', 'Carton Box', 'BOX', 48.00, 18.00, 100.00, 0.00, 'active', NOW(), NOW(), NULL),
(103, 8, 3, 'MAT-PKG-008', 'Packing Tape', 'ROLL', 65.00, 18.00, 25.00, 0.00, 'active', NOW(), NOW(), NULL),

-- ----------------------------------------------------------
-- 4. HARDWARE & ACCESSORIES -> Category ID 8: ACCESSORY PURCHASE ORDER
-- ----------------------------------------------------------
(104, 8, 3, 'MAT-ACC-001', 'Button', 'PCS', 1.80, 18.00, 2500.00, 400.00, 'active', NOW(), NOW(), NULL),
(105, 8, 3, 'MAT-ACC-002', 'Buckle', 'PCS', 8.50, 18.00, 300.00, 0.00, 'active', NOW(), NOW(), NULL),
(106, 8, 3, 'MAT-ACC-003', 'Eyelet', 'PCS', 0.60, 18.00, 3000.00, 0.00, 'active', NOW(), NOW(), NULL),
(107, 8, 3, 'MAT-ACC-004', 'Rivet', 'PCS', 0.85, 18.00, 3000.00, 0.00, 'active', NOW(), NOW(), NULL),
(108, 8, 3, 'MAT-ACC-005', 'Foam', 'MTR', 95.00, 18.00, 80.00, 0.00, 'active', NOW(), NOW(), NULL),
(109, 8, 3, 'MAT-ACC-006', 'Eva Foam', 'MTR', 140.00, 18.00, 60.00, 0.00, 'active', NOW(), NOW(), NULL),

-- ----------------------------------------------------------
-- 5. FILLING MATERIALS -> Category ID 5: FILLING ORDER
-- ----------------------------------------------------------
(110, 5, 2, 'MAT-FIL-001', 'Polyester Fiber', 'KG', 93.00, 18.00, 250.00, 0.00, 'active', NOW(), NOW(), NULL),
(111, 5, 2, 'MAT-FIL-002', 'Kapok', 'KG', 230.00, 5.00, 100.00, 0.00, 'active', NOW(), NOW(), NULL),
(112, 5, 2, 'MAT-FIL-003', 'Cotton Filling', 'KG', 110.00, 5.00, 200.00, 0.00, 'active', NOW(), NOW(), NULL)

ON DUPLICATE KEY UPDATE
    `category_id` = VALUES(`category_id`),
    `supplier_id` = VALUES(`supplier_id`),
    `name` = VALUES(`name`),
    `uom` = VALUES(`uom`),
    `purchase_rate` = VALUES(`purchase_rate`),
    `tax_percent` = VALUES(`tax_percent`),
    `min_stock_level` = VALUES(`min_stock_level`),
    `current_stock` = VALUES(`current_stock`),
    `status` = VALUES(`status`),
    `deleted_at` = VALUES(`deleted_at`);

-- ----------------------------------------------------------
-- Sync Stock Balances Table
-- ----------------------------------------------------------
INSERT INTO `stock_balances` (`material_id`, `current_quantity`, `available_quantity`)
SELECT `id`, `current_stock`, `current_stock` 
FROM `materials` 
WHERE `id` BETWEEN 86 AND 112
ON DUPLICATE KEY UPDATE 
    `current_quantity` = VALUES(`current_quantity`),
    `available_quantity` = VALUES(`available_quantity`);

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
