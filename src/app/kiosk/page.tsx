"use client";

import { useState } from "react";
import { MonitorSmartphone, Sparkles } from "lucide-react";
import { KioskExperience } from "@/components/showcase/KioskExperience";

export default function KioskPairPage() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("Front Counter");
  const [message, setMessage] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);

  async function pair() {
    setMessage("Pairing…");
    const response = await fetch("/api/showcase/kiosks/pair", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "consume", code, name }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error); return; }
    setPaired(true);
  }

  if (paired) return <KioskExperience />;
  return <main className="flex min-h-screen items-center justify-center bg-td-canvas px-4 text-td-primary"><section className="w-full max-w-md rounded-3xl border border-td-line bg-td-surface p-7 shadow-2xl"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-td-accent-subtle text-td-accent-text"><MonitorSmartphone /></div><p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-td-accent-text">Trading Docks Showcase</p><h1 className="mt-2 text-3xl font-semibold text-td-primary">Pair this counter device</h1><p className="mt-2 text-sm leading-6 text-td-muted">Generate a short-lived pairing code from Dashboard → Showcase → Kiosks, then enter it here.</p><label className="mt-6 block text-sm font-semibold text-td-secondary">Device name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-td-input-border bg-td-input px-3 py-3 text-td-primary outline-none focus-visible:ring-2 focus-visible:ring-td-focus" /></label><label className="mt-4 block text-sm font-semibold text-td-secondary">Pairing code<input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" placeholder="123 456" className="mt-2 w-full rounded-xl border border-td-input-border bg-td-input px-3 py-3 text-lg tracking-[.2em] text-td-primary outline-none placeholder:text-td-muted focus-visible:ring-2 focus-visible:ring-td-focus" /></label><button onClick={pair} className="td-button-primary mt-5 w-full py-3">Pair device</button>{message ? <p className="mt-4 text-center text-sm text-td-accent-text">{message}</p> : null}<p className="mt-7 flex items-center justify-center gap-2 text-xs text-td-muted"><Sparkles className="h-3.5 w-3.5" /> Restricted Showcase access only</p></section></main>;
}
