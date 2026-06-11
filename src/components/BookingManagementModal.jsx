import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  FaTimes, FaCheckCircle,
  FaExclamationCircle, FaFilePdf, FaSignOutAlt,
  FaKey, FaClipboardList, FaSave,
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
 *  - Fill the guest registration card and allocate a room
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
  const [feePreview, setFeePreview] = useState(null);
  const [booking, setBooking] = useState(null);

  const [checkingOut, setCheckingOut] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Guest Registration Card (reception check-in)
  const [reg, setReg] = useState({});
  const [savingReg, setSavingReg] = useState(false);

  // Room allocation + check-in
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [keyCollected, setKeyCollected] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  const isGlobalAdmin = role === 'global_admin';
  const isAdmin = role === 'global_admin' || role === 'admin' || role === 'org_admin';

  const refresh = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const [previewRes, bookingRes] = await Promise.all([
        apiClient.get(`/checkout/${bookingId}/late-fee-preview`).catch(() => null),
        apiClient.get(`/admin/bookings/${bookingId}`).catch(() => null),
      ]);
      if (previewRes) setFeePreview(previewRes.data.data || null);
      if (bookingRes) setBooking(bookingRes.data.data || null);
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

  async function confirmPayment() {
    if (!window.confirm('Confirm that payment has been collected for this booking? This will mark the booking as confirmed.')) return;
    setConfirmingPayment(true);
    try {
      const res = await apiClient.post(`/org-admin/bookings/${bookingId}/confirm-payment`);
      toast.success(res.data?.message || 'Booking confirmed');
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to confirm payment');
    } finally {
      setConfirmingPayment(false);
    }
  }

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

  if (!bookingId) return null;

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
            {/* ── PAYMENT / CONFIRMATION STATUS ── */}
            {booking && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Payment &amp; status</p>
                {booking.status === 'pending' ? (
                  <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                    <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                      <FaExclamationCircle size={13} />
                      {booking.payment_method === 'pay_at_property'
                        ? 'Booking received — payment to be collected at the property'
                        : 'Awaiting payment'}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      The room is held for these dates. Confirm the booking once payment is collected.
                    </p>
                    {isAdmin && (
                      <button onClick={confirmPayment} disabled={confirmingPayment}
                        className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 disabled:opacity-50">
                        <FaCheckCircle size={12} /> {confirmingPayment ? 'Confirming…' : 'Mark payment collected & confirm'}
                      </button>
                    )}
                  </div>
                ) : booking.status === 'cancelled' ? (
                  <div className="border border-red-100 bg-red-50 rounded-xl p-4 text-sm font-bold text-red-600">
                    Booking cancelled
                  </div>
                ) : (
                  <div className="border border-emerald-100 bg-emerald-50 rounded-xl p-4 text-sm">
                    <p className="font-bold text-emerald-700 flex items-center gap-2">
                      <FaCheckCircle size={12} /> Confirmed
                      {booking.payment_method === 'pay_at_property'
                        ? ' · paid at property'
                        : booking.payment_method === 'coupon'
                          ? ' · free (coupon)'
                          : booking.paid_at ? ' · paid online' : ''}
                    </p>
                  </div>
                )}
              </section>
            )}

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
              ) : booking?.status !== 'confirmed' ? (
                <div className="border border-gray-100 bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
                  Confirm the booking (collect payment above) before allocating a room and checking the guest in.
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
      </div>
    </div>
  );
}
