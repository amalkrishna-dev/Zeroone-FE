import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useAuthStore } from '../store';
import apiClient from '../api/client';
import toast from 'react-hot-toast';
import Sk from '../components/Skeleton';
import LoginPromptModal from '../components/LoginPromptModal';
import Navbar from '../components/Navbar';
import {
  FaArrowLeft, FaCheck, FaUser, FaStar, FaMapMarkerAlt,
  FaPlus, FaTrash, FaTimes, FaCheckCircle, FaWifi,
  FaParking, FaSwimmingPool, FaUtensils, FaCoffee, FaDumbbell,
  FaConciergeBell, FaSpa, FaClock, FaPhoneAlt, FaHeart, FaRegHeart,
  FaShare, FaShieldAlt, FaImages, FaChevronLeft, FaChevronRight,
  FaBolt, FaCalendarAlt, FaUsers, FaArrowRight, FaTag, FaQuoteLeft,
  FaMedal, FaSnowflake, FaTv, FaBed,
} from 'react-icons/fa';

const HOTEL_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1542314831-c6a4d1409e1c?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1400&q=80',
];
const ROOM_IMAGES = [
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
];

const AMENITY_ICONS = {
  wifi: FaWifi, parking: FaParking, pool: FaSwimmingPool, restaurant: FaUtensils,
  breakfast: FaCoffee, gym: FaDumbbell, spa: FaSpa, concierge: FaConciergeBell,
  ac: FaSnowflake, tv: FaTv, bed: FaBed,
};

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  }),
};

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
  return { checkIn: formatDateInputValue(checkIn), checkOut: formatDateInputValue(checkOut) };
}
function getInitialSelectedDates(selectedDates) {
  return selectedDates?.checkIn && selectedDates?.checkOut ? selectedDates : getDefaultSelectedDates();
}

export default function PropertyDetails() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();

  const [property, setProperty] = useState(null);
  const [selectedDates, setSelectedDates] = useState(() => getInitialSelectedDates(location.state?.selectedDates));
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [bookingScope, setBookingScope] = useState('room');
  const [scopeRooms, setScopeRooms] = useState([]);
  const [scopeFloorName, setScopeFloorName] = useState('');
  const [customSelectedIds, setCustomSelectedIds] = useState([]);
  const [wished, setWished] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState({ open: false, action: 'continue' });

  const fetchPropertyDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/properties/${propertyId}`);
      setProperty(res.data.data);
    } catch { toast.error('Failed to load property'); navigate('/properties'); }
    finally { setLoading(false); }
  }, [propertyId, navigate]);

  const checkAvailability = useCallback(async () => {
    try {
      const res = await apiClient.post(`/properties/${propertyId}/rooms/availability`, {
        check_in_date: selectedDates.checkIn,
        check_out_date: selectedDates.checkOut,
      });
      setAvailableRooms(res.data.data);
    } catch { toast.error('Failed to check availability'); }
  }, [propertyId, selectedDates.checkIn, selectedDates.checkOut]);

  useEffect(() => { fetchPropertyDetails(); }, [fetchPropertyDetails]);
  useEffect(() => {
    if (!propertyId) return;
    setReviewsLoading(true);
    apiClient.get(`/properties/${propertyId}/reviews`)
      .then(r => setReviews(r.data.data || []))
      .catch(() => { })
      .finally(() => setReviewsLoading(false));
  }, [propertyId]);
  useEffect(() => { if (selectedDates.checkIn && selectedDates.checkOut) checkAvailability(); }, [selectedDates.checkIn, selectedDates.checkOut, checkAvailability]);
  useEffect(() => { setBookingScope('room'); }, [selectedDates.checkIn, selectedDates.checkOut]);

  const guardBook = useCallback(() => {
    if (!isAuthenticated) { setLoginPrompt({ open: true, action: 'book this stay' }); return false; }
    return true;
  }, [isAuthenticated]);

  const handleWishToggle = useCallback(() => {
    if (!isAuthenticated) { setLoginPrompt({ open: true, action: 'save this stay' }); return; }
    setWished(w => !w);
  }, [isAuthenticated]);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({ title: property?.name, url: window.location.href }).catch(() => { });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  }, [property]);

  const handleBookRoom = useCallback((room) => {
    if (!selectedDates.checkIn || !selectedDates.checkOut) { toast.error('Select dates first'); return; }
    if (!guardBook()) return;
    setSelectedRoom(room); setScopeRooms([room]); setScopeFloorName(''); setBookingScope('room'); setShowCheckout(true);
  }, [selectedDates, guardBook]);

  const handleBookFloor = useCallback((floorName, floorRooms) => {
    if (!selectedDates.checkIn || !selectedDates.checkOut) { toast.error('Select dates first'); return; }
    if (!guardBook()) return;
    setScopeRooms(floorRooms); setScopeFloorName(floorName); setBookingScope('floor'); setSelectedRoom(floorRooms[0]); setShowCheckout(true);
  }, [selectedDates, guardBook]);

  const handleBookProperty = useCallback(() => {
    if (!selectedDates.checkIn || !selectedDates.checkOut) { toast.error('Select dates first'); return; }
    const available = availableRooms.filter(r => r.is_available);
    if (available.length === 0) { toast.error('No available rooms'); return; }
    if (!guardBook()) return;
    setScopeRooms(available); setScopeFloorName(''); setBookingScope('property'); setSelectedRoom(available[0]); setShowCheckout(true);
  }, [selectedDates, availableRooms, guardBook]);

  const handleBookCustom = useCallback(() => {
    if (!selectedDates.checkIn || !selectedDates.checkOut) { toast.error('Select dates first'); return; }
    const selected = availableRooms.filter(r => r.is_available && customSelectedIds.includes(r.id));
    if (selected.length === 0) { toast.error('Select at least one room'); return; }
    if (!guardBook()) return;
    setScopeRooms(selected); setScopeFloorName(''); setBookingScope('custom'); setSelectedRoom(selected[0]); setShowCheckout(true);
  }, [selectedDates, availableRooms, customSelectedIds, guardBook]);

  const toggleCustomRoom = useCallback((roomId) => {
    setCustomSelectedIds(prev => prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]);
  }, []);

  const allImages = useMemo(() => {
    const imgs = property?.images?.length ? [...property.images] : [];
    while (imgs.length < 5) imgs.push(HOTEL_IMAGES[imgs.length % HOTEL_IMAGES.length]);
    return imgs;
  }, [property?.images]);

  const availableOnly = useMemo(() => availableRooms.filter(r => r.is_available), [availableRooms]);
  const floorGroups = useMemo(() =>
    availableOnly.reduce((acc, room) => {
      const fl = room.floor || 'Ground Floor';
      if (!acc[fl]) acc[fl] = [];
      acc[fl].push(room);
      return acc;
    }, {}), [availableOnly]);

  const rawNights = useMemo(() =>
    selectedDates.checkIn && selectedDates.checkOut
      ? Math.ceil((new Date(selectedDates.checkOut) - new Date(selectedDates.checkIn)) / 86400000)
      : 1, [selectedDates]);
  const isSameDay = rawNights === 0;
  const nights = Math.max(1, rawNights);
  const showScopeTabs = !!(selectedDates.checkIn && selectedDates.checkOut);

  const startingPrice = useMemo(() => {
    if (!availableOnly.length) return property?.starting_price || 0;
    return Math.min(...availableOnly.map(r => r.price_per_night || Infinity));
  }, [availableOnly, property]);

  const avgRating = useMemo(() => {
    if (!reviews.length) return null;
    return (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
  }, [reviews]);

  if (loading || !property) {
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar />
        <div className="page-wide pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 sm:grid-rows-2 gap-2 h-[320px] sm:h-[460px]">
            <Sk className="sm:col-span-2 sm:row-span-2 rounded-2xl" />
            <Sk className="hidden sm:block rounded-2xl" />
            <Sk className="hidden sm:block rounded-2xl" />
            <Sk className="hidden sm:block rounded-2xl" />
            <Sk className="hidden sm:block rounded-2xl" />
          </div>
        </div>
        <div className="page-wide py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-5">
            <Sk className="h-10 w-3/4" />
            <Sk className="h-5 w-1/2" />
            <Sk className="h-px" />
            <Sk className="h-32" />
          </div>
          <Sk className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  const today = formatDateInputValue(new Date());

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar onRequestLogout={() => { /* not used here */ }} />

      {/* ── BREADCRUMB / BACK STRIP ── */}
      <div className="page-wide pt-4 sm:pt-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 hover:text-teal-700 transition-colors"
          >
            <FaArrowLeft size={11} /> Back to stays
          </button>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={handleShare}
              className="h-10 w-10 rounded-full bg-white border border-ink-100 hover:border-teal-300 text-ink-700 hover:text-teal-700 flex items-center justify-center transition-colors shadow-sm"
              title="Share"
            >
              <FaShare size={12} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={handleWishToggle}
              aria-label={wished ? 'Remove from saved' : 'Save stay'}
              className="h-10 w-10 rounded-full bg-white border border-ink-100 hover:border-sunset-300 flex items-center justify-center transition-colors shadow-sm"
            >
              {wished
                ? <FaHeart className="text-sunset-500" size={13} />
                : <FaRegHeart className="text-ink-500" size={13} />}
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── IMAGE GALLERY ── */}
      <section className="page-wide pt-4">
        <motion.div
          initial="hidden" animate="visible" variants={reveal}
          className="grid grid-cols-1 sm:grid-cols-4 sm:grid-rows-2 gap-2 h-[320px] sm:h-[460px] lg:h-[520px] relative"
        >
          {/* Hero image */}
          <motion.button
            whileHover={{ scale: 0.995 }}
            onClick={() => { setGalleryIndex(0); setGalleryOpen(true); }}
            className="sm:col-span-2 sm:row-span-2 relative rounded-2xl overflow-hidden cursor-pointer group bg-ink-100"
          >
            <img
              src={allImages[0]}
              alt={property.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              onError={e => { e.target.onerror = null; e.target.src = HOTEL_IMAGES[0]; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900/30 to-transparent" />
          </motion.button>

          {/* Side images */}
          {allImages.slice(1, 5).map((img, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.08 + i * 0.05, duration: 0.4 }}
              whileHover={{ scale: 0.99 }}
              onClick={() => { setGalleryIndex(i + 1); setGalleryOpen(true); }}
              className="hidden sm:block relative rounded-2xl overflow-hidden cursor-pointer group bg-ink-100"
            >
              <img
                src={img}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                onError={e => { e.target.onerror = null; e.target.src = HOTEL_IMAGES[i % HOTEL_IMAGES.length]; }}
              />
            </motion.button>
          ))}

          {/* "Show all photos" button */}
          <button
            onClick={() => { setGalleryIndex(0); setGalleryOpen(true); }}
            className="absolute bottom-3 right-3 bg-white/95 backdrop-blur border border-ink-100 hover:border-teal-400 rounded-full px-4 py-2 text-xs font-bold text-ink-900 flex items-center gap-1.5 shadow-md transition-all hover:scale-105"
          >
            <FaImages size={11} /> Show all photos
          </button>
        </motion.div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <div className="page-wide py-8 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px] gap-8 lg:gap-10">

          {/* LEFT: Property details */}
          <div className="space-y-8 sm:space-y-10 min-w-0">
            {/* Title block */}
            <motion.div
              initial="hidden" animate="visible" variants={reveal}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {property.is_featured && (
                  <span className="pill pill-sunset">
                    <FaMedal size={9} /> Featured stay
                  </span>
                )}
                <span className="pill pill-teal">
                  <FaBolt size={9} /> Instant book
                </span>
                {avgRating && (
                  <span className="pill pill-amber">
                    <FaStar size={9} /> {avgRating}
                  </span>
                )}
              </div>

              <h1 className="font-display font-black tracking-tighter text-ink-900 mb-3">
                {property.name}
              </h1>

              <div className="flex items-start gap-4 flex-wrap text-sm text-ink-600">
                {avgRating && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 bg-gradient-to-br from-teal-500 to-sky-600 text-white px-2.5 py-1 rounded-lg shadow-sm">
                      <FaStar size={9} className="text-amber-300" />
                      <span className="font-bold text-xs num">{avgRating}</span>
                    </div>
                    <span className="font-semibold text-ink-900">
                      {reviews.length >= 50 ? 'Excellent' : reviews.length >= 20 ? 'Very good' : 'Highly rated'}
                    </span>
                    <span className="text-ink-500">· {reviews.length} reviews</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <FaMapMarkerAlt className="text-teal-500" size={11} />
                  <span>{[property.city, property.state].filter(Boolean).join(', ')}</span>
                </div>
              </div>
            </motion.div>

            {/* Quick info pills */}
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={reveal}
              className="flex flex-wrap gap-2"
            >
              {property.check_in_time && (
                <span className="pill pill-ink">
                  <FaClock size={9} /> Check-in <span className="num font-bold ml-1">{property.check_in_time}</span>
                </span>
              )}
              {property.check_out_time && (
                <span className="pill pill-ink">
                  <FaClock size={9} /> Check-out <span className="num font-bold ml-1">{property.check_out_time}</span>
                </span>
              )}
              {property.phone && (
                <a href={`tel:${property.phone}`} className="pill pill-teal hover:bg-teal-100 transition-colors">
                  <FaPhoneAlt size={9} /> <span className="num">{property.phone}</span>
                </a>
              )}
            </motion.div>

            {/* About section */}
            {property.description && (
              <motion.section
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={reveal}
              >
                <span className="section-eyebrow">About</span>
                <h2 className="font-display font-bold text-ink-900 mt-2 mb-4">About this property</h2>
                <p className="text-ink-700 text-base leading-relaxed">{property.description}</p>
              </motion.section>
            )}

            {/* Amenities */}
            {property.amenities?.length > 0 && (
              <motion.section
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={reveal}
              >
                <span className="section-eyebrow">What's included</span>
                <h2 className="font-display font-bold text-ink-900 mt-2 mb-5">Amenities & features</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {property.amenities.map((am, i) => {
                    const key = am.toLowerCase();
                    const IconComp = Object.entries(AMENITY_ICONS).find(([k]) => key.includes(k))?.[1] || FaCheck;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.03, duration: 0.35 }}
                        className="flex items-center gap-3 surface p-3.5 hover:border-teal-300 hover:shadow-md transition-all group"
                      >
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:scale-110"
                          style={{
                            background: 'linear-gradient(135deg, #ecfeff, #f0f9ff)',
                            border: '1px solid #cffafe',
                          }}>
                          <IconComp size={14} className="text-teal-600" />
                        </div>
                        <span className="text-sm font-semibold text-ink-800 capitalize">{am}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.section>
            )}

            {/* Available rooms (mobile + tablet - desktop shows them in sticky widget) */}
            <motion.section
              id="rooms"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={reveal}
              className="lg:hidden scroll-mt-24"
            >
              <span className="section-eyebrow">Choose a room</span>
              <h2 className="font-display font-bold text-ink-900 mt-2 mb-5">Available rooms</h2>
              <RoomSection
                inline
                selectedDates={selectedDates} availableRooms={availableRooms}
                bookingScope={bookingScope} setBookingScope={setBookingScope}
                showScopeTabs={showScopeTabs} property={property} nights={nights}
                isSameDay={isSameDay} floorGroups={floorGroups} availableOnly={availableOnly}
                handleBookRoom={handleBookRoom} handleBookFloor={handleBookFloor}
                handleBookProperty={handleBookProperty} handleBookCustom={handleBookCustom}
                toggleCustomRoom={toggleCustomRoom} customSelectedIds={customSelectedIds}
              />
            </motion.section>

            {/* Reviews */}
            <motion.section
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={reveal}
            >
              <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
                <div>
                  <span className="section-eyebrow">Reviews</span>
                  <h2 className="font-display font-bold text-ink-900 mt-2">What guests are saying</h2>
                </div>
                {avgRating && (
                  <div className="flex items-center gap-3 bg-white border border-ink-100 rounded-2xl px-4 py-3 shadow-sm">
                    <div className="text-center">
                      <p className="font-display font-black text-2xl text-ink-900 num leading-none">{avgRating}</p>
                      <div className="flex items-center justify-center gap-0.5 mt-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <FaStar key={n} size={9} className={Math.round(parseFloat(avgRating)) >= n ? 'text-amber-400' : 'text-ink-200'} />
                        ))}
                      </div>
                    </div>
                    <div className="border-l border-ink-100 pl-3">
                      <p className="font-bold text-ink-900 text-sm">
                        {reviews.length >= 50 ? 'Excellent' : reviews.length >= 20 ? 'Very good' : 'Highly rated'}
                      </p>
                      <p className="text-2xs text-ink-500 num">{reviews.length} guest reviews</p>
                    </div>
                  </div>
                )}
              </div>

              {reviewsLoading ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="surface p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <Sk className="h-10 w-10 rounded-full" />
                        <div className="flex-1"><Sk className="h-4 w-24 mb-1.5" /><Sk className="h-3 w-16" /></div>
                        <Sk className="h-4 w-20 rounded-full" />
                      </div>
                      <Sk className="h-3 w-full" />
                      <Sk className="h-3 w-4/5" />
                    </div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <div className="surface p-10 text-center border-dashed">
                  <div className="text-4xl mb-3">⭐</div>
                  <p className="font-display font-bold text-ink-900 mb-1">No reviews yet</p>
                  <p className="text-ink-500 text-sm">Be the first to share your experience.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {reviews.map((r, idx) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.05, duration: 0.4 }}
                      className="surface p-5 relative"
                    >
                      <FaQuoteLeft className="text-teal-100 absolute top-5 right-5" size={22} />
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #06b6d4, #2563eb)' }}
                          >
                            {(r.users?.name || r.user_id || 'G').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-ink-900 text-sm">{r.users?.name || 'Guest'}</p>
                            <p className="text-2xs text-ink-400 num">{r.created_at?.slice(0, 10)}</p>
                            {(() => {
                              const rm = (property?.rooms || []).find(x => x.id === r.room_id);
                              return rm ? (
                                <span className="inline-block mt-1 text-3xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                                  Room <span className="num">{rm.room_number}</span>
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <FaStar key={n} size={11} className={r.rating >= n ? 'text-amber-400' : 'text-ink-200'} />
                          ))}
                        </div>
                      </div>

                      {(r.cleanliness_rating || r.comfort_rating || r.value_rating) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                          {[['Cleanliness', r.cleanliness_rating], ['Comfort', r.comfort_rating], ['Value', r.value_rating], ['Service', r.service_rating], ['Amenities', r.amenities_rating]].map(([label, val]) =>
                            val ? (
                              <div key={label} className="flex items-center gap-1 text-2xs text-ink-500">
                                <span className="font-medium">{label}</span>
                                <span className="font-bold text-ink-900 num">{val}/5</span>
                              </div>
                            ) : null
                          )}
                        </div>
                      )}

                      {r.comment && <p className="text-sm text-ink-700 leading-relaxed mb-3">"{r.comment}"</p>}

                      {r.org_reply && (
                        <div className="surface-soft p-3 border-l-4 border-teal-500 rounded-r-lg mt-3">
                          <p className="text-3xs font-bold text-ink-500 uppercase tracking-widest mb-1">Property response</p>
                          <p className="text-xs text-ink-700 leading-relaxed">{r.org_reply}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>
          </div>

          {/* RIGHT: Booking widget (sticky desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="surface-elev overflow-hidden surface-accent"
              >
                {/* Price header */}
                <div className="p-5 sm:p-6 pb-4 border-b border-ink-100">
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-sm font-medium text-ink-500">From</span>
                    <span className="font-display font-black text-3xl text-ink-900 num">
                      ₹{startingPrice.toLocaleString()}
                    </span>
                    <span className="text-sm text-ink-500">/ night</span>
                  </div>
                  {avgRating && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex items-center gap-1 bg-gradient-to-br from-teal-500 to-sky-600 text-white px-2 py-0.5 rounded-md">
                        <FaStar size={8} className="text-amber-300" />
                        <span className="font-bold num">{avgRating}</span>
                      </div>
                      <span className="text-ink-500 num">{reviews.length} reviews</span>
                    </div>
                  )}
                </div>

                {/* Date picker */}
                <div className="p-4">
                  <div className="border border-ink-200 rounded-xl overflow-hidden mb-3">
                    <div className="grid grid-cols-2 divide-x divide-ink-100">
                      <label className="p-3 cursor-pointer hover:bg-ink-50 transition-colors block">
                        <span className="block text-3xs font-bold text-teal-600 uppercase tracking-widest mb-1">Check-in</span>
                        <div className="flex items-center gap-2">
                          <FaCalendarAlt className="text-teal-500" size={11} />
                          <input
                            type="date" value={selectedDates.checkIn} min={today}
                            onChange={e => setSelectedDates({ ...selectedDates, checkIn: e.target.value })}
                            className="w-full text-sm font-bold text-ink-900 focus:outline-none bg-transparent cursor-pointer num"
                          />
                        </div>
                      </label>
                      <label className="p-3 cursor-pointer hover:bg-ink-50 transition-colors block">
                        <span className="block text-3xs font-bold text-teal-600 uppercase tracking-widest mb-1">Check-out</span>
                        <div className="flex items-center gap-2">
                          <FaCalendarAlt className="text-teal-500" size={11} />
                          <input
                            type="date" value={selectedDates.checkOut} min={selectedDates.checkIn || today}
                            onChange={e => setSelectedDates({ ...selectedDates, checkOut: e.target.value })}
                            className="w-full text-sm font-bold text-ink-900 focus:outline-none bg-transparent cursor-pointer num"
                          />
                        </div>
                      </label>
                    </div>
                  </div>

                  {selectedDates.checkIn && selectedDates.checkOut && (
                    <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 mb-3 text-xs">
                      <span className="font-bold text-teal-700 num">
                        {isSameDay ? 'Day use' : `${nights} night${nights !== 1 ? 's' : ''}`}
                      </span>
                      <span className="text-teal-700 font-medium">
                        {new Date(selectedDates.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' → '}
                        {new Date(selectedDates.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  )}

                  <RoomSection
                    selectedDates={selectedDates} availableRooms={availableRooms}
                    bookingScope={bookingScope} setBookingScope={setBookingScope}
                    showScopeTabs={showScopeTabs} property={property} nights={nights}
                    isSameDay={isSameDay} floorGroups={floorGroups} availableOnly={availableOnly}
                    handleBookRoom={handleBookRoom} handleBookFloor={handleBookFloor}
                    handleBookProperty={handleBookProperty} handleBookCustom={handleBookCustom}
                    toggleCustomRoom={toggleCustomRoom} customSelectedIds={customSelectedIds}
                  />
                </div>

                {/* Trust footer */}
                <div className="border-t border-ink-100 px-4 py-3 bg-gradient-to-br from-teal-50/50 to-sky-50/50">
                  <div className="flex items-center gap-2 text-xs">
                    <FaShieldAlt className="text-teal-500 flex-shrink-0" size={11} />
                    <p className="text-ink-600 font-medium">Free cancellation up to 24 hours before check-in</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── MOBILE STICKY BOOK CTA ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-ink-100 shadow-xl px-4 py-3 z-40 safe-area-bottom">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-bold text-ink-500 uppercase tracking-widest">From</p>
            <p className="font-display font-black text-xl text-ink-900 num">₹{startingPrice.toLocaleString()}<span className="text-2xs font-medium text-ink-500 ml-1">/night</span></p>
          </div>
          <button
            onClick={() => document.getElementById('rooms')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="btn btn-sunset flex-1 max-w-[200px] py-3.5"
          >
            Choose room <FaArrowRight size={11} />
          </button>
        </div>
      </div>

      {/* ── GALLERY LIGHTBOX ── */}
      <AnimatePresence>
        {galleryOpen && (
          <GalleryLightbox
            images={allImages}
            startIndex={galleryIndex}
            propertyName={property.name}
            onClose={() => setGalleryOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── CHECKOUT MODAL ── */}
      <AnimatePresence>
        {showCheckout && selectedRoom && (
          <BookingCheckout
            rooms={scopeRooms} bookingScope={bookingScope} floorName={scopeFloorName}
            property={property} dates={selectedDates} user={user}
            onClose={() => setShowCheckout(false)}
            onSuccess={() => { setShowCheckout(false); navigate('/dashboard'); }}
          />
        )}
      </AnimatePresence>

      <LoginPromptModal
        open={loginPrompt.open}
        action={loginPrompt.action}
        onCancel={() => setLoginPrompt(p => ({ ...p, open: false }))}
      />
    </div>
  );
}

/* ============================================================
   Room section (used both inline mobile + sticky widget)
   ============================================================ */
function RoomSection({
  inline = false, selectedDates, availableRooms, bookingScope, setBookingScope,
  showScopeTabs, property, nights, isSameDay, floorGroups, availableOnly,
  handleBookRoom, handleBookFloor, handleBookProperty, handleBookCustom,
  toggleCustomRoom, customSelectedIds,
}) {
  const navigate = useNavigate();

  if (!selectedDates.checkIn || !selectedDates.checkOut) {
    return (
      <div className="surface-soft border-dashed p-6 text-center">
        <div className="text-3xl mb-2">📅</div>
        <p className="text-sm font-bold text-ink-900 mb-1">Pick your dates</p>
        <p className="text-xs text-ink-500">Choose check-in and check-out to see availability.</p>
      </div>
    );
  }

  if (availableRooms.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <div className="text-3xl mb-2">😔</div>
        <p className="text-sm font-bold text-red-700 mb-1">No rooms available</p>
        <p className="text-xs text-red-600">Try different dates.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Scope tabs */}
      {showScopeTabs && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {['room', 'custom', ...(property.allow_floor_booking ? ['floor'] : []), ...(property.allow_full_property_booking ? ['property'] : [])].map(scope => {
            const active = bookingScope === scope;
            return (
              <button
                key={scope}
                onClick={() => setBookingScope(scope)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${active
                    ? 'bg-ink-900 text-white border-ink-900 shadow-md'
                    : 'bg-white border-ink-200 text-ink-600 hover:border-teal-400 hover:text-teal-700'
                  }`}
              >
                {scope === 'room' ? 'Single' : scope === 'custom' ? 'Custom' : scope === 'floor' ? 'Floor' : 'Whole'}
              </button>
            );
          })}
        </div>
      )}

      {/* Single room */}
      {bookingScope === 'room' && (
        <div className={`space-y-3 ${inline ? '' : 'max-h-[420px] overflow-y-auto pr-1 scrollbar-none'}`}>
          {availableRooms.map((room, idx) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03, duration: 0.3 }}
              className={`surface overflow-hidden transition group p-0 ${room.is_available ? 'hover:border-teal-300 hover:shadow-md' : 'opacity-50'
                }`}
            >
              <div className="flex">
                <div className="w-24 sm:w-28 flex-shrink-0 overflow-hidden bg-ink-100 relative">
                  <img
                    src={room.images?.[0] || ROOM_IMAGES[idx % ROOM_IMAGES.length]}
                    alt={`Room ${room.room_number}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                    onError={e => { e.target.onerror = null; e.target.src = ROOM_IMAGES[0]; }}
                  />
                </div>
                <div className="flex-1 p-3 sm:p-3.5 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display font-bold text-ink-900 text-sm">
                          Room <span className="num">{room.room_number}</span>
                        </p>
                        <p className="text-2xs text-ink-500 uppercase tracking-widest font-semibold truncate">
                          {room.room_type}{room.floor ? ` · ${room.floor}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 bg-ink-100 px-2 py-0.5 rounded-full flex-shrink-0">
                        <FaUser size={9} className="text-ink-500" />
                        <span className="text-2xs font-bold text-ink-700 num">{room.capacity}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between mt-2">
                    <div>
                      <span className="font-display font-black text-ink-900 text-base num">₹{room.price_per_night?.toLocaleString()}</span>
                      <span className="text-2xs text-ink-500 ml-1">/night</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => navigate(`/property/${property.id}/room/${room.id}`)}
                        className="text-xs font-bold text-ink-600 hover:text-teal-700 transition-colors px-2"
                      >
                        Details
                      </button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleBookRoom(room)}
                        disabled={!room.is_available}
                        className={`btn ${room.is_available ? 'btn-primary' : 'btn-outline opacity-50'} px-3 sm:px-4 py-2 text-xs`}
                      >
                        {room.is_available ? 'Reserve' : 'Sold out'}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Custom selection */}
      {bookingScope === 'custom' && (
        <div className={`space-y-3 ${inline ? '' : ''}`}>
          <div className="bg-gradient-to-br from-teal-50 to-sky-50 border border-teal-200 rounded-xl p-3">
            <p className="text-xs font-bold text-teal-800">
              <FaUsers size={9} className="inline mr-1" />
              Select rooms to book together
            </p>
          </div>
          <div className={inline ? '' : 'max-h-[360px] overflow-y-auto pr-1 scrollbar-none space-y-2'}>
            {availableRooms.map((room, idx) => {
              const checked = customSelectedIds.includes(room.id);
              return (
                <label
                  key={room.id}
                  className={`block surface overflow-hidden cursor-pointer transition p-0 ${!room.is_available ? 'opacity-40 cursor-not-allowed' :
                      checked ? 'border-teal-500 bg-teal-50' : 'hover:border-teal-300'
                    }`}
                >
                  <div className="flex items-center p-3 gap-3">
                    <input
                      type="checkbox" checked={checked} disabled={!room.is_available}
                      onChange={() => toggleCustomRoom(room.id)}
                      className="h-4 w-4 rounded border-ink-300 text-teal-600 focus:ring-teal-500"
                    />
                    <div className="w-14 h-14 flex-shrink-0 bg-ink-100 rounded-lg overflow-hidden">
                      <img
                        src={room.images?.[0] || ROOM_IMAGES[idx % ROOM_IMAGES.length]}
                        alt="" className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-ink-900 text-sm">
                        Room <span className="num">{room.room_number}</span>
                      </p>
                      <p className="text-2xs text-ink-500 uppercase tracking-widest font-semibold">
                        {room.room_type}{room.floor ? ` · ${room.floor}` : ''}
                      </p>
                      <p className="font-display font-bold text-ink-900 mt-0.5 text-sm num">
                        ₹{room.price_per_night?.toLocaleString()}
                        <span className="text-2xs font-medium text-ink-500"> /night</span>
                      </p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <button
            onClick={handleBookCustom} disabled={customSelectedIds.length === 0}
            className="btn btn-primary w-full py-3.5 text-sm"
          >
            Book <span className="num">{customSelectedIds.length}</span> {customSelectedIds.length === 1 ? 'room' : 'rooms'}
          </button>
        </div>
      )}

      {/* Floor */}
      {bookingScope === 'floor' && (
        <div className="space-y-3">
          {Object.keys(floorGroups).length === 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-sm text-red-700 font-bold">
              No available floors for these dates.
            </div>
          ) : Object.entries(floorGroups).map(([floorName, floorRooms]) => {
            const total = floorRooms.reduce((sum, r) => sum + r.price_per_night * nights, 0);
            return (
              <motion.div
                key={floorName}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="surface p-4 hover:border-teal-300 hover:shadow-md transition-all"
              >
                <div className="mb-3">
                  <p className="font-display font-bold text-ink-900">{floorName}</p>
                  <p className="text-xs text-ink-500 num">{floorRooms.length} {floorRooms.length === 1 ? 'room' : 'rooms'}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {floorRooms.map(r => (
                    <span key={r.id} className="pill pill-teal text-2xs">
                      Room <span className="num">{r.room_number}</span>
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-display font-black text-ink-900 text-lg num">₹{total.toLocaleString()}</span>
                    <span className="text-2xs text-ink-500 ml-1 num">/ {nights}n</span>
                  </div>
                  <button onClick={() => handleBookFloor(floorName, floorRooms)} className="btn btn-primary px-4 py-2 text-xs">
                    Book floor
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Whole property */}
      {bookingScope === 'property' && (
        <div>
          {availableOnly.length === 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-sm text-red-700 font-bold">
              No available rooms for these dates.
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="surface p-5 hover:border-teal-300 hover:shadow-md transition-all"
            >
              <div className="mb-3">
                <p className="font-display font-bold text-ink-900">Entire property</p>
                <p className="text-xs text-ink-500 num">{availableOnly.length} rooms available</p>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {availableOnly.map(r => (
                  <span key={r.id} className="pill pill-teal text-2xs">
                    Room <span className="num">{r.room_number}</span>
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-display font-black text-ink-900 text-xl num">
                    ₹{availableOnly.reduce((sum, r) => sum + r.price_per_night * nights, 0).toLocaleString()}
                  </span>
                  <span className="text-2xs text-ink-500 ml-1 num">/ {nights}n</span>
                </div>
                <button onClick={handleBookProperty} className="btn btn-primary px-4 py-2 text-xs">
                  Book whole
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Gallery lightbox
   ============================================================ */
function GalleryLightbox({ images, startIndex, propertyName, onClose }) {
  const [index, setIndex] = useState(startIndex);

  const next = useCallback(() => setIndex(i => (i + 1) % images.length), [images.length]);
  const prev = useCallback(() => setIndex(i => (i - 1 + images.length) % images.length), [images.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [next, prev, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink-900/95 backdrop-blur-sm flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 sm:p-5 text-white">
        <div>
          <p className="font-bold text-sm">{propertyName}</p>
          <p className="text-2xs text-white/60 num">{index + 1} / {images.length}</p>
        </div>
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <FaTimes size={13} />
        </button>
      </div>

      {/* Main image */}
      <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.img
            key={index}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3 }}
            src={images[index]}
            alt=""
            className="max-h-full max-w-full object-contain rounded-xl"
          />
        </AnimatePresence>

        <button
          onClick={prev}
          className="absolute left-3 sm:left-6 h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur transition-colors"
        >
          <FaChevronLeft size={14} />
        </button>
        <button
          onClick={next}
          className="absolute right-3 sm:right-6 h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur transition-colors"
        >
          <FaChevronRight size={14} />
        </button>
      </div>

      {/* Thumbnails */}
      <div className="p-4 sm:p-5">
        <div className="flex gap-2 justify-center overflow-x-auto scrollbar-none">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`flex-shrink-0 h-14 w-20 sm:h-16 sm:w-24 rounded-lg overflow-hidden transition-all ${index === i ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-ink-900 scale-105' : 'opacity-50 hover:opacity-80'
                }`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================
   Booking checkout modal
   ============================================================ */
function BookingCheckout({ rooms, bookingScope, floorName, property, dates, user, onClose, onSuccess }) {
  const [guestData, setGuestData] = useState({
    name: user?.name || '', email: user?.email || '', phone: user?.phone || '',
    guests: 1, special_requests: '',
  });
  const [coguests, setCoguests] = useState([]);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', phone: '', email: '', relationship: '', save_to_list: true });
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [showMoreTerms, setShowMoreTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const nights = Math.max(1, Math.ceil((new Date(dates.checkOut) - new Date(dates.checkIn)) / 86400000));
  const basePrice = rooms.reduce((sum, r) => sum + r.price_per_night * nights, 0);
  const discountAmount = couponResult?.discount_amount || 0;
  const finalPrice = couponResult?.final_amount ?? basePrice;
  const roomSummary = bookingScope === 'room'
    ? `Room ${rooms[0]?.room_number} · ${rooms[0]?.room_type}`
    : bookingScope === 'floor'
      ? `${rooms.length} rooms · ${floorName}`
      : `Entire property · ${rooms.length} rooms`;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    try {
      const res = await apiClient.post('/bookings/validate-coupon', { code: couponCode, room_id: rooms[0].id });
      setCouponResult(res.data.data);
      toast.success(res.data.data.is_free_booking ? '🎉 100% off - this stay is free!' : 'Coupon applied.');
    } catch (err) {
      setCouponResult(null);
      toast.error(err.response?.data?.error || 'Invalid coupon');
    } finally { setApplyingCoupon(false); }
  };

  const addNewGuest = () => {
    if (!newGuest.name.trim()) return toast.error('Name required');
    setCoguests([...coguests, { ...newGuest, id: Date.now().toString() }]);
    setNewGuest({ name: '', phone: '', email: '', relationship: '', save_to_list: true });
    setShowAddGuest(false);
  };

  const buildBookingPayload = () => ({
    room_id: rooms[0].id, property_id: property.id,
    check_in_date: dates.checkIn, check_out_date: dates.checkOut,
    number_of_guests: parseInt(guestData.guests) + coguests.length,
    coguests: coguests.map(g => ({ name: g.name, email: g.email, phone: g.phone, relationship: g.relationship })),
    consent_agreed: true, coupon_code: couponResult ? couponCode : '',
    special_requests: guestData.special_requests,
    guest_name: guestData.name, guest_email: guestData.email, guest_phone: guestData.phone,
  });

  const buildGroupBookingPayload = () => ({
    booking_scope: bookingScope, floor_name: floorName || '',
    room_ids: rooms.map(r => r.id), property_id: property.id,
    check_in_date: dates.checkIn, check_out_date: dates.checkOut,
    number_of_guests: parseInt(guestData.guests) + coguests.length,
    coguests: coguests.map(g => ({ name: g.name, email: g.email, phone: g.phone, relationship: g.relationship })),
    consent_agreed: true, coupon_code: couponResult ? couponCode : '',
    special_requests: guestData.special_requests,
    guest_name: guestData.name, guest_email: guestData.email, guest_phone: guestData.phone,
  });

  const validateForm = () => {
    // Only name + phone are mandatory for the guest; everything else
    // (email, ID, address, etc.) is collected by reception on arrival.
    if (!guestData.name || !guestData.phone) { toast.error('Please enter your name and phone number'); return false; }
    if (!consentAgreed) { toast.error('Agree to terms to continue'); return false; }
    return true;
  };

  const handlePayOnline = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      let bookingId;
      if (bookingScope === 'room') {
        const r = await apiClient.post('/bookings', buildBookingPayload());
        if (r.data.is_free_booking) { toast.success('Booking confirmed (free via coupon)!'); onSuccess(); return; }
        bookingId = r.data.data.id;
      } else {
        const r = await apiClient.post('/bookings/group', buildGroupBookingPayload());
        if (r.data.is_free_booking) { toast.success('Booking confirmed (free via coupon)!'); onSuccess(); return; }
        bookingId = r.data.data.primary_booking_id;
      }
      if (finalPrice <= 0) {
        await apiClient.post(`/bookings/${bookingId}/initiate-payment`);
        toast.success('Confirmed.'); onSuccess(); return;
      }
      const payRes = await apiClient.post(`/bookings/${bookingId}/initiate-payment`);
      const { order_id, amount, key_id } = payRes.data.data;
      const options = {
        key: key_id || process.env.REACT_APP_RAZORPAY_KEY_ID,
        amount: amount * 100, currency: 'INR', name: 'Zero One',
        description: `${roomSummary} – ${property.name}`, order_id,
        prefill: { name: guestData.name, email: guestData.email, contact: guestData.phone },
        theme: { color: '#0891b2' },
        handler: async (response) => {
          try {
            await apiClient.post(`/bookings/${bookingId}/confirm-payment`, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('Booking confirmed! Check your email.');
            onSuccess();
          } catch { toast.error('Payment done but update failed. Contact support.'); }
        },
        modal: { ondismiss: () => toast.error('Payment cancelled') },
      };
      new window.Razorpay(options).open();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create booking');
    } finally { setLoading(false); }
  };

  const handlePayAtProperty = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      let bookingId;
      if (bookingScope === 'room') {
        const r = await apiClient.post('/bookings', buildBookingPayload());
        bookingId = r.data.data.id;
      } else {
        const r = await apiClient.post('/bookings/group', buildGroupBookingPayload());
        bookingId = r.data.data.primary_booking_id;
      }
      await apiClient.post(`/bookings/${bookingId}/confirm-offline`);
      toast.success('Booking confirmed! Pay on arrival.');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setLoading(false); }
  };

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
        <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="h-1.5 w-10 bg-ink-200 rounded-full" /></div>
        <div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 flex justify-between items-center z-10">
          <div>
            <span className="section-eyebrow">Checkout</span>
            <h2 className="font-display font-bold text-ink-900 text-lg mt-0.5">Confirm your booking</h2>
            <p className="text-xs text-ink-500 truncate">{property.name}</p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-700 transition-colors flex-shrink-0"
          >
            <FaTimes size={12} />
          </button>
        </div>

        <form onSubmit={handlePayOnline} className="p-5 space-y-5">
          {/* Stay summary */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #ecfeff 0%, #f0f9ff 100%)', border: '1px solid #cffafe' }}
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-teal-200/40 blur-3xl pointer-events-none" />
            <div className="relative">
              <p className="text-3xs font-bold text-teal-700 uppercase tracking-widest mb-3">Stay summary</p>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <p className="text-3xs text-ink-500 mb-0.5 font-bold uppercase tracking-widest">Room</p>
                  <p className="font-bold text-ink-900 text-xs leading-snug">{roomSummary}</p>
                </div>
                <div>
                  <p className="text-3xs text-ink-500 mb-0.5 font-bold uppercase tracking-widest">Duration</p>
                  <p className="font-bold text-ink-900 num">{nights} {nights === 1 ? 'night' : 'nights'}</p>
                </div>
                <div>
                  <p className="text-3xs text-ink-500 mb-0.5 font-bold uppercase tracking-widest">Check-in</p>
                  <p className="font-bold text-ink-900 text-xs num">{new Date(dates.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-3xs text-ink-500 mb-0.5 font-bold uppercase tracking-widest">Check-out</p>
                  <p className="font-bold text-ink-900 text-xs num">{new Date(dates.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
              <div className="border-t border-teal-200 pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-ink-600"><span>Base price</span><span className="num font-semibold">₹{basePrice.toLocaleString()}</span></div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-teal-700 font-bold">
                    <span>Discount ({couponCode})</span>
                    <span className="num">−₹{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-display font-black text-ink-900 border-t border-teal-200 pt-3 mt-2 text-lg">
                  <span>Total</span>
                  <span className="text-teal-700 num">₹{finalPrice.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Primary guest */}
          <div>
            <span className="section-eyebrow">Primary guest</span>
            <div className="space-y-3 mt-3">
              <input type="text" placeholder="Full name *" value={guestData.name}
                onChange={e => setGuestData({ ...guestData, name: e.target.value })} className="input-base" />
              <input type="email" placeholder="Email address (optional)" value={guestData.email}
                onChange={e => setGuestData({ ...guestData, email: e.target.value })} className="input-base" />
              <div className="grid grid-cols-2 gap-3">
                <input type="tel" placeholder="Phone *" value={guestData.phone}
                  onChange={e => setGuestData({ ...guestData, phone: e.target.value })} className="input-base num" />
                <input type="number" min="1" placeholder="Guests" value={guestData.guests}
                  onChange={e => setGuestData({ ...guestData, guests: e.target.value })} className="input-base num" />
              </div>
              <textarea placeholder="Special requests (optional)" value={guestData.special_requests}
                onChange={e => setGuestData({ ...guestData, special_requests: e.target.value })}
                rows={2} className="input-base resize-none" />
            </div>
          </div>

          {/* Additional guests */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="section-eyebrow">Additional guests</span>
              <button type="button" onClick={() => setShowAddGuest(true)} className="btn btn-outline px-3 py-1.5 text-xs">
                <FaPlus size={9} /> Add
              </button>
            </div>
            <AnimatePresence>
              {showAddGuest && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="surface-soft p-4 mb-3">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[['Name *', 'name'], ['Phone', 'phone'], ['Email', 'email'], ['Relationship', 'relationship']].map(([p, k]) => (
                        <input key={k} placeholder={p} value={newGuest[k]}
                          onChange={e => setNewGuest({ ...newGuest, [k]: e.target.value })}
                          className="input-base text-sm py-2" />
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-ink-600 mb-3 cursor-pointer">
                      <input type="checkbox" checked={newGuest.save_to_list}
                        onChange={e => setNewGuest({ ...newGuest, save_to_list: e.target.checked })}
                        className="rounded text-teal-600 focus:ring-teal-500" />
                      Save to my guest list
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={addNewGuest} className="btn btn-primary px-4 py-2 text-xs">Add</button>
                      <button type="button" onClick={() => setShowAddGuest(false)} className="btn btn-outline px-4 py-2 text-xs">Cancel</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {coguests.length > 0 && (
              <div className="space-y-2">
                {coguests.map(g => (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between surface p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: 'linear-gradient(135deg, #06b6d4, #2563eb)' }}>
                        {g.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{g.name}</p>
                        <p className="text-xs text-ink-500">{g.phone || g.email || g.relationship}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setCoguests(coguests.filter(x => x.id !== g.id))}
                      className="text-ink-300 hover:text-red-500 transition-colors p-1">
                      <FaTrash size={11} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Coupon */}
          <div>
            <span className="section-eyebrow">Coupon</span>
            <div className="mt-3">
              {couponResult ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-between bg-gradient-to-br from-teal-50 to-sky-50 border border-teal-200 rounded-xl p-3.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}>
                      <FaCheckCircle className="text-white" size={14} />
                    </div>
                    <div>
                      <p className="font-bold text-teal-800 text-sm font-mono tracking-wider">{couponResult.code}</p>
                      <p className="text-teal-700 text-xs">Discount applied.</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setCouponResult(null); setCouponCode(''); }}
                    className="text-ink-400 hover:text-red-500 transition-colors p-1">
                    <FaTimes size={11} />
                  </button>
                </motion.div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FaTag className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={11} />
                    <input
                      type="text"
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      className="input-base font-mono uppercase tracking-wider pl-9"
                    />
                  </div>
                  <button type="button" onClick={handleApplyCoupon}
                    disabled={applyingCoupon || !couponCode.trim()}
                    className="btn btn-ink px-4 py-3 text-sm whitespace-nowrap">
                    {applyingCoupon ? '…' : 'Apply'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Terms */}
          <div className="surface-soft p-4">
            <p className="text-3xs font-bold text-ink-500 mb-2 uppercase tracking-widest">Booking terms</p>
            <ul className="text-xs text-ink-700 space-y-1.5 mb-3 list-disc pl-4">
              <li>Government photo ID required for all guests at check-in.</li>
              <li>Check-in: <span className="num font-bold">2:00 PM</span> · Check-out: <span className="num font-bold">11:00 AM</span></li>
              {showMoreTerms && (
                <>
                  <li>Cancellations 24h before check-in eligible for full refund.</li>
                  <li>No smoking, pets, or outside food on premises.</li>
                  <li>Guests responsible for personal valuables.</li>
                </>
              )}
            </ul>
            <button type="button" onClick={() => setShowMoreTerms(!showMoreTerms)}
              className="text-xs text-teal-700 font-bold hover:text-teal-900">
              {showMoreTerms ? '← Show less' : 'Read more →'}
            </button>
            <label className="flex items-start gap-3 mt-3 cursor-pointer">
              <input type="checkbox" checked={consentAgreed}
                onChange={e => setConsentAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-ink-300 text-teal-600 focus:ring-teal-500" />
              <span className="text-xs text-ink-700 leading-relaxed">
                I agree to the booking terms and confirm all guest information is accurate.
              </span>
            </label>
          </div>

          {/* Pay buttons */}
          <div className="space-y-2.5 pb-2">
            <motion.button
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              type="submit" disabled={loading || !consentAgreed}
              className="btn btn-sunset w-full py-4 text-sm shadow-lg"
            >
              {loading && <span className="spinner" />}
              {loading ? 'Processing…' : <>Pay <span className="num">₹{finalPrice.toLocaleString()}</span> online</>}
            </motion.button>
            {property.allow_pay_at_property !== false && (
              <button type="button" onClick={handlePayAtProperty}
                disabled={loading || !consentAgreed} className="btn btn-outline w-full py-3.5 text-sm">
                {loading ? 'Processing…' : 'Pay at property on arrival'}
              </button>
            )}
            <p className="text-center text-2xs text-ink-400">
              Secured by Razorpay · Your data is encrypted
            </p>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
