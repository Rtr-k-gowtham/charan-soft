// src/pages/production/CreateProductionOrder.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Customer, Category } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import Modal from '../../components/ui/Modal';
import SearchableSelect, { SelectOption } from '../../components/ui/SearchableSelect';
import {
  lookupPantone,
  lookupPantoneAsync,
  normalizePantoneInput,
  hexToRgb,
  rgbToHex,
  isValidHex,
} from '../../lib/pantoneService';
import {
  ArrowLeft,
  Plus,
  Copy,
  Trash2,
  Check,
  AlertCircle,
  Package,
  Layers,
  Palette,
  Clock,
  CheckCircle2,
  Loader2,
  Sliders,
  Sparkles,
  Dices,
} from 'lucide-react';
import BuyerAvatar from '../../components/ui/BuyerAvatar';
import AvatarSelectorModal from '../../components/buyers/AvatarSelectorModal';
import { AvatarStyle, AvatarConfig } from '../../lib/avatarService';

interface ColorRecord {
  id: number;
  code?: string;
  name: string;
  hex_code: string;
  pantone_code?: string;
}

export interface ColorVariant {
  id: string;
  color: string;
  quantity: number;
}

export interface ProductGroup {
  id: string;
  product_id: string;
  variants: ColorVariant[];
}

interface BuyerProductItem {
  id: number | string;
  buyer_id: number | string;
  product_name?: string;
  name?: string;
  product_code?: string;
  code?: string;
  uom?: string;
  notes?: string;
}

export default function CreateProductionOrder() {
  const navigate = useNavigate();

  // Master data
  const [buyerProducts, setBuyerProducts] = useState<BuyerProductItem[]>([]);
  const [loadingBuyerProducts, setLoadingBuyerProducts] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [colors, setColors] = useState<ColorRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [form, setForm] = useState({
    title: '',
    customer_id: '',
    category_id: '7',
    priority: 'Medium',
    start_date: new Date().toISOString().split('T')[0],
    target_delivery_date: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 20);
      return d.toISOString().split('T')[0];
    })(),
    notes: '',
  });

  // Product groups state: Each product group contains one product and multiple Pantone color variants
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([
    {
      id: 'grp_init_1',
      product_id: '',
      variants: [
        { id: 'var_init_1', color: '', quantity: 100 },
      ],
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Quick New Buyer modal & avatar state
  const [addBuyerModalOpen, setAddBuyerModalOpen] = useState(false);
  const [buyerAvatarModalOpen, setBuyerAvatarModalOpen] = useState(false);
  const [buyerSaving, setBuyerSaving] = useState(false);
  const [buyerError, setBuyerError] = useState('');
  const [buyerAvatarStyle, setBuyerAvatarStyle] = useState<AvatarStyle>('lorelei');
  const [buyerAvatarSeed, setBuyerAvatarSeed] = useState<string>('buyer-new');
  const [buyerAvatarConfig, setBuyerAvatarConfig] = useState<AvatarConfig>({});
  const [buyerForm, setBuyerForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    billing_address: '',
    gstin: '',
  });

  const handleOpenNewBuyer = () => {
    setBuyerForm({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      billing_address: '',
      gstin: '',
    });
    const randomSeed = `buyer-${Math.random().toString(36).substring(2, 9)}`;
    setBuyerAvatarSeed(randomSeed);
    setBuyerAvatarStyle('lorelei');
    setBuyerAvatarConfig({});
    setBuyerError('');
    setAddBuyerModalOpen(true);
  };

  const handleRandomizeBuyerAvatar = () => {
    const randomSeed = `buyer-${Math.random().toString(36).substring(2, 9)}`;
    setBuyerAvatarSeed(randomSeed);
  };

  const handleSaveNewBuyer = async () => {
    if (!buyerForm.name.trim() || !buyerForm.phone.trim()) {
      setBuyerError('Buyer name and phone are required');
      return;
    }
    setBuyerSaving(true);
    setBuyerError('');
    const autoCode = `BUY-${String(customers.length + 1).padStart(3, '0')}`;
    try {
      const res = (await api.createBuyer({
        ...buyerForm,
        code: autoCode,
        avatar_style: buyerAvatarStyle,
        avatar_seed: buyerAvatarSeed || `buyer-${autoCode}`,
        avatar_config: buyerAvatarConfig,
      })) as any;

      const newId = res?.id || res?.data?.id || Date.now();
      const newCust: Customer = {
        id: Number(newId),
        code: autoCode,
        name: buyerForm.name,
        contact_person: buyerForm.contact_person,
        phone: buyerForm.phone,
        email: buyerForm.email,
        billing_address: buyerForm.billing_address,
        gstin: buyerForm.gstin,
        status: 'Active',
        avatar_style: buyerAvatarStyle,
        avatar_seed: buyerAvatarSeed || `buyer-${autoCode}`,
        avatar_config: buyerAvatarConfig,
      };

      setCustomers((prev) => [...prev, newCust]);
      setForm((f) => ({ ...f, customer_id: String(newCust.id) }));
      setAddBuyerModalOpen(false);
    } catch (e: unknown) {
      setBuyerError((e as Error).message || 'Failed to save buyer');
    } finally {
      setBuyerSaving(false);
    }
  };

  // Add Color Modal State (Pantone lookup driven + Custom RGB/HEX fallback)
  const [addColorModalOpen, setAddColorModalOpen] = useState(false);
  const [activeColorTarget, setActiveColorTarget] = useState<{
    groupIndex: number;
    variantIndex: number;
  } | null>(null);
  const [colorSaving, setColorSaving] = useState(false);
  const [colorError, setColorError] = useState('');
  const [colorPantoneInput, setColorPantoneInput] = useState('');
  const [colorName, setColorName] = useState('');
  const [colorHexCode, setColorHexCode] = useState('#0F2042');
  const [colorRgb, setColorRgb] = useState<{ r: number; g: number; b: number }>({ r: 15, g: 32, b: 66 });
  const [colorIsVerified, setColorIsVerified] = useState(false);
  const [colorIsCustomMode, setColorIsCustomMode] = useState(false);
  const [colorLookupLoading, setColorLookupLoading] = useState(false);
  const [colorLookupError, setColorLookupError] = useState('');
  const [colorVerifiedInfo, setColorVerifiedInfo] = useState<{
    code: string;
    system: string;
    category: string;
  } | null>(null);

  const handleColorHexChange = (val: string) => {
    let clean = val.trim();
    if (clean && !clean.startsWith('#')) clean = '#' + clean;
    setColorHexCode(clean);
    const parsed = hexToRgb(clean);
    if (parsed) {
      setColorRgb(parsed);
    }
  };

  const handleColorRgbChange = (channel: 'r' | 'g' | 'b', valStr: string) => {
    const num = parseInt(valStr, 10);
    const val = isNaN(num) ? 0 : Math.max(0, Math.min(255, num));
    const nextRgb = { ...colorRgb, [channel]: val };
    setColorRgb(nextRgb);
    setColorHexCode(rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
  };

  // Debounced Pantone Code lookup for quick-add color modal
  useEffect(() => {
    if (!addColorModalOpen) return;

    const trimmed = colorPantoneInput.trim();
    if (!trimmed) {
      setColorLookupLoading(false);
      setColorLookupError('');
      setColorName('');
      setColorHexCode('#0F2042');
      setColorRgb({ r: 15, g: 32, b: 66 });
      setColorIsVerified(false);
      setColorIsCustomMode(false);
      setColorVerifiedInfo(null);
      return;
    }

    if (colorVerifiedInfo && colorVerifiedInfo.code.toUpperCase() === trimmed.toUpperCase()) {
      return;
    }

    setColorIsVerified(false);
    setColorIsCustomMode(false);
    setColorLookupError('');
    setColorLookupLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await lookupPantoneAsync(trimmed);
        setColorLookupLoading(false);

        if (res.found && res.name && res.hex_code) {
          setColorIsVerified(true);
          setColorIsCustomMode(false);
          setColorName(res.name);
          setColorHexCode(res.hex_code);
          const parsedRgb = hexToRgb(res.hex_code);
          if (parsedRgb) {
            setColorRgb(parsedRgb);
          } else if (res.red !== undefined && res.green !== undefined && res.blue !== undefined) {
            setColorRgb({ r: res.red, g: res.green, b: res.blue });
          }
          setColorVerifiedInfo({
            code: res.pantone_code || trimmed,
            system: res.system || 'Textile / FHI',
            category: res.category || 'Standard',
          });
          setColorLookupError('');
        } else {
          setColorIsVerified(false);
          setColorIsCustomMode(true);
          setColorVerifiedInfo(null);
          setColorLookupError(
            res.error || 'Color code not in standard reference library. You can enter details manually.'
          );
        }
      } catch (err: unknown) {
        setColorLookupLoading(false);
        setColorIsVerified(false);
        setColorIsCustomMode(true);
        setColorVerifiedInfo(null);
        setColorLookupError('Lookup service unavailable. Enter details manually.');
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [colorPantoneInput, addColorModalOpen, colorVerifiedInfo]);

  // Load master data
  const loadMasterData = async () => {
    try {
      setLoading(true);
      const [custs, cats, cols] = await Promise.all([
        api.getCustomers().catch(() => []),
        api.getCategories().catch(() => []),
        api.getColors().catch(() => []),
      ]);

      setCustomers((custs as Customer[]) || []);
      setCategories((cats as Category[]) || []);
      const mapped = ((cols as any[]) || []).map((c: any) => ({
        id: c.id,
        name: c.name || c.color_name || 'Unnamed',
        hex_code: c.hex_code || '#0F2042',
        code: c.code || '',
        pantone_code: c.pantone_code || '',
      }));
      setColors(mapped);
    } catch (err: unknown) {
      console.error('Failed to load master data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  // Fetch configured products for a specific buyer from Buyer Master
  const fetchProductsForBuyer = async (buyerId: string | number): Promise<BuyerProductItem[]> => {
    if (!buyerId) return [];
    try {
      let serverList: any[] = [];
      try {
        const res = await api.getBuyerProducts(buyerId);
        const rawList = Array.isArray(res) ? res : (res as any)?.data || [];
        serverList = rawList;
      } catch (err) {
        console.warn('API getBuyerProducts failed or returned error', err);
      }

      const validServerProducts = serverList.filter((p: any) => {
        if (!p || typeof p !== 'object') return false;
        if (p.contact_person && !p.product_name) return false;
        if (p.billing_address && !p.product_name) return false;
        if (p.gstin && !p.product_name) return false;
        return Boolean(p.product_name || p.name);
      });

      // Local storage fallback
      const localKey = `cheran_buyer_products_${buyerId}`;
      const localStored = localStorage.getItem(localKey);
      let localList: any[] = [];
      if (localStored) {
        try {
          const parsed = JSON.parse(localStored);
          if (Array.isArray(parsed)) {
            localList = parsed.filter(
              (p: any) => p && typeof p === 'object' && Boolean(p.product_name || p.name)
            );
          }
        } catch {
          localList = [];
        }
      }

      // Merge server products and local products
      const map = new Map<string | number, any>();
      localList.forEach((p: any) => {
        const key = p.id || p.product_code || p.product_name;
        map.set(key, p);
      });
      validServerProducts.forEach((p: any) => {
        const key = p.id || p.product_code || p.product_name;
        map.set(key, p);
      });

      return Array.from(map.values()).map((p: any, idx: number) => ({
        id: p.id || idx + 1,
        buyer_id: buyerId,
        product_name: p.product_name || p.name || 'Product',
        product_code: p.product_code || p.code || `BPRD-${String(p.id || idx + 1).padStart(3, '0')}`,
        uom: p.uom || 'Pieces',
      }));
    } catch (err) {
      console.error('Failed to load buyer products:', err);
      return [];
    }
  };

  // Handler when Buyer changes
  const handleBuyerChange = async (buyerId: string) => {
    setForm((f) => ({ ...f, customer_id: buyerId }));

    if (!buyerId) {
      setBuyerProducts([]);
      // Clear product and color on all existing lines
      setProductGroups((prev) =>
        prev.map((g) => ({
          ...g,
          product_id: '',
          variants: g.variants.map((v) => ({ ...v, color: '' })),
        }))
      );
      return;
    }

    setLoadingBuyerProducts(true);
    try {
      const prods = await fetchProductsForBuyer(buyerId);
      setBuyerProducts(prods);

      // Validate every group against the newly selected buyer's product list
      const validIds = new Set(prods.map((p) => String(p.id)));
      setProductGroups((prev) =>
        prev.map((g) => {
          if (!g.product_id || !validIds.has(String(g.product_id))) {
            return {
              ...g,
              product_id: '',
              variants: g.variants.map((v) => ({ ...v, color: '' })),
            };
          }
          return g;
        })
      );
    } catch (err) {
      console.error('Failed to update buyer products:', err);
      setBuyerProducts([]);
      setProductGroups((prev) =>
        prev.map((g) => ({
          ...g,
          product_id: '',
          variants: g.variants.map((v) => ({ ...v, color: '' })),
        }))
      );
    } finally {
      setLoadingBuyerProducts(false);
    }
  };

  // Format configured buyer products for SearchableSelect
  const productOptions: SelectOption[] = useMemo(() => {
    return buyerProducts.map((p) => {
      const details: string[] = [];
      if (p.product_code) details.push(p.product_code);
      if (p.uom) details.push(p.uom);

      return {
        value: String(p.id),
        label: p.product_name || p.name || 'Product',
        sublabel: details.join(' • '),
      };
    });
  }, [buyerProducts]);

  // Format Pantone colors for SearchableSelect
  const colorOptions: SelectOption[] = useMemo(() => {
    return colors.map((c) => {
      const pCode = c.pantone_code ? c.pantone_code.trim() : '';
      const cName = c.name ? c.name.trim() : '';
      const displayLabel = pCode ? `${pCode} — ${cName}` : cName;
      const val = pCode || cName;

      return {
        value: val,
        label: displayLabel,
        sublabel: `${c.hex_code || ''} ${pCode ? `• Pantone: ${pCode}` : ''}`.trim(),
        colorSwatch: c.hex_code,
      };
    });
  }, [colors]);

  // Format buyers (customers) for SearchableSelect with avatars
  const customerOptions: SelectOption[] = useMemo(() => {
    return customers.map((c) => ({
      value: String(c.id),
      label: c.name,
      sublabel: `${c.code || ''} ${c.phone ? `• ${c.phone}` : ''}`.trim(),
      buyerAvatar: {
        style: (c.avatar_style as AvatarStyle) || 'adventurer',
        seed: c.avatar_seed || c.code || String(c.id),
        config: c.avatar_config || {},
      },
    }));
  }, [customers]);

  // Priority options
  const priorityOptions: SelectOption[] = useMemo(
    () => [
      { value: 'Low', label: 'Low', sublabel: 'Standard lead-time' },
      { value: 'Medium', label: 'Medium', sublabel: 'Normal production priority' },
      { value: 'High', label: 'High', sublabel: 'Expedited production cycle' },
      { value: 'Urgent', label: 'Urgent', sublabel: 'Immediate manufacturing dispatch' },
    ],
    []
  );

  // Helper to resolve color swatch and information
  const getColorDetails = (colorValue: string) => {
    if (!colorValue) return null;
    const trimmed = colorValue.trim();
    const found = colors.find(
      (c) =>
        c.pantone_code?.toLowerCase() === trimmed.toLowerCase() ||
        c.name?.toLowerCase() === trimmed.toLowerCase() ||
        `${c.pantone_code} — ${c.name}`.toLowerCase() === trimmed.toLowerCase() ||
        c.code?.toLowerCase() === trimmed.toLowerCase()
    );
    if (found) {
      return {
        name: found.name,
        code: found.pantone_code || found.code || '',
        hex: found.hex_code || '#0F2042',
      };
    }
    const lookup = lookupPantone(trimmed);
    return {
      name: lookup.name || trimmed,
      code: lookup.pantone_code || '',
      hex: lookup.hex_code || '#0F2042',
    };
  };

  // Helper to check if a color is already selected in another variant of the same product group
  const isColorDuplicateInGroup = (groupIndex: number, variantIndex: number, colorVal: string) => {
    const group = productGroups[groupIndex];
    if (!group || !colorVal) return false;
    const clean = colorVal.trim().toLowerCase();
    return group.variants.some(
      (v, idx) => idx !== variantIndex && v.color && v.color.trim().toLowerCase() === clean
    );
  };

  // Product Group Handlers
  const handleAddProductGroup = () => {
    setProductGroups((prev) => [
      ...prev,
      {
        id: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        product_id: '',
        variants: [
          {
            id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            color: '',
            quantity: 100,
          },
        ],
      },
    ]);
  };

  const handleDuplicateProductGroup = (groupIndex: number) => {
    setProductGroups((prev) => {
      const target = prev[groupIndex];
      if (!target) return prev;
      const duplicated: ProductGroup = {
        id: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        product_id: target.product_id,
        variants: target.variants.map((v) => ({
          id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          color: v.color,
          quantity: v.quantity,
        })),
      };
      const next = [...prev];
      next.splice(groupIndex + 1, 0, duplicated);
      return next;
    });
  };

  const handleRemoveProductGroup = (groupIndex: number) => {
    if (productGroups.length <= 1) return;
    setProductGroups((prev) => prev.filter((_, idx) => idx !== groupIndex));
  };

  const handleProductChange = (groupIndex: number, newProductId: string) => {
    setProductGroups((prev) => {
      const copy = [...prev];
      copy[groupIndex] = {
        ...copy[groupIndex],
        product_id: newProductId,
      };
      return copy;
    });
  };

  // Color Variant Handlers within a Product Group
  const handleAddColorVariant = (groupIndex: number) => {
    setProductGroups((prev) => {
      const copy = [...prev];
      const group = copy[groupIndex];
      if (!group) return prev;
      copy[groupIndex] = {
        ...group,
        variants: [
          ...group.variants,
          {
            id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            color: '',
            quantity: 100,
          },
        ],
      };
      return copy;
    });
  };

  const handleRemoveColorVariant = (groupIndex: number, variantIndex: number) => {
    setProductGroups((prev) => {
      const copy = [...prev];
      const group = copy[groupIndex];
      if (!group) return prev;
      if (group.variants.length <= 1) {
        // Clear color instead of deleting the last variant row
        copy[groupIndex] = {
          ...group,
          variants: [{ ...group.variants[0], color: '', quantity: 100 }],
        };
        return copy;
      }
      copy[groupIndex] = {
        ...group,
        variants: group.variants.filter((_, idx) => idx !== variantIndex),
      };
      return copy;
    });
  };

  const handleVariantChange = (
    groupIndex: number,
    variantIndex: number,
    field: 'color' | 'quantity',
    value: string | number
  ) => {
    setProductGroups((prev) => {
      const copy = [...prev];
      const group = copy[groupIndex];
      if (!group) return prev;
      const variants = [...group.variants];
      variants[variantIndex] = {
        ...variants[variantIndex],
        [field]: value,
      };
      copy[groupIndex] = { ...group, variants };
      return copy;
    });
  };

  // Open Add Color Modal for a specific variant in a group
  const handleOpenAddColor = (groupIndex: number, variantIndex: number) => {
    setActiveColorTarget({ groupIndex, variantIndex });
    setColorPantoneInput('');
    setColorName('');
    setColorHexCode('#0F2042');
    setColorRgb({ r: 15, g: 32, b: 66 });
    setColorIsVerified(false);
    setColorIsCustomMode(false);
    setColorLookupLoading(false);
    setColorLookupError('');
    setColorVerifiedInfo(null);
    setColorError('');
    setAddColorModalOpen(true);
  };

  // Save New Color and auto-select in target variant
  const handleSaveColor = async () => {
    if (!colorPantoneInput.trim()) {
      setColorError('Pantone Color Code is required');
      return;
    }
    if (!colorName.trim()) {
      setColorError('Color name is required');
      return;
    }
    if (!isValidHex(colorHexCode)) {
      setColorError('Please provide a valid 6-digit digital color HEX code (e.g. #FFE966)');
      return;
    }

    setColorSaving(true);
    setColorError('');
    const finalPantone = colorIsVerified && colorVerifiedInfo?.code
      ? colorVerifiedInfo.code
      : normalizePantoneInput(colorPantoneInput) || colorPantoneInput.trim();

    try {
      const res = (await api.createPantoneColor({
        pantone_code: finalPantone,
        pantone_name: colorName.trim(),
        hex_code: colorHexCode,
        red: colorRgb.r,
        green: colorRgb.g,
        blue: colorRgb.b,
        color_system: 'PMS Coated',
      })) as { id?: number; pantone_code?: string; pantone_name?: string; hex_code?: string };

      const newRecord: ColorRecord = {
        id: res?.id || Date.now(),
        name: colorName.trim(),
        hex_code: colorHexCode,
        pantone_code: finalPantone,
      };

      // Add to local colors list immediately
      setColors((prev) => [newRecord, ...prev]);

      // Auto-select this newly created color in the initiating variant row
      const selectedValue = finalPantone || colorName.trim();
      if (activeColorTarget) {
        handleVariantChange(
          activeColorTarget.groupIndex,
          activeColorTarget.variantIndex,
          'color',
          selectedValue
        );
      }

      setAddColorModalOpen(false);
      setActiveColorTarget(null);
    } catch (e: unknown) {
      setColorError((e as Error).message || 'Failed to create color');
    } finally {
      setColorSaving(false);
    }
  };

  // Computed Totals
  const totalPieces = useMemo(() => {
    return productGroups.reduce(
      (acc, g) => acc + g.variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0),
      0
    );
  }, [productGroups]);

  const totalVariantsCount = useMemo(() => {
    return productGroups.reduce((acc, g) => acc + g.variants.length, 0);
  }, [productGroups]);

  const getGroupTotal = (group: ProductGroup) => {
    return group.variants.reduce((acc, v) => acc + (Number(v.quantity) || 0), 0);
  };

  // Submit Production Order
  const handleCreate = async () => {
    if (!form.title.trim()) {
      setError('Order Title is required');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!form.customer_id) {
      setError('Please select a Buyer in Order Information');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (productGroups.length === 0) {
      setError('At least one product line is required');
      return;
    }

    // Comprehensive validation for each product group & its color variants
    for (let gIdx = 0; gIdx < productGroups.length; gIdx++) {
      const group = productGroups[gIdx];
      const lineNum = gIdx + 1;

      if (!group.product_id) {
        setError(`Please select a Product for Product Line #${lineNum}`);
        return;
      }

      if (!group.variants || group.variants.length === 0) {
        setError(`Product Line #${lineNum} must have at least one color variant`);
        return;
      }

      const seenColors = new Set<string>();
      for (let vIdx = 0; vIdx < group.variants.length; vIdx++) {
        const variant = group.variants[vIdx];
        const varNum = vIdx + 1;

        if (!variant.color || !variant.color.trim()) {
          setError(`Please select a Color Variant for Product Line #${lineNum}, color #${varNum}`);
          return;
        }

        const normalized = variant.color.trim().toLowerCase();
        if (seenColors.has(normalized)) {
          const prodObj = buyerProducts.find((p) => String(p.id) === String(group.product_id));
          const prodTitle = prodObj?.product_name || `Product Line #${lineNum}`;
          setError(
            `Duplicate color variant "${variant.color}" in "${prodTitle}". Each color variant for a product must be unique.`
          );
          return;
        }
        seenColors.add(normalized);

        if (!variant.quantity || variant.quantity <= 0) {
          setError(`Quantity for Product Line #${lineNum}, color "${variant.color}" must be greater than 0`);
          return;
        }
      }
    }

    setSaving(true);
    setError('');

    try {
      // Flatten product groups and their color variants into items array for the existing API
      const flatItems = productGroups.flatMap((group) =>
        group.variants.map((v) => ({
          product_id: parseInt(group.product_id, 10),
          color: v.color.trim(),
          total_quantity: Number(v.quantity),
        }))
      );

      const payload = {
        title: form.title.trim(),
        customer_id: form.customer_id ? parseInt(form.customer_id, 10) : null,
        category_id: form.category_id ? parseInt(form.category_id, 10) : 7,
        priority: form.priority,
        start_date: form.start_date,
        target_delivery_date: form.target_delivery_date,
        notes: form.notes.trim() || null,
        items: flatItems,
      };

      await api.createProductionOrder(payload);
      // Navigate back to orders list
      navigate('/production/orders');
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to create production order');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Page Header */}
      <PageHeader
        title="Create Production Order"
        subtitle="Configure manufacturing order parameters and product line specifications with multiple Pantone color variants"
        breadcrumb={[
          { label: 'Production' },
          { label: 'Orders', href: '/production/orders' },
          { label: 'Create Order' },
        ]}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="secondary"
              size="xs"
              className="sm:text-xs"
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/production/orders')}
            >
              <span className="hidden sm:inline">Back to Orders</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <Button
              variant="secondary"
              size="xs"
              className="sm:text-xs hidden xs:inline-flex"
              onClick={() => navigate('/production/orders')}
            >
              Cancel
            </Button>
            <Button
              loading={saving}
              size="sm"
              icon={<Check className="w-3.5 h-3.5 stroke-[2.5]" />}
              onClick={handleCreate}
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-xs"
            >
              <span className="hidden sm:inline">Create Order</span>
              <span className="sm:hidden font-bold">Create</span>
            </Button>
          </div>
        }
      />

      {/* Main Content Area */}
      <div className="flex-1 p-3 sm:p-5 md:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6 pb-28 md:pb-12">
        {/* Error banner */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 shadow-xs">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Section 1: Order Details */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Order Information & Scheduling
              </h2>
            </div>
            <span className="text-[10px] sm:text-[11px] text-slate-400 hidden xs:inline">* Required fields</span>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              <div className="lg:col-span-4">
                <FormField
                  label="Order Title"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Export Linen Bedding Contract - Multi-Color Suite"
                />
              </div>

              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-600">Buyer Selection</label>
                  <button
                    type="button"
                    onClick={handleOpenNewBuyer}
                    className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 transition"
                  >
                    <Plus className="w-3 h-3" />
                    New Buyer
                  </button>
                </div>
                <SearchableSelect
                  placeholder="— Select Buyer —"
                  searchPlaceholder="Search buyer by name, code..."
                  options={customerOptions}
                  value={form.customer_id}
                  onChange={(val) => handleBuyerChange(val)}
                  clearable
                  actionButton={{
                    label: '+ Add New Buyer',
                    onClick: handleOpenNewBuyer,
                  }}
                />
              </div>

              <div>
                <SearchableSelect
                  label="Priority"
                  placeholder="Select Priority"
                  searchPlaceholder="Search priority..."
                  options={priorityOptions}
                  value={form.priority}
                  onChange={(val) => setForm((f) => ({ ...f, priority: val }))}
                  clearable={false}
                />
              </div>

              <div>
                <FormField
                  label="Start Date"
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>

              <div>
                <FormField
                  label="Target Delivery Date"
                  type="date"
                  required
                  value={form.target_delivery_date}
                  onChange={(e) => setForm((f) => ({ ...f, target_delivery_date: e.target.value }))}
                />
              </div>

              <div className="lg:col-span-4">
                <FormField
                  as="textarea"
                  label="Production Notes / Instructions"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional manufacturing specifications, packaging details, or batch notes..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Product Lines & Color Variants */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-4 h-4 text-brand-600 shrink-0" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 truncate">
                Product Lines & Variants
              </h2>
              <span className="px-2 py-0.5 text-[10px] sm:text-[11px] font-bold bg-brand-50 text-brand-700 rounded-full border border-brand-200 shrink-0">
                {productGroups.length} {productGroups.length === 1 ? 'Product Line' : 'Product Lines'}
              </span>
              <span className="px-2 py-0.5 text-[10px] sm:text-[11px] font-medium bg-slate-100 text-slate-600 rounded-full border border-slate-200 shrink-0">
                {totalVariantsCount} {totalVariantsCount === 1 ? 'Color Variant' : 'Color Variants'}
              </span>
            </div>
            <Button
              variant="secondary"
              size="xs"
              className="sm:text-xs"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleAddProductGroup}
            >
              <span className="hidden sm:inline">Add Product Line</span>
              <span className="sm:hidden font-semibold">+ Line</span>
            </Button>
          </div>

          <div className="p-3.5 sm:p-5">
            {!form.customer_id && (
              <div className="mb-4 p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Please select a <strong>Buyer</strong> above in Order Information to view and select their configured products.
                </span>
              </div>
            )}

            {form.customer_id && !loadingBuyerProducts && buyerProducts.length === 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  No products are currently configured for this buyer in <strong>Buyer Master → Products & Packing</strong>. Please configure products for this buyer before creating an order.
                </span>
              </div>
            )}

            {/* List of Product Groups */}
            <div className="space-y-4 sm:space-y-5">
              {productGroups.map((group, gIdx) => {
                const groupTotal = getGroupTotal(group);
                const selectedProduct = buyerProducts.find((p) => String(p.id) === String(group.product_id));

                return (
                  <div
                    key={group.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:border-slate-300 transition-all"
                  >
                    {/* Product Group Card Header */}
                    <div className="px-3.5 sm:px-4 py-2.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          {gIdx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800 truncate">
                          Product Line #{gIdx + 1}
                        </span>
                        {selectedProduct && (
                          <span className="text-xs text-slate-600 truncate max-w-[200px] sm:max-w-none">
                            — <strong className="text-slate-800">{selectedProduct.product_name || selectedProduct.name}</strong>
                            {selectedProduct.product_code && (
                              <span className="font-mono text-slate-400 text-[11px] ml-1">
                                ({selectedProduct.product_code})
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Right stats & action buttons */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white rounded-md border border-slate-200 text-xs">
                          <span className="text-slate-500 text-[10px] uppercase font-semibold hidden xs:inline">Total:</span>
                          <span className="font-mono font-bold text-brand-700">{groupTotal.toLocaleString()} pcs</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {group.variants.length} {group.variants.length === 1 ? 'color' : 'colors'}
                          </span>
                        </div>

                        {/* Duplicate Product Line Action */}
                        <button
                          type="button"
                          onClick={() => handleDuplicateProductGroup(gIdx)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                          title="Duplicate this entire product line with all its variants"
                        >
                          <Copy className="w-4 h-4 text-slate-500 hover:text-brand-600" />
                        </button>

                        {/* Remove Product Line Action */}
                        <button
                          type="button"
                          disabled={productGroups.length <= 1}
                          onClick={() => handleRemoveProductGroup(gIdx)}
                          className={`p-1.5 rounded-md transition-colors ${
                            productGroups.length <= 1
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={productGroups.length <= 1 ? 'Order must have at least one product line' : 'Remove product line'}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>

                    {/* Product Group Body */}
                    <div className="p-3.5 sm:p-4 space-y-3.5">
                      {/* Product Selector */}
                      <div className="max-w-xl">
                        <SearchableSelect
                          label="Product *"
                          placeholder={
                            !form.customer_id
                              ? 'Select a buyer first'
                              : loadingBuyerProducts
                              ? 'Loading buyer products...'
                              : buyerProducts.length === 0
                              ? 'No products configured for this buyer'
                              : '— Select Product —'
                          }
                          searchPlaceholder={
                            !form.customer_id
                              ? 'Select a buyer first'
                              : 'Search configured product by name, code...'
                          }
                          disabled={!form.customer_id || loadingBuyerProducts || buyerProducts.length === 0}
                          options={productOptions}
                          value={group.product_id}
                          onChange={(val) => handleProductChange(gIdx, val)}
                        />
                      </div>

                      {/* Color Variants Sub-section */}
                      <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 sm:p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                          <div className="flex items-center gap-1.5">
                            <Palette className="w-3.5 h-3.5 text-brand-600" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                              Pantone Color Variants & Quantities
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddColorVariant(gIdx)}
                            className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 bg-white hover:bg-brand-50 px-2 py-0.5 rounded border border-brand-200 flex items-center gap-1 transition shadow-2xs"
                          >
                            <Plus className="w-3 h-3 stroke-[2.5]" />
                            <span>Add Color Variant</span>
                          </button>
                        </div>

                        {/* Variant Rows */}
                        <div className="space-y-2">
                          {group.variants.map((variant, vIdx) => {
                            const swatch = getColorDetails(variant.color);
                            const isDup = variant.color ? isColorDuplicateInGroup(gIdx, vIdx, variant.color) : false;

                            return (
                              <div
                                key={variant.id}
                                className={`p-2.5 rounded-lg border transition-all ${
                                  isDup
                                    ? 'border-red-300 bg-red-50/50'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                              >
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                                  {/* Line Index & Swatch Thumbnail */}
                                  <div className="hidden md:flex md:col-span-1 items-center justify-center gap-1.5">
                                    <span className="text-[10px] font-mono text-slate-400 font-bold">
                                      #{vIdx + 1}
                                    </span>
                                    {swatch ? (
                                      <div
                                        className="w-4 h-4 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                                        style={{ backgroundColor: swatch.hex }}
                                        title={`${swatch.name} (${swatch.code || swatch.hex})`}
                                      />
                                    ) : (
                                      <div className="w-4 h-4 rounded-full border border-dashed border-slate-300 shrink-0" />
                                    )}
                                  </div>

                                  {/* Color Selector */}
                                  <div className="md:col-span-6">
                                    <div className="flex items-center gap-1.5">
                                      {/* Mobile-only swatch display */}
                                      <div className="md:hidden">
                                        {swatch ? (
                                          <div
                                            className="w-5 h-5 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                                            style={{ backgroundColor: swatch.hex }}
                                            title={`${swatch.name} (${swatch.code || swatch.hex})`}
                                          />
                                        ) : (
                                          <div className="w-5 h-5 rounded-full border border-dashed border-slate-300 shrink-0" />
                                        )}
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <SearchableSelect
                                          placeholder="— Select Pantone Color —"
                                          searchPlaceholder="Search color by name, Pantone code, or HEX..."
                                          options={colorOptions}
                                          value={variant.color}
                                          onChange={(val) => handleVariantChange(gIdx, vIdx, 'color', val)}
                                          actionButton={{
                                            label: 'Add New Color',
                                            icon: <Palette className="w-3.5 h-3.5 text-brand-600" />,
                                            onClick: () => handleOpenAddColor(gIdx, vIdx),
                                          }}
                                        />
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenAddColor(gIdx, vIdx)}
                                        className="p-1.5 sm:p-2 border border-slate-300 hover:border-brand-400 bg-white hover:bg-brand-50 text-slate-500 hover:text-brand-600 rounded-md transition-colors shrink-0"
                                        title="Create new color in Colors Master"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {isDup && (
                                      <div className="text-[10px] text-red-600 font-medium mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3 shrink-0" />
                                        Duplicate color variant in this product. Each color variant must be unique.
                                      </div>
                                    )}
                                  </div>

                                  {/* Swatch & Pantone Info Tag (Desktop) */}
                                  <div className="md:col-span-2 hidden md:block">
                                    {swatch ? (
                                      <div className="flex items-center gap-1 text-[11px] text-slate-600 truncate">
                                        {swatch.code ? (
                                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 truncate">
                                            {swatch.code}
                                          </span>
                                        ) : (
                                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">
                                            {swatch.hex}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">No color selected</span>
                                    )}
                                  </div>

                                  {/* Quantity Input */}
                                  <div className="md:col-span-2">
                                    <div className="relative">
                                      <input
                                        type="number"
                                        min="1"
                                        value={variant.quantity || ''}
                                        onChange={(e) =>
                                          handleVariantChange(
                                            gIdx,
                                            vIdx,
                                            'quantity',
                                            parseInt(e.target.value, 10) || 0
                                          )
                                        }
                                        className="w-full px-2.5 py-1.5 text-xs text-right font-mono font-semibold bg-white border border-slate-300 rounded-md focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-800 pr-8"
                                        placeholder="Qty"
                                      />
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400 pointer-events-none">
                                        pcs
                                      </span>
                                    </div>
                                  </div>

                                  {/* Remove Variant Action */}
                                  <div className="md:col-span-1 flex items-center justify-end">
                                    <button
                                      type="button"
                                      disabled={group.variants.length <= 1}
                                      onClick={() => handleRemoveColorVariant(gIdx, vIdx)}
                                      className={`p-1.5 rounded transition-colors ${
                                        group.variants.length <= 1
                                          ? 'text-slate-300 cursor-not-allowed'
                                          : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                      }`}
                                      title={group.variants.length <= 1 ? 'Product must have at least one color variant' : 'Remove color variant'}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Product Group Subtotal Footer */}
                        <div className="pt-2 flex items-center justify-between text-xs text-slate-600 border-t border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => handleAddColorVariant(gIdx)}
                            className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Another Color Variant</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500">Product Line Total:</span>
                            <span className="font-mono font-bold text-xs text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                              {groupTotal.toLocaleString()} pcs
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom summary bar of product lines */}
            <div className="mt-4 pt-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 p-3 rounded-xl">
              <button
                type="button"
                onClick={handleAddProductGroup}
                className="w-full sm:w-auto text-xs text-brand-600 hover:text-brand-700 font-bold flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-brand-200 bg-white hover:bg-brand-50 transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Another Product Line</span>
              </button>

              <div className="flex items-center gap-3 text-xs w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-slate-500">
                  Products: <strong className="text-slate-800 font-semibold">{productGroups.length}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  Colors: <strong className="text-slate-800 font-semibold">{totalVariantsCount}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  Total Order Quantity:{' '}
                  <strong className="text-brand-700 font-mono text-sm font-bold">
                    {totalPieces.toLocaleString()} pcs
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Footer Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Target Delivery: <strong className="text-slate-800">{form.target_delivery_date || 'Not set'}</strong>
              </span>
            </div>
            <div className="sm:hidden font-mono font-bold text-brand-700">
              {totalPieces.toLocaleString()} pcs
            </div>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <Button
              variant="secondary"
              className="flex-1 sm:flex-none"
              onClick={() => navigate('/production/orders')}
            >
              Cancel
            </Button>
            <Button
              loading={saving}
              icon={<Check className="w-3.5 h-3.5 stroke-[2.5]" />}
              onClick={handleCreate}
              className="flex-1 sm:flex-none bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-xs"
            >
              Create Production Order
            </Button>
          </div>
        </div>
      </div>

      {/* Add Color Compact Modal (Pantone Lookup + Custom RGB/HEX Fallback) */}
      <Modal
        open={addColorModalOpen}
        onClose={() => setAddColorModalOpen(false)}
        title="Add New Pantone Color"
        size="md"
      >
        <div className="space-y-4">
          {colorError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{colorError}</span>
            </div>
          )}

          {/* 1. Pantone Color Code Input */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Pantone Color Code <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={colorPantoneInput}
                onChange={(e) => setColorPantoneInput(e.target.value)}
                placeholder="Enter Pantone code (e.g., 19-4052 TCX, 100 C, or custom code)"
                className={`w-full px-3 py-2 text-xs font-mono font-medium rounded-lg border transition-all duration-150 pr-9 ${
                  colorIsVerified
                    ? 'border-emerald-400 bg-emerald-50/20 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200'
                    : colorIsCustomMode
                    ? 'border-amber-300 bg-amber-50/15 text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-200'
                    : 'border-slate-300 bg-white text-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-200'
                }`}
                autoFocus
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                {colorLookupLoading ? (
                  <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                ) : colorIsVerified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : colorIsCustomMode ? (
                  <Sliders className="w-4 h-4 text-amber-500" />
                ) : null}
              </div>
            </div>

            {/* Validation & Status Indicator */}
            <div className="mt-1.5 min-h-[18px]">
              {colorLookupLoading && (
                <div className="flex items-center gap-1.5 text-[11px] text-brand-600">
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  <span>Looking up Pantone reference library & database...</span>
                </div>
              )}
              {!colorLookupLoading && colorIsVerified && colorVerifiedInfo && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Verified ${colorVerifiedInfo.system} (${colorVerifiedInfo.category})</span>
                </div>
              )}
              {!colorLookupLoading && colorIsCustomMode && (
                <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-md">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Custom / Unlisted Pantone Color:</strong> Code not found in the reference library. You can enter the <strong>Color Name</strong> and digital <strong>RGB / HEX</strong> values below.
                  </div>
                </div>
              )}
              {!colorLookupLoading && !colorIsCustomMode && !colorIsVerified && !colorPantoneInput && (
                <p className="text-[11px] text-slate-400">
                  Type or paste a textile Pantone code (e.g. 19-4052 TCX, PANTONE 100 C) or enter any custom code.
                </p>
              )}
            </div>
          </div>

          {/* 2. Color Name Field */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center justify-between">
              <span>Color Name <span className="text-red-500">*</span></span>
              <span className="text-[10px] text-slate-400 font-normal">
                {colorIsVerified ? '(official reference, verified)' : '(manually enter or edit name)'}
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
                readOnly={colorIsVerified}
                placeholder={
                  colorLookupLoading
                    ? 'Looking up color name...'
                    : colorIsVerified
                    ? colorName
                    : 'Enter color name (e.g. Classic Navy, Custom Red)'
                }
                className={`w-full px-3 py-2 text-xs rounded-lg border transition-all ${
                  colorIsVerified
                    ? 'bg-slate-50 border-slate-200 text-slate-900 font-semibold cursor-default select-text'
                    : 'bg-white border-slate-300 text-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-200'
                }`}
              />
              {colorIsVerified && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
                    Verified
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Digital Color Swatch & Manual RGB / HEX Specification */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 block">Digital Color Specification</span>
                <span className="text-[10px] text-slate-500">
                  {colorIsVerified
                    ? 'Official representative digital color (sRGB & Hex)'
                    : 'Enter HEX value, adjust RGB numbers (0-255), or click the swatch to pick'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-lg border border-slate-300 shrink-0 shadow-2xs flex items-center justify-center transition-all cursor-pointer overflow-hidden"
                    style={{ backgroundColor: colorHexCode || '#0F2042' }}
                    title="Click to pick or adjust color"
                  >
                    {!colorIsVerified && (
                      <input
                        type="color"
                        value={colorHexCode.startsWith('#') && colorHexCode.length === 7 ? colorHexCode : '#0F2042'}
                        onChange={(e) => handleColorHexChange(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        title="Click to choose custom color visually"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* HEX & RGB inputs row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200/60">
              <div className="sm:col-span-1">
                <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                  HEX Code
                </label>
                <input
                  type="text"
                  value={colorHexCode}
                  onChange={(e) => handleColorHexChange(e.target.value)}
                  readOnly={colorIsVerified}
                  maxLength={7}
                  placeholder="#000000"
                  className={`w-full px-2 py-1 text-xs font-mono font-semibold rounded border ${
                    colorIsVerified
                      ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-default'
                      : 'bg-white border-slate-300 text-slate-800 focus:border-brand-500'
                  }`}
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-[10px] font-semibold text-red-600 block mb-0.5">
                  Red (0-255)
                </label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={colorRgb.r}
                  onChange={(e) => handleColorRgbChange('r', e.target.value)}
                  readOnly={colorIsVerified}
                  className={`w-full px-2 py-1 text-xs font-mono rounded border ${
                    colorIsVerified
                      ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-default'
                      : 'bg-white border-slate-300 text-slate-800 focus:border-red-400'
                  }`}
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-[10px] font-semibold text-emerald-600 block mb-0.5">
                  Green (0-255)
                </label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={colorRgb.g}
                  onChange={(e) => handleColorRgbChange('g', e.target.value)}
                  readOnly={colorIsVerified}
                  className={`w-full px-2 py-1 text-xs font-mono rounded border ${
                    colorIsVerified
                      ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-default'
                      : 'bg-white border-slate-300 text-slate-800 focus:border-emerald-400'
                  }`}
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-[10px] font-semibold text-blue-600 block mb-0.5">
                  Blue (0-255)
                </label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={colorRgb.b}
                  onChange={(e) => handleColorRgbChange('b', e.target.value)}
                  readOnly={colorIsVerified}
                  className={`w-full px-2 py-1 text-xs font-mono rounded border ${
                    colorIsVerified
                      ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-default'
                      : 'bg-white border-slate-300 text-slate-800 focus:border-blue-400'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Verified Specification Summary Banner */}
          {colorIsVerified && colorVerifiedInfo && (
            <div className="p-2.5 bg-gradient-to-r from-slate-50 to-emerald-50/40 border border-emerald-200/80 rounded-lg flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-6 h-6 rounded-md border border-slate-300 shadow-2xs shrink-0"
                  style={{ backgroundColor: colorHexCode }}
                />
                <div>
                  <div className="font-semibold text-slate-900">{colorName}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {colorVerifiedInfo.code} &bull; {colorVerifiedInfo.category}
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                {colorVerifiedInfo.system}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setAddColorModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              loading={colorSaving}
              disabled={colorSaving || colorLookupLoading || !colorPantoneInput.trim() || !colorName.trim()}
              onClick={handleSaveColor}
            >
              Save & Select Color
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quick Add Buyer Modal with Avatar Selection */}
      <Modal
        open={addBuyerModalOpen}
        onClose={() => setAddBuyerModalOpen(false)}
        title="Add New Buyer"
        size="md"
      >
        <div className="space-y-4">
          {buyerError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {buyerError}
            </div>
          )}

          {/* Avatar Preview & Quick Customizer */}
          <div className="bg-gradient-to-r from-brand-50/60 via-indigo-50/40 to-slate-50 border border-brand-200/80 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BuyerAvatar
                style={buyerAvatarStyle}
                seed={buyerAvatarSeed || 'buyer-new'}
                config={buyerAvatarConfig}
                size="lg"
                shape="circle"
                className="shadow-sm ring-2 ring-white"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">Cartoon Avatar</span>
                  <span className="text-[10px] uppercase font-semibold text-brand-700 bg-brand-100/70 px-1.5 py-0.2 rounded">
                    {buyerAvatarStyle}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setBuyerAvatarModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-800"
                  >
                    <Sparkles className="w-3 h-3" />
                    Pick Character
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleRandomizeBuyerAvatar}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                    title="Generate random character"
                  >
                    <Dices className="w-3 h-3 text-slate-400" />
                    Roll
                  </button>
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              size="xs"
              onClick={() => setBuyerAvatarModalOpen(true)}
              className="text-xs"
            >
              Gallery
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <FormField
                label="Buyer Name / Company"
                required
                value={buyerForm.name}
                onChange={(e) => setBuyerForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. ABC Textiles Ltd"
              />
            </div>
            <FormField
              label="Contact Person"
              value={buyerForm.contact_person}
              onChange={(e) => setBuyerForm((f) => ({ ...f, contact_person: e.target.value }))}
              placeholder="e.g. John Doe"
            />
            <FormField
              label="Phone Number"
              required
              value={buyerForm.phone}
              onChange={(e) => setBuyerForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="e.g. +91 98765 43210"
            />
            <div className="sm:col-span-2">
              <FormField
                label="Email Address"
                type="email"
                value={buyerForm.email}
                onChange={(e) => setBuyerForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="buyer@example.com"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setAddBuyerModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={buyerSaving} onClick={handleSaveNewBuyer}>
              Save & Select Buyer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Avatar Selection Modal for Quick Buyer */}
      <AvatarSelectorModal
        open={buyerAvatarModalOpen}
        onClose={() => setBuyerAvatarModalOpen(false)}
        initialStyle={buyerAvatarStyle}
        initialSeed={buyerAvatarSeed}
        initialConfig={buyerAvatarConfig}
        buyerName={buyerForm.name || 'New Buyer'}
        buyerCode={`BUY-${customers.length + 1}`}
        onSelect={(selection) => {
          setBuyerAvatarStyle(selection.avatar_style);
          setBuyerAvatarSeed(selection.avatar_seed);
          setBuyerAvatarConfig(selection.avatar_config);
        }}
      />
    </div>
  );
}
