import {
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  PackageCheck,
  ScanLine,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  Zap,
} from "lucide-react";

const metrics = [
  ["Inventory value", "$0", "No inventory yet", CircleDollarSign],
  ["Inventory", "0", "No items tracked", Boxes],
  ["Active listings", "0", "No active listings", Store],
  ["Orders today", "0", "No orders yet", ShoppingBag],
];

export function DashboardHome() {
  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[7%] top-[-100px] h-[500px] w-[500px] rounded-full bg-td-accent/[0.04] blur-[170px]" />
        <div className="absolute right-[4%] top-[20%] h-[420px] w-[420px] rounded-full bg-td-accent/[0.025] blur-[170px]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--td-accent-rgb)/0.022) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--td-accent-rgb)/0.022) 1px, transparent 1px)",
            backgroundSize: "58px 58px",
            maskImage: "linear-gradient(to bottom, black, transparent 78%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1640px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <section className="relative overflow-hidden rounded-[30px] border border-td-accent/[0.13] bg-td-surface/88 p-6 shadow-[0_32px_100px_rgb(var(--td-shadow-rgb)/calc(0.34*var(--td-shadow-strength))),0_0_80px_rgb(var(--td-accent-rgb)/0.04)] backdrop-blur-2xl sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_38%,rgb(var(--td-accent-rgb)/0.08),transparent_31%),linear-gradient(180deg,rgb(var(--td-ink-rgb)/0.018),transparent_28%)]" />
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-td-accent/45 to-transparent" />

          <div className="relative grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-td-accent/[0.15] bg-td-accent/[0.045] px-3 py-1.5 text-[11px] font-semibold text-td-accent-text">
                <Sparkles className="h-3.5 w-3.5 text-td-accent-text" />
                Seller workspace
              </div>

              <h1 className="mt-5 text-3xl font-semibold tracking-[-0.045em] text-td-primary sm:text-4xl">
                Welcome to Trading Docks.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-td-muted">
                Add your inventory and connect the tools you use to begin building your workspace.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button className="group inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-td-accent via-td-accent to-td-accent px-5 text-xs font-semibold text-td-on-accent shadow-[0_15px_34px_rgb(var(--td-accent-rgb)/0.2),inset_0_1px_0_rgb(var(--td-ink-rgb)/0.62)] transition hover:-translate-y-0.5">
                  <ScanLine className="h-4 w-4" />
                  Scan cards
                  <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>

                <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.025] px-5 text-xs font-semibold text-td-secondary transition hover:-translate-y-0.5 hover:border-td-accent/[0.15] hover:bg-td-accent/[0.03]">
                  <Zap className="h-4 w-4 text-td-accent-text" />
                  Run automation
                </button>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-td-muted">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-td-success shadow-[0_0_9px_rgb(var(--td-accent-rgb)/0.75)]" />
                  Workspace ready
                </span>
                <span>No sync activity yet</span>
                <span>0 marketplaces connected</span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[24px] border border-td-ink/[0.07] bg-td-canvas/88 p-5 shadow-[inset_0_1px_0_rgb(var(--td-ink-rgb)/0.02)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgb(var(--td-accent-rgb)/0.08),transparent_32%)]" />
              <p className="relative text-[11px] font-semibold uppercase tracking-[0.18em] text-td-muted">
                Portfolio value
              </p>
              <p className="relative mt-3 text-4xl font-semibold tracking-[-0.055em] text-td-primary">
                $0
              </p>
              <div className="relative mt-3 inline-flex items-center gap-1.5 rounded-full border border-td-success/[0.15] bg-td-success/[0.05] px-3 py-1.5 text-[11px] font-semibold text-td-success">
                <TrendingUp className="h-3.5 w-3.5" />
                $0 today
              </div>
              <div className="relative mt-6 flex h-24 items-end gap-2">
                {Array.from({ length: 12 }, () => 0).map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-td-accent/45 via-td-accent/70 to-td-accent/95"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(([label, value, detail, Icon]) => (
            <article
              key={label as string}
              className="group relative overflow-hidden rounded-[22px] border border-td-ink/[0.075] bg-td-surface/82 p-5 shadow-[0_20px_60px_rgb(var(--td-shadow-rgb)/calc(0.2*var(--td-shadow-strength)))] transition duration-400 hover:-translate-y-1 hover:border-td-accent/[0.16] hover:bg-td-surface"
            >
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-td-accent/[0.045] blur-[55px] transition group-hover:bg-td-accent/[0.08]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-td-muted">
                    {label as string}
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-td-primary">
                    {value as string}
                  </p>
                <p className="mt-2 text-xs font-medium text-td-muted">{detail as string}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-td-accent/[0.12] bg-td-accent/[0.05] text-td-accent-text">
                  <Icon className="h-4.5 w-4.5" />
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
          <div className="rounded-[26px] border border-td-ink/[0.075] bg-td-surface/82 p-6 shadow-[0_25px_80px_rgb(var(--td-shadow-rgb)/calc(0.24*var(--td-shadow-strength)))] backdrop-blur-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">
              Revenue overview
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-td-primary">Sales performance</h2>
                <p className="mt-1 text-xs text-td-muted">Across TCGplayer, eBay, and Mana Pool</p>
              </div>
              <span className="text-xs font-semibold text-td-muted">0.0%</span>
            </div>

            <div className="relative mt-6 h-[280px] overflow-hidden rounded-2xl border border-td-ink/[0.05] bg-td-canvas p-5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgb(var(--td-accent-rgb)/0.08),transparent_32%)]" />
              {[28, 50, 72].map((top) => (
                <div key={top} className="absolute inset-x-5 border-t border-dashed border-td-ink/[0.045]" style={{ top: `${top}%` }} />
              ))}
              <div className="relative flex h-full items-end gap-3">
                {Array.from({ length: 12 }, () => 0).map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-td-accent/45 via-td-accent/70 to-td-accent/95 shadow-[0_0_16px_rgb(var(--td-accent-rgb)/0.07)]"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-td-ink/[0.075] bg-td-surface/82 p-6 shadow-[0_25px_80px_rgb(var(--td-shadow-rgb)/calc(0.24*var(--td-shadow-strength)))] backdrop-blur-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">
              Live activity
            </p>
            <h2 className="mt-2 text-lg font-semibold text-td-primary">Recent updates</h2>

            <div className="mt-6 rounded-xl border border-dashed border-td-ink/[0.08] bg-black/[0.08] px-4 py-10 text-center">
              <p className="text-xs font-semibold text-td-secondary">No recent activity</p>
              <p className="mt-1 text-[11px] text-td-muted">
                Account activity will appear here.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["Inventory health", "0%", Boxes],
            ["Connected marketplaces", "0", Store],
            ["Automation runs", "0", PackageCheck],
          ].map(([label, value, Icon]) => (
            <div key={label as string} className="rounded-[22px] border border-td-ink/[0.07] bg-td-ink/[0.02] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-td-secondary">{label as string}</p>
                <Icon className="h-4 w-4 text-td-accent-text" />
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-td-primary">{value as string}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

