// src/pages/inventory/MaterialConsumption.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Material, StockBalance } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { FlameKindling, RefreshCw, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);

interface ConsumptionRecord {
  id: number;
  voucher_number: string;
  consumption_date: string;
  production_order: string;
  total_items: number;
  status: string;
  recorded_by: string;
}

export default function MaterialConsumption() {
  const [records, setRecords] = useState<ConsumptionRecord[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [form, setForm] = useState({
    consumption_date: new Date().toISOString().split('T')[0],
    production_order: '',
    notes: '',
  });

  const [items, setItems] = useState<{ material_id: string; quantity: string; notes: string }[]>([
    { material_id: '', quantity: '', notes: '' },
  ]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getConsumption().catch(() => []),
      api.getInventory().catch(() => []),
      api.getMaterials().catch(() => []),
    ])
      .then(([rawRecs, invData, matData]) => {
        const formatted = (
          (rawRecs || []) as {
            id: number;
            reference_id: string;
            created_at: string;
            quantity: number;
            notes: string;
          }[]
        ).map((r, i) => ({
          id: r.id || i + 1,
          voucher_number: `MC-${String(r.id || i + 1).padStart(5, '0')}`,
          consumption_date:
            (r.created_at || '').split(' ')[0] || new Date().toISOString().split('T')[0],
          production_order: r.reference_id ? `ORD-${r.reference_id}` : 'PROD-ORDER',
          total_items: 1,
          status: 'POSTED',
          recorded_by: 'Production Team',
        }));
        setRecords(formatted);

        // Merge authoritative stock from getInventory() into materials
        const invMap = new Map<number, StockBalance>();
        ((invData || []) as StockBalance[]).forEach((sb) => {
          invMap.set(sb.id, sb);
        });

        const mergedMats: Material[] = ((matData || []) as Material[]).map((m) => {
          const inv = invMap.get(m.id);
          return {
            ...m,
            available_stock: inv ? Number(inv.available_stock ?? inv.current_stock ?? 0) : Number(m.available_stock ?? m.current_stock ?? 0),
            current_stock: inv ? Number(inv.current_stock ?? 0) : Number(m.current_stock ?? 0),
          };
        });

        setMaterials(mergedMats);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = () => {
    setError('');
    setItems([{ material_id: '', quantity: '', notes: '' }]);
    setForm({
      consumption_date: new Date().toISOString().split('T')[0],
      production_order: '',
      notes: '',
    });
    setCreateOpen(true);
    // Refresh inventory so available stock is latest
    loadData();
  };

  const handleCreate = async () => {
    if (!form.production_order.trim()) {
      setError('Please enter a production order reference');
      return;
    }

    if (items.some((i) => !i.material_id || !i.quantity || parseFloat(i.quantity) <= 0)) {
      setError('Please select a material and enter a valid quantity greater than zero for all rows');
      return;
    }

    // Combined availability check per material
    const requestedPerMat: Record<string, number> = {};
    for (const it of items) {
      requestedPerMat[it.material_id] =
        (requestedPerMat[it.material_id] || 0) + (parseFloat(it.quantity) || 0);
    }

    for (const [matId, reqQty] of Object.entries(requestedPerMat)) {
      const mat = materials.find((m) => String(m.id) === matId);
      const avail = Number(mat?.available_stock ?? mat?.current_stock ?? 0);
      if (reqQty > avail + 0.0001) {
        setError(
          `Requested quantity for '${mat?.name || `Material #${matId}`}' (${reqQty} ${mat?.uom}) exceeds available stock of ${fmt(avail)} ${mat?.uom}.`
        );
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      // Send single batch consumption payload to backend
      const batchPayload = {
        production_order_ref: form.production_order.trim(),
        consumption_date: form.consumption_date,
        general_notes: form.notes,
        items: items.map((it) => ({
          material_id: Number(it.material_id),
          quantity: parseFloat(it.quantity),
          notes: it.notes.trim() || `Consumed for Order ${form.production_order.trim()}`,
        })),
      };

      await api.recordConsumption(batchPayload);

      setCreateOpen(false);
      setSuccessMsg(`Material consumption recorded successfully for Order ${form.production_order}.`);
      setItems([{ material_id: '', quantity: '', notes: '' }]);
      setForm({
        consumption_date: new Date().toISOString().split('T')[0],
        production_order: '',
        notes: '',
      });
      loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to record material consumption');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'voucher_number',
      label: 'Voucher No',
      sortable: true,
      render: (r: ConsumptionRecord) => (
        <span className="font-mono font-semibold text-brand-700">{r.voucher_number}</span>
      ),
    },
    { key: 'consumption_date', label: 'Date', sortable: true },
    {
      key: 'production_order',
      label: 'Production Order',
      sortable: true,
      render: (r: ConsumptionRecord) => (
        <span className="font-medium text-slate-700">{r.production_order}</span>
      ),
    },
    {
      key: 'total_items',
      label: 'Items',
      render: (r: ConsumptionRecord) => <span className="font-mono">{r.total_items}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: ConsumptionRecord) => (
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
            r.status === 'POSTED'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'recorded_by',
      label: 'By',
      render: (r: ConsumptionRecord) => (
        <span className="text-slate-400 text-[10px]">{r.recorded_by}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Material Consumption"
        subtitle="Record raw material usage in production"
        breadcrumb={[{ label: 'Inventory' }, { label: 'Material Consumption' }]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 bg-white"
              title="Refresh"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={handleOpenModal}>
              Record Consumption
            </Button>
          </div>
        }
      />

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700 text-xs">✕</button>
        </div>
      )}

      <div className="flex-1 overflow-hidden p-4">
        <DataTable data={records} columns={columns} rowKey="id" />
      </div>

      {/* Enlarged Record Material Consumption Dialog */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Record Material Consumption"
        subtitle="Issue raw materials from available inventory for production orders"
        size="full"
        className="max-w-[94vw] xl:max-w-7xl max-h-[92vh] flex flex-col"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={handleCreate}
              icon={<FlameKindling className="w-3.5 h-3.5" />}
            >
              Post Consumption
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Consumption Date"
              type="date"
              required
              value={form.consumption_date}
              onChange={(e) => setForm((f) => ({ ...f, consumption_date: e.target.value }))}
            />
            <FormField
              label="Production Order Ref"
              required
              value={form.production_order}
              onChange={(e) => setForm((f) => ({ ...f, production_order: e.target.value }))}
              placeholder="e.g. PROD-0012 or WEAV-001"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Materials Consumed
              </h4>
              <span className="text-[11px] text-slate-400">
                ({items.length} {items.length === 1 ? 'line item' : 'line items'})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setItems((p) => [...p, { material_id: '', quantity: '', notes: '' }])}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100/80 border border-brand-200 rounded font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Material
            </button>
          </div>

          {/* Materials Consumed Table: 1. Material, 2. Stock Available, 3. Quantity, 4. Notes */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold w-[38%]">Material</th>
                  <th className="text-left px-3 py-2.5 font-semibold w-[20%]">Stock Available</th>
                  <th className="text-left px-3 py-2.5 font-semibold w-[18%]">Quantity</th>
                  <th className="text-left px-3 py-2.5 font-semibold w-[20%]">Notes</th>
                  <th className="px-2 py-2.5 w-[4%] text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, i) => {
                  const selMat = materials.find((m) => String(m.id) === it.material_id);
                  const availStock = Number(selMat?.available_stock ?? selMat?.current_stock ?? 0);
                  const totalReqForThisMat = items
                    .filter((row) => row.material_id && row.material_id === it.material_id)
                    .reduce((sum, row) => sum + (parseFloat(row.quantity) || 0), 0);
                  const isExceeded = Boolean(
                    it.material_id && totalReqForThisMat > availStock + 0.0001
                  );

                  return (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                      {/* 1. Material */}
                      <td className="px-3 py-2">
                        <select
                          value={it.material_id}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], material_id: val };
                              return next;
                            });
                          }}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                        >
                          <option value="">— Select Material —</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.code} — {m.name} ({m.uom})
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 2. Stock Available */}
                      <td className="px-3 py-2">
                        {it.material_id && selMat ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-mono font-semibold px-2.5 py-1 rounded border text-xs ${
                                availStock <= 0
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {fmt(availStock)} {selMat.uom}
                            </span>
                            {availStock <= 0 && (
                              <span className="text-[10px] text-amber-600 font-medium">Out of Stock</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">— Select Material —</span>
                        )}
                      </td>

                      {/* 3. Quantity */}
                      <td className="px-3 py-2">
                        <div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setItems((prev) => {
                                const next = [...prev];
                                next[i] = { ...next[i], quantity: val };
                                return next;
                              });
                            }}
                            className={`w-full px-2.5 py-1.5 text-xs border rounded font-mono focus:outline-none transition-colors ${
                              isExceeded
                                ? 'border-red-400 bg-red-50/50 text-red-900 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
                                : 'border-slate-200 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20'
                            }`}
                            placeholder="0.00"
                          />
                          {isExceeded && (
                            <span className="text-[10px] text-red-600 font-semibold block mt-0.5 leading-tight">
                              Exceeds stock ({fmt(availStock)} {selMat?.uom})
                              {items.filter((r) => r.material_id === it.material_id).length > 1 &&
                                ` (combined: ${fmt(totalReqForThisMat)})`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Notes */}
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={it.notes}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], notes: val };
                              return next;
                            });
                          }}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                          placeholder="Line notes..."
                        />
                      </td>

                      {/* Row Delete Action */}
                      <td className="px-2 py-2 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remove Row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <FormField
            as="textarea"
            label="General Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="Additional notes for production voucher..."
          />
        </div>
      </Modal>
    </div>
  );
}
