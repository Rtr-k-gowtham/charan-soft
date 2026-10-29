// src/components/production/CategoryPOIssuer.tsx
// Category-Based Product & Raw Material Procurement with Vendor Matching, PO Issuance & In-Stage PO Management
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../lib/api';
import { OrderMaterialRequirementItem, Supplier, Category, PurchaseOrder, PurchaseOrderItem } from '../../types';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import StatusBadge from '../ui/StatusBadge';
import SearchableSelect, { SelectOption } from '../ui/SearchableSelect';
import { getCategoryVisual } from '../../pages/masters/Categories';
import UnorderedBOMItemsSection from '../purchase/UnorderedBOMItemsSection';
import {
  ShoppingCart,
  Building2,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
  AlertCircle,
  Tag,
  Clock,
  Printer,
  ChevronRight,
  RefreshCw,
  Pencil,
  Trash2,
  Plus,
  Save,
  Check,
  Send,
  FileText,
  DollarSign,
  PackageCheck,
  Eye,
  Ban,
  RotateCcw,
  AlertTriangle,
  MoreVertical,
  Package
} from 'lucide-react';

export interface CategorySupplierGroup {
  groupKey: string;
  categoryName: string;
  categoryId?: number;
  supplierId: number | null;
  supplierName: string;
  supplierCode?: string | null;
  materials: OrderMaterialRequirementItem[];
  itemCount: number;
  totalCost: number;
  matchingPOs: PurchaseOrder[];
  matchingPO?: PurchaseOrder | null;
  hasOrderedPO: boolean;
  hasDraftPO: boolean;
  draftPO?: PurchaseOrder | null;
  hasCancelledPO: boolean;
  cancelledPO?: PurchaseOrder | null;
}

interface Props {
  orderId: number | string;
  orderNumber: string;
  orderTitle?: string;
  targetDeliveryDate?: string;
  materials: OrderMaterialRequirementItem[];
  onPOCreated?: (poNumber: string) => void;
}

const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n || 0);

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function CategoryPOIssuer({
  orderId,
  orderNumber,
  orderTitle,
  targetDeliveryDate,
  materials,
  onPOCreated,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [existingPOs, setExistingPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected vendor per groupKey if unassigned
  const [selectedVendors, setSelectedVendors] = useState<Record<string, string>>({});
  // Issuing PO loading state per groupKey
  const [issuingPO, setIssuingPO] = useState<Record<string, boolean>>({});
  // Changing status of existing PO (e.g. Draft -> Ordered)
  const [updatingPOStatus, setUpdatingPOStatus] = useState<Record<number, boolean>>({});


  const [activeIssuerTab, setActiveIssuerTab] = useState<'GROUPS' | 'UNORDERED'>('GROUPS');
  const [pendingUnorderedCount, setPendingUnorderedCount] = useState<number>(0);
  const [activeMenu, setActiveMenu] = useState<{
    groupKey: string;
    top: number;
    left: number;
    group: CategorySupplierGroup;
  } | null>(null);

  const handleToggleMenu = (e: React.MouseEvent<HTMLButtonElement>, group: CategorySupplierGroup) => {
    e.stopPropagation();
    if (activeMenu?.groupKey === group.groupKey) {
      setActiveMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuWidth = 144; // w-36
      const menuHeight = group.hasOrderedPO ? 160 : 120;

      let top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight && rect.top > menuHeight) {
        top = rect.top - menuHeight - 4;
      }

      let left = rect.right - menuWidth;
      if (left < 10) left = 10;
      if (left + menuWidth > window.innerWidth - 10) {
        left = window.innerWidth - menuWidth - 10;
      }

      setActiveMenu({
        groupKey: group.groupKey,
        top,
        left,
        group,
      });
    }
  };

  useEffect(() => {
    if (!activeMenu) return;
    const handleClose = () => setActiveMenu(null);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenu(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenu]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Cancel PO state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelPO, setCancelPO] = useState<PurchaseOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const loadDependencies = async () => {
    setLoading(true);
    try {
      const [supRes, catRes, poRes] = await Promise.all([
        api.getSuppliers().catch(() => []),
        api.getCategories().catch(() => []),
        api.getPurchaseOrders().catch(() => []),
      ]);
      const supList = (supRes || []) as Supplier[];
      setSuppliers(supList);
      setCategories((catRes || []) as Category[]);

      const allPOs = (poRes || []) as PurchaseOrder[];
      // Filter POs linked to this production order
      const related = allPOs.filter(po => {
        if (po.production_order_id && String(po.production_order_id) === String(orderId)) return true;
        if (po.production_order_number && po.production_order_number === orderNumber) return true;
        if (po.remarks && po.remarks.includes(orderNumber)) return true;
        if (Array.isArray(po.items) && po.items.some((it: any) => it.order_no === orderNumber)) return true;
        return false;
      });
      setExistingPOs(related);
    } catch (err: unknown) {
      console.error('Failed to load PO issuance dependencies', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, [orderId, orderNumber]);

  useEffect(() => {
    if (orderId) {
      api.getUnorderedItems(orderId).then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        const pending = list.filter((it: any) => Number(it.remaining_unordered_quantity) > 0.001);
        setPendingUnorderedCount(pending.length);
      }).catch(() => {});
    }
  }, [orderId, existingPOs]);

  useEffect(() => {
    if (location.state?.successMessage) {
      setActionSuccess(location.state.successMessage);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => setActionSuccess(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);

  // For a given category, find matching suppliers
  const getCategorySuppliers = (categoryName: string) => {
    const cleanCat = categoryName.trim().toLowerCase();

    // 1. Match by supplier.category_name
    let matched = suppliers.filter(s => {
      const scName = (s.category_name || '').trim().toLowerCase();
      return scName === cleanCat || scName.includes(cleanCat) || cleanCat.includes(scName);
    });

    // 2. Match by category_id if name matching yielded empty
    if (matched.length === 0) {
      const catObj = categories.find(
        c => c.name.trim().toLowerCase() === cleanCat || cleanCat.includes(c.name.trim().toLowerCase())
      );
      if (catObj) {
        matched = suppliers.filter(s => String(s.category_id) === String(catObj.id));
      }
    }

    const unmatched = suppliers.filter(s => !matched.some(m => m.id === s.id));
    const allRanked = [...matched, ...unmatched];
    const hasExact = matched.length > 0;
    const available = hasExact ? matched : suppliers;

    return {
      suppliers: available,
      matchedSuppliers: matched,
      allSuppliers: allRanked,
      isExactMatch: hasExact,
      matchedCount: matched.length,
      totalAvailable: suppliers.length,
    };
  };

  // Group materials by (Category, Preferred Supplier)
  const categorySupplierGroups = useMemo<CategorySupplierGroup[]>(() => {
    const map = new Map<string, {
      categoryName: string;
      supplierId: number | null;
      supplierName: string;
      supplierCode?: string | null;
      materials: OrderMaterialRequirementItem[];
      totalCost: number;
    }>();

    (materials || []).forEach(m => {
      const cat = m.category || 'General';
      const supId = m.preferred_supplier_id ? Number(m.preferred_supplier_id) : null;
      const key = `${cat}__${supId ?? 'unassigned'}`;

      if (!map.has(key)) {
        let supName = m.preferred_supplier_name || '';
        let supCode = m.preferred_supplier_code || null;
        if (supId) {
          const found = suppliers.find(s => s.id === supId);
          if (found) {
            supName = found.name;
            supCode = found.code || supCode;
          }
        }
        if (!supName) {
          supName = supId ? `Supplier #${supId}` : 'Unassigned Supplier';
        }

        map.set(key, {
          categoryName: cat,
          supplierId: supId,
          supplierName: supName,
          supplierCode: supCode,
          materials: [],
          totalCost: 0,
        });
      }

      const grp = map.get(key)!;
      grp.materials.push(m);
      grp.totalCost += Number(m.total_required_qty || 0) * Number(m.unit_cost || 0);
    });

    const result: CategorySupplierGroup[] = [];
    map.forEach((grp, groupKey) => {
      const catLower = grp.categoryName.toLowerCase();
      const matchingPOs = existingPOs.filter(p => {
        const poCatLower = (p.category_name || '').toLowerCase();
        const catMatches = poCatLower === catLower || (p.remarks && p.remarks.toLowerCase().includes(catLower));
        let supMatches = false;
        if (grp.supplierId) {
          supMatches = Number(p.supplier_id) === Number(grp.supplierId);
        } else {
          // If group is unassigned, check temporary selected vendor if any
          const selSup = selectedVendors[groupKey];
          if (selSup) {
            supMatches = Number(p.supplier_id) === Number(selSup);
          } else {
            supMatches = true;
          }
        }
        return catMatches && supMatches;
      });

      const catObj = categories.find(
        c => c.name.trim().toLowerCase() === grp.categoryName.trim().toLowerCase()
      );
      const categoryId = catObj ? catObj.id : (grp.supplierId ? (suppliers.find(s => s.id === grp.supplierId)?.category_id || 1) : 1);

      const orderedPO = matchingPOs.find(p => (p.status || '').toLowerCase() === 'ordered') || null;
      const draftPO = matchingPOs.find(p => (p.status || '').toLowerCase() === 'draft') || null;
      const cancelledPO = matchingPOs.find(p => (p.status || '').toLowerCase() === 'cancelled') || null;
      const primaryPO = orderedPO || draftPO || cancelledPO || matchingPOs[0] || null;

      result.push({
        groupKey,
        categoryName: grp.categoryName,
        categoryId,
        supplierId: grp.supplierId,
        supplierName: grp.supplierName,
        supplierCode: grp.supplierCode,
        materials: grp.materials,
        itemCount: grp.materials.length,
        totalCost: grp.totalCost,
        matchingPOs,
        matchingPO: primaryPO,
        hasOrderedPO: Boolean(orderedPO),
        hasDraftPO: Boolean(draftPO),
        draftPO,
        hasCancelledPO: Boolean(cancelledPO),
        cancelledPO,
      });
    });

    return result;
  }, [materials, suppliers, categories, existingPOs, selectedVendors]);

  // Automatically select vendor: prefill selectedVendors map
  useEffect(() => {
    const next: Record<string, string> = { ...selectedVendors };
    let changed = false;

    categorySupplierGroups.forEach(grp => {
      if (!next[grp.groupKey]) {
        if (grp.supplierId) {
          next[grp.groupKey] = String(grp.supplierId);
          changed = true;
        } else if (grp.matchingPO && grp.matchingPO.supplier_id) {
          next[grp.groupKey] = String(grp.matchingPO.supplier_id);
          changed = true;
        } else {
          const { suppliers: catSups } = getCategorySuppliers(grp.categoryName);
          if (catSups.length > 0) {
            next[grp.groupKey] = String(catSups[0].id);
            changed = true;
          }
        }
      }
    });

    if (changed) {
      setSelectedVendors(next);
    }
  }, [suppliers, categories, categorySupplierGroups, existingPOs]);

  const handleOpenCreatePOPage = (group: CategorySupplierGroup) => {
    // If PO already exists, navigate directly to view it
    if (group.matchingPO) {
      navigate(`/purchase/orders/${group.matchingPO.id}`, {
        state: { from: location.pathname || `/production/po/${orderId}` }
      });
      return;
    }

    const effectiveSupId = group.supplierId || (selectedVendors[group.groupKey] ? Number(selectedVendors[group.groupKey]) : null);
    if (!effectiveSupId) {
      setActionError(`Please assign or select a supplier for ${group.categoryName} before creating a Purchase Order.`);
      return;
    }

    const selectedSup = suppliers.find(s => Number(s.id) === Number(effectiveSupId));
    const catObj = categories.find(
      c => c.name.trim().toLowerCase() === group.categoryName.trim().toLowerCase()
    );
    const catId = catObj ? catObj.id : (selectedSup?.category_id || group.categoryId || 1);

    navigate('/purchase/orders?create=true', {
      state: {
        production_order_id: Number(orderId),
        production_order_number: orderNumber,
        category_id: catId,
        category_name: group.categoryName,
        supplier_id: Number(effectiveSupId),
        target_delivery_date: targetDeliveryDate,
        remarks: `PO for ${group.categoryName} (${selectedSup?.name || group.supplierName}) - Production Order ${orderNumber}`,
        status: 'Ordered',
        materials: group.materials.map((m, idx) => ({
          material_id: m.material_id || undefined,
          material_code: m.material_code || undefined,
          item_description: m.name,
          description: m.name,
          accessory_name: m.name,
          size: m.size || undefined,
          model: m.model || undefined,
          length: m.length || undefined,
          thickness: m.thickness || undefined,
          uom: m.uom || 'KG',
          quantity: Number(m.total_required_qty) || 1,
          rate: Number(m.unit_cost) || 0,
          tax_percent: 5,
          order_no: orderNumber || `ORD-${idx + 1}`,
        })),
        from: location.pathname || `/production/po/${orderId}`,
      }
    });
  };

  // Action: View PO
  const handleViewPO = (group: CategorySupplierGroup) => {
    const targetPO = group.matchingPOs[0] || group.draftPO || group.cancelledPO;
    if (targetPO) {
      navigate(`/purchase/orders/${targetPO.id}`, {
        state: { from: location.pathname || `/production/po/${orderId}` }
      });
    } else {
      handleOpenCreatePOPage(group);
    }
  };

  // Action: Edit PO
  const handleEditPO = (group: CategorySupplierGroup) => {
    const targetPO = group.matchingPOs[0] || group.draftPO || group.cancelledPO;
    if (targetPO) {
      navigate(`/purchase/orders/${targetPO.id}/edit`, {
        state: { from: location.pathname || `/production/po/${orderId}` }
      });
    } else {
      handleOpenCreatePOPage(group);
    }
  };

  // Action: Issue PO
  const handleIssuePO = (group: CategorySupplierGroup) => {
    if (group.hasOrderedPO) {
      setActionSuccess(`PO ${group.matchingPOs[0]?.po_number || ''} is already ordered/issued.`);
      return;
    }
    if (group.hasDraftPO && group.draftPO) {
      handleMarkPOAsIssued(group.draftPO);
      return;
    }
    handleIssuePOForGroup(group);
  };

  // Create & Issue PO for a group
  const handleIssuePOForGroup = async (group: CategorySupplierGroup) => {
    const effectiveSupId = group.supplierId || (selectedVendors[group.groupKey] ? Number(selectedVendors[group.groupKey]) : null);
    if (!effectiveSupId) {
      setActionError(`Please select a supplier/vendor for ${group.categoryName}`);
      return;
    }

    if (!group.materials || group.materials.length === 0) {
      setActionError(`No valid material lines found for category "${group.categoryName}"`);
      return;
    }

    // Guard: prevent duplicate PO if one already exists for this category + supplier
    if (group.matchingPO) {
      setActionError(`A Purchase Order (${group.matchingPO.po_number}) already exists for "${group.categoryName}" and this supplier. Please view or edit the existing PO.`);
      return;
    }

    setActionError(null);
    setIssuingPO(prev => ({ ...prev, [group.groupKey]: true }));

    try {
      const selectedSup = suppliers.find(s => Number(s.id) === Number(effectiveSupId));
      const catObj = categories.find(
        c => c.name.trim().toLowerCase() === group.categoryName.trim().toLowerCase()
      );
      const catId = catObj ? catObj.id : (selectedSup?.category_id || group.categoryId || 1);

      const itemsPayload = group.materials.map((m, idx) => ({
        material_id: m.material_id || undefined,
        item_description: m.name,
        description: m.name,
        accessory_name: m.name,
        size: m.size || undefined,
        model: m.model || undefined,
        length: m.length || undefined,
        thickness: m.thickness || undefined,
        uom: m.uom || 'PCS',
        quantity: Number(m.total_required_qty) || 1,
        rate: Number(m.unit_cost) || 0,
        tax_percent: 5,
        order_no: orderNumber || `ORD-${idx + 1}`,
      }));

      const payload = {
        production_order_id: Number(orderId),
        supplier_id: Number(effectiveSupId),
        production_order_number: orderNumber,
        category_id: Number(catId),
        po_date: new Date().toISOString().split('T')[0],
        delivery_due_date: targetDeliveryDate || undefined,
        remarks: `PO issued from Production Order ${orderNumber} for ${group.categoryName} materials`,
        status: 'Ordered',
        items: itemsPayload,
      };

      const res = await api.createPurchaseOrder(payload);
      const createdPO = (res as any)?.data || res;
      const poNum = createdPO?.po_number || 'New PO';

      // Ensure order items are at least moved from Stage 01 (REQ) to Stage 02 (PO)
      try {
        const prodOrderRes = await api.getProductionOrder(Number(orderId));
        const fullOrder = (prodOrderRes as any)?.data || prodOrderRes;
        const stagesRes = await api.getProductionStages().catch(() => []);
        const stagesList = ((stagesRes as any)?.data || stagesRes) as any[];
        const poStage = stagesList.find((s: any) => s.code === 'PO' || (s.name && s.name.toLowerCase().includes('purchase order'))) || { id: 2 };
        if (fullOrder && Array.isArray(fullOrder.items)) {
          const itemsToMove = fullOrder.items.filter((it: any) => {
            const code = (it.stage_code || '').toUpperCase();
            return code === 'REQ' || code === 'INST' || Number(it.current_stage_id) === 1 || !it.current_stage_id;
          });
          if (itemsToMove.length > 0) {
            await Promise.all(
              itemsToMove.map((it: any) =>
                api.moveStage({
                  order_item_id: it.id,
                  to_stage_id: poStage.id,
                  quantity_moved: it.total_quantity || it.current_stage_quantity || 1,
                  remarks: `Moved to PO stage on PO issuance (${poNum})`,
                }).catch(() => null)
              )
            );
          }
        }
      } catch (stageErr) {
        console.warn('Auto-stage advance handled by backend', stageErr);
      }

      // Refresh existing POs from backend
      const updatedPOs = await api.getPurchaseOrders().catch(() => []);
      const rel = (updatedPOs as PurchaseOrder[]).filter(po => {
        if (po.production_order_id && String(po.production_order_id) === String(orderId)) return true;
        if (po.production_order_number && po.production_order_number === orderNumber) return true;
        if (po.remarks && po.remarks.includes(orderNumber)) return true;
        if (Array.isArray(po.items) && po.items.some((it: any) => it.order_no === orderNumber)) return true;
        return false;
      });
      setExistingPOs(rel);

      // Check if ALL required groups for this production order are now issued
      const allGroupsIssued = categorySupplierGroups.every(g => {
        const cLower = g.categoryName.toLowerCase();
        const sId = g.supplierId;
        return rel.some(p => {
          const isIssued = (p.status || '').toLowerCase() !== 'draft';
          if (!isIssued) return false;
          const catMatches = (p.category_name || '').toLowerCase() === cLower || (p.remarks && p.remarks.toLowerCase().includes(cLower));
          const supMatches = sId ? Number(p.supplier_id) === Number(sId) : true;
          return catMatches && supMatches;
        });
      });

      if (allGroupsIssued) {
        // Advance production order items to Stage 03: Inward
        try {
          const prodOrderRes = await api.getProductionOrder(Number(orderId));
          const fullOrder = (prodOrderRes as any)?.data || prodOrderRes;
          if (fullOrder && Array.isArray(fullOrder.items)) {
            await Promise.all(
              fullOrder.items.map((it: any) =>
                api.moveStage({
                  order_item_id: it.id,
                  to_stage_id: 3, // Inward
                  quantity_moved: it.total_quantity || it.current_stage_quantity || 1,
                  remarks: `All ${categorySupplierGroups.length} vendor/category POs issued — order advanced to Inward stage`,
                }).catch(() => null)
              )
            );
          }
        } catch (stageErr) {
          console.warn('Inward stage movement warning:', stageErr);
        }
        setActionSuccess(`Purchase Order ${poNum} successfully issued! All groups are issued — Order has advanced to Stage 03: Inward.`);
      } else {
        setActionSuccess(`Purchase Order ${poNum} successfully issued & locked for ${group.categoryName} (${selectedSup?.name || group.supplierName})!`);
      }

      if (onPOCreated) onPOCreated(poNum);
    } catch (err: unknown) {
      setActionError((err as Error).message || `Failed to create PO for ${group.categoryName}`);
    } finally {
      setIssuingPO(prev => ({ ...prev, [group.groupKey]: false }));
    }
  };

  // Convert Draft PO -> Issued / Ordered
  const handleMarkPOAsIssued = async (po: PurchaseOrder) => {
    setUpdatingPOStatus(prev => ({ ...prev, [po.id]: true }));
    setActionError(null);
    try {
      await api.updatePurchaseOrderStatus(po.id, 'Ordered');

      // Refresh POs
      const updatedPOs = await api.getPurchaseOrders().catch(() => []);
      const rel = (updatedPOs as PurchaseOrder[]).filter(p => {
        if (p.production_order_id && String(p.production_order_id) === String(orderId)) return true;
        if (p.production_order_number && p.production_order_number === orderNumber) return true;
        if (p.remarks && p.remarks.includes(orderNumber)) return true;
        if (Array.isArray(p.items) && p.items.some((it: any) => it.order_no === orderNumber)) return true;
        return false;
      });
      setExistingPOs(rel);

      // Check if ALL required groups are now issued
      const allGroupsIssued = categorySupplierGroups.every(g => {
        const cLower = g.categoryName.toLowerCase();
        const sId = g.supplierId;
        return rel.some(p => {
          const isIssued = (p.status || '').toLowerCase() !== 'draft';
          if (!isIssued) return false;
          const catMatches = (p.category_name || '').toLowerCase() === cLower || (p.remarks && p.remarks.toLowerCase().includes(cLower));
          const supMatches = sId ? Number(p.supplier_id) === Number(sId) : true;
          return catMatches && supMatches;
        });
      });

      if (allGroupsIssued) {
        if (orderId) {
          const ordRes = await api.getProductionOrder(Number(orderId));
          const ord = (ordRes as any)?.data || ordRes;
          if (ord && Array.isArray(ord.items)) {
            await Promise.all(
              ord.items.map((it: any) =>
                api.moveStage({
                  order_item_id: it.id,
                  to_stage_id: 3, // Stage 03: Inward
                  quantity_moved: it.total_quantity || it.current_stage_quantity || 1,
                  remarks: `PO ${po.po_number} issued — all category POs verified, advanced to Inward stage`,
                }).catch(() => { })
              )
            );
          }
        }
        setActionSuccess(`Purchase Order ${po.po_number} is officially Issued! All groups are issued — Order has moved to Stage 03: Inward.`);
      } else {
        setActionSuccess(`Purchase Order ${po.po_number} is officially Issued & Locked! (Remaining groups pending in Stage 02).`);
      }
    } catch (err: unknown) {
      setActionError((err as Error).message || `Failed to issue PO ${po.po_number}`);
    } finally {
      setUpdatingPOStatus(prev => ({ ...prev, [po.id]: false }));
    }
  };

  const handleOpenCancelModal = (po: PurchaseOrder) => {
    setCancelPO(po);
    setCancelReason('');
    setCancelError('');
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelPO) return;
    const trimmed = cancelReason.trim();
    if (!trimmed) {
      setCancelError('Please enter a required cancellation reason.');
      return;
    }
    setCancelling(true);
    setCancelError('');
    try {
      await api.cancelPurchaseOrder(cancelPO.id, trimmed);
      setActionSuccess(`Purchase Order ${cancelPO.po_number} cancelled.`);
      setCancelModalOpen(false);
      const updated = await api.getPurchaseOrders().catch(() => []);
      const ordNum = orderNumber || '';
      const rel = (updated as PurchaseOrder[]).filter(p => {
        if (p.production_order_id && String(p.production_order_id) === String(orderId)) return true;
        if (p.production_order_number && p.production_order_number === ordNum) return true;
        if (p.remarks && p.remarks.includes(ordNum)) return true;
        if (Array.isArray(p.items) && p.items.some((it: any) => it.order_no === ordNum)) return true;
        return false;
      });
      setExistingPOs(rel);
    } catch (err: unknown) {
      setCancelError((err as Error).message || 'Failed to cancel Purchase Order');
    } finally {
      setCancelling(false);
    }
  };



  return (
    <div className="bg-white rounded-xl border border-indigo-200/90 shadow-2xs overflow-hidden space-y-4">
      {/* Action Notification */}
      {actionSuccess && (
        <div className="mx-4 mt-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-950 flex items-center gap-2 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* CATEGORY & SUPPLIER-BASED MATERIAL PROCUREMENT & PO GENERATION */}
      <div className="p-4 sm:p-5 space-y-6">
        {/* TABLE 1: Category PO Groups */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Category PO Groups
              </h3>
              <span className="font-mono text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                {categorySupplierGroups.length}
              </span>
            </div>
            {pendingUnorderedCount > 0 && (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{pendingUnorderedCount} material line(s) pending order</span>
              </span>
            )}
          </div>

          {categorySupplierGroups.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
              No raw material requirements found for this order. Please verify BOM master configuration.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse table-fixed">
                  <thead className="bg-slate-100/80 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-2 w-[36px] text-center">#</th>
                      <th className="py-2.5 px-2.5 w-[115px]">PO Number</th>
                      <th className="py-2.5 px-2.5 w-[150px]">Material Category</th>
                      <th className="py-2.5 px-2.5 w-[180px]">Supplier</th>
                      <th className="py-2.5 px-2 text-center w-[75px]">Item Count</th>
                      <th className="py-2.5 px-3 min-w-[150px]">Required Materials</th>
                      <th className="py-2.5 px-2 text-center w-[110px]">PO Status</th>
                      <th className="py-2.5 px-2 text-center w-[75px]">Action</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-slate-100">
                  {categorySupplierGroups.map((group, idx) => {
                    const { matchedSuppliers, allSuppliers, isExactMatch, matchedCount } = getCategorySuppliers(group.categoryName);
                    const isSaving = !!issuingPO[group.groupKey];
                    const selectedSupId = selectedVendors[group.groupKey] || (group.supplierId ? String(group.supplierId) : '');

                    // Category visual matching with icon
                    const catObj = categories.find(
                      c => c.name.trim().toLowerCase() === group.categoryName.trim().toLowerCase()
                    );
                    const visual = getCategoryVisual(catObj || { name: group.categoryName });
                    const CatIcon = visual.Icon;

                    // Material names for clean display
                    const materialNames = group.materials.map(m => m.name).filter(Boolean);
                    const materialsText = materialNames.length > 0 ? materialNames.join(', ') : '—';

                    // Ensure selected supplier is available in dropdown even if not category-matched
                    const availableSups = [...allSuppliers];
                    if (selectedSupId) {
                      const curSup = suppliers.find(s => String(s.id) === String(selectedSupId));
                      if (curSup && !availableSups.some(s => String(s.id) === String(curSup.id))) {
                        availableSups.unshift(curSup);
                      }
                    }

                    const vendorOptions: SelectOption[] = availableSups.map(sup => {
                      const isMatched = matchedSuppliers.some(m => m.id === sup.id);
                      return {
                        value: String(sup.id),
                        label: `${sup.name}${sup.code ? ` (${sup.code})` : ''}`,
                        sublabel: [
                          isMatched ? 'Category Matched' : (sup.category_name || null),
                          sup.phone && sup.phone !== 'N/A' ? sup.phone : null,
                          sup.contact_person ? sup.contact_person : null,
                        ].filter(Boolean).join(' • '),
                      };
                    });

                    return (
                      <tr key={group.groupKey} className="hover:bg-slate-50/70 transition">
                        {/* 1. # */}
                        <td className="py-2.5 px-2 text-center font-mono text-slate-400 text-[11px] align-middle">
                          {idx + 1}
                        </td>

                        {/* 2. PO Number */}
                        <td className="py-2.5 px-2.5 align-middle">
                          {group.matchingPOs.length > 0 ? (
                            <div className="flex flex-col gap-1 items-start">
                              {group.matchingPOs.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => navigate(`/purchase/orders/${p.id}`, { state: { from: location.pathname || `/production/po/${orderId}` } })}
                                  className="font-mono font-bold text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 hover:text-brand-900 px-2 py-0.5 rounded border border-brand-200 shadow-2xs transition inline-flex items-center gap-1 text-left truncate max-w-full"
                                  title={`Click to view PO ${p.po_number}`}
                                >
                                  <span>{p.po_number}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* 3. Material Category */}
                        <td className="py-2.5 px-2.5 align-middle">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${visual.bg} ${visual.border} ${visual.color} shadow-2xs max-w-full truncate`}
                            title={group.categoryName}
                          >
                            <CatIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{group.categoryName}</span>
                          </span>
                        </td>

                        {/* 4. Supplier */}
                        <td className="py-2.5 px-2.5 align-middle">
                          {group.hasOrderedPO ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 truncate">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium truncate" title={group.matchingPOs[0]?.supplier_name || group.supplierName}>
                                {group.matchingPOs[0]?.supplier_name || group.supplierName}
                              </span>
                            </div>
                          ) : group.supplierId ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-800 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 truncate">
                              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="font-semibold truncate" title={`${group.supplierName}${group.supplierCode ? ` (${group.supplierCode})` : ''}`}>
                                {group.supplierName}
                                {group.supplierCode && <span className="text-slate-400 font-normal ml-1">({group.supplierCode})</span>}
                              </span>
                            </div>
                          ) : (
                            <div className="w-full">
                              <SearchableSelect
                                value={selectedSupId}
                                onChange={val =>
                                  setSelectedVendors(prev => ({
                                    ...prev,
                                    [group.groupKey]: val,
                                  }))
                                }
                                options={vendorOptions}
                                placeholder="-- Select Supplier --"
                                searchPlaceholder="Search vendor..."
                                disabled={group.hasOrderedPO}
                                clearable={!group.hasOrderedPO}
                              />
                              {isExactMatch && !group.hasOrderedPO && (
                                <span className="text-[9px] font-medium text-emerald-700 block mt-0.5 truncate">
                                  ✓ {matchedCount} {matchedCount === 1 ? 'matched supplier' : 'matched suppliers'}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 5. Item Count */}
                        <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap">
                          <span className="font-mono text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block whitespace-nowrap">
                            {group.itemCount} {group.itemCount === 1 ? 'item' : 'items'}
                          </span>
                        </td>

                        {/* 6. Required Materials / Summary */}
                        <td className="py-2.5 px-3 align-middle">
                          <p
                            className="text-slate-700 text-[11px] font-medium leading-relaxed break-words whitespace-normal"
                            title={materialsText}
                          >
                            {materialsText}
                          </p>
                        </td>

                        {/* 7. PO Status (Moved next to Required Materials) */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle w-[110px]">
                          {isSaving ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Issuing...
                            </span>
                          ) : group.hasOrderedPO ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                              title="Purchase Order issued & ordered"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ordered
                            </span>
                          ) : group.hasCancelledPO ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200"
                              title="Purchase Order has been cancelled"
                            >
                              <Ban className="w-3.5 h-3.5 text-rose-600" /> Cancelled
                            </span>
                          ) : group.hasDraftPO ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Draft
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Not Created
                            </span>
                          )}
                        </td>

                        {/* 8. Action (3-dot dropdown trigger) */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                          <button
                            type="button"
                            onClick={(e) => handleToggleMenu(e, group)}
                            className={`p-1.5 rounded-lg border transition shadow-2xs ${
                              activeMenu?.groupKey === group.groupKey
                                ? 'bg-slate-100 text-slate-900 border-slate-300 ring-2 ring-brand-500/20'
                                : 'bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-slate-200'
                            }`}
                            title="Action Options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards for Category Purchase Orders */}
            <div className="md:hidden space-y-3 p-3">
              {categorySupplierGroups.map((group, idx) => {
                const { matchedSuppliers, allSuppliers, isExactMatch, matchedCount } = getCategorySuppliers(group.categoryName);
                const isSaving = !!issuingPO[group.groupKey];
                const selectedSupId = selectedVendors[group.groupKey] || (group.supplierId ? String(group.supplierId) : '');

                const catObj = categories.find(
                  c => c.name.trim().toLowerCase() === group.categoryName.trim().toLowerCase()
                );
                const visual = getCategoryVisual(catObj || { name: group.categoryName });
                const CatIcon = visual.Icon;

                const materialNames = group.materials.map(m => m.name).filter(Boolean);
                const materialsText = materialNames.length > 0 ? materialNames.join(', ') : '—';

                const availableSups = [...allSuppliers];
                if (selectedSupId) {
                  const curSup = suppliers.find(s => String(s.id) === String(selectedSupId));
                  if (curSup && !availableSups.some(s => String(s.id) === String(curSup.id))) {
                    availableSups.unshift(curSup);
                  }
                }

                const vendorOptions: SelectOption[] = availableSups.map(sup => {
                  const isMatched = matchedSuppliers.some(m => m.id === sup.id);
                  return {
                    value: String(sup.id),
                    label: `${sup.name}${sup.code ? ` (${sup.code})` : ''}`,
                    sublabel: [
                      isMatched ? 'Category Matched' : (sup.category_name || null),
                      sup.phone && sup.phone !== 'N/A' ? sup.phone : null,
                      sup.contact_person ? sup.contact_person : null,
                    ].filter(Boolean).join(' • '),
                  };
                });

                return (
                  <div
                    key={`mob_${group.groupKey}`}
                    className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border ${visual.bg} ${visual.border} ${visual.color} shadow-2xs`}
                        >
                          <CatIcon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{group.categoryName}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                      </div>
                      <span className="font-mono text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                        {group.itemCount} {group.itemCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    {group.matchingPOs.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">PO:</span>
                        {group.matchingPOs.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => navigate(`/purchase/orders/${p.id}`, { state: { from: location.pathname || `/production/po/${orderId}` } })}
                            className="font-mono font-bold text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded border border-brand-200 shadow-2xs transition inline-flex items-center gap-1"
                          >
                            <span>{p.po_number}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Required Materials
                      </span>
                      <p className="text-slate-700 text-xs mt-0.5 leading-relaxed break-words">
                        {materialsText}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Supplier / Vendor
                      </span>
                      {group.hasOrderedPO ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 px-2.5 py-2 rounded-lg border border-slate-200">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium truncate" title={group.matchingPOs[0]?.supplier_name || group.supplierName}>
                            {group.matchingPOs[0]?.supplier_name || group.supplierName}
                          </span>
                        </div>
                      ) : group.supplierId ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-800 bg-slate-50 px-2.5 py-2 rounded-lg border border-slate-200">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="font-semibold truncate">
                            {group.supplierName}
                            {group.supplierCode && <span className="text-slate-400 font-normal ml-1">({group.supplierCode})</span>}
                          </span>
                        </div>
                      ) : (
                        <div className="w-full">
                          <SearchableSelect
                            value={selectedSupId}
                            onChange={val =>
                              setSelectedVendors(prev => ({
                                ...prev,
                                [group.groupKey]: val,
                              }))
                            }
                            options={vendorOptions}
                            placeholder="-- Select Supplier --"
                            searchPlaceholder="Search vendor..."
                            disabled={group.hasOrderedPO}
                            clearable={!group.hasOrderedPO}
                          />
                          {isExactMatch && !group.hasOrderedPO && (
                            <span className="text-[10px] font-medium text-emerald-700 block mt-1">
                              ✓ {matchedCount} {matchedCount === 1 ? 'matched supplier' : 'matched suppliers'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        {isSaving ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Issuing...
                          </span>
                        ) : group.hasOrderedPO ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ordered
                          </span>
                        ) : group.hasCancelledPO ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <Ban className="w-3.5 h-3.5 text-rose-600" /> Cancelled
                          </span>
                        ) : group.hasDraftPO ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Draft
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Not Created
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditPO(group)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md shadow-2xs transition"
                          title="Edit PO"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-600" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIssuePO(group)}
                          disabled={group.hasOrderedPO || isSaving}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md shadow-2xs transition disabled:opacity-40"
                          title="Issue PO"
                        >
                          <Send className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{group.hasOrderedPO ? 'Issued' : 'Issue PO'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleViewPO(group)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-md shadow-2xs transition"
                          title="View PO"
                        >
                          <Eye className="w-3.5 h-3.5 text-brand-600" />
                          <span>View PO</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* TABLE 2: Unordered Materials Tracking table comes in down as next table */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Unordered Materials Tracking
            </h3>
            {pendingUnorderedCount > 0 ? (
              <span className="font-mono text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingUnorderedCount} pending
              </span>
            ) : (
              <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                0 pending
              </span>
            )}
          </div>
        </div>

        <UnorderedBOMItemsSection
          productionOrderId={orderId}
          productionOrderNumber={orderNumber}
          hideMetrics={true}
          hideToolbar={true}
          onOrderMaterial={(item) => {
            navigate('/purchase/orders?create=true', {
              state: {
                production_order_id: orderId,
                production_order_number: orderNumber,
                supplier_id: item.supplier_id,
                target_delivery_date: targetDeliveryDate,
                from: location.pathname,
                materials: [{
                  material_id: item.material_id,
                  material_code: item.material_code,
                  item_description: item.material_name,
                  category: item.category_name,
                  uom: item.uom,
                  quantity: item.remaining_unordered_quantity,
                  rate: item.unit_cost || 0,
                  size: item.size,
                  model: item.model,
                  length: item.length,
                  thickness: item.thickness,
                  tax_percent: 5,
                }]
              }
            });
          }}
          onRefreshParent={() => {
            api.getPurchaseOrders().then((all: any) => {
              const list = Array.isArray(all) ? all : (all?.data || []);
              const rel = list.filter((p: any) => {
                if (p.production_order_id && String(p.production_order_id) === String(orderId)) return true;
                if (p.production_order_number && p.production_order_number === orderNumber) return true;
                return false;
              });
              setExistingPOs(rel);
            });
          }}
        />
      </div>
    </div>

      {/* 3-Dot Floating Action Menu (Portaled directly to body so table row never expands) */}
      {activeMenu &&
        createPortal(
          <div className="fixed inset-0 z-[99999]" onClick={() => setActiveMenu(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: `${activeMenu.top}px`,
                left: `${activeMenu.left}px`,
                width: '144px',
              }}
              className="bg-white border border-slate-200 rounded-xl shadow-xl py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95"
            >
              {/* Edit */}
              <button
                type="button"
                onClick={() => {
                  const grp = activeMenu.group;
                  setActiveMenu(null);
                  handleEditPO(grp);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-brand-700 font-medium transition text-left"
              >
                <Pencil className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit</span>
              </button>

              {/* Issue PO */}
              <button
                type="button"
                onClick={() => {
                  const grp = activeMenu.group;
                  setActiveMenu(null);
                  handleIssuePO(grp);
                }}
                disabled={activeMenu.group.hasOrderedPO || !!issuingPO[activeMenu.group.groupKey]}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition text-left ${
                  activeMenu.group.hasOrderedPO
                    ? 'text-slate-400 bg-slate-50/50 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-emerald-700'
                }`}
              >
                <Send className="w-3.5 h-3.5 text-emerald-600" />
                <span>{activeMenu.group.hasOrderedPO ? 'PO Issued' : 'Issue PO'}</span>
              </button>

              {/* View PO */}
              <button
                type="button"
                onClick={() => {
                  const grp = activeMenu.group;
                  setActiveMenu(null);
                  handleViewPO(grp);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-brand-700 font-medium transition text-left"
              >
                <Eye className="w-3.5 h-3.5 text-brand-600" />
                <span>View PO</span>
              </button>

              {activeMenu.group.hasOrderedPO && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const grp = activeMenu.group;
                      setActiveMenu(null);
                      handleOpenCancelModal(grp.matchingPOs[0]);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 font-medium transition text-left"
                  >
                    <Ban className="w-3.5 h-3.5 text-rose-500" />
                    <span>Cancel PO</span>
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* Cancel PO Confirmation Modal */}
      <Modal
        open={cancelModalOpen}
        onClose={() => { if (!cancelling) setCancelModalOpen(false); }}
        title="Cancel Purchase Order"
        subtitle={cancelPO ? `PO: ${cancelPO.po_number}` : ''}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="secondary"
              disabled={cancelling}
              onClick={() => setCancelModalOpen(false)}
            >
              Go Back
            </Button>
            <Button
              variant="danger"
              loading={cancelling}
              icon={<Ban className="w-4 h-4" />}
              onClick={handleConfirmCancel}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              Cancel Purchase Order
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-2 text-xs text-slate-600">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-950 leading-relaxed">
            <p className="font-semibold text-rose-950 mb-1">Confirm Purchase Order Cancellation</p>
            <p>
              Cancelling this PO will change its status from{' '}
              <strong className="text-emerald-800 font-semibold">{cancelPO?.status || 'Ordered'}</strong> to{' '}
              <strong className="text-rose-800 font-semibold">Cancelled</strong>.
            </p>
            <p className="mt-1 text-[11px] text-rose-700">
              It will be blocked from receiving new materials or payments until corrected and reissued.
            </p>
          </div>

          {cancelError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{cancelError}</span>
            </div>
          )}

          {cancelPO && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">PO Number:</span>
                <span className="font-bold text-slate-800">{cancelPO.po_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Supplier:</span>
                <span className="text-slate-800 font-sans">{cancelPO.supplier_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Current Status:</span>
                <span className="font-bold text-emerald-700 uppercase">{cancelPO.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Total Net Amount:</span>
                <span className="font-bold text-slate-800">{fmtCurrency(Number(cancelPO.net_amount || 0))}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Cancellation Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter a required cancellation reason (e.g. Specification changed, price adjustment, supplier mismatch)..."
              rows={3}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
