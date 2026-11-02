-- Preserve removed Draft PO lines for audit while excluding them from active
-- PO item counts, grouping and unordered-material calculations.
ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER received_quantity;

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS removal_reason VARCHAR(255) NULL AFTER deleted_at;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_active
  ON purchase_order_items (purchase_order_id, deleted_at);
