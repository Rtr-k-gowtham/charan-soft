// src/pages/templates/Templates.tsx
// All 4 template pages: Material, Product, Order, PO
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, Edit2, Copy, FileText, AlertCircle, Eye, RefreshCw } from 'lucide-react';

interface Template { id: number; code?: string; name: string; description?: string; template_type?: string; items_count?: number; last_used?: string; status?: string; }

interface Props { type: 'material' | 'product' | 'order' | 'po'; title: string; breadcrumb: string; }

export function TemplatePageInner({ type, title, breadcrumb }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTpl, setEditTpl] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ code: '', name: '', description: '' });

  const loadData = () => {
    setLoading(true);
    api.getTemplates(type)
      .then(d => setTemplates((d || []) as Template[]))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [type]);

  const openCreate = () => { setEditTpl(null); setForm({ code: '', name: '', description: '' }); setError(''); setModalOpen(true); };
  const openEdit = (t: Template) => { setEditTpl(t); setForm({ code: t.code || '', name: t.name, description: t.description || '' }); setError(''); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name) { setError('Template Name is required'); return; }
    setSaving(true);
    const finalCode = editTpl ? form.code : (form.code || `TMPL-${type.toUpperCase().slice(0, 3)}-${String(templates.length + 1).padStart(3, '0')}`);
    try {
      await api.createTemplate({ ...form, code: finalCode, template_type: type });
      setModalOpen(false);
      loadData();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Template Name', sortable: true, render: (r: Template) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'template_type', label: 'Type', render: (r: Template) => <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-[10px] font-semibold uppercase">{r.template_type || type}</span> },
    { key: 'description', label: 'Description', render: (r: Template) => <span className="text-slate-500 text-[11px]">{r.description || '—'}</span> },
    { key: 'status', label: 'Status', render: (r: Template) => <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${r.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.status || 'active'}</span> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={title}
        subtitle={`Reusable ${title.toLowerCase()} for quick setup`}
        breadcrumb={[{ label: 'Templates' }, { label: breadcrumb }]}
        actions={
          <div className="flex gap-2">
            <button onClick={loadData} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>New Template</Button>
          </div>
        }
      />

      <div className="px-4 pt-3 pb-0">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800 flex items-start gap-2">
          <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>Templates allow you to pre-define configurations and quickly apply them when creating new records.</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={templates} columns={columns} />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTpl ? 'Edit Template' : 'New Template'}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>{editTpl ? 'Update' : 'Create'} Template</Button></>}>
        <div className="flex flex-col gap-3">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
          <FormField label="Template Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Template name" hint="Template Code will be automatically generated" />
          <FormField as="textarea" label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe when to use this template..." />
        </div>
      </Modal>
    </div>
  );
}

export default function MaterialTemplates() { return <TemplatePageInner type="material" title="Material Templates" breadcrumb="Material Templates" />; }
export function ProductTemplates() { return <TemplatePageInner type="product" title="Product Templates" breadcrumb="Product Templates" />; }
export function OrderTemplates() { return <TemplatePageInner type="order" title="Order Templates" breadcrumb="Order Templates" />; }
export function POTemplates() { return <TemplatePageInner type="po" title="PO Templates" breadcrumb="PO Templates" />; }
