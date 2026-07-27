import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  Layers3,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Zap,
} from "lucide-react";

const features = [
  {
    title: "Unified Inventory",
    description:
      "Manage singles, sealed products, bulk cards, collections, and warehouse locations from one central system.",
    icon: Boxes,
  },
  {
    title: "Marketplace Sync",
    description:
      "Keep inventory quantities aligned across TCGplayer, eBay, Shopify, Mana Pool, and other sales channels.",
    icon: RefreshCw,
  },
  {
    title: "Order Management",
    description:
      "Review orders, organize fulfillment, print shipping labels, and monitor every shipment in one workflow.",
    icon: ShoppingCart,
  },
  {
    title: "Market Intelligence",
    description:
      "Track pricing movement, identify opportunities, and understand which products are gaining momentum.",
    icon: BarChart3,
  },
  {
    title: "Store Operations",
    description:
      "Support online sellers, local game stores, collection buyers, and high-volume warehouse operations.",
    icon: Store,
  },
  {
    title: "Automated Workflows",
    description:
      "Reduce repetitive work with pricing rules, inventory alerts, listing automation, and intelligent tasks.",
    icon: Zap,
  },
];

const benefits = [
  "Centralize inventory across every sales channel",
  "Prevent overselling with synchronized quantities",
  "Monitor revenue, fees, costs, and profitability",
  "Organize cards by condition, language, set, and location",
  "Scale from a personal collection to a full warehouse",
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03080c] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-[-10rem] h-[34rem] w-[34rem] rounded-full bg-cyan-400/[0.08] blur-[150px]" />
        <div className="absolute right-[-8rem] top-[18rem] h-[30rem] w-[30rem] rounded-full bg-violet-500/[0.06] blur-[150px]" />

        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
      </div>

      <header className="relative z-20">
        <div className="mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.08] shadow-[0_0_35px_rgba(34,211,238,0.08)]">
              <Layers3 className="h-5 w-5 text-cyan-300" />

              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.04]" />
            </div>

            <div>
              <p className="text-sm font-semibold tracking-tight text-white">
                Trading Docks
              </p>

              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
                Inventory Intelligence
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
            <a
              href="#features"
              className="transition hover:text-white"
            >
              Features
            </a>

            <a
              href="#platform"
              className="transition hover:text-white"
            >
              Platform
            </a>

            <a
              href="#operations"
              className="transition hover:text-white"
            >
              Operations
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-white sm:inline-flex"
            >
              Sign in
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/[0.1] px-4 text-sm font-semibold text-cyan-100 shadow-[0_10px_40px_rgba(34,211,238,0.08)] transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.15]"
            >
              Open dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10">
        <div className="mx-auto grid w-full max-w-[1440px] gap-14 px-5 pb-20 pt-20 sm:px-8 sm:pt-28 lg:grid-cols-[minmax(0,1fr)_minmax(520px,0.9fr)] lg:items-center lg:px-12 lg:pb-28 lg:pt-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.12] bg-cyan-400/[0.06] px-3 py-1.5 text-xs font-medium text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Built for modern trading card businesses
            </div>

            <h1 className="mt-7 text-5xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
              The command center for your
              <span className="block bg-gradient-to-r from-cyan-200 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                entire card business.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-400 sm:text-xl">
              Trading Docks brings inventory, marketplaces, orders,
              analytics, pricing, and automation into one premium operating
              system.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-6 text-sm font-semibold text-[#031015] shadow-[0_18px_60px_rgba(103,232,249,0.2)] transition hover:-translate-y-0.5 hover:bg-cyan-200"
              >
                Enter Trading Docks
                <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href="#features"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.035] px-6 text-sm font-semibold text-slate-200 transition hover:border-white/[0.15] hover:bg-white/[0.06]"
              >
                Explore the platform
              </a>
            </div>

            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-500">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                Secure cloud platform
              </span>

              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-cyan-400" />
                Marketplace synchronization
              </span>

              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-400" />
                Workflow automation
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-12 rounded-full bg-cyan-400/[0.06] blur-[100px]" />

            <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[#081116]/95 p-3 shadow-[0_35px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <div className="rounded-[1.5rem] border border-white/[0.06] bg-[#050c10] p-5">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/[0.08]">
                      <Layers3 className="h-4 w-4 text-cyan-300" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        Command Center
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600">
                        Business performance overview
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-full border border-emerald-300/[0.12] bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]" />
                    Live
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <DashboardMetric
                    label="Inventory Value"
                    value="$482,114"
                    trend="+8.4%"
                  />

                  <DashboardMetric
                    label="Monthly Revenue"
                    value="$18,421"
                    trend="+12.7%"
                  />

                  <DashboardMetric
                    label="Orders Today"
                    value="38"
                    trend="+6"
                  />

                  <DashboardMetric
                    label="Active Listings"
                    value="7,284"
                    trend="+142"
                  />
                </div>

                <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-slate-500">
                        Revenue performance
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        $18,421.00
                      </p>
                    </div>

                    <span className="rounded-full border border-emerald-300/[0.12] bg-emerald-400/[0.07] px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                      +12.7%
                    </span>
                  </div>

                  <div className="mt-8 flex h-28 items-end gap-2">
                    {[34, 48, 42, 55, 50, 68, 60, 75, 71, 86, 78, 96].map(
                      (height, index) => (
                        <div
                          key={`${height}-${index}`}
                          className="flex-1 rounded-t-md bg-gradient-to-t from-cyan-500/20 to-cyan-300/80"
                          style={{ height: `${height}%` }}
                        />
                      ),
                    )}
                  </div>

                  <div className="mt-4 flex justify-between text-[9px] uppercase tracking-[0.15em] text-slate-700">
                    <span>Week 1</span>
                    <span>Week 2</span>
                    <span>Week 3</span>
                    <span>Week 4</span>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <StatusCard
                    title="Marketplace Sync"
                    description="All channels synchronized"
                    icon={RefreshCw}
                  />

                  <StatusCard
                    title="Automation Queue"
                    description="12 workflows completed"
                    icon={Zap}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="relative z-10 border-y border-white/[0.06] bg-white/[0.012]"
      >
        <div className="mx-auto w-full max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              One connected platform
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">
              Everything needed to operate and scale your card business.
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-500">
              Replace disconnected spreadsheets, marketplace tabs, and manual
              workflows with a system designed specifically for trading cards.
            </p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="group rounded-3xl border border-white/[0.07] bg-white/[0.02] p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/[0.14] hover:bg-white/[0.035]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/[0.12] bg-cyan-400/[0.06]">
                    <Icon className="h-5 w-5 text-cyan-300" />
                  </div>

                  <h3 className="mt-6 text-lg font-semibold tracking-tight text-white">
                    {feature.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="platform"
        className="relative z-10"
      >
        <div className="mx-auto grid w-full max-w-[1440px] gap-16 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:items-center lg:px-12 lg:py-32">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Built to scale
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">
              From your first listing to a full warehouse.
            </h2>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-500">
              Trading Docks gives collectors and professional sellers the same
              structured tools used by modern inventory-driven businesses.
            </p>

            <div className="mt-9 space-y-4">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-300/[0.15] bg-cyan-400/[0.08]">
                    <Check className="h-3 w-3 text-cyan-300" />
                  </div>

                  <p className="text-sm leading-6 text-slate-300">
                    {benefit}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            id="operations"
            className="rounded-[2rem] border border-white/[0.08] bg-white/[0.025] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.3)]"
          >
            <div className="rounded-[1.5rem] border border-white/[0.06] bg-[#071015] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Operations Overview</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Live activity across Trading Docks
                  </p>
                </div>

                <span className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                  Today
                </span>
              </div>

              <div className="mt-6 space-y-3">
                <OperationRow
                  title="TCGplayer inventory synchronized"
                  detail="4,218 listings updated"
                  status="Complete"
                />

                <OperationRow
                  title="eBay orders imported"
                  detail="14 new orders ready for fulfillment"
                  status="Complete"
                />

                <OperationRow
                  title="Pricing rules processed"
                  detail="286 listings reviewed"
                  status="Complete"
                />

                <OperationRow
                  title="Mana Pool quantity review"
                  detail="12 listings require attention"
                  status="Review"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
        <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[2rem] border border-cyan-300/[0.12] bg-gradient-to-br from-cyan-400/[0.1] via-white/[0.025] to-violet-500/[0.05] px-6 py-14 text-center shadow-[0_30px_100px_rgba(0,0,0,0.3)] sm:px-10 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Welcome to Trading Docks
          </p>

          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">
            Your inventory deserves more than another spreadsheet.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400">
            Enter the command center and continue building the operating system
            for your trading card business.
          </p>

          <Link
            href="/dashboard"
            className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-6 text-sm font-semibold text-[#031015] transition hover:-translate-y-0.5 hover:bg-cyan-200"
          >
            Open your dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-5 py-8 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-cyan-400" />
            <span>Trading Docks</span>
          </div>

          <p>Inventory intelligence for the trading card market.</p>
        </div>
      </footer>
    </main>
  );
}

type DashboardMetricProps = {
  label: string;
  value: string;
  trend: string;
};

function DashboardMetric({
  label,
  value,
  trend,
}: DashboardMetricProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">
        {label}
      </p>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-lg font-semibold tracking-tight text-white">
          {value}
        </p>

        <span className="text-[10px] font-medium text-emerald-300">
          {trend}
        </span>
      </div>
    </div>
  );
}

type StatusCardProps = {
  title: string;
  description: string;
  icon: typeof RefreshCw;
};

function StatusCard({
  title,
  description,
  icon: Icon,
}: StatusCardProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/[0.1] bg-cyan-400/[0.06]">
          <Icon className="h-4 w-4 text-cyan-300" />
        </div>

        <div>
          <p className="text-xs font-medium text-white">{title}</p>
          <p className="mt-1 text-[10px] text-slate-600">{description}</p>
        </div>
      </div>
    </div>
  );
}

type OperationRowProps = {
  title: string;
  detail: string;
  status: "Complete" | "Review";
};

function OperationRow({
  title,
  detail,
  status,
}: OperationRowProps) {
  const needsReview = status === "Review";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
            needsReview
              ? "border-amber-300/[0.12] bg-amber-400/[0.06]"
              : "border-emerald-300/[0.12] bg-emerald-400/[0.06]",
          ].join(" ")}
        >
          {needsReview ? (
            <Sparkles className="h-4 w-4 text-amber-300" />
          ) : (
            <Check className="h-4 w-4 text-emerald-300" />
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {title}
          </p>

          <p className="mt-1 truncate text-xs text-slate-600">
            {detail}
          </p>
        </div>
      </div>

      <span
        className={[
          "w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold",
          needsReview
            ? "border-amber-300/[0.12] bg-amber-400/[0.06] text-amber-300"
            : "border-emerald-300/[0.12] bg-emerald-400/[0.06] text-emerald-300",
        ].join(" ")}
      >
        {status}
      </span>
    </div>
  );
}