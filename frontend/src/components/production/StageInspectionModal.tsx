import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, User, Calendar, FileText, ArrowRight } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { api } from '../../lib/api';

export interface StageInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  productionOrderId: number;
  stageId: number;
  stageCode: string;
  referenceId?: string | number;
  referenceType: string;
  batchNumber?: string;
  color?: string;
  size?: string;
  productName?: string;
  productionOrderItemId?: number;
  availableQuantity: number;
  uom?: string;
  supportsRejection?: boolean;
  vendorName?: string;
  onSuccess: () => void;
}

const STAGE_DEFECT_REASONS: Record<number, string[]> = {
  4: [
    'Shade Variation / Off-tone',
    'Uneven Dyeing / Patchiness',
    'Color Fastness Failure / Bleeding',
    'Listing / Center-to-Selvedge Variation',
    'Water Marks / Chemical Stains',
    'Fabric Shrinkage Outside Tolerance',
    'Other Dyeing Defect',
  ],
  5: [
    'Notch / Alignment Defect',
    'Grain Line Distortion',
    'Size Variation / Pattern Mismatch',
    'Bundle Mix-up / Labeling Error',
    'Fraying / Slit Imperfection',
    'Other Cutting Defect',
  ],
  6: [
    'Thread Breakage / Missing Stitches',
    'Tension Issue / Looping',
    'Registration / Placement Off-center',
    'Wrong Thread Color / Shade Mismatch',
    'Fabric Puckering / Hooping Mark',
    'Other Embroidery Defect',
  ],
  7: [
    'Broken / Skipped Stitch',
    'Seam Puckering / Tension Issue',
    'Open Seam / Missed Catch',
    'Asymmetric Collar / Placket / Hem',
    'Measurement Out of Tolerance',
    'Needle Cut / Oil Stain',
    'Other Stitching Defect',
  ],
  8: [
    'Measurement Out of Spec',
    'Seam Defect / Skipped Stitches',
    'Embroidery Imperfection',
    'Fabric Flaw / Hole / Slub',
    'Oil / Grease / Iron Mark',
    'Button / Zipper / Hardware Defect',
    'Label / Tag Misplacement',
    'Other Garment Defect',
  ],
};

const CHECKING_REWORK_DESTINATIONS = [
  { value: 'STITCHING', label: 'Stitching Floor — Seam / Alteration' },
  { value: 'EMBROIDERY', label: 'Embroidery Vendor — Thread / Correction' },
  { value: 'CUTTING', label: 'Cutting Floor — Recutting Panel' },
  { value: 'DYEING', label: 'Dyeing Mill — Stain / Spotting Review' },
  { value: 'ALTERATION', label: 'Finishing Line — Trimming / Spot Cleaning' },
];

export const StageInspectionModal: React.FC<StageInspectionModalProps> = ({
  isOpen,
  onClose,
  title,
  productionOrderId,
  stageId,
  stageCode,
  referenceId,
  referenceType,
  batchNumber,
  color,
  size,
  productName,
  productionOrderItemId,
  availableQuantity,
  uom = 'PCS',
  supportsRejection = true,
  vendorName,
  onSuccess,
}) => {
  const [inspectedQty, setInspectedQty] = useState<number>(availableQuantity || 0);
  const [acceptedQty, setAcceptedQty] = useState<number>(availableQuantity || 0);
  const [reworkQty, setReworkQty] = useState<number>(0);
  const [rejectedQty, setRejectedQty] = useState<number>(0);

  const defaultReasons = STAGE_DEFECT_REASONS[stageId] || STAGE_DEFECT_REASONS[8];
  const [defectReason, setDefectReason] = useState<string>(defaultReasons[0] || 'Quality Defect');
  const [customReason, setCustomReason] = useState<string>('');
  const [reworkDestination, setReworkDestination] = useState<string>(stageId === 8 ? 'STITCHING' : `${stageCode} Line`);
  const [remarks, setRemarks] = useState<string>('');
  const [inspector, setInspector] = useState<string>('QC Inspector');
  const [inspectionDate, setInspectionDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initAvail = Math.max(0, Number(availableQuantity) || 0);
      setInspectedQty(initAvail);
      setAcceptedQty(initAvail);
      setReworkQty(0);
      setRejectedQty(0);
      setError(null);
      setDefectReason(defaultReasons[0] || 'Quality Defect');
      setCustomReason('');
      setRemarks('');
      setInspector('QC Inspector');
      setInspectionDate(new Date().toISOString().split('T')[0]);
      if (stageId === 8) {
        setReworkDestination('STITCHING');
      }
    }
  }, [isOpen, availableQuantity, stageId]);

  // Handle inspected quantity changes
  const handleInspectedChange = (val: number) => {
    const num = Math.max(0, val);
    setInspectedQty(num);
    const nonAcc = reworkQty + rejectedQty;
    setAcceptedQty(Math.max(0, Number((num - nonAcc).toFixed(2))));
  };

  const handleAcceptedChange = (val: number) => {
    const num = Math.max(0, val);
    setAcceptedQty(num);
  };

  const handleReworkChange = (val: number) => {
    const num = Math.max(0, val);
    setReworkQty(num);
    // Auto-adjust accepted so sum matches inspected
    const rem = Math.max(0, Number((inspectedQty - num - rejectedQty).toFixed(2)));
    setAcceptedQty(rem);
  };

  const handleRejectedChange = (val: number) => {
    const num = Math.max(0, val);
    setRejectedQty(num);
    // Auto-adjust accepted so sum matches inspected
    const rem = Math.max(0, Number((inspectedQty - reworkQty - num).toFixed(2)));
    setAcceptedQty(rem);
  };

  const allocatedTotal = Number((acceptedQty + reworkQty + rejectedQty).toFixed(2));
  const isBalanced = Math.abs(allocatedTotal - inspectedQty) < 0.01;
  const difference = Number((inspectedQty - allocatedTotal).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inspectedQty <= 0) {
      setError('Inspected quantity must be greater than zero.');
      return;
    }

    if (!isBalanced) {
      setError(`Quantity reconciliation failed: Inspected quantity (${inspectedQty}) must equal Accepted (${acceptedQty}) + Rework (${reworkQty}) + Rejected (${rejectedQty}).`);
      return;
    }

    if ((reworkQty > 0 || rejectedQty > 0) && defectReason === 'Other' && !customReason.trim()) {
      setError('Please specify the custom defect reason.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const finalDefect = defectReason === 'Other' && customReason.trim() ? customReason.trim() : defectReason;

    try {
      await api.recordQualityInspection({
        production_order_id: productionOrderId,
        production_order_item_id: productionOrderItemId || 0,
        stage_id: stageId,
        stage_code: stageCode,
        reference_id: referenceId ? String(referenceId) : undefined,
        reference_type: referenceType,
        batch_number: batchNumber || referenceId ? String(batchNumber || referenceId) : undefined,
        submitted_quantity: inspectedQty,
        checked_quantity: inspectedQty,
        passed_quantity: acceptedQty,
        rework_quantity: reworkQty,
        rejected_quantity: rejectedQty,
        uom,
        defect_category: finalDefect,
        defect_description: remarks || finalDefect,
        rework_destination: reworkDestination,
        rework_reason: finalDefect,
        color,
        size,
        vendor_name: vendorName,
        inspector,
        inspection_date: inspectionDate,
        remarks,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Inspection failed:', err);
      setError(err?.message || 'Failed to record quality inspection. Please check quantities.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || `Quality Inspection — Stage 0${stageId}: ${stageCode}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Source Summary Card */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-xs">
                {referenceType} {referenceId ? `— ${referenceId}` : ''}
              </p>
              <p className="text-[11px] text-slate-500">
                {productName ? `${productName} ` : ''}
                {color ? `• Color: ${color} ` : ''}
                {size ? `• Size: ${size} ` : ''}
                {vendorName ? `• Vendor: ${vendorName}` : ''}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Available For Inspection
            </span>
            <span className="text-sm font-mono font-bold text-brand-700">
              {availableQuantity} {uom}
            </span>
          </div>
        </div>

        {/* Quantity Breakdown Grid */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />
            Quantity Reconciliation Breakdown
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Inspected Qty ({uom}) *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                max={availableQuantity}
                value={inspectedQty || ''}
                onChange={(e) => handleInspectedChange(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Total lot evaluated</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-emerald-800 mb-1">
                Accepted Qty ({uom}) *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                max={inspectedQty}
                value={acceptedQty}
                onChange={(e) => handleAcceptedChange(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-emerald-300 bg-emerald-50/50 rounded-lg font-mono font-bold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                required
              />
              <span className="text-[10px] text-emerald-600 mt-0.5 block">Eligible to advance</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                Rework Required ({uom})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                max={inspectedQty}
                value={reworkQty}
                onChange={(e) => handleReworkChange(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-amber-300 bg-amber-50/50 rounded-lg font-mono font-bold text-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
              />
              <span className="text-[10px] text-amber-600 mt-0.5 block">Needs correction</span>
            </div>

            {supportsRejection ? (
              <div>
                <label className="block text-[11px] font-semibold text-rose-800 mb-1">
                  Rejected / Scrap ({uom})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max={inspectedQty}
                  value={rejectedQty}
                  onChange={(e) => handleRejectedChange(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-rose-300 bg-rose-50/50 rounded-lg font-mono font-bold text-rose-800 focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs"
                />
                <span className="text-[10px] text-rose-600 mt-0.5 block">Permanently lost</span>
              </div>
            ) : (
              <div className="flex items-center text-slate-400 text-[11px] italic pt-5">
                Rejections not applicable
              </div>
            )}
          </div>

          {/* Live Balancing Formula Alert */}
          <div
            className={`p-2.5 rounded-lg border flex items-center justify-between text-[11px] transition ${
              isBalanced
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>
                <strong>Formula:</strong> {inspectedQty} {uom} = {acceptedQty} (Accepted) + {reworkQty} (Rework)
                {supportsRejection && ` + ${rejectedQty} (Scrap)`}
              </span>
            </div>
            <span className="font-mono font-bold">
              {isBalanced ? '✓ Reconciled' : `Discrepancy: ${difference > 0 ? `+${difference}` : difference} ${uom}`}
            </span>
          </div>
        </div>

        {/* Defect Details (Shows when Rework > 0 or Rejected > 0) */}
        {(reworkQty > 0 || rejectedQty > 0) && (
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Defect Classification & Corrective Routing
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Defect Reason / Category *
                </label>
                <select
                  value={defectReason}
                  onChange={(e) => setDefectReason(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs bg-white"
                >
                  {defaultReasons.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="Other">Other (Specify Below)</option>
                </select>
              </div>

              {stageId === 8 ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Rework Destination Routing *
                  </label>
                  <select
                    value={reworkDestination}
                    onChange={(e) => setReworkDestination(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs bg-white font-semibold"
                  >
                    {CHECKING_REWORK_DESTINATIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Correction Venue / Destination
                  </label>
                  <input
                    type="text"
                    value={reworkDestination}
                    onChange={(e) => setReworkDestination(e.target.value)}
                    placeholder="e.g. Vendor Outward, Internal Table"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs bg-white"
                  />
                </div>
              )}
            </div>

            {defectReason === 'Other' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Specify Custom Defect Reason *
                </label>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter specific defect description..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs bg-white"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Correction Instructions / Notes
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Specific guidance for rectification line or vendor..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs bg-white"
              />
            </div>
          </div>
        )}

        {/* Auditor Signature & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Inspector / Auditor Name *
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={inspector}
                onChange={(e) => setInspector(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Inspection Date *
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs"
                required
              />
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 italic">
            {reworkQty > 0
              ? `* ${reworkQty} ${uom} will be logged to Rework Management for dispatch.`
              : `* All ${acceptedQty} ${uom} will be unlocked for forward transfer.`}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submitting || !isBalanced}
              className="gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {submitting ? 'Recording Inspection...' : 'Save Quality Inspection'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default StageInspectionModal;
