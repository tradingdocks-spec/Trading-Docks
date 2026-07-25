"use client";

import {
  Check,
  ChevronRight,
  LockKeyhole,
  RotateCcw,
  X,
} from "lucide-react";

import {
  canUseWidget,
  PLAN_RANK,
  WIDGETS,
} from "./widgetRegistry";
import type {
  AccountPlan,
  DashboardWidget,
  WidgetDefinition,
} from "./types";

type CustomizeDrawerProps = {
  open: boolean;
  plan: AccountPlan;
  widgets: DashboardWidget[];
  onClose: () => void;
  onToggleWidget: (widget: WidgetDefinition) => void;
  onReset: () => void;
};

export function CustomizeDrawer({
  open,
  plan,
  widgets,
  onClose,
  onToggleWidget,
  onReset,
}: CustomizeDrawerProps) {
  const activeIds = new Set(widgets.map((widget) => widget.id));
  const modules = Array.from(new Set(WIDGETS.map((widget) => widget.module)));

  return (
    <>
      {open ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close customize dashboard"
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 right-0 z-[80] w-full max-w-[420px] border-l border-white/[0.075] bg-[#030c13]/96 shadow-[-28px_0_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <header className="flex h-[72px] items-center justify-between border-b border-white/[0.06] px-5">
          <div>
            <p className="text-sm font-semibold text-white">Customize Dashboard</p>
            <p className="mt-1 text-[10px] text-slate-600">
              Add modules, then drag them into place.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="h-[calc(100vh-72px)] overflow-y-auto p-5">
          <div className="flex items-center justify-between rounded-2xl border border-cyan-300/[0.1] bg-cyan-400/[0.025] px-4 py-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                Current plan
              </p>
              <p className="mt-1 text-sm font-semibold capitalize text-white">{plan}</p>
            </div>

            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-[10px] font-semibold text-slate-400 transition hover:border-cyan-300/[0.14] hover:text-cyan-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset layout
            </button>
          </div>

          <div className="mt-6 space-y-6">
            {modules.map((module) => (
              <section key={module}>
                <h3 className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                  {module}
                </h3>

                <div className="mt-3 space-y-2">
                  {WIDGETS.filter((widget) => widget.module === module).map((widget) => {
                    const Icon = widget.icon;
                    const active = activeIds.has(widget.id);
                    const allowed = canUseWidget(widget, plan);

                    return (
                      <button
                        key={widget.id}
                        type="button"
                        onClick={() => onToggleWidget(widget)}
                        className={[
                          "group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                          active
                            ? "border-cyan-300/[0.16] bg-cyan-400/[0.045]"
                            : "border-white/[0.055] bg-white/[0.018] hover:border-cyan-300/[0.12] hover:bg-cyan-400/[0.025]",
                        ].join(" ")}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/[0.1] bg-cyan-400/[0.04] text-cyan-300">
                          <Icon className="h-4 w-4" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[11px] font-semibold text-slate-200">
                              {widget.title}
                            </span>

                            {!allowed ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/[0.1] bg-amber-300/[0.035] px-1.5 py-0.5 text-[6px] font-semibold uppercase tracking-[0.12em] text-amber-200/70">
                                <LockKeyhole className="h-2 w-2" />
                                {widget.minimumPlan}
                              </span>
                            ) : null}
                          </span>

                          <span className="mt-1 block truncate text-[9px] text-slate-600">
                            {widget.description}
                          </span>
                        </span>

                        <span
                          className={[
                            "flex h-7 w-7 items-center justify-center rounded-lg border",
                            active
                              ? "border-cyan-300/[0.18] bg-cyan-400/[0.08] text-cyan-300"
                              : "border-white/[0.06] bg-white/[0.02] text-slate-700",
                          ].join(" ")}
                        >
                          {active ? <Check className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4">
            <p className="text-[10px] font-semibold text-slate-300">Plan-based modules</p>
            <p className="mt-2 text-[9px] leading-5 text-slate-600">
              Starter includes inventory, organization, and manual pricing. Pro adds
              marketplaces, orders, analytics, and automation. Business adds AI,
              employees, API tools, advanced reporting, and permissions.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

