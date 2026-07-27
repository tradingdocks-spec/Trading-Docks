import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AUTOMATION_CARDS } from "./landing-data";

export function AutomationSection() {
  return (
    <section
      id="automation"
      className="relative z-10 mx-auto w-full max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32"
    >
      <div className="relative overflow-hidden rounded-[34px] border border-[#00d7f2]/18 bg-[#061522] px-6 py-12 shadow-[0_35px_120px_rgba(0,0,0,0.42)] sm:px-9 lg:px-12 lg:py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_25%,rgba(0,215,242,0.1),transparent_30%),radial-gradient(circle_at_98%_85%,rgba(79,113,148,0.09),transparent_34%)]" />

        <div className="relative grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#20e7ff]">
              Automation, without the clutter
            </p>

            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Turn repeatable work into reliable systems.
            </h2>

            <p className="mt-5 max-w-xl text-base leading-7 text-[#8296aa]">
              Build workflows around the way your business actually runs—from intake and
              cataloging through pricing, selling, and fulfillment.
            </p>

            <Link
              href="/sign-up"
              className="secondary-button mt-8 inline-flex h-11 items-center gap-3 rounded-xl px-5 text-sm font-semibold"
            >
              Explore automation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {AUTOMATION_CARDS.map((card) => {
              const Icon = card.icon;

              return (
                <article
                  key={card.title}
                  className="group rounded-[22px] border border-white/[0.075] bg-black/[0.12] p-5 transition duration-400 hover:-translate-y-1.5 hover:border-[#00d7f2]/20 hover:bg-[#00d7f2]/[0.03]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#00d7f2]/15 bg-[#00d7f2]/[0.07] text-[#20e7ff] transition group-hover:scale-105 group-hover:rotate-[5deg]">
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-6 text-base font-semibold">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#71879b]">{card.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
