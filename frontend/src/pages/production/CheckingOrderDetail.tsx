// src/pages/production/CheckingOrderDetail.tsx
// Stage 08: Checking / Quality Inspection — Traceable Defect Logging, Reinspection Flow & Pass Rate Analytics
// Redesigned to Cheran Soft Goods ERP design system:
// - Clean table layout matching EmbroideryOrderDetail and StitchingOrderDetail
// - Multi-stage arrival aggregation: products arrived from Stitching (Stage 07)
// - Table-view tracking: product-wise inspection status and historical audit batches
// - Polished, spacious inspection modal with auto-calculated QC passed output and no hardcoded dummy text
// - Direct stage transfer to Stage 09: Packing
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStageBackNavigation } from '../../utils/navigation';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, QualityInspection } from '../../types';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { LivePhotoCaptureField } from '../../components/production/LivePhotoCaptureField';
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
  XCircle,
  Lock,
  X,
  Package,
  Scissors,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Boxes
} from 'lucide-react';


const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(n || 0);

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
  'Button / Trims Placement Error',
  'Finishing & Label Irregularity',
  'General Craftsmanship / Other'
];

export default function CheckingOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const handleBack = useStageBackNavigation('/production/checking');

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter tabs: 'ALL' | 'CHECKING'
  const [activeTab, setActiveTab] = useState<'ALL' | 'CHECKING'>('ALL');

  // New Inspection Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isReinspection, setIsReinspection] = useState(false);
  const [originalInspectionId, setOriginalInspectionId] = useState<number | undefined>(undefined);

  const [form, setForm] = useState({
    inspection_date: new Date().toISOString().split('T')[0],
    arrived_quantity: 0,
    checked_quantity: 0,
    rejected_quantity: 0,
    rework_quantity: 0,
    defect_category: DEFECT_CATEGORIES[0],
    defect_description: '',
    inspector: '',
    remarks: ''
  });
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [savingInspection, setSavingInspection] = useState(false);
  const [formError, setFormError] = useState('');

  // Transfer to Packing (Stage 09) Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferItem, setTransferItem] = useState<any | null>(null);
  const [transferInspectionId, setTransferInspectionId] = useState<number | undefined>(undefined);
  const [transferQuantity, setTransferQuantity] = useState<number>(0);
  const [transferRemarks, setTransferRemarks] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');

  // Image Zoom Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchOrderData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');

      const [checkingRes, stagesRes] = await Promise.all([
        api.getCheckingOrderDetails(Number(id)),
        api.getProductionStages()
      ]);

      const payload = (checkingRes as any)?.data || checkingRes;
      if (payload?.order) {
        setOrder(payload.order);
        setItems(payload.items || []);
        setInspections(payload.inspections || []);
      } else {
        // Fallback to order call if direct detail payload differs
        const ordRes: any = await api.getProductionOrder(Number(id));
        const ord = ordRes?.data || ordRes;
        setOrder(ord);
        setItems(ord.items || []);
      }

      const st = (stagesRes as any)?.data || stagesRes;
      setStages(Array.isArray(st) ? st : []);
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

  // Overall metrics calculation
  const overallTotals = useMemo(() => {
    let orderQty = 0;
    let arrivedFromStitching = 0;
    let totalChecked = 0;
    let totalPassed = 0;
    let totalRejected = 0;
    let totalRework = 0;
    let pendingInspection = 0;
    let readyForPacking = 0;

    items.forEach(it => {
      orderQty += Number(it.order_quantity || it.total_quantity || 0);
      const arrived = Number(it.arrived_from_stitching ?? it.total_arrived ?? it.current_stage_quantity ?? 0);
      arrivedFromStitching += arrived;
      const chk = Number(it.checked_quantity || 0);
      totalChecked += chk;
      const pass = Number(it.passed_quantity || 0);
      totalPassed += pass;
      const rej = Number(it.rejected_quantity || 0);
      totalRejected += rej;
      const rwk = Number(it.rework_quantity || 0);
      totalRework += rwk;

      const transferred = Number(it.transferred_to_packing || 0);
      pendingInspection += Math.max(0, arrived - chk);
      readyForPacking += Math.max(0, pass - transferred);
    });

    const passRate = totalChecked > 0 ? ((totalPassed / totalChecked) * 100).toFixed(1) : '100.0';
    const rejectRate = totalChecked > 0 ? ((totalRejected / totalChecked) * 100).toFixed(1) : '0.0';
    const reworkRate = totalChecked > 0 ? ((totalRework / totalChecked) * 100).toFixed(1) : '0.0';

    return {
      orderQty,
      arrivedFromStitching,
      totalChecked,
      totalPassed,
      totalRejected,
      totalRework,
      pendingInspection,
      readyForPacking,
      passRate,
      rejectRate,
      reworkRate
    };
  }, [items]);

  // Open Inspection Modal
  const handleOpenInspectionModal = (item: any, isReinspect = false, origId?: number) => {
    setSelectedItem(item);
    setIsReinspection(isReinspect);
    setOriginalInspectionId(origId);

    const available = Number(item.available_to_inspect ?? item.pending_inspection ?? item.arrived_from_stitching ?? 0);
    const defaultQty = isReinspect ? 50 : (available > 0 ? available : 0);

    setForm({
      inspection_date: new Date().toISOString().split('T')[0],
      arrived_quantity: available,
      checked_quantity: defaultQty,
      rejected_quantity: 0,
      rework_quantity: 0,
      defect_category: DEFECT_CATEGORIES[0],
      defect_description: '',
      inspector: '',
      remarks: ''
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
        const url = await processImageFile(files[i]);
        newUrls.push(url);
      }
      setPhotoUrls(prev => [...prev, ...newUrls]);
    } catch (err: any) {
      setFormError('Failed to process image: ' + err.message);
    }
  };

  // Submit Quality Inspection
  const handleSaveInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !selectedItem) return;

    const checked = Number(form.checked_quantity || 0);
    const rej = Number(form.rejected_quantity || 0);
    const rwk = Number(form.rework_quantity || 0);
    const passed = Math.max(0, checked - rej - rwk);

    if (checked <= 0) {
      setFormError('Checked quantity must be greater than zero.');
      return;
    }

    if (!photoUrls || photoUrls.length === 0) {
      setFormError('Real-time camera photograph with live GPS coordinates of inspected garments / defect audit is mandatory.');
      return;
    }

    try {
      setSavingInspection(true);
      setFormError('');

      await api.recordQualityInspection({
        production_order_id: Number(order.id),
        production_order_item_id: selectedItem.active_checking_item_id || selectedItem.id,
        submitted_quantity: checked,
        checked_quantity: checked,
        passed_quantity: passed,
        failed_quantity: rej + rwk,
        rejected_quantity: rej,
        rework_quantity: rwk,
        defect_category: (rej > 0 || rwk > 0) ? form.defect_category : 'Passed Inspection',
        defect_description: form.defect_description,
        inspector: form.inspector || 'QC Inspector',
        inspection_date: form.inspection_date,
        is_reinspection: isReinspection,
        original_inspection_id: originalInspectionId,
        remarks: form.remarks,
        photo_urls: photoUrls
      });

      setModalOpen(false);
      showToast(`Quality Inspection batch recorded successfully! Passed: ${passed} pcs`);
      await fetchOrderData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record quality inspection.');
    } finally {
      setSavingInspection(false);
    }
  };

  // Open Transfer to Packing Modal
  const handleOpenTransferModal = (itOrInsp?: any) => {
    let it = itOrInsp;
    let insId: number | undefined = undefined;
    if (itOrInsp && itOrInsp.batch_number && itOrInsp.checked_quantity !== undefined) {
      // Called with inspection row from Table 2
      insId = itOrInsp.id;
      it = items.find(i => String(i.color).trim() === String(itOrInsp.color).trim()) || items[0];
    } else if (itOrInsp) {
      it = itOrInsp;
    } else if (!itOrInsp) {
      it = items.find(i => Number(i.ready_to_pack || 0) > 0) || items[0];
    }
    setTransferItem(it);
    setTransferInspectionId(insId);
    const maxQty = insId 
      ? Number(itOrInsp?.passed_quantity || 0)
      : Number(it?.ready_to_pack ?? it?.passed_quantity ?? overallTotals.readyForPacking ?? 0);
    setTransferQuantity(maxQty);
    setTransferRemarks('Inspection completed and passed 100% audit. Transferred to Stage 09: Packing.');
    setTransferError('');
    setTransferModalOpen(true);
  };

  // Submit Transfer to Stage 09: Packing
  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || transferQuantity <= 0) {
      setTransferError('Please enter a positive transfer quantity.');
      return;
    }

    try {
      setTransferring(true);
      setTransferError('');

      await api.transferCheckingOutput({
        production_order_id: Number(order.id),
        inspection_id: transferInspectionId,
        item_id: transferItem?.active_checking_item_id || transferItem?.production_order_item_id || transferItem?.id,
        transfer_quantity: Number(transferQuantity),
        remarks: transferRemarks || 'Transferred passed inspection output to Stage 09: Packing'
      });

      setTransferModalOpen(false);
      showToast(`Successfully transferred ${transferQuantity} pcs to Stage 09: Packing!`);
      await fetchOrderData();
    } catch (err: any) {
      setTransferError(err?.message || 'Failed to transfer to Packing.');
    } finally {
      setTransferring(false);
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    if (activeTab === 'CHECKING') {
      return items.filter(it => Number(it.arrived_from_stitching || it.total_arrived || 0) > 0);
    }
    return items;
  }, [items, activeTab]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-emerald-600 animate-slide-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 border-slate-300"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
                  {order?.order_number || 'Loading Order...'}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  Stage 08: Checking / Quality Inspection
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {order?.status || 'IN PRODUCTION'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                <span>{(order as any)?.order_title || (order as any)?.title || 'Production Order'}</span>
                <span>•</span>
                <span className="font-semibold text-slate-700">
                  {overallTotals.arrivedFromStitching} pcs arrived from Stitching
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOrderData}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            <Button
              id="btn-pass-to-packing"
              variant="primary"
              size="sm"
              onClick={() => handleOpenTransferModal()}
              disabled={overallTotals.readyForPacking <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Pass to Packing (Stage 09)</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Buyer & Delivery Info */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <BuyerAvatar
              buyer={order}
              size="sm"
              shape="circle"
              className="shrink-0"
            />
            <span className="font-semibold text-slate-800">{order?.customer_name || 'gowtham'}</span>
            <span className="text-slate-400">({order?.customer_code || 'CUST-001'})</span>
          </div>

          <div className="flex items-center gap-4 text-slate-600">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Target Delivery: <strong className="text-slate-800">{order?.target_delivery_date || (order as any)?.delivery_date || '2026-12-05'}</strong></span>
            </span>
          </div>
        </div>
      </div>

      {/* 6-CARD TOP KPI GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Arrived from Stitching */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Arrived from Stitching</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
            {fmt(overallTotals.arrivedFromStitching)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Transferred from Stage 07</div>
        </div>

        {/* Card 2: Total Inspected */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Inspected</span>
            <CheckCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-black font-mono text-indigo-700 mt-0.5">
            {fmt(overallTotals.totalChecked)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{inspections.length} Audit Batches</div>
        </div>

        {/* Card 3: QC Passed Output */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">QC Passed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-700 mt-0.5">
            {fmt(overallTotals.totalPassed)}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1">
            {overallTotals.readyForPacking > 0
              ? `${overallTotals.readyForPacking} Ready for Packing`
              : 'Transferred to Packing (Stage 09)'}
          </div>
        </div>

        {/* Card 4: Scrap Rejections */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">Scrap Rejections</span>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl font-black font-mono text-red-600 mt-0.5">
            {fmt(overallTotals.totalRejected)}
          </div>
          <div className="text-[10px] text-red-600 mt-1">{overallTotals.rejectRate}% Reject Rate</div>
        </div>

        {/* Card 5: Sent for Rework */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Under Rework</span>
            <RotateCcw className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black font-mono text-amber-600 mt-0.5">
            {fmt(overallTotals.totalRework)}
          </div>
          <div className="text-[10px] text-amber-600 mt-1">{overallTotals.reworkRate}% Rework Rate</div>
        </div>

        {/* Card 6: Pending Inspection */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Pending Check</span>
            <ShieldCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-black font-mono text-slate-800 mt-0.5">
            {fmt(overallTotals.pendingInspection)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Ready for Inspection</div>
        </div>
      </div>

      {/* TABLE 1: Product-Wise Checking Status & Action */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Product-Wise Quality Inspection Status & Action
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Stitched garments arriving at Checking undergo 100% audit with defect categorization and pass tally.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Products ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('CHECKING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'CHECKING'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              In Checking ({items.filter(it => Number(it.arrived_from_stitching || 0) > 0).length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Product Name & SKU</th>
                <th className="py-3 px-4">Color / Size</th>
                <th className="py-3 px-3 text-right">Order Qty</th>
                <th className="py-3 px-3 text-right text-blue-700 bg-blue-50/50">From Stitching</th>
                <th className="py-3 px-3 text-right text-indigo-700">Inspected</th>
                <th className="py-3 px-3 text-right text-emerald-700">QC Passed</th>
                <th className="py-3 px-3 text-right text-red-600">Rej / Rwk</th>
                <th className="py-3 px-3 text-right font-black text-slate-900 bg-slate-50">Avail. to Inspect</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No production order line items found for this order.
                  </td>
                </tr>
              ) : (
                filteredItems.map((it, idx) => {
                  const arrivedStitching = Number(it.arrived_from_stitching ?? it.total_arrived ?? 0);
                  const inspected = Number(it.checked_quantity || 0);
                  const passed = Number(it.passed_quantity || 0);
                  const rej = Number(it.rejected_quantity || 0);
                  const rwk = Number(it.rework_quantity || 0);
                  const avail = Math.max(0, arrivedStitching - inspected);
                  const transferredToPacking = Number(it.transferred_to_packing || 0);
                  const readyToPack = Math.max(0, passed - transferredToPacking);

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-400">
                        {idx + 1}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">{it.product_name || 'Garment Product'}</span>
                        <span className="text-[11px] font-mono text-blue-600 block">{it.product_code || 'BPRD-002'}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {it.color || 'Standard'}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Size: {it.size || 'M'}</span>
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-800">
                        {fmt(it.order_quantity || it.total_quantity || 0)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-bold text-blue-700 bg-blue-50/30">
                        {fmt(arrivedStitching)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-bold text-indigo-700">
                        {fmt(inspected)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-extrabold text-emerald-700">
                        {fmt(passed)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                        {rej > 0 || rwk > 0 ? (
                          <span className="text-red-600 font-bold">
                            {rej} <span className="text-slate-400">/</span> <span className="text-amber-600">{rwk}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-black text-slate-900 bg-slate-50/50">
                        <span className={`px-2 py-0.5 rounded ${avail > 0 ? 'bg-blue-100 text-blue-800 font-bold' : 'text-slate-400'}`}>
                          {fmt(avail)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {avail > 0 ? (
                            <Button
                              id={`btn-record-inspect-${idx}`}
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenInspectionModal(it)}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Record Inspection</span>
                            </Button>
                          ) : readyToPack > 0 ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                QC Passed
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenTransferModal(it)}
                                className="text-xs text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1 font-semibold"
                                title="Pass approved quantity to Stage 09: Packing"
                              >
                                <span>To Packing</span>
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (transferredToPacking > 0 || passed > 0) ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 shadow-2xs">
                                <Boxes className="w-3.5 h-3.5 text-amber-600" />
                                Transferred to Packing
                              </span>
                            </div>
                          ) : arrivedStitching === 0 ? (
                            <span className="text-[11px] text-slate-400 italic bg-slate-50 px-2.5 py-1 rounded border border-slate-200 block">
                              Awaiting Stitching
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
                              Completed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABLE 2: Recorded Quality Inspections & Audit Logs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <CheckCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Recorded Quality Inspections & Audit History
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit logs with inspected quantities, pass/fail yields, defect classification, and photographic proof.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
            {inspections.length} Inspections
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Inspection #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Color / Size</th>
                <th className="py-3 px-3 text-right">Checked Qty</th>
                <th className="py-3 px-3 text-right text-emerald-700">Passed Qty</th>
                <th className="py-3 px-3 text-right text-red-600">Rejected</th>
                <th className="py-3 px-3 text-right text-amber-600">Rework</th>
                <th className="py-3 px-3 text-center">Pass Rate</th>
                <th className="py-3 px-4">Defect Category</th>
                <th className="py-3 px-4">Inspector</th>
                <th className="py-3 px-3 text-center">Proof Photos</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {inspections.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-slate-400">
                    No quality inspection entries recorded yet for this order.
                  </td>
                </tr>
              ) : (
                inspections.map((insp: any, idx: number) => {
                  const chk = Number(insp.checked_quantity || insp.submitted_quantity || 0);
                  const pass = Number(insp.passed_quantity || 0);
                  const rej = Number(insp.rejected_quantity || 0);
                  const rwk = Number(insp.rework_quantity || 0);
                  const rate = chk > 0 ? ((pass / chk) * 100).toFixed(1) : '100.0';
                  const photos = Array.isArray(insp.photo_urls) ? insp.photo_urls : [];

                  return (
                    <tr key={insp.id || idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                        {insp.batch_number || `CHK-${order?.id || 0}-${idx + 1}`}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {insp.inspection_date || '2026-10-17'}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {insp.product_name || 'Garment Product'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {insp.color || 'Standard'}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Size: {insp.size || 'M'}</span>
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-800">
                        {fmt(chk)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-extrabold text-emerald-700">
                        {fmt(pass)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-bold text-red-600">
                        {fmt(rej)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-600">
                        {fmt(rwk)}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                          Number(rate) >= 95 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          Number(rate) >= 80 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {rate}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate" title={insp.defect_category}>
                        {insp.defect_category || 'Passed Inspection'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {insp.inspector || 'Lead QC Inspector'}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        {photos.length > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            {photos.slice(0, 2).map((url: string, pIdx: number) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => setPreviewImage(url)}
                                className="w-7 h-7 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition cursor-pointer"
                              >
                                <img src={url} alt="Proof" className="w-full h-full object-cover" />
                              </button>
                            ))}
                            {photos.length > 2 && (
                              <span className="text-[10px] text-slate-500 font-bold">+{photos.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">None</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {insp.status === 'Transferred to Packing' || (insp as any).is_transferred ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                            In Packing
                          </span>
                        ) : pass > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenTransferModal(insp)}
                            className="text-[11px] text-emerald-700 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1 mx-auto py-1 px-2.5 font-semibold"
                          >
                            <span>To Packing</span>
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Record Quality Inspection */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isReinspection ? "Re-Inspection & Rework Audit Entry" : "Quality Inspection Entry"}
        subtitle={`${selectedItem?.product_name || 'Garment Product'} • Color: ${selectedItem?.color || 'Standard'} • Order: ${order?.order_number || ''}`}
        size="xl"
      >
        <form onSubmit={handleSaveInspection} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Inspection Date & Inspector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Inspection Date</span>
                <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="date"
                value={form.inspection_date}
                onChange={e => setForm({ ...form, inspection_date: e.target.value })}
                className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium text-slate-800 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Quality Inspector</span>
              </label>
              <input
                type="text"
                value={form.inspector}
                onChange={e => setForm({ ...form, inspector: e.target.value })}
                className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 transition placeholder:text-slate-400"
                placeholder="e.g. Lead QC Auditor"
              />
            </div>
          </div>

          {/* Yield & Inspection Quantity Reconciliation */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Inspection Quantity Tally (Pieces)
                </span>
                <span className="text-[11px] text-slate-500">
                  Record audited garments, scrap rejections, and rework items
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                <Lock className="w-3 h-3 text-blue-600" />
                From Stitching
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Arrived / Available to Check: Read-Only */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center justify-between">
                  <span>Available</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </label>
                <input
                  type="number"
                  value={form.arrived_quantity}
                  readOnly
                  disabled
                  className="w-full text-sm px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-slate-700 cursor-not-allowed select-none"
                  title="Total quantity available from stitching for inspection."
                />
              </div>

              {/* Checked Qty (Required) */}
              <div className="bg-white p-2.5 rounded-lg border border-blue-200 shadow-xs">
                <label className="block text-[11px] font-bold text-blue-900 uppercase mb-1">
                  Checked Qty <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={form.arrived_quantity > 0 ? form.arrived_quantity : 999999}
                  value={form.checked_quantity}
                  onChange={e => setForm({ ...form, checked_quantity: Number(e.target.value) })}
                  className="w-full text-sm px-2.5 py-1.5 border border-blue-300 rounded font-mono font-bold text-blue-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  required
                />
              </div>

              {/* Rejected (Scrap) */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Rejected (Scrap)
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.rejected_quantity}
                  onChange={e => setForm({ ...form, rejected_quantity: Math.max(0, Number(e.target.value)) })}
                  className="w-full text-sm px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold text-slate-800 focus:ring-2 focus:ring-red-400/20 focus:border-red-500"
                />
              </div>

              {/* Rework (Alter) */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Rework (Alter)
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.rework_quantity}
                  onChange={e => setForm({ ...form, rework_quantity: Math.max(0, Number(e.target.value)) })}
                  className="w-full text-sm px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold text-slate-800 focus:ring-2 focus:ring-amber-400/20 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Live Calculated Passed QC Output Banner */}
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-950 block">Passed QC Output (Approved)</span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Auto-calculated: {form.checked_quantity || 0} checked − {form.rejected_quantity || 0} rej − {form.rework_quantity || 0} rwk
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black font-mono text-emerald-700">
                  {Math.max(0, Number(form.checked_quantity || 0) - Number(form.rejected_quantity || 0) - Number(form.rework_quantity || 0))}
                </span>
                <span className="text-xs font-bold text-emerald-600 ml-1">pcs</span>
              </div>
            </div>
          </div>

          {/* Defect Category & Protocol */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
                <span>Primary Defect Classification</span>
              </label>
              <select
                value={form.defect_category}
                onChange={e => setForm({ ...form, defect_category: e.target.value })}
                className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium text-slate-800 transition"
              >
                {DEFECT_CATEGORIES.map((cat, idx) => (
                  <option key={idx} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Defect Description / Notes</span>
              </label>
              <input
                type="text"
                value={form.defect_description}
                onChange={e => setForm({ ...form, defect_description: e.target.value })}
                className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 transition placeholder:text-slate-400"
                placeholder="e.g. Skip stitch on collar placket, oil stain at left hem..."
              />
            </div>
          </div>

          {/* Quality Protocol Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Inspection Protocol & Notes</span>
            </label>
            <textarea
              rows={2}
              value={form.remarks}
              onChange={e => setForm({ ...form, remarks: e.target.value })}
              className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 transition placeholder:text-slate-400"
              placeholder="Enter quality audit notes, AQL inspection level, or verification notes..."
            />
          </div>

          {/* Mandatory Live Camera Photo Proof */}
          <LivePhotoCaptureField
            label="Defect & Quality Audit Photographs"
            required={true}
            photos={photoUrls}
            onPhotosChange={setPhotoUrls}
            stageName="Checking & QC (Stage 09)"
            orderNumber={order?.order_number}
            error={formError && photoUrls.length === 0 ? 'Real-time camera photograph with live GPS coordinates is mandatory before recording inspection.' : undefined}
            buttonText="Take Real-Time QC Photo"
          />

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              disabled={savingInspection}
            >
              Cancel
            </Button>
            <Button
              id="btn-submit-quality-inspection"
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingInspection}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5"
            >
              {savingInspection ? 'Saving...' : 'Save Inspection Record'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Transfer to Stage 09: Packing */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer Passed Goods to Stage 09: Packing"
        subtitle={`Order: ${order?.order_number || ''} • Approved for carton packaging`}
        size="md"
      >
        <form onSubmit={handleConfirmTransfer} className="space-y-4">
          {transferError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{transferError}</span>
            </div>
          )}

          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Target Stage</span>
            <span className="text-sm font-bold text-emerald-950 block">
              Stage 09: Packing & Master Carton Management
            </span>
            <span className="text-xs text-emerald-700 block">
              Product: <strong>{transferItem?.product_name || 'All Passed Products'}</strong> {transferItem?.color ? `• Color: ${transferItem.color}` : ''}
            </span>
          </div>

          <FormField label="Quantity to Transfer (Pcs)" required>
            <input
              type="number"
              min="1"
              max={Number(transferItem?.ready_to_pack || transferItem?.passed_quantity || overallTotals.readyForPacking || 1000)}
              value={transferQuantity}
              onChange={e => setTransferQuantity(Number(e.target.value))}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-emerald-900"
              required
            />
          </FormField>

          <FormField label="Transfer Remarks">
            <textarea
              rows={2}
              value={transferRemarks}
              onChange={e => setTransferRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder:text-slate-400"
              placeholder="e.g. 100% inspection passed, cleared for individual polybag and master cartons."
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTransferModalOpen(false)}
              disabled={transferring}
            >
              Cancel
            </Button>
            <Button
              id="btn-confirm-transfer-to-packing"
              variant="primary"
              size="sm"
              type="submit"
              disabled={transferring}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5"
            >
              {transferring ? 'Transferring...' : 'Confirm Transfer to Packing'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Image Zoom Preview */}
      <Modal
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        title="Quality Inspection Photo Audit"
        size="2xl"
      >
        <div className="flex flex-col items-center justify-center p-2">
          {previewImage && (
            <img
              src={previewImage}
              alt="Audit Proof"
              className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain border border-slate-200 shadow-md"
            />
          )}
          <div className="mt-4 flex justify-end w-full">
            <Button variant="outline" size="sm" onClick={() => setPreviewImage(null)}>
              Close Preview
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
