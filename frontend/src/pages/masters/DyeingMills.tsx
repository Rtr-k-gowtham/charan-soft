// src/pages/masters/DyeingMills.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';
import { DyeingMill } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable, { Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, RefreshCw, Pencil, Trash2, AlertCircle, Filter } from 'lucide-react';

interface DyeingMillFormData {
  code: string;
  name: string;
  mill_type: string;
  contact_person: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  address: string;
  gstin: string;
  daily_capacity_kg: string;
  lead_time_days: string;
  specialization: string;
  payment_terms_days: string;
  status: 'active' | 'inactive';
}

const defaultForm: DyeingMillFormData = {
  code: '',
  name: '',
  mill_type: 'Fabric Dyeing',
  contact_person: '',
  phone: '',
  email: '',
  city: 'Karur',
  state: 'Tamil Nadu',
  address: '',
  gstin: '',
  daily_capacity_kg: '8500',
  lead_time_days: '5',
  specialization: 'Woven & Knitted Fabric Dyeing',
  payment_terms_days: '30',
  status: 'active',
};

const MILL_TYPES = [
  'Fabric Dyeing',
  'Soft Flow Processing',
  'Continuous Dyeing',
  'Yarn & Fabric Dyeing',
  'Fabric Processing',
  'Dyeing Mill',
  'Cabinet & Dyeing',
  'Dyeing & Bleaching',
  'Cotton Dyeing',
  'Screen Printing & Dyeing',
  'Printing & Processing',
];

export default function DyeingMills() {
  const [data, setData] = useState<DyeingMill[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingMill, setEditingMill] = useState<DyeingMill | null>(null);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<DyeingMillFormData>(defaultForm);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getDyeingMills();
      setData((res || []) as DyeingMill[]);
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
    return data.filter(m => (m.mill_type || 'Fabric Dyeing') === typeFilter);
  }, [data, typeFilter]);

  const handleOpenAdd = () => {
    setEditingMill(null);
    const nextNum = data.length + 1;
    const nextCode = `VEND-DYE-${String(nextNum).padStart(3, '0')}`;
    setForm({
      ...defaultForm,
      code: nextCode,
    });
    setValidationErrors({});
    setError('');
    setDrawerOpen(true);
  };

  const handleOpenEdit = (mill: DyeingMill) => {
    setEditingMill(mill);
    setForm({
      code: mill.code || '',
      name: mill.name || '',
      mill_type: mill.mill_type || 'Fabric Dyeing',
      contact_person: mill.contact_person || '',
      phone: mill.phone || '',
      email: mill.email || '',
      city: mill.city || '',
      state: mill.state || '',
      address: mill.address || '',
      gstin: mill.gstin || '',
      daily_capacity_kg: mill.daily_capacity_kg != null ? String(mill.daily_capacity_kg) : '',
      lead_time_days: mill.lead_time_days != null ? String(mill.lead_time_days) : '',
      specialization: mill.specialization || '',
      payment_terms_days: mill.payment_terms_days != null ? String(mill.payment_terms_days) : '30',
      status: (mill.status as 'active' | 'inactive') || 'active',
    });
    setValidationErrors({});
    setError('');
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors.name = 'Mill name is required';
    }
    if (!form.phone.trim()) {
      errors.phone = 'Phone number is required';
    }
    if (!form.code.trim()) {
      errors.code = 'Mill code is required';
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
        mill_type: form.mill_type,
        contact_person: form.contact_person.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        address: form.address.trim(),
        gstin: form.gstin.trim(),
        daily_capacity_kg: form.daily_capacity_kg ? Number(form.daily_capacity_kg) : 0,
        lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : 0,
        specialization: form.specialization.trim(),
        payment_terms_days: Number(form.payment_terms_days) || 30,
        status: form.status,
      };

      if (editingMill) {
        await api.updateDyeingMill(editingMill.id, payload);
      } else {
        await api.createDyeingMill(payload);
      }
      setDrawerOpen(false);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save dyeing mill';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mill: DyeingMill) => {
    if (!window.confirm(`Are you sure you want to delete "${mill.name}"?`)) return;
    setDeletingId(mill.id);
    try {
      await api.deleteDyeingMill(mill.id);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete dyeing mill');
    } finally {
      setDeletingId(null);
    }
  };

  // Matching Suppliers table column structure:
  // Code, Supplier Name, Category, Contact, Phone, Email, GSTIN, Payment Terms, Status, Actions
  const columns: Column<DyeingMill>[] = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      render: (r: DyeingMill) => (
        <span className="font-mono text-[10px] text-slate-500 font-semibold">{r.code}</span>
      ),
    },
    {
      key: 'name',
      label: 'Supplier Name',
      sortable: true,
      render: (r: DyeingMill) => (
        <span className="font-semibold text-slate-800">{r.name}</span>
      ),
    },
    {
      key: 'mill_type',
      label: 'Category',
      sortable: true,
      render: (r: DyeingMill) => (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {r.mill_type || 'Fabric Dyeing'}
        </span>
      ),
    },
    {
      key: 'contact_person',
      label: 'Contact',
      render: (r: DyeingMill) => (
        <span className="text-slate-600 text-xs">{r.contact_person || '—'}</span>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (r: DyeingMill) => (
        <span className="text-slate-700 font-mono text-xs">{r.phone || '—'}</span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (r: DyeingMill) => (
        <span className="text-brand-600 text-xs">{r.email || '—'}</span>
      ),
    },
    {
      key: 'gstin',
      label: 'GSTIN',
      render: (r: DyeingMill) => (
        <span className="font-mono text-[10px] text-slate-600">{r.gstin || '—'}</span>
      ),
    },
    {
      key: 'payment_terms_days',
      label: 'Payment Terms',
      render: (r: DyeingMill) => (
        <span className="text-slate-600 text-xs">{r.payment_terms_days ?? 30} days</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: DyeingMill) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dyeing Mills"
        subtitle="Manage fabric dyeing mills and processing partners"
        breadcrumb={[{ label: 'Masters' }, { label: 'Dyeing Mills' }]}
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
                {MILL_TYPES.map(t => {
                  const count = data.filter(m => (m.mill_type || 'Fabric Dyeing') === t).length;
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
              title="Refresh dyeing mills"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={handleOpenAdd}>
              Add Dyeing Mill
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden p-2.5 sm:p-4">
        <DataTable
          data={filteredData}
          columns={columns}
          rowKey="id"
          actions={(r: DyeingMill) => (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleOpenEdit(r)}
                title="Edit Dyeing Mill"
                className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(r)}
                disabled={deletingId === r.id}
                title="Delete Dyeing Mill"
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
        title={editingMill ? `Edit Dyeing Mill: ${editingMill.name}` : 'Add Dyeing Mill'}
        subtitle={editingMill ? 'Update mill parameters and terms' : 'Register a new fabric dyeing mill'}
        width="max-w-xl"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingMill ? 'Save Changes' : 'Create Mill'}
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
            <FormField label="Mill Code" required error={validationErrors.code}>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="VEND-DYE-001"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </FormField>

            <FormField label="Mill Name" required error={validationErrors.name}>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Allied Textiles"
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
                placeholder="e.g. Mr. K. Arumugam"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </FormField>

            <FormField label="Phone Number" required error={validationErrors.phone}>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="9843054566"
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
                placeholder="info@alliedtextiles.in"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </FormField>

            <FormField label="City / Region">
              <input
                type="text"
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                placeholder="Karur"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </FormField>
          </div>

          <FormField label="Full Address">
            <textarea
              rows={3}
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              placeholder="No.5, Kamadenunagar, Pugalur Road, Karur - 639001"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </FormField>
        </div>
      </Drawer>
    </div>
  );
}
