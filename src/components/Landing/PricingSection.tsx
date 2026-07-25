import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative z-10 mx-auto w-full max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#20e7ff]">
          Early access
        </p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
          Start building your workspace now.
        </h2>
        <p className="mt-5 text-base leading-7 text-[#8296aa]">
          Trading Docks is free during development while the platform is refined with early users.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-[760px] overflow-hidden rounded-[30px] border border-[#00d7f2]/20 bg-[#061522] shadow-[0_35px_110px_rgba(0,0,0,0.42),0_0_45px_rgba(0,215,242,0.05)]">
        <div className="relative p-7 sm:p-10">
          <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-[#00d7f2]/18 bg-[#00d7f2]/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#20e7ff]">
                Founding access
              </div>

              <p className="mt-5 text-4xl font-semibold tracking-[-0.045em]">Free</p>
              <p className="mt-2 text-sm text-[#8296aa]">During development and private beta.</p>
            </div>

            <Link
              href="/sign-up"
              className="primary-button group relative inline-flex h-12 items-center justify-center gap-3 overflow-hidden rounded-2xl px-7 text-sm font-semibold text-[#00131a]"
            >
              <span className="relative z-10">Create your workspace</span>
              <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-[3px]" />
            </Link>
          </div>

          <div className="relative mt-8 grid gap-3 border-t border-white/[0.06] pt-7 sm:grid-cols-3">
            {["No credit card", "Direct product input", "Founding-user access"].map((label) => (
              <div key={label} className="flex items-center gap-2 text-sm text-[#9aabba]">
                <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#00d7f2]/14 bg-[#00d7f2]/[0.05]">
                  <Check className="h-3 w-3 text-[#20e7ff]" />
                </div>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
