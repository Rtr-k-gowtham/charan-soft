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
import {
  Plus,
  Edit2,
  AlertCircle,
  Shield,
  Users as UsersIcon,
  Settings as SettingsIcon,
  Building2,
  RefreshCw,
  Check,
  X,
  Lock,
  Layers
} from 'lucide-react';

// ─── Users ───────────────────────────────────────────────────────────
interface UserRecord {
  id: number;
  name: string;
  email: string;
  role_id?: number;
  role_name?: string;
  role?: string;
  last_login?: string;
  status?: string;
}

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

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: '', email: '', role_id: 2, password: '', status: 'active' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (u: UserRecord) => {
    setEditUser(u);
    let resolvedRoleId = u.role_id;
    if (!resolvedRoleId) {
      if (u.role === 'Admin' || u.role_name === 'Admin') resolvedRoleId = 1;
      else if (u.role === 'Role 2' || u.role_name === 'Role 2') resolvedRoleId = 3;
      else resolvedRoleId = 2; // Role 1
    }

    setForm({
      name: u.name,
      email: u.email,
      role_id: resolvedRoleId,
      password: '',
      status: u.status || 'active'
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) {
      setError('Name and email are required');
      return;
    }
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
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (r: UserRecord) => (
        <div>
          <p className="font-semibold text-slate-800">{r.name}</p>
          <p className="text-[10px] text-slate-400 font-mono">{r.email}</p>
        </div>
      ),
    },
    {
      key: 'role_name',
      label: 'Role',
      render: (r: UserRecord) => {
        const role = r.role_name || r.role || 'Role 1';
        let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
        if (role === 'Admin') badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
        if (role === 'Role 2') badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';

        return (
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
            {role}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: UserRecord) => <StatusBadge status={r.status || 'active'} />,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <PageHeader
        title="User Management"
        subtitle="Manage user accounts and assign operational roles (Admin, Role 1, Role 2)"
        breadcrumb={[{ label: 'Settings' }, { label: 'Users' }]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>
              Add User
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden p-4">
        <DataTable
          data={users}
          columns={cols}
          rowKey="id"
          onRowClick={openEdit}
          actions={(r: UserRecord) => (
            <button
              onClick={e => {
                e.stopPropagation();
                openEdit(r);
              }}
              className="p-1 text-slate-400 hover:text-brand-600 rounded"
              title="Edit User"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editUser ? 'Edit User Account' : 'Create User Account'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={handleSave}
              icon={<UsersIcon className="w-3.5 h-3.5" />}
            >
              {editUser ? 'Update' : 'Create'} User
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Full Name"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <FormField
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              as="select"
              label="Operational Role"
              value={String(form.role_id)}
              onChange={e => setForm(f => ({ ...f, role_id: Number(e.target.value) }))}
            >
              <option value="1">Admin — Full 10 Stages & Administration</option>
              <option value="2">Role 1 — Stages 01, 02, 03, 09, 10 (Procurement & Packing)</option>
              <option value="3">Role 2 — Stages 04, 05, 06, 07, 08 (Manufacturing & QC)</option>
            </FormField>
            <FormField
              as="select"
              label="Status"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </FormField>
          </div>
          {!editUser && (
            <FormField
              label="Password"
              type="password"
              required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}

// ─── Roles & Stage Access Matrix ──────────────────────────────────────
interface RoleRecord {
  id: number;
  name: string;
  display_name?: string;
  description?: string;
  user_count?: number;
  allowed_stages?: number[];
}

export function RolesPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRoles()
      .then(d => setRoles((d || []) as RoleRecord[]))
      .catch(() => setRoles([]))
      .finally(() => setLoading(false));
  }, []);

  const stageMatrix = [
    { stage: '01', name: 'Requirement Gathering', role1: true, role2: false, admin: true },
    { stage: '02', name: 'PO (Purchase Order)', role1: true, role2: false, admin: true },
    { stage: '03', name: 'Inward', role1: true, role2: false, admin: true },
    { stage: '04', name: 'Dyeing', role1: false, role2: true, admin: true },
    { stage: '05', name: 'Cutting — Product-wise', role1: false, role2: true, admin: true },
    { stage: '06', name: 'Embroidery — Out/In', role1: false, role2: true, admin: true },
    { stage: '07', name: 'Stitching — Color-wise', role1: false, role2: true, admin: true },
    { stage: '08', name: 'Checking', role1: false, role2: true, admin: true },
    { stage: '09', name: 'Packing', role1: true, role2: false, admin: true },
    { stage: '10', name: 'Completed', role1: true, role2: false, admin: true },
  ];

  const cols = [
    {
      key: 'name',
      label: 'Role Name',
      sortable: true,
      render: (r: RoleRecord) => (
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-brand-600" />
          <span className="font-bold text-slate-800">{r.display_name || r.name}</span>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (r: RoleRecord) => (
        <span className="text-slate-600 text-xs">{r.description || 'System access role'}</span>
      ),
    },
    {
      key: 'user_count',
      label: 'Assigned Users',
      render: (r: RoleRecord) => (
        <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-semibold">
          {r.user_count || 0} users
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Operational role definitions and the 10-stage production access matrix"
        breadcrumb={[{ label: 'Settings' }, { label: 'Roles' }]}
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* Roles List Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-600" />
              Supported System Roles (3 Roles)
            </h3>
            <span className="text-xs text-slate-400 font-medium">Standardized RBAC</span>
          </div>
          <DataTable data={roles} columns={cols} rowKey="id" />
        </div>

        {/* Stage Access Matrix Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-600" />
                10-Stage Production Access Matrix
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Enforced across frontend UI navigation, route guards, and backend API endpoints
              </p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md">
              Active Enforcement
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-4 w-16">Stage</th>
                  <th className="py-2.5 px-4">Stage Name</th>
                  <th className="py-2.5 px-4 text-center w-28">Role 1</th>
                  <th className="py-2.5 px-4 text-center w-28">Role 2</th>
                  <th className="py-2.5 px-4 text-center w-28">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {stageMatrix.map(m => (
                  <tr key={m.stage} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-500">{m.stage}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{m.name}</td>
                    <td className="py-3 px-4 text-center">
                      {m.role1 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3 h-3" /> Allow
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                          <X className="w-3 h-3" /> Deny
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {m.role2 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3 h-3" /> Allow
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                          <X className="w-3 h-3" /> Deny
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        <Check className="w-3 h-3" /> Allow
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Production Stages ────────────────────────────────────────────────
interface StageRecord {
  id: number;
  name: string;
  code: string;
  sequence_order: number;
  color_badge: string;
  is_qc_stage?: boolean;
  is_final_stage?: boolean;
  status?: string;
}

export function ProductionStagesPage() {
  const [stages, setStages] = useState<StageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    sequence_order: '1',
    color_badge: '#6366f1',
    status: 'active',
  });

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

  const openCreate = () => {
    setForm({
      name: '',
      code: '',
      sequence_order: String(stages.length + 1),
      color_badge: '#6366f1',
      status: 'active',
    });
    setModalOpen(true);
  };

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
    {
      key: 'sequence_order',
      label: 'Seq',
      sortable: true,
      render: (r: StageRecord) => (
        <span className="font-mono font-bold text-slate-500">{r.sequence_order}</span>
      ),
    },
    {
      key: 'name',
      label: 'Stage',
      render: (r: StageRecord) => (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color_badge }} />
          <span className="font-semibold">{r.name}</span>
        </div>
      ),
    },
    {
      key: 'code',
      label: 'Code',
      render: (r: StageRecord) => (
        <span className="font-mono text-[11px] font-semibold text-slate-600">{r.code}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: StageRecord) => <StatusBadge status={r.status || 'active'} />,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <PageHeader
        title="Production Stages"
        subtitle="Configure the production pipeline stages"
        breadcrumb={[{ label: 'Settings' }, { label: 'Production Stages' }]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>
              Add Stage
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={stages} columns={cols} rowKey="id" />
      </div>
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Stage"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              Add Stage
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Stage Name"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <FormField
              label="Stage Code"
              required
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. CUT"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Sequence"
              type="number"
              min="1"
              value={form.sequence_order}
              onChange={e => setForm(f => ({ ...f, sequence_order: e.target.value }))}
            />
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                Color
              </label>
              <input
                type="color"
                value={form.color_badge}
                onChange={e => setForm(f => ({ ...f, color_badge: e.target.value }))}
                className="w-10 h-8 rounded border border-slate-200 cursor-pointer"
              />
            </div>
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
    api.getCompanySettings()
      .then((d: any) => {
        if (d) setForm(prev => ({ ...prev, ...d }));
      })
      .catch(() => {});
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
      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      <input
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-brand-400 bg-white"
        {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <PageHeader
        title="Company Settings"
        subtitle="Configure company profile and tax credentials"
        breadcrumb={[{ label: 'Settings' }, { label: 'Company' }]}
        actions={
          <Button
            loading={saving}
            onClick={handleSave}
            icon={<SettingsIcon className="w-3.5 h-3.5" />}
          >
            {saved ? '✓ Saved!' : 'Save Settings'}
          </Button>
        }
      />
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-2xl flex flex-col gap-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" /> Company Information
            </h3>
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
