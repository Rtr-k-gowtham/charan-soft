// src/pages/inventory/StockLedger.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { InventoryTransaction, Material } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import FormField from '../../components/ui/FormField';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export default function StockLedger() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [ledger, setLedger] = useState<InventoryTransaction[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (materialId?: number) => {
    setLoading(true);
    try {
      const [mats, led] = await Promise.all([api.getMaterials(), api.getLedger(materialId)]);
      setMaterials((mats || []) as Material[]);
      setLedger((led || []) as InventoryTransaction[]);
    } catch {
      setMaterials([]);
      setLedger([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleMaterialChange = (id: string) => {
    setSelectedMaterial(id);
    load(id ? Number(id) : undefined);
  };

  const columns = [
    { key: 'created_at', label: 'Date / Time', sortable: true, render: (r: InventoryTransaction) => <span className="font-mono text-[11px]">{r.created_at}</span> },
    { key: 'material_name', label: 'Material', sortable: true, render: (r: InventoryTransaction) => <span className="font-medium">{r.material_name}</span> },
    { key: 'transaction_type', label: 'Type', render: (r: InventoryTransaction) => <StatusBadge status={r.transaction_type} size="xs" /> },
    { key: 'reference_type', label: 'Reference', render: (r: InventoryTransaction) => <span className="font-mono text-[10px] text-slate-500">{r.reference_type || '—'}</span> },
    { key: 'quantity', label: 'Qty In/Out', render: (r: InventoryTransaction) => (
      <span className={`font-mono font-bold flex items-center gap-1 ${r.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
        {r.quantity > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {r.quantity > 0 ? '+' : ''}{fmt(r.quantity)} {r.uom}
      </span>
    )},
    { key: 'previous_stock', label: 'Prev Stock', render: (r: InventoryTransaction) => <span className="font-mono text-slate-500">{fmt(r.previous_stock)}</span> },
    { key: 'new_stock', label: 'New Stock', render: (r: InventoryTransaction) => <span className="font-mono font-semibold text-brand-700">{fmt(r.new_stock)}</span> },
    { key: 'user_name', label: 'By', render: (r: InventoryTransaction) => <span className="text-slate-400 text-[10px]">{r.user_name}</span> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Stock Ledger"
        subtitle="Complete transaction history for all materials"
        breadcrumb={[{ label: 'Inventory' }, { label: 'Stock Ledger' }]}
        actions={<button onClick={() => load(selectedMaterial ? Number(selectedMaterial) : undefined)} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /></button>}
      />
      <div className="px-4 pt-3 pb-0">
        <div className="max-w-xs">
          <FormField as="select" label="" value={selectedMaterial} onChange={e => handleMaterialChange(e.target.value)}>
            <option value="">— All Materials —</option>
            {materials.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
          </FormField>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={ledger} columns={columns} rowKey="id" emptyMessage="No transactions found for this material" />
      </div>
    </div>
  );
}
