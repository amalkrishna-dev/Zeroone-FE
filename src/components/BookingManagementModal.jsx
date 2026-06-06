import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  FaTimes, FaIdCard, FaCloudUploadAlt, FaCheckCircle,
  FaExclamationCircle, FaFilePdf, FaSignOutAlt,
  FaKey, FaCheckDouble, FaPhone, FaClipboardList, FaSave,
  FaSignInAlt, FaBed,
} from 'react-icons/fa';
import apiClient from '../api/client';

// Keys stored inside bookings.guest_registration (must match the backend
// whitelist in routes/admin.py). All optional - reception fills on arrival.
const REGISTRATION_KEYS = [
  'designation', 'organisation_address', 'vehicle_no',
  'arrival_date', 'arrival_time', 'departure_date', 'departure_time',
  'room_rate', 'room_no',
  'persons_total', 'persons_male', 'persons_female', 'persons_children',
  'relationship', 'mode_of_payment', 'bill_to', 'purpose_of_visit',
  'passport_no', 'passport_place_of_issue', 'passport_date_of_issue',
  'passport_dob', 'date_of_arrival_in_india', 'arrival_from',
  'new_destination',
  'frro_registration_no', 'frro_issued_at', 'frro_date',
  'receptionist_name', 'guest_signed',
];

function isForeignNationality(nat) {
  const n = (nat || '').trim().toLowerCase();
  return n !== '' && n !== 'india' && n !== 'indian';
}

/**
 * BookingManagementModal
 *
 * One-stop modal for an admin/employee to manage a booking after it
 * has been confirmed:
 *  - View / upload KYC for the primary guest and each co-guest
 *  - View smart lock PIN and entry logs
 *  - Preview the live late-checkout fee
 *  - Trigger guest checkout (snapshots + archive)
 *  - Download the one-sheet checkout PDF
 *
 * The component is self-contained: it fetches its own data once the
 * `bookingId` prop is set, so the parent dashboard only has to render
 * <BookingManagementModal bookingId={...} onClose={...} />.
 */
export default function BookingManagementModal({ bookingId, role, onClose, onCheckedOut }) {
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState(null);
  const [feePreview, setFeePreview] = useState(null);
  const [booking, setBooking] = useState(null);
  const [lockData, setLockData] = useState(null);

  const [uploadFor, setUploadFor] = useState(null); // 'primary' | { coguest_id, name }
  const [uploadForm, setUploadForm] = useState({ id_type: 'aadhaar', id_number: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [regeneratingPin, setRegeneratingPin] = useState(false);
  const [showFallbackMenu, setShowFallbackMenu] = useState(false);
  const [triggeringFallback, setTriggeringFallback] = useState(false);
  const [approvingKyc, setApprovingKyc] = useState(false);

  // Guest Registration Card (reception check-in)
  const [reg, setReg] = useState({});
  const [savingReg, setSavingReg] = useState(false);

  // Room allocation + check-in
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [keyCollected, setKeyCollected] = useState(false);

  const isGlobalAdmin = role === 'global_admin';
  const isAdmin = role === 'global_admin' || role === 'admin' || role === 'org_admin';

  const refresh = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const [statusRes, previewRes, bookingRes, lockRes] = await Promise.all([
        apiClient.get(`/admin-kyc/bookings/${bookingId}/status`).catch(() => null),
        apiClient.get(`/checkout/${bookingId}/late-fee-preview`).catch(() => null),
        apiClient.get(`/admin/bookings/${bookingId}`).catch(() => null),
        apiClient.get(`/ops/bookings/${bookingId}/lock`).catch(() => null),
      ]);
      if (statusRes) setKycStatus(statusRes.data.data || null);
      if (previewRes) setFeePreview(previewRes.data.data || null);
      if (bookingRes) setBooking(bookingRes.data.data || null);
      if (lockRes) setLockData(lockRes.data.data || null);
    } catch (e) {
      toast.error('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Seed the registration form from the booking once it loads, with
  // sensible prefills (room no/rate from the room, arrival/departure from
  // the booking dates, persons from number_of_guests).
  useEffect(() => {
    if (!booking) return;
    const stored = (booking.guest_registration && typeof booking.guest_registration === 'object')
      ? booking.guest_registration : {};
    // Every card key defaults to the stored value (or '').
    const next = {};
    REGISTRATION_KEYS.forEach(k => { next[k] = stored[k] ?? ''; });
    // Prefills used only when nothing was saved for that key yet.
    if (!stored.room_no) next.room_no = booking.room_number || '';
    if (stored.room_rate == null || stored.room_rate === '') next.room_rate = booking.room?.price_per_night ?? '';
    if (!stored.arrival_date) next.arrival_date = (booking.check_in_date || '').slice(0, 10);
    if (!stored.departure_date) next.departure_date = (booking.check_out_date || '').slice(0, 10);
    if (stored.persons_total == null || stored.persons_total === '') next.persons_total = booking.number_of_guests || '';
    next.guest_signed = !!stored.guest_signed;
    // Direct identity fields.
    next.guest_name = booking.guest_name || booking.user_name || '';
    next.guest_phone = booking.guest_phone || booking.user_phone || '';
    next.guest_email = booking.guest_email || booking.user_email || '';
    next.guest_nationality = booking.guest_nationality || 'Indian';
    setReg(next);
  }, [booking]);

  function setRegField(key, value) {
    setReg(prev => ({ ...prev, [key]: value }));
  }

  async function saveRegistration() {
    setSavingReg(true);
    try {
      const guest_registration = {};
      REGISTRATION_KEYS.forEach(k => {
        if (reg[k] !== undefined && reg[k] !== '') guest_registration[k] = reg[k];
      });
      guest_registration.guest_signed = !!reg.guest_signed;
      const payload = {
        guest_registration,
        guest_name: reg.guest_name,
        guest_phone: reg.guest_phone,
        guest_email: reg.guest_email,
        guest_nationality: reg.guest_nationality,
      };
      await apiClient.put(`/admin/bookings/${bookingId}/registration`, payload);
      toast.success('Registration saved');
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save registration');
    } finally {
      setSavingReg(false);
    }
  }

  // Load assignable rooms once a confirmed, not-yet-checked-in booking
  // is open so reception can allocate one from the available pool.
  useEffect(() => {
    if (!booking || booking.checked_in_at || booking.status !== 'confirmed') return;
    let cancelled = false;
    setLoadingRooms(true);
    apiClient.get(`/org-admin/bookings/${bookingId}/available-rooms`)
      .then(res => {
        if (cancelled) return;
        const rooms = res.data.data || [];
        setAvailableRooms(rooms);
        // Default to the room already on the booking if it's still free.
        const current = rooms.find(r => r.id === booking.room_id);
        setSelectedRoomId(current ? current.id : (rooms[0]?.id || ''));
      })
      .catch(() => { if (!cancelled) setAvailableRooms([]); })
      .finally(() => { if (!cancelled) setLoadingRooms(false); });
    return () => { cancelled = true; };
  }, [booking, bookingId]);

  async function performCheckIn() {
    if (!selectedRoomId) { toast.error('Select a room to allocate'); return; }
    setCheckingIn(true);
    try {
      const res = await apiClient.post(`/org-admin/bookings/${bookingId}/check-in`, {
        room_id: selectedRoomId,
      });
      toast.success(res.data.message || 'Checked in');
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  }

  function openUpload(target) {
    setUploadFor(target);
    setUploadForm({ id_type: 'aadhaar', id_number: '' });
    setUploadFile(null);
  }

  async function submitUpload() {
    if (!uploadFile) {
      toast.error('Please pick or capture an ID image');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('id_image', uploadFile);
      fd.append('id_type', uploadForm.id_type);
      if (uploadForm.id_number) fd.append('id_number', uploadForm.id_number);

      let url;
      if (uploadFor === 'primary') {
        url = `/admin-kyc/bookings/${bookingId}/primary`;
      } else if (uploadFor && uploadFor.coguest_id) {
        url = `/admin-kyc/coguests/${uploadFor.coguest_id}`;
      } else {
        toast.error('Internal error: no target');
        setUploading(false);
        return;
      }
      await apiClient.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('KYC uploaded - marked verified');
      setUploadFor(null);
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.error || 'KYC upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function performCheckout() {
    if (!window.confirm(
      feePreview?.fee
        ? `This will check the guest out and finalize a late fee of ₹${feePreview.fee}. Continue?`
        : 'Mark this booking as checked out?'
    )) return;
    setCheckingOut(true);
    try {
      const collected = feePreview?.fee
        ? window.confirm('Mark the late fee as already collected from the guest?')
        : true;
      const res = await apiClient.post(`/checkout/${bookingId}`, {
        late_fee_collected: collected,
        key_collected: keyCollected,
      });
      toast.success('Checkout complete');
      if (onCheckedOut) onCheckedOut(res.data?.data);
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  }

  async function downloadPdf(opts = {}) {
    setDownloadingPdf(true);
    try {
      const params = {};
      if (opts.mask === true) params.mask = 1;
      const res = await apiClient.get(`/checkout/${bookingId}/pdf`, {
        params,
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `checkout_${bookingId.slice(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function regeneratePin() {
    if (!window.confirm('Re-issue a new PIN to the smart lock? The old PIN will be invalidated.')) return;
    setRegeneratingPin(true);
    try {
      await apiClient.post(`/ops/bookings/${bookingId}/lock/regenerate-pin`);
      toast.success('New PIN generated and sent to guest');
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to regenerate PIN');
    } finally {
      setRegeneratingPin(false);
    }
  }

  async function triggerFallback(level) {
    const levels = { 1: 'offline PIN', 2: 'lockbox/key location', 3: 'support contact' };
    if (!window.confirm(`Trigger fallback level ${level} (${levels[level]})?`)) return;
    setTriggeringFallback(true);
    try {
      await apiClient.post(`/ops/bookings/${bookingId}/lock/fallback`, { level });
      toast.success(`Fallback level ${level} triggered`);
      setShowFallbackMenu(false);
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to trigger fallback');
    } finally {
      setTriggeringFallback(false);
    }
  }

  async function manuallyApproveKyc(target) {
    const targetLabel = target === 'primary' ? 'Primary Guest' : 'Co-guest';
    if (!window.confirm(`Manually approve KYC for ${targetLabel}?`)) return;
    setApprovingKyc(true);
    try {
      let url;
      if (target === 'primary') {
        url = `/admin-kyc/bookings/${bookingId}/approve`;
      } else if (target.coguest_id) {
        url = `/admin-kyc/coguests/${target.coguest_id}/approve`;
      }
      await apiClient.post(url);
      toast.success(`${targetLabel} KYC approved`);
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to approve KYC');
    } finally {
      setApprovingKyc(false);
    }
  }

  if (!bookingId) return null;

  const primary = kycStatus?.primary;
  const coguests = kycStatus?.coguests || [];
  const foreign = isForeignNationality(reg.guest_nationality);

  const REG_INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';
  // Compact labelled text/number/date field bound to the reg state.
  const tf = (key, label, { type = 'text', full = false, placeholder = '' } = {}) => (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      <input type={type} value={reg[key] ?? ''} placeholder={placeholder}
        onChange={e => setRegField(key, e.target.value)} className={REG_INPUT} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-black text-gray-900 text-lg">Manage Booking</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              #{bookingId.slice(0, 8).toUpperCase()}
              {booking?.guest_name ? ` · ${booking.guest_name}` : ''}
            </p>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
            <FaTimes size={12} />
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* ── GUEST REGISTRATION CARD (reception check-in) ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                  <FaClipboardList size={12} className="text-teal-600" /> Guest Registration
                </p>
                <span className="text-[11px] text-gray-400">All fields optional · complete on arrival</span>
              </div>

              <div className="border border-gray-100 rounded-xl p-4 space-y-5">
                {/* Guest details */}
                <div>
                  <p className="text-[11px] font-bold text-teal-700 uppercase tracking-wide mb-2">Guest details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tf('guest_name', 'Guest name', { placeholder: 'Surname, First name' })}
                    {tf('guest_phone', 'Phone no.', { type: 'tel' })}
                    {tf('designation', 'Designation')}
                    {tf('guest_email', 'Email', { type: 'email' })}
                    {tf('organisation_address', 'Organisation address', { full: true })}
                    {tf('guest_nationality', 'Nationality')}
                    {tf('vehicle_no', 'Vehicle no.')}
                  </div>
                </div>

                {/* Stay */}
                <div>
                  <p className="text-[11px] font-bold text-teal-700 uppercase tracking-wide mb-2">Stay</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {tf('room_no', 'Room no.')}
                    {tf('room_rate', 'Room rate (₹)', { type: 'number' })}
                    {tf('arrival_date', 'Arrival date', { type: 'date' })}
                    {tf('arrival_time', 'Arrival time', { type: 'time' })}
                    {tf('departure_date', 'Departure date', { type: 'date' })}
                    {tf('departure_time', 'Departure time', { type: 'time' })}
                    {tf('bill_to', 'Bill to', { full: true })}
                  </div>
                </div>

                {/* Persons */}
                <div>
                  <p className="text-[11px] font-bold text-teal-700 uppercase tracking-wide mb-2">No. of persons</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {tf('persons_total', 'Total', { type: 'number' })}
                    {tf('persons_male', 'Male', { type: 'number' })}
                    {tf('persons_female', 'Female', { type: 'number' })}
                    {tf('persons_children', 'Children', { type: 'number' })}
                    {tf('relationship', 'Relationship (if ladies)', { full: true })}
                  </div>
                </div>

                {/* Payment & purpose */}
                <div>
                  <p className="text-[11px] font-bold text-teal-700 uppercase tracking-wide mb-2">Payment &amp; purpose</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Mode of payment</label>
                      <select value={reg.mode_of_payment ?? ''} onChange={e => setRegField('mode_of_payment', e.target.value)}
                        className={`${REG_INPUT} bg-white`}>
                        <option value="">-</option>
                        <option value="cash">Cash</option>
                        <option value="card">Credit Card</option>
                        <option value="gpay">GPay / UPI</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Purpose of visit</label>
                      <select value={reg.purpose_of_visit ?? ''} onChange={e => setRegField('purpose_of_visit', e.target.value)}
                        className={`${REG_INPUT} bg-white`}>
                        <option value="">-</option>
                        <option value="business">Business</option>
                        <option value="conference">Conference</option>
                        <option value="leisure">Leisure</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Foreign nationals only: passport + FRRO */}
                {foreign && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-4">
                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Foreign national - passport &amp; FRRO</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {tf('passport_no', 'Passport no.')}
                      {tf('passport_place_of_issue', 'Place of issue')}
                      {tf('passport_date_of_issue', 'Date of issue', { type: 'date' })}
                      {tf('passport_dob', 'Date of birth', { type: 'date' })}
                      {tf('date_of_arrival_in_india', 'Date of arrival in India', { type: 'date' })}
                      {tf('arrival_from', 'Arrived from')}
                      {tf('new_destination', 'Next destination')}
                    </div>
                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">FRRO certificate of registration</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {tf('frro_registration_no', 'Registration no.')}
                      {tf('frro_issued_at', 'Issued at')}
                      {tf('frro_date', 'Date', { type: 'date' })}
                    </div>
                  </div>
                )}

                {/* Signatures */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  {tf('receptionist_name', 'Receptionist name')}
                  <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                    <input type="checkbox" checked={!!reg.guest_signed}
                      onChange={e => setRegField('guest_signed', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                    Guest signed the registration card
                  </label>
                </div>

                <button onClick={saveRegistration} disabled={savingReg}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 disabled:opacity-50">
                  <FaSave size={12} /> {savingReg ? 'Saving…' : 'Save registration'}
                </button>
              </div>
            </section>

            {/* ── ROOM ALLOCATION / CHECK-IN ── */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <FaBed size={12} className="text-teal-600" /> Room allocation &amp; check-in
              </p>
              {booking?.checked_in_at ? (
                <div className="border border-emerald-100 bg-emerald-50 rounded-xl p-4 text-sm">
                  <p className="font-bold text-emerald-700 flex items-center gap-2">
                    <FaCheckCircle size={12} /> Checked in
                    {booking.room_number ? ` · Room ${booking.room_number}` : ''}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {new Date(booking.checked_in_at).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-gray-500">
                    Assign an available room for {(booking?.check_in_date || '').slice(0, 10)} →
                    {' '}{(booking?.check_out_date || '').slice(0, 10)} and mark the guest checked in.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={selectedRoomId}
                      onChange={e => setSelectedRoomId(e.target.value)}
                      disabled={loadingRooms || availableRooms.length === 0}
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
                    >
                      {loadingRooms && <option>Loading rooms…</option>}
                      {!loadingRooms && availableRooms.length === 0 && <option value="">No rooms available</option>}
                      {availableRooms.map(r => (
                        <option key={r.id} value={r.id}>
                          Room {r.room_number}{r.room_type ? ` · ${r.room_type}` : ''}{r.floor ? ` · ${r.floor}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={performCheckIn}
                      disabled={checkingIn || !selectedRoomId}
                      className="inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 disabled:opacity-50"
                    >
                      <FaSignInAlt size={12} /> {checkingIn ? 'Checking in…' : 'Check in'}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* ── KYC SECTION ── */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">KYC Verification</p>

              {/* Primary guest */}
              <div className="border border-gray-100 rounded-xl p-4 mb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Primary Guest</p>
                    <p className="text-xs text-gray-500">{booking?.guest_name || booking?.user_name || '-'}</p>
                    {primary?.id_type && (
                      <p className="text-[11px] text-gray-400 mt-1 uppercase">
                        {primary.id_type} · {primary.id_number || '-'}
                      </p>
                    )}
                  </div>
                  {primary?.verified ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                      <FaCheckCircle size={10} /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold">
                      <FaExclamationCircle size={10} /> Pending
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {primary?.id_image_url && (
                    <a href={primary.id_image_url} target="_blank" rel="noreferrer"
                      className="text-xs font-semibold text-teal-700 hover:underline">
                      View on file
                    </a>
                  )}
                  <button onClick={() => openUpload('primary')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-teal-700">
                    <FaCloudUploadAlt size={12} /> {primary?.verified ? 'Re-upload' : 'Upload ID'}
                  </button>
                  {isAdmin && !primary?.verified && (
                    <button onClick={() => manuallyApproveKyc('primary')} disabled={approvingKyc}
                      className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50">
                      <FaCheckDouble size={12} /> {approvingKyc ? 'Approving…' : 'Approve'}
                    </button>
                  )}
                </div>
              </div>

              {/* Co-guests */}
              {coguests.length === 0 && kycStatus?.expected_coguest_count > 0 && (
                <div className="text-xs text-gray-400 italic mb-3">
                  Expected {kycStatus.expected_coguest_count} co-guest(s) - none submitted yet.
                </div>
              )}
              {coguests.map(c => (
                <div key={c.id} className="border border-gray-100 rounded-xl p-4 mb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{c.name || 'Co-guest'}</p>
                      <p className="text-xs text-gray-500">{c.phone || '-'}</p>
                      {c.id_type && (
                        <p className="text-[11px] text-gray-400 mt-1 uppercase">
                          {c.id_type} · {c.id_number || '-'}
                        </p>
                      )}
                    </div>
                    {c.verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                        <FaCheckCircle size={10} /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold">
                        <FaExclamationCircle size={10} /> Pending
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {c.id_image_url && (
                      <a href={c.id_image_url} target="_blank" rel="noreferrer"
                        className="text-xs font-semibold text-teal-700 hover:underline">
                        View on file
                      </a>
                    )}
                    <button onClick={() => openUpload({ coguest_id: c.id, name: c.name })}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-teal-700">
                      <FaCloudUploadAlt size={12} /> {c.verified ? 'Re-upload' : 'Upload ID'}
                    </button>
                    {isAdmin && !c.verified && (
                      <button onClick={() => manuallyApproveKyc({ coguest_id: c.id, name: c.name })} disabled={approvingKyc}
                        className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50">
                        <FaCheckDouble size={12} /> {approvingKyc ? 'Approving…' : 'Approve'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </section>

            {/* ── SMART LOCK SECTION ── */}
            {lockData && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Smart Lock Access</p>
                <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                  {/* PIN Display */}
                  {lockData.pin ? (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                      <p className="text-xs text-emerald-700 font-semibold mb-1.5">Main PIN</p>
                      <div className="flex items-center justify-between">
                        <p className="font-black text-2xl text-emerald-600 tracking-widest">{lockData.pin}</p>
                        <button onClick={() => navigator.clipboard.writeText(lockData.pin)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 rounded transition">
                          Copy
                        </button>
                      </div>
                      <p className="text-[10px] text-emerald-600 mt-2">
                        Generated: {lockData.pin_issued_at ? new Date(lockData.pin_issued_at).toLocaleString() : '-'}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-600">No PIN generated yet</p>
                      <p className="text-[10px] text-gray-500 mt-1">Lock access not yet activated for this booking.</p>
                    </div>
                  )}

                  {/* Backup PIN */}
                  {lockData.backup_pin && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <p className="text-xs text-blue-700 font-semibold mb-1.5">Offline Backup PIN</p>
                      <p className="font-mono text-sm text-blue-600">{lockData.backup_pin}</p>
                      <p className="text-[10px] text-blue-600 mt-1">Use if lock is offline</p>
                    </div>
                  )}

                  {/* Entry Log */}
                  {lockData.entry_log && lockData.entry_log.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2">Entry Log</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-2">
                        {lockData.entry_log.map((entry, idx) => (
                          <div key={idx} className="text-[11px] text-gray-600 py-1 px-2 border-b border-gray-200 last:border-0">
                            <span className="font-semibold">{entry.time ? new Date(entry.time).toLocaleTimeString() : '-'}</span>
                            {' '}{entry.type || 'Entry'} {entry.via ? `via ${entry.via}` : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fallback Status */}
                  {lockData.fallback_used && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <FaExclamationCircle className="text-amber-600 mt-0.5 flex-shrink-0" size={12} />
                        <div>
                          <p className="text-xs font-semibold text-amber-700">Fallback Used</p>
                          <p className="text-[10px] text-amber-600 mt-0.5">{lockData.fallback_level_used}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Admin Actions */}
                {isAdmin && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                    <button onClick={regeneratePin} disabled={regeneratingPin}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 disabled:opacity-50 transition">
                      <FaKey size={11} /> {regeneratingPin ? 'Regenerating…' : 'Regenerate PIN'}
                    </button>
                    <div className="relative">
                      <button onClick={() => setShowFallbackMenu(!showFallbackMenu)} disabled={triggeringFallback}
                        className="inline-flex items-center justify-center gap-2 py-2 px-3 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-100 disabled:opacity-50 transition">
                        <FaPhone size={11} /> Fallback
                      </button>
                      {showFallbackMenu && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-max">
                          {[1, 2, 3].map(level => (
                            <button key={level} onClick={() => triggerFallback(level)} disabled={triggeringFallback}
                              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 border-b border-gray-100 last:border-0 transition">
                              Level {level}: {['offline PIN', 'lockbox/key', 'support call'][level - 1]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── LATE FEE / CHECKOUT ── */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Checkout</p>
              <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Late by</p>
                  <p className="font-bold text-gray-900">{feePreview?.minutes_late ?? 0} min</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Hourly rate</p>
                  <p className="font-bold text-gray-900">₹{feePreview?.hourly_rate ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Billable hours</p>
                  <p className="font-bold text-gray-900">{feePreview?.billable_hours ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Late fee</p>
                  <p className="font-black text-red-600">₹{(feePreview?.fee ?? 0).toFixed(2)}</p>
                </div>
              </div>
              {booking?.checked_out_at ? (
                <p className="mt-3 text-sm font-semibold text-emerald-700">
                  ✓ Checked out at {new Date(booking.checked_out_at).toLocaleString()}
                  {booking.key_collected ? ' · key collected' : ''}
                </p>
              ) : (
                <>
                  <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={keyCollected}
                      onChange={e => setKeyCollected(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                    <FaKey size={11} className="text-gray-400" /> Room key / card collected from guest
                  </label>
                  <button onClick={performCheckout} disabled={checkingOut}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 disabled:opacity-50">
                    <FaSignOutAlt size={12} /> {checkingOut ? 'Checking out…' : 'Check out guest'}
                  </button>
                  <p className="mt-2 text-[11px] text-gray-400">
                    On checkout the room is handed to housekeeping and its freed nights are returned to the OTA channel manager.
                  </p>
                </>
              )}
            </section>

            {/* ── PDF DOWNLOAD ── */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">One-sheet PDF</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button onClick={() => downloadPdf({ mask: false })} disabled={downloadingPdf}
                  className="inline-flex items-center justify-center gap-2 py-2.5 border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 disabled:opacity-50">
                  <FaFilePdf size={12} />
                  Download {isGlobalAdmin ? '(unmasked)' : '(per org mask)'}
                </button>
                {isGlobalAdmin && (
                  <button onClick={() => downloadPdf({ mask: true })} disabled={downloadingPdf}
                    className="inline-flex items-center justify-center gap-2 py-2.5 border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 disabled:opacity-50">
                    <FaFilePdf size={12} /> Download (masked)
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                Snapshots are retained for 90 days for org admins; the platform keeps a permanent copy
                for compliance retrieval.
              </p>
            </section>
          </div>
        )}

        {/* ── KYC UPLOAD SUB-MODAL ── */}
        {uploadFor && (
          <div className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h4 className="font-black text-gray-900">
                  Upload ID - {uploadFor === 'primary' ? 'Primary Guest' : (uploadFor.name || 'Co-guest')}
                </h4>
                <button onClick={() => setUploadFor(null)} className="h-7 w-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
                  <FaTimes size={11} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">ID Type</label>
                  <select value={uploadForm.id_type}
                    onChange={e => setUploadForm(f => ({ ...f, id_type: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="aadhaar">Aadhaar</option>
                    <option value="license">Driving Licence</option>
                    <option value="passport">Passport</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">ID Number (optional)</label>
                  <input value={uploadForm.id_number}
                    onChange={e => setUploadForm(f => ({ ...f, id_number: e.target.value }))}
                    placeholder="Type as on card"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Photo of ID</label>
                  <input type="file" accept="image/*" capture="environment"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-teal-50 file:text-red-600 file:font-semibold hover:file:bg-teal-100" />
                  {uploadFile && (
                    <p className="text-[11px] text-gray-500 mt-1.5">{uploadFile.name}</p>
                  )}
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-[11px] text-amber-800 flex gap-2">
                  <FaIdCard size={12} className="mt-0.5 flex-shrink-0" />
                  <p>The document will be marked verified immediately (admin override). Real KYC provider integration takes over once HyperVerge / DigiLocker keys are wired.</p>
                </div>
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <button onClick={() => setUploadFor(null)}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={submitUpload} disabled={uploading}
                  className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-teal-700 disabled:opacity-50">
                  {uploading ? 'Uploading…' : 'Upload & Verify'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
