// src/components/layout/Header.tsx
import React from 'react';
import { Bell, ChevronDown, User, LogOut, PanelLeft, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  onSidebarToggle: () => void;
  onMobileMenuToggle?: () => void;
}

export default function Header({ onSidebarToggle }: Props) {
  const { user, logout } = useAuth();
  const [userOpen, setUserOpen] = React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(standalone);
    }
  }, []);

  return (
    <header className="h-12 shrink-0 flex items-center justify-between bg-white border-b border-slate-200 px-3 z-30">
      <div className="flex items-center gap-2">
        {/* Desktop: collapse sidebar */}
        <button
          onClick={onSidebarToggle}
          className="hidden md:flex p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Toggle Sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Mobile: Logo branding */}
        <div className="flex md:hidden items-center gap-2 min-w-0 pl-1">
          <img src="/icon.png" alt="Logo" className="w-7 h-7 object-contain shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-900 tracking-tight whitespace-nowrap leading-tight">
              CHERAN SOFT
            </span>
            <span className="text-[9px] text-slate-400 font-medium leading-none">
              Textile ERP
            </span>
          </div>
        </div>

        <span className="text-xs text-slate-400 hidden sm:block font-medium">
          Textile Manufacturing ERP
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Notification bell */}
        <button
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 min-h-[38px] min-w-[38px] flex items-center justify-center"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserOpen(o => !o)}
            className="flex items-center gap-1.5 pl-2 pr-1.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors min-h-[38px]"
          >
            <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-brand-700" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[11px] font-semibold text-slate-700 leading-tight">{user?.name}</p>
              <p className="text-[9px] text-slate-400 leading-tight">{user?.role_name || user?.role}</p>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {userOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white rounded-lg border border-slate-200 shadow-xl py-1">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-800">{user?.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                </div>
                {!isStandalone && (
                  <button
                    onClick={() => {
                      setUserOpen(false);
                      localStorage.removeItem('csg_pwa_dismissed_until');
                      window.dispatchEvent(new Event('show-pwa-install-prompt'));
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-brand-700 hover:bg-brand-50 transition-colors font-medium border-b border-slate-100"
                  >
                    <Download className="w-3.5 h-3.5 text-brand-600" />
                    Install App
                  </button>
                )}
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors font-medium"
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
