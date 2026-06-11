import React from 'react';
import { FaUserClock, FaSignInAlt } from 'react-icons/fa';

// Shown when a session ends on its own (idle timeout or a failed token
// refresh). Deliberately NOT dismissible — there is no backdrop-click or
// Escape close and no "cancel": the only way forward is to sign in again.
export default function SessionExpiredModal({ open, onSignIn, name }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
    >
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-start gap-4 px-5 pt-5 pb-4">
          <div className="h-11 w-11 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <FaUserClock size={18} className="text-amber-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="session-expired-title" className="text-base font-bold text-gray-900">
              Session timed out
            </h3>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              {name ? <>For your security, {name.split(' ')[0]}, </> : 'For your security, '}
              you've been signed out after a period of inactivity. Please sign in again to continue.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onSignIn}
            autoFocus
            className="w-full bg-teal-600 text-white rounded-md py-2.5 text-sm font-bold hover:bg-teal-700 transition shadow-sm shadow-teal-200 inline-flex items-center justify-center gap-1.5"
          >
            <FaSignInAlt size={12} /> Sign in again
          </button>
        </div>
      </div>
    </div>
  );
}
