import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Database,
  MapPin,
  Tag,
} from "lucide-react";

import {
  loadInventoryAttentionSummary,
  type InventoryAttentionGroup,
  type InventoryAttentionSeverity,
  type InventoryAttentionSupabaseClient,
  type InventoryAttentionType,
} from "@/lib/inventory/intelligence";
import { resolvePlatformAccessForUser } from "@/lib/platform/server-access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InventoryInboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/dashboard/inventory/inbox");

  const access = await resolvePlatformAccessForUser(supabase, user);
  const summary = await loadInventoryAttentionSummary({
    supabase: supabase as unknown as InventoryAttentionSupabaseClient,
    userId: user.id,
    workspaceId: access.workspaceId,
  });
  const hasIssues = summary.totalIssues > 0;

  return (
    <main className="min-h-screen bg-[#020911] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <header className="rounded-[28px] border border-white/[0.07] bg-[#06141e] p-5 shadow-[0_24px_90px_rgba(0,0,0,.28)] sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300/80">Inventory Inbox</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
                {hasIssues ? "Inventory work queue" : "Inventory looks clean."}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                {hasIssues
                  ? "Grouped attention items from real inventory records. Open the Collection with the matching filter to resolve each issue."
                  : "Trading Docks will surface pricing, organization, and data-quality issues here as they are detected from your inventory."}
              </p>
            </div>
            <Link
              href="/dashboard/inventory"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-[#001018] transition hover:bg-cyan-200"
            >
              Open Collection
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Inventory attention summary">
          <Metric icon={<AlertTriangle className="h-4 w-4" />} label="Total issues" value={summary.totalIssues.toLocaleString()} detail={summary.sampleLimited ? "Recent inventory sample" : "Current inventory state"} tone={summary.totalIssues ? "attention" : "healthy"} />
          <Metric icon={<AlertTriangle className="h-4 w-4" />} label="High priority" value={summary.highPriorityIssues.toLocaleString()} detail="Blocks valuation or selling quality" tone={summary.highPriorityIssues ? "attention" : "neutral"} />
          <Metric icon={<CircleDollarSign className="h-4 w-4" />} label="Pricing" value={summary.categoryCounts.pricing.toLocaleString()} detail={`${Math.round(summary.priceCoveragePercent)}% price coverage`} tone={summary.categoryCounts.pricing ? "attention" : "neutral"} />
          <Metric icon={<MapPin className="h-4 w-4" />} label="Organization" value={summary.categoryCounts.organization.toLocaleString()} detail={`${Math.round(summary.storageCoveragePercent)}% storage coverage`} tone={summary.categoryCounts.organization ? "attention" : "neutral"} />
          <Metric icon={<Database className="h-4 w-4" />} label="Data quality" value={summary.categoryCounts.dataQuality.toLocaleString()} detail="Condition and finish completeness" tone={summary.categoryCounts.dataQuality ? "attention" : "neutral"} />
        </section>

        {summary.sampleLimited ? (
          <section className="rounded-2xl border border-cyan-300/[0.13] bg-cyan-400/[0.035] px-4 py-3 text-xs leading-5 text-cyan-100/75">
            Showing grouped findings from {summary.sampledRows.toLocaleString()} recent inventory records out of {summary.totalInventoryRows.toLocaleString()} total rows. Detailed pagination should be added before this becomes a full historical audit queue.
          </section>
        ) : null}

        {hasIssues ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3">
              {summary.groups.map((group) => (
                <AttentionGroupCard key={group.type} group={group} />
              ))}
            </div>
            <aside className="h-fit rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Rule ownership</p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.025em] text-white">How issues are detected</h2>
              <div className="mt-4 space-y-3 text-xs leading-5 text-slate-500">
                <Rule label="Pricing" detail="Missing when inventory value and saved data value are absent or zero." />
                <Rule label="Storage" detail="Missing when no location id exists on the inventory row or row data." />
                <Rule label="Condition" detail="Unknown when condition is missing, unknown, or n/a." />
                <Rule label="Finish" detail="Unknown when finish, variant, and treatment are missing, unknown, or n/a." />
              </div>
            </aside>
          </section>
        ) : (
          <section className="rounded-[28px] border border-emerald-300/[0.12] bg-emerald-300/[0.035] p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-white">No inventory attention items found.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-emerald-100/65">
              The current inventory sample has pricing, storage, condition, and finish coverage. Trading Docks does not show demo alerts in a real user's inbox; future opportunity types will appear here only when backed by reliable persisted data.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function AttentionGroupCard({ group }: { group: InventoryAttentionGroup }) {
  return (
    <article className="rounded-[24px] border border-white/[0.07] bg-[#06141e] p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex h-8 items-center gap-2 rounded-xl px-2.5 text-[10px] font-bold uppercase tracking-[0.13em] ${severityClass(group.severity)}`}>
              {iconForType(group.type)}
              {severityLabel(group.severity)}
            </span>
            <span className="rounded-xl bg-white/[0.04] px-2.5 py-2 text-[10px] font-semibold text-slate-400">
              {group.count.toLocaleString()} {group.count === 1 ? "record" : "records"}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">{group.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{group.description}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{group.reason}</p>
        </div>
        <Link
          href={group.actionHref}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3.5 text-xs font-bold text-[#001018] transition hover:bg-cyan-200"
        >
          {group.recommendedAction}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 grid gap-2">
        {group.representativeItems.map((item) => (
          <Link
            key={item.id}
            href={item.inventoryItemId ? `/dashboard/inventory/${encodeURIComponent(item.inventoryItemId)}` : group.actionHref}
            className="grid gap-3 rounded-2xl border border-white/[0.055] bg-black/[0.12] p-3 transition hover:border-cyan-300/[0.14] hover:bg-cyan-400/[0.025] sm:grid-cols-[minmax(0,1fr)_120px_110px]"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-100">{item.itemName}</span>
              <span className="mt-1 block text-xs text-slate-500">{item.metadata.setCode ?? "Unknown set"} {item.metadata.collectorNumber ? `#${item.metadata.collectorNumber}` : ""}</span>
            </span>
            <span className="text-xs text-slate-400">Qty {item.quantity.toLocaleString()}</span>
            <span className="text-xs text-slate-500">{item.value === null ? "Value unavailable" : money(item.value)}</span>
          </Link>
        ))}
      </div>
    </article>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "attention" | "healthy" | "neutral";
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone === "attention" ? "bg-amber-300/[0.08] text-amber-200" : tone === "healthy" ? "bg-emerald-300/[0.08] text-emerald-200" : "bg-white/[0.04] text-slate-400"}`}>
        {icon}
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function Rule({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.055] bg-black/[0.12] p-3">
      <p className="text-xs font-semibold text-slate-200">{label}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function severityLabel(severity: InventoryAttentionSeverity) {
  return severity === "high" ? "High" : severity === "medium" ? "Medium" : "Low";
}

function severityClass(severity: InventoryAttentionSeverity) {
  if (severity === "high") return "bg-amber-300/[0.09] text-amber-200";
  if (severity === "medium") return "bg-cyan-300/[0.08] text-cyan-200";
  return "bg-white/[0.04] text-slate-400";
}

function iconForType(type: InventoryAttentionType) {
  if (type === "missing_price") return <CircleDollarSign className="h-3.5 w-3.5" />;
  if (type === "missing_storage_location") return <MapPin className="h-3.5 w-3.5" />;
  if (type === "unknown_condition" || type === "unknown_finish") return <Tag className="h-3.5 w-3.5" />;
  return <Database className="h-3.5 w-3.5" />;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
