import { PanelsTopLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard-v2/common/PageHeader";
import { WorkspaceFrame } from "@/components/dashboard-v2/common/WorkspaceFrame";

export default function Page() {
  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Marketplace Workspace"
        title="Marketplace Workspace"
        description="Manage listings, pricing, and connected sales channels."
        icon={PanelsTopLeft}
      />
    </WorkspaceFrame>
  );
}

