SELECT id, dyeing_order_no, total_fabric_quantity, total_received_quantity, total_accepted_quantity, total_rework_quantity 
FROM dyeing_orders 
WHERE production_order_id = 54;

SELECT id, batch_number, accepted_output_quantity, rework_quantity, rejected_quantity, rework_status 
FROM cutting_batches 
WHERE production_order_id = 54;
