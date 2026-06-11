import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store';
import apiClient from '../api/client';
import { setTokens } from '../api/tokenStorage';
import toast from 'react-hot-toast';
import {
  FaShieldAlt, FaArrowLeft, FaCheck, FaStar, FaLock, FaEnvelope,
  FaEye, FaEyeSlash, FaArrowRight, FaUserShield,
} from 'react-icons/fa';

const HERO = 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1600&q=85';

const TRUST = [
  { label: 'Secure password login', sub: 'Encrypted, bank-grade security.', icon: FaLock },
  { label: 'Curated stays', sub: 'Hand-picked properties.', icon: FaStar },
  { label: 'Email confirmations', sub: 'Bookings & room access in your inbox.', icon: FaEnvelope },
  { label: 'Easy recovery', sub: 'Reset your password any time.', icon: FaUserShield },
];

// Password rules mirror the backend SecurityService.validate_password.
const PW_RULES = [
  { test: (p) => p.length >= 8, label: '8+ characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'Uppercase' },
  { test: (p) => /[a-z]/.test(p), label: 'Lowercase' },
  { test: (p) => /\d/.test(p), label: 'Number' },
  { test: (p) => /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(p), label: 'Symbol' },
];
const passwordValid = (p) => PW_RULES.every((r) => r.test(p));

const HEADERS = {
  login: { title: 'Welcome back', desc: 'Sign in with your phone or email and password.' },
  signup: { title: 'Create your account', desc: 'A few quick details — under a minute.' },
  verify: { title: 'Verify your email', desc: 'Enter the 6-digit code we just emailed you.' },
  forgot: { title: 'Reset your password', desc: "Enter your phone or email and we'll send a 6-digit code." },
  reset: { title: 'Enter your code', desc: 'Check your email for the 6-digit reset code.' },
};

function PasswordField({ value, onChange, placeholder, autoComplete, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <FaLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" size={12} />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="input-base pl-10 pr-11"
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-ink-400 hover:text-ink-700 transition-colors"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <FaEyeSlash size={13} /> : <FaEye size={13} />}
      </button>
    </div>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [mode, setMode] = useState('login'); // login | signup | verify | forgot | reset
  const [loading, setLoading] = useState(false);

  // login
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // signup
  const [signup, setSignup] = useState({ name: '', phone: '', email: '', password: '' });
  const [signupEmail, setSignupEmail] = useState(''); // email the OTP was sent to

  // forgot / reset
  const [resetId, setResetId] = useState('');
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const codeRefs = useRef([]);
  const code = codeDigits.join('');

  const routeByRole = useCallback((user) => {
    if (user.role === 'global_admin') navigate('/global-admin', { replace: true });
    else if (user.role === 'org_admin' || user.role === 'employee') navigate('/org-admin', { replace: true });
    else if (user.role === 'admin') navigate('/admin/dashboard', { replace: true });
    else navigate('/dashboard', { replace: true });
  }, [navigate]);

  const finishAuth = useCallback((user, tokens, msg) => {
    setTokens(tokens);
    login(user, tokens);
    toast.success(msg);
    routeByRole(user);
  }, [login, routeByRole]);

  // ── Code input helpers (shared by signup-verify and password-reset) ──
  const resetCode = useCallback(() => setCodeDigits(['', '', '', '', '', '']), []);
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

  // ── Handlers ──
  const handleLogin = async (e) => {
    e.preventDefault();
    const id = loginId.trim();
    if (!id || !loginPw) { toast.error('Enter your phone/email and password'); return; }
    // If they typed an email (contains @), validate its format before sending.
    if (id.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) {
      toast.error('Please enter a valid email address'); return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { login_id: loginId.trim(), password: loginPw });
      finishAuth(res.data.user, res.data.tokens, 'Welcome back.');
    } catch (err) { toast.error(err.response?.data?.error || 'Invalid phone/email or password'); }
    finally { setLoading(false); }
  };

  const signupPayload = () => ({
    name: signup.name.trim(),
    phone: signup.phone.replace(/\D/g, ''),
    email: signup.email.trim(),
    password: signup.password,
  });

  const handleSignup = async (e) => {
    e.preventDefault();
    const { name, phone, email, password } = signupPayload();
    if (!name) { toast.error('Name is required'); return; }
    if (!email) { toast.error('Email is required'); return; }
    if (!/^[^\s@]+@gmail\.com$/i.test(email)) { toast.error('Please use a Gmail address (ending in @gmail.com)'); return; }
    if (!/^[6-9]\d{9}$/.test(phone)) { toast.error('Enter a valid 10-digit Indian mobile number'); return; }
    if (!passwordValid(password)) { toast.error('Choose a stronger password'); return; }
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/register/start', { name, phone, email, password });
      setSignupEmail(res.data.email || email);
      resetCode();
      setMode('verify');
      toast.success('Verification code sent to your email.');
    } catch (err) { toast.error(err.response?.data?.error || 'Could not start signup'); }
    finally { setLoading(false); }
  };

  const handleVerifySignup = async (e) => {
    e.preventDefault();
    if (code.length < 6) { toast.error('Enter the complete 6-digit code'); return; }
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/register/verify', { email: signupEmail, code });
      finishAuth(res.data.user, res.data.tokens, 'Welcome to Zero One.');
    } catch (err) { toast.error(err.response?.data?.error || 'Invalid or expired code'); }
    finally { setLoading(false); }
  };

  const handleResendSignup = async () => {
    setLoading(true);
    try {
      await apiClient.post('/auth/register/resend', signupPayload());
      resetCode();
      toast.success('A new code is on its way.');
    } catch (err) { toast.error(err.response?.data?.error || 'Could not resend the code'); }
    finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!resetId.trim()) { toast.error('Enter your phone or email'); return; }
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { login_id: resetId.trim() });
      toast.success('If the account exists, a code is on its way.');
      resetCode();
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
      finishAuth(res.data.user, res.data.tokens, 'Password reset. You are signed in.');
    } catch (err) { toast.error(err.response?.data?.error || 'Invalid or expired code'); }
    finally { setLoading(false); }
  };

  // Back-arrow target per mode.
  const goBack = () => {
    if (mode === 'verify') setMode('signup');
    else if (mode === 'reset') setMode('forgot');
    else setMode('login');
  };

  const header = HEADERS[mode];

  // 6-cell code input, reused by signup-verify and password-reset.
  const CodeInputs = (
    <div className="flex gap-2 sm:gap-2.5" onPaste={handleCodePaste}>
      {codeDigits.map((d, i) => (
        <input
          key={i} ref={(el) => (codeRefs.current[i] = el)}
          type="text" inputMode="numeric" maxLength={1} value={d}
          onChange={(e) => handleCodeChange(i, e.target.value)}
          onKeyDown={(e) => handleCodeKeyDown(i, e)}
          autoFocus={i === 0}
          className={`flex-1 aspect-square min-w-0 rounded-xl border-2 text-center text-xl sm:text-2xl font-black focus:outline-none transition-all num ${d
            ? 'border-teal-500 bg-gradient-to-br from-teal-50 to-sky-50 text-teal-700 shadow-md'
            : 'border-ink-200 bg-white text-ink-900 focus:border-teal-500'}`}
        />
      ))}
    </div>
  );

  return (
    <div className="h-screen flex bg-canvas overflow-hidden">
      {/* ── LEFT PANEL — Form (single screen, no scroll) ── */}
      <div className="flex-1 flex flex-col h-screen px-4 sm:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh-soft pointer-events-none" />

        {/* Top bar (all sizes) */}
        <div className="relative z-10 flex items-center justify-between py-3 sm:py-4 flex-shrink-0">
          <a href="/" className="flex items-center gap-2">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center font-display font-black text-white text-lg"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2, #2563eb)', boxShadow: '0 4px 14px -2px rgba(6,182,212,0.4)' }}
            >
              0<span className="text-[8px] -ml-0.5 self-end mb-1.5">1</span>
            </div>
            <span className="wordmark text-lg">Zero One<span className="wordmark-dot">.</span></span>
          </a>
          <button
            onClick={() => navigate('/properties')}
            className="text-xs font-bold text-ink-500 hover:text-teal-700 tracking-widest uppercase transition-colors"
          >
            Browse →
          </button>
        </div>

        <div className="relative z-10 flex-1 flex items-center justify-center min-h-0 py-2">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md"
          >
            {/* Header */}
            <div className="mb-5">
              {mode !== 'login' && (
                <button
                  onClick={goBack}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-600 hover:text-teal-700 mb-3 transition-colors group"
                >
                  <FaArrowLeft size={10} className="group-hover:-translate-x-0.5 transition-transform" />
                  {mode === 'verify' ? 'Edit details' : mode === 'reset' ? 'Back' : 'Back to sign in'}
                </button>
              )}
              <span className="hairline mb-3" />
              <motion.h1
                key={mode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-display font-black text-ink-900 tracking-tighter"
                style={{ fontSize: 'clamp(1.625rem, 3.6vw, 2.25rem)' }}
              >
                {header.title}
              </motion.h1>
              <p className="text-ink-500 text-sm mt-1.5 leading-relaxed">
                {mode === 'reset'
                  ? <>Code sent to <span className="font-bold text-ink-900 break-all">{resetId}</span></>
                  : mode === 'verify'
                    ? <>Code sent to <span className="font-bold text-ink-900 break-all">{signupEmail}</span></>
                    : header.desc}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {/* ── LOGIN ── */}
              {mode === 'login' && (
                <motion.form
                  key="login" onSubmit={handleLogin}
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }} className="space-y-4"
                >
                  <div>
                    <label className="block text-3xs font-bold text-ink-500 mb-2 uppercase tracking-widest">Phone or email</label>
                    <input
                      type="text" value={loginId} onChange={(e) => setLoginId(e.target.value)}
                      placeholder="98765 43210 or you@email.com" autoComplete="username" autoFocus
                      className="input-base" required
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-3xs font-bold text-ink-500 uppercase tracking-widest">Password</label>
                      <button type="button" onClick={() => { setResetId(loginId.trim()); setMode('forgot'); }}
                        className="text-2xs font-bold text-teal-700 hover:text-teal-900 transition-colors">
                        Forgot password?
                      </button>
                    </div>
                    <PasswordField value={loginPw} onChange={(e) => setLoginPw(e.target.value)}
                      placeholder="Your password" autoComplete="current-password" />
                  </div>

                  <motion.button
                    whileHover={{ scale: loginId && loginPw ? 1.01 : 1 }} whileTap={{ scale: 0.99 }}
                    type="submit" disabled={loading || !loginId || !loginPw}
                    className="btn btn-primary w-full py-3.5 text-sm shadow-lg"
                  >
                    {loading ? <span className="spinner" /> : <FaLock size={12} />}
                    {loading ? 'Signing in…' : 'Sign in'}
                  </motion.button>

                  <p className="text-center text-sm text-ink-600 pt-1">
                    New here?{' '}
                    <button type="button" onClick={() => setMode('signup')} className="font-bold text-teal-700 hover:text-teal-900">
                      Create an account
                    </button>
                  </p>
                </motion.form>
              )}

              {/* ── SIGNUP ── */}
              {mode === 'signup' && (
                <motion.form
                  key="signup" onSubmit={handleSignup}
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }} className="space-y-3"
                >
                  <div>
                    <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Full name</label>
                    <input
                      type="text" value={signup.name} onChange={(e) => setSignup((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Your name" className="input-base" required autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Gmail address</label>
                    <input
                      type="email" value={signup.email} onChange={(e) => setSignup((p) => ({ ...p, email: e.target.value }))}
                      placeholder="you@gmail.com" className="input-base" required
                    />
                    <p className="text-2xs text-ink-500 mt-1">A Gmail address — we'll email a code to verify it, plus bookings & recovery.</p>
                  </div>
                  <div>
                    <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Mobile number</label>
                    <div className="flex rounded-2xl border-2 border-ink-200 overflow-hidden bg-white focus-within:border-teal-500 transition-all">
                      <div className="flex items-center gap-2 px-3.5 py-3 bg-ink-50 border-r border-ink-200 flex-shrink-0">
                        <span className="text-base">🇮🇳</span>
                        <span className="text-sm font-bold text-ink-700 num">+91</span>
                      </div>
                      <input
                        type="tel" inputMode="numeric" value={signup.phone}
                        onChange={(e) => setSignup((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                        placeholder="98765 43210" maxLength={10}
                        className="flex-1 min-w-0 px-3.5 py-3 text-base font-bold text-ink-900 placeholder-ink-300 focus:outline-none num tracking-wide"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Password</label>
                    <PasswordField value={signup.password} onChange={(e) => setSignup((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Create a password" autoComplete="new-password" />
                    {signup.password.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {PW_RULES.map((r) => {
                          const ok = r.test(signup.password);
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
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    type="submit" disabled={loading}
                    className="btn btn-primary w-full py-3.5 text-sm shadow-lg"
                  >
                    {loading ? <span className="spinner" /> : <FaArrowRight size={12} />}
                    {loading ? 'Sending code…' : 'Continue'}
                  </motion.button>

                  <p className="text-center text-sm text-ink-600">
                    Already have an account?{' '}
                    <button type="button" onClick={() => setMode('login')} className="font-bold text-teal-700 hover:text-teal-900">
                      Sign in
                    </button>
                  </p>
                  <p className="text-2xs text-ink-500 text-center leading-relaxed">
                    By continuing you agree to our terms and{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline font-bold">privacy policy</a>.
                  </p>
                </motion.form>
              )}

              {/* ── VERIFY (signup email OTP) ── */}
              {mode === 'verify' && (
                <motion.form
                  key="verify" onSubmit={handleVerifySignup}
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }} className="space-y-5"
                >
                  <div>
                    <label className="block text-3xs font-bold text-ink-500 mb-3 uppercase tracking-widest">6-digit code</label>
                    {CodeInputs}
                  </div>
                  <div className="flex items-start gap-3 surface-soft px-4 py-3.5">
                    <FaEnvelope size={13} className="text-teal-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-ink-600 leading-relaxed">
                      Enter the code to confirm your email and finish creating your account. It expires shortly.
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: code.length === 6 ? 1.01 : 1 }} whileTap={{ scale: 0.99 }}
                    type="submit" disabled={loading || code.length < 6}
                    className="btn btn-primary w-full py-3.5 text-sm shadow-lg"
                  >
                    {loading ? <span className="spinner" /> : <FaCheck size={12} />}
                    {loading ? 'Verifying…' : 'Verify & create account'}
                  </motion.button>
                  <button type="button" onClick={handleResendSignup} disabled={loading} className="btn btn-ghost w-full text-sm">
                    Resend code
                  </button>
                </motion.form>
              )}

              {/* ── FORGOT ── */}
              {mode === 'forgot' && (
                <motion.form
                  key="forgot" onSubmit={handleForgot}
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }} className="space-y-4"
                >
                  <div>
                    <label className="block text-3xs font-bold text-ink-500 mb-2 uppercase tracking-widest">Phone or email</label>
                    <input
                      type="text" value={resetId} onChange={(e) => setResetId(e.target.value)}
                      placeholder="98765 43210 or you@email.com" autoFocus
                      className="input-base" required
                    />
                  </div>
                  <div className="flex items-start gap-3 surface-soft px-4 py-3.5">
                    <FaEnvelope size={13} className="text-teal-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-ink-600 leading-relaxed">
                      We'll email a 6-digit code to the address on your account. The code expires in 15 minutes.
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: resetId ? 1.01 : 1 }} whileTap={{ scale: 0.99 }}
                    type="submit" disabled={loading || !resetId}
                    className="btn btn-primary w-full py-3.5 text-sm shadow-lg"
                  >
                    {loading ? <span className="spinner" /> : <FaEnvelope size={12} />}
                    {loading ? 'Sending…' : 'Send reset code'}
                  </motion.button>
                  <p className="text-center text-sm text-ink-600">
                    Remembered it?{' '}
                    <button type="button" onClick={() => setMode('login')} className="font-bold text-teal-700 hover:text-teal-900">
                      Back to sign in
                    </button>
                  </p>
                </motion.form>
              )}

              {/* ── RESET ── */}
              {mode === 'reset' && (
                <motion.form
                  key="reset" onSubmit={handleReset}
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }} className="space-y-5"
                >
                  <div>
                    <label className="block text-3xs font-bold text-ink-500 mb-3 uppercase tracking-widest">6-digit code</label>
                    {CodeInputs}
                  </div>
                  <div>
                    <label className="block text-3xs font-bold text-ink-500 mb-2 uppercase tracking-widest">New password</label>
                    <PasswordField value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Create a new password" autoComplete="new-password" />
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
                    className="btn btn-primary w-full py-3.5 text-sm shadow-lg"
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
          </motion.div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Hero (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden flex-shrink-0">
        <motion.img
          initial={{ scale: 1.1 }} animate={{ scale: 1 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          src={HERO} alt="" className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 hero-cinematic opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-br from-ink-900/70 via-ink-900/40 to-teal-900/60" />
        <div className="blob blob-teal w-80 h-80 -top-20 -left-20 opacity-40 animate-drift" />
        <div className="blob blob-sunset w-80 h-80 bottom-0 -right-20 opacity-25 animate-drift" style={{ animationDelay: '5s' }} />

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14 justify-between text-white">
          <motion.a
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            href="/" className="inline-flex items-center gap-2 self-start group"
          >
            <motion.div
              whileHover={{ rotate: -8, scale: 1.06 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              className="h-10 w-10 rounded-xl flex items-center justify-center font-display font-black text-white text-xl"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2, #2563eb)', boxShadow: '0 8px 24px -4px rgba(6,182,212,0.6)' }}
            >
              0<span className="text-[9px] -ml-0.5 self-end mb-1.5">1</span>
            </motion.div>
            <span className="font-display font-black text-2xl tracking-tighter">Zero One<span className="text-teal-300">.</span></span>
          </motion.a>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-md"
          >
            <span className="feature-pill mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-300 animate-pulse" />
              Now live across India
            </span>
            <h2 className="font-display font-black text-white leading-[1.05] mb-5 tracking-tighter"
              style={{ fontSize: 'clamp(2.5rem, 4.5vw, 3.75rem)' }}>
              Stays that feel <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-cyan-200 to-sky-300">
                made for you.
              </span>
            </h2>
            <p className="text-white/75 text-base leading-relaxed mb-10">
              Boutique hotels and serviced stays — booked in minutes, with every confirmation
              and room key delivered straight to your inbox.
            </p>

            <ul className="space-y-4">
              {TRUST.map((t, i) => {
                const Icon = t.icon;
                return (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                    className="flex items-start gap-3"
                  >
                    <div className="mt-0.5 h-9 w-9 rounded-xl bg-white/12 border border-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
                      <Icon className="text-teal-300" size={13} />
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">{t.label}</p>
                      <p className="text-white/55 text-xs">{t.sub}</p>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
            className="flex items-center justify-between text-white/50 text-xs"
          >
            <p>© {new Date().getFullYear()} Zero One</p>
            <div className="flex items-center gap-2">
              <FaShieldAlt size={10} />
              <span>Secured & encrypted</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
