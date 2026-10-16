// src/pages/production/EmbroideryOrderDetail.tsx
// Stage 06: Embroidery — Dedicated Outward / Inward Job Work Module with Vendor Tracking & Proof
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, EmbroideryJobOrder, EmbroideryReceipt } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import {
  ArrowLeft,
  Sparkles,
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
  Truck,
  Trash2,
  ZoomIn,
  Eye,
  FileText,
  Clock,
  ShieldCheck,
  Send,
  Download
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

export default function EmbroideryOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [jobOrders, setJobOrders] = useState<EmbroideryJobOrder[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Outward Job Order Modal
  const [outwardModalOpen, setOutwardModalOpen] = useState(false);
  const [outwardForm, setOutwardForm] = useState({
    vendor_name: 'Sri Krishna Embroidery Works (Vendor ID: V-04)',
    job_order_date: new Date().toISOString().split('T')[0],
    dispatch_date: new Date().toISOString().split('T')[0],
    expected_return_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    delivery_challan_no: `DC-EMB-${Math.floor(1000 + Math.random() * 9000)}`,
    transport_courier: 'Dedicated Factory Van (TN-38-BZ-4412)',
    sent_by: 'M. Ramesh (Production Dispatch)',
    notes: 'Premium 12-head multi-needle embroidery with Madeira polyester threads. Strict quality check upon inward.'
  });
  const [outwardItems, setOutwardItems] = useState<{ [itemId: number]: number }>({});
  const [outwardPhotos, setOutwardPhotos] = useState<string[]>([]);
  const [savingOutward, setSavingOutward] = useState(false);
  const [outwardError, setOutwardError] = useState('');

  // Inward Receipt Modal
  const [inwardModalOpen, setInwardModalOpen] = useState(false);
  const [selectedJobOrder, setSelectedJobOrder] = useState<EmbroideryJobOrder | null>(null);
  const [inwardForm, setInwardForm] = useState({
    receipt_date: new Date().toISOString().split('T')[0],
    vendor_challan_no: '',
    received_by: 'K. Balan (QC & Store Supervisor)',
    remarks: 'Thread tension and stitch density verified against approved strike-off sample.'
  });
  const [inwardItemQuantities, setInwardItemQuantities] = useState<{
    [itemId: number]: { received: number; accepted: number; rejected: number; rework: number }
  }>({});
  const [inwardPhotos, setInwardPhotos] = useState<string[]>([]);
  const [savingInward, setSavingInward] = useState(false);
  const [inwardError, setInwardError] = useState('');

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
      const [orderRes, stagesRes, embRes] = await Promise.all([
        api.getProductionOrder(Number(id)),
        api.getProductionStages(),
        api.getEmbroideryJobOrders(Number(id))
      ]);

      const ord = (orderRes as any)?.data || orderRes;
      setOrder(ord);
      setItems(ord.items || []);

      const st = (stagesRes as any)?.data || stagesRes;
      setStages(Array.isArray(st) ? st : []);

      const jobs = (embRes as any)?.data || embRes;
      setJobOrders(Array.isArray(jobs) ? jobs : []);
    } catch (err: any) {
      console.error('Failed to load embroidery stage data:', err);
      setError(err?.message || 'Failed to load embroidery stage data.');
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

  // Compute product-wise summary
  const summaryByItem = useMemo(() => {
    const map: Record<number, {
      totalSent: number;
      totalAccepted: number;
      totalRejected: number;
      totalRework: number;
      totalOutstanding: number;
    }> = {};

    items.forEach(it => {
      map[it.id] = { totalSent: 0, totalAccepted: 0, totalRejected: 0, totalRework: 0, totalOutstanding: 0 };
    });

    jobOrders.forEach(job => {
      (job.items || []).forEach(jItem => {
        const itId = jItem.production_order_item_id;
        if (!map[itId]) {
          map[itId] = { totalSent: 0, totalAccepted: 0, totalRejected: 0, totalRework: 0, totalOutstanding: 0 };
        }
        map[itId].totalSent += Number(jItem.quantity_sent || 0);
        map[itId].totalAccepted += Number(jItem.quantity_accepted || 0);
        map[itId].totalRejected += Number(jItem.quantity_rejected || 0);
        map[itId].totalRework += Number(jItem.quantity_rework || 0);
        map[itId].totalOutstanding += Number(jItem.quantity_outstanding || 0);
      });
    });

    return map;
  }, [items, jobOrders]);

  // Overall Totals
  const overallTotals = useMemo(() => {
    let orderQty = 0;
    let sentQty = 0;
    let acceptedQty = 0;
    let rejectedQty = 0;
    let reworkQty = 0;
    let outstandingQty = 0;

    items.forEach(it => {
      orderQty += Number(it.quantity || 0);
      const s = summaryByItem[it.id];
      if (s) {
        sentQty += s.totalSent;
        acceptedQty += s.totalAccepted;
        rejectedQty += s.totalRejected;
        reworkQty += s.totalRework;
        outstandingQty += s.totalOutstanding;
      }
    });

    return { orderQty, sentQty, acceptedQty, rejectedQty, reworkQty, outstandingQty };
  }, [items, summaryByItem]);

  // Open Outward Modal
  const handleOpenOutwardModal = () => {
    const initItems: { [itemId: number]: number } = {};
    items.forEach(it => {
      const stats = summaryByItem[it.id] || { totalSent: 0, totalAccepted: 0, totalOutstanding: 0 };
      const pendingOutward = Math.max(0, Number(it.quantity || 0) - stats.totalSent);
      initItems[it.id] = pendingOutward;
    });
    setOutwardItems(initItems);
    setOutwardPhotos([]);
    setOutwardError('');
    setOutwardModalOpen(true);
  };

  const handleOutwardPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const base64 = await processImageFile(files[i]);
        newUrls.push(base64);
      }
      setOutwardPhotos(prev => [...prev, ...newUrls]);
    } catch (err) {
      console.error('Error processing outward challan image:', err);
      setOutwardError('Failed to process image file.');
    }
  };

  const handleSaveOutward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    const itemsToSend = items
      .filter(it => (outwardItems[it.id] || 0) > 0)
      .map(it => ({
        production_order_item_id: it.id,
        product_name: it.product_name,
        product_code: it.product_code,
        size: it.size,
        color: it.color,
        quantity_sent: outwardItems[it.id],
        unit_of_measure: 'PCS',
        design_reference: it.product_code ? `EMB-${it.product_code}` : 'Standard Embroidery'
      }));

    if (itemsToSend.length === 0) {
      setOutwardError('Please specify quantity sent for at least one product.');
      return;
    }

    try {
      setSavingOutward(true);
      setOutwardError('');

      await api.createEmbroideryJobOrder({
        production_order_id: order.id,
        production_order_number: order.order_number,
        vendor_name: outwardForm.vendor_name,
        job_order_date: outwardForm.job_order_date,
        dispatch_date: outwardForm.dispatch_date,
        expected_return_date: outwardForm.expected_return_date,
        delivery_challan_no: outwardForm.delivery_challan_no,
        transport_courier: outwardForm.transport_courier,
        sent_by: outwardForm.sent_by,
        notes: outwardForm.notes,
        attachments: outwardPhotos,
        items: itemsToSend
      });

      showToast(`Outward job order with Delivery Challan #${outwardForm.delivery_challan_no} created successfully.`);
      setOutwardModalOpen(false);
      await fetchOrderData();
    } catch (err: any) {
      console.error('Failed to create outward job order:', err);
      setOutwardError(err?.message || 'Failed to create outward job order.');
    } finally {
      setSavingOutward(false);
    }
  };

  // Open Inward Modal
  const handleOpenInwardModal = (job: EmbroideryJobOrder) => {
    setSelectedJobOrder(job);
    setInwardForm({
      receipt_date: new Date().toISOString().split('T')[0],
      vendor_challan_no: `VR-${Math.floor(1000 + Math.random() * 9000)}`,
      received_by: 'K. Balan (QC & Store Supervisor)',
      remarks: 'Verified stitch density, thread trims, and pattern registration against approved spec.'
    });

    const initQuantities: any = {};
    (job.items || []).forEach(jItem => {
      const remaining = Number(jItem.quantity_outstanding || 0);
      initQuantities[jItem.production_order_item_id] = {
        received: remaining,
        accepted: remaining,
        rejected: 0,
        rework: 0
      };
    });
    setInwardItemQuantities(initQuantities);
    setInwardPhotos([]);
    setInwardError('');
    setInwardModalOpen(true);
  };

  const handleInwardPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const base64 = await processImageFile(files[i]);
        newUrls.push(base64);
      }
      setInwardPhotos(prev => [...prev, ...newUrls]);
    } catch (err) {
      console.error('Error processing inward receipt image:', err);
      setInwardError('Failed to process image file.');
    }
  };

  const handleSaveInward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !selectedJobOrder || !selectedJobOrder.id) return;

    const receiptItems: any[] = [];
    let hasValidQuantities = false;

    for (const jItem of selectedJobOrder.items || []) {
      const itId = jItem.production_order_item_id;
      const q = inwardItemQuantities[itId] || { received: 0, accepted: 0, rejected: 0, rework: 0 };
      const received = Number(q.received || 0);
      const accepted = Number(q.accepted || 0);
      const rejected = Number(q.rejected || 0);
      const rework = Number(q.rework || 0);

      if (received > 0) {
        hasValidQuantities = true;
        if (accepted + rejected + rework !== received) {
          setInwardError(`For "${jItem.product_name}", Accepted (${accepted}) + Rejected (${rejected}) + Rework (${rework}) must exactly equal Received (${received}).`);
          return;
        }

        const maxAllowed = Number(jItem.quantity_outstanding || 0);
        if (received > maxAllowed) {
          setInwardError(`Received quantity (${received}) for "${jItem.product_name}" exceeds outstanding quantity (${maxAllowed}).`);
          return;
        }

        receiptItems.push({
          production_order_item_id: itId,
          product_name: jItem.product_name,
          color: jItem.color || '',
          received_quantity: received,
          accepted_quantity: accepted,
          rejected_quantity: rejected,
          rework_quantity: rework
        });
      }
    }

    if (!hasValidQuantities) {
      setInwardError('Please enter received quantity for at least one product item.');
      return;
    }

    try {
      setSavingInward(true);
      setInwardError('');

      await api.createEmbroideryReceipt({
        job_order_id: selectedJobOrder.id,
        production_order_id: order.id,
        vendor_name: selectedJobOrder.vendor_name,
        receipt_date: inwardForm.receipt_date,
        vendor_challan_no: inwardForm.vendor_challan_no,
        received_by: inwardForm.received_by,
        remarks: inwardForm.remarks,
        photo_urls: inwardPhotos,
        items_data: receiptItems
      });

      showToast(`Inward receipt against ${selectedJobOrder.job_order_number} recorded successfully.`);
      setInwardModalOpen(false);
      await fetchOrderData();
    } catch (err: any) {
      console.error('Failed to record inward receipt:', err);
      setInwardError(err?.message || 'Failed to record inward receipt.');
    } finally {
      setSavingInward(false);
    }
  };

  // Transfer to Stitching
  const handleTransferToStitching = async () => {
    if (!order) return;
    try {
      setTransferring(true);
      const stitchingStage = stages.find(s => (s.code || '').toUpperCase() === 'STI');
      if (stitchingStage && stitchingStage.id) {
        await api.updateProductionOrderStatus(order.id, stitchingStage.id, {
          notes: `Transferred from Stage 06 Embroidery to Stage 07 Stitching with ${fmt(overallTotals.acceptedQty)} accepted pieces.`
        });
      }
      showToast('Successfully transferred order to Stage 07: Stitching — Color-wise Tracking.');
      setTransferModalOpen(false);
      navigate(`/production/stitching/${order.id}`);
    } catch (err: any) {
      console.error('Failed to transfer to Stitching stage:', err);
      setError(err?.message || 'Failed to transfer to Stitching.');
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading Stage 06 Embroidery workspace...</p>
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
          <Button variant="secondary" size="sm" onClick={() => navigate('/production/embroidery')}>
            Back to Embroidery Stage
          </Button>
        </div>
      </div>
    );
  }

  const isFullyReconciled = overallTotals.outstandingQty === 0 && overallTotals.sentQty > 0;

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
            onClick={() => navigate('/production/embroidery')}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            title="Return to Stage 06 Board"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-pink-100 text-pink-800 border border-pink-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-pink-600" />
                Stage 06: Embroidery Outward / Inward
              </span>
              <StatusBadge status={order.status || 'In Progress'} />
              {isFullyReconciled && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  All Vendor Goods Accounted For
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
            onClick={handleOpenOutwardModal}
            className="bg-pink-600 hover:bg-pink-700 text-white gap-1.5 shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Issue Outward Job Order</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setTransferModalOpen(true)}
            disabled={overallTotals.acceptedQty === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
          >
            <span>Pass to Stitching (Stage 07)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Order Qty</div>
          <div className="text-xl sm:text-2xl font-black text-slate-800">{fmt(overallTotals.orderQty)}</div>
          <div className="text-[10px] text-slate-400 mt-1">Order Lines: {items.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-pink-700 uppercase tracking-wider mb-1">Sent to Vendor</div>
          <div className="text-xl sm:text-2xl font-black text-pink-600">{fmt(overallTotals.sentQty)}</div>
          <div className="text-[10px] text-slate-400 mt-1">Outward Challans: {jobOrders.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">Accepted Inward</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">{fmt(overallTotals.acceptedQty)}</div>
          <div className="text-[10px] text-emerald-600 mt-1 font-medium">Ready for Stitching</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-red-700 uppercase tracking-wider mb-1">Rejected at Inward</div>
          <div className="text-xl sm:text-2xl font-black text-red-600">{fmt(overallTotals.rejectedQty)}</div>
          <div className="text-[10px] text-red-500 mt-1">Unrecoverable defect</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Under Rework</div>
          <div className="text-xl sm:text-2xl font-black text-amber-600">{fmt(overallTotals.reworkQty)}</div>
          <div className="text-[10px] text-amber-600 mt-1">To be corrected</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 shadow-2xs">
          <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider mb-1">Vendor Outstanding</div>
          <div className="text-xl sm:text-2xl font-black text-indigo-700">{fmt(overallTotals.outstandingQty)}</div>
          <div className="text-[10px] text-indigo-600 mt-1 font-medium">Pending return from vendor</div>
        </div>
      </div>

      {/* Product-wise Tracking Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-800">Product-wise Embroidery Tracking</h2>
            <p className="text-xs text-slate-500">Every product line is tracked through outward dispatch, inward receipts, rejections, and stage release.</p>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
            {items.length} Products
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th className="px-4 py-3">Product Name & SKU</th>
                <th className="px-4 py-3">Color / Size</th>
                <th className="px-4 py-3 text-right">Order Qty</th>
                <th className="px-4 py-3 text-right text-pink-700">Sent to Vendor</th>
                <th className="px-4 py-3 text-right text-emerald-700">Accepted Inward</th>
                <th className="px-4 py-3 text-right text-red-700">Rejected</th>
                <th className="px-4 py-3 text-right text-amber-700">Rework</th>
                <th className="px-4 py-3 text-right text-indigo-700">Outstanding</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(it => {
                const s = summaryByItem[it.id] || { totalSent: 0, totalAccepted: 0, totalRejected: 0, totalRework: 0, totalOutstanding: 0 };
                const pct = it.quantity > 0 ? Math.round((s.totalAccepted / it.quantity) * 100) : 0;
                return (
                  <tr key={it.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-800">{it.product_name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{it.product_code || 'GARMENT-REF'}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {it.color || 'Standard'}
                        </span>
                        {it.size && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[10px]">
                            {it.size}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-700">{fmt(it.quantity)}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-pink-600">{fmt(s.totalSent)}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600">{fmt(s.totalAccepted)}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-red-600">{fmt(s.totalRejected)}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-amber-600">{fmt(s.totalRework)}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-indigo-700">{fmt(s.totalOutstanding)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.totalAccepted >= it.quantity
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.totalSent > 0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {s.totalAccepted >= it.quantity ? 'Completed' : s.totalSent > 0 ? `${pct}% Returned` : 'Not Dispatched'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outward Job Orders & Inward Receipts History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">Job Orders & Inward Proof Ledger</h2>
            <p className="text-xs text-slate-500">External vendor outward challans, signed handovers, and inward quality receipt histories.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenOutwardModal}
            className="text-pink-700 hover:text-pink-800 border-pink-200 hover:bg-pink-50 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Outward Challan</span>
          </Button>
        </div>

        {jobOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700 mb-1">No Outward Job Orders Issued Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              Create an outward job order to dispatch cut pieces to external embroidery vendors with delivery challan and handover evidence.
            </p>
            <Button variant="primary" size="sm" onClick={handleOpenOutwardModal} className="bg-pink-600 hover:bg-pink-700 text-white">
              Create First Outward Job Order
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {jobOrders.map(job => {
              const receipts = job.receipts || [];
              const isJobComplete = Number(job.total_quantity_outstanding || 0) === 0;

              return (
                <div key={job.id} className="p-5 space-y-4 hover:bg-slate-50/40 transition">
                  {/* Job Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono font-bold text-sm text-pink-700">{job.job_order_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isJobComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-pink-100 text-pink-800'
                        }`}>
                          {job.status || (isJobComplete ? 'Received' : 'Sent to Vendor')}
                        </span>
                        {job.delivery_challan_no && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-600 border border-slate-200">
                            Challan: {job.delivery_challan_no}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-800">{job.vendor_name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5 flex-wrap">
                        <span>Dispatched: {job.dispatch_date}</span>
                        {job.expected_return_date && <span>Due Back: {job.expected_return_date}</span>}
                        {job.transport_courier && <span>Transport: {job.transport_courier}</span>}
                        {job.sent_by && <span>Sent by: {job.sent_by}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenInwardModal(job)}
                        disabled={isJobComplete}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 gap-1.5 text-xs"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Record Inward</span>
                      </Button>
                    </div>
                  </div>

                  {/* Quantities breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 font-sans block">Sent Qty</span>
                      <span className="font-bold text-slate-800">{fmt(job.total_quantity_sent)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-600 font-sans block">Accepted</span>
                      <span className="font-bold text-emerald-700">{fmt(job.total_quantity_accepted)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-red-600 font-sans block">Rejected</span>
                      <span className="font-bold text-red-600">{fmt(job.total_quantity_rejected)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-600 font-sans block">Rework</span>
                      <span className="font-bold text-amber-600">{fmt(job.total_quantity_rework)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-600 font-sans block">Outstanding</span>
                      <span className="font-bold text-indigo-700">{fmt(job.total_quantity_outstanding)}</span>
                    </div>
                  </div>

                  {/* Outward Challan Proofs */}
                  {job.attachments && job.attachments.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>Outward Challan & Handover Proof ({job.attachments.length} photos)</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {job.attachments.map((url, idx) => (
                          <div
                            key={idx}
                            onClick={() => setPreviewImage(url)}
                            className="relative group w-14 h-14 rounded-lg overflow-hidden border border-slate-200 cursor-pointer shadow-2xs hover:scale-105 transition"
                          >
                            <img src={url} alt={`Challan ${idx + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <ZoomIn className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inward Receipts List */}
                  {receipts.length > 0 && (
                    <div className="pl-3 border-l-2 border-emerald-400 space-y-2 mt-2">
                      <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                        Inward Receipts Against Job Order ({receipts.length})
                      </div>
                      <div className="space-y-2">
                        {receipts.map(rcpt => (
                          <div key={rcpt.id} className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs">
                            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-emerald-800">{rcpt.receipt_number}</span>
                                <span className="text-slate-500">Date: {rcpt.receipt_date}</span>
                                {rcpt.vendor_challan_no && (
                                  <span className="font-mono text-slate-600">Vendor Ref: {rcpt.vendor_challan_no}</span>
                                )}
                              </div>
                              <span className="text-slate-500">Received by: {rcpt.received_by || 'Store Head'}</span>
                            </div>

                            <div className="grid grid-cols-4 gap-2 font-mono text-[11px] my-1.5">
                              <div>Recv: <strong className="text-slate-800">{fmt(rcpt.total_received_qty)}</strong></div>
                              <div>Acc: <strong className="text-emerald-700">{fmt(rcpt.total_accepted_qty)}</strong></div>
                              <div>Rej: <strong className="text-red-700">{fmt(rcpt.total_rejected_qty)}</strong></div>
                              <div>Rew: <strong className="text-amber-700">{fmt(rcpt.total_rework_qty)}</strong></div>
                            </div>

                            {rcpt.remarks && (
                              <div className="text-[11px] text-slate-600 italic">Notes: {rcpt.remarks}</div>
                            )}

                            {rcpt.photo_urls && rcpt.photo_urls.length > 0 && (
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {rcpt.photo_urls.map((photo, pIdx) => (
                                  <div
                                    key={pIdx}
                                    onClick={() => setPreviewImage(photo)}
                                    className="w-12 h-12 rounded-lg overflow-hidden border border-emerald-200 cursor-pointer hover:scale-105 transition"
                                  >
                                    <img src={photo} alt="Inward proof" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Outward Job Order Modal */}
      <Modal
        isOpen={outwardModalOpen}
        onClose={() => setOutwardModalOpen(false)}
        title="Create Embroidery Outward Job Order"
        size="lg"
      >
        <form onSubmit={handleSaveOutward} className="space-y-4">
          {outwardError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{outwardError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Vendor / Job Worker Name" required>
              <input
                type="text"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                value={outwardForm.vendor_name}
                onChange={e => setOutwardForm({ ...outwardForm, vendor_name: e.target.value })}
              />
            </FormField>

            <FormField label="Delivery Challan No." required>
              <input
                type="text"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-pink-500"
                value={outwardForm.delivery_challan_no}
                onChange={e => setOutwardForm({ ...outwardForm, delivery_challan_no: e.target.value })}
              />
            </FormField>

            <FormField label="Job Order Date" required>
              <input
                type="date"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                value={outwardForm.job_order_date}
                onChange={e => setOutwardForm({ ...outwardForm, job_order_date: e.target.value })}
              />
            </FormField>

            <FormField label="Expected Return Date">
              <input
                type="date"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                value={outwardForm.expected_return_date}
                onChange={e => setOutwardForm({ ...outwardForm, expected_return_date: e.target.value })}
              />
            </FormField>

            <FormField label="Transport / Vehicle / Courier">
              <input
                type="text"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                value={outwardForm.transport_courier}
                onChange={e => setOutwardForm({ ...outwardForm, transport_courier: e.target.value })}
              />
            </FormField>

            <FormField label="Dispatched By (Employee)">
              <input
                type="text"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                value={outwardForm.sent_by}
                onChange={e => setOutwardForm({ ...outwardForm, sent_by: e.target.value })}
              />
            </FormField>
          </div>

          {/* Product Items Quantities */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
            <div className="text-xs font-bold text-slate-700">Dispatch Quantities by Product</div>
            <div className="divide-y divide-slate-200">
              {items.map(it => {
                const s = summaryByItem[it.id] || { totalSent: 0 };
                const maxEligible = it.quantity;
                return (
                  <div key={it.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-slate-800">{it.product_name} ({it.color})</div>
                      <div className="text-[11px] text-slate-500">Order Qty: {fmt(it.quantity)} | Already Sent: {fmt(s.totalSent)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Qty Sent:</span>
                      <input
                        type="number"
                        min="0"
                        max={maxEligible}
                        className="w-24 text-xs font-mono font-bold px-2 py-1.5 border border-slate-300 rounded-lg text-right focus:ring-2 focus:ring-pink-500"
                        value={outwardItems[it.id] || 0}
                        onChange={e => setOutwardItems({
                          ...outwardItems,
                          [it.id]: Math.max(0, parseInt(e.target.value) || 0)
                        })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <FormField label="Instructions & Design Notes">
            <textarea
              rows={2}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              value={outwardForm.notes}
              onChange={e => setOutwardForm({ ...outwardForm, notes: e.target.value })}
            />
          </FormField>

          {/* Outward Photo Evidence */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Outward Challan & Signed Handover Document Photos
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-pink-500 rounded-xl p-3 flex items-center gap-2 text-xs text-slate-600 transition">
                <Camera className="w-4 h-4 text-pink-600" />
                <span>Upload Challan Photo</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleOutwardPhotoUpload} />
              </label>

              {outwardPhotos.map((url, idx) => (
                <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-300 group">
                  <img src={url} alt="Outward photo" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setOutwardPhotos(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-0.5 right-0.5 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" size="sm" type="button" onClick={() => setOutwardModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingOutward}
              className="bg-pink-600 hover:bg-pink-700 text-white gap-1.5"
            >
              {savingOutward ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Confirm & Dispatch Outward</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Inward Receipt Modal */}
      <Modal
        isOpen={inwardModalOpen}
        onClose={() => setInwardModalOpen(false)}
        title={`Record Inward Receipt — ${selectedJobOrder?.job_order_number || ''}`}
        size="lg"
      >
        <form onSubmit={handleSaveInward} className="space-y-4">
          {inwardError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{inwardError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Inward Date" required>
              <input
                type="date"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                value={inwardForm.receipt_date}
                onChange={e => setInwardForm({ ...inwardForm, receipt_date: e.target.value })}
              />
            </FormField>

            <FormField label="Vendor Challan / Inv. Ref" required>
              <input
                type="text"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                value={inwardForm.vendor_challan_no}
                onChange={e => setInwardForm({ ...inwardForm, vendor_challan_no: e.target.value })}
              />
            </FormField>

            <FormField label="Received & Inspected By" required>
              <input
                type="text"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                value={inwardForm.received_by}
                onChange={e => setInwardForm({ ...inwardForm, received_by: e.target.value })}
              />
            </FormField>
          </div>

          {/* Product Quantities Breakdown */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3">
            <div className="text-xs font-bold text-slate-800">Inward Quantities Breakdown</div>
            <div className="space-y-3">
              {(selectedJobOrder?.items || []).map(jItem => {
                const itId = jItem.production_order_item_id;
                const q = inwardItemQuantities[itId] || { received: 0, accepted: 0, rejected: 0, rework: 0 };
                const outstanding = Number(jItem.quantity_outstanding || 0);

                return (
                  <div key={itId} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{jItem.product_name}</span>
                        <span className="text-slate-500 ml-1">({jItem.color || 'Standard'})</span>
                      </div>
                      <div className="font-mono text-indigo-700 font-bold">
                        Outstanding: {fmt(outstanding)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-1">Received</label>
                        <input
                          type="number"
                          min="0"
                          max={outstanding}
                          className="w-full font-mono text-xs px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 font-bold text-slate-800"
                          value={q.received}
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setInwardItemQuantities({
                              ...inwardItemQuantities,
                              [itId]: {
                                ...q,
                                received: val,
                                accepted: val - (q.rejected || 0) - (q.rework || 0)
                              }
                            });
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-emerald-700 block mb-1">Accepted</label>
                        <input
                          type="number"
                          min="0"
                          className="w-full font-mono text-xs px-2 py-1.5 border border-emerald-300 rounded-md focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-700"
                          value={q.accepted}
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setInwardItemQuantities({
                              ...inwardItemQuantities,
                              [itId]: { ...q, accepted: val }
                            });
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-red-600 block mb-1">Rejected</label>
                        <input
                          type="number"
                          min="0"
                          className="w-full font-mono text-xs px-2 py-1.5 border border-red-300 rounded-md focus:ring-1 focus:ring-red-500 font-bold text-red-600"
                          value={q.rejected}
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setInwardItemQuantities({
                              ...inwardItemQuantities,
                              [itId]: { ...q, rejected: val, accepted: Math.max(0, q.received - val - (q.rework || 0)) }
                            });
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-amber-600 block mb-1">Rework</label>
                        <input
                          type="number"
                          min="0"
                          className="w-full font-mono text-xs px-2 py-1.5 border border-amber-300 rounded-md focus:ring-1 focus:ring-amber-500 font-bold text-amber-600"
                          value={q.rework}
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setInwardItemQuantities({
                              ...inwardItemQuantities,
                              [itId]: { ...q, rework: val, accepted: Math.max(0, q.received - (q.rejected || 0) - val) }
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <FormField label="Quality Check & Inspection Remarks">
            <textarea
              rows={2}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              value={inwardForm.remarks}
              onChange={e => setInwardForm({ ...inwardForm, remarks: e.target.value })}
            />
          </FormField>

          {/* Inward Proof Photos */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Inward Inspection & Signed Vendor Challan Photos
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-3 flex items-center gap-2 text-xs text-slate-600 transition">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Upload Inward Proof</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleInwardPhotoUpload} />
              </label>

              {inwardPhotos.map((url, idx) => (
                <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-300 group">
                  <img src={url} alt="Inward photo" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setInwardPhotos(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-0.5 right-0.5 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" size="sm" type="button" onClick={() => setInwardModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingInward}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {savingInward ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Save & Reconcile Inward</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Image Preview Modal */}
      <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title="Proof Document Viewer" size="lg">
        {previewImage && (
          <div className="flex flex-col items-center">
            <img src={previewImage} alt="Proof" className="max-h-[75vh] w-auto object-contain rounded-lg" />
          </div>
        )}
      </Modal>

      {/* Stage Transfer Modal */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer Order to Stage 07: Stitching"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            You are about to transfer <strong>{fmt(overallTotals.acceptedQty)} accepted pieces</strong> from Stage 06 (Embroidery) to Stage 07 (Stitching — Color-wise Tracking).
          </p>

          {overallTotals.outstandingQty > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Notice:</strong> {fmt(overallTotals.outstandingQty)} pieces are still outstanding with the embroidery vendor. This will proceed as an authorized partial transfer.
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
              onClick={handleTransferToStitching}
              disabled={transferring}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {transferring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Confirm Transfer to Stitching</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
