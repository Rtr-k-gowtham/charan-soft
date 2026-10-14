// src/pages/purchase/SupplierPayments.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';
import { PurchaseOrder, PurchasePayment } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { CreditCard, RefreshCw, AlertCircle, TrendingUp, CheckCircle2, Calendar, FileText, ArrowRight, Building2 } from 'lucide-react';

const fmtCur = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

export default function SupplierPayments() {
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [payments, setPayments] = useState<(PurchasePayment & { po_number: string; supplier_name: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'obligations' | 'transactions'>('obligations');
  const [payOpen, setPayOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [payForm, setPayForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'NEFT',
    reference_number: '',
    notes: ''
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getPurchaseOrders() as PurchaseOrder[];
      // Only Ordered POs are relevant for supplier payment tracking (Draft POs excluded)
      const orderedList = (data || []).filter(p => (p.status || '').toLowerCase() === 'ordered');
      setPOs(orderedList);

      const allPayments: (PurchasePayment & { po_number: string; supplier_name: string })[] = [];
      (orderedList || []).forEach(po => {
        (po.payments || []).forEach(pay => {
          allPayments.push({
            ...pay,
            po_number: po.po_number,
            supplier_name: po.supplier_name || ''
          });
        });
      });
      setPayments(allPayments.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || '')));
    } catch {
      setPOs([]);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Compute derived payment status for a PO based on Task 3 rules
  const getDerivedPaymentStatus = (po: PurchaseOrder): 'Settled' | 'Overdue' | 'Partially Paid' | 'Unpaid' => {
    const payable = roundCur(Number(po.net_amount || 0));
    const paid = roundCur(Number(po.paid_amount || 0));
    const balance = roundCur(Math.max(0, payable - paid));

    if (balance <= 0.01 && payable > 0) {
      return 'Settled';
    }

    const dueDate = po.payment_due_date;
    if (dueDate && dueDate !== '0000-00-00') {
      const today = new Date().toISOString().split('T')[0];
      if (dueDate < today && balance > 0.01) {
        return 'Overdue';
      }
    }

    if (paid > 0.01 && balance > 0.01) {
      return 'Partially Paid';
    }

    return 'Unpaid';
  };

  function roundCur(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  // Summary Metrics
  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments]);

  const totalOutstanding = useMemo(() => {
    return pos.reduce((sum, p) => {
      const payable = Number(p.net_amount || 0);
      const paid = Number(p.paid_amount || 0);
      return sum + Math.max(0, payable - paid);
    }, 0);
  }, [pos]);

  const overdueOutstanding = useMemo(() => {
    return pos
      .filter(p => getDerivedPaymentStatus(p) === 'Overdue')
      .reduce((sum, p) => {
        const payable = Number(p.net_amount || 0);
        const paid = Number(p.paid_amount || 0);
        return sum + Math.max(0, payable - paid);
      }, 0);
  }, [pos]);

  const pendingPOs = useMemo(() => {
    return pos.filter(p => {
      const st = getDerivedPaymentStatus(p);
      return st !== 'Settled';
    });
  }, [pos]);

  const openPayModal = (po?: PurchaseOrder) => {
    const target = po || (pendingPOs.length > 0 ? pendingPOs[0] : null);
    if (!target) return;
    setSelectedPO(target);
    const bal = Math.max(0, Number(target.net_amount || 0) - Number(target.paid_amount || 0));
    setPayForm({
      amount: bal > 0 ? String(bal) : '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'NEFT',
      reference_number: '',
      notes: ''
    });
    setError('');
    setPayOpen(true);
  };

  const handlePay = async () => {
    if (!selectedPO) {
      setError('Please select a purchase order.');
      return;
    }
    const amt = Number(payForm.amount);
    if (!payForm.amount || isNaN(amt) || amt <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }

    const currentBalance = Math.max(0, Number(selectedPO.net_amount || 0) - Number(selectedPO.paid_amount || 0));
    if (amt > currentBalance + 0.01) {
      setError(`Payment amount (${fmtCur(amt)}) cannot exceed the outstanding balance of ${fmtCur(currentBalance)}.`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.addPayment(selectedPO.id, payForm);
      setPayOpen(false);
      setSelectedPO(null);
      load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Payment failed');
    } finally {
      setSaving(false);
    }
  };

  const obligationsColumns = [
    {
      key: 'po_number',
      label: 'PO Number',
      sortable: true,
      render: (r: PurchaseOrder) => (
        <span className="font-semibold text-brand-700 font-mono text-xs">{r.po_number}</span>
      )
    },
    { key: 'supplier_name', label: 'Supplier Name', sortable: true },
    {
      key: 'ordered_date',
      label: 'Ordered Date',
      sortable: true,
      render: (r: PurchaseOrder) => {
        const dt = r.ordered_at ? r.ordered_at.slice(0, 10) : r.po_date;
        return <span className="text-slate-600 text-xs font-mono">{dt || '—'}</span>;
      }
    },
    {
      key: 'payment_due_date',
      label: 'Payment Due Date',
      sortable: true,
      render: (r: PurchaseOrder) => {
        const dueDate = r.payment_due_date;
        if (!dueDate || dueDate === '0000-00-00') {
          return <span className="text-slate-400 italic text-xs">Not Set</span>;
        }
        const today = new Date().toISOString().split('T')[0];
        const status = getDerivedPaymentStatus(r);
        const isOverdue = status === 'Overdue';
        return (
          <span className={`font-mono text-xs ${isOverdue ? 'text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200' : 'text-slate-700'}`}>
            {dueDate}
          </span>
        );
      }
    },
    {
      key: 'net_amount',
      label: 'PO Payable',
      sortable: true,
      render: (r: PurchaseOrder) => (
        <span className="font-mono text-right text-slate-800 font-medium">{fmtCur(r.net_amount)}</span>
      )
    },
    {
      key: 'paid_amount',
      label: 'Amount Paid',
      sortable: true,
      render: (r: PurchaseOrder) => (
        <span className="font-mono text-right text-emerald-700 font-medium">{fmtCur(r.paid_amount || 0)}</span>
      )
    },
    {
      key: 'balance_amount',
      label: 'Outstanding Balance',
      sortable: true,
      render: (r: PurchaseOrder) => {
        const bal = Math.max(0, Number(r.net_amount || 0) - Number(r.paid_amount || 0));
        const status = getDerivedPaymentStatus(r);
        return (
          <span className={`font-mono font-bold text-right ${status === 'Overdue' ? 'text-red-700' : bal > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
            {fmtCur(bal)}
          </span>
        );
      }
    },
    {
      key: 'payment_status',
      label: 'Payment Status',
      sortable: true,
      render: (r: PurchaseOrder) => {
        const st = getDerivedPaymentStatus(r);
        return <StatusBadge status={st} size="xs" />;
      }
    },
  ];

  const transactionsColumns = [
    {
      key: 'receipt_number',
      label: 'Receipt No',
      sortable: true,
      render: (r: typeof payments[0]) => (
        <span className="font-mono text-[11px] font-semibold text-brand-700">{r.receipt_number}</span>
      )
    },
    {
      key: 'po_number',
      label: 'PO Number',
      sortable: true,
      render: (r: typeof payments[0]) => (
        <span className="font-semibold text-slate-700 font-mono text-xs">{r.po_number}</span>
      )
    },
    { key: 'supplier_name', label: 'Supplier', sortable: true },
    { key: 'payment_date', label: 'Payment Date', sortable: true },
    {
      key: 'payment_mode',
      label: 'Mode',
      render: (r: typeof payments[0]) => <StatusBadge status={r.payment_mode} size="xs" />
    },
    {
      key: 'reference_number',
      label: 'Reference / UTR',
      render: (r: typeof payments[0]) => (
        <span className="text-slate-500 font-mono text-[11px]">{r.reference_number || '—'}</span>
      )
    },
    {
      key: 'amount',
      label: 'Amount Paid',
      sortable: true,
      render: (r: typeof payments[0]) => (
        <span className="font-mono font-bold text-emerald-700">{fmtCur(r.amount)}</span>
      )
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Supplier Payments"
        subtitle="Manage supplier payment due dates, track settlement status, and record disbursements"
        breadcrumb={[{ label: 'Purchase' }, { label: 'Supplier Payments' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              title="Refresh"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button
              icon={<CreditCard className="w-3.5 h-3.5" />}
              onClick={() => openPayModal()}
            >
              Record Payment
            </Button>
          </div>
        }
      />

      {/* Summary KPI Strip */}
      <div className="px-4 pt-3 pb-1 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          {
            label: 'Total Paid (All Time)',
            value: fmtCur(totalPaid),
            color: 'text-emerald-800',
            bg: 'bg-emerald-50/80',
          },
          {
            label: 'Total Outstanding',
            value: fmtCur(totalOutstanding),
            color: 'text-amber-800',
            bg: 'bg-amber-50/80',
          },
          {
            label: 'Overdue Outstanding',
            value: fmtCur(overdueOutstanding),
            color: 'text-red-800',
            bg: 'bg-red-50/80',
          },
          {
            label: 'Payment Transactions',
            value: String(payments.length),
            color: 'text-slate-800',
            bg: 'bg-slate-100/80',
          },
        ].map((k) => (
          <div key={k.label} className={`p-3 rounded-2xl border-0 shadow-2xs text-xs ${k.bg}`}>
            <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">{k.label}</p>
            <p className={`font-bold text-base mt-0.5 font-mono ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="px-4 pt-2">
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('obligations')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'obligations'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            PO Obligations & Due Dates
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
              {pos.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'transactions'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Payment Transactions History
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
              {payments.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-2 sm:p-4">
        {activeTab === 'obligations' ? (
          <>
            {/* Mobile Obligations Cards (< sm) */}
            <div className="sm:hidden px-1 py-1 space-y-3">
              {pos.length === 0 && !loading && (
                <div className="text-center py-12 bg-white rounded-2xl text-slate-400 text-xs shadow-xs border-0">
                  No payment obligations found.
                </div>
              )}
              {pos.map((r: PurchaseOrder) => {
                const status = getDerivedPaymentStatus(r);
                const bal = Math.max(0, Number(r.net_amount || 0) - Number(r.paid_amount || 0));
                const isSettled = status === 'Settled' || bal <= 0.01;

                return (
                  <div
                    key={r.id}
                    className="bg-white rounded-2xl p-4 shadow-xs hover:shadow-md transition-all border-0 space-y-3"
                  >
                    {/* Header: PO Number & Payment Status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold font-mono text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                        {r.po_number}
                      </span>
                      <StatusBadge status={status} size="xs" />
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

                    {/* Due Date info */}
                    <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50/70 p-2.5 rounded-xl">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Due Date:</span>
                        <strong className="text-slate-800 font-mono">{r.payment_due_date || r.delivery_due_date || '—'}</strong>
                      </span>
                      {(r as any).payment_terms && (
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded text-slate-500">
                          {(r as any).payment_terms}
                        </span>
                      )}
                    </div>

                    {/* 3-Column Financial Stat Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                        <span className="text-xs font-bold font-mono text-slate-800 block mt-0.5">
                          {fmtCur(r.net_amount || 0)}
                        </span>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 block">Paid</span>
                        <span className="text-xs font-bold font-mono text-emerald-800 block mt-0.5">
                          {fmtCur(r.paid_amount || 0)}
                        </span>
                      </div>
                      <div className={`p-2 rounded-xl ${bal > 0.01 ? 'bg-amber-50/70' : 'bg-slate-50'}`}>
                        <span className={`text-[10px] uppercase font-bold block ${bal > 0.01 ? 'text-amber-700' : 'text-slate-400'}`}>
                          Balance
                        </span>
                        <span className={`text-xs font-bold font-mono block mt-0.5 ${bal > 0.01 ? 'text-amber-800' : 'text-slate-500'}`}>
                          {fmtCur(bal)}
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="pt-1">
                      {isSettled ? (
                        <div className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Fully Settled</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openPayModal(r)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Record Payment ({fmtCur(bal)})</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Obligations Table (sm+) */}
            <div className="hidden sm:block">
              <DataTable
                data={pos}
                columns={obligationsColumns}
                rowKey="id"
                actions={(r: PurchaseOrder) => {
                  const status = getDerivedPaymentStatus(r);
                  const bal = Math.max(0, Number(r.net_amount || 0) - Number(r.paid_amount || 0));
                  if (status === 'Settled' || bal <= 0.01) {
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Settled
                      </span>
                    );
                  }
                  return (
                    <button
                      onClick={() => openPayModal(r)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-brand-50 text-brand-700 border border-brand-200 rounded hover:bg-brand-100 transition-colors"
                    >
                      <CreditCard className="w-3 h-3" /> Pay
                    </button>
                  );
                }}
              />
            </div>
          </>
        ) : (
          <>
            {/* Mobile Transactions Cards (< sm) */}
            <div className="sm:hidden px-1 py-1 space-y-3">
              {payments.length === 0 && !loading && (
                <div className="text-center py-12 bg-white rounded-2xl text-slate-400 text-xs shadow-xs border-0">
                  No payment transactions recorded.
                </div>
              )}
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl p-4 shadow-xs hover:shadow-md transition-all border-0 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold font-mono text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                      {p.po_number || 'PO'}
                    </span>
                    <span className="text-sm font-bold font-mono text-emerald-700">
                      {fmtCur(p.amount)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-brand-600" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 truncate block">
                        {p.supplier_name || 'Unknown Supplier'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50/70 p-2.5 rounded-xl">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Date & Mode</span>
                      <span className="font-mono text-slate-700 text-[11px] block">{p.payment_date}</span>
                      <span className="text-[10px] font-medium text-brand-700 bg-blue-50 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                        {p.payment_mode}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Ref / UTR</span>
                      <span className="font-mono text-slate-700 text-[11px] truncate block">
                        {p.reference_number || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Transactions Table (sm+) */}
            <div className="hidden sm:block">
              <DataTable
                data={payments}
                columns={transactionsColumns}
                rowKey="id"
              />
            </div>
          </>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={`Record Supplier Payment — ${selectedPO?.po_number || ''}`}
        subtitle={selectedPO ? `Supplier: ${selectedPO.supplier_name}` : 'Record settlement transaction against approved purchase order'}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={handlePay}
              icon={<CreditCard className="w-3.5 h-3.5" />}
            >
              Record Payment
            </Button>
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

          {selectedPO && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex flex-col gap-2">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Purchase Order:</span>
                  <span className="font-mono font-bold text-brand-700 text-sm">{selectedPO.po_number}</span>
                </div>
                <StatusBadge status={getDerivedPaymentStatus(selectedPO)} size="xs" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-semibold text-slate-800">{selectedPO.supplier_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">PO Payable Amount:</span>
                <span className="font-mono font-medium text-slate-700">{fmtCur(selectedPO.net_amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Total Paid So Far:</span>
                <span className="font-mono font-medium text-emerald-700">{fmtCur(selectedPO.paid_amount || 0)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-700">Outstanding Balance:</span>
                <span className="font-mono font-bold text-amber-700 text-sm">
                  {fmtCur(Math.max(0, Number(selectedPO.net_amount || 0) - Number(selectedPO.paid_amount || 0)))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Payment Due Date:</span>
                <span className={`font-mono font-medium ${getDerivedPaymentStatus(selectedPO) === 'Overdue' ? 'text-red-700 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-200' : 'text-slate-700'}`}>
                  {selectedPO.payment_due_date || 'Not specified'}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Amount to Pay (₹)"
              type="number"
              required
              value={payForm.amount}
              onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
              min="0.01"
              step="any"
              placeholder="0.00"
            />
            <FormField
              label="Payment Date"
              type="date"
              required
              value={payForm.payment_date}
              onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              as="select"
              label="Payment Mode"
              value={payForm.payment_mode}
              onChange={e => setPayForm(f => ({ ...f, payment_mode: e.target.value }))}
            >
              {['NEFT', 'RTGS', 'UPI', 'Cheque', 'Cash', 'Other'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </FormField>
            <FormField
              label="Reference / UTR Number"
              value={payForm.reference_number}
              onChange={e => setPayForm(f => ({ ...f, reference_number: e.target.value }))}
              placeholder="e.g. UTR8472918"
            />
          </div>

          <FormField
            as="textarea"
            label="Payment Remarks / Notes"
            value={payForm.notes}
            onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Optional payment remarks..."
            rows={2}
          />
        </div>
      </Modal>
    </div>
  );
}
