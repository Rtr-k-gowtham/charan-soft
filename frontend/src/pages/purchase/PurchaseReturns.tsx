// src/pages/purchase/PurchaseReturns.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { PurchaseOrder } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { RotateCcw, RefreshCw, AlertCircle, Plus, Trash2, Building2, Calendar, FileText } from 'lucide-react';

const fmtCur = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);

interface ReturnRecord {
  id: number;
  return_number: string;
  po_number: string;
  supplier_name: string;
  return_date: string;
  reason: string;
  total_amount: number;
  status: string;
}

export default function PurchaseReturns() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState({ return_date: new Date().toISOString().split('T')[0], reason: '', notes: '' });
  const [returnItems, setReturnItems] = useState<{ item_id: number; description: string; quantity: number; rate: number }[]>([]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getPurchaseReturns().catch(() => []),
      api.getPurchaseOrders().catch(() => []),
    ]).then(([rets, allPos]) => {
      setReturns((rets || []) as ReturnRecord[]);
      const received = ((allPos || []) as PurchaseOrder[]).filter(p => p.status === 'RECEIVED' || p.status === 'PARTIALLY RECEIVED');
      setPOs(received);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectPO = (id: string) => {
    const po = pos.find(p => p.id === Number(id));
    setSelectedPO(po || null);
    if (po) {
      setReturnItems((po.items || []).map(it => ({ item_id: it.id || 0, description: it.item_description, quantity: 0, rate: it.rate })));
    } else setReturnItems([]);
  };

  const totalReturnAmt = returnItems.reduce((s, i) => s + i.quantity * i.rate, 0);

  const handleCreate = async () => {
    if (!selectedPO || !form.reason) { setError('Select a PO and enter return reason'); return; }
    if (returnItems.every(i => i.quantity === 0)) { setError('Enter return quantity for at least one item'); return; }
    setSaving(true); setError('');
    try {
      const activeItem = returnItems.find(i => i.quantity > 0);
      await api.createPurchaseReturn({
        purchase_order_id: selectedPO.id,
        material_id: activeItem?.item_id || 0,
        return_date: form.return_date,
        quantity: activeItem?.quantity || 0,
        amount: totalReturnAmt,
        reason: form.reason,
      });
      setCreateOpen(false);
      setSelectedPO(null);
      setForm({ return_date: new Date().toISOString().split('T')[0], reason: '', notes: '' });
      loadData();
    } catch (e: unknown) { setError((e as Error).message || 'Failed to create return'); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'return_number', label: 'Return No', sortable: true, render: (r: ReturnRecord) => <span className="font-mono font-semibold text-brand-700">{r.return_number}</span> },
    { key: 'po_number', label: 'PO Number', sortable: true },
    { key: 'supplier_name', label: 'Supplier', sortable: true },
    { key: 'return_date', label: 'Date', sortable: true },
    { key: 'reason', label: 'Reason', render: (r: ReturnRecord) => <span className="text-slate-500 text-[11px]">{r.reason}</span> },
    { key: 'total_amount', label: 'Amount', sortable: true, render: (r: ReturnRecord) => <span className="font-mono font-bold text-red-600">{fmtCur(r.total_amount)}</span> },
    { key: 'status', label: 'Status', render: (r: ReturnRecord) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Purchase Returns"
        subtitle="Manage material returns to suppliers"
        breadcrumb={[{ label: 'Purchase' }, { label: 'Purchase Returns' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={() => setLoading(l => !l)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreateOpen(true)}>New Return</Button>
          </div>
        }
      />

      {/* Summary KPI Strip */}
      <div className="px-4 pt-3 pb-1 flex gap-2 flex-wrap">
        {[
          { label: 'Total Returns', value: String(returns.length), bg: 'bg-slate-100 text-slate-800' },
          { label: 'Pending Approval', value: String(returns.filter((r) => r.status === 'PENDING').length), bg: 'bg-amber-50 text-amber-800' },
          { label: 'Total Value', value: fmtCur(returns.reduce((s, r) => s + r.total_amount, 0)), bg: 'bg-red-50 text-red-800' },
        ].map((k) => (
          <div key={k.label} className={`px-3 py-1.5 rounded-xl border-0 shadow-2xs text-xs font-medium ${k.bg}`}>
            <span className="font-bold text-sm mr-1.5 font-mono">{k.value}</span>
            {k.label}
          </div>
        ))}
      </div>

      {/* Mobile Card List (< sm) */}
      <div className="sm:hidden px-3 py-2 space-y-3">
        {returns.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl text-slate-400 text-xs shadow-xs border-0">
            No purchase returns recorded.
          </div>
        )}
        {returns.map((r) => (
          <div
            key={r.id}
            className="bg-white rounded-2xl p-4 shadow-xs hover:shadow-md transition-all border-0 space-y-2.5"
          >
            {/* Header: Return No, Status & Amount */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold font-mono text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                  {r.return_number}
                </span>
                <StatusBadge status={r.status} size="xs" />
              </div>
              <span className="text-sm font-bold font-mono text-red-600">
                {fmtCur(r.total_amount)}
              </span>
            </div>

            {/* PO & Supplier */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-brand-600" />
                </div>
                <span className="font-bold text-slate-800 truncate block">
                  {r.supplier_name || 'Unknown Supplier'}
                </span>
              </div>
              <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px] shrink-0">
                {r.po_number}
              </span>
            </div>

            {/* Date & Reason */}
            <div className="bg-slate-50/70 p-2.5 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Return Date:</span>
                </span>
                <span className="font-mono font-medium text-slate-700">{r.return_date}</span>
              </div>
              {r.reason && (
                <p className="text-[11px] text-slate-600 italic pt-1 border-t border-slate-200/40">
                  "{r.reason}"
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table (sm+) */}
      <div className="hidden sm:block flex-1 overflow-hidden p-4">
        <DataTable data={returns} columns={columns} rowKey="id" />
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Purchase Return" size="lg"
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleCreate} icon={<RotateCcw className="w-3.5 h-3.5" />}>Create Return</Button></>}>
        <div className="flex flex-col gap-3">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FormField as="select" label="Purchase Order" required value={selectedPO?.id?.toString() || ''} onChange={e => handleSelectPO(e.target.value)}>
              <option value="">— Select received PO —</option>
              {pos.map(p => <option key={p.id} value={p.id}>{p.po_number} — {p.supplier_name}</option>)}
            </FormField>
            <FormField label="Return Date" type="date" required value={form.return_date} onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))} />
          </div>
          <FormField label="Reason for Return" required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g., Quality defect, excess supply..." />
          {returnItems.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full table-dense">
                <thead><tr><th>Item</th><th className="text-right">Rcvd Qty</th><th className="text-right">Return Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {returnItems.map((it, i) => (
                    <tr key={i}>
                      <td className="font-medium">{it.description}</td>
                      <td className="text-right font-mono">{(selectedPO?.items?.[i]?.received_quantity || 0)}</td>
                      <td><input type="number" min="0" value={it.quantity} onChange={e => setReturnItems(prev => { const n = [...prev]; n[i] = { ...n[i], quantity: Number(e.target.value) }; return n; })} className="w-20 px-1.5 py-1 text-xs border border-slate-200 rounded text-right focus:outline-none focus:border-brand-400" /></td>
                      <td className="text-right font-mono text-slate-500">{fmtCur(it.rate)}</td>
                      <td className="text-right font-mono font-semibold text-red-600">{fmtCur(it.quantity * it.rate)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50"><tr><td colSpan={4} className="text-right font-semibold text-slate-600">Total Return Value:</td><td className="text-right font-mono font-bold text-red-700">{fmtCur(totalReturnAmt)}</td></tr></tfoot>
              </table>
            </div>
          )}
          <FormField as="textarea" label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
        </div>
      </Modal>
    </div>
  );
}
