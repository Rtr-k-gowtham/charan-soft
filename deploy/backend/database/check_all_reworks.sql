SELECT id, rework_order_no, production_order_id, stage_id, stage_code, reference_type, reference_id, rework_quantity, accepted_quantity, status 
FROM rework_records 
WHERE status = 'Accepted After Rework';
