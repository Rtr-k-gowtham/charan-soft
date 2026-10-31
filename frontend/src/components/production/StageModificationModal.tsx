import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import {
  AlertTriangle,
  Send,
  Layers,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  ShieldAlert,
  Edit3
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  orderNumber: string;
  orderTitle?: string;
  stageId: number;
  stageName: string;
  currentSnapshot?: Record<string, any>;
  onSuccess?: () => void;
}

export default function StageModificationModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  orderTitle,
  stageId,
  stageName,
  currentSnapshot = {},
  onSuccess,
}: Props) {
  // Common editable fields
  const [targetDate, setTargetDate] = useState<string>('');
  const [priority, setPriority] = useState<string>('Medium');
  const [stageNotes, setStageNotes] = useState<string>('');

  // Stage-specific editable records
  const [items, setItems] = useState<any[]>([]);
  const [dyeingOrders, setDyeingOrders] = useState<any[]>([]);
  const [cuttingBatches, setCuttingBatches] = useState<any[]>([]);
  const [stitchingBatches, setStitchingBatches] = useState<any[]>([]);
  const [packingBatches, setPackingBatches] = useState<any[]>([]);
  const [dispatchRecords, setDispatchRecords] = useState<any[]>([]);

  // Custom key-value proposed changes or stage specific fields
  const [modificationReason, setModificationReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTargetDate(
        currentSnapshot.target_delivery_date
          ? currentSnapshot.target_delivery_date.split(' ')[0]
          : ''
      );
      setPriority(currentSnapshot.priority || 'Medium');
      setStageNotes(currentSnapshot.notes || '');

      setItems(
        currentSnapshot.items && Array.isArray(currentSnapshot.items)
          ? JSON.parse(JSON.stringify(currentSnapshot.items))
          : []
      );
      setDyeingOrders(
        currentSnapshot.dyeing_orders && Array.isArray(currentSnapshot.dyeing_orders)
          ? JSON.parse(JSON.stringify(currentSnapshot.dyeing_orders))
          : []
      );
      setCuttingBatches(
        currentSnapshot.cutting_batches && Array.isArray(currentSnapshot.cutting_batches)
          ? JSON.parse(JSON.stringify(currentSnapshot.cutting_batches))
          : []
      );
      setStitchingBatches(
        currentSnapshot.stitching_batches && Array.isArray(currentSnapshot.stitching_batches)
          ? JSON.parse(JSON.stringify(currentSnapshot.stitching_batches))
          : []
      );
      setPackingBatches(
        currentSnapshot.packing_batches && Array.isArray(currentSnapshot.packing_batches)
          ? JSON.parse(JSON.stringify(currentSnapshot.packing_batches))
          : []
      );
      setDispatchRecords(
        currentSnapshot.dispatch_records && Array.isArray(currentSnapshot.dispatch_records)
          ? JSON.parse(JSON.stringify(currentSnapshot.dispatch_records))
          : []
      );

      setModificationReason('');
      setError('');
    }
  }, [isOpen, currentSnapshot]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modificationReason.trim()) {
      setError('Please provide a mandatory reason explaining why this modification is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    // Prepare proposed payload with all edited values
    const proposed: Record<string, any> = {
      order_title: orderTitle || currentSnapshot.order_title,
      target_delivery_date: targetDate || currentSnapshot.target_delivery_date,
      priority: priority || currentSnapshot.priority,
      notes: stageNotes,
    };

    if (items.length > 0) proposed.items = items;
    if (dyeingOrders.length > 0) proposed.dyeing_orders = dyeingOrders;
    if (cuttingBatches.length > 0) proposed.cutting_batches = cuttingBatches;
    if (stitchingBatches.length > 0) proposed.stitching_batches = stitchingBatches;
    if (packingBatches.length > 0) proposed.packing_batches = packingBatches;
    if (dispatchRecords.length > 0) proposed.dispatch_records = dispatchRecords;

    try {
      await api.createApprovalRequest({
        production_order_id: orderId,
        stage_id: stageId,
        stage_name: stageName,
        modification_reason: modificationReason.trim(),
        proposed_data: proposed,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit modification request to Admin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Stage Modification"
      subtitle={`${stageName} for Order ${orderNumber}`}
      size="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-[11px] text-slate-400">
            Strict Option A: Active data remains untouched until Admin approval.
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting}
              icon={<Send className="w-4 h-4" />}
            >
              {submitting ? 'Submitting...' : 'Submit to Admin'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
        {/* Option A Notice Banner */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">Centralized Admin Approval Workflow</span>
            <p className="text-[11px] text-amber-800">
              Your modifications will be queued for Admin review. The live production order, downstream processes, stock levels, and calculations will <strong>not</strong> be affected until an Administrator explicitly approves the request.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Modification request successfully submitted to Admin!</span>
          </div>
        )}

        {/* Order Details Badge */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Production Order</span>
            <span className="font-bold text-slate-900">{orderNumber}</span>
            {orderTitle && <span className="block text-[11px] text-slate-500">{orderTitle}</span>}
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Production Stage</span>
            <span className="font-semibold text-brand-700 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              {stageName}
            </span>
          </div>
        </div>

        {/* Modification Reason (Mandatory) */}
        <FormField label="Reason for Modification *">
          <textarea
            rows={3}
            required
            value={modificationReason}
            onChange={(e) => setModificationReason(e.target.value)}
            placeholder="Explain why this stage modification is required (e.g. Buyer updated delivery schedule, mill shade revision, defect rectification, yarn inward variance)..."
            className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
          />
        </FormField>

        {/* Order-level Editable fields */}
        <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
            General Order Information
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Target Delivery Date">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
              />
            </FormField>

            <FormField label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </FormField>
          </div>

          <FormField label="Stage Notes & Operational Remarks">
            <textarea
              rows={2}
              value={stageNotes}
              onChange={(e) => setStageNotes(e.target.value)}
              placeholder="Enter any updated instructions or notes for this stage..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
            />
          </FormField>
        </div>

        {/* Stage-Specific Editable Section: Line Items (Stage 01 / General) */}
        {items.length > 0 && (
          <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Product Line Items &amp; Quantities
              </span>
              <span className="text-[10px] text-slate-400">Modify line item planned quantities</span>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3">Color / Size</th>
                    <th className="py-2 px-3 w-28">Quantity (pcs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-2 px-3 font-medium text-slate-800">
                        {item.product_name || 'Garment Product'}
                        {item.product_sku && <span className="block text-[10px] text-slate-400">{item.product_sku}</span>}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {item.color || item.pantone_color || 'Standard'} {item.size ? `(${item.size})` : ''}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          value={item.quantity ?? ''}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx] = { ...newItems[idx], quantity: Number(e.target.value) };
                            setItems(newItems);
                          }}
                          className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 bg-white text-right font-mono"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stage-Specific Editable Section: Stage 04 Dyeing Orders */}
        {dyeingOrders.length > 0 && (
          <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Dyeing Batches &amp; Outward Quantities
              </span>
              <span className="text-[10px] text-slate-400">Modify mill outward quantities &amp; return dates</span>
            </div>
            <div className="space-y-2">
              {dyeingOrders.map((dOrder, idx) => (
                <div key={dOrder.id || idx} className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Batch #{dOrder.id} — {dOrder.mill_name || dOrder.supplier_name || 'Dyeing Mill'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                      {dOrder.shade || dOrder.pantone_color || 'Dyeing'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Outward Quantity (MTR)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={dOrder.outward_quantity ?? ''}
                        onChange={(e) => {
                          const updated = [...dyeingOrders];
                          updated[idx] = { ...updated[idx], outward_quantity: Number(e.target.value) };
                          setDyeingOrders(updated);
                        }}
                        className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Expected Return Date</label>
                      <input
                        type="date"
                        value={dOrder.expected_return_date ? dOrder.expected_return_date.split(' ')[0] : ''}
                        onChange={(e) => {
                          const updated = [...dyeingOrders];
                          updated[idx] = { ...updated[idx], expected_return_date: e.target.value };
                          setDyeingOrders(updated);
                        }}
                        className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage-Specific Editable Section: Stage 05 Cutting Batches */}
        {cuttingBatches.length > 0 && (
          <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Cutting Batches
            </span>
            <div className="space-y-2">
              {cuttingBatches.map((cb, idx) => (
                <div key={cb.id || idx} className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Batch #{cb.batch_number || cb.id} — {cb.product_name || 'Garment Product'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Cut Quantity (pcs)</label>
                      <input
                        type="number"
                        min="0"
                        value={cb.cut_quantity ?? cb.actual_cut_quantity ?? ''}
                        onChange={(e) => {
                          const updated = [...cuttingBatches];
                          updated[idx] = { ...updated[idx], cut_quantity: Number(e.target.value) };
                          setCuttingBatches(updated);
                        }}
                        className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Waste / Scrap Quantity (pcs)</label>
                      <input
                        type="number"
                        min="0"
                        value={cb.waste_quantity ?? cb.rejected_quantity ?? ''}
                        onChange={(e) => {
                          const updated = [...cuttingBatches];
                          updated[idx] = { ...updated[idx], waste_quantity: Number(e.target.value) };
                          setCuttingBatches(updated);
                        }}
                        className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage-Specific Editable Section: Stage 07 Stitching Batches */}
        {stitchingBatches.length > 0 && (
          <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Stitching Batches
            </span>
            <div className="space-y-2">
              {stitchingBatches.map((sb, idx) => (
                <div key={sb.id || idx} className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Batch #{sb.batch_number || sb.id} — {sb.product_name || 'Garment'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Stitched Quantity (pcs)</label>
                      <input
                        type="number"
                        min="0"
                        value={sb.stitched_quantity ?? sb.completed_quantity ?? ''}
                        onChange={(e) => {
                          const updated = [...stitchingBatches];
                          updated[idx] = { ...updated[idx], stitched_quantity: Number(e.target.value) };
                          setStitchingBatches(updated);
                        }}
                        className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Defect / Rework Qty (pcs)</label>
                      <input
                        type="number"
                        min="0"
                        value={sb.defect_quantity ?? sb.rework_quantity ?? ''}
                        onChange={(e) => {
                          const updated = [...stitchingBatches];
                          updated[idx] = { ...updated[idx], defect_quantity: Number(e.target.value) };
                          setStitchingBatches(updated);
                        }}
                        className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

