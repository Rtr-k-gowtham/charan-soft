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
    { id: 1, name: 'K. Senthil Nathan', email: 'admin@cheransoftgoods.com', role: 'ADMIN', role_id: 1, role_name: 'System Administrator', phone: '+91 98422 10001', status: 'active', created_at: '2026-01-01' },
    { id: 2, name: 'M. Ramesh Kumar', email: 'purchase@cheransoftgoods.com', role: 'PURCHASE_MGR', role_id: 2, role_name: 'Purchase Manager', phone: '+91 98422 10002', status: 'active', created_at: '2026-01-05' },
    { id: 3, name: 'P. Anand', email: 'production@cheransoftgoods.com', role: 'PROD_MGR', role_id: 3, role_name: 'Production Head', phone: '+91 98422 10003', status: 'active', created_at: '2026-01-10' },
    { id: 4, name: 'S. Divya', email: 'qc@cheransoftgoods.com', role: 'QC_INSPECTOR', role_id: 4, role_name: 'Quality Lead', phone: '+91 98422 10004', status: 'active', created_at: '2026-01-15' },
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
  customers: [
    { id: 1, code: 'CUST-001', name: 'Zudio Retail Fashion', contact_person: 'Rohan Sharma', phone: '+91 98200 44551', email: 'buying@zudio.com', gstin: '27AABCT1234A1Z9', city: 'Mumbai', state: 'Maharashtra' },
    { id: 2, code: 'CUST-002', name: 'Max Lifestyle Garments', contact_person: 'Pooja Nair', phone: '+91 98450 77882', email: 'sourcing@maxlifestyle.in', gstin: '29AABCL5678B1Z1', city: 'Bengaluru', state: 'Karnataka' },
    { id: 3, code: 'CUST-003', name: 'Allen Solly Apparel Corp', contact_person: 'Deepak Varma', phone: '+91 99800 22334', email: 'production@allensolly.com', gstin: '29AABCA9012C1Z3', city: 'Bengaluru', state: 'Karnataka' },
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
    { id: 1, code: 'INST', name: 'Installation', sequence_order: 1, color_badge: '#6366f1', standard_cycle_time_mins: 45, status: 'active' },
    { id: 2, code: 'DYE', name: 'Dyeing', sequence_order: 2, color_badge: '#0ea5e9', standard_cycle_time_mins: 180, status: 'active' },
    { id: 3, code: 'DET', name: 'Detailing', sequence_order: 3, color_badge: '#8b5cf6', standard_cycle_time_mins: 60, status: 'active' },
    { id: 4, code: 'CUT', name: 'Cutting', sequence_order: 4, color_badge: '#f59e0b', standard_cycle_time_mins: 90, status: 'active' },
    { id: 5, code: 'STI', name: 'Stitching', sequence_order: 5, color_badge: '#10b981', standard_cycle_time_mins: 240, status: 'active' },
    { id: 6, code: 'QC', name: 'QC', sequence_order: 6, color_badge: '#ef4444', standard_cycle_time_mins: 30, status: 'active' },
    { id: 7, code: 'RWK', name: 'Rework', sequence_order: 7, color_badge: '#ec4899', standard_cycle_time_mins: 60, status: 'active' },
    { id: 8, code: 'COMP', name: 'Completed', sequence_order: 8, color_badge: '#059669', standard_cycle_time_mins: 15, status: 'active' },
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
      const { email, password } = body;
      const user = db.users.find(u => u.email === email);
      if (user || email === 'admin@cheransoftgoods.com') {
        const u = user || db.users[0];
        return sendSuccess(res, {
          ...u,
          token: 'jwt_mock_token_' + Date.now(),
        }, 'Login successful');
      }
      return sendError(res, 'Invalid credentials', 401);
    }

    if (pathname === '/auth/me') {
      return sendSuccess(res, db.users[0]);
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
      const cats = type ? db.categories.filter(c => c.type === type) : db.categories;
      return sendSuccess(res, cats);
    }
    if (pathname === '/categories' && method === 'POST') {
      const autoCode = body.code || 'CAT_' + (body.name || 'CATEGORY').trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_');
      const newCat = { id: db.categories.length + 1, ...body, code: autoCode, fields: body.fields || [], created_at: new Date().toISOString() };
      db.categories.push(newCat);
      saveDB();
      return sendSuccess(res, newCat, 'Category created', 201);
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
    if (pathname === '/suppliers' && method === 'GET') return sendSuccess(res, db.suppliers);
    if (pathname === '/suppliers' && method === 'POST') {
      const newSup = { id: db.suppliers.length + 1, code: body.code || `SUP-00${db.suppliers.length + 1}`, ...body };
      db.suppliers.push(newSup);
      saveDB();
      return sendSuccess(res, newSup, 'Supplier added', 201);
    }

    if ((pathname === '/customers' || pathname === '/buyers') && method === 'GET') return sendSuccess(res, db.customers);
    if ((pathname === '/customers' || pathname === '/buyers') && method === 'POST') {
      const newCust = { id: db.customers.length + 1, code: body.code || `BUY-00${db.customers.length + 1}`, ...body };
      db.customers.push(newCust);
      saveDB();
      return sendSuccess(res, newCust, 'Buyer added', 201);
    }

    // Buyer Products
    const bpGetMatch = pathname.match(/^\/(?:buyers|customers)\/(\d+)\/products$/);
    if (bpGetMatch && method === 'GET') {
      const buyerId = Number(bpGetMatch[1]);
      if (!db.buyer_products) db.buyer_products = [];
      const prods = db.buyer_products.filter(p => p.buyer_id === buyerId);
      return sendSuccess(res, prods);
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
        return {
          id: idx + 1,
          order_no: it.order_no || `ORD-${String(idx + 1).padStart(3, '0')}`,
          material_id: it.material_id,
          item_description: it.item_description || it.description || 'Fabric Material',
          quantity: qty,
          rate,
          taxable_amount: taxable,
          tax_percent: taxPct,
          tax_amount: taxAmt,
          net_amount: net,
          received_quantity: 0,
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

      const newPO = {
        id: db.purchaseOrders.length + 1,
        po_number: poNumber,
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
        return {
          id: idx + 1,
          order_no: it.order_no || `ORD-${String(idx + 1).padStart(3, '0')}`,
          material_id: it.material_id,
          item_description: it.item_description || it.description || 'Fabric Material',
          quantity: qty,
          rate,
          taxable_amount: taxable,
          tax_percent: taxPct,
          tax_amount: taxAmt,
          net_amount: net,
          received_quantity: Number(it.received_quantity || 0),
          ...it
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

      const grn = {
        id: (po.receipts || []).length + 1,
        receipt_no: `GRN-000${20 + Math.floor(Math.random() * 80)}`,
        receipt_date: body.receipt_date || new Date().toISOString().split('T')[0],
        delivery_challan_no: body.challan_no || `DC-${Math.floor(1000 + Math.random() * 9000)}`,
        vehicle_no: body.vehicle_no || '',
        quantity_received: totalQty,
        remarks: body.remarks || 'Goods verified and added to inventory',
      };
      po.receipts = po.receipts || [];
      po.receipts.unshift(grn);
      po.status = 'Ordered';
      saveDB();
      return sendSuccess(res, grn, 'Goods received and stock updated');
    }

    // Receipts / Payments / Returns endpoints
    if (pathname === '/purchase/receipts' && method === 'GET') {
      const allReceipts = [];
      db.purchaseOrders.forEach(p => {
        (p.receipts || []).forEach(r => allReceipts.push({ ...r, po_number: p.po_number, supplier_name: p.supplier_name }));
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
    if (pathname === '/production-orders' && method === 'GET') return sendSuccess(res, db.productionOrders);
    if (pathname === '/production-orders' && method === 'POST') {
      const items = (body.items || []).map((it, idx) => ({
        id: idx + 1,
        product_id: it.product_id || 1,
        product_name: it.product_name || 'Crew Neck T-Shirt',
        color: it.color || 'Navy Blue',
        size: it.size || 'M',
        total_quantity: Number(it.total_quantity || 100),
        current_stage_id: 1,
        current_stage_name: 'Installation',
        stage_code: 'INST',
        current_stage_quantity: Number(it.total_quantity || 100),
        completed_quantity: 0,
        rejected_quantity: 0,
        rework_quantity: 0,
        status: 'In Progress',
      }));

      const totalQty = items.reduce((s, i) => s + i.total_quantity, 0);
      const newOrder = {
        id: db.productionOrders.length + 1,
        order_number: `ORD-${1000 + db.productionOrders.length + 1}`,
        title: body.title || 'Export Garment Batch',
        customer_id: body.customer_id || 1,
        customer_name: (db.customers.find(c => c.id === Number(body.customer_id)) || db.customers[0]).name,
        category_id: Number(body.category_id || 1),
        priority: body.priority || 'Medium',
        start_date: body.start_date || new Date().toISOString().split('T')[0],
        target_delivery_date: body.target_delivery_date || new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
        total_quantity: totalQty,
        completed_quantity: 0,
        status: 'IN PRODUCTION',
        notes: body.notes || '',
        items,
      };
      db.productionOrders.unshift(newOrder);
      saveDB();
      return sendSuccess(res, newOrder, 'Production order scheduled', 201);
    }

    // Move Stage
    if (pathname.includes('/stage') && method === 'POST') {
      const { item_id, to_stage_id } = body;
      const targetStage = db.productionStages.find(s => s.id === Number(to_stage_id)) || db.productionStages[0];
      for (const ord of db.productionOrders) {
        const item = (ord.items || []).find(i => i.id === Number(item_id));
        if (item) {
          item.current_stage_id = targetStage.id;
          item.current_stage_name = targetStage.name;
          item.stage_code = targetStage.code;
          if (targetStage.code === 'COMP') {
            item.status = 'Completed';
            item.completed_quantity = item.total_quantity;
            ord.completed_quantity = (ord.completed_quantity || 0) + item.completed_quantity;
          }
          saveDB();
          return sendSuccess(res, item, `Stage moved to ${targetStage.name}`);
        }
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
    if (pathname === '/settings/permissions') return sendSuccess(res, db.permissions);
    if (pathname === '/settings/stages') return sendSuccess(res, db.productionStages);
    if (pathname === '/settings/company' && method === 'GET') return sendSuccess(res, db.companySettings);
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
