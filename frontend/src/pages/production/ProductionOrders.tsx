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
import { Plus, Eye, ArrowRight, RefreshCw, Layers, CheckCircle2, AlertCircle, Clock, Calendar, User, Package } from 'lucide-react';

export default function ProductionOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewOrder, setViewOrder] = useState<ProductionOrder | null>(null);
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
    rework_stage_id: '7'
  });

  const load = async () => {
    setLoading(true);
    try {
      const [ordData, stgData] = await Promise.all([
        api.getProductionOrders(),
        api.getProductionStages()
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

  useEffect(() => { load(); }, []);

  const handleMove = async () => {
    if (!selectedItem || !moveForm.to_stage_id || !moveForm.quantity_moved) {
      setError('Destination stage and quantity are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.moveStage({
        order_item_id: selectedItem.id,
        to_stage_id: parseInt(moveForm.to_stage_id),
        quantity_moved: moveForm.quantity_moved,
        remarks: moveForm.remarks
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
        rework_stage_id: parseInt(qcForm.rework_stage_id)
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
    Urgent: 'border-l-red-500'
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <PageHeader
        title="Production Orders"
        subtitle="Manage and track manufacturing orders across all stages"
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
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-w-0">
        {orders.map(ord => {
          const totalQty = ord.total_quantity || 0;
          const completedQty = ord.completed_quantity || 0;
          const pendingQty = Math.max(0, totalQty - completedQty);
          const pct = totalQty > 0 ? Math.min(100, Math.round((completedQty / totalQty) * 100)) : 0;

          return (
            <div
              key={ord.id}
              className={`bg-white border border-slate-200 rounded-lg overflow-hidden border-l-4 ${priorityBorder[ord.priority] || 'border-l-slate-200'} shadow-xs hover:shadow-sm transition-shadow`}
            >
              {/* Order Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-sm font-bold font-mono text-brand-700 shrink-0">
                    {ord.order_number}
                  </span>
                  <span className="text-xs text-slate-700 font-semibold truncate min-w-0" title={ord.title}>
                    {ord.title}
                  </span>
                  <StatusBadge status={ord.priority} />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Due: <strong className="text-slate-700 font-mono">{ord.target_delivery_date || '—'}</strong>
                  </span>
                  <StatusBadge status={ord.status} />
                  <button
                    onClick={() => setViewOrder(ord)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded border border-brand-200 transition-colors"
                    title="View Full Order Details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>
                </div>
              </div>

              {/* Customer & Metrics Subheader Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-50/70 border-b border-slate-100 text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Buyer / Customer: <strong className="text-slate-800">{ord.customer_name || 'Direct Order'}</strong>
                  </span>
                  <span className="text-slate-500">
                    Total: <strong className="font-mono text-slate-800">{totalQty} pcs</strong>
                  </span>
                  <span className="text-slate-500">
                    Completed: <strong className="font-mono text-emerald-600">{completedQty} pcs</strong>
                  </span>
                  <span className="text-slate-500">
                    Pending: <strong className="font-mono text-amber-600">{pendingQty} pcs</strong>
                  </span>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-2.5 min-w-[140px] max-w-xs ml-auto">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Progress</span>
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-brand-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-700 w-9 text-right">
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Product Lines List */}
              <div className="divide-y divide-slate-100">
                {(ord.items || []).map((item) => {
                  const itTotal = item.total_quantity || 0;
                  const itDone = item.completed_quantity || 0;
                  const itPending = Math.max(0, itTotal - itDone);

                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Product */}
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Product</p>
                          <p className="text-xs font-semibold text-slate-800 truncate" title={item.product_name}>
                            {item.product_name || 'Standard Product'}
                          </p>
                        </div>

                        {/* Variant / Color & Size */}
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Variant & Size</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-medium text-slate-700">
                              {item.color}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono font-bold text-slate-700">
                              Size {item.size}
                            </span>
                          </div>
                        </div>

                        {/* Quantities */}
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Quantity Breakdown</p>
                          <p className="text-xs font-mono text-slate-700">
                            <strong>{itTotal}</strong> total • <span className="text-emerald-600 font-semibold">{itDone} done</span> • <span className="text-amber-600">{itPending} pend</span>
                          </p>
                        </div>

                        {/* Current Stage */}
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Current Stage</p>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-white whitespace-nowrap shadow-xs"
                            style={{ backgroundColor: item.color_badge || '#3b82f6' }}
                          >
                            {item.current_stage_name} ({item.current_stage_quantity})
                          </span>
                        </div>
                      </div>

                      {/* Line Item Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setMoveForm({ to_stage_id: '', quantity_moved: item.current_stage_quantity, remarks: '' });
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
                              setQcForm({
                                input_quantity: item.current_stage_quantity,
                                passed_quantity: 0,
                                rejected_quantity: 0,
                                rework_quantity: 0,
                                defect_reason: '',
                                remarks: '',
                                rework_stage_id: '5'
                              });
                              setError('');
                              setQcOpen(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 rounded border border-amber-200 transition-colors"
                            title="Perform QC inspection"
                          >
                            <span>QC Inspect</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {orders.length === 0 && !loading && (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-lg text-slate-400 text-sm">
            No production orders found. Click &quot;New Order&quot; to create one.
          </div>
        )}
      </div>

      {/* Task 6: View Order Detailed Modal */}
      {viewOrder && (
        <Modal
          open={!!viewOrder}
          onClose={() => setViewOrder(null)}
          title={`Production Order: ${viewOrder.order_number}`}
          size="lg"
          footer={
            <Button variant="secondary" onClick={() => setViewOrder(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* Section 1: Order Summary Header */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Package className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Order Overview</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Order Number</span>
                  <span className="font-bold font-mono text-brand-700 text-sm">{viewOrder.order_number}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Order Title</span>
                  <span className="font-semibold text-slate-800 break-words">{viewOrder.title}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Buyer / Customer</span>
                  <span className="font-medium text-slate-700">{viewOrder.customer_name || 'Direct / None'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Priority</span>
                  <StatusBadge status={viewOrder.priority} />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Order Status</span>
                  <StatusBadge status={viewOrder.status} />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Target Delivery</span>
                  <span className="font-mono font-medium text-slate-800">{viewOrder.target_delivery_date || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Total Quantity</span>
                  <span className="font-bold font-mono text-slate-900">{viewOrder.total_quantity} pcs</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Completed Quantity</span>
                  <span className="font-bold font-mono text-emerald-600">{viewOrder.completed_quantity} pcs</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Pending Quantity</span>
                  <span className="font-bold font-mono text-amber-600">
                    {Math.max(0, (viewOrder.total_quantity || 0) - (viewOrder.completed_quantity || 0))} pcs
                  </span>
                </div>
                {viewOrder.notes && (
                  <div className="col-span-2 sm:col-span-3 lg:col-span-6 pt-2 border-t border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Notes / Instructions</span>
                    <p className="text-slate-600 whitespace-pre-line text-xs">{viewOrder.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Product Lines & Stage Tracking Table */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Product Lines & Stage Tracking</h3>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {(viewOrder.items || []).length} line items
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse table-auto min-w-[620px]">
                    <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="px-3.5 py-2.5">Product</th>
                        <th className="px-3 py-2.5">Variant / Color</th>
                        <th className="px-3 py-2.5 text-center">Size</th>
                        <th className="px-3 py-2.5 text-right">Total Qty</th>
                        <th className="px-3 py-2.5 text-right">Completed</th>
                        <th className="px-3 py-2.5 text-right">Pending</th>
                        <th className="px-3.5 py-2.5 text-left">Current Stage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(viewOrder.items || []).map((it) => {
                        const total = it.total_quantity || 0;
                        const done = it.completed_quantity || 0;
                        const pending = Math.max(0, total - done);

                        return (
                          <tr key={it.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-3.5 py-2.5 font-semibold text-slate-800">
                              {it.product_name || 'Standard Product'}
                              {it.product_code && (
                                <span className="block text-[10px] text-slate-400 font-mono font-normal">
                                  {it.product_code}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium">
                                {it.color}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="font-mono font-bold text-slate-700 px-2 py-0.5 bg-slate-100 rounded text-xs">
                                {it.size}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">
                              {total}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">
                              {done}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-medium text-amber-600">
                              {pending}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-white whitespace-nowrap shadow-xs"
                                style={{ backgroundColor: it.color_badge || '#3b82f6' }}
                              >
                                {it.current_stage_name} ({it.current_stage_quantity})
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800">
                      <tr>
                        <td colSpan={3} className="px-3.5 py-2 text-right uppercase text-[10px] tracking-wider text-slate-500">
                          Total Order Units:
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-900">
                          {viewOrder.total_quantity}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-600">
                          {viewOrder.completed_quantity}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-amber-600">
                          {Math.max(0, (viewOrder.total_quantity || 0) - (viewOrder.completed_quantity || 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}


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
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
          {selectedItem && (
            <div className="p-2.5 bg-slate-50 rounded-md text-xs text-slate-600">
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
            onChange={e => setMoveForm(f => ({ ...f, to_stage_id: e.target.value }))}
          >
            <option value="">— Select Stage —</option>
            {stages
              .filter(s => s.id !== selectedItem?.current_stage_id)
              .map(s => (
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
            onChange={e => setMoveForm(f => ({ ...f, quantity_moved: parseInt(e.target.value) || 0 }))}
            min="1"
            max={selectedItem?.current_stage_quantity}
            hint={`Max: ${selectedItem?.current_stage_quantity} pieces`}
          />
          <FormField
            label="Remarks"
            value={moveForm.remarks}
            onChange={e => setMoveForm(f => ({ ...f, remarks: e.target.value }))}
            placeholder="Optional remarks"
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
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Input Quantity"
              type="number"
              required
              value={qcForm.input_quantity}
              onChange={e => setQcForm(f => ({ ...f, input_quantity: parseInt(e.target.value) || 0 }))}
              min="0"
            />
            <FormField
              label="Passed Quantity"
              type="number"
              required
              value={qcForm.passed_quantity}
              onChange={e => setQcForm(f => ({ ...f, passed_quantity: parseInt(e.target.value) || 0 }))}
              min="0"
            />
            <FormField
              label="Rejected Quantity"
              type="number"
              value={qcForm.rejected_quantity}
              onChange={e => setQcForm(f => ({ ...f, rejected_quantity: parseInt(e.target.value) || 0 }))}
              min="0"
            />
            <FormField
              label="Rework Quantity"
              type="number"
              value={qcForm.rework_quantity}
              onChange={e => setQcForm(f => ({ ...f, rework_quantity: parseInt(e.target.value) || 0 }))}
              min="0"
            />
          </div>
          <div className="p-2.5 bg-slate-50 border rounded-md text-xs">
            Pending = {Math.max(0, qcForm.input_quantity - qcForm.passed_quantity - qcForm.rejected_quantity - qcForm.rework_quantity)} pieces
          </div>
          {qcForm.rework_quantity > 0 && (
            <FormField
              as="select"
              label="Route Rework to Stage"
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
          <FormField
            label="Defect Reason"
            value={qcForm.defect_reason}
            onChange={e => setQcForm(f => ({ ...f, defect_reason: e.target.value }))}
            placeholder="e.g. Stitch skip, color bleeding..."
          />
          <FormField
            as="textarea"
            label="QC Remarks"
            value={qcForm.remarks}
            onChange={e => setQcForm(f => ({ ...f, remarks: e.target.value }))}
            rows={2}
          />
        </div>
      </Modal>
    </div>
  );
}
