// src/pages/production/PackingOrderDetail.tsx
// Stage 09: Packing & Carton Management — Automated Box Calculation (Sections C & D specs), Carton Serial Generation & Traceability
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionStage, PackingBatch, PackingCarton, BuyerProduct } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import {
  ArrowLeft,
  Package,
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
  Box,
  Boxes,
  ExternalLink,
  QrCode,
  Scale
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
    gross_weight: 14.5,
    net_weight: 13.0,
    packing_operator: 'S. Selvaraj (Packing Lead)',
    packing_supervisor: 'K. Senthil (Quality & Packaging Manager)',
    remarks: 'Pre-pack polybagging and carton barcode labels verified against Buyer Spec Sheet.'
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
      setItems(ord.items || []);

      const st = (stagesRes as any)?.data || stagesRes;
      setStages(Array.isArray(st) ? st : []);

      const packData = (packRes as any)?.data || packRes;
      setBatches(Array.isArray(packData?.batches) ? packData.batches : []);

      const cData = (cartonsRes as any)?.data || cartonsRes;
      setCartons(Array.isArray(cData) ? cData : []);

      // Fetch packaging specs for each item from Buyer Master (Sections C & D)
      if (ord.customer_id && ord.items) {
        const configs: { [key: number]: any } = {};
        for (const it of ord.items) {
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
      if (!map[b.production_order_item_id]) {
        map[b.production_order_item_id] = [];
      }
      map[b.production_order_item_id].push(b);
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
    }> = {};

    items.forEach(it => {
      const itBatches = batchesByItem[it.id] || [];
      const totalPacked = itBatches.reduce((sum, b) => sum + Number(b.packed_quantity || 0), 0);
      const totalBoxes = itBatches.reduce((sum, b) => sum + Number(b.number_of_boxes || 0), 0);
      const totalCartons = itBatches.reduce((sum, b) => sum + Number(b.number_of_master_cartons || 0), 0);
      const unpacked = Math.max(0, Number(it.quantity || 0) - totalPacked);

      map[it.id] = {
        totalPacked,
        totalBoxes,
        totalCartons,
        unpacked
      };
    });

    return map;
  }, [items, batchesByItem]);

  // Overall totals across all products
  const overallTotals = useMemo(() => {
    let orderQty = 0;
    let packedQty = 0;
    let totalBoxes = 0;
    let totalCartons = 0;
    let unpackedQty = 0;

    items.forEach(it => {
      orderQty += Number(it.quantity || 0);
      const s = summaryByItem[it.id];
      if (s) {
        packedQty += s.totalPacked;
        totalBoxes += s.totalBoxes;
        totalCartons += s.totalCartons;
        unpackedQty += s.unpacked;
      }
    });

    return { orderQty, packedQty, totalBoxes, totalCartons, unpackedQty };
  }, [items, summaryByItem]);

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
    const existing = summaryByItem[item.id] || { totalPacked: 0 };
    const remainingQty = Math.max(0, Number(item.quantity || 0) - existing.totalPacked);

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
      gross_weight: 14.8,
      net_weight: 13.2,
      packing_operator: 'S. Selvaraj (Packing Lead)',
      packing_supervisor: 'K. Senthil (Quality & Packaging Manager)',
      remarks: `Packed per Section D master carton specifications (${unitsPerBox} pcs/box, ${boxesPerCarton} boxes/carton).`
    });

    setPhotoUrls([]);
    setBatchError('');
    setBatchModalOpen(true);
  };

  const handlePackedQtyChange = (val: number) => {
    const calc = recalculatePackaging(val, batchForm.units_per_box, batchForm.boxes_per_master_carton);
    setBatchForm({
      ...batchForm,
      packed_quantity: val,
      ...calc
    });
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
    const existing = summaryByItem[selectedItem.id] || { totalPacked: 0 };
    const maxAllowed = Number(selectedItem.quantity || 0) - existing.totalPacked;

    if (packed <= 0) {
      setBatchError('Packed quantity must be greater than zero.');
      return;
    }
    if (packed > maxAllowed) {
      setBatchError(`Packed quantity (${packed}) cannot exceed remaining approved quantity (${maxAllowed}).`);
      return;
    }

    try {
      setSavingBatch(true);
      setBatchError('');

      await api.createPackingBatch({
        production_order_id: order.id,
        production_order_item_id: selectedItem.id,
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
      const compStage = stages.find(s => (s.code || '').toUpperCase() === 'COMP');
      if (compStage && compStage.id) {
        await api.updateProductionOrderStatus(order.id, compStage.id, {
          notes: `Transferred from Stage 09 Packing to Stage 10 Completed / Dispatch with ${fmt(overallTotals.packedQty)} packed pieces across ${overallTotals.totalCartons} master cartons.`
        });
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
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

  const isFullyPacked = overallTotals.unpackedQty === 0 && overallTotals.packedQty > 0;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-in fade-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/production/packing')}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            title="Return to Stage 09 Board"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Boxes className="w-3 h-3 text-amber-600" />
                Stage 09: Packing & Carton Management
              </span>
              <StatusBadge status={order.status || 'In Progress'} />
              {isFullyPacked && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCheck className="w-3 h-3 text-emerald-600" />
                  100% Packed & Staged for Dispatch
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Order {order.order_number}</span>
              <span className="text-sm font-normal text-slate-500">({order.title || 'Garments Production'})</span>
            </h1>
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
              <div className="flex items-center gap-1.5">
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
                />
                <span className="font-semibold text-slate-700">{order.customer_name || 'Direct Buyer'}</span>
              </div>
              {order.target_delivery_date && (
                <div className="flex items-center gap-1 text-slate-600">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Target Delivery: {order.target_delivery_date}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="secondary" size="sm" onClick={fetchOrderData} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setTransferModalOpen(true)}
            disabled={overallTotals.packedQty === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
          >
            <span>Pass to Completed / Dispatch (Stage 10)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Approved to Pack</div>
          <div className="text-xl sm:text-2xl font-black text-slate-800">{fmt(overallTotals.orderQty)}</div>
          <div className="text-[10px] text-slate-400 mt-1">{items.length} Product Lines</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Total Packed</div>
          <div className="text-xl sm:text-2xl font-black text-amber-600">{fmt(overallTotals.packedQty)}</div>
          <div className="text-[10px] text-slate-400 mt-1">Batches: {batches.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider mb-1">Unpacked Balance</div>
          <div className="text-xl sm:text-2xl font-black text-indigo-700">{fmt(overallTotals.unpackedQty)}</div>
          <div className="text-[10px] text-indigo-600 mt-1 font-medium">Pending packaging</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Inner Boxes</div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">{fmt(overallTotals.totalBoxes)}</div>
          <div className="text-[10px] text-slate-500 mt-1">Section D Spec Boxes</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider mb-1">Master Cartons</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">{fmt(overallTotals.totalCartons)}</div>
          <div className="text-[10px] text-emerald-600 mt-1 font-medium">Ready for Truck Loading</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Packing Progress</div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {overallTotals.orderQty > 0 ? Math.round((overallTotals.packedQty / overallTotals.orderQty) * 100) : 0}%
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Overall completion</div>
        </div>
      </div>

      {/* Product-wise Packaging Config & Batches */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Product Packaging & Carton Generation</h2>
          <span className="text-xs text-slate-500">Integrated directly with Section C & Section D packaging masters</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {items.map(it => {
            const itBatches = batchesByItem[it.id] || [];
            const itCartons = cartons.filter(c => c.production_order_item_id === it.id);
            const stats = summaryByItem[it.id] || { totalPacked: 0, totalBoxes: 0, totalCartons: 0, unpacked: it.quantity };
            const pSpec = productConfigs[it.product_id] || null;
            const primaryBox = pSpec?.boxes?.[0] || null;
            const dims = pSpec?.dimensions || null;

            return (
              <div key={it.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-base text-slate-900">{it.product_name}</h3>
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-xs text-slate-600 border border-slate-200">
                        {it.product_code || 'GARMENT-REF'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-medium text-xs border border-amber-200">
                        Color: {it.color || 'Standard'}
                      </span>
                      {it.size && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-xs">
                          Size: {it.size}
                        </span>
                      )}
                    </div>

                    {/* Section C & D specifications preview */}
                    <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap mt-1">
                      {dims && (
                        <div className="flex items-center gap-1 text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          <span className="text-slate-400">Dimensions (Sec C):</span>
                          <span className="font-mono font-semibold">
                            {dims.length || 0} × {dims.width || 0} × {dims.height || 0} {dims.dimension_unit || 'cm'}
                          </span>
                        </div>
                      )}

                      {primaryBox && (
                        <div className="flex items-center gap-1 text-[11px] bg-amber-50/70 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                          <Box className="w-3 h-3 text-amber-600" />
                          <span>Sec D Spec:</span>
                          <span className="font-mono font-bold">{primaryBox.items_per_box} pcs/box</span>
                          <span>|</span>
                          <span className="font-mono font-bold">{primaryBox.boxes_per_master_carton || 5} boxes/carton</span>
                        </div>
                      )}

                      {it.product_id && order.customer_id && (
                        <Link
                          to={`/masters/buyers/${order.customer_id}/products/${it.product_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-medium"
                        >
                          <span>View Section C & D Spec</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenBatchModal(it)}
                      disabled={stats.unpacked === 0}
                      className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 text-xs shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Pack Batch & Generate Cartons</span>
                    </Button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                    <span>Packing Completion</span>
                    <span className="font-mono">
                      {fmt(stats.totalPacked)} / {fmt(it.quantity)} pcs ({stats.totalCartons} Master Cartons)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${it.quantity > 0 ? Math.min(100, Math.round((stats.totalPacked / it.quantity) * 100)) : 0}%` }}
                    />
                  </div>
                </div>

                {/* Master Cartons List */}
                {itCartons.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-slate-500" />
                      <span>Generated Master Cartons ({itCartons.length} Cartons)</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {itCartons.map(c => (
                        <div
                          key={c.id || c.carton_serial_number}
                          onClick={() => setSelectedCarton(c)}
                          className="p-2.5 bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 rounded-xl cursor-pointer transition text-xs space-y-1 group"
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
                            {c.box_name || 'Master Carton'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Record Packing Batch Modal */}
      <Modal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title={`Create Packing Batch — ${selectedItem?.product_name || ''}`}
        size="lg"
      >
        <form onSubmit={handleSaveBatch} className="space-y-4">
          {batchError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{batchError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Packing Date" required>
              <input
                type="date"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                value={batchForm.packing_date}
                onChange={e => setBatchForm({ ...batchForm, packing_date: e.target.value })}
              />
            </FormField>

            <FormField label="Packing Lead / Operator" required>
              <input
                type="text"
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                value={batchForm.packing_operator}
                onChange={e => setBatchForm({ ...batchForm, packing_operator: e.target.value })}
              />
            </FormField>

            <FormField label="Packing Supervisor">
              <input
                type="text"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                value={batchForm.packing_supervisor}
                onChange={e => setBatchForm({ ...batchForm, packing_supervisor: e.target.value })}
              />
            </FormField>
          </div>

          {/* Section D Packaging Calculator Box */}
          <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-amber-600" />
                <span>Automatic Box & Master Carton Calculation (Section D)</span>
              </div>
              <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-medium">
                Live Formula Sync
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-800 block mb-1">Quantity to Pack (Pcs)</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full font-mono text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-slate-900"
                  value={batchForm.packed_quantity}
                  onChange={e => handlePackedQtyChange(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Units per Inner Box</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full font-mono text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-slate-800"
                  value={batchForm.units_per_box}
                  onChange={e => {
                    const u = Math.max(1, parseInt(e.target.value) || 1);
                    const calc = recalculatePackaging(batchForm.packed_quantity, u, batchForm.boxes_per_master_carton);
                    setBatchForm({ ...batchForm, units_per_box: u, ...calc });
                  }}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Boxes per Carton</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full font-mono text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-slate-800"
                  value={batchForm.boxes_per_master_carton}
                  onChange={e => {
                    const b = Math.max(1, parseInt(e.target.value) || 1);
                    const calc = recalculatePackaging(batchForm.packed_quantity, batchForm.units_per_box, b);
                    setBatchForm({ ...batchForm, boxes_per_master_carton: b, ...calc });
                  }}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-emerald-800 block mb-1">Cartons Generated</label>
                <div className="font-mono text-base font-black text-emerald-700 px-2.5 py-1 bg-white rounded-lg border border-emerald-300">
                  {batchForm.number_of_master_cartons} Cartons
                </div>
              </div>
            </div>

            {/* Calculated Breakdown Display */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-amber-200/60 text-xs text-amber-900 font-mono">
              <div>Total Inner Boxes: <strong>{batchForm.number_of_boxes}</strong></div>
              <div>Partial Box Pcs: <strong>{batchForm.partial_box_quantity} pcs</strong></div>
              <div>Partial Carton Boxes: <strong>{batchForm.partial_carton_quantity} boxes</strong></div>
              <div>Gross Weight: <strong>{batchForm.gross_weight} kg/ctn</strong></div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Gross Weight per Carton (kg)">
              <input
                type="number"
                step="0.1"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                value={batchForm.gross_weight}
                onChange={e => setBatchForm({ ...batchForm, gross_weight: parseFloat(e.target.value) || 0 })}
              />
            </FormField>

            <FormField label="Net Weight per Carton (kg)">
              <input
                type="number"
                step="0.1"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                value={batchForm.net_weight}
                onChange={e => setBatchForm({ ...batchForm, net_weight: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
          </div>

          <FormField label="Packaging Notes & Barcode Instructions">
            <textarea
              rows={2}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              value={batchForm.remarks}
              onChange={e => setBatchForm({ ...batchForm, remarks: e.target.value })}
            />
          </FormField>

          {/* Photo Evidence */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Packed Boxes & Master Carton Evidence Photographs
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl p-3 flex items-center gap-2 text-xs text-slate-600 transition">
                <Camera className="w-4 h-4 text-amber-600" />
                <span>Upload Packing Photo</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>

              {photoUrls.map((url, idx) => (
                <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-300 group">
                  <img src={url} alt="Packing" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoUrls(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-0.5 right-0.5 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" size="sm" type="button" onClick={() => setBatchModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingBatch}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              {savingBatch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Box className="w-3.5 h-3.5" />}
              <span>Save & Generate Master Cartons</span>
            </Button>
          </div>
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
    </div>
  );
}
