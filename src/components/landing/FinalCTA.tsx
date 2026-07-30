import { ArrowRight } from "lucide-react";
import { TransitionLink } from "@/components/navigation/PolishedNavigation";

export function FinalCTA() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1480px] px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
      <div className="relative overflow-hidden rounded-[34px] border border-[#00d7f2]/20 bg-[#061522] px-7 py-12 shadow-[0_35px_120px_rgba(0,0,0,0.44)] sm:px-10 lg:px-14 lg:py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_50%,rgba(0,215,242,0.12),transparent_30%),radial-gradient(circle_at_96%_12%,rgba(79,113,148,0.09),transparent_34%)]" />

        <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#20e7ff]">
              One workspace. Every part of your business.
            </p>

            <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Build the command center for your card business.
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-7 text-[#8296aa]">
              Start with your collection today, then unlock deeper selling and store
              operations as your business grows.
            </p>
          </div>

          <TransitionLink
            href="/sign-up"
            className="primary-button group relative inline-flex h-12 items-center justify-center gap-3 overflow-hidden rounded-2xl px-7 text-sm font-semibold text-[#00131a]"
          >
            <span className="relative z-10">Create your workspace</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-[3px]" />
          </TransitionLink>
        </div>
      </div>
    </section>
  );
}
