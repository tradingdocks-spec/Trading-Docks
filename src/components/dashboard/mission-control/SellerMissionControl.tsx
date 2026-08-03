"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ContactRound,
  PackageSearch,
  RefreshCw,
  Rocket,
  ShoppingBag,
  Store,
  Target,
  TrendingUp,
  WandSparkles,
} from "lucide-react";

export type MissionControlSnapshot = {
  businessName: string;
  ownerName: string;
  inventoryUnits: number;
  inventoryRecords: number;
  connectedMarketplaces: string[];
  orderCount: number;
  openOrderCount: number;
  revenue: number;
  profit: number;
  customerCount: number;
  completedSyncCount: number;
  failedSyncCount: number;
  lastSyncAt: string | null;
  readinessScore: number;
  readinessComplete: number;
  readinessTotal: number;
  generatedAt: string;
};

export function SellerMissionControl({
  snapshot,
  previewMode = false,
}: {
  snapshot: MissionControlSnapshot;
  previewMode?: boolean;
}) {
  const greeting = timeGreeting();
  const displayName =
    snapshot.businessName.trim() ||
    snapshot.ownerName.trim() ||
    "your business";

  const health = calculateHealth(snapshot);
  const nextAction = chooseNextAction(snapshot);
  const alerts = buildAlerts(snapshot);
  const timeline = buildTimeline(snapshot);

  return (
    <main className="min-h-screen bg-[#020a12] px-4 py-5 text-white sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1540px]">
        {previewMode ? (
          <section className="mb-4 flex flex-col gap-3 rounded-[20px] border border-cyan-300/[0.16] bg-cyan-300/[0.045] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-100">
                Mission Control preview
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                This page uses polished sample data so you can review the complete experience without changing your live dashboard.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-300/[0.14] bg-cyan-300/[0.055] px-4 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.09]"
            >
              Return to dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        ) : null}

        <section className="relative overflow-hidden rounded-[30px] border border-blue-300/[0.15] bg-gradient-to-br from-[#0a1d2c] via-[#071522] to-[#04101a] p-5 shadow-[0_34px_120px_rgba(0,0,0,.44)] sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-blue-500/[0.15] blur-[115px]" />
          <div className="pointer-events-none absolute bottom-[-10rem] left-[20%] h-72 w-72 rounded-full bg-cyan-300/[0.065] blur-[120px]" />

          <div className="relative grid gap-8 xl:grid-cols-[1fr_390px] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.18] bg-cyan-300/[0.06] px-3 py-2 text-xs font-semibold text-cyan-200">
                <Rocket className="h-4 w-4" />
                Seller Mission Control
              </div>

              <h1 className="mt-5 max-w-5xl text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
                {greeting}, {displayName}.
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base sm:leading-8">
                Here is the current health of your business, what changed, and
                the one action most likely to improve your operation next.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                <HealthPill label={`${health.score}/100 business health`} good={health.score >= 80} />
                <HealthPill label={`${snapshot.connectedMarketplaces.length} connected channels`} good={snapshot.connectedMarketplaces.length > 0} />
                <HealthPill label={`${snapshot.openOrderCount} orders need attention`} good={snapshot.openOrderCount === 0} />
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.08] bg-black/[0.16] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">
                Today’s best next action
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-white">
                {nextAction.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {nextAction.description}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <MiniStat label="Estimated time" value={nextAction.time} />
                <MiniStat label="Impact" value={nextAction.impact} />
              </div>

              <Link
                href={nextAction.href}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-300 text-sm font-semibold text-[#001018] shadow-[0_16px_38px_rgba(37,99,235,.22)]"
              >
                {nextAction.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Revenue" value={money(snapshot.revenue)} detail="Imported order total" icon={CircleDollarSign} />
          <MetricCard label="Profit" value={money(snapshot.profit)} detail="Recorded net profit" icon={TrendingUp} />
          <MetricCard label="Orders" value={snapshot.orderCount.toLocaleString()} detail={`${snapshot.openOrderCount} need attention`} icon={ShoppingBag} />
          <MetricCard label="Inventory" value={snapshot.inventoryUnits.toLocaleString()} detail={`${snapshot.inventoryRecords.toLocaleString()} records`} icon={Boxes} />
          <MetricCard label="Customers" value={snapshot.customerCount.toLocaleString()} detail="CRM profiles" icon={ContactRound} />
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <div className="grid gap-4">
            <BusinessHealth health={health} />
            <MarketplaceHealth snapshot={snapshot} />
          </div>

          <div className="grid gap-4">
            <AlertsPanel alerts={alerts} />
            <TimelinePanel timeline={timeline} />
          </div>
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <ReadinessPanel snapshot={snapshot} />
          <QuickActions />
        </section>
      </div>
    </main>
  );
}

function BusinessHealth({
  health,
}: {
  health: ReturnType<typeof calculateHealth>;
}) {
  return (
    <article className="rounded-[26px] border border-white/[0.075] bg-[#071522] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300/75">
            Business health
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white">
            {health.label}
          </h2>
        </div>
        <span className="text-4xl font-bold tracking-[-0.05em] text-white [font-variant-numeric:tabular-nums]">
          {health.score}
        </span>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.055]">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300"
          style={{ width: `${health.score}%` }}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {health.categories.map((category) => (
          <div key={category.label} className="rounded-2xl border border-white/[0.06] bg-black/[0.11] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300">{category.label}</p>
              <p className="text-sm font-bold text-white">{category.score}</p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300"
                style={{ width: `${category.score}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-600">{category.detail}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function MarketplaceHealth({ snapshot }: { snapshot: MissionControlSnapshot }) {
  const channels = snapshot.connectedMarketplaces.length
    ? snapshot.connectedMarketplaces
    : ["No channels connected"];

  return (
    <article className="rounded-[26px] border border-white/[0.075] bg-[#071522] p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300/75">
            Marketplace health
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Connected commerce
          </h2>
        </div>
        <Store className="h-5 w-5 text-blue-300" />
      </div>

      <div className="mt-5 space-y-2.5">
        {channels.map((channel) => {
          const connected = snapshot.connectedMarketplaces.length > 0;
          return (
            <div key={channel} className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-black/[0.11] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-200">{channel}</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  {connected
                    ? snapshot.lastSyncAt
                      ? `Last sync ${new Date(snapshot.lastSyncAt).toLocaleString()}`
                      : "Connected and ready"
                    : "Connect a marketplace to begin"}
                </p>
              </div>
              <span className={connected ? "rounded-full bg-emerald-300/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300" : "rounded-full bg-amber-300/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300"}>
                {connected ? "Healthy" : "Setup"}
              </span>
            </div>
          );
        })}
      </div>

      <Link href="/dashboard/marketplaces" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-blue-200">
        Manage connections
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

function AlertsPanel({
  alerts,
}: {
  alerts: Array<{ title: string; detail: string; href: string; severity: "good" | "warning" }>;
}) {
  return (
    <article className="rounded-[26px] border border-white/[0.075] bg-[#071522] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300/75">
            Requires attention
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Alerts
          </h2>
        </div>
        <AlertTriangle className="h-5 w-5 text-amber-300" />
      </div>

      <div className="mt-5 space-y-2.5">
        {alerts.map((alert) => (
          <Link
            key={alert.title}
            href={alert.href}
            className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-black/[0.11] p-3.5 transition hover:border-blue-300/[0.15]"
          >
            <span className={alert.severity === "good" ? "mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-300/[0.06] text-emerald-300" : "mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-300/[0.06] text-amber-300"}>
              {alert.severity === "good" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-200">{alert.title}</span>
              <span className="mt-1 block text-[11px] leading-5 text-slate-600">{alert.detail}</span>
            </span>
          </Link>
        ))}
      </div>
    </article>
  );
}

function TimelinePanel({
  timeline,
}: {
  timeline: Array<{ title: string; detail: string; time: string }>;
}) {
  return (
    <article className="rounded-[26px] border border-white/[0.075] bg-[#071522] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300/75">
        Business timeline
      </p>
      <h2 className="mt-2 text-xl font-semibold text-white">Recent activity</h2>

      <div className="mt-5 space-y-4">
        {timeline.map((item, index) => (
          <div key={`${item.title}-${index}`} className="relative flex gap-3">
            {index < timeline.length - 1 ? (
              <span className="absolute bottom-[-18px] left-[15px] top-8 w-px bg-white/[0.07]" />
            ) : null}
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-300/[0.12] bg-blue-400/[0.05] text-blue-300">
              <RefreshCw className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-200">{item.title}</p>
                <span className="text-[10px] text-slate-700">{item.time}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function ReadinessPanel({ snapshot }: { snapshot: MissionControlSnapshot }) {
  return (
    <article className="rounded-[26px] border border-cyan-300/[0.13] bg-gradient-to-br from-blue-500/[0.07] to-cyan-300/[0.025] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300/75">
            Seller readiness
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {snapshot.readinessComplete}/{snapshot.readinessTotal} core steps complete
          </h2>
        </div>
        <BadgeCheck className="h-5 w-5 text-cyan-300" />
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.055]">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300"
          style={{ width: `${snapshot.readinessScore}%` }}
        />
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-500">
        Mission Control uses the same live workspace checks as the Seller
        Launch Center.
      </p>

      <Link href="/dashboard/seller-launch" className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-blue-300/[0.13] bg-blue-400/[0.045] px-4 text-xs font-semibold text-blue-100">
        Open Seller Launch
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

function QuickActions() {
  const actions = [
    { label: "Import orders", href: "/dashboard/marketplaces", icon: RefreshCw },
    { label: "Photo scanner", href: "/dashboard/card-photo-scanner", icon: PackageSearch },
    { label: "Inventory", href: "/dashboard/inventory", icon: Boxes },
    { label: "Customer CRM", href: "/dashboard/customers", icon: ContactRound },
    { label: "Sell Optimizer", href: "/dashboard/sell-optimizer", icon: TrendingUp },
    { label: "Automation", href: "/dashboard/automation", icon: WandSparkles },
  ];

  return (
    <article className="rounded-[26px] border border-white/[0.075] bg-[#071522] p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300/75">
        Quick launch
      </p>
      <h2 className="mt-2 text-xl font-semibold text-white">Common actions</h2>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {actions.map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex min-h-[84px] flex-col justify-between rounded-2xl border border-white/[0.065] bg-black/[0.1] p-3.5 transition hover:-translate-y-0.5 hover:border-blue-300/[0.16]"
          >
            <Icon className="h-4 w-4 text-blue-300" />
            <span className="text-xs font-semibold text-slate-200">{label}</span>
          </Link>
        ))}
      </div>
    </article>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <article className="rounded-[22px] border border-white/[0.075] bg-[#071522] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</p>
        <Icon className="h-4 w-4 text-blue-300/70" />
      </div>
      <p className="mt-4 text-2xl font-bold tracking-[-0.04em] text-white [font-variant-numeric:tabular-nums]">{value}</p>
      <p className="mt-1.5 text-[11px] text-slate-600">{detail}</p>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-700">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function HealthPill({ label, good }: { label: string; good: boolean }) {
  return (
    <span className={good ? "inline-flex items-center gap-2 rounded-full border border-emerald-300/[0.14] bg-emerald-300/[0.045] px-3 py-2 text-xs font-semibold text-emerald-200" : "inline-flex items-center gap-2 rounded-full border border-blue-300/[0.12] bg-blue-400/[0.035] px-3 py-2 text-xs font-semibold text-blue-200/80"}>
      <span className={good ? "h-1.5 w-1.5 rounded-full bg-emerald-300" : "h-1.5 w-1.5 rounded-full bg-blue-300"} />
      {label}
    </span>
  );
}

function calculateHealth(snapshot: MissionControlSnapshot) {
  const inventory = snapshot.inventoryUnits > 0 ? 100 : 30;
  const marketplaces = snapshot.connectedMarketplaces.length > 0 ? 100 : 25;
  const orders = snapshot.orderCount > 0 ? (snapshot.openOrderCount > 10 ? 70 : 95) : 35;
  const customers = snapshot.customerCount > 0 ? 90 : 45;
  const automation = snapshot.completedSyncCount > 0 ? (snapshot.failedSyncCount > 0 ? 70 : 95) : 40;
  const score = Math.round((inventory + marketplaces + orders + customers + automation) / 5);

  return {
    score,
    label: score >= 90 ? "Excellent" : score >= 75 ? "Healthy" : score >= 55 ? "Developing" : "Needs setup",
    categories: [
      { label: "Inventory", score: inventory, detail: snapshot.inventoryUnits > 0 ? "Inventory is active" : "Add inventory" },
      { label: "Marketplaces", score: marketplaces, detail: snapshot.connectedMarketplaces.length > 0 ? "Connections are ready" : "Connect a sales channel" },
      { label: "Orders", score: orders, detail: snapshot.orderCount > 0 ? "Order intake is active" : "Import a first order" },
      { label: "Customers", score: customers, detail: snapshot.customerCount > 0 ? "CRM is in use" : "Create a customer" },
      { label: "Automation", score: automation, detail: snapshot.completedSyncCount > 0 ? "Sync activity detected" : "Run a synchronization" },
    ],
  };
}

function chooseNextAction(snapshot: MissionControlSnapshot) {
  if (!snapshot.inventoryUnits) {
    return { title: "Add your first inventory", description: "Inventory is the foundation for listings, orders, profit, and reconciliation.", href: "/dashboard/inventory", cta: "Open inventory", time: "5–10 min", impact: "Critical" };
  }
  if (!snapshot.connectedMarketplaces.length) {
    return { title: "Connect your first marketplace", description: "Bring live selling activity into Trading Docks and begin order synchronization.", href: "/dashboard/marketplaces", cta: "Connect a channel", time: "3–5 min", impact: "High" };
  }
  if (!snapshot.orderCount) {
    return { title: "Import your first order", description: "Verify that orders arrive with items, totals, and fulfillment status.", href: "/dashboard/marketplaces", cta: "Import orders", time: "3 min", impact: "High" };
  }
  if (!snapshot.customerCount) {
    return { title: "Create your first customer", description: "Start building customer history, store credit, and loyalty data.", href: "/dashboard/customers", cta: "Open CRM", time: "2 min", impact: "Medium" };
  }
  if (snapshot.openOrderCount > 0) {
    return { title: "Review open orders", description: `${snapshot.openOrderCount} orders currently need fulfillment or status review.`, href: "/dashboard/orders", cta: "Review orders", time: "5 min", impact: "High" };
  }
  return { title: "Review purchasing opportunities", description: "Your core operation is healthy. Look for the next profitable acquisition.", href: "/dashboard/card-photo-scanner", cta: "Open Purchasing", time: "5 min", impact: "Growth" };
}

function buildAlerts(snapshot: MissionControlSnapshot) {
  const alerts: Array<{ title: string; detail: string; href: string; severity: "good" | "warning" }> = [];
  if (!snapshot.connectedMarketplaces.length) alerts.push({ title: "No marketplace connected", detail: "Connect at least one selling channel before relying on order automation.", href: "/dashboard/marketplaces", severity: "warning" });
  if (snapshot.failedSyncCount > 0) alerts.push({ title: `${snapshot.failedSyncCount} failed sync run${snapshot.failedSyncCount === 1 ? "" : "s"}`, detail: "Review integration setup and retry the affected synchronization.", href: "/dashboard/marketplaces", severity: "warning" });
  if (snapshot.openOrderCount > 0) alerts.push({ title: `${snapshot.openOrderCount} open order${snapshot.openOrderCount === 1 ? "" : "s"}`, detail: "Orders need fulfillment or status review.", href: "/dashboard/orders", severity: "warning" });
  if (!snapshot.inventoryUnits) alerts.push({ title: "Inventory is empty", detail: "Add or import inventory to activate seller workflows.", href: "/dashboard/inventory", severity: "warning" });
  if (!alerts.length) alerts.push({ title: "No critical issues detected", detail: "Core seller workflows appear healthy.", href: "/dashboard/seller-launch", severity: "good" });
  return alerts.slice(0, 4);
}

function buildTimeline(snapshot: MissionControlSnapshot) {
  const items = [];
  if (snapshot.lastSyncAt) items.push({ title: "Marketplace sync completed", detail: `${snapshot.completedSyncCount} completed sync runs recorded`, time: new Date(snapshot.lastSyncAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
  if (snapshot.orderCount) items.push({ title: "Orders available", detail: `${snapshot.orderCount.toLocaleString()} total orders in the workspace`, time: "Current" });
  if (snapshot.inventoryUnits) items.push({ title: "Inventory active", detail: `${snapshot.inventoryUnits.toLocaleString()} units tracked`, time: "Current" });
  if (snapshot.customerCount) items.push({ title: "CRM active", detail: `${snapshot.customerCount.toLocaleString()} customer profiles`, time: "Current" });
  if (!items.length) items.push({ title: "Mission Control initialized", detail: "Complete Seller Launch steps to populate the business timeline.", time: "Now" });
  return items.slice(0, 5);
}

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}
