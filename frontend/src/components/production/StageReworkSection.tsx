import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, Send, CheckCircle2, AlertTriangle, ArrowRight, 
  Calendar, Building2, FileText, Check, X, RefreshCw, Plus, ShieldCheck, Clock
} from 'lucide-react';
import { ReworkRecord, ReworkStatus } from '../../types';
import { api } from '../../lib/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';

interface StageReworkSectionProps {
  productionOrderId: number;
  stageId: number;
  stageCode: string;
  stageName: string;
  reworkRecords?: ReworkRecord[];
  onReload?: () => void;
  products?: Array<{ id: number; product_name?: string; color?: string; size?: string }>;
  uom?: string;
  canManage?: boolean;
}

export const StageReworkSection: React.FC<StageReworkSectionProps> = ({
  productionOrderId,
  stageId,
  stageCode,
  stageName,
  reworkRecords: initialRecords,
  onReload,
  products = [],
  uom = 'PCS',
  canManage = true,
}) => {
  const [records, setRecords] = useState<ReworkRecord[]>(initialRecords || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [reinspectModalOpen, setReinspectModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState<ReworkRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Forms
  const [sendForm, setSendForm] = useState({
    sent_date: new Date().toISOString().split('T')[0],
    vendor_name: '',
    dc_challan_no: '',
    remarks: '',
  });

  const [receiveForm, setReceiveForm] = useState({
    received_date: new Date().toISOString().split('T')[0],
    dc_challan_no: '',
    remarks: '',
  });

  const [reinspectForm, setReinspectForm] = useState({
    reinspection_date: new Date().toISOString().split('T')[0],
    accepted_quantity: 0,
    rejected_quantity: 0,
    inspector_name: 'QC Inspector',
    reinspection_result: 'Passed Audit',
    reinspection_notes: '',
  });

  const [createForm, setCreateForm] = useState({
    production_order_item_id: products[0]?.id || 0,
    rework_quantity: 1,
    rework_reason: 'Quality Correction',
    rework_remarks: '',
    destination_process: `${stageName} Correction`,
    color: products[0]?.color || '',
    size: products[0]?.size || '',
  });

  const loadRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getReworkRecords({
        production_order_id: productionOrderId,
        stage_id: stageId,
      });
      setRecords(res || []);
    } catch (err: any) {
      console.error('Failed to load rework records:', err);
      setError(err?.message || 'Failed to load rework records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialRecords) {
      setRecords(initialRecords);
    } else {
      loadRecords();
    }
  }, [productionOrderId, stageId, initialRecords]);

  // Aggregate stats
  const totalReworkQty = records.reduce((s, r) => s + Number(r.rework_quantity || 0), 0);
  const totalAcceptedAfterRework = records.reduce((s, r) => s + Number(r.accepted_quantity || 0), 0);
  const totalRejectedInRework = records.reduce((s, r) => s + Number(r.rejected_quantity || 0), 0);
  const pendingCorrectionQty = records
    .filter(r => r.status === 'Pending Rework' || r.status === 'Sent for Rework' || r.status === 'Rework Received' || r.status === 'Reinspection Pending')
    .reduce((s, r) => s + Math.max(0, Number(r.pending_quantity || (Number(r.rework_quantity) - Number(r.accepted_quantity || 0) - Number(r.rejected_quantity || 0)))), 0);

  // Handlers
  const handleOpenSend = (rec: ReworkRecord) => {
    setSelectedRecord(rec);
    setSendForm({
      sent_date: new Date().toISOString().split('T')[0],
      vendor_name: rec.vendor_name || `${stageName} Correction Unit`,
      dc_challan_no: rec.dc_challan_no || `DC-RWK-${Math.floor(1000 + Math.random() * 9000)}`,
      remarks: rec.rework_remarks || '',
    });
    setActionError(null);
    setSendModalOpen(true);
  };

  const handleOpenReceive = (rec: ReworkRecord) => {
    setSelectedRecord(rec);
    setReceiveForm({
      received_date: new Date().toISOString().split('T')[0],
      dc_challan_no: rec.dc_challan_no || '',
      remarks: '',
    });
    setActionError(null);
    setReceiveModalOpen(true);
  };

  const handleOpenReinspect = (rec: ReworkRecord) => {
    setSelectedRecord(rec);
    const pending = Math.max(0, Number(rec.pending_quantity || (Number(rec.rework_quantity) - Number(rec.accepted_quantity || 0) - Number(rec.rejected_quantity || 0))));
    setReinspectForm({
      reinspection_date: new Date().toISOString().split('T')[0],
      accepted_quantity: pending,
      rejected_quantity: 0,
      inspector_name: 'QC Inspector',
      reinspection_result: 'Passed Quality Audit',
      reinspection_notes: '',
    });
    setActionError(null);
    setReinspectModalOpen(true);
  };

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    try {
      setSubmitting(true);
      setActionError(null);
      await api.sendRework({
        rework_id: selectedRecord.id,
        sent_date: sendForm.sent_date,
        vendor_name: sendForm.vendor_name,
        dc_challan_no: sendForm.dc_challan_no,
        remarks: sendForm.remarks,
      });
      setSendModalOpen(false);
      await loadRecords();
      if (onReload) onReload();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to dispatch rework');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    try {
      setSubmitting(true);
      setActionError(null);
      await api.receiveRework({
        rework_id: selectedRecord.id,
        received_date: receiveForm.received_date,
        dc_challan_no: receiveForm.dc_challan_no,
        remarks: receiveForm.remarks,
      });
      setReceiveModalOpen(false);
      await loadRecords();
      if (onReload) onReload();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to record rework return');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReinspectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    const acc = Number(reinspectForm.accepted_quantity);
    const rej = Number(reinspectForm.rejected_quantity);
    const pending = Math.max(0, Number(selectedRecord.pending_quantity || (Number(selectedRecord.rework_quantity) - Number(selectedRecord.accepted_quantity || 0) - Number(selectedRecord.rejected_quantity || 0))));

    if (acc < 0 || rej < 0) {
      setActionError('Quantities cannot be negative');
      return;
    }
    if (acc + rej > pending + 0.001) {
      setActionError(`Accepted (${acc}) + Rejected (${rej}) cannot exceed pending rework (${pending})`);
      return;
    }
    if (acc + rej <= 0) {
      setActionError('Must accept or reject at least one piece to resolve');
      return;
    }

    try {
      setSubmitting(true);
      setActionError(null);
      await api.reinspectRework({
        rework_id: selectedRecord.id,
        accepted_quantity: acc,
        rejected_quantity: rej,
        reinspection_date: reinspectForm.reinspection_date,
        reinspection_result: reinspectForm.reinspection_result,
        reinspection_notes: reinspectForm.reinspection_notes,
        inspector_name: reinspectForm.inspector_name,
      });
      setReinspectModalOpen(false);
      await loadRecords();
      if (onReload) onReload();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to record reinspection');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(createForm.rework_quantity) <= 0) {
      setActionError('Rework quantity must be greater than zero');
      return;
    }
    try {
      setSubmitting(true);
      setActionError(null);
      const selProduct = products.find(p => p.id === Number(createForm.production_order_item_id));
      await api.createRework({
        production_order_id: productionOrderId,
        production_order_item_id: createForm.production_order_item_id,
        stage_id: stageId,
        stage_code: stageCode,
        product_name: selProduct?.product_name,
        color: createForm.color || selProduct?.color,
        size: createForm.size || selProduct?.size,
        rework_quantity: Number(createForm.rework_quantity),
        uom: uom,
        rework_reason: createForm.rework_reason,
        rework_remarks: createForm.rework_remarks,
        destination_process: createForm.destination_process,
      });
      setCreateModalOpen(false);
      await loadRecords();
      if (onReload) onReload();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to log rework');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: ReworkStatus) => {
    switch (status) {
      case 'Accepted After Rework':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Accepted After Rework
          </span>
        );
      case 'Sent for Rework':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Send className="w-3.5 h-3.5 text-blue-600" />
            Sent for Correction
          </span>
        );
      case 'Rework Received':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
            Return Received (Pending Audit)
          </span>
        );
      case 'Rejected':
      case 'Scrapped':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <X className="w-3.5 h-3.5 text-rose-600" />
            Scrapped / Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending Rework
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & SUMMARY KPIS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="text-base font-bold text-slate-900">
                {stageName} Rework & Correction Management
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                Stage {String(stageId).padStart(2, '0')} — {stageCode}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Quantity-based rework tracking. Only accepted quantities advance to the next production stage.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadRecords}
              disabled={loading}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setActionError(null);
                  setCreateModalOpen(true);
                }}
                className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Rework Item
              </Button>
            )}
          </div>
        </div>

        {/* 4 SUMMARY METRIC TILES */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-4">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
              Total Recorded Rework
            </span>
            <div className="text-2xl font-black text-amber-950 mt-1">
              {totalReworkQty.toLocaleString()} <span className="text-xs font-semibold text-amber-700">{uom}</span>
            </div>
            <span className="text-[11px] text-amber-700/80 mt-0.5 block">
              Logged across all batches
            </span>
          </div>

          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
              Outstanding in Correction
            </span>
            <div className="text-2xl font-black text-blue-950 mt-1">
              {pendingCorrectionQty.toLocaleString()} <span className="text-xs font-semibold text-blue-700">{uom}</span>
            </div>
            <span className="text-[11px] text-blue-700/80 mt-0.5 block">
              Pending rework completion
            </span>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              Accepted After Rework
            </span>
            <div className="text-2xl font-black text-emerald-950 mt-1">
              {totalAcceptedAfterRework.toLocaleString()} <span className="text-xs font-semibold text-emerald-700">{uom}</span>
            </div>
            <span className="text-[11px] text-emerald-700/80 mt-0.5 block">
              Returned & eligible for transfer
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Rejected / Scrapped
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {totalRejectedInRework.toLocaleString()} <span className="text-xs font-semibold text-slate-600">{uom}</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Unrepairable defects
            </span>
          </div>
        </div>
      </div>

      {/* REWORK RECORDS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Rework Cycle Records ({records.length})
          </span>
          <span className="text-xs text-slate-500">
            Traceable by cycle number and production order
          </span>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {records.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No Rework Quantities at this Stage</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              When garments or fabrics have defects during receipt or inspection, recording a rework quantity creates a traceable correction entry here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-bold">
                  <th className="py-3 px-4">Ref / Cycle</th>
                  <th className="py-3 px-4">Product & Color</th>
                  <th className="py-3 px-4 text-right">Rework Qty</th>
                  <th className="py-3 px-4 text-right">Accepted</th>
                  <th className="py-3 px-4 text-right">Pending</th>
                  <th className="py-3 px-4">Defect Reason & Destination</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((rec) => {
                  const pending = Math.max(0, Number(rec.pending_quantity || (Number(rec.rework_quantity) - Number(rec.accepted_quantity || 0) - Number(rec.rejected_quantity || 0))));
                  const isAccepted = rec.status === 'Accepted After Rework';
                  const isSent = rec.status === 'Sent for Rework';
                  const isReceived = rec.status === 'Rework Received' || rec.status === 'Reinspection Pending';
                  const isPending = rec.status === 'Pending Rework';

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Ref & Cycle */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900">{rec.rework_order_no}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.2 rounded border border-brand-200">
                            Cycle #{rec.cycle_number || 1}
                          </span>
                          {rec.batch_number && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {rec.batch_number}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Product & Color */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {rec.display_product_name || rec.product_name || 'Production Unit'}
                        </div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-2 mt-0.5">
                          {rec.color && (
                            <span className="font-medium text-slate-700">Color: {rec.color}</span>
                          )}
                          {rec.size && (
                            <span className="font-medium text-slate-700">Size: {rec.size}</span>
                          )}
                        </div>
                      </td>

                      {/* Rework Qty */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-slate-900 text-sm">
                          {Number(rec.rework_quantity).toLocaleString()} <span className="text-[11px] font-normal text-slate-500">{rec.uom || uom}</span>
                        </div>
                      </td>

                      {/* Accepted */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-emerald-700 text-sm">
                          {Number(rec.accepted_quantity || 0).toLocaleString()} <span className="text-[11px] font-normal text-emerald-600">{rec.uom || uom}</span>
                        </div>
                        {Number(rec.rejected_quantity || 0) > 0 && (
                          <div className="text-[10px] text-rose-600 font-medium">
                            {rec.rejected_quantity} scrapped
                          </div>
                        )}
                      </td>

                      {/* Pending */}
                      <td className="py-3.5 px-4 text-right">
                        <div className={`font-bold text-sm ${pending > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                          {pending.toLocaleString()} <span className="text-[11px] font-normal">{rec.uom || uom}</span>
                        </div>
                      </td>

                      {/* Defect Reason & Destination */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-800 line-clamp-1">
                          {rec.rework_reason || 'Quality Remediation'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {rec.destination_process || rec.target_stage_name || rec.vendor_name || 'In-House Correction'}
                          </span>
                        </div>
                        {rec.rework_remarks && (
                          <div className="text-[10px] text-slate-400 italic mt-0.5 truncate">
                            "{rec.rework_remarks}"
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {getStatusBadge(rec.status)}
                        {rec.sent_date && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            Sent: {rec.sent_date}
                          </div>
                        )}
                        {rec.reinspection_date && (
                          <div className="text-[10px] text-emerald-600 mt-0.5 font-medium">
                            Reinspected: {rec.reinspection_date}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Send for rework if pending */}
                          {(isPending || rec.status === 'Rejected') && canManage && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenSend(rec)}
                              className="text-[11px] py-1 px-2.5 h-auto font-bold text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100"
                              title="Send pieces to vendor or internal rework line"
                            >
                              <Send className="w-3 h-3 mr-1" />
                              Dispatch
                            </Button>
                          )}

                          {/* Record return if sent */}
                          {isSent && canManage && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenReceive(rec)}
                              className="text-[11px] py-1 px-2.5 h-auto font-bold text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100"
                              title="Record return of reworked pieces"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Receive Return
                            </Button>
                          )}

                          {/* Reinspect & resolve if received */}
                          {(isReceived || (!isAccepted && isSent)) && canManage && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenReinspect(rec)}
                              className="text-[11px] py-1 px-2.5 h-auto font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                              title="Audit repaired pieces and separate accepted from scrap"
                            >
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Re-inspect
                            </Button>
                          )}

                          {isAccepted && (
                            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 justify-end">
                              <Check className="w-3.5 h-3.5" />
                              Transferred
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------- MODAL 1: SEND FOR REWORK ---------------- */}
      <Modal
        open={sendModalOpen}
        onClose={() => !submitting && setSendModalOpen(false)}
        title={`Send for Rework Correction — ${selectedRecord?.rework_order_no}`}
        subtitle={`Dispatch ${selectedRecord?.rework_quantity} ${selectedRecord?.uom || uom} to correction line or vendor`}
      >
        <form onSubmit={handleSendSubmit} className="space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Product:</span>
              <span className="font-bold text-slate-800">{selectedRecord?.display_product_name || selectedRecord?.product_name || 'Garment Lot'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Defect Reason:</span>
              <span className="font-bold text-amber-700">{selectedRecord?.rework_reason || 'Defect Correction'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Quantity to Send:</span>
              <span className="font-black text-slate-900 text-sm">{selectedRecord?.rework_quantity} {selectedRecord?.uom || uom}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Sent Date *">
              <input
                type="date"
                value={sendForm.sent_date}
                onChange={e => setSendForm({ ...sendForm, sent_date: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white"
                required
              />
            </FormField>

            <FormField label="Delivery Challan / DC No">
              <input
                type="text"
                value={sendForm.dc_challan_no}
                onChange={e => setSendForm({ ...sendForm, dc_challan_no: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white"
                placeholder="e.g. DC-RWK-9281"
              />
            </FormField>
          </div>

          <FormField label="Vendor / Correction Destination *">
            <input
              type="text"
              value={sendForm.vendor_name}
              onChange={e => setSendForm({ ...sendForm, vendor_name: e.target.value })}
              className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white font-medium"
              placeholder="e.g. In-house Stitching Alteration or Vendor Name"
              required
            />
          </FormField>

          <FormField label="Remarks / Special Instructions">
            <textarea
              rows={2}
              value={sendForm.remarks}
              onChange={e => setSendForm({ ...sendForm, remarks: e.target.value })}
              className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white"
              placeholder="Describe required remediation (e.g., reset stitch tension, re-cut sleeve panel, re-dye off-shade lot)..."
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSendModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? 'Dispatching...' : 'Confirm Dispatch for Rework'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---------------- MODAL 2: RECEIVE REWORK RETURN ---------------- */}
      <Modal
        open={receiveModalOpen}
        onClose={() => !submitting && setReceiveModalOpen(false)}
        title={`Record Return from Rework — ${selectedRecord?.rework_order_no}`}
        subtitle={`Acknowledge arrival of corrected quantity before re-inspection`}
      >
        <form onSubmit={handleReceiveSubmit} className="space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Sent to:</span>
              <span className="font-bold text-slate-800">{selectedRecord?.vendor_name || selectedRecord?.destination_process || 'Correction Line'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sent Date:</span>
              <span className="font-semibold text-slate-700">{selectedRecord?.sent_date || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Returning Quantity:</span>
              <span className="font-black text-purple-950 text-sm">{selectedRecord?.rework_quantity} {selectedRecord?.uom || uom}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Return Received Date *">
              <input
                type="date"
                value={receiveForm.received_date}
                onChange={e => setReceiveForm({ ...receiveForm, received_date: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white"
                required
              />
            </FormField>

            <FormField label="Vendor Return DC / Inward Ref">
              <input
                type="text"
                value={receiveForm.dc_challan_no}
                onChange={e => setReceiveForm({ ...receiveForm, dc_challan_no: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white"
                placeholder="Vendor DC No or Inward Gate Pass"
              />
            </FormField>
          </div>

          <FormField label="Receiver Remarks / Inspection Pre-notes">
            <textarea
              rows={2}
              value={receiveForm.remarks}
              onChange={e => setReceiveForm({ ...receiveForm, remarks: e.target.value })}
              className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white"
              placeholder="Visual inspection on gate arrival, parcel condition..."
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setReceiveModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {submitting ? 'Recording...' : 'Record Return & Send to QC'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---------------- MODAL 3: RE-INSPECT & RESOLVE ---------------- */}
      <Modal
        open={reinspectModalOpen}
        onClose={() => !submitting && setReinspectModalOpen(false)}
        title={`Re-inspection & Rework Audit — ${selectedRecord?.rework_order_no}`}
        subtitle={`Audit corrected pieces. Accepted quantity will automatically become available for stage transfer.`}
      >
        <form onSubmit={handleReinspectSubmit} className="space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Quantity Reconciliation Card */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-amber-200/60">
              <span className="font-bold text-amber-900">Total Pending Under This Rework:</span>
              <span className="font-black text-amber-950 text-base">
                {Math.max(0, Number(selectedRecord?.pending_quantity || (Number(selectedRecord?.rework_quantity) - Number(selectedRecord?.accepted_quantity || 0) - Number(selectedRecord?.rejected_quantity || 0))))} {selectedRecord?.uom || uom}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] text-amber-800">
              <div>
                <span>Already Accepted (Prev Cycles):</span>
                <span className="font-bold ml-1 text-emerald-800">{selectedRecord?.accepted_quantity || 0}</span>
              </div>
              <div className="text-right">
                <span>Cycle Number:</span>
                <span className="font-bold ml-1">Cycle #{selectedRecord?.cycle_number || 1}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <FormField label={`Accepted Qty (${selectedRecord?.uom || uom}) *`}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={reinspectForm.accepted_quantity}
                  onChange={e => setReinspectForm({ ...reinspectForm, accepted_quantity: Math.max(0, Number(e.target.value)) })}
                  className="w-full text-sm font-black text-emerald-800 rounded-lg border border-emerald-300 py-2 px-3 bg-emerald-50/30 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </FormField>
              <span className="text-[10px] text-emerald-700 block mt-1">
                Passed QC. Will become eligible to transfer to next stage.
              </span>
            </div>

            <div>
              <FormField label={`Rejected / Scrap Qty (${selectedRecord?.uom || uom})`}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={reinspectForm.rejected_quantity}
                  onChange={e => setReinspectForm({ ...reinspectForm, rejected_quantity: Math.max(0, Number(e.target.value)) })}
                  className="w-full text-sm font-bold text-rose-800 rounded-lg border border-slate-300 py-2 px-3 bg-white"
                />
              </FormField>
              <span className="text-[10px] text-slate-500 block mt-1">
                Permanently rejected. Cannot be repaired further.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Re-inspection Date *">
              <input
                type="date"
                value={reinspectForm.reinspection_date}
                onChange={e => setReinspectForm({ ...reinspectForm, reinspection_date: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white"
                required
              />
            </FormField>

            <FormField label="Audited By (Inspector) *">
              <input
                type="text"
                value={reinspectForm.inspector_name}
                onChange={e => setReinspectForm({ ...reinspectForm, inspector_name: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white font-medium"
                required
              />
            </FormField>
          </div>

          <FormField label="Audit Result / Finding">
            <select
              value={reinspectForm.reinspection_result}
              onChange={e => setReinspectForm({ ...reinspectForm, reinspection_result: e.target.value })}
              className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white font-semibold text-slate-800"
            >
              <option value="Passed Quality Audit">Passed Quality Audit — Full Conformance</option>
              <option value="Passed with Minor Tolerance">Passed with Minor Tolerance</option>
              <option value="Partial Pass — Remaining Sent for Cycle 2">Partial Pass — Remainder Requires Further Rework</option>
              <option value="Failed — Scrapped">Failed Audit — Unserviceable / Scrapped</option>
            </select>
          </FormField>

          <FormField label="Reinspection Notes & Remarks">
            <textarea
              rows={2}
              value={reinspectForm.reinspection_notes}
              onChange={e => setReinspectForm({ ...reinspectForm, reinspection_notes: e.target.value })}
              className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white"
              placeholder="Detailed notes on seam strength, stitch tension, color fastness, measurements..."
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setReinspectModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {submitting ? 'Saving Resolution...' : 'Confirm Acceptance & Update Order'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---------------- MODAL 4: LOG MANUAL REWORK ---------------- */}
      <Modal
        open={createModalOpen}
        onClose={() => !submitting && setCreateModalOpen(false)}
        title={`Log Rework Item — ${stageName}`}
        subtitle={`Separate defect quantity and route to correction process without inflating order quantity`}
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{actionError}</span>
            </div>
          )}

          {products.length > 0 && (
            <FormField label="Select Product / Variant *">
              <select
                value={createForm.production_order_item_id}
                onChange={e => {
                  const selId = Number(e.target.value);
                  const p = products.find(x => x.id === selId);
                  setCreateForm({
                    ...createForm,
                    production_order_item_id: selId,
                    color: p?.color || '',
                    size: p?.size || '',
                  });
                }}
                className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white font-medium"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.product_name || `Item #${p.id}`} {p.color ? `— ${p.color}` : ''} {p.size ? `(${p.size})` : ''}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label={`Rework Quantity (${uom}) *`}>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={createForm.rework_quantity}
                onChange={e => setCreateForm({ ...createForm, rework_quantity: Math.max(0, Number(e.target.value)) })}
                className="w-full text-xs font-bold text-amber-900 rounded-lg border border-amber-300 py-2 px-3 bg-amber-50/30"
                required
              />
            </FormField>

            <FormField label="Defect Reason / Issue *">
              <input
                type="text"
                value={createForm.rework_reason}
                onChange={e => setCreateForm({ ...createForm, rework_reason: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white font-semibold"
                placeholder={
                  stageId === 4 ? "Shade Mismatch / Uneven Dyeing" :
                  stageId === 5 ? "Incorrect Dimensions / Pattern Defect" :
                  stageId === 6 ? "Missing Stitches / Thread Snag" :
                  stageId === 7 ? "Broken Seam / Stitching Defect" :
                  "Quality Finishing Defect"
                }
                required
              />
            </FormField>
          </div>

          <FormField label="Destination Correction Process *">
            <input
              type="text"
              value={createForm.destination_process}
              onChange={e => setCreateForm({ ...createForm, destination_process: e.target.value })}
              className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white font-medium"
              placeholder="e.g. Dyeing Mill Re-dye, Cutting Recut, Sewing Line Alteration"
              required
            />
          </FormField>

          <FormField label="Defect Remarks & Notes">
            <textarea
              rows={2}
              value={createForm.rework_remarks}
              onChange={e => setCreateForm({ ...createForm, rework_remarks: e.target.value })}
              className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white"
              placeholder="Optional notes for supervisor and operators..."
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {submitting ? 'Creating...' : 'Log Rework Record'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StageReworkSection;
