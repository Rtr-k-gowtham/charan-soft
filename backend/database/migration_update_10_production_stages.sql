-- ==========================================================
-- CHERAN SOFT GOODS - 10 PRODUCTION STAGES MIGRATION
-- Database: u868013330_cheran / cheran_erp
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Ensure is_qc_stage and is_final_stage columns exist
ALTER TABLE production_stages 
  ADD COLUMN IF NOT EXISTS is_qc_stage BOOLEAN DEFAULT FALSE AFTER color_badge,
  ADD COLUMN IF NOT EXISTS is_final_stage BOOLEAN DEFAULT FALSE AFTER is_qc_stage;

-- Insert or Update the 10 Production Stages
INSERT INTO production_stages (id, code, name, sequence_order, description, standard_cycle_time_mins, color_badge, is_qc_stage, is_final_stage, status) VALUES
(1, 'REQ', 'Requirement Gathering', 1, 'Production Requirement created for the product.', 60, '#6366f1', 0, 0, 'active'),
(2, 'PO', 'Purchase Order (PO)', 2, 'Purchase order creation and tracking.', 120, '#0284c7', 0, 0, 'active'),
(3, 'INW', 'Inward', 3, 'Receive materials or products into inventory.', 60, '#0d9488', 0, 0, 'active'),
(4, 'DYE', 'Dyeing', 4, 'Send material for dyeing and track color-wise processing.', 240, '#7c3aed', 0, 0, 'active'),
(5, 'CUT', 'Cutting — Product-wise', 5, 'Track cutting quantities separately for each product and size.', 180, '#d97706', 0, 0, 'active'),
(6, 'EMB', 'Embroidery — Outward / Inward', 6, 'Track material sent to the embroidery unit and the quantity received back.', 180, '#ec4899', 0, 0, 'active'),
(7, 'STI', 'Stitching — Color-wise Tracking', 7, 'Track stitching progress by product, color, size and quantity.', 300, '#2563eb', 0, 0, 'active'),
(8, 'CHK', 'Checking', 8, 'Quality inspection, defect recording and approval.', 60, '#ef4444', 1, 0, 'active'),
(9, 'PCK', 'Packing', 9, 'Pack approved products and track packed quantities.', 90, '#059669', 0, 0, 'active'),
(10, 'COMP', 'Completed', 10, 'Production order completed with final quantities recorded.', 30, '#16a34a', 0, 1, 'active')
ON DUPLICATE KEY UPDATE 
  code = VALUES(code),
  name = VALUES(name),
  sequence_order = VALUES(sequence_order),
  description = VALUES(description),
  standard_cycle_time_mins = VALUES(standard_cycle_time_mins),
  color_badge = VALUES(color_badge),
  is_qc_stage = VALUES(is_qc_stage),
  is_final_stage = VALUES(is_final_stage),
  status = VALUES(status);

SET FOREIGN_KEY_CHECKS = 1;
