// src/components/layout/Sidebar.tsx
import React, { useState, useEffect } from 'react';
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
      {
        label: 'Production Board',
        path: '/production/board',
        children: [
          {
            label: 'Installation',
            path: '/production/installation',
            children: [
              {
                label: 'Dyeing',
                path: '/production/dyeing',
                children: [
                  {
                    label: 'Detailing',
                    path: '/production/detailing',
                    children: [
                      {
                        label: 'Cutting',
                        path: '/production/cutting',
                        children: [
                          {
                            label: 'Stitching',
                            path: '/production/stitching',
                            children: [
                              {
                                label: 'QC',
                                path: '/production/qc',
                                children: [
                                  {
                                    label: 'Rework',
                                    path: '/production/rework',
                                    children: [
                                      {
                                        label: 'Completed',
                                        path: '/production/completed'
                                      }
                                    ]
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
  },
  {
    label: 'Masters', icon: Layers,
    children: [
      { label: 'Products', path: '/masters/products' },
      { label: 'Materials', path: '/masters/materials' },
      { label: 'Categories', path: '/masters/categories' },
      { label: 'Suppliers', path: '/masters/suppliers' },
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

function NavNode({
  item,
  depth = 0,
  collapsed = false,
}: {
  item: NavItem;
  depth?: number;
  collapsed?: boolean;
}) {
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
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150
            ${isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`
          }
        >
          {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
          {!collapsed && <span className="truncate">{item.label}</span>}
        </NavLink>
      );
    }

    return (
      <NavLink
        to={item.path!}
        end
        className={({ isActive }) =>
          `block px-2 py-1 rounded text-[11px] font-medium transition-all duration-150 truncate
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
          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150
            ${isTopActive ? 'text-brand-700 bg-brand-50 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}
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
          <div className="ml-4 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-slate-200 pl-2">
            {item.children.map(child => (
              <NavNode
                key={child.label + (child.path || '')}
                item={child}
                depth={depth + 1}
                collapsed={collapsed}
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
        className={`flex items-center justify-between rounded text-[11px] font-medium transition-all duration-150 ${
          isDirectActive ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50 text-slate-600'
        }`}
      >
        {item.path ? (
          <NavLink
            to={item.path}
            end
            className={({ isActive }) =>
              `flex-1 truncate px-2 py-1 transition-colors ${
                isActive ? 'text-brand-700 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`
            }
          >
            {item.label}
          </NavLink>
        ) : (
          <span className="flex-1 truncate px-2 py-1 text-slate-600">
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
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors mr-0.5"
          title={open ? 'Collapse' : 'Expand'}
          aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
      </div>

      {open && (
        <div className="ml-1.5 pl-1 border-l border-slate-200 flex flex-col gap-0.5 mt-0.5">
          {item.children.map(child => (
            <NavNode
              key={child.label + (child.path || '')}
              item={child}
              depth={depth + 1}
              collapsed={collapsed}
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
          <NavNode key={item.label} item={item} collapsed={collapsed} />
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
