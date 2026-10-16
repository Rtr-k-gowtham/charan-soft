// src/pages/Login.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
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
              { label: 'Dynamic Category Engine', desc: 'Fully configurable forms and templates' },
              { label: 'Real-time Production Board', desc: 'Track partial quantities across all stages' },
              { label: 'Auto Inventory Updates', desc: 'Stock ledger updated on every receipt' },
              { label: 'Enterprise QC & Rework', desc: 'Full pass / reject / rework tracking' },
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
                placeholder="admin or admin@cheransoftgoods.com"
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

          <div className="mt-5 p-3 bg-slate-50 border border-slate-200 rounded-md">
            <p className="text-[10px] font-semibold text-slate-500 mb-1.5">Sign In Credentials:</p>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => { setEmail('admin'); setPassword('admin123'); }}
                className="text-left text-xs font-semibold text-brand-700 hover:underline flex items-center justify-between"
              >
                <span>Username: <code className="bg-brand-50 px-1.5 py-0.5 rounded text-brand-800">admin</code></span>
                <span className="text-[11px] text-slate-500 font-normal">Password: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">admin123</code></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
