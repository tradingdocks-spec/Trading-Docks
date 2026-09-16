"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ContactRound,
  PackageSearch,
  RefreshCw,
  Rocket,
  ShoppingBag,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  WandSparkles,
  Zap,
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


function buildAlerts(snapshot: MissionControlSnapshot) {
  const alerts: Array<{
    id: string;
    title: string;
    description: string;
    severity: "high" | "medium" | "low";
    href: string;
  }> = [];

  if (snapshot.failedSyncCount > 0) {
    alerts.push({
      id: "failed-sync-runs",
      title: `${snapshot.failedSyncCount} failed sync ${snapshot.failedSyncCount === 1 ? "run" : "runs"}`,
      description: "Review integration setup and retry the affected synchronization.",
      severity: "high",
      href: "/dashboard/automation",
    });
  }

  if (snapshot.orderCount > 0) {
    alerts.push({
      id: "open-orders",
      title: `${snapshot.orderCount} open ${snapshot.orderCount === 1 ? "order" : "orders"}`,
      description: "Orders need fulfillment or status review.",
      severity: "medium",
      href: "/dashboard/orders",
    });
  }

  if (snapshot.customerCount === 0) {
    alerts.push({
      id: "no-customers",
      title: "No customer profiles yet",
      description: "Create your first customer to begin tracking loyalty, credit, and history.",
      severity: "low",
      href: "/dashboard/customers",
    });
  }

  return alerts;
}

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
  const priorities = buildPriorities(snapshot);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgb(var(--td-accent-rgb)/.08),transparent_30%),var(--td-surface-default)] px-4 py-5 text-td-primary sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1580px]">
        {previewMode ? (
          <section className="mb-4 flex flex-col gap-3 rounded-[20px] border border-td-accent/[0.16] bg-td-accent/[0.045] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-td-accent-text">
                Mission Control preview
              </p>
              <p className="mt-1 text-xs leading-5 text-td-muted">
                Polished sample data lets you review the complete experience without changing your live workspace.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-td-accent/[0.14] bg-td-accent/[0.055] px-4 text-xs font-semibold text-td-accent-text transition hover:bg-td-accent/[0.09]"
            >
              Return to dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        ) : null}

        <section className="relative overflow-hidden rounded-[30px] border border-td-accent/[0.16] bg-[linear-gradient(135deg,var(--td-surface-default)_0%,var(--td-surface-default)_55%,var(--td-surface-default)_100%)] shadow-[0_36px_130px_rgb(var(--td-shadow-rgb)/calc(.48*var(--td-shadow-strength)))]">
          <div className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full bg-td-accent/[0.18] blur-[125px]" />
          <div className="pointer-events-none absolute -bottom-40 left-[18%] h-80 w-80 rounded-full bg-td-accent/[0.08] blur-[130px]" />

          <div className="relative grid gap-8 p-5 sm:p-8 xl:grid-cols-[1fr_410px] xl:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-td-accent/[0.18] bg-td-accent/[0.06] px-3 py-2 text-xs font-semibold text-td-accent-text">
                  <Rocket className="h-4 w-4" />
                  Mission Control
                </span>
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-td-success/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-td-success shadow-[0_0_14px_rgb(var(--td-accent-rgb)/.75)]" />
                  Live workspace
                </span>
              </div>

              <h1 className="mt-5 max-w-5xl text-3xl font-semibold tracking-[-0.055em] sm:text-5xl">
                {greeting}, {displayName}.
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-td-secondary sm:text-base sm:leading-8">
                Your business is {health.label.toLowerCase()}. Here is what moved, what needs attention, and the highest-impact next step.
              </p>

              <div className="mt-7 grid max-w-3xl gap-2 sm:grid-cols-3">
                <HeroPulse label="Business health" value={`${health.score}/100`} tone={health.score >= 80 ? "green" : "blue"} />
                <HeroPulse label="Connected channels" value={snapshot.connectedMarketplaces.length.toLocaleString()} tone="green" />
                <HeroPulse label="Open priorities" value={priorities.length.toLocaleString()} tone={priorities.length ? "amber" : "green"} />
              </div>
            </div>

            <div className="rounded-[24px] border border-td-ink/[0.09] bg-black/[0.18] p-5 shadow-[0_18px_55px_rgb(var(--td-shadow-rgb)/calc(.24*var(--td-shadow-strength)))] backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-td-accent-text/70">
                  Today&apos;s best next action
                </p>
                <span className="rounded-full border border-td-warning/[0.14] bg-td-warning/[0.055] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-td-warning">
                  {nextAction.impact} impact
                </span>
              </div>

              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-td-primary">
                {nextAction.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-td-muted">
                {nextAction.description}
              </p>

              <div className="mt-5 flex items-center gap-2 text-xs text-td-muted">
                <Clock3 className="h-3.5 w-3.5 text-td-accent-text" />
                About {nextAction.time}
              </div>

              <Link
                href={nextAction.href}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-td-accent to-td-accent text-sm font-semibold text-td-on-accent shadow-[0_16px_38px_rgb(var(--td-accent-rgb)/.24)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgb(var(--td-accent-rgb)/.3)]"
              >
                {nextAction.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Revenue" value={money(snapshot.revenue)} detail="Imported order total" icon={CircleDollarSign} trend="+18%" spark={[28, 42, 36, 56, 64, 78, 88]} />
          <MetricCard label="Profit" value={money(snapshot.profit)} detail="Recorded net profit" icon={TrendingUp} trend="+14%" spark={[22, 30, 44, 41, 58, 72, 82]} />
          <MetricCard label="Orders" value={snapshot.orderCount.toLocaleString()} detail={`${snapshot.openOrderCount} need attention`} icon={ShoppingBag} trend={snapshot.openOrderCount ? `${snapshot.openOrderCount} open` : "Clear"} spark={[18, 32, 29, 48, 54, 68, 74]} />
          <MetricCard label="Inventory" value={snapshot.inventoryUnits.toLocaleString()} detail={`${snapshot.inventoryRecords.toLocaleString()} records`} icon={Boxes} trend="Active" spark={[44, 44, 51, 60, 62, 71, 76]} />
          <MetricCard label="Customers" value={snapshot.customerCount.toLocaleString()} detail="CRM profiles" icon={ContactRound} trend={snapshot.customerCount ? "+1 this week" : "Start CRM"} spark={[10, 15, 22, 24, 36, 44, 52]} />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
          <BusinessHealth health={health} />
          <PriorityPanel priorities={priorities} />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
          <MarketplaceHealth snapshot={snapshot} />
          <TimelinePanel timeline={timeline} />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <ReadinessPanel snapshot={snapshot} />
          <QuickActions />
        </section>
      </div>
    </main>
  );
}

function HeroPulse({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "blue" | "amber";
}) {
  const styles = {
    green: "border-td-success/[0.14] bg-td-success/[0.045] text-td-success",
    blue: "border-td-accent/[0.14] bg-td-accent/[0.04] text-td-accent-text",
    amber: "border-td-warning/[0.14] bg-td-warning/[0.045] text-td-warning",
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-3 ${styles}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] opacity-60">{label}</p>
      <p className="mt-1.5 text-base font-semibold [font-variant-numeric:tabular-nums]">{value}</p>
    </div>
  );
}

function BusinessHealth({
  health,
}: {
  health: ReturnType<typeof calculateHealth>;
}) {
  return (
    <article className="relative overflow-hidden rounded-[26px] border border-td-ink/[0.08] bg-td-surface p-5 shadow-[0_24px_80px_rgb(var(--td-shadow-rgb)/calc(.22*var(--td-shadow-strength)))] sm:p-6">
      <div className="pointer-events-none absolute right-[-70px] top-[-80px] h-56 w-56 rounded-full bg-td-accent/[0.08] blur-[90px]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-td-accent-text/75">Business health</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-td-primary">{health.label}</h2>
          <p className="mt-2 text-sm text-td-muted">A live score across the five systems that keep your operation moving.</p>
        </div>
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-td-accent/[0.15] bg-td-accent/[0.035] shadow-[inset_0_0_35px_rgb(var(--td-accent-rgb)/.05)]">
          <div className="text-center">
            <span className="block text-4xl font-bold tracking-[-0.05em] text-td-primary [font-variant-numeric:tabular-nums]">{health.score}</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-accent-text/60">Score</span>
          </div>
        </div>
      </div>

      <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
        {health.categories.map((category, index) => (
          <div key={category.label} className={`rounded-2xl border border-td-ink/[0.06] bg-black/[0.12] p-4 ${index === health.categories.length - 1 ? "sm:col-span-2" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-td-secondary">{category.label}</p>
                <p className="mt-1 text-[11px] text-td-muted">{category.detail}</p>
              </div>
              <p className="text-sm font-bold text-td-primary">{category.score}</p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-td-ink/[0.055]">
              <span className="block h-full rounded-full bg-gradient-to-r from-td-accent to-td-accent transition-[width] duration-700" style={{ width: `${category.score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function PriorityPanel({ priorities }: { priorities: ReturnType<typeof buildPriorities> }) {
  return (
    <article className="rounded-[26px] border border-td-warning/[0.10] bg-[linear-gradient(180deg,var(--td-surface-default),var(--td-surface-default))] p-5 shadow-[0_24px_80px_rgb(var(--td-shadow-rgb)/calc(.22*var(--td-shadow-strength)))] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-td-warning/80">Today&apos;s priorities</p>
          <h2 className="mt-2 text-xl font-semibold text-td-primary">{priorities.length} actions worth your attention</h2>
        </div>
        <Target className="h-5 w-5 text-td-warning" />
      </div>

      <div className="mt-5 space-y-2.5">
        {priorities.map((priority, index) => (
          <Link key={priority.title} href={priority.href} className="group flex items-center gap-3 rounded-2xl border border-td-ink/[0.065] bg-black/[0.12] p-3.5 transition hover:border-td-warning/[0.2] hover:bg-td-warning/[0.025]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-td-warning/[0.07] text-sm font-bold text-td-warning">{index + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-td-primary">{priority.title}</span>
              <span className="mt-1 block truncate text-[11px] text-td-muted">{priority.detail}</span>
            </span>
            <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${priority.level === "High" ? "bg-td-danger/[0.07] text-td-danger" : priority.level === "Medium" ? "bg-td-warning/[0.07] text-td-warning" : "bg-td-accent/[0.07] text-td-accent-text"}`}>{priority.level}</span>
            <ArrowUpRight className="h-4 w-4 text-td-muted transition group-hover:text-td-warning" />
          </Link>
        ))}
      </div>
    </article>
  );
}

function MarketplaceHealth({ snapshot }: { snapshot: MissionControlSnapshot }) {
  const channels = snapshot.connectedMarketplaces.length ? snapshot.connectedMarketplaces : ["No channels connected"];

  return (
    <article className="rounded-[26px] border border-td-ink/[0.08] bg-td-surface p-5 shadow-[0_24px_80px_rgb(var(--td-shadow-rgb)/calc(.22*var(--td-shadow-strength)))] sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-td-accent-text/75">Marketplace command center</p>
          <h2 className="mt-2 text-xl font-semibold text-td-primary">Connected commerce</h2>
          <p className="mt-1.5 text-sm text-td-muted">Channel status, sync confidence, and order readiness.</p>
        </div>
        <Store className="h-5 w-5 text-td-accent-text" />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {channels.map((channel, index) => {
          const connected = snapshot.connectedMarketplaces.length > 0;
          const confidence = connected ? Math.max(86, 98 - index * 3 - snapshot.failedSyncCount * 2) : 0;
          return (
            <div key={channel} className="rounded-2xl border border-td-ink/[0.065] bg-black/[0.12] p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-td-accent/[0.11] bg-td-accent/[0.04] text-td-accent-text"><Store className="h-4 w-4" /></span>
                <span className={connected ? "rounded-full bg-td-success/[0.07] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-td-success" : "rounded-full bg-td-warning/[0.07] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-td-warning"}>{connected ? "Healthy" : "Setup"}</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-td-primary">{channel}</p>
              <p className="mt-1 text-[11px] text-td-muted">{connected ? `${confidence}% sync confidence` : "Connect this channel"}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-td-ink/[0.055]">
                <span className="block h-full rounded-full bg-gradient-to-r from-td-accent to-td-accent" style={{ width: `${confidence}%` }} />
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] text-td-muted">
                <span>Last sync</span>
                <span className="text-td-muted">{snapshot.lastSyncAt ? new Date(snapshot.lastSyncAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : connected ? "Ready" : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Link href="/dashboard/marketplaces" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-td-accent-text transition hover:text-td-accent-text">
        Manage connections
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

function TimelinePanel({ timeline }: { timeline: Array<{ title: string; detail: string; time: string; tone: "blue" | "green" | "amber" }> }) {
  return (
    <article className="rounded-[26px] border border-td-ink/[0.08] bg-td-surface p-5 shadow-[0_24px_80px_rgb(var(--td-shadow-rgb)/calc(.22*var(--td-shadow-strength)))] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-td-accent-text/75">Business timeline</p>
          <h2 className="mt-2 text-xl font-semibold text-td-primary">Live activity</h2>
        </div>
        <Zap className="h-5 w-5 text-td-accent-text" />
      </div>

      <div className="mt-5 space-y-1">
        {timeline.map((item, index) => (
          <div key={`${item.title}-${index}`} className="group relative flex gap-3 rounded-xl px-2 py-3 transition hover:bg-td-ink/[0.018]">
            {index < timeline.length - 1 ? <span className="absolute bottom-[-6px] left-[25px] top-11 w-px bg-td-ink/[0.07]" /> : null}
            <span className={`relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${item.tone === "green" ? "border-td-success/[0.13] bg-td-success/[0.045] text-td-success" : item.tone === "amber" ? "border-td-warning/[0.13] bg-td-warning/[0.045] text-td-warning" : "border-td-accent/[0.13] bg-td-accent/[0.045] text-td-accent-text"}`}>
              <RefreshCw className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-td-primary">{item.title}</p>
                <span className="shrink-0 text-[11px] text-td-muted">{item.time}</span>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-td-muted">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function ReadinessPanel({ snapshot }: { snapshot: MissionControlSnapshot }) {
  return (
    <article className="relative overflow-hidden rounded-[26px] border border-td-accent/[0.14] bg-[linear-gradient(135deg,rgb(var(--td-accent-rgb)/.11),rgb(var(--td-accent-rgb)/.035))] p-5 shadow-[0_24px_80px_rgb(var(--td-shadow-rgb)/calc(.2*var(--td-shadow-strength)))] sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-td-accent/[0.08] blur-[85px]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-td-accent-text/80">Seller readiness</p>
          <h2 className="mt-2 text-xl font-semibold text-td-primary">{snapshot.readinessComplete}/{snapshot.readinessTotal} core steps complete</h2>
          <p className="mt-2 text-sm leading-6 text-td-muted">Keep tightening the workflows that reduce manual work and move orders faster.</p>
        </div>
        <BadgeCheck className="h-5 w-5 text-td-accent-text" />
      </div>

      <div className="relative mt-6 h-2 overflow-hidden rounded-full bg-td-ink/[0.06]">
        <span className="block h-full rounded-full bg-gradient-to-r from-td-accent to-td-accent" style={{ width: `${snapshot.readinessScore}%` }} />
      </div>

      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-td-accent-text">{snapshot.readinessScore}% operational readiness</span>
        <Link href="/dashboard/seller-launch" className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-accent/[0.14] bg-td-accent/[0.05] px-4 text-xs font-semibold text-td-accent-text transition hover:bg-td-accent/[0.09]">
          Open Seller Launch
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

function QuickActions() {
  const actions = [
    { label: "Import orders", detail: "Pull recent sales", href: "/dashboard/marketplaces", icon: RefreshCw, tone: "blue" },
    { label: "Photo scanner", detail: "Capture new cards", href: "/dashboard/card-photo-scanner", icon: PackageSearch, tone: "violet" },
    { label: "Inventory", detail: "Review stock", href: "/dashboard/inventory", icon: Boxes, tone: "cyan" },
    { label: "Customer CRM", detail: "Build relationships", href: "/dashboard/customers", icon: ContactRound, tone: "green" },
    { label: "Sell Optimizer", detail: "Improve margins", href: "/dashboard/sell-optimizer", icon: TrendingUp, tone: "amber" },
    { label: "Automation", detail: "Reduce manual work", href: "/dashboard/automation", icon: WandSparkles, tone: "violet" },
  ] as const;

  const toneClass = {
    blue: "text-td-accent-text bg-td-accent/[0.05] border-td-accent/[0.11]",
    violet: "text-td-violet bg-td-violet/[0.05] border-td-violet/[0.11]",
    cyan: "text-td-accent-text bg-td-accent/[0.05] border-td-accent/[0.11]",
    green: "text-td-success bg-td-success/[0.05] border-td-success/[0.11]",
    amber: "text-td-warning bg-td-warning/[0.05] border-td-warning/[0.11]",
  };

  return (
    <article className="rounded-[26px] border border-td-ink/[0.08] bg-td-surface p-5 shadow-[0_24px_80px_rgb(var(--td-shadow-rgb)/calc(.22*var(--td-shadow-strength)))] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-td-accent-text/75">Quick launch</p>
          <h2 className="mt-2 text-xl font-semibold text-td-primary">Common actions</h2>
        </div>
        <Sparkles className="h-5 w-5 text-td-violet" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {actions.map(({ label, detail, href, icon: Icon, tone }) => (
          <Link key={label} href={href} className="group flex min-h-[96px] flex-col justify-between rounded-2xl border border-td-ink/[0.065] bg-black/[0.11] p-3.5 transition hover:-translate-y-0.5 hover:border-td-accent/[0.18] hover:bg-td-ink/[0.018]">
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl border ${toneClass[tone]}`}><Icon className="h-4 w-4" /></span>
            <span>
              <span className="block text-xs font-semibold text-td-primary group-hover:text-td-primary">{label}</span>
              <span className="mt-1 block text-[11px] text-td-muted">{detail}</span>
            </span>
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
  trend,
  spark,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  trend: string;
  spark: number[];
}) {
  const max = Math.max(...spark, 1);
  return (
    <article className="group relative overflow-hidden rounded-[22px] border border-td-ink/[0.08] bg-td-surface p-4 shadow-[0_18px_55px_rgb(var(--td-shadow-rgb)/calc(.18*var(--td-shadow-strength)))] transition hover:-translate-y-0.5 hover:border-td-accent/[0.15]">
      <div className="pointer-events-none absolute -right-10 -top-14 h-32 w-32 rounded-full bg-td-accent/[0.06] blur-[55px]" />
      <div className="relative flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-td-muted">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-td-accent/[0.09] bg-td-accent/[0.035] text-td-accent-text"><Icon className="h-4 w-4" /></span>
      </div>
      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tracking-[-0.04em] text-td-primary [font-variant-numeric:tabular-nums]">{value}</p>
          <p className="mt-1.5 text-[11px] text-td-muted">{detail}</p>
        </div>
        <div className="flex h-10 items-end gap-1" aria-hidden="true">
          {spark.map((point, index) => <span key={`${point}-${index}`} className="w-1.5 rounded-full bg-gradient-to-t from-td-accent/70 to-td-accent/90 transition-all duration-500" style={{ height: `${Math.max(18, (point / max) * 100)}%` }} />)}
        </div>
      </div>
      <div className="relative mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-td-success/85"><TrendingUp className="h-3 w-3" />{trend}</div>
    </article>
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
  if (!snapshot.inventoryUnits) return { title: "Add your first inventory", description: "Inventory is the foundation for listings, orders, profit, and reconciliation.", href: "/dashboard/inventory", cta: "Open inventory", time: "5–10 min", impact: "Critical" };
  if (!snapshot.connectedMarketplaces.length) return { title: "Connect your first marketplace", description: "Bring live selling activity into Trading Docks and begin order synchronization.", href: "/dashboard/marketplaces", cta: "Connect a channel", time: "3–5 min", impact: "High" };
  if (!snapshot.orderCount) return { title: "Import your first order", description: "Verify that orders arrive with items, totals, and fulfillment status.", href: "/dashboard/marketplaces", cta: "Import orders", time: "3 min", impact: "High" };
  if (!snapshot.customerCount) return { title: "Create your first customer", description: "Start building customer history, store credit, and loyalty data.", href: "/dashboard/customers", cta: "Open CRM", time: "2 min", impact: "Medium" };
  if (snapshot.openOrderCount > 0) return { title: "Review open orders", description: `${snapshot.openOrderCount} orders currently need fulfillment or status review.`, href: "/dashboard/orders", cta: "Review orders", time: "5 min", impact: "High" };
  return { title: "Review purchasing opportunities", description: "Your core operation is healthy. Look for the next profitable acquisition.", href: "/dashboard/card-photo-scanner", cta: "Open Purchasing", time: "5 min", impact: "Growth" };
}

function buildPriorities(snapshot: MissionControlSnapshot) {
  const priorities: Array<{ title: string; detail: string; href: string; level: "High" | "Medium" | "Growth" }> = [];
  if (snapshot.failedSyncCount > 0) priorities.push({ title: `Resolve ${snapshot.failedSyncCount} failed sync run${snapshot.failedSyncCount === 1 ? "" : "s"}`, detail: "Restore channel confidence and prevent missed order updates.", href: "/dashboard/marketplaces", level: "High" });
  if (snapshot.openOrderCount > 0) priorities.push({ title: `Process ${snapshot.openOrderCount} open order${snapshot.openOrderCount === 1 ? "" : "s"}`, detail: "Move fulfillment forward and reduce customer wait time.", href: "/dashboard/orders", level: "High" });
  if (!snapshot.customerCount) priorities.push({ title: "Create your first customer", detail: "Start building loyalty, store credit, and purchase history.", href: "/dashboard/customers", level: "Medium" });
  if (!snapshot.completedSyncCount) priorities.push({ title: "Run your first synchronization", detail: "Confirm inventory and orders can move through connected channels.", href: "/dashboard/automation", level: "Medium" });
  if (priorities.length < 3) priorities.push({ title: "Review profitable inventory opportunities", detail: "Use purchasing intelligence to identify the next acquisition.", href: "/dashboard/purchasing", level: "Growth" });
  return priorities.slice(0, 3);
}

function buildTimeline(snapshot: MissionControlSnapshot) {
  const items: Array<{ title: string; detail: string; time: string; tone: "blue" | "green" | "amber" }> = [];
  if (snapshot.lastSyncAt) items.push({ title: "Marketplace sync completed", detail: `${snapshot.completedSyncCount} completed sync runs recorded`, time: new Date(snapshot.lastSyncAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), tone: snapshot.failedSyncCount ? "amber" : "green" });
  if (snapshot.orderCount) items.push({ title: "Orders available", detail: `${snapshot.orderCount.toLocaleString()} total orders in the workspace`, time: "Current", tone: "blue" });
  if (snapshot.inventoryUnits) items.push({ title: "Inventory active", detail: `${snapshot.inventoryUnits.toLocaleString()} units tracked`, time: "Current", tone: "green" });
  if (snapshot.customerCount) items.push({ title: "CRM active", detail: `${snapshot.customerCount.toLocaleString()} customer profiles`, time: "Current", tone: "blue" });
  if (!items.length) items.push({ title: "Mission Control initialized", detail: "Complete Seller Launch steps to populate the business timeline.", time: "Now", tone: "blue" });
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
