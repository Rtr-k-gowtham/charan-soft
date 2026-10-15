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
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import AvatarSelectorModal from '../../components/buyers/AvatarSelectorModal';
import BuyerProductsManager from '../../components/buyer-products/BuyerProductsManager';
import { Plus, RefreshCw, Package, ArrowRight, Edit2, Sparkles, Dices } from 'lucide-react';
import { AvatarStyle, AvatarConfig, parseAvatarConfig } from '../../lib/avatarService';

export default function Buyers() {
  const { buyerId } = useParams<{ buyerId?: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);

  // Editing state (null for creating new buyer, or Buyer object if editing)
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    billing_address: '',
    gstin: '',
  });

  // Avatar state for create/edit
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>('lorelei');
  const [avatarSeed, setAvatarSeed] = useState<string>('');
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({ backgroundColor: 'b6e3f4' });
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = ((await api.getBuyers()) || []) as Buyer[];
      setData(res);
      if (buyerId) {
        const found = res.find((b) => String(b.id) === String(buyerId));
        if (found) setSelectedBuyer(found);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [buyerId]);

  const handleSelectBuyer = (buyer: Buyer) => {
    setSelectedBuyer(buyer);
    navigate(`/masters/buyers/${buyer.id}/products`);
  };

  const handleBackToBuyers = () => {
    setSelectedBuyer(null);
    navigate('/masters/buyers');
  };

  const handleOpenCreate = () => {
    setEditingBuyer(null);
    setForm({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      billing_address: '',
      gstin: '',
    });
    const nextCode = `BUY-${String(data.length + 1).padStart(3, '0')}`;
    setAvatarStyle('lorelei');
    setAvatarSeed(`buyer-${nextCode}`);
    setAvatarConfig({ backgroundColor: 'b6e3f4' });
    setError('');
    setOpen(true);
  };

  const handleOpenEdit = (buyer: Buyer) => {
    setEditingBuyer(buyer);
    setForm({
      name: buyer.name || '',
      contact_person: buyer.contact_person || '',
      phone: buyer.phone || '',
      email: buyer.email || '',
      billing_address: buyer.billing_address || '',
      gstin: buyer.gstin || '',
    });
    setAvatarStyle('lorelei');
    setAvatarSeed(buyer.avatar_seed || `buyer-${buyer.code || buyer.id}`);
    setAvatarConfig(parseAvatarConfig(buyer.avatar_config) || { backgroundColor: 'b6e3f4' });
    setError('');
    setOpen(true);
  };

  const handleRandomizeAvatar = () => {
    const prefixes = ['Avery', 'Bella', 'Caleb', 'Daphne', 'Ethan', 'Fiona', 'Gavin', 'Harper', 'Iris', 'Jasper', 'Keira', 'Liam', 'Maya', 'Noah', 'Olivia', 'Quinn', 'Rowan', 'Theo', 'Zoe'];
    const randomSeed = `${prefixes[Math.floor(Math.random() * prefixes.length)]}-${Math.floor(100 + Math.random() * 900)}`;
    setAvatarStyle('lorelei');
    setAvatarSeed(randomSeed);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Buyer name and phone are required');
      return;
    }
    setSaving(true);
    setError('');

    try {
      if (editingBuyer) {
        // Update existing buyer
        await api.updateBuyer(editingBuyer.id, {
          ...form,
          code: editingBuyer.code,
          avatar_style: avatarStyle,
          avatar_seed: avatarSeed || `buyer-${editingBuyer.code}`,
          avatar_config: avatarConfig,
        });
      } else {
        // Create new buyer
        const autoCode = `BUY-${String(data.length + 1).padStart(3, '0')}`;
        await api.createBuyer({
          ...form,
          code: autoCode,
          avatar_style: avatarStyle,
          avatar_seed: avatarSeed || `buyer-${autoCode}`,
          avatar_config: avatarConfig,
        });
      }

      setOpen(false);
      setEditingBuyer(null);
      load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save buyer');
    } finally {
      setSaving(false);
    }
  };

  // If admin is managing products for a specific buyer, show the Buyer Products workspace
  if (selectedBuyer) {
    return <BuyerProductsManager buyer={selectedBuyer} onBack={handleBackToBuyers} />;
  }

  const columns = [
    {
      key: 'avatar',
      label: 'Avatar',
      render: (r: Buyer) => (
        <BuyerAvatar
          buyer={r}
          size="md"
          shape="circle"
          showRing
          title={`${r.name} (${r.code})`}
        />
      ),
    },
    {
      key: 'code',
      label: 'Buyer ID',
      render: (r: Buyer) => (
        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {r.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Buyer Name & Company',
      sortable: true,
      render: (r: Buyer) => (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => handleSelectBuyer(r)}
            className="text-left font-semibold text-slate-900 hover:text-brand-600 transition cursor-pointer leading-snug"
          >
            {r.name}
          </button>
          <span className="text-[11px] text-slate-500">
            {r.contact_person ? `Attn: ${r.contact_person}` : 'Standard Account'}
          </span>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone' },
    {
      key: 'email',
      label: 'Email',
      render: (r: Buyer) => (
        <span className="text-brand-600 text-xs">{r.email || '—'}</span>
      ),
    },
    {
      key: 'gstin',
      label: 'GSTIN',
      render: (r: Buyer) => (
        <span className="font-mono text-[11px] text-slate-600">{r.gstin || '—'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Buyer) => <StatusBadge status={r.status || 'Active'} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: Buyer) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleOpenEdit(r)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition cursor-pointer"
            title="Edit buyer details & avatar"
          >
            <Edit2 className="w-3 h-3 text-slate-500" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectBuyer(r)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg shadow-2xs transition cursor-pointer"
            title="Configure products, BOM, dimensions, and packing for this buyer"
          >
            <Package className="w-3.5 h-3.5 text-brand-600" />
            <span>Products</span>
            <ArrowRight className="w-3 h-3 text-brand-400" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Buyer Master"
        subtitle="Manage buyer records with custom cartoon avatars, product catalogs, dimensions, and box packing"
        breadcrumb={[{ label: 'Masters' }, { label: 'Buyer Master' }]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={handleOpenCreate}>
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
        title={editingBuyer ? `Edit Buyer: ${editingBuyer.name}` : 'Add New Buyer'}
        width="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              {editingBuyer ? 'Update Buyer' : 'Save Buyer'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Avatar Selector Card */}
          <div className="bg-gradient-to-r from-brand-50/60 via-indigo-50/40 to-slate-50 border border-brand-200/80 rounded-xl p-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BuyerAvatar
                style={avatarStyle}
                seed={avatarSeed || (editingBuyer ? `buyer-${editingBuyer.code}` : 'buyer-new')}
                config={avatarConfig}
                size="xl"
                shape="circle"
                className="shadow-sm ring-2 ring-white"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">Cartoon Avatar</span>
                  <span className="text-[10px] uppercase font-semibold text-brand-700 bg-brand-100/70 px-1.5 py-0.2 rounded">
                    {avatarStyle}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate max-w-[160px]">
                  Seed: {avatarSeed || 'Auto (Buyer ID)'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setAvatarModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-800"
                  >
                    <Sparkles className="w-3 h-3" />
                    Change Avatar
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleRandomizeAvatar}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                    title="Generate random character"
                  >
                    <Dices className="w-3 h-3 text-slate-400" />
                    Randomize
                  </button>
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAvatarModalOpen(true)}
              className="text-xs whitespace-nowrap"
            >
              Gallery
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <FormField
                label="Buyer / Company Name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                hint={
                  editingBuyer
                    ? `Buyer Code: ${editingBuyer.code}`
                    : 'Buyer Code will be auto-generated (e.g. BUY-001)'
                }
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
        </div>
      </Drawer>

      {/* Avatar Selection Modal */}
      <AvatarSelectorModal
        open={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        initialStyle={avatarStyle}
        initialSeed={avatarSeed}
        initialConfig={avatarConfig}
        buyerName={form.name || (editingBuyer ? editingBuyer.name : 'New Buyer')}
        buyerCode={editingBuyer ? editingBuyer.code : `BUY-${data.length + 1}`}
        onSelect={(selection) => {
          setAvatarStyle(selection.avatar_style);
          setAvatarSeed(selection.avatar_seed);
          setAvatarConfig(selection.avatar_config);
        }}
      />
    </div>
  );
}
