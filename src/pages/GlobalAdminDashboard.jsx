import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store';
import apiClient from '../api/client';
import { clearTokens } from '../api/tokenStorage';
import toast from 'react-hot-toast';
import Sk from '../components/Skeleton';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import AdminShell from '../components/AdminShell';
import { PlatformAlerts } from '../components/PlatformAlerts';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  FaSignOutAlt, FaBuilding, FaCreditCard, FaCalendarAlt,
  FaChartBar, FaPlus, FaTimes, FaSearch, FaEdit, FaTrash,
  FaBan, FaRedo, FaUsers, FaCheckCircle,
} from 'react-icons/fa';

const TABS = ['Dashboard', 'Organizations', 'Plans', 'Bookings'];
const TAB_ICONS = {
  Dashboard: FaChartBar,
  Organizations: FaBuilding,
  Plans: FaCreditCard,
  Bookings: FaCalendarAlt,
};
const SHELL_TABS = TABS.map(t => ({ id: t, label: t, icon: TAB_ICONS[t] }));
const PIE_COLORS = ['#06b6d4', '#f59e0b', '#f97316'];

const INPUT_CLS = 'input-base text-sm';
const LABEL_CLS = 'block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest';

export default function GlobalAdminDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingSearch, setBookingSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Per-action loading states
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingPlanId, setDeletingPlanId] = useState(null);
  const [removingAdminId, setRemovingAdminId] = useState(null);

  // Modals
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [editPlan, setEditPlan] = useState(null);

  // Org admin management
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgAdmins, setOrgAdmins] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [editAdmin, setEditAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState({ name: '', phone: '', email: '', password: '' });

  // Forms
  const [orgForm, setOrgForm] = useState({ name: '', contact_email: '', contact_phone: '', city: '', state: '', membership_plan_id: '', admin_name: '', admin_phone: '', admin_email: '', admin_password: '' });
  const [planForm, setPlanForm] = useState({ name: '', max_rooms: '', description: '' });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [dashRes, orgRes, planRes, bookingRes] = await Promise.all([
        apiClient.get('/global-admin/dashboard'),
        apiClient.get('/global-admin/organizations'),
        apiClient.get('/global-admin/plans'),
        apiClient.get('/global-admin/bookings'),
      ]);
      setDashboard(dashRes.data.data);
      setOrgs(orgRes.data.data);
      setPlans(planRes.data.data);
      setBookings(bookingRes.data.data);
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    clearTokens();
    navigate('/login');
  }

  async function saveOrg() {
    setSavingOrg(true);
    try {
      if (editOrg) {
        await apiClient.put(`/global-admin/organizations/${editOrg.id}`, orgForm);
        toast.success('Organization updated');
      } else {
        const res = await apiClient.post('/global-admin/organizations', orgForm);
        if (res.data.admin_warning) toast.error(res.data.admin_warning, { duration: 6000 });
        toast.success(res.data.admin_created ? 'Organization & admin created!' : 'Organization created');
      }
      setShowOrgModal(false);
      setEditOrg(null);
      setOrgForm({ name: '', contact_email: '', contact_phone: '', city: '', state: '', membership_plan_id: '', admin_name: '', admin_phone: '', admin_email: '', admin_password: '' });
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save organization');
    } finally {
      setSavingOrg(false);
    }
  }

  async function savePlan() {
    setSavingPlan(true);
    try {
      if (editPlan) {
        await apiClient.put(`/global-admin/plans/${editPlan.id}`, planForm);
        toast.success('Plan updated');
      } else {
        await apiClient.post('/global-admin/plans', planForm);
        toast.success('Plan created');
      }
      setShowPlanModal(false);
      setEditPlan(null);
      setPlanForm({ name: '', max_rooms: '', description: '' });
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save plan');
    } finally {
      setSavingPlan(false);
    }
  }

  async function toggleOrgStatus(org) {
    setTogglingId(org.id);
    try {
      const endpoint = org.is_active ? 'suspend' : 'reactivate';
      await apiClient.post(`/global-admin/organizations/${org.id}/${endpoint}`);
      toast.success(`Organization ${org.is_active ? 'suspended' : 'reactivated'}`);
      fetchAll();
    } catch (e) {
      toast.error('Failed to update status');
    } finally {
      setTogglingId(null);
    }
  }

  async function deletePlan(planId) {
    if (!window.confirm('Delete this plan?')) return;
    setDeletingPlanId(planId);
    try {
      await apiClient.delete(`/global-admin/plans/${planId}`);
      toast.success('Plan deleted');
      fetchAll();
    } catch (e) {
      toast.error('Failed to delete plan');
    } finally {
      setDeletingPlanId(null);
    }
  }

  async function openAdminPanel(org) {
    setSelectedOrg(org);
    setShowAdminModal(true);
    setShowAddAdmin(false);
    setEditAdmin(null);
    setAdminForm({ name: '', phone: '', email: '', password: '' });
    await fetchOrgAdmins(org.id);
  }

  async function fetchOrgAdmins(orgId) {
    setAdminLoading(true);
    try {
      const res = await apiClient.get(`/global-admin/organizations/${orgId}/admins`);
      setOrgAdmins(res.data.data);
    } catch (e) {
      toast.error('Failed to load org admins');
      setOrgAdmins([]);
    } finally {
      setAdminLoading(false);
    }
  }

  async function saveAdmin() {
    if (!selectedOrg) return;
    setSavingAdmin(true);
    try {
      if (editAdmin) {
        await apiClient.put(`/global-admin/organizations/${selectedOrg.id}/admins/${editAdmin.id}`, adminForm);
        toast.success('Admin updated');
      } else {
        const res = await apiClient.post(`/global-admin/organizations/${selectedOrg.id}/admins`, adminForm);
        toast.success(res.data.message || 'Admin created');
      }
      setShowAddAdmin(false);
      setEditAdmin(null);
      setAdminForm({ name: '', phone: '', email: '', password: '' });
      await fetchOrgAdmins(selectedOrg.id);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save admin');
    } finally {
      setSavingAdmin(false);
    }
  }

  async function removeAdmin(admin) {
    if (!window.confirm(`Remove ${admin.name} as org admin? They will be demoted to a regular user.`)) return;
    setRemovingAdminId(admin.id);
    try {
      await apiClient.delete(`/global-admin/organizations/${selectedOrg.id}/admins/${admin.id}`);
      toast.success('Admin removed');
      await fetchOrgAdmins(selectedOrg.id);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to remove admin');
    } finally {
      setRemovingAdminId(null);
    }
  }

  if (loading) return (
    <AdminShell
      title="Dashboard" subtitle="Loading…"
      tabs={SHELL_TABS} activeTab={tab} onTabChange={setTab}
      onRequestLogout={() => setShowLogoutConfirm(true)} roleLabel="Global Admin"
    >
      <div className="page-wide py-6 sm:py-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface p-5">
              <Sk className="h-10 w-10 rounded-xl mb-4" />
              <Sk className="h-4 w-24 mb-2" />
              <Sk className="h-8 w-20" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Sk className="lg:col-span-2 h-72 rounded-2xl" />
          <Sk className="h-72 rounded-2xl" />
        </div>
        <div className="surface p-5">
          <Sk className="h-5 w-40 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Sk key={i} className="h-10 rounded-lg" />)}
          </div>
        </div>
      </div>
    </AdminShell>
  );

  const kycData = dashboard ? [
    { name: 'Verified', value: dashboard.kyc_breakdown?.verified || 0 },
    { name: 'Pending', value: dashboard.kyc_breakdown?.pending || 0 },
    { name: 'Not Submitted', value: dashboard.kyc_breakdown?.not_submitted || 0 },
  ] : [];

  const userInitial = user?.name?.charAt(0).toUpperCase() || 'G';

  return (
    <AdminShell
      title={tab}
      subtitle={tab === 'Dashboard' ? `Welcome back, ${user?.name?.split(' ')[0] || 'admin'}` : null}
      tabs={SHELL_TABS} activeTab={tab} onTabChange={setTab}
      onRequestLogout={() => setShowLogoutConfirm(true)} roleLabel="Global Admin"
    >
        {/* ── PAGE CONTENT ── */}
        <div className="page-wide py-5 sm:py-8 pb-24 md:pb-8">

        {/* ── DASHBOARD TAB ── */}
        {tab === 'Dashboard' && dashboard && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Overview</p>
              <h2 className="text-xl font-black text-gray-900">Platform Summary</h2>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Organizations', short: 'Orgs', value: dashboard.total_organizations, Icon: FaBuilding, cls: 'stat-rose', iconCls: 'bg-rose-100 text-rose-600' },
                { label: 'Properties', short: 'Props', value: dashboard.total_properties, Icon: FaBuilding, cls: 'stat-purple', iconCls: 'bg-violet-100 text-violet-600' },
                { label: 'Total Bookings', short: 'Bookings', value: dashboard.total_bookings, Icon: FaCalendarAlt, cls: 'stat-blue', iconCls: 'bg-blue-100 text-blue-600' },
                { label: 'Total Revenue', short: 'Revenue', value: `₹${(dashboard.total_revenue || 0).toLocaleString()}`, Icon: FaCreditCard, cls: 'stat-emerald', iconCls: 'bg-emerald-100 text-emerald-600' },
              ].map(({ label, short, value, Icon, cls, iconCls }) => (
                <div key={label} className={`${cls} border rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm enter-up`}>
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500">
                      <span className="sm:hidden">{short}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </p>
                    <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl ${iconCls} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={12} />
                    </div>
                  </div>
                  <p className="stat-number text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            {/* Platform Alerts */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">System Health</p>
              <PlatformAlerts />
            </div>

            <div className="grid md:grid-cols-2 gap-4 sm:gap-5">
              {/* Monthly booking volume */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Bookings</p>
                <p className="font-black text-gray-900 mb-5">Monthly Trend</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={dashboard.monthly_booking_volume || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip contentStyle={{ border: '1px solid #f3f4f6', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)', fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" stroke="#f43f5e" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#f43f5e' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* KYC status donut */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Guests</p>
                <p className="font-black text-gray-900 mb-5">KYC Verification</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={kycData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={70} innerRadius={38} paddingAngle={3}>
                      {kycData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ border: '1px solid #f3f4f6', borderRadius: '12px', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2">
                  {kycData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                      <span className="text-xs text-gray-500 font-medium">{d.name}</span>
                      <span className="text-xs font-bold text-gray-900">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue per org */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm md:col-span-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Revenue</p>
                <p className="font-black text-gray-900 mb-5">Per Organization</p>
                {(dashboard.revenue_per_org || []).length === 0 ? (
                  <div className="text-center py-8 text-gray-300 text-sm">No revenue data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dashboard.revenue_per_org || []} barSize={36}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip formatter={(v) => [`₹${v.toLocaleString()}`, 'Revenue']} contentStyle={{ border: '1px solid #f3f4f6', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)', fontSize: 12 }} />
                      <Bar dataKey="revenue" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ORGANIZATIONS TAB ── */}
        {tab === 'Organizations' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Management</p>
                <h2 className="text-xl font-black text-gray-900">Organizations</h2>
              </div>
              <button
                onClick={() => { setEditOrg(null); setOrgForm({ name: '', contact_email: '', contact_phone: '', city: '', state: '', membership_plan_id: '', admin_name: '', admin_phone: '', admin_email: '', admin_password: '' }); setShowOrgModal(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 text-white text-sm font-bold rounded-xl hover:bg-rose-600 transition shadow-sm shadow-rose-200">
                <FaPlus size={11} />
                <span className="hidden sm:inline">Add Organization</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>

            {orgs.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="text-4xl mb-3">🏢</div>
                <p className="font-bold text-gray-900 mb-1">No organizations yet</p>
                <p className="text-gray-400 text-sm">Create your first organization to get started.</p>
              </div>
            ) : (
              <>
                {/* ── Mobile cards ── */}
                <div className="md:hidden space-y-3">
                  {orgs.map(org => (
                    <div key={org.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      {/* Top row: name + status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                            <FaBuilding size={15} className="text-rose-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-gray-900 leading-tight truncate">{org.name}</p>
                            {org.contact_email && (
                              <p className="text-xs text-gray-400 truncate mt-0.5">{org.contact_email}</p>
                            )}
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex-shrink-0 ${org.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                          {org.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <div className="bg-gray-50 rounded-lg px-3 py-1.5">
                          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Plan</p>
                          <p className="text-xs font-bold text-gray-900">{org.plan_name || '-'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 py-1.5">
                          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Rooms</p>
                          <p className={`text-xs font-bold ${org.room_count >= org.max_rooms && org.max_rooms > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                            {org.room_count}<span className="font-normal text-gray-400">/{org.max_rooms || '∞'}</span>
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 py-1.5">
                          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Bookings</p>
                          <p className="text-xs font-bold text-gray-900">{org.booking_count}</p>
                        </div>
                      </div>

                      {/* Admins row */}
                      <div className="flex items-center gap-2 mb-4">
                        {org.org_admins?.length > 0 ? (
                          <>
                            <div className="flex -space-x-1.5">
                              {org.org_admins.slice(0, 4).map(a => (
                                <div key={a.id} title={a.name}
                                  className="h-6 w-6 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 border-2 border-white flex items-center justify-center text-white text-[9px] font-black">
                                  {a.name?.charAt(0).toUpperCase()}
                                </div>
                              ))}
                            </div>
                            <span className="text-xs text-gray-500">
                              {org.org_admins.length} admin{org.org_admins.length !== 1 ? 's' : ''}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">No admin assigned</span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-3 border-t border-gray-50">
                        <button onClick={() => openAdminPanel(org)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-700 transition">
                          <FaUsers size={11} /> Manage Admins
                        </button>
                        <button
                          onClick={() => { setEditOrg(org); setOrgForm({ name: org.name, contact_email: org.contact_email || '', contact_phone: org.contact_phone || '', city: org.city || '', state: org.state || '', membership_plan_id: org.membership_plan_id || '', admin_name: '', admin_phone: '', admin_email: '', admin_password: '' }); setShowOrgModal(true); }}
                          className="p-2 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 transition">
                          <FaEdit size={13} />
                        </button>
                        <button onClick={() => toggleOrgStatus(org)}
                          disabled={togglingId === org.id}
                          title={org.is_active ? 'Suspend' : 'Reactivate'}
                          className={`p-2 rounded-xl border transition disabled:opacity-40 disabled:cursor-not-allowed ${org.is_active ? 'border-red-100 text-red-400 hover:bg-red-50' : 'border-emerald-100 text-emerald-500 hover:bg-emerald-50'}`}>
                          {togglingId === org.id
                            ? <span className="h-3.5 w-3.5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin block" />
                            : org.is_active ? <FaBan size={13} /> : <FaRedo size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Desktop table ── */}
                <div className="hidden md:block bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-50">
                        {['Organization', 'Plan', 'Rooms', 'Bookings', 'Admins', 'Status', 'Actions'].map(h => (
                          <th key={h} className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {orgs.map(org => (
                        <tr key={org.id} className="hover:bg-gray-50/60 transition">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                                <FaBuilding size={14} className="text-rose-400" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{org.name}</p>
                                <p className="text-xs text-gray-400">{org.contact_email || '-'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm font-semibold text-gray-700">{org.plan_name || '-'}</span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1">
                              <span className={`font-bold text-sm ${org.room_count >= org.max_rooms && org.max_rooms > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                                {org.room_count}
                              </span>
                              <span className="text-gray-300 text-xs">/ {org.max_rooms || '∞'}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 font-semibold text-gray-700">{org.booking_count}</td>
                          <td className="px-5 py-4">
                            {org.org_admins?.length > 0 ? (
                              <div className="flex -space-x-1.5">
                                {org.org_admins.slice(0, 3).map(a => (
                                  <div key={a.id} title={a.name}
                                    className="h-7 w-7 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 border-2 border-white flex items-center justify-center text-white text-[10px] font-black">
                                    {a.name?.charAt(0).toUpperCase()}
                                  </div>
                                ))}
                                {org.org_admins.length > 3 && (
                                  <div className="h-7 w-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-gray-500 text-[10px] font-bold">
                                    +{org.org_admins.length - 3}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">No admin</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${org.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                              {org.is_active ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openAdminPanel(org)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-700 transition whitespace-nowrap">
                                <FaUsers size={10} /> Admins
                              </button>
                              <button
                                onClick={() => { setEditOrg(org); setOrgForm({ name: org.name, contact_email: org.contact_email || '', contact_phone: org.contact_phone || '', city: org.city || '', state: org.state || '', membership_plan_id: org.membership_plan_id || '', admin_name: '', admin_phone: '', admin_email: '', admin_password: '' }); setShowOrgModal(true); }}
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                                <FaEdit size={12} />
                              </button>
                              <button onClick={() => toggleOrgStatus(org)}
                                disabled={togglingId === org.id}
                                title={org.is_active ? 'Suspend' : 'Reactivate'}
                                className={`p-1.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${org.is_active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'}`}>
                                {togglingId === org.id
                                  ? <span className="h-3 w-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin block" />
                                  : org.is_active ? <FaBan size={12} /> : <FaRedo size={12} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── PLANS TAB ── */}
        {tab === 'Plans' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Configuration</p>
                <h2 className="text-xl font-black text-gray-900">Membership Plans</h2>
              </div>
              <button
                onClick={() => { setEditPlan(null); setPlanForm({ name: '', max_rooms: '', description: '' }); setShowPlanModal(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 text-white text-sm font-bold rounded-xl hover:bg-rose-600 transition shadow-sm shadow-rose-200">
                <FaPlus size={11} />
                <span className="hidden sm:inline">Add Plan</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>

            {plans.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="text-4xl mb-3">📋</div>
                <p className="font-bold text-gray-900 mb-1">No plans yet</p>
                <p className="text-gray-400 text-sm mb-5">Create a membership plan to assign to organizations.</p>
                <button onClick={() => { setEditPlan(null); setPlanForm({ name: '', max_rooms: '', description: '' }); setShowPlanModal(true); }}
                  className="px-5 py-2.5 bg-rose-500 text-white text-sm font-bold rounded-xl hover:bg-rose-600 transition shadow-sm shadow-rose-200">
                  Create First Plan
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map(plan => (
                  <div key={plan.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:border-rose-200 hover:shadow-md transition group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center group-hover:bg-rose-100 transition">
                        <FaCreditCard size={16} className="text-rose-500" />
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${plan.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <h3 className="font-black text-gray-900 text-lg mb-1">{plan.name}</h3>
                    <p className="text-sm text-gray-500 mb-1">Up to <span className="font-bold text-gray-900">{plan.max_rooms}</span> rooms</p>
                    {plan.description && <p className="text-xs text-gray-400 mt-2">{plan.description}</p>}
                    <div className="flex gap-2 mt-5 pt-4 border-t border-gray-50">
                      <button
                        onClick={() => { setEditPlan(plan); setPlanForm({ name: plan.name, max_rooms: plan.max_rooms, description: plan.description || '' }); setShowPlanModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition">
                        <FaEdit size={10} /> Edit
                      </button>
                      <button onClick={() => deletePlan(plan.id)}
                        disabled={deletingPlanId === plan.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 text-xs font-semibold rounded-lg hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
                        {deletingPlanId === plan.id
                          ? <span className="h-3 w-3 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                          : <FaTrash size={10} />}
                        {deletingPlanId === plan.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BOOKINGS TAB ── */}
        {tab === 'Bookings' && (() => {
          const filtered = bookings.filter(b => {
            if (!bookingSearch) return true;
            const q = bookingSearch.toLowerCase();
            return (
              (b.guest_name || '').toLowerCase().includes(q) ||
              (b.property_name || '').toLowerCase().includes(q) ||
              (b.org_name || '').toLowerCase().includes(q) ||
              (b.id || '').toLowerCase().includes(q)
            );
          });
          return (
            <div className="space-y-4">
              {/* Header + search */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">All Bookings</p>
                <h2 className="text-xl font-black text-gray-900 mb-3">
                  {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
                </h2>
                <div className="relative">
                  <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" size={13} />
                  <input
                    type="text"
                    placeholder="Search guest, property, org…"
                    value={bookingSearch}
                    onChange={e => setBookingSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition bg-white"
                  />
                </div>
              </div>

              {bookings.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                  <div className="text-4xl mb-3">📅</div>
                  <p className="font-bold text-gray-900 mb-1">No bookings yet</p>
                  <p className="text-gray-400 text-sm">Bookings will appear here as guests make reservations.</p>
                </div>
              ) : (
                <>
                  {/* ── Mobile cards ── */}
                  <div className="md:hidden space-y-3">
                    {filtered.map(b => (
                      <div key={b.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        {/* Top: ref + status + amount */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-mono text-xs font-bold text-gray-400">#{b.id?.slice(0, 8).toUpperCase()}</p>
                            <p className="text-[10px] text-gray-300 mt-0.5">{b.created_at?.slice(0, 10)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              b.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' :
                                'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>{b.status}</span>
                            <p className="font-black text-gray-900 text-sm">₹{(b.final_price ?? b.total_price ?? 0).toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Guest */}
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-600 text-sm font-black flex-shrink-0">
                            {(b.guest_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{b.guest_name || '-'}</p>
                            <p className="text-xs text-gray-400">{b.guest_phone || '-'}</p>
                          </div>
                        </div>

                        {/* Property + org + dates */}
                        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400 font-medium">Property</p>
                            <p className="text-xs font-semibold text-gray-800">{b.property_name || '-'}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400 font-medium">Organization</p>
                            <p className="text-xs font-semibold text-gray-800">{b.org_name || '-'}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400 font-medium">Dates</p>
                            <p className="text-xs font-semibold text-gray-800">{b.check_in_date} → {b.check_out_date}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filtered.length === 0 && bookingSearch && (
                      <div className="text-center py-10 text-gray-400 text-sm">No results for "{bookingSearch}"</div>
                    )}
                  </div>

                  {/* ── Desktop table ── */}
                  <div className="hidden md:block bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-50">
                          {['Booking', 'Guest', 'Organization', 'Property', 'Dates', 'Status', 'Amount'].map(h => (
                            <th key={h} className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filtered.map(b => (
                          <tr key={b.id} className="hover:bg-gray-50/60 transition">
                            <td className="px-5 py-4">
                              <p className="font-mono text-xs text-gray-400 font-semibold">#{b.id?.slice(0, 8).toUpperCase()}</p>
                              <p className="text-[10px] text-gray-300 mt-0.5">{b.created_at?.slice(0, 10)}</p>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-600 text-xs font-black flex-shrink-0">
                                  {(b.guest_name || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{b.guest_name || '-'}</p>
                                  <p className="text-xs text-gray-400">{b.guest_phone || ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-xs font-semibold text-gray-600">{b.org_name || '-'}</td>
                            <td className="px-5 py-4 font-semibold text-gray-700">{b.property_name || '-'}</td>
                            <td className="px-5 py-4">
                              <p className="text-xs font-semibold text-gray-700">{b.check_in_date || '-'}</p>
                              <p className="text-xs text-gray-400">→ {b.check_out_date || '-'}</p>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                b.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' :
                                  'bg-amber-50 text-amber-700 border-amber-100'
                                }`}>{b.status}</span>
                            </td>
                            <td className="px-5 py-4 font-black text-gray-900">
                              ₹{(b.final_price ?? b.total_price ?? 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        {filtered.length === 0 && bookingSearch && (
                          <tr>
                            <td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">
                              No results for "{bookingSearch}"
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── ORGANIZATION MODAL ── */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="h-1 w-10 bg-gray-200 rounded-full" /></div>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h3 className="font-black text-gray-900">{editOrg ? 'Edit Organization' : 'New Organization'}</h3>
              <button onClick={() => setShowOrgModal(false)} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">
                <FaTimes size={12} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Organization Name *', key: 'name', placeholder: 'e.g. Sunset Resorts Pvt Ltd' },
                { label: 'Contact Email', key: 'contact_email', placeholder: 'admin@company.com' },
                { label: 'Contact Phone', key: 'contact_phone', placeholder: '10-digit number' },
                { label: 'City', key: 'city', placeholder: 'Mumbai' },
                { label: 'State', key: 'state', placeholder: 'Maharashtra' },
              ].map(f => (
                <div key={f.key}>
                  <label className={LABEL_CLS}>{f.label}</label>
                  <input value={orgForm[f.key] || ''} onChange={e => setOrgForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className={INPUT_CLS} />
                </div>
              ))}
              <div>
                <label className={LABEL_CLS}>Membership Plan</label>
                <select value={orgForm.membership_plan_id || ''} onChange={e => setOrgForm(p => ({ ...p, membership_plan_id: e.target.value }))}
                  className={INPUT_CLS}>
                  <option value="">No plan selected</option>
                  {plans.map(pl => <option key={pl.id} value={pl.id}>{pl.name} - {pl.max_rooms} rooms</option>)}
                </select>
              </div>

              {!editOrg && (
                <>
                  <div className="pt-2">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-gray-100" />
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Org Admin (optional)</p>
                      <div className="h-px flex-1 bg-gray-100" />
                    </div>
                    <p className="text-xs text-gray-400 mb-3">You can also add admins later from the Organizations table.</p>
                  </div>
                  {[
                    { label: 'Admin Name', key: 'admin_name', placeholder: 'Full name' },
                    { label: 'Admin Phone', key: 'admin_phone', placeholder: '10-digit number' },
                    { label: 'Admin Email', key: 'admin_email', placeholder: 'admin@email.com' },
                    { label: 'Admin Password', key: 'admin_password', placeholder: '••••••••', type: 'password' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className={LABEL_CLS}>{f.label}</label>
                      <input type={f.type || 'text'} value={orgForm[f.key] || ''} onChange={e => setOrgForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder} className={INPUT_CLS} />
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowOrgModal(false)}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={saveOrg}
                disabled={savingOrg}
                className="flex-1 bg-rose-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-rose-600 transition shadow-sm shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {savingOrg && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {savingOrg ? 'Saving…' : editOrg ? 'Save Changes' : 'Create Organization'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PLAN MODAL ── */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="h-1 w-10 bg-gray-200 rounded-full" /></div>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h3 className="font-black text-gray-900">{editPlan ? 'Edit Plan' : 'New Membership Plan'}</h3>
              <button onClick={() => setShowPlanModal(false)} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">
                <FaTimes size={12} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={LABEL_CLS}>Plan Name *</label>
                <input value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Basic, Standard, Pro"
                  className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Max Rooms *</label>
                <input type="number" value={planForm.max_rooms} onChange={e => setPlanForm(p => ({ ...p, max_rooms: e.target.value }))}
                  placeholder="e.g. 10"
                  className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Description</label>
                <textarea value={planForm.description} onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional plan description…"
                  rows={3} className={INPUT_CLS + ' resize-none'} />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowPlanModal(false)}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={savePlan}
                disabled={!planForm.name || !planForm.max_rooms || savingPlan}
                className="flex-1 bg-rose-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-rose-600 transition shadow-sm shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {savingPlan && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {savingPlan ? 'Saving…' : editPlan ? 'Save Changes' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOGOUT CONFIRMATION ── */}
      <LogoutConfirmModal
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        message="You'll need to sign in again to access the admin console."
      />

      {/* ── ORG ADMIN MANAGEMENT MODAL ── */}
      {showAdminModal && selectedOrg && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="h-1 w-10 bg-gray-200 rounded-full" /></div>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-gray-900">Manage Admins</h3>
                <p className="text-xs text-gray-400 mt-0.5">{selectedOrg.name}</p>
              </div>
              <button onClick={() => { setShowAdminModal(false); setSelectedOrg(null); }}
                className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">
                <FaTimes size={12} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Info card */}
              <div className="bg-gray-50 rounded-xl p-4 flex gap-3">
                <FaCheckCircle className="text-emerald-500 mt-0.5 flex-shrink-0" size={14} />
                <p className="text-xs text-gray-600 leading-relaxed">
                  <strong>Org Admins</strong> have full access within this organization - properties, bookings, revenue, and employee management.
                </p>
              </div>

              {/* Admins list */}
              {adminLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 border-[3px] border-rose-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {orgAdmins.length === 0 && !showAddAdmin && (
                    <div className="text-center py-8 text-gray-400 text-sm">No admins yet. Add one below.</div>
                  )}
                  {orgAdmins.map(admin => (
                    <div key={admin.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl p-4 hover:border-rose-100 transition">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white text-sm font-black">
                          {admin.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{admin.name}</p>
                          <p className="text-xs text-gray-400">{admin.phone}{admin.email ? ` · ${admin.email}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditAdmin(admin); setAdminForm({ name: admin.name, phone: admin.phone, email: admin.email || '' }); setShowAddAdmin(true); }}
                          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                          <FaEdit size={12} />
                        </button>
                        <button onClick={() => removeAdmin(admin)}
                          disabled={removingAdminId === admin.id}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                          {removingAdminId === admin.id
                            ? <span className="h-3 w-3 border-2 border-red-300 border-t-red-500 rounded-full animate-spin block" />
                            : <FaTrash size={12} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add / Edit admin form */}
              {showAddAdmin ? (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5">
                  <h4 className="font-bold text-gray-900 mb-4">{editAdmin ? 'Edit Admin' : 'Add Org Admin'}</h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Full Name *', key: 'name', placeholder: 'Admin name' },
                      { label: 'Phone *', key: 'phone', placeholder: '10-digit number' },
                      { label: 'Email', key: 'email', placeholder: 'admin@example.com' },
                      { label: 'Password', key: 'password', placeholder: '••••••••', type: 'password' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className={LABEL_CLS}>{f.label}</label>
                        <input type={f.type || 'text'} value={adminForm[f.key] || ''} onChange={e => setAdminForm(p => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.placeholder} className={INPUT_CLS} />
                      </div>
                    ))}
                    {!editAdmin && (
                      <p className="text-xs text-gray-400 pt-1">
                        If a user with this phone exists as a regular user, they'll be promoted to org admin.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => { setShowAddAdmin(false); setEditAdmin(null); setAdminForm({ name: '', phone: '', email: '' }); }}
                      className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-600 hover:bg-white transition">
                      Cancel
                    </button>
                    <button onClick={saveAdmin}
                      disabled={!adminForm.name || !adminForm.phone || savingAdmin}
                      className="flex-1 bg-rose-500 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-rose-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-rose-200 flex items-center justify-center gap-2">
                      {savingAdmin && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {savingAdmin ? 'Saving…' : editAdmin ? 'Update Admin' : 'Add Admin'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setEditAdmin(null); setAdminForm({ name: '', phone: '', email: '' }); setShowAddAdmin(true); }}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3.5 text-sm font-semibold text-gray-400 hover:border-rose-300 hover:text-rose-500 transition flex items-center justify-center gap-2">
                  <FaPlus size={12} /> Add Org Admin
                </button>
              )}
            </div>

            <div className="px-6 pb-6">
              <button onClick={() => { setShowAdminModal(false); setSelectedOrg(null); }}
                className="w-full border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
