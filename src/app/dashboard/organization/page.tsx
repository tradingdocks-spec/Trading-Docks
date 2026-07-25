import { Tags } from "lucide-react";

import { PageScaffold } from "@/components/dashboard/shared/PageScaffold";

export default function OrganizationPage() {
  return (
    <PageScaffold
      eyebrow="Organization"
      title="Sort and locate everything"
      description="Build searchable binders, boxes, shelves, rooms, and Chaos Sort workflows."
      icon={Tags}
      stats={[
        { label: "Active binders", value: "18", detail: "All locations searchable" },
    { label: "Boxes indexed", value: "74", detail: "Including bulk storage" },
    { label: "Cards matched", value: "12,846", detail: "Through Chaos Sort" },
    { label: "Unassigned items", value: "312", detail: "Awaiting placement" }
      ]}
    />
  );
}

