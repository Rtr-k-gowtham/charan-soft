// src/pages/masters/Materials.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Material, Category, Supplier } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, RefreshCw } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);

export default function Materials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    category_id: '', supplier_id: '', code: '', name: '', uom: 'KG',
    purchase_rate: '', tax_percent: '5', min_stock_level: '',
    spec: '', color: '', design: '',
  });

  const load = async (catId?: number) => {
    setLoading(true);
    try {
      const [matData, catData, supData] = await Promise.all([
        api.getMaterials(catId), api.getCategories('material'), api.getSuppliers()
      ]);
      setMaterials((matData || []) as Material[]);
      setCategories((catData || []) as Category[]);
      setSuppliers((supData || []) as Supplier[]);
    } catch {
      setMaterials([]);
      setCategories([]);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filterCat ?? undefined); }, [filterCat]);

  const handleCreate = async () => {
    if (!form.category_id || !form.name) {
      setError('Category and material name are required'); return;
    }
    setSaving(true); setError('');
    const autoCode = `MAT-${(materials.length + 1).toString().padStart(4, '0')}`;
    try {
      await api.createMaterial({
        category_id: parseInt(form.category_id),
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
        code: autoCode, name: form.name, uom: form.uom,
        purchase_rate: parseFloat(form.purchase_rate) || 0,
        tax_percent: parseFloat(form.tax_percent) || 5,
        min_stock_level: parseFloat(form.min_stock_level) || 0,
        dynamic_values: { spec: form.spec, color: form.color, design: form.design }
      });
      setCreateOpen(false);
      setForm({ category_id: '', supplier_id: '', code: '', name: '', uom: 'KG', purchase_rate: '', tax_percent: '5', min_stock_level: '', spec: '', color: '', design: '' });
      load(filterCat ?? undefined);
    } catch (e: unknown) { setError((e as Error).message); } finally { setSaving(false); }
  };

  const columns = [
    { key: 'code', label: 'Code', sortable: true, render: (r: Material) => <span className="font-mono text-[10px] text-slate-500">{r.code}</span> },
    { key: 'name', label: 'Material Name', sortable: true, render: (r: Material) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'category_name', label: 'Category', sortable: true, render: (r: Material) => <span className="text-[10px] text-slate-400">{r.category_name}</span> },
    { key: 'supplier_name', label: 'Supplier', sortable: true, render: (r: Material) => <span className="text-slate-500">{r.supplier_name || '—'}</span> },
    { key: 'uom', label: 'UOM' },
    { key: 'purchase_rate', label: 'Rate', render: (r: Material) => <span className="font-mono">₹{fmt(r.purchase_rate)}</span> },
    { key: 'tax_percent', label: 'Tax%', render: (r: Material) => <span className="font-mono">{r.tax_percent}%</span> },
    { key: 'status', label: 'Status', render: (r: Material) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Materials Master"
        subtitle="Category-driven dynamic material definitions"
        breadcrumb={[{ label: 'Masters' }, { label: 'Materials' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={() => load(filterCat ?? undefined)} disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreateOpen(true)}>
              Add Material
            </Button>
          </div>
        }
      />

      {/* Category filter */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white overflow-x-auto">
        <span className="text-[11px] text-slate-500 font-medium shrink-0">Category:</span>
        <button onClick={() => setFilterCat(null)}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors ${filterCat === null ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          All
        </button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setFilterCat(c.id)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors ${filterCat === c.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={materials} columns={columns} rowKey="id" emptyMessage="No materials found" />
      </div>

      {/* Create Drawer */}
      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} title="Add New Material"
        subtitle="Material details are driven by the selected category"
        width="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleCreate}>Save Material</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField as="select" label="Category" required value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">— Select Category —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FormField>

            <FormField as="select" label="UOM" required value={form.uom}
              onChange={e => setForm(f => ({ ...f, uom: e.target.value }))}>
              {['KG', 'M', 'PCS', 'ROLL', 'CONE', 'SET', 'BOX'].map(u => <option key={u}>{u}</option>)}
            </FormField>

            <div className="sm:col-span-2">
              <FormField label="Material Name" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cotton Fabric 40s" hint="Material Code will be automatically generated (e.g. MAT-0001)" />
            </div>

            <FormField label="Spec / Construction" value={form.spec}
              onChange={e => setForm(f => ({ ...f, spec: e.target.value }))} placeholder="e.g. 40s x 60s / 68x68" />
            <FormField label="Color / Finish" value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="e.g. Grey Unbleached" />

            <FormField label="Purchase Rate (₹)" type="number" required value={form.purchase_rate}
              onChange={e => setForm(f => ({ ...f, purchase_rate: e.target.value }))} min="0" step="0.01" />
            <FormField label="TAX %" type="number" required value={form.tax_percent}
              onChange={e => setForm(f => ({ ...f, tax_percent: e.target.value }))} min="0" max="100" step="0.5" />

            <div className="sm:col-span-2">
              <FormField label="Minimum Stock Level" type="number" required value={form.min_stock_level}
                onChange={e => setForm(f => ({ ...f, min_stock_level: e.target.value }))}
                hint="Alert will appear when stock falls below this level" min="0" />
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
