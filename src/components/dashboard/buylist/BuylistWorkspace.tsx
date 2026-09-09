"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, BadgeDollarSign, CheckCircle2, Clock3, DatabaseZap, FileUp, Filter, Search, ShieldCheck, Sparkles, Store, TrendingUp, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BuylistOffer, freshness, InventoryBuylistItem, marketUnitValue, offerMatchesItem } from "@/lib/buylist";

type Mode = "inventory" | "market";
type Match = { item: InventoryBuylistItem; offers: BuylistOffer[]; best: BuylistOffer; market: number; ratio: number };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function BuylistWorkspace({ mode, initialQuery = "" }: { mode: Mode; initialQuery?: string }) {
  const [items, setItems] = useState<InventoryBuylistItem[]>([]);
  const [offers, setOffers] = useState<BuylistOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(initialQuery);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Match | null>(null);
  const [onlyStrong, setOnlyStrong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true); setError("");
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Sign in again to load buylist intelligence."); setLoading(false); return; }
    const [inventoryResult, offerResult] = await Promise.all([
      supabase.from("inventory_items").select("data").eq("user_id", auth.user.id),
      supabase.from("buylist_offers").select("id,store_name,scryfall_id,card_name,set_code,collector_number,finish,language,condition,cash_price,credit_price,quantity_wanted,source_url,verified_at,provider,source_kind,indicative,expires_at").eq("user_id", auth.user.id),
    ]);
    if (inventoryResult.error) setError(inventoryResult.error.message);
    if (offerResult.error) setError(offerResult.error.message.includes("buylist_offers") ? "Run the included buylist migration before importing offers." : offerResult.error.message);
    setItems(((inventoryResult.data ?? []) as { data: unknown }[]).map((row) => row.data).filter((item): item is InventoryBuylistItem => Boolean(item && typeof item === "object" && "id" in item && "name" in item)));
    setOffers(((offerResult.data ?? []) as BuylistOffer[]).map((offer) => ({ ...offer, cash_price: Number(offer.cash_price), credit_price: offer.credit_price == null ? null : Number(offer.credit_price) })));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const matches = useMemo(() => items.map((item) => {
    const matching = offers.filter((offer) => offerMatchesItem(offer, item) && offer.quantity_wanted > 0 && (!offer.expires_at || new Date(offer.expires_at).getTime() > Date.now())).sort((a, b) => b.cash_price - a.cash_price);
    const market = marketUnitValue(item);
    return matching.length ? { item, offers: matching, best: matching[0], market, ratio: market ? matching[0].cash_price / market : 0 } : null;
  }).filter((match): match is Match => Boolean(match)), [items, offers]);

  const visible = matches.filter((match) => (!query || match.item.name.toLowerCase().includes(query.toLowerCase()) || match.best.store_name.toLowerCase().includes(query.toLowerCase())) && (!onlyStrong || match.ratio >= .7));
  const totalCash = matches.reduce((sum, match) => sum + match.best.cash_price * Math.min(match.item.quantity, match.best.quantity_wanted), 0);
  const stores = new Set(offers.map((offer) => offer.store_name)).size;

  async function importCsv(file: File) {
    setError("");
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) { setError("This CSV does not contain any offer rows."); return; }
    const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase().replaceAll(" ", "_"));
    const required = ["store_name", "card_name", "cash_price"];
    if (required.some((header) => !headers.includes(header))) { setError("CSV requires store_name, card_name, and cash_price columns."); return; }
    const supabase = createClient(); const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Sign in again before importing offers."); return; }
    const rows = lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? ""]))).filter((row) => row.store_name && row.card_name && Number(row.cash_price) >= 0).map((row) => ({
      user_id: auth.user!.id, store_name: row.store_name, card_name: row.card_name, scryfall_id: row.scryfall_id || null,
      set_code: row.set_code || "", collector_number: row.collector_number || "", finish: row.finish || "nonfoil",
      language: row.language || "English", condition: row.condition || "NM", cash_price: Number(row.cash_price),
      credit_price: row.credit_price ? Number(row.credit_price) : null, quantity_wanted: Math.max(0, Number(row.quantity_wanted || 1)),
      source_url: row.source_url || null, verified_at: row.verified_at || new Date().toISOString(), updated_at: new Date().toISOString(),
      provider: "manual", source_kind: "authorized", indicative: false,
    }));
    if (!rows.length) { setError("No valid offer rows were found."); return; }
    const { error: importError } = await supabase.from("buylist_offers").upsert(rows, { onConflict: "user_id,provider,store_name,card_name,set_code,collector_number,finish,language,condition" });
    if (importError) { setError(importError.message); return; }
    await load();
  }

  return <main className="min-h-screen bg-td-canvas px-4 py-6 text-td-primary sm:px-7 lg:px-9">
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-col gap-5 border-b border-td-ink/[0.07] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div><div className="flex items-center gap-2 text-[11px] font-semibold text-td-accent-text"><BadgeDollarSign className="h-4 w-4" /> {mode === "inventory" ? "Selling intelligence" : "Purchasing intelligence"}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{mode === "inventory" ? "Inventory Buylist Optimizer" : "Buylist Market Intelligence"}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-td-secondary">{mode === "inventory" ? "See verified cash offers only for exact cards you own—printing, finish, language, and condition included." : "Use verified store demand to find acquisition candidates, then validate margin before buying."}</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href="/dashboard/buylist-connections" className="inline-flex h-11 items-center gap-2 rounded-xl bg-td-accent px-4 text-xs font-bold text-td-on-accent transition hover:bg-td-accent-hover"><DatabaseZap className="h-4 w-4" /> Data connections</Link><button onClick={() => inputRef.current?.click()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-td-ink/[0.1] bg-td-ink/[0.035] px-4 text-xs font-semibold text-td-primary hover:border-td-accent/25"><FileUp className="h-4 w-4" /> Import CSV</button><input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); event.target.value = ""; }} /></div>
      </header>

      {error ? <div className="mt-4 flex items-start gap-3 rounded-2xl border border-td-warning/20 bg-td-warning/[0.06] p-4 text-sm text-td-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div> : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Matched inventory" value={String(matches.length)} detail={`${items.length} inventory rows checked`} /><Kpi label="Verified stores" value={String(stores)} detail={`${offers.length} exact-printing offers`} /><Kpi label="Best available cash" value={money.format(totalCash)} detail="Before shipment costs" /><Kpi label="Strong opportunities" value={String(matches.filter((m) => m.ratio >= .7).length)} detail="At least 70% of market" /></section>

      {mode === "market" ? <section className="mt-5 rounded-[24px] border border-td-violet/[0.14] bg-gradient-to-br from-td-violet/[0.07] to-transparent p-5"><div className="flex items-start gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-td-violet/[0.1] text-td-violet"><Sparkles className="h-5 w-5" /></span><div><h2 className="font-semibold">Demand is evidence—not a purchase instruction</h2><p className="mt-1 text-sm leading-6 text-td-secondary">Candidates require acquisition cost, desired margin, quantity wanted, offer freshness, and multi-store confirmation. Trading Docks will never recommend a purchase from one high offer alone.</p></div></div></section> : null}

      <section className="mt-5 overflow-hidden rounded-[24px] border border-td-ink/[0.07] bg-td-surface">
        <div className="flex flex-col gap-3 border-b border-td-ink/[0.07] p-4 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-td-muted"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search owned cards or stores" className="h-10 w-full rounded-xl border border-td-ink/[0.08] bg-black/20 pl-10 pr-3 text-sm outline-none focus:border-td-accent/30"/></div><button onClick={() => setOnlyStrong((value) => !value)} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs ${onlyStrong ? "border-td-accent/25 bg-td-accent/[0.08] text-td-accent-text" : "border-td-ink/[0.08] text-td-secondary"}`}><Filter className="h-4 w-4"/> Strong opportunities</button></div>
        {loading ? <Empty title="Matching your inventory…" body="Checking exact printings against verified offers." /> : !offers.length ? <Empty title="Connect your first buylist feed" body="Import an authorized store CSV to begin. No sample prices or unverified offers will be displayed." action="CSV columns: store_name, card_name, cash_price, set_code, collector_number, finish, language, condition" /> : !visible.length ? <Empty title="No exact inventory matches yet" body="Offers only appear when printing, finish, language, and condition match inventory you own." /> : <div className="divide-y divide-td-ink/[0.055]">{visible.map((match) => <button key={match.item.id} onClick={() => setSelected(match)} className="grid w-full gap-3 p-4 text-left transition hover:bg-td-ink/[0.025] sm:grid-cols-[minmax(220px,1fr)_110px_110px_120px_120px_24px] sm:items-center"><div><p className="font-semibold text-td-primary">{match.item.name}</p><p className="mt-1 text-xs text-td-muted">{match.item.set || "Unknown set"} #{match.item.collectorNumber || "—"} · {match.item.condition || "NM"} · {match.item.finish || "nonfoil"} · Qty {match.item.quantity}</p></div><Cell label="Market" value={money.format(match.market)} /><Cell label="Best cash" value={money.format(match.best.cash_price)} accent /><Cell label="Ratio" value={match.market ? `${(match.ratio * 100).toFixed(0)}%` : "—"} /><div><p className="text-sm font-semibold text-td-primary">{match.best.store_name}</p><p className={`mt-1 text-[11px] ${freshness(match.best.verified_at).stale ? "text-td-warning" : "text-td-success"}`}>{freshness(match.best.verified_at).label}</p></div><ArrowRight className="h-4 w-4 text-td-muted"/></button>)}</div>}
      </section>
      <div className="mt-4 flex items-center gap-2 text-xs text-td-muted"><ShieldCheck className="h-4 w-4 text-td-success"/> Offers are decision support. Confirm price, condition, and quantity on the store’s submission page before shipping.</div>
    </div>
    {selected ? <ComparisonDrawer match={selected} onClose={() => setSelected(null)} /> : null}
  </main>;
}

function ComparisonDrawer({ match, onClose }: { match: Match; onClose: () => void }) { return <div className="fixed inset-0 z-[80] flex justify-end bg-black/70 backdrop-blur-sm" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}><aside className="h-full w-full max-w-xl overflow-y-auto border-l border-td-ink/[0.09] bg-td-surface p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-td-accent-text">Exact-printing comparison</p><h2 className="mt-2 text-2xl font-semibold">{match.item.name}</h2><p className="mt-1 text-sm text-td-muted">{match.item.set} #{match.item.collectorNumber} · {match.item.condition || "NM"} · {match.item.finish || "nonfoil"}</p></div><button onClick={onClose} className="rounded-xl border border-td-ink/[0.08] p-2 text-td-secondary"><X className="h-4 w-4"/></button></div><div className="mt-6 rounded-2xl border border-td-accent/[0.14] bg-td-accent/[0.05] p-4"><p className="text-xs text-td-secondary">Best current cash price</p><div className="mt-2 flex items-end justify-between"><p className="text-3xl font-semibold text-td-accent-text">{money.format(match.best.cash_price)}</p><p className="text-sm font-semibold">{match.best.store_name}</p></div></div><div className="mt-5 space-y-2">{match.offers.map((offer, index) => { const fresh = freshness(offer.verified_at); return <div key={offer.id} className="rounded-2xl border border-td-ink/[0.07] bg-td-ink/[0.025] p-4"><div className="flex items-start justify-between"><div className="flex gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-td-ink/[0.04] text-td-secondary"><Store className="h-4 w-4"/></span><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{offer.store_name}</p>{offer.indicative ? <span className="rounded-md bg-td-warning/10 px-1.5 py-0.5 text-[11px] font-bold text-td-warning">INDICATIVE</span> : <span className="rounded-md bg-td-success/10 px-1.5 py-0.5 text-[11px] font-bold text-td-success">AUTHORIZED</span>}</div><p className={`mt-1 flex items-center gap-1 text-xs ${fresh.stale ? "text-td-warning" : "text-td-success"}`}><Clock3 className="h-3 w-3"/>{fresh.label}{fresh.stale ? " · verify before sending" : ""}</p></div></div><div className="text-right"><p className="text-lg font-semibold">{money.format(offer.cash_price)}</p><p className="text-xs text-td-muted">{offer.indicative ? "quantity unconfirmed" : `wants ${offer.quantity_wanted}`}</p></div></div>{index === 0 ? <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-td-accent-text"><CheckCircle2 className="h-3.5 w-3.5"/> Highest cash price</p> : null}{offer.indicative ? <p className="mt-3 text-xs leading-5 text-td-warning/70">Aggregated price data cannot confirm live demand, accepted quantity, or final condition grade. Verify directly before shipping.</p> : null}{offer.source_url ? <Link href={offer.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-td-secondary hover:text-td-accent-text">Open store verification <ArrowRight className="ml-1 h-3.5 w-3.5"/></Link> : null}</div>; })}</div></aside></div>; }
function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-[20px] border border-td-ink/[0.07] bg-td-surface p-4"><p className="text-[11px] font-semibold text-td-muted">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-td-muted">{detail}</p></div>; }
function Cell({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div><p className="text-[11px] text-td-muted sm:hidden">{label}</p><p className={`text-sm font-semibold ${accent ? "text-td-accent-text" : "text-td-secondary"}`}>{value}</p></div>; }
function Empty({ title, body, action }: { title: string; body: string; action?: string }) { return <div className="px-5 py-16 text-center"><TrendingUp className="mx-auto h-7 w-7 text-td-muted"/><h2 className="mt-4 font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-td-muted">{body}</p>{action ? <p className="mt-4 text-xs text-td-accent-text">{action}</p> : null}</div>; }
function parseCsvLine(line: string) { const result: string[] = []; let value = ""; let quoted = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"' && line[i + 1] === '"') { value += '"'; i++; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { result.push(value); value = ""; } else value += char; } result.push(value); return result; }
