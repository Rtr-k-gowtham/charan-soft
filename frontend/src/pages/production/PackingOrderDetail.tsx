// src/pages/production/PackingOrderDetail.tsx
// Stage 09: Packing & Carton Management — Automated Box Calculation (Sections C & D specs), Carton Serial Generation & Traceability
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, PackingBatch, PackingCarton } from '../../types';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { LivePhotoCaptureField } from '../../components/production/LivePhotoCaptureField';
import {
  ArrowLeft,
  Package,
  RefreshCw,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Camera,
  Trash2,
  Eye,
  CheckCheck,
  Box,
  Boxes,
  ExternalLink,
  QrCode,
  ShieldCheck,
  Check,
  Clock,
  User,
  Scale,
  FileText,
  Sparkles,
  Layers
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n || 0);

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

export default function PackingOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [batches, setBatches] = useState<PackingBatch[]>([]);
  const [cartons, setCartons] = useState<PackingCarton[]>([]);
  const [productConfigs, setProductConfigs] = useState<{ [productId: number]: any }>({});
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tab filter: 'ALL' or 'PACKING'
  const [activeTab, setActiveTab] = useState<'ALL' | 'PACKING'>('ALL');

  // New Packing Batch Modal State
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedProductSpec, setSelectedProductSpec] = useState<any | null>(null);

  const [batchForm, setBatchForm] = useState({
    packing_date: new Date().toISOString().split('T')[0],
    approved_quantity: 0,
    packed_quantity: 0,
    units_per_box: 20,
    number_of_boxes: 0,
    boxes_per_master_carton: 5,
    number_of_master_cartons: 0,
    partial_box_quantity: 0,
    partial_carton_quantity: 0,
    gross_weight: 0,
    net_weight: 0,
    packing_operator: '',
    packing_supervisor: '',
    remarks: ''
  });
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchError, setBatchError] = useState('');

  // Carton Details Modal
  const [selectedCarton, setSelectedCarton] = useState<PackingCarton | null>(null);

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Stage Transfer Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const fetchOrderData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const [orderRes, stagesRes, packRes, cartonsRes] = await Promise.all([
        api.getProductionOrder(Number(id)),
        api.getProductionStages(),
        api.getPackingOrderDetails(Number(id)),
        api.getPackingCartons(Number(id))
      ]);

      const ord = (orderRes as any)?.data || orderRes;
      setOrder(ord);

      const st = (stagesRes as any)?.data || stagesRes;
      setStages(Array.isArray(st) ? st : []);

      const packData = (packRes as any)?.data || packRes;
      setBatches(Array.isArray(packData?.batches) ? packData.batches : []);

      const finalItems = (Array.isArray(packData?.items) && packData.items.length > 0)
        ? packData.items
        : (ord.items || []);
      setItems(finalItems);

      const cData = (cartonsRes as any)?.data || cartonsRes;
      setCartons(Array.isArray(cData) ? cData : (Array.isArray(packData?.cartons) ? packData.cartons : []));

      // Fetch packaging specs for each item from Buyer Master (Sections C & D)
      if (ord.customer_id && finalItems.length > 0) {
        const configs: { [key: number]: any } = {};
        for (const it of finalItems) {
          if (it.product_id) {
            try {
              const pRes = await api.getBuyerProduct(ord.customer_id, it.product_id);
              const pData = (pRes as any)?.data || pRes;
              if (pData) configs[it.product_id] = pData;
            } catch (pErr) {
              console.warn(`Could not fetch buyer product ${it.product_id}`, pErr);
            }
          }
        }
        setProductConfigs(configs);
      }
    } catch (err: any) {
      console.error('Failed to load packing stage data:', err);
      setError(err?.message || 'Failed to load packing stage data.');
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

  // Group batches by item
  const batchesByItem = useMemo(() => {
    const map: Record<number, PackingBatch[]> = {};
    batches.forEach(b => {
      const bItemId = b.production_order_item_id;
      if (!map[bItemId]) {
        map[bItemId] = [];
      }
      map[bItemId].push(b);
    });
    return map;
  }, [batches]);

  // Aggregate product-wise totals
  const summaryByItem = useMemo(() => {
    const map: Record<number, {
      totalPacked: number;
      totalBoxes: number;
      totalCartons: number;
      unpacked: number;
      availableToPack: number;
      arrivedFromChecking: number;
      orderQty: number;
    }> = {};

    items.forEach(it => {
      const activeId = it.active_packing_item_id || it.id;
      const itBatches = (batchesByItem[activeId] || []).concat(
        activeId !== it.id ? (batchesByItem[it.id] || []) : []
      );
      const totalPacked = itBatches.reduce((sum, b) => sum + Number(b.packed_quantity || 0), 0);
      const totalBoxes = itBatches.reduce((sum, b) => sum + Number(b.number_of_boxes || 0), 0);
      const totalCartons = itBatches.reduce((sum, b) => sum + Number(b.number_of_master_cartons || 0), 0);

      const arrivedFromChecking = Number(it.arrived_from_checking ?? it.stage_9_qty ?? it.current_stage_quantity ?? 0);
      const availableToPack = Math.max(0, arrivedFromChecking - totalPacked);
      const orderQty = Number(it.order_quantity || it.quantity || it.total_quantity || 0);
      const unpacked = Math.max(0, orderQty - totalPacked);

      const stats = {
        totalPacked,
        totalBoxes,
        totalCartons,
        unpacked,
        availableToPack,
        arrivedFromChecking,
        orderQty
      };
      map[it.id] = stats;
      if (activeId !== it.id) {
        map[activeId] = stats;
      }
    });

    return map;
  }, [items, batchesByItem]);

  // Overall totals across all products
  const overallTotals = useMemo(() => {
    let orderQty = 0;
    let arrivedQty = 0;
    let packedQty = 0;
    let totalBoxes = 0;
    let totalCartons = 0;
    let unpackedQty = 0;
    let availableToPackQty = 0;

    items.forEach(it => {
      const s = summaryByItem[it.id];
      const itOrderQty = Number(it.order_quantity || it.quantity || it.total_quantity || 0);
      orderQty += itOrderQty;
      if (s) {
        arrivedQty += s.arrivedFromChecking;
        packedQty += s.totalPacked;
        totalBoxes += s.totalBoxes;
        totalCartons += s.totalCartons;
        unpackedQty += s.unpacked;
        availableToPackQty += s.availableToPack;
      }
    });

    const completionRate = arrivedQty > 0 ? Math.round((packedQty / arrivedQty) * 100) : 0;
    return { orderQty, arrivedQty, packedQty, totalBoxes, totalCartons, unpackedQty, availableToPackQty, completionRate };
  }, [items, summaryByItem]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (activeTab === 'PACKING') {
      return items.filter(it => {
        const s = summaryByItem[it.id];
        return (s?.arrivedFromChecking || 0) > 0;
      });
    }
    return items;
  }, [items, activeTab, summaryByItem]);

  // Helper function to recalculate box packaging based on Section C & D specs
  const recalculatePackaging = (
    packedQty: number,
    unitsPerBox: number,
    boxesPerCarton: number
  ) => {
    const uPerBox = Math.max(1, unitsPerBox);
    const bPerCarton = Math.max(1, boxesPerCarton);

    const fullBoxes = Math.floor(packedQty / uPerBox);
    const partialBoxQty = packedQty % uPerBox;
    const totalBoxes = fullBoxes + (partialBoxQty > 0 ? 1 : 0);

    const fullCartons = Math.floor(totalBoxes / bPerCarton);
    const partialCartonBoxes = totalBoxes % bPerCarton;
    const totalCartons = fullCartons + (partialCartonBoxes > 0 ? 1 : 0);

    return {
      number_of_boxes: totalBoxes,
      number_of_master_cartons: totalCartons,
      partial_box_quantity: partialBoxQty,
      partial_carton_quantity: partialCartonBoxes > 0 ? partialCartonBoxes : (totalBoxes > 0 && totalBoxes < bPerCarton ? totalBoxes : 0)
    };
  };

  // Open Packing Batch Modal
  const handleOpenBatchModal = (item: any) => {
    setSelectedItem(item);
    const existing = summaryByItem[item.id] || { totalPacked: 0, availableToPack: 0 };
    const remainingQty = existing.availableToPack;

    if (remainingQty <= 0) {
      showToast('No pieces currently available from Checking to pack for this product.');
      return;
    }

    // Retrieve Section D packing specs from buyer product
    const pSpec = productConfigs[item.product_id] || null;
    setSelectedProductSpec(pSpec);

    let unitsPerBox = 20;
    let boxesPerCarton = 5;

    if (pSpec && pSpec.boxes && pSpec.boxes.length > 0) {
      const primaryBox = pSpec.boxes[0];
      if (primaryBox.items_per_box) unitsPerBox = Number(primaryBox.items_per_box);
      if (primaryBox.boxes_per_master_carton) boxesPerCarton = Number(primaryBox.boxes_per_master_carton);
    }

    const calc = recalculatePackaging(remainingQty, unitsPerBox, boxesPerCarton);

    setBatchForm({
      packing_date: new Date().toISOString().split('T')[0],
      approved_quantity: remainingQty,
      packed_quantity: remainingQty,
      units_per_box: unitsPerBox,
      number_of_boxes: calc.number_of_boxes,
      boxes_per_master_carton: boxesPerCarton,
      number_of_master_cartons: calc.number_of_master_cartons,
      partial_box_quantity: calc.partial_box_quantity,
      partial_carton_quantity: calc.partial_carton_quantity,
      gross_weight: 0,
      net_weight: 0,
      packing_operator: '',
      packing_supervisor: '',
      remarks: ''
    });

    setPhotoUrls([]);
    setBatchError('');
    setBatchModalOpen(true);
  };

  const handlePackedQtyChange = (val: number) => {
    const u = batchForm.units_per_box || 1;
    const b = batchForm.boxes_per_master_carton || 1;
    const calc = recalculatePackaging(val, u, b);
    setBatchForm(prev => ({
      ...prev,
      packed_quantity: val,
      ...calc
    }));
  };

  const handleUnitsPerBoxChange = (val: number) => {
    const u = val;
    const b = batchForm.boxes_per_master_carton || 1;
    const calc = recalculatePackaging(batchForm.packed_quantity, u || 1, b);
    setBatchForm(prev => ({
      ...prev,
      units_per_box: u,
      ...calc
    }));
  };

  const handleBoxesPerCartonChange = (val: number) => {
    const b = val;
    const u = batchForm.units_per_box || 1;
    const calc = recalculatePackaging(batchForm.packed_quantity, u, b || 1);
    setBatchForm(prev => ({
      ...prev,
      boxes_per_master_carton: b,
      ...calc
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const base64 = await processImageFile(files[i]);
        newUrls.push(base64);
      }
      setPhotoUrls(prev => [...prev, ...newUrls]);
    } catch (err) {
      console.error('Error processing packing photo:', err);
      setBatchError('Failed to process image file.');
    }
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !selectedItem) return;

    const packed = Number(batchForm.packed_quantity || 0);
    const existing = summaryByItem[selectedItem.id] || { totalPacked: 0, availableToPack: 0 };
    const maxAllowed = existing.availableToPack;

    if (packed <= 0) {
      setBatchError('Packed quantity must be greater than zero.');
      return;
    }
    if (packed > maxAllowed) {
      setBatchError(`Packed quantity (${packed}) cannot exceed available quantity from Checking (${maxAllowed}).`);
      return;
    }

    if (!photoUrls || photoUrls.length === 0) {
      setBatchError('Real-time camera photograph with live GPS coordinates of packed boxes & master cartons is mandatory.');
      return;
    }

    try {
      setSavingBatch(true);
      setBatchError('');

      await api.createPackingBatch({
        production_order_id: order.id,
        production_order_item_id: selectedItem.active_packing_item_id || selectedItem.id,
        packing_date: batchForm.packing_date,
        approved_quantity: batchForm.approved_quantity,
        packed_quantity: packed,
        remaining_unpacked_quantity: Math.max(0, maxAllowed - packed),
        units_per_box: batchForm.units_per_box,
        number_of_boxes: batchForm.number_of_boxes,
        boxes_per_master_carton: batchForm.boxes_per_master_carton,
        number_of_master_cartons: batchForm.number_of_master_cartons,
        partial_box_quantity: batchForm.partial_box_quantity,
        partial_carton_quantity: batchForm.partial_carton_quantity,
        gross_weight: batchForm.gross_weight,
        net_weight: batchForm.net_weight,
        packing_operator: batchForm.packing_operator,
        packing_supervisor: batchForm.packing_supervisor,
        remarks: batchForm.remarks,
        photo_urls: photoUrls
      });

      showToast(`Packing batch and ${batchForm.number_of_master_cartons} carton records generated successfully.`);
      setBatchModalOpen(false);
      await fetchOrderData();
    } catch (err: any) {
      console.error('Failed to create packing batch:', err);
      setBatchError(err?.message || 'Failed to save packing batch.');
    } finally {
      setSavingBatch(false);
    }
  };

  // Transfer to Completed / Dispatch
  const handleTransferToDispatch = async () => {
    if (!order) return;
    try {
      setTransferring(true);
      await api.transferPackingOutput({
        production_order_id: order.id,
        item_id: items[0]?.active_packing_item_id || items[0]?.id,
        transfer_quantity: overallTotals.packedQty,
        remarks: `Transferred from Stage 09 Packing to Stage 10 Completed / Dispatch with ${fmt(overallTotals.packedQty)} packed pieces across ${overallTotals.totalCartons} master cartons.`
      });

      const compStage = stages.find(s => (s.code || '').toUpperCase() === 'COMP');
      if (compStage && compStage.id) {
        await api.updateProductionOrderStatus(order.id, compStage.id, {
          notes: `Transferred from Stage 09 Packing to Stage 10 Completed / Dispatch with ${fmt(overallTotals.packedQty)} packed pieces across ${overallTotals.totalCartons} master cartons.`
        }).catch(() => {});
      }
      showToast('Successfully transferred order to Stage 10: Completed / Dispatch.');
      setTransferModalOpen(false);
      navigate(`/production/completed/${order.id}`);
    } catch (err: any) {
      console.error('Failed to transfer to Dispatch stage:', err);
      setError(err?.message || 'Failed to transfer to Dispatch.');
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading Stage 09 Packing & Carton workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm font-medium">{error || 'Order not found.'}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/production/packing')}>
            Back to Packing Stage
          </Button>
        </div>
      </div>
    );
  }

  const isFullyPacked = overallTotals.availableToPackQty === 0 && overallTotals.packedQty > 0;

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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/production/packing')}
              className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-50 shrink-0 h-9 px-3"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span className="font-medium text-xs">Back</span>
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-slate-900 font-mono tracking-tight">
                  {order?.order_number || 'Order Details'}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <Boxes className="w-3.5 h-3.5 text-amber-600" />
                  Stage 09: Packing
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {order?.status || 'IN PRODUCTION'}
                </span>
                {isFullyPacked ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    100% Packed & Ready for Dispatch
                  </span>
                ) : overallTotals.packedQty > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Packing ({overallTotals.completionRate}%)
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                <span className="text-slate-600 font-medium truncate max-w-xs sm:max-w-md">
                  {(order as any)?.order_title || (order as any)?.title || 'Garments Production'}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600 font-medium">
                  <strong className="text-slate-800 font-semibold">{fmt(overallTotals.arrivedQty)} pcs</strong> arrived from Checking
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOrderData}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border-slate-200 bg-white hover:bg-slate-50 h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setTransferModalOpen(true)}
              disabled={overallTotals.packedQty === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap h-9 px-3.5"
            >
              <span>Pass to Completed / Dispatch (Stage 10)</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Buyer & Delivery Info */}
        <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <BuyerAvatar
              buyer={order}
              size="sm"
              shape="circle"
              className="shrink-0"
            />
            <span className="font-bold text-slate-800">{order?.customer_name || 'gowtham'}</span>
            <span className="text-slate-400 font-mono">({order?.customer_code || 'CUST-001'})</span>
          </div>

          <div className="flex items-center gap-5 flex-wrap">
            {order.target_delivery_date && (
              <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Target Delivery: <strong className="text-slate-800 font-mono">{order.target_delivery_date}</strong></span>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <span>Order Qty: <strong className="text-slate-800 font-mono">{fmt(overallTotals.orderQty)} pcs</strong></span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Boxes className="w-3.5 h-3.5 text-amber-600" />
              <span>Packed: <strong className="text-emerald-700 font-mono">{fmt(overallTotals.packedQty)} / {fmt(overallTotals.arrivedQty)} pcs</strong></span>
            </span>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: From Checking */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">From Checking</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black font-mono text-blue-700 mt-0.5">
            {fmt(overallTotals.arrivedQty)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Order: {fmt(overallTotals.orderQty)} pcs</div>
        </div>

        {/* Card 2: Total Packed */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Total Packed</span>
            <Package className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black font-mono text-amber-600 mt-0.5">
            {fmt(overallTotals.packedQty)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{batches.length} Packing Batches</div>
        </div>

        {/* Card 3: Ready to Pack */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Avail. to Pack</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black font-mono text-indigo-700 mt-0.5">
            {fmt(overallTotals.availableToPackQty)}
          </div>
          <div className="text-[10px] text-indigo-600 mt-1 font-medium">Ready in Stage 09</div>
        </div>

        {/* Card 4: Inner Boxes */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Inner Boxes</span>
            <Box className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-black font-mono text-slate-800 mt-0.5">
            {fmt(overallTotals.totalBoxes)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Section D Spec Boxes</div>
        </div>

        {/* Card 5: Master Cartons */}
        <div className="bg-white border border-emerald-200 bg-emerald-50/30 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Master Cartons</span>
            <Boxes className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-700 mt-0.5">
            {fmt(overallTotals.totalCartons)}
          </div>
          <div className="text-[10px] text-emerald-600 mt-1 font-medium">Ready for Loading</div>
        </div>

        {/* Card 6: Packing Progress */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Completion</span>
            <Check className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-black font-mono text-slate-800 mt-0.5">
            {overallTotals.arrivedQty > 0 ? Math.round((overallTotals.packedQty / overallTotals.arrivedQty) * 100) : 0}%
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Arrived Pcs Packed</div>
        </div>
      </div>

      {/* TABLE 1: Product-Wise Packing Status & Action */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Product-Wise Packing Status & Action
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Audited garments arriving from Checking are packed into inner boxes and master cartons per buyer specs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Products ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('PACKING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'PACKING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              In Packing ({items.filter(it => Number(it.arrived_from_checking || it.stage_9_qty || 0) > 0).length})
            </button>
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
                <th className="py-3 px-3 text-right text-blue-700 bg-blue-50/50">From Checking</th>
                <th className="py-3 px-3 text-right text-amber-700">Packed Qty</th>
                <th className="py-3 px-3 text-right text-slate-700">Inner Boxes</th>
                <th className="py-3 px-3 text-right text-emerald-700">Master Cartons</th>
                <th className="py-3 px-3 text-right font-black text-slate-900 bg-slate-50">Avail. to Pack</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No products found for this filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((it, idx) => {
                  const stats = summaryByItem[it.id] || {
                    totalPacked: 0,
                    totalBoxes: 0,
                    totalCartons: 0,
                    unpacked: 0,
                    availableToPack: 0,
                    arrivedFromChecking: 0,
                    orderQty: 0
                  };

                  const pSpec = productConfigs[it.product_id] || null;
                  const primaryBox = pSpec?.boxes?.[0] || null;

                  return (
                    <tr key={it.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400 text-xs">
                        {idx + 1}
                      </td>

                      {/* Product Name & SKU */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{it.product_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            {it.product_code || 'PRD'}
                          </span>
                          {primaryBox && (
                            <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              {primaryBox.items_per_box} pcs/box
                            </span>
                          )}
                          {it.product_id && order.customer_id && (
                            <Link
                              to={`/masters/buyers/${order.customer_id}/products/${it.product_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5 font-medium"
                              title="View Section C & D specifications"
                            >
                              <span>Specs</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          )}
                        </div>
                      </td>

                      {/* Color / Size */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{it.color || 'Standard'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Size: {it.size || 'Free Size'}
                        </div>
                      </td>

                      {/* Order Qty */}
                      <td className="py-3.5 px-3 text-right font-bold text-slate-900 font-mono">
                        {fmt(stats.orderQty || it.order_quantity || it.quantity || 0)}
                      </td>

                      {/* From Checking */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-blue-700 bg-blue-50/30">
                        {fmt(stats.arrivedFromChecking)}
                      </td>

                      {/* Packed Qty */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-600">
                        {fmt(stats.totalPacked)}
                      </td>

                      {/* Inner Boxes */}
                      <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                        {fmt(stats.totalBoxes)}
                      </td>

                      {/* Master Cartons */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {fmt(stats.totalCartons)}
                      </td>

                      {/* Avail. to Pack */}
                      <td className="py-3.5 px-3 text-right font-mono font-black text-slate-900 bg-slate-50/50">
                        {fmt(stats.availableToPack)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        {stats.arrivedFromChecking === 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            Awaiting Checking
                          </span>
                        ) : stats.availableToPack > 0 ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenBatchModal(it)}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs px-3 py-1 flex items-center gap-1 mx-auto"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Pack Batch</span>
                          </Button>
                        ) : stats.totalPacked > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Fully Packed</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABLE 2: Recorded Packing Batches & Quality Output */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Recorded Packing Batches & Carton Output
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Packaging batches generated with Section D box specifications and carton numbers.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            {batches.length} Batches
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Batch #</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Color / Size</th>
                <th className="py-3 px-3 text-right">Packed Qty</th>
                <th className="py-3 px-3 text-right">Units / Box</th>
                <th className="py-3 px-3 text-right">Boxes</th>
                <th className="py-3 px-3 text-right">Cartons</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Proof Photos</th>
                <th className="py-3 px-4 text-center">Cartons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    No packing batches recorded yet for this order. Click "+ Pack Batch" above to pack garments.
                  </td>
                </tr>
              ) : (
                batches.map(b => {
                  const matchingItem = items.find(
                    it => it.id === b.production_order_item_id || it.active_packing_item_id === b.production_order_item_id
                  );
                  const isTransferred = (b.status || '').toLowerCase().includes('dispatch') || (b.status || '').toLowerCase().includes('transferred');

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {b.batch_number}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                        {b.packing_date}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {matchingItem?.product_name || 'Garment Product'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800">{matchingItem?.color || 'Standard'}</span>
                        <span className="text-slate-400 text-[11px] block font-mono">Size: {matchingItem?.size || 'M'}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-amber-600">
                        {fmt(b.packed_quantity)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {b.units_per_box} pcs
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                        {b.number_of_boxes}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-700">
                        {b.number_of_master_cartons}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isTransferred ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                            In Dispatch
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Packed
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {Array.isArray(b.photo_urls) && b.photo_urls.length > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            {b.photo_urls.slice(0, 2).map((pUrl, pIdx) => (
                              <img
                                key={pIdx}
                                src={pUrl}
                                alt="Proof"
                                onClick={() => setPreviewImage(pUrl)}
                                className="w-6 h-6 rounded object-cover cursor-pointer hover:ring-2 hover:ring-amber-500"
                              />
                            ))}
                            {b.photo_urls.length > 2 && (
                              <span className="text-[10px] text-slate-400">+{b.photo_urls.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-xs font-mono font-bold text-slate-600">
                          {b.number_of_master_cartons} Cartons
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: Generated Master Cartons & Barcode Serials */}
      {cartons.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Generated Master Cartons & Barcode Serials ({cartons.length} Cartons)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Click any carton to inspect serial specifications
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {cartons.map(c => (
              <div
                key={c.id || c.carton_serial_number}
                onClick={() => setSelectedCarton(c)}
                className="p-3 bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 rounded-xl cursor-pointer transition text-xs space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-800 group-hover:text-amber-800 text-[11px]">
                    {c.carton_serial_number}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                    {c.is_full ? 'Full' : 'Partial'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 font-medium">
                  {fmt(c.items_count)} pcs
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {c.product_name || 'Master Carton'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Record Packing Batch Modal */}
      <Modal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title={`Create Packing Batch — ${selectedItem?.product_name || 'Product'}`}
        subtitle={`Stage 09: Box & Master Carton Packaging Breakdown • Order #${order?.order_number || id}`}
        size="2xl"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
              <span className="font-semibold text-slate-700">Batch Plan:</span>
              <span className="font-mono bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-bold">
                {fmt(batchForm.packed_quantity)} pcs
              </span>
              <span>→</span>
              <span className="font-mono bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-bold">
                {batchForm.number_of_boxes} boxes
              </span>
              <span>→</span>
              <span className="font-mono bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-black">
                {batchForm.number_of_master_cartons} Master Cartons
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="min-w-[80px]"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                form="create-packing-batch-form"
                disabled={savingBatch || batchForm.packed_quantity <= 0}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-semibold shadow-xs min-w-[220px]"
              >
                {savingBatch ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Box className="w-4 h-4" />}
                <span>Save & Generate Master Cartons</span>
              </Button>
            </div>
          </div>
        }
      >
        <form id="create-packing-batch-form" onSubmit={handleSaveBatch} className="space-y-4">
          {batchError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{batchError}</span>
            </div>
          )}

          {/* Product & Available to Pack Header Banner */}
          {selectedItem && (
            <div className="p-3.5 bg-gradient-to-r from-amber-50/90 via-slate-50 to-amber-50/40 rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <Package className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{selectedItem.product_name}</span>
                    {(selectedItem.sku || selectedItem.product_sku || selectedItem.product_code) && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 text-[10px] font-mono font-semibold">
                        {selectedItem.sku || selectedItem.product_sku || selectedItem.product_code}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-300">
                      Color: {selectedItem.color || 'Standard'}
                    </span>
                    {selectedItem.size && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono font-semibold border border-slate-200">
                        Size: {selectedItem.size}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <span>From Checking Stage: <strong>{fmt(summaryByItem[selectedItem.id]?.arrivedFromChecking || 0)} pcs</strong></span>
                    <span>•</span>
                    <span>Already Packed: <strong>{fmt(summaryByItem[selectedItem.id]?.totalPacked || 0)} pcs</strong></span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-amber-200 shadow-2xs">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Available to Pack</div>
                  <div className="text-base font-black text-amber-600 font-mono leading-tight">
                    {fmt(summaryByItem[selectedItem.id]?.availableToPack || 0)} <span className="text-[11px] font-normal text-slate-500">pcs</span>
                  </div>
                </div>
                {summaryByItem[selectedItem.id]?.availableToPack > 0 && batchForm.packed_quantity !== summaryByItem[selectedItem.id]?.availableToPack && (
                  <button
                    type="button"
                    onClick={() => handlePackedQtyChange(summaryByItem[selectedItem.id]?.availableToPack || 0)}
                    className="px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-md border border-amber-300 transition-colors cursor-pointer"
                  >
                    Pack All
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Row 1: Date & Operator Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Packing Date" required>
              <div className="relative">
                <input
                  type="date"
                  required
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  value={batchForm.packing_date}
                  onChange={e => setBatchForm({ ...batchForm, packing_date: e.target.value })}
                />
              </div>
            </FormField>

            <FormField label="Packing Lead / Operator" required>
              <input
                type="text"
                required
                placeholder="e.g. S. Selvaraj (Packing Lead)"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                value={batchForm.packing_operator}
                onChange={e => setBatchForm({ ...batchForm, packing_operator: e.target.value })}
              />
            </FormField>

            <FormField label="Packing Supervisor">
              <input
                type="text"
                placeholder="e.g. K. Senthil (Quality & Packing Supervisor)"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                value={batchForm.packing_supervisor}
                onChange={e => setBatchForm({ ...batchForm, packing_supervisor: e.target.value })}
              />
            </FormField>
          </div>

          {/* Section D Packaging Calculator Box */}
          <div className="p-4 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/30 rounded-xl border border-amber-200 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-amber-600" />
                <span>Automatic Box & Master Carton Calculation (Section D)</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedProductSpec?.boxes?.[0]?.box_name && (
                  <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono border border-slate-200">
                    Spec: {selectedProductSpec.boxes[0].box_name}
                  </span>
                )}
                <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-semibold border border-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Live Sync
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-800 block mb-1">
                  Quantity to Pack (Pcs) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedItem ? (summaryByItem[selectedItem.id]?.availableToPack || undefined) : undefined}
                  required
                  placeholder="0"
                  className="w-full font-mono text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-slate-900 bg-white"
                  value={batchForm.packed_quantity || ''}
                  onChange={e => {
                    const raw = e.target.value;
                    const val = raw === '' ? 0 : parseInt(raw) || 0;
                    handlePackedQtyChange(val);
                  }}
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Max: {selectedItem ? fmt(summaryByItem[selectedItem.id]?.availableToPack || 0) : 0} pcs
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Units per Inner Box</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="20"
                  className="w-full font-mono text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-slate-800 bg-white"
                  value={batchForm.units_per_box || ''}
                  onChange={e => {
                    const raw = e.target.value;
                    const val = raw === '' ? 0 : parseInt(raw) || 0;
                    handleUnitsPerBoxChange(val);
                  }}
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Pieces per inner box</span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Boxes per Carton</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="5"
                  className="w-full font-mono text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-slate-800 bg-white"
                  value={batchForm.boxes_per_master_carton || ''}
                  onChange={e => {
                    const raw = e.target.value;
                    const val = raw === '' ? 0 : parseInt(raw) || 0;
                    handleBoxesPerCartonChange(val);
                  }}
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Boxes in master ctn</span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-emerald-800 block mb-1">Cartons Generated</label>
                <div className="px-3 py-2 bg-emerald-50/80 rounded-lg border border-emerald-300 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-base font-black text-emerald-700">
                      {batchForm.number_of_master_cartons}
                    </span>
                    <span className="text-xs font-semibold text-emerald-800 ml-1.5">Cartons</span>
                  </div>
                  <Package className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-[10px] text-emerald-700 mt-1 block font-medium">To be registered</span>
              </div>
            </div>

            {/* Calculated Breakdown Display - 4 Modern Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-amber-200/70">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Inner Boxes</div>
                <div className="text-sm font-black font-mono text-slate-800 mt-0.5">
                  {batchForm.number_of_boxes} <span className="text-[11px] font-normal text-slate-500">boxes</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {batchForm.units_per_box} pcs / box
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Full Boxes</div>
                <div className="text-sm font-black font-mono text-slate-800 mt-0.5">
                  {Math.floor((batchForm.packed_quantity || 0) / (batchForm.units_per_box || 1))} <span className="text-[11px] font-normal text-slate-500">boxes</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                  @{batchForm.units_per_box} pcs each
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Partial Box Qty</div>
                <div className="text-sm font-black font-mono text-slate-800 mt-0.5">
                  {batchForm.partial_box_quantity > 0 ? (
                    <span className="text-amber-700 font-bold">{batchForm.partial_box_quantity} <span className="text-[11px] font-normal text-slate-600">pcs (1 box)</span></span>
                  ) : (
                    <span className="text-emerald-600 text-xs font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> None (All full)
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {batchForm.partial_box_quantity > 0 ? 'Last box has remainder' : 'Zero partial boxes'}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Partial Carton</div>
                <div className="text-sm font-black font-mono text-slate-800 mt-0.5">
                  {batchForm.partial_carton_quantity > 0 ? (
                    <span className="text-amber-700 font-bold">{batchForm.partial_carton_quantity} <span className="text-[11px] font-normal text-slate-600">boxes</span></span>
                  ) : (
                    <span className="text-emerald-600 text-xs font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> None (All full)
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {batchForm.partial_carton_quantity > 0 ? 'In last master carton' : 'All master cartons full'}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Weights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Gross Weight per Carton (kg)">
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 14.50"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  value={batchForm.gross_weight || ''}
                  onChange={e => {
                    const raw = e.target.value;
                    setBatchForm({ ...batchForm, gross_weight: raw === '' ? 0 : parseFloat(raw) || 0 });
                  }}
                />
              </div>
            </FormField>

            <FormField label="Net Weight per Carton (kg)">
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 13.00"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  value={batchForm.net_weight || ''}
                  onChange={e => {
                    const raw = e.target.value;
                    setBatchForm({ ...batchForm, net_weight: raw === '' ? 0 : parseFloat(raw) || 0 });
                  }}
                />
              </div>
            </FormField>
          </div>

          {/* Row 3: Remarks */}
          <FormField label="Packaging Notes & Barcode Instructions">
            <textarea
              rows={2}
              placeholder="Add any carton labeling instructions, barcode verification notes, or customer packaging guidelines..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
              value={batchForm.remarks}
              onChange={e => setBatchForm({ ...batchForm, remarks: e.target.value })}
            />
          </FormField>

          {/* Mandatory Live Camera Photo Proof */}
          <LivePhotoCaptureField
            label="Packed Boxes & Master Carton Evidence Photographs"
            required={true}
            photos={photoUrls}
            onPhotosChange={setPhotoUrls}
            stageName="Packing & Cartons (Stage 10)"
            orderNumber={order?.order_number}
            error={batchError && photoUrls.length === 0 ? 'Real-time camera photograph with live GPS coordinates of packed boxes & master cartons is mandatory.' : undefined}
            buttonText="Take Real-Time Packing Photo"
          />
        </form>
      </Modal>

      {/* Carton Details Modal */}
      <Modal
        isOpen={!!selectedCarton}
        onClose={() => setSelectedCarton(null)}
        title={`Master Carton: ${selectedCarton?.carton_serial_number || ''}`}
        size="md"
      >
        {selectedCarton && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-800 text-sm">{selectedCarton.carton_serial_number}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {selectedCarton.status || 'Packed & Staged'}
                </span>
              </div>
              <div className="text-slate-600">Product: <strong>{selectedCarton.product_name}</strong></div>
              <div className="flex items-center gap-3 text-slate-500">
                <span>Color: {selectedCarton.color || 'Standard'}</span>
                <span>Size: {selectedCarton.size || 'M'}</span>
                <span>Quantity: <strong className="text-slate-900 font-mono">{fmt(selectedCarton.items_count)} pcs</strong></span>
              </div>
              <div className="text-[11px] text-slate-400">
                Full Master Box: {selectedCarton.is_full ? 'Yes (Full capacity)' : 'No (Partial remaining pieces)'}
              </div>
            </div>

            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-indigo-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-indigo-600" />
                <span>Carton Traceability & Dispatch Readiness</span>
              </div>
              <p className="text-[11px] text-indigo-700">
                This carton is verified, weighed, and staged in the dispatch staging bay. When recording Stage 10 Completed / Dispatch, this carton will be allocated to the vehicle manifest.
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => setSelectedCarton(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Stage Transfer Modal */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer Order to Stage 10: Completed / Dispatch"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            You are about to transfer <strong>{fmt(overallTotals.packedQty)} packed pieces</strong> across <strong>{fmt(overallTotals.totalCartons)} master cartons</strong> to Stage 10 (Completed / Dispatch).
          </p>

          {overallTotals.unpackedQty > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Notice:</strong> {fmt(overallTotals.unpackedQty)} pieces remain unpacked. This order will be transferred for partial dispatch staging.
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleTransferToDispatch}
              disabled={transferring}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {transferring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Confirm Release to Dispatch</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Proof Photo Preview Modal */}
      {previewImage && (
        <Modal
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          title="Inspection / Packing Evidence Photo"
          size="lg"
        >
          <div className="flex flex-col items-center">
            <img src={previewImage} alt="Packing Proof" className="max-h-[70vh] rounded-xl object-contain shadow-lg" />
            <div className="mt-4 flex justify-end w-full">
              <Button variant="secondary" size="sm" onClick={() => setPreviewImage(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
