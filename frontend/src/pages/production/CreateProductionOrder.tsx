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
import {
  lookupPantoneAsync,
  normalizePantoneInput,
  hexToRgb,
  rgbToHex,
  isValidHex,
} from '../../lib/pantoneService';
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
  CheckCircle2,
  Loader2,
  Sliders,
  Sparkles,
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
    { product_id: '', color: '', size: '', total_quantity: 100 },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Add Color Modal State (Pantone lookup driven + Custom RGB/HEX fallback)
  const [addColorModalOpen, setAddColorModalOpen] = useState(false);
  const [activeColorRowIndex, setActiveColorRowIndex] = useState<number | null>(null);
  const [colorSaving, setColorSaving] = useState(false);
  const [colorError, setColorError] = useState('');
  const [colorPantoneInput, setColorPantoneInput] = useState('');
  const [colorName, setColorName] = useState('');
  const [colorHexCode, setColorHexCode] = useState('#0F2042');
  const [colorRgb, setColorRgb] = useState<{ r: number; g: number; b: number }>({ r: 15, g: 32, b: 66 });
  const [colorIsVerified, setColorIsVerified] = useState(false);
  const [colorIsCustomMode, setColorIsCustomMode] = useState(false);
  const [colorLookupLoading, setColorLookupLoading] = useState(false);
  const [colorLookupError, setColorLookupError] = useState('');
  const [colorVerifiedInfo, setColorVerifiedInfo] = useState<{
    code: string;
    system: string;
    category: string;
  } | null>(null);

  const handleColorHexChange = (val: string) => {
    let clean = val.trim();
    if (clean && !clean.startsWith('#')) clean = '#' + clean;
    setColorHexCode(clean);
    const parsed = hexToRgb(clean);
    if (parsed) {
      setColorRgb(parsed);
    }
  };

  const handleColorRgbChange = (channel: 'r' | 'g' | 'b', valStr: string) => {
    const num = parseInt(valStr, 10);
    const val = isNaN(num) ? 0 : Math.max(0, Math.min(255, num));
    const nextRgb = { ...colorRgb, [channel]: val };
    setColorRgb(nextRgb);
    setColorHexCode(rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
  };

  // Debounced Pantone Code lookup for quick-add color modal
  useEffect(() => {
    if (!addColorModalOpen) return;

    const trimmed = colorPantoneInput.trim();
    if (!trimmed) {
      setColorLookupLoading(false);
      setColorLookupError('');
      setColorName('');
      setColorHexCode('#0F2042');
      setColorRgb({ r: 15, g: 32, b: 66 });
      setColorIsVerified(false);
      setColorIsCustomMode(false);
      setColorVerifiedInfo(null);
      return;
    }

    if (colorVerifiedInfo && colorVerifiedInfo.code.toUpperCase() === trimmed.toUpperCase()) {
      return;
    }

    setColorIsVerified(false);
    setColorIsCustomMode(false);
    setColorLookupError('');
    setColorLookupLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await lookupPantoneAsync(trimmed);
        setColorLookupLoading(false);

        if (res.found && res.name && res.hex_code) {
          setColorIsVerified(true);
          setColorIsCustomMode(false);
          setColorName(res.name);
          setColorHexCode(res.hex_code);
          const parsedRgb = hexToRgb(res.hex_code) || { r: res.red || 0, g: res.green || 0, b: res.blue || 0 };
          setColorRgb(parsedRgb);
          setColorLookupError('');
          setColorVerifiedInfo({
            code: res.pantone_code || trimmed,
            system: res.system || 'Pantone Reference',
            category: res.category || 'Standard Library',
          });
        } else {
          setColorIsVerified(false);
          setColorIsCustomMode(true);
          setColorVerifiedInfo(null);
          setColorLookupError('Pantone code not found in library. You can enter the color name and RGB / HEX values below.');
          setColorName(prev => prev || '');
        }
      } catch (err) {
        setColorLookupLoading(false);
        setColorIsVerified(false);
        setColorIsCustomMode(true);
        setColorLookupError('Pantone lookup service unavailable. You can enter the color name and RGB / HEX values manually.');
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [colorPantoneInput, addColorModalOpen, colorVerifiedInfo]);

  // Load authoritative master data
  const loadMasterData = async () => {
    setLoading(true);
    try {
      const [prdData, custData, catData, pantoneData] = await Promise.all([
        api.getProducts(),
        api.getCustomers(),
        api.getCategories(),
        api.getPantoneColors({ all: true }).catch(() => api.getColors()),
      ]);
      setProducts((prdData || []) as Product[]);
      setCustomers((custData || []) as Customer[]);
      setCategories((catData || []) as Category[]);

      const raw = Array.isArray(pantoneData) ? pantoneData : (pantoneData as { items?: unknown[] })?.items || [];
      const mapped: ColorRecord[] = (raw as Array<{ id: number; pantone_name?: string; name?: string; unique_code?: string; code?: string; hex_code?: string; pantone_code?: string }>).map((c) => ({
        id: c.id,
        name: c.pantone_name || c.name || '',
        code: c.unique_code || c.code || '',
        hex_code: c.hex_code || '#64748b',
        pantone_code: c.pantone_code || '',
      }));
      setColors(mapped);
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

  // Format Pantone colors for SearchableSelect
  const colorOptions: SelectOption[] = useMemo(() => {
    return colors.map((c) => {
      const pCode = c.pantone_code ? c.pantone_code.trim() : '';
      const cName = c.name ? c.name.trim() : '';
      const displayLabel = pCode ? `${pCode} — ${cName}` : cName;
      const val = pCode || cName;

      return {
        value: val,
        label: displayLabel,
        sublabel: `${c.hex_code || ''} ${pCode ? `• Pantone: ${pCode}` : ''}`.trim(),
        colorSwatch: c.hex_code,
      };
    });
  }, [colors]);

  // Format buyers (customers) for SearchableSelect
  const customerOptions: SelectOption[] = useMemo(() => {
    return customers.map((c) => ({
      value: String(c.id),
      label: c.name + (c.code ? ` (${c.code})` : ''),
      sublabel: [c.phone, c.email].filter(Boolean).join(' • ') || undefined,
    }));
  }, [customers]);

  // Priority options for SearchableSelect
  const priorityOptions: SelectOption[] = [
    { value: 'Low', label: 'Low Priority', sublabel: 'Standard lead time' },
    { value: 'Medium', label: 'Medium Priority', sublabel: 'Normal scheduling' },
    { value: 'High', label: 'High Priority', sublabel: 'Expedited production' },
    { value: 'Urgent', label: 'Urgent Priority', sublabel: 'Immediate manufacturing' },
  ];

  // Item row operations
  const handleAddItemRow = () => {
    setOrderItems((prev) => [
      ...prev,
      { product_id: '', color: '', size: '', total_quantity: 100 },
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
    setColorPantoneInput('');
    setColorName('');
    setColorHexCode('#0F2042');
    setColorRgb({ r: 15, g: 32, b: 66 });
    setColorIsVerified(false);
    setColorIsCustomMode(false);
    setColorLookupLoading(false);
    setColorLookupError('');
    setColorVerifiedInfo(null);
    setColorError('');
    setAddColorModalOpen(true);
  };

  // Save New Color
  const handleSaveColor = async () => {
    if (!colorPantoneInput.trim()) {
      setColorError('Pantone Color Code is required');
      return;
    }
    if (!colorName.trim()) {
      setColorError('Color name is required');
      return;
    }
    if (!isValidHex(colorHexCode)) {
      setColorError('Please provide a valid 6-digit digital color HEX code (e.g. #FFE966)');
      return;
    }

    setColorSaving(true);
    setColorError('');
    const finalPantone = colorIsVerified && colorVerifiedInfo?.code
      ? colorVerifiedInfo.code
      : normalizePantoneInput(colorPantoneInput) || colorPantoneInput.trim();

    try {
      const res = await api.createPantoneColor({
        pantone_code: finalPantone,
        pantone_name: colorName.trim(),
        hex_code: colorHexCode,
        red: colorRgb.r,
        green: colorRgb.g,
        blue: colorRgb.b,
        color_system: 'PMS Coated',
      }) as { id?: number; pantone_code?: string; pantone_name?: string; hex_code?: string };

      const newRecord: ColorRecord = {
        id: res?.id || Date.now(),
        name: colorName.trim(),
        hex_code: colorHexCode,
        pantone_code: finalPantone,
      };

      // Add to local colors list immediately
      setColors((prev) => [newRecord, ...prev]);

      // Auto-select this newly created color in the initiating row
      const selectedValue = finalPantone ? `${finalPantone} — ${colorName.trim()}` : colorName.trim();
      if (activeColorRowIndex !== null && activeColorRowIndex >= 0) {
        handleItemChange(activeColorRowIndex, 'color', selectedValue);
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
      if (!row.size || !String(row.size).trim()) {
        setError(`Please enter a Size for line #${i + 1}`);
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
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="secondary"
              size="xs"
              className="sm:text-xs"
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/production/orders')}
            >
              <span className="hidden sm:inline">Back to Orders</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <Button
              variant="secondary"
              size="xs"
              className="sm:text-xs hidden xs:inline-flex"
              onClick={() => navigate('/production/orders')}
            >
              Cancel
            </Button>
            <Button
              loading={saving}
              size="sm"
              icon={<Check className="w-3.5 h-3.5 stroke-[2.5]" />}
              onClick={handleCreate}
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-xs"
            >
              <span className="hidden sm:inline">Create Order</span>
              <span className="sm:hidden font-bold">Create</span>
            </Button>
          </div>
        }
      />

      {/* Main Content Area */}
      <div className="flex-1 p-3 sm:p-5 md:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6 pb-28 md:pb-12">
        {/* Error banner */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 shadow-xs">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Section 1: Order Details */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Order Information & Scheduling
              </h2>
            </div>
            <span className="text-[10px] sm:text-[11px] text-slate-400 hidden xs:inline">* Required fields</span>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              <div className="lg:col-span-4">
                <FormField
                  label="Order Title"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Export Queen Bed Linen Contract - Summer Batch"
                />
              </div>

              <div>
                <SearchableSelect
                  label="Buyer"
                  placeholder="— Select Buyer (Optional) —"
                  searchPlaceholder="Search buyer by name, code..."
                  options={customerOptions}
                  value={form.customer_id}
                  onChange={(val) => setForm((f) => ({ ...f, customer_id: val }))}
                  clearable
                />
              </div>

              <div>
                <SearchableSelect
                  label="Priority"
                  placeholder="Select Priority"
                  searchPlaceholder="Search priority..."
                  options={priorityOptions}
                  value={form.priority}
                  onChange={(val) => setForm((f) => ({ ...f, priority: val }))}
                  clearable={false}
                />
              </div>

              <div>
                <FormField
                  label="Start Date"
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>

              <div>
                <FormField
                  label="Target Delivery Date"
                  type="date"
                  required
                  value={form.target_delivery_date}
                  onChange={(e) => setForm((f) => ({ ...f, target_delivery_date: e.target.value }))}
                />
              </div>

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
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-4 h-4 text-brand-600 shrink-0" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 truncate">
                Product Lines & Variants
              </h2>
              <span className="px-2 py-0.5 text-[10px] sm:text-[11px] font-bold bg-brand-50 text-brand-700 rounded-full border border-brand-200 shrink-0">
                {orderItems.length} {orderItems.length === 1 ? 'Line' : 'Lines'}
              </span>
            </div>
            <Button
              variant="secondary"
              size="xs"
              className="sm:text-xs"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleAddItemRow}
            >
              <span className="hidden sm:inline">Add Product Line</span>
              <span className="sm:hidden font-semibold">+ Line</span>
            </Button>
          </div>

          <div className="p-3.5 sm:p-5">
            <div className="space-y-3.5">
              {orderItems.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50/70 hover:bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 sm:p-4 transition-all shadow-2xs"
                >
                  {/* Card Header for Mobile with Item # and Trash button */}
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/60 md:hidden">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        Product Line #{idx + 1}
                      </span>
                      {item.total_quantity > 0 && (
                        <span className="text-[10px] font-mono font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {item.total_quantity} pcs
                        </span>
                      )}
                    </div>
                    {orderItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Remove product line"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>

                  {/* Desktop view (md+) & Mobile view */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Line Number indicator (Desktop only) */}
                    <div className="hidden md:flex md:col-span-1 items-center gap-1.5 pb-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                    </div>

                    {/* Searchable Product */}
                    <div className="md:col-span-4">
                      <SearchableSelect
                        label="Product *"
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
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 min-w-0">
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

                    {/* Size & Quantity Container: Side-by-side on mobile, individual columns on desktop */}
                    <div className="grid grid-cols-2 gap-2.5 md:contents">
                      {/* Size Decimal Input */}
                      <div className="md:col-span-2">
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">
                          Size *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.size}
                          onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                          placeholder="e.g. 2.5"
                          className="w-full min-h-[36px] px-2.5 py-1.5 text-xs font-mono font-medium bg-white border border-slate-300 rounded-md focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                        />
                      </div>

                      {/* Quantity Input */}
                      <div className="md:col-span-1">
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">
                          Qty (pcs) *
                        </label>
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
                          className="w-full min-h-[36px] px-2.5 py-1.5 text-xs text-right font-mono font-semibold bg-white border border-slate-300 rounded-md focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Remove Action (Desktop only) */}
                    <div className="hidden md:flex md:col-span-1 items-center justify-end pb-1">
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
            <div className="mt-4 pt-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 p-3 rounded-xl">
              <button
                type="button"
                onClick={handleAddItemRow}
                className="w-full sm:w-auto text-xs text-brand-600 hover:text-brand-700 font-bold flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-brand-200 bg-white hover:bg-brand-50 transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Another Product Line</span>
              </button>

              <div className="flex items-center gap-3 text-xs w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-slate-500">
                  Total Lines: <strong className="text-slate-800 font-semibold">{orderItems.length}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  Total Order Quantity:{' '}
                  <strong className="text-brand-700 font-mono text-sm font-bold">{totalPieces.toLocaleString()} pcs</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Footer Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Target Delivery: <strong className="text-slate-800">{form.target_delivery_date || 'Not set'}</strong></span>
            </div>
            <div className="sm:hidden font-mono font-bold text-brand-700">
              {totalPieces.toLocaleString()} pcs
            </div>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <Button
              variant="secondary"
              className="flex-1 sm:flex-none"
              onClick={() => navigate('/production/orders')}
            >
              Cancel
            </Button>
            <Button
              loading={saving}
              icon={<Check className="w-3.5 h-3.5 stroke-[2.5]" />}
              onClick={handleCreate}
              className="flex-1 sm:flex-none bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-xs"
            >
              Create Production Order
            </Button>
          </div>
        </div>
      </div>

      {/* Add Color Compact Modal (Pantone Lookup + Custom RGB/HEX Fallback) */}
      <Modal
        open={addColorModalOpen}
        onClose={() => setAddColorModalOpen(false)}
        title="Add New Pantone Color"
        size="md"
      >
        <div className="space-y-4">
          {colorError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{colorError}</span>
            </div>
          )}

          {/* 1. Pantone Color Code Input */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Pantone Color Code <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={colorPantoneInput}
                onChange={(e) => setColorPantoneInput(e.target.value)}
                placeholder="Enter Pantone code (e.g., 19-4052 TCX, 100 C, or custom code)"
                className={`w-full px-3 py-2 text-xs font-mono font-medium rounded-lg border transition-all duration-150 pr-9 ${
                  colorIsVerified
                    ? 'border-emerald-400 bg-emerald-50/20 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200'
                    : colorIsCustomMode
                    ? 'border-amber-300 bg-amber-50/15 text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-200'
                    : 'border-slate-300 bg-white text-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-200'
                }`}
                autoFocus
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                {colorLookupLoading ? (
                  <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                ) : colorIsVerified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : colorIsCustomMode ? (
                  <Sliders className="w-4 h-4 text-amber-500" />
                ) : null}
              </div>
            </div>

            {/* Validation & Status Indicator */}
            <div className="mt-1.5 min-h-[18px]">
              {colorLookupLoading && (
                <div className="flex items-center gap-1.5 text-[11px] text-brand-600">
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  <span>Looking up Pantone reference library & database...</span>
                </div>
              )}
              {!colorLookupLoading && colorIsVerified && colorVerifiedInfo && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Verified {colorVerifiedInfo.system} ({colorVerifiedInfo.category})</span>
                </div>
              )}
              {!colorLookupLoading && colorIsCustomMode && (
                <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-md">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Custom / Unlisted Pantone Color:</strong> Code not found in the reference library. You can enter the <strong>Color Name</strong> and digital <strong>RGB / HEX</strong> values below.
                  </div>
                </div>
              )}
              {!colorLookupLoading && !colorIsCustomMode && !colorIsVerified && !colorPantoneInput && (
                <p className="text-[11px] text-slate-400">
                  Type or paste a textile Pantone code (e.g. 19-4052 TCX, PANTONE 100 C) or enter any custom code.
                </p>
              )}
            </div>
          </div>

          {/* 2. Color Name Field */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center justify-between">
              <span>Color Name <span className="text-red-500">*</span></span>
              <span className="text-[10px] text-slate-400 font-normal">
                {colorIsVerified ? '(official reference, verified)' : '(manually enter or edit name)'}
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
                readOnly={colorIsVerified}
                placeholder={
                  colorLookupLoading
                    ? 'Looking up color name...'
                    : colorIsVerified
                    ? colorName
                    : 'Enter color name (e.g. Classic Navy, Custom Red)'
                }
                className={`w-full px-3 py-2 text-xs rounded-lg border transition-all ${
                  colorIsVerified
                    ? 'bg-slate-50 border-slate-200 text-slate-900 font-semibold cursor-default select-text'
                    : 'bg-white border-slate-300 text-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-200'
                }`}
              />
              {colorIsVerified && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
                    Verified
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Digital Color Swatch & Manual RGB / HEX Specification */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 block">Digital Color Specification</span>
                <span className="text-[10px] text-slate-500">
                  {colorIsVerified
                    ? 'Official representative digital color (sRGB & Hex)'
                    : 'Enter HEX value, adjust RGB numbers (0-255), or click the swatch to pick'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-lg border border-slate-300 shrink-0 shadow-2xs flex items-center justify-center transition-all cursor-pointer overflow-hidden"
                    style={{ backgroundColor: colorHexCode || '#0F2042' }}
                    title="Click to pick or adjust color"
                  >
                    {!colorIsVerified && (
                      <input
                        type="color"
                        value={colorHexCode.startsWith('#') && colorHexCode.length === 7 ? colorHexCode : '#0F2042'}
                        onChange={(e) => handleColorHexChange(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        title="Click to choose custom color visually"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* HEX & RGB inputs row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200/60">
              <div className="sm:col-span-1">
                <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                  HEX Code
                </label>
                <input
                  type="text"
                  value={colorHexCode}
                  onChange={(e) => handleColorHexChange(e.target.value)}
                  readOnly={colorIsVerified}
                  maxLength={7}
                  placeholder="#000000"
                  className={`w-full px-2 py-1 text-xs font-mono font-semibold rounded border ${
                    colorIsVerified
                      ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-default'
                      : 'bg-white border-slate-300 text-slate-800 focus:border-brand-500'
                  }`}
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-[10px] font-semibold text-red-600 block mb-0.5">
                  Red (0-255)
                </label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={colorRgb.r}
                  onChange={(e) => handleColorRgbChange('r', e.target.value)}
                  readOnly={colorIsVerified}
                  className={`w-full px-2 py-1 text-xs font-mono rounded border ${
                    colorIsVerified
                      ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-default'
                      : 'bg-white border-slate-300 text-slate-800 focus:border-red-400'
                  }`}
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-[10px] font-semibold text-emerald-600 block mb-0.5">
                  Green (0-255)
                </label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={colorRgb.g}
                  onChange={(e) => handleColorRgbChange('g', e.target.value)}
                  readOnly={colorIsVerified}
                  className={`w-full px-2 py-1 text-xs font-mono rounded border ${
                    colorIsVerified
                      ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-default'
                      : 'bg-white border-slate-300 text-slate-800 focus:border-emerald-400'
                  }`}
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-[10px] font-semibold text-blue-600 block mb-0.5">
                  Blue (0-255)
                </label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={colorRgb.b}
                  onChange={(e) => handleColorRgbChange('b', e.target.value)}
                  readOnly={colorIsVerified}
                  className={`w-full px-2 py-1 text-xs font-mono rounded border ${
                    colorIsVerified
                      ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-default'
                      : 'bg-white border-slate-300 text-slate-800 focus:border-blue-400'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Verified Specification Summary Banner */}
          {colorIsVerified && colorVerifiedInfo && (
            <div className="p-2.5 bg-gradient-to-r from-slate-50 to-emerald-50/40 border border-emerald-200/80 rounded-lg flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-6 h-6 rounded-md border border-slate-300 shadow-2xs shrink-0"
                  style={{ backgroundColor: colorHexCode }}
                />
                <div>
                  <div className="font-semibold text-slate-900">{colorName}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {colorVerifiedInfo.code} &bull; {colorVerifiedInfo.category}
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                {colorVerifiedInfo.system}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setAddColorModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              loading={colorSaving}
              disabled={colorSaving || colorLookupLoading || !colorPantoneInput.trim() || !colorName.trim()}
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
