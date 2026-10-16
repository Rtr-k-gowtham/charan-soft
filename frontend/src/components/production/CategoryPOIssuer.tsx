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
  PackageCheck,
  Eye
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
    if (location.state?.successMessage) {
      setActionSuccess(location.state.successMessage);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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

    const unmatched = suppliers.filter(s => !matched.some(m => m.id === s.id));
    const allRanked = [...matched, ...unmatched];
    const hasExact = matched.length > 0;
    const available = hasExact ? matched : suppliers;

    return {
      suppliers: available,
      matchedSuppliers: matched,
      allSuppliers: allRanked,
      isExactMatch: hasExact,
      matchedCount: matched.length,
      totalAvailable: suppliers.length,
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

  const handleOpenCreatePOPage = (categoryName: string, catMaterials: OrderMaterialRequirementItem[]) => {
    const selectedSupId = selectedVendors[categoryName] || '';
    const selectedSup = suppliers.find(s => String(s.id) === String(selectedSupId));
    const catObj = categories.find(
      c => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
    );
    const catId = catObj ? catObj.id : (selectedSup?.category_id || 1);

    navigate('/purchase/orders?create=true', {
      state: {
        production_order_id: Number(orderId),
        production_order_number: orderNumber,
        category_id: catId,
        category_name: categoryName,
        supplier_id: selectedSupId ? Number(selectedSupId) : (selectedSup?.id || ''),
        target_delivery_date: targetDeliveryDate,
        remarks: `PO for ${categoryName} - Production Order ${orderNumber}`,
        materials: catMaterials.map((m, idx) => ({
          material_id: m.material_id || undefined,
          material_code: m.material_code || undefined,
          item_description: m.name + (m.material_code ? ` [${m.material_code}]` : ''),
          description: m.name,
          uom: m.uom || 'KG',
          quantity: Number(m.total_required_qty) || 1,
          rate: Number(m.unit_cost) || 0,
          tax_percent: 5,
          order_no: orderNumber || `ORD-${idx + 1}`,
        })),
        from: `/production/po/${orderId}`,
      }
    });
  };

  // Create & Issue PO for a category
  const handleIssuePOForCategory = async (categoryName: string, catMaterials: OrderMaterialRequirementItem[]) => {
    const vendorId = selectedVendors[categoryName];
    if (!vendorId) {
      setActionError(`Please select a supplier/vendor for ${categoryName}`);
      return;
    }

    if (!catMaterials || catMaterials.length === 0) {
      setActionError(`No valid material lines found for category "${categoryName}"`);
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

      // Immediately mark the newly created PO as Ordered (Issued & Locked)
      if (createdPO?.id) {
        await api.updatePurchaseOrderStatus(createdPO.id, 'Ordered').catch(() => null);
      }

      // Ensure order items are at least moved from Stage 01 (REQ) to Stage 02 (PO)
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

      // Refresh existing POs from backend
      const updatedPOs = await api.getPurchaseOrders().catch(() => []);
      const rel = (updatedPOs as PurchaseOrder[]).filter(po => {
        if (po.production_order_id && String(po.production_order_id) === String(orderId)) return true;
        if (po.production_order_number && po.production_order_number === orderNumber) return true;
        if (po.remarks && po.remarks.includes(orderNumber)) return true;
        if (Array.isArray(po.items) && po.items.some((it: any) => it.order_no === orderNumber)) return true;
        return false;
      });
      setExistingPOs(rel);

      // Check if ALL required categories for this production order are now issued
      const allCatNames = Object.keys(categorizedMaterials);
      const allCategoriesIssued = allCatNames.every(catName => {
        const cLower = catName.toLowerCase();
        return rel.some(p => {
          const isIssued = (p.status || '').toLowerCase() !== 'draft';
          if (!isIssued) return false;
          if ((p.category_name || '').toLowerCase() === cLower) return true;
          if (p.remarks && p.remarks.toLowerCase().includes(cLower)) return true;
          return false;
        });
      });

      if (allCategoriesIssued) {
        // Advance production order items to Stage 03: Inward
        try {
          const prodOrderRes = await api.getProductionOrder(Number(orderId));
          const fullOrder = (prodOrderRes as any)?.data || prodOrderRes;
          if (fullOrder && Array.isArray(fullOrder.items)) {
            await Promise.all(
              fullOrder.items.map((it: any) =>
                api.moveStage({
                  order_item_id: it.id,
                  to_stage_id: 3, // Inward
                  quantity_moved: it.total_quantity || it.current_stage_quantity || 1,
                  remarks: `All ${allCatNames.length} category POs issued — order advanced to Inward stage`,
                }).catch(() => null)
              )
            );
          }
        } catch (stageErr) {
          console.warn('Inward stage movement warning:', stageErr);
        }
        setActionSuccess(`Purchase Order ${poNum} successfully issued! All categories are issued — Order has advanced to Stage 03: Inward.`);
      } else {
        setActionSuccess(`Purchase Order ${poNum} successfully issued & locked for ${categoryName}! (Remaining categories pending in Stage 02).`);
      }

      if (onPOCreated) onPOCreated(poNum);
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

      // Check if ALL required categories are now issued
      const allCatNames = Object.keys(categorizedMaterials);
      const allCategoriesIssued = allCatNames.every(catName => {
        const cLower = catName.toLowerCase();
        return rel.some(p => {
          const isIssued = (p.status || '').toLowerCase() !== 'draft';
          if (!isIssued) return false;
          if ((p.category_name || '').toLowerCase() === cLower) return true;
          if (p.remarks && p.remarks.toLowerCase().includes(cLower)) return true;
          return false;
        });
      });

      if (allCategoriesIssued) {
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
                  remarks: `PO ${po.po_number} issued — all category POs verified, advanced to Inward stage`,
                }).catch(() => {})
              )
            );
          }
        }
        setActionSuccess(`Purchase Order ${po.po_number} is officially Issued! All categories are issued — Order has moved to Stage 03: Inward.`);
      } else {
        setActionSuccess(`Purchase Order ${po.po_number} is officially Issued & Locked! (Remaining categories pending in Stage 02).`);
      }
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
      {/* Action Notification */}
      {actionSuccess && (
        <div className="mx-4 mt-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-950 flex items-center gap-2 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* CATEGORY-BASED MATERIAL PROCUREMENT & PO GENERATION (STRUCTURED TABLE VIEW) */}
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
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
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead className="bg-slate-100/80 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-2 w-[36px] text-center">#</th>
                    <th className="py-2.5 px-2.5 w-[110px]">PO Number</th>
                    <th className="py-2.5 px-2.5 w-[160px]">Material Category</th>
                    <th className="py-2.5 px-2 text-center w-[80px]">Item Count</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Required Materials</th>
                    <th className="py-2.5 px-2.5 text-right w-[100px]">Total Est. Cost</th>
                    <th className="py-2.5 px-2.5 w-[200px]">Vendor / Supplier</th>
                    <th className="py-2.5 px-2 text-center w-[95px]">PO Status</th>
                    <th className="py-2.5 px-2.5 text-right w-[100px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoriesList.map(([categoryName, catMaterials], idx) => {
                    const { matchedSuppliers, allSuppliers, isExactMatch, matchedCount } = getCategorySuppliers(categoryName);
                    const totalCatCost = catMaterials.reduce(
                      (sum, m) => sum + (Number(m.total_required_qty || 0) * Number(m.unit_cost || 0)),
                      0
                    );
                    const isSaving = !!issuingPO[categoryName];
                    const selectedSupId = selectedVendors[categoryName] || '';

                    // Category visual matching with icon
                    const catObj = categories.find(
                      c => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
                    );
                    const visual = getCategoryVisual(catObj || { name: categoryName });
                    const CatIcon = visual.Icon;

                    // Check if any PO is already created for this category
                    const catLower = categoryName.toLowerCase();
                    const matchingPOs = existingPOs.filter(p => {
                      if ((p.category_name || '').toLowerCase() === catLower) return true;
                      if (p.remarks && p.remarks.toLowerCase().includes(catLower)) return true;
                      return false;
                    });
                    const hasOrderedPO = matchingPOs.some(p => (p.status || '').toLowerCase() !== 'draft');
                    const hasDraftPO = matchingPOs.some(p => (p.status || '').toLowerCase() === 'draft');
                    const draftPO = matchingPOs.find(p => (p.status || '').toLowerCase() === 'draft');

                    // Material names for clean display
                    const materialNames = catMaterials.map(m => m.name).filter(Boolean);
                    const materialsText = materialNames.length > 0 ? materialNames.join(', ') : '—';

                    // Ensure selected supplier is available in dropdown even if not category-matched
                    const availableSups = [...allSuppliers];
                    if (selectedSupId) {
                      const curSup = suppliers.find(s => String(s.id) === String(selectedSupId));
                      if (curSup && !availableSups.some(s => String(s.id) === String(curSup.id))) {
                        availableSups.unshift(curSup);
                      }
                    }

                    const vendorOptions: SelectOption[] = availableSups.map(sup => {
                      const isMatched = matchedSuppliers.some(m => m.id === sup.id);
                      return {
                        value: String(sup.id),
                        label: `${sup.name}${sup.code ? ` (${sup.code})` : ''}`,
                        sublabel: [
                          isMatched ? 'Category Matched' : (sup.category_name || null),
                          sup.phone && sup.phone !== 'N/A' ? sup.phone : null,
                          sup.contact_person ? sup.contact_person : null,
                        ].filter(Boolean).join(' • '),
                      };
                    });

                    return (
                      <tr key={categoryName} className="hover:bg-slate-50/70 transition">
                        {/* 1. # */}
                        <td className="py-2.5 px-2 text-center font-mono text-slate-400 text-[11px] align-middle">
                          {idx + 1}
                        </td>

                        {/* 2. PO Number (Dedicated column with prominent badge & clickable link) */}
                        <td className="py-2.5 px-2.5 align-middle">
                          {matchingPOs.length > 0 ? (
                            <div className="flex flex-col gap-1 items-start">
                              {matchingPOs.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => navigate(`/purchase/orders/${p.id}`)}
                                  className="font-mono font-bold text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 hover:text-brand-900 px-2 py-0.5 rounded border border-brand-200 shadow-2xs transition inline-flex items-center gap-1 text-left truncate max-w-full"
                                  title={`Click to view PO ${p.po_number}`}
                                >
                                  <span>{p.po_number}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* 3. Material Category (Full readable name with badge) */}
                        <td className="py-2.5 px-2.5 align-middle">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${visual.bg} ${visual.border} ${visual.color} shadow-2xs max-w-full truncate`}
                            title={categoryName}
                          >
                            <CatIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{categoryName}</span>
                          </span>
                        </td>

                        {/* 4. Item Count */}
                        <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap">
                          <span className="font-mono text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block whitespace-nowrap">
                            {catMaterials.length} {catMaterials.length === 1 ? 'item' : 'items'}
                          </span>
                        </td>

                        {/* 5. Required Materials / Summary (Wrapped text in fixed table view) */}
                        <td className="py-2.5 px-3 align-middle">
                          <p
                            className="text-slate-700 text-[11px] font-medium leading-relaxed break-words whitespace-normal"
                            title={materialsText}
                          >
                            {materialsText}
                          </p>
                        </td>

                        {/* 6. Total Estimated Cost */}
                        <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap align-middle">
                          {totalCatCost > 0 ? fmtCurrency(totalCatCost) : '—'}
                        </td>

                        {/* 7. Vendor / Supplier */}
                        <td className="py-2.5 px-2.5 align-middle">
                          {hasOrderedPO ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 truncate">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium truncate" title={matchingPOs[0]?.supplier_name || 'Assigned Supplier'}>
                                {matchingPOs[0]?.supplier_name || 'Assigned Supplier'}
                              </span>
                            </div>
                          ) : (
                            <div className="w-full">
                              <SearchableSelect
                                value={selectedSupId}
                                onChange={val =>
                                  setSelectedVendors(prev => ({
                                    ...prev,
                                    [categoryName]: val,
                                  }))
                                }
                                options={vendorOptions}
                                placeholder="-- Select Supplier --"
                                searchPlaceholder="Search vendor..."
                                disabled={hasOrderedPO}
                                clearable={!hasOrderedPO}
                              />
                              {isExactMatch && !hasOrderedPO && (
                                <span className="text-[9px] font-medium text-emerald-700 block mt-0.5 truncate">
                                  ✓ {matchedCount} {matchedCount === 1 ? 'matched supplier' : 'matched suppliers'}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 8. PO Status */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                          {isSaving ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Issuing...
                            </span>
                          ) : hasOrderedPO ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                              title="Purchase Order issued & ordered"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ordered
                            </span>
                          ) : hasDraftPO ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Draft
                            </span>
                          ) : selectedSupId ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Ready to Issue
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              Not Issued
                            </span>
                          )}
                        </td>

                        {/* 9. Action */}
                        <td className="py-2.5 px-2.5 text-right whitespace-nowrap align-middle">
                          {hasOrderedPO ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/purchase/orders/${matchingPOs[0]?.id}`)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-md shadow-2xs transition whitespace-nowrap"
                              title="View PO Details"
                            >
                              <Eye className="w-3.5 h-3.5 text-brand-600" />
                              <span>View PO</span>
                            </button>
                          ) : hasDraftPO && draftPO ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/purchase/orders/${draftPO.id}`)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-md shadow-2xs transition whitespace-nowrap"
                              title="View & Edit Draft PO"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-700" />
                              <span>View PO</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenCreatePOPage(categoryName, catMaterials)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 hover:text-brand-900 border border-brand-200 rounded-md shadow-2xs transition whitespace-nowrap"
                              title={`View PO creation with materials for ${categoryName}`}
                            >
                              <Eye className="w-3.5 h-3.5 text-brand-600" />
                              <span>View PO</span>
                            </button>
                          )}
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
