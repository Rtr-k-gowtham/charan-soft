// src/pages/inventory/StockAdjustment.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Material } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { SlidersHorizontal, RefreshCw, Plus, AlertCircle } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n);

interface AdjRecord { id: number; voucher_number: string; adj_date: string; material_name: string; uom: string; old_qty: number; adj_qty: number; new_qty: number; reason: string; approved_by: string; }

export default function StockAdjustment() {
  const [records, setRecords] = useState<AdjRecord[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedMat, setSelectedMat] = useState<Material | null>(null);
  const [form, setForm] = useState({ material_id: '', adj_date: new Date().toISOString().split('T')[0], adj_type: 'add', quantity: '', reason: '', notes: '' });

  const loadMaterials = () => {
    api.getMaterials().then(d => setMaterials((d || []) as Material[])).catch(() => setMaterials([]));
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const handleSelectMat = (id: string) => {
    setForm(f => ({ ...f, material_id: id }));
    setSelectedMat(materials.find(m => m.id === Number(id)) || null);
  };

  const adjQty = form.adj_type === 'subtract' ? -Math.abs(Number(form.quantity) || 0) : Math.abs(Number(form.quantity) || 0);
  const newQty = (selectedMat?.current_stock || 0) + adjQty;

  const handleCreate = async () => {
    if (!form.material_id || !form.quantity || !form.reason) { setError('Fill all required fields'); return; }
    setSaving(true); setError('');
    try {
      await api.adjustStock({
        material_id: Number(form.material_id),
        adjustment_type: form.adj_type === 'subtract' ? 'SUBTRACT' : 'ADD',
        quantity: Math.abs(Number(form.quantity)),
        reason: form.reason,
      });

      setRecords(prev => [{
        id: prev.length + 1,
        voucher_number: `ADJ-00${prev.length + 1}`,
        adj_date: form.adj_date,
        material_name: selectedMat?.name || '',
        uom: selectedMat?.uom || '',
        old_qty: selectedMat?.current_stock || 0,
        adj_qty: adjQty,
        new_qty: newQty,
        reason: form.reason,
        approved_by: 'Stores Admin',
      }, ...prev]);
      setCreateOpen(false);
      setSelectedMat(null);
      setForm({ material_id: '', adj_date: new Date().toISOString().split('T')[0], adj_type: 'add', quantity: '', reason: '', notes: '' });
      loadMaterials();
    } catch (e: unknown) { setError((e as Error).message || 'Failed'); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'voucher_number', label: 'Voucher No', sortable: true, render: (r: AdjRecord) => <span className="font-mono font-semibold text-brand-700">{r.voucher_number}</span> },
    { key: 'adj_date', label: 'Date', sortable: true },
    { key: 'material_name', label: 'Material', sortable: true },
    { key: 'uom', label: 'UOM' },
    { key: 'old_qty', label: 'Before', render: (r: AdjRecord) => <span className="font-mono">{fmt(r.old_qty)}</span> },
    { key: 'adj_qty', label: 'Adjustment', render: (r: AdjRecord) => <span className={`font-mono font-bold ${r.adj_qty > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{r.adj_qty > 0 ? '+' : ''}{fmt(r.adj_qty)}</span> },
    { key: 'new_qty', label: 'After', render: (r: AdjRecord) => <span className="font-mono font-semibold text-brand-700">{fmt(r.new_qty)}</span> },
    { key: 'reason', label: 'Reason', render: (r: AdjRecord) => <span className="text-slate-500 text-[11px]">{r.reason}</span> },
    { key: 'approved_by', label: 'By', render: (r: AdjRecord) => <span className="text-slate-400 text-[10px]">{r.approved_by}</span> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Stock Adjustment"
        subtitle="Adjust stock levels after physical verification"
        breadcrumb={[{ label: 'Inventory' }, { label: 'Stock Adjustment' }]}
        actions={<div className="flex gap-2"><Button icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreateOpen(true)}>New Adjustment</Button></div>}
      />
      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={records} columns={columns} rowKey="id" />
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Stock Adjustment"
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleCreate} icon={<SlidersHorizontal className="w-3.5 h-3.5" />}>Post Adjustment</Button></>}>
        <div className="flex flex-col gap-3">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
          <FormField as="select" label="Material" required value={form.material_id} onChange={e => handleSelectMat(e.target.value)}>
            <option value="">— Select Material —</option>
            {materials.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name} (Current: {fmt(m.current_stock)} {m.uom})</option>)}
          </FormField>
          {selectedMat && (
            <div className="grid grid-cols-3 gap-2">
              {[{ label: 'Current Stock', value: `${fmt(selectedMat.current_stock)} ${selectedMat.uom}`, c: 'bg-slate-50 border-slate-200' },
                { label: 'Min Level', value: `${fmt(selectedMat.min_stock_level)} ${selectedMat.uom}`, c: 'bg-amber-50 border-amber-200' },
                { label: 'After Adj', value: `${fmt(newQty)} ${selectedMat.uom}`, c: newQty < selectedMat.min_stock_level ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200' }
              ].map(k => <div key={k.label} className={`p-2 rounded-md border text-center ${k.c}`}><p className="text-[10px] text-slate-500 uppercase">{k.label}</p><p className="font-bold text-sm mt-0.5 text-slate-800">{k.value}</p></div>)}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Date" type="date" required value={form.adj_date} onChange={e => setForm(f => ({ ...f, adj_date: e.target.value }))} />
            <FormField as="select" label="Adjustment Type" required value={form.adj_type} onChange={e => setForm(f => ({ ...f, adj_type: e.target.value }))}>
              <option value="add">Add Stock (+)</option>
              <option value="subtract">Remove Stock (−)</option>
            </FormField>
            <FormField label="Quantity" type="number" required min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
          </div>
          <FormField label="Reason" required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g., Physical count variance, damage write-off..." />
          <FormField as="textarea" label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
        </div>
      </Modal>
    </div>
  );
}
