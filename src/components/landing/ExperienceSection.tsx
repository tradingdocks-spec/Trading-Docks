"use client";

import { useState } from "react";

import { LANDING_DEMO_WORKSPACES, type LandingDemoPersona } from "./landing-data";

const PERSONAS: LandingDemoPersona[] = ["collector", "seller", "store"];

const WORKFLOW_BY_PERSONA: Record<
  LandingDemoPersona,
  Array<{ label: string; action: string; evidence: string }>
> = {
  collector: [
    { label: "Identify", action: "Add exact printings", evidence: "Scanner and binder records" },
    { label: "Value", action: "Track movement", evidence: "Collection value history" },
    { label: "Place", action: "Assign storage", evidence: "Binder, box, page, slot" },
    { label: "Move", action: "Prepare trades", evidence: "Wishlist and trade binder" },
  ],
  seller: [
    { label: "Identify", action: "Resolve intake", evidence: "TCGplayer IDs and condition" },
    { label: "Value", action: "Calculate offer", evidence: "Margin, fees, and demand" },
    { label: "Place", action: "Route inventory", evidence: "Listed, held, or repriced" },
    { label: "Move", action: "Fulfill orders", evidence: "Marketplace queue" },
  ],
  store: [
    { label: "Identify", action: "Receive product", evidence: "Singles, sealed, labels" },
    { label: "Value", action: "Control capital", evidence: "Weekly revenue and intake" },
    { label: "Place", action: "Coordinate staff", evidence: "Tasks and locations" },
    { label: "Move", action: "Operate channels", evidence: "POS, shows, marketplaces" },
  ],
};

export function ExperienceSection() {
  const [active, setActive] = useState<LandingDemoPersona>("seller");
  const demo = LANDING_DEMO_WORKSPACES[active];
  const workflow = WORKFLOW_BY_PERSONA[active];

  return (
    <section
      id="experience"
      data-td-reveal
      className="relative z-10 border-y border-white/[0.06] bg-[#020912] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-12"
    >
      <div className="mx-auto max-w-[1480px]">
        <div className="grid min-w-0 gap-10 lg:grid-cols-[360px_1fr]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-cyan-200">Workspace fit</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-5xl">
              The same card lifecycle, tuned for different operators.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-500">
              Collector, Seller, and Store workspaces share the same data
              authority. The interface changes because the decisions change.
            </p>
          </div>

          <div className="min-w-0">
            <div className="grid border-y border-white/[0.08] md:grid-cols-3">
              {PERSONAS.map((persona) => {
                const item = LANDING_DEMO_WORKSPACES[persona];
                const selected = persona === active;
                return (
                  <button
                    key={persona}
                    type="button"
                    onClick={() => setActive(persona)}
                    className={[
                      "border-b border-white/[0.08] py-5 text-left transition md:border-b-0 md:border-r md:px-5 md:last:border-r-0",
                      selected ? "text-white" : "text-slate-500 hover:text-slate-200",
                    ].join(" ")}
                  >
                    <span className="text-xs text-slate-700">{item.disclosure}</span>
                    <span className="mt-2 block text-2xl font-semibold tracking-[-0.035em]">
                      {item.plan}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-slate-500">
                      {item.tagline}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-8 border-b border-white/[0.08] py-8 lg:grid-cols-[1fr_320px]">
              <div>
                <div className="grid grid-cols-2 border-y border-white/[0.08]">
                  {demo.metricLabels.map((label, index) => (
                    <div
                      key={label}
                      className="border-b border-white/[0.06] py-4 pr-4 odd:border-r even:pl-4 [&:nth-last-child(-n+2)]:border-b-0"
                    >
                      <p className="text-xs text-slate-600">{label}</p>
                      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                        {demo.metricValues[index]}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        {demo.metricDetails[index]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <aside>
                <p className="text-sm font-semibold text-white">{demo.plan} navigation</p>
                <div className="mt-4 grid gap-3">
                  {demo.nav.map((item, index) => (
                    <div key={item} className="flex justify-between border-b border-white/[0.06] pb-3">
                      <span className="text-sm text-slate-400">{item}</span>
                      <span className="text-xs text-slate-700">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>

            <div className="grid border-b border-white/[0.08] md:grid-cols-4">
              {workflow.map((step, index) => (
                <div
                  key={step.label}
                  className="border-b border-white/[0.08] py-5 md:border-b-0 md:border-r md:px-5 md:last:border-r-0"
                >
                  <p className="text-xs text-slate-700">{String(index + 1).padStart(2, "0")}</p>
                  <h3 className="mt-3 text-lg font-semibold text-white">{step.label}</h3>
                  <p className="mt-2 text-sm text-slate-400">{step.action}</p>
                  <p className="mt-3 text-xs leading-5 text-slate-600">{step.evidence}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
