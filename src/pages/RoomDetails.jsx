import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store';
import apiClient from '../api/client';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import {
  FaArrowLeft, FaStar, FaUser, FaBed, FaRulerCombined,
  FaQuoteLeft, FaCheckCircle, FaShieldAlt, FaArrowRight,
} from 'react-icons/fa';

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
];

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function RoomDetails() {
  const { propertyId, roomId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(null);
  const [activeImg, setActiveImg] = useState(0);

  const [eligibility, setEligibility] = useState({ eligible: false, booking_id: null });
  const [form, setForm] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadRoom = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/properties/${propertyId}/rooms/${roomId}`);
      setRoom(res.data.data);
    } catch {
      toast.error('Could not load this room');
      navigate(`/property/${propertyId}`);
    } finally { setLoading(false); }
  }, [propertyId, roomId, navigate]);

  const loadReviews = useCallback(async () => {
    try {
      const res = await apiClient.get(`/properties/${propertyId}/rooms/${roomId}/reviews`);
      setReviews(res.data.data || []);
      setAvgRating(res.data.average_rating);
    } catch { setReviews([]); }
  }, [propertyId, roomId]);

  const checkEligibility = useCallback(async () => {
    if (!isAuthenticated) { setEligibility({ eligible: false, booking_id: null }); return; }
    try {
      const res = await apiClient.get(`/rooms/${roomId}/review-eligibility`);
      setEligibility(res.data.data);
    } catch { setEligibility({ eligible: false, booking_id: null }); }
  }, [roomId, isAuthenticated]);

  useEffect(() => { loadRoom(); loadReviews(); }, [loadRoom, loadReviews]);
  useEffect(() => { checkEligibility(); }, [checkEligibility]);

  async function submitReview(e) {
    e.preventDefault();
    if (!eligibility.booking_id) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/bookings/${eligibility.booking_id}/review`, {
        rating: form.rating,
        comment: form.comment.trim() || undefined,
      });
      toast.success('Thanks for your review!');
      setForm({ rating: 5, comment: '' });
      await loadReviews();
      await checkEligibility();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not submit review'); }
    finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar />
        <div className="page-wide py-12 flex items-center justify-center">
          <div className="text-center">
            <div className="spinner mx-auto mb-3 text-teal-500" />
            <p className="text-ink-500 text-sm">Loading room…</p>
          </div>
        </div>
      </div>
    );
  }
  if (!room) return null;

  const images = room.images?.length ? room.images : FALLBACK_IMAGES;
  const amenities = Array.isArray(room.amenities) ? room.amenities : [];

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />

      <div className="page-wide pt-4 sm:pt-5">
        <button
          onClick={() => navigate(`/property/${propertyId}`)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 hover:text-teal-700 transition-colors"
        >
          <FaArrowLeft size={11} /> Back to {room.property?.name || 'property'}
        </button>
      </div>

      <div className="page-wide py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 lg:gap-10">

          {/* LEFT: Gallery + Reviews */}
          <div className="space-y-8 min-w-0">
            {/* Title + summary on mobile (sticky widget is on right) */}
            <motion.div initial="hidden" animate="visible" variants={reveal} className="lg:hidden">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xs font-bold text-teal-700 uppercase tracking-widest">Room</span>
              </div>
              <h1 className="font-display font-black tracking-tighter text-ink-900 mb-2">
                Room <span className="num">{room.room_number}</span>
              </h1>
              <p className="text-sm text-ink-500 uppercase tracking-widest font-bold">
                {room.room_type}{room.floor ? ` · ${room.floor}` : ''}
              </p>
            </motion.div>

            {/* Gallery */}
            <motion.div initial="hidden" animate="visible" variants={reveal} className="surface-elev overflow-hidden p-0">
              <div className="aspect-[16/10] bg-ink-100 relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={activeImg}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45 }}
                    src={images[activeImg]}
                    alt={`Room ${room.room_number}`}
                    className="w-full h-full object-cover"
                    onError={e => { e.target.onerror = null; e.target.src = FALLBACK_IMAGES[0]; }}
                  />
                </AnimatePresence>
                <div className="absolute top-3 left-3">
                  <span className="pill pill-ink bg-white/95 backdrop-blur text-ink-900 border-white">
                    {activeImg + 1} / {images.length}
                  </span>
                </div>
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 p-3 sm:p-4 overflow-x-auto scrollbar-none border-t border-ink-100">
                  {images.map((img, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setActiveImg(i)}
                      className={`h-16 w-24 sm:h-20 sm:w-28 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                        i === activeImg
                          ? 'border-teal-500 ring-2 ring-teal-200 shadow-md'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Specs strip */}
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={reveal}
              className="grid grid-cols-3 gap-3"
            >
              {[
                { icon: FaUser, label: 'Sleeps', value: room.max_occupancy || room.capacity },
                ...(room.bed_count ? [{ icon: FaBed, label: 'Beds', value: room.bed_count }] : []),
                ...(room.size_sqft ? [{ icon: FaRulerCombined, label: 'Sqft', value: room.size_sqft }] : []),
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="surface p-4 text-center">
                  <div className="h-10 w-10 mx-auto rounded-xl flex items-center justify-center mb-2"
                    style={{ background: 'linear-gradient(135deg, #ecfeff, #f0f9ff)', border: '1px solid #cffafe' }}>
                    <Icon className="text-teal-600" size={14} />
                  </div>
                  <p className="font-display font-black text-ink-900 text-xl num">{value}</p>
                  <p className="text-3xs text-ink-500 font-bold uppercase tracking-widest mt-0.5">{label}</p>
                </div>
              ))}
            </motion.div>

            {/* Description */}
            {room.description && (
              <motion.section
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={reveal}
              >
                <span className="section-eyebrow">About this room</span>
                <h2 className="font-display font-bold text-ink-900 mt-2 mb-4">What to expect</h2>
                <p className="text-ink-700 text-base leading-relaxed">{room.description}</p>
              </motion.section>
            )}

            {/* Amenities */}
            {amenities.length > 0 && (
              <motion.section
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={reveal}
              >
                <span className="section-eyebrow">In this room</span>
                <h2 className="font-display font-bold text-ink-900 mt-2 mb-5">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {amenities.map((a, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.03, duration: 0.3 }}
                      className="pill pill-teal text-xs px-3 py-1.5"
                    >
                      <FaCheckCircle size={9} /> {a}
                    </motion.span>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Reviews */}
            <motion.section
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={reveal}
            >
              <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
                <div>
                  <span className="section-eyebrow">Reviews</span>
                  <h2 className="font-display font-bold text-ink-900 mt-2">Verified guest reviews</h2>
                </div>
                {avgRating != null && (
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
                        {reviews.length >= 50 ? 'Excellent' : reviews.length >= 10 ? 'Very good' : 'Highly rated'}
                      </p>
                      <p className="text-2xs text-ink-500 num">{reviews.length} reviews</p>
                    </div>
                  </div>
                )}
              </div>

              {reviews.length === 0 ? (
                <div className="surface p-10 text-center border-dashed">
                  <div className="text-4xl mb-3">⭐</div>
                  <p className="font-display font-bold text-ink-900 mb-1">No reviews yet</p>
                  <p className="text-ink-500 text-sm">Only verified guests who stayed here can review.</p>
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
                      <FaQuoteLeft className="text-teal-100 absolute top-5 right-5" size={20} />
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                            style={{ background: 'linear-gradient(135deg, #06b6d4, #2563eb)' }}
                          >
                            {(r.users?.name || 'G').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-ink-900 text-sm">{r.users?.name || 'Guest'}</p>
                            <p className="text-2xs text-ink-400 num">{r.created_at?.slice(0, 10)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <FaStar key={n} size={11} className={r.rating >= n ? 'text-amber-400' : 'text-ink-200'} />
                          ))}
                        </div>
                      </div>
                      {r.comment && <p className="text-sm text-ink-700 leading-relaxed">"{r.comment}"</p>}
                      {r.org_reply && (
                        <div className="surface-soft p-3 border-l-4 border-teal-500 rounded-r-lg mt-3">
                          <p className="text-3xs font-bold text-teal-700 uppercase tracking-widest mb-1">Property response</p>
                          <p className="text-xs text-ink-700 leading-relaxed">{r.org_reply}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>
          </div>

          {/* RIGHT: Sticky booking card */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-5">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="surface-elev p-6 surface-accent"
              >
                <div className="mb-4">
                  <p className="text-3xs font-bold text-teal-700 uppercase tracking-widest mb-1">Room</p>
                  <h2 className="font-display font-black text-2xl text-ink-900">
                    Room <span className="num">{room.room_number}</span>
                  </h2>
                  <p className="text-xs text-ink-500 font-bold uppercase tracking-widest mt-1">
                    {room.room_type}{room.floor ? ` · ${room.floor}` : ''}
                  </p>
                </div>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-sm text-ink-500">From</span>
                  <span className="font-display font-black text-3xl text-ink-900 num">₹{room.price_per_night?.toLocaleString()}</span>
                  <span className="text-sm text-ink-500">/ night</span>
                </div>

                {room.weekend_rate && (
                  <div className="text-xs text-ink-500 mb-4 surface-soft px-3 py-2">
                    Weekend rate: <span className="font-bold text-ink-900 num">₹{room.weekend_rate?.toLocaleString()}</span>
                  </div>
                )}

                <div className="space-y-2 mb-5">
                  {[
                    { icon: FaUser, label: 'Sleeps', value: room.max_occupancy || room.capacity },
                    ...(room.bed_count ? [{ icon: FaBed, label: 'Beds', value: room.bed_count }] : []),
                    ...(room.size_sqft ? [{ icon: FaRulerCombined, label: 'Size', value: `${room.size_sqft} sqft` }] : []),
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <Icon className="text-teal-500" size={12} />
                      <span className="text-ink-600">{label}</span>
                      <span className="ml-auto font-bold text-ink-900 num">{value}</span>
                    </div>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/property/${propertyId}`)}
                  className="btn btn-sunset w-full py-4 text-sm shadow-lg"
                >
                  Check dates & reserve <FaArrowRight size={11} />
                </motion.button>

                <div className="flex items-center gap-2 mt-4 text-xs text-ink-500">
                  <FaShieldAlt className="text-teal-500" size={11} />
                  <span>Free cancellation up to 24h</span>
                </div>
              </motion.div>

              {/* Review form for eligible guests */}
              {isAuthenticated && eligibility.eligible && (
                <motion.form
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.25 }}
                  onSubmit={submitReview}
                  className="surface p-5"
                >
                  <p className="text-3xs font-bold text-teal-700 uppercase tracking-widest mb-1">Verified stay</p>
                  <p className="font-display font-bold text-ink-900 text-base mb-3">Leave a review</p>
                  <div className="flex items-center gap-1.5 mb-3">
                    {[1, 2, 3, 4, 5].map(n => (
                      <motion.button
                        key={n} type="button"
                        whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                        onClick={() => setForm(f => ({ ...f, rating: n }))}
                      >
                        <FaStar size={22} className={form.rating >= n ? 'text-amber-400' : 'text-ink-200'} />
                      </motion.button>
                    ))}
                  </div>
                  <textarea
                    value={form.comment} maxLength={1000}
                    onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                    placeholder="Share what your stay was like (optional)"
                    className="input-base resize-none text-sm"
                    rows={3}
                  />
                  <button
                    type="submit" disabled={submitting}
                    className="btn btn-primary w-full py-3 text-sm mt-3"
                  >
                    {submitting ? 'Submitting…' : 'Submit review'}
                  </button>
                </motion.form>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile reserve CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-ink-100 shadow-xl px-4 py-3 z-40 safe-area-bottom">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-bold text-ink-500 uppercase tracking-widest">From</p>
            <p className="font-display font-black text-xl text-ink-900 num">
              ₹{room.price_per_night?.toLocaleString()}<span className="text-2xs font-medium text-ink-500 ml-1">/night</span>
            </p>
          </div>
          <button
            onClick={() => navigate(`/property/${propertyId}`)}
            className="btn btn-sunset flex-1 max-w-[200px] py-3.5"
          >
            Reserve <FaArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
