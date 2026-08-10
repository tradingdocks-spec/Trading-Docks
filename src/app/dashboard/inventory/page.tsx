import { CollectorWorkspace } from "@/components/dashboard/collector-workspace/CollectorWorkspace";
import { getEffectivePlan } from "@/lib/effective-plan";
import { INVENTORY_LIMITS } from "@/lib/tier-access";

export default async function InventoryPage() {
  const plan = await getEffectivePlan();
  return (
    <CollectorWorkspace
      accountType={plan}
      inventoryLimit={INVENTORY_LIMITS[plan]}
    />
  );
}
