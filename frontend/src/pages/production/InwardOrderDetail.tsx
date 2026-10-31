// src/pages/production/InwardOrderDetail.tsx
// Stage 03: Material Inward & Receive Management Workspace with Proof Photo Capture
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStageBackNavigation } from '../../utils/navigation';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, PurchaseOrder } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import PendingApprovalBanner from '../../components/production/PendingApprovalBanner';
import StageModificationModal from '../../components/production/StageModificationModal';
import { LivePhotoCaptureField } from '../../components/production/LivePhotoCaptureField';
import {
  ArrowLeft,
  PackageOpen,
  RefreshCw,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertCircle,
  Truck,
  FileText,
  Camera,
  Image as ImageIcon,
  Eye,
  Trash2,
  X,
  ZoomIn,
  Download,
  ShieldCheck,
  ShoppingCart,
  Boxes,
  Droplets,
  Edit3
} from 'lucide-react';

const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n || 0);

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

// Helper to compress and convert image file to lightweight Base64 data URL
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
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(event.target?.result as string);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export default function InwardOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const handleBack = useStageBackNavigation('/production/inward');

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [existingPOs, setExistingPOs] = useState<PurchaseOrder[]>([]);
  const [allReceipts, setAllReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [modModalOpen, setModModalOpen] = useState(false);
  const [selectedRecordForMod, setSelectedRecordForMod] = useState<{
    type: string;
    id: number;
    identifier?: string;
    data?: any;
  } | null>(null);

  // Inward Receive Modal State
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<number, string>>({});
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});
  const [dcNumber, setDcNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [receivedBy, setReceivedBy] = useState('');
  const [condition, setCondition] = useState('Good');
  const [remarks, setRemarks] = useState('');
  const [savingReceive, setSavingReceive] = useState(false);
  const [receiveError, setReceiveError] = useState('');

  // Photo Proof State
  const [photoProof, setPhotoProof] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Lightbox Modal for Photo Proof preview
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string; dcNo?: string; grnNo?: string } | null>(null);

  // Advance to Stage 04 (Dyeing) Modal
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [selectedNextStageId, setSelectedNextStageId] = useState('4');
  const [advanceNotes, setAdvanceNotes] = useState('');
  const [savingAdvance, setSavingAdvance] = useState(false);

  // Accordions
  const [showPOList, setShowPOList] = useState(true);
  const [showHistory, setShowHistory] = useState(true);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [orderRes, stgData, poRes, receiptsRes] = await Promise.all([
        api.getProductionOrder(Number(id)),
        api.getProductionStages().catch(() => []),
        api.getPurchaseOrders().catch(() => []),
        api.getReceipts().catch(() => []),
      ]);

      const ord = (orderRes as any)?.data || orderRes;
      setOrder(ord);
      setStages((stgData || []) as ProductionStage[]);

      const allPOs = (poRes || []) as PurchaseOrder[];
      const ordNum = ord?.order_number || '';
      const related = allPOs.filter(po => {
        if (po.production_order_id && String(po.production_order_id) === String(id)) return true;
        if (po.production_order_number && po.production_order_number === ordNum) return true;
        if (po.remarks && ordNum && po.remarks.includes(ordNum)) return true;
        if (Array.isArray(po.items) && ordNum && po.items.some((it: any) => it.order_no === ordNum)) return true;
        return false;
      });
      const detailedRelated = await Promise.all(
        related.map(async (p) => {
          if (Array.isArray(p.items) && p.items.length > 0) return p;
          try {
            const full = await api.getPurchaseOrder(p.id);
            const data = (full as any)?.data || full;
            return {
              ...p,
              items: Array.isArray(data?.items) ? data.items : p.items || [],
              receipts: Array.isArray(data?.receipts) ? data.receipts : p.receipts || [],
            };
          } catch {
            return p;
          }
        })
      );
      setExistingPOs(detailedRelated);

      // Collect receipts for this project
      const rawReceipts = (receiptsRes as any)?.data || receiptsRes || [];
      const relReceipts = (Array.isArray(rawReceipts) ? rawReceipts : []).filter((r: any) => {
        if (r.production_order_id && String(r.production_order_id) === String(id)) return true;
        if (r.production_order_number && r.production_order_number === ordNum) return true;
        if (detailedRelated.some(p => p.id === r.po_id || p.po_number === r.po_number)) return true;
        return false;
      });

      // Also gather directly from related PO receipts array
      const allPoReceipts: any[] = [];
      detailedRelated.forEach(p => {
        (p.receipts || []).forEach((r: any) => {
          allPoReceipts.push({
            ...r,
            po_id: p.id,
            po_number: p.po_number,
            supplier_name: p.supplier_name,
            category_name: p.category_name,
          });
        });
      });

      // Merge and deduplicate by receipt_no
      const map = new Map<string, any>();
      [...allPoReceipts, ...relReceipts].forEach(r => {
        const key = r.receipt_no || `${r.id}_${r.po_number}`;
        if (!map.has(key)) map.set(key, r);
      });
      setAllReceipts(Array.from(map.values()));
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load Stage 03 Inward data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Open Inward Receive Modal for a PO
  const handleOpenReceive = async (po: PurchaseOrder) => {
    let currentPO = po;
    if (!currentPO.items || currentPO.items.length === 0) {
      try {
        const full = await api.getPurchaseOrder(po.id);
        const data = (full as any)?.data || full;
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          currentPO = {
            ...po,
            items: data.items,
            receipts: data.receipts || po.receipts || [],
          };
        }
      } catch (err) {
        console.warn('Could not load full PO items', err);
      }
    }

    setSelectedPO(currentPO);
    const initialQty: Record<number, string> = {};
    (currentPO.items || []).forEach(it => {
      if (it.id) {
        const ordered = Number(it.quantity || 0);
        const prevRecv = Number(it.received_quantity || 0);
        const remaining = Math.max(0, ordered - prevRecv);
        initialQty[it.id] = remaining > 0.0001 ? String(remaining) : '';
      }
    });
    setReceiveQuantities(initialQty);
    setItemErrors({});
    setDcNumber(`DC-${Math.floor(1000 + Math.random() * 9000)}`);
    setVehicleNumber('');
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setReceivedBy('Stores Executive');
    setCondition('Good & Verified');
    setRemarks(`Material inward received against PO ${currentPO.po_number}`);
    setPhotoProof(null);
    setPhotoName('');
    setReceiveError('');
    setReceiveModalOpen(true);
  };

  // Filter items for the inward modal:
  // Hide already fully received items, unless all items are fully received (for "Inward Additional")
  const modalReceiveItems = useMemo(() => {
    if (!selectedPO || !selectedPO.items) return [];
    const pending = selectedPO.items.filter(it => {
      const ordered = Number(it.quantity || 0);
      const prevRecv = Number(it.received_quantity || 0);
      return (ordered - prevRecv) > 0.0001;
    });
    return pending.length > 0 ? pending : selectedPO.items;
  }, [selectedPO]);

  const handleQtyChange = (itemId: number, valStr: string, remaining: number, desc: string, uom: string) => {
    setReceiveQuantities(f => ({ ...f, [itemId]: valStr }));
    
    if (valStr === '' || valStr === undefined) {
      setItemErrors(errs => {
        const copy = { ...errs };
        delete copy[itemId];
        return copy;
      });
      return;
    }

    const val = Number(valStr);
    if (isNaN(val)) {
      setItemErrors(errs => ({ ...errs, [itemId]: `Invalid quantity entered for ${desc}.` }));
    } else if (val < 0) {
      setItemErrors(errs => ({ ...errs, [itemId]: `Receive quantity for ${desc} cannot be negative.` }));
    } else if (val > remaining + 0.0001) {
      setItemErrors(errs => ({
        ...errs,
        [itemId]: `Receive quantity for ${desc} cannot exceed the remaining ordered quantity of ${remaining} ${uom}.`
      }));
    } else {
      setItemErrors(errs => {
        const copy = { ...errs };
        delete copy[itemId];
        return copy;
      });
    }
  };

  const handleSetMaxQty = (itemId: number, remaining: number, desc: string, uom: string) => {
    handleQtyChange(itemId, String(remaining), remaining, desc, uom);
  };

  // Handle Photo selection / capture
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhotoName(file.name);
      const dataUrl = await processImageFile(file);
      setPhotoProof(dataUrl);
    } catch {
      setReceiveError('Failed to process image file');
    }
  };

  // Submit Inward Receipt
  const handleSubmitInward = async () => {
    if (!selectedPO) return;
    setReceiveError('');

    // Check if there are any lingering item errors
    const errorKeys = Object.keys(itemErrors);
    if (errorKeys.length > 0) {
      setReceiveError('Please resolve all quantity errors before recording receipt.');
      return;
    }

    // Verify all entered quantities against remaining ordered quantities
    let hasQuantityToReceive = false;
    const newErrors: Record<number, string> = {};

    for (const it of modalReceiveItems) {
      const rawVal = receiveQuantities[it.id!];
      const val = Number(rawVal || 0);
      const ordered = Number(it.quantity || 0);
      const prevRecv = Number(it.received_quantity || 0);
      const remaining = Math.max(0, ordered - prevRecv);
      const desc = it.item_description || it.description || `Item #${it.id}`;
      const uom = it.uom || 'units';

      if (rawVal !== undefined && rawVal !== '' && isNaN(val)) {
        newErrors[it.id!] = `Invalid number format for ${desc}.`;
      } else if (val < 0) {
        newErrors[it.id!] = `Receive quantity for ${desc} cannot be negative.`;
      } else if (val > remaining + 0.0001) {
        newErrors[it.id!] = `Receive quantity for ${desc} cannot exceed the remaining ordered quantity of ${remaining} ${uom}.`;
      } else if (val > 0) {
        hasQuantityToReceive = true;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setItemErrors(newErrors);
      setReceiveError('Cannot submit: One or more receiving quantities exceed allowed remaining limits.');
      return;
    }

    if (!hasQuantityToReceive) {
      setReceiveError('Please enter a receive quantity greater than 0 for at least one item.');
      return;
    }

    if (!photoProof) {
      setReceiveError('Real-time camera photograph with live GPS coordinates is mandatory before confirming material inward receipt.');
      return;
    }

    setSavingReceive(true);
    try {
      const itemsToReceive = modalReceiveItems
        .map(it => {
          const q = Number(receiveQuantities[it.id!] || 0);
          return {
            purchase_order_item_id: it.id,
            item_id: it.id,
            item_description: it.item_description || it.description || 'Material',
            quantity_received: q,
            received_quantity: q,
          };
        })
        .filter(it => it.quantity_received > 0);

      const payload = {
        delivery_challan_no: dcNumber || undefined,
        challan_no: dcNumber || undefined,
        vehicle_no: vehicleNumber || undefined,
        receipt_date: receiptDate || new Date().toISOString().split('T')[0],
        received_by: receivedBy || 'Stores Executive',
        condition: condition || 'Good & Verified',
        remarks: remarks || undefined,
        photo_url: photoProof || undefined,
        photo_proof: photoProof || undefined,
        items: itemsToReceive,
      };

      await api.receiveGoods(selectedPO.id, payload);
      setSuccessToast(`Material Inward recorded for PO ${selectedPO.po_number}! Proof photo attached.`);
      setReceiveModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setReceiveError((err as Error).message || 'Failed to record material inward receipt.');
    } finally {
      setSavingReceive(false);
    }
  };

  // Advance Order to Stage 04 (Dyeing)
  const handleAdvanceToNextStage = async () => {
    if (!order || !order.items || order.items.length === 0) return;
    setSavingAdvance(true);
    try {
      const nextStage = stages.find(s => s.code === 'DYE' || String(s.id) === selectedNextStageId) || { id: 4 };
      await Promise.all(
        order.items.map(it =>
          api.moveStage({
            order_item_id: it.id,
            to_stage_id: nextStage.id,
            quantity_moved: it.total_quantity || it.current_stage_quantity || 1,
            remarks: advanceNotes || 'Materials received and verified. Proceeding to Dyeing stage.',
          })
        )
      );
      setSuccessToast(`Order ${order.order_number} successfully advanced to Stage 04: Dyeing!`);
      setAdvanceModalOpen(false);
      navigate('/production/dyeing');
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to advance order stage');
    } finally {
      setSavingAdvance(false);
    }
  };

  // Aggregate Calculations
  const allPOItems = existingPOs.flatMap(p =>
    (p.items || []).map(it => ({
      ...it,
      po_id: p.id,
      po_number: p.po_number,
      supplier_name: p.supplier_name,
      category_name: p.category_name,
      po_status: p.status,
    }))
  );

  const totalOrderedItems = allPOItems.length;
  const totalOrderedUnits = allPOItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const totalReceivedUnits = allPOItems.reduce((sum, it) => sum + Number(it.received_quantity || 0), 0);
  const pendingUnits = Math.max(0, totalOrderedUnits - totalReceivedUnits);
  const progressPercent = totalOrderedUnits > 0 ? Math.min(100, Math.round((totalReceivedUnits / totalOrderedUnits) * 100)) : 0;

  const fabricPOItems = allPOItems.filter(it => 
    (it.category_name || '').toUpperCase().includes('FABRIC') ||
    (it.item_description || '').toUpperCase().includes('FABRIC') ||
    (it.item_description || '').toUpperCase().includes('MAT-FAB')
  );
  const totalFabricInwarded = fabricPOItems.reduce((sum, it) => sum + Number(it.received_quantity || 0), 0);
  const totalFabricOrdered = fabricPOItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-xs font-semibold">Loading Stage 03: Material Inward Workspace...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 m-4">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-800">Order Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">Unable to locate production order #{id}.</p>
        <Button onClick={handleBack} className="mt-4 text-xs">
          Return to Inward Stage
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title={`Stage 03: Material Inward & Proof — ${order.order_number}`}
        subtitle={`Order Title: ${order.title || 'Production Order'} • Buyer: ${order.customer_name || 'Direct Buyer'} • Receive & Manage Material Inward`}
        breadcrumb={[
          { label: 'Production', href: '/production/orders' },
          { label: '03. Inward Stage', href: '/production/inward' },
          { label: order.order_number },
        ]}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleBack}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Back to Inward Stage</span>
              <span className="inline sm:hidden">Back</span>
            </button>

            <button
              onClick={loadData}
              title="Refresh Inward Data"
              className="p-1.5 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <Button
              variant="outline"
              icon={<Edit3 className="w-3.5 h-3.5 text-slate-600" />}
              onClick={() => {
                setSelectedRecordForMod(null);
                setModModalOpen(true);
              }}
              className="text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50"
            >
              <span className="hidden sm:inline">Request Modification</span>
              <span className="inline sm:hidden">Edit</span>
            </Button>

            <Button
              icon={<ChevronRight className="w-4 h-4 stroke-[2.5]" />}
              onClick={() => setAdvanceModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs whitespace-nowrap"
            >
              <span className="hidden sm:inline">Advance to Stage 04: Dyeing</span>
              <span className="inline sm:hidden">To Dyeing</span>
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-5 max-w-7xl mx-auto w-full space-y-4">
        {/* Pending Approval Banner */}
        <PendingApprovalBanner orderId={Number(order.id)} stageId={3} />

        {/* Project Master Info Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <BuyerAvatar
              buyer={{
                id: order.customer_id,
                code: order.customer_code,
                name: order.customer_name,
                avatar_style: order.customer_avatar_style,
                avatar_seed: order.customer_avatar_seed,
                avatar_config: order.customer_avatar_config,
              }}
              size="lg"
              shape="circle"
              className="shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-sm text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                  {order.order_number}
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {order.customer_name || 'Direct Buyer'}
                </span>
                <StatusBadge status={order.priority || 'Medium'} />
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <PackageOpen className="w-3 h-3" />
                  Current Stage: 03. Inward
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600 truncate mt-1">
                {order.title || 'Production Order'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs shrink-0 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0 w-full md:w-auto justify-between md:justify-end">
            <div>
              <span className="text-[10px] text-slate-400 block font-medium uppercase">Target Delivery</span>
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {order.target_delivery_date || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium uppercase">Garment Units</span>
              <span className="font-mono font-bold text-sm text-brand-700">
                {fmt(order.items?.reduce((s, it) => s + (it.total_quantity || 0), 0) || 0)}{' '}
                <span className="text-xs font-normal text-slate-500">pcs</span>
              </span>
            </div>
          </div>
        </div>

        {/* 4 Inward Workspace KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Purchase Orders</p>
              <p className="text-lg font-bold text-slate-800 mt-0.5">
                {existingPOs.length}{' '}
                <span className="text-xs font-normal text-slate-400">POs issued</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Inward Received</p>
              <p className="text-lg font-bold text-emerald-600 mt-0.5">
                {fmt(totalReceivedUnits)}{' '}
                <span className="text-xs font-normal text-slate-400">/ {fmt(totalOrderedUnits)} units</span>
              </p>
              <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <PackageOpen className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Pending Remaining</p>
              <p className="text-lg font-bold text-amber-600 mt-0.5">
                {fmt(pendingUnits)}{' '}
                <span className="text-xs font-normal text-slate-400">units to inward</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Boxes className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Proof Photos Logged</p>
              <p className="text-lg font-bold text-indigo-600 mt-0.5">
                {allReceipts.filter(r => r.photo_url).length}{' '}
                <span className="text-xs font-normal text-slate-400">/ {allReceipts.length} GRNs</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Camera className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* STAGE 04 FABRIC DYEING PIPELINE SHORTCUT */}
        {totalFabricInwarded > 0 && (
          <div className="bg-brand-50/70 border border-brand-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-100 px-2 py-0.5 rounded">
                    Next Stage: 04. Dyeing
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {fmt(totalFabricInwarded)} MTR Fabric Inwarded
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Only fabric materials are sent to dyeing. Create a Dyeing Order to split your {fmt(totalFabricInwarded)} MTR fabric by color & Pantone code (e.g. Green 20, Red 20, Orange 20, White 20, Black 20).
                </p>
              </div>
            </div>

            <Button
              onClick={() => navigate(`/production/dyeing/${order.id}`)}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-2xs shrink-0 self-end sm:self-auto"
            >
              <Droplets className="w-3.5 h-3.5 mr-1.5" />
              <span>Create Dyeing Order & Track Outward</span>
            </Button>
          </div>
        )}

        {/* SECTION 1: INWARD MATERIAL MANAGEMENT & PO ITEMS RECEIVING */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div
            onClick={() => setShowPOList(!showPOList)}
            className="p-4 bg-slate-50/90 border-b border-slate-200 cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <PackageOpen className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Purchase Orders & Materials to Inward ({existingPOs.length} POs • {allPOItems.length} Material Lines)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500">
                {progressPercent}% Complete
              </span>
              {showPOList ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </div>

          {showPOList && (
            <div className="p-4 space-y-4">
              {existingPOs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                  No Purchase Orders linked to this production project yet. Please issue POs in Stage 02 first.
                </div>
              ) : (
                existingPOs.map(po => {
                  const items = po.items || [];
                  const poOrdered = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
                  const poReceived = items.reduce((s, it) => s + Number(it.received_quantity || 0), 0);
                  const poPending = Math.max(0, poOrdered - poReceived);
                  const isFullyInwarded = poOrdered > 0 && poReceived >= poOrdered;

                  return (
                    <div
                      key={po.id}
                      className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs"
                    >
                      {/* PO Header Bar */}
                      <div className="p-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {po.po_number}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {po.supplier_name}
                          </span>
                          {po.category_name && (
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {po.category_name}
                            </span>
                          )}
                          {isFullyInwarded ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Fully Inwarded
                            </span>
                          ) : poReceived > 0 ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Partially Received ({fmt(poReceived)} / {fmt(poOrdered)})
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              Pending Inward
                            </span>
                          )}
                        </div>

                        {/* Inward Receive Action Button */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="xs"
                            onClick={() => handleOpenReceive(po)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs"
                            icon={<PackageOpen className="w-3.5 h-3.5" />}
                          >
                            <span>{isFullyInwarded ? 'Inward Additional' : 'Receive & Proof'}</span>
                          </Button>

                          <button
                            type="button"
                            onClick={() => navigate(`/purchase/orders/${po.id}`)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
                            title="View PO document"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Mobile Card Layout for PO Items */}
                      <div className="block sm:hidden divide-y divide-slate-100">
                        {items.map((it, idx) => {
                          const ordered = Number(it.quantity || 0);
                          const received = Number(it.received_quantity || 0);
                          const rem = Math.max(0, ordered - received);
                          const done = ordered > 0 && received >= ordered;

                          return (
                            <div key={it.id || idx} className="p-3 bg-white space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="font-bold text-xs text-slate-800 block truncate">
                                    {it.item_description || it.description || 'Raw Material Item'}
                                  </span>
                                  {it.spec && <span className="text-[10px] text-slate-400 block truncate">{it.spec}</span>}
                                </div>
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">
                                  {it.uom || 'PCS'}
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-1.5 py-1.5 px-2 bg-slate-50 rounded-lg text-center">
                                <div>
                                  <span className="text-[9px] text-slate-400 block font-semibold uppercase">Ordered</span>
                                  <span className="font-mono font-bold text-xs text-slate-700">{fmt(ordered)}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-emerald-600 block font-semibold uppercase">Received</span>
                                  <span className="font-mono font-bold text-xs text-emerald-600">{fmt(received)}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-amber-700 block font-semibold uppercase">Balance</span>
                                  <span className="font-mono font-bold text-xs text-amber-700">{fmt(rem)}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] pt-0.5">
                                <span className="text-[10px] text-slate-400 font-mono">Item #{idx + 1}</span>
                                {done ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                    Complete
                                  </span>
                                ) : received > 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Partial Inward
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                    Pending Inward
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Line Items Table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                            <tr>
                              <th className="py-2 px-3 w-10 text-center">#</th>
                              <th className="py-2 px-3 min-w-[200px]">Item Description & Code</th>
                              <th className="py-2 px-3 w-20 text-center">UOM</th>
                              <th className="py-2 px-3 w-24 text-right">Ordered Qty</th>
                              <th className="py-2 px-3 w-24 text-right">Inward Recv</th>
                              <th className="py-2 px-3 w-24 text-right">Remaining</th>
                              <th className="py-2 px-3 w-32 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {items.map((it, idx) => {
                              const ordered = Number(it.quantity || 0);
                              const received = Number(it.received_quantity || 0);
                              const rem = Math.max(0, ordered - received);
                              const done = ordered > 0 && received >= ordered;

                              return (
                                <tr key={it.id || idx} className="hover:bg-slate-50/60 transition">
                                  <td className="py-2 px-3 text-center font-mono text-slate-400 text-[11px]">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className="font-semibold text-slate-800 block">
                                      {it.item_description || it.description || 'Raw Material Item'}
                                    </span>
                                    {it.spec && (
                                      <span className="text-[10px] text-slate-400 block">{it.spec}</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono text-slate-600">
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-bold">
                                      {it.uom || 'PCS'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">
                                    {fmt(ordered)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                                    {fmt(received)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">
                                    {fmt(rem)}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    {done ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                        Complete
                                      </span>
                                    ) : received > 0 ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        Partial
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                        Pending
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: MATERIAL INWARD RECEIPTS (GRN) & PROOF PHOTOS HISTORY */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div
            onClick={() => setShowHistory(!showHistory)}
            className="p-4 bg-slate-50/90 border-b border-slate-200 cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Inward Proof History & GRN Delivery Receipts ({allReceipts.length} Batches)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400">
                {allReceipts.filter(r => r.photo_url).length} Photos Attached
              </span>
              {showHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </div>

          {showHistory && (
            <div className="p-4">
              {allReceipts.length === 0 ? (
                <div className="p-10 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                  <Camera className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-xs font-bold text-slate-700">No Inward Proof Photos Recorded Yet</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    When materials arrive at your factory, click &quot;Receive & Proof&quot; above to log the DC number, inward quantity, and take a photo of the physical proof.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allReceipts.map((rc, idx) => (
                    <div
                      key={rc.id || idx}
                      className="border border-slate-200 rounded-xl p-4 bg-white hover:border-indigo-300 transition shadow-2xs flex flex-col justify-between"
                    >
                      <div>
                        {/* Header: GRN & Date */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                          <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {rc.receipt_no || `GRN-${idx + 1}`}
                          </span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {rc.receipt_date || 'Today'}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="space-y-1.5 text-xs text-slate-600 font-medium">
                          <div className="flex justify-between">
                            <span className="text-slate-400 text-[11px]">PO Number:</span>
                            <span className="font-mono font-bold text-slate-800">{rc.po_number || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 text-[11px]">Supplier:</span>
                            <span className="text-slate-800 truncate max-w-[170px]">{rc.supplier_name || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 text-[11px]">DC / Challan No:</span>
                            <span className="font-mono font-bold text-emerald-700">{rc.delivery_challan_no || rc.challan_no || '—'}</span>
                          </div>
                          {rc.vehicle_no && (
                            <div className="flex justify-between">
                              <span className="text-slate-400 text-[11px]">Vehicle:</span>
                              <span className="font-mono text-slate-700">{rc.vehicle_no}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-400 text-[11px]">Inward Qty:</span>
                            <span className="font-mono font-bold text-brand-700 text-sm">{fmt(rc.quantity_received)} units</span>
                          </div>
                          {rc.remarks && (
                            <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 italic mt-2">
                              &ldquo;{rc.remarks}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Photo Proof Area */}
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        {rc.photo_url ? (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              Physical Proof Photo Attached
                            </span>
                            <div
                              onClick={() =>
                                setPreviewPhoto({
                                  url: rc.photo_url,
                                  title: `Proof Photo for ${rc.receipt_no || 'Inward'}`,
                                  dcNo: rc.delivery_challan_no || rc.challan_no,
                                  grnNo: rc.receipt_no,
                                })
                              }
                              className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer aspect-video flex items-center justify-center"
                            >
                              <img
                                src={rc.photo_url}
                                alt="Delivery Proof"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                                <ZoomIn className="w-4 h-4" />
                                <span>View Full Photo</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 rounded bg-slate-50 border border-dashed border-slate-200 text-center text-[10px] text-slate-400">
                            No photo proof attached for this GRN
                          </div>
                        )}
                      </div>

                      {/* Post-Completion Edit Action */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-medium">Historical Inward Record</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRecordForMod({
                              type: 'receipts',
                              id: rc.id,
                              identifier: rc.receipt_no || `GRN #${rc.id}`,
                              data: rc,
                            });
                            setModModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-brand-700 bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-300 rounded-lg transition shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-brand-600" />
                          <span>Edit / Modify</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL: INWARD RECEIVE MATERIALS & TAKE PROOF PHOTO */}
      {/* ===================================================================== */}
      <Modal
        open={receiveModalOpen}
        onClose={() => { if (!savingReceive) setReceiveModalOpen(false); }}
        title={`Material Inward & Proof — ${selectedPO?.po_number}`}
        subtitle={`Supplier: ${selectedPO?.supplier_name || '—'} | PO Date: ${selectedPO?.po_date || '—'}`}
        size="full"
        className="max-w-[94vw] xl:max-w-7xl max-h-[92vh] flex flex-col"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-500">
              {Object.keys(itemErrors).length > 0 ? (
                <span className="text-red-600 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {Object.keys(itemErrors).length} line item(s) have quantity validation errors.
                </span>
              ) : (
                <span className="text-slate-500">
                  Enter receiving quantities for items arriving in this consignment.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setReceiveModalOpen(false)} disabled={savingReceive}>
                Cancel
              </Button>
              <Button
                loading={savingReceive}
                onClick={handleSubmitInward}
                disabled={Object.keys(itemErrors).length > 0}
                icon={<PackageOpen className="w-3.5 h-3.5" />}
              >
                Confirm Inward & Save
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {receiveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{receiveError}</span>
            </div>
          )}

          {/* Section B: Inward Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                DC / Challan No.
              </label>
              <input
                type="text"
                value={dcNumber}
                onChange={e => setDcNumber(e.target.value)}
                placeholder="e.g. DC-1042"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Inward Date
              </label>
              <input
                type="date"
                value={receiptDate}
                onChange={e => setReceiptDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Vehicle / Transport
              </label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={e => setVehicleNumber(e.target.value)}
                placeholder="e.g. TN 38 BX 4102"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Received By
              </label>
              <input
                type="text"
                value={receivedBy}
                onChange={e => setReceivedBy(e.target.value)}
                placeholder="e.g. Stores Executive"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Completed Materials Notice if hidden */}
          {selectedPO && selectedPO.items && selectedPO.items.length > modalReceiveItems.length && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between text-emerald-800">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>{selectedPO.items.length - modalReceiveItems.length}</strong> fully received material{selectedPO.items.length - modalReceiveItems.length > 1 ? 's are' : ''} completed and hidden. Showing only materials with pending remaining quantity.
                </span>
              </span>
              <span className="text-[11px] font-mono text-emerald-700 font-bold bg-white px-2 py-0.5 rounded border border-emerald-300">
                {modalReceiveItems.length} pending to receive
              </span>
            </div>
          )}

          {/* Section C: Material Items Table */}
          <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-3 text-center w-12">#</th>
                    <th className="py-3 px-4 min-w-[280px]">Material Description</th>
                    <th className="py-3 px-3 text-right w-28">Ordered Qty</th>
                    <th className="py-3 px-3 text-center w-20">UOM</th>
                    <th className="py-3 px-3 text-right w-36">Previously Received</th>
                    <th className="py-3 px-3 text-right w-32">Remaining Qty</th>
                    <th className="py-3 px-4 text-right min-w-[220px] w-56">Receive Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs bg-white">
                  {modalReceiveItems.map((it, i) => {
                    const ordered = Number(it.quantity || 0);
                    const prevRecv = Number(it.received_quantity || 0);
                    const remaining = Math.max(0, ordered - prevRecv);
                    const desc = it.item_description || it.description || `Item #${i + 1}`;
                    const code = (it as any).material_code || (it as any).item_code;
                    const uom = it.uom || 'units';
                    const itemError = itemErrors[it.id!];
                    const isFullyRecv = remaining <= 0.0001;

                    return (
                      <tr key={it.id || i} className={isFullyRecv ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'}>
                        <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {i + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 text-xs leading-relaxed">
                            {desc}
                          </div>
                          {(code || it.spec) && (
                            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                              {[code ? `Code: ${code}` : '', it.spec ? `Spec: ${it.spec}` : ''].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                          {fmt(ordered)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
                            {uom}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-slate-600">
                          {fmt(prevRecv)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold">
                          {isFullyRecv ? (
                            <span className="text-slate-400">0.00</span>
                          ) : (
                            <span className="text-amber-600">{fmt(remaining)}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isFullyRecv ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Fully Received
                            </span>
                          ) : (
                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-1.5 w-full justify-end">
                                <input
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  step="any"
                                  placeholder="0.00"
                                  value={receiveQuantities[it.id!] ?? ''}
                                  onChange={e => handleQtyChange(it.id!, e.target.value, remaining, desc, uom)}
                                  className={`w-28 px-2.5 py-1.5 text-xs text-right font-mono font-semibold rounded border transition-colors focus:outline-none ${
                                    itemError
                                      ? 'border-red-500 bg-red-50/30 text-red-700 focus:border-red-600'
                                      : 'border-slate-300 bg-white text-slate-800 focus:border-brand-500'
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSetMaxQty(it.id!, remaining, desc, uom)}
                                  title="Fill remaining quantity"
                                  className="px-2 py-1 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 transition-colors shrink-0"
                                >
                                  Max
                                </button>
                              </div>
                              {itemError && (
                                <p className="text-[11px] text-red-600 mt-1.5 text-right font-medium leading-tight max-w-xs">
                                  {itemError}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section D & E: Quality, Remarks & Photo Proof Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Quality / Condition Check
              </label>
              <select
                value={condition}
                onChange={e => setCondition(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-brand-500"
              >
                <option value="Good & Verified">Good Condition & Count Verified</option>
                <option value="Accepted with Minor Discrepancy">Accepted with Minor Discrepancy</option>
                <option value="Damaged Packages Recorded">Damaged Packages Recorded</option>
                <option value="Partial Lot Accepted">Partial Lot Accepted</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Remarks / Store Notes
              </label>
              <input
                type="text"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="e.g. Unloaded at Bay 2, verified by Stores"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Mandatory Live Camera Photo Proof */}
            <LivePhotoCaptureField
              label="Delivery Challan & Material Inward Physical Proof Photo"
              required={true}
              photo={photoProof}
              onPhotoChange={(url) => {
                setPhotoProof(url);
                setPhotoName(url ? 'Real-Time Inward Proof' : '');
              }}
              stageName="Material Inward (Stage 03)"
              orderNumber={selectedPO?.po_number}
              error={receiveError && !photoProof ? 'Real-time camera photograph with live GPS coordinates is mandatory before confirming material inward receipt.' : undefined}
              buttonText="Take Real-Time Inward Photo"
              helperText="Physical proof of delivery challan and received materials must be captured live via device camera. File upload is disabled."
            />
          </div>
        </div>
      </Modal>

      {/* ===================================================================== */}
      {/* LIGHTBOX: VIEW FULL PROOF PHOTO MODAL */}
      {/* ===================================================================== */}
      <Modal
        open={!!previewPhoto}
        onClose={() => setPreviewPhoto(null)}
        title={previewPhoto?.title || 'Proof Document'}
        subtitle={previewPhoto?.dcNo ? `Challan No: ${previewPhoto.dcNo}` : undefined}
        size="2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-400">Material Inward Physical Proof Document</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setPreviewPhoto(null)}>
                Close
              </Button>
              {previewPhoto?.url && (
                <a
                  href={previewPhoto.url}
                  download="Proof_Document.jpg"
                  className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              )}
            </div>
          </div>
        }
      >
        {previewPhoto && (
          <div className="flex justify-center p-2 bg-slate-900/90 rounded-lg">
            <img src={previewPhoto.url} alt="Proof" className="max-h-[65vh] w-auto max-w-full rounded object-contain" />
          </div>
        )}
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL: ADVANCE ORDER TO STAGE 04 (DYEING) */}
      {/* ===================================================================== */}
      <Modal
        open={advanceModalOpen}
        onClose={() => { if (!savingAdvance) setAdvanceModalOpen(false); }}
        title="Advance Order to Stage 04: Dyeing"
        subtitle={`Order: ${order.order_number} (${order.customer_name || 'Buyer'})`}
        size="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 w-full">
            <Button
              variant="secondary"
              disabled={savingAdvance}
              onClick={() => setAdvanceModalOpen(false)}
              className="flex-1 sm:flex-none min-h-[42px] sm:min-h-0"
            >
              Cancel
            </Button>
            <Button
              loading={savingAdvance}
              onClick={handleAdvanceToNextStage}
              className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold min-h-[42px] sm:min-h-0"
              icon={<ChevronRight className="w-4 h-4" />}
            >
              Advance to Stage 04 (Dyeing)
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-1 text-xs text-slate-600">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 leading-relaxed">
            <p className="font-semibold text-emerald-950 mb-1">
              Ready to proceed with fabric dyeing?
            </p>
            <p>
              Advancing will transition all items in this order to{' '}
              <strong className="text-emerald-800">Stage 04: Dyeing</strong>.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Order Number:</span>
              <span className="font-bold text-slate-800">{order.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Inward Status:</span>
              <span className="font-bold text-emerald-700">
                {totalReceivedUnits} / {totalOrderedUnits} units received ({progressPercent}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Proof Photos:</span>
              <span className="text-indigo-700 font-bold">
                {allReceipts.filter(r => r.photo_url).length} Photos Logged
              </span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">
              Stage Movement Remarks
            </label>
            <input
              type="text"
              value={advanceNotes}
              onChange={e => setAdvanceNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </Modal>

      {/* Stage 03 Inward Modification Request Modal */}
      {order && (
        <StageModificationModal
          isOpen={modModalOpen}
          onClose={() => {
            setModModalOpen(false);
            setSelectedRecordForMod(null);
          }}
          orderId={Number(order.id)}
          orderNumber={order.order_number}
          orderTitle={order.title}
          stageId={3}
          stageName="03. Inward"
          targetRecord={selectedRecordForMod}
          currentSnapshot={{
            order_title: order.title,
            target_delivery_date: order.target_delivery_date,
            priority: order.priority,
            receipts: allReceipts,
            purchase_orders: existingPOs,
            notes: order.notes,
          }}
          onSuccess={() => {
            setSuccessToast('Modification request submitted to Admin for approval!');
            loadData();
          }}
        />
      )}
    </div>
  );
}
