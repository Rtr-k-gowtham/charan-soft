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
import { 
  Plus, 
  RefreshCw, 
  Pencil, 
  Trash2, 
  AlertCircle, 
  Filter, 
  Cpu, 
  CheckCircle2, 
  Phone, 
  Mail, 
  MapPin, 
  Sparkles,
  Layers,
  Coins,
  Scissors
} from 'lucide-react';

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
  city: 'Tirupur',
  state: 'Tamil Nadu',
  address: '',
  gstin: '',
  machine_heads: '20-Head Tajima (15 Needle)',
  embroidery_types: 'Flat Stitch, 3D Puff, Applique, Badges',
  rate_per_thousand_stitches: '0.85',
  daily_capacity_pcs: '3500',
  payment_terms_days: '30',
  status: 'active',
};

const UNIT_TYPES = [
  'Multi-Head Computerized',
  'Automatic & Sequin',
  'Specialized Fashion Embroidery',
  'Schiffli / Large Format',
  'Cording & Chain Stitch Unit',
  'Manual / Handwork & Stone Workshop',
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
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const stats = useMemo(() => {
    const total = data.length;
    const active = data.filter(u => u.status === 'active').length;
    const totalDailyPcs = data.reduce((sum, u) => sum + (Number(u.daily_capacity_pcs) || 0), 0);
    const validRates = data.filter(u => Number(u.rate_per_thousand_stitches) > 0);
    const avgRate = validRates.length > 0 
      ? (validRates.reduce((sum, u) => sum + Number(u.rate_per_thousand_stitches), 0) / validRates.length).toFixed(2)
      : '0.00';
    return { total, active, totalDailyPcs, avgRate };
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(unit => {
      const matchType = typeFilter === 'all' || unit.unit_type === typeFilter;
      const matchStatus = statusFilter === 'all' || unit.status === statusFilter;
      return matchType && matchStatus;
    });
  }, [data, typeFilter, statusFilter]);

  const handleOpenAdd = () => {
    setEditingUnit(null);
    const nextNum = data.length + 1;
    const nextCode = `EMB-${String(nextNum).padStart(3, '0')}`;
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
      errors.name = 'Embroidery unit name is required';
    }
    if (!form.phone.trim()) {
      errors.phone = 'Contact phone number is required';
    }
    if (!form.code.trim()) {
      errors.code = 'Unit code is required';
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

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this Embroidery Unit?')) return;
    setDeletingId(id);
    try {
      await api.deleteEmbroideryWork(id);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete embroidery unit');
    } finally {
      setDeletingId(null);
    }
  };

  const columns: Column<EmbroideryWork>[] = [
    {
      key: 'name',
      label: 'Unit Information & Machinery',
      render: (unit: EmbroideryWork) => (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-50 border border-pink-200 flex items-center justify-center text-pink-600 font-bold text-xs shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900 hover:text-pink-600 cursor-pointer" onClick={() => handleOpenEdit(unit)}>
              {unit.name}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-medium border border-gray-200">
                {unit.code}
              </span>
              <span className="text-xs text-pink-700 bg-pink-50 px-2 py-0.5 rounded-full font-medium">
                {unit.unit_type || 'Multi-Head'}
              </span>
            </div>
            {unit.machine_heads && (
              <p className="text-xs text-gray-600 font-medium mt-1 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-pink-500" />
                {unit.machine_heads}
              </p>
            )}
            {unit.embroidery_types && (
              <p className="text-[11px] text-gray-500 line-clamp-1 italic mt-0.5">
                {unit.embroidery_types}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact Details',
      render: (unit: EmbroideryWork) => (
        <div className="text-xs space-y-1">
          {unit.contact_person && (
            <div className="font-medium text-gray-800 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {unit.contact_person}
            </div>
          )}
          <div className="text-gray-600 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>{unit.phone || '-'}</span>
          </div>
          {unit.email && (
            <div className="text-gray-500 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate max-w-[170px]">{unit.email}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      render: (unit: EmbroideryWork) => (
        <div className="text-xs text-gray-700 space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-gray-900">
            <MapPin className="w-3.5 h-3.5 text-pink-500 shrink-0" />
            <span>{unit.city || 'Tirupur'}{unit.state ? `, ${unit.state}` : ''}</span>
          </div>
          {unit.address && (
            <p className="text-gray-500 line-clamp-2 max-w-[200px] text-[11px] leading-relaxed">
              {unit.address}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'capacity',
      label: 'Capacity & Base Rates',
      render: (unit: EmbroideryWork) => (
        <div className="text-xs space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-semibold text-gray-900">
              {unit.daily_capacity_pcs ? Number(unit.daily_capacity_pcs).toLocaleString() : '0'}
            </span>
            <span className="text-gray-500">Pcs / Day</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-700 font-medium">
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span>₹{unit.rate_per_thousand_stitches ?? '0.00'} <span className="text-gray-500 font-normal">/ 1K stitches</span></span>
          </div>
        </div>
      ),
    },
    {
      key: 'tax_terms',
      label: 'GSTIN & Credit',
      render: (unit: EmbroideryWork) => (
        <div className="text-xs space-y-1">
          <div className="font-mono text-gray-700 text-[11px]">
            {unit.gstin || <span className="text-gray-400 italic">No GSTIN</span>}
          </div>
          <div className="text-gray-500">
            Terms: <span className="font-medium text-gray-800">{unit.payment_terms_days ?? 30} Days</span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (unit: EmbroideryWork) => <StatusBadge status={unit.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (unit: EmbroideryWork) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenEdit(unit)}
            title="Edit Embroidery Unit"
            className="text-gray-600 hover:text-pink-600 hover:bg-pink-50"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(unit.id)}
            disabled={deletingId === unit.id}
            title="Delete Embroidery Unit"
            className="text-gray-400 hover:text-rose-600 hover:bg-rose-50"
          >
            {deletingId === unit.id ? (
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
        title="Embroidery Work Master"
        subtitle="Manage computerized embroidery units, jobworkers, multi-head facilities, and stitch pricing models"
        breadcrumb={[
          { label: 'Masters', href: '/masters' },
          { label: 'Embroidery Works' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleOpenAdd} className="bg-pink-600 hover:bg-pink-700 text-white shadow-sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Embroidery Unit
            </Button>
          </div>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Embroidery Units</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
            <div className="text-xs text-gray-500 mt-0.5">Registered jobwork units</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600">
            <Scissors className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Units</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</div>
            <div className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Work Orders
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Daily Production Capacity</div>
            <div className="text-2xl font-bold text-indigo-600 mt-1">{stats.totalDailyPcs.toLocaleString()} <span className="text-sm font-normal text-gray-500">Pcs</span></div>
            <div className="text-xs text-indigo-600 mt-0.5 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Total output per day
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Base Rate</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">₹{stats.avgRate}</div>
            <div className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5" /> Per 1,000 stitches
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Coins className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
            <Filter className="w-4 h-4 text-gray-400" />
            <span>Unit Type:</span>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          >
            <option value="all">All Unit Types ({data.length})</option>
            {UNIT_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-xs font-medium text-gray-600 ml-2">
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <div className="text-xs text-gray-500 font-medium">
          Showing <span className="text-gray-900 font-bold">{filteredData.length}</span> of {data.length} Units
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        data={filteredData}
        columns={columns}
        rowKey="id"
        searchable={true}
        emptyMessage="No embroidery units found matching your search and filter criteria."
      />

      {/* Add / Edit Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingUnit ? `Edit Embroidery Unit: ${editingUnit.name}` : 'Register New Embroidery Unit'}
        subtitle={editingUnit ? 'Update embroidery machinery specs, rate models, and capacity.' : 'Add a new embroidery jobworker or partner facility for Stage 06 Embroidery Work Orders.'}
        width="max-w-2xl"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-pink-600 hover:bg-pink-700 text-white min-w-[100px]">
              {saving ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </div>
              ) : editingUnit ? (
                'Save Changes'
              ) : (
                'Create Unit'
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
            <FormField label="Unit Code" required error={validationErrors.code}>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. EMB-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-pink-500 focus:outline-none uppercase"
              />
            </FormField>

            <FormField label="Unit / Vendor Name" required error={validationErrors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sri Krishna Embroidery Works"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Unit Type / Setup" required>
              <select
                value={form.unit_type}
                onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
              >
                {UNIT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Machinery & Heads">
              <input
                type="text"
                value={form.machine_heads}
                onChange={(e) => setForm({ ...form, machine_heads: e.target.value })}
                placeholder="e.g. 20-Head Tajima (15-Needle) High Speed"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
              />
            </FormField>
          </div>

          <div>
            <FormField label="Embroidery Specialization / Stitch Capabilities">
              <input
                type="text"
                value={form.embroidery_types}
                onChange={(e) => setForm({ ...form, embroidery_types: e.target.value })}
                placeholder="e.g. 3D Puff, Applique, Sequin Attachment, Badges, Cording"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Rate per 1,000 Stitches (₹)">
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-gray-500 pointer-events-none">₹</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.rate_per_thousand_stitches}
                  onChange={(e) => setForm({ ...form, rate_per_thousand_stitches: e.target.value })}
                  placeholder="0.85"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </div>
            </FormField>

            <FormField label="Daily Capacity (Pcs / Day)">
              <div className="relative">
                <input
                  type="number"
                  value={form.daily_capacity_pcs}
                  onChange={(e) => setForm({ ...form, daily_capacity_pcs: e.target.value })}
                  placeholder="3500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs text-gray-400 pointer-events-none">Pcs</span>
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
                  placeholder="e.g. Mr. R. Palanisamy"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </FormField>

              <FormField label="Phone Number" required error={validationErrors.phone}>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. 98430 45678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <FormField label="Email Address">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. orders@krishnaemb.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </FormField>

              <FormField label="City / Region">
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="e.g. Tirupur"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </FormField>
            </div>

            <div className="mt-4">
              <FormField label="Full Address">
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="SF No., Angeripalayam Main Road, Tirupur"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
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
                  placeholder="33AAAAA0000B1Z8"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </FormField>

              <FormField label="Payment Terms (Days)">
                <input
                  type="number"
                  value={form.payment_terms_days}
                  onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })}
                  placeholder="30"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </FormField>

              <FormField label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
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
