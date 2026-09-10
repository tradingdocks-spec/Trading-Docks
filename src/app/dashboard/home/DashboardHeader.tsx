"use client";

import {
  CheckCircle2,
  Cloud,
  RefreshCw,
  Sparkles,
} from "lucide-react";

type DashboardHeaderProps = {
  userName?: string;
  workspaceName?: string;
  connectedMarketplaces?: number;
  isSyncing?: boolean;
  lastSyncedLabel?: string;
};

export function DashboardHeader({
  userName = "there",
  workspaceName = "Trading Docks",
  connectedMarketplaces = 0,
  isSyncing = false,
  lastSyncedLabel = "not yet",
}: DashboardHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-td-ink/[0.06] bg-td-ink/[0.025] px-6 py-6 shadow-[0_24px_80px_rgb(var(--td-shadow-rgb)/calc(0.22*var(--td-shadow-strength)))] backdrop-blur-xl sm:px-7 sm:py-7">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-0 h-56 w-56 rounded-full bg-td-accent/[0.08] blur-3xl" />
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-td-accent/[0.05] blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-td-accent/30 to-transparent" />
      </div>

      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-td-accent/[0.12] bg-td-accent/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-td-accent-text">
              <Sparkles className="h-3 w-3" />
              Command Center
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-td-primary sm:text-3xl">
            Welcome back, {userName}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-td-muted">
            Here&apos;s what&apos;s happening across your inventory,
            orders, marketplaces, and financial activity.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 rounded-2xl border border-td-ink/[0.06] bg-black/[0.14] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-td-success/[0.12] bg-td-success/[0.07]">
              <CheckCircle2 className="h-4 w-4 text-td-success" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium text-td-primary">
                Workspace ready
              </p>

              <p className="mt-0.5 text-[11px] text-td-muted">
                {connectedMarketplaces} marketplaces connected
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-td-ink/[0.06] bg-black/[0.14] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-td-accent/[0.12] bg-td-accent/[0.07]">
              {isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin text-td-accent-text" />
              ) : (
                <Cloud className="h-4 w-4 text-td-accent-text" />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium text-td-primary">
                {workspaceName}
              </p>

              <p className="mt-0.5 text-[11px] text-td-muted">
                {isSyncing
                  ? "Syncing workspace…"
                  : `Last synced ${lastSyncedLabel}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
