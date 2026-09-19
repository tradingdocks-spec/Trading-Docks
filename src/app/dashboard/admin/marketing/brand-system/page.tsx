import { BrandSystemWorkspace } from "@/components/dashboard/admin/marketing/BrandSystemWorkspace";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function BrandSystemPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <BrandSystemWorkspace />; }
