"use client";

import {
  ArrowUpRight,
  CalendarDays,
  DollarSign,
} from "lucide-react";

import { Panel } from "./Panel";
import { PanelHeader } from "./PanelHeader";

const revenuePoints = Array.from({ length: 12 }, () => 0);

const chartPath = revenuePoints
  .map((point, index) => {
    const x = (index / (revenuePoints.length - 1)) * 100;
    const y = 100 - point;

    return `${index === 0 ? "M" : "L"} ${x} ${y}`;
  })
  .join(" ");

export function RevenueOverview() {
  return (
    <Panel className="min-h-[360px]" padding="lg">
      <PanelHeader
        eyebrow="Performance"
        title="Revenue Overview"
        subtitle="Gross marketplace sales over the last 30 days"
        action={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 text-xs font-medium text-slate-400 transition hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Last 30 days
          </button>
        }
      />

      <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-slate-500">Total revenue</p>

          <div className="mt-2 flex items-end gap-3">
            <p className="text-4xl font-semibold tracking-tight text-white">
              $0
            </p>

            <div className="mb-1 flex items-center gap-1 rounded-full border border-emerald-300/[0.12] bg-emerald-400/[0.07] px-2 py-1 text-xs font-medium text-emerald-300">
              <ArrowUpRight className="h-3.5 w-3.5" />
              0.00%
            </div>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            $0 change from the previous period
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.06] bg-black/[0.12] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">
              Orders
            </p>

            <p className="mt-2 text-lg font-semibold text-white">
              0
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-black/[0.12] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">
              Avg. order
            </p>

            <p className="mt-2 text-lg font-semibold text-white">
              $0
            </p>
          </div>

          <div className="col-span-2 rounded-2xl border border-white/[0.06] bg-black/[0.12] px-4 py-3 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">
              Net profit
            </p>

            <p className="mt-2 text-lg font-semibold text-white">
              $0
            </p>
          </div>
        </div>
      </div>

      <div className="relative mt-8 h-44 overflow-hidden rounded-2xl border border-white/[0.05] bg-black/[0.12]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-1/4 border-t border-dashed border-white/[0.04]" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/[0.04]" />
          <div className="absolute inset-x-0 top-3/4 border-t border-dashed border-white/[0.04]" />
          <div className="absolute bottom-0 left-0 top-0 w-px bg-white/[0.04]" />
        </div>

        <svg
          aria-label="Revenue trend"
          className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient
              id="revenue-fill"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path
            d={`${chartPath} L 100 100 L 0 100 Z`}
            fill="url(#revenue-fill)"
          />

          <path
            d={chartPath}
            fill="none"
            stroke="rgb(103 232 249)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-xl border border-cyan-300/[0.1] bg-cyan-400/[0.06] px-3 py-2">
          <DollarSign className="h-4 w-4 text-cyan-300" />

          <span className="text-xs font-medium text-cyan-100">
            Strongest day: $1,284
          </span>
        </div>
      </div>
    </Panel>
  );
}
