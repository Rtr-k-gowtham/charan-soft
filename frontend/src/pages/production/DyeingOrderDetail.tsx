// src/pages/production/DyeingOrderDetail.tsx
// Stage 04: Fabric Dyeing Orders & Inward Receiving with Pantone Colors & Photo Proof
// Redesigned to strict Cheran Soft Goods ERP design system: Table-based layout, ERP palette,
// dynamic fabric material dropdown, and Total Outward Fabric field removed from Create form.
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useStageBackNavigation } from '../../utils/navigation';
import { api } from '../../lib/api';
import { 
  ProductionOrder, 
  ProductionStage, 
  DyeingOrder, 
  DyeingOrderItem, 
  DyeingReceipt 
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
import {
  ArrowLeft,
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
  Upload,
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
  FileSpreadsheet
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

  // Tabs: 'orders' | 'history'
  const [activeTab, setActiveTab] = useState<'orders' | 'history'>('orders');
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
    shrinkage_loss_percent: number;
    shade_match_status: string;
    notes: string;
  }[]>([]);
  const [receiptChallanNo, setReceiptChallanNo] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [receivedBy, setReceivedBy] = useState('');
  const [shadeCondition, setShadeCondition] = useState('Approved - Pantone Matched');
  const [receiptRemarks, setReceiptRemarks] = useState('');
  const [advanceToCutting, setAdvanceToCutting] = useState(true);
  const [savingReceive, setSavingReceive] = useState(false);
  const [receiveError, setReceiveError] = useState('');

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
    const avail = customAvail !== undefined
      ? customAvail
      : (Number(stock?.balance_available_for_dyeing) > 0 
          ? Number(stock.balance_available_for_dyeing) 
          : (Number(stock?.total_fabric_inwarded) > 0 ? Number(stock.total_fabric_inwarded) : 100));

    let candidateList: { color_name: string; pantone_code: string; hex_code: string; garment_qty: number }[] = [];

    // 1. Try stock.suggested_colors from backend
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
    // 2. Or fallback to ord.items (production_order_items)
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

    // 3. If no colors found on order items at all, return empty or single unassigned row
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
        planned_quantity: allocatedQty > 0 ? allocatedQty : 1,
        rate_per_unit: '',
        notes: c.garment_qty > 0 ? `For ${c.garment_qty} pcs in order` : ''
      };
    });

    // Adjust any rounding drift on the last item so the total matches exactly
    const currentSum = rows.reduce((s, r) => s + (Number(r.planned_quantity) || 0), 0);
    const drift = Math.round((avail - currentSum) * 100) / 100;
    if (rows.length > 0 && Math.abs(drift) > 0 && Math.abs(drift) < 5) {
      const lastIdx = rows.length - 1;
      const newLastQty = Math.max(0.1, Math.round(((Number(rows[lastIdx].planned_quantity) || 0) + drift) * 100) / 100);
      rows[lastIdx].planned_quantity = newLastQty;
    }

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

  // Open Create Dyeing Order Full Page with auto-populated colors
  const handleOpenCreateModal = () => {
    setChallanNo(`DC-DYE-${Math.floor(1000 + Math.random() * 9000)}`);
    setCreateError('');
    setFabricSearchQuery('');
    setIsAdditionalLot(true);

    // Pre-select first eligible fabric if not yet selected
    if (!fabricMaterialId && eligibleFabrics.length > 0) {
      const first = eligibleFabrics[0];
      setFabricMaterialId(first.material_id);
      setFabricName(first.material_name);
      setUom(first.uom);
      setColorRows(buildOrderColors(order, fabricStockData, first.available_quantity));
    } else {
      if (colorRows.length === 0) {
        setColorRows(buildOrderColors(order, fabricStockData, availableFabricBalance));
      }
    }
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

  // Submit Create Dyeing Order (supports Draft and Confirmed outward)
  const handleCreateDyeingOrder = async (orderStatus: 'Draft' | 'Sent to Dyeing' = 'Sent to Dyeing') => {
    setCreateError('');

    if (!selectedSupplierId) {
      setCreateError('Please select a Dyeing Processor / Mill.');
      return;
    }

    if (!fabricMaterialId && !fabricName.trim()) {
      setCreateError('Please select an eligible Fabric Material from the dropdown.');
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

    if (totalPlannedInModal <= 0) {
      setCreateError('Total dyeing outward quantity must be greater than 0.');
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
        fabric_material_id: fabricMaterialId,
        fabric_name: fabricName || selectedFabric?.material_name || 'Fabric Material',
        fabric_code: selectedFabric?.material_code || undefined,
        uom,
        challan_no: challanNo,
        order_date: orderDate,
        expected_delivery_date: expectedDate,
        process_type: processType,
        remarks,
        status: orderStatus,
        is_additional_lot: true,
        allow_overdraft: true,
        force_create: true,
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
        shrinkage_loss_percent: 0,
        shade_match_status: 'Approved - Pantone Matched',
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
        shrinkage_loss_percent: 0,
        shade_match_status: 'Approved - Pantone Matched',
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
      const sent = Number(updated[index].planned_quantity || 0);
      const rec = value === '' ? 0 : Number(value);
      if (sent > 0 && rec >= 0) {
        const diff = sent - rec;
        const shrinkage = diff > 0 ? Number(((diff / sent) * 100).toFixed(2)) : 0;
        updated[index].shrinkage_loss_percent = shrinkage;
      }
    }

    setReceivingItems(updated);
  };

  const handleFillItemMax = (index: number) => {
    const updated = [...receivingItems];
    const it = updated[index];
    const remaining = Math.max(0, Number((it.planned_quantity - it.already_received).toFixed(2)));
    updated[index] = { ...it, received_quantity: remaining, shrinkage_loss_percent: 0 };
    setReceivingItems(updated);
  };

  const handleFillAllRemaining = () => {
    const updated = receivingItems.map(it => {
      const remaining = Math.max(0, Number((it.planned_quantity - it.already_received).toFixed(2)));
      return { ...it, received_quantity: remaining, shrinkage_loss_percent: 0 };
    });
    setReceivingItems(updated);
  };

  const handleClearAllQuantities = () => {
    const updated = receivingItems.map(it => ({ ...it, received_quantity: 0 }));
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
        shrinkage_loss_percent: 0,
        shade_match_status: 'Approved - Pantone Matched',
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
        received_by: receivedBy,
        photo_url: photoUrl,
        shade_condition: shadeCondition,
        remarks: receiptRemarks,
        advance_to_cutting: advanceToCutting,
        items: receivingItems.map(it => ({
          item_id: it.item_id,
          color_name: it.color_name,
          planned_quantity: Number(it.planned_quantity || 0),
          received_quantity: Number(it.received_quantity || 0),
          shrinkage_loss_percent: Number(it.shrinkage_loss_percent || 0),
          shade_match_status: it.shade_match_status,
          notes: it.notes
        }))
      };

      await api.receiveDyeingOrder(selectedDyeingOrder.id, payload);
      setShowReceiveModal(false);
      setSelectedDyeingOrder(null);
      setSuccessToast(`Dyed fabric inward receipt recorded successfully!`);
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
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save as Draft</span>
            </button>

            <Button
              type="button"
              loading={creating}
              onClick={() => handleCreateDyeingOrder('Sent to Dyeing')}
              icon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs px-4 py-2"
            >
              <span>+ Create Dyeing Order</span>
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

              <SearchableSelect
                label="Fabric Material (Eligible for Dyeing)"
                required
                value={fabricMaterialId ? String(fabricMaterialId) : ''}
                onChange={val => {
                  const num = Number(val);
                  const sel = eligibleFabrics.find(f => f.material_id === num);
                  if (sel) {
                    setFabricMaterialId(sel.material_id);
                    setFabricName(sel.material_name);
                    setUom(sel.uom);
                    setColorRows(buildOrderColors(order, fabricStockData, sel.available_quantity));
                  }
                }}
                options={fabricOptions}
                placeholder="— Select Fabric Material with Search —"
                searchPlaceholder="Search fabric name or code..."
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
                            value={row.planned_quantity}
                            onChange={e => handleColorRowChange(idx, 'planned_quantity', e.target.value)}
                            placeholder="0.00"
                            className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2 text-right font-mono font-bold text-slate-900 bg-white focus:ring-brand-500 focus:border-brand-500"
                            required
                          />
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
              onClick={() => navigate('/production/cutting')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
            >
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
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

        {/* Fabric Balance & Outward Pipeline Summary (Standard ERP Theme) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Fabric Balance & Outward Summary
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Inwarded fabric from Stage 03 Inward vs sent to dyeing mills & received back
              </p>
            </div>
            <Button
              onClick={handleOpenCreateModal}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Create Dyeing Order</span>
            </Button>
          </div>

          {/* 4 Summary Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4">
            {/* 1. Inward Fabric */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Inward Fabric</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">{fmt(totalFabricInwarded, 1)}</span>
                <span className="text-xs text-slate-500 font-semibold">MTR</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Received from Stage 03 Fabric POs</p>
            </div>

            {/* 2. Sent to Dyeing (Out) */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Sent to Dyeing (Out)</span>
                <Truck className="w-4 h-4 text-brand-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold font-mono text-brand-700">{fmt(totalFabricOutward, 1)}</span>
                <span className="text-xs text-slate-500 font-semibold">MTR</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Total outward delivery challans</p>
            </div>

            {/* 3. Available to Send */}
            <div className={`rounded-xl p-3.5 border flex flex-col justify-between ${
              balanceToOutward > 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50/70 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Available to Send</span>
                <Boxes className={`w-4 h-4 ${balanceToOutward > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className={`text-xl sm:text-2xl font-bold font-mono ${balanceToOutward > 0 ? 'text-amber-800' : 'text-slate-700'}`}>
                  {fmt(balanceToOutward, 1)}
                </span>
                <span className="text-xs text-slate-500 font-semibold">MTR</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {balanceToOutward > 0 ? 'Ready for new dyeing order' : 'All inward fabric allocated'}
              </p>
            </div>

            {/* 4. Dyed Fabric Received */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Dyed Fabric Received</span>
                <CheckCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-700">{fmt(totalFabricReceived, 1)}</span>
                <span className="text-xs text-slate-500 font-semibold">MTR</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Inwarded from dyeing mills</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'orders'
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Droplets className="w-3.5 h-3.5" />
              <span>Dyeing Orders</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 ml-1">
                {dyeingOrders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'history'
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Dyed Fabric Inward Receipts</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 ml-1">
                {allDyeingReceipts.length}
              </span>
            </button>
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

            {activeTab === 'orders' && (
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
            )}
          </div>
        </div>

        {/* TAB 1: DYEING ORDERS TABLE */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3 min-w-[130px]">Dyeing Order #</th>
                    <th className="py-3 px-3 min-w-[180px]">Dyeing Processor / Mill</th>
                    <th className="py-3 px-3 min-w-[170px]">Fabric Material</th>
                    <th className="py-3 px-3 min-w-[140px]">Process Type</th>
                    <th className="py-3 px-3 text-right min-w-[110px]">Outward Qty</th>
                    <th className="py-3 px-3 min-w-[220px]">Pantone / Color Information</th>
                    <th className="py-3 px-3 min-w-[110px]">Outward Date</th>
                    <th className="py-3 px-3 min-w-[110px]">Expected Date</th>
                    <th className="py-3 px-3 text-center min-w-[120px]">Status</th>
                    <th className="py-3 px-3 text-right min-w-[130px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDyeingOrders.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
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
                            <td className="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">
                              {idx + 1}
                            </td>

                            <td className="py-3 px-3">
                              <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                                {dOrder.dyeing_order_no}
                              </span>
                              {dOrder.challan_no && (
                                <span className="block font-mono text-[10px] text-slate-400 mt-0.5">
                                  DC: {dOrder.challan_no}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              <span className="font-semibold text-slate-800 block text-xs">
                                {dOrder.dyeing_mill_name || dOrder.supplier_name || 'Processing Mill'}
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <span className="font-medium text-slate-800 block text-xs">
                                {dOrder.fabric_name}
                              </span>
                              {dOrder.fabric_code && (
                                <span className="font-mono text-[10px] text-slate-400 block">
                                  {dOrder.fabric_code}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                {dOrder.process_type || 'Fabric Dyeing'}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-right">
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                {fmt(totalPlanned, 1)} {dOrder.uom}
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(dOrder.items || []).slice(0, 3).map((it, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-slate-100 border border-slate-200"
                                    title={`${it.color_name}: ${it.planned_quantity} ${dOrder.uom}${it.pantone_code ? ` (Pantone: ${it.pantone_code})` : ''}`}
                                  >
                                    <span
                                      className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                                      style={{ backgroundColor: it.hex_code || '#3b82f6' }}
                                    />
                                    <span className="font-medium text-slate-700">{it.color_name}</span>
                                    <span className="font-mono text-slate-500 font-semibold">{fmt(it.planned_quantity, 0)}</span>
                                  </span>
                                ))}
                                {(dOrder.items || []).length > 3 && (
                                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    +{(dOrder.items || []).length - 3} more
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3 text-slate-700 font-medium">
                              {dOrder.order_date}
                            </td>

                            <td className="py-3 px-3 text-slate-600">
                              {dOrder.expected_delivery_date || '—'}
                            </td>

                            <td className="py-3 px-3 text-center">
                              <StatusBadge status={dOrder.status} />
                              <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                                Recv: {fmt(totalRec, 1)} / {fmt(totalPlanned, 1)}
                              </span>
                            </td>

                             <td className="py-3 px-3 text-right">
                              <div className="flex items-center gap-1.5 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleOpenPrintModal('DYEING_OUTWARD', dOrder)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition shadow-2xs"
                                  title="Print / Download Dyeing Job Work Order & Outward Challan"
                                >
                                  <Printer className="w-3 h-3 text-brand-600" />
                                  <span>Challan</span>
                                </button>
                                {!isFullyReceived ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenReceive(dOrder)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-1 px-2.5 shadow-2xs"
                                  >
                                    <CheckCheck className="w-3 h-3 mr-1" />
                                    <span>Receive</span>
                                  </Button>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Completed</span>
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleExpandOrder(dOrder.id)}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                                  title={isExpanded ? 'Hide color details' : 'View color details'}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Color Breakdown Details */}
                          {isExpanded && (
                            <tr className="bg-slate-50/60">
                              <td colSpan={11} className="py-3 px-4 border-t border-b border-slate-200/80">
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
                                        {(dOrder.items || []).map((it, idx2) => (
                                          <tr key={it.id || idx2} className="hover:bg-slate-50/50">
                                            <td className="py-2 px-3">
                                              <div className="flex items-center gap-2">
                                                <span
                                                  className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                                                  style={{ backgroundColor: it.hex_code || '#3b82f6' }}
                                                />
                                                <span className="font-bold text-slate-800">{it.color_name}</span>
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
                                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                                it.shade_match_status?.includes('Approved') || it.shade_match_status?.includes('Matched')
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
                  <p className="text-[11px] text-slate-400 mt-1">
                    {searchQuery || statusFilter !== 'ALL'
                      ? 'No dyeing orders match your filter.'
                      : 'Create a dyeing order to begin processing.'}
                  </p>
                </div>
              ) : (
                filteredDyeingOrders.map((dOrder, idx) => {
                  const totalPlanned = Number(dOrder.total_fabric_quantity || 0);
                  const totalRec = Number(dOrder.total_received_quantity || 0);
                  const isFullyReceived = dOrder.status === 'Received' || (totalRec >= totalPlanned && totalPlanned > 0);
                  const isExpanded = expandedOrderIds.has(dOrder.id);

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
                          <span className="text-[10px] text-slate-500">{dOrder.process_type || 'Fabric Dyeing'}</span>
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
                        <div className="col-span-2 pt-1 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                          <span>Outward: {dOrder.order_date || '—'}</span>
                          <span>Expected: <strong>{dOrder.expected_delivery_date || '—'}</strong></span>
                        </div>
                      </div>

                      {/* Color badges */}
                      {dOrder.items && dOrder.items.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {dOrder.items.map((it, cIdx) => (
                            <span
                              key={cIdx}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-slate-100 border border-slate-200"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                                style={{ backgroundColor: it.hex_code || '#3b82f6' }}
                              />
                              <span className="font-medium text-slate-700">{it.color_name}</span>
                              {it.pantone_code && (
                                <span className="font-mono text-[9px] text-slate-400">({it.pantone_code})</span>
                              )}
                              <span className="font-mono font-bold text-slate-800 ml-0.5">{it.planned_quantity}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                        {!isFullyReceived && (
                          <button
                            type="button"
                            onClick={() => handleOpenReceive(dOrder)}
                            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Receive Dyed Fabric</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenPrintModal('DYEING_OUTWARD', dOrder)}
                          className="p-2 text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition"
                          title="Print Dyeing Job Work Order & Outward Challan"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleExpandOrder(dOrder.id)}
                          className="p-2 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                          title={isExpanded ? 'Hide details' : 'Show details'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Expandable color breakdown on mobile */}
                      {isExpanded && (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 mt-2">
                          <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1">
                            <Palette className="w-3.5 h-3.5 text-brand-600" />
                            Color Breakdown ({dOrder.items?.length || 0})
                          </h5>
                          <div className="space-y-1.5 divide-y divide-slate-200">
                            {(dOrder.items || []).map((it, idx2) => (
                              <div key={it.id || idx2} className="pt-1.5 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                                    style={{ backgroundColor: it.hex_code || '#3b82f6' }}
                                  />
                                  <span className="font-semibold text-slate-800">{it.color_name}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono font-bold text-slate-900">{it.planned_quantity} {dOrder.uom}</span>
                                  <span className="text-[10px] text-emerald-700 block">Recv: {it.received_quantity || 0}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DYED FABRIC INWARD RECEIPTS TABLE */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3 min-w-[140px]">Receipt Number</th>
                    <th className="py-3 px-3 min-w-[130px]">Related Dyeing Order</th>
                    <th className="py-3 px-3 min-w-[170px]">Fabric Material</th>
                    <th className="py-3 px-3 text-right min-w-[120px]">Received Quantity</th>
                    <th className="py-3 px-3 min-w-[120px]">Receipt Date</th>
                    <th className="py-3 px-3 min-w-[180px]">Status / Shade Condition</th>
                    <th className="py-3 px-3 min-w-[120px]">Received By</th>
                    <th className="py-3 px-3 text-right min-w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-xs text-slate-700">No Inward Receipts Recorded</p>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                          Once processed fabric is delivered by dyeing mills, click "Receive" on any active dyeing order to log received yardage and photo proof.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredReceipts.map((rec, idx) => (
                      <tr key={rec.id || idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">
                          {idx + 1}
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {rec.receipt_no}
                          </span>
                          {rec.delivery_challan_no && (
                            <span className="block font-mono text-[10px] text-slate-400 mt-0.5">
                              DC: {rec.delivery_challan_no}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {rec.dyeing_order_no}
                          </span>
                          {rec.dyeing_mill_name && (
                            <span className="block text-[11px] text-slate-500 mt-0.5">
                              {rec.dyeing_mill_name}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-medium text-slate-800 block text-xs">
                            {rec.fabric_name || 'Fabric Material'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <span className="font-mono font-bold text-emerald-700 text-xs">
                            {fmt(rec.total_received_quantity, 1)} {rec.uom || 'MTR'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {rec.receipt_date}
                        </td>

                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            {rec.shade_condition || 'Approved - Pantone Matched'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-600 text-xs">
                          {rec.received_by || 'Stores & QC Inward'}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenPrintModal('DYEING_INWARD', rec)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition shadow-2xs"
                              title="Print Inward Receipt & Inspection Report"
                            >
                              <Printer className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Receipt</span>
                            </button>
                            {rec.photo_url ? (
                              <button
                                type="button"
                                onClick={() => setZoomedPhoto(rec.photo_url)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition shadow-2xs"
                                title="Click to view full photo proof"
                              >
                                <Camera className="w-3.5 h-3.5 text-brand-600" />
                                <span>Photo</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No Photo</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards for Inward Receipts */}
            <div className="md:hidden space-y-3 p-3">
              {filteredReceipts.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-xs text-slate-700">No Inward Receipts Recorded</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Click "Receive" on any active dyeing order to log received yardage and photo proof.
                  </p>
                </div>
              ) : (
                filteredReceipts.map((rec, idx) => (
                  <div
                    key={`mob_rec_${rec.id || idx}`}
                    className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {rec.receipt_no}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                          {rec.delivery_challan_no && (
                            <span className="font-mono text-[10px] text-slate-500">
                              DC: {rec.delivery_challan_no}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs font-semibold text-slate-700 block mt-1">
                          {rec.dyeing_order_no}
                          {rec.dyeing_mill_name && (
                            <span className="text-slate-500 font-sans font-normal ml-1">
                              • {rec.dyeing_mill_name}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                        {rec.shade_condition || 'Approved'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Fabric Material
                        </span>
                        <span className="font-medium text-slate-800 text-xs mt-0.5 block truncate">
                          {rec.fabric_name || 'Fabric Material'}
                        </span>
                        <span className="text-[10px] text-slate-500">By: {rec.received_by || 'Stores & QC'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Received Qty
                        </span>
                        <span className="font-mono font-bold text-emerald-700 text-sm mt-0.5 block">
                          {fmt(rec.total_received_quantity, 1)} {rec.uom || 'MTR'}
                        </span>
                        <span className="text-[10px] text-slate-500">{rec.receipt_date}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenPrintModal('DYEING_INWARD', rec)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition shadow-2xs"
                        title="Print Inward Receipt & Inspection Report"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Print Receipt</span>
                      </button>
                      {rec.photo_url && (
                        <button
                          type="button"
                          onClick={() => setZoomedPhoto(rec.photo_url)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition"
                        >
                          <Camera className="w-3.5 h-3.5 text-brand-600" />
                          <span>View Photo</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Inward Delivery Challan (DC No)" required>
              <input
                type="text"
                value={receiptChallanNo}
                onChange={e => setReceiptChallanNo(e.target.value)}
                className="w-full text-xs font-mono rounded-xl border-slate-300 py-2 px-3"
                placeholder="e.g. INW-DYE-402"
                required
              />
            </FormField>

            <FormField label="Receipt Date" required>
              <input
                type="date"
                value={receiptDate}
                onChange={e => setReceiptDate(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 py-2 px-3"
                required
              />
            </FormField>

            <FormField label="Received & Inspected By">
              <input
                type="text"
                value={receivedBy}
                onChange={e => setReceivedBy(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 py-2 px-3"
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

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/60">
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
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Shrinkage / Loss %
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={it.shrinkage_loss_percent}
                        onChange={e => handleReceiveItemChange(idx, 'shrinkage_loss_percent', e.target.value)}
                        className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2.5 bg-white"
                        placeholder="e.g. 2.0"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Pantone Shade Check
                      </label>
                      <select
                        value={it.shade_match_status}
                        onChange={e => handleReceiveItemChange(idx, 'shade_match_status', e.target.value)}
                        className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2.5 font-semibold text-slate-800 bg-white"
                      >
                        <option value="Approved - Pantone Matched">Approved - Pantone Matched</option>
                        <option value="Approved with Minor Variation">Approved with Minor Variation</option>
                        <option value="Shade Variation (Pending Approval)">Shade Variation</option>
                        <option value="Rejected - Off Shade">Rejected - Off Shade</option>
                      </select>
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
            helperText="Photograph of received dyed fabric roll swatches against Pantone standards must be captured live via camera. File upload from device storage is disabled."
            buttonText="Take Real-Time Fabric Photo"
          />

          {/* Advance to Cutting Checkbox */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 border border-slate-200">
            <input
              type="checkbox"
              id="advanceCutting"
              checked={advanceToCutting}
              onChange={e => setAdvanceToCutting(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
            />
            <label htmlFor="advanceCutting" className="text-xs font-bold text-slate-800 cursor-pointer">
              Advance Production Items to Stage 05 (Cutting — Product-wise) once dyed fabric is verified
            </label>
          </div>

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
