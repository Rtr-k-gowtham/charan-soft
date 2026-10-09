// src/pages/masters/Customers.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Customer } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, RefreshCw } from 'lucide-react';

export default function Customers() {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', billing_address: '', gstin: '' });

  const load = async () => {
    setLoading(true);
    try { setData(((await api.getCustomers()) || []) as Customer[]); }
    catch { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setError('Customer name and phone are required'); return; }
    setSaving(true); setError('');
    const autoCode = `CUST-${String(data.length + 1).padStart(3, '0')}`;
    try {
      await api.createCustomer({ ...form, code: autoCode });
      setOpen(false);
      setForm({ name: '', contact_person: '', phone: '', email: '', billing_address: '', gstin: '' });
      load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save customer');
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'code', label: 'Code', render: (r: Customer) => <span className="font-mono text-[10px] text-slate-500">{r.code}</span> },
    { key: 'name', label: 'Customer Name', sortable: true, render: (r: Customer) => <span className="font-semibold">{r.name}</span> },
    { key: 'contact_person', label: 'Contact', render: (r: Customer) => r.contact_person || '—' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', render: (r: Customer) => <span className="text-brand-600">{r.email || '—'}</span> },
    { key: 'gstin', label: 'GSTIN', render: (r: Customer) => <span className="font-mono text-[10px]">{r.gstin || '—'}</span> },
    { key: 'status', label: 'Status', render: (r: Customer) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Customers" subtitle="Manage customer master records"
        breadcrumb={[{ label: 'Masters' }, { label: 'Customers' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setOpen(true)}>Add Customer</Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={data} columns={columns} rowKey="id" />
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Add Customer" width="max-w-lg"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>Save</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {error && <div className="sm:col-span-2 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
          <div className="sm:col-span-2">
            <FormField label="Customer Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} hint="Customer Code will be auto-generated (e.g. CUST-001)" />
          </div>
          <FormField label="Contact Person" value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
          <FormField label="Phone" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <FormField label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <FormField label="GSTIN" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
          <div className="sm:col-span-2">
            <FormField as="textarea" label="Billing Address" value={form.billing_address} onChange={e => setForm(f => ({ ...f, billing_address: e.target.value }))} rows={2} />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
