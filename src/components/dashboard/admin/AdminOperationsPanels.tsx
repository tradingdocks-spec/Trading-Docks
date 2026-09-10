"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BellRing,
  CheckCircle2,
  CloudCog,
  DatabaseBackup,
  Download,
  Headphones,
  HeartPulse,
  Lightbulb,
  Mail,
  Megaphone,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";

export type OperationsTab =
  | "support"
  | "billing"
  | "communications"
  | "health"
  | "data"
  | "analytics"
  | "feedback";

type ProviderHealth = {
  provider: "tcgtracking";
  status: "available" | "unavailable";
  baseUrl: string;
  metaVersion?: string;
  categoryCount?: number;
  lastCheckedAt?: string;
  latencyMs: number | null;
  cachePolicy: {
    staticDataTtlDays: number;
    pricingTtlHours: number;
  };
  localSchema: "proposal-only";
  localCatalog?: LocalCatalogStatus;
  sync?: {
    mapping?: {
      status: string;
      processed: number;
      updatedAt?: string;
      completedAt?: string | null;
    } | null;
    pricing?: {
      status: string;
      processed: number;
      updatedAt?: string;
      completedAt?: string | null;
    } | null;
  };
  error?: string;
};

type LocalCatalogStatus = {
  status: "available" | "failed";
  table: "tcgplayer_magic_catalog";
  schema: "ready" | "failed";
  rows?: number | null;
  sampleRowAvailable: boolean;
  smokeQuery: string;
  requestedColumns: string;
  error?: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
    status?: number;
    statusCode?: number;
  };
};

type CatalogReconciliation = {
  status: "completed" | "provider_failed" | "catalog_read_failed";
  readiness: "FAILED" | "GREEN" | "YELLOW" | "RED";
  sampleSize: number;
  productsTested: number;
  providerSkusTested: number;
  localSkuRowsFound: number;
  localCatalogCoverageRate?: number | null;
  providerSkuCoverageRate?: number | null;
  exactSkuMatches: number;
  missingLocalSkus: number;
  missingProviderSkus: number;
  providerOnlySkus?: number;
  providerOnlyLanguageVariants?: Record<string, number>;
  trueConflictCount?: number;
  exactSkuMatchRate: number | null;
  recommendation: "green" | "yellow" | "red" | null;
  conflictBreakdown: Record<"identity" | "condition" | "finish" | "language" | "pricing", number>;
  pricingDeltaSummary: {
    medianMarketDelta: number | null;
    medianLowDelta: number | null;
    medianAbsoluteMarketDelta?: number | null;
    medianAbsoluteLowDelta?: number | null;
    maxMarketDelta: number | null;
    maxLowDelta: number | null;
    percentMarketWithinOneCent?: number | null;
    percentMarketWithinOnePercent: number | null;
    percentMarketWithinFivePercent: number | null;
    percentLowWithinOneCent?: number | null;
    percentLowWithinOnePercent: number | null;
    percentLowWithinFivePercent: number | null;
    localNullPriceCount: number;
    providerNullPriceCount: number;
  };
  conflicts: Array<{
    productId: number | null;
    skuId?: number;
    field: string;
    type: string;
    local: unknown;
    provider: unknown;
  }>;
  error?: string;
  failure?: {
    stage: string;
    method?: string;
    url?: string;
    endpoint?: string;
    status?: number;
    statusCode?: number;
    contentType?: string | null;
    bodyPreview?: string;
    table?: string;
    requestedColumns?: string;
    code?: string;
    details?: string;
    hint?: string;
    message: string;
  };
  localCatalog?: LocalCatalogStatus;
};

const sections = {
  support: {
    eyebrow: "Customer operations",
    title: "Customer Support",
    description: "Find an account, review its access and recent activity, keep private support notes, and resolve common account issues.",
    icon: Headphones,
    stats: [["Open cases", "0"], ["Accounts flagged", "0"], ["Avg. response", "—"], ["Resolved today", "0"]],
    cards: ["Account diagnostics", "Support notes", "Access assistance", "Customer history"],
  },
  billing: {
    eyebrow: "Revenue operations",
    title: "Billing, Refunds & Credits",
    description: "Review subscriptions, invoices, failed payments, promotional credits, refunds, and plan changes in one place.",
    icon: ReceiptText,
    stats: [["Active subscribers", "0"], ["Monthly revenue", "$0"], ["Past due", "0"], ["Credits issued", "$0"]],
    cards: ["Subscriptions", "Invoices", "Refunds & credits", "Coupons"],
  },
  communications: {
    eyebrow: "Customer communication",
    title: "Announcements & Email",
    description: "Prepare product announcements, trial reminders, maintenance notices, and targeted customer messages.",
    icon: Megaphone,
    stats: [["Drafts", "0"], ["Scheduled", "0"], ["Sent this month", "0"], ["Delivery issues", "0"]],
    cards: ["Product announcement", "Trial expiration", "Maintenance notice", "Targeted email"],
  },
  health: {
    eyebrow: "Platform operations",
    title: "System & Integration Health",
    description: "See database, storage, background-job, email, and marketplace integration status without leaving the admin panel.",
    icon: HeartPulse,
    stats: [["Platform", "Healthy"], ["Failed jobs", "0"], ["Integrations", "Ready"], ["Alerts", "0"]],
    cards: ["Database & storage", "Background jobs", "Email delivery", "Marketplace connections", "TCGTracking provider"],
  },
  data: {
    eyebrow: "Data management",
    title: "Exports, Backups & Privacy",
    description: "Create account exports, review backup status, and manage customer access or deletion requests safely.",
    icon: DatabaseBackup,
    stats: [["Last backup", "Not connected"], ["Exports queued", "0"], ["Privacy requests", "0"], ["Retention alerts", "0"]],
    cards: ["Full account export", "Backup history", "Deletion requests", "Retention rules"],
  },
  analytics: {
    eyebrow: "Product intelligence",
    title: "Product Analytics",
    description: "Track trials, conversions, retention, feature adoption, and the workflows customers use most.",
    icon: BarChart3,
    stats: [["Active users", "1"], ["Trial conversion", "0%"], ["30-day retention", "—"], ["Usage events", "0"]],
    cards: ["Trial funnel", "Feature adoption", "Account retention", "Plan performance"],
  },
  feedback: {
    eyebrow: "Product development",
    title: "Feedback, Bugs & Beta Groups",
    description: "Keep customer requests, reported problems, beta access, and release follow-up organized in one queue.",
    icon: Lightbulb,
    stats: [["Open requests", "0"], ["Reported bugs", "0"], ["Beta testers", "0"], ["Shipped", "0"]],
    cards: ["Feature requests", "Bug reports", "Beta groups", "Release follow-up"],
  },
} satisfies Record<OperationsTab, {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Activity;
  stats: string[][];
  cards: string[];
}>;

export function OperationsSection({ tab }: { tab: OperationsTab }) {
  const section = sections[tab];
  const Icon = section.icon;
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [providerHealth, setProviderHealth] =
    useState<ProviderHealth | null>(null);
  const [providerError, setProviderError] = useState("");
  const [providerAction, setProviderAction] = useState("");
  const [providerBusy, setProviderBusy] = useState("");
  const [catalogReconciliation, setCatalogReconciliation] =
    useState<CatalogReconciliation | null>(null);
  const visibleCards = useMemo(
    () => section.cards.filter((card) => card.toLowerCase().includes(query.toLowerCase())),
    [query, section.cards],
  );

  useEffect(() => {
    if (tab !== "health") return;
    let active = true;

    async function loadProviderHealth() {
      try {
        const response = await fetch("/api/admin/tcgtracking/status", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ProviderHealth & {
          error?: string;
        };
        if (!active) return;
        if (response.ok) {
          setProviderHealth(payload);
          setProviderError("");
        } else {
          setProviderHealth(payload.provider ? payload : null);
          setProviderError(payload.error ?? "TCGTracking status unavailable.");
        }
      } catch (error) {
        if (!active) return;
        setProviderError(
          error instanceof Error
            ? error.message
            : "TCGTracking status unavailable.",
        );
      }
    }

    void loadProviderHealth();
    return () => {
      active = false;
    };
  }, [tab]);

  function acknowledge(action: string) {
    setNotice(`${action} is ready to connect when its service is configured.`);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function runProviderAction(action: string) {
    setProviderBusy(action);
    setProviderAction("");
    try {
      const response = await fetch("/api/admin/tcgtracking/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json() as {
        status?: string;
        message?: string;
        providerHealth?: ProviderHealth;
        catalogReconciliation?: CatalogReconciliation;
      };
      if (payload.providerHealth) setProviderHealth(payload.providerHealth);
      if (payload.catalogReconciliation) setCatalogReconciliation(payload.catalogReconciliation);
      setProviderAction(payload.message ?? `TCGTracking ${payload.status ?? "action"} finished.`);
      if (!response.ok) {
        setProviderError(payload.message ?? "TCGTracking action failed.");
      } else {
        setProviderError("");
      }
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : "TCGTracking action failed.");
    } finally {
      setProviderBusy("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-td-accent/15 bg-td-accent/[0.055] text-td-accent-text"><Icon className="h-5 w-5" /></span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-td-accent-text/65">{section.eyebrow}</p>
              <h2 className="mt-1 text-xl font-semibold text-td-primary">{section.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-td-muted">{section.description}</p>
            </div>
          </div>
          <label className="flex h-10 min-w-56 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-black/15 px-3">
            <Search className="h-3.5 w-3.5 text-td-muted" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${section.title.toLowerCase()}…`} className="min-w-0 flex-1 bg-transparent text-xs text-td-primary outline-none placeholder:text-td-muted" />
          </label>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {section.stats.map(([label, value], index) => (
          <div key={label} className="rounded-[22px] border border-td-ink/[0.07] bg-td-surface p-5">
            <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-td-muted">{label}</p>{index === 0 ? <Activity className="h-4 w-4 text-td-accent-text/55" /> : <CheckCircle2 className="h-4 w-4 text-td-success/45" />}</div>
            <p className="mt-4 text-xl font-semibold text-td-primary">{value}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-[24px] border border-td-ink/[0.07] bg-td-surface">
        <div className="border-b border-td-ink/[0.06] p-5"><h3 className="text-base font-semibold text-td-primary">Admin tools</h3><p className="mt-1 text-xs text-td-muted">These controls are now part of the panel and clearly show when an outside service still needs to be connected.</p></div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {visibleCards.map((card) => (
            <button key={card} type="button" onClick={() => acknowledge(card)} className="flex min-h-20 items-center justify-between rounded-2xl border border-td-ink/[0.06] bg-black/10 p-4 text-left transition hover:border-td-accent/15 hover:bg-td-accent/[0.025]">
              <div><p className="text-xs font-semibold text-td-primary">{card}</p><p className="mt-1 text-[11px] text-td-muted">{tab === "health" ? "Status available" : "Open workspace"}</p></div>
              {tab === "data" ? <Download className="h-4 w-4 text-td-muted" /> : tab === "communications" ? <Mail className="h-4 w-4 text-td-muted" /> : tab === "health" ? <CloudCog className="h-4 w-4 text-td-success/60" /> : <BellRing className="h-4 w-4 text-td-muted" />}
            </button>
          ))}
        </div>
      </section>

      {tab === "health" ? (
        <section className="rounded-[24px] border border-td-accent/[0.1] bg-td-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-td-accent-text/65">Provider diagnostics</p>
              <h3 className="mt-1 text-base font-semibold text-td-primary">TCGTracking</h3>
              <p className="mt-1.5 max-w-2xl text-xs leading-5 text-td-muted">Product identity, SKU pricing, sealed-product, scanner, and cross-market enrichment provider. Trading Docks remains the catalog and inventory authority.</p>
            </div>
            <span className={[
              "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]",
              providerHealth?.status === "available"
                ? "border-td-success/15 bg-td-success/[0.045] text-td-success"
                : "border-td-line/15 bg-td-raised/[0.04] text-td-secondary",
            ].join(" ")}>
              {providerHealth?.status ?? "Checking"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <ProviderMetric label="Base URL" value={providerHealth?.baseUrl ?? "Checking"} />
            <ProviderMetric label="Latency" value={providerHealth?.latencyMs == null ? "Unavailable" : `${providerHealth.latencyMs} ms`} />
            <ProviderMetric label="Categories" value={providerHealth?.categoryCount == null ? "Checking" : String(providerHealth.categoryCount)} />
            <ProviderMetric label="Static cache" value={`${providerHealth?.cachePolicy.staticDataTtlDays ?? 7}+ days`} />
            <ProviderMetric label="Pricing freshness" value={`${providerHealth?.cachePolicy.pricingTtlHours ?? 24} hours`} />
            <ProviderMetric label="Last check" value={providerHealth?.lastCheckedAt ? new Date(providerHealth.lastCheckedAt).toLocaleString() : "Checking"} />
            <ProviderMetric label="Mapping sync" value={providerHealth?.sync?.mapping ? `${providerHealth.sync.mapping.status} · ${providerHealth.sync.mapping.processed}` : "Schema pending"} />
            <ProviderMetric label="Pricing sync" value={providerHealth?.sync?.pricing ? `${providerHealth.sync.pricing.status} · ${providerHealth.sync.pricing.processed}` : "Schema pending"} />
          </div>
          <LocalCatalogSummary status={providerHealth?.localCatalog ?? catalogReconciliation?.localCatalog ?? null} />
          <div className="mt-4 flex flex-wrap gap-2">
            <ProviderActionButton label="Validate Magic provider" busy={providerBusy === "validate_magic"} onClick={() => void runProviderAction("validate_magic")} />
            <ProviderActionButton label="Run catalog reconciliation" busy={providerBusy === "run_catalog_reconciliation"} onClick={() => void runProviderAction("run_catalog_reconciliation")} />
            <ProviderActionButton label="Sync Magic mappings" busy={providerBusy === "sync_magic_mappings"} onClick={() => void runProviderAction("sync_magic_mappings")} />
            <ProviderActionButton label="Refresh Magic pricing" busy={providerBusy === "refresh_magic_pricing"} onClick={() => void runProviderAction("refresh_magic_pricing")} />
          </div>
          {catalogReconciliation ? (
            <CatalogReconciliationSummary report={catalogReconciliation} />
          ) : null}
          <p className="mt-3 text-[11px] leading-5 text-td-muted">Local cache schema: {providerHealth?.localSchema ?? "proposal-only"}. Provider data may enrich products and pricing, but it does not create user inventory rows.</p>
          {providerAction ? <p role="status" className="mt-3 rounded-xl border border-td-accent/15 bg-td-accent/[0.045] px-3 py-2 text-[11px] text-td-accent-text/70">{providerAction}</p> : null}
          {providerError ? <p role="status" className="mt-3 rounded-xl border border-td-warning/15 bg-td-warning/[0.045] px-3 py-2 text-[11px] text-td-warning/70">{providerError}</p> : null}
        </section>
      ) : null}

      <div className="flex gap-3 rounded-2xl border border-td-warning/[0.1] bg-td-warning/[0.025] p-4">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-td-warning/70" />
        <p className="text-[11px] leading-5 text-td-warning/50">Actions that send email, process payments, or create remote backups remain disabled until their protected service is connected. The panel will not pretend those external actions succeeded.</p>
      </div>
      {notice ? <div role="status" className="fixed bottom-5 right-5 z-[160] rounded-xl border border-td-accent/15 bg-td-surface px-4 py-3 text-xs text-td-accent-text shadow-2xl">{notice}</div> : null}
    </div>
  );
}

function CatalogReconciliationSummary({ report }: { report: CatalogReconciliation }) {
  const tone = report.readiness === "GREEN"
    ? "border-td-success/15 bg-td-success/[0.04] text-td-success"
    : report.readiness === "YELLOW"
      ? "border-td-warning/15 bg-td-warning/[0.04] text-td-warning"
      : "border-td-danger/15 bg-td-danger/[0.04] text-td-danger";
  const localCoverage = report.localCatalogCoverageRate ?? report.exactSkuMatchRate;
  const providerCoverage = report.providerSkuCoverageRate ?? report.exactSkuMatchRate;
  const providerOnlySkus = report.providerOnlySkus ?? report.missingLocalSkus;
  const trueConflictCount = report.trueConflictCount ?? (
    report.conflictBreakdown.identity +
    report.conflictBreakdown.condition +
    report.conflictBreakdown.finish
  );
  const languageBreakdown = Object.entries(report.providerOnlyLanguageVariants ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);
  return (
    <div className="mt-4 rounded-2xl border border-td-ink/[0.07] bg-black/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">Catalog reconciliation</p>
          <p className="mt-1 text-sm font-semibold text-td-primary">
            {report.status === "completed"
              ? `${localCoverage ?? 0}% local catalog coverage`
              : "Catalog reconciliation failed"}
          </p>
          {report.status === "completed" ? (
            <p className="mt-1 text-[11px] leading-5 text-td-muted">
              {report.exactSkuMatches.toLocaleString("en-US")} / {report.localSkuRowsFound.toLocaleString("en-US")} sampled local SKUs matched by exact TCGTracking SKU ID.
            </p>
          ) : null}
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${tone}`}>
          {report.readiness}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <ProviderMetric label="Products" value={String(report.productsTested)} />
        <ProviderMetric label="Provider SKUs" value={String(report.providerSkusTested)} />
        <ProviderMetric label="Local rows" value={String(report.localSkuRowsFound)} />
        <ProviderMetric label="Exact matches" value={String(report.exactSkuMatches)} />
        <ProviderMetric label="Provider-only SKUs" value={String(providerOnlySkus)} />
        <ProviderMetric label="Provider coverage" value={percentValue(providerCoverage)} />
        <ProviderMetric label="True conflicts" value={String(trueConflictCount)} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <ProviderMetric label="Market median delta" value={moneyValue(report.pricingDeltaSummary.medianMarketDelta)} />
        <ProviderMetric label="Low median delta" value={moneyValue(report.pricingDeltaSummary.medianLowDelta)} />
        <ProviderMetric label="Market within $0.01" value={percentValue(report.pricingDeltaSummary.percentMarketWithinOneCent ?? null)} />
        <ProviderMetric label="Low within $0.01" value={percentValue(report.pricingDeltaSummary.percentLowWithinOneCent ?? null)} />
      </div>
      {languageBreakdown.length ? (
        <div className="mt-3 rounded-xl border border-td-ink/[0.06] bg-td-ink/[0.025] p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-td-muted">Additional provider language variants</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {languageBreakdown.map(([language, count]) => (
              <span key={language} className="rounded-full border border-td-ink/[0.07] bg-black/10 px-3 py-1 text-[11px] text-td-secondary">
                {language}: {count.toLocaleString("en-US")}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-td-muted">Provider SKU coverage is a secondary enrichment metric because TCGTracking includes languages and variants not present in the current TCGplayer Pricing Custom Export.</p>
        </div>
      ) : null}
      {report.failure ? (
        <details className="mt-4 rounded-xl border border-td-danger/10 bg-td-danger/[0.025] p-3">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.14em] text-td-danger/75">
            Failure details
          </summary>
          <div className="mt-3 grid gap-2 text-[11px] text-td-secondary sm:grid-cols-2">
            <ProviderMetric label="Stage" value={report.failure.stage} />
            <ProviderMetric label="HTTP" value={report.failure.status ? String(report.failure.status) : "n/a"} />
            <ProviderMetric label="Content type" value={report.failure.contentType ?? "n/a"} />
            <ProviderMetric label="Endpoint" value={report.failure.endpoint ?? "n/a"} />
            <ProviderMetric label="Table" value={report.failure.table ?? "n/a"} />
            <ProviderMetric label="Code" value={report.failure.code ?? "n/a"} />
          </div>
          <p className="mt-3 break-words text-[11px] leading-5 text-td-muted">{safeText(report.failure.message)}</p>
          {report.failure.url ? <p className="mt-2 break-all text-[11px] text-td-muted">{report.failure.url}</p> : null}
          {report.failure.requestedColumns ? <p className="mt-2 break-words text-[11px] text-td-muted">Columns: {safeText(report.failure.requestedColumns)}</p> : null}
          {report.failure.details ? <p className="mt-2 break-words text-[11px] text-td-muted">{safeText(report.failure.details)}</p> : null}
          {report.failure.hint ? <p className="mt-2 break-words text-[11px] text-td-muted">{safeText(report.failure.hint)}</p> : null}
          {report.failure.bodyPreview ? <p className="mt-2 break-words text-[11px] text-td-muted">{safeText(report.failure.bodyPreview)}</p> : null}
        </details>
      ) : null}
      {report.conflicts.length ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-td-ink/[0.06]">
          <div className="grid grid-cols-[90px_90px_1fr_1fr] gap-2 border-b border-td-ink/[0.06] bg-td-ink/[0.025] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-td-muted">
            <span>Product</span>
            <span>Field</span>
            <span>Local</span>
            <span>Provider</span>
          </div>
          {report.conflicts.slice(0, 8).map((conflict, index) => (
            <div key={`${conflict.productId}-${conflict.skuId}-${conflict.field}-${index}`} className="grid grid-cols-[90px_90px_1fr_1fr] gap-2 px-3 py-2 text-[11px] text-td-secondary">
              <span>{conflict.productId ?? "Unknown"}</span>
              <span>{conflict.field}</span>
              <span className="truncate">{displayValue(conflict.local)}</span>
              <span className="truncate">{displayValue(conflict.provider)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {report.error ? <p className="mt-3 text-[11px] text-td-danger/70">{safeText(report.error)}</p> : null}
    </div>
  );
}

function LocalCatalogSummary({ status }: { status: LocalCatalogStatus | null }) {
  const available = status?.status === "available";
  return (
    <div className="mt-4 rounded-2xl border border-td-ink/[0.07] bg-black/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">Local catalog</p>
          <p className="mt-1 text-sm font-semibold text-td-primary">tcgplayer_magic_catalog</p>
        </div>
        <span className={[
          "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]",
          available
            ? "border-td-success/15 bg-td-success/[0.04] text-td-success"
            : "border-td-danger/15 bg-td-danger/[0.04] text-td-danger",
        ].join(" ")}>
          {status?.status ?? "checking"}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <ProviderMetric label="Rows" value={status?.rows == null ? "Unknown" : status.rows.toLocaleString("en-US")} />
        <ProviderMetric label="Schema" value={status?.schema ?? "Checking"} />
        <ProviderMetric label="Smoke query" value={status?.sampleRowAvailable ? "Sample row found" : status ? "No sample row" : "Checking"} />
      </div>
      {status?.error ? (
        <details className="mt-3 rounded-xl border border-td-danger/10 bg-td-danger/[0.025] p-3">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.14em] text-td-danger/75">Catalog read failure</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ProviderMetric label="Code" value={status.error.code ?? "n/a"} />
            <ProviderMetric label="HTTP" value={status.error.status ? String(status.error.status) : status.error.statusCode ? String(status.error.statusCode) : "n/a"} />
          </div>
          <p className="mt-3 text-[11px] leading-5 text-td-muted">{safeText(status.error.message)}</p>
          {status.error.details ? <p className="mt-2 text-[11px] text-td-muted">{safeText(status.error.details)}</p> : null}
          {status.error.hint ? <p className="mt-2 text-[11px] text-td-muted">{safeText(status.error.hint)}</p> : null}
        </details>
      ) : null}
    </div>
  );
}

function ProviderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-td-ink/[0.06] bg-black/10 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">{label}</p>
      <p className="mt-2 truncate text-xs font-semibold text-td-primary">{value}</p>
    </div>
  );
}

function ProviderActionButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.025] px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-td-secondary transition hover:border-td-accent/20 hover:bg-td-accent/[0.045] hover:text-td-accent-text disabled:cursor-wait disabled:opacity-60"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}

function moneyValue(value: number | null) {
  return value == null ? "n/a" : `$${value.toFixed(2)}`;
}

function percentValue(value: number | null) {
  return value == null ? "n/a" : `${value}%`;
}

function displayValue(value: unknown) {
  if (value == null || value === "") return "n/a";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "object";
}

function safeText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
