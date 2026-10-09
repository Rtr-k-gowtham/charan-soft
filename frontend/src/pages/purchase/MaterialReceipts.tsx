// src/pages/purchase/MaterialReceipts.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { PurchaseOrder } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { PackageOpen, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

const fmtCur = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export default function MaterialReceipts() {
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivePO, setReceivePO] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [receiveForm, setReceiveForm] = useState<Record<number, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getPurchaseOrders();
      setPOs(((data || []) as PurchaseOrder[]).filter(p => p.status !== 'RECEIVED' && p.status !== 'CANCELLED'));
    } catch {
      setPOs([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openReceive = (po: PurchaseOrder) => {
    const init: Record<number, string> = {};
    (po.items || []).forEach(it => { if (it.id) init[it.id] = String(it.received_quantity || 0); });
    setReceiveForm(init);
    setReceivePO(po);
    setReceiveOpen(true);
  };

  const handleReceive = async () => {
    if (!receivePO) return;
    setSaving(true); setError('');
    try {
      const items = (receivePO.items || []).map(it => ({ item_id: it.id, received_quantity: Number(receiveForm[it.id!] || 0) }));
      await api.receiveGoods(receivePO.id, { items });
      setReceiveOpen(false);
      load();
    } catch (e: unknown) { setError((e as Error).message || 'Failed to record receipt'); }
    finally { setSaving(false); }
  };

  const pendingCount = pos.filter(p => p.status !== 'RECEIVED').length;

  const columns = [
    { key: 'po_number', label: 'PO Number', sortable: true, render: (r: PurchaseOrder) => <span className="font-semibold text-brand-700">{r.po_number}</span> },
    { key: 'supplier_name', label: 'Supplier', sortable: true },
    { key: 'category_name', label: 'Category', sortable: true, render: (r: PurchaseOrder) => <span className="text-slate-500 text-[10px]">{r.category_name}</span> },
    { key: 'po_date', label: 'PO Date', sortable: true },
    { key: 'delivery_due_date', label: 'Due Date', sortable: true, render: (r: PurchaseOrder) => {
      if (!r.delivery_due_date) return <span className="text-slate-400">—</span>;
      const overdue = new Date(r.delivery_due_date) < new Date();
      return <span className={overdue ? 'text-red-600 font-semibold' : ''}>{r.delivery_due_date}</span>;
    }},
    { key: 'status', label: 'Receipt Status', render: (r: PurchaseOrder) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Material Receipts"
        subtitle="Record material receipts against purchase orders"
        breadcrumb={[{ label: 'Purchase' }, { label: 'Material Receipts' }]}
        actions={<button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>}
      />

      {/* Summary Strip */}
      <div className="px-4 pt-3 pb-0 flex gap-3">
        {[
          { label: 'Pending Receipt', value: pendingCount, color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { label: 'Total POs', value: pos.length, color: 'bg-slate-50 border-slate-200 text-slate-700' },
        ].map(s => (
          <div key={s.label} className={`px-3 py-1.5 rounded-md border text-xs font-medium ${s.color}`}>
            <span className="font-bold text-sm mr-1">{s.value}</span>{s.label}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <DataTable
          data={pos}
          columns={columns}
          rowKey="id"
          onRowClick={r => setViewPO(r)}
          actions={(r: PurchaseOrder) => (
            <div className="flex items-center gap-1">
              {r.status !== 'RECEIVED' && (
                <button onClick={e => { e.stopPropagation(); openReceive(r); }} title="Record Receipt"
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100">
                  <PackageOpen className="w-3 h-3" /> Receive
                </button>
              )}
              {r.status === 'RECEIVED' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            </div>
          )}
        />
      </div>

      {/* View Drawer */}
      <Drawer open={!!viewPO} onClose={() => setViewPO(null)} title={`Receipt — ${viewPO?.po_number}`} subtitle={viewPO?.supplier_name} width="max-w-3xl">
        {viewPO && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'PO Date', value: viewPO.po_date },
                { label: 'Due Date', value: viewPO.delivery_due_date || '—' },
                { label: 'Status', value: <StatusBadge status={viewPO.status} /> },
              ].map(f => (
                <div key={f.label} className="p-2.5 bg-slate-50 rounded-md border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{f.label}</p>
                  <div className="text-xs font-semibold text-slate-700 mt-0.5">{f.value}</div>
                </div>
              ))}
            </div>
            <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Line Items & Receipt Progress</h4>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full table-dense">
                <thead><tr><th>#</th><th>Description</th><th className="text-right">Ordered</th><th className="text-right">Received</th><th className="text-right">Pending</th><th>Progress</th></tr></thead>
                <tbody>
                  {(viewPO.items || []).map((it, i) => {
                    const pct = Math.min(100, Math.round(((it.received_quantity || 0) / it.quantity) * 100));
                    return (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td className="font-medium">{it.item_description}</td>
                        <td className="text-right font-mono">{fmt(it.quantity)} {it.uom}</td>
                        <td className="text-right font-mono text-emerald-600">{fmt(it.received_quantity || 0)}</td>
                        <td className="text-right font-mono text-amber-600">{fmt(it.quantity - (it.received_quantity || 0))}</td>
                        <td className="min-w-[80px]">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-500 shrink-0">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Drawer>

      {/* Receive Modal */}
      <Modal open={receiveOpen} onClose={() => setReceiveOpen(false)} title={`Record Receipt — ${receivePO?.po_number}`}
        subtitle={`Supplier: ${receivePO?.supplier_name}`}
        footer={<><Button variant="secondary" onClick={() => setReceiveOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleReceive} icon={<PackageOpen className="w-3.5 h-3.5" />}>Record Receipt</Button></>}>
        <div className="flex flex-col gap-3">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full table-dense">
              <thead><tr><th>#</th><th>Item</th><th className="text-right">Ordered</th><th className="text-right">Previously Rcvd</th><th className="text-right">Receive Now</th></tr></thead>
              <tbody>
                {(receivePO?.items || []).map((it, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="font-medium">{it.item_description}</td>
                    <td className="text-right font-mono">{fmt(it.quantity)} {it.uom}</td>
                    <td className="text-right font-mono text-emerald-600">{fmt(it.received_quantity || 0)}</td>
                    <td>
                      <input type="number" min="0" max={it.quantity}
                        value={receiveForm[it.id!] ?? '0'}
                        onChange={e => setReceiveForm(f => ({ ...f, [it.id!]: e.target.value }))}
                        className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-brand-400 text-right" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
