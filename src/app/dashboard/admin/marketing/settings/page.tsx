import { MarketingPlaceholder } from "@/components/dashboard/admin/marketing/GrowthEngineWorkspace";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function MarketingSettingsPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <MarketingPlaceholder title="Settings" detail="The foundation defaults to a mock email provider with outbound delivery disabled. Sender identity, physical address, unsubscribe URL, and provider webhooks must be configured before any future production enablement." />; }
