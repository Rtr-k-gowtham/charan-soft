// src/pages/production/DyeingOrderDetail.tsx
// Stage 04: Fabric Dyeing Orders & Inward Receiving with Pantone Colors & Photo Proof
// Redesigned to strict Cheran Soft Goods ERP design system: Table-based layout, ERP palette,
// dynamic fabric material dropdown, and Total Outward Fabric field removed from Create form.
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useStageBackNavigation } from '../../utils/navigation';
import { api } from '../../lib/api';
import {
  ProductionOrder,
  ProductionStage,
  DyeingOrder,
  DyeingOrderItem,
  DyeingReceipt,
  ReworkRecord
} from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import SearchableSelect, { SelectOption } from '../../components/ui/SearchableSelect';
import { LivePhotoCaptureField } from '../../components/production/LivePhotoCaptureField';
import {
  lookupPantone,
  VERIFIED_PANTONE_LIBRARY
} from '../../lib/pantoneService';
import JobWorkDocumentModal, { JobWorkDocType } from '../../components/documents/JobWorkDocumentModal';
import StageReworkSection from '../../components/production/StageReworkSection';
import StageInspectionModal from '../../components/production/StageInspectionModal';
import {
  ArrowLeft,
  MoreVertical,
  RotateCcw,
  Droplets,
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
  Eye,
  Trash2,
  X,
  ShieldCheck,
  Plus,
  Palette,
  Sparkles,
  ArrowRight,
  Boxes,
  CheckCheck,
  Search,
  Building2,
  Save,
  FileSpreadsheet,
  Scissors
} from 'lucide-react';

const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n || 0);

interface EligibleFabricMaterial {
  material_id: number;
  material_code?: string;
  material_name: string;
  uom: string;
  inward_quantity: number;
  outward_quantity: number;
  available_quantity: number;
}

interface NewColorRow {
  color_name: string;
  pantone_code: string;
  hex_code: string;
  planned_quantity: number | '';
  uom?: string;
  rate_per_unit: number | '';
  tax_percent?: number;
  notes: string;
  required_quantity?: number;
  allocated_quantity?: number;
  remaining_eligible_quantity?: number;
  is_fully_allocated?: boolean;
  existing_orders?: string[];
}

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

export default function DyeingOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const handleBack = useStageBackNavigation('/production/dyeing');

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [dyeingOrders, setDyeingOrders] = useState<DyeingOrder[]>([]);
  const [fabricStockData, setFabricStockData] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Tabs: 'orders' | 'history' | 'rework'
  const [activeTab, setActiveTab] = useState<'orders' | 'history' | 'rework'>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<number>>(new Set());

  // Create Dyeing Order Modal & Full Page State
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreatePage, setShowCreatePage] = useState<boolean>(() => searchParams.get('create') === 'true');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isAdditionalLot, setIsAdditionalLot] = useState<boolean>(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [categoryType, setCategoryType] = useState<string>('FABRIC DYEING ORDER');
  const [fabricMaterialId, setFabricMaterialId] = useState<number | undefined>(undefined);
  const [fabricName, setFabricName] = useState<string>('');
  const [fabricSearchQuery, setFabricSearchQuery] = useState('');
  const [uom, setUom] = useState<string>('MTR');
  const [challanNo, setChallanNo] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [processType, setProcessType] = useState<string>('Fabric Dyeing');
  const [remarks, setRemarks] = useState<string>('');

  // Color breakdown rows
  const [colorRows, setColorRows] = useState<NewColorRow[]>([]);

  // Receive Dyed Fabric Modal
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedDyeingOrder, setSelectedDyeingOrder] = useState<DyeingOrder | null>(null);
  const [receivingItems, setReceivingItems] = useState<{
    item_id: number;
    color_name: string;
    pantone_code: string;
    hex_code: string;
    planned_quantity: number;
    already_received: number;
    received_quantity: number;
    accepted_quantity?: number;
    rework_quantity?: number;
    rework_reason?: string;
    shrinkage_loss_percent: number;
    shade_match_status: string;
    lot_number?: string;
    notes: string;
  }[]>([]);
  const [receiptChallanNo, setReceiptChallanNo] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptLotNo, setReceiptLotNo] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [shadeCondition, setShadeCondition] = useState('Approved - Pantone Matched');
  const [receiptRemarks, setReceiptRemarks] = useState('');
  const [savingReceive, setSavingReceive] = useState(false);
  const [receiveError, setReceiveError] = useState('');

  // Quality Inspection Modal State (Stage 04: Dyeing)
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [selectedReceiptForInspect, setSelectedReceiptForInspect] = useState<any>(null);

  // 3-dot Action Menu state for Dyeing Orders table
  const [activeDyeingMenu, setActiveDyeingMenu] = useState<{
    orderId: number;
    top: number;
    left: number;
    dOrder: any;
  } | null>(null);

  const handleToggleDyeingMenu = (e: React.MouseEvent<HTMLButtonElement>, dOrder: any) => {
    e.stopPropagation();
    if (activeDyeingMenu?.orderId === dOrder.id) {
      setActiveDyeingMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuWidth = 144;
      const totalPlanned = Number(dOrder.total_fabric_quantity || 0);
      const totalRec = Number(dOrder.total_received_quantity || 0);
      const isFullyReceived = dOrder.status === 'Received' || (totalRec >= totalPlanned && totalPlanned > 0);
      const menuHeight = isFullyReceived ? 165 : 125;

      let top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight && rect.top > menuHeight) {
        top = rect.top - menuHeight - 4;
      }

      let left = rect.right - menuWidth;
      if (left < 10) left = 10;
      if (left + menuWidth > window.innerWidth - 10) {
        left = window.innerWidth - menuWidth - 10;
      }

      setActiveDyeingMenu({
        orderId: dOrder.id,
        top,
        left,
        dOrder,
      });
    }
  };

  // 3-dot Action Menu state for Rework table
  const [activeReworkMenu, setActiveReworkMenu] = useState<{
    recordId: number;
    top: number;
    left: number;
    record: ReworkRecord;
  } | null>(null);

  const handleToggleReworkMenu = (e: React.MouseEvent<HTMLButtonElement>, record: ReworkRecord) => {
    e.stopPropagation();
    if (activeReworkMenu?.recordId === record.id) {
      setActiveReworkMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuWidth = 144;
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
    }
  };

  // Click outside / scroll / escape listener for floating menus
  useEffect(() => {
    if (!activeDyeingMenu && !activeReworkMenu) return;
    const closeAll = () => {
      setActiveDyeingMenu(null);
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
  }, [activeDyeingMenu, activeReworkMenu]);

  // Rework Records State & Loader
  const [reworkRecords, setReworkRecords] = useState<ReworkRecord[]>([]);
  const [loadingRework, setLoadingRework] = useState(false);

  const loadReworkRecords = async () => {
    const poId = Number(order?.id || id);
    if (!poId) return;
    try {
      setLoadingRework(true);
      const res = await api.getReworkRecords({
        production_order_id: poId,
        stage_id: 4,
      });
      setReworkRecords(Array.isArray(res) ? res : ((res as any)?.data || []));
    } catch (err) {
      console.warn('Failed to load rework records', err);
    } finally {
      setLoadingRework(false);
    }
  };

  useEffect(() => {
    if (order?.id || id) {
      loadReworkRecords();
    }
  }, [order?.id, id]);

  // Popup Form: Send Fabric for Rework
  const [reworkModalOpen, setReworkModalOpen] = useState(false);
  const [selectedOrderForRework, setSelectedOrderForRework] = useState<any>(null);
  const [reworkForm, setReworkForm] = useState({
    rework_quantity: 0,
    rework_reason: 'Shade Mismatch / Uneven Dyeing',
    expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    dc_challan_no: '',
    remarks: '',
    selected_color: '',
  });
  const [submittingRework, setSubmittingRework] = useState(false);
  const [reworkError, setReworkError] = useState('');

  const handleOpenReworkModal = (dOrder: any) => {
    setSelectedOrderForRework(dOrder);
    const totalRec = Number(dOrder.total_received_quantity || dOrder.total_fabric_quantity || 0);
    const firstColor = dOrder.items?.[0]?.pantone_code || dOrder.items?.[0]?.color_name || dOrder.color_name || '';
    setReworkForm({
      rework_quantity: totalRec > 0 ? totalRec : 10,
      rework_reason: 'Shade Mismatch / Uneven Dyeing',
      expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      dc_challan_no: `DC-RWK-${Math.floor(1000 + Math.random() * 9000)}`,
      remarks: '',
      selected_color: firstColor,
    });
    setReworkError('');
    setReworkModalOpen(true);
  };

  const handleConfirmCreateRework = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedOrderForRework) return;
    const poId = Number(order?.id || id);
    const qty = Number(reworkForm.rework_quantity);
    const maxAvailable = Number(selectedOrderForRework.total_received_quantity || selectedOrderForRework.total_fabric_quantity || 0);

    if (qty <= 0) {
      setReworkError('Please enter a valid rework quantity greater than 0.');
      return;
    }
    if (qty > maxAvailable) {
      setReworkError(`Rework quantity cannot exceed received quantity (${maxAvailable} ${selectedOrderForRework.uom || 'MTR'}).`);
      return;
    }

    setSubmittingRework(true);
    setReworkError('');
    try {
      const created = await api.createRework({
        production_order_id: poId,
        stage_id: 4,
        stage_code: 'DYE',
        product_name: selectedOrderForRework.fabric_name,
        color: reworkForm.selected_color || selectedOrderForRework.items?.[0]?.pantone_code || 'General',
        rework_quantity: qty,
        uom: selectedOrderForRework.uom || 'MTR',
        rework_reason: reworkForm.rework_reason,
        rework_remarks: reworkForm.remarks,
        destination_process: 'Fabric Re-dyeing & Color Correction',
        vendor_name: selectedOrderForRework.dyeing_mill_name || selectedOrderForRework.supplier_name,
      });

      const reworkId = created?.id || (created as any)?.data?.id;
      if (reworkId) {
        await api.sendRework({
          rework_id: reworkId,
          sent_date: new Date().toISOString().split('T')[0],
          vendor_name: selectedOrderForRework.dyeing_mill_name || selectedOrderForRework.supplier_name,
          dc_challan_no: reworkForm.dc_challan_no || `DC-RWK-${Math.floor(1000 + Math.random() * 9000)}`,
          remarks: reworkForm.remarks,
        });
      }

      setReworkModalOpen(false);
      setSuccessToast(`Rework order of ${qty} ${selectedOrderForRework.uom || 'MTR'} sent to ${selectedOrderForRework.dyeing_mill_name || 'mill'} successfully!`);
      await loadData();
      await loadReworkRecords();
    } catch (err: any) {
      setReworkError(err?.message || 'Failed to dispatch rework');
    } finally {
      setSubmittingRework(false);
    }
  };

  // Popup Form: Receive Reworked Fabric Return (Matches Dyeing Order Inward Modal)
  const [receiveReworkModalOpen, setReceiveReworkModalOpen] = useState(false);
  const [selectedReworkForReceive, setSelectedReworkForReceive] = useState<ReworkRecord | null>(null);
  const [reworkReceiptChallanNo, setReworkReceiptChallanNo] = useState('');
  const [reworkReceiptDate, setReworkReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [reworkLotNo, setReworkLotNo] = useState('');
  const [reworkReceivedBy, setReworkReceivedBy] = useState('');
  const [reworkReceivedQty, setReworkReceivedQty] = useState(0);
  const [reworkPhotoUrl, setReworkPhotoUrl] = useState<string | null>(null);
  const [reworkRemarks, setReworkRemarks] = useState('');
  const [reworkReceiveError, setReworkReceiveError] = useState('');
  const [submittingReceiveRework, setSubmittingReceiveRework] = useState(false);

  const handleOpenReceiveReworkModal = (rec: ReworkRecord) => {
    setSelectedReworkForReceive(rec);
    const rQty = Number(rec.rework_quantity || 0);
    setReworkReceiptChallanNo(rec.dc_challan_no ? `INW-${rec.dc_challan_no}` : `INW-RWK-${Math.floor(1000 + Math.random() * 9000)}`);
    setReworkReceiptDate(new Date().toISOString().split('T')[0]);
    setReworkLotNo(rec.batch_number || `LOT-RWK-${rec.id || 1}`);
    setReworkReceivedBy(receivedBy || 'Quality Inspector');
    setReworkReceivedQty(rQty);
    setReworkPhotoUrl(null);
    setReworkRemarks('');
    setReworkReceiveError('');
    setReceiveReworkModalOpen(true);
  };

  const handleConfirmReceiveRework = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedReworkForReceive) return;
    setReworkReceiveError('');

    if (reworkReceivedQty <= 0) {
      setReworkReceiveError('Received quantity must be greater than 0');
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
        inspector_name: reworkReceivedBy || 'Dyeing QC Inspector',
        reinspection_result: 'Passed Quality Audit',
        reinspection_notes: reworkRemarks || 'Reworked fabric received & approved',
        batch_number: reworkLotNo
      });
      setReceiveReworkModalOpen(false);
      setSuccessToast(`Rework #${selectedReworkForReceive.rework_order_no} (${reworkReceivedQty} ${selectedReworkForReceive.uom || 'MTR'}) inward received & accepted! Fabric is now in-hand.`);
      await loadData();
      await loadReworkRecords();
    } catch (err: any) {
      console.error('Failed to process rework return:', err);
      setReworkReceiveError(err?.message || 'Failed to process rework return');
    } finally {
      setSubmittingReceiveRework(false);
    }
  };

  // Popup Modal: View Rework Record Details
  const [viewReworkModalOpen, setViewReworkModalOpen] = useState(false);
  const [selectedReworkForView, setSelectedReworkForView] = useState<ReworkRecord | null>(null);

  const handleOpenViewReworkModal = (rec: ReworkRecord) => {
    setSelectedReworkForView(rec);
    setViewReworkModalOpen(true);
  };

  // Active rework currently out at mill (status: 'Sent for Rework' or 'Pending Rework')
  const activeReworkOutAtMill = useMemo(() => {
    return reworkRecords
      .filter(r => r.status === 'Sent for Rework' || r.status === 'Pending Rework')
      .reduce((sum, r) => sum + Number(r.rework_quantity || 0), 0);
  }, [reworkRecords]);

  // Total fabric already transferred to Stage 05 (Cutting) in meters
  const totalTransferredToCutting = useMemo(() => {
    return Number(fabricStockData?.total_transferred_to_cutting ?? 0);
  }, [fabricStockData]);

  // Total received fabric from dyeing orders
  const totalDyeingReceived = useMemo(() => {
    const fromStock = Number(fabricStockData?.total_fabric_received_from_dyeing ?? fabricStockData?.total_fabric_received ?? 0);
    const fromOrders = dyeingOrders.reduce((sum, o) => sum + Number(o.total_received_quantity || 0), 0);
    return Math.max(fromStock, fromOrders);
  }, [fabricStockData, dyeingOrders]);

  // In-hand available fabric to transfer to Cutting
  // Formula: Max(0, Total Received from Dyeing - Active Rework Out at Mill - Already Transferred to Cutting)
  const availableInHandForCutting = useMemo(() => {
    return Math.max(0, Number((totalDyeingReceived - activeReworkOutAtMill - totalTransferredToCutting).toFixed(2)));
  }, [totalDyeingReceived, activeReworkOutAtMill, totalTransferredToCutting]);

  // Transfer to Cutting Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferReceipt, setTransferReceipt] = useState<any>(null);
  const [transferQty, setTransferQty] = useState(0);
  const [transferredBy, setTransferredBy] = useState('Dyeing Stores / Inward');
  const [transferNotes, setTransferNotes] = useState('');
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [transferError, setTransferError] = useState('');

  const handleOpenTransferModal = (rec?: any) => {
    setTransferReceipt(rec || null);
    setTransferQty(availableInHandForCutting);
    setTransferredBy('Dyeing Stores / Inward');
    setTransferNotes(`Dyed fabric transferred to Stage 05 Cutting for ${order?.order_number || 'order'}`);
    setTransferError('');
    setTransferModalOpen(true);
  };

  const handleConfirmTransfer = async () => {
    const poId = Number(order?.id || id);
    if (!poId) return;
    if (transferQty <= 0) {
      setTransferError('Transfer quantity must be greater than zero');
      return;
    }
    if (transferQty > (availableInHandForCutting + 0.05)) {
      setTransferError(`Cannot transfer ${transferQty} MTR. Only ${availableInHandForCutting} MTR is available in hand (Total Received: ${totalDyeingReceived} MTR, Active Rework at Mill: ${activeReworkOutAtMill} MTR, Already Transferred: ${totalTransferredToCutting} MTR).`);
      return;
    }
    setSavingTransfer(true);
    setTransferError('');
    try {
      await api.transferDyeingToCutting({
        production_order_id: poId,
        receipt_id: transferReceipt?.id,
        quantity: transferQty,
        transferred_by: transferredBy,
        notes: transferNotes,
      });
      setFabricStockData((prev: any) => prev ? {
        ...prev,
        total_transferred_to_cutting: (Number(prev.total_transferred_to_cutting || 0) + transferQty),
        available_to_transfer_to_cutting: Math.max(0, Number(prev.available_to_transfer_to_cutting || 0) - transferQty)
      } : prev);
      setTransferModalOpen(false);
      setSuccessToast(`Dyed fabric (${transferQty} MTR) transferred to Cutting! Navigating to Stage 05 Cutting...`);
      setTimeout(() => {
        navigate(`/production/cutting/${poId}`);
      }, 700);
    } catch (err: any) {
      setTransferError(err?.message || 'Failed to transfer fabric to cutting');
    } finally {
      setSavingTransfer(false);
    }
  };

  // Photo Proof State
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  // Document Print / Preview Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printDocType, setPrintDocType] = useState<JobWorkDocType>('DYEING_OUTWARD');
  const [printDocItem, setPrintDocItem] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);

  const handleOpenPrintModal = (type: JobWorkDocType, item: any) => {
    setPrintDocType(type);
    setPrintDocItem(item);
    setPrintModalOpen(true);
  };

  // Filtered eligible fabric materials from backend stock data with comprehensive fallback
  const eligibleFabrics = useMemo<EligibleFabricMaterial[]>(() => {
    const rawList: any[] = fabricStockData?.fabric_materials || [];
    const valid = rawList
      .filter((f: any) => {
        const name = (f.material_name || f.item_description || '').toUpperCase();
        // Exclude non-fabric categories & accessories
        const isExcluded =
          name.includes('THREAD') ||
          name.includes('TRIM') ||
          name.includes('ZIPPER') ||
          name.includes('BUTTON') ||
          name.includes('LABEL') ||
          name.includes('POLYBAG') ||
          name.includes('DYE') ||
          name.includes('CARTON');
        return !isExcluded;
      })
      .map((f: any) => ({
        material_id: Number(f.material_id),
        material_code: f.material_code,
        material_name: f.material_name || f.item_description || 'Fabric Material',
        uom: f.uom || 'MTR',
        inward_quantity: Number(f.inward_quantity || 0),
        outward_quantity: Number(f.outward_quantity || 0),
        available_quantity: Number(f.available_quantity || 0),
      }));

    if (valid.length > 0) return valid;

    // Fallback 1: Production order raw materials or BOM items
    const ordMats = (order as any)?.materials;
    if (ordMats && Array.isArray(ordMats) && ordMats.length > 0) {
      const orderFabrics = ordMats
        .filter((m: any) => {
          const mName = (m.material_name || m.name || '').toUpperCase();
          return !mName.includes('THREAD') && !mName.includes('ZIPPER') && !mName.includes('LABEL');
        })
        .map((m: any, idx: number) => ({
          material_id: Number(m.id || m.material_id || (100 + idx)),
          material_code: m.code || m.material_code || `MAT-FAB-00${idx + 1}`,
          material_name: m.material_name || m.name || 'Fabric Material',
          uom: m.uom || 'MTR',
          inward_quantity: Number(m.inward_quantity || 0),
          outward_quantity: 0,
          available_quantity: Number(m.available_quantity || 0),
        }));
      if (orderFabrics.length > 0) return orderFabrics;
    }

    return [];
  }, [fabricStockData, order]);

  // Options for SearchableSelect
  const fabricOptions = useMemo<SelectOption[]>(() => {
    return eligibleFabrics.map(f => ({
      value: String(f.material_id),
      label: `${f.material_name} (${f.material_code || `MAT-${f.material_id}`})`,
      sublabel: `Avail: ${fmt(f.available_quantity, 1)} ${f.uom} • Inwarded: ${fmt(f.inward_quantity, 1)} ${f.uom}`,
    }));
  }, [eligibleFabrics]);

  const supplierOptions = useMemo<SelectOption[]>(() => {
    return suppliers.map(s => ({
      value: String(s.id),
      label: s.name,
      sublabel: `${s.code || 'VEND'} • ${s.phone || s.city || 'Dyeing Mill'}`,
    }));
  }, [suppliers]);

  // Filtered dropdown options with search query
  const searchedFabrics = useMemo(() => {
    if (!fabricSearchQuery.trim()) return eligibleFabrics;
    const q = fabricSearchQuery.toLowerCase();
    return eligibleFabrics.filter(f =>
      f.material_name.toLowerCase().includes(q) ||
      (f.material_code || '').toLowerCase().includes(q)
    );
  }, [eligibleFabrics, fabricSearchQuery]);

  // Selected fabric material details
  const selectedFabric = useMemo(() => {
    return eligibleFabrics.find(f => f.material_id === fabricMaterialId);
  }, [eligibleFabrics, fabricMaterialId]);

  // Available fabric balance for current selection or overall
  const availableFabricBalance = useMemo(() => {
    if (selectedFabric) return selectedFabric.available_quantity;
    return Number(fabricStockData?.balance_available_for_dyeing || 0);
  }, [selectedFabric, fabricStockData]);

  // Helper: Automatically build color rows from production order & available fabric balance
  const buildOrderColors = (ord: any, stock: any, customAvail?: number): NewColorRow[] => {
    // 1. Authoritative color allocations from backend
    const allocations = stock?.color_allocations || stock?.suggested_colors;
    if (allocations && Array.isArray(allocations) && allocations.length > 0 && (allocations[0].remaining_eligible_quantity !== undefined || allocations[0].required_quantity !== undefined)) {
      return allocations.map((c: any) => {
        const cName = (c.color_name || '').trim();
        const pLookup = lookupPantone(cName);
        const verified = VERIFIED_PANTONE_LIBRARY.find(
          p => p.name.toLowerCase() === cName.toLowerCase() || p.name.toLowerCase().includes(cName.toLowerCase())
        );
        const rem = Number(c.remaining_eligible_quantity);
        const req = Number(c.required_quantity);
        const alloc = Number(c.allocated_quantity);
        const eligibleQty = (!isNaN(rem) && rem > 0) ? rem : 0;

        return {
          color_name: cName || 'Standard Color',
          pantone_code: c.pantone_code || pLookup.pantone_code || verified?.code || '',
          hex_code: c.hex_code || pLookup.hex_code || verified?.hex || '#6366f1',
          planned_quantity: eligibleQty,
          rate_per_unit: '',
          tax_percent: 5,
          notes: (c.existing_orders && c.existing_orders.length > 0)
            ? `Existing orders: ${c.existing_orders.join(', ')}`
            : '',
          required_quantity: !isNaN(req) ? req : undefined,
          allocated_quantity: !isNaN(alloc) ? alloc : undefined,
          remaining_eligible_quantity: !isNaN(rem) ? rem : 0,
          is_fully_allocated: Boolean(c.is_fully_allocated ?? (rem <= 0.001)),
          existing_orders: c.existing_orders || []
        };
      });
    }

    const avail = customAvail !== undefined
      ? customAvail
      : (Number(stock?.balance_available_for_dyeing) > 0
        ? Number(stock.balance_available_for_dyeing)
        : 0);

    let candidateList: { color_name: string; pantone_code: string; hex_code: string; garment_qty: number }[] = [];

    // Fallback 1: Try stock.suggested_colors
    if (stock?.suggested_colors && Array.isArray(stock.suggested_colors) && stock.suggested_colors.length > 0) {
      candidateList = stock.suggested_colors.map((c: any) => {
        const cName = (c.color_name || '').trim();
        const pLookup = lookupPantone(cName);
        const verified = VERIFIED_PANTONE_LIBRARY.find(
          p => p.name.toLowerCase() === cName.toLowerCase() || p.name.toLowerCase().includes(cName.toLowerCase())
        );
        return {
          color_name: cName || 'Standard Color',
          pantone_code: c.pantone_code || pLookup.pantone_code || verified?.code || '',
          hex_code: c.hex_code || pLookup.hex_code || verified?.hex || '#6366f1',
          garment_qty: Number(c.total_garment_qty) || 0
        };
      });
    }
    // Fallback 2: Or fallback to ord.items (production_order_items)
    else if (ord?.items && Array.isArray(ord.items) && ord.items.length > 0) {
      const colorMap = new Map<string, number>();
      ord.items.forEach((it: any) => {
        const cName = (it.color || it.color_name || '').trim();
        if (cName) {
          const qty = Number(it.quantity || it.total_quantity || 0);
          colorMap.set(cName, (colorMap.get(cName) || 0) + qty);
        }
      });

      candidateList = Array.from(colorMap.entries()).map(([cName, qty]) => {
        const pLookup = lookupPantone(cName);
        const verified = VERIFIED_PANTONE_LIBRARY.find(
          p => p.name.toLowerCase() === cName.toLowerCase() || p.name.toLowerCase().includes(cName.toLowerCase())
        );
        return {
          color_name: cName,
          pantone_code: pLookup.pantone_code || verified?.code || '',
          hex_code: pLookup.hex_code || verified?.hex || '#6366f1',
          garment_qty: qty
        };
      });
    }

    if (candidateList.length === 0) {
      if (avail > 0) {
        return [{
          color_name: '',
          pantone_code: '',
          hex_code: '#6366f1',
          planned_quantity: avail,
          rate_per_unit: '',
          notes: ''
        }];
      }
      return [];
    }

    // Proportionally distribute fabric yardage
    const totalGarments = candidateList.reduce((sum, c) => sum + c.garment_qty, 0);
    const count = candidateList.length;

    const rows: NewColorRow[] = candidateList.map((c) => {
      let allocatedQty: number;
      if (totalGarments > 0 && c.garment_qty > 0) {
        allocatedQty = Math.round((avail * (c.garment_qty / totalGarments)) * 100) / 100;
      } else {
        allocatedQty = Math.round((avail / count) * 100) / 100;
      }
      return {
        color_name: c.color_name,
        pantone_code: c.pantone_code,
        hex_code: c.hex_code,
        planned_quantity: allocatedQty > 0 ? allocatedQty : 0,
        rate_per_unit: '',
        notes: c.garment_qty > 0 ? `For ${c.garment_qty} pcs in order` : ''
      };
    });

    return rows;
  };

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const orderRes = await api.getProductionOrder(id);
      const ord = (orderRes as any)?.data || orderRes;
      setOrder(ord);

      const numericId = ord?.id ? Number(ord.id) : (Number.isFinite(Number(id)) ? Number(id) : 0);

      const [stgData, stockRes, dyeListRes, suppRes, millsRes, compSettingsRes] = await Promise.all([
        api.getProductionStages().catch(() => []),
        numericId > 0 ? api.getDyeingFabricStock(numericId).catch(() => null) : Promise.resolve(null),
        numericId > 0 ? api.getDyeingOrders(numericId).catch(() => []) : Promise.resolve([]),
        api.getSuppliers().catch(() => []),
        api.getDyeingMills().catch(() => []),
        api.getCompanySettings().catch(() => null),
      ]);
      setStages((stgData || []) as ProductionStage[]);

      const comp = (compSettingsRes as any)?.data || compSettingsRes;
      if (comp) setCompanySettings(comp);

      const stock = (stockRes as any)?.data || stockRes;
      setFabricStockData(stock);

      const dyeList = Array.isArray((dyeListRes as any)?.data)
        ? (dyeListRes as any).data
        : (Array.isArray(dyeListRes) ? dyeListRes : []);
      setDyeingOrders(dyeList);

      const millsList = Array.isArray((millsRes as any)?.data)
        ? (millsRes as any).data
        : (Array.isArray(millsRes) ? millsRes : []);
      const suppList = Array.isArray((suppRes as any)?.data)
        ? (suppRes as any).data
        : (Array.isArray(suppRes) ? suppRes : []);
      const combinedMills = millsList.length > 0
        ? [...millsList, ...suppList.filter((s: any) => !millsList.some((m: any) => (m.name || '').toLowerCase() === (s.name || '').toLowerCase()))]
        : suppList;
      setSuppliers(combinedMills);

      // Pre-select first eligible fabric material with available stock
      const rawMats: any[] = stock?.fabric_materials || [];
      const firstEligible = rawMats.find((f: any) => Number(f.available_quantity) > 0);
      if (firstEligible) {
        setFabricMaterialId(firstEligible.material_id);
        setFabricName(firstEligible.material_name || firstEligible.item_description || 'Cotton Fabric');
        setUom(firstEligible.uom || 'MTR');
      } else if (rawMats.length > 0) {
        setFabricMaterialId(rawMats[0].material_id);
        setFabricName(rawMats[0].material_name || rawMats[0].item_description || 'Cotton Fabric');
        setUom(rawMats[0].uom || 'MTR');
      }

      // Pre-select dyeing supplier if available
      if (stock?.dyeing_mills && stock.dyeing_mills.length > 0) {
        setSelectedSupplierId(String(stock.dyeing_mills[0].id));
      } else if (suppList.length > 0) {
        setSelectedSupplierId(String(suppList[0].id));
      }

      // Generate a default challan number
      setChallanNo(`DC-DYE-${Math.floor(1000 + Math.random() * 9000)}`);

      // Automatically populate color breakdown from Production Order
      const autoColors = buildOrderColors(ord, stock);
      setColorRows(autoColors);

    } catch (err: any) {
      console.error('Error loading dyeing data:', err);
      setError(err?.message || 'Failed to load dyeing workspace data');
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

  // Open Create Dyeing Order Full Page with auto-populated colors & duplicate protection
  const handleOpenCreateModal = () => {
    setChallanNo(`DC-DYE-${Math.floor(1000 + Math.random() * 9000)}`);
    setCreateError('');
    setFabricSearchQuery('');
    setIsAdditionalLot(false);

    // Refresh color rows with latest authoritative allocations
    setColorRows(buildOrderColors(order, fabricStockData, availableFabricBalance));

    setShowCreatePage(true);
    setShowCreateModal(false);
    const next = new URLSearchParams(searchParams);
    next.set('create', 'true');
    setSearchParams(next);
  };

  useEffect(() => {
    if (searchParams.get('create') === 'true' && order) {
      handleOpenCreateModal();
    }
  }, [searchParams, order]);

  const toggleExpandOrder = (orderId: number) => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Handle Photo selection
  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingPhoto(true);
    try {
      const dataUrl = await processImageFile(file, 1200, 0.85);
      setPhotoUrl(dataUrl);
    } catch (err) {
      console.error('Failed to process image:', err);
      alert('Could not process this image. Please select a valid JPEG or PNG file.');
    } finally {
      setIsProcessingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  // Color Row handlers matching PO item structure
  const handleAddColorRow = () => {
    setColorRows([
      ...colorRows,
      {
        color_name: '',
        pantone_code: '',
        hex_code: '#3b82f6',
        planned_quantity: 0,
        uom: uom || 'MTR',
        rate_per_unit: 0,
        tax_percent: 0,
        notes: ''
      }
    ]);
  };

  const handleRemoveColorRow = (index: number) => {
    if (colorRows.length <= 1) return;
    setColorRows(colorRows.filter((_, idx) => idx !== index));
  };

  const handleColorRowChange = (index: number, field: keyof NewColorRow, value: any) => {
    const updated = [...colorRows];
    updated[index] = { ...updated[index], [field]: value };

    // Smart auto-detection for Pantone Code
    if (field === 'pantone_code' && typeof value === 'string') {
      const clean = value.trim();
      if (clean) {
        const lookup = lookupPantone(clean);
        if (lookup.found) {
          if (lookup.name && !updated[index].color_name) {
            updated[index].color_name = lookup.name;
          }
          if (lookup.hex_code) {
            updated[index].hex_code = lookup.hex_code;
          }
        } else {
          const verified = VERIFIED_PANTONE_LIBRARY.find(
            p => p.code.toLowerCase() === clean.toLowerCase() ||
              p.code.toLowerCase().replace(/\s+/g, '') === clean.toLowerCase().replace(/\s+/g, '')
          );
          if (verified) {
            if (!updated[index].color_name) updated[index].color_name = verified.name;
            updated[index].hex_code = verified.hex;
          }
        }
      }
    }

    // Smart auto-detection for Color Name
    if (field === 'color_name' && typeof value === 'string') {
      const clean = value.trim();
      if (clean) {
        const lookup = lookupPantone(clean);
        if (lookup.found) {
          if (lookup.pantone_code) {
            updated[index].pantone_code = lookup.pantone_code;
          }
          if (lookup.hex_code) {
            updated[index].hex_code = lookup.hex_code;
          }
        } else {
          const verified = VERIFIED_PANTONE_LIBRARY.find(
            p => p.name.toLowerCase() === clean.toLowerCase() ||
              p.name.toLowerCase().startsWith(clean.toLowerCase()) ||
              p.name.toLowerCase().includes(clean.toLowerCase())
          );
          if (verified) {
            updated[index].pantone_code = verified.code;
            updated[index].hex_code = verified.hex;
          }
        }
      }
    }

    setColorRows(updated);
  };

  // Re-sync/Reset colors directly from production order
  const handleAutofillColors = () => {
    const autoColors = buildOrderColors(order, fabricStockData, availableFabricBalance);
    setColorRows(autoColors);
  };

  // Total planned across color rows
  const totalPlannedInModal = colorRows.reduce((sum, r) => sum + (Number(r.planned_quantity) || 0), 0);

  // Authoritative quantities and allocation status from backend
  const totalRemainingEligibleFabric = Number(
    fabricStockData?.total_remaining_eligible_fabric !== undefined
      ? fabricStockData.total_remaining_eligible_fabric
      : (fabricStockData?.balance_available_for_dyeing ?? availableFabricBalance ?? 0)
  );

  const hasEligibleAllocation = fabricStockData?.has_eligible_quantity !== undefined
    ? Boolean(fabricStockData.has_eligible_quantity)
    : (totalRemainingEligibleFabric > 0.001);

  const existingAllocatedOrders: string[] = useMemo(() => {
    const set = new Set<string>();
    if (fabricStockData?.color_allocations) {
      fabricStockData.color_allocations.forEach((ca: any) => {
        if (ca.existing_orders) {
          ca.existing_orders.forEach((o: string) => set.add(o));
        }
      });
    }
    dyeingOrders.forEach((d: any) => {
      if (d.status !== 'Cancelled' && d.dyeing_order_no) set.add(d.dyeing_order_no);
    });
    return Array.from(set);
  }, [fabricStockData, dyeingOrders]);

  const hasAnyOverAllocation = useMemo(() => {
    if (!hasEligibleAllocation) return true;
    return colorRows.some(r => {
      const rem = r.remaining_eligible_quantity !== undefined ? Number(r.remaining_eligible_quantity) : undefined;
      if (rem !== undefined && rem <= 0.001) return true;
      if (rem !== undefined && (Number(r.planned_quantity) || 0) > rem + 0.01) return true;
      return false;
    });
  }, [hasEligibleAllocation, colorRows]);

  // Submit Create Dyeing Order (supports Draft and Confirmed outward)
  const handleCreateDyeingOrder = async (orderStatus: 'Draft' | 'Sent to Dyeing' = 'Sent to Dyeing') => {
    setCreateError('');

    // Pre-submission duplicate check
    if (!hasEligibleAllocation || totalRemainingEligibleFabric <= 0.001) {
      const ordsText = existingAllocatedOrders.length > 0 ? ` (${existingAllocatedOrders.join(', ')})` : '';
      setCreateError(`A dyeing order already exists for this material and Pantone color under this production order. The quantity has already been processed. Please check the existing dyeing order${ordsText} before creating another.`);
      return;
    }

    if (!selectedSupplierId) {
      setCreateError('Please select a Dyeing Processor / Mill.');
      return;
    }

    if (colorRows.length === 0) {
      setCreateError('Please specify at least one color item.');
      return;
    }

    const invalidRow = colorRows.find(r => !r.color_name.trim() || Number(r.planned_quantity) <= 0);
    if (invalidRow) {
      setCreateError('Each color line must have a valid Color Name and quantity greater than 0.');
      return;
    }

    // Check if any row exceeds its eligible remaining requirement
    for (const r of colorRows) {
      const rem = r.remaining_eligible_quantity !== undefined ? Number(r.remaining_eligible_quantity) : undefined;
      const planned = Number(r.planned_quantity) || 0;
      if (rem !== undefined && rem <= 0.001) {
        const ordsText = (r.existing_orders && r.existing_orders.length > 0) ? ` (${r.existing_orders.join(', ')})` : '';
        setCreateError(`A dyeing order already exists for this material and Pantone color (${r.color_name}${ordsText}) under this production order. The quantity has already been processed. Please check the existing dyeing order before creating another.`);
        return;
      }
      if (rem !== undefined && planned > rem + 0.01) {
        setCreateError(`Requested quantity (${planned} ${uom}) for '${r.color_name}' exceeds remaining eligible quantity (${rem} ${uom}). Please check existing dyeing orders.`);
        return;
      }
    }

    if (totalPlannedInModal <= 0) {
      setCreateError('Total dyeing outward quantity must be greater than 0.');
      return;
    }

    if (totalPlannedInModal > totalRemainingEligibleFabric + 0.01) {
      setCreateError(`Total outward quantity (${totalPlannedInModal} ${uom}) exceeds the remaining eligible requirement (${totalRemainingEligibleFabric} ${uom}) for this production order.`);
      return;
    }

    setCreating(true);
    try {
      const selectedMill = suppliers.find(s => String(s.id) === selectedSupplierId);
      const numericPoId = Number(order?.id) || (Number.isFinite(Number(id)) ? Number(id) : undefined);

      const payload = {
        production_order_id: numericPoId,
        order_number: order?.order_number,
        supplier_id: Number(selectedSupplierId),
        dyeing_mill_name: selectedMill?.name || 'Processing Mill',
        category_name: categoryType,
        fabric_name: fabricName || 'Fabric Material',
        fabric_code: selectedFabric?.material_code || undefined,
        uom,
        challan_no: challanNo,
        order_date: orderDate,
        expected_delivery_date: expectedDate,
        process_type: processType,
        remarks,
        status: orderStatus,
        is_additional_lot: false,
        allow_overdraft: false,
        force_create: false,
        items: colorRows.map(r => ({
          color_name: r.color_name.trim(),
          pantone_code: r.pantone_code.trim(),
          hex_code: r.hex_code,
          planned_quantity: Number(r.planned_quantity),
          rate_per_unit: Number(r.rate_per_unit) || 0,
          uom: r.uom || uom,
          tax_percent: r.tax_percent !== undefined ? Number(r.tax_percent) : 5,
          notes: r.notes
        }))
      };

      await api.createDyeingOrder(payload);
      setShowCreatePage(false);
      setShowCreateModal(false);
      if (searchParams.get('create')) {
        const next = new URLSearchParams(searchParams);
        next.delete('create');
        setSearchParams(next);
      }
      setSuccessToast(`Dyeing Order ${orderStatus === 'Draft' ? 'saved as Draft' : 'created'} successfully!`);
      await loadData();
    } catch (err: any) {
      console.error('Failed to create dyeing order:', err);
      setCreateError(err?.message || 'Failed to create Dyeing Order. Please check inputs.');
    } finally {
      setCreating(false);
    }
  };

  // Open Receive Dyed Fabric Modal
  const handleOpenReceive = (dOrder: DyeingOrder) => {
    setSelectedDyeingOrder(dOrder);
    setReceiptChallanNo(`INW-DYE-${Math.floor(1000 + Math.random() * 9000)}`);
    setReceiptDate(new Date().toISOString().split('T')[0]);
    const defaultLot = dOrder.dyeing_order_no ? `LOT-${dOrder.dyeing_order_no.replace('DYE-', '')}` : '';
    setReceiptLotNo(defaultLot);
    setPhotoUrl(null);
    setReceiveError('');

    let items = (dOrder.items || []).map(it => {
      const planned = Number(it.planned_quantity || 0);
      const rec = Number(it.received_quantity || 0);
      const remaining = Math.max(0, Number((planned - rec).toFixed(2)));
      return {
        item_id: it.id || 0,
        color_name: it.color_name || 'Fabric Color',
        pantone_code: it.pantone_code || '',
        hex_code: it.hex_code || '#3b82f6',
        planned_quantity: planned,
        already_received: rec,
        received_quantity: remaining,
        accepted_quantity: remaining,
        rework_quantity: 0,
        rework_reason: 'Shade Mismatch / Uneven Dyeing',
        shrinkage_loss_percent: 0,
        shade_match_status: 'Approved - Pantone Matched',
        lot_number: defaultLot,
        notes: ''
      };
    });

    // If order has no color items or legacy, create a default row for the order fabric
    if (items.length === 0) {
      const planned = Number(dOrder.total_fabric_quantity || 0);
      const rec = Number(dOrder.total_received_quantity || 0);
      const remaining = Math.max(0, Number((planned - rec).toFixed(2)));
      items = [{
        item_id: 0,
        color_name: dOrder.fabric_name || 'Dyed Fabric Material',
        pantone_code: '',
        hex_code: '#3b82f6',
        planned_quantity: planned,
        already_received: rec,
        received_quantity: remaining,
        accepted_quantity: remaining,
        rework_quantity: 0,
        rework_reason: 'Shade Mismatch / Uneven Dyeing',
        shrinkage_loss_percent: 0,
        shade_match_status: 'Approved - Pantone Matched',
        lot_number: defaultLot,
        notes: ''
      }];
    }

    setReceivingItems(items);
    setShowReceiveModal(true);
  };

  const handleReceiveItemChange = (index: number, field: string, value: any) => {
    const updated = [...receivingItems];
    updated[index] = { ...updated[index], [field]: value };

    // Auto calculate shrinkage loss % if received_quantity changes
    if (field === 'received_quantity') {
      const rec = value === '' ? 0 : Number(value);
      const rwk = Number(updated[index].rework_quantity || 0);
      updated[index].accepted_quantity = Math.max(0, Number((rec - rwk).toFixed(2)));
      const sent = Number(updated[index].planned_quantity || 0);
      if (sent > 0 && rec >= 0) {
        const diff = sent - rec;
        const shrinkage = diff > 0 ? Number(((diff / sent) * 100).toFixed(2)) : 0;
        updated[index].shrinkage_loss_percent = shrinkage;
      }
    }

    if (field === 'rework_quantity') {
      const rwk = value === '' ? 0 : Number(value);
      const rec = Number(updated[index].received_quantity || 0);
      updated[index].accepted_quantity = Math.max(0, Number((rec - rwk).toFixed(2)));
    }

    if (field === 'accepted_quantity') {
      const acc = value === '' ? 0 : Number(value);
      const rec = Number(updated[index].received_quantity || 0);
      updated[index].rework_quantity = Math.max(0, Number((rec - acc).toFixed(2)));
    }

    setReceivingItems(updated);
  };

  const handleFillItemMax = (index: number) => {
    const updated = [...receivingItems];
    const it = updated[index];
    const remaining = Math.max(0, Number((it.planned_quantity - it.already_received).toFixed(2)));
    updated[index] = {
      ...it,
      received_quantity: remaining,
      accepted_quantity: remaining,
      rework_quantity: 0,
      shrinkage_loss_percent: 0
    };
    setReceivingItems(updated);
  };

  const handleFillAllRemaining = () => {
    const updated = receivingItems.map(it => {
      const remaining = Math.max(0, Number((it.planned_quantity - it.already_received).toFixed(2)));
      return {
        ...it,
        received_quantity: remaining,
        accepted_quantity: remaining,
        rework_quantity: 0,
        shrinkage_loss_percent: 0
      };
    });
    setReceivingItems(updated);
  };

  const handleClearAllQuantities = () => {
    const updated = receivingItems.map(it => ({
      ...it,
      received_quantity: 0,
      accepted_quantity: 0,
      rework_quantity: 0
    }));
    setReceivingItems(updated);
  };

  const handleAddReceiveColorRow = () => {
    setReceivingItems(prev => [
      ...prev,
      {
        item_id: 0,
        color_name: `Additional Lot ${prev.length + 1}`,
        pantone_code: '',
        hex_code: '#6366f1',
        planned_quantity: 0,
        already_received: 0,
        received_quantity: 0,
        accepted_quantity: 0,
        rework_quantity: 0,
        rework_reason: 'Shade Mismatch / Uneven Dyeing',
        shrinkage_loss_percent: 0,
        shade_match_status: 'Approved - Pantone Matched',
        lot_number: receiptLotNo || '',
        notes: ''
      }
    ]);
  };

  // Submit Inward Receive from Dyeing
  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDyeingOrder) return;
    setReceiveError('');

    const totalToReceive = receivingItems.reduce((sum, it) => sum + (Number(it.received_quantity) || 0), 0);
    if (totalToReceive <= 0) {
      setReceiveError('Please enter a received quantity greater than 0 for at least one color item.');
      return;
    }

    if (!photoUrl) {
      setReceiveError('Real-time camera photograph with live GPS coordinates is mandatory before confirming dyed fabric receipt.');
      return;
    }

    setSavingReceive(true);
    try {
      const numericPoId = Number(order?.id) || Number(selectedDyeingOrder.production_order_id) || (Number.isFinite(Number(id)) ? Number(id) : undefined);
      const payload = {
        production_order_id: numericPoId,
        order_number: order?.order_number,
        receipt_date: receiptDate,
        delivery_challan_no: receiptChallanNo,
        lot_number: receiptLotNo,
        received_by: receivedBy,
        photo_url: photoUrl,
        shade_condition: shadeCondition,
        remarks: receiptRemarks,
        items: receivingItems.map(it => ({
          item_id: it.item_id,
          color_name: it.color_name,
          planned_quantity: Number(it.planned_quantity || 0),
          received_quantity: Number(it.received_quantity || 0),
          shrinkage_loss_percent: Number(it.shrinkage_loss_percent || 0),
          shade_match_status: it.shade_match_status || 'Approved - Pantone Matched',
          lot_number: it.lot_number || receiptLotNo,
          notes: it.notes
        }))
      };

      await api.receiveDyeingOrder(selectedDyeingOrder.id, payload);
      setShowReceiveModal(false);
      setSelectedDyeingOrder(null);
      setSuccessToast(`Dyed fabric inward receipt recorded successfully! Ready for Quality Inspection.`);
      await loadData();
    } catch (err: any) {
      console.error('Failed to receive dyed fabric:', err);
      setReceiveError(err?.message || 'Failed to record dyeing receipt');
    } finally {
      setSavingReceive(false);
    }
  };

  // All receipts across dyeing orders
  const allDyeingReceipts: any[] = useMemo(() => {
    const list: any[] = [];
    dyeingOrders.forEach(d => {
      (d.receipts || []).forEach(r => {
        list.push({
          ...r,
          dyeing_order_no: d.dyeing_order_no,
          dyeing_mill_name: d.dyeing_mill_name || d.supplier_name,
          fabric_name: d.fabric_name,
          uom: d.uom
        });
      });
    });
    return list;
  }, [dyeingOrders]);

  // Filtered Dyeing Orders by Search and Status
  const filteredDyeingOrders = useMemo(() => {
    return dyeingOrders.filter(d => {
      if (statusFilter !== 'ALL' && d.status !== statusFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchNo = d.dyeing_order_no.toLowerCase().includes(q);
      const matchMill = (d.dyeing_mill_name || d.supplier_name || '').toLowerCase().includes(q);
      const matchFab = d.fabric_name.toLowerCase().includes(q);
      const matchDC = (d.challan_no || '').toLowerCase().includes(q);
      const matchColors = (d.items || []).some(it =>
        it.color_name.toLowerCase().includes(q) || (it.pantone_code || '').toLowerCase().includes(q)
      );
      return matchNo || matchMill || matchFab || matchDC || matchColors;
    });
  }, [dyeingOrders, statusFilter, searchQuery]);

  // Filtered Receipts by Search
  const filteredReceipts = useMemo(() => {
    if (!searchQuery.trim()) return allDyeingReceipts;
    const q = searchQuery.toLowerCase();
    return allDyeingReceipts.filter(r =>
      (r.receipt_no || '').toLowerCase().includes(q) ||
      (r.dyeing_order_no || '').toLowerCase().includes(q) ||
      (r.dyeing_mill_name || '').toLowerCase().includes(q) ||
      (r.delivery_challan_no || '').toLowerCase().includes(q) ||
      (r.shade_condition || '').toLowerCase().includes(q)
    );
  }, [allDyeingReceipts, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-600 mb-3" />
        <p className="text-sm font-semibold text-slate-700">Loading Stage 04: Dyeing Workspace...</p>
        <p className="text-xs text-slate-400 mt-1">Cross-referencing fabric inward balance, dyeing orders, and Pantone shades</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Failed to Load Dyeing Workspace</h4>
            <p className="text-xs mt-1">{error || 'Order not found'}</p>
            <Button onClick={handleBack} className="mt-3 text-xs" variant="secondary">
              Back to Dyeing Stage
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const totalFabricInwarded = Number(fabricStockData?.total_fabric_inwarded || 0);
  const totalFabricOutward = Number(fabricStockData?.total_fabric_outward || 0);
  const totalFabricReceived = Number(fabricStockData?.total_fabric_received_from_dyeing || 0);
  const balanceToOutward = Number(fabricStockData?.balance_available_for_dyeing || 0);

  // =========================================================================
  // FULL PAGE: CREATE DYEING ORDER & DELIVERY CHALLAN (STAGE 04)
  // =========================================================================
  if (showCreatePage && order) {
    const totalQty = colorRows.reduce((sum, r) => sum + (Number(r.planned_quantity) || 0), 0);
    const totalTaxable = colorRows.reduce((sum, r) => {
      const q = Number(r.planned_quantity) || 0;
      const rt = Number(r.rate_per_unit) || 0;
      return sum + (q * rt);
    }, 0);
    const totalTax = colorRows.reduce((sum, r) => {
      const q = Number(r.planned_quantity) || 0;
      const rt = Number(r.rate_per_unit) || 0;
      const pct = r.tax_percent !== undefined ? Number(r.tax_percent) : 5;
      return sum + ((q * rt * pct) / 100);
    }, 0);
    const netGrandTotal = totalTaxable + totalTax;

    return (
      <div className="flex flex-col h-full bg-slate-50/70 overflow-y-auto">
        {/* Sticky Top Bar matching Image 2 */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setShowCreatePage(false);
                if (searchParams.get('create')) {
                  const next = new URLSearchParams(searchParams);
                  next.delete('create');
                  setSearchParams(next);
                }
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Orders</span>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Create Dyeing Order</h1>
              <p className="text-xs text-slate-500">Full-page order creation with searchable dropdowns & material catalog</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCreatePage(false);
                if (searchParams.get('create')) {
                  const next = new URLSearchParams(searchParams);
                  next.delete('create');
                  setSearchParams(next);
                }
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              disabled={creating}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleCreateDyeingOrder('Draft')}
              disabled={creating || !hasEligibleAllocation || hasAnyOverAllocation}
              title={
                !hasEligibleAllocation
                  ? "A dyeing order already exists for this material and Pantone color under this production order. The quantity has already been processed."
                  : hasAnyOverAllocation
                    ? "One or more colors exceed eligible remaining quantity."
                    : undefined
              }
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save as Draft</span>
            </button>

            <Button
              type="button"
              loading={creating}
              disabled={!hasEligibleAllocation || hasAnyOverAllocation}
              title={
                !hasEligibleAllocation
                  ? "A dyeing order already exists for this material and Pantone color under this production order. The quantity has already been processed."
                  : hasAnyOverAllocation
                    ? "One or more colors exceed eligible remaining quantity."
                    : undefined
              }
              onClick={() => handleCreateDyeingOrder('Sent to Dyeing')}
              icon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>+ Create Dyeing Order</span>
            </Button>
          </div>
        </div>

        {/* Full Page Body matching Image 2 */}
        <div className="max-w-7xl w-full mx-auto p-6 space-y-6">
          {!hasEligibleAllocation && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-3 shadow-xs">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-amber-900 flex items-center gap-2">
                    <span>⚠️ Dyeing Order Duplicate Prevention</span>
                    <span className="px-2 py-0.5 text-[10px] uppercase font-extrabold bg-amber-200 text-amber-900 rounded">Quantity Processed</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreatePage(false);
                      setActiveTab('orders');
                    }}
                    className="text-xs font-bold text-brand-700 hover:text-brand-900 underline"
                  >
                    View Existing Orders &rarr;
                  </button>
                </div>
                <p className="text-amber-800 leading-relaxed font-medium">
                  A dyeing order already exists for this material and Pantone color under this production order. The quantity has already been processed. Please check the existing dyeing order before creating another.
                </p>
                {existingAllocatedOrders.length > 0 && (
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-amber-900">
                    <span className="font-bold">Existing Order(s):</span>
                    <div className="flex flex-wrap gap-1.5 font-mono font-bold">
                      {existingAllocatedOrders.map(ordNo => (
                        <span key={ordNo} className="px-2 py-0.5 bg-white border border-amber-300 rounded shadow-2xs text-amber-950">
                          {ordNo}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {createError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{createError}</div>
            </div>
          )}

          {/* Section 1: ORDER HEADER & SUPPLIER (Matching Image 2 Card 1) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-brand-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Order Header & Supplier</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SearchableSelect
                label="Supplier"
                required
                value={selectedSupplierId}
                onChange={val => setSelectedSupplierId(val)}
                options={supplierOptions}
                placeholder="— Select Dyeing Mill with Search —"
                searchPlaceholder="Search supplier name or phone..."
              />

              <SearchableSelect
                label="PO Category"
                required
                value={categoryType}
                onChange={val => setCategoryType(val)}
                options={[
                  { value: 'FABRIC DYEING ORDER', label: 'FABRIC DYEING ORDER' },
                  { value: 'YARN DYEING ORDER', label: 'YARN DYEING ORDER' },
                  { value: 'SAMPLE DYEING ORDER', label: 'SAMPLE DYEING ORDER' },
                  { value: 'RE-DYEING & FINISHING', label: 'RE-DYEING & FINISHING' },
                ]}
                placeholder="— Select Category with Search —"
                searchPlaceholder="Search category..."
              />

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Production Order</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
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
                    shape="circle"
                  />
                  <span className="text-xs font-bold text-slate-900 font-mono">{order.order_number}</span>
                  <span className="text-xs text-slate-500 truncate">- {order.title}</span>
                </div>
              </div>

              <FormField
                label="PO Date"
                type="date"
                required
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
              />

              <FormField
                label="Delivery Due Date"
                type="date"
                value={expectedDate}
                onChange={e => setExpectedDate(e.target.value)}
              />


              <FormField label="Outward DC No" required>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={challanNo}
                    onChange={e => setChallanNo(e.target.value)}
                    className="w-full text-xs rounded-lg border-slate-300 py-2 px-3 font-mono font-bold text-slate-900 bg-white pr-8 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="e.g. DC-DYE-6228"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setChallanNo(`DC-DYE-${Math.floor(1000 + Math.random() * 9000)}`)}
                    className="absolute right-2 p-1 text-slate-400 hover:text-brand-600 transition"
                    title="Generate new DC number"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </FormField>

              <FormField label="Process Type">
                <input
                  type="text"
                  value={processType}
                  onChange={e => setProcessType(e.target.value)}
                  className="w-full text-xs rounded-lg border-slate-300 py-2 px-3 font-medium bg-white focus:ring-brand-500 focus:border-brand-500"
                  placeholder="e.g. Reactive Dyeing & Soft Flow"
                />
              </FormField>
            </div>

            <div>
              <FormField
                as="textarea"
                label="Remarks / Terms & Notes"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="PO for FABRIC DYEING ORDER - Production Order ..."
                rows={2}
              />
            </div>
          </div>

          {/* Section 2: Dynamic PO LINE ITEMS Table (Matching Image 2 Card 2) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-brand-600 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">PO Line Items</h2>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200 rounded">
                      {categoryType}: {colorRows.length} DB Columns Loaded
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Table columns and inputs are fetched dynamically from the database (<code>category_fields</code>) for: <strong className="text-slate-600">{categoryType}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleAutofillColors}
                  className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg font-medium shadow-2xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                  <span>Reset to Order Colors</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddColorRow}
                  className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item Row</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-2.5 px-2 text-center text-[10px] uppercase tracking-wider w-12 text-slate-600">S.NO</th>
                    <th className="py-2.5 px-3 text-left text-[10px] uppercase tracking-wider min-w-[220px]">
                      COLOR / FABRIC ITEM <span className="text-red-500 font-bold">*</span>
                    </th>
                    <th className="py-2.5 px-3 text-left text-[10px] uppercase tracking-wider min-w-[140px]">PANTONE CODE</th>
                    <th className="py-2.5 px-3 text-right text-[10px] uppercase tracking-wider min-w-[100px]">
                      QTY <span className="text-red-500 font-bold">*</span>
                    </th>
                    <th className="py-2.5 px-2 text-center text-[10px] uppercase tracking-wider min-w-[80px]">UOM</th>
                    <th className="py-2.5 px-3 text-right text-[10px] uppercase tracking-wider min-w-[100px]">
                      RATE <span className="text-red-500 font-bold">*</span>
                    </th>
                    <th className="py-2.5 px-3 text-right text-[10px] uppercase tracking-wider min-w-[110px]">TAXABLE AMOUNT</th>
                    <th className="py-2.5 px-2 text-center text-[10px] uppercase tracking-wider min-w-[80px]">TAX %</th>
                    <th className="py-2.5 px-3 text-right text-[10px] uppercase tracking-wider min-w-[110px]">TAX AMOUNT</th>
                    <th className="py-2.5 px-3 text-right text-[10px] uppercase tracking-wider min-w-[120px]">NET AMOUNT</th>
                    <th className="py-2.5 px-2 text-center text-[10px] uppercase tracking-wider w-12">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {colorRows.map((row, idx) => {
                    const rowQty = Number(row.planned_quantity) || 0;
                    const rowRate = Number(row.rate_per_unit) || 0;
                    const taxable = rowQty * rowRate;
                    const taxPct = row.tax_percent !== undefined ? Number(row.tax_percent) : 5;
                    const taxAmount = (taxable * taxPct) / 100;
                    const netAmount = taxable + taxAmount;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. S.No */}
                        <td className="py-2 px-2 text-center font-mono text-slate-400 font-bold text-xs">
                          {idx + 1}
                        </td>

                        {/* 2. Color / Fabric Item with Swatch */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={row.hex_code || '#3b82f6'}
                              onChange={e => handleColorRowChange(idx, 'hex_code', e.target.value)}
                              className="w-7 h-7 rounded cursor-pointer border border-slate-300 p-0.5 shrink-0"
                              title="Pick Color Swatch"
                            />
                            <input
                              type="text"
                              list="pantone-colors-datalist"
                              value={row.color_name}
                              onChange={e => handleColorRowChange(idx, 'color_name', e.target.value)}
                              placeholder="e.g. 101 C / Yellow"
                              className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2.5 font-bold text-slate-800 bg-white focus:ring-brand-500 focus:border-brand-500"
                              required
                            />
                          </div>
                          {row.required_quantity !== undefined && (
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-medium">
                              <span>Req: <strong className="text-slate-700">{row.required_quantity}</strong> {uom}</span>
                              <span>&bull;</span>
                              <span>Allocated: <strong className="text-slate-700">{row.allocated_quantity || 0}</strong> {uom}</span>
                              <span>&bull;</span>
                              <span className={row.remaining_eligible_quantity && row.remaining_eligible_quantity > 0 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                                Eligible: {row.remaining_eligible_quantity || 0} {uom}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 3. Pantone Code */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            list="pantone-codes-datalist"
                            value={row.pantone_code}
                            onChange={e => handleColorRowChange(idx, 'pantone_code', e.target.value)}
                            placeholder="e.g. 101 C"
                            className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2.5 font-mono text-slate-800 bg-white font-medium focus:ring-brand-500 focus:border-brand-500"
                          />
                        </td>

                        {/* 4. Qty */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={row.remaining_eligible_quantity !== undefined ? row.remaining_eligible_quantity : undefined}
                            value={row.planned_quantity}
                            onChange={e => handleColorRowChange(idx, 'planned_quantity', e.target.value)}
                            placeholder="0.00"
                            className={`w-full text-xs rounded-lg py-1.5 px-2 text-right font-mono font-bold focus:ring-brand-500 focus:border-brand-500 ${row.remaining_eligible_quantity !== undefined && (Number(row.planned_quantity) || 0) > row.remaining_eligible_quantity + 0.01
                              ? 'border-red-500 bg-red-50 text-red-700'
                              : row.remaining_eligible_quantity !== undefined && row.remaining_eligible_quantity <= 0.001
                                ? 'border-amber-300 bg-amber-50/50 text-slate-500'
                                : 'border-slate-300 text-slate-900 bg-white'
                              }`}
                            required
                          />
                          {row.remaining_eligible_quantity !== undefined && (
                            <div className={`text-[10px] text-right font-semibold mt-0.5 ${(Number(row.planned_quantity) || 0) > row.remaining_eligible_quantity + 0.01
                              ? 'text-red-600 font-bold'
                              : row.remaining_eligible_quantity <= 0.001
                                ? 'text-amber-700 font-bold'
                                : 'text-slate-400'
                              }`}>
                              {row.remaining_eligible_quantity <= 0.001
                                ? '0.00 eligible'
                                : `Max: ${row.remaining_eligible_quantity} ${uom}`}
                            </div>
                          )}
                        </td>

                        {/* 5. UOM */}
                        <td className="py-2 px-2 text-center">
                          <select
                            value={row.uom || uom}
                            onChange={e => handleColorRowChange(idx, 'uom', e.target.value)}
                            className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-1.5 text-center font-semibold text-slate-700 bg-white focus:ring-brand-500 focus:border-brand-500"
                          >
                            <option value="MTR">MTR</option>
                            <option value="KG">KG</option>
                            <option value="PCS">PCS</option>
                            <option value="YDS">YDS</option>
                          </select>
                        </td>

                        {/* 6. Rate */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.rate_per_unit}
                            onChange={e => handleColorRowChange(idx, 'rate_per_unit', e.target.value)}
                            placeholder="0.00"
                            className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2 text-right font-mono font-medium text-slate-800 bg-white focus:ring-brand-500 focus:border-brand-500"
                          />
                        </td>

                        {/* 7. Taxable Amount */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{fmt(taxable, 2)}
                        </td>

                        {/* 8. Tax % */}
                        <td className="py-2 px-2 text-center">
                          <select
                            value={row.tax_percent !== undefined ? row.tax_percent : 5}
                            onChange={e => handleColorRowChange(idx, 'tax_percent', Number(e.target.value))}
                            className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-1 text-center font-semibold text-slate-700 bg-white focus:ring-brand-500 focus:border-brand-500"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                          </select>
                        </td>

                        {/* 9. Tax Amount */}
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          ₹{fmt(taxAmount, 2)}
                        </td>

                        {/* 10. Net Amount */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-brand-700">
                          ₹{fmt(netAmount, 2)}
                        </td>

                        {/* 11. Action */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveColorRow(idx)}
                            disabled={colorRows.length <= 1}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg disabled:opacity-30 transition mx-auto block"
                            title="Remove item row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[11px] text-slate-500 font-bold">
                      Totals ({colorRows.length} Items):
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs font-extrabold text-slate-900">
                      {fmt(totalQty, 2)}
                    </td>
                    <td className="py-2.5 px-2 text-center text-xs text-slate-500 font-semibold">
                      {uom}
                    </td>
                    <td className="py-2.5 px-3"></td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs font-extrabold text-slate-900">
                      ₹{fmt(totalTaxable, 2)}
                    </td>
                    <td className="py-2.5 px-2 text-center text-xs text-slate-500 font-semibold">
                      Avg
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs font-extrabold text-slate-900">
                      ₹{fmt(totalTax, 2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm font-extrabold text-brand-700">
                      ₹{fmt(netGrandTotal, 2)}
                    </td>
                    <td className="py-2.5 px-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/60 overflow-y-auto">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          {successToast}
        </div>
      )}

      {/* Page Header conforming to ERP design system */}
      <PageHeader
        title={`04. Dyeing: ${order.order_number}`}
        subtitle={`Fabric outward challans, Pantone color management & inward receiving for ${order.title}`}
        breadcrumb={[
          { label: 'Production', href: '/production/orders' },
          { label: '04. Dyeing', href: '/production/dyeing' },
          { label: order.order_number },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              onClick={() => navigate(`/production/inward/${order.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
            >
              <Package className="w-3.5 h-3.5 text-slate-500" />
              <span>Stage 03 Inward</span>
            </button>

            <button
              onClick={() => navigate(`/production/cutting/${order?.id || id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 transition shadow-2xs"
              title="Proceed to Stage 05 Cutting for this order"
            >
              <ArrowRight className="w-3.5 h-3.5 text-brand-600" />
              <span>Next: Stage 05 Cutting</span>
            </button>

            <button
              onClick={loadData}
              className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition shadow-2xs"
              title="Refresh Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <Button
              onClick={handleOpenCreateModal}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs px-3 py-1.5"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Create Dyeing Order</span>
            </Button>
          </div>
        }
      />

      <div className="p-3 sm:p-5 max-w-7xl mx-auto w-full flex flex-col gap-4">
        {/* Order Profile Banner Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
                  <span className="font-mono font-bold text-base text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-lg border border-brand-200">
                    {order.order_number}
                  </span>
                  <h2 className="text-base font-bold text-slate-800">{order.customer_name || 'Direct Buyer'}</h2>
                  {order.customer_code && (
                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                      {order.customer_code}
                    </span>
                  )}
                  <StatusBadge status={order.status || 'In Progress'} />
                </div>

                <p className="text-xs font-medium text-slate-600 mt-1">{order.title}</p>

                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                  {order.target_delivery_date && (
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Delivery: <strong>{order.target_delivery_date}</strong>
                    </span>
                  )}
                  <span>
                    Total Order Quantity: <strong className="font-mono text-slate-800">{fmt(order.total_quantity)} garments</strong>
                  </span>
                  <span>
                    Dyeing Orders: <strong className="text-slate-800">{dyeingOrders.length} batches</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                Stage 04: Dyeing
              </span>
            </div>
          </div>
        </div>


        {/* DYEING ORDERS SECTION HEADER & TOOLBAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-brand-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Dyeing Orders
            </h3>
            <span className="font-mono text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
              {dyeingOrders.length}
            </span>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search orders, mills, fabric..."
                className="pl-8 pr-3 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 w-44 sm:w-60 shadow-2xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-2xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="Sent to Dyeing">Sent to Dyeing</option>
              <option value="Partially Received">Partially Received</option>
              <option value="Received">Received</option>
            </select>
          </div>
        </div>

        {/* TABLE 1: DYEING ORDERS TABLE (FIXED LAYOUT WITH REDUCED COLUMN GAPS) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-2 w-[36px] text-center">#</th>
                  <th className="py-2.5 px-2.5 w-[150px]">Mill</th>
                  <th className="py-2.5 px-2.5 w-[160px]">Material</th>
                  <th className="py-2.5 px-2 text-right w-[95px]">Qty</th>
                  <th className="py-2.5 px-2.5 w-[140px]">Color</th>
                  <th className="py-2.5 px-2 w-[95px]">Out Date</th>
                  <th className="py-2.5 px-2 w-[95px]">Exp Date</th>
                  <th className="py-2.5 px-2 text-center w-[115px]">Status</th>
                  <th className="py-2.5 px-2 text-center w-[65px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDyeingOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      <Droplets className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-semibold text-xs text-slate-700">No Dyeing Orders Found</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                        {searchQuery || statusFilter !== 'ALL'
                          ? 'No dyeing orders match your search or filter. Try resetting filters.'
                          : 'Create a dyeing order to split inwarded fabric by color and Pantone code for processing.'}
                      </p>
                      {!searchQuery && statusFilter === 'ALL' && (
                        <Button
                          onClick={handleOpenCreateModal}
                          className="mt-3 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          <span>Create First Dyeing Order</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredDyeingOrders.map((dOrder, idx) => {
                    const totalPlanned = Number(dOrder.total_fabric_quantity || 0);
                    const totalRec = Number(dOrder.total_received_quantity || 0);
                    const isFullyReceived = dOrder.status === 'Received' || (totalRec >= totalPlanned && totalPlanned > 0);
                    const isExpanded = expandedOrderIds.has(dOrder.id);

                    return (
                      <React.Fragment key={dOrder.id}>
                        <tr className={`hover:bg-slate-50/80 transition ${isExpanded ? 'bg-slate-50/50' : ''}`}>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-400 text-[11px] align-middle">
                            {idx + 1}
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-semibold text-slate-800 block text-xs truncate" title={dOrder.dyeing_mill_name || dOrder.supplier_name}>
                              {dOrder.dyeing_mill_name || dOrder.supplier_name || 'Processing Mill'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-medium text-slate-800 block text-xs truncate" title={dOrder.fabric_name}>
                              {dOrder.fabric_name}
                            </span>
                            {dOrder.fabric_code && (
                              <span className="font-mono text-[10px] text-slate-400 block truncate">
                                {dOrder.fabric_code}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-right align-middle whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {fmt(totalPlanned, 1)} {dOrder.uom}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {(dOrder.items || []).slice(0, 3).map((it, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px]"
                                  title={`${it.color_name || ''} ${it.pantone_code ? `(${it.pantone_code})` : ''}`}
                                >
                                  <span
                                    className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                                    style={{ backgroundColor: it.hex_code || '#3b82f6' }}
                                  />
                                  {it.pantone_code && (
                                    <span className="font-mono text-[10px] text-slate-600 hidden lg:inline truncate max-w-[80px]">
                                      {it.pantone_code}
                                    </span>
                                  )}
                                </span>
                              ))}
                              {(dOrder.items || []).length > 3 && (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  +{(dOrder.items || []).length - 3}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-2 text-slate-700 font-medium align-middle whitespace-nowrap">
                            {dOrder.order_date}
                          </td>

                          <td className="py-2.5 px-2 text-slate-600 align-middle whitespace-nowrap">
                            {dOrder.expected_delivery_date || '—'}
                          </td>

                          <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap">
                            <StatusBadge status={dOrder.status} />
                            <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                              Recv: {fmt(totalRec, 1)} / {fmt(totalPlanned, 1)}
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                            <button
                              type="button"
                              onClick={(e) => handleToggleDyeingMenu(e, dOrder)}
                              className={`p-1.5 rounded-lg border transition shadow-2xs ${
                                activeDyeingMenu?.orderId === dOrder.id
                                  ? 'bg-slate-100 text-slate-900 border-slate-300 ring-2 ring-brand-500/20'
                                  : 'bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-slate-200'
                              }`}
                              title="Action Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Color Breakdown Details */}
                        {isExpanded && (
                          <tr className="bg-slate-50/60">
                            <td colSpan={9} className="py-3 px-4 border-t border-b border-slate-200/80">
                              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <Palette className="w-3.5 h-3.5 text-brand-600" />
                                    Color Breakdown for {dOrder.dyeing_order_no}
                                  </h4>
                                  <span className="text-xs text-slate-500 font-medium">
                                    Total Outward: <strong className="text-slate-900 font-mono">{fmt(totalPlanned, 1)} {dOrder.uom}</strong>
                                  </span>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px]">
                                      <tr>
                                        <th className="py-2 px-3">Color & Pantone Standard</th>
                                        <th className="py-2 px-3 text-right">Planned Outward</th>
                                        <th className="py-2 px-3 text-right">Received Inward</th>
                                        <th className="py-2 px-3 text-right">Shrinkage %</th>
                                        <th className="py-2 px-3">Shade Match Status</th>
                                        <th className="py-2 px-3">Notes</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {(dOrder.items || []).map((it) => (
                                        <tr key={it.id} className="hover:bg-slate-50/50">
                                          <td className="py-2 px-3">
                                            <div className="flex items-center gap-2">
                                              <span
                                                className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                                                style={{ backgroundColor: it.hex_code || '#3b82f6' }}
                                              />
                                              <span className="font-semibold text-slate-800">{it.color_name}</span>
                                              {it.pantone_code && (
                                                <span className="font-mono text-[10px] text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">
                                                  {it.pantone_code}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                            {fmt(it.planned_quantity, 1)} {dOrder.uom}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700">
                                            {fmt(Number(it.received_quantity || 0), 1)} {dOrder.uom}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                                            {it.shrinkage_loss_percent ? `${fmt(it.shrinkage_loss_percent, 1)}%` : '0%'}
                                          </td>
                                          <td className="py-2 px-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${it.shade_match_status?.includes('Approved') || it.shade_match_status?.includes('Matched')
                                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                                              }`}>
                                              {it.shade_match_status || 'Pending Verification'}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-slate-500 text-[11px]">
                                            {it.notes || '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards for Dyeing Orders */}
          <div className="md:hidden space-y-3 p-3">
            {filteredDyeingOrders.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Droplets className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-xs text-slate-700">No Dyeing Orders Found</p>
              </div>
            ) : (
              filteredDyeingOrders.map((dOrder, idx) => {
                const totalPlanned = Number(dOrder.total_fabric_quantity || 0);
                const totalRec = Number(dOrder.total_received_quantity || 0);
                const isFullyReceived = dOrder.status === 'Received' || (totalRec >= totalPlanned && totalPlanned > 0);

                return (
                  <div
                    key={`mob_dye_${dOrder.id}`}
                    className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                            {dOrder.dyeing_order_no}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                          {dOrder.challan_no && (
                            <span className="font-mono text-[10px] text-slate-500">
                              DC: {dOrder.challan_no}
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-slate-900 text-xs mt-1">
                          {dOrder.dyeing_mill_name || dOrder.supplier_name || 'Processing Mill'}
                        </h4>
                      </div>
                      <StatusBadge
                        status={
                          isFullyReceived
                            ? 'Received'
                            : totalRec > 0
                              ? 'Partially Received'
                              : 'Sent to Dyeing'
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Fabric Material
                        </span>
                        <span className="font-medium text-slate-800 text-xs mt-0.5 block truncate">
                          {dOrder.fabric_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Quantities
                        </span>
                        <div className="text-slate-900 font-mono font-bold text-xs mt-0.5">
                          Sent: {fmt(totalPlanned, 1)} {dOrder.uom}
                        </div>
                        <div className="text-emerald-700 font-mono font-semibold text-[11px]">
                          Recv: {fmt(totalRec, 1)} {dOrder.uom}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                      {!isFullyReceived ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenReceive(dOrder)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Receive</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPrintModal('DYEING_OUTWARD', dOrder)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-2xs transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Order</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleExpandOrder(dOrder.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg shadow-2xs transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenReworkModal(dOrder)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shadow-2xs transition"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Rework</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTransferModal()}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shadow-2xs transition"
                          >
                            <ArrowRight className="w-3 h-3" />
                            <span>Transfer</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPrintModal('DYEING_OUTWARD', dOrder)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-2xs transition"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Order</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleExpandOrder(dOrder.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg shadow-2xs transition"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* TABLE 2: FABRIC REWORK & RE-DYEING DETAILS TABLE (DOWN NEXT TO DYEING ORDERS) */}
        <div className="space-y-3 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Fabric Rework & Re-dyeing Details
              </h3>
              <span className="font-mono text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                {reworkRecords.length} {reworkRecords.length === 1 ? 'record' : 'records'}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-2 w-[36px] text-center">#</th>
                    <th className="py-2.5 px-2.5 w-[140px]">Rework # / DC</th>
                    <th className="py-2.5 px-2.5 w-[150px]">Mill / Vendor</th>
                    <th className="py-2.5 px-2.5 w-[170px]">Material & Color</th>
                    <th className="py-2.5 px-2 text-right w-[95px]">Rework Qty</th>
                    <th className="py-2.5 px-2.5 w-[170px]">Defect Reason</th>
                    <th className="py-2.5 px-2 text-center w-[125px]">Status</th>
                    <th className="py-2.5 px-2 text-center w-[65px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reworkRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <RotateCcw className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                        <p className="font-semibold text-xs text-slate-700">No Rework Quantities Recorded</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          When a received fabric has shade or quality defects, click "Rework" from the 3-dot action menu on the dyeing order.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    reworkRecords.map((rec, idx) => {
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
                            <span className="font-medium text-slate-800 block text-xs truncate" title={rec.vendor_name || 'Processing Mill'}>
                              {rec.vendor_name || 'Processing Mill'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-semibold text-slate-800 block text-xs truncate" title={rec.product_name || rec.display_product_name}>
                              {rec.product_name || rec.display_product_name || 'Fabric Material'}
                            </span>
                            {rec.color && (
                              <span className="text-[10px] text-slate-500 block truncate">
                                Color: {rec.color}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-right align-middle whitespace-nowrap">
                            <span className="font-mono font-bold text-amber-700 text-xs">
                              {fmt(rec.rework_quantity, 1)} {rec.uom || 'MTR'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="text-slate-700 text-xs block truncate" title={rec.rework_reason || 'Defect Correction'}>
                              {rec.rework_reason || 'Defect Correction'}
                            </span>
                            {rec.rework_remarks && (
                              <span className="text-[10px] text-slate-400 block truncate" title={rec.rework_remarks}>
                                {rec.rework_remarks}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.status === 'Accepted After Rework' || (rec.status as string) === 'Completed'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : rec.status === 'Sent for Rework'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : rec.status === 'Rework Received'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {rec.status || 'Pending Rework'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                            <button
                              type="button"
                              onClick={(e) => handleToggleReworkMenu(e, rec)}
                              className={`p-1.5 rounded-lg border transition shadow-2xs ${
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
              {reworkRecords.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No rework records registered.
                </div>
              ) : (
                reworkRecords.map((rec, idx) => (
                  <div key={`mob_rwk_${rec.id || idx}`} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-xs font-bold text-brand-700">{rec.rework_order_no}</div>
                        <div className="text-xs text-slate-800 font-semibold mt-0.5">{rec.vendor_name || 'Processing Mill'}</div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {rec.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg flex items-center justify-between">
                      <span>{rec.product_name} ({rec.color || 'All Colors'})</span>
                      <span className="font-mono font-bold text-slate-900">{fmt(rec.rework_quantity, 1)} {rec.uom || 'MTR'}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenReceiveReworkModal(rec)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>Receive</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenTransferModal()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shadow-2xs"
                      >
                        <ArrowRight className="w-3 h-3" />
                        <span>Transfer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenViewReworkModal(rec)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg shadow-2xs"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>



      {/* RECEIVE DYED FABRIC MODAL */}
      <Modal
        open={showReceiveModal}
        onClose={() => !savingReceive && setShowReceiveModal(false)}
        title={`Inward Receive Dyed Fabric — ${selectedDyeingOrder?.dyeing_order_no}`}
        subtitle={`Record received yardage, shrinkage loss %, shade verification and photo proof`}
        size="lg"
      >
        <form onSubmit={handleSubmitReceive} className="space-y-4">
          {receiveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{receiveError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <FormField label="Inward Delivery Challan (DC No)" required>
              <input
                type="text"
                value={receiptChallanNo}
                onChange={e => setReceiptChallanNo(e.target.value)}
                className="w-full text-xs font-mono rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                placeholder="e.g. INW-DYE-402"
                required
              />
            </FormField>

            <FormField label="Receipt Date" required>
              <input
                type="date"
                value={receiptDate}
                onChange={e => setReceiptDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                required
              />
            </FormField>

            <FormField label="Lot #">
              <input
                type="text"
                value={receiptLotNo}
                onChange={e => setReceiptLotNo(e.target.value)}
                className="w-full text-xs font-mono rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                placeholder="e.g. LOT-492"
              />
            </FormField>

            <FormField label="Received & Inspected By">
              <input
                type="text"
                value={receivedBy}
                onChange={e => setReceivedBy(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                placeholder="e.g. Quality Inspector"
              />
            </FormField>
          </div>

          {/* Color breakdown receiving table */}
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-brand-600" />
                <span>Received Fabric Yardage per Color Item</span>
              </h4>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleFillAllRemaining}
                  className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition cursor-pointer"
                  title="Auto-fill with all outstanding balances"
                >
                  Receive Full Balance
                </button>
                <button
                  type="button"
                  onClick={handleClearAllQuantities}
                  className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition cursor-pointer"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={handleAddReceiveColorRow}
                  className="px-2 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Lot</span>
                </button>
              </div>
            </div>

            {/* Live Yardage Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 bg-slate-100/90 p-2.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Sent</span>
                <span className="font-mono font-bold text-slate-800">
                  {fmt(receivingItems.reduce((s, i) => s + (Number(i.planned_quantity) || 0), 0), 1)} {selectedDyeingOrder?.uom}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Already Recv</span>
                <span className="font-mono font-bold text-slate-600">
                  {fmt(receivingItems.reduce((s, i) => s + (Number(i.already_received) || 0), 0), 1)} {selectedDyeingOrder?.uom}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Balance Left</span>
                <span className="font-mono font-bold text-amber-700">
                  {fmt(Math.max(0, receivingItems.reduce((s, i) => s + Math.max(0, (Number(i.planned_quantity) || 0) - (Number(i.already_received) || 0)), 0)), 1)} {selectedDyeingOrder?.uom}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 block uppercase font-bold">Inwarding Now</span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-300 inline-block">
                  {fmt(receivingItems.reduce((s, i) => s + (Number(i.received_quantity) || 0), 0), 1)} {selectedDyeingOrder?.uom}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {receivingItems.map((it, idx) => {
                const rem = Math.max(0, Number((it.planned_quantity - it.already_received).toFixed(2)));
                return (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                          style={{ backgroundColor: it.hex_code || '#3b82f6' }}
                        />
                        {it.item_id === 0 && it.color_name.startsWith('Additional Lot') ? (
                          <input
                            type="text"
                            value={it.color_name}
                            onChange={e => handleReceiveItemChange(idx, 'color_name', e.target.value)}
                            className="font-bold text-xs text-slate-900 border border-slate-300 rounded px-1.5 py-0.5 bg-white"
                          />
                        ) : (
                          <span className="font-bold text-xs text-slate-900">{it.color_name}</span>
                        )}
                        {it.pantone_code && (
                          <span className="font-mono text-[10px] text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">
                            {it.pantone_code}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>
                          Sent: <strong className="text-slate-800">{fmt(it.planned_quantity, 1)} {selectedDyeingOrder?.uom}</strong>
                        </span>
                        {it.already_received > 0 && (
                          <span className="text-emerald-600">
                            (Recv: {fmt(it.already_received, 1)})
                          </span>
                        )}
                        <span className="text-amber-700 font-semibold">
                          Bal: {fmt(rem, 1)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/60">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-700">
                            Received Qty ({selectedDyeingOrder?.uom}) *
                          </label>
                          <button
                            type="button"
                            onClick={() => handleFillItemMax(idx)}
                            className="text-[10px] font-bold text-brand-600 hover:text-brand-800 hover:underline cursor-pointer"
                            title="Set to maximum remaining quantity"
                          >
                            Max ({fmt(rem, 1)})
                          </button>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.received_quantity}
                          onChange={e => handleReceiveItemChange(idx, 'received_quantity', e.target.value)}
                          className="w-full text-xs font-bold rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                          placeholder="0.00"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Lot # / Roll Batch #
                        </label>
                        <input
                          type="text"
                          value={it.lot_number || receiptLotNo || ''}
                          onChange={e => handleReceiveItemChange(idx, 'lot_number', e.target.value)}
                          className="w-full text-xs font-mono rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                          placeholder="e.g. LOT-492 / Roll 1"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mandatory Live Camera Photo Proof */}
          <LivePhotoCaptureField
            label="Dyed Fabric Swatch & Roll Physical Photo"
            required={true}
            photo={photoUrl}
            onPhotoChange={setPhotoUrl}
            stageName="Dyeing Fabric Inward (Stage 04)"
            orderNumber={order?.order_number || selectedDyeingOrder?.dyeing_order_no}
            error={receiveError && !photoUrl ? 'Real-time camera photograph with live GPS coordinates is mandatory before receiving fabric.' : undefined}
            placeholderText="Tap here to open camera"
            helperText="Photograph of received dyed fabric roll swatches against Pantone standards must be captured live via camera."
            buttonText="Take Real-Time Fabric Photo"
          />

                    <FormField label="Quality Remarks">
            <textarea
              rows={2}
              value={receiptRemarks}
              onChange={e => setReceiptRemarks(e.target.value)}
              className="w-full text-xs rounded-xl border-slate-300 py-2 px-3"
              placeholder="e.g. Lot #492 verified, shade matched with master Pantone TCX swatch."
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowReceiveModal(false)}
              disabled={savingReceive}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={savingReceive}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {savingReceive ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  <span>Recording Inward Receipt...</span>
                </>
              ) : (
                <span>
                  Confirm & Inward Dyed Fabric ({fmt(receivingItems.reduce((s, i) => s + (Number(i.received_quantity) || 0), 0), 1)} {selectedDyeingOrder?.uom})
                </span>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* PHOTO ZOOM MODAL */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setZoomedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setZoomedPhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomedPhoto}
              alt="Zoomed fabric proof"
              className="max-h-[85vh] w-auto mx-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Quality Inspection Modal (Stage 04: Dyeing) */}
      {selectedReceiptForInspect && (
        <StageInspectionModal
          isOpen={showInspectModal}
          onClose={() => {
            setShowInspectModal(false);
            setSelectedReceiptForInspect(null);
          }}
          title={`Fabric Quality Inspection — ${selectedReceiptForInspect.receipt_no}`}
          productionOrderId={Number(order?.id) || Number(selectedReceiptForInspect.production_order_id) || Number(id)}
          stageId={4}
          stageCode="DYE"
          referenceId={selectedReceiptForInspect.receipt_no}
          referenceType="Dyeing Receipt"
          batchNumber={selectedReceiptForInspect.dyeing_order_no}
          productName={selectedReceiptForInspect.fabric_name || 'Dyed Fabric Material'}
          vendorName={selectedReceiptForInspect.dyeing_mill_name || 'Processing Mill'}
          availableQuantity={Math.max(0, Number(selectedReceiptForInspect.total_received_quantity || 0) - Number(selectedReceiptForInspect.total_accepted_quantity || 0) - Number(selectedReceiptForInspect.total_rework_quantity || 0))}
          uom={selectedReceiptForInspect.uom || 'MTR'}
          onSuccess={async () => {
            setShowInspectModal(false);
            setSelectedReceiptForInspect(null);
            setSuccessToast('Quality inspection recorded successfully! Accepted balance credited.');
            await loadData();
          }}
        />
      )}

      {/* Portaled 3-Dot Action Menu for Dyeing Orders Table */}
      {activeDyeingMenu &&
        createPortal(
          <div className="fixed inset-0 z-[99999]" onClick={() => setActiveDyeingMenu(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: `${activeDyeingMenu.top}px`,
                left: `${activeDyeingMenu.left}px`,
                width: '144px',
              }}
              className="bg-white border border-slate-200 rounded-xl shadow-xl py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95"
            >
              {(() => {
                const dOrder = activeDyeingMenu.dOrder;
                const totalPlanned = Number(dOrder.total_fabric_quantity || 0);
                const totalRec = Number(dOrder.total_received_quantity || 0);
                const isFullyReceived = dOrder.status === 'Received' || (totalRec >= totalPlanned && totalPlanned > 0);

                if (!isFullyReceived) {
                  return (
                    <div className="py-0.5">
                      {/* Receive */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDyeingMenu(null);
                          handleOpenReceive(dOrder);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-emerald-700 font-medium transition text-left"
                      >
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Receive</span>
                      </button>

                      {/* Order */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDyeingMenu(null);
                          handleOpenPrintModal('DYEING_OUTWARD', dOrder);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-brand-700 font-medium transition text-left"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        <span>Order</span>
                      </button>

                      {/* View */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDyeingMenu(null);
                          toggleExpandOrder(dOrder.id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-brand-700 font-medium transition text-left"
                      >
                        <Eye className="w-3.5 h-3.5 text-brand-600" />
                        <span>View</span>
                      </button>
                    </div>
                  );
                }

                // After receiving dyeing products: rework, transfer, order, view
                return (
                  <div className="py-0.5">
                    {/* Rework */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDyeingMenu(null);
                        handleOpenReworkModal(dOrder);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-800 font-medium transition text-left"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                      <span>Rework</span>
                    </button>

                    {/* Transfer */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDyeingMenu(null);
                        handleOpenTransferModal();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 font-medium transition text-left"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Transfer</span>
                    </button>

                    {/* Order */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDyeingMenu(null);
                        handleOpenPrintModal('DYEING_OUTWARD', dOrder);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-brand-700 font-medium transition text-left"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>Order</span>
                    </button>

                    {/* View */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDyeingMenu(null);
                        toggleExpandOrder(dOrder.id);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-brand-700 font-medium transition text-left"
                    >
                      <Eye className="w-3.5 h-3.5 text-brand-600" />
                      <span>View</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>,
          document.body
        )}

      {/* Portaled 3-Dot Action Menu for Rework Details Table */}
      {activeReworkMenu &&
        createPortal(
          <div className="fixed inset-0 z-[99999]" onClick={() => setActiveReworkMenu(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: `${activeReworkMenu.top}px`,
                left: `${activeReworkMenu.left}px`,
                width: '144px',
              }}
              className="bg-white border border-slate-200 rounded-xl shadow-xl py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95"
            >
              <div className="py-0.5">
                {/* Receive */}
                <button
                  type="button"
                  onClick={() => {
                    const r = activeReworkMenu.record;
                    setActiveReworkMenu(null);
                    handleOpenReceiveReworkModal(r);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-semibold transition text-left"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Receive</span>
                </button>

                {/* Transfer */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveReworkMenu(null);
                    handleOpenTransferModal();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 font-medium transition text-left"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Transfer</span>
                </button>

                {/* View */}
                <button
                  type="button"
                  onClick={() => {
                    const r = activeReworkMenu.record;
                    setActiveReworkMenu(null);
                    handleOpenViewReworkModal(r);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-brand-700 font-medium transition text-left"
                >
                  <Eye className="w-3.5 h-3.5 text-brand-600" />
                  <span>View</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL: CREATE / SEND FABRIC FOR REWORK */}
      <Modal
        isOpen={reworkModalOpen}
        onClose={() => setReworkModalOpen(false)}
        title="Fabric Rework & Re-dyeing Order"
        size="lg"
      >
        {selectedOrderForRework && (
          <form onSubmit={handleConfirmCreateRework} className="space-y-4">
            {/* Basic Details Container */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Processing Mill
                </span>
                <span className="font-semibold text-slate-800 mt-0.5 block truncate" title={selectedOrderForRework.dyeing_mill_name || selectedOrderForRework.supplier_name}>
                  {selectedOrderForRework.dyeing_mill_name || selectedOrderForRework.supplier_name || 'Processing Mill'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Fabric Material
                </span>
                <span className="font-semibold text-slate-800 mt-0.5 block truncate" title={selectedOrderForRework.fabric_name}>
                  {selectedOrderForRework.fabric_name}
                </span>
                {selectedOrderForRework.fabric_code && (
                  <span className="text-[10px] font-mono text-slate-400">{selectedOrderForRework.fabric_code}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Order / Recv Qty
                </span>
                <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                  {fmt(Number(selectedOrderForRework.total_fabric_quantity || 0), 1)} {selectedOrderForRework.uom || 'MTR'}
                </span>
                <span className="text-[10px] font-mono text-emerald-700 block">
                  Recv: {fmt(Number(selectedOrderForRework.total_received_quantity || 0), 1)} {selectedOrderForRework.uom || 'MTR'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Color / Standard
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {(selectedOrderForRework.items || []).slice(0, 2).map((it: any, cIdx: number) => (
                    <span key={cIdx} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                        style={{ backgroundColor: it.hex_code || '#3b82f6' }}
                      />
                      <span className="truncate max-w-[70px]">{it.color_name}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {reworkError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{reworkError}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Color Selection if multiple colors in order */}
              {(selectedOrderForRework.items || []).length > 1 && (
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Color Variant to Rework <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={reworkForm.selected_color}
                    onChange={(e) => setReworkForm({ ...reworkForm, selected_color: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white font-medium"
                  >
                    {(selectedOrderForRework.items || []).map((it: any, cIdx: number) => (
                      <option key={cIdx} value={it.pantone_code || it.color_name}>
                        {it.color_name} {it.pantone_code ? `(${it.pantone_code})` : ''} — Planned: {it.planned_quantity} {selectedOrderForRework.uom}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rework Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rework Quantity ({selectedOrderForRework.uom || 'MTR'}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max={Number(selectedOrderForRework.total_received_quantity || selectedOrderForRework.total_fabric_quantity || 0)}
                  value={reworkForm.rework_quantity}
                  onChange={(e) => setReworkForm({ ...reworkForm, rework_quantity: Number(e.target.value) })}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono font-bold bg-white"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Eligible inwarded quantity: {fmt(Number(selectedOrderForRework.total_received_quantity || selectedOrderForRework.total_fabric_quantity || 0), 1)} {selectedOrderForRework.uom || 'MTR'}
                </span>
              </div>

              {/* Defect Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rework Defect Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={reworkForm.rework_reason}
                  onChange={(e) => setReworkForm({ ...reworkForm, rework_reason: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white font-medium"
                >
                  <option value="Shade Mismatch / Uneven Dyeing">Shade Mismatch / Uneven Dyeing</option>
                  <option value="Color Patchiness / Streaks">Color Patchiness / Streaks</option>
                  <option value="Shrinkage & Width Variation">Shrinkage & Width Variation</option>
                  <option value="Rubbing / Washing Fastness Failure">Rubbing / Washing Fastness Failure</option>
                  <option value="Chemical Stains / Water Spotting">Chemical Stains / Water Spotting</option>
                  <option value="Fiber Weakening / Harsh Handfeel">Fiber Weakening / Harsh Handfeel</option>
                  <option value="Other Dyeing Specification Defect">Other Dyeing Specification Defect</option>
                </select>
              </div>

              {/* Target Return Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Return Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={reworkForm.expected_return_date}
                  onChange={(e) => setReworkForm({ ...reworkForm, expected_return_date: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white font-medium"
                  required
                />
              </div>

              {/* DC Challan No */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Outward DC Challan No
                </label>
                <input
                  type="text"
                  value={reworkForm.dc_challan_no}
                  onChange={(e) => setReworkForm({ ...reworkForm, dc_challan_no: e.target.value })}
                  placeholder="e.g. DC-RWK-4001"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white font-mono"
                />
              </div>

              {/* Remarks / Mill Instructions */}
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remarks & Technical Instructions for Re-dyeing
                </label>
                <textarea
                  rows={2}
                  value={reworkForm.remarks}
                  onChange={(e) => setReworkForm({ ...reworkForm, remarks: e.target.value })}
                  placeholder="Enter specific shading, chemical correction, or washing guidelines for the dyeing mill..."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
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
                loading={submittingRework}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                <span>Send for Rework / Re-dyeing</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: INWARD RECEIVE REWORKED FABRIC RETURN (MATCHES DYEING ORDER RECEIVE MODAL) */}
      <Modal
        isOpen={receiveReworkModalOpen}
        onClose={() => !submittingReceiveRework && setReceiveReworkModalOpen(false)}
        title={`Inward Receive Reworked Fabric — ${selectedReworkForReceive?.rework_order_no}`}
        subtitle="Record received yardage from mill correction, challan number and live photo proof"
        size="lg"
      >
        {selectedReworkForReceive && (
          <form onSubmit={handleConfirmReceiveRework} className="space-y-4">
            {reworkReceiveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{reworkReceiveError}</span>
              </div>
            )}

            {/* Top 4-field metadata grid with visible borders */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <FormField label="Inward Delivery Challan (DC No)" required>
                <input
                  type="text"
                  value={reworkReceiptChallanNo}
                  onChange={e => setReworkReceiptChallanNo(e.target.value)}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                  placeholder="e.g. INW-RWK-402"
                  required
                />
              </FormField>

              <FormField label="Receipt Date" required>
                <input
                  type="date"
                  value={reworkReceiptDate}
                  onChange={e => setReworkReceiptDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                  required
                />
              </FormField>

              <FormField label="Lot #">
                <input
                  type="text"
                  value={reworkLotNo}
                  onChange={e => setReworkLotNo(e.target.value)}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                  placeholder="e.g. LOT-RWK-01"
                />
              </FormField>

              <FormField label="Received & Inspected By">
                <input
                  type="text"
                  value={reworkReceivedBy}
                  onChange={e => setReworkReceivedBy(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                  placeholder="e.g. Quality Inspector"
                />
              </FormField>
            </div>

            {/* Rework Yardage Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100/90 p-2.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Sent for Rework</span>
                <span className="font-mono font-bold text-slate-800">
                  {fmt(selectedReworkForReceive.rework_quantity, 1)} {selectedReworkForReceive.uom || 'MTR'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Defect Reason</span>
                <span className="font-semibold text-slate-700 truncate block" title={selectedReworkForReceive.rework_reason}>
                  {selectedReworkForReceive.rework_reason || 'Defect Correction'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Processing Mill</span>
                <span className="font-semibold text-slate-700 truncate block">
                  {selectedReworkForReceive.vendor_name || 'Processing Mill'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 block uppercase font-bold">Inwarding Now</span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-300 inline-block">
                  {fmt(reworkReceivedQty, 1)} {selectedReworkForReceive.uom || 'MTR'}
                </span>
              </div>
            </div>

            {/* Received Fabric Item Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 bg-slate-700" />
                  <span className="font-bold text-xs text-slate-900">
                    {selectedReworkForReceive.product_name || 'Cotton Fabric'}
                  </span>
                  {selectedReworkForReceive.color && (
                    <span className="font-mono text-[10px] text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">
                      Color: {selectedReworkForReceive.color}
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span>
                    Sent Qty: <strong className="text-slate-800">{fmt(selectedReworkForReceive.rework_quantity, 1)} {selectedReworkForReceive.uom || 'MTR'}</strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/60">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Received Qty ({selectedReworkForReceive.uom || 'MTR'}) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setReworkReceivedQty(Number(selectedReworkForReceive.rework_quantity))}
                      className="text-[10px] font-bold text-brand-600 hover:text-brand-800 hover:underline cursor-pointer"
                    >
                      Max ({fmt(selectedReworkForReceive.rework_quantity, 1)})
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Number(selectedReworkForReceive.rework_quantity)}
                    value={reworkReceivedQty}
                    onChange={e => setReworkReceivedQty(Number(e.target.value))}
                    className="w-full text-xs font-bold rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs font-mono"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Lot # / Roll Batch #
                  </label>
                  <input
                    type="text"
                    value={reworkLotNo}
                    onChange={e => setReworkLotNo(e.target.value)}
                    className="w-full text-xs font-mono rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                    placeholder="e.g. LOT-RWK-01 / Roll 1"
                  />
                </div>
              </div>
            </div>

            {/* Mandatory Live Camera Photo Proof */}
            <LivePhotoCaptureField
              label="Reworked Fabric Swatch & Roll Physical Photo"
              required={true}
              photo={reworkPhotoUrl}
              onPhotoChange={setReworkPhotoUrl}
              stageName="Dyeing Fabric Rework Return (Stage 04)"
              orderNumber={order?.order_number || selectedReworkForReceive.rework_order_no}
              error={reworkReceiveError && !reworkPhotoUrl ? 'Real-time camera photograph with live GPS coordinates is mandatory before receiving reworked fabric.' : undefined}
              placeholderText="Tap here to open camera"
              helperText="Photograph of returned reworked fabric swatches against approved standards must be captured live via camera."
              buttonText="Take Real-Time Rework Photo"
            />

            <FormField label="Quality Remarks & Inspection Notes">
              <textarea
                rows={2}
                value={reworkRemarks}
                onChange={e => setReworkRemarks(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                placeholder="e.g. Corrected shade approved against master swatch, rolls verified and accepted into stock."
              />
            </FormField>

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
                disabled={submittingReceiveRework}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {submittingReceiveRework ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    <span>Inwarding Reworked Fabric...</span>
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-4 h-4 mr-1.5" />
                    <span>Confirm & Inward Reworked Fabric ({fmt(reworkReceivedQty, 1)} {selectedReworkForReceive.uom || 'MTR'})</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: VIEW REWORK RECORD DETAILS */}
      <Modal
        isOpen={viewReworkModalOpen}
        onClose={() => setViewReworkModalOpen(false)}
        title={selectedReworkForView ? `Rework Order Details - ${selectedReworkForView.rework_order_no}` : 'Rework Details'}
        size="md"
      >
        {selectedReworkForView && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-700">Rework Order #:</span>
                <span className="font-mono font-bold text-brand-700">{selectedReworkForView.rework_order_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Outward DC Challan:</span>
                <span className="font-mono text-slate-800">{selectedReworkForView.dc_challan_no || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Processing Mill / Vendor:</span>
                <span className="font-semibold text-slate-800">{selectedReworkForView.vendor_name || 'Processing Mill'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Material Name:</span>
                <span className="font-medium text-slate-800">{selectedReworkForView.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Color Variant:</span>
                <span className="text-slate-800">{selectedReworkForView.color || 'All Colors'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rework Quantity Sent:</span>
                <span className="font-mono font-bold text-amber-700">{selectedReworkForView.rework_quantity} {selectedReworkForView.uom || 'MTR'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Accepted Quantity:</span>
                <span className="font-mono font-semibold text-emerald-700">{selectedReworkForView.accepted_quantity || 0} {selectedReworkForView.uom || 'MTR'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Status:</span>
                <span className="font-bold text-slate-800">{selectedReworkForView.status}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Defect Reason & Instructions
              </span>
              <p className="font-semibold text-slate-800">{selectedReworkForView.rework_reason || 'Defect Correction'}</p>
              {selectedReworkForView.rework_remarks && (
                <p className="text-slate-600 mt-1">{selectedReworkForView.rework_remarks}</p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setViewReworkModalOpen(false)}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setViewReworkModalOpen(false);
                  handleOpenTransferModal();
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                <ArrowRight className="w-3.5 h-3.5 mr-1" />
                <span>Transfer to Cutting</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Transfer to Cutting Modal */}
      {transferModalOpen && (
        <Modal
          isOpen={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
          title={`Transfer Dyed Fabric to Stage 05 (Cutting) — ${order?.order_number || ''}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 text-xs text-purple-950">
              <div className="flex items-center gap-2 font-bold text-purple-900 mb-1">
                <Scissors className="w-4 h-4 text-purple-700" />
                Handover to Cutting Department
              </div>
              <p>
                Logging this transfer records the physical handover of dyed fabric rolls to the Cutting table store.
                The cutting department will be able to immediately begin laying and cutting garment batches.
              </p>
            </div>

            {transferError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
                {transferError}
              </div>
            )}

            {/* Inventory In-Hand Calculation Breakdown Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Inward Recv</span>
                <span className="font-mono font-bold text-slate-800">{fmt(totalFabricReceived, 1)} MTR</span>
              </div>
              <div>
                <span className="text-amber-600 block text-[10px] uppercase font-bold">Rework at Mill</span>
                <span className="font-mono font-bold text-amber-700">
                  {fmt(activeReworkOutAtMill, 1)} MTR
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Already Transferred</span>
                <span className="font-mono font-bold text-slate-600">
                  {fmt(totalTransferredToCutting, 1)} MTR
                </span>
              </div>
              <div>
                <span className="text-emerald-700 block text-[10px] uppercase font-bold">Available Now</span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block">
                  {fmt(availableInHandForCutting, 1)} MTR
                </span>
              </div>
            </div>

            {availableInHandForCutting <= 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">No fabric currently available to transfer.</span>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    {activeReworkOutAtMill > 0 
                      ? `${fmt(activeReworkOutAtMill, 1)} MTR is currently at the dyeing mill for rework. Please receive the rework completed fabric before transferring.`
                      : 'All received dyed fabric has already been transferred to Stage 05 (Cutting).'}
                  </p>
                </div>
              </div>
            )}

            <FormField label={`Transfer Quantity (MTR) * (Max: ${fmt(availableInHandForCutting, 1)} MTR)`} required>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={availableInHandForCutting}
                  value={transferQty || ''}
                  onChange={(e) => setTransferQty(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono font-bold bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none shadow-2xs pr-24"
                  placeholder="Enter meters to handover..."
                />
                {availableInHandForCutting > 0 && (
                  <button
                    type="button"
                    onClick={() => setTransferQty(availableInHandForCutting)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded transition cursor-pointer"
                  >
                    Max ({fmt(availableInHandForCutting, 1)})
                  </button>
                )}
              </div>
            </FormField>

            <FormField label="Transferred By / Store Keeper *">
              <input
                type="text"
                value={transferredBy}
                onChange={(e) => setTransferredBy(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none shadow-2xs"
                placeholder="Name or department..."
              />
            </FormField>

            <FormField label="Handover Notes & Remarks">
              <textarea
                rows={2}
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none shadow-2xs"
                placeholder="Roll numbers, storage rack, shrinkage allowance notes..."
              />
            </FormField>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTransferModalOpen(false)}
                disabled={savingTransfer}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmTransfer}
                disabled={savingTransfer || transferQty <= 0 || transferQty > (availableInHandForCutting + 0.05)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
              >
                {savingTransfer ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Transferring...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                    Confirm Handover & Open Stage 05 Cutting
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Job Work Order & Inward Receipt Document Preview/Print Modal */}
      <JobWorkDocumentModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        docType={printDocType}
        order={order}
        itemData={printDocItem}
        receiptList={allDyeingReceipts}
        supplier={suppliers.find((s: any) =>
          s.id === (printDocItem?.supplier_id || printDocItem?.parent_order?.supplier_id) ||
          (s.name || '').toLowerCase() === (printDocItem?.dyeing_mill_name || '').toLowerCase()
        )}
        companySettings={companySettings}
      />
    </div>
  );
}
