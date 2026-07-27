import { Tags } from "lucide-react";

import { PageScaffold } from "@/components/dashboard/common/PageScaffold";

export default function OrganizationPage() {
  return (
    <PageScaffold
      eyebrow="Organization"
      title="Sort and locate everything"
      description="Build searchable binders, boxes, shelves, rooms, and Chaos Sort workflows."
      icon={Tags}
      stats={[
        { label: "Active binders", value: "0", detail: "No binders created" },
        { label: "Boxes indexed", value: "0", detail: "No boxes indexed" },
        { label: "Cards matched", value: "0", detail: "No cards organized" },
        { label: "Unassigned items", value: "0", detail: "No items awaiting placement" }
      ]}
    />
  );
}
