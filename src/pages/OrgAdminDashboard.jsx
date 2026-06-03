import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store';
import apiClient from '../api/client';
import { clearTokens } from '../api/tokenStorage';
import toast from 'react-hot-toast';
import Sk from '../components/Skeleton';
import DataState from '../components/DataState';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import BookingManagementModal from '../components/BookingManagementModal';
import AdminShell from '../components/AdminShell';
import { OtaSyncStatus } from '../components/OtaSyncStatus';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  FaChartBar, FaUsers, FaCalendarAlt, FaBuilding, FaBars,
  FaPlus, FaTimes, FaSignOutAlt, FaEdit, FaTrash,
  FaShieldAlt, FaCheckCircle, FaSearch, FaBed, FaThLarge,
  FaBell, FaArrowUp, FaArrowDown, FaLock, FaWhatsapp, FaExclamationTriangle,
  FaBroom, FaImage, FaCopy, FaCheck, FaCamera,
} from 'react-icons/fa';

const ALL_TABS = ['Dashboard', 'Rooms', 'Employees', 'Bookings', 'Properties', 'Housekeeping'];
const TAB_ICONS = {
  Dashboard: FaChartBar,
  Rooms: FaThLarge,
  Employees: FaUsers,
  Bookings: FaCalendarAlt,
  Properties: FaBuilding,
  Housekeeping: FaBroom,
};

const PERM_LABELS = {
  bookings_view: 'View Bookings',
  bookings_edit: 'Edit Bookings',
  kyc_view: 'View KYC Records',
  kyc_override: 'KYC Manual Override',
  calendar_view: 'View Calendar',
  calendar_block: 'Block Dates',
  property_view: 'View Properties',
  property_edit: 'Edit Properties',
  reports_download: 'Download Reports',
  inspection_manage: 'Manage Inspections',
  resend_access: 'Resend Guest Access',
  finance_view: 'View Financials',
  housekeeping_submit: 'Submit Housekeeping',
  tasks_view: 'View Tasks',
  tasks_claim: 'Claim Tasks',
  tasks_complete: 'Complete Tasks',
};

const DEPARTMENTS = [
  {
    key: 'housekeeping', label: 'Housekeeping', icon: '🧹',
    summary: 'Cleans rooms after checkout, runs the housekeeping checklist, uploads completion photos.'
  },
  {
    key: 'kyc_ops', label: 'KYC Operations', icon: '🪪',
    summary: 'Reviews KYC submissions, approves/rejects, maintains verification records.'
  },
  {
    key: 'reception', label: 'Reception / Front Desk', icon: '🛎️',
    summary: 'Manages check-ins, checkouts, guest coordination, resends access details.'
  },
  {
    key: 'finance', label: 'Finance', icon: '💳',
    summary: 'Owns payments, refunds, reports, expense tracking, revenue reconciliation.'
  },
];

const INPUT_CLS = 'input-base text-sm';
const LABEL_CLS = 'block text-3xs font-bold text-ink-500 mb-1.5 uppercase tracking-widest';

// Module-level stable empty object - used as a fallback when user has no
// permissions block. Keeping the same reference across renders prevents
// useMemo / useCallback dependencies from churning.
const EMPTY_PERMS = Object.freeze({});

export default function OrgAdminDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const role = user?.role;
  const isOrgAdmin = role === 'org_admin' || role === 'admin' || role === 'global_admin';
  // Use a frozen module-level fallback so the reference is stable when the
  // user has no permissions block. A fresh `{}` literal each render would
  // make TABS / fetchAll deps churn and trigger an infinite API loop.
  const perms = user?.permissions || EMPTY_PERMS;

  const TABS = React.useMemo(() => ALL_TABS.filter(t => {
    if (t === 'Employees') return isOrgAdmin;
    if (isOrgAdmin) return true;

    // Employee logic: Restrict tabs to assigned rights
    if (t === 'Dashboard') return perms.bookings_view || perms.calendar_view || perms.property_view;
    if (t === 'Rooms') return perms.calendar_view || perms.property_view;
    if (t === 'Bookings') return perms.bookings_view;
    if (t === 'Properties') return perms.property_view;
    if (t === 'Housekeeping') return perms.inspection_manage;
    return false;
  }), [isOrgAdmin, perms]);

  const [tab, setTab] = useState(() => TABS.length > 0 ? TABS[0] : 'Dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [planUsage, setPlanUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState(null);
  const [search, setSearch] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [manageBookingId, setManageBookingId] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Alerts
  const [alerts, setAlerts] = useState(null);

  // Room grid
  const [roomGrid, setRoomGrid] = useState([]);
  const [roomGridDate, setRoomGridDate] = useState(new Date().toISOString().split('T')[0]);
  const [roomGridLoading, setRoomGridLoading] = useState(false);

  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editEmpPerms, setEditEmpPerms] = useState(null);
  const [empForm, setEmpForm] = useState({
    name: '', phone: '', email: '', password: '',
    department: '', assigned_property_ids: [],
    employee_code: '', shift_start: '', shift_end: '',
  });
  const [permForm, setPermForm] = useState({});

  const [showPropModal, setShowPropModal] = useState(false);
  const [editingProp, setEditingProp] = useState(null); // null = create, object = edit
  const [propForm, setPropForm] = useState({
    name: '', address: '', city: '', state: '', phone: '', email: '',
    check_in_time: '14:00', check_out_time: '11:00',
    razorpay_key_id: '', razorpay_key_secret: '', razorpay_account_label: '',
    late_checkout_charge_per_hour: '', late_checkout_grace_minutes: 30,
    aiosell_hotel_code: '', gstin: '', gst_rate: '',
  });
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedPropForRoom, setSelectedPropForRoom] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null); // null = create, object = edit
  const [roomForm, setRoomForm] = useState({
    room_number: '', room_name: '', room_type: 'Standard', floor: 'Ground Floor',
    bed_type: 'Double', bed_count: 1, extra_bed_available: false,
    size_sqft: '', view_type: '', bathroom_type: 'Attached', has_bathtub: false,
    capacity: 2, max_occupancy: 2, smoking_allowed: false, accessibility: false,
    amenities: [], images: [],
    price_per_night: '', weekend_rate: '', ota_price: '',
    late_checkout_charge_per_hour: '',
    aiosell_room_code: '',
    description: '',
  });
  const [roomImageFiles, setRoomImageFiles] = useState([]);
  const [uploadingRoomImages, setUploadingRoomImages] = useState(false);
  const [propImageFiles, setPropImageFiles] = useState([]);
  const [uploadingPropImages, setUploadingPropImages] = useState(false);

  // Housekeeping
  const [housekeeping, setHousekeeping] = useState([]);
  const [housekeepingLoading, setHousekeepingLoading] = useState(false);
  const [clearingId, setClearingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [viewingPhotos, setViewingPhotos] = useState(null);

  // Checklist config
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [checklistProp, setChecklistProp] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [savingChecklist, setSavingChecklist] = useState(false);

  // Per-action loading states
  const [savingEmp, setSavingEmp] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);
  const [savingProp, setSavingProp] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState(null);

  // Stable derived flags - keep these primitive so dependent effects don't churn.
  const canSeeDashboard = isOrgAdmin || !!(perms.bookings_view || perms.calendar_view || perms.property_view);

  useEffect(() => {
    if (TABS.length > 0 && !TABS.includes(tab)) {
      setTab(TABS[0]);
    }
  }, [TABS, tab]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    let dashFailure = null;
    try {
      const promises = [];
      if (canSeeDashboard) {
        // Only the primary dashboard call drives the full-page error state.
        // Secondary widgets (plan usage / alerts) degrade silently.
        promises.push(apiClient.get('/org-admin/dashboard').then(r => r.data.data)
          .catch((err) => { dashFailure = err; return null; }));
        promises.push(apiClient.get('/org-admin/plan-usage').then(r => r.data.data).catch(() => null));
        promises.push(apiClient.get('/ops/alerts?hours=48').then(r => r.data.data).catch(() => null));
      } else {
        promises.push(Promise.resolve(null));
        promises.push(Promise.resolve(null));
        promises.push(Promise.resolve(null));
      }

      if (isOrgAdmin) {
        promises.push(apiClient.get('/org-admin/employees').then(r => r.data.data || []).catch(() => []));
      } else {
        promises.push(Promise.resolve(null));
      }

      const [dashRes, planRes, alertRes, empRes] = await Promise.all(promises);
      if (dashRes !== null) setDashboard(dashRes);
      if (planRes !== null) setPlanUsage(planRes);
      if (alertRes !== null) setAlerts(alertRes);
      if (empRes !== null) setEmployees(empRes);
      if (canSeeDashboard && dashFailure) {
        // Backend failed - show an explicit error + retry rather than an
        // empty-looking dashboard.
        setLoadError(dashFailure);
        toast.error('Failed to load dashboard');
      }
    } catch (e) {
      setLoadError(e);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [isOrgAdmin, canSeeDashboard]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function fetchBookings() {
    setBookingsLoading(true);
    setBookingsError(null);
    try {
      const res = await apiClient.get('/employee/bookings');
      setBookings(res.data.data || []);
    } catch (e) {
      setBookingsError(e);
      toast.error(e.response?.data?.error || 'Failed to load bookings');
    } finally { setBookingsLoading(false); }
  }


  async function fetchProperties() {
    try {
      const res = await apiClient.get('/org-admin/properties');
      setProperties(res.data.data || []);
    } catch { toast.error('Failed to load properties'); }
  }

  useEffect(() => {
    if (tab === 'Dashboard' && canSeeDashboard) fetchRoomGrid(new Date().toISOString().split('T')[0]);
    else if (tab === 'Bookings') fetchBookings();
    else if (tab === 'Properties') fetchProperties();
    else if (tab === 'Rooms') fetchRoomGrid(roomGridDate);
    else if (tab === 'Housekeeping') fetchHousekeeping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, roomGridDate, canSeeDashboard]);

  async function fetchHousekeeping() {
    setHousekeepingLoading(true);
    try {
      const res = await apiClient.get('/org-admin/housekeeping');
      setHousekeeping(res.data.data || []);
    } catch { toast.error('Failed to load housekeeping status'); }
    finally { setHousekeepingLoading(false); }
  }

  async function autoClear(bookingId) {
    setClearingId(bookingId);
    try {
      await apiClient.post(`/housekeeping/auto-clear/${bookingId}`);
      toast.success('Room auto-cleared');
      fetchHousekeeping();
    } catch { toast.error('Failed to auto-clear'); }
    finally { setClearingId(null); }
  }

  function copyHousekeepingLink(bookingId) {
    const url = `${window.location.origin}/housekeeping/${bookingId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(bookingId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  async function openChecklistModal(prop) {
    setChecklistProp(prop);
    setNewItemLabel('');
    try {
      const res = await apiClient.get(`/org-admin/housekeeping/checklist/${prop.id}`);
      setChecklistItems((res.data.data?.items || []).map(i =>
        typeof i === 'string' ? { label: i, required: false } : i
      ));
    } catch { setChecklistItems([]); }
    setShowChecklistModal(true);
  }

  async function saveChecklist() {
    if (!checklistProp) return;
    setSavingChecklist(true);
    try {
      await apiClient.put(`/org-admin/housekeeping/checklist/${checklistProp.id}`, { items: checklistItems });
      toast.success('Checklist saved');
      setShowChecklistModal(false);
    } catch { toast.error('Failed to save checklist'); }
    finally { setSavingChecklist(false); }
  }

  async function fetchRoomGrid(date) {
    setRoomGridLoading(true);
    try {
      const res = await apiClient.get(`/org-admin/room-grid?date=${date}`);
      setRoomGrid(res.data.data || []);
    } catch {
      toast.error('Failed to load room grid');
    } finally {
      setRoomGridLoading(false);
    }
  }

  function handleRoomGridDateChange(date) {
    setRoomGridDate(date);
    fetchRoomGrid(date);
  }

  async function createEmployee() {
    if (!empForm.department) { toast.error('Pick a department'); return; }
    setSavingEmp(true);
    try {
      await apiClient.post('/org-admin/employees', {
        name: empForm.name,
        phone: empForm.phone,
        email: empForm.email || undefined,
        password: empForm.password || undefined,
        department: empForm.department,
        assigned_property_ids: empForm.assigned_property_ids?.length ? empForm.assigned_property_ids : null,
        employee_code: empForm.employee_code || undefined,
        shift_start: empForm.shift_start || undefined,
        shift_end: empForm.shift_end || undefined,
      });
      toast.success('Employee created');
      setShowEmpModal(false);
      setEmpForm({
        name: '', phone: '', email: '', password: '',
        department: '', assigned_property_ids: [],
        employee_code: '', shift_start: '', shift_end: '',
      });
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to create employee');
    } finally {
      setSavingEmp(false);
    }
  }

  async function updateEmployee() {
    setSavingPerms(true);
    try {
      await apiClient.put(`/org-admin/employees/${editEmpPerms.id}`, {
        department: permForm.department,
        assigned_property_ids: permForm.assigned_property_ids?.length ? permForm.assigned_property_ids : null,
      });
      toast.success('Employee updated');
      setEditEmpPerms(null);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update employee');
    } finally {
      setSavingPerms(false);
    }
  }

  async function deactivateEmployee(empId) {
    if (!window.confirm('Deactivate this employee?')) return;
    setDeactivatingId(empId);
    try {
      await apiClient.delete(`/org-admin/employees/${empId}`);
      toast.success('Employee deactivated');
      fetchAll();
    } catch (e) {
      toast.error('Failed to deactivate');
    } finally {
      setDeactivatingId(null);
    }
  }

  const EMPTY_PROP_FORM = {
    name: '', address: '', city: '', state: '', phone: '', email: '',
    check_in_time: '14:00', check_out_time: '11:00',
    razorpay_key_id: '', razorpay_key_secret: '', razorpay_account_label: '',
    late_checkout_charge_per_hour: '', late_checkout_grace_minutes: 30,
    aiosell_hotel_code: '', gstin: '', gst_rate: '',
    images: [],
  };

  function openAddProperty() {
    setEditingProp(null);
    setPropForm({ ...EMPTY_PROP_FORM });
    setPropImageFiles([]);
    setShowPropModal(true);
  }

  function openEditProperty(prop) {
    setEditingProp(prop);
    setPropForm({
      name: prop.name || '',
      address: prop.address || '',
      city: prop.city || '',
      state: prop.state || '',
      phone: prop.phone || '',
      email: prop.email || '',
      check_in_time: prop.check_in_time || '14:00',
      check_out_time: prop.check_out_time || '11:00',
      description: prop.description || '',
      pincode: prop.pincode || '',
      razorpay_key_id: prop.razorpay_key_id || '',
      razorpay_key_secret: '', // never returned by API; leave blank to keep existing
      razorpay_account_label: prop.razorpay_account_label || '',
      late_checkout_charge_per_hour: prop.late_checkout_charge_per_hour ?? '',
      late_checkout_grace_minutes: prop.late_checkout_grace_minutes ?? 30,
      aiosell_hotel_code: prop.aiosell_hotel_code || '',
      gstin: prop.gstin || '',
      gst_rate: prop.gst_rate ?? '',
      images: prop.images || [],
    });
    setPropImageFiles([]);
    setShowPropModal(true);
  }

  function closePropModal() {
    setShowPropModal(false);
    setEditingProp(null);
    setPropForm({ ...EMPTY_PROP_FORM });
    setPropImageFiles([]);
  }

  async function saveProperty() {
    if (editingProp) {
      await updateProperty();
    } else {
      await createProperty();
    }
  }

  async function uploadPropImages(propertyId) {
    if (!propImageFiles.length) return [];
    setUploadingPropImages(true);
    try {
      const fd = new FormData();
      propImageFiles.forEach(f => fd.append('images', f));
      const r = await apiClient.post(
        `/org-admin/properties/${propertyId}/upload-image`,
        fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return r.data.urls || [];
    } finally {
      setUploadingPropImages(false);
    }
  }

  async function createProperty() {
    if (!propForm.name || !propForm.city || !propForm.state) {
      toast.error('Name, city, and state are required');
      return;
    }
    setSavingProp(true);
    try {
      const res = await apiClient.post('/org-admin/properties', propForm);
      // Property must exist before its photos can be uploaded (the
      // bucket path is keyed by property id).
      const newId = res.data?.data?.id || res.data?.id || res.data?.property?.id;
      if (newId && propImageFiles.length) {
        const urls = await uploadPropImages(newId);
        if (urls.length) {
          await apiClient.put(`/org-admin/properties/${newId}`, {
            images: [...(propForm.images || []), ...urls],
          });
        }
      }
      toast.success('Property created');
      closePropModal();
      fetchProperties();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to create property');
    } finally {
      setSavingProp(false);
    }
  }

  async function updateProperty() {
    if (!editingProp || !propForm.name || !propForm.city || !propForm.state) {
      toast.error('Name, city, and state are required');
      return;
    }
    setSavingProp(true);
    try {
      // Don't clobber the stored Razorpay secret when the input is left blank.
      const payload = { ...propForm };
      if (!payload.razorpay_key_secret) {
        delete payload.razorpay_key_secret;
      }
      if (propImageFiles.length) {
        const urls = await uploadPropImages(editingProp.id);
        payload.images = [...(propForm.images || []), ...urls];
      }
      await apiClient.put(`/org-admin/properties/${editingProp.id}`, payload);
      toast.success('Property updated');
      closePropModal();
      fetchProperties();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update property');
    } finally {
      setSavingProp(false);
    }
  }

  const EMPTY_ROOM_FORM = {
    room_number: '', room_name: '', room_type: 'Standard', floor: 'Ground Floor',
    bed_type: 'Double', bed_count: 1, extra_bed_available: false,
    size_sqft: '', view_type: '', bathroom_type: 'Attached', has_bathtub: false,
    capacity: 2, max_occupancy: 2, smoking_allowed: false, accessibility: false,
    amenities: [], images: [],
    price_per_night: '', weekend_rate: '', ota_price: '',
    late_checkout_charge_per_hour: '',
    aiosell_room_code: '',
    description: '',
  };

  function openAddRoom(prop) {
    setEditingRoom(null);
    setSelectedPropForRoom(prop);
    setRoomForm({ ...EMPTY_ROOM_FORM });
    setRoomImageFiles([]);
    setShowRoomModal(true);
  }

  function openEditRoom(prop, room) {
    setEditingRoom(room);
    setSelectedPropForRoom(prop);
    setRoomForm({
      room_number: room.room_number || '',
      room_name: room.room_name || '',
      room_type: room.room_type || 'Standard',
      floor: room.floor || 'Ground Floor',
      bed_type: room.bed_type || 'Double',
      bed_count: room.bed_count || 1,
      extra_bed_available: room.extra_bed_available || false,
      size_sqft: room.size_sqft || '',
      view_type: room.view_type || '',
      bathroom_type: room.bathroom_type || 'Attached',
      has_bathtub: room.has_bathtub || false,
      capacity: room.capacity || 2,
      max_occupancy: room.max_occupancy || room.capacity || 2,
      smoking_allowed: room.smoking_allowed || false,
      accessibility: room.accessibility || false,
      amenities: room.amenities || [],
      images: room.images || [],
      price_per_night: room.price_per_night || '',
      weekend_rate: room.weekend_rate || '',
      ota_price: room.ota_price || '',
      late_checkout_charge_per_hour: room.late_checkout_charge_per_hour ?? '',
      aiosell_room_code: room.aiosell_room_code || '',
      description: room.description || '',
    });
    setRoomImageFiles([]);
    setShowRoomModal(true);
  }

  async function saveRoom() {
    if (editingRoom) {
      await updateRoom();
    } else {
      await createRoom();
    }
  }

  async function createRoom() {
    if (!selectedPropForRoom) return;
    if (!roomForm.room_number || !roomForm.room_type || !roomForm.price_per_night) {
      toast.error('Room number, type, and price are required');
      return;
    }
    setSavingRoom(true);
    try {
      let imageUrls = [...(roomForm.images || [])];
      if (roomImageFiles.length > 0) {
        setUploadingRoomImages(true);
        try {
          const fd = new FormData();
          roomImageFiles.forEach(f => fd.append('images', f));
          const uploadRes = await apiClient.post(
            `/org-admin/properties/${selectedPropForRoom.id}/rooms/upload-image`,
            fd, { headers: { 'Content-Type': 'multipart/form-data' } }
          );
          imageUrls = [...imageUrls, ...(uploadRes.data.urls || [])];
        } catch { toast.error('Image upload failed - room will be saved without photos'); }
        finally { setUploadingRoomImages(false); }
      }

      await apiClient.post(`/org-admin/properties/${selectedPropForRoom.id}/rooms`, {
        ...roomForm,
        images: imageUrls,
        capacity: Number(roomForm.capacity) || 2,
        max_occupancy: Number(roomForm.max_occupancy) || Number(roomForm.capacity) || 2,
        price_per_night: Number(roomForm.price_per_night),
        weekend_rate: roomForm.weekend_rate ? Number(roomForm.weekend_rate) : undefined,
        ota_price: roomForm.ota_price ? Number(roomForm.ota_price) : undefined,
        late_checkout_charge_per_hour: roomForm.late_checkout_charge_per_hour !== '' && roomForm.late_checkout_charge_per_hour != null
          ? Number(roomForm.late_checkout_charge_per_hour) : undefined,
        bed_count: Number(roomForm.bed_count) || 1,
        size_sqft: roomForm.size_sqft ? Number(roomForm.size_sqft) : undefined,
      });
      toast.success('Room added');
      closeRoomModal();
      fetchProperties();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to add room');
    } finally {
      setSavingRoom(false);
    }
  }

  async function updateRoom() {
    if (!selectedPropForRoom || !editingRoom) return;
    if (!roomForm.room_number || !roomForm.room_type || !roomForm.price_per_night) {
      toast.error('Room number, type, and price are required');
      return;
    }
    setSavingRoom(true);
    try {
      let imageUrls = [...(roomForm.images || [])];
      if (roomImageFiles.length > 0) {
        setUploadingRoomImages(true);
        try {
          const fd = new FormData();
          roomImageFiles.forEach(f => fd.append('images', f));
          const uploadRes = await apiClient.post(
            `/org-admin/properties/${selectedPropForRoom.id}/rooms/upload-image`,
            fd, { headers: { 'Content-Type': 'multipart/form-data' } }
          );
          imageUrls = [...imageUrls, ...(uploadRes.data.urls || [])];
        } catch { toast.error('Image upload failed - other changes will still be saved'); }
        finally { setUploadingRoomImages(false); }
      }

      await apiClient.put(`/org-admin/properties/${selectedPropForRoom.id}/rooms/${editingRoom.id}`, {
        ...roomForm,
        images: imageUrls,
        capacity: Number(roomForm.capacity) || 2,
        max_occupancy: Number(roomForm.max_occupancy) || Number(roomForm.capacity) || 2,
        price_per_night: Number(roomForm.price_per_night),
        weekend_rate: roomForm.weekend_rate ? Number(roomForm.weekend_rate) : undefined,
        ota_price: roomForm.ota_price ? Number(roomForm.ota_price) : undefined,
        late_checkout_charge_per_hour: roomForm.late_checkout_charge_per_hour !== '' && roomForm.late_checkout_charge_per_hour != null
          ? Number(roomForm.late_checkout_charge_per_hour) : undefined,
        bed_count: Number(roomForm.bed_count) || 1,
        size_sqft: roomForm.size_sqft ? Number(roomForm.size_sqft) : undefined,
      });
      toast.success('Room updated');
      closeRoomModal();
      fetchProperties();
      if (tab === 'Rooms') fetchRoomGrid(roomGridDate);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update room');
    } finally {
      setSavingRoom(false);
    }
  }

  function closeRoomModal() {
    setShowRoomModal(false);
    setEditingRoom(null);
    setSelectedPropForRoom(null);
    setRoomImageFiles([]);
    setRoomForm({ ...EMPTY_ROOM_FORM });
  }

  function handleLogout() {
    logout();
    clearTokens();
    navigate('/login');
  }

  const filteredBookings = bookings.filter(b =>
    !search ||
    b.guest_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.id?.toLowerCase().includes(search.toLowerCase())
  );

  const userInitial = user?.name?.charAt(0).toUpperCase() || '?';
  const roleLabel = isOrgAdmin ? 'Org Admin' : 'Staff';

  const SHELL_TABS = TABS.map(t => ({ id: t, label: t, icon: TAB_ICONS[t] }));

  if (loading) return (
    <AdminShell
      title="Dashboard" subtitle="Loading…"
      tabs={SHELL_TABS} activeTab={tab} onTabChange={setTab}
      onRequestLogout={() => setShowLogoutConfirm(true)} roleLabel={roleLabel}
    >
      <div className="page-wide py-5 sm:py-8 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface p-4 sm:p-5">
              <Sk className="h-10 w-10 rounded-xl mb-4" />
              <Sk className="h-4 w-24 mb-2" />
              <Sk className="h-8 w-20" />
            </div>
          ))}
        </div>
        <div className="surface p-5">
          <Sk className="h-5 w-40 mb-4" />
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
            {Array.from({ length: 16 }).map((_, i) => <Sk key={i} className="h-16 rounded-xl" />)}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Sk className="h-64 rounded-2xl" />
          <Sk className="h-64 rounded-2xl" />
        </div>
      </div>
    </AdminShell>
  );

  if (loadError) return (
    <AdminShell
      title="Dashboard" subtitle="Failed to load"
      tabs={SHELL_TABS} activeTab={tab} onTabChange={setTab}
      onRequestLogout={() => setShowLogoutConfirm(true)} roleLabel={roleLabel}
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

  return (
    <AdminShell
      title={tab}
      subtitle={tab === 'Dashboard' ? `Welcome back, ${user?.name?.split(' ')[0] || 'admin'}` : null}
      tabs={SHELL_TABS} activeTab={tab} onTabChange={setTab}
      onRequestLogout={() => setShowLogoutConfirm(true)} roleLabel={roleLabel}
    >
      {/* ── PAGE CONTENT ── */}
      <div className="page-wide py-5 sm:py-7 md:py-8 pb-24 md:pb-8">

        {/* ── DASHBOARD TAB ── */}
        {tab === 'Dashboard' && dashboard && (
          <div className="space-y-5">

            {/* Plan limit warning */}
            {planUsage && !planUsage.within_limit && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <FaExclamationTriangle className="text-amber-500 mt-0.5 flex-shrink-0" size={16} />
                <p className="text-sm text-amber-800 font-medium">{planUsage.upgrade_message}</p>
              </div>
            )}

            {/* ── Stat summary cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {[
                { label: "Tonight's Check-ins", short: 'Check-ins', value: dashboard.checkins_today || 0, Icon: FaCalendarAlt, cls: 'stat-rose', iconCls: 'bg-rose-100 text-rose-600' },
                { label: 'Confirmed Bookings', short: 'Bookings', value: dashboard.confirmed_bookings || 0, Icon: FaCheckCircle, cls: 'stat-emerald', iconCls: 'bg-emerald-100 text-emerald-600' },
                { label: 'Revenue This Month', short: 'Revenue', value: `₹${(dashboard.revenue_this_month || 0).toLocaleString()}`, Icon: FaChartBar, cls: 'stat-blue', iconCls: 'bg-blue-100 text-blue-600', show: (isOrgAdmin || perms.finance_view) },
                { label: 'Co-guest Pending', short: 'Pending', value: dashboard.co_guest_pending_count || 0, Icon: FaUsers, cls: 'stat-amber', iconCls: 'bg-amber-100 text-amber-600' },
              ].filter(c => c.show !== false).map(({ label, short, value, Icon, cls, iconCls }) => (
                <div key={label} className={`${cls} border rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm enter-up`}>
                  <div className="flex items-start justify-between mb-2.5 sm:mb-3">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500 leading-tight">
                      <span className="sm:hidden">{short}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </p>
                    <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl ${iconCls} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={11} />
                    </div>
                  </div>
                  <p className="stat-number text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            {/* ── Tonight's occupancy room grid ── */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-gray-50 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Tonight</p>
                  <p className="font-black text-gray-900 tracking-tight">Occupancy Overview</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {[
                    { dot: 'bg-emerald-500', label: 'Available' },
                    { dot: 'bg-rose-500', label: 'Occupied' },
                    { dot: 'bg-amber-400', label: 'Check-in' },
                    { dot: 'bg-teal-500', label: 'Check-out' },
                    { dot: 'bg-gray-300', label: 'Blocked' },
                  ].map(({ dot, label }) => (
                    <span key={label} className="flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                      <span className={`h-2 w-2 rounded-full ${dot}`} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              {roomGridLoading ? (
                <div className="flex justify-center py-10">
                  <div className="h-8 w-8 border-[3px] border-rose-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : roomGrid.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">No properties or rooms set up yet.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {roomGrid.map(prop => (
                    <div key={prop.id} className="px-5 py-4">
                      {/* Property name + summary */}
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <p className="font-bold text-gray-800 text-sm">{prop.name}</p>
                        <div className="flex items-center gap-2 text-[10px] font-bold">
                          <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{prop.available} free</span>
                          <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{prop.occupied} occupied</span>
                          {prop.blocked > 0 && <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{prop.blocked} blocked</span>}
                        </div>
                      </div>
                      {prop.rooms.length === 0 ? (
                        <p className="text-xs text-gray-400">No rooms added.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-2">
                          {prop.rooms.map(room => {
                            const cfg = {
                              available: { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700' },
                              occupied: { bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500', text: 'text-rose-700' },
                              checkin: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700' },
                              checkout: { bg: 'bg-teal-50', border: 'border-teal-200', dot: 'bg-teal-500', text: 'text-teal-700' },
                              blocked: { bg: 'bg-gray-100', border: 'border-gray-200', dot: 'bg-gray-400', text: 'text-gray-500' },
                            }[room.status] || { bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400', text: 'text-gray-500' };
                            return (
                              <div key={room.id} title={room.guest_name ? `${room.guest_name} · ${room.check_in} → ${room.check_out}` : room.status}
                                className={`${cfg.bg} border ${cfg.border} rounded-xl p-2.5 flex flex-col gap-1`}>
                                <div className="flex items-center justify-between">
                                  <p className="font-black text-gray-900 text-xs leading-none">{room.room_number}</p>
                                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                </div>
                                <p className="text-[9px] text-gray-500 leading-none truncate">{room.room_type}</p>
                                {room.guest_name && (
                                  <p className={`text-[9px] font-semibold leading-none truncate ${cfg.text}`}>{room.guest_name}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Check-ins today + Co-guest pending (2-col on desktop) ── */}
            <div className="grid md:grid-cols-2 gap-5">

              {/* Upcoming check-ins today */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Today</p>
                  <p className="font-black text-gray-900">Upcoming Check-ins
                    {dashboard.checkins_today > 0 && (
                      <span className="ml-2 text-sm font-semibold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">{dashboard.checkins_today}</span>
                    )}
                  </p>
                </div>
                {(dashboard.checkins_today_list || []).length === 0 ? (
                  <div className="px-5 py-8 text-center text-gray-400 text-sm">No check-ins scheduled for today.</div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                    {dashboard.checkins_today_list.map(b => (
                      <div key={b.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-rose-100 to-rose-200 flex items-center justify-center text-rose-600 text-sm font-black flex-shrink-0">
                            {(b.guest_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{b.guest_name || '-'}</p>
                            <p className="text-xs text-gray-400">
                              {b.room_number ? `Room ${b.room_number}` : '-'}
                              {b.room_type ? ` · ${b.room_type}` : ''}
                              {b.floor ? ` · ${b.floor}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 flex-shrink-0 ${b.kyc_completed ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                          <FaShieldAlt size={8} />
                          {b.kyc_completed ? 'KYC ✓' : 'KYC Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Co-guest pending */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Compliance</p>
                  <p className="font-black text-gray-900">Co-guest Pending
                    {dashboard.co_guest_pending_count > 0 && (
                      <span className="ml-2 text-sm font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{dashboard.co_guest_pending_count}</span>
                    )}
                  </p>
                </div>
                {(dashboard.co_guest_pending_list || []).length === 0 ? (
                  <div className="px-5 py-8 text-center text-gray-400 text-sm">All co-guest details are up to date.</div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                    {dashboard.co_guest_pending_list.map(b => (
                      <div key={b.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{b.guest_name || '-'}</p>
                          <p className="text-xs text-gray-400">{b.check_in_date} · {b.number_of_guests} guest{b.number_of_guests !== 1 ? 's' : ''}</p>
                        </div>
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 flex-shrink-0 whitespace-nowrap">
                          {b.missing} missing
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Revenue + Booking trend (2-col on desktop) ── */}
            {(isOrgAdmin || perms.finance_view) && (
              <div className="grid md:grid-cols-2 gap-4 sm:gap-5">

                {/* Revenue this month */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Revenue</p>
                  <div className="flex items-end gap-3 mb-1">
                    <p className="text-2xl font-black text-gray-900">₹{(dashboard.revenue_this_month || 0).toLocaleString()}</p>
                    {(() => {
                      const cur = dashboard.revenue_this_month || 0;
                      const prev = dashboard.revenue_last_month || 0;
                      if (prev === 0 && cur === 0) return null;
                      const pct = prev === 0 ? 100 : Math.round(((cur - prev) / prev) * 100);
                      const up = cur >= prev;
                      return (
                        <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mb-1 ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                          {up ? <FaArrowUp size={9} /> : <FaArrowDown size={9} />}
                          {Math.abs(pct)}%
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-gray-400 mb-4">vs ₹{(dashboard.revenue_last_month || 0).toLocaleString()} last month</p>
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={dashboard.revenue_30d || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => [`₹${Number(v).toLocaleString()}`, 'Revenue']} contentStyle={{ border: '1px solid #f3f4f6', borderRadius: '10px', fontSize: 11 }} />
                      <Line type="monotone" dataKey="revenue" stroke="#f43f5e" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#f43f5e' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 30-day booking trend */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Bookings</p>
                  <p className="font-black text-gray-900 mb-4">30-Day Trend</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={dashboard.booking_volume_30d || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} />
                      <Tooltip contentStyle={{ border: '1px solid #f3f4f6', borderRadius: '10px', fontSize: 11 }} />
                      <Line type="monotone" dataKey="count" stroke="#f43f5e" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#f43f5e' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Plan usage + Alerts (2-col on desktop) ── */}
            <div className="grid md:grid-cols-2 gap-4 sm:gap-5">

              {/* Plan usage */}
              {planUsage?.max_rooms ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Membership</p>
                  <div className="flex items-end justify-between mb-3">
                    <p className="font-black text-gray-900">{planUsage.plan_name}</p>
                    <p className={`text-2xl font-black ${planUsage.within_limit ? 'text-gray-900' : 'text-red-500'}`}>
                      {planUsage.room_count}
                      <span className="text-sm font-normal text-gray-400">/{planUsage.max_rooms}</span>
                    </p>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${planUsage.within_limit ? 'bg-rose-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, (planUsage.room_count / planUsage.max_rooms) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">{planUsage.room_count} of {planUsage.max_rooms} rooms used</p>
                  {!planUsage.within_limit && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3 font-medium">
                      Room limit reached - contact the platform to upgrade your plan.
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center justify-center text-gray-300 text-sm">
                  No membership plan assigned.
                </div>
              )}

              {/* Alerts placeholder (Tier 4) */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">System</p>
                    <p className="font-black text-gray-900">Alerts</p>
                  </div>
                  <div className="h-8 w-8 rounded-xl bg-gray-50 flex items-center justify-center">
                    <FaBell size={13} className="text-gray-300" />
                  </div>
                </div>
                <div className="space-y-2.5">
                  {!alerts ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl opacity-50">
                      <div className="h-8 w-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                        <FaLock size={13} className="text-gray-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-700 truncate">Loading alerts...</p>
                      </div>
                    </div>
                  ) : [
                    { Icon: FaLock, label: 'Smart Lock Alerts', count: alerts.counts?.lock || 0, items: alerts.lock_alerts || [] },
                    { Icon: FaWhatsapp, label: 'WhatsApp & Communication Issues', count: alerts.counts?.communication || 0, items: alerts.communication_alerts || [] },
                  ].map(({ Icon, label, count, items }) => (
                    <div key={label} className={`flex items-center gap-3 p-3 rounded-xl transition ${count > 0 ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${count > 0 ? 'bg-white border border-red-200' : 'bg-white border border-emerald-200'}`}>
                        <Icon size={13} className={count > 0 ? 'text-red-400' : 'text-emerald-400'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-700 truncate">{label}</p>
                        <p className={`text-[10px] ${count > 0 ? 'text-red-600' : 'text-emerald-600'} font-medium`}>
                          {count === 0 ? 'No issues' : `${count} alert${count !== 1 ? 's' : ''} in last 48h`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── ROOMS TAB ── */}
        {tab === 'Rooms' && (
          <div className="space-y-5">
            {/* Header + date picker */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Live Status</p>
                <h2 className="text-xl font-black text-gray-900">Room Grid</h2>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={roomGridDate}
                  onChange={e => handleRoomGridDateChange(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition bg-white"
                />
                <button
                  onClick={() => handleRoomGridDateChange(new Date().toISOString().split('T')[0])}
                  className="px-4 py-2.5 text-xs font-bold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition whitespace-nowrap"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              {[
                { color: 'bg-emerald-500', label: 'Available' },
                { color: 'bg-rose-500', label: 'Occupied' },
                { color: 'bg-amber-400', label: 'Check-in' },
                { color: 'bg-teal-500', label: 'Check-out' },
                { color: 'bg-gray-300', label: 'Blocked' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-gray-500">
                  <span className={`h-3 w-3 rounded-full ${color}`} />
                  {label}
                </div>
              ))}
            </div>

            {roomGridLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-10 w-10 rounded-full border-[3px] border-rose-500 border-t-transparent animate-spin" />
              </div>
            ) : roomGrid.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="text-4xl mb-3">🏨</div>
                <p className="font-bold text-gray-900 mb-1">No properties yet</p>
                <p className="text-gray-400 text-sm">Add properties and rooms to see the grid.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {roomGrid.map(prop => (
                  <div key={prop.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    {/* Property header */}
                    <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                          <FaBuilding size={14} className="text-rose-400" />
                        </div>
                        <div>
                          <p className="font-black text-gray-900">{prop.name}</p>
                          {prop.city && <p className="text-xs text-gray-400">{prop.city}</p>}
                        </div>
                      </div>
                      {/* Property summary pills + Add Room */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-100">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          {prop.available} available
                        </span>
                        <span className="flex items-center gap-1.5 bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full border border-rose-100">
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          {prop.occupied} occupied
                        </span>
                        {prop.blocked > 0 && (
                          <span className="flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs font-bold px-2.5 py-1 rounded-full border border-gray-200">
                            <span className="h-2 w-2 rounded-full bg-gray-400" />
                            {prop.blocked} blocked
                          </span>
                        )}
                        <button onClick={() => openAddRoom(prop)}
                          className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-full transition shadow-sm shadow-rose-200">
                          <FaPlus size={9} /> Add Room
                        </button>
                      </div>
                    </div>

                    {/* Room grid */}
                    {prop.rooms.length === 0 ? (
                      <div className="px-5 py-8 text-center text-gray-400 text-sm">No rooms added yet.</div>
                    ) : (
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {prop.rooms.map(room => {
                          const cfg = {
                            available: { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Available' },
                            occupied: { bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500', text: 'text-rose-700', label: 'Occupied' },
                            checkin: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', label: 'Check-in' },
                            checkout: { bg: 'bg-teal-50', border: 'border-teal-200', dot: 'bg-teal-500', text: 'text-teal-700', label: 'Check-out' },
                            blocked: { bg: 'bg-gray-100', border: 'border-gray-200', dot: 'bg-gray-400', text: 'text-gray-500', label: 'Blocked' },
                          }[room.status] || { bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400', text: 'text-gray-500', label: '-' };

                          return (
                            <div key={room.id}
                              className={`${cfg.bg} border ${cfg.border} rounded-xl p-3 flex flex-col gap-1`}>
                              {/* Room number + status dot + edit */}
                              <div className="flex items-center justify-between gap-1">
                                <p className="font-black text-gray-900 text-sm leading-none flex-1 min-w-0 truncate">
                                  {room.room_number}
                                </p>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                                  <button
                                    onClick={() => openEditRoom(prop, room)}
                                    className="h-5 w-5 rounded-md bg-white/70 hover:bg-white flex items-center justify-center text-gray-500 hover:text-rose-500 transition shadow-sm"
                                    title="Edit room">
                                    <FaEdit size={9} />
                                  </button>
                                </div>
                              </div>
                              {/* Room type */}
                              <p className="text-[11px] text-gray-500 font-medium leading-none">{room.room_type}</p>
                              {/* Floor */}
                              {room.floor && (
                                <p className="text-[10px] text-gray-400 leading-none">{room.floor}</p>
                              )}
                              {/* Status label */}
                              <p className={`text-[10px] font-bold mt-1 leading-none ${cfg.text}`}>{cfg.label}</p>
                              {/* Guest name if occupied */}
                              {room.guest_name && (
                                <p className="text-[10px] text-gray-600 truncate leading-none font-medium mt-0.5">
                                  {room.guest_name}
                                </p>
                              )}
                              {/* Dates if occupied */}
                              {room.check_in && room.check_out && (
                                <p className="text-[9px] text-gray-400 leading-none mt-0.5">
                                  {room.check_in} → {room.check_out}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── EMPLOYEES TAB ── */}
        {tab === 'Employees' && isOrgAdmin && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Team</p>
                <h2 className="text-xl font-black text-gray-900">Employees</h2>
              </div>
              <button onClick={() => { setShowEmpModal(true); setPermForm({}); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 text-white text-sm font-bold rounded-xl hover:bg-rose-600 transition shadow-sm shadow-rose-200">
                <FaPlus size={11} />
                <span className="hidden sm:inline">Add Employee</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>

            {employees.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="text-4xl mb-3">👥</div>
                <p className="font-bold text-gray-900 mb-1">No employees yet</p>
                <p className="text-gray-400 text-sm mb-5">Add staff members and assign them to a department.</p>
                <button onClick={() => { setShowEmpModal(true); setPermForm({}); }}
                  className="px-5 py-2.5 bg-rose-500 text-white text-sm font-bold rounded-xl hover:bg-rose-600 transition shadow-sm shadow-rose-200">
                  Add First Employee
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {employees.map(emp => {
                  const dept = DEPARTMENTS.find(d => d.key === emp.department);
                  const stats = emp.task_stats || {};
                  const scoped = (emp.assigned_property_ids || []).length;
                  return (
                    <div key={emp.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:border-rose-100 transition">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                            {(emp.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-gray-900 truncate">{emp.name}</p>
                            <p className="text-xs text-gray-400">{emp.phone}{emp.email ? ` · ${emp.email}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => {
                            setEditEmpPerms(emp);
                            setPermForm({
                              department: emp.department || '',
                              assigned_property_ids: emp.assigned_property_ids || [],
                            });
                          }}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition">
                            <FaEdit size={10} /> Edit
                          </button>
                          <button onClick={() => deactivateEmployee(emp.id)}
                            disabled={deactivatingId === emp.id}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                            {deactivatingId === emp.id
                              ? <span className="h-3 w-3 border-2 border-red-300 border-t-red-500 rounded-full animate-spin block" />
                              : <FaTrash size={12} />}
                          </button>
                        </div>
                      </div>

                      {/* Department + scope row */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {dept ? (
                          <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 text-xs font-bold px-3 py-1 rounded-full border border-rose-100">
                            <span>{dept.icon}</span> {dept.label}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-100 px-3 py-1 rounded-full">
                            No department - legacy permissions
                          </span>
                        )}
                        <span className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">
                          {scoped > 0 ? `${scoped} propert${scoped === 1 ? 'y' : 'ies'}` : 'All properties'}
                        </span>
                        {emp.employee_code && (
                          <span className="text-xs text-gray-500 font-mono bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">
                            #{emp.employee_code}
                          </span>
                        )}
                      </div>

                      {/* Task counters */}
                      {(stats.total || 0) > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { k: 'open', label: 'Open', cls: 'bg-blue-50 text-blue-700 border-blue-100' },
                            { k: 'in_progress', label: 'In progress', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
                            { k: 'overdue', label: 'Overdue', cls: 'bg-red-50 text-red-600 border-red-100' },
                            { k: 'completed', label: 'Done', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                          ].map(({ k, label, cls }) => (
                            <div key={k} className={`rounded-lg border px-2.5 py-2 text-center ${cls}`}>
                              <p className="text-base font-black">{stats[k] || 0}</p>
                              <p className="text-2xs font-semibold uppercase tracking-wide">{label}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── BOOKINGS TAB ── */}
        {tab === 'Bookings' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">All Bookings</p>
              <h2 className="text-xl font-black text-gray-900 mb-3">
                {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
              </h2>
              <div className="relative">
                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" size={13} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by guest name or booking ID…"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition bg-white" />
              </div>
            </div>

            <DataState
              loading={bookingsLoading}
              error={bookingsError}
              onRetry={fetchBookings}
              skeleton={
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Sk key={i} className="h-20" />)}
                </div>
              }
            >
              {bookings.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                  <div className="text-4xl mb-3">📅</div>
                  <p className="font-bold text-gray-900 mb-1">No bookings yet</p>
                  <p className="text-gray-400 text-sm">Bookings will appear here once guests start reserving.</p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {filteredBookings.map(b => (
                      <div key={b.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-mono text-xs font-bold text-gray-400">#{b.id?.slice(0, 8).toUpperCase()}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : b.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                              {b.status}
                            </span>
                            {(isOrgAdmin || perms.finance_view) && (
                              <p className="font-black text-gray-900 text-sm">₹{(b.final_price || b.total_price || 0).toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-600 text-sm font-black flex-shrink-0">
                            {(b.guest_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{b.guest_name}</p>
                            <p className="text-xs text-gray-400">{b.guest_phone}</p>
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 mb-3">
                          <div className="flex justify-between">
                            <p className="text-xs text-gray-400">Check-in</p>
                            <p className="text-xs font-semibold text-gray-800">{b.check_in_date?.slice(0, 10)}</p>
                          </div>
                          <div className="flex justify-between">
                            <p className="text-xs text-gray-400">Check-out</p>
                            <p className="text-xs font-semibold text-gray-800">{b.check_out_date?.slice(0, 10)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setManageBookingId(b.id)}
                            className="flex items-center justify-center gap-1.5 py-2 bg-rose-500 text-white text-xs font-bold rounded-xl hover:bg-rose-600 transition">
                            Manage
                          </button>
                          <button onClick={() => navigate(`/calendar/${b.property_id}`)}
                            className="flex items-center justify-center gap-1.5 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition">
                            <FaCalendarAlt size={11} /> Calendar
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredBookings.length === 0 && search && (
                      <div className="text-center py-10 text-gray-400 text-sm">No results for "{search}"</div>
                    )}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-50">
                          {['Guest', 'Check In', 'Check Out', 'Amount', 'Status', 'Actions'].map(h => (
                            <th key={h} className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredBookings.map(b => (
                          <tr key={b.id} className="hover:bg-gray-50/60 transition">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-600 text-xs font-black flex-shrink-0">
                                  {(b.guest_name || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{b.guest_name}</p>
                                  <p className="text-xs text-gray-400">{b.guest_phone}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-gray-600 font-medium">{b.check_in_date?.slice(0, 10)}</td>
                            <td className="px-5 py-4 text-gray-600 font-medium">{b.check_out_date?.slice(0, 10)}</td>
                            <td className="px-5 py-4 font-black text-gray-900">₹{(b.final_price || b.total_price || 0).toLocaleString()}</td>
                            <td className="px-5 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : b.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                {b.status}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <button onClick={() => setManageBookingId(b.id)}
                                  className="text-xs font-bold text-rose-500 hover:text-rose-600 transition">
                                  Manage
                                </button>
                                <button onClick={() => navigate(`/calendar/${b.property_id}`)}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-rose-500 transition">
                                  <FaCalendarAlt size={11} /> Calendar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredBookings.length === 0 && (
                          <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No bookings found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </DataState>
          </div>
        )}

        {/* ── PROPERTIES TAB ── */}
        {tab === 'Properties' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Management</p>
                <h2 className="text-xl font-black text-gray-900">Properties</h2>
                {planUsage?.max_rooms && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {planUsage.plan_name} · {planUsage.room_count}/{planUsage.max_rooms} rooms
                  </p>
                )}
              </div>
              {isOrgAdmin && (
                <button onClick={openAddProperty}
                  className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 text-white text-sm font-bold rounded-xl hover:bg-rose-600 transition shadow-sm shadow-rose-200">
                  <FaPlus size={11} />
                  <span className="hidden sm:inline">Add Property</span>
                  <span className="sm:hidden">Add</span>
                </button>
              )}
            </div>

            {properties.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="text-4xl mb-3">🏨</div>
                <p className="font-bold text-gray-900 mb-1">No properties yet</p>
                <p className="text-gray-400 text-sm mb-5">Add your first property to start managing rooms and bookings.</p>
                {isOrgAdmin && (
                  <button onClick={openAddProperty}
                    className="px-5 py-2.5 bg-rose-500 text-white text-sm font-bold rounded-xl hover:bg-rose-600 transition shadow-sm shadow-rose-200">
                    Add First Property
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {properties.map(prop => (
                  <div key={prop.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    {/* Property header */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                            <FaBuilding size={16} className="text-rose-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-gray-900 truncate">{prop.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {[prop.address, prop.city, prop.state].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${prop.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                            {prop.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-xs font-semibold text-gray-500">{prop.room_count || 0} rooms</span>
                        </div>
                      </div>

                      {/* Meta info chips */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="bg-gray-50 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                          Check-in {prop.check_in_time || '14:00'}
                        </span>
                        <span className="bg-gray-50 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                          Check-out {prop.check_out_time || '11:00'}
                        </span>
                        {prop.phone && (
                          <span className="bg-gray-50 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                            {prop.phone}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2">
                        {isOrgAdmin && (
                          <button onClick={() => openEditProperty(prop)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 text-white text-xs font-bold rounded-xl hover:bg-rose-600 transition shadow-sm shadow-rose-200">
                            <FaEdit size={11} /> Edit Property
                          </button>
                        )}
                        {isOrgAdmin && (
                          <button onClick={() => openAddRoom(prop)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-700 transition">
                            <FaBed size={11} /> Add Room
                          </button>
                        )}
                        <button onClick={() => navigate(`/calendar/${prop.id}`)}
                          className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition">
                          <FaCalendarAlt size={11} /> Calendar
                        </button>
                        {isOrgAdmin && (
                          <button onClick={() => openChecklistModal(prop)}
                            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition">
                            <FaBroom size={11} /> Checklist
                          </button>
                        )}
                      </div>

                      {/* Aiosell channel-manager status (only renders when the
                          property is mapped). Polls /api/ops/ota-sync/status. */}
                      {prop.aiosell_hotel_code && (
                        <div className="mt-4">
                          <OtaSyncStatus propertyId={prop.id} />
                        </div>
                      )}
                    </div>

                    {/* Rooms list */}
                    {prop.rooms && prop.rooms.length > 0 && (
                      <div className="border-t border-gray-50 px-5 py-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Rooms</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                          {prop.rooms.map(room => (
                            <div key={room.id} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 hover:border-rose-200 hover:bg-rose-50/30 transition group">
                              <div className="flex items-start justify-between gap-1 mb-0.5">
                                <p className="font-bold text-gray-900 text-xs">Room {room.room_number}</p>
                                {isOrgAdmin && (
                                  <button onClick={() => openEditRoom(prop, room)}
                                    className="h-5 w-5 rounded-md bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:border-rose-300 transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                                    title="Edit room">
                                    <FaEdit size={8} />
                                  </button>
                                )}
                              </div>
                              <p className="text-gray-500 text-[11px]">{room.room_type}</p>
                              <p className="text-rose-500 text-xs font-bold mt-1">₹{room.price_per_night}/night</p>
                              <p className="text-gray-400 text-[10px] mt-0.5">{room.floor}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HOUSEKEEPING TAB ── */}
        {tab === 'Housekeeping' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Room Turnovers</p>
                <h2 className="text-xl font-black text-gray-900">Housekeeping</h2>
              </div>
              <button onClick={fetchHousekeeping}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition">
                <FaBroom size={11} /> Refresh
              </button>
            </div>

            {housekeepingLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-10 w-10 border-[3px] border-rose-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : housekeeping.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="text-4xl mb-3">🧹</div>
                <p className="font-bold text-gray-900 mb-1">No recent turnovers</p>
                <p className="text-gray-400 text-sm">Housekeeping records from the last 7 days will appear here.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {housekeeping.map(prop => (
                  <div key={prop.property_id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    {/* Property header */}
                    <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                          <FaBuilding size={14} className="text-rose-400" />
                        </div>
                        <p className="font-black text-gray-900">{prop.property_name}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold flex-wrap">
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
                          {prop.rooms.filter(r => r.status === 'submitted').length} submitted
                        </span>
                        <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">
                          {prop.rooms.filter(r => r.status === 'pending').length} pending
                        </span>
                        {prop.rooms.filter(r => r.status === 'auto_cleared').length > 0 && (
                          <span className="bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                            {prop.rooms.filter(r => r.status === 'auto_cleared').length} auto-cleared
                          </span>
                        )}
                      </div>
                    </div>

                    {prop.rooms.length === 0 ? (
                      <div className="px-5 py-8 text-center text-gray-400 text-sm">No checkout activity in the last 7 days.</div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {prop.rooms.map(room => {
                          const isOverdue = room.status === 'pending' && (room.hours_since_checkout || 0) >= 2;
                          const statusCfg = {
                            submitted: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', label: 'Submitted' },
                            pending: { bg: isOverdue ? 'bg-red-50' : 'bg-amber-50', text: isOverdue ? 'text-red-600' : 'text-amber-700', border: isOverdue ? 'border-red-100' : 'border-amber-100', label: isOverdue ? 'Overdue' : 'Pending' },
                            auto_cleared: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', label: 'Auto-cleared' },
                          }[room.status] || { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', label: room.status };

                          return (
                            <div key={room.booking_id} className="px-5 py-4">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                {/* Left: room + guest info */}
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="h-9 w-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                                    <FaBed size={13} className="text-gray-400" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-bold text-gray-900 text-sm">Room {room.room_number}</p>
                                      <span className="text-gray-400 text-xs">{room.room_type}{room.floor ? ` · ${room.floor}` : ''}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {room.guest_name} · checked out {room.check_out_date}
                                      {room.hours_since_checkout !== null && (
                                        <span className={`ml-1.5 font-semibold ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                                          ({room.hours_since_checkout}h ago)
                                        </span>
                                      )}
                                    </p>
                                    {room.submitter_name && (
                                      <p className="text-xs text-gray-400 mt-0.5">Submitted by {room.submitter_name}</p>
                                    )}
                                  </div>
                                </div>

                                {/* Right: status + actions */}
                                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                                    {statusCfg.label}
                                  </span>

                                  {/* Copy link (only for pending) */}
                                  {room.status === 'pending' && (
                                    <button onClick={() => copyHousekeepingLink(room.booking_id)}
                                      title="Copy cleaner link"
                                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition">
                                      {copiedId === room.booking_id ? <FaCheck size={10} className="text-emerald-500" /> : <FaCopy size={10} />}
                                      {copiedId === room.booking_id ? 'Copied!' : 'Copy Link'}
                                    </button>
                                  )}

                                  {/* View photos (if submitted) */}
                                  {room.photo_urls?.length > 0 && (
                                    <button onClick={() => setViewingPhotos(room)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition">
                                      <FaImage size={10} /> {room.photo_urls.length} Photo{room.photo_urls.length !== 1 ? 's' : ''}
                                    </button>
                                  )}

                                  {/* Auto-clear (overdue or admin can force) */}
                                  {room.status === 'pending' && (
                                    <button onClick={() => autoClear(room.booking_id)}
                                      disabled={clearingId === room.booking_id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                                      {clearingId === room.booking_id
                                        ? <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <FaBroom size={10} />}
                                      Auto-clear
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Checklist data (if submitted) */}
                              {room.status === 'submitted' && Object.keys(room.checklist_data || {}).length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {Object.entries(room.checklist_data).map(([label, val]) => (
                                    <span key={label} className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${val === 'yes' || val === true ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                                      {val === 'yes' || val === true ? '✓' : '✗'} {label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── LOGOUT CONFIRM ── */}
      <LogoutConfirmModal
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        message="You'll need to sign in again to access the dashboard."
      />

      {/* ── BOOKING MANAGEMENT (KYC + Checkout + PDF) ── */}
      {manageBookingId && (
        <BookingManagementModal
          bookingId={manageBookingId}
          role={user?.role}
          onClose={() => setManageBookingId(null)}
          onCheckedOut={() => fetchBookings()}
        />
      )}

      {/* ── ADD EMPLOYEE MODAL ── */}
      {showEmpModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="h-1 w-10 bg-gray-200 rounded-full" /></div>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="font-black text-gray-900">Add Employee</h3>
                <p className="text-xs text-gray-400 mt-0.5">Set access permissions before creating</p>
              </div>
              <button onClick={() => setShowEmpModal(false)} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">
                <FaTimes size={12} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Basic info */}
              <div className="space-y-4">
                {[
                  { label: 'Full Name *', key: 'name', placeholder: 'Employee name' },
                  { label: 'Phone *', key: 'phone', placeholder: '10-digit number' },
                  { label: 'Email', key: 'email', placeholder: 'employee@example.com' },
                  { label: 'Password', key: 'password', placeholder: '••••••••', type: 'password' },
                ].map(f => (
                  <div key={f.key}>
                    <label className={LABEL_CLS}>{f.label}</label>
                    <input type={f.type || 'text'} value={empForm[f.key] || ''} onChange={e => setEmpForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} className={INPUT_CLS} />
                  </div>
                ))}
                <p className="text-xs text-gray-400">Employee logs in with OTP on their phone number.</p>
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-gray-100" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Permissions</p>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
                <p className="text-xs text-gray-400 mb-3">All permissions are off by default. Only enable what this employee needs.</p>
                <div className="space-y-1">
                  {Object.entries(PERM_LABELS).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between py-2.5 border-b border-gray-50 cursor-pointer group">
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition">{label}</span>
                      <div
                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${permForm[key] ? 'bg-rose-500' : 'bg-gray-200'}`}
                        onClick={() => setPermForm(p => ({ ...p, [key]: !p[key] }))}>
                        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${permForm[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                    </label>
                  ))}
                </div>

                {/* Quick-select shortcuts */}
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-50">
                  <p className="w-full text-xs font-semibold text-gray-400 mb-1">Quick presets:</p>
                  {[
                    { label: 'Receptionist', perms: { bookings_view: true, bookings_edit: true, calendar_view: true, resend_access: true } },
                    { label: 'Manager', perms: { bookings_view: true, bookings_edit: true, kyc_view: true, calendar_view: true, calendar_block: true, property_view: true, property_edit: true, reports_download: true } },
                    { label: 'Housekeeping', perms: { calendar_view: true, inspection_manage: true } },
                    { label: 'Accountant', perms: { bookings_view: true, reports_download: true } },
                    { label: 'Clear all', perms: {} },
                  ].map(({ label, perms }) => (
                    <button key={label} type="button"
                      onClick={() => setPermForm(perms)}
                      className="text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-rose-300 hover:text-rose-600 transition">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setShowEmpModal(false); setPermForm({}); }}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={createEmployee}
                disabled={!empForm.name || !empForm.phone || savingEmp}
                className="flex-1 bg-rose-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-rose-600 transition shadow-sm shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {savingEmp && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {savingEmp ? 'Creating…' : 'Create Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD PROPERTY MODAL ── */}
      {showPropModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="h-1 w-10 bg-gray-200 rounded-full" /></div>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-gray-900">
                  {editingProp ? `Edit - ${editingProp.name}` : 'Add New Property'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {editingProp ? 'Update property details' : 'Fill in your property information'}
                </p>
              </div>
              <button onClick={closePropModal} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">
                <FaTimes size={12} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Property Name *', key: 'name', placeholder: 'e.g. The Grand Hotel' },
                { label: 'Address', key: 'address', placeholder: 'Street address' },
                { label: 'City *', key: 'city', placeholder: 'Mumbai' },
                { label: 'State *', key: 'state', placeholder: 'Maharashtra' },
                { label: 'Pincode', key: 'pincode', placeholder: '400001' },
                { label: 'Phone', key: 'phone', placeholder: 'Contact number' },
                { label: 'Email', key: 'email', placeholder: 'property@email.com' },
                { label: 'Description', key: 'description', placeholder: 'Brief description of the property…' },
              ].map(f => (
                <div key={f.key}>
                  <label className={LABEL_CLS}>{f.label}</label>
                  <input value={propForm[f.key] || ''} onChange={e => setPropForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className={INPUT_CLS} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Check-in Time</label>
                  <input type="time" value={propForm.check_in_time} onChange={e => setPropForm(p => ({ ...p, check_in_time: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Check-out Time</label>
                  <input type="time" value={propForm.check_out_time} onChange={e => setPropForm(p => ({ ...p, check_out_time: e.target.value }))} className={INPUT_CLS} />
                </div>
              </div>

              {/* GST (invoicing) */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">GST - Invoicing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>GSTIN</label>
                    <input value={propForm.gstin || ''}
                      onChange={e => setPropForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                      maxLength={15} placeholder="22AAAAA0000A1Z5" className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>GST Rate % (optional)</label>
                    <input type="number" min="0" step="1"
                      value={propForm.gst_rate ?? ''}
                      onChange={e => setPropForm(p => ({ ...p, gst_rate: e.target.value }))}
                      placeholder="Auto (12/18 by tariff)" className={INPUT_CLS} />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Printed on invoices. Leave the rate blank to auto-apply the hotel slab
                  (12% up to ₹7,500/night, else 18%), split into CGST + SGST.
                </p>
              </div>

              {/* Razorpay (per-property account) */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Payments - Razorpay</p>
                <div className="space-y-3">
                  <div>
                    <label className={LABEL_CLS}>Account Label (internal)</label>
                    <input value={propForm.razorpay_account_label || ''}
                      onChange={e => setPropForm(p => ({ ...p, razorpay_account_label: e.target.value }))}
                      placeholder="e.g. Mumbai property account" className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Razorpay Key ID</label>
                    <input value={propForm.razorpay_key_id || ''}
                      onChange={e => setPropForm(p => ({ ...p, razorpay_key_id: e.target.value }))}
                      placeholder="rzp_live_xxxxxxxxxxxx" className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Razorpay Key Secret</label>
                    <input type="password" value={propForm.razorpay_key_secret || ''}
                      onChange={e => setPropForm(p => ({ ...p, razorpay_key_secret: e.target.value }))}
                      placeholder={editingProp ? 'Leave blank to keep existing' : 'Paste the secret here'}
                      className={INPUT_CLS} />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Encrypted at rest. Leave the secret field empty when editing to preserve the stored key.
                    </p>
                  </div>
                </div>
              </div>

              {/* Late-checkout charge */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Late Checkout</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Charge per hour (₹)</label>
                    <input type="number" min="0" step="1"
                      value={propForm.late_checkout_charge_per_hour ?? ''}
                      onChange={e => setPropForm(p => ({ ...p, late_checkout_charge_per_hour: e.target.value }))}
                      placeholder="0" className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Grace (minutes)</label>
                    <input type="number" min="0" step="5"
                      value={propForm.late_checkout_grace_minutes ?? 30}
                      onChange={e => setPropForm(p => ({ ...p, late_checkout_grace_minutes: e.target.value }))}
                      placeholder="30" className={INPUT_CLS} />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Rooms can override this per-hour rate. After the grace period, billable hours are rounded up.
                </p>
              </div>

              {/* Channel manager (Aiosell) mapping */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Channel Manager - Aiosell</p>
                <div>
                  <label className={LABEL_CLS}>Hotel Code</label>
                  <input value={propForm.aiosell_hotel_code || ''}
                    onChange={e => setPropForm(p => ({ ...p, aiosell_hotel_code: e.target.value }))}
                    placeholder="e.g. sandbox-pms"
                    className={`${INPUT_CLS} font-mono`} />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Aiosell <code className="font-mono text-ink-700">hotelCode</code>. Must match what your channel partner has configured for this property. Rate plans flow in automatically from Aiosell pushes.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-4 space-y-3">
              <p className="text-sm font-bold text-gray-700">Property Photos</p>
              <p className="text-xs text-gray-400">Shown to guests on the property page and in their dashboard.</p>
              {(propForm.images || []).length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {propForm.images.map((url, i) => (
                    <div key={i} className="relative aspect-square">
                      <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-gray-100" />
                      <button type="button"
                        onClick={() => setPropForm(p => ({ ...p, images: p.images.filter((_, j) => j !== i) }))}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm">
                        <FaTimes size={8} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-6 cursor-pointer hover:border-rose-300 hover:bg-rose-50/20 transition">
                <FaCamera size={20} className="text-rose-300 mb-2" />
                <p className="text-sm font-bold text-gray-700">Tap to add property photos</p>
                <p className="text-xs text-gray-400 mt-1">JPG or PNG · Multiple allowed</p>
                <input type="file" accept="image/*" multiple
                  onChange={e => setPropImageFiles(prev => [...prev, ...Array.from(e.target.files)])}
                  className="hidden" />
              </label>
              {propImageFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {propImageFiles.map((f, i) => (
                    <div key={i} className="relative aspect-square">
                      <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover rounded-xl border border-gray-100" />
                      <button type="button" onClick={() => setPropImageFiles(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm">
                        <FaTimes size={8} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closePropModal}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={saveProperty}
                disabled={savingProp || uploadingPropImages}
                className="flex-1 bg-rose-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-rose-600 transition shadow-sm shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {(savingProp || uploadingPropImages) && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {uploadingPropImages ? 'Uploading photos…' : savingProp ? (editingProp ? 'Saving…' : 'Creating…') : editingProp ? 'Save Changes' : 'Create Property'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD ROOM MODAL ── */}
      {showRoomModal && selectedPropForRoom && (() => {
        const AMENITY_OPTIONS = [
          'WiFi', 'Air Conditioning', 'Heating', 'Smart TV', 'Cable TV',
          'Mini Fridge', 'Minibar', 'Tea / Coffee Maker', 'Microwave', 'Electric Kettle',
          'In-room Safe', 'Hair Dryer', 'Iron & Ironing Board', 'Work Desk',
          'Wardrobe / Closet', 'Sofa / Seating Area', 'Balcony / Terrace',
          'Bathtub', 'Hot Shower', 'Rain Shower', 'Pool Access', 'Gym Access',
          'Room Service', 'Daily Housekeeping', 'Telephone', 'Bluetooth Speaker',
          'Power Outlets (International)', 'Blackout Curtains', 'Slippers & Bathrobe',
          'Toiletries', 'Baby Cot Available', 'Extra Pillows & Blankets',
        ];
        const toggleAmenity = (a) => setRoomForm(p => ({
          ...p,
          amenities: p.amenities.includes(a) ? p.amenities.filter(x => x !== a) : [...p.amenities, a],
        }));
        const SectionHead = ({ label }) => (
          <div className="flex items-center gap-2 pt-2">
            <div className="h-px flex-1 bg-gray-100" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</p>
            <div className="h-px flex-1 bg-gray-100" />
          </div>
        );
        const Toggle = ({ label, field }) => (
          <label className="flex items-center justify-between cursor-pointer py-1">
            <span className="text-sm font-medium text-gray-700">{label}</span>
            <div className={`relative w-10 h-5 rounded-full transition-colors ${roomForm[field] ? 'bg-rose-500' : 'bg-gray-200'}`}
              onClick={() => setRoomForm(p => ({ ...p, [field]: !p[field] }))}>
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${roomForm[field] ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </label>
        );

        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[96vh] overflow-y-auto">
              <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="h-1 w-10 bg-gray-200 rounded-full" /></div>
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h3 className="font-black text-gray-900">
                    {editingRoom ? `Edit Room ${editingRoom.room_number}` : 'Add New Room'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedPropForRoom.name}</p>
                </div>
                <button onClick={closeRoomModal}
                  className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">
                  <FaTimes size={12} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {planUsage && !planUsage.within_limit && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                    <FaExclamationTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800 font-medium">Room limit reached. Upgrade your plan to add more rooms.</p>
                  </div>
                )}

                {/* ── Basic info ── */}
                <SectionHead label="Basic Info" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Room Number *</label>
                    <input value={roomForm.room_number} onChange={e => setRoomForm(p => ({ ...p, room_number: e.target.value }))}
                      placeholder="e.g. 101" className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Display Name</label>
                    <input value={roomForm.room_name} onChange={e => setRoomForm(p => ({ ...p, room_name: e.target.value }))}
                      placeholder="e.g. Ocean Suite" className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Room Type</label>
                    <select value={roomForm.room_type} onChange={e => setRoomForm(p => ({ ...p, room_type: e.target.value }))} className={INPUT_CLS}>
                      {['Standard', 'Deluxe', 'Suite', 'Junior Suite', 'Executive Suite', 'Penthouse', 'Double', 'Twin', 'Single', 'Family', 'Studio', 'Villa', 'Cottage'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Floor</label>
                    <input value={roomForm.floor} onChange={e => setRoomForm(p => ({ ...p, floor: e.target.value }))}
                      placeholder="Ground Floor" className={INPUT_CLS} />
                  </div>
                </div>

                {/* ── Bed & Space ── */}
                <SectionHead label="Bed & Space" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Bed Type</label>
                    <select value={roomForm.bed_type} onChange={e => setRoomForm(p => ({ ...p, bed_type: e.target.value }))} className={INPUT_CLS}>
                      {['King Bed', 'Queen Bed', 'Double Bed', 'Twin Beds', 'Single Bed', 'Bunk Beds', 'Sofa Bed', 'Murphy Bed'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Number of Beds</label>
                    <input type="number" min="1" value={roomForm.bed_count} onChange={e => setRoomForm(p => ({ ...p, bed_count: e.target.value }))}
                      className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Room Size (sq ft)</label>
                    <input type="number" value={roomForm.size_sqft} onChange={e => setRoomForm(p => ({ ...p, size_sqft: e.target.value }))}
                      placeholder="e.g. 350" className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>View</label>
                    <select value={roomForm.view_type} onChange={e => setRoomForm(p => ({ ...p, view_type: e.target.value }))} className={INPUT_CLS}>
                      <option value="">No specific view</option>
                      {['City View', 'Garden View', 'Pool View', 'Sea / Ocean View', 'Mountain View', 'Courtyard View', 'River View', 'Lake View'].map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Toggle label="Extra Bed Available on Request" field="extra_bed_available" />

                {/* ── Bathroom ── */}
                <SectionHead label="Bathroom" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Bathroom Type</label>
                    <select value={roomForm.bathroom_type} onChange={e => setRoomForm(p => ({ ...p, bathroom_type: e.target.value }))} className={INPUT_CLS}>
                      {['Attached Private', 'Ensuite', 'Shared', 'Shared (Clean)'].map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Toggle label="Bathtub" field="has_bathtub" />

                {/* ── Policies ── */}
                <SectionHead label="Policies" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Max Guests *</label>
                    <input type="number" min="1" value={roomForm.capacity} onChange={e => setRoomForm(p => ({ ...p, capacity: e.target.value, max_occupancy: e.target.value }))}
                      className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Max Occupancy</label>
                    <input type="number" min="1" value={roomForm.max_occupancy} onChange={e => setRoomForm(p => ({ ...p, max_occupancy: e.target.value }))}
                      className={INPUT_CLS} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Toggle label="Smoking Allowed" field="smoking_allowed" />
                  <Toggle label="Wheelchair Accessible" field="accessibility" />
                </div>

                {/* ── Amenities ── */}
                <SectionHead label="Amenities" />
                <div className="flex flex-wrap gap-2">
                  {AMENITY_OPTIONS.map(a => {
                    const on = roomForm.amenities.includes(a);
                    return (
                      <button key={a} type="button" onClick={() => toggleAmenity(a)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${on ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300'}`}>
                        {on ? '✓ ' : ''}{a}
                      </button>
                    );
                  })}
                </div>

                {/* ── Pricing ── */}
                <SectionHead label="Pricing" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Base Price / Night (₹) *</label>
                    <input type="number" value={roomForm.price_per_night} onChange={e => setRoomForm(p => ({ ...p, price_per_night: e.target.value }))}
                      placeholder="2500" className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Weekend Rate (₹)</label>
                    <input type="number" value={roomForm.weekend_rate} onChange={e => setRoomForm(p => ({ ...p, weekend_rate: e.target.value }))}
                      placeholder="Same as base" className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>OTA Price (₹)</label>
                    <input type="number" value={roomForm.ota_price} onChange={e => setRoomForm(p => ({ ...p, ota_price: e.target.value }))}
                      placeholder="Price on Airbnb / MMT" className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Late Checkout (₹ / hr)</label>
                    <input type="number" min="0" step="1"
                      value={roomForm.late_checkout_charge_per_hour ?? ''}
                      onChange={e => setRoomForm(p => ({ ...p, late_checkout_charge_per_hour: e.target.value }))}
                      placeholder="Inherit from property" className={INPUT_CLS} />
                    <p className="text-[11px] text-gray-400 mt-1">Leave blank to use the property default.</p>
                  </div>
                </div>

                {/* ── Channel manager (Aiosell) ── */}
                <SectionHead label="Channel Manager - Aiosell" />
                <div>
                  <label className={LABEL_CLS}>Room Code</label>
                  <input
                    value={roomForm.aiosell_room_code || ''}
                    onChange={e => setRoomForm(p => ({ ...p, aiosell_room_code: e.target.value }))}
                    placeholder="e.g. executive or suite"
                    className={`${INPUT_CLS} font-mono`}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Aiosell <code className="font-mono text-ink-700">roomCode</code> for this room (must match the channel partner). Rate plans (EP, CP, single, double, etc.) flow in automatically from Aiosell - no need to set them here.
                  </p>
                </div>

                {/* ── Photos ── */}
                <SectionHead label="Photos" />
                <p className="text-xs text-gray-400">Upload photos of the room. These will be shown to guests before booking.</p>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-6 cursor-pointer hover:border-rose-300 hover:bg-rose-50/20 transition">
                  <FaCamera size={20} className="text-rose-300 mb-2" />
                  <p className="text-sm font-bold text-gray-700">Tap to add room photos</p>
                  <p className="text-xs text-gray-400 mt-1">JPG or PNG · Multiple allowed</p>
                  <input type="file" accept="image/*" multiple
                    onChange={e => setRoomImageFiles(prev => [...prev, ...Array.from(e.target.files)])}
                    className="hidden" />
                </label>
                {roomImageFiles.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {roomImageFiles.map((f, i) => (
                      <div key={i} className="relative aspect-square">
                        <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover rounded-xl border border-gray-100" />
                        <button type="button" onClick={() => setRoomImageFiles(prev => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm">
                          <FaTimes size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Description ── */}
                <SectionHead label="Description" />
                <textarea value={roomForm.description} onChange={e => setRoomForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} placeholder="Describe what makes this room special - views, layout, unique features…"
                  className={INPUT_CLS + ' resize-none'} />
              </div>

              <div className="flex gap-3 px-6 pb-6 sticky bottom-0 bg-white border-t border-gray-100 pt-4">
                <button onClick={closeRoomModal}
                  className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={saveRoom}
                  disabled={savingRoom || uploadingRoomImages}
                  className="flex-1 bg-rose-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-rose-600 transition shadow-sm shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {(savingRoom || uploadingRoomImages) && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {uploadingRoomImages ? 'Uploading photos…' : savingRoom ? (editingRoom ? 'Saving…' : 'Adding…') : editingRoom ? 'Save Changes' : 'Add Room'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── PERMISSIONS MODAL ── */}
      {editEmpPerms && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="h-1 w-10 bg-gray-200 rounded-full" /></div>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-gray-900">Permissions</h3>
                <p className="text-xs text-gray-400 mt-0.5">{editEmpPerms.name}</p>
              </div>
              <button onClick={() => setEditEmpPerms(null)} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">
                <FaTimes size={12} />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs text-gray-400 mb-4">All permissions are off by default. Enable only what this employee needs.</p>
              <div className="space-y-1">
                {Object.entries(PERM_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between py-3 border-b border-gray-50 cursor-pointer group">
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition">{label}</span>
                    <div className={`relative w-10 h-5 rounded-full transition-colors ${permForm[key] ? 'bg-rose-500' : 'bg-gray-200'}`}
                      onClick={() => setPermForm(p => ({ ...p, [key]: !p[key] }))}>
                      <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${permForm[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setEditEmpPerms(null)}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={updateEmployee}
                disabled={savingPerms}
                className="flex-1 bg-rose-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-rose-600 transition shadow-sm shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {savingPerms && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {savingPerms ? 'Saving…' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHECKLIST CONFIG MODAL ── */}
      {showChecklistModal && checklistProp && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="h-1 w-10 bg-gray-200 rounded-full" /></div>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="font-black text-gray-900">Housekeeping Checklist</h3>
                <p className="text-xs text-gray-400 mt-0.5">{checklistProp.name}</p>
              </div>
              <button onClick={() => setShowChecklistModal(false)} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">
                <FaTimes size={12} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-xs text-gray-400">These items appear on the cleaner's mobile checklist link for this property. Mark items as required to block submission until they're checked.</p>

              {/* Current items */}
              <div className="space-y-2">
                {checklistItems.length === 0 && (
                  <p className="text-sm text-gray-400 italic text-center py-4">No items yet. Add your first item below.</p>
                )}
                {checklistItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.label}</p>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                      <span className="text-xs text-gray-500 font-medium">Required</span>
                      <div
                        className={`relative w-9 h-5 rounded-full transition-colors ${item.required ? 'bg-rose-500' : 'bg-gray-200'}`}
                        onClick={() => setChecklistItems(prev => prev.map((it, i) => i === idx ? { ...it, required: !it.required } : it))}>
                        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${item.required ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                    </label>
                    <button onClick={() => setChecklistItems(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                      <FaTrash size={11} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add new item */}
              <div className="flex gap-2">
                <input
                  value={newItemLabel}
                  onChange={e => setNewItemLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newItemLabel.trim()) { setChecklistItems(p => [...p, { label: newItemLabel.trim(), required: false }]); setNewItemLabel(''); } }}
                  placeholder="e.g. Sheets changed, Bathroom cleaned…"
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition bg-white"
                />
                <button
                  onClick={() => { if (newItemLabel.trim()) { setChecklistItems(p => [...p, { label: newItemLabel.trim(), required: false }]); setNewItemLabel(''); } }}
                  disabled={!newItemLabel.trim()}
                  className="px-4 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition disabled:opacity-40">
                  <FaPlus size={12} />
                </button>
              </div>

              {/* Common presets */}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2">Quick add:</p>
                <div className="flex flex-wrap gap-2">
                  {['Sheets changed', 'Bathroom cleaned', 'Toiletries restocked', 'AC reset', 'Trash removed', 'Floor mopped', 'Windows cleaned', 'Minibar restocked'].map(label => (
                    <button key={label}
                      onClick={() => { if (!checklistItems.find(i => i.label === label)) setChecklistItems(p => [...p, { label, required: false }]); }}
                      disabled={!!checklistItems.find(i => i.label === label)}
                      className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition disabled:opacity-30 disabled:cursor-not-allowed">
                      + {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowChecklistModal(false)}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={saveChecklist}
                disabled={savingChecklist}
                className="flex-1 bg-rose-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-rose-600 transition shadow-sm shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {savingChecklist && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {savingChecklist ? 'Saving…' : 'Save Checklist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PHOTO VIEWER MODAL ── */}
      {viewingPhotos && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewingPhotos(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-gray-900">Housekeeping Photos</h3>
                <p className="text-xs text-gray-400 mt-0.5">Room {viewingPhotos.room_number} · {viewingPhotos.guest_name}</p>
              </div>
              <button onClick={() => setViewingPhotos(null)} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">
                <FaTimes size={12} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {viewingPhotos.photo_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`photo-${i + 1}`}
                    className="w-full aspect-square object-cover rounded-xl border border-gray-100 hover:opacity-90 transition" />
                </a>
              ))}
            </div>
            {viewingPhotos.submitter_name && (
              <p className="px-5 pb-5 text-xs text-gray-400">Submitted by {viewingPhotos.submitter_name} · {viewingPhotos.submitted_at?.slice(0, 16)}</p>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
