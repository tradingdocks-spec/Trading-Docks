import { LabelStudioWorkspace } from "@/components/dashboard/label-studio/LabelStudioWorkspace";
import { requireRouteAccess } from "@/lib/platform/server-access";

export default async function LabelStudioPage() {
  await requireRouteAccess("/dashboard/label-studio");
  return <LabelStudioWorkspace />;
}
