// src/pages/masters/UnitsPage.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, Edit2, AlertCircle, RefreshCw } from 'lucide-react';

interface UnitRecord { id: number; code: string; name: string; category?: string; status?: string; }

export default function UnitsPage() {
  const [units, setUnits] = useState<UnitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ code: '', name: '', category: 'Count', status: 'active' });

  const loadData = () => {
    setLoading(true);
    api.getUnits()
      .then(d => setUnits((d || []) as UnitRecord[]))
      .catch(() => setUnits([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => { setForm({ code: '', name: '', category: 'Count', status: 'active' }); setError(''); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.code || !form.name) { setError('Code and Name are required'); return; }
    setSaving(true); setError('');
    try {
      await api.createUnit(form);
      setModalOpen(false);
      loadData();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save unit');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'code', label: 'Code', sortable: true, render: (r: UnitRecord) => <span className="px-2 py-0.5 bg-slate-100 rounded font-mono font-bold text-xs text-slate-700">{r.code}</span> },
    { key: 'name', label: 'Unit Name', sortable: true, render: (r: UnitRecord) => <span className="font-medium">{r.name}</span> },
    { key: 'status', label: 'Status', render: (r: UnitRecord) => <StatusBadge status={r.status || 'active'} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Units of Measure"
        subtitle="Manage measurement units for materials and products"
        breadcrumb={[{ label: 'Masters' }, { label: 'Units' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={loadData} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>Add Unit</Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden p-2.5 sm:p-4">
        <DataTable data={units} columns={columns} />
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Unit">
        <div className="space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-md flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Unit Code" required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. MTR" />
            <FormField label="Full Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Metres" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Unit'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
