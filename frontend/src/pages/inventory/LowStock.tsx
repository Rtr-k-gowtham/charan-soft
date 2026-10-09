// src/pages/inventory/LowStock.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { StockBalance } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import { AlertTriangle, RefreshCw, ShoppingCart } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export default function LowStock() {
  const [items, setItems] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const inv = await api.getInventory() as StockBalance[];
      setItems((inv || []).filter(i => i.is_low_stock));
    } catch {
      setItems([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const columns = [
    { key: 'code', label: 'Code', sortable: true, render: (r: StockBalance) => <span className="font-mono text-[11px] font-semibold text-slate-600">{r.code}</span> },
    { key: 'name', label: 'Material', sortable: true, render: (r: StockBalance) => <span className="font-medium">{r.name}</span> },
    { key: 'category_name', label: 'Category', sortable: true },
    { key: 'uom', label: 'UOM' },
    { key: 'current_stock', label: 'Current Stock', sortable: true, render: (r: StockBalance) => (
      <span className={`font-mono font-bold ${r.current_stock === 0 ? 'text-red-700' : 'text-amber-600'}`}>{fmt(r.current_stock)}</span>
    )},
    { key: 'min_stock_level', label: 'Min Level', render: (r: StockBalance) => <span className="font-mono text-slate-500">{fmt(r.min_stock_level)}</span> },
    { key: 'shortage', label: 'Shortage', render: (r: StockBalance) => (
      <span className="font-mono font-bold text-red-700">−{fmt(Math.max(0, r.min_stock_level - r.current_stock))}</span>
    )},
    { key: 'severity', label: 'Severity', render: (r: StockBalance) => {
      const pct = Math.round((r.current_stock / r.min_stock_level) * 100);
      const color = pct === 0 ? 'bg-red-100 text-red-800' : pct < 50 ? 'bg-orange-100 text-orange-800' : 'bg-amber-100 text-amber-800';
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${pct === 0 ? 'bg-red-500' : pct < 50 ? 'bg-orange-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${color}`}>{pct === 0 ? 'OUT' : pct < 50 ? 'CRITICAL' : 'LOW'}</span>
        </div>
      );
    }},
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Low Stock Alert"
        subtitle="Materials below minimum stock levels requiring reorder"
        breadcrumb={[{ label: 'Inventory' }, { label: 'Low Stock' }]}
        actions={<button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>}
      />

      {items.length > 0 && (
        <div className="px-4 pt-3 pb-0">
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span><strong>{items.length} material{items.length !== 1 ? 's' : ''}</strong> {items.length !== 1 ? 'are' : 'is'} below minimum stock level. Create purchase orders to replenish.</span>
            <button className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] font-medium hover:bg-amber-700">
              <ShoppingCart className="w-3 h-3" /> Create PO
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-4 pt-3 pb-0 flex gap-3">
        {[
          { label: 'Out of Stock', value: String(items.filter(i => i.current_stock === 0).length), color: 'bg-red-50 border-red-200 text-red-700' },
          { label: 'Critical (< 50%)', value: String(items.filter(i => i.current_stock > 0 && i.current_stock < i.min_stock_level * 0.5).length), color: 'bg-orange-50 border-orange-200 text-orange-700' },
          { label: 'Low (< 100%)', value: String(items.filter(i => i.current_stock >= i.min_stock_level * 0.5).length), color: 'bg-amber-50 border-amber-200 text-amber-700' },
        ].map(k => (
          <div key={k.label} className={`px-3 py-2 rounded-md border text-xs font-medium ${k.color}`}>
            <span className="font-bold text-sm mr-1">{k.value}</span>{k.label}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={items} columns={columns} rowKey="id" emptyMessage="✓ All materials are above minimum stock levels" />
      </div>
    </div>
  );
}
