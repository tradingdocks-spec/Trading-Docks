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
        <div className="absolute left-[7%] top-[-100px] h-[500px] w-[500px] rounded-full bg-cyan-400/[0.04] blur-[170px]" />
        <div className="absolute right-[4%] top-[20%] h-[420px] w-[420px] rounded-full bg-blue-500/[0.025] blur-[170px]" />
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

      <div className="relative mx-auto flex w-full max-w-[1640px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <section className="relative overflow-hidden rounded-[30px] border border-cyan-300/[0.13] bg-[#06131d]/88 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.34),0_0_80px_rgba(34,211,238,0.04)] backdrop-blur-2xl sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_38%,rgba(34,211,238,0.08),transparent_31%),linear-gradient(180deg,rgba(255,255,255,0.018),transparent_28%)]" />
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />

          <div className="relative grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.15] bg-cyan-400/[0.045] px-3 py-1.5 text-[10px] font-semibold text-cyan-100">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                Seller workspace
              </div>

              <h1 className="mt-5 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                Welcome to Trading Docks.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                Add your inventory and connect the tools you use to begin building your workspace.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button className="group inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 px-5 text-xs font-semibold text-[#001018] shadow-[0_15px_34px_rgba(6,182,212,0.2),inset_0_1px_0_rgba(255,255,255,0.62)] transition hover:-translate-y-0.5">
                  <ScanLine className="h-4 w-4" />
                  Scan cards
                  <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>

                <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 text-xs font-semibold text-slate-300 transition hover:-translate-y-0.5 hover:border-cyan-300/[0.15] hover:bg-cyan-400/[0.03]">
                  <Zap className="h-4 w-4 text-cyan-300" />
                  Run automation
                </button>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-slate-600">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_9px_rgba(110,231,183,0.75)]" />
                  Workspace ready
                </span>
                <span>No sync activity yet</span>
                <span>0 marketplaces connected</span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#020a10]/88 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(34,211,238,0.08),transparent_32%)]" />
              <p className="relative text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                Portfolio value
              </p>
              <p className="relative mt-3 text-4xl font-semibold tracking-[-0.055em] text-white">
                $0
              </p>
              <div className="relative mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/[0.15] bg-emerald-300/[0.05] px-3 py-1.5 text-[10px] font-semibold text-emerald-300">
                <TrendingUp className="h-3.5 w-3.5" />
                $0 today
              </div>
              <div className="relative mt-6 flex h-24 items-end gap-2">
                {Array.from({ length: 12 }, () => 0).map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-cyan-600/45 via-cyan-400/70 to-cyan-200/95"
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
              className="group relative overflow-hidden rounded-[22px] border border-white/[0.075] bg-[#07141e]/82 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition duration-400 hover:-translate-y-1 hover:border-cyan-300/[0.16] hover:bg-[#081823]"
            >
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-400/[0.045] blur-[55px] transition group-hover:bg-cyan-400/[0.08]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-slate-600">
                    {label as string}
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">
                    {value as string}
                  </p>
                <p className="mt-2 text-xs font-medium text-slate-600">{detail as string}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/[0.12] bg-cyan-400/[0.05] text-cyan-300">
                  <Icon className="h-4.5 w-4.5" />
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
          <div className="rounded-[26px] border border-white/[0.075] bg-[#06121b]/82 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Revenue overview
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Sales performance</h2>
                <p className="mt-1 text-xs text-slate-600">Across TCGplayer, eBay, and Mana Pool</p>
              </div>
              <span className="text-xs font-semibold text-slate-600">0.0%</span>
            </div>

            <div className="relative mt-6 h-[280px] overflow-hidden rounded-2xl border border-white/[0.05] bg-[#02090f] p-5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(34,211,238,0.08),transparent_32%)]" />
              {[28, 50, 72].map((top) => (
                <div key={top} className="absolute inset-x-5 border-t border-dashed border-white/[0.045]" style={{ top: `${top}%` }} />
              ))}
              <div className="relative flex h-full items-end gap-3">
                {Array.from({ length: 12 }, () => 0).map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-cyan-600/45 via-cyan-400/70 to-cyan-200/95 shadow-[0_0_16px_rgba(34,211,238,0.07)]"
                      style={{ height: `${Math.max(height, 2)}%` }}
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

            <div className="mt-6 rounded-xl border border-dashed border-white/[0.08] bg-black/[0.08] px-4 py-10 text-center">
              <p className="text-xs font-semibold text-slate-300">No recent activity</p>
              <p className="mt-1 text-[10px] text-slate-600">
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
            <div key={label as string} className="rounded-[22px] border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">{label as string}</p>
                <Icon className="h-4 w-4 text-cyan-300" />
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">{value as string}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

