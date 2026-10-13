// frontend/src/components/buyer-products/BuyerProductModal.tsx
import React, { useState, useEffect } from 'react';
import { BuyerProduct, BuyerProductComponent, BoxPackingConfig, ProductDimensions } from '../../types';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import ProductImageUploader from './ProductImageUploader';
import ProductDimensionsForm from './ProductDimensionsForm';
import RawMaterialsTable from './RawMaterialsTable';
import BoxConfigSection from './BoxConfigSection';
import { Layers, Package, Ruler, FileText, AlertCircle, Sparkles } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  buyerId: number;
  buyerName: string;
  initialProduct?: BuyerProduct | null;
  onSave: (product: Partial<BuyerProduct>) => Promise<void>;
}

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
  const [activeTab, setActiveTab] = useState<'general' | 'bom' | 'dimensions' | 'boxes'>('general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [uom, setUom] = useState('Pieces');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [dimensions, setDimensions] = useState<ProductDimensions>(defaultDimensions);
  const [components, setComponents] = useState<BuyerProductComponent[]>([]);
  const [boxes, setBoxes] = useState<BoxPackingConfig[]>(defaultBoxes);

  useEffect(() => {
    if (initialProduct) {
      setProductName(initialProduct.product_name || '');
      setProductCode(initialProduct.product_code || '');
      setUom(initialProduct.uom || 'Pieces');
      setNotes(initialProduct.notes || '');
      setImageUrl(initialProduct.image_url || '');
      setDimensions(initialProduct.dimensions || defaultDimensions);
      setComponents(initialProduct.components || []);
      setBoxes(initialProduct.boxes?.length ? initialProduct.boxes : defaultBoxes);
    } else {
      setProductName('');
      setProductCode('');
      setUom('Pieces');
      setNotes('');
      setImageUrl('');
      setDimensions(defaultDimensions);
      setComponents([
        {
          id: 'comp_sample_1',
          name: '100% Combed Cotton Single Jersey',
          category: 'Fabric',
          uom: 'Meter',
          quantity_per_product: 1.5,
          wastage_percent: 5,
          notes: 'Main body fabric',
        },
        {
          id: 'comp_sample_2',
          name: 'Sewing Thread 40/2',
          category: 'Thread',
          uom: 'Meter',
          quantity_per_product: 25,
          wastage_percent: 8,
          notes: 'Lockstitch & overlock',
        },
        {
          id: 'comp_sample_3',
          name: 'Brand Woven Neck Label',
          category: 'Label',
          uom: 'Piece',
          quantity_per_product: 1,
          wastage_percent: 2,
          notes: 'Back neck center',
        },
      ]);
      setBoxes(defaultBoxes);
    }
    setActiveTab('general');
    setError('');
  }, [initialProduct, open]);

  const handleSave = async () => {
    if (!productName.trim()) {
      setError('Product Name is required.');
      setActiveTab('general');
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

  const tabs = [
    { id: 'general', label: '1. General Info & Image', icon: FileText, count: null },
    { id: 'bom', label: '2. Raw Materials & Components', icon: Layers, count: components.length },
    { id: 'dimensions', label: '3. Dimensions & Volume', icon: Ruler, count: null },
    { id: 'boxes', label: '4. Box Packing & Simulator', icon: Package, count: boxes.length },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={initialProduct ? 'Edit Buyer Product Configuration' : 'Configure New Buyer Product'}
      subtitle={`Buyer: ${buyerName}`}
      width="max-w-4xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSave}>
            Save Product Configuration
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Header Navigation */}
        <div className="flex border-b border-slate-200 overflow-x-auto gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-brand-600 text-brand-700 bg-brand-50/40 rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab 1: General Info & Image */}
        {activeTab === 'general' && (
          <div className="flex flex-col gap-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <FormField
                  label="Product Name *"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Bio-Washed Crew Neck T-Shirt"
                  hint="Finished garment or textile product title"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    label="Product Code (Optional)"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    placeholder="e.g. BPRD-001"
                  />

                  <FormField
                    as="select"
                    label="Unit of Measurement (UOM) *"
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                  >
                    {COMMON_UOMS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </FormField>
                </div>

                <FormField
                  as="textarea"
                  label="Product Note / Tech Pack Details"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. 180 GSM single jersey with ribbed collar and double needle stitching. Export standard enzyme washed."
                  rows={4}
                />
              </div>

              {/* Product Image Uploader */}
              <div className="flex flex-col justify-start">
                <ProductImageUploader imageUrl={imageUrl} onChange={setImageUrl} />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Raw Materials & Components (BOM) */}
        {activeTab === 'bom' && (
          <div className="pt-1">
            <RawMaterialsTable components={components} onChange={setComponents} />
          </div>
        )}

        {/* Tab 3: Dimensions & Cubic Volume */}
        {activeTab === 'dimensions' && (
          <div className="pt-1">
            <ProductDimensionsForm dimensions={dimensions} onChange={setDimensions} />
          </div>
        )}

        {/* Tab 4: Box Packing & Live Simulator */}
        {activeTab === 'boxes' && (
          <div className="pt-1">
            <BoxConfigSection
              boxes={boxes}
              onChange={setBoxes}
              productDimensions={dimensions}
            />
          </div>
        )}
      </div>
    </Drawer>
  );
}
