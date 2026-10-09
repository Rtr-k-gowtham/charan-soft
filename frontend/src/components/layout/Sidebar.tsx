// src/components/layout/Sidebar.tsx
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Factory,
  Settings, FileText, ChevronDown, ChevronRight,
  Layers, Users, BarChart2, ClipboardList, X, BoxSelect
} from 'lucide-react';

interface NavItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  path?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Sales / Orders', icon: ShoppingCart, path: '/orders' },
  {
    label: 'Purchase', icon: ClipboardList,
    children: [
      { label: 'Purchase Orders', path: '/purchase/orders' },
      { label: 'Material Receipts', path: '/purchase/receipts' },
      { label: 'Supplier Payments', path: '/purchase/payments' },
      { label: 'Purchase Returns', path: '/purchase/returns' },
    ],
  },
  {
    label: 'Inventory', icon: Package,
    children: [
      { label: 'Materials', path: '/inventory/materials' },
      { label: 'Stock', path: '/inventory/stock' },
      { label: 'Stock Ledger', path: '/inventory/ledger' },
      { label: 'Material Consumption', path: '/inventory/consumption' },
      { label: 'Stock Adjustment', path: '/inventory/adjustment' },
      { label: 'Low Stock', path: '/inventory/low-stock' },
    ],
  },
  {
    label: 'Production', icon: Factory,
    children: [
      { label: 'Production Orders', path: '/production/orders' },
      { label: 'Production Board', path: '/production/board' },
      { label: 'Installation', path: '/production/installation' },
      { label: 'Dyeing', path: '/production/dyeing' },
      { label: 'Detailing', path: '/production/detailing' },
      { label: 'Cutting', path: '/production/cutting' },
      { label: 'Stitching', path: '/production/stitching' },
      { label: 'QC', path: '/production/qc' },
      { label: 'Rework', path: '/production/rework' },
      { label: 'Completed', path: '/production/completed' },
    ],
  },
  {
    label: 'Masters', icon: Layers,
    children: [
      { label: 'Products', path: '/masters/products' },
      { label: 'Materials', path: '/masters/materials' },
      { label: 'Categories', path: '/masters/categories' },
      { label: 'Suppliers', path: '/masters/suppliers' },
      { label: 'Customers', path: '/masters/customers' },
      { label: 'Colors', path: '/masters/colors' },
      { label: 'Sizes', path: '/masters/sizes' },
      { label: 'Units', path: '/masters/units' },
      { label: 'Designs', path: '/masters/designs' },
    ],
  },
  {
    label: 'Templates', icon: FileText,
    children: [
      { label: 'Material Templates', path: '/templates/material' },
      { label: 'Product Templates', path: '/templates/product' },
      { label: 'Order Templates', path: '/templates/order' },
      { label: 'PO Templates', path: '/templates/po' },
    ],
  },
  {
    label: 'Reports', icon: BarChart2,
    children: [
      { label: 'Purchase Reports', path: '/reports/purchase' },
      { label: 'Inventory Reports', path: '/reports/inventory' },
      { label: 'Production Reports', path: '/reports/production' },
      { label: 'QC Reports', path: '/reports/qc' },
      { label: 'Payment Reports', path: '/reports/payments' },
    ],
  },
  {
    label: 'Settings', icon: Settings,
    children: [
      { label: 'Users', path: '/settings/users' },
      { label: 'Roles', path: '/settings/roles' },
      { label: 'Permissions', path: '/settings/permissions' },
      { label: 'Production Stages', path: '/settings/stages' },
      { label: 'Company Settings', path: '/settings/company' },
      { label: 'PO Template', path: '/settings/po-template' },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function NavGroup({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const location = useLocation();
  const isActive = item.children?.some(c => c.path && location.pathname.startsWith(c.path));
  const [open, setOpen] = useState(isActive ?? false);
  const Icon = item.icon;

  if (!item.children) {
    return (
      <NavLink
        to={item.path!}
        end
        className={({ isActive }: { isActive: boolean }) =>
          `flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150
          ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`
        }
      >
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150
          ${isActive ? 'text-brand-700 bg-brand-50' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}
      >
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        {!collapsed && (
          <>
            <span className="truncate flex-1 text-left">{item.label}</span>
            {open ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
          </>
        )}
      </button>
      {!collapsed && open && (
        <div className="ml-5 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-slate-200 pl-3">
          {item.children.map(child => (
            <NavLink
              key={child.path}
              to={child.path!}
              className={({ isActive }: { isActive: boolean }) =>
                `block px-2 py-1 rounded text-[11px] font-medium transition-all duration-150
                ${isActive ? 'text-brand-700 bg-brand-50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, mobileOpen, onMobileClose }: SidebarProps) {
  const width = collapsed ? 'w-12' : 'w-56';

  const content = (
    <div className={`${width} h-full flex flex-col bg-white border-r border-slate-200 transition-all duration-200 overflow-hidden`}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-b border-slate-200 shrink-0">
        <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center shrink-0">
          <BoxSelect className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 leading-tight truncate">CHERAN SOFT GOODS</p>
            <p className="text-[9px] text-slate-400 uppercase tracking-wide">Textile ERP</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5">
        {navItems.map(item => (
          <NavGroup key={item.label} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-3 py-2 border-t border-slate-200 shrink-0">
          <p className="text-[9px] text-slate-300 text-center">© 2026 Cheran Soft Goods</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full shrink-0">{content}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={onMobileClose} />
          <div className="relative flex h-full w-64">
            {content}
            <button
              onClick={onMobileClose}
              className="absolute top-3 right-3 p-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
