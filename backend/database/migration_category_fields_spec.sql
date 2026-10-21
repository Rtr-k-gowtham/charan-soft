-- Migration: Add model, length, and thickness specifications to category_fields
-- For PO categories (Accessory, Fabric, Weaving, Stitching, Filling)

INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order)
SELECT c.id, 'model', 'Model', 'text', 0, 1, 5
FROM categories c
WHERE c.id IN (1, 5, 6, 7, 8)
  AND NOT EXISTS (SELECT 1 FROM category_fields cf WHERE cf.category_id = c.id AND cf.field_name = 'model');

INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order)
SELECT c.id, 'length', 'Length', 'text', 0, 1, 6
FROM categories c
WHERE c.id IN (1, 5, 6, 7, 8)
  AND NOT EXISTS (SELECT 1 FROM category_fields cf WHERE cf.category_id = c.id AND cf.field_name = 'length');

INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, is_visible, sort_order)
SELECT c.id, 'thickness', 'Thickness', 'text', 0, 1, 7
FROM categories c
WHERE c.id IN (1, 5, 6, 7, 8)
  AND NOT EXISTS (SELECT 1 FROM category_fields cf WHERE cf.category_id = c.id AND cf.field_name = 'thickness');
