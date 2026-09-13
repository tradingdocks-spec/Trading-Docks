"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Loader2, MapPinned, Search, Store, Users } from "lucide-react";

type StoreResult = {
  providerPlaceId: string;
  businessName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  websiteUrl: string | null;
  listingUrl: string | null;
  category: string | null;
  openNow: boolean | null;
  distanceMiles: number | null;
};

const radii = [5, 10, 25, 50, 100];

export function StoreFinderWorkspace() {
  const [postalCode, setPostalCode] = useState("");
  const [radius, setRadius] = useState(25);
  const [stores, setStores] = useState<StoreResult[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function search() {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/marketing/store-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode, radius }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Search failed.");
      setStores(data.stores ?? []);
      setSelected(data.stores?.[0]?.providerPlaceId ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function save(store: StoreResult) {
    const response = await fetch("/api/admin/marketing/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not save prospect.");
      return;
    }
    setSaved((current) => new Set(current).add(store.providerPlaceId));
    setNotice(data.alreadySaved ? "This store is already in Prospects." : `${store.businessName} saved to Prospects.`);
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-8 sm:py-10">
      <header className="flex flex-col gap-5 border-b border-td-ink/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-td-accent">Admin marketing</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-td-primary sm:text-4xl">Store Finder</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-td-secondary">Find legitimate trading-card businesses by territory, then save the right prospects for outreach.</p>
        </div>
        <Link href="/dashboard/admin/marketing/prospects" className="td-button-secondary shrink-0"><Users className="h-4 w-4" />View prospects <ArrowRight className="h-3.5 w-3.5" /></Link>
      </header>

      <main className="pt-7">
        <section className="rounded-[24px] border border-td-accent/20 bg-gradient-to-br from-td-accent/[0.08] via-td-surface/70 to-td-surface/50 p-5 shadow-[0_18px_60px_rgb(var(--td-shadow-rgb)/.12)] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-td-accent/20 bg-td-accent/[0.09] text-td-accent-text"><MapPinned className="h-5 w-5" /></span>
            <div><p className="text-sm font-semibold text-td-primary">Search a territory</p><p className="mt-1 text-xs leading-5 text-td-muted">Use a ZIP code and radius to discover nearby stores. Results are deduplicated before they reach your prospect list.</p></div>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void search(); }} className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px_auto] lg:items-end">
            <label className="block"><span className="td-label">ZIP code</span><input required value={postalCode} onChange={(event) => setPostalCode(event.target.value)} inputMode="numeric" maxLength={10} placeholder="e.g. 85001" className="td-input mt-2 h-12" /></label>
            <label className="block"><span className="td-label">Search radius</span><select value={radius} onChange={(event) => setRadius(Number(event.target.value))} className="td-input mt-2 h-12">{radii.map((item) => <option key={item} value={item}>{item} miles</option>)}</select></label>
            <button type="submit" disabled={loading} className="td-button-primary h-12 justify-center">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{loading ? "Searching…" : "Search stores"}</button>
          </form>
          <p className="mt-4 flex items-center gap-2 text-xs text-td-muted"><Check className="h-3.5 w-3.5 text-td-success" />Provider search runs securely on the server; keys are never exposed to the browser.</p>
        </section>

        {error ? <div role="alert" className="mt-4 rounded-xl border border-td-danger/20 bg-td-danger/10 p-4 text-sm text-td-danger">{error}</div> : null}
        {notice ? <div role="status" className="mt-4 rounded-xl border border-td-success/20 bg-td-success/10 p-4 text-sm text-td-success">{notice}</div> : null}

        {stores.length ? (
          <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(360px,.9fr)_1.1fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-td-accent">Search results</p><h2 className="mt-1 text-lg font-semibold text-td-primary">{stores.length} businesses found</h2></div><span className="text-xs text-td-muted">{radius} mi radius</span></div>
              {stores.map((store, index) => <article key={store.providerPlaceId} className={`rounded-2xl border p-4 transition ${selected === store.providerPlaceId ? "border-td-accent/60 bg-td-accent/[0.08]" : "border-td-ink/10 bg-td-surface/60 hover:border-td-accent/30"}`}>
                <button type="button" onClick={() => setSelected(store.providerPlaceId)} className="flex w-full gap-3 text-left"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-td-accent text-xs font-bold text-td-canvas">{index + 1}</span><span className="min-w-0 flex-1"><span className="block font-semibold text-td-primary">{store.businessName}</span><span className="mt-1 block text-sm text-td-secondary">{store.address || "Address unavailable"}</span><span className="mt-2 block text-xs text-td-muted">{store.distanceMiles !== null ? `${store.distanceMiles} mi` : "Distance unavailable"}{store.category ? ` · ${store.category}` : ""}{store.openNow === true ? " · Open now" : store.openNow === false ? " · Closed" : ""}</span></span></button>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-td-ink/[0.07] pt-3"><span className="truncate text-xs text-td-muted">{store.phone ?? "No phone listed"}</span><button type="button" onClick={() => void save(store)} className="shrink-0 rounded-lg border border-td-accent/25 px-3 py-1.5 text-xs font-semibold text-td-accent-text transition hover:bg-td-accent/[0.1]">{saved.has(store.providerPlaceId) ? "Saved" : "Save prospect"}</button></div>
              </article>)}
            </div>
            <div className="min-h-[480px] overflow-hidden rounded-[24px] border border-td-ink/10 bg-[#0d1d2b] shadow-[0_18px_60px_rgb(var(--td-shadow-rgb)/.14)]"><div className="relative h-full min-h-[480px] bg-[radial-gradient(circle_at_20%_30%,rgba(72,199,232,.18),transparent_28%),linear-gradient(135deg,#102338,#0b1725)]"><div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,210,229,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(148,210,229,.15)_1px,transparent_1px)] [background-size:42px_42px]" /><div className="absolute left-5 top-5 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/65">Territory map · {postalCode}</div>{stores.map((store, index) => <button type="button" key={store.providerPlaceId} onClick={() => setSelected(store.providerPlaceId)} aria-label={`Focus ${store.businessName}`} className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-bold shadow-xl transition ${selected === store.providerPlaceId ? "z-10 scale-125 border-white bg-td-accent text-td-canvas" : "border-td-accent/40 bg-td-accent/80 text-td-canvas"}`} style={{ left: `${15 + (index * 37) % 75}%`, top: `${28 + (index * 53) % 58}%` }}>{index + 1}</button>)}</div></div>
          </section>
        ) : (
          <section className="mt-6 rounded-[24px] border border-dashed border-td-ink/15 bg-td-surface/35 px-5 py-14 text-center sm:px-10"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-td-accent/20 bg-td-accent/[0.07] text-td-accent-text"><Store className="h-7 w-7" /></span><h2 className="mt-5 text-xl font-semibold text-td-primary">Your next territory starts here</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-td-secondary">Search a ZIP code to see nearby trading-card stores, compare listings, and save legitimate businesses to your outreach pipeline.</p><div className="mx-auto mt-8 grid max-w-3xl gap-3 text-left sm:grid-cols-3"><div className="rounded-2xl border border-td-ink/[0.07] bg-td-surface/60 p-4"><p className="text-xs font-semibold text-td-primary">1. Search</p><p className="mt-1 text-xs leading-5 text-td-muted">Choose a territory and radius.</p></div><div className="rounded-2xl border border-td-ink/[0.07] bg-td-surface/60 p-4"><p className="text-xs font-semibold text-td-primary">2. Review</p><p className="mt-1 text-xs leading-5 text-td-muted">Verify the businesses you want.</p></div><div className="rounded-2xl border border-td-ink/[0.07] bg-td-surface/60 p-4"><p className="text-xs font-semibold text-td-primary">3. Save</p><p className="mt-1 text-xs leading-5 text-td-muted">Build your prospect pipeline.</p></div></div></section>
        )}
      </main>
    </div>
  );
}
