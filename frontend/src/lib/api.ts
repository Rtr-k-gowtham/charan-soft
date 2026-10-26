// src/lib/api.ts
import { POTemplateColumn, POTemplateProcessField, POTemplateTerm, POTemplateSignature, POTemplateData, ReworkRecord } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return localStorage.getItem('cheran_token');
}

async function request<T>(
  endpoint: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const token = getToken();
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${endpoint}`, opts);

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const errData = await res.json();
      errMsg = errData.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const json = await res.json();
  return json.data ?? json;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; name: string; role: string; email: string }>('/auth/login', 'POST', { email, username: email, password }),
  getMe: () => request<unknown>('/auth/me'),

  // Dashboard
  getDashboard: () => request<unknown>('/dashboard'),

  // Categories
  getCategories: (type?: string) =>
    request<unknown[]>(`/categories${type ? `?type=${type}` : ''}`),
  getCategory: (id: number) => request<unknown>(`/categories/${id}`),
  createCategory: (data: unknown) => request<unknown>('/categories', 'POST', data),
  updateCategory: (id: number, data: unknown) => request<unknown>(`/categories/${id}`, 'PUT', data),
  addCategoryField: (categoryId: number, data: unknown) =>
    request<unknown>(`/categories/${categoryId}/fields`, 'POST', data),
  deleteCategoryField: (categoryId: number, fieldId: number) =>
    request<unknown>(`/categories/${categoryId}/fields/${fieldId}`, 'DELETE'),
  getCategoryTerms: (categoryId: number) => request<any[]>(`/categories/${categoryId}/terms`),
  saveCategoryTerms: (categoryId: number, terms: any[]) =>
    request<any[]>(`/categories/${categoryId}/terms`, 'PUT', { terms }),
  deleteCategory: (id: number) => request<unknown>(`/categories/${id}`, 'DELETE'),

  // Materials
  getMaterials: (categoryId?: number) =>
    request<unknown[]>(`/materials${categoryId ? `?category_id=${categoryId}` : ''}`),
  getMaterial: (id: number) => request<unknown>(`/materials/${id}`),
  createMaterial: (data: unknown) => request<unknown>('/materials', 'POST', data),
  updateMaterial: (id: number, data: unknown) => request<unknown>(`/materials/${id}`, 'PUT', data),
  deleteMaterial: (id: number) => request<unknown>(`/materials/${id}`, 'DELETE'),

  // Products
  getProducts: () => request<unknown[]>('/products'),
  createProduct: (data: unknown) => request<unknown>('/products', 'POST', data),
  updateProduct: (id: number, data: unknown) => request<unknown>(`/products/${id}`, 'PUT', data),
  deleteProduct: (id: number) => request<unknown>(`/products/${id}`, 'DELETE'),

  // Suppliers, Customers & Buyers
  getSuppliers: () => request<unknown[]>('/suppliers'),
  createSupplier: (data: unknown) => request<unknown>('/suppliers', 'POST', data),
  updateSupplier: (id: number | string, data: unknown) => request<unknown>(`/suppliers/${id}`, 'PUT', data),
  deleteSupplier: (id: number | string) => request<unknown>(`/suppliers/${id}`, 'DELETE'),
  getCustomers: () => request<unknown[]>('/customers'),
  createCustomer: (data: unknown) => request<unknown>('/customers', 'POST', data),
  updateCustomer: (id: number | string, data: unknown) => request<unknown>(`/customers/${id}`, 'PUT', data),
  getBuyers: () => request<unknown[]>('/customers'),
  createBuyer: (data: unknown) => request<unknown>('/customers', 'POST', data),
  updateBuyer: (id: number | string, data: unknown) => request<unknown>(`/customers/${id}`, 'PUT', data),
  getBuyerProducts: (buyerId: number | string) => request<unknown[]>(`/buyers/${buyerId}/products`),
  getBuyerProduct: (buyerId: number | string, productId: number | string) => request<unknown>(`/buyers/${buyerId}/products/${productId}`),
  createBuyerProduct: (buyerId: number | string, data: unknown) => request<unknown>(`/buyers/${buyerId}/products`, 'POST', data),
  updateBuyerProduct: (buyerId: number | string, productId: number | string, data: unknown) => request<unknown>(`/buyers/${buyerId}/products/${productId}`, 'PUT', data),
  deleteBuyerProduct: (buyerId: number | string, productId: number | string) => request<unknown>(`/buyers/${buyerId}/products/${productId}`, 'DELETE'),

  // Dyeing Mills Master
  getDyeingMills: () => request<unknown[]>('/dyeing-mills'),
  createDyeingMill: (data: unknown) => request<unknown>('/dyeing-mills', 'POST', data),
  updateDyeingMill: (id: number | string, data: unknown) => request<unknown>(`/dyeing-mills/${id}`, 'PUT', data),
  deleteDyeingMill: (id: number | string) => request<unknown>(`/dyeing-mills/${id}`, 'DELETE'),

  // Embroidery Works Master
  getEmbroideryWorks: () => request<unknown[]>('/embroidery-works'),
  createEmbroideryWork: (data: unknown) => request<unknown>('/embroidery-works', 'POST', data),
  updateEmbroideryWork: (id: number | string, data: unknown) => request<unknown>(`/embroidery-works/${id}`, 'PUT', data),
  deleteEmbroideryWork: (id: number | string) => request<unknown>(`/embroidery-works/${id}`, 'DELETE'),

  // Inventory
  getInventory: () => request<unknown[]>('/inventory'),
  getLedger: (materialId?: number) =>
    request<unknown[]>(`/inventory/ledger${materialId ? `?material_id=${materialId}` : ''}`),
  getLowStock: () => request<unknown[]>('/inventory/low-stock'),
  adjustStock: (data: unknown) => request<unknown>('/inventory/adjustment', 'POST', data),
  getConsumption: () => request<unknown[]>('/inventory/consumption'),
  recordConsumption: (data: unknown) => request<unknown>('/inventory/consumption', 'POST', data),

  // Purchase Orders & Related
  getPurchaseOrders: () => request<unknown[]>('/purchase-orders'),
  getPurchaseOrder: (id: number) => request<unknown>(`/purchase-orders/${id}`),
  createPurchaseOrder: (data: unknown) => request<unknown>('/purchase-orders', 'POST', data),
  updatePurchaseOrder: (id: number, data: unknown) =>
    request<unknown>(`/purchase-orders/${id}`, 'PUT', data),
  updatePurchaseOrderStatus: (poId: number, status: string) =>
    request<unknown>(`/purchase-orders/${poId}/status`, 'PATCH', { status }),
  cancelPurchaseOrder: (poId: number, reason: string) =>
    request<unknown>(`/purchase-orders/${poId}/cancel`, 'POST', { reason }),
  reissuePurchaseOrder: (poId: number) =>
    request<unknown>(`/purchase-orders/${poId}/reissue`, 'POST', {}),
  addPayment: (poId: number, data: unknown) =>
    request<unknown>(`/purchase-orders/${poId}/payments`, 'POST', data),
  receiveGoods: (poId: number, data: unknown) =>
    request<unknown>(`/purchase-orders/${poId}/receive`, 'POST', data),
  getReceipts: () => request<unknown[]>('/purchase/receipts'),
  getPayments: () => request<unknown[]>('/purchase/payments'),
  getPurchaseReturns: () => request<unknown[]>('/purchase/returns'),
  createPurchaseReturn: (data: unknown) => request<unknown>('/purchase/returns', 'POST', data),

  // Production
  getProductionStages: () => request<unknown[]>('/production-stages'),
  getProductionOrders: () => request<unknown[]>('/production-orders'),
  getProductionOrder: (id: number | string) => request<unknown>(`/production-orders/${id}`),
  getOrderMaterialRequirements: (id: number | string, force = false) =>
    request<any>(`/production-orders/${id}/material-requirements${force ? '?force=1' : ''}`),
  saveOrderMaterialRequirements: (id: number | string, data: unknown) =>
    request<unknown>(`/production-orders/${id}/material-requirements`, 'POST', data),
  createProductionOrder: (data: unknown) =>
    request<unknown>('/production-orders', 'POST', data),
  updateProductionOrderStatus: (id: number | string, stageId: number | string, data?: any) =>
    request<any>(`/production-orders/${id}/status`, 'PUT', { stage_id: stageId, ...data }),
  moveStage: (data: unknown) =>
    request<unknown>('/production-orders/0/stage', 'POST', data),
  getStageOrders: (stageCode: string) =>
    request<unknown[]>(`/production/stage/${stageCode}`),
  getReworkList: () => request<unknown[]>('/production/rework'),
  getReworkRecords: (params?: { production_order_id?: number | string; stage_id?: number | string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.production_order_id) query.append('production_order_id', String(params.production_order_id));
    if (params?.stage_id) query.append('stage_id', String(params.stage_id));
    if (params?.status) query.append('status', params.status);
    const qs = query.toString();
    return request<ReworkRecord[]>(`/production/rework${qs ? `?${qs}` : ''}`);
  },
  createRework: (data: any) => request<any>('/production/rework/create', 'POST', data),
  sendRework: (data: any) => request<any>('/production/rework/send', 'POST', data),
  receiveRework: (data: any) => request<any>('/production/rework/receive', 'POST', data),
  reinspectRework: (data: any) => request<any>('/production/rework/reinspect', 'POST', data),
  getQCList: () => request<unknown[]>('/production/qc'),
  recordQC: (data: unknown) => request<unknown>('/qc', 'POST', data),

  // Production Dashboard & Tracking
  getProductionDashboardKPIs: () => request<any>('/production/dashboard-stats'),
  getOrderProductQuantities: (orderId: number | string) => request<any>(`/production/orders/${orderId}/product-quantities`),
  getOrderQuantityLedger: (orderId: number | string, itemId?: number | string) => 
    request<any[]>(`/production/orders/${orderId}/quantity-ledger${itemId ? `?item_id=${itemId}` : ''}`),

  // Dyeing (Stage 04)
  getDyeingOrders: (productionOrderId?: number | string) =>
    request<any[]>(`/dyeing/orders${productionOrderId ? `?production_order_id=${productionOrderId}` : ''}`),
  getDyeingOrder: (id: number | string) => request<any>(`/dyeing/orders/${id}`),
  createDyeingOrder: (data: any) => request<any>('/dyeing/orders', 'POST', data),
  receiveDyeingOrder: (id: number | string, data: any) => request<any>(`/dyeing/orders/${id}/receive`, 'POST', data),
  transferDyeingToCutting: (data: { production_order_id: number | string; receipt_id?: number | string; quantity?: number; transferred_by?: string; notes?: string }) =>
    request<any>('/dyeing/transfer-to-cutting', 'POST', data),
  getDyeingFabricStock: (productionOrderId: number | string) =>
    request<any>(`/dyeing/fabric-stock?production_order_id=${productionOrderId}`),

  // Stage 05: Cutting
  getCuttingOrders: (productionOrderId?: number | string) =>
    request<any[]>(`/production/cutting/orders${productionOrderId ? `?production_order_id=${productionOrderId}` : ''}`),
  getCuttingOrderDetails: (orderId: number | string) =>
    request<any>(`/production/cutting/${orderId}`),
  createCuttingBatch: (data: any) =>
    request<any>('/production/cutting/batch', 'POST', data),
  transferCuttingOutput: (data: any) =>
    request<any>('/production/cutting/transfer', 'POST', data),

  // Stage 06: Embroidery Outward / Inward
  getEmbroideryJobOrders: (productionOrderId?: number | string) =>
    request<any[]>(`/production/embroidery/job-orders${productionOrderId ? `?production_order_id=${productionOrderId}` : ''}`),
  getEmbroideryOrderDetails: (orderId: number | string) =>
    request<any>(`/production/embroidery/${orderId}`),
  createEmbroideryJobOrder: (data: any) =>
    request<any>('/production/embroidery/job-order', 'POST', data),
  receiveEmbroideryJobOrder: (data: any) =>
    request<any>('/production/embroidery/inward', 'POST', data),
  createEmbroideryReceipt: (data: any) =>
    request<any>('/production/embroidery/inward', 'POST', data),
  getVendorOutstandingEmbroidery: () =>
    request<any[]>('/production/embroidery/vendor-outstanding'),
  transferEmbroideryOutput: (data: any) =>
    request<any>('/production/embroidery/transfer', 'POST', data),

  // Stage 07: Stitching
  getStitchingOrders: (productionOrderId?: number | string) =>
    request<any[]>(`/production/stitching/orders${productionOrderId ? `?production_order_id=${productionOrderId}` : ''}`),
  getStitchingOrderDetails: (orderId: number | string) =>
    request<any>(`/production/stitching/${orderId}`),
  getStitchingBatches: (productionOrderId?: number | string) =>
    request<any[]>(`/production/stitching/orders${productionOrderId ? `?production_order_id=${productionOrderId}` : ''}`),
  createStitchingBatch: (data: any) =>
    request<any>('/production/stitching/batch', 'POST', data),
  transferStitchingOutput: (data: any) =>
    request<any>('/production/stitching/transfer', 'POST', data),

  // Stage 08: Checking / Quality Inspections
  getCheckingOrders: (productionOrderId?: number | string) =>
    request<any[]>(`/production/checking/orders${productionOrderId ? `?production_order_id=${productionOrderId}` : ''}`),
  getCheckingOrderDetails: (orderId: number | string) =>
    request<any>(`/production/checking/${orderId}`),
  recordQualityInspection: (data: any) =>
    request<any>('/production/inspect', 'POST', data),
  createQualityInspection: (data: any) =>
    request<any>('/production/inspect', 'POST', data),
  recordStageInspection: (data: any) =>
    request<any>('/production/inspect', 'POST', data),
  getQualityInspections: (productionOrderId?: number | string) =>
    request<any[]>(`/production/checking/orders${productionOrderId ? `?production_order_id=${productionOrderId}` : ''}`),
  transferCheckingOutput: (data: any) =>
    request<any>('/production/checking/transfer', 'POST', data),

  // Stage 09: Packing & Master Carton Management
  getPackingOrders: (productionOrderId?: number | string) =>
    request<any[]>(`/production/packing/orders${productionOrderId ? `?production_order_id=${productionOrderId}` : ''}`),
  getPackingOrderDetails: (orderId: number | string) =>
    request<any>(`/production/packing/${orderId}`),
  createPackingBatch: (data: any) =>
    request<any>('/production/packing/batch', 'POST', data),
  transferPackingOutput: (data: any) =>
    request<any>('/production/packing/transfer', 'POST', data),
  getPackingCartons: (orderId?: number | string) =>
    request<any[]>(`/production/packing/cartons${orderId ? `?production_order_id=${orderId}` : ''}`),
  getCartonBySerial: (serial: string) =>
    request<any>(`/production/packing/carton/${encodeURIComponent(serial)}`),

  // Stage 10: Completed & Final Dispatch
  getDispatchOrders: (productionOrderId?: number | string) =>
    request<any[]>(`/production/dispatch/orders${productionOrderId ? `?production_order_id=${productionOrderId}` : ''}`),
  getDispatchOrderDetails: (orderId: number | string) =>
    request<any>(`/production/dispatch/${orderId}`),
  recordOrderDispatch: (data: any) =>
    request<any>('/production/dispatch/record', 'POST', data),
  getDispatchHistory: (orderId?: number | string) =>
    request<any[]>(`/production/dispatch/history${orderId ? `?production_order_id=${orderId}` : ''}`),

  // Production Reports
  getDetailedProductionReports: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params || {});
    return request<any>(`/reports/production/detailed?${q.toString()}`);
  },

  // Masters
  lookupPantoneColor: (code: string) =>
    request<{
      found: boolean;
      pantone_name?: string;
      pantone_code?: string;
      unique_code?: string;
      hex_code?: string;
      red?: number;
      green?: number;
      blue?: number;
      color_system?: string;
      message?: string;
    }>(`/pantone-colors?code=${encodeURIComponent(code)}`),
  getPantoneColors: (params?: { search?: string; page?: number; limit?: number; all?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.all) q.append('all', '1');
    if (params?.search) q.append('search', params.search);
    if (params?.page) q.append('page', String(params.page));
    if (params?.limit) q.append('limit', String(params.limit));
    return request<{
      items: Array<{
        id: number;
        pantone_name: string;
        pantone_code: string;
        unique_code?: string;
        hex_code: string;
        red: number;
        green: number;
        blue: number;
        color_system?: string;
        created_at?: string;
      }>;
      total: number;
      page: number;
      limit: number;
      total_pages: number;
    }>(`/pantone-colors?${q.toString()}`);
  },
  createPantoneColor: (data: unknown) => request<unknown>('/pantone-colors', 'POST', data),
  updatePantoneColor: (id: number, data: unknown) => request<unknown>(`/pantone-colors/${id}`, 'PUT', data),
  deletePantoneColor: (id: number) => request<unknown>(`/pantone-colors/${id}`, 'DELETE'),
  getUnits: () => request<unknown[]>('/units'),
  createUnit: (data: unknown) => request<unknown>('/units', 'POST', data),
  getColors: () => request<unknown[]>('/colors'),
  createColor: (data: unknown) => request<unknown>('/colors', 'POST', data),
  updateColor: (id: number, data: unknown) => request<unknown>(`/colors/${id}`, 'PUT', data),
  deleteColor: (id: number) => request<unknown>(`/colors/${id}`, 'DELETE'),
  getSizes: () => request<unknown[]>('/sizes'),
  createSize: (data: unknown) => request<unknown>('/sizes', 'POST', data),
  getDesigns: () => request<unknown[]>('/designs'),
  createDesign: (data: unknown) => request<unknown>('/designs', 'POST', data),

  // Templates
  getTemplates: (type?: string) =>
    request<unknown[]>(`/templates${type ? `?type=${type}` : ''}`),
  createTemplate: (data: unknown) => request<unknown>('/templates', 'POST', data),

  // Reports
  getPurchaseReport: () => request<unknown>('/reports/purchase'),
  getInventoryReport: () => request<unknown>('/reports/inventory'),
  getProductionReport: () => request<unknown>('/reports/production'),
  getQCReport: () => request<unknown>('/reports/qc'),
  getPaymentReport: () => request<unknown>('/reports/payments'),

  // Settings
  getUsers: () => request<unknown[]>('/settings/users'),
  createUser: (data: unknown) => request<unknown>('/settings/users', 'POST', data),
  updateUser: (id: number, data: unknown) => request<unknown>(`/settings/users/${id}`, 'PUT', data),
  getRoles: () => request<unknown[]>('/settings/roles'),
  getPermissions: () => request<unknown[]>('/settings/permissions'),
  getStages: () => request<unknown[]>('/settings/stages'),
  createStage: (data: unknown) => request<unknown>('/settings/stages', 'POST', data),
  getCompanySettings: () => request<unknown>('/settings/company'),
  updateCompanySettings: (data: unknown) => request<unknown>('/settings/company', 'POST', data),

  // PO Template Settings
  getPOTemplateSettings: () => request<POTemplateData>('/settings/po-template'),
  savePOTemplateSettings: (data: unknown) => request<unknown>('/settings/po-template', 'POST', data),
  restorePOTemplateDefaults: () => request<unknown>('/settings/po-template/restore-defaults', 'POST'),
};
