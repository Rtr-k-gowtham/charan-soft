// frontend/src/components/buyer-products/ProductCuttingSizeForm.tsx
import React, { useState } from 'react';
import { ProductCuttingSize, ProductDimensions, DimensionUnit } from '../../types';
import FormField from '../ui/FormField';
import {
  Scissors,
  Ruler,
  FileText,
  Copy,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  cuttingSize: ProductCuttingSize;
  onChange: (size: ProductCuttingSize) => void;
  productDimensions?: ProductDimensions;
}

export default function ProductCuttingSizeForm({
  cuttingSize,
  onChange,
  productDimensions,
}: Props) {
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const updateField = (field: keyof ProductCuttingSize, value: any) => {
    onChange({ ...cuttingSize, [field]: value });
  };

  const handleUnitChange = (newUnit: DimensionUnit) => {
    updateField('unit', newUnit);
  };

  // Quick 1-click Copy from Finished Dimensions
  const handleCopyFinishedDimensions = () => {
    if (!productDimensions) return;
    const finL = Number(productDimensions.length || 0);
    const finW = Number(productDimensions.width || 0);
    const finH = Number(productDimensions.height || 0);

    onChange({
      ...cuttingSize,
      cutting_length: finL,
      cutting_width: finW,
      cutting_height: finH,
      unit: productDimensions.unit || cuttingSize.unit || 'cm',
    });

    setCopyMsg('Populated cutting dimensions from finished size.');
    setTimeout(() => setCopyMsg(null), 4000);
  };

  const finL = Number(productDimensions?.length || 0);
  const finW = Number(productDimensions?.width || 0);
  const finH = Number(productDimensions?.height || 0);

  const cutL = Number(cuttingSize.cutting_length || 0);
  const cutW = Number(cuttingSize.cutting_width || 0);
  const cutH = Number(cuttingSize.cutting_height || 0);

  const deltaL = Math.round((cutL - finL) * 10) / 10;
  const deltaW = Math.round((cutW - finW) * 10) / 10;
  const deltaH = Math.round((cutH - finH) * 10) / 10;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header & Quick Action Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-brand-50 border border-brand-200 text-brand-700 rounded-lg">
              <Scissors className="w-4 h-4 text-brand-600" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">
              Cutting Piece Dimensions & Notes
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              Cutting Spec
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Specify the pre-sewn fabric cutting dimensions (Length, Width, Height) and floor cutting notes.
          </p>
        </div>

        {/* Dimension Unit Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Unit:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            {(['cm', 'inch', 'mm', 'm'] as DimensionUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => handleUnitChange(u)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                  cuttingSize.unit === u
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Copy notification toast */}
      {copyMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{copyMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setCopyMsg(null)}
            className="text-xs text-emerald-600 hover:underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}


      {/* 3. Core Cutting Dimensions (Length, Width, Height) */}
      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-brand-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Cutting Piece Dimensions ({cuttingSize.unit || 'cm'})
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            Outer fabric cutting boundaries
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Cutting Length */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Cutting Length *
                </label>
                <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {cuttingSize.unit || 'cm'}
                </span>
              </div>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={cuttingSize.cutting_length || ''}
                onChange={(e) =>
                  updateField('cutting_length', parseFloat(e.target.value) || 0)
                }
                placeholder="e.g. 52.0"
                className="w-full px-3 py-2 text-sm font-mono font-bold text-slate-900 border border-slate-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
            </div>
            {finL > 0 && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Finished Length: {finL}</span>
                <span
                  className={`font-mono font-semibold ${
                    deltaL >= 0 ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {deltaL >= 0 ? `+${deltaL}` : deltaL} {cuttingSize.unit}
                </span>
              </div>
            )}
          </div>

          {/* Cutting Width */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Cutting Width *
                </label>
                <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {cuttingSize.unit || 'cm'}
                </span>
              </div>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={cuttingSize.cutting_width || ''}
                onChange={(e) =>
                  updateField('cutting_width', parseFloat(e.target.value) || 0)
                }
                placeholder="e.g. 52.0"
                className="w-full px-3 py-2 text-sm font-mono font-bold text-slate-900 border border-slate-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
            </div>
            {finW > 0 && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Finished Width: {finW}</span>
                <span
                  className={`font-mono font-semibold ${
                    deltaW >= 0 ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {deltaW >= 0 ? `+${deltaW}` : deltaW} {cuttingSize.unit}
                </span>
              </div>
            )}
          </div>

          {/* Cutting Height / Depth */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Cutting Height / Gusset
                </label>
                <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {cuttingSize.unit || 'cm'}
                </span>
              </div>
              <input
                type="number"
                step="0.1"
                min="0"
                value={cuttingSize.cutting_height || ''}
                onChange={(e) =>
                  updateField('cutting_height', parseFloat(e.target.value) || 0)
                }
                placeholder="0 if flat cut piece"
                className="w-full px-3 py-2 text-sm font-mono font-bold text-slate-900 border border-slate-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">
                {finH > 0 ? `Finished Height: ${finH}` : 'Flat item (0 height)'}
              </span>
              {finH > 0 && (
                <span
                  className={`font-mono font-semibold ${
                    deltaH >= 0 ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {deltaH >= 0 ? `+${deltaH}` : deltaH} {cuttingSize.unit}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Cutting Room Notes & Lay Instructions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
          <FileText className="w-4 h-4 text-brand-600" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            2. Cutting Room Notes & Lay Instructions
          </h4>
        </div>

        <FormField
          as="textarea"
          label="Marker Lay, Notch Points & Bundle Guidelines"
          value={cuttingSize.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="e.g. Ensure grain line follows lengthwise warp. Notch mark 1.5 cm from center top for neck alignment. Maximum lay height: 80 plies. Tie bundles in lots of 25 pcs with QA ticket."
          rows={4}
          hint="Special cutting operator guidance visible to the Cutting Department floor."
        />
      </div>
    </div>
  );
}
