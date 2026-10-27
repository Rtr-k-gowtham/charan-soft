UPDATE dispatch_records 
SET eway_bill_filesize = 7326 
WHERE id = 7 OR production_order_id = 54;

SELECT id, production_order_id, dispatch_number, eway_bill_filename, eway_bill_filesize 
FROM dispatch_records 
WHERE production_order_id = 54;
