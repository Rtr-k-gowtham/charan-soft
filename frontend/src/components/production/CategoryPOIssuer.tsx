// src/components/production/CategoryPOIssuer.tsx
// Category-Based Product & Raw Material Procurement with Vendor Matching and PO Issuance
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { OrderMaterialRequirementItem, Supplier, Category, PurchaseOrder } from '../../types';
import Button from '../ui/Button';
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
  RefreshCw
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [existingPOs, setExistingPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected vendor per category
  const [selectedVendors, setSelectedVendors] = useState<Record<string, string>>({});
  // Issuing PO loading state per category
  const [issuingPO, setIssuingPO] = useState<Record<string, boolean>>({});
  // Success state / newly created PO info per category
  const [issuedPOs, setIssuedPOs] = useState<Record<string, { po_number: string; id: number }>>({});
  const [actionError, setActionError] = useState<string | null>(null);

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
      const related = allPOs.filter(
        po => String(po.production_order_id) === String(orderId) || po.production_order_number === orderNumber
      );
      setExistingPOs(related);

      // Pre-populate issued POs map
      const poMap: Record<string, { po_number: string; id: number }> = {};
      related.forEach(po => {
        const cat = po.category_name || 'General';
        poMap[cat] = { po_number: po.po_number, id: po.id };
      });
      setIssuedPOs(poMap);
    } catch (err: unknown) {
      console.error('Failed to load PO issuance dependencies', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, [orderId, orderNumber]);

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

    // Default to matched if found, else return all active suppliers with flag
    const hasExact = matched.length > 0;
    const available = hasExact ? matched : suppliers;

    return {
      suppliers: available,
      isExactMatch: hasExact,
      totalAvailable: available.length,
    };
  };

  // Automatically select the first vendor if only 1 matches and not yet selected
  useEffect(() => {
    const next: Record<string, string> = { ...selectedVendors };
    let changed = false;

    Object.keys(categorizedMaterials).forEach(cat => {
      if (!next[cat]) {
        const { suppliers: catSups } = getCategorySuppliers(cat);
        if (catSups.length > 0) {
          next[cat] = String(catSups[0].id);
          changed = true;
        }
      }
    });

    if (changed) {
      setSelectedVendors(next);
    }
  }, [suppliers, categories, categorizedMaterials]);

  // Handle PO creation for a category
  const handleIssuePO = async (categoryName: string, catMaterials: OrderMaterialRequirementItem[]) => {
    const vendorId = selectedVendors[categoryName];
    if (!vendorId) {
      setActionError(`Please select a supplier/vendor for ${categoryName}`);
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
        category_id: Number(catId),
        po_date: new Date().toISOString().split('T')[0],
        delivery_due_date: targetDeliveryDate || undefined,
        remarks: `PO issued from Production Order ${orderNumber} for ${categoryName} materials`,
        items: itemsPayload,
      };

      const res = await api.createPurchaseOrder(payload);
      const createdPO = (res as any)?.data || res;
      const poNum = createdPO?.po_number || 'New PO';
      const poId = createdPO?.id || 0;

      setIssuedPOs(prev => ({ ...prev, [categoryName]: { po_number: poNum, id: poId } }));
      if (onPOCreated) onPOCreated(poNum);

      // Refresh existing POs
      const updatedPOs = await api.getPurchaseOrders().catch(() => []);
      const rel = (updatedPOs as PurchaseOrder[]).filter(
        po => String(po.production_order_id) === String(orderId) || po.production_order_number === orderNumber
      );
      setExistingPOs(rel);
    } catch (err: unknown) {
      setActionError((err as Error).message || `Failed to create PO for ${categoryName}`);
    } finally {
      setIssuingPO(prev => ({ ...prev, [categoryName]: false }));
    }
  };

  const categoriesList = Object.entries(categorizedMaterials);

  return (
    <div className="bg-white rounded-xl border border-indigo-200/80 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-indigo-50/90 via-sky-50/60 to-white border-b border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-2xs shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                Stage 02: Category-Based Material Procurement & PO Issuance
              </h3>
              <span className="bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                {categoriesList.length} Categories
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Materials sorted by category with category-matched supplier dropdowns to issue Purchase Orders directly.
            </p>
          </div>
        </div>

        <button
          onClick={loadDependencies}
          title="Refresh Vendors & POs"
          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg border border-slate-200 transition shadow-2xs bg-white/80"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {actionError && (
        <div className="mx-5 my-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {categoriesList.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-xs">
          No raw material requirements found for this order. Please verify BOM master configuration.
        </div>
      ) : (
        <div className="p-4 sm:p-5 space-y-4">
          {categoriesList.map(([categoryName, catMaterials]) => {
            const { suppliers: catSups, isExactMatch } = getCategorySuppliers(categoryName);
            const totalCatCost = catMaterials.reduce(
              (sum, m) => sum + (Number(m.total_required_qty || 0) * Number(m.unit_cost || 0)),
              0
            );
            const currentIssued = issuedPOs[categoryName];
            const isSaving = !!issuingPO[categoryName];
            const selectedSupId = selectedVendors[categoryName] || '';

            return (
              <div
                key={categoryName}
                className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 hover:border-indigo-300 transition-all shadow-2xs"
              >
                {/* Category Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">
                      <Layers className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                          {categoryName}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {catMaterials.length} {catMaterials.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Total Estimated Cost:{' '}
                        <strong className="text-slate-800 font-mono">
                          {totalCatCost > 0 ? fmtCurrency(totalCatCost) : '—'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Right: Vendor Selection & Action */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {currentIssued ? (
                      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="text-[11px] font-bold text-emerald-800 block">
                            PO Issued: <strong className="font-mono">{currentIssued.po_number}</strong>
                          </span>
                          <span className="text-[10px] text-emerald-600 block">Status: Draft / Ordered</span>
                        </div>
                        <a
                          href="/purchase/orders"
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 text-emerald-700 hover:text-emerald-900 font-bold text-xs flex items-center gap-1 underline underline-offset-2"
                        >
                          View PO
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <>
                        {/* Vendor Dropdown */}
                        <div className="flex flex-col min-w-[210px] sm:min-w-[260px]">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              Select {categoryName} Vendor
                            </span>
                            {isExactMatch ? (
                              <span className="text-[9px] font-normal text-emerald-600 bg-emerald-50 px-1 rounded">
                                Category Matched ({catSups.length})
                              </span>
                            ) : (
                              <span className="text-[9px] font-normal text-amber-600 bg-amber-50 px-1 rounded">
                                All Vendors ({catSups.length})
                              </span>
                            )}
                          </label>

                          <select
                            value={selectedSupId}
                            onChange={e =>
                              setSelectedVendors(prev => ({
                                ...prev,
                                [categoryName]: e.target.value,
                              }))
                            }
                            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-2xs"
                          >
                            <option value="">-- Choose Vendor / Supplier --</option>
                            {catSups.map(sup => (
                              <option key={sup.id} value={sup.id}>
                                {sup.name} {sup.code ? `(${sup.code})` : ''}{' '}
                                {sup.phone && sup.phone !== 'N/A' ? `• ${sup.phone}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Issue PO Button */}
                        <div className="pt-4 sm:pt-0">
                          <Button
                            size="sm"
                            disabled={isSaving || !selectedSupId}
                            onClick={() => handleIssuePO(categoryName, catMaterials)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 shadow-xs shrink-0"
                            icon={<ShoppingCart className="w-3.5 h-3.5" />}
                          >
                            {isSaving ? 'Issuing PO...' : `Issue PO (${catMaterials.length})`}
                          </Button>
                        </div>
                      </>
                    )}
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
  );
}
