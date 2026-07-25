import { PanelsTopLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard-v2/common/PageHeader";
import { WorkspaceFrame } from "@/components/dashboard-v2/common/WorkspaceFrame";

export default function Page() {
  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Orders Workspace"
        title="Orders Workspace"
        description="Track fulfillment, shipping, returns, and customer orders."
        icon={PanelsTopLeft}
      />
    </WorkspaceFrame>
  );
}

