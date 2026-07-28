import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Sparkles,
} from "lucide-react";

import { DashboardPreview } from "./DashboardPreview";
import styles from "./SignatureHero.module.css";

const FEATURE_POINTS = [
  "Set and Chaos Sort",
  "Find any card quickly",
  "Graded and sealed inventory",
  "Complete inventory system",
];

const LIVE_STATS = [
  "+248 cards imported today",
  "126 listings updated",
  "18 price updates",
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

      <div
        className={`${styles.ambientGlow} pointer-events-none absolute left-[1%] top-[4%] h-[450px] w-[450px] rounded-full bg-cyan-400/[0.042] blur-[150px]`}
      />

      <div
        className={`${styles.heroGlass} mx-auto min-h-[calc(100vh-92px)] w-full max-w-[1480px] overflow-visible`}
      >
        <div
          className={`${styles.heroGlassContent} grid min-h-[calc(100vh-92px)] gap-10 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-14 lg:px-12 lg:py-8`}
        >
          <div className="max-w-[650px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.04] px-3.5 py-2 text-[10px] font-semibold text-cyan-100/85 shadow-[0_0_30px_rgba(34,211,238,0.045)] backdrop-blur-xl">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              Built for collectors, sellers, and stores
            </div>

            <h1 className="mt-6 text-[46px] font-semibold leading-[0.93] tracking-[-0.06em] text-white sm:text-[56px] lg:text-[62px] xl:text-[66px]">
              <span className="block whitespace-nowrap">Run your entire</span>

              <span className={`${styles.headlineGlow} mt-1 block bg-gradient-to-r from-cyan-200 via-cyan-300 to-sky-400 bg-clip-text text-transparent`}>
                collectibles business
              </span>

              <span className="mt-1 block whitespace-nowrap">from one workspace.</span>
            </h1>

            <p className="mt-6 text-sm font-semibold tracking-[0.015em] text-slate-300 sm:text-[15px]">
              Inventory. Listings. Pricing. Sales. Storage. One workspace.
            </p>

            <p className="mt-3 max-w-[615px] text-[15px] leading-7 text-slate-500 sm:text-base">
              Organize singles, sealed products, graded cards, binders, bulk inventory,
              listings, sales, pricing, and exact storage locations from one connected
              operating system.
            </p>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
              {LIVE_STATS.map((stat) => (
                <div
                  key={stat}
                  className="flex items-center gap-2 text-[10px] font-medium text-slate-500"
                >
                  <CircleDot className="h-3 w-3 text-emerald-300" />
                  {stat}
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className={`${styles.primaryButton} group inline-flex h-[52px] items-center justify-center gap-3 rounded-[15px] bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 px-7 text-sm font-semibold text-[#001018] shadow-[0_18px_45px_rgba(34,211,238,0.18),inset_0_1px_0_rgba(255,255,255,0.68),inset_0_-1px_0_rgba(3,105,161,0.3)] transition hover:-translate-y-0.5 hover:brightness-105`}
              >
                <span className="relative z-10">Create your workspace</span>
                <ArrowRight className="relative z-10 h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>

              <a
                href="#platform"
                className={`${styles.edgeGlow} group inline-flex h-[52px] items-center justify-center gap-3 rounded-[15px] border border-white/[0.085] bg-white/[0.02] px-7 text-sm font-semibold text-slate-200 backdrop-blur-xl`}
              >
                Explore the platform
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
              </a>
            </div>

            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {FEATURE_POINTS.map((label) => (
                <div
                  key={label}
                  className={`${styles.edgeGlow} group flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.014] px-3 py-2.5 text-[11px] text-slate-400 backdrop-blur-xl`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-cyan-300/75 transition group-hover:text-cyan-200" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
