-- Migration: Add generated_bom to production_orders
-- Allows persisting calculated and customized BOM requirements for production orders.

ALTER TABLE `production_orders`
ADD COLUMN `generated_bom` LONGTEXT NULL;
