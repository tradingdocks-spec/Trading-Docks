"use client";

import Link from "next/link";
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
  DatabaseZap,
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
import {
  beginAdminTotpEnrollment,
  loadAdminMfaSecurityState,
  verifyAdminTotpFactor,
} from "@/app/actions/admin-mfa";
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
  | "catalog"
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
type AdminPlan = "free" | "collector" | "seller" | "store";
type AdminAccount = {
  id: string;
  email: string;
  full_name: string | null;
  role?: string | null;
  membership_level: AdminPlan;
  membership_override?: AdminPlan | null;
  card_units: number;
  unique_inventory_rows: number;
  created_at: string;
  last_sign_in_at: string | null;
  usage_updated_at: string | null;
  usage_source?: "inventory_items" | "account_card_usage" | "none";
  email_confirmed: boolean;
  suspended: boolean;
  banned_until: string | null;
};

type AdminNavItem =
  | { kind: "tab"; id: AdminTab; label: string; icon: typeof Activity }
  | { kind: "link"; label: string; icon: typeof Activity; href: string; child?: boolean };

const tabs: AdminNavItem[] = [
  { kind: "tab", id: "overview", label: "Overview", icon: Activity },
  { kind: "tab", id: "users", label: "Users", icon: Users },
  { kind: "tab", id: "trials", label: "Trials & Promotions", icon: TicketCheck },
  { kind: "tab", id: "plans", label: "Plans & Limits", icon: BadgeDollarSign },
  { kind: "tab", id: "plan-preview", label: "Plan Preview", icon: Eye },
  { kind: "tab", id: "features", label: "Feature Access", icon: SlidersHorizontal },
  { kind: "tab", id: "categories", label: "Categories", icon: LayoutGrid },
  { kind: "tab", id: "support", label: "Customer Support", icon: Headphones },
  { kind: "tab", id: "billing", label: "Billing & Credits", icon: ReceiptText },
  { kind: "tab", id: "communications", label: "Announcements", icon: Megaphone },
  { kind: "tab", id: "health", label: "System Health", icon: HeartPulse },
  { kind: "tab", id: "data", label: "Data & Backups", icon: DatabaseBackup },
  { kind: "tab", id: "catalog", label: "Catalog Management", icon: DatabaseZap },
  { kind: "link", href: "/dashboard/admin/catalog/tcgplayer", label: "TCGplayer Catalog", icon: DatabaseZap, child: true },
  { kind: "tab", id: "analytics", label: "Product Analytics", icon: BarChart3 },
  { kind: "tab", id: "feedback", label: "Feedback & Beta", icon: Lightbulb },
  { kind: "tab", id: "integrations", label: "Integrations", icon: PlugZap },
  { kind: "tab", id: "security", label: "Security", icon: ShieldCheck },
  { kind: "tab", id: "audit", label: "Audit Log", icon: Eye },
];

const fallbackFeatures: Feature[] = [
  { id: "dashboard", name: "Dashboard", category: "Core", description: "Account overview and workspace metrics.", visibility: "enabled", minimum_plan: "free", usage_limit: null },
  { id: "inventory", name: "Inventory", category: "Collection", description: "Singles, sealed product, boxes, and binders.", visibility: "enabled", minimum_plan: "collector", usage_limit: null },
  { id: "deck-vault", name: "Deck Vault", category: "Collection", description: "Deck building, importing, and analysis. Free includes 10 decks; Collector includes 50.", visibility: "enabled", minimum_plan: "free", usage_limit: 10 },
  { id: "collection-buying", name: "Collection Buying", category: "Purchasing", description: "Appraise and purchase collections.", visibility: "enabled", minimum_plan: "seller", usage_limit: null },
  { id: "marketplaces", name: "Marketplaces", category: "Sales", description: "Listings and marketplace workflows.", visibility: "coming_soon", minimum_plan: "seller", usage_limit: null },
  { id: "finances", name: "Finances", category: "Business", description: "Expenses, payouts, and reporting.", visibility: "enabled", minimum_plan: "store", usage_limit: null },
  { id: "employees", name: "Employees", category: "Business", description: "Team access and payroll tools.", visibility: "enabled", minimum_plan: "store", usage_limit: null },
];

export function AdminControlCenter({ adminIdentityLabel }: { adminIdentityLabel: string }) {
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
        adminIdentityLabel={adminIdentityLabel}
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

  return <AdminWorkspace adminIdentityLabel={adminIdentityLabel} initialFeatures={fallbackFeatures} />;
}

function AdminSecurityGate({
  adminIdentityLabel, factors, enrollment, code, error, working, onCode, onEnroll, onVerify,
}: {
  adminIdentityLabel: string;
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
            Protected access for <span className="font-medium text-td-primary">{adminIdentityLabel}</span>. Verify with your authenticator before viewing or changing account access.
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
                <div className="mb-5 rounded-2xl border border-td-success/15 bg-td-success/[0.045] p-4">
                  <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-td-success" />
                  <div><p className="text-sm font-semibold text-td-success">Authenticator is enabled</p><p className="mt-0.5 text-xs text-td-success/55">Enter a fresh code to unlock admin controls.</p></div>
                  </div>
                  <button type="button" disabled={working} onClick={onEnroll} className="mt-4 w-full rounded-xl border border-td-warning/20 px-3 py-2.5 text-left text-xs font-semibold text-td-warning transition hover:bg-td-warning/[0.06] disabled:opacity-50">
                    Lost access? Set up a replacement authenticator
                  </button>
                  <p className="mt-2 text-[11px] leading-5 text-td-success/55">You’ll verify the new authenticator before it can unlock admin controls.</p>
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

function AdminWorkspace({ adminIdentityLabel, initialFeatures }: { adminIdentityLabel: string; initialFeatures: Feature[] }) {
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
            <div><p className="text-[11px] font-semibold text-td-success">Authenticator verified</p><p className="text-[11px] text-td-success/45">{adminIdentityLabel}</p></div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit max-h-[calc(100vh-112px)] overflow-y-auto rounded-[22px] border border-td-ink/[0.07] bg-td-surface p-2 lg:sticky lg:top-[96px]">
          <p className="px-3 pb-2 pt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-td-muted">Administration</p>
          <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
            {tabs.map((item) => {
              const Icon = item.icon;
              if (item.kind === "link") {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-h-9 items-center gap-2 rounded-xl border border-transparent px-3 text-left text-[11px] font-semibold text-td-muted transition hover:bg-td-ink/[0.025] hover:text-td-secondary ${item.child ? "ml-4 border-l-white/[0.08] pl-4" : ""}`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-left text-[11px] font-semibold transition ${tab === item.id ? "border border-td-accent/[0.15] bg-td-accent/[0.065] text-td-accent-text" : "border border-transparent text-td-muted hover:bg-td-ink/[0.025] hover:text-td-secondary"}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {tab === item.id ? <ChevronRight className="ml-auto hidden h-3 w-3 lg:block" /> : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          {tab === "overview" ? <Overview features={features} adminIdentityLabel={adminIdentityLabel} accounts={accounts} onNavigate={setTab} /> : null}
          {tab === "users" ? <UserDirectory accounts={accounts} loading={accountsLoading} error={accountsError} onRefresh={loadAccounts} /> : null}
          {tab === "plan-preview" ? <PlanPreview /> : null}
          {tab === "features" ? <FeatureAccess features={filtered} query={query} setQuery={setQuery} savingId={savingId} updateFeature={updateFeature} /> : null}
          {tab === "trials" ? <TrialsManager /> : null}
          {tab === "feedback" ? <AdminFeedbackQueue /> : null}
          {tab === "integrations" ? <AdminIntegrations /> : null}
          {["support", "billing", "communications", "health", "data", "analytics"].includes(tab) ? <OperationsSection tab={tab as OperationsTab} /> : null}
          {["plans", "categories", "catalog", "security", "audit"].includes(tab) ? <SectionPlaceholder tab={tab as CorePlaceholderTab} features={features} adminIdentityLabel={adminIdentityLabel} /> : null}
        </main>
      </div>
      {notice ? <div role="status" className="fixed bottom-5 right-5 z-[150] rounded-xl border border-td-accent/15 bg-td-surface px-4 py-3 text-xs font-medium text-td-accent-text shadow-2xl">{notice}</div> : null}
    </div>
  );
}

type PlatformIntegration = {
  marketplace_id: string;
  credential_labels: Record<string, string>;
  enabled: boolean;
  updated_at: string;
};

type EbayConnectionState = {
  status?: string | null;
  health?: string | null;
  syncMode?: string | null;
  lastSyncAt?: string | null;
  updatedAt?: string | null;
  environment?: string | null;
  accessTokenExpired?: boolean;
  refreshTokenValid?: boolean;
  scopes?: string[];
};

type MarketplaceIntegrationsResponse = {
  integrations?: PlatformIntegration[];
  deploymentEnvironment?: "staging" | "production";
  ebayConnection?: EbayConnectionState | null;
  error?: string;
};

function AdminIntegrations() {
  const [integration, setIntegration] = useState<PlatformIntegration | null>(null);
  const [deploymentEnvironment, setDeploymentEnvironment] = useState<"staging" | "production">("staging");
  const [ebayConnection, setEbayConnection] = useState<EbayConnectionState | null>(null);
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
        const body = await response.json() as MarketplaceIntegrationsResponse;
        if (!response.ok) throw new Error(body.error ?? "Could not load integrations.");
        setDeploymentEnvironment(body.deploymentEnvironment ?? "staging");
        setIntegration(body.integrations?.find((item) => item.marketplace_id === "ebay") ?? null);
        setEbayConnection(body.ebayConnection ?? null);
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
        credentials: { environment: deploymentEnvironment === "production" ? "production" : "sandbox", clientId, clientSecret, ruName },
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

  const sandboxConfigured = integration?.credential_labels.environment === "sandbox";
  const validSandboxConnection =
    sandboxConfigured &&
    ebayConnection?.environment === "sandbox" &&
    ebayConnection?.refreshTokenValid === true;
  const hasPriorConnection = Boolean(ebayConnection);
  const connectLabel = validSandboxConnection
    ? "Reconnect eBay Sandbox"
    : hasPriorConnection
      ? "Reconnect eBay Sandbox"
      : "Connect eBay Sandbox";
  const connectionStatus = validSandboxConnection
    ? "Connected to eBay Sandbox"
    : hasPriorConnection
      ? "Reconnect Required"
      : integration?.credential_labels.clientId && integration?.credential_labels.clientSecret && integration?.credential_labels.ruName
        ? "Ready to Connect"
        : "Configuration Incomplete";

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
    <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-td-accent-text/65">Platform integrations</p>
          <h2 className="mt-1 text-xl font-semibold text-td-primary">Marketplace application credentials</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-td-muted">Configure each marketplace once. Stores only see Connect, Reconnect, and Disconnect controls for their own account.</p>
        </div>
        <span className="rounded-full border border-td-warning/15 bg-td-warning/[0.05] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-td-warning">Owner only</span>
      </div>

      <div className="mt-6 rounded-[22px] border border-td-ink/[0.07] bg-black/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-td-accent/15 bg-td-accent/[0.05] text-td-accent-text"><PlugZap className="h-5 w-5" /></div>
            <div><h3 className="text-sm font-semibold text-td-primary">eBay Sandbox</h3><p className="mt-1 text-[11px] text-td-muted">Encrypted developer credentials · separate consent per store</p></div>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${integration?.enabled ? "border-td-success/15 bg-td-success/[0.05] text-td-success" : "border-td-line/10 bg-td-ink/[0.03] text-td-muted"}`}>
            {loading ? "Checking" : integration?.enabled ? "Available to stores" : integration ? "Paused" : "Not configured"}
          </span>
        </div>

        {integration && !editing ? (
          <div className="mt-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Client ID", integration.credential_labels.clientId ? "Configured" : "Missing"],
                ["Client Secret", integration.credential_labels.clientSecret ? "Configured" : "Missing"],
                ["RuName", integration.credential_labels.ruName ? "Configured" : "Missing"],
                ["Environment", integration.credential_labels.environment === "sandbox" ? "Sandbox" : "Configured"],
              ].map(([label, value]) => <div key={label} className="rounded-xl border border-td-ink/[0.06] bg-td-ink/[0.02] p-3"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-td-muted">{label}</p><p className="mt-1.5 text-xs font-semibold text-td-secondary">{value}</p></div>)}
            </div>
            <div className="mt-4 rounded-xl border border-td-success/15 bg-td-success/[0.04] p-3"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-td-success">Status</p><p className="mt-1 text-sm font-semibold text-td-primary">{connectionStatus}</p>{hasPriorConnection ? <p className="mt-1 text-[11px] text-td-muted">Stored seller connection: {ebayConnection?.environment ?? "legacy/unknown"} · {ebayConnection?.syncMode ?? "unknown mode"}{ebayConnection?.accessTokenExpired ? " · access token expired" : ""}</p> : null}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setEditing(true)} className="h-10 rounded-xl border border-td-accent/15 px-4 text-xs font-bold text-td-accent-text hover:bg-td-accent/[0.06]">Replace credentials</button>
              {sandboxConfigured ? <Link href="/api/marketplaces/ebay/authorize" className="inline-flex h-10 items-center gap-2 rounded-xl bg-td-accent px-4 text-xs font-bold text-td-on-accent"><PlugZap className="h-4 w-4" />{connectLabel}</Link> : null}
              <button type="button" disabled={saving} onClick={() => void toggleEnabled()} className="h-10 rounded-xl border border-td-ink/[0.08] px-4 text-xs font-semibold text-td-secondary hover:bg-td-ink/[0.03]">{integration.enabled ? "Pause customer connections" : "Enable customer connections"}</button>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-[11px] font-semibold text-td-secondary">Environment<input value={deploymentEnvironment === "production" ? "production" : "sandbox"} readOnly aria-readonly="true" className="mt-1.5 h-10 w-full rounded-xl border border-td-success/20 bg-td-success/[0.04] px-3 text-xs font-semibold text-td-success outline-none" /></label>
            <label className="text-[11px] font-semibold text-td-secondary">Client ID<input value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" className="mt-1.5 h-10 w-full rounded-xl border border-td-ink/[0.08] bg-black/20 px-3 text-xs text-td-primary outline-none focus:border-td-accent/30" /></label>
            <label className="text-[11px] font-semibold text-td-secondary">Client Secret<input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} autoComplete="new-password" className="mt-1.5 h-10 w-full rounded-xl border border-td-ink/[0.08] bg-black/20 px-3 text-xs text-td-primary outline-none focus:border-td-accent/30" /></label>
            <label className="text-[11px] font-semibold text-td-secondary">RuName<input value={ruName} onChange={(event) => setRuName(event.target.value)} autoComplete="off" className="mt-1.5 h-10 w-full rounded-xl border border-td-ink/[0.08] bg-black/20 px-3 text-xs text-td-primary outline-none focus:border-td-accent/30" /></label>
            <div className="flex gap-2 sm:col-span-2">
              <button type="button" disabled={saving || !clientId || !clientSecret || !ruName} onClick={() => void save()} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-td-accent text-xs font-bold text-td-on-accent disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Save Sandbox Configuration</button>
              {integration ? <button type="button" onClick={() => setEditing(false)} className="h-11 rounded-xl border border-td-ink/[0.08] px-4 text-xs text-td-secondary">Cancel</button> : null}
            </div>
          </div>
        )}
        <div className="mt-4 flex gap-3 rounded-xl border border-td-success/10 bg-td-success/[0.025] p-3 text-[11px] leading-4 text-td-success/55"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-td-success" />The saved secret is encrypted server-side and never displayed again. Vercel and Supabase infrastructure secrets remain outside this dashboard.</div>
        {message ? <p role="status" className={`mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5 ${message.startsWith("eBay is configured") || message.includes("enabled.") ? "border-td-success/15 bg-td-success/[0.04] text-td-success" : "border-td-warning/15 bg-td-warning/[0.04] text-td-warning"}`}>{message}</p> : null}
      </div>
    </section>
  );
}

function Overview({ features, adminIdentityLabel, accounts, onNavigate }: { features: Feature[]; adminIdentityLabel: string; accounts: AdminAccount[]; onNavigate: (tab: AdminTab) => void }) {
  const enabled = features.filter((feature) => feature.visibility === "enabled").length;
  const totalCards = accounts.reduce((total, account) => total + Number(account.card_units || 0), 0);
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
      <Stat label="Registered users" value={accounts.length.toLocaleString("en-US")} detail="All site accounts" icon={Users} />
      <button type="button" onClick={() => onNavigate("trials")} className="rounded-[22px] border border-td-warning/[0.16] bg-td-warning/[0.035] p-5 text-left transition hover:border-td-warning/30 hover:bg-td-warning/[0.06]">
        <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-td-warning/65">Trial controls</p><TicketCheck className="h-4 w-4 text-td-warning/70" /></div>
        <p className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-td-primary">Ready</p>
        <p className="mt-1 text-[11px] text-td-warning/45">Open Trials & Promotions →</p>
      </button>
      <Stat label="Cards uploaded" value={totalCards.toLocaleString("en-US")} detail="Across all account inventory" icon={DatabaseBackup} />
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
      <div className="rounded-[24px] border border-td-warning/[0.11] bg-td-warning/[0.025] p-5"><div className="flex items-center gap-2 text-td-warning"><ShieldCheck className="h-4 w-4" /><h3 className="text-sm font-semibold">Role-based authority</h3></div><p className="mt-3 text-xs leading-5 text-td-warning/55">{adminIdentityLabel} is authorized by the `user_roles` table. Admin authority stays separate from subscription tier and billing status.</p></div>
    </section>
  </div>;
}

function UserDirectory({
  accounts,
  loading,
  error,
  onRefresh,
}: {
  accounts: AdminAccount[];
  loading: boolean;
  error: string;
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
  const currentManualPlan = selected?.membership_override ?? null;

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
          membership_override: payload.action === "plan" ? plan : current.membership_override,
          suspended: payload.action === "suspend" ? true : payload.action === "restore" ? false : current.suspended,
        } : current);
      }
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : "The account could not be updated.");
    } finally {
      setWorking(false);
    }
  }

  const isOwner = selected?.role === "owner";

  return (
    <>
      <section className="overflow-hidden rounded-[24px] border border-td-ink/[0.07] bg-td-surface">
        <div className="border-b border-td-ink/[0.06] p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-td-accent-text/65">Account directory</p>
              <h2 className="mt-2 text-xl font-semibold text-td-primary">User management</h2>
              <p className="mt-1.5 text-xs text-td-muted">Change plans, suspend access, inspect account activity, or safely remove customer accounts.</p>
            </div>
            <label className="flex h-10 min-w-64 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-black/15 px-3">
              <Search className="h-3.5 w-3.5 text-td-muted" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or plan…" className="min-w-0 flex-1 bg-transparent text-xs text-td-primary outline-none placeholder:text-td-muted" />
            </label>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Total accounts" value={accounts.length.toLocaleString("en-US")} detail="Registered users" icon={Users} />
            <Stat label="Cards uploaded" value={totalCards.toLocaleString("en-US")} detail="Total inventory quantity" icon={DatabaseBackup} />
            <Stat label="Paid members" value={paidAccounts.toLocaleString("en-US")} detail="Collector through Store" icon={BadgeDollarSign} />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-xs text-td-muted"><Loader2 className="h-4 w-4 animate-spin text-td-accent-text" />Loading accounts…</div>
        ) : error ? (
          <p role="alert" className="m-5 rounded-xl border border-td-danger/15 bg-td-danger/[0.05] px-4 py-3 text-xs text-td-danger">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left">
              <thead className="border-b border-td-ink/[0.06] bg-black/10 text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">
                <tr><th className="px-5 py-3">Account</th><th className="px-5 py-3">Membership</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Cards</th><th className="px-5 py-3">Joined</th><th className="px-5 py-3">Last sign-in</th><th className="w-16 px-5 py-3"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-td-ink/[0.05]">
                {filteredAccounts.map((account) => {
                  const permanentOwner = account.role === "owner";
                  return (
                    <tr key={account.id} onClick={() => openAccount(account)} className="cursor-pointer text-xs transition hover:bg-td-accent/[0.025]">
                      <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-td-accent/10 bg-td-accent/[0.035] text-td-accent-text"><UserRoundCog className="h-4 w-4" /></div><div><p className="font-semibold text-td-primary">{account.full_name || account.email.split("@")[0]}</p><p className="mt-1 text-[11px] text-td-muted">{account.email}</p></div></div></td>
                      <td className="px-5 py-4"><PlanBadge plan={account.membership_level} />{account.membership_override ? <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-td-warning/60">Admin override</p> : null}</td>
                      <td className="px-5 py-4">{permanentOwner ? <StatusBadge label="Owner role" tone="amber" /> : account.suspended ? <StatusBadge label="Suspended" tone="rose" /> : account.email_confirmed ? <StatusBadge label="Active" tone="emerald" /> : <StatusBadge label="Unconfirmed" tone="slate" />}</td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-td-primary">{Number(account.card_units || 0).toLocaleString("en-US")}</td>
                      <td className="px-5 py-4 text-[11px] text-td-muted">{new Date(account.created_at).toLocaleDateString("en-US")}</td>
                      <td className="px-5 py-4 text-[11px] text-td-muted">{account.last_sign_in_at ? new Date(account.last_sign_in_at).toLocaleDateString("en-US") : "Never"}</td>
                      <td className="px-5 py-4 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); openAccount(account); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-td-ink/[0.07] text-td-muted transition hover:bg-td-ink/[0.04] hover:text-td-primary" aria-label={`Manage ${account.email}`}><EllipsisVertical className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filteredAccounts.length ? <p className="px-5 py-10 text-center text-xs text-td-muted">No accounts match this search.</p> : null}
          </div>
        )}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-[180] flex justify-end bg-black/55 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <aside className="h-full w-full max-w-[480px] overflow-y-auto border-l border-td-accent/[0.12] bg-td-surface shadow-[-35px_0_100px_rgb(var(--td-shadow-rgb)/calc(.5*var(--td-shadow-strength)))]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-td-ink/[0.07] bg-td-surface/95 px-5 py-4 backdrop-blur-xl"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-td-accent-text/65">Customer 360</p><h3 className="mt-1 text-lg font-semibold text-td-primary">Manage account</h3></div><button type="button" onClick={() => setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-td-ink/[0.08] text-td-muted hover:text-td-primary"><X className="h-4 w-4" /></button></div>
            <div className="space-y-5 p-5">
              <section className="rounded-[22px] border border-td-ink/[0.07] bg-td-surface p-5"><div className="flex items-start gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-td-accent/15 bg-td-accent/[0.05] text-td-accent-text"><UserRoundCog className="h-5 w-5" /></div><div className="min-w-0"><h4 className="truncate text-base font-semibold text-td-primary">{selected.full_name || selected.email.split("@")[0]}</h4><p className="mt-1 truncate text-xs text-td-muted">{selected.email}</p><div className="mt-3 flex flex-wrap gap-2"><PlanBadge plan={selected.membership_level} />{isOwner ? <StatusBadge label="Owner role" tone="amber" /> : selected.suspended ? <StatusBadge label="Suspended" tone="rose" /> : <StatusBadge label="Active" tone="emerald" />}</div></div></div></section>

              <section className="grid grid-cols-2 gap-3">{[["Cards uploaded", Number(selected.card_units || 0).toLocaleString("en-US")],["Inventory rows", Number(selected.unique_inventory_rows || 0).toLocaleString("en-US")],["Joined", new Date(selected.created_at).toLocaleDateString("en-US")],["Last sign-in", selected.last_sign_in_at ? new Date(selected.last_sign_in_at).toLocaleDateString("en-US") : "Never"]].map(([label, value]) => <div key={label} className="rounded-2xl border border-td-ink/[0.06] bg-black/10 p-4"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-td-muted">{label}</p><p className="mt-2 text-sm font-semibold text-td-primary">{value}</p></div>)}</section>

              <section className="rounded-[22px] border border-td-ink/[0.07] bg-td-surface p-5"><div className="flex items-center gap-2"><BadgeDollarSign className="h-4 w-4 text-td-accent-text" /><h4 className="text-sm font-semibold text-td-primary">Plan access</h4></div><p className="mt-2 text-[11px] leading-5 text-td-muted">An admin override changes workspace permissions without modifying RevenueCat billing.</p><select value={plan} onChange={(event) => setPlan(event.target.value as AdminPlan)} disabled={isOwner || working} className="mt-4 h-11 w-full rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-xs text-td-primary outline-none focus:border-td-accent/30"><option value="free">Free</option><option value="collector">Collector</option><option value="seller">Seller</option><option value="store">Store</option></select><button type="button" disabled={isOwner || working || currentManualPlan === plan} onClick={() => void runAction({ action: "plan", plan })} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-td-accent text-xs font-bold text-td-on-accent disabled:opacity-40">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeDollarSign className="h-4 w-4" />}Save plan</button>{isOwner ? <p className="mt-3 text-[11px] text-td-warning/60">Owner role changes must be handled through role administration, not membership controls.</p> : null}</section>

              {!isOwner ? <section className="rounded-[22px] border border-td-warning/[0.10] bg-td-warning/[0.025] p-5"><div className="flex items-center gap-2 text-td-warning"><Ban className="h-4 w-4" /><h4 className="text-sm font-semibold">Account access</h4></div><p className="mt-2 text-[11px] leading-5 text-td-warning/50">Suspension blocks sign-in but preserves the account and its data. Restore access at any time.</p><button type="button" disabled={working} onClick={() => void runAction({ action: selected.suspended ? "restore" : "suspend" })} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-td-warning/15 text-xs font-bold text-td-warning hover:bg-td-warning/[0.05] disabled:opacity-40">{selected.suspended ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}{selected.suspended ? "Restore account access" : "Suspend account"}</button></section> : null}

              {!isOwner ? <section className="rounded-[22px] border border-td-danger/[0.12] bg-td-danger/[0.025] p-5"><div className="flex items-center gap-2 text-td-danger"><Trash2 className="h-4 w-4" /><h4 className="text-sm font-semibold">Delete account</h4></div><p className="mt-2 text-[11px] leading-5 text-td-danger/50">Permanently removes authentication and cascading account data. This cannot be undone.</p><label className="mt-4 block text-[11px] font-bold uppercase tracking-[0.14em] text-td-danger/60">Type DELETE to continue<input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-td-danger/[0.14] bg-black/20 px-3 text-xs text-td-primary outline-none focus:border-td-danger/35" /></label><button type="button" disabled={working || deleteConfirm !== "DELETE"} onClick={() => void runAction({ confirmation: "DELETE" }, true)} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-td-danger/[0.12] text-xs font-bold text-td-danger hover:bg-td-danger/[0.18] disabled:opacity-35"><Trash2 className="h-4 w-4" />Permanently delete user</button></section> : null}

              {message ? <p role="status" className={`rounded-xl border px-3 py-2 text-xs ${/could not|error|required|cannot/i.test(message) ? "border-td-danger/15 bg-td-danger/[0.05] text-td-danger" : "border-td-success/15 bg-td-success/[0.05] text-td-success"}`}>{message}</p> : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function PlanBadge({ plan }: { plan: AdminPlan }) {
  const classes = plan === "store" ? "border-td-warning/20 bg-td-warning/[0.06] text-td-warning" : plan === "seller" ? "border-td-accent/20 bg-td-accent/[0.06] text-td-accent-text" : plan === "collector" ? "border-td-violet/20 bg-td-violet/[0.06] text-td-violet" : "border-td-ink/[0.08] bg-td-ink/[0.025] text-td-muted";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${classes}`}>{plan === "store" ? "Store" : plan}</span>;
}

function StatusBadge({ label, tone }: { label: string; tone: "emerald" | "amber" | "rose" | "slate" }) {
  const classes = tone === "emerald" ? "border-td-success/15 bg-td-success/[0.05] text-td-success" : tone === "amber" ? "border-td-warning/15 bg-td-warning/[0.05] text-td-warning" : tone === "rose" ? "border-td-danger/15 bg-td-danger/[0.05] text-td-danger" : "border-td-ink/[0.08] bg-td-ink/[0.025] text-td-muted";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] ${classes}`}>{label}</span>;
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

type CorePlaceholderTab = "users" | "plans" | "categories" | "catalog" | "security" | "audit";

function SectionPlaceholder({ tab, features, adminIdentityLabel }: { tab: CorePlaceholderTab; features: Feature[]; adminIdentityLabel: string }) {
  const sectionContent = {
    users: ["User Access", "Search accounts, review subscription levels, and apply individual feature overrides.", Users],
    plans: ["Plans & Limits", "Set plan pricing, feature bundles, and usage limits from one central ruleset.", BadgeDollarSign],
    categories: ["Categories & Navigation", "Choose whether website categories are visible, hidden, or presented as coming soon.", LayoutGrid],
    catalog: ["Catalog Management", "Manage canonical platform reference catalogs used for pricing, matching, exports, and marketplace workflows.", DatabaseZap],
    security: ["Security", `Authenticator protection is active for ${adminIdentityLabel}. Sensitive actions require a fresh verified session.`, ShieldCheck],
    audit: ["Audit Log", "Review plan, permission, category, and security changes with their exact time and actor.", Eye],
  } satisfies Record<CorePlaceholderTab, [string, string, typeof Activity]>;
  const content = sectionContent[tab];
  const Icon = content[2] as typeof Activity;
  const cards = tab === "plans"
    ? ["Free", "Collector", "Seller", "Store"]
    : tab === "categories"
      ? [...new Set(features.map((feature) => feature.category))]
      : tab === "catalog"
        ? ["TCGplayer Catalog"]
        : tab === "security"
          ? ["Authenticator MFA", "Role protection", "Session assurance", "Recovery planning"]
          : tab === "users"
            ? [adminIdentityLabel]
            : ["No changes recorded"];

  return (
    <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-td-accent/15 bg-td-accent/[0.055] text-td-accent-text">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-td-accent-text/65">Admin controls</p>
          <h2 className="mt-1 text-xl font-semibold text-td-primary">{content[0] as string}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-td-muted">{content[1] as string}</p>
        </div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {cards.map((card) => tab === "catalog" ? (
          <Link
            key={card}
            href="/dashboard/admin/catalog/tcgplayer"
            className="flex min-h-20 items-center justify-between rounded-2xl border border-td-accent/[0.12] bg-td-accent/[0.035] p-4 transition hover:bg-td-accent/[0.06]"
          >
            <div>
              <p className="text-xs font-semibold text-td-accent-text">{card}</p>
              <p className="mt-1 text-[11px] text-td-accent-text/50">Canonical Magic pricing and matching reference</p>
            </div>
            <ChevronRight className="h-4 w-4 text-td-accent-text" />
          </Link>
        ) : (
          <div key={card} className="flex min-h-20 items-center justify-between rounded-2xl border border-td-ink/[0.06] bg-black/10 p-4">
            <div>
              <p className="text-xs font-semibold capitalize text-td-primary">{card}</p>
              <p className="mt-1 text-[11px] text-td-muted">{tab === "security" ? "Protected" : "Configured"}</p>
            </div>
            {tab === "security" ? (
              <Check className="h-4 w-4 text-td-success" />
            ) : tab === "users" ? (
              <span className="rounded-full border border-td-warning/15 bg-td-warning/[0.05] px-2 py-1 text-[11px] font-bold uppercase text-td-warning">Owner</span>
            ) : (
              <ChevronRight className="h-4 w-4 text-td-muted" />
            )}
          </div>
        ))}
      </div>

      {tab === "security" ? (
        <div className="mt-5 flex gap-3 rounded-2xl border border-td-warning/[0.1] bg-td-warning/[0.025] p-4">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-td-warning/70" />
          <p className="text-[11px] leading-5 text-td-warning/50">Save the recovery codes shown by your authentication provider somewhere offline. Trading Docks never displays or stores your authenticator code.</p>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Activity }) {
  return <div className="rounded-[22px] border border-td-ink/[0.07] bg-td-surface p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-td-muted">{label}</p><Icon className="h-4 w-4 text-td-accent-text/55" /></div><p className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-td-primary">{value}</p><p className="mt-1 text-[11px] text-td-muted">{detail}</p></div>;
}
