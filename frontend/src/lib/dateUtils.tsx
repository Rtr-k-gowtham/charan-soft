// src/lib/dateUtils.tsx
import React from 'react';

/**
 * Calculates the calendar day difference between a target date string and the current date.
 * Returns:
 *   - positive number: days remaining in future (e.g. 5 = 5 days left)
 *   - 0: due today
 *   - negative number: overdue days (e.g. -3 = overdue by 3 days)
 *   - null: if date is missing, empty, or invalid
 *
 * Uses calendar midnight boundaries (year, month, day) to prevent time zone / hour skew.
 */
export function getCalendarDaysDiff(dateStr?: string | null): number | null {
  if (!dateStr || dateStr === '0000-00-00') return null;
  const clean = dateStr.trim().split('T')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const target = new Date(year, month, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export type CountdownVariant = 'paid' | 'future' | 'today' | 'overdue' | 'empty';

export interface CountdownInfo {
  text: string;
  diff: number | null;
  variant: CountdownVariant;
}

/**
 * Evaluates the delivery due countdown rules:
 * - Future date: "X days left" / "1 day left"
 * - Due today: "Due today"
 * - Past date: "Overdue by X days" / "Overdue by 1 day"
 * - Missing date: "—"
 */
export function getDeliveryCountdown(dueDate?: string | null): CountdownInfo {
  const diff = getCalendarDaysDiff(dueDate);
  if (diff === null) {
    return { text: '—', diff: null, variant: 'empty' };
  }
  if (diff > 0) {
    return {
      text: `${diff} ${diff === 1 ? 'day' : 'days'} left`,
      diff,
      variant: 'future',
    };
  }
  if (diff === 0) {
    return { text: 'Due today', diff: 0, variant: 'today' };
  }
  const overdue = Math.abs(diff);
  return {
    text: `Overdue by ${overdue} ${overdue === 1 ? 'day' : 'days'}`,
    diff,
    variant: 'overdue',
  };
}

/**
 * Evaluates the payment due countdown rules:
 * - If obligation is settled / fully paid: "Paid"
 * - Otherwise follows due date countdown rules against remaining balance
 */
export function getPaymentCountdown(
  dueDate?: string | null,
  isPaid = false
): CountdownInfo {
  if (isPaid) {
    return { text: 'Paid', diff: null, variant: 'paid' };
  }
  return getDeliveryCountdown(dueDate);
}

/**
 * Standard badge / chip component for countdown presentation
 */
export function CountdownBadge({ info }: { info: CountdownInfo }): React.ReactElement {
  if (info.variant === 'paid') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
        Paid
      </span>
    );
  }

  if (info.variant === 'future') {
    return (
      <span className="text-slate-600 text-xs font-medium whitespace-nowrap">
        {info.text}
      </span>
    );
  }

  if (info.variant === 'today') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
        Due today
      </span>
    );
  }

  if (info.variant === 'overdue') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
        {info.text}
      </span>
    );
  }

  return <span className="text-slate-400">—</span>;
}
