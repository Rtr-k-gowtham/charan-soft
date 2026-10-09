// src/components/ui/Button.tsx
import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'xs' | 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 border-brand-600 hover:border-brand-700',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 border-red-600',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border-transparent',
  outline: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300',
};

const sizes = {
  xs: 'px-2 py-1 text-[11px] gap-1',
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-xs gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'sm',
  loading,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium border rounded-md
        transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-1
        ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : icon}
      {children}
    </button>
  );
}
