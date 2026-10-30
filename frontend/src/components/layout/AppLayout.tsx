// src/components/layout/AppLayout.tsx
import React, { useState, ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Factory,
  Package,
  Menu,
  FileText,
  ShoppingCart,
  Inbox,
  CheckCircle2,
  Droplets,
  Scissors,
  Sparkles,
  Shirt,
  ShieldCheck,
} from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../context/AuthContext';

interface Props {
  children: ReactNode;
}

interface MobileStageItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  stageId: number;
}

// Role 1 Mobile Stages (01, 02, 03, 09, 10) in exact order
const ROLE_1_STAGES: MobileStageItem[] = [
  { id: 'stage-1', label: 'Requirement', path: '/production/requirement', icon: FileText, stageId: 1 },
  { id: 'stage-2', label: 'PO', path: '/production/po', icon: ShoppingCart, stageId: 2 },
  { id: 'stage-3', label: 'Inward', path: '/production/inward', icon: Inbox, stageId: 3 },
  { id: 'stage-9', label: 'Packing', path: '/production/packing', icon: Package, stageId: 9 },
  { id: 'stage-10', label: 'Completed', path: '/production/completed', icon: CheckCircle2, stageId: 10 },
];

// Role 2 Mobile Stages (04, 05, 06, 07, 08) in exact order
const ROLE_2_STAGES: MobileStageItem[] = [
  { id: 'stage-4', label: 'Dyeing', path: '/production/dyeing', icon: Droplets, stageId: 4 },
  { id: 'stage-5', label: 'Cutting', path: '/production/cutting', icon: Scissors, stageId: 5 },
  { id: 'stage-6', label: 'Embroidery', path: '/production/embroidery', icon: Sparkles, stageId: 6 },
  { id: 'stage-7', label: 'Stitching', path: '/production/stitching', icon: Shirt, stageId: 7 },
  { id: 'stage-8', label: 'Checking', path: '/production/checking', icon: ShieldCheck, stageId: 8 },
];

export default function AppLayout({ children }: Props) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const roleName = (user?.role || user?.role_name || '').trim();
  const isAdmin = roleName === 'Admin' || roleName === 'admin' || user?.id === 1;
  const isRole1 = !isAdmin && (roleName === 'Role 1' || roleName.toLowerCase() === 'role 1' || roleName.toLowerCase() === 'role1');
  const isRole2 = !isAdmin && (roleName === 'Role 2' || roleName.toLowerCase() === 'role 2' || roleName.toLowerCase() === 'role2');

  // Highlight active stage for both direct route and nested order detail routes (e.g., /production/cutting/57)
  const isStageActive = (stagePath: string) => {
    return location.pathname === stagePath || location.pathname.startsWith(stagePath + '/');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc]">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header
          onSidebarToggle={() => setSidebarCollapsed(c => !c)}
          onMobileMenuToggle={() => setMobileMenuOpen(o => !o)}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0 touch-scroll">
          {children}
        </main>

        {/* Role 1: 5 Stage Shortcuts (Stages 01, 02, 03, 09, 10) */}
        {isRole1 && (
          <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 shadow-lg safe-area-pb"
            aria-label="Role 1 Stage Navigation"
          >
            {ROLE_1_STAGES.map(stage => {
              const Icon = stage.icon;
              const active = isStageActive(stage.path);
              return (
                <NavLink
                  key={stage.id}
                  to={stage.path}
                  className={`flex flex-col items-center justify-center py-2 px-0.5 w-full min-w-0 transition-all ${
                    active ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mb-0.5 shrink-0 transition-transform ${
                      active ? 'scale-110 text-brand-600' : 'text-slate-500'
                    }`}
                  />
                  <span
                    className={`text-[10px] leading-tight tracking-tight truncate w-full text-center ${
                      active ? 'font-bold text-brand-700' : 'text-slate-500'
                    }`}
                  >
                    {stage.label}
                  </span>
                </NavLink>
              );
            })}
          </nav>
        )}

        {/* Role 2: 5 Stage Shortcuts (Stages 04, 05, 06, 07, 08) */}
        {isRole2 && (
          <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 shadow-lg safe-area-pb"
            aria-label="Role 2 Stage Navigation"
          >
            {ROLE_2_STAGES.map(stage => {
              const Icon = stage.icon;
              const active = isStageActive(stage.path);
              return (
                <NavLink
                  key={stage.id}
                  to={stage.path}
                  className={`flex flex-col items-center justify-center py-2 px-0.5 w-full min-w-0 transition-all ${
                    active ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mb-0.5 shrink-0 transition-transform ${
                      active ? 'scale-110 text-brand-600' : 'text-slate-500'
                    }`}
                  />
                  <span
                    className={`text-[10px] leading-tight tracking-tight truncate w-full text-center ${
                      active ? 'font-bold text-brand-700' : 'text-slate-500'
                    }`}
                  >
                    {stage.label}
                  </span>
                </NavLink>
              );
            })}
          </nav>
        )}

        {/* Admin and Fallback: Existing Default Mobile Bottom Navigation (Home, Orders, Board, Stock, Menu) */}
        {!isRole1 && !isRole2 && (
          <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 shadow-lg safe-area-pb"
            aria-label="Mobile Navigation"
          >
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-0.5 w-full min-w-0 transition-colors ${
                  isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              <LayoutDashboard className="w-5 h-5 mb-0.5 shrink-0" />
              <span className="text-[10px] leading-tight tracking-tight truncate w-full text-center">Home</span>
            </NavLink>

            <NavLink
              to="/production/orders"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-0.5 w-full min-w-0 transition-colors ${
                  isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              <ClipboardList className="w-5 h-5 mb-0.5 shrink-0" />
              <span className="text-[10px] leading-tight tracking-tight truncate w-full text-center">Orders</span>
            </NavLink>

            <NavLink
              to="/production/board"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-0.5 w-full min-w-0 transition-colors ${
                  isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              <Factory className="w-5 h-5 mb-0.5 shrink-0" />
              <span className="text-[10px] leading-tight tracking-tight truncate w-full text-center">Board</span>
            </NavLink>

            <NavLink
              to="/inventory/stock"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-0.5 w-full min-w-0 transition-colors ${
                  isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              <Package className="w-5 h-5 mb-0.5 shrink-0" />
              <span className="text-[10px] leading-tight tracking-tight truncate w-full text-center">Stock</span>
            </NavLink>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={`flex flex-col items-center justify-center py-1.5 px-0.5 w-full min-w-0 transition-colors ${
                mobileMenuOpen ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Menu className="w-5 h-5 mb-0.5 shrink-0" />
              <span className="text-[10px] leading-tight tracking-tight truncate w-full text-center">Menu</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
