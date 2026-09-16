"use client";

import { useState } from "react";
import { Copy, ExternalLink, MonitorSmartphone, Plus, ShieldOff } from "lucide-react";

type Kiosk = {
  id: string;
  display_name: string;
  enabled: boolean;
  last_seen_at: string | null;
  revoked_at: string | null;
  paired_at: string;
};

type PairingResult = {
  deviceName?: string;
  pairingCode?: string;
  expiresAt?: string;
  error?: string;
};

export function KioskManagement({ initialKiosks }: { initialKiosks: Kiosk[] }) {
  const [kiosks, setKiosks] = useState(initialKiosks);
  const [pairing, setPairing] = useState<PairingResult | null>(null);
  const [name, setName] = useState("Front Counter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/showcase/kiosks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json() as PairingResult;
      if (!response.ok) {
        setError(result.error ?? "Unable to generate pairing code.");
        return;
      }
      setPairing(result);
    } catch {
      setError("Unable to reach the kiosk service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    const response = await fetch(`/api/showcase/kiosks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revoked: true }),
    });
    if (response.ok) {
      setKiosks((current) => current.map((item) => item.id === id
        ? { ...item, enabled: false, revoked_at: new Date().toISOString() }
        : item));
    }
  }

  return <main className="dashboard-responsive mx-auto max-w-[1000px] px-4 py-7 sm:px-7">
    <p className="text-xs font-bold uppercase tracking-[.18em] text-td-accent-text">Showcase · Devices</p>
    <h1 className="mt-3 text-3xl font-semibold text-td-primary">Kiosk devices</h1>
    <p className="mt-2 text-sm text-td-muted">Pair a restricted tablet session for the front counter. Kiosks never receive dashboard access.</p>
    <section className="mt-7 rounded-[24px] border border-td-accent/[.15] bg-td-accent/[.05] p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm font-semibold text-td-primary">New device name
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-td-ink/[.1] bg-td-canvas px-3 py-3 text-sm" />
        </label>
        <button disabled={busy} onClick={() => void generate()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-td-accent px-4 text-sm font-bold text-td-on-accent disabled:opacity-50">
          <Plus className="h-4 w-4" /> {busy ? "Generating…" : "Generate pairing code"}
        </button>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p> : null}
      {pairing?.pairingCode ? <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-emerald-100/70">Pair {pairing.deviceName ?? name}</p>
        <p className="mt-2 text-sm text-emerald-100/80">Enter this code on the kiosk device:</p>
        <strong className="mt-1 block text-3xl tracking-[.2em] text-emerald-100">{pairing.pairingCode}</strong>
        <p className="mt-2 text-xs text-emerald-100/70">Expires in 10 minutes · enter at /kiosk</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => navigator.clipboard?.writeText(pairing.pairingCode ?? "")} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold"><Copy className="h-3.5 w-3.5" /> Copy code</button>
          <a href="/kiosk" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold"><ExternalLink className="h-3.5 w-3.5" /> Open kiosk</a>
          <button onClick={() => setPairing(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold">Dismiss</button>
        </div>
      </div> : null}
    </section>
    <section className="mt-5 space-y-3">{kiosks.length ? kiosks.map((kiosk) => <article key={kiosk.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-td-ink/[.08] bg-td-surface/60 p-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-td-accent/[.08] text-td-accent-text"><MonitorSmartphone className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold text-td-primary">{kiosk.display_name}</p><p className="text-xs text-td-muted">{kiosk.revoked_at ? "Revoked" : kiosk.last_seen_at ? `Last seen ${new Date(kiosk.last_seen_at).toLocaleString()}` : "Paired · not seen yet"}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${kiosk.revoked_at ? "bg-rose-300/10 text-rose-200" : kiosk.enabled ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>{kiosk.revoked_at ? "Revoked" : kiosk.enabled ? "Active" : "Offline"}</span>{!kiosk.revoked_at ? <button onClick={() => void revoke(kiosk.id)} className="inline-flex items-center gap-2 rounded-xl border border-rose-300/15 px-3 py-2 text-xs font-semibold text-rose-200"><ShieldOff className="h-3.5 w-3.5" /> Revoke</button> : null}</article>) : <div className="rounded-2xl border border-dashed border-td-ink/[.12] p-8 text-center text-sm text-td-muted">No paired kiosks yet.</div>}</section>
  </main>;
}