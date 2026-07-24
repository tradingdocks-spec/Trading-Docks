"use client";

import type { ReactNode } from "react";

import { useSidebar } from "@/components/dashboard/hooks/useSidebar";
import { Sidebar } from "@/components/dashboard/shell/Sidebar/Sidebar";
import { Topbar } from "@/components/dashboard/shell/Topbar/Topbar";

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({
  children,
}: DashboardShellProps) {
  const {
    isCollapsed,
    isMobileOpen,
    toggleCollapsed,
    openMobile,
    closeMobile,
  } = useSidebar();

  return (
    <div className="min-h-screen bg-[#040b10] text-white">
      <Sidebar
        collapsed={isCollapsed}
        mobileOpen={isMobileOpen}
        onToggleCollapsed={toggleCollapsed}
        onCloseMobile={closeMobile}
      />

      <Topbar
        sidebarCollapsed={isCollapsed}
        onOpenMobileSidebar={openMobile}
      />

      <div
        className={[
          "min-h-screen pt-16 transition-[padding-left] duration-300",
          isCollapsed ? "lg:pl-[76px]" : "lg:pl-[244px]",
        ].join(" ")}
      >
        <main className="min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}