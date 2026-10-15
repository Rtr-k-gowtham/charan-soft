// src/pages/production/DyeingOrderDetail.tsx
// Stage 04: Fabric Dyeing Orders & Inward Receiving with Pantone Colors & Photo Proof
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Image as ImageIcon,
  Upload,
  Eye,
  Trash2,
  X,
  ZoomIn,
  Download,
  ShieldCheck,
  Plus,
  Palette,
  Sparkles,
  ArrowRight,
  Boxes,
  CheckCheck
} from 'lucide-react';

const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
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

interface NewColorRow {
  color_name: string;
  pantone_code: string;
  hex_code: string;
  planned_quantity: number | '';
  rate_per_unit: number | '';
  notes: string;
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
  const [activeTab, setActiveTab] = useState<'orders' | 'history'>('orders');

  // Create Dyeing Order Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [fabricName, setFabricName] = useState<string>('Cotton Fabric');
  const [fabricMaterialId, setFabricMaterialId] = useState<number | undefined>(undefined);
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
  const [colorRows, setColorRows] = useState<NewColorRow[]>([
    { color_name: 'Green', pantone_code: '18-5642 TCX', hex_code: '#2d6a4f', planned_quantity: 20, rate_per_unit: '', notes: '' },
    { color_name: 'Red', pantone_code: '19-1664 TCX', hex_code: '#b91c1c', planned_quantity: 20, rate_per_unit: '', notes: '' },
    { color_name: 'Orange', pantone_code: '16-1364 TCX', hex_code: '#ea580c', planned_quantity: 20, rate_per_unit: '', notes: '' },
    { color_name: 'White', pantone_code: '11-0601 TCX', hex_code: '#f8fafc', planned_quantity: 20, rate_per_unit: '', notes: '' },
    { color_name: 'Black', pantone_code: '19-4008 TCX', hex_code: '#0f172a', planned_quantity: 20, rate_per_unit: '', notes: '' },
  ]);

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

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [orderRes, stgData, stockRes, dyeListRes, suppRes] = await Promise.all([
        api.getProductionOrder(Number(id)),
        api.getProductionStages().catch(() => []),
        api.getDyeingFabricStock(Number(id)).catch(() => null),
        api.getDyeingOrders(Number(id)).catch(() => []),
        api.getSuppliers().catch(() => []),
      ]);

      const ord = (orderRes as any)?.data || orderRes;
      setOrder(ord);
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

      // Pre-select fabric material if found in inward
      if (stock?.fabric_materials && stock.fabric_materials.length > 0) {
        const firstFab = stock.fabric_materials[0];
        setFabricName(firstFab.item_description || 'Cotton Fabric');
        setFabricMaterialId(firstFab.material_id);
        setUom(firstFab.uom || 'MTR');
      }

      // Pre-select dyeing supplier if available
      if (stock?.dyeing_mills && stock.dyeing_mills.length > 0) {
        setSelectedSupplierId(String(stock.dyeing_mills[0].id));
      } else if (suppList.length > 0) {
        setSelectedSupplierId(String(suppList[0].id));
      }

      // Generate a default challan number
      setChallanNo(`DC-DYE-${Math.floor(1000 + Math.random() * 9000)}`);

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
      { color_name: '', pantone_code: '', hex_code: '#6366f1', planned_quantity: '', rate_per_unit: '', notes: '' }
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
      const lookup = lookupPantone(value);
      if (lookup.found) {
        if (lookup.name && !updated[index].color_name) {
          updated[index].color_name = lookup.name;
        }
        if (lookup.hex_code) {
          updated[index].hex_code = lookup.hex_code;
        }
      }
    }

    // Smart auto-detection for Color Name
    if (field === 'color_name' && typeof value === 'string' && !updated[index].pantone_code) {
      const foundMatch = VERIFIED_PANTONE_LIBRARY.find(
        p => p.name.toLowerCase().includes(value.toLowerCase().trim())
      );
      if (foundMatch) {
        updated[index].pantone_code = foundMatch.code;
        updated[index].hex_code = foundMatch.hex;
      }
    }

    setColorRows(updated);
  };

  // Auto-fill from production order colors
  const handleAutofillColors = () => {
    if (!fabricStockData?.suggested_colors || fabricStockData.suggested_colors.length === 0) {
      alert('No specific colors found on this production order items.');
      return;
    }
    const avail = fabricStockData.balance_available_for_dyeing || 100;
    const count = fabricStockData.suggested_colors.length;
    const splitQty = Math.round((avail / count) * 100) / 100;

    const newRows: NewColorRow[] = fabricStockData.suggested_colors.map((c: any) => ({
      color_name: c.color_name || 'Color',
      pantone_code: c.pantone_code || '',
      hex_code: c.hex_code || '#6366f1',
      planned_quantity: splitQty,
      rate_per_unit: '',
      notes: ''
    }));
    setColorRows(newRows);
  };

  // Total planned in modal
  const totalPlannedInModal = colorRows.reduce((sum, r) => sum + (Number(r.planned_quantity) || 0), 0);
  const availableFabricBalance = fabricStockData?.balance_available_for_dyeing ?? 0;

  // Submit Create Dyeing Order
  const handleCreateDyeingOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (colorRows.length === 0) {
      setCreateError('Please specify at least one color item.');
      return;
    }

    const invalidRow = colorRows.find(r => !r.color_name.trim() || Number(r.planned_quantity) <= 0);
    if (invalidRow) {
      setCreateError('Please provide a valid color name and positive quantity for all rows.');
      return;
    }

    setCreating(true);
    try {
      const selectedMill = suppliers.find(s => String(s.id) === String(selectedSupplierId));
      const payload = {
        production_order_id: Number(id),
        fabric_material_id: fabricMaterialId,
        fabric_name: fabricName,
        uom,
        supplier_id: selectedSupplierId ? Number(selectedSupplierId) : null,
        dyeing_mill_name: selectedMill?.name || '',
        challan_no: challanNo,
        order_date: orderDate,
        expected_delivery_date: expectedDate,
        process_type: processType,
        remarks,
        items: colorRows.map(r => ({
          color_name: r.color_name.trim(),
          pantone_code: r.pantone_code.trim(),
          hex_code: r.hex_code || '#6366f1',
          planned_quantity: Number(r.planned_quantity),
          rate_per_unit: Number(r.rate_per_unit || 0),
          notes: r.notes.trim()
        }))
      };

      await api.createDyeingOrder(payload);
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      console.error('Failed to create dyeing order:', err);
      setCreateError(err?.message || 'Failed to create Dyeing Order');
    } finally {
      setCreating(false);
    }
  };

  // Open Receive Modal
  const handleOpenReceive = (dOrder: DyeingOrder) => {
    setSelectedDyeingOrder(dOrder);
    setReceiptChallanNo(`DC-INW-${Math.floor(1000 + Math.random() * 9000)}`);
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setPhotoUrl(null);
    setShadeCondition('Approved - Pantone Matched');
    setReceiptRemarks(`Received dyed fabric for ${dOrder.dyeing_order_no}`);
    setReceiveError('');

    const items = (dOrder.items || []).map(it => {
      const planned = Number(it.planned_quantity || 0);
      const rec = Number(it.received_quantity || 0);
      const remaining = Math.max(0, planned - rec);
      return {
        item_id: it.id || 0,
        color_name: it.color_name,
        pantone_code: it.pantone_code || '',
        hex_code: it.hex_code || '#6366f1',
        planned_quantity: planned,
        already_received: rec,
        received_quantity: remaining,
        shrinkage_loss_percent: 0,
        shade_match_status: 'Approved - Pantone Matched',
        notes: ''
      };
    });
    setReceivingItems(items);
    setShowReceiveModal(true);
  };

  const handleReceiveItemChange = (index: number, field: string, value: any) => {
    const updated = [...receivingItems];
    updated[index] = { ...updated[index], [field]: value };

    // Auto calculate shrinkage loss % if received_quantity changes
    if (field === 'received_quantity') {
      const sent = updated[index].planned_quantity;
      const rec = Number(value) || 0;
      if (sent > 0 && rec >= 0) {
        const diff = sent - rec;
        const shrinkage = diff > 0 ? Number(((diff / sent) * 100).toFixed(2)) : 0;
        updated[index].shrinkage_loss_percent = shrinkage;
      }
    }

    setReceivingItems(updated);
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
      const payload = {
        receipt_date: receiptDate,
        delivery_challan_no: receiptChallanNo,
        received_by: receivedBy,
        photo_url: photoUrl,
        shade_condition: shadeCondition,
        remarks: receiptRemarks,
        advance_to_cutting: advanceToCutting,
        items: receivingItems.map(it => ({
          item_id: it.item_id,
          received_quantity: Number(it.received_quantity || 0),
          shrinkage_loss_percent: Number(it.shrinkage_loss_percent || 0),
          shade_match_status: it.shade_match_status,
          notes: it.notes
        }))
      };

      await api.receiveDyeingOrder(selectedDyeingOrder.id, payload);
      setShowReceiveModal(false);
      setSelectedDyeingOrder(null);
      await loadData();
    } catch (err: any) {
      console.error('Failed to receive dyed fabric:', err);
      setReceiveError(err?.message || 'Failed to record dyeing receipt');
    } finally {
      setSavingReceive(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-10 h-10 text-purple-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Loading Stage 04: Dyeing Workspace...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-red-800">Error Loading Dyeing Workspace</h2>
          <p className="text-sm text-red-600 mt-1">{error || 'Order not found'}</p>
          <Button onClick={() => navigate('/production/dyeing')} className="mt-4" variant="secondary">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dyeing Stage
          </Button>
        </div>
      </div>
    );
  }

  const totalFabricInwarded = Number(fabricStockData?.total_fabric_inwarded || 0);
  const totalFabricOutward = Number(fabricStockData?.total_fabric_outward || 0);
  const totalFabricReceived = Number(fabricStockData?.total_fabric_received_from_dyeing || 0);
  const balanceToOutward = Number(fabricStockData?.balance_available_for_dyeing || 0);

  // All receipts across dyeing orders
  const allDyeingReceipts: any[] = [];
  dyeingOrders.forEach(d => {
    (d.receipts || []).forEach(r => {
      allDyeingReceipts.push({
        ...r,
        dyeing_order_no: d.dyeing_order_no,
        dyeing_mill_name: d.dyeing_mill_name,
        fabric_name: d.fabric_name,
        uom: d.uom
      });
    });
  });

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Top Banner Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/production/dyeing')}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
              title="Back to Stage 04: Dyeing Stage View"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-700 tracking-wide uppercase">
                  Stage 04 • Dyeing
                </span>
                <span className="text-xs text-slate-400">|</span>
                <span className="font-mono text-xs font-semibold text-slate-700">{order.order_number}</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Fabric Dyeing & Pantone Color Orders
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              title="Refresh Dyeing Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Button
              onClick={() => {
                setChallanNo(`DC-DYE-${Math.floor(1000 + Math.random() * 9000)}`);
                setCreateError('');
                setShowCreateModal(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Create Dyeing Order</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* 1. Order Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <BuyerAvatar
                buyer={{
                  id: order.customer_id,
                  code: order.customer_code,
                  name: order.customer_name,
                  avatar_style: order.customer_avatar_style,
                  avatar_seed: order.customer_avatar_seed,
                }}
                size="lg"
              />
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg font-bold text-slate-900">{order.title}</h2>
                  <StatusBadge status={order.status} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Buyer: <span className="font-semibold text-slate-700">{order.customer_name || 'Direct Order'}</span>
                  {order.customer_code && <span className="text-slate-400 ml-1">({order.customer_code})</span>}
                  <span className="mx-2">•</span>
                  Delivery Target: <span className="font-semibold text-slate-700">{order.target_delivery_date}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/production/inward/${order.id}`)}
                className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <Package className="w-3.5 h-3.5 mr-1.5" />
                <span>View Stage 03 Inward</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/production/cutting`)}
                className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                <span>Next: Stage 05 Cutting</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Core Fabric Balance & Outward Tracker Card */}
        <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 -mt-6 -mr-6 w-56 h-56 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-purple-300 text-xs font-bold uppercase tracking-wider">
                <Droplets className="w-4 h-4 text-purple-400" />
                <span>Stage 04 Fabric Processing Pipeline</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Fabric Outward & Pantone Dyeing Balance
              </h3>
              <p className="text-xs sm:text-sm text-purple-200/80 max-w-xl">
                Only inwarded fabric is routed to dyeing. Track exact quantities sent outward to mills with Pantone shade codes, and receive dyed yardage back.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setChallanNo(`DC-DYE-${Math.floor(1000 + Math.random() * 9000)}`);
                  setCreateError('');
                  setShowCreateModal(true);
                }}
                className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-purple-500 hover:bg-purple-400 text-white shadow-lg shadow-purple-600/30 transition flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Issue Dyeing Order</span>
              </button>
            </div>
          </div>

          {/* 4 Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-purple-800/60">
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-purple-200">Inward Fabric</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-white">{fmt(totalFabricInwarded, 1)}</span>
                <span className="text-xs text-purple-200 font-medium">MTR</span>
              </div>
              <p className="text-[10px] text-purple-300/80 mt-1">Received from Fabric POs</p>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-purple-200">Sent to Dyeing (Out)</span>
                <Truck className="w-3.5 h-3.5 text-purple-300" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-purple-300">{fmt(totalFabricOutward, 1)}</span>
                <span className="text-xs text-purple-200 font-medium">MTR</span>
              </div>
              <p className="text-[10px] text-purple-300/80 mt-1">Outward Delivery Challans</p>
            </div>

            <div className={`backdrop-blur-xs rounded-xl p-3.5 border ${
              balanceToOutward > 0 
                ? 'bg-amber-500/20 border-amber-400/40' 
                : 'bg-emerald-500/20 border-emerald-400/40'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white">Available to Send</span>
                <Boxes className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-white">{fmt(balanceToOutward, 1)}</span>
                <span className="text-xs text-white/80 font-medium">MTR</span>
              </div>
              <p className="text-[10px] text-white/80 mt-1">
                {balanceToOutward > 0 ? 'Ready for new dyeing order' : 'All inward fabric allocated'}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-purple-200">Dyed Fabric Received</span>
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-emerald-300">{fmt(totalFabricReceived, 1)}</span>
                <span className="text-xs text-purple-200 font-medium">MTR</span>
              </div>
              <p className="text-[10px] text-purple-300/80 mt-1">Inwarded from Dyeing Mills</p>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Droplets className="w-4 h-4" />
            <span>Dyeing Orders ({dyeingOrders.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Dyed Fabric Inward Receipts ({allDyeingReceipts.length})</span>
          </button>
        </div>

        {/* Tab Content: Dyeing Orders */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {dyeingOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
                <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4">
                  <Droplets className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No Dyeing Orders Issued Yet</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
                  You have <span className="font-bold text-slate-700">{fmt(totalFabricInwarded, 1)} MTR</span> of fabric inwarded from Stage 03. Create your first dyeing order to split quantities by color and Pantone codes (e.g. Green 20, Red 20, Orange 20, White 20, Black 20).
                </p>
                <Button
                  onClick={() => {
                    setChallanNo(`DC-DYE-${Math.floor(1000 + Math.random() * 9000)}`);
                    setCreateError('');
                    setShowCreateModal(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  <span>Create First Dyeing Order</span>
                </Button>
              </div>
            ) : (
              dyeingOrders.map((dOrder) => {
                const totalPlanned = Number(dOrder.total_fabric_quantity || 0);
                const totalRec = Number(dOrder.total_received_quantity || 0);
                const pct = totalPlanned > 0 ? Math.min(100, Math.round((totalRec / totalPlanned) * 100)) : 0;
                const isFullyReceived = dOrder.status === 'Received' || (totalRec >= totalPlanned && totalPlanned > 0);

                return (
                  <div
                    key={dOrder.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-black text-purple-900 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                            {dOrder.dyeing_order_no}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isFullyReceived 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : dOrder.status === 'Partially Received'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {dOrder.status}
                          </span>
                          {dOrder.process_type && (
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {dOrder.process_type}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
                          <span>Dyeing Mill: <strong className="text-slate-800">{dOrder.dyeing_mill_name || dOrder.supplier_name || 'Processing Mill'}</strong></span>
                          <span>•</span>
                          <span>DC No: <strong className="font-mono text-slate-800">{dOrder.challan_no || 'N/A'}</strong></span>
                          <span>•</span>
                          <span>Date: <strong className="text-slate-800">{dOrder.order_date}</strong></span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {!isFullyReceived && (
                          <Button
                            onClick={() => handleOpenReceive(dOrder)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs"
                          >
                            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                            <span>Receive Dyed Fabric</span>
                          </Button>
                        )}
                        {isFullyReceived && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Dyeing Completed</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-600 font-medium mb-1">
                        <span>Dyed Fabric Received Progress</span>
                        <span>{fmt(totalRec, 1)} / {fmt(totalPlanned, 1)} {dOrder.uom} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isFullyReceived ? 'bg-emerald-500' : 'bg-purple-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Color Items Breakdown Table with Pantone Codes */}
                    <div className="mt-5 overflow-x-auto">
                      <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Color & Pantone Standard</th>
                            <th className="py-2.5 px-3">Planned (Outward)</th>
                            <th className="py-2.5 px-3">Received (Inward)</th>
                            <th className="py-2.5 px-3">Shrinkage %</th>
                            <th className="py-2.5 px-3">Shade Match Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(dOrder.items || []).map((it, idx) => (
                            <tr key={it.id || idx} className="hover:bg-slate-50/60">
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs shrink-0"
                                    style={{ backgroundColor: it.hex_code || '#6366f1' }}
                                  />
                                  <div>
                                    <span className="font-bold text-slate-900">{it.color_name}</span>
                                    {it.pantone_code && (
                                      <span className="ml-2 font-mono text-[11px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                        {it.pantone_code}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {fmt(it.planned_quantity, 1)} {dOrder.uom}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`font-bold ${
                                  Number(it.received_quantity || 0) >= Number(it.planned_quantity || 0)
                                    ? 'text-emerald-700'
                                    : 'text-slate-700'
                                }`}>
                                  {fmt(Number(it.received_quantity || 0), 1)} {dOrder.uom}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {it.shrinkage_loss_percent ? `${fmt(it.shrinkage_loss_percent, 1)}%` : '0%'}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                  it.shade_match_status?.includes('Approved') || it.shade_match_status?.includes('Matched')
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : it.shade_match_status === 'Pending'
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {it.shade_match_status || 'Pending Verification'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab Content: Inward Receipts History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {allDyeingReceipts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
                <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700">No Dyeing Inward Receipts Recorded Yet</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Once dyed fabric arrives from processing mills, click "Receive Dyed Fabric" to record incoming quantities and photo proof.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allDyeingReceipts.map((rec, idx) => (
                  <div key={rec.id || idx} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {rec.receipt_no}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {rec.receipt_date}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {fmt(rec.total_received_quantity, 1)} {rec.uom || 'MTR'} Dyed Fabric Received
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Order: <strong>{rec.dyeing_order_no}</strong> • Mill: <strong>{rec.dyeing_mill_name || 'Mill'}</strong>
                      </p>
                      {rec.delivery_challan_no && (
                        <p className="text-xs text-slate-500">
                          Inward DC: <strong className="font-mono">{rec.delivery_challan_no}</strong>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        {rec.shade_condition || 'Approved - Pantone Matched'}
                      </span>
                      {rec.received_by && (
                        <span className="text-[11px] text-slate-500">
                          By: {rec.received_by}
                        </span>
                      )}
                    </div>

                    {/* Photo Proof */}
                    {rec.photo_url && (
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-3">
                          <img
                            src={rec.photo_url}
                            alt="Dyed fabric proof"
                            onClick={() => setZoomedPhoto(rec.photo_url)}
                            className="w-16 h-16 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-90 shadow-2xs"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                              Dyed Fabric Proof Photo
                            </span>
                            <button
                              type="button"
                              onClick={() => setZoomedPhoto(rec.photo_url)}
                              className="text-[11px] text-purple-600 hover:text-purple-800 font-semibold underline mt-0.5 block"
                            >
                              Click to zoom photo
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL 1: Create Dyeing Order (Outward to Dyeing) */}
      <Modal
        open={showCreateModal}
        onClose={() => !creating && setShowCreateModal(false)}
        title="Create Dyeing Order (Outward to Dyeing)"
        size="xl"
      >
        <form onSubmit={handleCreateDyeingOrder} className="space-y-5">
          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          {/* Fabric Balance Alert */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 text-xs text-purple-900 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="font-bold text-purple-950">Inward Fabric Received:</span> {fmt(totalFabricInwarded, 1)} {uom}
              <span className="mx-2">•</span>
              <span className="font-bold text-purple-950">Available for Dyeing:</span> {fmt(availableFabricBalance, 1)} {uom}
            </div>
            <div className="font-semibold text-purple-700">
              Total Order: {order.order_number}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Dyeing Processor / Mill" required>
              <select
                value={selectedSupplierId}
                onChange={e => setSelectedSupplierId(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 py-2 px-3 focus:ring-purple-500 focus:border-purple-500"
                required
              >
                <option value="">Select Dyeing Mill / Supplier</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || 'VEND'})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Fabric Material" required>
              <input
                type="text"
                value={fabricName}
                onChange={e => setFabricName(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 py-2 px-3"
                placeholder="e.g. 100% Combed Cotton 30s Fabric"
                required
              />
            </FormField>

            <FormField label="Outward Delivery Challan (DC No)" required>
              <input
                type="text"
                value={challanNo}
                onChange={e => setChallanNo(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 py-2 px-3 font-mono"
                placeholder="e.g. DC-DYE-001"
                required
              />
            </FormField>

            <FormField label="Process Type">
              <input
                type="text"
                value={processType}
                onChange={e => setProcessType(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 py-2 px-3"
                placeholder="e.g. Soft Flow Dyeing, Bio-Wash, Reactive"
              />
            </FormField>

            <FormField label="Outward Order Date" required>
              <input
                type="date"
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 py-2 px-3"
                required
              />
            </FormField>

            <FormField label="Expected Delivery Date">
              <input
                type="date"
                value={expectedDate}
                onChange={e => setExpectedDate(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 py-2 px-3"
              />
            </FormField>
          </div>

          {/* Color Breakdown Section */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-purple-600" />
                  Color Breakdown & Pantone Codes
                </h4>
                <p className="text-[11px] text-slate-500">
                  Specify outward quantities per color (e.g., Green 20, Red 20, Orange 20, White 20, Black 20).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutofillColors}
                  className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition"
                >
                  <Sparkles className="w-3 h-3 inline mr-1" />
                  Auto-fill Order Colors
                </button>
                <button
                  type="button"
                  onClick={handleAddColorRow}
                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                >
                  <Plus className="w-3 h-3 inline mr-1" />
                  Add Color
                </button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {colorRows.map((row, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
                  {/* Color Swatch */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="color"
                      value={row.hex_code || '#6366f1'}
                      onChange={e => handleColorRowChange(idx, 'hex_code', e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5 shrink-0"
                      title="Pick Color Swatch"
                    />
                    <input
                      type="text"
                      value={row.color_name}
                      onChange={e => handleColorRowChange(idx, 'color_name', e.target.value)}
                      placeholder="Color (e.g. Green)"
                      className="text-xs rounded-lg border-slate-300 py-1.5 px-2.5 font-bold text-slate-900 w-full sm:w-32"
                      required
                    />
                  </div>

                  {/* Pantone Code */}
                  <div className="w-full sm:w-44">
                    <input
                      type="text"
                      value={row.pantone_code}
                      onChange={e => handleColorRowChange(idx, 'pantone_code', e.target.value)}
                      placeholder="Pantone (e.g. 18-5642 TCX)"
                      className="text-xs rounded-lg border-slate-300 py-1.5 px-2.5 font-mono text-purple-900 w-full"
                    />
                  </div>

                  {/* Planned Qty */}
                  <div className="flex items-center gap-1.5 w-full sm:w-32">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={row.planned_quantity}
                      onChange={e => handleColorRowChange(idx, 'planned_quantity', e.target.value)}
                      placeholder="Qty"
                      className="text-xs rounded-lg border-slate-300 py-1.5 px-2.5 font-bold text-slate-900 w-full"
                      required
                    />
                    <span className="text-xs text-slate-500 font-semibold">{uom}</span>
                  </div>

                  {/* Rate (Optional) */}
                  <div className="w-full sm:w-28">
                    <input
                      type="number"
                      step="0.01"
                      value={row.rate_per_unit}
                      onChange={e => handleColorRowChange(idx, 'rate_per_unit', e.target.value)}
                      placeholder="₹/MTR"
                      className="text-xs rounded-lg border-slate-300 py-1.5 px-2.5 text-slate-700 w-full"
                    />
                  </div>

                  {/* Delete Row */}
                  <button
                    type="button"
                    onClick={() => handleRemoveColorRow(idx)}
                    disabled={colorRows.length <= 1}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg disabled:opacity-30 transition self-end sm:self-auto"
                    title="Remove color"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Total planned summary */}
            <div className="mt-3 p-3 rounded-xl bg-slate-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Total Outward Fabric:</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-purple-900">
                  {fmt(totalPlannedInModal, 1)} {uom}
                </span>
                {totalPlannedInModal > availableFabricBalance && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    Exceeds inward fabric ({fmt(availableFabricBalance, 1)} {uom})
                  </span>
                )}
              </div>
            </div>
          </div>

          <FormField label="Remarks / Process Instructions">
            <textarea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="w-full text-xs rounded-xl border-slate-300 py-2 px-3"
              placeholder="e.g. Standard soft-flow reactive dyeing, lab dip approval confirmed"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={creating || colorRows.length === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {creating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  <span>Issuing Dyeing Order...</span>
                </>
              ) : (
                <span>Confirm & Issue Dyeing Order</span>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Receive Dyed Fabric (Inward from Dyeing with Photo Proof & Pantone verification) */}
      <Modal
        open={showReceiveModal}
        onClose={() => !savingReceive && setShowReceiveModal(false)}
        title={`Receive Dyed Fabric — ${selectedDyeingOrder?.dyeing_order_no || ''}`}
        size="xl"
      >
        <form onSubmit={handleSubmitReceive} className="space-y-5">
          {receiveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{receiveError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Inward Mill DC No" required>
              <input
                type="text"
                value={receiptChallanNo}
                onChange={e => setReceiptChallanNo(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 py-2 px-3 font-mono"
                placeholder="e.g. DC-INW-8871"
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

            <FormField label="Received By">
              <input
                type="text"
                value={receivedBy}
                onChange={e => setReceivedBy(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 py-2 px-3"
                placeholder="e.g. Stores & QC Inward"
              />
            </FormField>
          </div>

          {/* Color Items Received Quantity Inputs */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-purple-600" />
              Dyed Yardage Verification per Color
            </h4>

            <div className="space-y-3">
              {receivingItems.map((it, idx) => (
                <div key={it.item_id || idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                        style={{ backgroundColor: it.hex_code }}
                      />
                      <span className="font-bold text-slate-900 text-xs">{it.color_name}</span>
                      {it.pantone_code && (
                        <span className="font-mono text-[11px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                          {it.pantone_code}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500">
                      Sent: <strong className="text-slate-800">{fmt(it.planned_quantity, 1)} {selectedDyeingOrder?.uom}</strong>
                      {it.already_received > 0 && (
                        <span className="text-emerald-600 ml-2">
                          (Already Recv: {fmt(it.already_received, 1)})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/60">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Received Qty ({selectedDyeingOrder?.uom})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.received_quantity}
                        onChange={e => handleReceiveItemChange(idx, 'received_quantity', e.target.value)}
                        className="w-full text-xs font-bold rounded-lg border-slate-300 py-1.5 px-2.5"
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
                        className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2.5"
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
                        className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-2.5 font-semibold text-slate-800"
                      >
                        <option value="Approved - Pantone Matched">Approved - Pantone Matched</option>
                        <option value="Approved with Minor Variation">Approved with Minor Variation</option>
                        <option value="Shade Variation (Pending Approval)">Shade Variation</option>
                        <option value="Rejected - Off Shade">Rejected - Off Shade</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Photo Proof Capture Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-purple-600" />
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
                  className="flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-100/50 text-purple-700 text-xs font-bold transition cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-purple-600" />
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
                    className="text-xs text-purple-600 hover:text-purple-800 font-semibold underline mt-1 block"
                  >
                    View full size preview
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Advance to Cutting Checkbox */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-purple-50/80 border border-purple-200">
            <input
              type="checkbox"
              id="advanceCutting"
              checked={advanceToCutting}
              onChange={e => setAdvanceToCutting(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
            />
            <label htmlFor="advanceCutting" className="text-xs font-bold text-purple-900 cursor-pointer">
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {savingReceive ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  <span>Recording Inward Receipt...</span>
                </>
              ) : (
                <span>Confirm & Inward Dyed Fabric</span>
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
