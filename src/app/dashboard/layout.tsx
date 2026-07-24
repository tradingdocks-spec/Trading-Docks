import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/shell/DashboardShell";
import { SystemProvider } from "@/components/dashboard/system/SystemProvider";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return (
    <SystemProvider>
      <DashboardShell>{children}</DashboardShell>
    </SystemProvider>
  );
}