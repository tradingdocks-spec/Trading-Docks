"use client";

import Image from "next/image";
import {
  Activity,
  Boxes,
  Check,
  ChevronDown,
  CircleDollarSign,
  PackageCheck,
  Search,
  TrendingUp,
} from "lucide-react";

import { useCountUp } from "@/hooks/useCountUp";
import { useRotateActivity } from "@/hooks/useRotateActivity";
import styles from "./SignatureHero.module.css";

const BARS = [34, 48, 41, 60, 52, 72, 64, 81, 74, 92, 86, 100];

export function DashboardPreview() {
  return (
    <div className={`${styles.dashboardFloat} relative mx-auto w-full max-w-[735px] lg:-translate-y-6`}>
      <div className="pointer-events-none absolute inset-x-[-2%] top-[8%] h-[86%] rounded-full bg-blue-400/[0.11] blur-[135px]" />

      <FloatingStatus
        className="-left-12 top-[22%] hidden xl:flex"
        title="Inventory synced"
        value="+248 items"
        detail="Updated moments ago"
      />

      <FloatingStatus
        className="-bottom-8 right-[5%] hidden xl:flex"
        title="Listings updated"
        value="+126 today"
        detail="22,640 active total"
      />

      <FloatingStatus
        className="-right-10 top-[47%] hidden 2xl:flex"
        title="Price movement"
        value="+6.4%"
        detail="Across watched cards"
      />

      <div
        className={`${styles.dashboardShell} relative overflow-visible rounded-[28px] border border-blue-300/20 bg-[#06131d]/94 shadow-[0_48px_140px_rgba(0,0,0,0.58),0_0_96px_rgba(59,130,246,0.07)] backdrop-blur-2xl`}
      >
        <div className={`${styles.dashboardContent} overflow-hidden rounded-[28px]`}>
          <div className="flex h-11 items-center justify-between border-b border-white/[0.06] bg-white/[0.015] px-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-400/80" />
              <span className="h-2 w-2 rounded-full bg-amber-300/80" />
              <span className="h-2 w-2 rounded-full bg-emerald-300/80" />
            </div>

            <div className="flex items-center gap-2 rounded-full border border-blue-300/10 bg-blue-300/[0.035] px-2.5 py-1 text-[8px] text-blue-100/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.8)]" />
              Product preview
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold tracking-[-0.025em] text-white">
                    Business overview
                  </h3>

                  <span className="rounded-full border border-emerald-300/10 bg-emerald-300/[0.035] px-2 py-1 text-[7px] font-semibold text-emerald-300">
                    Sample data
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[7px] text-slate-600">
                  <span className="mr-1">Example integrations:</span>
                  {["TCGplayer", "eBay", "Mana Pool"].map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 rounded-full border border-white/[0.05] bg-white/[0.018] px-2 py-1 text-slate-500"
                    >
                      <Check className="h-2.5 w-2.5 text-emerald-300" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className={`${styles.edgeGlow} flex h-8 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 text-[8px] text-slate-400`}
              >
                <Search className="h-3.5 w-3.5" />
                Find any card
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Metric icon={CircleDollarSign} label="Collection value" value={284860} prefix="$" trend="+8.4%" />
              <Metric icon={Boxes} label="Inventory" value={49821} trend="+248" />
              <Metric icon={PackageCheck} label="Listings" value={22640} trend="+6.2%" />
              <Metric icon={TrendingUp} label="Monthly profit" value={6842} prefix="$" trend="+12.4%" />
            </div>

            <div className="mt-3 grid gap-2.5 lg:grid-cols-[1.45fr_0.75fr]">
              <PortfolioChart />
              <LiveActivity />
            </div>
          </div>

          <Image
            src="/trading-docks-mark.png"
            alt=""
            width={1024}
            height={1024}
            className="pointer-events-none absolute bottom-2 right-2 h-16 w-16 object-contain opacity-[0.05]"
          />
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  prefix = "",
  trend,
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
  prefix?: string;
  trend: string;
}) {
  const animatedValue = useCountUp(value);

  return (
    <div className={`${styles.edgeGlow} group rounded-xl border border-white/[0.07] bg-[#091925] p-3`}>
      <div className="flex items-center justify-between">
        <p className="text-[6px] font-semibold uppercase tracking-[0.15em] text-slate-500">
          {label}
        </p>

        <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-blue-300/10 bg-blue-300/[0.045] text-blue-300/80 transition group-hover:border-blue-300/18 group-hover:bg-blue-300/[0.07] group-hover:text-blue-200">
          <Icon className="h-3 w-3" />
        </span>
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-2">
        <p className="text-sm font-semibold text-white">
          {prefix}
          {animatedValue.toLocaleString()}
        </p>

        <span className="text-[7px] font-semibold text-emerald-300">{trend}</span>
      </div>
    </div>
  );
}

function PortfolioChart() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#040d14] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-semibold text-white">Portfolio growth</p>
          <p className="mt-1 text-[7px] text-slate-600">Inventory value over time</p>
        </div>

        <button type="button" className="flex items-center gap-1 text-[7px] text-slate-500">
          Last 12 months
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      <div className={`${styles.chartPulse} relative mt-3.5 h-[160px] overflow-hidden rounded-xl border border-white/[0.04] bg-[#02080d] px-3.5 pb-6 pt-4`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_12%,rgba(59,130,246,0.06),transparent_34%)]" />
        <span className={styles.chartTravelLight} />

        {[25, 50, 75].map((top) => (
          <div
            key={top}
            className="absolute inset-x-3.5 border-t border-dashed border-white/[0.04]"
            style={{ top: `${top}%` }}
          />
        ))}

        <div className="relative flex h-full items-end gap-1.5">
          {BARS.map((height, index) => (
            <div key={index} className="flex h-full min-w-0 flex-1 items-end">
              <div
                className={`${styles.chartBar} relative w-full rounded-t-[6px] bg-gradient-to-t from-blue-600/52 via-blue-400/72 to-blue-200/92 shadow-[0_0_14px_rgba(59,130,246,0.065)]`}
                style={{
                  height: `${height}%`,
                  animationDelay: `${180 + index * 55}ms`,
                }}
              >
                <span className="absolute inset-x-0 top-0 h-px bg-white/55" />
              </div>
            </div>
          ))}
        </div>

        <div className="absolute inset-x-3.5 bottom-1.5 flex justify-between text-[6px] uppercase tracking-[0.1em] text-slate-700">
          <span>Jan</span>
          <span>Mar</span>
          <span>May</span>
          <span>Jul</span>
          <span>Sep</span>
          <span>Dec</span>
        </div>
      </div>
    </div>
  );
}

function LiveActivity() {
  const activities = useRotateActivity();

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#07131d] p-3.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-semibold text-white">Recent updates</p>
          <p className="mt-1 text-[7px] text-slate-600">Example activity</p>
        </div>

        <Activity className="h-3.5 w-3.5 text-blue-300/70" />
      </div>

      <div className="mt-3 space-y-2.5">
        {activities.map(([label, value]) => (
          <div
            key={`${label}-${value}`}
            className={`${styles.edgeGlow} rounded-lg border border-white/[0.045] bg-black/[0.07] px-2.5 py-2.5`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[7px] font-medium text-slate-200">{label}</p>
              <p className="shrink-0 text-[7px] font-semibold text-emerald-300">{value}</p>
            </div>

            <p className="mt-1 text-[6px] text-slate-600">Updated moments ago</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FloatingStatus({
  className,
  title,
  value,
  detail,
}: {
  className: string;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      className={`${styles.floatingStatus} absolute z-20 items-center gap-3 rounded-2xl border border-blue-300/18 bg-[#06131d]/92 px-4 py-3 shadow-[0_24px_60px_rgba(0,0,0,.42)] backdrop-blur-xl ${className}`}
    >
      <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.8)]" />

      <span>
        <span className="block text-[7px] uppercase tracking-[0.16em] text-slate-600">
          {title}
        </span>

        <span className="mt-1 block text-[10px] font-semibold text-white">
          {value}
        </span>

        <span className="mt-1 block text-[7px] text-slate-500">{detail}</span>
      </span>
    </div>
  );
}
