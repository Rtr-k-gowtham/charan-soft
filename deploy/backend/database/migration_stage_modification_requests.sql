-- Migration: Centralized Admin Approval Workflow for All 10 Production Stages
-- Table: stage_modification_requests

CREATE TABLE IF NOT EXISTS `stage_modification_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `request_number` VARCHAR(50) NOT NULL UNIQUE,
  `production_order_id` INT NOT NULL,
  `stage_id` INT NOT NULL,
  `stage_name` VARCHAR(100) NOT NULL,
  `requested_by` INT NOT NULL,
  `requested_by_name` VARCHAR(100) NOT NULL,
  `requested_by_role` VARCHAR(50) NOT NULL,
  `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modification_reason` TEXT NOT NULL,
  `original_data_snapshot` LONGTEXT NOT NULL,
  `proposed_data` LONGTEXT NOT NULL,
  `status` ENUM('Pending Approval', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending Approval',
  `reviewed_by` INT NULL,
  `reviewed_by_name` VARCHAR(100) NULL,
  `reviewed_at` DATETIME NULL,
  `rejection_reason` TEXT NULL,
  `approval_remarks` TEXT NULL,
  `original_record_version` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_smr_order_stage` (`production_order_id`, `stage_id`),
  INDEX `idx_smr_status` (`status`),
  INDEX `idx_smr_requested_by` (`requested_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

