"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CircleDollarSign,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";

import type {
  BusinessChannelSummary,
  BusinessCommandCenterSummary,
  BusinessNextAction,
} from "@/lib/dashboard/business-command-center";

export function BusinessCommandCenter({
  summary,
}: {
  summary: BusinessCommandCenterSummary;
}) {
  const hero = buildHero(summary);
  const comparison = comparisonCopy(summary.salesChangePercent);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.08),transparent_30%),#020911] px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1580px] space-y-4">
        <section className="relative overflow-hidden rounded-[30px] border border-cyan-300/[0.14] bg-[linear-gradient(135deg,#082131_0%,#061522_56%,#03101a_100%)] p-5 shadow-[0_34px_120px_rgba(0,0,0,.46)] sm:p-7">
          <div className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full bg-cyan-400/[0.14] blur-[120px]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent" />
          <div className="relative grid gap-6 xl:grid-cols-[1fr_420px] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.16] bg-cyan-400/[0.055] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">
                  <Store className="h-3.5 w-3.5" />
                  Trading Docks HQ
                </span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[10px] font-semibold text-slate-400">
                  {summary.hasFullPlatformAccess ? "Full platform access" : summary.hasStoreAccess ? "Store operations" : "Seller operations"}
                </span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[10px] font-semibold text-slate-400">
                  {summary.rangeLabel}
                </span>
              </div>

              <h1 className="mt-5 max-w-4xl text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.06em] text-white sm:text-5xl">
                {hero.title}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
                {hero.detail}
              </p>
              <p className="mt-3 text-xs font-semibold text-cyan-200/85">
                {comparison}
              </p>
            </div>

            <div className="rounded-[24px] border border-white/[0.08] bg-black/[0.16] p-4 shadow-[0_18px_60px_rgba(0,0,0,.26)] backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Next best action</p>
                <AlertTriangle className="h-4 w-4 text-amber-300" />
              </div>
              {summary.nextActions[0] ? (
                <ActionPreview action={summary.nextActions[0]} />
              ) : (
                <div className="mt-4">
                  <p className="text-lg font-semibold text-white">Business systems are quiet.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">No urgent order, sync, listing, or store actions are waiting right now.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Sales this week" value={money(summary.grossSales)} detail={summary.connectedChannelCount ? "Imported order totals" : "Connect a channel"} icon={<CircleDollarSign className="h-4 w-4" />} />
          <MetricCard label="Orders this week" value={summary.orderCount.toLocaleString()} detail={summary.orderCount === 0 && summary.connectedChannelCount ? "Zero orders recorded" : `${summary.openFulfillmentCount} need fulfillment`} icon={<ShoppingBag className="h-4 w-4" />} />
          <MetricCard label="Items sold" value={summary.itemsSold.toLocaleString()} detail={summary.itemsSold ? "Across imported line items" : "No sold items recorded"} icon={<Boxes className="h-4 w-4" />} />
          <MetricCard label="Average order value" value={summary.averageOrderValue === null ? "No data" : money(summary.averageOrderValue)} detail="Gross sales / order count" icon={<TrendingUp className="h-4 w-4" />} />
          <MetricCard label="Net realized profit" value={summary.realizedProfit === null ? "Unavailable" : money(summary.realizedProfit)} detail={summary.realizedProfit === null ? "Requires profit fields" : "Recorded order profit"} icon={<PackageCheck className="h-4 w-4" />} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <ChannelPerformance channels={summary.channelBreakdown} />
          <NextActions actions={summary.nextActions} />
        </section>

        {summary.hasStoreAccess ? (
          <section className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Customers" value={countOrUnavailable(summary.customerCount)} detail="CRM profiles" icon={<Users className="h-4 w-4" />} />
            <MetricCard label="Employees" value={countOrUnavailable(summary.employeeCount)} detail="Store team records" icon={<Users className="h-4 w-4" />} />
            <MetricCard label="Vendors" value={countOrUnavailable(summary.vendorCount)} detail="Vendor relationships" icon={<Store className="h-4 w-4" />} />
            <MetricCard label="Supply alerts" value={countOrUnavailable(summary.supplyAlertCount)} detail="Tracked supply records" icon={<PackageCheck className="h-4 w-4" />} />
          </section>
        ) : null}
      </div>
    </main>
  );
}

function ChannelPerformance({ channels }: { channels: BusinessChannelSummary[] }) {
  return (
    <section className="rounded-[26px] border border-white/[0.08] bg-[#061522] p-5 shadow-[0_22px_80px_rgba(0,0,0,.24)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/75">Channel performance</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">Sales by marketplace</h2>
        </div>
        <Store className="h-5 w-5 text-cyan-300" />
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-2">
        {channels.map((channel) => (
          <article key={channel.id} className="rounded-2xl border border-white/[0.065] bg-black/[0.11] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{channel.label}</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  {channel.connected
                    ? channel.orderCount
                      ? `${channel.orderCount.toLocaleString()} orders`
                      : "Connected, zero orders"
                    : "Not connected"}
                </p>
              </div>
              <span className={channel.connected ? "rounded-full bg-emerald-300/[0.08] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-300" : "rounded-full bg-amber-300/[0.08] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-200"}>
                {channel.connected ? "Connected" : "Setup"}
              </span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xl font-semibold tracking-[-0.04em] text-white">{channel.connected ? money(channel.grossSales) : "Connect marketplace"}</p>
                <p className="mt-1 text-[10px] text-slate-600">
                  {channel.averageOrderValue === null ? "No AOV yet" : `${money(channel.averageOrderValue)} average order`}
                </p>
              </div>
              {!channel.connected ? (
                <Link href="/dashboard/marketplaces" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-cyan-300/[0.13] bg-cyan-400/[0.055] px-3 text-[10px] font-semibold text-cyan-100">
                  Connect
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NextActions({ actions }: { actions: BusinessNextAction[] }) {
  return (
    <section className="rounded-[26px] border border-white/[0.08] bg-[#061522] p-5 shadow-[0_22px_80px_rgba(0,0,0,.24)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/75">Operational next actions</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">What needs attention</h2>
        </div>
        <RefreshCw className="h-5 w-5 text-amber-300" />
      </div>

      <div className="mt-5 space-y-2.5">
        {actions.length ? actions.map((action) => <ActionRow key={action.id} action={action} />) : (
          <div className="rounded-2xl border border-white/[0.065] bg-black/[0.11] p-4">
            <p className="text-sm font-semibold text-white">No urgent actions</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">Trading Docks will surface fulfillment, sync, repricing, and store work as real records arrive.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function ActionPreview({ action }: { action: BusinessNextAction }) {
  return (
    <div className="mt-4">
      <p className="text-xl font-semibold tracking-[-0.035em] text-white">{action.label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{action.detail}</p>
      <Link href={action.href} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 text-sm font-bold text-[#001018]">
        Open workflow
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ActionRow({ action }: { action: BusinessNextAction }) {
  const tone = action.severity === "high"
    ? "border-rose-300/[0.13] bg-rose-300/[0.035] text-rose-200"
    : action.severity === "medium"
      ? "border-amber-300/[0.13] bg-amber-300/[0.035] text-amber-200"
      : "border-cyan-300/[0.13] bg-cyan-300/[0.035] text-cyan-200";

  return (
    <Link href={action.href} className="group flex items-center gap-3 rounded-2xl border border-white/[0.065] bg-black/[0.11] p-3.5 transition hover:border-cyan-300/[0.14] hover:bg-white/[0.018]">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tone}`}>
        <AlertTriangle className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-200 group-hover:text-white">{action.label}</span>
        <span className="mt-1 block text-[11px] leading-5 text-slate-600">{action.detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-700 transition group-hover:text-cyan-200" />
    </Link>
  );
}

function MetricCard({
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
    <article className="rounded-[22px] border border-white/[0.08] bg-[#061522] p-4 shadow-[0_18px_60px_rgba(0,0,0,.2)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-600">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-300/[0.1] bg-cyan-400/[0.045] text-cyan-300">{icon}</span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-[-0.045em] text-white [font-variant-numeric:tabular-nums]">{value}</p>
      <p className="mt-1.5 text-[11px] leading-5 text-slate-600">{detail}</p>
    </article>
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

function comparisonCopy(value: number | null) {
  if (value === null) return "Prior-period comparison will appear after the previous period has sales.";
  if (value === 0) return "Flat versus the prior equivalent period.";
  const direction = value > 0 ? "up" : "down";
  return `${Math.abs(value).toFixed(1)}% ${direction} versus the prior equivalent period.`;
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
