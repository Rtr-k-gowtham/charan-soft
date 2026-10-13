// src/pages/purchase/PurchaseOrders.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PurchaseOrder, Supplier, Category, PurchaseOrderItem, Material } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import SearchableSelect, { SelectOption } from '../../components/ui/SearchableSelect';
import Modal from '../../components/ui/Modal';
import DynamicPOTemplate from '../../components/purchase/DynamicPOTemplate';
import { printHtmlElement } from '../../lib/printUtils';
import { 
  Plus, 
  Eye, 
  Trash2, 
  RefreshCw, 
  ArrowLeft, 
  CreditCard, 
  ExternalLink,
  Receipt,
  Building2,
  Calendar,
  Layers,
  FileSpreadsheet,
  Printer,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Lock,
  Save
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n);
const fmtCur = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);

const UOM_OPTIONS: SelectOption[] = [
  { value: 'KG', label: 'KG (Kilograms)' },
  { value: 'MTR', label: 'MTR (Meters)' },
  { value: 'M', label: 'M (Meters)' },
  { value: 'PCS', label: 'PCS (Pieces)' },
  { value: 'ROLL', label: 'ROLL (Rolls)' },
  { value: 'CONE', label: 'CONE (Cones)' },
  { value: 'SET', label: 'SET (Sets)' },
  { value: 'BOX', label: 'BOX (Boxes)' },
];

// Dynamic column width and minimum dimension helper for category table columns (compact layout to prevent desktop overflow)
function getCategoryColumnWidth(field: any): { width: string; minWidth: string } {
  const name = (field.field_name || '').toLowerCase();
  if (name === 's_no' || name === 'sl_no') return { width: '38px', minWidth: '32px' };
  if (name === 'order_no') return { width: '80px', minWidth: '70px' };
  if (name.includes('code') || name === 'item_code' || name === 'material_code') return { width: '85px', minWidth: '72px' };
  if (name.includes('description') || name.includes('accessory')) return { width: '180px', minWidth: '150px' };
  if (name === 'material_id' || name === 'material') return { width: '170px', minWidth: '140px' };
  if (name === 'design' || name === 'spec') return { width: '75px', minWidth: '65px' };
  if (name === 'size') return { width: '65px', minWidth: '55px' };
  if (name === 'color') return { width: '75px', minWidth: '65px' };
  if (name === 'qty' || name === 'quantity') return { width: '70px', minWidth: '60px' };
  if (name === 'kgs' || name === 'weight' || name === 'weight_kg') return { width: '70px', minWidth: '60px' };
  if (name === 'uom') return { width: '65px', minWidth: '55px' };
  if (name === 'rate' || name.includes('price')) return { width: '75px', minWidth: '65px' };
  if (name === 'tax_percent') return { width: '55px', minWidth: '48px' };
  if (name === 'taxable_amount') return { width: '80px', minWidth: '70px' };
  if (name === 'tax_amount') return { width: '75px', minWidth: '65px' };
  if (name === 'net_amount') return { width: '85px', minWidth: '75px' };
  return { width: '75px', minWidth: '65px' };
}

function calcItem(item: any): any {
  const qty = Number(item.quantity !== undefined ? item.quantity : (item.qty || 0)) || 0;
  const rate = Number(item.rate || 0);
  const taxPct = Number(item.tax_percent !== undefined ? item.tax_percent : 5);
  const taxable = Math.round(qty * rate * 100) / 100;
  const taxAmt = Math.round(taxable * (taxPct / 100) * 100) / 100;
  const net = Math.round((taxable + taxAmt) * 100) / 100;
  const desc = item.item_description || item.description || item.accessory_name || '';
  return {
    ...item,
    quantity: qty,
    qty: qty,
    rate,
    tax_percent: taxPct,
    taxable_amount: taxable,
    tax_amount: taxAmt,
    net_amount: net,
    item_description: desc,
    description: desc,
  };
}

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [printPO, setPrintPO] = useState<PurchaseOrder | null>(null);
  const [templateData, setTemplateData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState('');

  // Approval state
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalSuccess, setApprovalSuccess] = useState('');
  const [approvalError, setApprovalError] = useState('');

  const canApprove = Boolean(
    user?.permissions?.includes('all') ||
    user?.permissions?.includes('po.approve') ||
    ['ADMIN', 'MANAGER', 'PURCHASE', 'PURCHASE_MGR', 'SYSTEM ADMINISTRATOR', 'OPERATIONS MANAGER'].includes(user?.role?.toUpperCase() || '') ||
    user?.role_name?.toUpperCase().includes('ADMIN') ||
    user?.role_name?.toUpperCase().includes('PURCHASE') ||
    user?.role_name?.toUpperCase().includes('MANAGER')
  );

  // Create form state
  const [form, setForm] = useState({ 
    supplier_id: '', 
    category_id: '', 
    po_date: new Date().toISOString().split('T')[0], 
    delivery_due_date: '', 
    remarks: '' 
  });
  
  const [items, setItems] = useState<any[]>([
    { order_no: 'ORD-001', item_description: '', quantity: 0, uom: 'KG', rate: 0, tax_percent: 5, taxable_amount: 0, tax_amount: 0, net_amount: 0 }
  ]);

  // Edit mode state (Task 2)
  const [editPO, setEditPO] = useState<PurchaseOrder | null>(null);
  const [editForm, setEditForm] = useState({ 
    supplier_id: '', 
    category_id: '', 
    po_date: new Date().toISOString().split('T')[0], 
    delivery_due_date: '', 
    remarks: '' 
  });
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editCategoryFieldsLoading, setEditCategoryFieldsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [poData, supData, catDataRaw, matData, tData] = await Promise.all([
        api.getPurchaseOrders().catch(() => []),
        api.getSuppliers().catch(() => []),
        api.getCategories().catch(() => []),
        api.getMaterials().catch(() => []),
        api.getPOTemplateSettings().catch(() => null),
      ]);
      setPOs((poData || []) as PurchaseOrder[]);
      const loadedSups = (supData || []) as Supplier[];
      setSuppliers(loadedSups);

      let loadedCats = (catDataRaw || []) as Category[];
      if ((!loadedCats || loadedCats.length === 0) && (tData as any)?.categories?.length) {
        loadedCats = (tData as any).categories;
      }
      setCategories(loadedCats);

      let loadedMats = (matData || []) as Material[];
      if (!loadedMats || loadedMats.length === 0) {
        loadedMats = [
          { id: 1, name: 'Cotton Fabric 100% Grey', code: 'MAT-FAB-001', category_id: 1, category_name: 'Fabric', uom: 'MTR', purchase_rate: 160, tax_percent: 5, current_stock: 500, min_stock_level: 100, status: 'active', spec: '40s Combed Cotton' },
          { id: 2, name: 'Cotton Satin 300TC', code: 'MAT-FAB-002', category_id: 1, category_name: 'Fabric', uom: 'MTR', purchase_rate: 295, tax_percent: 5, current_stock: 450, min_stock_level: 80, status: 'active', spec: '60s Satin Weave' },
          { id: 3, name: 'Linen Fabric Raw', code: 'MAT-FAB-003', category_id: 1, category_name: 'Fabric', uom: 'MTR', purchase_rate: 320, tax_percent: 5, current_stock: 200, min_stock_level: 50, status: 'active', spec: 'Pure Linen 180 GSM' },
          { id: 4, name: 'Canvas Heavy Fabric', code: 'MAT-FAB-004', category_id: 1, category_name: 'Fabric', uom: 'MTR', purchase_rate: 210, tax_percent: 5, current_stock: 300, min_stock_level: 60, status: 'active', spec: '10oz Duck Canvas' },
          { id: 5, name: 'Cotton Yarn 30s Cone', code: 'MAT-YRN-001', category_id: 1, category_name: 'Yarn', uom: 'CONE', purchase_rate: 240, tax_percent: 5, current_stock: 600, min_stock_level: 100, status: 'active', spec: '30s Carded Weaving Yarn' },
          { id: 6, name: 'Cotton Yarn 40s Cone', code: 'MAT-YRN-002', category_id: 1, category_name: 'Yarn', uom: 'CONE', purchase_rate: 280, tax_percent: 5, current_stock: 550, min_stock_level: 100, status: 'active', spec: '40s Combed Hosiery Yarn' },
          { id: 7, name: 'Sewing Thread 3 Ply', code: 'MAT-SEW-001', category_id: 8, category_name: 'Sewing', uom: 'CONE', purchase_rate: 65, tax_percent: 12, current_stock: 300, min_stock_level: 50, status: 'active', spec: 'Polyester Core Spun' },
          { id: 8, name: 'Overlock Thread', code: 'MAT-SEW-002', category_id: 8, category_name: 'Sewing', uom: 'CONE', purchase_rate: 55, tax_percent: 12, current_stock: 250, min_stock_level: 40, status: 'active', spec: 'Textured Polyester' },
          { id: 9, name: 'YKK Nylon Coil Zipper #5', code: 'MAT-ACC-001', category_id: 8, category_name: 'Accessory', uom: 'PCS', purchase_rate: 18.5, tax_percent: 18, current_stock: 1200, min_stock_level: 200, status: 'active', spec: '16 Inch Invisible Zipper' },
          { id: 10, name: 'Poly Horn Buttons 18L', code: 'MAT-ACC-002', category_id: 8, category_name: 'Accessory', uom: 'PCS', purchase_rate: 0.85, tax_percent: 12, current_stock: 5000, min_stock_level: 500, status: 'active', spec: '4-Hole Dyed To Match' },
          { id: 11, name: 'Polyester Fiber Fill', code: 'MAT-FIL-001', category_id: 5, category_name: 'Filling', uom: 'KG', purchase_rate: 115, tax_percent: 12, current_stock: 800, min_stock_level: 150, status: 'active', spec: 'Conjugated Siliconized Fiber' },
          { id: 12, name: 'Polyfill Microfiber', code: 'MAT-FIL-002', category_id: 5, category_name: 'Filling', uom: 'KG', purchase_rate: 145, tax_percent: 12, current_stock: 600, min_stock_level: 100, status: 'active', spec: '0.9D Super Soft Microfiber' },
          { id: 13, name: 'Woven Brand Main Label', code: 'MAT-PKG-001', category_id: 8, category_name: 'Labels', uom: 'PCS', purchase_rate: 2.2, tax_percent: 12, current_stock: 3000, min_stock_level: 500, status: 'active', spec: 'Damask High Density' },
          { id: 14, name: 'Wash Care Satin Label', code: 'MAT-PKG-002', category_id: 8, category_name: 'Labels', uom: 'PCS', purchase_rate: 1.5, tax_percent: 12, current_stock: 2500, min_stock_level: 500, status: 'active', spec: 'Printed Satin 30mm' },
        ];
      }
      setMaterials(loadedMats);
      if (tData) setTemplateData(tData);

      // Auto-prefill form with first supplier and first category if available
      setForm(prev => ({
        ...prev,
        supplier_id: prev.supplier_id || (loadedSups.length > 0 ? String(loadedSups[0].id) : ''),
        category_id: prev.category_id || (loadedCats.length > 0 ? String(loadedCats[0].id) : ''),
      }));
    } catch {
      setPOs([]);
      setSuppliers([]);
      setCategories([]);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Options for searchable selects
  const supplierOptions: SelectOption[] = useMemo(() => {
    return suppliers.map(s => ({
      value: s.id,
      label: s.name,
      sublabel: s.phone ? `${s.phone}` : undefined,
    }));
  }, [suppliers]);

  const categoryOptions: SelectOption[] = useMemo(() => {
    return categories.map(c => ({
      value: c.id,
      label: c.name,
      sublabel: c.code || undefined,
    }));
  }, [categories]);

  // Split materials based on selected PO category
  const { matchingMaterials, otherMaterials } = useMemo(() => {
    if (!form.category_id || categories.length === 0 || materials.length === 0) {
      return { matchingMaterials: materials, otherMaterials: [] };
    }
    const selCat = categories.find(c => String(c.id) === String(form.category_id));
    if (!selCat) return { matchingMaterials: materials, otherMaterials: [] };
    const catName = (selCat.name || '').toLowerCase();

    const matching: Material[] = [];
    const others: Material[] = [];

    materials.forEach(m => {
      const mCat = (m.category_name || '').toLowerCase();
      let isMatch = false;

      if (catName.includes('weaving') && !catName.includes('process')) {
        isMatch = mCat.includes('fabric') || mCat.includes('yarn') || m.uom === 'MTR' || m.uom === 'KG' || m.uom === 'CONE';
      } else if (catName.includes('fabric') || catName.includes('weaving') || catName.includes('dyeing') || catName.includes('jiggar')) {
        isMatch = mCat.includes('fabric') || mCat.includes('yarn') || m.uom === 'MTR' || m.uom === 'KG';
      } else if (catName.includes('accessory') || catName.includes('trim')) {
        isMatch = mCat.includes('accessory') || mCat.includes('sewing') || mCat.includes('trim') || mCat.includes('label') || mCat.includes('pack');
      } else if (catName.includes('yarn')) {
        isMatch = mCat.includes('yarn') || m.uom === 'CONE';
      } else if (catName.includes('filling')) {
        isMatch = mCat.includes('filling') || mCat.includes('fiber');
      } else if (catName.includes('stitching') || catName.includes('stiching')) {
        isMatch = mCat.includes('fabric') || mCat.includes('sewing') || mCat.includes('accessory');
      }

      if (isMatch) {
        matching.push(m);
      } else {
        others.push(m);
      }
    });

    if (matching.length === 0) {
      return { matchingMaterials: materials, otherMaterials: [] };
    }

    return { matchingMaterials: matching, otherMaterials: others };
  }, [materials, form.category_id, categories]);

  // Material options for searchable dropdown in line items with prominent Material ID & Code
  const materialOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [];
    matchingMaterials.forEach(m => {
      const idPrefix = m.code ? `[${m.code}] ` : `[#${m.id}] `;
      list.push({
        value: m.id,
        label: `${idPrefix}${m.name}`,
        sublabel: `Material ID: #${m.id} | Code: ${m.code || '—'} | ${m.uom} | ₹${m.purchase_rate}${m.spec ? ` | ${m.spec}` : ''}`,
        group: otherMaterials.length > 0 ? 'Recommended for Category' : 'Materials Catalog',
      });
    });
    otherMaterials.forEach(m => {
      const idPrefix = m.code ? `[${m.code}] ` : `[#${m.id}] `;
      list.push({
        value: m.id,
        label: `${idPrefix}${m.name}`,
        sublabel: `Material ID: #${m.id} | Code: ${m.code || '—'} | ${m.uom} | ₹${m.purchase_rate} | [${m.category_name || 'General'}]`,
        group: 'Other Materials',
      });
    });
    // Ensure any custom items currently in items or editItems are present in options
    [...items, ...editItems].forEach(it => {
      if (it.material_id && !list.some(opt => String(opt.value) === String(it.material_id))) {
        list.push({
          value: it.material_id,
          label: it.item_description || it.description || `Material #${it.material_id}`,
          sublabel: `Code: ${it.material_code || it.item_code || '—'} | ${it.uom || 'KG'}`,
          group: 'PO Materials',
        });
      }
    });
    return list;
  }, [matchingMaterials, otherMaterials, items, editItems]);

  const handleSelectMaterial = (idx: number, matId: string) => {
    if (!matId) {
      setItems(prev => {
        const next = [...prev];
        next[idx] = { 
          ...next[idx], 
          material_id: undefined,
          material_code: undefined,
          item_code: undefined,
          item_description: '',
          description: '',
          accessory_name: '',
        };
        return next;
      });
      return;
    }
    const selected = materials.find(m => String(m.id) === String(matId));
    if (!selected) return;

    setItems(prev => {
      const next = [...prev];
      const current = next[idx];
      const updated = calcItem({
        ...current,
        material_id: selected.id,
        material_code: selected.code,
        item_code: selected.code,
        code: selected.code,
        item_description: selected.name,
        description: selected.name,
        accessory_name: selected.name,
        uom: selected.uom || current.uom || 'KG',
        rate: Number(selected.purchase_rate) || 0,
        tax_percent: selected.tax_percent !== undefined ? Number(selected.tax_percent) : 5,
        spec: (selected as any).spec || current.spec || '',
      });
      next[idx] = updated;
      return next;
    });
  };

  const [categoryFieldsLoading, setCategoryFieldsLoading] = useState(false);

  // Fetch category fields directly from DB whenever category_id changes
  useEffect(() => {
    if (!form.category_id) return;
    const catId = Number(form.category_id);
    if (!catId || isNaN(catId)) return;

    let isMounted = true;
    setCategoryFieldsLoading(true);
    api.getCategory(catId)
      .then((catData: any) => {
        if (!isMounted || !catData) return;
        setCategories(prev => {
          const idx = prev.findIndex(c => c.id === catId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...catData };
            return next;
          }
          return [...prev, catData];
        });
      })
      .catch(err => {
        console.warn('Failed to fetch category fields from DB:', err);
      })
      .finally(() => {
        if (isMounted) setCategoryFieldsLoading(false);
      });

    return () => { isMounted = false; };
  }, [form.category_id]);

  // Load category fields for viewed PO dynamically from DB
  useEffect(() => {
    if (!viewPO || !viewPO.category_id) return;
    setApprovalSuccess('');
    setApprovalError('');
    const catId = Number(viewPO.category_id);
    const existing = categories.find(c => c.id === catId);
    if (existing && existing.fields && existing.fields.length > 0) return;
    api.getCategory(catId)
      .then((catData: any) => {
        if (catData && catData.fields) {
          setCategories(prev => prev.map(c => c.id === catId ? { ...c, ...catData } : c));
        }
      })
      .catch(err => console.warn('Error loading view PO category fields:', err));
  }, [viewPO?.id, viewPO?.category_id]);

  // Ensure full PO line items and relationships are loaded for viewed PO
  useEffect(() => {
    if (!viewPO || (viewPO.items && viewPO.items.length > 0)) return;
    api.getPurchaseOrder(viewPO.id)
      .then((fullPO: any) => {
        if (fullPO && fullPO.items) {
          setViewPO(prev => prev ? ({ ...prev, ...fullPO }) : fullPO);
        }
      })
      .catch(err => console.warn('Error loading full PO details:', err));
  }, [viewPO?.id]);

  const refreshCategoryColumnsFromDB = async () => {
    if (!form.category_id) return;
    const catId = Number(form.category_id);
    if (!catId || isNaN(catId)) return;
    setCategoryFieldsLoading(true);
    try {
      const catData: any = await api.getCategory(catId);
      if (catData) {
        setCategories(prev => prev.map(c => c.id === catId ? { ...c, ...catData } : c));
      }
    } catch (e) {
      console.warn('Error refreshing category fields from DB:', e);
    } finally {
      setCategoryFieldsLoading(false);
    }
  };

  const selectedCategoryObj = useMemo(() => {
    return categories.find(c => String(c.id) === String(form.category_id)) || categories[0];
  }, [categories, form.category_id]);

  // Active category fields loaded 100% dynamically from the database (category_fields table)
  // Hidden fields: order_no is autogenerated in background and hidden in frontend
  const activeCategoryFields = useMemo(() => {
    if (!selectedCategoryObj?.fields || !Array.isArray(selectedCategoryObj.fields)) {
      return [];
    }
    return selectedCategoryObj.fields
      .filter((f: any) => f.is_visible !== false && f.is_visible !== 0 && f.is_visible !== '0' && f.field_name !== 'order_no' && f.field_name !== 'order_number')
      .sort((a: any, b: any) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  }, [selectedCategoryObj]);

  // Category object and dynamic fields for the viewed PO
  const viewCategoryObj = useMemo(() => {
    if (!viewPO) return null;
    return categories.find(c => String(c.id) === String(viewPO.category_id)) || null;
  }, [categories, viewPO]);

  const viewCategoryFields = useMemo(() => {
    if (viewCategoryObj?.fields && Array.isArray(viewCategoryObj.fields) && viewCategoryObj.fields.length > 0) {
      return viewCategoryObj.fields
        .filter((f: any) => f.is_visible !== false && f.is_visible !== 0 && f.is_visible !== '0' && f.field_name !== 'order_no' && f.field_name !== 'order_number')
        .sort((a: any, b: any) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    }
    // Fallback standard columns if category fields not loaded yet (order_no is autogenerated and hidden)
    return [
      { field_name: 's_no', field_label: 'S.No', field_type: 'number' },
      { field_name: 'item_description', field_label: 'Description', field_type: 'text' },
      { field_name: 'design', field_label: 'Design', field_type: 'text' },
      { field_name: 'size', field_label: 'Size', field_type: 'text' },
      { field_name: 'color', field_label: 'Color', field_type: 'text' },
      { field_name: 'quantity', field_label: 'Qty', field_type: 'number' },
      { field_name: 'uom', field_label: 'UOM', field_type: 'select' },
      { field_name: 'rate', field_label: 'Rate', field_type: 'decimal' },
      { field_name: 'taxable_amount', field_label: 'Taxable Amount', field_type: 'calculated' },
      { field_name: 'tax_percent', field_label: 'TAX %', field_type: 'decimal' },
      { field_name: 'tax_amount', field_label: 'TAX Amount', field_type: 'calculated' },
      { field_name: 'net_amount', field_label: 'Net Amount', field_type: 'calculated' },
    ];
  }, [viewCategoryObj]);

  // Calculated totals for viewed PO
  const viewTotals = useMemo(() => {
    if (!viewPO) return { taxable: 0, tax: 0, net: 0 };
    const itms = viewPO.items || [];
    if (itms.length > 0) {
      const taxable = itms.reduce((s, i: any) => s + (Number(i.taxable_amount) || (Number(i.quantity !== undefined ? i.quantity : (i.qty || 0)) * Number(i.rate || 0)) || 0), 0);
      const tax = itms.reduce((s, i: any) => {
        const lineTax = Number(i.tax_amount);
        if (!isNaN(lineTax) && lineTax > 0) return s + lineTax;
        const lineTaxable = Number(i.taxable_amount) || (Number(i.quantity !== undefined ? i.quantity : (i.qty || 0)) * Number(i.rate || 0));
        return s + (lineTaxable * (Number(i.tax_percent ?? 5) / 100));
      }, 0);
      const net = itms.reduce((s, i: any) => s + (Number(i.net_amount) || 0), 0) || (taxable + tax);
      return { taxable, tax, net };
    }
    return {
      taxable: Number(viewPO.subtotal || 0),
      tax: Number(viewPO.tax_amount || 0),
      net: Number(viewPO.net_amount || 0),
    };
  }, [viewPO]);

  // Handle PO Approval (Draft -> Ordered)
  const handleApprovePO = async () => {
    if (!viewPO) return;
    setApproving(true);
    setApprovalError('');
    try {
      const res: any = await api.updatePurchaseOrderStatus(viewPO.id, 'Ordered');
      const updatedStatus = res?.status || 'Ordered';
      setViewPO(prev => prev ? ({ ...prev, status: updatedStatus }) : null);
      setApprovalSuccess(`Purchase Order ${viewPO.po_number} has been approved successfully! Status changed to ${updatedStatus}.`);
      setApproveModalOpen(false);
      load();
    } catch (err: unknown) {
      setApprovalError((err as Error).message || 'Failed to approve Purchase Order');
    } finally {
      setApproving(false);
    }
  };

  const createBlankItem = (targetIndex?: number) => {
    const idx = targetIndex !== undefined ? targetIndex : items.length;
    const row: Record<string, any> = {
      order_no: `ORD-${String(idx + 1).padStart(3, '0')}`,
      item_description: '',
      quantity: 0,
      uom: 'KG',
      rate: 0,
      tax_percent: 5,
      taxable_amount: 0,
      tax_amount: 0,
      net_amount: 0,
    };
    if (activeCategoryFields && activeCategoryFields.length > 0) {
      activeCategoryFields.forEach((f: any) => {
        if (f.default_value && row[f.field_name] === undefined) {
          row[f.field_name] = f.default_value;
        }
      });
    }
    return row;
  };

  const totals = {
    taxable: items.reduce((s, i) => s + (Number(i.taxable_amount) || 0), 0),
    tax: items.reduce((s, i) => s + (Number(i.tax_amount) || 0), 0),
    net: items.reduce((s, i) => s + (Number(i.net_amount) || 0), 0),
  };

  const handleItemChange = (idx: number, field: string, val: string | number | boolean) => {
    setItems(prev => {
      const next = [...prev];
      const updated: any = { ...next[idx], [field]: val };
      if (field === 'qty' || field === 'quantity') {
        updated.qty = Number(val) || 0;
        updated.quantity = Number(val) || 0;
      }
      if (field === 'description' || field === 'accessory_name') {
        updated.item_description = String(val);
      }
      next[idx] = calcItem(updated);
      return next;
    });
  };

  const handleOpenCreate = () => {
    setForm(prev => ({
      ...prev,
      supplier_id: prev.supplier_id || (suppliers.length > 0 ? String(suppliers[0].id) : ''),
      category_id: prev.category_id || (categories.length > 0 ? String(categories[0].id) : ''),
    }));
    setError('');
    setCreateOpen(true);
  };

  const handleCreate = async (_status?: string) => {
    // Graceful resolution: if user didn't pick, auto-fallback to first available supplier / category
    const finalSupplierId = form.supplier_id || (suppliers.length > 0 ? String(suppliers[0].id) : '');
    const finalCategoryId = form.category_id || (categories.length > 0 ? String(categories[0].id) : '');

    if (!finalSupplierId && suppliers.length === 0) { 
      setError('Please add at least one supplier in Masters → Suppliers first.'); 
      return; 
    }
    if (!finalCategoryId && categories.length === 0) { 
      setError('Please add at least one PO category in Masters → Categories first.'); 
      return; 
    }
    if (items.length === 0 || !items[0].item_description) { 
      setError('Please enter at least one item description'); 
      return; 
    }
    setSaving(true); 
    setError('');
    try {
      const preparedItems = items.map((it, idx) => ({
        ...it,
        order_no: it.order_no || `ORD-${String(idx + 1).padStart(3, '0')}`,
      }));
      // Per Task 3.B: All new POs are created with Draft status
      await api.createPurchaseOrder({
        ...form,
        supplier_id: finalSupplierId,
        category_id: finalCategoryId,
        status: 'Draft',
        items: preparedItems
      });
      setCreateOpen(false);
      setForm({ 
        supplier_id: suppliers.length > 0 ? String(suppliers[0].id) : '', 
        category_id: categories.length > 0 ? String(categories[0].id) : '', 
        po_date: new Date().toISOString().split('T')[0], 
        delivery_due_date: '', 
        remarks: '' 
      });
      setItems([{ order_no: 'ORD-001', item_description: '', quantity: 0, uom: 'KG', rate: 0, tax_percent: 5, taxable_amount: 0, tax_amount: 0, net_amount: 0 }]);
      load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to create PO');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // EDIT PO LOGIC (TASK 2)
  // -------------------------------------------------------------------------
  // Dynamic category columns loader for editForm
  useEffect(() => {
    if (!editForm.category_id) return;
    const catId = Number(editForm.category_id);
    if (!catId || isNaN(catId)) return;
    const existing = categories.find(c => c.id === catId);
    if (existing && existing.fields && existing.fields.length > 0) return;

    let isMounted = true;
    setEditCategoryFieldsLoading(true);
    api.getCategory(catId)
      .then((catData: any) => {
        if (!isMounted || !catData) return;
        setCategories(prev => {
          const idx = prev.findIndex(c => c.id === catId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...catData };
            return next;
          }
          return [...prev, catData];
        });
      })
      .catch(err => {
        console.warn('Failed to fetch category fields for edit form:', err);
      })
      .finally(() => {
        if (isMounted) setEditCategoryFieldsLoading(false);
      });

    return () => { isMounted = false; };
  }, [editForm.category_id]);

  const editSelectedCategoryObj = useMemo(() => {
    return categories.find(c => String(c.id) === String(editForm.category_id)) || categories[0];
  }, [categories, editForm.category_id]);

  const editActiveCategoryFields = useMemo(() => {
    if (!editSelectedCategoryObj?.fields || !Array.isArray(editSelectedCategoryObj.fields)) {
      return [];
    }
    return editSelectedCategoryObj.fields
      .filter((f: any) => f.is_visible !== false && f.is_visible !== 0 && f.is_visible !== '0' && f.field_name !== 'order_no' && f.field_name !== 'order_number')
      .sort((a: any, b: any) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  }, [editSelectedCategoryObj]);

  const editTotals = useMemo(() => {
    const taxable = editItems.reduce((s, i) => s + (Number(i.taxable_amount) || 0), 0);
    const tax = editItems.reduce((s, i) => s + (Number(i.tax_amount) || 0), 0);
    const net = editItems.reduce((s, i) => s + (Number(i.net_amount) || 0), 0);
    return { taxable, tax, net };
  }, [editItems]);

  const handleEditItemChange = (idx: number, field: string, val: string | number | boolean) => {
    setEditItems(prev => {
      const next = [...prev];
      const updated: any = { ...next[idx], [field]: val };
      if (field === 'qty' || field === 'quantity') {
        updated.qty = Number(val) || 0;
        updated.quantity = Number(val) || 0;
      }
      if (field === 'description' || field === 'accessory_name') {
        updated.item_description = String(val);
      }
      next[idx] = calcItem(updated);
      return next;
    });
  };

  const handleSelectEditMaterial = (idx: number, matId: string | number) => {
    if (!matId) {
      setEditItems(prev => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          material_id: undefined,
          material_code: undefined,
          item_code: undefined,
          item_description: '',
          description: '',
          accessory_name: '',
        };
        return next;
      });
      return;
    }
    const mat = materials.find(m => String(m.id) === String(matId));
    if (!mat) return;
    setEditItems(prev => {
      const next = [...prev];
      const current = next[idx] || {};
      const updated = {
        ...current,
        material_id: mat.id,
        material_code: mat.code,
        item_code: mat.code,
        code: mat.code,
        item_description: mat.name,
        description: mat.name,
        accessory_name: mat.name,
        uom: mat.uom || current.uom || 'KG',
        rate: mat.purchase_rate || current.rate || 0,
        tax_percent: mat.tax_percent !== undefined ? mat.tax_percent : (current.tax_percent ?? 5),
        spec: mat.spec || current.spec || '',
      };
      next[idx] = calcItem(updated);
      return next;
    });
  };

  const createBlankEditItem = (targetIndex?: number) => {
    const idx = targetIndex !== undefined ? targetIndex : editItems.length;
    const row: Record<string, any> = {
      order_no: `ORD-${String(idx + 1).padStart(3, '0')}`,
      item_description: '',
      quantity: 0,
      uom: 'KG',
      rate: 0,
      tax_percent: 5,
      taxable_amount: 0,
      tax_amount: 0,
      net_amount: 0,
    };
    if (editActiveCategoryFields && editActiveCategoryFields.length > 0) {
      editActiveCategoryFields.forEach((f: any) => {
        if (f.default_value && row[f.field_name] === undefined) {
          row[f.field_name] = f.default_value;
        }
      });
    }
    return row;
  };

  const refreshEditCategoryColumnsFromDB = async () => {
    if (!editForm.category_id) return;
    const catId = Number(editForm.category_id);
    if (!catId || isNaN(catId)) return;
    setEditCategoryFieldsLoading(true);
    try {
      const catData: any = await api.getCategory(catId);
      if (catData) {
        setCategories(prev => prev.map(c => c.id === catId ? { ...c, ...catData } : c));
      }
    } catch (e) {
      console.warn('Error refreshing category fields from DB:', e);
    } finally {
      setEditCategoryFieldsLoading(false);
    }
  };

  const handleOpenEdit = async (po: PurchaseOrder) => {
    const isDraft = (po.status || '').toLowerCase() === 'draft';
    if (!isDraft) {
      alert('This Purchase Order is already Ordered and locked against edits.');
      return;
    }
    setEditError('');
    setEditPO(po);
    setEditForm({
      supplier_id: String(po.supplier_id || ''),
      category_id: String(po.category_id || ''),
      po_date: po.po_date || new Date().toISOString().split('T')[0],
      delivery_due_date: po.delivery_due_date || '',
      remarks: po.remarks || ''
    });

    let poItems = po.items || [];
    if (!poItems.length) {
      try {
        const fullPO: any = await api.getPurchaseOrder(po.id);
        if (fullPO && fullPO.items) {
          poItems = fullPO.items;
        }
      } catch (err) {
        console.warn('Failed to load full PO items for edit:', err);
      }
    }

    if (poItems.length > 0) {
      setEditItems(poItems.map((it: any, idx: number) => {
        let matId = it.material_id;
        if (!matId && (it.item_description || it.description)) {
          const dName = (it.item_description || it.description || '').trim().toLowerCase();
          const found = materials.find(m => (m.name || '').toLowerCase() === dName || (m.code && (m.code || '').toLowerCase() === dName));
          if (found) matId = found.id;
        }
        return calcItem({
          ...it,
          material_id: matId,
          order_no: it.order_no || `ORD-${String(idx + 1).padStart(3, '0')}`,
        });
      }));
    } else {
      setEditItems([
        { order_no: 'ORD-001', item_description: '', quantity: 0, uom: 'KG', rate: 0, tax_percent: 5, taxable_amount: 0, tax_amount: 0, net_amount: 0 }
      ]);
    }

    const catId = Number(po.category_id);
    if (catId) {
      const existing = categories.find(c => c.id === catId);
      if (!existing || !existing.fields || existing.fields.length === 0) {
        setEditCategoryFieldsLoading(true);
        api.getCategory(catId)
          .then((catData: any) => {
            if (catData && catData.fields) {
              setCategories(prev => prev.map(c => c.id === catId ? { ...c, ...catData } : c));
            }
          })
          .catch(e => console.warn('Error loading category fields for edit:', e))
          .finally(() => setEditCategoryFieldsLoading(false));
      }
    }

    setViewPO(null);
    setCreateOpen(false);
  };

  const handleSaveEdit = async () => {
    if (!editPO) return;
    const finalSupplierId = editForm.supplier_id || (suppliers.length > 0 ? String(suppliers[0].id) : '');
    const finalCategoryId = editForm.category_id || (categories.length > 0 ? String(categories[0].id) : '');

    if (!finalSupplierId && suppliers.length === 0) {
      setEditError('Please select a supplier.');
      return;
    }
    if (!finalCategoryId && categories.length === 0) {
      setEditError('Please select a category.');
      return;
    }
    if (editItems.length === 0 || !editItems[0].item_description) {
      setEditError('Please enter at least one item description');
      return;
    }

    setEditSaving(true);
    setEditError('');
    try {
      const preparedEditItems = editItems.map((it, idx) => ({
        ...it,
        order_no: it.order_no || `ORD-${String(idx + 1).padStart(3, '0')}`,
      }));
      await api.updatePurchaseOrder(editPO.id, {
        supplier_id: finalSupplierId,
        category_id: finalCategoryId,
        po_date: editForm.po_date,
        delivery_due_date: editForm.delivery_due_date,
        remarks: editForm.remarks,
        items: preparedEditItems
      });

      await load();
      setEditPO(null);
    } catch (e: unknown) {
      setEditError((e as Error).message || 'Failed to update Purchase Order');
    } finally {
      setEditSaving(false);
    }
  };

  // PO List Columns with clear Status badges (Draft / Ordered)
  const columns = [
    { 
      key: 'po_number', 
      label: 'PO Number', 
      sortable: true, 
      render: (r: PurchaseOrder) => (
        <span className="font-semibold text-brand-700 hover:underline cursor-pointer" onClick={() => setViewPO(r)}>
          {r.po_number}
        </span>
      ) 
    },
    { key: 'supplier_name', label: 'Supplier', sortable: true },
    { 
      key: 'category_name', 
      label: 'Category', 
      sortable: true, 
      render: (r: PurchaseOrder) => <span className="text-slate-600 text-xs font-medium">{r.category_name}</span> 
    },
    { key: 'po_date', label: 'PO Date', sortable: true },
    { 
      key: 'delivery_due_date', 
      label: 'Delivery Due', 
      sortable: true, 
      render: (r: PurchaseOrder) => <span className="text-slate-500">{r.delivery_due_date || '—'}</span> 
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r: PurchaseOrder) => {
        const isDraft = (r.status || '').toLowerCase() === 'draft';
        return isDraft ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Draft
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Ordered
          </span>
        );
      }
    },
    {
      key: 'items_count',
      label: 'Items',
      render: (r: PurchaseOrder) => (
        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
          {r.items?.length || 0} items
        </span>
      )
    },
    { 
      key: 'subtotal', 
      label: 'Taxable Amt', 
      sortable: true, 
      render: (r: PurchaseOrder) => <span className="font-mono text-slate-600">{fmtCur(r.subtotal)}</span> 
    },
    { 
      key: 'tax_amount', 
      label: 'Tax Amt', 
      sortable: true, 
      render: (r: PurchaseOrder) => <span className="font-mono text-slate-600">{fmtCur(r.tax_amount)}</span> 
    },
    { 
      key: 'net_amount', 
      label: 'Net Total', 
      sortable: true, 
      render: (r: PurchaseOrder) => <span className="font-mono font-bold text-slate-900">{fmtCur(r.net_amount)}</span> 
    },
  ];

  // =========================================================================
  // FULL PAGE: CREATE PURCHASE ORDER VIEW
  // =========================================================================
  if (createOpen) {
    return (
      <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
        {/* Top Sticky Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCreateOpen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Orders
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">Create Purchase Order</h1>
              <p className="text-[11px] text-slate-500">Full-page order creation with searchable dropdowns & material catalog</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleCreate('Draft')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700" />
              Save as Draft
            </button>
            <Button loading={saving} onClick={() => handleCreate('Draft')} icon={<Plus className="w-4 h-4" />}>
              Create PO (Draft)
            </Button>
          </div>
        </div>

        {/* Full Page Body */}
        <div className="max-w-7xl w-full mx-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Section 1: Order Details */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-brand-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Order Header & Supplier</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SearchableSelect
                label="Supplier"
                required
                value={form.supplier_id}
                onChange={val => setForm(f => ({ ...f, supplier_id: val }))}
                options={supplierOptions}
                placeholder="— Select Supplier with Search —"
                searchPlaceholder="Search supplier name or phone..."
              />

              <SearchableSelect
                label="PO Category"
                required
                value={form.category_id}
                onChange={val => setForm(f => ({ ...f, category_id: val }))}
                options={categoryOptions}
                placeholder="— Select Category with Search —"
                searchPlaceholder="Search category..."
              />

              <FormField
                label="PO Date"
                type="date"
                required
                value={form.po_date}
                onChange={e => setForm(f => ({ ...f, po_date: e.target.value }))}
              />

              <FormField
                label="Delivery Due Date"
                type="date"
                value={form.delivery_due_date}
                onChange={e => setForm(f => ({ ...f, delivery_due_date: e.target.value }))}
              />
            </div>

            <div>
              <FormField
                as="textarea"
                label="Remarks / Terms & Notes"
                value={form.remarks}
                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                placeholder="Enter any payment terms, transport notes or instructions..."
                rows={2}
              />
            </div>
          </div>

          {/* Section 2: Dynamic Category-Based Line Items Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-brand-600 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">PO Line Items</h2>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200 rounded">
                      {selectedCategoryObj?.name || 'Category'}: {activeCategoryFields.length} DB Columns Loaded
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Table columns and inputs are fetched dynamically from the database (<code>category_fields</code>) for: <strong className="text-slate-600">{selectedCategoryObj?.name || 'Selected Category'}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setItems(prev => [...prev, createBlankItem(prev.length)])}
                  className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Item Row
                </button>
              </div>
            </div>

            {activeCategoryFields.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border-t border-slate-200">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-700">No Columns Configured in Database for this Category</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Category &quot;{selectedCategoryObj?.name || 'Selected'}&quot; has no fields registered in the <code>category_fields</code> table.
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={refreshCategoryColumnsFromDB}
                    disabled={categoryFieldsLoading}
                    className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${categoryFieldsLoading ? 'animate-spin' : ''}`} />
                    Re-fetch Columns from DB
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/masters/categories')}
                    className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Configure in Masters → Categories
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse table-auto">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold">
                      {activeCategoryFields.map((f: any) => {
                        const isNum = f.field_type === 'number' || f.field_type === 'decimal' || f.field_name.includes('amount') || f.field_name.includes('rate') || f.field_name.includes('qty');
                        const isCenter = f.field_name === 's_no' || f.field_name === 'sl_no' || f.field_name === 'uom';
                        const colDim = getCategoryColumnWidth(f);
                        return (
                          <th
                            key={f.field_name}
                            style={{ width: colDim.width, minWidth: colDim.minWidth }}
                            className={`py-2 px-1.5 whitespace-nowrap ${isCenter ? 'text-center' : isNum ? 'text-right' : 'text-left'}`}
                          >
                            <div className={`flex items-center gap-1 ${isCenter ? 'justify-center' : isNum ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-700">{f.field_label}</span>
                              {f.is_required ? <span className="text-red-500 font-bold">*</span> : null}
                            </div>
                          </th>
                        );
                      })}
                      <th style={{ width: '40px', minWidth: '35px' }} className="py-2 px-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                  {items.map((it: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      {activeCategoryFields.map((f: any) => {
                        const key = f.field_name;
                        const colDim = getCategoryColumnWidth(f);

                        // 1. S.No
                        if (key === 's_no') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5 text-center font-mono text-slate-400 font-bold text-xs">
                              {idx + 1}
                            </td>
                          );
                        }

                        // 2. Order No / Order No.
                        if (key === 'order_no') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="text"
                                value={it.order_no || ''}
                                onChange={e => handleItemChange(idx, 'order_no', e.target.value)}
                                placeholder="Order #"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 3. Material ID / Material dedicated selector column
                        if (key === 'material_id' || key === 'material') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <SearchableSelect
                                value={it.material_id || ''}
                                onChange={val => handleSelectMaterial(idx, val)}
                                options={materialOptions}
                                placeholder="— Pick Material ID —"
                                searchPlaceholder="Search Material ID, Code (e.g. MAT-) or Name..."
                              />
                            </td>
                          );
                        }

                        // 3.1 Item Code / Material Code
                        if (key === 'item_code' || key === 'material_code' || key === 'code') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="text"
                                value={it[key] || it.material_code || it.item_code || it.code || ''}
                                onChange={e => handleItemChange(idx, key, e.target.value)}
                                placeholder="Code / ID"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 3.2 Description / Item Description / Accessory Name / Item Name (Single dropdown description only)
                        if (key === 'description' || key === 'item_description' || key === 'accessory_name' || key === 'item' || key === 'item_name') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <SearchableSelect
                                value={it.material_id || ''}
                                onChange={val => handleSelectMaterial(idx, val)}
                                options={materialOptions}
                                placeholder={`— Select ${f.field_label} —`}
                                searchPlaceholder="Search Material ID, Code or Name..."
                              />
                            </td>
                          );
                        }

                        // 4. Design
                        if (key === 'design') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="text"
                                value={it.design || ''}
                                onChange={e => handleItemChange(idx, 'design', e.target.value)}
                                placeholder="Design"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 5. Size
                        if (key === 'size') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="text"
                                value={it.size || ''}
                                onChange={e => handleItemChange(idx, 'size', e.target.value)}
                                placeholder="Size"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 6. Color
                        if (key === 'color') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="text"
                                value={it.color || ''}
                                onChange={e => handleItemChange(idx, 'color', e.target.value)}
                                placeholder="Color"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 7. Spec
                        if (key === 'spec') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="text"
                                value={it.spec || ''}
                                onChange={e => handleItemChange(idx, 'spec', e.target.value)}
                                placeholder="Spec"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 8. Qty / Quantity
                        if (key === 'qty' || key === 'quantity') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="number"
                                value={it.quantity === 0 && !it.qty ? '' : (it.quantity ?? it.qty ?? '')}
                                onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                                placeholder="0"
                                min="0"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono font-bold bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 9. KGS / Weight
                        if (key === 'kgs' || key === 'weight') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="number"
                                value={it[key] ?? ''}
                                onChange={e => handleItemChange(idx, key, e.target.value)}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 10. UOM / Uom
                        if (key === 'uom') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <select
                                value={it.uom || 'MTR'}
                                onChange={e => handleItemChange(idx, 'uom', e.target.value)}
                                className="w-full h-7 px-1 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white font-medium shadow-sm"
                              >
                                {['MTR', 'KG', 'PCS', 'ROLL', 'CONE', 'SET', 'BOX', 'Gross'].map(u => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                            </td>
                          );
                        }

                        // 11. Rate
                        if (key === 'rate') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="number"
                                value={it.rate === 0 ? '' : it.rate}
                                onChange={e => handleItemChange(idx, 'rate', e.target.value)}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono font-semibold bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 12. Taxable Amount
                        if (key === 'taxable_amount') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5 text-right font-mono text-slate-700 font-semibold whitespace-nowrap text-xs">
                              {fmtCur(it.taxable_amount || 0)}
                            </td>
                          );
                        }

                        // 13. TAX %
                        if (key === 'tax_percent') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="number"
                                value={it.tax_percent ?? 5}
                                onChange={e => handleItemChange(idx, 'tax_percent', e.target.value)}
                                min="0"
                                max="100"
                                step="0.5"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 14. TAX Amount
                        if (key === 'tax_amount') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5 text-right font-mono text-slate-600 whitespace-nowrap text-xs">
                              {fmtCur(it.tax_amount || 0)}
                            </td>
                          );
                        }

                        // 15. Net Amount
                        if (key === 'net_amount') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-xs">
                              {fmtCur(it.net_amount || 0)}
                            </td>
                          );
                        }

                        // Fallback for any other custom column added online in DB or Masters
                        return (
                          <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                            {f.field_type === 'number' || f.field_type === 'decimal' ? (
                              <input
                                type="number"
                                step={f.field_type === 'decimal' ? '0.01' : '1'}
                                value={it[key] ?? ''}
                                onChange={e => handleItemChange(idx, key, e.target.value)}
                                placeholder={f.field_label}
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono bg-white shadow-sm"
                              />
                            ) : f.field_type === 'date' ? (
                              <input
                                type="date"
                                value={it[key] || ''}
                                onChange={e => handleItemChange(idx, key, e.target.value)}
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            ) : f.field_type === 'checkbox' ? (
                              <div className="flex justify-center items-center h-7">
                                <input
                                  type="checkbox"
                                  checked={!!it[key]}
                                  onChange={e => handleItemChange(idx, key, e.target.checked)}
                                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                                />
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={it[key] || ''}
                                onChange={e => handleItemChange(idx, key, e.target.value)}
                                placeholder={f.field_label}
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm font-medium"
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* Delete */}
                      <td style={{ width: '40px', minWidth: '35px' }} className="py-1.5 px-1 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                            title="Remove line item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  {(() => {
                    const taxableColIdx = activeCategoryFields.findIndex((f: any) => f.field_name === 'taxable_amount');
                    const hasTaxPct = activeCategoryFields.some((f: any) => f.field_name === 'tax_percent');
                    const hasTaxAmt = activeCategoryFields.some((f: any) => f.field_name === 'tax_amount');
                    const hasNetAmt = activeCategoryFields.some((f: any) => f.field_name === 'net_amount');
                    const leadSpan = taxableColIdx !== -1 ? taxableColIdx : Math.max(1, activeCategoryFields.length - (hasNetAmt ? 1 : 0));
                    return (
                      <tr className="font-semibold text-slate-700">
                        <td colSpan={leadSpan} className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px] text-slate-500 font-bold">
                          Calculated Order Totals:
                        </td>
                        {taxableColIdx !== -1 && (
                          <td className="py-2.5 px-2 text-right font-mono text-slate-800 text-xs font-bold whitespace-nowrap">
                            {fmtCur(totals.taxable)}
                          </td>
                        )}
                        {hasTaxPct && <td />}
                        {hasTaxAmt && (
                          <td className="py-2.5 px-2 text-right font-mono text-slate-600 font-bold whitespace-nowrap text-xs">
                            {fmtCur(totals.tax)}
                          </td>
                        )}
                        {hasNetAmt && (
                          <td className="py-2.5 px-2 text-right font-mono font-bold text-brand-700 text-sm whitespace-nowrap">
                            {fmtCur(totals.net)}
                          </td>
                        )}
                        <td />
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
            )}
          </div>

          {/* Section 3: Bottom Summary & Submit Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="text-xs text-slate-500">
              Total {items.length} item line{items.length !== 1 ? 's' : ''} • Tax Amount: <span className="font-mono font-semibold text-slate-700">{fmtCur(totals.tax)}</span>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleCreate('Draft')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700" />
                Save as Draft
              </button>
              <Button loading={saving} onClick={() => handleCreate('Draft')} icon={<Plus className="w-4 h-4" />}>
                Create PO (Draft) ({fmtCur(totals.net)})
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // FULL PAGE: EDIT PURCHASE ORDER VIEW (TASK 2)
  // =========================================================================
  if (editPO) {
    return (
      <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
        {/* Top Sticky Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setEditPO(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Cancel & Back to Orders
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-800 leading-tight">Edit Purchase Order: {editPO.po_number}</h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Draft (Editable)
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Edit supplier, category, dates, remarks, and line items • PO number is preserved</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setEditPO(null)}>
              Cancel
            </Button>
            <Button loading={editSaving} onClick={handleSaveEdit} icon={<Save className="w-4 h-4" />}>
              Save Changes ({fmtCur(editTotals.net)})
            </Button>
          </div>
        </div>

        {/* Full Page Body */}
        <div className="max-w-7xl w-full mx-auto p-6 space-y-6">
          {editError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{editError}</span>
              </div>
              <button
                onClick={() => setEditError('')}
                className="text-xs text-red-600 hover:text-red-800 font-bold px-2 py-0.5"
              >
                ✕
              </button>
            </div>
          )}

          {/* Section 1: Order Header & Supplier */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-brand-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Order Header & Supplier</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">PO Number (Locked)</label>
                <div className="w-full min-h-[34px] px-2.5 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-md text-slate-800 font-mono font-bold flex items-center gap-1.5 cursor-not-allowed">
                  <Lock className="w-3 h-3 text-slate-400" />
                  {editPO.po_number}
                </div>
              </div>

              <SearchableSelect
                label="Supplier"
                required
                value={editForm.supplier_id}
                onChange={val => setEditForm(f => ({ ...f, supplier_id: val }))}
                options={supplierOptions}
                placeholder="— Select Supplier —"
                searchPlaceholder="Search supplier name or phone..."
              />

              <SearchableSelect
                label="PO Category"
                required
                value={editForm.category_id}
                onChange={val => setEditForm(f => ({ ...f, category_id: val }))}
                options={categoryOptions}
                placeholder="— Select Category —"
                searchPlaceholder="Search category..."
              />

              <FormField
                label="PO Date"
                type="date"
                required
                value={editForm.po_date}
                onChange={e => setEditForm(f => ({ ...f, po_date: e.target.value }))}
              />

              <FormField
                label="Delivery Due Date"
                type="date"
                value={editForm.delivery_due_date}
                onChange={e => setEditForm(f => ({ ...f, delivery_due_date: e.target.value }))}
              />
            </div>

            <div>
              <FormField
                as="textarea"
                label="Remarks / Terms & Notes"
                value={editForm.remarks}
                onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))}
                placeholder="Enter any payment terms, transport notes or instructions..."
                rows={2}
              />
            </div>
          </div>

          {/* Section 2: Dynamic Category-Based Line Items Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-brand-600 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">PO Line Items</h2>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200 rounded">
                      {editSelectedCategoryObj?.name || 'Category'}: {editActiveCategoryFields.length} DB Columns Loaded
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Table columns and inputs are fetched dynamically from the database (<code>category_fields</code>) for: <strong className="text-slate-600">{editSelectedCategoryObj?.name || 'Selected Category'}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setEditItems(prev => [...prev, createBlankEditItem(prev.length)])}
                  className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Item Row
                </button>
              </div>
            </div>

            {editActiveCategoryFields.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border-t border-slate-200">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-700">No Columns Configured in Database for this Category</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Category &quot;{editSelectedCategoryObj?.name || 'Selected'}&quot; has no fields registered in the <code>category_fields</code> table.
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={refreshEditCategoryColumnsFromDB}
                    disabled={editCategoryFieldsLoading}
                    className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${editCategoryFieldsLoading ? 'animate-spin' : ''}`} />
                    Re-fetch Columns from DB
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse table-auto">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold">
                      {editActiveCategoryFields.map((f: any) => {
                        const isNum = f.field_type === 'number' || f.field_type === 'decimal' || f.field_name.includes('amount') || f.field_name.includes('rate') || f.field_name.includes('qty');
                        const isCenter = f.field_name === 's_no' || f.field_name === 'sl_no' || f.field_name === 'uom';
                        const colDim = getCategoryColumnWidth(f);
                        return (
                          <th
                            key={f.field_name}
                            style={{ width: colDim.width, minWidth: colDim.minWidth }}
                            className={`py-2 px-1.5 whitespace-nowrap ${isCenter ? 'text-center' : isNum ? 'text-right' : 'text-left'}`}
                          >
                            <div className={`flex items-center gap-1 ${isCenter ? 'justify-center' : isNum ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-700">{f.field_label}</span>
                              {f.is_required ? <span className="text-red-500 font-bold">*</span> : null}
                            </div>
                          </th>
                        );
                      })}
                      <th style={{ width: '40px', minWidth: '35px' }} className="py-2 px-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                  {editItems.map((it: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      {editActiveCategoryFields.map((f: any) => {
                        const key = f.field_name;
                        const colDim = getCategoryColumnWidth(f);

                        // 1. S.No
                        if (key === 's_no') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5 text-center font-mono text-slate-400 font-bold text-xs">
                              {idx + 1}
                            </td>
                          );
                        }

                        // 2. Order No
                        if (key === 'order_no') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="text"
                                value={it.order_no || ''}
                                onChange={e => handleEditItemChange(idx, 'order_no', e.target.value)}
                                placeholder="Order #"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 3. Material ID
                        if (key === 'material_id' || key === 'material') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <SearchableSelect
                                value={it.material_id || ''}
                                onChange={val => handleSelectEditMaterial(idx, val)}
                                options={materialOptions}
                                placeholder="— Pick Material ID —"
                                searchPlaceholder="Search Material ID, Code or Name..."
                              />
                            </td>
                          );
                        }

                        // 3.1 Item Code / Material Code
                        if (key === 'item_code' || key === 'material_code' || key === 'code') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="text"
                                value={it[key] || it.material_code || it.item_code || it.code || ''}
                                onChange={e => handleEditItemChange(idx, key, e.target.value)}
                                placeholder="Code / ID"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 3.2 Description / Item Description / Accessory Name (Single dropdown description only)
                        if (key === 'description' || key === 'item_description' || key === 'accessory_name' || key === 'item' || key === 'item_name') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <SearchableSelect
                                value={it.material_id || ''}
                                onChange={val => handleSelectEditMaterial(idx, val)}
                                options={materialOptions}
                                placeholder={`— Select ${f.field_label} —`}
                                searchPlaceholder="Search Material ID, Code or Name..."
                              />
                            </td>
                          );
                        }

                        // 4. Design
                        if (key === 'design') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="text"
                                value={it.design || ''}
                                onChange={e => handleEditItemChange(idx, 'design', e.target.value)}
                                placeholder="Design"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 5. Size
                        if (key === 'size') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="text"
                                value={it.size || ''}
                                onChange={e => handleEditItemChange(idx, 'size', e.target.value)}
                                placeholder="Size"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 6. Color
                        if (key === 'color') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="text"
                                value={it.color || ''}
                                onChange={e => handleEditItemChange(idx, 'color', e.target.value)}
                                placeholder="Color"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 7. Spec
                        if (key === 'spec') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="text"
                                value={it.spec || ''}
                                onChange={e => handleEditItemChange(idx, 'spec', e.target.value)}
                                placeholder="Spec"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 8. Qty / Quantity
                        if (key === 'qty' || key === 'quantity') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="number"
                                value={it.quantity === 0 && !it.qty ? '' : (it.quantity ?? it.qty ?? '')}
                                onChange={e => handleEditItemChange(idx, 'quantity', e.target.value)}
                                placeholder="0"
                                min="0"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono font-bold bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 9. KGS / Weight
                        if (key === 'kgs' || key === 'weight') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="number"
                                value={it[key] ?? ''}
                                onChange={e => handleEditItemChange(idx, key, e.target.value)}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 10. UOM
                        if (key === 'uom') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <select
                                value={it.uom || 'MTR'}
                                onChange={e => handleEditItemChange(idx, 'uom', e.target.value)}
                                className="w-full h-7 px-1 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white font-medium shadow-sm"
                              >
                                {['MTR', 'KG', 'PCS', 'ROLL', 'CONE', 'SET', 'BOX', 'Gross'].map(u => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                            </td>
                          );
                        }

                        // 11. Rate
                        if (key === 'rate') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="number"
                                value={it.rate === 0 ? '' : it.rate}
                                onChange={e => handleEditItemChange(idx, 'rate', e.target.value)}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono font-semibold bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 12. Taxable Amount
                        if (key === 'taxable_amount') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5 text-right font-mono text-slate-700 font-semibold whitespace-nowrap text-xs">
                              {fmtCur(it.taxable_amount || 0)}
                            </td>
                          );
                        }

                        // 13. TAX %
                        if (key === 'tax_percent') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                              <input
                                type="number"
                                value={it.tax_percent ?? 5}
                                onChange={e => handleEditItemChange(idx, 'tax_percent', e.target.value)}
                                min="0"
                                max="100"
                                step="0.5"
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 14. TAX Amount
                        if (key === 'tax_amount') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5 text-right font-mono text-slate-600 whitespace-nowrap text-xs">
                              {fmtCur(it.tax_amount || 0)}
                            </td>
                          );
                        }

                        // 15. Net Amount
                        if (key === 'net_amount') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-xs">
                              {fmtCur(it.net_amount || 0)}
                            </td>
                          );
                        }

                        // Custom dynamic field fallback
                        return (
                          <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-1.5 px-1.5">
                            {f.field_type === 'number' || f.field_type === 'decimal' ? (
                              <input
                                type="number"
                                step={f.field_type === 'decimal' ? '0.01' : '1'}
                                value={it[key] ?? ''}
                                onChange={e => handleEditItemChange(idx, key, e.target.value)}
                                placeholder={f.field_label}
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono bg-white shadow-sm"
                              />
                            ) : f.field_type === 'date' ? (
                              <input
                                type="date"
                                value={it[key] || ''}
                                onChange={e => handleEditItemChange(idx, key, e.target.value)}
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            ) : f.field_type === 'checkbox' ? (
                              <div className="flex justify-center items-center h-7">
                                <input
                                  type="checkbox"
                                  checked={!!it[key]}
                                  onChange={e => handleEditItemChange(idx, key, e.target.checked)}
                                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                                />
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={it[key] || ''}
                                onChange={e => handleEditItemChange(idx, key, e.target.value)}
                                placeholder={f.field_label}
                                className="w-full h-7 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm font-medium"
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* Delete */}
                      <td style={{ width: '40px', minWidth: '35px' }} className="py-1.5 px-1 text-center">
                        {editItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setEditItems(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                            title="Remove line item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  {(() => {
                    const taxableColIdx = editActiveCategoryFields.findIndex((f: any) => f.field_name === 'taxable_amount');
                    const hasNetAmt = editActiveCategoryFields.some((f: any) => f.field_name === 'net_amount');
                    const leadSpan = taxableColIdx !== -1 ? taxableColIdx : Math.max(1, editActiveCategoryFields.length - (hasNetAmt ? 1 : 0));
                    return (
                      <tr className="font-semibold text-slate-700">
                        <td colSpan={leadSpan} className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px] text-slate-500 font-bold">
                          Calculated Order Totals:
                        </td>
                        {taxableColIdx !== -1 && (
                          <td className="py-2.5 px-2 text-right font-mono text-slate-800 text-xs font-bold whitespace-nowrap">
                            {fmtCur(editTotals.taxable)}
                          </td>
                        )}
                        {editActiveCategoryFields.map((f: any, idx: number) => {
                          if (idx <= leadSpan && taxableColIdx !== -1) return null;
                          if (f.field_name === 'tax_amount') {
                            return (
                              <td key="foot_tax" className="py-2.5 px-2 text-right font-mono text-slate-800 text-xs font-bold whitespace-nowrap">
                                {fmtCur(editTotals.tax)}
                              </td>
                            );
                          }
                          if (f.field_name === 'net_amount') {
                            return (
                              <td key="foot_net" className="py-2.5 px-2 text-right font-mono text-brand-700 text-xs font-extrabold whitespace-nowrap">
                                {fmtCur(editTotals.net)}
                              </td>
                            );
                          }
                          return <td key={`foot_empty_${f.field_name}`} />;
                        })}
                        <td />
                      </tr>
                    );
                  })()}
                </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Bottom Summary & Submit Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="text-xs text-slate-500">
              Total {editItems.length} item line{editItems.length !== 1 ? 's' : ''} • Tax Amount: <span className="font-mono font-semibold text-slate-700">{fmtCur(editTotals.tax)}</span>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => setEditPO(null)}>
                Cancel
              </Button>
              <Button loading={editSaving} onClick={handleSaveEdit} icon={<Save className="w-4 h-4" />}>
                Save Changes ({fmtCur(editTotals.net)})
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // FULL PAGE: READ-ONLY PO DETAIL PAGE WITH APPROVAL
  // =========================================================================
  if (viewPO) {
    return (
      <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
        {/* Top Sticky Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setViewPO(null); setApprovalSuccess(''); setApprovalError(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Orders
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-800 leading-tight">Purchase Order: {viewPO.po_number}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  (viewPO.status || '').toLowerCase() === 'draft'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  {(viewPO.status || '').toLowerCase() === 'draft' ? 'Draft' : 'Ordered'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Read-only detail view • Supplier: {viewPO.supplier_name || '—'} • Category: {viewPO.category_name || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => { setViewPO(null); setApprovalSuccess(''); setApprovalError(''); }}>
              Back to Orders
            </Button>
            <Button
              variant="secondary"
              icon={<Printer className="w-3.5 h-3.5" />}
              onClick={() => setPrintPO(viewPO)}
            >
              Print / Save A4 PDF
            </Button>
            {(viewPO.status || '').toLowerCase() === 'draft' && (
              <Button
                variant="secondary"
                icon={<Pencil className="w-3.5 h-3.5" />}
                onClick={() => handleOpenEdit(viewPO)}
              >
                Edit PO
              </Button>
            )}
            {(viewPO.status || '').toLowerCase() === 'draft' && canApprove && (
              <Button
                icon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => setApproveModalOpen(true)}
              >
                Approve PO
              </Button>
            )}
          </div>
        </div>

        {/* Full Page Body */}
        <div className="max-w-7xl w-full mx-auto p-6 space-y-6">
          {/* Success Banner */}
          {approvalSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{approvalSuccess}</span>
              </div>
              <button
                onClick={() => setApprovalSuccess('')}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-bold px-2 py-0.5"
              >
                ✕
              </button>
            </div>
          )}

          {/* Error Banner */}
          {approvalError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{approvalError}</span>
              </div>
              <button
                onClick={() => setApprovalError('')}
                className="text-xs text-red-600 hover:text-red-800 font-bold px-2 py-0.5"
              >
                ✕
              </button>
            </div>
          )}

          {/* Status Context Banner */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
            (viewPO.status || '').toLowerCase() === 'draft'
              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                (viewPO.status || '').toLowerCase() === 'draft' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`} />
              <div>
                <span className="font-bold text-xs uppercase tracking-wide">
                  {(viewPO.status || '').toLowerCase() === 'draft' ? 'Status: Draft' : 'Status: Ordered'}
                </span>
                <p className="text-[11px] mt-0.5 text-slate-600">
                  {(viewPO.status || '').toLowerCase() === 'draft'
                    ? 'This Purchase Order is currently a Draft. Material receipts and supplier payments cannot be processed until approved.'
                    : 'This Purchase Order has been confirmed and ordered. It is active for Material Receipts and Supplier Payments.'}
                </p>
              </div>
            </div>
            {(viewPO.status || '').toLowerCase() === 'draft' && canApprove && (
              <Button
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                onClick={() => setApproveModalOpen(true)}
              >
                Approve PO
              </Button>
            )}
          </div>

          {/* Section 1: Order Header & Supplier */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-brand-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Order Header & Supplier</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">Supplier</label>
                <div className="w-full min-h-[34px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 font-semibold cursor-default">
                  {viewPO.supplier_name || '—'}
                  {(viewPO as any).supplier_code && (
                    <span className="text-[10px] text-slate-500 font-mono ml-1.5">({(viewPO as any).supplier_code})</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">PO Category</label>
                <div className="w-full min-h-[34px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 font-semibold cursor-default">
                  {viewPO.category_name || '—'}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">PO Date</label>
                <div className="w-full min-h-[34px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 font-mono cursor-default">
                  {viewPO.po_date || '—'}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">Delivery Due Date</label>
                <div className="w-full min-h-[34px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 font-mono cursor-default">
                  {viewPO.delivery_due_date || '—'}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-600">Remarks / Terms & Notes</label>
              <div className="w-full min-h-[48px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 cursor-default whitespace-pre-line">
                {viewPO.remarks || '—'}
              </div>
            </div>
          </div>

          {/* Section 2: Dynamic Category-Based Line Items Table (Read-Only) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-brand-600 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">PO Line Items</h2>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200 rounded">
                      {viewPO.category_name || 'Category'}: {viewCategoryFields.length} DB Columns Loaded
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Read-only saved line items and dynamic database values for: <strong className="text-slate-600">{viewPO.category_name || 'Purchase Order'}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold">
                    {viewCategoryFields.map((f: any) => {
                      const isNum = f.field_type === 'number' || f.field_type === 'decimal' || f.field_name.includes('amount') || f.field_name.includes('rate') || f.field_name.includes('qty');
                      const isCenter = f.field_name === 's_no' || f.field_name === 'sl_no' || f.field_name === 'uom';
                      const colDim = getCategoryColumnWidth(f);
                      return (
                        <th
                          key={f.field_name}
                          style={{ width: colDim.width, minWidth: colDim.minWidth }}
                          className={`py-2 px-1.5 whitespace-nowrap ${isCenter ? 'text-center' : isNum ? 'text-right' : 'text-left'}`}
                        >
                          <div className={`flex items-center gap-1 ${isCenter ? 'justify-center' : isNum ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-700">{f.field_label}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!viewPO.items || viewPO.items.length === 0) ? (
                    <tr>
                      <td colSpan={viewCategoryFields.length} className="py-8 text-center text-slate-400">
                        No line items recorded for this purchase order.
                      </td>
                    </tr>
                  ) : (
                    viewPO.items.map((it: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        {viewCategoryFields.map((f: any) => {
                          const key = f.field_name;
                          const colDim = getCategoryColumnWidth(f);

                          // 1. S.No
                          if (key === 's_no' || key === 'sl_no') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-center font-mono text-slate-400 font-bold text-xs">
                                {idx + 1}
                              </td>
                            );
                          }

                          // 2. Order No
                          if (key === 'order_no') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 font-mono text-xs text-slate-700">
                                {it.order_no || '—'}
                              </td>
                            );
                          }

                          // 3. Item Code / Material ID
                          if (key === 'material_id' || key === 'material' || key === 'item_code' || key === 'material_code' || key === 'code') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 font-mono text-xs text-slate-600">
                                {it.item_code || it.material_code || it.code || it[key] || '—'}
                              </td>
                            );
                          }

                          // 4. Description / Item Description / Accessory Name
                          if (key === 'description' || key === 'item_description' || key === 'accessory_name' || key === 'item' || key === 'item_name') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 font-medium text-slate-800 text-xs">
                                {it.item_description || it.description || it.accessory_name || it[key] || '—'}
                              </td>
                            );
                          }

                          // 5. Design
                          if (key === 'design') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-xs text-slate-700">
                                {it.design || '—'}
                              </td>
                            );
                          }

                          // 6. Size
                          if (key === 'size') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-xs text-slate-700">
                                {it.size || '—'}
                              </td>
                            );
                          }

                          // 7. Color
                          if (key === 'color') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-xs text-slate-700">
                                {it.color || '—'}
                              </td>
                            );
                          }

                          // 8. Spec
                          if (key === 'spec') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-xs text-slate-700">
                                {it.spec || '—'}
                              </td>
                            );
                          }

                          // 9. Qty / Quantity
                          if (key === 'qty' || key === 'quantity') {
                            const qVal = it.quantity !== undefined ? it.quantity : (it.qty ?? 0);
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-right font-mono font-bold text-slate-900 text-xs">
                                {fmt(Number(qVal) || 0)}
                              </td>
                            );
                          }

                          // 10. KGS / Weight
                          if (key === 'kgs' || key === 'weight' || key === 'weight_kg') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-right font-mono text-slate-700 text-xs">
                                {it[key] !== undefined && it[key] !== null ? Number(it[key]).toLocaleString('en-IN') : '—'}
                              </td>
                            );
                          }

                          // 11. UOM
                          if (key === 'uom') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-center font-mono text-[11px] text-slate-600">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded">{it.uom || '—'}</span>
                              </td>
                            );
                          }

                          // 12. Rate
                          if (key === 'rate') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-right font-mono font-semibold text-slate-800 text-xs">
                                {fmtCur(Number(it.rate) || 0)}
                              </td>
                            );
                          }

                          // 13. Taxable Amount
                          if (key === 'taxable_amount') {
                            const taxableVal = it.taxable_amount !== undefined ? Number(it.taxable_amount) : (Number(it.quantity || it.qty || 0) * Number(it.rate || 0));
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-right font-mono font-semibold text-slate-800 text-xs">
                                {fmtCur(taxableVal || 0)}
                              </td>
                            );
                          }

                          // 14. TAX %
                          if (key === 'tax_percent') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-right font-mono text-slate-600 text-xs">
                                {it.tax_percent ?? 5}%
                              </td>
                            );
                          }

                          // 15. TAX Amount
                          if (key === 'tax_amount') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-right font-mono text-slate-600 text-xs">
                                {fmtCur(Number(it.tax_amount) || 0)}
                              </td>
                            );
                          }

                          // 16. Net Amount
                          if (key === 'net_amount') {
                            return (
                              <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-right font-mono font-bold text-brand-700 text-xs">
                                {fmtCur(Number(it.net_amount) || 0)}
                              </td>
                            );
                          }

                          // General dynamic fields
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2 px-1.5 text-xs text-slate-700">
                              {it[key] !== undefined && it[key] !== null ? String(it[key]) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  {(() => {
                    const taxableColIdx = viewCategoryFields.findIndex((f: any) => f.field_name === 'taxable_amount');
                    const hasTaxPct = viewCategoryFields.some((f: any) => f.field_name === 'tax_percent');
                    const hasTaxAmt = viewCategoryFields.some((f: any) => f.field_name === 'tax_amount');
                    const hasNetAmt = viewCategoryFields.some((f: any) => f.field_name === 'net_amount');
                    const leadSpan = taxableColIdx !== -1 ? taxableColIdx : Math.max(1, viewCategoryFields.length - (hasNetAmt ? 1 : 0));
                    return (
                      <tr className="font-semibold text-slate-700 bg-slate-50/70 border-t border-slate-200">
                        <td colSpan={leadSpan} className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px] text-slate-500 font-bold">
                          Calculated Order Totals:
                        </td>
                        {taxableColIdx !== -1 && (
                          <td className="py-2.5 px-2 text-right font-mono text-slate-800 text-xs font-bold whitespace-nowrap">
                            {fmtCur(viewTotals.taxable)}
                          </td>
                        )}
                        {hasTaxPct && <td />}
                        {hasTaxAmt && (
                          <td className="py-2.5 px-2 text-right font-mono text-slate-600 font-bold whitespace-nowrap text-xs">
                            {fmtCur(viewTotals.tax)}
                          </td>
                        )}
                        {hasNetAmt && (
                          <td className="py-2.5 px-2 text-right font-mono font-bold text-brand-700 text-sm whitespace-nowrap">
                            {fmtCur(viewTotals.net)}
                          </td>
                        )}
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          </div>

          {/* Section 3: Bottom Summary & Approval Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="text-xs text-slate-500">
              Total {(viewPO.items || []).length} item line{(viewPO.items || []).length !== 1 ? 's' : ''} • Tax Amount: <span className="font-mono font-semibold text-slate-700">{fmtCur(viewTotals.tax)}</span> • Net Amount: <span className="font-mono font-bold text-brand-700">{fmtCur(viewTotals.net)}</span>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => { setViewPO(null); setApprovalSuccess(''); setApprovalError(''); }}>
                Back to Orders
              </Button>
              <Button
                variant="secondary"
                icon={<Printer className="w-3.5 h-3.5" />}
                onClick={() => setPrintPO(viewPO)}
              >
                Print / Save A4 PDF
              </Button>
              {(viewPO.status || '').toLowerCase() === 'draft' && (
                <Button
                  variant="secondary"
                  icon={<Pencil className="w-3.5 h-3.5" />}
                  onClick={() => handleOpenEdit(viewPO)}
                >
                  Edit PO
                </Button>
              )}
              {(viewPO.status || '').toLowerCase() === 'draft' && canApprove && (
                <Button
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={() => setApproveModalOpen(true)}
                >
                  Approve PO
                </Button>
              )}
              {(viewPO.status || '').toLowerCase() === 'ordered' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Order Confirmed & Approved
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Approval Confirmation Dialog Modal */}
        <Modal
          open={approveModalOpen}
          onClose={() => { if (!approving) setApproveModalOpen(false); }}
          title="Approve Purchase Order"
          subtitle={`Confirm approval for PO: ${viewPO.po_number}`}
          size="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="secondary"
                disabled={approving}
                onClick={() => setApproveModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                loading={approving}
                icon={<CheckCircle2 className="w-4 h-4" />}
                onClick={handleApprovePO}
              >
                Confirm & Approve
              </Button>
            </div>
          }
        >
          <div className="space-y-3 py-2 text-xs text-slate-600">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 leading-relaxed">
              <p className="font-semibold text-amber-950 mb-1">Are you sure you want to approve this Purchase Order?</p>
              <p>Approving will change the status from <strong className="text-amber-800">Draft</strong> to <strong className="text-emerald-800">Ordered</strong>.</p>
              <p className="mt-1 text-[11px] text-amber-700">Once approved, this PO will become active and available for Material Receipts and Supplier Payments.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">PO Number:</span>
                <span className="font-bold text-slate-800">{viewPO.po_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Supplier:</span>
                <span className="text-slate-800 font-sans">{viewPO.supplier_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Category:</span>
                <span className="text-slate-800 font-sans">{viewPO.category_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Total Net Amount:</span>
                <span className="font-bold text-brand-700">{fmtCur(viewTotals.net)}</span>
              </div>
            </div>
          </div>
        </Modal>

        {/* Dynamic PO Print / Template Modal */}
        <Modal
          open={!!printPO}
          onClose={() => setPrintPO(null)}
          title={`Purchase Order: ${printPO?.po_number}`}
          subtitle="Standard A4 Document Preview • Dynamic PO Template"
          size="4xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-400">Layout driven dynamically by PO Template Settings</span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPrintPO(null)}>Close</Button>
                <Button 
                  icon={<Printer className="w-3.5 h-3.5" />} 
                  onClick={() => {
                    const poNum = printPO?.po_number || 'PO';
                    const el = document.getElementById('printable-po-document');
                    if (el) {
                      printHtmlElement(el, poNum);
                    } else {
                      const origTitle = document.title;
                      document.title = poNum;
                      window.print();
                      setTimeout(() => { document.title = origTitle; }, 1000);
                    }
                  }}
                >
                  Print / Save A4 PDF
                </Button>
              </div>
            </div>
          }
        >
          {printPO && (
            <div className="overflow-y-auto max-h-[78vh] p-4 sm:p-6 bg-slate-200/90 rounded-lg flex justify-center">
              <div className="w-full flex justify-center shadow-lg rounded">
                <DynamicPOTemplate
                  settings={templateData?.settings || {}}
                  columns={templateData?.columns || []}
                  processFields={templateData?.process_fields || []}
                  terms={templateData?.terms || []}
                  signatures={templateData?.signatures || []}
                  poData={printPO}
                  categories={categories}
                  selectedCategoryId={printPO.category_id}
                  isPrintPreview={true}
                />
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // =========================================================================
  // MAIN VIEW: PURCHASE ORDERS TABLE LIST
  // =========================================================================
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage supplier purchase orders and line items"
        breadcrumb={[{ label: 'Purchase' }, { label: 'Orders' }]}
        actions={
          <div className="flex items-center gap-2">
            <button 
              onClick={load} 
              disabled={loading} 
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 bg-white"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Direct navigation to Supplier Payments as requested */}
            <Button 
              variant="secondary" 
              icon={<CreditCard className="w-3.5 h-3.5 text-emerald-600" />} 
              onClick={() => navigate('/purchase/payments')}
            >
              Supplier Payments
            </Button>

            {/* Direct navigation to PO Template Settings */}
            <Button 
              variant="secondary" 
              icon={<FileSpreadsheet className="w-3.5 h-3.5 text-brand-600" />} 
              onClick={() => navigate('/settings/po-template')}
            >
              PO Template Settings
            </Button>

            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={handleOpenCreate}>
              New PO (Full Page)
            </Button>
          </div>
        }
      />

      {/* PO List Table */}
      <div className="flex-1 overflow-hidden p-4">
        <DataTable
          data={pos}
          columns={columns}
          rowKey="id"
          onRowClick={(r: PurchaseOrder) => setViewPO(r)}
          actions={(r: PurchaseOrder) => {
            const isDraft = (r.status || '').toLowerCase() === 'draft';
            return (
              <div className="flex items-center gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); setViewPO(r); }} 
                  className="p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-slate-100"
                  title="View PO Details"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                {isDraft ? (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(r); }} 
                    className="p-1.5 text-slate-400 hover:text-amber-600 rounded hover:bg-slate-100"
                    title="Edit Purchase Order (Draft)"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button 
                    disabled
                    className="p-1.5 text-slate-300 cursor-not-allowed rounded"
                    title="Ordered PO is locked from editing"
                  >
                    <Lock className="w-3.5 h-3.5" />
                  </button>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); setPrintPO(r); }} 
                  className="p-1.5 text-slate-400 hover:text-emerald-600 rounded hover:bg-slate-100"
                  title="Print PO Document"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          }}
        />
      </div>



      {/* Dynamic PO Print / Template Modal */}
      <Modal
        open={!!printPO}
        onClose={() => setPrintPO(null)}
        title={`Purchase Order: ${printPO?.po_number}`}
        subtitle="Standard A4 Document Preview • Dynamic PO Template"
        size="4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-400">Layout driven dynamically by PO Template Settings</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPrintPO(null)}>Close</Button>
              <Button 
                icon={<Printer className="w-3.5 h-3.5" />} 
                onClick={() => {
                  const poNum = printPO?.po_number || 'PO';
                  const el = document.getElementById('printable-po-document');
                  if (el) {
                    printHtmlElement(el, poNum);
                  } else {
                    const origTitle = document.title;
                    document.title = poNum;
                    window.print();
                    setTimeout(() => { document.title = origTitle; }, 1000);
                  }
                }}
              >
                Print / Save A4 PDF
              </Button>
            </div>
          </div>
        }
      >
        {printPO && (
          <div className="overflow-y-auto max-h-[78vh] p-4 sm:p-6 bg-slate-200/90 rounded-lg flex justify-center">
            <div className="w-full flex justify-center shadow-lg rounded">
              <DynamicPOTemplate
                settings={templateData?.settings || {}}
                columns={templateData?.columns || []}
                processFields={templateData?.process_fields || []}
                terms={templateData?.terms || []}
                signatures={templateData?.signatures || []}
                poData={printPO}
                categories={categories}
                selectedCategoryId={printPO.category_id}
                isPrintPreview={true}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
