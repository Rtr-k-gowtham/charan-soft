// src/pages/production/StitchingOrderDetail.tsx
// Stage 07: Stitching — Color-wise Tracking, Batch Management, Operator Allocations & Yield Reconciliation
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, StitchingBatch } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
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
  User,
  Cpu,
  Trash2,
  ZoomIn,
  Eye,
  CheckCheck,
  FileText,
  Users
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

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [batches, setBatches] = useState<StitchingBatch[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Batch Modal State
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [batchForm, setBatchForm] = useState({
    start_date: new Date().toISOString().split('T')[0],
    completion_date: new Date().toISOString().split('T')[0],
    assigned_quantity: 0,
    completed_quantity: 0,
    accepted_quantity: 0,
    rejected_quantity: 0,
    rework_quantity: 0,
    operator_team: 'Stitching Team Alpha (Line #3)',
    production_line: 'Juki Direct Drive Industrial Line A-4',
    supervisor: 'M. Chinnasamy (Floor Head)',
    remarks: 'Flatlock seam reinforcement on hem and neck rib verified.'
  });
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchError, setBatchError] = useState('');

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
      const [orderRes, stagesRes, batchesRes] = await Promise.all([
        api.getProductionOrder(Number(id)),
        api.getProductionStages(),
        api.getStitchingBatches(Number(id))
      ]);

      const ord = (orderRes as any)?.data || orderRes;
      setOrder(ord);
      setItems(ord.items || []);

      const st = (stagesRes as any)?.data || stagesRes;
      setStages(Array.isArray(st) ? st : []);

      const bt = (batchesRes as any)?.data || batchesRes;
      setBatches(Array.isArray(bt) ? bt : []);
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

  // Group batches by production_order_item_id
  const batchesByItem = useMemo(() => {
    const map: Record<number, StitchingBatch[]> = {};
    batches.forEach(b => {
      if (!map[b.production_order_item_id]) {
        map[b.production_order_item_id] = [];
      }
      map[b.production_order_item_id].push(b);
    });
    return map;
  }, [batches]);

  // Aggregate product-wise totals
  const summaryByItem = useMemo(() => {
    const map: Record<number, {
      totalAssigned: number;
      totalCompleted: number;
      totalAccepted: number;
      totalRejected: number;
      totalRework: number;
      balance: number;
    }> = {};

    items.forEach(it => {
      const itBatches = batchesByItem[it.id] || [];
      const totalAssigned = itBatches.reduce((sum, b) => sum + Number(b.assigned_quantity || 0), 0);
      const totalCompleted = itBatches.reduce((sum, b) => sum + Number(b.completed_quantity || 0), 0);
      const totalAccepted = itBatches.reduce((sum, b) => sum + Number(b.accepted_quantity || 0), 0);
      const totalRejected = itBatches.reduce((sum, b) => sum + Number(b.rejected_quantity || 0), 0);
      const totalRework = itBatches.reduce((sum, b) => sum + Number(b.rework_quantity || 0), 0);
      const balance = Math.max(0, Number(it.quantity || 0) - totalAccepted);

      map[it.id] = {
        totalAssigned,
        totalCompleted,
        totalAccepted,
        totalRejected,
        totalRework,
        balance
      };
    });

    return map;
  }, [items, batchesByItem]);

  // Overall totals across all products
  const overallTotals = useMemo(() => {
    let orderQty = 0;
    let completedQty = 0;
    let acceptedQty = 0;
    let rejectedQty = 0;
    let reworkQty = 0;
    let balanceQty = 0;

    items.forEach(it => {
      orderQty += Number(it.quantity || 0);
      const s = summaryByItem[it.id];
      if (s) {
        completedQty += s.totalCompleted;
        acceptedQty += s.totalAccepted;
        rejectedQty += s.totalRejected;
        reworkQty += s.totalRework;
        balanceQty += s.balance;
      }
    });

    return { orderQty, completedQty, acceptedQty, rejectedQty, reworkQty, balanceQty };
  }, [items, summaryByItem]);

  // Open Add Batch Modal
  const handleOpenBatchModal = (item: any) => {
    setSelectedItem(item);
    const existing = summaryByItem[item.id] || { totalAccepted: 0, balance: item.quantity };
    const pendingQty = Math.max(0, Number(item.quantity || 0) - existing.totalAccepted);

    setBatchForm({
      start_date: new Date().toISOString().split('T')[0],
      completion_date: new Date().toISOString().split('T')[0],
      assigned_quantity: pendingQty,
      completed_quantity: pendingQty,
      accepted_quantity: pendingQty,
      rejected_quantity: 0,
      rework_quantity: 0,
      operator_team: 'Stitching Team Alpha (Line #3)',
      production_line: 'Juki Direct Drive Line #4',
      supervisor: 'M. Chinnasamy (Floor Head)',
      remarks: 'Double-needle coverstitch on hem and armholes inspected.'
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
        const base64 = await processImageFile(files[i]);
        newUrls.push(base64);
      }
      setPhotoUrls(prev => [...prev, ...newUrls]);
    } catch (err) {
      console.error('Error processing stitching batch photo:', err);
      setBatchError('Failed to process image file.');
    }
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !selectedItem) return;

    const assigned = Number(batchForm.assigned_quantity || 0);
    const completed = Number(batchForm.completed_quantity || 0);
    const accepted = Number(batchForm.accepted_quantity || 0);
    const rejected = Number(batchForm.rejected_quantity || 0);
    const rework = Number(batchForm.rework_quantity || 0);

    if (assigned <= 0) {
      setBatchError('Assigned quantity must be greater than zero.');
      return;
    }
    if (completed <= 0) {
      setBatchError('Completed quantity must be greater than zero.');
      return;
    }
    if (accepted + rejected + rework !== completed) {
      setBatchError(`Yield reconciliation error: Accepted (${accepted}) + Rejected (${rejected}) + Rework (${rework}) must equal Completed (${completed}).`);
      return;
    }

    try {
      setSavingBatch(true);
      setBatchError('');

      await api.createStitchingBatch({
        production_order_id: order.id,
        production_order_item_id: selectedItem.id,
        product_name: selectedItem.product_name,
        product_code: selectedItem.product_code,
        size: selectedItem.size,
        color: selectedItem.color,
        assigned_quantity: assigned,
        completed_quantity: completed,
        accepted_quantity: accepted,
        rejected_quantity: rejected,
        rework_quantity: rework,
        start_date: batchForm.start_date,
        completion_date: batchForm.completion_date,
        operator_team: batchForm.operator_team,
        production_line: batchForm.production_line,
        supervisor: batchForm.supervisor,
        remarks: batchForm.remarks,
        photo_urls: photoUrls
      });

      showToast(`Stitching batch for ${selectedItem.product_name} recorded successfully.`);
      setBatchModalOpen(false);
      await fetchOrderData();
    } catch (err: any) {
      console.error('Failed to create stitching batch:', err);
      setBatchError(err?.message || 'Failed to save stitching batch.');
    } finally {
      setSavingBatch(false);
    }
  };

  // Transfer to Checking
  const handleTransferToChecking = async () => {
    if (!order) return;
    try {
      setTransferring(true);
      const checkingStage = stages.find(s => (s.code || '').toUpperCase() === 'CHK');
      if (checkingStage && checkingStage.id) {
        await api.updateProductionOrderStatus(order.id, checkingStage.id, {
          notes: `Transferred from Stage 07 Stitching to Stage 08 Checking with ${fmt(overallTotals.acceptedQty)} accepted pieces.`
        });
      }
      showToast('Successfully transferred order to Stage 08: Checking / Quality Inspection.');
      setTransferModalOpen(false);
      navigate(`/production/checking/${order.id}`);
    } catch (err: any) {
      console.error('Failed to transfer to Checking stage:', err);
      setError(err?.message || 'Failed to transfer to Checking.');
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading Stage 07 Stitching workspace...</p>
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
          <Button variant="secondary" size="sm" onClick={() => navigate('/production/stitching')}>
            Back to Stitching Stage
          </Button>
        </div>
      </div>
    );
  }

  const isStitchingComplete = overallTotals.balanceQty === 0 && overallTotals.acceptedQty > 0;

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
            onClick={() => navigate('/production/stitching')}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            title="Return to Stage 07 Board"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1">
                <Activity className="w-3 h-3 text-teal-600" />
                Stage 07: Stitching — Color-wise Tracking
              </span>
              <StatusBadge status={order.status || 'In Progress'} />
              {isStitchingComplete && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCheck className="w-3 h-3 text-emerald-600" />
                  Stitching Fully Completed
                </span>
              )}
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
            disabled={overallTotals.acceptedQty === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
          >
            <span>Pass to Checking (Stage 08)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Order Qty</div>
          <div className="text-xl sm:text-2xl font-black text-slate-800">{fmt(overallTotals.orderQty)}</div>
          <div className="text-[10px] text-slate-400 mt-1">{items.length} Products</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider mb-1">Stitched Completed</div>
          <div className="text-xl sm:text-2xl font-black text-teal-600">{fmt(overallTotals.completedQty)}</div>
          <div className="text-[10px] text-slate-400 mt-1">Batches: {batches.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">Accepted Output</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">{fmt(overallTotals.acceptedQty)}</div>
          <div className="text-[10px] text-emerald-600 mt-1 font-medium">Eligible for Quality Checking</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-red-700 uppercase tracking-wider mb-1">Stitching Rejections</div>
          <div className="text-xl sm:text-2xl font-black text-red-600">{fmt(overallTotals.rejectedQty)}</div>
          <div className="text-[10px] text-red-500 mt-1">Irreparable defects</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Under Rework</div>
          <div className="text-xl sm:text-2xl font-black text-amber-600">{fmt(overallTotals.reworkQty)}</div>
          <div className="text-[10px] text-amber-600 mt-1">Alteration in line</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 shadow-2xs">
          <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider mb-1">Pending Stitching</div>
          <div className="text-xl sm:text-2xl font-black text-indigo-700">{fmt(overallTotals.balanceQty)}</div>
          <div className="text-[10px] text-indigo-600 mt-1 font-medium">Remaining to complete</div>
        </div>
      </div>

      {/* Product-wise Tracking & Batch Entry Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Product & Color-wise Stitching Progress</h2>
          <span className="text-xs text-slate-500">Record batches per line and allocate operator teams</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {items.map(it => {
            const itBatches = batchesByItem[it.id] || [];
            const stats = summaryByItem[it.id] || {
              totalAssigned: 0,
              totalCompleted: 0,
              totalAccepted: 0,
              totalRejected: 0,
              totalRework: 0,
              balance: it.quantity
            };
            const pct = it.quantity > 0 ? Math.min(100, Math.round((stats.totalAccepted / it.quantity) * 100)) : 0;
            const isItemDone = stats.balance === 0 && stats.totalAccepted >= it.quantity;

            return (
              <div key={it.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-base text-slate-900">{it.product_name}</h3>
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-xs text-slate-600 border border-slate-200">
                        {it.product_code || 'GARMENT-REF'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-medium text-xs border border-teal-200">
                        Color: {it.color || 'Standard'}
                      </span>
                      {it.size && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-xs">
                          Size: {it.size}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-3">
                      <span>Order Qty: <strong className="text-slate-800">{fmt(it.quantity)}</strong></span>
                      <span>Stitched Accepted: <strong className="text-emerald-700">{fmt(stats.totalAccepted)}</strong></span>
                      <span>Remaining: <strong className="text-indigo-700">{fmt(stats.balance)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenBatchModal(it)}
                      className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 text-xs shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Record Stitching Batch</span>
                    </Button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                    <span>Stitching Completion Progress</span>
                    <span className="font-mono">{pct}% ({fmt(stats.totalAccepted)} / {fmt(it.quantity)} pcs)</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${isItemDone ? 'bg-emerald-500' : 'bg-teal-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Batches Table */}
                {itBatches.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <th className="px-3.5 py-2.5">Batch #</th>
                          <th className="px-3.5 py-2.5">Dates</th>
                          <th className="px-3.5 py-2.5 text-right">Assigned</th>
                          <th className="px-3.5 py-2.5 text-right">Completed</th>
                          <th className="px-3.5 py-2.5 text-right text-emerald-700">Accepted</th>
                          <th className="px-3.5 py-2.5 text-right text-red-600">Rejected</th>
                          <th className="px-3.5 py-2.5 text-right text-amber-600">Rework</th>
                          <th className="px-3.5 py-2.5">Operator & Line</th>
                          <th className="px-3.5 py-2.5 text-center">Photos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {itBatches.map(b => (
                          <tr key={b.id} className="hover:bg-slate-50/50">
                            <td className="px-3.5 py-2.5 font-bold text-teal-800">{b.batch_number}</td>
                            <td className="px-3.5 py-2.5 text-slate-500 font-sans text-[11px]">
                              {b.start_date} {b.completion_date && `→ ${b.completion_date}`}
                            </td>
                            <td className="px-3.5 py-2.5 text-right text-slate-700">{fmt(b.assigned_quantity)}</td>
                            <td className="px-3.5 py-2.5 text-right text-slate-900 font-bold">{fmt(b.completed_quantity)}</td>
                            <td className="px-3.5 py-2.5 text-right text-emerald-700 font-bold">{fmt(b.accepted_quantity)}</td>
                            <td className="px-3.5 py-2.5 text-right text-red-600 font-bold">{fmt(b.rejected_quantity)}</td>
                            <td className="px-3.5 py-2.5 text-right text-amber-600 font-bold">{fmt(b.rework_quantity)}</td>
                            <td className="px-3.5 py-2.5 font-sans text-[11px] text-slate-600">
                              <div>{b.operator_team}</div>
                              <div className="text-[10px] text-slate-400">{b.production_line}</div>
                            </td>
                            <td className="px-3.5 py-2.5 text-center">
                              {(() => {
                                const photos = parsePhotos(b.photo_urls);
                                return photos.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImage(photos[0])}
                                    className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                                    title="View photo proof"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span className="text-slate-300 font-sans text-[10px]">—</span>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                    No stitching batches recorded yet for this product line.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Record Batch Modal */}
      <Modal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title={`Record Stitching Batch — ${selectedItem?.product_name || ''}`}
        size="lg"
      >
        <form onSubmit={handleSaveBatch} className="space-y-4">
          {batchError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{batchError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Start Date" required>
              <input
                type="date"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                value={batchForm.start_date}
                onChange={e => setBatchForm({ ...batchForm, start_date: e.target.value })}
              />
            </FormField>

            <FormField label="Completion Date" required>
              <input
                type="date"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                value={batchForm.completion_date}
                onChange={e => setBatchForm({ ...batchForm, completion_date: e.target.value })}
              />
            </FormField>

            <FormField label="Operator / Sewing Team" required>
              <input
                type="text"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                value={batchForm.operator_team}
                onChange={e => setBatchForm({ ...batchForm, operator_team: e.target.value })}
              />
            </FormField>

            <FormField label="Production Line / Machine Ref" required>
              <input
                type="text"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                value={batchForm.production_line}
                onChange={e => setBatchForm({ ...batchForm, production_line: e.target.value })}
              />
            </FormField>

            <FormField label="Supervisor / Quality In-charge">
              <input
                type="text"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                value={batchForm.supervisor}
                onChange={e => setBatchForm({ ...batchForm, supervisor: e.target.value })}
              />
            </FormField>
          </div>

          {/* Quantities Reconciliation Box */}
          <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-200 space-y-3">
            <div className="text-xs font-bold text-teal-900">Yield & Quantity Reconciliation (Pieces)</div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Assigned</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full font-mono text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-bold"
                  value={batchForm.assigned_quantity}
                  onChange={e => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setBatchForm({
                      ...batchForm,
                      assigned_quantity: val,
                      completed_quantity: val,
                      accepted_quantity: val - batchForm.rejected_quantity - batchForm.rework_quantity
                    });
                  }}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-800 block mb-1">Completed</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full font-mono text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-bold text-slate-900"
                  value={batchForm.completed_quantity}
                  onChange={e => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setBatchForm({
                      ...batchForm,
                      completed_quantity: val,
                      accepted_quantity: Math.max(0, val - batchForm.rejected_quantity - batchForm.rework_quantity)
                    });
                  }}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-emerald-700 block mb-1">Accepted</label>
                <input
                  type="number"
                  min="0"
                  required
                  className="w-full font-mono text-xs px-2.5 py-1.5 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700"
                  value={batchForm.accepted_quantity}
                  onChange={e => setBatchForm({ ...batchForm, accepted_quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-red-600 block mb-1">Rejected</label>
                <input
                  type="number"
                  min="0"
                  className="w-full font-mono text-xs px-2.5 py-1.5 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 font-bold text-red-600"
                  value={batchForm.rejected_quantity}
                  onChange={e => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setBatchForm({
                      ...batchForm,
                      rejected_quantity: val,
                      accepted_quantity: Math.max(0, batchForm.completed_quantity - val - batchForm.rework_quantity)
                    });
                  }}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-amber-600 block mb-1">Rework</label>
                <input
                  type="number"
                  min="0"
                  className="w-full font-mono text-xs px-2.5 py-1.5 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-amber-600"
                  value={batchForm.rework_quantity}
                  onChange={e => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setBatchForm({
                      ...batchForm,
                      rework_quantity: val,
                      accepted_quantity: Math.max(0, batchForm.completed_quantity - batchForm.rejected_quantity - val)
                    });
                  }}
                />
              </div>
            </div>
          </div>

          <FormField label="Stitching Quality Notes & Alteration Details">
            <textarea
              rows={2}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              value={batchForm.remarks}
              onChange={e => setBatchForm({ ...batchForm, remarks: e.target.value })}
            />
          </FormField>

          {/* Photo Evidence */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Stitching Line Quality & Seam Proof Photos
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl p-3 flex items-center gap-2 text-xs text-slate-600 transition">
                <Camera className="w-4 h-4 text-teal-600" />
                <span>Upload Seam Photos</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>

              {photoUrls.map((url, idx) => (
                <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-300 group">
                  <img src={url} alt="Batch photo" className="w-full h-full object-cover" />
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
            <Button variant="secondary" size="sm" type="button" onClick={() => setBatchModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingBatch}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
            >
              {savingBatch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Save Stitching Batch</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Image Preview Modal */}
      <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title="Seam Proof Viewer" size="lg">
        {previewImage && (
          <div className="flex flex-col items-center">
            <img src={previewImage} alt="Seam Proof" className="max-h-[75vh] w-auto object-contain rounded-lg" />
          </div>
        )}
      </Modal>

      {/* Stage Transfer Modal */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer Order to Stage 08: Checking"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            You are about to transfer <strong>{fmt(overallTotals.acceptedQty)} accepted stitched pieces</strong> from Stage 07 (Stitching) to Stage 08 (Checking / Quality Inspection).
          </p>

          {overallTotals.balanceQty > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Notice:</strong> {fmt(overallTotals.balanceQty)} pieces are still pending stitching. This will proceed as an authorized partial transfer.
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
              onClick={handleTransferToChecking}
              disabled={transferring}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {transferring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Confirm Transfer to Checking</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
