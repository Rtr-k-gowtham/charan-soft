-- Adds non-destructive, per-rework transfer accounting for Stage 06 returns.
ALTER TABLE rework_records
  ADD COLUMN IF NOT EXISTS transferred_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00
  AFTER rejected_quantity;
