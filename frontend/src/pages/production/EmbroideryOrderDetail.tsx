// src/pages/production/EmbroideryOrderDetail.tsx
// Stage 06: Embroidery — Dedicated Outward / Inward Job Work Module with Vendor Tracking & Proof
// Redesigned to strict Cheran Soft Goods ERP design system: Table-based layout, ERP palette,
// proper item tracking from Cutting arrival to Outward Dispatch, Inward QC, and Transfer to Stitching.
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, EmbroideryJobOrder, EmbroideryReceipt } from '../../types';
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
  Truck,
  Trash2,
  ZoomIn,
  Eye,
  FileText,
  ShieldCheck,
  Send,
  Boxes,
  Package,
  X,
  Upload,
  Clock,
  ArrowDownCircle,
  Scissors
} from 'lucide-react';

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

export default function EmbroideryOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [jobOrders, setJobOrders] = useState<EmbroideryJobOrder[]>([]);
  const [receipts, setReceipts] = useState<EmbroideryReceipt[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter tabs: 'ALL' | 'EMBROIDERY'
  const [activeTab, setActiveTab] = useState<'ALL' | 'EMBROIDERY'>('ALL');

  // Outward Job Order Modal
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
  const [outwardItems, setOutwardItems] = useState<{ [key: string]: number }>({});
  const [outwardPhotos, setOutwardPhotos] = useState<string[]>([]);
  const [savingOutward, setSavingOutward] = useState(false);
  const [outwardError, setOutwardError] = useState('');

  // Inward Receipt Modal
  const [inwardModalOpen, setInwardModalOpen] = useState(false);
  const [selectedJobOrder, setSelectedJobOrder] = useState<any | null>(null);
  const [inwardForm, setInwardForm] = useState({
    receipt_date: new Date().toISOString().split('T')[0],
    vendor_challan_no: '',
    received_by: 'K. Balan (QC & Store Supervisor)',
    remarks: 'Thread tension and stitch density verified against approved strike-off sample.'
  });
  const [inwardItemQuantities, setInwardItemQuantities] = useState<{
    [key: string]: { received: number; accepted: number; rejected: number; rework: number }
  }>({});
  const [inwardPhotos, setInwardPhotos] = useState<string[]>([]);
  const [savingInward, setSavingInward] = useState(false);
  const [inwardError, setInwardError] = useState('');

  // Stage Transfer to Stitching Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferItem, setTransferItem] = useState<any | null>(null);
  const [transferQuantity, setTransferQuantity] = useState<number>(0);
  const [transferRemarks, setTransferRemarks] = useState('Completed embroidery passed QC, transferred to Stitching unit.');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [embroideryUnits, setEmbroideryUnits] = useState<any[]>([]);

  const fetchOrderData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const [embRes, stagesRes, unitsRes] = await Promise.all([
        api.getEmbroideryOrderDetails(Number(id)),
        api.getProductionStages(),
        api.getEmbroideryWorks().catch(() => [])
      ]);

      const embData = (embRes as any)?.data || embRes;
      setOrder(embData.order || null);
      setItems(embData.items || []);
      setJobOrders(embData.job_orders || []);
      setReceipts(embData.receipts || []);

      const st = (stagesRes as any)?.data || stagesRes;
      setStages(Array.isArray(st) ? st : []);

      const units = Array.isArray((unitsRes as any)?.data)
        ? (unitsRes as any).data
        : (Array.isArray(unitsRes) ? unitsRes : []);
      setEmbroideryUnits(units);
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

  // KPI Overall Totals
  const overallTotals = useMemo(() => {
    let orderQty = 0;
    let arrivedQty = 0;
    let sentQty = 0;
    let acceptedQty = 0;
    let rejectedQty = 0;
    let reworkQty = 0;
    let outstandingQty = 0;
    let readyForStitching = 0;

    items.forEach(it => {
      orderQty += Number(it.order_quantity || it.total_quantity || 0);
      arrivedQty += Number(it.arrived_from_cutting || 0);
      sentQty += Number(it.sent_to_vendor || 0);
      acceptedQty += Number(it.accepted_inward || 0);
      rejectedQty += Number(it.rejected_quantity || 0);
      reworkQty += Number(it.rework_quantity || 0);
      outstandingQty += Number(it.outstanding_quantity || 0);
      readyForStitching += Number(it.ready_to_transfer || 0);
    });

    return {
      orderQty,
      arrivedQty,
      sentQty,
      acceptedQty,
      rejectedQty,
      reworkQty,
      outstandingQty,
      readyForStitching
    };
  }, [items]);

  // Open Outward Modal for a specific item (or globally)
  const handleOpenOutwardModal = (specificItem?: any) => {
    const initItems: { [key: string]: number } = {};
    if (specificItem) {
      const avail = Number(specificItem.available_to_dispatch || 0);
      initItems[specificItem.id || specificItem.active_embroidery_item_id] = avail;
    } else {
      items.forEach(it => {
        const avail = Number(it.available_to_dispatch || 0);
        if (avail > 0) {
          initItems[it.id || it.active_embroidery_item_id] = avail;
        }
      });
    }
    setOutwardItems(initItems);
    setOutwardPhotos([]);
    setOutwardError('');
    setOutwardForm(prev => ({
      ...prev,
      delivery_challan_no: `DC-EMB-${Math.floor(1000 + Math.random() * 9000)}`
    }));
    setOutwardModalOpen(true);
  };

  const handleOutwardPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await processImageFile(files[i]);
        newUrls.push(url);
      }
      setOutwardPhotos(prev => [...prev, ...newUrls]);
    } catch (err: any) {
      setOutwardError('Failed to process image: ' + err.message);
    }
  };

  // Submit Outward Job Order
  const handleCreateOutward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    const itemsToDispatch: any[] = [];
    Object.entries(outwardItems).forEach(([idStr, qty]) => {
      const q = Number(qty);
      if (q > 0) {
        const it = items.find(i => String(i.id) === idStr || String(i.active_embroidery_item_id) === idStr);
        itemsToDispatch.push({
          production_order_item_id: it?.active_embroidery_item_id || it?.id || Number(idStr),
          product_id: it?.product_id,
          product_name: it?.product_name,
          color: it?.color,
          size: it?.size,
          quantity_sent: q
        });
      }
    });

    if (itemsToDispatch.length === 0) {
      setOutwardError('Please specify a positive quantity to dispatch for at least one item.');
      return;
    }

    try {
      setSavingOutward(true);
      setOutwardError('');
      const res: any = await api.createEmbroideryJobOrder({
        production_order_id: order.id,
        vendor_name: outwardForm.vendor_name,
        job_order_date: outwardForm.job_order_date,
        dispatch_date: outwardForm.dispatch_date,
        expected_return_date: outwardForm.expected_return_date,
        delivery_challan_no: outwardForm.delivery_challan_no,
        transport_courier: outwardForm.transport_courier,
        sent_by: outwardForm.sent_by,
        notes: outwardForm.notes,
        attachments: outwardPhotos,
        items: itemsToDispatch
      });

      setOutwardModalOpen(false);
      showToast(`Outward Job Order ${res?.job_order_number || ''} created successfully!`);
      await fetchOrderData();
    } catch (err: any) {
      setOutwardError(err.message || 'Failed to create outward job order.');
    } finally {
      setSavingOutward(false);
    }
  };

  // Open Inward Receipt Modal for a Job Order
  const handleOpenInwardModal = (job: any) => {
    setSelectedJobOrder(job);
    const jItems = Array.isArray(job.items_json) ? job.items_json : [];
    const initQty: { [key: string]: { received: number; accepted: number; rejected: number; rework: number } } = {};

    jItems.forEach((ji: any, idx: number) => {
      const key = String(ji.production_order_item_id || idx);
      const sent = Number(ji.quantity_sent || 0);
      const rec = Number(ji.received_quantity || 0);
      const pending = Math.max(0, sent - rec);
      initQty[key] = {
        received: pending,
        accepted: pending,
        rejected: 0,
        rework: 0
      };
    });

    // Fallback if items_json was empty
    if (jItems.length === 0) {
      const out = Number(job.total_quantity_outstanding || job.total_quantity_sent || 0);
      initQty['0'] = { received: out, accepted: out, rejected: 0, rework: 0 };
    }

    setInwardItemQuantities(initQty);
    setInwardPhotos([]);
    setInwardError('');
    setInwardForm({
      receipt_date: new Date().toISOString().split('T')[0],
      vendor_challan_no: `INV-EMB-${Math.floor(1000 + Math.random() * 9000)}`,
      received_by: 'K. Balan (QC & Store Supervisor)',
      remarks: 'Thread tension and stitch density verified against approved strike-off sample.'
    });
    setInwardModalOpen(true);
  };

  const handleInwardPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await processImageFile(files[i]);
        newUrls.push(url);
      }
      setInwardPhotos(prev => [...prev, ...newUrls]);
    } catch (err: any) {
      setInwardError('Failed to process image: ' + err.message);
    }
  };

  // Submit Inward Receipt
  const handleSaveInward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobOrder) return;

    const jItems = Array.isArray(selectedJobOrder.items_json) ? selectedJobOrder.items_json : [];
    const receiptItems: any[] = [];

    if (jItems.length > 0) {
      jItems.forEach((ji: any, idx: number) => {
        const key = String(ji.production_order_item_id || idx);
        const q = inwardItemQuantities[key] || { received: 0, accepted: 0, rejected: 0, rework: 0 };
        if (q.received > 0) {
          receiptItems.push({
            production_order_item_id: ji.production_order_item_id,
            product_id: ji.product_id,
            product_name: ji.product_name,
            color: ji.color,
            size: ji.size,
            received_quantity: Number(q.received),
            accepted_quantity: Number(q.accepted),
            rejected_quantity: Number(q.rejected),
            rework_quantity: Number(q.rework)
          });
        }
      });
    } else {
      const q = inwardItemQuantities['0'] || { received: 0, accepted: 0, rejected: 0, rework: 0 };
      receiptItems.push({
        production_order_item_id: items[0]?.active_embroidery_item_id || items[0]?.id || 0,
        received_quantity: Number(q.received),
        accepted_quantity: Number(q.accepted),
        rejected_quantity: Number(q.rejected),
        rework_quantity: Number(q.rework)
      });
    }

    const totalRec = receiptItems.reduce((s, i) => s + i.received_quantity, 0);
    if (totalRec <= 0) {
      setInwardError('Please enter a received quantity greater than 0.');
      return;
    }

    try {
      setSavingInward(true);
      setInwardError('');
      const res: any = await api.receiveEmbroideryJobOrder({
        job_order_id: selectedJobOrder.id,
        receipt_date: inwardForm.receipt_date,
        vendor_challan_no: inwardForm.vendor_challan_no,
        received_by: inwardForm.received_by,
        remarks: inwardForm.remarks,
        photo_urls: inwardPhotos,
        items: receiptItems
      });

      setInwardModalOpen(false);
      showToast(`Inward Receipt ${res?.receipt_number || ''} recorded successfully!`);
      await fetchOrderData();
    } catch (err: any) {
      setInwardError(err.message || 'Failed to record embroidery inward receipt.');
    } finally {
      setSavingInward(false);
    }
  };

  // Open Stage Transfer Modal to Stitching
  const handleOpenTransferModal = (itemOrJob: any) => {
    let it = itemOrJob;
    if (itemOrJob.total_quantity_sent !== undefined) {
      // It was called with a job order, match the first relevant product
      it = items.find(i => Number(i.accepted_inward || 0) > 0) || items[0];
    }
    setTransferItem(it);
    const maxQty = Number(it?.accepted_inward || it?.ready_to_transfer || overallTotals.acceptedQty || 0);
    setTransferQuantity(maxQty);
    setTransferRemarks('Embroidery completed and QC approved. Transferred to Stage 07: Stitching.');
    setTransferError('');
    setTransferModalOpen(true);
  };

  // Submit Stage Transfer to Stitching
  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || transferQuantity <= 0) {
      setTransferError('Please enter a positive transfer quantity.');
      return;
    }

    try {
      setTransferring(true);
      setTransferError('');
      await api.transferEmbroideryOutput({
        production_order_id: order.id,
        item_id: transferItem?.active_embroidery_item_id || transferItem?.id,
        transfer_quantity: Number(transferQuantity),
        destination_stage_id: 7,
        destination_stage_name: 'Stitching — Color-wise Tracking',
        remarks: transferRemarks,
        operator_name: 'M. Ramesh',
        supervisor_name: 'K. Balan'
      });

      setTransferModalOpen(false);
      showToast(`Successfully transferred ${transferQuantity} pcs to Stage 07: Stitching!`);
      await fetchOrderData();
    } catch (err: any) {
      setTransferError(err.message || 'Failed to transfer embroidery pieces to Stitching.');
    } finally {
      setTransferring(false);
    }
  };

  // Filtered product items
  const filteredItems = useMemo(() => {
    if (activeTab === 'EMBROIDERY') {
      return items.filter(it => Number(it.arrived_from_cutting || 0) > 0 || it.at_embroidery_stage);
    }
    return items;
  }, [items, activeTab]);

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
              onClick={() => navigate('/production/orders')}
              className="text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50"
            >
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-black text-slate-900 tracking-tight">
                  {order?.order_number || `ORD-${id}`}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-pink-50 text-pink-700 border border-pink-200 flex items-center gap-1.5 shadow-2xs">
                  <Sparkles className="w-3 h-3 text-pink-600" />
                  Stage 06: Embroidery — Outward / Inward
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  {order?.priority || 'NORMAL'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {order?.title || 'Production Order Workflow'} • Dedicated vendor outward challans, inward QC receipts, and next stage transfers.
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
              id="btn-new-outward-challan"
              variant="primary"
              size="sm"
              icon={<Send className="w-3.5 h-3.5" />}
              onClick={() => handleOpenOutwardModal()}
              disabled={overallTotals.arrivedQty <= 0}
              className="bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs shadow-sm shadow-pink-200"
            >
              + New Outward Challan
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
              <span>Total Order Qty: <strong className="text-slate-700 font-mono">{fmt(overallTotals.orderQty)} pcs</strong></span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Scissors className="w-3.5 h-3.5 text-amber-600" />
              <span>Arrived in Embroidery: <strong className="text-pink-700 font-mono">{fmt(overallTotals.arrivedQty)} pcs</strong></span>
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cut Qty Arrived</span>
            <span className="text-lg font-black text-slate-900 font-mono mt-0.5 block">{fmt(overallTotals.arrivedQty)}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Ready for job work</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-pink-600 uppercase tracking-wider block">Sent to Vendor</span>
            <span className="text-lg font-black text-pink-600 font-mono mt-0.5 block">{fmt(overallTotals.sentQty)}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">{jobOrders.length} Outward Challans</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Accepted Inward</span>
            <span className="text-lg font-black text-emerald-600 font-mono mt-0.5 block">{fmt(overallTotals.acceptedQty)}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">{receipts.length} Inward Receipts</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Rejection / Defect</span>
            <span className="text-lg font-black text-red-600 font-mono mt-0.5 block">
              {fmt(overallTotals.rejectedQty)}{' '}
              <span className="text-xs text-slate-400 font-normal">({overallTotals.reworkQty} rwk)</span>
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Unrecoverable defect</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Vendor Outstanding</span>
            <span className="text-lg font-black text-amber-600 font-mono mt-0.5 block">{fmt(overallTotals.outstandingQty)}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Pending return</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Ready for Stitching</span>
            <span className="text-lg font-black text-purple-700 font-mono mt-0.5 block">{fmt(overallTotals.readyForStitching)}</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">QC Passed output</span>
          </div>
        </div>

        {/* Table 1: Product-Wise Embroidery Status & Dispatch */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-pink-100 flex items-center justify-center text-pink-700">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Product-Wise Embroidery Status & Dispatch
                </h3>
                <p className="text-[11px] text-slate-500">
                  Cut pieces arriving from Cutting are dispatched to embroidery vendors and tracked through inward receipt.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  activeTab === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Products ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('EMBROIDERY')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  activeTab === 'EMBROIDERY'
                    ? 'bg-pink-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                In Embroidery ({items.filter(i => Number(i.arrived_from_cutting || 0) > 0).length})
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
                  <th className="py-3 px-3 text-right">Cut Arrived</th>
                  <th className="py-3 px-3 text-right">Dispatched</th>
                  <th className="py-3 px-3 text-right">Accepted Inward</th>
                  <th className="py-3 px-3 text-right">Rejected</th>
                  <th className="py-3 px-3 text-right">Outstanding</th>
                  <th className="py-3 px-3 text-right">Avail. to Dispatch</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400 text-xs">
                      No products found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((it, idx) => {
                    const orderQ = Number(it.order_quantity || it.total_quantity || 0);
                    const arrivedQ = Number(it.arrived_from_cutting || 0);
                    const sentQ = Number(it.sent_to_vendor || 0);
                    const accQ = Number(it.accepted_inward || 0);
                    const rejQ = Number(it.rejected_quantity || 0);
                    const outQ = Number(it.outstanding_quantity || 0);
                    const availQ = Number(it.available_to_dispatch || 0);

                    return (
                      <tr key={it.id || idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{it.product_name || 'Product'}</span>
                          {it.product_code && (
                            <span className="font-mono text-[10px] text-pink-600 block">{it.product_code}</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800 block">{it.color || 'Standard'}</span>
                          <span className="text-[10px] font-mono text-slate-400">Size: {it.size || 'M'}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{fmt(orderQ)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700">
                          {arrivedQ > 0 ? fmt(arrivedQ) : <span className="text-slate-300 font-normal">0</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-pink-600">
                          {sentQ > 0 ? fmt(sentQ) : <span className="text-slate-300 font-normal">0</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                          {accQ > 0 ? fmt(accQ) : <span className="text-slate-300 font-normal">0</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-red-600 font-semibold">
                          {rejQ > 0 ? fmt(rejQ) : <span className="text-slate-300 font-normal">0</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-600">
                          {outQ > 0 ? fmt(outQ) : <span className="text-slate-300 font-normal">0</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          {availQ > 0 ? (
                            <span className="text-pink-700 bg-pink-50 px-2 py-0.5 rounded border border-pink-200">
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
                                id={`btn-dispatch-outward-${idx}`}
                                size="xs"
                                variant="primary"
                                icon={<Send className="w-3 h-3" />}
                                onClick={() => handleOpenOutwardModal(it)}
                                className="bg-pink-600 hover:bg-pink-700 text-white font-bold text-[11px] shadow-2xs"
                              >
                                Dispatch Outward
                              </Button>
                            ) : arrivedQ > 0 && outQ > 0 ? (
                              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                With Vendor
                              </span>
                            ) : arrivedQ > 0 && accQ > 0 ? (
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
                                  className="text-[11px] font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                                >
                                  To Stitching
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                Awaiting Cutting
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

        {/* Table 2: Recorded Embroidery Job Orders & Inward Receipts */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Recorded Embroidery Job Orders & Inward Receipts
                </h3>
                <p className="text-[11px] text-slate-500">
                  Every outward challan sent to vendors and completed embroidery inward with proof.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              {jobOrders.length} {jobOrders.length === 1 ? 'Job Order' : 'Job Orders'}
            </span>
          </div>

          {jobOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No embroidery job orders recorded yet. When cut pieces arrive from Cutting, click "Dispatch Outward" above to create a delivery challan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Job Order #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4">Vendor & Transport</th>
                    <th className="py-3 px-3">Delivery Challan</th>
                    <th className="py-3 px-3 text-right">Sent Qty</th>
                    <th className="py-3 px-3 text-right">Received</th>
                    <th className="py-3 px-3 text-right">Accepted</th>
                    <th className="py-3 px-3 text-right">Rejected</th>
                    <th className="py-3 px-3 text-right">Outstanding</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Proof Photos</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobOrders.map((job) => {
                    const sent = Number(job.total_quantity_sent || 0);
                    const rec = Number(job.total_quantity_received || 0);
                    const acc = Number(job.total_quantity_accepted || 0);
                    const rej = Number(job.total_quantity_rejected || 0);
                    const out = Number(job.total_quantity_outstanding || 0);

                    // Combine photos from job order attachments and matching receipts
                    const jobPhotos = parsePhotos(job.attachments);
                    const receiptPhotos = receipts
                      .filter(r => Number(r.job_order_id) === Number(job.id))
                      .flatMap(r => parsePhotos(r.photo_urls));
                    const allPhotos = [...jobPhotos, ...receiptPhotos];

                    return (
                      <tr key={job.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-pink-700">
                          {job.job_order_number}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono">
                          {job.dispatch_date || job.job_order_date}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-800 block">{job.vendor_name}</span>
                          {job.transport_courier && (
                            <span className="text-[10px] text-slate-400 block">{job.transport_courier}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          {job.delivery_challan_no || 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">{fmt(sent)}</td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-indigo-700">{fmt(rec)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">{fmt(acc)}</td>
                        <td className="py-3 px-3 text-right font-mono text-red-600 font-semibold">{fmt(rej)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-600">{fmt(out)}</td>
                        <td className="py-3 px-3 text-center">
                          {out <= 0.01 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Completed
                            </span>
                          ) : rec > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              Partial ({fmt(rec)}/{fmt(sent)})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              With Vendor
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {allPhotos.length > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              {allPhotos.slice(0, 2).map((url, pIdx) => (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() => setPreviewImage(url)}
                                  className="w-7 h-7 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition shrink-0"
                                >
                                  <img src={url} alt="Proof" className="w-full h-full object-cover" />
                                </button>
                              ))}
                              {allPhotos.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage(allPhotos[0])}
                                  className="w-7 h-7 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold border border-slate-200 flex items-center justify-center"
                                >
                                  +{allPhotos.length - 2}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {out > 0.01 ? (
                              <Button
                                id={`btn-receive-inward-${job.id}`}
                                size="xs"
                                variant="primary"
                                icon={<ArrowDownCircle className="w-3 h-3" />}
                                onClick={() => handleOpenInwardModal(job)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs"
                              >
                                Receive Inward
                              </Button>
                            ) : (
                              <Button
                                id={`btn-transfer-stitching-${job.id}`}
                                size="xs"
                                variant="secondary"
                                icon={<ArrowRight className="w-3 h-3" />}
                                onClick={() => handleOpenTransferModal(job)}
                                className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold text-[11px]"
                              >
                                To Stitching
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Create Outward Job Order */}
      <Modal
        isOpen={outwardModalOpen}
        onClose={() => setOutwardModalOpen(false)}
        title="Create Outward Embroidery Job Order"
        size="lg"
      >
        <form onSubmit={handleCreateOutward} className="space-y-4">
          {outwardError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{outwardError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Vendor / Job Worker Name" required>
              <input
                type="text"
                list="embroidery-master-units"
                value={outwardForm.vendor_name}
                onChange={e => setOutwardForm({ ...outwardForm, vendor_name: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 font-medium text-slate-800"
                placeholder="Select or type embroidery unit..."
                required
              />
              <datalist id="embroidery-master-units">
                {embroideryUnits.map(unit => (
                  <option key={unit.id} value={unit.name}>
                    {unit.code ? `[${unit.code}] ` : ''}{unit.name}{unit.machine_heads ? ` • ${unit.machine_heads}` : ''}
                  </option>
                ))}
              </datalist>
            </FormField>

            <FormField label="Delivery Challan No" required>
              <input
                type="text"
                value={outwardForm.delivery_challan_no}
                onChange={e => setOutwardForm({ ...outwardForm, delivery_challan_no: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 font-mono font-bold text-slate-800"
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Dispatch Date" required>
              <input
                type="date"
                value={outwardForm.dispatch_date}
                onChange={e => setOutwardForm({ ...outwardForm, dispatch_date: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 font-mono"
                required
              />
            </FormField>

            <FormField label="Expected Return Date">
              <input
                type="date"
                value={outwardForm.expected_return_date}
                onChange={e => setOutwardForm({ ...outwardForm, expected_return_date: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 font-mono"
              />
            </FormField>

            <FormField label="Dispatched By">
              <input
                type="text"
                value={outwardForm.sent_by}
                onChange={e => setOutwardForm({ ...outwardForm, sent_by: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-slate-800"
              />
            </FormField>
          </div>

          <FormField label="Transport / Vehicle / Courier Details">
            <input
              type="text"
              value={outwardForm.transport_courier}
              onChange={e => setOutwardForm({ ...outwardForm, transport_courier: e.target.value })}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-slate-800"
              placeholder="e.g. Factory Van (TN-38-BZ-4412)"
            />
          </FormField>

          {/* Product Items Dispatch Breakdown */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mt-3">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Items & Quantities to Dispatch
              </span>
              <span className="text-[11px] text-slate-500">
                Total Available: {fmt(overallTotals.arrivedQty - overallTotals.sentQty)} pcs
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              {items
                .filter(it => Number(it.available_to_dispatch || it.arrived_from_cutting || 0) > 0)
                .map((it) => {
                  const key = String(it.active_embroidery_item_id || it.id);
                  const maxAvail = Number(it.available_to_dispatch || it.arrived_from_cutting || 0);
                  const currentVal = outwardItems[key] !== undefined ? outwardItems[key] : maxAvail;

                  return (
                    <div key={key} className="px-4 py-3 flex items-center justify-between gap-4 bg-white hover:bg-slate-50/50">
                      <div>
                        <span className="font-bold text-slate-900 block text-xs">{it.product_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Color: {it.color} • Size: {it.size || 'M'} • Arrived: {fmt(it.arrived_from_cutting)} pcs • Avail: {fmt(maxAvail)} pcs
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Dispatch Qty:</span>
                        <input
                          type="number"
                          min="0"
                          max={maxAvail}
                          value={currentVal}
                          onChange={e => {
                            const val = Math.max(0, Math.min(maxAvail, Number(e.target.value)));
                            setOutwardItems(prev => ({ ...prev, [key]: val }));
                          }}
                          className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-right font-mono font-bold text-pink-700 text-xs focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <FormField label="Embroidery Work Specifications & Notes">
            <textarea
              rows={2}
              value={outwardForm.notes}
              onChange={e => setOutwardForm({ ...outwardForm, notes: e.target.value })}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-slate-800"
              placeholder="Specify stitch density, thread colors, backing material, quality requirements..."
            />
          </FormField>

          {/* Outward Photo Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Delivery Challan & Dispatch Slip Photos (Optional)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition text-xs text-slate-600 font-semibold">
                <Camera className="w-4 h-4 text-pink-600" />
                <span>Upload Dispatch Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleOutwardPhotoUpload}
                  className="hidden"
                />
              </label>

              {outwardPhotos.map((url, idx) => (
                <div key={idx} className="relative w-12 h-12 rounded-lg border border-slate-200 overflow-hidden group">
                  <img src={url} alt="Challan" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setOutwardPhotos(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-300" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOutwardModalOpen(false)}
              disabled={savingOutward}
            >
              Cancel
            </Button>
            <Button
              id="btn-submit-outward-job-order"
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingOutward}
              className="bg-pink-600 hover:bg-pink-700 text-white font-bold"
            >
              {savingOutward ? 'Creating...' : 'Confirm & Dispatch Job Order'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Receive Inward & QC */}
      <Modal
        isOpen={inwardModalOpen}
        onClose={() => setInwardModalOpen(false)}
        title={`Receive Inward Embroidery — ${selectedJobOrder?.job_order_number || ''}`}
        size="lg"
      >
        <form onSubmit={handleSaveInward} className="space-y-4">
          {inwardError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{inwardError}</span>
            </div>
          )}

          {selectedJobOrder && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Vendor</span>
                <span className="font-bold text-slate-800">{selectedJobOrder.vendor_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Outward Challan</span>
                <span className="font-mono font-bold text-slate-800">{selectedJobOrder.delivery_challan_no}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Sent</span>
                <span className="font-mono font-bold text-slate-800">{fmt(selectedJobOrder.total_quantity_sent)} pcs</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Outstanding</span>
                <span className="font-mono font-bold text-amber-600">{fmt(selectedJobOrder.total_quantity_outstanding)} pcs</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Vendor Challan / Invoice No" required>
              <input
                type="text"
                value={inwardForm.vendor_challan_no}
                onChange={e => setInwardForm({ ...inwardForm, vendor_challan_no: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-slate-800"
                placeholder="e.g. VDC-8819"
                required
              />
            </FormField>

            <FormField label="Inward Date" required>
              <input
                type="date"
                value={inwardForm.receipt_date}
                onChange={e => setInwardForm({ ...inwardForm, receipt_date: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                required
              />
            </FormField>

            <FormField label="Received & QC Checked By" required>
              <input
                type="text"
                value={inwardForm.received_by}
                onChange={e => setInwardForm({ ...inwardForm, received_by: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-slate-800"
                required
              />
            </FormField>
          </div>

          {/* Item Breakdown for Inward Receipt */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mt-3">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Enter Inward Quantities & Quality Inspection
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {Array.isArray(selectedJobOrder?.items_json) && selectedJobOrder.items_json.length > 0 ? (
                selectedJobOrder.items_json.map((ji: any, idx: number) => {
                  const key = String(ji.production_order_item_id || idx);
                  const q = inwardItemQuantities[key] || { received: 0, accepted: 0, rejected: 0, rework: 0 };
                  const sent = Number(ji.quantity_sent || 0);

                  return (
                    <div key={key} className="p-4 bg-white space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 block text-xs">{ji.product_name || 'Product'}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Color: {ji.color} • Size: {ji.size || 'M'} • Sent in Job Order: <strong>{fmt(sent)} pcs</strong>
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Received Qty
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={sent}
                            value={q.received}
                            onChange={e => {
                              const rVal = Math.max(0, Number(e.target.value));
                              setInwardItemQuantities(prev => ({
                                ...prev,
                                [key]: {
                                  ...q,
                                  received: rVal,
                                  accepted: Math.max(0, rVal - q.rejected - q.rework)
                                }
                              }));
                            }}
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold text-indigo-700"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">
                            Accepted Qty
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={q.received}
                            value={q.accepted}
                            onChange={e => {
                              const aVal = Math.max(0, Number(e.target.value));
                              setInwardItemQuantities(prev => ({
                                ...prev,
                                [key]: { ...q, accepted: aVal }
                              }));
                            }}
                            className="w-full text-xs px-2.5 py-1.5 border border-emerald-300 rounded font-mono font-bold text-emerald-700"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-red-700 uppercase mb-1">
                            Rejected Qty
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={q.rejected}
                            onChange={e => {
                              const rVal = Math.max(0, Number(e.target.value));
                              setInwardItemQuantities(prev => ({
                                ...prev,
                                [key]: {
                                  ...q,
                                  rejected: rVal,
                                  accepted: Math.max(0, q.received - rVal - q.rework)
                                }
                              }));
                            }}
                            className="w-full text-xs px-2.5 py-1.5 border border-red-300 rounded font-mono font-bold text-red-600"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-amber-700 uppercase mb-1">
                            Rework Qty
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={q.rework}
                            onChange={e => {
                              const rVal = Math.max(0, Number(e.target.value));
                              setInwardItemQuantities(prev => ({
                                ...prev,
                                [key]: {
                                  ...q,
                                  rework: rVal,
                                  accepted: Math.max(0, q.received - q.rejected - rVal)
                                }
                              }));
                            }}
                            className="w-full text-xs px-2.5 py-1.5 border border-amber-300 rounded font-mono font-bold text-amber-600"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 bg-white">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Received Qty</label>
                      <input
                        type="number"
                        min="0"
                        value={inwardItemQuantities['0']?.received || 0}
                        onChange={e => {
                          const v = Number(e.target.value);
                          setInwardItemQuantities(prev => ({
                            ...prev,
                            '0': { ...prev['0'], received: v, accepted: v }
                          }));
                        }}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Accepted Qty</label>
                      <input
                        type="number"
                        min="0"
                        value={inwardItemQuantities['0']?.accepted || 0}
                        onChange={e => {
                          const v = Number(e.target.value);
                          setInwardItemQuantities(prev => ({
                            ...prev,
                            '0': { ...prev['0'], accepted: v }
                          }));
                        }}
                        className="w-full text-xs px-2.5 py-1.5 border border-emerald-300 rounded font-mono font-bold text-emerald-700"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <FormField label="Quality Inspection Remarks">
            <textarea
              rows={2}
              value={inwardForm.remarks}
              onChange={e => setInwardForm({ ...inwardForm, remarks: e.target.value })}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-slate-800"
              placeholder="e.g. Embroidery density verified, threads clipped cleanly, no puckering."
            />
          </FormField>

          {/* QC Proof Photos */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Inward QC Proof Photos & Challan Slip
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition text-xs text-slate-600 font-semibold">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Upload Inward Proof Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleInwardPhotoUpload}
                  className="hidden"
                />
              </label>

              {inwardPhotos.map((url, idx) => (
                <div key={idx} className="relative w-12 h-12 rounded-lg border border-slate-200 overflow-hidden group">
                  <img src={url} alt="QC Proof" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setInwardPhotos(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-300" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInwardModalOpen(false)}
              disabled={savingInward}
            >
              Cancel
            </Button>
            <Button
              id="btn-submit-inward-receipt"
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingInward}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {savingInward ? 'Recording...' : 'Save Inward Receipt & Complete QC'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Transfer to Stitching */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer Completed Embroidery to Stage 07: Stitching"
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
              Stage 07: Stitching — Color-wise Tracking
            </span>
            <span className="text-xs text-purple-700 block">
              Product: <strong>{transferItem?.product_name || 'sample'}</strong> • Color: <strong>{transferItem?.color || '101 C'}</strong>
            </span>
          </div>

          <FormField label="Quantity to Transfer" required>
            <input
              type="number"
              min="1"
              max={Number(transferItem?.accepted_inward || transferItem?.ready_to_transfer || overallTotals.acceptedQty || 1000)}
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
              id="btn-confirm-transfer-to-stitching"
              variant="primary"
              size="sm"
              type="submit"
              disabled={transferring}
              className="bg-purple-700 hover:bg-purple-800 text-white font-bold"
            >
              {transferring ? 'Transferring...' : 'Confirm Transfer to Stitching'}
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
