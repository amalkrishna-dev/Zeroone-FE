import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store';
import apiClient from '../api/client';
import { setTokens } from '../api/tokenStorage';
import toast from 'react-hot-toast';
import {
  FaShieldAlt, FaArrowLeft, FaLock, FaUserShield, FaKey, FaChartLine,
} from 'react-icons/fa';

const HERO = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=85';

const FEATURES = [
  { icon: FaUserShield, label: 'Role-based access', sub: 'Granular permissions per staff' },
  { icon: FaChartLine, label: 'Live operations', sub: 'Bookings, occupancy, revenue' },
  { icon: FaLock, label: 'Bank-grade security', sub: 'TLS + audit logs on every action' },
];

export default function AdminAuth() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [adminLoginId, setAdminLoginId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!adminLoginId || !adminPassword) { toast.error('Enter login ID and password'); return; }
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/admin-login', { login_id: adminLoginId, password: adminPassword });
      const { user, tokens } = res.data;
      setTokens(tokens);
      login(user, tokens);
      toast.success('Welcome back.');
      if (user.role === 'global_admin') navigate('/global-admin');
      else if (user.role === 'org_admin' || user.role === 'employee') navigate('/org-admin');
      else navigate('/admin/dashboard');
    } catch (err) { toast.error(err.response?.data?.error || 'Invalid credentials'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-canvas overflow-hidden">

      {/* ── LEFT - Form ── */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-6 sm:py-10 relative">
        <div className="absolute inset-0 bg-mesh-soft pointer-events-none" />

        {/* Mobile top bar */}
        <div className="lg:hidden absolute top-0 left-0 right-0 px-4 py-4 flex items-center justify-between z-10">
          <a href="/" className="flex items-center gap-2">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center font-display font-black text-white text-lg"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2, #2563eb)' }}
            >
              0<span className="text-[8px] -ml-0.5 self-end mb-1.5">1</span>
            </div>
            <span className="wordmark text-lg">Zero One<span className="wordmark-dot">.</span></span>
          </a>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md relative z-10 mt-14 lg:mt-0"
        >
          {/* Back */}
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-600 hover:text-teal-700 mb-5 transition-colors group"
          >
            <FaArrowLeft size={10} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to customer login
          </button>

          <span className="hairline mb-3" />

          <div className="mb-6">
            <span className="feature-pill mb-3 text-ink-700"
              style={{ background: 'rgba(6,182,212,0.10)', borderColor: 'rgba(6,182,212,0.20)', color: '#0e7490' }}
            >
              <FaShieldAlt size={9} className="text-teal-600" />
              Staff portal
            </span>
            <h1
              className="font-display font-black text-ink-900 tracking-tighter"
              style={{ fontSize: 'clamp(2rem, 4.5vw, 2.5rem)' }}
            >
              Sign in to manage your stays.
            </h1>
            <p className="text-ink-500 text-sm sm:text-base mt-2 leading-relaxed">
              Use your assigned staff email or phone with your password.
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-3xs font-bold text-ink-500 mb-2 uppercase tracking-widest">Email or phone</label>
              <input
                type="text" value={adminLoginId}
                onChange={e => setAdminLoginId(e.target.value)}
                placeholder="staff@example.com" autoFocus
                className="input-base"
                required
              />
            </div>
            <div>
              <label className="block text-3xs font-bold text-ink-500 mb-2 uppercase tracking-widest">Password</label>
              <div className="relative">
                <FaKey className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" size={12} />
                <input
                  type="password" value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-base pl-10"
                  required
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: adminLoginId && adminPassword ? 1.01 : 1 }}
              whileTap={{ scale: 0.99 }}
              type="submit" disabled={loading || !adminLoginId || !adminPassword}
              className="btn btn-primary w-full py-4 text-sm shadow-lg"
            >
              {loading ? <span className="spinner" /> : <FaLock size={12} />}
              {loading ? 'Signing in…' : 'Sign in to dashboard'}
            </motion.button>

            <p className="text-2xs text-ink-500 text-center leading-relaxed pt-2">
              By signing in you agree to the{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline font-bold">
                privacy policy
              </a>.
            </p>
          </form>

          <div className="mt-10 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-3xs font-bold text-ink-400 hover:text-teal-700 tracking-widest uppercase transition-colors"
            >
              ← Customer login
            </button>
          </div>
        </motion.div>
      </div>

      {/* ── RIGHT - Hero (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden flex-shrink-0">
        <motion.img
          initial={{ scale: 1.1 }} animate={{ scale: 1 }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          src={HERO} alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 hero-cinematic opacity-95" />
        <div className="absolute inset-0 bg-gradient-to-br from-ink-900/85 via-ink-900/60 to-teal-900/70" />

        <div className="blob blob-teal w-80 h-80 -top-20 -left-20 opacity-40 animate-drift" />
        <div className="blob blob-blue w-80 h-80 bottom-0 -right-20 opacity-30 animate-drift" style={{ animationDelay: '6s' }} />

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14 justify-between text-white">
          <motion.a
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            href="/" className="inline-flex items-center gap-2 self-start"
          >
            <motion.div
              whileHover={{ rotate: -8, scale: 1.06 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              className="h-10 w-10 rounded-xl flex items-center justify-center font-display font-black text-white text-xl"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2, #2563eb)', boxShadow: '0 8px 24px -4px rgba(6,182,212,0.6)' }}
            >
              0<span className="text-[9px] -ml-0.5 self-end mb-1.5">1</span>
            </motion.div>
            <span className="font-display font-black text-2xl tracking-tighter">
              Zero One<span className="text-teal-300">.</span>
            </span>
          </motion.a>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-md"
          >
            <span className="feature-pill mb-6">
              <FaShieldAlt size={10} className="text-teal-300" />
              Staff Portal
            </span>
            <h2
              className="font-display font-black text-white leading-[1.05] mb-5 tracking-tighter"
              style={{ fontSize: 'clamp(2.5rem, 4.5vw, 3.5rem)' }}
            >
              Run your property - <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-cyan-200 to-sky-300">
                with confidence.
              </span>
            </h2>
            <p className="text-white/75 text-base leading-relaxed mb-10">
              Bookings, KYC, housekeeping, payments, reports - all in one calm workspace built for the staff who actually run the floor.
            </p>

            <ul className="space-y-4">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                    className="flex items-start gap-3"
                  >
                    <div className="mt-0.5 h-9 w-9 rounded-xl bg-white/12 border border-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
                      <Icon className="text-teal-300" size={13} />
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">{f.label}</p>
                      <p className="text-white/55 text-xs">{f.sub}</p>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="flex items-center justify-between text-white/50 text-xs"
          >
            <p>© {new Date().getFullYear()} Zero One · Staff Portal</p>
            <div className="flex items-center gap-2">
              <FaShieldAlt size={10} />
              <span>Encrypted</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
