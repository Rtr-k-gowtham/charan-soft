-- Migration: Category and Purchase Order Terms & Conditions
-- Cheran Soft Goods Textile Manufacturing ERP

CREATE TABLE IF NOT EXISTS category_terms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    term_key VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    content TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ct_category_id (category_id),
    CONSTRAINT fk_category_terms_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_terms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id INT NOT NULL,
    term_key VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    content TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pot_po_id (purchase_order_id),
    CONSTRAINT fk_po_terms_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Populate default terms into category_terms for existing categories that have no terms yet
-- Uses po_template_terms if available, otherwise inserts standard textile terms
INSERT INTO category_terms (category_id, term_key, title, content, display_order, is_active)
SELECT c.id, pt.term_key, pt.title, pt.content, pt.display_order, pt.is_active
FROM categories c
CROSS JOIN po_template_terms pt
WHERE NOT EXISTS (
    SELECT 1 FROM category_terms ct WHERE ct.category_id = c.id
);
