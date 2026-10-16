// src/pages/production/ProductionOrders.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder } from '../../types';
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

export default function ProductionOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const load = async () => {
    setLoading(true);
    try {
      const ordData = await api.getProductionOrders();
      setOrders((ordData as ProductionOrder[]) || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
      // Priority filter
      if (priorityFilter !== 'ALL' && ord.priority?.toUpperCase() !== priorityFilter.toUpperCase()) {
        return false;
      }
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const numMatch = ord.order_number?.toLowerCase().includes(q);
        const titleMatch = ord.title?.toLowerCase().includes(q);
        const custMatch = ord.customer_name?.toLowerCase().includes(q);
        const catMatch = (ord.category_name || '').toLowerCase().includes(q);
        const stageMatch = stage.toLowerCase().includes(q);
        return numMatch || titleMatch || custMatch || catMatch || stageMatch;
      }
      return true;
    });
  }, [orders, statusFilter, priorityFilter, search]);

  // Counts for filter pills
  const statusCounts = useMemo(() => {
    return {
      all: orders.length,
      inProduction: orders.filter((o) => getProductionOrderStage(o) !== 'Completed' && o.status?.toUpperCase() !== 'COMPLETED').length,
      completed: orders.filter((o) => getProductionOrderStage(o) === 'Completed' || o.status?.toUpperCase() === 'COMPLETED').length,
    };
  }, [orders]);

  return (
    <div className="min-h-full pb-12 bg-[#f8fafc]">
      <PageHeader
        title="Production Orders"
        subtitle="Manage and track manufacturing batches across production workflow stages"
        breadcrumb={[{ label: 'Production' }, { label: 'Orders' }]}
        actions={
          <div className="flex items-center gap-1.5">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center justify-center p-2 sm:px-3 sm:py-1.5 text-xs font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
              title="Refresh Orders"
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

      {/* Search & Filter Bar */}
      <div className="px-3 sm:px-4 md:px-6 pt-3 pb-2 space-y-2.5 w-full">
        {/* Search box */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by order #, title, buyer, category..."
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

        {/* Status Filter Chips & Priority Dropdown */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto touch-scroll scrollbar-none pb-1">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 text-xs rounded-full font-medium whitespace-nowrap transition-all border ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-semibold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All ({statusCounts.all})
            </button>
            <button
              onClick={() => setStatusFilter('In Production')}
              className={`px-3 py-1.5 text-xs rounded-full font-medium whitespace-nowrap transition-all border ${
                statusFilter === 'In Production'
                  ? 'bg-brand-600 text-white border-brand-600 shadow-2xs font-semibold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              In Production ({statusCounts.inProduction})
            </button>
            <button
              onClick={() => setStatusFilter('Completed')}
              className={`px-3 py-1.5 text-xs rounded-full font-medium whitespace-nowrap transition-all border ${
                statusFilter === 'Completed'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Completed ({statusCounts.completed})
            </button>
          </div>

          {/* Priority selector chip */}
          <div className="relative shrink-0 ml-auto">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="py-1.5 pl-3 pr-7 text-xs border border-slate-200 rounded-full bg-white font-medium text-slate-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-brand-500 appearance-none cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                  <th className="px-2 py-2.5 whitespace-nowrap">Category</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Total Qty</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Completed</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Pending</th>
                  <th className="px-2.5 py-2.5 whitespace-nowrap">Target Delivery</th>
                  <th className="px-2 py-2.5 text-center whitespace-nowrap">Priority</th>
                  <th className="px-2 py-2.5 text-center whitespace-nowrap">Production Stage</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin text-brand-600 mx-auto mb-2" />
                      <span>Loading production orders...</span>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      No production orders found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord, idx) => {
                    const totalQty = ord.total_quantity || 0;
                    const completedQty = ord.completed_quantity || 0;
                    const pendingQty = Math.max(0, totalQty - completedQty);

                    return (
                      <tr
                        key={ord.id}
                        onClick={() => navigate(`/production/orders/${ord.id}`)}
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

                        <td className="px-2 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[130px]">
                            <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{ord.category_name || 'General'}</span>
                          </span>
                        </td>

                        <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {totalQty.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">pcs</span>
                        </td>

                        <td className="px-2 py-2.5 text-right font-mono text-emerald-600 font-semibold whitespace-nowrap">
                          {completedQty.toLocaleString()}
                        </td>

                        <td className="px-2 py-2.5 text-right font-mono text-amber-600 font-semibold whitespace-nowrap">
                          {pendingQty.toLocaleString()}
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
                            onClick={() => navigate(`/production/orders/${ord.id}`)}
                            className="text-[11px] font-semibold text-slate-700 hover:text-brand-700 shadow-2xs px-2.5 py-1"
                          >
                            <span>View Details</span>
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
