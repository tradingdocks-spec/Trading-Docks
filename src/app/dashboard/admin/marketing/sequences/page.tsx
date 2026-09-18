import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { MarketingPlaceholder } from "@/components/dashboard/admin/marketing/GrowthEngineWorkspace";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function MarketingSequencesPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <MarketingPlaceholder title="Sequences" detail="Follow-up sequence tables and stop rules are modeled next to outreach messages. Scheduling remains paused until a durable worker and provider webhook are configured." />; }
