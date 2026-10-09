// src/pages/production/ProductionBoard.tsx
import React, { useEffect, useState } from 'react';
import { ProductionOrder, ProductionStage } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import { RefreshCw, ExternalLink } from 'lucide-react';

import { api } from '../../lib/api';

const priorityDot: Record<string, string> = { Low: 'bg-slate-300', Medium: 'bg-blue-400', High: 'bg-orange-400', Urgent: 'bg-red-500' };

export default function ProductionBoard() {
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStageTab, setActiveStageTab] = useState<number | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getProductionStages().catch(() => []),
      api.getProductionOrders().catch(() => []),
    ]).then(([stg, ord]) => {
      setStages((stg || []) as ProductionStage[]);
      setOrders((ord || []) as ProductionOrder[]);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // On mobile: show one stage column at a time via tabs
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;

  const getItemsForStage = (stageId: number) => {
    const result: Array<{ order: ProductionOrder; item: NonNullable<ProductionOrder['items']>[0] }> = [];
    for (const ord of orders) {
      for (const item of ord.items || []) {
        if (item.current_stage_id === stageId) {
          result.push({ order: ord, item });
        }
      }
    }
    return result;
  };

  const totalByStage = (stageId: number) => getItemsForStage(stageId).reduce((s, { item }) => s + item.current_stage_quantity, 0);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Production Board"
        subtitle="Live kanban view of all items across production stages"
        breadcrumb={[{ label: 'Production' }, { label: 'Board' }]}
        actions={
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {/* Mobile stage tabs */}
      <div className="flex md:hidden overflow-x-auto gap-1 px-3 py-2 border-b border-slate-200 bg-white shrink-0">
        <button onClick={() => setActiveStageTab(null)}
          className={`px-3 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors ${activeStageTab === null ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
          All
        </button>
        {stages.map(s => (
          <button key={s.id} onClick={() => setActiveStageTab(s.id)}
            className="px-3 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors"
            style={{ backgroundColor: activeStageTab === s.id ? s.color_badge : '#f1f5f9', color: activeStageTab === s.id ? 'white' : '#64748b' }}>
            {s.name} ({totalByStage(s.id)})
          </button>
        ))}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3">
        <div className="flex h-full gap-3 min-w-max md:min-w-0">
          {stages
            .filter(s => activeStageTab === null || s.id === activeStageTab)
            .map(stage => {
              const items = getItemsForStage(stage.id);
              return (
                <div key={stage.id} className="flex flex-col w-64 md:w-56 lg:w-64 shrink-0 h-full">
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-t-md mb-1 border border-b-0"
                    style={{ backgroundColor: stage.color_badge + '18', borderColor: stage.color_badge + '33' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color_badge }} />
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">{stage.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: stage.color_badge }}>
                        {totalByStage(stage.id)}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto flex flex-col gap-2 bg-slate-50 rounded-b-md border border-slate-200 p-2">
                    {items.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-[10px] text-slate-300 text-center">No items</p>
                      </div>
                    ) : items.map(({ order, item }) => (
                      <div key={item.id}
                        className="bg-white border border-slate-200 rounded-md p-2.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                        {/* Order & priority */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-brand-700">{order.order_number}</span>
                          <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${priorityDot[order.priority]}`} title={order.priority} />
                            <ExternalLink className="w-2.5 h-2.5 text-slate-300 group-hover:text-brand-500 transition-colors" />
                          </div>
                        </div>

                        {/* Product */}
                        <p className="text-[11px] font-semibold text-slate-700 leading-tight mb-1 truncate">
                          {item.product_name}
                        </p>
                        <p className="text-[10px] text-slate-500 mb-2">
                          {item.color} / {item.size}
                        </p>

                        {/* Qty breakdown */}
                        <div className="grid grid-cols-3 gap-1 mb-2">
                          <div className="text-center">
                            <p className="text-[9px] text-slate-400 uppercase">Total</p>
                            <p className="text-xs font-bold text-slate-700">{item.total_quantity}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] text-green-600 uppercase">Done</p>
                            <p className="text-xs font-bold text-green-700">{item.completed_quantity}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] text-orange-500 uppercase">Here</p>
                            <p className="text-xs font-bold text-orange-600">{item.current_stage_quantity}</p>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.round((item.completed_quantity / item.total_quantity) * 100)}%`,
                              backgroundColor: stage.color_badge
                            }} />
                        </div>

                        {/* QC badge */}
                        {(item.rejected_quantity > 0 || item.rework_quantity > 0) && (
                          <div className="mt-2 flex items-center gap-2">
                            {item.rejected_quantity > 0 && (
                              <span className="text-[9px] px-1 py-0.5 bg-red-50 text-red-700 rounded border border-red-100 font-semibold">
                                {item.rejected_quantity} rejected
                              </span>
                            )}
                            {item.rework_quantity > 0 && (
                              <span className="text-[9px] px-1 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-100 font-semibold">
                                {item.rework_quantity} rework
                              </span>
                            )}
                          </div>
                        )}

                        {/* Customer */}
                        <p className="mt-2 text-[9px] text-slate-400 truncate">{order.customer_name || 'Internal'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
