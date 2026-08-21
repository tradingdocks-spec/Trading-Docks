"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign, Building2, Check, ChevronDown, ChevronRight, ContactRound, Gift, History,
  Loader2, Mail, MessageSquareText, Pencil, Plus, Search, ShieldCheck,
  Sparkles, Star, Trash2, UserRound, Users, X,
} from "lucide-react";
import { getActiveWorkspaceContext } from "@/lib/active-workspace";
import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

type Customer = {
  id: string; first_name: string; last_name: string; email: string | null; phone: string | null;
  notes: string | null; tags: string[]; marketing_email_consent: boolean; marketing_sms_consent: boolean;
  store_credit_cents: number; loyalty_points: number; lifetime_spend_cents: number; order_count: number;
  last_purchase_at: string | null; created_at: string; customer_type?: "individual" | "business"; customer_source?: string;
};
type LedgerEntry = { id: string; entry_type: "credit" | "points"; amount: number; reason: string; created_at: string };
type LoyaltyConfig = { enabled: boolean; points_per_dollar: number; reward_points: number; reward_value_cents: number };
type CustomerForm = { first_name: string; last_name: string; email: string; phone: string; notes: string; tags: string[]; tagDraft: string; customer_type: "individual" | "business"; customer_source: string; marketing_email_consent: boolean; marketing_sms_consent: boolean };
type DirectoryFilter = "all" | "marketing" | "credit" | "loyalty";

const emptyForm: CustomerForm = { first_name: "", last_name: "", email: "", phone: "", notes: "", tags: [], tagDraft: "", customer_type: "individual", customer_source: "walk_in", marketing_email_consent: false, marketing_sms_consent: false };
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const initials = (customer: Customer) => `${customer.first_name[0] ?? ""}${customer.last_name[0] ?? ""}`.toUpperCase();

export function CustomerCrmWorkspace() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [query, setQuery] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [adjustment, setAdjustment] = useState({ type: "credit" as "credit" | "points", amount: "", reason: "" });
  const [loyalty, setLoyalty] = useState<LoyaltyConfig>({ enabled: true, points_per_dollar: 1, reward_points: 100, reward_value_cents: 500 });

  async function loadCustomers() {
    setLoading(true); setError("");
    try {
      const { supabase, workspaceId } = await getActiveWorkspaceContext();
      const [{ data, error: loadError }, { data: loyaltyData }] = await Promise.all([
        supabase.from("crm_customers").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }),
        supabase.from("crm_loyalty_programs").select("enabled,points_per_dollar,reward_points,reward_value_cents").eq("workspace_id", workspaceId).maybeSingle(),
      ]);
      if (loadError) throw loadError;
      setCustomers((data ?? []) as Customer[]);
      if (loyaltyData) setLoyalty(loyaltyData as LoyaltyConfig);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Customer records could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadCustomers(); }, []);

  async function loadLedger(customerId: string) {
    const { supabase, workspaceId } = await getActiveWorkspaceContext();
    const { data } = await supabase.from("crm_customer_ledger").select("id,entry_type,amount,reason,created_at").eq("workspace_id", workspaceId).eq("customer_id", customerId).order("created_at", { ascending: false }).limit(50);
    setLedger((data ?? []) as LedgerEntry[]);
  }

  function openNewCustomer() { setEditingId(null); setForm(emptyForm); setNotesOpen(false); setDuplicateWarning(""); setEditorOpen(true); }
  function openEdit(customer: Customer) {
    setEditingId(customer.id);
    setForm({ first_name: customer.first_name, last_name: customer.last_name, email: customer.email ?? "", phone: customer.phone ?? "", notes: customer.notes ?? "", tags: customer.tags, tagDraft: "", customer_type: customer.customer_type ?? "individual", customer_source: customer.customer_source ?? "walk_in", marketing_email_consent: customer.marketing_email_consent, marketing_sms_consent: customer.marketing_sms_consent });
    setNotesOpen(Boolean(customer.notes)); setDuplicateWarning("");
    setEditorOpen(true);
  }

  async function saveCustomer(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const { supabase, workspaceId, userId } = await getActiveWorkspaceContext();
      const normalizedEmail = form.email.trim().toLowerCase();
      const normalizedPhone = form.phone.replace(/\D/g, "");
      if (!normalizedEmail && !normalizedPhone) throw new Error("Add an email address or phone number so this customer can be identified later.");
      let duplicateQuery = supabase.from("crm_customers").select("id,first_name,last_name,email,phone").eq("workspace_id", workspaceId);
      if (editingId) duplicateQuery = duplicateQuery.neq("id", editingId);
      const { data: possibleMatches } = await duplicateQuery;
      const duplicate = (possibleMatches ?? []).find((candidate: { first_name: string; last_name: string; email: string | null; phone: string | null }) => (normalizedEmail && candidate.email?.trim().toLowerCase() === normalizedEmail) || (normalizedPhone && candidate.phone?.replace(/\D/g, "") === normalizedPhone));
      if (duplicate && !duplicateWarning) { setDuplicateWarning(`A profile for ${duplicate.first_name} ${duplicate.last_name} already uses this email or phone. Review it before creating another record.`); setSaving(false); return; }
      const record = { workspace_id: workspaceId, created_by: userId, first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: normalizedEmail || null, phone: form.phone.trim() || null, notes: form.notes.trim() || null, tags: form.tags, customer_type: form.customer_type, customer_source: form.customer_source, marketing_email_consent: form.marketing_email_consent, marketing_sms_consent: form.marketing_sms_consent, marketing_consent_updated_at: new Date().toISOString() };
      const response = editingId
        ? await supabase.from("crm_customers").update(record).eq("id", editingId).eq("workspace_id", workspaceId)
        : await supabase.from("crm_customers").insert(record);
      if (response.error) throw response.error;
      setEditorOpen(false); setSavedNotice(editingId ? "Customer profile updated." : "Customer profile created."); window.setTimeout(() => setSavedNotice(""), 3500); await loadCustomers();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Customer could not be saved."); }
    finally { setSaving(false); }
  }

  async function adjustBalance(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return;
    const parsed = Number(adjustment.amount); if (!Number.isFinite(parsed) || parsed === 0 || !adjustment.reason.trim()) return;
    setSaving(true); setError("");
    try {
      const { supabase, workspaceId } = await getActiveWorkspaceContext();
      const amount = adjustment.type === "credit" ? Math.round(parsed * 100) : Math.round(parsed);
      const { error: rpcError } = await supabase.rpc("adjust_crm_customer_balance", { p_workspace_id: workspaceId, p_customer_id: selected.id, p_entry_type: adjustment.type, p_amount: amount, p_reason: adjustment.reason.trim() });
      if (rpcError) throw rpcError;
      setAdjustment({ type: "credit", amount: "", reason: "" });
      await loadCustomers(); await loadLedger(selected.id);
      setSelected((current) => current ? { ...current, [adjustment.type === "credit" ? "store_credit_cents" : "loyalty_points"]: (adjustment.type === "credit" ? current.store_credit_cents : current.loyalty_points) + amount } : current);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Adjustment could not be saved."); }
    finally { setSaving(false); }
  }

  async function saveLoyalty() {
    setSaving(true); setError("");
    try {
      const { supabase, workspaceId, userId } = await getActiveWorkspaceContext();
      const { error: saveError } = await supabase.from("crm_loyalty_programs").upsert({ workspace_id: workspaceId, created_by: userId, ...loyalty }, { onConflict: "workspace_id" });
      if (saveError) throw saveError;
      setSavedNotice("Loyalty rules saved securely."); window.setTimeout(() => setSavedNotice(""), 3500);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Loyalty settings could not be saved."); }
    finally { setSaving(false); }
  }

  async function deleteCustomer(customer: Customer) {
    if (!window.confirm(`Delete ${customer.first_name} ${customer.last_name}? Their credit and points history will also be removed.`)) return;
    const { supabase, workspaceId } = await getActiveWorkspaceContext();
    const { error: removeError } = await supabase.from("crm_customers").delete().eq("id", customer.id).eq("workspace_id", workspaceId);
    if (removeError) setError(removeError.message); else { setSelected(null); await loadCustomers(); }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase(); if (!needle) return customers;
    return customers.filter((customer) => `${customer.first_name} ${customer.last_name} ${customer.email ?? ""} ${customer.phone ?? ""} ${customer.tags.join(" ")}`.toLowerCase().includes(needle));
  }, [customers, query]).filter((customer) => directoryFilter === "all" || (directoryFilter === "marketing" && (customer.marketing_email_consent || customer.marketing_sms_consent)) || (directoryFilter === "credit" && customer.store_credit_cents > 0) || (directoryFilter === "loyalty" && customer.loyalty_points > 0));
  const totalCredit = customers.reduce((sum, customer) => sum + customer.store_credit_cents, 0);
  const marketingReach = customers.filter((customer) => customer.marketing_email_consent || customer.marketing_sms_consent).length;

  return <WorkspaceFrame>
    <PageHeader eyebrow="Customer intelligence" title="Turn every customer into a lasting relationship." description="One secure customer record for purchase history, marketing consent, store credit, loyalty points, notes, and audience segments." icon={ContactRound} actionLabel="Add customer" onAction={openNewCustomer} />
    {error ? <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs text-rose-200">{error}</div> : null}
    {savedNotice ? <div className="fixed right-4 top-4 z-[70] flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-[#08231f]/95 px-4 py-3 text-xs font-semibold text-emerald-100 shadow-2xl backdrop-blur-xl"><Check className="h-4 w-4 text-emerald-300" />{savedNotice}</div> : null}
    <div className="mt-5 grid gap-3 grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Customers" value={String(customers.length)} detail="Workspace profiles" icon={Users} />
      <MetricCard label="Marketing reach" value={String(marketingReach)} detail="Customers with consent" icon={Mail} />
      <MetricCard label="Credit liability" value={money(totalCredit)} detail="Outstanding store credit" icon={BadgeDollarSign} />
      <MetricCard label="Loyalty members" value={String(customers.filter((c) => c.loyalty_points > 0).length)} detail="Customers earning points" icon={Star} />
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.85fr)]">
      <section className={`${styles.glassPanel} overflow-hidden rounded-[26px]`}>
        <div className="border-b border-white/[0.06] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-300">Customer directory</p><h2 className="mt-1.5 text-lg font-semibold text-white">Relationship hub</h2></div>
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 transition focus-within:border-cyan-300/30 focus-within:ring-2 focus-within:ring-cyan-300/[0.06] sm:w-72"><Search className="h-4 w-4 text-slate-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers, tags…" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600" /></label></div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{([['all','All customers'],['marketing','Marketing eligible'],['credit','Has store credit'],['loyalty','Loyalty members']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setDirectoryFilter(value)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-semibold transition ${directoryFilter === value ? "border-cyan-300/25 bg-cyan-300/[0.1] text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,.08)]" : "border-white/[0.07] bg-white/[0.02] text-slate-500 hover:border-white/[0.13] hover:text-slate-300"}`}>{label}</button>)}</div>
        </div>
        {loading ? <Loader2 className="mx-auto my-16 h-6 w-6 animate-spin text-cyan-300" /> : filtered.length ? <div className="divide-y divide-white/[0.055]">{filtered.map((customer) => <button key={customer.id} type="button" onClick={() => { setSelected(customer); void loadLedger(customer.id); }} className="group flex w-full items-center gap-3 p-4 text-left transition hover:bg-cyan-400/[0.035] sm:px-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/[0.14] bg-cyan-400/[0.055] text-xs font-bold text-cyan-200">{initials(customer)}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{customer.first_name} {customer.last_name}</span><span className="mt-1 block truncate text-[11px] text-slate-600">{customer.email || customer.phone || "No contact details"}</span><span className="mt-2 flex flex-wrap gap-1">{customer.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full border border-cyan-300/[0.1] bg-cyan-400/[0.035] px-2 py-0.5 text-[8px] font-semibold text-cyan-200/70">{tag}</span>)}</span></span>
          <span className="hidden text-right sm:block"><span className="block text-xs font-semibold text-emerald-300">{money(customer.store_credit_cents)} credit</span><span className="mt-1 block text-[10px] text-amber-200/70">{customer.loyalty_points.toLocaleString()} pts</span></span><ChevronRight className="h-4 w-4 text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
        </button>)}</div> : <div className="m-5 flex min-h-64 flex-col items-center justify-center rounded-[22px] border border-dashed border-cyan-300/[0.14] bg-gradient-to-b from-cyan-300/[0.035] to-transparent px-5 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/[0.15] bg-cyan-300/[0.07] shadow-[0_0_30px_rgba(34,211,238,.08)]"><UserRound className="h-5 w-5 text-cyan-200" /></span><span className="mt-4 text-base font-semibold text-white">{customers.length ? "No customers match this view" : "Build your customer network"}</span><span className="mt-1.5 max-w-md text-xs leading-5 text-slate-500">{customers.length ? "Try another filter or search term." : "Create a profile to unlock auditable store credit, loyalty rewards, customer notes, and consent-based marketing."}</span><div className="mt-5 flex flex-col items-center gap-3"><button type="button" onClick={openNewCustomer} className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-slate-950 shadow-[0_10px_25px_rgba(34,211,238,.18)]"><Plus className="h-4 w-4" />Add first customer</button><p className="max-w-sm text-[10px] leading-5 text-slate-600">Bulk customer import is intentionally unavailable until the consent and duplicate-review workflow is connected.</p></div></div>}
      </section>

      <aside className="space-y-5">
        <section className={`${styles.glassPanel} rounded-[22px] p-5`}><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300/[0.08] text-amber-200"><Gift className="h-4 w-4" /></span><div><p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-amber-200/70">Loyalty engine</p><h2 className="mt-1 text-base font-semibold text-white">Program rules</h2></div><button type="button" aria-label={loyalty.enabled ? "Pause loyalty program" : "Activate loyalty program"} onClick={() => setLoyalty({ ...loyalty, enabled: !loyalty.enabled })} className={`ml-auto rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-wider ${loyalty.enabled ? "bg-emerald-300/10 text-emerald-200" : "bg-white/[0.04] text-slate-500"}`}>{loyalty.enabled ? "Active" : "Paused"}</button></div>
          <div className="mt-5 grid grid-cols-2 gap-3"><NumberField label="Points per $1" value={loyalty.points_per_dollar} onChange={(value) => setLoyalty({ ...loyalty, points_per_dollar: value })} /><NumberField label="Reward at points" value={loyalty.reward_points} onChange={(value) => setLoyalty({ ...loyalty, reward_points: value })} /><NumberField label="Reward value ($)" value={loyalty.reward_value_cents / 100} onChange={(value) => setLoyalty({ ...loyalty, reward_value_cents: Math.round(value * 100) })} /></div>
          <div className="mt-4 rounded-xl border border-cyan-300/[0.09] bg-cyan-400/[0.025] p-3 text-[11px] leading-5 text-slate-500"><Sparkles className="mr-2 inline h-3.5 w-3.5 text-cyan-300" />Customers earn {loyalty.points_per_dollar} point{loyalty.points_per_dollar === 1 ? "" : "s"} per dollar and unlock {money(loyalty.reward_value_cents)} at {loyalty.reward_points} points.</div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-300/[0.12] bg-amber-300/[0.035] px-3 py-2.5"><span className="text-[10px] text-slate-500">Example at current settings</span><span className="text-[11px] font-semibold text-amber-100">Spend {money(Math.ceil(loyalty.reward_points / Math.max(loyalty.points_per_dollar, .01)) * 100)} → earn {money(loyalty.reward_value_cents)}</span></div>
          <button type="button" disabled={saving} onClick={() => void saveLoyalty()} className="mt-4 h-10 w-full rounded-xl bg-cyan-400 text-xs font-bold text-slate-950 disabled:opacity-50">Save loyalty rules</button>
        </section>
        <section className={`${styles.glassPanel} rounded-[22px] p-5`}><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-300" /><div><h2 className="text-sm font-semibold text-white">Consent-first marketing</h2><p className="mt-1 text-[0.8rem] leading-5 text-slate-500">Audience eligibility is based on each customer’s recorded email and SMS consent.</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><AudienceStat label="Email" value={customers.filter((c) => c.marketing_email_consent).length} /><AudienceStat label="SMS" value={customers.filter((c) => c.marketing_sms_consent).length} /></div></section>
        <section className={`${styles.glassPanel} rounded-[22px] p-5`}><div className="flex items-center gap-3"><History className="h-5 w-5 text-violet-300" /><div><h2 className="text-sm font-semibold text-white">Recent activity</h2><p className="mt-1 text-[0.8rem] text-slate-500">Latest customer records in this workspace</p></div></div><div className="mt-4 space-y-2">{customers.slice(0,3).map((customer) => <button key={customer.id} type="button" onClick={() => { setSelected(customer); void loadLedger(customer.id); }} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.018] p-3 text-left transition hover:border-cyan-300/[0.14]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-300/[0.07] text-[0.68rem] font-bold text-violet-200">{initials(customer)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-200">{customer.first_name} {customer.last_name}</span><span className="mt-0.5 block text-[0.72rem] text-slate-500">Profile added {new Date(customer.created_at).toLocaleDateString()}</span></span><ChevronRight className="h-3.5 w-3.5 text-slate-700" /></button>)}{!customers.length ? <p className="rounded-xl border border-dashed border-white/[0.07] p-4 text-center text-xs text-slate-500">Customer activity will appear here.</p> : null}</div></section>
      </aside>
    </div>

    {editorOpen ? <Modal onClose={() => setEditorOpen(false)}><form onSubmit={saveCustomer} className="flex max-h-[calc(100dvh-2rem)] flex-col">
      <div className="shrink-0 border-b border-white/[0.07] px-5 py-4 sm:px-6"><ModalHeader title={editingId ? "Edit customer profile" : "Create customer profile"} subtitle="Build one reliable record for every customer interaction." onClose={() => setEditorOpen(false)} /></div>
      <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
        <FormSection icon={UserRound} title="Customer details" description="Identity and direct contact information.">
          <div className="grid gap-3 sm:grid-cols-2"><TextField required label="First name" placeholder="Jordan" value={form.first_name} onChange={(value) => setForm({ ...form, first_name: value })} /><TextField required label="Last name" placeholder="Lee" value={form.last_name} onChange={(value) => setForm({ ...form, last_name: value })} /><TextField type="email" label="Email address" placeholder="jordan@example.com" value={form.email} onChange={(value) => { setDuplicateWarning(""); setForm({ ...form, email: value }); }} /><TextField type="tel" label="Phone number" placeholder="(602) 555-0147" value={form.phone} onChange={(value) => { setDuplicateWarning(""); setForm({ ...form, phone: formatPhone(value) }); }} /></div>
        </FormSection>
        <FormSection icon={Building2} title="Relationship details" description="Segment this profile for reporting and outreach.">
          <div className="grid gap-3 sm:grid-cols-2"><SelectField label="Customer type" value={form.customer_type} onChange={(value) => setForm({ ...form, customer_type: value as CustomerForm['customer_type'] })} options={[["individual","Individual"],["business","Business / organization"]]} /><SelectField label="Customer source" value={form.customer_source} onChange={(value) => setForm({ ...form, customer_source: value })} options={[["walk_in","Walk-in"],["website","Website"],["card_show","Card show"],["marketplace","Marketplace"],["referral","Referral"],["other","Other"]]} /></div>
          <div className="mt-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Customer tags</p><div className="mt-2 flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 focus-within:border-cyan-300/30">{form.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-cyan-300/[0.16] bg-cyan-300/[0.07] px-2.5 py-1 text-[10px] font-semibold text-cyan-100">{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => setForm({ ...form, tags: form.tags.filter((item) => item !== tag) })}><X className="h-3 w-3" /></button></span>)}<input value={form.tagDraft} onChange={(e) => setForm({ ...form, tagDraft: e.target.value })} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === ",") && form.tagDraft.trim()) { e.preventDefault(); const next = form.tagDraft.trim().replace(/,$/, ""); if (!form.tags.includes(next)) setForm({ ...form, tags: [...form.tags, next], tagDraft: "" }); } }} placeholder={form.tags.length ? "Add another…" : "VIP, Commander player, Local…"} className="min-w-36 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600" /></div><p className="mt-1.5 text-[9px] text-slate-600">Press Enter to add each tag.</p></div>
        </FormSection>
        <FormSection icon={ShieldCheck} title="Marketing consent" description="Only record permission the customer explicitly provided.">
          <div className="grid gap-2 sm:grid-cols-2"><ConsentToggle label="Email marketing" detail="Offers and store updates" checked={form.marketing_email_consent} onChange={(checked) => setForm({ ...form, marketing_email_consent: checked })} /><ConsentToggle label="SMS marketing" detail="Texts and time-sensitive alerts" checked={form.marketing_sms_consent} onChange={(checked) => setForm({ ...form, marketing_sms_consent: checked })} /></div><p className="mt-3 flex items-center gap-2 text-[9px] text-slate-600"><ShieldCheck className="h-3 w-3 text-emerald-300" />Consent date and staff source are recorded when this profile is saved.</p>
        </FormSection>
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018]"><button type="button" onClick={() => setNotesOpen(!notesOpen)} className="flex w-full items-center gap-3 p-4 text-left"><MessageSquareText className="h-4 w-4 text-violet-300" /><span className="flex-1"><span className="block text-xs font-semibold text-white">Private staff notes</span><span className="mt-1 block text-[10px] text-slate-600">Internal context—never shown to the customer.</span></span><ChevronDown className={`h-4 w-4 text-slate-500 transition ${notesOpen ? "rotate-180" : ""}`} /></button>{notesOpen ? <div className="px-4 pb-4"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Preferences, conversations, or service context…" className="workspace-input w-full resize-none" /></div> : null}</div>
        {duplicateWarning ? <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-[11px] leading-5 text-amber-100"><strong className="block">Possible duplicate customer</strong>{duplicateWarning}<span className="mt-1 block text-amber-200/60">Submit again only if this is intentionally a separate profile.</span></div> : null}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/[0.07] bg-[#06131b]/95 px-5 py-4 backdrop-blur-xl sm:px-6"><button type="button" onClick={() => setEditorOpen(false)} className="h-11 rounded-xl border border-white/[0.09] px-5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.04]">Cancel</button><button disabled={saving} className="inline-flex h-11 min-w-44 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 to-cyan-400 px-5 text-xs font-bold text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,.18)] disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{saving ? "Saving securely…" : editingId ? "Save changes" : "Create customer profile"}</button></div>
    </form></Modal> : null}

    {selected ? <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><aside className="h-full w-full max-w-xl overflow-y-auto border-l border-cyan-300/[0.1] bg-[#031018] p-5 shadow-2xl sm:p-7"><ModalHeader title={`${selected.first_name} ${selected.last_name}`} subtitle={selected.email || selected.phone || "Customer profile"} onClose={() => setSelected(null)} /><div className="mt-5 flex gap-2"><button type="button" onClick={() => openEdit(selected)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] text-xs text-white"><Pencil className="h-3.5 w-3.5" /> Edit profile</button><button type="button" aria-label={`Delete ${selected.first_name} ${selected.last_name}`} onClick={() => void deleteCustomer(selected)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-300/10 text-rose-300/70"><Trash2 className="h-4 w-4" /></button></div><div className="mt-5 grid grid-cols-2 gap-3"><ProfileStat label="Store credit" value={money(selected.store_credit_cents)} tone="emerald" /><ProfileStat label="Loyalty points" value={selected.loyalty_points.toLocaleString()} tone="amber" /><ProfileStat label="Lifetime spend" value={money(selected.lifetime_spend_cents)} /><ProfileStat label="Orders" value={String(selected.order_count)} /></div>
      <section className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4"><div className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-cyan-300" /><h3 className="text-sm font-semibold text-white">Account adjustment</h3></div><form onSubmit={adjustBalance} className="mt-4 grid gap-3"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setAdjustment({ ...adjustment, type: "credit" })} className={`h-9 rounded-xl text-xs font-semibold ${adjustment.type === "credit" ? "bg-emerald-300/10 text-emerald-200 ring-1 ring-emerald-300/20" : "bg-white/[0.025] text-slate-500"}`}>Store credit</button><button type="button" onClick={() => setAdjustment({ ...adjustment, type: "points" })} className={`h-9 rounded-xl text-xs font-semibold ${adjustment.type === "points" ? "bg-amber-300/10 text-amber-200 ring-1 ring-amber-300/20" : "bg-white/[0.025] text-slate-500"}`}>Loyalty points</button></div><TextField required type="number" label={adjustment.type === "credit" ? "Amount in dollars (negative removes)" : "Points (negative removes)"} value={adjustment.amount} onChange={(value) => setAdjustment({ ...adjustment, amount: value })} /><TextField required label="Reason / reference" value={adjustment.reason} onChange={(value) => setAdjustment({ ...adjustment, reason: value })} /><button disabled={saving} className="h-10 rounded-xl bg-cyan-400 text-xs font-bold text-slate-950 disabled:opacity-50">Post adjustment</button></form></section>
      <section className="mt-5"><h3 className="text-sm font-semibold text-white">Account ledger</h3><div className="mt-3 space-y-2">{ledger.length ? ledger.map((entry) => <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${entry.entry_type === "credit" ? "bg-emerald-300/[0.07] text-emerald-300" : "bg-amber-300/[0.07] text-amber-200"}`}>{entry.entry_type === "credit" ? <BadgeDollarSign className="h-4 w-4" /> : <Star className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-white">{entry.reason}</span><span className="mt-1 block text-[9px] text-slate-600">{new Date(entry.created_at).toLocaleString()}</span></span><span className={`text-xs font-bold ${entry.amount >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{entry.amount >= 0 ? "+" : ""}{entry.entry_type === "credit" ? money(entry.amount) : `${entry.amount} pts`}</span></div>) : <p className="rounded-xl border border-dashed border-white/[0.07] p-5 text-center text-xs text-slate-600">No adjustments yet.</p>}</div></section>
    </aside></div> : null}
  </WorkspaceFrame>;
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-end overflow-hidden bg-black/75 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className={`${styles.glassPanel} w-full overflow-hidden rounded-t-[28px] border-x-0 border-b-0 sm:my-6 sm:max-w-2xl sm:rounded-[28px] sm:border`}>{children}</div></div>; }
function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) { return <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-white">{title}</h2><p className="mt-1 text-[0.8rem] text-slate-500">{subtitle}</p></div><button type="button" aria-label="Close panel" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] text-slate-500"><X className="h-4 w-4" /></button></div>; }
function TextField({ label, value, onChange, type = "text", required = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string }) { return <label><span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span><input required={required} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="workspace-input mt-2 w-full placeholder:text-slate-700" /></label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label><span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span><input min="0" type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="workspace-input mt-2 w-full" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string,string])[] }) { return <label><span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="workspace-input mt-2 w-full appearance-none">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>; }
function FormSection({ icon: Icon, title, description, children }: { icon: typeof UserRound; title: string; description: string; children: React.ReactNode }) { return <section className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4"><div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/[0.12] bg-cyan-300/[0.05] text-cyan-200"><Icon className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mt-0.5 text-[0.8rem] text-slate-500">{description}</p></div></div>{children}</section>; }
function ConsentToggle({ label, detail, checked, onChange }: { label: string; detail?: string; checked: boolean; onChange: (checked: boolean) => void }) { return <button type="button" aria-pressed={checked} onClick={() => onChange(!checked)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${checked ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100" : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/[0.13]"}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${checked ? "bg-emerald-300 text-slate-950" : "border border-white/15"}`}>{checked ? <Check className="h-3.5 w-3.5" /> : null}</span><span><span className="block text-[11px] font-semibold">{label}</span>{detail ? <span className="mt-0.5 block text-[9px] text-slate-600">{detail}</span> : null}</span></button>; }
function formatPhone(value: string) { const digits = value.replace(/\D/g, "").slice(0, 10); if (digits.length < 4) return digits; if (digits.length < 7) return `(${digits.slice(0,3)}) ${digits.slice(3)}`; return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`; }
function ProfileStat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) { return <div className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4"><p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p><p className={`mt-2 text-lg font-semibold ${tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-200" : "text-white"}`}>{value}</p></div>; }
function AudienceStat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3"><p className="text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-white">{value}</p></div>; }
