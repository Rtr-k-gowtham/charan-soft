// src/pages/production/CreateProductionOrder.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Customer, Category, Product } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import Modal from '../../components/ui/Modal';
import SearchableSelect, { SelectOption } from '../../components/ui/SearchableSelect';
import PantoneColorPicker from '../../components/ui/PantoneColorPicker';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Package,
  Layers,
  Palette,
  Clock,
} from 'lucide-react';

interface ColorRecord {
  id: number;
  code?: string;
  name: string;
  hex_code: string;
  pantone_code?: string;
}

interface OrderItem {
  product_id: string;
  color: string;
  size: string;
  total_quantity: number;
}

const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'SINGLE', 'QUEEN', 'KING'];

export default function CreateProductionOrder() {
  const navigate = useNavigate();

  // Master data
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [colors, setColors] = useState<ColorRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [form, setForm] = useState({
    title: '',
    customer_id: '',
    category_id: '7',
    priority: 'Medium',
    start_date: new Date().toISOString().split('T')[0],
    target_delivery_date: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 20);
      return d.toISOString().split('T')[0];
    })(),
    notes: '',
  });

  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { product_id: '', color: '', size: 'M', total_quantity: 100 },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Add Color Modal State
  const [addColorModalOpen, setAddColorModalOpen] = useState(false);
  const [activeColorRowIndex, setActiveColorRowIndex] = useState<number | null>(null);
  const [colorSaving, setColorSaving] = useState(false);
  const [colorError, setColorError] = useState('');
  const [colorForm, setColorForm] = useState({
    name: '',
    code: '',
    pantone_code: '',
    hex_code: '#1e3a8a',
  });

  // Load authoritative master data
  const loadMasterData = async () => {
    setLoading(true);
    try {
      const [prdData, custData, catData, colData] = await Promise.all([
        api.getProducts(),
        api.getCustomers(),
        api.getCategories('order').catch(() => api.getCategories()),
        api.getColors(),
      ]);
      setProducts((prdData || []) as Product[]);
      setCustomers((custData || []) as Customer[]);
      setCategories((catData || []) as Category[]);
      setColors((colData || []) as ColorRecord[]);
    } catch (err: unknown) {
      console.error('Failed to load master data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  // Format products for SearchableSelect
  const productOptions: SelectOption[] = useMemo(() => {
    return products.map((p) => {
      const details: string[] = [];
      if (p.code) details.push(p.code);
      if (p.design) details.push(p.design);
      if (p.uom) details.push(p.uom);
      if (p.selling_price && Number(p.selling_price) > 0) details.push(`₹${p.selling_price}`);

      return {
        value: String(p.id),
        label: p.name,
        sublabel: details.join(' • '),
      };
    });
  }, [products]);

  // Format colors for SearchableSelect
  const colorOptions: SelectOption[] = useMemo(() => {
    return colors.map((c) => ({
      value: c.name,
      label: c.name,
      sublabel: `${c.code || ''} ${c.pantone_code ? `Pantone: ${c.pantone_code}` : ''}`.trim(),
      colorSwatch: c.hex_code,
    }));
  }, [colors]);

  // Item row operations
  const handleAddItemRow = () => {
    setOrderItems((prev) => [
      ...prev,
      { product_id: '', color: '', size: 'M', total_quantity: 100 },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (orderItems.length <= 1) return;
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = <K extends keyof OrderItem>(
    index: number,
    field: K,
    value: OrderItem[K]
  ) => {
    setOrderItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Open Add Color Modal for a specific row
  const handleOpenAddColor = (rowIndex: number) => {
    setActiveColorRowIndex(rowIndex);
    setColorForm({
      name: '',
      code: '',
      pantone_code: '',
      hex_code: '#1e3a8a',
    });
    setColorError('');
    setAddColorModalOpen(true);
  };

  // Save New Color
  const handleSaveColor = async () => {
    const trimmedName = colorForm.name.trim();
    if (!trimmedName) {
      setColorError('Color name is required');
      return;
    }

    setColorSaving(true);
    setColorError('');
    try {
      const res = await api.createColor({
        name: trimmedName,
        code: colorForm.code.trim(),
        pantone_code: colorForm.pantone_code.trim().toUpperCase(),
        hex_code: colorForm.hex_code || '#000000',
      }) as { data?: ColorRecord; id?: number; code?: string; name?: string; hex_code?: string; pantone_code?: string };

      // Reload colors from authoritative backend
      const updatedColors = (await api.getColors()) as ColorRecord[];
      setColors(updatedColors || []);

      // Auto-select this newly created color in the initiating row
      const selectedColorName = res?.name || (res?.data?.name) || trimmedName;
      if (activeColorRowIndex !== null && activeColorRowIndex >= 0) {
        handleItemChange(activeColorRowIndex, 'color', selectedColorName);
      }

      setAddColorModalOpen(false);
      setActiveColorRowIndex(null);
    } catch (e: unknown) {
      setColorError((e as Error).message || 'Failed to create color');
    } finally {
      setColorSaving(false);
    }
  };

  // Total quantity calculation
  const totalPieces = useMemo(() => {
    return orderItems.reduce((acc, it) => acc + (Number(it.total_quantity) || 0), 0);
  }, [orderItems]);

  // Submit Production Order
  const handleCreate = async () => {
    if (!form.title.trim()) {
      setError('Order Title is required');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (orderItems.length === 0) {
      setError('At least one product line is required');
      return;
    }

    for (let i = 0; i < orderItems.length; i++) {
      const row = orderItems[i];
      if (!row.product_id) {
        setError(`Please select a Product for line #${i + 1}`);
        return;
      }
      if (!row.color.trim()) {
        setError(`Please select a Color for line #${i + 1}`);
        return;
      }
      if (!row.total_quantity || row.total_quantity <= 0) {
        setError(`Quantity for line #${i + 1} must be greater than 0`);
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        title: form.title.trim(),
        customer_id: form.customer_id || null,
        category_id: form.category_id ? parseInt(form.category_id) : 7,
        priority: form.priority,
        start_date: form.start_date,
        target_delivery_date: form.target_delivery_date,
        notes: form.notes.trim() || null,
        items: orderItems.map((item) => ({
          product_id: parseInt(item.product_id),
          color: item.color,
          size: item.size,
          total_quantity: Number(item.total_quantity),
        })),
      };

      await api.createProductionOrder(payload);
      // Navigate back to orders list
      navigate('/production/orders');
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to create production order');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Page Header */}
      <PageHeader
        title="Create Production Order"
        subtitle="Configure manufacturing order parameters and product line specifications"
        breadcrumb={[
          { label: 'Production' },
          { label: 'Orders', href: '/production/orders' },
          { label: 'Create Order' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/production/orders')}
            >
              Back to Orders
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/production/orders')}
            >
              Cancel
            </Button>
            <Button
              loading={saving}
              icon={<Check className="w-3.5 h-3.5" />}
              onClick={handleCreate}
            >
              Create Order
            </Button>
          </div>
        }
      />

      {/* Main Content Area */}
      <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Error banner */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2 shadow-xs">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Section 1: Order Details */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Order Information & Scheduling
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">All fields marked with * are required</span>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-4">
                <FormField
                  label="Order Title"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Export Queen Bed Linen Contract - Summer Batch"
                />
              </div>

              <FormField
                as="select"
                label="Buyer"
                value={form.customer_id}
                onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
              >
                <option value="">— Select Buyer (Optional) —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </FormField>

              <FormField
                as="select"
                label="Priority"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                  <option key={p} value={p}>
                    {p} Priority
                  </option>
                ))}
              </FormField>

              <FormField
                label="Start Date"
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />

              <FormField
                label="Target Delivery Date"
                type="date"
                required
                value={form.target_delivery_date}
                onChange={(e) => setForm((f) => ({ ...f, target_delivery_date: e.target.value }))}
              />

              <div className="lg:col-span-4">
                <FormField
                  as="textarea"
                  label="Production Notes / Instructions"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional manufacturing specifications, packaging details, or batch notes..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Product Lines */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Product Lines & Variants
              </h2>
              <span className="ml-2 px-2 py-0.5 text-[11px] font-semibold bg-brand-50 text-brand-700 rounded-full border border-brand-200">
                {orderItems.length} {orderItems.length === 1 ? 'Line' : 'Lines'}
              </span>
            </div>
            <Button
              variant="secondary"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleAddItemRow}
            >
              Add Product Line
            </Button>
          </div>

          <div className="p-5">
            <div className="space-y-3">
              {orderItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Line Number indicator */}
                    <div className="md:col-span-1 flex items-center gap-1.5 pb-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 md:hidden">
                        Item #{idx + 1}
                      </span>
                    </div>

                    {/* Searchable Product */}
                    <div className="md:col-span-4">
                      <SearchableSelect
                        label={idx === 0 ? 'Product *' : undefined}
                        placeholder="— Select Product —"
                        searchPlaceholder="Search product by name, code, design..."
                        options={productOptions}
                        value={item.product_id}
                        onChange={(val) => handleItemChange(idx, 'product_id', val)}
                      />
                    </div>

                    {/* Searchable Color with + Add Color */}
                    <div className="md:col-span-3">
                      <div className="flex flex-col">
                        {idx === 0 && (
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-medium text-slate-600">
                              Color Variant *
                            </label>
                            <button
                              type="button"
                              onClick={() => handleOpenAddColor(idx)}
                              className="text-[10px] text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-0.5"
                            >
                              <Plus className="w-2.5 h-2.5" /> Add Color
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1">
                            <SearchableSelect
                              placeholder="— Select Color —"
                              searchPlaceholder="Search color by name or HEX..."
                              options={colorOptions}
                              value={item.color}
                              onChange={(val) => handleItemChange(idx, 'color', val)}
                              actionButton={{
                                label: 'Add New Color',
                                icon: <Palette className="w-3.5 h-3.5 text-brand-600" />,
                                onClick: () => handleOpenAddColor(idx),
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenAddColor(idx)}
                            className="p-2 border border-slate-300 hover:border-brand-400 bg-white hover:bg-brand-50 text-slate-500 hover:text-brand-600 rounded-md transition-colors shrink-0"
                            title="Create new color in Colors Master"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Size Selector */}
                    <div className="md:col-span-2">
                      {idx === 0 && (
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">
                          Size *
                        </label>
                      )}
                      <select
                        value={item.size}
                        onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                        className="w-full min-h-[34px] px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium text-slate-700"
                      >
                        {DEFAULT_SIZES.map((sz) => (
                          <option key={sz} value={sz}>
                            {sz}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity Input */}
                    <div className="md:col-span-1">
                      {idx === 0 && (
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">
                          Qty (pcs) *
                        </label>
                      )}
                      <input
                        type="number"
                        min="1"
                        value={item.total_quantity || ''}
                        onChange={(e) =>
                          handleItemChange(
                            idx,
                            'total_quantity',
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                        className="w-full min-h-[34px] px-2.5 py-1.5 text-xs text-right font-mono font-semibold bg-white border border-slate-300 rounded-md focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800"
                      />
                    </div>

                    {/* Remove Action */}
                    <div className="md:col-span-1 flex items-center justify-end pb-1">
                      <button
                        type="button"
                        disabled={orderItems.length <= 1}
                        onClick={() => handleRemoveItemRow(idx)}
                        className={`p-1.5 rounded transition-colors ${
                          orderItems.length <= 1
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={orderItems.length <= 1 ? 'Order must have at least one line' : 'Remove row'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom summary bar of product lines */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 p-3 rounded-lg">
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1.5 py-1 px-2.5 rounded hover:bg-brand-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Product Line</span>
              </button>

              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-500">
                  Total Lines: <strong className="text-slate-800">{orderItems.length}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  Total Order Quantity:{' '}
                  <strong className="text-brand-700 font-mono text-sm">{totalPieces.toLocaleString()} pcs</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Footer Action Bar */}
        <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Target Delivery: <strong>{form.target_delivery_date || 'Not set'}</strong></span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              onClick={() => navigate('/production/orders')}
            >
              Cancel
            </Button>
            <Button
              loading={saving}
              icon={<Check className="w-3.5 h-3.5" />}
              onClick={handleCreate}
            >
              Create Production Order
            </Button>
          </div>
        </div>
      </div>

      {/* Add Color Compact Modal */}
      <Modal
        open={addColorModalOpen}
        onClose={() => setAddColorModalOpen(false)}
        title="Add New Color to Master"
      >
        <div className="space-y-4">
          {colorError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{colorError}</span>
            </div>
          )}

          {/* Pantone Reference Selection */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-brand-600" />
              <span>Select Textile Pantone Reference</span>
            </label>
            <PantoneColorPicker
              selectedPantone={colorForm.pantone_code}
              selectedName={colorForm.name}
              selectedHex={colorForm.hex_code}
              onSelect={(item) => {
                setColorForm((prev) => ({
                  ...prev,
                  pantone_code: item.pantone_code,
                  name: item.name,
                  hex_code: item.hex_code,
                }));
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <FormField
              label="Pantone Color Code"
              required
              placeholder="e.g. 19-4052 TCX"
              hint="International textile Pantone reference"
              value={colorForm.pantone_code}
              onChange={(e) => setColorForm((prev) => ({ ...prev, pantone_code: e.target.value.toUpperCase() }))}
            />

            <FormField
              label="Color Name"
              required
              placeholder="e.g. Classic Navy"
              hint="Official textile name or brand label"
              value={colorForm.name}
              onChange={(e) => setColorForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold text-slate-700 block">Digital Swatch Reference</span>
              <span className="text-[10px] text-slate-500">Representative digital color for UI identification</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5 bg-white shadow-2xs"
                value={colorForm.hex_code || '#0f2042'}
                onChange={(e) => setColorForm((prev) => ({ ...prev, hex_code: e.target.value }))}
              />
              <span className="text-[11px] font-mono text-slate-600 font-semibold">{colorForm.hex_code}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setAddColorModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              loading={colorSaving}
              onClick={handleSaveColor}
            >
              Save & Select Color
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
