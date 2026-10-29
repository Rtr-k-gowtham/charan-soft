// src/pages/production/CheckingOrderDetail.tsx
// Stage 08: Checking / Quality Inspection — Bulk Inspection, Traceable Defect Logging, Rework Dispatch & Transfer
// Cheran Soft Goods ERP Design System:
// - Bulk Quality Inspection with row-level validation & live auto-calculated QC Passed output
// - Individual 3-dot product actions: Record Inspection, View Details, To Packing
// - Table 2 Rework Dispatch action preventing duplicate sending
// - Comprehensive product detail view modal with metrics, inspection audits, and rework history
// - Direct stage transfer to Stage 09: Packing
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useStageBackNavigation } from '../../utils/navigation';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, QualityInspection, ReworkRecord } from '../../types';
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
  Boxes,
  MoreVertical,
  Clock,
  Send
} from 'lucide-react';
import StageReworkSection from '../../components/production/StageReworkSection';

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
  const [reworkRecords, setReworkRecords] = useState<ReworkRecord[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Navigation tabs: 'inspections' | 'rework'
  const [activeTab, setActiveTab] = useState<'inspections' | 'rework'>('inspections');
  const [filterMode, setFilterMode] = useState<'ALL' | 'CHECKING'>('ALL');

  // Floating 3-Dot Action Menu for Product Rows in Table 1
  const [activeProductMenu, setActiveProductMenu] = useState<{
    itemId: number;
    top: number;
    left: number;
    item: any;
  } | null>(null);

  // Modal: View Single Product Line Details
  const [viewProductModalOpen, setViewProductModalOpen] = useState(false);
  const [selectedProductForView, setSelectedProductForView] = useState<any | null>(null);

  // Modal: Bulk Quality Inspection
  const [bulkInspectionModalOpen, setBulkInspectionModalOpen] = useState(false);
  const [bulkInspectionLines, setBulkInspectionLines] = useState<Array<{
    item: any;
    order_quantity: number;
    arrived_quantity: number;
    previously_inspected: number;
    available_to_inspect: number;
    checked_quantity: number;
    passed_quantity: number;
    rework_quantity: number;
    rejected_quantity: number;
    defect_category: string;
    defect_description: string;
    rework_stage_id: number;
    rework_destination: string;
    rework_reason: string;
    remarks: string;
    error?: string;
  }>>([]);
  const [bulkInspectionDate, setBulkInspectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkInspector, setBulkInspector] = useState('Lead QC Auditor');
  const [bulkRemarks, setBulkRemarks] = useState('');
  const [bulkPhotoUrls, setBulkPhotoUrls] = useState<string[]>([]);
  const [savingBulkInspection, setSavingBulkInspection] = useState(false);
  const [bulkInspectionError, setBulkInspectionError] = useState('');

  // Single Inspection Modal State
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
    rework_stage_id: 7,
    rework_destination: 'Stitching Correction & Alteration',
    rework_reason: DEFECT_CATEGORIES[0],
    inspector: '',
    remarks: ''
  });
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [savingInspection, setSavingInspection] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal: Send Rework Dispatch
  const [sendReworkModalOpen, setSendReworkModalOpen] = useState(false);
  const [selectedInspectionForRework, setSelectedInspectionForRework] = useState<any | null>(null);
  const [selectedReworkRecord, setSelectedReworkRecord] = useState<any | null>(null);
  const [sendReworkForm, setSendReworkForm] = useState({
    dc_challan_no: '',
    expected_return_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    rework_stage_id: 7,
    destination_process: 'Stitching Correction & Alteration',
    remarks: ''
  });
  const [sendingRework, setSendingRework] = useState(false);
  const [sendReworkError, setSendReworkError] = useState('');

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
        setReworkRecords(payload.rework_records || []);
      } else {
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

  // Close 3-dot floating menu on window scroll or resize
  useEffect(() => {
    const handleScrollOrResize = () => {
      if (activeProductMenu) setActiveProductMenu(null);
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeProductMenu]);

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
      const avail = Math.max(0, arrived - chk);
      pendingInspection += avail;
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

  // Open Bulk Inspection Modal
  const handleOpenBulkInspectionModal = () => {
    const lines = items.map((it) => {
      const orderQ = Number(it.order_quantity || it.total_quantity || 0);
      const arrivedQ = Number(it.arrived_from_stitching ?? it.total_arrived ?? 0);
      const prevInspected = Number(it.checked_quantity || 0);
      const availQ = Math.max(0, arrivedQ - prevInspected);
      const defaultChecked = availQ > 0 ? availQ : 0;
      return {
        item: it,
        order_quantity: orderQ,
        arrived_quantity: arrivedQ,
        previously_inspected: prevInspected,
        available_to_inspect: availQ,
        checked_quantity: defaultChecked,
        passed_quantity: defaultChecked,
        rework_quantity: 0,
        rejected_quantity: 0,
        defect_category: DEFECT_CATEGORIES[0],
        defect_description: '',
        rework_stage_id: 7,
        rework_destination: 'Stitching Correction & Alteration',
        rework_reason: DEFECT_CATEGORIES[0],
        remarks: '',
        error: ''
      };
    });

    setBulkInspectionLines(lines);
    setBulkInspectionDate(new Date().toISOString().split('T')[0]);
    setBulkInspector('Lead QC Auditor');
    setBulkRemarks('');
    setBulkPhotoUrls([]);
    setBulkInspectionError('');
    setBulkInspectionModalOpen(true);
  };

  const handleBulkLineChange = (index: number, field: string, value: any) => {
    setBulkInspectionLines(prev => {
      const updated = [...prev];
      const line = { ...updated[index], [field]: value, error: '' };

      const chk = Math.max(0, Number(line.checked_quantity || 0));
      const rej = Math.max(0, Number(line.rejected_quantity || 0));
      const rwk = Math.max(0, Number(line.rework_quantity || 0));

      if (field === 'checked_quantity' || field === 'rework_quantity' || field === 'rejected_quantity') {
        line.passed_quantity = Math.max(0, chk - rej - rwk);
      }

      updated[index] = line;
      return updated;
    });
  };

  // Submit Bulk Quality Inspection
  const handleSaveBulkInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    const validLines = bulkInspectionLines.filter(l => Number(l.checked_quantity) > 0);
    if (validLines.length === 0) {
      setBulkInspectionError('Please specify an inspection quantity greater than 0 for at least one product line.');
      return;
    }

    let hasValidationError = false;
    const validated = bulkInspectionLines.map(l => {
      const chk = Number(l.checked_quantity || 0);
      const avail = Number(l.available_to_inspect || 0);
      const pass = Number(l.passed_quantity || 0);
      const rej = Number(l.rejected_quantity || 0);
      const rwk = Number(l.rework_quantity || 0);

      if (chk > 0) {
        if (chk > avail) {
          hasValidationError = true;
          return { ...l, error: `Checked quantity (${chk}) exceeds available to inspect (${avail} pcs)` };
        }
        if (Math.abs(chk - (pass + rej + rwk)) > 0.01) {
          hasValidationError = true;
          return { ...l, error: `Tally mismatch: Checked (${chk}) must equal Passed (${pass}) + Rework (${rwk}) + Rejected (${rej})` };
        }
      }
      return { ...l, error: '' };
    });

    setBulkInspectionLines(validated);

    if (hasValidationError) {
      setBulkInspectionError('Please correct row-level quantity errors before submitting.');
      return;
    }

    if (!bulkPhotoUrls || bulkPhotoUrls.length === 0) {
      setBulkInspectionError('Real-time camera photograph with live GPS coordinates of inspected garments is mandatory.');
      return;
    }

    try {
      setSavingBulkInspection(true);
      setBulkInspectionError('');

      const payloadInspections = validLines.map(l => ({
        production_order_item_id: l.item.active_checking_item_id || l.item.id,
        product_id: l.item.product_id,
        product_name: l.item.product_name,
        color: l.item.color,
        size: l.item.size,
        checked_quantity: Number(l.checked_quantity),
        passed_quantity: Number(l.passed_quantity),
        rework_quantity: Number(l.rework_quantity || 0),
        rejected_quantity: Number(l.rejected_quantity || 0),
        defect_category: (Number(l.rejected_quantity || 0) > 0 || Number(l.rework_quantity || 0) > 0) ? l.defect_category : 'Passed Inspection',
        defect_description: l.defect_description,
        rework_stage_id: Number(l.rework_stage_id || 7),
        rework_destination: l.rework_destination || 'Stitching Correction & Alteration',
        rework_reason: l.rework_reason || l.defect_category,
        remarks: l.remarks || bulkRemarks
      }));

      await api.recordBulkQualityInspection({
        production_order_id: Number(order.id),
        inspection_date: bulkInspectionDate,
        inspector: bulkInspector || 'Lead QC Auditor',
        remarks: bulkRemarks,
        photo_urls: bulkPhotoUrls,
        inspections: payloadInspections
      });

      setBulkInspectionModalOpen(false);
      showToast(`Bulk Quality Inspection recorded successfully! ${validLines.length} product lines audited.`);
      await fetchOrderData();
    } catch (err: any) {
      setBulkInspectionError(err?.message || 'Failed to record bulk quality inspection.');
    } finally {
      setSavingBulkInspection(false);
    }
  };

  // Open Single Inspection Modal
  const handleOpenInspectionModal = (item: any, isReinspect = false, origId?: number) => {
    setActiveProductMenu(null);
    setSelectedItem(item);
    setIsReinspection(isReinspect);
    setOriginalInspectionId(origId);

    const available = Number(item.available_to_inspect ?? item.pending_inspection ?? Math.max(0, (Number(item.arrived_from_stitching || 0) - Number(item.checked_quantity || 0))));
    const defaultQty = isReinspect ? Number(item.rework_quantity || available || 0) : (available > 0 ? available : 0);

    setForm({
      inspection_date: new Date().toISOString().split('T')[0],
      arrived_quantity: available,
      checked_quantity: defaultQty,
      rejected_quantity: 0,
      rework_quantity: 0,
      defect_category: DEFECT_CATEGORIES[0],
      defect_description: '',
      rework_stage_id: 7,
      rework_destination: 'Stitching Correction & Alteration',
      rework_reason: DEFECT_CATEGORIES[0],
      inspector: 'Lead QC Auditor',
      remarks: ''
    });
    setPhotoUrls([]);
    setFormError('');
    setModalOpen(true);
  };

  // Submit Single Quality Inspection
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

    if (checked > form.arrived_quantity && form.arrived_quantity > 0) {
      setFormError(`Checked quantity (${checked}) cannot exceed available quantity (${form.arrived_quantity} pcs).`);
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
        stage_id: 8,
        stage_code: 'CHK',
        reference_type: 'Checking QC',
        uom: 'PCS',
        submitted_quantity: checked,
        checked_quantity: checked,
        passed_quantity: passed,
        failed_quantity: rej + rwk,
        rejected_quantity: rej,
        rework_quantity: rwk,
        defect_category: (rej > 0 || rwk > 0) ? form.defect_category : 'Passed Inspection',
        defect_description: form.defect_description,
        color: selectedItem.color,
        size: selectedItem.size,
        rework_stage_id: Number(form.rework_stage_id || 7),
        rework_destination: form.rework_destination || 'Stitching Correction & Alteration',
        rework_reason: form.rework_reason || form.defect_category,
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

  // Open View Product Line Modal
  const handleOpenViewProductModal = (item: any) => {
    setActiveProductMenu(null);
    setSelectedProductForView(item);
    setViewProductModalOpen(true);
  };

  // Open Send Rework Modal
  const handleOpenSendReworkModal = (insp: any) => {
    setSelectedInspectionForRework(insp);

    // Find matching rework record by qc_record_id or batch_number
    const rwk = reworkRecords.find(r => 
      (r.qc_record_id && Number(r.qc_record_id) === Number(insp.id)) ||
      (r.batch_number && insp.batch_number && r.batch_number === insp.batch_number)
    ) || null;

    setSelectedReworkRecord(rwk);
    setSendReworkForm({
      dc_challan_no: rwk?.dc_challan_no || `DC-CHK-${Math.floor(1000 + Math.random() * 9000)}`,
      expected_return_date: rwk?.expected_return_date || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      rework_stage_id: Number(rwk?.rework_stage_id || insp.rework_stage_id || 7),
      destination_process: rwk?.destination_process || insp.rework_destination || 'Stitching Correction & Alteration',
      remarks: rwk?.rework_remarks || insp.defect_description || 'Checking defect routed for rework correction'
    });
    setSendReworkError('');
    setSendReworkModalOpen(true);
  };

  // Submit Send Rework
  const handleConfirmSendRework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !selectedInspectionForRework) return;

    try {
      setSendingRework(true);
      setSendReworkError('');

      let rwkId = selectedReworkRecord?.id;

      // If no pre-existing rework record was created, create one first
      if (!rwkId) {
        const createRes: any = await api.createRework({
          production_order_id: Number(order.id),
          production_order_item_id: selectedInspectionForRework.production_order_item_id,
          stage_id: 8,
          stage_code: 'CHK',
          qc_record_id: selectedInspectionForRework.id,
          color: selectedInspectionForRework.color,
          size: selectedInspectionForRework.size,
          batch_number: selectedInspectionForRework.batch_number,
          rework_quantity: Number(selectedInspectionForRework.rework_quantity),
          uom: 'PCS',
          rework_reason: selectedInspectionForRework.defect_category || 'Quality Defect',
          rework_remarks: sendReworkForm.remarks,
          rework_stage_id: sendReworkForm.rework_stage_id,
          destination_process: sendReworkForm.destination_process,
          dc_challan_no: sendReworkForm.dc_challan_no,
          expected_return_date: sendReworkForm.expected_return_date,
          status: 'Pending Rework'
        });
        const resData = (createRes as any)?.data || createRes;
        rwkId = resData?.rework_id || resData?.id;
      }

      if (!rwkId) {
        throw new Error('Could not identify or create linked rework record.');
      }

      // Dispatch rework
      await api.sendRework({
        rework_id: rwkId,
        dc_challan_no: sendReworkForm.dc_challan_no,
        expected_return_date: sendReworkForm.expected_return_date,
        destination_stage_id: sendReworkForm.rework_stage_id,
        destination_process: sendReworkForm.destination_process,
        remarks: sendReworkForm.remarks
      });

      setSendReworkModalOpen(false);
      showToast(`Rework batch (${selectedInspectionForRework.rework_quantity} pcs) successfully dispatched with DC #${sendReworkForm.dc_challan_no}!`);
      await fetchOrderData();
    } catch (err: any) {
      setSendReworkError(err?.message || 'Failed to dispatch rework.');
    } finally {
      setSendingRework(false);
    }
  };

  // Open Transfer to Packing Modal
  const handleOpenTransferModal = (itOrInsp?: any) => {
    setActiveProductMenu(null);
    let it = itOrInsp;
    let insId: number | undefined = undefined;
    if (itOrInsp && itOrInsp.batch_number && itOrInsp.checked_quantity !== undefined) {
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
    setTransferRemarks('');
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
    if (filterMode === 'CHECKING') {
      return items.filter(it => Number(it.arrived_from_stitching || it.total_arrived || 0) > 0);
    }
    return items;
  }, [items, filterMode]);

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

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('inspections')}
          className={`pb-3 pt-1 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'inspections'
              ? 'border-brand-600 text-brand-700 bg-brand-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          Inspections & Passed Output ({inspections.length})
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
          Stage 08 Rework & Routing
          {overallTotals.totalRework > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              {fmt(overallTotals.totalRework)} pcs
            </span>
          )}
        </button>
      </div>

      {activeTab === 'inspections' && (
        <>
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

              <div className="flex items-center gap-2.5 self-start sm:self-center flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterMode('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filterMode === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Products ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('CHECKING')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filterMode === 'CHECKING'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  In Checking ({items.filter(it => Number(it.arrived_from_stitching || 0) > 0).length})
                </button>

                {/* MAIN BULK RECORD INSPECTION BUTTON */}
                <Button
                  id="btn-bulk-record-inspection"
                  variant="primary"
                  size="sm"
                  onClick={handleOpenBulkInspectionModal}
                  disabled={overallTotals.pendingInspection <= 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ml-1"
                  title={overallTotals.pendingInspection > 0 ? "Record bulk inspection for all eligible product lines" : "No pending quantities available to inspect"}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Record Inspection</span>
                </Button>
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

                          {/* ACTIONS COLUMN WITH 3-DOT MENU */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {avail > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  Ready ({fmt(avail)})
                                </span>
                              ) : readyToPack > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Passed ({fmt(readyToPack)})
                                </span>
                              ) : (transferredToPacking > 0 || passed > 0) ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shadow-2xs">
                                  In Packing
                                </span>
                              ) : arrivedStitching === 0 ? (
                                <span className="text-[11px] text-slate-400 italic">
                                  Awaiting Stitching
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                  Completed
                                </span>
                              )}

                              {/* 3-DOT ACTION BUTTON */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setActiveProductMenu({
                                    itemId: it.id || idx,
                                    top: rect.bottom + 4,
                                    left: Math.max(10, rect.right - 170),
                                    item: it,
                                  });
                                }}
                                className="w-7 h-7 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition cursor-pointer"
                                title="Product Line Actions"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
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
                    <th className="py-3 px-4 text-center min-w-[150px]">Actions</th>
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
                      const photos = parsePhotos(insp.photo_urls);

                      // Match linked rework record
                      const matchingRwk = reworkRecords.find(r =>
                        (r.qc_record_id && Number(r.qc_record_id) === Number(insp.id)) ||
                        (r.batch_number && insp.batch_number && r.batch_number === insp.batch_number)
                      );
                      const isReworkDispatched = matchingRwk && (
                        matchingRwk.status === 'Sent for Rework' ||
                        matchingRwk.status === 'Accepted After Rework' ||
                        matchingRwk.status === 'Completed' ||
                        matchingRwk.status === 'IN REWORK'
                      );

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

                          {/* REWORK & TRANSFER ACTIONS */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* Rework Button / Dispatched Badge */}
                              {rwk > 0 && (
                                isReworkDispatched ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    <RotateCcw className="w-3 h-3 text-amber-600" />
                                    <span>{matchingRwk?.status || 'Sent for Rework'}</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSendReworkModal(insp)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition"
                                    title="Dispatch rework pieces to correction line"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Send to Rework ({fmt(rwk)})</span>
                                  </button>
                                )
                              )}

                              {/* To Packing Action */}
                              {insp.status === 'Transferred to Packing' || (insp as any).is_transferred ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>In Packing</span>
                                </span>
                              ) : pass > 0 ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenTransferModal(insp)}
                                  className="text-[11px] text-emerald-700 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1 py-1 px-2 font-semibold"
                                  title="Transfer approved quantity to Stage 09: Packing"
                                >
                                  <span>To Packing</span>
                                  <ArrowRight className="w-3 h-3" />
                                </Button>
                              ) : null}
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
        </>
      )}

      {activeTab === 'rework' && (
        <StageReworkSection
          productionOrderId={Number(order?.id || id)}
          stageId={8}
          stageCode="CHK"
          stageName="Checking"
          uom="PCS"
          onReload={fetchOrderData}
        />
      )}

      {/* FLOATING 3-DOT ACTION MENU PORTAL */}
      {activeProductMenu &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-transparent"
            onClick={() => setActiveProductMenu(null)}
          >
            <div
              className="absolute z-50 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
              style={{ top: activeProductMenu.top, left: activeProductMenu.left }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const it = activeProductMenu.item;
                const arrivedStitching = Number(it.arrived_from_stitching ?? it.total_arrived ?? 0);
                const inspected = Number(it.checked_quantity || 0);
                const avail = Math.max(0, arrivedStitching - inspected);
                const passed = Number(it.passed_quantity || 0);
                const transferredToPacking = Number(it.transferred_to_packing || 0);
                const readyToPack = Math.max(0, passed - transferredToPacking);

                return (
                  <>
                    <button
                      type="button"
                      disabled={avail <= 0}
                      onClick={() => {
                        const item = activeProductMenu.item;
                        setActiveProductMenu(null);
                        handleOpenInspectionModal(item);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition text-left cursor-pointer ${
                        avail > 0
                          ? 'text-blue-700 hover:bg-blue-50'
                          : 'text-slate-400 bg-slate-50 cursor-not-allowed'
                      }`}
                      title={avail > 0 ? "Record single quality inspection" : "No quantity available to inspect"}
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Record Inspection {avail > 0 ? `(${avail})` : ''}</span>
                    </button>

                    {readyToPack > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const item = activeProductMenu.item;
                          setActiveProductMenu(null);
                          handleOpenTransferModal(item);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 font-medium transition text-left cursor-pointer"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>To Packing ({readyToPack})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const item = activeProductMenu.item;
                        setActiveProductMenu(null);
                        handleOpenViewProductModal(item);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium transition text-left cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>View Details</span>
                    </button>
                  </>
                );
              })()}
            </div>
          </div>,
          document.body
        )}

      {/* MODAL: BULK QUALITY INSPECTION ENTRY */}
      <Modal
        isOpen={bulkInspectionModalOpen}
        onClose={() => setBulkInspectionModalOpen(false)}
        title="Record Bulk Quality Inspection — Stage 08 Checking"
        subtitle={`Order: ${order?.order_number || ''} • Audit multiple product lines in a single submission`}
        maxWidth="max-w-5xl"
      >
        <form onSubmit={handleSaveBulkInspection} className="space-y-4">
          {bulkInspectionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{bulkInspectionError}</span>
            </div>
          )}

          {/* Common Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Inspection Date *
              </label>
              <input
                type="date"
                value={bulkInspectionDate}
                onChange={(e) => setBulkInspectionDate(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-mono"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Lead QC Auditor *
              </label>
              <input
                type="text"
                value={bulkInspector}
                onChange={(e) => setBulkInspector(e.target.value)}
                placeholder="e.g. Lead QC Auditor"
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Common Protocol / Notes
              </label>
              <input
                type="text"
                value={bulkRemarks}
                onChange={(e) => setBulkRemarks(e.target.value)}
                placeholder="e.g. 100% audit, SPI & dimension check"
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
              />
            </div>
          </div>

          {/* Product Lines List */}
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {bulkInspectionLines.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No product lines available in this production order.
              </div>
            ) : (
              bulkInspectionLines.map((line, idx) => {
                const it = line.item;
                const isIncluded = Number(line.checked_quantity) > 0;

                return (
                  <div
                    key={it.id || idx}
                    className={`p-3.5 rounded-xl border transition ${
                      isIncluded
                        ? 'bg-blue-50/20 border-blue-200 shadow-2xs'
                        : 'bg-white border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      {/* Left: Product specs & stock balances */}
                      <div className="lg:w-5/12">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-400">#{idx + 1}</span>
                          <span className="font-bold text-slate-900 text-xs">{it.product_name || 'Garment Product'}</span>
                          {it.product_code && (
                            <span className="font-mono text-[11px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              {it.product_code}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600 flex-wrap">
                          <span>Color: <strong className="text-slate-800">{it.color || 'Standard'}</strong></span>
                          <span>•</span>
                          <span>Size: <strong className="text-slate-800">{it.size || 'M'}</strong></span>
                          <span>•</span>
                          <span>Order: <strong className="text-slate-800">{fmt(line.order_quantity)}</strong></span>
                        </div>

                        <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap">
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-semibold">
                            Arrived from Stitching: {fmt(line.arrived_quantity)}
                          </span>
                          <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
                            Inspected: {fmt(line.previously_inspected)}
                          </span>
                          <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-bold">
                            Available: {fmt(line.available_to_inspect)} pcs
                          </span>
                        </div>
                      </div>

                      {/* Right: Quantity Inputs & Calculated Passed Yield */}
                      <div className="lg:w-7/12 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {/* Checked Quantity */}
                          <div>
                            <label className="text-[10px] font-bold text-blue-900 uppercase block mb-1">
                              Checked <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={line.available_to_inspect > 0 ? line.available_to_inspect : 999999}
                              value={line.checked_quantity}
                              onChange={(e) => handleBulkLineChange(idx, 'checked_quantity', Number(e.target.value))}
                              className="w-full text-xs font-mono font-bold border border-blue-300 rounded-lg px-2.5 py-1.5 bg-white text-blue-800 focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>

                          {/* Live Calculated QC Passed */}
                          <div>
                            <label className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">
                              QC Passed
                            </label>
                            <div className="w-full text-xs font-mono font-black border border-emerald-300 rounded-lg px-2.5 py-1.5 bg-emerald-50 text-emerald-800 select-none">
                              {line.passed_quantity}
                            </div>
                          </div>

                          {/* Rework Quantity */}
                          <div>
                            <label className="text-[10px] font-bold text-amber-900 uppercase block mb-1">
                              Rework
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={line.rework_quantity}
                              onChange={(e) => handleBulkLineChange(idx, 'rework_quantity', Math.max(0, Number(e.target.value)))}
                              className="w-full text-xs font-mono font-bold border border-amber-300 rounded-lg px-2.5 py-1.5 bg-white text-amber-800 focus:ring-2 focus:ring-amber-500/20"
                            />
                          </div>

                          {/* Rejected Quantity */}
                          <div>
                            <label className="text-[10px] font-bold text-red-900 uppercase block mb-1">
                              Rejected
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={line.rejected_quantity}
                              onChange={(e) => handleBulkLineChange(idx, 'rejected_quantity', Math.max(0, Number(e.target.value)))}
                              className="w-full text-xs font-mono font-bold border border-red-300 rounded-lg px-2.5 py-1.5 bg-white text-red-800 focus:ring-2 focus:ring-red-500/20"
                            />
                          </div>
                        </div>

                        {/* Defect details if rework or rejected > 0 */}
                        {(Number(line.rework_quantity) > 0 || Number(line.rejected_quantity) > 0) && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200">
                            <div>
                              <select
                                value={line.defect_category}
                                onChange={(e) => handleBulkLineChange(idx, 'defect_category', e.target.value)}
                                className="w-full text-[11px] border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-800"
                              >
                                {DEFECT_CATEGORIES.map((cat, cIdx) => (
                                  <option key={cIdx} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <input
                                type="text"
                                placeholder="Defect description / notes"
                                value={line.defect_description}
                                onChange={(e) => handleBulkLineChange(idx, 'defect_description', e.target.value)}
                                className="w-full text-[11px] border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-800 placeholder:text-slate-400"
                              />
                            </div>
                            <div>
                              <select
                                value={line.rework_stage_id}
                                onChange={(e) => {
                                  const sid = Number(e.target.value);
                                  let dName = 'Stitching Correction & Alteration';
                                  if (sid === 6) dName = 'Embroidery Vendor Re-embroidery';
                                  else if (sid === 5) dName = 'Cutting Recut / Panel Replacement';
                                  else if (sid === 4) dName = 'Dyeing Mill Re-dyeing / Strip';
                                  handleBulkLineChange(idx, 'rework_stage_id', sid);
                                  handleBulkLineChange(idx, 'rework_destination', dName);
                                }}
                                className="w-full text-[11px] border border-amber-300 rounded-md px-2 py-1 bg-amber-50 text-amber-900 font-medium"
                              >
                                <option value={7}>To Stage 07 Stitching</option>
                                <option value={6}>To Stage 06 Embroidery</option>
                                <option value={5}>To Stage 05 Cutting</option>
                                <option value={4}>To Stage 04 Dyeing</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {line.error && (
                          <div className="text-[11px] font-semibold text-red-600 flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span>{line.error}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Mandatory Real-Time Camera Photograph */}
          <LivePhotoCaptureField
            label="Defect & Quality Audit Photographs"
            required={true}
            photos={bulkPhotoUrls}
            onPhotosChange={setBulkPhotoUrls}
            stageName="Checking & QC (Stage 08)"
            orderNumber={order?.order_number}
            error={bulkInspectionError && bulkPhotoUrls.length === 0 ? 'Real-time camera photograph with live GPS coordinates is mandatory before recording inspection.' : undefined}
            buttonText="Take Real-Time QC Photo"
          />

          {/* Submission Tally Bar */}
          {(() => {
            const valid = bulkInspectionLines.filter(l => Number(l.checked_quantity) > 0);
            const totalChk = valid.reduce((s, l) => s + Number(l.checked_quantity), 0);
            const totalPass = valid.reduce((s, l) => s + Number(l.passed_quantity), 0);
            const totalRwk = valid.reduce((s, l) => s + Number(l.rework_quantity), 0);
            const totalRej = valid.reduce((s, l) => s + Number(l.rejected_quantity), 0);

            return (
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="font-bold text-slate-700">
                    Lines to Record: <strong className="text-slate-900">{valid.length}</strong> / {bulkInspectionLines.length}
                  </span>
                  <span>•</span>
                  <span>Checked: <strong className="text-blue-700 font-mono">{fmt(totalChk)}</strong></span>
                  <span>•</span>
                  <span>Passed: <strong className="text-emerald-700 font-mono">{fmt(totalPass)}</strong></span>
                  <span>•</span>
                  <span>Rework: <strong className="text-amber-700 font-mono">{fmt(totalRwk)}</strong></span>
                  <span>•</span>
                  <span>Rejected: <strong className="text-red-700 font-mono">{fmt(totalRej)}</strong></span>
                </div>
              </div>
            );
          })()}

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkInspectionModalOpen(false)}
              disabled={savingBulkInspection}
            >
              Cancel
            </Button>
            <Button
              id="btn-submit-bulk-quality-inspection"
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingBulkInspection}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 shadow-xs"
            >
              {savingBulkInspection ? 'Saving Inspections...' : 'Save All Inspections'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: SINGLE PRODUCT LINE QUALITY INSPECTION */}
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

          {Number(form.rework_quantity) > 0 && (
            <div className="pt-2 border-t border-amber-200/80 bg-amber-50/60 p-3 rounded-lg space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-amber-900 block mb-1">
                    Rework Destination Stage *
                  </label>
                  <select
                    value={form.rework_stage_id}
                    onChange={e => {
                      const sid = Number(e.target.value);
                      let destName = 'Stitching Correction & Alteration';
                      if (sid === 6) destName = 'Embroidery Vendor Re-embroidery';
                      else if (sid === 5) destName = 'Cutting Recut / Panel Replacement';
                      else if (sid === 4) destName = 'Dyeing Mill Re-dyeing / Strip';
                      setForm({ ...form, rework_stage_id: sid, rework_destination: destName });
                    }}
                    className="w-full text-xs rounded border border-amber-300 py-1.5 px-2 bg-white font-medium text-amber-900"
                  >
                    <option value={7}>Stage 07 — Stitching (Correction & Alteration)</option>
                    <option value={6}>Stage 06 — Embroidery (Vendor Re-embroidery)</option>
                    <option value={5}>Stage 05 — Cutting (Panel Replacement / Recutting)</option>
                    <option value={4}>Stage 04 — Dyeing (Color Stripping & Re-dyeing)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-amber-900 block mb-1">
                    Correction Process / Destination Line
                  </label>
                  <input
                    type="text"
                    value={form.rework_destination}
                    onChange={e => setForm({ ...form, rework_destination: e.target.value })}
                    className="w-full text-xs rounded border border-amber-300 py-1.5 px-2 bg-white font-medium text-slate-800"
                  />
                </div>
              </div>
            </div>
          )}

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
            stageName="Checking & QC (Stage 08)"
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

      {/* MODAL: VIEW PRODUCT LINE DETAILS */}
      <Modal
        isOpen={viewProductModalOpen}
        onClose={() => {
          setViewProductModalOpen(false);
          setSelectedProductForView(null);
        }}
        title={`Product Details — ${selectedProductForView?.product_name || 'Product'}`}
        maxWidth="max-w-3xl"
      >
        {selectedProductForView && (() => {
          const it = selectedProductForView;
          const orderQ = Number(it.order_quantity || it.total_quantity || 0);
          const arrivedStitching = Number(it.arrived_from_stitching ?? it.total_arrived ?? 0);
          const inspected = Number(it.checked_quantity || 0);
          const passed = Number(it.passed_quantity || 0);
          const rej = Number(it.rejected_quantity || 0);
          const rwk = Number(it.rework_quantity || 0);
          const avail = Math.max(0, arrivedStitching - inspected);
          const transferredToPacking = Number(it.transferred_to_packing || 0);
          const readyToPack = Math.max(0, passed - transferredToPacking);

          const itemInspections = inspections.filter(ins =>
            (ins.production_order_item_id && Number(ins.production_order_item_id) === Number(it.active_checking_item_id || it.id)) ||
            (ins.color && String(ins.color).trim() === String(it.color).trim())
          );

          const itemReworks = reworkRecords.filter(r =>
            (r.production_order_item_id && Number(r.production_order_item_id) === Number(it.active_checking_item_id || it.id)) ||
            (r.color && String(r.color).trim() === String(it.color).trim())
          );

          return (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{it.product_name}</h4>
                  {it.product_code && (
                    <span className="font-mono text-xs text-blue-600 block">{it.product_code}</span>
                  )}
                  <div className="text-xs text-slate-600 mt-1">
                    Color: <strong className="text-slate-800">{it.color || 'Standard'}</strong> • Size: <strong className="text-slate-800">{it.size || 'M'}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Order Quantity</span>
                  <span className="text-lg font-black text-slate-900 font-mono">{fmt(orderQ)} pcs</span>
                </div>
              </div>

              {/* Mini Stat Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-2.5 bg-blue-50/50 rounded-lg border border-blue-100">
                  <span className="text-[10px] font-bold uppercase text-blue-700 block">From Stitching</span>
                  <span className="text-base font-black text-blue-900 font-mono">{fmt(arrivedStitching)} pcs</span>
                </div>
                <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100">
                  <span className="text-[10px] font-bold uppercase text-indigo-700 block">Total Inspected</span>
                  <span className="text-base font-black text-indigo-900 font-mono">{fmt(inspected)} pcs</span>
                </div>
                <div className="p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 block">QC Passed</span>
                  <span className="text-base font-black text-emerald-900 font-mono">{fmt(passed)} pcs</span>
                </div>
                <div className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-100">
                  <span className="text-[10px] font-bold uppercase text-amber-700 block">Under Rework</span>
                  <span className="text-base font-black text-amber-900 font-mono">{fmt(rwk)} pcs</span>
                </div>
                <div className="p-2.5 bg-red-50/50 rounded-lg border border-red-100">
                  <span className="text-[10px] font-bold uppercase text-red-700 block">Rejected (Scrap)</span>
                  <span className="text-base font-black text-red-900 font-mono">{fmt(rej)} pcs</span>
                </div>
                <div className="p-2.5 bg-purple-50/50 rounded-lg border border-purple-100">
                  <span className="text-[10px] font-bold uppercase text-purple-700 block">Ready to Pack</span>
                  <span className="text-base font-black text-purple-900 font-mono">{fmt(readyToPack)} pcs</span>
                </div>
              </div>

              {/* Inspection Audit Batches for this Item */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Inspection Audit History ({itemInspections.length})
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] text-slate-500 uppercase">
                        <th className="py-2 px-3">Batch #</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-2 text-right">Checked</th>
                        <th className="py-2 px-2 text-right text-emerald-700">Passed</th>
                        <th className="py-2 px-2 text-right text-amber-700">Rework</th>
                        <th className="py-2 px-2 text-right text-red-700">Rejected</th>
                        <th className="py-2 px-3">Defect Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {itemInspections.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-400 font-sans">
                            No inspection audit batches recorded yet for this product line.
                          </td>
                        </tr>
                      ) : (
                        itemInspections.map((insp, iIdx) => (
                          <tr key={insp.id || iIdx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-blue-700">{insp.batch_number}</td>
                            <td className="py-2 px-3 text-slate-600 font-sans">{insp.inspection_date}</td>
                            <td className="py-2 px-2 text-right">{fmt(insp.checked_quantity)}</td>
                            <td className="py-2 px-2 text-right text-emerald-700 font-bold">{fmt(insp.passed_quantity)}</td>
                            <td className="py-2 px-2 text-right text-amber-700">{fmt(insp.rework_quantity)}</td>
                            <td className="py-2 px-2 text-right text-red-700">{fmt(insp.rejected_quantity)}</td>
                            <td className="py-2 px-3 font-sans text-slate-600 truncate max-w-xs">{insp.defect_category || 'Passed'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rework History for this Item */}
              {itemReworks.length > 0 && (
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Rework & Correction Records ({itemReworks.length})
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-amber-50/30 border-b border-amber-200 text-[10px] text-amber-800 uppercase">
                          <th className="py-2 px-3">Rework #</th>
                          <th className="py-2 px-3">Destination Stage</th>
                          <th className="py-2 px-2 text-right">Quantity</th>
                          <th className="py-2 px-3">DC Challan</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 font-mono">
                        {itemReworks.map((rwkRec, rIdx) => (
                          <tr key={rwkRec.id || rIdx} className="hover:bg-amber-50/40">
                            <td className="py-2 px-3 font-bold text-amber-900">{rwkRec.rework_order_no}</td>
                            <td className="py-2 px-3 font-sans text-slate-700">{rwkRec.target_stage_name || rwkRec.destination_process || 'Stitching'}</td>
                            <td className="py-2 px-2 text-right font-bold text-amber-800">{fmt(rwkRec.rework_quantity)} pcs</td>
                            <td className="py-2 px-3 text-slate-600">{rwkRec.dc_challan_no || '—'}</td>
                            <td className="py-2 px-3 font-sans">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                {rwkRec.status || 'Pending Rework'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setViewProductModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* MODAL: SEND TO REWORK */}
      <Modal
        isOpen={sendReworkModalOpen}
        onClose={() => setSendReworkModalOpen(false)}
        title="Dispatch Rework Garments to Correction Line"
        subtitle={`Batch: ${selectedInspectionForRework?.batch_number || ''} • Quantity: ${selectedInspectionForRework?.rework_quantity || 0} pcs`}
        size="md"
      >
        <form onSubmit={handleConfirmSendRework} className="space-y-4">
          {sendReworkError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{sendReworkError}</span>
            </div>
          )}

          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Defect Audit Summary</span>
            <div className="text-xs text-amber-950 font-bold">
              Product: {selectedInspectionForRework?.product_name || 'Garment'} • Color: {selectedInspectionForRework?.color || 'Standard'}
            </div>
            <div className="text-xs text-amber-800">
              Defect: <strong>{selectedInspectionForRework?.defect_category}</strong> {selectedInspectionForRework?.defect_description ? `— ${selectedInspectionForRework.defect_description}` : ''}
            </div>
            <div className="text-xs text-amber-900 font-mono font-bold mt-1">
              Rework Quantity: {selectedInspectionForRework?.rework_quantity || 0} PCS
            </div>
          </div>

          <FormField label="Destination Stage" required>
            <select
              value={sendReworkForm.rework_stage_id}
              onChange={e => {
                const sid = Number(e.target.value);
                let dName = 'Stitching Correction & Alteration';
                if (sid === 6) dName = 'Embroidery Vendor Re-embroidery';
                else if (sid === 5) dName = 'Cutting Recut / Panel Replacement';
                else if (sid === 4) dName = 'Dyeing Mill Re-dyeing / Strip';
                setSendReworkForm({ ...sendReworkForm, rework_stage_id: sid, destination_process: dName });
              }}
              className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white font-medium text-slate-800"
            >
              <option value={7}>Stage 07 — Stitching (Correction & Alteration)</option>
              <option value={6}>Stage 06 — Embroidery (Vendor Re-embroidery)</option>
              <option value={5}>Stage 05 — Cutting (Panel Replacement / Recutting)</option>
              <option value={4}>Stage 04 — Dyeing (Color Stripping & Re-dyeing)</option>
            </select>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="DC / Challan Number" required>
              <input
                type="text"
                value={sendReworkForm.dc_challan_no}
                onChange={e => setSendReworkForm({ ...sendReworkForm, dc_challan_no: e.target.value })}
                className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                required
              />
            </FormField>

            <FormField label="Expected Return Date" required>
              <input
                type="date"
                value={sendReworkForm.expected_return_date}
                onChange={e => setSendReworkForm({ ...sendReworkForm, expected_return_date: e.target.value })}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                required
              />
            </FormField>
          </div>

          <FormField label="Correction Instructions / Handover Remarks">
            <textarea
              rows={2}
              value={sendReworkForm.remarks}
              onChange={e => setSendReworkForm({ ...sendReworkForm, remarks: e.target.value })}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-800 placeholder:text-slate-400"
              placeholder="e.g. Alter side seams, restitch collar, return by Thursday morning..."
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSendReworkModalOpen(false)}
              disabled={sendingRework}
            >
              Cancel
            </Button>
            <Button
              id="btn-confirm-send-rework"
              variant="primary"
              size="sm"
              type="submit"
              disabled={sendingRework}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingRework ? 'Dispatching...' : 'Confirm Rework Dispatch'}</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: TRANSFER TO STAGE 09 PACKING */}
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

      {/* MODAL: IMAGE ZOOM PREVIEW */}
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
