import { PanelsTopLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard/common/PageHeader";
import { WorkspaceFrame } from "@/components/dashboard/common/WorkspaceFrame";

export default function Page() {
  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Automation Workspace"
        title="Automation Workspace"
        description="Run pricing, inventory, and operational workflows."
        icon={PanelsTopLeft}
      />
    </WorkspaceFrame>
  );
}

