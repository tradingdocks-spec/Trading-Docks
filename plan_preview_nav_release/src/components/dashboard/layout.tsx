import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/shell/DashboardShell";
import { SystemProvider } from "@/components/dashboard/system/SystemProvider";

type DashboardLayoutProps = {
  children: ReactNode;
  accountType: string;
  inventoryModules: string[];
  userName: string;
  isOwner: boolean;
};

export default function DashboardLayout({
  children,
  accountType,
  inventoryModules,
  userName,
  isOwner,
}: DashboardLayoutProps) {
  return (
    <SystemProvider>
      <DashboardShell
        accountType={accountType}
        inventoryModules={inventoryModules}
        userName={userName}
        isOwner={isOwner}
      >
        {children}
      </DashboardShell>
    </SystemProvider>
  );
}
