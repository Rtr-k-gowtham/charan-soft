// src/pages/production/StitchingOrderDetail.tsx
// Stage 07: Stitching — Color-wise Tracking, Batch Management, Yield Reconciliation & Output Transfer
// Redesigned to strict Cheran Soft Goods ERP design system:
// - Clean table layout matching CuttingOrderDetail & EmbroideryOrderDetail
// - Ordered products arrive from both Cutting and Embroidery stages
// - Auto-fetched and read-only Assigned Quantity in batch recording form
// - Integrated Rework & Alteration table directly below Stitching Batches
// - 3-Dot floating menus for Batches (Inspect, Transfer, Rework, View) and Rework (Receive, Transfer, View)
// - Synchronized available in hand quantity calculations across Batches and Rework
// - Direct transfer to Stage 08 Checking
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useStageBackNavigation } from '../../utils/navigation';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, StitchingBatch, ReworkRecord } from '../../types';
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
  AlertCircle,
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
  RotateCcw,
  MoreVertical,
  Search
} from 'lucide-react';
import StageInspectionModal from '../../components/production/StageInspectionModal';

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
  const [reworkRecords, setReworkRecords] = useState<ReworkRecord[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [filterMode, setFilterMode] = useState<'ALL' | 'STITCHING'>('ALL');

  // Search & Filters for Batches Table 1
  const [batchSearch, setBatchSearch] = useState('');
  const [batchStatusFilter, setBatchStatusFilter] = useState('ALL');

  // Search & Filters for Rework Table 2
  const [reworkSearch, setReworkSearch] = useState('');
  const [reworkStatusFilter, setReworkStatusFilter] = useState('ALL');

  // 3-Dot Floating Action Menus
  const [activeBatchMenu, setActiveBatchMenu] = useState<{ top: number; left: number; batch: StitchingBatch } | null>(null);
  const [activeReworkMenu, setActiveReworkMenu] = useState<{ top: number; left: number; record: ReworkRecord } | null>(null);

  // Record Stitching Batch Modal State
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [batchForm, setBatchForm] = useState({
    start_date: new Date().toISOString().split('T')[0],
    completion_date: new Date().toISOString().split('T')[0],
    assigned_quantity: 0,
    completed_quantity: 0,
    remarks: ''
  });
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchError, setBatchError] = useState('');

  // Quality Inspection Modal State (Stage 07: Stitching)
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [selectedBatchForInspect, setSelectedBatchForInspect] = useState<any | null>(null);

  // Transfer to Checking Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<StitchingBatch | null>(null);
  const [transferItem, setTransferItem] = useState<any | null>(null);
  const [transferQuantity, setTransferQuantity] = useState<number>(0);
  const [transferRemarks, setTransferRemarks] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [selectedReworkForTransfer, setSelectedReworkForTransfer] = useState<ReworkRecord | null>(null);

  // Modal: Create Rework & Alteration
  const [reworkModalOpen, setReworkModalOpen] = useState(false);
  const [selectedBatchForRework, setSelectedBatchForRework] = useState<StitchingBatch | null>(null);
  const [reworkForm, setReworkForm] = useState({
    rework_quantity: 1,
    rework_reason: 'Broken / Skipped Stitching',
    dc_challan_no: '',
    expected_return_date: new Date().toISOString().split('T')[0],
    destination_process: 'Alteration & Restitching Line',
    remarks: ''
  });
  const [submittingRework, setSubmittingRework] = useState(false);
  const [reworkError, setReworkError] = useState('');

  // Modal: Inward Receive Reworked Pieces
  const [receiveReworkModalOpen, setReceiveReworkModalOpen] = useState(false);
  const [selectedReworkForReceive, setSelectedReworkForReceive] = useState<ReworkRecord | null>(null);
  const [reworkReceiptChallanNo, setReworkReceiptChallanNo] = useState('');
  const [reworkReceiptDate, setReworkReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [reworkLotNo, setReworkLotNo] = useState('');
  const [reworkReceivedBy, setReworkReceivedBy] = useState('Stitching QC Inspector');
  const [reworkReceivedQty, setReworkReceivedQty] = useState(0);
  const [reworkPhotoUrl, setReworkPhotoUrl] = useState<string | null>(null);
  const [reworkRemarks, setReworkRemarks] = useState('');
  const [reworkReceiveError, setReworkReceiveError] = useState('');
  const [submittingReceiveRework, setSubmittingReceiveRework] = useState(false);

  // Modal: View Batch & View Rework Details
  const [viewBatchModalOpen, setViewBatchModalOpen] = useState(false);
  const [selectedBatchForView, setSelectedBatchForView] = useState<StitchingBatch | null>(null);
  const [viewReworkModalOpen, setViewReworkModalOpen] = useState(false);
  const [selectedReworkForView, setSelectedReworkForView] = useState<ReworkRecord | null>(null);

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
      setReworkRecords(stData.rework_records || []);

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

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveBatchMenu(null);
      setActiveReworkMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

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

  // Active rework quantity currently away at alteration line (not yet accepted or transferred)
  const activeReworkQty = useMemo(() => {
    return reworkRecords
      .filter(
        (r) =>
          r.status !== 'Accepted After Rework' &&
          (r.status as string) !== 'Transferred' &&
          (r.status as string) !== 'Scrapped' &&
          (r.status as string) !== 'Completed'
      )
      .reduce((sum, r) => sum + Number(r.rework_quantity || 0), 0);
  }, [reworkRecords]);

  const getActiveReworkForBatch = (b: StitchingBatch | null) => {
    if (!b) return 0;
    return reworkRecords
      .filter(
        (r) =>
          (r.batch_number === b.batch_number || String(r.reference_id) === String(b.id)) &&
          r.status !== 'Accepted After Rework' &&
          (r.status as string) !== 'Transferred' &&
          (r.status as string) !== 'Scrapped' &&
          (r.status as string) !== 'Completed'
      )
      .reduce((sum, r) => sum + Number(r.rework_quantity || 0), 0);
  };

  const totalAcceptedPieces = useMemo(() => {
    return batches.reduce((sum, b) => sum + Number(b.accepted_quantity || 0), 0);
  }, [batches]);

  const totalTransferredPieces = useMemo(() => {
    return batches.reduce((sum, b) => sum + Number(b.transferred_quantity || 0), 0);
  }, [batches]);

  const overallAvailableForTransfer = useMemo(() => {
    return Math.max(0, totalAcceptedPieces - activeReworkQty - totalTransferredPieces);
  }, [totalAcceptedPieces, activeReworkQty, totalTransferredPieces]);

  const getBatchAvailableForTransfer = (b: StitchingBatch | null) => {
    if (!b) return overallAvailableForTransfer;
    const accepted = Number(b.accepted_quantity || 0);
    const transferred = Number(b.transferred_quantity || 0);
    const batchActiveRework = getActiveReworkForBatch(b);
    return Math.max(0, accepted - batchActiveRework - transferred);
  };

  const getBatchAvailableForRework = (b: StitchingBatch) => {
    const comp = Number(b.completed_quantity || 0);
    const transferred = Number(b.transferred_quantity || 0);
    const batchActiveRework = getActiveReworkForBatch(b);
    return Math.max(0, comp - transferred - batchActiveRework);
  };

  // Filtered Batches for Table 1
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (batchSearch.trim()) {
        const q = batchSearch.toLowerCase();
        const m1 = (b.batch_number || '').toLowerCase().includes(q);
        const m2 = (b.product_name || '').toLowerCase().includes(q);
        const m3 = (b.color || '').toLowerCase().includes(q);
        if (!m1 && !m2 && !m3) return false;
      }
      if (batchStatusFilter === 'PENDING_QC') {
        const uninspected = Math.max(0, Number(b.completed_quantity || 0) - Number(b.accepted_quantity || 0) - Number(b.rework_quantity || 0) - Number(b.rejected_quantity || 0));
        return uninspected > 0;
      }
      if (batchStatusFilter === 'ACCEPTED') {
        return Number(b.accepted_quantity || 0) > 0 && b.status !== 'Transferred to Checking' && !(b as any).is_transferred;
      }
      if (batchStatusFilter === 'TRANSFERRED') {
        return b.status === 'Transferred to Checking' || (b as any).is_transferred;
      }
      return true;
    });
  }, [batches, batchSearch, batchStatusFilter]);

  // Filtered Reworks for Table 2
  const filteredReworks = useMemo(() => {
    return reworkRecords.filter((r) => {
      if (reworkSearch.trim()) {
        const q = reworkSearch.toLowerCase();
        const m1 = (r.rework_order_no || '').toLowerCase().includes(q);
        const m2 = (r.product_name || r.display_product_name || '').toLowerCase().includes(q);
        const m3 = (r.color || '').toLowerCase().includes(q);
        if (!m1 && !m2 && !m3) return false;
      }
      if (reworkStatusFilter === 'SENT') {
        return r.status === 'Sent for Rework' || r.status === 'Pending Rework';
      }
      if (reworkStatusFilter === 'RECEIVED') {
        return r.status === 'Rework Received';
      }
      if (reworkStatusFilter === 'COMPLETED') {
        return (
          r.status === 'Accepted After Rework' ||
          (r.status as string) === 'Completed' ||
          (r.status as string) === 'Transferred'
        );
      }
      return true;
    });
  }, [reworkRecords, reworkSearch, reworkStatusFilter]);

  // Menu Toggle Handlers
  const handleToggleBatchMenu = (e: React.MouseEvent, batch: StitchingBatch) => {
    e.stopPropagation();
    if (activeBatchMenu?.batch.id === batch.id) {
      setActiveBatchMenu(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 140;
    const left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12);
    const top = rect.bottom + 4;
    setActiveBatchMenu({ top, left, batch });
    setActiveReworkMenu(null);
  };

  const handleToggleReworkMenu = (e: React.MouseEvent, rec: ReworkRecord) => {
    e.stopPropagation();
    if (activeReworkMenu?.record.id === rec.id) {
      setActiveReworkMenu(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 140;
    const left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12);
    const top = rect.bottom + 4;
    setActiveReworkMenu({ top, left, record: rec });
    setActiveBatchMenu(null);
  };

  // Open Record Stitching Batch Modal
  const handleOpenBatchModal = (it: any) => {
    setSelectedItem(it);
    const assigned = Number(it.available_to_stitch || it.assigned_quantity || it.total_arrived || 0);
    setBatchForm({
      start_date: new Date().toISOString().split('T')[0],
      completion_date: new Date().toISOString().split('T')[0],
      assigned_quantity: assigned,
      completed_quantity: assigned,
      remarks: ''
    });
    setPhotoUrls([]);
    setBatchError('');
    setBatchModalOpen(true);
  };

  // Submit Stitching Batch
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !selectedItem) return;

    const comp = Number(batchForm.completed_quantity);
    const assigned = Number(batchForm.assigned_quantity);

    if (comp <= 0) {
      setBatchError('Please specify a positive completed quantity.');
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
        start_date: batchForm.start_date,
        completion_date: batchForm.completion_date,
        remarks: batchForm.remarks,
        photo_urls: photoUrls
      });

      setBatchModalOpen(false);
      showToast(`Stitching batch recorded successfully! Ready for Quality Inspection.`);
      await fetchOrderData();
    } catch (err: any) {
      console.error('Failed to save stitching batch:', err);
      setBatchError(err?.message || 'Failed to save stitching batch.');
    } finally {
      setSavingBatch(false);
    }
  };

  // Open Rework Modal from Table 1 Batch
  const handleOpenReworkModal = (batch: StitchingBatch) => {
    setSelectedBatchForRework(batch);
    const avail = getBatchAvailableForRework(batch);
    setReworkForm({
      rework_quantity: avail > 0 ? Math.min(avail, 25) : 1,
      rework_reason: 'Broken / Skipped Stitching',
      dc_challan_no: `DC-STI-RWK-${Math.floor(1000 + Math.random() * 9000)}`,
      expected_return_date: new Date().toISOString().split('T')[0],
      destination_process: 'Alteration & Restitching Line',
      remarks: '',
    });
    setReworkError('');
    setReworkModalOpen(true);
  };

  // Submit Create Stitching Rework
  const handleConfirmCreateRework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForRework || !order) return;
    const qty = Number(reworkForm.rework_quantity);
    const maxQty = Number(selectedBatchForRework.completed_quantity || selectedBatchForRework.assigned_quantity || 0);

    if (qty <= 0) {
      setReworkError('Rework quantity must be greater than zero.');
      return;
    }
    if (qty > maxQty) {
      setReworkError(`Rework quantity cannot exceed batch output quantity (${maxQty} pcs).`);
      return;
    }

    setSubmittingRework(true);
    setReworkError('');
    try {
      const created = await api.createRework({
        production_order_id: Number(order.id),
        production_order_item_id: selectedBatchForRework.production_order_item_id,
        stage_id: 7,
        stage_code: 'STI',
        product_id: selectedBatchForRework.product_id,
        product_name: selectedBatchForRework.product_name || 'Stitched Garment',
        color: selectedBatchForRework.color || 'Standard',
        size: selectedBatchForRework.size || 'M',
        rework_quantity: qty,
        uom: 'PCS',
        defect_reason: reworkForm.rework_reason,
        rework_reason: reworkForm.rework_reason,
        rework_remarks: reworkForm.remarks,
        destination_process: reworkForm.destination_process || 'Alteration & Restitching Line',
        vendor_name: 'In-House Stitching & Alteration Line',
        batch_number: selectedBatchForRework.batch_number,
        reference_id: selectedBatchForRework.id,
      });

      const reworkId = created?.id || (created as any)?.data?.id;
      if (reworkId) {
        await api.sendRework({
          rework_id: reworkId,
          sent_date: new Date().toISOString().split('T')[0],
          vendor_name: 'In-House Stitching & Alteration Line',
          dc_challan_no: reworkForm.dc_challan_no || `DC-STI-RWK-${Math.floor(1000 + Math.random() * 9000)}`,
          remarks: reworkForm.remarks,
        });
      }

      setReworkModalOpen(false);
      showToast(`Rework of ${qty} pcs sent for alteration successfully!`);
      await fetchOrderData();
    } catch (err: any) {
      console.error('Failed to create stitching rework:', err);
      setReworkError(err?.message || 'Failed to dispatch rework order');
    } finally {
      setSubmittingRework(false);
    }
  };

  // Open Receive Rework Modal
  const handleOpenReceiveReworkModal = (rec: ReworkRecord) => {
    setSelectedReworkForReceive(rec);
    const rQty = Number(rec.rework_quantity || 0);
    const accQty = Number(rec.accepted_quantity || 0);
    const isAlreadyReceived =
      rec.status === 'Accepted After Rework' ||
      rec.status === 'Rework Received' ||
      (rec.status as string) === 'Completed' ||
      (rec.status as string) === 'Transferred' ||
      (accQty >= rQty && rQty > 0);

    setReworkReceiptChallanNo(rec.dc_challan_no ? `INW-${rec.dc_challan_no}` : `INW-STI-RWK-${Math.floor(1000 + Math.random() * 9000)}`);
    setReworkReceiptDate(new Date().toISOString().split('T')[0]);
    setReworkLotNo(rec.batch_number || `LOT-STI-RWK-${rec.id || 1}`);
    setReworkReceivedBy('Stitching QC Inspector');
    setReworkReceivedQty(rQty);
    setReworkPhotoUrl(null);
    setReworkRemarks('');
    if (isAlreadyReceived) {
      setReworkReceiveError(`The rework quantity (${fmt(accQty || rQty)} pcs) for #${rec.rework_order_no} has already been received.`);
    } else {
      setReworkReceiveError('');
    }
    setReceiveReworkModalOpen(true);
  };

  // Confirm Inward Receipt of Rework
  const handleConfirmReceiveRework = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedReworkForReceive) return;
    setReworkReceiveError('');

    const rQty = Number(selectedReworkForReceive.rework_quantity || 0);
    const accQty = Number(selectedReworkForReceive.accepted_quantity || 0);
    const isAlreadyReceived =
      selectedReworkForReceive.status === 'Accepted After Rework' ||
      selectedReworkForReceive.status === 'Rework Received' ||
      (selectedReworkForReceive.status as string) === 'Completed' ||
      (selectedReworkForReceive.status as string) === 'Transferred' ||
      (accQty >= rQty && rQty > 0);

    if (isAlreadyReceived) {
      setReworkReceiveError(`The rework quantity (${fmt(accQty || rQty)} pcs) for #${selectedReworkForReceive.rework_order_no} has already been received.`);
      return;
    }

    if (reworkReceivedQty <= 0) {
      setReworkReceiveError('Received quantity must be greater than 0 pcs');
      return;
    }
    if (!reworkPhotoUrl) {
      setReworkReceiveError('Real-time camera photograph with live GPS coordinates is mandatory before confirming rework receipt.');
      return;
    }

    setSubmittingReceiveRework(true);
    try {
      await api.receiveRework({
        rework_id: selectedReworkForReceive.id,
        received_date: reworkReceiptDate,
        dc_challan_no: reworkReceiptChallanNo,
        lot_number: reworkLotNo,
        received_by: reworkReceivedBy,
        photo_url: reworkPhotoUrl,
        remarks: reworkRemarks,
      });
      await api.reinspectRework({
        rework_id: selectedReworkForReceive.id,
        reinspection_date: reworkReceiptDate,
        accepted_quantity: Number(reworkReceivedQty || 0),
        rejected_quantity: 0,
        inspector_name: reworkReceivedBy || 'Stitching QC Inspector',
        reinspection_result: 'Passed Quality Audit',
        reinspection_notes: reworkRemarks || 'Altered stitching pieces received & accepted',
        batch_number: reworkLotNo
      });
      setReceiveReworkModalOpen(false);
      showToast(`Rework #${selectedReworkForReceive.rework_order_no} (${reworkReceivedQty} pcs) inward received & accepted! Pieces are ready for stage transfer.`);
      await fetchOrderData();
    } catch (err: any) {
      console.error('Failed to process stitching rework receipt:', err);
      setReworkReceiveError(err?.message || 'Failed to confirm rework receipt');
    } finally {
      setSubmittingReceiveRework(false);
    }
  };

  // Open Transfer Modal to Stage 08 Checking
  const handleOpenTransferModal = (batchOrItem?: any) => {
    let b: StitchingBatch | null = null;
    let it: any = null;

    if (batchOrItem && batchOrItem.batch_number) {
      b = batchOrItem;
      it = items.find(i => String(i.color).trim() === String(b?.color).trim()) || items[0];
    } else if (batchOrItem) {
      it = batchOrItem;
    } else {
      it = items.find(i => Number(i.ready_to_transfer || 0) > 0) || items[0];
    }

    setSelectedBatch(b);
    setTransferItem(it);
    setSelectedReworkForTransfer(null);

    const available = b ? getBatchAvailableForTransfer(b) : overallAvailableForTransfer;
    if (available <= 0) {
      showToast('No accepted stitching output is currently available in hand to transfer to Checking.');
      return;
    }

    setTransferQuantity(available);
    setTransferRemarks('Stitched garments inspected and passed. Transferred to Stage 08: Checking.');
    setTransferError('');
    setTransferModalOpen(true);
  };

  // Open Stage Transfer Modal from Rework Table
  const handleOpenTransferReworkModal = (rec: ReworkRecord) => {
    const isReceived =
      rec.status === 'Rework Received' ||
      rec.status === 'Accepted After Rework' ||
      (rec.status as string) === 'Completed';

    if (!isReceived) {
      handleOpenReceiveReworkModal(rec);
      setReworkReceiveError(
        'Altered stitching pieces must be inward received before transferring to Checking. Please confirm inward receipt below.'
      );
      return;
    }

    if ((rec.status as string) === 'Transferred') {
      showToast(`Rework #${rec.rework_order_no} has already been transferred to Checking.`);
      return;
    }

    const parentBatch = batches.find(
      (b) => b.batch_number === rec.batch_number || String(b.id) === String(rec.reference_id)
    );

    const available = parentBatch ? getBatchAvailableForTransfer(parentBatch) : overallAvailableForTransfer;
    if (available <= 0) {
      showToast('No accepted stitching output is currently available in hand to transfer to Checking.');
      return;
    }

    setSelectedReworkForTransfer(rec);
    setSelectedBatch(parentBatch || null);
    setTransferItem(items[0] || null);
    setTransferQuantity(available);
    setTransferRemarks(`Reworked stitching #${rec.rework_order_no} accepted and transferred to Stage 08: Checking.`);
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

    const available = selectedBatch ? getBatchAvailableForTransfer(selectedBatch) : overallAvailableForTransfer;
    if (transferQuantity > available + 0.001) {
      setTransferError(`Transfer quantity (${transferQuantity} pcs) exceeds available in hand (${available} pcs).`);
      return;
    }

    try {
      setTransferring(true);
      setTransferError('');
      await api.transferStitchingOutput({
        production_order_id: Number(order.id),
        batch_id: selectedBatch?.id,
        item_id: selectedBatch?.production_order_item_id || transferItem?.active_stitching_item_id || transferItem?.id || items[0]?.active_stitching_item_id || items[0]?.id || 0,
        rework_id: selectedReworkForTransfer?.id,
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

        {/* Table 1: Product-Wise Stitching Status & Action */}
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

        {/* TABLE 1: STITCHING BATCHES (MATCHING CUTTING STAGE ERP TABLE VIEW) */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Stitching Batches
              </h3>
              <span className="font-mono text-[10px] font-bold bg-brand-100 text-brand-800 px-2 py-0.5 rounded-full">
                {batches.length} {batches.length === 1 ? 'batch' : 'batches'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  placeholder="Search batches, product, color..."
                  className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 w-44 sm:w-56"
                />
              </div>

              <select
                value={batchStatusFilter}
                onChange={(e) => setBatchStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_QC">Pending QC</option>
                <option value="ACCEPTED">Accepted Output</option>
                <option value="TRANSFERRED">Transferred</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-2 w-[36px] text-center">#</th>
                    <th className="py-2.5 px-2.5 w-[130px]">Batch Number</th>
                    <th className="py-2.5 px-2.5 w-[160px]">Product & SKU</th>
                    <th className="py-2.5 px-2 text-right w-[85px]">Stitch Qty</th>
                    <th className="py-2.5 px-2.5 w-[120px]">Color / Size</th>
                    <th className="py-2.5 px-2 w-[110px]">Stitch Date</th>
                    <th className="py-2.5 px-2.5 w-[130px]">Target Stage</th>
                    <th className="py-2.5 px-2 text-center w-[125px]">Status</th>
                    <th className="py-2.5 px-2 text-center w-[55px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        <Layers className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                        <p className="font-semibold text-xs text-slate-700">No Stitching Batches Found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          When cut or embroidered pieces arrive, click "Record Stitching" above to record a sewing run.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((batch, idx) => {
                      const comp = Number(batch.completed_quantity || 0);
                      const acc = Number(batch.accepted_quantity || (comp - Number(batch.rejected_quantity || 0) - Number(batch.rework_quantity || 0)));
                      const rej = Number(batch.rejected_quantity || 0);
                      const rwk = Number(batch.rework_quantity || 0);
                      const trf = Number(batch.transferred_quantity || 0);
                      const uninspected = Math.max(0, comp - acc - rej - rwk);
                      const isTransferred = batch.status === 'Transferred to Checking' || (batch as any).is_transferred || (trf >= acc && acc > 0);

                      return (
                        <tr key={batch.id || idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-2 text-center font-mono text-slate-400 text-[11px] align-middle">
                            {idx + 1}
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-mono font-bold text-xs text-brand-700 block truncate" title={batch.batch_number}>
                              {batch.batch_number}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-semibold text-slate-800 block text-xs truncate" title={batch.product_name}>
                              {batch.product_name || 'Garment Item'}
                            </span>
                            {batch.remarks && (
                              <span className="text-[10px] text-slate-400 block truncate" title={batch.remarks}>
                                {batch.remarks}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-right align-middle whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {fmt(comp)} pcs
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-medium text-slate-800 block text-xs truncate" title={batch.color}>
                              {batch.color || 'Standard'}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Size: {batch.size || 'M'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-slate-600 font-mono text-[11px] align-middle whitespace-nowrap">
                            {batch.completion_date || batch.start_date || 'N/A'}
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-mono text-[11px] text-slate-500 block truncate" title="Next: 08. Checking">
                              Next: 08. Checking
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap overflow-hidden">
                            {uninspected > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                Pending QC ({fmt(uninspected)})
                              </span>
                            ) : isTransferred ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                Transferred ({fmt(trf || acc)} pcs)
                              </span>
                            ) : acc > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Accepted ({fmt(acc)} pcs)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                Completed
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                            <button
                              type="button"
                              onClick={(e) => handleToggleBatchMenu(e, batch)}
                              className={`p-1.5 rounded-lg border transition shadow-2xs cursor-pointer ${
                                activeBatchMenu?.batch.id === batch.id
                                  ? 'bg-slate-100 text-slate-900 border-slate-300 ring-2 ring-brand-500/20'
                                  : 'bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-slate-200'
                              }`}
                              title="Batch Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards for Stitching Batches */}
            <div className="md:hidden space-y-3 p-3">
              {filteredBatches.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No stitching batches recorded.
                </div>
              ) : (
                filteredBatches.map((batch, idx) => {
                  const comp = Number(batch.completed_quantity || 0);
                  const acc = Number(batch.accepted_quantity || 0);
                  const uninspected = Math.max(0, comp - acc - Number(batch.rejected_quantity || 0) - Number(batch.rework_quantity || 0));

                  return (
                    <div key={`mob_batch_${batch.id || idx}`} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-xs font-bold text-brand-700">{batch.batch_number}</div>
                          <div className="text-xs text-slate-800 font-semibold mt-0.5">{batch.product_name} ({batch.color})</div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {batch.status || 'Active'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg flex items-center justify-between font-mono">
                        <span>Completed: {fmt(comp)} pcs</span>
                        <span className="font-bold text-emerald-700">Acc: {fmt(acc)} pcs</span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5 flex-wrap">
                        {uninspected > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBatchForInspect(batch);
                              setShowInspectModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Inspect ({uninspected})</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenTransferModal(batch)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-2xs"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Transfer</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenReworkModal(batch)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shadow-2xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Rework</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBatchForView(batch);
                            setViewBatchModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* TABLE 2: STITCHING REWORK & ALTERATION DETAILS TABLE (DOWN NEXT TO STITCHING BATCHES) */}
        <div className="space-y-3 pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Stitching Rework & Alteration Details
              </h3>
              <span className="font-mono text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                {reworkRecords.length} {reworkRecords.length === 1 ? 'record' : 'records'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={reworkSearch}
                  onChange={(e) => setReworkSearch(e.target.value)}
                  placeholder="Search rework #, product, line..."
                  className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 w-44 sm:w-56"
                />
              </div>

              <select
                value={reworkStatusFilter}
                onChange={(e) => setReworkStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="SENT">Sent for Rework</option>
                <option value="RECEIVED">Rework Received</option>
                <option value="COMPLETED">Accepted / Completed</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-2 w-[36px] text-center">#</th>
                    <th className="py-2.5 px-2.5 w-[130px]">Rework # / DC</th>
                    <th className="py-2.5 px-2.5 w-[150px]">Process / Line</th>
                    <th className="py-2.5 px-2.5 w-[170px]">Product & Color</th>
                    <th className="py-2.5 px-2 text-right w-[95px]">Rework Qty</th>
                    <th className="py-2.5 px-2.5 w-[170px]">Defect Reason</th>
                    <th className="py-2.5 px-2 text-center w-[135px]">Status</th>
                    <th className="py-2.5 px-2 text-center w-[55px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReworks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <RotateCcw className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                        <p className="font-semibold text-xs text-slate-700">No Rework Quantities Recorded</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          When sewn garments have seam, tension, or stitch defects, click "Rework" from the 3-dot action menu on the stitching batch.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredReworks.map((rec, idx) => {
                      return (
                        <tr key={rec.id || idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-2 text-center font-mono text-slate-400 text-[11px] align-middle">
                            {idx + 1}
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-mono font-bold text-xs text-brand-700 block truncate" title={rec.rework_order_no}>
                              {rec.rework_order_no}
                            </span>
                            {rec.dc_challan_no && (
                              <span className="font-mono text-[10px] text-slate-500 block truncate">
                                DC: {rec.dc_challan_no}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-medium text-slate-800 block text-xs truncate" title={rec.destination_process || rec.vendor_name || 'Alteration Line'}>
                              {rec.destination_process || rec.vendor_name || 'Alteration Line'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-semibold text-slate-800 block text-xs truncate" title={rec.product_name || rec.display_product_name}>
                              {rec.product_name || rec.display_product_name || 'Garment Item'}
                            </span>
                            {(rec.color || rec.size) && (
                              <span className="text-[10px] text-slate-500 block truncate">
                                {rec.color || 'Standard'} • Size: {rec.size || 'M'}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-right align-middle whitespace-nowrap">
                            <span className="font-mono font-bold text-amber-700 text-xs">
                              {fmt(rec.rework_quantity)} {rec.uom || 'pcs'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="text-slate-700 text-xs block truncate" title={rec?.rework_reason || 'Stitching Seam Defect'}>
                              {rec?.rework_reason || 'Stitching Seam Defect'}
                            </span>
                            {rec.rework_remarks && (
                              <span className="text-[10px] text-slate-400 block truncate" title={rec.rework_remarks}>
                                {rec.rework_remarks}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap overflow-hidden">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold ${
                              (rec.status as string) === 'Transferred'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : rec.status === 'Accepted After Rework' || (rec.status as string) === 'Completed'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : rec.status === 'Sent for Rework'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : rec.status === 'Rework Received'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {rec.status || 'Pending Rework'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                            <button
                              type="button"
                              onClick={(e) => handleToggleReworkMenu(e, rec)}
                              className={`p-1.5 rounded-lg border transition shadow-2xs cursor-pointer ${
                                activeReworkMenu?.record.id === rec.id
                                  ? 'bg-slate-100 text-slate-900 border-slate-300 ring-2 ring-brand-500/20'
                                  : 'bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-slate-200'
                              }`}
                              title="Rework Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards for Rework Records */}
            <div className="md:hidden space-y-3 p-3">
              {filteredReworks.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No rework records registered.
                </div>
              ) : (
                filteredReworks.map((rec, idx) => {
                  return (
                    <div key={`mob_rwk_${rec.id || idx}`} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-xs font-bold text-brand-700">{rec.rework_order_no}</div>
                          <div className="text-xs text-slate-800 font-semibold mt-0.5">{rec.product_name || 'Item'} ({rec.color || 'Standard'})</div>
                        </div>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {rec.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg flex items-center justify-between font-mono">
                        <span>Reason: {rec?.rework_reason || 'Defect'}</span>
                        <span className="font-bold text-amber-700">{fmt(rec.rework_quantity)} {rec.uom || 'pcs'}</span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleOpenReceiveReworkModal(rec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Receive</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTransferReworkModal(rec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shadow-2xs"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Transfer</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReworkForView(rec);
                            setViewReworkModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING ACTION PORTAL: STITCHING BATCHES MENU */}
      {activeBatchMenu &&
        createPortal(
          <div className="fixed inset-0 z-[99999]" onClick={() => setActiveBatchMenu(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: `${activeBatchMenu.top}px`,
                left: `${activeBatchMenu.left}px`,
                width: '140px',
              }}
              className="bg-white border border-slate-200 rounded-xl shadow-xl py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95"
            >
              <div className="py-0.5">
                {/* 1. Inspect (if uninspected pieces > 0) */}
                {(() => {
                  const b = activeBatchMenu.batch;
                  const uninspected = Math.max(0, Number(b.completed_quantity || 0) - Number(b.accepted_quantity || 0) - Number(b.rework_quantity || 0) - Number(b.rejected_quantity || 0));
                  return uninspected > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveBatchMenu(null);
                        setSelectedBatchForInspect(b);
                        setShowInspectModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-medium transition text-left cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Inspect ({fmt(uninspected)})</span>
                    </button>
                  ) : null;
                })()}

                {/* 2. Transfer */}
                <button
                  type="button"
                  onClick={() => {
                    const b = activeBatchMenu.batch;
                    setActiveBatchMenu(null);
                    handleOpenTransferModal(b);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-purple-700 hover:bg-purple-50 hover:text-purple-800 font-medium transition text-left cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>Transfer</span>
                </button>

                {/* 3. Rework */}
                <button
                  type="button"
                  onClick={() => {
                    const b = activeBatchMenu.batch;
                    setActiveBatchMenu(null);
                    handleOpenReworkModal(b);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800 font-medium transition text-left cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Rework / Alter</span>
                </button>

                {/* 4. View Details */}
                <button
                  type="button"
                  onClick={() => {
                    const b = activeBatchMenu.batch;
                    setActiveBatchMenu(null);
                    setSelectedBatchForView(b);
                    setViewBatchModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium transition text-left cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>View Details</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* FLOATING ACTION PORTAL: REWORK TABLE MENU */}
      {activeReworkMenu &&
        createPortal(
          <div className="fixed inset-0 z-[99999]" onClick={() => setActiveReworkMenu(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: `${activeReworkMenu.top}px`,
                left: `${activeReworkMenu.left}px`,
                width: '140px',
              }}
              className="bg-white border border-slate-200 rounded-xl shadow-xl py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95"
            >
              <div className="py-0.5">
                {/* 1. Receive */}
                <button
                  type="button"
                  onClick={() => {
                    const r = activeReworkMenu.record;
                    setActiveReworkMenu(null);
                    handleOpenReceiveReworkModal(r);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-medium transition text-left cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Receive</span>
                </button>

                {/* 2. Transfer */}
                <button
                  type="button"
                  onClick={() => {
                    const r = activeReworkMenu.record;
                    setActiveReworkMenu(null);
                    handleOpenTransferReworkModal(r);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 font-medium transition text-left cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Transfer</span>
                </button>

                {/* 3. View */}
                <button
                  type="button"
                  onClick={() => {
                    const r = activeReworkMenu.record;
                    setActiveReworkMenu(null);
                    setSelectedReworkForView(r);
                    setViewReworkModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium transition text-left cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>View</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

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
                  Completed Output <span className="text-red-500">*</span>
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
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Two-Step Quality Verification Workflow</span>
                <span>Record the total completed sewn pieces here. Quality inspection, seam defect categorization, and rework decisions take place in the next step via <strong>Quality Inspection</strong>.</span>
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

      {/* MODAL 2: TRANSFER TO STAGE 08 CHECKING */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => {
          setTransferModalOpen(false);
          setSelectedReworkForTransfer(null);
        }}
        title={`Transfer Completed Stitching to Stage 08: Checking${selectedBatch ? ` — Batch ${selectedBatch.batch_number}` : ''}`}
        maxWidth="max-w-md"
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
              Product: <strong>{selectedBatch?.product_name || transferItem?.product_name || 'Garment Item'}</strong> • Color: <strong>{selectedBatch?.color || transferItem?.color || 'Standard'}</strong>
            </span>
          </div>

          <div className="p-3 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white border border-purple-200 rounded-xl text-xs space-y-1.5 font-mono">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-sans font-medium">Available in Hand to Transfer:</span>
              <strong className="text-purple-700 text-sm font-bold">
                {fmt(selectedBatch ? getBatchAvailableForTransfer(selectedBatch) : overallAvailableForTransfer)} pcs
              </strong>
            </div>
            {(selectedBatch ? getActiveReworkForBatch(selectedBatch) : activeReworkQty) > 0 && (
              <div className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center justify-between font-sans">
                <span className="flex items-center gap-1 font-medium">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                  Rework at Alteration Line:
                </span>
                <span className="font-mono font-bold text-amber-900">
                  {fmt(selectedBatch ? getActiveReworkForBatch(selectedBatch) : activeReworkQty)} pcs away
                </span>
              </div>
            )}
          </div>

          <FormField label="Quantity to Transfer (Pieces) *" required>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Available to transfer</span>
                <button
                  type="button"
                  onClick={() => {
                    const avail = selectedBatch ? getBatchAvailableForTransfer(selectedBatch) : overallAvailableForTransfer;
                    setTransferQuantity(avail);
                  }}
                  className="text-[10px] font-bold text-purple-700 hover:underline cursor-pointer"
                >
                  Max ({fmt(selectedBatch ? getBatchAvailableForTransfer(selectedBatch) : overallAvailableForTransfer)} pcs)
                </button>
              </div>
              <input
                type="number"
                min="1"
                max={selectedBatch ? getBatchAvailableForTransfer(selectedBatch) : overallAvailableForTransfer}
                value={transferQuantity}
                onChange={e => setTransferQuantity(Number(e.target.value))}
                className="w-full text-xs font-mono font-bold rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white text-purple-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                required
              />
            </div>
          </FormField>

          <FormField label="Transfer Handover Notes">
            <textarea
              rows={2}
              value={transferRemarks}
              onChange={e => setTransferRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-800"
              placeholder="Enter transfer notes or bundle codes..."
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setTransferModalOpen(false);
                setSelectedReworkForTransfer(null);
              }}
              disabled={transferring}
            >
              Cancel
            </Button>
            <Button
              id="btn-confirm-transfer-to-checking"
              variant="primary"
              size="sm"
              type="submit"
              disabled={transferring || (selectedBatch ? getBatchAvailableForTransfer(selectedBatch) : overallAvailableForTransfer) <= 0}
              className="bg-purple-700 hover:bg-purple-800 text-white font-bold"
            >
              {transferring ? 'Transferring...' : 'Confirm Transfer to Checking'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CREATE STITCHING REWORK */}
      <Modal
        isOpen={reworkModalOpen}
        onClose={() => setReworkModalOpen(false)}
        title={selectedBatchForRework ? `Send Pieces for Alteration & Restitching — ${selectedBatchForRework.batch_number}` : 'Send for Stitching Rework'}
        maxWidth="max-w-lg"
      >
        {selectedBatchForRework && (
          <form onSubmit={handleConfirmCreateRework} className="space-y-4">
            {reworkError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{reworkError}</span>
              </div>
            )}

            {/* Context Card */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">{selectedBatchForRework.product_name || 'Garment Item'}</span>
                  <span className="font-mono text-[10px] text-brand-600 block">Color: {selectedBatchForRework.color} • Size: {selectedBatchForRework.size || 'M'}</span>
                </div>
                <span className="font-mono text-brand-700 font-bold bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                  {selectedBatchForRework.batch_number}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 font-mono text-[11px] pt-1 border-t border-slate-200/60">
                <span>Completed Total: <strong className="text-slate-900">{fmt(selectedBatchForRework.completed_quantity)} pcs</strong></span>
                <span>Available to Alter: <strong className="text-amber-700">{fmt(getBatchAvailableForRework(selectedBatchForRework))} pcs</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Rework Quantity (Pieces) *" required>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Available to alter</span>
                    <button
                      type="button"
                      onClick={() => {
                        const maxQ = getBatchAvailableForRework(selectedBatchForRework);
                        setReworkForm({ ...reworkForm, rework_quantity: maxQ > 0 ? maxQ : 1 });
                      }}
                      className="text-[10px] font-bold text-brand-600 hover:underline cursor-pointer"
                    >
                      Max ({fmt(getBatchAvailableForRework(selectedBatchForRework))} pcs)
                    </button>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={Number(selectedBatchForRework.completed_quantity || selectedBatchForRework.assigned_quantity || 0)}
                    value={reworkForm.rework_quantity}
                    onChange={(e) => setReworkForm({ ...reworkForm, rework_quantity: Number(e.target.value) })}
                    className="w-full text-xs font-mono font-bold rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    required
                  />
                </div>
              </FormField>

              <FormField label="Internal DC / Challan #" required>
                <input
                  type="text"
                  value={reworkForm.dc_challan_no}
                  onChange={(e) => setReworkForm({ ...reworkForm, dc_challan_no: e.target.value })}
                  className="w-full text-xs font-mono rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  placeholder="DC-STI-RWK-..."
                  required
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Defect Reason *" required>
                <select
                  value={reworkForm.rework_reason}
                  onChange={(e) => setReworkForm({ ...reworkForm, rework_reason: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  required
                >
                  <option value="Broken / Skipped Stitching">Broken / Skipped Stitching</option>
                  <option value="Seam Puckering / Tension Variance">Seam Puckering / Tension Variance</option>
                  <option value="Open Seam / Missed Seam">Open Seam / Missed Seam</option>
                  <option value="Incorrect Thread Color / Shade Mismatch">Incorrect Thread Color / Shade Mismatch</option>
                  <option value="Uneven Hem / Measurement Variance">Uneven Hem / Measurement Variance</option>
                  <option value="Oil / Needle Stain">Oil / Needle Stain</option>
                  <option value="Other Stitching Defect">Other Stitching Defect</option>
                </select>
              </FormField>

              <FormField label="Destination Process / Alteration Line">
                <input
                  type="text"
                  value={reworkForm.destination_process}
                  onChange={(e) => setReworkForm({ ...reworkForm, destination_process: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  placeholder="e.g. Alteration & Restitching Line"
                />
              </FormField>
            </div>

            <FormField label="Quality Remarks & Instructions">
              <textarea
                rows={2}
                value={reworkForm.remarks}
                onChange={(e) => setReworkForm({ ...reworkForm, remarks: e.target.value })}
                placeholder="Specify precise repair, alteration or re-stitching instructions..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
              />
            </FormField>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setReworkModalOpen(false)}
                disabled={submittingRework}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                disabled={submittingRework}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                <span>{submittingRework ? 'Sending...' : 'Confirm & Send for Alteration'}</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: INWARD RECEIVE REWORKED STITCHING PIECES */}
      <Modal
        isOpen={receiveReworkModalOpen}
        onClose={() => !submittingReceiveRework && setReceiveReworkModalOpen(false)}
        title={`Inward Receive Altered Pieces — ${selectedReworkForReceive?.rework_order_no}`}
        maxWidth="max-w-lg"
      >
        {selectedReworkForReceive && (
          <form onSubmit={handleConfirmReceiveRework} className="space-y-4">
            {/* Duplicate / already received error banner */}
            {(() => {
              const rQty = Number(selectedReworkForReceive.rework_quantity || 0);
              const accQty = Number(selectedReworkForReceive.accepted_quantity || 0);
              const isAlreadyReceived =
                selectedReworkForReceive.status === 'Accepted After Rework' ||
                selectedReworkForReceive.status === 'Rework Received' ||
                (selectedReworkForReceive.status as string) === 'Completed' ||
                (selectedReworkForReceive.status as string) === 'Transferred' ||
                (accQty >= rQty && rQty > 0);

              if (isAlreadyReceived || reworkReceiveError) {
                return (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>
                      {reworkReceiveError ||
                        `The rework quantity (${fmt(accQty || rQty)} pcs) for #${selectedReworkForReceive.rework_order_no} has already been received.`}
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            {/* Metadata 4-field grid with explicit borders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Inward Delivery Challan (DC No) *" required>
                <input
                  type="text"
                  value={reworkReceiptChallanNo}
                  onChange={e => setReworkReceiptChallanNo(e.target.value)}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                  placeholder="e.g. INW-STI-RWK-101"
                  required
                />
              </FormField>

              <FormField label="Receipt Date *" required>
                <input
                  type="date"
                  value={reworkReceiptDate}
                  onChange={e => setReworkReceiptDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                  required
                />
              </FormField>

              <FormField label="Lot # / Batch #">
                <input
                  type="text"
                  value={reworkLotNo}
                  onChange={e => setReworkLotNo(e.target.value)}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                  placeholder="e.g. LOT-STI-01"
                />
              </FormField>

              <FormField label="Received & Inspected By *">
                <input
                  type="text"
                  value={reworkReceivedBy}
                  onChange={e => setReworkReceivedBy(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                  placeholder="e.g. Stitching QC Inspector"
                  required
                />
              </FormField>
            </div>

            {/* Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100/90 p-2.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Sent for Rework</span>
                <span className="font-mono font-bold text-slate-800">
                  {fmt(selectedReworkForReceive.rework_quantity)} {selectedReworkForReceive.uom || 'pcs'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Defect Reason</span>
                <span className="font-semibold text-slate-700 truncate block" title={selectedReworkForReceive?.rework_reason}>
                  {selectedReworkForReceive?.rework_reason || 'Defect Correction'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Alteration Line</span>
                <span className="font-semibold text-slate-700 truncate block">
                  {selectedReworkForReceive.destination_process || selectedReworkForReceive.vendor_name || 'Stitching Line'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 block uppercase font-bold">Inwarding Now</span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-300 inline-block">
                  {fmt(reworkReceivedQty)} {selectedReworkForReceive.uom || 'pcs'}
                </span>
              </div>
            </div>

            {/* Received Pieces Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    {selectedReworkForReceive.product_name || selectedReworkForReceive.display_product_name || 'Garment Item'}
                  </span>
                  <span className="font-mono text-[10px] text-brand-700">
                    Color: {selectedReworkForReceive.color || 'Standard'} • Size: {selectedReworkForReceive.size || 'M'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReworkReceivedQty(Number(selectedReworkForReceive.rework_quantity))}
                  className="text-[11px] font-bold text-brand-600 hover:underline cursor-pointer"
                >
                  Receive Full ({fmt(selectedReworkForReceive.rework_quantity)} pcs)
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200/60">
                <FormField label={`Received & Accepted Qty (${selectedReworkForReceive.uom || 'pcs'}) *`} required>
                  <input
                    type="number"
                    min="1"
                    max={Number(selectedReworkForReceive.rework_quantity)}
                    value={reworkReceivedQty}
                    onChange={e => setReworkReceivedQty(Number(e.target.value))}
                    className="w-full text-xs font-bold rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs font-mono"
                    required
                  />
                </FormField>
              </div>
            </div>

            {/* Mandatory Live Camera Photo Proof (no upload) */}
            <LivePhotoCaptureField
              label="Altered Pieces Physical Verification Photo"
              required={true}
              photo={reworkPhotoUrl}
              onPhotoChange={setReworkPhotoUrl}
              stageName="Stitching Rework Return (Stage 07)"
              orderNumber={order?.order_number || selectedReworkForReceive.rework_order_no}
              error={reworkReceiveError && !reworkPhotoUrl ? 'Real-time camera photograph with live GPS coordinates is mandatory before confirming rework receipt.' : undefined}
              placeholderText="Tap here to open camera"
              helperText="Photograph of repaired seams & stitching must be captured live via camera."
              buttonText="Take Real-Time Alteration Photo"
            />

            <FormField label="Quality Remarks & Inspection Notes">
              <textarea
                rows={2}
                value={reworkRemarks}
                onChange={e => setReworkRemarks(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                placeholder="e.g. Altered pieces inspected, seam tension verified, all loose threads removed and accepted."
              />
            </FormField>

            {(() => {
              const rQty = Number(selectedReworkForReceive.rework_quantity || 0);
              const accQty = Number(selectedReworkForReceive.accepted_quantity || 0);
              const isAlreadyReceived =
                selectedReworkForReceive.status === 'Accepted After Rework' ||
                selectedReworkForReceive.status === 'Rework Received' ||
                (selectedReworkForReceive.status as string) === 'Completed' ||
                (selectedReworkForReceive.status as string) === 'Transferred' ||
                (accQty >= rQty && rQty > 0);

              return (
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setReceiveReworkModalOpen(false)}
                    disabled={submittingReceiveRework}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingReceiveRework || isAlreadyReceived}
                    className={
                      isAlreadyReceived
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed font-bold'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'
                    }
                  >
                    {submittingReceiveRework ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        <span>Inwarding Pieces...</span>
                      </>
                    ) : isAlreadyReceived ? (
                      <>
                        <CheckCheck className="w-4 h-4 mr-1.5" />
                        <span>Rework Quantity Already Received ({fmt(accQty || rQty)} {selectedReworkForReceive.uom || 'pcs'})</span>
                      </>
                    ) : (
                      <>
                        <CheckCheck className="w-4 h-4 mr-1.5" />
                        <span>Confirm Inward & Pass QC ({fmt(reworkReceivedQty)} pcs)</span>
                      </>
                    )}
                  </Button>
                </div>
              );
            })()}
          </form>
        )}
      </Modal>

      {/* MODAL: VIEW BATCH DETAILS */}
      <Modal
        isOpen={viewBatchModalOpen}
        onClose={() => {
          setViewBatchModalOpen(false);
          setSelectedBatchForView(null);
        }}
        title={`Stitching Batch Details — ${selectedBatchForView?.batch_number || ''}`}
        maxWidth="max-w-md"
      >
        {selectedBatchForView && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Batch Number</span>
                <span className="font-mono font-bold text-brand-700">{selectedBatchForView.batch_number}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Status</span>
                <span className="font-bold text-slate-800">{selectedBatchForView.status}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Completed Output</span>
                <span className="font-mono font-bold text-slate-900">{fmt(selectedBatchForView.completed_quantity)} pcs</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Accepted Output</span>
                <span className="font-mono font-bold text-emerald-700">{fmt(selectedBatchForView.accepted_quantity || 0)} pcs</span>
              </div>
            </div>

            <div className="space-y-1.5 border border-slate-200 rounded-xl p-3 bg-white">
              <div className="flex justify-between">
                <span className="text-slate-500">Product:</span>
                <strong className="text-slate-800">{selectedBatchForView.product_name || 'Garment Item'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Color / Size:</span>
                <strong className="text-slate-800">{selectedBatchForView.color || 'Standard'} • {selectedBatchForView.size || 'M'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <strong className="font-mono text-slate-800">{selectedBatchForView.completion_date || selectedBatchForView.start_date || 'N/A'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transferred Next:</span>
                <strong className="font-mono text-purple-700">{fmt(selectedBatchForView.transferred_quantity || 0)} pcs</strong>
              </div>
              {selectedBatchForView.remarks && (
                <div className="pt-2 border-t border-slate-100 text-slate-600">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Remarks:</span>
                  <span>{selectedBatchForView.remarks}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setViewBatchModalOpen(false);
                  setSelectedBatchForView(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: VIEW REWORK DETAILS */}
      <Modal
        isOpen={viewReworkModalOpen}
        onClose={() => {
          setViewReworkModalOpen(false);
          setSelectedReworkForView(null);
        }}
        title={`Rework Record Details — ${selectedReworkForView?.rework_order_no || ''}`}
        maxWidth="max-w-md"
      >
        {selectedReworkForView && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Rework #</span>
                <span className="font-mono font-bold text-brand-700">{selectedReworkForView.rework_order_no}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Status</span>
                <span className="font-bold text-slate-800">{selectedReworkForView.status}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Rework Qty</span>
                <span className="font-mono font-bold text-amber-700">{fmt(selectedReworkForView.rework_quantity)} {selectedReworkForView.uom || 'pcs'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Accepted Qty</span>
                <span className="font-mono font-bold text-emerald-700">{fmt(selectedReworkForView.accepted_quantity || 0)} {selectedReworkForView.uom || 'pcs'}</span>
              </div>
            </div>

            <div className="space-y-1.5 border border-slate-200 rounded-xl p-3 bg-white">
              <div className="flex justify-between">
                <span className="text-slate-500">Alteration Line:</span>
                <strong className="text-slate-800">{selectedReworkForView.destination_process || selectedReworkForView.vendor_name || 'Stitching Line'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Product:</span>
                <strong className="text-slate-800">{selectedReworkForView.product_name || 'Garment Item'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Color / Size:</span>
                <strong className="text-slate-800">{selectedReworkForView.color || 'Standard'} • {selectedReworkForView.size || 'M'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Defect Reason:</span>
                <strong className="text-amber-800">{selectedReworkForView.rework_reason || 'Defect'}</strong>
              </div>
              {selectedReworkForView.dc_challan_no && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Challan / DC:</span>
                  <strong className="font-mono text-slate-800">{selectedReworkForView.dc_challan_no}</strong>
                </div>
              )}
              {selectedReworkForView.rework_remarks && (
                <div className="pt-2 border-t border-slate-100 text-slate-600">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Remarks:</span>
                  <span>{selectedReworkForView.rework_remarks}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setViewReworkModalOpen(false);
                  setSelectedReworkForView(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
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

      {/* Quality Inspection Modal (Stage 07: Stitching) */}
      {selectedBatchForInspect && (
        <StageInspectionModal
          isOpen={showInspectModal}
          onClose={() => {
            setShowInspectModal(false);
            setSelectedBatchForInspect(null);
          }}
          title={`Stitching Quality Inspection — Batch ${selectedBatchForInspect.batch_number}`}
          productionOrderId={Number(order?.id || id)}
          stageId={7}
          stageCode="STI"
          referenceId={selectedBatchForInspect.batch_number}
          referenceType="Stitching Batch"
          batchNumber={selectedBatchForInspect.batch_number}
          productName={selectedBatchForInspect.product_name || 'Sewn Garments'}
          color={selectedBatchForInspect.color}
          size={selectedBatchForInspect.size}
          productionOrderItemId={selectedBatchForInspect.production_order_item_id}
          availableQuantity={Math.max(0, Number(selectedBatchForInspect.completed_quantity || 0) - Number(selectedBatchForInspect.accepted_quantity || 0) - Number(selectedBatchForInspect.rework_quantity || 0) - Number(selectedBatchForInspect.rejected_quantity || 0))}
          uom="PCS"
          supportsRejection={true}
          onSuccess={async () => {
            setShowInspectModal(false);
            setSelectedBatchForInspect(null);
            showToast('Stitching quality inspection recorded successfully! Accepted balance credited for transfer to Checking.');
            await fetchOrderData();
          }}
        />
      )}
    </div>
  );
}
