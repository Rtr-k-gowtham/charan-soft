// src/types/index.ts

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  role_name: string;
  token?: string;
  permissions?: string[];
}

export interface Category {
  id: number;
  name: string;
  code: string;
  type?: string;
  description?: string;
  icon?: string;
  status: string;
  sort_order: number;
  fields?: CategoryField[];
}

export interface CategoryField {
  id: number;
  category_id: number;
  field_name: string;
  field_label: string;
  field_type: 'text' | 'number' | 'decimal' | 'select' | 'textarea' | 'date' | 'checkbox' | 'calculated';
  is_required: boolean;
  is_visible: boolean;
  is_readonly?: boolean;
  default_value?: string;
  options?: string[];
  sort_order: number;
}

export interface Material {
  id: number;
  category_id: number;
  category_name?: string;
  supplier_id?: number;
  supplier_name?: string;
  code: string;
  name: string;
  uom: string;
  purchase_rate: number;
  tax_percent: number;
  min_stock_level: number;
  current_stock: number;
  live_stock?: number;
  available_stock?: number;
  status: string;
  spec?: string;
  dynamic_fields?: { field_name: string; field_label: string; field_value: string }[];
}

export interface Product {
  id: number;
  category_id?: number | null;
  category_name?: string;
  code: string;
  name: string;
  design?: string;
  uom: string;
  selling_price: number;
  tax_percent: number;
  status: string;
  image?: string;
  image_url?: string;
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  category_id?: number | null;
  category_name?: string;
  category_code?: string;
  category_icon?: string;
  contact_person?: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  payment_terms_days: number;
  status: string;
}

export interface Buyer {
  id: number;
  code: string;
  name: string;
  contact_person?: string;
  phone: string;
  email?: string;
  billing_address?: string;
  gstin?: string;
  status: string;
  avatar_style?: 'lorelei' | string;
  avatar_seed?: string;
  avatar_config?: string | Record<string, any>;
}

export type Customer = Buyer;

// ==========================================
// Buyer Master – Product & Packing Configuration Types
// ==========================================
export type MaterialCategory = 'Fabric' | 'Zip' | 'Button' | 'Thread' | 'Label' | 'Packaging' | 'Other' | string;
export type DimensionUnit = 'mm' | 'cm' | 'm';

export interface BuyerProductComponent {
  id: string;
  material_id?: number;
  category_id?: number;
  name: string;
  category: MaterialCategory;
  uom: string;
  quantity_per_product: number;
  wastage_percent?: number;
  notes?: string;
}

export interface ProductDimensions {
  length: number;
  width: number;
  height: number;
  unit: DimensionUnit;
  calculated_volume_cm3: number;
  calculated_volume_m3: number;
  weight_grams?: number;
}

export interface ProductVariantSpec {
  size_id?: number;
  size_name: string;
  dimensions: ProductDimensions;
  items_per_box?: number;
}

export interface BoxPackingConfig {
  id: string;
  box_name: string;
  box_code?: string;
  length: number;
  width: number;
  height: number;
  dimension_unit: DimensionUnit;
  calculated_volume_cm3: number;
  calculated_volume_m3: number;
  items_per_box: number;
  max_packing_qty?: number;
  notes?: string;
}

export interface BuyerProduct {
  id: number | string;
  buyer_id: number;
  product_name: string;
  product_code?: string;
  uom: string;
  notes?: string;
  image_url?: string;
  dimensions: ProductDimensions;
  variants?: ProductVariantSpec[];
  components: BuyerProductComponent[];
  boxes: BoxPackingConfig[];
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrderItem {
  id?: number;
  purchase_order_id?: number;
  material_id?: number;
  line_number?: number;
  item_description: string;
  description?: string;
  spec?: string;
  design?: string;
  color?: string;
  size?: string;
  uom: string;
  quantity: number;
  weight_kg?: number;
  received_quantity?: number;
  rate: number;
  taxable_amount: number;
  tax_percent: number;
  tax_amount: number;
  net_amount: number;
  dynamic_data?: Record<string, string>;
}

export interface PurchasePayment {
  id: number;
  purchase_order_id: number;
  receipt_number: string;
  payment_date: string;
  amount: number;
  payment_mode: string;
  reference_number?: string;
  notes?: string;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  category_id: number;
  category_name?: string;
  supplier_id: number;
  supplier_name?: string;
  supplier_phone?: string;
  po_date: string;
  delivery_due_date?: string;
  payment_due_date?: string;
  ordered_at?: string;
  subtotal: number;
  tax_amount: number;
  net_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: 'Unpaid' | 'Partially Paid' | 'Settled' | 'Overdue' | 'Not Paid' | 'Paid';
  status: 'Draft' | 'Ordered' | string;
  remarks?: string;
  production_order_id?: number | null;
  production_order_number?: string;
  production_order_title?: string;
  items?: PurchaseOrderItem[];
  payments?: PurchasePayment[];
  receipts?: any[];
}

export interface Color {
  id: number;
  code?: string;
  name: string;
  hex_code: string;
  pantone_code?: string;
  status?: string;
}

export interface DyeingOrderItem {
  id?: number;
  dyeing_order_id?: number;
  color_id?: number;
  color_name: string;
  pantone_code?: string;
  hex_code?: string;
  planned_quantity: number;
  received_quantity?: number;
  rate_per_unit?: number;
  shrinkage_loss_percent?: number;
  shade_match_status?: string;
  notes?: string;
}

export interface DyeingReceipt {
  id: number;
  receipt_no: string;
  dyeing_order_id: number;
  production_order_id: number;
  receipt_date: string;
  delivery_challan_no?: string;
  received_by?: string;
  total_received_quantity: number;
  photo_url?: string;
  shade_condition?: string;
  remarks?: string;
  items_data?: any;
  created_at: string;
}

export interface DyeingOrder {
  id: number;
  dyeing_order_no: string;
  production_order_id: number;
  fabric_material_id?: number;
  fabric_name: string;
  fabric_code?: string;
  uom: string;
  supplier_id?: number;
  dyeing_mill_name?: string;
  supplier_name?: string;
  challan_no?: string;
  order_date: string;
  expected_delivery_date?: string;
  total_fabric_quantity: number;
  total_received_quantity: number;
  status: 'Sent to Dyeing' | 'In Process' | 'Partially Received' | 'Received' | 'Cancelled';
  process_type?: string;
  remarks?: string;
  created_at?: string;
  items?: DyeingOrderItem[];
  receipts?: DyeingReceipt[];
}

export interface ProductionStage {
  id: number;
  name: string;
  code: string;
  sequence_order: number;
  description?: string;
  standard_cycle_time_mins?: number;
  color_badge: string;
  is_qc_stage: boolean;
  is_final_stage: boolean;
  status: string;
}

export interface ProductionOrderItem {
  id: number;
  production_order_id: number;
  product_id: number;
  product_name?: string;
  product_code?: string;
  category_name?: string;
  color: string;
  color_pantone_code?: string;
  color_hex_code?: string;
  size?: string;
  total_quantity: number;
  current_stage_id: number;
  current_stage_name?: string;
  color_badge?: string;
  stage_sequence?: number;
  current_stage_quantity: number;
  completed_quantity: number;
  rejected_quantity: number;
  rework_quantity: number;
  status: string;
}

export interface ProductionOrder {
  id: number;
  order_number: string;
  category_id: number;
  category_name?: string;
  customer_id?: number;
  customer_code?: string;
  customer_name?: string;
  customer_avatar_style?: string;
  customer_avatar_seed?: string;
  customer_avatar_config?: string | Record<string, any>;
  buyer?: Buyer;
  title: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  start_date: string;
  target_delivery_date: string;
  total_quantity: number;
  completed_quantity: number;
  status: string;
  current_stage_name?: string;
  current_stage_id?: number;
  notes?: string;
  items?: ProductionOrderItem[];
}

export interface StockBalance {
  id: number;
  code: string;
  name: string;
  uom: string;
  category_name: string;
  current_stock: number;
  available_stock: number;
  min_stock_level: number;
  is_low_stock: boolean;
}

export interface InventoryTransaction {
  id: number;
  material_id: number;
  material_name: string;
  uom: string;
  transaction_type: string;
  reference_type?: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  notes?: string;
  user_name?: string;
  created_at: string;
}

export interface QCRecord {
  input_quantity: number;
  passed_quantity: number;
  rejected_quantity: number;
  rework_quantity: number;
  pending_quantity: number;
  defect_reason?: string;
  remarks?: string;
  rework_stage_id?: number;
}

export interface DashboardKPIs {
  total_purchase_orders: number;
  pending_payments_po: number;
  pending_payment_amount: number;
  low_stock_count: number;
  production_orders: number;
  completed_orders: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  low_stock: StockBalance[];
  recent_purchase_orders: PurchaseOrder[];
  recent_production: ProductionOrder[];
}

export type StatusType =
  | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
  | 'PARTIALLY RECEIVED' | 'RECEIVED'
  | 'IN PRODUCTION' | 'PARTIALLY COMPLETED' | 'QC' | 'REWORK' | 'COMPLETED' | 'CANCELLED'
  | 'Not Paid' | 'Partially Paid' | 'Paid'
  | 'In Progress' | 'In Rework' | 'CONFIRMED'
  | 'Low' | 'Medium' | 'High' | 'Urgent';

export interface POTemplateColumn {
  id?: number;
  column_key: string;
  label: string;
  is_visible: boolean | number;
  display_order: number;
  width: string;
  alignment: 'left' | 'center' | 'right';
}

export interface POTemplateProcessField {
  id?: number;
  field_key: string;
  label: string;
  is_visible: boolean | number;
  display_order: number;
}

export interface POTemplateTerm {
  id?: number;
  term_key: string;
  title: string;
  content: string;
  display_order: number;
  is_active: boolean | number;
}

export interface POTemplateSignature {
  id?: number;
  title: string;
  name?: string;
  designation?: string;
  show_signature_line: boolean | number;
  show_date: boolean | number;
  show_stamp: boolean | number;
  display_order: number;
}

export interface POTemplateData {
  settings: Record<string, string>;
  columns: POTemplateColumn[];
  process_fields: POTemplateProcessField[];
  terms: POTemplateTerm[];
  signatures: POTemplateSignature[];
  categories?: Category[];
  category_column_configs?: Record<string, any>;
  metadata?: {
    last_updated: string;
    updated_by: string;
    updated_date: string;
  };
}

export interface OrderMaterialRequirementItem {
  material_id?: number | null;
  material_code?: string;
  name: string;
  category: string;
  uom: string;
  total_required_qty: number;
  current_stock: number;
  shortage_qty: number;
  unit_cost: number;
  total_estimated_cost: number;
  status: 'In Stock' | 'Partial Stock' | 'Needs Procurement';
  product_contributions?: {
    product_id: number;
    product_name: string;
    product_code?: string;
    color?: string;
    garment_qty: number;
    per_piece_qty: number;
    wastage_percent: number;
    required_qty: number;
  }[];
}

export interface ProductionOrderBOMReport {
  order: ProductionOrder;
  products: {
    item_id: number;
    product_id: number;
    product_name: string;
    product_code?: string;
    category_name?: string;
    color: string;
    size?: string | null;
    total_quantity: number;
    components: {
      material_id?: number | null;
      material_code?: string;
      name: string;
      category: string;
      uom: string;
      quantity_per_product: number;
      wastage_percent: number;
      required_quantity: number;
    }[];
  }[];
  total_materials: OrderMaterialRequirementItem[];
  summary: {
    total_products_count: number;
    total_order_garments: number;
    total_distinct_materials: number;
    in_stock_count: number;
    shortage_count: number;
    total_estimated_cost: number;
  };
  generated_at: string;
}

