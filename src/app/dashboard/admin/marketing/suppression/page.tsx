import { MarketingPlaceholder } from "@/components/dashboard/admin/marketing/GrowthEngineWorkspace";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function MarketingSuppressionPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <MarketingPlaceholder title="Suppression List" detail="Outbound suppression is checked before mock queue insertion and supports unsubscribe, complaint, bounce, provider, and manual reasons. No send path bypasses it." />; }
