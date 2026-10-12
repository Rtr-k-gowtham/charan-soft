-- ==========================================================
-- CHERAN SOFT GOODS - FIX PURCHASE ORDERS REMAINING COLUMNS
-- Database: u868013330_cheran
-- ==========================================================

-- Note: `balance_amount` was ALREADY added successfully! 
-- Run the queries below to finish adding any remaining columns:

-- 1. Add paid_amount to purchase_orders (if not exists)
ALTER TABLE purchase_orders ADD COLUMN paid_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00;

-- 2. Add payment_status to purchase_orders (if not exists)
ALTER TABLE purchase_orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'Not Paid';

-- 3. Add dynamic_data to purchase_order_items (if not exists)
ALTER TABLE purchase_order_items ADD COLUMN dynamic_data JSON NULL;

-- 4. Ensure purchase_payments table exists
CREATE TABLE IF NOT EXISTS purchase_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id INT NOT NULL,
    receipt_number VARCHAR(50) NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    payment_mode VARCHAR(50) DEFAULT 'NEFT',
    reference_number VARCHAR(100) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    INDEX idx_pp_order (purchase_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
