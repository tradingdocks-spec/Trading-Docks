"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  LayoutDashboard,
  PanelsTopLeft,
  Plus,
  Save,
  Settings2,
  Sparkles,
} from "lucide-react";

import { CustomizeDrawer } from "./CustomizeDrawer";
import {
  canUseWidget,
  DEFAULT_LAYOUTS,
  WIDGETS,
} from "./widgetRegistry";
import type {
  AccountPlan,
  DashboardLayoutId,
  DashboardWidget,
  WidgetDefinition,
  WidgetSize,
} from "./types";
import { WidgetCard } from "./WidgetCard";

const STORAGE_KEY = "trading-docks-dashboard-layouts-v1";

const LAYOUT_LABELS: Array<[DashboardLayoutId, string]> = [
  ["home", "Home"],
  ["business", "Business"],
  ["inventory", "Inventory"],
  ["analytics", "Analytics"],
  ["automation", "Automation"],
];

export function ModularDashboard() {
  const [plan, setPlan] = useState<AccountPlan>("business");
  const [layoutId, setLayoutId] = useState<DashboardLayoutId>("home");
  const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS);
  const [editing, setEditing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) return;

    try {
      setLayouts({
        ...DEFAULT_LAYOUTS,
        ...JSON.parse(stored),
      });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const widgets = layouts[layoutId];

  const definitions = useMemo(
    () => new Map(WIDGETS.map((widget) => [widget.id, widget])),
    [],
  );

  function updateCurrentLayout(next: DashboardWidget[]) {
    setLayouts((current) => ({
      ...current,
      [layoutId]: next,
    }));
  }

  function saveLayouts() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function toggleWidget(definition: WidgetDefinition) {
    const exists = widgets.some((widget) => widget.id === definition.id);

    if (exists) {
      updateCurrentLayout(widgets.filter((widget) => widget.id !== definition.id));
      return;
    }

    updateCurrentLayout([
      ...widgets,
      {
        id: definition.id,
        size: definition.defaultSize,
      },
    ]);
  }

  function resizeWidget(id: string, size: WidgetSize) {
    updateCurrentLayout(
      widgets.map((widget) =>
        widget.id === id ? { ...widget, size } : widget,
      ),
    );
  }

  function reorderWidget(targetId: string) {
    if (!draggedId || draggedId === targetId) return;

    const next = [...widgets];
    const fromIndex = next.findIndex((widget) => widget.id === draggedId);
    const targetIndex = next.findIndex((widget) => widget.id === targetId);

    if (fromIndex < 0 || targetIndex < 0) return;

    const [moved] = next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, moved);
    updateCurrentLayout(next);
    setDraggedId(null);
  }

  function resetLayout() {
    setLayouts((current) => ({
      ...current,
      [layoutId]: DEFAULT_LAYOUTS[layoutId],
    }));
  }

  return (
    <div className="relative min-h-full overflow-hidden">
      <DashboardBackground />

      <div className="relative mx-auto w-full max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="rounded-[28px] border border-cyan-300/[0.12] bg-[#06131d]/86 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.3),0_0_70px_rgba(34,211,238,0.035)] backdrop-blur-2xl sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.13] bg-cyan-400/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.17em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                Modular operating system
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                Your workspace, built around how you work.
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                Add, remove, resize, and reorder modules. Switch layouts for
                different workflows without leaving the dashboard.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PlanSelector plan={plan} onChange={setPlan} />

              <button
                type="button"
                onClick={() => setEditing((value) => !value)}
                className={[
                  "inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition",
                  editing
                    ? "border-cyan-300/[0.18] bg-cyan-400/[0.08] text-cyan-100"
                    : "border-white/[0.075] bg-white/[0.025] text-slate-400 hover:border-cyan-300/[0.14] hover:text-cyan-200",
                ].join(" ")}
              >
                <PanelsTopLeft className="h-4 w-4" />
                {editing ? "Done editing" : "Edit layout"}
              </button>

              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.075] bg-white/[0.025] px-4 text-xs font-semibold text-slate-400 transition hover:border-cyan-300/[0.14] hover:text-cyan-200"
              >
                <Plus className="h-4 w-4" />
                Customize Dashboard
              </button>

              <button
                type="button"
                onClick={saveLayouts}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 px-4 text-xs font-semibold text-[#001018] shadow-[0_14px_32px_rgba(6,182,212,0.2),inset_0_1px_0_rgba(255,255,255,0.62)] transition hover:-translate-y-0.5"
              >
                {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? "Saved" : "Save layout"}
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.06] pt-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {LAYOUT_LABELS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLayoutId(id)}
                  className={[
                    "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition",
                    layoutId === id
                      ? "border-cyan-300/[0.17] bg-cyan-400/[0.07] text-white shadow-[0_0_24px_rgba(34,211,238,0.045)]"
                      : "border-transparent text-slate-600 hover:border-white/[0.06] hover:bg-white/[0.02] hover:text-slate-300",
                  ].join(" ")}
                >
                  {id === "home" ? <LayoutDashboard className="h-3.5 w-3.5" /> : null}
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-[10px] text-slate-600">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.72)]" />
                Live data
              </span>
              <span>{widgets.length} modules</span>
              <span className="capitalize">{plan} plan</span>
            </div>
          </div>
        </header>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-12">
          {widgets.map((widget) => {
            const definition = definitions.get(widget.id);
            if (!definition) return null;

            return (
              <div
                key={widget.id}
                className="contents"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => reorderWidget(widget.id)}
              >
                <WidgetCard
                  definition={definition}
                  widget={widget}
                  plan={plan}
                  locked={!canUseWidget(definition, plan)}
                  editing={editing}
                  onDragStart={() => setDraggedId(widget.id)}
                  onRemove={() =>
                    updateCurrentLayout(
                      widgets.filter((item) => item.id !== widget.id),
                    )
                  }
                  onResize={(size) => resizeWidget(widget.id, size)}
                />
              </div>
            );
          })}

          {widgets.length === 0 ? (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="col-span-12 flex min-h-[300px] flex-col items-center justify-center rounded-[26px] border border-dashed border-cyan-300/[0.12] bg-cyan-400/[0.018] text-center"
            >
              <Settings2 className="h-7 w-7 text-cyan-300/65" />
              <p className="mt-4 text-sm font-semibold text-slate-300">
                This layout is empty
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Add widgets to create your workspace.
              </p>
            </button>
          ) : null}
        </div>
      </div>

      <CustomizeDrawer
        open={drawerOpen}
        plan={plan}
        widgets={widgets}
        onClose={() => setDrawerOpen(false)}
        onToggleWidget={toggleWidget}
        onReset={resetLayout}
      />

      <style jsx global>{`
        @keyframes widgetBarRise {
          from {
            transform: scaleY(0);
            opacity: 0.2;
          }

          to {
            transform: scaleY(1);
            opacity: 1;
          }
        }

        .widget-bar {
          transform: scaleY(0);
          transform-origin: bottom;
          animation: widgetBarRise 800ms cubic-bezier(0.22, 1, 0.36, 1)
            forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .widget-bar {
            animation: none;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}

function PlanSelector({
  plan,
  onChange,
}: {
  plan: AccountPlan;
  onChange: (plan: AccountPlan) => void;
}) {
  return (
    <label className="relative">
      <span className="sr-only">Preview account plan</span>
      <select
        value={plan}
        onChange={(event) => onChange(event.target.value as AccountPlan)}
        className="h-11 appearance-none rounded-xl border border-white/[0.075] bg-white/[0.025] pl-4 pr-9 text-xs font-semibold capitalize text-slate-400 outline-none transition hover:border-cyan-300/[0.14]"
      >
        <option value="starter">Starter plan</option>
        <option value="pro">Pro plan</option>
        <option value="business">Business plan</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-700" />
    </label>
  );
}

function DashboardBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-[5%] top-[-100px] h-[520px] w-[520px] rounded-full bg-cyan-400/[0.04] blur-[175px]" />
      <div className="absolute right-[3%] top-[28%] h-[460px] w-[460px] rounded-full bg-blue-500/[0.025] blur-[180px]" />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(103,232,249,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(103,232,249,0.022) 1px, transparent 1px)",
          backgroundSize: "58px 58px",
          maskImage: "linear-gradient(to bottom, black, transparent 80%)",
        }}
      />
    </div>
  );
}

