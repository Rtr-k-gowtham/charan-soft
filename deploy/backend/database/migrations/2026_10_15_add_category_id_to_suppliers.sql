-- Migration: Add category_id to suppliers table referencing categories(id)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS category_id INT(11) NULL DEFAULT NULL AFTER name;

-- Add foreign key constraint if it doesn't already exist
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'suppliers' 
      AND CONSTRAINT_NAME = 'fk_suppliers_category'
);

SET @sql = IF(@fk_exists = 0, 
    'ALTER TABLE suppliers ADD CONSTRAINT fk_suppliers_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL', 
    'SELECT "Constraint fk_suppliers_category already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index on category_id for fast join queries
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'suppliers' 
      AND INDEX_NAME = 'idx_suppliers_category_id'
);

SET @sql_idx = IF(@idx_exists = 0, 
    'CREATE INDEX idx_suppliers_category_id ON suppliers (category_id)', 
    'SELECT "Index idx_suppliers_category_id already exists"'
);

PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;
