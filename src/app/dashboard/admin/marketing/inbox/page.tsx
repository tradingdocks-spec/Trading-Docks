import { redirect } from "next/navigation";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { MarketingInboxWorkspace } from "@/components/dashboard/admin/marketing/MarketingInboxWorkspace";

export const dynamic = "force-dynamic";
export default async function MarketingInboxPage() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) redirect("/dashboard");
  return <MarketingInboxWorkspace />;
}
