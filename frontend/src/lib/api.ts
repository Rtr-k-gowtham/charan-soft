// src/lib/api.ts
import { POTemplateColumn, POTemplateProcessField, POTemplateTerm, POTemplateSignature, POTemplateData } from '../types';

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
    request<{ token: string; name: string; role: string; email: string }>('/auth/login', 'POST', { email, password }),
  getMe: () => request<unknown>('/auth/me'),

  // Dashboard
  getDashboard: () => request<unknown>('/dashboard'),

  // Categories
  getCategories: (type?: string) =>
    request<unknown[]>(`/categories${type ? `?type=${type}` : ''}`),
  getCategory: (id: number) => request<unknown>(`/categories/${id}`),
  createCategory: (data: unknown) => request<unknown>('/categories', 'POST', data),
  addCategoryField: (categoryId: number, data: unknown) =>
    request<unknown>(`/categories/${categoryId}/fields`, 'POST', data),
  deleteCategoryField: (categoryId: number, fieldId: number) =>
    request<unknown>(`/categories/${categoryId}/fields/${fieldId}`, 'DELETE'),
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
  getCustomers: () => request<unknown[]>('/customers'),
  createCustomer: (data: unknown) => request<unknown>('/customers', 'POST', data),
  getBuyers: () => request<unknown[]>('/customers'),
  createBuyer: (data: unknown) => request<unknown>('/customers', 'POST', data),
  getBuyerProducts: (buyerId: number | string) => request<unknown[]>(`/buyers/${buyerId}/products`),
  createBuyerProduct: (buyerId: number | string, data: unknown) => request<unknown>(`/buyers/${buyerId}/products`, 'POST', data),
  updateBuyerProduct: (buyerId: number | string, productId: number | string, data: unknown) => request<unknown>(`/buyers/${buyerId}/products/${productId}`, 'PUT', data),
  deleteBuyerProduct: (buyerId: number | string, productId: number | string) => request<unknown>(`/buyers/${buyerId}/products/${productId}`, 'DELETE'),

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
  createProductionOrder: (data: unknown) =>
    request<unknown>('/production-orders', 'POST', data),
  moveStage: (data: unknown) =>
    request<unknown>('/production-orders/0/stage', 'POST', data),
  getStageOrders: (stageCode: string) =>
    request<unknown[]>(`/production/stage/${stageCode}`),
  getReworkList: () => request<unknown[]>('/production/rework'),
  getQCList: () => request<unknown[]>('/production/qc'),
  recordQC: (data: unknown) => request<unknown>('/qc', 'POST', data),

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
