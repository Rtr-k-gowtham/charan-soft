// src/pages/inventory/Inventory.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { StockBalance, InventoryTransaction } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import { AlertTriangle, RefreshCw, BookOpen, TrendingUp, TrendingDown } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);

const txTypeColor: Record<string, string> = {
  'STOCK IN': 'text-green-600',
  'PURCHASE RECEIPT': 'text-blue-600',
  'MATERIAL CONSUMPTION': 'text-orange-600',
  'STOCK OUT': 'text-red-600',
  'STOCK ADJUSTMENT': 'text-purple-600',
  'DAMAGE': 'text-red-700',
  'RETURN': 'text-indigo-600',
};

export default function Inventory() {
  const [stock, setStock] = useState<StockBalance[]>([]);
  const [ledger, setLedger] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [selectedMat, setSelectedMat] = useState<StockBalance | null>(null);
  const [activeTab, setActiveTab] = useState<'stock' | 'low'>('stock');

  const load = async () => {
    setLoading(true);
    try {
      const inv = await api.getInventory();
      setStock((inv || []) as StockBalance[]);
    } catch {
      setStock([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async (mat: StockBalance) => {
    setSelectedMat(mat);
    setLedgerOpen(true);
    try {
      const l = await api.getLedger(mat.id);
      setLedger((l || []) as InventoryTransaction[]);
    } catch {
      setLedger([]);
    }
  };

  useEffect(() => { load(); }, []);

  const displayed = activeTab === 'low' ? stock.filter(s => s.is_low_stock) : stock;

  const lowCount = stock.filter(s => s.is_low_stock).length;
  const totalValue = stock.reduce((s, m) => s + m.current_stock * 100, 0);

  const columns = [
    { key: 'code', label: 'Code', sortable: true, render: (r: StockBalance) => <span className="font-mono text-[10px] text-slate-500">{r.code}</span> },
    { key: 'name', label: 'Material', sortable: true, render: (r: StockBalance) => <span className="font-medium">{r.name}</span> },
    { key: 'category_name', label: 'Category', sortable: true, render: (r: StockBalance) => <span className="text-slate-400 text-[10px]">{r.category_name}</span> },
    {
      key: 'current_stock', label: 'Current Stock', sortable: true,
      render: (r: StockBalance) => (
        <span className={`font-mono font-semibold ${r.is_low_stock ? 'text-red-600' : 'text-slate-700'}`}>
          {fmt(r.current_stock)} {r.uom}
        </span>
      ),
    },
    {
      key: 'available_stock', label: 'Available', sortable: true,
      render: (r: StockBalance) => <span className="font-mono text-slate-600">{fmt(r.available_stock)} {r.uom}</span>,
    },
    {
      key: 'min_stock_level', label: 'Min Required', sortable: true,
      render: (r: StockBalance) => <span className="font-mono text-slate-400">{fmt(r.min_stock_level)} {r.uom}</span>,
    },
    {
      key: 'is_low_stock', label: 'Status',
      render: (r: StockBalance) => r.is_low_stock
        ? <span className="inline-flex items-center gap-1 badge bg-red-50 text-red-700 border-red-200"><AlertTriangle className="w-2.5 h-2.5" />LOW STOCK</span>
        : <span className="badge bg-green-50 text-green-700 border-green-200">ADEQUATE</span>,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Stock Inventory"
        subtitle="Real-time material stock levels and availability"
        breadcrumb={[{ label: 'Inventory' }, { label: 'Stock' }]}
        actions={
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {/* Summary Bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold">{stock.length}</span> Materials
        </div>
        {lowCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
            <AlertTriangle className="w-3 h-3" />
            {lowCount} Low Stock
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {(['stock', 'low'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors
                ${activeTab === t ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {t === 'stock' ? 'All Stock' : `Low Stock (${lowCount})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <DataTable
          data={displayed}
          columns={columns}
          rowKey="id"
          emptyMessage={activeTab === 'low' ? 'All stock levels are adequate' : 'No materials found'}
          actions={(r: StockBalance) => (
            <button onClick={() => loadLedger(r)} className="p-1 text-slate-400 hover:text-brand-600 rounded" title="View Ledger">
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          )}
        />
      </div>

      {/* Ledger Drawer */}
      <Drawer open={ledgerOpen} onClose={() => setLedgerOpen(false)}
        title={`Stock Ledger — ${selectedMat?.name}`}
        subtitle={`Code: ${selectedMat?.code} | UOM: ${selectedMat?.uom}`}
        width="max-w-3xl">
        {selectedMat && (
          <div className="flex flex-col gap-4">
            {/* Current balance */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-center">
                <p className="text-[10px] text-blue-600 font-semibold uppercase">Current Stock</p>
                <p className="text-lg font-bold text-blue-800">{fmt(selectedMat.current_stock)}</p>
                <p className="text-[10px] text-blue-500">{selectedMat.uom}</p>
              </div>
              <div className="p-3 bg-green-50 border border-green-100 rounded-md text-center">
                <p className="text-[10px] text-green-600 font-semibold uppercase">Available</p>
                <p className="text-lg font-bold text-green-800">{fmt(selectedMat.available_stock)}</p>
                <p className="text-[10px] text-green-500">{selectedMat.uom}</p>
              </div>
              <div className={`p-3 rounded-md border text-center ${selectedMat.is_low_stock ? 'bg-red-50 border-red-100' : 'bg-slate-50'}`}>
                <p className={`text-[10px] font-semibold uppercase ${selectedMat.is_low_stock ? 'text-red-600' : 'text-slate-500'}`}>Min Required</p>
                <p className={`text-lg font-bold ${selectedMat.is_low_stock ? 'text-red-800' : 'text-slate-700'}`}>{fmt(selectedMat.min_stock_level)}</p>
                <p className={`text-[10px] ${selectedMat.is_low_stock ? 'text-red-500' : 'text-slate-400'}`}>{selectedMat.uom}</p>
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">Transaction Ledger</h4>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full table-dense">
                  <thead>
                    <tr>
                      <th>Date/Time</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th className="text-right">Quantity</th>
                      <th className="text-right">Before</th>
                      <th className="text-right">After</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-6 text-slate-400">No transactions found</td></tr>
                    ) : ledger.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="text-slate-400 text-[10px] whitespace-nowrap">{tx.created_at}</td>
                        <td>
                          <span className={`text-[10px] font-semibold ${txTypeColor[tx.transaction_type] || 'text-slate-600'}`}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="text-slate-500 text-[10px]">{tx.reference_type || '—'}</td>
                        <td className={`text-right font-mono font-semibold ${tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.quantity > 0 ? '+' : ''}{fmt(tx.quantity)} {selectedMat.uom}
                        </td>
                        <td className="text-right font-mono text-slate-400">{fmt(tx.previous_stock)}</td>
                        <td className="text-right font-mono font-semibold text-slate-700">{fmt(tx.new_stock)}</td>
                        <td className="text-slate-400 text-[10px] max-w-[180px] truncate" title={tx.notes}>{tx.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
