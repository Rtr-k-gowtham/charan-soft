// src/pages/production/DyeingOrderDetail.tsx
// Stage 04: Fabric Dyeing Orders & Inward Receiving with Pantone Colors & Photo Proof
// Redesigned to strict Cheran Soft Goods ERP design system: Table-based layout, ERP palette,
// dynamic fabric material dropdown, and Total Outward Fabric field removed from Create form.
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
import { 
  lookupPantone, 
  VERIFIED_PANTONE_LIBRARY 
} from '../../lib/pantoneService';
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
  Building2
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
  rate_per_unit: number | '';
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
  const [isAdditionalLot, setIsAdditionalLot] = useState<boolean>(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
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
  const [processType, setProcessType] = useState<string>('Reactive Dyeing & Soft Flow');
  const [remarks, setRemarks] = useState<string>('Outward sent for color dyeing process');

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
  const [receivedBy, setReceivedBy] = useState('Stores & QC Inward');
  const [shadeCondition, setShadeCondition] = useState('Approved - Pantone Matched');
  const [receiptRemarks, setReceiptRemarks] = useState('Fabric received after dyeing and shade verified');
  const [advanceToCutting, setAdvanceToCutting] = useState(true);
  const [savingReceive, setSavingReceive] = useState(false);
  const [receiveError, setReceiveError] = useState('');

  // Photo Proof State
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  // Filtered eligible fabric materials from backend stock data
  const eligibleFabrics = useMemo<EligibleFabricMaterial[]>(() => {
    const rawList: any[] = fabricStockData?.fabric_materials || [];
    return rawList
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
        // Include any fabric that was inwarded or has stock
        const hasFabric = Number(f.inward_quantity || 0) > 0 || Number(f.available_quantity || 0) > 0;
        return hasFabric && !isExcluded;
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
  }, [fabricStockData]);

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

    // 3. Fallback if no colors found on order items at all
    if (candidateList.length === 0) {
      candidateList = [
        { color_name: 'Green', pantone_code: '18-5642 TCX', hex_code: '#2d6a4f', garment_qty: 20 },
        { color_name: 'Red', pantone_code: '19-1664 TCX', hex_code: '#b91c1c', garment_qty: 20 },
        { color_name: 'Orange', pantone_code: '16-1364 TCX', hex_code: '#ea580c', garment_qty: 20 },
        { color_name: 'White', pantone_code: '11-0601 TCX', hex_code: '#f8fafc', garment_qty: 20 },
        { color_name: 'Black', pantone_code: '19-4008 TCX', hex_code: '#0f172a', garment_qty: 20 },
      ];
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

      const [stgData, stockRes, dyeListRes, suppRes] = await Promise.all([
        api.getProductionStages().catch(() => []),
        numericId > 0 ? api.getDyeingFabricStock(numericId).catch(() => null) : Promise.resolve(null),
        numericId > 0 ? api.getDyeingOrders(numericId).catch(() => []) : Promise.resolve([]),
        api.getSuppliers().catch(() => []),
      ]);
      setStages((stgData || []) as ProductionStage[]);

      const stock = (stockRes as any)?.data || stockRes;
      setFabricStockData(stock);

      const dyeList = Array.isArray((dyeListRes as any)?.data) 
        ? (dyeListRes as any).data 
        : (Array.isArray(dyeListRes) ? dyeListRes : []);
      setDyeingOrders(dyeList);

      const suppList = Array.isArray((suppRes as any)?.data)
        ? (suppRes as any).data
        : (Array.isArray(suppRes) ? suppRes : []);
      setSuppliers(suppList);

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
    setIsAdditionalLot(false);

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

  // Color Row handlers
  const handleAddColorRow = () => {
    setColorRows([
      ...colorRows,
      { color_name: '', pantone_code: '', hex_code: '#3b82f6', planned_quantity: '', rate_per_unit: '', notes: '' }
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

  // Submit Create Dyeing Order
  const handleCreateDyeingOrder = async (e: React.FormEvent) => {
    e.preventDefault();
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

    if (availableFabricBalance > 0 && totalPlannedInModal > availableFabricBalance && !isAdditionalLot) {
      setCreateError(
        `Total planned quantity (${fmt(totalPlannedInModal, 1)} ${uom}) exceeds available fabric balance (${fmt(availableFabricBalance, 1)} ${uom}). Check "Authorize Additional Lot / Re-dyeing" to continue.`
      );
      return;
    }

    if (availableFabricBalance <= 0 && !isAdditionalLot) {
      setCreateError(
        `Available fabric balance is 0.0 ${uom} (all inwarded fabric has been allocated). Check "Authorize Additional Lot / Re-dyeing" to authorize additional outward fabric.`
      );
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
        fabric_material_id: fabricMaterialId,
        fabric_name: fabricName || selectedFabric?.material_name || 'Fabric Material',
        fabric_code: selectedFabric?.material_code || undefined,
        uom,
        challan_no: challanNo,
        order_date: orderDate,
        expected_delivery_date: expectedDate,
        process_type: processType,
        remarks,
        is_additional_lot: isAdditionalLot,
        allow_overdraft: isAdditionalLot,
        force_create: isAdditionalLot,
        items: colorRows.map(r => ({
          color_name: r.color_name.trim(),
          pantone_code: r.pantone_code.trim(),
          hex_code: r.hex_code,
          planned_quantity: Number(r.planned_quantity),
          rate_per_unit: Number(r.rate_per_unit) || 0,
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
      setSuccessToast(`Dyeing Order created and DC generated successfully!`);
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
            <Button onClick={() => navigate('/production/dyeing')} className="mt-3 text-xs" variant="secondary">
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
    return (
      <div className="flex flex-col h-full bg-slate-50/70 overflow-y-auto">
        {/* Sticky Top Bar */}
        <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
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
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Dyeing Stage</span>
              <span className="sm:hidden">Back</span>
            </button>
            <div className="h-5 w-px bg-slate-200 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-800 leading-tight truncate flex items-center gap-2">
                <Droplets className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Create Dyeing Order & Delivery Challan</span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-500 hidden sm:block">
                Full-page outward order creation to dyeing mill with Pantone color breakdown & live fabric balance • Order #{order.order_number}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="xs"
              className="sm:text-xs"
              onClick={() => {
                setShowCreatePage(false);
                if (searchParams.get('create')) {
                  const next = new URLSearchParams(searchParams);
                  next.delete('create');
                  setSearchParams(next);
                }
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              loading={creating}
              size="sm"
              onClick={handleCreateDyeingOrder}
              icon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs"
            >
              <span>Create Dyeing Order</span>
            </Button>
          </div>
        </div>

        {/* Full Page Body */}
        <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
          {createError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{createError}</div>
            </div>
          )}

          {/* SECTION 1: Fabric Balance & Outward Summary (Live ERP Pipeline) */}
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
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                  Order: <strong className="text-slate-900">{order.order_number}</strong>
                </span>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                  availableFabricBalance > 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {availableFabricBalance > 0 ? '✓ Ready to Outward' : '● All Inward Fabric Allocated'}
                </span>
              </div>
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
                  <span className="text-xs text-slate-500 font-semibold">{uom}</span>
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
                  <span className="text-xs text-slate-500 font-semibold">{uom}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Total outward delivery challans</p>
              </div>

              {/* 3. Available to Send */}
              <div className={`rounded-xl p-3.5 border flex flex-col justify-between ${
                availableFabricBalance > 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50/70 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Available to Send</span>
                  <Boxes className={`w-4 h-4 ${availableFabricBalance > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className={`text-xl sm:text-2xl font-bold font-mono ${availableFabricBalance > 0 ? 'text-amber-800' : 'text-slate-700'}`}>
                    {fmt(availableFabricBalance, 1)}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">{uom}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {availableFabricBalance > 0 ? 'Ready for outward delivery' : 'All inward fabric allocated'}
                </p>
              </div>

              {/* 4. Dyed Fabric Received */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Dyed Fabric Received</span>
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-purple-700">{fmt(totalFabricReceived, 1)}</span>
                  <span className="text-xs text-slate-500 font-semibold">{uom}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Inwarded from dyeing mills</p>
              </div>
            </div>
          </div>

          {/* SECTION 2: Dyeing Mill & Challan Details */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Dyeing Mill & Outward Delivery Challan
                </h2>
              </div>
              <div className="text-xs text-slate-500">
                Buyer: <strong className="text-slate-800">{order.customer_name || 'Direct Buyer'}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField label="Dyeing Processor / Mill" required>
                <select
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-300 py-2.5 px-3 focus:ring-brand-500 focus:border-brand-500 bg-white font-medium"
                  required
                >
                  <option value="">— Select Dyeing Mill / Supplier —</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || 'VEND'}) {s.phone ? `• ${s.phone}` : ''}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Outward Delivery Challan (DC No)" required>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={challanNo}
                    onChange={e => setChallanNo(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-300 py-2.5 px-3 font-mono font-bold text-slate-900 bg-white pr-9"
                    placeholder="e.g. DC-DYE-001"
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

              <FormField label="Process / Finishing Type">
                <input
                  type="text"
                  value={processType}
                  onChange={e => setProcessType(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-300 py-2.5 px-3 font-medium bg-white"
                  placeholder="e.g. Reactive Soft Flow, Bio-Wash, Enzyme"
                />
              </FormField>

              <FormField label="Outward Order Date" required>
                <input
                  type="date"
                  value={orderDate}
                  onChange={e => setOrderDate(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-300 py-2.5 px-3 font-medium bg-white"
                  required
                />
              </FormField>

              <FormField label="Expected Delivery Date">
                <input
                  type="date"
                  value={expectedDate}
                  onChange={e => setExpectedDate(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-300 py-2.5 px-3 font-medium bg-white"
                />
              </FormField>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Target Production Order</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono font-bold text-xs text-brand-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {order.order_number}
                  </span>
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {order.title}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Raw Material Fabric Selection */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Raw Material Fabric Selection
                </h2>
              </div>
              {selectedFabric && (
                <span className="text-xs font-mono font-semibold text-slate-600">
                  Inwarded: {fmt(selectedFabric.inward_quantity, 1)} {selectedFabric.uom} • Outwarded: {fmt(selectedFabric.outward_quantity, 1)} {selectedFabric.uom}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Eligible Fabric Material" required>
                {eligibleFabrics.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>No inwarded fabric record found. Stage 03 inwarding will link automatically.</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {eligibleFabrics.length > 3 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={fabricSearchQuery}
                          onChange={e => setFabricSearchQuery(e.target.value)}
                          placeholder="Search fabric name or code..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </div>
                    )}
                    <select
                      value={fabricMaterialId || ''}
                      onChange={e => {
                        const selId = Number(e.target.value);
                        const chosen = eligibleFabrics.find(f => f.material_id === selId);
                        if (chosen) {
                          setFabricMaterialId(chosen.material_id);
                          setFabricName(chosen.material_name);
                          setUom(chosen.uom);
                          setColorRows(buildOrderColors(order, fabricStockData, chosen.available_quantity));
                        }
                      }}
                      className="w-full text-xs rounded-xl border-slate-300 py-2.5 px-3 focus:ring-brand-500 focus:border-brand-500 bg-white font-medium"
                      required
                    >
                      <option value="">— Select Fabric Material from Inward Stock —</option>
                      {searchedFabrics.map(f => (
                        <option key={f.material_id} value={f.material_id}>
                          {f.material_name} ({f.material_code || `MAT-${f.material_id}`}) • Inwarded: {fmt(f.inward_quantity, 1)} {f.uom} • Avail: {fmt(f.available_quantity, 1)} {f.uom}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </FormField>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Available Fabric Balance for Selection</span>
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {fmt(availableFabricBalance, 1)} {uom}
                  </span>
                </div>
                {availableFabricBalance <= 0 ? (
                  <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2">
                    <span className="text-[11px] text-amber-800 font-medium">
                      Balance is 0.0 {uom}. All inward fabric has been outwarded in previous batches.
                    </span>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-amber-900 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={isAdditionalLot}
                        onChange={e => setIsAdditionalLot(e.target.checked)}
                        className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                      />
                      <span>Authorize Additional Lot / Re-dyeing</span>
                    </label>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Fabric inwarded from Stage 03 is ready to be divided into color batches.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: Color Breakdown & Pantone Matching Table (Styled like PO table) */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-brand-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Color Breakdown & Pantone TCX Specifications
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign outward fabric quantity and target Pantone shades per garment color.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutofillColors}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Reset to Order Colors</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddColorRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Color Line</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-2.5 w-10 text-center text-slate-500">#</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Color Swatch & Name *</th>
                    <th className="py-2.5 px-3 min-w-[170px]">Pantone TCX Code</th>
                    <th className="py-2.5 px-3 min-w-[130px] text-right">Planned Outward Qty *</th>
                    <th className="py-2.5 px-3 min-w-[110px] text-right">Rate / {uom} (₹)</th>
                    <th className="py-2.5 px-3 min-w-[110px] text-right">Subtotal (₹)</th>
                    <th className="py-2.5 px-3 min-w-[170px]">Shade / Lab Dip Notes</th>
                    <th className="py-2.5 px-2 w-10 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {colorRows.map((row, idx) => {
                    const rowQty = Number(row.planned_quantity) || 0;
                    const rowRate = Number(row.rate_per_unit) || 0;
                    const rowSubtotal = rowQty * rowRate;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        {/* S.No */}
                        <td className="py-2 px-2.5 text-center font-mono text-slate-400 font-bold">
                          {idx + 1}
                        </td>

                        {/* Color Swatch & Name */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={row.hex_code || '#3b82f6'}
                              onChange={e => handleColorRowChange(idx, 'hex_code', e.target.value)}
                              className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5 shrink-0"
                              title="Pick Color Swatch"
                            />
                            <input
                              type="text"
                              list="pantone-colors-datalist"
                              value={row.color_name}
                              onChange={e => handleColorRowChange(idx, 'color_name', e.target.value)}
                              placeholder="e.g. Navy Blue"
                              className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2.5 font-bold text-slate-900 bg-white"
                              required
                            />
                          </div>
                        </td>

                        {/* Pantone TCX Code */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            list="pantone-codes-datalist"
                            value={row.pantone_code}
                            onChange={e => handleColorRowChange(idx, 'pantone_code', e.target.value)}
                            placeholder="e.g. 19-4052 TCX"
                            className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2.5 font-mono text-slate-800 bg-white font-medium"
                          />
                        </td>

                        {/* Planned Qty */}
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={row.planned_quantity}
                              onChange={e => handleColorRowChange(idx, 'planned_quantity', e.target.value)}
                              placeholder="0.00"
                              className="w-24 text-xs rounded-lg border-slate-300 py-1.5 px-2 text-right font-mono font-bold text-slate-900 bg-white"
                              required
                            />
                            <span className="text-xs text-slate-500 font-semibold">{uom}</span>
                          </div>
                        </td>

                        {/* Rate / UOM */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.rate_per_unit}
                            onChange={e => handleColorRowChange(idx, 'rate_per_unit', e.target.value)}
                            placeholder="0.00"
                            className="w-24 text-xs rounded-lg border-slate-300 py-1.5 px-2 text-right font-mono text-slate-700 bg-white ml-auto block"
                          />
                        </td>

                        {/* Subtotal */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {rowSubtotal > 0 ? fmt(rowSubtotal, 2) : '—'}
                        </td>

                        {/* Notes */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.notes || ''}
                            onChange={e => handleColorRowChange(idx, 'notes', e.target.value)}
                            placeholder="e.g. Approved Lab Dip #2"
                            className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2.5 text-slate-600 bg-white"
                          />
                        </td>

                        {/* Action */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveColorRow(idx)}
                            disabled={colorRows.length <= 1}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg disabled:opacity-30 transition"
                            title="Remove color row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Table Footer */}
                <tfoot>
                  <tr className="bg-slate-100/90 font-bold border-t border-slate-200">
                    <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[10px] tracking-wider text-slate-600">
                      Total Planned Outward:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm text-brand-700">
                      {fmt(totalPlannedInModal, 1)} {uom}
                    </td>
                    <td className="py-2.5 px-3 text-right uppercase text-[10px] tracking-wider text-slate-600">
                      Est. Dyeing Cost:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm text-slate-900">
                      {fmt(colorRows.reduce((sum, r) => sum + ((Number(r.planned_quantity) || 0) * (Number(r.rate_per_unit) || 0)), 0), 2)}
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-right">
                      {totalPlannedInModal > availableFabricBalance && availableFabricBalance > 0 && !isAdditionalLot && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-md">
                          Exceeds Available Fabric ({fmt(availableFabricBalance, 1)} {uom})
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Datalists for native browser autocomplete */}
            <datalist id="pantone-colors-datalist">
              {VERIFIED_PANTONE_LIBRARY.map((p) => (
                <option key={p.code} value={p.name}>
                  {p.name} ({p.code})
                </option>
              ))}
            </datalist>
            <datalist id="pantone-codes-datalist">
              {VERIFIED_PANTONE_LIBRARY.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} — {p.name}
                </option>
              ))}
            </datalist>
          </div>

          {/* SECTION 5: Remarks / Process Instructions */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <FileText className="w-4 h-4 text-brand-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Mill Instructions & Quality Specifications
              </h2>
            </div>

            <FormField label="Remarks / Processing Notes">
              <textarea
                rows={3}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 py-2.5 px-3 font-medium bg-white"
                placeholder="e.g. Ensure strict Pantone TCX shade matching under D65 light source. Maximum allowable shrinkage: 3% warp, 3% weft. Soft flow finish with bio-polish."
              />
            </FormField>
          </div>

          {/* Bottom Action Footer */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-4 z-20">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>Total Planned Quantity:</span>
              <strong className="font-mono text-brand-700 font-bold text-sm">
                {fmt(totalPlannedInModal, 1)} {uom}
              </strong>
              <span className="text-slate-300 mx-1">|</span>
              <span>Available Balance:</span>
              <strong className="font-mono text-slate-800">
                {fmt(availableFabricBalance, 1)} {uom}
              </strong>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowCreatePage(false);
                  if (searchParams.get('create')) {
                    const next = new URLSearchParams(searchParams);
                    next.delete('create');
                    setSearchParams(next);
                  }
                }}
                disabled={creating}
              >
                Cancel
              </Button>

              <Button
                type="button"
                loading={creating}
                onClick={handleCreateDyeingOrder}
                icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
                className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs px-5 py-2"
              >
                <span>Create Dyeing Order & Delivery Challan</span>
              </Button>
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
              onClick={() => navigate('/production/dyeing')}
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
            <div className="overflow-x-auto">
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
          </div>
        )}

        {/* TAB 2: DYED FABRIC INWARD RECEIPTS TABLE */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
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
                          {rec.photo_url ? (
                            <button
                              type="button"
                              onClick={() => setZoomedPhoto(rec.photo_url)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition shadow-2xs"
                              title="Click to view full photo proof"
                            >
                              <Camera className="w-3.5 h-3.5 text-brand-600" />
                              <span>View Photo</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No Photo</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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

          {/* Photo Proof Capture Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-brand-600" />
                  Dyed Fabric Photo Proof
                </h4>
                <p className="text-[11px] text-slate-500">
                  Take a photo of the received dyed fabric swatches against Pantone swatch for quality verification.
                </p>
              </div>

              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
            </div>

            {/* Hidden native inputs for mobile camera and gallery upload */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handlePhotoFile}
              className="hidden"
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handlePhotoFile}
              className="hidden"
            />

            {!photoUrl ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isProcessingPhoto}
                  className="flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/50 hover:bg-brand-100/50 text-brand-700 text-xs font-bold transition cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-brand-600" />
                  <span>Take Live Photo (Camera)</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingPhoto}
                  className="flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 border-dashed border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>Upload Image File</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4 pt-1">
                <img
                  src={photoUrl}
                  alt="Captured fabric proof"
                  onClick={() => setZoomedPhoto(photoUrl)}
                  className="w-20 h-20 rounded-xl object-cover border border-slate-300 cursor-pointer shadow-xs hover:opacity-95"
                />
                <div>
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Dyed Fabric Photo Attached
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomedPhoto(photoUrl)}
                    className="text-xs text-brand-600 hover:text-brand-800 font-semibold underline mt-1 block"
                  >
                    View full size preview
                  </button>
                </div>
              </div>
            )}
          </div>

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
    </div>
  );
}
