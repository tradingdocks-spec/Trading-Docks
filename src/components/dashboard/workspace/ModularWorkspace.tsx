"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Boxes,
  CalendarDays,
  Check,
  CircleDollarSign,
  GripVertical,
  LayoutDashboard,
  ListChecks,
  PackageCheck,
  PackageOpen,
  PanelsTopLeft,
  Save,
  Settings2,
  ShoppingBag,
  ArrowUpRight,
  ArrowRight,
  BarChart3,
  FileUp,
  LockKeyhole,
  ScanLine,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import styles from "../styles.module.css";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import { saveDashboardLayouts } from "@/app/actions/workspace";
import {
  availableDashboardLayouts,
  canUseDashboardWidget,
} from "@/lib/dashboard-entitlements";
import type { PersonalCommandCenterSummary } from "@/lib/dashboard/personal-command-center";
import type { AccountTier } from "@/lib/plan-entitlements";
import {
  hasTrustedFullPlatformAccess,
  type ClientSafePlatformAccess,
} from "../../../../mobile/services/platform-access.ts";

type Plan = "starter" | "pro" | "business";
type Size = "small" | "medium" | "large";
type LayoutId = "home" | "business" | "inventory" | "analytics" | "automation";

type Widget = {
  id: string;
  size: Size;
};

const DEFINITIONS = {
  "inventory-value": { title: "Inventory Value", icon: CircleDollarSign, plan: "starter" as Plan },
  "inventory-count": { title: "Inventory", icon: Boxes, plan: "starter" as Plan },
  "collection-growth": { title: "Collection Growth", icon: TrendingUp, plan: "starter" as Plan },
  "business-calendar": { title: "Business Calendar", icon: CalendarDays, plan: "starter" as Plan },
  "revenue": { title: "Revenue", icon: CircleDollarSign, plan: "pro" as Plan },
  "orders": { title: "Orders", icon: ShoppingBag, plan: "pro" as Plan },
  "marketplaces": { title: "Marketplace Health", icon: Store, plan: "pro" as Plan },
  "listing-queue": { title: "Listing Queue", icon: ListChecks, plan: "pro" as Plan },
  "automation": { title: "Automation Queue", icon: Bot, plan: "pro" as Plan },
  "team": { title: "Employee Activity", icon: Users, plan: "business" as Plan },
  "ai": { title: "AI Recommendations", icon: Sparkles, plan: "business" as Plan },
  "supplies": { title: "Supply Alerts", icon: PackageCheck, plan: "starter" as Plan },
} as const;

const WIDGET_COPY: Record<keyof typeof DEFINITIONS, {
  eyebrow: string;
  description: string;
  emptyTitle: string;
  emptyDetail: string;
  actionLabel: string;
  actionHref: string;
  preview?: string;
}> = {
  "inventory-value": {
    eyebrow: "Collection capital",
    description: "Estimated value across tracked singles, sealed products, and assigned locations.",
    emptyTitle: "Start with real inventory value",
    emptyDetail: "Add or import cards and Trading Docks will turn ownership records into a useful portfolio baseline.",
    actionLabel: "Add inventory",
    actionHref: "/dashboard/inventory?create=card",
  },
  "inventory-count": {
    eyebrow: "Owned records",
    description: "Unique tracked printings and physical inventory rows across your workspace.",
    emptyTitle: "No cards tracked yet",
    emptyDetail: "Create your first inventory record with exact printing, condition, finish, and location.",
    actionLabel: "Open collection",
    actionHref: "/dashboard/inventory",
  },
  "collection-growth": {
    eyebrow: "Growth curve",
    description: "A portfolio-quality view of how your collection value changes over time.",
    emptyTitle: "Growth appears after activity",
    emptyDetail: "Imports, scans, purchases, and repricing events will create the timeline here.",
    actionLabel: "Import cards",
    actionHref: "/dashboard/inventory",
  },
  "business-calendar": {
    eyebrow: "Operating rhythm",
    description: "Tasks, card shows, buying sessions, repricing, and team events in one schedule.",
    emptyTitle: "No operating events yet",
    emptyDetail: "Plan card shows, buying sessions, and internal tasks so work does not live in memory.",
    actionLabel: "Open calendar",
    actionHref: "/dashboard/calendar",
  },
  "revenue": {
    eyebrow: "Sales pulse",
    description: "Marketplace and direct-order revenue once channels begin syncing.",
    emptyTitle: "No sales recorded yet",
    emptyDetail: "Connect a marketplace or import orders to turn your dashboard into a live revenue surface.",
    actionLabel: "Connect channel",
    actionHref: "/dashboard/marketplaces",
    preview: "Channel revenue, fees, and realized profit consolidate here.",
  },
  "orders": {
    eyebrow: "Fulfillment",
    description: "Open orders, fulfillment work, and items that need attention.",
    emptyTitle: "No orders yet",
    emptyDetail: "Once a channel is connected, orders will appear with status, item matching, and profit context.",
    actionLabel: "Open orders",
    actionHref: "/dashboard/orders",
    preview: "Ready for marketplace import and fulfillment operations.",
  },
  "marketplaces": {
    eyebrow: "Channel health",
    description: "Connected marketplace status, sync freshness, and unresolved channel issues.",
    emptyTitle: "No marketplaces connected",
    emptyDetail: "Connect eBay, Mana Pool, or imports to monitor channel confidence from one place.",
    actionLabel: "Manage channels",
    actionHref: "/dashboard/marketplaces",
    preview: "Sync status, stale listings, and import health will surface here.",
  },
  "listing-queue": {
    eyebrow: "Sell-through",
    description: "Cards ready for listing, repricing, or operational review.",
    emptyTitle: "No listings queued",
    emptyDetail: "Inventory with pricing gaps or marketplace readiness will flow into this queue.",
    actionLabel: "Review inventory",
    actionHref: "/dashboard/inventory",
    preview: "Compact queue for listing readiness and pricing gaps.",
  },
  "automation": {
    eyebrow: "Automation",
    description: "Repricing, imports, syncs, and background work that needs review.",
    emptyTitle: "No automation activity",
    emptyDetail: "Automations will appear after you connect channels or enable repeatable workflows.",
    actionLabel: "Open automation",
    actionHref: "/dashboard/automation",
    preview: "Failed syncs, repricing jobs, and review queues show here.",
  },
  "team": {
    eyebrow: "Team operations",
    description: "Employee activity, assignment load, and operational accountability.",
    emptyTitle: "No employees added",
    emptyDetail: "Store workspaces can add employees and use roles for shared operations.",
    actionLabel: "Manage employees",
    actionHref: "/dashboard/employees",
    preview: "Role activity and handoff visibility for larger workspaces.",
  },
  "ai": {
    eyebrow: "Intelligence",
    description: "Recommendations based on inventory, marketplace, and buying-session signals.",
    emptyTitle: "Recommendations need signal",
    emptyDetail: "Add inventory and channel activity to unlock suggestions that are specific to your operation.",
    actionLabel: "Open recommendations",
    actionHref: "/dashboard/buying-recommendations",
    preview: "Opportunity detection and next actions without manual digging.",
  },
  "supplies": {
    eyebrow: "Readiness",
    description: "Shipping, sleeves, labels, supplies, and operational materials.",
    emptyTitle: "No supplies tracked",
    emptyDetail: "Track label rolls, shipping materials, sleeves, and store supplies before they become blockers.",
    actionLabel: "Track supplies",
    actionHref: "/dashboard/supplies",
  },
};

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

const ACCOUNT_PLAN: Record<string, Plan> = {
  free: "starter",
  collector: "starter",
  seller: "pro",
  business: "business",
  store: "business",
  "large-seller": "business",
};

const ACCOUNT_LABEL: Record<string, string> = {
  free: "Free",
  collector: "Collector",
  seller: "Online Seller",
  store: "Local Game Store",
  "large-seller": "Large-volume Seller",
};

function normalizeDashboardAccountTier(accountType: string): AccountTier {
  return accountType === "collector" ||
    accountType === "seller" ||
    accountType === "store"
    ? accountType
    : "free";
}

function dashboardAccessDisplay(
  accountType: string,
  access?: ClientSafePlatformAccess,
) {
  if (access && hasTrustedFullPlatformAccess(access)) {
    const title = access.platformRole === "owner" ? "Platform Owner" : "Platform Admin";
    return {
      badge: title,
      summary: "Full platform access",
      metricLabel: title,
    };
  }

  const label =
    accountType === "store" || accountType === "business"
      ? "Store"
      : ACCOUNT_LABEL[accountType] ?? "Free";

  return {
    badge: `${label} plan`,
    summary: `${label} plan`,
    metricLabel: `${label} workspace`,
  };
}

export function ModularWorkspace({
  accountType,
  access,
  personalSummary,
  inventoryModules,
  initialLayouts,
}: {
  accountType: string;
  access?: ClientSafePlatformAccess;
  personalSummary?: PersonalCommandCenterSummary | null;
  inventoryModules: string[];
  initialLayouts?: unknown;
}) {
  const plan = ACCOUNT_PLAN[accountType] ?? "starter";
  const accountTier = normalizeDashboardAccountTier(accountType);
  const hasFullPlatformAccess = Boolean(access && hasTrustedFullPlatformAccess(access));
  const display = dashboardAccessDisplay(accountType, access);
  const isPersonal = !hasFullPlatformAccess && (accountType === "free" || accountType === "collector");
  const baseLayouts = isPersonal ? COLLECTOR_LAYOUTS : DEFAULT_LAYOUTS;
  const availableLayouts = availableDashboardLayouts(accountTier, access);
  const [layoutId, setLayoutId] = useState<LayoutId>("home");
  const [layouts, setLayouts] = useState<Record<LayoutId, Widget[]>>(() => {
    if (isPersonal) return COLLECTOR_LAYOUTS;
    if (!initialLayouts || typeof initialLayouts !== "object") return baseLayouts;
    return { ...baseLayouts, ...(initialLayouts as Partial<Record<LayoutId, Widget[]>>) };
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
      await saveDashboardLayouts(layouts);
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
      <header className="relative overflow-hidden rounded-[24px] border border-td-ink/[0.075] bg-[linear-gradient(145deg,rgb(var(--td-surface-rgb)/.94),rgb(var(--td-surface-rgb)/.98))] p-4 shadow-[0_24px_90px_rgb(var(--td-shadow-rgb)/calc(.28*var(--td-shadow-strength)))] sm:rounded-[30px] sm:p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-td-accent/40 to-transparent" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-td-accent/[0.14] bg-td-accent/[0.045] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-td-accent-text">
                <Sparkles className="h-3.5 w-3.5 text-td-accent-text" />
                Command center
              </span>
              <span className="rounded-full border border-td-ink/[0.075] bg-td-ink/[0.025] px-3 py-1.5 text-[11px] font-semibold capitalize text-td-secondary">
                {display.badge}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-end sm:gap-3">
              <h1 className="text-[1.65rem] font-semibold leading-[1.03] tracking-[-0.05em] text-td-primary sm:text-[2.1rem]">
                Trading Docks HQ
              </h1>
              <p className="pb-1 text-xs font-medium text-td-muted sm:text-sm">
                {inventoryModules.length > 0
                  ? `${inventoryModules.length} inventory modules enabled`
                  : "Ready for your first inventory signal"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              className={[
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-semibold transition sm:gap-2 sm:px-4 sm:text-xs",
                editing
                  ? "border-td-accent/[0.18] bg-td-accent/[0.08] text-td-accent-text"
                  : "border-td-ink/[0.075] bg-td-ink/[0.025] text-td-secondary hover:border-td-accent/[0.14] hover:text-td-primary",
              ].join(" ")}
            >
              <PanelsTopLeft className="h-4 w-4" />
              {editing ? "Done editing" : "Edit layout"}
            </button>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-td-ink/[0.075] bg-td-ink/[0.025] px-2 text-[11px] font-semibold text-td-secondary transition hover:border-td-accent/[0.14] hover:text-td-primary sm:gap-2 sm:px-4 sm:text-xs"
            >
              <Settings2 className="h-4 w-4" />
              Customize
            </button>

            <button
              type="button"
              onClick={save}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-td-accent via-td-accent to-td-accent px-2 text-[11px] font-bold text-td-on-accent shadow-[0_14px_34px_rgb(var(--td-accent-rgb)/.18)] transition hover:from-td-accent hover:to-td-accent sm:gap-2 sm:px-4 sm:text-xs"
            >
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saved ? "Saved" : "Save layout"}
            </button>
          </div>
        </div>

        <div className="relative mt-4 flex flex-col gap-3 border-t border-td-ink/[0.06] pt-4 lg:flex-row lg:items-center lg:justify-between">
          <select
            value={layoutId}
            onChange={(event) => setLayoutId(event.target.value as LayoutId)}
            aria-label="Choose dashboard layout"
            className="h-11 w-full rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-sm font-semibold text-td-primary outline-none sm:hidden"
          >
            {LAYOUTS.filter(
              ([id]) => availableLayouts.has(id),
            ).map(([id, label]) => (
              <option key={id} value={id}>{label} dashboard</option>
            ))}
          </select>
          <div className="hidden flex-wrap gap-2 sm:flex">
            {LAYOUTS.filter(
              ([id]) => availableLayouts.has(id),
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLayoutId(id)}
                className={[
                  "inline-flex h-9 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition",
                  layoutId === id
                    ? "border-td-accent/[0.17] bg-td-accent/[0.07] text-td-primary"
                    : "border-transparent text-td-muted hover:bg-td-ink/[0.025] hover:text-td-secondary",
                ].join(" ")}
              >
                {id === "home" ? <LayoutDashboard className="h-3.5 w-3.5" /> : null}
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 px-0.5 text-[11px] font-medium text-td-muted">
            <span>{widgets.length} visible modules</span>
            <span className="capitalize">
              {display.summary}
            </span>
          </div>
        </div>
      </header>

      <CommandCenterOverview isPersonal={isPersonal} accessLabel={display.metricLabel} summary={personalSummary} />

      {editing ? (
        <div className="mt-4 rounded-[20px] border border-td-accent/[0.13] bg-td-accent/[0.035] px-4 py-3 text-xs leading-5 text-td-accent-text/75 shadow-[0_18px_60px_rgb(var(--td-accent-rgb)/.08)]">
          <span className="font-semibold text-td-accent-text">Layout builder active.</span>{" "}
          Drag modules by the handle, resize them, or remove modules from this view. Save when the command center feels right.
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:grid-cols-1 sm:gap-4 md:grid-cols-12 xl:gap-5">
        {widgets.map((widget) => {
          const definition = DEFINITIONS[widget.id as keyof typeof DEFINITIONS];
          if (!definition) return null;
          const locked = !canUseDashboardWidget(accountTier, widget.id, access);

          return (
            <div
              key={widget.id}
              className={widget.size === "small" ? "contents" : "col-span-2 contents sm:col-span-1"}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => reorder(widget.id)}
            >
              <DashboardWidget
                widget={widget}
                definition={definition}
                locked={locked}
                editing={editing}
                personalSummary={personalSummary}
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

function CommandCenterOverview({
  isPersonal,
  accessLabel,
  summary,
}: {
  isPersonal: boolean;
  accessLabel: string;
  summary?: PersonalCommandCenterSummary | null;
}) {
  const primaryAction = isPersonal
    ? { label: "Add first card", href: "/dashboard/inventory?create=card", icon: ScanLine }
    : { label: "Connect marketplace", href: "/dashboard/marketplaces", icon: Store };
  const PrimaryIcon = primaryAction.icon;
  const personalActions = summary?.actions.map((action) => ({
    label: action.label,
    href: action.href,
    detail: action.detail,
    icon: action.severity === "attention" ? ListChecks : ArrowRight,
  }));
  const nextActions = isPersonal
    ? personalActions?.length
      ? personalActions
      : [
          { label: "Import cards", href: "/dashboard/inventory", detail: "Build the ownership baseline", icon: FileUp },
          { label: "Create a deck", href: "/dashboard/deck-vault", detail: "Organize play-ready cards", icon: PackageOpen },
          { label: "Track portfolio", href: "/dashboard/collector-portfolio", detail: "Share binders and wishlists", icon: Target },
        ]
    : [
        { label: "Review orders", href: "/dashboard/orders", detail: "Keep fulfillment moving", icon: ShoppingBag },
        { label: "Open Label Studio", href: "/dashboard/label-studio", detail: "Print SKU and QR labels", icon: PackageCheck },
        { label: "Check analytics", href: "/dashboard/analytics", detail: "Find pricing gaps", icon: BarChart3 },
      ];
  const headline = summary?.headline ?? "Your operating picture starts with owned inventory.";
  const brief = summary?.brief ?? "Trading Docks turns exact printings, storage, scans, orders, and market signals into one command surface for collectors and sellers.";
  const trackedValue = summary?.knownMarketValue === null || summary?.knownMarketValue === undefined
    ? "Unavailable"
    : formatCurrency(summary.knownMarketValue);
  const cardsTracked = summary
    ? summary.sampleLimited
      ? `${summary.sampledQuantity.toLocaleString()} sampled`
      : summary.sampledQuantity.toLocaleString()
    : "0";
  const openActions = summary?.actions.filter((action) => action.severity === "attention").length ?? (isPersonal ? 0 : 3);
  const signals = summary
    ? [
        summary.unassignedRows > 0,
        summary.missingPriceRows > 0,
        summary.unknownConditionRows > 0 || summary.unknownFinishRows > 0,
      ].filter(Boolean).length
    : 0;

  return (
    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)] xl:gap-5">
      <div className="relative overflow-hidden rounded-[28px] border border-td-accent/[0.12] bg-[radial-gradient(circle_at_12%_0%,rgb(var(--td-accent-rgb)/.12),transparent_34%),linear-gradient(145deg,rgb(var(--td-surface-rgb)/.94),rgb(var(--td-surface-rgb)/.98))] p-5 shadow-[0_28px_90px_rgb(var(--td-shadow-rgb)/calc(.32*var(--td-shadow-strength)))] sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-td-accent/[0.08] blur-[70px]" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-td-accent-text/80">
              State of workspace
            </p>
            <h2 className="mt-3 max-w-2xl text-[2rem] font-semibold leading-[1.02] tracking-[-0.055em] text-td-primary sm:text-[2.7rem]">
              {headline}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-td-secondary">
              {brief}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                href={primaryAction.href}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-td-accent px-4 text-xs font-bold text-td-on-accent shadow-[0_16px_40px_rgb(var(--td-accent-rgb)/.2)] transition hover:bg-td-accent-hover"
              >
                <PrimaryIcon className="h-4 w-4" />
                {primaryAction.label}
              </Link>
              <Link
                href="/dashboard/plans"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.03] px-4 text-xs font-semibold text-td-secondary transition hover:border-td-accent/[0.18] hover:text-td-primary"
              >
                Compare workspace power
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
            <CommandMetric label="Tracked value" value={trackedValue} detail={summary?.knownPriceRows ? `${summary.knownPriceRows.toLocaleString()} priced sampled rows` : "No priced inventory yet"} />
            <CommandMetric label="Cards tracked" value={cardsTracked} detail={summary?.totalInventoryRows ? `${summary.totalInventoryRows.toLocaleString()} inventory records · ${accessLabel}` : accessLabel} />
            <CommandMetric label="Open actions" value={openActions.toLocaleString()} detail={openActions ? "Needs attention" : "No urgent personal actions"} />
            <CommandMetric label="Signals" value={signals.toLocaleString()} detail={summary?.sampleLimited ? "Recent inventory sample" : "Current inventory state"} />
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-td-ink/[0.075] bg-td-ink/[0.025] p-4 shadow-[0_20px_70px_rgb(var(--td-shadow-rgb)/calc(.24*var(--td-shadow-strength)))] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-td-muted">Next best actions</p>
            <h2 className="mt-1 text-base font-semibold tracking-[-0.025em] text-td-primary">Build the signal chain</h2>
          </div>
          <span className="rounded-full border border-td-success/[0.14] bg-td-success/[0.055] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-td-success">
            Live
          </span>
        </div>

        <div className="mt-4 space-y-2.5">
          {nextActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex min-h-16 items-center gap-3 rounded-2xl border border-td-ink/[0.055] bg-black/[0.12] px-3.5 py-3 transition hover:border-td-accent/[0.16] hover:bg-td-accent/[0.025]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-td-accent/[0.1] bg-td-accent/[0.045] text-td-accent-text">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-td-primary">
                    <span className="text-[11px] text-td-muted">0{index + 1}</span>
                    {action.label}
                  </span>
                  <span className="mt-1 block text-xs text-td-muted">{action.detail}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-td-muted transition group-hover:text-td-accent-text" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CommandMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-td-ink/[0.07] bg-black/[0.16] p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-td-primary">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-td-muted">{detail}</p>
    </div>
  );
}

function DashboardWidget({
  widget,
  definition,
  locked,
  editing,
  personalSummary,
  onDragStart,
  onRemove,
  onResize,
}: {
  widget: Widget;
  definition: (typeof DEFINITIONS)[keyof typeof DEFINITIONS];
  locked: boolean;
  editing: boolean;
  personalSummary?: PersonalCommandCenterSummary | null;
  onDragStart: () => void;
  onRemove: () => void;
  onResize: (size: Size) => void;
}) {
  const Icon = definition.icon;
  const copy = WIDGET_COPY[widget.id as keyof typeof DEFINITIONS] ?? WIDGET_COPY["inventory-value"];
  const span =
    widget.size === "small"
      ? "col-span-1 md:col-span-3"
      : widget.size === "medium"
        ? "col-span-2 sm:col-span-1 md:col-span-6 xl:col-span-4"
        : "col-span-2 sm:col-span-1 md:col-span-12 xl:col-span-8";
  const mobileDensity =
    widget.size === "small"
      ? "min-h-[142px] p-3.5"
      : widget.id === "collection-growth"
        ? "min-h-[330px] p-4"
        : widget.id === "business-calendar"
          ? "min-h-[220px] p-4"
          : "min-h-[190px] p-4";

  return (
    <article
      draggable={editing && !locked}
      onDragStart={onDragStart}
      className={[
        styles.glassPanel,
        styles.metricCard,
        span,
        mobileDensity,
        "group rounded-[22px] sm:min-h-[180px] sm:rounded-[26px] sm:p-5",
        locked ? "bg-td-warning/[0.018]" : "",
        editing ? "ring-1 ring-td-accent/[0.14]" : "",
      ].join(" ")}
    >
      <header className="relative flex items-start gap-3">
        {editing ? (
          <button
            type="button"
            aria-label={`Drag ${definition.title}`}
            className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-xl border border-td-accent/[0.12] bg-td-accent/[0.045] text-td-accent-text"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-td-accent/[0.12] bg-td-accent/[0.05] text-td-accent-text shadow-[0_12px_30px_rgb(var(--td-accent-rgb)/.08)]">
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">
            {copy.eyebrow}
          </p>
          <h2 className="mt-1 truncate text-[14px] font-semibold tracking-[-0.018em] text-td-primary sm:text-base">
            {definition.title}
          </h2>
          <p className="mt-1 text-[11px] leading-4 text-td-muted">
            {copy.description}
          </p>
        </div>

        {editing ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <select
              value={widget.size}
              onChange={(event) => onResize(event.target.value as Size)}
              aria-label={`Resize ${definition.title}`}
              className="h-9 rounded-xl border border-td-ink/[0.075] bg-td-surface px-2 text-[11px] capitalize text-td-secondary outline-none focus-visible:ring-2 focus-visible:ring-td-accent/35"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${definition.title}`}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-td-ink/[0.075] bg-td-ink/[0.025] text-td-muted transition hover:border-td-danger/[0.18] hover:text-td-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-td-danger/35"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </header>

      <div className="relative mt-3.5 sm:mt-5">
        {locked ? (
          <LockedModule definition={definition} copy={copy} />
        ) : (
          <WidgetContent id={widget.id} copy={copy} personalSummary={personalSummary} />
        )}
      </div>
    </article>
  );
}

function LockedModule({
  definition,
  copy,
}: {
  definition: (typeof DEFINITIONS)[keyof typeof DEFINITIONS];
  copy: (typeof WIDGET_COPY)[keyof typeof WIDGET_COPY];
}) {
  return (
    <div className="rounded-2xl border border-td-warning/[0.1] bg-[linear-gradient(145deg,rgba(251,191,36,.045),rgb(var(--td-shadow-rgb)/calc(.08*var(--td-shadow-strength))))] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-td-warning/[0.12] bg-td-warning/[0.055] text-td-warning">
          <LockKeyhole className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-td-warning">
            Unlock {definition.title}
          </p>
          <p className="mt-1.5 text-[11px] leading-5 text-td-warning/55">
            {copy.preview ?? copy.description}
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/plans"
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-td-warning px-3.5 text-[11px] font-bold text-td-on-accent transition hover:bg-td-warning"
      >
        View {definition.plan} access
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function WidgetContent({
  id,
  copy,
  personalSummary,
}: {
  id: string;
  copy: (typeof WIDGET_COPY)[keyof typeof WIDGET_COPY];
  personalSummary?: PersonalCommandCenterSummary | null;
}) {
  if (id === "inventory-value") {
    return (
      <Metric
        value={personalSummary?.knownMarketValue === null || personalSummary?.knownMarketValue === undefined ? "Unavailable" : formatCurrency(personalSummary.knownMarketValue)}
        detail={personalSummary?.knownPriceRows ? `${Math.round(personalSummary.priceCoveragePercent)}% sampled price coverage` : "No priced inventory yet"}
        copy={copy}
      />
    );
  }
  if (id === "inventory-count") {
    return (
      <Metric
        value={personalSummary?.totalInventoryRows ? personalSummary.totalInventoryRows.toLocaleString() : "0"}
        detail={personalSummary?.sampledQuantity ? `${personalSummary.sampledQuantity.toLocaleString()} cards in ${personalSummary.sampleLimited ? "recent sample" : "tracked rows"}` : "No exact printings tracked"}
        copy={copy}
      />
    );
  }
  if (id === "revenue") return <Metric value="$0" detail="No synced sales yet" copy={copy} />;
  if (id === "orders") return <List rows={[]} copy={copy} />;
  if (id === "marketplaces") return <List rows={[]} copy={copy} />;
  if (id === "listing-queue") return <List rows={[]} copy={copy} />;
  if (id === "automation") return <List rows={[]} copy={copy} />;
  if (id === "team") return <List rows={[]} copy={copy} />;
  if (id === "supplies") return <List rows={[]} copy={copy} />;
  if (id === "business-calendar") return <MiniCalendar />;
  if (id === "collection-growth") return <CollectionGrowth />;
  if (id === "ai") return <AIRecommendations />;
  return <Metric value="0" detail="No account activity yet" copy={copy} />;
}

function Metric({
  value,
  detail,
  copy,
}: {
  value: string;
  detail: string;
  copy: (typeof WIDGET_COPY)[keyof typeof WIDGET_COPY];
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[2rem] font-semibold tracking-[-0.055em] text-td-primary sm:text-[2.25rem]">{value}</p>
        <p className="mt-2 text-xs leading-5 text-td-muted">{detail}</p>
      </div>
      <PremiumEmptyState copy={copy} compact />
    </div>
  );
}

function List({
  rows,
  copy,
}: {
  rows: string[];
  copy: (typeof WIDGET_COPY)[keyof typeof WIDGET_COPY];
}) {
  if (rows.length === 0) {
    return <PremiumEmptyState copy={copy} />;
  }
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div
          key={row}
          className="rounded-xl border border-td-ink/[0.055] bg-black/[0.08] px-3.5 py-3 text-[11px] text-td-secondary"
        >
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-td-success" />
          {row}
        </div>
      ))}
    </div>
  );
}

function PremiumEmptyState({
  copy,
  compact = false,
}: {
  copy: (typeof WIDGET_COPY)[keyof typeof WIDGET_COPY];
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-td-ink/[0.065] bg-black/[0.12] text-left",
        compact ? "p-3.5" : "p-4 sm:p-5",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-td-accent shadow-[0_0_14px_rgb(var(--td-accent-rgb)/.55)]" />
        <div>
          <p className="text-xs font-semibold text-td-primary">{copy.emptyTitle}</p>
          <p className="mt-1.5 text-[11px] leading-5 text-td-muted">{copy.emptyDetail}</p>
          <Link
            href={copy.actionHref}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-td-accent-text transition hover:text-td-accent-text"
          >
            {copy.actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
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
          <p className="text-2xl font-semibold tracking-[-0.04em] text-td-primary">
            {formatCurrency(latestValue)}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-[11px]">
            <span className="font-semibold text-td-success">
              +{formatCurrency(change)} ({percentage.toFixed(1)}%)
            </span>
            <span className="text-td-muted">during {range}</span>
          </div>
        </div>

        <div className="grid w-full grid-cols-5 items-center rounded-xl border border-td-ink/[0.065] bg-black/[0.12] p-1 sm:inline-flex sm:w-fit">
          {(["7D", "30D", "90D", "1Y", "ALL"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setRange(option);
                setHoveredIndex(null);
              }}
              className={[
                "h-8 rounded-lg px-2 text-[11px] font-semibold transition sm:h-7 sm:px-2.5 sm:text-[11px]",
                range === option
                  ? "bg-td-accent/[0.1] text-td-accent-text shadow-[inset_0_0_0_1px_rgb(var(--td-accent-rgb)/0.12)]"
                  : "text-td-muted hover:text-td-secondary",
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
        className="relative mt-3.5 h-[152px] overflow-hidden rounded-2xl border border-td-ink/[0.055] bg-td-canvas px-1 sm:mt-4 sm:h-[220px]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_14%,rgb(var(--td-accent-rgb)/0.08),transparent_34%)]" />

        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="relative h-full w-full overflow-visible"
          role="img"
          aria-label={`Collection growth over ${range}`}
        >
          <defs>
            <linearGradient id="collection-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--td-action-primary)" stopOpacity="0.34" />
              <stop offset="58%" stopColor="var(--td-action-primary)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--td-action-primary)" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="collection-line-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--td-accent-text)" />
              <stop offset="55%" stopColor="var(--td-action-primary)" />
              <stop offset="100%" stopColor="var(--td-accent-text)" />
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
              stroke="rgb(var(--td-accent-rgb)/0.07)"
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
              stroke="rgb(var(--td-accent-rgb)/0.18)"
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
                  stroke="rgb(var(--td-accent-rgb)/0.2)"
                  strokeDasharray="3 5"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="8"
                  fill="rgb(var(--td-accent-rgb)/0.18)"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="4"
                  fill="var(--td-accent-text)"
                  stroke="rgb(6 19 29)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : null}
          </g>

        </svg>

        <div className="pointer-events-none absolute inset-x-4 bottom-2 h-4">
          {points.map((point, index) => {
            const showLabel =
              data.length <= 7 ||
              index === 0 ||
              index === data.length - 1 ||
              index % Math.ceil(data.length / 6) === 0;

            return showLabel ? (
              <span
                key={`${range}-${point.label}`}
                className="absolute whitespace-nowrap text-[11px] font-medium leading-none tracking-normal text-td-muted"
                style={{
                  left: `${(point.x / width) * 100}%`,
                  transform:
                    index === 0
                      ? "translateX(0)"
                      : index === data.length - 1
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                }}
              >
                {point.label}
              </span>
            ) : null;
          })}
        </div>

        {hoveredIndex !== null ? (
          <div
            className="pointer-events-none absolute top-3 z-20 min-w-[118px] -translate-x-1/2 rounded-xl border border-td-accent/[0.14] bg-td-surface/96 px-3 py-2.5 shadow-[0_16px_42px_rgb(var(--td-shadow-rgb)/calc(0.38*var(--td-shadow-strength))),0_0_26px_rgb(var(--td-accent-rgb)/0.05)] backdrop-blur-xl"
            style={{
              left: `${Math.min(Math.max((activePoint.x / width) * 100, 12), 88)}%`,
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-muted">
              {activePoint.label}
            </p>
            <p className="mt-1 text-xs font-semibold text-td-primary">
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
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-td-primary sm:text-sm">
          {monthLabel}
        </p>
        <Link
          href="/dashboard/calendar"
          className="inline-flex min-h-8 items-center rounded-lg px-2 text-[11px] font-semibold text-td-accent-text transition hover:bg-td-accent/[0.06]"
        >
          Open calendar
        </Link>
      </div>

      <Link
        href="/dashboard/calendar"
        className="group flex min-h-[104px] items-center justify-between gap-4 rounded-2xl border border-td-ink/[0.065] bg-black/[0.1] p-4 transition hover:border-td-accent/[0.14] hover:bg-td-accent/[0.025] sm:hidden"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-td-accent/[0.12] bg-td-accent/[0.055]">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-td-accent-text/75">
              {now.toLocaleString("en-US", { month: "short" })}
            </span>
            <span className="mt-0.5 text-lg font-semibold leading-none text-td-primary">{now.getDate()}</span>
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-td-primary">Your schedule is clear</span>
            <span className="mt-1 block text-[11px] leading-4 text-td-muted">No upcoming events. Tap to plan your next task.</span>
          </span>
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-td-muted transition group-hover:text-td-accent-text" />
      </Link>

      <div className="hidden grid-cols-7 gap-1 sm:grid">
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => (
          <Link
            key={day}
            href="/dashboard/calendar"
            className="min-h-[38px] rounded-md border border-td-ink/[0.045] bg-black/[0.07] p-1 text-left"
          >
            <span className="text-[11px] text-td-muted">{day}</span>
          </Link>
        ))}
      </div>
      <p className="mt-3 hidden text-center text-[11px] text-td-muted sm:block">No events scheduled</p>
    </div>
  );
}

function AIRecommendations() {
  return <PremiumEmptyState copy={WIDGET_COPY.ai} />;
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

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-td-ink/[0.075] bg-td-canvas/98 shadow-[-28px_0_90px_rgb(var(--td-shadow-rgb)/calc(0.45*var(--td-shadow-strength)))] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-td-accent/35 to-transparent" />
        <div className="flex items-center justify-between border-b border-td-ink/[0.06] px-5 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-td-accent-text">Dashboard builder</p>
            <p className="mt-1 text-base font-semibold tracking-[-0.025em] text-td-primary">Customize your command center</p>
            <p className="mt-1 text-[11px] text-td-muted">
              Add modules for your {plan} workspace, then drag the active view into shape.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customize dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] text-td-muted transition hover:text-td-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-td-accent/35"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-5 rounded-2xl border border-td-accent/[0.1] bg-td-accent/[0.025] p-4">
            <p className="text-xs font-semibold text-td-accent-text">Active modules: {widgets.length}</p>
            <p className="mt-1.5 text-[11px] leading-5 text-td-muted">
              Locked previews stay visible only as compact upgrade rails. Removing a module changes layout only, not access.
            </p>
          </div>

          <div className="space-y-2.5">
          {Object.entries(DEFINITIONS).map(([id, definition]) => {
            const Icon = definition.icon;
            const enabled = active.has(id);
            const copy = WIDGET_COPY[id as keyof typeof DEFINITIONS];

            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggle(id)}
                className={[
                  "group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-td-accent/35",
                  enabled
                    ? "border-td-accent/[0.18] bg-td-accent/[0.055]"
                    : "border-td-ink/[0.055] bg-td-ink/[0.018] hover:border-td-accent/[0.12] hover:bg-td-ink/[0.028]",
                ].join(" ")}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-td-accent/[0.1] bg-td-accent/[0.04] text-td-accent-text">
                  <Icon className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold text-td-primary">
                    {definition.title}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-td-muted">
                    {copy.eyebrow} - {definition.plan} access
                  </span>
                </span>

                <span className={[
                  "flex h-7 w-7 items-center justify-center rounded-lg border",
                  enabled
                    ? "border-td-accent/[0.18] bg-td-accent/[0.08] text-td-accent-text"
                    : "border-td-ink/[0.06] bg-td-ink/[0.02] text-td-muted group-hover:text-td-secondary",
                ].join(" ")}>
                  {enabled ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
          </div>
        </div>
      </aside>
    </div>
  );
}
