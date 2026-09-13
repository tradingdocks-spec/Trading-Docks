import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function MarketingAnalyticsPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[.2em] text-td-accent">Admin marketing</p><h1 className="mt-2 text-3xl font-semibold text-td-primary">Marketing Analytics</h1><p className="mt-4 text-sm leading-6 text-td-secondary">Analytics will be enabled once campaign delivery events and conversion attribution are available. Empty metrics are not fabricated.</p></div>; }
