import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store';
import apiClient from '../api/client';
import { setTokens } from '../api/tokenStorage';
import toast from 'react-hot-toast';
import {
  FaWhatsapp, FaShieldAlt, FaArrowLeft, FaCheck, FaBolt,
  FaStar, FaCompass, FaPercent, FaLock,
} from 'react-icons/fa';

const HERO = 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1600&q=85';

const TRUST = [
  { label: 'Instant OTP login', sub: 'No passwords, ever.', icon: FaBolt },
  { label: 'Curated stays', sub: 'Hand-picked properties.', icon: FaStar },
  { label: 'WhatsApp updates', sub: 'Real-time confirmations.', icon: FaWhatsapp },
  { label: 'Bank-grade security', sub: 'Your data is encrypted end-to-end.', icon: FaLock },
];

const STEP_LABELS = { phone: 'Welcome in', otp: 'Verify it\'s you', signup: 'One last step' };
const STEP_DESCS = {
  phone: 'Sign in with your Indian mobile number - no password needed.',
  otp: 'We just sent a 6-digit code to your phone.',
  signup: 'A few quick details - under a minute.',
};

const STEPS = ['phone', 'otp', 'signup'];

export default function Auth() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [signupData, setSignupData] = useState({ name: '', email: '' });
  const otpRefs = useRef([]);

  const otp = otpDigits.join('');
  const stepIdx = STEPS.indexOf(step);

  const handleOtpChange = useCallback((idx, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    setOtpDigits(prev => { const next = [...prev]; next[idx] = digit; return next; });
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
  }, []);

  const handleOtpKeyDown = useCallback((idx, e) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  }, [otpDigits]);

  const handleOtpPaste = useCallback((e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste.length) {
      setOtpDigits(paste.split('').concat(Array(6 - paste.length).fill('')));
      otpRefs.current[Math.min(paste.length, 5)]?.focus();
    }
  }, []);

  const handleSendOtp = async (e) => {
    e?.preventDefault?.();
    if (!phone || phone.length < 10) { toast.error('Enter a valid 10-digit number'); return; }
    setLoading(true);
    try {
      await apiClient.post('/auth/send-otp', { phone });
      toast.success('OTP sent via WhatsApp!');
      setStep('otp');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to send OTP'); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length < 6) { toast.error('Enter the complete 6-digit OTP'); return; }
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/verify-otp', { phone, otp });
      if (res.data.is_new_user) { setStep('signup'); }
      else {
        const { user, tokens } = res.data;
        setTokens(tokens);
        login(user, tokens);
        toast.success('Welcome back.');
        if (user.role === 'global_admin') navigate('/global-admin');
        else if (user.role === 'org_admin') navigate('/org-admin');
        else if (user.role === 'admin') navigate('/admin/dashboard');
        else navigate('/dashboard');
      }
    } catch (err) { toast.error(err.response?.data?.error || 'Invalid OTP'); }
    finally { setLoading(false); }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!signupData.name.trim()) { toast.error('Name is required'); return; }
    setLoading(true);
    try {
      const payload = { phone, name: signupData.name.trim() };
      if (signupData.email.trim()) payload.email = signupData.email.trim();
      const res = await apiClient.post('/auth/register', payload);
      const { user, tokens } = res.data;
      setTokens(tokens);
      login(user, tokens);
      toast.success('Welcome to Zero One.');
      navigate('/dashboard');
    } catch (err) { toast.error(err.response?.data?.error || 'Registration failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-canvas overflow-hidden">

      {/* ── LEFT PANEL - Form ── */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-6 sm:py-10 overflow-y-auto relative">
        {/* Background mesh */}
        <div className="absolute inset-0 bg-mesh-soft pointer-events-none" />

        {/* Mobile top bar */}
        <div className="lg:hidden absolute top-0 left-0 right-0 px-4 py-4 flex items-center justify-between z-10">
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

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md relative z-10 mt-14 lg:mt-0"
        >
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => {
              const done = stepIdx > i;
              const active = stepIdx === i;
              return (
                <React.Fragment key={s}>
                  <motion.div
                    animate={{ scale: active ? 1.15 : 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    className={`h-7 w-7 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors ${active
                        ? 'text-white shadow-md'
                        : done
                          ? 'bg-teal-100 text-teal-700 border border-teal-200'
                          : 'bg-ink-100 text-ink-400'
                      }`}
                    style={active ? { background: 'linear-gradient(135deg, #06b6d4, #0891b2)' } : {}}
                  >
                    {done ? <FaCheck size={9} /> : i + 1}
                  </motion.div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 rounded-full transition-colors ${done ? 'bg-teal-300' : 'bg-ink-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Header */}
          <div className="mb-8">
            {step !== 'phone' && (
              <button
                onClick={() => { setStep('phone'); setOtpDigits(['', '', '', '', '', '']); }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-600 hover:text-teal-700 mb-4 transition-colors group"
              >
                <FaArrowLeft size={10} className="group-hover:-translate-x-0.5 transition-transform" />
                Back
              </button>
            )}
            <span className="hairline mb-3" />
            <motion.h1
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display font-black text-ink-900 tracking-tighter"
              style={{ fontSize: 'clamp(1.875rem, 4vw, 2.5rem)' }}
            >
              {STEP_LABELS[step]}
            </motion.h1>
            <p className="text-ink-500 text-sm sm:text-base mt-2 leading-relaxed">
              {step === 'otp'
                ? <>Code sent to <span className="font-bold text-ink-900 num">+91 {phone}</span></>
                : STEP_DESCS[step]}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {/* PHONE */}
            {step === 'phone' && (
              <motion.form
                key="phone-step"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleSendOtp}
                className="space-y-5"
              >
                <div>
                  <label className="block text-3xs font-bold text-ink-500 mb-2 uppercase tracking-widest">Mobile number</label>
                  <div className="flex rounded-2xl border-2 border-ink-200 overflow-hidden bg-white focus-within:border-teal-500 focus-within:shadow-lg focus-within:shadow-teal-500/10 transition-all">
                    <div className="flex items-center gap-2 px-4 py-3.5 bg-ink-50 border-r border-ink-200 flex-shrink-0">
                      <span className="text-lg">🇮🇳</span>
                      <span className="text-sm font-bold text-ink-700 num">+91</span>
                    </div>
                    <input
                      type="tel" value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98765 43210" maxLength={10} autoFocus
                      className="flex-1 px-4 py-3.5 text-lg font-bold text-ink-900 placeholder-ink-300 focus:outline-none num tracking-wide"
                      required
                    />
                    <AnimatePresence>
                      {phone.length === 10 && (
                        <motion.div
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          className="flex items-center pr-4"
                        >
                          <span
                            className="h-6 w-6 rounded-full text-white text-xs flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                          >
                            <FaCheck size={9} />
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: phone.length === 10 ? 1.01 : 1 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit" disabled={loading || phone.length < 10}
                  className="btn btn-primary w-full py-4 text-sm shadow-lg"
                >
                  {loading ? <span className="spinner" /> : <FaWhatsapp size={16} />}
                  {loading ? 'Sending OTP…' : 'Get OTP on WhatsApp'}
                </motion.button>

                <div className="flex items-start gap-3 surface-soft px-4 py-3.5">
                  <FaShieldAlt size={13} className="text-teal-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-ink-600 leading-relaxed">
                    Your number is only used to send a one-time code. We never store passwords or share data.
                  </p>
                </div>

                <div className="text-center pt-1">
                  <button
                    type="button" onClick={() => navigate('/properties')}
                    className="text-xs text-ink-500 hover:text-teal-700 font-semibold transition-colors"
                  >
                    Browse properties without signing in →
                  </button>
                </div>
              </motion.form>
            )}

            {/* OTP */}
            {step === 'otp' && (
              <motion.form
                key="otp-step"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleVerifyOtp}
                className="space-y-5"
              >
                <div>
                  <label className="block text-3xs font-bold text-ink-500 mb-3 uppercase tracking-widest">6-digit code</label>
                  <div className="flex gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                    {otpDigits.map((d, i) => (
                      <motion.input
                        key={i}
                        ref={el => otpRefs.current[i] = el}
                        type="text" inputMode="numeric" maxLength={1} value={d}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        autoFocus={i === 0}
                        animate={{ scale: d ? [1, 1.08, 1] : 1 }}
                        transition={{ duration: 0.18 }}
                        className={`flex-1 aspect-square min-w-0 rounded-xl border-2 text-center text-2xl font-black focus:outline-none transition-all num shadow-sm ${d
                            ? 'border-teal-500 bg-gradient-to-br from-teal-50 to-sky-50 text-teal-700 shadow-md'
                            : 'border-ink-200 bg-white text-ink-900 focus:border-teal-500 focus:shadow-teal-500/10 focus:shadow-md'
                          }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-ink-500 mt-4 text-center">Code expires in 10 minutes</p>
                </div>

                <motion.button
                  whileHover={{ scale: otp.length === 6 ? 1.01 : 1 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit" disabled={loading || otp.length < 6}
                  className="btn btn-primary w-full py-4 text-sm shadow-lg"
                >
                  {loading && <span className="spinner" />}
                  {loading ? 'Verifying…' : 'Verify & continue'}
                </motion.button>

                <button
                  type="button"
                  onClick={() => { setOtpDigits(['', '', '', '', '', '']); handleSendOtp({ preventDefault: () => { } }); }}
                  className="btn btn-ghost w-full text-sm"
                >
                  Resend OTP
                </button>
              </motion.form>
            )}

            {/* SIGNUP */}
            {step === 'signup' && (
              <motion.form
                key="signup-step"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleSignup}
                className="space-y-4"
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-3xs font-bold text-ink-500 mb-2 uppercase tracking-widest">Full name *</label>
                    <input
                      type="text" placeholder="Your name" value={signupData.name}
                      onChange={e => setSignupData(p => ({ ...p, name: e.target.value }))}
                      className="input-base" required autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-3xs font-bold text-ink-500 mb-2 uppercase tracking-widest">Email (optional)</label>
                    <input
                      type="email" placeholder="your@email.com" value={signupData.email}
                      onChange={e => setSignupData(p => ({ ...p, email: e.target.value }))}
                      className="input-base"
                    />
                    <p className="text-2xs text-ink-500 mt-1.5">For booking confirmations and access recovery.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl p-3.5"
                  style={{ background: 'linear-gradient(135deg, #ecfeff, #f0f9ff)', border: '1px solid #cffafe' }}
                >
                  <FaShieldAlt size={13} className="text-teal-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-teal-800 leading-relaxed font-medium">
                    Bring a government photo ID - reception verifies it at check-in. No online verification needed.
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: signupData.name.trim() ? 1.01 : 1 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit" disabled={loading || !signupData.name.trim()}
                  className="btn btn-primary w-full py-4 text-sm shadow-lg"
                >
                  {loading && <span className="spinner" />}
                  {loading ? 'Creating account…' : 'Create account & continue'}
                </motion.button>

                <p className="text-2xs text-ink-500 text-center leading-relaxed">
                  By continuing you agree to our terms and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline font-bold">
                    privacy policy
                  </a>.
                </p>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Staff link */}
          <div className="mt-10 text-center">
            <button
              onClick={() => navigate('/staff')}
              className="text-3xs font-bold text-ink-400 hover:text-teal-700 tracking-widest uppercase transition-colors"
            >
              Staff Login →
            </button>
          </div>
        </motion.div>
      </div>

      {/* ── RIGHT PANEL - Hero (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden flex-shrink-0">
        <motion.img
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          src={HERO} alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Multi-layer overlay */}
        <div className="absolute inset-0 hero-cinematic opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-br from-ink-900/70 via-ink-900/40 to-teal-900/60" />

        {/* Floating blobs */}
        <div className="blob blob-teal w-80 h-80 -top-20 -left-20 opacity-40 animate-drift" />
        <div className="blob blob-sunset w-80 h-80 bottom-0 -right-20 opacity-25 animate-drift" style={{ animationDelay: '5s' }} />

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14 justify-between text-white">
          {/* Top - wordmark */}
          <motion.a
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
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
            <span className="font-display font-black text-2xl tracking-tighter">
              Zero One<span className="text-teal-300">.</span>
            </span>
          </motion.a>

          {/* Middle - hero copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-md"
          >
            <span className="feature-pill mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-300 animate-pulse" />
              Now live across India
            </span>
            <h2
              className="font-display font-black text-white leading-[1.05] mb-5 tracking-tighter"
              style={{ fontSize: 'clamp(2.5rem, 4.5vw, 3.75rem)' }}
            >
              Stays that feel <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-cyan-200 to-sky-300">
                made for you.
              </span>
            </h2>
            <p className="text-white/75 text-base leading-relaxed mb-10">
              Boutique hotels and serviced stays - booked instantly with a one-time code.
              No passwords, no friction, no nonsense.
            </p>

            <ul className="space-y-4">
              {TRUST.map((t, i) => {
                const Icon = t.icon;
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
                      <p className="text-white text-sm font-bold">{t.label}</p>
                      <p className="text-white/55 text-xs">{t.sub}</p>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>

          {/* Bottom - footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
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
