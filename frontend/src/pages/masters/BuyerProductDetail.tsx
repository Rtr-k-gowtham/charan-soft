// frontend/src/pages/masters/BuyerProductDetail.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Buyer, BuyerProduct } from '../../types';
import { api } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import BuyerProductModal from '../../components/buyer-products/BuyerProductModal';
import {
  ArrowLeft,
  Pencil,
  Package,
  Layers,
  Ruler,
  Box,
  CheckCircle2,
  AlertCircle,
  FileText,
  Boxes,
  Calendar,
  RefreshCw,
  Scale,
} from 'lucide-react';

export default function BuyerProductDetail() {
  const { buyerId, productId } = useParams<{ buyerId: string; productId: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<BuyerProduct | null>(null);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Load product and buyer data
  const loadData = useCallback(async () => {
    if (!buyerId || !productId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch buyers to resolve buyer name and context
      let currentBuyer: Buyer | null = null;
      try {
        const buyersRes = await api.getBuyers();
        const buyersList = (Array.isArray(buyersRes) ? buyersRes : (buyersRes as any)?.data || []) as Buyer[];
        currentBuyer = buyersList.find((b) => String(b.id) === String(buyerId)) || null;
      } catch (err) {
        console.warn('Could not fetch buyers list', err);
      }
      setBuyer(currentBuyer);

      // 2. Fetch specific product using dedicated endpoint or list fallback
      let foundProduct: BuyerProduct | null = null;

      try {
        const prodRes = await api.getBuyerProduct(buyerId, productId);
        const prodData = (prodRes as any)?.data || prodRes;
        if (prodData && (prodData.product_name || prodData.name)) {
          foundProduct = prodData as BuyerProduct;
        }
      } catch (err) {
        console.warn('Direct api.getBuyerProduct failed, falling back to list', err);
      }

      if (!foundProduct) {
        // Fallback to getBuyerProducts list
        const prodsRes = await api.getBuyerProducts(buyerId);
        const prodsList = (Array.isArray(prodsRes) ? prodsRes : (prodsRes as any)?.data || []) as BuyerProduct[];
        foundProduct = prodsList.find((p) => String(p.id) === String(productId)) || null;
      }

      // Local storage fallback if offline or recently created locally
      if (!foundProduct) {
        try {
          const localStored = localStorage.getItem(`cheran_buyer_products_${buyerId}`);
          if (localStored) {
            const localList = JSON.parse(localStored) as BuyerProduct[];
            foundProduct = localList.find((p) => String(p.id) === String(productId)) || null;
          }
        } catch {}
      }

      if (foundProduct) {
        // Normalize fields
        const normalized: BuyerProduct = {
          ...foundProduct,
          product_name: foundProduct.product_name || (foundProduct as any).name || 'Unnamed Product',
          product_code: foundProduct.product_code || (foundProduct as any).code || `BPRD-${productId}`,
          uom: foundProduct.uom || 'Pieces',
          components: foundProduct.components || [],
          boxes: foundProduct.boxes || [],
          dimensions: foundProduct.dimensions || {
            length: 0,
            width: 0,
            height: 0,
            unit: 'cm',
            calculated_volume_cm3: 0,
            calculated_volume_m3: 0,
          },
        };
        setProduct(normalized);
      } else {
        setError(`Product #${productId} was not found for this buyer.`);
      }
    } catch (err: any) {
      console.error('Failed to load buyer product details', err);
      setError(err?.message || 'Failed to load buyer product details');
    } finally {
      setLoading(false);
    }
  }, [buyerId, productId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle saving product edits from the 4-step wizard
  const handleSaveProduct = async (updatedData: Partial<BuyerProduct>) => {
    if (!buyerId || !productId) return;
    try {
      await api.updateBuyerProduct(buyerId, productId, updatedData);

      // Also update local storage cache
      try {
        const localKey = `cheran_buyer_products_${buyerId}`;
        const stored = localStorage.getItem(localKey);
        if (stored) {
          const list = JSON.parse(stored) as any[];
          const idx = list.findIndex((p) => String(p.id) === String(productId));
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...updatedData };
            localStorage.setItem(localKey, JSON.stringify(list));
          }
        }
      } catch {}

      await loadData();
    } catch (err) {
      console.error('Failed to update product', err);
      // Fallback local update
      setProduct((prev) => (prev ? ({ ...prev, ...updatedData } as BuyerProduct) : null));
    }
  };

  const handleBackToProducts = () => {
    navigate(`/masters/buyers/${buyerId}/products`);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] p-6">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading buyer product specifications...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex flex-col gap-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-xs font-bold text-red-800">Product Not Found</h3>
            <p className="text-xs text-red-600 mt-1">{error || 'Unable to locate this buyer product.'}</p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleBackToProducts} icon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Buyer Products
              </Button>
              <Button size="sm" variant="secondary" onClick={loadData} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const buyerName = buyer?.name || `Buyer #${buyerId}`;
  const isReady = (product.components?.length || 0) > 0 && (product.boxes?.length || 0) > 0;
  const primaryBox = product.boxes?.[0];

  return (
    <div className="flex flex-col h-full bg-slate-50/50 overflow-y-auto">
      {/* 1. Header with Breadcrumbs & Actions */}
      <PageHeader
        title={product.product_name}
        subtitle={`Product Code: ${product.product_code || '—'} • Buyer: ${buyerName}`}
        breadcrumb={[
          { label: 'Masters' },
          { label: 'Buyer Master', href: '/masters/buyers' },
          { label: `${buyerName} Products`, href: `/masters/buyers/${buyerId}/products` },
          { label: product.product_name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={handleBackToProducts}
              title="Return to buyer product catalog"
            >
              Back to Products
            </Button>
            <Button
              variant="primary"
              icon={<Pencil className="w-3.5 h-3.5" />}
              onClick={() => setEditModalOpen(true)}
              title="Open four-step edit wizard"
            >
              Edit Product
            </Button>
          </div>
        }
      />

      {/* Main Container */}
      <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
        {/* Section E — Product Summary & Production Readiness Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-bold text-slate-900">{product.product_name}</h3>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-semibold border border-brand-200">
                    {product.product_code}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      isReady
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {isReady ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Ready for Production
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        Incomplete Configuration
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configured specifically for client <strong className="text-slate-700">{buyerName}</strong>
                </p>
              </div>
            </div>

            {product.created_at && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono self-start lg:self-auto">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Configured on {product.created_at.split(' ')[0]}</span>
              </div>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-4">
            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">BOM Materials</span>
              <span className="text-base font-bold text-slate-800 font-mono mt-0.5 block">
                {product.components?.length || 0}{' '}
                <span className="text-xs text-slate-500 font-normal font-sans">items</span>
              </span>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unit Dimensions</span>
              <span className="text-xs font-bold text-slate-800 font-mono mt-1 block truncate">
                {product.dimensions?.length || 0} × {product.dimensions?.width || 0} × {product.dimensions?.height || 0}{' '}
                <span className="text-[10px] text-slate-500 font-sans">{product.dimensions?.unit || 'cm'}</span>
              </span>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unit Volume</span>
              <span className="text-xs font-bold text-purple-700 font-mono mt-1 block">
                {product.dimensions?.calculated_volume_cm3?.toLocaleString() || 0} cm³
              </span>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Selected Carton</span>
              <span className="text-xs font-bold text-slate-800 mt-1 block truncate" title={primaryBox?.box_name || 'Not configured'}>
                {primaryBox?.box_name || '—'}
              </span>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/80 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Carton Capacity</span>
              <span className="text-base font-bold text-emerald-700 font-mono mt-0.5 block">
                {primaryBox?.items_per_box ? `${primaryBox.items_per_box} pcs` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Section A — General Information */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
            <FileText className="w-4 h-4 text-brand-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Section A &mdash; General Information & Tech Pack
            </h4>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left/Middle: Details */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] font-medium text-slate-500">Product Name</dt>
                <dd className="text-xs font-semibold text-slate-900 mt-0.5">{product.product_name}</dd>
              </div>

              <div>
                <dt className="text-[11px] font-medium text-slate-500">Product Code</dt>
                <dd className="text-xs font-mono font-semibold text-brand-700 mt-0.5">
                  {product.product_code || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-medium text-slate-500">Client / Buyer</dt>
                <dd className="text-xs font-semibold text-slate-800 mt-0.5">{buyerName}</dd>
              </div>

              <div>
                <dt className="text-[11px] font-medium text-slate-500">Unit of Measurement (UOM)</dt>
                <dd className="text-xs font-mono font-semibold text-slate-700 mt-0.5">
                  <span className="bg-slate-100 px-2 py-0.5 rounded">{product.uom}</span>
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-[11px] font-medium text-slate-500">Product Notes / Technical Pack Details</dt>
                <dd className="mt-1">
                  {product.notes ? (
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                      {product.notes}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No technical notes provided for this product.</p>
                  )}
                </dd>
              </div>
            </div>

            {/* Right: Photograph */}
            <div className="flex flex-col gap-2">
              <dt className="text-[11px] font-medium text-slate-500">Product Photograph</dt>
              <dd>
                {product.image_url ? (
                  <div className="w-full h-48 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shadow-2xs group relative">
                    <img
                      src={product.image_url}
                      alt={product.product_name}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="w-full h-48 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Package className="w-8 h-8 text-slate-300" />
                    <span className="text-xs font-medium">No photograph uploaded</span>
                  </div>
                )}
              </dd>
            </div>
          </div>
        </div>

        {/* Section B — Raw Materials & Components (Bill of Materials) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Section B &mdash; Raw Materials & Components (Bill of Materials)
              </h4>
            </div>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {product.components?.length || 0} configured items
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 min-w-[220px]">Material Name</th>
                  <th className="py-2.5 px-3 min-w-[150px]">Category</th>
                  <th className="py-2.5 px-3 min-w-[90px] text-center">UOM</th>
                  <th className="py-2.5 px-3 min-w-[120px] text-right">Qty / Finished Unit</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!product.components || product.components.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <p className="text-xs font-medium">No raw materials or components configured in this BOM.</p>
                      <button
                        type="button"
                        onClick={() => setEditModalOpen(true)}
                        className="mt-1.5 text-brand-600 text-xs font-semibold hover:underline cursor-pointer"
                      >
                        Click here to edit and configure materials
                      </button>
                    </td>
                  </tr>
                ) : (
                  product.components.map((comp, idx) => (
                    <tr key={comp.id || idx} className="hover:bg-slate-50/50 transition">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        <div className="flex flex-col">
                          <span>{comp.name || '—'}</span>
                          {comp.material_id ? (
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              Material ID: #{comp.material_id}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 font-medium">
                          {comp.category || 'General'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-700">
                        {comp.uom || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-700 text-xs">
                        {comp.quantity_per_product != null ? comp.quantity_per_product.toFixed(3) : '1.000'}{' '}
                        <span className="text-[10px] font-normal text-slate-500 font-sans">{comp.uom}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">{comp.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section C & D: Dimensions and Box Packing in 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section C — Dimensions & Volume */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
                <Ruler className="w-4 h-4 text-purple-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Section C &mdash; Dimensions & Volume
                </h4>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Length</span>
                  <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                    {product.dimensions?.length || 0}{' '}
                    <span className="text-[10px] text-slate-500 font-normal">{product.dimensions?.unit || 'cm'}</span>
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Width</span>
                  <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                    {product.dimensions?.width || 0}{' '}
                    <span className="text-[10px] text-slate-500 font-normal">{product.dimensions?.unit || 'cm'}</span>
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Height</span>
                  <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                    {product.dimensions?.height || 0}{' '}
                    <span className="text-[10px] text-slate-500 font-normal">{product.dimensions?.unit || 'cm'}</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-purple-500" />
                    Calculated Cubic Volume (cm³)
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-700">
                    {product.dimensions?.calculated_volume_cm3?.toLocaleString() || 0} cm³
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-slate-100">
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-purple-500" />
                    Calculated Cubic Volume (m³)
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-700">
                    {product.dimensions?.calculated_volume_m3 != null
                      ? product.dimensions.calculated_volume_m3.toFixed(4)
                      : '0.0000'}{' '}
                    m³
                  </span>
                </div>

                {product.dimensions?.weight_grams != null && product.dimensions.weight_grams > 0 && (
                  <div className="flex items-center justify-between py-1 border-t border-slate-100">
                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-slate-400" />
                      Individual Product Weight
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {product.dimensions.weight_grams} grams
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section D — Box Packing & Carton Rules */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-brand-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Section D &mdash; Box Packing & Master Carton
                  </h4>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                  {product.boxes?.length || 0} carton types
                </span>
              </div>

              {!product.boxes || product.boxes.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-xs font-medium">No carton packing rules configured for this product.</p>
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(true)}
                    className="mt-1.5 text-brand-600 text-xs font-semibold hover:underline cursor-pointer"
                  >
                    Click here to configure carton boxes
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {product.boxes.map((box, bIdx) => (
                    <div
                      key={box.id || bIdx}
                      className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-lg flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold text-slate-900">{box.box_name}</h5>
                            {box.box_code && (
                              <span className="font-mono text-[10px] bg-slate-200/70 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                                {box.box_code}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 mt-0.5 block">
                            Capacity:{' '}
                            <strong className="text-slate-800 font-mono">{box.items_per_box} finished units</strong> per carton
                          </span>
                        </div>

                        <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 shrink-0">
                          {box.items_per_box} pcs/box
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-[11px]">
                        <div>
                          <span className="text-slate-400">Carton Size: </span>
                          <span className="font-mono font-medium text-slate-700">
                            {box.length}×{box.width}×{box.height} {box.dimension_unit}
                          </span>
                        </div>
                        {box.calculated_volume_cm3 ? (
                          <div className="text-right">
                            <span className="text-slate-400">Volume: </span>
                            <span className="font-mono font-medium text-purple-700">
                              {box.calculated_volume_cm3.toLocaleString()} cm³
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {box.notes && (
                        <p className="text-[10px] text-slate-500 italic mt-0.5 border-t border-slate-200/40 pt-1">
                          {box.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Product Modal */}
      {editModalOpen && (
        <BuyerProductModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          buyerId={Number(buyerId)}
          buyerName={buyerName}
          initialProduct={product}
          onSave={handleSaveProduct}
        />
      )}
    </div>
  );
}
