"use client";

import { Eye, ShieldCheck } from "lucide-react";

const plans = [
  { id: "free", name: "Free", description: "Entry-level dashboard with paid Inventory access locked." },
  { id: "collector", name: "Collector", description: "Personal collection storage, search, filing, and put-away tools." },
  { id: "seller", name: "Seller", description: "Marketplace listings, pricing queues, and seller operations." },
  { id: "business", name: "Store", description: "Complete store command center and advanced reporting." },
] as const;

export function PlanPreview() {
  return (
    <section className="rounded-[24px] border border-white/[0.07] bg-[#06121b] p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] text-cyan-200">
          <Eye className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/65">Owner testing</p>
          <h2 className="mt-1 text-xl font-semibold text-white">View dashboard as a plan</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Temporarily view Trading Docks with a customer plan&apos;s access. Your Owner account and subscription are never changed.
          </p>
        </div>
      </div>
      <div className="mt-7 grid gap-3 md:grid-cols-2">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
            <h3 className="text-sm font-semibold text-white">{plan.name}</h3>
            <p className="mt-1.5 min-h-10 text-[11px] leading-5 text-slate-500">{plan.description}</p>
            <a href={`/dashboard/admin/preview?plan=${plan.id}&next=/dashboard`} className="mt-4 flex h-10 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.1]">
              View as {plan.name}
            </a>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.035] p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-300" />
          <div>
            <p className="text-xs font-semibold text-emerald-100">Return to your full Owner account</p>
            <p className="mt-1 text-[10px] text-emerald-100/50">Clears any active preview immediately.</p>
          </div>
        </div>
        <a href="/dashboard/admin/preview?next=/dashboard/admin" className="flex h-10 items-center justify-center rounded-xl bg-emerald-300 px-4 text-xs font-bold text-[#082017] transition hover:bg-emerald-200">
          Return to Owner View
        </a>
      </div>
      <p className="mt-4 text-[10px] text-slate-600">Owner-only previews expire automatically after four hours.</p>
    </section>
  );
}
