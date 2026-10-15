-- ==========================================================
-- CHERAN SOFT GOODS - 10 PRODUCTION STAGES MIGRATION
-- Database: u868013330_cheran / cheran_erp
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Insert or update the 10 production stages using universal core columns
INSERT INTO `production_stages` (`id`, `code`, `name`, `sequence_order`, `status`) VALUES
(1, 'REQ', 'Requirement Gathering', 1, 'active'),
(2, 'PO', 'Purchase Order (PO)', 2, 'active'),
(3, 'INW', 'Inward', 3, 'active'),
(4, 'DYE', 'Dyeing', 4, 'active'),
(5, 'CUT', 'Cutting — Product-wise', 5, 'active'),
(6, 'EMB', 'Embroidery — Outward / Inward', 6, 'active'),
(7, 'STI', 'Stitching — Color-wise Tracking', 7, 'active'),
(8, 'CHK', 'Checking', 8, 'active'),
(9, 'PCK', 'Packing', 9, 'active'),
(10, 'COMP', 'Completed', 10, 'active')
ON DUPLICATE KEY UPDATE 
  `code` = VALUES(`code`), 
  `name` = VALUES(`name`), 
  `sequence_order` = VALUES(`sequence_order`), 
  `status` = 'active';

SET FOREIGN_KEY_CHECKS = 1;
