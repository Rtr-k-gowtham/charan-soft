// frontend/src/components/buyer-products/ProductDimensionsForm.tsx
import React, { useEffect } from 'react';
import { ProductDimensions, DimensionUnit } from '../../types';
import FormField from '../ui/FormField';
import { Box, Layers, Weight } from 'lucide-react';

interface Props {
  dimensions: ProductDimensions;
  onChange: (dims: ProductDimensions) => void;
}

export const calculateVolume = (
  l: number,
  w: number,
  h: number,
  unit: DimensionUnit
): { cm3: number; m3: number } => {
  if (l <= 0 || w <= 0 || h <= 0) return { cm3: 0, m3: 0 };
  
  let factorToCm = 1;
  if (unit === 'mm') factorToCm = 0.1;
  else if (unit === 'm') factorToCm = 100;

  const lengthCm = l * factorToCm;
  const widthCm = w * factorToCm;
  const heightCm = h * factorToCm;

  const cm3 = Math.round(lengthCm * widthCm * heightCm * 100) / 100;
  const m3 = Math.round((cm3 / 1000000) * 10000) / 10000;

  return { cm3, m3 };
};

export default function ProductDimensionsForm({ dimensions, onChange }: Props) {
  const updateField = (field: keyof ProductDimensions, value: any) => {
    const updated = { ...dimensions, [field]: value };
    const { cm3, m3 } = calculateVolume(
      Number(updated.length || 0),
      Number(updated.width || 0),
      Number(updated.height || 0),
      updated.unit
    );
    onChange({
      ...updated,
      calculated_volume_cm3: cm3,
      calculated_volume_m3: m3,
    });
  };

  const handleUnitChange = (newUnit: DimensionUnit) => {
    const { cm3, m3 } = calculateVolume(
      Number(dimensions.length || 0),
      Number(dimensions.width || 0),
      Number(dimensions.height || 0),
      newUnit
    );
    onChange({
      ...dimensions,
      unit: newUnit,
      calculated_volume_cm3: cm3,
      calculated_volume_m3: m3,
    });
  };

  return (
    <div className="flex flex-col gap-4 bg-slate-50/70 border border-slate-200/80 rounded-xl p-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-brand-600" />
          <h4 className="text-xs font-semibold text-slate-800">Product Dimensions & Cubic Measurement</h4>
        </div>
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs">
          {(['mm', 'cm', 'm'] as DimensionUnit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => handleUnitChange(u)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                dimensions.unit === u
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <FormField
          label={`Length (${dimensions.unit})`}
          type="number"
          step="0.1"
          required
          value={dimensions.length || ''}
          onChange={(e) => updateField('length', parseFloat(e.target.value) || 0)}
          placeholder="e.g. 30"
        />
        <FormField
          label={`Width (${dimensions.unit})`}
          type="number"
          step="0.1"
          required
          value={dimensions.width || ''}
          onChange={(e) => updateField('width', parseFloat(e.target.value) || 0)}
          placeholder="e.g. 20"
        />
        <FormField
          label={`Height (${dimensions.unit})`}
          type="number"
          step="0.1"
          required
          value={dimensions.height || ''}
          onChange={(e) => updateField('height', parseFloat(e.target.value) || 0)}
          placeholder="e.g. 2"
        />
        <FormField
          label="Weight (grams, optional)"
          type="number"
          step="1"
          value={dimensions.weight_grams || ''}
          onChange={(e) => updateField('weight_grams', parseFloat(e.target.value) || undefined)}
          placeholder="e.g. 180"
        />
      </div>

      {/* Calculated Metrics Display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Calculated Volume</p>
              <p className="text-sm font-bold text-slate-800 font-mono">
                {dimensions.calculated_volume_cm3?.toLocaleString() || 0} <span className="text-xs font-normal text-slate-500">cm³</span>
              </p>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {dimensions.length || 0} × {dimensions.width || 0} × {dimensions.height || 0} {dimensions.unit}
          </span>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Cubic Meter (CBM)</p>
              <p className="text-sm font-bold text-purple-700 font-mono">
                {dimensions.calculated_volume_m3 || 0} <span className="text-xs font-normal text-slate-500">m³</span>
              </p>
            </div>
          </div>
          <span className="text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded font-medium">
            Volumetric Std
          </span>
        </div>
      </div>
    </div>
  );
}
