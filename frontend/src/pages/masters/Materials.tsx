// src/pages/masters/Materials.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';
import { Material, Category, Supplier, Buyer } from '../../types';
import { getBuyerColorsWithLocal } from '../../components/buyers/BuyerColorsModal';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, RefreshCw, Edit2, Trash2, AlertCircle, CheckCircle2, Star, Palette } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);

export default function Materials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Delete modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState<Material | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [form, setForm] = useState({
    category_id: '',
    supplier_id: '',
    buyer_id: '',
    code: '',
    name: '',
    uom: 'KG',
    purchase_rate: '',
    tax_percent: '5',
    min_stock_level: '',
    spec: '',
    color: '',
    design: '',
  });

  const load = async (catId?: number) => {
    setLoading(true);
    try {
      const [matData, catData, supData, buyerData] = await Promise.all([
        api.getMaterials(catId),
        api.getCategories(),
        api.getSuppliers(),
        api.getBuyers(),
      ]);
      setMaterials((matData || []) as Material[]);
      setCategories((catData || []) as Category[]);
      setSuppliers((supData || []) as Supplier[]);
      setBuyers((buyerData || []) as Buyer[]);
    } catch {
      setMaterials([]);
      setCategories([]);
      setSuppliers([]);
      setBuyers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filterCat ?? undefined);
  }, [filterCat]);

  const selectedBuyer = useMemo(() => {
    if (!form.buyer_id) return null;
    return buyers.find((b) => String(b.id) === String(form.buyer_id)) || null;
  }, [form.buyer_id, buyers]);

  const selectedBuyerBrandColors = useMemo(() => {
    if (!selectedBuyer) return [];
    return getBuyerColorsWithLocal(selectedBuyer);
  }, [selectedBuyer]);

  // Open Drawer in Create mode
  const openCreate = () => {
    setEditingMaterial(null);
    setForm({
      category_id: categories.length > 0 ? String(categories[0].id) : '',
      supplier_id: '',
      buyer_id: '',
      code: '',
      name: '',
      uom: 'KG',
      purchase_rate: '',
      tax_percent: '5',
      min_stock_level: '',
      spec: '',
      color: '',
      design: '',
    });
    setError('');
    setDrawerOpen(true);
  };

  // Open Drawer in Edit mode
  const openEdit = (mat: Material) => {
    setEditingMaterial(mat);
    // Find dynamic fields if populated
    const dynFields = (mat as any).dynamic_fields || [];
    const getVal = (name: string) => dynFields.find((f: any) => f.field_name === name)?.field_value || '';

    setForm({
      category_id: String(mat.category_id || ''),
      supplier_id: mat.supplier_id ? String(mat.supplier_id) : '',
      buyer_id: (mat as any).buyer_id ? String((mat as any).buyer_id) : '',
      code: mat.code,
      name: mat.name,
      uom: mat.uom || 'KG',
      purchase_rate: String(mat.purchase_rate ?? ''),
      tax_percent: String(mat.tax_percent ?? '5'),
      min_stock_level: String(mat.min_stock_level ?? ''),
      spec: getVal('spec'),
      color: getVal('color'),
      design: getVal('design'),
    });
    setError('');
    setDrawerOpen(true);
  };

  // Save (Create or Update)
  const handleSave = async () => {
    if (!form.category_id || !form.name) {
      setError('Category and material name are required');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const payload: any = {
        category_id: parseInt(form.category_id),
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
        buyer_id: form.buyer_id ? parseInt(form.buyer_id) : null,
        name: form.name,
        uom: form.uom,
        purchase_rate: parseFloat(form.purchase_rate) || 0,
        tax_percent: parseFloat(form.tax_percent) || 5,
        min_stock_level: parseFloat(form.min_stock_level) || 0,
        dynamic_values: {
          spec: form.spec.trim(),
          color: form.color.trim(),
          design: form.design.trim(),
        },
      };

      if (editingMaterial) {
        // Edit existing material - strictly preserve existing code
        await api.updateMaterial(editingMaterial.id, payload);
        setSuccessMsg(`Material '${form.name}' updated successfully.`);
      } else {
        // Create new material
        const autoCode = `MAT-${(materials.length + 1).toString().padStart(4, '0')}`;
        await api.createMaterial({
          ...payload,
          code: autoCode,
        });
        setSuccessMsg(`Material '${form.name}' created successfully.`);
      }

      setDrawerOpen(false);
      load(filterCat ?? undefined);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Open Delete confirmation dialog
  const openDelete = (mat: Material) => {
    setDeletingMaterial(mat);
    setDeleteError('');
    setDeleteModalOpen(true);
  };

  // Confirm safe delete
  const handleConfirmDelete = async () => {
    if (!deletingMaterial) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await api.deleteMaterial(deletingMaterial.id);
      setDeleteModalOpen(false);
      setSuccessMsg(`Material '${deletingMaterial.name}' (${deletingMaterial.code}) deleted successfully.`);
      load(filterCat ?? undefined);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setDeleteError((e as Error).message || 'Failed to delete material');
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      render: (r: Material) => <span className="font-mono text-[10px] text-slate-500 font-semibold">{r.code}</span>,
    },
    {
      key: 'name',
      label: 'Material Name',
      sortable: true,
      render: (r: Material) => {
        const dynFields = (r as any).dynamic_fields || [];
        const colorVal = dynFields.find((f: any) => f.field_name === 'color')?.field_value;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800">{r.name}</span>
            {colorVal && (
              <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                <Palette className="w-3 h-3 text-brand-500 shrink-0" />
                <span>Color: {colorVal}</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'buyer_name',
      label: 'Buyer',
      sortable: true,
      render: (r: any) =>
        r.buyer_name ? (
          <span className="inline-flex items-center gap-1 font-semibold text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
            {r.buyer_name}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
    {
      key: 'category_name',
      label: 'Category',
      sortable: true,
      render: (r: Material) => <span className="text-[10px] text-slate-400">{r.category_name}</span>,
    },
    {
      key: 'supplier_name',
      label: 'Supplier',
      sortable: true,
      render: (r: Material) => <span className="text-slate-500">{r.supplier_name || '—'}</span>,
    },
    { key: 'uom', label: 'UOM' },
    {
      key: 'purchase_rate',
      label: 'Rate',
      render: (r: Material) => <span className="font-mono">₹{fmt(r.purchase_rate)}</span>,
    },
    {
      key: 'tax_percent',
      label: 'Tax%',
      render: (r: Material) => <span className="font-mono">{r.tax_percent}%</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Material) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Materials Master"
        subtitle="Category-driven dynamic material definitions"
        breadcrumb={[{ label: 'Masters' }, { label: 'Materials' }]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => load(filterCat ?? undefined)}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 bg-white"
              title="Refresh Materials"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>
              Add Material
            </Button>
          </div>
        }
      />

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700 text-xs">✕</button>
        </div>
      )}

      {/* Category filter */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white overflow-x-auto">
        <span className="text-[11px] text-slate-500 font-medium shrink-0">Category:</span>
        <button
          onClick={() => setFilterCat(null)}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors ${
            filterCat === null
              ? 'bg-brand-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterCat(c.id)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors ${
              filterCat === c.id
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden p-2.5 sm:p-4">
        <DataTable
          data={materials}
          columns={columns}
          rowKey="id"
          emptyMessage="No materials found"
          actions={(r: Material) => (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(r);
                }}
                className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded transition-colors"
                title="Edit Material"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openDelete(r);
                }}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete Material"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        />
      </div>

      {/* Create / Edit Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingMaterial ? 'Edit Material' : 'Add New Material'}
        subtitle={
          editingMaterial
            ? `Code: ${editingMaterial.code} — Update material specifications and settings`
            : 'Material details are driven by the selected category'
        }
        width="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              {editingMaterial ? 'Update Material' : 'Save Material'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {editingMaterial && (
              <div className="sm:col-span-2">
                <FormField
                  label="Material Code"
                  value={form.code}
                  disabled
                  readOnly
                  hint="Material Code is unique and preserved across edits"
                />
              </div>
            )}

            <FormField
              as="select"
              label="Category"
              required
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
            >
              <option value="">— Select Category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FormField>

            <FormField
              as="select"
              label="UOM"
              required
              value={form.uom}
              onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))}
            >
              {['KG', 'M', 'MTR', 'PCS', 'ROLL', 'CONE', 'SET', 'BOX'].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </FormField>

            <div className="sm:col-span-2">
              <FormField
                label="Material Name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Cotton Fabric 40s"
                hint={
                  editingMaterial
                    ? undefined
                    : 'Material Code will be automatically generated (e.g. MAT-0001)'
                }
              />
            </div>

            {buyers.length > 0 && (
              <div className="sm:col-span-2">
                <FormField
                  as="select"
                  label="Buyer (Optional)"
                  value={form.buyer_id}
                  onChange={(e) => setForm((f) => ({ ...f, buyer_id: e.target.value }))}
                  hint="Link material to a buyer to select from their brand colors"
                >
                  <option value="">— None / General Stock —</option>
                  {buyers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </FormField>
              </div>
            )}

            <FormField
              label="Spec / Construction"
              value={form.spec}
              onChange={(e) => setForm((f) => ({ ...f, spec: e.target.value }))}
              placeholder="e.g. 40s x 60s / 68x68"
            />

            <div className="sm:col-span-2 space-y-1.5">
              <FormField
                label="Color / Finish"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                placeholder="e.g. Navy Blue, Grey Unbleached"
              />

              {/* If buyer is selected and has brand colors, show them as instant click pills */}
              {selectedBuyerBrandColors.length > 0 && (
                <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg space-y-1">
                  <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-amber-800">
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      {selectedBuyer?.name} Brand Colors (Click to apply):
                    </span>
                    <span className="text-[10px] text-amber-600 font-normal">
                      {selectedBuyerBrandColors.length} configured
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {selectedBuyerBrandColors.map((bc, idx) => (
                      <button
                        key={bc.id || idx}
                        type="button"
                        onClick={() => {
                          const colName =
                            (bc.pantone_code && bc.name !== bc.pantone_code
                              ? `${bc.name} (${bc.pantone_code})`
                              : bc.name || bc.pantone_code || bc.hex_code) || '';
                          setForm((f) => ({ ...f, color: colName }));
                        }}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold bg-white hover:bg-amber-100/70 border border-amber-200 text-slate-800 transition cursor-pointer shadow-2xs hover:scale-102"
                        title={`Apply ${bc.name} (${bc.pantone_code || bc.hex_code})`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                          style={{ backgroundColor: bc.hex_code || '#2563EB' }}
                        />
                        <span>{bc.name}</span>
                        {bc.pantone_code && (
                          <span className="text-[9px] font-mono text-slate-400">
                            {bc.pantone_code}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <FormField
              label="Purchase Rate (₹)"
              type="number"
              required
              value={form.purchase_rate}
              onChange={(e) => setForm((f) => ({ ...f, purchase_rate: e.target.value }))}
              min="0"
              step="0.01"
            />
            <FormField
              label="TAX %"
              type="number"
              required
              value={form.tax_percent}
              onChange={(e) => setForm((f) => ({ ...f, tax_percent: e.target.value }))}
              min="0"
              max="100"
              step="0.5"
            />

            <div className="sm:col-span-2">
              <FormField
                label="Minimum Stock Level"
                type="number"
                required
                value={form.min_stock_level}
                onChange={(e) => setForm((f) => ({ ...f, min_stock_level: e.target.value }))}
                hint="Alert will appear when stock falls below this level"
                min="0"
              />
            </div>

            {suppliers.length > 0 && (
              <div className="sm:col-span-2">
                <FormField
                  as="select"
                  label="Preferred Supplier"
                  value={form.supplier_id}
                  onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                >
                  <option value="">— None / General Supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </FormField>
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => !deleteLoading && setDeleteModalOpen(false)}
        title="Confirm Material Deletion"
        subtitle="Safe deletion check for transaction dependencies"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              loading={deleteLoading}
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Delete Material
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          {deleteError ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-800 mb-0.5">Cannot Delete Material</p>
                <p className="leading-relaxed">{deleteError}</p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-600 space-y-2">
              <p>
                Are you sure you want to delete the material{' '}
                <strong className="text-slate-800 font-semibold">
                  {deletingMaterial?.name}
                </strong>{' '}
                (<span className="font-mono text-slate-700">{deletingMaterial?.code}</span>)?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-500 space-y-1">
                <p className="font-medium text-slate-700">Safety Check Rules:</p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                  <li>Materials with purchase order items cannot be deleted.</li>
                  <li>Materials with receipt records or stock ledger history cannot be deleted.</li>
                  <li>Materials with active stock balances cannot be deleted.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
