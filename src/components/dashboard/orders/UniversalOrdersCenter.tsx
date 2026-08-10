"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle, Box, Check, ChevronDown, CircleDollarSign, Download,
  FileUp, Filter, Link2, MoreHorizontal, PackageCheck, PackageOpen, RefreshCw,
  Search, ShoppingBag, Truck, X, type LucideIcon,
} from "lucide-react";

import { WorkspaceFrame } from "@/components/dashboard/common/WorkspaceFrame";
import {
  channelLabel,
  normalizeOrderStatus,
  summarizeCanonicalOrders,
} from "@/lib/orders/order-metrics";

export type OrderItemRecord = {
  id: string; title: string; quantity: number; unit_price: number | null; image_url?: string | null;
  condition?: string | null; language?: string | null; finish?: string | null; match_status?: string | null;
  external_sku?: string | null; unit_cost?: number | null; realized_profit?: number | null;
};

export type OrderRecord = {
  id: string; marketplace_id: string; external_order_id: string; order_status?: string | null;
  normalized_status?: string | null; payment_status?: string | null; fulfillment_status?: string | null;
  currency?: string | null; subtotal?: number | null; shipping?: number | null; tax?: number | null;
  total?: number | null; buyer_alias?: string | null; ordered_at?: string | null; updated_at?: string | null;
  marketplace_fees?: number | null; shipping_cost?: number | null; cost_of_goods?: number | null;
  refund_amount?: number | null; net_profit?: number | null; tracking_number?: string | null;
  shipping_carrier?: string | null; source_type?: string | null; marketplace_order_items?: OrderItemRecord[];
};

type Status = "all" | "new" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
const statuses: Status[] = ["all", "new", "processing", "shipped", "delivered", "cancelled", "refunded"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function normalized(order: OrderRecord): Exclude<Status, "all"> {
  return normalizeOrderStatus(order);
}

export function UniversalOrdersCenter({
  initialOrders,
  connectedChannels,
}: {
  initialOrders: OrderRecord[];
  connectedChannels: string[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [channel, setChannel] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const channels = useMemo(
    () =>
      Array.from(
        new Set([
          ...orders.map((order) => order.marketplace_id.toLowerCase()),
          ...connectedChannels.map((channel) => channel.toLowerCase()),
        ]),
      ).sort((a, b) => channelName(a).localeCompare(channelName(b))),
    [orders, connectedChannels],
  );
  const filtered = useMemo(() => orders.filter((order) => {
    const needle = query.trim().toLowerCase();
    const text = [order.external_order_id, order.buyer_alias, order.marketplace_id, ...(order.marketplace_order_items ?? []).map((item) => `${item.title} ${item.external_sku ?? ""}`)].join(" ").toLowerCase();
    return (!needle || text.includes(needle)) && (status === "all" || normalized(order) === status) && (channel === "all" || order.marketplace_id.toLowerCase() === channel);
  }), [orders, query, status, channel]);

  const summary = useMemo(() => {
    const metrics = summarizeCanonicalOrders(orders, connectedChannels);
    return {
      revenue: metrics.grossSales,
      profit: metrics.realizedProfit ?? 0,
      units: metrics.unitsSold,
      attention: metrics.listingIssues,
    };
  }, [orders, connectedChannels]);

  function exportCsv() {
    const rows = [["Order", "Channel", "Date", "Status", "Buyer", "Items", "Total", "Fees", "Shipping cost", "COGS", "Profit", "Tracking"]];
    for (const order of filtered) rows.push([
      order.external_order_id, order.marketplace_id, order.ordered_at ?? "", normalized(order), order.buyer_alias ?? "",
      String((order.marketplace_order_items ?? []).reduce((n, item) => n + item.quantity, 0)), String(order.total ?? 0), String(order.marketplace_fees ?? 0),
      String(order.shipping_cost ?? 0), String(order.cost_of_goods ?? 0), String(order.net_profit ?? 0), order.tracking_number ?? "",
    ]);
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "trading-docks-orders.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  async function updateStatus(next: Exclude<Status, "all">) {
    if (!selected.length) return;
    setBusy(true); setNotice(null);
    const response = await fetch("/api/orders/bulk", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: selected, status: next }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setOrders((current) => current.map((order) => selected.includes(order.id) ? { ...order, normalized_status: next } : order));
      setNotice(`${selected.length} order${selected.length === 1 ? "" : "s"} moved to ${next}.`); setSelected([]);
    } else setNotice(result.error ?? "The orders could not be updated.");
    setBusy(false);
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((order) => selected.includes(order.id));

  return <WorkspaceFrame><div className="space-y-4 sm:space-y-5">
    <header className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(7,26,38,.98),rgba(4,15,23,.97))] px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,.24)] sm:px-7 sm:py-6">
      <div className="pointer-events-none absolute right-[-4rem] top-[-8rem] h-72 w-72 rounded-full bg-cyan-300/[0.07] blur-3xl" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div><div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.15] bg-cyan-300/[0.05] px-3 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-cyan-200"><ShoppingBag className="h-3.5 w-3.5" /> Universal orders center</div><h1 className="mt-3 text-3xl font-semibold tracking-[-.05em] text-white sm:text-[2.2rem]">Every sale. One workflow.</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">Fulfill orders, reconcile inventory, and see true profit across every connected sales channel.</p></div>
        <div className="flex flex-wrap gap-2"><Link href="/dashboard/marketplaces" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.07]"><Link2 className="h-4 w-4 text-cyan-300" /> Manage channels</Link><button onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-[#00131c] hover:bg-cyan-200"><Download className="h-4 w-4" /> Export CSV</button></div>
      </div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={CircleDollarSign} label="Gross sales" value={compactMoney.format(summary.revenue)} detail={`${orders.length} imported orders`} accent />
      <Kpi icon={PackageCheck} label="Realized profit" value={compactMoney.format(summary.profit)} detail="After fees, shipping, and COGS" />
      <Kpi icon={Box} label="Units sold" value={String(summary.units)} detail="Across all connected channels" />
      <Kpi icon={AlertTriangle} label="Needs attention" value={String(summary.attention)} detail="Orders with unmatched items" warning={summary.attention > 0} />
    </section>

    <section className="overflow-hidden rounded-[23px] border border-white/[0.075] bg-[rgba(6,18,27,.86)] shadow-[0_18px_55px_rgba(0,0,0,.17)]">
      <div className="border-b border-white/[0.065] p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order, buyer, card, or SKU..." className="h-11 w-full rounded-xl border border-white/[0.075] bg-black/20 pl-10 pr-4 text-xs text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/30" /></div>
          <div className="flex gap-2 overflow-x-auto">
            <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.075] bg-black/20 px-3 text-[13px] font-semibold text-slate-400"><Filter className="h-3.5 w-3.5 text-cyan-300" /><select value={channel} onChange={(e) => setChannel(e.target.value)} className="bg-transparent outline-none"><option value="all">All channels</option>{channels.map((item) => <option key={item} value={item}>{channelName(item)}</option>)}</select><ChevronDown className="h-3 w-3" /></label>
            <button onClick={() => { setQuery(""); setStatus("all"); setChannel("all"); }} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.075] px-3 text-[13px] font-semibold text-slate-500 hover:text-white"><RefreshCw className="h-3.5 w-3.5" /> Reset</button>
          </div>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/15 p-1">{statuses.map((item) => { const count = item === "all" ? orders.length : orders.filter((order) => normalized(order) === item).length; return <button key={item} onClick={() => setStatus(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-bold capitalize transition ${status === item ? "bg-cyan-300 text-[#00131c]" : "text-slate-500 hover:bg-white/[0.035] hover:text-slate-200"}`}>{item} <span className="ml-1 opacity-60">{count}</span></button>; })}</div>
      </div>

      {selected.length ? <div className="flex flex-wrap items-center gap-2 border-b border-cyan-300/[0.12] bg-cyan-300/[0.035] px-4 py-3"><span className="mr-2 text-[13px] font-bold text-cyan-200">{selected.length} selected</span>{(["processing", "shipped", "delivered", "cancelled", "refunded"] as const).map((item) => <button disabled={busy} onClick={() => updateStatus(item)} key={item} className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs font-semibold capitalize text-slate-300 hover:text-white disabled:opacity-40">Mark {item}</button>)}<button onClick={() => setSelected([])} className="ml-auto p-1.5 text-slate-500 hover:text-white"><X className="h-4 w-4" /></button></div> : null}
      {notice ? <div className="border-b border-white/[0.06] px-4 py-2.5 text-[13px] text-cyan-200">{notice}</div> : null}

      {filtered.length ? <div className="overflow-x-auto"><div className="min-w-[1050px]">
        <div className="grid grid-cols-[38px_1.25fr_.72fr_.8fr_.75fr_.72fr_.72fr_42px] items-center gap-4 border-b border-white/[0.06] bg-white/[0.018] px-5 py-3.5 text-xs font-bold uppercase tracking-[.14em] text-slate-600"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? selected.filter((id) => !filtered.some((order) => order.id === id)) : [...new Set([...selected, ...filtered.map((order) => order.id)])])} className="accent-cyan-300" /><span>Order</span><span>Channel</span><span>Status</span><span>Items</span><span>Total</span><span>Profit</span><span /></div>
        {filtered.map((order) => <OrderRow key={order.id} order={order} checked={selected.includes(order.id)} expanded={expanded === order.id} onCheck={() => setSelected((current) => current.includes(order.id) ? current.filter((id) => id !== order.id) : [...current, order.id])} onExpand={() => setExpanded(expanded === order.id ? null : order.id)} />)}
      </div></div> : <EmptyState hasOrders={orders.length > 0} />}
      <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-xs text-slate-500"><span>Showing {filtered.length} of {orders.length} orders</span><span>Up to 500 most recent orders</span></div>
    </section>
  </div></WorkspaceFrame>;
}

/* Marketplace images can come from several allowlisted channel CDNs and are deliberately lazy-loaded. */
/* eslint-disable @next/next/no-img-element */
function OrderRow({ order, checked, expanded, onCheck, onExpand }: { order: OrderRecord; checked: boolean; expanded: boolean; onCheck: () => void; onExpand: () => void }) {
  const items = order.marketplace_order_items ?? []; const state = normalized(order); const units = items.reduce((n, item) => n + Number(item.quantity || 0), 0); const unmatched = items.filter((item) => !item.match_status || item.match_status === "unmatched").length;
  return <div className="border-b border-white/[0.052] last:border-0"><div className="grid grid-cols-[38px_1.25fr_.72fr_.8fr_.75fr_.72fr_.72fr_42px] items-center gap-4 px-5 py-4 transition hover:bg-white/[0.022]"><input type="checkbox" checked={checked} onChange={onCheck} className="accent-cyan-300" /><button onClick={onExpand} className="min-w-0 text-left"><div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-white">#{order.external_order_id}</span>{unmatched ? <span title={`${unmatched} unmatched line items`} className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-300/[0.08]"><AlertTriangle className="h-3 w-3 text-amber-300" /></span> : null}</div><p className="mt-1 truncate text-xs text-slate-500">{order.buyer_alias || "Marketplace customer"} · {formatDate(order.ordered_at)}</p></button><ChannelBadge name={order.marketplace_id} /><StatusBadge status={state} /><div><p className="text-[13px] font-semibold text-slate-300">{units} unit{units === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-slate-500">{items.length} line item{items.length === 1 ? "" : "s"}</p></div><div><p className="text-sm font-semibold text-white">{money.format(Number(order.total ?? 0))}</p><p className="mt-1 text-xs text-slate-500">incl. shipping</p></div><div><p className={`text-sm font-semibold ${Number(order.net_profit ?? 0) > 0 ? "text-emerald-300" : "text-slate-400"}`}>{money.format(Number(order.net_profit ?? 0))}</p><p className="mt-1 text-xs text-slate-500">after costs</p></div><button onClick={onExpand} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-white/[0.05] hover:text-white"><MoreHorizontal className="h-4 w-4" /></button></div>
    {expanded ? <div className="border-t border-white/[0.05] bg-black/[0.12] px-5 py-4"><div className="grid gap-4 lg:grid-cols-[1fr_320px]"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-slate-600">Line items</p>{items.length ? <div className="space-y-2">{items.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/[0.055] bg-white/[0.02] p-2.5"><div className="grid h-12 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/[0.04]">{item.image_url ? <img src={item.image_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <PackageOpen className="h-4 w-4 text-slate-700" />}</div><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-slate-200">{item.quantity}× {item.title}</p><p className="mt-1 truncate text-xs text-slate-500">{[item.condition, item.language, item.finish, item.external_sku].filter(Boolean).join(" · ") || "Details unavailable"}</p></div><div className="text-right"><p className="text-[13px] font-semibold text-white">{money.format(Number(item.unit_price ?? 0) * item.quantity)}</p><p className={`mt-1 text-xs font-bold uppercase ${item.match_status === "matched" ? "text-emerald-300" : "text-amber-300"}`}>{item.match_status ?? "unmatched"}</p></div></div>)}</div> : <p className="text-[13px] text-slate-500">No line items were supplied by this channel.</p>}</div><div className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4"><p className="text-xs font-bold uppercase tracking-[.14em] text-slate-600">Profit breakdown</p><Breakdown label="Order total" value={order.total} /><Breakdown label="Marketplace fees" value={order.marketplace_fees} negative /><Breakdown label="Shipping cost" value={order.shipping_cost} negative /><Breakdown label="Cost of goods" value={order.cost_of_goods} negative /><Breakdown label="Refunds" value={order.refund_amount} negative /><div className="mt-3 border-t border-white/[0.07] pt-3"><Breakdown label="Realized profit" value={order.net_profit} strong /></div>{order.tracking_number ? <div className="mt-4 rounded-xl bg-cyan-300/[0.045] p-3"><p className="text-xs font-bold uppercase text-cyan-300">{order.shipping_carrier || "Tracking"}</p><p className="mt-1 truncate text-[10px] text-slate-300">{order.tracking_number}</p></div> : null}</div></div></div> : null}
  </div>;
}

function Kpi({ icon: Icon, label, value, detail, accent, warning }: { icon: LucideIcon; label: string; value: string; detail: string; accent?: boolean; warning?: boolean }) { return <article className={`rounded-[21px] border p-4 ${accent ? "border-cyan-300/[0.2] bg-[linear-gradient(145deg,rgba(34,211,238,.07),rgba(6,18,27,.88))]" : warning ? "border-amber-300/[0.17] bg-amber-300/[0.025]" : "border-white/[0.07] bg-[rgba(6,18,27,.82)]"}`}><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500">{label}</p><Icon className={`h-4 w-4 ${warning ? "text-amber-300" : "text-cyan-300"}`} /></div><p className="mt-4 text-2xl font-semibold tracking-[-.04em] text-white">{value}</p><p className="mt-1 text-[13px] text-slate-500">{detail}</p></article>; }
function ChannelBadge({ name }: { name: string }) { return <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/[0.065] bg-white/[0.025] px-2.5 py-1.5 text-xs font-semibold text-slate-300"><ShoppingBag className="h-3 w-3 text-cyan-300" />{channelName(name)}</span>; }
function StatusBadge({ status }: { status: Exclude<Status, "all"> }) { const styles: Record<string,string> = { new:"border-cyan-300/15 bg-cyan-300/[.055] text-cyan-200", processing:"border-violet-300/15 bg-violet-300/[.05] text-violet-200", shipped:"border-blue-300/15 bg-blue-300/[.05] text-blue-200", delivered:"border-emerald-300/15 bg-emerald-300/[.05] text-emerald-200", cancelled:"border-slate-300/10 bg-slate-300/[.04] text-slate-400", refunded:"border-rose-300/15 bg-rose-300/[.05] text-rose-200" }; const icons: Record<string,LucideIcon> = { new:PackageOpen, processing:RefreshCw, shipped:Truck, delivered:Check, cancelled:X, refunded:RefreshCw }; const Icon=icons[status]; return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide ${styles[status]}`}><Icon className="h-3 w-3" />{status}</span>; }
function Breakdown({ label, value, negative, strong }: { label: string; value?: number | null; negative?: boolean; strong?: boolean }) { const amount = Number(value ?? 0); return <div className={`flex items-center justify-between gap-3 ${strong ? "text-sm font-semibold" : "mt-2.5 text-[9px]"}`}><span className={strong ? "text-white" : "text-slate-500"}>{label}</span><span className={strong && amount > 0 ? "text-emerald-300" : "text-slate-300"}>{negative && amount ? "−" : ""}{money.format(amount)}</span></div>; }
function EmptyState({ hasOrders }: { hasOrders: boolean }) { return <div className="flex min-h-[340px] flex-col items-center justify-center px-5 py-12 text-center"><div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/[0.12] bg-cyan-300/[0.045]"><ShoppingBag className="h-6 w-6 text-cyan-300" /></div><h2 className="mt-4 text-base font-semibold text-white">{hasOrders ? "No orders match this view" : "Your order operations start here"}</h2><p className="mt-2 max-w-md text-[11px] leading-5 text-slate-500">{hasOrders ? "Clear a filter or search for another order." : "Connect a marketplace or import a CSV. Orders will appear with fulfillment, item matching, costs, and realized profit in one workspace."}</p>{!hasOrders ? <div className="mt-5 flex flex-wrap justify-center gap-2"><Link href="/dashboard/marketplaces" className="inline-flex h-9 items-center gap-2 rounded-xl bg-cyan-300 px-3.5 text-[13px] font-bold text-[#00131c]"><Link2 className="h-3.5 w-3.5" /> Connect marketplace</Link><Link href="/dashboard/marketplaces" className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] px-3.5 text-[13px] font-semibold text-slate-300"><FileUp className="h-3.5 w-3.5" /> Import CSV</Link></div> : null}<div className="mt-7 flex flex-wrap justify-center gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-300" /> No demo orders</span><span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-300" /> Duplicate-safe</span><span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-300" /> Account-specific</span></div></div>; }
function channelName(value: string) {
  return channelLabel(value);
}
function formatDate(value?: string | null) { if(!value) return "Date unavailable"; const date=new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(date); }
