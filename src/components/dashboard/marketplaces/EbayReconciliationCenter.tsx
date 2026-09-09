"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Clock3, ExternalLink, Images, Loader2,
  PackageSearch, RefreshCw, Search, ShieldCheck, ShoppingBag, Sparkles,
} from "lucide-react";

type Listing = {
  id: string;
  trading_docks_sku: string;
  external_listing_id: string;
  external_sku: string | null;
  match_status: "matched" | "suggested" | "unmatched" | "conflict" | "ignored";
  last_seen_quantity: number | null;
  last_seen_price: number | null;
  raw_snapshot: {
    inventoryItem?: { product?: { title?: string; imageUrls?: string[] }; condition?: string };
    offer?: { status?: string };
    enrichment?: { status?: "exact" | "suggested" | "unmatched" | "unsupported"; confidence?: number; name?: string; setName?: string; collectorNumber?: string; imageUrl?: string; reason?: string };
  };
  last_seen_at: string;
};
type Order = {
  id: string;
  external_order_id: string;
  payment_status: string | null;
  fulfillment_status: string | null;
  currency: string | null;
  total: number | null;
  buyer_alias: string | null;
  ordered_at: string | null;
  marketplace_order_items: Array<{ id: string; title: string; quantity: number; external_sku: string | null; match_status: string }>;
};
type Run = {
  id: string;
  status: string;
  records_seen: number;
  summary: Record<string, number | string>;
  created_at: string;
  completed_at: string | null;
};
type Snapshot = {
  connection: { status: string; health: string; last_sync_at: string | null; sync_mode: string } | null;
  listings: Listing[];
  orders: Order[];
  runs: Run[];
};

const statusStyle: Record<string, string> = {
  matched: "border-td-success/20 bg-td-success/[.06] text-td-success",
  suggested: "border-td-accent/20 bg-td-accent/[.06] text-td-accent-text",
  unmatched: "border-td-warning/20 bg-td-warning/[.06] text-td-warning",
  conflict: "border-td-danger/20 bg-td-danger/[.06] text-td-danger",
  ignored: "border-td-ink/10 bg-td-ink/[.03] text-td-secondary",
};

export function EbayReconciliationCenter() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"listings" | "orders" | "history">("listings");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/marketplaces/ebay/reconciliation", { cache: "no-store" });
    const body = await response.json().catch(() => null) as (Snapshot & { error?: string }) | null;
    if (!response.ok || !body) setNotice(body?.error ?? "Could not load eBay reconciliation data.");
    else setSnapshot(body);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function importNow() {
    setImporting(true);
    setNotice("");
    try {
      const response = await fetch("/api/marketplaces/ebay/import", { method: "POST" });
      const body = await response.json().catch(() => null) as (Record<string, number> & { error?: string }) | null;
      if (!response.ok) {
        setNotice(body?.error ?? `eBay import failed (${response.status}).`);
        await load();
      } else {
        setNotice(`Import complete: ${body?.listings ?? 0} listings and ${body?.orders ?? 0} orders reviewed. No eBay data was changed.`);
        await load();
      }
    } catch {
      setNotice("Trading Docks could not reach the eBay importer. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  async function findCardImages() {
    setEnriching(true); setNotice("");
    try {
      const response = await fetch("/api/marketplaces/catalog/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketplaceId: "ebay", limit: 100 }) });
      const body = await response.json().catch(() => null) as { reviewed?: number; exact?: number; suggested?: number; remaining?: number; error?: string } | null;
      if (!response.ok) setNotice(body?.error ?? "Card-image matching could not be completed.");
      else setNotice(`Catalog review complete: ${body?.reviewed ?? 0} listings checked, ${(body?.exact ?? 0) + (body?.suggested ?? 0)} images found.${body?.remaining ? ` ${body.remaining} listings remain; run it again to continue.` : ""}`);
      await load();
    } catch { setNotice("Trading Docks could not reach the catalog matcher. Please try again."); }
    finally { setEnriching(false); }
  }

  const counts = useMemo(() => {
    const result = { matched: 0, suggested: 0, unmatched: 0, conflict: 0 };
    for (const listing of snapshot?.listings ?? []) {
      if (listing.match_status in result) result[listing.match_status as keyof typeof result] += 1;
    }
    return result;
  }, [snapshot]);
  const filtered = useMemo(() => (snapshot?.listings ?? []).filter((item) => {
    const title = item.raw_snapshot.inventoryItem?.product?.title ?? "";
    return (filter === "all" || item.match_status === filter)
      && `${title} ${item.external_sku ?? ""} ${item.external_listing_id}`.toLowerCase().includes(query.toLowerCase());
  }), [snapshot, filter, query]);

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center gap-2 text-sm text-td-muted"><Loader2 className="h-5 w-5 animate-spin text-td-accent-text" />Loading eBay imports…</div>;

  const connected = snapshot?.connection?.status === "ready";
  return (
    <div className="mx-auto w-full max-w-[1640px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[28px] border border-td-accent/15 bg-[radial-gradient(circle_at_top_right,rgb(var(--td-accent-rgb)/.11),transparent_34%),var(--td-surface-default)] p-6 sm:p-8">
        <a href="/dashboard/marketplaces" className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-td-muted hover:text-td-accent-text"><ArrowLeft className="h-3.5 w-3.5" />Marketplace center</a>
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-td-accent-text"><ShoppingBag className="h-4 w-4" />eBay read-only importer</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-td-primary">Import & Reconciliation Center</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-td-secondary">Bring in listings and orders, match them against Trading Docks inventory, and review uncertain records. This release cannot edit eBay prices, quantities, or listings.</p>
          </div>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={enriching || !(snapshot?.listings.length)} onClick={() => void findCardImages()} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-td-accent/20 bg-td-accent/[.06] px-5 text-xs font-bold text-td-accent-text disabled:cursor-not-allowed disabled:opacity-45">{enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}{enriching ? "Matching titles…" : "Find card images"}</button><button type="button" disabled={importing || !connected} onClick={() => void importNow()} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-td-accent px-5 text-xs font-bold text-td-on-accent disabled:cursor-not-allowed disabled:opacity-45">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{importing ? "Importing from eBay…" : "Import now"}
          </button></div>
        </div>
      </section>

      {!connected ? <div className="flex items-start gap-3 rounded-2xl border border-td-warning/15 bg-td-warning/[.04] p-4 text-td-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-td-warning" /><div><p className="text-xs font-semibold">Connect eBay before importing</p><p className="mt-1 text-[11px] text-td-warning/55">Return to Marketplace Integration Center and authorize this store’s eBay seller account.</p></div></div> : null}
      {notice ? <div role="status" className="rounded-2xl border border-td-accent/15 bg-td-accent/[.04] px-4 py-3 text-xs text-td-accent-text">{notice}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={PackageSearch} label="Imported listings" value={String(snapshot?.listings.length ?? 0)} detail={snapshot?.connection?.last_sync_at ? `Updated ${new Date(snapshot.connection.last_sync_at).toLocaleString()}` : "No import yet"} />
        <Metric icon={CheckCircle2} label="Exact matches" value={String(counts.matched)} detail="Matched by SKU" tone="emerald" />
        <Metric icon={Sparkles} label="Suggested" value={String(counts.suggested)} detail="Needs confirmation" />
        <Metric icon={AlertTriangle} label="Unmatched" value={String(counts.unmatched + counts.conflict)} detail="Needs attention" tone="amber" />
        <Metric icon={ShoppingBag} label="Imported orders" value={String(snapshot?.orders.length ?? 0)} detail="Duplicate-safe updates" />
      </section>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-td-ink/[.07] bg-td-surface p-2">
        {(["listings", "orders", "history"] as const).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`min-h-11 rounded-xl text-[11px] font-semibold capitalize ${tab === item ? "border border-td-accent/15 bg-td-accent/[.065] text-td-accent-text" : "text-td-muted"}`}>{item}</button>)}
      </div>

      {tab === "listings" ? <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-td-ink/[.07] bg-td-surface px-4"><Search className="h-4 w-4 text-td-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, SKU, or eBay item number…" className="min-w-0 flex-1 bg-transparent text-xs text-td-primary outline-none" /></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-11 rounded-xl border border-td-ink/[.07] bg-td-surface px-4 text-xs text-td-secondary outline-none"><option value="all">All matches</option><option value="matched">Matched</option><option value="suggested">Suggested</option><option value="unmatched">Unmatched</option><option value="conflict">Conflicts</option><option value="ignored">Ignored</option></select>
        </div>
        <div className="overflow-hidden rounded-[22px] border border-td-ink/[.08] bg-td-surface">
          {filtered.length ? filtered.map((item) => {
            const product = item.raw_snapshot.inventoryItem?.product;
            return <div key={item.id} className="grid gap-3 border-b border-td-ink/[.06] p-4 last:border-0 md:grid-cols-[minmax(0,1fr)_130px_100px_120px] md:items-center">
              <div className="flex min-w-0 items-center gap-3"><ListingImage listingId={item.id} ebayImage={Boolean(product?.imageUrls?.[0])} catalogImage={item.raw_snapshot.enrichment?.imageUrl} title={product?.title ?? item.external_sku ?? "eBay listing"} /><div className="min-w-0"><p className="truncate text-xs font-semibold text-td-primary">{product?.title ?? item.external_sku ?? "Untitled eBay listing"}</p><p className="mt-1 truncate text-[11px] text-td-muted">{item.raw_snapshot.enrichment?.name ? `${item.raw_snapshot.enrichment.name} · ${item.raw_snapshot.enrichment.setName ?? "Printing review"}${item.raw_snapshot.enrichment.collectorNumber ? ` #${item.raw_snapshot.enrichment.collectorNumber}` : ""}` : `SKU ${item.external_sku ?? "—"} · Item ${item.external_listing_id}`}</p></div></div>
              <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${statusStyle[item.match_status]}`}>{item.match_status}</span>
              <div><p className="text-[11px] uppercase text-td-muted">Available</p><p className="mt-1 text-xs font-semibold text-td-primary">{item.last_seen_quantity ?? 0}</p></div>
              <div className="flex items-center justify-between"><div><p className="text-[11px] uppercase text-td-muted">Price</p><p className="mt-1 text-xs font-semibold text-td-primary">{item.last_seen_price == null ? "—" : `$${Number(item.last_seen_price).toFixed(2)}`}</p></div>{/^\d+$/.test(item.external_listing_id) ? <a href={`https://www.ebay.com/itm/${item.external_listing_id}`} target="_blank" rel="noreferrer" aria-label="Open listing on eBay" className="text-td-muted hover:text-td-accent-text"><ExternalLink className="h-4 w-4" /></a> : null}</div>
            </div>;
          }) : <Empty text="No listings match this view. Run an import or change the filters." />}
        </div>
      </section> : null}

      {tab === "orders" ? <section className="grid gap-3">{snapshot?.orders.length ? snapshot.orders.map((order) => <article key={order.id} className="rounded-[20px] border border-td-ink/[.08] bg-td-surface p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold text-td-primary">Order {order.external_order_id}</p><p className="mt-1 text-[11px] text-td-muted">{order.ordered_at ? new Date(order.ordered_at).toLocaleString() : "Date unavailable"} · {order.buyer_alias ?? "eBay buyer"}</p></div><p className="text-lg font-semibold text-td-primary">{order.total == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency ?? "USD" }).format(order.total)}</p></div><div className="mt-4 flex flex-wrap gap-2">{order.marketplace_order_items.map((line) => <span key={line.id} className="rounded-lg border border-td-ink/[.07] bg-black/10 px-2.5 py-1.5 text-[11px] text-td-secondary">{line.quantity}× {line.title} · {line.match_status}</span>)}</div><div className="mt-4 flex gap-2 text-[11px] uppercase tracking-wider text-td-muted"><span>{order.payment_status ?? "Payment unknown"}</span><span>·</span><span>{order.fulfillment_status ?? "Fulfillment unknown"}</span></div></article>) : <Empty text="No orders imported yet." />}</section> : null}

      {tab === "history" ? <section className="overflow-hidden rounded-[22px] border border-td-ink/[.08] bg-td-surface">{snapshot?.runs.length ? snapshot.runs.map((run) => <div key={run.id} className="flex items-center justify-between gap-4 border-b border-td-ink/[.06] p-4 last:border-0"><div className="flex items-center gap-3"><Clock3 className="h-4 w-4 text-td-accent-text" /><div><p className="text-xs font-semibold capitalize text-td-primary">{run.status}</p><p className="mt-1 text-[11px] text-td-muted">{new Date(run.created_at).toLocaleString()} · {run.records_seen} records reviewed</p></div></div>{typeof run.summary.error === "string" ? <p className="max-w-md text-right text-[11px] text-td-danger">{run.summary.error}</p> : <ShieldCheck className="h-4 w-4 text-td-success" />}</div>) : <Empty text="Sync history will appear after the first import." />}</section> : null}
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, tone = "cyan" }: { icon: typeof Search; label: string; value: string; detail: string; tone?: "cyan" | "emerald" | "amber" }) {
  const color = tone === "emerald" ? "text-td-success" : tone === "amber" ? "text-td-warning" : "text-td-accent-text";
  return <div className="rounded-[20px] border border-td-ink/[.08] bg-td-surface p-4"><div className="flex items-center gap-2"><Icon className={`h-4 w-4 ${color}`} /><p className="text-[11px] font-bold uppercase tracking-[.14em] text-td-muted">{label}</p></div><p className="mt-3 text-2xl font-semibold text-td-primary">{value}</p><p className="mt-1 truncate text-[11px] text-td-muted">{detail}</p></div>;
}
function Empty({ text }: { text: string }) {
  return <div className="flex min-h-40 items-center justify-center p-6 text-center text-xs text-td-muted">{text}</div>;
}

function ListingImage({ listingId, ebayImage, catalogImage, title }: { listingId: string; ebayImage: boolean; catalogImage?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const src = ebayImage && !failed ? `/api/marketplaces/ebay/listing-image/${encodeURIComponent(listingId)}` : catalogImage;
  if (!src) {
    return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-td-ink/[.06] bg-td-ink/[.04]"><PackageSearch className="h-4 w-4 text-td-muted" /></div>;
  }
  return <img src={src} alt={`${title} thumbnail`} loading="lazy" decoding="async" onError={() => ebayImage && !failed ? setFailed(true) : undefined} className="h-12 w-12 shrink-0 rounded-lg border border-td-ink/[.06] bg-td-ink/[.04] object-cover" />;
}
