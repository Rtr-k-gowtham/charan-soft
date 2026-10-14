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
import { PackageOpen, RefreshCw, CheckCircle2, AlertCircle, Building2, Calendar, Eye, Layers } from 'lucide-react';

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
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getPurchaseOrders();
      // Only Ordered POs may be selected for material receipts (Draft POs excluded)
      setPOs(((data || []) as PurchaseOrder[]).filter(p => (p.status || '').toLowerCase() === 'ordered'));
    } catch {
      setPOs([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openReceive = (po: PurchaseOrder) => {
    const init: Record<number, string> = {};
    (po.items || []).forEach(it => {
      if (it.id) {
        const ordered = Number(it.quantity || 0);
        const prevRecv = Number(it.received_quantity || 0);
        const remaining = Math.max(0, ordered - prevRecv);
        // Auto-fill by default with the ordered/remaining quantity
        init[it.id] = String(remaining > 0 ? remaining : ordered);
      }
    });
    setReceiveForm(init);
    setItemErrors({});
    setError('');
    setReceivePO(po);
    setReceiveOpen(true);
  };

  const handleQtyChange = (itemId: number, valStr: string, remaining: number, desc: string, uom: string) => {
    setReceiveForm(f => ({ ...f, [itemId]: valStr }));
    
    if (valStr === '' || valStr === undefined) {
      setItemErrors(errs => {
        const copy = { ...errs };
        delete copy[itemId];
        return copy;
      });
      return;
    }

    const val = Number(valStr);
    if (isNaN(val)) {
      setItemErrors(errs => ({ ...errs, [itemId]: `Invalid quantity entered for ${desc}.` }));
    } else if (val < 0) {
      setItemErrors(errs => ({ ...errs, [itemId]: `Receive quantity for ${desc} cannot be negative.` }));
    } else if (val > remaining + 0.0001) {
      setItemErrors(errs => ({
        ...errs,
        [itemId]: `Receive quantity for ${desc} cannot exceed the remaining ordered quantity of ${remaining} ${uom}.`
      }));
    } else {
      setItemErrors(errs => {
        const copy = { ...errs };
        delete copy[itemId];
        return copy;
      });
    }
  };

  const setMaxQuantity = (itemId: number, remaining: number, desc: string, uom: string) => {
    handleQtyChange(itemId, String(remaining), remaining, desc, uom);
  };

  const handleReceive = async () => {
    if (!receivePO) return;
    setError('');

    // Check if there are any lingering item errors
    const errorKeys = Object.keys(itemErrors);
    if (errorKeys.length > 0) {
      setError('Please resolve all quantity errors before recording receipt.');
      return;
    }

    // Verify all entered quantities against remaining ordered quantities
    let hasQuantityToReceive = false;
    const newErrors: Record<number, string> = {};

    for (const it of receivePO.items || []) {
      const rawVal = receiveForm[it.id!];
      const val = Number(rawVal || 0);
      const ordered = Number(it.quantity || 0);
      const prevRecv = Number(it.received_quantity || 0);
      const remaining = Math.max(0, ordered - prevRecv);
      const desc = it.item_description || `Item #${it.id}`;
      const uom = it.uom || 'units';

      if (rawVal !== undefined && rawVal !== '' && isNaN(val)) {
        newErrors[it.id!] = `Invalid number format for ${desc}.`;
      } else if (val < 0) {
        newErrors[it.id!] = `Receive quantity for ${desc} cannot be negative.`;
      } else if (val > remaining + 0.0001) {
        newErrors[it.id!] = `Receive quantity for ${desc} cannot exceed the remaining ordered quantity of ${remaining} ${uom}.`;
      } else if (val > 0) {
        hasQuantityToReceive = true;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setItemErrors(newErrors);
      setError('Cannot submit: One or more receiving quantities exceed allowed remaining limits.');
      return;
    }

    if (!hasQuantityToReceive) {
      setError('Please enter a receive quantity greater than 0 for at least one item.');
      return;
    }

    setSaving(true);
    try {
      const items = (receivePO.items || [])
        .map(it => {
          const q = Number(receiveForm[it.id!] || 0);
          return {
            purchase_order_item_id: it.id,
            item_id: it.id,
            quantity_received: q,
            received_quantity: q
          };
        })
        .filter(it => it.quantity_received > 0);

      await api.receiveGoods(receivePO.id, { items });
      setReceiveOpen(false);
      load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to record receipt');
    } finally {
      setSaving(false);
    }
  };

  const isFullyReceived = (po: PurchaseOrder) => {
    if (!po.items || po.items.length === 0) return false;
    return po.items.every(it => Number(it.received_quantity || 0) >= Number(it.quantity || 0) && Number(it.quantity || 0) > 0);
  };

  const pendingCount = pos.filter(p => !isFullyReceived(p)).length;

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
    { key: 'status', label: 'Receipt Status', render: (r: PurchaseOrder) => {
      const full = isFullyReceived(r);
      const anyRecv = (r.items || []).some(it => Number(it.received_quantity || 0) > 0);
      if (full) {
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Received</span>;
      }
      if (anyRecv) {
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Partially Received</span>;
      }
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Pending</span>;
    }},
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
      <div className="px-4 pt-3 pb-1 flex gap-2 flex-wrap">
        {[
          { label: 'Pending Receipt', value: pendingCount, color: 'bg-amber-50 text-amber-800' },
          { label: 'Total POs', value: pos.length, color: 'bg-slate-100 text-slate-800' },
        ].map((s) => (
          <div key={s.label} className={`px-3 py-1.5 rounded-xl text-xs font-medium border-0 shadow-2xs ${s.color}`}>
            <span className="font-bold text-sm mr-1.5 font-mono">{s.value}</span>
            {s.label}
          </div>
        ))}
      </div>

      {/* Mobile Card List (< sm) */}
      <div className="sm:hidden px-3 py-2 space-y-3">
        {pos.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-2xl text-slate-400 text-xs shadow-xs border-0">
            No purchase orders found.
          </div>
        )}
        {pos.map((r: PurchaseOrder) => {
          const full = isFullyReceived(r);
          const partial = (r.items || []).some((it) => Number(it.received_quantity || 0) > 0);
          const orderedQty = (r.items || []).reduce((s, it) => s + Number(it.quantity || 0), 0);
          const receivedQty = (r.items || []).reduce((s, it) => s + Number(it.received_quantity || 0), 0);
          const pct = orderedQty > 0 ? Math.min(100, Math.round((receivedQty / orderedQty) * 100)) : (full ? 100 : 0);

          return (
            <div
              key={r.id}
              onClick={() => setViewPO(r)}
              className="bg-white rounded-2xl p-4 shadow-xs hover:shadow-md transition-all border-0 cursor-pointer select-none space-y-3"
            >
              {/* Header: PO Number, Receipt Status & PO Status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="text-xs font-bold font-mono text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md shrink-0">
                    {r.po_number}
                  </span>
                  {full ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Fully Received
                    </span>
                  ) : partial ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                      Partial Receipt
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                      Pending Receipt
                    </span>
                  )}
                </div>

                <StatusBadge status={r.status} size="xs" />
              </div>

              {/* Supplier Info */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-brand-600" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-800 truncate block">
                    {r.supplier_name || 'Unknown Supplier'}
                  </span>
                </div>
              </div>

              {/* Dates Bar */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50/70 p-2.5 rounded-xl">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">PO Date</span>
                  <span className="font-mono text-slate-700 text-[11px]">{r.po_date || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Due Date</span>
                  <span className="font-mono text-slate-700 text-[11px]">{r.delivery_due_date || '—'}</span>
                </div>
              </div>

              {/* Receipt Progress Bar */}
              <div className="space-y-1.5 bg-slate-50/50 p-2.5 rounded-xl">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-brand-600" />
                    <span>Receipt: {pct}%</span>
                  </span>
                  <span className="font-bold text-slate-700">
                    {receivedQty} / {orderedQty} units
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      pct === 100 ? 'bg-emerald-500' : 'bg-brand-600'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewPO(r);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>

                {!full && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openReceive(r);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                  >
                    <PackageOpen className="w-3.5 h-3.5" />
                    <span>Record Receipt</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop View (sm+) */}
      <div className="hidden sm:block flex-1 overflow-hidden p-4">
        <DataTable
          data={pos}
          columns={columns}
          rowKey="id"
          onRowClick={(r) => setViewPO(r)}
          actions={(r: PurchaseOrder) => (
            <div className="flex items-center gap-1">
              {!isFullyReceived(r) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openReceive(r);
                  }}
                  title="Record Receipt"
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100"
                >
                  <PackageOpen className="w-3 h-3" /> Receive
                </button>
              )}
              {isFullyReceived(r) && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
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

      {/* Receive Modal (Enlarged Responsive Layout for Task 1 & Task 2) */}
      <Modal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        title={`Record Material Receipt — ${receivePO?.po_number}`}
        subtitle={`Supplier: ${receivePO?.supplier_name || '—'} | PO Date: ${receivePO?.po_date || '—'}`}
        size="full"
        className="max-w-[94vw] xl:max-w-7xl max-h-[92vh] flex flex-col"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-500">
              {Object.keys(itemErrors).length > 0 ? (
                <span className="text-red-600 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {Object.keys(itemErrors).length} line item(s) have quantity validation errors.
                </span>
              ) : (
                <span className="text-slate-500">
                  Enter receiving quantities for items arriving in this consignment.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setReceiveOpen(false)}>
                Cancel
              </Button>
              <Button
                loading={saving}
                onClick={handleReceive}
                disabled={Object.keys(itemErrors).length > 0}
                icon={<PackageOpen className="w-3.5 h-3.5" />}
              >
                Record Receipt
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-3 text-center w-12">#</th>
                    <th className="py-3 px-4 min-w-[280px]">Material Description</th>
                    <th className="py-3 px-3 text-right w-28">Ordered Qty</th>
                    <th className="py-3 px-3 text-center w-20">UOM</th>
                    <th className="py-3 px-3 text-right w-36">Previously Received</th>
                    <th className="py-3 px-3 text-right w-32">Remaining Qty</th>
                    <th className="py-3 px-4 text-right min-w-[220px] w-56">Receive Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs bg-white">
                  {(receivePO?.items || []).map((it, i) => {
                    const ordered = Number(it.quantity || 0);
                    const prevRecv = Number(it.received_quantity || 0);
                    const remaining = Math.max(0, ordered - prevRecv);
                    const desc = it.item_description || `Item #${i + 1}`;
                    const uom = it.uom || 'units';
                    const itemError = itemErrors[it.id!];
                    const isFullyRecv = remaining <= 0.0001;

                    return (
                      <tr key={it.id || i} className={isFullyRecv ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'}>
                        <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {i + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 text-xs leading-relaxed">
                            {desc}
                          </div>
                          {it.spec && (
                            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                              Spec: {it.spec}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                          {fmt(ordered)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
                            {uom}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-slate-600">
                          {fmt(prevRecv)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold">
                          {isFullyRecv ? (
                            <span className="text-slate-400">0.00</span>
                          ) : (
                            <span className="text-amber-600">{fmt(remaining)}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isFullyRecv ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Fully Received
                            </span>
                          ) : (
                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-1.5 w-full justify-end">
                                <input
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  step="any"
                                  placeholder="0.00"
                                  value={receiveForm[it.id!] ?? ''}
                                  onChange={e => handleQtyChange(it.id!, e.target.value, remaining, desc, uom)}
                                  className={`w-28 px-2.5 py-1.5 text-xs text-right font-mono font-semibold rounded border transition-colors focus:outline-none ${
                                    itemError
                                      ? 'border-red-500 bg-red-50/30 text-red-700 focus:border-red-600'
                                      : 'border-slate-300 bg-white text-slate-800 focus:border-brand-500'
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() => setMaxQuantity(it.id!, remaining, desc, uom)}
                                  title="Fill remaining quantity"
                                  className="px-2 py-1 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 transition-colors shrink-0"
                                >
                                  Max
                                </button>
                              </div>
                              {itemError && (
                                <p className="text-[11px] text-red-600 mt-1.5 text-right font-medium leading-tight max-w-xs">
                                  {itemError}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
