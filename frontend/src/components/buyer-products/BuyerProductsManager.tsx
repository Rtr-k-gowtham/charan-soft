// frontend/src/components/buyer-products/BuyerProductsManager.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Buyer, BuyerProduct } from '../../types';
import { api } from '../../lib/api';
import PageHeader from '../ui/PageHeader';
import DataTable, { Column } from '../ui/DataTable';
import Button from '../ui/Button';
import BuyerProductModal from './BuyerProductModal';
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Package,
  Layers,
  Ruler,
  Box,
  Eye,
  Pencil,
  Trash2,
  Scissors,
} from 'lucide-react';

interface Props {
  buyer: Buyer;
  onBack: () => void;
}

export default function BuyerProductsManager({ buyer, onBack }: Props) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<BuyerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<BuyerProduct | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      let serverList: any[] = [];
      try {
        const res = await api.getBuyerProducts(buyer.id);
        const rawList = Array.isArray(res) ? res : (res as any)?.data || [];
        serverList = rawList;
      } catch (err) {
        console.warn('API getBuyerProducts failed or returned error', err);
      }

      // Filter out any customer objects erroneously returned
      const validServerProducts = serverList.filter((p: any) => {
        if (!p || typeof p !== 'object') return false;
        // Ignore customer records
        if (p.contact_person && !p.product_name) return false;
        if (p.billing_address && !p.product_name) return false;
        if (p.gstin && !p.product_name) return false;
        return Boolean(p.product_name || p.name);
      });

      // Local storage fallback
      const localKey = `cheran_buyer_products_${buyer.id}`;
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
      // First add local products
      localList.forEach((p: any) => {
        const key = p.id || p.product_code || p.product_name;
        map.set(key, p);
      });
      // Server products take precedence
      validServerProducts.forEach((p: any) => {
        const key = p.id || p.product_code || p.product_name;
        map.set(key, p);
      });

      const normalized: BuyerProduct[] = Array.from(map.values()).map((p: any, idx: number) => ({
        ...p,
        buyer_id: buyer.id,
        product_name: p.product_name || p.name || 'Product',
        product_code:
          p.product_code ||
          p.code ||
          `BPRD-${String(p.id || idx + 1).padStart(3, '0')}`,
        uom: p.uom || 'Pieces',
        dimensions: p.dimensions || null,
        cutting_size: p.cutting_size || null,
        components: p.components || [],
        boxes: p.boxes || [],
      }));

      setProducts(normalized);
    } catch (err) {
      console.error('Failed to load buyer products', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [buyer.id]);

  const handleSaveProduct = async (productData: Partial<BuyerProduct>) => {
    const localKey = `cheran_buyer_products_${buyer.id}`;
    let localList: any[] = [];
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) localList = JSON.parse(stored) || [];
    } catch {}

    try {
      if (editingProduct?.id) {
        await api.updateBuyerProduct(buyer.id, editingProduct.id, productData);
        localList = localList.map((p) =>
          p.id === editingProduct.id
            ? { ...p, ...productData, id: p.id, buyer_id: buyer.id }
            : p
        );
      } else {
        const res = await api.createBuyerProduct(buyer.id, productData);
        const serverData = (res as any)?.data || res;
        const newProd = {
          ...productData,
          id: serverData?.id || Date.now(),
          buyer_id: buyer.id,
          product_name: productData.product_name || 'New Product',
          product_code:
            serverData?.product_code ||
            productData.product_code ||
            `BPRD-${String(localList.length + 1).padStart(3, '0')}`,
        };
        localList.push(newProd);
      }
      localStorage.setItem(localKey, JSON.stringify(localList));
      await loadProducts();
    } catch (err) {
      console.error('Failed to save product on server', err);
      // Fallback: save locally
      if (editingProduct?.id) {
        localList = localList.map((p) =>
          p.id === editingProduct.id
            ? { ...p, ...productData, id: p.id, buyer_id: buyer.id }
            : p
        );
      } else {
        const fallbackProd = {
          ...productData,
          id: Date.now(),
          buyer_id: buyer.id,
          product_name: productData.product_name || 'New Product',
          product_code:
            productData.product_code || `BPRD-${String(localList.length + 1).padStart(3, '0')}`,
        };
        localList.push(fallbackProd);
      }
      localStorage.setItem(localKey, JSON.stringify(localList));
      await loadProducts();
    }
  };

  const handleDeleteProduct = async (productId: number | string) => {
    if (!window.confirm('Are you sure you want to delete this buyer product configuration?')) return;
    try {
      await api.deleteBuyerProduct(buyer.id, productId).catch(() => null);
      const localKey = `cheran_buyer_products_${buyer.id}`;
      try {
        const stored = localStorage.getItem(localKey);
        if (stored) {
          const list = (JSON.parse(stored) || []).filter(
            (p: any) => String(p.id) !== String(productId)
          );
          localStorage.setItem(localKey, JSON.stringify(list));
        }
      } catch {}
      setProducts((prev) => prev.filter((p) => String(p.id) !== String(productId)));
      await loadProducts();
    } catch (err) {
      console.error('Failed to delete product', err);
    }
  };

  const openCreate = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const openView = (p: BuyerProduct) => {
    navigate(`/masters/buyers/${buyer.id}/products/${p.id}`);
  };

  const openEdit = (p: BuyerProduct) => {
    setEditingProduct(p);
    setModalOpen(true);
  };

  // Standard Master DataTable Columns
  const columns: Column<BuyerProduct>[] = [
    {
      key: 'image_url',
      label: 'Photo',
      width: '56px',
      render: (r: BuyerProduct) => (
        <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
          {r.image_url ? (
            <img src={r.image_url} alt={r.product_name} className="w-full h-full object-cover" />
          ) : (
            <Package className="w-4 h-4 text-slate-300" />
          )}
        </div>
      ),
    },
    {
      key: 'product_code',
      label: 'Code',
      sortable: true,
      width: '100px',
      render: (r: BuyerProduct) => (
        <span className="font-mono text-[11px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
          {r.product_code || '—'}
        </span>
      ),
    },
    {
      key: 'product_name',
      label: 'Product Name',
      sortable: true,
      render: (r: BuyerProduct) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openView(r);
          }}
          className="text-left flex flex-col group cursor-pointer"
          title="Click to view product details"
        >
          <span className="font-semibold text-slate-900 text-xs group-hover:text-brand-600 transition underline-offset-2 group-hover:underline">
            {r.product_name}
          </span>
          {r.notes ? (
            <span className="text-[11px] text-slate-400 line-clamp-1">{r.notes}</span>
          ) : null}
        </button>
      ),
    },
    {
      key: 'uom',
      label: 'UOM',
      width: '80px',
      render: (r: BuyerProduct) => (
        <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          {r.uom || 'Pieces'}
        </span>
      ),
    },
    {
      key: 'dimensions',
      label: 'Dimensions & Vol.',
      render: (r: BuyerProduct) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs text-slate-800 flex items-center gap-1">
            <Ruler className="w-3 h-3 text-brand-600 shrink-0" />
            {r.dimensions?.length || 0}×{r.dimensions?.width || 0}×{r.dimensions?.height || 0}{' '}
            <span className="text-[10px] text-slate-400 font-normal">{r.dimensions?.unit || 'cm'}</span>
          </span>
          <span className="text-[10px] text-purple-600 font-mono">
            {r.dimensions?.calculated_volume_cm3?.toLocaleString() || 0} cm³
          </span>
        </div>
      ),
    },
    {
      key: 'components',
      label: 'Raw Materials (BOM)',
      render: (r: BuyerProduct) => {
        const count = r.components?.length || 0;
        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="font-semibold text-slate-800 text-xs">
                {count} {count === 1 ? 'Material' : 'Materials'}
              </span>
            </div>
            {count > 0 ? (
              <div className="flex flex-wrap gap-1">
                {r.components.slice(0, 2).map((c, i) => (
                  <span
                    key={i}
                    className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[120px]"
                    title={`${c.name} (${c.category})`}
                  >
                    {c.name}
                  </span>
                ))}
                {count > 2 && (
                  <span className="text-[10px] bg-brand-50 text-brand-700 px-1 py-0.5 rounded font-semibold border border-brand-200">
                    +{count - 2}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-400 text-[11px] italic">No BOM defined</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'boxes',
      label: 'Box Packing',
      render: (r: BuyerProduct) => {
        const primaryBox = r.boxes?.[0];
        const boxCount = r.boxes?.length || 0;
        if (!primaryBox) {
          return <span className="text-slate-400 text-[11px] italic">No carton configured</span>;
        }
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <span className="font-semibold text-slate-800 text-xs truncate max-w-[140px]">
                {primaryBox.box_name}
              </span>
              {boxCount > 1 && (
                <span className="text-[9px] bg-brand-50 text-brand-700 px-1 py-0.2 rounded font-semibold border border-brand-200">
                  +{boxCount - 1}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {primaryBox.items_per_box} pcs/box • {primaryBox.length}×{primaryBox.width}×{primaryBox.height}{' '}
              {primaryBox.dimension_unit}
            </span>
          </div>
        );
      },
    },
    {
      key: 'cutting_size',
      label: 'Cutting Size',
      render: (r: BuyerProduct) => {
        if (!r.cutting_size || (!r.cutting_size.cutting_length && !r.cutting_size.cutting_width)) {
          return <span className="text-slate-400 text-[11px] italic">Not set</span>;
        }
        return (
          <div className="flex flex-col">
            <span className="font-mono text-xs text-slate-800 flex items-center gap-1 font-semibold">
              <Scissors className="w-3 h-3 text-emerald-600 shrink-0" />
              {r.cutting_size.cutting_length}×{r.cutting_size.cutting_width}
              {r.cutting_size.cutting_height ? `×${r.cutting_size.cutting_height}` : ''}{' '}
              <span className="text-[10px] text-slate-400 font-normal">{r.cutting_size.unit || 'cm'}</span>
            </span>
            {r.cutting_size.notes ? (
              <span className="text-[10px] text-slate-500 truncate max-w-[160px]" title={r.cutting_size.notes}>
                {r.cutting_size.notes}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">
                {r.cutting_size.cutting_height ? '3D Gusset Cut' : 'Flat Piece'}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: '90px',
      render: (r: BuyerProduct) => {
        const isReady = (r.components?.length || 0) > 0 && (r.boxes?.length || 0) > 0;
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
              isReady
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isReady ? 'Ready' : 'Incomplete'}
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader
        title={`${buyer.name} — Products & Packing`}
        subtitle={`Configure client-specific product catalog, BOM materials, dimensions, and carton box packing`}
        breadcrumb={[
          { label: 'Masters' },
          { label: 'Buyer Master' },
          { label: buyer.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 bg-white text-slate-700 font-medium transition cursor-pointer"
              title="Return to Buyer Master"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Buyers</span>
            </button>
            <button
              onClick={loadProducts}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 bg-white transition cursor-pointer"
              title="Refresh product list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>
              Add Product
            </Button>
          </div>
        }
      />

      {/* Main Table Content using standard ERP DataTable template */}
      <div className="flex-1 overflow-hidden p-2.5 sm:p-4">
        <div className="bg-transparent sm:bg-white sm:rounded-lg sm:border sm:border-slate-200 flex flex-col h-full sm:shadow-xs border-0">
          <DataTable
            data={products}
            columns={columns}
            rowKey="id"
            onRowClick={openView}
            emptyMessage={`No products configured for ${buyer.name}. Click "+ Add Product" to configure the first item.`}
            actions={(r: BuyerProduct) => (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => openView(r)}
                  className="p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-slate-100 transition cursor-pointer"
                  title="View Details"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-slate-100 transition cursor-pointer"
                  title="Edit Product"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(r.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer"
                  title="Delete Product"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          />
        </div>
      </div>

      {/* Product Configuration Drawer/Modal */}
      {modalOpen && (
        <BuyerProductModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          buyerId={buyer.id}
          buyerName={buyer.name}
          initialProduct={editingProduct}
          onSave={handleSaveProduct}
        />
      )}
    </div>
  );
}
