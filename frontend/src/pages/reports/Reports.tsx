// src/pages/reports/Reports.tsx
import React, { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import { BarChart2, TrendingDown, Package, Factory, CreditCard, FileText } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
const fmtCur = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

const REPORT_TABS = [
  { key: 'purchase', label: 'Purchase', icon: FileText },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'production', label: 'Production', icon: Factory },
  { key: 'payments', label: 'Payments', icon: CreditCard },
];

const PURCHASE_DATA = [
  { po_number: 'PO-00045', supplier: 'ABC Textiles Mills Ltd', category: 'Fabric Purchase Order', date: '2026-09-28', net_amount: 126000, paid: 50000, balance: 76000, status: 'PARTIALLY RECEIVED', payment_status: 'Partially Paid' },
  { po_number: 'PO-00046', supplier: 'Apex Trims & Accessories', category: 'Accessory Purchase Order', date: '2026-10-02', net_amount: 33630, paid: 33630, balance: 0, status: 'RECEIVED', payment_status: 'Paid' },
];

const INVENTORY_DATA = [
  { name: 'Cotton Fabric 40s x 60s', category: 'Fabric Material', uom: 'KG', opening: 500, received: 600, consumed: 0, closing: 1100, min_level: 500, status: 'ADEQUATE' },
  { name: 'Cotton Satin 300TC', category: 'Fabric Material', uom: 'KG', opening: 680, received: 0, consumed: 0, closing: 680, min_level: 300, status: 'ADEQUATE' },
  { name: 'Polyester Micro Twill', category: 'Fabric Material', uom: 'KG', opening: 150, received: 0, consumed: 0, closing: 150, min_level: 200, status: 'LOW STOCK' },
  { name: 'Sewing Thread 40/2', category: 'Accessory Material', uom: 'CONE', opening: 40, received: 300, consumed: 0, closing: 340, min_level: 100, status: 'ADEQUATE' },
  { name: 'Concealed Zipper 16"', category: 'Accessory Material', uom: 'PCS', opening: 450, received: 2000, consumed: 0, closing: 2450, min_level: 800, status: 'ADEQUATE' },
];

const PRODUCTION_DATA = [
  { order: 'ORD-1024', title: 'Export Queen Bed Linen Contract', customer: 'Heritage Home Linen LLC', total: 100, completed: 28, rejected: 3, rework: 3, pending: 66, delivery: '2026-10-25', status: 'IN PRODUCTION' },
  { order: 'ORD-1025', title: 'Luxury Euro Cushion Polyfill Batch', customer: 'Prestige Hospitality Group', total: 50, completed: 0, rejected: 0, rework: 0, pending: 50, delivery: '2026-10-20', status: 'IN PRODUCTION' },
];

const PAYMENT_DATA = [
  { receipt: 'PAY-REC-001', po: 'PO-00045', supplier: 'ABC Textiles Mills Ltd', date: '2026-10-01', amount: 50000, mode: 'RTGS', ref: 'HDFC262749921' },
  { receipt: 'PAY-REC-002', po: 'PO-00046', supplier: 'Apex Trims & Accessories', date: '2026-10-04', amount: 33630, mode: 'NEFT', ref: 'SBI99218201' },
];

export default function Reports() {
  const [tab, setTab] = useState('purchase');

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Reports" subtitle="Comprehensive business intelligence and summaries"
        breadcrumb={[{ label: 'Reports' }]}
      />

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-200 bg-white overflow-x-auto shrink-0">
        {REPORT_TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors
                ${tab === t.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon className="w-3 h-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tab === 'purchase' && (
          <div className="flex flex-col gap-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total POs', value: PURCHASE_DATA.length, color: 'text-blue-700 bg-blue-50' },
                { label: 'Total Value', value: fmtCur(PURCHASE_DATA.reduce((s, r) => s + r.net_amount, 0)), color: 'text-slate-700 bg-slate-50' },
                { label: 'Total Paid', value: fmtCur(PURCHASE_DATA.reduce((s, r) => s + r.paid, 0)), color: 'text-green-700 bg-green-50' },
                { label: 'Balance Due', value: fmtCur(PURCHASE_DATA.reduce((s, r) => s + r.balance, 0)), color: 'text-red-700 bg-red-50' },
              ].map(c => (
                <div key={c.label} className={`p-3 rounded-md border ${c.color}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{c.label}</p>
                  <p className="text-lg font-bold mt-0.5">{c.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 text-brand-500" />
                <h3 className="text-xs font-semibold text-slate-700">Purchase Order Report</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-dense">
                  <thead><tr><th>PO No</th><th>Supplier</th><th>Category</th><th>Date</th><th className="text-right">Net Amount</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Payment</th><th>Status</th></tr></thead>
                  <tbody>
                    {PURCHASE_DATA.map(r => (
                      <tr key={r.po_number} className="hover:bg-slate-50">
                        <td className="font-semibold text-brand-700">{r.po_number}</td>
                        <td>{r.supplier}</td>
                        <td className="text-[10px] text-slate-400">{r.category}</td>
                        <td className="text-slate-400">{r.date}</td>
                        <td className="text-right font-mono font-semibold">{fmtCur(r.net_amount)}</td>
                        <td className="text-right font-mono text-green-600">{fmtCur(r.paid)}</td>
                        <td className={`text-right font-mono font-semibold ${r.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtCur(r.balance)}</td>
                        <td><StatusBadge status={r.payment_status} /></td>
                        <td><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'inventory' && (
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-green-500" />
              <h3 className="text-xs font-semibold text-slate-700">Inventory Stock Report</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-dense">
                <thead><tr><th>Material</th><th>Category</th><th>UOM</th><th className="text-right">Opening</th><th className="text-right">Received</th><th className="text-right">Consumed</th><th className="text-right">Closing</th><th className="text-right">Min Level</th><th>Status</th></tr></thead>
                <tbody>
                  {INVENTORY_DATA.map((r, i) => (
                    <tr key={i} className={r.status === 'LOW STOCK' ? 'bg-red-50/30' : 'hover:bg-slate-50'}>
                      <td className="font-medium">{r.name}</td>
                      <td className="text-[10px] text-slate-400">{r.category}</td>
                      <td className="font-mono">{r.uom}</td>
                      <td className="text-right font-mono">{fmt(r.opening)}</td>
                      <td className="text-right font-mono text-green-600">+{fmt(r.received)}</td>
                      <td className="text-right font-mono text-orange-600">-{fmt(r.consumed)}</td>
                      <td className={`text-right font-mono font-bold ${r.closing <= r.min_level ? 'text-red-600' : 'text-slate-700'}`}>{fmt(r.closing)}</td>
                      <td className="text-right font-mono text-slate-400">{fmt(r.min_level)}</td>
                      <td><StatusBadge status={r.status === 'LOW STOCK' ? 'PENDING' : 'RECEIVED'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'production' && (
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
              <Factory className="w-3.5 h-3.5 text-indigo-500" />
              <h3 className="text-xs font-semibold text-slate-700">Production Status Report</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-dense">
                <thead><tr><th>Order No</th><th>Title</th><th>Buyer</th><th className="text-right">Total</th><th className="text-right">Completed</th><th className="text-right">Rejected</th><th className="text-right">Rework</th><th className="text-right">Pending</th><th>Delivery</th><th>Status</th></tr></thead>
                <tbody>
                  {PRODUCTION_DATA.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="font-semibold text-brand-700">{r.order}</td>
                      <td className="max-w-[160px] truncate">{r.title}</td>
                      <td className="text-slate-500">{r.customer}</td>
                      <td className="text-right font-mono">{r.total}</td>
                      <td className="text-right font-mono text-green-600">{r.completed}</td>
                      <td className="text-right font-mono text-red-600">{r.rejected}</td>
                      <td className="text-right font-mono text-amber-600">{r.rework}</td>
                      <td className="text-right font-mono text-slate-600">{r.pending}</td>
                      <td className="text-slate-400">{r.delivery}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'payments' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Total Payments', value: PAYMENT_DATA.length, color: 'bg-blue-50 text-blue-700' },
                { label: 'Total Disbursed', value: fmtCur(PAYMENT_DATA.reduce((s, r) => s + r.amount, 0)), color: 'bg-green-50 text-green-700' },
                { label: 'This Month', value: fmtCur(83630), color: 'bg-indigo-50 text-indigo-700' },
              ].map(c => (
                <div key={c.label} className={`p-3 rounded-md border ${c.color}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{c.label}</p>
                  <p className="text-lg font-bold mt-0.5">{c.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                <h3 className="text-xs font-semibold text-slate-700">Payment Register</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-dense">
                  <thead><tr><th>Receipt No</th><th>PO No</th><th>Supplier</th><th>Date</th><th>Mode</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    {PAYMENT_DATA.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="font-mono text-[10px] text-brand-700">{r.receipt}</td>
                        <td className="font-semibold text-slate-600">{r.po}</td>
                        <td>{r.supplier}</td>
                        <td className="text-slate-400">{r.date}</td>
                        <td><StatusBadge status={r.mode} /></td>
                        <td className="font-mono text-[10px] text-slate-400">{r.ref}</td>
                        <td className="text-right font-mono font-bold text-green-700">{fmtCur(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
