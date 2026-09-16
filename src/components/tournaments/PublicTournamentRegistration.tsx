"use client";

import { useState } from "react";

type Tournament = {
  slug: string; name: string; game: string; format: string; starts_at: string | null; ends_at: string | null;
  entry_fee: number | null; location: string | null; description: string | null; prize_support: string | null;
  max_players: number | null; registration_deadline: string | null; decklist_required: boolean;
  waitlist_enabled: boolean; registration_locked_at: string | null;
};

export function PublicTournamentRegistration({ tournament, storeName, registeredCount, waitlistCount, registrationSource }: { tournament: Tournament; storeName: string; registeredCount: number; waitlistCount: number; registrationSource: "discord" | "qr" | "direct" }) {
  const [form, setForm] = useState({ playerName: "", email: "", phone: "", discordUsername: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status: string; position?: number } | null>(null);
  const [error, setError] = useState("");
  const remaining = tournament.max_players === null ? null : Math.max(0, tournament.max_players - registeredCount);
  const closed = tournament.registration_deadline ? new Date(tournament.registration_deadline) < new Date() : false;
  const locked = Boolean(tournament.registration_locked_at);
  const full = remaining === 0;
  const registrationLabel = locked || closed ? "Registration closed" : full ? tournament.waitlist_enabled ? "Join waitlist" : "Tournament full" : "Sign Up";

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(tournament.slug)}/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, source: registrationSource }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Registration could not be completed.");
      setResult({ status: data.registration?.registration_status ?? "registered", position: data.registration?.waitlist_position });
      setForm({ playerName: "", email: "", phone: "", discordUsername: "", notes: "" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Registration could not be completed."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-td-background px-4 py-8 text-td-primary sm:px-6 lg:py-14"><div className="mx-auto max-w-5xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-td-accent-text">{storeName}</p><div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-[28px] border border-td-ink/[.08] bg-td-surface p-6 shadow-[0_24px_80px_rgb(var(--td-shadow-rgb)/.12)] sm:p-9"><span className="inline-flex rounded-full border border-td-accent/25 bg-td-accent/[.08] px-3 py-1 text-xs font-bold text-td-accent-text">Tournament registration</span><h1 className="mt-5 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">{tournament.name}</h1><p className="mt-4 text-sm leading-6 text-td-muted">{tournament.description || "Join us for an in-store tournament."}</p><div className="mt-8 grid gap-4 sm:grid-cols-2"><Info label="Game / format" value={`${tournament.game} · ${tournament.format}`} /><Info label="When" value={tournament.starts_at ? new Date(tournament.starts_at).toLocaleString() : "Time to be announced"} /><Info label="Entry" value={tournament.entry_fee === null ? "Free" : `$${Number(tournament.entry_fee).toFixed(2)}`} /><Info label="Location" value={tournament.location || "Store location"} /><Info label="Prize support" value={tournament.prize_support || "To be announced"} /><Info label="Capacity" value={tournament.max_players === null ? `${registeredCount} registered` : `${registeredCount} / ${tournament.max_players} registered`} /></div>{tournament.decklist_required ? <p className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/[.06] px-4 py-3 text-sm text-amber-100">Decklist required for this event.</p> : null}<div className="mt-8 border-t border-td-ink/[.08] pt-6"><p className="text-lg font-semibold">{locked ? "Registration closed because this tournament has started." : closed ? "Registration closed." : full && !tournament.waitlist_enabled ? "Tournament full." : full ? "Join the waitlist." : remaining === null ? `${registeredCount} registered` : `${remaining} spot${remaining === 1 ? "" : "s"} remaining`}</p>{tournament.registration_deadline ? <p className="mt-1 text-sm text-td-muted">Registration deadline: {new Date(tournament.registration_deadline).toLocaleString()}</p> : null}{waitlistCount ? <p className="mt-1 text-sm text-td-muted">{waitlistCount} currently on the waitlist.</p> : null}</div></section><section className="rounded-[28px] border border-td-ink/[.08] bg-td-surface p-6 sm:p-8"><h2 className="text-2xl font-semibold">{registrationLabel}</h2>{result ? <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.06] p-4 text-sm text-emerald-100">{result.status === "waitlisted" ? `You are on the waitlist${result.position ? ` at position ${result.position}` : ""}.` : "You are registered. We’ll see you there!"}</div> : null}{error ? <div role="alert" className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-300/[.06] p-4 text-sm text-rose-100">{error}</div> : null}{locked ? <p className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-4 text-sm text-amber-100">Registration is closed because this tournament has started.</p> : <form onSubmit={submit} className="mt-6 space-y-4"><Field label="Player name" required value={form.playerName} onChange={(value) => setForm({ ...form, playerName: value })} /><Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><Field label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><Field label="Discord username" value={form.discordUsername} onChange={(value) => setForm({ ...form, discordUsername: value })} /><label className="block text-sm font-medium text-td-secondary">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength={500} className="mt-2 min-h-24 w-full rounded-xl border border-td-ink/[.12] bg-td-background px-3 py-2 text-sm text-td-primary outline-none focus:border-td-accent" /></label><button type="submit" disabled={busy || closed || (full && !tournament.waitlist_enabled)} className="h-11 w-full rounded-xl bg-td-accent text-sm font-bold text-td-on-accent disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Submitting…" : registrationLabel}</button></form>}<p className="mt-5 text-xs leading-5 text-td-muted">Your contact details are shared with {storeName} for event operations and are not displayed publicly.</p></section></div></div></main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-[.12em] text-td-muted">{label}</p><p className="mt-1 text-sm text-td-secondary">{value}</p></div>; }
function Field({ label, required, type = "text", value, onChange }: { label: string; required?: boolean; type?: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-medium text-td-secondary">{label}{required ? " *" : ""}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-td-ink/[.12] bg-td-background px-3 text-sm text-td-primary outline-none focus:border-td-accent" /></label>; }
