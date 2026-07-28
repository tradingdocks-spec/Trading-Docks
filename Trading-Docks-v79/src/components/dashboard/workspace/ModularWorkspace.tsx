"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bot,
  Boxes,
  CalendarDays,
  Check,
  CircleDollarSign,
  GripVertical,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  PackageCheck,
  PanelsTopLeft,
  Save,
  Settings2,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import styles from "../styles.module.css";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import { saveDashboardLayouts } from "@/app/actions/workspace";
import {
  canUseDashboardWidget,
  sanitizeDashboardLayoutsForPlan,
  type DashboardLayoutId,
  type DashboardWidget,
  type DashboardWidgetSize,
} from "@/lib/dashboard-entitlements";
import {
  normalizeAccountTier,
  PLAN_ENTITLEMENTS,
  type AccountTier,
} from "@/lib/plan-entitlements";

type Plan = AccountTier;
type Size = DashboardWidgetSize;
type LayoutId = DashboardLayoutId;
type Widget = DashboardWidget;

const DEFINITIONS = {
  "inventory-value": { title: "Inventory Value", icon: CircleDollarSign, plan: "free" as Plan },
  "inventory-count": { title: "Inventory", icon: Boxes, plan: "free" as Plan },
  "collection-growth": { title: "Collection Growth", icon: TrendingUp, plan: "free" as Plan },
  "business-calendar": { title: "Business Calendar", icon: CalendarDays, plan: "business" as Plan },
  "revenue": { title: "Revenue", icon: CircleDollarSign, plan: "seller" as Plan },
  "orders": { title: "Orders", icon: ShoppingBag, plan: "seller" as Plan },
  "marketplaces": { title: "Marketplace Health", icon: Store, plan: "seller" as Plan },
  "listing-queue": { title: "Listing Queue", icon: ListChecks, plan: "seller" as Plan },
  "automation": { title: "Automation Queue", icon: Bot, plan: "seller" as Plan },
  "team": { title: "Employee Activity", icon: Users, plan: "business" as Plan },
  "ai": { title: "AI Recommendations", icon: Sparkles, plan: "business" as Plan },
  "supplies": { title: "Supply Alerts", icon: PackageCheck, plan: "business" as Plan },
} as const;

const DEFAULT_LAYOUTS: Record<LayoutId, Widget[]> = {
  home: [
    { id: "inventory-value", size: "small" },
    { id: "inventory-count", size: "small" },
    { id: "revenue", size: "small" },
    { id: "orders", size: "small" },
    { id: "collection-growth", size: "medium" },
    { id: "business-calendar", size: "large" },
    { id: "marketplaces", size: "medium" },
    { id: "ai", size: "large" },
  ],
  business: [
    { id: "revenue", size: "small" },
    { id: "orders", size: "small" },
    { id: "business-calendar", size: "large" },
    { id: "team", size: "medium" },
    { id: "supplies", size: "medium" },
    { id: "ai", size: "large" },
  ],
  inventory: [
    { id: "inventory-value", size: "small" },
    { id: "inventory-count", size: "small" },
    { id: "collection-growth", size: "medium" },
    { id: "listing-queue", size: "medium" },
    { id: "supplies", size: "medium" },
  ],
  analytics: [
    { id: "revenue", size: "small" },
    { id: "inventory-value", size: "small" },
    { id: "collection-growth", size: "large" },
    { id: "marketplaces", size: "medium" },
  ],
  automation: [
    { id: "automation", size: "large" },
    { id: "business-calendar", size: "large" },
    { id: "ai", size: "large" },
  ],
};

const COLLECTOR_LAYOUTS: Record<LayoutId, Widget[]> = {
  home: [
    { id: "inventory-value", size: "small" },
    { id: "inventory-count", size: "small" },
    { id: "collection-growth", size: "large" },
  ],
  business: [],
  inventory: [
    { id: "inventory-value", size: "small" },
    { id: "inventory-count", size: "small" },
    { id: "collection-growth", size: "large" },
  ],
  analytics: [
    { id: "inventory-value", size: "small" },
    { id: "collection-growth", size: "large" },
  ],
  automation: [],
};

const LAYOUTS: Array<[LayoutId, string]> = [
  ["home", "Home"],
  ["business", "Business"],
  ["inventory", "Inventory"],
  ["analytics", "Analytics"],
  ["automation", "Automation"],
];

const ACCOUNT_LABEL: Record<string, string> = {
  free: "Free",
  collector: "Collector",
  seller: "Online Seller",
  store: "Local Game Store",
  "large-seller": "Large-volume Seller",
};

export function ModularWorkspace({
  accountType,
  inventoryModules,
  initialLayouts,
}: {
  accountType: string;
  inventoryModules: string[];
  initialLayouts?: unknown;
}) {
  const plan = normalizeAccountTier(accountType);
  const isPersonal = plan === "free" || plan === "collector";
  const baseLayouts = isPersonal ? COLLECTOR_LAYOUTS : DEFAULT_LAYOUTS;
  const [layoutId, setLayoutId] = useState<LayoutId>("home");
  const [layouts, setLayouts] = useState<Record<LayoutId, Widget[]>>(() => {
    const safeSavedLayouts = sanitizeDashboardLayoutsForPlan(initialLayouts, plan);
    return { ...baseLayouts, ...safeSavedLayouts };
  });
  const [editing, setEditing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const widgets = layouts[layoutId];

  function updateWidgets(next: Widget[]) {
    setLayouts((current) => ({ ...current, [layoutId]: next }));
  }

  async function save() {
    try {
      const safeLayouts = {
        ...baseLayouts,
        ...sanitizeDashboardLayoutsForPlan(layouts, plan),
      };
      setLayouts(safeLayouts);
      await saveDashboardLayouts(safeLayouts);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch {
      setSaved(false);
    }
  }

  function reorder(targetId: string) {
    if (!draggedId || targetId === draggedId) return;
    const next = [...widgets];
    const from = next.findIndex((widget) => widget.id === draggedId);
    const to = next.findIndex((widget) => widget.id === targetId);
    if (from < 0 || to < 0) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    updateWidgets(next);
    setDraggedId(null);
  }

  return (
    <WorkspaceFrame>
      <header className={`${styles.glassPanel} rounded-[28px] p-5 sm:p-6`}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.13] bg-cyan-400/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.17em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              {ACCOUNT_LABEL[accountType] ?? "Personal"} workspace
            </div>

            <h1 className="mt-4 text-2xl font-semibold tracking-[-0.045em] text-white sm:text-3xl">
              Your Trading Docks workspace.
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
              Personalized for your {ACCOUNT_LABEL[accountType]?.toLowerCase() ?? "account"} setup
              {inventoryModules.length > 0
                ? ` with ${inventoryModules.length} inventory modules enabled.`
                : "."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              className={[
                "inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition",
                editing
                  ? "border-cyan-300/[0.18] bg-cyan-400/[0.08] text-cyan-100"
                  : "border-white/[0.075] bg-white/[0.025] text-slate-400",
              ].join(" ")}
            >
              <PanelsTopLeft className="h-4 w-4" />
              {editing ? "Done editing" : "Edit layout"}
            </button>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.075] bg-white/[0.025] px-4 text-xs font-semibold text-slate-400"
            >
              <Settings2 className="h-4 w-4" />
              Customize
            </button>

            <button
              type="button"
              onClick={save}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 px-4 text-xs font-semibold text-[#001018]"
            >
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saved ? "Saved" : "Save layout"}
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.06] pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {LAYOUTS.filter(
              ([id]) => !isPersonal || ["home", "inventory", "analytics"].includes(id),
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLayoutId(id)}
                className={[
                  "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition",
                  layoutId === id
                    ? "border-cyan-300/[0.17] bg-cyan-400/[0.07] text-white"
                    : "border-transparent text-slate-500 hover:bg-white/[0.02] hover:text-slate-200",
                ].join(" ")}
              >
                {id === "home" ? <LayoutDashboard className="h-3.5 w-3.5" /> : null}
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[10px] text-slate-600">
            <span>{widgets.length} modules</span>
            <span className="capitalize">
              {accountType === "business" ? "Store plan" : `${ACCOUNT_LABEL[accountType] ?? "Free"} plan`}
            </span>
          </div>
        </div>
      </header>

      <div
        className={[
          "mt-5 grid grid-cols-1 gap-4 md:grid-cols-12",
          isPersonal ? "xl:grid-cols-8" : "xl:grid-cols-12",
        ].join(" ")}
      >
        {widgets.map((widget) => {
          const definition = DEFINITIONS[widget.id as keyof typeof DEFINITIONS];
          if (!definition) return null;
          const locked = !canUseDashboardWidget(plan, widget.id);

          return (
            <div
              key={widget.id}
              className="contents"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => reorder(widget.id)}
            >
              <DashboardWidget
                widget={widget}
                definition={definition}
                locked={locked}
                personalLayout={isPersonal}
                editing={editing}
                onDragStart={() => setDraggedId(widget.id)}
                onRemove={() =>
                  updateWidgets(widgets.filter((item) => item.id !== widget.id))
                }
                onResize={(size) =>
                  updateWidgets(
                    widgets.map((item) =>
                      item.id === widget.id ? { ...item, size } : item,
                    ),
                  )
                }
              />
            </div>
          );
        })}
      </div>

      <CustomizeDrawer
        open={drawerOpen}
        plan={plan}
        widgets={widgets}
        onClose={() => setDrawerOpen(false)}
        onToggle={(id) => {
          if (!canUseDashboardWidget(plan, id)) return;
          const exists = widgets.some((widget) => widget.id === id);
          if (exists) {
            updateWidgets(widgets.filter((widget) => widget.id !== id));
          } else {
            updateWidgets([...widgets, { id, size: "medium" }]);
          }
        }}
      />
    </WorkspaceFrame>
  );
}

function DashboardWidget({
  widget,
  definition,
  locked,
  personalLayout,
  editing,
  onDragStart,
  onRemove,
  onResize,
}: {
  widget: Widget;
  definition: (typeof DEFINITIONS)[keyof typeof DEFINITIONS];
  locked: boolean;
  personalLayout: boolean;
  editing: boolean;
  onDragStart: () => void;
  onRemove: () => void;
  onResize: (size: Size) => void;
}) {
  const Icon = definition.icon;
  const span =
    widget.size === "small"
      ? personalLayout
        ? "md:col-span-6 xl:col-span-4"
        : "md:col-span-3"
      : widget.size === "medium"
        ? personalLayout
          ? "md:col-span-6 xl:col-span-4"
          : "md:col-span-6 xl:col-span-4"
        : personalLayout
          ? "md:col-span-12 xl:col-span-8"
          : "md:col-span-12 xl:col-span-8";

  return (
    <article
      draggable={editing && !locked}
      onDragStart={onDragStart}
      className={`${styles.glassPanel} ${span} ${styles.metricCard} min-h-[160px] rounded-[24px] p-5`}
    >
      <header className="relative flex items-start gap-3">
        {editing ? (
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-slate-700"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/[0.12] bg-cyan-400/[0.05] text-cyan-300">
          <Icon className="h-4.5 w-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-white">
            {definition.title}
          </h2>
          <p className="mt-1 text-[9px] capitalize text-slate-600">
            {definition.plan === "free"
              ? "Included"
              : `${PLAN_ENTITLEMENTS[definition.plan].name} module`}
          </p>
        </div>

        {editing ? (
          <div className="flex items-center gap-1">
            <select
              value={widget.size}
              disabled={locked}
              onChange={(event) => onResize(event.target.value as Size)}
              className="h-8 rounded-lg border border-white/[0.06] bg-[#07141e] px-2 text-[9px] capitalize text-slate-500"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
            <button
              type="button"
              onClick={onRemove}
              disabled={locked}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </header>

      <div className="relative mt-5">
        {locked ? (
          <div className="rounded-xl border border-dashed border-amber-300/[0.12] bg-amber-300/[0.02] px-4 py-8 text-center">
            <p className="text-xs font-semibold text-amber-200/70">
              Available on {PLAN_ENTITLEMENTS[definition.plan].name}
            </p>
          </div>
        ) : (
          <WidgetContent id={widget.id} />
        )}
      </div>
    </article>
  );
}

function WidgetContent({ id }: { id: string }) {
  if (id === "inventory-value") return <Metric value="$0" detail="No inventory added yet" />;
  if (id === "inventory-count") return <Metric value="0" detail="No items tracked yet" />;
  if (id === "revenue") return <Metric value="$0" detail="No sales recorded yet" />;
  if (id === "orders") return <List rows={[]} emptyLabel="No orders yet" />;
  if (id === "marketplaces") return <List rows={[]} emptyLabel="No marketplaces connected" />;
  if (id === "listing-queue") return <List rows={[]} emptyLabel="No listings queued" />;
  if (id === "automation") return <List rows={[]} emptyLabel="No automation activity" />;
  if (id === "team") return <List rows={[]} emptyLabel="No employees added" />;
  if (id === "supplies") return <List rows={[]} emptyLabel="No supplies tracked" />;
  if (id === "business-calendar") return <MiniCalendar />;
  if (id === "collection-growth") return <CollectionGrowth />;
  if (id === "ai") return <AIRecommendations />;
  return <Metric value="0" detail="No account activity yet" />;
}

function Metric({ value, detail }: { value: string; detail: string }) {
  return (
    <div>
      <p className="text-3xl font-semibold tracking-[-0.045em] text-white">{value}</p>
      <p className="mt-3 text-[10px] text-slate-600">{detail}</p>
    </div>
  );
}

function List({ rows, emptyLabel = "Nothing here yet" }: { rows: string[]; emptyLabel?: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] bg-black/[0.08] px-3.5 py-6 text-center text-[10px] text-slate-600">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div
          key={row}
          className="rounded-xl border border-white/[0.055] bg-black/[0.08] px-3.5 py-3 text-[10px] text-slate-400"
        >
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
          {row}
        </div>
      ))}
    </div>
  );
}

function CollectionGrowth() {
  const [range, setRange] = useState<"7D" | "30D" | "90D" | "1Y" | "ALL">("1Y");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const rangeData = {
    "7D": [
      { label: "Mon", value: 0 },
      { label: "Tue", value: 0 },
      { label: "Wed", value: 0 },
      { label: "Thu", value: 0 },
      { label: "Fri", value: 0 },
      { label: "Sat", value: 0 },
      { label: "Sun", value: 0 },
    ],
    "30D": [
      { label: "Jun 25", value: 0 },
      { label: "Jun 29", value: 0 },
      { label: "Jul 3", value: 0 },
      { label: "Jul 7", value: 0 },
      { label: "Jul 11", value: 0 },
      { label: "Jul 15", value: 0 },
      { label: "Jul 19", value: 0 },
      { label: "Jul 23", value: 0 },
      { label: "Jul 24", value: 0 },
    ],
    "90D": [
      { label: "May 1", value: 0 },
      { label: "May 12", value: 0 },
      { label: "May 23", value: 0 },
      { label: "Jun 3", value: 0 },
      { label: "Jun 14", value: 0 },
      { label: "Jun 25", value: 0 },
      { label: "Jul 6", value: 0 },
      { label: "Jul 17", value: 0 },
      { label: "Jul 24", value: 0 },
    ],
    "1Y": [
      { label: "Jan", value: 0 },
      { label: "Feb", value: 0 },
      { label: "Mar", value: 0 },
      { label: "Apr", value: 0 },
      { label: "May", value: 0 },
      { label: "Jun", value: 0 },
      { label: "Jul", value: 0 },
      { label: "Aug", value: 0 },
      { label: "Sep", value: 0 },
      { label: "Oct", value: 0 },
      { label: "Nov", value: 0 },
      { label: "Dec", value: 0 },
    ],
    ALL: [
      { label: "2022", value: 0 },
      { label: "2023", value: 0 },
      { label: "2024", value: 0 },
      { label: "2025", value: 0 },
      { label: "2026", value: 0 },
    ],
  } as const;

  const data = rangeData[range];
  const width = 760;
  const height = 220;
  const paddingX = 16;
  const paddingTop = 18;
  const paddingBottom = 36;
  const minValue = Math.min(...data.map((point) => point.value));
  const maxValue = Math.max(...data.map((point) => point.value));
  const valueRange = Math.max(maxValue - minValue, 1);
  const chartHeight = height - paddingTop - paddingBottom;

  const points = data.map((point, index) => {
    const x =
      paddingX +
      (index / Math.max(data.length - 1, 1)) * (width - paddingX * 2);
    const normalized = (point.value - minValue) / valueRange;
    const y = paddingTop + chartHeight - normalized * chartHeight * 0.82 - chartHeight * 0.08;

    return { ...point, x, y };
  });

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
  const activePoint =
    hoveredIndex === null ? points[points.length - 1] : points[hoveredIndex];
  const firstValue = data[0].value;
  const latestValue = data[data.length - 1].value;
  const hasActivity = data.some((point) => point.value !== 0);
  const change = latestValue - firstValue;
  const percentage = firstValue === 0 ? 0 : (change / firstValue) * 100;

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = chartRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const relativeX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
    const scaledX = (relativeX / bounds.width) * width;

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    points.forEach((point, index) => {
      const distance = Math.abs(point.x - scaledX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    setHoveredIndex(nearestIndex);
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-2xl font-semibold tracking-[-0.04em] text-white">
            {formatCurrency(latestValue)}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-[10px]">
            <span className="font-semibold text-emerald-300">
              +{formatCurrency(change)} ({percentage.toFixed(1)}%)
            </span>
            <span className="text-slate-600">during {range}</span>
          </div>
        </div>

        <div className="inline-flex w-fit items-center rounded-xl border border-white/[0.065] bg-black/[0.12] p-1">
          {(["7D", "30D", "90D", "1Y", "ALL"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setRange(option);
                setHoveredIndex(null);
              }}
              className={[
                "h-7 rounded-lg px-2.5 text-[8px] font-semibold transition",
                range === option
                  ? "bg-cyan-400/[0.1] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.12)]"
                  : "text-slate-600 hover:text-slate-300",
              ].join(" ")}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={chartRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoveredIndex(null)}
        className={[
          "relative mt-4 overflow-hidden rounded-2xl border border-white/[0.055] bg-[#02090f] px-1",
          hasActivity ? "h-[220px]" : "h-[170px]",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_14%,rgba(34,211,238,0.08),transparent_34%)]" />
        {!hasActivity ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="rounded-2xl border border-cyan-300/[0.1] bg-[#06131d]/90 px-6 py-4 text-center shadow-xl backdrop-blur">
              <p className="text-xs font-semibold text-white">Your growth chart starts here</p>
              <p className="mt-1.5 text-[9px] text-slate-500">
                Add your first card to begin tracking value.
              </p>
              <a
                href="/dashboard/inventory"
                className="mt-3 inline-flex h-8 items-center rounded-lg bg-cyan-300 px-3 text-[9px] font-semibold text-[#001018]"
              >
                Add inventory
              </a>
            </div>
          </div>
        ) : null}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="relative h-full w-full overflow-visible"
          role="img"
          aria-label={`Collection growth over ${range}`}
        >
          <defs>
            <linearGradient id="collection-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity="0.34" />
              <stop offset="58%" stopColor="rgb(8 145 178)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="rgb(6 182 212)" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="collection-line-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgb(103 232 249)" />
              <stop offset="55%" stopColor="rgb(34 211 238)" />
              <stop offset="100%" stopColor="rgb(125 211 252)" />
            </linearGradient>

            <filter id="collection-line-glow" x="-20%" y="-60%" width="140%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <clipPath id="collection-chart-clip">
              <rect x="0" y="0" width={width} height={height - paddingBottom + 2} rx="16" />
            </clipPath>
          </defs>

          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1={paddingX}
              x2={width - paddingX}
              y1={paddingTop + chartHeight * ratio}
              y2={paddingTop + chartHeight * ratio}
              stroke="rgba(148,163,184,0.07)"
              strokeDasharray="4 8"
            />
          ))}

          <g clipPath="url(#collection-chart-clip)">
            <path
              d={areaPath}
              fill="url(#collection-area-gradient)"
              className="collection-area-enter"
            />

            <path
              d={linePath}
              fill="none"
              stroke="rgba(34,211,238,0.18)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#collection-line-glow)"
              vectorEffect="non-scaling-stroke"
            />

            <path
              d={linePath}
              fill="none"
              stroke="url(#collection-line-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pathLength="1"
              className="collection-line-draw"
            />

            {hoveredIndex !== null ? (
              <>
                <line
                  x1={activePoint.x}
                  x2={activePoint.x}
                  y1={paddingTop}
                  y2={height - paddingBottom}
                  stroke="rgba(103,232,249,0.2)"
                  strokeDasharray="3 5"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="8"
                  fill="rgba(34,211,238,0.18)"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="4"
                  fill="rgb(165 243 252)"
                  stroke="rgb(6 19 29)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : null}
          </g>

          {points.map((point, index) => {
            const showLabel =
              data.length <= 7 ||
              index === 0 ||
              index === data.length - 1 ||
              index % Math.ceil(data.length / 6) === 0;

            return showLabel ? (
              <text
                key={`${range}-${point.label}`}
                x={point.x}
                y={height - 12}
                textAnchor={
                  index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"
                }
                fill="rgb(100 116 139)"
                fontSize="9"
                fontWeight="600"
                letterSpacing="0.2"
              >
                {point.label}
              </text>
            ) : null;
          })}
        </svg>

        {hoveredIndex !== null ? (
          <div
            className="pointer-events-none absolute top-3 z-20 min-w-[118px] -translate-x-1/2 rounded-xl border border-cyan-300/[0.14] bg-[#06131d]/96 px-3 py-2.5 shadow-[0_16px_42px_rgba(0,0,0,0.38),0_0_26px_rgba(34,211,238,0.05)] backdrop-blur-xl"
            style={{
              left: `${Math.min(Math.max((activePoint.x / width) * 100, 12), 88)}%`,
            }}
          >
            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              {activePoint.label}
            </p>
            <p className="mt-1 text-xs font-semibold text-white">
              {formatCurrency(activePoint.value)}
            </p>
          </div>
        ) : null}
      </div>

      <style jsx>{`
        .collection-line-draw {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: collectionLineDraw 1100ms cubic-bezier(0.22, 1, 0.36, 1)
            forwards;
        }

        .collection-area-enter {
          opacity: 0;
          animation: collectionAreaEnter 800ms 280ms ease-out forwards;
        }

        @keyframes collectionLineDraw {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes collectionAreaEnter {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .collection-line-draw,
          .collection-area-enter {
            animation: none;
            opacity: 1;
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}

function buildSmoothPath(
  points: Array<{ x: number; y: number }>,
) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;

    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function MiniCalendar() {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-white">
          {now.toLocaleString("en-US", { month: "long", year: "numeric" })}
        </p>
        <a
          href="/dashboard/calendar"
          className="text-[9px] font-semibold text-cyan-300"
        >
          Open calendar
        </a>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => (
          <a
            key={day}
            href="/dashboard/calendar"
            className="min-h-[38px] rounded-md border border-white/[0.045] bg-black/[0.07] p-1 text-left"
          >
            <span className="text-[7px] text-slate-600">{day}</span>
          </a>
        ))}
      </div>
      <p className="mt-3 text-center text-[9px] text-slate-600">No events scheduled</p>
    </div>
  );
}

function AIRecommendations() {
  return <List rows={[]} emptyLabel="Recommendations will appear as account activity is added" />;
}

function CustomizeDrawer({
  open,
  plan,
  widgets,
  onClose,
  onToggle,
}: {
  open: boolean;
  plan: Plan;
  widgets: Widget[];
  onClose: () => void;
  onToggle: (id: string) => void;
}) {
  if (!open) return null;
  const active = new Set(widgets.map((widget) => widget.id));

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <aside className="absolute inset-y-0 right-0 w-full max-w-[420px] border-l border-white/[0.075] bg-[#030c13]/98 p-5 shadow-[-28px_0_90px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Customize Dashboard</p>
            <p className="mt-1 text-[10px] text-slate-600">
              Add modules for your {plan} workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-2 overflow-y-auto">
          {Object.entries(DEFINITIONS).map(([id, definition]) => {
            const Icon = definition.icon;
            const enabled = active.has(id);
            const locked = !canUseDashboardWidget(plan, id);

            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (!locked) onToggle(id);
                }}
                disabled={locked}
                aria-disabled={locked}
                className={[
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                  locked
                    ? "cursor-not-allowed border-white/[0.04] bg-white/[0.01] opacity-55"
                    : enabled
                      ? "border-cyan-300/[0.16] bg-cyan-400/[0.045]"
                      : "border-white/[0.055] bg-white/[0.018] hover:border-white/[0.09]",
                ].join(" ")}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/[0.1] bg-cyan-400/[0.04] text-cyan-300">
                  <Icon className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold text-slate-200">
                    {definition.title}
                  </span>
                  <span className="mt-1 block text-[8px] capitalize text-slate-600">
                    {definition.plan === "free"
                      ? "Included with your plan"
                      : `${PLAN_ENTITLEMENTS[definition.plan].name} plan`}
                  </span>
                </span>

                {locked ? (
                  <span className="flex items-center gap-1.5 rounded-lg border border-amber-300/[0.1] bg-amber-300/[0.035] px-2 py-1 text-[8px] font-semibold text-amber-200/70">
                    <LockKeyhole className="h-3 w-3" />
                    Locked
                  </span>
                ) : enabled ? (
                  <Check className="h-4 w-4 text-cyan-300" />
                ) : null}
              </button>
            );
          })}
        </div>

        {plan !== "business" ? (
          <a
            href="/dashboard/plans"
            className="mt-5 flex h-11 items-center justify-center rounded-xl border border-cyan-300/[0.14] bg-cyan-400/[0.055] text-[10px] font-semibold text-cyan-100"
          >
            Compare plans and unlock modules
          </a>
        ) : null}
      </aside>
    </div>
  );
}
