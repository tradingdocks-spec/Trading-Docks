import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard-v2/shell/DashboardShell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}

