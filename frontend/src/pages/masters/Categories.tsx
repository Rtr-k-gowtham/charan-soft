// src/pages/masters/Categories.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Category, CategoryField } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import {
  Plus,
  RefreshCw,
  Trash2,
  ArrowLeft,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  ListPlus,
  AlertCircle
} from 'lucide-react';

const FIELD_TYPES = [
  { value: 'text', label: 'Text / String' },
  { value: 'number', label: 'Integer Number' },
  { value: 'decimal', label: 'Decimal / Price' },
  { value: 'select', label: 'Dropdown Options' },
  { value: 'textarea', label: 'Long Text / Notes' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Yes / No Checkbox' },
];

export default function Categories() {
  const [data, setData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // New Category Drawer
  const [createCatOpen, setCreateCatOpen] = useState(false);
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');
  const [catForm, setCatForm] = useState({ name: '', description: '' });

  // Add Item/Field to Category Modal
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [itemSaving, setItemSaving] = useState(false);
  const [itemError, setItemError] = useState('');
  const [itemForm, setItemForm] = useState({
    field_label: '',
    field_name: '',
    field_type: 'text',
    is_required: false,
    is_visible: true,
  });

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await api.getCategories();
      const list = (res || []) as Category[];
      setData(list);

      // If viewing a category detail, update it
      if (selectedCategory) {
        const updated = list.find(c => c.id === selectedCategory.id);
        if (updated) setSelectedCategory(updated);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreateCategory = async () => {
    if (!catForm.name.trim()) {
      setCatError('Category name is required');
      return;
    }
    setCatSaving(true);
    setCatError('');
    const autoCode = 'CAT_' + catForm.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_');
    try {
      await api.createCategory({
        name: catForm.name.trim(),
        description: catForm.description.trim() || undefined,
        code: autoCode,
        fields: [],
      });
      setCreateCatOpen(false);
      setCatForm({ name: '', description: '' });
      await loadCategories();
    } catch (e: unknown) {
      setCatError((e as Error).message || 'Failed to create category');
    } finally {
      setCatSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!selectedCategory) return;
    if (!itemForm.field_label.trim()) {
      setItemError('Item / Field label is required');
      return;
    }
    setItemSaving(true);
    setItemError('');
    const fieldName = itemForm.field_name.trim() ||
      itemForm.field_label.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

    try {
      await api.addCategoryField(selectedCategory.id, {
        ...itemForm,
        field_name: fieldName,
        category_id: selectedCategory.id,
      });
      setAddItemOpen(false);
      setItemForm({
        field_label: '',
        field_name: '',
        field_type: 'text',
        is_required: false,
        is_visible: true,
      });
      await loadCategories();
    } catch (e: unknown) {
      setItemError((e as Error).message || 'Failed to add item to category');
    } finally {
      setItemSaving(false);
    }
  };

  const handleDeleteItem = async (fieldId: number) => {
    if (!selectedCategory) return;
    if (!confirm('Are you sure you want to remove this item / field from the category?')) return;
    try {
      await api.deleteCategoryField(selectedCategory.id, fieldId);
      await loadCategories();
    } catch (e: unknown) {
      alert((e as Error).message || 'Failed to delete item');
    }
  };

  const handleDeleteCategory = async (catId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await api.deleteCategory(catId);
      if (selectedCategory?.id === catId) setSelectedCategory(null);
      await loadCategories();
    } catch (e: unknown) {
      alert((e as Error).message || 'Failed to delete category');
    }
  };

  // Columns for Master Categories Table
  const masterColumns = [
    {
      key: 'code',
      label: 'Category Code',
      sortable: true,
      render: (r: Category) => (
        <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
          {r.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Category Name',
      sortable: true,
      render: (r: Category) => (
        <div>
          <span className="font-semibold text-slate-800 text-xs block">{r.name}</span>
          {r.description && <span className="text-[11px] text-slate-400 truncate max-w-xs block">{r.description}</span>}
        </div>
      ),
    },
    {
      key: 'fields_count',
      label: 'Items / Fields',
      render: (r: Category) => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
          <Layers className="w-3 h-3 text-slate-400" />
          {(r.fields || []).length} items
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Category) => <StatusBadge status={r.status || 'active'} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: Category) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedCategory(r)}
            className="px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-md transition-colors"
          >
            Manage Items →
          </button>
          <button
            onClick={(e) => handleDeleteCategory(r.id, e)}
            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
            title="Delete Category"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  // Columns for Category Items Detail Table
  const itemColumns = [
    {
      key: 'sort_order',
      label: '#',
      render: (f: CategoryField, index: number) => (
        <span className="text-slate-400 font-mono text-xs font-semibold">{f.sort_order || index + 1}</span>
      ),
    },
    {
      key: 'field_label',
      label: 'Item / Field Label',
      sortable: true,
      render: (f: CategoryField) => (
        <span className="font-semibold text-slate-800 text-xs">{f.field_label}</span>
      ),
    },
    {
      key: 'field_name',
      label: 'Key / Slug',
      render: (f: CategoryField) => (
        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
          {f.field_name}
        </span>
      ),
    },
    {
      key: 'field_type',
      label: 'Data Type',
      render: (f: CategoryField) => (
        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium font-mono capitalize">
          {f.field_type}
        </span>
      ),
    },
    {
      key: 'is_required',
      label: 'Mandatory',
      render: (f: CategoryField) => f.is_required ? (
        <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-bold">
          Required
        </span>
      ) : (
        <span className="text-slate-400 text-xs">Optional</span>
      ),
    },
    {
      key: 'is_visible',
      label: 'Visibility',
      render: (f: CategoryField) => f.is_visible !== false ? (
        <span className="text-emerald-600 text-xs font-medium">Visible</span>
      ) : (
        <span className="text-slate-400 text-xs">Hidden</span>
      ),
    },
    {
      key: 'actions',
      label: 'Action',
      render: (f: CategoryField) => (
        <button
          onClick={() => handleDeleteItem(f.id)}
          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
          title="Remove Item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  // -------------------------------------------------------------
  // DETAIL VIEW (When a category is selected)
  // -------------------------------------------------------------
  if (selectedCategory) {
    const fieldsList = selectedCategory.fields || [];

    return (
      <div className="flex flex-col h-full bg-slate-50/50">
        <PageHeader
          title={selectedCategory.name}
          subtitle={`Manage items and specifications for category code ${selectedCategory.code}`}
          breadcrumb={[
            { label: 'Masters' },
            { label: 'Categories Master' },
            { label: selectedCategory.name },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                icon={<ArrowLeft className="w-3.5 h-3.5" />}
                onClick={() => setSelectedCategory(null)}
              >
                Back to Master
              </Button>
              <button
                onClick={loadCategories}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 bg-white"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <Button
                icon={<ListPlus className="w-3.5 h-3.5" />}
                onClick={() => setAddItemOpen(true)}
              >
                Add Item / Field
              </Button>
            </div>
          }
        />

        {/* Category Details Banner */}
        <div className="p-4 pb-2">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">{selectedCategory.name}</h2>
                  <StatusBadge status={selectedCategory.status || 'active'} />
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Code: <span className="font-semibold text-slate-700">{selectedCategory.code}</span>
                  {selectedCategory.description && ` • ${selectedCategory.description}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Configured Items</span>
                <span className="text-lg font-bold text-slate-800">{fieldsList.length}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Required Items</span>
                <span className="text-lg font-bold text-red-600">{fieldsList.filter(f => f.is_required).length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1 overflow-hidden p-4 pt-2">
          <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-full shadow-xs">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Category Items & Field Definitions</h3>
                <p className="text-[11px] text-slate-400">Items configured here automatically appear in purchase orders, materials, and production forms for this category.</p>
              </div>
              <Button
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setAddItemOpen(true)}
              >
                Add Item
              </Button>
            </div>
            <div className="flex-1 overflow-hidden p-2">
              <DataTable
                data={fieldsList}
                columns={itemColumns}
                rowKey="id"
              />
            </div>
          </div>
        </div>

        {/* Add Item Modal */}
        <Modal
          open={addItemOpen}
          onClose={() => setAddItemOpen(false)}
          title={`Add Item / Field to "${selectedCategory.name}"`}
        >
          <div className="space-y-4">
            {itemError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-md flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {itemError}
              </div>
            )}

            <FormField
              label="Item / Field Label"
              required
              value={itemForm.field_label}
              onChange={e => setItemForm(f => ({ ...f, field_label: e.target.value }))}
              placeholder="e.g. Fabric GSM, Width, Yarn Count, Needle Type"
              hint="The display label that users will see on forms"
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Item Key / Slug (Optional)"
                value={itemForm.field_name}
                onChange={e => setItemForm(f => ({ ...f, field_name: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_') }))}
                placeholder="auto-generated from label"
                hint="e.g. fabric_gsm"
              />

              <FormField
                as="select"
                label="Data Type"
                value={itemForm.field_type}
                onChange={e => setItemForm(f => ({ ...f, field_type: e.target.value }))}
              >
                {FIELD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </FormField>
            </div>

            <div className="flex items-center gap-6 p-3 bg-slate-50 border border-slate-200 rounded-md">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={itemForm.is_required}
                  onChange={e => setItemForm(f => ({ ...f, is_required: e.target.checked }))}
                  className="w-4 h-4 accent-brand-600 rounded"
                />
                Mandatory / Required Field
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={itemForm.is_visible}
                  onChange={e => setItemForm(f => ({ ...f, is_visible: e.target.checked }))}
                  className="w-4 h-4 accent-brand-600 rounded"
                />
                Visible in Forms & Tables
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setAddItemOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddItem} disabled={itemSaving}>
                {itemSaving ? 'Saving...' : 'Add Item'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MASTER UI (Categories list)
  // -------------------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader
        title="Categories Master"
        subtitle="Master catalog of production categories, order types, and specifications"
        breadcrumb={[{ label: 'Masters' }, { label: 'Categories' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadCategories}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 bg-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setCatError('');
                setCatForm({ name: '', description: '' });
                setCreateCatOpen(true);
              }}
            >
              Add Category
            </Button>
          </div>
        }
      />

      {/* Categories DataTable */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-full shadow-xs">
          <DataTable
            data={data}
            columns={masterColumns}
            rowKey="id"
            onRowClick={(cat: Category) => setSelectedCategory(cat)}
          />
        </div>
      </div>

      {/* Add Category Drawer */}
      <Drawer
        open={createCatOpen}
        onClose={() => setCreateCatOpen(false)}
        title="Add New Category"
        subtitle="Define a new category master with automated code generation"
        width="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateCatOpen(false)}>
              Cancel
            </Button>
            <Button loading={catSaving} onClick={handleCreateCategory}>
              Create Category
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {catError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {catError}
            </div>
          )}

          <FormField
            label="Category Name"
            required
            value={catForm.name}
            onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. YARN PURCHASE ORDER, FABRIC WEAVING"
            hint="Category Code will be automatically generated (e.g. CAT_YARN_PURCHASE_ORDER)"
          />

          <FormField
            as="textarea"
            label="Description / Purpose"
            value={catForm.description}
            onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Provide context on where this category is used..."
            rows={3}
          />
        </div>
      </Drawer>
    </div>
  );
}
