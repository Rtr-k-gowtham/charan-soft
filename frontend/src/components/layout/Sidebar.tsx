// src/components/layout/Sidebar.tsx
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Factory,
  Settings, FileText, ChevronDown, ChevronRight,
  Layers, Users, BarChart2, ClipboardList, X
} from 'lucide-react';

interface NavItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  path?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },

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
      {
        label: 'Production Stages',
        children: [
          { label: '01. Requirement gathering', path: '/production/requirement' },
          { label: '02. PO (Purchase Order)', path: '/production/po' },
          { label: '03. Inward', path: '/production/inward' },
          { label: '04. Dyeing', path: '/production/dyeing' },
          { label: '05. Cutting — Product-wise', path: '/production/cutting' },
          { label: '06. Embroidery — Out/In', path: '/production/embroidery' },
          { label: '07. Stitching — Color-wise', path: '/production/stitching' },
          { label: '08. Checking', path: '/production/checking' },
          { label: '09. Packing', path: '/production/packing' },
          { label: '10. Completed', path: '/production/completed' },
        ],
      },
    ],
  },
  {
    label: 'Masters', icon: Layers,
    children: [
      { label: 'Products', path: '/masters/products' },
      { label: 'Materials', path: '/masters/materials' },
      { label: 'Categories', path: '/masters/categories' },
      { label: 'Suppliers', path: '/masters/suppliers' },
      { label: 'Dyeing Mills', path: '/masters/dyeing-mills' },
      { label: 'Embroidery Works', path: '/masters/embroidery-works' },
      { label: 'Buyer Master', path: '/masters/buyers' },
      { label: 'Pantone Colors', path: '/masters/colors' },
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

function hasActiveDescendant(item: NavItem, currentPath: string): boolean {
  if (item.path) {
    if (item.path === currentPath) return true;
    if (item.path !== '/' && currentPath.startsWith(item.path + '/')) return true;
  }
  if (item.children && item.children.length > 0) {
    return item.children.some(child => hasActiveDescendant(child, currentPath));
  }
  return false;
}

interface NavNodeProps {
  item: NavItem;
  depth?: number;
  collapsed?: boolean;
  onItemClick?: () => void;
}

function NavNode({
  item,
  depth = 0,
  collapsed = false,
  onItemClick,
}: NavNodeProps) {
  const location = useLocation();
  const Icon = item.icon;
  const isDirectActive = item.path ? location.pathname === item.path : false;
  const hasActiveChild = item.children ? item.children.some(c => hasActiveDescendant(c, location.pathname)) : false;

  // Auto-expand if active, has active child, or is part of production workflow in production view
  const isProductionWorkflow = item.path?.startsWith('/production');
  const [open, setOpen] = useState(() => isDirectActive || hasActiveChild || (isProductionWorkflow && location.pathname.startsWith('/production')));

  // Automatically expand parent menus when navigating directly to a nested stage URL
  useEffect(() => {
    if (hasActiveChild || isDirectActive) {
      setOpen(true);
    }
  }, [location.pathname, hasActiveChild, isDirectActive]);

  // Leaf item without children
  if (!item.children || item.children.length === 0) {
    if (depth === 0) {
      return (
        <NavLink
          to={item.path!}
          end
          onClick={onItemClick}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 sm:py-1.5 rounded-lg sm:rounded-md text-xs font-medium transition-all duration-150 min-h-[36px] sm:min-h-0
            ${isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`
          }
        >
          {Icon && <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />}
          {!collapsed && <span className="truncate">{item.label}</span>}
        </NavLink>
      );
    }

    return (
      <NavLink
        to={item.path!}
        end
        onClick={onItemClick}
        className={({ isActive }) =>
          `block px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] font-medium transition-all duration-150 truncate min-h-[30px] sm:min-h-0 flex items-center
          ${isActive ? 'text-brand-700 bg-brand-50 font-bold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`
        }
      >
        {item.label}
      </NavLink>
    );
  }

  // Item with children at top level (depth === 0)
  if (depth === 0) {
    const isTopActive = isDirectActive || hasActiveChild;
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 sm:py-1.5 rounded-lg sm:rounded-md text-xs font-medium transition-all duration-150 min-h-[36px] sm:min-h-0
            ${isTopActive ? 'text-brand-700 bg-brand-50 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}
        >
          {Icon && <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />}
          {!collapsed && (
            <>
              <span className="truncate flex-1 text-left">{item.label}</span>
              {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
            </>
          )}
        </button>
        {!collapsed && open && (
          <div className="ml-4 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-slate-200 pl-2">
            {item.children.map(child => (
              <NavNode
                key={child.label + (child.path || '')}
                item={child}
                depth={depth + 1}
                collapsed={collapsed}
                onItemClick={onItemClick}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Nested item with children (depth > 0)
  return (
    <div>
      <div
        className={`flex items-center justify-between rounded-md text-[11px] font-medium transition-all duration-150 min-h-[32px] sm:min-h-0 ${isDirectActive ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50 text-slate-600'
          }`}
      >
        {item.path ? (
          <NavLink
            to={item.path}
            end
            onClick={onItemClick}
            className={({ isActive }) =>
              `flex-1 truncate px-2.5 py-1.5 sm:py-1 transition-colors ${isActive ? 'text-brand-700 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`
            }
          >
            {item.label}
          </NavLink>
        ) : (
          <span className="flex-1 truncate px-2.5 py-1.5 sm:py-1 text-slate-600">
            {item.label}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(o => !o);
          }}
          className="p-1.5 sm:p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors mr-0.5"
          title={open ? 'Collapse' : 'Expand'}
          aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
        >
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {open && (
        <div className="ml-1.5 pl-1.5 border-l border-slate-200 flex flex-col gap-0.5 mt-0.5">
          {item.children.map(child => (
            <NavNode
              key={child.label + (child.path || '')}
              item={child}
              depth={depth + 1}
              collapsed={collapsed}
              onItemClick={onItemClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, mobileOpen, onMobileClose }: SidebarProps) {
  const width = collapsed ? 'w-12' : 'w-60';

  const content = (
    <div className={`${width} h-full flex flex-col bg-white border-r border-slate-200 transition-all duration-200 overflow-hidden`}>
      {/* Logo */}
      <div className="flex items-center px-3 py-3 border-b border-slate-200 shrink-0 min-h-[56px]">
        {collapsed ? (
          <div className="w-full flex items-center justify-center" title="CHERAN SOFT GOODS">
            <img
              src="/icon.png"
              alt="Cheran Soft Goods"
              className="w-7 h-7 object-contain drop-shadow-xs transition-transform duration-200 hover:scale-105"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between w-full min-w-0 pr-6 md:pr-0">
            <img
              src="/logo.png"
              alt="CHERAN SOFT GOODS"
              className="h-8 max-w-[185px] w-auto object-contain transition-opacity duration-200"
            />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5 touch-scroll">
        {navItems.map(item => (
          <NavNode
            key={item.label}
            item={item}
            collapsed={collapsed}
            onItemClick={onMobileClose}
          />
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
        <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
          />
          <div className="relative flex h-full w-72 max-w-[85vw] shadow-2xl bg-white animate-in slide-in-from-left duration-200">
            {content}
            <button
              onClick={onMobileClose}
              className="absolute top-3.5 right-3 p-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 min-h-[36px] min-w-[36px] flex items-center justify-center shadow-xs"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
