import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";

type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: number;
  glow?: "cyan" | "emerald" | "purple" | "orange";
};

const glowClasses = {
  cyan: {
    border: "border-blue-400/15",
    background: "bg-blue-400/[0.06]",
    icon: "text-blue-300",
    hoverGlow: "group-hover:shadow-[0_0_45px_rgba(59,130,246,0.09)]",
  },
  emerald: {
    border: "border-emerald-400/15",
    background: "bg-emerald-400/[0.06]",
    icon: "text-emerald-300",
    hoverGlow: "group-hover:shadow-[0_0_45px_rgba(16,185,129,0.09)]",
  },
  purple: {
    border: "border-violet-400/15",
    background: "bg-violet-400/[0.06]",
    icon: "text-violet-300",
    hoverGlow: "group-hover:shadow-[0_0_45px_rgba(139,92,246,0.09)]",
  },
  orange: {
    border: "border-orange-400/15",
    background: "bg-orange-400/[0.06]",
    icon: "text-orange-300",
    hoverGlow: "group-hover:shadow-[0_0_45px_rgba(251,146,60,0.09)]",
  },
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  glow = "cyan",
}: MetricCardProps) {
  const colors = glowClasses[glow];
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-3xl border border-white/[0.07]",
        "bg-white/[0.025] p-6",
        "transition-all duration-300",
        "hover:-translate-y-1 hover:border-white/[0.11] hover:bg-white/[0.04]",
        colors.hoverGlow,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-blue-400/[0.05] blur-3xl" />
      </div>

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {title}
          </p>

          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {value}
          </p>

          {subtitle ? (
            <p className="mt-2 text-sm text-slate-600">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            colors.border,
            colors.background,
          ].join(" ")}
        >
          <Icon
            aria-hidden="true"
            className={[
              "h-5 w-5",
              colors.icon,
            ].join(" ")}
          />
        </div>
      </div>

      {trend !== undefined ? (
        <div className="relative mt-7 flex items-center gap-2">
          {isPositive ? (
            <ArrowUpRight className="h-4 w-4 text-emerald-300" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-rose-300" />
          )}

          <span
            className={[
              "text-sm font-medium",
              isPositive
                ? "text-emerald-300"
                : "text-rose-300",
            ].join(" ")}
          >
            {Math.abs(trend)}%
          </span>

          <span className="text-sm text-slate-600">
            vs last month
          </span>
        </div>
      ) : null}
    </article>
  );
}