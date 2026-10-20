// frontend/src/components/buyer-products/RawMaterialsTable.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BuyerProductComponent, Material } from '../../types';
import { api } from '../../lib/api';
import Button from '../ui/Button';
import SearchableSelect, { SelectOption } from '../ui/SearchableSelect';
import { Plus, Trash2, Copy, Calculator, Layers, RefreshCw, AlertCircle, Info, Lock } from 'lucide-react';

interface Props {
  components: BuyerProductComponent[];
  onChange: (comps: BuyerProductComponent[]) => void;
}

export default function RawMaterialsTable({ components, onChange }: Props) {
  const [plannedQty, setPlannedQty] = useState<number>(100);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);

  // Load materials from existing Material Master API
  const loadMaterials = useCallback(async () => {
    setLoadingMaterials(true);
    setMaterialsError(null);
    try {
      const res = await api.getMaterials();
      const rawList = Array.isArray(res) ? res : (res as any)?.data || [];
      setMaterials(rawList as Material[]);
    } catch (err: any) {
      console.error('Failed to load materials from Material Master', err);
      setMaterialsError(err?.message || 'Failed to load materials from Material Master');
      setMaterials([]);
    } finally {
      setLoadingMaterials(false);
    }
  }, []);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  // Map Material Master items into SelectOption format
  const materialOptions: SelectOption[] = useMemo(() => {
    return materials.map((m) => ({
      value: String(m.id),
      label: m.name,
      sublabel: `${m.code}${m.uom ? ` • ${m.uom}` : ''}`,
      group: m.category_name || 'General Material',
    }));
  }, [materials]);

  // Build row options ensuring any previously saved custom/legacy material is preserved in the dropdown trigger
  const getRowOptions = useCallback(
    (comp: BuyerProductComponent): SelectOption[] => {
      const currentVal = comp.material_id ? String(comp.material_id) : '';
      const exists = materialOptions.some(
        (opt) =>
          (currentVal && String(opt.value) === currentVal) ||
          (comp.name && opt.label.toLowerCase() === comp.name.toLowerCase())
      );

      if (exists || (!comp.name && !comp.material_id)) {
        return materialOptions;
      }

      // If legacy row has a name not currently in the material options, add it as a fallback option
      return [
        ...materialOptions,
        {
          value: currentVal || `custom_${comp.name}`,
          label: comp.name,
          sublabel: 'Previously saved item',
          group: comp.category || 'Legacy / Custom',
        },
      ];
    },
    [materialOptions]
  );

  // Add new empty row
  const addRow = () => {
    const newComp: BuyerProductComponent = {
      id: 'c_' + Date.now() + Math.random().toString(36).substring(2, 5),
      material_id: undefined,
      name: '',
      category_id: undefined,
      category: '',
      uom: '',
      size: '',
      model: '',
      length: '',
      thickness: '',
      quantity_per_product: 1,
      notes: '',
    };
    onChange([...components, newComp]);
  };

  // Remove row
  const removeRow = (id: string) => {
    onChange(components.filter((c) => c.id !== id));
  };

  // Duplicate row preserving values
  const duplicateRow = (comp: BuyerProductComponent) => {
    const dup: BuyerProductComponent = {
      ...comp,
      id: 'c_' + Date.now() + Math.random().toString(36).substring(2, 5),
    };
    onChange([...components, dup]);
  };

  // When a material is selected from the dropdown: auto-populate Category and UOM
  const handleMaterialSelect = (rowId: string, selectedValue: string) => {
    if (!selectedValue) {
      // User cleared the material selection: reset Category and UOM
      onChange(
        components.map((c) => {
          if (c.id !== rowId) return c;
          return {
            ...c,
            material_id: undefined,
            name: '',
            category_id: undefined,
            category: '',
            uom: '',
          };
        })
      );
      return;
    }

    const selectedMatId = Number(selectedValue);
    const matched = materials.find((m) => m.id === selectedMatId);

    if (matched) {
      onChange(
        components.map((c) => {
          if (c.id !== rowId) return c;
          return {
            ...c,
            material_id: matched.id,
            name: matched.name,
            category_id: matched.category_id || undefined,
            category: matched.category_name || (matched.category_id ? `Category #${matched.category_id}` : 'General Material'),
            uom: matched.uom || 'Meter',
          };
        })
      );
    } else {
      // If selected by custom label / fallback
      const fallbackOpt = materialOptions.find((o) => String(o.value) === selectedValue);
      if (fallbackOpt) {
        onChange(
          components.map((c) => {
            if (c.id !== rowId) return c;
            return {
              ...c,
              material_id: Number(fallbackOpt.value) || undefined,
              name: fallbackOpt.label,
            };
          })
        );
      }
    }
  };

  // Update non-material fields (size, model, length, thickness, quantity, notes)
  const updateField = (
    id: string,
    field: 'size' | 'model' | 'length' | 'thickness' | 'quantity_per_product' | 'notes',
    value: any
  ) => {
    onChange(
      components.map((c) => {
        if (c.id !== id) return c;
        return { ...c, [field]: value };
      })
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header with Title and Sync Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div>
          <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-brand-600" />
            Raw Materials & Components (Bill of Materials)
          </h4>
          <p className="text-[11px] text-slate-500">
            Select materials from the Material Master. Category and UOM will automatically populate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadMaterials}
            disabled={loadingMaterials}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-brand-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition cursor-pointer"
            title="Refresh material list from Material Master"
          >
            <RefreshCw className={`w-3 h-3 ${loadingMaterials ? 'animate-spin' : ''}`} />
            <span>{loadingMaterials ? 'Syncing...' : 'Sync Materials'}</span>
          </button>
          <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addRow}>
            Add Material / Component
          </Button>
        </div>
      </div>

      {/* Materials API Error Notification with Retry */}
      {materialsError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>
              <strong>Material Master Error:</strong> {materialsError}
            </span>
          </div>
          <button
            type="button"
            onClick={loadMaterials}
            className="px-2.5 py-1 bg-white border border-red-200 text-red-700 hover:bg-red-50 rounded text-xs font-semibold transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Components Table - Fixed Layout, No Horizontal Scroll */}
      <div className="w-full border border-slate-200 rounded-lg bg-white shadow-2xs overflow-hidden">
        <table className="w-full table-fixed text-xs text-left">
          <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 w-[25%]">Material Name *</th>
              <th className="py-2.5 px-2 w-[13%]">Category (Auto)</th>
              <th className="py-2.5 px-1.5 w-[6%] text-center">UOM</th>
              <th className="py-2.5 px-1.5 w-[8%]">Size</th>
              <th className="py-2.5 px-1.5 w-[8.5%]">Model</th>
              <th className="py-2.5 px-1.5 w-[8%]">Length</th>
              <th className="py-2.5 px-1.5 w-[8%]">Thickness</th>
              <th className="py-2.5 px-1.5 w-[8%] text-right">Qty / Unit *</th>
              <th className="py-2.5 px-2 w-[11.5%]">Notes</th>
              <th className="py-2.5 px-1.5 text-center w-[4%]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {components.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-400">
                  <p className="text-xs">No materials or components added to this BOM yet.</p>
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
              components.map((comp, idx) => {
                const rowOptions = getRowOptions(comp);
                // Determine selected value: match material_id or by exact material name
                let selectedVal = comp.material_id ? String(comp.material_id) : '';
                if (!selectedVal && comp.name) {
                  const foundByName = materials.find((m) => m.name.toLowerCase() === comp.name.toLowerCase());
                  if (foundByName) {
                    selectedVal = String(foundByName.id);
                  } else {
                    selectedVal = `custom_${comp.name}`;
                  }
                }

                return (
                  <tr key={comp.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Material Name: Searchable Dropdown */}
                    <td className="py-2 px-2.5 align-middle">
                      <SearchableSelect
                        value={selectedVal}
                        onChange={(val) => handleMaterialSelect(comp.id, val)}
                        options={rowOptions}
                        placeholder={
                          loadingMaterials
                            ? 'Loading...'
                            : '— Select Material —'
                        }
                        searchPlaceholder="Search material by name, code or UOM..."
                        disabled={loadingMaterials}
                        clearable={true}
                      />
                    </td>

                    {/* Category: Read-only auto-populated field */}
                    <td className="py-2 px-1.5 align-middle">
                      <div
                        className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200/90 rounded text-slate-700 flex items-center justify-between min-h-[34px] min-w-0 cursor-not-allowed select-none"
                        title={
                          comp.category
                            ? `Category: ${comp.category} (Automatically populated from Material Master)`
                            : 'Select a material to automatically set category'
                        }
                      >
                        <span className="truncate font-medium text-[11px]">
                          {comp.category ? (
                            comp.category
                          ) : comp.material_id ? (
                            <span className="text-amber-600 font-normal italic text-[11px]">
                              None
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal italic text-[11px]">
                              Auto
                            </span>
                          )}
                        </span>
                        <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0 ml-1" />
                      </div>
                    </td>

                    {/* UOM: Read-only auto-populated field */}
                    <td className="py-2 px-1 align-middle">
                      <div
                        className="w-full px-1 py-1.5 text-xs bg-slate-50 border border-slate-200/90 rounded text-slate-700 flex items-center justify-center min-h-[34px] min-w-0 cursor-not-allowed select-none"
                        title={
                          comp.uom
                            ? `Unit of Measurement: ${comp.uom} (Auto populated)`
                            : 'Select material to auto set UOM'
                        }
                      >
                        <span className="truncate font-mono font-bold text-[11px] text-slate-700">
                          {comp.uom || (comp.material_id ? '—' : '—')}
                        </span>
                      </div>
                    </td>

                    {/* Size: Editable text input */}
                    <td className="py-2 px-1 align-middle">
                      <input
                        type="text"
                        placeholder="Size"
                        value={comp.size || ''}
                        onChange={(e) => updateField(comp.id, 'size', e.target.value)}
                        className="w-full min-w-0 px-2 py-1.5 text-xs border border-slate-200 rounded focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-slate-700 bg-white"
                      />
                    </td>

                    {/* Model: Editable text input */}
                    <td className="py-2 px-1 align-middle">
                      <input
                        type="text"
                        placeholder="Model"
                        value={comp.model || ''}
                        onChange={(e) => updateField(comp.id, 'model', e.target.value)}
                        className="w-full min-w-0 px-2 py-1.5 text-xs border border-slate-200 rounded focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-slate-700 bg-white"
                      />
                    </td>

                    {/* Length: Editable text input */}
                    <td className="py-2 px-1 align-middle">
                      <input
                        type="text"
                        placeholder="Length"
                        value={comp.length || ''}
                        onChange={(e) => updateField(comp.id, 'length', e.target.value)}
                        className="w-full min-w-0 px-2 py-1.5 text-xs border border-slate-200 rounded focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-slate-700 bg-white"
                      />
                    </td>

                    {/* Thickness: Editable text input */}
                    <td className="py-2 px-1 align-middle">
                      <input
                        type="text"
                        placeholder="Thick"
                        value={comp.thickness || ''}
                        onChange={(e) => updateField(comp.id, 'thickness', e.target.value)}
                        className="w-full min-w-0 px-2 py-1.5 text-xs border border-slate-200 rounded focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-slate-700 bg-white"
                      />
                    </td>

                    {/* Qty per Product: Editable numeric input */}
                    <td className="py-2 px-1 align-middle">
                      <input
                        type="number"
                        step="0.001"
                        min="0.0001"
                        required
                        value={comp.quantity_per_product ?? ''}
                        onChange={(e) =>
                          updateField(
                            comp.id,
                            'quantity_per_product',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="1.00"
                        className="w-full min-w-0 px-2 py-1.5 text-xs border border-slate-200 rounded font-mono font-medium focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-right bg-white"
                      />
                    </td>

                    {/* Notes: Editable text input */}
                    <td className="py-2 px-1.5 align-middle">
                      <input
                        type="text"
                        placeholder="Placement / notes"
                        value={comp.notes || ''}
                        onChange={(e) => updateField(comp.id, 'notes', e.target.value)}
                        className="w-full min-w-0 px-2 py-1.5 text-xs border border-slate-200 rounded focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-slate-600 bg-white"
                      />
                    </td>

                    {/* Actions: Duplicate & Delete */}
                    <td className="py-2 px-1 text-center align-middle">
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

      {/* Planned Order Quantity Simulation Card (Live Calculator) */}
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
              .filter((c) => c.name.trim() || c.material_id)
              .map((comp) => {
                const total = (comp.quantity_per_product || 0) * (plannedQty || 0);
                return (
                  <div
                    key={comp.id}
                    className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[160px]">
                        {comp.name || 'Selected Material'}
                      </span>
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                        {comp.category || 'No category'}
                      </span>
                    </div>
                    {(comp.size || comp.model || comp.length || comp.thickness) ? (
                      <div className="flex flex-wrap gap-1 mt-1 text-[9px] text-slate-500">
                        {comp.size ? <span className="bg-slate-50 border border-slate-200 px-1 py-0.2 rounded font-mono">Size: {comp.size}</span> : null}
                        {comp.model ? <span className="bg-slate-50 border border-slate-200 px-1 py-0.2 rounded font-mono">Mod: {comp.model}</span> : null}
                        {comp.length ? <span className="bg-slate-50 border border-slate-200 px-1 py-0.2 rounded font-mono">Len: {comp.length}</span> : null}
                        {comp.thickness ? <span className="bg-slate-50 border border-slate-200 px-1 py-0.2 rounded font-mono">Thk: {comp.thickness}</span> : null}
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-baseline justify-between pt-1 border-t border-slate-100">
                      <div className="text-[10px] text-slate-400">Total Req:</div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-brand-700 font-mono">
                          {total.toFixed(2)}
                        </span>{' '}
                        <span className="text-[10px] font-medium text-slate-500">
                          {comp.uom || 'units'}
                        </span>
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
