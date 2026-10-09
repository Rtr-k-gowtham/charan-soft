// src/pages/settings/Settings.tsx
// All settings pages: Users, Roles, Permissions, Production Stages, Company Settings
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, Edit2, AlertCircle, Shield, Users as UsersIcon, Settings as SettingsIcon, Building2, RefreshCw } from 'lucide-react';

// ─── Users ───────────────────────────────────────────────────────────
interface UserRecord { id: number; name: string; email: string; role_name?: string; role?: string; last_login?: string; status?: string; }

export function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', role_id: 2, password: '', status: 'active' });

  const loadData = () => {
    setLoading(true);
    api.getUsers()
      .then(d => setUsers((d || []) as UserRecord[]))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => { setEditUser(null); setForm({ name: '', email: '', role_id: 2, password: '', status: 'active' }); setError(''); setModalOpen(true); };
  const openEdit = (u: UserRecord) => { setEditUser(u); setForm({ name: u.name, email: u.email, role_id: 2, password: '', status: u.status || 'active' }); setError(''); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name || !form.email) { setError('Name and email are required'); return; }
    setSaving(true);
    try {
      if (editUser) {
        await api.updateUser(editUser.id, form);
      } else {
        await api.createUser(form);
      }
      setModalOpen(false);
      loadData();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const cols = [
    { key: 'name', label: 'Name', sortable: true, render: (r: UserRecord) => <div><p className="font-medium">{r.name}</p><p className="text-[10px] text-slate-400">{r.email}</p></div> },
    { key: 'role_name', label: 'Role', render: (r: UserRecord) => <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-[10px] font-semibold">{r.role_name || r.role || 'Staff'}</span> },
    { key: 'status', label: 'Status', render: (r: UserRecord) => <StatusBadge status={r.status || 'active'} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="User Management"
        subtitle="Manage system users and access"
        breadcrumb={[{ label: 'Settings' }, { label: 'Users' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={loadData} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>Add User</Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={users} columns={cols} rowKey="id" onRowClick={openEdit}
          actions={(r: UserRecord) => <button onClick={e => { e.stopPropagation(); openEdit(r); }} className="p-1 text-slate-400 hover:text-brand-600 rounded"><Edit2 className="w-3.5 h-3.5" /></button>} />
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? 'Edit User' : 'Add User'}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave} icon={<UsersIcon className="w-3.5 h-3.5" />}>{editUser ? 'Update' : 'Create'} User</Button></>}>
        <div className="flex flex-col gap-3">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Full Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <FormField label="Email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField as="select" label="Role" value={String(form.role_id)} onChange={e => setForm(f => ({ ...f, role_id: Number(e.target.value) }))}>
              <option value="1">System Administrator</option>
              <option value="2">Purchase Manager</option>
              <option value="3">Production Head</option>
              <option value="4">Quality Lead</option>
            </FormField>
            <FormField as="select" label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option><option value="inactive">Inactive</option>
            </FormField>
          </div>
          {!editUser && <FormField label="Password" type="password" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />}
        </div>
      </Modal>
    </div>
  );
}

// ─── Roles ───────────────────────────────────────────────────────────
interface RoleRecord { id: number; name: string; display_name?: string; description?: string; user_count?: number; permissions?: string[]; }

export function RolesPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRoles()
      .then(d => setRoles((d || []) as RoleRecord[]))
      .catch(() => setRoles([]))
      .finally(() => setLoading(false));
  }, []);

  const cols = [
    { key: 'name', label: 'Role Name', sortable: true, render: (r: RoleRecord) => <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-brand-500" /><span className="font-semibold">{r.display_name || r.name}</span></div> },
    { key: 'description', label: 'Description', render: (r: RoleRecord) => <span className="text-slate-500 text-[11px]">{r.description || 'System access role'}</span> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Roles & Permissions" subtitle="System user roles and access rights" breadcrumb={[{ label: 'Settings' }, { label: 'Roles' }]} />
      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={roles} columns={cols} rowKey="id" />
      </div>
    </div>
  );
}

// ─── Production Stages ────────────────────────────────────────────────
interface StageRecord { id: number; name: string; code: string; sequence_order: number; color_badge: string; is_qc_stage?: boolean; is_final_stage?: boolean; status?: string; }

export function ProductionStagesPage() {
  const [stages, setStages] = useState<StageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', sequence_order: '1', color_badge: '#6366f1', status: 'active' });

  const loadData = () => {
    setLoading(true);
    api.getStages()
      .then(d => setStages((d || []) as StageRecord[]))
      .catch(() => setStages([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => { setForm({ name: '', code: '', sequence_order: String(stages.length + 1), color_badge: '#6366f1', status: 'active' }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.createStage({ ...form, sequence_order: Number(form.sequence_order) });
      setModalOpen(false);
      loadData();
    } catch {
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const cols = [
    { key: 'sequence_order', label: 'Seq', sortable: true, render: (r: StageRecord) => <span className="font-mono font-bold text-slate-500">{r.sequence_order}</span> },
    { key: 'name', label: 'Stage', render: (r: StageRecord) => <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color_badge }} /><span className="font-semibold">{r.name}</span></div> },
    { key: 'code', label: 'Code', render: (r: StageRecord) => <span className="font-mono text-[11px] font-semibold text-slate-600">{r.code}</span> },
    { key: 'status', label: 'Status', render: (r: StageRecord) => <StatusBadge status={r.status || 'active'} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Production Stages"
        subtitle="Configure the production pipeline stages"
        breadcrumb={[{ label: 'Settings' }, { label: 'Production Stages' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={loadData} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>Add Stage</Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={stages} columns={cols} rowKey="id" />
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Stage"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>Add Stage</Button></>}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Stage Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <FormField label="Stage Code" required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. CUT" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sequence" type="number" min="1" value={form.sequence_order} onChange={e => setForm(f => ({ ...f, sequence_order: e.target.value }))} />
            <div className="flex flex-col gap-1"><label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Color</label><input type="color" value={form.color_badge} onChange={e => setForm(f => ({ ...f, color_badge: e.target.value }))} className="w-10 h-8 rounded border border-slate-200 cursor-pointer" /></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Company Settings ─────────────────────────────────────────────────
export function CompanySettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    company_name: 'Cheran Soft Goods Private Limited',
    gstin: '33AABCC1234F1Z5',
    address: '124, Textile Park, Palladam Road, Tiruppur - 641604, Tamil Nadu',
    phone: '+91 421 2478900',
    email: 'operations@cheransoftgoods.com',
  });

  useEffect(() => {
    api.getCompanySettings().then((d: any) => {
      if (d) setForm(prev => ({ ...prev, ...d }));
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateCompanySettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, props: Record<string, unknown> = {}) => (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
      <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-brand-400 bg-white" {...props as React.InputHTMLAttributes<HTMLInputElement>} />
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Company Settings" subtitle="Configure company profile and tax credentials" breadcrumb={[{ label: 'Settings' }, { label: 'Company' }]}
        actions={<Button loading={saving} onClick={handleSave} icon={<SettingsIcon className="w-3.5 h-3.5" />}>{saved ? '✓ Saved!' : 'Save Settings'}</Button>} />
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-2xl flex flex-col gap-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> Company Information</h3>
            <div className="grid grid-cols-2 gap-3">
              {field('Company Name', 'company_name')}
              {field('GSTIN', 'gstin')}
              {field('Phone', 'phone', { type: 'tel' })}
              {field('Email', 'email', { type: 'email' })}
            </div>
            <div className="mt-3">{field('Address', 'address')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UsersPage;
