import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaSignInAlt, FaSignOutAlt, FaUserCircle, FaCompass,
  FaBookmark, FaBars, FaTimes, FaHeadset, FaChevronDown,
  FaMapMarkedAlt, FaPercent,
} from 'react-icons/fa';
import { useAuthStore } from '../store';

/**
 * Customer-facing top navigation.
 * - Sticky, frosted-glass on scroll
 * - Brand wordmark, nav links, login / user menu
 * - Mobile drawer for small screens
 *
 * Pass `transparent` to render on top of a hero image (white text);
 * the navbar still solidifies once the user scrolls past the hero.
 */
export default function Navbar({
  transparent = false,
  activeTab,
  onTabChange,
  onRequestLogout,
  showTabs = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Which in-page section (#deals / #help) is currently in view - drives
  // the nav highlight so Deals/Help light up like the other links.
  const [activeSection, setActiveSection] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // Scroll-spy: highlight Deals / Help when their section sits in the
  // middle band of the viewport. Clears (→ Stays) when neither is centered.
  useEffect(() => {
    const els = ['deals', 'help']
      .map(id => document.getElementById(id))
      .filter(Boolean);
    if (!els.length) return undefined;
    const obs = new IntersectionObserver((entries) => {
      setActiveSection(prev => {
        let next = prev;
        entries.forEach(e => {
          if (e.isIntersecting) next = e.target.id;
          else if (e.target.id === next) next = null;
        });
        return next;
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [location.pathname, activeTab]);

  const useDarkText = !transparent || scrolled;

  const NAV_LINKS = [
    { id: 'explore', to: '/properties', label: 'Stays', icon: FaCompass, authOnly: false },
    { id: 'deals', to: '/properties#deals', label: 'Deals', icon: FaPercent, authOnly: false },
    { id: 'help', to: '/properties#help', label: 'Help', icon: FaHeadset, authOnly: false },
    { id: 'bookings', to: '/dashboard', label: 'My Trips', icon: FaBookmark, authOnly: true },
  ];

  const isActive = (link) => {
    if (link.id === 'deals' || link.id === 'help') return activeSection === link.id;
    if (showTabs && activeTab) {
      // Stays stays highlighted only while no in-page section is in view.
      if (link.id === 'explore') return activeTab === 'explore' && !activeSection;
      if (link.id === 'bookings') return activeTab === 'bookings';
    }
    return location.pathname === link.to && !activeSection;
  };

  // Scroll to an in-page section (#deals / #help). If we're already on the
  // landing page, switch to the explore tab and scroll; otherwise navigate
  // to /properties#id and let the landing page handle the scroll on load.
  const goToSection = useCallback((id) => {
    setDrawerOpen(false);
    setMenuOpen(false);
    setActiveSection(id);  // immediate highlight; the observer keeps it in sync
    if (location.pathname === '/properties') {
      if (showTabs && onTabChange) onTabChange('explore');
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } else {
      navigate(`/properties#${id}`);
    }
  }, [showTabs, onTabChange, location.pathname, navigate]);

  const handleNavClick = useCallback((link, e) => {
    if (link.id === 'deals' || link.id === 'help') {
      e?.preventDefault?.();
      goToSection(link.id);
      return;
    }
    // Any non-section link clears the section highlight.
    setActiveSection(null);
    if (showTabs && onTabChange && (link.id === 'explore' || link.id === 'bookings')) {
      e?.preventDefault?.();
      if (link.id === 'bookings' && !isAuthenticated) {
        navigate('/login');
        return;
      }
      onTabChange(link.id);
      setDrawerOpen(false);
    } else {
      setDrawerOpen(false);
    }
  }, [showTabs, onTabChange, isAuthenticated, navigate, goToSection]);

  return (
    <>
      <motion.header
        initial={false}
        animate={{
          backgroundColor: useDarkText
            ? scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,1)'
            : 'rgba(255,255,255,0)',
          borderBottomColor: useDarkText
            ? scrolled ? 'rgba(226, 232, 240, 0.8)' : 'rgba(226, 232, 240, 0.6)'
            : 'rgba(255, 255, 255, 0)',
          boxShadow: useDarkText && scrolled
            ? '0 4px 20px -8px rgba(15, 23, 42, 0.08)'
            : '0 0 0 0 rgba(0,0,0,0)',
        }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{
          backdropFilter: scrolled ? 'blur(16px) saturate(180%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(16px) saturate(180%)' : 'none',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
        }}
        className="sticky top-0 z-40"
      >
        <div className="page-wide flex items-center justify-between gap-4 h-16 sm:h-[72px] lg:h-20">
          {/* Brand */}
          <Link
            to="/properties"
            onClick={(e) => showTabs && onTabChange ? handleNavClick({ id: 'explore' }, e) : null}
            className="flex items-center gap-2 flex-shrink-0 group"
          >
            <motion.div
              whileHover={{ rotate: -8, scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              className="h-9 w-9 rounded-xl flex items-center justify-center font-display font-black text-white text-lg"
              style={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #2563eb 100%)',
                boxShadow: '0 4px 14px -2px rgba(6, 182, 212, 0.5)',
              }}
            >
              0
              <span className="text-[8px] -ml-0.5 self-end mb-1.5">1</span>
            </motion.div>
            <div className="flex items-baseline">
              <span
                className="wordmark text-xl sm:text-2xl tracking-tighter transition-colors"
                style={{ color: useDarkText ? 'var(--ink-900)' : '#ffffff' }}
              >
                Zero One
              </span>
              <span
                className="wordmark-dot text-xl sm:text-2xl"
                style={{ color: useDarkText ? 'var(--teal-500)' : '#22d3ee' }}
              >.</span>
            </div>
          </Link>

          {/* Desktop links */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {NAV_LINKS.map(link => {
              if (link.authOnly && !isAuthenticated) return null;
              const active = isActive(link);
              const Icon = link.icon;
              return (
                <Link
                  key={link.id}
                  to={link.to}
                  onClick={(e) => handleNavClick(link, e)}
                  className="relative px-4 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2"
                  style={{
                    color: useDarkText
                      ? (active ? 'var(--teal-700)' : 'var(--ink-700)')
                      : (active ? '#ffffff' : 'rgba(255,255,255,0.85)'),
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="navbar-active"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: useDarkText
                          ? 'rgba(6, 182, 212, 0.10)'
                          : 'rgba(255, 255, 255, 0.18)',
                        border: useDarkText
                          ? '1px solid rgba(6, 182, 212, 0.2)'
                          : '1px solid rgba(255,255,255,0.25)',
                      }}
                    />
                  )}
                  <Icon size={12} className="relative z-10" />
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAuthenticated ? (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-full transition-colors"
                  style={{
                    background: useDarkText ? 'var(--ink-100)' : 'rgba(255,255,255,0.16)',
                    color: useDarkText ? 'var(--ink-800)' : '#fff',
                  }}
                >
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #2563eb 100%)',
                    }}
                  >
                    {(user?.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden md:inline text-sm font-semibold truncate max-w-[100px]">
                    {user?.name?.split(' ')[0]}
                  </span>
                  <FaChevronDown size={9} className="hidden md:inline" />
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl bg-white border border-ink-100 shadow-xl overflow-hidden"
                    >
                      <div className="px-4 py-4 bg-gradient-to-br from-teal-50 to-sky-50 border-b border-ink-100">
                        <p className="font-display font-bold text-ink-900 text-sm">{user?.name}</p>
                        <p className="text-xs text-ink-500 num">+91 {user?.phone}</p>
                      </div>
                      <div className="py-1.5">
                        {[
                          { label: 'My trips', icon: FaBookmark, onClick: () => { showTabs ? onTabChange?.('bookings') : navigate('/dashboard'); setMenuOpen(false); } },
                          { label: 'Profile', icon: FaUserCircle, onClick: () => { showTabs ? onTabChange?.('profile') : navigate('/dashboard'); setMenuOpen(false); } },
                          { label: 'Help & support', icon: FaHeadset, onClick: () => { goToSection('help'); } },
                        ].map(({ label, icon: Icon, onClick }) => (
                          <button
                            key={label}
                            onClick={onClick}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50 hover:text-teal-700 transition-colors"
                          >
                            <Icon size={13} className="text-ink-400" />
                            <span className="font-medium">{label}</span>
                          </button>
                        ))}
                        <div className="border-t border-ink-100 my-1" />
                        <button
                          onClick={() => { setMenuOpen(false); onRequestLogout?.(); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <FaSignOutAlt size={12} />
                          <span className="font-medium">Sign out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                  style={{
                    color: useDarkText ? 'var(--ink-700)' : '#fff',
                  }}
                >
                  Sign in
                </button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/login')}
                  className="btn btn-primary text-xs sm:text-sm px-4 sm:px-5 py-2"
                >
                  <FaSignInAlt size={11} />
                  Get started
                </motion.button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden h-10 w-10 flex items-center justify-center rounded-full transition-colors"
              style={{
                background: useDarkText ? 'var(--ink-100)' : 'rgba(255,255,255,0.16)',
                color: useDarkText ? 'var(--ink-800)' : '#fff',
              }}
              aria-label="Open menu"
            >
              <FaBars size={14} />
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 36 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-[85vw] max-w-sm bg-white shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-5 border-b border-ink-100">
                <div className="flex items-center gap-2">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center font-display font-black text-white text-lg"
                    style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2, #2563eb)' }}
                  >
                    0<span className="text-[8px] -ml-0.5 self-end mb-1.5">1</span>
                  </div>
                  <span className="wordmark text-xl">
                    Zero One<span className="wordmark-dot">.</span>
                  </span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="h-9 w-9 flex items-center justify-center rounded-full bg-ink-100 text-ink-700 hover:bg-ink-200 transition-colors"
                  aria-label="Close menu"
                >
                  <FaTimes size={13} />
                </button>
              </div>

              {isAuthenticated && (
                <div className="px-5 py-5 bg-gradient-to-br from-teal-50 via-sky-50 to-white border-b border-ink-100 flex items-center gap-3">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center text-base font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2, #2563eb)' }}
                  >
                    {(user?.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-ink-900 truncate">{user?.name}</p>
                    <p className="text-xs text-ink-500 num">+91 {user?.phone}</p>
                  </div>
                </div>
              )}

              <nav className="flex-1 py-4 overflow-y-auto">
                {NAV_LINKS.map(link => {
                  if (link.authOnly && !isAuthenticated) return null;
                  const active = isActive(link);
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.id}
                      to={link.to}
                      onClick={(e) => handleNavClick(link, e)}
                      className={`flex items-center gap-3 px-5 py-3.5 text-sm font-semibold transition-colors ${active
                        ? 'text-teal-700 bg-teal-50 border-l-4 border-teal-500'
                        : 'text-ink-700 hover:bg-ink-50 border-l-4 border-transparent'
                        }`}
                    >
                      <Icon size={14} className={active ? 'text-teal-500' : 'text-ink-400'} />
                      {link.label}
                    </Link>
                  );
                })}

                <div className="my-3 mx-5 h-px bg-ink-100" />

                <div className="px-5 space-y-3">
                  {!isAuthenticated ? (
                    <>
                      <button
                        onClick={() => { setDrawerOpen(false); navigate('/login'); }}
                        className="btn btn-primary w-full"
                      >
                        <FaSignInAlt size={11} /> Sign in
                      </button>
                      <p className="text-xs text-ink-500 text-center">
                        New here? Sign in with your phone - no passwords needed.
                      </p>
                    </>
                  ) : (
                    <button
                      onClick={() => { setDrawerOpen(false); onRequestLogout?.(); }}
                      className="btn btn-outline w-full text-danger-600 border-red-200 hover:bg-red-50"
                    >
                      <FaSignOutAlt size={11} /> Sign out
                    </button>
                  )}
                </div>
              </nav>

              <div className="px-5 py-4 border-t border-ink-100 bg-ink-50">
                <p className="text-3xs text-ink-500 uppercase tracking-widest font-semibold mb-1">Need help?</p>
                <a href="tel:07592905000" className="text-sm font-bold text-teal-700 num">
                  📞 07592905000
                </a>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
