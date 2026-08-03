import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Check,
  Layers3,
  PackageSearch,
  Sparkles,
} from "lucide-react";

import { DashboardPreview } from "./DashboardPreview";
import {
  ExploreLink,
  TransitionLink,
} from "@/components/navigation/PolishedNavigation";
import styles from "./SignatureHero.module.css";

const PLAN_STAGES = [
  {
    name: "Free",
    description: "Inventory and Deck Vault",
    icon: Layers3,
  },
  {
    name: "Collector",
    description: "Analytics and CSV tools",
    icon: BarChart3,
  },
  {
    name: "Seller",
    description: "Purchasing, CRM, and orders",
    icon: PackageSearch,
  },
  {
    name: "Store",
    description: "Teams and store operations",
    icon: Building2,
  },
];

const TRUST_POINTS = [
  "Start free",
  "Clear plan boundaries",
  "Upgrade without rebuilding",
];

export function Hero() {
  return (
    <section className="relative z-10">
      <div className={styles.signatureGrid} aria-hidden="true" />

      <div className={styles.orbitField} aria-hidden="true">
        <span className={styles.orbitRingOne} />
        <span className={styles.orbitRingTwo} />
        <span className={styles.orbitDotOne} />
        <span className={styles.orbitDotTwo} />
        <span className={styles.orbitDotThree} />
      </div>

      <div className="pointer-events-none absolute left-[2%] top-[4%] h-[470px] w-[470px] rounded-full bg-blue-400/[0.05] blur-[155px]" />

      <div
        className={`${styles.heroGlass} mx-auto min-h-0 lg:min-h-[calc(100vh-92px)] w-full max-w-[1480px] overflow-visible`}
      >
        <div
          className={`${styles.heroGlassContent} grid min-h-0 lg:min-h-[calc(100vh-92px)] gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:gap-14 lg:px-12 lg:py-10`}
        >
          <div className="mx-auto max-w-[680px] text-center lg:mx-0 lg:text-left">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-300/[0.16] bg-blue-300/[0.05] px-3 py-2 text-[11px] sm:px-3.5 sm:text-xs font-semibold text-blue-100 shadow-[0_0_30px_rgba(59,130,246,0.05)] backdrop-blur-xl">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              One operating system for every stage of your collection
            </div>

            <h1 className="mt-6 text-[40px] font-semibold leading-[0.94] tracking-[-0.06em] text-white min-[390px]:text-[44px] sm:text-[58px] lg:text-[66px] xl:text-[72px]">
              Every card. Every order.
              <span
                className={`${styles.headlineGlow} mt-1 block bg-gradient-to-r from-cyan-200 via-blue-300 to-blue-500 bg-clip-text text-transparent`}
              >
                One intelligent workspace.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-[640px] text-[15px] leading-7 lg:mx-0 text-slate-400 sm:text-lg">
              Trading Docks gives collectors, sellers, and stores the exact
              tools they need—without forcing every user into the same
              oversized workspace.
            </p>

            <div className="mx-auto mt-6 grid max-w-[560px] grid-cols-2 gap-2 lg:mx-0">
              {PLAN_STAGES.map(({ name, description, icon: Icon }) => (
                <div
                  key={name}
                  className="group flex items-center gap-3 rounded-2xl border border-white/[0.065] bg-white/[0.018] px-3.5 py-3 backdrop-blur-xl transition hover:border-blue-300/[0.16] hover:bg-blue-400/[0.035]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-300/[0.13] bg-blue-400/[0.05] text-blue-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{name}</p>
                    <p className="mt-0.5 hidden text-xs text-slate-600 min-[390px]:block">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-7 grid max-w-[560px] grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:mx-0">
              <TransitionLink
                href="/sign-up?plan=free"
                className={`${styles.primaryButton} group inline-flex h-[54px] items-center justify-center gap-3 rounded-[15px] bg-gradient-to-b from-cyan-300 via-blue-400 to-blue-600 px-7 text-sm font-semibold text-[#001018] shadow-[0_18px_45px_rgba(59,130,246,0.2),inset_0_1px_0_rgba(255,255,255,0.68),inset_0_-1px_0_rgba(3,105,161,0.3)] transition hover:-translate-y-0.5 hover:brightness-105`}
              >
                <span className="relative z-10">Start free</span>
                <ArrowRight className="relative z-10 h-4 w-4 transition group-hover:translate-x-0.5" />
              </TransitionLink>

              <ExploreLink
                href="#plans"
                className={`${styles.edgeGlow} group inline-flex h-[54px] items-center justify-center gap-3 rounded-[15px] border border-white/[0.09] bg-white/[0.02] px-7 text-sm font-semibold text-slate-200 backdrop-blur-xl`}
              >
                See which plan fits
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-blue-300" />
              </ExploreLink>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 lg:justify-start">
              {TRUST_POINTS.map((point) => (
                <div
                  key={point}
                  className="flex items-center gap-2 text-xs font-medium text-slate-500"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[760px]">
            <div className="absolute -inset-3 sm:-inset-8 rounded-[40px] bg-blue-500/[0.055] blur-3xl" />
            <DashboardPreview />

            <div className="relative mx-auto mt-4 flex max-w-xl items-start gap-3 rounded-2xl border border-emerald-300/[0.12] bg-[#06131e]/90 px-4 py-3 shadow-[0_18px_55px_rgba(0,0,0,.28)] backdrop-blur-xl">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <p className="text-xs leading-5 text-slate-400">
                The permissions shown on the landing page match the actual
                workspace each plan receives.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
