// src/components/ui/PageHeader.tsx
import React, { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}

export default function PageHeader({ title, subtitle, actions, breadcrumb }: Props) {
  const cleanTitle = title.replace(/\s+Master$/i, '');

  return (
    <div className="flex items-center justify-between gap-2 px-3.5 sm:px-5 py-2.5 border-b border-slate-200 bg-white shrink-0 min-h-[46px] flex-wrap">
      <div className="min-w-0 flex-1">
        <h1 className="text-sm sm:text-base font-bold text-slate-800 leading-tight truncate">{cleanTitle}</h1>
        {subtitle && <p className="text-[11px] text-slate-400 hidden sm:block mt-0.5 truncate">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

