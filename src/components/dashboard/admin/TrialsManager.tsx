"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  MailPlus,
  RefreshCw,
  Search,
  Send,
  TicketCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type TrialStatus = "scheduled" | "active" | "expired" | "converted" | "revoked";
type Trial = {
  id: string;
  email: string;
  plan_id: string;
  status: TrialStatus;
  starts_at: string;
  ends_at: string;
  activated_at: string | null;
  last_active_at: string | null;
  usage_events: number;
  converted_at: string | null;
  notes: string;
  invitation_status: "not_sent" | "pending" | "sent" | "failed";
  invitation_sent_at: string | null;
  invitation_error: string;
};

const statusStyles: Record<TrialStatus, string> = {
  scheduled: "border-td-accent/15 bg-td-accent/[0.05] text-td-accent-text",
  active: "border-td-success/15 bg-td-success/[0.05] text-td-success",
  expired: "border-td-ink/[0.08] bg-td-ink/[0.025] text-td-muted",
  converted: "border-td-violet/15 bg-td-violet/[0.05] text-td-violet",
  revoked: "border-td-danger/15 bg-td-danger/[0.05] text-td-danger",
};

function plusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function TrialsManager() {
  const supabase = useMemo(() => createClient(), []);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("collector");
  const [endsOn, setEndsOn] = useState(() => plusDays(14));
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TrialStatus>("all");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Trial | null>(null);
  const [notice, setNotice] = useState("");
  const [renderedAt] = useState(() => Date.now());

  const loadTrials = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("account_trials")
      .select("id,email,plan_id,status,starts_at,ends_at,activated_at,last_active_at,usage_events,converted_at,notes,invitation_status,invitation_sent_at,invitation_error")
      .order("created_at", { ascending: false });
    if (error) setNotice(`Could not load trials: ${error.message}`);
    else setTrials((data ?? []) as Trial[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // The first database read intentionally initializes this client-only workspace.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTrials();
  }, [loadTrials]);

  async function grantTrial(event: React.FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setNotice("Enter a valid customer email.");
      return;
    }
    const end = new Date(`${endsOn}T23:59:59`);
    if (Number.isNaN(end.getTime()) || end <= new Date()) {
      setNotice("Choose an expiration date in the future.");
      return;
    }
    setWorking("create");
    const response = await fetch("/api/admin/trials/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "grant",
        email: normalizedEmail,
        planId: plan,
        endsAt: end.toISOString(),
        notes: notes.trim(),
      }),
    });
    const result = (await response.json()) as { trialGranted?: boolean; error?: string };
    if (!response.ok) {
      setNotice(result.error ?? "Could not grant the trial and send its invitation.");
      if (result.trialGranted) await loadTrials();
    } else {
      setEmail("");
      setNotes("");
      setEndsOn(plusDays(14));
      setNotice(`Trial granted and invitation sent to ${normalizedEmail}.`);
      await loadTrials();
    }
    setWorking("");
  }

  async function resendInvitation(trial: Trial) {
    setWorking(`invite-${trial.id}`);
    const response = await fetch("/api/admin/trials/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resend", trialId: trial.id }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) setNotice(result.error ?? "Could not resend the invitation.");
    else {
      setNotice(`Invitation resent to ${trial.email}.`);
      await loadTrials();
    }
    setWorking("");
  }

  async function updateTrial(id: string, patch: Partial<Trial>, action: string) {
    setWorking(id);
    const { error } = await supabase.from("account_trials").update(patch).eq("id", id);
    if (error) setNotice(`Could not ${action}: ${error.message}`);
    else {
      setNotice(`Trial ${action}.`);
      await loadTrials();
    }
    setWorking("");
  }

  async function deleteTrial(trial: Trial) {
    setWorking(`delete-${trial.id}`);
    const { error } = await supabase.from("account_trials").delete().eq("id", trial.id);
    if (error) {
      setNotice(`Could not delete trial: ${error.message}`);
    } else {
      setConfirmDelete(null);
      setNotice(`Trial for ${trial.email} was permanently deleted.`);
      await loadTrials();
    }
    setWorking("");
  }

  const visibleTrials = trials.filter((trial) => {
    const matchesQuery = `${trial.email} ${trial.plan_id} ${trial.notes}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (statusFilter === "all" || trial.status === statusFilter);
  });
  const active = trials.filter((trial) => trial.status === "active").length;
  const converted = trials.filter((trial) => trial.status === "converted").length;
  const totalUsage = trials.reduce((sum, trial) => sum + trial.usage_events, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TrialStat label="Active trials" value={String(active)} icon={TicketCheck} />
        <TrialStat label="Total granted" value={String(trials.length)} icon={Users} />
        <TrialStat label="Conversions" value={String(converted)} icon={CheckCircle2} />
        <TrialStat label="Tracked activity" value={String(totalUsage)} icon={RefreshCw} />
      </div>

      <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-td-warning/15 bg-td-warning/[0.055] text-td-warning"><MailPlus className="h-5 w-5" /></div>
          <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-td-warning/65">Complimentary access</p><h2 className="mt-1 text-xl font-semibold text-td-primary">Grant a free trial & send invitation</h2><p className="mt-1 text-xs text-td-muted">Sends a branded signup email. Access attaches automatically when the invited email creates an account.</p></div>
        </div>
        <form onSubmit={grantTrial} className="mt-6 grid gap-4 xl:grid-cols-[minmax(240px,1.4fr)_180px_180px_minmax(220px,1fr)_auto] xl:items-end">
          <Field label="Customer email"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="customer@example.com" className="admin-input" /></Field>
          <Field label="Trial plan"><select value={plan} onChange={(event) => setPlan(event.target.value)} className="admin-input"><option value="collector">Collector</option><option value="seller">Seller</option><option value="store">Store</option></select></Field>
          <Field label="Expires"><input type="date" value={endsOn} min={plusDays(1)} onChange={(event) => setEndsOn(event.target.value)} className="admin-input" /></Field>
          <Field label="Internal note"><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Promotion, beta tester, support…" className="admin-input" /></Field>
          <button disabled={working === "create"} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-td-warning px-5 text-xs font-bold text-td-on-accent transition hover:bg-td-warning disabled:opacity-50">{working === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Grant & send</button>
        </form>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-td-ink/[0.07] bg-td-surface">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-td-ink/[0.06] p-5">
          <div><h2 className="text-lg font-semibold text-td-primary">Trial directory</h2><p className="mt-1 text-xs text-td-muted">Monitor access, activity, expiration, and conversions.</p></div>
          <div className="flex flex-wrap gap-2">
            <label className="flex h-10 min-w-56 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-black/15 px-3"><Search className="h-3.5 w-3.5 text-td-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search email or notes…" className="min-w-0 flex-1 bg-transparent text-xs text-td-primary outline-none placeholder:text-td-muted" /></label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-10 rounded-xl border border-td-ink/[0.08] bg-td-surface px-3 text-xs text-td-secondary outline-none"><option value="all">All statuses</option><option value="active">Active</option><option value="scheduled">Scheduled</option><option value="expired">Expired</option><option value="converted">Converted</option><option value="revoked">Revoked</option></select>
          </div>
        </div>
        {loading ? <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-td-accent-text" /></div> : visibleTrials.length ? (
          <div className="divide-y divide-td-ink/[0.055]">
            {visibleTrials.map((trial) => {
              const busy = working === trial.id || working === `invite-${trial.id}` || working === `delete-${trial.id}`;
              const daysLeft = Math.max(0, Math.ceil((new Date(trial.ends_at).getTime() - renderedAt) / 86_400_000));
              return <div key={trial.id} className="grid gap-4 p-5 hover:bg-td-ink/[0.012] xl:grid-cols-[minmax(230px,1.3fr)_130px_150px_150px_minmax(250px,auto)] xl:items-center">
                <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-td-primary">{trial.email}</p><span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${statusStyles[trial.status]}`}>{trial.status}</span><span title={trial.invitation_error || undefined} className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${trial.invitation_status === "sent" ? "border-td-accent/15 bg-td-accent/[0.05] text-td-accent-text" : trial.invitation_status === "failed" ? "border-td-danger/15 bg-td-danger/[0.05] text-td-danger" : "border-td-ink/[0.08] bg-td-ink/[0.025] text-td-muted"}`}>Email {trial.invitation_status.replace("_", " ")}</span></div><p className="mt-1 text-[11px] text-td-muted">{trial.notes || "No internal note"}{trial.invitation_sent_at ? ` · Sent ${new Date(trial.invitation_sent_at).toLocaleDateString()}` : ""}</p></div>
                <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">Access</p><p className="mt-1 text-xs font-semibold capitalize text-td-secondary">{trial.plan_id}</p></div>
                <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">Expiration</p><p className="mt-1 text-xs text-td-secondary">{new Date(trial.ends_at).toLocaleDateString()} <span className="text-td-muted">· {daysLeft}d</span></p></div>
                <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">Usage</p><p className="mt-1 text-xs text-td-secondary">{trial.usage_events} events</p><p className="mt-0.5 text-[11px] text-td-muted">{trial.last_active_at ? `Last ${new Date(trial.last_active_at).toLocaleDateString()}` : "No activity yet"}</p></div>
                <div className="flex flex-wrap gap-2">
                  {["active", "scheduled"].includes(trial.status) ? <button disabled={busy} onClick={() => void resendInvitation(trial)} className="trial-action"><Send className="h-3.5 w-3.5" /> Resend invitation</button> : null}
                  {trial.status === "active" ? <button disabled={busy} onClick={() => void updateTrial(trial.id, { ends_at: new Date(new Date(trial.ends_at).getTime() + 7 * 86_400_000).toISOString() }, "extended 7 days")} className="trial-action"><CalendarClock className="h-3.5 w-3.5" /> +7 days</button> : null}
                  {trial.status === "active" ? <button disabled={busy} onClick={() => void updateTrial(trial.id, { status: "converted", converted_at: new Date().toISOString() }, "marked converted")} className="trial-action"><CheckCircle2 className="h-3.5 w-3.5" /> Converted</button> : null}
                  {trial.status === "active" ? <button disabled={busy} onClick={() => void updateTrial(trial.id, { status: "revoked" }, "revoked")} className="trial-action text-td-danger"><Ban className="h-3.5 w-3.5" /> Revoke</button> : null}
                  <button disabled={busy} onClick={() => setConfirmDelete(trial)} className="trial-action trial-delete"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin text-td-accent-text" /> : null}
                </div>
              </div>;
            })}
          </div>
        ) : <div className="flex min-h-52 items-center justify-center text-center"><div><Clock3 className="mx-auto h-6 w-6 text-td-muted" /><p className="mt-3 text-sm font-semibold text-td-secondary">No matching trials</p><p className="mt-1 text-xs text-td-muted">Grant a trial above or change the filters.</p></div></div>}
      </section>
      {confirmDelete ? (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-td-canvas/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-trial-title">
          <div className="w-full max-w-md rounded-[24px] border border-td-danger/15 bg-td-surface p-6 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-td-danger/15 bg-td-danger/[0.06] text-td-danger"><Trash2 className="h-5 w-5" /></div>
              <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-lg p-2 text-td-muted transition hover:bg-td-ink/[0.05] hover:text-td-secondary" aria-label="Close delete confirmation"><X className="h-4 w-4" /></button>
            </div>
            <h3 id="delete-trial-title" className="mt-5 text-xl font-semibold text-td-primary">Delete this free trial?</h3>
            <p className="mt-2 text-sm leading-6 text-td-secondary">This permanently removes the trial for <strong className="font-semibold text-td-primary">{confirmDelete.email}</strong> and its recorded usage history. This cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} className="h-10 rounded-xl border border-td-ink/[0.09] px-4 text-xs font-semibold text-td-secondary transition hover:bg-td-ink/[0.04]">Keep trial</button>
              <button type="button" disabled={working === `delete-${confirmDelete.id}`} onClick={() => void deleteTrial(confirmDelete)} className="flex h-10 items-center gap-2 rounded-xl bg-td-danger px-4 text-xs font-bold text-td-on-accent transition hover:bg-td-danger disabled:opacity-50">
                {working === `delete-${confirmDelete.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Permanently delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {notice ? <div role="status" className="fixed bottom-5 right-5 z-[160] max-w-sm rounded-xl border border-td-accent/15 bg-td-surface px-4 py-3 text-xs text-td-accent-text shadow-2xl">{notice}</div> : null}
      <style jsx>{`
        :global(.admin-input) { height: 44px; width: 100%; border-radius: 12px; border: 1px solid rgb(var(--td-ink-rgb)/.08); background: var(--td-surface-default); padding: 0 12px; color: var(--td-text-primary); font-size: 12px; outline: none; }
        :global(.admin-input:focus) { border-color: rgb(var(--td-accent-rgb)/.28); box-shadow: 0 0 0 4px rgb(var(--td-accent-rgb)/.04); }
        :global(.trial-action) { display: inline-flex; height: 34px; align-items: center; gap: 6px; border-radius: 9px; border: 1px solid rgb(var(--td-ink-rgb)/.08); background: rgb(var(--td-ink-rgb)/.025); padding: 0 10px; font-size: 10px; font-weight: 600; color: var(--td-text-secondary); transition: background .15s; }
        :global(.trial-action:hover) { background: rgb(var(--td-ink-rgb)/.055); }
        :global(.trial-action:disabled) { opacity: .45; }
        :global(.trial-delete) { border-color: rgba(252,165,165,.10); color: var(--td-danger); }
        :global(.trial-delete:hover) { border-color: rgba(252,165,165,.20); background: rgba(248,113,113,.07); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">{label}</span>{children}</label>;
}

function TrialStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof TicketCheck }) {
  return <div className="rounded-[22px] border border-td-ink/[0.07] bg-td-surface p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-td-muted">{label}</p><Icon className="h-4 w-4 text-td-warning/60" /></div><p className="mt-4 text-2xl font-semibold text-td-primary">{value}</p></div>;
}

