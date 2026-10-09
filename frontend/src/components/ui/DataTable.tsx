// src/components/ui/DataTable.tsx
import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface Column<T = any> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
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

  return (
    <div className="flex flex-col h-full">
      {searchable && (
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search..."
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200"
            />
          </div>
          <span className="text-[11px] text-slate-400 ml-auto">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <div className="overflow-x-auto flex-1 rounded-md border border-slate-200 bg-white">
        <table className="w-full border-collapse table-dense">
          <thead>
            <tr>
              {columns.map((col: Column<T>) => (
                <th
                  key={String(col.key)}
                  style={{ width: col.width }}
                  className={col.sortable ? 'cursor-pointer select-none hover:bg-slate-100' : ''}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      sortKey === String(col.key)
                        ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                        : <ChevronsUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </span>
                </th>
              ))}
              {actions && <th style={{ width: '80px' }}>Actions</th>}
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
                    <td key={String(col.key)}>
                      {col.render
                        ? col.render(row, (currentPage - 1) * pageSize + idx)
                        : String(getValue(row, String(col.key)) ?? '—')}
                    </td>
                  ))}
                  {actions && (
                    <td onClick={e => e.stopPropagation()}>{actions(row)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[11px] text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-2 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
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
                  className={`px-2 py-1 text-xs border rounded ${pg === currentPage ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-2 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
