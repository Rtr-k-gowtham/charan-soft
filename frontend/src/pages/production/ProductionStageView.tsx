// src/pages/production/ProductionStageView.tsx
// Production Stage Workspace for the 10 Core Production Pipeline Stages
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionOrderItem, ProductionStage } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import {
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Boxes,
  Plus
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n || 0);

interface Props {
  stageName: string;
  stageCode?: string;
  breadcrumb: string[];
}

const STAGE_ROUTE_MAP: Record<string, string> = {
  REQ: '/production/requirement',
  PO: '/production/po',
  INW: '/production/inward',
  DYE: '/production/dyeing',
  CUT: '/production/cutting',
  EMB: '/production/embroidery',
  STI: '/production/stitching',
  CHK: '/production/checking',
  PCK: '/production/packing',
  COMP: '/production/completed',
};

type StageItem = ProductionOrderItem & {
  order_number: string;
  order_title: string;
  customer_name?: string;
  stage_code?: string;
  priority?: string;
  target_delivery_date?: string;
};

export default function ProductionStageView({ stageName, stageCode, breadcrumb }: Props) {
  const navigate = useNavigate();
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [allItems, setAllItems] = useState<StageItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [moveOpen, setMoveOpen] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);

  const [selectedItem, setSelectedItem] = useState<StageItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Forms
  const [moveForm, setMoveForm] = useState({ next_stage_id: '', quantity: '', notes: '' });
  const [qcForm, setQcForm] = useState({ passed: '', rejected: '', rework: '', defect_reason: '', remarks: '', rework_stage_id: '7' });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getProductionStages().catch(() => []),
      api.getProductionOrders().catch(() => []),
    ])
      .then(([stgList, ordList]) => {
        setStages((stgList || []) as ProductionStage[]);
        const flat: StageItem[] = [];
        ((ordList || []) as ProductionOrder[]).forEach(ord => {
          (ord.items || []).forEach(it => {
            flat.push({
              ...it,
              order_number: ord.order_number,
              order_title: ord.title,
              customer_name: ord.customer_name,
              priority: ord.priority,
              target_delivery_date: ord.target_delivery_date,
              stage_code: (it as { stage_code?: string }).stage_code || '',
            });
          });
        });
        setAllItems(flat);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [stageName, stageCode]);

  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  const activeCode = (stageCode || 'REQ').toUpperCase();
  const isQC = activeCode === 'CHK';
  const isCompleted = activeCode === 'COMP';

  // Filter items that belong to this stage
  const items = useMemo(() => {
    return allItems.filter(i => {
      const iCode = (i.stage_code || '').toUpperCase();
      const iName = (i.current_stage_name || '').toLowerCase();
      const sCode = activeCode;
      const sName = stageName.toLowerCase();

      if (iCode === sCode) return true;
      if (iName === sName) return true;

      // Alias mapping
      if (sCode === 'REQ' && (iName.includes('requirement') || iCode === 'INST')) return true;
      if (sCode === 'PO' && (iName.includes('purchase order') || iCode === 'PO')) return true;
      if (sCode === 'INW' && (iName.includes('inward') || iCode === 'DET')) return true;
      if (sCode === 'DYE' && (iName.includes('dye') || iCode === 'DYE')) return true;
      if (sCode === 'CUT' && (iName.includes('cut') || iCode === 'CUT')) return true;
      if (sCode === 'EMB' && (iName.includes('embroid') || iCode === 'EMB')) return true;
      if (sCode === 'STI' && (iName.includes('stitch') || iCode === 'STI')) return true;
      if (sCode === 'CHK' && (iName.includes('check') || iName === 'qc' || iCode === 'QC')) return true;
      if (sCode === 'PCK' && (iName.includes('pack') || iCode === 'PCK')) return true;
      if (sCode === 'COMP' && (iName.includes('complete') || iCode === 'COMP')) return true;

      return false;
    });
  }, [allItems, activeCode, stageName]);

  const currentStage = stages.find(s => s.code === activeCode || s.name === stageName);
  const nextStages = stages.filter(s => s.sequence_order > (currentStage?.sequence_order || 0));

  // Stage Move Handler
  const handleMove = async () => {
    if (!moveForm.next_stage_id || !moveForm.quantity) {
      setError('Select destination stage and enter quantity');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.moveStage({
        item_id: selectedItem?.id,
        to_stage_id: moveForm.next_stage_id,
        quantity: Number(moveForm.quantity),
        notes: moveForm.notes,
      });
      setMoveOpen(false);
      setSuccessToast(`Moved ${fmt(Number(moveForm.quantity))} pcs to next production stage`);
      loadData();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to move order item');
    } finally {
      setSaving(false);
    }
  };

  // Quality Inspection / QC Handler
  const handleQC = async () => {
    const passed = Number(qcForm.passed) || 0;
    const rejected = Number(qcForm.rejected) || 0;
    const rework = Number(qcForm.rework) || 0;
    if (passed + rejected + rework === 0) {
      setError('Please enter at least one quantity (Passed, Rejected, or Rework)');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.recordQC({
        item_id: selectedItem?.id,
        passed_quantity: passed,
        rejected_quantity: rejected,
        rework_quantity: rework,
        defect_reason: qcForm.defect_reason,
        remarks: qcForm.remarks,
        order_number: selectedItem?.order_number,
        product_name: selectedItem?.product_name,
      });

      // If items passed QC, automatically advance them to Stage 09 Packing
      if (passed > 0) {
        const packingStage = stages.find(s => s.code === 'PCK' || s.sequence_order === 9);
        if (packingStage && selectedItem) {
          await api.moveStage({
            item_id: selectedItem.id,
            to_stage_id: packingStage.id,
            quantity: passed,
            notes: 'Passed quality check and forwarded to packing',
          }).catch(() => null);
        }
      }

      setQcOpen(false);
      setSuccessToast(`Quality inspection saved: ${passed} Passed, ${rework} Rework, ${rejected} Rejected`);
      loadData();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to record QC inspection');
    } finally {
      setSaving(false);
    }
  };

  // Open move modal with prefilled quantity
  const openMoveModal = (r: StageItem) => {
    setSelectedItem(r);
    // Find next sequential stage
    const nextSeq = stages.find(s => s.sequence_order === (currentStage?.sequence_order || 0) + 1);
    setMoveForm({
      next_stage_id: nextSeq ? String(nextSeq.id) : '',
      quantity: String(r.current_stage_quantity || r.total_quantity || 100),
      notes: '',
    });
    setError('');
    setMoveOpen(true);
  };

  // Dynamic columns
  const columns = [
    {
      key: 'order_number',
      label: 'Order',
      sortable: true,
      render: (r: StageItem) => (
        <div>
          <span className="font-semibold text-brand-700 block">{r.order_number}</span>
          <span className="text-[10px] text-slate-400 truncate max-w-[140px] block">{r.order_title}</span>
        </div>
      ),
    },
    {
      key: 'product_name',
      label: 'Product',
      sortable: true,
      render: (r: StageItem) => (
        <div>
          <span className="font-medium text-slate-800">{r.product_name || 'Garment Item'}</span>
          {r.product_code && <span className="text-[10px] text-slate-400 block font-mono">{r.product_code}</span>}
        </div>
      ),
    },
    {
      key: 'color',
      label: 'Color',
      render: (r: StageItem) => (
        <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium text-slate-700 border border-slate-200">
          {r.color}
        </span>
      ),
    },
    {
      key: 'size',
      label: 'Size',
      render: (r: StageItem) => r.size ? (
        <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-mono font-bold text-slate-700">
          {r.size}
        </span>
      ) : (
        <span className="text-slate-400 font-mono text-xs">—</span>
      ),
    },
    {
      key: 'total_quantity',
      label: 'Order Qty',
      render: (r: StageItem) => <span className="font-mono font-semibold text-slate-700">{fmt(r.total_quantity)}</span>,
    },
    {
      key: 'current_stage_quantity',
      label: 'At This Stage',
      render: (r: StageItem) => (
        <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
          {fmt(r.current_stage_quantity || r.total_quantity)} pcs
        </span>
      ),
    },
    ...(isCompleted
      ? [
          {
            key: 'completed_quantity',
            label: 'Final Passed',
            render: (r: StageItem) => <span className="font-mono font-bold text-emerald-600">{fmt(r.completed_quantity || r.total_quantity)}</span>,
          },
          {
            key: 'rejected_quantity',
            label: 'Rejection',
            render: (r: StageItem) => <span className="font-mono font-bold text-red-500">{fmt(r.rejected_quantity)}</span>,
          },
        ]
      : []),
    {
      key: 'priority',
      label: 'Priority',
      render: (r: StageItem) => <StatusBadge status={r.priority || 'Medium'} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: StageItem) => <StatusBadge status={r.status || 'In Progress'} />,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          {successToast}
        </div>
      )}

      <PageHeader
        title={stageName}
        subtitle={`Production orders currently at ${stageName} stage`}
        breadcrumb={[{ label: 'Production' }, ...breadcrumb.map(b => ({ label: b }))]}
        actions={
          <div className="flex gap-2 items-center">
            {activeCode === 'PO' && (
              <Button
                icon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
                onClick={() => navigate('/purchase/orders?create=true')}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs"
              >
                <span>Create PO</span>
              </Button>
            )}
            <button
              onClick={() => navigate('/production/board')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs"
            >
              <Boxes className="w-3.5 h-3.5 text-brand-600" />
              <span className="hidden sm:inline">Kanban Board</span>
            </button>
            <button
              onClick={loadData}
              title="Refresh Stage Data"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Mobile Action Banner when on PO stage */}
      {activeCode === 'PO' && (
        <div className="sm:hidden px-3 pt-2.5 pb-1 bg-white border-b border-slate-200">
          <button
            type="button"
            onClick={() => navigate('/purchase/orders?create=true')}
            className="w-full flex items-center justify-between gap-2 p-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl shadow-sm active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                <Plus className="w-4 h-4 text-white stroke-[2.5]" />
              </div>
              <span className="text-xs font-bold">Create Purchase Order</span>
            </div>
            <span className="text-[11px] font-bold bg-white text-brand-700 px-2 py-0.5 rounded-md shadow-2xs">
              + New PO
            </span>
          </button>
        </div>
      )}

      {/* 10-Stage Pipeline Stepper */}
      <div className="px-3 sm:px-4 pt-2 pb-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll scrollbar-none pb-1">
          {stages.map((s, idx) => {
            const isCurrent = s.code === activeCode || s.name === stageName;
            const targetRoute = STAGE_ROUTE_MAP[s.code] || `/production/${s.code.toLowerCase()}`;
            return (
              <React.Fragment key={s.id || s.code}>
                <button
                  type="button"
                  onClick={() => navigate(targetRoute)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer border min-h-[32px] ${
                    isCurrent
                      ? 'text-white shadow-sm border-transparent'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  style={isCurrent ? { backgroundColor: s.color_badge || '#6366f1' } : {}}
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

      {/* Main Order Items Table */}
      <div className="flex-1 overflow-hidden p-2 sm:p-4">
        <DataTable
          data={items}
          columns={columns}
          rowKey="id"
          onRowClick={r => openMoveModal(r)}
          actions={(r: StageItem) => (
            <div className="flex items-center gap-1.5">
              {isQC ? (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedItem(r);
                    setQcForm({
                      passed: String(r.current_stage_quantity || r.total_quantity || 0),
                      rejected: '0',
                      rework: '0',
                      defect_reason: '',
                      remarks: '',
                      rework_stage_id: '7',
                    });
                    setQcOpen(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 transition font-semibold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> QC Check
                </button>
              ) : !isCompleted ? (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    openMoveModal(r);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition font-semibold"
                >
                  Move <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="text-[11px] text-emerald-700 font-bold px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                  ✓ Done
                </span>
              )}
            </div>
          )}
        />
      </div>

      {/* Move Stage Modal */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={`Advance Stage — Order ${selectedItem?.order_number}`}
        subtitle={`${selectedItem?.product_name} | ${selectedItem?.color}${selectedItem?.size ? ` | Size ${selectedItem.size}` : ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={handleMove}
              icon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Advance to Stage
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

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <span className="text-slate-500">Current Stage:</span>{' '}
            <strong className="text-slate-800">{stageName}</strong>
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-slate-500">Available:</span>{' '}
            <strong className="text-brand-700 font-mono">
              {fmt(selectedItem?.current_stage_quantity || selectedItem?.total_quantity || 0)} pcs
            </strong>
          </div>

          <FormField
            as="select"
            label="Next Destination Stage"
            required
            value={moveForm.next_stage_id}
            onChange={e => setMoveForm(f => ({ ...f, next_stage_id: e.target.value }))}
          >
            <option value="">— Select next production stage —</option>
            {nextStages.map(s => (
              <option key={s.id} value={s.id}>
                {String(s.sequence_order).padStart(2, '0')}. {s.name}
              </option>
            ))}
          </FormField>

          <FormField
            label="Quantity to Move (Pieces)"
            type="number"
            required
            min="1"
            max={selectedItem?.current_stage_quantity || selectedItem?.total_quantity}
            value={moveForm.quantity}
            onChange={e => setMoveForm(f => ({ ...f, quantity: e.target.value }))}
            hint={`Maximum available: ${fmt(selectedItem?.current_stage_quantity || selectedItem?.total_quantity || 0)} pcs`}
          />

          <FormField
            as="textarea"
            label="Operator Notes & Challan Details"
            value={moveForm.notes}
            onChange={e => setMoveForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="e.g. Batch processed, passed visual check..."
          />
        </div>
      </Modal>

      {/* QC / Checking Modal */}
      <Modal
        open={qcOpen}
        onClose={() => setQcOpen(false)}
        title={`08. Checking — Quality Inspection`}
        subtitle={`Order ${selectedItem?.order_number} | ${selectedItem?.product_name} | ${selectedItem?.color}${selectedItem?.size ? ` / Size ${selectedItem.size}` : ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQcOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={handleQC}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Confirm QC & Route
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

          <div className="p-2.5 bg-slate-50 border rounded-lg text-xs">
            Inspection Batch: <strong>{fmt(selectedItem?.current_stage_quantity || selectedItem?.total_quantity || 0)} pcs</strong>
            {' • '}Passed pieces will automatically advance to <strong>Packing</strong>.
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField
              label="✓ Passed Qty"
              type="number"
              min="0"
              value={qcForm.passed}
              onChange={e => setQcForm(f => ({ ...f, passed: e.target.value }))}
            />
            <FormField
              label="↺ Rework Qty"
              type="number"
              min="0"
              value={qcForm.rework}
              onChange={e => setQcForm(f => ({ ...f, rework: e.target.value }))}
            />
            <FormField
              label="✗ Rejected Qty"
              type="number"
              min="0"
              value={qcForm.rejected}
              onChange={e => setQcForm(f => ({ ...f, rejected: e.target.value }))}
            />
          </div>

          {Number(qcForm.rework) > 0 && (
            <FormField
              as="select"
              label="Route Rework Back To Stage"
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

          {(Number(qcForm.rejected) > 0 || Number(qcForm.rework) > 0) && (
            <FormField
              label="Primary Defect Reason"
              value={qcForm.defect_reason}
              onChange={e => setQcForm(f => ({ ...f, defect_reason: e.target.value }))}
              placeholder="e.g. Skipped stitch, oil stain..."
            />
          )}

          <FormField
            as="textarea"
            label="Inspector Remarks"
            value={qcForm.remarks}
            onChange={e => setQcForm(f => ({ ...f, remarks: e.target.value }))}
            rows={2}
            placeholder="Inspection observations..."
          />
        </div>
      </Modal>
    </div>
  );
}
