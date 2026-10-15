import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionOrderBOMReport, ProductionStage, PurchaseOrder } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import CategoryPOIssuer from '../../components/production/CategoryPOIssuer';
import {
  ArrowLeft,
  ShoppingCart,
  RefreshCw,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  DollarSign,
  AlertCircle,
  Scissors,
  CheckCheck,
  Building2,
  FileText,
  Send,
  Boxes,
  ExternalLink
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

export default function POOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [bomReport, setBomReport] = useState<ProductionOrderBOMReport | null>(null);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [existingPOs, setExistingPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Accordion for viewing product lines and BOM
  const [showProducts, setShowProducts] = useState(false);
  const [showBOM, setShowBOM] = useState(false);

  // Advance to Inward Stage Modal
  const [moveOpen, setMoveOpen] = useState(false);
  const [selectedNextStageId, setSelectedNextStageId] = useState('3');
  const [moveNotes, setMoveNotes] = useState('Purchase Orders issued and ready for material inward.');
  const [savingMove, setSavingMove] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [orderRes, bomData, stgData, poRes] = await Promise.all([
        api.getProductionOrder(Number(id)),
        api.getOrderMaterialRequirements(id).catch(() => null),
        api.getProductionStages().catch(() => []),
        api.getPurchaseOrders().catch(() => []),
      ]);

      const ord = (orderRes as any)?.data || orderRes;
      setOrder(ord);

      if (bomData) {
        const report = (bomData as any)?.data || (bomData as ProductionOrderBOMReport);
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
      }

      setStages((stgData || []) as ProductionStage[]);

      const allPOs = (poRes || []) as PurchaseOrder[];
      const ordNum = ord?.order_number || '';
      const related = allPOs.filter(po => {
        if (po.production_order_id && String(po.production_order_id) === String(id)) return true;
        if (po.production_order_number && po.production_order_number === ordNum) return true;
        if (po.remarks && ordNum && po.remarks.includes(ordNum)) return true;
        if (Array.isArray(po.items) && ordNum && po.items.some((it: any) => it.order_no === ordNum)) return true;
        return false;
      });
      setExistingPOs(related);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load project PO stage details');
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

  const handleAdvanceToNextStage = async () => {
    if (!order || !order.items || order.items.length === 0) return;
    setSavingMove(true);
    try {
      await Promise.all(
        order.items.map(it =>
          api.moveStage({
            order_item_id: it.id,
            to_stage_id: Number(selectedNextStageId),
            quantity_moved: it.total_quantity || it.current_stage_quantity || 1,
            remarks: moveNotes || 'Purchase Orders verified, advancing to Inward stage',
          })
        )
      );
      setSuccessToast(`Order ${order.order_number} successfully advanced to Stage 03: Inward!`);
      setMoveOpen(false);
      navigate(`/production/inward/${order.id}`);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to advance order stage');
    } finally {
      setSavingMove(false);
    }
  };

  const totalGarments = order?.items?.reduce((sum, it) => sum + (it.total_quantity || 0), 0) || 0;
  const draftPOs = existingPOs.filter(p => (p.status || '').toLowerCase() === 'draft');
  const issuedPOs = existingPOs.filter(p => (p.status || '').toLowerCase() !== 'draft');
  const totalPOAmount = existingPOs.reduce((sum, p) => sum + Number(p.net_amount || 0), 0);

  const inwardStage = stages.find(s => s.code === 'INW' || s.name.toLowerCase().includes('inward')) || {
    id: 3,
    name: 'Inward',
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-600 mb-3" />
        <p className="text-xs font-semibold">Loading Stage 02: Purchase Order Workspace...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 m-4">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-800">Order Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">Unable to locate production order #{id}.</p>
        <Button onClick={() => navigate('/production/po')} className="mt-4 text-xs">
          Return to PO Stage
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title={`Stage 02: Purchase Orders — ${order.order_number}`}
        subtitle={`Order Title: ${order.title || 'Garment Production Order'} • Buyer: ${order.customer_name || 'Direct Buyer'}`}
        breadcrumb={[
          { label: 'Production', href: '/production/orders' },
          { label: '02. PO Stage', href: '/production/po' },
          { label: order.order_number },
        ]}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => navigate('/production/po')}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Back to PO Stage</span>
              <span className="inline sm:hidden">Back</span>
            </button>

            <button
              onClick={loadData}
              title="Refresh POs"
              className="p-1.5 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <Button
              icon={<ChevronRight className="w-4 h-4 stroke-[2.5]" />}
              onClick={() => setMoveOpen(true)}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs whitespace-nowrap"
            >
              <span className="hidden sm:inline">Advance to Stage 03: Inward</span>
              <span className="inline sm:hidden">To Inward</span>
            </Button>
          </div>
        }
      />

      {/* 10-Stage Pipeline Stepper */}
      <div className="px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll scrollbar-none pb-1">
          {stages.map((s, idx) => {
            const isCurrent = s.code === 'PO' || s.name.toLowerCase().includes('purchase order');
            return (
              <React.Fragment key={s.id || s.code}>
                <button
                  type="button"
                  onClick={() => navigate(`/production/${s.code.toLowerCase()}`)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition cursor-pointer border min-h-[30px] ${
                    isCurrent
                      ? 'bg-indigo-600 text-white border-transparent shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
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

      <div className="p-4 sm:p-5 max-w-7xl mx-auto w-full space-y-4">
        {/* Project Master Info Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
                <span className="font-mono font-bold text-sm text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                  {order.order_number}
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {order.customer_name || 'Direct Buyer'}
                </span>
                {order.customer_code && (
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {order.customer_code}
                  </span>
                )}
                <StatusBadge status={order.priority || 'Medium'} />
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Current Stage: 02. Purchase Order (PO)
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600 truncate mt-1">
                {order.title || 'Production Order'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs shrink-0 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0 w-full md:w-auto justify-between md:justify-end">
            <div>
              <span className="text-[10px] text-slate-400 block font-medium uppercase">Target Delivery</span>
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {order.target_delivery_date || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium uppercase">Order Quantity</span>
              <span className="font-mono font-bold text-sm text-brand-700">
                {fmt(totalGarments)} <span className="text-xs font-normal text-slate-500">pcs</span>
              </span>
            </div>
          </div>
        </div>

        {/* 4 PO Workspace KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total POs</p>
              <p className="text-lg font-bold text-slate-800 mt-0.5">
                {existingPOs.length}{' '}
                <span className="text-xs font-normal text-slate-400">
                  ({issuedPOs.length} Issued • {draftPOs.length} Draft)
                </span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total PO Committed</p>
              <p className="text-lg font-bold text-emerald-600 mt-0.5">
                {fmtCurrency(totalPOAmount)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Raw Material Items</p>
              <p className="text-lg font-bold text-slate-800 mt-0.5">
                {bomReport?.total_materials?.length || 0}{' '}
                <span className="text-xs font-normal text-slate-400">components</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Next Stage</p>
              <p className="text-xs font-bold text-brand-700 mt-1 truncate">
                03. Inward Stage
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* MAIN STAGE WORKSPACE: All POs, In-Stage PO Editor, Direct Issuance & Category PO Generator */}
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

        {/* Collapsible Section: Products Ordered & Master BOM Reference */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div
            onClick={() => setShowProducts(!showProducts)}
            className="p-3.5 px-4 bg-slate-50/80 hover:bg-slate-100/80 cursor-pointer flex items-center justify-between transition"
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Products in this Project ({order.items?.length || 0} line items)
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 text-xs font-medium">
              <span>{showProducts ? 'Hide Details' : 'View Products'}</span>
              {showProducts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {showProducts && (
            <div className="p-4 border-t border-slate-100 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Product Name & Code</th>
                    <th className="py-2.5 px-3">Color</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3 text-right">Order Qty</th>
                    <th className="py-2.5 px-3 text-right">At This Stage</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(order.items || []).map(it => (
                    <tr key={it.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {it.product_name || 'Garment Product'}
                        {it.product_code && (
                          <span className="text-[10px] font-mono text-slate-400 block">
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
                        {it.size || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                        {fmt(it.total_quantity)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-700">
                        {fmt(it.current_stage_quantity || it.total_quantity)} pcs
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <StatusBadge status={it.status || 'In Progress'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Advance to Inward Modal */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title="Advance Order to Stage 03: Inward"
        subtitle={`All ${order.items?.length || 0} products in Order ${order.order_number} will move to the next stage.`}
      >
        <div className="space-y-4">
          <FormField label="Next Production Stage" required>
            <select
              value={selectedNextStageId}
              onChange={e => setSelectedNextStageId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-brand-500"
            >
              {stages
                .filter(s => s.code !== 'PO' && s.code !== 'REQ')
                .map(s => (
                  <option key={s.id} value={s.id}>
                    Step {String(s.sequence_order).padStart(2, '0')}: {s.name}
                  </option>
                ))}
            </select>
          </FormField>

          <FormField label="Transfer Notes & Inward Instructions">
            <textarea
              rows={3}
              value={moveNotes}
              onChange={e => setMoveNotes(e.target.value)}
              placeholder="e.g. POs issued, fabrics arriving tomorrow, ready for inward verification."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-brand-500"
            />
          </FormField>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setMoveOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <Button
              onClick={handleAdvanceToNextStage}
              loading={savingMove}
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs"
            >
              Confirm & Advance
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
