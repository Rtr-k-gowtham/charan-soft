import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Buyer } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import BuyerProductsManager from '../../components/buyer-products/BuyerProductsManager';
import { Plus, RefreshCw, Package, ArrowRight } from 'lucide-react';

export default function Buyers() {
  const { buyerId } = useParams<{ buyerId?: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', billing_address: '', gstin: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = ((await api.getBuyers()) || []) as Buyer[];
      setData(res);
      if (buyerId) {
        const found = res.find((b) => String(b.id) === String(buyerId));
        if (found) setSelectedBuyer(found);
      }
    }
    catch { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [buyerId]);

  const handleSelectBuyer = (buyer: Buyer) => {
    setSelectedBuyer(buyer);
    navigate(`/masters/buyers/${buyer.id}/products`);
  };

  const handleBackToBuyers = () => {
    setSelectedBuyer(null);
    navigate('/masters/buyers');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setError('Buyer name and phone are required'); return; }
    setSaving(true); setError('');
    const autoCode = `BUY-${String(data.length + 1).padStart(3, '0')}`;
    try {
      await api.createBuyer({ ...form, code: autoCode });
      setOpen(false);
      setForm({ name: '', contact_person: '', phone: '', email: '', billing_address: '', gstin: '' });
      load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save buyer');
    } finally { setSaving(false); }
  };

  // If admin is managing products for a specific buyer, show the Buyer Products workspace
  if (selectedBuyer) {
    return <BuyerProductsManager buyer={selectedBuyer} onBack={handleBackToBuyers} />;
  }

  const columns = [
    { key: 'code', label: 'Code', render: (r: Buyer) => <span className="font-mono text-[10px] text-slate-500 font-semibold">{r.code}</span> },
    {
      key: 'name',
      label: 'Buyer Name',
      sortable: true,
      render: (r: Buyer) => (
        <button
          type="button"
          onClick={() => handleSelectBuyer(r)}
          className="text-left font-semibold text-slate-900 hover:text-brand-600 transition cursor-pointer"
        >
          {r.name}
        </button>
      ),
    },
    { key: 'contact_person', label: 'Contact', render: (r: Buyer) => r.contact_person || '—' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', render: (r: Buyer) => <span className="text-brand-600">{r.email || '—'}</span> },
    { key: 'gstin', label: 'GSTIN', render: (r: Buyer) => <span className="font-mono text-[10px]">{r.gstin || '—'}</span> },
    { key: 'status', label: 'Status', render: (r: Buyer) => <StatusBadge status={r.status || 'Active'} /> },
    {
      key: 'actions',
      label: 'Buyer Products & Packing',
      render: (r: Buyer) => (
        <button
          type="button"
          onClick={() => handleSelectBuyer(r)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg shadow-2xs transition cursor-pointer"
          title="Configure products, BOM, dimensions, and packing for this buyer"
        >
          <Package className="w-3.5 h-3.5 text-brand-600" />
          <span>Configure Products</span>
          <ArrowRight className="w-3 h-3 text-brand-400 ml-0.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Buyer Master"
        subtitle="Manage buyer master records and configure client-specific products, materials, dimensions, and box packing"
        breadcrumb={[{ label: 'Masters' }, { label: 'Buyer Master' }]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 transition"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setOpen(true)}>
              Add Buyer
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden p-2.5 sm:p-4">
        <DataTable data={data} columns={columns} rowKey="id" />
      </div>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Add Buyer"
        width="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              Save Buyer
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {error && (
            <div className="sm:col-span-2 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="sm:col-span-2">
            <FormField
              label="Buyer Name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              hint="Buyer Code will be auto-generated (e.g. BUY-001)"
            />
          </div>
          <FormField
            label="Contact Person"
            value={form.contact_person}
            onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
          />
          <FormField
            label="Phone"
            required
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <FormField
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <FormField
            label="GSTIN"
            value={form.gstin}
            onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <FormField
              as="textarea"
              label="Billing Address"
              value={form.billing_address}
              onChange={(e) => setForm((f) => ({ ...f, billing_address: e.target.value }))}
              rows={2}
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
