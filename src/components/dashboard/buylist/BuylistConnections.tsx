"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, BadgeDollarSign, CheckCircle2, Clock3, DatabaseZap, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BuylistOffer, InventoryBuylistItem, marketUnitValue, offerMatchesItem } from "@/lib/buylist";

type Connection = { enabled: boolean; last_sync_at: string | null; last_success_at: string | null; last_error: string | null; last_offer_count: number };
type Opportunity = { item: InventoryBuylistItem; best: BuylistOffer; market: number };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function BuylistConnections() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<InventoryBuylistItem[]>([]);
  const [offers, setOffers] = useState<BuylistOffer[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setMessage("Sign in again to manage data connections."); setLoading(false); return; }
    const [connectionResult, inventoryResult, offersResult] = await Promise.all([
      supabase.from("buylist_feed_connections").select("enabled,last_sync_at,last_success_at,last_error,last_offer_count").eq("user_id", auth.user.id).eq("provider", "mtgjson_cardkingdom").maybeSingle(),
      supabase.from("inventory_items").select("data").eq("user_id", auth.user.id),
      supabase.from("buylist_offers").select("id,store_name,scryfall_id,card_name,set_code,collector_number,finish,language,condition,cash_price,credit_price,quantity_wanted,source_url,verified_at,provider,source_kind,indicative,expires_at").eq("user_id", auth.user.id),
    ]);
    const { data, error } = connectionResult;
    if (error) setMessage(error.message.includes("buylist_feed_connections") ? "Run the included automatic-feed migration before connecting MTGJSON." : error.message);
    setConnection(data as Connection | null); setLoading(false);
    setItems(((inventoryResult.data ?? []) as { data: unknown }[]).map((row) => row.data).filter((item): item is InventoryBuylistItem => Boolean(item && typeof item === "object" && "id" in item && "name" in item)));
    setOffers(((offersResult.data ?? []) as BuylistOffer[]).map((offer) => ({ ...offer, cash_price: Number(offer.cash_price), credit_price: offer.credit_price == null ? null : Number(offer.credit_price) })));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const opportunities = useMemo(() => items.map((item) => {
    const matching = offers.filter((offer) => offerMatchesItem(offer, item) && offer.quantity_wanted > 0 && (!offer.expires_at || new Date(offer.expires_at).getTime() > Date.now())).sort((a, b) => b.cash_price - a.cash_price);
    return matching.length ? { item, best: matching[0], market: marketUnitValue(item) } : null;
  }).filter((item): item is Opportunity => Boolean(item)).sort((a, b) => (b.best.cash_price * Math.min(b.item.quantity, b.best.quantity_wanted)) - (a.best.cash_price * Math.min(a.item.quantity, a.best.quantity_wanted))), [items, offers]);
  const matchedCash = opportunities.reduce((sum, match) => sum + match.best.cash_price * Math.min(match.item.quantity, match.best.quantity_wanted), 0);

  async function syncNow() {
    setSyncing(true); setMessage("");
    try {
      const response = await fetch("/api/buylist/mtgjson", { method: "POST" });
      const payload = await response.json() as { error?: string; result?: { offers?: number } };
      if (!response.ok) throw new Error(payload.error || "Sync failed.");
      setMessage(`Sync complete. ${payload.result?.offers ?? 0} matching inventory offers updated.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sync failed."); }
    finally { setSyncing(false); }
  }

  async function toggle(enabled: boolean) {
    const supabase = createClient(); const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase.from("buylist_feed_connections").upsert({
      user_id: auth.user.id, provider: "mtgjson_cardkingdom", display_name: "MTGJSON · Card Kingdom", enabled, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });
    if (error) setMessage(error.message); else await load();
  }

  return <main className="min-h-screen bg-td-canvas px-4 py-6 text-td-primary sm:px-7 lg:px-9"><div className="mx-auto max-w-5xl">
    <Link href="/dashboard/buylist-intelligence" className="inline-flex items-center gap-2 text-xs font-semibold text-td-secondary hover:text-td-primary"><ArrowLeft className="h-4 w-4"/> Buylist Intelligence</Link>
    <header className="mt-5 border-b border-td-ink/[0.07] pb-6"><div className="flex items-center gap-2 text-xs font-semibold text-td-accent-text"><DatabaseZap className="h-4 w-4"/> Buylist automation</div><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Data Connections</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-td-secondary">Keep buylist opportunities refreshed automatically. Trading Docks only stores offers that match cards already in your inventory.</p></header>
    {message ? <div className="mt-5 rounded-2xl border border-td-accent/15 bg-td-accent/[0.05] p-4 text-sm text-td-accent-text">{message}</div> : null}
    <section className="mt-5 overflow-hidden rounded-[24px] border border-td-ink/[0.08] bg-td-surface">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div className="flex gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-td-accent/[0.09] text-td-accent-text"><DatabaseZap className="h-5 w-5"/></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">MTGJSON · Card Kingdom</h2><span className="rounded-md bg-td-warning/10 px-2 py-1 text-[11px] font-bold text-td-warning">INDICATIVE DATA</span></div><p className="mt-2 max-w-xl text-sm leading-6 text-td-secondary">Daily Card Kingdom buylist prices normalized by MTGJSON. Exact printing and finish are matched; live quantity and final condition acceptance must be confirmed with Card Kingdom.</p></div></div>
        <label className="flex cursor-pointer items-center gap-3 text-xs font-semibold text-td-secondary"><input type="checkbox" checked={connection?.enabled ?? false} disabled={loading} onChange={(e) => void toggle(e.target.checked)} className="h-4 w-4 accent-td-accent"/> Automatic daily sync</label></div>
      <div className="grid gap-px border-t border-td-ink/[0.07] bg-td-ink/[0.06] sm:grid-cols-3"><Status label="Connection" value={loading ? "Loading…" : connection?.enabled ? "Active" : "Not connected"} good={Boolean(connection?.enabled)} /><Status label="Last successful sync" value={connection?.last_success_at ? new Date(connection.last_success_at).toLocaleString() : "Never"} /><Status label="Matching offers" value={String(connection?.last_offer_count ?? 0)} /></div>
      {connection?.last_error ? <div className="flex gap-3 border-t border-td-warning/15 bg-td-warning/[0.05] p-4 text-sm text-td-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{connection.last_error}</div> : null}
      <div className="flex flex-col gap-3 border-t border-td-ink/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-xs text-td-muted"><Clock3 className="h-4 w-4"/> Scheduled once daily; prices older than 24 hours are flagged stale.</p><button onClick={() => void syncNow()} disabled={syncing} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-td-accent px-4 text-xs font-bold text-td-on-accent disabled:cursor-wait disabled:opacity-60">{syncing ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}{syncing ? "Syncing inventory…" : "Sync now"}</button></div>
    </section>
    <section className="mt-5 overflow-hidden rounded-[24px] border border-td-ink/[0.08] bg-td-surface">
      <div className="flex flex-col gap-4 border-b border-td-ink/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-td-success/[0.08] text-td-success"><BadgeDollarSign className="h-5 w-5"/></span><div><h2 className="font-semibold">Matched inventory opportunities</h2><p className="mt-1 text-sm text-td-secondary">Cards you own that matched the latest imported buylist data.</p></div></div>
        <div className="sm:text-right"><p className="text-2xl font-semibold text-td-primary">{money.format(matchedCash)}</p><p className="text-[11px] text-td-muted">Best available cash · before shipping</p></div>
      </div>
      {loading ? <div className="p-8 text-center text-sm text-td-muted">Matching exact inventory printings…</div> : opportunities.length ? <div className="divide-y divide-td-ink/[0.055]">{opportunities.slice(0, 5).map(({ item, best, market }) => <Link key={item.id} href={`/dashboard/sell-optimizer?card=${encodeURIComponent(item.name)}`} className="grid gap-3 p-4 transition hover:bg-td-ink/[0.025] sm:grid-cols-[minmax(220px,1fr)_100px_100px_130px_24px] sm:items-center sm:px-6"><div><p className="font-semibold text-td-primary">{item.name}</p><p className="mt-1 text-xs text-td-muted">{item.set || "Unknown set"} #{item.collectorNumber || "—"} · {item.condition || "Unrecorded condition"} · {item.finish || "Unrecorded finish"} · Qty {item.quantity}</p></div><OfferCell label="Market" value={money.format(market)}/><OfferCell label="Buylist" value={money.format(best.cash_price)} accent/><div><p className="text-sm font-semibold text-td-primary">{best.store_name}</p><p className="mt-1 text-[11px] text-td-warning">{best.indicative ? "Indicative · verify demand" : `Authorized · wants ${best.quantity_wanted}`}</p></div><ArrowRight className="h-4 w-4 text-td-muted"/></Link>)}</div> : <div className="p-8 text-center"><p className="font-semibold text-td-primary">No exact card matches yet</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-td-muted">The feed is connected, but none of its exact printing and finish records currently match your inventory. Run another sync after adding cards.</p></div>}
      <div className="flex justify-end border-t border-td-ink/[0.07] p-4"><Link href="/dashboard/sell-optimizer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-ink/[0.09] bg-td-ink/[0.03] px-4 text-xs font-semibold text-td-primary hover:border-td-accent/25 hover:text-td-accent-text">View all matched cards <ArrowRight className="h-4 w-4"/></Link></div>
    </section>
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-td-success/10 bg-td-success/[0.035] p-4"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-td-success"/><p className="text-xs leading-5 text-td-secondary"><span className="font-semibold text-td-primary">Transparent by design.</span> Authorized store feeds are labeled Authorized. Aggregated MTGJSON prices are labeled Indicative and never presented as confirmed live demand.</p></div>
  </div></main>;
}
function Status({ label, value, good = false }: { label: string; value: string; good?: boolean }) { return <div className="bg-td-surface p-4"><p className="text-[11px] font-semibold text-td-muted">{label}</p><p className={`mt-2 flex items-center gap-2 text-sm font-semibold ${good ? "text-td-success" : "text-td-primary"}`}>{good ? <CheckCircle2 className="h-4 w-4"/> : null}{value}</p></div>; }
function OfferCell({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div><p className="text-[11px] font-semibold uppercase tracking-wide text-td-muted">{label}</p><p className={`mt-1 text-sm font-semibold ${accent ? "text-td-accent-text" : "text-td-secondary"}`}>{value}</p></div>; }
