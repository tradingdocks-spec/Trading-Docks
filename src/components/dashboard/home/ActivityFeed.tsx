import { Activity, ArrowRight } from "lucide-react";

export function ActivityFeed() {
  return (
    <section className="rounded-[28px] border border-white/[0.085] bg-[#06121b]/82 p-5 shadow-[0_26px_85px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Live operations
          </p>

          <h2 className="mt-2 text-lg font-semibold text-white">
            Recent activity
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Sales, imports, synchronizations, and market alerts.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-xs font-medium text-slate-400 transition hover:border-cyan-300/20 hover:bg-cyan-400/[0.04] hover:text-white"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-6 flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-black/[0.08] px-6 text-center">
        <Activity className="h-6 w-6 text-cyan-300/55" />
        <p className="mt-3 text-sm font-semibold text-slate-300">No activity yet</p>
        <p className="mt-1 text-xs text-slate-600">
          Sales, imports, synchronizations, and alerts will appear here.
        </p>
      </div>
    </section>
  );
}
