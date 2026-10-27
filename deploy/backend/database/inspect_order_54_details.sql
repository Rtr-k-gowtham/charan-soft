SELECT id, job_order_number, total_quantity_sent, total_quantity_received, total_quantity_accepted, total_quantity_rejected, total_quantity_outstanding, transferred_to_stitching_quantity, status 
FROM embroidery_job_orders 
WHERE production_order_id = 54;

SELECT id, receipt_number, job_order_id, total_received_qty, total_accepted_qty, total_rework_qty, total_rejected_qty, inspection_status, items_data 
FROM embroidery_receipts 
WHERE production_order_id = 54;
