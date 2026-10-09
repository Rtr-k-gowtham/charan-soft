// src/pages/masters/DesignsPage.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, Edit2, AlertCircle, RefreshCw } from 'lucide-react';

interface DesignRecord { id: number; code: string; name: string; pattern?: string; description?: string; status?: string; }

export default function DesignsPage() {
  const [designs, setDesigns] = useState<DesignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ code: '', name: '', pattern: 'Solid', description: '', status: 'active' });

  const loadData = () => {
    setLoading(true);
    api.getDesigns()
      .then(d => setDesigns((d || []) as DesignRecord[]))
      .catch(() => setDesigns([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setForm({ code: '', name: '', pattern: 'Solid', description: '', status: 'active' });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      await api.createDesign(form);
      setModalOpen(false);
      loadData();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save design');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'code', label: 'Code', sortable: true, render: (r: DesignRecord) => <span className="font-mono text-[11px] font-semibold text-brand-700">{r.code || `DSN-${r.id}`}</span> },
    { key: 'name', label: 'Design Name', sortable: true, render: (r: DesignRecord) => <span className="font-medium">{r.name}</span> },
    { key: 'pattern', label: 'Pattern', render: (r: DesignRecord) => <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-semibold">{r.pattern || 'Solid'}</span> },
    { key: 'status', label: 'Status', render: (r: DesignRecord) => <StatusBadge status={r.status || 'active'} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Designs"
        subtitle="Manage fabric patterns, cuts and design references"
        breadcrumb={[{ label: 'Masters' }, { label: 'Designs' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={loadData} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>Add Design</Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={designs} columns={columns} />
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Design">
        <div className="space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-md flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Design Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. DSN-101" />
            <FormField label="Design Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Minimalist Stripe" />
          </div>
          <FormField label="Pattern Style" value={form.pattern} onChange={e => setForm(f => ({ ...f, pattern: e.target.value }))} placeholder="e.g. Yarn Dyed Stripe" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Design'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
