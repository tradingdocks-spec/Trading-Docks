import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, CircleDot } from "lucide-react";

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
  actions?: string[];
};

export function PageScaffold({
  eyebrow,
  title,
  description,
  icon: Icon,
  stats,
  actions = ["Open workspace", "View activity"],
}: PageScaffoldProps) {
  return (
    <div className="relative min-h-full overflow-hidden">
      <DashboardBackground />

      <div className="relative mx-auto flex w-full max-w-[1640px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <section className="relative overflow-hidden rounded-[30px] border border-cyan-300/[0.13] bg-[#06131d]/86 p-6 shadow-[0_30px_95px_rgba(0,0,0,0.32),0_0_70px_rgba(34,211,238,0.035)] backdrop-blur-2xl sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_25%,rgba(34,211,238,0.07),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.018),transparent_28%)]" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.14] bg-cyan-400/[0.045] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                <Icon className="h-3.5 w-3.5" />
                {eyebrow}
              </div>

              <h1 className="mt-5 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                {title}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                {description}
              </p>

              <div className="mt-5 flex flex-wrap gap-4 text-[10px] text-slate-600">
                <span className="flex items-center gap-2">
                  <CircleDot className="h-3 w-3 text-emerald-300" />
                  Live workspace
                </span>
                <span>Updated moments ago</span>
                <span>Supabase connected</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {actions.map((action, index) => (
                <button
                  key={action}
                  type="button"
                  className={[
                    "group inline-flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition hover:-translate-y-0.5",
                    index === 0
                      ? "bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 text-[#001018] shadow-[0_14px_32px_rgba(6,182,212,0.2),inset_0_1px_0_rgba(255,255,255,0.62)]"
                      : "border border-white/[0.08] bg-white/[0.025] text-slate-300 hover:border-cyan-300/[0.16] hover:bg-cyan-400/[0.03]",
                  ].join(" ")}
                >
                  {action}
                  <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat, index) => (
            <article
              key={stat.label}
              className="group relative overflow-hidden rounded-[22px] border border-white/[0.075] bg-[#07141e]/82 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition duration-400 hover:-translate-y-1 hover:border-cyan-300/[0.16] hover:bg-[#081823]"
            >
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-400/[0.045] blur-[55px] transition group-hover:bg-cyan-400/[0.08]" />
              <p className="relative text-[9px] font-semibold uppercase tracking-[0.17em] text-slate-600">
                {stat.label}
              </p>
              <p className="relative mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">
                {stat.value}
              </p>
              <p className="relative mt-2 text-xs text-slate-600">{stat.detail}</p>
              <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
                  style={{ width: `${48 + index * 12}%` }}
                />
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-[26px] border border-white/[0.075] bg-[#06121b]/82 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Workspace overview
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Recent performance</h2>
            <p className="mt-1 text-xs text-slate-600">
              Charts, tables, and live data will populate as this workspace records activity.
            </p>

            <div className="relative mt-6 h-[260px] overflow-hidden rounded-2xl border border-white/[0.05] bg-[#02090f] p-5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_20%,rgba(34,211,238,0.08),transparent_30%)]" />
              {[28, 50, 72].map((top) => (
                <div
                  key={top}
                  className="absolute inset-x-5 border-t border-dashed border-white/[0.045]"
                  style={{ top: `${top}%` }}
                />
              ))}
              <div className="relative flex h-full items-end gap-3">
                {Array.from({ length: 10 }, () => 0).map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-cyan-600/45 via-cyan-400/70 to-cyan-200/95 shadow-[0_0_16px_rgba(34,211,238,0.07)]"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/[0.075] bg-[#06121b]/82 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Live activity
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Recent updates</h2>

            <div className="mt-6 space-y-3">
              <div className="rounded-xl border border-dashed border-white/[0.07] bg-black/[0.08] px-4 py-8 text-center">
                <p className="text-xs font-semibold text-slate-400">No recent activity</p>
                <p className="mt-1 text-[10px] text-slate-600">This account&apos;s updates will appear here.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function DashboardBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-[7%] top-[-90px] h-[470px] w-[470px] rounded-full bg-cyan-400/[0.04] blur-[165px]" />
      <div className="absolute right-[3%] top-[28%] h-[420px] w-[420px] rounded-full bg-blue-500/[0.025] blur-[170px]" />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(103,232,249,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(103,232,249,0.022) 1px, transparent 1px)",
          backgroundSize: "58px 58px",
          maskImage: "linear-gradient(to bottom, black, transparent 78%)",
        }}
      />
    </div>
  );
}
