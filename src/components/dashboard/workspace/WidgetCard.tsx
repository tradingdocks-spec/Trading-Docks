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
        "group relative min-h-[180px] overflow-hidden rounded-[24px] border bg-td-surface/88 p-5 shadow-[0_22px_70px_rgb(var(--td-shadow-rgb)/calc(0.24*var(--td-shadow-strength)))] backdrop-blur-2xl transition duration-300",
        locked
          ? "border-td-warning/[0.12]"
          : "border-td-ink/[0.075] hover:-translate-y-0.5 hover:border-td-accent/[0.16]",
        editing && !locked ? "cursor-grab active:cursor-grabbing" : "",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-td-accent/[0.045] blur-[65px] transition group-hover:bg-td-accent/[0.075]" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-td-accent/30 to-transparent opacity-0 transition group-hover:opacity-100" />

      <header className="relative flex items-start gap-3">
        {editing ? (
          <button
            type="button"
            aria-label={`Drag ${definition.title}`}
            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-td-ink/[0.06] bg-td-ink/[0.02] text-td-muted"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-td-accent/[0.12] bg-td-accent/[0.05] text-td-accent-text">
          <Icon className="h-4.5 w-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-td-primary">
              {definition.title}
            </h2>

            {locked ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-td-warning/[0.12] bg-td-warning/[0.04] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.13em] text-td-warning/75">
                <LockKeyhole className="h-2.5 w-2.5" />
                {definition.minimumPlan}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-td-success">
                <CircleDot className="h-2.5 w-2.5" />
                Live
              </span>
            )}
          </div>

          <p className="mt-1 truncate text-[11px] text-td-muted">
            {definition.description}
          </p>
        </div>

        {editing ? (
          <div className="flex items-center gap-1">
            <SizeMenu size={widget.size} onResize={onResize} />

            <button
              type="button"
              onClick={onRemove}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-td-ink/[0.06] bg-td-ink/[0.02] text-td-muted transition hover:border-td-danger/20 hover:text-td-danger"
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
        className="h-8 appearance-none rounded-lg border border-td-ink/[0.06] bg-td-surface pl-2 pr-7 text-[11px] font-medium capitalize text-td-muted outline-none"
      >
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
        <option value="wide">Wide</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-td-muted" />
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
    <div className="flex min-h-[105px] flex-col items-center justify-center rounded-2xl border border-dashed border-td-warning/[0.12] bg-td-warning/[0.018] px-4 text-center">
      <LockKeyhole className="h-5 w-5 text-td-warning/55" />
      <p className="mt-3 text-xs font-semibold text-td-secondary">
        Available on {minimumPlan}
      </p>
      <p className="mt-1 text-[11px] text-td-muted">
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
      <p className="text-3xl font-semibold tracking-[-0.045em] text-td-primary">{value}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1 rounded-full border border-td-success/[0.13] bg-td-success/[0.04] px-2.5 py-1 text-[11px] font-semibold text-td-success">
          <TrendingUp className="h-3 w-3" />
          {change}
        </span>
        <span className="text-[11px] text-td-muted">{detail}</span>
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
    <div className="relative h-[148px] overflow-hidden rounded-2xl border border-td-ink/[0.05] bg-td-canvas px-3 pb-7 pt-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgb(var(--td-accent-rgb)/0.08),transparent_32%)]" />

      {[30, 55, 80].map((top) => (
        <div
          key={top}
          className="absolute inset-x-3 border-t border-dashed border-td-ink/[0.045]"
          style={{ top: `${top}%` }}
        />
      ))}

      <div className="relative flex h-full items-end gap-1.5">
        {values.map((height, index) => (
          <div key={months[index]} className="flex h-full min-w-0 flex-1 items-end">
            <div
              className="widget-bar w-full rounded-t-[5px] bg-gradient-to-t from-td-accent/45 via-td-accent/70 to-td-accent/95 shadow-[0_0_12px_rgb(var(--td-accent-rgb)/0.07)]"
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
            className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-td-muted"
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
    supplies: "border-td-accent/[0.12] bg-td-accent/[0.05] text-td-accent-text",
    operations: "border-td-accent/[0.1] bg-td-accent/[0.045] text-td-accent-text",
    tournament: "border-td-violet/[0.1] bg-td-violet/[0.045] text-td-violet",
    staff: "border-td-warning/[0.1] bg-td-warning/[0.045] text-td-warning",
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-td-primary">July 2026</p>
          <p className="mt-1 text-[11px] text-td-muted">
            Supplies, operations, staffing, and events
          </p>
        </div>

        <button
          type="button"
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-td-accent/[0.12] bg-td-accent/[0.04] px-3 text-[11px] font-semibold text-td-accent-text transition hover:bg-td-accent/[0.08]"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Add activity
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span
            key={day}
            className="py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-td-muted"
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
                  ? "border-td-ink/[0.045] bg-black/[0.07] hover:border-td-accent/[0.12] hover:bg-td-accent/[0.02]"
                  : "border-transparent opacity-20",
              ].join(" ")}
            >
              <span className="text-[11px] font-semibold text-td-muted">
                {valid ? day : ""}
              </span>

              <span className="mt-1 block space-y-1">
                {dayEvents.slice(0, 2).map((event) => (
                  <span
                    key={event.label}
                    className={`block truncate rounded border px-1 py-0.5 text-[11px] font-medium ${badgeClass[event.type]}`}
                  >
                    {event.label}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-td-muted">
        {[
          ["Supplies", "bg-td-accent"],
          ["Operations", "bg-td-accent"],
          ["Tournaments", "bg-td-violet"],
          ["Staff", "bg-td-warning"],
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
          className="rounded-xl border border-td-ink/[0.055] bg-black/[0.08] px-3.5 py-3 transition hover:border-td-accent/[0.12] hover:bg-td-accent/[0.02]"
        >
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-td-success shadow-[0_0_8px_rgb(var(--td-accent-rgb)/0.7)]" />
            <p className="text-[11px] font-semibold text-td-primary">{title}</p>
          </div>
          <p className="mt-1 pl-3.5 text-[11px] text-td-muted">{detail}</p>
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
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-td-secondary">{label}</span>
            <span className="text-td-muted">{value}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-td-ink/[0.04]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-td-accent to-td-accent shadow-[0_0_10px_rgb(var(--td-accent-rgb)/0.3)]"
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
      <div className="flex items-center gap-2 rounded-xl border border-td-accent/[0.1] bg-td-accent/[0.025] px-3 py-2.5">
        <Sparkles className="h-4 w-4 text-td-accent-text" />
        <p className="text-[11px] font-semibold text-td-accent-text">
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
    <div className="rounded-xl border border-dashed border-td-ink/[0.07] bg-black/[0.06] px-4 py-6 text-center">
      <p className="text-[11px] font-semibold text-td-secondary">No account data yet</p>
      <p className="mt-1 text-[11px] text-td-muted">Activity will appear after this account adds data.</p>
    </div>
  );
}

