// src/pages/production/ProductionOrders.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, Customer, Product, ProductionOrderItem } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, Eye, ArrowRight, RefreshCw } from 'lucide-react';

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
  const [qcForm, setQcForm] = useState({ input_quantity: 0, passed_quantity: 0, rejected_quantity: 0, rework_quantity: 0, defect_reason: '', remarks: '', rework_stage_id: '5' });

  const load = async () => {
    setLoading(true);
    try {
      const [ordData, stgData] = await Promise.all([
        api.getProductionOrders(), api.getProductionStages()
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
      setError('Destination stage and quantity are required'); return;
    }
    setSaving(true); setError('');
    try {
      await api.moveStage({ order_item_id: selectedItem.id, to_stage_id: parseInt(moveForm.to_stage_id), quantity_moved: moveForm.quantity_moved, remarks: moveForm.remarks });
      setMoveOpen(false);
      load();
    } catch (e: unknown) { setError((e as Error).message); } finally { setSaving(false); }
  };

  const handleQC = async () => {
    if (!selectedItem) return;
    setSaving(true); setError('');
    try {
      await api.recordQC({ order_item_id: selectedItem.id, stage_id: selectedItem.current_stage_id, ...qcForm, rework_stage_id: parseInt(qcForm.rework_stage_id) });
      setQcOpen(false);
      load();
    } catch (e: unknown) { setError((e as Error).message); } finally { setSaving(false); }
  };

  const priorityBorder: Record<string, string> = { Low: 'border-l-slate-300', Medium: 'border-l-blue-400', High: 'border-l-orange-400', Urgent: 'border-l-red-500' };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Production Orders" subtitle="Manage and track manufacturing orders across all stages"
        breadcrumb={[{ label: 'Production' }, { label: 'Orders' }]}
        actions={
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/production/orders/create')}>New Order</Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {orders.map(ord => (
          <div key={ord.id} className={`bg-white border border-slate-200 rounded-md overflow-hidden border-l-4 ${priorityBorder[ord.priority] || 'border-l-slate-200'} hover:shadow-sm transition-shadow`}>
            {/* Order header */}
            <div className="flex items-start justify-between px-4 py-2.5 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-bold text-brand-700">{ord.order_number}</span>
                <span className="text-xs text-slate-600 truncate font-medium">{ord.title}</span>
                <StatusBadge status={ord.priority} />
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="text-[10px] text-slate-400">Due: {ord.target_delivery_date}</span>
                <StatusBadge status={ord.status} />
                <button onClick={() => setViewOrder(ord)} className="p-1 text-slate-400 hover:text-brand-600 rounded">
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Customer & progress */}
            <div className="flex items-center gap-4 px-4 py-1.5 bg-slate-50/50 border-b border-slate-100">
              <span className="text-[10px] text-slate-500">Customer: <span className="font-medium text-slate-700">{ord.customer_name || '—'}</span></span>
              <span className="text-[10px] text-slate-500">Total: <span className="font-semibold">{ord.total_quantity} pcs</span></span>
              <span className="text-[10px] text-green-600 font-semibold">Completed: {ord.completed_quantity}</span>
              <span className="text-[10px] text-orange-600 font-semibold">Pending: {ord.total_quantity - ord.completed_quantity}</span>
              {/* Progress bar */}
              <div className="flex-1 max-w-xs ml-auto hidden sm:flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.round((ord.completed_quantity / ord.total_quantity) * 100)}%` }} />
                </div>
                <span className="text-[10px] text-slate-500 font-mono w-8 text-right">{Math.round((ord.completed_quantity / ord.total_quantity) * 100)}%</span>
              </div>
            </div>

            {/* Items */}
            <div className="divide-y divide-slate-100">
              {(ord.items || []).map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 group">
                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <p className="text-[10px] text-slate-400">Product</p>
                      <p className="text-xs font-medium text-slate-700 truncate">{item.product_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Variant</p>
                      <p className="text-xs text-slate-600">{item.color} / {item.size}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Qty</p>
                      <p className="text-xs font-mono">{item.total_quantity} | <span className="text-green-600">{item.completed_quantity} done</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Current Stage</p>
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: item.color_badge || '#64748b' }}>
                        {item.current_stage_name} ({item.current_stage_quantity})
                      </span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => { setSelectedItem(item as never); setMoveForm({ to_stage_id: '', quantity_moved: item.current_stage_quantity, remarks: '' }); setError(''); setMoveOpen(true); }}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200"
                    >
                      <ArrowRight className="w-3 h-3" /> Move Stage
                    </button>
                    {item.current_stage_name === 'QC' && (
                      <button
                        onClick={() => { setSelectedItem(item as never); setQcForm({ input_quantity: item.current_stage_quantity, passed_quantity: 0, rejected_quantity: 0, rework_quantity: 0, defect_reason: '', remarks: '', rework_stage_id: '5' }); setError(''); setQcOpen(true); }}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 rounded border border-orange-200"
                      >
                        QC Inspect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {orders.length === 0 && !loading && (
          <div className="text-center py-20 text-slate-400 text-sm">No production orders found. Create one to get started.</div>
        )}
      </div>

      {/* View Order Modal */}
      {viewOrder && (
        <Modal open={!!viewOrder} onClose={() => setViewOrder(null)} title={`Order: ${viewOrder.order_number}`} size="lg"
          footer={<Button variant="secondary" onClick={() => setViewOrder(null)}>Close</Button>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Title</span>
                <span className="font-semibold text-slate-800">{viewOrder.title}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Customer</span>
                <span className="font-medium text-slate-700">{viewOrder.customer_name || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Priority / Status</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StatusBadge status={viewOrder.priority} />
                  <StatusBadge status={viewOrder.status} />
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Due Date</span>
                <span className="font-medium text-slate-700">{viewOrder.target_delivery_date || '—'}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Product Lines</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">Variant</th>
                      <th className="px-3 py-2 text-right">Total Qty</th>
                      <th className="px-3 py-2 text-right">Done</th>
                      <th className="px-3 py-2 text-left">Current Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(viewOrder.items || []).map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-medium text-slate-800">{it.product_name}</td>
                        <td className="px-3 py-2 text-slate-600">{it.color} / {it.size}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{it.total_quantity}</td>
                        <td className="px-3 py-2 text-right font-mono text-green-600 font-semibold">{it.completed_quantity}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold text-white" style={{ backgroundColor: it.color_badge || '#64748b' }}>
                            {it.current_stage_name} ({it.current_stage_quantity})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Move Stage Modal */}
      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title="Move to Next Stage" size="sm"
        subtitle={selectedItem ? `${(selectedItem as NonNullable<typeof selectedItem>).product_name} — ${(selectedItem as NonNullable<typeof selectedItem>).color} / ${(selectedItem as NonNullable<typeof selectedItem>).size}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleMove} icon={<ArrowRight className="w-3.5 h-3.5" />}>Move</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
          {selectedItem && (
            <div className="p-2.5 bg-slate-50 rounded-md text-xs text-slate-600">
              Current Stage: <span className="font-semibold" style={{ color: (selectedItem as NonNullable<typeof selectedItem>).color_badge }}>{(selectedItem as NonNullable<typeof selectedItem>).current_stage_name}</span> &nbsp;|&nbsp;
              Available Qty: <span className="font-semibold">{(selectedItem as NonNullable<typeof selectedItem>).current_stage_quantity}</span>
            </div>
          )}
          <FormField as="select" label="Move To Stage" required value={moveForm.to_stage_id}
            onChange={e => setMoveForm(f => ({ ...f, to_stage_id: e.target.value }))}>
            <option value="">— Select Stage —</option>
            {stages.filter(s => s.id !== (selectedItem as NonNullable<typeof selectedItem>)?.current_stage_id).map(s => (
              <option key={s.id} value={s.id}>{s.sequence_order}. {s.name}</option>
            ))}
          </FormField>
          <FormField label="Quantity to Move" type="number" required value={moveForm.quantity_moved}
            onChange={e => setMoveForm(f => ({ ...f, quantity_moved: parseInt(e.target.value) || 0 }))}
            min="1" max={(selectedItem as NonNullable<typeof selectedItem>)?.current_stage_quantity}
            hint={`Max: ${(selectedItem as NonNullable<typeof selectedItem>)?.current_stage_quantity} pieces`} />
          <FormField label="Remarks" value={moveForm.remarks} onChange={e => setMoveForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Optional remarks" />
        </div>
      </Modal>

      {/* QC Modal */}
      <Modal open={qcOpen} onClose={() => setQcOpen(false)} title="QC Inspection Record" size="md"
        subtitle={selectedItem ? `${(selectedItem as NonNullable<typeof selectedItem>).product_name} — ${(selectedItem as NonNullable<typeof selectedItem>).color} / ${(selectedItem as NonNullable<typeof selectedItem>).size}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQcOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleQC}>Save QC Record</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Input Quantity" type="number" required value={qcForm.input_quantity}
              onChange={e => setQcForm(f => ({ ...f, input_quantity: parseInt(e.target.value)||0 }))} min="0" />
            <FormField label="Passed Quantity" type="number" required value={qcForm.passed_quantity}
              onChange={e => setQcForm(f => ({ ...f, passed_quantity: parseInt(e.target.value)||0 }))} min="0" />
            <FormField label="Rejected Quantity" type="number" value={qcForm.rejected_quantity}
              onChange={e => setQcForm(f => ({ ...f, rejected_quantity: parseInt(e.target.value)||0 }))} min="0" />
            <FormField label="Rework Quantity" type="number" value={qcForm.rework_quantity}
              onChange={e => setQcForm(f => ({ ...f, rework_quantity: parseInt(e.target.value)||0 }))} min="0" />
          </div>
          <div className="p-2.5 bg-slate-50 border rounded-md text-xs">
            Pending = {Math.max(0, qcForm.input_quantity - qcForm.passed_quantity - qcForm.rejected_quantity - qcForm.rework_quantity)} pieces
          </div>
          {qcForm.rework_quantity > 0 && (
            <FormField as="select" label="Route Rework to Stage" value={qcForm.rework_stage_id}
              onChange={e => setQcForm(f => ({ ...f, rework_stage_id: e.target.value }))}>
              {stages.filter(s => !s.is_final_stage && !s.is_qc_stage).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FormField>
          )}
          <FormField label="Defect Reason" value={qcForm.defect_reason}
            onChange={e => setQcForm(f => ({ ...f, defect_reason: e.target.value }))} placeholder="e.g. Stitch skip, color bleeding..." />
          <FormField as="textarea" label="QC Remarks" value={qcForm.remarks}
            onChange={e => setQcForm(f => ({ ...f, remarks: e.target.value }))} rows={2} />
        </div>
      </Modal>
    </div>
  );
}
