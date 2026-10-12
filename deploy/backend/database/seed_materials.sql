-- ==========================================================
-- CHERAN SOFT GOODS - SEED DATA: RAW MATERIALS MASTER
-- ==========================================================
-- Includes:
-- 1. Fabric
-- 2. Sewing Materials
-- 3. Labels & Packing
-- 4. Accessories
-- 5. Filling
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------
-- 1. Ensure Material Categories Exist
-- ----------------------------------------------------------
INSERT INTO categories (id, name, code, type, description, sort_order) VALUES
(21, 'Fabric', 'CAT_MAT_FABRIC', 'material', 'Fabric textiles, woven, velvet, and canvas', 21),
(22, 'Sewing Materials', 'CAT_MAT_SEWING', 'material', 'Threads, elastics, zippers, velcro, and ropes', 22),
(23, 'Labels & Packing', 'CAT_MAT_LABELS_PACK', 'material', 'Labels, tags, stickers, poly bags, and cartons', 23),
(24, 'Accessories', 'CAT_MAT_ACCESSORIES', 'material', 'Buttons, buckles, eyelets, rivets, and foams', 24),
(25, 'Filling', 'CAT_MAT_FILLING', 'material', 'Polyester fibers, kapok, and cotton filling materials', 25)
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    description = VALUES(description);

-- ----------------------------------------------------------
-- 2. Insert Materials (Cleanly separated per category)
-- ----------------------------------------------------------

-- 2.1 Category 21: Fabric (Supplier: ABC Textiles Mills Ltd / ID 1)
INSERT INTO materials (code, name, category_id, supplier_id, uom, purchase_rate, tax_percent, min_stock_level, current_stock) VALUES
('MAT-FAB-001', 'Cotton Fabric', 21, 1, 'MTR', 160.00, 5.00, 200.00, 0.00),
('MAT-FAB-002', 'Linen Fabric', 21, 1, 'MTR', 320.00, 5.00, 100.00, 0.00),
('MAT-FAB-003', 'Velvet Fabric', 21, 1, 'MTR', 280.00, 5.00, 80.00, 0.00),
('MAT-FAB-004', 'Canvas Fabric', 21, 1, 'MTR', 210.00, 5.00, 150.00, 0.00)
ON DUPLICATE KEY UPDATE
    name = VALUES(name), category_id = VALUES(category_id), uom = VALUES(uom),
    purchase_rate = VALUES(purchase_rate), tax_percent = VALUES(tax_percent),
    min_stock_level = VALUES(min_stock_level);

-- 2.2 Category 22: Sewing Materials (Supplier: Apex Trims & Accessories / ID 3)
INSERT INTO materials (code, name, category_id, supplier_id, uom, purchase_rate, tax_percent, min_stock_level, current_stock) VALUES
('MAT-SEW-001', 'Sewing Thread', 22, 3, 'CONE', 65.00, 12.00, 50.00, 0.00),
('MAT-SEW-002', 'Overlock Thread', 22, 3, 'CONE', 55.00, 12.00, 40.00, 0.00),
('MAT-SEW-003', 'Elastic', 22, 3, 'MTR', 8.50, 12.00, 300.00, 0.00),
('MAT-SEW-004', 'Zipper', 22, 3, 'PCS', 12.00, 18.00, 500.00, 0.00),
('MAT-SEW-005', 'Velcro', 22, 3, 'MTR', 15.00, 12.00, 100.00, 0.00),
('MAT-SEW-006', 'Rope', 22, 3, 'MTR', 18.00, 12.00, 150.00, 0.00)
ON DUPLICATE KEY UPDATE
    name = VALUES(name), category_id = VALUES(category_id), uom = VALUES(uom),
    purchase_rate = VALUES(purchase_rate), tax_percent = VALUES(tax_percent),
    min_stock_level = VALUES(min_stock_level);

-- 2.3 Category 23: Labels & Packing (Supplier: Apex Trims & Accessories / ID 3)
INSERT INTO materials (code, name, category_id, supplier_id, uom, purchase_rate, tax_percent, min_stock_level, current_stock) VALUES
('MAT-PKG-001', 'Main Label', 23, 3, 'PCS', 2.20, 12.00, 2000.00, 0.00),
('MAT-PKG-002', 'Size Label', 23, 3, 'PCS', 1.10, 12.00, 2000.00, 0.00),
('MAT-PKG-003', 'Care Label', 23, 3, 'PCS', 1.50, 12.00, 2000.00, 0.00),
('MAT-PKG-004', 'Hang Tag', 23, 3, 'PCS', 3.50, 12.00, 1000.00, 0.00),
('MAT-PKG-005', 'Barcode Sticker', 23, 3, 'PCS', 0.75, 12.00, 3000.00, 0.00),
('MAT-PKG-006', 'Poly Bag', 23, 3, 'PCS', 4.20, 18.00, 1500.00, 0.00),
('MAT-PKG-007', 'Carton Box', 23, 3, 'BOX', 48.00, 18.00, 100.00, 0.00),
('MAT-PKG-008', 'Packing Tape', 23, 3, 'ROLL', 65.00, 18.00, 25.00, 0.00)
ON DUPLICATE KEY UPDATE
    name = VALUES(name), category_id = VALUES(category_id), uom = VALUES(uom),
    purchase_rate = VALUES(purchase_rate), tax_percent = VALUES(tax_percent),
    min_stock_level = VALUES(min_stock_level);

-- 2.4 Category 24: Accessories (Supplier: Apex Trims & Accessories / ID 3)
INSERT INTO materials (code, name, category_id, supplier_id, uom, purchase_rate, tax_percent, min_stock_level, current_stock) VALUES
('MAT-ACC-001', 'Button', 24, 3, 'PCS', 1.80, 18.00, 2500.00, 0.00),
('MAT-ACC-002', 'Buckle', 24, 3, 'PCS', 8.50, 18.00, 300.00, 0.00),
('MAT-ACC-003', 'Eyelet', 24, 3, 'PCS', 0.60, 18.00, 3000.00, 0.00),
('MAT-ACC-004', 'Rivet', 24, 3, 'PCS', 0.85, 18.00, 3000.00, 0.00),
('MAT-ACC-005', 'Foam', 24, 3, 'MTR', 95.00, 18.00, 80.00, 0.00),
('MAT-ACC-006', 'Eva Foam', 24, 3, 'MTR', 140.00, 18.00, 60.00, 0.00)
ON DUPLICATE KEY UPDATE
    name = VALUES(name), category_id = VALUES(category_id), uom = VALUES(uom),
    purchase_rate = VALUES(purchase_rate), tax_percent = VALUES(tax_percent),
    min_stock_level = VALUES(min_stock_level);

-- 2.5 Category 25: Filling (Supplier: Sri Balaji Yarn Spinners / ID 2)
INSERT INTO materials (code, name, category_id, supplier_id, uom, purchase_rate, tax_percent, min_stock_level, current_stock) VALUES
('MAT-FIL-001', 'Polyester Fiber', 25, 2, 'KG', 92.00, 18.00, 250.00, 0.00),
('MAT-FIL-002', 'Kapok', 25, 2, 'KG', 230.00, 5.00, 100.00, 0.00),
('MAT-FIL-003', 'Cotton Filling', 25, 2, 'KG', 110.00, 5.00, 200.00, 0.00)
ON DUPLICATE KEY UPDATE
    name = VALUES(name), category_id = VALUES(category_id), uom = VALUES(uom),
    purchase_rate = VALUES(purchase_rate), tax_percent = VALUES(tax_percent),
    min_stock_level = VALUES(min_stock_level);

SET FOREIGN_KEY_CHECKS = 1;

