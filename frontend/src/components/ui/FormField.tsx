// src/components/ui/FormField.tsx
import React, { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';

interface BaseProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children?: ReactNode;
}

interface InputProps extends BaseProps, InputHTMLAttributes<HTMLInputElement> {
  as?: 'input';
}
interface TextareaProps extends BaseProps {
  as: 'textarea';
  rows?: number;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  disabled?: boolean;
}
interface SelectProps extends BaseProps, SelectHTMLAttributes<HTMLSelectElement> {
  as: 'select';
  children?: ReactNode;
}

type Props = InputProps | TextareaProps | SelectProps;

const inputCls = `w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white
  focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200
  disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-300
  transition-colors duration-150`;

export default function FormField(props: Props) {
  const { label, error, required, hint, as = 'input', children, ...rest } = props as Props & { children?: ReactNode };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-slate-600 flex items-center gap-0.5">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      {children ? (
        as === 'select' ? (
          <select className={inputCls} {...(rest as SelectHTMLAttributes<HTMLSelectElement>)}>
            {children}
          </select>
        ) : (
          children
        )
      ) : as === 'textarea' ? (
        <textarea
          className={`${inputCls} resize-none`}
          rows={(rest as TextareaProps).rows ?? 3}
          {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : as === 'select' ? (
        <select className={inputCls} {...(rest as SelectHTMLAttributes<HTMLSelectElement>)} />
      ) : (
        <input className={inputCls} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}

      {hint && !error && <p className="text-[10px] text-slate-400">{hint}</p>}
      {error && <p className="text-[10px] text-red-500 font-medium">{error}</p>}
    </div>
  );
}
