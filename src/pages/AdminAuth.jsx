import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store';
import apiClient from '../api/client';
import { setTokens } from '../api/tokenStorage';
import toast from 'react-hot-toast';
import {
  FaShieldAlt, FaArrowLeft, FaLock, FaUserShield, FaKey, FaChartLine,
  FaEnvelope, FaEye, FaEyeSlash, FaCheck,
} from 'react-icons/fa';

const PW_RULES = [
  { test: (p) => p.length >= 8, label: '8+ characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'Uppercase' },
  { test: (p) => /[a-z]/.test(p), label: 'Lowercase' },
  { test: (p) => /\d/.test(p), label: 'Number' },
  { test: (p) => /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(p), label: 'Symbol' },
];
const passwordValid = (p) => PW_RULES.every((r) => r.test(p));

const HERO = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=85';

const FEATURES = [
  { icon: FaUserShield, label: 'Role-based access', sub: 'Granular permissions per staff' },
  { icon: FaChartLine, label: 'Live operations', sub: 'Bookings, occupancy, revenue' },
  { icon: FaLock, label: 'Bank-grade security', sub: 'TLS + audit logs on every action' },
];

export default function AdminAuth() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [mode, setMode] = useState('login'); // login | forgot | reset
  const [adminLoginId, setAdminLoginId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // forgot / reset
  const [resetId, setResetId] = useState('');
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const codeRefs = useRef([]);
  const code = codeDigits.join('');

  const routeByRole = (user) => {
    if (user.role === 'global_admin') navigate('/global-admin');
    else if (user.role === 'org_admin' || user.role === 'employee') navigate('/org-admin');
    else navigate('/admin/dashboard');
  };

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
      routeByRole(user);
    } catch (err) { toast.error(err.response?.data?.error || 'Invalid credentials'); }
    finally { setLoading(false); }
  };

  const handleCodeChange = useCallback((idx, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    setCodeDigits((prev) => { const next = [...prev]; next[idx] = digit; return next; });
    if (digit && idx < 5) codeRefs.current[idx + 1]?.focus();
  }, []);
  const handleCodeKeyDown = useCallback((idx, e) => {
    if (e.key === 'Backspace' && !codeDigits[idx] && idx > 0) codeRefs.current[idx - 1]?.focus();
  }, [codeDigits]);
  const handleCodePaste = useCallback((e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste.length) {
      setCodeDigits(paste.split('').concat(Array(6 - paste.length).fill('')));
      codeRefs.current[Math.min(paste.length, 5)]?.focus();
    }
  }, []);

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!resetId.trim()) { toast.error('Enter your staff email or phone'); return; }
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { login_id: resetId.trim() });
      toast.success('If the account exists, a code is on its way.');
      setCodeDigits(['', '', '', '', '', '']);
      setNewPassword('');
      setMode('reset');
    } catch (err) { toast.error(err.response?.data?.error || 'Could not send reset code'); }
    finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (code.length < 6) { toast.error('Enter the complete 6-digit code'); return; }
    if (!passwordValid(newPassword)) { toast.error('Choose a stronger password'); return; }
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/reset-password', {
        login_id: resetId.trim(), code, new_password: newPassword,
      });
      const { user, tokens } = res.data;
      setTokens(tokens);
      login(user, tokens);
      toast.success('Password reset. You are signed in.');
      routeByRole(user);
    } catch (err) { toast.error(err.response?.data?.error || 'Invalid or expired code'); }
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
              style={{ fontSize: 'clamp(1.875rem, 4.5vw, 2.5rem)' }}
            >
              {mode === 'login' ? 'Sign in to manage your stays.'
                : mode === 'forgot' ? 'Reset your password.'
                  : 'Enter your code.'}
            </h1>
            <p className="text-ink-500 text-sm sm:text-base mt-2 leading-relaxed">
              {mode === 'login' ? 'Use your assigned staff email or phone with your password.'
                : mode === 'forgot' ? "Enter your staff email or phone and we'll send a 6-digit code."
                  : <>Code sent to <span className="font-bold text-ink-900 break-all">{resetId}</span></>}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'login' && (
              <motion.form
                key="login" onSubmit={handleAdminLogin}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }} className="space-y-4"
              >
                <div>
                  <label className="block text-3xs font-bold text-ink-500 mb-2 uppercase tracking-widest">Email or phone</label>
                  <input
                    type="text" value={adminLoginId}
                    onChange={e => setAdminLoginId(e.target.value)}
                    placeholder="staff@example.com" autoFocus autoComplete="username"
                    className="input-base"
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-3xs font-bold text-ink-500 uppercase tracking-widest">Password</label>
                    <button type="button" onClick={() => { setResetId(adminLoginId.trim()); setMode('forgot'); }}
                      className="text-2xs font-bold text-teal-700 hover:text-teal-900 transition-colors">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <FaKey className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" size={12} />
                    <input
                      type={showPw ? 'text' : 'password'} value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      placeholder="Your password" autoComplete="current-password"
                      className="input-base pl-10 pr-11"
                      required
                    />
                    <button type="button" onClick={() => setShowPw(s => !s)} tabIndex={-1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-ink-400 hover:text-ink-700 transition-colors"
                      aria-label={showPw ? 'Hide password' : 'Show password'}>
                      {showPw ? <FaEyeSlash size={13} /> : <FaEye size={13} />}
                    </button>
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
              </motion.form>
            )}

            {mode === 'forgot' && (
              <motion.form
                key="forgot" onSubmit={handleForgot}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }} className="space-y-4"
              >
                <button type="button" onClick={() => setMode('login')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-600 hover:text-teal-700 transition-colors group">
                  <FaArrowLeft size={10} className="group-hover:-translate-x-0.5 transition-transform" /> Back to sign in
                </button>
                <div>
                  <label className="block text-3xs font-bold text-ink-500 mb-2 uppercase tracking-widest">Email or phone</label>
                  <input
                    type="text" value={resetId} onChange={e => setResetId(e.target.value)}
                    placeholder="staff@example.com" autoFocus className="input-base" required
                  />
                </div>
                <div className="flex items-start gap-3 surface-soft px-4 py-3.5">
                  <FaEnvelope size={13} className="text-teal-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-ink-600 leading-relaxed">
                    We'll email a 6-digit code to the address on your account. It expires in 15 minutes.
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: resetId ? 1.01 : 1 }} whileTap={{ scale: 0.99 }}
                  type="submit" disabled={loading || !resetId}
                  className="btn btn-primary w-full py-4 text-sm shadow-lg"
                >
                  {loading ? <span className="spinner" /> : <FaEnvelope size={12} />}
                  {loading ? 'Sending…' : 'Send reset code'}
                </motion.button>
              </motion.form>
            )}

            {mode === 'reset' && (
              <motion.form
                key="reset" onSubmit={handleReset}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }} className="space-y-5"
              >
                <button type="button" onClick={() => setMode('forgot')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-600 hover:text-teal-700 transition-colors group">
                  <FaArrowLeft size={10} className="group-hover:-translate-x-0.5 transition-transform" /> Back
                </button>
                <div>
                  <label className="block text-3xs font-bold text-ink-500 mb-3 uppercase tracking-widest">6-digit code</label>
                  <div className="flex gap-2 sm:gap-2.5" onPaste={handleCodePaste}>
                    {codeDigits.map((d, i) => (
                      <input
                        key={i} ref={el => (codeRefs.current[i] = el)}
                        type="text" inputMode="numeric" maxLength={1} value={d}
                        onChange={e => handleCodeChange(i, e.target.value)}
                        onKeyDown={e => handleCodeKeyDown(i, e)}
                        autoFocus={i === 0}
                        className={`flex-1 aspect-square min-w-0 rounded-xl border-2 text-center text-xl sm:text-2xl font-black focus:outline-none transition-all num ${d
                          ? 'border-teal-500 bg-gradient-to-br from-teal-50 to-sky-50 text-teal-700 shadow-md'
                          : 'border-ink-200 bg-white text-ink-900 focus:border-teal-500'}`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-3xs font-bold text-ink-500 mb-2 uppercase tracking-widest">New password</label>
                  <div className="relative">
                    <FaLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" size={12} />
                    <input
                      type={showNewPw ? 'text' : 'password'} value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Create a new password" autoComplete="new-password"
                      className="input-base pl-10 pr-11" required
                    />
                    <button type="button" onClick={() => setShowNewPw(s => !s)} tabIndex={-1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-ink-400 hover:text-ink-700 transition-colors"
                      aria-label={showNewPw ? 'Hide password' : 'Show password'}>
                      {showNewPw ? <FaEyeSlash size={13} /> : <FaEye size={13} />}
                    </button>
                  </div>
                  {newPassword.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {PW_RULES.map((r) => {
                        const ok = r.test(newPassword);
                        return (
                          <span key={r.label}
                            className={`inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full border transition-colors ${ok
                              ? 'bg-teal-50 text-teal-700 border-teal-200'
                              : 'bg-ink-50 text-ink-400 border-ink-200'}`}
                          >
                            {ok && <FaCheck size={7} />} {r.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: code.length === 6 ? 1.01 : 1 }} whileTap={{ scale: 0.99 }}
                  type="submit" disabled={loading || code.length < 6}
                  className="btn btn-primary w-full py-4 text-sm shadow-lg"
                >
                  {loading && <span className="spinner" />}
                  {loading ? 'Resetting…' : 'Reset password & sign in'}
                </motion.button>
                <button type="button" onClick={handleForgot} disabled={loading} className="btn btn-ghost w-full text-sm">
                  Resend code
                </button>
              </motion.form>
            )}
          </AnimatePresence>

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
