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

interface ColorRecord { id: number; code?: string; name: string; hex_code: string; status?: string; }

export default function ColorsPage() {
  const [colors, setColors] = useState<ColorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editColor, setEditColor] = useState<ColorRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ code: '', name: '', hex_code: '#000000', status: 'active' });

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

  const openCreate = () => { setEditColor(null); setForm({ code: '', name: '', hex_code: '#000000', status: 'active' }); setError(''); setModalOpen(true); };
  const openEdit = (c: ColorRecord) => { setEditColor(c); setForm({ code: c.code || '', name: c.name, hex_code: c.hex_code, status: c.status || 'active' }); setError(''); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      await api.createColor(form);
      setModalOpen(false);
      loadData();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'code', label: 'Code', sortable: true, render: (r: ColorRecord) => <span className="font-mono text-[11px] font-semibold">{r.code || `CLR-${r.id}`}</span> },
    { key: 'name', label: 'Color Name', sortable: true, render: (r: ColorRecord) => (
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full border border-slate-200 shrink-0" style={{ backgroundColor: r.hex_code }} />
        <span className="font-medium">{r.name}</span>
      </div>
    )},
    { key: 'hex_code', label: 'Hex Code', render: (r: ColorRecord) => <span className="font-mono text-[11px] text-slate-500">{r.hex_code}</span> },
    { key: 'status', label: 'Status', render: (r: ColorRecord) => <StatusBadge status={r.status || 'active'} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Colors"
        subtitle="Manage color codes used in products"
        breadcrumb={[{ label: 'Masters' }, { label: 'Colors' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={loadData} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>Add Color</Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={colors} columns={columns} />
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editColor ? 'Edit Color' : 'Add Color'}>
        <div className="space-y-4">
          <FormField label="Color Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Navy Blue" />
          <FormField label="Hex Code">
            <div className="flex gap-2 items-center">
              <input type="color" className="w-8 h-8 rounded border border-slate-200 cursor-pointer" value={form.hex_code} onChange={e => setForm(f => ({ ...f, hex_code: e.target.value }))} />
              <input className="flex-1 text-xs font-mono border border-slate-200 rounded px-2.5 py-1.5" value={form.hex_code} onChange={e => setForm(f => ({ ...f, hex_code: e.target.value }))} />
            </div>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Color'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
