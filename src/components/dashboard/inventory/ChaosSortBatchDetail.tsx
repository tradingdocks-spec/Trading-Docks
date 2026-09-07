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

export function ChaosSortBatchDetail({ data }: { data: ChaosSortBatchDetailData }) {
  const [query, setQuery] = useState("");
  const [qr, setQr] = useState("");
  const [notice, setNotice] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const filtered = useMemo(() => data.positions.filter((position) => `${position.card_name} ${position.set_code ?? ""} ${position.collector_number ?? ""}`.toLowerCase().includes(query.toLowerCase().trim())), [data.positions, query]);
  useEffect(() => { void QRCode.toDataURL(typeof window === "undefined" ? "" : window.location.href, { width: 220, margin: 1 }).then(setQr); }, []);

  async function pick(positionId: string) {
    setPicking(positionId); setNotice("");
    const response = await fetch("/api/chaos-sort/pick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ positionId }) });
    const result = await response.json().catch(() => ({}));
    setPicking(null);
    setNotice(response.ok ? "Picked one copy and recorded the inventory event." : String(result.error ?? "Pick failed."));
  }

  return <main className="batch-page min-h-screen bg-[var(--td-background-primary)] p-4 text-white sm:p-6 lg:p-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/dashboard/inventory/chaos-sort" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to Chaos Sort</Link>
      <section className="grid gap-5 lg:grid-cols-[1fr_240px]">
        <div className="rounded-2xl border border-white/10 bg-[#071520] p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">Physical batch</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">{data.batch.batch_code}</h1><p className="mt-2 text-sm text-slate-400">{data.batch.title}</p></div><span className="rounded-full bg-emerald-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-200">{data.batch.status_v2}</span></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-4"><Stat label="Remaining" value={String(data.batch.current_quantity)} /><Stat label="Initial" value={String(data.batch.initial_quantity)} /><Stat label="Location" value={data.batch.destination_label || "Unassigned"} /><Stat label="Session" value={data.session?.session_code ?? "—"} /></div>
          <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950"><Printer className="h-4 w-4" />Reprint label</button><span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-slate-300"><MapPin className="h-4 w-4" />{data.batch.destination_label}</span></div>
          {notice ? <p className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-sm text-cyan-100">{notice}</p> : null}
        </div>
        <aside className="label-sheet rounded-2xl border border-white/10 bg-white p-4 text-center text-slate-950"><p className="text-[10px] font-black uppercase tracking-[.2em]">Trading Docks</p><p className="mt-3 text-2xl font-black tracking-tight">{data.batch.batch_code}</p>{qr ? <img src={qr} alt={`QR code for ${data.batch.batch_code}`} className="mx-auto mt-3 h-32 w-32" /> : <div className="mx-auto mt-3 h-32 w-32 animate-pulse bg-slate-200" />}<p className="mt-3 text-sm font-bold">{data.batch.destination_label}</p><p className="mt-1 text-xs">{data.batch.current_quantity} / {data.batch.initial_quantity} cards</p><p className="mt-1 text-[10px] uppercase tracking-wide">{new Date(data.batch.created_at).toLocaleDateString()}</p></aside>
      </section>
      <section className="rounded-2xl border border-white/10 bg-[#06141e] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-cyan-300">Batch contents</p><h2 className="mt-1 text-xl font-semibold">Find and pick</h2></div><label className="relative block w-full sm:w-80"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search card, set, or number" className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-300/50" /></label></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Card</th><th className="px-3 py-3">Printing</th><th className="px-3 py-3">Condition</th><th className="px-3 py-3">Qty</th><th className="px-3 py-3" /></tr></thead><tbody>{filtered.map((position) => <tr key={position.id} className="border-t border-white/5"><td className="px-3 py-4 font-semibold text-white">{position.card_name}</td><td className="px-3 py-4 text-slate-400">{position.set_code ?? "—"} {position.collector_number ?? ""} · {position.finish ?? "Nonfoil"}</td><td className="px-3 py-4 text-slate-400">{position.condition ?? "—"}</td><td className="px-3 py-4 font-semibold tabular-nums text-cyan-100">{position.quantity}</td><td className="px-3 py-4 text-right"><button type="button" disabled={position.quantity < 1 || picking === position.id} onClick={() => void pick(position.id)} className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-40"><PackageCheck className="h-3.5 w-3.5" />{picking === position.id ? "Picking…" : "Pick 1"}</button></td></tr>)}</tbody></table>{!filtered.length ? <div className="py-10 text-center text-sm text-slate-500"><ScanLine className="mx-auto h-6 w-6" /><p className="mt-2">No matching cards in this batch.</p></div> : null}</div>
      </section>
    </div>
    <style>{`@media print { body * { visibility: hidden !important; } .label-sheet, .label-sheet * { visibility: visible !important; } .label-sheet { position: absolute; left: 0; top: 0; width: 3in; min-height: 2in; border: 0; } }`}</style>
  </main>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-100">{value}</p></div>; }
