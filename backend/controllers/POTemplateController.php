<?php
// backend/controllers/POTemplateController.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/AuditLogger.php';

class POTemplateController {

    private function getDefaultSettings(): array {
        return [
            // Company & Header
            'company_logo' => '/logo.png',
            'company_name' => 'Cheran Soft Goods Pvt Ltd.',
            'company_legal_name' => 'Cheran Soft Goods Private Limited',
            'address_line1' => '1-A, Muthaladampatty South,',
            'address_line2' => 'Cheran Nagar, Thanthondimalai Post',
            'city' => 'Karur',
            'district' => 'Karur',
            'state' => 'Tamil Nadu',
            'country' => 'India',
            'pincode' => '639 005',
            'phone' => '+91 4324 220000',
            'alt_phone' => '+91 94432 00000',
            'email' => 'info@cheransoftgoods.in',
            'website' => 'www.cheransoftgoods.in',
            'gstin' => '33AAFCC2831H1Z1',
            'pan' => 'AAFCC2831H',
            'cin' => 'U17111TZ2020PTC034567',
            'udyam' => 'UDYAM-TN-12-0012345',
            'document_title' => 'FABRIC PRINTING PROCESS ORDER',
            'document_subtitle' => 'PURCHASE ORDER',
            'document_prefix' => 'PO',
            'show_logo' => '1',
            'show_gstin' => '1',
            'show_phone' => '1',
            'show_email' => '1',
            'show_website' => '1',
            'logo_position' => 'center',

            // PO Document
            'po_number_label' => 'PO No.',
            'po_date_label' => 'PO Date',
            'delivery_date_label' => 'Delivery Date',
            'reference_no_label' => 'Ref No.',
            'supplier_label' => 'Supplier',
            'status_label' => 'Status',
            'show_status' => '1',

            // Supplier Section
            'supplier_section_title' => 'TO / SUPPLIER',
            'show_supplier_code' => '1',
            'show_supplier_name' => '1',
            'show_supplier_address' => '1',
            'show_supplier_contact' => '1',
            'show_supplier_phone' => '1',
            'show_supplier_email' => '1',
            'show_supplier_gstin' => '1',
            'show_supplier_pan' => '0',
            'show_supplier_state' => '1',
            'show_supplier_country' => '1',
            'show_supplier_payment_terms' => '1',
            'show_supplier_credit_days' => '1',

            // Process Details
            'enable_process_section' => '1',
            'process_section_title' => 'PROCESS / PRODUCTION DETAILS',
            'process_description' => 'Materials to be processed strictly according to technical specifications and quality parameters.',
            'process_stages' => 'Singeing, Mercerizing, Printing, Washing, Finishing, Inspection',

            // Tax & Totals
            'show_subtotal' => '1',
            'show_discount' => '1',
            'show_taxable_amount' => '1',
            'show_cgst' => '1',
            'show_sgst' => '1',
            'show_igst' => '0',
            'show_other_charges' => '0',
            'show_round_off' => '1',
            'show_grand_total' => '1',
            'subtotal_label' => 'Subtotal',
            'discount_label' => 'Discount',
            'taxable_amount_label' => 'Taxable Amount',
            'cgst_label' => 'CGST',
            'sgst_label' => 'SGST',
            'igst_label' => 'IGST',
            'other_charges_label' => 'Other Charges',
            'round_off_label' => 'Round Off',
            'grand_total_label' => 'Grand Total',
            'tax_display' => 'Percentage + Amount',
            'tax_mode' => 'CGST + SGST',
            'currency' => 'INR',
            'currency_symbol' => '₹',
            'decimal_places' => '2',

            // Amount in Words
            'enable_amount_in_words' => '1',
            'amount_in_words_title' => 'AMOUNT IN WORDS',
            'amount_in_words_prefix' => 'RUPEES',
            'amount_in_words_suffix' => 'ONLY',
            'amount_in_words_case' => 'UPPERCASE',

            // Footer
            'footer_text' => 'This is a computer generated purchase order. Valid without physical signature if approved digitally.',
            'footer_line1' => 'Subject to Karur Jurisdiction. Goods once accepted cannot be returned without Return Memo.',
            'footer_line2' => '',
            'footer_show_company_name' => '1',
            'footer_show_address' => '1',
            'footer_show_gstin' => '1',
            'footer_show_website' => '1',
            'footer_show_page_number' => '1',
            'footer_show_generated_date' => '1',
            'footer_show_generated_by' => '1',
            'footer_page_format' => 'Page {current} of {total}',

            // Print & Layout
            'paper_size' => 'A4',
            'orientation' => 'Portrait',
            'margin_top' => '10mm',
            'margin_right' => '10mm',
            'margin_bottom' => '10mm',
            'margin_left' => '10mm',
            'header_height' => '40mm',
            'footer_height' => '25mm',
            'font_family' => 'Poppins, sans-serif',
            'font_size' => '12px',
            'table_font_size' => '10.5px',
            'heading_font_size' => '14px',
            'line_height' => '1.4',
            'border_style' => 'solid',
            'border_width' => '1px',
            'border_radius' => '4px',
            'primary_color' => '#1e3a8a',
            'secondary_color' => '#0f766e',
            'text_color' => '#1e293b',
            'table_header_bg' => '#f1f5f9',
            'repeat_header' => '1',
            'repeat_table_header' => '1',
            'show_page_number' => '1',
            'show_footer' => '1',

            // PO Numbering
            'numbering_prefix' => 'PO',
            'numbering_financial_year' => '2026-27',
            'numbering_separator' => '-',
            'numbering_starting_number' => '1',
            'numbering_minimum_digits' => '5',
            'numbering_reset_every_fy' => '1',
            'numbering_preview' => 'PO-2026-27-00001'
        ];
    }

    private function getDefaultColumns(): array {
        return [
            ['column_key' => 'serial_no', 'label' => '#', 'is_visible' => 1, 'display_order' => 1, 'width' => '35px', 'alignment' => 'center'],
            ['column_key' => 'order_no', 'label' => 'Order No.', 'is_visible' => 0, 'display_order' => 2, 'width' => '80px', 'alignment' => 'left'],
            ['column_key' => 'item_code', 'label' => 'Item Code', 'is_visible' => 0, 'display_order' => 3, 'width' => '80px', 'alignment' => 'left'],
            ['column_key' => 'item_description', 'label' => 'Item Description', 'is_visible' => 1, 'display_order' => 4, 'width' => '200px', 'alignment' => 'left'],
            ['column_key' => 'hsn_sac', 'label' => 'HSN/SAC', 'is_visible' => 1, 'display_order' => 5, 'width' => '70px', 'alignment' => 'center'],
            ['column_key' => 'fabric_type', 'label' => 'Fabric Type', 'is_visible' => 1, 'display_order' => 6, 'width' => '90px', 'alignment' => 'left'],
            ['column_key' => 'width', 'label' => 'Width', 'is_visible' => 1, 'display_order' => 7, 'width' => '55px', 'alignment' => 'center'],
            ['column_key' => 'construction', 'label' => 'Construction', 'is_visible' => 1, 'display_order' => 8, 'width' => '90px', 'alignment' => 'left'],
            ['column_key' => 'design', 'label' => 'Design', 'is_visible' => 1, 'display_order' => 9, 'width' => '80px', 'alignment' => 'left'],
            ['column_key' => 'color', 'label' => 'Color', 'is_visible' => 1, 'display_order' => 10, 'width' => '75px', 'alignment' => 'left'],
            ['column_key' => 'process', 'label' => 'Process', 'is_visible' => 1, 'display_order' => 11, 'width' => '85px', 'alignment' => 'left'],
            ['column_key' => 'quantity', 'label' => 'Quantity', 'is_visible' => 1, 'display_order' => 12, 'width' => '70px', 'alignment' => 'right'],
            ['column_key' => 'uom', 'label' => 'UOM', 'is_visible' => 1, 'display_order' => 13, 'width' => '50px', 'alignment' => 'center'],
            ['column_key' => 'weight_kgs', 'label' => 'KGS', 'is_visible' => 1, 'display_order' => 14, 'width' => '65px', 'alignment' => 'right'],
            ['column_key' => 'rate', 'label' => 'Rate', 'is_visible' => 1, 'display_order' => 15, 'width' => '70px', 'alignment' => 'right'],
            ['column_key' => 'discount', 'label' => 'Discount', 'is_visible' => 0, 'display_order' => 16, 'width' => '60px', 'alignment' => 'right'],
            ['column_key' => 'tax_percent', 'label' => 'Tax %', 'is_visible' => 1, 'display_order' => 17, 'width' => '55px', 'alignment' => 'right'],
            ['column_key' => 'taxable_amount', 'label' => 'Taxable Amount', 'is_visible' => 1, 'display_order' => 18, 'width' => '85px', 'alignment' => 'right'],
            ['column_key' => 'cgst', 'label' => 'CGST', 'is_visible' => 1, 'display_order' => 19, 'width' => '70px', 'alignment' => 'right'],
            ['column_key' => 'sgst', 'label' => 'SGST', 'is_visible' => 1, 'display_order' => 20, 'width' => '70px', 'alignment' => 'right'],
            ['column_key' => 'igst', 'label' => 'IGST', 'is_visible' => 0, 'display_order' => 21, 'width' => '70px', 'alignment' => 'right'],
            ['column_key' => 'tax_amount', 'label' => 'Tax Amount', 'is_visible' => 0, 'display_order' => 22, 'width' => '75px', 'alignment' => 'right'],
            ['column_key' => 'net_amount', 'label' => 'Net Amount', 'is_visible' => 1, 'display_order' => 23, 'width' => '95px', 'alignment' => 'right']
        ];
    }

    private function getDefaultProcessFields(): array {
        return [
            ['field_key' => 'fabric_type', 'label' => 'Fabric Type', 'is_visible' => 1, 'display_order' => 1],
            ['field_key' => 'fabric_construction', 'label' => 'Fabric Construction', 'is_visible' => 1, 'display_order' => 2],
            ['field_key' => 'width', 'label' => 'Width', 'is_visible' => 1, 'display_order' => 3],
            ['field_key' => 'gsm', 'label' => 'GSM', 'is_visible' => 1, 'display_order' => 4],
            ['field_key' => 'count', 'label' => 'Count', 'is_visible' => 1, 'display_order' => 5],
            ['field_key' => 'design', 'label' => 'Design', 'is_visible' => 1, 'display_order' => 6],
            ['field_key' => 'color', 'label' => 'Color', 'is_visible' => 1, 'display_order' => 7],
            ['field_key' => 'printing_type', 'label' => 'Printing Type', 'is_visible' => 1, 'display_order' => 8],
            ['field_key' => 'printing_method', 'label' => 'Printing Method', 'is_visible' => 1, 'display_order' => 9],
            ['field_key' => 'process_route', 'label' => 'Process Route', 'is_visible' => 1, 'display_order' => 10],
            ['field_key' => 'finishing', 'label' => 'Finishing', 'is_visible' => 1, 'display_order' => 11],
            ['field_key' => 'quality_requirement', 'label' => 'Quality Requirement', 'is_visible' => 1, 'display_order' => 12],
            ['field_key' => 'special_instructions', 'label' => 'Special Instructions', 'is_visible' => 1, 'display_order' => 13]
        ];
    }

    private function getDefaultTerms(): array {
        return [
            ['term_key' => 'payment_terms', 'title' => 'Payment Terms', 'content' => 'Payment within 30 days against receipt of material and quality acceptance.', 'display_order' => 1, 'is_active' => 1],
            ['term_key' => 'delivery_terms', 'title' => 'Delivery Terms', 'content' => 'Delivery must be strictly adhered to the promised due date at our factory gate.', 'display_order' => 2, 'is_active' => 1],
            ['term_key' => 'quality_terms', 'title' => 'Quality Terms', 'content' => 'Material must match approved strike-off / lab dips and meet 4-point inspection standards.', 'display_order' => 3, 'is_active' => 1],
            ['term_key' => 'inspection_terms', 'title' => 'Inspection Terms', 'content' => 'Rejection of substandard or shade-deviated goods will be debited to supplier account.', 'display_order' => 4, 'is_active' => 1],
            ['term_key' => 'tax_terms', 'title' => 'Tax Terms', 'content' => 'Taxes as applicable per statutory GST guidelines against original Tax Invoice.', 'display_order' => 5, 'is_active' => 1],
            ['term_key' => 'transport_terms', 'title' => 'Transport Terms', 'content' => 'Goods must be securely packed and delivered with relevant delivery challan and e-Way bill.', 'display_order' => 6, 'is_active' => 1],
            ['term_key' => 'cancellation_terms', 'title' => 'Cancellation Terms', 'content' => 'Buyer reserves the right to cancel the order partially or fully in case of undue delivery delay.', 'display_order' => 7, 'is_active' => 1],
            ['term_key' => 'general_terms', 'title' => 'General Terms', 'content' => 'All disputes are subject to the exclusive jurisdiction of the Courts at Karur.', 'display_order' => 8, 'is_active' => 1]
        ];
    }

    private function getDefaultSignatures(): array {
        return [
            ['title' => 'Prepared By', 'name' => 'Merchandiser', 'designation' => 'Purchase & Sourcing Officer', 'show_signature_line' => 1, 'show_date' => 1, 'show_stamp' => 0, 'display_order' => 1],
            ['title' => 'Checked By', 'name' => 'Quality In-charge', 'designation' => 'Fabric Technical Manager', 'show_signature_line' => 1, 'show_date' => 1, 'show_stamp' => 0, 'display_order' => 2],
            ['title' => 'Approved By', 'name' => 'Managing Director', 'designation' => 'Authorized Signatory', 'show_signature_line' => 1, 'show_date' => 1, 'show_stamp' => 1, 'display_order' => 3],
            ['title' => 'Supplier Acknowledgement', 'name' => 'M/s. MRC Mills Pvt Ltd', 'designation' => 'Accepted & Signed by Supplier', 'show_signature_line' => 1, 'show_date' => 1, 'show_stamp' => 1, 'display_order' => 4]
        ];
    }

    private function ensureTablesExist(PDO $pdo): void {
        try {
            // 1. Settings Table
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS po_template_settings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    setting_key VARCHAR(100) NOT NULL UNIQUE,
                    setting_value TEXT NULL,
                    setting_group VARCHAR(50) NOT NULL DEFAULT 'general',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_pts_group (setting_group)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // 2. Columns Table
            $pdo->exec("
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
            ");

            // 3. Process Fields Table
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS po_template_process_fields (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    field_key VARCHAR(50) NOT NULL UNIQUE,
                    label VARCHAR(100) NOT NULL,
                    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
                    display_order INT NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // 4. Terms Table
            $pdo->exec("
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
            ");

            // 5. Signatures Table
            $pdo->exec("
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
            ");

            // If empty, auto-populate with reference defaults
            $count = (int)$pdo->query("SELECT COUNT(*) FROM po_template_settings")->fetchColumn();
            if ($count === 0) {
                $this->seedDefaults($pdo);
            }
        } catch (\Throwable $e) {
            error_log("POTemplate ensureTables error: " . $e->getMessage());
        }
    }

    private function seedDefaults(PDO $pdo): void {
        try {
            $defaults = $this->getDefaultSettings();
            $stmt = $pdo->prepare("INSERT INTO po_template_settings (setting_key, setting_value, setting_group) VALUES (?, ?, 'general') ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
            foreach ($defaults as $k => $v) {
                $stmt->execute([$k, $v]);
            }

            // Columns
            $cols = $this->getDefaultColumns();
            $cStmt = $pdo->prepare("INSERT INTO po_template_columns (column_key, label, is_visible, display_order, width, alignment) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE label=VALUES(label), is_visible=VALUES(is_visible), display_order=VALUES(display_order), width=VALUES(width), alignment=VALUES(alignment)");
            foreach ($cols as $c) {
                $cStmt->execute([$c['column_key'], $c['label'], $c['is_visible'], $c['display_order'], $c['width'], $c['alignment']]);
            }

            // Process fields
            $pfields = $this->getDefaultProcessFields();
            $pfStmt = $pdo->prepare("INSERT INTO po_template_process_fields (field_key, label, is_visible, display_order) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE label=VALUES(label), is_visible=VALUES(is_visible), display_order=VALUES(display_order)");
            foreach ($pfields as $pf) {
                $pfStmt->execute([$pf['field_key'], $pf['label'], $pf['is_visible'], $pf['display_order']]);
            }

            // Terms
            $terms = $this->getDefaultTerms();
            $tStmt = $pdo->prepare("INSERT INTO po_template_terms (term_key, title, content, display_order, is_active) VALUES (?, ?, ?, ?, ?)");
            $pdo->exec("DELETE FROM po_template_terms");
            foreach ($terms as $t) {
                $tStmt->execute([$t['term_key'], $t['title'], $t['content'], $t['display_order'], $t['is_active']]);
            }

            // Signatures
            $sigs = $this->getDefaultSignatures();
            $sStmt = $pdo->prepare("INSERT INTO po_template_signatures (title, name, designation, show_signature_line, show_date, show_stamp, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $pdo->exec("DELETE FROM po_template_signatures");
            foreach ($sigs as $s) {
                $sStmt->execute([$s['title'], $s['name'], $s['designation'], $s['show_signature_line'], $s['show_date'], $s['show_stamp'], $s['display_order']]);
            }
        } catch (\Throwable $e) {
            error_log("POTemplate seedDefaults error: " . $e->getMessage());
        }
    }

    public function getSettings(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureTablesExist($pdo);

            $defaults = $this->getDefaultSettings();
            $columns = $this->getDefaultColumns();
            $processFields = $this->getDefaultProcessFields();
            $terms = $this->getDefaultTerms();
            $signatures = $this->getDefaultSignatures();
            $lastUpdated = date('Y-m-d H:i:s');

            // Try reading from database
            try {
                $settingsRows = $pdo->query("SELECT setting_key, setting_value FROM po_template_settings")->fetchAll();
                if (!empty($settingsRows)) {
                    foreach ($settingsRows as $row) {
                        $defaults[$row['setting_key']] = $row['setting_value'];
                    }
                }
                // Enforce center alignment and logo path
                $defaults['logo_position'] = 'center';
                if (empty($defaults['company_logo']) || $defaults['company_logo'] === 'https://example.com/logo.png') {
                    $defaults['company_logo'] = '/logo.png';
                }

                $dbCols = $pdo->query("SELECT * FROM po_template_columns ORDER BY display_order ASC, id ASC")->fetchAll();
                if (!empty($dbCols)) {
                    $columns = $dbCols;
                }

                $dbPfs = $pdo->query("SELECT * FROM po_template_process_fields ORDER BY display_order ASC, id ASC")->fetchAll();
                if (!empty($dbPfs)) {
                    $processFields = $dbPfs;
                }

                $dbTerms = $pdo->query("SELECT * FROM po_template_terms ORDER BY display_order ASC, id ASC")->fetchAll();
                if (!empty($dbTerms)) {
                    $terms = $dbTerms;
                }

                $dbSigs = $pdo->query("SELECT * FROM po_template_signatures ORDER BY display_order ASC, id ASC")->fetchAll();
                if (!empty($dbSigs)) {
                    $signatures = $dbSigs;
                }

                $dbLastUpdated = $pdo->query("SELECT MAX(updated_at) as last_updated FROM po_template_settings")->fetchColumn();
                if ($dbLastUpdated) {
                    $lastUpdated = $dbLastUpdated;
                }

                // Fetch PO categories with dynamic fields
                $categories = [];
                try {
                    $catStmt = $pdo->query("SELECT id, name, code, type, description, sort_order FROM categories WHERE (status = 'active' OR status IS NULL) ORDER BY sort_order ASC, name ASC");
                    $categories = $catStmt->fetchAll();
                    $cfStmt = $pdo->prepare("SELECT id, category_id, field_name, field_label, field_type, is_required, is_visible, sort_order FROM category_fields WHERE category_id = :cid ORDER BY sort_order ASC, id ASC");
                    foreach ($categories as &$c) {
                        $cfStmt->execute([':cid' => $c['id']]);
                        $c['fields'] = $cfStmt->fetchAll();
                    }
                } catch (\Throwable $catEx) {
                    error_log("POTemplate categories fetch: " . $catEx->getMessage());
                }
            } catch (\Throwable $dbEx) {
                error_log("POTemplate getSettings fallback to memory: " . $dbEx->getMessage());
            }

            Response::success([
                'settings' => $defaults,
                'columns' => $columns,
                'process_fields' => $processFields,
                'terms' => $terms,
                'signatures' => $signatures,
                'categories' => $categories ?? [],
                'metadata' => [
                    'last_updated' => $lastUpdated,
                    'updated_by' => 'Administrator',
                    'updated_date' => date('Y-m-d')
                ]
            ]);
        } catch (\Throwable $e) {
            error_log("POTemplate getSettings fatal error: " . $e->getMessage());
            // Even under severe DB outage, return default seed response so frontend does not get 500!
            Response::success([
                'settings' => $this->getDefaultSettings(),
                'columns' => $this->getDefaultColumns(),
                'process_fields' => $this->getDefaultProcessFields(),
                'terms' => $this->getDefaultTerms(),
                'signatures' => $this->getDefaultSignatures(),
                'categories' => [],
                'metadata' => [
                    'last_updated' => date('Y-m-d H:i:s'),
                    'updated_by' => 'Administrator',
                    'updated_date' => date('Y-m-d')
                ]
            ]);
        }
    }

    public function saveSettings(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $pdo = Database::getConnection();
            $this->ensureTablesExist($pdo);
            $pdo->beginTransaction();

            // 1. Save Settings Key-Values
            if (!empty($input['settings']) && is_array($input['settings'])) {
                $stmt = $pdo->prepare("
                    INSERT INTO po_template_settings (setting_key, setting_value, setting_group) 
                    VALUES (:k, :v, 'general')
                    ON DUPLICATE KEY UPDATE setting_value = :v2, updated_at = CURRENT_TIMESTAMP
                ");
                foreach ($input['settings'] as $k => $v) {
                    $stmt->execute([':k' => $k, ':v' => (string)$v, ':v2' => (string)$v]);
                }
            }

            // 2. Save Columns
            if (!empty($input['columns']) && is_array($input['columns'])) {
                $cStmt = $pdo->prepare("
                    INSERT INTO po_template_columns (column_key, label, is_visible, display_order, width, alignment)
                    VALUES (:key, :label, :vis, :ord, :w, :align)
                    ON DUPLICATE KEY UPDATE 
                        label = :label2, 
                        is_visible = :vis2, 
                        display_order = :ord2, 
                        width = :w2, 
                        alignment = :align2,
                        updated_at = CURRENT_TIMESTAMP
                ");
                foreach ($input['columns'] as $col) {
                    $cStmt->execute([
                        ':key' => $col['column_key'],
                        ':label' => $col['label'],
                        ':vis' => !empty($col['is_visible']) ? 1 : 0,
                        ':ord' => (int)($col['display_order'] ?? 0),
                        ':w' => $col['width'] ?? 'auto',
                        ':align' => in_array($col['alignment'] ?? '', ['left', 'center', 'right']) ? $col['alignment'] : 'left',
                        ':label2' => $col['label'],
                        ':vis2' => !empty($col['is_visible']) ? 1 : 0,
                        ':ord2' => (int)($col['display_order'] ?? 0),
                        ':w2' => $col['width'] ?? 'auto',
                        ':align2' => in_array($col['alignment'] ?? '', ['left', 'center', 'right']) ? $col['alignment'] : 'left',
                    ]);
                }
            }

            // 3. Save Process Fields
            if (!empty($input['process_fields']) && is_array($input['process_fields'])) {
                $pfStmt = $pdo->prepare("
                    INSERT INTO po_template_process_fields (field_key, label, is_visible, display_order)
                    VALUES (:key, :label, :vis, :ord)
                    ON DUPLICATE KEY UPDATE 
                        label = :label2, 
                        is_visible = :vis2, 
                        display_order = :ord2,
                        updated_at = CURRENT_TIMESTAMP
                ");
                foreach ($input['process_fields'] as $pf) {
                    $pfStmt->execute([
                        ':key' => $pf['field_key'],
                        ':label' => $pf['label'],
                        ':vis' => !empty($pf['is_visible']) ? 1 : 0,
                        ':ord' => (int)($pf['display_order'] ?? 0),
                        ':label2' => $pf['label'],
                        ':vis2' => !empty($pf['is_visible']) ? 1 : 0,
                        ':ord2' => (int)($pf['display_order'] ?? 0),
                    ]);
                }
            }

            // 4. Save Terms (Replace all terms to preserve user order and additions)
            if (isset($input['terms']) && is_array($input['terms'])) {
                $pdo->exec("DELETE FROM po_template_terms");
                $tStmt = $pdo->prepare("
                    INSERT INTO po_template_terms (term_key, title, content, display_order, is_active)
                    VALUES (?, ?, ?, ?, ?)
                ");
                foreach ($input['terms'] as $idx => $t) {
                    $tStmt->execute([
                        $t['term_key'] ?? ('term_' . ($idx + 1)),
                        $t['title'] ?? 'Terms',
                        $t['content'] ?? '',
                        (int)($t['display_order'] ?? ($idx + 1)),
                        !empty($t['is_active']) ? 1 : 0
                    ]);
                }
            }

            // 5. Save Signatures (Replace all to preserve custom blocks)
            if (isset($input['signatures']) && is_array($input['signatures'])) {
                $pdo->exec("DELETE FROM po_template_signatures");
                $sStmt = $pdo->prepare("
                    INSERT INTO po_template_signatures (title, name, designation, show_signature_line, show_date, show_stamp, display_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                foreach ($input['signatures'] as $idx => $s) {
                    $sStmt->execute([
                        $s['title'] ?? 'Signature',
                        $s['name'] ?? null,
                        $s['designation'] ?? null,
                        !empty($s['show_signature_line']) ? 1 : 0,
                        !empty($s['show_date']) ? 1 : 0,
                        !empty($s['show_stamp']) ? 1 : 0,
                        (int)($s['display_order'] ?? ($idx + 1))
                    ]);
                }
            }

            // 6. Save Category Fields / Columns if submitted
            if (!empty($input['category_fields']) && is_array($input['category_fields'])) {
                $cfStmt = $pdo->prepare("
                    UPDATE category_fields
                    SET field_label = :label, is_visible = :vis, sort_order = :ord
                    WHERE id = :id AND category_id = :cid
                ");
                foreach ($input['category_fields'] as $cf) {
                    if (!empty($cf['id']) && !empty($cf['category_id'])) {
                        $cfStmt->execute([
                            ':label' => $cf['field_label'] ?? $cf['label'] ?? '',
                            ':vis' => !empty($cf['is_visible']) ? 1 : 0,
                            ':ord' => (int)($cf['sort_order'] ?? 0),
                            ':id' => $cf['id'],
                            ':cid' => $cf['category_id']
                        ]);
                    }
                }
            }

            if (isset($input['category_column_configs'])) {
                $cfgJson = is_string($input['category_column_configs']) 
                    ? $input['category_column_configs'] 
                    : json_encode($input['category_column_configs']);
                $pdo->prepare("
                    INSERT INTO po_template_settings (setting_key, setting_value, setting_group)
                    VALUES ('category_column_configs', :cfg, 'general')
                    ON DUPLICATE KEY UPDATE setting_value = :cfg2, updated_at = CURRENT_TIMESTAMP
                ")->execute([':cfg' => $cfgJson, ':cfg2' => $cfgJson]);
            }

            $pdo->commit();
            AuditLogger::log('POTemplateSettings', 'UPDATE', 1, null, ['status' => 'success']);
            Response::success(null, "PO Template settings saved successfully");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function restoreDefaults(): void {
        try {
            $pdo = Database::getConnection();
            $this->ensureTablesExist($pdo);
            $pdo->beginTransaction();

            $pdo->exec("DELETE FROM po_template_settings");
            $pdo->exec("DELETE FROM po_template_columns");
            $pdo->exec("DELETE FROM po_template_process_fields");
            $pdo->exec("DELETE FROM po_template_terms");
            $pdo->exec("DELETE FROM po_template_signatures");

            $this->seedDefaults($pdo);

            $pdo->commit();
            AuditLogger::log('POTemplateSettings', 'RESTORE_DEFAULTS', 1, null, ['status' => 'restored']);
            Response::success(null, "Default PO Template settings restored successfully");
        } catch (Exception $e) {
            if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }
}
