// backend/server.js - Standalone Textile Manufacturing ERP API Server
// Zero-dependency Node.js HTTP server with full ERP domain logic & persistence
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed data
const initialData = {
  users: [
    { id: 1, name: 'Admin', username: 'admin', email: 'admin@cheransoftgoods.com', role: 'ADMIN', role_id: 1, role_name: 'System Administrator', phone: '+91 98422 10001', status: 'active', created_at: '2026-01-01' },
  ],
  roles: [
    { id: 1, name: 'ADMIN', display_name: 'System Administrator', description: 'Full access to all ERP modules' },
    { id: 2, name: 'PURCHASE_MGR', display_name: 'Purchase Manager', description: 'Create POs, approve payments, manage suppliers' },
    { id: 3, name: 'PROD_MGR', display_name: 'Production Head', description: 'Manage production runs, stage dispatch, cycle times' },
    { id: 4, name: 'QC_INSPECTOR', display_name: 'Quality Lead', description: 'Conduct QC checks, approve lots, log reworks' },
    { id: 5, name: 'INVENTORY_EXEC', display_name: 'Stores Executive', description: 'Goods receipt (GRN), adjustments, stock issue' },
  ],
  permissions: [
    { id: 1, module: 'Purchase', code: 'po.create', name: 'Create Purchase Order' },
    { id: 2, module: 'Purchase', code: 'po.approve', name: 'Approve Purchase Order' },
    { id: 3, module: 'Purchase', code: 'payment.record', name: 'Record Supplier Payment' },
    { id: 4, module: 'Inventory', code: 'stock.adjust', name: 'Stock Adjustment' },
    { id: 5, module: 'Inventory', code: 'stock.issue', name: 'Issue Material for Production' },
    { id: 6, module: 'Production', code: 'prod.stage_move', name: 'Move Production Stage' },
    { id: 7, module: 'QC', code: 'qc.inspect', name: 'Record Quality Inspection' },
    { id: 8, module: 'Settings', code: 'settings.users', name: 'Manage ERP Users' },
  ],
  categories: [
    { id: 1, code: 'FABRIC', name: 'Fabric & Greige', type: 'material', description: 'Raw and knitted textile fabrics' },
    { id: 2, code: 'YARN', name: 'Yarn & Spinning', type: 'material', description: 'Cotton, polyester, and blended yarns' },
    { id: 3, code: 'TRIMS', name: 'Trims & Fasteners', type: 'material', description: 'Zippers, buttons, elastics, labels' },
    { id: 4, code: 'DYES', name: 'Dyes & Chemicals', type: 'material', description: 'Reactive dyes, softening agents' },
    { id: 5, code: 'PACK', name: 'Packaging Materials', type: 'material', description: 'Poly bags, cartons, tags' },
    { id: 6, code: 'FABRIC_PO', name: 'FABRIC PO', type: 'order', description: 'PO template for woven/knitted fabric' },
    { id: 7, code: 'ACCESSORY_PO', name: 'ACCESSORY PO', type: 'order', description: 'PO template for garment trims & packaging' },
  ],
  suppliers: [
    { id: 1, code: 'SUP-001', name: 'ABC Textiles Mills Ltd', contact_person: 'V. Ramanathan', phone: '+91 94433 11223', email: 'sales@abctextiles.in', gstin: '33AABCT9988C1Z4', city: 'Tiruppur', state: 'Tamil Nadu' },
    { id: 2, code: 'SUP-002', name: 'Sri Balaji Yarn Spinners', contact_person: 'K. Balaji', phone: '+91 98431 55667', email: 'yarn@balajispin.com', gstin: '33AABCS4422D1Z8', city: 'Coimbatore', state: 'Tamil Nadu' },
    { id: 3, code: 'SUP-003', name: 'Apex Trims & Accessories', contact_person: 'G. Karthik', phone: '+91 97910 88990', email: 'support@apextrims.com', gstin: '33AABCA7711E1Z2', city: 'Karur', state: 'Tamil Nadu' },
    { id: 4, code: 'SUP-004', name: 'DyeChem Colours Pvt Ltd', contact_person: 'R. Srinivasan', phone: '+91 94422 33445', email: 'orders@dyechem.in', gstin: '33AABCD5533F1Z6', city: 'Erode', state: 'Tamil Nadu' },
  ],
  dyeingMills: [
    { id: 1, code: 'VEND-DYE-001', name: 'Allied Textiles', mill_type: 'Fabric Dyeing', contact_person: '', phone: '9843054566', email: '', city: 'Karur', state: 'Tamil Nadu', address: 'No.5, Kamadenunagar, Pugalur Road, karur-639001', gstin: '', daily_capacity_kg: 8500, lead_time_days: 5, specialization: 'Woven & Knitted Fabric Dyeing', payment_terms_days: 30, status: 'active' },
    { id: 2, code: 'VEND-DYE-002', name: 'Maxima Tex process Mill', mill_type: 'Soft Flow Processing', contact_person: '', phone: '7397752199', email: '', city: 'Karur', state: 'Tamil Nadu', address: 'S.F No. 228/2,232/1, Thaneerpandal Pudur, Punnamchatram (Po), Erode Mani Road, Karur 639163', gstin: '', daily_capacity_kg: 10000, lead_time_days: 5, specialization: 'Soft Flow Fabric Dyeing', payment_terms_days: 30, status: 'active' },
    { id: 3, code: 'VEND-DYE-003', name: 'Wintex Processing Mills', mill_type: 'Continuous Dyeing', contact_person: '', phone: '04288-240219', email: '', city: 'Namakkal', state: 'Tamil Nadu', address: '165,R.S. Road Pallipalayam Kumarapalayam, Namakkal DT', gstin: '', daily_capacity_kg: 12000, lead_time_days: 6, specialization: 'Continuous Bleaching & Dyeing', payment_terms_days: 30, status: 'active' },
    { id: 4, code: 'VEND-DYE-004', name: 'Sri Vedha Mill', mill_type: 'Yarn & Fabric Dyeing', contact_person: '', phone: '9047025261', email: '', city: 'Erode', state: 'Tamil Nadu', address: 'Near Eleiyathaal Kovil Nasiyanur Road, vallarasampatti (po), Erode', gstin: '', daily_capacity_kg: 6000, lead_time_days: 4, specialization: 'Yarn Cone & Fabric Dyeing', payment_terms_days: 30, status: 'active' },
    { id: 5, code: 'VEND-DYE-005', name: 'M.R.C. Mills Pvt. Ltd.', mill_type: 'Fabric Processing', contact_person: '', phone: '98426 42799', email: '', city: 'Karur', state: 'Tamil Nadu', address: '9/1, Chinnandan kovil Road Near Water Pumping Station, Karur – 639 001', gstin: '', daily_capacity_kg: 7500, lead_time_days: 5, specialization: 'Jiggar & Soft Flow', payment_terms_days: 30, status: 'active' },
    { id: 6, code: 'VEND-DYE-006', name: 'Sri Jothi Colours', mill_type: 'Dyeing Mill', contact_person: '', phone: '9659059449', email: '', city: 'Karur', state: 'Tamil Nadu', address: 'New Bye Pass Road Sukkaliur South, Karur - 639003', gstin: '', daily_capacity_kg: 5000, lead_time_days: 4, specialization: 'Fabric Colors & Bleaching', payment_terms_days: 30, status: 'active' },
    { id: 7, code: 'VEND-DYE-007', name: 'Sri Vinayaga Mills', mill_type: 'Cabinet & Dyeing', contact_person: '', phone: '98435 07766', email: '', city: 'Erode', state: 'Tamil Nadu', address: 'R.S.NO 63,45/1,45/3, Kovilkadu, Sadayamplayam,Gandhipuram Village, Chitode-638102. erode', gstin: '', daily_capacity_kg: 6500, lead_time_days: 5, specialization: 'Cabinet Bleaching & Dyeing', payment_terms_days: 30, status: 'active' },
    { id: 8, code: 'VEND-DYE-008', name: 'Sri Sivaperumal Dyeing', mill_type: 'Dyeing & Bleaching', contact_person: '', phone: '9751769482', email: '', city: 'Karur', state: 'Tamil Nadu', address: '1/176/A, S.n.Nagar, Near Primary Health Centre, Karupanpalayam, Karur – 639003', gstin: '', daily_capacity_kg: 5500, lead_time_days: 4, specialization: 'Fabric Dyeing', payment_terms_days: 30, status: 'active' },
    { id: 9, code: 'VEND-DYE-009', name: 'Arasi Colors', mill_type: 'Cotton Dyeing', contact_person: '', phone: '9843055188', email: '', city: 'Karur', state: 'Tamil Nadu', address: 'Othaiyur Road, T.sellandipalayam, Karur - 3', gstin: '', daily_capacity_kg: 4500, lead_time_days: 4, specialization: 'Cotton Dyeing Unit', payment_terms_days: 30, status: 'active' },
    { id: 10, code: 'VEND-DYE-010', name: 'Anantha screen printer', mill_type: 'Screen Printing & Dyeing', contact_person: '', phone: '9894182486', email: '', city: 'Erode', state: 'Tamil Nadu', address: '63, Devarankandu, Sathyamoorthy Nagar Veerappanchatram, Erode – 638 004', gstin: '', daily_capacity_kg: 4000, lead_time_days: 4, specialization: 'Screen Print & Washing', payment_terms_days: 30, status: 'active' },
    { id: 11, code: 'VEND-DYE-011', name: 'Balaji Print', mill_type: 'Printing & Processing', contact_person: '', phone: '9994666199', email: '', city: 'Tirupur', state: 'Tamil Nadu', address: '2E/ 136, Main Street, Tirumurugan Poondi Avinashi, Tirupur – 641 652', gstin: '', daily_capacity_kg: 5000, lead_time_days: 4, specialization: 'Textile Printing & Soft Flow', payment_terms_days: 30, status: 'active' },
  ],
  embroideryWorks: [
    { id: 1, code: 'VEND-EMB-001', name: 'Sri Krishna Embroidery Works', unit_type: 'Multi-Head Computerized', contact_person: 'R. Krishnakumar', phone: '9842199881', email: '', city: 'Tiruppur', state: 'Tamil Nadu', address: '14, College Road, Near Odakkadu, Tiruppur - 641602', gstin: '', machine_heads: '20-Head Tajima High Speed (15 Needles)', embroidery_types: 'Multi-Color Flat, 3D Puff, Applique', rate_per_thousand_stitches: 2.80, daily_capacity_pcs: 3500, payment_terms_days: 30, status: 'active' },
    { id: 2, code: 'VEND-EMB-002', name: 'Apex Precision Embroidery Unit', unit_type: 'Multi-Head Automatic & Sequin', contact_person: 'K. Balan', phone: '9790044556', email: '', city: 'Tiruppur', state: 'Tamil Nadu', address: '88, Rayapuram Main Road, Tiruppur - 641601', gstin: '', machine_heads: '12-Head Barudan Automatic (12 Needles)', embroidery_types: 'Sequin, Cording, Badges', rate_per_thousand_stitches: 3.20, daily_capacity_pcs: 2400, payment_terms_days: 30, status: 'active' },
    { id: 3, code: 'VEND-EMB-003', name: 'Vasantham Computer Embroidery', unit_type: 'Specialized Fashion Embroidery', contact_person: 'M. Vasanth', phone: '9442033112', email: '', city: 'Coimbatore', state: 'Tamil Nadu', address: '102, Sathy Road, Ganapathy, Coimbatore - 641006', gstin: '', machine_heads: '16-Head SWF Embroidery Machines', embroidery_types: 'Logo Embroidery, Chest Placement', rate_per_thousand_stitches: 2.50, daily_capacity_pcs: 4000, payment_terms_days: 30, status: 'active' },
    { id: 4, code: 'VEND-EMB-004', name: 'Classic Multi Head Embroidery', unit_type: 'Multi-Head Computerized', contact_person: '', phone: '9843022119', email: '', city: 'Tiruppur', state: 'Tamil Nadu', address: 'Near New Bus Stand, Tiruppur', gstin: '', machine_heads: '20-Head High Speed', embroidery_types: 'Flat, 3D Puff', rate_per_thousand_stitches: 2.50, daily_capacity_pcs: 3000, payment_terms_days: 30, status: 'active' },
    { id: 5, code: 'VEND-EMB-005', name: 'Universal Embroidery Works', unit_type: 'Cording & Chain Stitch', contact_person: '', phone: '9894455123', email: '', city: 'Karur', state: 'Tamil Nadu', address: 'Sengunthapuram, Karur', gstin: '', machine_heads: '12-Head Cording Unit', embroidery_types: 'Cording, Chain Stitch, Applique', rate_per_thousand_stitches: 3.00, daily_capacity_pcs: 2000, payment_terms_days: 30, status: 'active' },
  ],
  customers: [
    { id: 1, code: 'CUST-001', name: 'Zudio Retail Fashion', contact_person: 'Rohan Sharma', phone: '+91 98200 44551', email: 'buying@zudio.com', gstin: '27AABCT1234A1Z9', city: 'Mumbai', state: 'Maharashtra', avatar_style: 'lorelei', avatar_seed: 'Zudio-Lorelei-1' },
    { id: 2, code: 'CUST-002', name: 'Max Lifestyle Garments', contact_person: 'Pooja Nair', phone: '+91 98450 77882', email: 'sourcing@maxlifestyle.in', gstin: '29AABCL5678B1Z1', city: 'Bengaluru', state: 'Karnataka', avatar_style: 'lorelei', avatar_seed: 'MaxLifestyle-Lorelei-2' },
    { id: 3, code: 'CUST-003', name: 'Allen Solly Apparel Corp', contact_person: 'Deepak Varma', phone: '+91 99800 22334', email: 'production@allensolly.com', gstin: '29AABCA9012C1Z3', city: 'Bengaluru', state: 'Karnataka', avatar_style: 'lorelei', avatar_seed: 'AllenSolly-Lorelei-3' },
    { id: 6, code: 'BUY-006', name: 'Vegetable Figures Organic Apparel', contact_person: 'Kavitha Sundaram', phone: '+91 98422 77112', email: 'sourcing@vegetablefigures.com', billing_address: 'Plot No. 42, Green Earth Eco-Industrial Park, Angeripalayam Road, Tiruppur, Tamil Nadu - 641602', gstin: '33AABCV9812A1Z4', city: 'Tiruppur', state: 'Tamil Nadu', status: 'Active', avatar_style: 'lorelei', avatar_seed: 'VegetableFigures-Lorelei-6', image_url: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20120%20120%22%20fill%3D%22none%22%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2260%22%20r%3D%2258%22%20fill%3D%22%23ecfdf5%22%20stroke%3D%22%2310b981%22%20stroke-width%3D%224%22%2F%3E%3Cpath%20d%3D%22M45%2035%20C55%2020%2C%2065%2020%2C%2075%2035%20C85%2050%2C%2075%2085%2C%2060%2095%20C45%2085%2C%2035%2050%2C%2045%2035%20Z%22%20fill%3D%22%23f97316%22%2F%3E%3Cpath%20d%3D%22M60%2020%20C58%2010%2C%2062%208%2C%2060%205%20C64%2010%2C%2068%2012%2C%2060%2020%20Z%22%20fill%3D%22%2316a34a%22%2F%3E%3Ccircle%20cx%3D%2252%22%20cy%3D%2250%22%20r%3D%223.5%22%20fill%3D%22%23ffffff%22%2F%3E%3Ccircle%20cx%3D%2268%22%20cy%3D%2250%22%20r%3D%223.5%22%20fill%3D%22%23ffffff%22%2F%3E%3Ccircle%20cx%3D%2253%22%20cy%3D%2250%22%20r%3D%221.8%22%20fill%3D%22%231e293b%22%2F%3E%3Ccircle%20cx%3D%2269%22%20cy%3D%2250%22%20r%3D%221.8%22%20fill%3D%22%231e293b%22%2F%3E%3Cpath%20d%3D%22M54%2064%20Q60%2070%2066%2064%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%2F%3E%3Ctext%20x%3D%2260%22%20y%3D%22112%22%20font-size%3D%2210%22%20font-weight%3D%22bold%22%20fill%3D%22%23047857%22%20text-anchor%3D%22middle%22%20font-family%3D%22sans-serif%22%3EVEG%20FIGURES%3C%2Ftext%3E%3C%2Fsvg%3E', avatar_url: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20120%20120%22%20fill%3D%22none%22%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2260%22%20r%3D%2258%22%20fill%3D%22%23ecfdf5%22%20stroke%3D%22%2310b981%22%20stroke-width%3D%224%22%2F%3E%3Cpath%20d%3D%22M45%2035%20C55%2020%2C%2065%2020%2C%2075%2035%20C85%2050%2C%2075%2085%2C%2060%2095%20C45%2085%2C%2035%2050%2C%2045%2035%20Z%22%20fill%3D%22%23f97316%22%2F%3E%3Cpath%20d%3D%22M60%2020%20C58%2010%2C%2062%208%2C%2060%205%20C64%2010%2C%2068%2012%2C%2060%2020%20Z%22%20fill%3D%22%2316a34a%22%2F%3E%3Ccircle%20cx%3D%2252%22%20cy%3D%2250%22%20r%3D%223.5%22%20fill%3D%22%23ffffff%22%2F%3E%3Ccircle%20cx%3D%2268%22%20cy%3D%2250%22%20r%3D%223.5%22%20fill%3D%22%23ffffff%22%2F%3E%3Ccircle%20cx%3D%2253%22%20cy%3D%2250%22%20r%3D%221.8%22%20fill%3D%22%231e293b%22%2F%3E%3Ccircle%20cx%3D%2269%22%20cy%3D%2250%22%20r%3D%221.8%22%20fill%3D%22%231e293b%22%2F%3E%3Cpath%20d%3D%22M54%2064%20Q60%2070%2066%2064%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%2F%3E%3Ctext%20x%3D%2260%22%20y%3D%22112%22%20font-size%3D%2210%22%20font-weight%3D%22bold%22%20fill%3D%22%23047857%22%20text-anchor%3D%22middle%22%20font-family%3D%22sans-serif%22%3EVEG%20FIGURES%3C%2Ftext%3E%3C%2Fsvg%3E' },
  ],
  materials: [
    { id: 1, code: 'MAT-1001', name: '100% Combed Cotton 30s Single Jersey', category_id: 1, category_name: 'Fabric & Greige', supplier_id: 1, supplier_name: 'ABC Textiles Mills Ltd', uom: 'KG', purchase_rate: 340, tax_percent: 5, min_stock_level: 250, current_stock: 420 },
    { id: 2, code: 'MAT-1002', name: 'Poly-Cotton Fleece 280 GSM', category_id: 1, category_name: 'Fabric & Greige', supplier_id: 1, supplier_name: 'ABC Textiles Mills Ltd', uom: 'KG', purchase_rate: 410, tax_percent: 5, min_stock_level: 180, current_stock: 95 },
    { id: 3, code: 'MAT-1003', name: 'Sewing Thread 40/2 White', category_id: 3, category_name: 'Trims & Fasteners', supplier_id: 3, supplier_name: 'Apex Trims & Accessories', uom: 'CONE', purchase_rate: 85, tax_percent: 12, min_stock_level: 60, current_stock: 140 },
    { id: 4, code: 'MAT-1004', name: 'Nylon Zipper #5 Antique Brass (24 inch)', category_id: 3, category_name: 'Trims & Fasteners', supplier_id: 3, supplier_name: 'Apex Trims & Accessories', uom: 'PCS', purchase_rate: 22, tax_percent: 18, min_stock_level: 500, current_stock: 320 },
    { id: 5, code: 'MAT-1005', name: 'Reactive Black DN Dye', category_id: 4, category_name: 'Dyes & Chemicals', supplier_id: 4, supplier_name: 'DyeChem Colours Pvt Ltd', uom: 'KG', purchase_rate: 680, tax_percent: 18, min_stock_level: 50, current_stock: 18 },
    { id: 6, code: 'MAT-1006', name: 'Printed Brand Heat Seal Labels', category_id: 3, category_name: 'Trims & Fasteners', supplier_id: 3, supplier_name: 'Apex Trims & Accessories', uom: 'PCS', purchase_rate: 4.5, tax_percent: 18, min_stock_level: 2000, current_stock: 4500 },
  ],
  products: [
    { id: 1, code: 'PRD-001', name: 'Classic Crew Neck T-Shirt', category_id: 1, category_name: 'Fabric & Greige', design: 'Solid Minimalist', uom: 'PCS', selling_price: 285, tax_percent: 5 },
    { id: 2, code: 'PRD-002', name: 'French Terry Hooded Sweatshirt', category_id: 1, category_name: 'Fabric & Greige', design: 'Raglan Sleeve with Kangaroo Pocket', uom: 'PCS', selling_price: 650, tax_percent: 5 },
    { id: 3, code: 'PRD-003', name: 'Cotton Pique Polo Shirt', category_id: 1, category_name: 'Fabric & Greige', design: '2-Button Ribbed Collar', uom: 'PCS', selling_price: 420, tax_percent: 5 },
    { id: 4, code: 'PRD-004', name: 'Heavyweight Fleece Jogger Pant', category_id: 1, category_name: 'Fabric & Greige', design: 'Elasticated Ankle Cuff', uom: 'PCS', selling_price: 520, tax_percent: 5 },
  ],
  units: [
    { id: 1, code: 'KG', name: 'Kilograms' },
    { id: 2, code: 'MTR', name: 'Meters' },
    { id: 3, code: 'PCS', name: 'Pieces' },
    { id: 4, code: 'CONE', name: 'Cones' },
    { id: 5, code: 'ROLL', name: 'Rolls' },
    { id: 6, code: 'BOX', name: 'Boxes' },
  ],
  colors: [
    { id: 1, name: 'Jet Black', hex_code: '#111827' },
    { id: 2, name: 'Navy Blue', hex_code: '#1e3a8a' },
    { id: 3, name: 'Heather Grey', hex_code: '#9ca3af' },
    { id: 4, name: 'Pure White', hex_code: '#ffffff' },
    { id: 5, name: 'Forest Green', hex_code: '#14532d' },
    { id: 6, name: 'Burgundy Crimson', hex_code: '#881337' },
  ],
  sizes: [
    { id: 1, code: 'XS', name: 'Extra Small', sort_order: 1 },
    { id: 2, code: 'S', name: 'Small', sort_order: 2 },
    { id: 3, code: 'M', name: 'Medium', sort_order: 3 },
    { id: 4, code: 'L', name: 'Large', sort_order: 4 },
    { id: 5, code: 'XL', name: 'Extra Large', sort_order: 5 },
    { id: 6, code: 'XXL', name: 'Double Extra Large', sort_order: 6 },
  ],
  designs: [
    { id: 1, code: 'DSN-001', name: 'Classic Solid Plain', pattern: 'Solid Dyed' },
    { id: 2, code: 'DSN-002', name: 'Breton Feeder Stripe', pattern: 'Yarn Dyed Stripe' },
    { id: 3, code: 'DSN-003', name: 'Vintage Melange Texture', pattern: 'Cross Dye' },
    { id: 4, code: 'DSN-004', name: 'Typography Chest Graphic', pattern: 'Pigment Discharge Screen Print' },
  ],
  productionStages: [
    { id: 1, code: 'REQ', name: 'Requirement Gathering', sequence_order: 1, color_badge: '#6366f1', description: 'Production Requirement created for the product.', standard_cycle_time_mins: 60, status: 'active', is_qc_stage: false, is_final_stage: false },
    { id: 2, code: 'PO', name: 'Purchase Order (PO)', sequence_order: 2, color_badge: '#0284c7', description: 'Purchase order creation and tracking.', standard_cycle_time_mins: 120, status: 'active', is_qc_stage: false, is_final_stage: false },
    { id: 3, code: 'INW', name: 'Inward', sequence_order: 3, color_badge: '#0d9488', description: 'Receive materials or products into inventory.', standard_cycle_time_mins: 60, status: 'active', is_qc_stage: false, is_final_stage: false },
    { id: 4, code: 'DYE', name: 'Dyeing', sequence_order: 4, color_badge: '#7c3aed', description: 'Send material for dyeing and track color-wise processing.', standard_cycle_time_mins: 240, status: 'active', is_qc_stage: false, is_final_stage: false },
    { id: 5, code: 'CUT', name: 'Cutting — Product-wise', sequence_order: 5, color_badge: '#d97706', description: 'Track cutting quantities separately for each product and size.', standard_cycle_time_mins: 180, status: 'active', is_qc_stage: false, is_final_stage: false },
    { id: 6, code: 'EMB', name: 'Embroidery — Outward / Inward', sequence_order: 6, color_badge: '#ec4899', description: 'Track material sent to the embroidery unit and the quantity received back.', standard_cycle_time_mins: 180, status: 'active', is_qc_stage: false, is_final_stage: false },
    { id: 7, code: 'STI', name: 'Stitching — Color-wise Tracking', sequence_order: 7, color_badge: '#2563eb', description: 'Track stitching progress by product, color, size and quantity.', standard_cycle_time_mins: 300, status: 'active', is_qc_stage: false, is_final_stage: false },
    { id: 8, code: 'CHK', name: 'Checking', sequence_order: 8, color_badge: '#ef4444', description: 'Quality inspection, defect recording and approval.', standard_cycle_time_mins: 60, status: 'active', is_qc_stage: true, is_final_stage: false },
    { id: 9, code: 'PCK', name: 'Packing', sequence_order: 9, color_badge: '#059669', description: 'Pack approved products and track packed quantities.', standard_cycle_time_mins: 90, status: 'active', is_qc_stage: false, is_final_stage: false },
    { id: 10, code: 'COMP', name: 'Completed', sequence_order: 10, color_badge: '#16a34a', description: 'Production order completed with final quantities recorded.', standard_cycle_time_mins: 30, status: 'active', is_qc_stage: false, is_final_stage: true },
  ],
  purchaseOrders: [
    {
      id: 1,
      po_number: 'PO-00045',
      category_id: 6,
      category_name: 'FABRIC PO',
      supplier_id: 1,
      supplier_name: 'ABC Textiles Mills Ltd',
      po_date: '2026-10-01',
      delivery_due_date: '2026-10-15',
      subtotal: 102000,
      tax_amount: 5100,
      net_amount: 107100,
      paid_amount: 50000,
      balance_amount: 57100,
      payment_status: 'Partially Paid',
      status: 'PARTIALLY RECEIVED',
      remarks: 'Urgent autumn shipment batch',
      items: [
        { id: 1, material_id: 1, item_description: '100% Combed Cotton 30s Single Jersey', quantity: 300, rate: 340, taxable_amount: 102000, tax_percent: 5, tax_amount: 5100, net_amount: 107100, received_quantity: 150 }
      ],
      payments: [
        { id: 1, receipt_number: 'PAY-RTG-1001', payment_date: '2026-10-02', amount: 50000, payment_mode: 'RTGS', reference_number: 'HDFC9842193', notes: 'Advance 50%' }
      ],
      receipts: [
        { id: 1, receipt_no: 'GRN-00021', receipt_date: '2026-10-05', delivery_challan_no: 'DC-8812', vehicle_no: 'TN-39-BC-4412', quantity_received: 150, remarks: 'First partial batch inspected and accepted' }
      ]
    },
    {
      id: 2,
      po_number: 'PO-00046',
      category_id: 7,
      category_name: 'ACCESSORY PO',
      supplier_id: 3,
      supplier_name: 'Apex Trims & Accessories',
      po_date: '2026-10-03',
      delivery_due_date: '2026-10-12',
      subtotal: 28500,
      tax_amount: 5130,
      net_amount: 33630,
      paid_amount: 33630,
      balance_amount: 0,
      payment_status: 'Paid',
      status: 'RECEIVED',
      remarks: 'Full delivery accepted',
      items: [
        { id: 2, material_id: 4, item_description: 'Nylon Zipper #5 Antique Brass (24 inch)', quantity: 1000, rate: 22, taxable_amount: 22000, tax_percent: 18, tax_amount: 3960, net_amount: 25960, received_quantity: 1000 },
        { id: 3, material_id: 6, item_description: 'Printed Brand Heat Seal Labels', quantity: 1444, rate: 4.5, taxable_amount: 6500, tax_percent: 18, tax_amount: 1170, net_amount: 7670, received_quantity: 1444 }
      ],
      payments: [
        { id: 2, receipt_number: 'PAY-NEF-1002', payment_date: '2026-10-04', amount: 33630, payment_mode: 'NEFT', reference_number: 'ICIC2349182', notes: 'Settled on invoice' }
      ],
      receipts: [
        { id: 2, receipt_no: 'GRN-00022', receipt_date: '2026-10-06', delivery_challan_no: 'DC-9041', vehicle_no: 'TN-38-AL-1234', quantity_received: 2444, remarks: 'Full lot passed QC' }
      ]
    }
  ],
  purchaseReturns: [
    { id: 1, return_number: 'RET-0001', purchase_order_id: 1, po_number: 'PO-00045', supplier_name: 'ABC Textiles Mills Ltd', material_id: 1, material_name: '100% Combed Cotton 30s Single Jersey', return_date: '2026-10-06', quantity: 12, amount: 4284, debit_note_no: 'DN-8812', reason: 'GSM variation beyond tolerance', status: 'Completed' }
  ],
  inventoryTransactions: [
    { id: 1, material_id: 1, material_name: '100% Combed Cotton 30s Single Jersey', material_code: 'MAT-1001', uom: 'KG', transaction_type: 'RECEIPT', reference_type: 'Purchase Receipt', reference_id: 1, quantity: 150, previous_stock: 270, new_stock: 420, notes: 'GRN-00021 from ABC Textiles', created_at: '2026-10-05 14:30:00' },
    { id: 2, material_id: 4, material_name: 'Nylon Zipper #5 Antique Brass (24 inch)', material_code: 'MAT-1004', uom: 'PCS', transaction_type: 'RECEIPT', reference_type: 'Purchase Receipt', reference_id: 2, quantity: 1000, previous_stock: 0, new_stock: 1000, notes: 'GRN-00022 from Apex Trims', created_at: '2026-10-06 10:15:00' },
    { id: 3, material_id: 4, material_name: 'Nylon Zipper #5 Antique Brass (24 inch)', material_code: 'MAT-1004', uom: 'PCS', transaction_type: 'ISSUE', reference_type: 'Production Order', reference_id: 1, quantity: -680, previous_stock: 1000, new_stock: 320, notes: 'Issued for ORD-1001 Hoodie production', created_at: '2026-10-06 16:45:00' },
    { id: 4, material_id: 2, material_name: 'Poly-Cotton Fleece 280 GSM', material_code: 'MAT-1002', uom: 'KG', transaction_type: 'ADJUSTMENT', reference_type: 'Stock Adjustment', reference_id: null, quantity: -15, previous_stock: 110, new_stock: 95, notes: 'Dampness damage loss write-off', created_at: '2026-10-07 09:20:00' },
  ],
  productionOrders: [
    {
      id: 1,
      order_number: 'ORD-1001',
      title: 'Zudio Autumn Winter 2026 Crewneck Batch',
      customer_id: 1,
      customer_name: 'Zudio Retail Fashion',
      category_id: 1,
      priority: 'High',
      start_date: '2026-10-01',
      target_delivery_date: '2026-10-25',
      total_quantity: 1200,
      completed_quantity: 0,
      status: 'IN PRODUCTION',
      notes: 'Ensure double-needle reinforcement on collar band',
      items: [
        { id: 1, product_id: 1, product_name: 'Classic Crew Neck T-Shirt', product_code: 'PRD-001', color: 'Navy Blue', size: 'M', total_quantity: 400, current_stage_id: 5, current_stage_name: 'Stitching', stage_code: 'STI', current_stage_quantity: 400, completed_quantity: 0, rejected_quantity: 0, rework_quantity: 0, status: 'In Progress' },
        { id: 2, product_id: 1, product_name: 'Classic Crew Neck T-Shirt', product_code: 'PRD-001', color: 'Jet Black', size: 'L', total_quantity: 400, current_stage_id: 4, current_stage_name: 'Cutting', stage_code: 'CUT', current_stage_quantity: 400, completed_quantity: 0, rejected_quantity: 0, rework_quantity: 0, status: 'In Progress' },
        { id: 3, product_id: 1, product_name: 'Classic Crew Neck T-Shirt', product_code: 'PRD-001', color: 'Heather Grey', size: 'XL', total_quantity: 400, current_stage_id: 2, current_stage_name: 'Dyeing', stage_code: 'DYE', current_stage_quantity: 400, completed_quantity: 0, rejected_quantity: 0, rework_quantity: 0, status: 'In Progress' }
      ]
    },
    {
      id: 2,
      order_number: 'ORD-1002',
      title: 'Allen Solly Pique Polo Export Order',
      customer_id: 3,
      customer_name: 'Allen Solly Apparel Corp',
      category_id: 1,
      priority: 'Medium',
      start_date: '2026-10-02',
      target_delivery_date: '2026-10-28',
      total_quantity: 800,
      completed_quantity: 200,
      status: 'IN PRODUCTION',
      notes: 'Customer QC inspector will review on Oct 20',
      items: [
        { id: 4, product_id: 3, product_name: 'Cotton Pique Polo Shirt', product_code: 'PRD-003', color: 'Pure White', size: 'M', total_quantity: 400, current_stage_id: 6, current_stage_name: 'QC', stage_code: 'QC', current_stage_quantity: 200, completed_quantity: 200, rejected_quantity: 4, rework_quantity: 8, status: 'In Progress' },
        { id: 5, product_id: 3, product_name: 'Cotton Pique Polo Shirt', product_code: 'PRD-003', color: 'Forest Green', size: 'L', total_quantity: 400, current_stage_id: 3, current_stage_name: 'Detailing', stage_code: 'DET', current_stage_quantity: 400, completed_quantity: 0, rejected_quantity: 0, rework_quantity: 0, status: 'In Progress' }
      ]
    }
  ],
  qcRecords: [
    { id: 1, order_number: 'ORD-1002', product_name: 'Cotton Pique Polo Shirt', color: 'Pure White', size: 'M', stage_name: 'QC', inspector_name: 'S. Divya', inspected_quantity: 212, passed_quantity: 200, rejected_quantity: 4, rework_quantity: 8, defect_type: 'Skip stitch at placket', remarks: 'Placket tension loose, rerouted to Stitching rework' }
  ],
  reworkRecords: [
    { id: 1, order_number: 'ORD-1002', product_name: 'Cotton Pique Polo Shirt', color: 'Pure White', size: 'M', quantity: 8, rework_stage_id: 5, target_stage_name: 'Stitching', status: 'IN REWORK', resolution_notes: 'Re-stitching placket buttonhole and lock' }
  ],
  templates: [
    { id: 1, name: 'Standard Knit Fabric PO Template', template_type: 'po', category_id: 6, is_default: true, status: 'active', fields: [] },
    { id: 2, name: 'Garment Trim & Packaging Template', template_type: 'po', category_id: 7, is_default: true, status: 'active', fields: [] },
    { id: 3, name: 'Basic T-Shirt BOM Recipe', template_type: 'material', category_id: 1, is_default: true, status: 'active', fields: [] },
    { id: 4, name: 'Fleece Hoodie Tech Pack Template', template_type: 'product', category_id: 1, is_default: true, status: 'active', fields: [] },
  ],
  companySettings: {
    company_name: 'Cheran Soft Goods Private Limited',
    address: '124, Textile Park, Palladam Road, Tiruppur - 641604, Tamil Nadu, India',
    phone: '+91 421 2478900',
    email: 'operations@cheransoftgoods.com',
    gstin: '33AABCC1234F1Z5',
    currency: 'INR',
    financial_year_start: '04-01'
  }
};

// Load or initialize DB
let db = initialData;
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    db = JSON.parse(raw);
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  }
} catch (e) {
  console.warn('Using in-memory DB fallback:', e.message);
}

if (!db.products || !Array.isArray(db.products) || db.products.length === 0) {
  db.products = [
    {
      id: 1,
      code: 'PRD-001',
      name: 'Classic Crew Neck T-Shirt',
      design: 'Solid Minimalist',
      uom: 'PCS',
      selling_price: 499,
      tax_percent: 5,
      status: 'active',
      image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&auto=format&fit=crop&q=60',
      image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&auto=format&fit=crop&q=60'
    },
    {
      id: 2,
      code: 'PRD-002',
      name: 'Slim Fit Chino Trousers',
      design: 'Flat Front',
      uom: 'PCS',
      selling_price: 1299,
      tax_percent: 12,
      status: 'active',
      image_url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=300&auto=format&fit=crop&q=60',
      image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=300&auto=format&fit=crop&q=60'
    },
    {
      id: 3,
      code: 'PRD-003',
      name: 'Cotton Pique Polo Shirt',
      design: 'Ribbed Collar',
      uom: 'PCS',
      selling_price: 799,
      tax_percent: 5,
      status: 'active',
      image_url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=300&auto=format&fit=crop&q=60',
      image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=300&auto=format&fit=crop&q=60'
    }
  ];
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch {}
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving DB to file:', err.message);
  }
}

// Helpers
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  });
  res.end(JSON.stringify(payload));
}

function sendSuccess(res, data = null, message = 'Success', code = 200) {
  sendJson(res, code, { success: true, message, data, timestamp: new Date().toISOString() });
}

function sendError(res, message = 'An error occurred', code = 400, errors = null) {
  sendJson(res, code, { success: false, message, errors, timestamp: new Date().toISOString() });
}

// Main HTTP Server
const server = http.createServer(async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // Normalize path
  if (pathname.startsWith('/api/v1')) pathname = pathname.slice(7);
  else if (pathname.startsWith('/api')) pathname = pathname.slice(4);
  if (pathname.startsWith('/backend')) pathname = pathname.slice(8);
  if (pathname.startsWith('/v1')) pathname = pathname.slice(3);
  if (pathname.endsWith('/') && pathname.length > 1) pathname = pathname.slice(0, -1);

  // Read request body if present
  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString('utf-8');
      if (rawBody.trim()) body = JSON.parse(rawBody);
    } catch {
      return sendError(res, 'Malformed JSON body', 400);
    }
  }

  const method = req.method;

  // ROUTING
  try {
    // 1. Auth
    if (pathname === '/auth/login' && method === 'POST') {
      const emailOrUser = (body.email || body.username || '').trim().toLowerCase();
      const user = (db.users || []).find(u => (u.email && u.email.toLowerCase() === emailOrUser) || (u.username && u.username.toLowerCase() === emailOrUser));
      if (user || emailOrUser === 'admin' || emailOrUser === 'admin@cheransoftgoods.com') {
        const u = user || db.users[0] || {
          id: 1,
          name: 'Admin',
          username: 'admin',
          email: 'admin@cheransoftgoods.com',
          role: 'ADMIN',
          role_id: 1,
          role_name: 'System Administrator'
        };
        return sendSuccess(res, {
          ...u,
          name: 'Admin',
          username: 'admin',
          token: 'jwt_mock_token_' + Date.now(),
        }, 'Login successful');
      }
      return sendError(res, 'Invalid credentials', 401);
    }

    if (pathname === '/auth/me') {
      const u = (db.users && db.users[0]) || {
        id: 1,
        name: 'Admin',
        username: 'admin',
        email: 'admin@cheransoftgoods.com',
        role: 'ADMIN',
        role_id: 1,
        role_name: 'System Administrator'
      };
      return sendSuccess(res, { ...u, name: 'Admin', username: 'admin' });
    }

    // 2. Dashboard KPIs
    if (pathname === '/dashboard') {
      const totalPOs = db.purchaseOrders.length;
      const pendingPOs = db.purchaseOrders.filter(p => p.payment_status !== 'Paid');
      const pendingAmt = pendingPOs.reduce((s, p) => s + (p.balance_amount || 0), 0);
      const lowStock = db.materials.filter(m => (m.current_stock || 0) <= m.min_stock_level);
      const prodInProcess = db.productionOrders.filter(p => p.status === 'IN PRODUCTION').length;
      const prodCompleted = db.productionOrders.filter(p => p.status === 'COMPLETED').length;

      return sendSuccess(res, {
        kpis: {
          total_purchase_orders: totalPOs,
          pending_payments_po: pendingPOs.length,
          pending_payment_amount: pendingAmt,
          low_stock_count: lowStock.length,
          production_orders: prodInProcess,
          completed_orders: prodCompleted,
        },
        low_stock: lowStock,
        recent_purchase_orders: db.purchaseOrders.slice(-6).reverse(),
        recent_production: db.productionOrders.slice(-6).reverse(),
      });
    }

    // 3. Categories
    if (pathname === '/categories' && method === 'GET') {
      const type = parsedUrl.searchParams.get('type');
      const cats = (type && type !== 'all') ? db.categories.filter(c => !c.type || c.type === type) : db.categories;
      return sendSuccess(res, cats);
    }
    if (pathname === '/categories' && method === 'POST') {
      const name = (body.name || '').trim();
      if (!name) {
        return sendError(res, 'Category name is required', 422);
      }
      const existing = db.categories.find(c => (c.name || '').trim().toLowerCase() === name.toLowerCase());
      if (existing) {
        return sendError(res, `A category with the name '${name}' already exists`, 409);
      }
      let autoCode = body.code || 'CAT_' + name.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_');
      let baseCode = autoCode;
      let counter = 1;
      while (db.categories.some(c => c.code === autoCode)) {
        counter++;
        autoCode = `${baseCode}_${counter}`;
      }
      const newCat = {
        id: db.categories.length + 1,
        ...body,
        name,
        code: autoCode,
        type: body.type || null,
        description: body.description || null,
        fields: body.fields || [],
        created_at: new Date().toISOString()
      };
      db.categories.push(newCat);
      saveDB();
      return sendSuccess(res, newCat, 'Category created successfully', 201);
    }
    if (pathname.match(/^\/categories\/\d+$/) && method === 'GET') {
      const id = Number(pathname.split('/')[2]);
      const cat = db.categories.find(c => c.id === id);
      if (!cat) return sendError(res, 'Category not found', 404);
      return sendSuccess(res, cat);
    }
    if (pathname.match(/^\/categories\/\d+\/fields$/) && method === 'POST') {
      const id = Number(pathname.split('/')[2]);
      const cat = db.categories.find(c => c.id === id);
      if (!cat) return sendError(res, 'Category not found', 404);
      cat.fields = cat.fields || [];
      const newField = {
        id: cat.fields.length + 1,
        category_id: id,
        field_name: body.field_name || (body.field_label || 'item').toLowerCase().replace(/\s+/g, '_'),
        field_label: body.field_label || body.name || 'Item Name',
        field_type: body.field_type || 'text',
        is_required: !!body.is_required,
        is_visible: body.is_visible !== false,
        sort_order: cat.fields.length + 1,
        ...body,
      };
      cat.fields.push(newField);
      saveDB();
      return sendSuccess(res, newField, 'Item/field added to category', 201);
    }
    if (pathname.match(/^\/categories\/\d+\/fields\/\d+$/) && method === 'DELETE') {
      const parts = pathname.split('/');
      const catId = Number(parts[2]);
      const fieldId = Number(parts[4]);
      const cat = db.categories.find(c => c.id === catId);
      if (!cat) return sendError(res, 'Category not found', 404);
      cat.fields = (cat.fields || []).filter(f => f.id !== fieldId);
      saveDB();
      return sendSuccess(res, null, 'Item/field removed');
    }
    if (pathname.match(/^\/categories\/\d+$/) && method === 'DELETE') {
      const id = Number(pathname.split('/')[2]);
      db.categories = db.categories.filter(c => c.id !== id);
      saveDB();
      return sendSuccess(res, null, 'Category deleted');
    }

    // 4. Materials
    if (pathname === '/materials' && method === 'GET') {
      const catId = parsedUrl.searchParams.get('category_id');
      const mats = catId ? db.materials.filter(m => String(m.category_id) === catId) : db.materials;
      return sendSuccess(res, mats);
    }
    if (pathname.match(/^\/materials\/\d+$/) && method === 'GET') {
      const id = Number(pathname.split('/')[2]);
      const mat = (db.materials || []).find(m => m.id === id);
      if (!mat) return sendError(res, 'Material not found', 404);
      return sendSuccess(res, mat);
    }
    if (pathname === '/materials' && method === 'POST') {
      const newMat = {
        id: db.materials.length + 1,
        code: body.code || `MAT-${1000 + db.materials.length + 1}`,
        current_stock: Number(body.current_stock || 0),
        min_stock_level: Number(body.min_stock_level || 50),
        purchase_rate: Number(body.purchase_rate || 0),
        tax_percent: Number(body.tax_percent || 5),
        uom: body.uom || 'KG',
        ...body,
      };
      db.materials.push(newMat);
      saveDB();
      return sendSuccess(res, newMat, 'Material created', 201);
    }
    if (pathname.match(/^\/materials\/\d+$/) && (method === 'PUT' || method === 'PATCH')) {
      const id = Number(pathname.split('/')[2]);
      if (!db.materials) db.materials = [];
      const idx = db.materials.findIndex(m => m.id === id);
      if (idx === -1) return sendError(res, 'Material not found', 404);
      const existingCode = db.materials[idx].code;
      db.materials[idx] = {
        ...db.materials[idx],
        ...body,
        id,
        code: existingCode
      };
      saveDB();
      return sendSuccess(res, db.materials[idx], 'Material updated successfully');
    }
    if (pathname.match(/^\/materials\/\d+$/) && method === 'DELETE') {
      const id = Number(pathname.split('/')[2]);
      const mat = (db.materials || []).find(m => m.id === id);
      if (!mat) return sendError(res, 'Material not found', 404);
      const hasPoi = (db.purchaseOrders || []).some(po => (po.items || []).some(it => it.material_id === id));
      const hasStock = Number(mat.current_stock || 0) > 0;
      const hasTx = (db.inventoryTransactions || []).some(t => t.material_id === id);
      if (hasPoi || hasStock || hasTx) {
        return sendError(res, `Cannot delete material '${mat.name}' (${mat.code}) because it has existing transactions or stock history.`, 422);
      }
      db.materials = db.materials.filter(m => m.id !== id);
      saveDB();
      return sendSuccess(res, null, 'Material deleted successfully');
    }

    // 5. Products
    if (pathname === '/products' && method === 'GET') {
      return sendSuccess(res, db.products || []);
    }
    if (pathname === '/products' && method === 'POST') {
      const img = body.image_url || body.image || '';
      const newProd = {
        id: (db.products?.length || 0) + 1,
        code: body.code || `PRD-00${(db.products?.length || 0) + 1}`,
        ...body,
        image_url: img,
        image: img,
      };
      if (!db.products) db.products = [];
      db.products.push(newProd);
      saveDB();
      return sendSuccess(res, newProd, 'Product created', 201);
    }
    if (pathname.match(/^\/products\/\d+$/) && method === 'PUT') {
      const id = Number(pathname.split('/')[2]);
      if (!db.products) db.products = [];
      const idx = db.products.findIndex(p => p.id === id);
      if (idx === -1) return sendError(res, 'Product not found', 404);
      const img = body.image_url || body.image || db.products[idx].image_url || '';
      db.products[idx] = { ...db.products[idx], ...body, image_url: img, image: img, id };
      saveDB();
      return sendSuccess(res, db.products[idx], 'Product updated');
    }
    if (pathname.startsWith('/products/') && method === 'DELETE') {
      const id = Number(pathname.split('/')[2]);
      if (db.products) {
        db.products = db.products.filter(p => p.id !== id);
        saveDB();
      }
      return sendSuccess(res, null, 'Product deleted');
    }

    // 6. Suppliers & Customers
    if (pathname === '/suppliers' && method === 'GET') {
      const enriched = db.suppliers.map(s => {
        const cat = (db.categories || []).find(c => c.id === Number(s.category_id));
        return {
          ...s,
          category_name: cat ? cat.name : (s.category_name || null),
          category_code: cat ? cat.code : (s.category_code || null),
          category_icon: cat ? cat.icon : (s.category_icon || null),
        };
      });
      return sendSuccess(res, enriched);
    }
    if (pathname === '/suppliers' && method === 'POST') {
      const cat = (db.categories || []).find(c => c.id === Number(body.category_id));
      const newSup = { 
        id: db.suppliers.length + 1, 
        code: body.code || `SUP-00${db.suppliers.length + 1}`, 
        ...body,
        category_name: cat ? cat.name : null,
        category_code: cat ? cat.code : null,
        category_icon: cat ? cat.icon : null,
      };
      db.suppliers.push(newSup);
      saveDB();
      return sendSuccess(res, newSup, 'Supplier added', 201);
    }

    const supMatch = pathname.match(/^\/suppliers\/(\d+)$/);
    if (supMatch && (method === 'PUT' || method === 'PATCH')) {
      const supId = Number(supMatch[1]);
      const idx = db.suppliers.findIndex(s => s.id === supId);
      if (idx === -1) return sendError(res, 'Supplier not found', 404);
      const cat = (db.categories || []).find(c => c.id === Number(body.category_id));
      db.suppliers[idx] = {
        ...db.suppliers[idx],
        ...body,
        id: supId,
        category_name: cat ? cat.name : (db.suppliers[idx].category_name || null),
        category_code: cat ? cat.code : (db.suppliers[idx].category_code || null),
        category_icon: cat ? cat.icon : (db.suppliers[idx].category_icon || null),
      };
      saveDB();
      return sendSuccess(res, db.suppliers[idx], 'Supplier updated');
    }
    if (supMatch && method === 'DELETE') {
      const supId = Number(supMatch[1]);
      const idx = db.suppliers.findIndex(s => s.id === supId);
      if (idx === -1) return sendError(res, 'Supplier not found', 404);
      db.suppliers.splice(idx, 1);
      saveDB();
      return sendSuccess(res, null, 'Supplier deleted');
    }

    // Dyeing Mills Master
    if (pathname === '/dyeing-mills' && method === 'GET') {
      if (!db.dyeingMills) db.dyeingMills = [];
      return sendSuccess(res, db.dyeingMills);
    }
    if (pathname === '/dyeing-mills' && method === 'POST') {
      if (!db.dyeingMills) db.dyeingMills = [];
      const newMill = {
        id: db.dyeingMills.length > 0 ? Math.max(...db.dyeingMills.map(m => m.id)) + 1 : 1,
        code: body.code || `MILL-${String(db.dyeingMills.length + 1).padStart(3, '0')}`,
        ...body,
        status: body.status || 'active',
        created_at: new Date().toISOString()
      };
      db.dyeingMills.push(newMill);
      saveDB();
      return sendSuccess(res, newMill, 'Dyeing Mill registered', 201);
    }
    const millMatch = pathname.match(/^\/dyeing-mills\/(\d+)$/);
    if (millMatch && (method === 'PUT' || method === 'PATCH')) {
      if (!db.dyeingMills) db.dyeingMills = [];
      const mId = Number(millMatch[1]);
      const idx = db.dyeingMills.findIndex(m => m.id === mId);
      if (idx === -1) return sendError(res, 'Dyeing Mill not found', 404);
      db.dyeingMills[idx] = { ...db.dyeingMills[idx], ...body, id: mId };
      saveDB();
      return sendSuccess(res, db.dyeingMills[idx], 'Dyeing Mill updated');
    }
    if (millMatch && method === 'DELETE') {
      if (!db.dyeingMills) db.dyeingMills = [];
      const mId = Number(millMatch[1]);
      const idx = db.dyeingMills.findIndex(m => m.id === mId);
      if (idx === -1) return sendError(res, 'Dyeing Mill not found', 404);
      db.dyeingMills.splice(idx, 1);
      saveDB();
      return sendSuccess(res, null, 'Dyeing Mill deleted');
    }

    // Embroidery Works Master
    if (pathname === '/embroidery-works' && method === 'GET') {
      if (!db.embroideryWorks) db.embroideryWorks = [];
      return sendSuccess(res, db.embroideryWorks);
    }
    if (pathname === '/embroidery-works' && method === 'POST') {
      if (!db.embroideryWorks) db.embroideryWorks = [];
      const newEmb = {
        id: db.embroideryWorks.length > 0 ? Math.max(...db.embroideryWorks.map(e => e.id)) + 1 : 1,
        code: body.code || `EMB-${String(db.embroideryWorks.length + 1).padStart(3, '0')}`,
        ...body,
        status: body.status || 'active',
        created_at: new Date().toISOString()
      };
      db.embroideryWorks.push(newEmb);
      saveDB();
      return sendSuccess(res, newEmb, 'Embroidery Work unit registered', 201);
    }
    const embMatch = pathname.match(/^\/embroidery-works\/(\d+)$/);
    if (embMatch && (method === 'PUT' || method === 'PATCH')) {
      if (!db.embroideryWorks) db.embroideryWorks = [];
      const eId = Number(embMatch[1]);
      const idx = db.embroideryWorks.findIndex(e => e.id === eId);
      if (idx === -1) return sendError(res, 'Embroidery Unit not found', 404);
      db.embroideryWorks[idx] = { ...db.embroideryWorks[idx], ...body, id: eId };
      saveDB();
      return sendSuccess(res, db.embroideryWorks[idx], 'Embroidery Unit updated');
    }
    if (embMatch && method === 'DELETE') {
      if (!db.embroideryWorks) db.embroideryWorks = [];
      const eId = Number(embMatch[1]);
      const idx = db.embroideryWorks.findIndex(e => e.id === eId);
      if (idx === -1) return sendError(res, 'Embroidery Unit not found', 404);
      db.embroideryWorks.splice(idx, 1);
      saveDB();
      return sendSuccess(res, null, 'Embroidery Unit deleted');
    }

    if ((pathname === '/customers' || pathname === '/buyers') && method === 'GET') return sendSuccess(res, db.customers);
    if ((pathname === '/customers' || pathname === '/buyers') && method === 'POST') {
      const generatedCode = body.code || `BUY-${String(db.customers.length + 1).padStart(3, '0')}`;
      const newCust = {
        id: db.customers.length + 1,
        code: generatedCode,
        avatar_style: body.avatar_style || 'lorelei',
        avatar_seed: body.avatar_seed || `buyer-${generatedCode}`,
        avatar_config: body.avatar_config || null,
        image_url: body.image_url || body.avatar_url || '',
        avatar_url: body.avatar_url || body.image_url || '',
        ...body,
      };
      db.customers.push(newCust);
      saveDB();
      return sendSuccess(res, newCust, 'Buyer added', 201);
    }

    const custPutMatch = pathname.match(/^\/(?:buyers|customers)\/(\d+)$/);
    if (custPutMatch && (method === 'PUT' || method === 'PATCH')) {
      const custId = Number(custPutMatch[1]);
      const idx = db.customers.findIndex(c => c.id === custId);
      if (idx === -1) return sendError(res, 'Buyer not found', 404);
      db.customers[idx] = {
        ...db.customers[idx],
        ...body,
        id: custId,
      };
      saveDB();
      return sendSuccess(res, db.customers[idx], 'Buyer updated successfully');
    }

    // Buyer Products
    const bpGetMatch = pathname.match(/^\/(?:buyers|customers)\/(\d+)\/products$/);
    if (bpGetMatch && method === 'GET') {
      const buyerId = Number(bpGetMatch[1]);
      if (!db.buyer_products) db.buyer_products = [];
      const prods = db.buyer_products.filter(p => p.buyer_id === buyerId);
      return sendSuccess(res, prods);
    }
    const bpGetSingleMatch = pathname.match(/^\/(?:buyers|customers)\/(\d+)\/products\/(\d+)$/);
    if (bpGetSingleMatch && method === 'GET') {
      const buyerId = Number(bpGetSingleMatch[1]);
      const prodId = Number(bpGetSingleMatch[2]);
      if (!db.buyer_products) db.buyer_products = [];
      const prod = db.buyer_products.find(p => p.buyer_id === buyerId && p.id === prodId);
      if (!prod) return sendError(res, 'Buyer product not found', 404);
      return sendSuccess(res, prod);
    }
    const bpPostMatch = pathname.match(/^\/(?:buyers|customers)\/(\d+)\/products$/);
    if (bpPostMatch && method === 'POST') {
      const buyerId = Number(bpPostMatch[1]);
      if (!db.buyer_products) db.buyer_products = [];
      const newBp = {
        id: db.buyer_products.length + 1,
        buyer_id: buyerId,
        product_code: body.product_code || `BPRD-00${db.buyer_products.length + 1}`,
        created_at: new Date().toISOString().split('T')[0],
        ...body,
      };
      db.buyer_products.push(newBp);
      saveDB();
      return sendSuccess(res, newBp, 'Buyer product created', 201);
    }
    const bpPutMatch = pathname.match(/^\/(?:buyers|customers)\/(\d+)\/products\/(\d+)$/);
    if (bpPutMatch && method === 'PUT') {
      const buyerId = Number(bpPutMatch[1]);
      const prodId = Number(bpPutMatch[2]);
      if (!db.buyer_products) db.buyer_products = [];
      const idx = db.buyer_products.findIndex(p => p.buyer_id === buyerId && p.id === prodId);
      if (idx === -1) return sendError(res, 'Buyer product not found', 404);
      db.buyer_products[idx] = { ...db.buyer_products[idx], ...body, buyer_id: buyerId, id: prodId, updated_at: new Date().toISOString().split('T')[0] };
      saveDB();
      return sendSuccess(res, db.buyer_products[idx], 'Buyer product updated');
    }
    const bpDelMatch = pathname.match(/^\/(?:buyers|customers)\/(\d+)\/products\/(\d+)$/);
    if (bpDelMatch && method === 'DELETE') {
      const buyerId = Number(bpDelMatch[1]);
      const prodId = Number(bpDelMatch[2]);
      if (db.buyer_products) {
        db.buyer_products = db.buyer_products.filter(p => !(p.buyer_id === buyerId && p.id === prodId));
        saveDB();
      }
      return sendSuccess(res, null, 'Buyer product deleted');
    }

    // 7. Inventory & Ledger
    if (pathname === '/inventory' && method === 'GET') {
      return sendSuccess(res, db.materials.map(m => ({
        ...m,
        is_low_stock: (m.current_stock || 0) <= (m.min_stock_level || 0) ? 1 : 0,
        stock_value: ((m.current_stock || 0) * (m.purchase_rate || 0)).toFixed(2),
      })));
    }
    if (pathname === '/inventory/low-stock' && method === 'GET') {
      const low = db.materials.filter(m => (m.current_stock || 0) <= m.min_stock_level);
      return sendSuccess(res, low);
    }
    if (pathname === '/inventory/ledger' && method === 'GET') {
      const matId = parsedUrl.searchParams.get('material_id');
      const list = matId ? db.inventoryTransactions.filter(t => String(t.material_id) === matId) : db.inventoryTransactions;
      return sendSuccess(res, list.slice().reverse());
    }
    if (pathname === '/inventory/adjustment' && method === 'POST') {
      const { material_id, adjustment_type, quantity, reason } = body;
      const mat = db.materials.find(m => m.id === Number(material_id));
      if (!mat) return sendError(res, 'Material not found', 404);

      const oldStock = mat.current_stock || 0;
      let newStock = oldStock;
      const q = Number(quantity || 0);

      if (adjustment_type === 'ADD') newStock = oldStock + q;
      else if (adjustment_type === 'SUBTRACT') newStock = Math.max(0, oldStock - q);
      else if (adjustment_type === 'SET') newStock = q;

      mat.current_stock = newStock;
      db.inventoryTransactions.push({
        id: db.inventoryTransactions.length + 1,
        material_id: mat.id,
        material_name: mat.name,
        material_code: mat.code,
        uom: mat.uom,
        transaction_type: 'ADJUSTMENT',
        reference_type: 'Stock Adjustment',
        reference_id: null,
        quantity: newStock - oldStock,
        previous_stock: oldStock,
        new_stock: newStock,
        notes: reason || 'Physical inventory reconciliation',
        created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      });
      saveDB();
      return sendSuccess(res, { previous_stock: oldStock, new_stock: newStock }, 'Stock adjusted successfully');
    }
    if (pathname === '/inventory/consumption') {
      if (method === 'GET') {
        const issues = (db.inventoryTransactions || []).filter(t => t.transaction_type === 'ISSUE');
        return sendSuccess(res, issues);
      }
      if (method === 'POST') {
        const items = Array.isArray(body.items) ? body.items : (body.material_id ? [body] : []);
        if (!items.length) return sendError(res, 'No consumption items specified', 422);

        // Group by material_id to validate total requested
        const reqMap = {};
        for (const it of items) {
          const mid = Number(it.material_id);
          const q = Number(it.quantity || 0);
          if (!mid || q <= 0) return sendError(res, 'Valid material and quantity > 0 are required for all lines', 422);
          reqMap[mid] = (reqMap[mid] || 0) + q;
        }

        // Validate available stock for each material
        for (const [midStr, reqTotal] of Object.entries(reqMap)) {
          const mid = Number(midStr);
          const mat = (db.materials || []).find(m => m.id === mid);
          if (!mat) return sendError(res, `Material #${mid} not found`, 404);
          const avail = Number(mat.current_stock || 0);
          if (reqTotal > avail) {
            return sendError(res, `Insufficient stock for '${mat.name}' (${mat.code}). Requested: ${reqTotal} ${mat.uom}, Available: ${avail} ${mat.uom}`, 422);
          }
        }

        // Deduct and create transactions
        const orderRef = body.production_order_ref || body.production_order || '';
        for (const it of items) {
          const mid = Number(it.material_id);
          const q = Number(it.quantity);
          const mat = db.materials.find(m => m.id === mid);
          const oldStock = mat.current_stock || 0;
          mat.current_stock = Math.max(0, oldStock - q);

          if (!db.inventoryTransactions) db.inventoryTransactions = [];
          db.inventoryTransactions.push({
            id: db.inventoryTransactions.length + 1,
            material_id: mat.id,
            material_name: mat.name,
            material_code: mat.code,
            uom: mat.uom,
            transaction_type: 'ISSUE',
            reference_type: 'Production Order',
            reference_id: body.production_order_id || null,
            quantity: -q,
            previous_stock: oldStock,
            new_stock: mat.current_stock,
            notes: it.notes || body.general_notes || body.notes || (orderRef ? `Consumed for order ${orderRef}` : 'Material consumed for production'),
            created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
          });
        }
        saveDB();
        return sendSuccess(res, { items_count: items.length }, 'Material consumption logged', 201);
      }
    }

    // 8. Purchase Orders & Actions
    if (pathname.match(/^\/purchase-orders\/\d+$/) && method === 'GET') {
      const id = Number(pathname.split('/')[2]);
      const po = (db.purchaseOrders || []).find(p => p.id === id);
      if (!po) return sendError(res, 'Purchase Order not found', 404);
      return sendSuccess(res, {
        ...po,
        status: (po.status || '').toLowerCase() === 'draft' ? 'Draft' : 'Ordered'
      });
    }
    if (pathname === '/purchase-orders' && method === 'GET') {
      const normalized = (db.purchaseOrders || []).map(p => ({
        ...p,
        status: (p.status || '').toLowerCase() === 'draft' ? 'Draft' : 'Ordered'
      }));
      return sendSuccess(res, normalized);
    }
    if (pathname === '/purchase-orders' && method === 'POST') {
      const items = body.items || [];
      let subtotal = 0;
      let totalTax = 0;
      const formattedItems = items.map((it, idx) => {
        const qty = Number(it.quantity || it.qty || 0);
        const rate = Number(it.rate || 0);
        const taxPct = Number(it.tax_percent || 5);
        const taxable = Math.round(qty * rate * 100) / 100;
        const taxAmt = Math.round(taxable * (taxPct / 100) * 100) / 100;
        const net = Math.round((taxable + taxAmt) * 100) / 100;
        subtotal += taxable;
        totalTax += taxAmt;
        const rawDesc = it.accessory_name || it.item_description || it.description || 'Fabric Material';
        const desc = typeof rawDesc === 'string' ? rawDesc.replace(/\s*\[[A-Za-z0-9_-]+\]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim() : rawDesc;
        return {
          id: idx + 1,
          order_no: it.order_no || `ORD-${String(idx + 1).padStart(3, '0')}`,
          material_id: it.material_id,
          item_description: desc,
          accessory_name: desc,
          quantity: qty,
          rate,
          taxable_amount: taxable,
          tax_percent: taxPct,
          tax_amount: taxAmt,
          net_amount: net,
          received_quantity: 0,
          ...it,
          item_description: desc,
          accessory_name: desc,
        };
      });

      const netAmount = subtotal + totalTax;
      const supplier = db.suppliers.find(s => s.id === Number(body.supplier_id)) || db.suppliers[0];
      const poDate = body.po_date || new Date().toISOString().split('T')[0];

      // Format date as DDMMYY
      let dateFormatted = '';
      const dateParts = poDate.split('-');
      if (dateParts.length === 3) {
        const yy = dateParts[0].slice(-2);
        const mm = dateParts[1].padStart(2, '0');
        const dd = dateParts[2].slice(0, 2).padStart(2, '0');
        dateFormatted = `${dd}${mm}${yy}`;
      } else {
        const d = new Date(poDate);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        dateFormatted = `${dd}${mm}${yy}`;
      }
      const prefix = `PO-${dateFormatted}-`;

      let maxSeq = 0;
      (db.purchaseOrders || []).forEach(p => {
        if (p.po_number && p.po_number.startsWith(prefix)) {
          const match = p.po_number.match(new RegExp(`^PO-${dateFormatted}-(\\d+)$`));
          if (match) {
            const val = parseInt(match[1], 10);
            if (val > maxSeq) maxSeq = val;
          }
        }
      });
      const nextSeq = String(maxSeq + 1).padStart(2, '0');
      const poNumber = `${prefix}${nextSeq}`;

      // Per Task 3.B: Initial status of newly created purchase orders must strictly be Draft
      const poStatus = 'Draft';

      const prodOrderId = body.production_order_id ? Number(body.production_order_id) : null;
      let prodOrderNumber = body.production_order_number || null;
      if (prodOrderId && !prodOrderNumber) {
        const linkedOrder = (db.productionOrders || []).find(o => o.id === prodOrderId);
        if (linkedOrder) prodOrderNumber = linkedOrder.order_number;
      }

      const newPO = {
        id: db.purchaseOrders.length + 1,
        po_number: poNumber,
        production_order_id: prodOrderId,
        production_order_number: prodOrderNumber,
        category_id: Number(body.category_id || 6),
        category_name: body.category_id == 7 ? 'ACCESSORY PO' : 'FABRIC PO',
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        po_date: poDate,
        delivery_due_date: body.delivery_due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        subtotal,
        tax_amount: totalTax,
        net_amount: netAmount,
        paid_amount: 0,
        balance_amount: netAmount,
        payment_status: 'Not Paid',
        status: poStatus,
        remarks: body.remarks || '',
        items: formattedItems,
        payments: [],
        receipts: [],
      };

      // Automatically advance production order to Stage 02: PO when PO is issued
      if (prodOrderId) {
        const pOrder = (db.productionOrders || []).find(o => o.id === prodOrderId);
        if (pOrder && Array.isArray(pOrder.items)) {
          pOrder.items.forEach(it => {
            const code = (it.stage_code || '').toUpperCase();
            if (it.current_stage_id === 1 || code === 'REQ' || code === 'INST' || !it.current_stage_id) {
              it.current_stage_id = 2;
              it.current_stage_name = 'Purchase Order (PO)';
              it.stage_code = 'PO';
            }
          });
        }
      }

      db.purchaseOrders.unshift(newPO);
      saveDB();
      return sendSuccess(res, newPO, 'Purchase Order created', 201);
    }

    // Update Purchase Order (Draft only)
    if (pathname.match(/^\/purchase-orders\/\d+$/) && (method === 'PUT' || method === 'PATCH')) {
      const poId = Number(pathname.split('/')[2]);
      const po = db.purchaseOrders.find(p => p.id === poId);
      if (!po) return sendError(res, 'Purchase order not found', 404);

      if ((po.status || '').toLowerCase() !== 'draft') {
        return sendError(res, 'Only Draft purchase orders can be edited. Ordered purchase orders are locked.', 422);
      }

      const items = body.items || [];
      if (items.length === 0) return sendError(res, 'At least one item line is required', 422);

      let subtotal = 0;
      let totalTax = 0;
      const formattedItems = items.map((it, idx) => {
        const qty = Number(it.quantity || it.qty || 0);
        const rate = Number(it.rate || 0);
        const taxPct = Number(it.tax_percent || 5);
        const taxable = Math.round(qty * rate * 100) / 100;
        const taxAmt = Math.round(taxable * (taxPct / 100) * 100) / 100;
        const net = Math.round((taxable + taxAmt) * 100) / 100;
        subtotal += taxable;
        totalTax += taxAmt;
        const rawDesc = it.accessory_name || it.item_description || it.description || 'Fabric Material';
        const desc = typeof rawDesc === 'string' ? rawDesc.replace(/\s*\[[A-Za-z0-9_-]+\]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim() : rawDesc;
        return {
          id: idx + 1,
          order_no: it.order_no || `ORD-${String(idx + 1).padStart(3, '0')}`,
          material_id: it.material_id,
          item_description: desc,
          accessory_name: desc,
          quantity: qty,
          rate,
          taxable_amount: taxable,
          tax_percent: taxPct,
          tax_amount: taxAmt,
          net_amount: net,
          received_quantity: Number(it.received_quantity || 0),
          ...it,
          item_description: desc,
          accessory_name: desc,
        };
      });

      const netAmount = subtotal + totalTax;
      if (body.supplier_id) {
        const supplier = db.suppliers.find(s => s.id === Number(body.supplier_id));
        if (supplier) {
          po.supplier_id = supplier.id;
          po.supplier_name = supplier.name;
        }
      }
      if (body.category_id) {
        po.category_id = Number(body.category_id);
        po.category_name = body.category_id == 7 ? 'ACCESSORY PO' : 'FABRIC PO';
      }
      if (body.po_date) po.po_date = body.po_date;
      if (body.delivery_due_date) po.delivery_due_date = body.delivery_due_date;
      if (body.remarks !== undefined) po.remarks = body.remarks;

      po.subtotal = subtotal;
      po.tax_amount = totalTax;
      po.net_amount = netAmount;
      po.balance_amount = Math.max(0, netAmount - (po.paid_amount || 0));
      po.items = formattedItems;

      saveDB();
      return sendSuccess(res, po, 'Purchase Order updated successfully');
    }

    // Add Payment to PO
    if (pathname.match(/^\/purchase-orders\/\d+\/payments$/) && method === 'POST') {
      const poId = Number(pathname.split('/')[2]);
      const po = db.purchaseOrders.find(p => p.id === poId);
      if (!po) return sendError(res, 'Purchase order not found', 404);

      if ((po.status || '').toLowerCase() === 'draft') {
        return sendError(res, 'Cannot record payments against a Draft Purchase Order. Please confirm and order the PO first.', 422);
      }

      const amt = Number(body.amount || 0);
      if (amt <= 0) {
        return sendError(res, 'Payment amount must be greater than zero', 422);
      }
      if (amt > Number(po.balance_amount || po.net_amount || 0)) {
        return sendError(res, `Payment amount cannot exceed outstanding balance`, 422);
      }

      const newPayment = {
        id: (po.payments || []).length + 1,
        receipt_number: `PAY-${(body.payment_mode || 'NEFT').slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
        payment_date: body.payment_date || new Date().toISOString().split('T')[0],
        amount: amt,
        payment_mode: body.payment_mode || 'NEFT',
        reference_number: body.reference_number || '',
        notes: body.notes || '',
      };
      po.payments = po.payments || [];
      po.payments.unshift(newPayment);
      po.paid_amount = (po.paid_amount || 0) + amt;
      po.balance_amount = Math.max(0, (po.net_amount || 0) - po.paid_amount);

      const bal = po.balance_amount;
      const dueDate = po.payment_due_date;
      const today = new Date().toISOString().split('T')[0];
      if (bal <= 0.01) {
        po.payment_status = 'Settled';
      } else if (dueDate && dueDate < today && bal > 0.01) {
        po.payment_status = 'Overdue';
      } else if (po.paid_amount > 0.01) {
        po.payment_status = 'Partially Paid';
      } else {
        po.payment_status = 'Unpaid';
      }

      saveDB();
      return sendSuccess(res, po, 'Payment recorded successfully');
    }

    // Update Purchase Order Status (Draft <-> Ordered)
    if (pathname.match(/^\/purchase-orders\/\d+\/status$/) && (method === 'PATCH' || method === 'PUT' || method === 'POST')) {
      const poId = Number(pathname.split('/')[2]);
      const po = db.purchaseOrders.find(p => p.id === poId);
      if (!po) return sendError(res, 'Purchase order not found', 404);

      const reqStatus = (body.status || '').toLowerCase();
      if (reqStatus !== 'draft' && reqStatus !== 'ordered') {
        return sendError(res, "Invalid status. Allowed statuses are 'Draft' and 'Ordered'", 422);
      }

      po.status = reqStatus === 'draft' ? 'Draft' : 'Ordered';
      if (po.status === 'Ordered') {
        const now = new Date();
        po.ordered_at = po.ordered_at || now.toISOString().replace('T', ' ').slice(0, 19);
        if (!po.payment_due_date) {
          const d = new Date(po.ordered_at.split(' ')[0]);
          d.setDate(d.getDate() + 15);
          po.payment_due_date = d.toISOString().split('T')[0];
        }

        // Auto-advance linked production order items to Stage 03: Inward
        if (po.production_order_id && Array.isArray(db.productionOrders)) {
          const prodOrder = db.productionOrders.find(o => o.id === po.production_order_id);
          if (prodOrder && Array.isArray(prodOrder.items)) {
            prodOrder.items.forEach(it => {
              if (it.current_stage_id === 2 || it.current_stage_id === 1) {
                it.current_stage_id = 3;
                it.current_stage_name = 'Inward';
                it.stage_sequence = 3;
              }
            });
          }
        }
      }
      saveDB();
      return sendSuccess(res, { id: po.id, status: po.status, payment_due_date: po.payment_due_date }, `Purchase Order status updated to ${po.status}`);
    }

    // Receive Goods against PO
    if (pathname.match(/^\/purchase-orders\/\d+\/receive$/) && method === 'POST') {
      const poId = Number(pathname.split('/')[2]);
      const po = db.purchaseOrders.find(p => p.id === poId);
      if (!po) return sendError(res, 'Purchase order not found', 404);

      if ((po.status || '').toLowerCase() === 'draft') {
        return sendError(res, 'Cannot receive materials against a Draft Purchase Order. Please confirm and order the PO first.', 422);
      }

      if (!body.photo_url && !body.photo_proof && !body.photo) {
        return sendError(res, 'Real-time camera photograph proof with live GPS coordinates is mandatory for material inward.', 422);
      }

      const rItems = body.items || [];

      // Validate all items against remaining limits before making updates
      for (const ri of rItems) {
        const itemId = Number(ri.purchase_order_item_id || ri.item_id || 0);
        const item = (po.items || []).find(i => i.id === itemId);
        const q = Number(ri.quantity_received || ri.received_quantity || 0);
        if (q < 0) {
          return sendError(res, 'Receive quantity cannot be negative.', 422);
        }
        if (item && q > 0) {
          const ordered = Number(item.quantity || 0);
          const already = Number(item.received_quantity || 0);
          const remaining = Math.max(0, ordered - already);
          if (q > remaining + 0.0001) {
            const desc = item.item_description || `Item #${itemId}`;
            const uom = item.uom || 'units';
            return sendError(res, `Receive quantity for ${desc} cannot exceed the remaining ordered quantity of ${remaining} ${uom}.`, 422);
          }
        }
      }

      let totalQty = 0;
      rItems.forEach(ri => {
        const itemId = Number(ri.purchase_order_item_id || ri.item_id || 0);
        const item = (po.items || []).find(i => i.id === itemId);
        const q = Number(ri.quantity_received || ri.received_quantity || 0);
        if (item && q > 0) {
          item.received_quantity = (item.received_quantity || 0) + q;
          totalQty += q;
          // Update material live stock balance
          if (item.material_id) {
            const mat = db.materials.find(m => m.id === item.material_id);
            if (mat) {
              const oldStock = mat.current_stock || 0;
              mat.current_stock += q;
              db.inventoryTransactions.push({
                id: db.inventoryTransactions.length + 1,
                material_id: mat.id,
                material_name: mat.name,
                material_code: mat.code,
                uom: mat.uom,
                transaction_type: 'RECEIPT',
                reference_type: 'Purchase Receipt',
                reference_id: po.id,
                quantity: q,
                previous_stock: oldStock,
                new_stock: mat.current_stock,
                notes: `Received against PO #${po.po_number}`,
                created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
              });
            }
          }
        }
      });

      const receivedItemsDetailed = rItems
        .filter(ri => Number(ri.quantity_received || ri.received_quantity || 0) > 0)
        .map(ri => {
          const itemId = Number(ri.purchase_order_item_id || ri.item_id || 0);
          const item = (po.items || []).find(i => i.id === itemId) || {};
          return {
            purchase_order_item_id: itemId,
            item_description: item.item_description || item.description || ri.item_description || 'Material Item',
            material_id: item.material_id,
            uom: item.uom || 'PCS',
            quantity_received: Number(ri.quantity_received || ri.received_quantity || 0),
          };
        });

      const grn = {
        id: (po.receipts || []).length + 1,
        receipt_no: body.receipt_no || `GRN-000${20 + Math.floor(Math.random() * 80)}`,
        receipt_date: body.receipt_date || new Date().toISOString().split('T')[0],
        delivery_challan_no: body.challan_no || body.delivery_challan_no || `DC-${Math.floor(1000 + Math.random() * 9000)}`,
        vehicle_no: body.vehicle_no || '',
        received_by: body.received_by || 'Stores Executive',
        condition: body.condition || 'Good',
        quantity_received: totalQty,
        photo_url: body.photo_url || body.photo_proof || body.photo || null,
        remarks: body.remarks || 'Goods verified and added to inventory',
        items: receivedItemsDetailed,
        po_id: po.id,
        po_number: po.po_number,
        supplier_id: po.supplier_id,
        supplier_name: po.supplier_name,
        category_id: po.category_id,
        category_name: po.category_name,
        production_order_id: po.production_order_id,
        production_order_number: po.production_order_number,
        created_at: new Date().toISOString(),
      };
      po.receipts = po.receipts || [];
      po.receipts.unshift(grn);
      po.status = 'Ordered';
      saveDB();
      return sendSuccess(res, grn, 'Goods received and stock updated with photo proof');
    }

    // Receipts / Payments / Returns endpoints
    if (pathname === '/purchase/receipts' && method === 'GET') {
      const allReceipts = [];
      db.purchaseOrders.forEach(p => {
        (p.receipts || []).forEach(r => allReceipts.push({
          ...r,
          po_number: p.po_number,
          supplier_name: p.supplier_name,
          production_order_id: p.production_order_id,
          production_order_number: p.production_order_number
        }));
      });
      return sendSuccess(res, allReceipts);
    }
    if (pathname === '/purchase/payments' && method === 'GET') {
      const allPayments = [];
      db.purchaseOrders.forEach(p => {
        (p.payments || []).forEach(pay => allPayments.push({ ...pay, po_number: p.po_number, supplier_name: p.supplier_name }));
      });
      return sendSuccess(res, allPayments);
    }
    if (pathname === '/purchase/returns') {
      if (method === 'GET') return sendSuccess(res, db.purchaseReturns);
      if (method === 'POST') {
        const newRet = {
          id: db.purchaseReturns.length + 1,
          return_number: `RET-000${db.purchaseReturns.length + 1}`,
          debit_note_no: `DN-${Math.floor(1000 + Math.random() * 9000)}`,
          status: 'Completed',
          ...body,
        };
        db.purchaseReturns.unshift(newRet);
        saveDB();
        return sendSuccess(res, newRet, 'Purchase return recorded', 201);
      }
    }

    // 9. Production Orders & Stages
    if (pathname === '/production-stages' && method === 'GET') return sendSuccess(res, db.productionStages);
    if (pathname === '/production-orders' && method === 'GET') {
      const enriched = (db.productionOrders || []).map(po => {
        const cust = (db.customers || []).find(c => c.id === Number(po.customer_id));
        let stageName = po.current_stage_name;
        let stageId = po.current_stage_id;
        if (!stageName && po.items && po.items.length > 0) {
          const allCompleted = po.items.every(it => it.status === 'Completed' || it.current_stage_id === 10 || (it.current_stage_name || '').toLowerCase() === 'completed');
          if (allCompleted) {
            stageName = 'Completed';
            stageId = 10;
          } else {
            const incompleteItems = po.items.filter(it => it.status !== 'Completed' && it.current_stage_id !== 10 && (it.current_stage_name || '').toLowerCase() !== 'completed');
            const itemsToSort = incompleteItems.length > 0 ? incompleteItems : po.items;
            const sorted = [...itemsToSort].sort((a, b) => {
              const seqA = (db.productionStages || []).find(s => s.id === a.current_stage_id)?.sequence_order ?? (a.current_stage_id || 1);
              const seqB = (db.productionStages || []).find(s => s.id === b.current_stage_id)?.sequence_order ?? (b.current_stage_id || 1);
              return seqA - seqB;
            });
            const activeItem = sorted[0];
            stageName = activeItem.current_stage_name || (db.productionStages || []).find(s => s.id === activeItem.current_stage_id)?.name || 'Requirement Gathering';
            stageId = activeItem.current_stage_id || 1;
          }
        }
        if (!stageName) {
          stageName = (po.status === 'Completed' || po.status === 'COMPLETED') ? 'Completed' : 'Requirement Gathering';
          stageId = stageName === 'Completed' ? 10 : 1;
        }

        return {
          ...po,
          current_stage_name: stageName,
          current_stage_id: stageId,
          customer_code: cust?.code || '',
          customer_name: cust?.name || po.customer_name || 'Buyer',
          customer_avatar_style: cust?.avatar_style || 'lorelei',
          customer_avatar_seed: cust?.avatar_seed || cust?.code || `buyer-${po.customer_id || 1}`,
          customer_avatar_config: cust?.avatar_config || null,
        };
      });
      return sendSuccess(res, enriched);
    }

    const prodOrdMatMatch = pathname.match(/^\/production-orders\/(\d+)\/(material-requirements|bom)$/);
    if (prodOrdMatMatch && method === 'POST') {
      const ordId = Number(prodOrdMatMatch[1]);
      const ord = (db.productionOrders || []).find(o => o.id === ordId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      ord.generated_bom = {
        total_materials: body.total_materials || body.materials || [],
        summary: body.summary || {},
        products: body.products || [],
        updated_at: new Date().toISOString()
      };
      saveDB();
      return sendSuccess(res, ord.generated_bom, 'Material requirements (BOM) persisted successfully');
    }

    if (prodOrdMatMatch && method === 'GET') {
      const ordId = Number(prodOrdMatMatch[1]);
      const ord = (db.productionOrders || []).find(o => o.id === ordId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      const cust = (db.customers || []).find(c => c.id === Number(ord.customer_id));
      const enrichedOrder = {
        ...ord,
        customer_code: cust?.code || '',
        customer_name: cust?.name || ord.customer_name || 'Buyer',
        customer_avatar_style: cust?.avatar_style || 'lorelei',
        customer_avatar_seed: cust?.avatar_seed || cust?.code || `buyer-${ord.customer_id || 1}`,
      };

      const isForced = parsedUrl.searchParams.get('force') === '1' || parsedUrl.searchParams.get('force') === 'true';

      // Return persisted BOM if already generated and not forced
      if (!isForced && ord.generated_bom && Array.isArray(ord.generated_bom.total_materials) && ord.generated_bom.total_materials.length > 0) {
        // Enrich any missing size, model, length, thickness from product components
        const bpcList = [];
        (ord.items || []).forEach(item => {
          const prod = (db.products || []).find(p => p.id === Number(item.product_id));
          if (prod && Array.isArray(prod.components)) {
            prod.components.forEach(c => bpcList.push(c));
          }
        });
        ord.generated_bom.total_materials.forEach(sm => {
          for (const c of bpcList) {
            const match = (sm.material_id && c.material_id && Number(sm.material_id) === Number(c.material_id)) ||
                          (sm.name && c.name && sm.name.trim().toLowerCase() === c.name.trim().toLowerCase());
            if (match) {
              if (!sm.size && c.size) sm.size = c.size;
              if (!sm.model && c.model) sm.model = c.model;
              if (!sm.length && c.length) sm.length = c.length;
              if (!sm.thickness && c.thickness) sm.thickness = c.thickness;
              break;
            }
          }
        });

        return sendSuccess(res, {
          order: enrichedOrder,
          products: ord.generated_bom.products || [],
          total_materials: ord.generated_bom.total_materials,
          summary: ord.generated_bom.summary || {
            total_products_count: (ord.generated_bom.products || []).length,
            total_order_garments: ord.total_quantity,
            total_distinct_materials: ord.generated_bom.total_materials.length,
            total_estimated_cost: ord.generated_bom.total_materials.reduce((s, m) => s + (m.total_estimated_cost || 0), 0)
          },
          generated_at: ord.generated_bom.updated_at || new Date().toISOString()
        });
      }

      const materialsMap = {};
      const productsBreakdown = [];
      let totalGarments = 0;

      (ord.items || []).forEach(item => {
        const pId = Number(item.product_id);
        const itemQty = Number(item.total_quantity || 0);
        totalGarments += itemQty;

        const bp = (db.buyer_products || []).find(p => p.id === pId) || (db.products || []).find(p => p.id === pId);
        const comps = (bp && bp.components && bp.components.length) ? bp.components : [
          { name: '100% Cotton Knitted Fabric', category: 'Fabric', uom: 'Meters', quantity_per_product: 0.45, wastage_percent: 5 },
          { name: 'Sewing Thread 2/40', category: 'Thread', uom: 'Cones', quantity_per_product: 0.02, wastage_percent: 2 },
          { name: 'Brand Main Neck Label', category: 'Label', uom: 'Pieces', quantity_per_product: 1, wastage_percent: 1 },
          { name: 'Polybag 10x14', category: 'Packaging', uom: 'Pieces', quantity_per_product: 1, wastage_percent: 2 }
        ];

        const productComps = [];
        comps.forEach(c => {
          const matName = c.name || 'Raw Material';
          const cat = c.category || 'Fabric';
          const uom = c.uom || 'Units';
          const perPiece = Number(c.quantity_per_product || 0);
          const wastage = Number(c.wastage_percent || 0);
          const lineReq = Number((itemQty * perPiece * (1 + (wastage / 100))).toFixed(3));

          // Match material in db.materials
          const mat = (db.materials || []).find(m => (c.material_id && m.id === Number(c.material_id)) || m.name.toLowerCase() === matName.toLowerCase());
          const rate = Number(mat?.purchase_rate || 120);
          const stock = Number(mat?.current_stock || 150);

          const size = c.size || null;
          const model = c.model || null;
          const length = c.length || null;
          const thickness = c.thickness || null;

          productComps.push({
            material_id: mat?.id || c.material_id || null,
            material_code: mat?.code || '',
            name: matName,
            category: cat,
            uom,
            size,
            model,
            length,
            thickness,
            quantity_per_product: perPiece,
            wastage_percent: wastage,
            required_quantity: lineReq,
          });

          const specKey = [size ? `s:${size}` : '', model ? `m:${model}` : '', length ? `l:${length}` : '', thickness ? `t:${thickness}` : ''].filter(Boolean).join(';');
          const aggKey = (mat?.id ? `id_${mat.id}` : `name_${matName}_${uom}`) + (specKey ? `_${specKey}` : '');
          if (!materialsMap[aggKey]) {
            materialsMap[aggKey] = {
              material_id: mat?.id || null,
              material_code: mat?.code || '',
              name: matName,
              category: cat,
              uom,
              size,
              model,
              length,
              thickness,
              unit_cost: rate,
              current_stock: stock,
              total_required_qty: 0,
              product_contributions: []
            };
          }

          materialsMap[aggKey].total_required_qty = Number((materialsMap[aggKey].total_required_qty + lineReq).toFixed(3));
          materialsMap[aggKey].product_contributions.push({
            product_id: pId,
            product_name: item.product_name || bp?.product_name || 'Garment Product',
            product_code: item.product_code || bp?.product_code || '',
            color: item.color,
            size,
            model,
            length,
            thickness,
            garment_qty: itemQty,
            per_piece_qty: perPiece,
            wastage_percent: wastage,
            required_qty: lineReq
          });
        });

        const cat = (db.categories || []).find(c => c.id === Number(bp?.category_id || ord.category_id));
        const category_name = cat?.name || bp?.category || ord.category_name || 'General';

        productsBreakdown.push({
          item_id: item.id,
          product_id: pId,
          product_name: item.product_name || bp?.product_name || 'Garment Product',
          product_code: item.product_code || bp?.product_code || '',
          category_name,
          color: item.color,
          size: item.size || null,
          total_quantity: itemQty,
          components: productComps
        });
      });

      const totalMaterialsList = [];
      let totalEstCost = 0;
      let inStockCount = 0;
      let shortageCount = 0;

      Object.values(materialsMap).forEach(m => {
        const req = Number(m.total_required_qty.toFixed(3));
        const stk = Number(m.current_stock.toFixed(3));
        const shortage = Math.max(0, Number((req - stk).toFixed(3)));
        const cost = Number((req * m.unit_cost).toFixed(2));
        totalEstCost += cost;

        let status = 'In Stock';
        if (shortage > 0) {
          status = stk > 0 ? 'Partial Stock' : 'Needs Procurement';
          shortageCount++;
        } else {
          inStockCount++;
        }

        totalMaterialsList.push({
          ...m,
          total_required_qty: req,
          shortage_qty: shortage,
          total_estimated_cost: cost,
          status
        });
      });

      totalMaterialsList.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

      const generatedSummary = {
        total_products_count: productsBreakdown.length,
        total_order_garments: totalGarments,
        total_distinct_materials: totalMaterialsList.length,
        in_stock_count: inStockCount,
        shortage_count: shortageCount,
        total_estimated_cost: Number(totalEstCost.toFixed(2))
      };

      // Persist newly generated BOM to ord (prevents duplicate BOMs upon repeated generations)
      ord.generated_bom = {
        total_materials: totalMaterialsList,
        summary: generatedSummary,
        products: productsBreakdown,
        updated_at: new Date().toISOString()
      };
      saveDB();

      return sendSuccess(res, {
        order: enrichedOrder,
        products: productsBreakdown,
        total_materials: totalMaterialsList,
        summary: generatedSummary,
        generated_at: ord.generated_bom.updated_at
      });
    }

    const prodOrdMatch = pathname.match(/^\/production-orders\/(\d+)$/);
    if (prodOrdMatch && method === 'GET') {
      const ordId = Number(prodOrdMatch[1]);
      const ord = (db.productionOrders || []).find(o => o.id === ordId);
      if (!ord) return sendError(res, 'Production order not found', 404);
      const cust = (db.customers || []).find(c => c.id === Number(ord.customer_id));
      return sendSuccess(res, {
        ...ord,
        customer_code: cust?.code || '',
        customer_name: cust?.name || ord.customer_name || 'Buyer',
        customer_avatar_style: cust?.avatar_style || 'lorelei',
        customer_avatar_seed: cust?.avatar_seed || cust?.code || `buyer-${ord.customer_id || 1}`,
      });
    }
    if (pathname === '/production-orders' && method === 'POST') {
      const customerId = Number(body.customer_id);
      if (!customerId) {
        return sendError(res, 'A valid Buyer is required for production order creation', 422);
      }

      const inputItems = body.items || [];
      if (!inputItems.length) {
        return sendError(res, 'At least one product line is required', 422);
      }

      // Validate buyer products
      if (db.buyer_products && db.buyer_products.length > 0) {
        for (let i = 0; i < inputItems.length; i++) {
          const it = inputItems[i];
          const bp = db.buyer_products.find(p => p.id === Number(it.product_id) && p.buyer_id === customerId);
          if (!bp) {
            return sendError(res, `Line #${i + 1}: Product does not belong to the selected buyer`, 422);
          }
        }
      }

      const items = inputItems.map((it, idx) => {
        const bp = (db.buyer_products || []).find(p => p.id === Number(it.product_id));
        return {
          id: idx + 1,
          product_id: Number(it.product_id) || 1,
          product_name: bp?.product_name || it.product_name || 'Buyer Product',
          product_code: bp?.product_code || 'BPRD-001',
          color: it.color || 'White',
          total_quantity: Number(it.total_quantity || 100),
          current_stage_id: 1,
          current_stage_name: 'Requirement Gathering',
          stage_code: 'REQ',
          current_stage_quantity: Number(it.total_quantity || 100),
          completed_quantity: 0,
          rejected_quantity: 0,
          rework_quantity: 0,
          status: 'In Progress',
        };
      });

      const totalQty = items.reduce((s, i) => s + i.total_quantity, 0);
      const matchedCust = customerId ? (db.customers || []).find(c => c.id === customerId) : null;
      const newOrder = {
        id: db.productionOrders.length + 1,
        order_number: `ORD-${1000 + db.productionOrders.length + 1}`,
        title: body.title || 'Export Garment Batch',
        customer_id: matchedCust?.id || null,
        customer_code: matchedCust?.code || null,
        customer_name: matchedCust?.name || 'Direct Order',
        customer_avatar_style: matchedCust?.avatar_style || 'lorelei',
        customer_avatar_seed: matchedCust?.avatar_seed || (matchedCust ? `buyer-${matchedCust.code || matchedCust.id}` : null),
        customer_avatar_config: matchedCust?.avatar_config || null,
        category_id: Number(body.category_id || 1),
        priority: body.priority || 'Medium',
        start_date: body.start_date || new Date().toISOString().split('T')[0],
        target_delivery_date: body.target_delivery_date || new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
        total_quantity: totalQty,
        completed_quantity: 0,
        status: 'IN PRODUCTION',
        current_stage_id: 1,
        current_stage_name: 'Requirement Gathering',
        notes: body.notes || '',
        items,
      };
      db.productionOrders.unshift(newOrder);
      saveDB();
      return sendSuccess(res, newOrder, 'Production order scheduled', 201);
    }

    // Move Stage
    if (pathname.includes('/stage') && method === 'POST') {
      const targetItemId = Number(body.order_item_id || body.item_id || 0);
      const targetOrderId = Number(body.production_order_id || body.order_id || 0);
      const toStageId = Number(body.to_stage_id || body.next_stage_id || 2);
      const targetStage = (db.productionStages || []).find(s => s.id === toStageId) || db.productionStages[1] || { id: 2, name: 'Purchase Order (PO)', code: 'PO' };

      let moved = false;
      for (const ord of (db.productionOrders || [])) {
        const isTargetOrder = targetOrderId && ord.id === targetOrderId;
        const containsTargetItem = targetItemId && (ord.items || []).some(i => i.id === targetItemId);

        if (isTargetOrder || containsTargetItem) {
          ord.current_stage_id = targetStage.id;
          ord.current_stage_name = targetStage.name;
          (ord.items || []).forEach(item => {
            if (!targetItemId || isTargetOrder || item.id === targetItemId) {
              item.current_stage_id = targetStage.id;
              item.current_stage_name = targetStage.name;
              item.stage_code = targetStage.code;
              if (targetStage.code === 'COMP') {
                item.status = 'Completed';
                item.completed_quantity = item.total_quantity;
              }
            }
          });
          moved = true;
          break;
        }
      }

      if (moved) {
        saveDB();
        return sendSuccess(res, { moved: true, stage_id: targetStage.id, stage_name: targetStage.name }, `Stage moved to ${targetStage.name}`);
      }
      return sendSuccess(res, null, 'Stage updated');
    }

    if (pathname.startsWith('/production/stage/') && method === 'GET') {
      const code = pathname.split('/')[3].toUpperCase();
      const stageItems = [];
      db.productionOrders.forEach(ord => {
        (ord.items || []).filter(i => (i.stage_code || '').toUpperCase() === code).forEach(it => {
          stageItems.push({
            ...it,
            order_number: ord.order_number,
            order_title: ord.title,
            priority: ord.priority,
            target_delivery_date: ord.target_delivery_date,
          });
        });
      });
      return sendSuccess(res, stageItems);
    }

    if (pathname === '/production/rework' && method === 'GET') return sendSuccess(res, db.reworkRecords);
    if (pathname === '/production/qc' && method === 'GET') return sendSuccess(res, db.qcRecords);

    if (pathname === '/qc' && method === 'POST') {
      const qcRec = {
        id: db.qcRecords.length + 1,
        inspector_name: 'S. Divya',
        ...body,
      };
      db.qcRecords.unshift(qcRec);
      if (body.rework_quantity > 0) {
        db.reworkRecords.unshift({
          id: db.reworkRecords.length + 1,
          order_number: body.order_number || 'ORD-1002',
          product_name: body.product_name || 'Apparel Lot',
          quantity: body.rework_quantity,
          target_stage_name: 'Stitching',
          status: 'IN REWORK',
          resolution_notes: body.remarks || 'Remedial fix required',
        });
      }
      saveDB();
      return sendSuccess(res, qcRec, 'QC recorded', 201);
    }

    // 9.5 Dyeing (Stage 04)
    if (!db.dyeingOrders) db.dyeingOrders = [];
    if (!db.dyeingReceipts) db.dyeingReceipts = [];

    if (pathname === '/dyeing/orders' && method === 'GET') {
      const pId = parsedUrl.searchParams.get('production_order_id');
      let list = [...(db.dyeingOrders || [])];
      if (pId) list = list.filter(d => String(d.production_order_id) === String(pId));
      return sendSuccess(res, list.reverse());
    }

    if (pathname === '/dyeing/orders' && method === 'POST') {
      const rawPId = body.production_order_id || body.order_number;
      let prodOrder = (db.productionOrders || []).find(o => String(o.id) === String(rawPId) || String(o.order_number) === String(rawPId));
      if (!prodOrder && Number(rawPId)) {
        prodOrder = (db.productionOrders || []).find(o => o.id === Number(rawPId));
      }
      if (!prodOrder && (db.productionOrders || []).length > 0) {
        prodOrder = db.productionOrders[0];
      }
      if (!prodOrder) return sendError(res, 'Valid production_order_id is required', 422);
      const pId = prodOrder.id;

      const items = body.items || [];
      if (!Array.isArray(items) || items.length === 0) {
        return sendError(res, 'At least one color item is required for Dyeing Order', 422);
      }

      // Calculate total outward fabric quantity across color breakdowns
      let totalFabricQty = 0;
      for (const it of items) {
        const q = Number(it.planned_quantity || it.quantity || 0);
        if (q <= 0) {
          return sendError(res, 'Each color must have a positive quantity (e.g. Green: 20, Red: 20)', 422);
        }
        totalFabricQty += q;
      }
      totalFabricQty = Number(totalFabricQty.toFixed(2));

      // Validate fabric material
      const matId = Number(body.fabric_material_id || 0);
      const mat = (db.materials || []).find(m => m.id === matId);
      if (mat) {
        const catName = (mat.category_name || '').toUpperCase();
        if (catName.includes('TRIM') || catName.includes('PACK') || catName.includes('THREAD') || catName.includes('DYE')) {
          return sendError(res, 'Selected material is not a valid fabric material for dyeing', 422);
        }
      }

      // Calculate total inwarded fabric for this order
      let totalInwarded = 0;
      (db.purchaseOrders || []).forEach(po => {
        if (po.production_order_id === pId || (po.remarks || '').includes(prodOrder.order_number)) {
          (po.items || []).forEach(it => {
            const isFabric = (po.category_name || '').toUpperCase().includes('FABRIC') ||
                             (it.item_description || '').toUpperCase().includes('FABRIC') ||
                             (it.category || '').toUpperCase().includes('FABRIC');
            if (isFabric) {
              if (!matId || it.material_id === matId || !it.material_id) {
                totalInwarded += Number(it.received_quantity || 0);
              }
            }
          });
        }
      });
      if (totalInwarded === 0) {
        totalInwarded = Number(prodOrder.total_quantity || 100);
      }

      // Calculate existing outward fabric for this order
      let totalOutward = 0;
      (db.dyeingOrders || []).forEach(d => {
        if (d.production_order_id === pId && d.status !== 'Cancelled') {
          if (!matId || d.fabric_material_id === matId || !d.fabric_material_id) {
            totalOutward += Number(d.total_fabric_quantity || 0);
          }
        }
      });

      const balanceAvailable = Math.max(0, Number((totalInwarded - totalOutward).toFixed(2)));
      const allowAdditional = !!(body.allow_overdraft || body.is_additional_lot || body.force_create || body.is_redyeing);

      if (balanceAvailable <= 0 && !allowAdditional) {
        return sendError(res, 'Selected fabric material has no eligible quantity remaining for dyeing (balance exhausted). Enable "Additional Lot / Re-dyeing" to issue additional outward fabric.', 422);
      }

      if (balanceAvailable > 0 && totalFabricQty > balanceAvailable && !allowAdditional) {
        return sendError(res, `Requested outward quantity (${totalFabricQty} ${body.uom || 'MTR'}) exceeds available inward fabric balance (${balanceAvailable} ${body.uom || 'MTR'}). Enable "Additional Lot / Re-dyeing" to authorize.`, 422);
      }

      const newDye = {
        id: (db.dyeingOrders || []).length + 1,
        dyeing_order_no: `DYE-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'Sent to Dyeing',
        total_fabric_quantity: totalFabricQty,
        total_received_quantity: 0,
        created_at: new Date().toISOString(),
        ...body,
      };
      if (!db.dyeingOrders) db.dyeingOrders = [];
      db.dyeingOrders.push(newDye);
      saveDB();
      return sendSuccess(res, newDye, 'Dyeing Order created successfully', 201);
    }

    const dyeReceiveMatch = pathname.match(/^\/dyeing\/orders\/([^/]+)\/receive$/);
    if (dyeReceiveMatch && method === 'POST') {
      const dyeKey = decodeURIComponent(dyeReceiveMatch[1]);
      const dyeOrder = (db.dyeingOrders || []).find(d => String(d.id) === String(dyeKey) || String(d.dyeing_order_no) === String(dyeKey));
      if (!dyeOrder) return sendError(res, 'Dyeing order not found', 404);
      const dyeId = dyeOrder.id;

      if (!body.photo_url) {
        return sendError(res, 'Real-time camera photograph proof with live GPS coordinates is mandatory before receiving dyed fabric.', 422);
      }

      if (!dyeOrder.items) dyeOrder.items = [];
      const items = body.items || [];
      let batchRec = 0;

      if (dyeOrder.items.length === 0 && items.length > 0) {
        items.forEach((it, idx) => {
          const q = Number(it.received_quantity || 0);
          if (q > 0) {
            batchRec += q;
            dyeOrder.items.push({
              id: idx + 1,
              color_name: it.color_name || dyeOrder.fabric_name || 'Dyed Fabric Material',
              planned_quantity: Number(it.planned_quantity || dyeOrder.total_fabric_quantity || q),
              received_quantity: q,
              shrinkage_loss_percent: Number(it.shrinkage_loss_percent || 0),
              shade_match_status: it.shade_match_status || 'Approved - Pantone Matched',
              notes: it.notes || ''
            });
          }
        });
      } else {
        (dyeOrder.items || []).forEach(it => {
          const matching = items.find(i => (i.item_id || i.id) === it.id);
          if (matching) {
            const q = Number(matching.received_quantity || 0);
            it.received_quantity = (it.received_quantity || 0) + q;
            it.shrinkage_loss_percent = Number(matching.shrinkage_loss_percent || 0);
            it.shade_match_status = matching.shade_match_status || 'Approved - Pantone Matched';
            batchRec += q;
          }
        });
      }

      dyeOrder.total_received_quantity = (dyeOrder.total_received_quantity || 0) + batchRec;
      dyeOrder.status = dyeOrder.total_received_quantity >= dyeOrder.total_fabric_quantity ? 'Received' : 'Partially Received';

      const rec = {
        id: (db.dyeingReceipts || []).length + 1,
        receipt_no: `DYE-GRN-${Math.floor(1000 + Math.random() * 9000)}`,
        dyeing_order_id: dyeId,
        production_order_id: dyeOrder.production_order_id || body.production_order_id || 1,
        receipt_date: body.receipt_date || new Date().toISOString().split('T')[0],
        delivery_challan_no: body.delivery_challan_no || '',
        received_by: body.received_by || 'Stores & QC Inward',
        total_received_quantity: batchRec,
        photo_url: body.photo_url || null,
        shade_condition: body.shade_condition || 'Approved - Pantone Matched',
        remarks: body.remarks || '',
        created_at: new Date().toISOString(),
      };
      if (!dyeOrder.receipts) dyeOrder.receipts = [];
      dyeOrder.receipts.unshift(rec);
      if (!db.dyeingReceipts) db.dyeingReceipts = [];
      db.dyeingReceipts.unshift(rec);
      saveDB();
      return sendSuccess(res, { receipt: rec, dyeing_status: dyeOrder.status }, 'Dyed fabric received successfully');
    }

    if (pathname === '/dyeing/fabric-stock' && method === 'GET') {
      const rawPId = parsedUrl.searchParams.get('production_order_id') || parsedUrl.searchParams.get('id');
      let prodOrder = (db.productionOrders || []).find(o => String(o.id) === String(rawPId) || String(o.order_number) === String(rawPId));
      if (!prodOrder && Number(rawPId)) {
        prodOrder = (db.productionOrders || []).find(o => o.id === Number(rawPId));
      }
      if (!prodOrder && (db.productionOrders || []).length > 0) {
        prodOrder = db.productionOrders[0];
      }
      if (!prodOrder) return sendError(res, 'Valid production_order_id is required', 422);
      const pId = prodOrder.id;

      // Track inwarded fabric materials by material ID
      const fabricMap = {}; // key: string(material_id)

      (db.purchaseOrders || []).forEach(po => {
        if (po.production_order_id === pId || (po.remarks || '').includes(prodOrder.order_number)) {
          (po.items || []).forEach(it => {
            const isFabric = (po.category_name || '').toUpperCase().includes('FABRIC') ||
                             (it.item_description || '').toUpperCase().includes('FABRIC') ||
                             (it.item_description || '').toUpperCase().includes('COTTON') ||
                             (it.item_description || '').toUpperCase().includes('JERSEY') ||
                             (it.category || '').toUpperCase().includes('FABRIC');
            if (isFabric) {
              const matId = it.material_id || 1;
              const mat = (db.materials || []).find(m => m.id === matId) || {};
              const key = String(matId);
              if (!fabricMap[key]) {
                fabricMap[key] = {
                  material_id: matId,
                  material_code: mat.code || it.material_code || `MAT-${matId}`,
                  material_name: mat.name || it.item_description || 'Fabric Material',
                  uom: it.uom || mat.uom || 'MTR',
                  inward_quantity: 0,
                  outward_quantity: 0,
                  available_quantity: 0,
                };
              }
              fabricMap[key].inward_quantity += Number(it.received_quantity || 0);
            }
          });
        }
      });

      // If no PO items found, populate from generated BOM materials (Fabric category only)
      if (Object.keys(fabricMap).length === 0 && prodOrder.generated_bom?.total_materials) {
        prodOrder.generated_bom.total_materials.forEach(m => {
          if ((m.category || '').toUpperCase().includes('FABRIC') || (m.name || '').toUpperCase().includes('FABRIC')) {
            const matId = m.material_id || 1;
            const mat = (db.materials || []).find(mat => mat.id === matId) || {};
            const key = String(matId);
            if (!fabricMap[key]) {
              fabricMap[key] = {
                material_id: matId,
                material_code: mat.code || m.material_code || `MAT-${matId}`,
                material_name: mat.name || m.name || 'Fabric Material',
                uom: m.uom || 'MTR',
                inward_quantity: Number(prodOrder.total_quantity || 100),
                outward_quantity: 0,
                available_quantity: 0,
              };
            }
          }
        });
      }

      // If still empty, supply the standard fabric materials from Material Master
      if (Object.keys(fabricMap).length === 0) {
        (db.materials || [])
          .filter(m => (m.category_name || '').toUpperCase().includes('FABRIC') || (m.name || '').toUpperCase().includes('COTTON') || (m.name || '').toUpperCase().includes('FABRIC'))
          .forEach(mat => {
            const key = String(mat.id);
            if (!fabricMap[key]) {
              fabricMap[key] = {
                material_id: mat.id,
                material_code: mat.code,
                material_name: mat.name,
                uom: mat.uom || 'MTR',
                inward_quantity: Number(prodOrder.total_quantity || 200),
                outward_quantity: 0,
                available_quantity: 0,
              };
            }
          });
      }

      // Calculate outward quantities from existing dyeing orders
      let totalOutward = 0;
      let totalReceivedFromDyeing = 0;
      (db.dyeingOrders || []).forEach(d => {
        if (d.production_order_id === pId && d.status !== 'Cancelled') {
          const qty = Number(d.total_fabric_quantity || 0);
          totalOutward += qty;
          totalReceivedFromDyeing += Number(d.total_received_quantity || 0);

          const key = d.fabric_material_id ? String(d.fabric_material_id) : Object.keys(fabricMap)[0];
          if (fabricMap[key]) {
            fabricMap[key].outward_quantity += qty;
          }
        }
      });

      let totalInwarded = 0;
      let totalOrdered = 0;
      Object.values(fabricMap).forEach(f => {
        f.available_quantity = Math.max(0, Number((f.inward_quantity - f.outward_quantity).toFixed(2)));
        totalInwarded += f.inward_quantity;
        totalOrdered += f.inward_quantity;
      });

      const fabricMaterialsList = Object.values(fabricMap);
      const balanceAvailable = Math.max(0, Number((totalInwarded - totalOutward).toFixed(2)));

      const suggestedColors = [];
      (prodOrder.items || []).forEach(it => {
        if (!suggestedColors.some(c => c.color_name === it.color)) {
          suggestedColors.push({ color_name: it.color, pantone_code: it.color_pantone_code || '', hex_code: it.color_hex_code || '#6366f1' });
        }
      });

      return sendSuccess(res, {
        production_order: prodOrder,
        total_fabric_ordered: totalOrdered,
        total_fabric_inwarded: totalInwarded,
        total_fabric_outward: totalOutward,
        balance_available_for_dyeing: balanceAvailable,
        total_fabric_received_from_dyeing: totalReceivedFromDyeing,
        fabric_materials: fabricMaterialsList,
        suggested_colors: suggestedColors,
        dyeing_mills: (db.dyeingMills && db.dyeingMills.length > 0) ? db.dyeingMills : (db.suppliers || []),
      });
    }

    // =========================================================================
    // ADVANCED PRODUCTION WORKFLOW (STAGES 5 THROUGH 10) & QUANTITY LEDGER
    // =========================================================================

    // Ledger Helper
    const logLedger = (poId, itemId, stageId, stageCode, txType, qty, batchNo, op, sup, refType, refId, remarks, meta) => {
      if (!db.productionQuantityLedger) db.productionQuantityLedger = [];
      const entry = {
        id: db.productionQuantityLedger.length + 1,
        production_order_id: Number(poId),
        production_order_item_id: Number(itemId),
        stage_id: Number(stageId),
        stage_code: stageCode,
        transaction_type: txType,
        quantity: Number(qty),
        batch_number: batchNo || null,
        operator_name: op || null,
        supervisor_name: sup || null,
        reference_type: refType || null,
        reference_id: refId || null,
        remarks: remarks || '',
        metadata_json: meta || null,
        created_at: new Date().toISOString()
      };
      db.productionQuantityLedger.push(entry);
      return entry;
    };

    // 1. Production Dashboard KPIs
    if (pathname === '/production/dashboard-stats' && method === 'GET') {
      const orders = db.productionOrders || [];
      const activeOrders = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'Cancelled');
      const totalOrderedQty = activeOrders.reduce((sum, o) => sum + Number(o.total_quantity || 0), 0);
      const totalInProdQty = activeOrders.reduce((sum, o) => {
        const itemQty = (o.items || []).reduce((iSum, i) => iSum + Number(i.current_stage_quantity || 0), 0);
        return sum + itemQty;
      }, 0);

      // Stage pending quantities
      let cutPending = 0;
      let embOutward = 0;
      let embInward = 0;
      let stiPending = 0;
      let chkPending = 0;
      let pckPending = 0;

      orders.forEach(o => {
        (o.items || []).forEach(it => {
          const sCode = (it.stage_code || '').toUpperCase();
          const q = Number(it.current_stage_quantity || 0);
          if (sCode === 'CUT' || it.current_stage_id === 5) cutPending += q;
          if (sCode === 'STI' || it.current_stage_id === 7) stiPending += q;
          if (sCode === 'CHK' || it.current_stage_id === 8) chkPending += q;
          if (sCode === 'PCK' || it.current_stage_id === 9) pckPending += q;
        });
      });

      (db.embroideryJobOrders || []).forEach(j => {
        if (j.status !== 'Cancelled') {
          embOutward += Number(j.total_quantity_sent || 0);
          embInward += Number(j.total_quantity_received || 0);
        }
      });
      const embOutstanding = Math.max(0, embOutward - embInward);

      const completedOrdersCount = orders.filter(o => o.status === 'COMPLETED' || o.status === 'Fully Dispatched').length;
      const partiallyDispatchedCount = orders.filter(o => o.status === 'Partially Dispatched').length;

      const now = new Date();
      const overdueOrdersCount = orders.filter(o => {
        if (o.status === 'COMPLETED' || o.status === 'Fully Dispatched') return false;
        if (!o.target_delivery_date) return false;
        return new Date(o.target_delivery_date) < now;
      }).length;

      return sendSuccess(res, {
        total_active_orders: activeOrders.length,
        total_ordered_quantity: totalOrderedQty,
        total_quantity_in_production: totalInProdQty,
        cutting_pending_quantity: cutPending,
        embroidery_outward_quantity: embOutward,
        embroidery_outstanding_quantity: embOutstanding,
        stitching_pending_quantity: stiPending,
        checking_pending_quantity: chkPending,
        packing_pending_quantity: pckPending,
        completed_orders: completedOrdersCount,
        partially_dispatched_orders: partiallyDispatchedCount,
        overdue_orders: overdueOrdersCount
      });
    }

    // 2. Product-Wise Quantity Tracking & Ledger for an Order
    const prodQtyMatch = pathname.match(/^\/production\/orders\/(\d+)\/product-quantities$/);
    if (prodQtyMatch && method === 'GET') {
      const oId = Number(prodQtyMatch[1]);
      const ord = (db.productionOrders || []).find(o => o.id === oId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      const products = (ord.items || []).map(item => {
        const bp = (db.buyer_products || []).find(p => p.id === Number(item.product_id));
        const cBatches = (db.cuttingBatches || []).filter(b => b.production_order_item_id === item.id);
        const cutTotal = cBatches.reduce((s, b) => s + Number(b.actual_cut_quantity || 0), 0);
        const cutAccepted = cBatches.reduce((s, b) => s + Number(b.accepted_output_quantity || 0), 0);
        const cutRejected = cBatches.reduce((s, b) => s + Number(b.rejected_quantity || 0), 0);
        const cutRework = cBatches.reduce((s, b) => s + Number(b.rework_quantity || 0), 0);

        // Embroidery
        let embSent = 0;
        let embRec = 0;
        let embAcc = 0;
        (db.embroideryJobOrders || []).forEach(j => {
          (j.items || []).forEach(ji => {
            if (ji.production_order_item_id === item.id) {
              embSent += Number(ji.quantity_sent || 0);
              embRec += Number(ji.quantity_received || 0);
              embAcc += Number(ji.quantity_accepted || 0);
            }
          });
        });
        const embOutstanding = Math.max(0, embSent - embRec);

        // Stitching
        const sBatches = (db.stitchingBatches || []).filter(b => b.production_order_item_id === item.id);
        const stiComp = sBatches.reduce((s, b) => s + Number(b.completed_quantity || 0), 0);
        const stiAcc = sBatches.reduce((s, b) => s + Number(b.accepted_quantity || 0), 0);
        const stiRej = sBatches.reduce((s, b) => s + Number(b.rejected_quantity || 0), 0);
        const stiRwk = sBatches.reduce((s, b) => s + Number(b.rework_quantity || 0), 0);

        // Checking / QC
        const inspections = (db.qualityInspections || []).filter(i => i.production_order_item_id === item.id);
        const chkSubmitted = inspections.reduce((s, i) => s + Number(i.submitted_quantity || 0), 0);
        const chkPassed = inspections.reduce((s, i) => s + Number(i.passed_quantity || 0), 0);
        const chkFailed = inspections.reduce((s, i) => s + Number(i.failed_quantity || 0), 0);
        const chkRwk = inspections.reduce((s, i) => s + Number(i.rework_quantity || 0), 0);
        const chkRej = inspections.reduce((s, i) => s + Number(i.rejected_quantity || 0), 0);

        // Packing
        const pBatches = (db.packingBatches || []).filter(b => b.production_order_item_id === item.id);
        const pckPacked = pBatches.reduce((s, b) => s + Number(b.packed_quantity || 0), 0);
        const pckBoxes = pBatches.reduce((s, b) => s + Number(b.number_of_boxes || 0), 0);
        const pckCartons = pBatches.reduce((s, b) => s + Number(b.number_of_master_cartons || 0), 0);

        // Dispatch
        let dspTotal = 0;
        (db.dispatchRecords || []).forEach(dr => {
          (dr.items_breakdown || []).forEach(ib => {
            if (ib.production_order_item_id === item.id) {
              dspTotal += Number(ib.dispatched_quantity || 0);
            }
          });
        });

        const totalQty = Number(item.total_quantity || 0);
        const pendingQty = Math.max(0, totalQty - dspTotal);
        const progressPct = totalQty > 0 ? Math.min(100, Math.round((dspTotal / totalQty) * 100)) : 0;

        return {
          item_id: item.id,
          product_id: item.product_id,
          product_name: bp?.product_name || item.product_name || 'Garment Product',
          product_code: bp?.product_code || item.product_code || '',
          color: item.color,
          size: item.size || 'M',
          order_quantity: totalQty,
          current_stage_id: item.current_stage_id,
          current_stage_name: item.current_stage_name,
          current_stage_quantity: Number(item.current_stage_quantity || 0),
          status: item.status,
          cutting: {
            cut_quantity: cutTotal,
            accepted_quantity: cutAccepted,
            rejected_quantity: cutRejected,
            rework_quantity: cutRework,
            pending_quantity: Math.max(0, totalQty - cutAccepted)
          },
          embroidery: {
            sent_quantity: embSent,
            received_quantity: embRec,
            accepted_quantity: embAcc,
            outstanding_quantity: embOutstanding
          },
          stitching: {
            completed_quantity: stiComp,
            accepted_quantity: stiAcc,
            rejected_quantity: stiRej,
            rework_quantity: stiRwk
          },
          checking: {
            submitted_quantity: chkSubmitted,
            passed_quantity: chkPassed,
            failed_quantity: chkFailed,
            rework_quantity: chkRwk,
            rejected_quantity: chkRej
          },
          packing: {
            packed_quantity: pckPacked,
            boxes_count: pckBoxes,
            cartons_count: pckCartons,
            unpacked_quantity: Math.max(0, (chkPassed || totalQty) - pckPacked)
          },
          dispatch: {
            dispatched_quantity: dspTotal,
            pending_dispatch_quantity: Math.max(0, pckPacked - dspTotal)
          },
          progress_percent: progressPct,
          overall_pending_quantity: pendingQty
        };
      });

      return sendSuccess(res, {
        order_id: ord.id,
        order_number: ord.order_number,
        title: ord.title,
        customer_name: ord.customer_name,
        total_order_quantity: ord.total_quantity,
        completed_quantity: ord.completed_quantity,
        products
      });
    }

    const ledgerMatch = pathname.match(/^\/production\/orders\/(\d+)\/quantity-ledger$/);
    if (ledgerMatch && method === 'GET') {
      const oId = Number(ledgerMatch[1]);
      const itemId = parsedUrl.searchParams.get('item_id');
      let entries = (db.productionQuantityLedger || []).filter(e => e.production_order_id === oId);
      if (itemId) entries = entries.filter(e => String(e.production_order_item_id) === String(itemId));
      return sendSuccess(res, entries.reverse());
    }

    // 3. Stage 5: Cutting Endpoints
    if (pathname === '/production/cutting/orders' && method === 'GET') {
      const orders = (db.productionOrders || []).map(ord => {
        const cutItems = (ord.items || []).filter(i => (i.stage_code || '').toUpperCase() === 'CUT' || i.current_stage_id === 5);
        const batches = (db.cuttingBatches || []).filter(b => b.production_order_id === ord.id);
        const totalCut = batches.reduce((s, b) => s + Number(b.actual_cut_quantity || 0), 0);
        const totalAccepted = batches.reduce((s, b) => s + Number(b.accepted_output_quantity || 0), 0);
        return {
          ...ord,
          cutting_items: cutItems,
          batches_count: batches.length,
          total_cut_quantity: totalCut,
          total_accepted_quantity: totalAccepted,
          cutting_status: totalAccepted >= ord.total_quantity ? 'Completed' : (batches.length > 0 ? 'In Progress' : 'Not Started')
        };
      });
      return sendSuccess(res, orders);
    }

    const cutDetailMatch = pathname.match(/^\/production\/cutting\/(\d+)$/);
    if (cutDetailMatch && method === 'GET') {
      const oId = Number(cutDetailMatch[1]);
      const ord = (db.productionOrders || []).find(o => o.id === oId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      const cust = (db.customers || []).find(c => c.id === Number(ord.customer_id));
      const batches = (db.cuttingBatches || []).filter(b => b.production_order_id === oId);
      const items = (ord.items || []).map(it => {
        const bp = (db.buyer_products || []).find(p => p.id === Number(it.product_id));
        const itBatches = batches.filter(b => b.production_order_item_id === it.id);
        const cutQty = itBatches.reduce((s, b) => s + Number(b.actual_cut_quantity || 0), 0);
        const accQty = itBatches.reduce((s, b) => s + Number(b.accepted_output_quantity || 0), 0);
        const rejQty = itBatches.reduce((s, b) => s + Number(b.rejected_quantity || 0), 0);
        const rwkQty = itBatches.reduce((s, b) => s + Number(b.rework_quantity || 0), 0);
        const transferred = itBatches.reduce((s, b) => s + Number(b.transferred_to_next_stage_quantity || 0), 0);

        return {
          ...it,
          product_name: bp?.product_name || it.product_name,
          product_code: bp?.product_code || it.product_code,
          batches: itBatches,
          total_cut_quantity: cutQty,
          accepted_output_quantity: accQty,
          rejected_quantity: rejQty,
          rework_quantity: rwkQty,
          transferred_quantity: transferred,
          available_for_transfer: Math.max(0, accQty - transferred),
          pending_cut_quantity: Math.max(0, Number(it.total_quantity || 0) - accQty)
        };
      });

      return sendSuccess(res, {
        order: {
          ...ord,
          customer_name: cust?.name || ord.customer_name,
          customer_code: cust?.code || ord.customer_code,
          customer_avatar_style: cust?.avatar_style || 'lorelei',
          customer_avatar_seed: cust?.avatar_seed || `buyer-${ord.customer_id}`
        },
        items,
        batches: batches.reverse()
      });
    }

    if (pathname === '/production/cutting/batch' && method === 'POST') {
      const { production_order_id, production_order_item_id, assigned_quantity, actual_cut_quantity, rejected_quantity, rework_quantity, operator, supervisor, machine_line, remarks, photo_urls } = body;
      
      const pId = Number(production_order_id);
      const itemId = Number(production_order_item_id);
      const assigned = Number(assigned_quantity || 0);
      const actual = Number(actual_cut_quantity || 0);
      const rej = Number(rejected_quantity || 0);
      const rwk = Number(rework_quantity || 0);
      const accepted = Math.max(0, actual - rej - rwk);

      if (actual <= 0) return sendError(res, 'Actual cut quantity must be greater than zero', 422);

      if (!photo_urls || !Array.isArray(photo_urls) || photo_urls.length === 0) {
        return sendError(res, 'Real-time camera photograph with live GPS coordinates is mandatory before confirming cutting batch.', 422);
      }

      const ord = (db.productionOrders || []).find(o => o.id === pId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      const item = (ord.items || []).find(i => i.id === itemId);
      if (!item) return sendError(res, 'Order item not found', 404);

      if (!db.cuttingBatches) db.cuttingBatches = [];
      const batchNo = `CUT-${ord.order_number}-${item.id}-${db.cuttingBatches.length + 1}`;

      const newBatch = {
        id: db.cuttingBatches.length + 1,
        production_order_id: pId,
        production_order_item_id: itemId,
        batch_number: batchNo,
        cutting_date: body.cutting_date || new Date().toISOString().split('T')[0],
        assigned_quantity: assigned || actual,
        actual_cut_quantity: actual,
        rejected_quantity: rej,
        rework_quantity: rwk,
        accepted_output_quantity: accepted,
        pending_quantity: Math.max(0, Number(item.total_quantity) - accepted),
        operator: operator || 'Cutting Team',
        supervisor: supervisor || 'Cutting Lead',
        machine_line: machine_line || 'Automatic Spreader Line 1',
        remarks: remarks || '',
        photo_urls: photo_urls || [],
        transferred_to_next_stage_quantity: 0,
        status: 'In Progress',
        product_name: item.product_name,
        product_code: item.product_code,
        color: item.color,
        size: item.size || 'M',
        created_at: new Date().toISOString()
      };

      db.cuttingBatches.push(newBatch);

      // Ledger entries
      logLedger(pId, itemId, 5, 'CUT', 'INPUT', actual, batchNo, operator, supervisor, 'Cutting Batch', String(newBatch.id), remarks, { rejected: rej, rework: rwk });
      logLedger(pId, itemId, 5, 'CUT', 'ACCEPTED', accepted, batchNo, operator, supervisor, 'Cutting Output', String(newBatch.id), 'Net accepted output');

      // Update item progress
      const totalAcc = (db.cuttingBatches || []).filter(b => b.production_order_item_id === itemId).reduce((s, b) => s + Number(b.accepted_output_quantity || 0), 0);
      if (totalAcc >= Number(item.total_quantity)) {
        item.status = 'Cutting Complete';
      }

      saveDB();
      return sendSuccess(res, newBatch, 'Cutting batch recorded successfully', 201);
    }

    if (pathname === '/production/cutting/transfer' && method === 'POST') {
      const { batch_id, destination_stage_id, transfer_quantity, remarks } = body;
      const bId = Number(batch_id);
      const batch = (db.cuttingBatches || []).find(b => b.id === bId);
      if (!batch) return sendError(res, 'Cutting batch not found', 404);

      const qty = Number(transfer_quantity || 0);
      const avail = Number(batch.accepted_output_quantity) - Number(batch.transferred_to_next_stage_quantity || 0);
      if (qty <= 0 || qty > avail) return sendError(res, `Transfer quantity (${qty}) must be between 1 and available (${avail})`, 422);

      batch.transferred_to_next_stage_quantity = Number(batch.transferred_to_next_stage_quantity || 0) + qty;
      batch.status = batch.transferred_to_next_stage_quantity >= batch.accepted_output_quantity ? 'Fully Transferred' : 'Partial Transfer';

      const destStageId = Number(destination_stage_id || 6); // default to EMB (6) or STI (7)
      const targetStage = (db.productionStages || []).find(s => s.id === destStageId) || { id: 6, code: 'EMB', name: 'Embroidery' };

      // Update order item stage
      const ord = (db.productionOrders || []).find(o => o.id === batch.production_order_id);
      if (ord) {
        const item = (ord.items || []).find(i => i.id === batch.production_order_item_id);
        if (item) {
          item.current_stage_id = targetStage.id;
          item.current_stage_name = targetStage.name;
          item.stage_code = targetStage.code;
          item.current_stage_quantity = qty;
        }
      }

      logLedger(batch.production_order_id, batch.production_order_item_id, 5, 'CUT', 'TRANSFERRED', qty, batch.batch_number, null, null, 'Stage Transfer', String(targetStage.id), remarks || `Transferred to ${targetStage.name}`);
      saveDB();
      return sendSuccess(res, batch, `Transferred ${qty} pcs to ${targetStage.name}`);
    }

    // 4. Stage 6: Embroidery Job Orders (Outward & Inward)
    if (pathname === '/production/embroidery/job-orders' && method === 'GET') {
      const pId = parsedUrl.searchParams.get('production_order_id');
      let list = [...(db.embroideryJobOrders || [])];
      if (pId) list = list.filter(j => String(j.production_order_id) === String(pId));
      return sendSuccess(res, list.reverse());
    }

    const embDetailMatch = pathname.match(/^\/production\/embroidery\/(\d+)$/);
    if (embDetailMatch && method === 'GET') {
      const oId = Number(embDetailMatch[1]);
      const ord = (db.productionOrders || []).find(o => o.id === oId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      const cust = (db.customers || []).find(c => c.id === Number(ord.customer_id));
      const jobOrders = (db.embroideryJobOrders || []).filter(j => j.production_order_id === oId);
      const receipts = (db.embroideryReceipts || []).filter(r => r.production_order_id === oId);

      const items = (ord.items || []).map(it => {
        const bp = (db.buyer_products || []).find(p => p.id === Number(it.product_id));
        let sent = 0;
        let rec = 0;
        let acc = 0;
        jobOrders.forEach(j => {
          (j.items || []).forEach(ji => {
            if (ji.production_order_item_id === it.id) {
              sent += Number(ji.quantity_sent || 0);
              rec += Number(ji.quantity_received || 0);
              acc += Number(ji.quantity_accepted || 0);
            }
          });
        });
        return {
          ...it,
          product_name: bp?.product_name || it.product_name,
          product_code: bp?.product_code || it.product_code,
          total_sent: sent,
          total_received: rec,
          total_accepted: acc,
          total_outstanding: Math.max(0, sent - rec),
          available_for_outward: Math.max(0, Number(it.total_quantity || 0) - sent)
        };
      });

      return sendSuccess(res, {
        order: {
          ...ord,
          customer_name: cust?.name || ord.customer_name,
          customer_code: cust?.code || ord.customer_code,
          customer_avatar_style: cust?.avatar_style || 'lorelei',
          customer_avatar_seed: cust?.avatar_seed || `buyer-${ord.customer_id}`
        },
        items,
        job_orders: jobOrders.reverse(),
        receipts: receipts.reverse(),
        vendors: (db.embroideryWorks && db.embroideryWorks.length > 0) ? db.embroideryWorks : (db.suppliers || [])
      });
    }

    if (pathname === '/production/embroidery/job-order' && method === 'POST') {
      const { production_order_id, vendor_name, dispatch_date, expected_return_date, delivery_challan_no, transport_courier, sent_by, notes, attachments, items } = body;
      const pId = Number(production_order_id);
      const ord = (db.productionOrders || []).find(o => o.id === pId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      if (!items || !items.length) return sendError(res, 'At least one product item is required for job order', 422);

      if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
        return sendError(res, 'Real-time camera photograph with live GPS coordinates of the delivery challan / dispatch bundle is mandatory.', 422);
      }

      if (!db.embroideryJobOrders) db.embroideryJobOrders = [];
      const jobNo = `EMB-JOB-${1000 + db.embroideryJobOrders.length + 1}`;

      let totalSent = 0;
      const processedItems = items.map((it, idx) => {
        const q = Number(it.quantity_sent || 0);
        totalSent += q;
        return {
          id: idx + 1,
          production_order_item_id: Number(it.production_order_item_id),
          product_name: it.product_name || 'Embroidery Lot',
          product_code: it.product_code || '',
          color: it.color || 'White',
          size: it.size || 'M',
          design_reference: it.design_reference || 'Chest Embroidery Logo',
          uom: it.uom || 'Pieces',
          quantity_sent: q,
          quantity_received: 0,
          quantity_accepted: 0,
          quantity_rejected: 0,
          quantity_rework: 0,
          quantity_outstanding: q
        };
      });

      const newJob = {
        id: db.embroideryJobOrders.length + 1,
        job_order_number: jobNo,
        production_order_id: pId,
        production_order_number: ord.order_number,
        vendor_name: vendor_name || 'Apex Embroidery Works',
        job_order_date: new Date().toISOString().split('T')[0],
        dispatch_date: dispatch_date || new Date().toISOString().split('T')[0],
        expected_return_date: expected_return_date || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        delivery_challan_no: delivery_challan_no || `DC-EMB-${Math.floor(1000 + Math.random() * 9000)}`,
        transport_courier: transport_courier || 'Company Dispatch Vehicle',
        sent_by: sent_by || 'Production Supervisor',
        total_quantity_sent: totalSent,
        total_quantity_received: 0,
        total_quantity_accepted: 0,
        total_quantity_rejected: 0,
        total_quantity_rework: 0,
        total_quantity_outstanding: totalSent,
        status: 'Sent to Vendor',
        notes: notes || '',
        attachments: attachments || [],
        items: processedItems,
        created_at: new Date().toISOString()
      };

      db.embroideryJobOrders.push(newJob);

      // Ledger
      processedItems.forEach(it => {
        logLedger(pId, it.production_order_item_id, 6, 'EMB', 'OUTWARD', it.quantity_sent, jobNo, sent_by, null, 'Embroidery Job Order', jobNo, notes);
      });

      saveDB();
      return sendSuccess(res, newJob, 'Embroidery Job Order created successfully', 201);
    }

    if (pathname === '/production/embroidery/inward' && method === 'POST') {
      const { job_order_id, receipt_date, vendor_challan_no, received_by, remarks, photo_urls, items } = body;
      const jId = Number(job_order_id);
      const job = (db.embroideryJobOrders || []).find(j => j.id === jId);
      if (!job) return sendError(res, 'Job order not found', 404);

      if (!items || !items.length) return sendError(res, 'Item inward quantities are required', 422);

      if (!photo_urls || !Array.isArray(photo_urls) || photo_urls.length === 0) {
        return sendError(res, 'Real-time camera photograph with live GPS coordinates of received embroidery pieces & QC inspection is mandatory.', 422);
      }

      if (!db.embroideryReceipts) db.embroideryReceipts = [];
      const recNo = `EMB-INW-${1000 + db.embroideryReceipts.length + 1}`;

      let recTotal = 0;
      let accTotal = 0;
      let rejTotal = 0;
      let rwkTotal = 0;

      const itemsData = items.map(it => {
        const matchingJobItem = (job.items || []).find(ji => ji.production_order_item_id === Number(it.production_order_item_id));
        const rQty = Number(it.received_quantity || 0);
        const aQty = Number(it.accepted_quantity || rQty);
        const reQty = Number(it.rejected_quantity || 0);
        const rwQty = Number(it.rework_quantity || 0);

        if (matchingJobItem) {
          const currentOut = Number(matchingJobItem.quantity_outstanding || matchingJobItem.quantity_sent);
          if (rQty > currentOut) {
            throw new Error(`Inward quantity (${rQty}) cannot exceed outstanding quantity (${currentOut}) for ${matchingJobItem.product_name}`);
          }
          matchingJobItem.quantity_received = Number(matchingJobItem.quantity_received || 0) + rQty;
          matchingJobItem.quantity_accepted = Number(matchingJobItem.quantity_accepted || 0) + aQty;
          matchingJobItem.quantity_rejected = Number(matchingJobItem.quantity_rejected || 0) + reQty;
          matchingJobItem.quantity_rework = Number(matchingJobItem.quantity_rework || 0) + rwQty;
          matchingJobItem.quantity_outstanding = Math.max(0, matchingJobItem.quantity_sent - matchingJobItem.quantity_received);
        }

        recTotal += rQty;
        accTotal += aQty;
        rejTotal += reQty;
        rwkTotal += rwQty;

        // Ledger
        logLedger(job.production_order_id, it.production_order_item_id, 6, 'EMB', 'INWARD', rQty, job.job_order_number, received_by, null, 'Embroidery Inward', recNo, remarks);
        logLedger(job.production_order_id, it.production_order_item_id, 6, 'EMB', 'ACCEPTED', aQty, job.job_order_number, received_by, null, 'Embroidery Accepted', recNo, 'Passed embroidery QC');

        return {
          production_order_item_id: Number(it.production_order_item_id),
          product_name: matchingJobItem?.product_name || 'Product',
          color: matchingJobItem?.color || 'Color',
          received_quantity: rQty,
          accepted_quantity: aQty,
          rejected_quantity: reQty,
          rework_quantity: rwQty
        };
      });

      job.total_quantity_received = Number(job.total_quantity_received || 0) + recTotal;
      job.total_quantity_accepted = Number(job.total_quantity_accepted || 0) + accTotal;
      job.total_quantity_rejected = Number(job.total_quantity_rejected || 0) + rejTotal;
      job.total_quantity_rework = Number(job.total_quantity_rework || 0) + rwkTotal;
      job.total_quantity_outstanding = Math.max(0, job.total_quantity_sent - job.total_quantity_received);
      job.status = job.total_quantity_outstanding === 0 ? 'Received' : 'Partially Received';

      const newReceipt = {
        id: db.embroideryReceipts.length + 1,
        receipt_number: recNo,
        job_order_id: jId,
        production_order_id: job.production_order_id,
        vendor_name: job.vendor_name,
        receipt_date: receipt_date || new Date().toISOString().split('T')[0],
        vendor_challan_no: vendor_challan_no || '',
        received_by: received_by || 'QC Inward Lead',
        total_received_qty: recTotal,
        total_accepted_qty: accTotal,
        total_rejected_qty: rejTotal,
        total_rework_qty: rwkTotal,
        remarks: remarks || '',
        photo_urls: photo_urls || [],
        items_data: itemsData,
        created_at: new Date().toISOString()
      };

      db.embroideryReceipts.push(newReceipt);

      // Advance stage to Stitching (7) for accepted quantities
      const ord = (db.productionOrders || []).find(o => o.id === job.production_order_id);
      if (ord) {
        items.forEach(it => {
          const item = (ord.items || []).find(i => i.id === Number(it.production_order_item_id));
          if (item) {
            item.current_stage_id = 7;
            item.current_stage_name = 'Stitching — Color-wise Tracking';
            item.stage_code = 'STI';
            item.current_stage_quantity = Number(it.accepted_quantity || it.received_quantity);
          }
        });
      }

      saveDB();
      return sendSuccess(res, newReceipt, 'Embroidery Inward recorded and reconciled successfully', 201);
    }

    if (pathname === '/production/embroidery/vendor-outstanding' && method === 'GET') {
      const vendorMap = {};
      (db.embroideryJobOrders || []).forEach(j => {
        const v = j.vendor_name || 'Vendor';
        if (!vendorMap[v]) {
          vendorMap[v] = {
            vendor_name: v,
            total_job_orders: 0,
            total_sent: 0,
            total_received: 0,
            total_accepted: 0,
            total_outstanding: 0,
            orders_list: []
          };
        }
        vendorMap[v].total_job_orders++;
        vendorMap[v].total_sent += Number(j.total_quantity_sent || 0);
        vendorMap[v].total_received += Number(j.total_quantity_received || 0);
        vendorMap[v].total_accepted += Number(j.total_quantity_accepted || 0);
        vendorMap[v].total_outstanding += Number(j.total_quantity_outstanding || 0);
        vendorMap[v].orders_list.push({
          job_order_number: j.job_order_number,
          order_number: j.production_order_number,
          dispatch_date: j.dispatch_date,
          expected_return_date: j.expected_return_date,
          sent: j.total_quantity_sent,
          outstanding: j.total_quantity_outstanding,
          status: j.status
        });
      });
      return sendSuccess(res, Object.values(vendorMap));
    }

    // 5. Stage 7: Stitching
    if (pathname === '/production/stitching/orders' && method === 'GET') {
      const orders = (db.productionOrders || []).map(ord => {
        const stiItems = (ord.items || []).filter(i => (i.stage_code || '').toUpperCase() === 'STI' || i.current_stage_id === 7);
        const batches = (db.stitchingBatches || []).filter(b => b.production_order_id === ord.id);
        const totalComp = batches.reduce((s, b) => s + Number(b.completed_quantity || 0), 0);
        const totalAcc = batches.reduce((s, b) => s + Number(b.accepted_quantity || 0), 0);
        return {
          ...ord,
          stitching_items: stiItems,
          batches_count: batches.length,
          total_completed_quantity: totalComp,
          total_accepted_quantity: totalAcc,
          stitching_status: totalAcc >= ord.total_quantity ? 'Completed' : (batches.length > 0 ? 'In Progress' : 'Not Started')
        };
      });
      return sendSuccess(res, orders);
    }

    const stiDetailMatch = pathname.match(/^\/production\/stitching\/(\d+)$/);
    if (stiDetailMatch && method === 'GET') {
      const oId = Number(stiDetailMatch[1]);
      const ord = (db.productionOrders || []).find(o => o.id === oId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      const cust = (db.customers || []).find(c => c.id === Number(ord.customer_id));
      const batches = (db.stitchingBatches || []).filter(b => b.production_order_id === oId);
      const cuttingBatches = (db.cuttingBatches || []).filter(b => b.production_order_id === oId);
      const embReceipts = (db.embroideryReceipts || []).filter(r => r.production_order_id === oId);
      const embJobs = (db.embroideryJobOrders || []).filter(j => j.production_order_id === oId);

      // Group order items by product_id and color
      const grouped = {};
      (ord.items || []).forEach(it => {
        const bp = (db.buyer_products || []).find(p => p.id === Number(it.product_id));
        const key = `${it.product_id}_${(it.color || '').trim()}`;
        if (!grouped[key]) {
          grouped[key] = {
            ...it,
            product_name: bp?.product_name || it.product_name || 'Garment Product',
            product_code: bp?.product_code || it.product_code || 'PRD',
            order_quantity: Number(it.total_quantity || 0),
            active_stitching_item_id: it.id,
            current_stage_quantity: Number(it.current_stage_id) === 7 ? Number(it.current_stage_quantity || 0) : 0
          };
        } else {
          grouped[key].order_quantity += Number(it.total_quantity || 0);
          if (Number(it.current_stage_id) === 7) {
            grouped[key].current_stage_quantity += Number(it.current_stage_quantity || 0);
            grouped[key].active_stitching_item_id = it.id;
          }
        }
      });

      const items = Object.values(grouped).map(gIt => {
        const pId = Number(gIt.product_id);
        const color = (gIt.color || '').trim();

        // 1. Arrived from Cutting to Stitching (destination_stage_id === 7)
        let arrivedFromCutting = 0;
        cuttingBatches.forEach(cb => {
          const cbDest = Number(cb.destination_stage_id || 6);
          if (cbDest === 7 && Number(cb.product_id) === pId && (cb.color || '').trim() === color) {
            arrivedFromCutting += Number(cb.transferred_quantity > 0 ? cb.transferred_quantity : (cb.actual_cut_quantity || 0));
          }
        });

        // 2. Arrived from Embroidery
        let arrivedFromEmbroidery = 0;
        embReceipts.forEach(rcpt => {
          const rItems = Array.isArray(rcpt.items_data) ? rcpt.items_data : [];
          rItems.forEach(ri => {
            if (Number(ri.product_id) === pId && (ri.color || '').trim() === color) {
              arrivedFromEmbroidery += Number(ri.accepted_quantity || 0);
            }
          });
        });
        if (arrivedFromEmbroidery <= 0) {
          embJobs.forEach(job => {
            const jItems = Array.isArray(job.items_json) ? job.items_json : [];
            jItems.forEach(ji => {
              if (Number(ji.product_id) === pId && (ji.color || '').trim() === color) {
                arrivedFromEmbroidery += Number(ji.received_quantity || ji.quantity_sent || 0);
              }
            });
          });
        }

        let totalArrived = arrivedFromCutting + arrivedFromEmbroidery;
        if (totalArrived <= 0 && gIt.current_stage_quantity > 0) {
          totalArrived = gIt.current_stage_quantity;
        }

        const itBatches = batches.filter(b => b.production_order_item_id === gIt.active_stitching_item_id || (b.color || '').trim() === color);
        const comp = itBatches.reduce((s, b) => s + Number(b.completed_quantity || 0), 0);
        const acc = itBatches.reduce((s, b) => s + Number(b.accepted_quantity || 0), 0);
        const rej = itBatches.reduce((s, b) => s + Number(b.rejected_quantity || 0), 0);
        const rwk = itBatches.reduce((s, b) => s + Number(b.rework_quantity || 0), 0);

        return {
          ...gIt,
          arrived_from_cutting: arrivedFromCutting,
          arrived_from_embroidery: arrivedFromEmbroidery,
          total_arrived: totalArrived,
          completed_quantity: comp,
          accepted_quantity: acc,
          rejected_quantity: rej,
          rework_quantity: rwk,
          available_to_stitch: Math.max(0, totalArrived - comp),
          assigned_quantity: Math.max(0, totalArrived - comp),
          pending_stitching: Math.max(0, totalArrived - comp),
          ready_to_transfer: Math.max(0, acc)
        };
      });

      return sendSuccess(res, {
        order: {
          ...ord,
          customer_name: cust?.name || ord.customer_name,
          customer_code: cust?.code || ord.customer_code,
          customer_avatar_style: cust?.avatar_style || 'lorelei',
          customer_avatar_seed: cust?.avatar_seed || `buyer-${ord.customer_id}`
        },
        items,
        batches: [...batches].reverse()
      });
    }

    if (pathname === '/production/stitching/batch' && method === 'POST') {
      const { production_order_id, production_order_item_id, assigned_quantity, completed_quantity, rejected_quantity, rework_quantity, remarks, photo_urls } = body;
      const pId = Number(production_order_id);
      const itemId = Number(production_order_item_id);
      const ord = (db.productionOrders || []).find(o => o.id === pId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      const item = (ord.items || []).find(i => i.id === itemId) || (ord.items || [])[0];
      if (!item) return sendError(res, 'Order item not found', 404);

      const comp = Number(completed_quantity || 0);
      const rej = Number(rejected_quantity || 0);
      const rwk = Number(rework_quantity || 0);
      const acc = Math.max(0, comp - rej - rwk);
      const assigned = Number(assigned_quantity || comp);

      if (comp <= 0) return sendError(res, 'Completed quantity must be greater than zero', 422);

      if (!photo_urls || !Array.isArray(photo_urls) || photo_urls.length === 0) {
        return sendError(res, 'Real-time camera photograph with live GPS coordinates of stitching line quality is mandatory.', 422);
      }

      if (!db.stitchingBatches) db.stitchingBatches = [];
      const batchNo = `STI-${ord.order_number}-${item.id}-${db.stitchingBatches.length + 1}`;

      const newBatch = {
        id: db.stitchingBatches.length + 1,
        production_order_id: pId,
        production_order_item_id: itemId,
        batch_number: batchNo,
        assigned_quantity: assigned,
        received_quantity: assigned,
        completed_quantity: comp,
        accepted_quantity: acc,
        rejected_quantity: rej,
        rework_quantity: rwk,
        balance_quantity: 0,
        operator_team: 'Stitching Department',
        production_line: 'Standard Line',
        start_date: body.start_date || new Date().toISOString().split('T')[0],
        completion_date: body.completion_date || new Date().toISOString().split('T')[0],
        supervisor: 'Supervisor / In-charge',
        remarks: remarks || '',
        photo_urls: photo_urls || [],
        status: 'Completed',
        product_name: item.product_name,
        product_code: item.product_code,
        color: item.color,
        size: item.size || 'M',
        created_at: new Date().toISOString()
      };

      db.stitchingBatches.push(newBatch);

      logLedger(pId, itemId, 7, 'STI', 'PROCESSED', comp, batchNo, '', '', 'Stitching Output', String(newBatch.id), remarks);
      if (acc > 0) {
        logLedger(pId, itemId, 7, 'STI', 'ACCEPTED', acc, batchNo, '', '', 'Stitching Passed', String(newBatch.id), 'Passed sewing audit');
      }

      saveDB();
      return sendSuccess(res, newBatch, 'Stitching batch logged successfully', 201);
    }

    if (pathname === '/production/stitching/transfer' && method === 'POST') {
      const { batch_id, production_order_id, item_id, transfer_quantity, remarks } = body;
      let qty = Number(transfer_quantity || 0);
      let pId = Number(production_order_id || 0);
      let itemId = Number(item_id || 0);

      const bId = Number(batch_id || 0);
      if (bId > 0) {
        const batch = (db.stitchingBatches || []).find(b => b.id === bId);
        if (batch) {
          pId = batch.production_order_id;
          itemId = batch.production_order_item_id;
          qty = Number(batch.accepted_quantity || 0);
        }
      }

      if (pId <= 0 || qty <= 0) {
        return sendError(res, 'Production order ID and positive transfer quantity are required', 422);
      }

      const ord = (db.productionOrders || []).find(o => o.id === pId);
      if (ord) {
        const item = (ord.items || []).find(i => i.id === itemId) || (ord.items || [])[0];
        if (item) {
          // Check if Checking item already exists
          let chkItem = (ord.items || []).find(i => i.product_id === item.product_id && (i.color || '').trim() === (item.color || '').trim() && (i.current_stage_id === 8 || (i.stage_code || '').toUpperCase() === 'CHK'));
          if (chkItem) {
            chkItem.current_stage_quantity = Number(chkItem.current_stage_quantity || 0) + qty;
            chkItem.total_quantity = Number(chkItem.total_quantity || 0) + qty;
          } else {
            const newItemId = Math.max(...(ord.items || []).map(i => i.id), 0) + 1;
            chkItem = {
              id: newItemId,
              production_order_id: pId,
              product_id: item.product_id,
              product_name: item.product_name,
              product_code: item.product_code,
              color: item.color,
              size: item.size || 'M',
              total_quantity: qty,
              current_stage_id: 8,
              current_stage_name: 'Checking',
              stage_code: 'CHK',
              current_stage_quantity: qty,
              completed_quantity: 0,
              rejected_quantity: 0,
              rework_quantity: 0,
              status: 'In Progress'
            };
            ord.items.push(chkItem);
          }
        }
      }

      logLedger(pId, itemId, 7, 'STI', 'TRANSFERRED', qty, '', null, null, 'Stage Transfer', '8', remarks || 'Transferred to Checking / QC');
      logLedger(pId, itemId, 8, 'CHK', 'TRANSFER_IN', qty, '', null, null, 'Stage Transfer', '8', 'Received from Stitching');
      saveDB();
      return sendSuccess(res, { transferred_quantity: qty, destination_stage_id: 8, destination_stage_name: 'Checking' }, `Transferred ${qty} pcs to Checking`);
    }

    // 6. Stage 8: Checking / Quality Inspections
    if (pathname === '/production/checking/orders' && method === 'GET') {
      const orders = (db.productionOrders || []).map(ord => {
        const chkItems = (ord.items || []).filter(i => (i.stage_code || '').toUpperCase() === 'CHK' || i.current_stage_id === 8);
        const inspections = (db.qualityInspections || []).filter(qi => qi.production_order_id === ord.id);
        const totalPassed = inspections.reduce((s, qi) => s + Number(qi.passed_quantity || 0), 0);
        const totalFailed = inspections.reduce((s, qi) => s + Number(qi.failed_quantity || 0), 0);
        const totalRework = inspections.reduce((s, qi) => s + Number(qi.rework_quantity || 0), 0);
        return {
          ...ord,
          checking_items: chkItems,
          inspections_count: inspections.length,
          total_passed_quantity: totalPassed,
          total_failed_quantity: totalFailed,
          total_rework_quantity: totalRework,
          checking_status: totalPassed >= ord.total_quantity ? 'Completed' : (inspections.length > 0 ? 'In Progress' : 'Pending Inspection')
        };
      });
      return sendSuccess(res, orders);
    }

    const chkDetailMatch = pathname.match(/^\/production\/checking\/(\d+)$/);
    if (chkDetailMatch && method === 'GET') {
      const oId = Number(chkDetailMatch[1]);
      const ord = (db.productionOrders || []).find(o => o.id === oId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      const cust = (db.customers || []).find(c => c.id === Number(ord.customer_id));
      const inspections = (db.qualityInspections || []).filter(qi => qi.production_order_id === oId);
      const stitchingBatches = (db.stitchingBatches || []).filter(sb => sb.production_order_id === oId);

      // Group base items by product_id and color
      const grouped = {};
      (ord.items || []).forEach(it => {
        const bp = (db.buyer_products || []).find(p => p.id === Number(it.product_id));
        const key = `${it.product_id}_${(it.color || '').trim()}`;
        if (!grouped[key]) {
          grouped[key] = {
            ...it,
            product_name: bp?.product_name || it.product_name || 'Garment Product',
            product_code: bp?.product_code || it.product_code || 'PRD',
            order_quantity: Number(it.total_quantity || 0),
            active_checking_item_id: it.id,
            current_stage_quantity: Number(it.current_stage_id) === 8 ? Number(it.current_stage_quantity || 0) : 0
          };
        } else {
          grouped[key].order_quantity += Number(it.total_quantity || 0);
          if (Number(it.current_stage_id) === 8) {
            grouped[key].current_stage_quantity += Number(it.current_stage_quantity || 0);
            grouped[key].active_checking_item_id = it.id;
          }
        }
      });

      const items = Object.values(grouped).map(gIt => {
        const pId = Number(gIt.product_id);
        const color = (gIt.color || '').trim();

        // 1. Arrived from Stitching
        let fromStitching = 0;
        stitchingBatches.forEach(sb => {
          if ((sb.color || '').trim() === color || sb.production_order_item_id === gIt.active_checking_item_id) {
            fromStitching += Number(sb.accepted_quantity || 0);
          }
        });
        if (gIt.current_stage_quantity > 0) {
          fromStitching = Math.max(fromStitching, gIt.current_stage_quantity);
        }

        const itInspections = inspections.filter(qi => qi.production_order_item_id === gIt.active_checking_item_id || (qi.color || '').trim() === color);
        const checked = itInspections.reduce((s, qi) => s + Number(qi.checked_quantity || qi.submitted_quantity || 0), 0);
        const passed = itInspections.reduce((s, qi) => s + Number(qi.passed_quantity || 0), 0);
        const failed = itInspections.reduce((s, qi) => s + Number(qi.failed_quantity || 0), 0);
        const rwk = itInspections.reduce((s, qi) => s + Number(qi.rework_quantity || 0), 0);
        const rej = itInspections.reduce((s, qi) => s + Number(qi.rejected_quantity || 0), 0);

        return {
          ...gIt,
          arrived_from_stitching: fromStitching,
          total_arrived: fromStitching,
          checked_quantity: checked,
          passed_quantity: passed,
          failed_quantity: failed,
          rework_quantity: rwk,
          rejected_quantity: rej,
          available_to_inspect: Math.max(0, fromStitching - checked),
          pending_inspection: Math.max(0, fromStitching - checked),
          ready_to_pack: Math.max(0, passed),
          pass_rate: checked > 0 ? Number(((passed / checked) * 100).toFixed(1)) : 100.0
        };
      });

      return sendSuccess(res, {
        order: {
          ...ord,
          customer_name: cust?.name || ord.customer_name,
          customer_code: cust?.code || ord.customer_code,
          customer_avatar_style: cust?.avatar_style || 'lorelei',
          customer_avatar_seed: cust?.avatar_seed || `buyer-${ord.customer_id}`
        },
        items,
        inspections: [...inspections].reverse()
      });
    }

    if (pathname === '/production/checking/inspect' && method === 'POST') {
      const { production_order_id, production_order_item_id, submitted_quantity, checked_quantity, passed_quantity, failed_quantity, rework_quantity, rejected_quantity, defect_category, defect_description, inspector, remarks, photo_urls, is_reinspection, original_inspection_id } = body;
      const pId = Number(production_order_id);
      const itemId = Number(production_order_item_id);
      const chk = Number(checked_quantity || submitted_quantity || 0);
      const rej = Number(rejected_quantity || 0);
      const rwk = Number(rework_quantity || 0);
      const passed = Number(passed_quantity ?? Math.max(0, chk - rej - rwk));
      const failed = Number(failed_quantity || (rej + rwk));

      if (chk <= 0) return sendError(res, 'Checked quantity must be greater than zero', 422);

      if (!photo_urls || !Array.isArray(photo_urls) || photo_urls.length === 0) {
        return sendError(res, 'Real-time camera photograph with live GPS coordinates of inspected pieces / defect audit is mandatory.', 422);
      }

      const ord = (db.productionOrders || []).find(o => o.id === pId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      const item = (ord.items || []).find(i => i.id === itemId) || (ord.items || [])[0];
      if (!item) return sendError(res, 'Order item not found', 404);

      if (!db.qualityInspections) db.qualityInspections = [];
      const batchNo = `CHK-${ord.order_number}-${item.id}-${db.qualityInspections.length + 1}`;
      const newQi = {
        id: db.qualityInspections.length + 1,
        production_order_id: pId,
        production_order_item_id: itemId,
        batch_number: batchNo,
        submitted_quantity: chk,
        checked_quantity: chk,
        passed_quantity: passed,
        failed_quantity: failed,
        rework_quantity: rwk,
        rejected_quantity: rej,
        defect_category: defect_category || 'Measurement & Finishing',
        defect_description: defect_description || '',
        inspector: inspector || 'Lead QC Inspector',
        inspection_date: body.inspection_date || new Date().toISOString().split('T')[0],
        is_reinspection: Boolean(is_reinspection),
        original_inspection_id: original_inspection_id ? Number(original_inspection_id) : null,
        remarks: remarks || '',
        photo_urls: photo_urls || [],
        product_name: item.product_name,
        product_code: item.product_code,
        color: item.color,
        size: item.size || 'M',
        created_at: new Date().toISOString()
      };

      db.qualityInspections.push(newQi);

      // Ledger
      logLedger(pId, itemId, 8, 'CHK', 'INSPECTED', chk, batchNo, inspector, null, 'Quality Inspection', String(newQi.id), remarks);
      if (passed > 0) logLedger(pId, itemId, 8, 'CHK', 'PASSED', passed, batchNo, inspector, null, 'Quality Passed', String(newQi.id), 'Passed quality audit');
      if (rwk > 0) logLedger(pId, itemId, 8, 'CHK', 'REWORK', rwk, batchNo, inspector, null, 'Quality Audit Rework', String(newQi.id), defect_description || 'Rerouted to Rework');
      if (rej > 0) logLedger(pId, itemId, 8, 'CHK', 'REJECTED', rej, batchNo, inspector, null, 'Quality Audit Rejection', String(newQi.id), defect_description || 'Rejected lot');

      saveDB();
      return sendSuccess(res, newQi, 'Inspection recorded successfully', 201);
    }

    if (pathname === '/production/checking/transfer' && method === 'POST') {
      const { production_order_id, item_id, transfer_quantity, remarks } = body;
      const pId = Number(production_order_id || 0);
      const itemId = Number(item_id || 0);
      const qty = Number(transfer_quantity || 0);

      if (pId <= 0 || qty <= 0) {
        return sendError(res, 'Production order ID and positive transfer quantity are required', 422);
      }

      const ord = (db.productionOrders || []).find(o => o.id === pId);
      if (ord) {
        const item = (ord.items || []).find(i => i.id === itemId) || (ord.items || [])[0];
        if (item) {
          let pckItem = (ord.items || []).find(i => i.product_id === item.product_id && (i.color || '').trim() === (item.color || '').trim() && (i.current_stage_id === 9 || (i.stage_code || '').toUpperCase() === 'PCK'));
          if (pckItem) {
            pckItem.current_stage_quantity = Number(pckItem.current_stage_quantity || 0) + qty;
            pckItem.total_quantity = Number(pckItem.total_quantity || 0) + qty;
          } else {
            const newItemId = Math.max(...(ord.items || []).map(i => i.id), 0) + 1;
            pckItem = {
              id: newItemId,
              production_order_id: pId,
              product_id: item.product_id,
              product_name: item.product_name,
              product_code: item.product_code,
              color: item.color,
              size: item.size || 'M',
              total_quantity: qty,
              current_stage_id: 9,
              current_stage_name: 'Packing',
              stage_code: 'PCK',
              current_stage_quantity: qty,
              completed_quantity: 0,
              rejected_quantity: 0,
              rework_quantity: 0,
              status: 'In Progress'
            };
            ord.items.push(pckItem);
          }
        }
      }

      logLedger(pId, itemId, 8, 'CHK', 'TRANSFERRED', qty, '', null, null, 'Stage Transfer', '9', remarks || 'Transferred to Stage 09: Packing');
      logLedger(pId, itemId, 9, 'PCK', 'TRANSFER_IN', qty, '', null, null, 'Stage Transfer', '9', 'Received from Checking');
      saveDB();
      return sendSuccess(res, { transferred_quantity: qty, destination_stage_id: 9, destination_stage_name: 'Packing' }, `Transferred ${qty} pcs to Packing`);
    }

    // 7. Stage 9: Packing & Carton Management
    if (pathname === '/production/packing/orders' && method === 'GET') {
      const orders = (db.productionOrders || []).map(ord => {
        const pckItems = (ord.items || []).filter(i => (i.stage_code || '').toUpperCase() === 'PCK' || i.current_stage_id === 9);
        const batches = (db.packingBatches || []).filter(pb => pb.production_order_id === ord.id);
        const totalPacked = batches.reduce((s, pb) => s + Number(pb.packed_quantity || 0), 0);
        const totalBoxes = batches.reduce((s, pb) => s + Number(pb.number_of_boxes || 0), 0);
        const totalCartons = batches.reduce((s, pb) => s + Number(pb.number_of_master_cartons || 0), 0);
        return {
          ...ord,
          packing_items: pckItems,
          batches_count: batches.length,
          total_packed_quantity: totalPacked,
          total_boxes: totalBoxes,
          total_master_cartons: totalCartons,
          packing_status: totalPacked >= ord.total_quantity ? 'Packed & Ready for Dispatch' : (batches.length > 0 ? 'Packing in Progress' : 'Awaiting Packing')
        };
      });
      return sendSuccess(res, orders);
    }

    const pckDetailMatch = pathname.match(/^\/production\/packing\/(\d+)$/);
    if (pckDetailMatch && method === 'GET') {
      const oId = Number(pckDetailMatch[1]);
      const ord = (db.productionOrders || []).find(o => o.id === oId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      const cust = (db.customers || []).find(c => c.id === Number(ord.customer_id));
      const batches = (db.packingBatches || []).filter(b => b.production_order_id === oId);
      const cartons = (db.packingCartons || []).filter(c => c.production_order_id === oId);

      const items = (ord.items || []).map(it => {
        const bp = (db.buyer_products || []).find(p => p.id === Number(it.product_id));
        const itBatches = batches.filter(b => b.production_order_item_id === it.id);
        const packed = itBatches.reduce((s, b) => s + Number(b.packed_quantity || 0), 0);
        const boxes = itBatches.reduce((s, b) => s + Number(b.number_of_boxes || 0), 0);
        const masterCartons = itBatches.reduce((s, b) => s + Number(b.number_of_master_cartons || 0), 0);

        // Quality inspection passed qty
        const inspections = (db.qualityInspections || []).filter(qi => qi.production_order_item_id === it.id);
        const approvedForPacking = inspections.reduce((s, qi) => s + Number(qi.passed_quantity || 0), 0) || Number(it.total_quantity || 0);

        // Packaging specs from buyer product
        const defaultBox = (bp?.boxes && bp.boxes.length > 0) ? bp.boxes[0] : {
          box_name: 'Standard Master Carton',
          box_code: 'BOX-M',
          items_per_box: 20,
          length: 60,
          width: 40,
          height: 40,
          dimension_unit: 'cm'
        };

        return {
          ...it,
          product_name: bp?.product_name || it.product_name,
          product_code: bp?.product_code || it.product_code,
          dimensions: bp?.dimensions || null,
          box_configuration: bp?.boxes || [defaultBox],
          approved_quantity: approvedForPacking,
          packed_quantity: packed,
          unpacked_quantity: Math.max(0, approvedForPacking - packed),
          total_boxes: boxes,
          total_master_cartons: masterCartons,
          batches: itBatches
        };
      });

      return sendSuccess(res, {
        order: {
          ...ord,
          customer_name: cust?.name || ord.customer_name,
          customer_code: cust?.code || ord.customer_code,
          customer_avatar_style: cust?.avatar_style || 'lorelei',
          customer_avatar_seed: cust?.avatar_seed || `buyer-${ord.customer_id}`
        },
        items,
        batches: batches.reverse(),
        cartons: cartons.reverse()
      });
    }

    if (pathname === '/production/packing/batch' && method === 'POST') {
      const { production_order_id, production_order_item_id, approved_quantity, packed_quantity, units_per_box, boxes_per_master_carton, box_name, packing_operator, packing_supervisor, remarks, photo_urls } = body;
      const pId = Number(production_order_id);
      const itemId = Number(production_order_item_id);
      const packed = Number(packed_quantity || 0);
      const unitsBox = Number(units_per_box || 20);
      const boxesMaster = Number(boxes_per_master_carton || 1);

      if (packed <= 0) return sendError(res, 'Packed quantity must be greater than zero', 422);

      if (!photo_urls || !Array.isArray(photo_urls) || photo_urls.length === 0) {
        return sendError(res, 'Real-time camera photograph with live GPS coordinates of packed master cartons is mandatory.', 422);
      }

      const ord = (db.productionOrders || []).find(o => o.id === pId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      const item = (ord.items || []).find(i => i.id === itemId);
      if (!item) return sendError(res, 'Order item not found', 404);

      if (!db.packingBatches) db.packingBatches = [];
      if (!db.packingCartons) db.packingCartons = [];

      // Calculate required boxes and master cartons
      const totalBoxes = Math.ceil(packed / unitsBox);
      const fullBoxes = Math.floor(packed / unitsBox);
      const partialBoxQty = packed % unitsBox;
      const totalMasterCartons = Math.ceil(totalBoxes / boxesMaster);
      const partialCartonBoxes = totalBoxes % boxesMaster;

      const batchNo = `PCK-${ord.order_number}-${item.id}-${db.packingBatches.length + 1}`;
      const serials = [];

      // Generate individual carton records
      for (let b = 1; b <= totalBoxes; b++) {
        const isLastBox = b === totalBoxes;
        const boxItems = (isLastBox && partialBoxQty > 0) ? partialBoxQty : unitsBox;
        const serial = `CTN-${ord.order_number}-${item.id}-${db.packingCartons.length + 1}`;
        serials.push(serial);

        const newCarton = {
          id: db.packingCartons.length + 1,
          carton_serial_number: serial,
          packing_batch_id: db.packingBatches.length + 1,
          production_order_id: pId,
          production_order_item_id: itemId,
          product_name: item.product_name,
          product_code: item.product_code,
          color: item.color,
          size: item.size || 'M',
          box_name: box_name || 'Export Master Carton',
          items_count: boxItems,
          is_full: boxItems === unitsBox,
          gross_weight: Number((boxItems * 0.45).toFixed(2)),
          status: 'Packed',
          created_at: new Date().toISOString()
        };
        db.packingCartons.push(newCarton);
      }

      const newBatch = {
        id: db.packingBatches.length + 1,
        production_order_id: pId,
        production_order_item_id: itemId,
        batch_number: batchNo,
        packing_date: body.packing_date || new Date().toISOString().split('T')[0],
        approved_quantity: Number(approved_quantity || packed),
        packed_quantity: packed,
        remaining_unpacked_quantity: Math.max(0, Number(approved_quantity || packed) - packed),
        units_per_box: unitsBox,
        number_of_boxes: totalBoxes,
        boxes_per_master_carton: boxesMaster,
        number_of_master_cartons: totalMasterCartons,
        partial_box_quantity: partialBoxQty,
        partial_carton_quantity: partialCartonBoxes,
        carton_serial_numbers: serials.join(', '),
        gross_weight: Number((packed * 0.45).toFixed(2)),
        net_weight: Number((packed * 0.38).toFixed(2)),
        packing_operator: packing_operator || 'Packing Line 1',
        packing_supervisor: packing_supervisor || 'Packaging Manager',
        remarks: remarks || '',
        photo_urls: photo_urls || [],
        product_name: item.product_name,
        product_code: item.product_code,
        color: item.color,
        size: item.size || 'M',
        created_at: new Date().toISOString()
      };

      db.packingBatches.push(newBatch);

      logLedger(pId, itemId, 9, 'PCK', 'PACKED', packed, batchNo, packing_operator, packing_supervisor, 'Carton Packing', serials[0], `Packed into ${totalBoxes} boxes / ${totalMasterCartons} master cartons`);

      // Update item stage to Stage 10 (COMP / Dispatch)
      item.current_stage_id = 10;
      item.current_stage_name = 'Completed / Dispatch';
      item.stage_code = 'COMP';
      item.current_stage_quantity = packed;
      ord.status = 'Packed / Awaiting Dispatch';

      saveDB();
      return sendSuccess(res, { batch: newBatch, generated_cartons_count: serials.length, carton_serials: serials }, 'Packing batch and cartons generated successfully', 201);
    }

    if (pathname === '/production/packing/cartons' && method === 'GET') {
      const pId = parsedUrl.searchParams.get('production_order_id');
      let cartons = [...(db.packingCartons || [])];
      if (pId) cartons = cartons.filter(c => String(c.production_order_id) === String(pId));
      return sendSuccess(res, cartons.reverse());
    }

    const ctnSerialMatch = pathname.match(/^\/production\/packing\/carton\/(.+)$/);
    if (ctnSerialMatch && method === 'GET') {
      const serial = decodeURIComponent(ctnSerialMatch[1]);
      const carton = (db.packingCartons || []).find(c => c.carton_serial_number === serial);
      if (!carton) return sendError(res, 'Carton not found', 404);
      return sendSuccess(res, carton);
    }

    // 8. Stage 10: Final Completion & Dispatch Evidence
    if (pathname === '/production/dispatch/orders' && method === 'GET') {
      const orders = (db.productionOrders || []).map(ord => {
        const dispatches = (db.dispatchRecords || []).filter(dr => dr.production_order_id === ord.id);
        const totalDispatched = dispatches.reduce((s, dr) => s + Number(dr.total_dispatched_quantity || 0), 0);
        const cartons = (db.packingCartons || []).filter(c => c.production_order_id === ord.id);
        const packedCartons = cartons.filter(c => c.status === 'Packed');
        const dispatchedCartons = cartons.filter(c => c.status === 'Dispatched');

        return {
          ...ord,
          dispatches_count: dispatches.length,
          total_dispatched_quantity: totalDispatched,
          total_cartons: cartons.length,
          dispatched_cartons_count: dispatchedCartons.length,
          pending_cartons_count: packedCartons.length,
          dispatch_status: totalDispatched >= ord.total_quantity ? 'Fully Dispatched' : (totalDispatched > 0 ? 'Partially Dispatched' : (cartons.length > 0 ? 'Packed / Awaiting Dispatch' : 'In Production'))
        };
      });
      return sendSuccess(res, orders);
    }

    const dspDetailMatch = pathname.match(/^\/production\/dispatch\/(\d+)$/);
    if (dspDetailMatch && method === 'GET') {
      const oId = Number(dspDetailMatch[1]);
      const ord = (db.productionOrders || []).find(o => o.id === oId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      const cust = (db.customers || []).find(c => c.id === Number(ord.customer_id));
      const dispatches = (db.dispatchRecords || []).filter(dr => dr.production_order_id === oId);
      const cartons = (db.packingCartons || []).filter(c => c.production_order_id === oId);

      const items = (ord.items || []).map(it => {
        const bp = (db.buyer_products || []).find(p => p.id === Number(it.product_id));
        const pBatches = (db.packingBatches || []).filter(pb => pb.production_order_item_id === it.id);
        const packed = pBatches.reduce((s, pb) => s + Number(pb.packed_quantity || 0), 0);
        let dispatched = 0;
        dispatches.forEach(dr => {
          (dr.items_breakdown || []).forEach(ib => {
            if (ib.production_order_item_id === it.id) {
              dispatched += Number(ib.dispatched_quantity || 0);
            }
          });
        });

        return {
          ...it,
          product_name: bp?.product_name || it.product_name,
          product_code: bp?.product_code || it.product_code,
          order_quantity: it.total_quantity,
          packed_quantity: packed,
          dispatched_quantity: dispatched,
          pending_dispatch: Math.max(0, packed - dispatched)
        };
      });

      return sendSuccess(res, {
        order: {
          ...ord,
          customer_name: cust?.name || ord.customer_name,
          customer_code: cust?.code || ord.customer_code,
          customer_avatar_style: cust?.avatar_style || 'lorelei',
          customer_avatar_seed: cust?.avatar_seed || `buyer-${ord.customer_id}`
        },
        items,
        dispatches: dispatches.reverse(),
        available_cartons: cartons.filter(c => c.status === 'Packed'),
        dispatched_cartons: cartons.filter(c => c.status === 'Dispatched')
      });
    }

    if (pathname === '/production/dispatch/record' && method === 'POST') {
      const { production_order_id, vehicle_number, driver_name, driver_contact, transporter_name, delivery_challan_number, invoice_reference, destination_notes, remarks, truck_photo_urls, loaded_cartons_photo_urls, labels_photo_urls, document_urls, carton_serial_numbers, carton_ids, items_breakdown, total_dispatched_quantity } = body;
      const pId = Number(production_order_id);
      const ord = (db.productionOrders || []).find(o => o.id === pId);
      if (!ord) return sendError(res, 'Production order not found', 404);

      if (!vehicle_number) return sendError(res, 'Vehicle / truck registration number is required', 422);

      if (!truck_photo_urls || !Array.isArray(truck_photo_urls) || truck_photo_urls.length === 0) {
        return sendError(res, 'Real-time camera photograph of transport vehicle & registration number plate with live GPS coordinates is mandatory.', 422);
      }

      if (!loaded_cartons_photo_urls || !Array.isArray(loaded_cartons_photo_urls) || loaded_cartons_photo_urls.length === 0) {
        return sendError(res, 'Real-time camera photograph of loaded cartons & container security seal with live GPS coordinates is mandatory.', 422);
      }

      // Check for Duplicate Delivery Challan
      if (delivery_challan_number && (db.dispatchRecords || []).some(d => d.production_order_id === pId && (d.delivery_challan_number || '').trim().toLowerCase() === delivery_challan_number.trim().toLowerCase())) {
        return sendError(res, `Duplicate Dispatch Error: Delivery Challan '${delivery_challan_number}' has already been recorded for this order. Duplicate dispatch is not allowed.`, 422);
      }

      // Check for Duplicate Invoice Reference
      if (invoice_reference && (db.dispatchRecords || []).some(d => d.production_order_id === pId && (d.invoice_reference || '').trim().toLowerCase() === invoice_reference.trim().toLowerCase())) {
        return sendError(res, `Duplicate Dispatch Error: Invoice Reference '${invoice_reference}' has already been recorded for this order. Duplicate dispatch is not allowed.`, 422);
      }

      // Check if all cartons already dispatched
      const orderCartons = (db.packingCartons || []).filter(c => c.production_order_id === pId);
      const remainingCartons = orderCartons.filter(c => c.status !== 'Dispatched');
      if (orderCartons.length > 0 && remainingCartons.length === 0) {
        return sendError(res, `All master cartons (${orderCartons.length} cartons) for this order have already been dispatched. No pending cartons remain in the dispatch bay.`, 422);
      }

      let serials = Array.isArray(carton_serial_numbers) ? [...carton_serial_numbers] : [];
      const cIds = Array.isArray(carton_ids) ? carton_ids.map(Number) : [];
      if (cIds.length > 0) {
        const matchedCartons = (db.packingCartons || []).filter(c => cIds.includes(Number(c.id)));
        matchedCartons.forEach(c => {
          if (!serials.includes(c.carton_serial_number)) serials.push(c.carton_serial_number);
        });
      }

      // Check if any selected carton was already dispatched
      for (const s of serials) {
        const ctn = (db.packingCartons || []).find(c => c.carton_serial_number === s);
        if (ctn && ctn.status === 'Dispatched') {
          return sendError(res, `Carton '${s}' has already been dispatched. Duplicate dispatch is not allowed.`, 422);
        }
      }

      const items = items_breakdown || [];
      let totalDispatched = Number(total_dispatched_quantity || 0);

      if (totalDispatched <= 0) {
        items.forEach(it => {
          totalDispatched += Number(it.dispatched_quantity || 0);
        });
      }

      if (totalDispatched <= 0 && serials.length > 0) {
        serials.forEach(s => {
          const ctn = (db.packingCartons || []).find(c => c.carton_serial_number === s);
          if (ctn) totalDispatched += Number(ctn.items_count || 0);
        });
      }

      if (totalDispatched <= 0) return sendError(res, 'Dispatched quantity must be greater than zero', 422);

      if (!db.dispatchRecords) db.dispatchRecords = [];
      const dspNo = `DSP-2026-${1000 + db.dispatchRecords.length + 1}`;

      // Mark cartons as Dispatched
      serials.forEach(s => {
        const ctn = (db.packingCartons || []).find(c => c.carton_serial_number === s);
        if (ctn) {
          ctn.status = 'Dispatched';
          ctn.dispatch_id = db.dispatchRecords.length + 1;
        }
      });

      const newDispatch = {
        id: db.dispatchRecords.length + 1,
        dispatch_number: dspNo,
        production_order_id: pId,
        production_order_number: ord.order_number,
        buyer_id: ord.customer_id,
        buyer_name: ord.customer_name || 'Buyer',
        dispatch_date: body.dispatch_date || new Date().toISOString().split('T')[0],
        dispatch_time: body.dispatch_time || new Date().toTimeString().split(' ')[0],
        total_dispatched_quantity: totalDispatched,
        total_boxes: serials.length,
        total_master_cartons: Math.ceil(serials.length / 5) || 1,
        vehicle_number: vehicle_number.toUpperCase(),
        driver_name: driver_name || 'Transport Driver',
        driver_contact: driver_contact || '+91 98422 55441',
        transporter_name: transporter_name || 'VRL Logistics Logistics Express',
        delivery_challan_number: delivery_challan_number || `DC-DSP-${Math.floor(1000 + Math.random() * 9000)}`,
        invoice_reference: invoice_reference || `INV-${ord.order_number}`,
        destination_notes: destination_notes || 'Buyer Central Distribution Hub',
        remarks: remarks || '',
        truck_photo_urls: truck_photo_urls || [],
        loaded_cartons_photo_urls: loaded_cartons_photo_urls || [],
        labels_photo_urls: labels_photo_urls || [],
        document_urls: document_urls || [],
        carton_serial_numbers: serials,
        items_breakdown: items,
        status: 'Dispatched',
        created_at: new Date().toISOString()
      };

      db.dispatchRecords.push(newDispatch);

      // Ledger
      items.forEach(it => {
        logLedger(pId, it.production_order_item_id, 10, 'COMP', 'DISPATCHED', it.dispatched_quantity, dspNo, driver_name, null, 'Vehicle Dispatch', vehicle_number, `Loaded into truck ${vehicle_number}`);
      });

      // Update parent order status
      const allDispatches = (db.dispatchRecords || []).filter(dr => dr.production_order_id === pId);
      const grandTotalDispatched = allDispatches.reduce((s, dr) => s + Number(dr.total_dispatched_quantity || 0), 0);
      ord.completed_quantity = grandTotalDispatched;

      if (grandTotalDispatched >= Number(ord.total_quantity)) {
        ord.status = 'COMPLETED';
      } else {
        ord.status = 'Partially Dispatched';
      }

      saveDB();
      return sendSuccess(res, newDispatch, 'Dispatch recorded and evidence stored successfully', 201);
    }

    if (pathname === '/production/dispatch/history' && method === 'GET') {
      const pId = parsedUrl.searchParams.get('production_order_id');
      let dispatches = [...(db.dispatchRecords || [])];
      if (pId) dispatches = dispatches.filter(d => String(d.production_order_id) === String(pId));
      return sendSuccess(res, dispatches.reverse());
    }

    // 9. Detailed Production Reports
    if (pathname === '/reports/production/detailed' && method === 'GET') {
      const type = parsedUrl.searchParams.get('type') || 'progress';
      const buyerId = parsedUrl.searchParams.get('buyer_id');
      const orderId = parsedUrl.searchParams.get('order_id');

      let orders = [...(db.productionOrders || [])];
      if (buyerId) orders = orders.filter(o => String(o.customer_id) === String(buyerId));
      if (orderId) orders = orders.filter(o => String(o.id) === String(orderId));

      const reportData = orders.map(ord => {
        const cBatches = (db.cuttingBatches || []).filter(b => b.production_order_id === ord.id);
        const sBatches = (db.stitchingBatches || []).filter(b => b.production_order_id === ord.id);
        const qInspections = (db.qualityInspections || []).filter(b => b.production_order_id === ord.id);
        const pBatches = (db.packingBatches || []).filter(b => b.production_order_id === ord.id);
        const dispatches = (db.dispatchRecords || []).filter(b => b.production_order_id === ord.id);

        const totalCut = cBatches.reduce((s, b) => s + Number(b.actual_cut_quantity || 0), 0);
        const totalStitched = sBatches.reduce((s, b) => s + Number(b.completed_quantity || 0), 0);
        const totalPassed = qInspections.reduce((s, b) => s + Number(b.passed_quantity || 0), 0);
        const totalPacked = pBatches.reduce((s, b) => s + Number(b.packed_quantity || 0), 0);
        const totalDispatched = dispatches.reduce((s, b) => s + Number(b.total_dispatched_quantity || 0), 0);

        return {
          order_id: ord.id,
          order_number: ord.order_number,
          title: ord.title,
          buyer_name: ord.customer_name,
          target_delivery_date: ord.target_delivery_date,
          total_quantity: ord.total_quantity,
          cut_quantity: totalCut,
          stitched_quantity: totalStitched,
          checked_passed_quantity: totalPassed,
          packed_quantity: totalPacked,
          dispatched_quantity: totalDispatched,
          pending_quantity: Math.max(0, Number(ord.total_quantity || 0) - totalDispatched),
          status: ord.status,
          completion_percent: ord.total_quantity > 0 ? Math.min(100, Math.round((totalDispatched / ord.total_quantity) * 100)) : 0
        };
      });

      return sendSuccess(res, {
        report_type: type,
        generated_at: new Date().toISOString(),
        total_orders_analyzed: reportData.length,
        summary: {
          total_order_qty: reportData.reduce((s, r) => s + r.total_quantity, 0),
          total_dispatched_qty: reportData.reduce((s, r) => s + r.dispatched_quantity, 0),
          total_pending_qty: reportData.reduce((s, r) => s + r.pending_quantity, 0)
        },
        items: reportData
      });
    }

    // 10. Masters (Pantone Colors, Colors, Sizes, Units, Designs)
    if (!db.pantone_colors) db.pantone_colors = [];
    if (pathname === '/pantone-colors' && method === 'GET') {
      const code = (parsedUrl.searchParams.get('code') || '').trim();
      const search = (parsedUrl.searchParams.get('search') || '').trim();
      const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '25', 10);
      const isAll = parsedUrl.searchParams.get('all') === '1' || limit >= 3000;

      if (code && !parsedUrl.searchParams.get('page')) {
        const found = db.pantone_colors.find(p => p.pantone_code.toLowerCase() === code.toLowerCase() || p.pantone_name.toLowerCase() === code.toLowerCase());
        if (found) {
          return sendSuccess(res, { found: true, ...found });
        }
        return sendSuccess(res, { found: false, message: 'Not found' });
      }

      let filtered = [...db.pantone_colors];
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(p =>
          (p.pantone_code || '').toLowerCase().includes(s) ||
          (p.pantone_name || '').toLowerCase().includes(s) ||
          (p.hex_code || '').toLowerCase().includes(s)
        );
      }

      if (isAll) {
        return sendSuccess(res, { items: filtered, total: filtered.length, page: 1, limit: filtered.length, total_pages: 1 });
      }

      const offset = (page - 1) * limit;
      const items = filtered.slice(offset, offset + limit);
      return sendSuccess(res, {
        items,
        total: filtered.length,
        page,
        limit,
        total_pages: Math.ceil(filtered.length / limit) || 1,
      });
    }
    if (pathname === '/pantone-colors' && method === 'POST') {
      const newColor = {
        id: db.pantone_colors.length + 1,
        pantone_code: body.pantone_code || '',
        pantone_name: body.pantone_name || body.name || '',
        hex_code: body.hex_code || '#000000',
        red: body.red || 0,
        green: body.green || 0,
        blue: body.blue || 0,
        color_system: body.color_system || 'PMS Coated',
        created_at: new Date().toISOString()
      };
      db.pantone_colors.push(newColor);
      saveDB();
      return sendSuccess(res, newColor, 'Pantone color created', 201);
    }
    if (pathname.startsWith('/pantone-colors/') && method === 'PUT') {
      const id = Number(pathname.split('/')[2]);
      const idx = db.pantone_colors.findIndex(p => p.id === id);
      if (idx === -1) return sendError(res, 'Pantone color not found', 404);
      Object.assign(db.pantone_colors[idx], body);
      saveDB();
      return sendSuccess(res, db.pantone_colors[idx], 'Pantone color updated');
    }
    if (pathname.startsWith('/pantone-colors/') && method === 'DELETE') {
      const id = Number(pathname.split('/')[2]);
      db.pantone_colors = db.pantone_colors.filter(p => p.id !== id);
      saveDB();
      return sendSuccess(res, null, 'Pantone color deleted');
    }
    if (pathname === '/colors' && method === 'GET') return sendSuccess(res, db.colors);
    if (pathname === '/colors' && method === 'POST') {
      const name = (body.name || '').trim();
      if (!name) return sendError(res, 'Color name is required', 422);
      let code = (body.code || '').trim();
      if (!code) {
        code = `CLR-${String(db.colors.length + 1).padStart(4, '0')}`;
      } else if (db.colors.some(c => c.code === code)) {
        return sendError(res, `Color code '${code}' already exists`, 422);
      }
      const col = {
        id: db.colors.length + 1,
        code,
        name,
        hex_code: body.hex_code || '#000000',
        pantone_code: body.pantone_code || null,
      };
      db.colors.push(col);
      saveDB();
      return sendSuccess(res, col, 'Color added', 201);
    }
    if (pathname.startsWith('/colors/') && method === 'PUT') {
      const id = Number(pathname.split('/')[2]);
      const idx = db.colors.findIndex(c => c.id === id);
      if (idx === -1) return sendError(res, 'Color not found', 404);
      db.colors[idx] = {
        ...db.colors[idx],
        name: (body.name || db.colors[idx].name).trim(),
        hex_code: body.hex_code || db.colors[idx].hex_code,
        pantone_code: body.pantone_code !== undefined ? body.pantone_code : db.colors[idx].pantone_code,
      };
      saveDB();
      return sendSuccess(res, db.colors[idx], 'Color updated');
    }
    if (pathname.startsWith('/colors/') && method === 'DELETE') {
      const id = Number(pathname.split('/')[2]);
      db.colors = db.colors.filter(c => c.id !== id);
      saveDB();
      return sendSuccess(res, null, 'Color deleted');
    }

    if (pathname === '/sizes' && method === 'GET') return sendSuccess(res, db.sizes);
    if (pathname === '/sizes' && method === 'POST') {
      const sz = { id: db.sizes.length + 1, ...body };
      db.sizes.push(sz);
      saveDB();
      return sendSuccess(res, sz, 'Size added', 201);
    }

    if (pathname === '/units' && method === 'GET') return sendSuccess(res, db.units);
    if (pathname === '/units' && method === 'POST') {
      const u = { id: db.units.length + 1, ...body };
      db.units.push(u);
      saveDB();
      return sendSuccess(res, u, 'Unit added', 201);
    }

    if (pathname === '/designs' && method === 'GET') return sendSuccess(res, db.designs);
    if (pathname === '/designs' && method === 'POST') {
      const dsn = { id: db.designs.length + 1, ...body };
      db.designs.push(dsn);
      saveDB();
      return sendSuccess(res, dsn, 'Design added', 201);
    }

    // 11. Templates
    if (pathname === '/templates' && method === 'GET') {
      const type = parsedUrl.searchParams.get('type');
      const list = type ? db.templates.filter(t => t.template_type === type) : db.templates;
      return sendSuccess(res, list);
    }
    if (pathname === '/templates' && method === 'POST') {
      const tmpl = {
        id: db.templates.length + 1,
        code: body.code || `TMPL-${String(db.templates.length + 1).padStart(3, '0')}`,
        ...body,
      };
      db.templates.push(tmpl);
      saveDB();
      return sendSuccess(res, tmpl, 'Template created', 201);
    }

    // 12. Reports
    if (pathname === '/reports/purchase') {
      const totalSpend = db.purchaseOrders.reduce((s, p) => s + (p.net_amount || 0), 0);
      const totalPaid = db.purchaseOrders.reduce((s, p) => s + (p.paid_amount || 0), 0);
      return sendSuccess(res, {
        summary: {
          total_pos: db.purchaseOrders.length,
          total_spend: totalSpend,
          total_paid: totalPaid,
          outstanding: totalSpend - totalPaid,
        },
        by_supplier: db.suppliers.map(s => {
          const pos = db.purchaseOrders.filter(p => p.supplier_id === s.id);
          const amt = pos.reduce((acc, p) => acc + (p.net_amount || 0), 0);
          return { supplier_name: s.name, po_count: pos.length, total_amount: amt };
        }),
      });
    }

    if (pathname === '/reports/inventory') {
      const totalValuation = db.materials.reduce((s, m) => s + ((m.current_stock || 0) * (m.purchase_rate || 0)), 0);
      return sendSuccess(res, {
        summary: {
          total_materials: db.materials.length,
          total_valuation: totalValuation,
          low_stock_items: db.materials.filter(m => (m.current_stock || 0) <= m.min_stock_level).length,
        },
        top_stock: db.materials.slice(0, 8),
      });
    }

    if (pathname === '/reports/production') {
      const totalUnits = db.productionOrders.reduce((s, p) => s + (p.total_quantity || 0), 0);
      const completedUnits = db.productionOrders.reduce((s, p) => s + (p.completed_quantity || 0), 0);
      return sendSuccess(res, {
        summary: {
          total_orders: db.productionOrders.length,
          total_units: totalUnits,
          completed_units: completedUnits,
          efficiency_rate: totalUnits ? Math.round((completedUnits / totalUnits) * 100) : 0,
        },
        by_stage: db.productionStages,
      });
    }

    if (pathname === '/reports/qc') {
      const passed = db.qcRecords.reduce((s, q) => s + (q.passed_quantity || 0), 0);
      const rejected = db.qcRecords.reduce((s, q) => s + (q.rejected_quantity || 0), 0);
      return sendSuccess(res, {
        summary: {
          total_inspections: db.qcRecords.length,
          passed_quantity: passed,
          rejected_quantity: rejected,
          pass_rate: (passed + rejected) > 0 ? Math.round((passed / (passed + rejected)) * 100) : 98,
        },
        recent_inspections: db.qcRecords,
      });
    }

    if (pathname === '/reports/payments') {
      const allPayments = [];
      db.purchaseOrders.forEach(p => {
        (p.payments || []).forEach(pay => allPayments.push({ ...pay, po_number: p.po_number, supplier_name: p.supplier_name }));
      });
      return sendSuccess(res, {
        summary: {
          total_transactions: allPayments.length,
          total_disbursed: allPayments.reduce((s, p) => s + p.amount, 0),
        },
        recent_payments: allPayments,
      });
    }

    // 13. Settings
    if (pathname === '/settings/users' && method === 'GET') return sendSuccess(res, db.users);
    if (pathname === '/settings/users' && method === 'POST') {
      const u = { id: db.users.length + 1, status: 'active', ...body };
      db.users.push(u);
      saveDB();
      return sendSuccess(res, u, 'User created', 201);
    }
    if (pathname === '/settings/roles') return sendSuccess(res, db.roles);
    if (pathname === '/settings/stages') {
      if (method === 'GET') return sendSuccess(res, db.productionStages);
      if (method === 'POST') {
        const newStg = {
          id: db.productionStages.length + 1,
          code: body.code || `STG-${db.productionStages.length + 1}`,
          name: body.name,
          sequence_order: Number(body.sequence_order || db.productionStages.length + 1),
          color_badge: body.color_badge || '#6366f1',
          description: body.description || '',
          is_qc_stage: Boolean(body.is_qc_stage),
          is_final_stage: Boolean(body.is_final_stage),
          status: 'active',
          ...body,
        };
        db.productionStages.push(newStg);
        saveDB();
        return sendSuccess(res, newStg, 'Production stage created', 201);
      }
    }
    if (pathname === '/settings/company' && method === 'POST') {
      db.companySettings = { ...db.companySettings, ...body };
      saveDB();
      return sendSuccess(res, db.companySettings, 'Company settings saved');
    }

    // Fallback 404
    return sendError(res, `Route not found: ${method} ${pathname}`, 404);
  } catch (err) {
    console.error('Server error:', err);
    return sendError(res, 'Internal server error: ' + err.message, 500);
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Cheran ERP Backend Server running at http://localhost:${PORT}`);
  console.log(`📡 Ready to handle Purchase, Inventory, Production, Masters, Templates, Reports & Settings APIs!`);
});
