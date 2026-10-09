// src/components/ui/PageHeader.tsx
import React, { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}

export default function PageHeader({ title, actions }: Props) {
  const cleanTitle = title.replace(/\s+Master$/i, '');

  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-200 bg-white shrink-0 min-h-[46px]">
      <h1 className="text-sm font-semibold text-slate-800 leading-tight">{cleanTitle}</h1>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
