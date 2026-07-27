import { PanelsTopLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard/common/PageHeader";
import { WorkspaceFrame } from "@/components/dashboard/common/WorkspaceFrame";

export default function Page() {
  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Analytics Workspace"
        title="Analytics Workspace"
        description="Review revenue, inventory velocity, and business performance."
        icon={PanelsTopLeft}
      />
    </WorkspaceFrame>
  );
}

