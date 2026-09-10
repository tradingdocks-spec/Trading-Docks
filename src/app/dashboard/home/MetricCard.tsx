"use client";

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
    bg: "bg-td-accent/[0.05]",
    icon: "text-td-accent-text",
    glow: "shadow-[0_0_40px_rgb(var(--td-accent-rgb)/0.08)]",
  },
  emerald: {
    border: "border-td-success/15",
    bg: "bg-td-success/[0.05]",
    icon: "text-td-success",
    glow: "shadow-[0_0_40px_rgb(var(--td-accent-rgb)/0.08)]",
  },
  purple: {
    border: "border-td-violet/15",
    bg: "bg-td-violet/[0.05]",
    icon: "text-td-violet",
    glow: "shadow-[0_0_40px_rgba(139,92,246,0.08)]",
  },
  orange: {
    border: "border-td-warning/15",
    bg: "bg-td-warning/[0.05]",
    icon: "text-td-warning",
    glow: "shadow-[0_0_40px_rgba(251,146,60,0.08)]",
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

  const positive = trend !== undefined && trend >= 0;

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-3xl",
        "border border-td-ink/[0.06]",
        "bg-td-ink/[0.025]",
        "p-6",
        "transition-all duration-300",
        "hover:-translate-y-1",
        "hover:border-td-accent/15",
        "hover:bg-td-ink/[0.04]",
        colors.glow,
      ].join(" ")}
    >
      <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-td-accent/[0.05] blur-3xl" />
      </div>

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-td-muted">
            {title}
          </p>

          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-td-primary">
            {value}
          </h2>

          {subtitle && (
            <p className="mt-2 text-sm text-td-muted">
              {subtitle}
            </p>
          )}
        </div>

        <div
          className={[
            "flex h-12 w-12 items-center justify-center rounded-2xl",
            colors.bg,
            colors.border,
            "border",
          ].join(" ")}
        >
          <Icon
            className={[
              "h-6 w-6",
              colors.icon,
            ].join(" ")}
          />
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-8 flex items-center gap-2">
          {positive ? (
            <ArrowUpRight className="h-4 w-4 text-td-success" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-td-danger" />
          )}

          <span
            className={
              positive
                ? "text-sm font-medium text-td-success"
                : "text-sm font-medium text-td-danger"
            }
          >
            {Math.abs(trend)}%
          </span>

          <span className="text-sm text-td-muted">
            vs last month
          </span>
        </div>
      )}
    </div>
  );
}