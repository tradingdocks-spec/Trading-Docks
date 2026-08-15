import { PanelsTopLeft } from "lucide-react";

import { PageScaffold } from "@/components/dashboard/common/PageScaffold";

export default function Page() {
  return (
    <PageScaffold
      eyebrow="Automation"
      title="Workflow automation"
      description="Review pricing, inventory, fulfillment, and operations automations as they become available for this workspace."
      icon={PanelsTopLeft}
      stats={[
        { label: "Active workflows", value: "0", detail: "No automations enabled" },
        { label: "Pending runs", value: "0", detail: "No queued workflow runs" },
        { label: "Needs review", value: "0", detail: "No automation exceptions" },
        { label: "Last run", value: "None", detail: "No workflow history yet" },
      ]}
      actions={[
        { label: "Review buying rules", href: "/dashboard/buying-rules" },
        { label: "Open settings", href: "/dashboard/settings" },
      ]}
    />
  );
}
