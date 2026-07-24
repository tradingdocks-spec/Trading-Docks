import type { ReactNode } from "react";

import { SystemProvider } from "@/components/dashboard/system/SystemProvider";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return (
    <SystemProvider>
      {children}
    </SystemProvider>
  );
}