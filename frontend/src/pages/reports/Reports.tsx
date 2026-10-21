// src/pages/reports/Reports.tsx
import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import { api } from '../../lib/api';
import {
  BarChart2,
  Package,
  Factory,
  CreditCard,
  FileText,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Building2,
  Info
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
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

// Helper to compute / extract standardized values for all 10 stages
export function resolveStageMetrics(r: any) {
  const totalQty = Number(r.total_quantity || 0);

  // 01. Requirement Gathering (Draft / Completed)
  const s01Status: 'Draft' | 'Completed' = r.stage_01_requirement?.status
    ? r.stage_01_requirement.status
    : (r.status === 'COMPLETED' || r.status === 'IN PRODUCTION' || (totalQty > 0 && Number(r.cut_quantity || 0) > 0) ? 'Completed' : 'Draft');

  // 02. Purchase Order (PO) ("Issued / Total" or "—")
  const s02 = r.stage_02_po?.display ?? (r.po_total ? `${r.po_issued || 0} / ${r.po_total}` : '—');
  const s02Tip = r.stage_02_po?.tooltip ?? (s02 !== '—' ? `${s02} purchase orders issued` : 'No purchase orders applicable');

  // 03. Inward
  const s03 = r.stage_03_inward?.display ?? '—';
  const s03Tip = r.stage_03_inward?.tooltip ?? (s03 !== '—' ? `${s03} material inward progress` : 'No issued purchase orders to receive');

  // 04. Dyeing
  const s04 = r.stage_04_dyeing?.display ?? '—';
  const s04Tip = r.stage_04_dyeing?.tooltip ?? (s04 !== '—' ? `${s04} fabric dyeing receipt` : 'Dyeing not applicable or not started');

  // 05. Cutting — Product-wise
  const cutQty = Number(r.cut_quantity || 0);
  const s05 = r.stage_05_cutting?.display ?? `${fmt(cutQty)} / ${fmt(totalQty)} pcs`;
  const s05Tip = r.stage_05_cutting?.tooltip ?? `Cut: ${fmt(cutQty)} pcs, Target: ${fmt(totalQty)} pcs`;

  // 06. Embroidery — Outward / Inward
  const s06 = r.stage_06_embroidery?.display ?? '—';
  const s06Tip = r.stage_06_embroidery?.tooltip ?? (s06 !== '—' ? `${s06} embroidery outward/inward` : 'Embroidery not applicable or not started');

  // 07. Stitching — Color-wise Tracking
  const stitchedQty = Number(r.stitched_quantity || 0);
  const s07 = r.stage_07_stitching?.display ?? `${fmt(stitchedQty)} / ${fmt(totalQty)} pcs`;
  const s07Tip = r.stage_07_stitching?.tooltip ?? `Stitched: ${fmt(stitchedQty)} pcs, Target: ${fmt(totalQty)} pcs`;

  // 08. Checking
  const inspectedQty = Number(r.checked_inspected_quantity ?? r.checked_passed_quantity ?? 0);
  const passedQty = Number(r.checked_passed_quantity || 0);
  const s08 = r.stage_08_checking?.display ?? `${fmt(inspectedQty)} / ${fmt(totalQty)} inspected`;
  const s08Tip = r.stage_08_checking?.tooltip ?? `Inspected: ${fmt(inspectedQty)} pcs, Passed: ${fmt(passedQty)} pcs`;

  // 09. Packing
  const packedQty = Number(r.packed_quantity || 0);
  const s09 = r.stage_09_packing?.display ?? `${fmt(packedQty)} / ${fmt(totalQty)} pcs`;
  const s09Tip = r.stage_09_packing?.tooltip ?? `Packed: ${fmt(packedQty)} pcs, Target: ${fmt(totalQty)} pcs`;

  // 10. Completed
  const completedQty = Number(r.completed_quantity ?? r.dispatched_quantity ?? 0);
  const s10 = r.stage_10_completed?.display ?? `${fmt(completedQty)} / ${fmt(totalQty)} pcs`;
  const s10Tip = r.stage_10_completed?.tooltip ?? `Completed: ${fmt(completedQty)} pcs, Target: ${fmt(totalQty)} pcs`;

  // Overall Progress (0-100% or "—")
  let progressPct: number | null = null;
  if (typeof r.completion_percent === 'number') {
    progressPct = Math.max(0, Math.min(100, r.completion_percent));
  } else if (totalQty > 0) {
    progressPct = Math.max(0, Math.min(100, Math.round((completedQty / totalQty) * 100)));
  }

  // Current Status
  const currentStatus = r.current_stage_name || r.status || 'In Production';

  return {
    s01Status,
    s02, s02Tip,
    s03, s03Tip,
    s04, s04Tip,
    s05, s05Tip,
    s06, s06Tip,
    s07, s07Tip,
    s08, s08Tip,
    s09, s09Tip,
    s10, s10Tip,
    progressPct,
    currentStatus,
    totalQty,
    completedQty
  };
}

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

  // Search filter across Order ID, Title, and Buyer
  const filteredProdReports = useMemo(() => {
    if (!prodSearch.trim()) return productionReports;
    const q = prodSearch.toLowerCase().trim();
    return productionReports.filter(r =>
      (r.order_number || '').toLowerCase().includes(q) ||
      (r.title || '').toLowerCase().includes(q) ||
      (r.buyer_name || '').toLowerCase().includes(q)
    );
  }, [productionReports, prodSearch]);

  // Export CSV adhering to section 8 specifications
  const exportCSV = () => {
    if (filteredProdReports.length === 0) return;
    const headers = [
      'Order ID',
      'Order Title',
      'Buyer',
      '01. Requirement Gathering',
      '02. Purchase Order (PO)',
      '03. Inward',
      '04. Dyeing',
      '05. Cutting — Product-wise',
      '06. Embroidery — Outward / Inward',
      '07. Stitching — Color-wise Tracking',
      '08. Checking',
      '09. Packing',
      '10. Completed',
      'Overall Progress',
      'Current Status'
    ];

    const rows = filteredProdReports.map(r => {
      const m = resolveStageMetrics(r);
      return [
        `"${(r.order_number || '').replace(/"/g, '""')}"`,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        `"${(r.buyer_name || '').replace(/"/g, '""')}"`,
        `"${m.s01Status}"`,
        `"${m.s02}"`,
        `"${m.s03}"`,
        `"${m.s04}"`,
        `"${m.s05}"`,
        `"${m.s06}"`,
        `"${m.s07}"`,
        `"${m.s08}"`,
        `"${m.s09}"`,
        `"${m.s10}"`,
        m.progressPct !== null ? `"${m.progressPct}%"` : '"—"',
        `"${m.currentStatus}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `production_stages_report_${new Date().toISOString().split('T')[0]}.csv`);
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
              <Button size="sm" variant="primary" onClick={exportCSV} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs">
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

      <div className="flex-1 overflow-y-auto p-4 max-w-7xl mx-auto w-full space-y-4">
        {/* PURCHASE TAB */}
        {tab === 'purchase' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total POs', value: PURCHASE_DATA.length, color: 'text-blue-700 bg-blue-50' },
                { label: 'Total Value', value: fmtCur(PURCHASE_DATA.reduce((s, r) => s + r.net_amount, 0)), color: 'text-slate-700 bg-slate-50' },
                { label: 'Total Paid', value: fmtCur(PURCHASE_DATA.reduce((s, r) => s + r.paid, 0)), color: 'text-green-700 bg-green-50' },
                { label: 'Balance Due', value: fmtCur(PURCHASE_DATA.reduce((s, r) => s + r.balance, 0)), color: 'text-red-700 bg-red-50' },
              ].map(c => (
                <div key={c.label} className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
                  <p className="text-lg font-bold mt-0.5 text-slate-800">{c.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 text-indigo-600" />
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
                        <td className="p-3 font-semibold text-indigo-700">{r.po_number}</td>
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

        {/* INVENTORY TAB */}
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

        {/* PRODUCTION TAB */}
        {tab === 'production' && (
          <div className="space-y-4">
            {/* 1. Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
                  <span>Orders Analyzed</span>
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-xl font-black text-slate-800">{filteredProdReports.length}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Active production runs</div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-1 flex items-center justify-between">
                  <span>Total Ordered</span>
                  <Factory className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="text-xl font-black text-indigo-700 font-mono">
                  {fmt(filteredProdReports.reduce((s, r) => s + (Number(r.total_quantity) || 0), 0))} pcs
                </div>
                <div className="text-[10px] text-indigo-400 mt-0.5">Sum of required quantities</div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1 flex items-center justify-between">
                  <span>Total Dispatched</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-xl font-black text-emerald-700 font-mono">
                  {fmt(filteredProdReports.reduce((s, r) => s + (Number(r.completed_quantity ?? r.dispatched_quantity) || 0), 0))} pcs
                </div>
                <div className="text-[10px] text-emerald-500 mt-0.5">Completed output batches</div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1 flex items-center justify-between">
                  <span>Pending Pipeline</span>
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="text-xl font-black text-amber-700 font-mono">
                  {fmt(filteredProdReports.reduce((s, r) => s + (Number(r.pending_quantity) || 0), 0))} pcs
                </div>
                <div className="text-[10px] text-amber-500 mt-0.5">Remaining in production</div>
              </div>
            </div>

            {/* 2. Filter Bar */}
            <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Order ID (ORD-5516), Order Title, or Buyer..."
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                />
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500 font-medium px-1 sm:px-0">
                <span>
                  Showing <strong className="text-slate-800">{filteredProdReports.length}</strong> of {productionReports.length} orders
                </span>
              </div>
            </div>

            {/* 3. Report Container */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Factory className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Product-Wise Production Progress & Stage Output Report
                  </h3>
                </div>
                <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">
                  10-Stage Granular Output
                </span>
              </div>

              {loadingProd ? (
                <div className="p-12 text-center text-slate-400 font-sans">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                  <span>Loading production stage metrics...</span>
                </div>
              ) : filteredProdReports.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-sans">
                  No production order records match your search criteria.
                </div>
              ) : (
                <>
                  {/* A. DESKTOP VIEW: Fixed-Width Table (No Horizontal Scrolling) */}
                  <div className="hidden lg:block w-full overflow-hidden">
                    <table className="w-full table-fixed text-[11px] text-left border-collapse">
                      <colgroup>
                        <col className="w-[7.0%]" />  {/* 1. Order ID */}
                        <col className="w-[11.0%]" /> {/* 2. Order Title */}
                        <col className="w-[9.0%]" />  {/* 3. Buyer */}
                        <col className="w-[6.5%]" />  {/* 4. 01. REQ */}
                        <col className="w-[5.5%]" />  {/* 5. 02. PO */}
                        <col className="w-[6.5%]" />  {/* 6. 03. Inward */}
                        <col className="w-[7.0%]" />  {/* 7. 04. Dyeing */}
                        <col className="w-[6.5%]" />  {/* 8. 05. Cutting */}
                        <col className="w-[7.0%]" />  {/* 9. 06. Embroidery */}
                        <col className="w-[6.5%]" />  {/* 10. 07. Stitching */}
                        <col className="w-[7.0%]" />  {/* 11. 08. Checking */}
                        <col className="w-[6.5%]" />  {/* 12. 09. Packing */}
                        <col className="w-[6.5%]" />  {/* 13. 10. Completed */}
                        <col className="w-[7.5%]" />  {/* 14. Overall Progress */}
                        <col className="w-[9.5%]" />  {/* 15. Current Status */}
                      </colgroup>
                      <thead className="bg-slate-50/90 text-slate-700 border-b border-slate-200 font-bold text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="p-2 truncate" title="1. Order ID">Order ID</th>
                          <th className="p-2 truncate" title="2. Order Title">Order Title</th>
                          <th className="p-2 truncate" title="3. Buyer">Buyer</th>
                          <th className="p-2 text-center truncate" title="4. 01. Requirement Gathering">01. REQ</th>
                          <th className="p-2 text-center truncate" title="5. 02. Purchase Order (PO)">02. PO</th>
                          <th className="p-2 text-center truncate" title="6. 03. Inward">03. Inward</th>
                          <th className="p-2 text-center truncate" title="7. 04. Dyeing">04. Dyeing</th>
                          <th className="p-2 text-center truncate" title="8. 05. Cutting — Product-wise">05. Cutting</th>
                          <th className="p-2 text-center truncate" title="9. 06. Embroidery — Outward / Inward">06. Embroidery</th>
                          <th className="p-2 text-center truncate" title="10. 07. Stitching — Color-wise Tracking">07. Stitching</th>
                          <th className="p-2 text-center truncate" title="11. 08. Checking">08. Checking</th>
                          <th className="p-2 text-center truncate" title="12. 09. Packing">09. Packing</th>
                          <th className="p-2 text-center truncate" title="13. 10. Completed">10. Completed</th>
                          <th className="p-2 text-center truncate" title="14. Overall Progress">Progress</th>
                          <th className="p-2 text-center truncate" title="15. Current Status">Current Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProdReports.map((r, idx) => {
                          const m = resolveStageMetrics(r);
                          return (
                            <tr key={idx} className="hover:bg-indigo-50/20 transition-colors">
                              {/* 1. Order ID */}
                              <td className="p-2 font-mono font-bold text-indigo-700 truncate" title={r.order_number}>
                                {r.order_number}
                              </td>

                              {/* 2. Order Title */}
                              <td className="p-2 font-medium text-slate-800 truncate" title={r.title}>
                                {r.title}
                              </td>

                              {/* 3. Buyer */}
                              <td className="p-2 text-slate-600 truncate" title={r.buyer_name}>
                                {r.buyer_name || '—'}
                              </td>

                              {/* 4. 01. Requirement Gathering */}
                              <td className="p-2 text-center" title={`01. Requirement Gathering: ${m.s01Status}`}>
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                  m.s01Status === 'Completed'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {m.s01Status}
                                </span>
                              </td>

                              {/* 5. 02. Purchase Order (PO) */}
                              <td className="p-2 text-center font-mono font-medium text-slate-700 truncate" title={m.s02Tip}>
                                {m.s02}
                              </td>

                              {/* 6. 03. Inward */}
                              <td className="p-2 text-center font-mono font-medium text-slate-700 truncate" title={m.s03Tip}>
                                {m.s03}
                              </td>

                              {/* 7. 04. Dyeing */}
                              <td className="p-2 text-center font-mono font-medium text-slate-700 truncate" title={m.s04Tip}>
                                {m.s04}
                              </td>

                              {/* 8. 05. Cutting — Product-wise */}
                              <td className="p-2 text-center font-mono font-medium text-slate-700 truncate" title={m.s05Tip}>
                                {m.s05}
                              </td>

                              {/* 9. 06. Embroidery — Outward / Inward */}
                              <td className="p-2 text-center font-mono font-medium text-slate-700 truncate" title={m.s06Tip}>
                                {m.s06}
                              </td>

                              {/* 10. 07. Stitching — Color-wise Tracking */}
                              <td className="p-2 text-center font-mono font-medium text-slate-700 truncate" title={m.s07Tip}>
                                {m.s07}
                              </td>

                              {/* 11. 08. Checking */}
                              <td className="p-2 text-center font-mono font-medium text-slate-700 truncate" title={m.s08Tip}>
                                {m.s08}
                              </td>

                              {/* 12. 09. Packing */}
                              <td className="p-2 text-center font-mono font-medium text-slate-700 truncate" title={m.s09Tip}>
                                {m.s09}
                              </td>

                              {/* 13. 10. Completed */}
                              <td className="p-2 text-center font-mono font-bold text-slate-900 truncate" title={m.s10Tip}>
                                {m.s10}
                              </td>

                              {/* 14. Overall Progress */}
                              <td className="p-2 text-center" title={`Overall Progress: ${m.progressPct !== null ? `${m.progressPct}%` : '—'}`}>
                                {m.progressPct !== null ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-700 font-mono w-7 text-right">
                                      {m.progressPct}%
                                    </span>
                                    <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                                      <div
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          m.progressPct === 100
                                            ? 'bg-emerald-500'
                                            : m.progressPct > 50
                                            ? 'bg-indigo-600'
                                            : 'bg-amber-500'
                                        }`}
                                        style={{ width: `${m.progressPct}%` }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-mono">—</span>
                                )}
                              </td>

                              {/* 15. Current Status */}
                              <td className="p-2 text-center">
                                <StatusBadge status={m.currentStatus} size="xs" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* B. MOBILE & TABLET RESPONSIVE CARDS VIEW (< 1024px) */}
                  <div className="block lg:hidden p-3 space-y-3 bg-slate-50/60">
                    {filteredProdReports.map((r, idx) => {
                      const m = resolveStageMetrics(r);
                      return (
                        <div
                          key={idx}
                          className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-3 hover:border-indigo-200 transition"
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-sm text-indigo-700">
                                  {r.order_number}
                                </span>
                                <StatusBadge status={m.currentStatus} size="xs" />
                              </div>
                              <h4 className="font-bold text-xs text-slate-800 mt-1 line-clamp-1" title={r.title}>
                                {r.title}
                              </h4>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{r.buyer_name || 'No Buyer Assigned'}</span>
                              </div>
                            </div>

                            {/* Overall Progress Mini Metric */}
                            <div className="text-right shrink-0">
                              <span className="text-xs font-black text-slate-800 font-mono">
                                {m.progressPct !== null ? `${m.progressPct}%` : '—'}
                              </span>
                              <div className="text-[10px] text-slate-400">Progress</div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          {m.progressPct !== null && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                <span>Production Progress</span>
                                <span className="font-mono">{m.progressPct}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    m.progressPct === 100
                                      ? 'bg-emerald-500'
                                      : m.progressPct > 50
                                      ? 'bg-indigo-600'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${m.progressPct}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* 10 Production Stages Grid */}
                          <div className="space-y-1 pt-1">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Stage-Wise Status & Output
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                              {/* 01. Requirement Gathering */}
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <span className="text-[11px] font-medium text-slate-600 truncate">
                                  01 Requirement Gathering
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                  m.s01Status === 'Completed'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {m.s01Status}
                                </span>
                              </div>

                              {/* 02. Purchase Order */}
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <span className="text-[11px] font-medium text-slate-600 truncate">
                                  02 Purchase Order
                                </span>
                                <span className="font-mono font-semibold text-slate-800 text-[11px]">
                                  {m.s02 !== '—' ? `${m.s02} issued` : '—'}
                                </span>
                              </div>

                              {/* 03. Inward */}
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <span className="text-[11px] font-medium text-slate-600 truncate">
                                  03 Inward
                                </span>
                                <span className="font-mono font-semibold text-slate-800 text-[11px]">
                                  {m.s03 !== '—' ? `${m.s03} received` : '—'}
                                </span>
                              </div>

                              {/* 04. Dyeing */}
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <span className="text-[11px] font-medium text-slate-600 truncate">
                                  04 Dyeing
                                </span>
                                <span className="font-mono font-semibold text-slate-800 text-[11px]">
                                  {m.s04}
                                </span>
                              </div>

                              {/* 05. Cutting */}
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <span className="text-[11px] font-medium text-slate-600 truncate">
                                  05 Cutting
                                </span>
                                <span className="font-mono font-semibold text-slate-800 text-[11px]">
                                  {m.s05}
                                </span>
                              </div>

                              {/* 06. Embroidery */}
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <span className="text-[11px] font-medium text-slate-600 truncate">
                                  06 Embroidery
                                </span>
                                <span className="font-mono font-semibold text-slate-800 text-[11px]">
                                  {m.s06}
                                </span>
                              </div>

                              {/* 07. Stitching */}
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <span className="text-[11px] font-medium text-slate-600 truncate">
                                  07 Stitching
                                </span>
                                <span className="font-mono font-semibold text-slate-800 text-[11px]">
                                  {m.s07}
                                </span>
                              </div>

                              {/* 08. Checking */}
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <span className="text-[11px] font-medium text-slate-600 truncate">
                                  08 Checking
                                </span>
                                <span className="font-mono font-semibold text-slate-800 text-[11px]">
                                  {m.s08}
                                </span>
                              </div>

                              {/* 09. Packing */}
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <span className="text-[11px] font-medium text-slate-600 truncate">
                                  09 Packing
                                </span>
                                <span className="font-mono font-semibold text-slate-800 text-[11px]">
                                  {m.s09}
                                </span>
                              </div>

                              {/* 10. Completed */}
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <span className="text-[11px] font-medium text-slate-600 truncate">
                                  10 Completed
                                </span>
                                <span className="font-mono font-bold text-slate-900 text-[11px]">
                                  {m.s10}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {tab === 'payments' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Total Payments', value: PAYMENT_DATA.length, color: 'bg-blue-50 text-blue-700' },
                { label: 'Total Disbursed', value: fmtCur(PAYMENT_DATA.reduce((s, r) => s + r.amount, 0)), color: 'bg-green-50 text-green-700' },
                { label: 'This Month', value: fmtCur(83630), color: 'bg-indigo-50 text-indigo-700' },
              ].map(c => (
                <div key={c.label} className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
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
                        <td className="p-3 font-semibold text-indigo-700">{r.receipt}</td>
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
