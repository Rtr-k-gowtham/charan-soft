// frontend/src/components/buyer-products/RawMaterialsTable.tsx
import React, { useState, useEffect } from 'react';
import { BuyerProductComponent } from '../../types';
import { api } from '../../lib/api';
import Button from '../ui/Button';
import { Plus, Trash2, Copy, Calculator, Layers, RefreshCw } from 'lucide-react';

interface Props {
  components: BuyerProductComponent[];
  onChange: (comps: BuyerProductComponent[]) => void;
}

interface CategoryOption {
  id?: number;
  name: string;
  code?: string;
  type?: string;
}

const COMMON_UOMS = ['Meter', 'Kilogram', 'Piece', 'Set', 'Cone', 'Yard', 'Roll', 'Dozen'];

export default function RawMaterialsTable({ components, onChange }: Props) {
  const [plannedQty, setPlannedQty] = useState<number>(100);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);

  // Fetch categories strictly from /masters/categories
  const loadCategories = async () => {
    setLoadingCats(true);
    try {
      const res = await api.getCategories();
      const rawList = Array.isArray(res) ? res : (res as any)?.data || [];
      const fetched: CategoryOption[] = (rawList as any[]).map((c: any) => ({
        id: c.id,
        name: c.name || c.category_name || String(c),
        code: c.code,
        type: c.type,
      }));
      setCategories(fetched);
    } catch (err) {
      console.warn('Failed to load categories from /masters/categories', err);
      setCategories([]);
    } finally {
      setLoadingCats(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const addRow = () => {
    const firstCat = categories[0]?.name || '';
    const newComp: BuyerProductComponent = {
      id: 'c_' + Date.now() + Math.random().toString(36).substring(2, 5),
      name: '',
      category_id: categories[0]?.id,
      category: firstCat,
      uom: 'Meter',
      quantity_per_product: 1,
      notes: '',
    };
    onChange([...components, newComp]);
  };

  const removeRow = (id: string) => {
    onChange(components.filter((c) => c.id !== id));
  };

  const duplicateRow = (comp: BuyerProductComponent) => {
    const dup: BuyerProductComponent = {
      ...comp,
      id: 'c_' + Date.now() + Math.random().toString(36).substring(2, 5),
      name: comp.name ? `${comp.name} (Copy)` : '',
    };
    onChange([...components, dup]);
  };

  const updateRow = (id: string, field: keyof BuyerProductComponent, value: any) => {
    onChange(
      components.map((c) => {
        if (c.id !== id) return c;
        if (field === 'category') {
          const matched = categories.find((cat) => cat.name === value);
          return {
            ...c,
            category: value,
            category_id: matched?.id || c.category_id,
          };
        }
        return { ...c, [field]: value };
      })
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div>
          <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-brand-600" />
            Raw Materials & Components (Bill of Materials)
          </h4>
          <p className="text-[11px] text-slate-500">
            Define fabrics, trims, and packaging items needed per 1 finished unit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadCategories}
            disabled={loadingCats}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-brand-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition cursor-pointer"
            title="Refresh categories from Category Master"
          >
            <RefreshCw className={`w-3 h-3 ${loadingCats ? 'animate-spin' : ''}`} />
            <span>Sync Categories</span>
          </button>
          <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addRow}>
            Add Material / Component
          </Button>
        </div>
      </div>

      {/* Components Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-2xs">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 min-w-[200px]">Component Name *</th>
              <th className="py-2.5 px-2.5 min-w-[140px]">Category</th>
              <th className="py-2.5 px-2.5 min-w-[95px]">UOM</th>
              <th className="py-2.5 px-2.5 min-w-[110px]">Qty / Unit *</th>
              <th className="py-2.5 px-2.5 min-w-[160px]">Notes</th>
              <th className="py-2.5 px-2 text-center w-16">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {components.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  <p className="text-xs">No components defined yet.</p>
                  <button
                    type="button"
                    onClick={addRow}
                    className="mt-2 text-brand-600 font-medium text-xs hover:underline cursor-pointer"
                  >
                    + Click here to add the first raw material or trim
                  </button>
                </td>
              </tr>
            ) : (
              components.map((comp) => {
                // Combine categories with comp.category if it has an existing custom value
                const options = [...categories];
                if (
                  comp.category &&
                  !options.some((c) => c.name.toLowerCase() === comp.category.toLowerCase())
                ) {
                  options.push({ name: comp.category, id: comp.category_id });
                }

                return (
                  <tr key={comp.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Name */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        required
                        placeholder="e.g. 100% Cotton Fabric / Sewing Thread"
                        value={comp.name}
                        onChange={(e) => updateRow(comp.id, 'name', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                      />
                    </td>

                    {/* Category - Dynamic from /masters/categories only */}
                    <td className="py-2 px-2.5">
                      <select
                        value={comp.category}
                        onChange={(e) => updateRow(comp.id, 'category', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:border-brand-500 outline-none"
                      >
                        {options.length === 0 && (
                          <option value="">No categories in Category Master</option>
                        )}
                        {options.map((c, idx) => (
                          <option key={c.id ?? c.name ?? idx} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* UOM */}
                    <td className="py-2 px-2.5">
                      <select
                        value={comp.uom}
                        onChange={(e) => updateRow(comp.id, 'uom', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:border-brand-500 outline-none"
                      >
                        {COMMON_UOMS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Qty per Product */}
                    <td className="py-2 px-2.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0.0001"
                        required
                        value={comp.quantity_per_product || ''}
                        onChange={(e) =>
                          updateRow(comp.id, 'quantity_per_product', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono font-medium focus:border-brand-500 outline-none text-right"
                      />
                    </td>

                    {/* Notes */}
                    <td className="py-2 px-2.5">
                      <input
                        type="text"
                        placeholder="e.g. Body & sleeves / Trims"
                        value={comp.notes || ''}
                        onChange={(e) => updateRow(comp.id, 'notes', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:border-brand-500 outline-none text-slate-600"
                      />
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => duplicateRow(comp)}
                          title="Duplicate row"
                          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(comp.id)}
                          title="Remove row"
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Planned Order Quantity Simulation Card */}
      {components.length > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-brand-50/50 via-slate-50 to-emerald-50/40 border border-slate-200 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-brand-600" />
              <div>
                <h5 className="text-xs font-semibold text-slate-800">
                  Live Planned Raw Material Requirement Calculator
                </h5>
                <p className="text-[11px] text-slate-500">
                  Automatically scales BOM consumption based on finished-goods target quantity
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
                Planned Order Qty:
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={plannedQty || ''}
                onChange={(e) => setPlannedQty(parseInt(e.target.value) || 0)}
                className="w-20 px-2 py-0.5 text-xs font-mono font-bold text-brand-700 border border-slate-200 rounded text-right outline-none focus:border-brand-500"
              />
              <span className="text-xs text-slate-500 font-medium">units</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
            {components
              .filter((c) => c.name.trim())
              .map((comp) => {
                const total = (comp.quantity_per_product || 0) * (plannedQty || 0);
                return (
                  <div
                    key={comp.id}
                    className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[160px]">
                        {comp.name}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {comp.category || 'No category'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between pt-1 border-t border-slate-100">
                      <div className="text-[10px] text-slate-400">
                        Total Req:
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-brand-700 font-mono">
                          {total.toFixed(2)}
                        </span>{' '}
                        <span className="text-[10px] font-medium text-slate-500">{comp.uom}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
