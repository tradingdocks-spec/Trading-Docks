import { LabelStudioWorkspace } from "@/components/dashboard/label-studio/LabelStudioWorkspace";
import { requireRouteAccess } from "@/lib/platform/server-access";
import { ConsumableRecommendations } from "@/components/hardware/HardwareCatalog";
import { hardwareViews } from "@/lib/hardware/server";

export default async function LabelStudioPage() {
  await requireRouteAccess("/dashboard/label-studio");
  return (
    <>
      <LabelStudioWorkspace />
      <details className="mx-auto max-w-6xl p-6">
        <summary>Compatible label stock & printer setup</summary>
        <ConsumableRecommendations
          views={hardwareViews()}
          hardwareId="zebra-zd421"
          source="pos_hardware"
        />
      </details>
    </>
  );
}
