import type { LucideIcon } from "lucide-react";

import { FEATURES } from "./landing-data";

export function FeaturesSection() {
  return (
    <section
      id="platform"
      className="relative z-10 border-y border-white/[0.055] bg-white/[0.012]"
    >
      <div className="mx-auto w-full max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#20e7ff]">
            One intelligent platform
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Every part of your business, in one workspace.
          </h2>
          <p className="mt-5 text-base leading-7 text-[#8296aa]">
            Inventory. Pricing. Orders. Analytics. Automation. Marketplace sync.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  feature,
}: {
  feature: {
    title: string;
    description: string;
    stat: string;
    icon: LucideIcon;
  };
}) {
  const Icon = feature.icon;

  return (
    <article className="group relative min-h-[275px] overflow-hidden rounded-[25px] border border-white/[0.085] bg-[#071522]/80 p-5 shadow-[0_24px_75px_rgba(0,0,0,0.24)] backdrop-blur-xl transition duration-500 hover:-translate-y-2 hover:border-[#00d7f2]/24 hover:bg-[#081927]">
      <div className="relative">
        <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-[19px] border border-white/[0.055] bg-black/[0.11]">
          <div className="absolute h-20 w-20 rounded-full border border-[#00d7f2]/14 transition duration-700 group-hover:scale-110 group-hover:rotate-12" />
          <div className="absolute h-14 w-28 rotate-[-18deg] rounded-[50%] border border-[#4f7194]/16 transition duration-700 group-hover:rotate-[5deg]" />

          <div className="flex h-13 w-13 items-center justify-center rounded-2xl border border-[#00d7f2]/24 bg-[#00d7f2]/[0.09] text-[#66f0ff] shadow-[0_0_28px_rgba(0,215,242,0.11)] transition duration-500 group-hover:-translate-y-1 group-hover:scale-110 group-hover:rotate-[5deg]">
            <Icon className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{feature.title}</h3>
          <span className="rounded-full border border-[#00d7f2]/10 bg-[#00d7f2]/[0.04] px-2 py-1 text-[9px] font-medium text-[#20e7ff]/75">
            {feature.stat}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-[#71879b]">{feature.description}</p>
      </div>
    </article>
  );
}
