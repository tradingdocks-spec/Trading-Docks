import { MarketingPlaceholder } from "@/components/dashboard/admin/marketing/GrowthEngineWorkspace";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function BrandSystemPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <MarketingPlaceholder title="Brand System" detail="Trading Docks voice, approved language, prohibited claims, and visual restraint rules are seeded in the admin-only brand system table and used by the foundation generator." />; }
