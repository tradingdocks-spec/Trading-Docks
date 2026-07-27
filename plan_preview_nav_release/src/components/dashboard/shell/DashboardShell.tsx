"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { previewPlanLabel, type PreviewPlan } from "@/lib/admin-plan-preview";

export function DashboardShell({
  children,
  accountType,
  inventoryModules,
  userName,
  isOwner,
  previewPlan,
}: {
  children: ReactNode;
  accountType: string;
  inventoryModules: string[];
  userName: string;
  isOwner: boolean;
  previewPlan?: PreviewPlan | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#02090f] text-white">
      <Sidebar
        accountType={accountType}
        inventoryModules={inventoryModules}
        userName={userName}
        isOwner={isOwner}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onToggle={() => setCollapsed((value) => !value)}
      />

      <Topbar
        collapsed={collapsed}
        onOpenMobile={() => setMobileOpen(true)}
      />

      <div
        className={[
          "min-h-screen pt-[72px] transition-[padding-left] duration-300",
          collapsed ? "lg:pl-[88px]" : "lg:pl-[258px]",
        ].join(" ")}
      >
        {previewPlan ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300/20 bg-amber-300/[0.08] px-4 py-3 text-sm sm:px-6">
            <p className="font-semibold text-amber-100">Previewing the {previewPlanLabel(previewPlan)} plan</p>
            <a href="/dashboard/admin/preview?next=/dashboard/admin" className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-amber-300/20">Return to Owner View</a>
          </div>
        ) : null}
        <main className="min-h-[calc(100vh-72px)]">{children}</main>
      </div>
    </div>
  );
}
