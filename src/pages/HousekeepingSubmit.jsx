import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../api/client';
import toast from 'react-hot-toast';
import { FaCamera, FaTimes, FaCheck, FaShieldAlt } from 'react-icons/fa';

export default function HousekeepingSubmit() {
  const { bookingId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checklist, setChecklist] = useState({});
  const [photos, setPhotos] = useState([]);
  const [submitterName, setSubmitterName] = useState('');
  const [submitterPhone, setSubmitterPhone] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get(`/housekeeping/submit/${bookingId}`);
        setData(res.data.data);
        if (res.data.data.existing_submission?.status === 'submitted') {
          setSubmitted(true);
        }
        const initial = {};
        (res.data.data.items || []).forEach(item => { initial[item.label] = false; });
        setChecklist(initial);
      } catch {
        toast.error('Failed to load checklist');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [bookingId]);

  function handlePhotoChange(e) {
    const files = Array.from(e.target.files);
    setPhotos(prev => [...prev, ...files]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (photos.length === 0) {
      toast.error('Please upload at least one photo before submitting');
      return;
    }
    if (!submitterName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    const requiredItems = (data?.items || []).filter(i => i.required);
    const unchecked = requiredItems.filter(i => !checklist[i.label]);
    if (unchecked.length > 0) {
      toast.error(`Please complete required items: ${unchecked.map(i => i.label).join(', ')}`);
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('submitter_name', submitterName);
      formData.append('submitter_phone', submitterPhone);
      Object.entries(checklist).forEach(([k, v]) => formData.append(k, v ? 'yes' : 'no'));
      photos.forEach(p => formData.append('photos', p));
      await apiClient.post(`/housekeeping/submit/${bookingId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Checklist submitted.');
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const items = data?.items || [];
  const allRequired = items.filter(i => i.required).every(i => checklist[i.label]);
  const canSubmit = photos.length > 0 && submitterName.trim() && allRequired;
  const checkedCount = Object.values(checklist).filter(Boolean).length;
  const totalCount = items.length;

  if (loading) return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-4">
      <span className="wordmark text-lg">Zero One<span className="wordmark-dot">.</span></span>
      <div className="h-1 w-24 bg-ink-100 overflow-hidden rounded-full">
        <div className="h-full w-1/3 bg-teal-600 rounded-full animate-pulse-soft" />
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="surface p-8 text-center max-w-sm w-full animate-rise">
        <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-5">
          <FaCheck size={26} className="text-teal-700" />
        </div>
        <h2 className="font-display text-xl font-bold text-ink-900 mb-2">All done.</h2>
        <p className="text-ink-500 text-sm leading-relaxed">
          The room has been marked clean and ready for the next guest. Thank you.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas pb-10">
      <header className="bg-white/95 backdrop-blur border-b border-ink-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-3">
          <span className="wordmark text-base sm:text-lg flex-shrink-0">
            Zero One<span className="wordmark-dot">.</span>
          </span>
          <div className="flex-1 min-w-0 border-l border-ink-200 pl-3">
            <p className="font-semibold text-ink-900 text-sm leading-tight truncate">Room checklist</p>
            <p className="text-xs text-ink-500 truncate num">
              Checkout {data?.check_out_date?.slice(0, 10)}
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 sm:px-6 pt-6 space-y-4">
        {/* Progress card */}
        {totalCount > 0 && (
          <div className="surface p-4 sm:p-5 surface-accent">
            <span className="section-eyebrow">Turnover</span>
            <p className="font-display font-semibold text-ink-900 text-base mt-2">
              {checkedCount === totalCount ? 'Ready to submit' : 'Walk through each item'}
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 bg-ink-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-teal-600 rounded-full transition-all"
                  style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-ink-700 flex-shrink-0 num">
                {checkedCount}/{totalCount} done
              </span>
            </div>
          </div>
        )}

        {/* Submitter info */}
        <div className="surface p-4 sm:p-5 space-y-4">
          <div>
            <span className="section-eyebrow">Your details</span>
            <h3 className="font-display font-semibold text-ink-900 text-base mt-1.5">Who's cleaning today?</h3>
          </div>
          <div>
            <label className="block text-2xs font-semibold text-ink-500 mb-1.5 tracking-[0.1em] uppercase">Full name *</label>
            <input value={submitterName} onChange={e => setSubmitterName(e.target.value)} required
              placeholder="Enter your name" className="input-base" />
          </div>
          <div>
            <label className="block text-2xs font-semibold text-ink-500 mb-1.5 tracking-[0.1em] uppercase">Phone number</label>
            <input type="tel" value={submitterPhone} onChange={e => setSubmitterPhone(e.target.value)}
              placeholder="Optional" className="input-base" />
          </div>
        </div>

        {/* Checklist items */}
        {items.length > 0 && (
          <div className="surface p-4 sm:p-5">
            <div className="mb-4">
              <span className="section-eyebrow">Tasks</span>
              <h3 className="font-display font-semibold text-ink-900 text-base mt-1.5">Confirm each item</h3>
            </div>
            <div className="space-y-1">
              {items.map(item => {
                const checked = !!checklist[item.label];
                return (
                  <label key={item.label}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${checked ? 'bg-teal-50' : 'hover:bg-ink-50'}`}>
                    <div
                      className={`h-6 w-6 rounded-md border flex items-center justify-center flex-shrink-0 transition ${checked ? 'bg-teal-600 border-teal-600' : 'border-ink-300 bg-white'}`}>
                      {checked && <FaCheck size={10} className="text-white" />}
                    </div>
                    <input type="checkbox" checked={checked}
                      onChange={() => setChecklist(p => ({ ...p, [item.label]: !p[item.label] }))}
                      className="hidden" />
                    <span className={`text-sm flex-1 transition ${checked ? 'text-teal-800' : 'text-ink-800'}`}>
                      {item.label}
                      {item.required && <span className="text-teal-700 ml-1">*</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            {items.some(i => i.required) && (
              <p className="text-xs text-ink-400 mt-3">* Required - must be checked before submitting</p>
            )}
          </div>
        )}

        {/* Photo upload */}
        <div className="surface p-4 sm:p-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="section-eyebrow">Photos *</span>
            {photos.length > 0 && (
              <span className="pill pill-teal num">{photos.length} added</span>
            )}
          </div>
          <p className="text-xs text-ink-500 mb-4 leading-relaxed">
            Upload at least one photo of the cleaned room. This creates a visual record for the property manager.
          </p>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-ink-200 rounded-xl p-8 cursor-pointer hover:border-teal-300 hover:bg-teal-50/40 transition-colors">
            <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center mb-3">
              <FaCamera size={18} className="text-teal-700" />
            </div>
            <p className="text-sm font-semibold text-ink-800">Tap to add photos</p>
            <p className="text-xs text-ink-400 mt-1">JPG or PNG · Multiple photos allowed</p>
            <input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden" />
          </label>

          {photos.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square">
                  <img src={URL.createObjectURL(p)} alt={`photo-${i}`}
                    className="w-full h-full object-cover rounded-lg border border-ink-100" />
                  <button type="button" onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-ink-900 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-ink-800 transition">
                    <FaTimes size={9} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button type="submit" disabled={submitting || !canSubmit}
          className="btn btn-primary w-full py-3.5 text-sm">
          {submitting && <span className="spinner" />}
          {submitting ? 'Submitting…' : 'Submit checklist'}
        </button>

        {!canSubmit && !submitting && (
          <p className="text-center text-xs text-ink-400">
            {photos.length === 0 ? 'Add at least one photo to continue' :
              !submitterName.trim() ? 'Enter your name to continue' :
                'Complete all required items to submit'}
          </p>
        )}

        {/* Trust note */}
        <div className="flex items-center gap-2 justify-center pt-2 pb-4">
          <FaShieldAlt size={11} className="text-ink-300" />
          <p className="text-xs text-ink-400">Photos and details go directly to the property manager.</p>
        </div>
      </form>
    </div>
  );
}
