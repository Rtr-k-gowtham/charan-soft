// src/pages/production/ProductionStageView.tsx
// Production Stage Workspace for the 10 Core Production Pipeline Stages
// Optimized Order-First and Product-Breakdown view for Requirement Gathering & Pipeline
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionOrderItem, ProductionStage } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import {
  RefreshCw,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Boxes,
  Plus,
  Search,
  Layers,
  ArrowRight,
  ExternalLink,
  Package,
  Calendar,
  Sparkles,
  Filter,
  CheckCheck
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n || 0);

interface Props {
  stageName: string;
  stageCode?: string;
  breadcrumb: string[];
}

const STAGE_ROUTE_MAP: Record<string, string> = {
  REQ: '/production/requirement',
  PO: '/production/po',
  INW: '/production/inward',
  DYE: '/production/dyeing',
  CUT: '/production/cutting',
  EMB: '/production/embroidery',
  STI: '/production/stitching',
  CHK: '/production/checking',
  PCK: '/production/packing',
  COMP: '/production/completed',
};

type StageItem = ProductionOrderItem & {
  order_id?: number;
  order_number: string;
  order_title: string;
  customer_id?: number;
  customer_name?: string;
  customer_code?: string;
  customer_avatar_style?: string;
  customer_avatar_seed?: string;
  customer_avatar_config?: any;
  stage_code?: string;
  priority?: string;
  target_delivery_date?: string;
};

interface OrderGroup {
  order_id: number;
  order_number: string;
  order_title: string;
  customer_id?: number;
  customer_name?: string;
  customer_code?: string;
  customer_avatar_style?: string;
  customer_avatar_seed?: string;
  customer_avatar_config?: any;
  priority?: string;
  target_delivery_date?: string;
  status?: string;
  items: StageItem[];
  total_stage_quantity: number;
  total_order_quantity: number;
  unique_products_count: number;
}

export default function ProductionStageView({ stageName, stageCode, breadcrumb }: Props) {
  const navigate = useNavigate();
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [allItems, setAllItems] = useState<StageItem[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode: 'orders' shows order cards with expandable products; 'items' shows flat item rows
  const activeCode = (stageCode || 'REQ').toUpperCase();
  const [viewMode, setViewMode] = useState<'orders' | 'items'>(activeCode === 'REQ' ? 'orders' : 'orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Modals
  const [moveOpen, setMoveOpen] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);
  const [orderModalGroup, setOrderModalGroup] = useState<OrderGroup | null>(null);

  const [selectedItem, setSelectedItem] = useState<StageItem | null>(null);
  const [selectedOrderForBatch, setSelectedOrderForBatch] = useState<OrderGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Forms
  const [moveForm, setMoveForm] = useState({ next_stage_id: '', quantity: '', notes: '' });
  const [batchMoveForm, setBatchMoveForm] = useState({ next_stage_id: '', notes: '' });
  const [qcForm, setQcForm] = useState({ passed: '', rejected: '', rework: '', defect_reason: '', remarks: '', rework_stage_id: '7' });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getProductionStages().catch(() => []),
      api.getProductionOrders().catch(() => []),
    ])
      .then(([stgList, ordList]) => {
        setStages((stgList || []) as ProductionStage[]);
        const flat: StageItem[] = [];
        ((ordList || []) as ProductionOrder[]).forEach(ord => {
          (ord.items || []).forEach(it => {
            flat.push({
              ...it,
              order_id: ord.id,
              order_number: ord.order_number,
              order_title: ord.title,
              customer_id: ord.customer_id,
              customer_name: ord.customer_name,
              customer_code: ord.customer_code,
              customer_avatar_style: ord.customer_avatar_style,
              customer_avatar_seed: ord.customer_avatar_seed,
              customer_avatar_config: ord.customer_avatar_config,
              priority: ord.priority,
              target_delivery_date: ord.target_delivery_date,
              stage_code: (it as { stage_code?: string }).stage_code || '',
            });
          });
        });
        setAllItems(flat);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // Default to 'orders' view for requirement gathering
    if (activeCode === 'REQ') {
      setViewMode('orders');
    }
  }, [stageName, stageCode, activeCode]);

  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  const isQC = activeCode === 'CHK';
  const isCompleted = activeCode === 'COMP';

  // Filter items that belong to this stage
  const items = useMemo(() => {
    return allItems.filter(i => {
      const iCode = (i.stage_code || '').toUpperCase();
      const iName = (i.current_stage_name || '').toLowerCase();
      const sCode = activeCode;
      const sName = stageName.toLowerCase();

      if (iCode === sCode) return true;
      if (iName === sName) return true;

      // Alias mapping
      if (sCode === 'REQ' && (iName.includes('requirement') || iCode === 'INST')) return true;
      if (sCode === 'PO' && (iName.includes('purchase order') || iCode === 'PO')) return true;
      if (sCode === 'INW' && (iName.includes('inward') || iCode === 'DET')) return true;
      if (sCode === 'DYE' && (iName.includes('dye') || iCode === 'DYE')) return true;
      if (sCode === 'CUT' && (iName.includes('cut') || iCode === 'CUT')) return true;
      if (sCode === 'EMB' && (iName.includes('embroid') || iCode === 'EMB')) return true;
      if (sCode === 'STI' && (iName.includes('stitch') || iCode === 'STI')) return true;
      if (sCode === 'CHK' && (iName.includes('check') || iName === 'qc' || iCode === 'QC')) return true;
      if (sCode === 'PCK' && (iName.includes('pack') || iCode === 'PCK')) return true;
      if (sCode === 'COMP' && (iName.includes('complete') || iCode === 'COMP')) return true;

      return false;
    });
  }, [allItems, activeCode, stageName]);

  // Group items by Order for the Order-Centric view
  const orderGroups = useMemo(() => {
    const map = new Map<string, OrderGroup>();

    items.forEach(it => {
      const key = it.order_number || String(it.order_id || 'unknown');
      if (!map.has(key)) {
        map.set(key, {
          order_id: it.order_id || (it.production_order_id as number) || 0,
          order_number: it.order_number,
          order_title: it.order_title,
          customer_id: it.customer_id,
          customer_name: it.customer_name,
          customer_code: it.customer_code,
          customer_avatar_style: it.customer_avatar_style,
          customer_avatar_seed: it.customer_avatar_seed,
          customer_avatar_config: it.customer_avatar_config,
          priority: it.priority,
          target_delivery_date: it.target_delivery_date,
          status: it.status,
          items: [],
          total_stage_quantity: 0,
          total_order_quantity: 0,
          unique_products_count: 0,
        });
      }
      const group = map.get(key)!;
      group.items.push(it);
      group.total_stage_quantity += (it.current_stage_quantity || it.total_quantity || 0);
      group.total_order_quantity += (it.total_quantity || 0);
    });

    // Compute unique product names
    map.forEach(group => {
      const set = new Set(group.items.map(i => i.product_name || i.product_id));
      group.unique_products_count = set.size;
    });

    return Array.from(map.values());
  }, [items]);

  // Filtered order groups based on search & priority
  const filteredOrderGroups = useMemo(() => {
    return orderGroups.filter(g => {
      if (priorityFilter !== 'ALL' && g.priority?.toUpperCase() !== priorityFilter) {
        return false;
      }
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      const matchOrder = g.order_number.toLowerCase().includes(q) || g.order_title?.toLowerCase().includes(q);
      const matchBuyer = g.customer_name?.toLowerCase().includes(q) || g.customer_code?.toLowerCase().includes(q);
      const matchProduct = g.items.some(it =>
        it.product_name?.toLowerCase().includes(q) ||
        it.product_code?.toLowerCase().includes(q) ||
        it.color?.toLowerCase().includes(q)
      );
      return matchOrder || matchBuyer || matchProduct;
    });
  }, [orderGroups, searchTerm, priorityFilter]);

  const toggleExpandOrder = (orderNum: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderNum]: !prev[orderNum]
    }));
  };

  const expandAllOrders = () => {
    const next: Record<string, boolean> = {};
    filteredOrderGroups.forEach(g => { next[g.order_number] = true; });
    setExpandedOrders(next);
  };

  const collapseAllOrders = () => {
    setExpandedOrders({});
  };

  const currentStage = stages.find(s => s.code === activeCode || s.name === stageName);
  const nextStages = stages.filter(s => s.sequence_order > (currentStage?.sequence_order || 0));

  // Stage Move Handler for Single Product Item
  const handleMove = async () => {
    if (!moveForm.next_stage_id || !moveForm.quantity) {
      setError('Select destination stage and enter quantity');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.moveStage({
        order_item_id: selectedItem?.id || 0,
        to_stage_id: parseInt(moveForm.next_stage_id),
        quantity_moved: parseInt(moveForm.quantity),
        remarks: moveForm.notes || undefined,
      });
      setMoveOpen(false);
      setSuccessToast(`Moved ${moveForm.quantity} pcs of ${selectedItem?.product_name || 'item'} to next stage`);
      loadData();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to move item stage');
    } finally {
      setSaving(false);
    }
  };

  // Batch Move Handler for All Products of an Order
  const handleBatchMove = async () => {
    if (!batchMoveForm.next_stage_id || !selectedOrderForBatch) {
      setError('Select destination stage');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const destId = parseInt(batchMoveForm.next_stage_id);
      // Move each item in the order group
      await Promise.all(
        selectedOrderForBatch.items.map(it =>
          api.moveStage({
            order_item_id: it.id,
            to_stage_id: destId,
            quantity_moved: it.current_stage_quantity || it.total_quantity || 0,
            remarks: batchMoveForm.notes || `Batch advanced from ${stageName}`,
          })
        )
      );
      setBatchMoveOpen(false);
      setSuccessToast(`Successfully advanced all ${selectedOrderForBatch.items.length} products of order ${selectedOrderForBatch.order_number}`);
      loadData();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to batch advance order items');
    } finally {
      setSaving(false);
    }
  };

  // QC / Checking Handler
  const handleQC = async () => {
    const passed = Number(qcForm.passed || 0);
    const rejected = Number(qcForm.rejected || 0);
    const rework = Number(qcForm.rework || 0);
    const total = passed + rejected + rework;
    const avail = selectedItem?.current_stage_quantity || selectedItem?.total_quantity || 0;

    if (total <= 0) {
      setError('Enter at least 1 inspected piece');
      return;
    }
    if (total > avail) {
      setError(`Total inspected (${total}) exceeds available stage quantity (${avail})`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.recordQC({
        order_item_id: selectedItem?.id || 0,
        stage_id: currentStage?.id || 8,
        inspected_quantity: total,
        passed_quantity: passed,
        rejected_quantity: rejected,
        rework_quantity: rework,
        defect_reason: qcForm.defect_reason || undefined,
        remarks: qcForm.remarks || undefined,
        rework_stage_id: rework > 0 ? Number(qcForm.rework_stage_id) : undefined,
      });

      // Automatically advance passed pieces to next stage (Packing / 9)
      if (passed > 0) {
        const packingStage = stages.find(s => s.code === 'PCK' || s.sequence_order === 9);
        const nextId = packingStage ? packingStage.id : 9;
        await api.moveStage({
          order_item_id: selectedItem?.id || 0,
          to_stage_id: nextId,
          quantity_moved: passed,
          remarks: 'QC Passed - Auto advanced to Packing',
        });
      }

      setQcOpen(false);
      setSuccessToast(`QC recorded: ${passed} passed, ${rework} rework, ${rejected} rejected`);
      loadData();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to record QC inspection');
    } finally {
      setSaving(false);
    }
  };

  const openMoveModal = (item: StageItem) => {
    setSelectedItem(item);
    setError('');
    const defaultNext = nextStages[0]?.id ? String(nextStages[0].id) : '';
    setMoveForm({
      next_stage_id: defaultNext,
      quantity: String(item.current_stage_quantity || item.total_quantity || 0),
      notes: '',
    });
    setMoveOpen(true);
  };

  const openBatchMoveModal = (group: OrderGroup) => {
    setSelectedOrderForBatch(group);
    setError('');
    const defaultNext = nextStages[0]?.id ? String(nextStages[0].id) : '';
    setBatchMoveForm({
      next_stage_id: defaultNext,
      notes: `Requirement completed for Order ${group.order_number}`,
    });
    setBatchMoveOpen(true);
  };

  // Flat table columns
  const flatColumns = [
    {
      key: 'order_number',
      label: 'Order #',
      sortable: true,
      render: (r: StageItem) => (
        <div>
          <span className="font-mono font-bold text-brand-700 text-xs block">{r.order_number}</span>
          <span className="text-[11px] text-slate-500 truncate max-w-[130px] block">{r.order_title}</span>
        </div>
      ),
    },
    {
      key: 'customer_name',
      label: 'Buyer',
      render: (r: StageItem) => (
        <div className="flex items-center gap-2 min-w-0">
          <BuyerAvatar
            buyer={{
              id: r.customer_id,
              code: r.customer_code,
              name: r.customer_name,
              avatar_style: r.customer_avatar_style,
              avatar_seed: r.customer_avatar_seed,
              avatar_config: r.customer_avatar_config,
            }}
            size="sm"
            shape="circle"
          />
          <div className="min-w-0">
            <span className="font-semibold text-slate-800 text-xs truncate block">{r.customer_name || 'Direct Buyer'}</span>
            {r.customer_code && (
              <span className="font-mono text-[10px] text-slate-400 block">{r.customer_code}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'product_name',
      label: 'Product',
      sortable: true,
      render: (r: StageItem) => (
        <div>
          <span className="font-medium text-slate-800">{r.product_name || 'Garment Item'}</span>
          {r.product_code && <span className="text-[10px] text-slate-400 block font-mono">{r.product_code}</span>}
        </div>
      ),
    },
    {
      key: 'color',
      label: 'Color',
      render: (r: StageItem) => (
        <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium text-slate-700 border border-slate-200">
          {r.color}
        </span>
      ),
    },
    {
      key: 'size',
      label: 'Size',
      render: (r: StageItem) => r.size ? (
        <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-mono font-bold text-slate-700">
          {r.size}
        </span>
      ) : (
        <span className="text-slate-400 font-mono text-xs">—</span>
      ),
    },
    {
      key: 'total_quantity',
      label: 'Order Qty',
      render: (r: StageItem) => <span className="font-mono font-semibold text-slate-700">{fmt(r.total_quantity)}</span>,
    },
    {
      key: 'current_stage_quantity',
      label: 'At This Stage',
      render: (r: StageItem) => (
        <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
          {fmt(r.current_stage_quantity || r.total_quantity)} pcs
        </span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (r: StageItem) => <StatusBadge status={r.priority || 'Medium'} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: StageItem) => <StatusBadge status={r.status || 'In Progress'} />,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          {successToast}
        </div>
      )}

      <PageHeader
        title={stageName}
        subtitle={
          activeCode === 'REQ'
            ? 'Requirement Gathering: View orders and expand to review & advance individual products'
            : `Production orders currently at ${stageName} stage`
        }
        breadcrumb={[{ label: 'Production' }, ...breadcrumb.map(b => ({ label: b }))]}
        actions={
          <div className="flex gap-2 items-center">
            {activeCode === 'REQ' && (
              <Button
                icon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
                onClick={() => navigate('/production/orders/create')}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs"
              >
                <span>New Production Order</span>
              </Button>
            )}
            {activeCode === 'PO' && (
              <Button
                icon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
                onClick={() => navigate('/purchase/orders?create=true')}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs"
              >
                <span>Create PO</span>
              </Button>
            )}
            <button
              onClick={() => navigate('/production/board')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs"
            >
              <Boxes className="w-3.5 h-3.5 text-brand-600" />
              <span className="hidden sm:inline">Kanban Board</span>
            </button>
            <button
              onClick={loadData}
              title="Refresh Stage Data"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {/* 10-Stage Pipeline Stepper */}
      <div className="px-3 sm:px-4 pt-2 pb-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll scrollbar-none pb-1">
          {stages.map((s, idx) => {
            const isCurrent = s.code === activeCode || s.name === stageName;
            const targetRoute = STAGE_ROUTE_MAP[s.code] || `/production/${s.code.toLowerCase()}`;
            return (
              <React.Fragment key={s.id || s.code}>
                <button
                  type="button"
                  onClick={() => navigate(targetRoute)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer border min-h-[32px] ${
                    isCurrent
                      ? 'text-white shadow-sm border-transparent'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  style={isCurrent ? { backgroundColor: s.color_badge || '#6366f1' } : {}}
                >
                  <span className={`text-[10px] font-bold ${isCurrent ? 'text-white/80' : 'text-slate-400'}`}>
                    {String(s.sequence_order).padStart(2, '0')}.
                  </span>
                  <span>{s.name}</span>
                </button>
                {idx < stages.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Stage Summary Statistics Cards */}
      <div className="px-3 sm:px-4 pt-3 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Orders in Stage</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{orderGroups.length}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Package className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Garments in Stage</p>
            <p className="text-lg font-bold text-brand-600 mt-0.5">
              {fmt(orderGroups.reduce((acc, g) => acc + g.total_stage_quantity, 0))} <span className="text-xs font-normal text-slate-400">pcs</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Product Line Items</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{items.length}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Current Pipeline</p>
            <p className="text-xs font-bold text-slate-800 truncate mt-1">
              Step {currentStage?.sequence_order || 1}: {stageName}
            </p>
          </div>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-2xs"
            style={{ backgroundColor: currentStage?.color_badge || '#6366f1' }}
          >
            {activeCode}
          </div>
        </div>
      </div>

      {/* Search & Control Filter Bar */}
      <div className="px-3 sm:px-4 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by Order #, Buyer, Product, Color..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-2xs"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-2xs"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {/* View Switcher: Orders View (Default) vs Flat Items */}
        <div className="flex items-center gap-2">
          {viewMode === 'orders' && filteredOrderGroups.length > 0 && (
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={expandAllOrders}
                className="px-2 py-1 text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition font-medium shadow-2xs"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAllOrders}
                className="px-2 py-1 text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition font-medium shadow-2xs"
              >
                Collapse All
              </button>
            </div>
          )}

          <div className="flex bg-slate-200/80 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('orders')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                viewMode === 'orders'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Orders View ({filteredOrderGroups.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('items')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                viewMode === 'items'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Flat Items ({items.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin text-brand-600 mb-2" />
            <p className="text-xs font-medium">Loading stage pipeline data...</p>
          </div>
        ) : viewMode === 'orders' ? (
          /* ========================================================================= */
          /* ORDER-CENTRIC VIEW: Only see the Order & Expand to see list of products */
          /* ========================================================================= */
          filteredOrderGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-2xs">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700">No Orders in {stageName}</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? 'No orders match your filter criteria. Try clearing search.'
                  : `There are currently no active production orders at the ${stageName} stage.`}
              </p>
              {activeCode === 'REQ' && (
                <Button
                  onClick={() => navigate('/production/orders/create')}
                  className="mt-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs"
                >
                  Create Production Order
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredOrderGroups.map(group => {
                const isExpanded = !!expandedOrders[group.order_number];
                return (
                  <div
                    key={group.order_number}
                    className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                      isExpanded ? 'border-brand-300 ring-1 ring-brand-100' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Order Master Header Row */}
                    <div
                      onClick={() => toggleExpandOrder(group.order_number)}
                      className="p-3.5 sm:p-4 cursor-pointer select-none hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {/* Left: Order Info & Buyer with Lorelei Avatar */}
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <BuyerAvatar
                          buyer={{
                            id: group.customer_id,
                            code: group.customer_code,
                            name: group.customer_name,
                            avatar_style: group.customer_avatar_style,
                            avatar_seed: group.customer_avatar_seed,
                            avatar_config: group.customer_avatar_config,
                          }}
                          size="md"
                          shape="circle"
                          className="shrink-0"
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-brand-700 bg-brand-50/80 px-2 py-0.5 rounded border border-brand-200">
                              {group.order_number}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {group.customer_name || 'Direct Buyer'}
                            </span>
                            {group.customer_code && (
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {group.customer_code}
                              </span>
                            )}
                            <StatusBadge status={group.priority || 'Medium'} />
                          </div>

                          <p className="text-xs font-medium text-slate-600 truncate mt-1">
                            {group.order_title || 'Garment Production Requirement'}
                          </p>
                        </div>
                      </div>

                      {/* Right: Quantity, Date, & Expand Button */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {/* Target Delivery Date */}
                        {group.target_delivery_date && (
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-slate-400 block font-medium">Target Delivery</span>
                            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {group.target_delivery_date}
                            </span>
                          </div>
                        )}

                        {/* Quantity Badge */}
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 block font-medium">Stage Quantity</span>
                          <span className="font-mono font-bold text-sm text-brand-700">
                            {fmt(group.total_stage_quantity)} <span className="text-xs font-normal text-slate-500">pcs</span>
                          </span>
                        </div>

                        {/* Action buttons: Material List (BOM), Enter Order & Accordion Chevron */}
                        <div className="flex items-center gap-1.5">
                          {activeCode === 'REQ' && group.order_id && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                navigate(`/production/requirement/${group.order_id}`);
                              }}
                              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 shadow-2xs transition"
                              title="Generate material requirement list (BOM) for this order"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Material List (BOM)</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              toggleExpandOrder(group.order_number);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                              isExpanded
                                ? 'bg-brand-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            <span>{isExpanded ? 'Hide Products' : `Enter Order (${group.items.length})`}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              if (group.order_id) {
                                navigate(`/production/orders/${group.order_id}`);
                              }
                            }}
                            title="Open full order details"
                            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Product List inside this Order */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/70 p-3 sm:p-4 animate-in fade-in slide-in-from-top-1">
                        {/* Requirement Stage Material List Callout Banner */}
                        {activeCode === 'REQ' && group.order_id && (
                          <div className="mb-3 p-3 bg-gradient-to-r from-indigo-50 via-brand-50 to-indigo-50 border border-indigo-200/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                <Sparkles className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800">
                                  Auto-Generated Material Requirements & BOM
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                  Computed automatically from product raw materials configured in Buyer Master ({fmt(group.total_stage_quantity)} pcs).
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate(`/production/requirement/${group.order_id}`)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs shrink-0 transition"
                            >
                              <span>View Full Material List</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                              Products in Order ({group.items.length} line items)
                            </span>
                            <span className="text-[11px] text-slate-500">
                              • Total {fmt(group.total_stage_quantity)} pcs at {stageName}
                            </span>
                          </div>

                          {/* Quick Batch Advance for Entire Order */}
                          {!isCompleted && nextStages.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openBatchMoveModal(group)}
                              className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-brand-50 text-brand-700 border border-brand-200 rounded-md hover:bg-brand-100 transition font-bold"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              <span>Advance All Products in Order</span>
                            </button>
                          )}
                        </div>

                        {/* Product Items Table / Cards */}
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50/90 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                                <tr>
                                  <th className="py-2.5 px-3">Product Name & Code</th>
                                  <th className="py-2.5 px-3">Color</th>
                                  <th className="py-2.5 px-3">Size</th>
                                  <th className="py-2.5 px-3 text-right">Order Qty</th>
                                  <th className="py-2.5 px-3 text-right">At This Stage</th>
                                  <th className="py-2.5 px-3">Status</th>
                                  <th className="py-2.5 px-3 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {group.items.map(it => (
                                  <tr key={it.id} className="hover:bg-slate-50/60 transition">
                                    <td className="py-2.5 px-3">
                                      <span className="font-semibold text-slate-800 block">
                                        {it.product_name || 'Garment Product'}
                                      </span>
                                      {it.product_code && (
                                        <span className="font-mono text-[10px] text-slate-400 block">
                                          {it.product_code}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium text-slate-700 border border-slate-200">
                                        {it.color}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                                      {it.size ? (
                                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px]">
                                          {it.size}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 font-normal">—</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-600">
                                      {fmt(it.total_quantity)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                                        {fmt(it.current_stage_quantity || it.total_quantity)} pcs
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <StatusBadge status={it.status || 'In Progress'} />
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      {isQC ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedItem(it);
                                            setQcForm({
                                              passed: String(it.current_stage_quantity || it.total_quantity || 0),
                                              rejected: '0',
                                              rework: '0',
                                              defect_reason: '',
                                              remarks: '',
                                              rework_stage_id: '7',
                                            });
                                            setQcOpen(true);
                                          }}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 transition font-semibold"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" /> QC Check
                                        </button>
                                      ) : !isCompleted ? (
                                        <button
                                          type="button"
                                          onClick={() => openMoveModal(it)}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition font-bold"
                                        >
                                          <span>Move</span>
                                          <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                      ) : (
                                        <span className="text-[11px] text-emerald-700 font-bold px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                                          ✓ Done
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ========================================================================= */
          /* FLAT ITEMS VIEW: Flat tabular view of all order items                     */
          /* ========================================================================= */
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <DataTable
              data={items}
              columns={flatColumns}
              rowKey="id"
              onRowClick={r => openMoveModal(r)}
              actions={(r: StageItem) => (
                <div className="flex items-center gap-1.5">
                  {isQC ? (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedItem(r);
                        setQcForm({
                          passed: String(r.current_stage_quantity || r.total_quantity || 0),
                          rejected: '0',
                          rework: '0',
                          defect_reason: '',
                          remarks: '',
                          rework_stage_id: '7',
                        });
                        setQcOpen(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 transition font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> QC Check
                    </button>
                  ) : !isCompleted ? (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        openMoveModal(r);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition font-semibold"
                    >
                      Move <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-700 font-bold px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                      ✓ Done
                    </span>
                  )}
                </div>
              )}
            />
          </div>
        )}
      </div>

      {/* Move Stage Modal for Single Product */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={`Advance Stage — Order ${selectedItem?.order_number}`}
        subtitle={`${selectedItem?.product_name} | ${selectedItem?.color}${selectedItem?.size ? ` | Size ${selectedItem.size}` : ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={handleMove}
              icon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Advance to Stage
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <span className="text-slate-500">Current Stage:</span>{' '}
            <strong className="text-slate-800">{stageName}</strong>
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-slate-500">Available:</span>{' '}
            <strong className="text-brand-700 font-mono">
              {fmt(selectedItem?.current_stage_quantity || selectedItem?.total_quantity || 0)} pcs
            </strong>
          </div>

          <FormField
            as="select"
            label="Next Destination Stage"
            required
            value={moveForm.next_stage_id}
            onChange={e => setMoveForm(f => ({ ...f, next_stage_id: e.target.value }))}
          >
            <option value="">— Select next production stage —</option>
            {nextStages.map(s => (
              <option key={s.id} value={s.id}>
                {String(s.sequence_order).padStart(2, '0')}. {s.name}
              </option>
            ))}
          </FormField>

          <FormField
            label="Quantity to Move (Pieces)"
            type="number"
            required
            min="1"
            max={selectedItem?.current_stage_quantity || selectedItem?.total_quantity}
            value={moveForm.quantity}
            onChange={e => setMoveForm(f => ({ ...f, quantity: e.target.value }))}
            hint={`Maximum available: ${fmt(selectedItem?.current_stage_quantity || selectedItem?.total_quantity || 0)} pcs`}
          />

          <FormField
            as="textarea"
            label="Operator Notes & Challan Details"
            value={moveForm.notes}
            onChange={e => setMoveForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="e.g. Requirement confirmed, ready for purchase order..."
          />
        </div>
      </Modal>

      {/* Batch Advance Modal for Entire Order */}
      <Modal
        open={batchMoveOpen}
        onClose={() => setBatchMoveOpen(false)}
        title={`Advance Entire Order — ${selectedOrderForBatch?.order_number}`}
        subtitle={`Advance all ${selectedOrderForBatch?.items.length} products (${fmt(selectedOrderForBatch?.total_stage_quantity || 0)} pcs) to the next stage`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBatchMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={handleBatchMove}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Advance All Products
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="p-3 bg-brand-50 border border-brand-200 rounded-lg text-xs text-brand-800">
            <p className="font-semibold">
              You are about to advance all {selectedOrderForBatch?.items.length} product line items in this order.
            </p>
            <p className="text-[11px] text-brand-600 mt-1">
              Total quantity: <strong>{fmt(selectedOrderForBatch?.total_stage_quantity || 0)} pcs</strong> across all colors and sizes.
            </p>
          </div>

          <FormField
            as="select"
            label="Select Destination Stage for All Products"
            required
            value={batchMoveForm.next_stage_id}
            onChange={e => setBatchMoveForm(f => ({ ...f, next_stage_id: e.target.value }))}
          >
            <option value="">— Select destination stage —</option>
            {nextStages.map(s => (
              <option key={s.id} value={s.id}>
                {String(s.sequence_order).padStart(2, '0')}. {s.name}
              </option>
            ))}
          </FormField>

          <FormField
            as="textarea"
            label="Batch Notes"
            value={batchMoveForm.notes}
            onChange={e => setBatchMoveForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="e.g. Requirement gathering completed. Advancing order to PO/Cutting."
          />
        </div>
      </Modal>

      {/* QC / Checking Modal */}
      <Modal
        open={qcOpen}
        onClose={() => setQcOpen(false)}
        title={`08. Checking — Quality Inspection`}
        subtitle={`Order ${selectedItem?.order_number} | ${selectedItem?.product_name} | ${selectedItem?.color}${selectedItem?.size ? ` / Size ${selectedItem.size}` : ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQcOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={handleQC}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Confirm QC & Route
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="p-2.5 bg-slate-50 border rounded-lg text-xs">
            Inspection Batch: <strong>{fmt(selectedItem?.current_stage_quantity || selectedItem?.total_quantity || 0)} pcs</strong>
            {' • '}Passed pieces will automatically advance to <strong>Packing</strong>.
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField
              label="✓ Passed Qty"
              type="number"
              min="0"
              value={qcForm.passed}
              onChange={e => setQcForm(f => ({ ...f, passed: e.target.value }))}
            />
            <FormField
              label="↺ Rework Qty"
              type="number"
              min="0"
              value={qcForm.rework}
              onChange={e => setQcForm(f => ({ ...f, rework: e.target.value }))}
            />
            <FormField
              label="✗ Rejected Qty"
              type="number"
              min="0"
              value={qcForm.rejected}
              onChange={e => setQcForm(f => ({ ...f, rejected: e.target.value }))}
            />
          </div>

          {Number(qcForm.rework) > 0 && (
            <FormField
              as="select"
              label="Route Rework Back To Stage"
              value={qcForm.rework_stage_id}
              onChange={e => setQcForm(f => ({ ...f, rework_stage_id: e.target.value }))}
            >
              {stages
                .filter(s => !s.is_final_stage && !s.is_qc_stage)
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </FormField>
          )}

          {(Number(qcForm.rejected) > 0 || Number(qcForm.rework) > 0) && (
            <FormField
              label="Primary Defect Reason"
              value={qcForm.defect_reason}
              onChange={e => setQcForm(f => ({ ...f, defect_reason: e.target.value }))}
              placeholder="e.g. Skipped stitch, oil stain..."
            />
          )}

          <FormField
            as="textarea"
            label="Inspector Remarks"
            value={qcForm.remarks}
            onChange={e => setQcForm(f => ({ ...f, remarks: e.target.value }))}
            rows={2}
            placeholder="Inspection observations..."
          />
        </div>
      </Modal>
    </div>
  );
}
