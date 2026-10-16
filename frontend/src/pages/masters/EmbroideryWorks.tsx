// src/pages/masters/EmbroideryWorks.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';
import { EmbroideryWork } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable, { Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, RefreshCw, Pencil, Trash2, AlertCircle, Filter } from 'lucide-react';

interface EmbroideryWorkFormData {
  code: string;
  name: string;
  unit_type: string;
  contact_person: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  address: string;
  gstin: string;
  machine_heads: string;
  embroidery_types: string;
  rate_per_thousand_stitches: string;
  daily_capacity_pcs: string;
  payment_terms_days: string;
  status: 'active' | 'inactive';
}

const defaultForm: EmbroideryWorkFormData = {
  code: '',
  name: '',
  unit_type: 'Multi-Head Computerized',
  contact_person: '',
  phone: '',
  email: '',
  city: 'Tiruppur',
  state: 'Tamil Nadu',
  address: '',
  gstin: '',
  machine_heads: '20-Head Tajima High Speed (15 Needles)',
  embroidery_types: 'Multi-Color Flat, 3D Puff, Applique',
  rate_per_thousand_stitches: '2.80',
  daily_capacity_pcs: '3500',
  payment_terms_days: '30',
  status: 'active',
};

const UNIT_TYPES = [
  'Multi-Head Computerized',
  'Automatic & Sequin',
  'Specialized Fashion Embroidery',
  'High Speed Multi-Head',
  'Cording & Chain Stitch',
  'Schiffli / Large Format',
  'Manual / Handwork & Badges',
];

export default function EmbroideryWorks() {
  const [data, setData] = useState<EmbroideryWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingUnit, setEditingUnit] = useState<EmbroideryWork | null>(null);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<EmbroideryWorkFormData>(defaultForm);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getEmbroideryWorks();
      setData((res || []) as EmbroideryWork[]);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredData = useMemo(() => {
    if (typeFilter === 'all') return data;
    return data.filter(u => (u.unit_type || 'Multi-Head Computerized') === typeFilter);
  }, [data, typeFilter]);

  const handleOpenAdd = () => {
    setEditingUnit(null);
    const nextNum = data.length + 1;
    const nextCode = `VEND-EMB-${String(nextNum).padStart(3, '0')}`;
    setForm({
      ...defaultForm,
      code: nextCode,
    });
    setValidationErrors({});
    setError('');
    setDrawerOpen(true);
  };

  const handleOpenEdit = (unit: EmbroideryWork) => {
    setEditingUnit(unit);
    setForm({
      code: unit.code || '',
      name: unit.name || '',
      unit_type: unit.unit_type || 'Multi-Head Computerized',
      contact_person: unit.contact_person || '',
      phone: unit.phone || '',
      email: unit.email || '',
      city: unit.city || '',
      state: unit.state || '',
      address: unit.address || '',
      gstin: unit.gstin || '',
      machine_heads: unit.machine_heads || '',
      embroidery_types: unit.embroidery_types || '',
      rate_per_thousand_stitches: unit.rate_per_thousand_stitches != null ? String(unit.rate_per_thousand_stitches) : '',
      daily_capacity_pcs: unit.daily_capacity_pcs != null ? String(unit.daily_capacity_pcs) : '',
      payment_terms_days: unit.payment_terms_days != null ? String(unit.payment_terms_days) : '30',
      status: (unit.status as 'active' | 'inactive') || 'active',
    });
    setValidationErrors({});
    setError('');
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors.name = 'Unit name is required';
    }
    if (!form.phone.trim()) {
      errors.phone = 'Phone number is required';
    }
    if (!form.code.trim()) {
      errors.code = 'Unit code is required';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please resolve all required fields before saving.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        unit_type: form.unit_type,
        contact_person: form.contact_person.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        address: form.address.trim(),
        gstin: form.gstin.trim(),
        machine_heads: form.machine_heads.trim(),
        embroidery_types: form.embroidery_types.trim(),
        rate_per_thousand_stitches: form.rate_per_thousand_stitches ? Number(form.rate_per_thousand_stitches) : 0,
        daily_capacity_pcs: form.daily_capacity_pcs ? Number(form.daily_capacity_pcs) : 0,
        payment_terms_days: Number(form.payment_terms_days) || 30,
        status: form.status,
      };

      if (editingUnit) {
        await api.updateEmbroideryWork(editingUnit.id, payload);
      } else {
        await api.createEmbroideryWork(payload);
      }
      setDrawerOpen(false);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save embroidery unit';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (unit: EmbroideryWork) => {
    if (!window.confirm(`Are you sure you want to delete "${unit.name}"?`)) return;
    setDeletingId(unit.id);
    try {
      await api.deleteEmbroideryWork(unit.id);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete embroidery unit');
    } finally {
      setDeletingId(null);
    }
  };

  // Matching Suppliers table column structure:
  // Code, Supplier Name, Category, Contact, Phone, Email, GSTIN, Payment Terms, Status, Actions
  const columns: Column<EmbroideryWork>[] = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      render: (r: EmbroideryWork) => (
        <span className="font-mono text-[10px] text-slate-500 font-semibold">{r.code}</span>
      ),
    },
    {
      key: 'name',
      label: 'Supplier Name',
      sortable: true,
      render: (r: EmbroideryWork) => (
        <span className="font-semibold text-slate-800">{r.name}</span>
      ),
    },
    {
      key: 'unit_type',
      label: 'Category',
      sortable: true,
      render: (r: EmbroideryWork) => (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {r.unit_type || 'Embroidery Unit'}
        </span>
      ),
    },
    {
      key: 'contact_person',
      label: 'Contact',
      render: (r: EmbroideryWork) => (
        <span className="text-slate-600 text-xs">{r.contact_person || '—'}</span>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (r: EmbroideryWork) => (
        <span className="text-slate-700 font-mono text-xs">{r.phone || '—'}</span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (r: EmbroideryWork) => (
        <span className="text-brand-600 text-xs">{r.email || '—'}</span>
      ),
    },
    {
      key: 'gstin',
      label: 'GSTIN',
      render: (r: EmbroideryWork) => (
        <span className="font-mono text-[10px] text-slate-600">{r.gstin || '—'}</span>
      ),
    },
    {
      key: 'payment_terms_days',
      label: 'Payment Terms',
      render: (r: EmbroideryWork) => (
        <span className="text-slate-600 text-xs">{r.payment_terms_days ?? 30} days</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: EmbroideryWork) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Embroidery Works"
        subtitle="Manage embroidery jobworkers and machinery units"
        breadcrumb={[{ label: 'Masters' }, { label: 'Embroidery Works' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Category / Type Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 py-1 shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="text-xs bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All Categories ({data.length})</option>
                {UNIT_TYPES.map(t => {
                  const count = data.filter(u => (u.unit_type || 'Multi-Head Computerized') === t).length;
                  return (
                    <option key={t} value={t}>
                      {t} {count > 0 ? `(${count})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={load}
              disabled={loading}
              title="Refresh embroidery units"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={handleOpenAdd}>
              Add Embroidery Unit
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden p-2.5 sm:p-4">
        <DataTable
          data={filteredData}
          columns={columns}
          rowKey="id"
          actions={(r: EmbroideryWork) => (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleOpenEdit(r)}
                title="Edit Embroidery Unit"
                className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(r)}
                disabled={deletingId === r.id}
                title="Delete Embroidery Unit"
                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        />
      </div>

      {/* Add / Edit Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingUnit ? `Edit Embroidery Unit: ${editingUnit.name}` : 'Add Embroidery Unit'}
        subtitle={editingUnit ? 'Update embroidery specs and terms' : 'Register a new embroidery jobworker or unit'}
        width="max-w-xl"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingUnit ? 'Save Changes' : 'Create Unit'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Unit Code" required error={validationErrors.code}>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="VEND-EMB-001"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </FormField>

            <FormField label="Unit / Vendor Name" required error={validationErrors.name}>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Sri Krishna Embroidery Works"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Contact Person">
              <input
                type="text"
                value={form.contact_person}
                onChange={e => setForm({ ...form, contact_person: e.target.value })}
                placeholder="e.g. Mr. R. Krishnakumar"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </FormField>

            <FormField label="Phone Number" required error={validationErrors.phone}>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="9842199881"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Email Address">
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="krishnaemb@gmail.com"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </FormField>

            <FormField label="City / Region">
              <input
                type="text"
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                placeholder="Tiruppur"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </FormField>
          </div>

          <FormField label="Full Address">
            <textarea
              rows={3}
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              placeholder="14, College Road, Near Odakkadu, Tiruppur - 641602"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </FormField>
        </div>
      </Drawer>
    </div>
  );
}
