// src/components/layout/Header.tsx
import React from 'react';
import { Menu, Bell, ChevronDown, User, LogOut, PanelLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  onSidebarToggle: () => void;
  onMobileMenuToggle: () => void;
}

export default function Header({ onSidebarToggle, onMobileMenuToggle }: Props) {
  const { user, logout } = useAuth();
  const [userOpen, setUserOpen] = React.useState(false);

  return (
    <header className="h-11 shrink-0 flex items-center justify-between bg-white border-b border-slate-200 px-3 z-30">
      <div className="flex items-center gap-2">
        {/* Desktop: collapse sidebar */}
        <button
          onClick={onSidebarToggle}
          className="hidden md:flex p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        {/* Mobile: open drawer */}
        <button
          onClick={onMobileMenuToggle}
          className="flex md:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <Menu className="w-4 h-4" />
        </button>

        <span className="text-xs text-slate-400 hidden sm:block font-medium">
          Textile Manufacturing ERP
        </span>
      </div>

      <div className="flex items-center gap-1">
        {/* Notification bell placeholder */}
        <button className="relative p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserOpen(o => !o)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-brand-700" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[11px] font-semibold text-slate-700 leading-tight">{user?.name}</p>
              <p className="text-[9px] text-slate-400 leading-tight">{user?.role_name || user?.role}</p>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {userOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white rounded-md border border-slate-200 shadow-lg py-1">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-700">{user?.name}</p>
                  <p className="text-[10px] text-slate-400">{user?.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
