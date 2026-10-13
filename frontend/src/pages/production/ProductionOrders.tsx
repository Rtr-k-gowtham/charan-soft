// src/pages/production/ProductionOrders.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, ProductionOrderItem } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import {
  Plus,
  Eye,
  ArrowRight,
  RefreshCw,
  Calendar,
  User,
  ShieldCheck,
  Package,
} from 'lucide-react';

export default function ProductionOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [moveOpen, setMoveOpen] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState<ProductionOrderItem | null>(null);

  const [moveForm, setMoveForm] = useState({ to_stage_id: '', quantity_moved: 0, remarks: '' });
  const [qcForm, setQcForm] = useState({
    input_quantity: 0,
    passed_quantity: 0,
    rejected_quantity: 0,
    rework_quantity: 0,
    defect_reason: '',
    remarks: '',
    rework_stage_id: '5',
  });

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
    Urgent: 'border-l-red-500',
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <PageHeader
        title="Production Orders"
        subtitle="Manage and track manufacturing batches across production workflow stages"
        breadcrumb={[{ label: 'Production' }, { label: 'Orders' }]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/production/orders/create')}>
              New Order
            </Button>
          </div>
        }
      />

      {/* Production Orders List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-w-0">
        {orders.map((ord) => {
          const totalQty = ord.total_quantity || 0;
          const completedQty = ord.completed_quantity || 0;
          const pendingQty = Math.max(0, totalQty - completedQty);
          const pct = totalQty > 0 ? Math.min(100, Math.round((completedQty / totalQty) * 100)) : 0;
          const items = ord.items || [];

          return (
            <div
              key={ord.id}
              className={`bg-white border border-slate-200 rounded-xl overflow-hidden border-l-4 ${
                priorityBorder[ord.priority] || 'border-l-slate-200'
              } shadow-xs hover:shadow-sm transition-shadow`}
            >
              {/* Top Row: Order Identification & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-sm font-bold font-mono text-brand-700 shrink-0">
                    {ord.order_number}
                  </span>
                  <span className="text-slate-300 font-normal">|</span>
                  <span
                    className="text-xs text-slate-800 font-semibold truncate min-w-0 max-w-[340px]"
                    title={ord.title}
                  >
                    {ord.title}
                  </span>
                  <StatusBadge status={ord.priority} />
                </div>

                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Target Delivery:{' '}
                    <strong className="text-slate-700 font-mono">{ord.target_delivery_date || '—'}</strong>
                  </span>
                  <StatusBadge status={ord.status} />

                  {/* Task 4: View Details navigates to dedicated full-page view */}
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => navigate(`/production/orders/${ord.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </div>

              {/* Middle Row: Order Summary */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50/70 border-b border-slate-100 text-xs">
                <div className="flex items-center gap-5 flex-wrap">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Buyer / Customer:{' '}
                    <strong className="text-slate-800">{ord.customer_name || 'Direct Order'}</strong>
                  </span>
                  <span className="text-slate-500">
                    Total Qty:{' '}
                    <strong className="font-mono text-slate-800">{totalQty.toLocaleString()} pcs</strong>
                  </span>
                  <span className="text-slate-500">
                    Completed:{' '}
                    <strong className="font-mono text-emerald-600">{completedQty.toLocaleString()} pcs</strong>
                  </span>
                  <span className="text-slate-500">
                    Pending:{' '}
                    <strong className="font-mono text-amber-600">{pendingQty.toLocaleString()} pcs</strong>
                  </span>
                </div>

                {/* Overall Batch Progress */}
                <div className="flex items-center gap-2.5 min-w-[150px] max-w-xs ml-auto">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Progress</span>
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        pct === 100 ? 'bg-emerald-500' : 'bg-brand-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-700 w-9 text-right">
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Bottom Row: Product Lines Information and Progress */}
              <div className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400 italic bg-white">
                    No product lines assigned to this production order.
                  </div>
                ) : (
                  items.map((item) => {
                    const itTotal = item.total_quantity || 0;
                    const itDone = item.completed_quantity || 0;
                    const itPending = Math.max(0, itTotal - itDone);
                    const itPct = itTotal > 0 ? Math.min(100, Math.round((itDone / itTotal) * 100)) : 0;
                    const pantone = item.color_pantone_code;

                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Product & Specifications Grid */}
                        <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 items-center">
                          {/* 1. Product Name & Code */}
                          <div className="min-w-0">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                              Product
                            </span>
                            <p
                              className="text-xs font-semibold text-slate-800 truncate"
                              title={item.product_name}
                            >
                              {item.product_name || 'Standard Product'}
                            </p>
                            {item.product_code && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {item.product_code}
                              </span>
                            )}
                          </div>

                          {/* 2. Color & Pantone */}
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
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-mono font-bold">
                                  {pantone}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 3. Size & Quantity Breakdown */}
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                              Size & Quantities
                            </span>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono font-bold text-slate-700">
                                {item.size}
                              </span>
                              <span className="text-xs font-mono text-slate-700">
                                <strong>{itTotal}</strong> total •{' '}
                                <span className="text-emerald-600 font-semibold">{itDone} done</span> •{' '}
                                <span className="text-amber-600 font-medium">{itPending} pend</span>
                              </span>
                            </div>
                          </div>

                          {/* 4. Current Stage */}
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                              Current Stage
                            </span>
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-white whitespace-nowrap shadow-2xs"
                              style={{ backgroundColor: item.color_badge || '#3b82f6' }}
                            >
                              {item.current_stage_name || 'Installation'}
                              <span className="ml-1 opacity-80 text-[10px]">
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

                        {/* Line Item Actions */}
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
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
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
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 rounded border border-amber-200 transition-colors"
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
          );
        })}

        {orders.length === 0 && !loading && (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-xl text-slate-400 text-sm">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No production orders found. Click &quot;New Order&quot; to create one.
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
            ? `${selectedItem.product_name} — ${selectedItem.color} / Size ${selectedItem.size}`
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
            ? `${selectedItem.product_name} — ${selectedItem.color} / Size ${selectedItem.size}`
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
