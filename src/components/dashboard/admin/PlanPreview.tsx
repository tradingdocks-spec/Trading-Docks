"use client";

import { Eye, ShieldCheck } from "lucide-react";

const plans = [
  { id: "free", name: "Free", description: "Entry-level dashboard with paid Inventory access locked." },
  { id: "collector", name: "Collector", description: "Personal collection storage, search, filing, and put-away tools." },
  { id: "seller", name: "Seller", description: "Marketplace listings, pricing queues, and seller operations." },
  { id: "store", name: "Store", description: "Complete store command center and advanced reporting." },
] as const;

export function PlanPreview() {
  return (
    <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-td-accent/15 bg-td-accent/[0.055] text-td-accent-text">
          <Eye className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-td-accent-text/65">Owner testing</p>
          <h2 className="mt-1 text-xl font-semibold text-td-primary">View dashboard as a plan</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-td-muted">
            Temporarily view Trading Docks with a customer plan&apos;s access. Your Owner account and subscription are never changed.
          </p>
        </div>
      </div>
      <div className="mt-7 grid gap-3 md:grid-cols-2">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-2xl border border-td-ink/[0.07] bg-black/10 p-4">
            <h3 className="text-sm font-semibold text-td-primary">{plan.name}</h3>
            <p className="mt-1.5 min-h-10 text-[11px] leading-5 text-td-muted">{plan.description}</p>
            <a href={`/dashboard/admin/preview?plan=${plan.id}&next=/dashboard`} className="mt-4 flex h-10 items-center justify-center rounded-xl border border-td-accent/15 bg-td-accent/[0.06] px-4 text-xs font-semibold text-td-accent-text transition hover:bg-td-accent/[0.1]">
              View as {plan.name}
            </a>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-td-success/15 bg-td-success/[0.035] p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-td-success" />
          <div>
            <p className="text-xs font-semibold text-td-success">Return to your full Owner account</p>
            <p className="mt-1 text-[11px] text-td-success/50">Clears any active preview immediately.</p>
          </div>
        </div>
        <a href="/dashboard/admin/preview?next=/dashboard/admin" className="flex h-10 items-center justify-center rounded-xl bg-td-success px-4 text-xs font-bold text-td-on-accent transition hover:bg-td-success">
          Return to Owner View
        </a>
      </div>
      <p className="mt-4 text-[11px] text-td-muted">Owner-only previews expire automatically after four hours.</p>
    </section>
  );
}
