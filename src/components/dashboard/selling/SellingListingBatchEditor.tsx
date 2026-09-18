"use client";

import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Save, X } from "lucide-react";
import { useState } from "react";

import type { SellingCandidateRecord, SellingListingBatch } from "@/lib/selling/listing-service";
import { candidateReadiness } from "@/lib/selling/listing-service";

function money(value: number | null) { return value == null ? "—" : `$${value.toFixed(2)}`; }

export function SellingListingBatchEditor({ batch }: { batch: SellingListingBatch }) {
  const [rows, setRows] = useState(batch.candidates);
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<SellingCandidateRecord | null>(null);
  const [status, setStatus] = useState("");
  const [pricing, setPricing] = useState({ mode: "market_percent", value: "0", floor: "0" });
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const readyCount = rows.filter((row) => candidateReadiness(row).code === "READY").length;

  function updateLocal(id: string, patch: Partial<SellingCandidateRecord>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
    setActive((current) => current?.id === id ? { ...current, ...patch } : current);
  }

  async function save(id: string, patch: Record<string, unknown>) {
    setStatus("Saving…");
    const response = await fetch(`/api/selling/candidates/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setStatus(payload.error ?? "Could not save candidate."); return; }
    updateLocal(id, payload.candidate);
    setStatus("Saved");
  }

  function applyPreview() {
    const value = Number(pricing.value) || 0;
    const floor = Number(pricing.floor) || 0;
    setRows((current) => current.map((row) => {
      const market = row.market_price ?? 0;
      const next = pricing.mode === "fixed" ? value : market * (1 + value / 100);
      return { ...row, listing_price: Math.max(floor, Math.round(next * 100) / 100) };
    }));
    setStatus("Pricing preview applied locally; save rows individually to persist.");
  }

  return <main className="min-h-[calc(100vh-72px)] bg-[var(--td-background-primary)] px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1500px]">
      <Link href="/dashboard/selling/listings" className="inline-flex items-center gap-2 text-xs font-semibold text-td-muted hover:text-td-primary"><ArrowLeft className="h-3.5 w-3.5" /> Listing workstation</Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-td-accent-text">{batch.source} · draft</p><h1 className="mt-1 text-3xl font-semibold text-td-primary">{batch.name}</h1><p className="mt-1 text-sm text-td-secondary">{rows.length} candidates · {readyCount} ready · physical inventory remains authoritative</p></div><Link href="/dashboard/selling/connections" className="rounded-xl border border-td-ink/[.1] px-3 py-2 text-xs font-semibold text-td-primary">Marketplace capabilities</Link></div>
      <section className="mt-6 grid gap-3 sm:grid-cols-4"><Metric label="Market value" value={money(batch.market_value)} /><Metric label="Projected value" value={money(batch.intended_value)} /><Metric label="Ready" value={`${readyCount}/${rows.length}`} /><Metric label="Selected" value={`${selected.length}`} /></section>
      <section className="mt-6 rounded-2xl border border-td-ink/[.08] bg-td-surface/70 p-4"><div className="flex flex-wrap items-end gap-3"><label className="text-xs font-semibold text-td-secondary">Pricing preview<select value={pricing.mode} onChange={(event) => setPricing({ ...pricing, mode: event.target.value })} className="mt-1 block rounded-lg border border-td-ink/[.1] bg-transparent px-2 py-2 text-sm text-td-primary"><option value="market_percent">Market ± %</option><option value="fixed">Fixed price</option></select></label><label className="text-xs font-semibold text-td-secondary">Value<input value={pricing.value} onChange={(event) => setPricing({ ...pricing, value: event.target.value })} className="mt-1 block w-24 rounded-lg border border-td-ink/[.1] bg-transparent px-2 py-2 text-sm text-td-primary" /></label><label className="text-xs font-semibold text-td-secondary">Minimum<input value={pricing.floor} onChange={(event) => setPricing({ ...pricing, floor: event.target.value })} className="mt-1 block w-24 rounded-lg border border-td-ink/[.1] bg-transparent px-2 py-2 text-sm text-td-primary" /></label><button onClick={applyPreview} className="rounded-lg bg-td-accent px-3 py-2 text-xs font-bold text-white">Preview selected rule</button><span className="text-xs text-td-muted">{status}</span></div></section>
      {selected.length > 0 && <div className="sticky top-3 z-10 mt-4 flex items-center justify-between rounded-xl border border-td-accent/30 bg-td-accent/10 px-4 py-3 text-sm text-td-primary"><span>{selected.length} selected</span><button onClick={() => setSelected([])} className="text-xs font-semibold">Clear selection</button></div>}
      <section className="mt-4 overflow-hidden rounded-2xl border border-td-ink/[.08] bg-td-surface/70"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-b border-td-ink/[.08] text-[11px] uppercase tracking-wider text-td-muted"><tr><th className="px-4 py-3"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((row) => row.id))} /></th><th className="px-4 py-3">Card</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Condition</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Provenance</th><th className="px-4 py-3">Readiness</th><th /></tr></thead><tbody className="divide-y divide-td-ink/[.06]">{rows.map((row) => { const readiness = candidateReadiness(row); return <tr key={row.id} className="hover:bg-td-surface"><td className="px-4 py-3"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => setSelected((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} /></td><td className="px-4 py-3"><button onClick={() => setActive(row)} className="text-left font-semibold text-td-primary hover:text-td-accent-text">{row.card_name}<span className="block text-xs font-normal text-td-muted">{row.set_code ?? "Set unknown"} · {row.collector_number ?? "No collector number"}</span></button></td><td className="px-4 py-3"><input aria-label={`Price for ${row.card_name}`} defaultValue={row.listing_price ?? ""} onBlur={(event) => { const value = event.target.value === "" ? null : Number(event.target.value); if (value !== row.listing_price) void save(row.id, { listingPrice: value }); }} className="w-24 rounded-md border border-td-ink/[.1] bg-transparent px-2 py-1 text-sm text-td-primary" /></td><td className="px-4 py-3"><input aria-label={`Condition for ${row.card_name}`} defaultValue={row.condition ?? ""} onBlur={(event) => { if (event.target.value !== row.condition) void save(row.id, { condition: event.target.value }); }} className="w-20 rounded-md border border-td-ink/[.1] bg-transparent px-2 py-1 text-sm text-td-primary" /></td><td className="px-4 py-3"><input aria-label={`Quantity for ${row.card_name}`} defaultValue={row.quantity} onBlur={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value !== row.quantity) void save(row.id, { quantity: value }); }} className="w-16 rounded-md border border-td-ink/[.1] bg-transparent px-2 py-1 font-mono text-xs text-td-primary" /><span className="ml-1 text-xs text-td-muted">/{row.allocated_quantity}</span></td><td className="px-4 py-3 text-xs text-td-secondary">{row.location_id ? `Location ${row.location_id.slice(0, 8)}` : "Location not recorded"}<span className="block text-td-muted">{String(row.source_provenance?.source ?? "inventory")} {row.inventory_position_id ? "· physical position" : "· item level"}</span></td><td className="px-4 py-3"><span title={readiness.message} className={readiness.code === "READY" ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700" : "inline-flex rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700"}>{readiness.code === "READY" && <Check className="h-3 w-3" />}{readiness.code}</span></td><td className="px-4 py-3"><button onClick={() => setActive(row)} className="text-xs font-semibold text-td-accent-text">Open</button></td></tr>; })}</tbody></table></div></section>
      {active && <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={() => setActive(null)}><aside className="h-full w-full max-w-lg overflow-y-auto bg-td-surface p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-widest text-td-muted">Candidate detail</p><h2 className="mt-1 text-2xl font-semibold text-td-primary">{active.card_name}</h2><p className="mt-1 text-sm text-td-secondary">{active.set_code} · {active.collector_number} · {active.language ?? "Language not recorded"}</p></div><button onClick={() => setActive(null)} aria-label="Close"><X className="h-5 w-5" /></button></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><Detail label="Physical quantity" value={`${active.quantity}`} /><Detail label="Allocated" value={`${active.allocated_quantity}`} /><Detail label="Location" value={active.location_id ?? "Not recorded"} /><Detail label="Inventory batch" value={active.inventory_batch_id ?? "Not recorded"} /><Detail label="Cost basis" value={money(active.cost_basis)} /><Detail label="Market" value={money(active.market_price)} /></div><div className="mt-6 rounded-xl border border-td-ink/[.08] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-td-muted">Provenance</p><p className="mt-2 text-sm text-td-secondary">{active.inventory_position_id ? `Physical position ${active.inventory_position_id}` : "Legacy item-level inventory"}</p><p className="mt-1 text-xs text-td-muted">Image source: {active.image_source ?? "Catalog reference"}</p>{active.source_provenance && <pre className="mt-3 overflow-auto text-[11px] text-td-muted">{JSON.stringify(active.source_provenance, null, 2)}</pre>}</div><div className="mt-6 flex gap-2"><button onClick={() => void save(active.id, { listingPrice: active.listing_price })} className="inline-flex items-center gap-2 rounded-lg bg-td-accent px-3 py-2 text-xs font-bold text-white"><Save className="h-3.5 w-3.5" /> Save preparation</button>{active.inventory_position_id && <Link href={`/dashboard/inventory/batches/${active.inventory_batch_id}`} className="inline-flex items-center gap-2 rounded-lg border border-td-ink/[.1] px-3 py-2 text-xs font-semibold text-td-primary"><ExternalLink className="h-3.5 w-3.5" /> Source batch</Link>}</div></aside></div>}
    </div>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-td-ink/[.08] bg-td-surface/70 p-4"><p className="text-xs text-td-muted">{label}</p><p className="mt-1 text-xl font-semibold text-td-primary">{value}</p></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-td-background-primary p-3"><p className="text-[11px] uppercase tracking-wider text-td-muted">{label}</p><p className="mt-1 break-all text-sm text-td-primary">{value}</p></div>; }
