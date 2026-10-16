-- =========================================================================
-- CHERAN SOFT GOODS - ADVANCED PRODUCT-WISE PRODUCTION TRACKING SYSTEM
-- Database Migration: Production Workflow Upgrade (Stages 1 through 10)
-- Zero-Regression & Full Auditable Lifecycle Tracking
-- =========================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Ensure production_stages contains all 10 standard stages
INSERT INTO `production_stages` (`id`, `code`, `name`, `sequence_order`, `color_badge`, `description`, `is_qc_stage`, `is_final_stage`, `status`) VALUES
(1, 'REQ', 'Requirement Gathering', 1, '#6366f1', 'Production Requirement and BOM specification.', 0, 0, 'active'),
(2, 'PO', 'Purchase Order (PO)', 2, '#0284c7', 'Purchase order generation and vendor allocation.', 0, 0, 'active'),
(3, 'INW', 'Inward', 3, '#0d9488', 'Receive raw fabrics, accessories and trims into inventory.', 0, 0, 'active'),
(4, 'DYE', 'Dyeing', 4, '#7c3aed', 'Fabric dyeing and Pantone color-matched shade approval.', 0, 0, 'active'),
(5, 'CUT', 'Cutting — Product-wise', 5, '#d97706', 'Product-wise cut batch tracking and yield management.', 0, 0, 'active'),
(6, 'EMB', 'Embroidery — Outward / Inward', 6, '#ec4899', 'External vendor job work outward dispatch and inward return reconciliation.', 0, 0, 'active'),
(7, 'STI', 'Stitching — Color-wise Tracking', 7, '#2563eb', 'Garment assembly, line balancing, and color/size tracking.', 0, 0, 'active'),
(8, 'CHK', 'Checking', 8, '#ef4444', 'End-line quality checking, defects classification, and rework routing.', 1, 0, 'active'),
(9, 'PCK', 'Packing', 9, '#059669', 'Box packing and master carton generation based on buyer specs.', 0, 0, 'active'),
(10, 'COMP', 'Completed / Dispatch', 10, '#16a34a', 'Final production completion, truck loading, and dispatch evidence.', 0, 1, 'active')
ON DUPLICATE KEY UPDATE 
  `code` = VALUES(`code`), 
  `name` = VALUES(`name`), 
  `sequence_order` = VALUES(`sequence_order`),
  `color_badge` = VALUES(`color_badge`),
  `description` = VALUES(`description`),
  `is_qc_stage` = VALUES(`is_qc_stage`),
  `is_final_stage` = VALUES(`is_final_stage`),
  `status` = 'active';

-- 2. Master Quantity Ledger (Transaction-based ledger for tamper-proof quantity audit)
CREATE TABLE IF NOT EXISTS `production_quantity_ledger` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `production_order_id` INT NOT NULL,
  `production_order_item_id` INT NOT NULL,
  `stage_id` INT NOT NULL,
  `stage_code` VARCHAR(20) NOT NULL,
  `transaction_type` ENUM('INPUT', 'PROCESSED', 'ACCEPTED', 'REJECTED', 'REWORK', 'TRANSFERRED', 'OUTWARD', 'INWARD', 'PACKED', 'DISPATCHED', 'ADJUSTMENT') NOT NULL,
  `quantity` DECIMAL(12, 2) NOT NULL,
  `batch_number` VARCHAR(100) NULL,
  `operator_name` VARCHAR(150) NULL,
  `supervisor_name` VARCHAR(150) NULL,
  `reference_type` VARCHAR(100) NULL,
  `reference_id` VARCHAR(100) NULL,
  `remarks` TEXT NULL,
  `metadata_json` JSON NULL,
  `created_by_user_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_pql_order` (`production_order_id`),
  INDEX `idx_pql_item` (`production_order_item_id`),
  INDEX `idx_pql_stage` (`stage_id`),
  INDEX `idx_pql_type` (`transaction_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Stage 5: Cutting Batches
CREATE TABLE IF NOT EXISTS `cutting_batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `production_order_id` INT NOT NULL,
  `production_order_item_id` INT NOT NULL,
  `batch_number` VARCHAR(100) NOT NULL,
  `cutting_date` DATE NOT NULL,
  `assigned_quantity` DECIMAL(12, 2) NOT NULL,
  `actual_cut_quantity` DECIMAL(12, 2) NOT NULL,
  `rejected_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `accepted_output_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `pending_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `operator` VARCHAR(150) NULL,
  `supervisor` VARCHAR(150) NULL,
  `machine_line` VARCHAR(100) NULL,
  `remarks` TEXT NULL,
  `photo_urls` JSON NULL,
  `transferred_to_next_stage_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `status` ENUM('In Progress', 'Completed', 'Partial Transfer', 'Fully Transferred') DEFAULT 'In Progress',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_cut_order` (`production_order_id`),
  INDEX `idx_cut_item` (`production_order_item_id`),
  INDEX `idx_cut_batch` (`batch_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Stage 6: Embroidery Job Orders (Outward)
CREATE TABLE IF NOT EXISTS `embroidery_job_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `job_order_number` VARCHAR(100) NOT NULL UNIQUE,
  `production_order_id` INT NOT NULL,
  `vendor_id` INT NULL,
  `vendor_name` VARCHAR(255) NOT NULL,
  `job_order_date` DATE NOT NULL,
  `dispatch_date` DATE NOT NULL,
  `expected_return_date` DATE NULL,
  `delivery_challan_no` VARCHAR(100) NULL,
  `transport_courier` VARCHAR(255) NULL,
  `sent_by` VARCHAR(150) NULL,
  `total_quantity_sent` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total_quantity_received` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total_quantity_accepted` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total_quantity_rejected` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total_quantity_rework` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total_quantity_outstanding` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `status` ENUM('Sent to Vendor', 'Partially Received', 'Received', 'Cancelled') DEFAULT 'Sent to Vendor',
  `notes` TEXT NULL,
  `attachments` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_emb_order` (`production_order_id`),
  INDEX `idx_emb_vendor` (`vendor_id`),
  INDEX `idx_emb_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `embroidery_job_order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `job_order_id` INT NOT NULL,
  `production_order_item_id` INT NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `product_code` VARCHAR(100) NULL,
  `color` VARCHAR(100) NULL,
  `size` VARCHAR(50) NULL,
  `design_reference` VARCHAR(255) NULL,
  `uom` VARCHAR(50) DEFAULT 'Pieces',
  `quantity_sent` DECIMAL(12, 2) NOT NULL,
  `quantity_received` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `quantity_accepted` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `quantity_rejected` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `quantity_rework` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `quantity_outstanding` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_ejoi_job` (`job_order_id`),
  INDEX `idx_ejoi_item` (`production_order_item_id`),
  FOREIGN KEY (`job_order_id`) REFERENCES `embroidery_job_orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Stage 6: Embroidery Inward Receipts
CREATE TABLE IF NOT EXISTS `embroidery_receipts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `receipt_number` VARCHAR(100) NOT NULL UNIQUE,
  `job_order_id` INT NOT NULL,
  `production_order_id` INT NOT NULL,
  `vendor_name` VARCHAR(255) NOT NULL,
  `receipt_date` DATE NOT NULL,
  `vendor_challan_no` VARCHAR(100) NULL,
  `received_by` VARCHAR(150) NULL,
  `total_received_qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total_accepted_qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total_rejected_qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total_rework_qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `remarks` TEXT NULL,
  `photo_urls` JSON NULL,
  `items_data` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_er_job` (`job_order_id`),
  INDEX `idx_er_po` (`production_order_id`),
  FOREIGN KEY (`job_order_id`) REFERENCES `embroidery_job_orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Stage 7: Stitching Batches
CREATE TABLE IF NOT EXISTS `stitching_batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `production_order_id` INT NOT NULL,
  `production_order_item_id` INT NOT NULL,
  `batch_number` VARCHAR(100) NOT NULL,
  `assigned_quantity` DECIMAL(12, 2) NOT NULL,
  `received_quantity` DECIMAL(12, 2) NOT NULL,
  `completed_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `accepted_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `rejected_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `balance_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `operator_team` VARCHAR(150) NULL,
  `production_line` VARCHAR(100) NULL,
  `start_date` DATE NOT NULL,
  `completion_date` DATE NULL,
  `supervisor` VARCHAR(150) NULL,
  `remarks` TEXT NULL,
  `photo_urls` JSON NULL,
  `status` ENUM('In Progress', 'Completed', 'On Hold') DEFAULT 'In Progress',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sti_order` (`production_order_id`),
  INDEX `idx_sti_item` (`production_order_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Stage 8: Checking / Quality Inspections
CREATE TABLE IF NOT EXISTS `quality_inspections` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `production_order_id` INT NOT NULL,
  `production_order_item_id` INT NOT NULL,
  `batch_number` VARCHAR(100) NULL,
  `submitted_quantity` DECIMAL(12, 2) NOT NULL,
  `checked_quantity` DECIMAL(12, 2) NOT NULL,
  `passed_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `failed_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `rework_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `rejected_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `defect_category` VARCHAR(100) NULL,
  `defect_description` TEXT NULL,
  `inspector` VARCHAR(150) NULL,
  `inspection_date` DATE NOT NULL,
  `is_reinspection` TINYINT(1) DEFAULT 0,
  `original_inspection_id` INT NULL,
  `remarks` TEXT NULL,
  `photo_urls` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_qi_order` (`production_order_id`),
  INDEX `idx_qi_item` (`production_order_item_id`),
  INDEX `idx_qi_orig` (`original_inspection_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Stage 9: Packing Batches & Cartons
CREATE TABLE IF NOT EXISTS `packing_batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `production_order_id` INT NOT NULL,
  `production_order_item_id` INT NOT NULL,
  `batch_number` VARCHAR(100) NOT NULL,
  `packing_date` DATE NOT NULL,
  `approved_quantity` DECIMAL(12, 2) NOT NULL,
  `packed_quantity` DECIMAL(12, 2) NOT NULL,
  `remaining_unpacked_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `units_per_box` INT NOT NULL DEFAULT 1,
  `number_of_boxes` INT NOT NULL DEFAULT 0,
  `boxes_per_master_carton` INT NOT NULL DEFAULT 1,
  `number_of_master_cartons` INT NOT NULL DEFAULT 0,
  `partial_box_quantity` INT NOT NULL DEFAULT 0,
  `partial_carton_quantity` INT NOT NULL DEFAULT 0,
  `carton_serial_numbers` TEXT NULL,
  `gross_weight` DECIMAL(10, 2) NULL,
  `net_weight` DECIMAL(10, 2) NULL,
  `packing_operator` VARCHAR(150) NULL,
  `packing_supervisor` VARCHAR(150) NULL,
  `remarks` TEXT NULL,
  `photo_urls` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_pb_order` (`production_order_id`),
  INDEX `idx_pb_item` (`production_order_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `packing_cartons` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `carton_serial_number` VARCHAR(100) NOT NULL UNIQUE,
  `packing_batch_id` INT NOT NULL,
  `production_order_id` INT NOT NULL,
  `production_order_item_id` INT NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `product_code` VARCHAR(100) NULL,
  `color` VARCHAR(100) NULL,
  `size` VARCHAR(50) NULL,
  `box_name` VARCHAR(150) NULL,
  `items_count` INT NOT NULL DEFAULT 0,
  `is_full` TINYINT(1) DEFAULT 1,
  `gross_weight` DECIMAL(10, 2) NULL,
  `status` ENUM('Packed', 'Staged for Dispatch', 'Dispatched') DEFAULT 'Packed',
  `dispatch_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_pc_batch` (`packing_batch_id`),
  INDEX `idx_pc_serial` (`carton_serial_number`),
  INDEX `idx_pc_order` (`production_order_id`),
  INDEX `idx_pc_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Stage 10: Dispatch Records & Evidence
CREATE TABLE IF NOT EXISTS `dispatch_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `dispatch_number` VARCHAR(100) NOT NULL UNIQUE,
  `production_order_id` INT NOT NULL,
  `buyer_id` INT NULL,
  `buyer_name` VARCHAR(255) NOT NULL,
  `dispatch_date` DATE NOT NULL,
  `dispatch_time` TIME NULL,
  `total_dispatched_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total_boxes` INT NOT NULL DEFAULT 0,
  `total_master_cartons` INT NOT NULL DEFAULT 0,
  `vehicle_number` VARCHAR(100) NOT NULL,
  `driver_name` VARCHAR(150) NULL,
  `driver_contact` VARCHAR(50) NULL,
  `transporter_name` VARCHAR(255) NULL,
  `delivery_challan_number` VARCHAR(100) NULL,
  `invoice_reference` VARCHAR(100) NULL,
  `destination_notes` TEXT NULL,
  `remarks` TEXT NULL,
  `truck_photo_urls` JSON NULL,
  `loaded_cartons_photo_urls` JSON NULL,
  `labels_photo_urls` JSON NULL,
  `document_urls` JSON NULL,
  `status` ENUM('Partially Dispatched', 'Fully Dispatched') DEFAULT 'Partially Dispatched',
  `carton_serial_numbers` JSON NULL,
  `items_breakdown` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_dr_order` (`production_order_id`),
  INDEX `idx_dr_num` (`dispatch_number`),
  INDEX `idx_dr_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Seed 4-Product Comprehensive Test Order ORD-1004 (2,500 pcs)
INSERT INTO `production_orders` (`id`, `order_number`, `title`, `customer_id`, `category_id`, `priority`, `start_date`, `target_delivery_date`, `total_quantity`, `completed_quantity`, `status`, `notes`)
VALUES (4, 'ORD-1004', 'Max Lifestyle 4-Product Comprehensive Export Run', 2, 1, 'Urgent', '2026-10-10', '2026-11-05', 2500, 0, 'IN PRODUCTION', '4-Product test order validating Cutting, Embroidery, Stitching, Checking, Packing (Sections C & D specs), and Completed / Dispatch.')
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `total_quantity` = VALUES(`total_quantity`), `status` = VALUES(`status`);

INSERT INTO `production_order_items` (`id`, `production_order_id`, `product_id`, `color`, `size`, `total_quantity`, `current_stage_id`, `current_stage_quantity`, `completed_quantity`, `rejected_quantity`, `rework_quantity`, `status`)
VALUES 
(10, 4, 1, 'Navy Blue', 'M', 1000, 5, 1000, 0, 0, 0, 'In Progress'),
(11, 4, 2, 'Khaki Beige', '32', 500, 5, 500, 0, 0, 0, 'In Progress'),
(12, 4, 3, 'Crimson Red', 'L', 750, 5, 750, 0, 0, 0, 'In Progress'),
(13, 4, 4, 'Charcoal Melange', 'XL', 250, 5, 250, 0, 0, 0, 'In Progress')
ON DUPLICATE KEY UPDATE `total_quantity` = VALUES(`total_quantity`), `current_stage_id` = VALUES(`current_stage_id`), `current_stage_quantity` = VALUES(`current_stage_quantity`);

SET FOREIGN_KEY_CHECKS = 1;
