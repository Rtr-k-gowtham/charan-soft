// src/pages/masters/ColorsPage.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, Edit2, AlertCircle, RefreshCw } from 'lucide-react';

interface ColorRecord {
  id: number;
  code?: string;
  name: string;
  hex_code: string;
  pantone_code?: string;
  status?: string;
}

export default function ColorsPage() {
  const [colors, setColors] = useState<ColorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editColor, setEditColor] = useState<ColorRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ code: '', name: '', hex_code: '#1e3a8a', pantone_code: '', status: 'active' });

  const loadData = () => {
    setLoading(true);
    api.getColors()
      .then(d => setColors((d || []) as ColorRecord[]))
      .catch(() => setColors([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditColor(null);
    setForm({ code: '', name: '', hex_code: '#1e3a8a', pantone_code: '', status: 'active' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (c: ColorRecord) => {
    setEditColor(c);
    setForm({
      code: c.code || '',
      name: c.name,
      hex_code: c.hex_code || '#1e3a8a',
      pantone_code: c.pantone_code || '',
      status: c.status || 'active'
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Color name is required');
      return;
    }
    setSaving(true);
    setError('');
    // Normalize Pantone code: trim and uppercase standard suffixes (e.g., "19-4052 tcx" -> "19-4052 TCX")
    const normalizedPantone = form.pantone_code.trim().toUpperCase();

    try {
      if (editColor) {
        await api.updateColor(editColor.id, {
          name: form.name.trim(),
          code: form.code.trim(),
          hex_code: form.hex_code,
          pantone_code: normalizedPantone,
          status: form.status
        });
      } else {
        await api.createColor({
          name: form.name.trim(),
          code: form.code.trim(),
          hex_code: form.hex_code,
          pantone_code: normalizedPantone
        });
      }
      setModalOpen(false);
      loadData();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save color');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      width: '110px',
      render: (r: ColorRecord) => <span className="font-mono text-[11px] font-semibold">{r.code || `CLR-${r.id}`}</span>
    },
    {
      key: 'name',
      label: 'Color Name',
      sortable: true,
      render: (r: ColorRecord) => (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full border border-slate-200 shrink-0 shadow-xs" style={{ backgroundColor: r.hex_code || '#64748b' }} />
          <span className="font-medium text-slate-800">{r.name}</span>
        </div>
      )
    },
    {
      key: 'pantone_code',
      label: 'Pantone Color Code',
      sortable: true,
      render: (r: ColorRecord) => r.pantone_code ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md text-xs font-mono font-semibold text-amber-900">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0 border border-amber-300" style={{ backgroundColor: r.hex_code || '#D4A017' }} />
          {r.pantone_code}
        </span>
      ) : <span className="text-slate-400 text-xs italic">Not assigned</span>
    },
    {
      key: 'status',
      label: 'Status',
      width: '90px',
      render: (r: ColorRecord) => <StatusBadge status={r.status || 'active'} />
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Colors"
        subtitle="Manage Pantone color codes used in products and production orders"
        breadcrumb={[{ label: 'Masters' }, { label: 'Colors' }]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              title="Refresh Colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>
              Add Color
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-4">
        <DataTable
          data={colors}
          columns={columns}
          rowKey="id"
          actions={(r: ColorRecord) => (
            <button
              onClick={() => openEdit(r)}
              className="p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-slate-100 transition-colors"
              title="Edit Color"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editColor ? 'Edit Color' : 'Add Color'}>
        <div className="space-y-4">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <FormField
            label="Color Name"
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Navy Blue, Dusty Rose"
          />

          <FormField
            label="Internal Color Code"
            hint="Leave blank to auto-generate (e.g. CLR-0002)"
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            placeholder="e.g. CLR-0002"
          />

          {/* Pantone Color Code — primary textile reference */}
          <FormField
            label="Pantone Color Code"
            hint="Textile-oriented Pantone code (e.g. 19-4052 TCX, 18-1662 TCX, 286 C)"
            value={form.pantone_code}
            onChange={e => setForm(f => ({ ...f, pantone_code: e.target.value }))}
            placeholder="e.g. 19-4052 TCX"
          />

          {/* Color swatch picker — visual reference only */}
          <div>
            <label className="text-[11px] font-medium text-slate-600 block mb-1">
              Color Swatch <span className="text-slate-400 font-normal">(visual reference only)</span>
            </label>
            <div className="flex gap-2.5 items-center">
              <input
                type="color"
                className="w-9 h-9 rounded border border-slate-200 cursor-pointer p-0.5 bg-white shadow-xs"
                value={form.hex_code || '#1e3a8a'}
                onChange={e => setForm(f => ({ ...f, hex_code: e.target.value }))}
              />
              <span className="text-xs text-slate-500">Pick a representative swatch colour for quick UI visual identification</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editColor ? 'Update Color' : 'Save Color'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
