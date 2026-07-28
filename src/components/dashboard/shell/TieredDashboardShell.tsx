"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";

import { TieredSidebar } from "./TieredSidebar";
import { Topbar } from "./Topbar";
import { MobileBottomNav } from "./MobileBottomNav";
import { PlanAccessGate } from "../access/PlanAccessGate";

export function TieredDashboardShell({
  children,
  accountType,
  inventoryModules,
  userName,
  isOwner,
}: {
  children: ReactNode;
  accountType: string;
  inventoryModules: string[];
  userName: string;
  isOwner: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="desktop_layout tablet_layout mobile_layout min-h-screen bg-[#02090f] text-white">
      <TieredSidebar
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
        accountType={accountType}
        userName={userName}
        isOwner={isOwner}
      />

      <div
        className={[
          "dashboard-responsive min-h-screen pt-[72px] transition-[padding-left] duration-300",
          collapsed ? "xl:pl-[88px]" : "xl:pl-[258px]",
        ].join(" ")}
      >
        <main className="min-h-[calc(100vh-72px)] pb-[76px] md:pb-0">
          <PlanAccessGate accountType={accountType}>{children}</PlanAccessGate>
        </main>
      </div>
      <Link
        href="/dashboard/feedback"
        aria-label="Provide feedback, report a bug, or request a feature"
        className="fixed bottom-[84px] right-4 z-30 flex min-h-12 items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400 px-4 text-xs font-bold text-[#021018] shadow-[0_14px_42px_rgba(6,182,212,.24)] transition hover:-translate-y-0.5 hover:bg-cyan-300 md:bottom-5 md:right-5"
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span>Feedback / Report Bug</span>
      </Link>
      <MobileBottomNav />
    </div>
  );
}
