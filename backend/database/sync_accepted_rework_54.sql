-- Sync Embroidery Receipt EMB-INW-5650 and Job Order EMB-JOB-3788 for Order 54 with accepted rework
UPDATE embroidery_receipts 
SET total_accepted_qty = 50.00, total_rework_qty = 0.00 
WHERE receipt_number = 'EMB-INW-5650' OR production_order_id = 54;

UPDATE embroidery_job_orders 
SET total_quantity_accepted = 50.00, total_quantity_rework = 0.00 
WHERE job_order_number = 'EMB-JOB-3788' OR production_order_id = 54;

-- Sync Dyeing order & receipt for Order 54
UPDATE dyeing_orders 
SET total_accepted_quantity = 50.00, total_rework_quantity = 0.00 
WHERE production_order_id = 54;

UPDATE dyeing_receipts 
SET total_accepted_quantity = 50.00, total_rework_quantity = 0.00 
WHERE production_order_id = 54;

-- Verify results
SELECT id, receipt_number, total_received_qty, total_accepted_qty, total_rework_qty 
FROM embroidery_receipts 
WHERE production_order_id = 54;

SELECT id, job_order_number, total_quantity_sent, total_quantity_received, total_quantity_accepted, total_quantity_rework, transferred_to_stitching_quantity 
FROM embroidery_job_orders 
WHERE production_order_id = 54;
