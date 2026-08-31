"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, MapPin, PackageOpen, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceFrame } from "@/components/dashboard/common/WorkspaceFrame";
import type { OrderRecord } from "./UniversalOrdersCenter";
import { buildDeterministicPickTasks, markPickTask, pickLocationCount, type PickTask } from "@/lib/orders/pick-domain";

export function OrderPickWorkspace({ order }: { order: OrderRecord }) {
  const initialTasks = useMemo(() => buildDeterministicPickTasks(order.marketplace_order_items ?? []), [order.marketplace_order_items]);
  const [tasks, setTasks] = useState<PickTask[]>(initialTasks);
  const [index, setIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const task = tasks[index] ?? null;
  const pulled = tasks.filter((entry) => entry.state === "found").length;
  const locations = pickLocationCount(tasks);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1));
      if (event.key === "ArrowRight" || event.key === "Enter") setIndex((value) => Math.min(tasks.length - 1, value + 1));
      if (event.key.toLowerCase() === "f") markCurrent("found");
      if (event.key.toLowerCase() === "m") markCurrent("missing");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function markCurrent(state: "found" | "missing") {
    if (!task) return;
    setTasks((current) => markPickTask(current, task.id, state));
    setNotice(state === "found" ? "Marked found. Inventory quantity was not changed." : `Exception recorded: expected at ${task.expectedLocationLabel}. Inventory was not changed.`);
    if (state === "found" && index < tasks.length - 1) setIndex((value) => value + 1);
  }

  if (!tasks.length) {
    return <WorkspaceFrame><div className="rounded-[22px] border border-white/[0.08] bg-[#06121b] p-8 text-center"><PackageOpen className="mx-auto h-8 w-8 text-slate-500" /><h1 className="mt-4 text-xl font-semibold text-white">No cards to pick</h1><Link href="/dashboard/orders" className="mt-5 inline-flex h-11 items-center rounded-xl bg-cyan-300 px-4 text-sm font-bold text-[#00131c]">Back to Orders</Link></div></WorkspaceFrame>;
  }

  return <WorkspaceFrame><div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/dashboard/orders" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Orders</Link><span className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">Pick mode · #{order.external_order_id}</span></div>
    <header className="rounded-[22px] border border-cyan-300/[0.16] bg-[linear-gradient(135deg,rgba(7,31,45,.98),rgba(4,15,23,.98))] p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Order #{order.external_order_id}</p><h1 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-white sm:text-3xl">Pick what is in front of you.</h1><p className="mt-2 text-sm text-slate-400">{tasks.length} cards across {locations} physical location{locations === 1 ? "" : "s"} · sorted Shelf → Box → Divider</p></div><div className="text-left sm:text-right"><p className="text-2xl font-semibold text-white">{pulled} / {tasks.length}</p><p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500">pulled</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${(pulled / tasks.length) * 100}%` }} /></div></header>
    {notice ? <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/[0.16] bg-amber-300/[0.05] px-4 py-3 text-sm text-amber-100"><span>{notice}</span><Link href={`/dashboard/inventory?query=${encodeURIComponent(task?.title ?? "")}`} className="inline-flex min-h-9 items-center rounded-lg border border-amber-200/20 px-3 text-xs font-bold text-amber-50">Search inventory</Link><button type="button" onClick={() => setIndex((value) => Math.min(tasks.length - 1, value + 1))} className="inline-flex min-h-9 items-center rounded-lg bg-amber-200 px-3 text-xs font-bold text-[#1d1604]">Continue</button></div> : null}
    <main className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><section className="rounded-[24px] border border-white/[0.08] bg-[#06121b] p-5 sm:p-8"><div className="flex items-center justify-between text-xs font-black uppercase tracking-[.16em] text-slate-500"><span>Card {index + 1} of {tasks.length}</span><span className={task?.state === "found" ? "text-emerald-300" : task?.state === "missing" ? "text-amber-300" : "text-cyan-300"}>{task?.state}</span></div><div className="mt-6 grid gap-6 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center"><div className="grid aspect-[.72] place-items-center overflow-hidden rounded-2xl border border-white/[0.08] bg-black/30">{task?.imageUrl ? <img src={task.imageUrl} alt="" className="h-full w-full object-cover" /> : <PackageOpen className="h-8 w-8 text-slate-700" />}</div><div><h2 className="text-3xl font-semibold tracking-[-.05em] text-white">{task?.title}</h2><p className="mt-3 text-sm text-slate-400">{[task?.condition, task?.language, task?.finish].filter(Boolean).join(" · ") || "Details unavailable"} · Qty {task?.quantity}</p><div className={`mt-6 rounded-2xl border p-5 ${task?.physicalLocation ? "border-cyan-300/[0.18] bg-cyan-300/[0.055]" : "border-amber-300/[0.18] bg-amber-300/[0.055]"}`}><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-slate-400"><MapPin className="h-4 w-4" /> Location</div><p className={`mt-3 break-words text-2xl font-black tracking-[.04em] ${task?.physicalLocation ? "text-cyan-100" : "text-amber-100"}`}>{task?.expectedLocationLabel}</p>{!task?.physicalLocation ? <p className="mt-2 text-xs leading-5 text-amber-100/70">LOCATION UNKNOWN. Do not invent a shelf, box, or divider.</p> : null}</div></div></div><div className="mt-8 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => markCurrent("found")} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 text-base font-black text-[#03150f] transition hover:bg-emerald-300"><Check className="h-5 w-5" /> Found it</button><button type="button" onClick={() => markCurrent("missing")} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-amber-300/[0.3] bg-amber-300/[0.08] px-5 text-base font-black text-amber-100 transition hover:bg-amber-300/[0.14]"><AlertTriangle className="h-5 w-5" /> Can't find</button></div><div className="mt-4 flex flex-wrap justify-between gap-2"><button type="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.08] px-4 text-sm font-semibold text-slate-300 disabled:opacity-30"><ArrowLeft className="h-4 w-4" /> Previous</button><button type="button" disabled={index === tasks.length - 1} onClick={() => setIndex((value) => Math.min(tasks.length - 1, value + 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.08] px-4 text-sm font-semibold text-slate-300 disabled:opacity-30">Next <ArrowRight className="h-4 w-4" /></button></div></section><aside className="space-y-4"><div className="rounded-[22px] border border-white/[0.08] bg-[#06121b] p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Pick list</p><div className="mt-4 space-y-2">{tasks.map((entry, entryIndex) => <button key={entry.id} type="button" onClick={() => setIndex(entryIndex)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left ${entryIndex === index ? "border-cyan-300/[0.3] bg-cyan-300/[0.08]" : "border-white/[0.06] bg-white/[0.02]"}`}><span className="w-5 text-xs text-slate-600">{entryIndex + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">{entry.title}</span><span className={`text-[10px] font-black uppercase ${entry.state === "found" ? "text-emerald-300" : entry.state === "missing" ? "text-amber-300" : "text-slate-600"}`}>{entry.state === "ready" ? "" : entry.state}</span></button>)}</div></div><div className="rounded-[22px] border border-white/[0.08] bg-[#06121b] p-5 text-sm text-slate-400"><div className="flex items-center gap-2 font-semibold text-white"><Search className="h-4 w-4 text-cyan-300" /> Exception handling</div><p className="mt-3 leading-6">Can't Find records an exception only. It never deletes inventory or reduces quantity.</p><p className="mt-3 text-xs text-slate-600">Shortcuts: F found · M missing · arrows navigate</p></div></aside></main>
  </div></WorkspaceFrame>;
}
