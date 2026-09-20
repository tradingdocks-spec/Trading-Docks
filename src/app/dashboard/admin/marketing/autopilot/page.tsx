import { redirect } from "next/navigation";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { MarketingAutopilotWorkspace } from "@/components/dashboard/admin/marketing/MarketingAutopilotWorkspace";

export const dynamic = "force-dynamic";

export default async function MarketingAutopilotPage() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) redirect("/dashboard");
  return <MarketingAutopilotWorkspace />;
}
