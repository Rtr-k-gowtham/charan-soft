// frontend/src/components/buyer-products/BoxConfigSection.tsx
import React, { useState } from 'react';
import { BoxPackingConfig, DimensionUnit, ProductDimensions } from '../../types';
import { calculateVolume } from './ProductDimensionsForm';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { Package, Plus, Trash2, Box, Info, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  boxes: BoxPackingConfig[];
  onChange: (boxes: BoxPackingConfig[]) => void;
  productDimensions: ProductDimensions;
}

export default function BoxConfigSection({ boxes, onChange, productDimensions }: Props) {
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number>(0);
  const [testOrderQty, setTestOrderQty] = useState<number>(1000);

  const addBox = () => {
    const newBox: BoxPackingConfig = {
      id: 'box_' + Date.now() + Math.random().toString(36).substring(2, 5),
      box_name: `Export Box ${boxes.length + 1}`,
      box_code: `BOX-${String(boxes.length + 1).padStart(3, '0')}`,
      length: 60,
      width: 40,
      height: 40,
      dimension_unit: 'cm',
      calculated_volume_cm3: 96000,
      calculated_volume_m3: 0.096,
      items_per_box: 20,
      max_packing_qty: 25,
      notes: 'Standard 5-ply export carton',
    };
    onChange([...boxes, newBox]);
    setSelectedBoxIndex(boxes.length);
  };

  const removeBox = (index: number) => {
    const updated = boxes.filter((_, i) => i !== index);
    onChange(updated);
    if (selectedBoxIndex >= updated.length) {
      setSelectedBoxIndex(Math.max(0, updated.length - 1));
    }
  };

  const updateBox = (index: number, field: keyof BoxPackingConfig, value: any) => {
    const box = boxes[index];
    const updatedBox = { ...box, [field]: value };
    
    // Auto recalculate box volume when dimensions or unit change
    if (['length', 'width', 'height', 'dimension_unit'].includes(field)) {
      const { cm3, m3 } = calculateVolume(
        Number(updatedBox.length || 0),
        Number(updatedBox.width || 0),
        Number(updatedBox.height || 0),
        updatedBox.dimension_unit
      );
      updatedBox.calculated_volume_cm3 = cm3;
      updatedBox.calculated_volume_m3 = m3;
    }

    const updatedList = [...boxes];
    updatedList[index] = updatedBox;
    onChange(updatedList);
  };

  const activeBox = boxes[selectedBoxIndex];

  // Volumetric fill estimate calculation
  const productVolCm3 = productDimensions?.calculated_volume_cm3 || 0;
  const boxVolCm3 = activeBox?.calculated_volume_cm3 || 0;
  const itemsPerBox = activeBox?.items_per_box || 1;
  const totalProductVolCm3 = productVolCm3 * itemsPerBox;
  const volumetricFillPercent = boxVolCm3 > 0
    ? Math.min(100, Math.round((totalProductVolCm3 / boxVolCm3) * 100))
    : 0;

  // Live Packing Simulator Calculations
  const orderQty = Math.max(0, testOrderQty || 0);
  const totalBoxesRequired = itemsPerBox > 0 ? Math.ceil(orderQty / itemsPerBox) : 0;
  const fullBoxesCount = itemsPerBox > 0 ? Math.floor(orderQty / itemsPerBox) : 0;
  const itemsInFinalBox = orderQty > 0 && itemsPerBox > 0
    ? (orderQty % itemsPerBox === 0 ? itemsPerBox : orderQty % itemsPerBox)
    : 0;
  const emptySlotsInFinalBox = itemsInFinalBox > 0 ? itemsPerBox - itemsInFinalBox : 0;
  const totalShipmentCbm = activeBox ? ((totalBoxesRequired * (activeBox.calculated_volume_m3 || 0))).toFixed(3) : '0';

  return (
    <div className="flex flex-col gap-5">
      {/* Header and Box tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div>
          <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-brand-600" />
            Box Master & Packing Configuration
          </h4>
          <p className="text-[11px] text-slate-500">
            Define container box dimensions, authoritative items per box, and live shipment packing plans
          </p>
        </div>
        <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addBox}>
          Add Box Type
        </Button>
      </div>

      {boxes.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
          <Box className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-600 font-medium">No box configurations defined for this product</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Create standard carton sizes (e.g. Small, Medium Export Box, Large Master Shipper)
          </p>
          <Button size="sm" className="mt-3" icon={<Plus className="w-3.5 h-3.5" />} onClick={addBox}>
            Create Box Configuration
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Box Tabs Selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {boxes.map((b, idx) => (
              <div
                key={b.id || idx}
                onClick={() => setSelectedBoxIndex(idx)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition flex items-center gap-2 shrink-0 ${
                  selectedBoxIndex === idx
                    ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{b.box_name || `Box #${idx + 1}`}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    selectedBoxIndex === idx ? 'bg-brand-700/60 text-brand-100' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {b.items_per_box} pcs/box
                </span>
                {boxes.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBox(idx);
                    }}
                    className={`p-0.5 rounded hover:text-red-400 transition ${
                      selectedBoxIndex === idx ? 'hover:bg-brand-700' : 'hover:bg-slate-100'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Active Box Configuration Form */}
          {activeBox && (
            <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <FormField
                  label="Box Name *"
                  required
                  value={activeBox.box_name}
                  onChange={(e) => updateBox(selectedBoxIndex, 'box_name', e.target.value)}
                  placeholder="e.g. Medium Export Carton"
                />
                <FormField
                  label="Box Code"
                  value={activeBox.box_code || ''}
                  onChange={(e) => updateBox(selectedBoxIndex, 'box_code', e.target.value)}
                  placeholder="e.g. BOX-EXP-M"
                />
                <FormField
                  label="Items per Box (Authoritative) *"
                  type="number"
                  min="1"
                  required
                  value={activeBox.items_per_box}
                  onChange={(e) =>
                    updateBox(selectedBoxIndex, 'items_per_box', Math.max(1, parseInt(e.target.value) || 1))
                  }
                  hint="Admin-defined packaging capacity"
                />
                <FormField
                  label="Max Packing Qty (Optional)"
                  type="number"
                  value={activeBox.max_packing_qty || ''}
                  onChange={(e) =>
                    updateBox(selectedBoxIndex, 'max_packing_qty', parseInt(e.target.value) || undefined)
                  }
                  placeholder="e.g. 24"
                />
              </div>

              {/* Dimensions Input Row */}
              <div className="pt-2 border-t border-slate-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-700">Outer Box Dimensions</span>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs">
                    {(['mm', 'cm', 'm'] as DimensionUnit[]).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => updateBox(selectedBoxIndex, 'dimension_unit', u)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                          activeBox.dimension_unit === u
                            ? 'bg-brand-600 text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField
                    label={`Box Length (${activeBox.dimension_unit})`}
                    type="number"
                    step="0.1"
                    value={activeBox.length || ''}
                    onChange={(e) => updateBox(selectedBoxIndex, 'length', parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 60"
                  />
                  <FormField
                    label={`Box Width (${activeBox.dimension_unit})`}
                    type="number"
                    step="0.1"
                    value={activeBox.width || ''}
                    onChange={(e) => updateBox(selectedBoxIndex, 'width', parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 40"
                  />
                  <FormField
                    label={`Box Height (${activeBox.dimension_unit})`}
                    type="number"
                    step="0.1"
                    value={activeBox.height || ''}
                    onChange={(e) => updateBox(selectedBoxIndex, 'height', parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 40"
                  />
                </div>
              </div>

              {/* Box Volumetric Summary & Fill Efficiency */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Box Volume</span>
                  <p className="text-xs font-bold text-slate-800 font-mono mt-0.5">
                    {activeBox.calculated_volume_cm3?.toLocaleString() || 0} cm³
                  </p>
                  <p className="text-[10px] text-purple-600 font-mono">
                    {activeBox.calculated_volume_m3 || 0} m³ (CBM)
                  </p>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Authoritative Capacity</span>
                  <p className="text-xs font-bold text-brand-700 font-mono mt-0.5">
                    {activeBox.items_per_box} pieces / box
                  </p>
                  <p className="text-[10px] text-slate-400">Folded & stacked unit rule</p>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Est. Volumetric Fill</span>
                    <span className="text-[10px] font-bold font-mono text-emerald-600">{volumetricFillPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${volumetricFillPercent}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">Estimate for orientation & stacking clearance</p>
                </div>
              </div>

              {/* Box Notes */}
              <FormField
                label="Packing Notes / Stacking Instructions"
                value={activeBox.notes || ''}
                onChange={(e) => updateBox(selectedBoxIndex, 'notes', e.target.value)}
                placeholder="e.g. Fold flat with tissue paper, 5 garments per poly-bundle layer"
              />
            </div>
          )}

          {/* Section 6: Live Packing Summary & Simulator */}
          {activeBox && (
            <div className="p-4 bg-gradient-to-br from-brand-50/40 via-white to-blue-50/30 border border-brand-200/80 rounded-xl shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-brand-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">
                      Live Order & Packing Simulator (Ceiling Formula)
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      Instantly calculate exact carton count, loose item distribution, and container CBM
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs self-start sm:self-auto">
                  <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Order Qty:</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={testOrderQty || ''}
                    onChange={(e) => setTestOrderQty(parseInt(e.target.value) || 0)}
                    className="w-24 px-2 py-0.5 text-xs font-mono font-bold text-brand-700 border border-slate-300 rounded text-right outline-none focus:border-brand-500"
                  />
                  <span className="text-xs text-slate-500 font-medium">pcs</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {/* 1. Total Boxes Required */}
                <div className="p-3 bg-white rounded-lg border border-brand-200/70 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-brand-700">Total Boxes Required</span>
                  <p className="text-xl font-extrabold text-brand-800 font-mono mt-1">
                    {totalBoxesRequired} <span className="text-xs font-medium text-slate-500">boxes</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    ⌈ {orderQty} ÷ {itemsPerBox} ⌉
                  </p>
                </div>

                {/* 2. Full Standard Boxes */}
                <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Full Standard Boxes</span>
                  <p className="text-xl font-extrabold text-slate-800 font-mono mt-1">
                    {fullBoxesCount} <span className="text-xs font-medium text-slate-500">boxes</span>
                  </p>
                  <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                    {fullBoxesCount * itemsPerBox} pcs packed fully
                  </p>
                </div>

                {/* 3. Final / Partial Box Contents */}
                <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Final Box Contents</span>
                  <p className="text-xl font-extrabold text-slate-800 font-mono mt-1">
                    {itemsInFinalBox} <span className="text-xs font-medium text-slate-500">pcs</span>
                  </p>
                  {emptySlotsInFinalBox > 0 ? (
                    <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                      {emptySlotsInFinalBox} empty slots in last box
                    </p>
                  ) : (
                    <p className="text-[10px] text-emerald-600 font-medium mt-0.5">100% full final box</p>
                  )}
                </div>

                {/* 4. Total Shipment Volume CBM */}
                <div className="p-3 bg-white rounded-lg border border-purple-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-purple-700">Total Shipment Volume</span>
                  <p className="text-xl font-extrabold text-purple-800 font-mono mt-1">
                    {totalShipmentCbm} <span className="text-xs font-medium text-slate-500">m³</span>
                  </p>
                  <p className="text-[10px] text-purple-600 mt-0.5">
                    {totalBoxesRequired} × {activeBox.calculated_volume_m3 || 0} CBM
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
