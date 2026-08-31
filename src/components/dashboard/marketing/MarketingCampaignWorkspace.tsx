"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MailCheck,
  Megaphone,
  Send,
  ShieldOff,
  Tags,
  Users,
} from "lucide-react";

import { getActiveWorkspaceContext } from "@/lib/active-workspace";
import {
  MARKETING_EMAIL_TEMPLATES,
  campaignReadiness,
  contactDisplayName,
  evaluateMarketingAudience,
  normalizeMarketingStatus,
  type MarketingAudienceRule,
  type MarketingContact,
} from "@/lib/marketing/campaigns";
import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

type MarketingView = "campaigns" | "audiences" | "templates" | "suppression";

type MarketingCampaignWorkspaceProps = {
  initialView?: MarketingView;
};

type CampaignForm = {
  name: string;
  subject: string;
  previewText: string;
  senderName: string;
  replyTo: string;
  content: string;
  tagFilter: string;
  manualContactIds: string[];
  audienceMode: MarketingAudienceRule["mode"];
};

const DEFAULT_FORM: CampaignForm = {
  name: "Weekly shop update",
  subject: "",
  previewText: "",
  senderName: "Trading Docks",
  replyTo: "",
  content: "",
  tagFilter: "",
  manualContactIds: [],
  audienceMode: "all_subscribed",
};

function formAudienceRule(form: CampaignForm): MarketingAudienceRule {
  if (form.audienceMode === "manual") return { mode: "manual", contactIds: form.manualContactIds };
  if (form.audienceMode === "tagged") {
    return {
      mode: "tagged",
      tags: form.tagFilter.split(",").map((tag) => tag.trim()).filter(Boolean),
    };
  }
  return { mode: "all_subscribed" };
}

export function MarketingCampaignWorkspace({ initialView = "campaigns" }: MarketingCampaignWorkspaceProps) {
  const [view, setView] = useState<MarketingView>(initialView);
  const [customers, setCustomers] = useState<MarketingContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<CampaignForm>(DEFAULT_FORM);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { supabase, workspaceId } = await getActiveWorkspaceContext();
        const { data, error: loadError } = await supabase
          .from("crm_customers")
          .select("id,workspace_id,first_name,last_name,email,tags,marketing_email_consent")
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false });
        if (loadError) throw loadError;
        if (mounted) setCustomers((data ?? []) as MarketingContact[]);
      } catch (caught) {
        if (mounted) setError(caught instanceof Error ? caught.message : "Marketing contacts could not be loaded.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const audienceRule = useMemo(() => formAudienceRule(form), [form]);
  const audience = useMemo(() => evaluateMarketingAudience(customers, audienceRule), [customers, audienceRule]);
  const readiness = useMemo(() => campaignReadiness({
    name: form.name,
    subject: form.subject,
    previewText: form.previewText,
    senderName: form.senderName,
    replyTo: form.replyTo,
    content: form.content,
    audience: audienceRule,
  }, audience), [form, audience, audienceRule]);
  const subscribedCount = customers.filter((contact) => normalizeMarketingStatus(contact) === "subscribed" && contact.email).length;
  const suppressedCount = customers.filter((contact) => normalizeMarketingStatus(contact) === "suppressed").length;
  const unknownCount = customers.filter((contact) => normalizeMarketingStatus(contact) === "unknown").length;
  const allTags = [...new Set(customers.flatMap((customer) => customer.tags ?? []))].sort((a, b) => a.localeCompare(b));

  async function sendTest() {
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/marketing/send-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaign: {
            name: form.name,
            subject: form.subject,
            previewText: form.previewText,
            senderName: form.senderName,
            replyTo: form.replyTo,
            content: form.content,
            audience: audienceRule,
          },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Test email could not be sent.");
      setNotice("Test email request accepted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Test email could not be sent.");
    }
  }

  async function queueCampaign() {
    setNotice("");
    setError("");
    if (!readiness.ready) {
      setError(readiness.reasons[0] ?? "Campaign is not ready to send.");
      return;
    }
    try {
      const response = await fetch("/api/marketing/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaign: {
            name: form.name,
            subject: form.subject,
            previewText: form.previewText,
            senderName: form.senderName,
            replyTo: form.replyTo,
            content: form.content,
            audience: audienceRule,
          },
          idempotencyKey: `campaign:${form.name}:${form.subject}:${audience.eligible.length}`,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Campaign could not be queued.");
      setNotice(body.message ?? "Campaign queued.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Campaign could not be queued.");
    }
  }

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Marketing"
        title="Consent-safe campaigns for your customer base."
        description="Build audiences from CRM contacts, review eligibility, keep unsubscribe and suppression rules intact, and prepare provider-backed sends without unsafe list blasting."
        icon={Megaphone}
      />
      {error ? <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs text-rose-200">{error}</div> : null}
      {notice ? <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-3 text-xs text-emerald-100">{notice}</div> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="CRM contacts" value={String(customers.length)} detail="Workspace scoped" icon={Users} />
        <MetricCard label="Eligible email reach" value={String(subscribedCount)} detail="Subscribed with email" icon={MailCheck} />
        <MetricCard label="Unknown consent" value={String(unknownCount)} detail="Excluded by default" icon={Clock3} />
        <MetricCard label="Suppressed" value={String(suppressedCount)} detail="Never marketed" icon={ShieldOff} />
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {([
          ["campaigns", "Campaigns"],
          ["audiences", "Audiences"],
          ["templates", "Templates"],
          ["suppression", "Suppression / Unsubscribes"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-semibold transition ${
              view === value
                ? "border-cyan-300/25 bg-cyan-300/[0.1] text-cyan-100"
                : "border-white/[0.07] bg-white/[0.02] text-slate-500 hover:border-white/[0.13] hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader2 className="mx-auto my-16 h-6 w-6 animate-spin text-cyan-300" />
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,.9fr)]">
          <section className={`${styles.glassPanel} rounded-[26px] p-4 sm:p-5`}>
            {view === "campaigns" ? (
              <CampaignBuilder
                form={form}
                setForm={setForm}
                audienceEligible={audience.eligible.length}
                allTags={allTags}
                contacts={customers}
              />
            ) : null}
            {view === "audiences" ? <AudienceExplorer contacts={customers} /> : null}
            {view === "templates" ? <TemplateLibrary onUseTemplate={(template) => { setForm({ ...form, subject: template.subject, previewText: template.previewText, content: template.body }); setView("campaigns"); }} /> : null}
            {view === "suppression" ? <SuppressionPanel contacts={customers} /> : null}
          </section>

          <aside className="space-y-5">
            <section className={`${styles.glassPanel} rounded-[22px] p-5`}>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <div>
                  <h2 className="text-sm font-semibold text-white">Final review</h2>
                  <p className="mt-1 text-[0.8rem] text-slate-500">No campaign can send until this review is clean.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <ReviewStat label="Eligible" value={audience.eligible.length} tone="emerald" />
                <ReviewStat label="Excluded" value={audience.totalExcluded} />
                <ReviewStat label="Missing email" value={audience.excluded.missing_email} />
                <ReviewStat label="Unknown" value={audience.excluded.unknown_consent} />
                <ReviewStat label="Unsubscribed" value={audience.excluded.unsubscribed} />
                <ReviewStat label="Suppressed" value={audience.excluded.suppressed} />
              </div>
              {readiness.reasons.length ? (
                <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-[11px] leading-5 text-amber-100">
                  <AlertTriangle className="mr-2 inline h-3.5 w-3.5" />
                  {readiness.reasons[0]}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-3 text-[11px] leading-5 text-emerald-100">
                  Campaign is ready for provider-backed test or queueing.
                </div>
              )}
              <div className="mt-4 grid gap-2">
                <button type="button" onClick={() => void sendTest()} className="td-button-secondary justify-center">
                  <MailCheck className="h-4 w-4" />
                  Send test email
                </button>
                <button type="button" disabled={!readiness.ready} onClick={() => void queueCampaign()} className="td-button-primary justify-center disabled:cursor-not-allowed disabled:opacity-50">
                  <Send className="h-4 w-4" />
                  Queue campaign
                </button>
              </div>
            </section>

            <section className={`${styles.glassPanel} rounded-[22px] p-5`}>
              <h2 className="text-sm font-semibold text-white">Campaign history</h2>
              <p className="mt-1 text-[0.8rem] leading-5 text-slate-500">
                Delivery records will populate from `marketing_campaigns` after the additive marketing migration and provider are configured. Analytics are not fabricated.
              </p>
              <div className="mt-4 rounded-xl border border-dashed border-white/[0.08] p-4 text-center text-xs text-slate-500">
                No campaign sends recorded in this workspace yet.
              </div>
            </section>
          </aside>
        </div>
      )}
    </WorkspaceFrame>
  );
}

function CampaignBuilder({
  form,
  setForm,
  audienceEligible,
  allTags,
  contacts,
}: {
  form: CampaignForm;
  setForm: (form: CampaignForm) => void;
  audienceEligible: number;
  allTags: string[];
  contacts: MarketingContact[];
}) {
  return (
    <div>
      <SectionTitle icon={Megaphone} title="Campaign builder" detail="Create one reviewed campaign for an eligible audience." />
      <div className="mt-5 grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Campaign name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <TextField label="Subject line" value={form.subject} onChange={(value) => setForm({ ...form, subject: value })} />
          <TextField label="Preview text" value={form.previewText} onChange={(value) => setForm({ ...form, previewText: value })} />
          <TextField label="Sender name" value={form.senderName} onChange={(value) => setForm({ ...form, senderName: value })} />
          <TextField label="Reply-to email" type="email" value={form.replyTo} onChange={(value) => setForm({ ...form, replyTo: value })} />
          <SelectField
            label="Audience"
            value={form.audienceMode}
            onChange={(value) => setForm({ ...form, audienceMode: value as CampaignForm["audienceMode"] })}
            options={[
              ["all_subscribed", "All subscribed contacts"],
              ["tagged", "Tagged contacts"],
              ["manual", "Manual selection"],
            ]}
          />
        </div>
        {form.audienceMode === "tagged" ? (
          <TextField label="Tags" placeholder={allTags.slice(0, 3).join(", ") || "VIP, local, commander"} value={form.tagFilter} onChange={(value) => setForm({ ...form, tagFilter: value })} />
        ) : null}
        {form.audienceMode === "manual" ? (
          <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Manual recipients</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {contacts.slice(0, 12).map((contact) => {
                const checked = form.manualContactIds.includes(contact.id);
                return (
                  <button key={contact.id} type="button" onClick={() => setForm({ ...form, manualContactIds: checked ? form.manualContactIds.filter((id) => id !== contact.id) : [...form.manualContactIds, contact.id] })} className={`rounded-xl border p-3 text-left text-xs transition ${checked ? "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100" : "border-white/[0.07] bg-white/[0.02] text-slate-400"}`}>
                    <span className="block font-semibold">{contactDisplayName(contact)}</span>
                    <span className="mt-1 block text-[10px] text-slate-600">{contact.email ?? "No email"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <label>
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">Email content</span>
          <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} rows={9} placeholder="Write a clear store update. The unsubscribe footer is attached by the send layer." className="workspace-input mt-2 w-full resize-none leading-6" />
        </label>
        <div className="rounded-2xl border border-cyan-300/[0.1] bg-cyan-300/[0.035] p-4 text-xs text-cyan-100">
          Audience preview: {audienceEligible.toLocaleString()} eligible recipient{audienceEligible === 1 ? "" : "s"} after consent, email, unsubscribe, and suppression checks.
        </div>
      </div>
    </div>
  );
}

function AudienceExplorer({ contacts }: { contacts: MarketingContact[] }) {
  const byStatus = contacts.reduce<Record<string, number>>((acc, contact) => {
    const status = normalizeMarketingStatus(contact);
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div>
      <SectionTitle icon={Users} title="Audiences" detail="Segments are built from CRM tags and consent status." />
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {(["subscribed", "unknown", "unsubscribed", "suppressed"] as const).map((status) => (
          <ReviewStat key={status} label={status} value={byStatus[status] ?? 0} tone={status === "subscribed" ? "emerald" : undefined} />
        ))}
      </div>
      <p className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs leading-5 text-slate-500">
        Future saved segments can add order history, game affinity, purchase recency, VIP status, and locality. This first pass only exposes filters backed by current CRM data.
      </p>
    </div>
  );
}

function TemplateLibrary({ onUseTemplate }: { onUseTemplate: (template: typeof MARKETING_EMAIL_TEMPLATES[number]) => void }) {
  return (
    <div>
      <SectionTitle icon={FileText} title="Templates" detail="Editable starting points for common store communications." />
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {MARKETING_EMAIL_TEMPLATES.map((template) => (
          <button key={template.id} type="button" onClick={() => onUseTemplate(template)} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-left transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.035]">
            <span className="block text-sm font-semibold text-white">{template.name}</span>
            <span className="mt-1 block text-xs text-slate-500">{template.subject}</span>
            <span className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Use template</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SuppressionPanel({ contacts }: { contacts: MarketingContact[] }) {
  const suppressed = contacts.filter((contact) => normalizeMarketingStatus(contact) === "suppressed");
  return (
    <div>
      <SectionTitle icon={ShieldOff} title="Suppression / unsubscribes" detail="Suppressed and unsubscribed contacts remain in CRM but are blocked from marketing sends." />
      <div className="mt-5 space-y-2">
        {suppressed.length ? suppressed.map((contact) => (
          <div key={contact.id} className="rounded-xl border border-rose-300/10 bg-rose-300/[0.035] p-3 text-xs text-rose-100">
            {contactDisplayName(contact)}
          </div>
        )) : <p className="rounded-xl border border-dashed border-white/[0.08] p-5 text-center text-xs text-slate-500">No suppressed contacts in the current CRM snapshot.</p>}
      </div>
      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        Public unsubscribe links are tokenized and do not require login. Transactional communication remains separate from marketing suppression.
      </p>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, detail }: { icon: typeof Megaphone; title: string; detail: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/[0.12] bg-cyan-300/[0.05] text-cyan-200">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="mt-1 text-[0.8rem] text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function ReviewStat({ label, value, tone }: { label: string; value: number; tone?: "emerald" }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone === "emerald" ? "text-emerald-300" : "text-white"}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label>
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="workspace-input mt-2 w-full placeholder:text-slate-700" />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[] }) {
  return (
    <label>
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="workspace-input mt-2 w-full appearance-none">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}
