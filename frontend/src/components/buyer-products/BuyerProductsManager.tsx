// frontend/src/components/buyer-products/BuyerProductsManager.tsx
import React, { useState, useEffect } from 'react';
import { Buyer, BuyerProduct } from '../../types';
import { api } from '../../lib/api';
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
  Edit2,
  Trash2,
  Sparkles,
  Search,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  buyer: Buyer;
  onBack: () => void;
}

export default function BuyerProductsManager({ buyer, onBack }: Props) {
  const [products, setProducts] = useState<BuyerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<BuyerProduct | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.getBuyerProducts(buyer.id);
      setProducts((res || []) as BuyerProduct[]);
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
    if (editingProduct?.id) {
      await api.updateBuyerProduct(buyer.id, editingProduct.id, productData);
    } else {
      await api.createBuyerProduct(buyer.id, productData);
    }
    await loadProducts();
  };

  const handleDeleteProduct = async (productId: number | string) => {
    if (!window.confirm('Are you sure you want to delete this buyer product configuration?')) return;
    try {
      await api.deleteBuyerProduct(buyer.id, productId);
      await loadProducts();
    } catch (err) {
      console.error('Failed to delete product', err);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.product_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.product_code && p.product_code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Top Buyer Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
              title="Back to Buyer Master"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{buyer.name}</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-semibold border border-brand-200">
                  {buyer.code}
                </span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full border border-emerald-200">
                  Active Buyer
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Contact: <span className="font-medium text-slate-700">{buyer.contact_person || '—'}</span> &bull;{' '}
                Phone: <span className="font-medium text-slate-700">{buyer.phone}</span>
                {buyer.gstin && (
                  <>
                    {' '}
                    &bull; GSTIN: <span className="font-mono text-slate-700">{buyer.gstin}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={loadProducts}
              disabled={loading}
              className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition"
              title="Refresh products"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingProduct(null);
                setModalOpen(true);
              }}
            >
              Add Buyer Product
            </Button>
          </div>
        </div>
      </div>

      {/* Catalog Workspace */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* Subheader and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              Configured Buyer Products ({products.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Each product manages custom BOM materials, folded dimensions, and authoritative box packaging
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search buyer products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-brand-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center bg-white border border-dashed border-slate-300 rounded-2xl shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No products configured for {buyer.name}</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Add garments and soft goods that this buyer purchases to define raw materials BOM, dimensional
              volume, and carton packing rules.
            </p>
            <Button
              className="mt-4"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setEditingProduct(null);
                setModalOpen(true);
              }}
            >
              Configure First Product
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProducts.map((p) => {
              const primaryBox = p.boxes?.[0];
              const boxCount = p.boxes?.length || 0;
              const componentCount = p.components?.length || 0;

              return (
                <div
                  key={p.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  {/* Top Image & Header */}
                  <div>
                    <div className="relative h-40 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Package className="w-8 h-8 stroke-[1.5]" />
                          <span className="text-[10px] mt-1 font-medium">No Image Uploaded</span>
                        </div>
                      )}
                      {p.product_code && (
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white font-mono text-[10px]">
                          {p.product_code}
                        </span>
                      )}
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-slate-800 font-semibold text-[10px] shadow-xs">
                        {p.uom || 'Pieces'}
                      </span>
                    </div>

                    <div className="p-4 flex flex-col gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{p.product_name}</h4>
                        {p.notes ? (
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{p.notes}</p>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic mt-0.5">No tech notes</p>
                        )}
                      </div>

                      {/* Quick Specification Chips */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                        {/* Dimensions & Volume */}
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                            <Ruler className="w-3 h-3 text-brand-600" />
                            Dimensions
                          </span>
                          <p className="text-xs font-semibold text-slate-700 font-mono mt-0.5">
                            {p.dimensions?.length || 0}×{p.dimensions?.width || 0}×{p.dimensions?.height || 0}{' '}
                            <span className="text-[10px] font-normal text-slate-400">{p.dimensions?.unit}</span>
                          </p>
                          <p className="text-[10px] text-purple-600 font-mono">
                            {p.dimensions?.calculated_volume_cm3?.toLocaleString() || 0} cm³
                          </p>
                        </div>

                        {/* BOM Components */}
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                            <Layers className="w-3 h-3 text-brand-600" />
                            Materials (BOM)
                          </span>
                          <p className="text-xs font-bold text-brand-700 mt-0.5">
                            {componentCount} {componentCount === 1 ? 'Component' : 'Components'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {p.components?.[0]?.name || 'No materials added'}
                          </p>
                        </div>
                      </div>

                      {/* Packing Box Information */}
                      <div className="bg-brand-50/40 border border-brand-100 p-2.5 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Box className="w-4 h-4 text-brand-600" />
                          <div>
                            <span className="text-[10px] font-semibold text-brand-900">
                              {primaryBox?.box_name || 'Box Packing'}
                            </span>
                            <p className="text-[10px] text-slate-500">
                              {primaryBox
                                ? `${primaryBox.items_per_box} pcs / box (${primaryBox.length}×${primaryBox.width}×${primaryBox.height} ${primaryBox.dimension_unit})`
                                : 'No box configured'}
                            </p>
                          </div>
                        </div>
                        {boxCount > 1 && (
                          <span className="text-[10px] bg-white px-1.5 py-0.5 rounded font-medium text-brand-700 shadow-2xs">
                            +{boxCount - 1} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Edit2 className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setEditingProduct(p);
                        setModalOpen(true);
                      }}
                    >
                      Configure
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(p.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Configuration Workspace Modal */}
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
