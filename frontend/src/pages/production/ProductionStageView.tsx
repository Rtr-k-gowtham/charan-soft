// src/pages/production/ProductionStageView.tsx
// Production Stage Workspace for the 10 Core Production Pipeline Stages
// Optimized Order-First and Product-Breakdown view for Requirement Gathering & Pipeline
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../lib/api';
import { ProductionOrder, ProductionOrderItem, ProductionStage, OrderMaterialRequirementItem, PurchaseOrder } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import CategoryPOIssuer from '../../components/production/CategoryPOIssuer';
import {
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Boxes,
  Plus,
  Search,
  Eye,
  Layers,
  ArrowRight,
  ExternalLink,
  Package,
  Calendar,
  Sparkles,
  Filter,
  CheckCheck,
  ShoppingCart,
  PackageOpen,
  Droplets,
  Scissors,
  Activity,
  CheckCircle,
  Truck,
  Box
} from 'lucide-react';

const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n || 0);

interface Props {
  stageName: string;
  stageCode?: string;
  breadcrumb: string[];
}

type StageItem = ProductionOrderItem & {
  order_id?: number;
  order_number: string;
  order_title: string;
  customer_id?: number;
  customer_name?: string;
  customer_code?: string;
  customer_avatar_style?: string;
  customer_avatar_seed?: string;
  customer_avatar_config?: any;
  stage_code?: string;
  priority?: string;
  target_delivery_date?: string;
  total_order_quantity?: number;
};

interface OrderGroup {
  order_id: number;
  order_number: string;
  order_title: string;
  customer_id?: number;
  customer_name?: string;
  customer_code?: string;
  customer_avatar_style?: string;
  customer_avatar_seed?: string;
  customer_avatar_config?: any;
  priority?: string;
  target_delivery_date?: string;
  status?: string;
  items: StageItem[];
  total_stage_quantity: number;
  total_order_quantity: number;
  unique_products_count: number;
}

function OrderPOIssuerWrapper({
  orderId,
  orderNumber,
  orderTitle,
  targetDeliveryDate,
}: {
  orderId: number;
  orderNumber: string;
  orderTitle?: string;
  targetDeliveryDate?: string;
}) {
  const [materials, setMaterials] = useState<OrderMaterialRequirementItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`cheran_order_bom_${orderId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMaterials(parsed);
          setLoading(false);
          return;
        }
      }
    } catch (e) {}

    api.getOrderMaterialRequirements(orderId)
      .then(res => {
        const report = (res as any)?.data || res;
        setMaterials(report?.total_materials || []);
      })
      .catch(() => setMaterials([]))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="p-3 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500 mb-3 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
        <span>Loading category materials and matched vendors for PO issuance...</span>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <CategoryPOIssuer
        orderId={orderId}
        orderNumber={orderNumber}
        orderTitle={orderTitle}
        targetDeliveryDate={targetDeliveryDate}
        materials={materials}
      />
    </div>
  );
}

export default function ProductionStageView({ stageName, stageCode, breadcrumb }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const openDetail = (url: string) => {
    navigate(url, { state: { from: location.pathname + location.search } });
  };

  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [allItems, setAllItems] = useState<StageItem[]>([]);
  const [stagePOs, setStagePOs] = useState<PurchaseOrder[]>([]);
  const [stageDyeingOrders, setStageDyeingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode: 'orders' shows order cards with expandable products; 'items' shows flat item rows
  const activeCode = (stageCode || 'REQ').toUpperCase();
  const [viewMode, setViewMode] = useState<'orders' | 'items'>(activeCode === 'REQ' ? 'orders' : 'orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Modals
  const [moveOpen, setMoveOpen] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);
  const [orderModalGroup, setOrderModalGroup] = useState<OrderGroup | null>(null);

  const [selectedItem, setSelectedItem] = useState<StageItem | null>(null);
  const [selectedOrderForBatch, setSelectedOrderForBatch] = useState<OrderGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Forms
  const [moveForm, setMoveForm] = useState({ next_stage_id: '', quantity: '', notes: '' });
  const [batchMoveForm, setBatchMoveForm] = useState({ next_stage_id: '', notes: '' });
  const [qcForm, setQcForm] = useState({ passed: '', rejected: '', rework: '', defect_reason: '', remarks: '', rework_stage_id: '7' });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getProductionStages().catch(() => []),
      api.getProductionOrders().catch(() => []),
      api.getPurchaseOrders().catch(() => []),
      api.getDyeingOrders().catch(() => []),
    ])
      .then(([stgList, ordList, poList, dyeList]) => {
        setStages((stgList || []) as ProductionStage[]);
        setStagePOs((poList || []) as PurchaseOrder[]);
        setStageDyeingOrders((dyeList || []) as any[]);
        const flat: StageItem[] = [];
        ((ordList || []) as ProductionOrder[]).forEach(ord => {
          (ord.items || []).forEach(it => {
            flat.push({
              ...it,
              order_id: ord.id,
              order_number: ord.order_number,
              order_title: ord.title,
              customer_id: ord.customer_id,
              customer_name: ord.customer_name,
              customer_code: ord.customer_code,
              customer_avatar_style: ord.customer_avatar_style,
              customer_avatar_seed: ord.customer_avatar_seed,
              customer_avatar_config: ord.customer_avatar_config,
              priority: ord.priority,
              target_delivery_date: ord.target_delivery_date,
              stage_code: (it as { stage_code?: string }).stage_code || '',
              total_order_quantity: ord.total_quantity || 0,
            });
          });
        });
        setAllItems(flat);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // Default to 'orders' view for requirement gathering
    if (activeCode === 'REQ') {
      setViewMode('orders');
    }
  }, [stageName, stageCode, activeCode]);

  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  const isQC = activeCode === 'CHK';
  const isCompleted = activeCode === 'COMP';

  // Filter items that belong to this stage
  const items = useMemo(() => {
    return allItems.filter(i => {
      const iCode = (i.stage_code || '').toUpperCase();
      const iName = (i.current_stage_name || '').toLowerCase();
      const sCode = activeCode;
      const sName = stageName.toLowerCase();
      const currentStageId = Number(i.current_stage_id || 1);

      // STAGE 01: Requirement Gathering
      // If order item has progressed past Stage 1 (currentStageId > 1 or iCode is PO/INW/etc.), NEVER show in Stage 1!
      if (sCode === 'REQ') {
        if (currentStageId > 1 || iCode === 'PO' || iCode === 'INW' || iCode === 'DYE' || iCode === 'CUT' || iCode === 'EMB' || iCode === 'STI' || iCode === 'CHK' || iCode === 'PCK' || iCode === 'COMP') {
          return false;
        }
        return currentStageId === 1 || iCode === 'REQ' || iName.includes('requirement');
      }

      // STAGE 02: Purchase Order (PO)
      // Belongs to Stage 2 if currentStageId == 2 or iCode is PO
      if (sCode === 'PO') {
        if (currentStageId === 2 || iCode === 'PO' || iName.includes('purchase order')) {
          return true;
        }
        return false;
      }

      // STAGE 03: Material Inward
      // Belongs to Stage 3 if currentStageId == 3 or iCode is INW,
      // OR if the order has at least one issued Purchase Order (status != 'Draft') and has progressed past REQ (currentStageId >= 2)
      if (sCode === 'INW') {
        if (currentStageId === 3 || iCode === 'INW' || iName.includes('inward') || iCode === 'DET') {
          return true;
        }
        const ordId = i.order_id || (i.production_order_id as number);
        const ordNum = i.order_number;
        const hasIssuedPO = stagePOs.some(po => {
          const isThisOrder = (po.production_order_id && String(po.production_order_id) === String(ordId)) ||
                              (po.production_order_number && po.production_order_number === ordNum) ||
                              (po.remarks && ordNum && po.remarks.includes(ordNum));
          return isThisOrder && (po.status || '').toLowerCase() !== 'draft';
        });
        if (hasIssuedPO && currentStageId >= 2) {
          return true;
        }
        return false;
      }

      // STAGE 04: Dyeing
      if (sCode === 'DYE') {
        if (currentStageId === 4 || iCode === 'DYE' || iName.includes('dye')) {
          return true;
        }
        // If this order has inwarded fabric from Stage 03, it is ready for Dyeing batches
        const ordId = i.order_id || (i.production_order_id as number);
        const ordNum = i.order_number;
        const hasFabricInwarded = stagePOs.some(po => {
          const isThisOrder = (po.production_order_id && String(po.production_order_id) === String(ordId)) ||
                              (po.production_order_number && po.production_order_number === ordNum) ||
                              (po.remarks && ordNum && po.remarks.includes(ordNum));
          if (!isThisOrder) return false;
          const isFabricCat = (po.category_name || '').toUpperCase().includes('FABRIC') ||
                              (po.remarks || '').toUpperCase().includes('FABRIC');
          const hasReceivedItems = Array.isArray(po.items) && po.items.some((it: any) => {
            const isFabric = isFabricCat ||
                             (it.item_description || '').toUpperCase().includes('FABRIC') ||
                             (it.item_description || '').toUpperCase().includes('COTTON') ||
                             (it.item_description || '').toUpperCase().includes('MAT-FAB');
            return isFabric && Number(it.received_quantity || 0) > 0;
          });
          return hasReceivedItems;
        });
        if (hasFabricInwarded && currentStageId >= 2) {
          return true;
        }
        return false;
      }

      if (iCode === sCode) return true;
      if (iName === sName) return true;

      // Alias mapping for downstream stages
      if (sCode === 'CUT' && (iName.includes('cut') || iCode === 'CUT' || currentStageId === 5)) return true;
      if (sCode === 'EMB' && (iName.includes('embroid') || iCode === 'EMB' || currentStageId === 6)) return true;
      if (sCode === 'STI' && (iName.includes('stitch') || iCode === 'STI' || currentStageId === 7)) return true;
      if (sCode === 'CHK' && (iName.includes('check') || iName === 'qc' || iCode === 'QC' || currentStageId === 8)) return true;
      if (sCode === 'PCK' && (iName.includes('pack') || iCode === 'PCK' || currentStageId === 9)) return true;
      if (sCode === 'COMP' && (iName.includes('complete') || iCode === 'COMP' || currentStageId === 10)) return true;

      return false;
    });
  }, [allItems, activeCode, stageName, stagePOs]);

  // Group items by Order for the Order-Centric view
  const orderGroups = useMemo(() => {
    const map = new Map<string, OrderGroup>();

    items.forEach(it => {
      const key = it.order_number || String(it.order_id || 'unknown');
      if (!map.has(key)) {
        map.set(key, {
          order_id: it.order_id || (it.production_order_id as number) || 0,
          order_number: it.order_number,
          order_title: it.order_title,
          customer_id: it.customer_id,
          customer_name: it.customer_name,
          customer_code: it.customer_code,
          customer_avatar_style: it.customer_avatar_style,
          customer_avatar_seed: it.customer_avatar_seed,
          customer_avatar_config: it.customer_avatar_config,
          priority: it.priority,
          target_delivery_date: it.target_delivery_date,
          status: it.status,
          items: [],
          total_stage_quantity: 0,
          total_order_quantity: 0,
          unique_products_count: 0,
        });
      }
      const group = map.get(key)!;
      group.items.push(it);
      group.total_stage_quantity += (it.current_stage_quantity || it.total_quantity || 0);
      group.total_order_quantity = (it as any).total_order_quantity || Math.max(group.total_order_quantity, it.total_quantity || 0);
    });

    // Compute unique product names
    map.forEach(group => {
      const set = new Set(group.items.map(i => i.product_name || i.product_id));
      group.unique_products_count = set.size;
    });

    return Array.from(map.values());
  }, [items]);

  // Filtered order groups based on search & priority
  const filteredOrderGroups = useMemo(() => {
    return orderGroups.filter(g => {
      if (priorityFilter !== 'ALL' && g.priority?.toUpperCase() !== priorityFilter) {
        return false;
      }
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      const matchOrder = g.order_number.toLowerCase().includes(q) || g.order_title?.toLowerCase().includes(q);
      const matchBuyer = g.customer_name?.toLowerCase().includes(q) || g.customer_code?.toLowerCase().includes(q);
      const matchProduct = g.items.some(it =>
        it.product_name?.toLowerCase().includes(q) ||
        it.product_code?.toLowerCase().includes(q) ||
        it.color?.toLowerCase().includes(q)
      );
      return matchOrder || matchBuyer || matchProduct;
    });
  }, [orderGroups, searchTerm, priorityFilter]);

  // Fabric Balance & Outward Summary for Stage 04: Dyeing
  const stageDyeingSummary = useMemo(() => {
    let totalInwarded = 0;
    const stageOrderIds = new Set(orderGroups.map(g => String(g.order_id)));
    const stageOrderNumbers = new Set(orderGroups.map(g => g.order_number));

    stagePOs.forEach(po => {
      const isThisOrder = (po.production_order_id && stageOrderIds.has(String(po.production_order_id))) ||
                          (po.production_order_number && stageOrderNumbers.has(po.production_order_number)) ||
                          (po.remarks && Array.from(stageOrderNumbers).some(num => num && po.remarks?.includes(num)));
      if (isThisOrder && Array.isArray(po.items)) {
        const isFabricCat = (po.category_name || '').toUpperCase().includes('FABRIC') ||
                            (po.remarks || '').toUpperCase().includes('FABRIC');
        po.items.forEach((it: any) => {
          const isFabric = isFabricCat ||
                           (it.item_description || '').toUpperCase().includes('FABRIC') ||
                           (it.item_description || '').toUpperCase().includes('COTTON') ||
                           (it.item_description || '').toUpperCase().includes('MAT-FAB');
          if (isFabric) {
            totalInwarded += Number(it.received_quantity || 0);
          }
        });
      }
    });

    let totalOutward = 0;
    let totalReceived = 0;
    stageDyeingOrders.forEach((d: any) => {
      const isThisOrder = (d.production_order_id && stageOrderIds.has(String(d.production_order_id))) ||
                          (d.order_number && stageOrderNumbers.has(d.order_number));
      if (isThisOrder && d.status !== 'Cancelled') {
        totalOutward += Number(d.total_fabric_quantity || 0);
        totalReceived += Number(d.total_received_quantity || 0);
      }
    });

    // If order-specific outward is 0 but there are stage dyeing orders, aggregate all
    if (totalOutward === 0 && stageDyeingOrders.length > 0) {
      stageDyeingOrders.forEach((d: any) => {
        if (d.status !== 'Cancelled') {
          totalOutward += Number(d.total_fabric_quantity || 0);
          totalReceived += Number(d.total_received_quantity || 0);
        }
      });
    }

    if (totalInwarded === 0 && totalOutward > 0) {
      totalInwarded = totalOutward;
    }

    const availableToSend = Math.max(0, Number((totalInwarded - totalOutward).toFixed(1)));

    return {
      totalInwarded,
      totalOutward,
      availableToSend,
      totalReceived,
    };
  }, [orderGroups, stagePOs, stageDyeingOrders]);

  const currentStage = stages.find(s => s.code === activeCode || s.name === stageName);
  const nextStages = stages.filter(s => s.sequence_order > (currentStage?.sequence_order || 0));

  const stageNumber = currentStage?.sequence_order || (
    activeCode === 'REQ' ? 1 :
    activeCode === 'PO' ? 2 :
    activeCode === 'INW' ? 3 :
    activeCode === 'DYE' ? 4 :
    activeCode === 'CUT' ? 5 :
    activeCode === 'EMB' ? 6 :
    activeCode === 'STI' ? 7 :
    activeCode === 'CHK' ? 8 :
    activeCode === 'PCK' ? 9 :
    activeCode === 'COMP' ? 10 : 1
  );

  const { mainStageTitle, subStageTitle } = useMemo(() => {
    if (stageName.includes(' — ')) {
      const [main, sub] = stageName.split(' — ');
      return { mainStageTitle: main.trim(), subStageTitle: sub.trim() };
    }
    if (stageName.includes(' - ')) {
      const [main, sub] = stageName.split(' - ');
      return { mainStageTitle: main.trim(), subStageTitle: sub.trim() };
    }
    return { mainStageTitle: stageName, subStageTitle: '' };
  }, [stageName]);

  // Stage Move Handler for Single Product Item
  const handleMove = async () => {
    if (!moveForm.next_stage_id || !moveForm.quantity) {
      setError('Select destination stage and enter quantity');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.moveStage({
        order_item_id: selectedItem?.id || 0,
        to_stage_id: parseInt(moveForm.next_stage_id),
        quantity_moved: parseInt(moveForm.quantity),
        remarks: moveForm.notes || undefined,
      });
      setMoveOpen(false);
      setSuccessToast(`Moved ${moveForm.quantity} pcs of ${selectedItem?.product_name || 'item'} to next stage`);
      loadData();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to move item stage');
    } finally {
      setSaving(false);
    }
  };

  // Batch Move Handler for All Products of an Order
  const handleBatchMove = async () => {
    if (!batchMoveForm.next_stage_id || !selectedOrderForBatch) {
      setError('Select destination stage');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const destId = parseInt(batchMoveForm.next_stage_id);
      // Move each item in the order group
      await Promise.all(
        selectedOrderForBatch.items.map(it =>
          api.moveStage({
            order_item_id: it.id,
            to_stage_id: destId,
            quantity_moved: it.current_stage_quantity || it.total_quantity || 0,
            remarks: batchMoveForm.notes || `Batch advanced from ${stageName}`,
          })
        )
      );
      setBatchMoveOpen(false);
      setSuccessToast(`Successfully advanced all ${selectedOrderForBatch.items.length} products of order ${selectedOrderForBatch.order_number}`);
      loadData();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to batch advance order items');
    } finally {
      setSaving(false);
    }
  };

  // QC / Checking Handler
  const handleQC = async () => {
    const passed = Number(qcForm.passed || 0);
    const rejected = Number(qcForm.rejected || 0);
    const rework = Number(qcForm.rework || 0);
    const total = passed + rejected + rework;
    const avail = selectedItem?.current_stage_quantity || selectedItem?.total_quantity || 0;

    if (total <= 0) {
      setError('Enter at least 1 inspected piece');
      return;
    }
    if (total > avail) {
      setError(`Total inspected (${total}) exceeds available stage quantity (${avail})`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.recordQC({
        order_item_id: selectedItem?.id || 0,
        stage_id: currentStage?.id || 8,
        inspected_quantity: total,
        passed_quantity: passed,
        rejected_quantity: rejected,
        rework_quantity: rework,
        defect_reason: qcForm.defect_reason || undefined,
        remarks: qcForm.remarks || undefined,
        rework_stage_id: rework > 0 ? Number(qcForm.rework_stage_id) : undefined,
      });

      // Automatically advance passed pieces to next stage (Packing / 9)
      if (passed > 0) {
        const packingStage = stages.find(s => s.code === 'PCK' || s.sequence_order === 9);
        const nextId = packingStage ? packingStage.id : 9;
        await api.moveStage({
          order_item_id: selectedItem?.id || 0,
          to_stage_id: nextId,
          quantity_moved: passed,
          remarks: 'QC Passed - Auto advanced to Packing',
        });
      }

      setQcOpen(false);
      setSuccessToast(`QC recorded: ${passed} passed, ${rework} rework, ${rejected} rejected`);
      loadData();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to record QC inspection');
    } finally {
      setSaving(false);
    }
  };

  const openMoveModal = (item: StageItem) => {
    setSelectedItem(item);
    setError('');
    const defaultNext = nextStages[0]?.id ? String(nextStages[0].id) : '';
    setMoveForm({
      next_stage_id: defaultNext,
      quantity: String(item.current_stage_quantity || item.total_quantity || 0),
      notes: '',
    });
    setMoveOpen(true);
  };

  const openBatchMoveModal = (group: OrderGroup) => {
    setSelectedOrderForBatch(group);
    setError('');
    const defaultNext = nextStages[0]?.id ? String(nextStages[0].id) : '';
    setBatchMoveForm({
      next_stage_id: defaultNext,
      notes: `Requirement completed for Order ${group.order_number}`,
    });
    setBatchMoveOpen(true);
  };

  // Flat table columns
  const flatColumns = [
    {
      key: 'order_number',
      label: 'Order #',
      sortable: true,
      render: (r: StageItem) => (
        <div>
          <span className="font-mono font-bold text-brand-700 text-xs block">{r.order_number}</span>
          <span className="text-[11px] text-slate-500 truncate max-w-[130px] block">{r.order_title}</span>
        </div>
      ),
    },
    {
      key: 'customer_name',
      label: 'Buyer',
      render: (r: StageItem) => (
        <div className="flex items-center gap-2 min-w-0">
          <BuyerAvatar
            buyer={{
              id: r.customer_id,
              code: r.customer_code,
              name: r.customer_name,
              avatar_style: r.customer_avatar_style,
              avatar_seed: r.customer_avatar_seed,
              avatar_config: r.customer_avatar_config,
            }}
            size="sm"
            shape="circle"
          />
          <div className="min-w-0">
            <span className="font-semibold text-slate-800 text-xs truncate block">{r.customer_name || 'Direct Buyer'}</span>
            {r.customer_code && (
              <span className="font-mono text-[10px] text-slate-400 block">{r.customer_code}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'product_name',
      label: 'Product',
      sortable: true,
      render: (r: StageItem) => (
        <div>
          <span className="font-medium text-slate-800">{r.product_name || 'Garment Item'}</span>
          {r.product_code && <span className="text-[10px] text-slate-400 block font-mono">{r.product_code}</span>}
        </div>
      ),
    },
    {
      key: 'color',
      label: 'Color',
      render: (r: StageItem) => (
        <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium text-slate-700 border border-slate-200">
          {r.color}
        </span>
      ),
    },
    {
      key: 'size',
      label: 'Size',
      render: (r: StageItem) => r.size ? (
        <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-mono font-bold text-slate-700">
          {r.size}
        </span>
      ) : (
        <span className="text-slate-400 font-mono text-xs">—</span>
      ),
    },
    {
      key: 'total_quantity',
      label: 'Order Qty',
      render: (r: StageItem) => <span className="font-mono font-semibold text-slate-700">{fmt(r.total_quantity)}</span>,
    },
    {
      key: 'current_stage_quantity',
      label: 'At This Stage',
      render: (r: StageItem) => (
        <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
          {fmt(r.current_stage_quantity || r.total_quantity)} pcs
        </span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (r: StageItem) => <StatusBadge status={r.priority || 'Medium'} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: StageItem) => <StatusBadge status={r.status || 'In Progress'} />,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          {successToast}
        </div>
      )}

      <PageHeader
        title={stageName}
        subtitle={
          activeCode === 'REQ'
            ? 'Requirement Gathering: View orders and expand to review & advance individual products'
            : `Production orders currently at ${stageName} stage`
        }
        breadcrumb={[{ label: 'Production' }, ...breadcrumb.map(b => ({ label: b }))]}
        actions={
          <div className="flex gap-2 items-center">
            {activeCode === 'REQ' && (
              <Button
                icon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
                onClick={() => navigate('/production/orders/create')}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs"
              >
                <span className="hidden sm:inline">New Production Order</span>
                <span className="sm:hidden">New Order</span>
              </Button>
            )}
            {activeCode === 'PO' && (
              <Button
                icon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
                onClick={() => navigate('/purchase/orders?create=true')}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs"
              >
                <span>Create PO</span>
              </Button>
            )}
            {activeCode === 'DYE' && (
              <Button
                icon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
                onClick={() => {
                  const targetOrd = filteredOrderGroups[0] || orderGroups[0];
                  if (targetOrd) {
                    openDetail(`/production/dyeing/${targetOrd.order_id}?create=true`);
                  } else {
                    alert('Please select or create an order with fabric inwarded in Stage 03 first.');
                  }
                }}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs"
              >
                <span>Create Dyeing Order</span>
              </Button>
            )}
            <button
              onClick={() => navigate('/production/board')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs"
            >
              <Boxes className="w-3.5 h-3.5 text-brand-600" />
              <span className="hidden sm:inline">Kanban Board</span>
            </button>
            <button
              onClick={loadData}
              title="Refresh Stage Data"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Stage Summary Statistics Cards */}
      <div className="px-3 sm:px-4 pt-3 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between min-w-0">
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider leading-tight">Orders in Stage</p>
            <p className="text-base sm:text-lg font-bold text-slate-800 mt-0.5">{orderGroups.length}</p>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Package className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between min-w-0">
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider leading-tight">Garments in Stage</p>
            <p className="text-base sm:text-lg font-bold text-brand-600 mt-0.5 truncate">
              {fmt(orderGroups.reduce((acc, g) => acc + g.total_stage_quantity, 0))} <span className="text-[10px] sm:text-xs font-normal text-slate-400">pcs</span>
            </p>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between min-w-0">
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider leading-tight">Product Line Items</p>
            <p className="text-base sm:text-lg font-bold text-slate-800 mt-0.5">{items.length}</p>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between min-w-0 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 sm:pr-2">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider truncate">
                Current Pipeline
              </p>
              {/* Badge on mobile in top row to preserve full card width for stage title */}
              <div
                className="sm:hidden px-1.5 py-0.5 rounded text-white font-bold text-[9px] shadow-2xs shrink-0 uppercase tracking-wider"
                style={{ backgroundColor: activeCode === 'DYE' ? '#2563eb' : (currentStage?.color_badge || '#2563eb') }}
              >
                {activeCode}
              </div>
            </div>

            {/* Mobile View: Full Width for Stage Title & Step without any icon squeeze */}
            <div className="sm:hidden mt-1 space-y-0.5">
              <span className="text-[9px] font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200 inline-block font-mono leading-none">
                Step {stageNumber}
              </span>
              <p className="text-xs font-bold text-slate-800 leading-snug break-words" title={stageName}>
                {stageName}
              </p>
            </div>

            {/* Desktop View: Full Single-Line Breadcrumb */}
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-slate-800 truncate mt-1" title={`Step ${stageNumber}: ${stageName}`}>
                Step {stageNumber}: {stageName}
              </p>
            </div>
          </div>

          {/* Desktop Right Badge */}
          <div
            className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center text-white font-bold text-xs shadow-2xs shrink-0"
            style={{ backgroundColor: activeCode === 'DYE' ? '#2563eb' : (currentStage?.color_badge || '#2563eb') }}
          >
            {activeCode}
          </div>
        </div>
      </div>

      {/* Stage 04: Fabric Balance & Outward Pipeline Summary */}
      {activeCode === 'DYE' && (
        <div className="mx-3 sm:mx-4 mt-1 mb-2 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
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
              onClick={() => {
                const target = filteredOrderGroups[0] || orderGroups[0];
                if (target) {
                  openDetail(`/production/dyeing/${target.order_id}?create=true`);
                } else {
                  alert('Please select or create an order with fabric inwarded in Stage 03 first.');
                }
              }}
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
                <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">{fmt(stageDyeingSummary.totalInwarded, 1)}</span>
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
                <span className="text-xl sm:text-2xl font-bold font-mono text-brand-700">{fmt(stageDyeingSummary.totalOutward, 1)}</span>
                <span className="text-xs text-slate-500 font-semibold">MTR</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Total outward delivery challans</p>
            </div>

            {/* 3. Available to Send */}
            <div className={`rounded-xl p-3.5 border flex flex-col justify-between ${
              stageDyeingSummary.availableToSend > 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50/70 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Available to Send</span>
                <Boxes className={`w-4 h-4 ${stageDyeingSummary.availableToSend > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className={`text-xl sm:text-2xl font-bold font-mono ${stageDyeingSummary.availableToSend > 0 ? 'text-amber-800' : 'text-slate-700'}`}>
                  {fmt(stageDyeingSummary.availableToSend, 1)}
                </span>
                <span className="text-xs text-slate-500 font-semibold">MTR</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {stageDyeingSummary.availableToSend > 0 ? 'Ready for outward delivery' : 'All inward fabric allocated'}
              </p>
            </div>

            {/* 4. Dyed Fabric Received */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Dyed Fabric Received</span>
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold font-mono text-purple-700">{fmt(stageDyeingSummary.totalReceived, 1)}</span>
                <span className="text-xs text-slate-500 font-semibold">MTR</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Inwarded from dyeing mills</p>
            </div>
          </div>
        </div>
      )}

      {/* Search & Control Filter Bar */}
      <div className="px-3 sm:px-4 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by Order #, Buyer, Product, Color..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-2xs"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-2xs"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {/* View Switcher: Orders View (Default) vs Flat Items (Only for stages after REQ) */}
        {activeCode !== 'REQ' && (
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-200/80 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('orders')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                  viewMode === 'orders'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Orders View ({filteredOrderGroups.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('items')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                  viewMode === 'items'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Flat Items ({items.length})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin text-brand-600 mb-2" />
            <p className="text-xs font-medium">Loading stage pipeline data...</p>
          </div>
        ) : viewMode === 'orders' ? (
          /* ========================================================================= */
          /* PRODUCTION STAGE STRUCTURED TABLE VIEW                                    */
          /* ========================================================================= */
          filteredOrderGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-2xs">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700">No Orders in {stageName}</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? 'No orders match your filter criteria. Try clearing search.'
                  : `There are currently no active production orders at the ${stageName} stage.`}
              </p>
              {activeCode === 'REQ' && (
                <Button
                  onClick={() => navigate('/production/orders/create')}
                  className="mt-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs"
                >
                  Create Production Order
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse table-auto">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-2.5 py-2.5 w-8 text-center text-slate-400">#</th>
                      <th className="px-2.5 py-2.5 whitespace-nowrap">Order #</th>
                      <th className="px-2.5 py-2.5">Order Title</th>
                      <th className="px-2.5 py-2.5">Buyer / Customer</th>
                      <th className="px-2.5 py-2.5 whitespace-nowrap">Target Delivery</th>
                      {activeCode === 'REQ' && (
                        <>
                          <th className="px-2 py-2.5 text-right whitespace-nowrap">Total Order Qty</th>
                          <th className="px-2 py-2.5 whitespace-nowrap">Products / Line Items</th>
                          <th className="px-2 py-2.5 text-center whitespace-nowrap">BOM Status</th>
                        </>
                      )}
                      {activeCode === 'PO' && (
                        <>
                          <th className="px-2 py-2.5 text-right whitespace-nowrap">Stage Quantity</th>
                          <th className="px-2.5 py-2.5 text-center whitespace-nowrap">POs Issued</th>
                          <th className="px-2.5 py-2.5 text-center whitespace-nowrap">Priority</th>
                        </>
                      )}
                      {activeCode === 'INW' && (
                        <>
                          <th className="px-2 py-2.5 text-right whitespace-nowrap">Inward Quantity</th>
                          <th className="px-2.5 py-2.5 text-center whitespace-nowrap">Inward Status</th>
                          <th className="px-2.5 py-2.5 text-center whitespace-nowrap">Priority</th>
                        </>
                      )}
                      {activeCode === 'DYE' && (
                        <>
                          <th className="px-2 py-2.5 text-right whitespace-nowrap">Dyeing Quantity</th>
                          <th className="px-2.5 py-2.5 text-center whitespace-nowrap">Dyeing Status</th>
                          <th className="px-2.5 py-2.5 text-center whitespace-nowrap">Priority</th>
                        </>
                      )}
                      {activeCode !== 'REQ' && activeCode !== 'PO' && activeCode !== 'INW' && activeCode !== 'DYE' && (
                        <>
                          <th className="px-2 py-2.5 text-right whitespace-nowrap">Stage Quantity</th>
                          <th className="px-2.5 py-2.5 text-center whitespace-nowrap">Status</th>
                          <th className="px-2.5 py-2.5 text-center whitespace-nowrap">Priority</th>
                        </>
                      )}
                      <th className="px-3 py-2.5 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrderGroups.map((group, idx) => {
                      const lineItemsCount = group.items.length;
                      const uniqueProducts = group.unique_products_count || lineItemsCount;

                      // Stage workspace routing
                      let targetUrl = `/production/orders/${group.order_id}`;
                      if (activeCode === 'REQ') targetUrl = `/production/requirement/${group.order_id}`;
                      if (activeCode === 'PO') targetUrl = `/production/po/${group.order_id}`;
                      if (activeCode === 'INW') targetUrl = `/production/inward/${group.order_id}`;
                      if (activeCode === 'DYE') targetUrl = `/production/dyeing/${group.order_id}`;
                      if (activeCode === 'CUT') targetUrl = `/production/cutting/${group.order_id}`;
                      if (activeCode === 'EMB') targetUrl = `/production/embroidery/${group.order_id}`;
                      if (activeCode === 'STI') targetUrl = `/production/stitching/${group.order_id}`;
                      if (activeCode === 'CHK') targetUrl = `/production/checking/${group.order_id}`;
                      if (activeCode === 'PCK') targetUrl = `/production/packing/${group.order_id}`;
                      if (activeCode === 'COMP') targetUrl = `/production/completed/${group.order_id}`;

                      // PO count for PO stage
                      const ordNum = group.order_number;
                      const poCount = stagePOs.filter(po => {
                        if (po.production_order_id && String(po.production_order_id) === String(group.order_id)) return true;
                        if (po.production_order_number && po.production_order_number === ordNum) return true;
                        if (po.remarks && ordNum && po.remarks.includes(ordNum)) return true;
                        if (Array.isArray(po.items) && ordNum && po.items.some((it: any) => it.order_no === ordNum)) return true;
                        return false;
                      }).length;

                      return (
                        <tr
                          key={group.order_number}
                          onClick={() => openDetail(targetUrl)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                            <td className="px-2.5 py-2.5 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>

                            <td className="px-2.5 py-2.5 whitespace-nowrap">
                              <span className="font-mono font-bold text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                                {group.order_number}
                              </span>
                            </td>

                            <td className="px-2.5 py-2.5">
                              <span
                                className="font-semibold text-slate-800 block text-xs hover:text-brand-600 transition-colors truncate max-w-[200px]"
                                title={group.order_title}
                              >
                                {group.order_title || 'Garment Production Order'}
                              </span>
                            </td>

                            <td className="px-2.5 py-2.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <BuyerAvatar
                                  buyer={{
                                    id: group.customer_id,
                                    code: group.customer_code,
                                    name: group.customer_name,
                                    avatar_style: group.customer_avatar_style,
                                    avatar_seed: group.customer_avatar_seed,
                                    avatar_config: group.customer_avatar_config,
                                  }}
                                  size="xs"
                                  shape="circle"
                                  className="shrink-0"
                                />
                                <div className="min-w-0">
                                  <span
                                    className="font-medium text-slate-800 text-xs block truncate max-w-[150px]"
                                    title={group.customer_name || 'Direct Order'}
                                  >
                                    {group.customer_name || 'Direct Order'}
                                  </span>
                                  {group.customer_code && (
                                    <span className="text-[10px] font-mono text-slate-400 block truncate">
                                      {group.customer_code}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-2.5 py-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px]">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{group.target_delivery_date || '—'}</span>
                              </div>
                            </td>

                            {/* REQ specific columns */}
                            {activeCode === 'REQ' && (
                              <>
                                <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {fmt(group.total_order_quantity || group.total_stage_quantity)}{' '}
                                  <span className="text-[10px] font-normal text-slate-400">pcs</span>
                                </td>
                                <td className="px-2 py-2.5 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                    <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{uniqueProducts} {uniqueProducts === 1 ? 'Product' : 'Products'} ({lineItemsCount} lines)</span>
                                  </span>
                                </td>
                                <td className="px-2 py-2.5 text-center whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                                    <Sparkles className="w-3 h-3 text-emerald-600" />
                                    <span>Generated</span>
                                  </span>
                                </td>
                              </>
                            )}

                            {/* PO specific columns */}
                            {activeCode === 'PO' && (
                              <>
                                <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {fmt(group.total_stage_quantity)}{' '}
                                  <span className="text-[10px] font-normal text-slate-400">pcs</span>
                                </td>
                                <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                                  {poCount > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      <ShoppingCart className="w-2.5 h-2.5 text-indigo-600" />
                                      <span>{poCount} {poCount === 1 ? 'PO Issued' : 'POs Issued'}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                      0 POs Issued
                                    </span>
                                  )}
                                </td>
                                <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                                  <StatusBadge status={group.priority || 'Medium'} />
                                </td>
                              </>
                            )}

                            {/* INW specific columns */}
                            {activeCode === 'INW' && (
                              <>
                                <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {fmt(group.total_stage_quantity)}{' '}
                                  <span className="text-[10px] font-normal text-slate-400">pcs</span>
                                </td>
                                <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <PackageOpen className="w-3 h-3 text-emerald-600" />
                                    <span>{group.status || 'Ready for Inward'}</span>
                                  </span>
                                </td>
                                <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                                  <StatusBadge status={group.priority || 'Medium'} />
                                </td>
                              </>
                            )}

                            {/* DYE specific columns */}
                            {activeCode === 'DYE' && (
                              <>
                                <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {fmt(group.total_stage_quantity)}{' '}
                                  <span className="text-[10px] font-normal text-slate-400">pcs</span>
                                </td>
                                <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    <Droplets className="w-3 h-3 text-blue-600" />
                                    <span>{group.status || 'In Dyeing'}</span>
                                  </span>
                                </td>
                                <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                                  <StatusBadge status={group.priority || 'Medium'} />
                                </td>
                              </>
                            )}

                            {/* Generic production stages columns */}
                            {activeCode !== 'REQ' && activeCode !== 'PO' && activeCode !== 'INW' && activeCode !== 'DYE' && (
                              <>
                                <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {fmt(group.total_stage_quantity)}{' '}
                                  <span className="text-[10px] font-normal text-slate-400">pcs</span>
                                </td>
                                <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                                  <StatusBadge status={group.status || 'In Progress'} />
                                </td>
                                <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                                  <StatusBadge status={group.priority || 'Medium'} />
                                </td>
                              </>
                            )}

                            {/* Actions Column */}
                            <td className="px-3 py-2.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {activeCode === 'REQ' && (
                                  <button
                                    type="button"
                                    onClick={() => openDetail(targetUrl)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md shadow-2xs transition hover:text-brand-700"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                                    <span>View</span>
                                  </button>
                                )}

                                {activeCode === 'PO' && (
                                  <button
                                    type="button"
                                    onClick={() => openDetail(targetUrl)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md shadow-2xs transition hover:text-indigo-900"
                                  >
                                    <ShoppingCart className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span>View / Issue POs</span>
                                  </button>
                                )}

                                {activeCode === 'INW' && (
                                  <button
                                    type="button"
                                    onClick={() => openDetail(targetUrl)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md shadow-2xs transition hover:text-emerald-900"
                                  >
                                    <PackageOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Inward & Proof</span>
                                  </button>
                                )}

                                {activeCode === 'DYE' && (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openDetail(`/production/dyeing/${group.order_id}?create=true`)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-md shadow-2xs transition"
                                      title="Create Dyeing Order in full page"
                                    >
                                      <Plus className="w-3 h-3 stroke-[2.5]" />
                                      <span>Create Dyeing Order</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openDetail(targetUrl)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-md shadow-2xs transition hover:text-brand-900"
                                    >
                                      <Droplets className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                                      <span>Dyeing Stage</span>
                                    </button>
                                  </div>
                                )}

                                {activeCode === 'CUT' && (
                                  <button
                                    type="button"
                                    onClick={() => openDetail(targetUrl)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md shadow-2xs transition hover:text-indigo-900"
                                  >
                                    <Scissors className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span>Cutting Batches</span>
                                  </button>
                                )}

                                {activeCode === 'EMB' && (
                                  <button
                                    type="button"
                                    onClick={() => openDetail(targetUrl)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-md shadow-2xs transition hover:text-brand-900"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                                    <span>Embroidery Job Work</span>
                                  </button>
                                )}

                                {activeCode === 'STI' && (
                                  <button
                                    type="button"
                                    onClick={() => openDetail(targetUrl)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md shadow-2xs transition hover:text-teal-900"
                                  >
                                    <Activity className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                    <span>Stitching Workspace</span>
                                  </button>
                                )}

                                {activeCode === 'CHK' && (
                                  <button
                                    type="button"
                                    onClick={() => openDetail(targetUrl)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-md shadow-2xs transition hover:text-sky-900"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                    <span>Quality Checking</span>
                                  </button>
                                )}

                                {activeCode === 'PCK' && (
                                  <button
                                    type="button"
                                    onClick={() => openDetail(targetUrl)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md shadow-2xs transition hover:text-amber-900"
                                  >
                                    <Box className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>Box Packing</span>
                                  </button>
                                )}

                                {activeCode === 'COMP' && (
                                  <button
                                    type="button"
                                    onClick={() => openDetail(targetUrl)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md shadow-2xs transition hover:text-emerald-900"
                                  >
                                    <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Dispatch & Proof</span>
                                  </button>
                                )}

                                {activeCode !== 'REQ' && activeCode !== 'PO' && activeCode !== 'INW' && activeCode !== 'DYE' && activeCode !== 'CUT' && activeCode !== 'EMB' && activeCode !== 'STI' && activeCode !== 'CHK' && activeCode !== 'PCK' && activeCode !== 'COMP' && (
                                  <button
                                    type="button"
                                    onClick={() => openDetail(targetUrl)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-2xs transition hover:text-brand-700"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span>View Details</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openDetail(`/production/orders/${group.order_id}`)}
                                  title="Open full production order"
                                  className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View for Production Stage Orders */}
            <div className="md:hidden space-y-3">
              {filteredOrderGroups.map((group, idx) => {
                const lineItemsCount = group.items.length;
                const uniqueProducts = group.unique_products_count || lineItemsCount;

                let targetUrl = `/production/orders/${group.order_id}`;
                if (activeCode === 'REQ') targetUrl = `/production/requirement/${group.order_id}`;
                if (activeCode === 'PO') targetUrl = `/production/po/${group.order_id}`;
                if (activeCode === 'INW') targetUrl = `/production/inward/${group.order_id}`;
                if (activeCode === 'DYE') targetUrl = `/production/dyeing/${group.order_id}`;
                if (activeCode === 'CUT') targetUrl = `/production/cutting/${group.order_id}`;
                if (activeCode === 'EMB') targetUrl = `/production/embroidery/${group.order_id}`;
                if (activeCode === 'STI') targetUrl = `/production/stitching/${group.order_id}`;
                if (activeCode === 'CHK') targetUrl = `/production/checking/${group.order_id}`;
                if (activeCode === 'PCK') targetUrl = `/production/packing/${group.order_id}`;
                if (activeCode === 'COMP') targetUrl = `/production/completed/${group.order_id}`;

                const ordNum = group.order_number;
                const poCount = stagePOs.filter(po => {
                  if (po.production_order_id && String(po.production_order_id) === String(group.order_id)) return true;
                  if (po.production_order_number && po.production_order_number === ordNum) return true;
                  if (po.remarks && ordNum && po.remarks.includes(ordNum)) return true;
                  if (Array.isArray(po.items) && ordNum && po.items.some((it: any) => it.order_no === ordNum)) return true;
                  return false;
                }).length;

                return (
                  <div
                    key={group.order_number}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                            {group.order_number}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                        </div>
                        <h4 className="font-semibold text-slate-900 text-sm mt-1 leading-snug break-words">
                          {group.order_title || 'Garment Production Order'}
                        </h4>
                      </div>
                      <StatusBadge status={group.priority || 'Medium'} />
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <BuyerAvatar
                        buyer={{
                          id: group.customer_id,
                          code: group.customer_code,
                          name: group.customer_name,
                          avatar_style: group.customer_avatar_style,
                          avatar_seed: group.customer_avatar_seed,
                          avatar_config: group.customer_avatar_config,
                        }}
                        size="xs"
                        shape="circle"
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-medium text-slate-800 text-xs block truncate">
                          {group.customer_name || 'Direct Order'}
                        </span>
                        {group.customer_code && (
                          <span className="text-[10px] font-mono text-slate-400 block truncate">
                            {group.customer_code}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Delivery Date
                        </span>
                        <div className="flex items-center gap-1 text-slate-700 font-mono text-xs mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{group.target_delivery_date || '—'}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Quantity
                        </span>
                        <div className="text-slate-900 font-mono font-bold text-xs mt-0.5">
                          {fmt(activeCode === 'REQ' ? (group.total_order_quantity || group.total_stage_quantity) : group.total_stage_quantity)}{' '}
                          <span className="text-[10px] font-normal text-slate-500">pcs</span>
                        </div>
                      </div>

                      {activeCode === 'REQ' && (
                        <div className="col-span-2 pt-1.5 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">
                            {uniqueProducts} {uniqueProducts === 1 ? 'Product' : 'Products'} ({lineItemsCount} lines)
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                            <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Generated</span>
                          </span>
                        </div>
                      )}

                      {activeCode === 'PO' && (
                        <div className="col-span-2 pt-1.5 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">Purchase Orders:</span>
                          {poCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <ShoppingCart className="w-2.5 h-2.5 text-indigo-600" />
                              <span>{poCount} {poCount === 1 ? 'PO Issued' : 'POs Issued'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              0 POs Issued
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openDetail(targetUrl)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-2xs transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Open Stage View</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openDetail(`/production/orders/${group.order_id}`)}
                        title="Open full production order"
                        className="p-2 text-slate-500 hover:text-brand-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
        ) : (
          /* ========================================================================= */
          /* FLAT ITEMS VIEW: Flat tabular view of all order items                     */
          /* ========================================================================= */
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <DataTable
              data={items}
              columns={flatColumns}
              rowKey="id"
              onRowClick={r => openMoveModal(r)}
              actions={(r: StageItem) => (
                <div className="flex items-center gap-1.5">
                  {isQC ? (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedItem(r);
                        setQcForm({
                          passed: String(r.current_stage_quantity || r.total_quantity || 0),
                          rejected: '0',
                          rework: '0',
                          defect_reason: '',
                          remarks: '',
                          rework_stage_id: '7',
                        });
                        setQcOpen(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 transition font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> QC Check
                    </button>
                  ) : !isCompleted ? (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        openMoveModal(r);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition font-semibold"
                    >
                      Move <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-700 font-bold px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                      ✓ Done
                    </span>
                  )}
                </div>
              )}
            />
          </div>
        )}
      </div>

      {/* Move Stage Modal for Single Product */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={`Advance Stage — Order ${selectedItem?.order_number}`}
        subtitle={`${selectedItem?.product_name} | ${selectedItem?.color}${selectedItem?.size ? ` | Size ${selectedItem.size}` : ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={handleMove}
              icon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Advance to Stage
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <span className="text-slate-500">Current Stage:</span>{' '}
            <strong className="text-slate-800">{stageName}</strong>
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-slate-500">Available:</span>{' '}
            <strong className="text-brand-700 font-mono">
              {fmt(selectedItem?.current_stage_quantity || selectedItem?.total_quantity || 0)} pcs
            </strong>
          </div>

          <FormField
            as="select"
            label="Next Destination Stage"
            required
            value={moveForm.next_stage_id}
            onChange={e => setMoveForm(f => ({ ...f, next_stage_id: e.target.value }))}
          >
            <option value="">— Select next production stage —</option>
            {nextStages.map(s => (
              <option key={s.id} value={s.id}>
                {String(s.sequence_order).padStart(2, '0')}. {s.name}
              </option>
            ))}
          </FormField>

          <FormField
            label="Quantity to Move (Pieces)"
            type="number"
            required
            min="1"
            max={selectedItem?.current_stage_quantity || selectedItem?.total_quantity}
            value={moveForm.quantity}
            onChange={e => setMoveForm(f => ({ ...f, quantity: e.target.value }))}
            hint={`Maximum available: ${fmt(selectedItem?.current_stage_quantity || selectedItem?.total_quantity || 0)} pcs`}
          />

          <FormField
            as="textarea"
            label="Operator Notes & Challan Details"
            value={moveForm.notes}
            onChange={e => setMoveForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="e.g. Requirement confirmed, ready for purchase order..."
          />
        </div>
      </Modal>

      {/* Batch Advance Modal for Entire Order */}
      <Modal
        open={batchMoveOpen}
        onClose={() => setBatchMoveOpen(false)}
        title={`Advance Entire Order — ${selectedOrderForBatch?.order_number}`}
        subtitle={`Advance all ${selectedOrderForBatch?.items.length} products (${fmt(selectedOrderForBatch?.total_stage_quantity || 0)} pcs) to the next stage`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBatchMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={handleBatchMove}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Advance All Products
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="p-3 bg-brand-50 border border-brand-200 rounded-lg text-xs text-brand-800">
            <p className="font-semibold">
              You are about to advance all {selectedOrderForBatch?.items.length} product line items in this order.
            </p>
            <p className="text-[11px] text-brand-600 mt-1">
              Total quantity: <strong>{fmt(selectedOrderForBatch?.total_stage_quantity || 0)} pcs</strong> across all colors and sizes.
            </p>
          </div>

          <FormField
            as="select"
            label="Select Destination Stage for All Products"
            required
            value={batchMoveForm.next_stage_id}
            onChange={e => setBatchMoveForm(f => ({ ...f, next_stage_id: e.target.value }))}
          >
            <option value="">— Select destination stage —</option>
            {nextStages.map(s => (
              <option key={s.id} value={s.id}>
                {String(s.sequence_order).padStart(2, '0')}. {s.name}
              </option>
            ))}
          </FormField>

          <FormField
            as="textarea"
            label="Batch Notes"
            value={batchMoveForm.notes}
            onChange={e => setBatchMoveForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="e.g. Requirement gathering completed. Advancing order to PO/Cutting."
          />
        </div>
      </Modal>

      {/* QC / Checking Modal */}
      <Modal
        open={qcOpen}
        onClose={() => setQcOpen(false)}
        title={`08. Checking — Quality Inspection`}
        subtitle={`Order ${selectedItem?.order_number} | ${selectedItem?.product_name} | ${selectedItem?.color}${selectedItem?.size ? ` / Size ${selectedItem.size}` : ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQcOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={handleQC}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Confirm QC & Route
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="p-2.5 bg-slate-50 border rounded-lg text-xs">
            Inspection Batch: <strong>{fmt(selectedItem?.current_stage_quantity || selectedItem?.total_quantity || 0)} pcs</strong>
            {' • '}Passed pieces will automatically advance to <strong>Packing</strong>.
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField
              label="✓ Passed Qty"
              type="number"
              min="0"
              value={qcForm.passed}
              onChange={e => setQcForm(f => ({ ...f, passed: e.target.value }))}
            />
            <FormField
              label="↺ Rework Qty"
              type="number"
              min="0"
              value={qcForm.rework}
              onChange={e => setQcForm(f => ({ ...f, rework: e.target.value }))}
            />
            <FormField
              label="✗ Rejected Qty"
              type="number"
              min="0"
              value={qcForm.rejected}
              onChange={e => setQcForm(f => ({ ...f, rejected: e.target.value }))}
            />
          </div>

          {Number(qcForm.rework) > 0 && (
            <FormField
              as="select"
              label="Route Rework Back To Stage"
              value={qcForm.rework_stage_id}
              onChange={e => setQcForm(f => ({ ...f, rework_stage_id: e.target.value }))}
            >
              {stages
                .filter(s => !s.is_final_stage && !s.is_qc_stage)
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </FormField>
          )}

          {(Number(qcForm.rejected) > 0 || Number(qcForm.rework) > 0) && (
            <FormField
              label="Primary Defect Reason"
              value={qcForm.defect_reason}
              onChange={e => setQcForm(f => ({ ...f, defect_reason: e.target.value }))}
              placeholder="e.g. Skipped stitch, oil stain..."
            />
          )}

          <FormField
            as="textarea"
            label="Inspector Remarks"
            value={qcForm.remarks}
            onChange={e => setQcForm(f => ({ ...f, remarks: e.target.value }))}
            rows={2}
            placeholder="Inspection observations..."
          />
        </div>
      </Modal>
    </div>
  );
}
