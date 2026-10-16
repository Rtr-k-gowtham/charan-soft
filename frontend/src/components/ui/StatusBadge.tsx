// src/components/ui/StatusBadge.tsx
import React from 'react';
import { StatusType } from '../../types';

interface Props {
  status: StatusType | string;
  size?: 'xs' | 'sm';
}

const statusMap: Record<string, string> = {
  // PO Status
  'DRAFT': 'bg-slate-100 text-slate-600 border-slate-200',
  'PENDING': 'bg-amber-50 text-amber-700 border-amber-200',
  'APPROVED': 'bg-blue-50 text-blue-700 border-blue-200',
  'REJECTED': 'bg-red-50 text-red-700 border-red-200',
  'PARTIALLY RECEIVED': 'bg-orange-50 text-orange-700 border-orange-200',
  'RECEIVED': 'bg-green-50 text-green-700 border-green-200',
  'CANCELLED': 'bg-slate-100 text-slate-500 border-slate-200',

  // Production
  'CONFIRMED': 'bg-blue-50 text-blue-700 border-blue-200',
  'IN PRODUCTION': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'PARTIALLY COMPLETED': 'bg-orange-50 text-orange-700 border-orange-200',
  'QC': 'bg-purple-50 text-purple-700 border-purple-200',
  'REWORK': 'bg-rose-50 text-rose-700 border-rose-200',
  'COMPLETED': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Completed': 'bg-emerald-50 text-emerald-700 border-emerald-200',

  // 10 Core Production Stages
  'Requirement Gathering': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'PO (Purchase Order)': 'bg-sky-50 text-sky-700 border-sky-200',
  'Purchase Order (PO)': 'bg-sky-50 text-sky-700 border-sky-200',
  'PO': 'bg-sky-50 text-sky-700 border-sky-200',
  'Inward': 'bg-teal-50 text-teal-700 border-teal-200',
  'Dyeing': 'bg-blue-50 text-blue-700 border-blue-200',
  'Cutting — Product-wise': 'bg-amber-50 text-amber-700 border-amber-200',
  'Cutting': 'bg-amber-50 text-amber-700 border-amber-200',
  'Embroidery — Outward / Inward': 'bg-pink-50 text-pink-700 border-pink-200',
  'Embroidery': 'bg-pink-50 text-pink-700 border-pink-200',
  'Stitching — Color-wise Tracking': 'bg-blue-50 text-blue-700 border-blue-200',
  'Stitching — Color-wise': 'bg-blue-50 text-blue-700 border-blue-200',
  'Stitching': 'bg-blue-50 text-blue-700 border-blue-200',
  'Checking': 'bg-rose-50 text-rose-700 border-rose-200',
  'Packing': 'bg-emerald-50 text-emerald-700 border-emerald-200',

  // Payment
  'Not Paid': 'bg-red-50 text-red-700 border-red-200',
  'Unpaid': 'bg-slate-100 text-slate-700 border-slate-300',
  'Partially Paid': 'bg-amber-50 text-amber-700 border-amber-200',
  'Settled': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Overdue': 'bg-red-50 text-red-700 border-red-200',
  'Paid': 'bg-green-50 text-green-700 border-green-200',

  // Priority
  'Low': 'bg-slate-100 text-slate-600 border-slate-200',
  'Medium': 'bg-blue-50 text-blue-700 border-blue-200',
  'High': 'bg-orange-50 text-orange-700 border-orange-200',
  'Urgent': 'bg-red-50 text-red-700 border-red-200',

  // Item Status
  'In Progress': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'In Rework': 'bg-rose-50 text-rose-700 border-rose-200',
  'active': 'bg-green-50 text-green-700 border-green-200',
  'inactive': 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function StatusBadge({ status, size = 'xs' }: Props) {
  const cls = statusMap[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center border font-semibold uppercase tracking-wide rounded
      ${size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'}
      ${cls}`}>
      {status}
    </span>
  );
}
