import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import {
  Clock,
  AlertTriangle,
  Eye,
  CheckCircle2,
  ShieldCheck,
  FileText,
  User,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';

interface Props {
  orderId: number;
  stageId: number;
  onPendingStatusChange?: (hasPending: boolean) => void;
  className?: string;
}

export default function PendingApprovalBanner({
  orderId,
  stageId,
  onPendingStatusChange,
  className = '',
}: Props) {
  const [loading, setLoading] = useState(true);
  const [pendingRequest, setPendingRequest] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const checkPending = async () => {
    if (!orderId || !stageId) return;
    try {
      const res = await api.getPendingApprovalForStage(orderId, stageId);
      if (res && res.has_pending && res.request) {
        setPendingRequest(res.request);
        if (onPendingStatusChange) onPendingStatusChange(true);
      } else {
        setPendingRequest(null);
        if (onPendingStatusChange) onPendingStatusChange(false);
      }
    } catch (e) {
      // Ignore or log error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkPending();
  }, [orderId, stageId]);

  if (loading || !pendingRequest) {
    return null;
  }

  return (
    <>
      <div
        className={`bg-amber-50 border border-amber-200 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${className}`}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-amber-900">
                Modification Pending Admin Approval
              </span>
              <span className="font-mono px-2 py-0.5 rounded bg-amber-200/60 text-amber-900 font-semibold text-[11px]">
                {pendingRequest.request_number}
              </span>
            </div>
            <p className="text-amber-800 text-[11px] mt-0.5">
              Submitted by <strong>{pendingRequest.requested_by_name}</strong> ({pendingRequest.requested_by_role}) on{' '}
              {new Date(pendingRequest.requested_at).toLocaleString('en-IN')}.
            </p>
            <p className="text-amber-700/80 text-[10px] mt-0.5 italic">
              Active production records remain unchanged until an Administrator approves this request.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalOpen(true)}
            icon={<Eye className="w-3.5 h-3.5" />}
            className="border-amber-300 text-amber-900 hover:bg-amber-100/60 text-xs"
          >
            View Proposed Changes
          </Button>
        </div>
      </div>

      {/* View Proposed Changes Modal */}
      {modalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setModalOpen(false)}
          title={`Pending Modification: ${pendingRequest.request_number}`}
          subtitle={`Submitted for ${pendingRequest.stage_name}`}
          size="lg"
          footer={
            <div className="flex justify-end w-full">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Requester & Date Card */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Submitted By</span>
                <span className="font-bold text-slate-800">{pendingRequest.requested_by_name}</span>
                <span className="text-[11px] text-slate-500 block">({pendingRequest.requested_by_role})</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Submitted At</span>
                <span className="font-medium text-slate-700">
                  {new Date(pendingRequest.requested_at).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Reason */}
            <div>
              <span className="font-bold text-slate-700 block mb-1">Reason for Modification:</span>
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-slate-800 font-medium whitespace-pre-wrap">
                "{pendingRequest.modification_reason}"
              </div>
            </div>

            {/* Proposed Data Preview */}
            <div>
              <span className="font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                Proposed Changes:
              </span>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono max-h-60 overflow-y-auto">
                {JSON.stringify(pendingRequest.proposed_data, null, 2)}
              </pre>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800">
              <ShieldCheck className="w-4 h-4 text-blue-600 inline mr-1" />
              <strong>Strict Option A in Effect:</strong> These changes are purely staging data. Production calculations, inventory, and downline processes continue to use the active approved data until Admin approval.
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

