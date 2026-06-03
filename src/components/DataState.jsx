import Spinner from './Spinner';

// Single source of truth for the loading / error / empty contract:
//
//   loading            -> show a loader (or caller-supplied skeleton)
//   error              -> show the error + Retry; NEVER an empty message
//   empty (after load) -> show the empty message
//   otherwise          -> render children
//
// The empty message only appears once a request has actually completed
// without error and returned no rows. While a request is in flight, or if
// the backend errored, the user sees a loader / error - not "no data".
export default function DataState({
  loading,
  error,
  empty,
  onRetry,
  skeleton = null,
  loadingLabel = 'Loading…',
  emptyTitle = 'Nothing here yet',
  emptyMessage = '',
  emptyIcon = null,
  children,
}) {
  if (loading) {
    return skeleton || <Spinner.Section label={loadingLabel} />;
  }

  if (error) {
    const message =
      (typeof error === 'string' && error) ||
      error?.response?.data?.error ||
      error?.message ||
      "We couldn't load this. Please try again.";
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center"
      >
        <div className="h-11 w-11 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-xl">
          !
        </div>
        <p className="text-sm font-semibold text-stone-700">Couldn’t load data</p>
        <p className="text-xs text-stone-500 max-w-sm">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-1 text-sm font-bold px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition shadow-sm shadow-rose-200"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center">
        {emptyIcon && <div className="text-stone-300 text-3xl mb-1">{emptyIcon}</div>}
        <p className="font-display font-semibold text-stone-700">{emptyTitle}</p>
        {emptyMessage && <p className="text-sm text-stone-500 max-w-sm">{emptyMessage}</p>}
      </div>
    );
  }

  return children;
}
