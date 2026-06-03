import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store';
import apiClient from '../api/client';
import { getAccessToken, clearTokens } from '../api/tokenStorage';
import toast from 'react-hot-toast';
import Sk from '../components/Skeleton';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import AdminShell from '../components/AdminShell';
import {
  FaUsers, FaBuilding, FaCalendarAlt, FaRupeeSign, FaSearch, FaTimes, FaKey,
  FaCheckCircle, FaPlus, FaTrash, FaSignOutAlt, FaChartBar, FaTags,
  FaChevronRight, FaTag, FaToggleOn, FaToggleOff, FaEdit, FaArrowLeft,
  FaBed, FaImage, FaSave
} from 'react-icons/fa';

const ADMIN_TABS = [
  { id: 'dashboard',  label: 'Dashboard',  icon: FaChartBar },
  { id: 'bookings',   label: 'Bookings',   icon: FaCalendarAlt },
  { id: 'properties', label: 'Properties', icon: FaBuilding },
  { id: 'coupons',    label: 'Coupons',    icon: FaTags },
  { id: 'users',      label: 'Users',      icon: FaUsers },
];

// Placeholder hotel images (Unsplash) - used as defaults, changeable from admin
const PLACEHOLDER_PROPERTY_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=70',
  'https://images.unsplash.com/photo-1542314831-c6a4d1409e1c?auto=format&fit=crop&w=600&q=70',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=70',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=600&q=70',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=70',
  'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=600&q=70',
];

const PLACEHOLDER_ROOM_IMAGES = [
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=600&q=70',
  'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=600&q=70',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=70',
  'https://images.unsplash.com/photo-1618221469555-7f3ad97540d6?auto=format&fit=crop&w=600&q=70',
];

const ADMIN_STATUS_CONFIG = {
  new_booking: { label: 'New Booking', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', next: 'confirmed', action: 'Confirm Booking' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700 border-blue-200', next: 'verified', action: 'Mark Verified' },
  verified: { label: 'Verified', color: 'bg-purple-100 text-purple-700 border-purple-200', next: 'password_set', action: 'Set Room Password' },
  password_set: { label: 'Password Set', color: 'bg-green-100 text-green-700 border-green-200', next: null, action: null },
};

const STATUS_BADGE = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Property management
  const [selectedProperty, setSelectedProperty] = useState(null); // viewing a property
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null); // null = add new
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null); // null = add new
  const [propertyRooms, setPropertyRooms] = useState([]);
  const [allRooms, setAllRooms] = useState([]); // All rooms across all properties
  const [roomBookings, setRoomBookings] = useState({}); // roomId -> bookings[]
  const [savingProperty, setSavingProperty] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);

  const emptyPropertyForm = {
    name: '', description: '', address: '', city: '', state: '',
    country: 'India', pincode: '', phone: '', email: '',
    rating: '5.0', amenities: '', images: '',
    allow_floor_booking: false, allow_full_property_booking: false, allow_pay_at_property: true,
  };
  const emptyRoomForm = {
    room_number: '', room_type: 'Deluxe', capacity: '2',
    price_per_night: '', description: '', amenities: '', images: '', is_active: true,
    floor: 'Ground Floor',
  };
  const [propertyForm, setPropertyForm] = useState(emptyPropertyForm);
  const [roomForm, setRoomForm] = useState(emptyRoomForm);

  // Booking search / filter
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  // Booking detail modal
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [pendingNextStatus, setPendingNextStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Coupon form
  const [couponForm, setCouponForm] = useState({
    code: '', applicable_room_ids: [], expires_at: '',
  });
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { navigate('/login'); return; }

    if (!user) {
      apiClient.get('/auth/profile').then((res) => {
        if (res.data.user.role !== 'admin') { navigate('/login'); return; }
        fetchAll();
      }).catch(() => navigate('/login'));
      return;
    }
    if (user.role !== 'admin') { navigate('/login'); return; }
    fetchAll();
  }, [user, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [dashRes, usersRes, bookingsRes, couponsRes, propsRes] = await Promise.all([
        apiClient.get('/admin/dashboard'),
        apiClient.get('/admin/users?role=user'),
        apiClient.get('/admin/bookings'),
        apiClient.get('/admin/coupons'),
        apiClient.get('/properties'),
      ]);
      setDashboardData(dashRes.data.data);
      setUsers(usersRes.data.data);
      setBookings(bookingsRes.data.data);
      setCoupons(couponsRes.data.data);
      setProperties(propsRes.data.data);

      // Fetch all rooms for all properties (for coupon mapping)
      const roomsRes = await Promise.all(propsRes.data.data.map(p => apiClient.get(`/properties/${p.id}/rooms`)));
      const rooms = roomsRes.flatMap(r => r.data.data || []);
      setAllRooms(rooms);
    } catch (error) {
      // Record the failure so we render an explicit error screen with a
      // retry instead of a dashboard full of misleading "no data" panels.
      setLoadError(error);
      toast.error('Failed to load data');
    } finally { setLoading(false); }
  };


  // ── Property management helpers ───────────────────────────────
  const openAddProperty = () => {
    setEditingProperty(null);
    setPropertyForm({ ...emptyPropertyForm, images: PLACEHOLDER_PROPERTY_IMAGES[0] });
    setShowPropertyForm(true);
  };

  const openEditProperty = (prop) => {
    setEditingProperty(prop);
    setPropertyForm({
      name: prop.name || '',
      description: prop.description || '',
      address: prop.address || '',
      city: prop.city || '',
      state: prop.state || '',
      country: prop.country || 'India',
      pincode: prop.pincode || '',
      phone: prop.phone || '',
      email: prop.email || '',
      rating: String(prop.rating || '5.0'),
      amenities: Array.isArray(prop.amenities) ? prop.amenities.join(', ') : (prop.amenities || ''),
      images: Array.isArray(prop.images) ? prop.images[0] : (prop.images || PLACEHOLDER_PROPERTY_IMAGES[0]),
      allow_floor_booking: prop.allow_floor_booking || false,
      allow_full_property_booking: prop.allow_full_property_booking || false,
      allow_pay_at_property: prop.allow_pay_at_property !== false,
    });
    setShowPropertyForm(true);
  };

  const handleSaveProperty = async () => {
    if (!propertyForm.name || !propertyForm.city || !propertyForm.state) {
      return toast.error('Name, city, and state are required');
    }
    setSavingProperty(true);
    try {
      const amenitiesArr = propertyForm.amenities
        ? propertyForm.amenities.split(',').map(a => a.trim()).filter(Boolean)
        : [];
      const imagesArr = propertyForm.images ? [propertyForm.images] : [PLACEHOLDER_PROPERTY_IMAGES[0]];

      const payload = {
        ...propertyForm,
        rating: parseFloat(propertyForm.rating) || 5.0,
        amenities: amenitiesArr,
        images: imagesArr,
      };

      let res;
      if (editingProperty) {
        res = await apiClient.put(`/properties/${editingProperty.id}`, payload);
        setProperties(prev => prev.map(p => p.id === editingProperty.id ? res.data.data : p));
        if (selectedProperty?.id === editingProperty.id) setSelectedProperty(res.data.data);
        toast.success('Property updated');
      } else {
        res = await apiClient.post('/properties', payload);
        setProperties(prev => [res.data.data, ...prev]);
        toast.success('Property created');
      }
      setShowPropertyForm(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save property');
    } finally { setSavingProperty(false); }
  };

  const openPropertyDetail = async (prop) => {
    setSelectedProperty(prop);
    setActiveTab('properties');
    try {
      const res = await apiClient.get(`/properties/${prop.id}/rooms`);
      setPropertyRooms(res.data.data || []);
      // Load bookings for each room
      const rb = {};
      await Promise.all((res.data.data || []).map(async (room) => {
        try {
          const br = await apiClient.get(`/properties/${prop.id}/rooms/${room.id}/bookings`);
          rb[room.id] = br.data.data || [];
        } catch { rb[room.id] = []; }
      }));
      setRoomBookings(rb);
    } catch { toast.error('Failed to load rooms'); }
  };

  const openAddRoom = () => {
    setEditingRoom(null);
    setRoomForm({ ...emptyRoomForm, images: PLACEHOLDER_ROOM_IMAGES[0] });
    setShowRoomForm(true);
  };

  const openEditRoom = (room) => {
    setEditingRoom(room);
    setRoomForm({
      room_number: room.room_number || '',
      room_type: room.room_type || 'Deluxe',
      capacity: String(room.capacity || 2),
      price_per_night: String(room.price_per_night || ''),
      description: room.description || '',
      amenities: Array.isArray(room.amenities) ? room.amenities.join(', ') : (room.amenities || ''),
      images: Array.isArray(room.images) ? room.images[0] : (room.images || PLACEHOLDER_ROOM_IMAGES[0]),
      is_active: room.is_active !== false,
      floor: room.floor || 'Ground Floor',
    });
    setShowRoomForm(true);
  };

  const handleSaveRoom = async () => {
    if (!roomForm.room_number || !roomForm.price_per_night) {
      return toast.error('Room number and price are required');
    }
    setSavingRoom(true);
    try {
      const amenitiesArr = roomForm.amenities
        ? roomForm.amenities.split(',').map(a => a.trim()).filter(Boolean)
        : [];
      const imagesArr = roomForm.images ? [roomForm.images] : [PLACEHOLDER_ROOM_IMAGES[0]];
      const payload = {
        ...roomForm,
        capacity: parseInt(roomForm.capacity) || 2,
        price_per_night: parseFloat(roomForm.price_per_night),
        amenities: amenitiesArr,
        images: imagesArr,
      };

      let res;
      if (editingRoom) {
        res = await apiClient.put(`/properties/${selectedProperty.id}/rooms/${editingRoom.id}`, payload);
        setPropertyRooms(prev => prev.map(r => r.id === editingRoom.id ? res.data.data : r));
        toast.success('Room updated');
      } else {
        res = await apiClient.post(`/properties/${selectedProperty.id}/rooms`, payload);
        setPropertyRooms(prev => [...prev, res.data.data]);
        setRoomBookings(prev => ({ ...prev, [res.data.data.id]: [] }));
        toast.success('Room added');
      }
      setShowRoomForm(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save room');
    } finally { setSavingRoom(false); }
  };

  const getRoomStatus = (roomId) => {
    const bkgs = roomBookings[roomId] || [];
    const today = new Date().toISOString().split('T')[0];
    const occupied = bkgs.find(b => b.check_in_date <= today && b.check_out_date > today);
    if (occupied) return { label: 'Occupied', color: 'bg-red-100 text-red-700', booking: occupied };
    const upcoming = bkgs.find(b => b.check_in_date > today);
    if (upcoming) return { label: `Booked from ${new Date(upcoming.check_in_date).toLocaleDateString()}`, color: 'bg-yellow-100 text-yellow-700', booking: upcoming };
    return { label: 'Available', color: 'bg-green-100 text-green-700', booking: null };
  };

  const handleLogout = () => {
    clearTokens();
    logout();
    navigate('/login');
  };

  // ── Bookings filtering (client-side, debounced search) ────────
  const filteredBookings = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return bookings.filter(b => {
      const matchSearch = !q || (
        (b.user_name || '').toLowerCase().includes(q) ||
        (b.user_email || '').toLowerCase().includes(q) ||
        (b.user_phone || '').toLowerCase().includes(q) ||
        (b.id || '').toLowerCase().includes(q) ||
        (b.room_number || '').toLowerCase().includes(q) ||
        (b.property_name || '').toLowerCase().includes(q) ||
        (b.guest_name || '').toLowerCase().includes(q) ||
        (b.coupon_code || '').toLowerCase().includes(q)
      );
      const matchStatus = !statusFilter || b.status === statusFilter;
      const matchAdminStatus = !adminStatusFilter || b.admin_status === adminStatusFilter;
      return matchSearch && matchStatus && matchAdminStatus;
    });
  }, [bookings, debouncedSearch, statusFilter, adminStatusFilter]);

  // ── Admin status update ───────────────────────────────────────
  const handleStatusAction = async (booking, targetStatus, password = '') => {
    setUpdatingStatus(true);
    try {
      const res = await apiClient.put(`/admin/bookings/${booking.id}/admin-status`, {
        admin_status: targetStatus,
        room_password: password,
      });
      // Update bookings list
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, ...res.data.data } : b));
      setSelectedBooking({ ...selectedBooking, ...res.data.data });
      toast.success(`Booking ${targetStatus.replace('_', ' ')}! Email sent to guest.`);
      setShowPasswordModal(false);
      setRoomPassword('');
      setPendingNextStatus('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update status');
    } finally { setUpdatingStatus(false); }
  };

  const handleActionClick = (booking) => {
    const cfg = ADMIN_STATUS_CONFIG[booking.admin_status];
    if (!cfg || !cfg.next) return;
    if (cfg.next === 'confirmed' || cfg.next === 'password_set') {
      setPendingNextStatus(cfg.next);
      setShowPasswordModal(true);
    } else {
      handleStatusAction(booking, cfg.next);
    }
  };

  // ── Coupons ───────────────────────────────────────────────────
  const handleGenerateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = 'CB' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setCouponForm({ ...couponForm, code });
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!couponForm.code) return toast.error('Code is required');
    if (couponForm.applicable_room_ids.length === 0) return toast.error('Select at least one room');
    setCreatingCoupon(true);
    try {
      const res = await apiClient.post('/admin/coupons', {
        code: couponForm.code,
        applicable_room_ids: couponForm.applicable_room_ids,
        expires_at: couponForm.expires_at || null,
      });
      setCoupons([res.data.data, ...coupons]);
      setCouponForm({ code: '', applicable_room_ids: [], expires_at: '' });
      toast.success('Coupon created! (100% Discount)');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create coupon');
    } finally { setCreatingCoupon(false); }
  };

  const handleVerifyAadhaar = async (userId) => {
    try {
      await apiClient.put(`/admin/users/${userId}/verify-aadhaar`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, aadhaar_verified: true } : u));
      toast.success('Aadhaar verified successfully');
    } catch (error) {
      toast.error('Failed to verify Aadhaar');
    }
  };


  const handleDeleteCoupon = async (couponId) => {
    if (!window.confirm('Delete this coupon?')) return;
    try {
      await apiClient.delete(`/admin/coupons/${couponId}`);
      setCoupons(coupons.filter(c => c.id !== couponId));
      toast.success('Coupon deleted');
    } catch (error) { toast.error('Failed to delete coupon'); }
  };

  const handleToggleCoupon = async (coupon) => {
    try {
      const res = await apiClient.put(`/admin/coupons/${coupon.id}`, { is_active: !coupon.is_active });
      setCoupons(coupons.map(c => c.id === coupon.id ? res.data.data : c));
    } catch (error) { toast.error('Failed to update coupon'); }
  };

  if (loading) {
    return (
      <AdminShell
        title="Admin" subtitle="Loading…"
        tabs={ADMIN_TABS} activeTab={activeTab} onTabChange={setActiveTab}
        onRequestLogout={() => setShowLogoutConfirm(true)} roleLabel="Admin"
      >
        <div className="page-wide py-6 sm:py-8 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="surface p-4 sm:p-6">
                <Sk className="h-11 w-11 rounded-xl mb-4" />
                <Sk className="h-4 w-24 mb-2" />
                <Sk className="h-8 w-16" />
              </div>
            ))}
          </div>
          <div className="surface p-4 sm:p-6">
            <Sk className="h-6 w-40 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Sk key={i} className="h-12 rounded-lg" />)}
            </div>
          </div>
        </div>
      </AdminShell>
    );
  }

  if (loadError) {
    return (
      <AdminShell
        title="Admin" subtitle="Failed to load"
        tabs={ADMIN_TABS} activeTab={activeTab} onTabChange={setActiveTab}
        onRequestLogout={() => setShowLogoutConfirm(true)} roleLabel="Admin"
      >
        <div className="page-wide py-24 flex flex-col items-center text-center gap-3">
          <div className="h-14 w-14 rounded-full bg-red-50 border border-red-100 text-red-500 flex items-center justify-center text-2xl font-black">!</div>
          <h2 className="text-xl font-display font-black text-ink-900">Couldn't load the dashboard</h2>
          <p className="text-sm text-ink-500 max-w-md">
            {loadError?.response?.data?.error || loadError?.message ||
              'The server didn\'t respond. Check your connection and try again.'}
          </p>
          <button onClick={fetchAll} className="btn btn-primary mt-2">
            Retry
          </button>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={ADMIN_TABS.find(t => t.id === activeTab)?.label || 'Admin'}
      subtitle={`Welcome back, ${user?.name?.split(' ')[0] || 'admin'}`}
      tabs={ADMIN_TABS} activeTab={activeTab} onTabChange={setActiveTab}
      onRequestLogout={() => setShowLogoutConfirm(true)} roleLabel="Admin"
    >
      <main className="page-wide py-6 sm:py-8">

        {/* ── DASHBOARD TAB ── */}
        {activeTab === 'dashboard' && dashboardData && (
          <div className="space-y-6">
            {/* Primary KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { Icon: FaUsers, title: 'Total Users', short: 'Users', value: dashboardData.total_users, cls: 'stat-blue', iconCls: 'bg-blue-100 text-blue-600' },
                { Icon: FaBuilding, title: 'Properties', short: 'Props', value: dashboardData.total_properties, cls: 'stat-emerald', iconCls: 'bg-emerald-100 text-emerald-600' },
                { Icon: FaCalendarAlt, title: 'Total Bookings', short: 'Bookings', value: dashboardData.total_bookings, cls: 'stat-purple', iconCls: 'bg-violet-100 text-violet-600' },
                { Icon: FaRupeeSign, title: 'Total Revenue', short: 'Revenue', value: `₹${(dashboardData.total_revenue || 0).toLocaleString()}`, cls: 'stat-rose', iconCls: 'bg-rose-100 text-rose-600' },
              ].map(({ Icon, title, short, value, cls, iconCls }) => (
                <div key={title} className={`${cls} border rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm`}>
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500">
                      <span className="sm:hidden">{short}</span><span className="hidden sm:inline">{title}</span>
                    </p>
                    <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl ${iconCls} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={13} />
                    </div>
                  </div>
                  <p className="stat-number text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            {/* Booking pipeline status */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'New Bookings', val: dashboardData.admin_status_counts?.new_booking || 0, dot: 'bg-amber-400', bar: 'bg-amber-400' },
                { label: 'Confirmed', val: dashboardData.admin_status_counts?.confirmed || 0, dot: 'bg-blue-400', bar: 'bg-blue-400' },
                { label: 'Verified', val: dashboardData.admin_status_counts?.verified || 0, dot: 'bg-violet-400', bar: 'bg-violet-400' },
                { label: 'Password Set', val: dashboardData.admin_status_counts?.password_set || 0, dot: 'bg-emerald-400', bar: 'bg-emerald-400' },
              ].map(({ label, val, dot, bar }) => {
                const total = (dashboardData.total_bookings || 1);
                return (
                  <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-2 w-2 rounded-full ${dot} status-pulse flex-shrink-0`} />
                      <p className="text-xs font-semibold text-gray-500 truncate">{label}</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">{val}</p>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${Math.min(100, (val / total) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">Recent Bookings</h2>
                <button onClick={() => setActiveTab('bookings')} className="text-blue-600 text-sm font-semibold hover:text-blue-700">View All →</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Ref', 'Guest', 'Dates', 'Amount', 'Status', 'Admin Status'].map(h => (
                        <th key={h} className="px-5 py-3 text-left font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.recent_bookings?.map(b => {
                      const cfg = ADMIN_STATUS_CONFIG[b.admin_status];
                      return (
                        <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-5 py-3 font-mono text-gray-600">{b.id.slice(0, 8).toUpperCase()}</td>
                          <td className="px-5 py-3 font-semibold text-gray-900">{b.guest_name || '-'}</td>
                          <td className="px-5 py-3 text-gray-500">
                            {new Date(b.check_in_date).toLocaleDateString()} → {new Date(b.check_out_date).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3 font-semibold">₹{(b.final_price || b.total_price || 0).toLocaleString()}</td>
                          <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_BADGE[b.status] || 'bg-gray-100 text-gray-600'}`}>{b.status}</span></td>
                          <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg?.color || 'bg-gray-100 text-gray-600'}`}>{cfg?.label || b.admin_status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── BOOKINGS TAB ── */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            {/* Search & Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative md:col-span-1">
                  <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input type="text" placeholder="Search name, email, phone, ID, room..." value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition text-sm" />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="">All Payment Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select value={adminStatusFilter} onChange={(e) => setAdminStatusFilter(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="">All Admin Statuses</option>
                  <option value="new_booking">New Booking</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="verified">Verified</option>
                  <option value="password_set">Password Set</option>
                </select>
              </div>
              {(searchQuery || statusFilter || adminStatusFilter) && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-gray-500">{filteredBookings.length} results</span>
                  <button onClick={() => { setSearchQuery(''); setDebouncedSearch(''); setStatusFilter(''); setAdminStatusFilter(''); }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium">Clear filters</button>
                </div>
              )}
            </div>

            {/* Bookings - card list on mobile, table on md+ */}
            {filteredBookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">No bookings found</div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {filteredBookings.map(b => {
                    const cfg = ADMIN_STATUS_CONFIG[b.admin_status];
                    return (
                      <div key={b.id} onClick={() => { setSelectedBooking(b); setShowBookingModal(true); }}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer active:bg-gray-50">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{b.user_name || b.guest_name || '-'}</p>
                            <p className="text-xs text-gray-400 font-mono">{b.id.slice(0, 8).toUpperCase()}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_BADGE[b.status] || 'bg-gray-100 text-gray-600'}`}>{b.status}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg?.color || 'bg-gray-100 text-gray-600 border-gray-200'}`}>{cfg?.label || b.admin_status}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><p className="text-gray-400">Room</p><p className="font-semibold text-gray-800">Room {b.room_number || '-'}</p></div>
                          <div><p className="text-gray-400">Amount</p><p className="font-bold text-gray-900">₹{(b.final_price || b.total_price || 0).toLocaleString()}</p></div>
                          <div><p className="text-gray-400">Check-in</p><p className="font-semibold text-gray-800">{new Date(b.check_in_date).toLocaleDateString()}</p></div>
                          <div><p className="text-gray-400">Check-out</p><p className="font-semibold text-gray-800">{new Date(b.check_out_date).toLocaleDateString()}</p></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {['Ref', 'Guest', 'Room / Property', 'Dates', 'Amount', 'Status', 'Admin Status', ''].map(h => (
                            <th key={h} className="px-5 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBookings.map(b => {
                          const cfg = ADMIN_STATUS_CONFIG[b.admin_status];
                          return (
                            <tr key={b.id} className="border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer"
                              onClick={() => { setSelectedBooking(b); setShowBookingModal(true); }}>
                              <td className="px-5 py-3.5 font-mono text-gray-600 text-xs">{b.id.slice(0, 8).toUpperCase()}</td>
                              <td className="px-5 py-3.5"><p className="font-semibold text-gray-900">{b.user_name || b.guest_name || '-'}</p><p className="text-gray-400 text-xs">{b.user_email || b.guest_email || ''}</p></td>
                              <td className="px-5 py-3.5"><p className="font-medium text-gray-800">Room {b.room_number || '-'}</p><p className="text-gray-400 text-xs">{b.property_name || '-'}</p></td>
                              <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{new Date(b.check_in_date).toLocaleDateString()} →<br />{new Date(b.check_out_date).toLocaleDateString()}</td>
                              <td className="px-5 py-3.5 font-semibold text-gray-900">₹{(b.final_price || b.total_price || 0).toLocaleString()}</td>
                              <td className="px-5 py-3.5"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_BADGE[b.status] || 'bg-gray-100 text-gray-600'}`}>{b.status}</span></td>
                              <td className="px-5 py-3.5"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg?.color || 'bg-gray-100 text-gray-600 border-gray-200'}`}>{cfg?.label || b.admin_status}</span></td>
                              <td className="px-5 py-3.5"><FaChevronRight className="text-gray-300" size={14} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── COUPONS TAB ── */}
        {activeTab === 'coupons' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Create Coupon Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-5">Create Coupon</h2>
                <form onSubmit={handleCreateCoupon} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Coupon Code</label>
                    <div className="flex gap-2">
                      <input type="text" placeholder="e.g. SAVE20" value={couponForm.code}
                        onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono uppercase text-sm" />
                      <button type="button" onClick={handleGenerateCode}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-semibold text-gray-600 transition whitespace-nowrap">
                        Auto
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Applicable Rooms (Select all that apply) *</label>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2">
                      {properties.map(p => (
                        <div key={p.id}>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{p.name}</p>
                          {/* Note: In a real app we'd fetch rooms per property, here we use propertyRooms if selectedProperty matches or just filter all rooms if we have them */}
                          {/* For simplicity in this demo admin, we'll list available rooms from properties we've loaded */}
                          {/* Assuming the admin selects a property first or we have a flat list of rooms */}
                          <div className="grid grid-cols-2 gap-2">
                            {/* We need rooms list. Let's use a simpler multi-select if we don't have global rooms here */}
                            {/* If we don't have all rooms loaded, let's just show a warning or load them */}
                            {allRooms.map(r => (
                              <label key={r.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded transition">
                                <input type="checkbox" checked={couponForm.applicable_room_ids.includes(r.id)}
                                  onChange={(e) => {
                                    const ids = e.target.checked
                                      ? [...couponForm.applicable_room_ids, r.id]
                                      : couponForm.applicable_room_ids.filter(id => id !== r.id);
                                    setCouponForm({ ...couponForm, applicable_room_ids: ids });
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <span className="text-xs font-medium text-gray-700">Room {r.room_number}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                      {allRooms.length === 0 && <p className="text-xs text-gray-400">Select a property to see rooms</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Expiry Date (optional)</label>
                    <input type="datetime-local" value={couponForm.expires_at}
                      onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <button type="submit" disabled={creatingCoupon}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                    <FaPlus size={14} /> {creatingCoupon ? 'Creating...' : 'Create Coupon'}
                  </button>
                </form>
              </div>
            </div>

            {/* Coupons List */}
            <div className="lg:col-span-3">
              <h2 className="text-lg font-bold text-gray-800 mb-5">All Coupons ({coupons.length})</h2>
              {coupons.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                  <FaTag className="text-gray-300 text-4xl mx-auto mb-4" />
                  <p className="text-gray-500">No coupons yet. Create one!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {coupons.map(c => (
                    <div key={c.id} className={`bg-white rounded-2xl shadow-sm border p-5 transition ${c.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-mono font-bold text-lg text-gray-900 tracking-widest">{c.code}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {c.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {c.description && <p className="text-gray-500 text-sm mb-2">{c.description}</p>}
                          <div className="flex flex-wrap gap-3 text-sm">
                            <span className="text-blue-600 font-bold">100% OFF</span>
                            <span className="text-gray-400">
                              One-time use pass
                            </span>
                            <span className="text-gray-400">
                              Rooms: {c.applicable_room_ids?.length || 0}
                            </span>
                            {c.expires_at && (
                              <span className="text-gray-400">Expires: {new Date(c.expires_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleToggleCoupon(c)} className="text-gray-400 hover:text-blue-600 transition p-1" title={c.is_active ? 'Deactivate' : 'Activate'}>
                            {c.is_active ? <FaToggleOn size={20} className="text-green-500" /> : <FaToggleOff size={20} />}
                          </button>
                          <button onClick={() => handleDeleteCoupon(c.id)} className="text-gray-400 hover:text-red-500 transition p-1">
                            <FaTrash size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PROPERTIES TAB ── */}
        {activeTab === 'properties' && !selectedProperty && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Properties ({properties.length})</h2>
              <button onClick={openAddProperty}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition font-semibold text-sm">
                <FaPlus size={12} /> Add Property
              </button>
            </div>

            {properties.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center">
                <FaBuilding className="text-gray-300 text-5xl mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No properties yet</p>
                <button onClick={openAddProperty} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 transition font-semibold text-sm">
                  Add First Property
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((prop) => {
                  const img = prop.images?.[0] || PLACEHOLDER_PROPERTY_IMAGES[0];
                  const propBookings = bookings.filter(b => b.property_id === prop.id && b.status === 'confirmed');
                  return (
                    <div key={prop.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="relative h-48 overflow-hidden">
                        <img src={img} alt={prop.name} loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = PLACEHOLDER_PROPERTY_IMAGES[0]; }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                          <div>
                            <h3 className="text-white font-bold text-lg leading-tight">{prop.name}</h3>
                            <p className="text-gray-300 text-sm">{prop.city}, {prop.state}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${prop.is_active ? 'bg-green-400 text-green-900' : 'bg-red-400 text-red-900'}`}>
                            {prop.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between text-sm text-gray-500 mb-4">
                          <span className="flex items-center gap-1"><FaBed size={12} /> {prop.total_rooms || 0} Rooms</span>
                          <span>⭐ {prop.rating || '-'}</span>
                          <span className="text-blue-600 font-semibold">{propBookings.length} active bookings</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openPropertyDetail(prop)}
                            className="flex-1 bg-gray-900 text-white py-2 rounded-xl hover:bg-blue-600 transition text-sm font-semibold">
                            Manage Rooms
                          </button>
                          <button onClick={() => openEditProperty(prop)}
                            className="px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-600">
                            <FaEdit size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PROPERTY DETAIL (Rooms management) ── */}
        {activeTab === 'properties' && selectedProperty && (
          <div>
            {/* Back + Header */}
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setSelectedProperty(null)}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition text-sm font-medium">
                <FaArrowLeft size={14} /> Back to Properties
              </button>
            </div>

            {/* Property Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
              <div className="relative h-48 md:h-64">
                <img src={selectedProperty.images?.[0] || PLACEHOLDER_PROPERTY_IMAGES[0]} alt={selectedProperty.name} loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = PLACEHOLDER_PROPERTY_IMAGES[0]; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-end">
                  <div>
                    <h2 className="text-white text-3xl font-bold">{selectedProperty.name}</h2>
                    <p className="text-gray-300">{selectedProperty.address}, {selectedProperty.city}, {selectedProperty.state}</p>
                  </div>
                  <button onClick={() => openEditProperty(selectedProperty)}
                    className="flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white border border-white/30 px-4 py-2 rounded-xl hover:bg-white/30 transition text-sm font-semibold">
                    <FaEdit size={13} /> Edit Property
                  </button>
                </div>
              </div>
              <div className="px-6 py-4 flex flex-wrap gap-6 text-sm">
                {selectedProperty.phone && <span className="text-gray-500">📞 {selectedProperty.phone}</span>}
                {selectedProperty.email && <span className="text-gray-500">✉️ {selectedProperty.email}</span>}
                <span className="text-gray-500">⭐ {selectedProperty.rating}</span>
                {selectedProperty.amenities?.length > 0 && (
                  <span className="text-gray-500">✓ {selectedProperty.amenities.slice(0, 3).join(', ')}{selectedProperty.amenities.length > 3 ? '...' : ''}</span>
                )}
              </div>
            </div>

            {/* Rooms section */}
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-gray-800">Rooms ({propertyRooms.length})</h3>
              <button onClick={openAddRoom}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition text-sm font-semibold">
                <FaPlus size={12} /> Add Room
              </button>
            </div>

            {propertyRooms.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                <FaBed className="text-gray-300 text-4xl mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No rooms added yet</p>
                <button onClick={openAddRoom} className="bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 transition text-sm font-semibold">
                  Add First Room
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {propertyRooms.map((room) => {
                  const status = getRoomStatus(room.id);
                  const roomImg = room.images?.[0] || PLACEHOLDER_ROOM_IMAGES[0];
                  const upcomingBookings = (roomBookings[room.id] || []).filter(b => b.check_out_date > new Date().toISOString().split('T')[0]);
                  return (
                    <div key={room.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition ${room.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
                      <div className="relative h-40 overflow-hidden">
                        <img src={roomImg} alt={`Room ${room.room_number}`} loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = PLACEHOLDER_ROOM_IMAGES[0]; }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute top-3 right-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <div className="absolute bottom-3 left-3">
                          <span className="text-white font-bold text-xl">Room {room.room_number}</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-semibold text-gray-800">{room.room_type}</p>
                            <p className="text-gray-500 text-sm">Max {room.capacity} guests</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600 text-lg">₹{room.price_per_night?.toLocaleString()}</p>
                            <p className="text-gray-400 text-xs">per night</p>
                          </div>
                        </div>

                        {/* Upcoming bookings summary */}
                        {upcomingBookings.length > 0 && (
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5 mb-3 text-xs">
                            <p className="font-semibold text-amber-700 mb-1">{upcomingBookings.length} upcoming booking(s)</p>
                            {upcomingBookings.slice(0, 2).map(b => (
                              <p key={b.id} className="text-amber-600">
                                {new Date(b.check_in_date).toLocaleDateString()} → {new Date(b.check_out_date).toLocaleDateString()}
                              </p>
                            ))}
                            {upcomingBookings.length > 2 && <p className="text-amber-500">+{upcomingBookings.length - 2} more</p>}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button onClick={() => openEditRoom(room)}
                            className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 py-2 rounded-xl hover:bg-gray-50 transition text-sm font-semibold text-gray-600">
                            <FaEdit size={12} /> Edit Room
                          </button>
                          {!room.is_active ? (
                            <button onClick={async () => {
                              try {
                                const res = await apiClient.put(`/properties/${selectedProperty.id}/rooms/${room.id}`, { is_active: true });
                                setPropertyRooms(prev => prev.map(r => r.id === room.id ? res.data.data : r));
                                toast.success('Room activated');
                              } catch { toast.error('Failed'); }
                            }} className="px-3 py-2 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition text-xs font-semibold">
                              Activate
                            </button>
                          ) : (
                            <button onClick={async () => {
                              try {
                                const res = await apiClient.put(`/properties/${selectedProperty.id}/rooms/${room.id}`, { is_active: false });
                                setPropertyRooms(prev => prev.map(r => r.id === room.id ? res.data.data : r));
                                toast.success('Room deactivated');
                              } catch { toast.error('Failed'); }
                            }} className="px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition text-xs font-semibold">
                              Disable
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {activeTab === 'users' && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-5">Users ({users.length})</h2>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {users.map(u => (
                <div key={u.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                      {(u.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">{u.phone}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                  {u.email && <p className="text-xs text-gray-500 mb-2 truncate">{u.email}</p>}
                  {u.aadhaar_number ? (
                    <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-gray-700">{u.aadhaar_number}</span>
                      {u.aadhaar_verified ? (
                        <span className="text-green-600 font-bold text-[10px] flex items-center gap-1"><FaCheckCircle size={10} /> Verified</span>
                      ) : (
                        <button onClick={() => handleVerifyAadhaar(u.id)} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200">
                          Verify
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">No Aadhaar on file</span>
                  )}
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>{['Name', 'Email', 'Phone', 'ID Verified', 'Joined'].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-semibold text-gray-600">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3.5 font-semibold text-gray-900">{u.name}</td>
                        <td className="px-5 py-3.5 text-gray-500">{u.email}</td>
                        <td className="px-5 py-3.5 text-gray-500">{u.phone}</td>
                        <td className="px-5 py-3.5">
                          {u.aadhaar_number ? (
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-xs font-bold text-gray-700">{u.aadhaar_number}</span>
                              {u.aadhaar_verified ? (
                                <span className="text-green-600 font-bold text-[10px] flex items-center gap-1 uppercase tracking-wider"><FaCheckCircle size={10} /> Verified</span>
                              ) : (
                                <button onClick={() => handleVerifyAadhaar(u.id)} className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200">Verify Card</button>
                              )}
                              {u.aadhaar_image_url && (
                                <a href={u.aadhaar_image_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 underline hover:text-gray-600">View Card Image</a>
                              )}
                            </div>
                          ) : <span className="text-gray-400 text-xs italic">No Aadhaar</span>}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Booking Detail Modal ── */}
      {showBookingModal && selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => { setShowBookingModal(false); setSelectedBooking(null); }}
          onActionClick={() => handleActionClick(selectedBooking)}
          onPasswordConfirm={() => handleStatusAction(selectedBooking, pendingNextStatus, roomPassword)}
          showPasswordModal={showPasswordModal}
          setShowPasswordModal={setShowPasswordModal}
          roomPassword={roomPassword}
          setRoomPassword={setRoomPassword}
          updatingStatus={updatingStatus}
        />
      )}

      {/* ── Property Form Modal ── */}
      {showPropertyForm && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-5 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingProperty ? 'Edit Property' : 'Add New Property'}
              </h2>
              <button onClick={() => setShowPropertyForm(false)}
                className="h-10 w-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition">
                <FaTimes />
              </button>
            </div>
            <div className="p-8 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Property Name *</label>
                <input type="text" placeholder="e.g. Zero One Goa" value={propertyForm.name}
                  onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea placeholder="Brief description of the property..." value={propertyForm.description}
                  onChange={(e) => setPropertyForm({ ...propertyForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm resize-none" />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
                <input type="text" placeholder="Street address" value={propertyForm.address}
                  onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              {/* City / State / Country */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">City *</label>
                  <input type="text" placeholder="City" value={propertyForm.city}
                    onChange={(e) => setPropertyForm({ ...propertyForm, city: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">State *</label>
                  <input type="text" placeholder="State" value={propertyForm.state}
                    onChange={(e) => setPropertyForm({ ...propertyForm, state: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Country</label>
                  <input type="text" placeholder="India" value={propertyForm.country}
                    onChange={(e) => setPropertyForm({ ...propertyForm, country: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>

              {/* Pincode / Phone / Email */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Pincode</label>
                  <input type="text" placeholder="400001" value={propertyForm.pincode}
                    onChange={(e) => setPropertyForm({ ...propertyForm, pincode: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                  <input type="text" placeholder="+91 98765 43210" value={propertyForm.phone}
                    onChange={(e) => setPropertyForm({ ...propertyForm, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                  <input type="email" placeholder="info@property.com" value={propertyForm.email}
                    onChange={(e) => setPropertyForm({ ...propertyForm, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>

              {/* Rating / Amenities */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Rating (0–5)</label>
                  <input type="number" min="0" max="5" step="0.1" placeholder="5.0" value={propertyForm.rating}
                    onChange={(e) => setPropertyForm({ ...propertyForm, rating: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Amenities (comma-separated)</label>
                  <input type="text" placeholder="Pool, WiFi, Gym, Spa" value={propertyForm.amenities}
                    onChange={(e) => setPropertyForm({ ...propertyForm, amenities: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>

              {/* Booking Options */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-3">Booking Options</label>
                <div className="space-y-3">
                  {[
                    { key: 'allow_floor_booking', label: 'Allow Floor Booking', desc: 'Guests can book an entire floor at once' },
                    { key: 'allow_full_property_booking', label: 'Allow Full Property Booking', desc: 'Guests can book the entire property' },
                    { key: 'allow_pay_at_property', label: 'Allow Pay at Property', desc: 'Guests can choose to pay on arrival' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                      <button type="button" onClick={() => setPropertyForm({ ...propertyForm, [key]: !propertyForm[key] })}
                        className="text-2xl transition">
                        {propertyForm[key]
                          ? <FaToggleOn className="text-green-500" />
                          : <FaToggleOff className="text-gray-400" />
                        }
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Image */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  <FaImage className="inline mr-1" /> Cover Image URL
                </label>
                <input type="text" placeholder="https://..." value={propertyForm.images}
                  onChange={(e) => setPropertyForm({ ...propertyForm, images: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm mb-3" />
                <p className="text-xs text-gray-400 mb-2">Or pick a placeholder:</p>
                <div className="grid grid-cols-3 gap-2">
                  {PLACEHOLDER_PROPERTY_IMAGES.map((img, i) => (
                    <button key={i} type="button"
                      onClick={() => setPropertyForm({ ...propertyForm, images: img })}
                      className={`relative h-20 rounded-xl overflow-hidden border-2 transition ${propertyForm.images === img ? 'border-blue-500' : 'border-transparent hover:border-gray-300'}`}>
                      <img src={img} alt={`Placeholder ${i + 1}`} className="w-full h-full object-cover" />
                      {propertyForm.images === img && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <FaCheckCircle className="text-blue-600 text-xl" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {propertyForm.images && (
                  <div className="mt-3 rounded-xl overflow-hidden h-32">
                    <img src={propertyForm.images} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowPropertyForm(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition font-semibold text-sm">
                  Cancel
                </button>
                <button onClick={handleSaveProperty} disabled={savingProperty}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                  <FaSave size={14} /> {savingProperty ? 'Saving...' : editingProperty ? 'Update Property' : 'Create Property'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Room Form Modal ── */}
      {showRoomForm && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-5 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRoom ? `Edit Room ${editingRoom.room_number}` : 'Add New Room'}
              </h2>
              <button onClick={() => setShowRoomForm(false)}
                className="h-10 w-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition">
                <FaTimes />
              </button>
            </div>
            <div className="p-8 space-y-5">
              {/* Room Number / Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Room Number *</label>
                  <input type="text" placeholder="e.g. 101" value={roomForm.room_number}
                    onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Room Type</label>
                  <select value={roomForm.room_type}
                    onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 text-sm">
                    {['Standard', 'Deluxe', 'Suite', 'Presidential Suite', 'Studio', 'Penthouse', 'Villa'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Capacity / Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Max Capacity (guests)</label>
                  <input type="number" min="1" max="20" placeholder="2" value={roomForm.capacity}
                    onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Price Per Night (₹) *</label>
                  <input type="number" min="0" placeholder="3500" value={roomForm.price_per_night}
                    onChange={(e) => setRoomForm({ ...roomForm, price_per_night: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea placeholder="Room features, view, highlights..." value={roomForm.description}
                  onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm resize-none" />
              </div>

              {/* Floor */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Floor</label>
                <input type="text" placeholder="e.g. Ground Floor, 1st Floor" value={roomForm.floor}
                  onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              {/* Amenities */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Amenities (comma-separated)</label>
                <input type="text" placeholder="AC, TV, Mini Bar, Balcony, Jacuzzi" value={roomForm.amenities}
                  onChange={(e) => setRoomForm({ ...roomForm, amenities: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              {/* Image */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  <FaImage className="inline mr-1" /> Room Image URL
                </label>
                <input type="text" placeholder="https://..." value={roomForm.images}
                  onChange={(e) => setRoomForm({ ...roomForm, images: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-sm mb-3" />
                <p className="text-xs text-gray-400 mb-2">Or pick a placeholder:</p>
                <div className="grid grid-cols-4 gap-2">
                  {PLACEHOLDER_ROOM_IMAGES.map((img, i) => (
                    <button key={i} type="button"
                      onClick={() => setRoomForm({ ...roomForm, images: img })}
                      className={`relative h-16 rounded-xl overflow-hidden border-2 transition ${roomForm.images === img ? 'border-blue-500' : 'border-transparent hover:border-gray-300'}`}>
                      <img src={img} alt={`Room ${i + 1}`} className="w-full h-full object-cover" />
                      {roomForm.images === img && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <FaCheckCircle className="text-blue-600 text-base" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {roomForm.images && (
                  <div className="mt-3 rounded-xl overflow-hidden h-28">
                    <img src={roomForm.images} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                  </div>
                )}
              </div>

              {/* Active toggle */}
              {editingRoom && (
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-sm font-semibold text-gray-700">Room Active</span>
                  <button type="button" onClick={() => setRoomForm({ ...roomForm, is_active: !roomForm.is_active })}
                    className="text-2xl transition">
                    {roomForm.is_active
                      ? <FaToggleOn className="text-green-500" />
                      : <FaToggleOff className="text-gray-400" />
                    }
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowRoomForm(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition font-semibold text-sm">
                  Cancel
                </button>
                <button onClick={handleSaveRoom} disabled={savingRoom}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                  <FaSave size={14} /> {savingRoom ? 'Saving...' : editingRoom ? 'Update Room' : 'Add Room'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LogoutConfirmModal
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        message="You'll need to sign in again to access the admin panel."
      />
    </AdminShell>
  );
}

function BookingDetailModal({
  booking, onClose, onActionClick, onPasswordConfirm,
  showPasswordModal, setShowPasswordModal,
  roomPassword, setRoomPassword, updatingStatus
}) {
  const cfg = ADMIN_STATUS_CONFIG[booking.admin_status];
  const coguests = booking.coguests || [];

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-5 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Booking #{booking.id.slice(0, 8).toUpperCase()}</h2>
            <p className="text-xs text-gray-400">Created {new Date(booking.created_at).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="h-10 w-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition">
            <FaTimes />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* Status */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className={`px-3 py-1.5 rounded-full text-sm font-bold border ${cfg?.color || 'bg-gray-100 text-gray-600'}`}>
              {cfg?.label || booking.admin_status}
            </span>
            <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${STATUS_BADGE[booking.status] || 'bg-gray-100'}`}>
              Payment: {booking.status}
            </span>
          </div>

          {/* Action Button */}
          {booking.status === 'confirmed' && cfg?.next && (
            <div>
              {showPasswordModal ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><FaKey className="text-amber-500" /> Set Room Password</h4>
                  <p className="text-sm text-gray-600 mb-4">Enter the room access password. It will be sent to the guest via email.</p>
                  <input type="text" placeholder="Enter room password" value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-400 font-mono text-lg tracking-widest mb-3 bg-white" />
                  <div className="flex gap-3">
                    <button onClick={onPasswordConfirm} disabled={!roomPassword.trim() || updatingStatus}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2">
                      <FaKey size={14} /> {updatingStatus ? 'Sending...' : 'Confirm & Send Email'}
                    </button>
                    <button onClick={() => setShowPasswordModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold text-gray-600 transition">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={onActionClick} disabled={updatingStatus}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-60">
                  <FaCheckCircle size={16} />
                  {updatingStatus ? 'Updating...' : cfg.action}
                </button>
              )}
            </div>
          )}

          {/* Room Password Display */}
          {booking.admin_status === 'password_set' && booking.room_password && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
              <p className="text-green-700 text-sm font-semibold mb-2 flex items-center justify-center gap-2"><FaKey /> Room Password</p>
              <p className="font-bold text-green-900 text-3xl tracking-widest font-mono">{booking.room_password}</p>
            </div>
          )}

          {/* Guest Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Guest Details</h3>
              <div className="space-y-2 text-sm">
                <InfoRow label="Name" value={booking.user_name || booking.guest_name || '-'} />
                <InfoRow label="Email" value={booking.user_email || booking.guest_email || '-'} />
                <InfoRow label="Phone" value={booking.user_phone || booking.guest_phone || '-'} />
                {booking.user?.id_type && <InfoRow label="ID" value={`${booking.user.id_type}: ${booking.user.id_number || '-'}`} />}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Stay Details</h3>
              <div className="space-y-2 text-sm">
                <InfoRow label="Property" value={booking.property_name || '-'} />
                <InfoRow label="Room" value={`Room ${booking.room_number || '-'} - ${booking.room_type || ''}`} />
                <InfoRow label="Check-in" value={new Date(booking.check_in_date).toLocaleDateString()} />
                <InfoRow label="Check-out" value={new Date(booking.check_out_date).toLocaleDateString()} />
                <InfoRow label="Duration" value={`${booking.number_of_nights} Night(s)`} />
                <InfoRow label="Guests" value={booking.number_of_guests} />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-gray-50 rounded-2xl p-5">
            <h3 className="font-bold text-gray-800 mb-3">Payment Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Base Price</span><span>₹{(booking.total_price || 0).toLocaleString()}</span></div>
              {booking.coupon_code && (
                <div className="flex justify-between text-green-600">
                  <span>Coupon ({booking.coupon_code})</span>
                  <span>- ₹{(booking.discount_amount || 0).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-1">
                <span>Total Paid</span><span>₹{(booking.final_price || booking.total_price || 0).toLocaleString()}</span>
              </div>
              {booking.razorpay_payment_id && (
                <p className="text-gray-400 text-xs">Razorpay ID: {booking.razorpay_payment_id}</p>
              )}
            </div>
          </div>

          {/* Consent */}
          <div className="flex items-center gap-2 text-sm">
            {booking.consent_agreed
              ? <><FaCheckCircle className="text-green-500" /> <span className="text-gray-600">Booking terms accepted</span></>
              : <><span className="text-red-400">✗</span><span className="text-gray-500">Terms not recorded</span></>
            }
          </div>

          {/* Co-guests */}
          {coguests.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Additional Guests ({coguests.length})</h3>
              <div className="space-y-2">
                {coguests.map((g, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                      {(g.name || 'G').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{g.name}</p>
                      <p className="text-xs text-gray-500">{[g.phone, g.email, g.relationship].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {booking.special_requests && (
            <div>
              <h3 className="font-bold text-gray-800 mb-2">Special Requests</h3>
              <p className="text-gray-600 text-sm bg-gray-50 rounded-xl p-3">{booking.special_requests}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 min-w-[80px]">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}

function StatCard({ icon, title, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600', orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className={`${colors[color]} w-11 h-11 rounded-xl flex items-center justify-center mb-4`}>{icon}</div>
      <p className="text-gray-500 text-sm mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
