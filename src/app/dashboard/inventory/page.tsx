import { TieredInventoryWorkspace } from "@/components/dashboard-v2/inventory/TieredInventoryWorkspace";
import { getEffectivePlan } from "@/lib/effective-plan";
import { INVENTORY_LIMITS } from "@/lib/tier-access";

export default async function InventoryPage() {
  const plan = await getEffectivePlan();
  return (
    <TieredInventoryWorkspace
      accountType={plan}
      inventoryLimit={INVENTORY_LIMITS[plan]}
    />
  );
}
