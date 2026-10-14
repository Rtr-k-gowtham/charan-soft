// src/pages/production/ProductionBoard.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ProductionOrder, ProductionOrderItem, ProductionStage } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import {
  RefreshCw, Plus, Search, Filter, AlertCircle, CheckCircle2,
  Calendar, Layers, ArrowRight, RotateCcw, ShieldAlert,
  Clock, Package, User, ChevronRight, Inbox, Check, AlertTriangle, ExternalLink
} from 'lucide-react';
import { api } from '../../lib/api';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n || 0);

const DEFAULT_STAGES: ProductionStage[] = [
  { id: 1, code: 'REQ', name: 'Requirement Gathering', sequence_order: 1, color_badge: '#6366f1', description: 'Production Requirement created for the product.', is_qc_stage: false, is_final_stage: false, status: 'active' },
  { id: 2, code: 'PO', name: 'Purchase Order (PO)', sequence_order: 2, color_badge: '#0284c7', description: 'Purchase order creation and tracking.', is_qc_stage: false, is_final_stage: false, status: 'active' },
  { id: 3, code: 'INW', name: 'Inward', sequence_order: 3, color_badge: '#0d9488', description: 'Receive materials or products into inventory.', is_qc_stage: false, is_final_stage: false, status: 'active' },
  { id: 4, code: 'DYE', name: 'Dyeing', sequence_order: 4, color_badge: '#7c3aed', description: 'Send material for dyeing and track color-wise processing.', is_qc_stage: false, is_final_stage: false, status: 'active' },
  { id: 5, code: 'CUT', name: 'Cutting — Product-wise', sequence_order: 5, color_badge: '#d97706', description: 'Track cutting quantities separately for each product and size.', is_qc_stage: false, is_final_stage: false, status: 'active' },
  { id: 6, code: 'EMB', name: 'Embroidery — Outward / Inward', sequence_order: 6, color_badge: '#ec4899', description: 'Track material sent to the embroidery unit and the quantity received back.', is_qc_stage: false, is_final_stage: false, status: 'active' },
  { id: 7, code: 'STI', name: 'Stitching — Color-wise Tracking', sequence_order: 7, color_badge: '#2563eb', description: 'Track stitching progress by product, color, size and quantity.', is_qc_stage: false, is_final_stage: false, status: 'active' },
  { id: 8, code: 'CHK', name: 'Checking', sequence_order: 8, color_badge: '#ef4444', description: 'Quality inspection, defect recording and approval.', is_qc_stage: true, is_final_stage: false, status: 'active' },
  { id: 9, code: 'PCK', name: 'Packing', sequence_order: 9, color_badge: '#059669', description: 'Pack approved products and track packed quantities.', is_qc_stage: false, is_final_stage: false, status: 'active' },
  { id: 10, code: 'COMP', name: 'Completed', sequence_order: 10, color_badge: '#16a34a', description: 'Production order completed with final quantities recorded.', is_qc_stage: false, is_final_stage: true, status: 'active' },
];

const STAGE_ROUTE_MAP: Record<number, string> = {
  1: '/production/requirement',
  2: '/production/po',
  3: '/production/inward',
  4: '/production/dyeing',
  5: '/production/cutting',
  6: '/production/embroidery',
  7: '/production/stitching',
  8: '/production/checking',
  9: '/production/packing',
  10: '/production/completed',
};

const priorityConfig: Record<string, { dot: string; badge: string }> = {
  Urgent: { dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200' },
  High: { dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  Medium: { dot: 'bg-blue-500', badge: 'bg-blue-700 border-blue-200' },
  Low: { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

interface BoardCardItem {
  order: ProductionOrder;
  item: ProductionOrderItem;
}

export default function ProductionBoard() {
  const [stages, setStages] = useState<ProductionStage[]>(DEFAULT_STAGES);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [activeMobileStageTab, setActiveMobileStageTab] = useState<number | null>(null);

  // Transition State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Move Modal State
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [activeItemForMove, setActiveItemForMove] = useState<BoardCardItem | null>(null);
  const [moveTargetStageId, setMoveTargetStageId] = useState<number>(0);
  const [moveQuantity, setMoveQuantity] = useState<string>('');
  const [moveNotes, setMoveNotes] = useState<string>('');

  // QC Modal State
  const [qcModalOpen, setQcModalOpen] = useState(false);
  const [activeItemForQC, setActiveItemForQC] = useState<BoardCardItem | null>(null);
  const [qcPassedQty, setQcPassedQty] = useState<string>('');
  const [qcRejectedQty, setQcRejectedQty] = useState<string>('');
  const [qcReworkQty, setQcReworkQty] = useState<string>('');
  const [qcDefectReason, setQcDefectReason] = useState<string>('Visual & measurement check');
  const [qcRemarks, setQcRemarks] = useState<string>('');

  // Drag and Drop State
  const [draggedCard, setDraggedCard] = useState<BoardCardItem | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const [fetchedStages, fetchedOrders] = await Promise.all([
        api.getProductionStages().catch(() => null),
        api.getProductionOrders().catch(() => null),
      ]);

      if (Array.isArray(fetchedStages) && fetchedStages.length > 0) {
        // Sort strictly by sequence order 1 to 8
        const stagesList = fetchedStages as ProductionStage[];
        const sorted = [...stagesList].sort((a, b) => a.sequence_order - b.sequence_order);
        setStages(sorted);
      } else {
        setStages(DEFAULT_STAGES);
      }

      if (Array.isArray(fetchedOrders)) {
        setOrders(fetchedOrders as ProductionOrder[]);
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to load production board data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Flash toast auto dismiss
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Valid next stages according to manufacturing workflow rules
  const getValidNextStages = (currentStageId: number): ProductionStage[] => {
    const cur = stages.find(s => s.id === currentStageId);
    if (!cur) return [];

    // Stage 10 (Completed) has no next stage (terminal state)
    if (cur.is_final_stage || cur.sequence_order === 10 || cur.code === 'COMP') {
      return [];
    }

    // Stage 8 (Checking / QC): Next valid destinations are Stage 9 (Packing) or rework to prior stages (Cutting, Embroidery, Stitching)
    if (cur.is_qc_stage || cur.sequence_order === 8 || cur.code === 'CHK') {
      return stages.filter(s => s.sequence_order === 9 || s.code === 'CUT' || s.code === 'EMB' || s.code === 'STI');
    }

    // Standard sequence stages (1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10)
    return stages.filter(s => s.sequence_order === cur.sequence_order + 1);
  };

  // Group all items by stage with filtering
  const itemsByStage = useMemo(() => {
    const map = new Map<number, BoardCardItem[]>();
    stages.forEach(s => map.set(s.id, []));

    orders.forEach(ord => {
      // Filter by Priority
      if (priorityFilter !== 'ALL' && ord.priority?.toUpperCase() !== priorityFilter.toUpperCase()) {
        return;
      }

      const q = searchQuery.trim().toLowerCase();

      (ord.items || []).forEach(it => {
        // Search filter matching order_number, title, customer, product, color, size
        if (q) {
          const matchOrder = ord.order_number?.toLowerCase().includes(q) || false;
          const matchTitle = ord.title?.toLowerCase().includes(q) || false;
          const matchCustomer = ord.customer_name?.toLowerCase().includes(q) || false;
          const matchProduct = it.product_name?.toLowerCase().includes(q) || false;
          const matchColor = it.color?.toLowerCase().includes(q) || false;
          const matchSize = it.size?.toLowerCase().includes(q) || false;

          if (!matchOrder && !matchTitle && !matchCustomer && !matchProduct && !matchColor && !matchSize) {
            return;
          }
        }

        // Place in corresponding stage
        const stageId = it.current_stage_id;
        if (map.has(stageId)) {
          map.get(stageId)!.push({ order: ord, item: it });
        } else {
          // If stage id not directly in map, attempt to match by stage name or sequence
          const matchedStage = stages.find(s =>
            (it.current_stage_name && (s.name || '').toLowerCase() === (it.current_stage_name || '').toLowerCase()) ||
            s.id === stageId
          );
          if (matchedStage && map.has(matchedStage.id)) {
            map.get(matchedStage.id)!.push({ order: ord, item: it });
          } else if (map.has(1)) {
            // Default to stage 1 if unknown
            map.get(1)!.push({ order: ord, item: it });
          }
        }
      });
    });

    return map;
  }, [stages, orders, searchQuery, priorityFilter]);

  // Total summary metrics
  const totalPiecesInPipeline = useMemo(() => {
    let count = 0;
    orders.forEach(ord => {
      (ord.items || []).forEach(it => {
        count += (it.current_stage_quantity || 0);
      });
    });
    return count;
  }, [orders]);

  const totalCompletedPieces = useMemo(() => {
    let count = 0;
    orders.forEach(ord => {
      (ord.items || []).forEach(it => {
        count += (it.completed_quantity || 0);
      });
    });
    return count;
  }, [orders]);

  // Open Move Modal
  const openMoveModal = (card: BoardCardItem, targetStageId?: number) => {
    const validNext = getValidNextStages(card.item.current_stage_id);
    if (validNext.length === 0) return;

    setActiveItemForMove(card);
    setMoveTargetStageId(targetStageId && validNext.some(s => s.id === targetStageId) ? targetStageId : validNext[0].id);
    setMoveQuantity(String(card.item.current_stage_quantity || 1));
    setMoveNotes('');
    setModalError(null);
    setMoveModalOpen(true);
  };

  // Submit Move Stage
  const handleExecuteMove = async () => {
    if (!activeItemForMove) return;
    const qty = parseInt(moveQuantity, 10);
    const maxQty = activeItemForMove.item.current_stage_quantity;

    if (!qty || qty <= 0) {
      setModalError('Quantity must be greater than 0.');
      return;
    }
    if (qty > maxQty) {
      setModalError(`Quantity cannot exceed items at this stage (${maxQty} pcs).`);
      return;
    }
    if (!moveTargetStageId) {
      setModalError('Please select a valid destination stage.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      await api.moveStage({
        item_id: activeItemForMove.item.id,
        order_item_id: activeItemForMove.item.id,
        next_stage_id: moveTargetStageId,
        to_stage_id: moveTargetStageId,
        quantity: qty,
        quantity_moved: qty,
        notes: moveNotes.trim(),
        remarks: moveNotes.trim(),
      });

      const destStage = stages.find(s => s.id === moveTargetStageId);
      setSuccessToast(`Successfully advanced ${qty} pcs of ${activeItemForMove.item.product_name} to ${destStage?.name || 'next stage'}.`);
      setMoveModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to move order item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open QC Modal
  const openQCModal = (card: BoardCardItem, prefillTarget?: 'completed' | 'rework') => {
    setActiveItemForQC(card);
    const available = card.item.current_stage_quantity || 0;

    if (prefillTarget === 'rework') {
      setQcPassedQty('0');
      setQcRejectedQty('0');
      setQcReworkQty(String(available));
    } else {
      // Default to passed
      setQcPassedQty(String(available));
      setQcRejectedQty('0');
      setQcReworkQty('0');
    }

    setQcDefectReason(prefillTarget === 'rework' ? 'Stitching / specification rework needed' : 'Visual & measurement audit');
    setQcRemarks('');
    setModalError(null);
    setQcModalOpen(true);
  };

  // Submit QC Inspection
  const handleExecuteQC = async () => {
    if (!activeItemForQC) return;

    const passed = parseInt(qcPassedQty, 10) || 0;
    const rejected = parseInt(qcRejectedQty, 10) || 0;
    const rework = parseInt(qcReworkQty, 10) || 0;
    const totalInput = activeItemForQC.item.current_stage_quantity;
    const sum = passed + rejected + rework;

    if (sum === 0) {
      setModalError('Please enter inspection quantities (Passed, Rejected, or Rework).');
      return;
    }
    if (sum > totalInput) {
      setModalError(`Total inspected pieces (${sum}) cannot exceed available quantity (${totalInput} pcs).`);
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      await api.recordQC({
        item_id: activeItemForQC.item.id,
        order_item_id: activeItemForQC.item.id,
        stage_id: 6,
        input_quantity: totalInput,
        passed_quantity: passed,
        passed: passed,
        rejected_quantity: rejected,
        rejected: rejected,
        rework_quantity: rework,
        rework: rework,
        rework_stage_id: 7,
        defect_reason: (rejected > 0 || rework > 0) ? qcDefectReason : 'Passed inspection',
        remarks: qcRemarks.trim(),
      });

      setSuccessToast(`QC recorded: ${passed} passed, ${rework} rework, ${rejected} rejected.`);
      setQcModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to record QC inspection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, card: BoardCardItem) => {
    setDraggedCard(card);
    e.dataTransfer.setData('text/plain', String(card.item.id));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetStage: ProductionStage) => {
    if (!draggedCard) return;
    const validNext = getValidNextStages(draggedCard.item.current_stage_id);
    const isValid = validNext.some(s => s.id === targetStage.id);

    if (isValid) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverStageId !== targetStage.id) {
        setDragOverStageId(targetStage.id);
      }
    }
  };

  const handleDragLeave = (_e: React.DragEvent, stageId: number) => {
    if (dragOverStageId === stageId) {
      setDragOverStageId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStage: ProductionStage) => {
    e.preventDefault();
    setDragOverStageId(null);
    if (!draggedCard) return;

    const sourceStageId = draggedCard.item.current_stage_id;
    const validNext = getValidNextStages(sourceStageId);
    const isValid = validNext.some(s => s.id === targetStage.id);

    if (!isValid) {
      const sourceStage = stages.find(s => s.id === sourceStageId);
      setErrorBanner(`Cannot jump from ${sourceStage?.name || 'stage'} to ${targetStage.name}. Next allowed: ${validNext.map(s => s.name).join(', ') || 'None'}`);
      setDraggedCard(null);
      return;
    }

    // If source is QC (Stage 6)
    if (sourceStageId === 6 || targetStage.sequence_order === 8 || targetStage.sequence_order === 7) {
      if (sourceStageId === 6) {
        openQCModal(draggedCard, targetStage.sequence_order === 7 ? 'rework' : 'completed');
        setDraggedCard(null);
        return;
      }
    }

    // Open Move Modal with target pre-selected
    openMoveModal(draggedCard, targetStage.id);
    setDraggedCard(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* Top Header */}
      <PageHeader
        title="Production Board"
        subtitle="Live kanban view of textile manufacturing workflow across 8 stages"
        breadcrumb={[{ label: 'Production' }, { label: 'Board' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
              title="Refresh production orders"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              to="/production/orders/create"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 rounded-md hover:bg-brand-700 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Order</span>
            </Link>
          </div>
        }
      />

      {/* Toast Feedback */}
      {successToast && (
        <div className="mx-4 mt-2 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">×</button>
        </div>
      )}

      {/* Error Banner */}
      {errorBanner && (
        <div className="mx-4 mt-2 p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="text-red-600 hover:text-red-800 font-bold ml-2">×</button>
        </div>
      )}

      {/* Filter & Metric Bar */}
      <div className="px-3 sm:px-4 py-2.5 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2 flex-1 w-full max-w-lg">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by order #, title, customer, product..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        {/* Global Board Summary */}
        <div className="flex items-center gap-2 text-xs text-slate-600 overflow-x-auto touch-scroll scrollbar-none pb-0.5">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded border border-slate-200 whitespace-nowrap shrink-0">
            <Package className="w-3.5 h-3.5 text-brand-600" />
            <span>Orders: <strong className="text-slate-800">{orders.length}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 bg-brand-50 px-2.5 py-1 rounded border border-brand-200 whitespace-nowrap shrink-0">
            <Layers className="w-3.5 h-3.5 text-brand-700" />
            <span>Pipeline: <strong className="text-brand-800">{fmt(totalPiecesInPipeline)} pcs</strong></span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 whitespace-nowrap shrink-0">
            <Check className="w-3.5 h-3.5 text-emerald-700" />
            <span>Completed: <strong className="text-emerald-800">{fmt(totalCompletedPieces)} pcs</strong></span>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Stage Tabs */}
      <div className="flex md:hidden overflow-x-auto touch-scroll scrollbar-none gap-1.5 px-3 py-2 bg-white border-b border-slate-200 shrink-0">
        <button
          onClick={() => setActiveMobileStageTab(null)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors min-h-[34px] ${
            activeMobileStageTab === null ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Stages ({stages.length})
        </button>
        {stages.map(stg => {
          const itemsCount = (itemsByStage.get(stg.id) || []).length;
          const isSelected = activeMobileStageTab === stg.id;
          return (
            <button
              key={stg.id}
              onClick={() => setActiveMobileStageTab(stg.id)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 min-h-[34px]"
              style={{
                backgroundColor: isSelected ? stg.color_badge : '#f1f5f9',
                color: isSelected ? 'white' : '#475569',
              }}
            >
              <span>{stg.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-black/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {itemsCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Kanban Columns Container */}
      <div className="flex-1 overflow-x-auto touch-scroll overflow-y-hidden p-2.5 sm:p-3.5">
        <div className={`flex h-full gap-3 pb-1 ${activeMobileStageTab !== null ? 'w-full md:min-w-max' : 'min-w-max snap-x snap-mandatory'}`}>
          {stages
            .filter(stg => activeMobileStageTab === null || stg.id === activeMobileStageTab)
            .map(stage => {
              const items = itemsByStage.get(stage.id) || [];
              const totalPieces = items.reduce((sum, { item }) => sum + (item.current_stage_quantity || 0), 0);
              const isDropTarget = dragOverStageId === stage.id;
              const stageRoute = STAGE_ROUTE_MAP[stage.id] || '/production/board';

              return (
                <div
                  key={stage.id}
                  onDragOver={e => handleDragOver(e, stage)}
                  onDragLeave={e => handleDragLeave(e, stage.id)}
                  onDrop={e => handleDrop(e, stage)}
                  className={`${
                    activeMobileStageTab !== null ? 'w-full md:w-72' : 'w-[85vw] sm:w-72 snap-center'
                  } shrink-0 flex flex-col h-full bg-slate-50 rounded-lg border transition-all duration-150 shadow-sm ${
                    isDropTarget
                      ? 'border-brand-500 ring-2 ring-brand-300/60 bg-brand-50/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Column Header */}
                  <div
                    className="p-2.5 border-b border-slate-200/80 rounded-t-lg bg-white shrink-0 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: stage.color_badge }}
                        />
                        <span className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                          {stage.sequence_order}. {stage.name}
                        </span>
                      </div>
                      <Link
                        to={stageRoute}
                        title={`Open dedicated ${stage.name} page`}
                        className="text-slate-400 hover:text-brand-600 p-0.5 rounded hover:bg-slate-50 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                      <span className="font-semibold text-slate-500">
                        {items.length} {items.length === 1 ? 'item' : 'items'}
                      </span>
                      <span
                        className="font-bold px-2 py-0.5 rounded text-[10px]"
                        style={{
                          backgroundColor: stage.color_badge + '18',
                          color: stage.color_badge,
                        }}
                      >
                        {fmt(totalPieces)} pcs
                      </span>
                    </div>
                  </div>

                  {/* Cards Scrollable List */}
                  <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-0">
                    {loading ? (
                      <div className="flex flex-col gap-2">
                        {[1, 2].map(n => (
                          <div key={n} className="bg-white p-3 rounded border border-slate-200 animate-pulse flex flex-col gap-2">
                            <div className="h-3 bg-slate-200 rounded w-1/3" />
                            <div className="h-4 bg-slate-200 rounded w-3/4" />
                            <div className="h-3 bg-slate-200 rounded w-1/2" />
                          </div>
                        ))}
                      </div>
                    ) : items.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-md">
                        <Inbox className="w-7 h-7 mb-1.5 text-slate-300 stroke-[1.5]" />
                        <p className="text-[11px] font-semibold text-slate-500">No items</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Ready for next batch</p>
                      </div>
                    ) : (
                      items.map(({ order, item }) => {
                        const progressPct = Math.min(100, Math.round(((item.completed_quantity || 0) / Math.max(1, item.total_quantity || 1)) * 100));
                        const priorityInfo = priorityConfig[order.priority] || priorityConfig.Medium;
                        const isFinalStage = stage.is_final_stage || stage.sequence_order === 8;
                        const isQCStage = stage.is_qc_stage || stage.sequence_order === 6;
                        const isReworkStage = stage.sequence_order === 7;
                        const validNextList = getValidNextStages(stage.id);

                        return (
                          <div
                            key={`${order.id}-${item.id}`}
                            draggable={!isFinalStage}
                            onDragStart={e => handleDragStart(e, { order, item })}
                            className="bg-white border border-slate-200 rounded-md p-2.5 shadow-xs hover:shadow-md transition-all duration-150 flex flex-col gap-2 group cursor-grab active:cursor-grabbing relative"
                          >
                            {/* Card Top: Order Number & Priority */}
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-brand-700 tracking-tight">
                                {order.order_number}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${priorityInfo.badge}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${priorityInfo.dot}`} />
                                  {order.priority || 'Medium'}
                                </span>
                              </div>
                            </div>

                            {/* Order Title & Customer */}
                            <div>
                              <p className="text-[11px] font-medium text-slate-800 line-clamp-1" title={order.title}>
                                {order.title}
                              </p>
                              {order.customer_name && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                  <User className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{order.customer_name}</span>
                                </p>
                              )}
                            </div>

                            {/* Product & Variant */}
                            <div className="bg-slate-50/80 rounded p-1.5 border border-slate-100 flex flex-col gap-1">
                              <p className="text-xs font-semibold text-slate-900 leading-snug line-clamp-1" title={item.product_name}>
                                {item.product_name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium flex-wrap">
                                <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200/80 shadow-2xs">
                                  Color: <strong className="text-slate-800">{item.color}</strong>
                                </span>
                                <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200/80 shadow-2xs">
                                  Size: <strong className="text-slate-800">{item.size}</strong>
                                </span>
                              </div>
                            </div>

                            {/* Quantities Breakdown */}
                            <div className="grid grid-cols-3 gap-1 bg-slate-50 rounded p-1.5 text-center border border-slate-100">
                              <div>
                                <p className="text-[8px] uppercase tracking-wide text-slate-400 font-semibold">Total</p>
                                <p className="text-xs font-bold text-slate-700">{fmt(item.total_quantity)}</p>
                              </div>
                              <div>
                                <p className="text-[8px] uppercase tracking-wide text-brand-600 font-semibold">At Stage</p>
                                <p className="text-xs font-bold text-brand-700">{fmt(item.current_stage_quantity)}</p>
                              </div>
                              <div>
                                <p className="text-[8px] uppercase tracking-wide text-emerald-600 font-semibold">Done</p>
                                <p className="text-xs font-bold text-emerald-700">{fmt(item.completed_quantity)}</p>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div>
                              <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1">
                                <span>Progress</span>
                                <span className="font-semibold text-slate-600">{progressPct}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${progressPct}%`,
                                    backgroundColor: stage.color_badge,
                                  }}
                                />
                              </div>
                            </div>

                            {/* QC Defects / Rework Status Badges */}
                            {(item.rejected_quantity > 0 || item.rework_quantity > 0) && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                {item.rework_quantity > 0 && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-pink-50 text-pink-700 border border-pink-200 rounded font-semibold flex items-center gap-1">
                                    <RotateCcw className="w-2.5 h-2.5" />
                                    {fmt(item.rework_quantity)} rework
                                  </span>
                                )}
                                {item.rejected_quantity > 0 && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded font-semibold flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    {fmt(item.rejected_quantity)} rejected
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Delivery Date & Footer */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                              <span className="flex items-center gap-1 text-[9px] text-slate-400">
                                <Calendar className="w-3 h-3" />
                                {order.target_delivery_date || order.start_date || 'No Date'}
                              </span>

                              {/* Interactive Action Button */}
                              {isFinalStage ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                                  <Check className="w-3 h-3" /> Completed
                                </span>
                              ) : isQCStage ? (
                                <button
                                  type="button"
                                  onClick={() => openQCModal({ order, item })}
                                  className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-[10px] font-bold transition-colors shadow-2xs"
                                >
                                  <ShieldAlert className="w-3 h-3" />
                                  <span>QC Inspection</span>
                                </button>
                              ) : isReworkStage ? (
                                <button
                                  type="button"
                                  onClick={() => openMoveModal({ order, item }, 6)}
                                  className="flex items-center gap-1 px-2 py-1 bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200 rounded text-[10px] font-bold transition-colors shadow-2xs"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Return to QC</span>
                                </button>
                              ) : (
                                validNextList.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => openMoveModal({ order, item }, validNextList[0]?.id)}
                                    className="flex items-center gap-1 px-2 py-1 bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 rounded text-[10px] font-bold transition-colors shadow-2xs"
                                  >
                                    <span>Move to {validNextList[0]?.name}</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Move Stage Modal */}
      <Modal
        open={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        title={`Advance Production Stage — ${activeItemForMove?.order.order_number || ''}`}
        subtitle={`${activeItemForMove?.item.product_name || ''} (${activeItemForMove?.item.color || ''} / ${activeItemForMove?.item.size || ''})`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={isSubmitting}
              onClick={handleExecuteMove}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Confirm Move
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {modalError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="bg-slate-50 p-3 rounded border border-slate-200 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-400 font-medium text-[10px] uppercase">Current Stage</p>
              <p className="font-bold text-slate-800 mt-0.5">
                {stages.find(s => s.id === activeItemForMove?.item.current_stage_id)?.name || 'Current'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium text-[10px] uppercase">Available to Move</p>
              <p className="font-bold text-brand-700 mt-0.5">
                {fmt(activeItemForMove?.item.current_stage_quantity || 0)} pcs
              </p>
            </div>
          </div>

          <FormField
            as="select"
            label="Destination Stage (Strict Workflow Sequence)"
            required
            value={moveTargetStageId}
            onChange={e => setMoveTargetStageId(Number(e.target.value))}
          >
            {activeItemForMove && getValidNextStages(activeItemForMove.item.current_stage_id).map(stg => (
              <option key={stg.id} value={stg.id}>
                {stg.sequence_order}. {stg.name}
              </option>
            ))}
          </FormField>

          <FormField
            label="Quantity to Move"
            type="number"
            required
            min="1"
            max={activeItemForMove?.item.current_stage_quantity || 1}
            value={moveQuantity}
            onChange={e => setMoveQuantity(e.target.value)}
            hint={`Maximum available: ${fmt(activeItemForMove?.item.current_stage_quantity || 0)} pcs`}
          />

          <FormField
            as="textarea"
            label="Movement Notes / Remarks"
            value={moveNotes}
            onChange={e => setMoveNotes(e.target.value)}
            rows={2}
            placeholder="Add optional operator remarks, machine ID, or batch shift notes..."
          />
        </div>
      </Modal>

      {/* QC Inspection Modal */}
      <Modal
        open={qcModalOpen}
        onClose={() => setQcModalOpen(false)}
        title={`Quality Control Inspection — ${activeItemForQC?.order.order_number || ''}`}
        subtitle={`${activeItemForQC?.item.product_name || ''} (${activeItemForQC?.item.color || ''} / ${activeItemForQC?.item.size || ''})`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQcModalOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={isSubmitting}
              onClick={handleExecuteQC}
              icon={<ShieldAlert className="w-3.5 h-3.5" />}
            >
              Submit QC Inspection
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {modalError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Batch Pieces Available for QC:</span>
            <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {fmt(activeItemForQC?.item.current_stage_quantity || 0)} pcs
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-md flex flex-col gap-1">
              <span className="text-[11px] font-bold text-emerald-800">✓ Passed</span>
              <span className="text-[9px] text-emerald-600 leading-tight">Advances to Completed</span>
              <input
                type="number"
                min="0"
                value={qcPassedQty}
                onChange={e => setQcPassedQty(e.target.value)}
                className="mt-1 w-full px-2 py-1 text-xs bg-white border border-emerald-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-900"
              />
            </div>

            <div className="p-2.5 bg-pink-50/60 border border-pink-200 rounded-md flex flex-col gap-1">
              <span className="text-[11px] font-bold text-pink-800">↺ Rework</span>
              <span className="text-[9px] text-pink-600 leading-tight">Routes to Rework Stage</span>
              <input
                type="number"
                min="0"
                value={qcReworkQty}
                onChange={e => setQcReworkQty(e.target.value)}
                className="mt-1 w-full px-2 py-1 text-xs bg-white border border-pink-300 rounded focus:outline-none focus:ring-1 focus:ring-pink-500 font-bold text-pink-900"
              />
            </div>

            <div className="p-2.5 bg-red-50/60 border border-red-200 rounded-md flex flex-col gap-1">
              <span className="text-[11px] font-bold text-red-800">✗ Rejected</span>
              <span className="text-[9px] text-red-600 leading-tight">Scrapped / Damaged</span>
              <input
                type="number"
                min="0"
                value={qcRejectedQty}
                onChange={e => setQcRejectedQty(e.target.value)}
                className="mt-1 w-full px-2 py-1 text-xs bg-white border border-red-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 font-bold text-red-900"
              />
            </div>
          </div>

          {(Number(qcReworkQty) > 0 || Number(qcRejectedQty) > 0) && (
            <FormField
              label="Defect Reason / Failure Category"
              required
              value={qcDefectReason}
              onChange={e => setQcDefectReason(e.target.value)}
              placeholder="e.g., Uneven stitching, color shading variation, thread breakage..."
            />
          )}

          <FormField
            as="textarea"
            label="Inspector Remarks"
            value={qcRemarks}
            onChange={e => setQcRemarks(e.target.value)}
            rows={2}
            placeholder="Add quality inspection notes, tolerance measurements, or approval remarks..."
          />
        </div>
      </Modal>
    </div>
  );
}
