-- Migration: Add preferred_colors column to customers table for buyer-specific brand colors
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_colors LONGTEXT NULL;

