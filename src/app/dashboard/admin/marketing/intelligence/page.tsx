import { MarketingIntelligenceWorkspace } from "@/components/dashboard/admin/marketing/MarketingIntelligenceWorkspace";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function MarketingIntelligencePage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <MarketingIntelligenceWorkspace />; }
