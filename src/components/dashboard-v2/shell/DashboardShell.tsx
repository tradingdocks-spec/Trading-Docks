"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-td-canvas text-td-primary">
      <Sidebar
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
        <main className="min-h-[calc(100vh-72px)]">{children}</main>
      </div>
    </div>
  );
}

