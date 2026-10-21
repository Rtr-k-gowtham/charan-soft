// src/components/ui/DataTable.tsx
import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight } from 'lucide-react';

export interface Column<T = any> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, idx: number) => React.ReactNode;
}

export interface DataTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  rowKey?: keyof T | ((row: T) => string | number);
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  pageSize?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  compact?: boolean;
  fixedLayout?: boolean;
  actionsWidth?: string;
}

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  rowKey,
  searchable = true,
  searchKeys,
  pageSize = 25,
  emptyMessage = 'No records found',
  onRowClick,
  actions,
  compact = true,
  fixedLayout = false,
  actionsWidth,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let d = [...data];
    if (search && searchKeys) {
      const q = search.toLowerCase();
      d = d.filter(row =>
        searchKeys.some((k: keyof T) => String(row[k] ?? '').toLowerCase().includes(q))
      );
    } else if (search) {
      const q = search.toLowerCase();
      d = d.filter(row =>
        Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      d.sort((a, b) => {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return d;
  }, [data, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageData = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const getKey = (row: T, idx: number) => {
    if (!rowKey) return idx;
    if (typeof rowKey === 'function') return rowKey(row);
    return row[rowKey] as string | number;
  };

  const getValue = (row: T, key: string) => {
    const parts = key.split('.');
    let v: unknown = row;
    for (const p of parts) v = (v as Record<string, unknown>)?.[p];
    return v;
  };

  // Split columns for mobile card presentation
  const statusCol = useMemo(
    () => columns.find(c => String(c.key).toLowerCase() === 'status' || c.label.toLowerCase() === 'status'),
    [columns]
  );

  const actionsCol = useMemo(
    () => columns.find(c => String(c.key).toLowerCase() === 'actions' || c.label.toLowerCase() === 'actions' || c.label.toLowerCase() === 'action'),
    [columns]
  );

  // Remaining columns to display
  const contentCols = useMemo(
    () => columns.filter(c => c !== statusCol && c !== actionsCol),
    [columns, statusCol, actionsCol]
  );

  // Identify title column (e.g. 'name', 'title', 'item_name', etc.)
  const titleCol = useMemo(() => {
    return (
      contentCols.find(c => {
        const k = String(c.key).toLowerCase();
        const l = c.label.toLowerCase();
        return k.includes('name') || k.includes('title') || l.includes('name') || l.includes('title');
      }) || contentCols[0]
    );
  }, [contentCols]);

  // Identify primary code/identifier column (e.g. 'code', 'item_code', 'symbol', 'id', 'sort_order')
  const codeCol = useMemo(() => {
    return contentCols.find(c => {
      if (c === titleCol) return false;
      const k = String(c.key).toLowerCase();
      const l = c.label.toLowerCase();
      return (
        k.includes('code') ||
        k === 'id' ||
        k === 'symbol' ||
        k.includes('order') ||
        k.includes('sno') ||
        l.includes('code') ||
        l === '#'
      );
    });
  }, [contentCols, titleCol]);

  // Detail columns (all content columns except title and primary code)
  const detailCols = useMemo(() => {
    return contentCols.filter(c => c !== titleCol && c !== codeCol);
  }, [contentCols, titleCol, codeCol]);

  return (
    <div className="flex flex-col min-h-0 w-full">
      {searchable && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-2.5">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl sm:rounded-md bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200 shadow-2xs font-medium"
            />
          </div>
          <span className="text-[11px] text-slate-400 text-right sm:ml-auto">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Desktop Table View (md+) */}
      <div className={`hidden md:block ${fixedLayout ? 'overflow-hidden' : 'overflow-x-auto touch-scroll'} flex-1 rounded-md border border-slate-200 bg-white shadow-2xs`}>
        <table className={`w-full border-collapse ${fixedLayout ? 'table-fixed' : 'min-w-full'} ${fixedLayout ? 'table-dense-fixed' : 'table-dense'}`}>
          <thead>
            <tr>
              {columns.map((col: Column<T>) => (
                <th
                  key={String(col.key)}
                  style={{ width: col.width }}
                  className={`${col.sortable ? 'cursor-pointer select-none hover:bg-slate-100' : ''} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <span className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                    <span className="truncate">{col.label}</span>
                    {col.sortable && (
                      sortKey === String(col.key)
                        ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />)
                        : <ChevronsUpDown className="w-3 h-3 text-slate-300 shrink-0" />
                    )}
                  </span>
                </th>
              ))}
              {actions && <th style={{ width: actionsWidth || (fixedLayout ? '72px' : '80px') }} className="text-center">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="text-center py-10 text-slate-400 text-xs"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageData.map((row, idx) => (
                <tr
                  key={getKey(row, idx)}
                  className={onRowClick ? 'cursor-pointer hover:bg-brand-50' : ''}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col: Column<T>) => (
                    <td key={String(col.key)} className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}>
                      {col.render
                        ? col.render(row, (currentPage - 1) * pageSize + idx)
                        : String(getValue(row, String(col.key)) ?? '—')}
                    </td>
                  ))}
                  {actions && (
                    <td onClick={e => e.stopPropagation()} className="text-center">{actions(row)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Responsive Cards View (< md) */}
      <div className="md:hidden flex-1 space-y-3 pb-4">
        {pageData.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80 shadow-xs">
            <p className="text-xs text-slate-400 font-medium">{emptyMessage}</p>
          </div>
        ) : (
          pageData.map((row, idx) => {
            const actualIdx = (currentPage - 1) * pageSize + idx;
            return (
              <div
                key={getKey(row, idx)}
                onClick={() => onRowClick?.(row)}
                className={`bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-all active:scale-[0.99] flex flex-col gap-2.5 ${
                  onRowClick ? 'cursor-pointer hover:bg-slate-50/60' : ''
                }`}
              >
                {/* Card Header: Code, Title, Status & Optional Row Chevron */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex-1 min-w-0">
                    {codeCol && (
                      <div className="mb-1 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-block font-mono text-[11px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200/60">
                          {codeCol.render
                            ? codeCol.render(row, actualIdx)
                            : String(getValue(row, String(codeCol.key)) ?? '—')}
                        </span>
                      </div>
                    )}
                    {titleCol && (
                      <div className="text-sm font-bold text-slate-900 leading-snug break-words">
                        {titleCol.render
                          ? titleCol.render(row, actualIdx)
                          : String(getValue(row, String(titleCol.key)) ?? '—')}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 pt-0.5">
                    {statusCol && (
                      <div>
                        {statusCol.render
                          ? statusCol.render(row, actualIdx)
                          : <span className="text-xs">{String(getValue(row, String(statusCol.key)) ?? '')}</span>}
                      </div>
                    )}
                    {onRowClick && (
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Card Body: Details Grid */}
                {detailCols.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {detailCols.map((col) => {
                      const val = col.render
                        ? col.render(row, actualIdx)
                        : (getValue(row, String(col.key)) != null ? String(getValue(row, String(col.key))) : null);
                      if (val === null || val === undefined || val === '') return null;

                      const k = String(col.key).toLowerCase();
                      const isWide = k.includes('address') || k.includes('desc') || k.includes('remark') || k.includes('note') || k.includes('materials') || k.includes('reason');

                      return (
                        <div
                          key={String(col.key)}
                          className={`bg-slate-50/80 rounded-xl p-2.5 flex flex-col justify-center min-w-0 border border-slate-100 ${
                            isWide ? 'col-span-2' : ''
                          }`}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                            {col.label}
                          </span>
                          <div className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
                            {val}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Card Footer: Actions */}
                {(actionsCol || actions) && (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 mt-0.5 min-h-[38px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actionsCol ? (
                      <div className="flex-1 min-w-0">
                        {actionsCol.render
                          ? actionsCol.render(row, actualIdx)
                          : String(getValue(row, String(actionsCol.key)) ?? '')}
                      </div>
                    ) : <div />}
                    {actions && (
                      <div className="shrink-0 flex items-center gap-1.5 flex-wrap">
                        {actions(row)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-2 px-1">
          <span className="text-[11px] text-slate-400">
            Page {currentPage} of {totalPages} ({filtered.length} total)
          </span>
          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-2.5 py-1 text-xs min-h-[36px] min-w-[36px] border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors font-medium flex items-center justify-center"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pg = Math.max(1, currentPage - 2) + i;
              if (pg > totalPages) return null;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`px-2.5 py-1 text-xs min-h-[36px] min-w-[36px] border rounded-lg transition-colors font-medium flex items-center justify-center ${
                    pg === currentPage
                      ? 'bg-brand-600 text-white border-brand-600 shadow-2xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-2.5 py-1 text-xs min-h-[36px] min-w-[36px] border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors font-medium flex items-center justify-center"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
