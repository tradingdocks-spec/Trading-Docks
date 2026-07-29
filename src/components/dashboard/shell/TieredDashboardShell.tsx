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
          "dashboard-responsive min-h-screen pt-[64px] transition-[padding-left] duration-300 md:pt-[72px]",
          collapsed ? "xl:pl-[88px]" : "xl:pl-[258px]",
        ].join(" ")}
      >
        <main className="min-h-[calc(100vh-64px)] pb-[76px] md:min-h-[calc(100vh-72px)] md:pb-0">
          <PlanAccessGate accountType={accountType}>{children}</PlanAccessGate>
        </main>
      </div>
      <Link
        href="/dashboard/feedback"
        aria-label="Provide feedback, report a bug, or request a feature"
        className="fixed bottom-[82px] right-3 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400 text-[#021018] shadow-[0_10px_28px_rgba(6,182,212,.2)] transition hover:-translate-y-0.5 hover:bg-cyan-300 md:bottom-5 md:right-5 md:h-12 md:w-auto md:gap-2 md:px-4 md:text-xs md:font-bold"
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span className="hidden md:inline">Feedback / Report Bug</span>
      </Link>
      <MobileBottomNav />
    </div>
  );
}
