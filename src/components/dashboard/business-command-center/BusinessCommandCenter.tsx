"use client";

import Link from "next/link";
import styles from "./BusinessCommandCenter.module.css";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
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
  BusinessRevenueSeriesPoint,
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
  { value: "90d", label: "90D" },
  { value: "12m", label: "12M" },
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
    <main className={`${styles.dashboard} min-h-screen bg-td-canvas px-4 py-4 text-td-primary sm:px-6 lg:px-8 lg:py-6`}>
      <div className="mx-auto max-w-[1560px] space-y-4">
        <section className="rounded-2xl bg-td-surface px-5 py-4 ring-1 ring-td-ink/[0.055] sm:px-6">
          <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-td-accent/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-td-accent-text">
                  <Store className="h-3.5 w-3.5" />
                  Trading Docks HQ
                </span>
                <span className="rounded-full bg-td-ink/[0.04] px-3 py-1.5 text-[11px] font-semibold text-td-secondary">
                  {summary.hasFullPlatformAccess ? "Full operating view" : summary.hasStoreAccess ? "Store operations" : "Seller operations"}
                </span>
                <span className="rounded-full bg-td-ink/[0.04] px-3 py-1.5 text-[11px] font-semibold text-td-secondary">
                  {summary.rangeLabel}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="max-w-4xl text-2xl font-semibold leading-snug tracking-[-0.03em] text-td-primary lg:text-3xl">
                  {summary.executiveBrief.headline}
                </h1>
              </div>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-td-secondary">
                {summary.executiveBrief.metricsLine}
              </p>
              {summary.executiveBrief.explanation ? (
                <p className="mt-2 max-w-4xl text-sm leading-6 text-td-secondary">
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
    <nav aria-label="Business dashboard date range" className="grid w-full grid-cols-3 gap-1 rounded-xl bg-black/20 p-1 ring-1 ring-td-ink/[0.06] sm:flex sm:w-fit sm:shrink-0">
      {RANGE_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={`/dashboard?range=${option.value}`}
          aria-current={active === option.value ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-td-accent/45 ${
            active === option.value
              ? `bg-td-accent ${styles.primaryLink}`
              : "text-td-secondary hover:bg-td-ink/[0.04] hover:text-td-primary"
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
    <section className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-accent-text/75">{"Today's Docks Brief"}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-td-primary">Operating intelligence</h2>
        </div>
        <Radar className="h-5 w-5 text-td-accent-text" />
      </div>
      <p className="mt-3 max-w-5xl text-sm leading-6 text-td-secondary">
        {summary.docksBrief}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <CoveragePill label="Inventory attribution" value={summary.inventoryAttribution.coveragePercent} />
        <CoveragePill label="Cost-basis confidence" value={summary.profitConfidence.coveragePercent} />
        <CoveragePill label="Inventory value coverage" value={summary.inventoryCapital.coveragePercent} />
      </div>
    </section>
  );
}

function RevenueProfitModule({ summary }: { summary: BusinessCommandCenterSummary }) {
  const hasProfit = summary.revenueSeries.some((point) => point.profitEstimate !== null);
  const profitLabel = summary.profitConfidence.level === "High" ? "Profit estimate" : "Profit estimate - low confidence";
  return (
    <section className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055] lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-accent-text/75">Revenue & Profit</p>
          <p className="mt-2 text-5xl font-semibold tracking-[-0.05em] text-td-primary [font-variant-numeric:tabular-nums]">
            {money(summary.grossSales)}
          </p>
          <p className="mt-2 text-sm text-td-secondary">
            {summary.orderCount.toLocaleString()} orders · {summary.averageOrderValue === null ? "AOV unavailable" : `${money(summary.averageOrderValue)} AOV`}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 rounded-2xl bg-black/15 p-4 sm:items-end">
          <p className="text-[11px] font-semibold tracking-wide text-td-secondary">Current vs prior</p>
          <TrendPill value={summary.salesChangePercent} />
          <p className="text-xs text-td-secondary">{money(summary.previousGrossSales)} prior period</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 2xl:grid-cols-4">
        <CompactMetric label="Orders" value={summary.orderCount.toLocaleString()} detail={`${summary.previousOrderCount.toLocaleString()} prior`} icon={<ShoppingBag className="h-3.5 w-3.5" />} />
        <CompactMetric label="AOV" value={summary.averageOrderValue === null ? "No data" : money(summary.averageOrderValue)} detail="Average order value" icon={<BarChart3 className="h-3.5 w-3.5" />} />
        <CompactMetric
          label={hasProfit ? "Profit estimate" : "Profit pending"}
          value={summary.realizedProfit === null ? "Pending cost basis" : money(summary.realizedProfit)}
          detail={`${summary.profitConfidence.level} confidence`}
          icon={<CircleDollarSign className="h-3.5 w-3.5" />}
        />
        <CompactMetric label="Prior period" value={money(summary.previousGrossSales)} detail="Comparable range" icon={<Clock3 className="h-3.5 w-3.5" />} />
      </div>
      <RevenueProfitChart
        points={summary.revenueSeries}
        range={summary.range}
        profitLabel={profitLabel}
        showProfit={hasProfit}
      />
    </section>
  );
}

function ProfitConfidenceModule({ summary }: { summary: BusinessCommandCenterSummary }) {
  return (
    <section className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-secondary">Profit Confidence</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold text-td-primary">{summary.profitConfidence.level}</p>
          <p className="mt-1 text-xs leading-5 text-td-secondary">{summary.profitConfidence.reason}</p>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-td-secondary">
            Cost basis coverage · {summary.profitKnownUnits.toLocaleString()} / {summary.profitTotalUnits.toLocaleString()} sold units
          </p>
        </div>
        <span className="text-sm font-semibold text-td-accent-text">{Math.round(summary.profitConfidence.coveragePercent)}%</span>
      </div>
      <ProgressBar value={summary.profitConfidence.coveragePercent} tone={summary.profitConfidence.level === "High" ? "healthy" : summary.profitConfidence.level === "Medium" ? "attention" : "critical"} />
    </section>
  );
}

function InventoryAttributionModule({ summary }: { summary: BusinessCommandCenterSummary }) {
  return (
    <section className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-secondary">Inventory Attribution</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold text-td-primary">{Math.round(summary.inventoryAttribution.coveragePercent)}% matched</p>
          <p className="mt-1 text-xs leading-5 text-td-secondary">{summary.inventoryAttribution.reason}</p>
        </div>
        <Link href="/dashboard/orders" className="shrink-0 rounded-xl bg-td-ink/[0.04] px-3 py-2 text-xs font-semibold text-td-secondary transition hover:bg-td-accent/[0.08] hover:text-td-accent-text">
          Match items
        </Link>
      </div>
      <ProgressBar value={summary.inventoryAttribution.coveragePercent} tone={summary.inventoryAttribution.coveragePercent >= 80 ? "healthy" : "attention"} />
    </section>
  );
}

function TradingDocksSignals({ signals }: { signals: TradingDocksSignal[] }) {
  return (
    <section className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-accent-text/75">Trading Docks Signals</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-td-primary">What the business is telling you</h2>
        </div>
        <LineChart className="h-5 w-5 text-td-accent-text" />
      </div>
      <div className="mt-4 grid gap-3">
        {signals.length ? signals.map((signal) => (
          <Link key={signal.id} href={signal.actionHref} className="group rounded-2xl bg-black/15 p-4 transition hover:bg-td-ink/[0.035] focus:outline-none focus:ring-2 focus:ring-td-accent/45">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={signal.priority} />
                  <p className="text-sm font-semibold text-td-primary">{signal.title}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-td-secondary">{signal.description}</p>
              </div>
              <p className="text-lg font-semibold text-td-accent-text [font-variant-numeric:tabular-nums]">{signal.metric}</p>
            </div>
            <p className="mt-2 text-xs text-td-secondary">{signal.impact}</p>
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
    <section className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-warning/75">Fulfillment</p>
          <h2 className="mt-1 text-lg font-semibold text-td-primary">{summary.openFulfillmentCount.toLocaleString()} orders need action</h2>
        </div>
        <p className="text-sm font-semibold text-td-success">{Math.round(percent)}% clear</p>
      </div>
      <ProgressBar value={percent} tone={summary.openFulfillmentCount ? "attention" : "healthy"} />
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniStat label="Ready to pack" value={readyToPack} />
        <MiniStat label="Need matching" value={matchingCount} />
        <MiniStat label="Require review" value={reviewCount} />
      </div>
      <Link href="/dashboard/orders" className={`${styles.primaryLink} mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-td-accent px-4 text-xs font-bold text-td-on-accent transition hover:bg-td-accent-hover focus:outline-none focus:ring-2 focus:ring-td-accent`}>
        Review fulfillment
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

function InventoryCapitalModule({ summary }: { summary: BusinessCommandCenterSummary }) {
  return (
    <section className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-secondary">Known inventory market subtotal</p>
      <p className="mt-3 text-3xl font-semibold text-td-primary">{summary.inventoryCapital.coveragePercent > 0 ? money(summary.inventoryCapital.totalValue) : "Valuation unavailable"}</p>
      <p className="mt-1 text-xs leading-5 text-td-secondary">
        {Math.round(summary.inventoryCapital.coveragePercent)}% of sampled inventory rows have value coverage.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniStat label="Listed value" value={summary.inventoryCapital.coveragePercent > 0 ? money(summary.inventoryCapital.listedValue) : "Unavailable"} />
        <MiniStat label="Unlisted value" value={summary.inventoryCapital.coveragePercent > 0 ? money(summary.inventoryCapital.unlistedValue) : "Unavailable"} />
        <MiniStat label="Capital at risk" value={summary.inventoryCapital.coveragePercent > 0 ? money(summary.inventoryCapital.staleValue) : "Unavailable"} />
      </div>
      {summary.inventoryCapital.staleValue > 0 ? (
        <p className="mt-3 rounded-2xl bg-td-warning/[0.06] p-3 text-xs leading-5 text-td-warning/80">
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
    <section className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-accent-text/75">Channel Performance 2.0</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-td-primary">Marketplace matrix</h2>
        </div>
        {disconnectedCount > 0 ? (
          <Link href="/dashboard/marketplaces" className="inline-flex h-9 items-center gap-2 rounded-xl bg-td-ink/[0.04] px-3 text-xs font-semibold text-td-secondary transition hover:bg-td-accent/[0.08] hover:text-td-accent-text">
            Connect another channel
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-black/15">
        <div className="grid min-w-[820px] grid-cols-[minmax(120px,1.2fr)_1fr_.8fr_.8fr_.8fr_.9fr_92px] gap-3 px-4 py-3 text-[11px] font-semibold tracking-wide text-td-secondary">
          <span>Channel</span>
          <span>Sales</span>
          <span>Orders</span>
          <span>AOV</span>
          <span>Share</span>
          <span>Change</span>
          <span>Status</span>
        </div>
        {rows.map((channel) => (
          <div key={channel.id} className="grid min-w-[820px] grid-cols-[minmax(120px,1.2fr)_1fr_.8fr_.8fr_.8fr_.9fr_92px] gap-3 border-t border-td-ink/[0.045] px-4 py-3 text-sm">
            <span className="font-semibold text-td-primary">{channel.label}</span>
            <span className="font-semibold text-td-primary [font-variant-numeric:tabular-nums]">{channel.connected ? money(channel.grossSales) : "—"}</span>
            <span className="text-td-secondary [font-variant-numeric:tabular-nums]">{channel.connected ? channel.orderCount.toLocaleString() : "—"}</span>
            <span className="text-td-secondary [font-variant-numeric:tabular-nums]">{channel.averageOrderValue === null ? "—" : money(channel.averageOrderValue)}</span>
            <span className="text-td-secondary [font-variant-numeric:tabular-nums]">{channel.connected ? `${Math.round(channel.revenueSharePercent)}%` : "—"}</span>
            <span className={deltaTone(channel.salesChangePercent)}>{formatPercentChange(channel.salesChangePercent)}</span>
            <span className={channel.connected ? "text-td-success" : "text-td-secondary"}>{channel.connected ? "Active" : "Not connected"}</span>
            {channel.connected ? (
              <div className="col-span-7">
                <ProgressBar value={channel.revenueSharePercent} tone="brand" compact />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {disconnectedCount > 0 ? (
        <p className="mt-3 text-xs text-td-secondary">
          {disconnectedCount.toLocaleString()} supported {disconnectedCount === 1 ? "channel is" : "channels are"} not connected. Disconnected channels stay neutral until configured.
        </p>
      ) : null}
    </section>
  );
}

function WhatChanged({ deltas }: { deltas: PeriodDelta[] }) {
  return (
    <section className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-secondary">What Changed</p>
      <div className="mt-4 space-y-2">
        {deltas.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 border-l-2 border-td-accent/20 px-3 py-1.5">
            <span className="text-sm font-semibold text-td-primary">{item.label}</span>
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
    <section className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-accent-text/75">Opportunity Feed</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-td-primary">Where to act next</h2>
        </div>
        <Link href="/dashboard/market-intelligence" className="text-xs font-semibold text-td-secondary transition hover:text-td-accent-text">View all opportunities</Link>
      </div>
      <div className="mt-4 grid gap-2">
        {opportunities.length ? opportunities.map((item) => (
          <Link key={item.id} href={item.href} className="group rounded-2xl bg-black/15 p-4 transition hover:bg-td-ink/[0.035] focus:outline-none focus:ring-2 focus:ring-td-accent/45">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-td-accent-text/70">{item.label}</p>
            <div className="mt-2 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-td-primary">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-td-secondary">{item.detail}</p>
              </div>
              <p className="shrink-0 text-lg font-semibold text-td-primary">{item.metric}</p>
            </div>
          </Link>
        )) : <EmptyPanel title="No opportunity feed yet" detail="Trading Docks only creates opportunities from supported records such as orders, pricing reviews, stale inventory, and item matching gaps." />}
      </div>
    </section>
  );
}

function ActivityFeed({ summary }: { summary: BusinessCommandCenterSummary }) {
  return (
    <section className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-secondary">Business Activity</p>
      <div className="mt-4 space-y-2">
        {summary.activityFeed.length ? summary.activityFeed.map((event) => (
          <div key={event.id} className="rounded-2xl bg-black/15 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-td-primary">{event.label}</p>
              <p className="text-[11px] text-td-secondary">{shortDate(event.occurredAt)}</p>
            </div>
            <p className="mt-1 text-xs text-td-secondary">{event.detail}</p>
          </div>
        )) : <EmptyPanel title="No reliable activity stream" detail="Activity appears when orders or marketplace sync events have meaningful timestamps." />}
      </div>
    </section>
  );
}

function PriorityAction({ action }: { action: BusinessNextAction | null }) {
  if (!action) {
    return (
      <article className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-secondary">Next best action</p>
        <p className="mt-3 text-lg font-semibold text-td-primary">Business systems are quiet.</p>
        <p className="mt-2 text-sm leading-6 text-td-secondary">No urgent order, sync, listing, or store actions are waiting right now.</p>
      </article>
    );
  }

  return (
    <article className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-secondary">Next best action</p>
        <SeverityDot severity={action.severity} />
      </div>
      <p className="mt-3 text-xl font-semibold tracking-[-0.02em] text-td-primary">{action.label}</p>
      <p className="mt-2 text-sm leading-6 text-td-secondary">{action.detail}</p>
      <Link href={action.href} className={`${styles.primaryLink} mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-td-accent px-4 text-xs font-bold text-td-on-accent transition hover:bg-td-accent-hover focus:outline-none focus:ring-2 focus:ring-td-accent`}>
        Open workflow
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

function OnboardingGuidance({ connectedChannelCount }: { connectedChannelCount: number }) {
  return (
    <section className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-accent-text/75">Activation path</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-td-primary">
            {connectedChannelCount ? "Waiting for first imported order." : "Connect real sales data to activate HQ."}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-td-secondary">
            Trading Docks does not fill this surface with demo revenue. Once orders arrive, this page switches from setup guidance to operational intelligence.
          </p>
        </div>
        <Link href="/dashboard/marketplaces" className={`${styles.primaryLink} inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-td-accent px-4 text-sm font-bold text-td-on-accent transition hover:bg-td-accent-hover focus:outline-none focus:ring-2 focus:ring-td-accent`}>
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
    <section className="rounded-2xl bg-td-surface p-5 ring-1 ring-td-ink/[0.055]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${tone === "attention" ? "text-td-warning/80" : "text-td-secondary"}`}>{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-td-primary">{title}</h2>
        </div>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone === "attention" ? "bg-td-warning/[0.08] text-td-warning" : "bg-td-ink/[0.04] text-td-secondary"}`}>
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
    <Link href={action.href} className="group flex items-center gap-3 rounded-2xl bg-black/15 p-3 transition hover:bg-td-ink/[0.035] focus:outline-none focus:ring-2 focus:ring-td-accent/45">
      <SeverityDot severity={action.severity} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-td-primary group-hover:text-td-primary">{action.label}</span>
        <span className="mt-1 block text-xs leading-5 text-td-secondary">{action.detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-td-muted transition group-hover:text-td-accent-text" />
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
        <p className="text-[11px] font-semibold tracking-wide text-td-secondary">{label}</p>
        <span className="text-td-accent-text/80">{icon}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-td-primary [font-variant-numeric:tabular-nums]">{value}</p>
      {detail ? <p className="mt-0.5 text-[11px] text-td-secondary">{detail}</p> : null}
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
    <article className="rounded-[20px] bg-td-surface p-4 ring-1 ring-td-ink/[0.055]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-wide text-td-secondary">{label}</p>
        <span className="text-td-secondary">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-td-primary [font-variant-numeric:tabular-nums]">{value}</p>
      <p className="mt-1 text-xs text-td-secondary">{detail}</p>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-black/15 p-3">
      <p className="text-[11px] font-semibold tracking-wide text-td-secondary">{label}</p>
      <p className="mt-2 text-lg font-semibold text-td-primary [font-variant-numeric:tabular-nums]">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-black/15 p-4">
      <p className="text-sm font-semibold text-td-primary">{title}</p>
      <p className="mt-1 text-xs leading-5 text-td-secondary">{detail}</p>
    </div>
  );
}

function SeverityDot({ severity }: { severity: BusinessNextAction["severity"] }) {
  const className = severity === "critical"
    ? "bg-td-danger text-td-danger"
    : severity === "high"
      ? "bg-td-warning text-td-warning"
      : severity === "medium"
        ? "bg-td-accent text-td-accent-text"
        : "bg-td-surface text-td-primary";
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${className}`}>
      {severity === "low" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TradingDocksSignal["priority"] }) {
  const className = priority === "critical"
    ? "bg-td-danger/[0.12] text-td-danger"
    : priority === "high"
      ? "bg-td-warning/[0.12] text-td-warning"
      : priority === "medium"
        ? "bg-td-accent/[0.1] text-td-accent-text"
        : "bg-td-surface/60 text-td-secondary";
  return <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-[0.13em] ${className}`}>{priority}</span>;
}

function TrendPill({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex h-8 items-center gap-2 rounded-full bg-td-ink/[0.04] px-3 text-xs font-semibold text-td-secondary">
        Prior period pending
      </span>
    );
  }
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-bold ${positive ? "bg-td-success/[0.1] text-td-success" : "bg-td-danger/[0.1] text-td-danger"}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value).toFixed(1)}% {positive ? "up" : "down"}
    </span>
  );
}

function RevenueProfitChart({
  points,
  range,
  profitLabel,
  showProfit,
}: {
  points: BusinessRevenueSeriesPoint[];
  range: BusinessDateRange;
  profitLabel: string;
  showProfit: boolean;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const activePoint = points.find((point) => point.key === hoveredKey) ?? points.at(-1) ?? null;
  const maxValue = Math.max(
    1,
    ...points.map((point) => point.revenue),
    ...points.map((point) => point.profitEstimate ?? 0),
  );
  const profitPoints = points.filter((point) => point.profitEstimate !== null);
  const profitPath = buildLinePath(profitPoints, points, maxValue);
  const revenuePath = buildLinePath(points, points, maxValue, "revenue");
  const hasRevenue = points.some((point) => point.revenue > 0);
  const axisLabels = points.filter((point) => point.axisLabel);

  return (
    <div className="mt-5 rounded-2xl bg-black/20 p-4 ring-1 ring-td-ink/[0.04]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-td-primary">Revenue trend</p>
          <p className="mt-1 text-xs leading-5 text-td-secondary">
            {range === "12m" ? "Monthly" : range === "90d" ? "Weekly" : "Daily"} revenue. Profit is only plotted when cost basis exists.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
          <span className="inline-flex items-center gap-2 rounded-full bg-td-accent/[0.08] px-3 py-1.5 text-td-accent-text"><span className="h-2 w-2 rounded-full bg-td-accent" />Revenue</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-td-success/[0.08] px-3 py-1.5 text-td-success"><span className="h-2 w-2 rounded-full bg-td-success" />{profitLabel}</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-td-ink/[0.04] px-3 py-1.5 text-td-secondary"><ShoppingBag className="h-3 w-3" />Orders</span>
        </div>
      </div>

      <div className="relative mt-4 min-h-[310px] overflow-hidden rounded-2xl bg-td-surface px-3 pb-10 pt-4 ring-1 ring-td-ink/[0.035]">
        {hasRevenue ? (
          <svg role="img" aria-label="Revenue and profit chart" viewBox="0 0 100 100" preserveAspectRatio="none" className="h-72 w-full overflow-visible">
            <defs>
              <linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--td-accent-rgb)/0.32)" />
                <stop offset="100%" stopColor="rgb(var(--td-accent-rgb)/0)" />
              </linearGradient>
            </defs>
            {[20, 40, 60, 80].map((y) => (
              <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgb(var(--td-accent-rgb)/0.12)" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
            ))}
            {points.map((point, index) => {
              const width = Math.max(1.2, 58 / Math.max(points.length, 1));
              const x = xPosition(index, points.length);
              const height = chartHeight(point.revenue, maxValue);
              return (
                <rect
                  key={point.key}
                  x={x - width / 2}
                  y={90 - height}
                  width={width}
                  height={height}
                  rx="0.9"
                  fill="rgb(var(--td-accent-rgb)/0.28)"
                  stroke={point.key === activePoint?.key ? "rgb(var(--td-accent-rgb)/0.9)" : "rgb(var(--td-accent-rgb)/0.22)"}
                  strokeWidth="0.35"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            <path d={`${revenuePath} L 100 90 L 0 90 Z`} fill="url(#revenue-fill)" />
            <path d={revenuePath} fill="none" stroke="rgb(34,211,238)" strokeWidth="1.15" vectorEffect="non-scaling-stroke" />
            {showProfit && profitPath ? <path d={profitPath} fill="none" stroke="rgb(110,231,183)" strokeWidth="1" strokeDasharray={profitLabel.includes("low") ? "2 2" : undefined} vectorEffect="non-scaling-stroke" /> : null}
            {points.map((point, index) => {
              const x = xPosition(index, points.length);
              const value = point.profitEstimate;
              return value === null || !showProfit ? null : (
                <circle key={`${point.key}-profit`} cx={x} cy={90 - chartHeight(value, maxValue)} r={point.key === activePoint?.key ? 1.4 : 0.9} fill="rgb(110,231,183)" vectorEffect="non-scaling-stroke" />
              );
            })}
            {points.map((point, index) => {
              const x = xPosition(index, points.length);
              return (
                <rect
                  key={`${point.key}-hit`}
                  x={Math.max(0, x - 100 / Math.max(points.length, 1) / 2)}
                  y="0"
                  width={100 / Math.max(points.length, 1)}
                  height="100"
                  fill="transparent"
                  onMouseEnter={() => setHoveredKey(point.key)}
                  onFocus={() => setHoveredKey(point.key)}
                  tabIndex={0}
                />
              );
            })}
          </svg>
        ) : (
          <div className="flex h-72 flex-col items-center justify-center text-center">
            <BarChart3 className="h-7 w-7 text-td-muted" />
            <p className="mt-3 text-sm font-semibold text-td-primary">No revenue in this range yet</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-td-secondary">Connect or import orders and this panel becomes a month-aware revenue and profit chart.</p>
          </div>
        )}

        {activePoint && hasRevenue ? (
          <div className="relative mt-3 w-full sm:absolute sm:right-4 sm:top-4 sm:mt-0 sm:w-56 rounded-2xl bg-td-surface/95 p-3 text-xs shadow-2xl ring-1 ring-td-accent/[0.12] backdrop-blur">
            <p className="font-semibold text-td-primary">{activePoint.label}</p>
            <div className="mt-2 space-y-1.5">
              <TooltipRow label="Revenue" value={money(activePoint.revenue)} tone="cyan" />
              <TooltipRow label="Profit estimate" value={activePoint.profitEstimate === null ? "Cost basis pending" : money(activePoint.profitEstimate)} tone="emerald" />
              <TooltipRow label="Orders" value={activePoint.orders.toLocaleString()} />
              <TooltipRow label="Profit coverage" value={`${Math.round(activePoint.profitCoverageRatio * 100)}%`} />
            </div>
          </div>
        ) : null}

        <div className="absolute inset-x-3 bottom-3 grid" style={{ gridTemplateColumns: `repeat(${Math.max(axisLabels.length, 1)}, minmax(0, 1fr))` }}>
          {axisLabels.map((point) => (
            <span key={`${point.key}-axis`} className="truncate text-center text-[11px] font-medium text-td-secondary">{point.axisLabel}</span>
          ))}
        </div>
      </div>

      {!showProfit ? (
        <p className="mt-3 rounded-2xl bg-td-warning/[0.055] px-3 py-2 text-xs leading-5 text-td-warning/80">
          Profit is not plotted yet because sold inventory lacks enough known cost basis. Revenue remains authoritative.
        </p>
      ) : null}
    </div>
  );
}

function xPosition(index: number, total: number) {
  if (total <= 1) return 50;
  return 4 + (index / (total - 1)) * 92;
}

function chartHeight(value: number, maxValue: number) {
  return Math.max(0, Math.min(80, (value / Math.max(1, maxValue)) * 78));
}

function buildLinePath(
  visiblePoints: BusinessRevenueSeriesPoint[],
  allPoints: BusinessRevenueSeriesPoint[],
  maxValue: number,
  valueKey: "revenue" | "profitEstimate" = "profitEstimate",
) {
  if (!visiblePoints.length) return "";
  return visiblePoints.map((point) => {
    const index = allPoints.findIndex((candidate) => candidate.key === point.key);
    const value = valueKey === "revenue" ? point.revenue : point.profitEstimate ?? 0;
    return `${point === visiblePoints[0] ? "M" : "L"} ${xPosition(Math.max(0, index), allPoints.length).toFixed(2)} ${(90 - chartHeight(value, maxValue)).toFixed(2)}`;
  }).join(" ");
}

function TooltipRow({ label, value, tone }: { label: string; value: string; tone?: "cyan" | "emerald" }) {
  const toneClass = tone === "cyan" ? "text-td-accent-text" : tone === "emerald" ? "text-td-success" : "text-td-secondary";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-td-secondary">{label}</span>
      <span className={`font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

function CoveragePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-black/15 px-3 py-2">
      <p className="text-[11px] font-semibold tracking-wide text-td-secondary">{label}</p>
      <p className="mt-1 text-sm font-semibold text-td-primary">{Math.round(value)}%</p>
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
  const color = tone === "brand" ? "bg-td-accent" : tone === "healthy" ? "bg-td-success" : tone === "critical" ? "bg-td-danger" : "bg-td-warning";
  return (
    <div className={`mt-3 overflow-hidden rounded-full bg-td-ink/[0.06] ${compact ? "h-1" : "h-2"}`}>
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
  if (value === null || value === 0) return "text-td-secondary";
  return value > 0 ? "text-td-success" : "text-td-danger";
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
