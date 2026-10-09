// src/pages/masters/Products.tsx
import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../lib/api';
import { Product } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import {
  Plus,
  RefreshCw,
  Edit2,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  X,
  Package
} from 'lucide-react';

const fmtCur = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);

const compressImage = (file: File, maxWidth = 500, maxHeight = 500, quality = 0.82): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
};

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    code: '',
    name: '',
    design: '',
    uom: 'PCS',
    selling_price: '',
    tax_percent: '5',
    status: 'active',
    image: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const prods = await api.getProducts().catch(() => []);
      setProducts((prods || []) as Product[]);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditProduct(null);
    setForm({
      code: '',
      name: '',
      design: '',
      uom: 'PCS',
      selling_price: '',
      tax_percent: '5',
      status: 'active',
      image: '',
    });
    setError('');
    setDrawerOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({
      code: p.code,
      name: p.name,
      design: p.design || '',
      uom: p.uom,
      selling_price: String(p.selling_price),
      tax_percent: String(p.tax_percent),
      status: p.status,
      image: p.image || p.image_url || '',
    });
    setError('');
    setDrawerOpen(true);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WEBP)');
      return;
    }

    try {
      const compressed = await compressImage(file, 500, 500, 0.82);
      setForm(f => ({ ...f, image: compressed }));
      setError('');
    } catch {
      setError('Failed to process image');
    }
  };

  const removeImage = () => {
    setForm(f => ({ ...f, image: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.selling_price) {
      setError('Product Name and Selling Price are required');
      return;
    }

    setSaving(true);
    setError('');
    const finalCode = editProduct ? form.code : (form.code || `PRD-${String(products.length + 1).padStart(3, '0')}`);
    const payload = {
      code: finalCode,
      name: form.name.trim(),
      design: form.design,
      uom: form.uom,
      selling_price: Number(form.selling_price),
      tax_percent: Number(form.tax_percent),
      status: form.status,
      image_url: form.image,
      image: form.image,
    };

    try {
      if (editProduct) {
        await api.updateProduct(editProduct.id, payload);
      } else {
        await api.createProduct(payload);
      }
      setDrawerOpen(false);
      await load();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'image',
      label: 'Photo',
      render: (r: Product) => {
        const img = r.image || r.image_url;
        return (
          <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs relative">
            {img ? (
              <img
                src={img}
                alt={r.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fb = e.currentTarget.parentElement?.querySelector('.photo-fallback');
                  if (fb) (fb as HTMLElement).style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={`photo-fallback w-full h-full items-center justify-center ${img ? 'hidden' : 'flex'}`}
            >
              <Package className="w-4 h-4 text-slate-300" />
            </div>
          </div>
        );
      },
    },
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      render: (r: Product) => (
        <span className="font-mono text-[11px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
          {r.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Product Name',
      sortable: true,
      render: (r: Product) => <span className="font-semibold text-slate-800 text-xs">{r.name}</span>,
    },
    {
      key: 'design',
      label: 'Design',
      render: (r: Product) => <span className="text-slate-500 text-xs">{r.design || '—'}</span>,
    },
    {
      key: 'uom',
      label: 'UOM',
      render: (r: Product) => <span className="font-mono text-xs">{r.uom}</span>,
    },
    {
      key: 'selling_price',
      label: 'Selling Price',
      sortable: true,
      render: (r: Product) => <span className="font-mono font-bold text-xs text-slate-900">{fmtCur(r.selling_price)}</span>,
    },
    {
      key: 'tax_percent',
      label: 'Tax %',
      render: (r: Product) => <span className="font-mono text-xs">{r.tax_percent}%</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Product) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader
        title="Products"
        actions={
          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 bg-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>
              Add Product
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden p-4">
        <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-full shadow-xs">
          <DataTable
            data={products}
            columns={columns}
            rowKey="id"
            onRowClick={openEdit}
            actions={(r: Product) => (
              <button
                onClick={e => {
                  e.stopPropagation();
                  openEdit(r);
                }}
                className="p-1 text-slate-400 hover:text-brand-600 rounded"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          />
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editProduct ? 'Edit Product' : 'New Product'}
        subtitle="Configure product details, category, pricing, and photo"
        width="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              {editProduct ? 'Update Product' : 'Create Product'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Product Image Upload Zone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
              Product Image
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />

            {form.image ? (
              <div className="relative w-full h-44 rounded-lg border-2 border-brand-200 bg-slate-50 overflow-hidden group flex items-center justify-center shadow-xs">
                <img
                  src={form.image}
                  alt="Product preview"
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white text-slate-800 text-xs font-semibold rounded-md shadow hover:bg-slate-100 flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" /> Change
                  </button>
                  <button
                    type="button"
                    onClick={removeImage}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-md shadow hover:bg-red-700 flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-36 border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-lg bg-slate-50/60 hover:bg-brand-50/30 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center p-4"
              >
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-brand-600 shadow-2xs">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">Click to upload product image</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Auto-compresses PNG, JPG, or WEBP</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-slate-400 font-medium shrink-0">OR URL:</span>
              <input
                type="text"
                placeholder="https://images.unsplash.com/photo-..."
                value={form.image.startsWith('data:') ? '' : form.image}
                onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:border-brand-500 focus:outline-hidden text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Form Fields */}
          <FormField
            label="Product Name"
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Classic Crew Neck T-Shirt"
            hint="Product Code will be automatically generated (e.g. PRD-001)"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              as="select"
              label="UOM"
              value={form.uom}
              onChange={e => setForm(f => ({ ...f, uom: e.target.value }))}
            >
              {['PCS', 'SET', 'DOZEN', 'KG', 'M', 'ROLL', 'BOX'].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </FormField>

            <FormField
              label="Design / Style Pattern"
              value={form.design}
              onChange={e => setForm(f => ({ ...f, design: e.target.value }))}
              placeholder="e.g. Solid Minimalist, Breton Stripe"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Selling Price (₹)"
              type="number"
              required
              min="0"
              step="0.01"
              value={form.selling_price}
              onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))}
              placeholder="0.00"
            />
            <FormField
              label="Tax %"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.tax_percent}
              onChange={e => setForm(f => ({ ...f, tax_percent: e.target.value }))}
              placeholder="5"
            />
          </div>

          <FormField
            as="select"
            label="Status"
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FormField>
        </div>
      </Drawer>
    </div>
  );
}
