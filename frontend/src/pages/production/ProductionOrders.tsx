// src/pages/production/ProductionOrders.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, ProductionOrderItem } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import {
  Plus,
  Eye,
  ArrowRight,
  RefreshCw,
  Calendar,
  User,
  ShieldCheck,
  Package,
  Layers,
  Search,
  CheckCircle2,
  Clock,
  Filter,
  X,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function ProductionOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [expandedOrders, setExpandedOrders] = useState<Record<number, boolean>>({});

  const toggleExpand = (id: number) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Move stage modal state
  const [moveOpen, setMoveOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ProductionOrderItem | null>(null);
  const [moveForm, setMoveForm] = useState({ to_stage_id: '', quantity_moved: 0, remarks: '' });

  // QC modal state
  const [qcOpen, setQcOpen] = useState(false);
  const [qcForm, setQcForm] = useState({
    input_quantity: 0,
    passed_quantity: 0,
    rejected_quantity: 0,
    rework_quantity: 0,
    defect_reason: '',
    remarks: '',
    rework_stage_id: '7',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [ordData, stgData] = await Promise.all([
        api.getProductionOrders(),
        api.getProductionStages(),
      ]);
      setOrders(ordData as ProductionOrder[]);
      setStages(stgData as ProductionStage[]);
    } catch {
      setOrders([]);
      setStages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleMove = async () => {
    if (!selectedItem || !moveForm.to_stage_id || !moveForm.quantity_moved) {
      setError('Destination stage and positive quantity are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.moveStage({
        order_item_id: selectedItem.id,
        to_stage_id: parseInt(moveForm.to_stage_id),
        quantity_moved: moveForm.quantity_moved,
        remarks: moveForm.remarks,
      });
      setMoveOpen(false);
      load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to move stage');
    } finally {
      setSaving(false);
    }
  };

  const handleQC = async () => {
    if (!selectedItem) return;
    setSaving(true);
    setError('');
    try {
      await api.recordQC({
        order_item_id: selectedItem.id,
        stage_id: selectedItem.current_stage_id,
        ...qcForm,
        rework_stage_id: parseInt(qcForm.rework_stage_id),
      });
      setQcOpen(false);
      load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to record QC inspection');
    } finally {
      setSaving(false);
    }
  };

  const priorityBorder: Record<string, string> = {
    Low: 'border-l-slate-300',
    Medium: 'border-l-blue-500',
    High: 'border-l-amber-500',
    Urgent: 'border-l-rose-500',
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Status filter
      if (statusFilter !== 'ALL' && ord.status?.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
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
        const itemMatch = (ord.items || []).some(
          (it) =>
            it.product_name?.toLowerCase().includes(q) ||
            it.product_code?.toLowerCase().includes(q) ||
            it.color?.toLowerCase().includes(q) ||
            it.color_pantone_code?.toLowerCase().includes(q)
        );
        return numMatch || titleMatch || custMatch || itemMatch;
      }
      return true;
    });
  }, [orders, statusFilter, priorityFilter, search]);

  // Counts for filter pills
  const statusCounts = useMemo(() => {
    return {
      all: orders.length,
      inProduction: orders.filter((o) => o.status === 'In Production' || o.status === 'IN PRODUCTION').length,
      completed: orders.filter((o) => o.status === 'Completed' || o.status === 'COMPLETED').length,
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

      {/* Modern Mobile-Optimized Search & Filter Bar */}
      <div className="px-3 sm:px-4 md:px-6 pt-3 pb-1 space-y-2.5">
        {/* Search box */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by order #, title, buyer, product..."
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

      {/* Production Orders List */}
      <div className="px-3 sm:px-4 md:px-6 py-2.5 space-y-3">
        {/* Mobile order counter & expand/collapse toggle */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong className="text-slate-800">{filteredOrders.length}</strong> orders
          </span>
          <button
            type="button"
            onClick={() => {
              const allExpanded = filteredOrders.length > 0 && filteredOrders.every((o) => expandedOrders[o.id]);
              const next: Record<number, boolean> = {};
              filteredOrders.forEach((o) => {
                next[o.id] = !allExpanded;
              });
              setExpandedOrders(next);
            }}
            className="text-brand-600 hover:text-brand-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
          >
            {filteredOrders.length > 0 && filteredOrders.every((o) => expandedOrders[o.id])
              ? 'Collapse All'
              : 'Expand All'}
          </button>
        </div>

        {filteredOrders.map((ord) => {
          const totalQty = ord.total_quantity || 0;
          const completedQty = ord.completed_quantity || 0;
          const pendingQty = Math.max(0, totalQty - completedQty);
          const pct = totalQty > 0 ? Math.min(100, Math.round((completedQty / totalQty) * 100)) : 0;
          const items = ord.items || [];
          const isExpanded = !!expandedOrders[ord.id];

          return (
            <div
              key={ord.id}
              className="w-full bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 border-0"
            >
              {/* TOP / COMPACT HEADER: Clickable card header to open/expand */}
              <div
                onClick={() => toggleExpand(ord.id)}
                className="p-3.5 sm:p-4 bg-white cursor-pointer select-none transition-colors hover:bg-slate-50/50 flex flex-col gap-2"
              >
                {/* Badges & Action Line */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="text-xs font-bold font-mono text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md shrink-0 border-0">
                      {ord.order_number}
                    </span>
                    <StatusBadge status={ord.priority} />
                    <StatusBadge status={ord.status} />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="secondary"
                      size="xs"
                      icon={<Eye className="w-3.5 h-3.5" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/production/orders/${ord.id}`);
                      }}
                      className="font-medium border-0 bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-none"
                    >
                      <span className="hidden sm:inline">View Details</span>
                      <span className="sm:hidden">View</span>
                    </Button>

                    {/* Chevron toggle button */}
                    <div
                      className={`w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 transition-transform duration-200 sm:hidden border-0 ${
                        isExpanded ? 'rotate-180 bg-brand-50 text-brand-600' : ''
                      }`}
                      title={isExpanded ? 'Collapse card' : 'Expand card'}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Title Line */}
                <h3
                  className="text-sm font-bold text-slate-800 leading-snug hover:text-brand-600 transition-colors"
                  title={ord.title}
                >
                  {ord.title}
                </h3>

                {/* Compact Info Row: Visible when collapsed so multiple cards are readable at a glance */}
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 flex-wrap pt-0.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <BuyerAvatar buyer={ord} size="xs" shape="circle" />
                      <span className="truncate max-w-[140px]">{ord.customer_name || 'Direct Order'}</span>
                    </span>
                    <span className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {ord.target_delivery_date || '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                      {totalQty.toLocaleString()} pcs
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        pct === 100
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-brand-50 text-brand-700'
                      }`}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Mobile tap indicator hint when collapsed */}
                {!isExpanded && (
                  <div className="sm:hidden pt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {items.length} product {items.length === 1 ? 'line' : 'lines'} assigned
                    </span>
                    <span className="text-brand-600 font-semibold flex items-center gap-0.5">
                      Tap to open <ChevronDown className="w-3 h-3" />
                    </span>
                  </div>
                )}
              </div>

              {/* ============================================================== */}
              {/* MOBILE EXPANDED VIEW (< sm): Clean, Borderless & Spacious */}
              {/* ============================================================== */}
              {isExpanded && (
                <div className="sm:hidden px-3.5 pb-3.5 pt-1 space-y-3 bg-white">
                  {/* 3-Column Quantities Grid - Soft borderless pastel backgrounds */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total</span>
                      <span className="text-sm font-bold font-mono text-slate-900 block mt-0.5">
                        {totalQty.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-slate-400">pcs</span>
                    </div>
                    <div className="bg-emerald-50/70 p-2.5 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">Done</span>
                      <span className="text-sm font-bold font-mono text-emerald-800 block mt-0.5">
                        {completedQty.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-emerald-600">pcs</span>
                    </div>
                    <div className="bg-amber-50/70 p-2.5 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">Pending</span>
                      <span className="text-sm font-bold font-mono text-amber-800 block mt-0.5">
                        {pendingQty.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-amber-600">pcs</span>
                    </div>
                  </div>

                  {/* Batch Progress Bar - Soft borderless bar */}
                  <div className="space-y-1.5 bg-slate-50/50 p-2.5 rounded-xl">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-brand-600" />
                        <span>Batch Progress</span>
                      </span>
                      <span className="font-mono font-bold text-brand-700">{pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-200/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct === 100 ? 'bg-emerald-500' : 'bg-brand-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Assigned Product Lines Header */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-2 px-0.5">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-brand-600" />
                        Product Variants ({items.length})
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Stage tracking</span>
                    </div>

                    <div className="space-y-2.5">
                      {items.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl">
                          No product lines assigned
                        </div>
                      ) : (
                        items.map((item, idx) => {
                          const itTotal = item.total_quantity || 0;
                          const itDone = item.completed_quantity || 0;
                          const itPending = Math.max(0, itTotal - itDone);
                          const itPct = itTotal > 0 ? Math.min(100, Math.round((itDone / itTotal) * 100)) : 0;
                          const pantone = item.color_pantone_code;

                          return (
                            <div
                              key={item.id}
                              className="p-3 bg-slate-50/80 rounded-xl flex flex-col gap-2.5"
                            >
                              {/* Product Title & Code & Size */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-800 leading-snug">
                                    #{idx + 1} {item.product_name || 'Garment Item'}
                                  </p>
                                  {item.product_code && (
                                    <span className="inline-block text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.2 rounded mt-0.5 shadow-2xs">
                                      {item.product_code}
                                    </span>
                                  )}
                                </div>
                                {item.size ? (
                                  <span className="px-2 py-0.5 bg-blue-50 text-brand-700 rounded text-[11px] font-mono font-bold shrink-0">
                                    Size {item.size}
                                  </span>
                                ) : null}
                              </div>

                              {/* Color & Variant Info - Borderless soft chips */}
                              <div className="flex items-center gap-2 flex-wrap text-xs">
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg shadow-2xs">
                                  {item.color_hex_code && (
                                    <span
                                      className="w-3 h-3 rounded-full shrink-0 border border-slate-200"
                                      style={{ backgroundColor: item.color_hex_code }}
                                    />
                                  )}
                                  <span className="font-medium text-slate-700">{item.color}</span>
                                </div>
                                {pantone && (
                                  <span className="px-2 py-1 bg-amber-100/70 text-amber-900 rounded-lg text-[10px] font-mono font-bold">
                                    Pantone {pantone}
                                  </span>
                                )}
                              </div>

                              {/* Stage & Quantity Status */}
                              <div className="flex items-center justify-between text-xs pt-1">
                                <div>
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Stage</span>
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap mt-0.5"
                                    style={{ backgroundColor: item.color_badge || '#0284c7' }}
                                  >
                                    {item.current_stage_name || 'Stage'} ({item.current_stage_quantity})
                                  </span>
                                </div>

                                <div className="text-right">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Qty</span>
                                  <span className="font-mono font-bold text-slate-800">
                                    {itTotal.toLocaleString()} pcs
                                  </span>
                                </div>
                              </div>

                              {/* Line Progress bar */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                  <span>Progress: {itPct}%</span>
                                  <span>{itDone} done • {itPending} pend</span>
                                </div>
                                <div className="h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      itPct === 100 ? 'bg-emerald-500' : 'bg-brand-600'
                                    }`}
                                    style={{ width: `${itPct}%` }}
                                  />
                                </div>
                              </div>

                              {/* Action Buttons: Move Stage / QC */}
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem(item);
                                    setMoveForm({
                                      to_stage_id: '',
                                      quantity_moved: item.current_stage_quantity || 1,
                                      remarks: '',
                                    });
                                    setError('');
                                    setMoveOpen(true);
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold bg-white hover:bg-slate-50 text-brand-700 rounded-lg shadow-2xs transition-colors"
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                  <span>Move Stage</span>
                                </button>

                                {item.current_stage_name === 'QC' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedItem(item);
                                      const q = item.current_stage_quantity || 0;
                                      setQcForm({
                                        input_quantity: q,
                                        passed_quantity: q,
                                        rejected_quantity: 0,
                                        rework_quantity: 0,
                                        defect_reason: '',
                                        remarks: '',
                                        rework_stage_id: '5',
                                      });
                                      setError('');
                                      setQcOpen(true);
                                    }}
                                    className="flex items-center justify-center gap-1 py-1.5 px-3 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-2xs transition-colors"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>QC</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Collapse pill button at the bottom */}
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => toggleExpand(ord.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 bg-slate-50 px-3 py-1 rounded-full cursor-pointer transition-colors"
                    >
                      <span>Collapse card</span>
                      <ChevronUp className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* DESKTOP VIEW (sm+): Dense Multi-Column Enterprise Grid Layout  */}
              {/* ============================================================== */}
              <div className="hidden sm:block">
                {/* MIDDLE ROW: Order Executive Summary & Overall Progress */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-b border-slate-100 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 min-w-0">
                    {/* 1. Buyer / Customer */}
                    <div className="flex items-center gap-2">
                      <BuyerAvatar buyer={ord} size="sm" shape="circle" className="shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Buyer / Customer
                        </span>
                        <strong className="text-slate-800 truncate block" title={ord.customer_name || 'Direct Order'}>
                          {ord.customer_name || 'Direct Order'}
                        </strong>
                      </div>
                    </div>

                    {/* 2. Total Quantity */}
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                        <Package className="w-3.5 h-3.5 text-slate-600" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Total Quantity
                        </span>
                        <strong className="font-mono text-slate-900 font-bold">
                          {totalQty.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">pcs</span>
                        </strong>
                      </div>
                    </div>

                    {/* 3. Completed Quantity */}
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Completed
                        </span>
                        <strong className="font-mono text-emerald-600 font-bold">
                          {completedQty.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">pcs</span>
                        </strong>
                      </div>
                    </div>

                    {/* 4. Pending Quantity */}
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Pending
                        </span>
                        <strong className="font-mono text-amber-600 font-bold">
                          {pendingQty.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">pcs</span>
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Overall Batch Progress */}
                  <div className="flex items-center gap-3 min-w-[160px] max-w-xs shrink-0 pl-3 border-l border-slate-200">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[11px] mb-1 font-semibold text-slate-600">
                        <span className="uppercase text-[10px] font-bold text-slate-400 tracking-wider flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-brand-600" /> Batch Progress
                        </span>
                        <span className="font-mono font-bold text-brand-700">{pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            pct === 100 ? 'bg-emerald-500' : 'bg-brand-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTTOM ROW: Product Information & Production Progress */}
                <div className="bg-white">
                  <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-brand-600" />
                      Assigned Product Lines ({items.length})
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      Detailed item variant & stage execution
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <div className="px-4 py-4 text-xs text-slate-400 italic bg-white text-center">
                        No product lines assigned to this production order.
                      </div>
                    ) : (
                      items.map((item, idx) => {
                        const itTotal = item.total_quantity || 0;
                        const itDone = item.completed_quantity || 0;
                        const itPending = Math.max(0, itTotal - itDone);
                        const itPct = itTotal > 0 ? Math.min(100, Math.round((itDone / itTotal) * 100)) : 0;
                        const pantone = item.color_pantone_code;

                        return (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/70 transition-colors"
                          >
                            {/* Product Line Information Grid */}
                            <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 items-center">
                              {/* 1. Product Name & Code */}
                              <div className="min-w-0">
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                                  #{idx + 1} Product
                                </span>
                                <p
                                  className="text-xs font-bold text-slate-800 truncate"
                                  title={item.product_name}
                                >
                                  {item.product_name || 'Standard Product'}
                                </p>
                                {item.product_code && (
                                  <span className="inline-block text-[10px] font-mono text-slate-500 bg-slate-100 px-1 py-0.2 rounded mt-0.5">
                                    {item.product_code}
                                  </span>
                                )}
                              </div>

                              {/* 2. Color Variant & Pantone Code */}
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                                  Variant / Color
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.color_hex_code && (
                                    <span
                                      className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                                      style={{ backgroundColor: item.color_hex_code }}
                                    />
                                  )}
                                  <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-medium text-slate-700">
                                    {item.color}
                                  </span>
                                  {pantone && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-300/70 rounded text-[10px] font-mono font-bold tracking-tight shadow-2xs">
                                      {pantone}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 3. Size & Product Quantities */}
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                                  {item.size ? 'Size & Quantities' : 'Quantities'}
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {item.size ? (
                                    <span className="px-1.5 py-0.5 bg-blue-50 text-brand-700 border border-brand-200 rounded text-[11px] font-mono font-bold">
                                      {item.size}
                                    </span>
                                  ) : null}
                                  <span className="text-xs font-mono font-bold text-slate-800">
                                    {itTotal.toLocaleString()} pcs
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500 block">
                                    (<strong className="text-emerald-600">{itDone}</strong> done •{' '}
                                    <strong className="text-amber-600">{itPending}</strong> pend)
                                  </span>
                                </div>
                              </div>

                              {/* 4. Current Stage */}
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                                  Current Stage
                                </span>
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold text-white whitespace-nowrap shadow-2xs"
                                  style={{ backgroundColor: item.color_badge || '#0284c7' }}
                                >
                                  {item.current_stage_name || 'Installation'}
                                  <span className="ml-1 opacity-90 text-[10px]">
                                    ({item.current_stage_quantity})
                                  </span>
                                </span>
                              </div>

                              {/* 5. Progress Bar & % */}
                              <div className="col-span-2 lg:col-span-1">
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                                  Line Progress
                                </span>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        itPct === 100 ? 'bg-emerald-500' : 'bg-brand-600'
                                      }`}
                                      style={{ width: `${itPct}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-mono font-bold text-slate-700 w-8 text-right">
                                    {itPct}%
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Line Item Stage Actions */}
                            <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0">
                              <button
                                onClick={() => {
                                  setSelectedItem(item);
                                  setMoveForm({
                                    to_stage_id: '',
                                    quantity_moved: item.current_stage_quantity || 1,
                                    remarks: '',
                                  });
                                  setError('');
                                  setMoveOpen(true);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 transition-colors shadow-2xs"
                                title="Move to next stage"
                              >
                                <ArrowRight className="w-3 h-3" />
                                <span>Move Stage</span>
                              </button>

                              {item.current_stage_name === 'QC' && (
                                <button
                                  onClick={() => {
                                    setSelectedItem(item);
                                    const q = item.current_stage_quantity || 0;
                                    setQcForm({
                                      input_quantity: q,
                                      passed_quantity: q,
                                      rejected_quantity: 0,
                                      rework_quantity: 0,
                                      defect_reason: '',
                                      remarks: '',
                                      rework_stage_id: '5',
                                    });
                                    setError('');
                                    setQcOpen(true);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 rounded border border-amber-200 transition-colors shadow-2xs"
                                  title="Perform QC inspection"
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>QC Inspect</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredOrders.length === 0 && !loading && (
          <div className="text-center py-20 bg-white rounded-2xl text-slate-400 text-sm shadow-xs border-0">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-600">No production orders match the filter.</p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="mt-2 text-xs text-brand-600 hover:underline"
              >
                Clear search query
              </button>
            )}
          </div>
        )}
      </div>

      {/* Move Stage Modal */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title="Move to Next Stage"
        size="sm"
        subtitle={
          selectedItem
            ? `${selectedItem.product_name} — ${selectedItem.color}${selectedItem.size ? ` / Size ${selectedItem.size}` : ''}`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleMove} icon={<ArrowRight className="w-3.5 h-3.5" />}>
              Move
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          {selectedItem && (
            <div className="p-2.5 bg-slate-50 border rounded-md text-xs text-slate-600">
              Current Stage:{' '}
              <span className="font-semibold" style={{ color: selectedItem.color_badge }}>
                {selectedItem.current_stage_name}
              </span>{' '}
              &nbsp;|&nbsp; Available Qty: <span className="font-semibold">{selectedItem.current_stage_quantity}</span>
            </div>
          )}
          <FormField
            as="select"
            label="Move To Stage"
            required
            value={moveForm.to_stage_id}
            onChange={(e) => setMoveForm((f) => ({ ...f, to_stage_id: e.target.value }))}
          >
            <option value="">— Select Stage —</option>
            {stages
              .filter((s) => s.id !== selectedItem?.current_stage_id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sequence_order}. {s.name}
                </option>
              ))}
          </FormField>

          <FormField
            label="Quantity to Move"
            type="number"
            required
            value={moveForm.quantity_moved}
            onChange={(e) => setMoveForm((f) => ({ ...f, quantity_moved: parseInt(e.target.value) || 0 }))}
            min="1"
            max={selectedItem?.current_stage_quantity}
            hint={`Max: ${selectedItem?.current_stage_quantity} pieces`}
          />

          <FormField
            label="Remarks"
            value={moveForm.remarks}
            onChange={(e) => setMoveForm((f) => ({ ...f, remarks: e.target.value }))}
            placeholder="Optional movement notes"
          />
        </div>
      </Modal>

      {/* QC Modal */}
      <Modal
        open={qcOpen}
        onClose={() => setQcOpen(false)}
        title="QC Inspection Record"
        size="md"
        subtitle={
          selectedItem
            ? `${selectedItem.product_name} — ${selectedItem.color}${selectedItem.size ? ` / Size ${selectedItem.size}` : ''}`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setQcOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleQC}>
              Save QC Record
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Input Quantity"
              type="number"
              required
              value={qcForm.input_quantity}
              onChange={(e) => setQcForm((f) => ({ ...f, input_quantity: parseInt(e.target.value) || 0 }))}
              min="0"
            />
            <FormField
              label="Passed Quantity"
              type="number"
              required
              value={qcForm.passed_quantity}
              onChange={(e) => setQcForm((f) => ({ ...f, passed_quantity: parseInt(e.target.value) || 0 }))}
              min="0"
            />
            <FormField
              label="Rejected Quantity"
              type="number"
              value={qcForm.rejected_quantity}
              onChange={(e) => setQcForm((f) => ({ ...f, rejected_quantity: parseInt(e.target.value) || 0 }))}
              min="0"
            />
            <FormField
              label="Rework Quantity"
              type="number"
              value={qcForm.rework_quantity}
              onChange={(e) => setQcForm((f) => ({ ...f, rework_quantity: parseInt(e.target.value) || 0 }))}
              min="0"
            />
          </div>

          <div className="p-2.5 bg-slate-50 border rounded-md text-xs">
            Pending ={' '}
            {Math.max(
              0,
              qcForm.input_quantity - qcForm.passed_quantity - qcForm.rejected_quantity - qcForm.rework_quantity
            )}{' '}
            pieces
          </div>

          {qcForm.rework_quantity > 0 && (
            <FormField
              as="select"
              label="Route Rework to Stage"
              value={qcForm.rework_stage_id}
              onChange={(e) => setQcForm((f) => ({ ...f, rework_stage_id: e.target.value }))}
            >
              {stages
                .filter((s) => !s.is_final_stage && !s.is_qc_stage)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </FormField>
          )}

          <FormField
            label="Defect Reason"
            value={qcForm.defect_reason}
            onChange={(e) => setQcForm((f) => ({ ...f, defect_reason: e.target.value }))}
            placeholder="e.g. Stitch skip, color bleeding..."
          />

          <FormField
            as="textarea"
            label="QC Remarks"
            value={qcForm.remarks}
            onChange={(e) => setQcForm((f) => ({ ...f, remarks: e.target.value }))}
            rows={2}
          />
        </div>
      </Modal>
    </div>
  );
}
