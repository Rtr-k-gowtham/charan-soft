-- ============================================================================
-- CHERAN SOFT GOODS - SEED PO CATEGORIES & EXACT TABLE HEADERS REFERENCE
-- Database: u868013330_cheran
-- Compatible with MySQL 5.7+ / MariaDB / Hostinger phpMyAdmin
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. Ensure `categories` table exists
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(50) DEFAULT 'order',
    description TEXT NULL,
    status VARCHAR(20) DEFAULT 'active',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cat_type (type),
    INDEX idx_cat_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. Ensure `category_fields` table exists
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category_fields (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_label VARCHAR(150) NOT NULL,
    field_type ENUM('text', 'number', 'decimal', 'select', 'textarea', 'date', 'checkbox', 'calculated') NOT NULL DEFAULT 'text',
    is_required BOOLEAN DEFAULT FALSE,
    is_visible BOOLEAN DEFAULT TRUE,
    is_readonly BOOLEAN DEFAULT FALSE,
    default_value VARCHAR(255) NULL,
    options JSON NULL,
    calculation_formula VARCHAR(255) NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    INDEX idx_category_fields_cat (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Upsert the 8 Standard PO Categories
-- ----------------------------------------------------------------------------
INSERT INTO categories (id, name, code, type, description, status, sort_order) VALUES
(1, 'WEAVING ORDER', 'CAT_WEAVING_ORDER', 'order', 'Loom weaving production order with design and sizing specifications', 'active', 1),
(2, 'FABRIC WEAVING PROCESS ORDER', 'CAT_FABRIC_WEAVING_PROC', 'order', 'Fabric weaving job work and conversion work order', 'active', 2),
(3, 'FABRIC DYEING PROCESS ORDER', 'CAT_FABRIC_DYEING_PROC', 'order', 'Yarn or grey fabric dyeing and wet processing work order', 'active', 3),
(4, 'FABRIC 2 SIDE KITTY REMOVE AND JIGGAR PROCESS ORDER', 'CAT_FABRIC_KITTY_JIGGAR', 'order', 'Fabric kitty removal and jigger scouring process work order', 'active', 4),
(5, 'FILLING ORDER', 'CAT_FILLING_ORDER', 'order', 'Cushion/pillow fiber and polyfill filling production order', 'active', 5),
(6, 'FABRIC PURCHASE ORDER', 'CAT_FABRIC_PO', 'order', 'Raw grey and finished fabric procurement purchase order', 'active', 6),
(7, 'STICHING ORDER', 'CAT_STITCHING_ORDER', 'order', 'Cutting and stitching production order with sizing/color breakups', 'active', 7),
(8, 'ACCESSORY PURCHASE ORDER', 'CAT_ACCESSORY_PO', 'order', 'Zippers, buttons, sewing threads, wash care labels and packing trims PO', 'active', 8)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    code = VALUES(code),
    type = 'order',
    description = VALUES(description),
    status = 'active',
    sort_order = VALUES(sort_order);

-- ----------------------------------------------------------------------------
-- 4. Clear existing fields for these 8 categories to avoid duplicates
-- ----------------------------------------------------------------------------
DELETE FROM category_fields WHERE category_id IN (1, 2, 3, 4, 5, 6, 7, 8);

-- ----------------------------------------------------------------------------
-- 5. Insert exact Table Headers per Category
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Category 1: WEAVING ORDER
-- Headers: S.No, Order No, Description, Design, Size, Color, Qty, Uom, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
-- ============================================================================
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(1, 's_no',           'S.No',           'number',  FALSE, TRUE, 1),
(1, 'order_no',       'Order No',       'text',    FALSE, TRUE, 2),
(1, 'description',    'Description',    'text',    TRUE,  TRUE, 3),
(1, 'design',         'Design',         'text',    FALSE, TRUE, 4),
(1, 'size',           'Size',           'text',    FALSE, TRUE, 5),
(1, 'color',          'Color',          'text',    FALSE, TRUE, 6),
(1, 'qty',            'Qty',            'number',  TRUE,  TRUE, 7),
(1, 'uom',            'Uom',            'text',    FALSE, TRUE, 8),
(1, 'rate',           'Rate',           'decimal', TRUE,  TRUE, 9),
(1, 'taxable_amount', 'Taxable Amount', 'decimal', FALSE, TRUE, 10),
(1, 'tax_percent',    'TAX %',          'decimal', FALSE, TRUE, 11),
(1, 'tax_amount',     'TAX Amount',     'decimal', FALSE, TRUE, 12),
(1, 'net_amount',     'Net Amount',     'decimal', FALSE, TRUE, 13);

-- ============================================================================
-- Category 2: FABRIC WEAVING PROCESS ORDER
-- Headers: Order No., Item Description, Design, Color, Qty, KGS, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
-- ============================================================================
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(2, 'order_no',         'Order No.',        'text',    FALSE, TRUE, 1),
(2, 'item_description', 'Item Description', 'text',    TRUE,  TRUE, 2),
(2, 'design',           'Design',           'text',    FALSE, TRUE, 3),
(2, 'color',            'Color',            'text',    FALSE, TRUE, 4),
(2, 'qty',              'Qty',              'number',  TRUE,  TRUE, 5),
(2, 'kgs',              'KGS',              'decimal', FALSE, TRUE, 6),
(2, 'rate',             'Rate',             'decimal', TRUE,  TRUE, 7),
(2, 'taxable_amount',   'Taxable Amount',   'decimal', FALSE, TRUE, 8),
(2, 'tax_percent',      'TAX %',            'decimal', FALSE, TRUE, 9),
(2, 'tax_amount',       'TAX Amount',       'decimal', FALSE, TRUE, 10),
(2, 'net_amount',       'Net Amount',       'decimal', FALSE, TRUE, 11);

-- ============================================================================
-- Category 3: FABRIC DYEING PROCESS ORDER
-- Headers: Order No., Item Description, Design, Color, Qty, KGS, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
-- ============================================================================
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(3, 'order_no',         'Order No.',        'text',    FALSE, TRUE, 1),
(3, 'item_description', 'Item Description', 'text',    TRUE,  TRUE, 2),
(3, 'design',           'Design',           'text',    FALSE, TRUE, 3),
(3, 'color',            'Color',            'text',    FALSE, TRUE, 4),
(3, 'qty',              'Qty',              'number',  TRUE,  TRUE, 5),
(3, 'kgs',              'KGS',              'decimal', FALSE, TRUE, 6),
(3, 'rate',             'Rate',             'decimal', TRUE,  TRUE, 7),
(3, 'taxable_amount',   'Taxable Amount',   'decimal', FALSE, TRUE, 8),
(3, 'tax_percent',      'TAX %',            'decimal', FALSE, TRUE, 9),
(3, 'tax_amount',       'TAX Amount',       'decimal', FALSE, TRUE, 10),
(3, 'net_amount',       'Net Amount',       'decimal', FALSE, TRUE, 11);

-- ============================================================================
-- Category 4: FABRIC 2 SIDE KITTY REMOVE AND JIGGAR PROCESS ORDER
-- Headers: Order No., Item Description, Design, Color, Qty, KGS, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
-- ============================================================================
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(4, 'order_no',         'Order No.',        'text',    FALSE, TRUE, 1),
(4, 'item_description', 'Item Description', 'text',    TRUE,  TRUE, 2),
(4, 'design',           'Design',           'text',    FALSE, TRUE, 3),
(4, 'color',            'Color',            'text',    FALSE, TRUE, 4),
(4, 'qty',              'Qty',              'number',  TRUE,  TRUE, 5),
(4, 'kgs',              'KGS',              'decimal', FALSE, TRUE, 6),
(4, 'rate',             'Rate',             'decimal', TRUE,  TRUE, 7),
(4, 'taxable_amount',   'Taxable Amount',   'decimal', FALSE, TRUE, 8),
(4, 'tax_percent',      'TAX %',            'decimal', FALSE, TRUE, 9),
(4, 'tax_amount',       'TAX Amount',       'decimal', FALSE, TRUE, 10),
(4, 'net_amount',       'Net Amount',       'decimal', FALSE, TRUE, 11);

-- ============================================================================
-- Category 5: FILLING ORDER
-- Headers: S.No, Order No, Description, Design, Size, Color, Qty, Uom, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
-- ============================================================================
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(5, 's_no',           'S.No',           'number',  FALSE, TRUE, 1),
(5, 'order_no',       'Order No',       'text',    FALSE, TRUE, 2),
(5, 'description',    'Description',    'text',    TRUE,  TRUE, 3),
(5, 'design',         'Design',         'text',    FALSE, TRUE, 4),
(5, 'size',           'Size',           'text',    FALSE, TRUE, 5),
(5, 'color',          'Color',          'text',    FALSE, TRUE, 6),
(5, 'qty',            'Qty',            'number',  TRUE,  TRUE, 7),
(5, 'uom',            'Uom',            'text',    FALSE, TRUE, 8),
(5, 'rate',           'Rate',           'decimal', TRUE,  TRUE, 9),
(5, 'taxable_amount', 'Taxable Amount', 'decimal', FALSE, TRUE, 10),
(5, 'tax_percent',    'TAX %',          'decimal', FALSE, TRUE, 11),
(5, 'tax_amount',     'TAX Amount',     'decimal', FALSE, TRUE, 12),
(5, 'net_amount',     'Net Amount',     'decimal', FALSE, TRUE, 13);

-- ============================================================================
-- Category 6: FABRIC PURCHASE ORDER
-- Headers: S.No, Order No, Item Description, Spec, Qty, Weight, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
-- ============================================================================
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(6, 's_no',             'S.No',             'number',  FALSE, TRUE, 1),
(6, 'order_no',         'Order No',         'text',    FALSE, TRUE, 2),
(6, 'item_description', 'Item Description', 'text',    TRUE,  TRUE, 3),
(6, 'spec',             'Spec',             'text',    FALSE, TRUE, 4),
(6, 'qty',              'Qty',              'number',  TRUE,  TRUE, 5),
(6, 'weight',           'Weight',           'decimal', FALSE, TRUE, 6),
(6, 'rate',             'Rate',             'decimal', TRUE,  TRUE, 7),
(6, 'taxable_amount',   'Taxable Amount',   'decimal', FALSE, TRUE, 8),
(6, 'tax_percent',      'TAX %',            'decimal', FALSE, TRUE, 9),
(6, 'tax_amount',       'TAX Amount',       'decimal', FALSE, TRUE, 10),
(6, 'net_amount',       'Net Amount',       'decimal', FALSE, TRUE, 11);

-- ============================================================================
-- Category 7: STICHING ORDER
-- Headers: S.No, Order No, Description, Design, Size, Color, Qty, Uom, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
-- ============================================================================
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(7, 's_no',           'S.No',           'number',  FALSE, TRUE, 1),
(7, 'order_no',       'Order No',       'text',    FALSE, TRUE, 2),
(7, 'description',    'Description',    'text',    TRUE,  TRUE, 3),
(7, 'design',         'Design',         'text',    FALSE, TRUE, 4),
(7, 'size',           'Size',           'text',    FALSE, TRUE, 5),
(7, 'color',          'Color',          'text',    FALSE, TRUE, 6),
(7, 'qty',            'Qty',            'number',  TRUE,  TRUE, 7),
(7, 'uom',            'Uom',            'text',    FALSE, TRUE, 8),
(7, 'rate',           'Rate',           'decimal', TRUE,  TRUE, 9),
(7, 'taxable_amount', 'Taxable Amount', 'decimal', FALSE, TRUE, 10),
(7, 'tax_percent',    'TAX %',          'decimal', FALSE, TRUE, 11),
(7, 'tax_amount',     'TAX Amount',     'decimal', FALSE, TRUE, 12),
(7, 'net_amount',     'Net Amount',     'decimal', FALSE, TRUE, 13);

-- ============================================================================
-- Category 8: ACCESSORY PURCHASE ORDER
-- Headers: S.No, Order No., Accessory Name, Size, Qty, UOM, Rate, Taxable Amount, TAX %, TAX Amount, Net Amount
-- ============================================================================
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order) VALUES
(8, 's_no',           'S.No',           'number',  FALSE, TRUE, 1),
(8, 'order_no',       'Order No.',      'text',    FALSE, TRUE, 2),
(8, 'accessory_name', 'Accessory Name', 'text',    TRUE,  TRUE, 3),
(8, 'size',           'Size',           'text',    FALSE, TRUE, 4),
(8, 'qty',            'Qty',            'number',  TRUE,  TRUE, 5),
(8, 'uom',            'UOM',            'text',    FALSE, TRUE, 6),
(8, 'rate',           'Rate',           'decimal', TRUE,  TRUE, 7),
(8, 'taxable_amount', 'Taxable Amount', 'decimal', FALSE, TRUE, 8),
(8, 'tax_percent',    'TAX %',          'decimal', FALSE, TRUE, 9),
(8, 'tax_amount',     'TAX Amount',     'decimal', FALSE, TRUE, 10),
(8, 'net_amount',     'Net Amount',     'decimal', FALSE, TRUE, 11);

SET FOREIGN_KEY_CHECKS = 1;

-- Verification Query: Check categories and count of fields
SELECT c.id, c.name, c.code, COUNT(f.id) AS total_table_headers
FROM categories c
LEFT JOIN category_fields f ON f.category_id = c.id
WHERE c.id BETWEEN 1 AND 8
GROUP BY c.id, c.name, c.code
ORDER BY c.sort_order ASC;
