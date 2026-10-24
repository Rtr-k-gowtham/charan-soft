import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStageBackNavigation } from '../../utils/navigation';
import { api } from '../../lib/api';
import { ProductionOrderBOMReport, OrderMaterialRequirementItem, ProductionStage, Supplier, Category } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import SearchableSelect, { SelectOption } from '../../components/ui/SearchableSelect';
import { getCategoryVisual } from '../masters/Categories';
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
  Building2,
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
  const handleBack = useStageBackNavigation('/production/requirement');

  const [bomReport, setBomReport] = useState<ProductionOrderBOMReport | null>(null);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [missingSuppliersList, setMissingSuppliersList] = useState<string[]>([]);
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

  // Move to PO Confirmation Modal State
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveNotes, setMoveNotes] = useState('Requirement verified and material BOM generated.');
  const [savingMove, setSavingMove] = useState(false);
  const [moveError, setMoveError] = useState('');

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [bomData, stgData, supData, catData] = await Promise.all([
        api.getOrderMaterialRequirements(id),
        api.getProductionStages().catch(() => []),
        api.getSuppliers().catch(() => []),
        api.getCategories().catch(() => []),
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
      setSuppliers((supData as Supplier[]) || []);
      setCategories((catData as Category[]) || []);
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
    if (!id) return;
    setCalculating(true);
    setError('');
    try {
      const bomData = await api.getOrderMaterialRequirements(id, true);
      const report = (bomData as any)?.data || (bomData as ProductionOrderBOMReport);

      // Persist generated BOM to backend (updates in-place without duplicate records)
      await api.saveOrderMaterialRequirements(id, report).catch(err => {
        console.warn('Backend saveOrderMaterialRequirements notice:', err);
      });

      // Clear any custom localStorage override
      try {
        localStorage.removeItem(`cheran_order_bom_${id}`);
      } catch (e) {}

      setBomReport(report);
      setSuccessToast('Material requirement BOM generated and persisted from Buyer Product Master!');
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
        size: '',
        model: '',
        length: '',
        thickness: '',
        total_required_qty: 100,
        current_stock: 0,
        shortage_qty: 100,
        unit_cost: 0,
        total_estimated_cost: 0,
        status: 'Needs Procurement',
        preferred_supplier_id: null,
        preferred_supplier_name: null,
        preferred_supplier_code: null,
      }
    ]);
  };

  const handleDeleteMaterialRow = (index: number) => {
    setEditedMaterials(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveBOM = async () => {
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

    const updatedSummary = {
      ...bomReport?.summary,
      total_distinct_materials: cleaned.length,
      total_estimated_cost: cleaned.reduce((sum, it) => sum + (it.total_estimated_cost || 0), 0),
    };

    const updatedReport = {
      ...bomReport!,
      total_materials: cleaned,
      summary: updatedSummary as any,
    };

    setBomReport(updatedReport);

    try {
      await api.saveOrderMaterialRequirements(id, updatedReport);
    } catch (e) {
      console.warn('Backend save material requirements error:', e);
    }

    setIsEditingBOM(false);
    setSuccessToast('Material Requirements (BOM) saved and persisted successfully!');
  };

  const handleResetBOM = async () => {
    if (!id) return;
    try {
      localStorage.removeItem(`cheran_order_bom_${id}`);
    } catch (e) {}
    await handleRecalculate();
    setSuccessToast('BOM reset to default Buyer Master components!');
  };

  const getSupplierOptionsForMaterial = (categoryName?: string): SelectOption[] => {
    const cleanCat = (categoryName || '').trim().toLowerCase();
    const matched: Supplier[] = [];
    const others: Supplier[] = [];
    suppliers.forEach(s => {
      const sCat = (s.category_name || '').trim().toLowerCase();
      if (cleanCat && (sCat === cleanCat || sCat.includes(cleanCat) || cleanCat.includes(sCat))) {
        matched.push(s);
      } else {
        others.push(s);
      }
    });

    const list = matched.length > 0 ? [...matched, ...others] : suppliers;
    return list.map(sup => ({
      value: String(sup.id),
      label: `${sup.name}${sup.code ? ` (${sup.code})` : ''}`,
      sublabel: [
        sup.category_name,
        sup.phone && sup.phone !== 'N/A' ? sup.phone : null,
        sup.contact_person || null
      ].filter(Boolean).join(' • '),
    }));
  };

  const handleAssignSupplier = async (originalIdx: number, supplierIdStr: string) => {
    if (!bomReport || !id) return;
    const supId = supplierIdStr ? Number(supplierIdStr) : null;
    const selectedSup = suppliers.find(s => String(s.id) === String(supplierIdStr));

    const updatedMaterials = [...bomReport.total_materials];
    const targetMat = updatedMaterials[originalIdx];
    if (!targetMat) return;

    updatedMaterials[originalIdx] = {
      ...targetMat,
      preferred_supplier_id: supId,
      preferred_supplier_name: selectedSup ? selectedSup.name : null,
      preferred_supplier_code: selectedSup ? (selectedSup.code || null) : null,
    };

    const updatedReport = {
      ...bomReport,
      total_materials: updatedMaterials,
    };

    setBomReport(updatedReport);

    if (missingSuppliersList.length > 0) {
      setMissingSuppliersList(prev => prev.filter(name => name !== targetMat.name));
    }

    try {
      localStorage.setItem(`cheran_order_bom_${id}`, JSON.stringify(updatedMaterials));
    } catch (e) {}

    try {
      await api.saveOrderMaterialRequirements(id, updatedReport);
      setSuccessToast(`Preferred Vendor saved for ${targetMat.name}`);
    } catch (e) {
      console.warn('Backend save supplier assignment notice:', e);
    }
  };

  // Validation: BOM must be generated and contain valid material requirements
  const isBOMValid = useMemo(() => {
    return Boolean(
      bomReport &&
      Array.isArray(bomReport.total_materials) &&
      bomReport.total_materials.length > 0 &&
      bomReport.total_materials.some(m => Number(m.total_required_qty) > 0)
    );
  }, [bomReport]);

  const handleOpenMoveModal = () => {
    if (!bomReport?.total_materials) return;
    const unassignedMats = bomReport.total_materials.filter(
      m => Number(m.total_required_qty || 0) > 0 && !m.preferred_supplier_id
    );
    if (unassignedMats.length > 0) {
      const names = Array.from(new Set(unassignedMats.map(m => m.name)));
      setMissingSuppliersList(names);
      setMoveError(
        `Mandatory Preferred Vendor assignment missing for ${names.length} material(s):\n• ` +
        names.join('\n• ')
      );
      setActiveTab('bom');
      setMoveOpen(true);
      return;
    }
    setMissingSuppliersList([]);
    setMoveError('');
    setMoveOpen(true);
  };

  const handleConfirmMoveToPO = async () => {
    if (!bomReport || !bomReport.order || !isBOMValid || savingMove) return;

    // Validate that every material needing procurement has a preferred supplier assigned
    const unassignedMats = (bomReport.total_materials || []).filter(
      m => Number(m.total_required_qty || 0) > 0 && !m.preferred_supplier_id
    );
    if (unassignedMats.length > 0) {
      const names = Array.from(new Set(unassignedMats.map(m => m.name)));
      setMissingSuppliersList(names);
      setMoveError(
        `Mandatory Preferred Vendor assignment missing for ${names.length} material(s):\n• ` +
        names.join('\n• ')
      );
      return;
    }

    setSavingMove(true);
    setMoveError('');
    try {
      const poStage = stages.find(s => s.code === 'PO' || s.sequence_order === 2) || { id: 2, name: 'Purchase Order (PO)' };
      const destId = Number(poStage.id || 2);

      // 1. Ensure BOM is persisted to backend
      try {
        await api.saveOrderMaterialRequirements(bomReport.order.id, bomReport);
      } catch (saveErr) {
        console.warn('Auto-save BOM notice:', saveErr);
      }

      // 2. Call existing stage transition API for the production order and all its items
      const items: Array<{ id: number; total_quantity?: number; current_stage_quantity?: number }> =
        bomReport.order.items && bomReport.order.items.length > 0
          ? (bomReport.order.items as any)
          : (bomReport.products && bomReport.products.length > 0)
          ? bomReport.products.map(p => ({
              id: p.item_id,
              total_quantity: p.total_quantity,
              current_stage_quantity: p.total_quantity,
            }))
          : [];

      if (items.length > 0) {
        await Promise.all(
          items.map(it =>
            api.moveStage({
              production_order_id: bomReport.order.id,
              order_item_id: it.id,
              to_stage_id: destId,
              quantity_moved: it.total_quantity || it.current_stage_quantity || 1,
              remarks: moveNotes || 'Moved from Stage 01: Requirement Gathering to Stage 02: PO',
            })
          )
        );
      } else {
        await api.moveStage({
          production_order_id: bomReport.order.id,
          to_stage_id: destId,
          quantity_moved: bomReport.order.total_quantity || 1,
          remarks: moveNotes || 'Moved from Stage 01: Requirement Gathering to Stage 02: PO',
        });
      }

      setMoveOpen(false);
      setSuccessToast(`Production Order ${bomReport.order.order_number} moved to Stage 02: Purchase Order successfully!`);
      navigate(`/production/po/${bomReport.order.id}`);
    } catch (err: unknown) {
      setMoveError((err as Error).message || 'Failed to move production order to PO stage');
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
    return bomReport.total_materials
      .map((m, idx) => ({ ...m, _originalIndex: idx }))
      .filter(m => {
        if (categoryFilter !== 'ALL' && m.category.toUpperCase() !== categoryFilter.toUpperCase()) {
          return false;
        }
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const matchName = m.name.toLowerCase().includes(q);
        const matchCode = (m.material_code || '').toLowerCase().includes(q);
        const matchCat = m.category.toLowerCase().includes(q);
        const matchSup = (m.preferred_supplier_name || '').toLowerCase().includes(q);
        return matchName || matchCode || matchCat || matchSup;
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
            <Button onClick={handleBack} className="mt-3 text-xs">
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
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <Button
              onClick={handleRecalculate}
              loading={calculating}
              icon={<Sparkles className="w-3.5 h-3.5" />}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs px-3 py-1.5"
            >
              Generate BOM
            </Button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs print:hidden"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print Sheet</span>
            </button>
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
        </div>

        {/* TAB 1: TOTAL RAW MATERIAL REQUIREMENT (BOM) */}
        {activeTab === 'bom' && (
          <div className="flex flex-col gap-4">
            {/* Filter & Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {!isEditingBOM ? (
                <>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 w-full sm:max-w-md">
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
                        <th className="py-2.5 px-3 min-w-[180px]">Material Name & Code</th>
                        <th className="py-2.5 px-3 w-32">Category</th>
                        <th className="py-2.5 px-3 w-24">UOM</th>
                        <th className="py-2.5 px-2 w-20">Size</th>
                        <th className="py-2.5 px-2 w-24">Model</th>
                        <th className="py-2.5 px-2 w-20">Length</th>
                        <th className="py-2.5 px-2 w-24">Thickness</th>
                        <th className="py-2.5 px-3 min-w-[170px]">Preferred Vendor</th>
                        <th className="py-2.5 px-3 w-28 text-right">Required Qty</th>
                        <th className="py-2.5 px-3 w-28 text-right">Unit Rate (₹)</th>
                        <th className="py-2.5 px-3 w-28 text-right">Total Cost</th>
                        <th className="py-2.5 px-3 w-14 text-center">Action</th>
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

                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={m.size || ''}
                                onChange={e => handleUpdateEditedRow(idx, 'size', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-slate-800 focus:ring-1 focus:ring-brand-500"
                                placeholder="Size"
                              />
                            </td>

                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={m.model || ''}
                                onChange={e => handleUpdateEditedRow(idx, 'model', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:ring-1 focus:ring-brand-500"
                                placeholder="Model"
                              />
                            </td>

                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={m.length || ''}
                                onChange={e => handleUpdateEditedRow(idx, 'length', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:ring-1 focus:ring-brand-500"
                                placeholder="Length"
                              />
                            </td>

                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={m.thickness || ''}
                                onChange={e => handleUpdateEditedRow(idx, 'thickness', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:ring-1 focus:ring-brand-500"
                                placeholder="Thickness"
                              />
                            </td>

                            <td className="py-2 px-3">
                              <select
                                value={m.preferred_supplier_id ? String(m.preferred_supplier_id) : ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  const curSup = suppliers.find(s => String(s.id) === String(val));
                                  handleUpdateEditedRow(idx, 'preferred_supplier_id', val ? Number(val) : null);
                                  handleUpdateEditedRow(idx, 'preferred_supplier_name', curSup ? curSup.name : null);
                                  handleUpdateEditedRow(idx, 'preferred_supplier_code', curSup ? (curSup.code || null) : null);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:ring-1 focus:ring-brand-500"
                              >
                                <option value="">-- Select Vendor --</option>
                                {suppliers.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} {s.code ? `(${s.code})` : ''}
                                  </option>
                                ))}
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
                <>
                  <div className="hidden md:block overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse table-fixed">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-1.5 w-[32px] text-center">#</th>
                          <th className="py-2.5 px-2 min-w-[130px]">Raw Material</th>
                          <th className="py-2.5 px-2 w-[130px]">Category</th>
                          <th className="py-2.5 px-1 w-[46px] text-center">UOM</th>
                          <th className="py-2.5 px-1 w-[48px] text-center">Size</th>
                          <th className="py-2.5 px-1 w-[52px] text-center">Model</th>
                          <th className="py-2.5 px-1 w-[48px] text-center">Length</th>
                          <th className="py-2.5 px-1 w-[54px] text-center">Thick</th>
                          <th className="py-2.5 px-2 w-[85px] text-right">Req. Qty</th>
                          <th className="py-2.5 px-1.5 w-[65px] text-right">Rate</th>
                          <th className="py-2.5 px-2 w-[82px] text-right">Total Cost</th>
                          <th className="py-2.5 px-2 w-[185px]">Preferred Vendor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMaterials.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="py-10 text-center text-slate-400">
                              <Sparkles className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                              <p className="font-semibold text-xs text-slate-600">No material requirements to display</p>
                              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                                {categoryFilter !== 'ALL' || searchQuery
                                  ? 'No materials match the current filter. Try clearing your search.'
                                  : 'Click "Generate BOM" in the header above to calculate material requirements from Buyer Product Master.'}
                              </p>
                            </td>
                          </tr>
                        ) : (
                          filteredMaterials.map((m, idx) => {
                            const isMissingSup = missingSuppliersList.includes(m.name);
                            const catObj = categories.find(
                              c => c.name.trim().toLowerCase() === (m.category || '').trim().toLowerCase()
                            );
                            const visual = getCategoryVisual(catObj || { name: m.category });
                            const CatIcon = visual.Icon;

                            return (
                              <tr 
                                key={m.material_id ? `id_${m.material_id}_${idx}` : `name_${m.name}_${idx}`} 
                                className={`transition ${isMissingSup ? 'bg-amber-50/70 border-l-4 border-l-amber-500' : 'hover:bg-slate-50/70'}`}
                              >
                                <td className="py-2.5 px-1.5 text-center font-mono text-slate-400 text-[11px] align-middle">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-2 font-medium text-slate-800 align-middle">
                                  <span className="font-bold text-slate-800 block truncate" title={m.name}>{m.name}</span>
                                  {m.material_code && (
                                    <span className="font-mono text-[10px] text-slate-400 block truncate" title={m.material_code}>{m.material_code}</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-2 align-middle">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${visual.bg} ${visual.border} ${visual.color} shadow-2xs max-w-full truncate`}
                                    title={m.category}
                                  >
                                    <CatIcon className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{m.category}</span>
                                  </span>
                                </td>

                                <td className="py-2.5 px-1 text-center font-mono text-slate-600 font-semibold text-[11px] align-middle">{m.uom}</td>

                                <td className="py-2.5 px-1 text-center text-slate-700 font-mono text-[11px] truncate align-middle" title={m.size || undefined}>
                                  {m.size || <span className="text-slate-300 font-sans">—</span>}
                                </td>

                                <td className="py-2.5 px-1 text-center text-slate-700 text-[11px] truncate align-middle" title={m.model || undefined}>
                                  {m.model || <span className="text-slate-300 font-sans">—</span>}
                                </td>

                                <td className="py-2.5 px-1 text-center text-slate-700 text-[11px] truncate align-middle" title={m.length || undefined}>
                                  {m.length || <span className="text-slate-300 font-sans">—</span>}
                                </td>

                                <td className="py-2.5 px-1 text-center text-slate-700 text-[11px] truncate align-middle" title={m.thickness || undefined}>
                                  {m.thickness || <span className="text-slate-300 font-sans">—</span>}
                                </td>

                                <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-800 text-[11px] whitespace-nowrap align-middle">
                                  {fmt(m.total_required_qty, 2)}
                                </td>

                                <td className="py-2.5 px-1.5 text-right font-mono text-slate-600 text-[11px] whitespace-nowrap align-middle">
                                  {m.unit_cost > 0 ? fmtCurrency(m.unit_cost) : '—'}
                                </td>

                                <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-800 text-[11px] whitespace-nowrap align-middle">
                                  {m.total_estimated_cost > 0 ? fmtCurrency(m.total_estimated_cost) : '—'}
                                </td>

                                {/* Preferred Vendor Selection Column */}
                                <td className="py-2 px-2 align-middle">
                                  <div className="w-full">
                                    <SearchableSelect
                                      value={m.preferred_supplier_id ? String(m.preferred_supplier_id) : ''}
                                      onChange={val => handleAssignSupplier(m._originalIndex ?? idx, val)}
                                      options={getSupplierOptionsForMaterial(m.category)}
                                      placeholder="-- Select Vendor --"
                                      searchPlaceholder="Search vendor..."
                                      clearable={true}
                                    />
                                    {!m.preferred_supplier_id && (Number(m.total_required_qty) > 0) && (
                                      <span className="text-[9px] font-bold text-amber-600 flex items-center gap-1 mt-0.5 truncate" title="Vendor selection required">
                                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                        <span className="truncate">Vendor required</span>
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards for BOM */}
                  <div className="md:hidden space-y-3 p-3">
                    {filteredMaterials.length === 0 ? (
                      <div className="py-8 text-center text-slate-400">
                        <Sparkles className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-xs text-slate-600">No material requirements to display</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {categoryFilter !== 'ALL' || searchQuery
                            ? 'No materials match the current filter.'
                            : 'Click "Generate BOM" in header above.'}
                        </p>
                      </div>
                    ) : (
                      filteredMaterials.map((m, idx) => {
                        const isMissingSup = missingSuppliersList.includes(m.name);

                        return (
                          <div
                            key={m.material_id ? `mob_id_${m.material_id}_${idx}` : `mob_name_${m.name}_${idx}`}
                            className={`bg-white border rounded-xl p-3 shadow-xs space-y-2.5 ${
                              isMissingSup ? 'border-amber-400 bg-amber-50/30 ring-1 ring-amber-300' : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                                  <h4 className="font-bold text-slate-900 text-xs break-words">{m.name}</h4>
                                </div>
                                {m.material_code && (
                                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                    {m.material_code}
                                  </span>
                                )}
                              </div>
                              {(() => {
                                const catObj = categories.find(
                                  c => c.name.trim().toLowerCase() === (m.category || '').trim().toLowerCase()
                                );
                                const visual = getCategoryVisual(catObj || { name: m.category });
                                const CatIcon = visual.Icon;
                                return (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${visual.bg} ${visual.border} ${visual.color} shadow-2xs shrink-0 max-w-[130px] truncate`}
                                    title={m.category}
                                  >
                                    <CatIcon className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{m.category}</span>
                                  </span>
                                );
                              })()}
                            </div>

                            {(m.size || m.model || m.length || m.thickness) && (
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-600 bg-slate-50 px-2 py-1 rounded">
                                {m.size && <span>Size: <strong className="font-mono">{m.size}</strong></span>}
                                {m.model && <span>• Model: <strong>{m.model}</strong></span>}
                                {m.length && <span>• Len: <strong>{m.length}</strong></span>}
                                {m.thickness && <span>• Thk: <strong>{m.thickness}</strong></span>}
                              </div>
                            )}

                            <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Req. Qty</span>
                                <span className="font-mono font-bold text-slate-900 text-xs">
                                  {fmt(m.total_required_qty, 2)}{' '}
                                  <span className="text-[10px] font-normal text-slate-500">{m.uom}</span>
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Rate</span>
                                <span className="font-mono text-slate-700 text-xs">
                                  {m.unit_cost > 0 ? fmtCurrency(m.unit_cost) : '—'}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Cost</span>
                                <span className="font-mono font-bold text-emerald-700 text-xs">
                                  {m.total_estimated_cost > 0 ? fmtCurrency(m.total_estimated_cost) : '—'}
                                </span>
                              </div>
                            </div>

                            {/* Mobile Preferred Vendor selector */}
                            <div className="pt-2 border-t border-slate-100">
                              <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center justify-between">
                                <span>Preferred Vendor</span>
                                {m.preferred_supplier_name && (
                                  <span className="text-emerald-700 text-[10px] font-semibold">Assigned</span>
                                )}
                              </label>
                              <SearchableSelect
                                value={m.preferred_supplier_id ? String(m.preferred_supplier_id) : ''}
                                onChange={val => handleAssignSupplier(m._originalIndex ?? idx, val)}
                                options={getSupplierOptionsForMaterial(m.category)}
                                placeholder="-- Select Vendor --"
                                searchPlaceholder="Search vendor..."
                                clearable={true}
                              />
                              {!m.preferred_supplier_id && (Number(m.total_required_qty) > 0) && (
                                <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                  Vendor selection required
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
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
                                    <th className="py-2 px-2">Size</th>
                                    <th className="py-2 px-2">Model</th>
                                    <th className="py-2 px-2">Length</th>
                                    <th className="py-2 px-2">Thickness</th>
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
                                      <td className="py-2 px-2 font-mono text-slate-700">{c.size || '—'}</td>
                                      <td className="py-2 px-2 text-slate-700">{c.model || '—'}</td>
                                      <td className="py-2 px-2 text-slate-700">{c.length || '—'}</td>
                                      <td className="py-2 px-2 text-slate-700">{c.thickness || '—'}</td>
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
        {/* Bottom Stage Transition Action Area — Move to PO */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isBOMValid ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}>
              {isBOMValid ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800">
                  {isBOMValid ? 'Material Requirements (BOM) Ready' : 'BOM Generation Required'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isBOMValid ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {isBOMValid ? `${bomReport.total_materials.length} Materials Computed` : 'Pending Generation'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isBOMValid
                  ? 'All buyer product material requirements verified. Click "Move to PO" to advance this order to Stage 02: Purchase Order.'
                  : 'Please click "Generate BOM" in the header above to calculate buyer product master materials before advancing.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end w-full sm:w-auto shrink-0">
            <Button
              onClick={handleOpenMoveModal}
              disabled={!isBOMValid || savingMove}
              loading={savingMove}
              icon={<ChevronRight className="w-4 h-4" />}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs px-5 py-2.5 w-full sm:w-auto"
            >
              Move to PO
            </Button>
          </div>
        </div>
      </div>

      {/* Move to PO Confirmation Modal */}
      <Modal
        open={moveOpen}
        onClose={() => !savingMove && setMoveOpen(false)}
        title="Move to Purchase Order (PO) Stage"
        subtitle={`Confirm stage transition for Production Order ${order.order_number}`}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="secondary"
              onClick={() => setMoveOpen(false)}
              disabled={savingMove}
            >
              Cancel
            </Button>
            <Button
              loading={savingMove}
              disabled={!isBOMValid || savingMove || missingSuppliersList.length > 0}
              onClick={handleConfirmMoveToPO}
              icon={<ChevronRight className="w-4 h-4" />}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold"
            >
              Move to PO
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3.5">
          {missingSuppliersList.length > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex flex-col gap-2 shadow-2xs">
              <div className="flex items-center gap-2 text-amber-800 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Preferred Vendor Assignment Required ({missingSuppliersList.length} items)</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Before advancing to Stage 02, please select a Preferred Vendor for each required material in the BOM table:
              </p>
              <div className="bg-white/90 rounded-lg p-2.5 border border-amber-200">
                <div className="flex flex-wrap gap-1.5">
                  {missingSuppliersList.map(name => (
                    <span key={name} className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded text-[11px] border border-amber-300">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-amber-700 font-medium">
                Close this modal to assign vendors from the dropdown, then click "Move to PO" again.
              </p>
            </div>
          )}

          {moveError && !missingSuppliersList.length && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-bold">Stage Transition Failed</p>
                <p className="text-[11px] mt-0.5">{moveError}</p>
                <p className="text-[10px] text-red-500 mt-1">The order remains safely in Stage 01: Requirement Gathering.</p>
              </div>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Production Order:</span>
              <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {order.order_number}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Buyer:</span>
              <span className="font-semibold text-slate-800">{order.customer_name || 'Direct Buyer'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Total Order Quantity:</span>
              <span className="font-mono font-bold text-slate-800">{fmt(order.total_quantity)} garments</span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-slate-200/80 pt-2">
              <span className="text-slate-500 font-medium">Verified BOM Materials:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {bomReport?.total_materials?.length || 0} distinct items
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Est. Material Cost:</span>
              <span className="font-mono font-bold text-slate-800">
                {fmtCurrency(summary?.total_estimated_cost || 0)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <p className="font-bold text-amber-800">Stage Transition Note</p>
              <p className="mt-0.5 text-amber-700">
                Are you sure you want to move this production order to <strong>Stage 02: PO (Purchase Order)</strong>?
                This will make the order and its generated BOM requirements available in the PO Stage for category-wise supplier quotation and PO issuance.
              </p>
              <p className="mt-1 text-amber-600 font-medium">
                • Purchase orders will not be issued automatically.
                <br />
                • Supplier selection and PO issuance remain separate actions in Stage 02.
              </p>
            </div>
          </div>

          <FormField
            as="textarea"
            label="Handover Notes / Verification Remarks (Optional)"
            value={moveNotes}
            onChange={e => setMoveNotes(e.target.value)}
            rows={2}
            placeholder="e.g. BOM verified against Buyer master specs; ready for procurement."
          />
        </div>
      </Modal>
    </div>
  );
}
