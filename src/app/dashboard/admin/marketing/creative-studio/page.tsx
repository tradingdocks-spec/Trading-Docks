import { CreativeRendererWorkspace } from "@/components/dashboard/admin/marketing/CreativeRendererWorkspace";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function CreativeStudioPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <CreativeRendererWorkspace />; }
