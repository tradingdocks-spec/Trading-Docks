import { MarketingPlaceholder } from "@/components/dashboard/admin/marketing/GrowthEngineWorkspace";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function MarketingAssetsPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <MarketingPlaceholder title="Asset Vault" detail="Approved logos, screenshots, product imagery, source, license notes, and feature associations have a dedicated schema foundation. Upload/render workflows are intentionally staged behind approval." />; }
