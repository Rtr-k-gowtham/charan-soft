// src/pages/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { DashboardData } from '../types';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/ui/StatusBadge';
import PageHeader from '../components/ui/PageHeader';
import {
  ShoppingCart, Package, Factory, AlertTriangle,
  CheckCircle2, CreditCard, TrendingUp, RefreshCw,
  Plus, Boxes, ChevronRight, User, Calendar, ExternalLink
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n || 0);
const fmtCur = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  to: string;
}

function KPICard({ label, value, sub, icon: Icon, color, to }: KPICardProps) {
  return (
    <Link
      to={to}
      className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between gap-2 group active:scale-[0.98]"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold truncate pr-1">
          {label}
        </p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color} group-hover:scale-105 transition-transform`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div>
        <p className="text-lg sm:text-xl font-bold font-mono text-slate-800 leading-tight">
          {value}
        </p>
        {sub ? (
          <p className="text-[10px] text-slate-400 mt-0.5 truncate font-medium">
            {sub}
          </p>
        ) : (
          <p className="text-[10px] text-brand-600 mt-0.5 flex items-center gap-0.5 font-medium group-hover:translate-x-0.5 transition-transform">
            <span>View details</span>
            <ChevronRight className="w-2.5 h-2.5" />
          </p>
        )}
      </div>
    </Link>
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
  const { user } = useAuth();
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

  useEffect(() => {
    loadData();
  }, []);

  const d = data ?? EMPTY_DASHBOARD;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <PageHeader
        title="Dashboard"
        subtitle="Cheran Soft Goods — Textile Manufacturing Operations"
        breadcrumb={[{ label: 'Home' }, { label: 'Dashboard' }]}
        actions={
          <div className="flex items-center gap-1.5">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center justify-center p-2 sm:px-2.5 sm:py-1.5 text-xs font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-slate-600 ml-1.5">Refresh</span>
            </button>
            <Link
              to="/production/orders/create"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">New Order</span>
              <span className="xs:hidden">New</span>
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 flex flex-col gap-3.5 sm:gap-4 touch-scroll">
        {/* Executive Pulse / Greeting Banner */}
        <div className="bg-gradient-to-r from-brand-700 via-brand-800 to-slate-900 rounded-xl p-3.5 sm:p-4 text-white shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] sm:text-[11px] font-bold text-brand-200 tracking-wider uppercase">
                Cheran Soft Goods Operations
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">
              Welcome back{user?.name ? `, ${user.name}` : ''}
            </h2>
            <p className="text-xs text-brand-200 mt-0.5">
              {d.kpis.production_orders} batches in progress • {d.low_stock.length} inventory low-stock alerts
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Link
              to="/production/board"
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg border border-white/20 transition-colors shadow-2xs backdrop-blur-xs"
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Production Board</span>
            </Link>
            <Link
              to="/inventory/stock"
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-brand-900 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <Package className="w-3.5 h-3.5 text-brand-700" />
              <span>Check Stock</span>
            </Link>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
          <KPICard
            label="In Production"
            value={d.kpis.production_orders}
            sub="Active batches"
            icon={Factory}
            color="bg-indigo-50 text-indigo-600"
            to="/production/orders"
          />
          <KPICard
            label="Low Stock Items"
            value={d.kpis.low_stock_count}
            sub="Below min level"
            icon={AlertTriangle}
            color="bg-red-50 text-red-600"
            to="/inventory/low-stock"
          />
          <KPICard
            label="Purchase Orders"
            value={d.kpis.total_purchase_orders}
            sub="Orders placed"
            icon={ShoppingCart}
            color="bg-blue-50 text-blue-600"
            to="/purchase/orders"
          />
          <KPICard
            label="Pending Due"
            value={fmtCur(d.kpis.pending_payment_amount)}
            sub={`${d.kpis.pending_payments_po} POs pending`}
            icon={CreditCard}
            color="bg-amber-50 text-amber-600"
            to="/purchase/payments"
          />
          <KPICard
            label="Completed Orders"
            value={d.kpis.completed_orders}
            sub="Dispatched batches"
            icon={CheckCircle2}
            color="bg-green-50 text-green-600"
            to="/production/completed"
          />
          <KPICard
            label="Active Materials"
            value={d.low_stock.length + 8}
            sub="Raw & trims catalog"
            icon={Package}
            color="bg-slate-100 text-slate-700"
            to="/inventory/materials"
          />
        </div>

        {/* Main Grid: Production & Low Stock */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 sm:gap-4">

          {/* 1. Recent Production Orders */}
          <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs flex flex-col">
            <div className="flex items-center justify-between px-3.5 sm:px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Active Production Orders
                </h3>
              </div>
              <Link
                to="/production/orders"
                className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-0.5"
              >
                <span>View all ({d.recent_production.length})</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Mobile View: Clean Card List (< sm) */}
            <div className="sm:hidden divide-y divide-slate-100 p-2 space-y-2">
              {d.recent_production.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No production orders in progress
                </div>
              ) : (
                d.recent_production.slice(0, 5).map((ord) => {
                  const total = ord.total_quantity || 0;
                  const done = ord.completed_quantity || 0;
                  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

                  return (
                    <Link
                      key={ord.id}
                      to={`/production/orders/${ord.id}`}
                      className="block p-2.5 bg-slate-50/70 hover:bg-slate-100/80 rounded-lg border border-slate-200/70 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold font-mono text-brand-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                          {ord.order_number}
                        </span>
                        <StatusBadge status={ord.status} />
                      </div>

                      <p className="text-xs font-bold text-slate-800 truncate mb-1">
                        {ord.title || 'Textile Batch'}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                        <span className="flex items-center gap-1 truncate max-w-[150px]">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{ord.customer_name || 'Direct Buyer'}</span>
                        </span>
                        <span className="font-mono text-slate-700">
                          <strong className="text-emerald-600">{fmt(done)}</strong> / {fmt(total)} pcs
                        </span>
                      </div>

                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            pct === 100 ? 'bg-emerald-500' : 'bg-brand-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Desktop View: Dense Data Table (sm+) */}
            <div className="hidden sm:block overflow-x-auto touch-scroll">
              <table className="w-full table-dense">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Buyer</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Completed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent_production.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-400 text-xs">
                        No production orders
                      </td>
                    </tr>
                  ) : (
                    d.recent_production.slice(0, 8).map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50 cursor-pointer">
                        <td className="font-bold text-brand-700 font-mono">
                          <Link to={`/production/orders/${ord.id}`} className="hover:underline">
                            {ord.order_number}
                          </Link>
                        </td>
                        <td className="text-slate-600 truncate max-w-[140px]">
                          {ord.customer_name || 'Direct Order'}
                        </td>
                        <td className="text-right font-mono font-medium">{fmt(ord.total_quantity)}</td>
                        <td className="text-right font-mono font-bold text-emerald-600">
                          {fmt(ord.completed_quantity)}
                        </td>
                        <td><StatusBadge status={ord.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Low Stock Alerts */}
          <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs flex flex-col">
            <div className="flex items-center justify-between px-3.5 sm:px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Low Stock Inventory
                </h3>
              </div>
              <Link
                to="/inventory/low-stock"
                className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-0.5"
              >
                <span>{d.low_stock.length} alert{d.low_stock.length !== 1 ? 's' : ''}</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Mobile View: Alert Cards (< sm) */}
            <div className="sm:hidden divide-y divide-slate-100 p-2 space-y-2">
              {d.low_stock.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  All inventory levels are adequate
                </div>
              ) : (
                d.low_stock.slice(0, 5).map((item) => {
                  const deficit = Math.max(0, item.min_stock_level - item.current_stock);

                  return (
                    <Link
                      key={item.id}
                      to="/inventory/stock"
                      className="block p-2.5 bg-red-50/40 hover:bg-red-50/80 rounded-lg border border-red-200/60 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {item.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 font-medium">
                          {item.category_name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] mt-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">
                            Current: <strong className="text-red-600 font-mono">{fmt(item.current_stock)} {item.uom}</strong>
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">
                            Min: <strong className="text-slate-700 font-mono">{fmt(item.min_stock_level)} {item.uom}</strong>
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-red-700 bg-red-100/90 px-2 py-0.5 rounded-full shrink-0">
                          -{fmt(deficit)} {item.uom}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Desktop View: Data Table (sm+) */}
            <div className="hidden sm:block overflow-x-auto touch-scroll">
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
                  {d.low_stock.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-400 text-xs">
                        All stocks are adequate
                      </td>
                    </tr>
                  ) : (
                    d.low_stock.slice(0, 8).map((item) => (
                      <tr key={item.id} className="hover:bg-red-50/40">
                        <td>
                          <span className="font-semibold text-slate-800">{item.name}</span>
                        </td>
                        <td className="text-slate-500">{item.category_name}</td>
                        <td className="text-right font-mono text-red-600 font-bold">
                          {fmt(item.current_stock)} {item.uom}
                        </td>
                        <td className="text-right font-mono text-slate-500">
                          {fmt(item.min_stock_level)} {item.uom}
                        </td>
                        <td className="text-right font-mono text-red-700 font-bold">
                          -{fmt(item.min_stock_level - item.current_stock)} {item.uom}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Recent Purchase Orders (Full Width) */}
          <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs xl:col-span-2 flex flex-col">
            <div className="flex items-center justify-between px-3.5 sm:px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Recent Purchase Orders & Inward
                </h3>
              </div>
              <Link
                to="/purchase/orders"
                className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-0.5"
              >
                <span>View all ({d.recent_purchase_orders.length})</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Mobile View: Purchase Order Cards (< sm) */}
            <div className="sm:hidden divide-y divide-slate-100 p-2 space-y-2">
              {d.recent_purchase_orders.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No purchase orders recorded yet
                </div>
              ) : (
                d.recent_purchase_orders.slice(0, 5).map((po) => (
                  <Link
                    key={po.id}
                    to="/purchase/orders"
                    className="block p-2.5 bg-slate-50/70 hover:bg-slate-100/80 rounded-lg border border-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold font-mono text-brand-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                        {po.po_number}
                      </span>
                      <div className="flex items-center gap-1">
                        <StatusBadge status={po.payment_status} />
                        <StatusBadge status={po.status} />
                      </div>
                    </div>

                    <p className="text-xs font-bold text-slate-800 truncate mb-1">
                      {po.supplier_name || 'Vendor / Supplier'}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        {po.po_date || 'Recent'}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-600 font-medium">
                          Total: <strong>{fmtCur(po.net_amount)}</strong>
                        </span>
                        {po.balance_amount > 0 ? (
                          <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded font-mono">
                            {fmtCur(po.balance_amount)} due
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                            Paid
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Desktop View: Dense Data Table (sm+) */}
            <div className="hidden sm:block overflow-x-auto touch-scroll">
              <table className="w-full table-dense">
                <thead>
                  <tr>
                    <th>PO No</th>
                    <th>Supplier</th>
                    <th>Date</th>
                    <th className="text-right">Net Amount</th>
                    <th className="text-right">Balance Due</th>
                    <th>Payment</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent_purchase_orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-slate-400 text-xs">
                        No purchase orders yet
                      </td>
                    </tr>
                  ) : (
                    d.recent_purchase_orders.slice(0, 8).map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50 cursor-pointer">
                        <td className="font-bold text-brand-700 font-mono">
                          <Link to="/purchase/orders" className="hover:underline">
                            {po.po_number}
                          </Link>
                        </td>
                        <td className="text-slate-700 truncate max-w-[160px] font-medium">
                          {po.supplier_name}
                        </td>
                        <td className="text-slate-400 font-mono text-[11px]">{po.po_date}</td>
                        <td className="text-right font-mono font-bold text-slate-800">{fmtCur(po.net_amount)}</td>
                        <td className={`text-right font-mono font-bold ${po.balance_amount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {fmtCur(po.balance_amount)}
                        </td>
                        <td><StatusBadge status={po.payment_status} /></td>
                        <td><StatusBadge status={po.status} /></td>
                      </tr>
                    ))
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
