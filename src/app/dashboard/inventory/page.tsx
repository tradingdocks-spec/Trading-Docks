import { CollectorWorkspace } from "@/components/dashboard/collector-workspace/CollectorWorkspace";
import { getEffectivePlan } from "@/lib/effective-plan";
import { hasTrustedOwnerAccess } from "@/lib/platform/client-access";
import { resolveCurrentPlatformAccess } from "@/lib/platform/server-access";
import { INVENTORY_LIMITS } from "@/lib/tier-access";

export default async function InventoryPage() {
  const [plan, platform] = await Promise.all([
    getEffectivePlan(),
    resolveCurrentPlatformAccess(),
  ]);
  const fullPlatformAccess = hasTrustedOwnerAccess(platform.access);
  return (
    <CollectorWorkspace
      accountType={plan}
      inventoryLimit={fullPlatformAccess ? null : INVENTORY_LIMITS[plan]}
      hasFullPlatformAccess={fullPlatformAccess}
    />
  );
}
