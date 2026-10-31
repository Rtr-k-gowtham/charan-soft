// src/pages/production/EmbroideryOrderDetail.tsx
// Stage 06: Embroidery — Dedicated Outward / Inward Job Work Module with Vendor Tracking & Proof
// Redesigned to strict Cheran Soft Goods ERP design system: Table-based layout, ERP blue palette,
// full-page Outward Job Order creation form matching Stage 04 Dyeing Order UI,
// proper item tracking from Cutting arrival to Outward Dispatch, Inward QC, and Transfer to Stitching.
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useStageBackNavigation } from '../../utils/navigation';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, EmbroideryJobOrder, EmbroideryReceipt, ReworkRecord } from '../../types';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import SearchableSelect, { SelectOption } from '../../components/ui/SearchableSelect';
import { LivePhotoCaptureField } from '../../components/production/LivePhotoCaptureField';
import { lookupPantone, VERIFIED_PANTONE_LIBRARY } from '../../lib/pantoneService';
import JobWorkDocumentModal, { JobWorkDocType } from '../../components/documents/JobWorkDocumentModal';
import PendingApprovalBanner from '../../components/production/PendingApprovalBanner';
import StageModificationModal from '../../components/production/StageModificationModal';
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Plus,
  ArrowRight,
  Printer,
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
  Clock,
  ArrowDownCircle,
  Scissors,
  Building2,
  Save,
  FileSpreadsheet,
  AlertCircle,
  RotateCcw,
  MoreVertical,
  Search,
  CheckCheck,
  Edit3
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

export interface EmbroideryLineRow {
  production_order_item_id: number;
  product_id?: number;
  product_name: string;
  color_name: string;
  pantone_code: string;
  hex_code: string;
  size: string;
  arrived_quantity: number;
  planned_quantity: number | '';
  uom: string;
  rate_per_unit: number | '';
  tax_percent: number;
  notes: string;
}

export default function EmbroideryOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const handleBack = useStageBackNavigation('/production/embroidery');
  const [searchParams, setSearchParams] = useSearchParams();

  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [jobOrders, setJobOrders] = useState<EmbroideryJobOrder[]>([]);
  const [receipts, setReceipts] = useState<EmbroideryReceipt[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [embroideryUnits, setEmbroideryUnits] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [modModalOpen, setModModalOpen] = useState(false);
  const [selectedRecordForMod, setSelectedRecordForMod] = useState<{
    type: string;
    id: number;
    identifier?: string;
    data?: any;
  } | null>(null);

  // Filter tabs: 'job_orders' | 'rework'
  const [activeTab, setActiveTab] = useState<'job_orders' | 'rework'>('job_orders');
  const [productFilter, setProductFilter] = useState<'ALL' | 'EMBROIDERY'>('ALL');

  // Document Print / Preview Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printDocType, setPrintDocType] = useState<JobWorkDocType>('EMBROIDERY_OUTWARD');
  const [printDocItem, setPrintDocItem] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);

  const handleOpenPrintModal = (type: JobWorkDocType, item: any) => {
    setPrintDocType(type);
    setPrintDocItem(item);
    setPrintModalOpen(true);
  };

  // Full Page Create Embroidery Job Order State (matching DyeingOrderDetail)
  const [showCreatePage, setShowCreatePage] = useState<boolean>(() => searchParams.get('create') === 'true');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [categoryType, setCategoryType] = useState<string>('EMBROIDERY JOB ORDER');
  const [challanNo, setChallanNo] = useState<string>(() => `DC-EMB-${Math.floor(1000 + Math.random() * 9000)}`);
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [processType, setProcessType] = useState<string>('Embroidery');
  const [transportDetails, setTransportDetails] = useState<string>('');
  const [dispatchedBy, setDispatchedBy] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [outwardPhotos, setOutwardPhotos] = useState<string[]>([]);
  const [lineRows, setLineRows] = useState<EmbroideryLineRow[]>([]);

  // Inward Receipt Modal
  const [inwardModalOpen, setInwardModalOpen] = useState(false);
  const [selectedJobOrder, setSelectedJobOrder] = useState<any | null>(null);
  const [inwardForm, setInwardForm] = useState({
    receipt_date: new Date().toISOString().split('T')[0],
    vendor_challan_no: '',
    received_by: '',
    remarks: ''
  });
  const [inwardItemQuantities, setInwardItemQuantities] = useState<{
    [key: string]: { received: number; accepted: number; rejected: number; rework: number; rework_reason?: string; rework_remarks?: string }
  }>({});
  const [inwardPhotos, setInwardPhotos] = useState<string[]>([]);
  const [savingInward, setSavingInward] = useState(false);
  const [inwardError, setInwardError] = useState('');

  // Stage Transfer to Stitching Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferItem, setTransferItem] = useState<any | null>(null);
  const [transferQuantity, setTransferQuantity] = useState<number>(0);
  const [transferRemarks, setTransferRemarks] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferJobLines, setTransferJobLines] = useState<Array<{
    item_id: number;
    product_name: string;
    product_code?: string;
    color: string;
    size?: string;
    quantity: number;
    max: number;
  }>>([]);

  // Rework Records State
  const [reworkRecords, setReworkRecords] = useState<ReworkRecord[]>([]);

  // Search & Filter State for Job Orders & Rework Tables
  const [jobOrderSearch, setJobOrderSearch] = useState('');
  const [jobOrderStatusFilter, setJobOrderStatusFilter] = useState('ALL');
  const [reworkSearch, setReworkSearch] = useState('');
  const [reworkStatusFilter, setReworkStatusFilter] = useState('ALL');

  // Floating Action Menus
  const [activeJobMenu, setActiveJobMenu] = useState<{
    top: number;
    left: number;
    job: EmbroideryJobOrder;
  } | null>(null);

  const [activeReworkMenu, setActiveReworkMenu] = useState<{
    top: number;
    left: number;
    record: ReworkRecord;
  } | null>(null);

  const [activeProductMenu, setActiveProductMenu] = useState<{
    itemId: number;
    top: number;
    left: number;
    item: any;
  } | null>(null);

  // Bulk Outward Dispatch Modal State
  const [bulkDispatchModalOpen, setBulkDispatchModalOpen] = useState(false);
  const [bulkVendorName, setBulkVendorName] = useState('');
  const [bulkJobOrderDate, setBulkJobOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkDispatchDate, setBulkDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkExpectedReturnDate, setBulkExpectedReturnDate] = useState('');
  const [bulkDeliveryChallanNo, setBulkDeliveryChallanNo] = useState('');
  const [bulkTransportCourier, setBulkTransportCourier] = useState('');
  const [bulkSentBy, setBulkSentBy] = useState('Production Manager');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkDispatchItems, setBulkDispatchItems] = useState<Array<{
    item: any;
    quantity_sent: number;
    rate: number;
    tax_percent: number;
    error?: string;
  }>>([]);
  const [submittingBulkDispatch, setSubmittingBulkDispatch] = useState(false);
  const [bulkDispatchError, setBulkDispatchError] = useState('');

  // View Product Line Details Modal State
  const [viewProductModalOpen, setViewProductModalOpen] = useState(false);
  const [selectedProductForView, setSelectedProductForView] = useState<any>(null);

  // Modal: Create Rework Order
  const [reworkModalOpen, setReworkModalOpen] = useState(false);
  const [selectedJobForRework, setSelectedJobForRework] = useState<EmbroideryJobOrder | null>(null);
  const [reworkForm, setReworkForm] = useState({
    rework_quantity: 1,
    rework_reason: 'Embroidery Thread Breakage',
    destination_vendor: '',
    dc_challan_no: '',
    remarks: '',
  });
  const [submittingRework, setSubmittingRework] = useState(false);
  const [reworkError, setReworkError] = useState('');

  // Modal: Inward Receive Reworked Pieces
  const [receiveReworkModalOpen, setReceiveReworkModalOpen] = useState(false);
  const [selectedReworkForReceive, setSelectedReworkForReceive] = useState<ReworkRecord | null>(null);
  const [reworkReceiptChallanNo, setReworkReceiptChallanNo] = useState('');
  const [reworkReceiptDate, setReworkReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [reworkLotNo, setReworkLotNo] = useState('');
  const [reworkReceivedBy, setReworkReceivedBy] = useState('Embroidery QC Inspector');
  const [reworkReceivedQty, setReworkReceivedQty] = useState(0);
  const [reworkPhotoUrl, setReworkPhotoUrl] = useState<string | null>(null);
  const [reworkRemarks, setReworkRemarks] = useState('');
  const [reworkReceiveError, setReworkReceiveError] = useState('');
  const [submittingReceiveRework, setSubmittingReceiveRework] = useState(false);

  // Modal: View Rework Details
  const [viewReworkModalOpen, setViewReworkModalOpen] = useState(false);
  const [selectedReworkForView, setSelectedReworkForView] = useState<ReworkRecord | null>(null);

  // Selected Rework for Transfer
  const [selectedReworkForTransfer, setSelectedReworkForTransfer] = useState<ReworkRecord | null>(null);

  // Image Zoom Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchOrderData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const [embRes, stagesRes, unitsRes, supRes, compRes] = await Promise.all([
        api.getEmbroideryOrderDetails(Number(id)),
        api.getProductionStages(),
        api.getEmbroideryWorks().catch(() => []),
        api.getSuppliers().catch(() => []),
        api.getCompanySettings().catch(() => null),
      ]);

      const comp = (compRes as any)?.data || compRes;
      if (comp) setCompanySettings(comp);

      const embData = (embRes as any)?.data || embRes;
      const orderData = embData.order || null;
      setOrder(orderData);
      setItems(embData.items || []);
      setJobOrders(embData.job_orders || []);
      setReceipts(embData.receipts || []);
      setReworkRecords(embData.rework_records || []);

      const st = (stagesRes as any)?.data || stagesRes;
      setStages(Array.isArray(st) ? st : []);

      const units = Array.isArray((unitsRes as any)?.data)
        ? (unitsRes as any).data
        : (Array.isArray(unitsRes) ? unitsRes : []);
      setEmbroideryUnits(units);

      const sups = Array.isArray((supRes as any)?.data)
        ? (supRes as any).data
        : (Array.isArray(supRes) ? supRes : []);
      setSuppliers(sups);
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

  // Supplier Options for SearchableSelect
  const supplierOptions = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = [];
    const seen = new Set<string>();

    embroideryUnits.forEach(u => {
      const val = u.name || String(u.id);
      if (!seen.has(val.toLowerCase())) {
        seen.add(val.toLowerCase());
        list.push({
          value: val,
          label: u.name,
          sublabel: u.code ? `[${u.code}] ${u.machine_heads ? u.machine_heads + ' heads' : 'Embroidery Mill'}` : 'Embroidery Mill'
        });
      }
    });

    suppliers.forEach(s => {
      const val = s.name || String(s.id);
      if (!seen.has(val.toLowerCase())) {
        seen.add(val.toLowerCase());
        list.push({
          value: val,
          label: s.name,
          sublabel: s.code ? `[${s.code}] ${s.contact_person || 'Supplier'}` : (s.supplier_type || 'Vendor')
        });
      }
    });

    return list;
  }, [embroideryUnits, suppliers]);

  // Overall Totals for KPIs
  const overallTotals = useMemo(() => {
    let orderQty = 0;
    let arrivedQty = 0;
    let sentQty = 0;
    let acceptedQty = 0;
    let rejectedQty = 0;
    let reworkQty = 0;
    let outstandingQty = 0;
    let readyForStitching = 0;
    let transferredQty = 0;

    items.forEach(it => {
      orderQty += Number(it.order_quantity || it.total_quantity || 0);
      arrivedQty += Number(it.arrived_from_cutting || 0);
      sentQty += Number(it.sent_to_vendor || 0);
      acceptedQty += Number(it.accepted_inward || 0);
      rejectedQty += Number(it.rejected_quantity || 0);
      reworkQty += Number(it.rework_quantity || 0);
      outstandingQty += Number(it.outstanding_quantity || 0);
      readyForStitching += Number(it.ready_to_transfer || 0);
      transferredQty += Number(it.transferred_to_stitching || Math.max(0, Number(it.accepted_inward || 0) - Number(it.ready_to_transfer || 0)));
    });

    const finalOrderQty = Number(order?.total_quantity || 0) > 0 ? Number(order?.total_quantity) : orderQty;

    return {
      orderQty: finalOrderQty,
      arrivedQty,
      sentQty,
      acceptedQty,
      rejectedQty,
      reworkQty,
      outstandingQty,
      readyForStitching,
      transferredQty
    };
  }, [items]);

  // Helper to construct initial line rows from order items
  const buildInitialLineRows = (rawItems: any[]): EmbroideryLineRow[] => {
    const eligible = rawItems.filter(it => Number(it.available_to_dispatch || it.arrived_from_cutting || 0) > 0);
    const source = eligible.length > 0 ? eligible : rawItems;

    if (source.length === 0) {
      return [
        {
          production_order_item_id: 0,
          product_name: 'Sample Embroidery Item',
          color_name: '101 C',
          pantone_code: '101 C',
          hex_code: '#F4E842',
          size: 'M',
          arrived_quantity: 50,
          planned_quantity: 50,
          uom: 'PCS',
          rate_per_unit: 15.00,
          tax_percent: 5,
          notes: 'Standard 12-head embroidery'
        }
      ];
    }

    return source.map(it => {
      const avail = Number(it.available_to_dispatch || it.arrived_from_cutting || 0);
      const colorStr = (it.color || 'Standard').trim();
      const pMatch = lookupPantone(colorStr);
      return {
        production_order_item_id: Number(it.active_embroidery_item_id || it.id || 0),
        product_id: it.product_id,
        product_name: it.product_name || 'sample',
        color_name: colorStr,
        pantone_code: colorStr,
        hex_code: pMatch.found && pMatch.hex_code ? pMatch.hex_code : '#3b82f6',
        size: it.size || 'M',
        arrived_quantity: Number(it.arrived_from_cutting || 0),
        planned_quantity: avail > 0 ? avail : (Number(it.order_quantity) || 50),
        uom: 'PCS',
        rate_per_unit: 15.00,
        tax_percent: 5,
        notes: `Size: ${it.size || 'M'} • Arrived: ${Number(it.arrived_from_cutting || 0)} pcs`
      };
    });
  };

  // Open Full-Page Create Order View
  const handleOpenCreatePage = (specificItem?: any) => {
    setChallanNo(`DC-EMB-${Math.floor(1000 + Math.random() * 9000)}`);
    setCreateError('');

    if (specificItem) {
      const avail = Number(specificItem.available_to_dispatch || specificItem.arrived_from_cutting || 0);
      const colorStr = (specificItem.color || 'Standard').trim();
      const pMatch = lookupPantone(colorStr);
      setLineRows([
        {
          production_order_item_id: Number(specificItem.active_embroidery_item_id || specificItem.id || 0),
          product_id: specificItem.product_id,
          product_name: specificItem.product_name || 'sample',
          color_name: colorStr,
          pantone_code: colorStr,
          hex_code: pMatch.found && pMatch.hex_code ? pMatch.hex_code : '#3b82f6',
          size: specificItem.size || 'M',
          arrived_quantity: Number(specificItem.arrived_from_cutting || 0),
          planned_quantity: avail > 0 ? avail : 50,
          uom: 'PCS',
          rate_per_unit: 15.00,
          tax_percent: 5,
          notes: `Size: ${specificItem.size || 'M'} • Arrived: ${Number(specificItem.arrived_from_cutting || 0)} pcs`
        }
      ]);
    } else {
      setLineRows(buildInitialLineRows(items));
    }

    setShowCreatePage(true);
    const next = new URLSearchParams(searchParams);
    next.set('create', 'true');
    setSearchParams(next);
  };

  // Sync create mode from URL query params
  useEffect(() => {
    if (searchParams.get('create') === 'true' && order) {
      if (lineRows.length === 0) {
        setLineRows(buildInitialLineRows(items));
      }
      setShowCreatePage(true);
    }
  }, [searchParams, order, items]);

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
      setCreateError('Failed to process image: ' + err.message);
    }
  };

  // Line Row Manipulation
  const handleAddLineRow = () => {
    const firstIt = items[0];
    setLineRows(prev => [
      ...prev,
      {
        production_order_item_id: firstIt?.active_embroidery_item_id || firstIt?.id || 0,
        product_id: firstIt?.product_id,
        product_name: firstIt?.product_name || 'sample',
        color_name: '101 C',
        pantone_code: '101 C',
        hex_code: '#3b82f6',
        size: 'M',
        arrived_quantity: 50,
        planned_quantity: 50,
        uom: 'PCS',
        rate_per_unit: 15.00,
        tax_percent: 5,
        notes: ''
      }
    ]);
  };

  const handleRemoveLineRow = (index: number) => {
    if (lineRows.length <= 1) return;
    setLineRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleLineRowChange = (index: number, field: keyof EmbroideryLineRow, value: any) => {
    setLineRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

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
          }
        }
      }
      return updated;
    });
  };

  const handleAutofillItems = () => {
    setLineRows(buildInitialLineRows(items));
  };

  // Submit Create Embroidery Job Order (Full Page)
  const handleCreateEmbroideryJobOrder = async (orderStatus: 'Draft' | 'Sent to Vendor' = 'Sent to Vendor') => {
    setCreateError('');
    if (!order) return;

    if (!selectedSupplier || !selectedSupplier.trim()) {
      setCreateError('Please select or specify an Embroidery Processor / Vendor.');
      return;
    }

    if (!challanNo.trim()) {
      setCreateError('Outward Delivery Challan No is required.');
      return;
    }

    if (lineRows.length === 0) {
      setCreateError('Please specify at least one product line to dispatch.');
      return;
    }

    const itemsToDispatch = lineRows
      .filter(r => (Number(r.planned_quantity) || 0) > 0)
      .map(r => ({
        production_order_item_id: r.production_order_item_id || items[0]?.active_embroidery_item_id || items[0]?.id || 0,
        product_id: r.product_id,
        product_name: r.product_name,
        color: r.color_name,
        size: r.size,
        quantity_sent: Number(r.planned_quantity) || 0,
        uom: r.uom || 'PCS',
        rate_per_unit: Number(r.rate_per_unit) || 0,
        tax_percent: Number(r.tax_percent) || 0,
        taxable_amount: (Number(r.planned_quantity) || 0) * (Number(r.rate_per_unit) || 0),
        net_amount: ((Number(r.planned_quantity) || 0) * (Number(r.rate_per_unit) || 0)) * (1 + (Number(r.tax_percent) || 0) / 100),
        notes: r.notes
      }));

    if (itemsToDispatch.length === 0) {
      setCreateError('Please enter a dispatch quantity greater than 0 for at least one item.');
      return;
    }

    if (!outwardPhotos || outwardPhotos.length === 0) {
      setCreateError('Real-time camera photograph with live GPS coordinates of the delivery challan & dispatch bundle is mandatory before issuing job order.');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        production_order_id: Number(order.id),
        vendor_name: selectedSupplier,
        category_name: categoryType,
        job_order_date: orderDate,
        dispatch_date: orderDate,
        expected_return_date: expectedDate,
        delivery_challan_no: challanNo,
        transport_courier: transportDetails,
        sent_by: dispatchedBy,
        notes: remarks,
        attachments: outwardPhotos,
        status: orderStatus,
        items: itemsToDispatch
      };

      const res: any = await api.createEmbroideryJobOrder(payload);

      setShowCreatePage(false);
      if (searchParams.get('create')) {
        const next = new URLSearchParams(searchParams);
        next.delete('create');
        setSearchParams(next);
      }
      showToast(`Embroidery Job Order ${res?.job_order_number || challanNo} created successfully!`);
      await fetchOrderData();
    } catch (err: any) {
      console.error('Failed to create embroidery job order:', err);
      setCreateError(err?.message || 'Failed to create Embroidery Job Order. Please check inputs.');
    } finally {
      setCreating(false);
    }
  };

  // Helper to get already received and remaining outstanding for an item in a job order
  const getItemReceivedAndPending = (job: any, ji: any) => {
    const sent = Number(ji?.quantity_sent || 0);
    const jItems = Array.isArray(job?.items_json) ? job.items_json : [];
    const jobReceipts = (receipts || []).filter((r: any) => Number(r.job_order_id) === Number(job?.id));

    let rec = Number(ji?.received_quantity || 0);
    if (jobReceipts.length > 0) {
      let rSum = 0;
      jobReceipts.forEach((r: any) => {
        const rItems = Array.isArray(r.items_data) ? r.items_data : [];
        rItems.forEach((rit: any) => {
          const match = (ji?.production_order_item_id && rit.production_order_item_id && Number(ji.production_order_item_id) === Number(rit.production_order_item_id))
            || (jItems.length === 1);
          if (match) {
            rSum += Number(rit.received_quantity || 0);
          }
        });
      });
      if (rSum > 0) rec = Math.max(rec, rSum);
    }
    if (rec === 0 && jItems.length === 1 && job?.total_quantity_received) {
      rec = Number(job.total_quantity_received);
    }
    const pending = Math.max(0, sent - rec);
    return { sent, rec, pending };
  };

  // Inward Modal Handlers
  const handleOpenInwardModal = (job: any) => {
    setSelectedJobOrder(job);
    const jItems = Array.isArray(job.items_json) ? job.items_json : [];
    const initQty: { [key: string]: { received: number; accepted: number; rejected: number; rework: number } } = {};

    jItems.forEach((ji: any, idx: number) => {
      const key = String(ji.production_order_item_id || idx);
      const { pending } = getItemReceivedAndPending(job, ji);
      initQty[key] = {
        received: pending,
        accepted: 0,
        rejected: 0,
        rework: 0
      };
    });

    if (jItems.length === 0) {
      const out = Number(job.total_quantity_outstanding ?? (Number(job.total_quantity_sent || 0) - Number(job.total_quantity_received || 0)));
      initQty['0'] = { received: Math.max(0, out), accepted: 0, rejected: 0, rework: 0 };
    }

    setInwardItemQuantities(initQty);
    setInwardPhotos([]);
    setInwardError('');
    setInwardForm({
      receipt_date: new Date().toISOString().split('T')[0],
      vendor_challan_no: `INV-EMB-${Math.floor(1000 + Math.random() * 9000)}`,
      received_by: 'Stores & Inward QC',
      remarks: 'Physically received from embroidery vendor; pending quality inspection.'
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

  const handleSaveInward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobOrder) return;

    const jItems = Array.isArray(selectedJobOrder.items_json) ? selectedJobOrder.items_json : [];
    const receiptItems: any[] = [];

    if (jItems.length > 0) {
      for (let idx = 0; idx < jItems.length; idx++) {
        const ji = jItems[idx];
        const key = String(ji.production_order_item_id || idx);
        const q = inwardItemQuantities[key] || { received: 0, accepted: 0, rejected: 0, rework: 0 };
        const { pending } = getItemReceivedAndPending(selectedJobOrder, ji);

        if (q.received > pending) {
          setInwardError(`Received quantity for ${ji.product_name || 'item'} (${q.received} pcs) cannot exceed outstanding quantity (${pending} pcs).`);
          return;
        }

        if (q.received > 0) {
          receiptItems.push({
            production_order_item_id: ji.production_order_item_id,
            product_id: ji.product_id,
            product_name: ji.product_name,
            color: ji.color,
            size: ji.size,
            received_quantity: Number(q.received)
          });
        }
      }
    } else {
      const q = inwardItemQuantities['0'] || { received: 0, accepted: 0, rejected: 0, rework: 0 };
      const maxOut = Number(selectedJobOrder?.total_quantity_outstanding ?? (Number(selectedJobOrder?.total_quantity_sent || 0) - Number(selectedJobOrder?.total_quantity_received || 0)));
      if (q.received > maxOut) {
        setInwardError(`Received quantity (${q.received} pcs) cannot exceed outstanding quantity (${maxOut} pcs).`);
        return;
      }
      if (q.received > 0) {
        receiptItems.push({
          production_order_item_id: items[0]?.active_embroidery_item_id || items[0]?.id || 0,
          received_quantity: Number(q.received)
        });
      }
    }

    const totalRec = receiptItems.reduce((s, i) => s + i.received_quantity, 0);
    if (totalRec <= 0) {
      setInwardError('Please enter a received quantity greater than 0.');
      return;
    }

    if (!inwardPhotos || inwardPhotos.length === 0) {
      setInwardError('Real-time camera photograph with live GPS coordinates of received embroidery pieces & QC inspection is mandatory.');
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

  // Synchronized Available in Hand and Rework Calculations
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

  const totalReceivedEmbroidery = useMemo(() => {
    let rec = 0;
    receipts.forEach((r) => {
      rec += Number(r.total_received_qty || 0);
    });
    jobOrders.forEach((j) => {
      rec = Math.max(rec, Number(j.total_quantity_received || 0));
    });
    if (rec === 0) {
      items.forEach((it) => {
        rec += Number(it.received_inward || it.accepted_inward || 0);
      });
    }
    return rec;
  }, [receipts, jobOrders, items]);

  const totalTransferredToStitching = useMemo(() => {
    let trf = 0;
    jobOrders.forEach((j) => {
      trf += Number(j.transferred_to_stitching_quantity || 0);
    });
    if (trf === 0) {
      items.forEach((it) => {
        trf += Number(it.transferred_to_stitching || 0);
      });
    }
    return trf;
  }, [jobOrders, items]);

  const availableInHandToTransfer = useMemo(() => {
    return Math.max(0, totalReceivedEmbroidery - activeReworkQty - totalTransferredToStitching);
  }, [totalReceivedEmbroidery, activeReworkQty, totalTransferredToStitching]);

  // Filtered Job Orders for Table 1
  const filteredJobOrders = useMemo(() => {
    return jobOrders.filter((job) => {
      if (jobOrderSearch.trim()) {
        const q = jobOrderSearch.toLowerCase();
        const m1 = (job.job_order_number || '').toLowerCase().includes(q);
        const m2 = (job.vendor_name || '').toLowerCase().includes(q);
        const m3 = (job.delivery_challan_no || '').toLowerCase().includes(q);
        if (!m1 && !m2 && !m3) return false;
      }
      const out = Number(job.total_quantity_outstanding || 0);
      const rec = Number(job.total_quantity_received || 0);
      if (jobOrderStatusFilter === 'WITH_VENDOR') {
        return out > 0 && rec === 0;
      }
      if (jobOrderStatusFilter === 'PARTIAL') {
        return rec > 0 && out > 0;
      }
      if (jobOrderStatusFilter === 'COMPLETED') {
        return out <= 0.01;
      }
      if (jobOrderStatusFilter === 'TRANSFERRED') {
        return job.status === 'Transferred to Stitching';
      }
      return true;
    });
  }, [jobOrders, jobOrderSearch, jobOrderStatusFilter]);

  // Filtered Rework Records for Table 2
  const filteredReworks = useMemo(() => {
    return reworkRecords.filter((r) => {
      if (reworkSearch.trim()) {
        const q = reworkSearch.toLowerCase();
        const m1 = (r.rework_order_no || '').toLowerCase().includes(q);
        const m2 = (r.product_name || r.display_product_name || '').toLowerCase().includes(q);
        const m3 = (r.vendor_name || '').toLowerCase().includes(q);
        const m4 = (r.color || '').toLowerCase().includes(q);
        if (!m1 && !m2 && !m3 && !m4) return false;
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

  // Close all floating menus on scroll/resize/escape
  useEffect(() => {
    if (!activeJobMenu && !activeReworkMenu && !activeProductMenu) return;
    const closeAll = () => {
      setActiveJobMenu(null);
      setActiveReworkMenu(null);
      setActiveProductMenu(null);
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
  }, [activeJobMenu, activeReworkMenu, activeProductMenu]);

  // Menu Toggle Handlers
  const handleToggleJobMenu = (e: React.MouseEvent, job: EmbroideryJobOrder) => {
    e.stopPropagation();
    if (activeJobMenu?.job.id === job.id) {
      setActiveJobMenu(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 140;
    const left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12);
    const top = rect.bottom + 4;
    setActiveJobMenu({ top, left, job });
    setActiveReworkMenu(null);
    setActiveProductMenu(null);
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
    setActiveJobMenu(null);
    setActiveProductMenu(null);
  };

  const handleToggleProductMenu = (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    if (activeProductMenu?.itemId === item.id) {
      setActiveProductMenu(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 180;
    const left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12);
    const top = rect.bottom + 4;
    setActiveProductMenu({ itemId: item.id || 0, top, left, item });
    setActiveJobMenu(null);
    setActiveReworkMenu(null);
  };

  const handleOpenBulkDispatchModal = () => {
    const eligible = items.filter(it => Number(it.available_to_dispatch || 0) > 0);
    const sourceItems = eligible.length > 0 ? eligible : items;

    const dispatchLines = sourceItems.map(it => {
      const avail = Number(it.available_to_dispatch || 0);
      return {
        item: it,
        quantity_sent: avail,
        rate: 15.00,
        tax_percent: 5,
        error: ''
      };
    });

    setBulkDispatchItems(dispatchLines);
    setBulkVendorName(String(supplierOptions[0]?.value || 'Embroidery Unit'));
    setBulkJobOrderDate(new Date().toISOString().split('T')[0]);
    setBulkDispatchDate(new Date().toISOString().split('T')[0]);
    setBulkExpectedReturnDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setBulkDeliveryChallanNo(`DC-EMB-${Math.floor(1000 + Math.random() * 9000)}`);
    setBulkTransportCourier('Direct Vehicle / Hand Delivery');
    setBulkSentBy('Production Manager');
    setBulkNotes('');
    setBulkDispatchError('');
    setBulkDispatchModalOpen(true);
  };

  const handleSaveBulkDispatch = async () => {
    if (!bulkVendorName) {
      setBulkDispatchError('Please select an embroidery vendor.');
      return;
    }

    const validLines = bulkDispatchItems.filter(l => Number(l.quantity_sent) > 0);
    if (validLines.length === 0) {
      setBulkDispatchError('Please specify a dispatch quantity greater than 0 for at least one product line.');
      return;
    }

    let hasError = false;
    const updated = bulkDispatchItems.map(l => {
      const qty = Number(l.quantity_sent || 0);
      const avail = Number(l.item.available_to_dispatch || 0);
      if (qty > 0 && avail > 0 && qty > avail) {
        hasError = true;
        return { ...l, error: `Quantity (${qty}) exceeds available to dispatch (${avail})` };
      }
      return { ...l, error: '' };
    });
    setBulkDispatchItems(updated);

    if (hasError) {
      setBulkDispatchError('Please resolve line quantity errors before dispatching.');
      return;
    }

    setSubmittingBulkDispatch(true);
    setBulkDispatchError('');
    try {
      const payloadItems = validLines.map(l => ({
        production_order_item_id: l.item.active_embroidery_item_id || l.item.id,
        product_id: l.item.product_id,
        product_name: l.item.product_name,
        color: l.item.color,
        size: l.item.size,
        quantity_sent: Number(l.quantity_sent),
        rate: Number(l.rate || 15),
        tax_percent: Number(l.tax_percent || 5),
        taxable_amount: Number(l.quantity_sent) * Number(l.rate || 15),
        tax_amount: (Number(l.quantity_sent) * Number(l.rate || 15) * Number(l.tax_percent || 5)) / 100,
        net_amount: (Number(l.quantity_sent) * Number(l.rate || 15)) * (1 + Number(l.tax_percent || 5) / 100),
      }));

      await api.createEmbroideryJobOrder({
        production_order_id: Number(order?.id || id),
        vendor_name: bulkVendorName,
        job_order_date: bulkJobOrderDate,
        dispatch_date: bulkDispatchDate,
        expected_return_date: bulkExpectedReturnDate,
        delivery_challan_no: bulkDeliveryChallanNo,
        transport_courier: bulkTransportCourier,
        sent_by: bulkSentBy,
        notes: bulkNotes,
        items: payloadItems,
      });

      setBulkDispatchModalOpen(false);
      showToast(`Embroidery Job Order ${bulkDeliveryChallanNo} created for ${validLines.length} product lines. Outward recorded!`);
      await fetchOrderData();
    } catch (err: any) {
      setBulkDispatchError(err.message || 'Failed to create bulk embroidery job order');
    } finally {
      setSubmittingBulkDispatch(false);
    }
  };

  // Open Rework Modal from Table 1 Job Order
  const handleOpenReworkModal = (job: EmbroideryJobOrder) => {
    setSelectedJobForRework(job);
    setReworkForm({
      rework_quantity: 1,
      rework_reason: 'Embroidery Thread Breakage',
      destination_vendor: job.vendor_name || '',
      dc_challan_no: `DC-EMB-RWK-${Math.floor(1000 + Math.random() * 9000)}`,
      remarks: '',
    });
    setReworkError('');
    setReworkModalOpen(true);
  };

  // Create Rework Order Submission
  const handleCreateRework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobForRework || !order) return;
    const qty = Number(reworkForm.rework_quantity);
    const maxQty = Number(selectedJobForRework.total_quantity_sent || 0);

    if (qty <= 0) {
      setReworkError('Rework quantity must be greater than zero.');
      return;
    }
    if (qty > maxQty) {
      setReworkError(`Rework quantity cannot exceed job order sent quantity (${maxQty} pcs).`);
      return;
    }

    setSubmittingRework(true);
    setReworkError('');
    try {
      const firstItem = items[0] || {};
      const created = await api.createRework({
        production_order_id: Number(order.id),
        production_order_item_id: firstItem.active_embroidery_item_id || firstItem.id,
        stage_id: 6,
        stage_code: 'EMB',
        product_id: firstItem.product_id,
        product_name: firstItem.product_name || 'Embroidery Item',
        color: firstItem.color || 'Standard',
        size: firstItem.size || 'M',
        rework_quantity: qty,
        uom: 'PCS',
        defect_reason: reworkForm.rework_reason,
        rework_reason: reworkForm.rework_reason,
        rework_remarks: reworkForm.remarks,
        destination_process: reworkForm.destination_vendor || selectedJobForRework.vendor_name || 'Embroidery Mill',
        vendor_name: reworkForm.destination_vendor || selectedJobForRework.vendor_name || 'Embroidery Mill',
        batch_number: selectedJobForRework.job_order_number,
        reference_id: selectedJobForRework.id || selectedJobForRework.job_order_number,
      });

      const reworkId = created?.id || (created as any)?.data?.id;
      if (reworkId) {
        await api.sendRework({
          rework_id: reworkId,
          sent_date: new Date().toISOString().split('T')[0],
          vendor_name: reworkForm.destination_vendor || selectedJobForRework.vendor_name || 'Embroidery Mill',
          dc_challan_no: reworkForm.dc_challan_no || `DC-EMB-RWK-${Math.floor(1000 + Math.random() * 9000)}`,
          remarks: reworkForm.remarks,
        });
      }

      setReworkModalOpen(false);
      showToast(`Rework order of ${qty} pcs sent for correction successfully!`);
      await fetchOrderData();
    } catch (err: any) {
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

    setReworkReceiptChallanNo(rec.dc_challan_no ? `INW-${rec.dc_challan_no}` : `INW-EMB-RWK-${Math.floor(1000 + Math.random() * 9000)}`);
    setReworkReceiptDate(new Date().toISOString().split('T')[0]);
    setReworkLotNo(rec.batch_number || `LOT-EMB-${rec.id || 1}`);
    setReworkReceivedBy('Embroidery QC Inspector');
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
        inspector_name: reworkReceivedBy || 'Embroidery QC Inspector',
        reinspection_result: 'Passed Quality Audit',
        reinspection_notes: reworkRemarks || 'Reworked embroidery pieces received & approved',
        batch_number: reworkLotNo
      });
      setReceiveReworkModalOpen(false);
      showToast(`Rework #${selectedReworkForReceive.rework_order_no} (${reworkReceivedQty} pcs) inward received & accepted! Pieces are ready for stage transfer.`);
      await fetchOrderData();
    } catch (err: any) {
      console.error('Failed to process embroidery rework receipt:', err);
      setReworkReceiveError(err?.message || 'Failed to confirm rework receipt');
    } finally {
      setSubmittingReceiveRework(false);
    }
  };

  // Open Stage Transfer Modal (Synchronized available quantity in hand)
  const handleOpenTransferModal = (itemOrJob?: any) => {
    if (availableInHandToTransfer <= 0) {
      showToast('No embroidery pieces are currently available in hand to transfer to Stitching.');
      return;
    }

    let it = itemOrJob;
    let jId: number | undefined = undefined;
    let maxAvailForThis = availableInHandToTransfer;
    let jobLines: Array<{ item_id: number; product_name: string; product_code?: string; color: string; size?: string; quantity: number; max: number }> = [];

    if (itemOrJob && itemOrJob.total_quantity_sent !== undefined) {
      // It's a job order with multiple possible items
      jId = itemOrJob.id;
      const jobRec = Number(itemOrJob.total_quantity_received || 0);
      const jobTrf = Number(itemOrJob.transferred_to_stitching_quantity || 0);
      const jobAvail = Math.max(0, jobRec - jobTrf);
      maxAvailForThis = Math.min(availableInHandToTransfer, jobAvail);

      const jItems = Array.isArray(itemOrJob.items_json) ? itemOrJob.items_json : [];
      if (jItems.length > 0) {
        jobLines = jItems.map((ji: any) => {
          const matchedItem = items.find(i => (ji.production_order_item_id && (i.id === ji.production_order_item_id || i.active_embroidery_item_id === ji.production_order_item_id)) || (i.product_id === ji.product_id && (i.color || '').trim().toLowerCase() === (ji.color || '').trim().toLowerCase()));
          
          const lineRec = Number(ji.received_quantity || 0) || (jItems.length === 1 ? jobRec : 0);
          const lineTrf = Number(ji.transferred_quantity || 0) || (jItems.length === 1 ? jobTrf : 0);
          const lineAvail = Math.max(0, lineRec - lineTrf);
          const q = jItems.length === 1 ? maxAvailForThis : Math.min(lineAvail, maxAvailForThis);

          return {
            item_id: Number(ji.production_order_item_id || matchedItem?.active_embroidery_item_id || matchedItem?.id || 0),
            product_name: ji.product_name || matchedItem?.product_name || 'Product',
            product_code: ji.product_code || matchedItem?.product_code,
            color: ji.color || matchedItem?.color || 'Standard',
            size: ji.size || matchedItem?.size || 'M',
            quantity: q,
            max: q
          };
        });
      }
    } else if (itemOrJob && (itemOrJob.receipt_number || itemOrJob.job_order_id)) {
      // It's an inward receipt
      jId = itemOrJob.job_order_id;
      const rRec = Number(itemOrJob.total_received_qty || 0);
      const rTrf = Number(itemOrJob.transferred_to_stitching_quantity || 0);
      const rAvail = itemOrJob.available_to_transfer !== undefined ? Number(itemOrJob.available_to_transfer) : Math.max(0, rRec - rTrf);
      maxAvailForThis = Math.min(availableInHandToTransfer, rAvail);

      const rItems = Array.isArray(itemOrJob.items_data) ? itemOrJob.items_data : [];
      if (rItems.length > 0) {
        jobLines = rItems.map((ri: any) => {
          const matchedItem = items.find(i => (ri.production_order_item_id && (i.id === ri.production_order_item_id || i.active_embroidery_item_id === ri.production_order_item_id)) || (i.product_id === ri.product_id && (i.color || '').trim().toLowerCase() === (ri.color || '').trim().toLowerCase()));
          const lineRec = Number(ri.received_quantity || 0);
          const q = rItems.length === 1 ? maxAvailForThis : Math.min(lineRec, maxAvailForThis);
          return {
            item_id: Number(ri.production_order_item_id || matchedItem?.active_embroidery_item_id || matchedItem?.id || 0),
            product_name: ri.product_name || matchedItem?.product_name || 'Product',
            product_code: ri.product_code || matchedItem?.product_code,
            color: ri.color || matchedItem?.color || 'Standard',
            size: ri.size || matchedItem?.size || 'M',
            quantity: q,
            max: q
          };
        });
      }
    } else if (itemOrJob && (itemOrJob.ready_to_transfer !== undefined || itemOrJob.available_to_dispatch !== undefined || itemOrJob.product_name !== undefined)) {
      // It's a specific product line item clicked from the product table!
      it = itemOrJob;
      const itReady = Number(itemOrJob.ready_to_transfer !== undefined ? itemOrJob.ready_to_transfer : (Number(itemOrJob.received_inward || itemOrJob.accepted_inward || 0) - Number(itemOrJob.transferred_to_stitching || 0)));
      if (itReady <= 0) {
        showToast(`No embroidery pieces of ${itemOrJob.product_name || 'this product'} are currently ready to transfer.`);
        return;
      }
      maxAvailForThis = Math.min(availableInHandToTransfer, itReady);
    } else if (!itemOrJob) {
      it = items[0] || null;
      maxAvailForThis = availableInHandToTransfer;
    }

    setSelectedReworkForTransfer(null);
    setTransferJobLines(jobLines);
    setTransferItem({ ...it, job_order_id: jId });
    setTransferQuantity(maxAvailForThis);
    setTransferRemarks('Embroidery received from vendor and transferred to Stage 07: Stitching.');
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
        'Reworked embroidery pieces must be inward received before transferring to the next stage. Please confirm inward receipt below.'
      );
      return;
    }

    if ((rec.status as string) === 'Transferred') {
      showToast(`Rework #${rec.rework_order_no} has already been transferred to Stitching.`);
      return;
    }

    if (availableInHandToTransfer <= 0) {
      showToast('No accepted embroidery pieces are currently available in hand to transfer to Stitching.');
      return;
    }

    setSelectedReworkForTransfer(rec);
    setTransferJobLines([]);
    setTransferItem(items[0] || null);
    setTransferQuantity(availableInHandToTransfer);
    setTransferRemarks(`Reworked embroidery #${rec.rework_order_no} accepted and transferred to Stage 07: Stitching.`);
    setTransferError('');
    setTransferModalOpen(true);
  };

  // Confirm Stage Transfer
  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (transferJobLines.length > 0) {
      const totalJobLineQty = transferJobLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
      if (totalJobLineQty <= 0) {
        setTransferError('Please enter at least one product line with quantity > 0.');
        return;
      }
      try {
        setTransferring(true);
        setTransferError('');
        await api.transferEmbroideryOutput({
          production_order_id: order.id,
          job_order_id: transferItem?.job_order_id,
          items: transferJobLines.map(l => ({
            item_id: l.item_id,
            quantity: Number(l.quantity)
          })),
          transfer_quantity: totalJobLineQty,
          destination_stage_id: 7,
          destination_stage_name: 'Stitching — Color-wise Tracking',
          remarks: transferRemarks,
          operator_name: 'M. Ramesh',
          supervisor_name: 'K. Balan'
        });

        setTransferModalOpen(false);
        showToast(`Successfully transferred ${totalJobLineQty} pcs to Stage 07: Stitching!`);
        await fetchOrderData();
      } catch (err: any) {
        setTransferError(err.message || 'Failed to transfer embroidery pieces to Stitching.');
      } finally {
        setTransferring(false);
      }
      return;
    }

    if (transferQuantity <= 0) {
      setTransferError('Please enter a positive transfer quantity.');
      return;
    }

    const maxLimit = transferItem?.ready_to_transfer || availableInHandToTransfer;
    if (transferQuantity > maxLimit + 0.001) {
      setTransferError(`Transfer quantity (${transferQuantity} pcs) exceeds available limit (${maxLimit} pcs).`);
      return;
    }

    try {
      setTransferring(true);
      setTransferError('');
      await api.transferEmbroideryOutput({
        production_order_id: order.id,
        item_id: transferItem?.active_embroidery_item_id || transferItem?.id || items[0]?.active_embroidery_item_id || items[0]?.id || 0,
        job_order_id: transferItem?.job_order_id,
        rework_id: selectedReworkForTransfer?.id,
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
    if (productFilter === 'EMBROIDERY') {
      return items.filter(it => Number(it.arrived_from_cutting || 0) > 0 || it.at_embroidery_stage);
    }
    return items;
  }, [items, productFilter]);

  // =========================================================================
  // FULL PAGE: CREATE EMBROIDERY JOB ORDER (MATCHING CREATE DYEING ORDER UI)
  // =========================================================================
  if (showCreatePage && order) {
    const totalQty = lineRows.reduce((sum, r) => sum + (Number(r.planned_quantity) || 0), 0);
    const totalTaxable = lineRows.reduce((sum, r) => {
      const q = Number(r.planned_quantity) || 0;
      const rt = Number(r.rate_per_unit) || 0;
      return sum + (q * rt);
    }, 0);
    const totalTax = lineRows.reduce((sum, r) => {
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
              <h1 className="text-base font-bold text-slate-900 leading-tight">Create Embroidery Job Order</h1>
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
              onClick={() => handleCreateEmbroideryJobOrder('Draft')}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save as Draft</span>
            </button>

            <Button
              type="button"
              loading={creating}
              onClick={() => handleCreateEmbroideryJobOrder('Sent to Vendor')}
              icon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs px-4 py-2"
            >
              <span>+ Create Embroidery Job Order</span>
            </Button>
          </div>
        </div>

        {/* Full Page Body matching Image 2 */}
        <div className="max-w-7xl w-full mx-auto p-6 space-y-6">
          {createError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{createError}</div>
            </div>
          )}

          {/* Section 1: ORDER HEADER & SUPPLIER */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-brand-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Order Header & Supplier</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SearchableSelect
                label="Supplier"
                required
                value={selectedSupplier}
                onChange={val => setSelectedSupplier(val)}
                options={supplierOptions}
                placeholder="— Select Embroidery Unit with Search —"
                searchPlaceholder="Search supplier name or phone..."
              />

              <SearchableSelect
                label="PO Category"
                required
                value={categoryType}
                onChange={val => setCategoryType(val)}
                options={[
                  { value: 'EMBROIDERY JOB ORDER', label: 'EMBROIDERY JOB ORDER' },
                  { value: 'MULTI-HEAD EMBROIDERY', label: 'MULTI-HEAD EMBROIDERY' },
                  { value: 'APPLIQUE WORK', label: 'APPLIQUE WORK' },
                  { value: 'BADGE / PATCH EMBROIDERY', label: 'BADGE / PATCH EMBROIDERY' },
                  { value: 'SAMPLE EMBROIDERY ORDER', label: 'SAMPLE EMBROIDERY ORDER' },
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
                    placeholder="e.g. DC-EMB-5341"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setChallanNo(`DC-EMB-${Math.floor(1000 + Math.random() * 9000)}`)}
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
                  placeholder="e.g. 12-head Multi-needle Embroidery & Applique"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Transport / Vehicle / Courier Details">
                <input
                  type="text"
                  value={transportDetails}
                  onChange={e => setTransportDetails(e.target.value)}
                  className="w-full text-xs rounded-lg border-slate-300 py-2 px-3 font-medium bg-white focus:ring-brand-500 focus:border-brand-500"
                  placeholder="e.g. Dedicated Factory Van (TN-38-BZ-4412)"
                />
              </FormField>

              <FormField label="Dispatched By">
                <input
                  type="text"
                  value={dispatchedBy}
                  onChange={e => setDispatchedBy(e.target.value)}
                  className="w-full text-xs rounded-lg border-slate-300 py-2 px-3 font-medium bg-white focus:ring-brand-500 focus:border-brand-500"
                  placeholder="e.g. M. Ramesh (Production Dispatch)"
                />
              </FormField>
            </div>

            <div>
              <FormField
                as="textarea"
                label="Remarks / Terms & Notes"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="PO for EMBROIDERY JOB ORDER - Stage 06 Outward"
                rows={2}
              />
            </div>

            {/* Mandatory Live Camera Photo Proof */}
            <LivePhotoCaptureField
              label="Delivery Challan & Dispatch Slip Photo Evidence"
              required={true}
              photos={outwardPhotos}
              onPhotosChange={setOutwardPhotos}
              stageName="Embroidery Outward (Stage 07)"
              orderNumber={order?.order_number}
              error={createError && outwardPhotos.length === 0 ? 'Real-time camera photograph with live GPS coordinates is mandatory before issuing job order.' : undefined}
              buttonText="Take Real-Time Dispatch Photo"
            />
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
                      {categoryType}: {lineRows.length} DB Columns Loaded
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
                  onClick={handleAutofillItems}
                  className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg font-medium shadow-2xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                  <span>Reset to Order Colors</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddLineRow}
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
                  {lineRows.map((row, idx) => {
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

                        {/* 2. Color / Product Item with Swatch */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={row.hex_code || '#3b82f6'}
                              onChange={e => handleLineRowChange(idx, 'hex_code', e.target.value)}
                              className="w-7 h-7 rounded cursor-pointer border border-slate-300 p-0.5 shrink-0"
                              title="Pick Color Swatch"
                            />
                            <input
                              type="text"
                              list="pantone-colors-datalist"
                              value={row.color_name}
                              onChange={e => handleLineRowChange(idx, 'color_name', e.target.value)}
                              placeholder="e.g. 101 C / Yellow"
                              className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2.5 font-bold text-slate-800 bg-white focus:ring-brand-500 focus:border-brand-500"
                              required
                            />
                          </div>
                        </td>

                        {/* 3. Pantone Code */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            list="pantone-codes-datalist"
                            value={row.pantone_code}
                            onChange={e => handleLineRowChange(idx, 'pantone_code', e.target.value)}
                            placeholder="e.g. 101 C"
                            className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2.5 font-mono text-slate-800 bg-white font-medium focus:ring-brand-500 focus:border-brand-500"
                          />
                        </td>

                        {/* 4. Qty */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={row.planned_quantity}
                            onChange={e => handleLineRowChange(idx, 'planned_quantity', e.target.value)}
                            placeholder="0"
                            className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2 text-right font-mono font-bold text-slate-900 bg-white focus:ring-brand-500 focus:border-brand-500"
                            required
                          />
                        </td>

                        {/* 5. UOM */}
                        <td className="py-2 px-2 text-center">
                          <select
                            value={row.uom || 'PCS'}
                            onChange={e => handleLineRowChange(idx, 'uom', e.target.value)}
                            className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-1.5 text-center font-semibold text-slate-700 bg-white focus:ring-brand-500 focus:border-brand-500"
                          >
                            <option value="PCS">PCS</option>
                            <option value="MTR">MTR</option>
                            <option value="SETS">SETS</option>
                            <option value="KG">KG</option>
                          </select>
                        </td>

                        {/* 6. Rate */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.rate_per_unit}
                            onChange={e => handleLineRowChange(idx, 'rate_per_unit', e.target.value)}
                            placeholder="0.00"
                            className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2 text-right font-mono text-slate-800 bg-white focus:ring-brand-500 focus:border-brand-500"
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
                            onChange={e => handleLineRowChange(idx, 'tax_percent', Number(e.target.value))}
                            className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-1 text-center font-medium text-slate-700 bg-white focus:ring-brand-500 focus:border-brand-500"
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
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{fmt(netAmount, 2)}
                        </td>

                        {/* 11. Action */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLineRow(idx)}
                            className="p-1 text-slate-400 hover:text-red-500 transition disabled:opacity-30"
                            disabled={lineRows.length <= 1}
                            title="Delete Row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800">
                    <td colSpan={3} className="py-3 px-3 text-right uppercase text-[11px] text-slate-600">
                      Total Summary:
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs font-bold text-brand-700">
                      {fmt(totalQty)}
                    </td>
                    <td className="py-3 px-2 text-center text-[10px] text-slate-400 font-medium">PCS</td>
                    <td className="py-3 px-3"></td>
                    <td className="py-3 px-3 text-right font-mono text-xs font-bold text-slate-900">
                      ₹{fmt(totalTaxable, 2)}
                    </td>
                    <td className="py-3 px-2"></td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-slate-600">
                      ₹{fmt(totalTax, 2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sm font-extrabold text-brand-700">
                      ₹{fmt(netGrandTotal, 2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Datalists for Pantone autocompletion */}
        <datalist id="pantone-colors-datalist">
          {VERIFIED_PANTONE_LIBRARY.map((p, idx) => (
            <option key={idx} value={`${p.code} - ${p.name}`} />
          ))}
        </datalist>
        <datalist id="pantone-codes-datalist">
          {VERIFIED_PANTONE_LIBRARY.map((p, idx) => (
            <option key={idx} value={p.code} />
          ))}
        </datalist>
      </div>
    );
  }

  // =========================================================================
  // MAIN EMBROIDERY STAGE ORDER VIEW (TABLE LAYOUT WITH BLUE THEME)
  // =========================================================================
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
                  <Sparkles className="w-3 h-3 text-brand-600" />
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
              variant="outline"
              size="sm"
              icon={<Edit3 className="w-3.5 h-3.5 text-slate-600" />}
              onClick={() => {
                setSelectedRecordForMod(null);
                setModModalOpen(true);
              }}
              className="text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Request Modification
            </Button>
            <Button
              id="btn-new-outward-challan"
              variant="primary"
              size="sm"
              icon={<Send className="w-3.5 h-3.5" />}
              onClick={() => handleOpenCreatePage()}
              disabled={overallTotals.arrivedQty <= 0}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm shadow-brand-200"
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
              <span>Arrived in Embroidery: <strong className="text-brand-700 font-mono">{fmt(overallTotals.arrivedQty)} pcs</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {/* Pending Modification Banner */}
        <PendingApprovalBanner orderId={Number(id)} stageId={6} />
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
            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider block">Sent to Vendor</span>
            <span className="text-lg font-black text-brand-600 font-mono mt-0.5 block">{fmt(overallTotals.sentQty)}</span>
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
              <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700">
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
                onClick={() => setProductFilter('ALL')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${productFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
              >
                All Products ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setProductFilter('EMBROIDERY')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${productFilter === 'EMBROIDERY'
                  ? 'bg-brand-600 text-white shadow-2xs'
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

                    const readyQ = Number(it.ready_to_transfer !== undefined ? it.ready_to_transfer : Math.max(0, accQ - Number(it.transferred_to_stitching || 0)));

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
                        <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700">
                          {arrivedQ > 0 ? fmt(arrivedQ) : <span className="text-slate-300 font-normal">0</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-brand-600">
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
                            <span className="text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                              {fmt(availQ)}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {readyQ > 0 ? (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                QC Passed ({fmt(readyQ)})
                              </span>
                            ) : outQ > 0 ? (
                              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                With Vendor ({fmt(outQ)})
                              </span>
                            ) : availQ > 0 ? (
                              <span className="text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                                Ready to Dispatch ({fmt(availQ)})
                              </span>
                            ) : accQ > 0 ? (
                              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded border border-purple-200 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-purple-600" />
                                Transferred
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                Awaiting Cutting
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={(e) => handleToggleProductMenu(e, it)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                              title="Product Embroidery Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
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

        {/* TABLE 1: EMBROIDERY JOB ORDERS (MATCHING CUTTING STAGE ERP TABLE VIEW) */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-brand-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Embroidery Job Orders
              </h3>
              <span className="font-mono text-[10px] font-bold bg-brand-100 text-brand-800 px-2 py-0.5 rounded-full">
                {jobOrders.length} {jobOrders.length === 1 ? 'order' : 'orders'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={jobOrderSearch}
                  onChange={(e) => setJobOrderSearch(e.target.value)}
                  placeholder="Search job #, vendor, DC..."
                  className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 w-44 sm:w-56"
                />
              </div>

              <select
                value={jobOrderStatusFilter}
                onChange={(e) => setJobOrderStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="WITH_VENDOR">With Vendor</option>
                <option value="PARTIAL">Partially Received</option>
                <option value="COMPLETED">Completed</option>
                <option value="TRANSFERRED">Transferred to Stitching</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-2 w-[36px] text-center">#</th>
                    <th className="py-2.5 px-2.5 w-[130px]">Job Order #</th>
                    <th className="py-2.5 px-2.5 w-[160px]">Vendor & Transport</th>
                    <th className="py-2.5 px-2 w-[110px]">Order Date</th>
                    <th className="py-2.5 px-2.5 w-[120px]">DC Number</th>
                    <th className="py-2.5 px-2 text-right w-[85px]">Sent Qty</th>
                    <th className="py-2.5 px-2 text-right w-[110px]">Recv / Acc</th>
                    <th className="py-2.5 px-2 text-center w-[130px]">Status</th>
                    <th className="py-2.5 px-2 text-center w-[55px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredJobOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        <Truck className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                        <p className="font-semibold text-xs text-slate-700">No Job Orders Found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Click "Dispatch Outward" above to create an outward job order for embroidery.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredJobOrders.map((job, idx) => {
                      const sent = Number(job.total_quantity_sent || 0);
                      const rec = Number(job.total_quantity_received || 0);
                      const acc = Number(job.total_quantity_accepted || 0);
                      const out = Number(job.total_quantity_outstanding || 0);
                      const isTrf = job.status === 'Transferred to Stitching';

                      return (
                        <tr key={job.id || idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-2 text-center font-mono text-slate-400 text-[11px] align-middle">
                            {idx + 1}
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-mono font-bold text-xs text-brand-700 block truncate" title={job.job_order_number}>
                              {job.job_order_number}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-semibold text-slate-800 block text-xs truncate" title={job.vendor_name}>
                              {job.vendor_name}
                            </span>
                            {job.transport_courier && (
                              <span className="text-[10px] text-slate-400 block truncate" title={job.transport_courier}>
                                {job.transport_courier}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 align-middle whitespace-nowrap font-mono text-[11px] text-slate-600">
                            {job.dispatch_date || job.job_order_date || 'N/A'}
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-mono text-xs text-slate-700 block truncate" title={job.delivery_challan_no || 'N/A'}>
                              {job.delivery_challan_no || 'N/A'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-right align-middle whitespace-nowrap font-mono font-bold text-xs text-slate-800">
                            {fmt(sent)} pcs
                          </td>

                          <td className="py-2.5 px-2 text-right align-middle whitespace-nowrap font-mono text-xs">
                            <span className="text-indigo-700 font-semibold">{fmt(rec)}</span>
                            <span className="text-slate-300 mx-1">/</span>
                            <span className="text-emerald-700 font-bold">{fmt(acc)}</span>
                          </td>

                          <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap overflow-hidden">
                            {isTrf ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                Transferred
                              </span>
                            ) : out <= 0.01 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Completed
                              </span>
                            ) : rec > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                Partial ({fmt(rec)}/{fmt(sent)})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                With Vendor
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                            <button
                              type="button"
                              onClick={(e) => handleToggleJobMenu(e, job)}
                              className={`p-1.5 rounded-lg border transition shadow-2xs cursor-pointer ${activeJobMenu?.job.id === job.id
                                ? 'bg-slate-100 text-slate-900 border-slate-300 ring-2 ring-brand-500/20'
                                : 'bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-slate-200'
                                }`}
                              title="Job Order Options"
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

            {/* Mobile Cards for Job Orders */}
            <div className="md:hidden space-y-3 p-3">
              {filteredJobOrders.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No job orders recorded.
                </div>
              ) : (
                filteredJobOrders.map((job, idx) => {
                  const sent = Number(job.total_quantity_sent || 0);
                  const rec = Number(job.total_quantity_received || 0);
                  const out = Number(job.total_quantity_outstanding || 0);

                  return (
                    <div key={`mob_job_${job.id || idx}`} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-xs font-bold text-brand-700">{job.job_order_number}</div>
                          <div className="text-xs text-slate-800 font-semibold mt-0.5">{job.vendor_name}</div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {job.status || 'Active'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg flex items-center justify-between font-mono">
                        <span>DC: {job.delivery_challan_no || 'N/A'}</span>
                        <span className="font-bold text-slate-800">{fmt(rec)} / {fmt(sent)} pcs</span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5 flex-wrap">
                        {out > 0.01 && (
                          <button
                            type="button"
                            onClick={() => handleOpenInwardModal(job)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs"
                          >
                            <ArrowDownCircle className="w-3.5 h-3.5" />
                            <span>Receive</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenTransferModal(job)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-2xs"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Transfer</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenReworkModal(job)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shadow-2xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Rework</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenPrintModal('EMBROIDERY_OUTWARD', job)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-2xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* TABLE 2: EMBROIDERY REWORK & CORRECTION DETAILS TABLE (DOWN NEXT TO JOB ORDERS) */}
        <div className="space-y-3 pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Embroidery Rework & Correction Details
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
                  placeholder="Search rework #, product, vendor..."
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
                    <th className="py-2.5 px-2.5 w-[150px]">Mill / Vendor</th>
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
                          When embroidery has tension, shade, needle, or stitch defects, click "Rework" from the 3-dot action menu on the job order.
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
                            <span className="font-medium text-slate-800 block text-xs truncate" title={rec.vendor_name || rec.destination_process || 'Embroidery Mill'}>
                              {rec.vendor_name || rec.destination_process || 'Embroidery Mill'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle">
                            <span className="font-semibold text-slate-800 block text-xs truncate" title={rec.product_name || rec.display_product_name}>
                              {rec.product_name || rec.display_product_name || 'Garment Panel'}
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
                            <span className="text-slate-700 text-xs block truncate" title={rec?.rework_reason || 'Thread / Needle Defect'}>
                              {rec?.rework_reason || 'Thread / Needle Defect'}
                            </span>
                            {rec.rework_remarks && (
                              <span className="text-[10px] text-slate-400 block truncate" title={rec.rework_remarks}>
                                {rec.rework_remarks}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap overflow-hidden">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold ${(rec.status as string) === 'Transferred'
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
                              className={`p-1.5 rounded-lg border transition shadow-2xs cursor-pointer ${activeReworkMenu?.record.id === rec.id
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

        {/* Table 3: Recorded Embroidery Inward Receipts & Stitching Transfers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mt-6">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <h3 className="font-bold text-slate-800 text-sm">
                Recorded Inward Receipts & Stitching Transfers
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {receipts.length} {receipts.length === 1 ? 'Inward Receipt' : 'Inward Receipts'}
            </span>
          </div>

          {receipts.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-xs text-slate-700">No Inward Receipts Recorded</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                Once embroidered pieces are received from the vendor, click "Receive Inward" on any active job order above to log received pieces and photo proof. Received pieces can then be transferred directly to Stitching.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Receipt Number</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-3 font-mono">Job Order Ref</th>
                    <th className="py-3 px-3 text-right">Received</th>
                    <th className="py-3 px-3 text-right">Transferred</th>
                    <th className="py-3 px-3 text-right">Available to Transfer</th>
                    <th className="py-3 px-3">Received By</th>
                    <th className="py-3 px-3 text-center">Photo Proof</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {receipts.map((rec, rIdx) => {
                    const photos = parsePhotos(rec.photo_urls);
                    const recReceived = Number(rec.total_received_qty || 0);
                    const recTransferred = Number(rec.transferred_to_stitching_quantity || 0);
                    const recAvail = rec.available_to_transfer !== undefined
                      ? Number(rec.available_to_transfer)
                      : Math.max(0, recReceived - recTransferred);

                    return (
                      <tr key={rec.id || rIdx} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 block w-fit">
                            {rec.receipt_number}
                          </span>
                          {rec.vendor_challan_no && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              DC: {rec.vendor_challan_no}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-sans">{rec.receipt_date}</td>
                        <td className="py-3 px-4 font-sans font-medium text-slate-800">{rec.vendor_name}</td>
                        <td className="py-3 px-3 font-semibold text-slate-600">
                          {rec.job_order_number || `EMB-JOB-${rec.job_order_id}`}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-800">{fmt(recReceived)}</td>
                        <td className="py-3 px-3 text-right font-bold text-purple-700">{fmt(recTransferred)}</td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-700">{fmt(recAvail)}</td>
                        <td className="py-3 px-3 font-sans text-slate-600 text-[10px]">{rec.received_by}</td>
                        <td className="py-3 px-3 text-center">
                          {photos.length > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              {photos.slice(0, 2).map((url, pIdx) => (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() => setPreviewImage(url)}
                                  className="w-7 h-7 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition shrink-0"
                                >
                                  <img src={url} alt="Proof" className="w-full h-full object-cover" />
                                </button>
                              ))}
                              {photos.length > 2 && (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded">
                                  +{photos.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-sans italic">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {recAvail > 0 ? (
                              <Button
                                size="xs"
                                variant="primary"
                                icon={<ArrowRight className="w-3 h-3 text-white" />}
                                onClick={() => handleOpenTransferModal(rec)}
                                className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-[11px]"
                                title="Transfer Received Pieces Directly to Stitching"
                              >
                                Transfer to Stitching ({fmt(recAvail)})
                              </Button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                <CheckCircle2 className="w-3 h-3 text-purple-600" />
                                Transferred
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenPrintModal('EMBROIDERY_INWARD', rec)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition shadow-2xs"
                              title="Print / Download Embroidery Inward Receipt"
                            >
                              <Printer className="w-3.5 h-3.5 text-teal-600" />
                              <span>Receipt</span>
                            </button>
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

      {/* FLOATING ACTION PORTAL: EMBROIDERY JOB ORDERS MENU */}
      {activeJobMenu &&
        createPortal(
          <div className="fixed inset-0 z-[99999]" onClick={() => setActiveJobMenu(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: `${activeJobMenu.top}px`,
                left: `${activeJobMenu.left}px`,
                width: '140px',
              }}
              className="bg-white border border-slate-200 rounded-xl shadow-xl py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95"
            >
              <div className="py-0.5">
                {/* 1. Receive (if outstanding > 0) */}
                {Number(activeJobMenu.job.total_quantity_outstanding || 0) > 0.01 && (
                  <button
                    type="button"
                    onClick={() => {
                      const j = activeJobMenu.job;
                      setActiveJobMenu(null);
                      handleOpenInwardModal(j);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-medium transition text-left cursor-pointer"
                  >
                    <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Receive</span>
                  </button>
                )}

                {/* 2. Transfer */}
                <button
                  type="button"
                  onClick={() => {
                    const j = activeJobMenu.job;
                    setActiveJobMenu(null);
                    handleOpenTransferModal(j);
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
                    const j = activeJobMenu.job;
                    setActiveJobMenu(null);
                    handleOpenReworkModal(j);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800 font-medium transition text-left cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Rework</span>
                </button>

                {/* 4. View / Print */}
                <button
                  type="button"
                  onClick={() => {
                    const j = activeJobMenu.job;
                    setActiveJobMenu(null);
                    handleOpenPrintModal('EMBROIDERY_OUTWARD', j);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium transition text-left cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>View</span>
                </button>

                {/* 5. Edit / Modify */}
                <button
                  type="button"
                  onClick={() => {
                    const j = activeJobMenu.job;
                    setActiveJobMenu(null);
                    setSelectedRecordForMod({
                      type: 'embroidery_jobs',
                      id: Number(j.id || 0),
                      identifier: `Embroidery Job #${j.job_order_number || j.id}`,
                      data: j,
                    });
                    setModModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-brand-700 hover:bg-brand-50 hover:text-brand-800 font-medium transition text-left cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span>Edit / Modify</span>
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

      {/* FLOATING ACTION PORTAL: EMBROIDERY PRODUCT ROW 3-DOT MENU */}
      {activeProductMenu &&
        createPortal(
          <div className="fixed inset-0 z-[99999]" onClick={() => setActiveProductMenu(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: `${activeProductMenu.top}px`,
                left: `${activeProductMenu.left}px`,
                width: '180px',
              }}
              className="bg-white border border-slate-200 rounded-xl shadow-xl py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95"
            >
              <div className="py-0.5">
                {(() => {
                  const it = activeProductMenu.item;
                  const availQ = Number(it.available_to_dispatch || 0);
                  const outQ = Number(it.outstanding_quantity || 0);
                  const recQ = Number(it.received_inward || it.accepted_inward || 0);
                  const readyQ = Number(it.ready_to_transfer !== undefined ? it.ready_to_transfer : Math.max(0, recQ - Number(it.transferred_to_stitching || 0)));

                  // Matching active job order with pending physical inward
                  const matchingJob = jobOrders.find((j: any) => {
                    const jItems = Array.isArray(j.items_json) ? j.items_json : [];
                    const hasItem = jItems.some((ji: any) =>
                      (ji.production_order_item_id && ji.production_order_item_id == (it.active_embroidery_item_id || it.id)) ||
                      (ji.product_id && ji.product_id == it.product_id && (ji.color || '').trim().toLowerCase() === (it.color || '').trim().toLowerCase())
                    );
                    return (hasItem || jobOrders.length === 1) && Number(j.total_quantity_outstanding || 0) > 0.01;
                  });

                  // Matching rework with defective pieces requiring rework dispatch
                  const matchingRework = reworkRecords.find((r: any) => {
                    const isPending = r.status === 'Sent for Rework' || r.status === 'Pending Rework';
                    const matchesItem = (r.color || '').trim().toLowerCase() === (it.color || '').trim().toLowerCase() ||
                      r.production_order_item_id == it.id;
                    return isPending && (matchesItem || reworkRecords.length === 1);
                  });

                  return (
                    <>
                      {/* State A: Dispatch Out */}
                      {availQ > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const item = activeProductMenu.item;
                            setActiveProductMenu(null);
                            handleOpenCreatePage(item);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-brand-700 hover:bg-brand-50 hover:text-brand-800 font-medium transition text-left cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                          <span>Dispatch Out ({fmt(availQ)})</span>
                        </button>
                      )}

                      {/* State B: Receive In (Physically returned from vendor) */}
                      {outQ > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const job = matchingJob || jobOrders[0];
                            setActiveProductMenu(null);
                            if (job) handleOpenInwardModal(job);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-medium transition text-left cursor-pointer"
                        >
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Receive In ({fmt(outQ)})</span>
                        </button>
                      )}

                      {/* State C: Rework (Vendor rework for defective items) */}
                      {(matchingRework || recQ > 0) && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveProductMenu(null);
                            const job = jobOrders.find((j: any) => matchingRework && j.vendor_name === matchingRework.vendor_name) || jobOrders[0];
                            if (job) handleOpenReworkModal(job);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800 font-medium transition text-left cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Rework</span>
                        </button>
                      )}

                      {/* State C: Transfer to Stitching */}
                      {readyQ > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const item = activeProductMenu.item;
                            setActiveProductMenu(null);
                            handleOpenTransferModal(item);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-purple-700 hover:bg-purple-50 hover:text-purple-800 font-medium transition text-left cursor-pointer"
                        >
                          <ArrowRight className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>To Stitching ({fmt(readyQ)})</span>
                        </button>
                      )}

                      {/* View Details — Always Available */}
                      <button
                        type="button"
                        onClick={() => {
                          const item = activeProductMenu.item;
                          setActiveProductMenu(null);
                          setSelectedProductForView(item);
                          setViewProductModalOpen(true);
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
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 1: Receive Inward & QC */}
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
                  const { sent, rec, pending } = getItemReceivedAndPending(selectedJobOrder, ji);

                  return (
                    <div key={key} className="p-4 bg-white space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 block text-xs">{ji.product_name || 'Product'}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Color: {ji.color} • Size: {ji.size || 'M'} • Sent in Job Order: <strong>{fmt(sent)} pcs</strong>
                            {rec > 0 && (
                              <span> • Already Received: <strong className="text-emerald-600">{fmt(rec)} pcs</strong></span>
                            )}
                            {' '}• Outstanding: <strong className="text-amber-600">{fmt(pending)} pcs</strong>
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
                        <div className="max-w-xs">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-bold text-slate-700 uppercase">
                              Received Qty (Pieces) *
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setInwardItemQuantities(prev => ({
                                  ...prev,
                                  [key]: { ...q, received: pending }
                                }));
                              }}
                              className="text-[10px] font-bold text-brand-600 hover:text-brand-800 hover:underline cursor-pointer"
                              title="Set to remaining outstanding quantity"
                            >
                              Fill Max ({fmt(pending)})
                            </button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max={pending}
                            value={q.received}
                            onChange={e => {
                              const rVal = e.target.value === '' ? 0 : Number(e.target.value);
                              setInwardItemQuantities(prev => ({
                                ...prev,
                                [key]: { ...q, received: rVal }
                              }));
                            }}
                            className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg font-mono font-bold text-indigo-700 bg-white"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 bg-white">
                  <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 max-w-xs">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">Received Qty (Pieces) *</label>
                      <button
                        type="button"
                        onClick={() => {
                          const maxOut = Number(selectedJobOrder?.total_quantity_outstanding ?? (Number(selectedJobOrder?.total_quantity_sent || 0) - Number(selectedJobOrder?.total_quantity_received || 0)));
                          setInwardItemQuantities(prev => ({
                            ...prev,
                            '0': { ...prev['0'], received: maxOut, accepted: 0, rejected: 0, rework: 0 }
                          }));
                        }}
                        className="text-[10px] font-bold text-brand-600 hover:text-brand-800 hover:underline cursor-pointer"
                      >
                        Fill Max ({fmt(Number(selectedJobOrder?.total_quantity_outstanding ?? (Number(selectedJobOrder?.total_quantity_sent || 0) - Number(selectedJobOrder?.total_quantity_received || 0))))})
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={Number(selectedJobOrder?.total_quantity_outstanding ?? (Number(selectedJobOrder?.total_quantity_sent || 0) - Number(selectedJobOrder?.total_quantity_received || 0)))}
                      value={inwardItemQuantities['0']?.received || 0}
                      onChange={e => {
                        const v = e.target.value === '' ? 0 : Number(e.target.value);
                        setInwardItemQuantities(prev => ({
                          ...prev,
                          '0': { ...prev['0'], received: v, accepted: 0, rejected: 0, rework: 0 }
                        }));
                      }}
                      className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg font-mono font-bold text-indigo-700 bg-white"
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Two-Step Quality Verification Workflow</span>
                <span>Record the physical pieces delivered by the vendor. Quality inspection and rework decisions take place in the next step via <strong>Quality Inspection</strong>.</span>
              </div>
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

          {/* Mandatory Live Camera QC Photo Proof */}
          <LivePhotoCaptureField
            label="Inward QC Proof Photos & Vendor Challan Slip"
            required={true}
            photos={inwardPhotos}
            onPhotosChange={setInwardPhotos}
            stageName="Embroidery Inward QC (Stage 07)"
            orderNumber={order?.order_number || selectedJobOrder?.job_order_number}
            error={inwardError && inwardPhotos.length === 0 ? 'Real-time camera photograph with live GPS coordinates is mandatory before confirming inward receipt.' : undefined}
            buttonText="Take Real-Time Inward QC Photo"
          />

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

      {/* MODAL: TRANSFER TO STAGE 07 STITCHING */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => {
          setTransferModalOpen(false);
          setSelectedReworkForTransfer(null);
        }}
        title="Transfer Completed Embroidery to Stage 07: Stitching"
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
              Stage 07: Stitching — Color-wise Tracking
            </span>
            {transferJobLines.length > 0 ? (
              <span className="text-xs text-purple-700 block font-medium">
                Consolidated Transfer • {transferJobLines.length} product lines in Job Order
              </span>
            ) : (
              <span className="text-xs text-purple-700 block">
                Product: <strong>{transferItem?.product_name || 'Product'}</strong> • Color: <strong>{transferItem?.color || 'Standard'}</strong>
              </span>
            )}
          </div>

          {transferJobLines.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Product Breakdown ({transferJobLines.length} items)
                </span>
                <span className="text-[11px] font-mono font-bold text-purple-700">
                  Total: {fmt(transferJobLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0))} pcs
                </span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {transferJobLines.map((line, idx) => (
                  <div key={line.item_id || idx} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 text-xs block truncate">{line.product_name}</span>
                      <span className="text-[11px] text-slate-500 font-medium">Color: <strong className="text-slate-700">{line.color}</strong></span>
                      {line.size && <span className="text-[10px] text-slate-400 block">Size: {line.size}</span>}
                    </div>
                    <div className="w-28 shrink-0">
                      <div className="text-[10px] text-slate-400 text-right mb-0.5">Avail: {line.max} pcs</div>
                      <input
                        type="number"
                        min="0"
                        max={line.max}
                        value={line.quantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setTransferJobLines(prev => prev.map((l, i) => i === idx ? { ...l, quantity: val } : l));
                        }}
                        className="w-full text-xs font-mono font-bold rounded-lg border border-slate-300 py-1 px-2 text-right text-purple-700 focus:ring-1 focus:ring-purple-500 bg-purple-50/30"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {(() => {
                const singleItemMax = Math.min(
                  availableInHandToTransfer,
                  Number(transferItem?.ready_to_transfer !== undefined ? transferItem.ready_to_transfer : availableInHandToTransfer)
                );
                return (
                  <>
                    <div className="p-3 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white border border-purple-200 rounded-xl text-xs space-y-1.5 font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 font-sans font-medium">Available for this product:</span>
                        <strong className="text-purple-700 text-sm font-bold">
                          {fmt(singleItemMax)} pcs
                        </strong>
                      </div>
                      {activeReworkQty > 0 && (
                        <div className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center justify-between font-sans">
                          <span className="flex items-center gap-1 font-medium">
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                            Rework at Embroidery Mill:
                          </span>
                          <span className="font-mono font-bold text-amber-900">
                            {fmt(activeReworkQty)} pcs away
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
                            onClick={() => setTransferQuantity(singleItemMax)}
                            className="text-[10px] font-bold text-purple-700 hover:underline cursor-pointer"
                          >
                            Max ({fmt(singleItemMax)} pcs)
                          </button>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max={singleItemMax}
                          value={transferQuantity}
                          onChange={e => setTransferQuantity(e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full text-xs font-mono font-bold rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white text-purple-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          required
                        />
                      </div>
                    </FormField>
                  </>
                );
              })()}
            </>
          )}

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
              id="btn-confirm-transfer-to-stitching"
              variant="primary"
              size="sm"
              type="submit"
              disabled={transferring || availableInHandToTransfer <= 0}
              className="bg-purple-700 hover:bg-purple-800 text-white font-bold"
            >
              {transferring ? 'Transferring...' : 'Confirm Transfer to Stitching'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CREATE EMBROIDERY REWORK */}
      <Modal
        isOpen={reworkModalOpen}
        onClose={() => setReworkModalOpen(false)}
        title={selectedJobForRework ? `Send Pieces for Embroidery Rework — ${selectedJobForRework.job_order_number}` : 'Send for Embroidery Rework'}
        maxWidth="max-w-lg"
      >
        {selectedJobForRework && (
          <form onSubmit={handleCreateRework} className="space-y-4">
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
                  <span className="font-bold text-slate-800">{selectedJobForRework.vendor_name || 'Embroidery Vendor'}</span>
                  <span className="font-mono text-[10px] text-brand-600 block">{selectedJobForRework.delivery_challan_no ? `DC: ${selectedJobForRework.delivery_challan_no}` : ''}</span>
                </div>
                <span className="font-mono text-brand-700 font-bold bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                  {selectedJobForRework.job_order_number}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 font-mono text-[11px] pt-1 border-t border-slate-200/60">
                <span>Sent Qty: <strong className="text-slate-900">{fmt(selectedJobForRework.total_quantity_sent)} pcs</strong></span>
                <span>Recv / Acc: <strong className="text-emerald-700">{fmt(selectedJobForRework.total_quantity_accepted)} pcs</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Rework Quantity (Pieces) *" required>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Available from job</span>
                    <button
                      type="button"
                      onClick={() => {
                        const maxQ = Number(selectedJobForRework.total_quantity_sent || 0);
                        setReworkForm({ ...reworkForm, rework_quantity: maxQ });
                      }}
                      className="text-[10px] font-bold text-brand-600 hover:underline cursor-pointer"
                    >
                      Max ({fmt(selectedJobForRework.total_quantity_sent || 0)} pcs)
                    </button>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={Number(selectedJobForRework.total_quantity_sent || 0)}
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
                  placeholder="DC-EMB-RWK-..."
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
                  <option value="Embroidery Thread Breakage">Embroidery Thread Breakage</option>
                  <option value="Tension Variance / Puckering">Tension Variance / Puckering</option>
                  <option value="Shade Mismatch / Thread Color Mismatch">Shade Mismatch / Thread Color Mismatch</option>
                  <option value="Needle Hole / Fabric Cut Defect">Needle Hole / Fabric Cut Defect</option>
                  <option value="Pattern / Graphic Misalignment">Pattern / Graphic Misalignment</option>
                  <option value="Stain / Soil During Embroidery">Stain / Soil During Embroidery</option>
                  <option value="Other Defect">Other Defect</option>
                </select>
              </FormField>

              <FormField label="Destination Vendor / Mill">
                <input
                  type="text"
                  value={reworkForm.destination_vendor}
                  onChange={(e) => setReworkForm({ ...reworkForm, destination_vendor: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  placeholder="e.g. Embroidery Processor Mill"
                />
              </FormField>
            </div>

            <FormField label="Quality Remarks & Instructions">
              <textarea
                rows={2}
                value={reworkForm.remarks}
                onChange={(e) => setReworkForm({ ...reworkForm, remarks: e.target.value })}
                placeholder="Specify precise rework or re-embroidery instructions..."
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
                <span>{submittingRework ? 'Sending...' : 'Confirm & Send for Rework'}</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: INWARD RECEIVE REWORKED EMBROIDERY PIECES */}
      <Modal
        isOpen={receiveReworkModalOpen}
        onClose={() => !submittingReceiveRework && setReceiveReworkModalOpen(false)}
        title={`Inward Receive Reworked Pieces — ${selectedReworkForReceive?.rework_order_no}`}
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
                  placeholder="e.g. INW-EMB-RWK-101"
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
                  placeholder="e.g. LOT-EMB-01"
                />
              </FormField>

              <FormField label="Received & Inspected By *">
                <input
                  type="text"
                  value={reworkReceivedBy}
                  onChange={e => setReworkReceivedBy(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                  placeholder="e.g. Embroidery QC Inspector"
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
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Processor Mill</span>
                <span className="font-semibold text-slate-700 truncate block">
                  {selectedReworkForReceive.vendor_name || selectedReworkForReceive.destination_process || 'Embroidery Mill'}
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
                    {selectedReworkForReceive.product_name || selectedReworkForReceive.display_product_name || 'Garment Panel'}
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
              label="Reworked Pieces Physical Verification Photo"
              required={true}
              photo={reworkPhotoUrl}
              onPhotoChange={setReworkPhotoUrl}
              stageName="Embroidery Rework Return (Stage 06)"
              orderNumber={order?.order_number || selectedReworkForReceive.rework_order_no}
              error={reworkReceiveError && !reworkPhotoUrl ? 'Real-time camera photograph with live GPS coordinates is mandatory before confirming rework receipt.' : undefined}
              placeholderText="Tap here to open camera"
              helperText="Photograph of corrected pieces must be captured live via camera."
              buttonText="Take Real-Time Rework Photo"
            />

            <FormField label="Quality Remarks & Inspection Notes">
              <textarea
                rows={2}
                value={reworkRemarks}
                onChange={e => setReworkRemarks(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 py-2 px-3 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-2xs"
                placeholder="e.g. Corrected pieces inspected, thread density and shade verified and passed."
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
                <span className="text-slate-500">Mill / Vendor:</span>
                <strong className="text-slate-800">{selectedReworkForView.vendor_name || selectedReworkForView.destination_process || 'Embroidery Mill'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Product:</span>
                <strong className="text-slate-800">{selectedReworkForView.product_name || 'Garment Panel'}</strong>
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

      {/* BULK OUTWARD DISPATCH / JOB ORDER MODAL */}
      <Modal
        isOpen={bulkDispatchModalOpen}
        onClose={() => setBulkDispatchModalOpen(false)}
        title={`Bulk Embroidery Outward Dispatch — ${order?.order_number || ''}`}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="bg-brand-50/70 border border-brand-200/80 rounded-xl p-3 flex items-start gap-2.5">
            <Truck className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            <div className="text-xs text-brand-900 leading-relaxed">
              <p className="font-bold">Stage 06 — Bulk Embroidery Outward Dispatch</p>
              <p className="text-brand-800/90 text-[11px] mt-0.5">
                Issue a consolidated Delivery Challan / Job Order to dispatch cut garment panels across eligible product lines to your embroidery vendor. Physical inward receipt, quality inspection, and stitching transfer follow as separate operational steps.
              </p>
            </div>
          </div>

          {bulkDispatchError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{bulkDispatchError}</span>
            </div>
          )}

          {/* Common Vendor & Dispatch Information */}
          <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Embroidery Vendor / Mill *" required>
                <select
                  value={bulkVendorName}
                  onChange={(e) => setBulkVendorName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  {supplierOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} {opt.sublabel ? `(${opt.sublabel})` : ''}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Delivery Challan No *" required>
                <input
                  type="text"
                  value={bulkDeliveryChallanNo}
                  onChange={(e) => setBulkDeliveryChallanNo(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Dispatch Date *" required>
                <input
                  type="date"
                  value={bulkDispatchDate}
                  onChange={(e) => setBulkDispatchDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                />
              </FormField>

              <FormField label="Expected Return Date">
                <input
                  type="date"
                  value={bulkExpectedReturnDate}
                  onChange={(e) => setBulkExpectedReturnDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                />
              </FormField>

              <FormField label="Transport / Courier">
                <input
                  type="text"
                  value={bulkTransportCourier}
                  onChange={(e) => setBulkTransportCourier(e.target.value)}
                  placeholder="e.g. In-house Driver, DTDC"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                />
              </FormField>
            </div>

            <FormField label="Job Work Instructions & Notes">
              <input
                type="text"
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                placeholder="e.g. Chest embroidery with gold Madeira thread, 2000 stitches"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
              />
            </FormField>
          </div>

          {/* Product Lines List */}
          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
              Eligible Product Lines ({bulkDispatchItems.length})
            </div>
            {bulkDispatchItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                No product lines currently have arrived fabric eligible for embroidery dispatch.
              </div>
            ) : (
              bulkDispatchItems.map((l, idx) => {
                const avail = Number(l.item.available_to_dispatch || 0);
                const orderQ = Number(l.item.order_quantity || l.item.total_quantity || 0);
                const arrivedQ = Number(l.item.arrived_from_cutting || 0);
                const isIncluded = Number(l.quantity_sent) > 0;

                return (
                  <div
                    key={l.item.id || idx}
                    className={`p-3.5 rounded-xl border transition ${isIncluded
                      ? 'bg-white border-brand-300 shadow-2xs'
                      : 'bg-slate-50/60 border-slate-200 opacity-75'
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Product Details */}
                      <div className="space-y-1 sm:w-1/2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-800 text-xs">
                            {l.item.product_name || 'Product'}
                          </span>
                          {l.item.product_code && (
                            <span className="font-mono text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                              {l.item.product_code}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center gap-3 pl-7">
                          <span>Color: <strong className="text-slate-800">{l.item.color || 'Standard'}</strong></span>
                          <span>Size: <strong className="text-slate-800">{l.item.size || 'M'}</strong></span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-3 pl-7">
                          <span>Order: <strong className="font-mono text-slate-700">{fmt(orderQ)} pcs</strong></span>
                          <span>Cut Arrived: <strong className="font-mono text-indigo-700 font-semibold">{fmt(arrivedQ)}</strong></span>
                          <span>Available: <strong className="font-mono text-brand-700 font-bold">{fmt(avail)} pcs</strong></span>
                        </div>
                      </div>

                      {/* Right: Quantities & Rates */}
                      <div className="sm:w-1/2 flex items-center gap-2 justify-end">
                        <div className="w-28">
                          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                            Dispatch Qty *
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={avail}
                            value={l.quantity_sent}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              setBulkDispatchItems((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, quantity_sent: val, error: '' } : p))
                              );
                            }}
                            className={`w-full px-2 py-1 text-xs border rounded font-mono text-right font-bold ${isIncluded ? 'border-brand-500 text-brand-900 bg-brand-50/40' : 'border-slate-300 text-slate-400'
                              }`}
                          />
                        </div>

                        <div className="w-20">
                          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                            Rate (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={l.rate}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              setBulkDispatchItems((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, rate: val } : p))
                              );
                            }}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-mono text-right"
                          />
                        </div>

                        <div className="flex flex-col gap-1 pt-4">
                          <button
                            type="button"
                            onClick={() => {
                              setBulkDispatchItems((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, quantity_sent: avail, error: '' } : p
                                )
                              );
                            }}
                            className="text-[10px] text-brand-700 hover:underline px-1 py-0.5 font-medium cursor-pointer"
                            title="Set to full available"
                          >
                            Full
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBulkDispatchItems((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, quantity_sent: 0, error: '' } : p
                                )
                              );
                            }}
                            className="text-[10px] text-slate-400 hover:text-red-600 px-1 py-0.5 font-medium cursor-pointer"
                            title="Skip this line"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    </div>

                    {l.error && (
                      <div className="mt-2 text-[11px] text-red-600 font-medium pl-7">
                        ⚠ {l.error}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Summary & Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-800">
                {bulkDispatchItems.filter((l) => Number(l.quantity_sent) > 0).length} of {bulkDispatchItems.length}
              </span>{' '}
              product lines selected (Total:{' '}
              <strong className="font-mono text-brand-700">
                {fmt(bulkDispatchItems.reduce((s, l) => s + (Number(l.quantity_sent) || 0), 0))} pcs
              </strong>{' '}
              to <strong className="text-slate-800">{bulkVendorName}</strong>)
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBulkDispatchModalOpen(false)}
                disabled={submittingBulkDispatch}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={submittingBulkDispatch}
                onClick={handleSaveBulkDispatch}
                className="bg-brand-600 hover:bg-brand-700 text-white font-bold"
              >
                {submittingBulkDispatch ? 'Creating Job Order...' : 'Confirm Outward Dispatch'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* VIEW PRODUCT LINE DETAILS MODAL */}
      <Modal
        isOpen={viewProductModalOpen}
        onClose={() => {
          setViewProductModalOpen(false);
          setSelectedProductForView(null);
        }}
        title={`Embroidery Product Line — ${selectedProductForView?.product_name || 'Product'}`}
        maxWidth="max-w-2xl"
      >
        {selectedProductForView && (() => {
          const it = selectedProductForView;
          const orderQ = Number(it.order_quantity || it.total_quantity || 0);
          const arrivedQ = Number(it.arrived_from_cutting || 0);
          const sentQ = Number(it.sent_to_vendor || 0);
          const accQ = Number(it.accepted_inward || 0);
          const rejQ = Number(it.rejected_quantity || 0);
          const rwkQ = Number(it.rework_quantity || 0);
          const outQ = Number(it.outstanding_quantity || 0);
          const readyQ = Number(it.ready_to_transfer !== undefined ? it.ready_to_transfer : Math.max(0, accQ - Number(it.transferred_to_stitching || 0)));
          const trfQ = Number(it.transferred_to_stitching || Math.max(0, accQ - readyQ));

          const productJobOrders = jobOrders.filter((j: any) => {
            const jItems = Array.isArray(j.items_json) ? j.items_json : [];
            return jItems.some((ji: any) =>
              (ji.production_order_item_id && ji.production_order_item_id == (it.active_embroidery_item_id || it.id)) ||
              (ji.product_id && ji.product_id == it.product_id && (ji.color || '').trim().toLowerCase() === (it.color || '').trim().toLowerCase())
            ) || jobOrders.length === 1;
          });

          return (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{it.product_name}</h4>
                  {it.product_code && (
                    <span className="font-mono text-xs text-brand-600 block">{it.product_code}</span>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-xs">
                <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-indigo-700 block">Cut Arrived</span>
                  <span className="text-sm font-bold text-indigo-900">{fmt(arrivedQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-brand-50 border border-brand-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-brand-700 block">Dispatched</span>
                  <span className="text-sm font-bold text-brand-900">{fmt(sentQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">With Vendor</span>
                  <span className="text-sm font-bold text-amber-900">{fmt(outQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Accepted Inward</span>
                  <span className="text-sm font-bold text-emerald-900">{fmt(accQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-red-700 block">Rejection / Defect</span>
                  <span className="text-sm font-bold text-red-900">{fmt(rejQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">Rework Required</span>
                  <span className="text-sm font-bold text-amber-900">{fmt(rwkQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Ready to Stitch</span>
                  <span className="text-sm font-bold text-purple-900">{fmt(readyQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Transferred Next</span>
                  <span className="text-sm font-bold text-slate-800">{fmt(trfQ)} pcs</span>
                </div>
              </div>

              {/* Related Job Orders */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Associated Job Orders ({productJobOrders.length})
                </h5>
                {productJobOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg text-center">
                    No job orders dispatched for this product line yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs text-left font-mono">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                        <tr>
                          <th className="py-2 px-3">Job Order #</th>
                          <th className="py-2 px-3">Vendor</th>
                          <th className="py-2 px-2 text-right">Sent</th>
                          <th className="py-2 px-2 text-right">Received</th>
                          <th className="py-2 px-2 text-right">Outstanding</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {productJobOrders.map((j: any) => (
                          <tr key={j.id}>
                            <td className="py-2 px-3 font-bold text-brand-700">{j.job_order_number}</td>
                            <td className="py-2 px-3 text-slate-600">{j.vendor_name}</td>
                            <td className="py-2 px-2 text-right font-bold text-slate-800">{fmt(j.total_quantity_sent)}</td>
                            <td className="py-2 px-2 text-right text-emerald-700 font-semibold">{fmt(j.total_quantity_received)}</td>
                            <td className="py-2 px-2 text-right text-amber-700 font-bold">{fmt(j.total_quantity_outstanding)}</td>
                            <td className="py-2 px-3">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {j.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setViewProductModalOpen(false);
                    setSelectedProductForView(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* BULK OUTWARD DISPATCH / JOB ORDER MODAL */}
      <Modal
        isOpen={bulkDispatchModalOpen}
        onClose={() => setBulkDispatchModalOpen(false)}
        title={`Bulk Embroidery Outward Dispatch — ${order?.order_number || ''}`}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="bg-brand-50/70 border border-brand-200/80 rounded-xl p-3 flex items-start gap-2.5">
            <Truck className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            <div className="text-xs text-brand-900 leading-relaxed">
              <p className="font-bold">Stage 06 — Bulk Embroidery Outward Dispatch</p>
              <p className="text-brand-800/90 text-[11px] mt-0.5">
                Issue a consolidated Delivery Challan / Job Order to dispatch cut garment panels across eligible product lines to your embroidery vendor. Physical inward receipt, quality inspection, and stitching transfer follow as separate operational steps.
              </p>
            </div>
          </div>

          {bulkDispatchError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{bulkDispatchError}</span>
            </div>
          )}

          {/* Common Vendor & Dispatch Information */}
          <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Embroidery Vendor / Mill *" required>
                <select
                  value={bulkVendorName}
                  onChange={(e) => setBulkVendorName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  {supplierOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} {opt.sublabel ? `(${opt.sublabel})` : ''}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Delivery Challan No *" required>
                <input
                  type="text"
                  value={bulkDeliveryChallanNo}
                  onChange={(e) => setBulkDeliveryChallanNo(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Dispatch Date *" required>
                <input
                  type="date"
                  value={bulkDispatchDate}
                  onChange={(e) => setBulkDispatchDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                />
              </FormField>

              <FormField label="Expected Return Date">
                <input
                  type="date"
                  value={bulkExpectedReturnDate}
                  onChange={(e) => setBulkExpectedReturnDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                />
              </FormField>

              <FormField label="Transport / Courier">
                <input
                  type="text"
                  value={bulkTransportCourier}
                  onChange={(e) => setBulkTransportCourier(e.target.value)}
                  placeholder="e.g. In-house Driver, DTDC"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                />
              </FormField>
            </div>

            <FormField label="Job Work Instructions & Notes">
              <input
                type="text"
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                placeholder="e.g. Chest embroidery with gold Madeira thread, 2000 stitches"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
              />
            </FormField>
          </div>

          {/* Product Lines List */}
          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
              Eligible Product Lines ({bulkDispatchItems.length})
            </div>
            {bulkDispatchItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                No product lines currently have arrived fabric eligible for embroidery dispatch.
              </div>
            ) : (
              bulkDispatchItems.map((l, idx) => {
                const avail = Number(l.item.available_to_dispatch || 0);
                const orderQ = Number(l.item.order_quantity || l.item.total_quantity || 0);
                const arrivedQ = Number(l.item.arrived_from_cutting || 0);
                const isIncluded = Number(l.quantity_sent) > 0;

                return (
                  <div
                    key={l.item.id || idx}
                    className={`p-3.5 rounded-xl border transition ${isIncluded
                      ? 'bg-white border-brand-300 shadow-2xs'
                      : 'bg-slate-50/60 border-slate-200 opacity-75'
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Product Details */}
                      <div className="space-y-1 sm:w-1/2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-800 text-xs">
                            {l.item.product_name || 'Product'}
                          </span>
                          {l.item.product_code && (
                            <span className="font-mono text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                              {l.item.product_code}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center gap-3 pl-7">
                          <span>Color: <strong className="text-slate-800">{l.item.color || 'Standard'}</strong></span>
                          <span>Size: <strong className="text-slate-800">{l.item.size || 'M'}</strong></span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-3 pl-7">
                          <span>Order: <strong className="font-mono text-slate-700">{fmt(orderQ)} pcs</strong></span>
                          <span>Cut Arrived: <strong className="font-mono text-indigo-700 font-semibold">{fmt(arrivedQ)}</strong></span>
                          <span>Available: <strong className="font-mono text-brand-700 font-bold">{fmt(avail)} pcs</strong></span>
                        </div>
                      </div>

                      {/* Right: Quantities & Rates */}
                      <div className="sm:w-1/2 flex items-center gap-2 justify-end">
                        <div className="w-28">
                          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                            Dispatch Qty *
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={avail}
                            value={l.quantity_sent}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              setBulkDispatchItems((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, quantity_sent: val, error: '' } : p))
                              );
                            }}
                            className={`w-full px-2 py-1 text-xs border rounded font-mono text-right font-bold ${isIncluded ? 'border-brand-500 text-brand-900 bg-brand-50/40' : 'border-slate-300 text-slate-400'
                              }`}
                          />
                        </div>

                        <div className="w-20">
                          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                            Rate (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={l.rate}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              setBulkDispatchItems((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, rate: val } : p))
                              );
                            }}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-mono text-right"
                          />
                        </div>

                        <div className="flex flex-col gap-1 pt-4">
                          <button
                            type="button"
                            onClick={() => {
                              setBulkDispatchItems((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, quantity_sent: avail, error: '' } : p
                                )
                              );
                            }}
                            className="text-[10px] text-brand-700 hover:underline px-1 py-0.5 font-medium cursor-pointer"
                            title="Set to full available"
                          >
                            Full
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBulkDispatchItems((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, quantity_sent: 0, error: '' } : p
                                )
                              );
                            }}
                            className="text-[10px] text-slate-400 hover:text-red-600 px-1 py-0.5 font-medium cursor-pointer"
                            title="Skip this line"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    </div>

                    {l.error && (
                      <div className="mt-2 text-[11px] text-red-600 font-medium pl-7">
                        ⚠ {l.error}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Summary & Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-800">
                {bulkDispatchItems.filter((l) => Number(l.quantity_sent) > 0).length} of {bulkDispatchItems.length}
              </span>{' '}
              product lines selected (Total:{' '}
              <strong className="font-mono text-brand-700">
                {fmt(bulkDispatchItems.reduce((s, l) => s + (Number(l.quantity_sent) || 0), 0))} pcs
              </strong>{' '}
              to <strong className="text-slate-800">{bulkVendorName}</strong>)
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBulkDispatchModalOpen(false)}
                disabled={submittingBulkDispatch}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={submittingBulkDispatch}
                onClick={handleSaveBulkDispatch}
                className="bg-brand-600 hover:bg-brand-700 text-white font-bold"
              >
                {submittingBulkDispatch ? 'Creating Job Order...' : 'Confirm Outward Dispatch'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* VIEW PRODUCT LINE DETAILS MODAL */}
      <Modal
        isOpen={viewProductModalOpen}
        onClose={() => {
          setViewProductModalOpen(false);
          setSelectedProductForView(null);
        }}
        title={`Embroidery Product Line — ${selectedProductForView?.product_name || 'Product'}`}
        maxWidth="max-w-2xl"
      >
        {selectedProductForView && (() => {
          const it = selectedProductForView;
          const orderQ = Number(it.order_quantity || it.total_quantity || 0);
          const arrivedQ = Number(it.arrived_from_cutting || 0);
          const sentQ = Number(it.sent_to_vendor || 0);
          const accQ = Number(it.accepted_inward || 0);
          const rejQ = Number(it.rejected_quantity || 0);
          const rwkQ = Number(it.rework_quantity || 0);
          const outQ = Number(it.outstanding_quantity || 0);
          const readyQ = Number(it.ready_to_transfer !== undefined ? it.ready_to_transfer : Math.max(0, accQ - Number(it.transferred_to_stitching || 0)));
          const trfQ = Number(it.transferred_to_stitching || Math.max(0, accQ - readyQ));

          const productJobOrders = jobOrders.filter((j: any) => {
            const jItems = Array.isArray(j.items_json) ? j.items_json : [];
            return jItems.some((ji: any) =>
              (ji.production_order_item_id && ji.production_order_item_id == (it.active_embroidery_item_id || it.id)) ||
              (ji.product_id && ji.product_id == it.product_id && (ji.color || '').trim().toLowerCase() === (it.color || '').trim().toLowerCase())
            ) || jobOrders.length === 1;
          });

          return (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{it.product_name}</h4>
                  {it.product_code && (
                    <span className="font-mono text-xs text-brand-600 block">{it.product_code}</span>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-xs">
                <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-indigo-700 block">Cut Arrived</span>
                  <span className="text-sm font-bold text-indigo-900">{fmt(arrivedQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-brand-50 border border-brand-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-brand-700 block">Dispatched</span>
                  <span className="text-sm font-bold text-brand-900">{fmt(sentQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">With Vendor</span>
                  <span className="text-sm font-bold text-amber-900">{fmt(outQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Accepted Inward</span>
                  <span className="text-sm font-bold text-emerald-900">{fmt(accQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-red-700 block">Rejection / Defect</span>
                  <span className="text-sm font-bold text-red-900">{fmt(rejQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">Rework Required</span>
                  <span className="text-sm font-bold text-amber-900">{fmt(rwkQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Ready to Stitch</span>
                  <span className="text-sm font-bold text-purple-900">{fmt(readyQ)} pcs</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Transferred Next</span>
                  <span className="text-sm font-bold text-slate-800">{fmt(trfQ)} pcs</span>
                </div>
              </div>

              {/* Related Job Orders */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Associated Job Orders ({productJobOrders.length})
                </h5>
                {productJobOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg text-center">
                    No job orders dispatched for this product line yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs text-left font-mono">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                        <tr>
                          <th className="py-2 px-3">Job Order #</th>
                          <th className="py-2 px-3">Vendor</th>
                          <th className="py-2 px-2 text-right">Sent</th>
                          <th className="py-2 px-2 text-right">Received</th>
                          <th className="py-2 px-2 text-right">Outstanding</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {productJobOrders.map((j: any) => (
                          <tr key={j.id}>
                            <td className="py-2 px-3 font-bold text-brand-700">{j.job_order_number}</td>
                            <td className="py-2 px-3 text-slate-600">{j.vendor_name}</td>
                            <td className="py-2 px-2 text-right font-bold text-slate-800">{fmt(j.total_quantity_sent)}</td>
                            <td className="py-2 px-2 text-right text-emerald-700 font-semibold">{fmt(j.total_quantity_received)}</td>
                            <td className="py-2 px-2 text-right text-amber-700 font-bold">{fmt(j.total_quantity_outstanding)}</td>
                            <td className="py-2 px-3">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {j.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setViewProductModalOpen(false);
                    setSelectedProductForView(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>


      {/* Job Work Order & Inward Receipt Document Preview/Print Modal */}
      <JobWorkDocumentModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        docType={printDocType}
        order={order}
        itemData={printDocItem}
        receiptList={receipts}
        supplier={suppliers.find((s: any) =>
          (s.name || '').toLowerCase() === (printDocItem?.vendor_name || '').toLowerCase()
        ) || embroideryUnits.find((u: any) =>
          (u.name || '').toLowerCase() === (printDocItem?.vendor_name || '').toLowerCase()
        )}
        companySettings={companySettings}
      />

      {/* Stage 06 Embroidery Modification Request Modal */}
      {order && (
        <StageModificationModal
          isOpen={modModalOpen}
          onClose={() => {
            setModModalOpen(false);
            setSelectedRecordForMod(null);
          }}
          orderId={Number(order.id || id)}
          orderNumber={order.order_number || `ORD-${id}`}
          orderTitle={order.title}
          stageId={6}
          stageName="06. Embroidery"
          targetRecord={selectedRecordForMod}
          currentSnapshot={{
            order_title: order.title,
            target_delivery_date: order.target_delivery_date,
            priority: order.priority,
            embroidery_jobs: jobOrders,
            items: items,
            notes: order.notes,
          }}
          onSuccess={() => {
            setToastMessage('Modification request submitted to Admin for approval!');
            fetchOrderData();
          }}
        />
      )}
    </div>
  );
}
