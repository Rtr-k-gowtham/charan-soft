-- Migration: Add dynamic cartoon avatar fields to customers table
-- Date: 2026-10-15
-- Supports: DiceBear Adventurer and Lorelei avatar configurations

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS avatar_style VARCHAR(50) DEFAULT 'adventurer',
    ADD COLUMN IF NOT EXISTS avatar_seed VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS avatar_config LONGTEXT DEFAULT NULL;

-- Set deterministic seed defaults for existing customers based on their code or ID
UPDATE customers 
SET avatar_style = 'adventurer', 
    avatar_seed = CONCAT('buyer-', id, '-', COALESCE(code, 'cust'))
WHERE avatar_seed IS NULL OR avatar_seed = '';
