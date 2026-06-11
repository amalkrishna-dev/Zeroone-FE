import React, { useState, useEffect, useCallback } from 'react';
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
  FaBalanceScale, FaReceipt, FaIdCard, FaSearch, FaPlus, FaTrash,
  FaFileInvoiceDollar, FaBan, FaTimes,
} from 'react-icons/fa';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const EXPENSE_CATEGORIES = [
  'maintenance', 'salary', 'supplies', 'utilities',
  'ota_payout', 'marketing', 'rent', 'other',
];
const PAYMENT_MODES = ['cash', 'card', 'upi', 'bank', 'other'];
const REFUND_METHODS = ['razorpay', 'cash', 'card', 'upi', 'bank', 'other'];

const EMPTY_EXPENSE = {
  category: 'maintenance', amount: '', description: '',
  paid_to: '', payment_mode: 'cash', reference_no: '',
  expense_date: new Date().toISOString().slice(0, 10),
};

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
  const [financeSummary, setFinanceSummary] = useState(null);
  const [financeBookings, setFinanceBookings] = useState([]);
  const [financeSearch, setFinanceSearch] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE);
  const [savingExpense, setSavingExpense] = useState(false);
  const [grcDate, setGrcDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [activeReport, setActiveReport] = useState('revenue');
  const [refundData, setRefundData] = useState({ refunds: [], cancellations: [], total_refunded: 0 });
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelForm, setCancelForm] = useState({ reason: '', refund_amount: '', refund_method: 'razorpay' });
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    apiClient.get('/properties').then(res => setProperties(res.data.data || [])).catch(() => {});
  }, []);

  const params = useCallback(
    () => `property_id=${selectedProperty}&from_date=${fromDate}&to_date=${toDate}`,
    [selectedProperty, fromDate, toDate],
  );

  const loadFinanceBookings = useCallback(async (search = '') => {
    try {
      const res = await apiClient.get(`/finance/bookings?${params()}&search=${encodeURIComponent(search)}`);
      setFinanceBookings(res.data.data || []);
    } catch { /* finance perms may be absent */ }
  }, [params]);

  const loadExpenses = useCallback(async (search = '') => {
    try {
      const res = await apiClient.get(`/finance/expenses?${params()}&search=${encodeURIComponent(search)}`);
      setExpenses(res.data.data || []);
      setExpenseTotal(res.data.total_amount || 0);
    } catch { /* finance perms may be absent */ }
  }, [params]);

  const loadRefunds = useCallback(async () => {
    try {
      const res = await apiClient.get(`/finance/refunds?${params()}`);
      setRefundData(res.data.data || { refunds: [], cancellations: [], total_refunded: 0 });
    } catch { /* finance perms may be absent */ }
  }, [params]);

  const refreshFinance = useCallback(() => {
    apiClient.get(`/finance/summary?${params()}`).then(r => setFinanceSummary(r.data.data)).catch(() => {});
    loadFinanceBookings(financeSearch);
    loadRefunds();
  }, [params, loadFinanceBookings, loadRefunds, financeSearch]);

  async function fetchReports() {
    if (!selectedProperty) { toast.error('Please select a property'); return; }
    setLoading(true);
    try {
      const p = params();
      const [revRes, occRes, regRes] = await Promise.all([
        apiClient.get(`/reports/revenue?${p}`),
        apiClient.get(`/reports/occupancy?${p}`),
        apiClient.get(`/reports/guest-register?${p}`),
      ]);
      setRevenueData(revRes.data.data);
      setOccupancyData(occRes.data.data);
      setGuestRegister(regRes.data.data || []);
      // Finance + expenses are best-effort (require finance_view).
      apiClient.get(`/finance/summary?${p}`).then(r => setFinanceSummary(r.data.data)).catch(() => setFinanceSummary(null));
      loadFinanceBookings('');
      loadExpenses('');
      loadRefunds();
    } catch { toast.error('Failed to fetch reports'); }
    finally { setLoading(false); }
  }

  async function downloadBlob(url, filename) {
    const res = await apiClient.get(url, { responseType: 'blob' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(new Blob([res.data]));
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function exportCSV() {
    try { await downloadBlob(`/reports/bookings-export?${params()}`, `bookings_${fromDate}_${toDate}.csv`); }
    catch { toast.error('Export failed'); }
  }

  async function exportExpenses() {
    try { await downloadBlob(`/finance/expenses/export?${params()}`, `expenses_${fromDate}_${toDate}.csv`); }
    catch { toast.error('Export failed'); }
  }

  async function exportRefunds() {
    try { await downloadBlob(`/finance/refunds/export?${params()}`, `refunds_${fromDate}_${toDate}.csv`); }
    catch { toast.error('Export failed'); }
  }

  async function downloadInvoice(bookingId) {
    try {
      await downloadBlob(`/finance/bookings/${bookingId}/invoice`, `invoice_${bookingId.slice(0, 8)}.pdf`);
      toast.success('Invoice downloaded');
    } catch { toast.error('Failed to generate invoice'); }
  }

  function openCancel(row) {
    setCancelForm({ reason: '', refund_amount: '', refund_method: 'razorpay' });
    setCancelTarget(row);
  }

  async function submitCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await apiClient.post(`/finance/bookings/${cancelTarget.booking_id}/cancel`, {
        reason: cancelForm.reason,
        refund_amount: cancelForm.refund_amount ? Number(cancelForm.refund_amount) : 0,
        refund_method: cancelForm.refund_method,
      });
      toast.success('Booking cancelled');
      setCancelTarget(null);
      refreshFinance();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to cancel booking');
    } finally { setCancelling(false); }
  }

  async function downloadGRC() {
    if (!selectedProperty) { toast.error('Select a property first'); return; }
    try {
      await downloadBlob(`/reports/grc-daily?property_id=${selectedProperty}&date=${grcDate}`,
        `grc_${grcDate}.pdf`);
      toast.success('GRC report downloaded');
    } catch { toast.error('Failed to download GRC report'); }
  }

  async function addExpense(e) {
    e.preventDefault();
    if (!expenseForm.amount || Number(expenseForm.amount) < 0) { toast.error('Enter a valid amount'); return; }
    setSavingExpense(true);
    try {
      await apiClient.post('/finance/expenses', {
        ...expenseForm,
        amount: Number(expenseForm.amount),
        property_id: selectedProperty || null,
      });
      toast.success('Expense recorded');
      setExpenseForm({ ...EMPTY_EXPENSE });
      await loadExpenses(expenseSearch);
      apiClient.get(`/finance/summary?${params()}`).then(r => setFinanceSummary(r.data.data)).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record expense');
    } finally { setSavingExpense(false); }
  }

  async function deleteExpense(id) {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await apiClient.delete(`/finance/expenses/${id}`);
      toast.success('Expense deleted');
      await loadExpenses(expenseSearch);
      apiClient.get(`/finance/summary?${params()}`).then(r => setFinanceSummary(r.data.data)).catch(() => {});
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  }

  async function runPaymentTimeoutCheck() {
    try {
      const res = await apiClient.post('/reports/payment-timeout-check');
      toast.success(res.data.message);
    } catch { toast.error('Failed to run check'); }
  }

  const REPORT_TABS = [
    { id: 'revenue',   label: 'Revenue',        icon: FaRupeeSign },
    { id: 'finance',   label: 'Finance',        icon: FaBalanceScale },
    { id: 'expenses',  label: 'Expenses',       icon: FaReceipt },
    { id: 'occupancy', label: 'Occupancy',      icon: FaHotel },
    { id: 'register',  label: 'Guest register', icon: FaUserCheck },
    { id: 'grc',       label: 'GRC report',     icon: FaIdCard },
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
                <p className="font-display font-bold text-ink-900 text-base sm:text-lg truncate">Analytics, finance & exports</p>
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
                <button onClick={exportCSV} className="btn btn-outline" title="Export bookings CSV">
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
                      { label: 'Total revenue', value: money(revenueData.total_revenue) },
                      { label: 'Confirmed bookings', value: revenueData.confirmed_bookings },
                      { label: 'Avg booking value', value: money(revenueData.average_booking_value) },
                      { label: 'Discount given', value: money(revenueData.total_discount_given) },
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
                          formatter={v => money(v)}
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

              {/* Finance - 3-way split + balance */}
              {activeReport === 'finance' && (
                <motion.div
                  key="finance"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {!financeSummary ? (
                    <div className="surface p-8 text-center text-ink-400 text-sm">
                      Finance data unavailable — you may not have finance access for this property.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {[
                          { label: 'Total to collect', value: money(financeSummary.total_to_collect) },
                          { label: 'Net received', value: money(financeSummary.net_received) },
                          { label: 'OTA commission', value: money(financeSummary.ota_commission) },
                          { label: 'GST', value: money(financeSummary.gst) },
                          { label: 'Expenses', value: money(financeSummary.total_expenses) },
                          { label: 'Net profit', value: money(financeSummary.balance), accent: true },
                          { label: 'ADR', value: money(financeSummary.kpis?.adr) },
                          { label: 'Room nights', value: financeSummary.kpis?.room_nights ?? 0 },
                        ].map((card, i) => (
                          <motion.div
                            key={card.label}
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.3 }}
                            className="stat-card"
                            style={card.accent ? { background: 'linear-gradient(135deg,#ecfeff,#f0f9ff)', borderColor: '#cffafe' } : undefined}
                          >
                            <p className="text-3xs text-ink-500 font-bold uppercase tracking-widest mb-2">{card.label}</p>
                            <p className="stat-number" style={card.accent ? { color: '#0891b2' } : undefined}>{card.value}</p>
                          </motion.div>
                        ))}
                      </div>

                      {/* ── Revenue recognition: earned vs unearned ── */}
                      {financeSummary.revenue_recognition && (
                        <div className="surface p-5 sm:p-6">
                          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <div>
                              <h3 className="font-display font-bold text-ink-900 text-base">Revenue recognition</h3>
                              <p className="text-2xs text-ink-400 mt-0.5">Earned as nights are consumed; cash taken for future nights stays a liability.</p>
                            </div>
                            <span className="pill">as of {financeSummary.revenue_recognition.as_of}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="rounded-2xl p-5 border" style={{ background: 'linear-gradient(135deg,#ecfdf5,#f0fdfa)', borderColor: '#a7f3d0' }}>
                              <p className="text-3xs font-bold uppercase tracking-widest text-emerald-700 mb-1.5">Earned revenue</p>
                              <p className="stat-number" style={{ color: '#047857' }}>{money(financeSummary.revenue_recognition.earned)}</p>
                              <p className="text-2xs text-emerald-700/70 mt-1.5">Recognised — value of nights already stayed.</p>
                            </div>
                            <div className="rounded-2xl p-5 border" style={{ background: 'linear-gradient(135deg,#fffbeb,#fff7ed)', borderColor: '#fde68a' }}>
                              <p className="text-3xs font-bold uppercase tracking-widest text-amber-700 mb-1.5">Unearned revenue</p>
                              <p className="stat-number" style={{ color: '#b45309' }}>{money(financeSummary.revenue_recognition.unearned)}</p>
                              <p className="text-2xs text-amber-700/70 mt-1.5">Deferred liability — collected in advance, not yet earned.</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
                            {[
                              { label: 'Receivable', value: financeSummary.revenue_recognition.receivable, hint: 'Stayed, not collected' },
                              { label: 'Cash collected', value: financeSummary.revenue_recognition.collected, hint: 'Received, net of refunds' },
                              { label: 'Pipeline', value: financeSummary.revenue_recognition.pipeline, hint: 'Future, unpaid' },
                              { label: 'Refunds', value: financeSummary.revenue_recognition.refunds, hint: 'Returned to guests', neg: true },
                              { label: 'Cancellation income', value: financeSummary.revenue_recognition.cancellation_income, hint: 'Fees retained' },
                            ].map(c => (
                              <div key={c.label} className="rounded-xl border border-ink-100 p-3 bg-white">
                                <p className="text-3xs font-bold uppercase tracking-widest text-ink-500 mb-1">{c.label}</p>
                                <p className={`font-bold num text-sm sm:text-base ${c.neg && c.value ? 'text-red-600' : 'text-ink-900'}`}>{c.neg && c.value ? '−' : ''}{money(c.value)}</p>
                                <p className="text-2xs text-ink-400 mt-0.5 hidden sm:block">{c.hint}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── P&L + collections + mix ── */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {financeSummary.profit_loss && (
                          <div className="surface p-5">
                            <h3 className="font-display font-bold text-ink-900 text-base mb-4">Profit &amp; Loss</h3>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-ink-600 font-semibold">Revenue (net of commission)</span>
                                <span className="font-bold text-ink-900 num">{money(financeSummary.profit_loss.revenue)}</span>
                              </div>
                              {financeSummary.profit_loss.refunds > 0 && (
                                <div className="flex justify-between text-ink-500">
                                  <span>− Refunds</span>
                                  <span className="num text-red-600">−{money(financeSummary.profit_loss.refunds)}</span>
                                </div>
                              )}
                              {(financeSummary.profit_loss.expenses_by_category || []).map(c => (
                                <div key={c.category} className="flex justify-between text-ink-500 pl-3">
                                  <span className="capitalize">− {c.category}</span>
                                  <span className="num">{money(c.amount)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between border-t border-ink-100 pt-2">
                                <span className="text-ink-600 font-semibold">Total expenses</span>
                                <span className="font-bold text-red-600 num">−{money(financeSummary.profit_loss.expenses)}</span>
                              </div>
                              <div className="flex justify-between border-t-2 border-ink-200 pt-2 items-baseline">
                                <span className="text-ink-900 font-bold">Net profit</span>
                                <span className="font-black num text-lg" style={{ color: financeSummary.profit_loss.net_profit >= 0 ? '#0891b2' : '#dc2626' }}>
                                  {money(financeSummary.profit_loss.net_profit)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-ink-400 text-xs">Profit margin</span>
                                <span className="text-xs font-bold text-ink-500 num">{financeSummary.profit_loss.margin_pct}%</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-4">
                          {financeSummary.payment_breakdown && financeSummary.payment_breakdown.length > 0 && (
                            <div className="surface p-5">
                              <h3 className="font-display font-bold text-ink-900 text-base mb-3">Collections by mode</h3>
                              <div className="space-y-2">
                                {financeSummary.payment_breakdown.map(p => (
                                  <div key={p.method} className="flex items-center justify-between text-sm">
                                    <span className="capitalize text-ink-600">{p.method}<span className="text-ink-400 text-2xs num ml-1">×{p.count}</span></span>
                                    <span className="font-bold text-ink-900 num">{money(p.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {financeSummary.revenue_mix && (() => {
                            const o = financeSummary.revenue_mix.ota_revenue || 0;
                            const d = financeSummary.revenue_mix.direct_revenue || 0;
                            const tot = o + d;
                            const op = tot ? Math.round((o / tot) * 100) : 0;
                            return (
                              <div className="surface p-5">
                                <h3 className="font-display font-bold text-ink-900 text-base mb-3">Revenue mix</h3>
                                <div className="flex h-3 rounded-full overflow-hidden bg-ink-100 mb-3">
                                  <div style={{ width: `${op}%`, background: '#f59e0b' }} />
                                  <div style={{ width: `${100 - op}%`, background: '#0891b2' }} />
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-amber-600 font-semibold">OTA {money(o)}<span className="text-2xs text-ink-400 num ml-1">({financeSummary.revenue_mix.ota_bookings})</span></span>
                                  <span className="text-teal-700 font-semibold">Direct {money(d)}<span className="text-2xs text-ink-400 num ml-1">({financeSummary.revenue_mix.direct_bookings})</span></span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="surface overflow-hidden">
                        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-2 flex-wrap">
                          <h3 className="font-display font-bold text-ink-900 text-base">
                            Per-booking split
                            <span className="text-ink-500 font-medium ml-2 num">({financeBookings.length})</span>
                          </h3>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <FaSearch size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                              <input
                                value={financeSearch}
                                onChange={e => setFinanceSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && loadFinanceBookings(financeSearch)}
                                placeholder="Search guest, room, OTA…"
                                className="input-base pl-8 py-1.5 text-sm w-56"
                              />
                            </div>
                            <button onClick={() => loadFinanceBookings(financeSearch)} className="btn btn-outline py-1.5">Search</button>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-3xs uppercase tracking-widest text-ink-500 border-b border-ink-100">
                                {['Guest', 'Room', 'Source', 'Check-in', 'Total', 'Commission', 'GST', 'Net', 'Actions'].map(h => (
                                  <th key={h} className="px-4 py-2.5 font-bold whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-ink-100">
                              {financeBookings.map(b => (
                                <tr key={b.booking_id} className="hover:bg-ink-50">
                                  <td className="px-4 py-3">
                                    <p className="font-semibold text-ink-900">{b.guest_name || '—'}</p>
                                    <p className="text-2xs text-ink-400">{b.property_name}</p>
                                  </td>
                                  <td className="px-4 py-3 num">{b.room_number || '—'}</td>
                                  <td className="px-4 py-3">
                                    <span className={`pill ${b.source === 'OTA' ? 'pill-amber' : 'pill-success'}`}>
                                      {b.source === 'OTA' ? (b.ota_source || 'OTA') : 'Direct'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 num text-ink-500">{b.check_in}</td>
                                  <td className="px-4 py-3 num font-bold text-ink-900">{money(b.total_to_collect)}</td>
                                  <td className="px-4 py-3 num text-amber-600">{money(b.ota_commission)}</td>
                                  <td className="px-4 py-3 num text-ink-500">{money(b.gst)}</td>
                                  <td className="px-4 py-3 num font-bold text-teal-700">{money(b.net_received)}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                      <button onClick={() => downloadInvoice(b.booking_id)} title="GST tax invoice"
                                        className="h-7 w-7 rounded-lg bg-ink-50 hover:bg-teal-50 text-ink-500 hover:text-teal-700 flex items-center justify-center transition-colors">
                                        <FaFileInvoiceDollar size={11} />
                                      </button>
                                      {b.status === 'cancelled' ? (
                                        <span className="pill pill-danger text-2xs">Cancelled</span>
                                      ) : (
                                        <button onClick={() => openCancel(b)} title="Cancel booking"
                                          className="h-7 w-7 rounded-lg bg-ink-50 hover:bg-red-50 text-ink-500 hover:text-red-600 flex items-center justify-center transition-colors">
                                          <FaBan size={11} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {financeBookings.length === 0 && (
                                <tr><td colSpan={9} className="px-4 py-10 text-center text-ink-400">No bookings match.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* ── Refunds & cancellations ledger ── */}
                      <div className="surface overflow-hidden">
                        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-2 flex-wrap">
                          <h3 className="font-display font-bold text-ink-900 text-base">
                            Refunds &amp; cancellations
                            <span className="text-ink-500 font-medium ml-2 num">· {money(refundData.total_refunded)} refunded</span>
                          </h3>
                          <button onClick={exportRefunds} className="btn btn-outline py-1.5" title="Export refunds CSV"><FaDownload size={11} /></button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-3xs uppercase tracking-widest text-ink-500 border-b border-ink-100">
                                {['Date', 'Booking', 'Guest', 'Amount', 'Method', 'Status', 'Reason'].map(h => (
                                  <th key={h} className="px-4 py-2.5 font-bold whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-ink-100">
                              {(refundData.refunds || []).map(r => (
                                <tr key={r.id} className="hover:bg-ink-50">
                                  <td className="px-4 py-3 num text-ink-500 whitespace-nowrap">{r.refund_date}</td>
                                  <td className="px-4 py-3 num text-ink-500">{r.booking_ref}</td>
                                  <td className="px-4 py-3 text-ink-700">{r.guest_name || '—'}</td>
                                  <td className="px-4 py-3 num font-bold text-red-600">−{money(r.amount)}</td>
                                  <td className="px-4 py-3 capitalize text-ink-500">{r.refund_method || '—'}</td>
                                  <td className="px-4 py-3">
                                    <span className={`pill capitalize ${r.status === 'completed' ? 'pill-success' : r.status === 'pending' ? 'pill-amber' : 'pill-danger'}`}>{r.status}</span>
                                  </td>
                                  <td className="px-4 py-3 text-ink-500">{r.reason || '—'}</td>
                                </tr>
                              ))}
                              {(refundData.refunds || []).length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-400">No refunds in this period.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        {(refundData.cancellations || []).length > 0 && (
                          <>
                            <div className="px-5 py-3 border-t border-ink-100 bg-ink-50/60">
                              <p className="text-3xs font-bold uppercase tracking-widest text-ink-500">
                                Cancelled bookings ({refundData.cancellations.length})
                              </p>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-3xs uppercase tracking-widest text-ink-500 border-b border-ink-100">
                                    {['Cancelled', 'Booking', 'Guest', 'Value', 'Refunded', 'Retained', 'Reason'].map(h => (
                                      <th key={h} className="px-4 py-2.5 font-bold whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-ink-100">
                                  {refundData.cancellations.map(c => (
                                    <tr key={c.booking_id} className="hover:bg-ink-50">
                                      <td className="px-4 py-3 num text-ink-500 whitespace-nowrap">{c.cancelled_at || '—'}</td>
                                      <td className="px-4 py-3 num text-ink-500">{c.booking_ref}</td>
                                      <td className="px-4 py-3 text-ink-700">{c.guest_name || '—'}</td>
                                      <td className="px-4 py-3 num text-ink-500">{money(c.amount)}</td>
                                      <td className="px-4 py-3 num text-red-600">{money(c.refunded)}</td>
                                      <td className="px-4 py-3 num font-bold text-teal-700">{money(c.retained)}</td>
                                      <td className="px-4 py-3 text-ink-500">{c.reason || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>

                      {/* ── Cancel booking modal ── */}
                      {cancelTarget && (
                        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setCancelTarget(null)}>
                          <div className="surface w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-display font-bold text-ink-900">Cancel booking</h3>
                              <button onClick={() => setCancelTarget(null)} className="h-8 w-8 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500"><FaTimes size={11} /></button>
                            </div>
                            <p className="text-sm text-ink-500 mb-4">
                              {cancelTarget.guest_name || 'Guest'}
                              {cancelTarget.room_number ? ` · Room ${cancelTarget.room_number}` : ''} · {money(cancelTarget.total_to_collect)}
                            </p>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Reason</label>
                                <input value={cancelForm.reason} onChange={e => setCancelForm(f => ({ ...f, reason: e.target.value }))} className="input-base" placeholder="Why is this being cancelled?" />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Refund amount (₹)</label>
                                  <input type="number" min="0" step="0.01" value={cancelForm.refund_amount} onChange={e => setCancelForm(f => ({ ...f, refund_amount: e.target.value }))} className="input-base num" placeholder="0" />
                                </div>
                                <div>
                                  <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Refund mode</label>
                                  <select value={cancelForm.refund_method} onChange={e => setCancelForm(f => ({ ...f, refund_method: e.target.value }))} className="input-base">
                                    {REFUND_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                  </select>
                                </div>
                              </div>
                              <p className="text-2xs text-ink-400">Leave the amount at 0 to cancel without a refund (e.g. a retained cancellation fee). The room is released back to availability automatically.</p>
                            </div>
                            <div className="flex gap-2 mt-5">
                              <button onClick={() => setCancelTarget(null)} className="btn btn-outline flex-1">Keep booking</button>
                              <button onClick={submitCancel} disabled={cancelling} className="btn flex-1" style={{ background: '#dc2626', color: '#fff' }}>
                                {cancelling ? 'Cancelling…' : 'Cancel booking'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* Expenses */}
              {activeReport === 'expenses' && (
                <motion.div
                  key="expenses"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* Add expense */}
                  <form onSubmit={addExpense} className="surface p-5 space-y-3">
                    <h3 className="font-display font-bold text-ink-900 text-base">Record an expense</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Category</label>
                        <select value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))} className="input-base">
                          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Amount (₹)</label>
                        <input type="number" min="0" step="0.01" value={expenseForm.amount}
                          onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} className="input-base num" />
                      </div>
                      <div>
                        <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Date</label>
                        <input type="date" value={expenseForm.expense_date}
                          onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))} className="input-base num" />
                      </div>
                      <div>
                        <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Payment mode</label>
                        <select value={expenseForm.payment_mode} onChange={e => setExpenseForm(f => ({ ...f, payment_mode: e.target.value }))} className="input-base">
                          {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Description</label>
                        <input value={expenseForm.description}
                          onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} className="input-base" placeholder="What was it for?" />
                      </div>
                      <div>
                        <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Paid to</label>
                        <input value={expenseForm.paid_to}
                          onChange={e => setExpenseForm(f => ({ ...f, paid_to: e.target.value }))} className="input-base" />
                      </div>
                      <div className="flex items-end">
                        <button type="submit" disabled={savingExpense} className="btn btn-primary w-full">
                          <FaPlus size={10} /> {savingExpense ? 'Saving…' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Expense list */}
                  <div className="surface overflow-hidden">
                    <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="font-display font-bold text-ink-900 text-base">
                        Expenses <span className="text-ink-500 font-medium num">· {money(expenseTotal)}</span>
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <FaSearch size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                          <input value={expenseSearch}
                            onChange={e => setExpenseSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && loadExpenses(expenseSearch)}
                            placeholder="Search expenses…" className="input-base pl-8 py-1.5 text-sm w-52" />
                        </div>
                        <button onClick={() => loadExpenses(expenseSearch)} className="btn btn-outline py-1.5">Search</button>
                        <button onClick={exportExpenses} className="btn btn-outline py-1.5" title="Export CSV"><FaDownload size={11} /></button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-3xs uppercase tracking-widest text-ink-500 border-b border-ink-100">
                            {['Date', 'Category', 'Description', 'Paid to', 'Mode', 'Amount', ''].map(h => (
                              <th key={h} className="px-4 py-2.5 font-bold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-100">
                          {expenses.map(e => (
                            <tr key={e.id} className="hover:bg-ink-50">
                              <td className="px-4 py-3 num text-ink-500 whitespace-nowrap">{e.expense_date}</td>
                              <td className="px-4 py-3"><span className="pill capitalize">{e.category}</span></td>
                              <td className="px-4 py-3 text-ink-700">{e.description || '—'}</td>
                              <td className="px-4 py-3 text-ink-500">{e.paid_to || '—'}</td>
                              <td className="px-4 py-3 text-ink-500">{e.payment_mode || '—'}</td>
                              <td className="px-4 py-3 num font-bold text-ink-900">{money(e.amount)}</td>
                              <td className="px-4 py-3">
                                <button onClick={() => deleteExpense(e.id)} className="text-ink-400 hover:text-red-600" title="Delete">
                                  <FaTrash size={11} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {expenses.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-400">No expenses recorded.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
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
                            {entry.frro_form_c_required && (
                              <span className="pill pill-danger">FRRO Form-C</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-ink-500 flex flex-wrap gap-3">
                          <span className="inline-flex items-center gap-1">🏠 {entry.property.name} · Room <span className="num font-bold">{entry.room.number}</span></span>
                          <span className="inline-flex items-center gap-1">📅 {entry.check_in?.slice(0, 10)} → {entry.check_out?.slice(0, 10)}</span>
                          <span className="inline-flex items-center gap-1 font-bold text-ink-900 num">💳 {money(entry.amount)}</span>
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

              {/* GRC daily report (PDF) */}
              {activeReport === 'grc' && (
                <motion.div
                  key="grc"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
                  className="surface p-6"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <FaIdCard className="text-teal-600" size={14} />
                    <h3 className="font-display font-bold text-ink-900 text-base">Daily Guest Registration Card</h3>
                  </div>
                  <p className="text-sm text-ink-500 mb-4">
                    Download a print-ready PDF with one Guest Registration Card per arriving
                    booking for the selected day (the GRC template reception fills on arrival).
                  </p>
                  <div className="flex items-end gap-3 flex-wrap">
                    <div>
                      <label className="block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest">Date</label>
                      <input type="date" value={grcDate} onChange={e => setGrcDate(e.target.value)} className="input-base num" />
                    </div>
                    <button onClick={downloadGRC} className="btn btn-primary">
                      <FaDownload size={11} /> Download GRC PDF
                    </button>
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
