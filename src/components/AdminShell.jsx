import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaBars, FaTimes, FaSignOutAlt, FaChevronRight,
} from 'react-icons/fa';
import { useAuthStore } from '../store';
import NotificationsBell from './NotificationsBell';

/**
 * AdminShell - sidebar + header chrome for all admin pages.
 *
 * Props:
 * - title            - page title shown in header
 * - subtitle         - optional small text under title
 * - tabs             - array of { id, label, icon }
 * - activeTab        - currently active tab id
 * - onTabChange      - (tabId) => void
 * - onRequestLogout  - () => void
 * - roleLabel        - chip text (e.g. "Org Admin")
 * - actions          - optional React node rendered on the right side of the header
 * - children         - page content
 */
export default function AdminShell({
  title, subtitle,
  tabs = [], activeTab, onTabChange,
  onRequestLogout, roleLabel = 'Admin',
  actions, children,
}) {
  const { user } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const userInitial = (user?.name || '?').charAt(0).toUpperCase();

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const SidebarNav = ({ onClick }) => (
    <nav className="flex-1 px-3 py-4 overflow-y-auto">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => { onTabChange?.(t.id); onClick?.(); }}
            className="relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors mb-1"
            style={{
              color: active ? '#0e7490' : '#475569',
              background: active ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!active) { e.currentTarget.style.background = 'rgba(241, 245, 249, 1)'; e.currentTarget.style.color = '#0b1220'; }
            }}
            onMouseLeave={(e) => {
              if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569'; }
            }}
          >
            {active && (
              <motion.div
                layoutId="admin-nav-pill"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-xl pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, rgba(6,182,212,0.10) 0%, rgba(37,99,235,0.05) 100%)',
                  border: '1px solid rgba(6,182,212,0.18)',
                }}
              />
            )}
            <Icon size={14} className="relative z-10" />
            <span className="relative z-10 flex-1 text-left">{t.label}</span>
            {active && <FaChevronRight size={9} className="relative z-10" />}
          </button>
        );
      })}
    </nav>
  );

  const BrandTile = () => (
    <div className="flex items-center gap-2.5">
      <motion.div
        whileHover={{ rotate: -8, scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        className="h-10 w-10 rounded-xl flex items-center justify-center font-display font-black text-white text-lg flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #2563eb 100%)',
          boxShadow: '0 4px 14px -2px rgba(6, 182, 212, 0.4)',
        }}
      >
        0<span className="text-[8px] -ml-0.5 self-end mb-1.5">1</span>
      </motion.div>
      <div className="min-w-0">
        <span className="wordmark text-lg block leading-tight">
          Zero One<span className="wordmark-dot">.</span>
        </span>
        <span className="text-3xs font-bold text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded uppercase tracking-widest">
          {roleLabel}
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas flex">

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 bg-white border-r border-ink-100 z-30">
        <div className="h-20 flex items-center px-5 border-b border-ink-100 flex-shrink-0">
          <BrandTile />
        </div>

        <SidebarNav />

        {/* User footer */}
        <div className="p-4 border-t border-ink-100 bg-gradient-to-br from-canvas to-canvas-soft">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #2563eb 100%)' }}
            >
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink-900 truncate">{user?.name || '-'}</p>
              <p className="text-3xs font-bold text-ink-500 uppercase tracking-widest">{roleLabel}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <NotificationsBell />
            <button
              onClick={onRequestLogout}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-ink-600 hover:text-red-600 transition-colors px-3 py-2 rounded-lg border border-ink-200 bg-white hover:bg-red-50 hover:border-red-200"
            >
              <FaSignOutAlt size={11} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">

        {/* TOP HEADER */}
        <header className="bg-white/95 backdrop-blur border-b border-ink-100 sticky top-0 z-40 shadow-sm">
          <div className="px-4 sm:px-6 h-16 lg:h-20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden h-10 w-10 rounded-xl bg-ink-100 hover:bg-ink-200 text-ink-700 flex items-center justify-center transition-colors"
                aria-label="Open menu"
              >
                <FaBars size={14} />
              </button>
              <div className="lg:hidden">
                <BrandTile />
              </div>
              <div className="hidden lg:block min-w-0">
                {title && <h1 className="font-display font-black text-ink-900 text-xl truncate tracking-tight">{title}</h1>}
                {subtitle && <p className="text-xs text-ink-500 font-medium truncate">{subtitle}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
              <div className="lg:hidden flex items-center gap-2">
                <NotificationsBell />
                <button
                  onClick={onRequestLogout}
                  className="h-10 w-10 rounded-full bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors"
                  aria-label="Sign out"
                >
                  <FaSignOutAlt size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile title row */}
          {(title || subtitle) && (
            <div className="lg:hidden px-4 pb-3">
              {title && <h1 className="font-display font-black text-ink-900 text-lg tracking-tight">{title}</h1>}
              {subtitle && <p className="text-xs text-ink-500 font-medium">{subtitle}</p>}
            </div>
          )}
        </header>

        {/* CONTENT */}
        <main className="flex-1 w-full bg-canvas">
          {children}
        </main>
      </div>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 36 }}
              className="fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[80vw] bg-white shadow-2xl flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
                <BrandTile />
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="h-9 w-9 rounded-full bg-ink-100 hover:bg-ink-200 text-ink-700 flex items-center justify-center transition-colors"
                  aria-label="Close menu"
                >
                  <FaTimes size={13} />
                </button>
              </div>

              <div className="px-5 py-4 bg-gradient-to-br from-teal-50 to-sky-50 border-b border-ink-100 flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center text-white text-base font-black flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2, #2563eb)' }}
                >
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold text-ink-900 truncate">{user?.name || '-'}</p>
                  <p className="text-2xs font-bold text-teal-700 uppercase tracking-widest">{roleLabel}</p>
                </div>
              </div>

              <SidebarNav onClick={() => setDrawerOpen(false)} />

              <div className="px-5 py-4 border-t border-ink-100 bg-ink-50">
                <button
                  onClick={() => { setDrawerOpen(false); onRequestLogout?.(); }}
                  className="btn btn-outline w-full text-red-600 border-red-200 hover:bg-red-50"
                >
                  <FaSignOutAlt size={11} /> Sign out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
