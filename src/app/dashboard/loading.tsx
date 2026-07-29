export default function DashboardLoading() {
  return (
    <div
      aria-label="Loading page"
      aria-live="polite"
      className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8"
    >
      <div className="mb-5 flex items-center gap-3 text-sm font-semibold text-cyan-200">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300/25 border-t-cyan-300" />
        Loading workspace…
      </div>

      <div className="animate-pulse space-y-5">
        <div className="h-28 rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-28 rounded-2xl border border-white/[0.06] bg-white/[0.025]"
            />
          ))}
        </div>
        <div className="h-64 rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
      </div>
    </div>
  );
}
