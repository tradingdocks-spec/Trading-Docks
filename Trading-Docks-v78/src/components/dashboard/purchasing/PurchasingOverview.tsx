"use client";

import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CircleDollarSign,
  Clock3,
  History,
  PackageCheck,
  Scale,
  Sparkles,
  WalletCards,
} from "lucide-react";

const workspaces = [
  {
    href: "/dashboard/collection-buying",
    title: "Collection Buying",
    detail:
      "Price singles, select exact printings, calculate protected cash and store-credit offers, and send accepted purchases to intake.",
    icon: WalletCards,
    metric: "0 open appraisals",
    tone: "cyan",
  },
  {
    href: "/dashboard/sealed-buying",
    title: "Sealed Product Buying",
    detail:
      "Appraise booster boxes, bundles, decks, cases, and other factory-sealed products with inventory-aware offers.",
    icon: PackageCheck,
    metric: "0 products reviewed",
    tone: "emerald",
  },
  {
    href: "/dashboard/bulk-buying",
    title: "Bulk Buying",
    detail:
      "Estimate long boxes, bulk rares, foils, lands, tokens, and mixed collections by count, category, or weight.",
    icon: Scale,
    metric: "0 pending lots",
    tone: "violet",
  },
];

export function PurchasingOverview() {
  return (
    <main className="min-h-screen bg-[#020b12] px-5 py-7 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1480px]">
        <header className="rounded-[28px] border border-cyan-300/[0.12] bg-[#06141f] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.28)] sm:p-8">
          <p className="text-[9px] font-semibold uppercase tracking-[0.19em] text-cyan-300">
            Purchasing Department
          </p>
          <div className="mt-3 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                Acquire inventory with confidence.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                Keep collection buying and sealed-product buying as separate,
                purpose-built workflows while managing every purchase from one
                operating center.
              </p>
            </div>

            <Link
              href="/dashboard/buying-recommendations"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-[9px] font-semibold text-[#001018]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Review AI opportunities
            </Link>
          </div>
        </header>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Purchases Today"
            value="$0"
            detail="0 completed purchases"
            icon={CircleDollarSign}
          />
          <Kpi
            label="Pending Appraisals"
            value="0"
            detail="Nothing awaiting review"
            icon={Clock3}
          />
          <Kpi
            label="Available Budget"
            value="$0"
            detail="Set a budget to begin"
            icon={CircleDollarSign}
          />
          <Kpi
            label="Purchase History"
            value="0"
            detail="No purchases on record"
            icon={History}
          />
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-3">
          {workspaces.map((workspace) => {
            const Icon = workspace.icon;

            return (
              <Link
                key={workspace.href}
                href={workspace.href}
                className="group rounded-[24px] border border-white/[0.07] bg-[#06141f] p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/[0.18]"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/[0.12] bg-cyan-400/[0.04] text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-700 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
                </div>
                <h2 className="mt-5 text-lg font-semibold">{workspace.title}</h2>
                <p className="mt-2 text-[10px] leading-5 text-slate-600">
                  {workspace.detail}
                </p>
                <p className="mt-5 text-[8px] font-semibold uppercase tracking-[0.12em] text-cyan-300">
                  {workspace.metric}
                </p>
              </Link>
            );
          })}
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-[24px] border border-white/[0.07] bg-[#06141f] p-5">
            <div className="flex items-center gap-3">
              <BrainCircuit className="h-4 w-4 text-violet-300" />
              <div>
                <p className="text-sm font-semibold">Today’s buying intelligence</p>
                <p className="mt-1 text-[8px] text-slate-700">
                  Inventory-aware recommendations across singles, sealed, and bulk.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] px-5 py-9 text-center text-[10px] text-slate-600">
              Buying recommendations will appear after this account adds inventory and purchasing activity.
            </div>
          </div>

          <div className="rounded-[24px] border border-white/[0.07] bg-[#06141f] p-5">
            <p className="text-sm font-semibold">Quick links</p>
            <div className="mt-4 space-y-2">
              <QuickLink href="/dashboard/purchase-history" label="Purchase History" />
              <QuickLink href="/dashboard/buying-rules" label="Buying Rules" />
              <QuickLink href="/dashboard/buying-recommendations" label="AI Recommendations" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-[#06141f] p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[7px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <Icon className="h-4 w-4 text-cyan-300" />
      </div>
      <p className="mt-3 text-[8px] text-slate-600">{detail}</p>
    </div>
  );
}

function Insight({
  title,
  item,
  detail,
  tone,
}: {
  title: string;
  item: string;
  detail: string;
  tone: "good" | "warn" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-white/[0.055] bg-black/[0.1] p-4">
      <p
        className={[
          "text-[7px] font-semibold uppercase tracking-[0.12em]",
          tone === "good"
            ? "text-emerald-300"
            : tone === "warn"
              ? "text-amber-300"
              : "text-violet-300",
        ].join(" ")}
      >
        {title}
      </p>
      <p className="mt-2 text-xs font-semibold text-slate-200">{item}</p>
      <p className="mt-2 text-[8px] leading-4 text-slate-600">{detail}</p>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex h-10 items-center justify-between rounded-xl border border-white/[0.055] bg-white/[0.018] px-3 text-[9px] text-slate-500 transition hover:border-cyan-300/[0.14] hover:text-cyan-200"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}
