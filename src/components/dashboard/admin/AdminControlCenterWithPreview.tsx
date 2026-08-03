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
  Ban,
  DatabaseBackup,
  EllipsisVertical,
  Eye,
  Headphones,
  HeartPulse,
  Lightbulb,
  KeyRound,
  LayoutGrid,
  Loader2,
  LockKeyhole,
  Megaphone,
  PlugZap,
  ReceiptText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserRoundCog,
  X,
  Sparkles,
  TicketCheck,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { OperationsSection, type OperationsTab } from "@/components/dashboard/admin/AdminOperationsPanels";
import { PlanPreview } from "@/components/dashboard/admin/PlanPreview";
import { TrialsManager } from "@/components/dashboard/admin/TrialsManager";
import { AdminFeedbackQueue } from "@/components/dashboard/admin/AdminFeedbackQueue";

type AdminTab =
  | "overview"
  | "users"
  | "trials"
  | "plans"
  | "plan-preview"
  | "features"
  | "categories"
  | "support"
  | "billing"
  | "communications"
  | "health"
  | "data"
  | "analytics"
  | "feedback"
  | "integrations"
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
type AdminPlan = "free" | "collector" | "seller" | "business";
type AdminAccount = {
  id: string;
  email: string;
  full_name: string | null;
  membership_level: AdminPlan;
  membership_override?: AdminPlan | null;
  card_units: number;
  unique_inventory_rows: number;
  created_at: string;
  last_sign_in_at: string | null;
  usage_updated_at: string | null;
  email_confirmed: boolean;
  suspended: boolean;
  banned_until: string | null;
};

const tabs: { id: AdminTab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "users", label: "Users", icon: Users },
  { id: "trials", label: "Trials & Promotions", icon: TicketCheck },
  { id: "plans", label: "Plans & Limits", icon: BadgeDollarSign },
  { id: "plan-preview", label: "Plan Preview", icon: Eye },
  { id: "features", label: "Feature Access", icon: SlidersHorizontal },
  { id: "categories", label: "Categories", icon: LayoutGrid },
  { id: "support", label: "Customer Support", icon: Headphones },
  { id: "billing", label: "Billing & Credits", icon: ReceiptText },
  { id: "communications", label: "Announcements", icon: Megaphone },
  { id: "health", label: "System Health", icon: HeartPulse },
  { id: "data", label: "Data & Backups", icon: DatabaseBackup },
  { id: "analytics", label: "Product Analytics", icon: BarChart3 },
  { id: "feedback", label: "Feedback & Beta", icon: Lightbulb },
  { id: "integrations", label: "Integrations", icon: PlugZap },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "audit", label: "Audit Log", icon: Eye },
];

const fallbackFeatures: Feature[] = [
  { id: "dashboard", name: "Dashboard", category: "Core", description: "Account overview and workspace metrics.", visibility: "enabled", minimum_plan: "free", usage_limit: null },
  { id: "inventory", name: "Inventory", category: "Collection", description: "Singles, sealed product, boxes, and binders.", visibility: "enabled", minimum_plan: "collector", usage_limit: null },
  { id: "deck-vault", name: "Deck Vault", category: "Collection", description: "Deck building, importing, and analysis. Free includes 10 decks; Collector includes 50.", visibility: "enabled", minimum_plan: "free", usage_limit: 10 },
  { id: "collection-buying", name: "Collection Buying", category: "Purchasing", description: "Appraise and purchase collections.", visibility: "enabled", minimum_plan: "seller", usage_limit: null },
  { id: "marketplaces", name: "Marketplaces", category: "Sales", description: "Listings and marketplace workflows.", visibility: "coming_soon", minimum_plan: "seller", usage_limit: null },
  { id: "finances", name: "Finances", category: "Business", description: "Expenses, payouts, and reporting.", visibility: "enabled", minimum_plan: "business", usage_limit: null },
  { id: "employees", name: "Employees", category: "Business", description: "Team access and payroll tools.", visibility: "enabled", minimum_plan: "business", usage_limit: 5 },
];

export function AdminControlCenter({ ownerEmail }: { ownerEmail: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [working, setWorking] = useState(false);

  const refreshSecurity = useCallback(async () => {
    setChecking(true);
    const [{ data: aal }, { data: factorData }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    setVerified(aal?.currentLevel === "aal2");
    setFactors((factorData?.totp ?? []) as Factor[]);
    setChecking(false);
  }, [supabase]);

  useEffect(() => {
    void refreshSecurity();
  }, [refreshSecurity]);

  async function beginEnrollment() {
    setWorking(true);
    setAuthError("");
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Trading Docks Admin",
    });
    if (error) setAuthError(error.message);
    else if (data?.totp) setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setWorking(false);
  }

  async function verifyFactor(factorId: string) {
    if (!/^\d{6}$/.test(code)) {
      setAuthError("Enter the current 6-digit code from your authenticator app.");
      return;
    }
    setWorking(true);
    setAuthError("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) setAuthError(error.message);
    else {
      setEnrollment(null);
      setCode("");
      await refreshSecurity();
    }
    setWorking(false);
  }

  if (checking) {
    return <div className="flex min-h-[calc(100vh-72px)] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-300" /></div>;
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
    <div className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-[#02090f] px-5 py-10">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[700px] -translate-x-1/2 rounded-full bg-amber-300/[0.045] blur-[120px]" />
      <div className="relative mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-amber-300/20 bg-amber-300/[0.07] text-amber-200 shadow-[0_0_45px_rgba(251,191,36,0.09)]">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300/70">Owner verification</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">Admin Control Center</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Protected access for <span className="font-medium text-slate-200">{ownerEmail}</span>. Verify with your authenticator before viewing or changing account access.
          </p>
        </div>

        <section className="rounded-[28px] border border-white/[0.09] bg-[#07131c]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
          {!verifiedFactor && !enrollment ? (
            <>
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-200"><KeyRound className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-base font-semibold text-white">Set up an authenticator</h2>
                  <p className="mt-1.5 text-xs leading-5 text-slate-400">Use Google Authenticator, Microsoft Authenticator, Authy, or any TOTP-compatible app.</p>
                </div>
              </div>
              <button type="button" disabled={working} onClick={onEnroll} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-bold text-[#17200d] transition hover:bg-amber-200 disabled:opacity-50">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Set up authenticator
              </button>
            </>
          ) : (
            <>
              {enrollment ? (
                <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-center">
                  {/* Supabase returns a trusted local SVG data URL for this enrollment. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enrollment.qr} alt="Authenticator setup QR code" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" />
                  <p className="mt-3 text-xs text-slate-400">Scan this QR code, then enter the current 6-digit code.</p>
                  <details className="mt-2 text-left">
                    <summary className="cursor-pointer text-center text-[11px] text-cyan-300">Can’t scan it?</summary>
                    <code className="mt-2 block break-all rounded-lg bg-black/25 p-2 text-[10px] text-slate-300">{enrollment.secret}</code>
                  </details>
                </div>
              ) : (
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] p-4">
                  <ShieldCheck className="h-5 w-5 text-emerald-300" />
                  <div><p className="text-sm font-semibold text-emerald-100">Authenticator is enabled</p><p className="mt-0.5 text-xs text-emerald-100/55">Enter a fresh code to unlock admin controls.</p></div>
                </div>
              )}
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500" htmlFor="admin-code">Authenticator code</label>
              <input id="admin-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => onCode(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => { if (event.key === "Enter" && factorId) onVerify(factorId); }} placeholder="000000" className="mt-2 h-14 w-full rounded-xl border border-white/[0.1] bg-black/20 px-4 text-center text-xl font-semibold tracking-[0.45em] text-white outline-none transition focus:border-amber-300/40 focus:ring-4 focus:ring-amber-300/[0.06]" />
              <button type="button" disabled={working || !factorId} onClick={() => factorId && onVerify(factorId)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-bold text-[#17200d] transition hover:bg-amber-200 disabled:opacity-50">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />} Verify and open admin
              </button>
            </>
          )}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-red-300/15 bg-red-300/[0.05] px-3 py-2 text-xs text-red-200">{error}</p> : null}
        </section>
        <p className="mt-5 text-center text-[11px] text-slate-600">Admin access is never granted by the code alone. You must already be signed in to the permanent Owner account.</p>
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
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState("");

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError("");
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const body = await response.json() as { accounts?: AdminAccount[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not load accounts.");
      setAccounts(body.accounts ?? []);
    } catch (loadError) {
      setAccountsError(loadError instanceof Error ? loadError.message : "Could not load accounts.");
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      supabase.from("feature_access").select("*").order("category").order("name"),
      loadAccounts(),
    ]).then(([featureResult]) => {
      if (featureResult.data?.length) setFeatures(featureResult.data as Feature[]);
    });
  }, [supabase, loadAccounts]);

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
    <div className="min-h-[calc(100vh-72px)] bg-[#02090f]">
      <header className="border-b border-white/[0.06] bg-[#04101a]/80 px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/75">
              <ShieldCheck className="h-3.5 w-3.5" />
              Owner workspace
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-2 py-0.5 text-[8px] tracking-[0.16em] text-cyan-200">v44 · Trial invitations enabled</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">Admin Control Center</h1>
            <p className="mt-1.5 text-sm text-slate-500">Plans, access, categories, security, and account-level overrides.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/[0.13] bg-emerald-300/[0.04] px-4 py-3">
            <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-40" /><span className="relative h-2.5 w-2.5 rounded-full bg-emerald-300" /></span>
            <div><p className="text-[11px] font-semibold text-emerald-100">Authenticator verified</p><p className="text-[9px] text-emerald-200/45">{ownerEmail}</p></div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit max-h-[calc(100vh-112px)] overflow-y-auto rounded-[22px] border border-white/[0.07] bg-[#06121b] p-2 lg:sticky lg:top-[96px]">
          <p className="px-3 pb-2 pt-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-700">Administration</p>
          <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
            {tabs.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-left text-[11px] font-semibold transition ${tab === item.id ? "border border-cyan-300/[0.15] bg-cyan-300/[0.065] text-cyan-100" : "border border-transparent text-slate-500 hover:bg-white/[0.025] hover:text-slate-300"}`}><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{item.label}</span>{tab === item.id ? <ChevronRight className="ml-auto hidden h-3 w-3 lg:block" /> : null}</button>;
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          {tab === "overview" ? <Overview features={features} ownerEmail={ownerEmail} accounts={accounts} onNavigate={setTab} /> : null}
          {tab === "users" ? <UserDirectory accounts={accounts} loading={accountsLoading} error={accountsError} ownerEmail={ownerEmail} onRefresh={loadAccounts} /> : null}
          {tab === "plan-preview" ? <PlanPreview /> : null}
          {tab === "features" ? <FeatureAccess features={filtered} query={query} setQuery={setQuery} savingId={savingId} updateFeature={updateFeature} /> : null}
          {tab === "trials" ? <TrialsManager /> : null}
          {tab === "feedback" ? <AdminFeedbackQueue /> : null}
          {tab === "integrations" ? <AdminIntegrations /> : null}
          {["support", "billing", "communications", "health", "data", "analytics"].includes(tab) ? <OperationsSection tab={tab as OperationsTab} /> : null}
          {["plans", "categories", "security", "audit"].includes(tab) ? <SectionPlaceholder tab={tab as CorePlaceholderTab} features={features} ownerEmail={ownerEmail} /> : null}
        </main>
      </div>
      {notice ? <div role="status" className="fixed bottom-5 right-5 z-[150] rounded-xl border border-cyan-300/15 bg-[#0a1a24] px-4 py-3 text-xs font-medium text-cyan-100 shadow-2xl">{notice}</div> : null}
    </div>
  );
}

type PlatformIntegration = {
  marketplace_id: string;
  credential_labels: Record<string, string>;
  enabled: boolean;
  updated_at: string;
};

function AdminIntegrations() {
  const [integration, setIntegration] = useState<PlatformIntegration | null>(null);
  const [environment, setEnvironment] = useState("production");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [ruName, setRuName] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/admin/marketplace-integrations", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { integrations?: PlatformIntegration[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not load integrations.");
        setIntegration(body.integrations?.find((item) => item.marketplace_id === "ebay") ?? null);
      })
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/marketplace-integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketplaceId: "ebay",
        credentials: { environment, clientId, clientSecret, ruName },
        enabled: true,
      }),
    });
    const body = await response.json().catch(() => ({
      error: `The server returned an unreadable response (${response.status}).`,
    })) as { error?: string; masked?: Record<string, string>; enabled?: boolean };
    if (!response.ok) setMessage(body.error ?? "Could not save eBay configuration.");
    else {
      setIntegration({
        marketplace_id: "ebay",
        credential_labels: body.masked ?? {},
        enabled: body.enabled !== false,
        updated_at: new Date().toISOString(),
      });
      setClientId("");
      setClientSecret("");
      setRuName("");
      setEditing(false);
      setMessage("eBay is configured for every Trading Docks store.");
    }
    setSaving(false);
  }

  async function toggleEnabled() {
    if (!integration) return;
    setSaving(true);
    const enabled = !integration.enabled;
    const response = await fetch("/api/admin/marketplace-integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplaceId: "ebay", enabled }),
    });
    if (response.ok) {
      setIntegration({ ...integration, enabled });
      setMessage(enabled ? "Customer eBay connections are enabled." : "New eBay connections are paused.");
    } else setMessage("Could not update eBay availability.");
    setSaving(false);
  }

  return (
    <section className="rounded-[24px] border border-white/[0.07] bg-[#06121b] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/65">Platform integrations</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Marketplace application credentials</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Configure each marketplace once. Stores only see Connect, Reconnect, and Disconnect controls for their own account.</p>
        </div>
        <span className="rounded-full border border-amber-300/15 bg-amber-300/[0.05] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-200">Owner only</span>
      </div>

      <div className="mt-6 rounded-[22px] border border-white/[0.07] bg-black/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] text-cyan-200"><PlugZap className="h-5 w-5" /></div>
            <div><h3 className="text-sm font-semibold text-white">eBay</h3><p className="mt-1 text-[10px] text-slate-500">One Trading Docks developer application · separate consent per store</p></div>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase ${integration?.enabled ? "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200" : "border-slate-300/10 bg-white/[0.03] text-slate-500"}`}>
            {loading ? "Checking" : integration?.enabled ? "Available to stores" : integration ? "Paused" : "Not configured"}
          </span>
        </div>

        {integration && !editing ? (
          <div className="mt-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Environment", integration.credential_labels.environment ?? "Saved"],
                ["Client ID", integration.credential_labels.clientId ?? "Saved"],
                ["RuName", integration.credential_labels.ruName ?? "Saved"],
              ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">{label}</p><p className="mt-1.5 font-mono text-[11px] text-slate-300">{value}</p></div>)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setEditing(true)} className="h-10 rounded-xl border border-cyan-300/15 px-4 text-xs font-bold text-cyan-100 hover:bg-cyan-300/[0.06]">Replace credentials</button>
              <button type="button" disabled={saving} onClick={() => void toggleEnabled()} className="h-10 rounded-xl border border-white/[0.08] px-4 text-xs font-semibold text-slate-300 hover:bg-white/[0.03]">{integration.enabled ? "Pause customer connections" : "Enable customer connections"}</button>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-semibold text-slate-300">Environment<select value={environment} onChange={(event) => setEnvironment(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.08] bg-[#06121b] px-3 text-xs text-white"><option value="production">Production</option><option value="sandbox">Sandbox</option></select></label>
            <label className="text-[10px] font-semibold text-slate-300">Client ID<input value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-xs text-white outline-none focus:border-cyan-300/30" /></label>
            <label className="text-[10px] font-semibold text-slate-300">Client Secret<input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} autoComplete="new-password" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-xs text-white outline-none focus:border-cyan-300/30" /></label>
            <label className="text-[10px] font-semibold text-slate-300">RuName<input value={ruName} onChange={(event) => setRuName(event.target.value)} autoComplete="off" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-xs text-white outline-none focus:border-cyan-300/30" /></label>
            <div className="flex gap-2 sm:col-span-2">
              <button type="button" disabled={saving || !clientId || !clientSecret || !ruName} onClick={() => void save()} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-300 text-xs font-bold text-slate-950 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Encrypt and activate eBay</button>
              {integration ? <button type="button" onClick={() => setEditing(false)} className="h-11 rounded-xl border border-white/[0.08] px-4 text-xs text-slate-400">Cancel</button> : null}
            </div>
          </div>
        )}
        <div className="mt-4 flex gap-3 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.025] p-3 text-[10px] leading-4 text-emerald-100/55"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />The saved secret is encrypted server-side and never displayed again. Vercel and Supabase infrastructure secrets remain outside this dashboard.</div>
        {message ? <p role="status" className={`mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5 ${message.startsWith("eBay is configured") || message.includes("enabled.") ? "border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-100" : "border-amber-300/15 bg-amber-300/[0.04] text-amber-100"}`}>{message}</p> : null}
      </div>
    </section>
  );
}

function Overview({ features, ownerEmail, accounts, onNavigate }: { features: Feature[]; ownerEmail: string; accounts: AdminAccount[]; onNavigate: (tab: AdminTab) => void }) {
  const enabled = features.filter((feature) => feature.visibility === "enabled").length;
  const totalCards = accounts.reduce((total, account) => total + Number(account.card_units || 0), 0);
  const adminTools: { tab: AdminTab; title: string; description: string; icon: typeof Activity; tone: string }[] = [
    { tab: "trials", title: "Trials & Promotions", description: "Grant, extend, convert, or revoke email-based trials.", icon: TicketCheck, tone: "text-amber-200 bg-amber-300/[0.07] border-amber-300/15" },
    { tab: "support", title: "Customer Support", description: "Review accounts, activity, notes, and access issues.", icon: Headphones, tone: "text-cyan-200 bg-cyan-300/[0.06] border-cyan-300/15" },
    { tab: "billing", title: "Billing & Credits", description: "Subscriptions, invoices, credits, refunds, and coupons.", icon: ReceiptText, tone: "text-emerald-200 bg-emerald-300/[0.06] border-emerald-300/15" },
    { tab: "communications", title: "Announcements", description: "Prepare product, trial, and maintenance messages.", icon: Megaphone, tone: "text-violet-200 bg-violet-300/[0.06] border-violet-300/15" },
    { tab: "health", title: "System Health", description: "Check platform jobs, storage, email, and integrations.", icon: HeartPulse, tone: "text-rose-200 bg-rose-300/[0.06] border-rose-300/15" },
    { tab: "data", title: "Data & Backups", description: "Exports, backup status, deletion, and retention requests.", icon: DatabaseBackup, tone: "text-sky-200 bg-sky-300/[0.06] border-sky-300/15" },
    { tab: "analytics", title: "Product Analytics", description: "Trials, conversions, retention, and feature adoption.", icon: BarChart3, tone: "text-indigo-200 bg-indigo-300/[0.06] border-indigo-300/15" },
    { tab: "feedback", title: "Feedback & Beta", description: "Feature requests, bug reports, testers, and releases.", icon: Lightbulb, tone: "text-orange-200 bg-orange-300/[0.06] border-orange-300/15" },
  ];
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Stat label="Registered users" value={accounts.length.toLocaleString("en-US")} detail="All site accounts" icon={Users} />
      <button type="button" onClick={() => onNavigate("trials")} className="rounded-[22px] border border-amber-300/[0.16] bg-amber-300/[0.035] p-5 text-left transition hover:border-amber-300/30 hover:bg-amber-300/[0.06]">
        <div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-amber-200/65">Trial controls</p><TicketCheck className="h-4 w-4 text-amber-300/70" /></div>
        <p className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">Ready</p>
        <p className="mt-1 text-[10px] text-amber-100/45">Open Trials & Promotions →</p>
      </button>
      <Stat label="Cards uploaded" value={totalCards.toLocaleString("en-US")} detail="Across all account inventory" icon={DatabaseBackup} />
      <Stat label="Enabled features" value={String(enabled)} detail={`${features.length} configured`} icon={Sparkles} />
      <Stat label="Security" value="Protected" detail="Authenticator verified" icon={ShieldCheck} />
    </div>
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-amber-300/[0.13] bg-gradient-to-r from-amber-300/[0.055] to-cyan-300/[0.025] p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] text-amber-200"><TicketCheck className="h-5 w-5" /></span>
        <div><p className="text-sm font-semibold text-white">Trials & Promotions is active</p><p className="mt-1 text-xs leading-5 text-slate-500">Grant plan access by email, track usage and expiration, extend trials, record conversions, or revoke access.</p></div>
      </div>
      <button type="button" onClick={() => onNavigate("trials")} className="rounded-xl bg-amber-300 px-4 py-2.5 text-xs font-bold text-[#17200d] transition hover:bg-amber-200">Manage free trials</button>
    </section>
    <section className="rounded-[24px] border border-white/[0.07] bg-[#06121b] p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/65">Admin operations</p>
        <h2 className="mt-2 text-xl font-semibold text-white">All management tools</h2>
        <p className="mt-1.5 text-xs text-slate-500">Every promised admin area is visible here and in the navigation. Select a card to open its workspace.</p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {adminTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button key={tool.tab} type="button" onClick={() => onNavigate(tool.tab)} className="group min-h-32 rounded-2xl border border-white/[0.065] bg-black/10 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-cyan-300/[0.025]">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${tool.tone}`}><Icon className="h-4 w-4" /></span>
              <p className="mt-3 text-xs font-semibold text-slate-100">{tool.title}</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-600">{tool.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300/65">Open tool <ChevronRight className="h-3 w-3 transition group-hover:translate-x-0.5" /></span>
            </button>
          );
        })}
      </div>
    </section>
    <section className="rounded-[24px] border border-white/[0.07] bg-[#06121b] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/65">Access architecture</p><h2 className="mt-2 text-xl font-semibold text-white">Automated plans, with you as final authority</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Default access follows each account’s plan. Owner overrides can enable beta access, preserve grandfathered features, or resolve support issues without changing the plan itself.</p></div>
        <button type="button" onClick={() => onNavigate("features")} className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-2.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.1]">Manage feature access</button>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {["Plan defaults apply", "Owner overrides win", "Every change is logged"].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/10 p-4"><span className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-300"><Check className="h-3.5 w-3.5" /></span><div><p className="text-xs font-semibold text-slate-200">{item}</p><p className="mt-0.5 text-[10px] text-slate-600">Priority {index + 1}</p></div></div>)}
      </div>
    </section>
    <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="rounded-[24px] border border-white/[0.07] bg-[#06121b] p-5"><h3 className="text-sm font-semibold text-white">Recent admin activity</h3><div className="mt-5 flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-black/10 text-center"><div><Activity className="mx-auto h-5 w-5 text-slate-700" /><p className="mt-2 text-xs text-slate-500">No administrative changes yet</p><p className="mt-1 text-[10px] text-slate-700">Changes will appear here automatically.</p></div></div></div>
      <div className="rounded-[24px] border border-amber-300/[0.11] bg-amber-300/[0.025] p-5"><div className="flex items-center gap-2 text-amber-200"><ShieldCheck className="h-4 w-4" /><h3 className="text-sm font-semibold">Permanent Owner</h3></div><p className="mt-3 text-xs leading-5 text-amber-100/55">{ownerEmail} retains complete access regardless of subscription tier and cannot be demoted through ordinary account controls.</p></div>
    </section>
  </div>;
}

function UserDirectory({
  accounts,
  loading,
  error,
  ownerEmail,
  onRefresh,
}: {
  accounts: AdminAccount[];
  loading: boolean;
  error: string;
  ownerEmail: string;
  onRefresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminAccount | null>(null);
  const [plan, setPlan] = useState<AdminPlan>("free");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const filteredAccounts = accounts.filter((account) =>
    `${account.full_name ?? ""} ${account.email} ${account.membership_level}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const totalCards = accounts.reduce(
    (total, account) => total + Number(account.card_units || 0),
    0,
  );
  const paidAccounts = accounts.filter(
    (account) => account.membership_level !== "free",
  ).length;

  function openAccount(account: AdminAccount) {
    setSelected(account);
    setPlan(account.membership_level);
    setMessage("");
    setDeleteConfirm("");
  }

  async function runAction(payload: Record<string, unknown>, destructive = false) {
    if (!selected) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: destructive ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, ...payload }),
      });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error ?? "The account could not be updated.");
      setMessage(body.message ?? "Account updated.");
      await onRefresh();
      if (destructive) setSelected(null);
      else {
        setSelected((current) => current ? {
          ...current,
          membership_level: payload.action === "plan" ? plan : current.membership_level,
          suspended: payload.action === "suspend" ? true : payload.action === "restore" ? false : current.suspended,
        } : current);
      }
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : "The account could not be updated.");
    } finally {
      setWorking(false);
    }
  }

  const isOwner = selected?.email.trim().toLowerCase() === ownerEmail.trim().toLowerCase();

  return (
    <>
      <section className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#06121b]">
        <div className="border-b border-white/[0.06] p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/65">Account directory</p>
              <h2 className="mt-2 text-xl font-semibold text-white">User management</h2>
              <p className="mt-1.5 text-xs text-slate-500">Change plans, suspend access, inspect account activity, or safely remove customer accounts.</p>
            </div>
            <label className="flex h-10 min-w-64 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/15 px-3">
              <Search className="h-3.5 w-3.5 text-slate-600" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or plan…" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-700" />
            </label>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Total accounts" value={accounts.length.toLocaleString("en-US")} detail="Registered users" icon={Users} />
            <Stat label="Cards uploaded" value={totalCards.toLocaleString("en-US")} detail="Total inventory quantity" icon={DatabaseBackup} />
            <Stat label="Paid members" value={paidAccounts.toLocaleString("en-US")} detail="Collector through Business" icon={BadgeDollarSign} />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-cyan-300" />Loading accounts…</div>
        ) : error ? (
          <p role="alert" className="m-5 rounded-xl border border-red-300/15 bg-red-300/[0.05] px-4 py-3 text-xs text-red-200">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left">
              <thead className="border-b border-white/[0.06] bg-black/10 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">
                <tr><th className="px-5 py-3">Account</th><th className="px-5 py-3">Membership</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Cards</th><th className="px-5 py-3">Joined</th><th className="px-5 py-3">Last sign-in</th><th className="w-16 px-5 py-3"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredAccounts.map((account) => {
                  const permanentOwner = account.email.trim().toLowerCase() === ownerEmail.trim().toLowerCase();
                  return (
                    <tr key={account.id} onClick={() => openAccount(account)} className="cursor-pointer text-xs transition hover:bg-cyan-300/[0.025]">
                      <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] text-cyan-200"><UserRoundCog className="h-4 w-4" /></div><div><p className="font-semibold text-slate-200">{account.full_name || account.email.split("@")[0]}</p><p className="mt-1 text-[10px] text-slate-600">{account.email}</p></div></div></td>
                      <td className="px-5 py-4"><PlanBadge plan={account.membership_level} />{account.membership_override ? <p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-amber-300/60">Admin override</p> : null}</td>
                      <td className="px-5 py-4">{permanentOwner ? <StatusBadge label="Permanent owner" tone="amber" /> : account.suspended ? <StatusBadge label="Suspended" tone="rose" /> : account.email_confirmed ? <StatusBadge label="Active" tone="emerald" /> : <StatusBadge label="Unconfirmed" tone="slate" />}</td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-white">{Number(account.card_units || 0).toLocaleString("en-US")}</td>
                      <td className="px-5 py-4 text-[10px] text-slate-500">{new Date(account.created_at).toLocaleDateString("en-US")}</td>
                      <td className="px-5 py-4 text-[10px] text-slate-500">{account.last_sign_in_at ? new Date(account.last_sign_in_at).toLocaleDateString("en-US") : "Never"}</td>
                      <td className="px-5 py-4 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); openAccount(account); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-slate-500 transition hover:bg-white/[0.04] hover:text-white" aria-label={`Manage ${account.email}`}><EllipsisVertical className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filteredAccounts.length ? <p className="px-5 py-10 text-center text-xs text-slate-600">No accounts match this search.</p> : null}
          </div>
        )}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-[180] flex justify-end bg-black/55 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <aside className="h-full w-full max-w-[480px] overflow-y-auto border-l border-cyan-300/[0.12] bg-[#04101a] shadow-[-35px_0_100px_rgba(0,0,0,.5)]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.07] bg-[#04101a]/95 px-5 py-4 backdrop-blur-xl"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300/65">Customer 360</p><h3 className="mt-1 text-lg font-semibold text-white">Manage account</h3></div><button type="button" onClick={() => setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-slate-500 hover:text-white"><X className="h-4 w-4" /></button></div>
            <div className="space-y-5 p-5">
              <section className="rounded-[22px] border border-white/[0.07] bg-[#071722] p-5"><div className="flex items-start gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] text-cyan-200"><UserRoundCog className="h-5 w-5" /></div><div className="min-w-0"><h4 className="truncate text-base font-semibold text-white">{selected.full_name || selected.email.split("@")[0]}</h4><p className="mt-1 truncate text-xs text-slate-500">{selected.email}</p><div className="mt-3 flex flex-wrap gap-2"><PlanBadge plan={selected.membership_level} />{isOwner ? <StatusBadge label="Permanent owner" tone="amber" /> : selected.suspended ? <StatusBadge label="Suspended" tone="rose" /> : <StatusBadge label="Active" tone="emerald" />}</div></div></div></section>

              <section className="grid grid-cols-2 gap-3">{[["Cards uploaded", Number(selected.card_units || 0).toLocaleString("en-US")],["Inventory rows", Number(selected.unique_inventory_rows || 0).toLocaleString("en-US")],["Joined", new Date(selected.created_at).toLocaleDateString("en-US")],["Last sign-in", selected.last_sign_in_at ? new Date(selected.last_sign_in_at).toLocaleDateString("en-US") : "Never"]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/[0.06] bg-black/10 p-4"><p className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-600">{label}</p><p className="mt-2 text-sm font-semibold text-white">{value}</p></div>)}</section>

              <section className="rounded-[22px] border border-white/[0.07] bg-[#06121b] p-5"><div className="flex items-center gap-2"><BadgeDollarSign className="h-4 w-4 text-cyan-300" /><h4 className="text-sm font-semibold text-white">Plan access</h4></div><p className="mt-2 text-[11px] leading-5 text-slate-500">An admin override changes workspace permissions without modifying Stripe billing.</p><select value={plan} onChange={(event) => setPlan(event.target.value as AdminPlan)} disabled={isOwner || working} className="mt-4 h-11 w-full rounded-xl border border-white/[0.09] bg-[#091823] px-3 text-xs text-white outline-none focus:border-cyan-300/30"><option value="free">Free</option><option value="collector">Collector</option><option value="seller">Seller</option><option value="business">Store / Business</option></select><button type="button" disabled={isOwner || working || plan === selected.membership_level} onClick={() => void runAction({ action: "plan", plan })} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-xs font-bold text-slate-950 disabled:opacity-40">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeDollarSign className="h-4 w-4" />}Save plan</button>{isOwner ? <p className="mt-3 text-[10px] text-amber-200/60">The permanent owner always retains Store access.</p> : null}</section>

              {!isOwner ? <section className="rounded-[22px] border border-amber-300/[0.10] bg-amber-300/[0.025] p-5"><div className="flex items-center gap-2 text-amber-200"><Ban className="h-4 w-4" /><h4 className="text-sm font-semibold">Account access</h4></div><p className="mt-2 text-[11px] leading-5 text-amber-100/50">Suspension blocks sign-in but preserves the account and its data. Restore access at any time.</p><button type="button" disabled={working} onClick={() => void runAction({ action: selected.suspended ? "restore" : "suspend" })} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300/15 text-xs font-bold text-amber-100 hover:bg-amber-300/[0.05] disabled:opacity-40">{selected.suspended ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}{selected.suspended ? "Restore account access" : "Suspend account"}</button></section> : null}

              {!isOwner ? <section className="rounded-[22px] border border-rose-300/[0.12] bg-rose-400/[0.025] p-5"><div className="flex items-center gap-2 text-rose-200"><Trash2 className="h-4 w-4" /><h4 className="text-sm font-semibold">Delete account</h4></div><p className="mt-2 text-[11px] leading-5 text-rose-100/50">Permanently removes authentication and cascading account data. This cannot be undone.</p><label className="mt-4 block text-[9px] font-bold uppercase tracking-[0.14em] text-rose-200/60">Type DELETE to continue<input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-rose-300/[0.14] bg-black/20 px-3 text-xs text-white outline-none focus:border-rose-300/35" /></label><button type="button" disabled={working || deleteConfirm !== "DELETE"} onClick={() => void runAction({ confirmation: "DELETE" }, true)} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-400/[0.12] text-xs font-bold text-rose-100 hover:bg-rose-400/[0.18] disabled:opacity-35"><Trash2 className="h-4 w-4" />Permanently delete user</button></section> : null}

              {message ? <p role="status" className={`rounded-xl border px-3 py-2 text-xs ${/could not|error|required|cannot/i.test(message) ? "border-rose-300/15 bg-rose-300/[0.05] text-rose-200" : "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200"}`}>{message}</p> : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function PlanBadge({ plan }: { plan: AdminPlan }) {
  const classes = plan === "business" ? "border-amber-300/20 bg-amber-300/[0.06] text-amber-200" : plan === "seller" ? "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-200" : plan === "collector" ? "border-violet-300/20 bg-violet-300/[0.06] text-violet-200" : "border-white/[0.08] bg-white/[0.025] text-slate-500";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${classes}`}>{plan === "business" ? "Store" : plan}</span>;
}

function StatusBadge({ label, tone }: { label: string; tone: "emerald" | "amber" | "rose" | "slate" }) {
  const classes = tone === "emerald" ? "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200" : tone === "amber" ? "border-amber-300/15 bg-amber-300/[0.05] text-amber-200" : tone === "rose" ? "border-rose-300/15 bg-rose-300/[0.05] text-rose-200" : "border-white/[0.08] bg-white/[0.025] text-slate-500";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${classes}`}>{label}</span>;
}

function FeatureAccess({ features, query, setQuery, savingId, updateFeature }: { features: Feature[]; query: string; setQuery: (value: string) => void; savingId: string; updateFeature: (id: string, patch: Partial<Feature>) => void }) {
  return <section className="rounded-[24px] border border-white/[0.07] bg-[#06121b]">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.06] p-5 sm:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/65">Feature gates</p><h2 className="mt-2 text-xl font-semibold text-white">Feature Access</h2><p className="mt-1.5 text-xs text-slate-500">Control visibility and the minimum plan for every major website area.</p></div><label className="flex h-10 min-w-64 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/15 px-3"><Search className="h-3.5 w-3.5 text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search features…" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-700" /></label></div>
    <div className="divide-y divide-white/[0.055]">
      {features.map((feature) => <div key={feature.id} className="grid gap-4 p-5 transition hover:bg-white/[0.012] xl:grid-cols-[minmax(220px,1fr)_170px_165px] xl:items-center">
        <div><div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-slate-100">{feature.name}</h3><span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-600">{feature.category}</span>{savingId === feature.id ? <Loader2 className="h-3 w-3 animate-spin text-cyan-300" /> : null}</div><p className="mt-1 text-[11px] leading-5 text-slate-600">{feature.description}</p></div>
        <label><span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[0.16em] text-slate-700">Minimum plan</span><select value={feature.minimum_plan ?? "free"} onChange={(event) => void updateFeature(feature.id, { minimum_plan: event.target.value })} className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#091823] px-2 text-[11px] text-slate-300 outline-none"><option value="free">Free</option><option value="collector">Collector</option><option value="seller">Seller</option><option value="business">Business</option></select></label>
        <label><span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[0.16em] text-slate-700">Visibility</span><select value={feature.visibility} onChange={(event) => void updateFeature(feature.id, { visibility: event.target.value as Feature["visibility"] })} className={`h-9 w-full rounded-lg border px-2 text-[11px] outline-none ${feature.visibility === "enabled" ? "border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-200" : feature.visibility === "coming_soon" ? "border-amber-300/15 bg-amber-300/[0.04] text-amber-200" : "border-white/[0.08] bg-white/[0.02] text-slate-500"}`}><option value="enabled">Visible & enabled</option><option value="coming_soon">Coming soon</option><option value="hidden">Hidden</option></select></label>
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
  return <section className="rounded-[24px] border border-white/[0.07] bg-[#06121b] p-5 sm:p-6"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] text-cyan-200"><Icon className="h-5 w-5" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/65">Admin controls</p><h2 className="mt-1 text-xl font-semibold text-white">{content[0] as string}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{content[1] as string}</p></div></div><div className="mt-7 grid gap-3 sm:grid-cols-2">{cards.map((card) => <div key={card} className="flex min-h-20 items-center justify-between rounded-2xl border border-white/[0.06] bg-black/10 p-4"><div><p className="text-xs font-semibold capitalize text-slate-200">{card}</p><p className="mt-1 text-[10px] text-slate-600">{tab === "security" ? "Protected" : "Configured"}</p></div>{tab === "security" ? <Check className="h-4 w-4 text-emerald-300" /> : tab === "users" ? <span className="rounded-full border border-amber-300/15 bg-amber-300/[0.05] px-2 py-1 text-[9px] font-bold uppercase text-amber-200">Owner</span> : <ChevronRight className="h-4 w-4 text-slate-700" />}</div>)}</div>{tab === "security" ? <div className="mt-5 flex gap-3 rounded-2xl border border-amber-300/[0.1] bg-amber-300/[0.025] p-4"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/70" /><p className="text-[11px] leading-5 text-amber-100/50">Save the recovery codes shown by your authentication provider somewhere offline. Trading Docks never displays or stores your authenticator code.</p></div> : null}</section>;
}

function Stat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Activity }) {
  return <div className="rounded-[22px] border border-white/[0.07] bg-[#06121b] p-5"><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-slate-600">{label}</p><Icon className="h-4 w-4 text-cyan-300/55" /></div><p className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">{value}</p><p className="mt-1 text-[10px] text-slate-600">{detail}</p></div>;
}
