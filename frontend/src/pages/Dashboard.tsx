// src/pages/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { DashboardData } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import PageHeader from '../components/ui/PageHeader';
import {
  ShoppingCart, Package, Factory, AlertTriangle,
  CheckCircle2, CreditCard, TrendingUp, RefreshCw
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n);
const fmtCur = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

function KPICard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-md p-3 flex items-start gap-3 hover:shadow-sm transition-shadow">
      <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium truncate">{label}</p>
        <p className="text-lg font-bold text-slate-800 leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const EMPTY_DASHBOARD: DashboardData = {
  kpis: {
    total_purchase_orders: 0,
    pending_payments_po: 0,
    pending_payment_amount: 0,
    low_stock_count: 0,
    production_orders: 0,
    completed_orders: 0,
  },
  low_stock: [],
  recent_purchase_orders: [],
  recent_production: [],
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard() as DashboardData;
      setData(res);
    } catch {
      setData(EMPTY_DASHBOARD);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const d = data ?? EMPTY_DASHBOARD;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dashboard"
        subtitle="Cheran Soft Goods — Overview"
        breadcrumb={[{ label: 'Home' }, { label: 'Dashboard' }]}
        actions={
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <KPICard label="Purchase Orders" value={d.kpis.total_purchase_orders} icon={ShoppingCart} color="bg-blue-50 text-blue-600" />
          <KPICard label="Pending Payments" value={d.kpis.pending_payments_po} sub={fmtCur(d.kpis.pending_payment_amount) + ' due'} icon={CreditCard} color="bg-amber-50 text-amber-600" />
          <KPICard label="Low Stock Items" value={d.kpis.low_stock_count} sub="Below minimum level" icon={AlertTriangle} color="bg-red-50 text-red-600" />
          <KPICard label="In Production" value={d.kpis.production_orders} icon={Factory} color="bg-indigo-50 text-indigo-600" />
          <KPICard label="Completed Orders" value={d.kpis.completed_orders} icon={CheckCircle2} color="bg-green-50 text-green-600" />
          <KPICard label="Active Materials" value={d.low_stock.length + 4} icon={Package} color="bg-slate-100 text-slate-600" />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* Low Stock */}
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <h3 className="text-xs font-semibold text-slate-700">Low Stock Alerts</h3>
              </div>
              <span className="text-[10px] text-red-500 font-semibold">{d.low_stock.length} items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-dense">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Category</th>
                    <th className="text-right">Current</th>
                    <th className="text-right">Min Required</th>
                    <th className="text-right">Deficit</th>
                  </tr>
                </thead>
                <tbody>
                  {d.low_stock.map(item => (
                    <tr key={item.id} className="hover:bg-red-50/40">
                      <td>
                        <span className="font-medium text-slate-700">{item.name}</span>
                      </td>
                      <td className="text-slate-400">{item.category_name}</td>
                      <td className="text-right font-mono text-red-600 font-semibold">
                        {fmt(item.current_stock)} {item.uom}
                      </td>
                      <td className="text-right font-mono text-slate-500">
                        {fmt(item.min_stock_level)} {item.uom}
                      </td>
                      <td className="text-right font-mono text-red-700 font-bold">
                        {fmt(item.min_stock_level - item.current_stock)} {item.uom}
                      </td>
                    </tr>
                  ))}
                  {d.low_stock.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-6 text-slate-400 text-xs">All stocks are adequate</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Production Orders */}
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                <h3 className="text-xs font-semibold text-slate-700">Production Orders</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-dense">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Buyer</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Done</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent_production.map(ord => (
                    <tr key={ord.id} className="hover:bg-slate-50">
                      <td className="font-semibold text-brand-700">{ord.order_number}</td>
                      <td className="text-slate-500 truncate max-w-[140px]">{ord.customer_name || '—'}</td>
                      <td className="text-right font-mono">{fmt(ord.total_quantity)}</td>
                      <td className="text-right font-mono text-green-600">{fmt(ord.completed_quantity)}</td>
                      <td><StatusBadge status={ord.status} /></td>
                    </tr>
                  ))}
                  {d.recent_production.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-6 text-slate-400 text-xs">No production orders</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Purchase Orders */}
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden xl:col-span-2">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />
                <h3 className="text-xs font-semibold text-slate-700">Recent Purchase Orders</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-dense">
                <thead>
                  <tr>
                    <th>PO No</th>
                    <th>Supplier</th>
                    <th>Date</th>
                    <th className="text-right">Net Amount</th>
                    <th className="text-right">Balance</th>
                    <th>Payment</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent_purchase_orders.map(po => (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="font-semibold text-brand-700">{po.po_number}</td>
                      <td className="text-slate-600 truncate max-w-[160px]">{po.supplier_name}</td>
                      <td className="text-slate-400">{po.po_date}</td>
                      <td className="text-right font-mono font-semibold">{fmtCur(po.net_amount)}</td>
                      <td className={`text-right font-mono font-semibold ${po.balance_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {fmtCur(po.balance_amount)}
                      </td>
                      <td><StatusBadge status={po.payment_status} /></td>
                      <td><StatusBadge status={po.status} /></td>
                    </tr>
                  ))}
                  {d.recent_purchase_orders.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-6 text-slate-400 text-xs">No purchase orders yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
