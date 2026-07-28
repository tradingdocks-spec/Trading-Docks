"use client";

import {
  CalendarDays,
  ChevronDown,
  CircleDot,
  GripVertical,
  LockKeyhole,
  MoreHorizontal,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import type {
  AccountPlan,
  DashboardWidget,
  WidgetDefinition,
  WidgetSize,
} from "./types";

type WidgetCardProps = {
  definition: WidgetDefinition;
  widget: DashboardWidget;
  plan: AccountPlan;
  locked: boolean;
  editing: boolean;
  onDragStart: () => void;
  onRemove: () => void;
  onResize: (size: WidgetSize) => void;
};

const SIZE_CLASSES: Record<WidgetSize, string> = {
  small: "md:col-span-3 xl:col-span-3",
  medium: "md:col-span-6 xl:col-span-4",
  large: "md:col-span-12 xl:col-span-8",
  wide: "md:col-span-12 xl:col-span-12",
};

export function WidgetCard({
  definition,
  widget,
  plan,
  locked,
  editing,
  onDragStart,
  onRemove,
  onResize,
}: WidgetCardProps) {
  const Icon = definition.icon;

  return (
    <article
      draggable={editing && !locked}
      onDragStart={onDragStart}
      className={[
        SIZE_CLASSES[widget.size],
        "group relative min-h-[180px] overflow-hidden rounded-[24px] border bg-[#06131d]/88 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition duration-300",
        locked
          ? "border-amber-300/[0.12]"
          : "border-white/[0.075] hover:-translate-y-0.5 hover:border-cyan-300/[0.16]",
        editing && !locked ? "cursor-grab active:cursor-grabbing" : "",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-400/[0.045] blur-[65px] transition group-hover:bg-cyan-400/[0.075]" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent opacity-0 transition group-hover:opacity-100" />

      <header className="relative flex items-start gap-3">
        {editing ? (
          <button
            type="button"
            aria-label={`Drag ${definition.title}`}
            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-slate-700"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/[0.12] bg-cyan-400/[0.05] text-cyan-300">
          <Icon className="h-4.5 w-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-white">
              {definition.title}
            </h2>

            {locked ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/[0.12] bg-amber-300/[0.04] px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.13em] text-amber-200/75">
                <LockKeyhole className="h-2.5 w-2.5" />
                {definition.minimumPlan}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[8px] font-medium text-emerald-300">
                <CircleDot className="h-2.5 w-2.5" />
                Live
              </span>
            )}
          </div>

          <p className="mt-1 truncate text-[10px] text-slate-600">
            {definition.description}
          </p>
        </div>

        {editing ? (
          <div className="flex items-center gap-1">
            <SizeMenu size={widget.size} onResize={onResize} />

            <button
              type="button"
              onClick={onRemove}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-slate-600 transition hover:border-red-300/20 hover:text-red-300"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </header>

      <div className="relative mt-5">
        {locked ? (
          <LockedContent plan={plan} minimumPlan={definition.minimumPlan} />
        ) : (
          <WidgetContent id={definition.id} />
        )}
      </div>
    </article>
  );
}

function SizeMenu({
  size,
  onResize,
}: {
  size: WidgetSize;
  onResize: (size: WidgetSize) => void;
}) {
  return (
    <label className="relative">
      <span className="sr-only">Resize widget</span>
      <select
        value={size}
        onChange={(event) => onResize(event.target.value as WidgetSize)}
        className="h-8 appearance-none rounded-lg border border-white/[0.06] bg-[#07141e] pl-2 pr-7 text-[9px] font-medium capitalize text-slate-500 outline-none"
      >
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
        <option value="wide">Wide</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-700" />
    </label>
  );
}

function LockedContent({
  plan,
  minimumPlan,
}: {
  plan: AccountPlan;
  minimumPlan: AccountPlan;
}) {
  return (
    <div className="flex min-h-[105px] flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300/[0.12] bg-amber-300/[0.018] px-4 text-center">
      <LockKeyhole className="h-5 w-5 text-amber-200/55" />
      <p className="mt-3 text-xs font-semibold text-slate-300">
        Available on {minimumPlan}
      </p>
      <p className="mt-1 text-[10px] text-slate-600">
        Your current plan is {plan}. Upgrade to activate this module.
      </p>
    </div>
  );
}

function WidgetContent({ id }: { id: string }) {
  if (id === "inventory-value") {
    return <Metric value="$0" change="0.00%" detail="$0 today" />;
  }

  if (id === "inventory-count") {
    return <Metric value="0" change="0 today" detail="No inventory yet" />;
  }

  if (id === "revenue") {
    return <Metric value="$0" change="0.00%" detail="$0 average/day" />;
  }

  if (id === "profit") {
    return <Metric value="$0" change="0.00%" detail="0.00% net margin" />;
  }

  if (id === "collection-growth" || id === "inventory-heatmap") {
    return <AnimatedChart variant={id === "inventory-heatmap" ? "heatmap" : "growth"} />;
  }

  if (id === "business-calendar") {
    return <BusinessCalendar />;
  }

  if (id === "ai-insights") {
    return <AIInsights />;
  }

  if (id === "orders") {
    return (
      <ListContent rows={[]} />
    );
  }

  if (id === "marketplace-health") {
    return (
      <ListContent rows={[]} />
    );
  }

  if (id === "automation-queue") {
    return (
      <ListContent rows={[]} />
    );
  }

  if (id === "listing-queue") {
    return (
      <ListContent rows={[]} />
    );
  }

  if (id === "price-alerts") {
    return (
      <ListContent rows={[]} />
    );
  }

  if (id === "chaos-sort") {
    return <Metric value="0" change="No cards queued" detail="Estimated time: 0 minutes" />;
  }

  if (id === "binder-usage") {
    return (
      <ProgressRows rows={[]} />
    );
  }

  if (id === "recently-added") {
    return (
      <ListContent rows={[]} />
    );
  }

  if (id === "wishlist") {
    return (
      <ListContent rows={[]} />
    );
  }

  if (id === "commander-staples") {
    return (
      <ListContent rows={[]} />
    );
  }

  if (id === "tasks") {
    return (
      <ListContent rows={[]} />
    );
  }

  if (id === "team-activity") {
    return (
      <ListContent rows={[]} />
    );
  }

  return <Metric value="0" change="No activity" detail="Waiting for account data" />;
}

function Metric({
  value,
  change,
  detail,
}: {
  value: string;
  change: string;
  detail: string;
}) {
  return (
    <div>
      <p className="text-3xl font-semibold tracking-[-0.045em] text-white">{value}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/[0.13] bg-emerald-300/[0.04] px-2.5 py-1 text-[9px] font-semibold text-emerald-300">
          <TrendingUp className="h-3 w-3" />
          {change}
        </span>
        <span className="text-[10px] text-slate-600">{detail}</span>
      </div>
    </div>
  );
}

function AnimatedChart({ variant }: { variant: "growth" | "heatmap" }) {
  void variant;
  const values = Array.from({ length: 12 }, () => 0);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return (
    <div className="relative h-[148px] overflow-hidden rounded-2xl border border-white/[0.05] bg-[#02090f] px-3 pb-7 pt-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(34,211,238,0.08),transparent_32%)]" />

      {[30, 55, 80].map((top) => (
        <div
          key={top}
          className="absolute inset-x-3 border-t border-dashed border-white/[0.045]"
          style={{ top: `${top}%` }}
        />
      ))}

      <div className="relative flex h-full items-end gap-1.5">
        {values.map((height, index) => (
          <div key={months[index]} className="flex h-full min-w-0 flex-1 items-end">
            <div
              className="widget-bar w-full rounded-t-[5px] bg-gradient-to-t from-cyan-600/45 via-cyan-400/70 to-cyan-200/95 shadow-[0_0_12px_rgba(34,211,238,0.07)]"
              style={{
                height: `${height}%`,
                animationDelay: `${index * 45}ms`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="absolute inset-x-3 bottom-2 grid grid-cols-12 gap-1 text-center">
        {months.map((month) => (
          <span
            key={month}
            className="truncate text-[6px] font-medium uppercase tracking-[0.06em] text-slate-700"
          >
            {month}
          </span>
        ))}
      </div>
    </div>
  );
}

function BusinessCalendar() {
  const days = Array.from({ length: 35 }, (_, index) => index - 2);
  const events: Record<number, Array<{ label: string; type: string }>> = {};

  const badgeClass: Record<string, string> = {
    supplies: "border-cyan-300/[0.12] bg-cyan-400/[0.05] text-cyan-200",
    operations: "border-blue-300/[0.1] bg-blue-400/[0.045] text-blue-200",
    tournament: "border-violet-300/[0.1] bg-violet-400/[0.045] text-violet-200",
    staff: "border-amber-300/[0.1] bg-amber-400/[0.045] text-amber-200",
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">July 2026</p>
          <p className="mt-1 text-[9px] text-slate-600">
            Supplies, operations, staffing, and events
          </p>
        </div>

        <button
          type="button"
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-cyan-300/[0.12] bg-cyan-400/[0.04] px-3 text-[9px] font-semibold text-cyan-200 transition hover:bg-cyan-400/[0.08]"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Add activity
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span
            key={day}
            className="py-1 text-[7px] font-semibold uppercase tracking-[0.1em] text-slate-700"
          >
            {day}
          </span>
        ))}

        {days.map((day, index) => {
          const valid = day >= 1 && day <= 31;
          const dayEvents = valid ? events[day] ?? [] : [];

          return (
            <button
              key={`${day}-${index}`}
              type="button"
              className={[
                "min-h-[58px] rounded-lg border p-1.5 text-left transition",
                valid
                  ? "border-white/[0.045] bg-black/[0.07] hover:border-cyan-300/[0.12] hover:bg-cyan-400/[0.02]"
                  : "border-transparent opacity-20",
              ].join(" ")}
            >
              <span className="text-[8px] font-semibold text-slate-500">
                {valid ? day : ""}
              </span>

              <span className="mt-1 block space-y-1">
                {dayEvents.slice(0, 2).map((event) => (
                  <span
                    key={event.label}
                    className={`block truncate rounded border px-1 py-0.5 text-[6px] font-medium ${badgeClass[event.type]}`}
                  >
                    {event.label}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[8px] text-slate-600">
        {[
          ["Supplies", "bg-cyan-300"],
          ["Operations", "bg-blue-300"],
          ["Tournaments", "bg-violet-300"],
          ["Staff", "bg-amber-300"],
        ].map(([label, dot]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ListContent({ rows }: { rows: Array<[string, string]> }) {
  if (rows.length === 0) {
    return <EmptyWidgetState />;
  }

  return (
    <div className="space-y-2.5">
      {rows.map(([title, detail]) => (
        <div
          key={title}
          className="rounded-xl border border-white/[0.055] bg-black/[0.08] px-3.5 py-3 transition hover:border-cyan-300/[0.12] hover:bg-cyan-400/[0.02]"
        >
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.7)]" />
            <p className="text-[11px] font-semibold text-slate-200">{title}</p>
          </div>
          <p className="mt-1 pl-3.5 text-[9px] text-slate-600">{detail}</p>
        </div>
      ))}
    </div>
  );
}

function ProgressRows({ rows }: { rows: Array<[string, number]> }) {
  if (rows.length === 0) {
    return <EmptyWidgetState />;
  }

  return (
    <div className="space-y-4">
      {rows.map(([label, value]) => (
        <div key={label}>
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-medium text-slate-400">{label}</span>
            <span className="text-slate-600">{value}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
              style={{ width: `${value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function AIInsights() {
  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl border border-cyan-300/[0.1] bg-cyan-400/[0.025] px-3 py-2.5">
        <Sparkles className="h-4 w-4 text-cyan-300" />
        <p className="text-[10px] font-semibold text-cyan-100">
          Today&apos;s recommendations
        </p>
      </div>

      <div className="mt-3 space-y-2">
        <EmptyWidgetState />
      </div>
    </div>
  );
}

function EmptyWidgetState() {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.07] bg-black/[0.06] px-4 py-6 text-center">
      <p className="text-[11px] font-semibold text-slate-400">No account data yet</p>
      <p className="mt-1 text-[9px] text-slate-600">Activity will appear after this account adds data.</p>
    </div>
  );
}

