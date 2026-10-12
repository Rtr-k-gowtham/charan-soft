-- ==========================================================
-- CHERAN SOFT GOODS - PO TEMPLATE SETTINGS SCHEMA & SEED
-- Database: u868013330_cheran
-- ==========================================================

-- 1. PO Template General Settings Table
CREATE TABLE IF NOT EXISTS po_template_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NULL,
    setting_group VARCHAR(50) NOT NULL DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pts_group (setting_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Item Table Columns Configuration Table
CREATE TABLE IF NOT EXISTS po_template_columns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    column_key VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    width VARCHAR(50) NOT NULL DEFAULT 'auto',
    alignment ENUM('left', 'center', 'right') NOT NULL DEFAULT 'left',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Process / Production Fields Configuration Table
CREATE TABLE IF NOT EXISTS po_template_process_fields (
    id INT AUTO_INCREMENT PRIMARY KEY,
    field_key VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Terms & Conditions Table
CREATE TABLE IF NOT EXISTS po_template_terms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    term_key VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    content TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Signature Blocks Table
CREATE TABLE IF NOT EXISTS po_template_signatures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    name VARCHAR(100) NULL,
    designation VARCHAR(100) NULL,
    show_signature_line BOOLEAN NOT NULL DEFAULT TRUE,
    show_date BOOLEAN NOT NULL DEFAULT TRUE,
    show_stamp BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================
-- DEFAULT SEED VALUES (Safe INSERT ... ON DUPLICATE KEY UPDATE)
-- ==========================================================

-- Company & Header Settings
INSERT INTO po_template_settings (setting_key, setting_value, setting_group) VALUES
('company_logo', '', 'company'),
('company_name', 'Cheran Soft Goods Pvt Ltd.', 'company'),
('company_legal_name', 'Cheran Soft Goods Private Limited', 'company'),
('address_line1', '1-A, Muthaladampatty South,', 'company'),
('address_line2', 'Cheran Nagar, Thanthondimalai Post', 'company'),
('city', 'Karur', 'company'),
('district', 'Karur', 'company'),
('state', 'Tamil Nadu', 'company'),
('country', 'India', 'company'),
('pincode', '639 005', 'company'),
('phone', '+91 4324 220000', 'company'),
('alt_phone', '+91 94432 00000', 'company'),
('email', 'info@cheransoftgoods.in', 'company'),
('website', 'www.cheransoftgoods.in', 'company'),
('gstin', '33AAFCC2831H1Z1', 'company'),
('pan', 'AAFCC2831H', 'company'),
('cin', 'U17111TZ2020PTC034567', 'company'),
('udyam', 'UDYAM-TN-12-0012345', 'company'),
('document_title', 'FABRIC PRINTING PROCESS ORDER', 'company'),
('document_subtitle', 'PURCHASE ORDER', 'company'),
('document_prefix', 'PO', 'company'),
('show_logo', '1', 'company'),
('show_gstin', '1', 'company'),
('show_phone', '1', 'company'),
('show_email', '1', 'company'),
('show_website', '1', 'company'),
('logo_position', 'left', 'company')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- PO Document Settings
INSERT INTO po_template_settings (setting_key, setting_value, setting_group) VALUES
('po_number_label', 'PO No.', 'document'),
('po_date_label', 'PO Date', 'document'),
('delivery_date_label', 'Delivery Date', 'document'),
('reference_no_label', 'Ref No.', 'document'),
('supplier_label', 'Supplier', 'document'),
('status_label', 'Status', 'document'),
('show_status', '1', 'document')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Supplier Section Settings
INSERT INTO po_template_settings (setting_key, setting_value, setting_group) VALUES
('supplier_section_title', 'TO / SUPPLIER', 'supplier'),
('show_supplier_code', '1', 'supplier'),
('show_supplier_name', '1', 'supplier'),
('show_supplier_address', '1', 'supplier'),
('show_supplier_contact', '1', 'supplier'),
('show_supplier_phone', '1', 'supplier'),
('show_supplier_email', '1', 'supplier'),
('show_supplier_gstin', '1', 'supplier'),
('show_supplier_pan', '0', 'supplier'),
('show_supplier_state', '1', 'supplier'),
('show_supplier_country', '1', 'supplier'),
('show_supplier_payment_terms', '1', 'supplier'),
('show_supplier_credit_days', '1', 'supplier')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Process Details Settings
INSERT INTO po_template_settings (setting_key, setting_value, setting_group) VALUES
('enable_process_section', '1', 'process'),
('process_section_title', 'PROCESS / PRODUCTION DETAILS', 'process'),
('process_description', 'Materials to be processed strictly according to technical specifications and quality parameters.', 'process'),
('process_stages', 'Singeing, Mercerizing, Printing, Washing, Finishing, Inspection', 'process')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Tax & Totals Settings
INSERT INTO po_template_settings (setting_key, setting_value, setting_group) VALUES
('show_subtotal', '1', 'tax_totals'),
('show_discount', '1', 'tax_totals'),
('show_taxable_amount', '1', 'tax_totals'),
('show_cgst', '1', 'tax_totals'),
('show_sgst', '1', 'tax_totals'),
('show_igst', '0', 'tax_totals'),
('show_other_charges', '0', 'tax_totals'),
('show_round_off', '1', 'tax_totals'),
('show_grand_total', '1', 'tax_totals'),
('subtotal_label', 'Subtotal', 'tax_totals'),
('discount_label', 'Discount', 'tax_totals'),
('taxable_amount_label', 'Taxable Amount', 'tax_totals'),
('cgst_label', 'CGST', 'tax_totals'),
('sgst_label', 'SGST', 'tax_totals'),
('igst_label', 'IGST', 'tax_totals'),
('other_charges_label', 'Other Charges', 'tax_totals'),
('round_off_label', 'Round Off', 'tax_totals'),
('grand_total_label', 'Grand Total', 'tax_totals'),
('tax_display', 'Percentage + Amount', 'tax_totals'),
('tax_mode', 'CGST + SGST', 'tax_totals'),
('currency', 'INR', 'tax_totals'),
('currency_symbol', '₹', 'tax_totals'),
('decimal_places', '2', 'tax_totals')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Amount in Words Settings
INSERT INTO po_template_settings (setting_key, setting_value, setting_group) VALUES
('enable_amount_in_words', '1', 'amount_in_words'),
('amount_in_words_title', 'AMOUNT IN WORDS', 'amount_in_words'),
('amount_in_words_prefix', 'RUPEES', 'amount_in_words'),
('amount_in_words_suffix', 'ONLY', 'amount_in_words'),
('amount_in_words_case', 'UPPERCASE', 'amount_in_words')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Footer Settings
INSERT INTO po_template_settings (setting_key, setting_value, setting_group) VALUES
('footer_text', 'This is a computer generated purchase order. Valid without physical signature if approved digitally.', 'footer'),
('footer_line1', 'Subject to Karur Jurisdiction. Goods once accepted cannot be returned without Return Memo.', 'footer'),
('footer_line2', '', 'footer'),
('footer_show_company_name', '1', 'footer'),
('footer_show_address', '1', 'footer'),
('footer_show_gstin', '1', 'footer'),
('footer_show_website', '1', 'footer'),
('footer_show_page_number', '1', 'footer'),
('footer_show_generated_date', '1', 'footer'),
('footer_show_generated_by', '1', 'footer'),
('footer_page_format', 'Page {current} of {total}', 'footer')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Print & Layout Settings
INSERT INTO po_template_settings (setting_key, setting_value, setting_group) VALUES
('paper_size', 'A4', 'print_layout'),
('orientation', 'Portrait', 'print_layout'),
('margin_top', '10mm', 'print_layout'),
('margin_right', '10mm', 'print_layout'),
('margin_bottom', '10mm', 'print_layout'),
('margin_left', '10mm', 'print_layout'),
('header_height', '40mm', 'print_layout'),
('footer_height', '25mm', 'print_layout'),
('font_family', 'Inter, sans-serif', 'print_layout'),
('font_size', '12px', 'print_layout'),
('table_font_size', '10.5px', 'print_layout'),
('heading_font_size', '14px', 'print_layout'),
('line_height', '1.4', 'print_layout'),
('border_style', 'solid', 'print_layout'),
('border_width', '1px', 'print_layout'),
('border_radius', '4px', 'print_layout'),
('primary_color', '#1e3a8a', 'print_layout'),
('secondary_color', '#0f766e', 'print_layout'),
('text_color', '#1e293b', 'print_layout'),
('table_header_bg', '#f1f5f9', 'print_layout'),
('repeat_header', '1', 'print_layout'),
('repeat_table_header', '1', 'print_layout'),
('show_page_number', '1', 'print_layout'),
('show_footer', '1', 'print_layout')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- PO Numbering Settings
INSERT INTO po_template_settings (setting_key, setting_value, setting_group) VALUES
('numbering_prefix', 'PO', 'numbering'),
('numbering_financial_year', '2026-27', 'numbering'),
('numbering_separator', '-', 'numbering'),
('numbering_starting_number', '1', 'numbering'),
('numbering_minimum_digits', '5', 'numbering'),
('numbering_reset_every_fy', '1', 'numbering'),
('numbering_preview', 'PO-2026-27-00001', 'numbering')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- ==========================================================
-- DEFAULT ITEM TABLE COLUMNS (23 Columns)
-- ==========================================================
INSERT INTO po_template_columns (column_key, label, is_visible, display_order, width, alignment) VALUES
('serial_no', '#', 1, 1, '35px', 'center'),
('order_no', 'Order No.', 0, 2, '80px', 'left'),
('item_code', 'Item Code', 0, 3, '80px', 'left'),
('item_description', 'Item Description', 1, 4, '200px', 'left'),
('hsn_sac', 'HSN/SAC', 1, 5, '70px', 'center'),
('fabric_type', 'Fabric Type', 1, 6, '90px', 'left'),
('width', 'Width', 1, 7, '55px', 'center'),
('construction', 'Construction', 1, 8, '90px', 'left'),
('design', 'Design', 1, 9, '80px', 'left'),
('color', 'Color', 1, 10, '75px', 'left'),
('process', 'Process', 1, 11, '85px', 'left'),
('quantity', 'Quantity', 1, 12, '70px', 'right'),
('uom', 'UOM', 1, 13, '50px', 'center'),
('weight_kgs', 'KGS', 1, 14, '65px', 'right'),
('rate', 'Rate', 1, 15, '70px', 'right'),
('discount', 'Discount', 0, 16, '60px', 'right'),
('tax_percent', 'Tax %', 1, 17, '55px', 'right'),
('taxable_amount', 'Taxable Amount', 1, 18, '85px', 'right'),
('cgst', 'CGST', 1, 19, '70px', 'right'),
('sgst', 'SGST', 1, 20, '70px', 'right'),
('igst', 'IGST', 0, 21, '70px', 'right'),
('tax_amount', 'Tax Amount', 0, 22, '75px', 'right'),
('net_amount', 'Net Amount', 1, 23, '95px', 'right')
ON DUPLICATE KEY UPDATE 
    label = VALUES(label),
    is_visible = VALUES(is_visible),
    display_order = VALUES(display_order),
    width = VALUES(width),
    alignment = VALUES(alignment);

-- ==========================================================
-- DEFAULT PROCESS FIELDS
-- ==========================================================
INSERT INTO po_template_process_fields (field_key, label, is_visible, display_order) VALUES
('fabric_type', 'Fabric Type', 1, 1),
('fabric_construction', 'Fabric Construction', 1, 2),
('width', 'Width', 1, 3),
('gsm', 'GSM', 1, 4),
('count', 'Count', 1, 5),
('design', 'Design', 1, 6),
('color', 'Color', 1, 7),
('printing_type', 'Printing Type', 1, 8),
('printing_method', 'Printing Method', 1, 9),
('process_route', 'Process Route', 1, 10),
('finishing', 'Finishing', 1, 11),
('quality_requirement', 'Quality Requirement', 1, 12),
('special_instructions', 'Special Instructions', 1, 13)
ON DUPLICATE KEY UPDATE 
    label = VALUES(label),
    is_visible = VALUES(is_visible),
    display_order = VALUES(display_order);

-- ==========================================================
-- DEFAULT TERMS & CONDITIONS
-- ==========================================================
INSERT INTO po_template_terms (term_key, title, content, display_order, is_active) VALUES
('payment_terms', 'Payment Terms', 'Payment within 30 days against receipt of material and quality acceptance.', 1, 1),
('delivery_terms', 'Delivery Terms', 'Delivery must be strictly adhered to the promised due date at our factory gate.', 2, 1),
('quality_terms', 'Quality Terms', 'Material must match approved strike-off / lab dips and meet 4-point inspection standards.', 3, 1),
('inspection_terms', 'Inspection Terms', 'Rejection of substandard or shade-deviated goods will be debited to supplier account.', 4, 1),
('tax_terms', 'Tax Terms', 'Taxes as applicable per statutory GST guidelines against original Tax Invoice.', 5, 1),
('transport_terms', 'Transport Terms', 'Goods must be securely packed and delivered with relevant delivery challan and e-Way bill.', 6, 1),
('cancellation_terms', 'Cancellation Terms', 'Buyer reserves the right to cancel the order partially or fully in case of undue delivery delay.', 7, 1),
('general_terms', 'General Terms', 'All disputes are subject to the exclusive jurisdiction of the Courts at Karur.', 8, 1)
ON DUPLICATE KEY UPDATE 
    title = VALUES(title),
    content = VALUES(content),
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);

-- ==========================================================
-- DEFAULT SIGNATURE BLOCKS
-- ==========================================================
INSERT INTO po_template_signatures (title, name, designation, show_signature_line, show_date, show_stamp, display_order) VALUES
('Prepared By', 'Merchandiser', 'Purchase & Sourcing Officer', 1, 1, 0, 1),
('Checked By', 'Quality In-charge', 'Fabric Technical Manager', 1, 1, 0, 2),
('Approved By', 'Managing Director', 'Authorized Signatory', 1, 1, 1, 3),
('Supplier Acknowledgement', 'M/s. MRC Mills Pvt Ltd', 'Accepted & Signed by Supplier', 1, 1, 1, 4)
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    designation = VALUES(designation),
    show_signature_line = VALUES(show_signature_line),
    show_date = VALUES(show_date),
    show_stamp = VALUES(show_stamp),
    display_order = VALUES(display_order);
