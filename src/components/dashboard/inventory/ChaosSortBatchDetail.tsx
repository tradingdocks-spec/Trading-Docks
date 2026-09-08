"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MapPin, PackageCheck, Printer, Search, ScanLine } from "lucide-react";

export type ChaosSortBatchDetailData = {
  batch: {
    id: string; batch_code: string; title: string; status: string; status_v2: string;
    session_id: string | null; destination_location_id: string | null; destination_label: string;
    initial_quantity: number; current_quantity: number; created_at: string; completed_at: string | null;
  };
  positions: Array<{ id: string; item_id: string | null; card_name: string; scryfall_id: string | null; set_code: string | null; collector_number: string | null; finish: string | null; condition: string | null; quantity: number; location_id: string | null; status: string; created_at: string }>;
  session: { session_code: string; source: string; reference: string | null } | null;
};

const LABEL_MEDIA = {
  dk1201: { label: "DK-1201 · 29 × 90 mm", width: 29, height: 90 },
  dk1208: { label: "DK-1208 · 38 × 90 mm", width: 38, height: 90 },
  dk1202: { label: "DK-1202 · 62 × 100 mm", width: 62, height: 100 },
  custom: { label: "Custom media", width: 29, height: 90 },
} as const;

type LabelMediaKey = keyof typeof LABEL_MEDIA;
type LabelPosition = "top" | "center" | "bottom";

function clampMediaDimension(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(200, Math.max(10, parsed)) : fallback;
}

export function ChaosSortBatchDetail({ data }: { data: ChaosSortBatchDetailData }) {
  const [query, setQuery] = useState("");
  const [qr, setQr] = useState("");
  const [notice, setNotice] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [retired, setRetired] = useState(false);
  const [mediaKey, setMediaKey] = useState<LabelMediaKey>("dk1201");
  const [labelPosition, setLabelPosition] = useState<LabelPosition>("top");
  const [customWidth, setCustomWidth] = useState("29");
  const [customHeight, setCustomHeight] = useState("90");
  const filtered = useMemo(() => data.positions.filter((position) => `${position.card_name} ${position.set_code ?? ""} ${position.collector_number ?? ""}`.toLowerCase().includes(query.toLowerCase().trim())), [data.positions, query]);
  useEffect(() => { void QRCode.toDataURL(typeof window === "undefined" ? "" : window.location.href, { width: 220, margin: 1 }).then(setQr); }, []);
  useEffect(() => {
    const saved = window.localStorage.getItem("td.batch-label-media");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { key?: LabelMediaKey; position?: LabelPosition; width?: string; height?: string };
      if (parsed.key && parsed.key in LABEL_MEDIA) setMediaKey(parsed.key);
      if (parsed.position === "top" || parsed.position === "center" || parsed.position === "bottom") setLabelPosition(parsed.position);
      if (parsed.width) setCustomWidth(parsed.width);
      if (parsed.height) setCustomHeight(parsed.height);
    } catch { /* Ignore an old or malformed local preference. */ }
  }, []);
  const media = mediaKey === "custom"
    ? { width: clampMediaDimension(customWidth, 29), height: clampMediaDimension(customHeight, 90) }
    : LABEL_MEDIA[mediaKey];
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
  const labelJustify = labelPosition === "center" ? "center" : labelPosition === "bottom" ? "flex-end" : "flex-start";

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

  return <main className="batch-page min-h-screen bg-[var(--td-background-primary)] p-4 text-white sm:p-6 lg:p-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/dashboard/inventory/chaos-sort" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to Chaos Sort</Link>
      <section className="grid gap-5 lg:grid-cols-[1fr_240px]">
        <div className="rounded-2xl border border-white/10 bg-[#071520] p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">Physical batch</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">{data.batch.batch_code}</h1><p className="mt-2 text-sm text-slate-400">{data.batch.title}</p></div><span className="rounded-full bg-emerald-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-200">{data.batch.status_v2}</span></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-4"><Stat label="Remaining" value={String(data.batch.current_quantity)} /><Stat label="Initial" value={String(data.batch.initial_quantity)} /><Stat label="Location" value={data.batch.destination_label || "Unassigned"} /><Stat label="Session" value={data.session?.session_code ?? "—"} /></div>
          <div className="mt-5 flex flex-wrap items-end gap-2"><button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950"><Printer className="h-4 w-4" />Print label</button><label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Media<select value={mediaKey} onChange={(event) => updateMedia(event.target.value as LabelMediaKey)} className="min-h-10 rounded-xl border border-white/10 bg-[#06141e] px-3 text-sm font-semibold normal-case tracking-normal text-slate-200 outline-none focus:border-cyan-300/50">{Object.entries(LABEL_MEDIA).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}</select></label><label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Print position<select value={labelPosition} onChange={(event) => updateLabelPosition(event.target.value as LabelPosition)} className="min-h-10 rounded-xl border border-white/10 bg-[#06141e] px-3 text-sm font-semibold normal-case tracking-normal text-slate-200 outline-none focus:border-cyan-300/50"><option value="top">Top of label</option><option value="center">Center of label</option><option value="bottom">Bottom of label</option></select></label>{mediaKey === "custom" ? <div className="flex gap-2"><label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Width (mm)<input inputMode="decimal" value={customWidth} onChange={(event) => updateCustomMedia(event.target.value, customHeight)} className="min-h-10 w-24 rounded-xl border border-white/10 bg-[#06141e] px-3 text-sm font-semibold normal-case tracking-normal text-slate-200 outline-none focus:border-cyan-300/50" /></label><label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Height (mm)<input inputMode="decimal" value={customHeight} onChange={(event) => updateCustomMedia(customWidth, event.target.value)} className="min-h-10 w-24 rounded-xl border border-white/10 bg-[#06141e] px-3 text-sm font-semibold normal-case tracking-normal text-slate-200 outline-none focus:border-cyan-300/50" /></label></div> : null}<span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-slate-300"><MapPin className="h-4 w-4" />{data.batch.destination_label}</span><button type="button" disabled={data.batch.current_quantity > 0 || retired} onClick={() => void retireBatch()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-300/20 px-4 text-sm font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-40">{retired ? "Retired" : "Remove batch"}</button></div>
          {notice ? <p className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-sm text-cyan-100">{notice}</p> : null}
        </div>
        <aside className="label-sheet rounded-2xl border border-white/10 bg-white p-4 text-center text-slate-950" style={{ "--label-width": `${media.width}mm`, "--label-height": `${media.height}mm`, "--label-justify": labelJustify } as React.CSSProperties}><p className="text-[20px] font-black leading-none tracking-tight">{data.batch.batch_code}</p>{qr ? <img src={qr} alt={`QR code for ${data.batch.batch_code}`} className="mx-auto mt-[4mm] h-[22mm] w-[22mm]" style={{ maxWidth: "calc(var(--label-width) - 6mm)" }} /> : <div className="mx-auto mt-[4mm] h-[22mm] w-[22mm] animate-pulse bg-slate-200" />}<p className="mt-[4mm] text-[11px] font-bold leading-tight">{data.batch.current_quantity} / {data.batch.initial_quantity} cards</p><p className="mt-[2mm] text-[10px] uppercase tracking-wide">{new Date(data.batch.created_at).toLocaleDateString()}</p></aside>
      </section>
      <section className="rounded-2xl border border-white/10 bg-[#06141e] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-cyan-300">Batch contents</p><h2 className="mt-1 text-xl font-semibold">Find and pick</h2></div><label className="relative block w-full sm:w-80"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search card, set, or number" className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-300/50" /></label></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Card</th><th className="px-3 py-3">Printing</th><th className="px-3 py-3">Condition</th><th className="px-3 py-3">Qty</th><th className="px-3 py-3" /></tr></thead><tbody>{filtered.map((position) => <tr key={position.id} className="border-t border-white/5"><td className="px-3 py-4 font-semibold text-white">{position.card_name}</td><td className="px-3 py-4 text-slate-400">{position.set_code ?? "—"} {position.collector_number ?? ""} · {position.finish ?? "Nonfoil"}</td><td className="px-3 py-4 text-slate-400">{position.condition ?? "—"}</td><td className="px-3 py-4 font-semibold tabular-nums text-cyan-100">{position.quantity}</td><td className="px-3 py-4 text-right"><button type="button" disabled={position.quantity < 1 || picking === position.id} onClick={() => void pick(position.id)} className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-40"><PackageCheck className="h-3.5 w-3.5" />{picking === position.id ? "Picking…" : "Pick 1"}</button></td></tr>)}</tbody></table>{!filtered.length ? <div className="py-10 text-center text-sm text-slate-500"><ScanLine className="mx-auto h-6 w-6" /><p className="mt-2">No matching cards in this batch.</p></div> : null}</div>
      </section>
    </div>
    <style>{`@media print { @page { size: var(--label-width) var(--label-height); margin: 0; } body * { visibility: hidden !important; } .label-sheet, .label-sheet * { visibility: visible !important; } .label-sheet { display: flex; flex-direction: column; align-items: center; justify-content: var(--label-justify); position: absolute; left: 0; top: 0; width: var(--label-width); height: var(--label-height); min-height: 0; overflow: hidden; border: 0; border-radius: 0; padding: 3mm; } }`}</style>
  </main>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-100">{value}</p></div>; }
