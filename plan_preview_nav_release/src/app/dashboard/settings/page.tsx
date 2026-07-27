import { PanelsTopLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard/common/PageHeader";
import { WorkspaceFrame } from "@/components/dashboard/common/WorkspaceFrame";

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

