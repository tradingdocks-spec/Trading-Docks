import { MarketingOverview } from "@/components/dashboard/admin/marketing/MarketingWorkspace";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function MarketingPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <MarketingOverview />; }
