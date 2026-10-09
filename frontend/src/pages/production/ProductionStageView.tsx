// src/pages/production/ProductionStageView.tsx
// Generic stage view for Installation, Dyeing, Detailing, Cutting, Stitching, QC, Rework, Completed
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionOrderItem, ProductionStage } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { RefreshCw, ChevronRight, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n);

interface Props { stageName: string; stageCode?: string; breadcrumb: string[]; }

export default function ProductionStageView({ stageName, stageCode, breadcrumb }: Props) {
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [allItems, setAllItems] = useState<(ProductionOrderItem & { order_number: string; title: string; stage_code?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [moveOpen, setMoveOpen] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<(ProductionOrderItem & { order_number: string; title: string; stage_code?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [moveForm, setMoveForm] = useState({ next_stage_id: '', quantity: '', notes: '' });
  const [qcForm, setQcForm] = useState({ passed: '', rejected: '', rework: '', defect_reason: '', remarks: '' });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getProductionStages().catch(() => []),
      api.getProductionOrders().catch(() => []),
    ]).then(([stgList, ordList]) => {
      setStages((stgList || []) as ProductionStage[]);
      const flat: (ProductionOrderItem & { order_number: string; title: string; stage_code?: string })[] = [];
      ((ordList || []) as ProductionOrder[]).forEach(ord => {
        (ord.items || []).forEach(it => {
          flat.push({
            ...it,
            order_number: ord.order_number,
            title: ord.title,
            stage_code: (it as { stage_code?: string }).stage_code || '',
          });
        });
      });
      setAllItems(flat);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [stageName, stageCode]);

  const isQC = stageName === 'QC';
  const isCompleted = stageName === 'Completed';
  const isRework = stageName === 'Rework';

  const items = stageCode
    ? allItems.filter(i => (i.current_stage_name || '').toLowerCase() === stageName.toLowerCase() || (i.stage_code || '').toUpperCase() === stageCode.toUpperCase())
    : allItems;

  const currentStage = stages.find(s => s.name === stageName);
  const nextStages = stages.filter(s => s.sequence_order > (currentStage?.sequence_order || 0));

  const handleMove = async () => {
    if (!moveForm.next_stage_id || !moveForm.quantity) { setError('Select next stage and enter quantity'); return; }
    setSaving(true); setError('');
    try {
      await api.moveStage({ item_id: selectedItem?.id, next_stage_id: moveForm.next_stage_id, quantity: moveForm.quantity, notes: moveForm.notes });
      setMoveOpen(false);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to move order item');
    } finally { setSaving(false); }
  };

  const handleQC = async () => {
    const passed = Number(qcForm.passed) || 0;
    const rejected = Number(qcForm.rejected) || 0;
    const rework = Number(qcForm.rework) || 0;
    if (passed + rejected + rework === 0) { setError('Enter QC quantities'); return; }
    setSaving(true); setError('');
    try {
      await api.recordQC({ item_id: selectedItem?.id, passed_quantity: passed, rejected_quantity: rejected, rework_quantity: rework, defect_reason: qcForm.defect_reason, remarks: qcForm.remarks });
      setQcOpen(false);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to record QC');
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'order_number', label: 'Order', sortable: true, render: (r: typeof items[0]) => <span className="font-semibold text-brand-700">{r.order_number}</span> },
    { key: 'product_name', label: 'Product', sortable: true },
    { key: 'color', label: 'Color', render: (r: typeof items[0]) => <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-medium">{r.color}</span> },
    { key: 'size', label: 'Size', render: (r: typeof items[0]) => <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-medium">{r.size}</span> },
    { key: 'total_quantity', label: 'Total Qty', render: (r: typeof items[0]) => <span className="font-mono font-semibold">{fmt(r.total_quantity)}</span> },
    { key: 'current_stage_quantity', label: 'At This Stage', render: (r: typeof items[0]) => <span className="font-mono text-brand-700 font-bold">{fmt(r.current_stage_quantity)}</span> },
    ...(isCompleted ? [
      { key: 'completed_quantity', label: 'Passed', render: (r: typeof items[0]) => <span className="font-mono font-bold text-emerald-600">{fmt(r.completed_quantity)}</span> },
      { key: 'rejected_quantity', label: 'Rejected', render: (r: typeof items[0]) => <span className="font-mono font-bold text-red-600">{fmt(r.rejected_quantity)}</span> },
    ] : []),
    { key: 'current_stage_name', label: 'Current Stage', render: (r: typeof items[0]) => (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: r.color_badge || '#6366f1' }}>{r.current_stage_name}</span>
    )},
    { key: 'status', label: 'Status', render: (r: typeof items[0]) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={stageName}
        subtitle={`Production orders currently at ${stageName} stage`}
        breadcrumb={[{ label: 'Production' }, ...breadcrumb.map(b => ({ label: b }))]}
        actions={
          <div className="flex gap-2">
            <button onClick={loadData} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        }
      />

      {/* Stage pipeline */}
      <div className="px-4 pt-3 pb-0">
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {stages.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-semibold whitespace-nowrap transition-all ${s.name === stageName ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}
                style={s.name === stageName ? { backgroundColor: s.color_badge } : {}}>
                {s.is_final_stage && <CheckCircle2 className="w-3 h-3" />}
                {s.name}
              </div>
              {i < stages.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 pt-2 pb-0 flex gap-3">
        {[
          { label: 'Items at Stage', value: String(items.length), c: 'bg-slate-50 border-slate-200' },
          { label: 'Total Qty', value: fmt(items.reduce((s, i) => s + i.total_quantity, 0)), c: 'bg-brand-50 border-brand-200' },
          ...(isCompleted ? [{ label: 'Rejection Rate', value: items.length ? `${Math.round((items.reduce((s, i) => s + i.rejected_quantity, 0) / Math.max(1, items.reduce((s, i) => s + i.total_quantity, 0))) * 100)}%` : '0%', c: 'bg-red-50 border-red-200' }] : []),
        ].map(k => (
          <div key={k.label} className={`px-3 py-2 rounded-md border text-xs ${k.c}`}>
            <p className="text-slate-500 text-[10px] uppercase tracking-wide">{k.label}</p>
            <p className="font-bold text-sm mt-0.5 text-slate-800">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={items} columns={columns} rowKey="id" onRowClick={r => setSelectedItem(r)}
          actions={(r: typeof items[0]) => (
            <div className="flex items-center gap-1">
              {isQC ? (
                <button onClick={e => { e.stopPropagation(); setSelectedItem(r); setQcOpen(true); }}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100">
                  <CheckCircle2 className="w-3 h-3" /> QC
                </button>
              ) : !isCompleted && (
                <button onClick={e => { e.stopPropagation(); setSelectedItem(r); setMoveForm({ next_stage_id: '', quantity: String(r.current_stage_quantity), notes: '' }); setMoveOpen(true); }}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100">
                  <ChevronRight className="w-3 h-3" /> Move
                </button>
              )}
            </div>
          )}
        />
      </div>

      {/* Move Stage Modal */}
      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title={`Move to Next Stage — ${selectedItem?.order_number}`}
        subtitle={`${selectedItem?.product_name} | ${selectedItem?.color} | ${selectedItem?.size}`}
        footer={<><Button variant="secondary" onClick={() => setMoveOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleMove} icon={<ChevronRight className="w-3.5 h-3.5" />}>Move to Stage</Button></>}>
        <div className="flex flex-col gap-3">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
          <FormField as="select" label="Next Stage" required value={moveForm.next_stage_id} onChange={e => setMoveForm(f => ({ ...f, next_stage_id: e.target.value }))}>
            <option value="">— Select next stage —</option>
            {nextStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </FormField>
          <FormField label="Quantity to Move" type="number" required min="0" max={selectedItem?.current_stage_quantity} value={moveForm.quantity} onChange={e => setMoveForm(f => ({ ...f, quantity: e.target.value }))} hint={`Max: ${fmt(selectedItem?.current_stage_quantity || 0)} pcs`} />
          <FormField as="textarea" label="Notes" value={moveForm.notes} onChange={e => setMoveForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
        </div>
      </Modal>

      {/* QC Modal */}
      <Modal open={qcOpen} onClose={() => setQcOpen(false)} title={`Quality Control — ${selectedItem?.order_number}`}
        subtitle={`${selectedItem?.product_name} | ${selectedItem?.color} | ${selectedItem?.size} | Qty: ${fmt(selectedItem?.current_stage_quantity || 0)}`}
        footer={<><Button variant="secondary" onClick={() => setQcOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleQC} icon={<CheckCircle2 className="w-3.5 h-3.5" />}>Submit QC</Button></>}>
        <div className="flex flex-col gap-3">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="✓ Passed" type="number" min="0" value={qcForm.passed} onChange={e => setQcForm(f => ({ ...f, passed: e.target.value }))} />
            <FormField label="✗ Rejected" type="number" min="0" value={qcForm.rejected} onChange={e => setQcForm(f => ({ ...f, rejected: e.target.value }))} />
            <FormField label="↺ Rework" type="number" min="0" value={qcForm.rework} onChange={e => setQcForm(f => ({ ...f, rework: e.target.value }))} />
          </div>
          {(Number(qcForm.rejected) > 0 || Number(qcForm.rework) > 0) && (
            <FormField label="Defect Reason" value={qcForm.defect_reason} onChange={e => setQcForm(f => ({ ...f, defect_reason: e.target.value }))} placeholder="Describe the defect found..." />
          )}
          <FormField as="textarea" label="QC Remarks" value={qcForm.remarks} onChange={e => setQcForm(f => ({ ...f, remarks: e.target.value }))} rows={2} />
        </div>
      </Modal>
    </div>
  );
}
