-- ==========================================================
-- CHERAN SOFT GOODS - FIX 'Unknown column po.deleted_at'
-- Run this in phpMyAdmin (Database: u868013330_cheran)
-- ==========================================================

-- In ProductionController and dashboard queries, 'production_orders' is aliased as 'po':
-- (SELECT po.* FROM production_orders po WHERE po.deleted_at IS NULL)
ALTER TABLE production_orders ADD COLUMN deleted_at TIMESTAMP NULL;
