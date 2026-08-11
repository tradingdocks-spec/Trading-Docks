"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  ShoppingBag,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import type {
  BusinessChannelSummary,
  BusinessCommandCenterSummary,
  BusinessDateRange,
  BusinessNextAction,
} from "@/lib/dashboard/business-command-center";

const RANGE_OPTIONS: Array<{ value: BusinessDateRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "month", label: "This month" },
];

export function BusinessCommandCenter({
  summary,
}: {
  summary: BusinessCommandCenterSummary;
}) {
  const hero = buildHero(summary);
  const attentionActions = summary.nextActions.filter((action) => action.severity !== "low");
  const setupActions = summary.nextActions.filter((action) => action.severity === "low");
  const hasActivity = summary.grossSales > 0 || summary.orderCount > 0;

  return (
    <main className="min-h-screen bg-[#020911] px-4 py-4 text-white sm:px-6 lg:px-8 lg:py-6">
      <div className="mx-auto max-w-[1560px] space-y-4">
        <section className="rounded-[24px] bg-[#071520] px-5 py-4 shadow-[0_20px_80px_rgba(0,0,0,.28)] ring-1 ring-white/[0.06] sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-cyan-300/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200">
                  <Store className="h-3.5 w-3.5" />
                  Trading Docks HQ
                </span>
                <span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold text-slate-400">
                  {summary.hasFullPlatformAccess ? "Full operating view" : summary.hasStoreAccess ? "Store operations" : "Seller operations"}
                </span>
                <span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold text-slate-400">
                  {summary.rangeLabel}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-2">
                <h1 className="max-w-4xl text-2xl font-semibold leading-tight text-white sm:text-4xl">
                  {hero.title}
                </h1>
                <TrendPill value={summary.salesChangePercent} />
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                {hero.detail}
              </p>
            </div>
            <DateRangeControls active={summary.range} />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
            <DominantMetric summary={summary} />
            <PriorityAction action={attentionActions[0] ?? setupActions[0] ?? null} />
          </div>
        </section>

        {hasActivity ? (
          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
            <OperationalSnapshot summary={summary} />
            <FulfillmentPulse summary={summary} />
          </section>
        ) : (
          <OnboardingGuidance connectedChannelCount={summary.connectedChannelCount} />
        )}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,.72fr)]">
          <ChannelPerformance channels={summary.channelBreakdown} />
          <div className="space-y-4">
            <ActionSection
              title="Needs attention"
              eyebrow="Operations"
              icon={<AlertTriangle className="h-4 w-4" />}
              actions={attentionActions}
              emptyTitle="Nothing urgent"
              emptyDetail="Fulfillment, sync, listing, and repricing work will appear here as real records need attention."
              tone="attention"
            />
            <ActionSection
              title="Setup and growth"
              eyebrow="Expansion"
              icon={<CheckCircle2 className="h-4 w-4" />}
              actions={setupActions}
              emptyTitle="Core setup is covered"
              emptyDetail="Optional staff, vendor, and supply setup work will appear here when relevant to your access."
              tone="neutral"
            />
          </div>
        </section>

        {summary.hasStoreAccess ? <StoreOperationsStrip summary={summary} /> : null}
      </div>
    </main>
  );
}

function DateRangeControls({ active }: { active: BusinessDateRange }) {
  return (
    <nav aria-label="Business dashboard date range" className="flex rounded-2xl bg-black/20 p-1 ring-1 ring-white/[0.06]">
      {RANGE_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={`/dashboard?range=${option.value}`}
          aria-current={active === option.value ? "page" : undefined}
          className={`flex h-9 items-center rounded-xl px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-300/45 ${
            active === option.value
              ? "bg-cyan-300 text-slate-950"
              : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

function DominantMetric({ summary }: { summary: BusinessCommandCenterSummary }) {
  return (
    <article className="rounded-[20px] bg-[#0a1b27] p-4 ring-1 ring-white/[0.055]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Revenue pulse</p>
          <p className="mt-2 text-4xl font-semibold text-white [font-variant-numeric:tabular-nums] sm:text-5xl">
            {money(summary.grossSales)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {summary.orderCount.toLocaleString()} orders · {summary.itemsSold.toLocaleString()} items sold · {summary.connectedChannelCount.toLocaleString()} active channels
          </p>
        </div>
        <MiniSparkline tone={summary.salesChangePercent && summary.salesChangePercent < 0 ? "down" : "up"} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <CompactMetric label="AOV" value={summary.averageOrderValue === null ? "No data" : money(summary.averageOrderValue)} icon={<BarChart3 className="h-3.5 w-3.5" />} />
        <CompactMetric label="Profit" value={summary.realizedProfit === null ? "Unavailable" : money(summary.realizedProfit)} icon={<CircleDollarSign className="h-3.5 w-3.5" />} />
        <CompactMetric label="Prior period" value={money(summary.previousGrossSales)} icon={<Clock3 className="h-3.5 w-3.5" />} />
      </div>
    </article>
  );
}

function PriorityAction({ action }: { action: BusinessNextAction | null }) {
  if (!action) {
    return (
      <article className="rounded-[20px] bg-[#081924] p-4 ring-1 ring-white/[0.055]">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Most important next action</p>
        <p className="mt-3 text-lg font-semibold text-white">Business systems are quiet.</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">No urgent order, sync, listing, or store actions are waiting right now.</p>
      </article>
    );
  }

  return (
    <article className="rounded-[20px] bg-[#081924] p-4 ring-1 ring-white/[0.055]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Most important next action</p>
        <SeverityDot severity={action.severity} />
      </div>
      <p className="mt-3 text-lg font-semibold text-white">{action.label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{action.detail}</p>
      <Link href={action.href} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100">
        Open workflow
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

function OperationalSnapshot({ summary }: { summary: BusinessCommandCenterSummary }) {
  return (
    <section className="rounded-[22px] bg-[#06141e] p-4 shadow-[0_18px_60px_rgba(0,0,0,.2)] ring-1 ring-white/[0.055]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/75">Operating snapshot</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Seller performance</h2>
        </div>
        <ShoppingBag className="h-4 w-4 text-cyan-300" />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <CompactMetric label="Orders" value={summary.orderCount.toLocaleString()} detail={`${summary.previousOrderCount.toLocaleString()} prior`} icon={<ShoppingBag className="h-3.5 w-3.5" />} />
        <CompactMetric label="Items sold" value={summary.itemsSold.toLocaleString()} detail="Imported line items" icon={<Boxes className="h-3.5 w-3.5" />} />
        <CompactMetric label="Listings" value={summary.listingIssues.toLocaleString()} detail={summary.listingIssues ? "Need review" : "No conflicts"} icon={<PackageCheck className="h-3.5 w-3.5" />} />
        <CompactMetric label="Sync issues" value={summary.syncIssues.toLocaleString()} detail={summary.syncIssues ? "Needs attention" : "Healthy"} icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
      </div>
    </section>
  );
}

function FulfillmentPulse({ summary }: { summary: BusinessCommandCenterSummary }) {
  const completed = Math.max(0, summary.orderCount - summary.openFulfillmentCount);
  const percent = summary.orderCount > 0 ? (completed / summary.orderCount) * 100 : 100;
  return (
    <section className="rounded-[22px] bg-[#06141e] p-4 shadow-[0_18px_60px_rgba(0,0,0,.2)] ring-1 ring-white/[0.055]">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300/75">Fulfillment</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold text-white">{summary.openFulfillmentCount.toLocaleString()}</p>
          <p className="mt-1 text-sm text-slate-500">orders need fulfillment</p>
        </div>
        <p className="text-sm font-semibold text-emerald-300">{Math.round(percent)}% clear</p>
      </div>
      <ProgressBar value={percent} tone={summary.openFulfillmentCount ? "attention" : "healthy"} />
      <p className="mt-3 text-xs leading-5 text-slate-600">
        Fulfillment measures imported orders against open shipment/review states.
      </p>
    </section>
  );
}

function OnboardingGuidance({ connectedChannelCount }: { connectedChannelCount: number }) {
  return (
    <section className="rounded-[22px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.2)] ring-1 ring-white/[0.055]">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/75">Activation path</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {connectedChannelCount ? "Waiting for first imported order." : "Connect real sales data to activate HQ."}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Trading Docks does not fill this surface with demo revenue. Once orders arrive, this page switches from setup guidance to operational intelligence.
          </p>
        </div>
        <Link href="/dashboard/marketplaces" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100">
          Connect another channel
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function ChannelPerformance({ channels }: { channels: BusinessChannelSummary[] }) {
  const connected = channels.filter((channel) => channel.connected);
  const disconnectedCount = channels.length - connected.length;
  const totalSales = connected.reduce((sum, channel) => sum + channel.grossSales, 0);
  const rows = connected.length ? connected : channels.slice(0, 2);

  return (
    <section className="rounded-[22px] bg-[#06141e] p-4 shadow-[0_18px_60px_rgba(0,0,0,.2)] ring-1 ring-white/[0.055]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/75">Channel performance</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Marketplace matrix</h2>
        </div>
        {disconnectedCount > 0 ? (
          <Link href="/dashboard/marketplaces" className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.04] px-3 text-xs font-semibold text-slate-300 transition hover:bg-cyan-300/[0.08] hover:text-cyan-100">
            Connect another channel
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-black/15">
        <div className="grid min-w-[620px] grid-cols-[minmax(120px,1.2fr)_1fr_.8fr_.8fr_92px] gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
          <span>Channel</span>
          <span>Sales</span>
          <span>Orders</span>
          <span>AOV</span>
          <span>Status</span>
        </div>
        {rows.map((channel) => (
          <div key={channel.id} className="grid min-w-[620px] grid-cols-[minmax(120px,1.2fr)_1fr_.8fr_.8fr_92px] gap-3 border-t border-white/[0.045] px-4 py-3 text-sm">
            <span className="font-semibold text-slate-100">{channel.label}</span>
            <span className="font-semibold text-white [font-variant-numeric:tabular-nums]">{channel.connected ? money(channel.grossSales) : "—"}</span>
            <span className="text-slate-400 [font-variant-numeric:tabular-nums]">{channel.connected ? channel.orderCount.toLocaleString() : "—"}</span>
            <span className="text-slate-400 [font-variant-numeric:tabular-nums]">{channel.averageOrderValue === null ? "—" : money(channel.averageOrderValue)}</span>
            <span className={channel.connected ? "text-emerald-300" : "text-slate-600"}>{channel.connected ? "Active" : "Not connected"}</span>
            {channel.connected ? (
              <div className="col-span-5">
                <ProgressBar value={totalSales > 0 ? (channel.grossSales / totalSales) * 100 : 0} tone="brand" compact />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {disconnectedCount > 0 ? (
        <p className="mt-3 text-xs text-slate-600">
          {disconnectedCount.toLocaleString()} supported {disconnectedCount === 1 ? "channel is" : "channels are"} not connected. Disconnected channels stay neutral until configured.
        </p>
      ) : null}
    </section>
  );
}

function ActionSection({
  title,
  eyebrow,
  icon,
  actions,
  emptyTitle,
  emptyDetail,
  tone,
}: {
  title: string;
  eyebrow: string;
  icon: ReactNode;
  actions: BusinessNextAction[];
  emptyTitle: string;
  emptyDetail: string;
  tone: "attention" | "neutral";
}) {
  return (
    <section className="rounded-[22px] bg-[#06141e] p-4 shadow-[0_18px_60px_rgba(0,0,0,.2)] ring-1 ring-white/[0.055]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${tone === "attention" ? "text-amber-300/80" : "text-slate-500"}`}>{eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
        </div>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone === "attention" ? "bg-amber-300/[0.08] text-amber-200" : "bg-white/[0.04] text-slate-400"}`}>
          {icon}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {actions.length ? actions.map((action) => <ActionRow key={action.id} action={action} />) : (
          <div className="rounded-2xl bg-black/15 p-4">
            <p className="text-sm font-semibold text-white">{emptyTitle}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{emptyDetail}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function ActionRow({ action }: { action: BusinessNextAction }) {
  return (
    <Link href={action.href} className="group flex items-center gap-3 rounded-2xl bg-black/15 p-3 transition hover:bg-white/[0.035] focus:outline-none focus:ring-2 focus:ring-cyan-300/45">
      <SeverityDot severity={action.severity} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-200 group-hover:text-white">{action.label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-600">{action.detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-700 transition group-hover:text-cyan-200" />
    </Link>
  );
}

function StoreOperationsStrip({ summary }: { summary: BusinessCommandCenterSummary }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StoreMetric label="Customers" value={countOrUnavailable(summary.customerCount)} detail="CRM profiles" icon={<Users className="h-4 w-4" />} />
      <StoreMetric label="Employees" value={countOrUnavailable(summary.employeeCount)} detail="Store team records" icon={<Users className="h-4 w-4" />} />
      <StoreMetric label="Vendors" value={countOrUnavailable(summary.vendorCount)} detail="Vendor relationships" icon={<Store className="h-4 w-4" />} />
      <StoreMetric label="Supply alerts" value={countOrUnavailable(summary.supplyAlertCount)} detail="Tracked supply records" icon={<PackageCheck className="h-4 w-4" />} />
    </section>
  );
}

function CompactMetric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-black/15 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600">{label}</p>
        <span className="text-cyan-300/80">{icon}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-white [font-variant-numeric:tabular-nums]">{value}</p>
      {detail ? <p className="mt-0.5 text-[11px] text-slate-600">{detail}</p> : null}
    </div>
  );
}

function StoreMetric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-[20px] bg-[#06141e] p-4 shadow-[0_18px_60px_rgba(0,0,0,.18)] ring-1 ring-white/[0.055]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600">{label}</p>
        <span className="text-slate-400">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-white [font-variant-numeric:tabular-nums]">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{detail}</p>
    </article>
  );
}

function SeverityDot({ severity }: { severity: BusinessNextAction["severity"] }) {
  const className = severity === "high"
    ? "bg-rose-400 text-rose-950"
    : severity === "medium"
      ? "bg-amber-300 text-amber-950"
      : "bg-slate-700 text-slate-200";
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${className}`}>
      {severity === "low" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
    </span>
  );
}

function TrendPill({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex h-8 items-center gap-2 rounded-full bg-white/[0.04] px-3 text-xs font-semibold text-slate-400">
        Prior period pending
      </span>
    );
  }
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-bold ${positive ? "bg-emerald-300/[0.1] text-emerald-300" : "bg-rose-300/[0.1] text-rose-300"}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value).toFixed(1)}% {positive ? "up" : "down"}
    </span>
  );
}

function MiniSparkline({ tone }: { tone: "up" | "down" }) {
  const bars = tone === "up" ? [34, 42, 38, 55, 61, 72, 84] : [84, 76, 70, 64, 58, 48, 40];
  const color = tone === "up" ? "bg-emerald-300" : "bg-rose-300";
  return (
    <div aria-hidden="true" className="flex h-16 w-28 items-end gap-1.5 rounded-2xl bg-black/15 px-3 py-2">
      {bars.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={`w-2 rounded-full ${color}`}
          style={{
            height: `${height}%`,
            opacity: index < 2 ? 0.4 : index < 5 ? 0.6 : 0.9,
          }}
        />
      ))}
    </div>
  );
}

function ProgressBar({
  value,
  tone,
  compact = false,
}: {
  value: number;
  tone: "brand" | "healthy" | "attention";
  compact?: boolean;
}) {
  const color = tone === "brand" ? "bg-cyan-300" : tone === "healthy" ? "bg-emerald-300" : "bg-amber-300";
  return (
    <div className={`mt-3 overflow-hidden rounded-full bg-white/[0.06] ${compact ? "h-1" : "h-2"}`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function buildHero(summary: BusinessCommandCenterSummary) {
  if (summary.grossSales > 0 || summary.orderCount > 0) {
    return {
      title: `${money(summary.grossSales)} sold ${summary.rangeLabel.toLowerCase()}`,
      detail: `${summary.orderCount.toLocaleString()} orders across ${summary.connectedChannelCount.toLocaleString()} connected sales ${summary.connectedChannelCount === 1 ? "channel" : "channels"}.`,
    };
  }

  if (summary.connectedChannelCount > 0) {
    return {
      title: `Zero orders ${summary.rangeLabel.toLowerCase()}`,
      detail: `${summary.connectedChannelCount.toLocaleString()} sales ${summary.connectedChannelCount === 1 ? "channel is" : "channels are"} connected. Trading Docks will show real sales, fulfillment, and profit as orders arrive.`,
    };
  }

  return {
    title: "Connect a sales channel to activate HQ",
    detail: "Seller and Store metrics stay empty until real marketplace, direct, or POS data exists. No demo revenue is shown.",
  };
}

function countOrUnavailable(value: number | null) {
  return value === null ? "Unavailable" : value.toLocaleString();
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
