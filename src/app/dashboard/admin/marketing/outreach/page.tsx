import { OutreachWorkspace } from "@/components/dashboard/admin/marketing/OutreachWorkspace";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function OutreachPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <OutreachWorkspace />; }
