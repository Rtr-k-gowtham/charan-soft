// src/pages/masters/Suppliers.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';
import { Supplier, Category } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import SearchableSelect, { SelectOption } from '../../components/ui/SearchableSelect';
import { Plus, RefreshCw, Pencil, Trash2, AlertCircle, Filter, Tag } from 'lucide-react';
import { getCategoryVisual } from './Categories';

interface SupplierFormData {
  name: string;
  category_id: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  payment_terms_days: string;
  status: 'active' | 'inactive';
}

const defaultForm: SupplierFormData = {
  name: '',
  category_id: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  gstin: '',
  payment_terms_days: '30',
  status: 'active',
};

export default function Suppliers() {
  const [data, setData] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<SupplierFormData>(defaultForm);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    try {
      const [suppliersRes, categoriesRes] = await Promise.all([
        api.getSuppliers().catch(() => []),
        api.getCategories().catch(() => []),
      ]);
      setData((suppliersRes || []) as Supplier[]);
      setCategories((categoriesRes || []) as Category[]);
    } catch {
      setData([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Category options for SearchableSelect
  const categoryOptions: SelectOption[] = useMemo(() => {
    return categories.map(cat => ({
      value: String(cat.id),
      label: cat.name,
      sublabel: cat.code ? `Code: ${cat.code}` : undefined,
    }));
  }, [categories]);

  // Count unassigned suppliers
  const unassignedCount = useMemo(() => {
    return data.filter(s => !s.category_id).length;
  }, [data]);

  // Filtered suppliers based on category filter
  const filteredData = useMemo(() => {
    if (categoryFilter === 'all') return data;
    if (categoryFilter === 'unassigned') return data.filter(s => !s.category_id);
    return data.filter(s => String(s.category_id) === String(categoryFilter));
  }, [data, categoryFilter]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setForm(defaultForm);
    setValidationErrors({});
    setError('');
    setDrawerOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name || '',
      category_id: supplier.category_id ? String(supplier.category_id) : '',
      contact_person: supplier.contact_person || '',
      phone: supplier.phone && supplier.phone !== 'N/A' ? supplier.phone : '',
      email: supplier.email || '',
      address: supplier.address || '',
      gstin: supplier.gstin || '',
      payment_terms_days: String(supplier.payment_terms_days ?? 30),
      status: (supplier.status as 'active' | 'inactive') || 'active',
    });
    setValidationErrors({});
    setError('');
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors.name = 'Supplier name is required';
    }

    if (!form.category_id) {
      errors.category_id = 'Supplier category is required. Please select a category.';
    }

    if (!form.phone.trim()) {
      errors.phone = 'Phone number is required';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please resolve all required fields before saving.');
      return;
    }

    setSaving(true);
    setError('');
    setValidationErrors({});

    try {
      const payload = {
        name: form.name.trim(),
        category_id: Number(form.category_id),
        contact_person: form.contact_person.trim(),
        phone: form.phone.trim() || 'N/A',
        email: form.email.trim(),
        address: form.address.trim(),
        gstin: form.gstin.trim(),
        payment_terms_days: Number(form.payment_terms_days) || 30,
        status: form.status,
      };

      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.id, payload);
      } else {
        const autoCode = `SUP-${String(data.length + 1).padStart(3, '0')}`;
        await api.createSupplier({
          ...payload,
          code: autoCode,
        });
      }

      setDrawerOpen(false);
      setEditingSupplier(null);
      setForm(defaultForm);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!window.confirm(`Are you sure you want to delete supplier "${supplier.name}"?`)) {
      return;
    }
    setDeletingId(supplier.id);
    try {
      await api.deleteSupplier(supplier.id);
      await load();
    } catch (e: unknown) {
      alert((e as Error).message || 'Failed to delete supplier');
    } finally {
      setDeletingId(null);
    }
  };

  // Recommended column order:
  // Code, Supplier Name, Category, Contact, Phone, Email, GSTIN, Payment Terms, Status, Actions
  const columns = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      render: (r: Supplier) => (
        <span className="font-mono text-[10px] text-slate-500 font-semibold">{r.code}</span>
      ),
    },
    {
      key: 'name',
      label: 'Supplier Name',
      sortable: true,
      render: (r: Supplier) => <span className="font-semibold text-slate-800">{r.name}</span>,
    },
    {
      key: 'category_name',
      label: 'Category',
      sortable: true,
      render: (r: Supplier) => {
        if (!r.category_id && !r.category_name) {
          return (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEdit(r);
              }}
              title="Click to assign category"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Unassigned
            </span>
          );
        }

        const visual = getCategoryVisual({
          icon: r.category_icon,
          name: r.category_name,
          code: r.category_code,
        });
        const IconComponent = visual.Icon;

        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${visual.bg} ${visual.color} border ${visual.border}`}
          >
            <IconComponent className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[150px]">{r.category_name}</span>
          </span>
        );
      },
    },
    {
      key: 'contact_person',
      label: 'Contact',
      render: (r: Supplier) => (
        <span className="text-slate-600 text-xs">{r.contact_person || '—'}</span>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (r: Supplier) => (
        <span className="text-slate-700 font-mono text-xs">{r.phone || '—'}</span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (r: Supplier) => (
        <span className="text-brand-600 text-xs">{r.email || '—'}</span>
      ),
    },
    {
      key: 'gstin',
      label: 'GSTIN',
      render: (r: Supplier) => (
        <span className="font-mono text-[10px] text-slate-600">{r.gstin || '—'}</span>
      ),
    },
    {
      key: 'payment_terms_days',
      label: 'Payment Terms',
      render: (r: Supplier) => (
        <span className="text-slate-600 text-xs">{r.payment_terms_days} days</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Supplier) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="Suppliers"
        subtitle="Manage supplier master records and category assignments"
        breadcrumb={[{ label: 'Masters' }, { label: 'Suppliers' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 py-1 shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="text-xs bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All Categories ({data.length})</option>
                <option value="unassigned">⚠️ Unassigned ({unassignedCount})</option>
                {categories.length > 0 && (
                  <optgroup label="Categories">
                    {categories.map(c => {
                      const count = data.filter(s => s.category_id === c.id).length;
                      return (
                        <option key={c.id} value={String(c.id)}>
                          {c.name} ({count})
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
            </div>

            <button
              onClick={load}
              disabled={loading}
              title="Refresh suppliers"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={handleOpenAdd}>
              Add Supplier
            </Button>
          </div>
        }
      />

      {/* Unassigned Warning Banner */}
      {unassignedCount > 0 && categoryFilter !== 'unassigned' && (
        <div className="shrink-0 mx-2.5 sm:mx-4 mt-2 px-3 py-2 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{unassignedCount} supplier{unassignedCount > 1 ? 's require' : ' requires'} category assignment.</strong> Click each record's edit button or badge to categorize.
            </span>
          </div>
          <button
            onClick={() => setCategoryFilter('unassigned')}
            className="px-2.5 py-1 text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-md transition-colors shrink-0"
          >
            View Unassigned
          </button>
        </div>
      )}

      {categoryFilter === 'unassigned' && (
        <div className="shrink-0 mx-2.5 sm:mx-4 mt-2 px-3 py-2 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center justify-between gap-2 text-xs text-blue-800">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Showing only <strong>Unassigned Suppliers</strong> ({filteredData.length}). Click the edit pencil icon to assign a category.
            </span>
          </div>
          <button
            onClick={() => setCategoryFilter('all')}
            className="px-2.5 py-1 text-xs font-semibold bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-md transition-colors shrink-0"
          >
            Show All
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden p-2.5 sm:p-4 flex flex-col">
        <DataTable
          data={filteredData}
          columns={columns}
          rowKey="id"
          actions={(r: Supplier) => (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleOpenEdit(r)}
                title="Edit Supplier"
                className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(r)}
                disabled={deletingId === r.id}
                title="Delete Supplier"
                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        />
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingSupplier(null);
        }}
        title={editingSupplier ? `Edit Supplier — ${editingSupplier.name}` : 'Add Supplier'}
        width="max-w-xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDrawerOpen(false);
                setEditingSupplier(null);
              }}
            >
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              {editingSupplier ? 'Save Changes' : 'Save Supplier'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {error && (
            <div className="sm:col-span-2 p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Supplier Name */}
          <div className="sm:col-span-2">
            <FormField
              label="Supplier Name"
              required
              value={form.name}
              onChange={e => {
                setForm(f => ({ ...f, name: e.target.value }));
                if (e.target.value.trim()) setValidationErrors(v => ({ ...v, name: '' }));
              }}
              error={validationErrors.name}
              hint={
                editingSupplier
                  ? `Supplier Code: ${editingSupplier.code}`
                  : 'Supplier Code will be auto-generated (e.g. SUP-001)'
              }
            />
          </div>

          {/* Supplier Category - Required Searchable Dropdown */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supplier Category <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              value={form.category_id}
              onChange={val => {
                setForm(f => ({ ...f, category_id: val }));
                if (val) setValidationErrors(v => ({ ...v, category_id: '' }));
              }}
              options={categoryOptions}
              placeholder="Select Supplier Category"
              searchPlaceholder="Search categories..."
              clearable={false}
              error={validationErrors.category_id}
            />
            {validationErrors.category_id && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {validationErrors.category_id}
              </p>
            )}
            <p className="mt-1 text-[11px] text-slate-400">
              Select category from the Categories Master to categorize this supplier.
            </p>
          </div>

          {/* Contact Person */}
          <FormField
            label="Contact Person"
            value={form.contact_person}
            onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
            placeholder="e.g. S. Murugesan"
          />

          {/* Phone */}
          <FormField
            label="Phone"
            required
            value={form.phone}
            onChange={e => {
              setForm(f => ({ ...f, phone: e.target.value }));
              if (e.target.value.trim()) setValidationErrors(v => ({ ...v, phone: '' }));
            }}
            error={validationErrors.phone}
            placeholder="e.g. +91 94433 11223"
          />

          {/* Email */}
          <FormField
            label="Email"
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="sales@company.com"
          />

          {/* GSTIN */}
          <FormField
            label="GSTIN"
            value={form.gstin}
            onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))}
            placeholder="e.g. 33AABCT9988C1Z4"
          />

          {/* Payment Terms */}
          <FormField
            label="Payment Terms (days)"
            type="number"
            value={form.payment_terms_days}
            onChange={e => setForm(f => ({ ...f, payment_terms_days: e.target.value }))}
          />

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Status
            </label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-brand-500 font-medium"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Address */}
          <div className="sm:col-span-2">
            <FormField
              as="textarea"
              label="Address"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              rows={2}
              placeholder="Door No, Street, City, State, PIN"
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
