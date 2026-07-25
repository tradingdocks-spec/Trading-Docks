import { PanelsTopLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard-v2/common/PageHeader";
import { WorkspaceFrame } from "@/components/dashboard-v2/common/WorkspaceFrame";

export default function Page() {
  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Manage account, integrations, preferences, and security."
        icon={PanelsTopLeft}
      />
    </WorkspaceFrame>
  );
}

