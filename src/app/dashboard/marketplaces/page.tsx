import { PanelsTopLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard/common/PageHeader";
import { WorkspaceFrame } from "@/components/dashboard/common/WorkspaceFrame";

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

