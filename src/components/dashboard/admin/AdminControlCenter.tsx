"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Check,
  ChevronRight,
  CircleAlert,
  CloudCog,
  DatabaseBackup,
  Eye,
  Headphones,
  HeartPulse,
  Lightbulb,
  KeyRound,
  LayoutGrid,
  Loader2,
  LockKeyhole,
  Megaphone,
  ReceiptText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TicketCheck,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  beginAdminTotpEnrollment,
  loadAdminMfaSecurityState,
  verifyAdminTotpFactor,
} from "@/app/actions/admin-mfa";
import { OperationsSection, type OperationsTab } from "@/components/dashboard/admin/AdminOperationsPanels";
import { TrialsManager } from "@/components/dashboard/admin/TrialsManager";

type AdminTab =
  | "overview"
  | "users"
  | "trials"
  | "plans"
  | "features"
  | "categories"
  | "support"
  | "billing"
  | "communications"
  | "health"
  | "data"
  | "analytics"
  | "feedback"
  | "security"
  | "audit";
type Factor = { id: string; friendly_name?: string; status: string };
type Feature = {
  id: string;
  name: string;
  category: string;
  description: string;
  visibility: "enabled" | "coming_soon" | "hidden";
  minimum_plan: string | null;
  usage_limit: number | null;
};

const tabs: { id: AdminTab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "users", label: "Users", icon: Users },
  { id: "trials", label: "Trials & Promotions", icon: TicketCheck },
  { id: "plans", label: "Plans & Limits", icon: BadgeDollarSign },
  { id: "features", label: "Feature Access", icon: SlidersHorizontal },
  { id: "categories", label: "Categories", icon: LayoutGrid },
  { id: "support", label: "Customer Support", icon: Headphones },
  { id: "billing", label: "Billing & Credits", icon: ReceiptText },
  { id: "communications", label: "Announcements", icon: Megaphone },
  { id: "health", label: "System Health", icon: HeartPulse },
  { id: "data", label: "Data & Backups", icon: DatabaseBackup },
  { id: "analytics", label: "Product Analytics", icon: BarChart3 },
  { id: "feedback", label: "Feedback & Beta", icon: Lightbulb },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "audit", label: "Audit Log", icon: Eye },
];

const fallbackFeatures: Feature[] = [
  { id: "dashboard", name: "Dashboard", category: "Core", description: "Account overview and workspace metrics.", visibility: "enabled", minimum_plan: "free", usage_limit: null },
  { id: "inventory", name: "Inventory", category: "Collection", description: "Singles, sealed product, boxes, and binders.", visibility: "enabled", minimum_plan: "collector", usage_limit: null },
  { id: "deck-vault", name: "Deck Vault", category: "Collection", description: "Deck building, importing, and analysis.", visibility: "enabled", minimum_plan: "collector", usage_limit: null },
  { id: "collection-buying", name: "Collection Buying", category: "Purchasing", description: "Appraise and purchase collections.", visibility: "enabled", minimum_plan: "seller", usage_limit: null },
  { id: "marketplaces", name: "Marketplaces", category: "Sales", description: "Listings and marketplace workflows.", visibility: "coming_soon", minimum_plan: "seller", usage_limit: null },
  { id: "finances", name: "Finances", category: "Business", description: "Expenses, payouts, and reporting.", visibility: "enabled", minimum_plan: "store", usage_limit: null },
  { id: "employees", name: "Employees", category: "Business", description: "Team access and payroll tools.", visibility: "enabled", minimum_plan: "store", usage_limit: null },
];

export function AdminControlCenter({ ownerEmail }: { ownerEmail: string }) {
  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [working, setWorking] = useState(false);

  const refreshSecurity = useCallback(async () => {
    setChecking(true);
    setAuthError("");
    const result = await loadAdminMfaSecurityState();
    if (result.ok) {
      setVerified(result.verified);
      setFactors(result.factors as Factor[]);
    } else {
      setVerified(false);
      setFactors([]);
      setAuthError(result.error);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    void refreshSecurity();
  }, [refreshSecurity]);

  async function beginEnrollment() {
    setWorking(true);
    setAuthError("");
    const result = await beginAdminTotpEnrollment();
    if (result.ok) setEnrollment(result.enrollment);
    else setAuthError(result.error);
    setWorking(false);
  }

  async function verifyFactor(factorId: string) {
    if (!/^\d{6}$/.test(code)) {
      setAuthError("Enter the current 6-digit code from your authenticator app.");
      return;
    }
    setWorking(true);
    setAuthError("");
    const result = await verifyAdminTotpFactor(factorId, code);
    if (result.ok) {
      setEnrollment(null);
      setCode("");
      setVerified(result.verified);
      setFactors(result.factors as Factor[]);
    } else {
      setAuthError(result.error);
    }
    setWorking(false);
  }

  if (checking) {
    return <div className="flex min-h-[calc(100vh-72px)] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-td-accent-text" /></div>;
  }

  if (!verified) {
    return (
      <AdminSecurityGate
        ownerEmail={ownerEmail}
        factors={factors}
        enrollment={enrollment}
        code={code}
        error={authError}
        working={working}
        onCode={setCode}
        onEnroll={beginEnrollment}
        onVerify={verifyFactor}
      />
    );
  }

  return <AdminWorkspace ownerEmail={ownerEmail} initialFeatures={fallbackFeatures} />;
}

function AdminSecurityGate({
  ownerEmail, factors, enrollment, code, error, working, onCode, onEnroll, onVerify,
}: {
  ownerEmail: string;
  factors: Factor[];
  enrollment: { id: string; qr: string; secret: string } | null;
  code: string;
  error: string;
  working: boolean;
  onCode: (value: string) => void;
  onEnroll: () => void;
  onVerify: (id: string) => void;
}) {
  const verifiedFactor = factors.find((factor) => factor.status === "verified");
  const factorId = enrollment?.id ?? verifiedFactor?.id;
  return (
    <div className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-td-canvas px-5 py-10">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[700px] -translate-x-1/2 rounded-full bg-td-warning/[0.045] blur-[120px]" />
      <div className="relative mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-td-warning/20 bg-td-warning/[0.07] text-td-warning shadow-[0_0_45px_rgba(251,191,36,0.09)]">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.24em] text-td-warning/70">Owner verification</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-td-primary">Admin Control Center</h1>
          <p className="mt-3 text-sm leading-6 text-td-secondary">
            Protected access for <span className="font-medium text-td-primary">{ownerEmail}</span>. Verify with your authenticator before viewing or changing account access.
          </p>
        </div>

        <section className="rounded-[28px] border border-td-ink/[0.09] bg-td-surface/95 p-6 shadow-[0_30px_100px_rgb(var(--td-shadow-rgb)/calc(0.45*var(--td-shadow-strength)))]">
          {!verifiedFactor && !enrollment ? (
            <>
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-td-accent/15 bg-td-accent/[0.06] text-td-accent-text"><KeyRound className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-base font-semibold text-td-primary">Set up an authenticator</h2>
                  <p className="mt-1.5 text-xs leading-5 text-td-secondary">Use Google Authenticator, Microsoft Authenticator, Authy, or any TOTP-compatible app.</p>
                </div>
              </div>
              <button type="button" disabled={working} onClick={onEnroll} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-td-warning text-sm font-bold text-td-on-accent transition hover:bg-td-warning disabled:opacity-50">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Set up authenticator
              </button>
            </>
          ) : (
            <>
              {enrollment ? (
                <div className="mb-6 rounded-2xl border border-td-ink/[0.08] bg-td-ink/[0.025] p-4 text-center">
                  {/* Supabase returns a trusted local SVG data URL for this enrollment. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enrollment.qr} alt="Authenticator setup QR code" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" />
                  <p className="mt-3 text-xs text-td-secondary">Scan this QR code, then enter the current 6-digit code.</p>
                  <details className="mt-2 text-left">
                    <summary className="cursor-pointer text-center text-[11px] text-td-accent-text">Can’t scan it?</summary>
                    <code className="mt-2 block break-all rounded-lg bg-black/25 p-2 text-[11px] text-td-secondary">{enrollment.secret}</code>
                  </details>
                </div>
              ) : (
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-td-success/15 bg-td-success/[0.045] p-4">
                  <ShieldCheck className="h-5 w-5 text-td-success" />
                  <div><p className="text-sm font-semibold text-td-success">Authenticator is enabled</p><p className="mt-0.5 text-xs text-td-success/55">Enter a fresh code to unlock admin controls.</p></div>
                </div>
              )}
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-td-muted" htmlFor="admin-code">Authenticator code</label>
              <input id="admin-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => onCode(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => { if (event.key === "Enter" && factorId) onVerify(factorId); }} placeholder="000000" className="mt-2 h-14 w-full rounded-xl border border-td-ink/[0.1] bg-black/20 px-4 text-center text-xl font-semibold tracking-[0.45em] text-td-primary outline-none transition focus:border-td-warning/40 focus:ring-4 focus:ring-td-warning/[0.06]" />
              <button type="button" disabled={working || !factorId} onClick={() => factorId && onVerify(factorId)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-td-warning text-sm font-bold text-td-on-accent transition hover:bg-td-warning disabled:opacity-50">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />} Verify and open admin
              </button>
            </>
          )}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-td-danger/15 bg-td-danger/[0.05] px-3 py-2 text-xs text-td-danger">{error}</p> : null}
        </section>
        <p className="mt-5 text-center text-[11px] text-td-muted">Admin access is never granted by the code alone. You must already be signed in to the permanent Owner account.</p>
      </div>
    </div>
  );
}

function AdminWorkspace({ ownerEmail, initialFeatures }: { ownerEmail: string; initialFeatures: Feature[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<AdminTab>("overview");
  const [features, setFeatures] = useState(initialFeatures);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFeatures() {
      const response = await supabase
        .from("feature_access")
        .select("*")
        .order("category")
        .order("name");
      const data = response.data as Feature[] | null;

      if (active && data?.length) setFeatures(data);
    }

    void loadFeatures();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function updateFeature(id: string, patch: Partial<Feature>) {
    const previous = features;
    const next = features.map((feature) => feature.id === id ? { ...feature, ...patch } : feature);
    setFeatures(next);
    setSavingId(id);
    const { error } = await supabase.from("feature_access").update(patch).eq("id", id);
    if (error) {
      setFeatures(previous);
      setNotice(`Could not save: ${error.message}`);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from("admin_audit_log").insert({ actor_id: user.id, action: "feature.updated", target_type: "feature", target_id: id, details: patch });
      setNotice("Access rule saved.");
    }
    setSavingId("");
    window.setTimeout(() => setNotice(""), 2500);
  }

  const filtered = features.filter((feature) => `${feature.name} ${feature.category} ${feature.description}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="min-h-[calc(100vh-72px)] bg-td-canvas">
      <header className="border-b border-td-ink/[0.06] bg-td-surface/80 px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-td-warning/75">
              <ShieldCheck className="h-3.5 w-3.5" />
              Owner workspace
              <span className="rounded-full border border-td-accent/20 bg-td-accent/[0.07] px-2 py-0.5 text-[11px] tracking-[0.16em] text-td-accent-text">v44 · Trial invitations enabled</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-td-primary sm:text-3xl">Admin Control Center</h1>
            <p className="mt-1.5 text-sm text-td-muted">Plans, access, categories, security, and account-level overrides.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-td-success/[0.13] bg-td-success/[0.04] px-4 py-3">
            <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-td-success opacity-40" /><span className="relative h-2.5 w-2.5 rounded-full bg-td-success" /></span>
            <div><p className="text-[11px] font-semibold text-td-success">Authenticator verified</p><p className="text-[11px] text-td-success/45">{ownerEmail}</p></div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit max-h-[calc(100vh-112px)] overflow-y-auto rounded-[22px] border border-td-ink/[0.07] bg-td-surface p-2 lg:sticky lg:top-[96px]">
          <p className="px-3 pb-2 pt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-td-muted">Administration</p>
          <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
            {tabs.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-left text-[11px] font-semibold transition ${tab === item.id ? "border border-td-accent/[0.15] bg-td-accent/[0.065] text-td-accent-text" : "border border-transparent text-td-muted hover:bg-td-ink/[0.025] hover:text-td-secondary"}`}><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{item.label}</span>{tab === item.id ? <ChevronRight className="ml-auto hidden h-3 w-3 lg:block" /> : null}</button>;
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          {tab === "overview" ? <Overview features={features} ownerEmail={ownerEmail} onNavigate={setTab} /> : null}
          {tab === "features" ? <FeatureAccess features={filtered} query={query} setQuery={setQuery} savingId={savingId} updateFeature={updateFeature} /> : null}
          {tab === "trials" ? <TrialsManager /> : null}
          {["support", "billing", "communications", "health", "data", "analytics", "feedback"].includes(tab) ? <OperationsSection tab={tab as OperationsTab} /> : null}
          {["users", "plans", "categories", "security", "audit"].includes(tab) ? <SectionPlaceholder tab={tab as CorePlaceholderTab} features={features} ownerEmail={ownerEmail} /> : null}
        </main>
      </div>
      {notice ? <div role="status" className="fixed bottom-5 right-5 z-[150] rounded-xl border border-td-accent/15 bg-td-surface px-4 py-3 text-xs font-medium text-td-accent-text shadow-2xl">{notice}</div> : null}
    </div>
  );
}

function Overview({ features, ownerEmail, onNavigate }: { features: Feature[]; ownerEmail: string; onNavigate: (tab: AdminTab) => void }) {
  const enabled = features.filter((feature) => feature.visibility === "enabled").length;
  const adminTools: { tab: AdminTab; title: string; description: string; icon: typeof Activity; tone: string }[] = [
    { tab: "trials", title: "Trials & Promotions", description: "Grant, extend, convert, or revoke email-based trials.", icon: TicketCheck, tone: "text-td-warning bg-td-warning/[0.07] border-td-warning/15" },
    { tab: "support", title: "Customer Support", description: "Review accounts, activity, notes, and access issues.", icon: Headphones, tone: "text-td-accent-text bg-td-accent/[0.06] border-td-accent/15" },
    { tab: "billing", title: "Billing & Credits", description: "Subscriptions, invoices, credits, refunds, and coupons.", icon: ReceiptText, tone: "text-td-success bg-td-success/[0.06] border-td-success/15" },
    { tab: "communications", title: "Announcements", description: "Prepare product, trial, and maintenance messages.", icon: Megaphone, tone: "text-td-violet bg-td-violet/[0.06] border-td-violet/15" },
    { tab: "health", title: "System Health", description: "Check platform jobs, storage, email, and integrations.", icon: HeartPulse, tone: "text-td-danger bg-td-danger/[0.06] border-td-danger/15" },
    { tab: "data", title: "Data & Backups", description: "Exports, backup status, deletion, and retention requests.", icon: DatabaseBackup, tone: "text-td-accent-text bg-td-accent/[0.06] border-td-accent/15" },
    { tab: "analytics", title: "Product Analytics", description: "Trials, conversions, retention, and feature adoption.", icon: BarChart3, tone: "text-td-violet bg-td-violet/[0.06] border-td-violet/15" },
    { tab: "feedback", title: "Feedback & Beta", description: "Feature requests, bug reports, testers, and releases.", icon: Lightbulb, tone: "text-td-warning bg-td-warning/[0.06] border-td-warning/15" },
  ];
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Stat label="Registered users" value="1" detail="Owner account active" icon={Users} />
      <button type="button" onClick={() => onNavigate("trials")} className="rounded-[22px] border border-td-warning/[0.16] bg-td-warning/[0.035] p-5 text-left transition hover:border-td-warning/30 hover:bg-td-warning/[0.06]">
        <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-td-warning/65">Trial controls</p><TicketCheck className="h-4 w-4 text-td-warning/70" /></div>
        <p className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-td-primary">Ready</p>
        <p className="mt-1 text-[11px] text-td-warning/45">Open Trials & Promotions →</p>
      </button>
      <Stat label="Active plans" value="4" detail="Free through Business" icon={BadgeDollarSign} />
      <Stat label="Enabled features" value={String(enabled)} detail={`${features.length} configured`} icon={Sparkles} />
      <Stat label="Security" value="Protected" detail="Authenticator verified" icon={ShieldCheck} />
    </div>
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-td-warning/[0.13] bg-gradient-to-r from-td-warning/[0.055] to-td-accent/[0.025] p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-td-warning/20 bg-td-warning/[0.08] text-td-warning"><TicketCheck className="h-5 w-5" /></span>
        <div><p className="text-sm font-semibold text-td-primary">Trials & Promotions is active</p><p className="mt-1 text-xs leading-5 text-td-muted">Grant plan access by email, track usage and expiration, extend trials, record conversions, or revoke access.</p></div>
      </div>
      <button type="button" onClick={() => onNavigate("trials")} className="rounded-xl bg-td-warning px-4 py-2.5 text-xs font-bold text-td-on-accent transition hover:bg-td-warning">Manage free trials</button>
    </section>
    <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface p-5 sm:p-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-td-accent-text/65">Admin operations</p>
        <h2 className="mt-2 text-xl font-semibold text-td-primary">All management tools</h2>
        <p className="mt-1.5 text-xs text-td-muted">Every promised admin area is visible here and in the navigation. Select a card to open its workspace.</p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {adminTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button key={tool.tab} type="button" onClick={() => onNavigate(tool.tab)} className="group min-h-32 rounded-2xl border border-td-ink/[0.065] bg-black/10 p-4 text-left transition hover:-translate-y-0.5 hover:border-td-accent/20 hover:bg-td-accent/[0.025]">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${tool.tone}`}><Icon className="h-4 w-4" /></span>
              <p className="mt-3 text-xs font-semibold text-td-primary">{tool.title}</p>
              <p className="mt-1 text-[11px] leading-4 text-td-muted">{tool.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-td-accent-text/65">Open tool <ChevronRight className="h-3 w-3 transition group-hover:translate-x-0.5" /></span>
            </button>
          );
        })}
      </div>
    </section>
    <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-td-accent-text/65">Access architecture</p><h2 className="mt-2 text-xl font-semibold text-td-primary">Automated plans, with you as final authority</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-td-muted">Default access follows each account’s plan. Owner overrides can enable beta access, preserve grandfathered features, or resolve support issues without changing the plan itself.</p></div>
        <button type="button" onClick={() => onNavigate("features")} className="rounded-xl border border-td-accent/15 bg-td-accent/[0.06] px-4 py-2.5 text-xs font-semibold text-td-accent-text transition hover:bg-td-accent/[0.1]">Manage feature access</button>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {["Plan defaults apply", "Owner overrides win", "Every change is logged"].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-td-ink/[0.06] bg-black/10 p-4"><span className="flex h-7 w-7 items-center justify-center rounded-full border border-td-success/15 bg-td-success/[0.05] text-td-success"><Check className="h-3.5 w-3.5" /></span><div><p className="text-xs font-semibold text-td-primary">{item}</p><p className="mt-0.5 text-[11px] text-td-muted">Priority {index + 1}</p></div></div>)}
      </div>
    </section>
    <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface p-5"><h3 className="text-sm font-semibold text-td-primary">Recent admin activity</h3><div className="mt-5 flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-td-ink/[0.08] bg-black/10 text-center"><div><Activity className="mx-auto h-5 w-5 text-td-muted" /><p className="mt-2 text-xs text-td-muted">No administrative changes yet</p><p className="mt-1 text-[11px] text-td-muted">Changes will appear here automatically.</p></div></div></div>
      <div className="rounded-[24px] border border-td-warning/[0.11] bg-td-warning/[0.025] p-5"><div className="flex items-center gap-2 text-td-warning"><ShieldCheck className="h-4 w-4" /><h3 className="text-sm font-semibold">Permanent Owner</h3></div><p className="mt-3 text-xs leading-5 text-td-warning/55">{ownerEmail} retains complete access regardless of subscription tier and cannot be demoted through ordinary account controls.</p></div>
    </section>
  </div>;
}

function FeatureAccess({ features, query, setQuery, savingId, updateFeature }: { features: Feature[]; query: string; setQuery: (value: string) => void; savingId: string; updateFeature: (id: string, patch: Partial<Feature>) => void }) {
  return <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-td-ink/[0.06] p-5 sm:p-6"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-td-accent-text/65">Feature gates</p><h2 className="mt-2 text-xl font-semibold text-td-primary">Feature Access</h2><p className="mt-1.5 text-xs text-td-muted">Control visibility and the minimum plan for every major website area.</p></div><label className="flex h-10 min-w-64 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-black/15 px-3"><Search className="h-3.5 w-3.5 text-td-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search features…" className="min-w-0 flex-1 bg-transparent text-xs text-td-primary outline-none placeholder:text-td-muted" /></label></div>
    <div className="divide-y divide-td-ink/[0.055]">
      {features.map((feature) => <div key={feature.id} className="grid gap-4 p-5 transition hover:bg-td-ink/[0.012] xl:grid-cols-[minmax(220px,1fr)_170px_165px] xl:items-center">
        <div><div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-td-primary">{feature.name}</h3><span className="rounded-full border border-td-ink/[0.07] bg-td-ink/[0.025] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-td-muted">{feature.category}</span>{savingId === feature.id ? <Loader2 className="h-3 w-3 animate-spin text-td-accent-text" /> : null}</div><p className="mt-1 text-[11px] leading-5 text-td-muted">{feature.description}</p></div>
        <label><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">Minimum plan</span><select value={feature.minimum_plan ?? "free"} onChange={(event) => void updateFeature(feature.id, { minimum_plan: event.target.value })} className="h-9 w-full rounded-lg border border-td-ink/[0.08] bg-td-surface px-2 text-[11px] text-td-secondary outline-none"><option value="free">Free</option><option value="collector">Collector</option><option value="seller">Seller</option><option value="store">Store</option></select></label>
        <label><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">Visibility</span><select value={feature.visibility} onChange={(event) => void updateFeature(feature.id, { visibility: event.target.value as Feature["visibility"] })} className={`h-9 w-full rounded-lg border px-2 text-[11px] outline-none ${feature.visibility === "enabled" ? "border-td-success/15 bg-td-success/[0.04] text-td-success" : feature.visibility === "coming_soon" ? "border-td-warning/15 bg-td-warning/[0.04] text-td-warning" : "border-td-ink/[0.08] bg-td-ink/[0.02] text-td-muted"}`}><option value="enabled">Visible & enabled</option><option value="coming_soon">Coming soon</option><option value="hidden">Hidden</option></select></label>
      </div>)}
    </div>
  </section>;
}

type CorePlaceholderTab = "users" | "plans" | "categories" | "security" | "audit";

function SectionPlaceholder({ tab, features, ownerEmail }: { tab: CorePlaceholderTab; features: Feature[]; ownerEmail: string }) {
  const sectionContent = {
    users: ["User Access", "Search accounts, review subscription levels, and apply individual feature overrides.", Users],
    plans: ["Plans & Limits", "Set plan pricing, feature bundles, and usage limits from one central ruleset.", BadgeDollarSign],
    categories: ["Categories & Navigation", "Choose whether website categories are visible, hidden, or presented as coming soon.", LayoutGrid],
    security: ["Security", `Authenticator protection is active for ${ownerEmail}. Sensitive actions require a fresh verified session.`, ShieldCheck],
    audit: ["Audit Log", "Review plan, permission, category, and security changes with their exact time and actor.", Eye],
  } satisfies Record<CorePlaceholderTab, [string, string, typeof Activity]>;
  const content = sectionContent[tab];
  const Icon = content[2] as typeof Activity;
  const cards = tab === "plans" ? ["Free", "Collector", "Seller", "Business"] : tab === "categories" ? [...new Set(features.map((feature) => feature.category))] : tab === "security" ? ["Authenticator MFA", "Owner protection", "Session assurance", "Recovery planning"] : tab === "users" ? [ownerEmail] : ["No changes recorded"];
  return <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface p-5 sm:p-6"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-td-accent/15 bg-td-accent/[0.055] text-td-accent-text"><Icon className="h-5 w-5" /></div><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-td-accent-text/65">Admin controls</p><h2 className="mt-1 text-xl font-semibold text-td-primary">{content[0] as string}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-td-muted">{content[1] as string}</p></div></div><div className="mt-7 grid gap-3 sm:grid-cols-2">{cards.map((card) => <div key={card} className="flex min-h-20 items-center justify-between rounded-2xl border border-td-ink/[0.06] bg-black/10 p-4"><div><p className="text-xs font-semibold capitalize text-td-primary">{card}</p><p className="mt-1 text-[11px] text-td-muted">{tab === "security" ? "Protected" : "Configured"}</p></div>{tab === "security" ? <Check className="h-4 w-4 text-td-success" /> : tab === "users" ? <span className="rounded-full border border-td-warning/15 bg-td-warning/[0.05] px-2 py-1 text-[11px] font-bold uppercase text-td-warning">Owner</span> : <ChevronRight className="h-4 w-4 text-td-muted" />}</div>)}</div>{tab === "security" ? <div className="mt-5 flex gap-3 rounded-2xl border border-td-warning/[0.1] bg-td-warning/[0.025] p-4"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-td-warning/70" /><p className="text-[11px] leading-5 text-td-warning/50">Save the recovery codes shown by your authentication provider somewhere offline. Trading Docks never displays or stores your authenticator code.</p></div> : null}</section>;
}

function Stat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Activity }) {
  return <div className="rounded-[22px] border border-td-ink/[0.07] bg-td-surface p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-td-muted">{label}</p><Icon className="h-4 w-4 text-td-accent-text/55" /></div><p className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-td-primary">{value}</p><p className="mt-1 text-[11px] text-td-muted">{detail}</p></div>;
}
