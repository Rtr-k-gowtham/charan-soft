// src/pages/production/StitchingOrderDetail.tsx
// Stage 07: Stitching — Color-wise Tracking, Batch Management, Yield Reconciliation & Output Transfer
// Redesigned to strict Cheran Soft Goods ERP design system:
// - Clean table layout matching EmbroideryOrderDetail
// - Ordered products arrive from both Cutting and Embroidery stages
// - Auto-fetched and read-only Assigned Quantity in batch recording form
// - Removed Operator/Sewing Team, Machine Ref, Supervisor, and Accepted Qty from the form
// - Direct transfer to Stage 08 Checking
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStageBackNavigation } from '../../utils/navigation';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, StitchingBatch } from '../../types';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { LivePhotoCaptureField } from '../../components/production/LivePhotoCaptureField';
import {
  ArrowLeft,
  Activity,
  RefreshCw,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Calendar,
  Camera,
  Image as ImageIcon,
  Trash2,
  ZoomIn,
  Eye,
  FileText,
  CheckCheck,
  Scissors,
  Package,
  Lock,
  X,
  Sparkles,
  ShieldCheck,
  Clock,
  RotateCcw
} from 'lucide-react';
import StageReworkSection from '../../components/production/StageReworkSection';

const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
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

function parsePhotos(urls: any): string[] {
  if (Array.isArray(urls)) return urls.filter(u => typeof u === 'string' && u.trim());
  if (typeof urls === 'string' && urls.trim()) {
    try {
      const parsed = JSON.parse(urls);
      if (Array.isArray(parsed)) return parsed.filter(u => typeof u === 'string' && u.trim());
      return [urls];
    } catch {
      return [urls];
    }
  }
  return [];
}

export default function StitchingOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const handleBack = useStageBackNavigation('/production/stitching');

  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tabs: 'batches' | 'rework'
  const [activeTab, setActiveTab] = useState<'batches' | 'rework'>('batches');
  const [filterMode, setFilterMode] = useState<'ALL' | 'STITCHING'>('ALL');

  // Record Stitching Batch Modal State
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [batchForm, setBatchForm] = useState({
    start_date: new Date().toISOString().split('T')[0],
    completion_date: new Date().toISOString().split('T')[0],
    assigned_quantity: 0,
    completed_quantity: 0,
    rejected_quantity: 0,
    rework_quantity: 0,
    rework_reason: 'Broken Seam / Stitching Defect',
    rework_destination: 'Stitching Line Correction',
    rework_remarks: '',
    remarks: ''
  });
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchError, setBatchError] = useState('');

  // Transfer to Checking Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferItem, setTransferItem] = useState<any | null>(null);
  const [transferBatchId, setTransferBatchId] = useState<number | undefined>(undefined);
  const [transferQuantity, setTransferQuantity] = useState<number>(0);
  const [transferRemarks, setTransferRemarks] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchOrderData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const [stitchingRes, stagesRes] = await Promise.all([
        api.getStitchingOrderDetails(Number(id)),
        api.getProductionStages()
      ]);

      const stData = (stitchingRes as any)?.data || stitchingRes;
      setOrder(stData.order || null);
      setItems(stData.items || []);
      setBatches(stData.batches || []);

      const st = (stagesRes as any)?.data || stagesRes;
      setStages(Array.isArray(st) ? st : []);
    } catch (err: any) {
      console.error('Failed to load stitching stage data:', err);
      setError(err?.message || 'Failed to load stitching stage data.');
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

  // Overall Totals for 6-Card KPI Summary
  const overallTotals = useMemo(() => {
    let orderQty = 0;
    let arrivedFromCutting = 0;
    let arrivedFromEmbroidery = 0;
    let totalArrived = 0;
    let totalCompleted = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalRework = 0;
    let pendingStitching = 0;
    let readyForChecking = 0;

    items.forEach(it => {
      orderQty += Number(it.order_quantity || it.total_quantity || 0);
      arrivedFromCutting += Number(it.arrived_from_cutting || 0);
      arrivedFromEmbroidery += Number(it.arrived_from_embroidery || 0);
      totalArrived += Number(it.total_arrived || 0);
      totalCompleted += Number(it.completed_quantity || 0);
      totalAccepted += Number(it.accepted_quantity || 0);
      totalRejected += Number(it.rejected_quantity || 0);
      totalRework += Number(it.rework_quantity || 0);
      pendingStitching += Number(it.pending_stitching || it.available_to_stitch || 0);
      readyForChecking += Number(it.ready_to_transfer || 0);
    });

    return {
      orderQty,
      arrivedFromCutting,
      arrivedFromEmbroidery,
      totalArrived,
      totalCompleted,
      totalAccepted,
      totalRejected,
      totalRework,
      pendingStitching,
      readyForChecking
    };
  }, [items]);

  // Open Record Stitching Batch Modal
  const handleOpenBatchModal = (it: any) => {
    setSelectedItem(it);
    const assigned = Number(it.available_to_stitch || it.assigned_quantity || it.total_arrived || 0);
    setBatchForm({
      start_date: new Date().toISOString().split('T')[0],
      completion_date: new Date().toISOString().split('T')[0],
      assigned_quantity: assigned,
      completed_quantity: assigned,
      rejected_quantity: 0,
      rework_quantity: 0,
      rework_reason: 'Broken Seam / Stitching Defect',
      rework_destination: 'Stitching Line Correction',
      rework_remarks: '',
      remarks: ''
    });
    setPhotoUrls([]);
    setBatchError('');
    setBatchModalOpen(true);
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
      setBatchError('Error processing photo: ' + err.message);
    }
  };

  // Submit Stitching Batch (Accepted Qty is calculated automatically as Completed - Rejected - Rework)
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !selectedItem) return;

    const comp = Number(batchForm.completed_quantity);
    const rej = Number(batchForm.rejected_quantity);
    const rwk = Number(batchForm.rework_quantity);
    const assigned = Number(batchForm.assigned_quantity);

    if (comp <= 0) {
      setBatchError('Please specify a positive completed quantity.');
      return;
    }

    if (rej + rwk > comp) {
      setBatchError('The sum of rejected and rework quantities cannot exceed the completed quantity.');
      return;
    }

    if (!photoUrls || photoUrls.length === 0) {
      setBatchError('Real-time camera photograph with live GPS coordinates of stitching line quality & seam proof is mandatory.');
      return;
    }

    try {
      setSavingBatch(true);
      setBatchError('');

      await api.createStitchingBatch({
        production_order_id: Number(order.id),
        production_order_item_id: selectedItem.active_stitching_item_id || selectedItem.id,
        assigned_quantity: assigned > 0 ? assigned : comp,
        completed_quantity: comp,
        rejected_quantity: rej,
        rework_quantity: rwk,
        rework_reason: batchForm.rework_reason,
        rework_destination: batchForm.rework_destination,
        rework_remarks: batchForm.rework_remarks,
        start_date: batchForm.start_date,
        completion_date: batchForm.completion_date,
        remarks: batchForm.remarks,
        photo_urls: photoUrls
      });

      setBatchModalOpen(false);
      showToast(`Stitching batch for ${selectedItem.product_name} (${selectedItem.color}) recorded successfully!`);
      await fetchOrderData();
    } catch (err: any) {
      console.error('Failed to save stitching batch:', err);
      setBatchError(err?.message || 'Failed to save stitching batch.');
    } finally {
      setSavingBatch(false);
    }
  };

  // Open Transfer Modal to Checking (Stage 08)
  const handleOpenTransferModal = (itOrBatch?: any) => {
    let it = itOrBatch;
    let bId: number | undefined = undefined;
    if (itOrBatch && itOrBatch.batch_number) {
      // Called with batch
      it = items.find(i => String(i.color).trim() === String(itOrBatch.color).trim()) || items[0];
      bId = itOrBatch.id;
    } else if (itOrBatch) {
      it = itOrBatch;
    } else if (!itOrBatch) {
      it = items.find(i => Number(i.ready_to_transfer || 0) > 0) || items[0];
    }
    setTransferItem(it);
    setTransferBatchId(bId);
    const maxQty = bId 
      ? Number(itOrBatch?.accepted_quantity || 0)
      : Number(it?.ready_to_transfer ?? it?.accepted_quantity ?? overallTotals.readyForChecking ?? 0);
    setTransferQuantity(maxQty);
    setTransferRemarks('');
    setTransferError('');
    setTransferModalOpen(true);
  };

  // Submit Transfer to Stage 08 Checking
  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || transferQuantity <= 0) {
      setTransferError('Please enter a positive transfer quantity.');
      return;
    }

    try {
      setTransferring(true);
      setTransferError('');
      await api.transferStitchingOutput({
        production_order_id: Number(order.id),
        batch_id: transferBatchId,
        item_id: transferItem?.active_stitching_item_id || transferItem?.id,
        transfer_quantity: Number(transferQuantity),
        remarks: transferRemarks
      });

      setTransferModalOpen(false);
      showToast(`Successfully transferred ${transferQuantity} pcs to Stage 08: Checking!`);
      await fetchOrderData();
    } catch (err: any) {
      setTransferError(err?.message || 'Failed to transfer stitching output to Checking.');
    } finally {
      setTransferring(false);
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    if (filterMode === 'STITCHING') {
      return items.filter(it => Number(it.total_arrived || it.available_to_stitch || 0) > 0);
    }
    return items;
  }, [items, filterMode]);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4 text-slate-600" />}
              onClick={handleBack}
              className="text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50"
            >
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-black text-slate-900 tracking-tight">
                  {order?.order_number || `ORD-${id}`}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200 flex items-center gap-1.5 shadow-2xs">
                  <Activity className="w-3.5 h-3.5 text-brand-600" />
                  Stage 07: Stitching — Color-wise Tracking
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  {order?.priority || 'NORMAL'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {order?.title || 'Production Order Workflow'} • Garments arriving from Cutting & Embroidery stages, color-wise stitching runs, and Checking transfers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              onClick={fetchOrderData}
              disabled={loading}
              className="text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </Button>
            <Button
              id="btn-pass-to-checking"
              variant="primary"
              size="sm"
              icon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={() => handleOpenTransferModal()}
              disabled={overallTotals.readyForChecking <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-200"
            >
              Pass to Checking (Stage 08)
            </Button>
          </div>
        </div>

        {/* Order Details Bar */}
        {order && (
          <div className="max-w-7xl mx-auto mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-6 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <BuyerAvatar buyer={order} size="sm" shape="circle" className="shrink-0" />
              <span className="font-bold text-slate-800">{order.customer_name || 'Buyer'}</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Target Delivery: <strong className="text-slate-700 font-mono">{order.target_delivery_date || 'N/A'}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Total Order Qty: <strong className="text-slate-700 font-mono">{fmt(overallTotals.orderQty)} pcs</strong>
                {overallTotals.orderQty > overallTotals.totalArrived && (
                  <span className="text-amber-600 font-bold ml-1">
                    ({fmt(overallTotals.orderQty - overallTotals.totalArrived)} awaiting transfer)
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Scissors className="w-3.5 h-3.5 text-amber-600" />
              <span>Arrived in Stitching: <strong className="text-brand-700 font-mono">{fmt(overallTotals.totalArrived)} pcs</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-xs">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 6-Card KPI Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Arrived at Stitching</span>
            <span className="text-lg font-black text-slate-900 font-mono mt-0.5 block">{fmt(overallTotals.totalArrived)}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {fmt(overallTotals.arrivedFromCutting)} Cutting • {fmt(overallTotals.arrivedFromEmbroidery)} Embroidery
            </span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider block">Stitched Completed</span>
            <span className="text-lg font-black text-brand-600 font-mono mt-0.5 block">{fmt(overallTotals.totalCompleted)}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">{batches.length} Batches</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Accepted Output</span>
            <span className="text-lg font-black text-emerald-600 font-mono mt-0.5 block">{fmt(overallTotals.totalAccepted)}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Eligible for Quality Checking</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Stitching Rejections</span>
            <span className="text-lg font-black text-red-600 font-mono mt-0.5 block">
              {fmt(overallTotals.totalRejected)}{' '}
              <span className="text-xs text-slate-400 font-normal">({overallTotals.totalRework} rwk)</span>
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Irreparable defects</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Pending Stitching</span>
            <span className="text-lg font-black text-amber-600 font-mono mt-0.5 block">{fmt(overallTotals.pendingStitching)}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Remaining to stitch</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Ready for Checking</span>
            <span className="text-lg font-black text-purple-700 font-mono mt-0.5 block">{fmt(overallTotals.readyForChecking)}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">QC Passed output</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('batches')}
            className={`pb-3 pt-1 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'batches'
                ? 'border-brand-600 text-brand-700 bg-brand-50/40 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            Stitching Batches & Output ({batches.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rework')}
            className={`pb-3 pt-1 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'rework'
                ? 'border-brand-600 text-brand-700 bg-brand-50/40 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Stage 07 Rework & Alteration
            {overallTotals.totalRework > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                {fmt(overallTotals.totalRework)} pcs
              </span>
            )}
          </button>
        </div>

        {activeTab === 'batches' && (
          <>
            {/* Table 1: Product-Wise Stitching Status & Action (Table View matching Embroidery) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Product-Wise Stitching Status & Action
                </h3>
                <p className="text-[11px] text-slate-500">
                  Cut and embroidered pieces arriving from prior stages are stitched by color/size and tracked through completion.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  filterMode === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Products ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('STITCHING')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  filterMode === 'STITCHING'
                    ? 'bg-brand-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                In Stitching ({items.filter(i => Number(i.total_arrived || i.available_to_stitch || 0) > 0).length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Product Name & SKU</th>
                  <th className="py-3 px-3">Color / Size</th>
                  <th className="py-3 px-3 text-right">Order Qty</th>
                  <th className="py-3 px-3 text-right">From Cutting</th>
                  <th className="py-3 px-3 text-right">From Embroidery</th>
                  <th className="py-3 px-3 text-right">Total Arrived</th>
                  <th className="py-3 px-3 text-right">Completed</th>
                  <th className="py-3 px-3 text-right">Accepted</th>
                  <th className="py-3 px-3 text-right">Rej / Rwk</th>
                  <th className="py-3 px-3 text-right">Avail. to Stitch</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400 text-xs">
                      No products found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((it, idx) => {
                    const orderQ = Number(it.order_quantity || it.total_quantity || 0);
                    const fromCutQ = Number(it.arrived_from_cutting || 0);
                    const fromEmbQ = Number(it.arrived_from_embroidery || 0);
                    const totalArrQ = Number(it.total_arrived || (fromCutQ + fromEmbQ) || 0);
                    const compQ = Number(it.completed_quantity || 0);
                    const accQ = Number(it.accepted_quantity || 0);
                    const rejQ = Number(it.rejected_quantity || 0);
                    const rwkQ = Number(it.rework_quantity || 0);
                    const availQ = Number(it.available_to_stitch || Math.max(0, totalArrQ - compQ));
                    const readyQ = Number(it.ready_to_transfer !== undefined && it.ready_to_transfer !== null ? it.ready_to_transfer : accQ);

                    return (
                      <tr key={it.id || idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{it.product_name || 'Product'}</span>
                          {it.product_code && (
                            <span className="font-mono text-[10px] text-brand-600 block">{it.product_code}</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800 block">{it.color || 'Standard'}</span>
                          <span className="text-[10px] font-mono text-slate-400">Size: {it.size || 'M'}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{fmt(orderQ)}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">
                          {fromCutQ > 0 ? fmt(fromCutQ) : <span className="text-slate-300 font-normal">0</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">
                          {fromEmbQ > 0 ? fmt(fromEmbQ) : <span className="text-slate-300 font-normal">0</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700">
                          {totalArrQ > 0 ? fmt(totalArrQ) : <span className="text-slate-300 font-normal">0</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-brand-600">
                          {compQ > 0 ? fmt(compQ) : <span className="text-slate-300 font-normal">0</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                          {accQ > 0 ? fmt(accQ) : <span className="text-slate-300 font-normal">0</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-red-600 font-semibold">
                          {(rejQ > 0 || rwkQ > 0) ? (
                            <span>{fmt(rejQ)}{rwkQ > 0 && <span className="text-amber-600 text-[10px] ml-1">({fmt(rwkQ)} rwk)</span>}</span>
                          ) : (
                            <span className="text-slate-300 font-normal">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          {availQ > 0 ? (
                            <span className="text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                              {fmt(availQ)}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {availQ > 0 ? (
                              <Button
                                id={`btn-record-stitching-${idx}`}
                                size="xs"
                                variant="primary"
                                icon={<Plus className="w-3 h-3" />}
                                onClick={() => handleOpenBatchModal(it)}
                                className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-[11px] shadow-2xs"
                              >
                                Record Stitching
                              </Button>
                            ) : compQ > 0 && readyQ > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  QC Passed
                                </span>
                                <Button
                                  size="xs"
                                  variant="secondary"
                                  icon={<ArrowRight className="w-3 h-3" />}
                                  onClick={() => handleOpenTransferModal(it)}
                                  className="text-[11px] font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200 shadow-2xs"
                                >
                                  To Checking
                                </Button>
                              </div>
                            ) : compQ > 0 && readyQ <= 0 && (Number(it.transferred_to_checking || 0) > 0 || accQ > 0) ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded border border-purple-200 inline-flex items-center gap-1.5 shadow-2xs">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                                  Transferred to Checking
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                Awaiting Cutting / Embroidery
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

        {/* Table 2: Recorded Stitching Batches & Progress */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Recorded Stitching Batches & Quality Output
                </h3>
                <p className="text-[11px] text-slate-500">
                  Detailed stitching batch logs with assigned pieces, yields, defects, and proof photos.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              {batches.length} {batches.length === 1 ? 'Batch' : 'Batches'}
            </span>
          </div>

          {batches.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No stitching batches recorded yet. When cut or embroidered pieces arrive, click "Record Stitching" above to record a sewing run.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Batch #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-3">Color / Size</th>
                    <th className="py-3 px-3 text-right">Assigned Qty</th>
                    <th className="py-3 px-3 text-right">Completed Qty</th>
                    <th className="py-3 px-3 text-right">Accepted Qty</th>
                    <th className="py-3 px-3 text-right">Rejected</th>
                    <th className="py-3 px-3 text-right">Rework</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Proof Photos</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.map((batch) => {
                    const assigned = Number(batch.assigned_quantity || batch.completed_quantity || 0);
                    const comp = Number(batch.completed_quantity || 0);
                    const acc = Number(batch.accepted_quantity || (comp - Number(batch.rejected_quantity || 0) - Number(batch.rework_quantity || 0)));
                    const rej = Number(batch.rejected_quantity || 0);
                    const rwk = Number(batch.rework_quantity || 0);
                    const photos = parsePhotos(batch.photo_urls);

                    return (
                      <tr key={batch.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-brand-700">
                          {batch.batch_number}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono">
                          {batch.completion_date || batch.start_date || 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-800 block">{batch.product_name || 'Garment Item'}</span>
                          {batch.remarks && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-xs">{batch.remarks}</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800 block">{batch.color || 'Standard'}</span>
                          <span className="text-[10px] font-mono text-slate-400">Size: {batch.size || 'M'}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">{fmt(assigned)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{fmt(comp)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">{fmt(acc)}</td>
                        <td className="py-3 px-3 text-right font-mono text-red-600 font-semibold">{fmt(rej)}</td>
                        <td className="py-3 px-3 text-right font-mono text-amber-600 font-semibold">{fmt(rwk)}</td>
                        <td className="py-3 px-3 text-center">
                          {batch.status === 'Transferred to Checking' || (batch as any).is_transferred ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-purple-600" />
                              Transferred to Checking
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Completed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {photos.length > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              {photos.slice(0, 2).map((url, pIdx) => (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() => setPreviewImage(url)}
                                  className="w-7 h-7 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition shrink-0"
                                >
                                  <img src={url} alt="Proof" className="w-full h-full object-cover" />
                                </button>
                              ))}
                              {photos.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage(photos[0])}
                                  className="w-7 h-7 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold border border-slate-200 flex items-center justify-center"
                                >
                                  +{photos.length - 2}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {batch.status === 'Transferred to Checking' || (batch as any).is_transferred ? (
                            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded border border-purple-200 inline-flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                              In Checking
                            </span>
                          ) : (
                            <Button
                              id={`btn-transfer-checking-${batch.id}`}
                              size="xs"
                              variant="secondary"
                              icon={<ArrowRight className="w-3 h-3" />}
                              onClick={() => handleOpenTransferModal(batch)}
                              className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold text-[11px]"
                            >
                              To Checking
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    )}

    {activeTab === 'rework' && (
      <StageReworkSection
        productionOrderId={Number(order?.id || id)}
        stageId={7}
        stageCode="STI"
        stageName="Stitching"
        uom="PCS"
        onReload={fetchOrderData}
      />
    )}
  </div>

      {/* MODAL 1: Record Stitching Batch */}
      <Modal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title="Record Stitching Batch"
        subtitle={`${selectedItem?.product_name || 'Garment Product'} • Color: ${selectedItem?.color || 'Standard'} • Order: ${order?.order_number || ''}`}
        size="xl"
      >
        <form onSubmit={handleSaveBatch} className="space-y-4">
          {batchError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{batchError}</span>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Start Date</span>
                <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="date"
                value={batchForm.start_date}
                onChange={e => setBatchForm({ ...batchForm, start_date: e.target.value })}
                className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium text-slate-800 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Completion Date</span>
                <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="date"
                value={batchForm.completion_date}
                onChange={e => setBatchForm({ ...batchForm, completion_date: e.target.value })}
                className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium text-slate-800 transition"
                required
              />
            </div>
          </div>

          {/* Yield & Quantity Reconciliation (Assigned is auto-fetched and read-only, accepted is removed) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Yield & Quantity Reconciliation
                </span>
                <span className="text-[11px] text-slate-500">
                  Assigned balance and stitching output tally
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                <Lock className="w-3 h-3 text-blue-600" />
                Auto-Fetched
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Assigned Qty: Auto-fetched, Not Editable */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center justify-between">
                  <span>Assigned</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </label>
                <input
                  type="number"
                  value={batchForm.assigned_quantity}
                  readOnly
                  disabled
                  className="w-full text-sm px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-slate-700 cursor-not-allowed select-none"
                  title="Automatically fetched from cutting or embroidery and not editable."
                />
              </div>

              {/* Completed Qty */}
              <div className="bg-white p-2.5 rounded-lg border border-blue-200 shadow-xs">
                <label className="block text-[11px] font-bold text-blue-900 uppercase mb-1">
                  Completed <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={batchForm.assigned_quantity > 0 ? batchForm.assigned_quantity : 999999}
                  value={batchForm.completed_quantity}
                  onChange={e => setBatchForm({ ...batchForm, completed_quantity: Number(e.target.value) })}
                  className="w-full text-sm px-2.5 py-1.5 border border-blue-300 rounded font-mono font-bold text-blue-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  required
                />
              </div>

              {/* Rejected Qty */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Rejected
                </label>
                <input
                  type="number"
                  min="0"
                  value={batchForm.rejected_quantity}
                  onChange={e => setBatchForm({ ...batchForm, rejected_quantity: Math.max(0, Number(e.target.value)) })}
                  className="w-full text-sm px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold text-slate-800 focus:ring-2 focus:ring-red-400/20 focus:border-red-500"
                />
              </div>

              {/* Rework Qty */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Rework
                </label>
                <input
                  type="number"
                  min="0"
                  value={batchForm.rework_quantity}
                  onChange={e => setBatchForm({ ...batchForm, rework_quantity: Math.max(0, Number(e.target.value)) })}
                  className="w-full text-sm px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold text-slate-800 focus:ring-2 focus:ring-amber-400/20 focus:border-amber-500"
                />
              </div>
            </div>

            {Number(batchForm.rework_quantity) > 0 && (
              <div className="pt-2 border-t border-amber-200/80 bg-amber-50/60 p-3 rounded-lg space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-amber-900 block mb-1">
                      Rework Defect Category *
                    </label>
                    <select
                      value={batchForm.rework_reason}
                      onChange={e => setBatchForm({ ...batchForm, rework_reason: e.target.value })}
                      className="w-full text-xs rounded border border-amber-300 py-1.5 px-2 bg-white font-medium text-amber-900"
                    >
                      <option value="Broken Seam / Stitching Defect">Broken Seam / Stitching Defect</option>
                      <option value="Pucker / High Thread Tension">Pucker / High Thread Tension</option>
                      <option value="Incorrect Label / Hemming">Incorrect Label / Hemming</option>
                      <option value="Skipped Stitches / Needle Run">Skipped Stitches / Needle Run</option>
                      <option value="Uneven Topstitching">Uneven Topstitching</option>
                      <option value="Other Stitching Defect">Other Stitching Defect</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-amber-900 block mb-1">
                      Correction Process / Line
                    </label>
                    <select
                      value={batchForm.rework_destination}
                      onChange={e => setBatchForm({ ...batchForm, rework_destination: e.target.value })}
                      className="w-full text-xs rounded border border-amber-300 py-1.5 px-2 bg-white font-medium text-slate-800"
                    >
                      <option value="Stitching Line Correction">Stitching Line Correction</option>
                      <option value="In-House Alteration / Unpicking">In-House Alteration / Unpicking</option>
                      <option value="Finishing / Hemming Touch-up">Finishing / Hemming Touch-up</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-amber-900 block mb-1">
                    Alteration Instructions / Defect Details
                  </label>
                  <input
                    type="text"
                    value={batchForm.rework_remarks}
                    onChange={e => setBatchForm({ ...batchForm, rework_remarks: e.target.value })}
                    placeholder="e.g. Unpick side seam 3 inches, re-stitch with matched thread..."
                    className="w-full text-xs rounded border border-amber-300 py-1.5 px-2 bg-white text-slate-800"
                  />
                </div>
              </div>
            )}

            {/* Dynamic Passed QC Output Banner */}
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-950 block">Estimated Passed QC Output</span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Auto-calculated: {batchForm.completed_quantity || 0} completed − {batchForm.rejected_quantity || 0} rej − {batchForm.rework_quantity || 0} rwk
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black font-mono text-emerald-700">
                  {Math.max(0, Number(batchForm.completed_quantity || 0) - Number(batchForm.rejected_quantity || 0) - Number(batchForm.rework_quantity || 0))}
                </span>
                <span className="text-xs font-bold text-emerald-600 ml-1">pcs</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Stitching Quality Notes & Alteration Details</span>
            </label>
            <textarea
              rows={2}
              value={batchForm.remarks}
              onChange={e => setBatchForm({ ...batchForm, remarks: e.target.value })}
              className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 transition placeholder:text-slate-400"
              placeholder="Enter stitching notes, seam specifications, or alteration instructions..."
            />
          </div>

          {/* Mandatory Live Camera Photo Proof */}
          <LivePhotoCaptureField
            label="Stitching Line Quality & Seam Proof Photographs"
            required={true}
            photos={photoUrls}
            onPhotosChange={setPhotoUrls}
            stageName="Stitching (Stage 08)"
            orderNumber={order?.order_number}
            error={batchError && photoUrls.length === 0 ? 'Real-time camera photograph with live GPS coordinates is mandatory before recording stitching batch.' : undefined}
            buttonText="Take Real-Time Stitching Photo"
          />

          <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchModalOpen(false)}
              disabled={savingBatch}
            >
              Cancel
            </Button>
            <Button
              id="btn-submit-stitching-batch"
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingBatch}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5"
            >
              {savingBatch ? 'Saving...' : 'Save Stitching Batch'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Transfer to Stage 08 Checking */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer Completed Stitching to Stage 08: Checking"
        size="md"
      >
        <form onSubmit={handleConfirmTransfer} className="space-y-4">
          {transferError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{transferError}</span>
            </div>
          )}

          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Target Stage</span>
            <span className="text-sm font-bold text-purple-900 block">
              Stage 08: Checking / Quality Inspection
            </span>
            <span className="text-xs text-purple-700 block">
              Product: <strong>{transferItem?.product_name || 'Garment Item'}</strong> • Color: <strong>{transferItem?.color || 'Standard'}</strong>
            </span>
          </div>

          <FormField label="Quantity to Transfer" required>
            <input
              type="number"
              min="1"
              max={Number(transferItem?.ready_to_transfer || transferItem?.accepted_quantity || overallTotals.readyForChecking || 1000)}
              value={transferQuantity}
              onChange={e => setTransferQuantity(Number(e.target.value))}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono font-bold text-purple-900"
              required
            />
          </FormField>

          <FormField label="Transfer Remarks">
            <textarea
              rows={2}
              value={transferRemarks}
              onChange={e => setTransferRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-800"
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTransferModalOpen(false)}
              disabled={transferring}
            >
              Cancel
            </Button>
            <Button
              id="btn-confirm-transfer-to-checking"
              variant="primary"
              size="sm"
              type="submit"
              disabled={transferring}
              className="bg-purple-700 hover:bg-purple-800 text-white font-bold"
            >
              {transferring ? 'Transferring...' : 'Confirm Transfer to Checking'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Full Resolution Photo Zoom Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-xl overflow-hidden shadow-2xl p-2" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/60 text-white hover:bg-black flex items-center justify-center transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-h-[85vh] w-auto mx-auto object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
