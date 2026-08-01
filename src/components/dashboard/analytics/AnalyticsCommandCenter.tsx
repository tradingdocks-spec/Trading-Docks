"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Download,
  Gauge,
  Layers3,
  PackageOpen,
  Percent,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  WalletCards,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { WorkspaceFrame } from "@/components/dashboard/common/WorkspaceFrame";
import type { AccountTier } from "@/lib/plan-entitlements";

type Props = {
  plan: AccountTier;
  inventory: { units: number; value: number; skus: number; addedLast30Days: number };
};

type Range = "7D" | "30D" | "90D" | "1Y";
type ChartMetric = "Revenue" | "Gross profit" | "Net profit" | "Orders";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("en-US");

const rangeLabels: Record<Range, string> = {
  "7D": "Last 7 days",
  "30D": "Last 30 days",
  "90D": "Last 90 days",
  "1Y": "Last 12 months",
};

export function AnalyticsCommandCenter({ plan, inventory }: Props) {
  const [range, setRange] = useState<Range>("30D");
  const [metric, setMetric] = useState<ChartMetric>("Revenue");
  const [channel, setChannel] = useState("All channels");
  const hasInventory = inventory.skus > 0;
  const sellerView = plan === "seller" || plan === "business";
  const planLabel = plan === "business" ? "Store" : plan[0].toUpperCase() + plan.slice(1);
  const readinessSteps = hasInventory ? 1 : 0;

  const metrics = useMemo(
    () => [
      { label: "Gross sales", value: "$0", detail: "No completed orders", icon: CircleDollarSign },
      { label: "Net profit", value: "$0", detail: "After costs and fees", icon: TrendingUp },
      { label: "Inventory value", value: currency.format(inventory.value), detail: `${number.format(inventory.units)} units across ${number.format(inventory.skus)} SKUs`, icon: Boxes },
      { label: "Sell-through", value: "0%", detail: "No sales in this period", icon: Gauge },
      { label: "Avg. order value", value: "$0", detail: "No completed orders", icon: ShoppingBag },
      { label: "Inventory turnover", value: "0.0×", detail: "Needs sales history", icon: RefreshCw },
    ],
    [inventory],
  );

  function exportReport() {
    const rows = [
      ["Trading Docks Analytics", rangeLabels[range]],
      ["Metric", "Value"],
      ["Gross sales", "0"],
      ["Net profit", "0"],
      ["Inventory value", inventory.value.toFixed(2)],
      ["Inventory units", String(inventory.units)],
      ["Inventory SKUs", String(inventory.skus)],
      ["Sell-through", "0%"],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `trading-docks-analytics-${range.toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <WorkspaceFrame>
      <div className="space-y-4 sm:space-y-5">
        <header className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(8,27,39,.96),rgba(5,17,26,.96))] shadow-[0_24px_80px_rgba(0,0,0,.22)]">
          <div className="relative px-4 py-5 sm:px-6 lg:px-7">
            <div className="pointer-events-none absolute right-[-5rem] top-[-8rem] h-72 w-72 rounded-full bg-cyan-400/[0.08] blur-3xl" />
            <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.16] bg-cyan-300/[0.055] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                    <BarChart3 className="h-3.5 w-3.5" /> Analytics command center
                  </span>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[9px] font-semibold text-slate-400">{planLabel} view</span>
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-[2.15rem]">Know what is working.</h1>
                <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-slate-400">One clear view of profitability, inventory velocity, and the next move that deserves your attention.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">Analytics readiness</p><p className="mt-1 text-xs font-semibold text-slate-300">{readinessSteps} of 3 sources ready</p></div>
                <button type="button" onClick={exportReport} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.045] px-4 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07]">
                  <Download className="h-4 w-4 text-cyan-300" /> Export report
                </button>
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.07] bg-black/[0.12] px-4 py-3 sm:px-6 lg:px-7">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/20 p-1">
                {(Object.keys(rangeLabels) as Range[]).map((item) => (
                  <button key={item} type="button" onClick={() => setRange(item)} className={`min-w-14 rounded-lg px-3 py-2 text-[10px] font-bold transition ${range === item ? "bg-cyan-300 text-[#00131c] shadow-[0_7px_20px_rgba(34,211,238,.15)]" : "text-slate-500 hover:text-slate-200"}`}>{item}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterButton icon={CalendarDays} label={rangeLabels[range]} />
                <button type="button" onClick={() => setChannel(channel === "All channels" ? "TCGplayer" : "All channels")} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] font-semibold text-slate-400 transition hover:text-white">
                  <Store className="h-3.5 w-3.5 text-cyan-300" /> {channel}<ChevronDown className="h-3 w-3" />
                </button>
                <FilterButton icon={Layers3} label="All products" />
              </div>
            </div>
          </div>
        </header>

        <section className="grid overflow-hidden rounded-[20px] border border-white/[0.075] bg-[rgba(6,18,27,.72)] sm:grid-cols-3">
          <ReadinessStep complete={hasInventory} number="01" title="Inventory" detail={hasInventory ? `${number.format(inventory.units)} units synced` : "Add or import cards"} href="/dashboard/inventory" />
          <ReadinessStep number="02" title="Sales channels" detail="Connect orders and fees" href="/dashboard/marketplaces" />
          <ReadinessStep number="03" title="Acquisition costs" detail="Unlock true profit and ROI" href={sellerView ? "/dashboard/collection-buying" : "/dashboard/plans"} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {metrics.map((item, index) => <MetricCard key={item.label} {...item} highlight={index === 2 && hasInventory} />)}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.75fr)]">
          <Panel className="min-h-[380px]" title="Revenue & profitability" eyebrow="Performance over time" icon={Activity} action={
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-black/20 p-1">
              {(["Revenue", "Gross profit", "Net profit", "Orders"] as ChartMetric[]).map((item) => (
                <button key={item} type="button" onClick={() => setMetric(item)} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[9px] font-semibold transition ${metric === item ? "bg-white/[0.09] text-white" : "text-slate-600 hover:text-slate-300"}`}>{item}</button>
              ))}
            </div>
          }>
            <div className="relative mt-5 h-[238px] overflow-hidden rounded-2xl border border-white/[0.065] bg-[radial-gradient(circle_at_50%_15%,rgba(34,211,238,.055),transparent_45%),linear-gradient(180deg,rgba(34,211,238,.018),transparent)]">
              <div className="absolute inset-0 grid grid-rows-4">
                {[0, 1, 2, 3].map((line) => <div key={line} className="border-b border-dashed border-white/[0.055]" />)}
              </div>
              <div className="absolute inset-0 flex items-center justify-center px-5">
                <div className="w-full max-w-xl rounded-[20px] border border-white/[0.075] bg-[#06131c]/90 p-4 shadow-[0_18px_45px_rgba(0,0,0,.28)] backdrop-blur-xl sm:p-5">
                  <div className="flex items-start gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-300/[0.14] bg-cyan-300/[0.055]"><TrendingUp className="h-5 w-5 text-cyan-300" /></div><div className="text-left"><p className="text-sm font-semibold text-white">Turn on your {metric.toLowerCase()} timeline</p><p className="mt-1 max-w-md text-[11px] leading-5 text-slate-500">Connect a marketplace to combine orders, fees, shipping, and profit in one reliable view.</p></div></div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3"><div className="flex items-center gap-4 text-[9px] font-medium text-slate-500"><span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-cyan-300" /> No demo data</span><span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-cyan-300" /> Account-specific</span></div><Link href="/dashboard/marketplaces" className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-[9px] font-bold text-[#00131c] transition hover:bg-cyan-200">Connect sales data <ArrowRight className="h-3.5 w-3.5" /></Link></div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[9px] text-slate-600"><span>{rangeLabels[range]}</span><span>Compared with previous period</span></div>
          </Panel>

          <Panel title="Action center" eyebrow="What needs attention" icon={Zap} badge="Live priorities">
            <div className="mt-4 space-y-2.5">
              <ActionItem icon={hasInventory ? Clock3 : PackageOpen} tone="amber" title={hasInventory ? "Inventory needs sales history" : "Add your first inventory"} detail={hasInventory ? `${number.format(inventory.units)} units are ready to begin aging analysis.` : "Import cards to start tracking value and velocity."} href="/dashboard/inventory" action={hasInventory ? "Review inventory" : "Add inventory"} />
              <ActionItem icon={Store} tone="cyan" title="Connect a sales channel" detail="Bring orders and fees into one performance view." href="/dashboard/marketplaces" action="Connect channel" />
              {sellerView ? <ActionItem icon={Target} tone="emerald" title="Build acquisition history" detail="Record purchases to measure collection-level ROI." href="/dashboard/collection-buying" action="Open purchasing" /> : <ActionItem icon={Sparkles} tone="cyan" title="Unlock seller intelligence" detail="Seller adds profit, velocity, channel, and buylist analytics." href="/dashboard/plans" action="View plans" />}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Panel title="Inventory aging" eyebrow="Capital by time held" icon={Clock3}>
            <div className="mt-5 space-y-3">
              {[
                ["0–30 days", inventory.addedLast30Days, "Fresh", "bg-cyan-300"],
                ["31–90 days", 0, "Healthy", "bg-emerald-300"],
                ["91–180 days", 0, "Slowing", "bg-amber-300"],
                ["181–365 days", 0, "At risk", "bg-orange-400"],
                ["365+ days", 0, "Dead stock", "bg-rose-400"],
              ].map(([age, count, status, color]) => (
                <div key={String(age)} className="grid grid-cols-[78px_1fr_auto] items-center gap-3">
                  <span className="text-[10px] font-medium text-slate-400">{age}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.055]"><div className={`h-full rounded-full ${color}`} style={{ width: Number(count) ? "18%" : "0%" }} /></div>
                  <span className="w-16 text-right text-[9px] text-slate-600">{Number(count) ? `${number.format(Number(count))} · ` : ""}{status}</span>
                </div>
              ))}
            </div>
            {!hasInventory ? <MiniEmpty text="Inventory age starts when cards are added." /> : null}
          </Panel>

          <Panel title="Marketplace performance" eyebrow="Channel comparison" icon={Store}>
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.06]">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-600"><span>Channel</span><span>Sales</span><span>Margin</span></div>
              {["TCGplayer", "eBay", "Shopify", "In-store"].map((name) => <div key={name} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/[0.045] px-3 py-3 text-[10px] last:border-0"><span className="font-medium text-slate-300">{name}</span><span className="w-12 text-right text-slate-600">$0</span><span className="w-12 text-right text-slate-600">—</span></div>)}
            </div>
            <Link href="/dashboard/marketplaces" className="mt-4 inline-flex items-center gap-2 text-[10px] font-bold text-cyan-300">Manage connections <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Panel>

          <Panel title="Profitability bridge" eyebrow="Where revenue goes" icon={WalletCards}>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Breakdown label="Gross sales" value="$0" />
              <Breakdown label="Cost of goods" value="$0" />
              <Breakdown label="Marketplace fees" value="$0" />
              <Breakdown label="Shipping" value="$0" />
              <Breakdown label="Refunds" value="$0" />
              <Breakdown label="Net profit" value="$0" accent />
            </div>
            <MiniEmpty text="Profit updates as sales costs and fees are recorded." />
          </Panel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <Panel title="Sales intelligence" eyebrow="Products driving the business" icon={Target} action={<span className="text-[9px] text-slate-600">Sorted by net profit</span>}>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.06]">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[1.7fr_.65fr_.65fr_.65fr_.65fr] gap-3 border-b border-white/[0.06] bg-white/[0.025] px-4 py-3 text-[8px] font-bold uppercase tracking-[0.13em] text-slate-600"><span>Card or product</span><span>Units</span><span>Revenue</span><span>Profit</span><span>Days to sell</span></div>
                <div className="flex min-h-36 flex-col items-center justify-center px-5 py-8 text-center"><PackageOpen className="h-5 w-5 text-slate-700" /><p className="mt-3 text-xs font-semibold text-slate-300">No sales to rank yet</p><p className="mt-1 text-[10px] text-slate-600">Your best sellers, margins, and fastest-moving cards will appear here.</p></div>
              </div>
            </div>
          </Panel>
          <Panel title={sellerView ? "Purchasing & ROI" : "Collection performance"} eyebrow={sellerView ? "Acquisition intelligence" : "Portfolio intelligence"} icon={Percent}>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Breakdown label={sellerView ? "Purchasing spend" : "Acquisition cost"} value="$0" />
              <Breakdown label="Current market value" value={currency.format(inventory.value)} accent={hasInventory} />
              <Breakdown label={sellerView ? "Cost recovered" : "Value change"} value="$0" />
              <Breakdown label="Projected ROI" value="—" />
            </div>
            <MiniEmpty text={sellerView ? "Collection purchases will show recovered cost, held value, and projected profit." : "Add acquisition costs to understand gains, losses, and collection performance."} />
          </Panel>
        </section>
      </div>
    </WorkspaceFrame>
  );
}

function Panel({ title, eyebrow, icon: Icon, action, badge, className = "", children }: { title: string; eyebrow: string; icon: LucideIcon; action?: React.ReactNode; badge?: string; className?: string; children: React.ReactNode }) {
  return <article className={`rounded-[24px] border border-white/[0.075] bg-[linear-gradient(145deg,rgba(7,21,31,.92),rgba(5,16,24,.88))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.16)] backdrop-blur-xl sm:p-5 ${className}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/[0.11] bg-cyan-300/[0.045]"><Icon className="h-4 w-4 text-cyan-300" /></div><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p><h2 className="mt-1 text-sm font-semibold tracking-[-0.02em] text-white">{title}</h2></div></div>{badge ? <span className="rounded-full border border-emerald-300/[0.13] bg-emerald-300/[0.045] px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider text-emerald-300">{badge}</span> : action}</div>{children}</article>;
}

function MetricCard({ label, value, detail, icon: Icon, highlight }: { label: string; value: string; detail: string; icon: LucideIcon; highlight?: boolean }) {
  return <article className={`group relative overflow-hidden rounded-[21px] border p-4 transition hover:-translate-y-0.5 hover:border-white/[0.12] ${highlight ? "border-cyan-300/[0.22] bg-[linear-gradient(145deg,rgba(34,211,238,.075),rgba(6,18,27,.9))] shadow-[0_14px_40px_rgba(34,211,238,.045)]" : "border-white/[0.07] bg-[rgba(6,18,27,.8)]"}`}><div className="flex items-start justify-between gap-3"><span className={`text-[9px] font-bold uppercase tracking-[0.13em] ${highlight ? "text-cyan-200/70" : "text-slate-500"}`}>{label}</span><div className={`grid h-7 w-7 place-items-center rounded-lg ${highlight ? "bg-cyan-300/[0.09]" : "bg-white/[0.025]"}`}><Icon className={`h-3.5 w-3.5 ${highlight ? "text-cyan-300" : "text-slate-600"}`} /></div></div><p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">{value}</p><p className="mt-1 truncate text-[10px] text-slate-500" title={detail}>{detail}</p><div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/0 to-transparent transition group-hover:via-cyan-300/30" /></article>;
}

function ReadinessStep({ complete = false, number: stepNumber, title, detail, href }: { complete?: boolean; number: string; title: string; detail: string; href: string }) {
  return <Link href={href} className="group flex items-center gap-3 border-b border-white/[0.065] px-4 py-3.5 transition hover:bg-white/[0.025] sm:border-b-0 sm:border-r sm:last:border-r-0"><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-[9px] font-bold ${complete ? "border-emerald-300/[0.16] bg-emerald-300/[0.06] text-emerald-300" : "border-white/[0.08] bg-white/[0.025] text-slate-600"}`}>{complete ? <Check className="h-3.5 w-3.5" /> : stepNumber}</div><div className="min-w-0"><p className="text-[10px] font-semibold text-slate-300">{title}</p><p className="mt-0.5 truncate text-[9px] text-slate-600">{detail}</p></div><ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" /></Link>;
}

function FilterButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return <button type="button" className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] font-semibold text-slate-400 transition hover:text-white"><Icon className="h-3.5 w-3.5 text-cyan-300" />{label}<ChevronDown className="h-3 w-3" /></button>;
}

function ActionItem({ icon: Icon, tone, title, detail, href, action }: { icon: LucideIcon; tone: "cyan" | "amber" | "emerald"; title: string; detail: string; href: string; action: string }) {
  const colors = tone === "amber" ? "border-amber-300/[.12] bg-amber-300/[.035] text-amber-300" : tone === "emerald" ? "border-emerald-300/[.12] bg-emerald-300/[.035] text-emerald-300" : "border-cyan-300/[.12] bg-cyan-300/[.035] text-cyan-300";
  return <div className="rounded-2xl border border-white/[0.06] bg-black/[0.12] p-3.5"><div className="flex gap-3"><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${colors}`}><Icon className="h-3.5 w-3.5" /></div><div className="min-w-0"><p className="text-[11px] font-semibold text-slate-200">{title}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{detail}</p><Link href={href} className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-bold text-cyan-300 hover:text-cyan-200">{action}<ArrowRight className="h-3 w-3" /></Link></div></div></div>;
}

function Breakdown({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-3 ${accent ? "border-cyan-300/[0.14] bg-cyan-300/[0.045]" : "border-white/[0.06] bg-black/[0.12]"}`}><p className="text-[8px] font-bold uppercase tracking-[0.11em] text-slate-600">{label}</p><p className={`mt-2 text-base font-semibold ${accent ? "text-cyan-200" : "text-slate-200"}`}>{value}</p></div>;
}

function MiniEmpty({ text }: { text: string }) {
  return <div className="mt-4 flex items-start gap-2 rounded-xl border border-dashed border-white/[0.07] px-3 py-2.5"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-slate-700" /><p className="text-[9px] leading-4 text-slate-600">{text}</p></div>;
}
