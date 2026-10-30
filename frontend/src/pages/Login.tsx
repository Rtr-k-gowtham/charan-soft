// src/pages/Login.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // Read saved user role from localStorage
      let userRole = 'Admin';
      try {
        const stored = localStorage.getItem('cheran_user');
        if (stored) {
          const u = JSON.parse(stored);
          userRole = u.role || u.role_name || 'Admin';
        }
      } catch { }

      if (userRole === 'Role 1' || userRole === 'Role 2') {
        navigate('/tasks');
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-96 bg-brand-700 text-white p-10 justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-10 bg-white/95 p-3 rounded-xl shadow-xs inline-flex">
            <img src="/logo.png" alt="CHERAN SOFT GOODS" className="h-8 w-auto object-contain" />
          </div>

          <h1 className="text-2xl font-bold mb-3 leading-snug">
            Complete Textile<br />Manufacturing Control
          </h1>
          <p className="text-brand-200 text-sm leading-relaxed">
            From purchase orders to production tracking, QC, inventory management, and delivery — all in one enterprise system.
          </p>

          <div className="mt-10 flex flex-col gap-4">
            {[
              { label: 'Role-Based Access Control', desc: 'Dedicated operational workflows for Role 1, Role 2 & Admin' },
              { label: 'Operational Tasks Screen', desc: 'Focused task view for pending stage batches' },
              { label: 'Real-time Production Notifications', desc: 'Instant stage transition & order alerts' },
              { label: 'Integrated Textile Workflow', desc: '10 seamless stages from requirement to dispatch' },
            ].map(f => (
              <div key={f.label} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-300 mt-1.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-white">{f.label}</p>
                  <p className="text-[11px] text-brand-300">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-brand-400">
          © 2026 Cheran Soft Goods, Tirupur, Tamil Nadu
        </p>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center mb-6 lg:hidden">
            <img src="/logo.png" alt="CHERAN SOFT GOODS" className="h-8 max-w-[220px] object-contain" />
          </div>

          <h2 className="text-lg font-bold text-slate-800 mb-1">Sign In</h2>
          <p className="text-xs text-slate-500 mb-6">Enter your credentials to access the ERP</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Username or Email <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="Enter username or email"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-9 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 text-white text-xs font-semibold rounded-md hover:bg-brand-700 transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
