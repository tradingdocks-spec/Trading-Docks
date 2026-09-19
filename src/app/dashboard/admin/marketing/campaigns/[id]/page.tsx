import { CampaignDetailWorkspace } from "@/components/dashboard/admin/marketing/CampaignDetailWorkspace";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) redirect("/dashboard");
  const { id } = await params;
  return <CampaignDetailWorkspace campaignId={id} />;
}
