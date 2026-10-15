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



  // Material Requirements (BOM) State
  const [bomReport, setBomReport] = useState<ProductionOrderBOMReport | null>(null);
  const [loadingBOM, setLoadingBOM] = useState(false);
  const [bomSearchQuery, setBomSearchQuery] = useState('');
  const [bomCategoryFilter, setBomCategoryFilter] = useState('ALL');


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
      api.getOrderMaterialRequirements(id).catch(() => null),
    ])
      .then(([orderRes, stagesRes, bomRes]) => {
        setOrder((orderRes as { data?: ProductionOrder })?.data || (orderRes as ProductionOrder));
        setStages((stagesRes as ProductionStage[]) || []);
        if (bomRes) {
          const bData = (bomRes as any)?.data || (bomRes as ProductionOrderBOMReport);
          setBomReport(bData);
        }
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
  const handleGenerateBOM = async () => {
    if (!id) return;
    setLoadingBOM(true);
    try {
      const res = await api.getOrderMaterialRequirements(id);
      const data = (res as any)?.data || (res as ProductionOrderBOMReport);
      setBomReport(data);
      setToastMessage('Raw material requirement list (BOM) updated!');
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

  const groupedProducts = useMemo(() => {
    if (!order?.items) return {};
    const groups: Record<string, ProductionOrderItem[]> = {};
    order.items.forEach(item => {
      const cat = item.category_name || order.category_name || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [order]);

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
              variant="secondary"
              icon={<Printer className="w-3.5 h-3.5" />}
              onClick={() => window.print()}
            >
              Print Requisition
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
        {/* Order Summary Header: Left (Buyer & Delivery) / Right (Order ID, Title, Category, Priority, Status) */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          {/* Left Group: Buyer / Customer & Target Delivery Information */}
          <div className="flex items-center gap-2.5 sm:gap-3 text-xs text-slate-600 flex-wrap min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <BuyerAvatar buyer={order} size="sm" shape="circle" className="shrink-0" />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500 font-medium">Buyer / Customer:</span>
                <strong className="text-slate-800 font-semibold">{order.customer_name || 'Direct Order'}</strong>
                {order.customer_code && (
                  <span className="font-mono text-[10px] font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">
                    {order.customer_code}
                  </span>
                )}
              </div>
            </div>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Target Delivery:</span>
              <strong className="text-slate-800 font-mono font-semibold">{order.target_delivery_date || '—'}</strong>
            </div>
          </div>

          {/* Right Group: Order Number, Title, Category, Priority, Status */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap shrink-0">
            {/* Reduced size Order Number badge */}
            <span className="font-mono text-brand-700 font-bold text-xs bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200 shadow-2xs">
              {order.order_number}
            </span>
            <span className="text-slate-300 font-normal hidden sm:inline">|</span>
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 break-words">{order.title}</h2>
            {order.category_name && (
              <>
                <span className="text-slate-300 font-normal hidden sm:inline">|</span>
                <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {order.category_name}
                </span>
              </>
            )}
            <StatusBadge status={order.priority} />
            <StatusBadge status={order.status} />
          </div>
        </div>

        {/* SECTION 1: Material Requirements Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Material Requirements (BOM)
              </h3>
              {bomReport && (
                <span className="text-xs font-mono text-slate-500">
                  ({filteredMaterials.length} of {bomReport.summary.total_distinct_materials} items)
                </span>
              )}
            </div>

            {/* Filter and Search Bar */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={bomSearchQuery}
                  onChange={e => setBomSearchQuery(e.target.value)}
                  placeholder="Search material..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-2xs"
                />
              </div>

              {availableBOMCategories.length > 1 && (
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
              )}
            </div>
          </div>

          {loadingBOM ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
              <span className="text-xs text-slate-500">Calculating raw material requirements...</span>
            </div>
          ) : !bomReport || filteredMaterials.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No raw material requirements found for this order.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4 min-w-[200px]">Raw Material</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">UOM</th>
                    <th className="py-3 px-3 text-right">Total Required</th>
                    <th className="py-3 px-3 text-right">Unit Rate</th>
                    <th className="py-3 px-4 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMaterials.map((m, idx) => (
                    <tr key={m.material_id ? `id_${m.material_id}` : `name_${m.name}_${idx}`} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 text-center font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
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
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {fmt(m.total_required_qty, 2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {m.unit_cost > 0 ? fmtCurrency(m.unit_cost) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        {m.total_estimated_cost > 0 ? fmtCurrency(m.total_estimated_cost) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 2: Products Ordered (Grouped by Category) */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              Products Ordered ({items.length})
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Total Order Qty: <strong className="text-slate-800">{totalQty.toLocaleString()} pcs</strong>
            </span>
          </div>

          {Object.entries(groupedProducts).length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs shadow-2xs">
              No products ordered.
            </div>
          ) : (
            Object.entries(groupedProducts).map(([category, prods]) => {
              const catTotal = prods.reduce((sum, p) => sum + (p.total_quantity || 0), 0);
              const catDone = prods.reduce((sum, p) => sum + (p.completed_quantity || 0), 0);
              const catPending = Math.max(0, catTotal - catDone);

              return (
                <div key={category} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-4 h-4 text-brand-600" />
                      <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                        Category: {category}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        ({prods.length} {prods.length === 1 ? 'product line' : 'product lines'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-slate-500">Ordered: <strong className="text-slate-800">{catTotal.toLocaleString()} pcs</strong></span>
                      <span>•</span>
                      <span className="text-emerald-600">Done: {catDone.toLocaleString()}</span>
                      <span>•</span>
                      <span className="text-amber-600">Pending: {catPending.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse table-auto min-w-[760px]">
                      <thead className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
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
                        {prods.map((item, idx) => {
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
                                    size="xs"
                                    variant="secondary"
                                    onClick={() => openMoveModal(item)}
                                    className="text-[11px] font-semibold px-2 py-0.5 h-6.5 whitespace-nowrap shadow-2xs hover:border-slate-300"
                                  >
                                    Move Stage
                                  </Button>
                                  <button
                                    type="button"
                                    onClick={() => openQCModal(item)}
                                    title="Quality Check"
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
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
