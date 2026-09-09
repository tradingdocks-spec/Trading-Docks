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
    border: "border-td-accent/15",
    background: "bg-td-accent/[0.06]",
    icon: "text-td-accent-text",
    hoverGlow: "group-hover:shadow-[0_0_45px_rgb(var(--td-accent-rgb)/0.09)]",
  },
  emerald: {
    border: "border-td-success/15",
    background: "bg-td-success/[0.06]",
    icon: "text-td-success",
    hoverGlow: "group-hover:shadow-[0_0_45px_rgb(var(--td-accent-rgb)/0.09)]",
  },
  purple: {
    border: "border-td-violet/15",
    background: "bg-td-violet/[0.06]",
    icon: "text-td-violet",
    hoverGlow: "group-hover:shadow-[0_0_45px_rgba(139,92,246,0.09)]",
  },
  orange: {
    border: "border-td-warning/15",
    background: "bg-td-warning/[0.06]",
    icon: "text-td-warning",
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
        "group relative overflow-hidden rounded-3xl border border-td-ink/[0.07]",
        "bg-td-ink/[0.025] p-6",
        "transition-all duration-300",
        "hover:-translate-y-1 hover:border-td-ink/[0.11] hover:bg-td-ink/[0.04]",
        colors.hoverGlow,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-td-accent/[0.05] blur-3xl" />
      </div>

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-td-muted">
            {title}
          </p>

          <p className="mt-3 text-3xl font-semibold tracking-tight text-td-primary">
            {value}
          </p>

          {subtitle ? (
            <p className="mt-2 text-sm text-td-muted">
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
            <ArrowUpRight className="h-4 w-4 text-td-success" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-td-danger" />
          )}

          <span
            className={[
              "text-sm font-medium",
              isPositive
                ? "text-td-success"
                : "text-td-danger",
            ].join(" ")}
          >
            {Math.abs(trend)}%
          </span>

          <span className="text-sm text-td-muted">
            vs last month
          </span>
        </div>
      ) : null}
    </article>
  );
}