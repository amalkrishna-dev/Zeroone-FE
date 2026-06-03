import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import apiClient from '../api/client';
import toast from 'react-hot-toast';
import {
  FaArrowLeft, FaPrint, FaCheckCircle, FaMapMarkerAlt, FaPhoneAlt,
  FaCalendarAlt, FaUser, FaWhatsapp, FaShieldAlt, FaIdCard,
} from 'react-icons/fa';

export default function BookingDocument() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await apiClient.get(`/bookings/${bookingId}/document`);
        setData(res.data.data);
      } catch {
        toast.error('Failed to load booking document');
        navigate('/dashboard');
      } finally { setLoading(false); }
    };
    fetchDocument();
  }, [bookingId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            className="h-12 w-12 mx-auto rounded-full mb-4"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0%, #06b6d4 80%, transparent 100%)',
              mask: 'radial-gradient(circle 14px at center, transparent 99%, white 100%)',
              WebkitMask: 'radial-gradient(circle 14px at center, transparent 99%, white 100%)',
            }}
          />
          <span className="wordmark text-lg block mb-1">Zero One<span className="wordmark-dot">.</span></span>
          <p className="text-ink-500 text-xs">Loading your booking…</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { booking, user, room, property, aadhaar } = data;
  const checkIn = new Date(booking.check_in_date);
  const checkOut = new Date(booking.check_out_date);
  const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
  const isSameDay = checkIn.toDateString() === checkOut.toDateString();

  return (
    <>
      {/* Top toolbar (hidden in print) */}
      <div className="print:hidden bg-white border-b border-ink-100 sticky top-0 z-50 shadow-sm">
        <div className="page-wide h-16 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 hover:text-teal-700 transition-colors"
          >
            <FaArrowLeft size={11} /> <span className="hidden sm:inline">Back to bookings</span>
          </button>
          <div className="text-center min-w-0 flex-1">
            <div className="flex items-center justify-center gap-2">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center font-display font-black text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2, #2563eb)' }}
              >
                0<span className="text-[7px] -ml-0.5 self-end mb-1">1</span>
              </div>
              <span className="wordmark text-base sm:text-lg">Zero One<span className="wordmark-dot">.</span></span>
            </div>
            <p className="text-3xs font-mono text-ink-400 mt-0.5 truncate tracking-widest">#{booking.id?.slice(0, 8).toUpperCase()}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => window.print()} className="btn btn-primary text-sm"
          >
            <FaPrint size={11} /> <span className="hidden sm:inline">Print</span>
          </motion.button>
        </div>
      </div>

      {/* Document */}
      <div className="bg-canvas-soft min-h-screen flex justify-center py-4 sm:py-8 print:bg-white print:py-0">
        <motion.article
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white w-full max-w-[210mm] sm:w-[210mm] min-h-[297mm] shadow-lg print:shadow-none p-6 sm:p-[15mm] print:p-[15mm] mx-2 sm:mx-auto rounded-2xl sm:rounded-2xl print:rounded-none overflow-hidden relative"
        >
          {/* Decorative gradient header strip (subtle, prints in B&W gracefully) */}
          <div
            className="absolute top-0 left-0 right-0 h-2"
            style={{ background: 'linear-gradient(90deg, #06b6d4, #0891b2, #2563eb, #06b6d4)' }}
          />

          {/* Header */}
          <header className="flex flex-col sm:flex-row justify-between items-start gap-3 pb-6 mb-6 border-b-2 border-ink-900">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center font-display font-black text-white text-lg print:bg-ink-900"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2, #2563eb)' }}
                >
                  0<span className="text-[8px] -ml-0.5 self-end mb-1.5">1</span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tighter text-ink-900">
                  Zero One<span className="text-teal-500">.</span>
                </h1>
              </div>
              <p className="text-sm font-semibold text-ink-600">Booking confirmation</p>
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border border-teal-200 bg-teal-50">
                <FaCheckCircle className="text-teal-600" size={10} />
                <span className="text-2xs font-bold text-teal-700 uppercase tracking-wider">
                  {booking.status === 'confirmed' ? 'Confirmed' : booking.status}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xs font-bold text-ink-500 uppercase tracking-widest">Reference</p>
              <p className="font-mono font-black text-ink-900 text-xl mt-1 tracking-wider">
                #{booking.id?.slice(0, 8).toUpperCase()}
              </p>
              <p className="text-xs text-ink-500 num mt-1">
                {new Date(booking.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </header>

          {/* Room password highlight (if set) */}
          {booking.admin_status === 'password_set' && booking.room_password && (
            <motion.section
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="mb-6 rounded-2xl p-5 text-center relative overflow-hidden print:border-2 print:border-ink-900"
              style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #2563eb 100%)' }}
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl pointer-events-none print:hidden" />
              <p className="relative text-white/85 text-3xs font-bold uppercase tracking-widest mb-2">Your room password</p>
              <p className="relative font-mono font-black text-white text-3xl sm:text-4xl tracking-[0.4em]">
                {booking.room_password}
              </p>
              <p className="relative text-white/75 text-xs mt-2">Use this code at the room door</p>
            </motion.section>
          )}

          {/* Property */}
          <section className="mb-5 rounded-2xl p-5 border border-ink-100 bg-gradient-to-br from-teal-50/40 to-sky-50/30 print:bg-white print:border-2 print:border-ink-200">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 print:bg-ink-100"
                style={{ background: 'linear-gradient(135deg, #ecfeff, #f0f9ff)', border: '1px solid #cffafe' }}>
                <FaMapMarkerAlt className="text-teal-600" size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-3xs font-bold text-ink-500 uppercase tracking-widest mb-1">Property</h2>
                <p className="font-display text-lg font-bold text-ink-900">{property.name || '-'}</p>
                <p className="text-sm text-ink-700">{property.address || ''}</p>
                <p className="text-sm text-ink-700">{[property.city, property.state, property.pincode].filter(Boolean).join(', ')}</p>
                {property.phone && (
                  <p className="text-sm font-semibold text-teal-700 num mt-1 inline-flex items-center gap-1.5">
                    <FaPhoneAlt size={9} /> {property.phone}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Room + Stay */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <section className="rounded-2xl p-5 border border-ink-100 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center print:bg-white">
                  <FaIdCard className="text-teal-600" size={12} />
                </div>
                <h2 className="text-3xs font-bold text-ink-500 uppercase tracking-widest">Room</h2>
              </div>
              <p className="font-display text-2xl font-black text-ink-900">
                Room <span className="num">{room.room_number || '-'}</span>
              </p>
              <div className="space-y-1 mt-2 text-sm text-ink-700">
                <p><span className="text-ink-500">Type:</span> <span className="font-bold">{room.room_type || '-'}</span></p>
                <p><span className="text-ink-500">Floor:</span> <span className="font-bold">{room.floor || '-'}</span></p>
                <p><span className="text-ink-500">Capacity:</span> <span className="font-bold num">{room.capacity || '-'}</span> guests</p>
              </div>
            </section>

            <section className="rounded-2xl p-5 border border-ink-100 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center print:bg-white">
                  <FaCalendarAlt className="text-sky-600" size={12} />
                </div>
                <h2 className="text-3xs font-bold text-ink-500 uppercase tracking-widest">Stay</h2>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  ['Check-in', checkIn.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
                  ['Check-out', checkOut.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
                  ['Duration', isSameDay ? 'Day use' : `${nights} ${nights === 1 ? 'night' : 'nights'}`],
                  ['Guests', booking.number_of_guests || 1],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-ink-500">{label}</span>
                    <span className="font-bold text-ink-900 num">{value}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Guest */}
          <section className="mb-5 rounded-2xl p-5 border border-ink-100 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-sunset-50 border border-sunset-100 flex items-center justify-center print:bg-white">
                <FaUser className="text-sunset-600" size={12} />
              </div>
              <h2 className="text-3xs font-bold text-ink-500 uppercase tracking-widest">Guest information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ['Name', booking.guest_name || user.name || '-'],
                ['Phone', booking.guest_phone || user.phone || '-'],
                ['Email', booking.guest_email || user.email || '-'],
                ['Gender', user.gender || '-'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-ink-500">{label}</span>
                  <span className="font-bold text-ink-900 num text-right truncate">{value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Payment */}
          <section className="mb-5 rounded-2xl p-5 border-2 border-ink-900">
            <h2 className="text-3xs font-bold text-ink-500 uppercase tracking-widest mb-3">Payment summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-600">Room rate ({isSameDay ? 'day use' : `${nights} ${nights === 1 ? 'night' : 'nights'}`})</span>
                <span className="font-bold text-ink-900 num">₹{(booking.total_price || 0).toLocaleString()}</span>
              </div>
              {booking.discount_amount > 0 && (
                <div className="flex justify-between text-teal-700 font-semibold">
                  <span>Discount {booking.coupon_code ? `(${booking.coupon_code})` : ''}</span>
                  <span className="num">−₹{(booking.discount_amount || 0).toLocaleString()}</span>
                </div>
              )}
              <div className="border-t-2 border-ink-900 pt-3 mt-2 flex justify-between text-base">
                <span className="font-display font-black text-ink-900 uppercase tracking-wider">Total paid</span>
                <span className="font-display font-black text-ink-900 text-xl num">
                  ₹{(booking.final_price || booking.total_price || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1">
                <span className="text-ink-500">Payment method</span>
                <span className="font-bold text-ink-700 uppercase tracking-wider">{booking.payment_method || 'Online'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ink-500">Booking status</span>
                <span className={`font-bold uppercase tracking-wider ${booking.status === 'confirmed' ? 'text-teal-700' : 'text-amber-600'}`}>
                  {booking.status || 'pending'}
                </span>
              </div>
            </div>
          </section>

          {/* Aadhaar */}
          {aadhaar?.number && (
            <section className="mb-5 rounded-2xl p-5 border border-ink-100 bg-white">
              <h2 className="text-3xs font-bold text-ink-500 uppercase tracking-widest mb-3">Identity (Aadhaar)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-500">Aadhaar no</span>
                    <span className="font-bold text-ink-900 font-mono">
                      {aadhaar.number ? `${aadhaar.number.slice(0, 4)} ${aadhaar.number.slice(4, 8)} ${aadhaar.number.slice(8)}` : '-'}
                    </span>
                  </div>
                  {aadhaar.name && <div className="flex justify-between"><span className="text-ink-500">Name</span><span className="font-bold text-ink-900">{aadhaar.name}</span></div>}
                  {aadhaar.dob && <div className="flex justify-between"><span className="text-ink-500">DOB</span><span className="font-bold text-ink-900 num">{aadhaar.dob}</span></div>}
                  {aadhaar.gender && <div className="flex justify-between"><span className="text-ink-500">Gender</span><span className="font-bold text-ink-900">{aadhaar.gender}</span></div>}
                  {aadhaar.address && (
                    <div>
                      <span className="text-ink-500 text-xs">Address</span>
                      <p className="font-semibold text-ink-900 text-xs mt-0.5">{aadhaar.address}</p>
                    </div>
                  )}
                  <div className="flex justify-between pt-1">
                    <span className="text-ink-500">Verification</span>
                    <span className={`font-bold ${aadhaar.verified ? 'text-teal-700' : 'text-amber-600'}`}>
                      {aadhaar.verified ? '✓ Verified' : '⏳ Pending'}
                    </span>
                  </div>
                </div>
                {aadhaar.image_url && (
                  <div className="flex items-center justify-center">
                    <img src={aadhaar.image_url} alt="Aadhaar" className="max-h-40 rounded-lg border border-ink-200 object-contain" />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="mt-8 pt-6 border-t border-ink-100">
            <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
              <div className="flex items-center gap-2 text-ink-500">
                <FaShieldAlt size={10} className="text-teal-500" />
                <span>This document is computer-generated and does not require a signature.</span>
              </div>
              <div className="flex items-center gap-3">
                <a href="tel:07592905000" className="inline-flex items-center gap-1.5 font-bold text-teal-700 num">
                  <FaPhoneAlt size={9} /> 07592905000
                </a>
                <a href="https://wa.me/917592905000" className="inline-flex items-center gap-1.5 font-bold text-green-600">
                  <FaWhatsapp size={11} /> WhatsApp
                </a>
              </div>
            </div>
            <p className="text-3xs text-ink-400 text-center mt-4">
              © {new Date().getFullYear()} Zero One<span className="text-teal-500">.</span> · All rights reserved
            </p>
          </footer>
        </motion.article>
      </div>

      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white !important; }
          @page { size: A4; margin: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background-color: white !important; }
          .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:p-\\[15mm\\] { padding: 15mm !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          .print\\:bg-ink-900 { background-color: #0b1220 !important; }
          .print\\:bg-ink-100 { background-color: #eef2f6 !important; }
          .print\\:border-2 { border-width: 2px !important; }
          .print\\:border-ink-900 { border-color: #0b1220 !important; }
          .print\\:border-ink-200 { border-color: #e2e8f0 !important; }
        }
      `}</style>
    </>
  );
}
