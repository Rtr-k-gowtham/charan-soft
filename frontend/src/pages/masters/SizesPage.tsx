// src/pages/masters/SizesPage.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, Edit2, AlertCircle, RefreshCw } from 'lucide-react';

interface SizeRecord { id: number; code: string; name: string; size_type?: string; sort_order?: number; status?: string; }

export default function SizesPage() {
  const [sizes, setSizes] = useState<SizeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ code: '', name: '', size_type: 'garment', sort_order: '1', status: 'active' });

  const loadData = () => {
    setLoading(true);
    api.getSizes()
      .then(d => setSizes((d || []) as SizeRecord[]))
      .catch(() => setSizes([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setForm({ code: '', name: '', size_type: 'garment', sort_order: String(sizes.length + 1), status: 'active' });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) { setError('Code and Name are required'); return; }
    setSaving(true); setError('');
    try {
      await api.createSize({ ...form, sort_order: Number(form.sort_order) });
      setModalOpen(false);
      loadData();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save size');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'sort_order', label: '#', sortable: true, render: (r: SizeRecord) => <span className="font-mono text-slate-400">{r.sort_order || r.id}</span> },
    { key: 'code', label: 'Code', sortable: true, render: (r: SizeRecord) => <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded font-bold text-xs">{r.code}</span> },
    { key: 'name', label: 'Size Name', sortable: true, render: (r: SizeRecord) => <span className="font-medium">{r.name}</span> },
    { key: 'status', label: 'Status', render: (r: SizeRecord) => <StatusBadge status={r.status || 'active'} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Sizes"
        subtitle="Manage garment and product size specifications"
        breadcrumb={[{ label: 'Masters' }, { label: 'Sizes' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={loadData} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>Add Size</Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={sizes} columns={columns} />
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Size">
        <div className="space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-md flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Size Code" required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. XL" />
            <FormField label="Display Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Extra Large" />
          </div>
          <FormField label="Sort Order" type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Size'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
