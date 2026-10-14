// src/pages/masters/Suppliers.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Supplier } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, RefreshCw } from 'lucide-react';

export default function Suppliers() {
  const [data, setData] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', gstin: '', payment_terms_days: '30' });

  const load = async () => {
    setLoading(true);
    try { setData(((await api.getSuppliers()) || []) as Supplier[]); }
    catch { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setError('Supplier name and phone are required'); return; }
    setSaving(true); setError('');
    const autoCode = `SUP-${String(data.length + 1).padStart(3, '0')}`;
    try {
      await api.createSupplier({ ...form, code: autoCode, payment_terms_days: Number(form.payment_terms_days) || 30 });
      setOpen(false);
      setForm({ name: '', contact_person: '', phone: '', email: '', address: '', gstin: '', payment_terms_days: '30' });
      load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save supplier');
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'code', label: 'Code', render: (r: Supplier) => <span className="font-mono text-[10px] text-slate-500">{r.code}</span> },
    { key: 'name', label: 'Supplier Name', sortable: true, render: (r: Supplier) => <span className="font-semibold">{r.name}</span> },
    { key: 'contact_person', label: 'Contact', render: (r: Supplier) => r.contact_person || '—' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', render: (r: Supplier) => <span className="text-brand-600">{r.email || '—'}</span> },
    { key: 'gstin', label: 'GSTIN', render: (r: Supplier) => <span className="font-mono text-[10px]">{r.gstin || '—'}</span> },
    { key: 'payment_terms_days', label: 'Payment Terms', render: (r: Supplier) => `${r.payment_terms_days} days` },
    { key: 'status', label: 'Status', render: (r: Supplier) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Suppliers" subtitle="Manage supplier master records"
        breadcrumb={[{ label: 'Masters' }, { label: 'Suppliers' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setOpen(true)}>Add Supplier</Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden p-2.5 sm:p-4">
        <DataTable data={data} columns={columns} rowKey="id" />
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Add Supplier" width="max-w-lg"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>Save</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {error && <div className="sm:col-span-2 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
          <div className="sm:col-span-2">
            <FormField label="Supplier Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} hint="Supplier Code will be auto-generated (e.g. SUP-001)" />
          </div>
          <FormField label="Contact Person" value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
          <FormField label="Phone" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <FormField label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <FormField label="GSTIN" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
          <FormField label="Payment Terms (days)" type="number" value={form.payment_terms_days} onChange={e => setForm(f => ({ ...f, payment_terms_days: e.target.value }))} />
          <div className="sm:col-span-2">
            <FormField as="textarea" label="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
