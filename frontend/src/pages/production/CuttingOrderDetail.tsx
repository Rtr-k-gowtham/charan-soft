// src/pages/production/CuttingOrderDetail.tsx
// Stage 05: Product-wise Cutting Batches, Yield Reconciliation & Stage Transfer
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useStageBackNavigation } from '../../utils/navigation';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, CuttingBatch, ReworkRecord } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { LivePhotoCaptureField } from '../../components/production/LivePhotoCaptureField';
import StageInspectionModal from '../../components/production/StageInspectionModal';
import {
  ArrowLeft,
  Scissors,
  RefreshCw,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Layers,
  Calendar,
  Eye,
  CheckCheck,
  RotateCcw,
  ShieldCheck,
  Package,
  MoreVertical,
  Search,
  Check
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n || 0);

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
  const [reworkRecords, setReworkRecords] = useState<ReworkRecord[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [dyeingData, setDyeingData] = useState<{ totalReceived: number; totalAccepted: number; totalTransferred: number; receipts: any[] }>({ totalReceived: 0, totalAccepted: 0, totalTransferred: 0, receipts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Filter States
  const [batchSearch, setBatchSearch] = useState('');
  const [batchStatusFilter, setBatchStatusFilter] = useState('ALL');
  const [reworkSearch, setReworkSearch] = useState('');
  const [reworkStatusFilter, setReworkStatusFilter] = useState('ALL');

  // New Batch Modal State
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [batchForm, setBatchForm] = useState({
    cutting_date: new Date().toISOString().split('T')[0],
    assigned_quantity: 0,
    actual_cut_quantity: 0,
    remarks: '',
  });
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchError, setBatchError] = useState('');

  // Quality Inspection Modal State (Stage 05: Cutting)
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [selectedBatchForInspect, setSelectedBatchForInspect] = useState<CuttingBatch | null>(null);

  // Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<CuttingBatch | null>(null);
  const [selectedReworkForTransfer, setSelectedReworkForTransfer] = useState<ReworkRecord | null>(null);
  const [transferForm, setTransferForm] = useState({
    destination_stage_id: '6', // default to Embroidery (6) or Stitching (7)
    transfer_quantity: 0,
    remarks: '',
  });
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [transferError, setTransferError] = useState('');

  // 3-Dot Floating Action Menu States
  const [activeBatchMenu, setActiveBatchMenu] = useState<{
    batchId: number;
    top: number;
    left: number;
    batch: CuttingBatch;
  } | null>(null);

  const [activeReworkMenu, setActiveReworkMenu] = useState<{
    recordId: number;
    top: number;
    left: number;
    record: ReworkRecord;
  } | null>(null);

  // Modal: View Batch Details
  const [viewBatchModalOpen, setViewBatchModalOpen] = useState(false);
  const [selectedBatchForView, setSelectedBatchForView] = useState<CuttingBatch | null>(null);

  // Modal: Create Rework & Recutting
  const [reworkModalOpen, setReworkModalOpen] = useState(false);
  const [selectedBatchForRework, setSelectedBatchForRework] = useState<CuttingBatch | null>(null);
  const [reworkForm, setReworkForm] = useState({
    rework_quantity: 1,
    rework_reason: 'Measurement / Dimension Variance',
    defect_reason: 'Measurement / Dimension Variance',
    expected_return_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    dc_challan_no: '',
    destination_process: 'Recutting & Trimming Table',
    remarks: '',
  });
  const [submittingRework, setSubmittingRework] = useState(false);
  const [reworkError, setReworkError] = useState('');

  // Modal: Inward Receive Recut Pieces
  const [receiveReworkModalOpen, setReceiveReworkModalOpen] = useState(false);
  const [selectedReworkForReceive, setSelectedReworkForReceive] = useState<ReworkRecord | null>(null);
  const [reworkReceiptChallanNo, setReworkReceiptChallanNo] = useState('');
  const [reworkReceiptDate, setReworkReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [reworkLotNo, setReworkLotNo] = useState('');
  const [reworkReceivedBy, setReworkReceivedBy] = useState('Cutting QC Inspector');
  const [reworkReceivedQty, setReworkReceivedQty] = useState(0);
  const [reworkPhotoUrl, setReworkPhotoUrl] = useState<string | null>(null);
  const [reworkRemarks, setReworkRemarks] = useState('');
  const [reworkReceiveError, setReworkReceiveError] = useState('');
  const [submittingReceiveRework, setSubmittingReceiveRework] = useState(false);

  // Modal: View Rework Details
  const [viewReworkModalOpen, setViewReworkModalOpen] = useState(false);
  const [selectedReworkForView, setSelectedReworkForView] = useState<ReworkRecord | null>(null);

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
        setReworkRecords(cData.rework_records || []);
        setDyeingData({
          totalReceived: Number(cData.total_dyed_fabric_received || 0),
          totalAccepted: Number(cData.total_dyed_fabric_accepted || 0),
          totalTransferred: Number(cData.total_dyed_fabric_transferred || 0),
          receipts: cData.dyeing_receipts || [],
        });
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

  // Click outside / scroll / escape listener for floating menus
  useEffect(() => {
    if (!activeBatchMenu && !activeReworkMenu) return;
    const closeAll = () => {
      setActiveBatchMenu(null);
      setActiveReworkMenu(null);
    };
    window.addEventListener('scroll', closeAll, true);
    window.addEventListener('resize', closeAll);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', closeAll, true);
      window.removeEventListener('resize', closeAll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeBatchMenu, activeReworkMenu]);

  const handleToggleBatchMenu = (e: React.MouseEvent<HTMLButtonElement>, batch: CuttingBatch) => {
    e.stopPropagation();
    if (activeBatchMenu?.batchId === batch.id) {
      setActiveBatchMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuWidth = 148;
      const menuHeight = 150;

      let top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight && rect.top > menuHeight) {
        top = rect.top - menuHeight - 4;
      }

      let left = rect.right - menuWidth;
      if (left < 10) left = 10;
      if (left + menuWidth > window.innerWidth - 10) {
        left = window.innerWidth - menuWidth - 10;
      }

      setActiveBatchMenu({
        batchId: batch.id || 0,
        top,
        left,
        batch,
      });
      setActiveReworkMenu(null);
    }
  };

  const handleToggleReworkMenu = (e: React.MouseEvent<HTMLButtonElement>, record: ReworkRecord) => {
    e.stopPropagation();
    if (activeReworkMenu?.recordId === record.id) {
      setActiveReworkMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuWidth = 148;
      const menuHeight = 125;

      let top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight && rect.top > menuHeight) {
        top = rect.top - menuHeight - 4;
      }

      let left = rect.right - menuWidth;
      if (left < 10) left = 10;
      if (left + menuWidth > window.innerWidth - 10) {
        left = window.innerWidth - menuWidth - 10;
      }

      setActiveReworkMenu({
        recordId: record.id,
        top,
        left,
        record,
      });
      setActiveBatchMenu(null);
    }
  };

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
      remarks: '',
    });
    setPhotoUrls([]);
    setBatchError('');
    setBatchModalOpen(true);
  };

  const handleSaveBatch = async () => {
    if (!selectedItem) return;
    const actual = Number(batchForm.actual_cut_quantity || 0);
    const assigned = Number(batchForm.assigned_quantity || 0);

    if (actual <= 0) {
      setBatchError('Actual Cut Qty must be greater than zero');
      return;
    }
    if (assigned > 0 && actual > assigned) {
      setBatchError(`Actual Cut Qty (${actual}) cannot exceed remaining assigned quantity (${assigned})`);
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
        cutting_date: batchForm.cutting_date,
        remarks: batchForm.remarks,
        photo_urls: photoUrls,
      });

      setBatchModalOpen(false);
      setToastMessage('Cutting batch recorded successfully! Ready for Quality Inspection.');
      loadData();
    } catch (err: any) {
      setBatchError(err.message || 'Failed to save cutting batch');
    } finally {
      setSavingBatch(false);
    }
  };

  // Active rework currently away at recutting table (not yet received back)
  const getActiveReworkForBatch = (batch: CuttingBatch) => {
    const bNo = batch.batch_number;
    const bId = String(batch.id || '');
    return reworkRecords
      .filter((r) => {
        const matchesBatch =
          (r.batch_number && r.batch_number === bNo) ||
          (r.reference_id && (String(r.reference_id) === bId || String(r.reference_id) === bNo));
        const isClosed =
          r.status === 'Rework Received' ||
          r.status === 'Accepted After Rework' ||
          (r.status as string) === 'Completed' ||
          (r.status as string) === 'Transferred';
        return matchesBatch && !isClosed;
      })
      .reduce((sum, r) => sum + Number(r.rework_quantity || 0), 0);
  };

  // Remaining available cut pieces in hand ready to transfer
  const getBatchAvailableForTransfer = (batch: CuttingBatch) => {
    const cut = Number(batch.actual_cut_quantity || 0);
    const activeRwk = getActiveReworkForBatch(batch);
    const rej = Number(batch.rejected_quantity || 0);
    const trf = Number(batch.transferred_to_next_stage_quantity || 0);
    return Math.max(0, cut - activeRwk - rej - trf);
  };

  // Remaining available cut pieces that can be sent for rework
  const getBatchAvailableForRework = (batch: CuttingBatch) => {
    const cut = Number(batch.actual_cut_quantity || 0);
    const activeRwk = getActiveReworkForBatch(batch);
    const rej = Number(batch.rejected_quantity || 0);
    const trf = Number(batch.transferred_to_next_stage_quantity || 0);
    return Math.max(0, cut - activeRwk - rej - trf);
  };

  const handleOpenTransferModal = (batch: CuttingBatch) => {
    setSelectedBatch(batch);
    setSelectedReworkForTransfer(null);
    const avail = getBatchAvailableForTransfer(batch);
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
    const avail = getBatchAvailableForTransfer(selectedBatch);
    const activeRwk = getActiveReworkForBatch(selectedBatch);

    if (qty <= 0) {
      setTransferError('Transfer quantity must be greater than zero');
      return;
    }

    if (selectedReworkForTransfer) {
      const maxRwk = Number(selectedReworkForTransfer.accepted_quantity || selectedReworkForTransfer.rework_quantity || 0);
      if (qty > maxRwk) {
        setTransferError(`Transfer quantity (${qty} pcs) exceeds accepted rework pieces (${maxRwk} pcs).`);
        return;
      }
    } else if (qty > avail) {
      setTransferError(
        `Transfer quantity (${qty} pcs) exceeds available pieces in hand (${avail} pcs). ${
          activeRwk > 0 ? `${activeRwk} pcs are currently sent for rework.` : ''
        }`
      );
      return;
    }

    setSavingTransfer(true);
    setTransferError('');
    try {
      const payload: any = {
        batch_id: selectedBatch.id,
        batch_number: selectedBatch.batch_number,
        destination_stage_id: Number(transferForm.destination_stage_id),
        transfer_quantity: qty,
        remarks: transferForm.remarks,
      };
      if (selectedReworkForTransfer) {
        payload.rework_id = selectedReworkForTransfer.id;
      }
      await api.transferCuttingOutput(payload);

      setTransferModalOpen(false);
      setSelectedReworkForTransfer(null);
      const stageName = Number(transferForm.destination_stage_id) === 7 ? '07. Stitching' : '06. Embroidery';
      setToastMessage(`Successfully transferred ${qty} pieces to ${stageName}!`);
      loadData();
    } catch (err: any) {
      setTransferError(err.message || 'Failed to transfer batch output');
    } finally {
      setSavingTransfer(false);
    }
  };

  // Open Rework creation modal for a Cutting Batch
  const handleOpenReworkModal = (batch: CuttingBatch) => {
    setSelectedBatchForRework(batch);
    const availForRework = getBatchAvailableForRework(batch);
    const initialQty = availForRework > 0 ? availForRework : (Number(batch.actual_cut_quantity) || 1);
    setReworkForm({
      rework_quantity: initialQty,
      rework_reason: 'Measurement / Dimension Variance',
      defect_reason: 'Measurement / Dimension Variance',
      expected_return_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      dc_challan_no: `DC-CUT-RWK-${Math.floor(1000 + Math.random() * 9000)}`,
      destination_process: 'Recutting & Trimming Table',
      remarks: '',
    });
    setReworkError('');
    setReworkModalOpen(true);
  };

  // Submit Rework Order
  const handleConfirmCreateRework = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedBatchForRework) return;
    const poId = Number(order?.id || id);
    const qty = Number(reworkForm.rework_quantity);
    const maxCut = Number(selectedBatchForRework.actual_cut_quantity || 0);

    if (qty <= 0) {
      setReworkError('Please enter a valid recut quantity greater than 0.');
      return;
    }
    if (qty > maxCut) {
      setReworkError(`Recut quantity cannot exceed total cut quantity (${maxCut} pcs).`);
      return;
    }

    setSubmittingRework(true);
    setReworkError('');
    try {
      const created = await api.createRework({
        production_order_id: poId,
        production_order_item_id: selectedBatchForRework.production_order_item_id,
        stage_id: 5,
        stage_code: 'CUT',
        product_id: selectedBatchForRework.product_id,
        product_name: selectedBatchForRework.product_name,
        color: selectedBatchForRework.color,
        size: selectedBatchForRework.size,
        rework_quantity: qty,
        uom: 'PCS',
        defect_reason: reworkForm.rework_reason,
        rework_reason: reworkForm.rework_reason,
        rework_remarks: reworkForm.remarks,
        destination_process: reworkForm.destination_process || 'Recutting & Trimming Table',
        vendor_name: 'In-house Cutting Line',
        batch_number: selectedBatchForRework.batch_number,
        reference_id: selectedBatchForRework.id || selectedBatchForRework.batch_number,
      });

      const reworkId = created?.id || (created as any)?.data?.id;
      if (reworkId) {
        await api.sendRework({
          rework_id: reworkId,
          sent_date: new Date().toISOString().split('T')[0],
          vendor_name: 'In-house Cutting Line',
          dc_challan_no: reworkForm.dc_challan_no || `DC-CUT-RWK-${Math.floor(1000 + Math.random() * 9000)}`,
          remarks: reworkForm.remarks,
        });
      }

      setReworkModalOpen(false);
      setToastMessage(`Recut order of ${qty} pcs sent for correction successfully!`);
      loadData();
    } catch (err: any) {
      setReworkError(err?.message || 'Failed to dispatch recut order');
    } finally {
      setSubmittingRework(false);
    }
  };

  // Open Receive Rework modal
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

    setReworkReceiptChallanNo(rec.dc_challan_no ? `INW-${rec.dc_challan_no}` : `INW-RECUT-${Math.floor(1000 + Math.random() * 9000)}`);
    setReworkReceiptDate(new Date().toISOString().split('T')[0]);
    setReworkLotNo(rec.batch_number || `LOT-RECUT-${rec.id || 1}`);
    setReworkReceivedBy('Cutting QC Inspector');
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

  // Submit Receive Reworked Pieces
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
        inspector_name: reworkReceivedBy || 'Cutting QC Inspector',
        reinspection_result: 'Passed Quality Audit',
        reinspection_notes: reworkRemarks || 'Recut pieces received & approved',
        batch_number: reworkLotNo
      });
      setReceiveReworkModalOpen(false);
      setToastMessage(`Recut #${selectedReworkForReceive.rework_order_no} (${reworkReceivedQty} pcs) inward received & accepted! Pieces are ready for stage transfer.`);
      loadData();
    } catch (err: any) {
      console.error('Failed to process rework return:', err);
      setReworkReceiveError(err?.message || 'Failed to confirm rework receipt');
    } finally {
      setSubmittingReceiveRework(false);
    }
  };

  // Transfer accepted rework pieces to next stage
  const handleOpenTransferReworkModal = (rec: ReworkRecord) => {
    const isReceived =
      rec.status === 'Rework Received' ||
      rec.status === 'Accepted After Rework' ||
      (rec.status as string) === 'Completed';
    if (!isReceived) {
      handleOpenReceiveReworkModal(rec);
      setReworkReceiveError(
        'Recut pieces must be inward received before transferring to the next stage. Please confirm inward receipt below.'
      );
      return;
    }

    if ((rec.status as string) === 'Transferred') {
      setToastMessage(`Rework #${rec.rework_order_no} has already been transferred to the next stage.`);
      return;
    }

    // Match parent cutting batch
    const parentBatch =
      batches.find(
        (b) =>
          (rec.batch_number && b.batch_number === rec.batch_number) ||
          (rec.reference_id && (String(b.id) === String(rec.reference_id) || b.batch_number === String(rec.reference_id)))
      ) || batches[0];

    const avail = parentBatch ? getBatchAvailableForTransfer(parentBatch) : 0;
    setSelectedBatch(parentBatch);
    setSelectedReworkForTransfer(rec);
    setTransferForm({
      destination_stage_id: '6',
      transfer_quantity: Math.max(0, avail),
      remarks: '',
    });
    setTransferError('');
    setTransferModalOpen(true);
  };

  // Yield summary
  const yieldSummary = useMemo(() => {
    const totalOrdered = items.reduce((s, i) => s + Number(i.total_quantity || 0), 0);
    const totalCut = batches.reduce((s, b) => s + Number(b.actual_cut_quantity || 0), 0);
    const totalRejected = batches.reduce((s, b) => s + Number(b.rejected_quantity || 0), 0);
    
    // Active rework currently sent to recut line (not yet received back)
    const activeRework = batches.reduce((s, b) => s + getActiveReworkForBatch(b), 0);
    
    // Accepted in hand right now = Total Cut - Active Rework (at recut line) - Rejected
    const totalAccepted = Math.max(0, totalCut - activeRework - totalRejected);
    const totalTransferred = batches.reduce((s, b) => s + Number(b.transferred_to_next_stage_quantity || 0), 0);
    const totalPending = Math.max(0, totalOrdered - totalAccepted);

    const yieldPct = totalCut > 0 ? ((totalAccepted / totalCut) * 100).toFixed(1) : '100.0';

    return {
      totalOrdered,
      totalCut,
      totalAccepted,
      totalRejected,
      totalRework: activeRework,
      totalTransferred,
      totalPending,
      yieldPct,
    };
  }, [items, batches, reworkRecords]);

  // Filtered Cutting Batches
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      if (batchSearch.trim()) {
        const q = batchSearch.toLowerCase();
        const matchNo = (b.batch_number || '').toLowerCase().includes(q);
        const matchProd = (b.product_name || '').toLowerCase().includes(q);
        const matchColor = (b.color || '').toLowerCase().includes(q);
        if (!matchNo && !matchProd && !matchColor) return false;
      }
      if (batchStatusFilter === 'PENDING_INSPECT') {
        const uninspected = Number(b.actual_cut_quantity || 0) - Number(b.accepted_output_quantity || 0) - Number(b.rework_quantity || 0) - Number(b.rejected_quantity || 0);
        return uninspected > 0;
      }
      if (batchStatusFilter === 'ACCEPTED') {
        return Number(b.accepted_output_quantity || 0) > 0 && Number(b.transferred_to_next_stage_quantity || 0) < Number(b.accepted_output_quantity || 0);
      }
      if (batchStatusFilter === 'TRANSFERRED') {
        return Number(b.transferred_to_next_stage_quantity || 0) > 0;
      }
      return true;
    });
  }, [batches, batchSearch, batchStatusFilter]);

  // Filtered Rework Records
  const filteredReworks = useMemo(() => {
    return reworkRecords.filter(r => {
      if (reworkSearch.trim()) {
        const q = reworkSearch.toLowerCase();
        const matchNo = (r.rework_order_no || '').toLowerCase().includes(q);
        const matchDc = (r.dc_challan_no || '').toLowerCase().includes(q);
        const matchProd = (r.product_name || r.display_product_name || '').toLowerCase().includes(q);
        const matchColor = (r.color || '').toLowerCase().includes(q);
        const matchReason = (r?.rework_reason || r.rework_reason || '').toLowerCase().includes(q);
        if (!matchNo && !matchDc && !matchProd && !matchColor && !matchReason) return false;
      }
      if (reworkStatusFilter === 'SENT') {
        return r.status === 'Sent for Rework' || r.status === 'Pending Rework';
      }
      if (reworkStatusFilter === 'RECEIVED') {
        return r.status === 'Rework Received';
      }
      if (reworkStatusFilter === 'COMPLETED') {
        return r.status === 'Accepted After Rework' || (r.status as string) === 'Completed';
      }
      return true;
    });
  }, [reworkRecords, reworkSearch, reworkStatusFilter]);

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

        {/* Stage 04 Dyed Fabric Availability Banner */}
        {dyeingData.totalReceived > 0 ? (
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50/60 to-white p-3.5 sm:p-4 rounded-xl border border-emerald-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-2xs shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-emerald-950">Dyed Fabric Available from Stage 04</span>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {dyeingData.totalTransferred > 0 ? `${fmt(dyeingData.totalTransferred)} MTR Received into Cutting` : `${fmt(dyeingData.totalReceived)} MTR Inwarded`}
                  </span>
                  {dyeingData.totalAccepted > 0 && (
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-300">
                      {fmt(dyeingData.totalAccepted)} MTR QC Accepted
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-emerald-800/90 mt-0.5 truncate">
                  Processed fabric rolls received from dyeing mills are available in stores ready for marker planning & cutting.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/production/dyeing/${order.id}`)}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline shrink-0 flex items-center gap-1 self-start sm:self-center bg-white/80 hover:bg-white px-3 py-1.5 rounded-lg border border-emerald-200 shadow-2xs transition"
            >
              <span>View Stage 04 Dyeing</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <Package className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Fabric dyeing inward pending or in progress in Stage 04 Dyeing.</span>
            </div>
            <button
              onClick={() => navigate(`/production/dyeing/${order.id}`)}
              className="font-bold text-amber-800 hover:text-amber-950 underline shrink-0 text-xs"
            >
              Open Stage 04 Dyeing →
            </button>
          </div>
        )}

        {/* Quick KPI Stat Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned / Target</span>
            <span className="text-base font-bold text-slate-800 font-mono mt-0.5 block">{fmt(yieldSummary.totalOrdered)} pcs</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Actual Cut</span>
            <span className="text-base font-bold text-indigo-700 font-mono mt-0.5 block">{fmt(yieldSummary.totalCut)} pcs</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Accepted Output</span>
            <span className="text-base font-bold text-emerald-700 font-mono mt-0.5 block">{fmt(yieldSummary.totalAccepted)} pcs</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rejection / Scrap</span>
            <span className="text-base font-bold text-red-600 font-mono mt-0.5 block">
              {fmt(yieldSummary.totalRejected)}{' '}
              <span className="text-xs text-slate-400 font-normal">({yieldSummary.totalRework} rwk pcs)</span>
            </span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Transferred Next</span>
            <span className="text-base font-bold text-purple-700 font-mono mt-0.5 block">{fmt(yieldSummary.totalTransferred)} pcs</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cutting Yield %</span>
            <span className="text-base font-bold text-brand-700 font-mono mt-0.5 block">{yieldSummary.yieldPct}%</span>
          </div>
        </div>

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
                  const itRej = itemBatches.reduce((s, b) => s + Number(b.rejected_quantity || 0), 0);
                  const itActiveRwk = itemBatches.reduce((s, b) => s + getActiveReworkForBatch(b), 0);
                  // Accepted in hand right now = Cut - Active Rework sent - Scrap
                  const itAcc = Math.max(0, itCut - itActiveRwk - itRej);
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
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{fmt(itTotal)} pcs</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-indigo-700">{fmt(itCut)} pcs</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">{fmt(itAcc)} pcs</td>
                      <td className="py-3 px-3 text-right font-mono text-red-600 font-semibold">{fmt(itRej)} pcs</td>
                      <td className="py-3 px-3 text-right font-mono text-purple-700 font-semibold">{fmt(itTrf)} pcs</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-600">
                        {itPending > 0 ? `${fmt(itPending)} pcs` : <span className="text-emerald-600">Complete</span>}
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

        {/* TABLE 1: CUTTING BATCHES TABLE (Matching Dyeing Orders View & Fixed 3-dot Action) */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Cutting Batches
              </h3>
              <span className="font-mono text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
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
                <option value="PENDING_INSPECT">Pending Inspection</option>
                <option value="ACCEPTED">Accepted Output</option>
                <option value="TRANSFERRED">Transferred</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-2 w-[36px] text-center">#</th>
                    <th className="py-2.5 px-2.5 w-[120px]">Batch Number</th>
                    <th className="py-2.5 px-2.5 w-[165px]">Product & SKU</th>
                    <th className="py-2.5 px-2 text-right w-[90px]">Cut Qty</th>
                    <th className="py-2.5 px-2.5 w-[125px]">Color / Size</th>
                    <th className="py-2.5 px-2.5 w-[100px]">Cut Date</th>
                    <th className="py-2.5 px-2.5 w-[145px]">Target Stage</th>
                    <th className="py-2.5 px-2 text-center w-[140px]">Status</th>
                    <th className="py-2.5 px-2 text-center w-[55px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        <Scissors className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                        <p className="font-semibold text-xs text-slate-700">No Cutting Batches Found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Click "Record Cut Batch" above to record cutting output from dyed fabric.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((b, idx) => {
                      const cutQty = Number(b.actual_cut_quantity || 0);
                      const activeRwk = getActiveReworkForBatch(b);
                      const rejQty = Number(b.rejected_quantity || 0);
                      const trfQty = Number(b.transferred_to_next_stage_quantity || 0);
                      const availTransfer = getBatchAvailableForTransfer(b);
                      const isTransferred = trfQty > 0;

                      return (
                        <tr key={b.id || idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-2 text-center font-mono text-slate-400 text-[11px] align-middle">
                            {idx + 1}
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-mono font-bold text-xs text-brand-700 block truncate" title={b.batch_number}>
                              {b.batch_number}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-semibold text-slate-800 block text-xs truncate" title={b.product_name}>
                              {b.product_name || 'Garment Product'}
                            </span>
                            {b.product_code && (
                              <span className="text-[10px] font-mono text-brand-600 block truncate">
                                {b.product_code}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-right align-middle whitespace-nowrap">
                            <span className="font-mono font-bold text-indigo-700 text-xs">
                              {fmt(b.actual_cut_quantity)} pcs
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-slate-700 shrink-0" />
                              <span className="font-medium text-slate-800 text-xs truncate" title={b.color}>
                                {b.color || 'Standard'}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                              Size: {b.size || 'M'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle font-mono text-slate-600 text-xs whitespace-nowrap">
                            {b.cutting_date}
                          </td>

                          <td className="py-2.5 px-2.5 align-middle overflow-hidden">
                            {(() => {
                              const destName = b.destination_stage_name || '';
                              const destId = Number(b.destination_stage_id || 0);
                              let stageLabel = '';
                              if (destName) {
                                if (destName.toLowerCase().includes('embroidery')) {
                                  stageLabel = '06. Embroidery';
                                } else if (destName.toLowerCase().includes('stitching')) {
                                  stageLabel = '07. Stitching';
                                } else {
                                  stageLabel = destName.split('—')[0].trim();
                                }
                              } else if (destId === 6) {
                                stageLabel = '06. Embroidery';
                              } else if (destId === 7) {
                                stageLabel = '07. Stitching';
                              }

                              return stageLabel ? (
                                <div className="max-w-full overflow-hidden">
                                  <span
                                    className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-[11px] max-w-full truncate"
                                    title={destName || stageLabel}
                                  >
                                    <ArrowRight className="w-3 h-3 text-purple-600 shrink-0" />
                                    <span className="truncate">{stageLabel}</span>
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px] truncate block" title="Next: 06. Embroidery">
                                  Next: 06. Embroidery
                                </span>
                              );
                            })()}
                          </td>

                          <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap overflow-hidden">
                            {isTransferred && availTransfer <= 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                Transferred ({fmt(trfQty)} pcs)
                              </span>
                            ) : activeRwk > 0 ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Available: {fmt(availTransfer)} pcs
                                </span>
                                <span className="text-[9px] text-amber-700 font-bold mt-0.5">
                                  ({fmt(activeRwk)} rwk sent)
                                </span>
                              </div>
                            ) : isTransferred && availTransfer > 0 ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Available: {fmt(availTransfer)} pcs
                                </span>
                                <span className="text-[9px] text-purple-700 font-bold mt-0.5">
                                  ({fmt(trfQty)} transferred)
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Accepted ({fmt(availTransfer)} pcs)
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                            <button
                              type="button"
                              onClick={(e) => handleToggleBatchMenu(e, b)}
                              className={`p-1.5 rounded-lg border transition shadow-2xs cursor-pointer ${
                                activeBatchMenu?.batchId === b.id
                                  ? 'bg-slate-100 text-slate-900 border-slate-300 ring-2 ring-brand-500/20'
                                  : 'bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-slate-200'
                              }`}
                              title="Batch Actions"
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

            {/* Mobile Cards for Cutting Batches */}
            <div className="md:hidden space-y-3 p-3">
              {filteredBatches.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No cutting batches found.
                </div>
              ) : (
                filteredBatches.map((b, idx) => {
                  const avail = Number(b.accepted_output_quantity || 0) - Number(b.transferred_to_next_stage_quantity || 0);
                  const uninspectedCut = Math.max(0, Number(b.actual_cut_quantity || 0) - Number(b.accepted_output_quantity || 0) - Number(b.rework_quantity || 0) - Number(b.rejected_quantity || 0));

                  return (
                    <div key={`mob_cut_${b.id || idx}`} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-xs font-bold text-brand-700">{b.batch_number}</div>
                          <div className="text-xs text-slate-800 font-semibold mt-0.5">{b.product_name} ({b.color} • {b.size || 'M'})</div>
                        </div>
                        <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {fmt(b.actual_cut_quantity)} pcs
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2 rounded-lg font-mono">
                        <span>Cut Date: {b.cutting_date}</span>
                        <span>Accepted: <strong className="text-emerald-700">{fmt(b.accepted_output_quantity)} pcs</strong></span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleOpenTransferModal(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-2xs cursor-pointer"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Transfer</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenReworkModal(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shadow-2xs cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Rework</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBatchForView(b);
                            setViewBatchModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-2xs cursor-pointer"
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

        {/* TABLE 2: CUTTING REWORK & RECUTTING DETAILS TABLE (DOWN NEXT TO CUTTING BATCHES) */}
        <div className="space-y-3 pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Cutting Rework & Recutting Details
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
                  placeholder="Search rework #, product, color..."
                  className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 w-44 sm:w-56"
                />
              </div>

              <select
                value={reworkStatusFilter}
                onChange={(e) => setReworkStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="SENT">Sent for Recutting</option>
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
                          When cut pieces have dimension, slub, or pattern defects, click "Rework" from the 3-dot action menu on the cutting batch.
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
                            <span className="font-medium text-slate-800 block text-xs truncate" title={rec.destination_process || rec.vendor_name || 'Recutting Table'}>
                              {rec.destination_process || rec.vendor_name || 'Recutting Table'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-semibold text-slate-800 block text-xs truncate" title={rec.product_name || rec.display_product_name}>
                              {rec.product_name || rec.display_product_name || 'Garment Product'}
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
                            <span className="text-slate-700 text-xs block truncate" title={rec?.rework_reason || rec.rework_reason || 'Defect Correction'}>
                              {rec?.rework_reason || rec.rework_reason || 'Defect Correction'}
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
                                activeReworkMenu?.recordId === rec.id
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
                  const canReceive = rec.status === 'Sent for Rework' || rec.status === 'Pending Rework';
                  const isAccepted = rec.status === 'Accepted After Rework' || rec.status === 'Rework Received' || (rec.status as string) === 'Completed';

                  return (
                    <div key={`mob_rwk_${rec.id || idx}`} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-xs font-bold text-brand-700">{rec.rework_order_no}</div>
                          <div className="text-xs text-slate-800 font-semibold mt-0.5">{rec.product_name} ({rec.color || 'Standard'})</div>
                        </div>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {rec.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg flex items-center justify-between font-mono">
                        <span>Reason: {rec?.rework_reason || rec.rework_reason || 'Defect'}</span>
                        <span className="font-bold text-amber-700">{fmt(rec.rework_quantity)} {rec.uom || 'pcs'}</span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleOpenReceiveReworkModal(rec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs cursor-pointer"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Receive</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTransferReworkModal(rec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shadow-2xs cursor-pointer"
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
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-2xs cursor-pointer"
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

      {/* FLOATING ACTION PORTAL: CUTTING BATCHES MENU */}
      {activeBatchMenu &&
        createPortal(
          <div className="fixed inset-0 z-[99999]" onClick={() => setActiveBatchMenu(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: `${activeBatchMenu.top}px`,
                left: `${activeBatchMenu.left}px`,
                width: '136px',
              }}
              className="bg-white border border-slate-200 rounded-xl shadow-xl py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95"
            >
              <div className="py-0.5">
                {/* 1. Transfer */}
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

                {/* 2. Rework */}
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
                  <span>Rework</span>
                </button>

                {/* 3. View */}
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
                  <span>View</span>
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
                width: '136px',
              }}
              className="bg-white border border-slate-200 rounded-xl shadow-xl py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95"
            >
              <div className="py-0.5">
                {/* 1. Receive */}
                <button
                  type="button"
                  onClick={() => {
                    const recordToReceive = activeReworkMenu.record;
                    setActiveReworkMenu(null);
                    handleOpenReceiveReworkModal(recordToReceive);
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
                    const recordToTransfer = activeReworkMenu.record;
                    setActiveReworkMenu(null);
                    handleOpenTransferReworkModal(recordToTransfer);
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

          <div>
            <FormField label="Actual Cut Qty (Pieces)" required>
              <input
                type="number"
                value={batchForm.actual_cut_quantity}
                onChange={(e) => setBatchForm({ ...batchForm, actual_cut_quantity: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                min={1}
                max={batchForm.assigned_quantity || undefined}
              />
            </FormField>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Two-Step Quality Verification Workflow</span>
              <span className="text-amber-800 text-[11px]">
                Record the total completed cut pieces here. Quality inspection, defect categorization, and rework decisions take place in the next step via <strong>Quality Inspection</strong>.
              </span>
            </div>
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
            stageName="Cutting (Stage 05)"
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
        onClose={() => {
          setTransferModalOpen(false);
          setSelectedReworkForTransfer(null);
        }}
        title={`Transfer Output: Batch ${selectedBatch?.batch_number || ''}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          {transferError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{transferError}</span>
            </div>
          )}

          <div className="p-3 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white border border-purple-200 rounded-xl text-xs space-y-1.5 font-mono">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-sans font-medium">Available in Hand to Transfer:</span>
              <strong className="text-purple-700 text-sm font-bold">
                {fmt(selectedBatch ? getBatchAvailableForTransfer(selectedBatch) : 0)} pcs
              </strong>
            </div>
            {selectedBatch && getActiveReworkForBatch(selectedBatch) > 0 && (
              <div className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center justify-between font-sans">
                <span className="flex items-center gap-1 font-medium">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                  Rework at Recut Line:
                </span>
                <span className="font-mono font-bold text-amber-900">
                  {fmt(getActiveReworkForBatch(selectedBatch))} pcs away
                </span>
              </div>
            )}
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

          <FormField label="Quantity to Transfer (Pieces) *" required>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Available to transfer</span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBatch) {
                      setTransferForm({
                        ...transferForm,
                        transfer_quantity: getBatchAvailableForTransfer(selectedBatch),
                      });
                    }
                  }}
                  className="text-[10px] font-bold text-purple-700 hover:underline cursor-pointer"
                >
                  Max ({fmt(selectedBatch ? getBatchAvailableForTransfer(selectedBatch) : 0)} pcs)
                </button>
              </div>
              <input
                type="number"
                min="1"
                max={selectedBatch ? getBatchAvailableForTransfer(selectedBatch) : undefined}
                value={transferForm.transfer_quantity}
                onChange={(e) => setTransferForm({ ...transferForm, transfer_quantity: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-purple-700 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                required
              />
            </div>
          </FormField>

          <FormField label="Transfer Handover Notes">
            <textarea
              rows={2}
              value={transferForm.remarks}
              onChange={(e) => setTransferForm({ ...transferForm, remarks: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              placeholder="Enter transfer notes or bundle codes..."
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              variant="secondary"
              onClick={() => {
                setTransferModalOpen(false);
                setSelectedReworkForTransfer(null);
              }}
            >
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

      {/* MODAL: CREATE REWORK & RECUTTING */}
      <Modal
        isOpen={reworkModalOpen}
        onClose={() => setReworkModalOpen(false)}
        title={selectedBatchForRework ? `Send Cut Pieces for Rework & Recutting — ${selectedBatchForRework.batch_number}` : 'Send for Recutting'}
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

            {/* Batch Context Card */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">{selectedBatchForRework.product_name}</span>
                  {selectedBatchForRework.product_code && (
                    <span className="font-mono text-[10px] text-brand-600 block">{selectedBatchForRework.product_code}</span>
                  )}
                </div>
                <span className="font-mono text-brand-700 font-bold bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                  {selectedBatchForRework.batch_number}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 font-mono text-[11px] pt-1 border-t border-slate-200/60">
                <span>Color: <strong>{selectedBatchForRework.color} • Size {selectedBatchForRework.size || 'M'}</strong></span>
                <span>Cut Total: <strong className="text-slate-900">{fmt(selectedBatchForRework.actual_cut_quantity)} pcs</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Rework / Recut Qty (Pieces) *" required>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Available to Recut</span>
                    <button
                      type="button"
                      onClick={() => {
                        const avail = getBatchAvailableForRework(selectedBatchForRework);
                        setReworkForm({ ...reworkForm, rework_quantity: avail > 0 ? avail : Number(selectedBatchForRework.actual_cut_quantity) });
                      }}
                      className="text-[10px] font-bold text-brand-600 hover:underline cursor-pointer"
                    >
                      Max ({fmt(getBatchAvailableForRework(selectedBatchForRework))} pcs)
                    </button>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={Number(selectedBatchForRework.actual_cut_quantity)}
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
                  placeholder="DC-CUT-RWK-..."
                  required
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Defect Reason *" required>
                <select
                  value={reworkForm.rework_reason}
                  onChange={(e) => setReworkForm({ ...reworkForm, rework_reason: e.target.value, defect_reason: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  required
                >
                  <option value="Measurement / Dimension Variance">Measurement / Dimension Variance</option>
                  <option value="Fabric Flaw / Slub in Cut Piece">Fabric Flaw / Slub in Cut Piece</option>
                  <option value="Incorrect Notching / Grain Line">Incorrect Notching / Grain Line</option>
                  <option value="Pattern Misalignment / Mismatch">Pattern Misalignment / Mismatch</option>
                  <option value="Frayed Edges / Uneven Edge">Frayed Edges / Uneven Edge</option>
                  <option value="Stain / Soil Defect">Stain / Soil Defect</option>
                  <option value="Other Defect">Other Defect</option>
                </select>
              </FormField>

              <FormField label="Expected Return Date" required>
                <input
                  type="date"
                  value={reworkForm.expected_return_date}
                  onChange={(e) => setReworkForm({ ...reworkForm, expected_return_date: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  required
                />
              </FormField>
            </div>

            <FormField label="Destination Process / Recut Line">
              <input
                type="text"
                value={reworkForm.destination_process}
                onChange={(e) => setReworkForm({ ...reworkForm, destination_process: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="e.g. Recutting & Trimming Table"
              />
            </FormField>

            <FormField label="Quality Remarks & Instructions">
              <textarea
                rows={2}
                value={reworkForm.remarks}
                onChange={(e) => setReworkForm({ ...reworkForm, remarks: e.target.value })}
                placeholder="Specify precise trimming or recutting instructions..."
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
                <span>{submittingRework ? 'Sending...' : 'Confirm & Send for Recutting'}</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: INWARD RECEIVE RECUT PIECES RETURN (Matches Dyeing Inward Receive Modal) */}
      <Modal
        isOpen={receiveReworkModalOpen}
        onClose={() => !submittingReceiveRework && setReceiveReworkModalOpen(false)}
        title={`Inward Receive Recut Pieces — ${selectedReworkForReceive?.rework_order_no}`}
        maxWidth="max-w-lg"
      >
        {selectedReworkForReceive && (
          <form onSubmit={handleConfirmReceiveRework} className="space-y-4">
            {reworkReceiveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{reworkReceiveError}</span>
              </div>
            )}

            {/* Metadata 4-field grid with visible borders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Inward Delivery Challan (DC No) *" required>
                <input
                  type="text"
                  value={reworkReceiptChallanNo}
                  onChange={e => setReworkReceiptChallanNo(e.target.value)}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                  placeholder="e.g. INW-RECUT-101"
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

              <FormField label="Lot # / Recut Batch #">
                <input
                  type="text"
                  value={reworkLotNo}
                  onChange={e => setReworkLotNo(e.target.value)}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                  placeholder="e.g. LOT-RECUT-01"
                />
              </FormField>

              <FormField label="Received & Inspected By *">
                <input
                  type="text"
                  value={reworkReceivedBy}
                  onChange={e => setReworkReceivedBy(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                  placeholder="e.g. Cutting QC Inspector"
                  required
                />
              </FormField>
            </div>

            {/* Recut Pieces Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100/90 p-2.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Sent for Recutting</span>
                <span className="font-mono font-bold text-slate-800">
                  {fmt(selectedReworkForReceive.rework_quantity)} {selectedReworkForReceive.uom || 'pcs'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Defect Reason</span>
                <span className="font-semibold text-slate-700 truncate block" title={selectedReworkForReceive?.rework_reason || selectedReworkForReceive.rework_reason}>
                  {selectedReworkForReceive?.rework_reason || selectedReworkForReceive.rework_reason || 'Defect Correction'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Recut Process</span>
                <span className="font-semibold text-slate-700 truncate block">
                  {selectedReworkForReceive.destination_process || 'Recutting Table'}
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
                    {selectedReworkForReceive.product_name || selectedReworkForReceive.display_product_name || 'Garment Product'}
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

            {/* Mandatory Live Camera Photo Proof */}
            <LivePhotoCaptureField
              label="Recut Pieces Physical Verification Photo"
              required={true}
              photo={reworkPhotoUrl}
              onPhotoChange={setReworkPhotoUrl}
              stageName="Cutting Recut Return (Stage 05)"
              orderNumber={order?.order_number || selectedReworkForReceive.rework_order_no}
              error={reworkReceiveError && !reworkPhotoUrl ? 'Real-time camera photograph with live GPS coordinates is mandatory before confirming rework receipt.' : undefined}
              placeholderText="Tap here to open camera"
              helperText="Photograph of recut pieces against pattern specs must be captured live via camera."
              buttonText="Take Real-Time Recut Photo"
            />

            <FormField label="Quality Remarks & Inspection Notes">
              <textarea
                rows={2}
                value={reworkRemarks}
                onChange={e => setReworkRemarks(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                placeholder="e.g. Recut pieces verified against marker dimensions, notches aligned and accepted."
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
                        <span>Inwarding Recut Pieces...</span>
                      </>
                    ) : isAlreadyReceived ? (
                      <>
                        <CheckCheck className="w-4 h-4 mr-1.5" />
                        <span>Rework Quantity Already Received ({fmt(accQty || rQty)} {selectedReworkForReceive.uom || 'pcs'})</span>
                      </>
                    ) : (
                      <>
                        <CheckCheck className="w-4 h-4 mr-1.5" />
                        <span>Confirm & Inward Recut Pieces ({fmt(reworkReceivedQty)} {selectedReworkForReceive.uom || 'pcs'})</span>
                      </>
                    )}
                  </Button>
                </div>
              );
            })()}
          </form>
        )}
      </Modal>

      {/* MODAL: VIEW CUTTING BATCH DETAILS */}
      <Modal
        isOpen={viewBatchModalOpen}
        onClose={() => setViewBatchModalOpen(false)}
        title={selectedBatchForView ? `Cutting Batch Details — ${selectedBatchForView.batch_number}` : 'Batch Details'}
        maxWidth="max-w-lg"
      >
        {selectedBatchForView && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">{selectedBatchForView.product_name}</span>
                <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                  {selectedBatchForView.batch_number}
                </span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 text-xs font-mono">
                <span>Color: <strong>{selectedBatchForView.color}</strong></span>
                <span>Size: <strong>{selectedBatchForView.size || 'M'}</strong></span>
                <span>Date: <strong>{selectedBatchForView.cutting_date}</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Cut Qty</span>
                <span className="text-sm font-bold font-mono text-indigo-700">{fmt(selectedBatchForView.actual_cut_quantity)} pcs</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] text-emerald-600 uppercase block font-bold">Accepted</span>
                <span className="text-sm font-bold font-mono text-emerald-700">{fmt(selectedBatchForView.accepted_output_quantity)} pcs</span>
              </div>
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                <span className="text-[10px] text-red-600 uppercase block font-bold">Rejected</span>
                <span className="text-sm font-bold font-mono text-red-700">{fmt(selectedBatchForView.rejected_quantity)} pcs</span>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200">
                <span className="text-[10px] text-purple-600 uppercase block font-bold">Transferred</span>
                <span className="text-sm font-bold font-mono text-purple-700">{fmt(selectedBatchForView.transferred_to_next_stage_quantity || 0)} pcs</span>
              </div>
            </div>

            {selectedBatchForView.remarks && (
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Remarks / Notes</span>
                <p>{selectedBatchForView.remarks}</p>
              </div>
            )}

            {/* Proof Photos */}
            {(() => {
              const photos = parsePhotos(selectedBatchForView.photo_urls);
              if (photos.length > 0) {
                return (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700 block">Photographic Evidence</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {photos.map((url, pIdx) => (
                        <div
                          key={pIdx}
                          onClick={() => setPreviewImage(url)}
                          className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:opacity-90 shadow-2xs"
                        >
                          <img src={url} alt="Proof" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setViewBatchModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: VIEW REWORK DETAILS */}
      <Modal
        isOpen={viewReworkModalOpen}
        onClose={() => setViewReworkModalOpen(false)}
        title={selectedReworkForView ? `Recut / Rework Order Details — ${selectedReworkForView.rework_order_no}` : 'Rework Details'}
        maxWidth="max-w-md"
      >
        {selectedReworkForView && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-brand-700 text-sm">{selectedReworkForView.rework_order_no}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedReworkForView.status === 'Accepted After Rework' || (selectedReworkForView.status as string) === 'Completed'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : selectedReworkForView.status === 'Sent for Rework'
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {selectedReworkForView.status}
                </span>
              </div>
              <div className="text-slate-600 font-mono text-[11px] space-y-0.5">
                <div>Product: <strong className="text-slate-900">{selectedReworkForView.product_name || selectedReworkForView.display_product_name}</strong></div>
                <div>Color / Size: <strong>{selectedReworkForView.color || 'Standard'} • Size: {selectedReworkForView.size || 'M'}</strong></div>
                <div>Challan DC: <strong>{selectedReworkForView.dc_challan_no || '—'}</strong></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center font-mono">
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-[10px] text-amber-700 uppercase block font-bold">Rework Qty</span>
                <span className="text-sm font-bold text-amber-800">{fmt(selectedReworkForView.rework_quantity)} {selectedReworkForView.uom || 'pcs'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] text-emerald-700 uppercase block font-bold">Accepted Back</span>
                <span className="text-sm font-bold text-emerald-800">{fmt(selectedReworkForView.accepted_quantity || selectedReworkForView.rework_quantity)} {selectedReworkForView.uom || 'pcs'}</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Defect Reason</span>
                <span className="font-semibold text-slate-800">{selectedReworkForView?.rework_reason || selectedReworkForView.rework_reason || 'Defect Correction'}</span>
              </div>
              {selectedReworkForView.rework_remarks && (
                <div className="pt-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Instructions & Remarks</span>
                  <p className="text-slate-700">{selectedReworkForView.rework_remarks}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setViewReworkModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
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

      {/* Quality Inspection Modal (Stage 05: Cutting) */}
      {selectedBatchForInspect && (
        <StageInspectionModal
          isOpen={showInspectModal}
          onClose={() => {
            setShowInspectModal(false);
            setSelectedBatchForInspect(null);
          }}
          title={`Cut Pieces Quality Inspection — Batch ${selectedBatchForInspect.batch_number}`}
          productionOrderId={Number(order?.id || id)}
          stageId={5}
          stageCode="CUT"
          referenceId={selectedBatchForInspect.batch_number}
          referenceType="Cutting Batch"
          batchNumber={selectedBatchForInspect.batch_number}
          productName={selectedBatchForInspect.product_name || 'Cut Components'}
          color={selectedBatchForInspect.color}
          size={selectedBatchForInspect.size}
          productionOrderItemId={selectedBatchForInspect.production_order_item_id}
          availableQuantity={Math.max(0, Number(selectedBatchForInspect.actual_cut_quantity || 0) - Number(selectedBatchForInspect.accepted_output_quantity || 0) - Number(selectedBatchForInspect.rework_quantity || 0) - Number(selectedBatchForInspect.rejected_quantity || 0))}
          uom="PCS"
          supportsRejection={true}
          onSuccess={async () => {
            setShowInspectModal(false);
            setSelectedBatchForInspect(null);
            setToastMessage('Quality inspection recorded successfully! Accepted balance credited for stage transfer.');
            loadData();
          }}
        />
      )}
    </div>
  );
}
