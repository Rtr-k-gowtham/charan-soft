// src/components/ui/Modal.tsx
import React, { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  maxWidth?: string;
  className?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const sizes: Record<string, string> = { 
  sm: 'max-w-sm', 
  md: 'max-w-md', 
  lg: 'max-w-lg', 
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
  '3xl': 'max-w-5xl',
  '4xl': 'max-w-6xl',
  full: 'max-w-[94vw]'
};

export default function Modal({ open, isOpen, onClose, title, subtitle, size = 'md', maxWidth, className = '', children, footer }: Props) {
  const isVisible = open ?? isOpen ?? false;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isVisible) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxWidth || sizes[size] || 'max-w-md'} ${className} bg-white rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden transition-all`}
      >
        {/* Mobile drag handle indicator */}
        <div className="sm:hidden w-12 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 className="text-sm sm:text-base font-semibold text-slate-800 truncate">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 sm:py-4 touch-scroll overscroll-contain">
          {children}
        </div>

        {footer && (
          <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 shrink-0 safe-area-pb">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
