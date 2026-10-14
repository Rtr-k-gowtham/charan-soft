-- ==========================================================
-- CHERAN SOFT GOODS - SEED DATA
-- ==========================================================

-- 1. Roles & Permissions
INSERT INTO roles (id, name, display_name, description) VALUES
(1, 'ADMIN', 'System Administrator', 'Full access to all ERP modules and settings'),
(2, 'MANAGER', 'Operations Manager', 'Full management of production, purchase and stock'),
(3, 'STORE', 'Store Keeper', 'Material receipts, stock ledger, inventory adjustments'),
(4, 'PURCHASE', 'Purchase Officer', 'Vendor management, PO creation, payment recording'),
(5, 'PRODUCTION', 'Production Supervisor', 'Production orders, stage transitions, tracking'),
(6, 'QC', 'Quality Control Inspector', 'QC inspections, rejections, rework management'),
(7, 'STAFF', 'Floor Staff', 'View assigned production jobs');

INSERT INTO users (id, role_id, name, email, password_hash, phone, status) VALUES
(1, 1, 'K. Senthil Nathan', 'admin@cheransoftgoods.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+91 98422 10001', 'active'),
(2, 4, 'R. Muralidharan', 'purchase@cheransoftgoods.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+91 98422 20002', 'active'),
(3, 3, 'P. Arumugam', 'store@cheransoftgoods.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+91 98422 30003', 'active'),
(4, 5, 'V. Kannan', 'production@cheransoftgoods.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+91 98422 40004', 'active'),
(5, 6, 'S. Vijayalakshmi', 'qc@cheransoftgoods.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+91 98422 50005', 'active');

-- 2. Master Units, Colors, Sizes
INSERT INTO units (code, name, description) VALUES
('KG', 'Kilogram', 'Weight unit for yarn, raw fabric and chemicals'),
('M', 'Meter', 'Length unit for woven fabric and trims'),
('PCS', 'Pieces', 'Count for finished products and garments'),
('ROLL', 'Rolls', 'Roll packaging for fabric and elastic'),
('CONE', 'Cones', 'Thread cones and yarn packages'),
('SET', 'Set', 'Matched product sets'),
('BOX', 'Box', 'Carton packing');

INSERT INTO colors (code, name, hex_code) VALUES
('OPT-WHT', 'Optical White', '#F8FAFC'),
('JET-BLK', 'Jet Black', '#0F172A'),
('NVY-BLU', 'Navy Blue', '#1E3A8A'),
('ROY-BLU', 'Royal Blue', '#2563EB'),
('CRIM-RED', 'Crimson Red', '#DC2626'),
('FOR-GRN', 'Forest Green', '#15803D'),
('SLT-GRY', 'Slate Grey', '#64748B'),
('MILK-BGE', 'Milky Beige', '#F5F5DC');

INSERT INTO sizes (code, name, sort_order) VALUES
('XS', 'Extra Small', 1),
('S', 'Small', 2),
('M', 'Medium', 3),
('L', 'Large', 4),
('XL', 'Extra Large', 5),
('XXL', 'Double XL', 6),
('SINGLE', 'Single Bed (60x90")', 7),
('QUEEN', 'Queen Bed (90x100")', 8),
('KING', 'King Bed (108x108")', 9);

INSERT INTO designs (code, name, description) VALUES
('DES-PLAIN', 'Solid Plain Weave', 'High density plain standard weave'),
('DES-TWILL', '2/1 Twill Weave', 'Diagonal twill weave for durable soft goods'),
('DES-SATIN', 'Striped Satin 300TC', 'Luxury 1cm stripe satin finish'),
('DES-DOBBY', 'Micro Dobby Check', 'Textured dobby square checks');

-- 3. Production Stages (The 10 Core Production Pipeline Stages)
INSERT INTO production_stages (id, name, code, sequence_order, description, color_badge, is_qc_stage, is_final_stage) VALUES
(1, 'Requirement Gathering', 'REQ', 1, 'Production Requirement created for the product.', '#6366f1', 0, 0),
(2, 'Purchase Order (PO)', 'PO', 2, 'Purchase order creation and tracking.', '#0284c7', 0, 0),
(3, 'Inward', 'INW', 3, 'Receive materials or products into inventory.', '#0d9488', 0, 0),
(4, 'Dyeing', 'DYE', 4, 'Send material for dyeing and track color-wise processing.', '#7c3aed', 0, 0),
(5, 'Cutting — Product-wise', 'CUT', 5, 'Track cutting quantities separately for each product and size.', '#d97706', 0, 0),
(6, 'Embroidery — Outward / Inward', 'EMB', 6, 'Track material sent to the embroidery unit and the quantity received back.', '#ec4899', 0, 0),
(7, 'Stitching — Color-wise Tracking', 'STI', 7, 'Track stitching progress by product, color, size and quantity.', '#2563eb', 0, 0),
(8, 'Checking', 'CHK', 8, 'Quality inspection, defect recording and approval.', '#ef4444', 1, 0),
(9, 'Packing', 'PCK', 9, 'Pack approved products and track packed quantities.', '#059669', 0, 0),
(10, 'Completed', 'COMP', 10, 'Production order completed with final quantities recorded.', '#16a34a', 0, 1);

-- 4. Seeded Categories (The Exact 8 Order Categories + Material Categories)
INSERT INTO categories (id, name, code, type, description, sort_order) VALUES
(1, 'WEAVING ORDER', 'CAT_WEAVING_ORDER', 'order', 'Loom weaving production orders with design and sizing', 1),
(2, 'FABRIC WEAVING PROCESS ORDER', 'CAT_FABRIC_WEAVING_PROC', 'process', 'Sub-contracted or in-house fabric weaving orders with KGS', 2),
(3, 'FABRIC DYEING PROCESS ORDER', 'CAT_FABRIC_DYEING_PROC', 'process', 'Yarn or grey fabric wet processing and dyeing work order', 3),
(4, 'FABRIC 2 SIDE KITTY REMOVE AND JIGGAR PROCESS ORDER', 'CAT_FABRIC_KITTY_JIGGAR', 'process', 'Grey fabric kitty/selvedge removal and jigger scouring process', 4),
(5, 'FILLING ORDER', 'CAT_FILLING_ORDER', 'order', 'Cushion/pillow fibre and polyfill insertion orders', 5),
(6, 'FABRIC PURCHASE ORDER', 'CAT_FABRIC_PO', 'order', 'Raw grey and finished fabric procurement from mills', 6),
(7, 'STITCHING ORDER', 'CAT_STITCHING_ORDER', 'order', 'Garment/soft goods cutting and stitching production job', 7),
(8, 'ACCESSORY PURCHASE ORDER', 'CAT_ACCESSORY_PO', 'order', 'Buttons, zippers, threads, labels and trims procurement', 8),
(9, 'FABRIC MATERIAL', 'CAT_FABRIC_MAT', 'material', 'Fabric raw inventory master category', 9),
(10, 'ACCESSORY MATERIAL', 'CAT_ACCESSORY_MAT', 'material', 'Trims and accessory inventory category', 10),
(11, 'YARN MATERIAL', 'CAT_YARN_MAT', 'material', 'Yarn cones and beams category', 11);

-- 5. Fields for The 8 Exact Seeded Categories
-- Category 1: WEAVING ORDER
-- Fields: S.No, Order No, Description, Design, Size, Color, Qty, UOM, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(1, 's_no', 'S.No', 'number', 1, 1, 1),
(1, 'order_no', 'Order No', 'text', 1, 1, 2),
(1, 'description', 'Description', 'text', 1, 1, 3),
(1, 'design', 'Design', 'text', 1, 1, 4),
(1, 'size', 'Size', 'text', 1, 1, 5),
(1, 'color', 'Color', 'text', 1, 1, 6),
(1, 'qty', 'Qty', 'number', 1, 1, 7),
(1, 'uom', 'UOM', 'select', 1, 1, 8),
(1, 'rate', 'Rate', 'decimal', 1, 1, 9),
(1, 'taxable_amount', 'Taxable Amount', 'calculated', 0, 1, 10),
(1, 'tax_percent', 'TAX %', 'decimal', 1, 1, 11),
(1, 'tax_amount', 'TAX Amount', 'calculated', 0, 1, 12),
(1, 'net_amount', 'Net Amount', 'calculated', 0, 1, 13);

-- Category 2: FABRIC WEAVING PROCESS ORDER
-- Fields: Order No, Item Description, Design, Color, Qty, KGS, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(2, 'order_no', 'Order No', 'text', 1, 1, 1),
(2, 'item_description', 'Item Description', 'text', 1, 1, 2),
(2, 'design', 'Design', 'text', 1, 1, 3),
(2, 'color', 'Color', 'text', 1, 1, 4),
(2, 'qty', 'Qty', 'number', 1, 1, 5),
(2, 'kgs', 'KGS', 'decimal', 1, 1, 6),
(2, 'rate', 'Rate', 'decimal', 1, 1, 7),
(2, 'taxable_amount', 'Taxable Amount', 'calculated', 0, 1, 8),
(2, 'tax_percent', 'TAX %', 'decimal', 1, 1, 9),
(2, 'tax_amount', 'TAX Amount', 'calculated', 0, 1, 10),
(2, 'net_amount', 'Net Amount', 'calculated', 0, 1, 11);

-- Category 3: FABRIC DYEING PROCESS ORDER
-- Fields: Order No, Item Description, Design, Color, Qty, KGS, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(3, 'order_no', 'Order No', 'text', 1, 1, 1),
(3, 'item_description', 'Item Description', 'text', 1, 1, 2),
(3, 'design', 'Design', 'text', 1, 1, 3),
(3, 'color', 'Color', 'text', 1, 1, 4),
(3, 'qty', 'Qty', 'number', 1, 1, 5),
(3, 'kgs', 'KGS', 'decimal', 1, 1, 6),
(3, 'rate', 'Rate', 'decimal', 1, 1, 7),
(3, 'taxable_amount', 'Taxable Amount', 'calculated', 0, 1, 8),
(3, 'tax_percent', 'TAX %', 'decimal', 1, 1, 9),
(3, 'tax_amount', 'TAX Amount', 'calculated', 0, 1, 10),
(3, 'net_amount', 'Net Amount', 'calculated', 0, 1, 11);

-- Category 4: FABRIC 2 SIDE KITTY REMOVE AND JIGGAR PROCESS ORDER
-- Fields: Order No, Item Description, Design, Color, Qty, KGS, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(4, 'order_no', 'Order No', 'text', 1, 1, 1),
(4, 'item_description', 'Item Description', 'text', 1, 1, 2),
(4, 'design', 'Design', 'text', 1, 1, 3),
(4, 'color', 'Color', 'text', 1, 1, 4),
(4, 'qty', 'Qty', 'number', 1, 1, 5),
(4, 'kgs', 'KGS', 'decimal', 1, 1, 6),
(4, 'rate', 'Rate', 'decimal', 1, 1, 7),
(4, 'taxable_amount', 'Taxable Amount', 'calculated', 0, 1, 8),
(4, 'tax_percent', 'TAX %', 'decimal', 1, 1, 9),
(4, 'tax_amount', 'TAX Amount', 'calculated', 0, 1, 10),
(4, 'net_amount', 'Net Amount', 'calculated', 0, 1, 11);

-- Category 5: FILLING ORDER
-- Fields: S.No, Order No, Description, Design, Size, Color, Qty, UOM, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(5, 's_no', 'S.No', 'number', 1, 1, 1),
(5, 'order_no', 'Order No', 'text', 1, 1, 2),
(5, 'description', 'Description', 'text', 1, 1, 3),
(5, 'design', 'Design', 'text', 1, 1, 4),
(5, 'size', 'Size', 'text', 1, 1, 5),
(5, 'color', 'Color', 'text', 1, 1, 6),
(5, 'qty', 'Qty', 'number', 1, 1, 7),
(5, 'uom', 'UOM', 'select', 1, 1, 8),
(5, 'rate', 'Rate', 'decimal', 1, 1, 9),
(5, 'taxable_amount', 'Taxable Amount', 'calculated', 0, 1, 10),
(5, 'tax_percent', 'TAX %', 'decimal', 1, 1, 11),
(5, 'tax_amount', 'TAX Amount', 'calculated', 0, 1, 12),
(5, 'net_amount', 'Net Amount', 'calculated', 0, 1, 13);

-- Category 6: FABRIC PURCHASE ORDER
-- Fields: S.No, Order No, Item Description, Spec, Qty, Weight, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(6, 's_no', 'S.No', 'number', 1, 1, 1),
(6, 'order_no', 'Order No', 'text', 1, 1, 2),
(6, 'item_description', 'Item Description', 'text', 1, 1, 3),
(6, 'spec', 'Spec', 'text', 1, 1, 4),
(6, 'qty', 'Qty', 'number', 1, 1, 5),
(6, 'weight', 'Weight', 'decimal', 1, 1, 6),
(6, 'rate', 'Rate', 'decimal', 1, 1, 7),
(6, 'taxable_amount', 'Taxable Amount', 'calculated', 0, 1, 8),
(6, 'tax_percent', 'TAX %', 'decimal', 1, 1, 9),
(6, 'tax_amount', 'TAX Amount', 'calculated', 0, 1, 10),
(6, 'net_amount', 'Net Amount', 'calculated', 0, 1, 11);

-- Category 7: STITCHING ORDER
-- Fields: S.No, Order No, Description, Design, Size, Color, Qty, UOM, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(7, 's_no', 'S.No', 'number', 1, 1, 1),
(7, 'order_no', 'Order No', 'text', 1, 1, 2),
(7, 'description', 'Description', 'text', 1, 1, 3),
(7, 'design', 'Design', 'text', 1, 1, 4),
(7, 'size', 'Size', 'text', 1, 1, 5),
(7, 'color', 'Color', 'text', 1, 1, 6),
(7, 'qty', 'Qty', 'number', 1, 1, 7),
(7, 'uom', 'UOM', 'select', 1, 1, 8),
(7, 'rate', 'Rate', 'decimal', 1, 1, 9),
(7, 'taxable_amount', 'Taxable Amount', 'calculated', 0, 1, 10),
(7, 'tax_percent', 'TAX %', 'decimal', 1, 1, 11),
(7, 'tax_amount', 'TAX Amount', 'calculated', 0, 1, 12),
(7, 'net_amount', 'Net Amount', 'calculated', 0, 1, 13);

-- Category 8: ACCESSORY PURCHASE ORDER
-- Fields: S.No, Order No, Accessory Name, Size, Qty, UOM, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(8, 's_no', 'S.No', 'number', 1, 1, 1),
(8, 'order_no', 'Order No', 'text', 1, 1, 2),
(8, 'accessory_name', 'Accessory Name', 'text', 1, 1, 3),
(8, 'size', 'Size', 'text', 1, 1, 4),
(8, 'qty', 'Qty', 'number', 1, 1, 5),
(8, 'uom', 'UOM', 'select', 1, 1, 6),
(8, 'rate', 'Rate', 'decimal', 1, 1, 7),
(8, 'taxable_amount', 'Taxable Amount', 'calculated', 0, 1, 8),
(8, 'tax_percent', 'TAX %', 'decimal', 1, 1, 9),
(8, 'tax_amount', 'TAX Amount', 'calculated', 0, 1, 10),
(8, 'net_amount', 'Net Amount', 'calculated', 0, 1, 11);

-- Category 9: FABRIC MATERIAL fields (Material Master)
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(9, 'material_name', 'Material Name', 'text', 1, 1, 1),
(9, 'material_code', 'Material Code', 'text', 1, 1, 2),
(9, 'spec', 'Spec (Count / Construction)', 'text', 1, 1, 3),
(9, 'color', 'Color', 'text', 0, 1, 4),
(9, 'design', 'Design', 'text', 0, 1, 5),
(9, 'uom', 'UOM', 'select', 1, 1, 6),
(9, 'weight_gsm', 'Weight / GSM', 'decimal', 0, 1, 7),
(9, 'supplier_id', 'Supplier', 'select', 1, 1, 8),
(9, 'purchase_rate', 'Purchase Rate', 'decimal', 1, 1, 9),
(9, 'tax_percent', 'TAX %', 'decimal', 1, 1, 10),
(9, 'min_stock_level', 'Minimum Stock', 'decimal', 1, 1, 11);

-- Category 10: ACCESSORY MATERIAL fields (Material Master)
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(10, 'material_name', 'Accessory Name', 'text', 1, 1, 1),
(10, 'material_code', 'Accessory Code', 'text', 1, 1, 2),
(10, 'size_spec', 'Size / Spec', 'text', 0, 1, 3),
(10, 'color', 'Color / Finish', 'text', 0, 1, 4),
(10, 'uom', 'UOM', 'select', 1, 1, 5),
(10, 'supplier_id', 'Supplier', 'select', 1, 1, 6),
(10, 'purchase_rate', 'Purchase Rate', 'decimal', 1, 1, 7),
(10, 'tax_percent', 'TAX %', 'decimal', 1, 1, 8),
(10, 'min_stock_level', 'Minimum Stock', 'decimal', 1, 1, 9);

-- 6. Suppliers & Customers
INSERT INTO suppliers (id, code, name, contact_person, phone, email, address, gstin, payment_terms_days) VALUES
(1, 'SUP-001', 'ABC Textiles Mills Ltd', 'Naveen Kumar', '+91 94432 11000', 'orders@abctextiles.in', '142 Mill Road, Tirupur, Tamil Nadu - 641602', '33AABCT1234F1Z9', 30),
(2, 'SUP-002', 'Sri Balaji Yarn Spinners', 'R. Balasubramaniam', '+91 94433 22000', 'sales@balajiyarn.com', '54 Palladam High Road, Coimbatore, Tamil Nadu', '33AABCS4455G1Z5', 15),
(3, 'SUP-003', 'Apex Trims & Accessories', 'Mohit Shah', '+91 98201 55440', 'mohit@apextrims.com', '78 Industrial Estate, Erode, Tamil Nadu', '33AACCA9988H1Z2', 45);

INSERT INTO customers (id, code, name, contact_person, phone, email, billing_address, gstin) VALUES
(1, 'CUST-001', 'Heritage Home Linen LLC', 'David Miller', '+1 415 555 2671', 'procurement@heritagelinen.com', '850 Market Street, San Francisco, CA 94102, USA', '06AAACH1234D1ZQ'),
(2, 'CUST-002', 'Prestige Hospitality Group', 'A. Ramakrishnan', '+91 98410 77889', 'sourcing@prestigehospitality.in', 'MG Road, Bengaluru, Karnataka - 560001', '29AAACP8877K1ZZ'),
(3, 'CUST-003', 'Zara Living Exports', 'K. Anand', '+91 97890 12345', 'anand@zaraliving.in', 'Exports Enclave, Chennai, Tamil Nadu - 600028', '33AAACZ7766L1ZX');

-- 7. Materials & Initial Stock Balances
INSERT INTO materials (id, category_id, supplier_id, code, name, uom, purchase_rate, tax_percent, min_stock_level, current_stock) VALUES
(1, 9, 1, 'MAT-CTN-40S', 'Cotton Fabric 40s x 60s High Density', 'KG', 120.00, 5.00, 500.00, 1100.00),
(2, 9, 1, 'MAT-CTN-30S', 'Cotton Satin 300TC Striped Weave', 'KG', 185.00, 5.00, 300.00, 680.00),
(3, 9, 2, 'MAT-POLY-80S', 'Polyester Micro Twill Lining', 'KG', 95.00, 12.00, 200.00, 150.00),
(4, 10, 3, 'MAT-BTN-CHL', 'Chalk Buttons 14L 4-Hole White', 'PCS', 0.45, 18.00, 5000.00, 12000.00),
(5, 10, 3, 'MAT-ZIP-INV', 'Concealed Invisible Nylon Zipper 16"', 'PCS', 6.50, 18.00, 800.00, 450.00),
(6, 10, 3, 'MAT-THRD-POLY', 'Spun Polyester Sewing Thread 40/2 White', 'CONE', 45.00, 12.00, 100.00, 40.00),
(7, 10, 3, 'MAT-POLYFILL', 'Virgin Hollow Siliconized Polyfiber 15D', 'KG', 85.00, 12.00, 400.00, 850.00);

INSERT INTO stock_balances (material_id, current_quantity, available_quantity) VALUES
(1, 1100.00, 1100.00),
(2, 680.00, 680.00),
(3, 150.00, 150.00),
(4, 12000.00, 12000.00),
(5, 450.00, 450.00),
(6, 40.00, 40.00),
(7, 850.00, 850.00);

-- Initial Stock In ledger entries
INSERT INTO inventory_transactions (material_id, transaction_type, reference_type, reference_id, quantity, previous_stock, new_stock, notes) VALUES
(1, 'STOCK IN', 'Opening Balance', NULL, 1100.00, 0.00, 1100.00, 'Initial audited physical inventory migration'),
(2, 'STOCK IN', 'Opening Balance', NULL, 680.00, 0.00, 680.00, 'Initial audited physical inventory migration'),
(3, 'STOCK IN', 'Opening Balance', NULL, 150.00, 0.00, 150.00, 'Initial audited physical inventory migration - LOW STOCK'),
(4, 'STOCK IN', 'Opening Balance', NULL, 12000.00, 0.00, 12000.00, 'Initial audited physical inventory migration'),
(5, 'STOCK IN', 'Opening Balance', NULL, 450.00, 0.00, 450.00, 'Initial audited physical inventory migration - LOW STOCK'),
(6, 'STOCK IN', 'Opening Balance', NULL, 40.00, 0.00, 40.00, 'Initial audited physical inventory migration - LOW STOCK'),
(7, 'STOCK IN', 'Opening Balance', NULL, 850.00, 0.00, 850.00, 'Initial audited physical inventory migration');

-- 8. Products & BOM
INSERT INTO products (id, category_id, code, name, design, uom, selling_price, tax_percent) VALUES
(1, 1, 'PRD-BED-QN', 'Luxury Queen Bed Sheet Set (300TC)', 'DES-SATIN', 'SET', 1450.00, 12.00),
(2, 1, 'PRD-CSH-50', 'Euro Pillow / Cushion Cover 50x50cm', 'DES-PLAIN', 'PCS', 260.00, 12.00),
(3, 1, 'PRD-SHIRT-M', 'Executive Twill Woven Casual Shirt', 'DES-TWILL', 'PCS', 780.00, 5.00);

INSERT INTO boms (id, product_id, name, batch_size) VALUES
(1, 1, 'Standard BOM for Queen Bed Set', 1),
(2, 2, 'Standard BOM for Euro Cushion Cover', 1);

INSERT INTO bom_items (bom_id, material_id, quantity_required, uom, wastage_percent) VALUES
(1, 2, 2.5000, 'KG', 3.00),
(1, 6, 0.0500, 'CONE', 1.00),
(2, 1, 0.4000, 'KG', 2.00),
(2, 5, 1.0000, 'PCS', 0.00),
(2, 6, 0.0200, 'CONE', 1.00),
(2, 7, 0.3500, 'KG', 2.00);

-- 9. Sample Purchase Orders
INSERT INTO purchase_orders (id, po_number, category_id, supplier_id, po_date, delivery_due_date, subtotal, tax_amount, net_amount, paid_amount, balance_amount, payment_status, status, remarks) VALUES
(1, 'PO-00045', 6, 1, '2026-09-28', '2026-10-15', 120000.00, 6000.00, 126000.00, 50000.00, 76000.00, 'Partially Paid', 'PARTIALLY RECEIVED', 'Urgent batch for export shipment #EX-102'),
(2, 'PO-00046', 8, 3, '2026-10-02', '2026-10-20', 28500.00, 5130.00, 33630.00, 33630.00, 0.00, 'Paid', 'RECEIVED', 'Concealed zippers and threads batch');

INSERT INTO purchase_order_items (purchase_order_id, material_id, line_number, item_description, spec, quantity, weight_kg, received_quantity, rate, taxable_amount, tax_percent, tax_amount, net_amount) VALUES
(1, 1, 1, 'Cotton Fabric (40s x 60s Grey)', '40s x 60s / 68x68', 1000.00, 450.00, 600.00, 120.00, 120000.00, 5.00, 6000.00, 126000.00),
(2, 5, 1, 'Concealed Invisible Nylon Zipper 16"', '16 Inch #3 YKK Type', 2000.00, NULL, 2000.00, 6.50, 13000.00, 18.00, 2340.00, 15340.00),
(2, 6, 2, 'Spun Polyester Sewing Thread 40/2 White', '40/2 5000M Cone', 300.00, NULL, 300.00, 45.00, 13500.00, 12.00, 1620.00, 15120.00);

INSERT INTO purchase_payments (purchase_order_id, receipt_number, payment_date, amount, payment_mode, reference_number, notes) VALUES
(1, 'PAY-REC-001', '2026-10-01', 50000.00, 'RTGS', 'HDFC262749921', 'Advance payment 40% on dispatch notification'),
(2, 'PAY-REC-002', '2026-10-04', 33630.00, 'NEFT', 'SBI99218201', 'Full and final payment upon goods verification');

INSERT INTO purchase_receipts (id, receipt_no, purchase_order_id, receipt_date, delivery_challan_no, vehicle_no, remarks, status) VALUES
(1, 'GRN-00089', 1, '2026-10-04', 'DC-ABC-9912', 'TN 39 BB 4590', 'First partial delivery received in good condition', 'Verified'),
(2, 'GRN-00090', 2, '2026-10-05', 'DC-APX-4102', 'TN 38 CC 1022', 'Full quantity verified and moved to trim rack', 'Verified');

INSERT INTO purchase_receipt_items (purchase_receipt_id, purchase_order_item_id, material_id, quantity_received, weight_received, lot_number, accepted_quantity, remarks) VALUES
(1, 1, 1, 600.00, 270.00, 'LOT-CTN-26A', 600.00, 'Accepted 600 KG. Remaining 400 KG pending next dispatch.'),
(2, 2, 5, 2000.00, NULL, 'LOT-ZIP-09', 2000.00, 'Full quantity accepted.'),
(2, 3, 6, 300.00, NULL, 'LOT-THRD-14', 300.00, 'Full quantity accepted.');

-- 10. Sample Production Orders with Exact Partial Tracking
INSERT INTO production_orders (id, order_number, category_id, customer_id, title, priority, start_date, target_delivery_date, total_quantity, completed_quantity, status, notes) VALUES
(1, 'ORD-1024', 7, 1, 'Export Queen Bed Linen Contract', 'High', '2026-10-01', '2026-10-25', 100, 28, 'IN PRODUCTION', 'Customer inspection scheduled before dispatch'),
(2, 'ORD-1025', 5, 2, 'Luxury Euro Cushion Polyfill Batch', 'Medium', '2026-10-03', '2026-10-20', 50, 0, 'IN PRODUCTION', 'High density fiber filling required');

INSERT INTO production_order_items (id, production_order_id, product_id, color, size, total_quantity, current_stage_id, current_stage_quantity, completed_quantity, rejected_quantity, rework_quantity, status) VALUES
(1, 1, 1, 'Optical White', 'QUEEN', 60, 5, 26, 20, 2, 2, 'In Progress'),
(2, 1, 1, 'Navy Blue', 'QUEEN', 40, 6, 12, 8, 1, 1, 'In Progress'),
(3, 2, 2, 'Milky Beige', 'M', 50, 4, 35, 0, 0, 0, 'In Progress');

-- Stage transactions illustrating partial quantity movements
INSERT INTO production_stage_transactions (production_order_item_id, from_stage_id, to_stage_id, quantity_moved, remarks) VALUES
(1, 1, 2, 60, 'All 60 loaded to dyeing'),
(1, 2, 3, 60, 'Dyeing passed 60 sent to detailing'),
(1, 3, 4, 60, 'Detailing completed'),
(1, 4, 5, 60, 'Cutting done'),
(1, 5, 6, 30, 'Partial batch of 30 moved to QC inspection'),
(1, 6, 7, 20, '20 pieces passed QC and completed packing');

-- QC Record
INSERT INTO qc_records (id, production_order_item_id, stage_id, input_quantity, passed_quantity, rejected_quantity, rework_quantity, pending_quantity, defect_reason, remarks) VALUES
(1, 1, 6, 30, 20, 2, 2, 6, 'Selvedge stitch skipped on 2 units, oil stain on 2 units', '2 units sent to rework for re-stitching; 2 scrapped');

INSERT INTO rework_records (qc_record_id, production_order_item_id, rework_stage_id, quantity, status, resolution_notes) VALUES
(1, 1, 5, 2, 'IN REWORK', 'Re-route to stitching table #4 for needle readjustment');

-- Company Setting
INSERT INTO company_settings (id, company_name, tagline, address, phone, email, gstin, currency_symbol) VALUES
(1, 'CHERAN SOFT GOODS', 'Premier Textile Manufacturing ERP', 'S.F. No. 412, Avinashi Road, Tirupur - 641 654, Tamil Nadu, India', '+91 421 2478900', 'contact@cheransoftgoods.com', '33AAACC8901L1Z4', '₹');
