"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  RefreshCw,
  Store,
} from "lucide-react";

import { Panel } from "./Panel";
import { PanelHeader } from "./PanelHeader";

type MarketplaceStatus = "healthy" | "syncing" | "warning";

type Marketplace = {
  name: string;
  abbreviation: string;
  status: MarketplaceStatus;
  detail: string;
  listings: string;
  lastSync: string;
};

const marketplaces: Marketplace[] = [];

const statusStyles: Record<
  MarketplaceStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    badge: string;
    iconClass: string;
    dot: string;
  }
> = {
  healthy: {
    label: "Healthy",
    icon: CheckCircle2,
    badge:
      "border-emerald-300/[0.12] bg-emerald-400/[0.07] text-emerald-300",
    iconClass: "text-emerald-300",
    dot: "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.7)]",
  },
  syncing: {
    label: "Syncing",
    icon: RefreshCw,
    badge: "border-cyan-300/[0.12] bg-cyan-400/[0.07] text-cyan-300",
    iconClass: "animate-spin text-cyan-300",
    dot: "bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.7)]",
  },
  warning: {
    label: "Needs attention",
    icon: AlertTriangle,
    badge: "border-amber-300/[0.12] bg-amber-400/[0.07] text-amber-300",
    iconClass: "text-amber-300",
    dot: "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.7)]",
  },
};

export function MarketplaceHealth() {
  return (
    <Panel className="min-h-[360px]" padding="lg">
      <PanelHeader
        eyebrow="Connections"
        title="Marketplace Health"
        subtitle="Live sync status across connected sales channels"
        action={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 text-xs font-medium text-slate-400 transition hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Manage
          </button>
        }
      />

      <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/[0.12] px-4 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/[0.12] bg-cyan-400/[0.07]">
              <Store className="h-5 w-5 text-cyan-300" />
            </div>

            <div>
              <p className="text-sm font-medium text-white">
                0 marketplaces connected
              </p>

              <p className="mt-1 text-xs text-slate-600">
                Connect a marketplace to see its status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock3 className="h-3.5 w-3.5" />
            No sync activity yet
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {marketplaces.map((marketplace) => {
          const styles = statusStyles[marketplace.status];
          const StatusIcon = styles.icon;

          return (
            <article
              key={marketplace.name}
              className="group flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-4 py-4 transition hover:border-white/[0.1] hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.07] bg-black/[0.18]">
                  <span className="text-xs font-semibold tracking-wide text-slate-300">
                    {marketplace.abbreviation}
                  </span>

                  <span
                    className={[
                      "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#071017]",
                      styles.dot,
                    ].join(" ")}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {marketplace.name}
                    </p>

                    <span
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        styles.badge,
                      ].join(" ")}
                    >
                      <StatusIcon
                        className={[
                          "h-3 w-3",
                          styles.iconClass,
                        ].join(" ")}
                      />

                      {styles.label}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-xs text-slate-600">
                    {marketplace.detail}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-6 pl-14 sm:justify-end sm:pl-0">
                <div className="text-left sm:text-right">
                  <p className="text-xs font-medium text-slate-300">
                    {marketplace.listings}
                  </p>

                  <p className="mt-1 text-[11px] text-slate-700">
                    {marketplace.lastSync}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
