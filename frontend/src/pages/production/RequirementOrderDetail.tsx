import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrderBOMReport, OrderMaterialRequirementItem, ProductionStage } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import CategoryPOIssuer from '../../components/production/CategoryPOIssuer';
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Printer,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
  Calendar,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
  Scissors,
  CheckCheck,
  Pencil,
  Trash2,
  Plus,
  Save,
  RotateCcw,
  X
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

export default function RequirementOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [bomReport, setBomReport] = useState<ProductionOrderBOMReport | null>(null);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'bom' | 'products' | 'buyer'>('bom');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [expandedMaterialKey, setExpandedMaterialKey] = useState<string | null>(null);

  // BOM Editing State
  const [isEditingBOM, setIsEditingBOM] = useState(false);
  const [editedMaterials, setEditedMaterials] = useState<OrderMaterialRequirementItem[]>([]);

  // Advance Stage Modal
  const [moveOpen, setMoveOpen] = useState(false);
  const [selectedNextStageId, setSelectedNextStageId] = useState('2');
  const [moveNotes, setMoveNotes] = useState('Requirement verified and material BOM generated.');
  const [savingMove, setSavingMove] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [bomData, stgData] = await Promise.all([
        api.getOrderMaterialRequirements(id),
        api.getProductionStages().catch(() => []),
      ]);
      const report = (bomData as any)?.data || (bomData as ProductionOrderBOMReport);

      // Check if custom saved BOM exists in localStorage
      try {
        const saved = localStorage.getItem(`cheran_order_bom_${id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            report.total_materials = parsed;
            report.summary = {
              ...report.summary,
              total_distinct_materials: parsed.length,
              total_estimated_cost: parsed.reduce(
                (sum: number, it: any) => sum + (Number(it.total_required_qty || 0) * Number(it.unit_cost || 0)),
                0
              ),
            };
          }
        }
      } catch (e) {}

      setBomReport(report);
      setStages((stgData as ProductionStage[]) || []);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load requirement order BOM data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  const handleRecalculate = async () => {
    setCalculating(true);
    try {
      const bomData = await api.getOrderMaterialRequirements(id!);
      setBomReport((bomData as any)?.data || (bomData as ProductionOrderBOMReport));
      setSuccessToast('Material requirement list freshly computed from buyer BOM master!');
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to recalculate materials');
    } finally {
      setCalculating(false);
    }
  };

  // BOM Editing Handlers
  const handleStartEditBOM = () => {
    if (!bomReport?.total_materials) return;
    setEditedMaterials(JSON.parse(JSON.stringify(bomReport.total_materials)));
    setIsEditingBOM(true);
  };

  const handleCancelEditBOM = () => {
    setIsEditingBOM(false);
    setEditedMaterials([]);
  };

  const handleUpdateEditedRow = (index: number, field: keyof OrderMaterialRequirementItem, value: any) => {
    setEditedMaterials(prev => {
      const copy = [...prev];
      const row = { ...copy[index], [field]: value };
      if (field === 'total_required_qty' || field === 'unit_cost') {
        const qty = Number(field === 'total_required_qty' ? value : row.total_required_qty) || 0;
        const rate = Number(field === 'unit_cost' ? value : row.unit_cost) || 0;
        row.total_estimated_cost = Math.round(qty * rate * 100) / 100;
      }
      copy[index] = row;
      return copy;
    });
  };

  const handleAddMaterialRow = () => {
    setEditedMaterials(prev => [
      ...prev,
      {
        material_id: null,
        material_code: `CUST-${prev.length + 1}`,
        name: 'New Material',
        category: 'Fabric',
        uom: 'MTR',
        total_required_qty: 100,
        current_stock: 0,
        shortage_qty: 100,
        unit_cost: 0,
        total_estimated_cost: 0,
        status: 'Needs Procurement',
      }
    ]);
  };

  const handleDeleteMaterialRow = (index: number) => {
    setEditedMaterials(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveBOM = () => {
    if (!id) return;
    const cleaned = editedMaterials.map(m => {
      const qty = Number(m.total_required_qty) || 0;
      const rate = Number(m.unit_cost) || 0;
      return {
        ...m,
        total_required_qty: qty,
        unit_cost: rate,
        total_estimated_cost: Math.round(qty * rate * 100) / 100,
      };
    });

    try {
      localStorage.setItem(`cheran_order_bom_${id}`, JSON.stringify(cleaned));
    } catch (e) {}

    setBomReport(prev => {
      if (!prev) return null;
      return {
        ...prev,
        total_materials: cleaned,
        summary: {
          ...prev.summary,
          total_distinct_materials: cleaned.length,
          total_estimated_cost: cleaned.reduce((sum, it) => sum + (it.total_estimated_cost || 0), 0),
        }
      };
    });

    setIsEditingBOM(false);
    setSuccessToast('Material Requirements (BOM) saved successfully!');
  };

  const handleResetBOM = async () => {
    if (!id) return;
    try {
      localStorage.removeItem(`cheran_order_bom_${id}`);
    } catch (e) {}
    await handleRecalculate();
    setSuccessToast('BOM reset to default Buyer Master components!');
  };

  const handleAdvanceStage = async () => {
    if (!bomReport || !bomReport.order) return;
    setSavingMove(true);
    setError('');
    try {
      const destId = parseInt(selectedNextStageId);
      // Advance each order item to the destination stage (e.g. Stage 02 - PO)
      const items = bomReport.order.items || [];
      await Promise.all(
        items.map(it =>
          api.moveStage({
            order_item_id: it.id,
            to_stage_id: destId,
            quantity_moved: it.total_quantity,
            remarks: moveNotes,
          })
        )
      );
      setMoveOpen(false);
      setSuccessToast(`Order successfully advanced to next production stage!`);
      navigate('/production/po');
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to advance stage');
    } finally {
      setSavingMove(false);
    }
  };

  // Distinct categories available in total_materials
  const availableCategories = useMemo(() => {
    if (!bomReport?.total_materials) return [];
    const set = new Set<string>();
    bomReport.total_materials.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [bomReport]);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    if (!bomReport?.total_materials) return [];
    return bomReport.total_materials.filter(m => {
      if (categoryFilter !== 'ALL' && m.category.toUpperCase() !== categoryFilter.toUpperCase()) {
        return false;
      }
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const matchName = m.name.toLowerCase().includes(q);
      const matchCode = (m.material_code || '').toLowerCase().includes(q);
      const matchCat = m.category.toLowerCase().includes(q);
      return matchName || matchCode || matchCat;
    });
  }, [bomReport, categoryFilter, searchQuery]);

  // Grouped products by category
  const groupedProducts = useMemo(() => {
    if (!bomReport?.products) return {};
    const groups: Record<string, typeof bomReport.products> = {};
    bomReport.products.forEach(p => {
      const cat = p.category_name || bomReport.order?.category_name || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [bomReport]);

  const hasCustomBOM = useMemo(() => {
    if (!id) return false;
    return !!localStorage.getItem(`cheran_order_bom_${id}`);
  }, [id, bomReport]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-600 mb-3" />
        <p className="text-sm font-semibold text-slate-700">Calculating Material Requirements & BOM...</p>
        <p className="text-xs text-slate-400 mt-1">Cross-referencing buyer products and raw material components</p>
      </div>
    );
  }

  if (error || !bomReport?.order) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Failed to Load Requirement Details</h4>
            <p className="text-xs mt-1">{error || 'Order not found'}</p>
            <Button onClick={() => navigate('/production/requirement')} className="mt-3 text-xs">
              Back to Requirement Gathering
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const order = bomReport.order;
  const summary = bomReport.summary;

  return (
    <div className="flex flex-col h-full bg-slate-50/60 overflow-y-auto">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          {successToast}
        </div>
      )}

      {/* Header */}
      <PageHeader
        title={`Requirement Gathering: ${order.order_number}`}
        subtitle={`Detailed material planning & BOM calculator based on Buyer Master components`}
        breadcrumb={[
          { label: 'Production', href: '/production/orders' },
          { label: '01. Requirement Gathering', href: '/production/requirement' },
          { label: order.order_number },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate('/production/requirement')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              onClick={handleRecalculate}
              disabled={calculating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${calculating ? 'animate-spin' : ''}`} />
              <span>Recalculate BOM</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs print:hidden"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print Sheet</span>
            </button>

            <Button
              onClick={() => setMoveOpen(true)}
              icon={<ChevronRight className="w-3.5 h-3.5" />}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs"
            >
              Advance to 02. PO
            </Button>
          </div>
        }
      />

      <div className="p-3 sm:p-5 max-w-7xl mx-auto w-full flex flex-col gap-4">
        {/* Order Profile Banner Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Buyer & Order Details */}
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <BuyerAvatar
                buyer={{
                  id: order.customer_id,
                  code: order.customer_code,
                  name: order.customer_name,
                  avatar_style: order.customer_avatar_style,
                  avatar_seed: order.customer_avatar_seed,
                  avatar_config: order.customer_avatar_config,
                }}
                size="lg"
                shape="circle"
                className="shrink-0"
              />

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-base text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-lg border border-brand-200">
                    {order.order_number}
                  </span>
                  <h2 className="text-base font-bold text-slate-800">{order.customer_name || 'Direct Buyer'}</h2>
                  {order.customer_code && (
                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                      {order.customer_code}
                    </span>
                  )}
                  <StatusBadge status={order.priority || 'Medium'} />
                </div>

                <p className="text-xs font-medium text-slate-600 mt-1">{order.title}</p>

                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                  {order.target_delivery_date && (
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Delivery: <strong>{order.target_delivery_date}</strong>
                    </span>
                  )}
                  <span>
                    Total Order Quantity: <strong className="font-mono text-slate-800">{fmt(order.total_quantity)} pcs</strong>
                  </span>
                  <span>
                    Products: <strong className="text-slate-800">{bomReport.products.length} line items</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action: View Master Product Link */}
            <div className="flex items-center gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
              {order.customer_id && (
                <button
                  type="button"
                  onClick={() => navigate(`/masters/buyers/${order.customer_id}/products`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition font-semibold"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Buyer Product Master BOM</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 text-brand-500" />
                </button>
              )}
            </div>
          </div>
        </div>


        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('bom')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'bom'
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Total Material Requirement (BOM)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 ml-1">
                {summary.total_distinct_materials}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'products'
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Products Ordered ({bomReport.products.length})</span>
            </button>
          </div>

          {activeTab === 'bom' && (
            <div className="flex items-center gap-2">
              {summary.shortage_count > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/purchase/orders?create=true')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-2xs transition"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Create PO for Shortages ({summary.shortage_count})</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* TAB 1: TOTAL RAW MATERIAL REQUIREMENT (BOM) */}
        {activeTab === 'bom' && (
          <div className="flex flex-col gap-4">
            {/* Filter & Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {!isEditingBOM ? (
                <>
                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search material by name, code or category..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-2xs"
                      />
                    </div>

                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-2xs"
                    >
                      <option value="ALL">All Categories</option>
                      {availableCategories.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {hasCustomBOM && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded">
                        Customized BOM
                      </span>
                    )}

                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Pencil className="w-3.5 h-3.5 text-indigo-600" />}
                      onClick={handleStartEditBOM}
                      className="text-xs font-semibold"
                    >
                      Edit BOM
                    </Button>

                    {hasCustomBOM && (
                      <button
                        type="button"
                        onClick={handleResetBOM}
                        title="Reset to Buyer Master BOM"
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-indigo-800">
                    Editing Raw Material Requirements & Quantities
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Plus className="w-3.5 h-3.5 text-emerald-600" />}
                      onClick={handleAddMaterialRow}
                      className="text-xs font-semibold"
                    >
                      Add Material
                    </Button>
                    <Button
                      size="sm"
                      icon={<Save className="w-3.5 h-3.5" />}
                      onClick={handleSaveBOM}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                    >
                      Save BOM Changes
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<X className="w-3.5 h-3.5" />}
                      onClick={handleCancelEditBOM}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Total BOM Table (Edit or View Mode) */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              {isEditingBOM ? (
                <div className="overflow-x-auto p-2">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Material Name & Code</th>
                        <th className="py-2.5 px-3 w-36">Category</th>
                        <th className="py-2.5 px-3 w-28">UOM</th>
                        <th className="py-2.5 px-3 w-32 text-right">Required Qty</th>
                        <th className="py-2.5 px-3 w-32 text-right">Unit Rate (₹)</th>
                        <th className="py-2.5 px-3 w-32 text-right">Total Cost</th>
                        <th className="py-2.5 px-3 w-16 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editedMaterials.map((m, idx) => {
                        const rowCost = (Number(m.total_required_qty) || 0) * (Number(m.unit_cost) || 0);

                        return (
                          <tr key={idx} className="hover:bg-indigo-50/30 transition">
                            <td className="py-2 px-3 text-center font-mono text-slate-400 text-[11px]">
                              {idx + 1}
                            </td>

                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={m.name}
                                onChange={e => handleUpdateEditedRow(idx, 'name', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-brand-500"
                                placeholder="Material Name"
                              />
                              <input
                                type="text"
                                value={m.material_code || ''}
                                onChange={e => handleUpdateEditedRow(idx, 'material_code', e.target.value)}
                                className="w-full mt-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded font-mono text-[10px] text-slate-500"
                                placeholder="Code (optional)"
                              />
                            </td>

                            <td className="py-2 px-3">
                              <select
                                value={m.category}
                                onChange={e => handleUpdateEditedRow(idx, 'category', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-500"
                              >
                                <option value="Fabric">Fabric</option>
                                <option value="Thread">Thread</option>
                                <option value="Trims">Trims</option>
                                <option value="Elastic">Elastic</option>
                                <option value="Button">Button</option>
                                <option value="Zip">Zip</option>
                                <option value="Label">Label</option>
                                <option value="Packaging">Packaging</option>
                                <option value="General">General</option>
                              </select>
                            </td>

                            <td className="py-2 px-3">
                              <select
                                value={m.uom}
                                onChange={e => handleUpdateEditedRow(idx, 'uom', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-semibold text-slate-700"
                              >
                                <option value="MTR">MTR (Meters)</option>
                                <option value="KG">KG (Kilograms)</option>
                                <option value="PCS">PCS (Pieces)</option>
                                <option value="CONE">CONE (Cones)</option>
                                <option value="ROLL">ROLL (Rolls)</option>
                                <option value="SET">SET (Sets)</option>
                                <option value="BOX">BOX (Boxes)</option>
                                <option value="YDS">YDS (Yards)</option>
                              </select>
                            </td>

                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={m.total_required_qty}
                                onChange={e => handleUpdateEditedRow(idx, 'total_required_qty', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-right text-slate-900 focus:ring-1 focus:ring-brand-500"
                              />
                            </td>

                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={m.unit_cost}
                                onChange={e => handleUpdateEditedRow(idx, 'unit_cost', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-right text-slate-800 focus:ring-1 focus:ring-brand-500"
                              />
                            </td>

                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 text-xs">
                              {rowCost > 0 ? fmtCurrency(rowCost) : '—'}
                            </td>

                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteMaterialRow(idx)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                title="Delete row"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                        <th className="py-3 px-3 text-right">Total Req. Qty</th>
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

                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
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

            {/* Category-Based PO Issuance component */}
            <CategoryPOIssuer
              orderId={order.id}
              orderNumber={order.order_number}
              orderTitle={order.title}
              targetDeliveryDate={order.target_delivery_date}
              materials={bomReport?.total_materials || []}
              onPOCreated={(poNum) => {
                setSuccessToast(`Purchase Order ${poNum} created successfully!`);
                loadData();
              }}
            />
          </div>
        )}

        {/* TAB 2: PRODUCTS ORDERED BREAKDOWN */}
        {activeTab === 'products' && (
          <div className="flex flex-col gap-4">
            {Object.entries(groupedProducts).length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs shadow-2xs">
                No products ordered.
              </div>
            ) : (
              Object.entries(groupedProducts).map(([category, prods]) => {
                const catTotal = prods.reduce((sum, p) => sum + (p.total_quantity || 0), 0);

                return (
                  <div key={category} className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-brand-600" />
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                          Category: {category}
                        </h3>
                        <span className="text-[11px] text-slate-500 font-medium">
                          ({prods.length} {prods.length === 1 ? 'product line' : 'product lines'})
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                        {fmt(catTotal)} pcs total
                      </span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {prods.map(p => (
                        <div key={p.item_id} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/40">
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-2 pb-2 border-b border-slate-200">
                            <div>
                              <span className="font-bold text-slate-800 text-sm">{p.product_name}</span>
                              {p.product_code && (
                                <span className="font-mono text-xs text-slate-400 ml-2">({p.product_code})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-semibold text-slate-700">
                                Color: {p.color}
                              </span>
                              {p.size && (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-mono font-bold text-slate-700">
                                  Size: {p.size}
                                </span>
                              )}
                              <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200 text-xs">
                                {fmt(p.total_quantity)} pcs ordered
                              </span>
                            </div>
                          </div>

                          {/* Component list */}
                          {p.components && p.components.length > 0 ? (
                            <div className="overflow-x-auto mt-2">
                              <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200">
                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px]">
                                  <tr>
                                    <th className="py-2 px-2.5">Component Material</th>
                                    <th className="py-2 px-2">Category</th>
                                    <th className="py-2 px-2 text-right">Per Garment</th>
                                    <th className="py-2 px-2 text-right">Wastage %</th>
                                    <th className="py-2 px-2 text-right">Total for Line</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {p.components.map((c, idx) => (
                                    <tr key={idx}>
                                      <td className="py-2 px-2.5 font-medium text-slate-800">{c.name}</td>
                                      <td className="py-2 px-2 text-slate-600">{c.category}</td>
                                      <td className="py-2 px-2 text-right font-mono">{c.quantity_per_product} {c.uom}</td>
                                      <td className="py-2 px-2 text-right font-mono text-slate-500">{c.wastage_percent}%</td>
                                      <td className="py-2 px-2 text-right font-mono font-bold text-brand-700">
                                        {fmt(c.required_quantity, 2)} {c.uom}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No components configured for this product in Buyer Master.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Advance to Next Stage Modal */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={`Advance Order ${order.order_number} to Next Stage`}
        subtitle="Advance this entire order into the next production pipeline step (e.g. 02. Purchase Order)"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={savingMove}
              onClick={handleAdvanceStage}
              icon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Advance Order
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

          <div className="p-3 bg-brand-50 border border-brand-200 rounded-lg text-xs text-brand-900">
            <p className="font-semibold">
              Requirement Gathering Verified for {order.order_number}
            </p>
            <p className="text-[11px] text-brand-700 mt-1">
              Material list contains {summary.total_distinct_materials} materials across {fmt(order.total_quantity)} garments.
            </p>
          </div>

          <FormField
            as="select"
            label="Destination Stage"
            required
            value={selectedNextStageId}
            onChange={e => setSelectedNextStageId(e.target.value)}
          >
            {stages
              .filter(s => s.sequence_order > 1)
              .map(s => (
                <option key={s.id} value={s.id}>
                  {String(s.sequence_order).padStart(2, '0')}. {s.name}
                </option>
              ))}
          </FormField>

          <FormField
            as="textarea"
            label="Handover Notes / Verification Remarks"
            value={moveNotes}
            onChange={e => setMoveNotes(e.target.value)}
            rows={2}
          />
        </div>
      </Modal>
    </div>
  );
}
