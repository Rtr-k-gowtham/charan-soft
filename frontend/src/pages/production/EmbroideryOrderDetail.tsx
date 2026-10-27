// src/pages/production/EmbroideryOrderDetail.tsx
// Stage 06: Embroidery — Dedicated Outward / Inward Job Work Module with Vendor Tracking & Proof
// Redesigned to strict Cheran Soft Goods ERP design system: Table-based layout, ERP blue palette,
// full-page Outward Job Order creation form matching Stage 04 Dyeing Order UI,
// proper item tracking from Cutting arrival to Outward Dispatch, Inward QC, and Transfer to Stitching.
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useStageBackNavigation } from '../../utils/navigation';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, EmbroideryJobOrder, EmbroideryReceipt } from '../../types';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import SearchableSelect, { SelectOption } from '../../components/ui/SearchableSelect';
import { LivePhotoCaptureField } from '../../components/production/LivePhotoCaptureField';
import { lookupPantone, VERIFIED_PANTONE_LIBRARY } from '../../lib/pantoneService';
import JobWorkDocumentModal, { JobWorkDocType } from '../../components/documents/JobWorkDocumentModal';
import StageInspectionModal from '../../components/production/StageInspectionModal';
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
  Upload,
  Clock,
  ArrowDownCircle,
  Scissors,
  Building2,
  Save,
  FileSpreadsheet,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import StageReworkSection from '../../components/production/StageReworkSection';

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
  const [fabricName, setFabricName] = useState<string>('');
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

  // Quality Inspection Modal State (Stage 06: Embroidery)
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [selectedReceiptForInspect, setSelectedReceiptForInspect] = useState<any | null>(null);

  // Stage Transfer to Stitching Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferItem, setTransferItem] = useState<any | null>(null);
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

  // Inward Modal Handlers
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
        accepted: 0,
        rejected: 0,
        rework: 0
      };
    });

    if (jItems.length === 0) {
      const out = Number(job.total_quantity_outstanding || job.total_quantity_sent || 0);
      initQty['0'] = { received: out, accepted: 0, rejected: 0, rework: 0 };
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
            received_quantity: Number(q.received)
          });
        }
      });
    } else {
      const q = inwardItemQuantities['0'] || { received: 0, accepted: 0, rejected: 0, rework: 0 };
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

  // Stage Transfer to Stitching
  const handleOpenTransferModal = (itemOrJob: any) => {
    let it = itemOrJob;
    let jId: number | undefined = undefined;
    let maxQty = 0;

    if (itemOrJob && itemOrJob.total_quantity_sent !== undefined) {
      // Called from Job Order row
      jId = itemOrJob.id;
      const jobReady = Number(
        itemOrJob.ready_to_transfer !== undefined
          ? itemOrJob.ready_to_transfer
          : Math.max(0, Number(itemOrJob.total_quantity_accepted || 0) - Number(itemOrJob.transferred_to_stitching_quantity || 0))
      );
      const jobItemId = Array.isArray(itemOrJob.items_json) && itemOrJob.items_json[0]?.production_order_item_id;
      it = (jobItemId && items.find(i => i.id === jobItemId || i.active_embroidery_item_id === jobItemId)) ||
           items.find(i => Number(i.ready_to_transfer || 0) > 0) ||
           items[0];

      const itemReady = Number(it?.ready_to_transfer !== undefined ? it.ready_to_transfer : (it?.accepted_inward || 0));
      maxQty = jobReady > 0 ? jobReady : itemReady;
    } else {
      // Called from Product Item row
      maxQty = Number(it?.ready_to_transfer !== undefined ? it.ready_to_transfer : (it?.accepted_inward || 0));
    }

    if (maxQty <= 0) {
      showToast('All accepted embroidery pieces have already been transferred to Stitching.');
      return;
    }

    setTransferItem({ ...it, job_order_id: jId, ready_to_transfer: maxQty });
    setTransferQuantity(maxQty);
    setTransferRemarks('Embroidery completed and QC approved. Transferred to Stage 07: Stitching.');
    setTransferError('');
    setTransferModalOpen(true);
  };

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
        item_id: transferItem?.active_embroidery_item_id || transferItem?.id || items[0]?.active_embroidery_item_id || items[0]?.id || 0,
        job_order_id: transferItem?.job_order_id,
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

              <FormField label="Fabric Material (Eligible for Embroidery)" required>
                <input
                  type="text"
                  value={fabricName}
                  onChange={e => setFabricName(e.target.value)}
                  className="w-full text-xs rounded-lg border-slate-300 py-2 px-3 font-medium bg-white focus:ring-brand-500 focus:border-brand-500"
                  placeholder="e.g. Cut Pieces / Garment Fabric"
                />
              </FormField>

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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('job_orders')}
            className={`pb-3 pt-1 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'job_orders'
                ? 'border-brand-600 text-brand-700 bg-brand-50/40 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Embroidery Job Orders & Inward ({jobOrders.length})
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
            Stage 06 Rework & Vendor Correction
            {overallTotals.reworkQty > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                {fmt(overallTotals.reworkQty)} pcs
              </span>
            )}
          </button>
        </div>

        {activeTab === 'job_orders' && (
          <>
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
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  productFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Products ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setProductFilter('EMBROIDERY')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  productFilter === 'EMBROIDERY'
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
                            {availQ > 0 ? (
                              <Button
                                id={`btn-dispatch-outward-${idx}`}
                                size="xs"
                                variant="primary"
                                icon={<Send className="w-3 h-3" />}
                                onClick={() => handleOpenCreatePage(it)}
                                className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-[11px] shadow-2xs"
                              >
                                Dispatch Outward
                              </Button>
                            ) : arrivedQ > 0 && outQ > 0 ? (
                              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                With Vendor
                              </span>
                            ) : readyQ > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  QC Passed ({fmt(readyQ)})
                                </span>
                                <Button
                                  id={`btn-transfer-stitching-item-${idx}`}
                                  size="xs"
                                  variant="secondary"
                                  icon={<ArrowRight className="w-3 h-3" />}
                                  onClick={() => handleOpenTransferModal(it)}
                                  className="text-[11px] font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                                >
                                  To Stitching
                                </Button>
                              </div>
                            ) : accQ > 0 ? (
                              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-purple-600" />
                                Transferred to Stitching
                              </span>
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

                    const jobPhotos = parsePhotos(job.attachments);
                    const receiptPhotos = receipts
                      .filter(r => Number(r.job_order_id) === Number(job.id))
                      .flatMap(r => parsePhotos(r.photo_urls));
                    const allPhotos = [...jobPhotos, ...receiptPhotos];

                    return (
                      <tr key={job.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-brand-700">
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
                            <button
                              type="button"
                              onClick={() => handleOpenPrintModal('EMBROIDERY_OUTWARD', job)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition shadow-2xs"
                              title="Print / Download Embroidery Job Order & Outward Challan"
                            >
                              <Printer className="w-3.5 h-3.5 text-purple-600" />
                              <span>Challan</span>
                            </button>
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
                            ) : Number(job.ready_to_transfer !== undefined ? job.ready_to_transfer : Math.max(0, Number(job.total_quantity_accepted || 0) - Number(job.transferred_to_stitching_quantity || 0))) > 0 ? (
                              <Button
                                id={`btn-transfer-stitching-${job.id}`}
                                size="xs"
                                variant="secondary"
                                icon={<ArrowRight className="w-3 h-3" />}
                                onClick={() => handleOpenTransferModal(job)}
                                className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold text-[11px]"
                              >
                                To Stitching ({fmt(Number(job.ready_to_transfer || 0))})
                              </Button>
                            ) : Number(job.total_quantity_accepted || 0) > 0 ? (
                              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-purple-600" />
                                Transferred to Stitching
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                Completed
                              </span>
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

        {/* Table 3: Recorded Embroidery Inward Receipts & Quality Inspection Reports */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mt-6">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <h3 className="font-bold text-slate-800 text-sm">
                Recorded Inward Receipts & Quality Inspection Reports
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
                Once embroidered pieces are received from the vendor, click "Receive Inward" on any active job order above to log received pieces, QC inspection, and photo proof.
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
                    <th className="py-3 px-3 text-right">Accepted</th>
                    <th className="py-3 px-3 text-right">Rej / Rework</th>
                    <th className="py-3 px-3">QC Inspector</th>
                    <th className="py-3 px-3 text-center">Photo Proof</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {receipts.map((rec, rIdx) => {
                    const photos = parsePhotos(rec.photo_urls);
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
                        <td className="py-3 px-3 text-right font-bold text-emerald-700">{fmt(rec.total_received_qty)}</td>
                        <td className="py-3 px-3 text-right font-bold text-green-700">{fmt(rec.total_accepted_qty)}</td>
                        <td className="py-3 px-3 text-right text-slate-600 font-semibold">
                          <span className="text-red-600">{fmt(rec.total_rejected_qty)}</span> / <span className="text-amber-600">{fmt(rec.total_rework_qty)}</span>
                        </td>
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
                            {(() => {
                              const uninspected = Math.max(0, Number(rec.total_received_qty || 0) - Number(rec.total_accepted_qty || 0) - Number(rec.total_rework_qty || 0) - Number(rec.total_rejected_qty || 0));
                              return uninspected > 0 ? (
                                <Button
                                  size="xs"
                                  variant="primary"
                                  icon={<ShieldCheck className="w-3 h-3 text-white" />}
                                  onClick={() => {
                                    setSelectedReceiptForInspect(rec);
                                    setShowInspectModal(true);
                                  }}
                                  className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-[11px]"
                                  title="Perform Quality Inspection on Inward Pieces"
                                >
                                  Inspect ({uninspected})
                                </Button>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Inspected
                                </span>
                              );
                            })()}
                            <button
                              type="button"
                              onClick={() => handleOpenPrintModal('EMBROIDERY_INWARD', rec)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition shadow-2xs"
                              title="Print / Download Embroidery Inward QC Receipt"
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
      </>
    )}

    {activeTab === 'rework' && (
      <StageReworkSection
        productionOrderId={Number(order?.id || id)}
        stageId={6}
        stageCode="EMB"
        stageName="Embroidery"
        uom="PCS"
        onReload={fetchOrderData}
      />
    )}
  </div>

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
                                  [key]: { ...q, received: sent }
                                }));
                              }}
                              className="text-[10px] font-bold text-brand-600 hover:text-brand-800 hover:underline cursor-pointer"
                              title="Set to total sent quantity"
                            >
                              Fill Max ({fmt(sent)})
                            </button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max={sent}
                            value={q.received}
                            onChange={e => {
                              const rVal = Math.max(0, Number(e.target.value));
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
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Received Qty (Pieces) *</label>
                    <input
                      type="number"
                      min="0"
                      value={inwardItemQuantities['0']?.received || 0}
                      onChange={e => {
                        const v = Number(e.target.value);
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

      {/* MODAL 2: Transfer to Stitching */}
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
              max={Number(transferItem?.ready_to_transfer || 0)}
              value={transferQuantity}
              onChange={e => setTransferQuantity(Number(e.target.value))}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono font-bold text-purple-900"
              required
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Remaining eligible untransferred: <strong className="text-purple-700 font-bold">{Number(transferItem?.ready_to_transfer || 0)}</strong> pcs
            </span>
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

      {/* Quality Inspection Modal (Stage 06: Embroidery) */}
      {selectedReceiptForInspect && (
        <StageInspectionModal
          isOpen={showInspectModal}
          onClose={() => {
            setShowInspectModal(false);
            setSelectedReceiptForInspect(null);
          }}
          title={`Embroidery Quality Inspection — Receipt ${selectedReceiptForInspect.receipt_number}`}
          productionOrderId={Number(order?.id || id)}
          stageId={6}
          stageCode="EMB"
          referenceId={selectedReceiptForInspect.receipt_number}
          referenceType="Embroidery Receipt"
          batchNumber={selectedReceiptForInspect.job_order_number || `EMB-JOB-${selectedReceiptForInspect.job_order_id}`}
          productName="Embroidered Garment Panels"
          vendorName={selectedReceiptForInspect.vendor_name || 'Embroidery Vendor'}
          availableQuantity={Math.max(0, Number(selectedReceiptForInspect.total_received_qty || 0) - Number(selectedReceiptForInspect.total_accepted_qty || 0) - Number(selectedReceiptForInspect.total_rework_qty || 0) - Number(selectedReceiptForInspect.total_rejected_qty || 0))}
          uom="PCS"
          supportsRejection={true}
          onSuccess={async () => {
            setShowInspectModal(false);
            setSelectedReceiptForInspect(null);
            showToast('Embroidery inspection recorded successfully! Accepted balance credited for transfer to Stitching.');
            await fetchOrderData();
          }}
        />
      )}

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
    </div>
  );
}
