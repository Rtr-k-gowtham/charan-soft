// src/pages/production/CuttingOrderDetail.tsx
// Stage 05: Product-wise Cutting Batches, Yield Reconciliation & Stage Transfer
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStageBackNavigation } from '../../utils/navigation';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, CuttingBatch } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { LivePhotoCaptureField } from '../../components/production/LivePhotoCaptureField';
import {
  ArrowLeft,
  Scissors,
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
  Cpu,
  Trash2,
  ZoomIn,
  Eye,
  CheckCheck,
  FileText,
  RotateCcw
} from 'lucide-react';
import StageReworkSection from '../../components/production/StageReworkSection';

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

export default function CuttingOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const handleBack = useStageBackNavigation('/production/cutting');

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [batches, setBatches] = useState<CuttingBatch[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'batches' | 'rework'>('batches');

  // New Batch Modal State
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [batchForm, setBatchForm] = useState({
    cutting_date: new Date().toISOString().split('T')[0],
    assigned_quantity: 0,
    actual_cut_quantity: 0,
    rejected_quantity: 0,
    rework_quantity: 0,
    rework_reason: 'Incorrect Dimensions / Cutting Defect',
    rework_destination: 'Cutting Recut / Correction',
    rework_remarks: '',
    remarks: '',
  });
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchError, setBatchError] = useState('');

  // Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<CuttingBatch | null>(null);
  const [transferForm, setTransferForm] = useState({
    destination_stage_id: '6', // default to Embroidery (6) or Stitching (7)
    transfer_quantity: 0,
    remarks: '',
  });
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [transferError, setTransferError] = useState('');

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const loadData = () => {
    if (!id) return;
    setLoading(true);
    setError('');

    Promise.all([
      api.getCuttingOrderDetails(id),
      api.getProductionStages(),
    ])
      .then(([cutRes, stagesRes]) => {
        const cData = (cutRes as any)?.data || cutRes;
        setOrder(cData.order || null);
        setItems(cData.items || []);
        setBatches(cData.batches || []);
        setStages((stagesRes as ProductionStage[]) || []);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load cutting stage order');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const getBatchesForItem = (it: any) => {
    return batches.filter(b => {
      if (b.production_order_item_id === it.id) return true;
      if (b.product_id && it.product_id && Number(b.product_id) === Number(it.product_id)) {
        if (it.color || b.color) {
          return (b.color || '').trim().toLowerCase() === (it.color || '').trim().toLowerCase();
        }
        return true;
      }
      return false;
    });
  };

  const handleOpenBatchModal = (item: any) => {
    const itTotal = Number(item.total_quantity || 0);
    const itemBatches = getBatchesForItem(item);
    const itCut = itemBatches.reduce((s, b) => s + Number(b.actual_cut_quantity || 0), 0);
    const pending = Math.max(0, itTotal - itCut);

    if (pending <= 0) {
      return;
    }

    setSelectedItem(item);
    setBatchForm({
      cutting_date: new Date().toISOString().split('T')[0],
      assigned_quantity: pending,
      actual_cut_quantity: pending,
      rejected_quantity: 0,
      rework_quantity: 0,
      rework_reason: 'Incorrect Dimensions / Cutting Defect',
      rework_destination: 'Cutting Recut / Correction',
      rework_remarks: '',
      remarks: '',
    });
    setPhotoUrls([]);
    setBatchError('');
    setBatchModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    try {
      const files = Array.from(e.target.files);
      const newUrls: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const b64 = await processImageFile(file);
        newUrls.push(b64);
      }
      setPhotoUrls((prev) => [...prev, ...newUrls]);
    } catch {
      setBatchError('Failed to process image');
    }
  };

  const handleSaveBatch = async () => {
    if (!selectedItem) return;
    const actual = Number(batchForm.actual_cut_quantity || 0);
    const rej = Number(batchForm.rejected_quantity || 0);
    const rwk = Number(batchForm.rework_quantity || 0);
    const assigned = Number(batchForm.assigned_quantity || 0);

    if (actual <= 0) {
      setBatchError('Actual Cut Qty must be greater than zero');
      return;
    }
    if (assigned > 0 && actual > assigned) {
      setBatchError(`Actual Cut Qty (${actual}) cannot exceed remaining assigned quantity (${assigned})`);
      return;
    }
    if (rej + rwk > actual) {
      setBatchError(`Rejected (${rej}) + Rework (${rwk}) cannot exceed actual cut quantity (${actual})`);
      return;
    }
    if (!photoUrls || photoUrls.length === 0) {
      setBatchError('Real-time camera photograph with live GPS coordinates is mandatory before confirming cutting batch.');
      return;
    }

    setSavingBatch(true);
    setBatchError('');
    try {
      await api.createCuttingBatch({
        production_order_id: Number(id),
        production_order_item_id: selectedItem.id,
        product_id: selectedItem.product_id,
        color: selectedItem.color,
        assigned_quantity: assigned > 0 ? assigned : actual,
        actual_cut_quantity: actual,
        rejected_quantity: rej,
        rework_quantity: rwk,
        rework_reason: batchForm.rework_reason,
        rework_destination: batchForm.rework_destination,
        rework_remarks: batchForm.rework_remarks,
        cutting_date: batchForm.cutting_date,
        remarks: batchForm.remarks,
        photo_urls: photoUrls,
      });

      setBatchModalOpen(false);
      setToastMessage('Cutting batch recorded and yield reconciled successfully!');
      loadData();
    } catch (err: any) {
      setBatchError(err.message || 'Failed to save cutting batch');
    } finally {
      setSavingBatch(false);
    }
  };

  const handleOpenTransferModal = (batch: CuttingBatch) => {
    setSelectedBatch(batch);
    const avail = (batch.accepted_output_quantity || 0) - (batch.transferred_to_next_stage_quantity || 0);
    setTransferForm({
      destination_stage_id: '6', // Embroidery Outward
      transfer_quantity: Math.max(0, avail),
      remarks: '',
    });
    setTransferError('');
    setTransferModalOpen(true);
  };

  const handleSaveTransfer = async () => {
    if (!selectedBatch) return;
    const qty = Number(transferForm.transfer_quantity || 0);
    const avail = (selectedBatch.accepted_output_quantity || 0) - (selectedBatch.transferred_to_next_stage_quantity || 0);

    if (qty <= 0) {
      setTransferError('Transfer quantity must be greater than zero');
      return;
    }
    if (qty > avail) {
      setTransferError(`Transfer quantity (${qty}) exceeds available accepted output (${avail})`);
      return;
    }

    setSavingTransfer(true);
    setTransferError('');
    try {
      await api.transferCuttingOutput({
        batch_id: selectedBatch.id,
        destination_stage_id: Number(transferForm.destination_stage_id),
        transfer_quantity: qty,
        remarks: transferForm.remarks,
      });

      setTransferModalOpen(false);
      const stageName = Number(transferForm.destination_stage_id) === 7 ? '07. Stitching' : '06. Embroidery';
      setToastMessage(`Successfully transferred ${qty} pieces to ${stageName}!`);
      loadData();
    } catch (err: any) {
      setTransferError(err.message || 'Failed to transfer batch output');
    } finally {
      setSavingTransfer(false);
    }
  };

  // Yield summary
  const yieldSummary = useMemo(() => {
    const totalOrdered = items.reduce((s, i) => s + Number(i.total_quantity || 0), 0);
    const totalCut = batches.reduce((s, b) => s + Number(b.actual_cut_quantity || 0), 0);
    const totalAccepted = batches.reduce((s, b) => s + Number(b.accepted_output_quantity || 0), 0);
    const totalRejected = batches.reduce((s, b) => s + Number(b.rejected_quantity || 0), 0);
    const totalRework = batches.reduce((s, b) => s + Number(b.rework_quantity || 0), 0);
    const totalTransferred = batches.reduce((s, b) => s + Number(b.transferred_to_next_stage_quantity || 0), 0);
    const totalPending = Math.max(0, totalOrdered - totalAccepted);

    const yieldPct = totalCut > 0 ? ((totalAccepted / totalCut) * 100).toFixed(1) : '100.0';

    return {
      totalOrdered,
      totalCut,
      totalAccepted,
      totalRejected,
      totalRework,
      totalTransferred,
      totalPending,
      yieldPct,
    };
  }, [items, batches]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-4">
        <div className="h-8 w-64 bg-slate-200 animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-4">
        <Button variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={handleBack}>
          Back to Cutting Orders
        </Button>
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-bold text-red-800">{error || 'Order not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50/50 pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title={`Cutting Stage: ${order.order_number}`}
        subtitle={`Stage 05 — Product-wise Cutting Batches, Yield Tracking & Stage Transfers`}
        breadcrumb={[
          { label: 'Production', href: '/production/orders' },
          { label: '05. Cutting', href: '/production/cutting' },
          { label: order.order_number },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={handleBack}>
              Back
            </Button>
            <button
              onClick={loadData}
              className="p-2 text-slate-500 hover:text-brand-600 rounded-lg border border-slate-200 hover:bg-slate-50 transition bg-white shadow-2xs"
              title="Refresh Cutting Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Order Info & Buyer Banner */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BuyerAvatar buyer={order} size="md" shape="circle" className="shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                  {order.order_number}
                </span>
                <span className="text-xs font-bold text-slate-900">{order.customer_name || 'Direct Buyer'}</span>
                {order.customer_code && (
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {order.customer_code}
                  </span>
                )}
                <StatusBadge status={order.priority || 'Medium'} />
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  Stage 05: Cutting Active
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1">{order.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Target Delivery</span>
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {order.target_delivery_date || '—'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px]">Order Quantity</span>
              <span className="font-bold text-brand-700 text-sm">{fmt(yieldSummary.totalOrdered)} pcs</span>
            </div>
          </div>
        </div>

        {/* Quick KPI Stat Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned / Target</span>
            <span className="text-base font-bold text-slate-800 font-mono mt-0.5 block">{fmt(yieldSummary.totalOrdered)}</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Actual Cut</span>
            <span className="text-base font-bold text-indigo-700 font-mono mt-0.5 block">{fmt(yieldSummary.totalCut)}</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Accepted Output</span>
            <span className="text-base font-bold text-emerald-700 font-mono mt-0.5 block">{fmt(yieldSummary.totalAccepted)}</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rejection / Scrap</span>
            <span className="text-base font-bold text-red-600 font-mono mt-0.5 block">
              {fmt(yieldSummary.totalRejected)}{' '}
              <span className="text-xs text-slate-400 font-normal">({yieldSummary.totalRework} rwk)</span>
            </span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Transferred Next</span>
            <span className="text-base font-bold text-purple-700 font-mono mt-0.5 block">{fmt(yieldSummary.totalTransferred)}</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cutting Yield %</span>
            <span className="text-base font-bold text-brand-700 font-mono mt-0.5 block">{yieldSummary.yieldPct}%</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('batches')}
            className={`pb-3 pt-1 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'batches'
                ? 'border-amber-600 text-amber-700 bg-amber-50/40 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scissors className="w-4 h-4" />
            Cutting Batches & Output ({batches.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rework')}
            className={`pb-3 pt-1 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'rework'
                ? 'border-amber-600 text-amber-700 bg-amber-50/40 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Stage 05 Rework & Recutting
            {yieldSummary.totalRework > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                {fmt(yieldSummary.totalRework)} pcs
              </span>
            )}
          </button>
        </div>

        {activeTab === 'batches' && (
          <>
            {/* Product-Wise Cutting Breakdown Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Product-Wise Cutting Status & Batches
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {items.length} {items.length === 1 ? 'Product Line' : 'Product Lines'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Product Name & SKU</th>
                  <th className="py-3 px-3">Color / Size</th>
                  <th className="py-3 px-3 text-right">Order Qty</th>
                  <th className="py-3 px-3 text-right">Actual Cut</th>
                  <th className="py-3 px-3 text-right">Accepted</th>
                  <th className="py-3 px-3 text-right">Rejected</th>
                  <th className="py-3 px-3 text-right">Transferred</th>
                  <th className="py-3 px-3 text-right">Pending Cut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => {
                  const itTotal = Number(it.total_quantity || 0);
                  const itemBatches = getBatchesForItem(it);
                  const itCut = itemBatches.reduce((s, b) => s + Number(b.actual_cut_quantity || 0), 0);
                  const itAcc = itemBatches.reduce((s, b) => s + Number(b.accepted_output_quantity || 0), 0);
                  const itRej = itemBatches.reduce((s, b) => s + Number(b.rejected_quantity || 0), 0);
                  const itTrf = itemBatches.reduce((s, b) => s + Number(b.transferred_to_next_stage_quantity || 0), 0);
                  const itPending = Math.max(0, itTotal - itCut);

                  return (
                    <tr key={it.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">{it.product_name || 'Product'}</span>
                        {it.product_code && (
                          <span className="font-mono text-[10px] text-brand-600 block">{it.product_code}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-700 block">{it.color || 'Standard'}</span>
                        <span className="text-[10px] font-mono text-slate-400">Size: {it.size || 'M'}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{fmt(itTotal)}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-indigo-700">{fmt(itCut)}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">{fmt(itAcc)}</td>
                      <td className="py-3 px-3 text-right font-mono text-red-600 font-semibold">{fmt(itRej)}</td>
                      <td className="py-3 px-3 text-right font-mono text-purple-700 font-semibold">{fmt(itTrf)}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-600">
                        {itPending > 0 ? fmt(itPending) : <span className="text-emerald-600">Complete</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {itPending <= 0 ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Completed
                          </span>
                        ) : (
                          <Button
                            size="xs"
                            variant="primary"
                            icon={<Plus className="w-3 h-3" />}
                            onClick={() => handleOpenBatchModal(it)}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px]"
                          >
                            Record Cut Batch
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cutting Batches History Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Recorded Cutting Batches & Transfer Status
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {batches.length} {batches.length === 1 ? 'Batch' : 'Batches'}
            </span>
          </div>

          {batches.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No cutting batches recorded yet. Click "Record Cut Batch" above to log cutting outputs.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Product / Color</th>
                    <th className="py-3 px-3 text-right">Actual Cut</th>
                    <th className="py-3 px-3 text-right">Accepted</th>
                    <th className="py-3 px-3 text-right">Rejected</th>
                    <th className="py-3 px-3 text-right">Transferred</th>
                    <th className="py-3 px-3">Transferred To</th>
                    <th className="py-3 px-3 text-center">Proof Photos</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.map((b) => {
                    const avail = Number(b.accepted_output_quantity || 0) - Number(b.transferred_to_next_stage_quantity || 0);
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-mono font-bold text-brand-700">{b.batch_number}</td>
                        <td className="py-3 px-3 text-slate-600 font-mono">{b.cutting_date}</td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800 block">{b.product_name}</span>
                          <span className="text-[10px] text-slate-400">{b.color} • Size {b.size || 'M'}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">{fmt(b.actual_cut_quantity)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">{fmt(b.accepted_output_quantity)}</td>
                        <td className="py-3 px-3 text-right font-mono text-red-600 font-semibold">{fmt(b.rejected_quantity)}</td>
                        <td className="py-3 px-3 text-right font-mono text-purple-700 font-semibold">{fmt(b.transferred_to_next_stage_quantity || 0)}</td>
                        <td className="py-3 px-3">
                          {b.destination_stage_name ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-[11px]">
                              <ArrowRight className="w-3 h-3 text-purple-600" />
                              {b.destination_stage_name}
                            </span>
                          ) : b.destination_stage_id ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-[11px]">
                              <ArrowRight className="w-3 h-3 text-purple-600" />
                              {Number(b.destination_stage_id) === 6 ? 'Stage 06: Embroidery' : 'Stage 07: Stitching'}
                            </span>
                          ) : Number(b.transferred_to_next_stage_quantity || 0) > 0 ? (
                            <span className="text-purple-600 font-semibold text-[11px]">Transferred</span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Pending Transfer</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {(() => {
                            const photos = parsePhotos(b.photo_urls);
                            return photos.length > 0 ? (
                              <div className="flex items-center justify-center gap-1">
                                {photos.map((url, pIdx) => (
                                  <button
                                    key={pIdx}
                                    type="button"
                                    onClick={() => setPreviewImage(url)}
                                    className="w-6 h-6 rounded border border-slate-200 overflow-hidden hover:scale-110 transition shadow-2xs cursor-pointer"
                                  >
                                    <img src={url} alt="Proof" className="w-full h-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No photos</span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {avail > 0 ? (
                            <Button
                              size="xs"
                              variant="secondary"
                              icon={<ArrowRight className="w-3 h-3 text-purple-600" />}
                              onClick={() => handleOpenTransferModal(b)}
                              className="text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200"
                            >
                              Transfer ({avail})
                            </Button>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                              <CheckCheck className="w-3 h-3 text-emerald-600" />
                              Transferred ({fmt(b.transferred_to_next_stage_quantity || b.accepted_output_quantity)})
                            </span>
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
        stageId={5}
        stageCode="CUT"
        stageName="Cutting"
        uom="PCS"
        onReload={loadData}
      />
    )}
  </div>

      {/* MODAL: Record Cutting Batch */}
      <Modal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title={`Record Cutting Batch: ${selectedItem?.product_name || 'Product'}`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          {batchError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{batchError}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-slate-500">Color / Size: </span>
              <strong className="text-slate-800">{selectedItem?.color} • {selectedItem?.size || 'M'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Order Quantity: </span>
              <strong className="text-brand-700">{fmt(selectedItem?.total_quantity || 0)} pcs</strong>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Cutting Date" required>
              <input
                type="date"
                value={batchForm.cutting_date}
                onChange={(e) => setBatchForm({ ...batchForm, cutting_date: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </FormField>

            <FormField label="Assigned Quantity" required>
              <input
                type="number"
                value={batchForm.assigned_quantity}
                readOnly
                disabled
                className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100 text-slate-700 rounded-lg text-xs font-mono font-bold cursor-not-allowed"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Actual Cut Qty" required>
              <input
                type="number"
                min={1}
                max={batchForm.assigned_quantity || undefined}
                value={batchForm.actual_cut_quantity}
                onChange={(e) => setBatchForm({ ...batchForm, actual_cut_quantity: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-indigo-700"
              />
            </FormField>

            <FormField label="Rejected Qty">
              <input
                type="number"
                min={0}
                value={batchForm.rejected_quantity}
                onChange={(e) => setBatchForm({ ...batchForm, rejected_quantity: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-red-600"
              />
            </FormField>

            <FormField label="Rework Qty">
              <input
                type="number"
                min={0}
                value={batchForm.rework_quantity}
                onChange={(e) => setBatchForm({ ...batchForm, rework_quantity: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-amber-600"
              />
            </FormField>
          </div>

          {Number(batchForm.rework_quantity) > 0 && (
            <div className="pt-2 border-t border-amber-200/80 bg-amber-50/60 p-3 rounded-lg space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-amber-850 block mb-1">
                    Rework Defect Category *
                  </label>
                  <select
                    value={batchForm.rework_reason}
                    onChange={(e) => setBatchForm({ ...batchForm, rework_reason: e.target.value })}
                    className="w-full text-xs rounded border border-amber-300 py-1.5 px-2 bg-white font-medium text-amber-900"
                  >
                    <option value="Incorrect Dimensions / Cutting Defect">Incorrect Dimensions / Cutting Defect</option>
                    <option value="Pattern / Grain Line Misalignment">Pattern / Grain Line Misalignment</option>
                    <option value="Notch / Drill Mark Missing">Notch / Drill Mark Missing</option>
                    <option value="Fabric Ply Shifting / Frayed Edges">Fabric Ply Shifting / Frayed Edges</option>
                    <option value="Bundle Mismatch / Label Defect">Bundle Mismatch / Label Defect</option>
                    <option value="Other Cutting Defect">Other Cutting Defect</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-amber-850 block mb-1">
                    Correction Process / Line
                  </label>
                  <select
                    value={batchForm.rework_destination}
                    onChange={(e) => setBatchForm({ ...batchForm, rework_destination: e.target.value })}
                    className="w-full text-xs rounded border border-amber-300 py-1.5 px-2 bg-white font-medium text-slate-800"
                  >
                    <option value="Cutting Recut / Correction">Cutting Recut / Correction Line</option>
                    <option value="In-House Alteration / Trimming">In-House Alteration / Trimming</option>
                    <option value="Fabric Sorting / Re-layering">Fabric Sorting / Re-layering</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-amber-850 block mb-1">
                  Rework Instructions / Defect Details
                </label>
                <input
                  type="text"
                  value={batchForm.rework_remarks}
                  onChange={(e) => setBatchForm({ ...batchForm, rework_remarks: e.target.value })}
                  placeholder="e.g. Sleeves 0.5cm shorter than pattern spec, recut front plackets..."
                  className="w-full text-xs rounded border border-amber-300 py-1.5 px-2 bg-white text-slate-800"
                />
              </div>
            </div>
          )}

          {/* Calculated Net Accepted Output */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-800">Calculated Net Accepted Output:</span>
            <span className="font-mono font-bold text-sm text-emerald-700">
              {fmt(Math.max(0, Number(batchForm.actual_cut_quantity) - Number(batchForm.rejected_quantity) - Number(batchForm.rework_quantity)))} pcs
            </span>
          </div>

          <FormField label="Notes">
            <textarea
              rows={2}
              value={batchForm.remarks}
              onChange={(e) => setBatchForm({ ...batchForm, remarks: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              placeholder="Enter notes..."
            />
          </FormField>

          {/* Mandatory Live Camera Photo Proof */}
          <LivePhotoCaptureField
            label="Cutting Lay & Bundle Photograph Evidence"
            required={true}
            photos={photoUrls}
            onPhotosChange={setPhotoUrls}
            stageName="Cutting (Stage 06)"
            orderNumber={order?.order_number}
            error={batchError && photoUrls.length === 0 ? 'Real-time camera photograph with live GPS coordinates is mandatory before confirming cutting batch.' : undefined}
            buttonText="Take Real-Time Cutting Photo"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setBatchModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={savingBatch}
              onClick={handleSaveBatch}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
            >
              {savingBatch ? 'Saving...' : 'Confirm Cutting Batch'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Transfer to Next Stage */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title={`Transfer Output: Batch ${selectedBatch?.batch_number}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          {transferError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{transferError}</span>
            </div>
          )}

          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs flex justify-between font-mono">
            <span>Available Accepted Output:</span>
            <strong className="text-purple-700">
              {fmt(Number(selectedBatch?.accepted_output_quantity || 0) - Number(selectedBatch?.transferred_to_next_stage_quantity || 0))} pcs
            </strong>
          </div>

          <FormField label="Destination Production Stage" required>
            <select
              value={transferForm.destination_stage_id}
              onChange={(e) => setTransferForm({ ...transferForm, destination_stage_id: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
            >
              <option value="6">06. Embroidery — Outward / Inward</option>
              <option value="7">07. Stitching — Color-wise Tracking</option>
            </select>
          </FormField>

          <FormField label="Quantity to Transfer" required>
            <input
              type="number"
              value={transferForm.transfer_quantity}
              onChange={(e) => setTransferForm({ ...transferForm, transfer_quantity: Number(e.target.value) })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-purple-700"
            />
          </FormField>

          <FormField label="Transfer Handover Notes">
            <textarea
              rows={2}
              value={transferForm.remarks}
              onChange={(e) => setTransferForm({ ...transferForm, remarks: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={savingTransfer}
              onClick={handleSaveTransfer}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
            >
              {savingTransfer ? 'Transferring...' : 'Confirm Stage Transfer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Photo Zoom Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={previewImage} alt="Enlarged" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-800 font-bold flex items-center justify-center shadow-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
