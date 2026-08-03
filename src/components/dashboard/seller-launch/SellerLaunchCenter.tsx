"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  CircleDollarSign,
  ContactRound,
  FileSpreadsheet,
  PackageSearch,
  RefreshCw,
  Rocket,
  ShoppingBag,
  Store,
  WandSparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

export type SellerReadinessSnapshot = {
  inventoryItemCount: number;
  inventoryUnitCount: number;
  connectedMarketplaceCount: number;
  connectedMarketplaces: string[];
  orderCount: number;
  customerCount: number;
  completedSyncCount: number;
  workspaceConfigured: boolean;
  generatedAt: string;
};

type LaunchStep = {
  id: string;
  phase: string;
  title: string;
  description: string;
  href: string;
  action: string;
  icon: React.ComponentType<{ className?: string }>;
  required: boolean;
  automatic: boolean;
  complete: boolean;
  evidence: string;
};

export function SellerLaunchCenter({
  snapshot,
}: {
  snapshot: SellerReadinessSnapshot;
}) {
  const [manualComplete, setManualComplete] = useState<string[]>([]);

  const steps = useMemo<LaunchStep[]>(
    () => [
      {
        id: "business-profile",
        phase: "Foundation",
        title: "Confirm your seller workspace",
        description:
          "Review account details, business identity, and workspace preferences.",
        href: "/dashboard/settings",
        action: "Review settings",
        icon: Store,
        required: true,
        automatic: true,
        complete: snapshot.workspaceConfigured,
        evidence: snapshot.workspaceConfigured
          ? "Active workspace detected"
          : "No active workspace detected",
      },
      {
        id: "inventory",
        phase: "Inventory",
        title: "Add or import sellable inventory",
        description:
          "Trading Docks checks your durable inventory records automatically.",
        href: "/dashboard/inventory",
        action: "Open inventory",
        icon: Boxes,
        required: true,
        automatic: true,
        complete: snapshot.inventoryItemCount > 0,
        evidence:
          snapshot.inventoryItemCount > 0
            ? `${snapshot.inventoryItemCount.toLocaleString()} records · ${snapshot.inventoryUnitCount.toLocaleString()} units`
            : "No inventory detected",
      },
      {
        id: "csv",
        phase: "Inventory",
        title: "Validate an inventory import",
        description:
          "Completed sync activity is used as evidence that an import or synchronization workflow has run.",
        href: "/dashboard/tools/csv-converter",
        action: "Open CSV Engine",
        icon: FileSpreadsheet,
        required: false,
        automatic: true,
        complete: snapshot.completedSyncCount > 0,
        evidence:
          snapshot.completedSyncCount > 0
            ? `${snapshot.completedSyncCount.toLocaleString()} completed sync run${snapshot.completedSyncCount === 1 ? "" : "s"}`
            : "No completed sync activity detected",
      },
      {
        id: "marketplace",
        phase: "Connections",
        title: "Connect your first marketplace",
        description:
          "Ready marketplace connections and saved self-service credentials are detected automatically.",
        href: "/dashboard/marketplaces",
        action: "Connect a channel",
        icon: Store,
        required: true,
        automatic: true,
        complete: snapshot.connectedMarketplaceCount > 0,
        evidence:
          snapshot.connectedMarketplaceCount > 0
            ? snapshot.connectedMarketplaces.join(", ")
            : "No ready marketplace connection detected",
      },
      {
        id: "orders",
        phase: "Orders",
        title: "Import and review an order",
        description:
          "The checklist completes when a real order reaches the universal Orders Center.",
        href: "/dashboard/orders",
        action: "Open Orders",
        icon: ShoppingBag,
        required: true,
        automatic: true,
        complete: snapshot.orderCount > 0,
        evidence:
          snapshot.orderCount > 0
            ? `${snapshot.orderCount.toLocaleString()} order${snapshot.orderCount === 1 ? "" : "s"} detected`
            : "No imported orders detected",
      },
      {
        id: "purchasing",
        phase: "Buying",
        title: "Configure purchasing intelligence",
        description:
          "Buying-rule persistence is not yet available as a durable readiness signal.",
        href: "/dashboard/card-photo-scanner",
        action: "Open Purchasing",
        icon: PackageSearch,
        required: false,
        automatic: false,
        complete: manualComplete.includes("purchasing"),
        evidence: manualComplete.includes("purchasing")
          ? "Confirmed manually"
          : "Manual confirmation required",
      },
      {
        id: "crm",
        phase: "Customers",
        title: "Create your first customer",
        description:
          "Customer records in the active workspace are checked automatically.",
        href: "/dashboard/customers",
        action: "Open Customer CRM",
        icon: ContactRound,
        required: false,
        automatic: true,
        complete: snapshot.customerCount > 0,
        evidence:
          snapshot.customerCount > 0
            ? `${snapshot.customerCount.toLocaleString()} customer${snapshot.customerCount === 1 ? "" : "s"} detected`
            : "No CRM customers detected",
      },
      {
        id: "automation",
        phase: "Operations",
        title: "Review seller automation",
        description:
          "Automation preferences do not yet expose a durable completion record.",
        href: "/dashboard/automation",
        action: "Review automation",
        icon: WandSparkles,
        required: false,
        automatic: false,
        complete: manualComplete.includes("automation"),
        evidence: manualComplete.includes("automation")
          ? "Confirmed manually"
          : "Manual confirmation required",
      },
    ],
    [manualComplete, snapshot],
  );

  const required = steps.filter((step) => step.required);
  const requiredComplete = required.filter((step) => step.complete).length;
  const totalComplete = steps.filter((step) => step.complete).length;
  const score = Math.round((totalComplete / steps.length) * 100);
  const ready = requiredComplete === required.length;
  const nextStep = steps.find((step) => !step.complete) ?? null;

  function toggleManual(id: string) {
    setManualComplete((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  return (
    <main className="min-h-screen bg-[#020a12] px-4 py-6 text-white sm:px-6 lg:px-10 lg:py-9">
      <div className="mx-auto max-w-[1500px]">
        <section className="relative overflow-hidden rounded-[30px] border border-blue-300/[0.15] bg-gradient-to-br from-[#0a1c2b] via-[#071522] to-[#04101a] p-5 shadow-[0_34px_120px_rgba(0,0,0,.42)] sm:p-8">
          <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-blue-500/[0.14] blur-[110px]" />

          <div className="relative grid gap-8 xl:grid-cols-[1fr_390px] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.18] bg-cyan-300/[0.06] px-3 py-2 text-xs font-semibold text-cyan-200">
                <Rocket className="h-4 w-4" />
                Automatic Seller Readiness
              </div>

              <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">
                Trading Docks now verifies your core seller setup.
              </h1>

              <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base sm:leading-8">
                Inventory, marketplace connections, orders, customers, and sync
                activity are checked from your real workspace data instead of
                relying on manual checklist claims.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                <StatusPill
                  label={`${requiredComplete}/${required.length} required complete`}
                  good={ready}
                />
                <StatusPill
                  label={`${totalComplete}/${steps.length} total complete`}
                  good={score >= 75}
                />
                <StatusPill
                  label={ready ? "Core seller workflows ready" : "Setup in progress"}
                  good={ready}
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.08] bg-black/[0.16] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                    Verified readiness
                  </p>
                  <p className="mt-2 text-4xl font-bold tracking-[-0.05em] text-white [font-variant-numeric:tabular-nums]">
                    {score}%
                  </p>
                </div>
                <span
                  className={[
                    "flex h-12 w-12 items-center justify-center rounded-2xl border",
                    ready
                      ? "border-emerald-300/[0.18] bg-emerald-300/[0.07] text-emerald-300"
                      : "border-blue-300/[0.16] bg-blue-400/[0.06] text-blue-300",
                  ].join(" ")}
                >
                  {ready ? (
                    <BadgeCheck className="h-5 w-5" />
                  ) : (
                    <RefreshCw className="h-5 w-5" />
                  )}
                </span>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.055]">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300 transition-[width] duration-500"
                  style={{ width: `${score}%` }}
                />
              </div>

              <p className="mt-3 text-[11px] text-slate-600">
                Checked {new Date(snapshot.generatedAt).toLocaleString()}
              </p>

              {nextStep ? (
                <Link
                  href={nextStep.href}
                  className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-blue-300/[0.12] bg-blue-400/[0.04] px-4 py-3 transition hover:border-cyan-300/[0.22] hover:bg-blue-400/[0.07]"
                >
                  <span>
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-600">
                      Best next action
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-white">
                      {nextStep.title}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-cyan-300" />
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-2">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <article
                key={step.id}
                className={[
                  "rounded-[24px] border p-5 transition duration-300",
                  step.complete
                    ? "border-emerald-300/[0.15] bg-emerald-300/[0.035]"
                    : "border-white/[0.075] bg-[#071522]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={[
                      "flex h-11 w-11 items-center justify-center rounded-2xl border",
                      step.complete
                        ? "border-emerald-300/[0.16] bg-emerald-300/[0.06] text-emerald-300"
                        : "border-blue-300/[0.12] bg-blue-400/[0.05] text-blue-300",
                    ].join(" ")}
                  >
                    {step.complete ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </span>

                  <div className="flex flex-wrap justify-end gap-1.5">
                    <span className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                      {step.required ? "Required" : "Recommended"}
                    </span>
                    <span className="rounded-full border border-blue-300/[0.1] bg-blue-400/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-blue-200/65">
                      {step.automatic ? "Auto verified" : "Manual"}
                    </span>
                  </div>
                </div>

                <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/75">
                  {String(index + 1).padStart(2, "0")} · {step.phase}
                </p>
                <h2 className="mt-2 text-lg font-semibold tracking-[-0.025em] text-white">
                  {step.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {step.description}
                </p>

                <div
                  className={[
                    "mt-4 rounded-xl border px-3 py-2.5 text-xs font-medium",
                    step.complete
                      ? "border-emerald-300/[0.11] bg-emerald-300/[0.035] text-emerald-200"
                      : "border-white/[0.06] bg-black/[0.11] text-slate-600",
                  ].join(" ")}
                >
                  {step.evidence}
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <Link
                    href={step.href}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-blue-300/[0.13] bg-blue-400/[0.045] px-3 text-xs font-semibold text-blue-100"
                  >
                    {step.action}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  {!step.automatic ? (
                    <button
                      type="button"
                      onClick={() => toggleManual(step.id)}
                      className={[
                        "inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-semibold",
                        step.complete
                          ? "bg-emerald-300/[0.09] text-emerald-200"
                          : "border border-white/[0.08] bg-white/[0.025] text-slate-400",
                      ].join(" ")}
                    >
                      {step.complete ? "Confirmed" : "Confirm"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Inventory units"
            value={snapshot.inventoryUnitCount.toLocaleString()}
            icon={Boxes}
          />
          <SummaryCard
            label="Connected channels"
            value={snapshot.connectedMarketplaceCount.toLocaleString()}
            icon={Store}
          />
          <SummaryCard
            label="Imported orders"
            value={snapshot.orderCount.toLocaleString()}
            icon={ShoppingBag}
          />
          <SummaryCard
            label="CRM customers"
            value={snapshot.customerCount.toLocaleString()}
            icon={ContactRound}
          />
        </section>
      </div>
    </main>
  );
}

function StatusPill({ label, good }: { label: string; good: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold",
        good
          ? "border-emerald-300/[0.14] bg-emerald-300/[0.045] text-emerald-200"
          : "border-blue-300/[0.12] bg-blue-400/[0.035] text-blue-200/80",
      ].join(" ")}
    >
      <span className={good ? "h-1.5 w-1.5 rounded-full bg-emerald-300" : "h-1.5 w-1.5 rounded-full bg-blue-300"} />
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.075] bg-[#071522] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-600">
          {label}
        </p>
        <Icon className="h-4 w-4 text-blue-300/70" />
      </div>
      <p className="mt-4 text-2xl font-bold tracking-[-0.035em] text-white [font-variant-numeric:tabular-nums]">
        {value}
      </p>
    </div>
  );
}
