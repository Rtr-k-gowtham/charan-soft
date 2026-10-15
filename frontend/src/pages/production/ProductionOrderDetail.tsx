// src/pages/production/ProductionOrderDetail.tsx
// Production Order Workspace with Clean Specifications and Automated Material Requirements (BOM) Calculator
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionOrderItem, ProductionStage, ProductionOrderBOMReport } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import {
  ArrowLeft,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  FileText,
  Sparkles,
  ShoppingCart,
  Printer,
  Package,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  DollarSign
} from 'lucide-react';

const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n || 0);

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function ProductionOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tab State: 'products' | 'bom'
  const [activeTab, setActiveTab] = useState<'products' | 'bom'>('products');

  // Material Requirements (BOM) State
  const [bomReport, setBomReport] = useState<ProductionOrderBOMReport | null>(null);
  const [loadingBOM, setLoadingBOM] = useState(false);
  const [bomSearchQuery, setBomSearchQuery] = useState('');
  const [bomCategoryFilter, setBomCategoryFilter] = useState('ALL');
  const [expandedMaterialKey, setExpandedMaterialKey] = useState<string | null>(null);

  // Move stage modal state
  const [moveOpen, setMoveOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ProductionOrderItem | null>(null);
  const [moveForm, setMoveForm] = useState({ to_stage_id: '', quantity_moved: 0, remarks: '' });
  const [savingMove, setSavingMove] = useState(false);
  const [moveError, setMoveError] = useState('');

  // QC modal state
  const [qcOpen, setQcOpen] = useState(false);
  const [qcForm, setQcForm] = useState({
    input_quantity: 0,
    passed_quantity: 0,
    rejected_quantity: 0,
    rework_quantity: 0,
    defect_reason: '',
    remarks: '',
    rework_stage_id: '5',
  });
  const [savingQC, setSavingQC] = useState(false);
  const [qcError, setQcError] = useState('');

  const loadData = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError('');

    Promise.all([
      api.getProductionOrder(Number(id)),
      api.getProductionStages(),
    ])
      .then(([orderRes, stagesRes]) => {
        setOrder((orderRes as { data?: ProductionOrder })?.data || (orderRes as ProductionOrder));
        setStages((stagesRes as ProductionStage[]) || []);
      })
      .catch((err: unknown) => {
        setError((err as Error).message || 'Failed to load production order details');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Generate / Load Material Requirements BOM
  const handleGenerateBOM = async (switchToTab = true) => {
    if (!id) return;
    setLoadingBOM(true);
    try {
      const res = await api.getOrderMaterialRequirements(id);
      const data = (res as any)?.data || (res as ProductionOrderBOMReport);
      setBomReport(data);
      if (switchToTab) setActiveTab('bom');
      setToastMessage('Raw material requirement list (BOM) generated from Buyer Product master!');
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to generate material requirements list');
    } finally {
      setLoadingBOM(false);
    }
  };

  // Handle Move Stage
  const handleMove = async () => {
    if (!selectedItem || !moveForm.to_stage_id || moveForm.quantity_moved <= 0) {
      setMoveError('Please specify destination stage and a valid quantity.');
      return;
    }
    setSavingMove(true);
    setMoveError('');
    try {
      await api.moveStage({
        order_item_id: selectedItem.id,
        to_stage_id: Number(moveForm.to_stage_id),
        quantity_moved: moveForm.quantity_moved,
        remarks: moveForm.remarks,
      });
      setMoveOpen(false);
      loadData();
    } catch (e: unknown) {
      setMoveError((e as Error).message || 'Failed to advance stage');
    } finally {
      setSavingMove(false);
    }
  };

  // Handle QC
  const handleQC = async () => {
    if (!selectedItem) return;
    const passed = Number(qcForm.passed_quantity);
    const rejected = Number(qcForm.rejected_quantity);
    const rework = Number(qcForm.rework_quantity);
    const total = passed + rejected + rework;

    if (total <= 0) {
      setQcError('Please enter at least one quantity for passed, rejected, or rework.');
      return;
    }

    setSavingQC(true);
    setQcError('');
    try {
      await api.recordQC({
        production_order_item_id: selectedItem.id,
        input_quantity: selectedItem.current_stage_quantity || selectedItem.total_quantity,
        passed_quantity: passed,
        rejected_quantity: rejected,
        rework_quantity: rework,
        defect_reason: qcForm.defect_reason || undefined,
        remarks: qcForm.remarks || undefined,
        rework_stage_id: rework > 0 ? Number(qcForm.rework_stage_id) : undefined,
      });
      setQcOpen(false);
      loadData();
    } catch (e: unknown) {
      setQcError((e as Error).message || 'Failed to record QC check');
    } finally {
      setSavingQC(false);
    }
  };

  const openMoveModal = (item: ProductionOrderItem) => {
    setSelectedItem(item);
    setMoveError('');
    setMoveForm({
      to_stage_id: '',
      quantity_moved: item.current_stage_quantity || item.total_quantity,
      remarks: '',
    });
    setMoveOpen(true);
  };

  const openQCModal = (item: ProductionOrderItem) => {
    setSelectedItem(item);
    setQcError('');
    const availableQty = item.current_stage_quantity || item.total_quantity;
    setQcForm({
      input_quantity: availableQty,
      passed_quantity: availableQty,
      rejected_quantity: 0,
      rework_quantity: 0,
      defect_reason: '',
      remarks: '',
      rework_stage_id: '5',
    });
    setQcOpen(true);
  };

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    if (!bomReport?.total_materials) return [];
    return bomReport.total_materials.filter(m => {
      if (bomCategoryFilter !== 'ALL' && m.category.toUpperCase() !== bomCategoryFilter.toUpperCase()) {
        return false;
      }
      if (!bomSearchQuery) return true;
      const q = bomSearchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        (m.material_code || '').toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    });
  }, [bomReport, bomCategoryFilter, bomSearchQuery]);

  const availableBOMCategories = useMemo(() => {
    if (!bomReport?.total_materials) return [];
    const set = new Set<string>();
    bomReport.total_materials.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [bomReport]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-200 animate-pulse" />
          <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Button
          variant="secondary"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/production/orders')}
        >
          Back to Production Orders
        </Button>
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <h3 className="text-sm font-bold text-red-800">Production Order Not Found</h3>
          <p className="text-xs text-red-600">{error || 'The requested production order does not exist or has been removed.'}</p>
          <div className="pt-2">
            <Button onClick={loadData}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  const totalQty = order.total_quantity || 0;
  const completedQty = order.completed_quantity || 0;
  const pendingQty = Math.max(0, totalQty - completedQty);
  const overallPct = totalQty > 0 ? Math.min(100, Math.round((completedQty / totalQty) * 100)) : 0;
  const items = order.items || [];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50/50">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title={`Production Order: ${order.order_number}`}
        subtitle={`Target Delivery: ${order.target_delivery_date || '—'} | ${order.title}`}
        breadcrumb={[
          { label: 'Production', href: '/production/orders' },
          { label: 'Orders', href: '/production/orders' },
          { label: order.order_number },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/production/orders')}
            >
              Back
            </Button>

            <Button
              onClick={() => handleGenerateBOM(true)}
              loading={loadingBOM}
              icon={<Sparkles className="w-3.5 h-3.5 text-amber-200" />}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
            >
              Generate Material List (BOM)
            </Button>

            <button
              onClick={loadData}
              className="p-2 text-slate-500 hover:text-brand-600 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors bg-white shadow-2xs"
              title="Refresh Order"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <div className="p-3 sm:p-5 space-y-4 max-w-7xl mx-auto w-full">
        {/* Banner with order number, title, priority, status badges */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-brand-700 font-bold text-lg bg-brand-50 px-2.5 py-1 rounded-md border border-brand-200">
              {order.order_number}
            </span>
            <span className="text-slate-300 font-normal hidden sm:inline">|</span>
            <h2 className="text-base font-bold text-slate-800 break-words">{order.title}</h2>
            <StatusBadge status={order.priority} />
            <StatusBadge status={order.status} />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
            <span className="flex items-center gap-2">
              <BuyerAvatar buyer={order} size="sm" shape="circle" />
              <span>
                Buyer / Customer: <strong className="text-slate-800">{order.customer_name || 'Direct Order'}</strong>
                {order.customer_code && (
                  <span className="ml-1.5 font-mono text-[10px] font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">
                    {order.customer_code}
                  </span>
                )}
              </span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Target Delivery: <strong className="text-slate-800 font-mono">{order.target_delivery_date || '—'}</strong>
            </span>
          </div>
        </div>

        {/* Section 1: Order Metrics Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Total Order Qty
            </span>
            <span className="text-xl font-bold font-mono text-slate-900">{totalQty.toLocaleString()}</span>
            <span className="text-[11px] text-slate-500 ml-1">pcs</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Completed Units
            </span>
            <span className="text-xl font-bold font-mono text-emerald-600">{completedQty.toLocaleString()}</span>
            <span className="text-[11px] text-slate-500 ml-1">pcs</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Pending Remaining
            </span>
            <span className="text-xl font-bold font-mono text-amber-600">{pendingQty.toLocaleString()}</span>
            <span className="text-[11px] text-slate-500 ml-1">pcs</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Overall Progress
              </span>
              <span className="text-xs font-bold font-mono text-brand-700">{overallPct}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overallPct === 100 ? 'bg-emerald-500' : 'bg-brand-600'
                }`}
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Automated Raw Material Requirement List (BOM) Banner */}
        <div className="bg-gradient-to-r from-indigo-50 via-brand-50 to-indigo-50 border border-indigo-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">
                Automated Raw Material Requirement List (BOM)
              </h4>
              <p className="text-[11px] text-slate-500">
                Calculates total fabrics, trims, threads & packaging required based on ordered quantities and Buyer Master BOM.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleGenerateBOM(true)}
              disabled={loadingBOM}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs shrink-0 transition"
            >
              <Sparkles className={`w-3.5 h-3.5 ${loadingBOM ? 'animate-spin' : ''}`} />
              <span>{bomReport ? 'Recalculate Material BOM' : 'Generate Material List (BOM)'}</span>
            </button>
            {bomReport && (
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation: Product Lines vs Material Requirements (BOM) */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'products'
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Product Lines & Stages ({items.length})</span>
            </button>

            <button
              onClick={() => {
                if (!bomReport) handleGenerateBOM(true);
                else setActiveTab('bom');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'bom'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Material Requirements (BOM)</span>
              {bomReport && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 ml-1">
                  {bomReport.total_materials.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'bom' && bomReport && bomReport.summary.shortage_count > 0 && (
            <button
              type="button"
              onClick={() => navigate('/purchase/orders?create=true')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-2xs transition"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Create PO for Shortages ({bomReport.summary.shortage_count})</span>
            </button>
          )}
        </div>

        {/* TAB 1: PRODUCT LINES TABLE */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* Section 2: Detailed Order Header Information Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-600" />
                  Order Specifications & Schedule
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  Category: <strong className="text-slate-700">{order.category_name || 'Apparel & Textiles'}</strong>
                </span>
              </div>

              <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Order Number</span>
                  <span className="font-mono font-bold text-brand-700 text-sm">{order.order_number}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Order Title</span>
                  <span className="font-semibold text-slate-800 break-words">{order.title}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Buyer / Customer</span>
                  <span className="font-medium text-slate-700">{order.customer_name || 'Direct / None'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Start Date</span>
                  <span className="font-mono text-slate-700">{order.start_date || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Target Delivery</span>
                  <span className="font-mono font-bold text-slate-800">{order.target_delivery_date || '—'}</span>
                </div>

                {order.notes && (
                  <div className="col-span-2 sm:col-span-3 lg:col-span-6 pt-3 border-t border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Production Notes & Instructions
                    </span>
                    <p className="text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs whitespace-pre-line leading-relaxed">
                      {order.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Product Lines Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-600" />
                  Product Lines & Workflow Stage Tracking
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  {items.length} {items.length === 1 ? 'line item' : 'line items'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse table-auto min-w-[760px]">
                  <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">#</th>
                      <th className="px-4 py-3 min-w-[180px]">Product</th>
                      <th className="px-4 py-3 min-w-[170px]">Color / Pantone</th>
                      <th className="px-3 py-3 text-center w-20">Size</th>
                      <th className="px-3 py-3 text-right w-24">Total Qty</th>
                      <th className="px-3 py-3 text-right w-24">Completed</th>
                      <th className="px-3 py-3 text-right w-24">Pending</th>
                      <th className="px-4 py-3 min-w-[160px]">Current Stage</th>
                      <th className="px-4 py-3 min-w-[130px]">Progress</th>
                      <th className="px-4 py-3 text-right w-36">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400">
                          No product lines associated with this production order.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => {
                        const itTotal = item.total_quantity || 0;
                        const itDone = item.completed_quantity || 0;
                        const itPending = Math.max(0, itTotal - itDone);
                        const itPct = itTotal > 0 ? Math.min(100, Math.round((itDone / itTotal) * 100)) : 0;
                        const pantone = item.color_pantone_code;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 text-center text-slate-400 font-mono font-medium">
                              {idx + 1}
                            </td>

                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-800 block text-xs">
                                {item.product_name || 'Standard Product'}
                              </span>
                              {item.product_code && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {item.product_code}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {item.color_hex_code && (
                                  <div
                                    className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs shrink-0"
                                    style={{ backgroundColor: item.color_hex_code }}
                                  />
                                )}
                                <div>
                                  <span className="font-semibold text-slate-800 text-xs block">
                                    {item.color}
                                  </span>
                                  {pantone && (
                                    <span className="text-[10px] font-mono text-slate-400 block">
                                      Pantone: {pantone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-3 py-3 text-center font-mono font-bold text-slate-700">
                              {item.size || '—'}
                            </td>

                            <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                              {itTotal.toLocaleString()}
                            </td>

                            <td className="px-3 py-3 text-right font-mono text-emerald-600 font-semibold">
                              {itDone.toLocaleString()}
                            </td>

                            <td className="px-3 py-3 text-right font-mono text-amber-600 font-semibold">
                              {itPending.toLocaleString()}
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold text-white shadow-2xs"
                                style={{ backgroundColor: item.color_badge || '#0284c7' }}
                              >
                                {item.current_stage_name || 'Requirement Gathering'}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <div className="w-full">
                                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1">
                                  <span>{itPct}%</span>
                                  <span>{itDone}/{itTotal}</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${itPct === 100 ? 'bg-emerald-500' : 'bg-brand-600'}`}
                                    style={{ width: `${itPct}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openMoveModal(item)}
                                  className="text-[11px] font-semibold"
                                >
                                  Move Stage
                                </Button>
                                <button
                                  type="button"
                                  onClick={() => openQCModal(item)}
                                  title="Quality Check"
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RAW MATERIAL REQUIREMENTS (BOM) */}
        {activeTab === 'bom' && (
          <div className="space-y-4">
            {loadingBOM ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-800">Calculating Raw Material Requirements...</h4>
                <p className="text-xs text-slate-400 mt-1">Cross-referencing buyer products and raw material components</p>
              </div>
            ) : !bomReport ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
                <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-800">Generate Material List for {order.order_number}</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Click the button below to automatically compute the total bill of materials for this order based on the product quantities and buyer BOM masters.
                </p>
                <Button
                  onClick={() => handleGenerateBOM(true)}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                >
                  Generate Material List (BOM)
                </Button>
              </div>
            ) : (
              <>
                {/* 4 KPI Summary Cards for BOM */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Raw Material Items
                    </span>
                    <p className="text-xl font-bold font-mono text-indigo-600">
                      {bomReport.summary.total_distinct_materials}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Distinct components</p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      In-Stock Items
                    </span>
                    <p className="text-xl font-bold font-mono text-emerald-600">
                      {bomReport.summary.in_stock_count}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Sufficient stock in inventory</p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Shortages to Procure
                    </span>
                    <p className={`text-xl font-bold font-mono ${bomReport.summary.shortage_count > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {bomReport.summary.shortage_count}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Requires purchase order</p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Est. Material Cost
                    </span>
                    <p className="text-xl font-bold font-mono text-slate-800">
                      {fmtCurrency(bomReport.summary.total_estimated_cost)}
                    </p>
                    <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Standard PO rate</p>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={bomSearchQuery}
                        onChange={e => setBomSearchQuery(e.target.value)}
                        placeholder="Search material by name, code or category..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-2xs"
                      />
                    </div>

                    <select
                      value={bomCategoryFilter}
                      onChange={e => setBomCategoryFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-2xs"
                    >
                      <option value="ALL">All Categories</option>
                      {availableBOMCategories.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-xs text-slate-500">
                    Showing <strong>{filteredMaterials.length}</strong> of {bomReport.summary.total_distinct_materials} materials
                  </span>
                </div>

                {/* BOM Materials Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-3.5">Raw Material</th>
                          <th className="py-3 px-3">Category</th>
                          <th className="py-3 px-3">UOM</th>
                          <th className="py-3 px-3 text-right">Total Required</th>
                          <th className="py-3 px-3 text-right">In Stock</th>
                          <th className="py-3 px-3 text-right">Shortage</th>
                          <th className="py-3 px-3 text-right">Unit Rate</th>
                          <th className="py-3 px-3 text-right">Total Cost</th>
                          <th className="py-3 px-3 text-center">Status</th>
                          <th className="py-3 px-3 text-center">Breakdown</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMaterials.map(m => {
                          const rowKey = m.material_id ? `id_${m.material_id}` : `name_${m.name}`;
                          const isExpanded = expandedMaterialKey === rowKey;
                          const hasShortage = m.shortage_qty > 0;

                          return (
                            <React.Fragment key={rowKey}>
                              <tr className={`hover:bg-slate-50/70 transition ${hasShortage ? 'bg-amber-50/20' : ''}`}>
                                <td className="py-3 px-3.5 font-medium text-slate-800">
                                  <span className="font-bold text-slate-800 block">{m.name}</span>
                                  {m.material_code && (
                                    <span className="font-mono text-[10px] text-slate-400 block">{m.material_code}</span>
                                  )}
                                </td>

                                <td className="py-3 px-3">
                                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                    {m.category}
                                  </span>
                                </td>

                                <td className="py-3 px-3 font-mono text-slate-600 font-semibold">{m.uom}</td>

                                <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                                  {fmt(m.total_required_qty, 2)}
                                </td>

                                <td className="py-3 px-3 text-right font-mono font-medium text-slate-600">
                                  {fmt(m.current_stock, 2)}
                                </td>

                                <td className="py-3 px-3 text-right font-mono font-bold">
                                  {hasShortage ? (
                                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                      {fmt(m.shortage_qty, 2)} {m.uom}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 font-medium">✓ 0</span>
                                  )}
                                </td>

                                <td className="py-3 px-3 text-right font-mono text-slate-600">
                                  {m.unit_cost > 0 ? fmtCurrency(m.unit_cost) : '—'}
                                </td>

                                <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                                  {m.total_estimated_cost > 0 ? fmtCurrency(m.total_estimated_cost) : '—'}
                                </td>

                                <td className="py-3 px-3 text-center">
                                  {hasShortage ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                      Procure
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      In Stock
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedMaterialKey(isExpanded ? null : rowKey)}
                                    className="p-1 rounded hover:bg-slate-200 text-slate-500 transition"
                                    title="Toggle product breakdown"
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-brand-600" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded product-wise contribution */}
                              {isExpanded && m.product_contributions && (
                                <tr className="bg-slate-50/90">
                                  <td colSpan={10} className="p-3">
                                    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs">
                                      <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                                        Product Contributions for &ldquo;{m.name}&rdquo;
                                      </h5>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                        {m.product_contributions.map((c, i) => (
                                          <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                                            <p className="font-bold text-slate-800">{c.product_name}</p>
                                            <p className="text-[11px] text-slate-500">Color: {c.color || 'Default'}</p>
                                            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-200 pt-1 font-mono">
                                              <span>{fmt(c.garment_qty)} pcs × {c.per_piece_qty} {m.uom} (+{c.wastage_percent}% w)</span>
                                              <strong className="text-brand-700 font-bold">{fmt(c.required_qty, 2)} {m.uom}</strong>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Advance Stage Modal */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={`Advance Workflow Stage — Order ${order.order_number}`}
        subtitle={`${selectedItem?.product_name || 'Product'} | Color: ${selectedItem?.color || '—'} | Total Qty: ${selectedItem?.total_quantity || 0}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={savingMove}
              onClick={handleMove}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Advance Stage
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {moveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{moveError}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
            <div>
              <span className="text-slate-500">Current Stage: </span>
              <strong className="text-slate-800">
                {selectedItem?.current_stage_name || 'Requirement Gathering'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Available Quantity at Stage: </span>
              <strong className="font-mono text-brand-700">
                {(selectedItem?.current_stage_quantity || selectedItem?.total_quantity || 0).toLocaleString()} pcs
              </strong>
            </div>
          </div>

          <FormField
            as="select"
            label="Destination Stage"
            required
            value={moveForm.to_stage_id}
            onChange={(e) => setMoveForm((f) => ({ ...f, to_stage_id: e.target.value }))}
          >
            <option value="">— Select destination stage —</option>
            {stages.map((st) => (
              <option key={st.id} value={st.id}>
                Stage {st.sequence_order}: {st.name}
              </option>
            ))}
          </FormField>

          <FormField
            label="Quantity to Advance (Pieces)"
            type="number"
            required
            min="1"
            max={selectedItem?.current_stage_quantity || selectedItem?.total_quantity}
            value={moveForm.quantity_moved}
            onChange={(e) => setMoveForm((f) => ({ ...f, quantity_moved: Number(e.target.value) }))}
          />

          <FormField
            as="textarea"
            label="Operator Notes & Handover Remarks"
            rows={2}
            value={moveForm.remarks}
            onChange={(e) => setMoveForm((f) => ({ ...f, remarks: e.target.value }))}
            placeholder="e.g. Batch completed and passed visual inspection..."
          />
        </div>
      </Modal>

      {/* QC Modal */}
      <Modal
        open={qcOpen}
        onClose={() => setQcOpen(false)}
        title="Quality Control (QC) Inspection"
        subtitle={`Order: ${order.order_number} | Product: ${selectedItem?.product_name} | Color: ${selectedItem?.color}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQcOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={savingQC}
              onClick={handleQC}
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
            >
              Record QC Check
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {qcError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{qcError}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500">Available for Inspection: </span>
            <strong className="font-mono text-slate-800">
              {(selectedItem?.current_stage_quantity || selectedItem?.total_quantity || 0).toLocaleString()} pcs
            </strong>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField
              label="Passed Qty"
              type="number"
              min="0"
              value={qcForm.passed_quantity}
              onChange={(e) => setQcForm((f) => ({ ...f, passed_quantity: Number(e.target.value) }))}
            />
            <FormField
              label="Rejected Qty"
              type="number"
              min="0"
              value={qcForm.rejected_quantity}
              onChange={(e) => setQcForm((f) => ({ ...f, rejected_quantity: Number(e.target.value) }))}
            />
            <FormField
              label="Rework Qty"
              type="number"
              min="0"
              value={qcForm.rework_quantity}
              onChange={(e) => setQcForm((f) => ({ ...f, rework_quantity: Number(e.target.value) }))}
            />
          </div>

          {qcForm.rework_quantity > 0 && (
            <FormField
              as="select"
              label="Rework Stage Destination"
              value={qcForm.rework_stage_id}
              onChange={(e) => setQcForm((f) => ({ ...f, rework_stage_id: e.target.value }))}
            >
              {stages
                .filter((st) => !st.is_qc_stage && !st.is_final_stage)
                .map((st) => (
                  <option key={st.id} value={st.id}>
                    Stage {st.sequence_order}: {st.name}
                  </option>
                ))}
            </FormField>
          )}

          {(qcForm.rejected_quantity > 0 || qcForm.rework_quantity > 0) && (
            <FormField
              label="Primary Defect Reason"
              value={qcForm.defect_reason}
              onChange={(e) => setQcForm((f) => ({ ...f, defect_reason: e.target.value }))}
              placeholder="e.g. Skipped stitches, shade variation, oil stain..."
            />
          )}

          <FormField
            as="textarea"
            label="Inspector Remarks"
            rows={2}
            value={qcForm.remarks}
            onChange={(e) => setQcForm((f) => ({ ...f, remarks: e.target.value }))}
            placeholder="Inspection observations..."
          />
        </div>
      </Modal>
    </div>
  );
}
