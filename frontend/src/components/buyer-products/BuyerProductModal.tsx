// frontend/src/components/buyer-products/BuyerProductModal.tsx
import React, { useState, useEffect } from 'react';
import {
  BuyerProduct,
  BuyerProductComponent,
  BoxPackingConfig,
  ProductDimensions,
  ProductCuttingSize,
} from '../../types';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import ProductImageUploader from './ProductImageUploader';
import ProductDimensionsForm from './ProductDimensionsForm';
import RawMaterialsTable from './RawMaterialsTable';
import BoxConfigSection from './BoxConfigSection';
import ProductCuttingSizeForm from './ProductCuttingSizeForm';
import {
  Layers,
  Package,
  Ruler,
  Scissors,
  FileText,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  buyerId: number;
  buyerName: string;
  initialProduct?: BuyerProduct | null;
  onSave: (product: Partial<BuyerProduct>) => Promise<void>;
}

type TabId = 'general' | 'bom' | 'dimensions' | 'boxes' | 'cutting';

const COMMON_UOMS = ['Pieces', 'Sets', 'Pairs', 'Dozens', 'Rolls'];

const defaultDimensions: ProductDimensions = {
  length: 30,
  width: 20,
  height: 2,
  unit: 'cm',
  calculated_volume_cm3: 1200,
  calculated_volume_m3: 0.0012,
  weight_grams: 180,
};

const defaultCuttingSize: ProductCuttingSize = {
  cutting_length: 34,
  cutting_width: 24,
  cutting_height: 2,
  unit: 'cm',
  notes: '',
};

const defaultBoxes: BoxPackingConfig[] = [
  {
    id: 'box_def_1',
    box_name: 'Medium Export Carton',
    box_code: 'BOX-EXP-M',
    length: 60,
    width: 40,
    height: 40,
    dimension_unit: 'cm',
    calculated_volume_cm3: 96000,
    calculated_volume_m3: 0.096,
    items_per_box: 20,
    max_packing_qty: 24,
    notes: 'Standard 5-ply export corrugated carton',
  },
];

export default function BuyerProductModal({
  open,
  onClose,
  buyerId,
  buyerName,
  initialProduct,
  onSave,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [uom, setUom] = useState('Pieces');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [dimensions, setDimensions] = useState<ProductDimensions>(defaultDimensions);
  const [cuttingSize, setCuttingSize] = useState<ProductCuttingSize>(defaultCuttingSize);
  const [components, setComponents] = useState<BuyerProductComponent[]>([]);
  const [boxes, setBoxes] = useState<BoxPackingConfig[]>(defaultBoxes);

  useEffect(() => {
    if (initialProduct) {
      setProductName(initialProduct.product_name || '');
      setProductCode(initialProduct.product_code || '');
      setUom(initialProduct.uom || 'Pieces');
      setNotes(initialProduct.notes || '');
      setImageUrl(initialProduct.image_url || '');
      const loadedDims = initialProduct.dimensions || defaultDimensions;
      setDimensions(loadedDims);
      setComponents(initialProduct.components || []);
      setBoxes(initialProduct.boxes && initialProduct.boxes.length > 0 ? initialProduct.boxes : defaultBoxes);

      // Initialize cutting size from product or auto-calculate defaults
      if (initialProduct.cutting_size) {
        setCuttingSize({
          cutting_length: Number(initialProduct.cutting_size.cutting_length) || 0,
          cutting_width: Number(initialProduct.cutting_size.cutting_width) || 0,
          cutting_height: Number(initialProduct.cutting_size.cutting_height) || 0,
          unit: initialProduct.cutting_size.unit || loadedDims.unit || 'cm',
          notes: initialProduct.cutting_size.notes || '',
        });
      } else {
        const finL = Number(loadedDims.length || 30);
        const finW = Number(loadedDims.width || 20);
        const finH = Number(loadedDims.height || 0);
        setCuttingSize({
          cutting_length: Math.round((finL + 4) * 10) / 10,
          cutting_width: Math.round((finW + 4) * 10) / 10,
          cutting_height: finH > 0 ? finH : 0,
          unit: loadedDims.unit || 'cm',
          notes: '',
        });
      }
    } else {
      setProductName('');
      setProductCode('');
      setUom('Pieces');
      setNotes('');
      setImageUrl('');
      setDimensions(defaultDimensions);
      setCuttingSize(defaultCuttingSize);
      setComponents([]);
      setBoxes(defaultBoxes);
    }
    setActiveTab('general');
    setError('');
  }, [initialProduct, open]);

  if (!open) return null;

  const tabs: { id: TabId; label: string; icon: any; count: number | null }[] = [
    { id: 'general', label: '1. General Info & Photo', icon: FileText, count: null },
    { id: 'bom', label: '2. Raw Materials & Components (BOM)', icon: Layers, count: components.length },
    { id: 'dimensions', label: '3. Dimensions & Volume', icon: Ruler, count: null },
    { id: 'boxes', label: '4. Box Packing & Simulator', icon: Package, count: boxes.length },
    { id: 'cutting', label: '5. Cutting Size', icon: Scissors, count: null },
  ];

  const currentStepIndex = tabs.findIndex((t) => t.id === activeTab);

  const validateStep = (step: TabId): boolean => {
    if (step === 'general') {
      if (!productName.trim()) {
        setError('Product Name is required.');
        return false;
      }
      if (!uom.trim()) {
        setError('Unit of Measurement (UOM) is required.');
        return false;
      }
    } else if (step === 'bom') {
      for (let i = 0; i < components.length; i++) {
        const c = components[i];
        if (!c.material_id && !c.name.trim()) {
          setError(`BOM Row #${i + 1}: Please select a material from the Material Master.`);
          return false;
        }
        if (!c.quantity_per_product || c.quantity_per_product <= 0) {
          setError(`BOM Row #${i + 1} (${c.name || 'Component'}): Qty / Unit must be greater than 0.`);
          return false;
        }
      }
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (!validateStep(activeTab)) return;

    if (activeTab === 'general') {
      setActiveTab('bom');
    } else if (activeTab === 'bom') {
      setActiveTab('dimensions');
    } else if (activeTab === 'dimensions') {
      setActiveTab('boxes');
    } else if (activeTab === 'boxes') {
      setActiveTab('cutting');
    }
  };

  const handleBack = () => {
    setError('');
    if (activeTab === 'cutting') {
      setActiveTab('boxes');
    } else if (activeTab === 'boxes') {
      setActiveTab('dimensions');
    } else if (activeTab === 'dimensions') {
      setActiveTab('bom');
    } else if (activeTab === 'bom') {
      setActiveTab('general');
    }
  };

  const handleTabClick = (targetTab: TabId) => {
    const targetIdx = tabs.findIndex((t) => t.id === targetTab);
    if (currentStepIndex === 0 && targetIdx > 0) {
      if (!validateStep('general')) return;
    }
    if (currentStepIndex === 1 && targetIdx > 1) {
      if (!validateStep('bom')) return;
    }
    setError('');
    setActiveTab(targetTab);
  };

  const handleSave = async () => {
    if (!validateStep('general')) {
      setActiveTab('general');
      return;
    }
    if (!validateStep('bom')) {
      setActiveTab('bom');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave({
        buyer_id: buyerId,
        product_name: productName.trim(),
        product_code: productCode.trim() || undefined,
        uom,
        notes: notes.trim(),
        image_url: imageUrl,
        dimensions,
        cutting_size: cuttingSize,
        components,
        boxes,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save product configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden animate-fadeIn">
      {/* 1. Full Page Top Navigation Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium transition cursor-pointer"
            title="Back to Product List"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Back to Products</span>
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                {initialProduct ? 'Edit Buyer Product Configuration' : 'Configure New Buyer Product'}
              </h2>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-semibold border border-brand-200">
                {buyerName}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Comprehensive Bill of Materials (BOM), dimensions, and carton box packing rules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>

      {/* 2. Subheader Tab Navigation Bar */}
      <div className="bg-white border-b border-slate-200 px-6 overflow-x-auto flex items-center justify-between">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-brand-600 text-brand-700 bg-brand-50/40 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-brand-600 text-white font-bold' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
          <span>Step {currentStepIndex + 1} of 5</span>
        </div>
      </div>

      {/* 3. Full Page Workspace Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/60">
        <div className="max-w-[1400px] w-full mx-auto flex flex-col gap-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tab 1: General Info & Image */}
          {activeTab === 'general' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
                    Product Identification
                  </h3>
                  <FormField
                    label="Product Name *"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Crew Neck T-Shirt / Cotton Bedsheet"
                    hint="Finished garment or soft goods title for this buyer"
                  />

                  <FormField
                    as="select"
                    label="Unit of Measurement (UOM) *"
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    hint={productCode ? `Product Code: ${productCode}` : "Product code will be auto-generated"}
                  >
                    {COMMON_UOMS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </FormField>

                  <FormField
                    as="textarea"
                    label="Product Note / Tech Pack Details"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. 180 GSM single jersey with ribbed collar and double needle stitching. Export standard enzyme washed."
                    rows={5}
                  />
                </div>

                {/* Product Image Uploader */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
                    Product Photograph
                  </h3>
                  <ProductImageUploader imageUrl={imageUrl} onChange={setImageUrl} />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Raw Materials & Components (BOM) */}
          {activeTab === 'bom' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              <RawMaterialsTable components={components} onChange={setComponents} />
            </div>
          )}

          {/* Tab 3: Dimensions & Cubic Volume */}
          {activeTab === 'dimensions' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              <ProductDimensionsForm dimensions={dimensions} onChange={setDimensions} />
            </div>
          )}

          {/* Tab 4: Box Packing & Live Simulator */}
          {activeTab === 'boxes' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              <BoxConfigSection
                boxes={boxes}
                onChange={setBoxes}
                productDimensions={dimensions}
              />
            </div>
          )}

          {/* Tab 5: Cutting Size & Pattern Specifications */}
          {activeTab === 'cutting' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              <ProductCuttingSizeForm
                cuttingSize={cuttingSize}
                onChange={setCuttingSize}
                productDimensions={dimensions}
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. Bottom Sticky Action Bar */}
      <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Buyer: <strong className="text-slate-800">{buyerName}</strong> &bull; Step {currentStepIndex + 1} of 5: <span className="font-medium text-slate-700">{tabs[currentStepIndex].label}</span>
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>

          {currentStepIndex > 0 && (
            <Button
              variant="secondary"
              onClick={handleBack}
              disabled={saving}
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Back
            </Button>
          )}

          {currentStepIndex < 4 ? (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={saving}
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Button
              variant="primary"
              loading={saving}
              onClick={handleSave}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Save Product Configuration
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
