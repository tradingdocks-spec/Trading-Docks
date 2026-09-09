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
    return <WorkspaceFrame><div className="rounded-[22px] border border-td-ink/[0.08] bg-td-surface p-8 text-center"><PackageOpen className="mx-auto h-8 w-8 text-td-muted" /><h1 className="mt-4 text-xl font-semibold text-td-primary">No cards to pick</h1><Link href="/dashboard/orders" className="mt-5 inline-flex h-11 items-center rounded-xl bg-td-accent px-4 text-sm font-bold text-td-on-accent">Back to Orders</Link></div></WorkspaceFrame>;
  }

  return <WorkspaceFrame><div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/dashboard/orders" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-td-secondary hover:text-td-primary"><ArrowLeft className="h-4 w-4" /> Orders</Link><span className="text-xs font-bold uppercase tracking-[.16em] text-td-muted">Pick mode · #{order.external_order_id}</span></div>
    <header className="rounded-[22px] border border-td-accent/[0.16] bg-[linear-gradient(135deg,rgb(var(--td-surface-rgb)/.98),rgb(var(--td-surface-rgb)/.98))] p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-td-accent-text">Order #{order.external_order_id}</p><h1 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-td-primary sm:text-3xl">Pick what is in front of you.</h1><p className="mt-2 text-sm text-td-secondary">{tasks.length} cards across {locations} physical location{locations === 1 ? "" : "s"} · sorted Shelf → Box → Divider</p></div><div className="text-left sm:text-right"><p className="text-2xl font-semibold text-td-primary">{pulled} / {tasks.length}</p><p className="text-xs font-bold uppercase tracking-[.14em] text-td-muted">pulled</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-td-accent transition-all" style={{ width: `${(pulled / tasks.length) * 100}%` }} /></div></header>
    {notice ? <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-td-warning/[0.16] bg-td-warning/[0.05] px-4 py-3 text-sm text-td-warning"><span>{notice}</span><Link href={`/dashboard/inventory?query=${encodeURIComponent(task?.title ?? "")}`} className="inline-flex min-h-9 items-center rounded-lg border border-td-warning/20 px-3 text-xs font-bold text-td-warning">Search inventory</Link><button type="button" onClick={() => setIndex((value) => Math.min(tasks.length - 1, value + 1))} className="inline-flex min-h-9 items-center rounded-lg bg-td-warning px-3 text-xs font-bold text-td-on-accent">Continue</button></div> : null}
    <main className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><section className="rounded-[24px] border border-td-ink/[0.08] bg-td-surface p-5 sm:p-8"><div className="flex items-center justify-between text-xs font-black uppercase tracking-[.16em] text-td-muted"><span>Card {index + 1} of {tasks.length}</span><span className={task?.state === "found" ? "text-td-success" : task?.state === "missing" ? "text-td-warning" : "text-td-accent-text"}>{task?.state}</span></div><div className="mt-6 grid gap-6 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center"><div className="grid aspect-[.72] place-items-center overflow-hidden rounded-2xl border border-td-ink/[0.08] bg-black/30">{task?.imageUrl ? <img src={task.imageUrl} alt="" className="h-full w-full object-cover" /> : <PackageOpen className="h-8 w-8 text-td-muted" />}</div><div><h2 className="text-3xl font-semibold tracking-[-.05em] text-td-primary">{task?.title}</h2><p className="mt-3 text-sm text-td-secondary">{[task?.condition, task?.language, task?.finish].filter(Boolean).join(" · ") || "Details unavailable"} · Qty {task?.quantity}</p><div className={`mt-6 rounded-2xl border p-5 ${task?.physicalLocation ? "border-td-accent/[0.18] bg-td-accent/[0.055]" : "border-td-warning/[0.18] bg-td-warning/[0.055]"}`}><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-td-secondary"><MapPin className="h-4 w-4" /> Location</div><p className={`mt-3 break-words text-2xl font-black tracking-[.04em] ${task?.physicalLocation ? "text-td-accent-text" : "text-td-warning"}`}>{task?.expectedLocationLabel}</p>{!task?.physicalLocation ? <p className="mt-2 text-xs leading-5 text-td-warning/70">LOCATION UNKNOWN. Do not invent a shelf, box, or divider.</p> : null}</div></div></div><div className="mt-8 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => markCurrent("found")} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-td-success px-5 text-base font-black text-td-on-accent transition hover:bg-td-success"><Check className="h-5 w-5" /> Found it</button><button type="button" onClick={() => markCurrent("missing")} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-td-warning/[0.3] bg-td-warning/[0.08] px-5 text-base font-black text-td-warning transition hover:bg-td-warning/[0.14]"><AlertTriangle className="h-5 w-5" /> Can't find</button></div><div className="mt-4 flex flex-wrap justify-between gap-2"><button type="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-td-ink/[0.08] px-4 text-sm font-semibold text-td-secondary disabled:opacity-30"><ArrowLeft className="h-4 w-4" /> Previous</button><button type="button" disabled={index === tasks.length - 1} onClick={() => setIndex((value) => Math.min(tasks.length - 1, value + 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-td-ink/[0.08] px-4 text-sm font-semibold text-td-secondary disabled:opacity-30">Next <ArrowRight className="h-4 w-4" /></button></div></section><aside className="space-y-4"><div className="rounded-[22px] border border-td-ink/[0.08] bg-td-surface p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-td-muted">Pick list</p><div className="mt-4 space-y-2">{tasks.map((entry, entryIndex) => <button key={entry.id} type="button" onClick={() => setIndex(entryIndex)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left ${entryIndex === index ? "border-td-accent/[0.3] bg-td-accent/[0.08]" : "border-td-ink/[0.06] bg-td-ink/[0.02]"}`}><span className="w-5 text-xs text-td-muted">{entryIndex + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-td-primary">{entry.title}</span><span className={`text-[11px] font-black uppercase ${entry.state === "found" ? "text-td-success" : entry.state === "missing" ? "text-td-warning" : "text-td-muted"}`}>{entry.state === "ready" ? "" : entry.state}</span></button>)}</div></div><div className="rounded-[22px] border border-td-ink/[0.08] bg-td-surface p-5 text-sm text-td-secondary"><div className="flex items-center gap-2 font-semibold text-td-primary"><Search className="h-4 w-4 text-td-accent-text" /> Exception handling</div><p className="mt-3 leading-6">Can't Find records an exception only. It never deletes inventory or reduces quantity.</p><p className="mt-3 text-xs text-td-muted">Shortcuts: F found · M missing · arrows navigate</p></div></aside></main>
  </div></WorkspaceFrame>;
}
