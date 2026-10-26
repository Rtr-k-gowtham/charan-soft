// src/components/purchase/UnorderedBOMItemsSection.tsx
// Displays and tracks all BOM raw materials that have not yet been ordered or were partially ordered
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import FormField from '../ui/FormField';
import StatusBadge from '../ui/StatusBadge';
import {
  Package,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Tag,
  ArrowRight,
  Ban,
  RefreshCw,
  Search,
  Filter,
  Check,
  FileSpreadsheet,
  AlertCircle,
  Eye,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export interface UnorderedItem {
  id: string;
  production_order_id: number;
  production_order_number: string;
  production_order_title?: string;
  material_id?: number | null;
  material_code?: string | null;
  material_name: string;
  category_name?: string | null;
  category_id?: number | null;
  required_quantity: number;
  uom: string;
  supplier_id?: number | null;
  supplier_name?: string | null;
  supplier_code?: string | null;
  previously_ordered_quantity: number;
  remaining_unordered_quantity: number;
  unit_cost?: number;
  size?: string | null;
  model?: string | null;
  length?: string | null;
  thickness?: string | null;
  status: 'Unordered' | 'Partially Ordered' | 'Fully Ordered';
  po_numbers?: string[];
  excluded_from_po_number?: string | null;
  excluded_reason?: string | null;
  excluded_at?: string | null;
}

interface Props {
  productionOrderId?: number | string;
  productionOrderNumber?: string;
  onOrderMaterial?: (item: UnorderedItem) => void;
  onRefreshParent?: () => void;
  className?: string;
  compact?: boolean;
}

export default function UnorderedBOMItemsSection({
  productionOrderId,
  productionOrderNumber,
  onOrderMaterial,
  onRefreshParent,
  className = '',
  compact = false,
}: Props) {
  const [items, setItems] = useState<UnorderedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ALL' | 'EXCLUDED'>('PENDING');

  // Exclusion Modal State
  const [excludeItem, setExcludeItem] = useState<UnorderedItem | null>(null);
  const [excludeReason, setExcludeReason] = useState('Customer supplied / already available in inventory');
  const [savingExclusion, setSavingExclusion] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getUnorderedItems(productionOrderId);
      const list = Array.isArray(data) ? data : ((data as any)?.data || []);
      setItems(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load unordered BOM items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [productionOrderId]);

  // Derived Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(it => {
      if (it.category_name) set.add(it.category_name);
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      // Status Filter
      if (statusFilter === 'PENDING') {
        if (it.remaining_unordered_quantity <= 0.001) return false;
      } else if (statusFilter === 'EXCLUDED') {
        if (!it.excluded_reason) return false;
      }

      // Category Filter
      if (categoryFilter !== 'ALL' && (it.category_name || '').toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const mName = (it.material_name || '').toLowerCase();
        const mCat = (it.category_name || '').toLowerCase();
        const mSup = (it.supplier_name || '').toLowerCase();
        const mOrd = (it.production_order_number || '').toLowerCase();
        const mCode = (it.material_code || '').toLowerCase();
        return mName.includes(q) || mCat.includes(q) || mSup.includes(q) || mOrd.includes(q) || mCode.includes(q);
      }

      return true;
    });
  }, [items, search, categoryFilter, statusFilter]);

  // Metric Summaries
  const pendingItems = useMemo(() => items.filter(it => it.remaining_unordered_quantity > 0.001), [items]);
  const fullyOrderedCount = useMemo(() => items.filter(it => it.remaining_unordered_quantity <= 0.001).length, [items]);
  const totalRemainingUnits = useMemo(() => pendingItems.reduce((sum, it) => sum + (Number(it.remaining_unordered_quantity) || 0), 0), [pendingItems]);
  const totalEstimatedCost = useMemo(() => pendingItems.reduce((sum, it) => sum + ((Number(it.remaining_unordered_quantity) || 0) * (Number(it.unit_cost) || 0)), 0), [pendingItems]);

  const handleConfirmExclusion = async () => {
    if (!excludeItem) return;
    setSavingExclusion(true);
    try {
      await api.recordPoExcludedMaterials({
        production_order_id: excludeItem.production_order_id,
        materials: [{
          material_id: excludeItem.material_id,
          material_code: excludeItem.material_code,
          material_name: excludeItem.material_name,
          category_name: excludeItem.category_name,
          uom: excludeItem.uom,
          quantity: excludeItem.remaining_unordered_quantity,
          reason: excludeReason.trim() || 'Not required for this production order',
        }]
      });

      setActionSuccess(`Recorded "${excludeItem.material_name}" as excluded / not required.`);
      setExcludeItem(null);
      await fetchItems();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(err?.message || 'Failed to record exclusion');
    } finally {
      setSavingExclusion(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toast Notification */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-900 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">Dismiss</button>
        </div>
      )}

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending Materials</p>
            <p className="text-lg font-bold text-amber-600 mt-0.5 font-mono">
              {pendingItems.length}{' '}
              <span className="text-xs font-normal text-slate-400">items</span>
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Unordered Units</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5 font-mono">
              {totalRemainingUnits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Package className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Est. Pending Cost</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5 font-mono">
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalEstimatedCost)}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <ShoppingCart className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fully Ordered</p>
            <p className="text-lg font-bold text-emerald-600 mt-0.5 font-mono">
              {fullyOrderedCount}{' '}
              <span className="text-xs font-normal text-slate-400">lines</span>
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Tab Pills */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1 rounded-md transition ${statusFilter === 'PENDING' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Pending PO ({pendingItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-md transition ${statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All BOM Materials ({items.length})
            </button>
            <button
              onClick={() => setStatusFilter('EXCLUDED')}
              className={`px-3 py-1 rounded-md transition ${statusFilter === 'EXCLUDED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Excluded Notes
            </button>
          </div>

          {/* Category Dropdown */}
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:ring-1 focus:ring-brand-500"
            >
              <option value="ALL">All Categories ({categories.length})</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search material, code, vendor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchItems}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />
            <span className="text-xs font-semibold">Comparing Production BOM Requirements vs Issued POs...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 text-xs font-medium bg-rose-50 border-b border-rose-100 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/80 mb-1" />
            <span className="font-bold text-slate-700 text-sm">
              {statusFilter === 'PENDING'
                ? 'All Material Requirements are Fully Ordered!'
                : 'No materials found matching the search criteria.'}
            </span>
            <p className="text-slate-500 max-w-md">
              {statusFilter === 'PENDING'
                ? 'Every component in the Bill of Materials has a corresponding Purchase Order issued for the full required quantity.'
                : 'Try adjusting your category filter or search keywords.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  {!productionOrderId && (
                    <th className="py-2.5 px-3 w-36">Order #</th>
                  )}
                  <th className="py-2.5 px-3 min-w-[180px]">Material & Specifications</th>
                  <th className="py-2.5 px-3 w-28">Category</th>
                  <th className="py-2.5 px-3 w-36">Preferred Vendor</th>
                  <th className="py-2.5 px-3 text-right w-24">Required</th>
                  <th className="py-2.5 px-3 text-right w-24">Ordered</th>
                  <th className="py-2.5 px-3 text-right w-28 font-bold text-slate-800">Remaining</th>
                  <th className="py-2.5 px-3 text-center w-28">Status</th>
                  <th className="py-2.5 px-3 text-right w-36">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, idx) => {
                  const isPending = item.remaining_unordered_quantity > 0.001;
                  const hasPOs = item.po_numbers && item.po_numbers.length > 0;

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px] align-middle">
                        {idx + 1}
                      </td>

                      {!productionOrderId && (
                        <td className="py-2.5 px-3 align-middle font-mono font-bold text-xs text-brand-700">
                          {item.production_order_number}
                        </td>
                      )}

                      <td className="py-2.5 px-3 align-middle">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-xs">
                            {item.material_name}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {item.material_code && (
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded">
                                {item.material_code}
                              </span>
                            )}
                            {item.size && (
                              <span className="text-[10px] text-slate-600 bg-slate-100 px-1 py-0.2 rounded">
                                Size: {item.size}
                              </span>
                            )}
                            {item.model && (
                              <span className="text-[10px] text-slate-600 bg-slate-100 px-1 py-0.2 rounded">
                                Model: {item.model}
                              </span>
                            )}
                            {item.thickness && (
                              <span className="text-[10px] text-slate-600 bg-slate-100 px-1 py-0.2 rounded">
                                Thk: {item.thickness}
                              </span>
                            )}
                          </div>
                          {item.excluded_reason && (
                            <span className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded mt-1 inline-block">
                              <strong>Excluded Note:</strong> {item.excluded_reason}
                              {item.excluded_from_po_number ? ` (PO ${item.excluded_from_po_number})` : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 align-middle">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <Tag className="w-2.5 h-2.5 text-slate-400" />
                          {item.category_name || 'General'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 align-middle text-slate-700 font-medium">
                        {item.supplier_name ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[130px]" title={item.supplier_name}>
                              {item.supplier_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 align-middle">
                        {item.required_quantity} <span className="text-[10px] text-slate-400 font-sans">{item.uom}</span>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 align-middle">
                        <div>
                          <span>{item.previously_ordered_quantity}</span>
                          {hasPOs && (
                            <span className="block text-[9px] text-brand-600 font-sans truncate max-w-[90px]" title={item.po_numbers?.join(', ')}>
                              PO: {item.po_numbers?.join(', ')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold align-middle">
                        <span className={isPending ? 'text-rose-600 text-xs' : 'text-emerald-700 text-xs'}>
                          {item.remaining_unordered_quantity} <span className="text-[10px] font-sans font-normal text-slate-500">{item.uom}</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center align-middle whitespace-nowrap">
                        {item.remaining_unordered_quantity <= 0.001 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Fully Ordered
                          </span>
                        ) : item.previously_ordered_quantity > 0.001 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" /> Partially Ordered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <AlertCircle className="w-3 h-3 text-rose-600" /> Not Ordered
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right align-middle whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && onOrderMaterial && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="text-[11px] py-1 px-2.5"
                              onClick={() => onOrderMaterial(item)}
                              icon={<ShoppingCart className="w-3 h-3" />}
                            >
                              Issue PO
                            </Button>
                          )}

                          {isPending && (
                            <button
                              type="button"
                              onClick={() => {
                                setExcludeItem(item);
                                setExcludeReason('Customer supplied / already available in stock');
                              }}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition"
                              title="Mark as not required or excluded with reason"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Exclusion Reason Modal */}
      <Modal
        open={Boolean(excludeItem)}
        onClose={() => setExcludeItem(null)}
        title="Mark Material as Excluded / Not Required"
        subtitle={`Record reason why ${excludeItem?.material_name} (${excludeItem?.remaining_unordered_quantity} ${excludeItem?.uom}) does not require a Purchase Order.`}
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Material:</span>
              <strong className="text-slate-800">{excludeItem?.material_name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pending Qty:</span>
              <span className="font-mono font-bold text-rose-600">{excludeItem?.remaining_unordered_quantity} {excludeItem?.uom}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Order:</span>
              <span className="font-mono text-slate-700">{excludeItem?.production_order_number}</span>
            </div>
          </div>

          <FormField label="Exclusion / Waiver Reason" required>
            <textarea
              value={excludeReason}
              onChange={e => setExcludeReason(e.target.value)}
              placeholder="e.g. Buyer supplied fabric directly, Available from existing dead stock, Substituted by alternate component..."
              rows={3}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setExcludeItem(null)} disabled={savingExclusion}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmExclusion}
              loading={savingExclusion}
              icon={<Check className="w-3.5 h-3.5" />}
            >
              Confirm Exclusion
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
