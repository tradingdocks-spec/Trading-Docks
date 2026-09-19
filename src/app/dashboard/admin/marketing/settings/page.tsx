import { MarketingSettingsWorkspace } from "@/components/dashboard/admin/marketing/MarketingSettingsWorkspace";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function MarketingSettingsPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <MarketingSettingsWorkspace />; }
