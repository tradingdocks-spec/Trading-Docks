import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Database,
  History,
  PackageCheck,
  Search,
  WalletCards,
} from "lucide-react";

import { requireServerCapability } from "@/lib/platform/server-access";
import {
  filterPurchaseHistory,
  PAYMENT_METHOD_LABELS,
  PURCHASE_SOURCE_LABELS,
  PURCHASE_STATUS_LABELS,
  summarizePurchaseHistory,
  type PurchaseHistoryFilters,
  type PurchaseLedgerRecord,
  type PurchasePaymentMethod,
  type PurchaseSourceType,
  type PurchaseStatus,
} from "@/lib/purchase-history/ledger";
import { loadPurchaseHistory } from "@/lib/purchase-history/server";

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    source?: string;
    payment?: string;
    q?: string;
    from?: string;
    to?: string;
    purchaseId?: string;
  }>;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat("en-US");

const tabs: Array<"all" | PurchaseStatus> = [
  "all",
  "pending",
  "completed",
  "received",
  "cancelled",
];

function sourceFilter(value: string | undefined): PurchaseSourceType | "all" {
  return value && value in PURCHASE_SOURCE_LABELS ? value as PurchaseSourceType : "all";
}

function paymentFilter(value: string | undefined): PurchasePaymentMethod | "all" {
  return value && value in PAYMENT_METHOD_LABELS ? value as PurchasePaymentMethod : "all";
}

function statusTab(value: string | undefined): "all" | PurchaseStatus {
  return value && value in PURCHASE_STATUS_LABELS ? value as PurchaseStatus : "all";
}

function filterHref(filters: PurchaseHistoryFilters, patch: PurchaseHistoryFilters) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (next.tab && next.tab !== "all") params.set("tab", next.tab);
  if (next.sourceType && next.sourceType !== "all") params.set("source", next.sourceType);
  if (next.paymentMethod && next.paymentMethod !== "all") params.set("payment", next.paymentMethod);
  if (next.query) params.set("q", next.query);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  return `/dashboard/purchase-history${params.size ? `?${params.toString()}` : ""}`;
}

export default async function PurchaseHistoryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase, access } = await requireServerCapability("buying.manage", "/dashboard/plans");
  const filters: PurchaseHistoryFilters = {
    tab: statusTab(params.tab),
    sourceType: sourceFilter(params.source),
    paymentMethod: paymentFilter(params.payment),
    query: params.q ?? "",
    from: params.from,
    to: params.to,
  };
  const loadResult = await loadPurchaseHistory(supabase, access, filters);
  const filtered = filterPurchaseHistory(loadResult.records, filters);
  const metrics = summarizePurchaseHistory(loadResult.records);
  const selectedPurchase =
    filtered.find((record) => record.id === params.purchaseId) ?? filtered[0] ?? null;

  return (
    <main className="min-h-screen bg-td-canvas px-4 py-5 text-td-primary sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="rounded-[24px] border border-td-accent/[0.12] bg-td-surface p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-td-accent/[0.14] bg-td-accent/[0.05] text-td-accent-text">
                <History className="h-5 w-5" />
              </div>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">
                Purchase History
              </p>
              <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-td-primary sm:text-4xl">
                Recorded financial acquisitions.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-td-secondary">
                Reviewed Collection Intake purchases and preserved historical purchase records.
                Inventory imports and edits do not create financial acquisitions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/collection-buying" className="inline-flex h-10 items-center gap-2 rounded-xl bg-td-accent px-4 text-xs font-bold text-td-on-accent transition hover:bg-td-accent-hover focus:outline-none focus:ring-2 focus:ring-td-accent">
                Start reviewed intake
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/dashboard/collection-buying" className="inline-flex h-10 items-center rounded-xl border border-td-ink/[0.1] bg-td-ink/[0.03] px-4 text-xs font-semibold text-td-primary transition hover:border-td-accent/30 hover:text-td-accent-text focus:outline-none focus:ring-2 focus:ring-td-accent/50">
                Buy collection
              </Link>
            </div>
          </div>
        </header>

        <p className="mt-5 text-xs text-td-secondary">These summaries cover the latest 250 accessible purchase records. They are not an all-history accounting report.</p>
        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Spent today" value={currency.format(metrics.spentToday)} icon={WalletCards} />
          <Metric label="Spent this week" value={currency.format(metrics.spentThisWeek)} icon={WalletCards} />
          <Metric label="Pending intake" value={integer.format(metrics.pendingIntakeCount)} icon={ClipboardList} />
          <Metric label="Purchased units" value={integer.format(metrics.inventoryAcquiredUnits)} icon={PackageCheck} />
          <Metric label="Avg acquisition" value={currency.format(metrics.averageAcquisitionCost)} icon={Database} />
        </section>

        {loadResult.warning ? (
          <section className="mt-5 rounded-[22px] border border-td-warning/[0.18] bg-td-warning/[0.05] p-4 text-sm leading-6 text-td-warning">
            {loadResult.warning}
          </section>
        ) : null}

        <section className="mt-5 rounded-[24px] border border-td-ink/[0.08] bg-td-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <Link
                  key={tab}
                  href={filterHref(filters, { tab })}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-td-accent/50 ${
                    filters.tab === tab
                      ? "bg-td-accent text-td-on-accent"
                      : "border border-td-ink/[0.08] bg-td-ink/[0.025] text-td-secondary hover:text-td-accent-text"
                  }`}
                >
                  {tab === "all" ? "All" : PURCHASE_STATUS_LABELS[tab]}
                </Link>
              ))}
            </div>
            <form className="grid w-full gap-2 md:w-auto md:grid-cols-[180px_160px_180px_1fr_auto]">
              <select name="source" defaultValue={filters.sourceType ?? "all"} className="h-10 rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-xs text-td-primary outline-none focus:border-td-accent/50">
                <option value="all">All sources</option>
                {Object.entries(PURCHASE_SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select name="payment" defaultValue={filters.paymentMethod ?? "all"} className="h-10 rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-xs text-td-primary outline-none focus:border-td-accent/50">
                <option value="all">All payment</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input name="from" defaultValue={filters.from ?? ""} type="date" className="h-10 rounded-xl border border-td-ink/[0.09] bg-td-ink/[0.035] px-3 text-xs text-td-primary outline-none focus:border-td-accent/50" />
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-td-muted" />
                <input name="q" defaultValue={filters.query ?? ""} placeholder="Seller, vendor, notes, item" className="h-10 w-full rounded-xl border border-td-ink/[0.09] bg-td-ink/[0.035] pl-9 pr-3 text-xs text-td-primary outline-none placeholder:text-td-muted focus:border-td-accent/50" />
              </label>
              <button type="submit" className="h-10 rounded-xl border border-td-accent/[0.18] bg-td-accent/[0.07] px-4 text-xs font-bold text-td-accent-text transition hover:bg-td-accent/[0.12] focus:outline-none focus:ring-2 focus:ring-td-accent/50">
                Filter
              </button>
            </form>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-td-ink/[0.08]">
            <div className="hidden grid-cols-[120px_150px_minmax(150px,1fr)_90px_120px_140px_110px_120px] gap-3 border-b border-td-ink/[0.08] bg-td-ink/[0.025] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-td-muted xl:grid">
              <span>Date</span><span>Source</span><span>Seller / Vendor</span><span>Items</span><span>Total cost</span><span>Payment</span><span>Status</span><span>Created by</span>
            </div>
            {filtered.length ? filtered.map((record) => (
              <PurchaseRow key={record.id} record={record} filters={filters} />
            )) : (
              <div className="px-6 py-14 text-center">
                <ClipboardList className="mx-auto h-7 w-7 text-td-muted" />
                <p className="mt-4 text-sm font-semibold text-td-secondary">No purchase records yet</p>
                <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-td-muted">
                  Start from Bulk Buying, Collection Buying, Sealed Buying, or a
                  manual purchase entry once the canonical ledger migration is
                  available in this environment.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Link href="/dashboard/bulk-buying" className="rounded-xl bg-td-accent px-4 py-2 text-xs font-bold text-td-on-accent">Start bulk buy</Link>
                  <Link href="/dashboard/sealed-buying" className="rounded-xl border border-td-ink/[0.08] px-4 py-2 text-xs font-semibold text-td-secondary">Buy sealed</Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {selectedPurchase ? <PurchaseDetail record={selectedPurchase} /> : null}
      </div>
    </main>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof History }) {
  return (
    <div className="rounded-[22px] border border-td-ink/[0.08] bg-td-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-td-muted">{label}</p>
        <Icon className="h-4 w-4 text-td-accent-text" />
      </div>
      <p className="mt-3 text-xl font-semibold text-td-primary">{value}</p>
    </div>
  );
}

function PurchaseRow({ record, filters }: { record: PurchaseLedgerRecord; filters: PurchaseHistoryFilters }) {
  const href = `${filterHref(filters, {})}${filterHref(filters, {}).includes("?") ? "&" : "?"}purchaseId=${encodeURIComponent(record.id)}`;
  return (
    <Link
      href={href}
      className="grid gap-2 border-b border-td-ink/[0.06] px-4 py-4 text-sm transition last:border-b-0 hover:bg-td-accent/[0.035] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-td-accent/50 xl:grid-cols-[120px_150px_minmax(150px,1fr)_90px_120px_140px_110px_120px] xl:items-center"
    >
      <span className="text-td-secondary">{new Date(record.purchasedAt).toLocaleDateString()}</span>
      <span className="font-semibold text-td-accent-text">{PURCHASE_SOURCE_LABELS[record.sourceType]}</span>
      <span className="min-w-0 truncate text-td-primary">{record.sellerName || "Unspecified"}</span>
      <span className="text-td-secondary">{integer.format(record.itemCount)}</span>
      <span className="font-semibold text-td-primary">{currency.format(record.totalCost)}</span>
      <span className="text-td-secondary">{PAYMENT_METHOD_LABELS[record.paymentMethod]}</span>
      <span className="w-fit rounded-full border border-td-ink/[0.08] bg-td-ink/[0.035] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-td-secondary">{PURCHASE_STATUS_LABELS[record.status]}</span>
      <span className="truncate text-td-muted">{record.createdBy}</span>
    </Link>
  );
}

function PurchaseDetail({ record }: { record: PurchaseLedgerRecord }) {
  return (
    <aside className="mt-5 rounded-[24px] border border-td-accent/[0.12] bg-td-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-accent-text">Purchase detail</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-td-primary">
            {PURCHASE_SOURCE_LABELS[record.sourceType]} · {currency.format(record.totalCost)}
          </h2>
          <p className="mt-2 text-sm text-td-muted">{record.notes || "No notes recorded."}</p>
        </div>
        <div className="rounded-2xl border border-td-ink/[0.08] bg-black/15 px-4 py-3 text-right">
          <p className="text-[11px] uppercase tracking-[0.12em] text-td-muted">Units</p>
          <p className="mt-1 text-lg font-semibold text-td-primary">{integer.format(record.unitCount)}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {record.lines.map((line) => (
          <div key={line.id} className="rounded-2xl border border-td-ink/[0.07] bg-td-ink/[0.025] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-td-primary">{line.description}</p>
                <p className="mt-1 text-xs text-td-muted">
                  {integer.format(line.unitCount)} units · {line.lineType.replaceAll("_", " ")}
                </p>
              </div>
              <p className="text-sm font-semibold text-td-accent-text">{currency.format(line.totalCost)}</p>
            </div>
            {line.inventoryItemId ? (
              <p className="mt-3 text-[11px] text-td-muted">Linked inventory row: {line.inventoryItemId}</p>
            ) : (
              <p className="mt-3 text-[11px] text-td-muted">No inventory ownership row created by this ledger entry.</p>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
