import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { MarketingPlaceholder } from "@/components/dashboard/admin/marketing/GrowthEngineWorkspace";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function MarketingTemplatesPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <MarketingPlaceholder title="Templates" detail="Approved email language and safe personalization variables belong here. Draft generation currently uses the controlled feature library and brand rules." />; }
