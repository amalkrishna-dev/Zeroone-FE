// Reusable loading indicator. Use <Spinner /> inline, or
// <Spinner.Section label="…" /> to fill a card/list area while data loads.
export default function Spinner({ size = 20, className = '' }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-rose-500 border-t-transparent align-[-2px] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

Spinner.Section = function SpinnerSection({ label = 'Loading…', className = '' }) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 py-12 text-stone-400 ${className}`}
    >
      <Spinner size={28} />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
};
