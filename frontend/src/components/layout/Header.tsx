// src/components/layout/Header.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  User,
  LogOut,
  PanelLeft,
  Download,
  CheckCheck,
  Package,
  Layers,
  Clock,
  ExternalLink,
  Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ProductionNotification } from '../../types';

interface Props {
  onSidebarToggle: () => void;
  onMobileMenuToggle?: () => void;
}

export default function Header({ onSidebarToggle }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const [notifications, setNotifications] = useState<ProductionNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(standalone);
    }
  }, []);

  // Fetch notifications
  const loadNotifications = async () => {
    try {
      const res = await api.getNotifications(20);
      if (res) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unread_count || 0);
      }
    } catch (e) {
      // Silently fail if not logged in or network error
    }
  };

  // Initial load and periodic polling (every 20s)
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(async () => {
      try {
        const countRes = await api.getUnreadNotificationCount();
        if (countRes && typeof countRes.unread_count === 'number') {
          setUnreadCount(countRes.unread_count);
        }
      } catch (e) {}
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  // When opening dropdown, refresh full list
  const toggleNotifications = () => {
    if (!notifOpen) {
      setLoadingNotifs(true);
      loadNotifications().finally(() => setLoadingNotifs(false));
    }
    setNotifOpen(prev => !prev);
    setUserOpen(false);
  };

  // Mark single notification read and navigate
  const handleNotificationClick = async (notif: ProductionNotification) => {
    if (!notif.is_read) {
      try {
        await api.markNotificationRead(notif.id);
        setNotifications(prev =>
          prev.map(n => (n.id === notif.id ? { ...n, is_read: 1 } : n))
        );
        setUnreadCount(c => Math.max(0, c - 1));
      } catch (e) {}
    }
    setNotifOpen(false);
    if (notif.action_url) {
      navigate(notif.action_url);
    }
  };

  // Mark all notifications read
  const handleMarkAllRead = async () => {
    try {
      await api.markNotificationRead(undefined, true);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (e) {}
  };

  // Relative time helper
  const formatTimeAgo = (dateStr: string) => {
    try {
      const d = new Date(dateStr.replace(' ', 'T') + 'Z');
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return dateStr;
    }
  };

  return (
    <header className="h-12 shrink-0 flex items-center justify-between bg-white border-b border-slate-200 px-3 z-30 relative">
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
        {/* Notification Bell & Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={toggleNotifications}
            className={`relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 min-h-[38px] min-w-[38px] flex items-center justify-center transition-colors ${
              notifOpen ? 'bg-slate-100 text-slate-800' : ''
            }`}
            title="Production Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setNotifOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-80 sm:w-96 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[480px] animate-in fade-in slide-in-from-top-1 duration-150">
                {/* Notification Dropdown Header */}
                <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-semibold border border-brand-100">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1 transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {loadingNotifs && notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Loading notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                        <Bell className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700">No notifications yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        New production orders and stage transfers will appear here.
                      </p>
                    </div>
                  ) : (
                    notifications.map(n => {
                      const isUnread = !n.is_read;
                      const isOrderCreated = n.event_type === 'ORDER_CREATED';

                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3 text-left hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-3 relative ${
                            isUnread ? 'bg-brand-50/30' : ''
                          }`}
                        >
                          {/* Event Icon */}
                          <div
                            className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5 ${
                              isOrderCreated
                                ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            }`}
                          >
                            {isOrderCreated ? (
                              <Package className="w-4 h-4" />
                            ) : (
                              <Layers className="w-4 h-4" />
                            )}
                          </div>

                          {/* Message Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-xs font-bold text-slate-800 truncate">
                                {n.title}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-0.5">
                                <Clock className="w-3 h-3" />
                                {formatTimeAgo(n.created_at)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 line-clamp-2 leading-tight">
                              {n.message}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="font-mono text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                                {n.order_number}
                              </span>
                              {n.destination_stage_name && (
                                <span className="text-[10px] text-slate-500 truncate">
                                  → {n.destination_stage_name}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Unread indicator dot */}
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0 mt-2" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Dropdown Footer */}
                <div className="p-2 border-t border-slate-100 bg-slate-50/70 text-center">
                  <button
                    onClick={() => {
                      setNotifOpen(false);
                      navigate('/tasks');
                    }}
                    className="w-full py-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
                  >
                    View Operational Tasks Screen →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => {
              setUserOpen(o => !o);
              setNotifOpen(false);
            }}
            className="flex items-center gap-1.5 pl-2 pr-1.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors min-h-[38px]"
          >
            <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-brand-700" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[11px] font-semibold text-slate-700 leading-tight">{user?.name}</p>
              <p className="text-[9px] text-slate-400 leading-tight flex items-center gap-1">
                <Shield className="w-2.5 h-2.5 text-brand-600" />
                {user?.role_name || user?.role}
              </p>
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
                  <span className="inline-block mt-1 px-1.5 py-0.2 text-[9px] font-bold rounded bg-brand-50 text-brand-700 border border-brand-100">
                    {user?.role_name || user?.role}
                  </span>
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
