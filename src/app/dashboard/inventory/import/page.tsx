import { InventoryImportWorkspace } from "@/components/dashboard/collector-workspace/InventoryImportWorkspace";

export default async function InventoryImportPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string; locationName?: string }>;
}) {
  const params = await searchParams;
  return (
    <InventoryImportWorkspace
      initialLocationId={params.locationId ?? ""}
      initialLocationName={params.locationName ?? "Unassigned"}
    />
  );
}
