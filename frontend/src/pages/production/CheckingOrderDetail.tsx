// src/pages/production/CheckingOrderDetail.tsx
// Stage 08: Checking / Quality Inspection — Traceable Defect Logging, Reinspection Flow & Pass Rate Analytics
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, QualityInspection } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import {
  ArrowLeft,
  CheckCircle,
  RefreshCw,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Calendar,
  Camera,
  Image as ImageIcon,
  User,
  Trash2,
  ZoomIn,
  Eye,
  CheckCheck,
  FileText,
  RotateCcw,
  Percent,
  XCircle
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n || 0);

function processImageFile(file: File, maxDimension = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const DEFECT_CATEGORIES = [
  'Measurement Tolerance Out of Spec',
  'Open Seam / Broken Stitch',
  'Oil Stain / Fabric Spot',
  'Color Shading / Tone Difference',
  'Skip Stitch / Needle Hole',
  'Thread Tension / Loose Loop',
  'Raw Edge / Hemming Irregularity',
  'Button / Trims Placement Error'
];

export default function CheckingOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Inspection Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isReinspection, setIsReinspection] = useState(false);
  const [originalInspectionId, setOriginalInspectionId] = useState<number | undefined>(undefined);

  const [form, setForm] = useState({
    inspection_date: new Date().toISOString().split('T')[0],
    submitted_quantity: 0,
    checked_quantity: 0,
    passed_quantity: 0,
    rejected_quantity: 0,
    rework_quantity: 0,
    defect_category: DEFECT_CATEGORIES[0],
    defect_description: '',
    inspector: 'P. Selvam (Lead QC Inspector)',
    remarks: 'AQL 2.5 Major / 4.0 Minor visual & measurement inspection protocol followed.'
  });
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [savingInspection, setSavingInspection] = useState(false);
  const [formError, setFormError] = useState('');

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Stage Transfer Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const fetchOrderData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const [orderRes, stagesRes, inspRes] = await Promise.all([
        api.getProductionOrder(Number(id)),
        api.getProductionStages(),
        api.getQualityInspections(Number(id))
      ]);

      const ord = (orderRes as any)?.data || orderRes;
      setOrder(ord);
      setItems(ord.items || []);

      const st = (stagesRes as any)?.data || stagesRes;
      setStages(Array.isArray(st) ? st : []);

      const ins = (inspRes as any)?.data || inspRes;
      setInspections(Array.isArray(ins) ? ins : []);
    } catch (err: any) {
      console.error('Failed to load quality checking stage data:', err);
      setError(err?.message || 'Failed to load quality checking stage data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderData();
  }, [id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Group inspections by item
  const inspectionsByItem = useMemo(() => {
    const map: Record<number, QualityInspection[]> = {};
    inspections.forEach(ins => {
      if (!map[ins.production_order_item_id]) {
        map[ins.production_order_item_id] = [];
      }
      map[ins.production_order_item_id].push(ins);
    });
    return map;
  }, [inspections]);

  // Summarize product-wise QA metrics
  const summaryByItem = useMemo(() => {
    const map: Record<number, {
      totalSubmitted: number;
      totalChecked: number;
      totalPassed: number;
      totalFailed: number;
      totalRejected: number;
      totalRework: number;
      pendingCheck: number;
    }> = {};

    items.forEach(it => {
      const itIns = inspectionsByItem[it.id] || [];
      const totalSubmitted = itIns.reduce((sum, i) => sum + Number(i.submitted_quantity || 0), 0);
      const totalChecked = itIns.reduce((sum, i) => sum + Number(i.checked_quantity || 0), 0);
      const totalPassed = itIns.reduce((sum, i) => sum + Number(i.passed_quantity || 0), 0);
      const totalFailed = itIns.reduce((sum, i) => sum + Number(i.failed_quantity || 0), 0);
      const totalRejected = itIns.reduce((sum, i) => sum + Number(i.rejected_quantity || 0), 0);
      const totalRework = itIns.reduce((sum, i) => sum + Number(i.rework_quantity || 0), 0);
      const pendingCheck = Math.max(0, Number(it.quantity || 0) - totalPassed);

      map[it.id] = {
        totalSubmitted,
        totalChecked,
        totalPassed,
        totalFailed,
        totalRejected,
        totalRework,
        pendingCheck
      };
    });

    return map;
  }, [items, inspectionsByItem]);

  // Overall totals across all products
  const overallTotals = useMemo(() => {
    let orderQty = 0;
    let checkedQty = 0;
    let passedQty = 0;
    let failedQty = 0;
    let rejectedQty = 0;
    let reworkQty = 0;

    items.forEach(it => {
      orderQty += Number(it.quantity || 0);
      const s = summaryByItem[it.id];
      if (s) {
        checkedQty += s.totalChecked;
        passedQty += s.totalPassed;
        failedQty += s.totalFailed;
        rejectedQty += s.totalRejected;
        reworkQty += s.totalRework;
      }
    });

    const passRate = checkedQty > 0 ? ((passedQty / checkedQty) * 100).toFixed(1) : '100.0';
    const rejectRate = checkedQty > 0 ? ((rejectedQty / checkedQty) * 100).toFixed(1) : '0.0';
    const reworkRate = checkedQty > 0 ? ((reworkQty / checkedQty) * 100).toFixed(1) : '0.0';

    return {
      orderQty,
      checkedQty,
      passedQty,
      failedQty,
      rejectedQty,
      reworkQty,
      passRate,
      rejectRate,
      reworkRate
    };
  }, [items, summaryByItem]);

  // Open Inspection Modal
  const handleOpenInspectionModal = (item: any, isReinspect = false, origId?: number) => {
    setSelectedItem(item);
    setIsReinspection(isReinspect);
    setOriginalInspectionId(origId);

    const existing = summaryByItem[item.id] || { totalPassed: 0 };
    const defaultQty = isReinspect ? 50 : Math.max(0, Number(item.quantity || 0) - existing.totalPassed);

    setForm({
      inspection_date: new Date().toISOString().split('T')[0],
      submitted_quantity: defaultQty,
      checked_quantity: defaultQty,
      passed_quantity: defaultQty,
      rejected_quantity: 0,
      rework_quantity: 0,
      defect_category: DEFECT_CATEGORIES[0],
      defect_description: isReinspect ? 'Re-inspecting after seam rectification and thread trimming.' : '',
      inspector: 'P. Selvam (Lead QC Inspector)',
      remarks: isReinspect ? 'Secondary inspection post-rework passed specifications.' : 'Standard 100% garment inspection.'
    });
    setPhotoUrls([]);
    setFormError('');
    setModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const base64 = await processImageFile(files[i]);
        newUrls.push(base64);
      }
      setPhotoUrls(prev => [...prev, ...newUrls]);
    } catch (err) {
      console.error('Error processing inspection photo:', err);
      setFormError('Failed to process image file.');
    }
  };

  const handleSaveInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !selectedItem) return;

    const submitted = Number(form.submitted_quantity || 0);
    const checked = Number(form.checked_quantity || 0);
    const passed = Number(form.passed_quantity || 0);
    const rejected = Number(form.rejected_quantity || 0);
    const rework = Number(form.rework_quantity || 0);

    if (checked <= 0) {
      setFormError('Checked quantity must be greater than zero.');
      return;
    }
    if (passed + rejected + rework !== checked) {
      setFormError(`Reconciliation mismatch: Passed (${passed}) + Rejected (${rejected}) + Rework (${rework}) must equal Checked (${checked}).`);
      return;
    }

    try {
      setSavingInspection(true);
      setFormError('');

      await api.createQualityInspection({
        production_order_id: order.id,
        production_order_item_id: selectedItem.id,
        batch_number: `QC-B${Math.floor(100 + Math.random() * 900)}`,
        product_name: selectedItem.product_name,
        product_code: selectedItem.product_code,
        size: selectedItem.size,
        color: selectedItem.color,
        submitted_quantity: submitted,
        checked_quantity: checked,
        passed_quantity: passed,
        failed_quantity: rejected + rework,
        rejected_quantity: rejected,
        rework_quantity: rework,
        defect_category: (rejected + rework) > 0 ? form.defect_category : 'None (Passed Inspection)',
        defect_description: form.defect_description,
        inspector: form.inspector,
        inspection_date: form.inspection_date,
        is_reinspection: isReinspection,
        original_inspection_id: originalInspectionId,
        remarks: form.remarks,
        photo_urls: photoUrls
      });

      showToast(`Inspection record for ${selectedItem.product_name} saved successfully.`);
      setModalOpen(false);
      await fetchOrderData();
    } catch (err: any) {
      console.error('Failed to save inspection:', err);
      setFormError(err?.message || 'Failed to save inspection.');
    } finally {
      setSavingInspection(false);
    }
  };

  // Transfer to Packing
  const handleTransferToPacking = async () => {
    if (!order) return;
    try {
      setTransferring(true);
      const packingStage = stages.find(s => (s.code || '').toUpperCase() === 'PCK');
      if (packingStage && packingStage.id) {
        await api.updateProductionOrderStatus(order.id, packingStage.id, {
          notes: `Transferred from Stage 08 Checking to Stage 09 Packing with ${fmt(overallTotals.passedQty)} approved pieces.`
        });
      }
      showToast('Successfully transferred order to Stage 09: Packing & Carton Management.');
      setTransferModalOpen(false);
      navigate(`/production/packing/${order.id}`);
    } catch (err: any) {
      console.error('Failed to transfer to Packing stage:', err);
      setError(err?.message || 'Failed to transfer to Packing.');
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading Stage 08 Quality Checking workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm font-medium">{error || 'Order not found.'}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/production/checking')}>
            Back to Checking Stage
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-in fade-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/production/checking')}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            title="Return to Stage 08 Board"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-sky-600" />
                Stage 08: Checking / Quality Inspection
              </span>
              <StatusBadge status={order.status || 'In Progress'} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Order {order.order_number}</span>
              <span className="text-sm font-normal text-slate-500">({order.title || 'Garments Production'})</span>
            </h1>
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
              <div className="flex items-center gap-1.5">
                <BuyerAvatar
                  buyer={{
                    id: order.customer_id,
                    code: order.customer_code,
                    name: order.customer_name,
                    avatar_style: order.customer_avatar_style,
                    avatar_seed: order.customer_avatar_seed,
                    avatar_config: order.customer_avatar_config,
                  }}
                  size="xs"
                />
                <span className="font-semibold text-slate-700">{order.customer_name || 'Direct Buyer'}</span>
              </div>
              {order.target_delivery_date && (
                <div className="flex items-center gap-1 text-slate-600">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Target Delivery: {order.target_delivery_date}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="secondary" size="sm" onClick={fetchOrderData} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setTransferModalOpen(true)}
            disabled={overallTotals.passedQty === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
          >
            <span>Pass to Packing (Stage 09)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI Cards & Quality Analytics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Checked</div>
          <div className="text-xl sm:text-2xl font-black text-slate-800">{fmt(overallTotals.checkedQty)}</div>
          <div className="text-[10px] text-slate-400 mt-1">{inspections.length} Audit Batches</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">Passed (Approved)</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">{fmt(overallTotals.passedQty)}</div>
          <div className="text-[10px] text-emerald-600 mt-1 font-medium">Eligible for Packing</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-red-700 uppercase tracking-wider mb-1">Scrap Rejections</div>
          <div className="text-xl sm:text-2xl font-black text-red-600">{fmt(overallTotals.rejectedQty)}</div>
          <div className="text-[10px] text-red-500 mt-1 font-mono">{overallTotals.rejectRate}% Reject Rate</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Sent for Rework</div>
          <div className="text-xl sm:text-2xl font-black text-amber-600">{fmt(overallTotals.reworkQty)}</div>
          <div className="text-[10px] text-amber-600 mt-1 font-mono">{overallTotals.reworkRate}% Rework Rate</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider mb-1">Quality Pass Rate</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">{overallTotals.passRate}%</div>
          <div className="text-[10px] text-emerald-600 mt-1 font-medium">Passed vs Checked</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 shadow-2xs">
          <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider mb-1">Pending Check</div>
          <div className="text-xl sm:text-2xl font-black text-indigo-700">
            {fmt(Math.max(0, overallTotals.orderQty - overallTotals.passedQty))}
          </div>
          <div className="text-[10px] text-indigo-600 mt-1 font-medium">Remaining to approve</div>
        </div>
      </div>

      {/* Product-wise Checking & Inspections List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Product-wise Quality Inspection Ledger</h2>
          <span className="text-xs text-slate-500">Record 100% inspection, defect categorization, and re-inspection</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {items.map(it => {
            const itIns = inspectionsByItem[it.id] || [];
            const stats = summaryByItem[it.id] || {
              totalChecked: 0,
              totalPassed: 0,
              totalRejected: 0,
              totalRework: 0,
              pendingCheck: it.quantity
            };
            const passPct = stats.totalChecked > 0 ? Math.round((stats.totalPassed / stats.totalChecked) * 100) : 100;

            return (
              <div key={it.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-base text-slate-900">{it.product_name}</h3>
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-xs text-slate-600 border border-slate-200">
                        {it.product_code || 'GARMENT-REF'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 font-medium text-xs border border-sky-200">
                        {it.color || 'Standard'}
                      </span>
                      {it.size && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-xs">
                          {it.size}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-3">
                      <span>Order Qty: <strong className="text-slate-800">{fmt(it.quantity)}</strong></span>
                      <span>Passed: <strong className="text-emerald-700">{fmt(stats.totalPassed)}</strong></span>
                      <span>Rework: <strong className="text-amber-700">{fmt(stats.totalRework)}</strong></span>
                      <span>Rejected: <strong className="text-red-700">{fmt(stats.totalRejected)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenInspectionModal(it, false)}
                      className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5 text-xs shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Inspection Entry</span>
                    </Button>
                  </div>
                </div>

                {/* Inspections Table */}
                {itIns.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <th className="px-3.5 py-2.5">Date & Batch</th>
                          <th className="px-3.5 py-2.5 text-right">Checked</th>
                          <th className="px-3.5 py-2.5 text-right text-emerald-700">Passed</th>
                          <th className="px-3.5 py-2.5 text-right text-red-600">Rejected</th>
                          <th className="px-3.5 py-2.5 text-right text-amber-600">Rework</th>
                          <th className="px-3.5 py-2.5">Defect Details</th>
                          <th className="px-3.5 py-2.5">Inspector</th>
                          <th className="px-3.5 py-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {itIns.map(ins => (
                          <tr key={ins.id} className="hover:bg-slate-50/50">
                            <td className="px-3.5 py-2.5">
                              <div className="font-bold text-sky-800">{ins.batch_number || 'QC-AUDIT'}</div>
                              <div className="font-sans text-[11px] text-slate-500">{ins.inspection_date}</div>
                              {ins.is_reinspection && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-sans text-[9px] font-bold">
                                  Re-inspection
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-bold text-slate-900">{fmt(ins.checked_quantity)}</td>
                            <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700">{fmt(ins.passed_quantity)}</td>
                            <td className="px-3.5 py-2.5 text-right font-bold text-red-600">{fmt(ins.rejected_quantity)}</td>
                            <td className="px-3.5 py-2.5 text-right font-bold text-amber-600">{fmt(ins.rework_quantity)}</td>
                            <td className="px-3.5 py-2.5 font-sans text-[11px]">
                              {ins.defect_category && ins.defect_category !== 'None (Passed Inspection)' ? (
                                <div>
                                  <span className="font-semibold text-slate-800">{ins.defect_category}</span>
                                  {ins.defect_description && (
                                    <div className="text-[10px] text-slate-500">{ins.defect_description}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-emerald-600 font-medium">100% Passed Spec</span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 font-sans text-[11px] text-slate-600">{ins.inspector}</td>
                            <td className="px-3.5 py-2.5 text-center">
                              {ins.rework_quantity > 0 ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleOpenInspectionModal(it, true, ins.id)}
                                  className="text-[10px] py-0.5 px-2 text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200"
                                >
                                  Re-inspect
                                </Button>
                              ) : (
                                <span className="text-slate-300 font-sans text-[10px]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                    No quality inspection entries recorded yet for this product line.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* New / Re-inspection Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isReinspection ? `Re-inspection After Rework — ${selectedItem?.product_name || ''}` : `Quality Inspection Entry — ${selectedItem?.product_name || ''}`}
        size="lg"
      >
        <form onSubmit={handleSaveInspection} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Inspection Date" required>
              <input
                type="date"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                value={form.inspection_date}
                onChange={e => setForm({ ...form, inspection_date: e.target.value })}
              />
            </FormField>

            <FormField label="Quality Inspector" required>
              <input
                type="text"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                value={form.inspector}
                onChange={e => setForm({ ...form, inspector: e.target.value })}
              />
            </FormField>
          </div>

          {/* Quantities */}
          <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-200 space-y-3">
            <div className="text-xs font-bold text-sky-900">Inspection Quantity Tally (Pieces)</div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-800 block mb-1">Checked Qty</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full font-mono text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-bold text-slate-900"
                  value={form.checked_quantity}
                  onChange={e => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setForm({
                      ...form,
                      checked_quantity: val,
                      passed_quantity: Math.max(0, val - form.rejected_quantity - form.rework_quantity)
                    });
                  }}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-emerald-700 block mb-1">Passed (Approved)</label>
                <input
                  type="number"
                  min="0"
                  required
                  className="w-full font-mono text-xs px-2.5 py-1.5 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700"
                  value={form.passed_quantity}
                  onChange={e => setForm({ ...form, passed_quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-red-600 block mb-1">Rejected (Scrap)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full font-mono text-xs px-2.5 py-1.5 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 font-bold text-red-600"
                  value={form.rejected_quantity}
                  onChange={e => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setForm({
                      ...form,
                      rejected_quantity: val,
                      passed_quantity: Math.max(0, form.checked_quantity - val - form.rework_quantity)
                    });
                  }}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-amber-600 block mb-1">Rework (Alter)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full font-mono text-xs px-2.5 py-1.5 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-amber-600"
                  value={form.rework_quantity}
                  onChange={e => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setForm({
                      ...form,
                      rework_quantity: val,
                      passed_quantity: Math.max(0, form.checked_quantity - form.rejected_quantity - val)
                    });
                  }}
                />
              </div>
            </div>
          </div>

          {(form.rejected_quantity > 0 || form.rework_quantity > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Defect Category" required>
                <select
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  value={form.defect_category}
                  onChange={e => setForm({ ...form, defect_category: e.target.value })}
                >
                  {DEFECT_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Defect Description / Location">
                <input
                  type="text"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g. 2mm skip stitch on right sleeve cuff"
                  value={form.defect_description}
                  onChange={e => setForm({ ...form, defect_description: e.target.value })}
                />
              </FormField>
            </div>
          )}

          <FormField label="Quality Inspection Protocol & Notes">
            <textarea
              rows={2}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              value={form.remarks}
              onChange={e => setForm({ ...form, remarks: e.target.value })}
            />
          </FormField>

          {/* Photo Evidence */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Defect & Inspection Audit Photographs
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-xl p-3 flex items-center gap-2 text-xs text-slate-600 transition">
                <Camera className="w-4 h-4 text-sky-600" />
                <span>Upload Defect Photo</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>

              {photoUrls.map((url, idx) => (
                <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-300 group">
                  <img src={url} alt="Defect" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoUrls(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-0.5 right-0.5 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" size="sm" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingInspection}
              className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5"
            >
              {savingInspection ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Save Inspection Record</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Stage Transfer Modal */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer Order to Stage 09: Packing"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            You are about to release <strong>{fmt(overallTotals.passedQty)} approved checked pieces</strong> from Stage 08 (Checking) to Stage 09 (Packing & Carton Management).
          </p>

          {overallTotals.reworkQty > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Notice:</strong> {fmt(overallTotals.reworkQty)} pieces are currently tagged for rework. Only approved pieces can enter packing.
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleTransferToPacking}
              disabled={transferring}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {transferring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Confirm Release to Packing</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
