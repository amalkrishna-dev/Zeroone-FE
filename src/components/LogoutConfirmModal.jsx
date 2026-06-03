import React, { useEffect } from 'react';
import { FaSignOutAlt, FaTimes } from 'react-icons/fa';

export default function LogoutConfirmModal({
  open,
  onCancel,
  onConfirm,
  message = "You'll need to sign in again to access your account.",
}) {
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') onCancel();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start gap-4 px-5 pt-5 pb-4">
          <div className="h-11 w-11 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
            <FaSignOutAlt size={18} className="text-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="logout-confirm-title" className="text-base font-bold text-gray-900">
              Sign out?
            </h3>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="h-8 w-8 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition flex-shrink-0"
            aria-label="Cancel sign out"
          >
            <FaTimes size={12} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="border border-gray-200 rounded-md py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-red-500 text-white rounded-md py-2.5 text-sm font-bold hover:bg-red-600 transition shadow-sm shadow-red-200"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
