SELECT 'EMBROIDERY JOB ORDERS' as tbl;
SELECT id, job_order_number, total_quantity_sent, total_quantity_received, total_quantity_accepted, total_quantity_rejected, total_quantity_outstanding, transferred_to_stitching_quantity, status 
FROM embroidery_job_orders 
WHERE production_order_id = 54;

SELECT 'EMBROIDERY RECEIPTS' as tbl;
SELECT * FROM embroidery_receipts 
WHERE production_order_id = 54;

SELECT 'REWORK RECORDS' as tbl;
SELECT id, rework_order_no, reference_id, reference_type, rework_quantity, accepted_quantity, rejected_quantity, pending_quantity, status, cycle_number, stage_id, stage_code
FROM rework_records 
WHERE production_order_id = 54;

SELECT 'LEDGER ENTRIES' as tbl;
SELECT id, stage_id, transaction_type, quantity, reference_type, reference_id, remarks 
FROM production_quantity_ledger 
WHERE production_order_id = 54 
ORDER BY id DESC LIMIT 10;
