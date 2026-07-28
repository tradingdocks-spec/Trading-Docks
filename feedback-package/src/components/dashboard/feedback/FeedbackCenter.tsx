"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bug,
  CheckCircle2,
  FileImage,
  Lightbulb,
  Loader2,
  MessageSquareText,
  Paperclip,
  Send,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Kind = "feedback" | "bug" | "feature";
type Submission = {
  id: string;
  submission_type: Kind;
  title: string;
  description: string;
  status: string;
  admin_response: string | null;
  created_at: string;
};

const TYPES = [
  { id: "feedback" as const, label: "Provide feedback", detail: "Tell us what works and what could feel better.", icon: MessageSquareText },
  { id: "bug" as const, label: "Report a bug", detail: "Show us something that is broken or behaving unexpectedly.", icon: Bug },
  { id: "feature" as const, label: "Request a feature", detail: "Suggest a new tool, workflow, or improvement.", icon: Lightbulb },
];

const STATUS_STYLE: Record<string, string> = {
  new: "border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-200",
  reviewing: "border-amber-300/20 bg-amber-300/[0.07] text-amber-200",
  planned: "border-violet-300/20 bg-violet-300/[0.07] text-violet-200",
  in_progress: "border-blue-300/20 bg-blue-300/[0.07] text-blue-200",
  resolved: "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200",
  closed: "border-white/10 bg-white/[0.04] text-slate-400",
};

export function FeedbackCenter({ userId, userEmail }: { userId: string; userEmail: string }) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>("feedback");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [files, setFiles] = useState<File[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadSubmissions = useCallback(async () => {
    const { data } = await supabase
      .from("feedback_submissions")
      .select("id,submission_type,title,description,status,admin_response,created_at")
      .order("created_at", { ascending: false });
    setSubmissions((data ?? []) as Submission[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void loadSubmissions(); }, [loadSubmissions]);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = Array.from(incoming).filter((file) => file.size <= 10 * 1024 * 1024);
    setFiles((current) => [...current, ...next].slice(0, 5));
  }

  async function submit() {
    if (title.trim().length < 3 || description.trim().length < 10) {
      setError("Add a short title and enough detail for us to understand the request.");
      return;
    }
    setSending(true);
    setError("");
    const { data, error: insertError } = await supabase
      .from("feedback_submissions")
      .insert({
        user_id: userId,
        submission_type: kind,
        title: title.trim(),
        description: description.trim(),
        severity: kind === "bug" ? severity : null,
        page_url: window.location.href,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "The submission could not be saved.");
      setSending(false);
      return;
    }

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${userId}/${data.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("feedback-attachments").upload(path, file);
      if (uploadError) {
        setError(`Your message was saved, but ${file.name} could not be uploaded.`);
        continue;
      }
      await supabase.from("feedback_attachments").insert({
        submission_id: data.id,
        user_id: userId,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      });
    }

    setTitle("");
    setDescription("");
    setFiles([]);
    setNotice("Thank you—your submission is now in the Trading Docks review queue.");
    window.setTimeout(() => setNotice(""), 4500);
    await loadSubmissions();
    setSending(false);
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#02090f] px-4 py-6 sm:px-7 lg:px-9">
      <div className="mx-auto max-w-[1380px] space-y-6">
        <header className="overflow-hidden rounded-[28px] border border-cyan-300/[0.1] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.09),transparent_36%),#06121b] p-5 sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/70">Help shape Trading Docks</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">Feedback Center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Share an idea, report a problem, or request a feature. Your account is attached automatically so we can follow up and keep you updated.</p>
          <p className="mt-3 text-[11px] text-slate-600">Submitting as {userEmail}</p>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
          <section className="rounded-[26px] border border-white/[0.07] bg-[#06121b] p-4 sm:p-6">
            <div className="grid gap-3 md:grid-cols-3">
              {TYPES.map((item) => {
                const Icon = item.icon;
                const active = kind === item.id;
                return (
                  <button key={item.id} type="button" onClick={() => setKind(item.id)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-cyan-300/25 bg-cyan-300/[0.075]" : "border-white/[0.07] bg-black/10 hover:border-white/[0.13]"}`}>
                    <Icon className={`h-5 w-5 ${active ? "text-cyan-200" : "text-slate-500"}`} />
                    <p className="mt-3 text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.detail}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid gap-4">
              <Field label="Short title">
                <input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 140))} placeholder={kind === "bug" ? "Example: CSV export button does not respond" : "Summarize your idea"} className="h-12 w-full rounded-xl border border-white/[0.09] bg-black/15 px-4 text-sm text-white outline-none focus:border-cyan-300/35" />
              </Field>
              {kind === "bug" ? (
                <Field label="How serious is it?">
                  <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#07141e] px-4 text-sm text-white outline-none focus:border-cyan-300/35">
                    <option value="low">Minor issue</option><option value="medium">Affects my workflow</option><option value="high">Feature is unusable</option><option value="critical">Data loss or security concern</option>
                  </select>
                </Field>
              ) : null}
              <Field label={kind === "bug" ? "What happened?" : "Tell us more"}>
                <textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 10000))} rows={8} placeholder={kind === "bug" ? "What were you trying to do? What did you expect, and what happened instead?" : "Describe the idea, who it would help, and how you imagine it working."} className="w-full resize-y rounded-xl border border-white/[0.09] bg-black/15 p-4 text-sm leading-6 text-white outline-none focus:border-cyan-300/35" />
              </Field>

              <div>
                <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Attachments</p><p className="text-[10px] text-slate-700">Up to 5 files · 10 MB each</p></div>
                <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 flex min-h-24 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.11] bg-black/10 text-sm text-slate-400 transition hover:border-cyan-300/25 hover:text-cyan-200">
                  <Paperclip className="h-5 w-5" /> Add screenshots, photos, PDFs, or notes
                </button>
                <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain" onChange={(event) => addFiles(event.target.files)} className="hidden" />
                {files.length ? <div className="mt-3 grid gap-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2"><FileImage className="h-4 w-4 text-cyan-300/70" /><span className="min-w-0 flex-1 truncate text-xs text-slate-300">{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}><X className="h-4 w-4 text-slate-600" /></button></div>)}</div> : null}
              </div>

              {error ? <p role="alert" className="rounded-xl border border-red-300/15 bg-red-300/[0.05] px-4 py-3 text-xs text-red-200">{error}</p> : null}
              <button type="button" disabled={sending} onClick={submit} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 text-sm font-bold text-[#03202a] transition hover:bg-cyan-200 disabled:opacity-55">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to Trading Docks
              </button>
            </div>
          </section>

          <section className="h-fit rounded-[26px] border border-white/[0.07] bg-[#06121b] p-4 sm:p-6">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300/65">Your submissions</p><h2 className="mt-1 text-lg font-semibold text-white">Track progress</h2></div><span className="rounded-full border border-white/[0.08] bg-black/15 px-2.5 py-1 text-[10px] text-slate-500">{submissions.length}</span></div>
            <div className="mt-5 space-y-3">
              {loading ? <Loader2 className="mx-auto my-12 h-5 w-5 animate-spin text-cyan-300" /> : submissions.length ? submissions.map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">{item.submission_type}</p><h3 className="mt-1 text-sm font-semibold text-slate-100">{item.title}</h3></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${STATUS_STYLE[item.status] ?? STATUS_STYLE.new}`}>{item.status.replace("_", " ")}</span></div>
                  <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-slate-500">{item.description}</p>
                  {item.admin_response ? <div className="mt-3 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] p-3"><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-cyan-300/60">Trading Docks response</p><p className="mt-1 text-[11px] leading-5 text-slate-300">{item.admin_response}</p></div> : null}
                  <p className="mt-3 text-[9px] text-slate-700">{new Date(item.created_at).toLocaleDateString()}</p>
                </article>
              )) : <div className="rounded-2xl border border-dashed border-white/[0.08] py-12 text-center"><CheckCircle2 className="mx-auto h-5 w-5 text-slate-700" /><p className="mt-2 text-xs text-slate-500">No submissions yet</p></div>}
            </div>
          </section>
        </div>
      </div>
      {notice ? <div role="status" className="fixed bottom-24 right-5 z-[160] max-w-sm rounded-xl border border-emerald-300/15 bg-[#09201b] px-4 py-3 text-xs text-emerald-100 shadow-2xl md:bottom-5">{notice}</div> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>{children}</label>;
}
