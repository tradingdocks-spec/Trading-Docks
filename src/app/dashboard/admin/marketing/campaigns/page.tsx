import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { CampaignWorkspace } from "@/components/dashboard/admin/marketing/GrowthEngineWorkspace";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function CampaignsPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <CampaignWorkspace />; }
