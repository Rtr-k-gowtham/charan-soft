// src/pages/tasks/MyTasks.tsx
// Dedicated Operational Task Screen for Role 1, Role 2, and Admin
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { TaskItem } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import {
  ClipboardCheck,
  Search,
  RefreshCw,
  ExternalLink,
  Calendar,
  Layers,
  ArrowRight,
  Shield,
  Clock,
  Sparkles,
  Inbox
} from 'lucide-react';

export default function MyTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await api.getTasks();
      setTasks(Array.isArray(data) ? data : []);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Unique stages present in current tasks
  const availableStages = useMemo(() => {
    const map = new Map<number, { id: number; name: string; sequence: number }>();
    tasks.forEach(t => {
      if (!map.has(t.stage_id)) {
        map.set(t.stage_id, {
          id: t.stage_id,
          name: t.stage_name,
          sequence: t.stage_sequence,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.sequence - b.sequence);
  }, [tasks]);

  // Filter tasks based on search and stage
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (selectedStage !== 'all' && String(t.stage_id) !== selectedStage) {
        return false;
      }
      if (!search.trim()) return true;

      const q = search.toLowerCase();
      const matchOrder = t.order_number.toLowerCase().includes(q) ||
        t.order_title.toLowerCase().includes(q) ||
        t.customer_name.toLowerCase().includes(q) ||
        t.stage_name.toLowerCase().includes(q);

      const matchProduct = t.products?.some(p =>
        p.product_name.toLowerCase().includes(q) ||
        p.product_code?.toLowerCase().includes(q) ||
        p.color?.toLowerCase().includes(q)
      );

      return matchOrder || matchProduct;
    });
  }, [tasks, search, selectedStage]);

  // Summary Metrics
  const totalTasksCount = tasks.length;
  const totalStageQuantity = useMemo(() => {
    return tasks.reduce((acc, t) => acc + (t.stage_quantity || 0), 0);
  }, [tasks]);
  const uniqueOrdersCount = useMemo(() => {
    return new Set(tasks.map(t => t.order_id)).size;
  }, [tasks]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <PageHeader
        title="My Tasks"
        subtitle={`Operational production tasks requiring your action (${user?.role_name || user?.role || 'User'})`}
        breadcrumb={[{ label: 'Production' }, { label: 'My Tasks' }]}
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded-md">
              <Shield className="w-3.5 h-3.5 text-brand-600" />
              Role: <strong className="text-slate-700">{user?.role_name || user?.role}</strong>
            </span>
            <Button
              variant="secondary"
              icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              onClick={fetchTasks}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {/* KPI Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Tasks</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalTasksCount}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Orders in your assigned stages</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending Output Quantity</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                {totalStageQuantity.toLocaleString()} <span className="text-sm font-normal text-slate-500">pcs</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Total pieces requiring processing</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Distinct Orders</p>
              <h3 className="text-2xl font-bold text-indigo-600 mt-1">{uniqueOrdersCount}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Refreshed at {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order #, Title, Customer, or Product..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedStage}
              onChange={e => setSelectedStage(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 bg-white text-slate-700 font-medium"
            >
              <option value="all">All Permitted Stages ({tasks.length})</option>
              {availableStages.map(s => (
                <option key={s.id} value={String(s.id)}>
                  {String(s.sequence).padStart(2, '0')}. {s.name}
                </option>
              ))}
            </select>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Task Cards / Table List */}
        {loading && tasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">Loading your production tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Inbox className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-semibold text-slate-700">
              {search || selectedStage !== 'all' ? 'No matching tasks found' : 'No Pending Tasks in Your Stages'}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {search || selectedStage !== 'all'
                ? 'Try clearing your search filters to see all available tasks.'
                : 'All production orders in your assigned stages are currently processed or waiting on preceding stages.'}
            </p>
            {(search || selectedStage !== 'all') && (
              <button
                onClick={() => { setSearch(''); setSelectedStage('all'); }}
                className="mt-3 px-3 py-1.5 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg text-xs font-semibold transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => {
              const seqStr = String(task.stage_sequence || task.stage_id).padStart(2, '0');
              return (
                <div
                  key={task.task_id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow duration-200 overflow-hidden"
                >
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Order Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                          {task.order_number}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {task.order_title}
                        </span>
                        <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {task.customer_name}
                        </span>
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${task.color_badge}15`,
                            color: task.color_badge || '#2563eb',
                            border: `1px solid ${task.color_badge}30`,
                          }}
                        >
                          Stage {seqStr}: {task.stage_name}
                        </span>
                      </div>

                      {/* Product line pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {task.products?.map((prod, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600"
                          >
                            <span className="font-medium text-slate-800">{prod.product_name}</span>
                            {prod.color && (
                              <span className="text-[10px] text-slate-400">({prod.color})</span>
                            )}
                            <span className="font-bold text-slate-700">
                              {prod.quantity.toLocaleString()} pcs
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Middle: Quantities & Timeline */}
                    <div className="flex items-center gap-6 text-xs text-slate-600 shrink-0 border-t md:border-t-0 pt-2 md:pt-0">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Stage Qty</p>
                        <p className="text-sm font-bold text-emerald-600">
                          {task.stage_quantity.toLocaleString()} <span className="text-xs font-normal text-slate-500">pcs</span>
                        </p>
                        <p className="text-[10px] text-slate-400">
                          of {task.order_quantity.toLocaleString()} total
                        </p>
                      </div>

                      <div className="text-left md:text-right min-w-[90px]">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Target Delivery</p>
                        <p className="text-xs font-medium text-slate-700 flex items-center md:justify-end gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {task.target_delivery_date || '—'}
                        </p>
                        <span className="inline-block text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded mt-0.5">
                          {task.status || 'IN PRODUCTION'}
                        </span>
                      </div>

                      {/* Right: Action Button */}
                      <div>
                        <button
                          onClick={() => navigate(task.action_url)}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs hover:shadow transition-all group"
                        >
                          <span>Open Task</span>
                          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

