"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { Sidebar } from "./Sidebar/Sidebar";
import { Topbar } from "./Topbar/Topbar";

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({
  children,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#02090f] text-white">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <Topbar
        sidebarCollapsed={collapsed}
        onOpenMobileSidebar={() => setMobileOpen(true)}
      />

      <div
        className={[
          "min-h-screen pt-[72px] transition-[padding-left] duration-300",
          collapsed ? "lg:pl-[88px]" : "lg:pl-[252px]",
        ].join(" ")}
      >
        <main className="min-h-[calc(100vh-72px)]">{children}</main>
      </div>
    </div>
  );
}

