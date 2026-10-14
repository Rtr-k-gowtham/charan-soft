// src/components/layout/AppLayout.tsx
import React, { useState, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Factory, Package, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';

interface Props {
  children: ReactNode;
}

export default function AppLayout({ children }: Props) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0 touch-scroll">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (< md) */}
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
      </div>
    </div>
  );
}

