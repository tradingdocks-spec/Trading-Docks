import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { MarketingPlaceholder } from "@/components/dashboard/admin/marketing/GrowthEngineWorkspace";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function MarketingAnalyticsPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <MarketingPlaceholder title="Analytics" detail="Delivery, click, reply, and conversion attribution are modeled in the growth schema. Metrics will remain empty until real provider events exist." />; }
