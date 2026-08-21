"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";

import { TieredSidebar } from "./TieredSidebar";
import { Topbar } from "./Topbar";
import { MobileBottomNav } from "./MobileBottomNav";
import { PlanAccessGate } from "../access/PlanAccessGate";
import type { ClientSafePlatformAccess } from "@/lib/platform/client-access";

export function TieredDashboardShell({
  children,
  accountType,
  inventoryModules,
  userName,
  isOwner,
  clientAccess,
}: {
  children: ReactNode;
  accountType: string;
  inventoryModules: string[];
  userName: string;
  isOwner: boolean;
  clientAccess?: ClientSafePlatformAccess;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (!mobileOpen) {
      body.removeAttribute("data-dashboard-mobile-menu");
      return;
    }

    body.setAttribute("data-dashboard-mobile-menu", "open");
    return () => {
      body.removeAttribute("data-dashboard-mobile-menu");
    };
  }, [mobileOpen]);

  return (
    <div className="desktop_layout tablet_layout mobile_layout min-h-screen bg-[var(--td-background-primary)] text-white">
      <TieredSidebar
        accountType={accountType}
        inventoryModules={inventoryModules}
        userName={userName}
        isOwner={isOwner}
        clientAccess={clientAccess}
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
        clientAccess={clientAccess}
      />

      <div
        className={[
          "dashboard-responsive min-h-screen pt-[64px] transition-[padding-left] duration-300 md:pt-[72px]",
          collapsed ? "xl:pl-[76px]" : "xl:pl-[264px]",
        ].join(" ")}
      >
        <main className="min-h-[calc(100vh-64px)] pb-[calc(92px+env(safe-area-inset-bottom))] md:min-h-[calc(100vh-72px)] md:pb-0">
          <PlanAccessGate accountType={accountType} clientAccess={clientAccess}>{children}</PlanAccessGate>
        </main>
      </div>
      <Link
        href="/dashboard/feedback"
        aria-label="Provide feedback, report a bug, or request a feature"
        className="fixed bottom-5 right-5 z-30 hidden h-11 items-center justify-center rounded-[13px] border border-blue-300/20 bg-[var(--td-action-primary)] px-4 text-xs font-bold text-[#021018] shadow-[0_10px_24px_rgba(0,0,0,.22)] transition hover:-translate-y-0.5 hover:bg-[var(--td-action-primary-hover)] md:flex md:w-auto md:gap-2"
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span className="hidden md:inline">Feedback / Report Bug</span>
      </Link>
      <MobileBottomNav
        accountType={accountType}
        isOwner={isOwner}
        clientAccess={clientAccess}
        menuOpen={mobileOpen}
        onOpenMenu={() => setMobileOpen(true)}
      />
    </div>
  );
}
