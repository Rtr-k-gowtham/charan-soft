// src/pages/inventory/MaterialConsumption.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Material } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { FlameKindling, RefreshCw, Plus, Trash2, AlertCircle } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n);
const fmtCur = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);

interface ConsumptionRecord {
  id: number;
  voucher_number: string;
  consumption_date: string;
  production_order: string;
  total_items: number;
  status: string;
  recorded_by: string;
}

export default function MaterialConsumption() {
  const [records, setRecords] = useState<ConsumptionRecord[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ consumption_date: new Date().toISOString().split('T')[0], production_order: '', notes: '' });
  const [items, setItems] = useState<{ material_id: string; quantity: string; notes: string }[]>([{ material_id: '', quantity: '', notes: '' }]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getConsumption().catch(() => []),
      api.getMaterials().catch(() => []),
    ]).then(([rawRecs, mats]) => {
      const formatted = ((rawRecs || []) as { id: number; reference_id: string; created_at: string; quantity: number; notes: string }[]).map((r, i) => ({
        id: r.id || i + 1,
        voucher_number: `MC-${String(r.id || i + 1).padStart(5, '0')}`,
        consumption_date: (r.created_at || '').split(' ')[0] || new Date().toISOString().split('T')[0],
        production_order: r.reference_id ? `ORD-${r.reference_id}` : 'PROD-ORDER',
        total_items: 1,
        status: 'POSTED',
        recorded_by: 'Production Team',
      }));
      setRecords(formatted);
      setMaterials((mats || []) as Material[]);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!form.production_order) { setError('Enter a production order reference'); return; }
    if (items.some(i => !i.material_id || !i.quantity)) { setError('Fill all item fields'); return; }
    setSaving(true); setError('');
    try {
      for (const item of items) {
        await api.recordConsumption({
          material_id: Number(item.material_id),
          quantity: Number(item.quantity),
          notes: item.notes || form.notes || `Production order ${form.production_order}`,
        });
      }
      setCreateOpen(false);
      setItems([{ material_id: '', quantity: '', notes: '' }]);
      setForm({ consumption_date: new Date().toISOString().split('T')[0], production_order: '', notes: '' });
      loadData();
    } catch (e: unknown) { setError((e as Error).message || 'Failed'); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'voucher_number', label: 'Voucher No', sortable: true, render: (r: ConsumptionRecord) => <span className="font-mono font-semibold text-brand-700">{r.voucher_number}</span> },
    { key: 'consumption_date', label: 'Date', sortable: true },
    { key: 'production_order', label: 'Production Order', sortable: true, render: (r: ConsumptionRecord) => <span className="font-medium text-slate-700">{r.production_order}</span> },
    { key: 'total_items', label: 'Items', render: (r: ConsumptionRecord) => <span className="font-mono">{r.total_items}</span> },
    { key: 'status', label: 'Status', render: (r: ConsumptionRecord) => <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${r.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span> },
    { key: 'recorded_by', label: 'By', render: (r: ConsumptionRecord) => <span className="text-slate-400 text-[10px]">{r.recorded_by}</span> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Material Consumption"
        subtitle="Record raw material usage in production"
        breadcrumb={[{ label: 'Inventory' }, { label: 'Material Consumption' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={() => setLoading(l => !l)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreateOpen(true)}>Record Consumption</Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={records} columns={columns} rowKey="id" />
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Record Material Consumption" size="lg"
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleCreate} icon={<FlameKindling className="w-3.5 h-3.5" />}>Post Consumption</Button></>}>
        <div className="flex flex-col gap-3">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Consumption Date" type="date" required value={form.consumption_date} onChange={e => setForm(f => ({ ...f, consumption_date: e.target.value }))} />
            <FormField label="Production Order Ref" required value={form.production_order} onChange={e => setForm(f => ({ ...f, production_order: e.target.value }))} placeholder="e.g. PROD-0012" />
          </div>
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Materials Consumed</h4>
            <button onClick={() => setItems(p => [...p, { material_id: '', quantity: '', notes: '' }])} className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-medium"><Plus className="w-3 h-3" /> Add Material</button>
          </div>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full table-dense">
              <thead><tr><th>Material</th><th>Quantity</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td>
                      <select value={it.material_id} onChange={e => setItems(p => { const n = [...p]; n[i] = { ...n[i], material_id: e.target.value }; return n; })} className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-brand-400">
                        <option value="">— Select —</option>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name} (Stock: {fmt(m.current_stock)} {m.uom})</option>)}
                      </select>
                    </td>
                    <td><input type="number" min="0" value={it.quantity} onChange={e => setItems(p => { const n = [...p]; n[i] = { ...n[i], quantity: e.target.value }; return n; })} className="w-24 px-1.5 py-1 text-xs border border-slate-200 rounded text-right focus:outline-none focus:border-brand-400" placeholder="0" /></td>
                    <td><input value={it.notes} onChange={e => setItems(p => { const n = [...p]; n[i] = { ...n[i], notes: e.target.value }; return n; })} className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-brand-400" placeholder="Notes" /></td>
                    <td>{items.length > 1 && <button onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <FormField as="textarea" label="General Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
        </div>
      </Modal>
    </div>
  );
}
