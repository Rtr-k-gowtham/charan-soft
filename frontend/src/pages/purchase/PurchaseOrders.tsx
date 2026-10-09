// src/pages/purchase/PurchaseOrders.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Sliders
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

// Dynamic column width and minimum dimension helper for category table columns
function getCategoryColumnWidth(field: any): { width: string; minWidth: string } {
  const name = (field.field_name || '').toLowerCase();
  if (name === 's_no' || name === 'sl_no') return { width: '55px', minWidth: '55px' };
  if (name === 'order_no' || name.includes('code') || name === 'item_code' || name === 'material_code') return { width: '130px', minWidth: '125px' };
  if (name.includes('description') || name.includes('item') || name.includes('accessory')) return { width: '310px', minWidth: '290px' };
  if (name === 'material_id' || name === 'material') return { width: '280px', minWidth: '260px' };
  if (name === 'design' || name === 'spec') return { width: '120px', minWidth: '110px' };
  if (name === 'size') return { width: '100px', minWidth: '95px' };
  if (name === 'color') return { width: '110px', minWidth: '100px' };
  if (name === 'qty' || name === 'quantity') return { width: '105px', minWidth: '100px' };
  if (name === 'kgs' || name === 'weight' || name === 'weight_kg') return { width: '105px', minWidth: '100px' };
  if (name === 'uom') return { width: '95px', minWidth: '90px' };
  if (name === 'rate' || name.includes('price')) return { width: '115px', minWidth: '110px' };
  if (name === 'tax_percent') return { width: '95px', minWidth: '90px' };
  if (name === 'taxable_amount') return { width: '125px', minWidth: '120px' };
  if (name === 'tax_amount') return { width: '115px', minWidth: '110px' };
  if (name === 'net_amount') return { width: '135px', minWidth: '130px' };
  return { width: '120px', minWidth: '110px' };
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
  const [error, setError] = useState('');

  // Create form state
  const [form, setForm] = useState({ 
    supplier_id: '', 
    category_id: '', 
    po_date: new Date().toISOString().split('T')[0], 
    delivery_due_date: '', 
    remarks: '' 
  });
  
  const [items, setItems] = useState<any[]>([
    { item_description: '', quantity: 0, uom: 'KG', rate: 0, tax_percent: 5, taxable_amount: 0, tax_amount: 0, net_amount: 0 }
  ]);

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
    return list;
  }, [matchingMaterials, otherMaterials]);

  const handleSelectMaterial = (idx: number, matId: string) => {
    if (!matId) {
      setItems(prev => {
        const next = [...prev];
        next[idx] = { 
          ...next[idx], 
          material_id: undefined,
          material_code: undefined,
          item_code: undefined,
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
  const activeCategoryFields = useMemo(() => {
    if (!selectedCategoryObj?.fields || !Array.isArray(selectedCategoryObj.fields)) {
      return [];
    }
    return selectedCategoryObj.fields
      .filter((f: any) => f.is_visible !== false && f.is_visible !== 0 && f.is_visible !== '0')
      .sort((a: any, b: any) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  }, [selectedCategoryObj]);

  const createBlankItem = () => {
    const row: Record<string, any> = {
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

  const handleCreate = async () => {
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
      await api.createPurchaseOrder({
        ...form,
        supplier_id: finalSupplierId,
        category_id: finalCategoryId,
        items
      });
      setCreateOpen(false);
      setForm({ 
        supplier_id: suppliers.length > 0 ? String(suppliers[0].id) : '', 
        category_id: categories.length > 0 ? String(categories[0].id) : '', 
        po_date: new Date().toISOString().split('T')[0], 
        delivery_due_date: '', 
        remarks: '' 
      });
      setItems([{ item_description: '', quantity: 0, uom: 'KG', rate: 0, tax_percent: 5, taxable_amount: 0, tax_amount: 0, net_amount: 0 }]);
      load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to create PO');
    } finally {
      setSaving(false);
    }
  };

  // PO List Columns - As requested: No Balance, No Payment, No Status
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
            <Button loading={saving} onClick={handleCreate} icon={<Plus className="w-4 h-4" />}>
              Create Purchase Order
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
                  onClick={refreshCategoryColumnsFromDB}
                  disabled={categoryFieldsLoading}
                  className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-medium transition-colors border border-slate-200 disabled:opacity-50"
                  title="Re-query category columns directly from database"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${categoryFieldsLoading ? 'animate-spin text-brand-600' : ''}`} />
                  {categoryFieldsLoading ? 'Syncing...' : 'Sync Columns from DB'}
                </button>
                <button
                  type="button"
                  onClick={() => setItems(prev => [...prev, createBlankItem()])}
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
                <table className="w-full min-w-[1360px] text-xs text-left border-collapse">
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
                            className={`py-3 px-3 whitespace-nowrap ${isCenter ? 'text-center' : isNum ? 'text-right' : 'text-left'}`}
                          >
                            <div className={`flex items-center gap-1 ${isCenter ? 'justify-center' : isNum ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-700">{f.field_label}</span>
                              {f.is_required ? <span className="text-red-500 font-bold">*</span> : null}
                            </div>
                          </th>
                        );
                      })}
                      <th style={{ width: '60px', minWidth: '60px' }} className="py-3 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">Action</th>
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
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold text-xs">
                              {idx + 1}
                            </td>
                          );
                        }

                        // 2. Order No / Order No.
                        if (key === 'order_no') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                              <input
                                type="text"
                                value={it.order_no || ''}
                                onChange={e => handleItemChange(idx, 'order_no', e.target.value)}
                                placeholder="Order #"
                                className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 font-mono bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 3. Material ID / Material dedicated selector column
                        if (key === 'material_id' || key === 'material') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                              <SearchableSelect
                                value={it.material_id || ''}
                                onChange={val => handleSelectMaterial(idx, val)}
                                options={materialOptions}
                                placeholder="— Pick Material ID / Code —"
                                searchPlaceholder="Search Material ID, Code (e.g. MAT-) or Name..."
                              />
                            </td>
                          );
                        }

                        // 3.1 Item Code / Material Code
                        if (key === 'item_code' || key === 'material_code' || key === 'code') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                              <input
                                type="text"
                                value={it[key] || it.material_code || it.item_code || it.code || ''}
                                onChange={e => handleItemChange(idx, key, e.target.value)}
                                placeholder="Code / ID"
                                className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 3.2 Description / Item Description / Accessory Name / Item Name
                        if (key === 'description' || key === 'item_description' || key === 'accessory_name' || key === 'item' || key === 'item_name') {
                          const hasSeparateMaterialIdCol = activeCategoryFields.some(
                            (c: any) => c.field_name === 'material_id' || c.field_name === 'material'
                          );
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                              <div className="flex flex-col gap-1.5">
                                {!hasSeparateMaterialIdCol && (
                                  <SearchableSelect
                                    value={it.material_id || ''}
                                    onChange={val => handleSelectMaterial(idx, val)}
                                    options={materialOptions}
                                    placeholder={`— Select ${f.field_label} from Catalog —`}
                                    searchPlaceholder="Search Material ID, Code (e.g. MAT-) or Name..."
                                  />
                                )}
                                {(!it.material_id || (it[key] && it[key] !== it.item_description)) && (
                                  <input
                                    type="text"
                                    value={it[key] || it.item_description || it.description || ''}
                                    onChange={e => {
                                      handleItemChange(idx, key, e.target.value);
                                      handleItemChange(idx, 'item_description', e.target.value);
                                      handleItemChange(idx, 'description', e.target.value);
                                    }}
                                    placeholder={`${f.field_label} (or type custom) *`}
                                    className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white font-medium shadow-sm"
                                  />
                                )}
                              </div>
                            </td>
                          );
                        }

                        // 4. Design
                        if (key === 'design') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                              <input
                                type="text"
                                value={it.design || ''}
                                onChange={e => handleItemChange(idx, 'design', e.target.value)}
                                placeholder="Design"
                                className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 5. Size
                        if (key === 'size') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                              <input
                                type="text"
                                value={it.size || ''}
                                onChange={e => handleItemChange(idx, 'size', e.target.value)}
                                placeholder="Size"
                                className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 6. Color
                        if (key === 'color') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                              <input
                                type="text"
                                value={it.color || ''}
                                onChange={e => handleItemChange(idx, 'color', e.target.value)}
                                placeholder="Color"
                                className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 7. Spec
                        if (key === 'spec') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                              <input
                                type="text"
                                value={it.spec || ''}
                                onChange={e => handleItemChange(idx, 'spec', e.target.value)}
                                placeholder="Spec"
                                className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 8. Qty / Quantity
                        if (key === 'qty' || key === 'quantity') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                              <input
                                type="number"
                                value={it.quantity === 0 && !it.qty ? '' : (it.quantity ?? it.qty ?? '')}
                                onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                                placeholder="0"
                                min="0"
                                className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono font-bold bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 9. KGS / Weight
                        if (key === 'kgs' || key === 'weight') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                              <input
                                type="number"
                                value={it[key] ?? ''}
                                onChange={e => handleItemChange(idx, key, e.target.value)}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 10. UOM / Uom
                        if (key === 'uom') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                              <select
                                value={it.uom || 'MTR'}
                                onChange={e => handleItemChange(idx, 'uom', e.target.value)}
                                className="w-full h-8 px-2 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white font-medium shadow-sm"
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
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                              <input
                                type="number"
                                value={it.rate === 0 ? '' : it.rate}
                                onChange={e => handleItemChange(idx, 'rate', e.target.value)}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono font-semibold bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 12. Taxable Amount
                        if (key === 'taxable_amount') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-3 text-right font-mono text-slate-700 font-semibold whitespace-nowrap text-xs">
                              {fmtCur(it.taxable_amount || 0)}
                            </td>
                          );
                        }

                        // 13. TAX %
                        if (key === 'tax_percent') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                              <input
                                type="number"
                                value={it.tax_percent ?? 5}
                                onChange={e => handleItemChange(idx, 'tax_percent', e.target.value)}
                                min="0"
                                max="100"
                                step="0.5"
                                className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono bg-white shadow-sm"
                              />
                            </td>
                          );
                        }

                        // 14. TAX Amount
                        if (key === 'tax_amount') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap text-xs">
                              {fmtCur(it.tax_amount || 0)}
                            </td>
                          );
                        }

                        // 15. Net Amount
                        if (key === 'net_amount') {
                          return (
                            <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-xs">
                              {fmtCur(it.net_amount || 0)}
                            </td>
                          );
                        }

                        // Fallback for any other custom column added online in DB or Masters
                        return (
                          <td key={key} style={{ width: colDim.width, minWidth: colDim.minWidth }} className="py-2.5 px-2.5">
                            {f.field_type === 'number' || f.field_type === 'decimal' ? (
                              <input
                                type="number"
                                step={f.field_type === 'decimal' ? '0.01' : '1'}
                                value={it[key] ?? ''}
                                onChange={e => handleItemChange(idx, key, e.target.value)}
                                placeholder={f.field_label}
                                className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 text-right font-mono bg-white shadow-sm"
                              />
                            ) : f.field_type === 'date' ? (
                              <input
                                type="date"
                                value={it[key] || ''}
                                onChange={e => handleItemChange(idx, key, e.target.value)}
                                className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm"
                              />
                            ) : f.field_type === 'checkbox' ? (
                              <div className="flex justify-center items-center h-8">
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
                                className="w-full h-8 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white shadow-sm font-medium"
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* Delete */}
                      <td style={{ width: '60px', minWidth: '60px' }} className="py-2.5 px-3 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                            title="Remove line item"
                          >
                            <Trash2 className="w-4 h-4" />
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
                        <td colSpan={leadSpan} className="py-3 px-4 text-right uppercase tracking-wider text-[11px] text-slate-500 font-bold">
                          Calculated Order Totals:
                        </td>
                        {taxableColIdx !== -1 && (
                          <td className="py-3 px-3 text-right font-mono text-slate-800 text-sm font-bold whitespace-nowrap">
                            {fmtCur(totals.taxable)}
                          </td>
                        )}
                        {hasTaxPct && <td />}
                        {hasTaxAmt && (
                          <td className="py-3 px-3 text-right font-mono text-slate-600 font-bold whitespace-nowrap">
                            {fmtCur(totals.tax)}
                          </td>
                        )}
                        {hasNetAmt && (
                          <td className="py-3 px-3 text-right font-mono font-bold text-brand-700 text-base whitespace-nowrap">
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
              <Button loading={saving} onClick={handleCreate} icon={<Plus className="w-4 h-4" />}>
                Create Purchase Order ({fmtCur(totals.net)})
              </Button>
            </div>
          </div>
        </div>
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
          actions={(r: PurchaseOrder) => (
            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); setViewPO(r); }} 
                className="p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-slate-100"
                title="View PO Details"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setPrintPO(r); }} 
                className="p-1.5 text-slate-400 hover:text-emerald-600 rounded hover:bg-slate-100"
                title="Print PO Document"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        />
      </div>

      {/* View PO Drawer (without balance or payment details as requested) */}
      <Drawer 
        open={!!viewPO} 
        onClose={() => setViewPO(null)} 
        title={`Purchase Order: ${viewPO?.po_number}`} 
        subtitle={viewPO?.supplier_name} 
        width="max-w-3xl"
      >
        {viewPO && (
          <div className="flex flex-col gap-4">
            {/* Header info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'PO Date', value: viewPO.po_date },
                { label: 'Delivery Due', value: viewPO.delivery_due_date || '—' },
                { label: 'Category', value: viewPO.category_name || '—' },
              ].map(f => (
                <div key={f.label} className="p-2.5 bg-slate-50 rounded-md border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{f.label}</p>
                  <div className="text-xs font-semibold text-slate-700 mt-0.5">{f.value}</div>
                </div>
              ))}
            </div>

            {/* Remarks */}
            {viewPO.remarks && (
              <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-md text-xs text-amber-900">
                <span className="font-semibold">Remarks:</span> {viewPO.remarks}
              </div>
            )}

            {/* Items table */}
            <div>
              <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">Line Items</h4>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full table-dense">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>Spec</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Rcvd</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Taxable</th>
                      <th className="text-right">TAX%</th>
                      <th className="text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewPO.items || []).map((it, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td className="font-medium">{it.item_description}</td>
                        <td className="text-slate-400">{it.spec || '—'}</td>
                        <td className="text-right font-mono">{fmt(it.quantity)} {it.uom}</td>
                        <td className="text-right font-mono text-emerald-600">
                          {fmt(it.received_quantity || 0)}
                        </td>
                        <td className="text-right font-mono">{fmtCur(it.rate)}</td>
                        <td className="text-right font-mono">{fmtCur(it.taxable_amount)}</td>
                        <td className="text-right font-mono">{it.tax_percent}%</td>
                        <td className="text-right font-mono font-semibold">{fmtCur(it.net_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <td colSpan={6} className="text-right font-semibold text-slate-600">Totals:</td>
                      <td className="text-right font-mono font-semibold">{fmtCur(viewPO.subtotal)}</td>
                      <td />
                      <td className="text-right font-mono font-bold text-brand-700">{fmtCur(viewPO.net_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Link to Dedicated Payments Page */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-800">Payment & Balance Details</p>
                <p className="text-[11px] text-slate-500">Payments and balances are managed on the dedicated Supplier Payments page.</p>
              </div>
              <Button 
                variant="secondary" 
                icon={<ExternalLink className="w-3.5 h-3.5 text-brand-600" />}
                onClick={() => {
                  setViewPO(null);
                  navigate('/purchase/payments');
                }}
              >
                Go to Payments
              </Button>
            </div>
          </div>
        )}
      </Drawer>

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
                  const el = document.getElementById('printable-po-document');
                  if (el) {
                    printHtmlElement(el, `Purchase Order - ${printPO?.po_number || 'Document'}`);
                  } else {
                    window.print();
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
