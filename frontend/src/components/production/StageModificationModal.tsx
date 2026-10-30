import React, { useState } from 'react';
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
  ShieldAlert
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
  const [targetDate, setTargetDate] = useState<string>(
    currentSnapshot.target_delivery_date ? currentSnapshot.target_delivery_date.split(' ')[0] : ''
  );
  const [priority, setPriority] = useState<string>(currentSnapshot.priority || 'Medium');
  const [stageNotes, setStageNotes] = useState<string>(currentSnapshot.notes || '');

  // Custom key-value proposed changes or stage specific fields
  const [modificationReason, setModificationReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modificationReason.trim()) {
      setError('Please provide a mandatory reason explaining why this modification is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    // Prepare proposed payload
    const proposed: Record<string, any> = {
      order_title: orderTitle || currentSnapshot.order_title,
      target_delivery_date: targetDate || currentSnapshot.target_delivery_date,
      priority: priority || currentSnapshot.priority,
      notes: stageNotes,
    };

    // If items exist in current snapshot, retain structure for potential quantity adjustments
    if (currentSnapshot.items && Array.isArray(currentSnapshot.items)) {
      proposed.items = currentSnapshot.items;
    }

    // Preserve any existing stage specific records if passed
    if (currentSnapshot.dyeing_orders) proposed.dyeing_orders = currentSnapshot.dyeing_orders;
    if (currentSnapshot.cutting_batches) proposed.cutting_batches = currentSnapshot.cutting_batches;
    if (currentSnapshot.embroidery_jobs) proposed.embroidery_jobs = currentSnapshot.embroidery_jobs;
    if (currentSnapshot.stitching_batches) proposed.stitching_batches = currentSnapshot.stitching_batches;
    if (currentSnapshot.packing_batches) proposed.packing_batches = currentSnapshot.packing_batches;

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
      size="xl"
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
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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

        {/* Editable fields */}
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
      </form>
    </Modal>
  );
}

