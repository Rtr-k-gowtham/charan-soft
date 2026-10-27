SELECT id, dyeing_order_no, total_quantity_sent, total_accepted_quantity, total_rework_quantity 
FROM dyeing_orders 
WHERE production_order_id = 54;

SELECT id, receipt_no, dyeing_order_id, total_accepted_quantity, total_rework_quantity 
FROM dyeing_receipts 
WHERE production_order_id = 54;
