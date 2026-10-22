// src/pages/production/DispatchOrderDetail.tsx
// Stage 10: Completed / Dispatch — Multi-dispatch Logistics, Photo Proof (Truck, Loaded Cartons, Signed DC) & Completion Rules
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStageBackNavigation } from '../../utils/navigation';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, DispatchRecord, PackingCarton } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { LivePhotoCaptureField } from '../../components/production/LivePhotoCaptureField';
import EwayBillPdfUpload, { EwayBillDocumentData } from '../../components/production/EwayBillPdfUpload';
import {
  ArrowLeft,
  Truck,
  RefreshCw,
  Plus,
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
  Boxes,
  Phone,
  Clock,
  ShieldCheck,
  Printer,
  ChevronDown,
  ChevronUp,
  ExternalLink
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

function isPdfAttachment(url: string, filename?: string): boolean {
  if (!url) return false;
  if (url.startsWith('data:application/pdf')) return true;
  if (url.toLowerCase().endsWith('.pdf')) return true;
  if (filename && filename.toLowerCase().endsWith('.pdf')) return true;
  return false;
}

export default function DispatchOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const handleBack = useStageBackNavigation('/production/completed');

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [cartons, setCartons] = useState<PackingCarton[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Dispatch Modal State
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    dispatch_date: new Date().toISOString().split('T')[0],
    dispatch_time: new Date().toTimeString().slice(0, 5),
    vehicle_number: '',
    driver_name: '',
    driver_contact: '',
    transporter_name: '',
    delivery_challan_number: '',
    invoice_reference: '',
    eway_bill_number: '',
    destination_notes: '',
    remarks: ''
  });
  const [selectedCartonIds, setSelectedCartonIds] = useState<number[]>([]);
  const [truckPhotos, setTruckPhotos] = useState<string[]>([]);
  const [cartonPhotos, setCartonPhotos] = useState<string[]>([]);
  const [ewayBillDoc, setEwayBillDoc] = useState<EwayBillDocumentData | null>(null);
  const [savingDispatch, setSavingDispatch] = useState(false);
  const [dispatchError, setDispatchError] = useState('');

  // Evidence Preview Modals (Images and PDFs)
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewPdfDoc, setPreviewPdfDoc] = useState<{ url: string; title: string; size?: string } | null>(null);

  const fetchOrderData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const [orderRes, stagesRes, dispRes, cartonsRes] = await Promise.all([
        api.getProductionOrder(Number(id)),
        api.getProductionStages(),
        api.getDispatchHistory(Number(id)),
        api.getPackingCartons(Number(id))
      ]);

      const ord = (orderRes as any)?.data || orderRes;
      setOrder(ord);
      setItems(ord.items || []);

      const st = (stagesRes as any)?.data || stagesRes;
      setStages(Array.isArray(st) ? st : []);

      const dData = (dispRes as any)?.data || dispRes;
      setDispatches(Array.isArray(dData) ? dData : []);

      const cData = (cartonsRes as any)?.data || cartonsRes;
      setCartons(Array.isArray(cData) ? cData : []);
    } catch (err: any) {
      console.error('Failed to load dispatch stage data:', err);
      setError(err?.message || 'Failed to load dispatch stage data.');
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

  // Available Cartons that have not yet been dispatched
  const availableCartons = useMemo(() => {
    return cartons.filter(c => c.status !== 'Dispatched');
  }, [cartons]);

  // Total Dispatched Metrics
  const metrics = useMemo(() => {
    let orderedQty = 0;
    items.forEach(it => {
      orderedQty += Number(it.total_quantity || it.order_quantity || it.quantity || 0);
    });
    if (orderedQty === 0 && order) {
      orderedQty = Number(order.total_quantity || 0);
    }

    const dispatchedQty = dispatches.reduce((sum, d) => sum + Number(d.total_dispatched_quantity || 0), 0);
    const totalPackedCartons = cartons.length;
    const dispatchedCartons = cartons.filter(c => c.status === 'Dispatched').length;
    const remainingCartons = Math.max(0, totalPackedCartons - dispatchedCartons);
    const remainingToDispatchQty = Math.max(0, orderedQty - dispatchedQty);

    const hasValidEwayProof = dispatches.length > 0 && dispatches.every(d =>
      Boolean((d.eway_bill_number || '').trim()) &&
      ((d.eway_bill_photo_urls && d.eway_bill_photo_urls.length > 0) || (d.document_urls && d.document_urls.length > 0))
    );

    let completionStatus: 'Packed / Awaiting Dispatch' | 'Partially Dispatched' | 'Awaiting E-Way Bill Proof' | 'Fully Dispatched & Completed' = 'Packed / Awaiting Dispatch';
    const allDispatched = (dispatchedQty >= orderedQty && orderedQty > 0) || (totalPackedCartons > 0 && remainingCartons === 0);

    if (allDispatched) {
      completionStatus = hasValidEwayProof ? 'Fully Dispatched & Completed' : 'Awaiting E-Way Bill Proof';
    } else if (dispatchedQty > 0 || dispatchedCartons > 0) {
      completionStatus = 'Partially Dispatched';
    }

    return {
      orderedQty,
      dispatchedQty,
      totalPackedCartons,
      dispatchedCartons,
      remainingCartons,
      remainingToDispatchQty,
      completionStatus,
      hasValidEwayProof
    };
  }, [order, items, dispatches, cartons]);

  // Open Dispatch Modal
  const handleOpenDispatchModal = () => {
    if (availableCartons.length === 0) {
      showToast('All master cartons have already been dispatched. No cartons remain in bay.');
      return;
    }
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const randEway = Math.floor(100000000000 + Math.random() * 900000000000);
    setDispatchForm(prev => ({
      ...prev,
      dispatch_date: new Date().toISOString().split('T')[0],
      dispatch_time: new Date().toTimeString().slice(0, 5),
      vehicle_number: '',
      driver_name: '',
      driver_contact: '',
      transporter_name: '',
      delivery_challan_number: `DC-DISP-${randNum}`,
      invoice_reference: `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
      eway_bill_number: `EWB-${randEway}`,
      destination_notes: (order as any)?.delivery_address || (order as any)?.destination_hub || '',
      remarks: ''
    }));
    // By default select all available cartons
    setSelectedCartonIds(availableCartons.map(c => c.id || 0).filter(Boolean));
    setTruckPhotos([]);
    setCartonPhotos([]);
    setEwayBillDoc(null);
    setDispatchError('');
    setDispatchModalOpen(true);
  };

  const handleTruckPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const base64 = await processImageFile(files[i]);
        newUrls.push(base64);
      }
      setTruckPhotos(prev => [...prev, ...newUrls]);
    } catch (err) {
      console.error('Error processing truck photo:', err);
      setDispatchError('Failed to process image file.');
    }
  };

  const handleCartonPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const base64 = await processImageFile(files[i]);
        newUrls.push(base64);
      }
      setCartonPhotos(prev => [...prev, ...newUrls]);
    } catch (err) {
      console.error('Error processing carton photo:', err);
      setDispatchError('Failed to process image file.');
    }
  };

  const handleSaveDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (availableCartons.length === 0) {
      setDispatchError('All master cartons for this order have already been dispatched. No pending cartons remain in bay.');
      return;
    }

    if (selectedCartonIds.length === 0) {
      setDispatchError('Please select at least one packed carton to load for this dispatch.');
      return;
    }

    // Duplicate check on frontend
    const trimDc = dispatchForm.delivery_challan_number.trim();
    if (trimDc && dispatches.some(d => (d.delivery_challan_number || '').trim().toLowerCase() === trimDc.toLowerCase())) {
      setDispatchError(`Duplicate Dispatch Error: Delivery Challan '${trimDc}' has already been recorded for this order.`);
      return;
    }

    const trimInv = dispatchForm.invoice_reference.trim();
    if (trimInv && dispatches.some(d => (d.invoice_reference || '').trim().toLowerCase() === trimInv.toLowerCase())) {
      setDispatchError(`Duplicate Dispatch Error: Invoice reference '${trimInv}' has already been recorded for this order.`);
      return;
    }

    const trimEw = dispatchForm.eway_bill_number.trim();
    if (!trimEw) {
      setDispatchError('E-Way Bill Number is mandatory before dispatch and order completion.');
      return;
    }

    if (dispatches.some(d => (d.eway_bill_number || '').trim().toLowerCase() === trimEw.toLowerCase())) {
      setDispatchError(`Duplicate Dispatch Error: E-Way Bill number '${trimEw}' has already been recorded for this order.`);
      return;
    }

    const selectedCartons = cartons.filter(c => selectedCartonIds.includes(c.id || 0));
    const totalPcs = selectedCartons.reduce((sum, c) => sum + Number(c.items_count || 0), 0);
    const totalBoxesCount = selectedCartons.length * 5; // Section D ratio

    if (!ewayBillDoc || !ewayBillDoc.dataUrl) {
      setDispatchError('Mandatory E-Way Bill PDF document is missing. Please upload the original multi-page E-Way Bill PDF before dispatch can be completed.');
      return;
    }

    if (!truckPhotos || truckPhotos.length === 0) {
      setDispatchError('Real-time camera photograph with live GPS coordinates of the transport vehicle & registration number plate is mandatory.');
      return;
    }

    if (!cartonPhotos || cartonPhotos.length === 0) {
      setDispatchError('Real-time camera photograph with live GPS coordinates of the loaded cartons & security seal is mandatory.');
      return;
    }

    try {
      setSavingDispatch(true);
      setDispatchError('');

      await api.recordOrderDispatch({
        production_order_id: order.id,
        production_order_number: order.order_number,
        buyer_id: order.customer_id,
        buyer_name: order.customer_name,
        dispatch_date: dispatchForm.dispatch_date,
        dispatch_time: dispatchForm.dispatch_time,
        total_dispatched_quantity: totalPcs,
        total_boxes: totalBoxesCount,
        total_master_cartons: selectedCartons.length,
        vehicle_number: dispatchForm.vehicle_number,
        driver_name: dispatchForm.driver_name,
        driver_contact: dispatchForm.driver_contact,
        transporter_name: dispatchForm.transporter_name,
        delivery_challan_number: dispatchForm.delivery_challan_number,
        invoice_reference: dispatchForm.invoice_reference,
        eway_bill_number: trimEw,
        eway_bill_pdf: ewayBillDoc.dataUrl,
        eway_bill_filename: ewayBillDoc.filename,
        eway_bill_filesize: ewayBillDoc.fileSize,
        destination_notes: dispatchForm.destination_notes,
        remarks: dispatchForm.remarks,
        truck_photo_urls: truckPhotos,
        loaded_cartons_photo_urls: cartonPhotos,
        eway_bill_photo_urls: [ewayBillDoc.dataUrl],
        document_urls: [ewayBillDoc.dataUrl],
        carton_ids: selectedCartonIds
      });

      showToast(`Dispatch record ${dispatchForm.delivery_challan_number} saved with ${fmt(totalPcs)} pieces.`);
      setDispatchModalOpen(false);
      await fetchOrderData();
    } catch (err: any) {
      console.error('Failed to record dispatch:', err);
      setDispatchError(err?.message || 'Failed to record dispatch.');
    } finally {
      setSavingDispatch(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading Stage 10 Completed / Dispatch workspace...</p>
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
          <Button variant="secondary" size="sm" onClick={handleBack}>
            Back to Completed Stage
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
            onClick={handleBack}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            title="Return to Stage 10 Board"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Truck className="w-3 h-3 text-emerald-600" />
                Stage 10: Completed / Dispatch
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                metrics.completionStatus === 'Fully Dispatched & Completed'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : metrics.completionStatus === 'Partially Dispatched'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-blue-100 text-blue-800 border-blue-200'
              }`}>
                {metrics.completionStatus}
              </span>
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

          {availableCartons.length === 0 && cartons.length > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span>All Cartons Dispatched</span>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenDispatchModal}
              disabled={availableCartons.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Record Vehicle Dispatch</span>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Ordered</div>
          <div className="text-xl sm:text-2xl font-black text-slate-800">{fmt(metrics.orderedQty)}</div>
          <div className="text-[10px] text-slate-400 mt-1">{items.length} Products</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">Dispatched Output</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">{fmt(metrics.dispatchedQty)}</div>
          <div className="text-[10px] text-emerald-600 mt-1 font-medium">{dispatches.length} Shipments</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider mb-1">Pending Dispatch</div>
          <div className="text-xl sm:text-2xl font-black text-indigo-700">{fmt(metrics.remainingToDispatchQty)}</div>
          <div className="text-[10px] text-indigo-600 mt-1 font-medium">To be shipped</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Total Cartons</div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">{metrics.totalPackedCartons}</div>
          <div className="text-[10px] text-slate-500 mt-1">Master Cartons</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">Shipped Cartons</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">{metrics.dispatchedCartons}</div>
          <div className="text-[10px] text-emerald-600 mt-1 font-medium">Loaded onto trucks</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/40 shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider mb-1">Cartons in Bay</div>
          <div className="text-xl sm:text-2xl font-black text-amber-700 font-mono">{metrics.remainingCartons}</div>
          <div className="text-[10px] text-amber-600 mt-1 font-medium">Awaiting loading</div>
        </div>
      </div>

      {/* Dispatch History Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-800">Dispatch Records & Logistics Audit</h2>
            <p className="text-xs text-slate-500">Every shipment requires vehicle numbers, driver details, loaded carton counts, and proof photos.</p>
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            {dispatches.length} Shipments Recorded
          </span>
        </div>

        {dispatches.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700 mb-1">No Dispatches Recorded Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              Pack cartons in Stage 09, then click "Record Vehicle Dispatch" to load them into transport vehicles with photo verification.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenDispatchModal}
              disabled={availableCartons.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Record First Dispatch
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {dispatches.map(disp => (
              <div key={disp.id || disp.dispatch_number} className="p-5 space-y-4 hover:bg-slate-50/40 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono font-bold text-sm text-emerald-800">{disp.dispatch_number}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700 border border-slate-200">
                        Challan: {disp.delivery_challan_number || 'DC-REF'}
                      </span>
                      {disp.invoice_reference && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700 border border-slate-200">
                          Inv: {disp.invoice_reference}
                        </span>
                      )}
                      {disp.eway_bill_number && (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 font-mono text-[10px] text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1">
                          <FileText className="w-3 h-3 text-emerald-600" />
                          E-Way: {disp.eway_bill_number}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <span>Vehicle: {disp.vehicle_number}</span>
                      <span className="text-slate-400">•</span>
                      <span>Transporter: {disp.transporter_name || 'Direct Factory Fleet'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5 flex-wrap">
                      <span>Dispatch: {disp.dispatch_date} {disp.dispatch_time && `@ ${disp.dispatch_time}`}</span>
                      {disp.driver_name && <span>Driver: {disp.driver_name} ({disp.driver_contact || 'N/A'})</span>}
                    </div>
                  </div>

                  <div className="text-right sm:text-right">
                    <div className="text-base font-black font-mono text-emerald-700">
                      {fmt(disp.total_dispatched_quantity)} Pcs
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      {disp.total_master_cartons} Master Cartons ({disp.total_boxes} Boxes)
                    </div>
                  </div>
                </div>

                {disp.destination_notes && (
                  <div className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-100">
                    <span className="font-semibold text-slate-700">Destination Hub:</span> {disp.destination_notes}
                  </div>
                )}

                {/* Evidence Photos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                  {/* E-Way Bill Document / Proof */}
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-rose-600" />
                      <span>E-Way Bill Document</span>
                    </div>
                    {(() => {
                      const docs = parsePhotos(disp.document_urls || disp.eway_bill_photo_urls);
                      if (docs.length === 0) {
                        return <div className="text-[11px] text-slate-400 italic">No E-Way Bill attached</div>;
                      }
                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          {docs.map((docUrl, idx) => {
                            const isPdf = isPdfAttachment(docUrl, disp.eway_bill_filename);
                            if (isPdf) {
                              const docTitle = disp.eway_bill_filename || (disp.eway_bill_number ? `Eway_Bill_${disp.eway_bill_number}.pdf` : `E-Way_Bill_Doc_${idx + 1}.pdf`);
                              const docSizeStr = disp.eway_bill_filesize ? `${(disp.eway_bill_filesize / 1024).toFixed(1)} KB` : undefined;
                              return (
                                <div
                                  key={idx}
                                  onClick={() => setPreviewPdfDoc({ url: docUrl, title: docTitle, size: docSizeStr })}
                                  className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 hover:border-rose-300 cursor-pointer shadow-2xs transition"
                                  title={`Click to preview multi-page PDF: ${docTitle}`}
                                >
                                  <div className="w-7 h-7 rounded bg-rose-600 text-white flex items-center justify-center font-mono text-[9px] font-black shrink-0">
                                    PDF
                                  </div>
                                  <div className="min-w-0 max-w-[150px]">
                                    <div className="text-xs font-bold text-slate-800 truncate" title={docTitle}>
                                      {docTitle}
                                    </div>
                                    <div className="text-[10px] text-emerald-700 font-medium">
                                      {docSizeStr || 'Multi-page PDF'}
                                    </div>
                                  </div>
                                  <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600 shrink-0 ml-1 transition" />
                                </div>
                              );
                            }
                            // Historical Image Proof
                            return (
                              <div
                                key={idx}
                                onClick={() => setPreviewImage(docUrl)}
                                className="relative group w-16 h-16 rounded-lg overflow-hidden border border-emerald-300 cursor-pointer shadow-2xs hover:scale-105 transition"
                                title="Click to zoom historical camera proof"
                              >
                                <img src={docUrl} alt="E-Way Bill Proof" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                  <ZoomIn className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Truck Photos */}
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-slate-400" />
                      <span>Truck & License Plate Evidence</span>
                    </div>
                    {(() => {
                      const photos = parsePhotos(disp.truck_photo_urls);
                      return photos.length > 0 ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {photos.map((url, idx) => (
                            <div
                              key={idx}
                              onClick={() => setPreviewImage(url)}
                              className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 cursor-pointer shadow-2xs hover:scale-105 transition"
                            >
                              <img src={url} alt="Truck" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                <ZoomIn className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic">No truck photos attached</div>
                      );
                    })()}
                  </div>

                  {/* Loaded Cartons Photos */}
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                      <Boxes className="w-3.5 h-3.5 text-slate-400" />
                      <span>Loaded Cartons & Seal Evidence</span>
                    </div>
                    {(() => {
                      const photos = parsePhotos(disp.loaded_cartons_photo_urls);
                      return photos.length > 0 ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {photos.map((url, idx) => (
                            <div
                              key={idx}
                              onClick={() => setPreviewImage(url)}
                              className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 cursor-pointer shadow-2xs hover:scale-105 transition"
                            >
                              <img src={url} alt="Cartons loaded" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                <ZoomIn className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic">No carton load photos attached</div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Dispatch Modal */}
      <Modal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        title="Record Production Order Dispatch"
        size="lg"
      >
        <form onSubmit={handleSaveDispatch} className="space-y-4">
          {dispatchError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{dispatchError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Dispatch Date" required>
              <input
                type="date"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                value={dispatchForm.dispatch_date}
                onChange={e => setDispatchForm({ ...dispatchForm, dispatch_date: e.target.value })}
              />
            </FormField>

            <FormField label="Dispatch Time" required>
              <input
                type="time"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                value={dispatchForm.dispatch_time}
                onChange={e => setDispatchForm({ ...dispatchForm, dispatch_time: e.target.value })}
              />
            </FormField>

            <FormField label="Vehicle / Truck Registration No." required>
              <input
                type="text"
                required
                placeholder="e.g. TN-38-BZ-4412"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                value={dispatchForm.vehicle_number}
                onChange={e => setDispatchForm({ ...dispatchForm, vehicle_number: e.target.value })}
              />
            </FormField>

            <FormField label="Transporter / Carrier Name" required>
              <input
                type="text"
                required
                placeholder="e.g. VRL Logistics / SRS Express"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                value={dispatchForm.transporter_name}
                onChange={e => setDispatchForm({ ...dispatchForm, transporter_name: e.target.value })}
              />
            </FormField>

            <FormField label="Driver Name" required>
              <input
                type="text"
                required
                placeholder="e.g. Driver Name"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                value={dispatchForm.driver_name}
                onChange={e => setDispatchForm({ ...dispatchForm, driver_name: e.target.value })}
              />
            </FormField>

            <FormField label="Driver Mobile Number" required>
              <input
                type="text"
                required
                placeholder="e.g. +91 98422 55441"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                value={dispatchForm.driver_contact}
                onChange={e => setDispatchForm({ ...dispatchForm, driver_contact: e.target.value })}
              />
            </FormField>

            <FormField label="Delivery Challan No." required>
              <input
                type="text"
                required
                placeholder="e.g. DC-DISP-4560"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                value={dispatchForm.delivery_challan_number}
                onChange={e => setDispatchForm({ ...dispatchForm, delivery_challan_number: e.target.value })}
              />
            </FormField>

            <FormField label="Tax Invoice Reference">
              <input
                type="text"
                placeholder="e.g. INV-2026-521"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                value={dispatchForm.invoice_reference}
                onChange={e => setDispatchForm({ ...dispatchForm, invoice_reference: e.target.value })}
              />
            </FormField>

            <FormField label="E-Way Bill Number" required>
              <input
                type="text"
                required
                placeholder="e.g. 541298457612 or EWB-2026-9041"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                value={dispatchForm.eway_bill_number}
                onChange={e => setDispatchForm({ ...dispatchForm, eway_bill_number: e.target.value })}
              />
            </FormField>
          </div>

          {/* Cartons Selection */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Select Master Cartons to Load ({selectedCartonIds.length} of {availableCartons.length} selected)
              </span>
              <button
                type="button"
                onClick={() => {
                  if (selectedCartonIds.length === availableCartons.length) {
                    setSelectedCartonIds([]);
                  } else {
                    setSelectedCartonIds(availableCartons.map(c => c.id || 0).filter(Boolean));
                  }
                }}
                className="text-[11px] font-semibold text-emerald-700 hover:underline"
              >
                {selectedCartonIds.length === availableCartons.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
              {availableCartons.map(c => {
                const isSelected = selectedCartonIds.includes(c.id || 0);
                return (
                  <div
                    key={c.id || c.carton_serial_number}
                    onClick={() => {
                      const cId = c.id || 0;
                      if (isSelected) {
                        setSelectedCartonIds(prev => prev.filter(id => id !== cId));
                      } else {
                        setSelectedCartonIds(prev => [...prev, cId]);
                      }
                    }}
                    className={`p-2 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-mono text-[11px]">{c.carton_serial_number}</div>
                      <div className="text-[10px] text-slate-500">{c.items_count} pcs</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent div onClick
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <FormField label="Destination & Delivery Hub Address">
            <input
              type="text"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              value={dispatchForm.destination_notes}
              onChange={e => setDispatchForm({ ...dispatchForm, destination_notes: e.target.value })}
            />
          </FormField>

          {/* Mandatory Proofs: PDF Document for E-Way Bill, Live GPS Camera for Truck & Cartons */}
          <div className="space-y-4 pt-1">
            <EwayBillPdfUpload
              value={ewayBillDoc?.dataUrl || null}
              filename={ewayBillDoc?.filename}
              fileSize={ewayBillDoc?.fileSize}
              onChange={setEwayBillDoc}
              ewayBillNumber={dispatchForm.eway_bill_number}
              error={dispatchError && (!ewayBillDoc || !ewayBillDoc.dataUrl) ? 'Original E-Way Bill PDF document upload is mandatory.' : undefined}
              required={true}
            />

            <LivePhotoCaptureField
              label="Truck & Vehicle Registration Plate Photo"
              required={true}
              photos={truckPhotos}
              onPhotosChange={setTruckPhotos}
              stageName="Dispatch — Transport Vehicle (Stage 10)"
              orderNumber={order?.order_number}
              error={dispatchError && truckPhotos.length === 0 ? 'Real-time camera photograph with live GPS coordinates of the transport vehicle is mandatory.' : undefined}
              buttonText="Take Real-Time Truck Photo"
            />

            <LivePhotoCaptureField
              label="Loaded Cartons & Container Security Seal Photo"
              required={true}
              photos={cartonPhotos}
              onPhotosChange={setCartonPhotos}
              stageName="Dispatch — Loaded Cartons (Stage 10)"
              orderNumber={order?.order_number}
              error={dispatchError && cartonPhotos.length === 0 ? 'Real-time camera photograph with live GPS coordinates of the loaded cartons & seal is mandatory.' : undefined}
              buttonText="Take Real-Time Carton Load Photo"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" size="sm" type="button" onClick={() => setDispatchModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingDispatch}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {savingDispatch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
              <span>Save & Confirm Dispatch</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Image Preview Modal */}
      <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title="Dispatch Evidence Viewer" size="lg">
        {previewImage && (
          <div className="flex flex-col items-center">
            <img src={previewImage} alt="Dispatch proof" className="max-h-[75vh] w-auto object-contain rounded-lg" />
          </div>
        )}
      </Modal>

      {/* PDF Document Preview Modal */}
      {previewPdfDoc && (
        <Modal
          isOpen={!!previewPdfDoc}
          onClose={() => setPreviewPdfDoc(null)}
          title={`E-Way Bill Document — ${previewPdfDoc.title}`}
          size="xl"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <FileText className="w-4 h-4 text-rose-600" />
                <span className="font-semibold">{previewPdfDoc.title}</span>
                {previewPdfDoc.size && <span className="text-slate-400 font-mono">({previewPdfDoc.size})</span>}
              </div>
              <a
                href={previewPdfDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Window</span>
              </a>
            </div>

            <div className="w-full h-[65vh] sm:h-[72vh] rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
              <iframe
                src={previewPdfDoc.url}
                title="E-Way Bill PDF Document"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
