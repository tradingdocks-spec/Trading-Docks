import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowRight, CircleDot } from "lucide-react";

type PageScaffoldProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  stats: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  actions?: Array<{
    label: string;
    href: string;
  }>;
};

export function PageScaffold({
  eyebrow,
  title,
  description,
  icon: Icon,
  stats,
  actions = [],
}: PageScaffoldProps) {
  const primaryAction = actions[0] ?? null;
  const secondaryActions = actions.slice(1);

  return (
    <div className="td-page-shell">
      <div className="td-workspace flex flex-col gap-5">
        <section className="td-panel-strong p-5 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-end">
            <div className="min-w-0">
              <div className="td-kicker inline-flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" />
                {eyebrow}
              </div>

              <h1 className="td-title mt-3">{title}</h1>
              <p className="td-body mt-3 max-w-3xl">{description}</p>
            </div>

            {primaryAction || secondaryActions.length ? (
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {primaryAction ? (
                  <Link href={primaryAction.href} className="td-button-primary px-4">
                    {primaryAction.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
                {secondaryActions.map((action) => (
                  <Link key={action.href} href={action.href} className="td-button-secondary px-4">
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {stats.length ? (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <article key={stat.label} className="td-panel p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--td-text-faint)]">
                  {stat.label}
                </p>
                <p className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--td-text-primary)]">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--td-text-muted)]">{stat.detail}</p>
              </article>
            ))}
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="td-panel p-5">
            <p className="td-kicker">Decision surface</p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white">
              No trend data yet
            </h2>
            <p className="td-body mt-2">
              This view will show real movement after the workspace records activity. Trading Docks does not fabricate charts before orders, inventory updates, purchases, or account events exist.
            </p>

            <div className="mt-5 grid gap-2">
              {[
                "Capture the first real workspace event",
                "Verify account data after refresh",
                "Review the matching operational workflow",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-[13px] border border-white/[0.06] bg-white/[0.018] px-3 py-2.5"
                >
                  <CircleDot className="h-3.5 w-3.5 text-[var(--td-information)]" />
                  <span className="text-xs font-medium text-slate-300">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="td-panel p-5">
            <p className="td-kicker">Activity</p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white">
              No recent activity
            </h2>
            <p className="td-body mt-2">
              This account&apos;s updates will appear here after real records are created, changed, imported, or synced.
            </p>
            <div className="mt-5 rounded-[13px] border border-dashed border-white/[0.08] bg-black/[0.1] px-4 py-6">
              <p className="text-xs font-semibold text-slate-300">Waiting for workspace records activity</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Empty states remain quiet until the underlying workflow has data to evaluate.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
