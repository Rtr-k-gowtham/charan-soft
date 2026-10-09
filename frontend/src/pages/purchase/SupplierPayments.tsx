// src/pages/purchase/SupplierPayments.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { PurchaseOrder, PurchasePayment } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { CreditCard, RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';

const fmtCur = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);

export default function SupplierPayments() {
  const [payments, setPayments] = useState<(PurchasePayment & { po_number: string; supplier_name: string })[]>([]);
  const [pendingPOs, setPendingPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [payForm, setPayForm] = useState({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_mode: 'NEFT', reference_number: '', notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const pos = await api.getPurchaseOrders() as PurchaseOrder[];
      const pending = (pos || []).filter(p => p.payment_status !== 'Paid');
      setPendingPOs(pending);
      const allPayments: (PurchasePayment & { po_number: string; supplier_name: string })[] = [];
      (pos || []).forEach(po => (po.payments || []).forEach(pay => allPayments.push({ ...pay, po_number: po.po_number, supplier_name: po.supplier_name || '' })));
      setPayments(allPayments.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || '')));
    } catch {
      setPayments([]);
      setPendingPOs([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const totalPending = pendingPOs.reduce((s, p) => s + p.balance_amount, 0);

  const handlePay = async () => {
    if (!selectedPO || !payForm.amount) { setError('Select a PO and enter an amount'); return; }
    setSaving(true); setError('');
    try {
      await api.addPayment(selectedPO.id, payForm);
      setPayOpen(false);
      setSelectedPO(null);
      setPayForm({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_mode: 'NEFT', reference_number: '', notes: '' });
      load();
    } catch (e: unknown) { setError((e as Error).message || 'Payment failed'); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'receipt_number', label: 'Receipt No', sortable: true, render: (r: typeof payments[0]) => <span className="font-mono text-[11px] font-semibold text-brand-700">{r.receipt_number}</span> },
    { key: 'po_number', label: 'PO Number', sortable: true, render: (r: typeof payments[0]) => <span className="font-semibold text-slate-700">{r.po_number}</span> },
    { key: 'supplier_name', label: 'Supplier', sortable: true },
    { key: 'payment_date', label: 'Date', sortable: true },
    { key: 'payment_mode', label: 'Mode', render: (r: typeof payments[0]) => <StatusBadge status={r.payment_mode} size="xs" /> },
    { key: 'reference_number', label: 'Reference', render: (r: typeof payments[0]) => <span className="text-slate-400 font-mono text-[10px]">{r.reference_number || '—'}</span> },
    { key: 'amount', label: 'Amount', sortable: true, render: (r: typeof payments[0]) => <span className="font-mono font-bold text-emerald-700">{fmtCur(r.amount)}</span> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Supplier Payments"
        subtitle="Track and record payments to suppliers"
        breadcrumb={[{ label: 'Purchase' }, { label: 'Supplier Payments' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>
            <Button icon={<CreditCard className="w-3.5 h-3.5" />} onClick={() => setPayOpen(true)}>Record Payment</Button>
          </div>
        }
      />

      {/* KPI Strip */}
      <div className="px-4 pt-3 pb-0 flex gap-3 flex-wrap">
        {[
          { label: 'Total Paid (All Time)', value: fmtCur(totalPaid), color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Outstanding Balance', value: fmtCur(totalPending), color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
          { label: 'Payment Transactions', value: String(payments.length), color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
        ].map(k => (
          <div key={k.label} className={`px-3 py-2 rounded-md border text-xs ${k.bg}`}>
            <p className="text-slate-500 text-[10px] uppercase tracking-wide">{k.label}</p>
            <p className={`font-bold text-sm mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={payments} columns={columns} rowKey="id" />
      </div>

      {/* Payment Modal */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Supplier Payment"
        footer={<><Button variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button><Button loading={saving} onClick={handlePay} icon={<CreditCard className="w-3.5 h-3.5" />}>Record Payment</Button></>}>
        <div className="flex flex-col gap-3">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
          <FormField as="select" label="Purchase Order" required value={selectedPO?.id?.toString() || ''}
            onChange={e => setSelectedPO(pendingPOs.find(p => p.id === Number(e.target.value)) || null)}>
            <option value="">— Select PO —</option>
            {pendingPOs.map(p => <option key={p.id} value={p.id}>{p.po_number} — {p.supplier_name} (Balance: {fmtCur(p.balance_amount)})</option>)}
          </FormField>
          {selectedPO && (
            <div className="flex gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>Balance due: <strong className="text-amber-800">{fmtCur(selectedPO.balance_amount)}</strong> | Paid so far: <strong className="text-emerald-700">{fmtCur(selectedPO.paid_amount)}</strong></span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount (₹)" type="number" required value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} min="0" step="0.01" />
            <FormField label="Payment Date" type="date" required value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField as="select" label="Payment Mode" value={payForm.payment_mode} onChange={e => setPayForm(f => ({ ...f, payment_mode: e.target.value }))}>
              {['NEFT', 'RTGS', 'UPI', 'Cheque', 'Cash', 'Other'].map(m => <option key={m}>{m}</option>)}
            </FormField>
            <FormField label="Reference / UTR" value={payForm.reference_number} onChange={e => setPayForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="Txn reference" />
          </div>
          <FormField as="textarea" label="Notes" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
        </div>
      </Modal>
    </div>
  );
}
