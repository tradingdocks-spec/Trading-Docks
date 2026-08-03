"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ContactRound,
  FileSpreadsheet,
  PackageSearch,
  Rocket,
  ShoppingBag,
  Store,
  Target,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type LaunchStep = {
  id: string;
  phase: string;
  title: string;
  description: string;
  href: string;
  action: string;
  icon: React.ComponentType<{ className?: string }>;
  required: boolean;
};

const STEPS: LaunchStep[] = [
  {
    id: "business-profile",
    phase: "Foundation",
    title: "Confirm your seller workspace",
    description:
      "Review account details, business identity, preferences, and the way your inventory should be organized.",
    href: "/dashboard/settings",
    action: "Review settings",
    icon: Store,
    required: true,
  },
  {
    id: "inventory",
    phase: "Inventory",
    title: "Add or import sellable inventory",
    description:
      "Add cards manually or use the CSV Conversion Engine to establish the inventory Trading Docks will reconcile against orders.",
    href: "/dashboard/inventory",
    action: "Open inventory",
    icon: Boxes,
    required: true,
  },
  {
    id: "csv",
    phase: "Inventory",
    title: "Validate an inventory import",
    description:
      "Run at least one CSV workflow so marketplace exports and collection files are ready for clean intake.",
    href: "/dashboard/tools/csv-converter",
    action: "Open CSV Engine",
    icon: FileSpreadsheet,
    required: false,
  },
  {
    id: "marketplace",
    phase: "Connections",
    title: "Connect your first marketplace",
    description:
      "Connect Mana Pool, eBay, TCGplayer email intake, Shopify, or another supported sales channel.",
    href: "/dashboard/marketplaces",
    action: "Connect a channel",
    icon: Store,
    required: true,
  },
  {
    id: "orders",
    phase: "Orders",
    title: "Import and review an order",
    description:
      "Confirm that an order reaches the universal Orders Center with channel, items, totals, and fulfillment status.",
    href: "/dashboard/orders",
    action: "Open Orders",
    icon: ShoppingBag,
    required: true,
  },
  {
    id: "purchasing",
    phase: "Buying",
    title: "Configure purchasing intelligence",
    description:
      "Set up buying rules and test the card-photo workflow so future acquisitions follow your margin targets.",
    href: "/dashboard/card-photo-scanner",
    action: "Open Purchasing",
    icon: PackageSearch,
    required: false,
  },
  {
    id: "crm",
    phase: "Customers",
    title: "Create your first customer",
    description:
      "Add a customer profile and prepare the workspace for loyalty, store credit, and customer history.",
    href: "/dashboard/customers",
    action: "Open Customer CRM",
    icon: ContactRound,
    required: false,
  },
  {
    id: "automation",
    phase: "Operations",
    title: "Review seller automation",
    description:
      "Choose which repetitive workflows should be automated and which changes should remain preview-first.",
    href: "/dashboard/automation",
    action: "Review automation",
    icon: WandSparkles,
    required: false,
  },
];

const STORAGE_KEY = "trading-docks-seller-launch-v1";

export function SellerLaunchCenter() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        setCompleted(
          parsed.filter((value): value is string => typeof value === "string"),
        );
      }
    } catch {
      setCompleted([]);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  }, [completed, hydrated]);

  const requiredSteps = STEPS.filter((step) => step.required);
  const requiredComplete = requiredSteps.filter((step) =>
    completed.includes(step.id),
  ).length;
  const totalComplete = STEPS.filter((step) =>
    completed.includes(step.id),
  ).length;
  const score = Math.round((totalComplete / STEPS.length) * 100);
  const ready = requiredComplete === requiredSteps.length;

  const nextStep = useMemo(
    () => STEPS.find((step) => !completed.includes(step.id)) ?? null,
    [completed],
  );

  function toggleStep(id: string) {
    setCompleted((current) =>
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

          <div className="relative grid gap-8 xl:grid-cols-[1fr_380px] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.18] bg-cyan-300/[0.06] px-3 py-2 text-xs font-semibold text-cyan-200">
                <Rocket className="h-4 w-4" />
                Seller Launch Center
              </div>

              <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">
                Turn your Seller account into a working sales operation.
              </h1>

              <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base sm:leading-8">
                Complete the core setup once, verify that every important
                workflow works, and know exactly what remains before you depend
                on Trading Docks for live orders.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                <StatusPill
                  label={`${requiredComplete}/${requiredSteps.length} required complete`}
                  good={ready}
                />
                <StatusPill
                  label={`${totalComplete}/${STEPS.length} total complete`}
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
                    Launch readiness
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
                    <Target className="h-5 w-5" />
                  )}
                </span>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.055]">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300 transition-[width] duration-500"
                  style={{ width: `${score}%` }}
                />
              </div>

              {nextStep ? (
                <Link
                  href={nextStep.href}
                  className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-blue-300/[0.12] bg-blue-400/[0.04] px-4 py-3 transition hover:border-cyan-300/[0.22] hover:bg-blue-400/[0.07]"
                >
                  <span>
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-600">
                      Recommended next
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-white">
                      {nextStep.title}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-cyan-300" />
                </Link>
              ) : (
                <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-300/[0.14] bg-emerald-300/[0.045] px-4 py-3 text-sm font-semibold text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  Seller launch checklist complete
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="grid gap-3 md:grid-cols-2">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const done = completed.includes(step.id);

              return (
                <article
                  key={step.id}
                  className={[
                    "group relative overflow-hidden rounded-[24px] border p-5 transition duration-300",
                    done
                      ? "border-emerald-300/[0.15] bg-emerald-300/[0.035]"
                      : "border-white/[0.075] bg-[#071522] hover:-translate-y-0.5 hover:border-blue-300/[0.16]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={[
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                        done
                          ? "border-emerald-300/[0.16] bg-emerald-300/[0.06] text-emerald-300"
                          : "border-blue-300/[0.12] bg-blue-400/[0.05] text-blue-300",
                      ].join(" ")}
                    >
                      {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </span>

                    <span className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-600">
                      {step.required ? "Required" : "Recommended"}
                    </span>
                  </div>

                  <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/75">
                    {String(index + 1).padStart(2, "0")} · {step.phase}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold tracking-[-0.025em] text-white">
                    {step.title}
                  </h2>
                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-500">
                    {step.description}
                  </p>

                  <div className="mt-5 flex items-center gap-2">
                    <Link
                      href={step.href}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-blue-300/[0.13] bg-blue-400/[0.045] px-3 text-xs font-semibold text-blue-100 transition hover:bg-blue-400/[0.08]"
                    >
                      {step.action}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => toggleStep(step.id)}
                      aria-pressed={done}
                      className={[
                        "inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-semibold transition",
                        done
                          ? "bg-emerald-300/[0.09] text-emerald-200"
                          : "border border-white/[0.08] bg-white/[0.025] text-slate-400 hover:text-white",
                      ].join(" ")}
                    >
                      {done ? "Completed" : "Mark done"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[24px] border border-white/[0.075] bg-[#071522] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                Seller launch standard
              </p>
              <div className="mt-5 space-y-4">
                <ReadinessItem
                  title="Inventory exists"
                  complete={completed.includes("inventory")}
                />
                <ReadinessItem
                  title="Marketplace connected"
                  complete={completed.includes("marketplace")}
                />
                <ReadinessItem
                  title="Order reviewed"
                  complete={completed.includes("orders")}
                />
                <ReadinessItem
                  title="Workspace confirmed"
                  complete={completed.includes("business-profile")}
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-cyan-300/[0.13] bg-gradient-to-br from-blue-500/[0.08] to-cyan-300/[0.025] p-5">
              <CircleDollarSign className="h-5 w-5 text-cyan-300" />
              <h3 className="mt-4 text-lg font-semibold text-white">
                What this phase solves
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                A new Seller account gets one guided path instead of being
                expected to understand Inventory, Marketplaces, Orders,
                Purchasing, CRM, and Automation independently.
              </p>
            </div>
          </aside>
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
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          good ? "bg-emerald-300" : "bg-blue-300",
        ].join(" ")}
      />
      {label}
    </span>
  );
}

function ReadinessItem({
  title,
  complete,
}: {
  title: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={[
          "flex h-8 w-8 items-center justify-center rounded-xl border",
          complete
            ? "border-emerald-300/[0.14] bg-emerald-300/[0.05] text-emerald-300"
            : "border-white/[0.07] bg-white/[0.02] text-slate-700",
        ].join(" ")}
      >
        <Check className="h-4 w-4" />
      </span>
      <span className={complete ? "text-sm font-medium text-slate-200" : "text-sm text-slate-600"}>
        {title}
      </span>
    </div>
  );
}
