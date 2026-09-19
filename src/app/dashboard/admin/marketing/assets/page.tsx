import { AssetVaultWorkspace } from "@/components/dashboard/admin/marketing/AssetVaultWorkspace";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function MarketingAssetsPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <AssetVaultWorkspace />; }
