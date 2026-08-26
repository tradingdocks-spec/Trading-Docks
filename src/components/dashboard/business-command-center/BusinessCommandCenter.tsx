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
  LineChart,
  PackageCheck,
  Radar,
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
import type {
  BusinessOpportunity,
  PeriodDelta,
  TradingDocksSignal,
} from "@/lib/dashboard/intelligence/business-intelligence";

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
  const operationalActions = summary.nextActions.filter((action) => action.category !== "setup");
  const setupActions = summary.nextActions.filter((action) => action.category === "setup");
  const hasActivity = summary.grossSales > 0 || summary.orderCount > 0;

  return (
    <main className="min-h-screen bg-[#020911] px-4 py-4 text-white sm:px-6 lg:px-8 lg:py-6">
      <div className="mx-auto max-w-[1560px] space-y-4">
        <section className="rounded-[26px] bg-[#071520] px-5 py-4 shadow-[0_22px_80px_rgba(0,0,0,.3)] ring-1 ring-white/[0.055] sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-cyan-300/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-200">
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

              <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="max-w-5xl text-2xl font-semibold leading-tight tracking-[-0.03em] text-white sm:text-4xl">
                  {summary.executiveBrief.headline}
                </h1>
                <TrendPill value={summary.salesChangePercent} />
              </div>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                {summary.executiveBrief.metricsLine}
              </p>
              {summary.executiveBrief.explanation ? (
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
                  {summary.executiveBrief.explanation}
                </p>
              ) : null}
            </div>
            <DateRangeControls active={summary.range} />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.7fr)]">
          <TradingDocksBrief summary={summary} />
          <PriorityAction action={operationalActions[0] ?? setupActions[0] ?? null} />
        </section>

        {hasActivity ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.7fr)]">
            <RevenueProfitModule summary={summary} />
            <div className="space-y-4">
              <ProfitConfidenceModule summary={summary} />
              <InventoryAttributionModule summary={summary} />
            </div>
          </section>
        ) : (
          <OnboardingGuidance connectedChannelCount={summary.connectedChannelCount} />
        )}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
          <TradingDocksSignals signals={summary.signals} />
          <div className="space-y-4">
            <FulfillmentModule summary={summary} />
            <InventoryCapitalModule summary={summary} />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.62fr)]">
          <ChannelPerformance channels={summary.channelBreakdown} />
          <WhatChanged deltas={summary.periodDeltas} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.62fr)]">
          <OpportunityFeed opportunities={summary.opportunities} />
          <ActivityFeed summary={summary} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.62fr)]">
          <ActionSection
            title="Needs attention"
            eyebrow="Ranked actions"
            icon={<AlertTriangle className="h-4 w-4" />}
            actions={operationalActions}
            emptyTitle="Nothing urgent"
            emptyDetail="Operational actions appear only when real orders, syncs, pricing reviews, or inventory gaps need attention."
            tone="attention"
          />
          <ActionSection
            title="Workspace setup"
            eyebrow="Growth"
            icon={<CheckCircle2 className="h-4 w-4" />}
            actions={setupActions}
            emptyTitle="Setup is covered"
            emptyDetail="Staff, vendor, channel, and supply setup stays separate from urgent fulfillment work."
            tone="neutral"
          />
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

function TradingDocksBrief({ summary }: { summary: BusinessCommandCenterSummary }) {
  return (
    <section className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.22)] ring-1 ring-white/[0.055]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-300/75">Today's Docks Brief</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white">Operating intelligence</h2>
        </div>
        <Radar className="h-5 w-5 text-cyan-300" />
      </div>
      <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-300">
        {summary.docksBrief}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <CoveragePill label="Inventory attribution" value={summary.inventoryAttribution.coveragePercent} />
        <CoveragePill label="Cost-basis confidence" value={summary.profitConfidence.coveragePercent} />
        <CoveragePill label="Inventory value coverage" value={summary.inventoryCapital.coveragePercent} />
      </div>
    </section>
  );
}

function RevenueProfitModule({ summary }: { summary: BusinessCommandCenterSummary }) {
  return (
    <section className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.22)] ring-1 ring-white/[0.055]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-300/75">Revenue & Profit</p>
          <p className="mt-2 text-5xl font-semibold tracking-[-0.05em] text-white [font-variant-numeric:tabular-nums]">
            {money(summary.grossSales)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {summary.orderCount.toLocaleString()} orders · {summary.averageOrderValue === null ? "AOV unavailable" : `${money(summary.averageOrderValue)} AOV`}
          </p>
        </div>
        <TrendBlock current={summary.grossSales} previous={summary.previousGrossSales} change={summary.salesChangePercent} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-4">
        <CompactMetric label="Orders" value={summary.orderCount.toLocaleString()} detail={`${summary.previousOrderCount.toLocaleString()} prior`} icon={<ShoppingBag className="h-3.5 w-3.5" />} />
        <CompactMetric label="AOV" value={summary.averageOrderValue === null ? "No data" : money(summary.averageOrderValue)} detail="Average order value" icon={<BarChart3 className="h-3.5 w-3.5" />} />
        <CompactMetric
          label="Profit estimate"
          value={summary.realizedProfit === null ? "Pending cost basis" : money(summary.realizedProfit)}
          detail={`${summary.profitConfidence.level} confidence`}
          icon={<CircleDollarSign className="h-3.5 w-3.5" />}
        />
        <CompactMetric label="Prior period" value={money(summary.previousGrossSales)} detail="Comparable range" icon={<Clock3 className="h-3.5 w-3.5" />} />
      </div>
      <PeriodBars current={summary.grossSales} previous={summary.previousGrossSales} />
    </section>
  );
}

function ProfitConfidenceModule({ summary }: { summary: BusinessCommandCenterSummary }) {
  return (
    <section className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)] ring-1 ring-white/[0.055]">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Profit Confidence</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold text-white">{summary.profitConfidence.level}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{summary.profitConfidence.reason}</p>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-600">
            Cost basis coverage · {summary.profitKnownUnits.toLocaleString()} / {summary.profitTotalUnits.toLocaleString()} sold units
          </p>
        </div>
        <span className="text-sm font-semibold text-cyan-200">{Math.round(summary.profitConfidence.coveragePercent)}%</span>
      </div>
      <ProgressBar value={summary.profitConfidence.coveragePercent} tone={summary.profitConfidence.level === "High" ? "healthy" : summary.profitConfidence.level === "Medium" ? "attention" : "critical"} />
    </section>
  );
}

function InventoryAttributionModule({ summary }: { summary: BusinessCommandCenterSummary }) {
  return (
    <section className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)] ring-1 ring-white/[0.055]">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Inventory Attribution</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold text-white">{Math.round(summary.inventoryAttribution.coveragePercent)}% matched</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{summary.inventoryAttribution.reason}</p>
        </div>
        <Link href="/dashboard/orders" className="shrink-0 rounded-xl bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-cyan-300/[0.08] hover:text-cyan-100">
          Match items
        </Link>
      </div>
      <ProgressBar value={summary.inventoryAttribution.coveragePercent} tone={summary.inventoryAttribution.coveragePercent >= 80 ? "healthy" : "attention"} />
    </section>
  );
}

function TradingDocksSignals({ signals }: { signals: TradingDocksSignal[] }) {
  return (
    <section className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.22)] ring-1 ring-white/[0.055]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-300/75">Trading Docks Signals</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white">What the business is telling you</h2>
        </div>
        <LineChart className="h-5 w-5 text-cyan-300" />
      </div>
      <div className="mt-4 grid gap-3">
        {signals.length ? signals.map((signal) => (
          <Link key={signal.id} href={signal.actionHref} className="group rounded-2xl bg-black/15 p-4 transition hover:bg-white/[0.035] focus:outline-none focus:ring-2 focus:ring-cyan-300/45">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={signal.priority} />
                  <p className="text-sm font-semibold text-white">{signal.title}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{signal.description}</p>
              </div>
              <p className="text-lg font-semibold text-cyan-100 [font-variant-numeric:tabular-nums]">{signal.metric}</p>
            </div>
            <p className="mt-2 text-xs text-slate-600">{signal.impact}</p>
          </Link>
        )) : (
          <EmptyPanel title="No supported signals yet" detail="Signals appear only when real orders, inventory, listings, syncs, or pricing reviews provide enough evidence." />
        )}
      </div>
    </section>
  );
}

function FulfillmentModule({ summary }: { summary: BusinessCommandCenterSummary }) {
  const completed = Math.max(0, summary.orderCount - summary.openFulfillmentCount);
  const percent = summary.orderCount > 0 ? (completed / summary.orderCount) * 100 : 100;
  const matchingCount = summary.inventoryAttribution.unmatchedLineCount;
  const reviewCount = summary.listingIssues;
  const readyToPack = Math.max(0, summary.openFulfillmentCount - matchingCount - reviewCount);
  return (
    <section className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)] ring-1 ring-white/[0.055]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-300/75">Fulfillment</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{summary.openFulfillmentCount.toLocaleString()} orders need action</h2>
        </div>
        <p className="text-sm font-semibold text-emerald-300">{Math.round(percent)}% clear</p>
      </div>
      <ProgressBar value={percent} tone={summary.openFulfillmentCount ? "attention" : "healthy"} />
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniStat label="Ready to pack" value={readyToPack} />
        <MiniStat label="Need matching" value={matchingCount} />
        <MiniStat label="Require review" value={reviewCount} />
      </div>
      <Link href="/dashboard/orders" className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100">
        Review fulfillment
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

function InventoryCapitalModule({ summary }: { summary: BusinessCommandCenterSummary }) {
  return (
    <section className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)] ring-1 ring-white/[0.055]">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Inventory Capital</p>
      <p className="mt-3 text-3xl font-semibold text-white">{money(summary.inventoryCapital.totalValue)}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        {Math.round(summary.inventoryCapital.coveragePercent)}% of sampled inventory rows have value coverage.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniStat label="Listed value" value={money(summary.inventoryCapital.listedValue)} />
        <MiniStat label="Unlisted value" value={money(summary.inventoryCapital.unlistedValue)} />
        <MiniStat label="Capital at risk" value={money(summary.inventoryCapital.staleValue)} />
      </div>
      {summary.inventoryCapital.staleValue > 0 ? (
        <p className="mt-3 rounded-2xl bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100/80">
          {summary.inventoryCapital.staleItemCount.toLocaleString()} products are stale for {summary.inventoryCapital.staleThresholdDays}+ days.
        </p>
      ) : null}
    </section>
  );
}

function ChannelPerformance({ channels }: { channels: BusinessChannelSummary[] }) {
  const connected = channels.filter((channel) => channel.connected);
  const disconnectedCount = channels.length - connected.length;
  const rows = connected.length ? connected : channels.slice(0, 2);

  return (
    <section className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.22)] ring-1 ring-white/[0.055]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-300/75">Channel Performance 2.0</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white">Marketplace matrix</h2>
        </div>
        {disconnectedCount > 0 ? (
          <Link href="/dashboard/marketplaces" className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.04] px-3 text-xs font-semibold text-slate-300 transition hover:bg-cyan-300/[0.08] hover:text-cyan-100">
            Connect another channel
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-black/15">
        <div className="grid min-w-[820px] grid-cols-[minmax(120px,1.2fr)_1fr_.8fr_.8fr_.8fr_.9fr_92px] gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600">
          <span>Channel</span>
          <span>Sales</span>
          <span>Orders</span>
          <span>AOV</span>
          <span>Share</span>
          <span>Change</span>
          <span>Status</span>
        </div>
        {rows.map((channel) => (
          <div key={channel.id} className="grid min-w-[820px] grid-cols-[minmax(120px,1.2fr)_1fr_.8fr_.8fr_.8fr_.9fr_92px] gap-3 border-t border-white/[0.045] px-4 py-3 text-sm">
            <span className="font-semibold text-slate-100">{channel.label}</span>
            <span className="font-semibold text-white [font-variant-numeric:tabular-nums]">{channel.connected ? money(channel.grossSales) : "—"}</span>
            <span className="text-slate-400 [font-variant-numeric:tabular-nums]">{channel.connected ? channel.orderCount.toLocaleString() : "—"}</span>
            <span className="text-slate-400 [font-variant-numeric:tabular-nums]">{channel.averageOrderValue === null ? "—" : money(channel.averageOrderValue)}</span>
            <span className="text-slate-400 [font-variant-numeric:tabular-nums]">{channel.connected ? `${Math.round(channel.revenueSharePercent)}%` : "—"}</span>
            <span className={deltaTone(channel.salesChangePercent)}>{formatPercentChange(channel.salesChangePercent)}</span>
            <span className={channel.connected ? "text-emerald-300" : "text-slate-600"}>{channel.connected ? "Active" : "Not connected"}</span>
            {channel.connected ? (
              <div className="col-span-7">
                <ProgressBar value={channel.revenueSharePercent} tone="brand" compact />
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

function WhatChanged({ deltas }: { deltas: PeriodDelta[] }) {
  return (
    <section className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)] ring-1 ring-white/[0.055]">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">What Changed</p>
      <div className="mt-4 space-y-2">
        {deltas.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl bg-black/15 px-3 py-2.5">
            <span className="text-sm font-semibold text-slate-200">{item.label}</span>
            <span className={`text-sm font-semibold [font-variant-numeric:tabular-nums] ${deltaTone(item.delta)}`}>
              {formatDelta(item)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function OpportunityFeed({ opportunities }: { opportunities: BusinessOpportunity[] }) {
  return (
    <section className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)] ring-1 ring-white/[0.055]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-300/75">Opportunity Feed</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white">Where to act next</h2>
        </div>
        <Link href="/dashboard/market-intelligence" className="text-xs font-semibold text-slate-400 transition hover:text-cyan-200">View all opportunities</Link>
      </div>
      <div className="mt-4 grid gap-2">
        {opportunities.length ? opportunities.map((item) => (
          <Link key={item.id} href={item.href} className="group rounded-2xl bg-black/15 p-4 transition hover:bg-white/[0.035] focus:outline-none focus:ring-2 focus:ring-cyan-300/45">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-300/70">{item.label}</p>
            <div className="mt-2 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
              </div>
              <p className="shrink-0 text-lg font-semibold text-white">{item.metric}</p>
            </div>
          </Link>
        )) : <EmptyPanel title="No opportunity feed yet" detail="Trading Docks only creates opportunities from supported records such as orders, pricing reviews, stale inventory, and item matching gaps." />}
      </div>
    </section>
  );
}

function ActivityFeed({ summary }: { summary: BusinessCommandCenterSummary }) {
  return (
    <section className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)] ring-1 ring-white/[0.055]">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Business Activity</p>
      <div className="mt-4 space-y-2">
        {summary.activityFeed.length ? summary.activityFeed.map((event) => (
          <div key={event.id} className="rounded-2xl bg-black/15 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-200">{event.label}</p>
              <p className="text-[11px] text-slate-600">{shortDate(event.occurredAt)}</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">{event.detail}</p>
          </div>
        )) : <EmptyPanel title="No reliable activity stream" detail="Activity appears when orders or marketplace sync events have meaningful timestamps." />}
      </div>
    </section>
  );
}

function PriorityAction({ action }: { action: BusinessNextAction | null }) {
  if (!action) {
    return (
      <article className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)] ring-1 ring-white/[0.055]">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Next best action</p>
        <p className="mt-3 text-lg font-semibold text-white">Business systems are quiet.</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">No urgent order, sync, listing, or store actions are waiting right now.</p>
      </article>
    );
  }

  return (
    <article className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)] ring-1 ring-white/[0.055]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Next best action</p>
        <SeverityDot severity={action.severity} />
      </div>
      <p className="mt-3 text-xl font-semibold tracking-[-0.02em] text-white">{action.label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{action.detail}</p>
      <Link href={action.href} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100">
        Open workflow
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

function OnboardingGuidance({ connectedChannelCount }: { connectedChannelCount: number }) {
  return (
    <section className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.2)] ring-1 ring-white/[0.055]">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-300/75">Activation path</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-white">
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
    <section className="rounded-[24px] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)] ring-1 ring-white/[0.055]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.15em] ${tone === "attention" ? "text-amber-300/80" : "text-slate-500"}`}>{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white">{title}</h2>
        </div>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone === "attention" ? "bg-amber-300/[0.08] text-amber-200" : "bg-white/[0.04] text-slate-400"}`}>
          {icon}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {actions.length ? actions.map((action) => <ActionRow key={action.id} action={action} />) : (
          <EmptyPanel title={emptyTitle} detail={emptyDetail} />
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

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-black/15 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white [font-variant-numeric:tabular-nums]">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-black/15 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>
    </div>
  );
}

function SeverityDot({ severity }: { severity: BusinessNextAction["severity"] }) {
  const className = severity === "critical"
    ? "bg-rose-400 text-rose-950"
    : severity === "high"
      ? "bg-amber-300 text-amber-950"
      : severity === "medium"
        ? "bg-cyan-300 text-cyan-950"
        : "bg-slate-700 text-slate-200";
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${className}`}>
      {severity === "low" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TradingDocksSignal["priority"] }) {
  const className = priority === "critical"
    ? "bg-rose-400/[0.12] text-rose-200"
    : priority === "high"
      ? "bg-amber-300/[0.12] text-amber-200"
      : priority === "medium"
        ? "bg-cyan-300/[0.1] text-cyan-200"
        : "bg-slate-700/60 text-slate-300";
  return <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.13em] ${className}`}>{priority}</span>;
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

function TrendBlock({ current, previous, change }: { current: number; previous: number; change: number | null }) {
  return (
    <div className="min-w-[180px] rounded-2xl bg-black/15 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600">Current vs prior</p>
      <div className="mt-3 flex h-16 items-end gap-2" aria-hidden="true">
        <TrendBar value={previous} max={Math.max(current, previous, 1)} muted />
        <TrendBar value={current} max={Math.max(current, previous, 1)} />
      </div>
      <p className={`mt-2 text-sm font-semibold ${deltaTone(change)}`}>{formatPercentChange(change)}</p>
    </div>
  );
}

function TrendBar({ value, max, muted = false }: { value: number; max: number; muted?: boolean }) {
  return <span className={`w-8 rounded-t-lg ${muted ? "bg-slate-700" : "bg-cyan-300"}`} style={{ height: `${Math.max(8, (value / max) * 100)}%` }} />;
}

function PeriodBars({ current, previous }: { current: number; previous: number }) {
  const max = Math.max(current, previous, 1);
  return (
    <div className="mt-5 rounded-2xl bg-black/15 p-4">
      <div className="grid gap-3">
        <PeriodBar label="Current period" value={current} max={max} tone="brand" />
        <PeriodBar label="Prior period" value={previous} max={max} tone="neutral" />
      </div>
    </div>
  );
}

function PeriodBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "brand" | "neutral" }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-200">{money(value)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${tone === "brand" ? "bg-cyan-300" : "bg-slate-600"}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
      </div>
    </div>
  );
}

function CoveragePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-black/15 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{Math.round(value)}%</p>
    </div>
  );
}

function ProgressBar({
  value,
  tone,
  compact = false,
}: {
  value: number;
  tone: "brand" | "healthy" | "attention" | "critical";
  compact?: boolean;
}) {
  const color = tone === "brand" ? "bg-cyan-300" : tone === "healthy" ? "bg-emerald-300" : tone === "critical" ? "bg-rose-400" : "bg-amber-300";
  return (
    <div className={`mt-3 overflow-hidden rounded-full bg-white/[0.06] ${compact ? "h-1" : "h-2"}`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function formatDelta(item: PeriodDelta) {
  if (item.delta === null) return "Pending";
  const prefix = item.delta > 0 ? "+" : item.delta < 0 ? "−" : "";
  const absolute = Math.abs(item.delta);
  if (item.format === "money") return `${prefix}${money(absolute)}`;
  if (item.format === "percent") return `${prefix}${absolute.toFixed(1)} pts`;
  return `${prefix}${absolute.toLocaleString()}`;
}

function formatPercentChange(value: number | null) {
  if (value === null) return "Pending";
  if (value === 0) return "Flat";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

function deltaTone(value: number | null) {
  if (value === null || value === 0) return "text-slate-500";
  return value > 0 ? "text-emerald-300" : "text-rose-300";
}

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
