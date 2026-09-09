import { Activity, ArrowRight } from "lucide-react";

export function ActivityFeed() {
  return (
    <section className="rounded-[28px] border border-td-ink/[0.085] bg-td-surface/82 p-5 shadow-[0_26px_85px_rgb(var(--td-shadow-rgb)/calc(0.28*var(--td-shadow-strength)))] backdrop-blur-2xl sm:p-6">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">
            Live operations
          </p>

          <h2 className="mt-2 text-lg font-semibold text-td-primary">
            Recent activity
          </h2>

          <p className="mt-1 text-xs text-td-muted">
            Sales, imports, synchronizations, and market alerts.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.025] px-3 text-xs font-medium text-td-secondary transition hover:border-td-accent/20 hover:bg-td-accent/[0.04] hover:text-td-primary"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-6 flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-td-ink/[0.08] bg-black/[0.08] px-6 text-center">
        <Activity className="h-6 w-6 text-td-accent-text/55" />
        <p className="mt-3 text-sm font-semibold text-td-secondary">No activity yet</p>
        <p className="mt-1 text-xs text-td-muted">
          Sales, imports, synchronizations, and alerts will appear here.
        </p>
      </div>
    </section>
  );
}
