import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../api/client';
import toast from 'react-hot-toast';
import { FaArrowLeft, FaPlus, FaTimes, FaCalendarAlt, FaLock } from 'react-icons/fa';

const STATUS_SURFACE = {
  available: 'room-available',
  booked:    'room-booked',
  blocked:   'room-blocked',
  partial:   'room-partial',
};

const STATUS_DOT = {
  available: 'bg-emerald-500',
  booked:    'bg-rose-500',
  blocked:   'bg-ink-300',
  partial:   'bg-amber-400',
};

const STATUS_LABEL_COLOR = {
  available: 'text-emerald-700',
  booked:    'text-rose-700',
  blocked:   'text-ink-500',
  partial:   'text-amber-500',
};

export default function AvailabilityCalendar() {
  const { propertyId } = useParams();
  const navigate = useNavigate();

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysOut = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(thirtyDaysOut);
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({ room_id: '', blocked_from: today, blocked_to: today, reason: '' });

  useEffect(() => { fetchCalendar(); /* eslint-disable-next-line */ }, [propertyId, fromDate, toDate]);

  async function fetchCalendar() {
    setLoading(true);
    try {
      const res = await apiClient.get(`/calendar/properties/${propertyId}?from_date=${fromDate}&to_date=${toDate}`);
      setCalendarData(res.data.data);
    } catch {
      toast.error('Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }

  async function blockDates() {
    try {
      await apiClient.post(`/calendar/properties/${propertyId}/block`, {
        ...blockForm,
        room_id: blockForm.room_id || null,
      });
      toast.success('Dates blocked');
      setShowBlockModal(false);
      fetchCalendar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to block dates');
    }
  }

  async function unblock(blockId) {
    if (!window.confirm('Unblock these dates?')) return;
    try {
      await apiClient.delete(`/calendar/block/${blockId}`);
      toast.success('Dates unblocked');
      fetchCalendar();
    } catch {
      toast.error('Failed to unblock');
    }
  }

  if (loading && !calendarData) return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-white/95 backdrop-blur border-b border-ink-100 sticky top-0 z-30">
        <div className="page-container h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="h-4 w-40 shimmer rounded" />
          <div className="h-8 w-28 shimmer rounded-lg" />
        </div>
      </header>
      <div className="page-container py-6 space-y-4">
        <div className="surface p-4 flex flex-wrap gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}><div className="h-3 w-12 shimmer mb-2 rounded" /><div className="h-9 w-36 shimmer rounded-lg" /></div>
          ))}
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer rounded-xl h-20" />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-white/95 backdrop-blur border-b border-ink-100 sticky top-0 z-30 shadow-sm">
        <div className="page-wide h-16 sm:h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="h-10 w-10 rounded-full bg-ink-100 hover:bg-teal-50 text-ink-700 hover:text-teal-700 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <FaArrowLeft size={12} />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #ecfeff, #f0f9ff)', border: '1px solid #cffafe' }}
              >
                <FaCalendarAlt className="text-teal-600" size={14} />
              </div>
              <div className="min-w-0">
                <span className="section-eyebrow">Calendar</span>
                <p className="font-display font-bold text-ink-900 text-base sm:text-lg truncate">
                  {calendarData?.property?.name || 'Availability'}
                </p>
              </div>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowBlockModal(true)} className="btn btn-primary text-xs sm:text-sm"
          >
            <FaLock size={10} />
            <span className="hidden sm:inline">Block dates</span>
            <span className="sm:hidden">Block</span>
          </motion.button>
        </div>
      </header>

      <div className="page-container py-5 sm:py-6 space-y-4 sm:space-y-5">
        {/* Date range + legend */}
        <div className="surface p-4 sm:p-5 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-2xs font-semibold text-ink-500 mb-1.5 tracking-[0.1em] uppercase">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="input-base num py-2" style={{ width: '10rem' }} />
          </div>
          <div>
            <label className="block text-2xs font-semibold text-ink-500 mb-1.5 tracking-[0.1em] uppercase">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="input-base num py-2" style={{ width: '10rem' }} />
          </div>
          <button onClick={fetchCalendar} className="btn btn-outline text-sm">
            {loading && <span className="spinner" />}
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <div className="flex flex-wrap gap-3 sm:gap-4 sm:ml-auto">
            {['available', 'booked', 'partial', 'blocked'].map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
                <span className="text-xs text-ink-500 capitalize">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Room grid */}
        {calendarData?.rooms?.length > 0 ? (
          <div className="grid gap-3">
            {calendarData.rooms.map(({ room, overall_status, date_status, active_bookings }, i) => {
              const isSelected = selectedRoom?.id === room.id;
              return (
                <motion.div key={room.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.35 }}
                  whileHover={{ y: -2 }}
                  className={`border rounded-2xl p-4 cursor-pointer transition-all ${STATUS_SURFACE[overall_status] || 'surface'} ${isSelected ? 'ring-2 ring-teal-500 shadow-md' : 'hover:shadow-md'}`}
                  onClick={() => setSelectedRoom(isSelected ? null : { ...room, active_bookings, date_status })}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-ink-900 text-base">Room {room.room_number}</p>
                      <p className="text-xs text-ink-500 mt-0.5 truncate">
                        {room.floor} · {room.room_type}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[overall_status]}`} />
                      <span className={`text-xs font-semibold capitalize ${STATUS_LABEL_COLOR[overall_status] || 'text-ink-700'}`}>
                        {overall_status}
                      </span>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-2">
                          {active_bookings.length > 0 ? active_bookings.map(b => (
                            <div key={b.id} className="bg-white border border-ink-100 rounded-xl p-3 shadow-sm">
                              <p className="text-sm font-bold text-ink-900">{b.guest_name}</p>
                              <p className="text-xs text-ink-500 num mt-0.5">
                                {b.check_in?.slice(0, 10)} → {b.check_out?.slice(0, 10)}
                              </p>
                            </div>
                          )) : (
                            <p className="text-sm text-ink-500 italic">No active bookings in this range</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="surface p-10 text-center">
            <p className="text-ink-400 text-sm">No rooms found for this property</p>
          </div>
        )}

        {/* Blocked date ranges */}
        {calendarData?.blocked_dates?.length > 0 && (
          <div className="surface overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-ink-100 flex items-center gap-2">
              <span className="section-eyebrow">Blocked ranges</span>
            </div>
            <div className="divide-y divide-ink-100">
              {calendarData.blocked_dates.map(b => (
                <div key={b.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900 num">
                      {b.blocked_from} → {b.blocked_to}
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5 truncate">
                      {b.room_id ? 'Room specific' : 'Entire property'}{b.reason && ` · ${b.reason}`}
                    </p>
                  </div>
                  <button onClick={() => unblock(b.id)} className="btn btn-ghost text-xs text-ink-600 hover:text-rose-700">
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Block modal */}
      {showBlockModal && (
        <div className="modal-backdrop" onClick={() => setShowBlockModal(false)}>
          <div className="modal-content p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <span className="section-eyebrow">New block</span>
                <h3 className="font-display text-lg font-bold text-ink-900 mt-1.5">Block dates</h3>
              </div>
              <button onClick={() => setShowBlockModal(false)} className="btn btn-ghost px-2 py-2 -mr-2 -mt-1">
                <FaTimes size={13} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-2xs font-semibold text-ink-500 mb-1.5 tracking-[0.1em] uppercase">Room</label>
                <select value={blockForm.room_id}
                  onChange={e => setBlockForm(p => ({ ...p, room_id: e.target.value }))}
                  className="input-base">
                  <option value="">All rooms (entire property)</option>
                  {calendarData?.rooms?.map(({ room }) => (
                    <option key={room.id} value={room.id}>Room {room.room_number} ({room.floor})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-ink-500 mb-1.5 tracking-[0.1em] uppercase">From *</label>
                  <input type="date" value={blockForm.blocked_from}
                    onChange={e => setBlockForm(p => ({ ...p, blocked_from: e.target.value }))}
                    className="input-base num" />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-ink-500 mb-1.5 tracking-[0.1em] uppercase">To *</label>
                  <input type="date" value={blockForm.blocked_to}
                    onChange={e => setBlockForm(p => ({ ...p, blocked_to: e.target.value }))}
                    className="input-base num" />
                </div>
              </div>
              <div>
                <label className="block text-2xs font-semibold text-ink-500 mb-1.5 tracking-[0.1em] uppercase">Reason</label>
                <input value={blockForm.reason}
                  onChange={e => setBlockForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g. Renovation, maintenance"
                  className="input-base" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowBlockModal(false)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={blockDates} className="btn btn-primary flex-1">Block dates</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
