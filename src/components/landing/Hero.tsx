import { ArrowRight } from "lucide-react";

import {
  ExploreLink,
  TransitionLink,
} from "@/components/navigation/PolishedNavigation";
import { HERO_DEMO_WORKSPACE } from "./landing-data";

const CARD_LIFECYCLE = [
  {
    step: "Identify",
    copy: "Resolve the exact printing before it enters the workspace.",
  },
  {
    step: "Value",
    copy: "Attach market context, cost basis, condition, finish, and risk.",
  },
  {
    step: "Place",
    copy: "Know whether it belongs in storage, a binder, a deck, or a listing queue.",
  },
  {
    step: "Move",
    copy: "Turn ownership into sales, trades, orders, labels, and reporting.",
  },
];

const INTELLIGENCE_ROWS = [
  {
    label: "TCGplayer order",
    value: "$74.36",
    detail: "3 cards ready to pick",
  },
  {
    label: "Reprice candidate",
    value: "62",
    detail: "Floor rules respected",
  },
  {
    label: "Buylist spread",
    value: "+18%",
    detail: "Retro frame singles",
  },
  {
    label: "Storage review",
    value: "18",
    detail: "Unassigned cards",
  },
];

export function Hero() {
  const demo = HERO_DEMO_WORKSPACE;

  return (
    <section className="relative z-10 border-b border-white/[0.06]">
      <div className="mx-auto grid min-h-[calc(100vh-92px)] w-full max-w-[1480px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-12 lg:py-16">
        <div className="flex min-w-0 max-w-3xl flex-col justify-center">
          <div className="min-w-0 max-w-[680px]">
            <p className="text-sm font-medium leading-6 text-cyan-200">
              Trading Docks is a card intelligence and operations system.
            </p>
            <h1 className="mt-5 max-w-full text-[38px] font-semibold leading-[0.94] tracking-[-0.04em] text-white sm:text-[64px] sm:tracking-[-0.06em] lg:text-[78px]">
              Follow every card from scan to sale.
            </h1>
            <p className="mt-6 max-w-2xl break-words text-base leading-8 text-slate-400 sm:text-lg">
              Identify exact printings, understand value, organize physical
              storage, acquire inventory, and operate selling workflows from a
              single workspace built around the life of the card.
            </p>
          </div>

          <div className="mt-9 grid gap-0 border-y border-white/[0.08]">
            {CARD_LIFECYCLE.map((item, index) => (
              <div
                key={item.step}
                className="grid min-w-0 gap-3 border-b border-white/[0.06] py-4 last:border-b-0 sm:grid-cols-[92px_1fr]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-semibold text-white">{item.step}</span>
                </div>
                <p className="min-w-0 break-words text-sm leading-6 text-slate-500">{item.copy}</p>
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <TransitionLink
              href="/sign-up?plan=free"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-cyan-300 px-5 text-sm font-semibold text-[#01131a] transition hover:bg-cyan-200 sm:w-auto"
            >
              Start with your collection
              <ArrowRight className="h-4 w-4" />
            </TransitionLink>
            <ExploreLink
              href="#pricing"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-white/[0.12] px-5 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/40 hover:text-white sm:w-auto"
            >
              Compare plans
              <ArrowRight className="h-4 w-4" />
            </ExploreLink>
          </div>
        </div>

        <div className="flex min-w-0 items-center">
          <div className="min-w-0 w-full border-l border-white/[0.08] pl-5 sm:pl-8 lg:pl-10">
            <div className="grid min-w-0 gap-5 lg:grid-cols-[1fr_280px]">
              <div>
                <div className="flex items-end justify-between gap-6 border-b border-white/[0.08] pb-5">
                  <div>
                    <p className="text-sm text-slate-500">{demo.disclosure}</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white">
                      {demo.plan} operating snapshot
                    </h2>
                  </div>
                  <p className="hidden max-w-[190px] text-right text-xs leading-5 text-slate-600 sm:block">
                    Concrete sample activity, not a live account.
                  </p>
                </div>

                <div className="grid border-b border-white/[0.08] sm:grid-cols-2">
                  {demo.metricLabels.map((label, index) => (
                    <div
                      key={label}
                      className="border-b border-white/[0.06] py-5 pr-5 even:sm:pl-5 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
                    >
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white">
                        {demo.metricValues[index]}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        {demo.metricDetails[index]}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="hidden grid-cols-[1fr_auto_auto] border-b border-white/[0.08] pb-2 text-xs text-slate-600 sm:grid">
                    <span>Signal</span>
                    <span>Value</span>
                    <span className="pl-5">Context</span>
                  </div>
                  {INTELLIGENCE_ROWS.map((row) => (
                    <div
                      key={row.label}
                      className="grid gap-1 border-b border-white/[0.06] py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-0"
                    >
                      <span className="font-medium text-slate-200">{row.label}</span>
                      <span className="font-semibold text-white sm:text-right">{row.value}</span>
                      <span className="text-xs leading-5 text-slate-600 sm:max-w-[150px] sm:pl-5 sm:text-right">
                        {row.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="border-t border-white/[0.08] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <p className="text-sm font-semibold text-white">Workspace route</p>
                <div className="mt-4 grid gap-3">
                  {demo.nav.map((item, index) => (
                    <div
                      key={item}
                      className="flex items-center justify-between border-b border-white/[0.06] pb-3 last:border-b-0"
                    >
                      <span className="text-sm text-slate-400">{item}</span>
                      <span className="text-xs text-slate-700">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-7 border-t border-white/[0.08] pt-5">
                  <p className="text-xs leading-5 text-slate-600">
                    Permissions shown on the public site are backed by the same
                    plan-aware workspace model used after signup.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
