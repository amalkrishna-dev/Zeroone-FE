import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../api/client';
import toast from 'react-hot-toast';
import Sk from '../components/Skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  FaArrowLeft, FaChartBar, FaDownload, FaFileAlt, FaFilter,
  FaRupeeSign, FaHotel, FaUserCheck, FaExclamationCircle,
} from 'react-icons/fa';

export default function ReportsDashboard() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [revenueData, setRevenueData] = useState(null);
  const [occupancyData, setOccupancyData] = useState(null);
  const [guestRegister, setGuestRegister] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeReport, setActiveReport] = useState('revenue');

  useEffect(() => {
    apiClient.get('/properties').then(res => setProperties(res.data.data || [])).catch(() => {});
  }, []);

  async function fetchReports() {
    if (!selectedProperty) { toast.error('Please select a property'); return; }
    setLoading(true);
    try {
      const params = `property_id=${selectedProperty}&from_date=${fromDate}&to_date=${toDate}`;
      const [revRes, occRes, regRes] = await Promise.all([
        apiClient.get(`/reports/revenue?${params}`),
        apiClient.get(`/reports/occupancy?${params}`),
        apiClient.get(`/reports/guest-register?${params}`),
      ]);
      setRevenueData(revRes.data.data);
      setOccupancyData(occRes.data.data);
      setGuestRegister(regRes.data.data || []);
    } catch { toast.error('Failed to fetch reports'); }
    finally { setLoading(false); }
  }

  async function exportCSV() {
    try {
      const params = `property_id=${selectedProperty}&from_date=${fromDate}&to_date=${toDate}`;
      const res = await apiClient.get(`/reports/bookings-export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookings_${fromDate}_${toDate}.csv`;
      a.click();
    } catch { toast.error('Export failed'); }
  }

  async function runPaymentTimeoutCheck() {
    try {
      const res = await apiClient.post('/reports/payment-timeout-check');
      toast.success(res.data.message);
    } catch { toast.error('Failed to run check'); }
  }

  const REPORT_TABS = [
    { id: 'revenue',   label: 'Revenue',        icon: FaRupeeSign },
    { id: 'occupancy', label: 'Occupancy',      icon: FaHotel },
    { id: 'register',  label: 'Guest register', icon: FaUserCheck },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
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
                <FaChartBar className="text-teal-600" size={14} />
              </div>
              <div className="min-w-0">
                <span className="section-eyebrow">Reports</span>
                <p className="font-display font-bold text-ink-900 text-base sm:text-lg truncate">Analytics & exports</p>
              </div>
            </div>
          </div>
          <button
            onClick={runPaymentTimeoutCheck}
            className="hidden sm:block text-xs font-bold text-ink-500 hover:text-teal-700 transition-colors"
          >
            Run timeout check
          </button>
        </div>
      </header>

      <div className="page-wide py-6 sm:py-8 space-y-6">
        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="surface-elev p-5 surface-accent"
        >
          <div className="flex items-center gap-2 mb-4">
            <FaFilter className="text-teal-500" size={11} />
            <p className="text-3xs font-bold text-ink-500 uppercase tracking-widest">Generate report</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Property</label>
              <select
                value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}
                className="input-base"
              >
                <option value="">Select property…</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">From</label>
              <input
                type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="input-base num"
              />
            </div>
            <div>
              <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">To</label>
              <input
                type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="input-base num"
              />
            </div>
            <div className="flex items-end gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={fetchReports} disabled={loading}
                className="btn btn-primary flex-1"
              >
                {loading ? <span className="spinner" /> : null}
                {loading ? 'Loading…' : 'Generate'}
              </motion.button>
              {revenueData && (
                <button onClick={exportCSV} className="btn btn-outline" title="Export CSV">
                  <FaDownload size={11} />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="surface p-5">
                  <Sk className="h-4 w-24 mb-3 rounded" />
                  <Sk className="h-8 w-20 rounded" />
                </div>
              ))}
            </div>
            <Sk className="h-64 rounded-2xl" />
          </div>
        )}

        {!loading && revenueData && (
          <>
            {/* Report tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {REPORT_TABS.map(r => {
                const Icon = r.icon;
                const active = activeReport === r.id;
                return (
                  <motion.button
                    key={r.id}
                    onClick={() => setActiveReport(r.id)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    className="relative px-4 py-2.5 rounded-full text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-2 flex-shrink-0"
                    style={{
                      background: active ? 'transparent' : 'white',
                      color: active ? '#fff' : 'var(--ink-600)',
                      border: active ? '1px solid transparent' : '1px solid var(--ink-200)',
                    }}
                  >
                    {active && (
                      <motion.div
                        layoutId="report-tab-bg"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                          boxShadow: '0 4px 14px -2px rgba(6,182,212,0.4)',
                        }}
                      />
                    )}
                    <Icon size={11} className="relative z-10" />
                    <span className="relative z-10">{r.label}</span>
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {/* Revenue */}
              {activeReport === 'revenue' && (
                <motion.div
                  key="revenue"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Total revenue', value: `₹${revenueData.total_revenue?.toLocaleString()}`, color: 'teal' },
                      { label: 'Confirmed bookings', value: revenueData.confirmed_bookings, color: 'sky' },
                      { label: 'Avg booking value', value: `₹${revenueData.average_booking_value?.toLocaleString()}`, color: 'sunset' },
                      { label: 'Discount given', value: `₹${revenueData.total_discount_given?.toLocaleString()}`, color: 'amber' },
                    ].map((card, i) => (
                      <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.3 }}
                        className="stat-card"
                      >
                        <p className="text-3xs text-ink-500 font-bold uppercase tracking-widest mb-2">{card.label}</p>
                        <p className="stat-number">{card.value}</p>
                      </motion.div>
                    ))}
                  </div>
                  <div className="surface p-5 sm:p-6">
                    <h3 className="font-display font-bold text-ink-900 text-base mb-4">Daily revenue</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={revenueData.daily || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={v => `₹${v.toLocaleString()}`}
                          contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12, boxShadow: '0 8px 24px -8px rgba(15,23,42,0.12)' }}
                        />
                        <Bar dataKey="revenue" fill="url(#revGrad)" radius={[8, 8, 0, 0]} />
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#06b6d4" />
                            <stop offset="1" stopColor="#0891b2" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}

              {/* Occupancy */}
              {activeReport === 'occupancy' && occupancyData && (
                <motion.div
                  key="occupancy"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Occupancy rate', value: `${occupancyData.occupancy_rate}%` },
                      { label: 'Booked nights', value: occupancyData.booked_room_nights },
                      { label: 'Total room nights', value: occupancyData.total_room_nights },
                    ].map((card, i) => (
                      <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.3 }}
                        className="stat-card"
                      >
                        <p className="text-3xs text-ink-500 font-bold uppercase tracking-widest mb-2">{card.label}</p>
                        <p className="stat-number">{card.value}</p>
                      </motion.div>
                    ))}
                  </div>
                  <div className="surface overflow-hidden">
                    <div className="px-5 py-4 border-b border-ink-100">
                      <h3 className="font-display font-bold text-ink-900 text-base">Room-level occupancy</h3>
                    </div>
                    <div className="divide-y divide-ink-100">
                      {(occupancyData.room_breakdown || []).map((r, i) => (
                        <motion.div
                          key={r.room_id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="px-5 py-3.5 flex items-center justify-between hover:bg-ink-50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-bold text-ink-900">Room <span className="num">{r.room_number}</span></p>
                            <p className="text-xs text-ink-500">{r.floor}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-20 sm:w-24 h-2 bg-ink-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${r.occupancy_rate}%` }}
                                transition={{ delay: 0.2 + i * 0.04, duration: 0.6, ease: 'easeOut' }}
                                className="h-full"
                                style={{ background: 'linear-gradient(90deg, #06b6d4, #0891b2)' }}
                              />
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-ink-900 num">{r.occupancy_rate}%</p>
                              <p className="text-2xs text-ink-500 num">{r.booked_nights}/{r.total_nights}</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Guest register */}
              {activeReport === 'register' && (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="surface overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-ink-100 flex justify-between items-center flex-wrap gap-2">
                    <h3 className="font-display font-bold text-ink-900 text-base">
                      Guest register
                      <span className="text-ink-500 font-medium ml-2 num">({guestRegister.length})</span>
                    </h3>
                    {guestRegister.some(e => e.frro_form_c_required) && (
                      <span className="pill pill-danger">
                        <FaExclamationCircle size={9} />
                        {guestRegister.filter(e => e.frro_form_c_required).length} FRRO Form-C required
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-ink-100">
                    {guestRegister.map((entry, i) => (
                      <motion.div
                        key={entry.booking_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                        className={`px-5 py-4 ${entry.frro_form_c_required ? 'border-l-4 border-l-red-500 bg-red-50/40' : 'hover:bg-ink-50 transition-colors'}`}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm font-bold text-ink-900">{entry.guest.name}</p>
                            <p className="text-xs text-ink-500">{entry.guest.phone} · {entry.guest.email}</p>
                            <p className="text-xs text-ink-500 mt-0.5">
                              Nationality: <span className="font-bold text-ink-900">{entry.guest.nationality || 'Indian'}</span>
                              {entry.guest.is_foreign_national && entry.guest.passport_number && (
                                <> · Passport <span className="font-mono font-bold">{entry.guest.passport_number}</span></>
                              )}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`pill ${entry.guest.aadhaar_verified ? 'pill-success' : 'pill-amber'}`}>
                              {entry.guest.aadhaar_verified ? 'KYC ✓' : 'KYC Pending'}
                            </span>
                            {entry.frro_form_c_required && (
                              <span className="pill pill-danger">FRRO Form-C</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-ink-500 flex flex-wrap gap-3">
                          <span className="inline-flex items-center gap-1">🏠 {entry.property.name} · Room <span className="num font-bold">{entry.room.number}</span></span>
                          <span className="inline-flex items-center gap-1">📅 {entry.check_in?.slice(0, 10)} → {entry.check_out?.slice(0, 10)}</span>
                          <span className="inline-flex items-center gap-1 font-bold text-ink-900 num">💳 ₹{entry.amount?.toLocaleString()}</span>
                          <span>· {entry.payment_method}</span>
                        </div>
                        {entry.coguests?.length > 0 && (
                          <p className="text-xs text-ink-400 mt-1.5">
                            Co-guests: {entry.coguests.map(c =>
                              c.is_foreign_national ? `${c.name} (${c.nationality})` : c.name
                            ).join(', ')}
                          </p>
                        )}
                      </motion.div>
                    ))}
                    {guestRegister.length === 0 && (
                      <div className="px-5 py-12 text-center text-ink-400">
                        <FaFileAlt size={28} className="mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No bookings in this date range</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {!loading && !revenueData && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="surface p-12 text-center border-dashed"
          >
            <div className="text-5xl mb-3">📊</div>
            <h3 className="font-display font-bold text-ink-900 text-lg mb-1">Ready when you are</h3>
            <p className="text-ink-500 text-sm">Choose a property and date range, then hit Generate.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
