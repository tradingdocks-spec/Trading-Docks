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
    border: "border-cyan-400/15",
    bg: "bg-cyan-400/[0.05]",
    icon: "text-cyan-300",
    glow: "shadow-[0_0_40px_rgba(34,211,238,0.08)]",
  },
  emerald: {
    border: "border-emerald-400/15",
    bg: "bg-emerald-400/[0.05]",
    icon: "text-emerald-300",
    glow: "shadow-[0_0_40px_rgba(16,185,129,0.08)]",
  },
  purple: {
    border: "border-violet-400/15",
    bg: "bg-violet-400/[0.05]",
    icon: "text-violet-300",
    glow: "shadow-[0_0_40px_rgba(139,92,246,0.08)]",
  },
  orange: {
    border: "border-orange-400/15",
    bg: "bg-orange-400/[0.05]",
    icon: "text-orange-300",
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
        "border border-white/[0.06]",
        "bg-white/[0.025]",
        "p-6",
        "transition-all duration-300",
        "hover:-translate-y-1",
        "hover:border-cyan-400/15",
        "hover:bg-white/[0.04]",
        colors.glow,
      ].join(" ")}
    >
      <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-cyan-400/[0.05] blur-3xl" />
      </div>

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>

          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {value}
          </h2>

          {subtitle && (
            <p className="mt-2 text-sm text-slate-500">
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
            <ArrowUpRight className="h-4 w-4 text-emerald-300" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-rose-300" />
          )}

          <span
            className={
              positive
                ? "text-sm font-medium text-emerald-300"
                : "text-sm font-medium text-rose-300"
            }
          >
            {Math.abs(trend)}%
          </span>

          <span className="text-sm text-slate-600">
            vs last month
          </span>
        </div>
      )}
    </div>
  );
}