import { ArrowRight, CheckCircle2 } from "lucide-react";

import { TransitionLink } from "@/components/navigation/PolishedNavigation";

export function FinalCTA() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1480px] px-4 pb-20 sm:px-8 sm:pb-24 lg:px-12 lg:pb-32">
      <div className="relative overflow-hidden rounded-[26px] border sm:rounded-[34px] border-cyan-300/[0.18] bg-[#061522] px-5 py-10 sm:px-7 sm:py-12 shadow-[0_35px_120px_rgba(0,0,0,0.44)] sm:px-10 lg:px-14 lg:py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_50%,rgba(0,215,242,0.13),transparent_30%),radial-gradient(circle_at_96%_12%,rgba(79,113,148,0.1),transparent_34%)]" />

        <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Start on the plan that fits today
            </p>

            <h2 className="mt-4 max-w-3xl text-3xl font-semibold sm:text-4xl tracking-[-0.045em] sm:text-5xl">
              Build your collection now.
              <span className="block text-blue-200">
                Add business operations when you need them.
              </span>
            </h2>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {[
                "Free workspace",
                "No forced upgrade",
                "Keep your data as you grow",
              ].map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-2 text-sm text-slate-400"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <TransitionLink
            href="/sign-up?plan=free"
            className="primary-button group relative inline-flex h-[52px] w-full items-center justify-center gap-3 overflow-hidden rounded-2xl px-7 text-sm font-semibold text-[#00131a]"
          >
            <span className="relative z-10">Create your free workspace</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-[3px]" />
          </TransitionLink>
        </div>
      </div>
    </section>
  );
}
