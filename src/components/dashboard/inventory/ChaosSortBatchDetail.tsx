"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MapPin, PackageCheck, Printer, Search, ScanLine } from "lucide-react";
import { LABEL_MEDIA, resolveLabelMedia, chaosSortLabelPrintHref, type LabelMediaKey, type LabelPosition } from "@/lib/chaos-sort/label-media";

export type ChaosSortBatchDetailData = {
  batch: {
    id: string; batch_code: string; title: string; status: string; status_v2: string;
    session_id: string | null; destination_location_id: string | null; destination_label: string;
    initial_quantity: number; current_quantity: number; created_at: string; completed_at: string | null;
  };
  positions: Array<{ id: string; item_id: string | null; card_name: string; scryfall_id: string | null; set_code: string | null; collector_number: string | null; finish: string | null; condition: string | null; language: string | null; quantity: number; location_id: string | null; status: string; created_at: string }>;
  session: { session_code: string; source: string; reference: string | null } | null;
};

export function ChaosSortBatchDetail({ data }: { data: ChaosSortBatchDetailData }) {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [retired, setRetired] = useState(false);
  const [mediaKey, setMediaKey] = useState<LabelMediaKey>("dk1201");
  const [labelPosition, setLabelPosition] = useState<LabelPosition>("top");
  const [customWidth, setCustomWidth] = useState("29");
  const [customHeight, setCustomHeight] = useState("90");
  const filtered = useMemo(() => data.positions.filter((position) => `${position.card_name} ${position.set_code ?? ""} ${position.collector_number ?? ""}`.toLowerCase().includes(query.toLowerCase().trim())), [data.positions, query]);
  useEffect(() => {
    const saved = window.localStorage.getItem("td.batch-label-media");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { key?: LabelMediaKey; position?: LabelPosition; width?: string; height?: string };
      if (parsed.key && Object.hasOwn(LABEL_MEDIA, parsed.key)) setMediaKey(parsed.key);
      if (parsed.position === "top" || parsed.position === "center" || parsed.position === "bottom") setLabelPosition(parsed.position);
      if (parsed.width) setCustomWidth(parsed.width);
      if (parsed.height) setCustomHeight(parsed.height);
    } catch { /* Ignore an old or malformed local preference. */ }
  }, []);
  const media = resolveLabelMedia(new URLSearchParams({ media: mediaKey, position: labelPosition, width: customWidth, height: customHeight }));
  function updateMedia(key: LabelMediaKey) {
    setMediaKey(key);
    window.localStorage.setItem("td.batch-label-media", JSON.stringify({ key, position: labelPosition, width: customWidth, height: customHeight }));
  }
  function updateCustomMedia(width: string, height: string) {
    setCustomWidth(width); setCustomHeight(height);
    window.localStorage.setItem("td.batch-label-media", JSON.stringify({ key: "custom", position: labelPosition, width, height }));
  }
  function updateLabelPosition(position: LabelPosition) {
    setLabelPosition(position);
    window.localStorage.setItem("td.batch-label-media", JSON.stringify({ key: mediaKey, position, width: customWidth, height: customHeight }));
  }

  async function pick(positionId: string) {
    setPicking(positionId); setNotice("");
    const response = await fetch("/api/chaos-sort/pick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ positionId }) });
    const result = await response.json().catch(() => ({}));
    setPicking(null);
    setNotice(response.ok ? "Picked one copy and recorded the inventory event." : String(result.error ?? "Pick failed."));
  }

  async function retireBatch() {
    if (data.batch.current_quantity > 0 || retired) return;
    if (!window.confirm(`Retire ${data.batch.batch_code}? This keeps its history but removes it from active batch work.`)) return;
    const response = await fetch("/api/chaos-sort/retire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId: data.batch.id }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setNotice(String(result.error ?? "Batch could not be retired.")); return; }
    setRetired(true); setNotice("Batch retired. Its history and inventory events remain available.");
  }

  return <main className="batch-page min-h-screen bg-[var(--td-background-primary)] p-4 text-td-primary sm:p-6 lg:p-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href={`/dashboard/selling/listings?chaosBatch=${data.batch.id}`} className="inline-flex items-center rounded-xl border border-td-accent/20 bg-td-accent/5 px-4 py-2 text-sm font-bold text-td-accent-text">Prepare this batch for selling</Link>
      <Link href="/dashboard/inventory/chaos-sort" className="inline-flex items-center gap-2 text-sm font-semibold text-td-secondary hover:text-td-primary"><ArrowLeft className="h-4 w-4" />Back to Chaos Sort</Link>
      <section className="grid gap-5 lg:grid-cols-[1fr_240px]">
        <div className="rounded-2xl border border-td-ink/10 bg-td-surface p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-td-accent-text">Physical batch</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">{data.batch.batch_code}</h1><p className="mt-2 text-sm text-td-secondary">{data.batch.title}</p></div><span className="rounded-full bg-td-success/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-td-success">{data.batch.status_v2}</span></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-4"><Stat label="Remaining" value={String(data.batch.current_quantity)} /><Stat label="Initial" value={String(data.batch.initial_quantity)} /><Stat label="Location" value={data.batch.destination_label || "Unassigned"} /><Stat label="Session" value={data.session?.session_code ?? "—"} /></div>
          <div className="mt-5 flex flex-wrap items-end gap-2"><a href={chaosSortLabelPrintHref(data.batch.id, media)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-td-accent px-4 text-sm font-bold text-td-on-accent"><Printer className="h-4 w-4" />Print label</a><label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-td-muted">Media<select value={mediaKey} onChange={(event) => updateMedia(event.target.value as LabelMediaKey)} className="min-h-10 rounded-xl border border-td-ink/10 bg-td-surface px-3 text-sm font-semibold normal-case tracking-normal text-td-primary outline-none focus:border-td-accent/50">{Object.entries(LABEL_MEDIA).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}</select></label><label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-td-muted">Print position<select value={labelPosition} onChange={(event) => updateLabelPosition(event.target.value as LabelPosition)} className="min-h-10 rounded-xl border border-td-ink/10 bg-td-surface px-3 text-sm font-semibold normal-case tracking-normal text-td-primary outline-none focus:border-td-accent/50"><option value="top">Top of label</option><option value="center">Center of label</option><option value="bottom">Bottom of label</option></select></label>{mediaKey === "custom" ? <div className="flex gap-2"><label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-td-muted">Width (mm)<input inputMode="decimal" value={customWidth} onChange={(event) => updateCustomMedia(event.target.value, customHeight)} className="min-h-10 w-24 rounded-xl border border-td-ink/10 bg-td-surface px-3 text-sm font-semibold normal-case tracking-normal text-td-primary outline-none focus:border-td-accent/50" /></label><label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-td-muted">Height (mm)<input inputMode="decimal" value={customHeight} onChange={(event) => updateCustomMedia(customWidth, event.target.value)} className="min-h-10 w-24 rounded-xl border border-td-ink/10 bg-td-surface px-3 text-sm font-semibold normal-case tracking-normal text-td-primary outline-none focus:border-td-accent/50" /></label></div> : null}<span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-td-ink/10 px-4 text-sm text-td-secondary"><MapPin className="h-4 w-4" />{data.batch.destination_label}</span><button type="button" disabled={data.batch.current_quantity > 0 || retired} onClick={() => void retireBatch()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-td-danger/20 px-4 text-sm font-semibold text-td-danger disabled:cursor-not-allowed disabled:opacity-40">{retired ? "Retired" : "Remove batch"}</button></div>
          {notice ? <p className="mt-4 rounded-xl border border-td-accent/20 bg-td-accent/5 p-3 text-sm text-td-accent-text">{notice}</p> : null}
        </div>
        <aside className="rounded-2xl border border-td-ink/10 bg-td-surface p-4">
          <p className="mb-3 text-xs font-semibold text-td-secondary">Single batch label · {media.width} × {media.height} mm</p>
          <img key={data.batch.id} alt={`Label preview for ${data.batch.batch_code}`} src={`${chaosSortLabelPrintHref(data.batch.id, media, "preview")}&format=svg`} className="mx-auto block border-0 bg-white" style={{ width: Math.min(210, 360 * media.width / media.height), height: Math.min(360, 210 * media.height / media.width), maxWidth: "100%" }} />
          <p className="mt-3 text-xs leading-5 text-td-muted">Print label opens one isolated label. Use Print Batch Inventory Labels to label the committed positions.</p>
        </aside>
      </section>
      <section className="rounded-2xl border border-td-ink/10 bg-td-surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-td-accent-text">Batch contents</p><h2 className="mt-1 text-xl font-semibold">Find and pick</h2></div><label className="relative block w-full sm:w-80"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-td-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search card, set, or number" className="min-h-10 w-full rounded-xl border border-td-ink/10 bg-black/20 pl-9 pr-3 text-sm text-td-primary outline-none focus:border-td-accent/50" /></label></div>
        <a href={`/dashboard/label-studio?source=batch&batchId=${data.batch.id}`} className="inline-flex min-h-10 items-center px-4 font-bold">Print Batch Inventory Labels</a><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-td-muted"><tr><th className="px-3 py-3">Card</th><th className="px-3 py-3">Printing</th><th className="px-3 py-3">Condition</th><th className="px-3 py-3">Qty</th><th className="px-3 py-3" /></tr></thead><tbody>{filtered.map((position) => <tr key={position.id} className="border-t border-td-ink/5"><td className="px-3 py-4 font-semibold text-td-primary">{position.card_name}</td><td className="px-3 py-4 text-td-secondary">{position.set_code ?? "—"} {position.collector_number ?? ""} · {position.finish ?? "Nonfoil"}</td><td className="px-3 py-4 text-td-secondary">{position.condition ?? "—"}</td><td className="px-3 py-4 font-semibold tabular-nums text-td-accent-text">{position.quantity}</td><td className="px-3 py-4 text-right"><button type="button" disabled={position.quantity < 1 || picking === position.id} onClick={() => void pick(position.id)} className="inline-flex items-center gap-2 rounded-lg border border-td-accent/20 px-3 py-2 text-xs font-bold text-td-accent-text disabled:opacity-40"><PackageCheck className="h-3.5 w-3.5" />{picking === position.id ? "Picking…" : "Pick 1"}</button></td></tr>)}</tbody></table>{!filtered.length ? <div className="py-10 text-center text-sm text-td-muted"><ScanLine className="mx-auto h-6 w-6" /><p className="mt-2">No matching cards in this batch.</p></div> : null}</div>
      </section>
    </div>

  </main>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] font-bold uppercase tracking-wide text-td-muted">{label}</p><p className="mt-1 truncate text-sm font-semibold text-td-primary">{value}</p></div>; }
