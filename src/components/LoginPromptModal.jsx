import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSignInAlt, FaTimes, FaLock } from 'react-icons/fa';

export default function LoginPromptModal({
  open,
  onCancel,
  action = 'continue',
  title,
  description,
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape') onCancel?.();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const heading = title || `Sign in to ${action}`;
  const body = description || `Create a free account or sign in with your phone to ${action}. It only takes a moment.`;

  function handleSignIn() {
    onCancel?.();
    navigate('/login');
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-prompt-title"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start gap-4 px-5 pt-5 pb-4">
          <div className="h-11 w-11 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
            <FaLock size={16} className="text-teal-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="login-prompt-title" className="text-base font-bold text-gray-900">
              {heading}
            </h3>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              {body}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="h-8 w-8 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition flex-shrink-0"
            aria-label="Close"
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
            Not now
          </button>
          <button
            type="button"
            onClick={handleSignIn}
            className="bg-teal-600 text-white rounded-md py-2.5 text-sm font-bold hover:bg-teal-700 transition shadow-sm shadow-teal-200 inline-flex items-center justify-center gap-1.5"
          >
            <FaSignInAlt size={11} /> Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
