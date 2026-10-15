// src/components/production/CategoryPOIssuer.tsx
// Category-Based Product & Raw Material Procurement with Vendor Matching, PO Issuance & In-Stage PO Management
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../lib/api';
import { OrderMaterialRequirementItem, Supplier, Category, PurchaseOrder, PurchaseOrderItem } from '../../types';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import StatusBadge from '../ui/StatusBadge';
import SearchableSelect, { SelectOption } from '../ui/SearchableSelect';
import { getCategoryVisual } from '../../pages/masters/Categories';
import {
  ShoppingCart,
  Building2,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
  AlertCircle,
  Tag,
  Clock,
  Printer,
  ChevronRight,
  RefreshCw,
  Pencil,
  Trash2,
  Plus,
  Save,
  Check,
  Send,
  FileText,
  DollarSign,
  PackageCheck
} from 'lucide-react';

interface Props {
  orderId: number | string;
  orderNumber: string;
  orderTitle?: string;
  targetDeliveryDate?: string;
  materials: OrderMaterialRequirementItem[];
  onPOCreated?: (poNumber: string) => void;
}

const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n || 0);

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function CategoryPOIssuer({
  orderId,
  orderNumber,
  orderTitle,
  targetDeliveryDate,
  materials,
  onPOCreated,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [existingPOs, setExistingPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected vendor per category for new PO generation
  const [selectedVendors, setSelectedVendors] = useState<Record<string, string>>({});
  // Issuing PO loading state per category
  const [issuingPO, setIssuingPO] = useState<Record<string, boolean>>({});
  // Changing status of existing PO (e.g. Draft -> Ordered)
  const [updatingPOStatus, setUpdatingPOStatus] = useState<Record<number, boolean>>({});
  
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Edit PO Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editDeliveryDueDate, setEditDeliveryDueDate] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editItems, setEditItems] = useState<any[]>([]);
  const [savingEditPO, setSavingEditPO] = useState(false);
  const [editPOError, setEditPOError] = useState('');

  const loadDependencies = async () => {
    setLoading(true);
    try {
      const [supRes, catRes, poRes] = await Promise.all([
        api.getSuppliers().catch(() => []),
        api.getCategories().catch(() => []),
        api.getPurchaseOrders().catch(() => []),
      ]);
      const supList = (supRes || []) as Supplier[];
      setSuppliers(supList);
      setCategories((catRes || []) as Category[]);

      const allPOs = (poRes || []) as PurchaseOrder[];
      // Filter POs linked to this production order
      const related = allPOs.filter(po => {
        if (po.production_order_id && String(po.production_order_id) === String(orderId)) return true;
        if (po.production_order_number && po.production_order_number === orderNumber) return true;
        if (po.remarks && po.remarks.includes(orderNumber)) return true;
        if (Array.isArray(po.items) && po.items.some((it: any) => it.order_no === orderNumber)) return true;
        return false;
      });
      setExistingPOs(related);
    } catch (err: unknown) {
      console.error('Failed to load PO issuance dependencies', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, [orderId, orderNumber]);

  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => setActionSuccess(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);

  // Group materials by category
  const categorizedMaterials = useMemo(() => {
    const groups: Record<string, OrderMaterialRequirementItem[]> = {};
    (materials || []).forEach(m => {
      const cat = m.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    });
    return groups;
  }, [materials]);

  // For a given category, find matching suppliers
  const getCategorySuppliers = (categoryName: string) => {
    const cleanCat = categoryName.trim().toLowerCase();

    // 1. Match by supplier.category_name
    let matched = suppliers.filter(s => {
      const scName = (s.category_name || '').trim().toLowerCase();
      return scName === cleanCat || scName.includes(cleanCat) || cleanCat.includes(scName);
    });

    // 2. Match by category_id if name matching yielded empty
    if (matched.length === 0) {
      const catObj = categories.find(
        c => c.name.trim().toLowerCase() === cleanCat || cleanCat.includes(c.name.trim().toLowerCase())
      );
      if (catObj) {
        matched = suppliers.filter(s => String(s.category_id) === String(catObj.id));
      }
    }

    const hasExact = matched.length > 0;
    const available = hasExact ? matched : suppliers;

    return {
      suppliers: available,
      isExactMatch: hasExact,
      totalAvailable: available.length,
    };
  };

  // Automatically select vendor: if PO already exists for this category, select that PO's vendor;
  // otherwise, select the first matched vendor if available
  useEffect(() => {
    const next: Record<string, string> = { ...selectedVendors };
    let changed = false;

    Object.keys(categorizedMaterials).forEach(cat => {
      if (!next[cat]) {
        const catLower = cat.toLowerCase();
        const existingPO = existingPOs.find(p => {
          if ((p.category_name || '').toLowerCase() === catLower) return true;
          if (p.remarks && p.remarks.toLowerCase().includes(catLower)) return true;
          return false;
        });

        if (existingPO && existingPO.supplier_id) {
          next[cat] = String(existingPO.supplier_id);
          changed = true;
        } else {
          const { suppliers: catSups } = getCategorySuppliers(cat);
          if (catSups.length > 0) {
            next[cat] = String(catSups[0].id);
            changed = true;
          }
        }
      }
    });

    if (changed) {
      setSelectedVendors(next);
    }
  }, [suppliers, categories, categorizedMaterials, existingPOs]);

  // Create / Issue new PO for a category
  const handleIssuePOForCategory = async (categoryName: string, catMaterials: OrderMaterialRequirementItem[]) => {
    const vendorId = selectedVendors[categoryName];
    if (!vendorId) {
      setActionError(`Please select a supplier/vendor for ${categoryName}`);
      return;
    }

    // Guard: prevent duplicate PO if one already exists for this category
    const catLower = categoryName.toLowerCase();
    const alreadyExists = existingPOs.some(p => {
      if ((p.category_name || '').toLowerCase() === catLower) return true;
      if (p.remarks && p.remarks.toLowerCase().includes(catLower)) return true;
      return false;
    });
    if (alreadyExists) {
      setActionError(`A Purchase Order already exists for "${categoryName}". Please edit the existing PO in the table above instead of creating a new one.`);
      return;
    }

    setActionError(null);
    setIssuingPO(prev => ({ ...prev, [categoryName]: true }));

    try {
      const selectedSup = suppliers.find(s => String(s.id) === String(vendorId));
      const catObj = categories.find(
        c => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
      );
      const catId = catObj ? catObj.id : (selectedSup?.category_id || 1);

      const itemsPayload = catMaterials.map((m, idx) => ({
        material_id: m.material_id || undefined,
        item_description: m.name + (m.material_code ? ` [${m.material_code}]` : ''),
        uom: m.uom || 'PCS',
        quantity: Number(m.total_required_qty) || 1,
        rate: Number(m.unit_cost) || 0,
        tax_percent: 5,
        order_no: orderNumber || `ORD-${idx + 1}`,
      }));

      const payload = {
        production_order_id: Number(orderId),
        supplier_id: Number(vendorId),
        production_order_number: orderNumber,
        category_id: Number(catId),
        po_date: new Date().toISOString().split('T')[0],
        delivery_due_date: targetDeliveryDate || undefined,
        remarks: `PO issued from Production Order ${orderNumber} for ${categoryName} materials`,
        items: itemsPayload,
      };

      const res = await api.createPurchaseOrder(payload);
      const createdPO = (res as any)?.data || res;
      const poNum = createdPO?.po_number || 'New PO';

      // Auto-advance order items from Stage 01 (REQ) to Stage 02 (PO)
      try {
        const prodOrderRes = await api.getProductionOrder(Number(orderId));
        const fullOrder = (prodOrderRes as any)?.data || prodOrderRes;
        const stagesRes = await api.getProductionStages().catch(() => []);
        const stagesList = ((stagesRes as any)?.data || stagesRes) as any[];
        const poStage = stagesList.find((s: any) => s.code === 'PO' || (s.name && s.name.toLowerCase().includes('purchase order'))) || { id: 2 };
        if (fullOrder && Array.isArray(fullOrder.items)) {
          const itemsToMove = fullOrder.items.filter((it: any) => {
            const code = (it.stage_code || '').toUpperCase();
            return code === 'REQ' || code === 'INST' || Number(it.current_stage_id) === 1 || !it.current_stage_id;
          });
          if (itemsToMove.length > 0) {
            await Promise.all(
              itemsToMove.map((it: any) =>
                api.moveStage({
                  order_item_id: it.id,
                  to_stage_id: poStage.id,
                  quantity_moved: it.total_quantity || it.current_stage_quantity || 1,
                  remarks: `Moved to PO stage on PO issuance (${poNum})`,
                }).catch(() => null)
              )
            );
          }
        }
      } catch (stageErr) {
        console.warn('Auto-stage advance handled by backend', stageErr);
      }

      setActionSuccess(`Purchase Order ${poNum} successfully created for ${categoryName}!`);
      if (onPOCreated) onPOCreated(poNum);

      // Refresh existing POs
      const updatedPOs = await api.getPurchaseOrders().catch(() => []);
      const rel = (updatedPOs as PurchaseOrder[]).filter(po => {
        if (po.production_order_id && String(po.production_order_id) === String(orderId)) return true;
        if (po.production_order_number && po.production_order_number === orderNumber) return true;
        if (po.remarks && po.remarks.includes(orderNumber)) return true;
        if (Array.isArray(po.items) && po.items.some((it: any) => it.order_no === orderNumber)) return true;
        return false;
      });
      setExistingPOs(rel);
    } catch (err: unknown) {
      setActionError((err as Error).message || `Failed to create PO for ${categoryName}`);
    } finally {
      setIssuingPO(prev => ({ ...prev, [categoryName]: false }));
    }
  };

  // Convert Draft PO -> Issued / Ordered
  const handleMarkPOAsIssued = async (po: PurchaseOrder) => {
    setUpdatingPOStatus(prev => ({ ...prev, [po.id]: true }));
    setActionError(null);
    try {
      await api.updatePurchaseOrderStatus(po.id, 'Ordered');

      // Auto-advance linked production order items to Stage 03: Inward
      try {
        if (orderId) {
          const ordRes = await api.getProductionOrder(Number(orderId));
          const ord = (ordRes as any)?.data || ordRes;
          if (ord && Array.isArray(ord.items)) {
            await Promise.all(
              ord.items.map((it: any) =>
                api.moveStage({
                  order_item_id: it.id,
                  to_stage_id: 3, // Stage 03: Inward
                  quantity_moved: it.total_quantity || it.current_stage_quantity || 1,
                  remarks: `PO ${po.po_number} issued to ${po.supplier_name || 'supplier'} — advanced to Inward stage`,
                }).catch(() => {})
              )
            );
          }
        }
      } catch (stageErr) {
        console.warn('Could not auto-advance stage on client:', stageErr);
      }

      setActionSuccess(`Purchase Order ${po.po_number} is officially Issued! Order has moved to Stage 03: Inward.`);
      // Refresh POs
      const updatedPOs = await api.getPurchaseOrders().catch(() => []);
      const rel = (updatedPOs as PurchaseOrder[]).filter(p => {
        if (p.production_order_id && String(p.production_order_id) === String(orderId)) return true;
        if (p.production_order_number && p.production_order_number === orderNumber) return true;
        if (p.remarks && p.remarks.includes(orderNumber)) return true;
        if (Array.isArray(p.items) && p.items.some((it: any) => it.order_no === orderNumber)) return true;
        return false;
      });
      setExistingPOs(rel);
    } catch (err: unknown) {
      setActionError((err as Error).message || `Failed to issue PO ${po.po_number}`);
    } finally {
      setUpdatingPOStatus(prev => ({ ...prev, [po.id]: false }));
    }
  };

  // Open Edit Modal for a PO
  const handleOpenEditPO = async (po: PurchaseOrder) => {
    setEditPOError('');
    setSavingEditPO(false);
    try {
      // Fetch full details including items
      const fullPO = await api.getPurchaseOrder(po.id);
      const data = (fullPO as any)?.data || fullPO;
      setEditingPO(data);
      setEditSupplierId(String(data.supplier_id || ''));
      setEditDeliveryDueDate(data.delivery_due_date || '');
      setEditRemarks(data.remarks || '');
      setEditItems(
        (data.items || []).map((it: any) => ({
          id: it.id,
          material_id: it.material_id,
          item_description: it.item_description || it.description || '',
          uom: it.uom || 'PCS',
          quantity: Number(it.quantity) || 0,
          rate: Number(it.rate) || 0,
          tax_percent: Number(it.tax_percent) || 5,
        }))
      );
      setEditModalOpen(true);
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to open PO editor');
    }
  };

  const handleUpdateEditItem = (idx: number, field: string, val: any) => {
    setEditItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleAddEditItem = () => {
    setEditItems(prev => [
      ...prev,
      {
        material_id: null,
        item_description: 'New Material Item',
        uom: 'PCS',
        quantity: 10,
        rate: 0,
        tax_percent: 5,
      }
    ]);
  };

  const handleDeleteEditItem = (idx: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSavePOEdits = async () => {
    if (!editingPO) return;
    if (editItems.length === 0) {
      setEditPOError('At least one item is required in the Purchase Order.');
      return;
    }
    setSavingEditPO(true);
    setEditPOError('');
    try {
      const payload = {
        category_id: editingPO.category_id,
        supplier_id: Number(editSupplierId) || editingPO.supplier_id,
        delivery_due_date: editDeliveryDueDate || undefined,
        remarks: editRemarks,
        items: editItems.map((it, idx) => ({
          material_id: it.material_id || undefined,
          item_description: it.item_description,
          uom: it.uom,
          quantity: Number(it.quantity) || 0,
          rate: Number(it.rate) || 0,
          tax_percent: Number(it.tax_percent) || 5,
          order_no: orderNumber || `ORD-${idx + 1}`,
        })),
      };

      await api.updatePurchaseOrder(editingPO.id, payload);
      setActionSuccess(`Purchase Order ${editingPO.po_number} updated successfully!`);
      setEditModalOpen(false);

      // Refresh POs
      const updatedPOs = await api.getPurchaseOrders().catch(() => []);
      const rel = (updatedPOs as PurchaseOrder[]).filter(p => {
        if (p.production_order_id && String(p.production_order_id) === String(orderId)) return true;
        if (p.production_order_number && p.production_order_number === orderNumber) return true;
        if (p.remarks && p.remarks.includes(orderNumber)) return true;
        if (Array.isArray(p.items) && p.items.some((it: any) => it.order_no === orderNumber)) return true;
        return false;
      });
      setExistingPOs(rel);
    } catch (err: unknown) {
      setEditPOError((err as Error).message || 'Failed to update Purchase Order');
    } finally {
      setSavingEditPO(false);
    }
  };

  const categoriesList = Object.entries(categorizedMaterials);

  return (
    <div className="bg-white rounded-xl border border-indigo-200/90 shadow-2xs overflow-hidden space-y-4">
      {/* Action Notification with Direct Inward Route */}
      {actionSuccess && (
        <div className="mx-4 mt-4 p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/production/inward/${orderId}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-2xs text-xs self-start sm:self-auto transition shrink-0"
          >
            <PackageCheck className="w-4 h-4" />
            <span>Go to Stage 03: Inward Receive →</span>
          </button>
        </div>
      )}

      {/* Persistent Inward Stage Notice when POs are issued */}
      {existingPOs.some(p => (p.status || '').toLowerCase() !== 'draft') && (
        <div className="mx-4 mt-3 p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2.5">
            <PackageCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-indigo-950 font-medium">
              Purchase Orders are officially issued! This project has advanced to <strong>Stage 03: Inward</strong> where raw materials can be received against PO items with photo proof.
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/production/inward/${orderId}`)}
            className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-2xs shrink-0 transition self-start sm:self-auto"
          >
            <span>Inward Workspace →</span>
          </button>
        </div>
      )}

      {actionError && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-indigo-50/90 via-sky-50/60 to-white border-b border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-2xs shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                Stage 02: Purchase Order (PO) Workspace
              </h3>
              <span className="bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                {existingPOs.length} {existingPOs.length === 1 ? 'PO Issued' : 'POs Issued'}
              </span>
              <span className="bg-slate-100 text-slate-700 font-mono text-[10px] font-medium px-2 py-0.5 rounded-full border border-slate-200">
                {categoriesList.length} Categories
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review all Purchase Orders for this order, edit draft items/rates, issue POs to vendors, or generate category POs.
            </p>
          </div>
        </div>

        <button
          onClick={loadDependencies}
          title="Refresh POs & Vendors"
          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg border border-slate-200 transition shadow-2xs bg-white/80"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* SECTION A: ALL PURCHASE ORDERS FOR THIS ORDER */}
      <div className="px-4 sm:px-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-brand-600" />
            Purchase Orders Linked to Order {orderNumber} ({existingPOs.length})
          </h4>
        </div>

        {existingPOs.length === 0 ? (
          <div className="bg-slate-50/70 border border-dashed border-slate-200 rounded-xl p-5 text-center text-xs text-slate-500">
            No Purchase Orders issued for this order yet. Use the category generator below to issue POs directly to category vendors.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            {/* Mobile PO Cards */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {existingPOs.map((po, idx) => {
                const isDraft = (po.status || '').toLowerCase() === 'draft';
                const isUpdating = !!updatingPOStatus[po.id];

                // Category visual matching
                const catObj = categories.find(c => 
                  (po.category_id && String(c.id) === String(po.category_id)) ||
                  (po.category_name && c.name.toLowerCase() === po.category_name.toLowerCase())
                );
                const visual = getCategoryVisual(catObj || { name: po.category_name });
                const CatIcon = visual.Icon;

                return (
                  <div key={po.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">
                          {po.po_number}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                      </div>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          isDraft
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {po.status || 'Draft'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block text-[11px]">{po.supplier_name || 'Vendor'}</span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border mt-1 ${visual.bg} ${visual.border} ${visual.color}`}>
                          <CatIcon className="w-2.5 h-2.5 shrink-0" />
                          <span>{po.category_name || 'General'}</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-xs text-slate-900 block">{fmtCurrency(po.net_amount || 0)}</span>
                        <span className="text-[9px] text-slate-400 font-mono">{po.po_date || '—'}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-wrap pt-1.5 border-t border-slate-100">
                      {isDraft ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleMarkPOAsIssued(po)}
                            disabled={isUpdating}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-2xs transition disabled:opacity-60 h-7"
                          >
                            <Send className="w-2.5 h-2.5" />
                            <span>{isUpdating ? 'Issuing...' : 'Issue PO'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigate(`/purchase/orders/${po.id}/edit`, {
                                state: { from: location.pathname, poNumber: po.po_number }
                              });
                            }}
                            className="px-2 py-1 text-[10px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-2xs transition hover:text-indigo-600 h-7 flex items-center gap-1"
                          >
                            <Pencil className="w-2.5 h-2.5 text-indigo-600" />
                            <span>Edit</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0 h-7 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            Issued & Locked
                          </span>
                          <button
                            type="button"
                            onClick={() => navigate(`/production/inward/${orderId}`)}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-2xs transition h-7"
                          >
                            <PackageCheck className="w-2.5 h-2.5" />
                            <span>Inward →</span>
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/purchase/orders/${po.id}`, {
                            state: { from: location.pathname, poNumber: po.po_number }
                          });
                        }}
                        className="px-2 py-1 text-[10px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-md shadow-2xs transition h-7 flex items-center justify-center"
                        title="View PO"
                      >
                        <Printer className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-2.5 w-10 text-center">#</th>
                    <th className="py-2 px-2.5 min-w-[130px]">PO Number</th>
                    <th className="py-2 px-2.5 min-w-[150px]">Category</th>
                    <th className="py-2 px-2.5 min-w-[160px]">Vendor / Supplier</th>
                    <th className="py-2 px-2.5 min-w-[110px]">PO Date</th>
                    <th className="py-2 px-2.5 text-right w-24">Net Amount</th>
                    <th className="py-2 px-2.5 w-24 text-center">Status</th>
                    <th className="py-2 px-2.5 text-right min-w-[170px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {existingPOs.map((po, idx) => {
                    const isDraft = (po.status || '').toLowerCase() === 'draft';
                    const isUpdating = !!updatingPOStatus[po.id];

                    // Category visual matching with icon
                    const catObj = categories.find(c => 
                      (po.category_id && String(c.id) === String(po.category_id)) ||
                      (po.category_name && c.name.toLowerCase() === po.category_name.toLowerCase())
                    );
                    const visual = getCategoryVisual(catObj || { name: po.category_name });
                    const CatIcon = visual.Icon;

                    return (
                      <tr key={po.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2 px-2.5 text-center font-mono text-slate-400 text-[10px]">
                          {idx + 1}
                        </td>

                        <td className="py-2 px-2.5">
                          <span className="font-mono font-bold text-[11px] text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200 block w-fit shadow-2xs">
                            {po.po_number}
                          </span>
                          {po.items && po.items.length > 0 && (
                            <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                              {po.items.length} {po.items.length === 1 ? 'item line' : 'item lines'}
                            </span>
                          )}
                        </td>

                        <td className="py-2 px-2.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${visual.bg} ${visual.border} ${visual.color} shadow-2xs whitespace-nowrap`}>
                            <CatIcon className="w-3 h-3 shrink-0" />
                            <span>{po.category_name || 'General'}</span>
                          </span>
                        </td>

                        <td className="py-2 px-2.5">
                          <span className="font-semibold text-slate-800 block text-[11px] truncate max-w-[170px]" title={po.supplier_name || 'Vendor'}>
                            {po.supplier_name || 'Vendor'}
                          </span>
                          {po.supplier_phone && (
                            <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                              {po.supplier_phone}
                            </span>
                          )}
                        </td>

                        <td className="py-2 px-2.5 font-mono text-slate-600 text-[10px]">
                          {po.po_date || '—'}
                          {po.delivery_due_date && (
                            <span className="text-[9px] text-slate-400 block mt-0.5">
                              Due: {po.delivery_due_date}
                            </span>
                          )}
                        </td>

                        <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900 text-[11px]">
                          {fmtCurrency(po.net_amount || 0)}
                        </td>

                        <td className="py-2 px-2.5 text-center">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              isDraft
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {po.status || 'Draft'}
                          </span>
                        </td>

                        <td className="py-2 px-2.5 text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {isDraft ? (
                              <>
                                {/* Draft PO: allow Edit + Issue to Vendor */}
                                <button
                                  type="button"
                                  onClick={() => handleMarkPOAsIssued(po)}
                                  disabled={isUpdating}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 h-6 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-2xs transition disabled:opacity-60 whitespace-nowrap"
                                  title="Issue PO to Supplier (marks as Ordered — cannot be undone)"
                                >
                                  <Send className="w-2.5 h-2.5" />
                                  <span>{isUpdating ? 'Issuing...' : 'Issue PO'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    navigate(`/purchase/orders/${po.id}/edit`, {
                                      state: { from: location.pathname, poNumber: po.po_number }
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 h-6 text-[10px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-2xs transition hover:text-indigo-600 whitespace-nowrap"
                                  title="Open detailed PO edit page"
                                >
                                  <Pencil className="w-2.5 h-2.5 text-indigo-600" />
                                  <span>Edit</span>
                                </button>
                              </>
                            ) : (
                              /* Ordered PO: immutable — show locked badge & direct Inward Receive action */
                              <>
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 h-6 rounded-md text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-not-allowed whitespace-nowrap"
                                  title="This PO has been officially issued to the vendor and is locked for editing"
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>Issued & Locked</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/production/inward/${orderId}`)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 h-6 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-2xs transition whitespace-nowrap"
                                  title="Receive ordered items from this PO in Stage 03 Inward"
                                >
                                  <PackageCheck className="w-2.5 h-2.5" />
                                  <span>Inward →</span>
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/purchase/orders/${po.id}`, {
                                  state: { from: location.pathname, poNumber: po.po_number }
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 h-6 text-[10px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-md shadow-2xs transition whitespace-nowrap"
                              title="View & Print PO Details"
                            >
                              <Printer className="w-2.5 h-2.5" />
                              <span>View</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTION B: CATEGORY-BASED MATERIAL PROCUREMENT & PO GENERATION */}
      <div className="px-4 sm:px-5 pb-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            Issue Category Purchase Orders ({categoriesList.length} Categories)
          </h4>
        </div>

        {categoriesList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
            No raw material requirements found for this order. Please verify BOM master configuration.
          </div>
        ) : (
          <div className="space-y-3">
            {categoriesList.map(([categoryName, catMaterials]) => {
              const { suppliers: catSups, isExactMatch } = getCategorySuppliers(categoryName);
              const totalCatCost = catMaterials.reduce(
                (sum, m) => sum + (Number(m.total_required_qty || 0) * Number(m.unit_cost || 0)),
                0
              );
              const isSaving = !!issuingPO[categoryName];
              const selectedSupId = selectedVendors[categoryName] || '';

              // Check if any PO is already created for this category (by name, remarks, or items)
              const matchingPOs = existingPOs.filter(p => {
                const catLower = categoryName.toLowerCase();
                if ((p.category_name || '').toLowerCase() === catLower) return true;
                // Match via remarks containing category name
                if (p.remarks && p.remarks.toLowerCase().includes(catLower)) return true;
                return false;
              });
              // PO is locked if any matching PO exists (Draft = revisable, Ordered = fully locked)
              const hasAnyPO = matchingPOs.length > 0;
              const hasOrderedPO = matchingPOs.some(p => (p.status || '').toLowerCase() !== 'draft');
              const hasDraftPO = matchingPOs.some(p => (p.status || '').toLowerCase() === 'draft');

              // Ensure selected supplier is available in dropdown even if not category-matched
              const availableSups = [...catSups];
              if (selectedSupId) {
                const curSup = suppliers.find(s => String(s.id) === String(selectedSupId));
                if (curSup && !availableSups.some(s => String(s.id) === String(curSup.id))) {
                  availableSups.unshift(curSup);
                }
              }

              const vendorOptions: SelectOption[] = availableSups.map(sup => ({
                value: String(sup.id),
                label: `${sup.name}${sup.code ? ` (${sup.code})` : ''}`,
                sublabel: [
                  sup.phone && sup.phone !== 'N/A' ? sup.phone : null,
                  sup.category_name ? sup.category_name : null,
                  sup.contact_person ? sup.contact_person : null,
                ].filter(Boolean).join(' • '),
              }));

              return (
                <div
                  key={categoryName}
                  className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 hover:border-indigo-300 transition-all shadow-2xs"
                >
                  {/* Category Bar */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    {/* Left: Category Title, Items Count, Cost & PO Status */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5 h-4">
                        <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Material Category</span>
                      </div>

                      <div className="h-[34px] flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wide truncate">
                          {categoryName}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs shrink-0">
                          {catMaterials.length} {catMaterials.length === 1 ? 'item' : 'items'}
                        </span>
                        {matchingPOs.length > 0 && (
                          <span
                            className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 shadow-2xs shrink-0"
                            title={matchingPOs.map(p => p.po_number).join(', ')}
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>
                              {matchingPOs.length === 1 ? matchingPOs[0].po_number : `${matchingPOs.length} POs Created`}
                            </span>
                          </span>
                        )}
                        <span className="text-slate-300 hidden sm:inline">•</span>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0">
                          <span>Total:</span>
                          <strong className="text-slate-900 font-mono font-bold">
                            {totalCatCost > 0 ? fmtCurrency(totalCatCost) : '—'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Right: Vendor Selection & Action / Status */}
                    <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
                      {/* Vendor Dropdown Column */}
                      <div className="flex flex-col w-full sm:w-72 md:w-80">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between h-4">
                          <span className="flex items-center gap-1 truncate">
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>Vendor / Supplier</span>
                          </span>
                          {isExactMatch ? (
                            <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 whitespace-nowrap">
                              Category Matched ({catSups.length})
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                              All Vendors ({catSups.length})
                            </span>
                          )}
                        </div>

                        <SearchableSelect
                          value={selectedSupId}
                          onChange={val =>
                            setSelectedVendors(prev => ({
                              ...prev,
                              [categoryName]: val,
                            }))
                          }
                          options={vendorOptions}
                          placeholder="-- Select Vendor / Supplier --"
                          searchPlaceholder="Search vendor by name, code..."
                          disabled={hasOrderedPO}
                          clearable={!hasOrderedPO}
                        />
                      </div>

                      {/* Action / Status Column */}
                      <div className="flex flex-col shrink-0">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-end h-4">
                          {matchingPOs.length > 0 ? (
                            <span
                              className="font-mono text-[10px] text-slate-500 font-bold"
                              title={matchingPOs.map(p => p.po_number).join(', ')}
                            >
                              {matchingPOs.length === 1 ? matchingPOs[0].po_number : `${matchingPOs.length} POs Linked`}
                            </span>
                          ) : (
                            <span>Action</span>
                          )}
                        </div>

                        <div className="h-[34px] flex items-center">
                          {hasOrderedPO ? (
                            <div
                              className="h-[34px] inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-800 shadow-2xs whitespace-nowrap cursor-not-allowed"
                              title="Purchase Order has been officially issued and locked"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>PO Issued & Locked</span>
                            </div>
                          ) : hasDraftPO ? (
                            <button
                              type="button"
                              onClick={() => {
                                const targetPO = matchingPOs.find(p => (p.status || '').toLowerCase() === 'draft') || matchingPOs[0];
                                if (targetPO) {
                                  navigate(`/purchase/orders/${targetPO.id}/edit`, {
                                    state: { from: location.pathname, poNumber: targetPO.po_number }
                                  });
                                }
                              }}
                              className="h-[34px] inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-bold bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 shadow-2xs whitespace-nowrap transition cursor-pointer"
                              title="Click to open detailed edit page for this draft PO"
                            >
                              <Pencil className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Edit Draft PO →</span>
                            </button>
                          ) : (
                            <Button
                              size="sm"
                              disabled={isSaving || !selectedSupId}
                              onClick={() => handleIssuePOForCategory(categoryName, catMaterials)}
                              className="h-[34px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 shadow-xs shrink-0 whitespace-nowrap"
                              icon={<ShoppingCart className="w-3.5 h-3.5" />}
                            >
                              {isSaving ? 'Creating PO...' : `Issue PO (${catMaterials.length})`}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items in Category Table */}
                  <div className="mt-3 overflow-x-auto bg-white rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="py-2 px-3 w-10 text-center">#</th>
                          <th className="py-2 px-3 min-w-[180px]">Material Name & Code</th>
                          <th className="py-2 px-3 text-center w-20">UOM</th>
                          <th className="py-2 px-3 text-right w-28">Required Qty</th>
                          <th className="py-2 px-3 text-right w-28">Est. Rate</th>
                          <th className="py-2 px-3 text-right w-32">Total Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {catMaterials.map((m, idx) => {
                          const lineCost =
                            Number(m.total_required_qty || 0) * Number(m.unit_cost || 0);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/60 transition">
                              <td className="py-2 px-3 text-center font-mono text-slate-400 text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3">
                                <span className="font-semibold text-slate-800 block">{m.name}</span>
                                {m.material_code && (
                                  <span className="font-mono text-[10px] text-slate-400 block">
                                    {m.material_code}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-slate-600">
                                {m.uom}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                {fmt(m.total_required_qty, 2)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600">
                                {m.unit_cost > 0 ? fmtCurrency(m.unit_cost) : '—'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                {lineCost > 0 ? fmtCurrency(lineCost) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: EDIT PURCHASE ORDER */}
      {editModalOpen && editingPO && (
        <Modal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={`Edit Purchase Order: ${editingPO.po_number}`}
          subtitle={`Category: ${editingPO.category_name || 'General'} | Production Order: ${orderNumber}`}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {editPOError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{editPOError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Vendor / Supplier
                </label>
                <SearchableSelect
                  value={editSupplierId}
                  onChange={val => setEditSupplierId(val)}
                  options={suppliers.map(sup => ({
                    value: String(sup.id),
                    label: `${sup.name}${sup.code ? ` (${sup.code})` : ''}`,
                    sublabel: [
                      sup.phone && sup.phone !== 'N/A' ? sup.phone : null,
                      sup.category_name ? sup.category_name : null,
                      sup.contact_person ? sup.contact_person : null,
                    ].filter(Boolean).join(' • '),
                  }))}
                  placeholder="Select Vendor"
                  searchPlaceholder="Search vendor by name, code..."
                  clearable={false}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Delivery Due Date
                </label>
                <input
                  type="date"
                  value={editDeliveryDueDate}
                  onChange={e => setEditDeliveryDueDate(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={e => setEditRemarks(e.target.value)}
                  placeholder="Notes for vendor..."
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* PO Line Items */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Purchase Order Items ({editItems.length})
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus className="w-3 h-3 text-emerald-600" />}
                  onClick={handleAddEditItem}
                  className="text-[11px]"
                >
                  Add Item
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-2.5 w-8 text-center">#</th>
                      <th className="py-2 px-2.5 min-w-[180px]">Item Description</th>
                      <th className="py-2 px-2.5 w-24">UOM</th>
                      <th className="py-2 px-2.5 w-28 text-right">Quantity</th>
                      <th className="py-2 px-2.5 w-28 text-right">Rate (₹)</th>
                      <th className="py-2 px-2.5 w-20 text-right">Tax %</th>
                      <th className="py-2 px-2.5 w-28 text-right">Net Amount</th>
                      <th className="py-2 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editItems.map((it, idx) => {
                      const qty = Number(it.quantity) || 0;
                      const rate = Number(it.rate) || 0;
                      const tax = Number(it.tax_percent) || 0;
                      const taxable = qty * rate;
                      const net = taxable + taxable * (tax / 100);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="py-2 px-2.5 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={it.item_description}
                              onChange={e => handleUpdateEditItem(idx, 'item_description', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800"
                            />
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={it.uom}
                              onChange={e => handleUpdateEditItem(idx, 'uom', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 font-mono"
                            />
                          </td>
                          <td className="py-2 px-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.quantity}
                              onChange={e => handleUpdateEditItem(idx, 'quantity', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-right font-mono font-bold text-slate-900"
                            />
                          </td>
                          <td className="py-2 px-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.rate}
                              onChange={e => handleUpdateEditItem(idx, 'rate', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-right font-mono text-slate-800"
                            />
                          </td>
                          <td className="py-2 px-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={it.tax_percent}
                              onChange={e => handleUpdateEditItem(idx, 'tax_percent', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-right font-mono text-slate-600"
                            />
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-800">
                            {fmtCurrency(net)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteEditItem(idx)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Subtotal Footer */}
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex justify-end gap-4 text-xs font-mono">
                <span>
                  Total Net Payable:{' '}
                  <strong className="text-slate-900 text-sm">
                    {fmtCurrency(
                      editItems.reduce((acc, it) => {
                        const q = Number(it.quantity) || 0;
                        const r = Number(it.rate) || 0;
                        const t = Number(it.tax_percent) || 0;
                        const taxable = q * r;
                        return acc + (taxable + taxable * (t / 100));
                      }, 0)
                    )}
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setEditModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                disabled={savingEditPO}
                onClick={handleSavePOEdits}
                icon={<Save className="w-3.5 h-3.5" />}
                className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs"
              >
                {savingEditPO ? 'Saving Changes...' : 'Save PO Changes'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
