"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bug,
  CheckCircle2,
  FileText,
  Lightbulb,
  Loader2,
  MessageSquareText,
  Paperclip,
  Search,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Item = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  submission_type: "feedback" | "bug" | "feature";
  title: string;
  description: string;
  page_url: string | null;
  severity: string | null;
  status: string;
  priority: string;
  admin_notes: string | null;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  attachment_count: number;
};
type Attachment = { id: string; file_name: string; storage_path: string; mime_type: string | null };

const STATUS_OPTIONS = ["new", "reviewing", "planned", "in_progress", "resolved", "closed"];
const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];

export function AdminFeedbackQueue() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_feedback_queue");
    const next = (data ?? []) as Item[];
    setItems(next);
    setSelectedId((current) => current || next[0]?.id || "");
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  useEffect(() => {
    if (!selectedId) { setAttachments([]); return; }
    void (async () => {
      const { data } = await supabase
        .from("feedback_attachments")
        .select("id,file_name,storage_path,mime_type")
        .eq("submission_id", selectedId);
      setAttachments((data ?? []) as Attachment[]);
    })();
  }, [selectedId, supabase]);

  const visible = items.filter((item) => {
    const matchesQuery = `${item.title} ${item.description} ${item.email} ${item.full_name ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "open" ? !["resolved", "closed"].includes(item.status) : item.submission_type === filter || item.status === filter);
    return matchesQuery && matchesFilter;
  });

  const stats = {
    open: items.filter((item) => !["resolved", "closed"].includes(item.status)).length,
    bugs: items.filter((item) => item.submission_type === "bug" && !["resolved", "closed"].includes(item.status)).length,
    features: items.filter((item) => item.submission_type === "feature" && !["resolved", "closed"].includes(item.status)).length,
    resolved: items.filter((item) => item.status === "resolved").length,
  };

  function patchLocal(patch: Partial<Item>) {
    setItems((current) => current.map((item) => item.id === selectedId ? { ...item, ...patch } : item));
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    const resolvedAt = selected.status === "resolved" ? new Date().toISOString() : null;
    const { error } = await supabase.from("feedback_submissions").update({
      status: selected.status,
      priority: selected.priority,
      admin_notes: selected.admin_notes,
      admin_response: selected.admin_response,
      resolved_at: resolvedAt,
      updated_at: new Date().toISOString(),
    }).eq("id", selected.id);
    setNotice(error ? `Could not save: ${error.message}` : "Submission updated.");
    window.setTimeout(() => setNotice(""), 3000);
    setSaving(false);
  }

  async function openAttachment(attachment: Attachment) {
    const { data } = await supabase.storage.from("feedback-attachments").createSignedUrl(attachment.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-td-accent-text/65">Product intelligence</p>
        <h2 className="mt-1 text-xl font-semibold text-td-primary">Feedback, Bugs & Feature Requests</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-td-muted">Review every customer submission with its account, attachments, priority, progress, internal notes, and customer-facing response.</p>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Open" value={stats.open} icon={MessageSquareText} />
        <Stat label="Active bugs" value={stats.bugs} icon={Bug} />
        <Stat label="Feature ideas" value={stats.features} icon={Lightbulb} />
        <Stat label="Resolved" value={stats.resolved} icon={CheckCircle2} />
      </div>

      <section className="grid min-h-[620px] overflow-hidden rounded-[24px] border border-td-ink/[0.07] bg-td-surface lg:grid-cols-[minmax(290px,.75fr)_minmax(0,1.25fr)]">
        <div className="border-b border-td-ink/[0.07] lg:border-b-0 lg:border-r">
          <div className="space-y-3 border-b border-td-ink/[0.06] p-4">
            <label className="flex h-10 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-black/15 px-3"><Search className="h-3.5 w-3.5 text-td-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requests or accounts…" className="min-w-0 flex-1 bg-transparent text-xs text-td-primary outline-none" /></label>
            <div className="flex gap-2 overflow-x-auto pb-1">{["open", "bug", "feature", "resolved", "all"].map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold capitalize ${filter === value ? "border-td-accent/20 bg-td-accent/[0.07] text-td-accent-text" : "border-td-ink/[0.07] text-td-muted"}`}>{value}</button>)}</div>
          </div>
          <div className="max-h-[520px] overflow-y-auto p-2">
            {loading ? <Loader2 className="mx-auto my-16 h-5 w-5 animate-spin text-td-accent-text" /> : visible.length ? visible.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`mb-1 w-full rounded-xl border p-3 text-left transition ${selectedId === item.id ? "border-td-accent/18 bg-td-accent/[0.055]" : "border-transparent hover:bg-td-ink/[0.025]"}`}><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold uppercase tracking-[0.15em] text-td-accent-text/55">{item.submission_type}</span><span className="text-[11px] capitalize text-td-muted">{item.status.replace("_", " ")}</span></div><p className="mt-1 truncate text-xs font-semibold text-td-primary">{item.title}</p><p className="mt-1 truncate text-[11px] text-td-muted">{item.email}</p></button>) : <p className="py-16 text-center text-xs text-td-muted">No matching submissions</p>}
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-6">
          {selected ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-td-accent-text/60">{selected.submission_type}{selected.severity ? ` · ${selected.severity} severity` : ""}</p><h3 className="mt-1 text-xl font-semibold text-td-primary">{selected.title}</h3><p className="mt-2 text-xs text-td-muted">{selected.full_name || "Unnamed account"} · {selected.email} · {new Date(selected.created_at).toLocaleString()}</p></div>
                <div className="flex gap-2"><select value={selected.priority} onChange={(event) => patchLocal({ priority: event.target.value })} className="h-10 rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-xs capitalize text-td-primary">{PRIORITY_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select><select value={selected.status} onChange={(event) => patchLocal({ status: event.target.value })} className="h-10 rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-xs capitalize text-td-primary">{STATUS_OPTIONS.map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select></div>
              </div>

              <div className="rounded-2xl border border-td-ink/[0.07] bg-black/10 p-4"><p className="whitespace-pre-wrap text-sm leading-6 text-td-secondary">{selected.description}</p>{selected.page_url ? <p className="mt-4 break-all text-[11px] text-td-muted">Submitted from: {selected.page_url}</p> : null}</div>

              {attachments.length ? <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">Attachments</p><div className="mt-2 flex flex-wrap gap-2">{attachments.map((attachment) => <button key={attachment.id} type="button" onClick={() => openAttachment(attachment)} className="flex items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.025] px-3 py-2 text-xs text-td-secondary hover:border-td-accent/20"><Paperclip className="h-3.5 w-3.5 text-td-accent-text/60" /><span className="max-w-56 truncate">{attachment.file_name}</span></button>)}</div></div> : null}

              <div className="grid gap-4 xl:grid-cols-2">
                <label className="grid gap-2"><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">Private admin notes</span><textarea rows={6} value={selected.admin_notes ?? ""} onChange={(event) => patchLocal({ admin_notes: event.target.value })} placeholder="Internal investigation, owner, reproduction steps…" className="rounded-xl border border-td-ink/[0.09] bg-black/15 p-3 text-xs leading-5 text-td-primary outline-none focus:border-td-accent/30" /></label>
                <label className="grid gap-2"><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">Response visible to customer</span><textarea rows={6} value={selected.admin_response ?? ""} onChange={(event) => patchLocal({ admin_response: event.target.value })} placeholder="Thank them, share the outcome, or ask for more detail…" className="rounded-xl border border-td-ink/[0.09] bg-black/15 p-3 text-xs leading-5 text-td-primary outline-none focus:border-td-accent/30" /></label>
              </div>
              <button type="button" disabled={saving} onClick={save} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-td-accent px-5 text-xs font-bold text-td-on-accent disabled:opacity-55">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Save review</button>
            </div>
          ) : <div className="flex min-h-[480px] items-center justify-center text-center"><div><MessageSquareText className="mx-auto h-6 w-6 text-td-muted" /><p className="mt-3 text-sm text-td-muted">Select a submission to review</p></div></div>}
        </div>
      </section>
      {notice ? <div role="status" className="fixed bottom-5 right-5 z-[160] rounded-xl border border-td-accent/15 bg-td-surface px-4 py-3 text-xs text-td-accent-text shadow-2xl">{notice}</div> : null}
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Bug }) {
  return <div className="rounded-[20px] border border-td-ink/[0.07] bg-td-surface p-4"><div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">{label}</p><Icon className="h-4 w-4 text-td-accent-text/50" /></div><p className="mt-3 text-xl font-semibold text-td-primary">{value}</p></div>;
}
