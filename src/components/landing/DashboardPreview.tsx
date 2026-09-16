"use client";

import Image from "next/image";
import {
  Activity,
  Boxes,
  Check,
  ChevronDown,
  CircleDollarSign,
  Command,
  PackageCheck,
  Search,
  TrendingUp,
} from "lucide-react";

import { useCountUp } from "@/hooks/useCountUp";
import { useRotateActivity } from "@/hooks/useRotateActivity";
import { HERO_DEMO_WORKSPACE } from "./landing-data";
import styles from "./SignatureHero.module.css";

const BARS = HERO_DEMO_WORKSPACE.chartShape;

export function DashboardPreview() {
  const demo = HERO_DEMO_WORKSPACE;
  const statuses = demo.floatingStatuses;

  return (
    <div className="relative mx-auto w-full max-w-[760px] overflow-hidden rounded-[24px] sm:overflow-visible sm:rounded-none lg:-translate-y-4">
      <div className={`${styles.previewAmbient} pointer-events-none absolute inset-x-[-7%] top-[3%] h-[95%] rounded-full bg-td-accent/[0.15] blur-[145px]`} />
      <div className="pointer-events-none absolute inset-x-[8%] bottom-[-5%] h-[22%] rounded-full bg-td-accent/[0.07] blur-[80px]" />

      <FloatingStatus
        className="-left-8 top-[20%] hidden xl:flex"
        title={statuses.inventory.label}
        value={statuses.inventory.value}
        detail={statuses.inventory.detail}
      />

      <FloatingStatus
        className="-bottom-7 right-[7%] hidden xl:flex"
        title={statuses.listings.label}
        value={statuses.listings.value}
        detail={statuses.listings.detail}
      />

      <FloatingStatus
        className="-right-6 top-[48%] hidden 2xl:flex"
        title={statuses.market.label}
        value={statuses.market.value}
        detail={statuses.market.detail}
      />

      <div className="relative overflow-visible rounded-[22px] sm:rounded-[30px] border border-td-accent/[0.24] bg-td-surface shadow-[0_56px_150px_rgb(var(--td-shadow-rgb)/calc(0.62*var(--td-shadow-strength))),0_0_110px_rgb(var(--td-accent-rgb)/0.11)]">
        <div className="relative overflow-hidden rounded-[22px] sm:rounded-[30px]">
          <div className="flex h-10 items-center sm:h-12 justify-between border-b border-td-ink/[0.08] bg-td-surface px-5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-td-danger" />
              <span className="h-2.5 w-2.5 rounded-full bg-td-warning" />
              <span className="h-2.5 w-2.5 rounded-full bg-td-success" />
            </div>

            <div className="flex items-center gap-2 rounded-full border border-td-success/[0.16] bg-td-success/[0.055] px-3 py-1.5 text-[11px] font-semibold text-td-success/85">
              <span className={`${styles.statusPulse} h-2 w-2 rounded-full bg-td-success shadow-[0_0_12px_rgb(var(--td-accent-rgb)/.85)]`} />
              {demo.statusLabel}
            </div>
          </div>

          <div className="p-3.5 sm:p-6">
            <div className="flex items-start justify-between gap-3 sm:gap-5">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-sm font-bold sm:text-lg tracking-[-0.03em] text-td-primary">
                    {demo.plan} overview
                  </h3>

                  <span className="rounded-full border border-td-success/[0.15] bg-td-success/[0.055] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-td-success">
                    {demo.disclosure}
                  </span>
                </div>

                <div className="mt-2 hidden flex-wrap items-center gap-2 text-[11px] min-[430px]:flex sm:mt-3 text-td-secondary">
                  <span className="mr-1 font-medium text-td-muted">Connected:</span>
                  {demo.connectedSystems.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-td-ink/[0.08] bg-td-ink/[0.025] px-2.5 py-1.5 font-medium text-td-secondary"
                    >
                      <Check className="h-3 w-3 text-td-success" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="group hidden h-10 min-w-[170px] sm:flex items-center gap-2.5 rounded-xl border border-td-accent/[0.16] bg-td-raised px-3.5 text-left text-[12px] font-medium text-td-secondary shadow-[inset_0_1px_0_rgb(var(--td-ink-rgb)/.03)] transition hover:border-td-accent/[0.3] hover:bg-td-raised"
              >
                <Search className="h-4 w-4 text-td-accent-text" />
                <span className="flex-1">Find any card</span>
                <span className="flex items-center gap-0.5 rounded-md border border-td-ink/[0.08] bg-black/[0.16] px-1.5 py-1 text-[11px] text-td-muted">
                  <Command className="h-2.5 w-2.5" /> K
                </span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 sm:grid-cols-4">
              <Metric icon={CircleDollarSign} label={demo.metricLabels[0]} value={demo.metricValues[0]} trend={demo.metricDetails[0]} />
              <Metric icon={Boxes} label={demo.metricLabels[1]} value={demo.metricValues[1]} trend={demo.metricDetails[1]} />
              <Metric icon={PackageCheck} label={demo.metricLabels[2]} value={demo.metricValues[2]} trend={demo.metricDetails[2]} />
              <Metric icon={TrendingUp} label={demo.metricLabels[3]} value={demo.metricValues[3]} trend={demo.metricDetails[3]} />
            </div>

            <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3 lg:grid-cols-[1.5fr_0.76fr]">
              <PortfolioChart />
              <LiveActivity />
            </div>
          </div>

          <Image
            src="/trading-docks-mark.png"
            alt=""
            width={128}
            height={128}
            sizes="64px"
            className="pointer-events-none absolute bottom-3 right-3 h-16 w-16 object-contain opacity-[0.035]"
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
  trend,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  trend: string;
}) {
  const numericValue = Number(value.replace(/[^0-9.-]+/g, ""));
  const hasDecimalPrecision = /\d+\.\d+/.test(value);
  const precisionScale = hasDecimalPrecision ? 10 : 1;
  const animatedRawValue = useCountUp(
    Number.isFinite(numericValue) ? Math.abs(numericValue) * precisionScale : 0,
  );
  const animatedValue = animatedRawValue / precisionScale;
  const formattedValue = formatDemoValue(value, animatedValue);

  return (
    <div className="group rounded-xl border border-td-accent/[0.11] bg-td-raised p-3 sm:rounded-2xl sm:p-3.5 shadow-[inset_0_1px_0_rgb(var(--td-ink-rgb)/.025)] transition duration-300 hover:-translate-y-0.5 hover:border-td-accent/[0.22] hover:bg-td-raised">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-td-secondary">
          {label}
        </p>

        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-td-accent/[0.13] bg-td-accent/[0.06] text-td-accent-text transition group-hover:text-td-accent-text">
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="whitespace-nowrap text-[16px] sm:text-[18px] font-extrabold leading-none text-td-primary [font-variant-numeric:tabular-nums]">
          {formattedValue}
        </p>

        <span className="max-w-[100px] text-right text-[11px] font-semibold leading-4 text-td-muted">{trend}</span>
      </div>
    </div>
  );
}

function formatDemoValue(template: string, value: number) {
  const hasDecimalPrecision = /\d+\.\d+/.test(template);
  const formatted = value.toLocaleString(undefined, {
    maximumFractionDigits: hasDecimalPrecision ? 1 : 0,
    minimumFractionDigits: hasDecimalPrecision ? 1 : 0,
  });
  if (template.startsWith("$")) return `$${formatted}`;
  if (template.startsWith("+")) return `+${formatted}%`;
  if (template.startsWith("-")) return `-${formatted}%`;
  return formatted;
}

function PortfolioChart() {
  return (
    <div className="overflow-hidden rounded-2xl border border-td-accent/[0.1] bg-td-surface p-4 shadow-[inset_0_1px_0_rgb(var(--td-ink-rgb)/0.025)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-td-primary">Operating trend</p>
          <p className="mt-1 text-[11px] font-medium text-td-muted">Seller inventory value over 12 months</p>
        </div>

        <button type="button" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-td-secondary transition hover:bg-td-ink/[0.035] hover:text-td-primary">
          Last 12 months
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative mt-3 h-[150px] sm:mt-4 sm:h-[178px] overflow-hidden rounded-xl border border-td-ink/[0.055] bg-td-canvas px-4 pb-7 pt-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_12%,rgb(var(--td-accent-rgb)/0.10),transparent_38%)]" />

        {[25, 50, 75].map((top) => (
          <div
            key={top}
            className="absolute inset-x-4 border-t border-dashed border-td-ink/[0.055]"
            style={{ top: `${top}%` }}
          />
        ))}

        <div className="relative flex h-full items-end gap-2">
          {BARS.map((height, index) => (
            <div key={index} className="flex h-full min-w-0 flex-1 items-end">
              <div
                className={`${styles.chartBar} relative w-full rounded-t-[6px] bg-gradient-to-t from-td-accent via-td-accent to-td-accent shadow-[0_0_18px_rgb(var(--td-accent-rgb)/0.13)]`}
                style={{
                  height: `${height}%`,
                  animationDelay: `${180 + index * 55}ms`,
                }}
              >
                <span className="absolute inset-x-0 top-0 h-[2px] bg-td-ink/80" />
              </div>
            </div>
          ))}
        </div>

        <div className="absolute inset-x-4 bottom-2 flex justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-td-muted">
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
    <div className="hidden rounded-2xl border border-td-accent/[0.1] bg-td-surface p-4 min-[430px]:block">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] font-bold text-td-primary">Recent updates</p>
          <p className="mt-1 text-[11px] font-medium text-td-muted">Sample seller activity</p>
        </div>

        <Activity className="h-4 w-4 text-td-accent-text" />
      </div>

      <div className="mt-4 space-y-2.5">
        {activities.map(({ label, value, detail }) => (
          <div
            key={`${label}-${value}`}
            className="rounded-xl border border-td-ink/[0.065] bg-td-surface px-3 py-3 transition hover:border-td-accent/[0.15] hover:bg-td-surface"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[11px] font-semibold text-td-primary">{label}</p>
              <p className="shrink-0 text-[11px] font-bold text-td-success">{value}</p>
            </div>

            <p className="mt-1.5 text-[11px] font-medium text-td-muted">{detail}</p>
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
      className={`absolute z-20 items-center gap-3 rounded-2xl border border-td-accent/[0.2] bg-td-surface/[0.98] px-4 py-3.5 shadow-[0_26px_70px_rgb(var(--td-shadow-rgb)/calc(.52*var(--td-shadow-strength))),inset_0_1px_0_rgb(var(--td-ink-rgb)/.035)] ${className}`}
    >
      <span className={`${styles.statusPulse} h-2.5 w-2.5 shrink-0 rounded-full bg-td-success shadow-[0_0_14px_rgb(var(--td-accent-rgb)/.9)]`} />

      <span>
        <span className="block text-[11px] font-bold uppercase tracking-[0.13em] text-td-muted">
          {title}
        </span>

        <span className="mt-1.5 block text-[13px] font-extrabold tracking-[-0.02em] text-td-primary [font-variant-numeric:tabular-nums]">
          {value}
        </span>

        <span className="mt-1 block text-[11px] font-medium text-td-muted">{detail}</span>
      </span>
    </div>
  );
}
