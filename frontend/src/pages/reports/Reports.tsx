// src/pages/reports/Reports.tsx
import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import { api } from '../../lib/api';
import {
  BarChart2,
  TrendingDown,
  Package,
  Factory,
  CreditCard,
  FileText,
  Download,
  RefreshCw,
  Search,
  Filter,
  CheckCheck,
  Scissors,
  Sparkles,
  Activity,
  CheckCircle,
  Boxes,
  Truck
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);
const fmtCur = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

const REPORT_TABS = [
  { key: 'purchase', label: 'Purchase', icon: FileText },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'production', label: 'Production Workflows', icon: Factory },
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

const PAYMENT_DATA = [
  { receipt: 'PAY-REC-001', po: 'PO-00045', supplier: 'ABC Textiles Mills Ltd', date: '2026-10-01', amount: 50000, mode: 'RTGS', ref: 'HDFC262749921' },
  { receipt: 'PAY-REC-002', po: 'PO-00046', supplier: 'Apex Trims & Accessories', date: '2026-10-04', amount: 33630, mode: 'NEFT', ref: 'SBI99218201' },
];

export default function Reports() {
  const [tab, setTab] = useState('production');
  const [productionReports, setProductionReports] = useState<any[]>([]);
  const [loadingProd, setLoadingProd] = useState(false);
  const [prodSearch, setProdSearch] = useState('');

  const fetchProductionReport = async () => {
    try {
      setLoadingProd(true);
      const res = await api.getDetailedProductionReports();
      const data = (res as any)?.data || res;
      setProductionReports(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      console.warn('Could not load detailed production reports, fallback to empty', e);
      setProductionReports([]);
    } finally {
      setLoadingProd(false);
    }
  };

  useEffect(() => {
    if (tab === 'production') {
      fetchProductionReport();
    }
  }, [tab]);

  const filteredProdReports = useMemo(() => {
    if (!prodSearch.trim()) return productionReports;
    const q = prodSearch.toLowerCase();
    return productionReports.filter(r =>
      (r.order_number || '').toLowerCase().includes(q) ||
      (r.title || '').toLowerCase().includes(q) ||
      (r.buyer_name || '').toLowerCase().includes(q)
    );
  }, [productionReports, prodSearch]);

  const exportCSV = () => {
    if (filteredProdReports.length === 0) return;
    const headers = ['Order Number', 'Title', 'Buyer', 'Total Qty', 'Cut Qty', 'Stitched Qty', 'Passed Qty', 'Packed Qty', 'Dispatched Qty', 'Pending Qty', 'Completion %', 'Status'];
    const rows = filteredProdReports.map(r => [
      `"${r.order_number || ''}"`,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${(r.buyer_name || '').replace(/"/g, '""')}"`,
      r.total_quantity || 0,
      r.cut_quantity || 0,
      r.stitched_quantity || 0,
      r.checked_passed_quantity || 0,
      r.packed_quantity || 0,
      r.dispatched_quantity || 0,
      r.pending_quantity || 0,
      `${r.completion_percent || 0}%`,
      `"${r.status || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `production_workflow_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <PageHeader
        title="Production Intelligence & Reports"
        subtitle="10-Stage production lifecycle analytics, stage yield reconciliation, and export reports"
        breadcrumb={[{ label: 'Reports' }]}
        actions={
          tab === 'production' && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={fetchProductionReport} className="text-xs">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingProd ? 'animate-spin' : ''}`} />
                <span className="ml-1.5 hidden sm:inline">Refresh</span>
              </Button>
              <Button size="sm" variant="primary" onClick={exportCSV} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                <span>Export CSV</span>
              </Button>
            </div>
          )
        }
      />

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-200 bg-white overflow-x-auto shrink-0 shadow-2xs">
        {REPORT_TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors
                ${tab === t.key ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full space-y-4">
        {tab === 'purchase' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total POs', value: PURCHASE_DATA.length, color: 'text-blue-700 bg-blue-50' },
                { label: 'Total Value', value: fmtCur(PURCHASE_DATA.reduce((s, r) => s + r.net_amount, 0)), color: 'text-slate-700 bg-slate-50' },
                { label: 'Total Paid', value: fmtCur(PURCHASE_DATA.reduce((s, r) => s + r.paid, 0)), color: 'text-green-700 bg-green-50' },
                { label: 'Balance Due', value: fmtCur(PURCHASE_DATA.reduce((s, r) => s + r.balance, 0)), color: 'text-red-700 bg-red-50' },
              ].map(c => (
                <div key={c.label} className={`p-3 rounded-xl border border-slate-200 bg-white shadow-2xs`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
                  <p className="text-lg font-bold mt-0.5 text-slate-800">{c.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 text-brand-500" />
                <h3 className="text-xs font-semibold text-slate-700">Purchase Order Report</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <tr><th className="p-3">PO No</th><th className="p-3">Supplier</th><th className="p-3">Category</th><th className="p-3">Date</th><th className="p-3 text-right">Net Amount</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Balance</th><th className="p-3">Payment</th><th className="p-3">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {PURCHASE_DATA.map(r => (
                      <tr key={r.po_number} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-brand-700">{r.po_number}</td>
                        <td className="p-3">{r.supplier}</td>
                        <td className="p-3 text-[10px] text-slate-400">{r.category}</td>
                        <td className="p-3 text-slate-400">{r.date}</td>
                        <td className="p-3 text-right font-mono font-semibold">{fmtCur(r.net_amount)}</td>
                        <td className="p-3 text-right font-mono text-green-600">{fmtCur(r.paid)}</td>
                        <td className={`p-3 text-right font-mono font-semibold ${r.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtCur(r.balance)}</td>
                        <td className="p-3"><StatusBadge status={r.payment_status} /></td>
                        <td className="p-3"><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'inventory' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-emerald-500" />
              <h3 className="text-xs font-semibold text-slate-700">Raw Material Stock Ledger</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr><th className="p-3">Material Name</th><th className="p-3">Category</th><th className="p-3 text-center">UOM</th><th className="p-3 text-right">Opening</th><th className="p-3 text-right">Received</th><th className="p-3 text-right">Consumed</th><th className="p-3 text-right">Closing</th><th className="p-3 text-center">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {INVENTORY_DATA.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">{r.name}</td>
                      <td className="p-3 text-slate-500">{r.category}</td>
                      <td className="p-3 text-center font-mono text-[11px]">{r.uom}</td>
                      <td className="p-3 text-right font-mono">{fmt(r.opening)}</td>
                      <td className="p-3 text-right font-mono text-emerald-600">+{fmt(r.received)}</td>
                      <td className="p-3 text-right font-mono text-amber-600">-{fmt(r.consumed)}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{fmt(r.closing)}</td>
                      <td className="p-3 text-center"><StatusBadge status={r.status === 'LOW STOCK' ? 'PENDING' : 'RECEIVED'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'production' && (
          <div className="space-y-4">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Orders Analyzed</div>
                <div className="text-xl font-black text-slate-800">{filteredProdReports.length}</div>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-1">Total Ordered</div>
                <div className="text-xl font-black text-indigo-700 font-mono">
                  {fmt(filteredProdReports.reduce((s, r) => s + (r.total_quantity || 0), 0))} pcs
                </div>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Total Dispatched</div>
                <div className="text-xl font-black text-emerald-700 font-mono">
                  {fmt(filteredProdReports.reduce((s, r) => s + (r.dispatched_quantity || 0), 0))} pcs
                </div>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">Pending Pipeline</div>
                <div className="text-xl font-black text-amber-700 font-mono">
                  {fmt(filteredProdReports.reduce((s, r) => s + (r.pending_quantity || 0), 0))} pcs
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by order #, title, or buyer..."
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {filteredProdReports.length} records found
              </span>
            </div>

            {/* Comprehensive Stage Output Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Factory className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Product-Wise Production Progress & Stage Output Report
                  </h3>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Order #</th>
                      <th className="p-3">Title & Buyer</th>
                      <th className="p-3 text-right">Order Qty</th>
                      <th className="p-3 text-right text-violet-700">Cut Output</th>
                      <th className="p-3 text-right text-teal-700">Stitched</th>
                      <th className="p-3 text-right text-sky-700">QA Passed</th>
                      <th className="p-3 text-right text-amber-700">Packed</th>
                      <th className="p-3 text-right text-emerald-700">Dispatched</th>
                      <th className="p-3 text-right text-indigo-700">Pending</th>
                      <th className="p-3 text-center">Progress</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {loadingProd ? (
                      <tr>
                        <td colSpan={11} className="p-12 text-center text-slate-400 font-sans">
                          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                          <span>Generating production reports...</span>
                        </td>
                      </tr>
                    ) : filteredProdReports.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-12 text-center text-slate-400 font-sans">
                          No production order data available for report criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredProdReports.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition">
                          <td className="p-3 font-bold text-indigo-700">{r.order_number}</td>
                          <td className="p-3 font-sans">
                            <div className="font-semibold text-slate-800">{r.title}</div>
                            <div className="text-[10px] text-slate-400">{r.buyer_name}</div>
                          </td>
                          <td className="p-3 text-right font-bold text-slate-900">{fmt(r.total_quantity)}</td>
                          <td className="p-3 text-right font-semibold text-violet-700">{fmt(r.cut_quantity)}</td>
                          <td className="p-3 text-right font-semibold text-teal-700">{fmt(r.stitched_quantity)}</td>
                          <td className="p-3 text-right font-semibold text-sky-700">{fmt(r.checked_passed_quantity)}</td>
                          <td className="p-3 text-right font-semibold text-amber-700">{fmt(r.packed_quantity)}</td>
                          <td className="p-3 text-right font-bold text-emerald-700">{fmt(r.dispatched_quantity)}</td>
                          <td className="p-3 text-right font-semibold text-indigo-700">{fmt(r.pending_quantity)}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 font-sans">
                              <span className="text-[10px] font-bold text-slate-600">{r.completion_percent}%</span>
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${r.completion_percent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center font-sans">
                            <StatusBadge status={r.status || 'In Production'} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
                <div key={c.label} className={`p-3 rounded-xl border border-slate-200 bg-white shadow-2xs`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
                  <p className="text-lg font-bold mt-0.5 text-slate-800">{c.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-green-500" />
                <h3 className="text-xs font-semibold text-slate-700">Payment Disbursements</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <tr><th className="p-3">Receipt No</th><th className="p-3">PO Ref</th><th className="p-3">Supplier</th><th className="p-3">Date</th><th className="p-3 text-right">Amount</th><th className="p-3">Mode</th><th className="p-3">Bank Ref</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {PAYMENT_DATA.map(r => (
                      <tr key={r.receipt} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-brand-700">{r.receipt}</td>
                        <td className="p-3 text-slate-500">{r.po}</td>
                        <td className="p-3">{r.supplier}</td>
                        <td className="p-3 text-slate-400">{r.date}</td>
                        <td className="p-3 text-right font-mono font-semibold text-green-700">{fmtCur(r.amount)}</td>
                        <td className="p-3"><span className="badge badge-gray">{r.mode}</span></td>
                        <td className="p-3 font-mono text-[10px] text-slate-400">{r.ref}</td>
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
