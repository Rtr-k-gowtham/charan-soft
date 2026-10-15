// src/pages/production/ProductionOrderDetail.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionOrderItem, ProductionStage } from '../../types';
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
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  FileText,
  User,
  Hash,
} from 'lucide-react';

export default function ProductionOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  // Handle QC Inspect
  const handleQC = async () => {
    if (!selectedItem || qcForm.input_quantity <= 0) {
      setQcError('Please enter a valid input quantity.');
      return;
    }
    const sum = qcForm.passed_quantity + qcForm.rejected_quantity + qcForm.rework_quantity;
    if (sum > qcForm.input_quantity) {
      setQcError('Sum of Passed, Rejected, and Rework quantities cannot exceed Input quantity.');
      return;
    }
    setSavingQC(true);
    setQcError('');
    try {
      await api.recordQC({
        order_item_id: selectedItem.id,
        input_quantity: qcForm.input_quantity,
        passed_quantity: qcForm.passed_quantity,
        rejected_quantity: qcForm.rejected_quantity,
        rework_quantity: qcForm.rework_quantity,
        defect_reason: qcForm.defect_reason,
        remarks: qcForm.remarks,
        rework_stage_id: Number(qcForm.rework_stage_id) || 5,
      });
      setQcOpen(false);
      loadData();
    } catch (e: unknown) {
      setQcError((e as Error).message || 'Failed to record QC inspection');
    } finally {
      setSavingQC(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
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
    <div className="flex flex-col h-full overflow-y-auto">
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
              Back to Production Orders
            </Button>
            <button
              onClick={loadData}
              className="p-2 text-slate-500 hover:text-brand-600 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              title="Refresh Order"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
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
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Total Order Qty
            </span>
            <span className="text-xl font-bold font-mono text-slate-900">{totalQty.toLocaleString()}</span>
            <span className="text-[11px] text-slate-500 ml-1">pcs</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Completed Units
            </span>
            <span className="text-xl font-bold font-mono text-emerald-600">{completedQty.toLocaleString()}</span>
            <span className="text-[11px] text-slate-500 ml-1">pcs</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Pending Remaining
            </span>
            <span className="text-xl font-bold font-mono text-amber-600">{pendingQty.toLocaleString()}</span>
            <span className="text-[11px] text-slate-500 ml-1">pcs</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
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

        {/* Section 1.5: Production Workflow Pipeline */}
        {stages.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-600" />
                Standard Production Workflow Pipeline
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">
                Installation → Dyeing → Detailing → Cutting → Stitching → QC → Rework → Completed
              </span>
            </div>
            <div className="overflow-x-auto touch-scroll scrollbar-none pb-1">
              <div className="flex items-center min-w-[720px] gap-2">
                {[...stages]
                  .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0))
                  .map((st, index, arr) => {
                    const countAtStage = items
                      .filter((it) => it.current_stage_id === st.id)
                      .reduce((acc, it) => acc + (it.current_stage_quantity || 0), 0);
                    const hasItems = countAtStage > 0;
                    return (
                      <React.Fragment key={st.id}>
                        <div
                          className={`flex-1 min-w-[85px] p-2.5 rounded-lg border text-center transition-all ${
                            hasItems
                              ? 'bg-blue-50/70 border-brand-300 ring-2 ring-brand-400/20'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <span className="text-[10px] font-mono text-slate-400 block font-bold mb-0.5">
                            Stage {st.sequence_order || index + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 block truncate" title={st.name}>
                            {st.name}
                          </span>
                          {hasItems ? (
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-brand-600 text-white rounded text-[10px] font-mono font-bold">
                              {countAtStage.toLocaleString()} pcs
                            </span>
                          ) : (
                            <span className="inline-block mt-1 text-[10px] text-slate-400 font-mono">—</span>
                          )}
                        </div>
                        {index < arr.length - 1 && (
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        )}
                      </React.Fragment>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

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

          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
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

        {/* Section 3: Product Lines & Stage Tracking Table */}
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
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-mono font-bold mt-0.5">
                                  {pantone}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-center">
                          {item.size ? (
                            <span className="inline-block px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-slate-700 text-[11px]">
                              {item.size}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          )}
                        </td>

                        <td className="px-3 py-3 text-right font-mono font-bold text-slate-800">
                          {itTotal}
                        </td>

                        <td className="px-3 py-3 text-right font-mono font-bold text-emerald-600">
                          {itDone}
                        </td>

                        <td className="px-3 py-3 text-right font-mono font-bold text-amber-600">
                          {itPending}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold text-white shadow-2xs whitespace-nowrap"
                            style={{ backgroundColor: item.color_badge || '#0284c7' }}
                          >
                            {item.current_stage_name || 'Installation'}
                            <span className="ml-1 opacity-80 text-[10px]">
                              ({item.current_stage_quantity || 0})
                            </span>
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${itPct === 100 ? 'bg-emerald-500' : 'bg-brand-600'}`}
                                style={{ width: `${itPct}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono font-bold text-slate-600 w-8 text-right">
                              {itPct}%
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setMoveForm({
                                  to_stage_id: '',
                                  quantity_moved: item.current_stage_quantity || 1,
                                  remarks: '',
                                });
                                setMoveError('');
                                setMoveOpen(true);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-md border border-brand-200 transition-colors flex items-center gap-1"
                              title="Advance production stage"
                            >
                              <span>Move</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>

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
                                setQcError('');
                                setQcOpen(true);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-200 transition-colors flex items-center gap-1"
                              title="Record QC inspection"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>QC</span>
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

        {/* Section 4: Workflow Stage Pipeline Reference */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Standard Textile Manufacturing Pipeline
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold text-slate-600">
            {stages.map((stg, i) => (
              <React.Fragment key={stg.id}>
                <span
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold text-white shadow-2xs whitespace-nowrap"
                  style={{ backgroundColor: stg.color_badge || '#64748b' }}
                >
                  {stg.sequence_order}. {stg.name}
                </span>
                {i < stages.length - 1 && <span className="text-slate-300 font-bold">→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
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
            <Button loading={savingMove} onClick={handleMove} icon={<ArrowRight className="w-3.5 h-3.5" />}>
              Move
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {moveError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {moveError}
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
            <option value="">— Select Destination Stage —</option>
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
            <Button loading={savingQC} onClick={handleQC}>
              Save QC Record
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {qcError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {qcError}
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
            placeholder="e.g. Stitch skip, uneven dyeing, size tolerance"
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
