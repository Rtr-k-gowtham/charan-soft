// src/pages/production/ProductionOrders.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, Customer, Category, Product, ProductionOrderItem } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Plus, Eye, ArrowRight, RefreshCw, Trash2 } from 'lucide-react';



interface OrderItem { product_id: string; color: string; size: string; total_quantity: number; }

export default function ProductionOrders() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewOrder, setViewOrder] = useState<ProductionOrder | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState<ProductionOrderItem | null>(null);

  const [form, setForm] = useState({ title: '', customer_id: '', category_id: '7', priority: 'Medium', start_date: new Date().toISOString().split('T')[0], target_delivery_date: '', notes: '' });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{ product_id: '', color: '', size: 'M', total_quantity: 0 }]);
  const [moveForm, setMoveForm] = useState({ to_stage_id: '', quantity_moved: 0, remarks: '' });
  const [qcForm, setQcForm] = useState({ input_quantity: 0, passed_quantity: 0, rejected_quantity: 0, rework_quantity: 0, defect_reason: '', remarks: '', rework_stage_id: '5' });

  const load = async () => {
    setLoading(true);
    try {
      const [ordData, stgData, prdData, custData] = await Promise.all([
        api.getProductionOrders(), api.getProductionStages(), api.getProducts(), api.getCustomers()
      ]);
      setOrders(ordData as ProductionOrder[]);
      setStages(stgData as ProductionStage[]);
      setProducts(prdData as Product[]);
      setCustomers(custData as Customer[]);
    } catch {
      setOrders([]);
      setStages([]);
      setProducts([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.title || orderItems.some(i => !i.product_id || !i.total_quantity)) {
      setError('Title and all item fields are required'); return;
    }
    setSaving(true); setError('');
    try {
      await api.createProductionOrder({ ...form, items: orderItems });
      setCreateOpen(false);
      load();
    } catch (e: unknown) { setError((e as Error).message); } finally { setSaving(false); }
  };

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
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreateOpen(true)}>New Order</Button>
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

      {/* Create Order Drawer */}
      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} title="Create Production Order" width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleCreate}>Create Order</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <FormField label="Order Title" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Export Queen Bed Linen Contract" />
            </div>
            <FormField as="select" label="Customer" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
              <option value="">— Select Customer —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FormField>
            <FormField as="select" label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p}>{p}</option>)}
            </FormField>
            <FormField label="Start Date" type="date" required value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            <FormField label="Target Delivery" type="date" required value={form.target_delivery_date} onChange={e => setForm(f => ({ ...f, target_delivery_date: e.target.value }))} />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Product Lines</p>
              <button onClick={() => setOrderItems(p => [...p, { product_id: '', color: '', size: 'M', total_quantity: 0 }])}
                className="text-[11px] text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Product
              </button>
            </div>
            {orderItems.map((it, idx) => (
              <div key={idx} className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2 p-2 bg-slate-50 rounded-md border border-slate-200">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-medium text-slate-500 block mb-1">Product *</label>
                  <select value={it.product_id} onChange={e => setOrderItems(p => { const n = [...p]; n[idx].product_id = e.target.value; return n; })}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-brand-400">
                    <option value="">— Select —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-1">Color *</label>
                  <input value={it.color} onChange={e => setOrderItems(p => { const n = [...p]; n[idx].color = e.target.value; return n; })}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-brand-400" placeholder="Color" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-1">Size *</label>
                  <select value={it.size} onChange={e => setOrderItems(p => { const n = [...p]; n[idx].size = e.target.value; return n; })}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-brand-400">
                    {['XS','S','M','L','XL','XXL','SINGLE','QUEEN','KING'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex items-end gap-1">
                  <div className="flex-1">
                    <label className="text-[10px] font-medium text-slate-500 block mb-1">Qty *</label>
                    <input type="number" min="1" value={it.total_quantity} onChange={e => setOrderItems(p => { const n = [...p]; n[idx].total_quantity = parseInt(e.target.value)||0; return n; })}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-brand-400 text-right" />
                  </div>
                  {orderItems.length > 1 && (
                    <button onClick={() => setOrderItems(p => p.filter((_,i) => i !== idx))} className="mb-0.5 p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Drawer>

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
