-- Migration: Add buyer_id to materials
ALTER TABLE materials ADD COLUMN buyer_id INT NULL DEFAULT NULL AFTER supplier_id;
ALTER TABLE materials ADD INDEX idx_materials_buyer (buyer_id);
