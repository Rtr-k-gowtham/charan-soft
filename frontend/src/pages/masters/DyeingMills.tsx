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
import { 
  Plus, 
  RefreshCw, 
  Pencil, 
  Trash2, 
  AlertCircle, 
  Filter, 
  Layers, 
  Clock, 
  CheckCircle2, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Zap,
  Gauge
} from 'lucide-react';

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
  mill_type: 'Soft Flow / High Temp',
  contact_person: '',
  phone: '',
  email: '',
  city: 'Tirupur',
  state: 'Tamil Nadu',
  address: '',
  gstin: '',
  daily_capacity_kg: '2500',
  lead_time_days: '4',
  specialization: '100% Cotton & Blends Single Jersey / Terry',
  payment_terms_days: '30',
  status: 'active',
};

const MILL_TYPES = [
  'Soft Flow / High Temp',
  'Jiggar Dyeing',
  'Yarn Cone Dyeing',
  'Cabinet Bleaching & Mercerizing',
  'Continuous Dyeing Range',
  'Tubular / Open Width Processing',
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
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const stats = useMemo(() => {
    const total = data.length;
    const active = data.filter(m => m.status === 'active').length;
    const totalCapacity = data.reduce((sum, m) => sum + (Number(m.daily_capacity_kg) || 0), 0);
    const avgLeadTime = total > 0 ? (data.reduce((sum, m) => sum + (Number(m.lead_time_days) || 0), 0) / total).toFixed(1) : '0';
    return { total, active, totalCapacity, avgLeadTime };
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(mill => {
      const matchType = typeFilter === 'all' || mill.mill_type === typeFilter;
      const matchStatus = statusFilter === 'all' || mill.status === statusFilter;
      return matchType && matchStatus;
    });
  }, [data, typeFilter, statusFilter]);

  const handleOpenAdd = () => {
    setEditingMill(null);
    const nextNum = data.length + 1;
    const nextCode = `MILL-${String(nextNum).padStart(3, '0')}`;
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
      mill_type: mill.mill_type || 'Soft Flow / High Temp',
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
      errors.name = 'Dyeing Mill name is required';
    }
    if (!form.phone.trim()) {
      errors.phone = 'Contact phone number is required';
    }
    if (!form.code.trim()) {
      errors.code = 'Mill code is required';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please resolve required fields before saving.');
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

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this Dyeing Mill?')) return;
    setDeletingId(id);
    try {
      await api.deleteDyeingMill(id);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete dyeing mill');
    } finally {
      setDeletingId(null);
    }
  };

  const columns: Column<DyeingMill>[] = [
    {
      key: 'name',
      label: 'Mill Information',
      render: (mill: DyeingMill) => (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0 mt-0.5">
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900 hover:text-indigo-600 cursor-pointer" onClick={() => handleOpenEdit(mill)}>
              {mill.name}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-medium border border-gray-200">
                {mill.code}
              </span>
              <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                {mill.mill_type || 'Soft Flow'}
              </span>
            </div>
            {mill.specialization && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">
                {mill.specialization}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact Details',
      render: (mill: DyeingMill) => (
        <div className="text-xs space-y-1">
          {mill.contact_person && (
            <div className="font-medium text-gray-800 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {mill.contact_person}
            </div>
          )}
          <div className="text-gray-600 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>{mill.phone || '-'}</span>
          </div>
          {mill.email && (
            <div className="text-gray-500 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate max-w-[170px]">{mill.email}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      render: (mill: DyeingMill) => (
        <div className="text-xs text-gray-700 space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-gray-900">
            <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>{mill.city || 'Tirupur'}{mill.state ? `, ${mill.state}` : ''}</span>
          </div>
          {mill.address && (
            <p className="text-gray-500 line-clamp-2 max-w-[200px] text-[11px] leading-relaxed">
              {mill.address}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'capacity',
      label: 'Daily Capacity & Lead Time',
      render: (mill: DyeingMill) => (
        <div className="text-xs space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-gray-900">
              {mill.daily_capacity_kg ? Number(mill.daily_capacity_kg).toLocaleString() : '0'}
            </span>
            <span className="text-gray-500">KG / day</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Lead: <strong>{mill.lead_time_days ?? '-'}</strong> Days</span>
          </div>
        </div>
      ),
    },
    {
      key: 'tax_terms',
      label: 'GSTIN & Credit',
      render: (mill: DyeingMill) => (
        <div className="text-xs space-y-1">
          <div className="font-mono text-gray-700 text-[11px]">
            {mill.gstin || <span className="text-gray-400 italic">No GSTIN</span>}
          </div>
          <div className="text-gray-500">
            Terms: <span className="font-medium text-gray-800">{mill.payment_terms_days ?? 30} Days</span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (mill: DyeingMill) => <StatusBadge status={mill.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (mill: DyeingMill) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenEdit(mill)}
            title="Edit Dyeing Mill"
            className="text-gray-600 hover:text-indigo-600 hover:bg-indigo-50"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(mill.id)}
            disabled={deletingId === mill.id}
            title="Delete Dyeing Mill"
            className="text-gray-400 hover:text-rose-600 hover:bg-rose-50"
          >
            {deletingId === mill.id ? (
              <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Dyeing Mills Master"
        subtitle="Manage fabric dyeing processors, soft-flow mills, bleaching units, and production partner profiles"
        breadcrumb={[
          { label: 'Masters', href: '/masters' },
          { label: 'Dyeing Mills' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleOpenAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Dyeing Mill
            </Button>
          </div>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Dyeing Mills</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
            <div className="text-xs text-gray-500 mt-0.5">Registered jobwork units</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Processors</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</div>
            <div className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Available for POs
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Daily Processing Capacity</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{stats.totalCapacity.toLocaleString()} <span className="text-sm font-normal text-gray-500">KG</span></div>
            <div className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5" /> Combined factory capacity
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Gauge className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Lead Time</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{stats.avgLeadTime} <span className="text-sm font-normal text-gray-500">Days</span></div>
            <div className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Standard turnaround
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
            <Filter className="w-4 h-4 text-gray-400" />
            <span>Process Type:</span>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Mill Types ({data.length})</option>
            {MILL_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-xs font-medium text-gray-600 ml-2">
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <div className="text-xs text-gray-500 font-medium">
          Showing <span className="text-gray-900 font-bold">{filteredData.length}</span> of {data.length} Dyeing Mills
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        data={filteredData}
        columns={columns}
        rowKey="id"
        searchable={true}
        emptyMessage="No dyeing mills found matching your search and filter criteria."
      />

      {/* Add / Edit Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingMill ? `Edit Dyeing Mill: ${editingMill.name}` : 'Register New Dyeing Mill'}
        subtitle={editingMill ? 'Update dyeing mill parameters, capacity, and terms.' : 'Add a new dyeing processor partner for Stage 04 Dyeing Work Orders.'}
        width="max-w-2xl"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]">
              {saving ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </div>
              ) : editingMill ? (
                'Save Changes'
              ) : (
                'Create Mill'
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 py-2">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Mill Code" required error={validationErrors.code}>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. MILL-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase"
              />
            </FormField>

            <FormField label="Mill Name" required error={validationErrors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sri Murugan Soft Flow Dyeing"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Mill Type / Machinery" required>
              <select
                value={form.mill_type}
                onChange={(e) => setForm({ ...form, mill_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {MILL_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Specialization">
              <input
                type="text"
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                placeholder="e.g. Cotton & Poly Blends, Reactives, Acid Dye"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Daily Capacity (KG / Day)">
              <div className="relative">
                <input
                  type="number"
                  value={form.daily_capacity_kg}
                  onChange={(e) => setForm({ ...form, daily_capacity_kg: e.target.value })}
                  placeholder="2500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs text-gray-400 pointer-events-none">KG</span>
              </div>
            </FormField>

            <FormField label="Standard Lead Time (Days)">
              <div className="relative">
                <input
                  type="number"
                  value={form.lead_time_days}
                  onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })}
                  placeholder="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs text-gray-400 pointer-events-none">Days</span>
              </div>
            </FormField>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Contact Information</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Contact Person">
                <input
                  type="text"
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  placeholder="e.g. Mr. K. Arumugam"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </FormField>

              <FormField label="Phone Number" required error={validationErrors.phone}>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. 98422 12345"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <FormField label="Email Address">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. info@murugandyeing.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </FormField>

              <FormField label="City / Region">
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="e.g. Tirupur"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </FormField>
            </div>

            <div className="mt-4">
              <FormField label="Full Address">
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Plot No, Industrial Estate, SIPCOT, Perundurai / Tirupur"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </FormField>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Billing & Commercials</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="GSTIN Number">
                <input
                  type="text"
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                  placeholder="33AAAAA0000A1Z5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </FormField>

              <FormField label="Payment Terms (Days)">
                <input
                  type="number"
                  value={form.payment_terms_days}
                  onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })}
                  placeholder="30"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </FormField>

              <FormField label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </FormField>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
