import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, usePropertyStore, useBookingStore } from '../store';
import apiClient from '../api/client';
import { clearTokens } from '../api/tokenStorage';
import toast from 'react-hot-toast';
import Sk from '../components/Skeleton';
import DataState from '../components/DataState';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import Navbar from '../components/Navbar';
import {
  FaMapMarkerAlt, FaStar, FaCalendarAlt, FaSearch,
  FaEdit, FaKey, FaTimes, FaSave, FaPrint,
  FaCompass, FaBookmark, FaUserCircle,
  FaShieldAlt, FaBolt, FaPhone, FaWhatsapp, FaCheckCircle,
  FaArrowRight, FaMapMarkedAlt,
  FaPercent, FaCreditCard, FaHeadset, FaEnvelope, FaClock,
} from 'react-icons/fa';

const HOTEL_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1542314831-c6a4d1409e1c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1501117716987-c8c394bb29df?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
];

const ADMIN_STATUS_LABELS = {
  new_booking: { label: 'Awaiting confirmation', cls: 'pill-amber' },
  confirmed: { label: 'Confirmed', cls: 'pill-teal' },
  verified: { label: 'Verified', cls: 'pill-teal' },
  password_set: { label: 'Ready to check-in', cls: 'pill-success' },
};

const STATUS_PILL = {
  confirmed: 'pill-success',
  pending: 'pill-amber',
  cancelled: 'pill-danger',
};

const ALL_TABS = ['explore', 'bookings', 'profile'];
const PUBLIC_TABS = ['explore'];
const TAB_LABELS = { explore: 'Explore', bookings: 'My Trips', profile: 'Profile' };
const TAB_ICONS = { explore: FaCompass, bookings: FaBookmark, profile: FaUserCircle };

const TRUST_BADGES = [
  { icon: FaShieldAlt, label: 'Verified stays', sub: 'Real rooms, real photos' },
  { icon: FaBolt, label: 'Instant booking', sub: 'Confirm in seconds' },
  { icon: FaKey, label: 'Room access code', sub: 'Shown in your account' },
  { icon: FaPhone, label: '24/7 reception', sub: 'Always here to help' },
];

function formatDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDefaultSelectedDates() {
  const checkIn = new Date();
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkIn.getDate() + 1);
  return {
    checkIn: formatDateInputValue(checkIn),
    checkOut: formatDateInputValue(checkOut),
  };
}

function nightsBetween(a, b) {
  if (!a || !b) return 1;
  const ms = new Date(b) - new Date(a);
  return Math.max(1, Math.round(ms / 86400000));
}

// Section reveal helper (in-view + stagger)
const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function Dashboard({ publicMode = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, logout, isAuthenticated } = useAuthStore();
  const { properties, setProperties } = usePropertyStore();
  const { bookings, setBookings } = useBookingStore();

  const [activeTab, setActiveTab] = useState('explore');
  const TABS = isAuthenticated ? ALL_TABS : PUBLIC_TABS;

  useEffect(() => {
    if (!TABS.includes(activeTab)) setActiveTab('explore');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Scroll to in-page sections (#deals, #help, #stays) when the URL hash
  // points at one - they all live in the explore tab, so switch there first.
  useEffect(() => {
    const hash = (location.hash || '').replace('#', '');
    if (!['deals', 'help', 'stays'].includes(hash)) return;
    setActiveTab('explore');
    const t = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(t);
  }, [location.hash, location.key]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDates, setSelectedDates] = useState(getDefaultSelectedDates);
  const today = formatDateInputValue(new Date());
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewBooking, setReviewBooking] = useState(null);
  const [submittedReviews, setSubmittedReviews] = useState(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const propsRes = await apiClient.get('/properties');
      setProperties(propsRes.data.data || []);
      if (!publicMode && isAuthenticated) {
        const bookingsRes = await apiClient.get('/bookings');
        setBookings(bookingsRes.data.data || []);
      }
    } catch (err) {
      setError(err);
      toast.error('Failed to load data');
    } finally { setLoading(false); }
  }, [setProperties, setBookings, publicMode, isAuthenticated]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cancelBooking = useCallback(async (booking) => {
    if (!window.confirm('Cancel this booking? If you paid online, a refund will be initiated.')) return;
    try {
      await apiClient.post(`/bookings/${booking.id}/cancel`, { reason: 'Cancelled by guest' });
      toast.success('Booking cancelled');
      const bookingsRes = await apiClient.get('/bookings');
      setBookings(bookingsRes.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel booking');
    }
  }, [setBookings]);

  const handleLogout = useCallback(() => {
    clearTokens();
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const startEditProfile = useCallback(() => {
    setProfileForm({
      name: user?.name || '',
      email: user?.email || '',
      address: user?.address || '',
      city: user?.city || '',
      state: user?.state || '',
      pincode: user?.pincode || '',
      gender: user?.gender || '',
      date_of_birth: user?.date_of_birth || '',
      nationality: user?.nationality || 'Indian',
      passport_number: user?.passport_number || '',
    });
    setEditingProfile(true);
  }, [user]);

  const handleSaveProfile = useCallback(async () => {
    setSavingProfile(true);
    try {
      const res = await apiClient.put('/auth/profile', profileForm);
      setUser({ ...user, ...res.data.user });
      toast.success('Profile updated.');
      setEditingProfile(false);
    } catch (err) { toast.error(err.response?.data?.error || 'Update failed'); }
    finally { setSavingProfile(false); }
  }, [profileForm, user, setUser]);

  const handlePropertyClick = useCallback((property) => {
    navigate(`/property/${property.id}`, { state: { selectedDates } });
  }, [navigate, selectedDates]);

  const scrollToStays = useCallback(() => {
    document.getElementById('stays')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const filteredProperties = useMemo(() => {
    let list = properties;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.state?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [properties, searchQuery]);

  const userInitial = useMemo(() => user?.name?.charAt(0).toUpperCase() || '?', [user?.name]);
  const nights = nightsBetween(selectedDates.checkIn, selectedDates.checkOut);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas pb-24 md:pb-0">
        <Navbar showTabs activeTab={activeTab} onTabChange={setActiveTab} onRequestLogout={() => setShowLogoutConfirm(true)} />
        <Sk className="h-[420px] sm:h-[480px] lg:h-[560px] rounded-none" />
        <div className="page-container py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <Sk className="aspect-[4/3] rounded-2xl mb-3" />
                <Sk className="h-4 w-3/4 mb-1.5" />
                <Sk className="h-3 w-1/2 mb-1.5" />
                <Sk className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-24 md:pb-0">
      <Navbar
        transparent={activeTab === 'explore'}
        showTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRequestLogout={() => setShowLogoutConfirm(true)}
      />

      {/* ============================================================
           EXPLORE TAB
         ============================================================ */}
      {activeTab === 'explore' && (
        <>
          {/* ── HERO ── */}
          <section className="relative -mt-16 sm:-mt-[72px] lg:-mt-20">
            {/* Solid brand header band (Booking.com-style) */}
            <div
              className="relative overflow-hidden pt-24 sm:pt-28 lg:pt-32 pb-28 sm:pb-32"
              style={{ background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 45%, #1d4ed8 100%)' }}
            >
              {/* Decorative blobs */}
              <div className="blob blob-teal w-72 h-72 -top-12 -left-16 opacity-25 animate-drift" />
              <div className="blob blob-sunset w-80 h-80 -bottom-10 -right-20 opacity-20 animate-drift" style={{ animationDelay: '4s' }} />

              <div className="relative z-10 page-wide">
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={reveal}
                  custom={0}
                  className="max-w-2xl"
                >
                  <span className="feature-pill mb-5">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-300 animate-pulse" />
                    Now booking in Koyilandy, Kerala
                  </span>
                </motion.div>

                <motion.h1
                  initial="hidden"
                  animate="visible"
                  variants={reveal}
                  custom={1}
                  className="text-white font-display font-black tracking-tighter max-w-3xl"
                  style={{ fontSize: 'clamp(2.5rem, 6.5vw, 5rem)', lineHeight: 1.02 }}
                >
                  Find a stay <br />
                  <span className="inline-flex items-baseline">
                    that feels like <em className="not-italic relative ml-3">
                      <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-cyan-200 to-sky-300">
                        home
                      </span>
                      <motion.svg
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 1.2, delay: 0.8, ease: 'easeInOut' }}
                        className="absolute -bottom-2 left-0 right-0 w-full"
                        viewBox="0 0 200 12"
                        fill="none"
                      >
                        <path
                          d="M2 9 Q 50 1, 100 5 T 198 4"
                          stroke="url(#hero-grad)"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                        <defs>
                          <linearGradient id="hero-grad" x1="0" x2="1">
                            <stop offset="0" stopColor="#22d3ee" />
                            <stop offset="1" stopColor="#0ea5e9" />
                          </linearGradient>
                        </defs>
                      </motion.svg>
                    </em>
                  </span>
                </motion.h1>

                <motion.p
                  initial="hidden"
                  animate="visible"
                  variants={reveal}
                  custom={2}
                  className="text-white/85 text-base sm:text-lg mt-5 max-w-xl font-medium"
                >
                  Hand-picked rooms with instant booking, a secure room access code in your account,
                  and no surprise fees. Real stays. Real people. Zero stress.
                </motion.p>

                {/* Trust strip */}
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={reveal}
                  custom={3}
                  className="flex items-center gap-4 sm:gap-6 mt-7 flex-wrap"
                >
                  {[
                    { val: '4.9', label: 'Guest rating', icon: FaStar },
                    { val: '24/7', label: 'Support', icon: FaPhone },
                    { val: 'Instant', label: 'Confirmation', icon: FaBolt },
                  ].map(({ val, label, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-2.5 text-white">
                      <div className="h-9 w-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
                        <Icon size={12} className="text-teal-300" />
                      </div>
                      <div>
                        <p className="font-display font-bold text-base leading-none num">{val}</p>
                        <p className="text-2xs text-white/70 mt-0.5 uppercase tracking-wider">{label}</p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* Search box overlapping the band seam (Booking.com-style) */}
            <div className="page-wide relative z-20 -mt-20 sm:-mt-24">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="search-widget max-w-5xl mx-auto"
              >
                <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr_auto] divide-y sm:divide-y-0 sm:divide-x divide-ink-100">
                  <label className="search-field group">
                    <span className="block text-3xs font-bold uppercase tracking-widest text-teal-600 mb-1">
                      Where
                    </span>
                    <div className="flex items-center gap-2">
                      <FaMapMarkerAlt className="text-teal-500" size={12} />
                      <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search city, area, or stay"
                        className="search-field-value placeholder-ink-400 focus:outline-none flex-1"
                      />
                    </div>
                  </label>

                  <label className="search-field">
                    <span className="block text-3xs font-bold uppercase tracking-widest text-teal-600 mb-1">
                      Check-in
                    </span>
                    <div className="flex items-center gap-2">
                      <FaCalendarAlt className="text-teal-500" size={11} />
                      <input
                        type="date"
                        value={selectedDates.checkIn}
                        min={today}
                        onChange={e => setSelectedDates(p => ({ ...p, checkIn: e.target.value }))}
                        className="search-field-value focus:outline-none num cursor-pointer flex-1"
                      />
                    </div>
                  </label>

                  <label className="search-field">
                    <span className="block text-3xs font-bold uppercase tracking-widest text-teal-600 mb-1">
                      Check-out · {nights} {nights === 1 ? 'night' : 'nights'}
                    </span>
                    <div className="flex items-center gap-2">
                      <FaCalendarAlt className="text-teal-500" size={11} />
                      <input
                        type="date"
                        value={selectedDates.checkOut}
                        min={selectedDates.checkIn || today}
                        onChange={e => setSelectedDates(p => ({ ...p, checkOut: e.target.value }))}
                        className="search-field-value focus:outline-none num cursor-pointer flex-1"
                      />
                    </div>
                  </label>

                  <div className="flex items-center p-3 sm:pr-3 sm:pl-2">
                    <motion.button
                      onClick={scrollToStays}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="btn btn-sunset w-full sm:w-auto px-7 sm:px-8 py-3.5 sm:py-4 text-sm rounded-2xl"
                    >
                      <FaSearch size={12} />
                      Search stays
                    </motion.button>
                  </div>
                </div>

                {/* Reassurance row */}
                <div className="border-t border-ink-100 px-4 py-3 flex items-center gap-3 text-xs text-ink-500">
                  <FaShieldAlt size={10} className="text-teal-500" />
                  <span>Real rooms, transparent pricing - no hidden fees.</span>
                </div>
              </motion.div>
            </div>
          </section>

          {/* ── DEALS / BOOK-DIRECT PERKS (Booking.com puts offers up top) ── */}
          <section id="deals" className="page-wide pt-10 sm:pt-14 pb-2 scroll-mt-24">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              variants={reveal}
              className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6"
            >
              <div>
                <span className="section-eyebrow">Book direct, save more</span>
                <h2 className="font-display font-bold text-ink-900 mt-2 tracking-tight">Deals &amp; direct-booking perks</h2>
                <p className="text-sm text-ink-500 mt-1 max-w-md">
                  Booking straight with Zero One is always the better deal - no middlemen, no surprises.
                </p>
              </div>
              <button onClick={scrollToStays} className="btn btn-primary self-start sm:self-auto">
                Browse stays <FaArrowRight size={10} />
              </button>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {[
                { icon: FaPercent, title: 'Best direct rate', desc: 'Book straight with us - no third-party commission added to your room price.' },
                { icon: FaCreditCard, title: 'Pay at property', desc: 'Reserve now and pay on arrival on rooms that offer it. No prepayment needed.' },
                { icon: FaBolt, title: 'Instant confirmation', desc: 'Your room is confirmed in seconds, with the access code waiting in your account.' },
                { icon: FaShieldAlt, title: 'No hidden fees', desc: 'The price you see is the price you pay - no convenience or service charges.' },
              ].map(({ icon: Icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="surface p-5 sm:p-6 hover:border-teal-200 transition-colors"
                >
                  <div className="h-11 w-11 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: 'linear-gradient(135deg, #ecfeff, #f0f9ff)', border: '1px solid #cffafe' }}>
                    <Icon className="text-teal-600" size={16} />
                  </div>
                  <h4 className="font-display font-bold text-ink-900 text-base mb-1.5">{title}</h4>
                  <p className="text-ink-500 text-sm leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── PROPERTIES GRID ── */}
          <section id="stays" className="page-wide py-6 sm:py-10 scroll-mt-24">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              variants={reveal}
              className="flex items-end justify-between mb-6 sm:mb-8 gap-4"
            >
              <div>
                <span className="section-eyebrow">Available now</span>
                <h2 className="font-display font-bold text-ink-900 mt-2 tracking-tight">
                  Stays you'll love
                </h2>
                <p className="text-sm text-ink-500 mt-1">
                  {filteredProperties.length} {filteredProperties.length === 1 ? 'property' : 'properties'} found
                  {selectedDates.checkIn && (
                    <> · {new Date(selectedDates.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {' → '}
                      {new Date(selectedDates.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </>
                  )}
                </p>
              </div>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="btn btn-outline text-xs">
                  Clear search
                </button>
              )}
            </motion.div>

            <DataState
              loading={loading}
              error={error}
              onRetry={fetchData}
              skeleton={
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i}>
                      <Sk className="aspect-[4/3] rounded-2xl mb-3" />
                      <Sk className="h-4 w-3/4 mb-2 rounded" />
                      <Sk className="h-3 w-1/2 rounded" />
                    </div>
                  ))}
                </div>
              }
            >
              {filteredProperties.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="surface text-center py-20 px-6 border-dashed"
                >
                  <div className="text-5xl mb-4">🌴</div>
                  <h3 className="font-display font-bold text-ink-900 mb-1">No stays found</h3>
                  <p className="text-ink-500 text-sm">Try adjusting your search or check back later.</p>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
                  {filteredProperties.map((property, index) => {
                    const image = property.images?.length ? property.images[0] : HOTEL_IMAGES[index % HOTEL_IMAGES.length];
                    const reviewCount = property.review_count || 0;
                    return (
                      <motion.article
                        key={property.id}
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-30px' }}
                        transition={{ duration: 0.5, delay: (index % 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                        whileHover={{ y: -6 }}
                        onClick={() => handlePropertyClick(property)}
                        className="property-card group"
                      >
                        <div className="relative overflow-hidden aspect-[4/3]">
                          <img
                            src={image}
                            alt={property.name}
                            loading="lazy"
                            className="property-card-img"
                            onError={e => { e.target.onerror = null; e.target.src = HOTEL_IMAGES[0]; }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-ink-900/65 via-transparent to-transparent" />

                          <div className="absolute top-3 left-3">
                            {reviewCount > 0 ? (
                              <div className="flex items-center gap-1 bg-white/95 backdrop-blur px-2 py-1 rounded-full shadow-sm">
                                <FaStar className="text-amber-400" size={9} />
                                <span className="text-2xs font-bold text-ink-900 num">{Number(property.rating).toFixed(1)}</span>
                                <span className="text-2xs text-ink-500 num">({reviewCount})</span>
                              </div>
                            ) : (
                              <div className="bg-white/95 backdrop-blur px-2 py-1 rounded-full shadow-sm text-2xs font-bold text-teal-700">
                                New
                              </div>
                            )}
                          </div>

                          <div className="absolute bottom-3 left-3 right-3 text-white">
                            <p className="text-3xs uppercase tracking-widest text-white/70 font-bold mb-0.5 flex items-center gap-1">
                              <FaMapMarkerAlt size={8} /> {property.city}, {property.state}
                            </p>
                            <h3 className="font-display font-bold text-base truncate">{property.name}</h3>
                          </div>
                        </div>

                        <div className="p-4">
                          <div className="flex items-center gap-2 text-2xs text-ink-500 mb-3">
                            <span className="pill pill-teal">
                              <FaBolt size={8} /> Instant book
                            </span>
                            <span className="text-ink-400">·</span>
                            <span className="font-semibold num">{property.total_rooms || 0} rooms</span>
                          </div>

                          <div className="flex items-end justify-between">
                            {property.starting_price ? (
                              <div className="price-tag">
                                <span className="currency">₹</span>
                                <span className="amount">{Number(property.starting_price).toLocaleString()}</span>
                                <span className="per">/night</span>
                              </div>
                            ) : (
                              <span className="text-sm font-bold text-ink-700">View rates</span>
                            )}
                            <span className="text-2xs font-bold text-teal-700 flex items-center gap-0.5 group-hover:gap-2 transition-all">
                              View <FaArrowRight size={9} />
                            </span>
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              )}
            </DataState>
          </section>

          {/* ── TRUST BADGES ── */}
          <section className="page-wide py-10 sm:py-14">
            <div className="surface-elev p-6 sm:p-8 lg:p-10 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-teal-100 opacity-60 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-sky-100 opacity-50 blur-3xl pointer-events-none" />

              <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {TRUST_BADGES.map((b, i) => {
                  const Icon = b.icon;
                  return (
                    <motion.div
                      key={b.label}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="flex items-start gap-3.5"
                    >
                      <div className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: 'linear-gradient(135deg, #ecfeff, #f0f9ff)',
                          border: '1px solid #cffafe',
                        }}>
                        <Icon className="text-teal-600" size={18} />
                      </div>
                      <div>
                        <p className="font-display font-bold text-ink-900 text-sm">{b.label}</p>
                        <p className="text-2xs text-ink-500 mt-0.5">{b.sub}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── HOW IT WORKS ── */}
          <section className="page-wide py-10 sm:py-16">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={reveal}
              className="text-center max-w-2xl mx-auto mb-10"
            >
              <span className="section-badge mb-3">How it works</span>
              <h2 className="font-display font-bold text-ink-900 tracking-tight">Booked & checked in - in under a minute</h2>
              <p className="text-ink-500 text-base mt-3">Three steps. No call centers. No paperwork. Just a beautiful room waiting for you.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 relative">
              {[
                { step: '01', title: 'Choose your stay', desc: 'Browse verified rooms with real photos, transparent pricing, and instant availability.', icon: '🔍', color: 'teal' },
                { step: '02', title: 'Secure with UPI/card', desc: 'Pay online, or pay at desk on arrival. Free cancellation up to 24 hours.', icon: '💳', color: 'sky' },
                { step: '03', title: 'Unlock & relax', desc: 'Your secure room access code appears in your account the moment your room is ready.', icon: '🔑', color: 'sunset' },
              ].map(({ step, title, desc, icon, color }, i) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="surface p-6 sm:p-7 relative overflow-hidden group hover:border-teal-200 transition-colors"
                >
                  <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-50 blur-2xl pointer-events-none transition-opacity group-hover:opacity-80`}
                    style={{
                      background: color === 'teal' ? '#cffafe' : color === 'sky' ? '#e0f2fe' : '#ffedd5',
                    }}
                  />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-5">
                      <span className="font-display font-black text-3xl text-transparent bg-clip-text bg-gradient-to-br from-teal-500 to-sky-500 num">
                        {step}
                      </span>
                      <span className="text-3xl">{icon}</span>
                    </div>
                    <h4 className="font-display font-bold text-ink-900 text-lg mb-2">{title}</h4>
                    <p className="text-ink-500 text-sm leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>


          {/* ── ABOUT / CTA ── */}
          <section className="page-wide py-10 sm:py-16">
            <div className="relative rounded-3xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-teal-900 to-ink-900" />
              <div className="absolute inset-0 opacity-30">
                <img src={HOTEL_IMAGES[3]} alt="" className="w-full h-full object-cover mix-blend-overlay" />
              </div>
              <div className="blob blob-teal w-80 h-80 -top-20 -left-20 opacity-40 animate-drift" />
              <div className="blob blob-sunset w-80 h-80 -bottom-20 -right-20 opacity-30 animate-drift" style={{ animationDelay: '6s' }} />

              <div className="relative px-6 sm:px-12 py-12 sm:py-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <motion.div
                  initial={{ opacity: 0, x: -24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <span className="feature-pill mb-4">
                    <FaMapMarkedAlt size={10} />
                    Koyilandy, Kerala
                  </span>
                  <h2 className="text-white font-display font-black tracking-tight mb-4"
                    style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}>
                    A new way to stay, <br />
                    <span className="text-gradient-teal">designed for travelers.</span>
                  </h2>
                  <p className="text-white/75 text-base leading-relaxed mb-6 max-w-md">
                    Nestled near Payattuvalappil Temple Road, Zero One blends thoughtful design with real hospitality.
                    Direct check-in, digital keys, and crystal-clear pricing.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a href="tel:07592905000" className="btn btn-primary">
                      <FaPhone size={11} /> 07592905000
                    </a>
                    <button onClick={scrollToStays} className="btn btn-outline text-white border-white/30 hover:bg-white/10 hover:border-white/50">
                      Browse stays <FaArrowRight size={10} />
                    </button>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.15 }}
                  className="hidden md:grid grid-cols-2 gap-3"
                >
                  {[HOTEL_IMAGES[1], HOTEL_IMAGES[5], HOTEL_IMAGES[3], HOTEL_IMAGES[7]].map((src, i) => (
                    <motion.div
                      key={src}
                      whileHover={{ scale: 1.04, rotate: i % 2 === 0 ? -1 : 1 }}
                      className={`relative rounded-2xl overflow-hidden aspect-[4/3] ${i % 2 === 0 ? 'mt-6' : ''}`}
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </div>
          </section>

          {/* ── HELP & SUPPORT ── */}
          <section id="help" className="page-wide py-10 sm:py-16 scroll-mt-24">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              variants={reveal}
              className="mb-8"
            >
              <span className="section-eyebrow">Help &amp; support</span>
              <h2 className="font-display font-bold text-ink-900 mt-2 tracking-tight">We're here to help</h2>
              <p className="text-sm text-ink-500 mt-1">Real people at reception, every day. Reach us any way you like.</p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6">
              {/* Contact card */}
              <div className="lg:col-span-2 surface-elev p-6 sm:p-7">
                <div className="space-y-4">
                  <a href="tel:07592905000" className="flex items-center gap-3 group">
                    <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                      <FaPhone className="text-teal-600" size={14} />
                    </div>
                    <div>
                      <p className="text-3xs text-ink-400 font-bold uppercase tracking-widest">Call reception</p>
                      <p className="text-sm font-bold text-ink-900 num group-hover:text-teal-700 transition-colors">07592905000</p>
                    </div>
                  </a>
                  <a href="https://wa.me/917592905000" className="flex items-center gap-3 group">
                    <div className="h-10 w-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
                      <FaWhatsapp className="text-green-600" size={15} />
                    </div>
                    <div>
                      <p className="text-3xs text-ink-400 font-bold uppercase tracking-widest">WhatsApp</p>
                      <p className="text-sm font-bold text-ink-900 num group-hover:text-green-600 transition-colors">+91 75929 05000</p>
                    </div>
                  </a>
                  <a href="mailto:zerooneresidency@gmail.com" className="flex items-center gap-3 group">
                    <div className="h-10 w-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center flex-shrink-0">
                      <FaEnvelope className="text-sky-600" size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-3xs text-ink-400 font-bold uppercase tracking-widest">Email</p>
                      <p className="text-sm font-bold text-ink-900 truncate group-hover:text-sky-700 transition-colors">zerooneresidency@gmail.com</p>
                    </div>
                  </a>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-ink-50 border border-ink-100 flex items-center justify-center flex-shrink-0">
                      <FaMapMarkerAlt className="text-ink-500" size={14} />
                    </div>
                    <div>
                      <p className="text-3xs text-ink-400 font-bold uppercase tracking-widest">Visit us</p>
                      <p className="text-sm font-semibold text-ink-800">Payattuvalappil Temple Road, Koyilandy, Kerala 673305</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                      <FaClock className="text-amber-500" size={14} />
                    </div>
                    <div>
                      <p className="text-3xs text-ink-400 font-bold uppercase tracking-widest">Timings</p>
                      <p className="text-sm font-semibold text-ink-800 num">Check-in 2:00 PM · Check-out 11:00 AM</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAQ */}
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { q: 'How do I check in?', a: 'Reception verifies a government photo ID and hands over your room access code. Your booking and code also appear in your account under My Trips.' },
                  { q: 'What ID do I need?', a: 'Any government photo ID - Aadhaar, passport, or driving licence. Foreign nationals should carry their passport and visa.' },
                  { q: 'Can I pay at the property?', a: 'Yes, on rooms with the pay-at-property option. Otherwise pay securely online via UPI, card, or netbanking.' },
                  { q: 'What about check-in & check-out times?', a: 'Check-in from 2:00 PM and check-out by 11:00 AM. Need a different time? Call us and we\'ll do our best to help.' },
                ].map(({ q, a }) => (
                  <div key={q} className="surface p-5">
                    <div className="flex items-start gap-2.5">
                      <FaHeadset className="text-teal-500 mt-0.5 flex-shrink-0" size={13} />
                      <div>
                        <p className="font-display font-bold text-ink-900 text-sm mb-1.5">{q}</p>
                        <p className="text-ink-500 text-sm leading-relaxed">{a}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── FOOTER ── */}
          <FooterBlock />
        </>
      )}

      {/* ============================================================
           BOOKINGS TAB
         ============================================================ */}
      {activeTab === 'bookings' && (
        <section className="page-container py-8 sm:py-12">
          <motion.div
            initial="hidden" animate="visible" variants={reveal}
            className="flex items-end justify-between mb-7 gap-3"
          >
            <div>
              <span className="section-eyebrow">Trips</span>
              <h2 className="font-display font-bold text-ink-900 tracking-tight mt-2">My bookings</h2>
              <p className="text-sm text-ink-500 mt-1">All your upcoming and past stays in one place.</p>
            </div>
            <span className="pill pill-ink num">{bookings.length} total</span>
          </motion.div>

          <DataState
            loading={loading}
            error={error}
            onRetry={fetchData}
            skeleton={
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => <Sk key={i} className="h-44 rounded-2xl" />)}
              </div>
            }
          >
            {bookings.length > 0 ? (
              <div className="space-y-4">
                {bookings.map((booking, i) => {
                  const adminStatus = ADMIN_STATUS_LABELS[booking.admin_status] || ADMIN_STATUS_LABELS['new_booking'];
                  return (
                    <motion.article
                      key={booking.id}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.4 }}
                      whileHover={{ y: -2 }}
                      onClick={() => setSelectedBooking(booking)}
                      className="surface lift p-5 sm:p-6 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-3xs font-mono text-ink-400 mb-1 tracking-widest">
                            #{booking.id?.slice(0, 8).toUpperCase()}
                          </p>
                          <h3 className="font-display font-bold text-ink-900 text-base sm:text-lg truncate">
                            {booking.property_name || 'Property'}
                          </h3>
                          <p className="text-sm text-ink-500 mt-0.5">
                            Room {booking.room_number || '-'} · {booking.room_type || ''}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className={`pill ${STATUS_PILL[booking.status] || 'pill-ink'} capitalize`}>
                            {booking.status}
                          </span>
                          {booking.status === 'confirmed' && (
                            <span className={`pill ${adminStatus.cls}`}>{adminStatus.label}</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 surface-soft rounded-xl p-4 mb-3">
                        {[
                          { label: 'Check-in', value: new Date(booking.check_in_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) },
                          { label: 'Check-out', value: new Date(booking.check_out_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) },
                          { label: 'Nights', value: booking.number_of_nights },
                          { label: 'Amount', value: `₹${(booking.final_price || booking.total_price || 0).toLocaleString()}` },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-3xs text-ink-400 font-bold uppercase tracking-widest mb-1">{label}</p>
                            <p className="text-sm font-bold text-ink-900 num">{value}</p>
                          </div>
                        ))}
                      </div>

                      {(booking.status === 'pending' || booking.status === 'confirmed')
                        && !booking.checked_in_at && !booking.checked_out_at && (
                        <div className="flex justify-end -mt-1 mb-2">
                          <button
                            onClick={e => { e.stopPropagation(); cancelBooking(booking); }}
                            className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                          >
                            Cancel booking
                          </button>
                        </div>
                      )}

                      {booking.admin_status === 'password_set' && booking.room_password && (
                        <motion.div
                          initial={{ scale: 0.96, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex items-center gap-3 bg-gradient-to-br from-teal-50 to-sky-50 border border-teal-200 rounded-xl px-4 py-3.5"
                        >
                          <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', boxShadow: '0 4px 14px -2px rgba(6,182,212,0.4)' }}>
                            <FaKey className="text-white" size={13} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-3xs text-teal-700 font-bold uppercase tracking-widest">Room password</p>
                            <p className="font-mono font-bold text-ink-900 text-xl tracking-[0.3em]">{booking.room_password}</p>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/booking/${booking.id}/document`); }}
                            className="p-2.5 bg-white rounded-lg text-teal-700 hover:text-teal-900 border border-teal-100 transition-colors shadow-sm"
                          >
                            <FaPrint size={13} />
                          </button>
                        </motion.div>
                      )}

                      {booking.status === 'confirmed' && booking.admin_status !== 'password_set' && (
                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/booking/${booking.id}/document`); }}
                            className="text-xs font-semibold text-ink-500 hover:text-teal-700 flex items-center gap-1.5 transition-colors"
                          >
                            <FaPrint size={10} /> Print confirmation
                          </button>
                          {!submittedReviews.has(booking.id) && (
                            <button
                              onClick={e => { e.stopPropagation(); setReviewBooking(booking); }}
                              className="text-xs font-semibold text-amber-500 hover:text-amber-600 flex items-center gap-1.5 transition-colors"
                            >
                              <FaStar size={10} /> Rate your stay
                            </button>
                          )}
                        </div>
                      )}
                    </motion.article>
                  );
                })}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="surface text-center py-20 px-6"
              >
                <div className="text-5xl mb-4">🧳</div>
                <h3 className="font-display font-bold text-ink-900 text-lg mb-1.5">No bookings yet</h3>
                <p className="text-ink-500 text-sm mb-6 max-w-sm mx-auto">Your upcoming and past stays will show up here. Ready for your next escape?</p>
                <button onClick={() => setActiveTab('explore')} className="btn btn-primary">
                  <FaCompass size={11} /> Explore stays
                </button>
              </motion.div>
            )}
          </DataState>
        </section>
      )}

      {/* ============================================================
           PROFILE TAB
         ============================================================ */}
      {activeTab === 'profile' && (
        <section className="page-narrow py-8 sm:py-12">
          <motion.div
            initial="hidden" animate="visible" variants={reveal}
            className="flex items-end justify-between mb-6 gap-3"
          >
            <div>
              <span className="section-eyebrow">Account</span>
              <h2 className="font-display font-bold text-ink-900 tracking-tight mt-2">Your profile</h2>
            </div>
            {!editingProfile ? (
              <button onClick={startEditProfile} className="btn btn-outline">
                <FaEdit size={11} /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleSaveProfile} disabled={savingProfile} className="btn btn-primary">
                  <FaSave size={11} /> {savingProfile ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditingProfile(false)} className="btn btn-outline">
                  Cancel
                </button>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="surface-elev overflow-hidden"
          >
            <div className="h-28 sm:h-32 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 40%, #2563eb 100%)' }}>
              <div className="blob w-40 h-40 -top-6 -right-6 bg-white/30 blur-3xl" />
              <div className="blob w-32 h-32 bottom-0 left-1/3 bg-cyan-300/40 blur-2xl" />
            </div>

            <div className="px-5 sm:px-7 pb-7">
              <motion.div
                whileHover={{ scale: 1.05, rotate: -3 }}
                className="h-20 w-20 rounded-2xl bg-white flex items-center justify-center text-2xl font-display font-black -mt-10 mb-5 shadow-lg border-4 border-white"
                style={{
                  background: 'linear-gradient(135deg, #06b6d4, #0891b2, #2563eb)',
                  color: 'white',
                }}
              >
                {userInitial}
              </motion.div>

              {!editingProfile ? (
                <>
                  <div className="mb-6">
                    <h3 className="font-display font-bold text-ink-900 text-2xl">{user?.name}</h3>
                    <p className="text-ink-500 text-sm num mt-1">+91 {user?.phone}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                    {[
                      { label: 'Email', value: user?.email },
                      { label: 'Gender', value: user?.gender || '-' },
                      { label: 'Date of birth', value: user?.date_of_birth || '-' },
                      { label: 'Nationality', value: user?.nationality || 'Indian' },
                      { label: 'City', value: user?.city || '-' },
                      { label: 'State', value: user?.state || '-' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-3xs text-ink-400 font-bold uppercase tracking-widest mb-1">{label}</p>
                        <p className="text-sm font-semibold text-ink-900 break-words">{value || '-'}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-7 flex items-start gap-3 px-4 py-3.5 rounded-xl border border-amber-200 bg-amber-50">
                    <FaCheckCircle className="text-amber-500 mt-0.5 flex-shrink-0" size={14} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-ink-900">Bring an ID</p>
                      <p className="text-2xs text-ink-600 mt-0.5">
                        Reception verifies a government photo ID at check-in. Aadhaar, passport, and driving license all work.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Full name', key: 'name', type: 'text' },
                    { label: 'Email', key: 'email', type: 'email' },
                    { label: 'City', key: 'city', type: 'text' },
                    { label: 'State', key: 'state', type: 'text' },
                    { label: 'Pincode', key: 'pincode', type: 'text' },
                    { label: 'Date of birth', key: 'date_of_birth', type: 'date' },
                    { label: 'Nationality', key: 'nationality', type: 'text' },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">{label}</label>
                      <input
                        type={type} value={profileForm[key] || ''}
                        onChange={e => setProfileForm(p => ({ ...p, [key]: e.target.value }))}
                        className="input-base"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Gender</label>
                    <select
                      value={profileForm.gender || ''}
                      onChange={e => setProfileForm(p => ({ ...p, gender: e.target.value }))}
                      className="input-base"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {(profileForm.nationality || '').trim() &&
                    !['india', 'indian'].includes((profileForm.nationality || '').trim().toLowerCase()) && (
                      <div className="sm:col-span-2 border border-amber-200 bg-amber-50 rounded-xl p-4">
                        <label className="block text-3xs font-bold text-amber-700 mb-1.5 uppercase tracking-widest">
                          Passport number (foreign nationals)
                        </label>
                        <input
                          type="text"
                          value={profileForm.passport_number || ''}
                          onChange={e => setProfileForm(p => ({ ...p, passport_number: e.target.value }))}
                          placeholder="Required for FRRO Form-C at check-in"
                          className="input-base"
                        />
                      </div>
                    )}
                  <div className="sm:col-span-2">
                    <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Address</label>
                    <input
                      type="text" value={profileForm.address || ''}
                      onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))}
                      className="input-base"
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          <FooterBlock />
        </section>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      <div className="md:hidden bottom-nav">
        <div className="flex">
          {TABS.map(t => {
            const Icon = TAB_ICONS[t];
            const active = activeTab === t;
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`bottom-nav-item ${active ? 'active' : ''}`}
              >
                <motion.div
                  animate={{ scale: active ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                >
                  <Icon size={active ? 19 : 17} />
                </motion.div>
                <span className="text-3xs font-semibold mt-0.5">{TAB_LABELS[t]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedBooking && (
          <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
        )}
        {reviewBooking && (
          <ReviewModal
            booking={reviewBooking}
            onClose={() => setReviewBooking(null)}
            onSubmitted={() => { setSubmittedReviews(p => new Set([...p, reviewBooking.id])); setReviewBooking(null); }}
          />
        )}
      </AnimatePresence>

      <LogoutConfirmModal
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        message="You'll need to sign in again to view your bookings."
      />

      {publicMode && !isAuthenticated && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ delay: 1.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-0 left-0 right-0 py-3 sm:py-4 px-4 sm:px-6 flex items-center justify-between z-40 safe-area-bottom"
          style={{
            background: 'linear-gradient(135deg, #0b1220 0%, #18243a 100%)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 -8px 32px -8px rgba(15, 23, 42, 0.35)',
          }}
        >
          <div className="min-w-0 flex-1 mr-3">
            <p className="text-sm font-bold text-white truncate">Book your stay instantly</p>
            <p className="text-xs text-white/60 truncate">Sign in with your phone - no passwords needed.</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/login')}
            className="btn btn-primary text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
          >
            Sign in
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}

/* ============================================================
   Footer
   ============================================================ */
function FooterBlock() {
  return (
    <footer className="border-t border-ink-100 bg-white mt-16">
      <div className="page-wide py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center font-display font-black text-white text-lg"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2, #2563eb)' }}
            >
              0<span className="text-[8px] -ml-0.5 self-end mb-1.5">1</span>
            </div>
            <span className="wordmark text-xl">Zero One<span className="wordmark-dot">.</span></span>
          </div>
          <p className="text-sm text-ink-500 max-w-sm leading-relaxed mb-5">
            Hand-picked stays in Koyilandy, Kerala. Instant booking, digital keys, and zero hidden fees.
          </p>
          <div className="flex items-center gap-3">
            <a href="tel:07592905000" className="h-9 w-9 rounded-full bg-ink-100 hover:bg-teal-100 text-ink-700 hover:text-teal-700 flex items-center justify-center transition-colors">
              <FaPhone size={12} />
            </a>
            <a href="https://wa.me/917592905000" className="h-9 w-9 rounded-full bg-ink-100 hover:bg-green-100 text-ink-700 hover:text-green-600 flex items-center justify-center transition-colors">
              <FaWhatsapp size={13} />
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-display font-bold text-ink-900 text-sm mb-3">Company</h4>
          <ul className="space-y-2 text-sm text-ink-500">
            <li><a href="/properties" className="hover:text-teal-700 transition-colors">Browse stays</a></li>
            <li><a href="/properties#deals" className="hover:text-teal-700 transition-colors">Deals</a></li>
            <li><a href="/properties#help" className="hover:text-teal-700 transition-colors">Help center</a></li>
            <li><a href="mailto:zerooneresidency@gmail.com" className="hover:text-teal-700 transition-colors">Support</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-bold text-ink-900 text-sm mb-3">Legal</h4>
          <ul className="space-y-2 text-sm text-ink-500">
            <li><a href="/privacy" className="hover:text-teal-700 transition-colors">Privacy policy</a></li>
            <li><a href="/privacy" className="hover:text-teal-700 transition-colors">Terms of service</a></li>
            <li><a href="/privacy" className="hover:text-teal-700 transition-colors">Cancellation</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-ink-100">
        <div className="page-wide py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-500">
          <p>© {new Date().getFullYear()} Zero One Hotels · All rights reserved</p>
          <p>Crafted with ♥ by Encrypt Bytes Labs</p>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   Booking detail modal
   ============================================================ */
function BookingDetailModal({ booking, onClose }) {
  const adminStatus = ADMIN_STATUS_LABELS[booking.admin_status] || ADMIN_STATUS_LABELS['new_booking'];
  const coguests = booking.coguests || [];
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="modal-backdrop" onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="modal-content sm:max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="h-1 w-10 bg-ink-200 rounded-full" /></div>
        <div className="sticky top-0 bg-white border-b border-ink-100 px-5 sm:px-6 py-4 flex justify-between items-center z-10">
          <div>
            <p className="text-3xs font-mono text-ink-400 tracking-widest">#{booking.id?.slice(0, 8).toUpperCase()}</p>
            <h2 className="font-display font-bold text-ink-900 text-lg mt-0.5">Booking details</h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-700 transition-colors">
            <FaTimes size={11} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex gap-2 flex-wrap">
            <span className={`pill ${STATUS_PILL[booking.status] || 'pill-ink'} capitalize`}>{booking.status}</span>
            <span className={`pill ${adminStatus.cls}`}>{adminStatus.label}</span>
            {booking.payment_method === 'pay_at_property' && (
              <span className="pill pill-ink">Pay at property</span>
            )}
          </div>

          {booking.status === 'pending' && booking.payment_method === 'pay_at_property' && (
            <div className="surface-soft p-4 border-l-4 border-amber-400 rounded-r-xl">
              <p className="text-sm font-bold text-ink-900">Booking received</p>
              <p className="text-xs text-ink-600 mt-0.5">
                Your room is held. Pay at the property — your booking is confirmed once
                the property collects payment.
              </p>
            </div>
          )}

          {booking.admin_status === 'password_set' && booking.room_password && (
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-2xl p-6 text-center relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #2563eb 100%)' }}
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/15 rounded-full blur-2xl" />
              <p className="relative text-teal-100 text-3xs font-bold tracking-widest uppercase mb-3">Room password</p>
              <p className="relative font-mono font-black text-white text-4xl sm:text-5xl tracking-[0.35em]">{booking.room_password}</p>
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-4 surface-soft p-4">
            {[
              { l: 'Property', v: booking.property_name || 'Zero One' },
              { l: 'Room', v: `Room ${booking.room_number} · ${booking.room_type}` },
              { l: 'Check-in', v: new Date(booking.check_in_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) },
              { l: 'Check-out', v: new Date(booking.check_out_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) },
            ].map(({ l, v }) => (
              <div key={l}>
                <p className="text-3xs text-ink-400 font-bold uppercase tracking-widest mb-1">{l}</p>
                <p className="text-sm font-bold text-ink-900 leading-snug num">{v}</p>
              </div>
            ))}
          </div>

          <div className="surface-soft p-4">
            <p className="text-3xs text-ink-400 font-bold uppercase tracking-widest mb-3">Payment</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-ink-500"><span>Base price</span><span className="num">₹{(booking.total_price || 0).toLocaleString()}</span></div>
              {booking.coupon_code && <div className="flex justify-between text-teal-700 font-medium"><span>Coupon ({booking.coupon_code})</span><span className="num">−₹{(booking.discount_amount || 0).toLocaleString()}</span></div>}
              <div className="flex justify-between font-display font-bold text-ink-900 border-t border-ink-200 pt-3 mt-3 text-base">
                <span>Total</span><span className="text-teal-700 num">₹{(booking.final_price || booking.total_price || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {coguests.length > 0 && (
            <div>
              <p className="text-3xs text-ink-400 font-bold uppercase tracking-widest mb-3">Additional guests</p>
              <div className="space-y-2">
                {coguests.map((g, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-0">
                    <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-sm font-bold">
                      {(g.name || 'G').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{g.name}</p>
                      <p className="text-xs text-ink-500">{[g.phone, g.relationship].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {booking.special_requests && (
            <div className="surface-soft p-4">
              <p className="text-3xs text-ink-400 font-bold uppercase tracking-widest mb-1">Special requests</p>
              <p className="text-sm text-ink-700">{booking.special_requests}</p>
            </div>
          )}

          {booking.status === 'confirmed' && (
            <button
              onClick={() => window.open(`/booking/${booking.id}/document`, '_blank')}
              className="btn btn-ink w-full py-3.5"
            >
              <FaPrint size={13} /> Print confirmation
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============================================================
   Star picker + review modal
   ============================================================ */
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = React.useState(0);
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <motion.button
          key={n}
          type="button"
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
        >
          <FaStar size={32} className={`${(hovered || value) >= n ? 'text-amber-400' : 'text-ink-200'} transition-colors`} />
        </motion.button>
      ))}
    </div>
  );
}

const SUB_RATINGS = [
  { key: 'cleanliness_rating', label: 'Cleanliness' },
  { key: 'comfort_rating', label: 'Comfort' },
  { key: 'value_rating', label: 'Value' },
  { key: 'service_rating', label: 'Service' },
  { key: 'amenities_rating', label: 'Amenities' },
];

function ReviewModal({ booking, onClose, onSubmitted }) {
  const [ratings, setRatings] = React.useState({ rating: 0, cleanliness_rating: 0, comfort_rating: 0, value_rating: 0, service_rating: 0, amenities_rating: 0 });
  const [comment, setComment] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    if (!ratings.rating) { toast.error('Please give an overall rating'); return; }
    setSubmitting(true);
    try {
      await apiClient.post(`/bookings/${booking.id}/review`, {
        ...ratings,
        comment: comment.trim() || undefined,
      });
      toast.success('Review submitted - thank you.');
      onSubmitted();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="modal-backdrop" onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="modal-content sm:max-w-md" onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="h-1 w-10 bg-ink-200 rounded-full" /></div>
        <div className="sticky top-0 bg-white border-b border-ink-100 px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="font-display font-bold text-ink-900 text-lg">Rate your stay</h2>
            <p className="text-xs text-ink-500 mt-0.5 truncate">{booking.property_name || 'Your booking'}</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-700 transition-colors">
            <FaTimes size={11} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-sm font-semibold text-ink-700 mb-4">Overall experience *</p>
            <div className="flex justify-center">
              <StarPicker value={ratings.rating} onChange={v => setRatings(p => ({ ...p, rating: v }))} />
            </div>
            {ratings.rating > 0 && (
              <motion.p
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-base font-bold text-amber-500 mt-3"
              >
                {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][ratings.rating]}
              </motion.p>
            )}
          </div>

          <div className="space-y-3">
            {SUB_RATINGS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink-600 w-24">{label}</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <motion.button
                      key={n}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={() => setRatings(p => ({ ...p, [key]: n }))}
                    >
                      <FaStar size={18} className={`${ratings[key] >= n ? 'text-amber-400' : 'text-ink-200'} transition-colors`} />
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Your comments (optional)</label>
            <textarea
              value={comment} onChange={e => setComment(e.target.value)} rows={4}
              placeholder="Tell other guests what you loved about this stay…"
              className="input-base resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn btn-outline flex-1">Cancel</button>
          <button onClick={submit} disabled={submitting || !ratings.rating} className="btn btn-primary flex-1">
            {submitting && <span className="spinner" />}
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
