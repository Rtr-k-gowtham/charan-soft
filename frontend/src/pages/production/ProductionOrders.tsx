// src/pages/production/ProductionOrders.tsx
// Phase 2 Production Dashboard & Product-Wise Order Tracking Workspace
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionDashboardStats } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import {
  Plus,
  Eye,
  RefreshCw,
  Calendar,
  Search,
  X,
  ChevronDown,
  Layers,
  Scissors,
  Sparkles,
  Activity,
  CheckCircle,
  Boxes,
  Truck,
  AlertTriangle,
  CheckCheck,
  TrendingUp,
  Package,
  Clock,
  Filter
} from 'lucide-react';

export const getProductionOrderStage = (ord: ProductionOrder): string => {
  if (ord.current_stage_name) return ord.current_stage_name;
  if (ord.items && ord.items.length > 0) {
    const allCompleted = ord.items.every(
      (it) => it.status === 'Completed' || it.current_stage_id === 10 || (it.current_stage_name || '').toLowerCase() === 'completed'
    );
    if (allCompleted) return 'Completed';
    const incomplete = ord.items.filter(
      (it) => it.status !== 'Completed' && it.current_stage_id !== 10 && (it.current_stage_name || '').toLowerCase() !== 'completed'
    );
    const activeList = incomplete.length > 0 ? incomplete : ord.items;
    const sorted = [...activeList].sort((a, b) => {
      const seqA = a.stage_sequence ?? a.current_stage_id ?? 1;
      const seqB = b.stage_sequence ?? b.current_stage_id ?? 1;
      return seqA - seqB;
    });
    return sorted[0]?.current_stage_name || 'Requirement Gathering';
  }
  if (ord.status === 'Completed' || ord.status === 'COMPLETED') return 'Completed';
  return 'Requirement Gathering';
};

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n || 0);

export default function ProductionOrders() {
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [dashboardStats, setDashboardStats] = useState<ProductionDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [buyerFilter, setBuyerFilter] = useState('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordRes, statsRes] = await Promise.all([
        api.getProductionOrders(),
        api.getProductionDashboardKPIs().catch(() => null)
      ]);

      const ordData = (ordRes as any)?.data || ordRes;
      setOrders(Array.isArray(ordData) ? ordData : []);

      const stData = (statsRes as any)?.data || statsRes;
      if (stData) setDashboardStats(stData);
    } catch (err) {
      console.error('Failed to load production orders & dashboard KPIs:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Unique Buyers list
  const uniqueBuyers = useMemo(() => {
    const map = new Map<number, string>();
    orders.forEach(o => {
      if (o.customer_id && o.customer_name) {
        map.set(Number(o.customer_id), o.customer_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const stage = getProductionOrderStage(ord);
      // Status / Stage filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Completed') {
          if (stage !== 'Completed' && ord.status?.toUpperCase() !== 'COMPLETED') return false;
        } else if (statusFilter === 'In Production') {
          if (stage === 'Completed' || ord.status?.toUpperCase() === 'COMPLETED') return false;
        } else if (stage.toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }
      if (priorityFilter !== 'ALL' && ord.priority?.toUpperCase() !== priorityFilter.toUpperCase()) {
        return false;
      }
      if (buyerFilter !== 'ALL' && String(ord.customer_id) !== String(buyerFilter)) {
        return false;
      }
      if (stageFilter !== 'ALL') {
        const hasStage = (ord.items || []).some(
          it => (it.stage_code || '').toUpperCase() === stageFilter.toUpperCase() ||
            (it.current_stage_name || '').toUpperCase().includes(stageFilter.toUpperCase())
        );
        if (!hasStage) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const numMatch = ord.order_number?.toLowerCase().includes(q);
        const titleMatch = ord.title?.toLowerCase().includes(q);
        const custMatch = ord.customer_name?.toLowerCase().includes(q);
        const catMatch = (ord.category_name || '').toLowerCase().includes(q);
        const stageMatch = stage.toLowerCase().includes(q);
        const prodMatch = (ord.items || []).some(i => (i.product_name || '').toLowerCase().includes(q) || (i.product_code || '').toLowerCase().includes(q));
        return numMatch || titleMatch || custMatch || catMatch || stageMatch || prodMatch;
      }
      return true;
    });
  }, [orders, statusFilter, priorityFilter, buyerFilter, stageFilter, search]);

  // Derived or fallback stats from loaded orders
  const stats = useMemo(() => {
    if (dashboardStats) return dashboardStats;

    const totalOrders = orders.length;
    const activeOrders = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'Cancelled');
    const totalOrdered = orders.reduce((s, o) => s + (o.total_quantity || 0), 0);
    const completedOrders = orders.filter(o => o.status === 'Completed' || o.status === 'COMPLETED').length;
    const inProd = activeOrders.reduce((s, o) => s + (o.total_quantity || 0) - (o.completed_quantity || 0), 0);

    return {
      total_active_orders: activeOrders.length,
      total_ordered_quantity: totalOrdered,
      total_quantity_in_production: inProd,
      cutting_pending_quantity: Math.round(inProd * 0.25),
      embroidery_outward_quantity: Math.round(inProd * 0.3),
      embroidery_outstanding_quantity: Math.round(inProd * 0.15),
      stitching_pending_quantity: Math.round(inProd * 0.2),
      checking_pending_quantity: Math.round(inProd * 0.1),
      packing_pending_quantity: Math.round(inProd * 0.05),
      completed_orders: completedOrders,
      partially_dispatched_orders: orders.filter(o => o.status === 'Partially Dispatched').length,
      overdue_orders: orders.filter(o => o.target_delivery_date && new Date(o.target_delivery_date) < new Date()).length
    };
  }, [dashboardStats, orders]);

  return (
    <div className="min-h-full pb-12 bg-[#f8fafc] space-y-4">
      <PageHeader
        title="Production Dashboard & Work Orders"
        subtitle="End-to-end 10-stage manufacturing tracking, quantity ledger & dispatch management"
        breadcrumb={[{ label: 'Production' }, { label: 'Dashboard' }]}
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center justify-center p-2 sm:px-3 sm:py-1.5 text-xs font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-slate-600 ml-1.5">Refresh</span>
            </button>
            <Button
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => navigate('/production/orders/create')}
              className="text-xs px-2.5 py-1.5 font-semibold"
            >
              <span>New Order</span>
            </Button>
          </div>
        }
      />

      {/* PHASE 2: Production Dashboard Real-Time KPI Cards */}


      {/* Search & Filter Bar */}
      <div className="px-3 sm:px-4 md:px-6 space-y-2.5 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {/* Search box */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by order #, title, buyer, product SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Buyer Filter */}
          <div>
            <select
              value={buyerFilter}
              onChange={(e) => setBuyerFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ALL">All Buyers</option>
              {uniqueBuyers.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Stage Filter */}
          <div>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ALL">All Stages (1-10)</option>
              <option value="REQ">01. Requirement Gathering</option>
              <option value="PO">02. Purchase Order</option>
              <option value="INW">03. Inward</option>
              <option value="DYE">04. Dyeing</option>
              <option value="CUT">05. Cutting</option>
              <option value="EMB">06. Embroidery</option>
              <option value="STI">07. Stitching</option>
              <option value="CHK">08. Checking</option>
              <option value="PCK">09. Packing</option>
              <option value="COMP">10. Completed / Dispatch</option>
            </select>
          </div>
        </div>
      </div>

      {/* Production Orders Simple Table */}
      <div className="px-3 sm:px-4 md:px-6 py-2 w-full">
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse table-auto">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-2.5 py-2.5 w-8 text-center text-slate-400">#</th>
                  <th className="px-2.5 py-2.5 whitespace-nowrap">Order #</th>
                  <th className="px-2.5 py-2.5">Order Title</th>
                  <th className="px-2.5 py-2.5">Buyer / Customer</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Total Qty</th>

                  <th className="px-3 py-2.5 min-w-[130px]">Production Progress</th>
                  <th className="px-2.5 py-2.5 whitespace-nowrap">Target Delivery</th>
                  <th className="px-2 py-2.5 text-center whitespace-nowrap">Priority</th>
                  <th className="px-2 py-2.5 text-center whitespace-nowrap">Production Stage</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin text-brand-600 mx-auto mb-2" />
                      <span>Loading production orders...</span>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      No production orders found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord, idx) => {
                    const totalQty = ord.total_quantity || 0;
                    const completedQty = ord.completed_quantity || 0;
                    const pendingQty = Math.max(0, totalQty - completedQty);
                    const pct = totalQty > 0 ? Math.min(100, Math.round((completedQty / totalQty) * 100)) : 0;

                    return (
                      <tr
                        key={ord.id}
                        onClick={() => navigate(`/production/orders/${ord.id}`, { state: { from: location.pathname + location.search } })}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="px-2.5 py-2.5 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>

                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                            {ord.order_number}
                          </span>
                        </td>

                        <td className="px-2.5 py-2.5">
                          <span
                            className="font-semibold text-slate-800 block text-xs hover:text-brand-600 transition-colors truncate max-w-[170px] xl:max-w-[220px]"
                            title={ord.title}
                          >
                            {ord.title}
                          </span>
                          {(() => {
                            const uCount = (ord as any).unique_products_count || new Set((ord.items || []).filter(i => (i.total_quantity || 0) > 0 || (i.current_stage_quantity || 0) > 0).map(i => `${i.product_id}_${i.color}`)).size || ord.items?.length || 0;
                            return (
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {uCount} {uCount === 1 ? 'Product' : 'Products'}
                              </span>
                            );
                          })()}
                        </td>

                        <td className="px-2.5 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <BuyerAvatar buyer={ord} size="xs" shape="circle" className="shrink-0" />
                            <div className="min-w-0">
                              <span
                                className="font-medium text-slate-800 text-xs block truncate max-w-[140px] xl:max-w-[180px]"
                                title={ord.customer_name || 'Direct Order'}
                              >
                                {ord.customer_name || 'Direct Order'}
                              </span>
                              {ord.customer_code && (
                                <span className="text-[10px] font-mono text-slate-400 block truncate">
                                  {ord.customer_code}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {totalQty.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">pcs</span>
                        </td>





                        <td className="px-3 py-2.5 min-w-[130px]">
                          <div className="w-full space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                              <span>{pct}%</span>
                              <span>{fmt(completedQty)}/{fmt(totalQty)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? 'bg-emerald-500' : 'bg-brand-600'
                                  }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{ord.target_delivery_date || '—'}</span>
                          </div>
                        </td>

                        <td className="px-2 py-2.5 text-center whitespace-nowrap">
                          <StatusBadge status={ord.priority} />
                        </td>

                        <td className="px-2 py-2.5 text-center whitespace-nowrap">
                          <StatusBadge status={getProductionOrderStage(ord)} />
                        </td>

                        <td className="px-3 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="xs"
                            variant="secondary"
                            icon={<Eye className="w-3.5 h-3.5 text-brand-600" />}
                            onClick={() => navigate(`/production/orders/${ord.id}`, { state: { from: location.pathname + location.search } })}
                            className="text-[11px] font-semibold text-slate-700 hover:text-brand-700 shadow-2xs px-2.5 py-1"
                          >
                            <span>Manage</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with record count */}
          {!loading && filteredOrders.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing <strong>{filteredOrders.length}</strong> of {orders.length} total orders
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
