import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function MarketingSequencesPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[.2em] text-td-accent">Admin marketing</p><h1 className="mt-2 text-3xl font-semibold text-td-primary">Sequences</h1><p className="mt-4 text-sm leading-6 text-td-secondary">Follow-up sequences are intentionally paused until a reviewed scheduler, suppression stop rules, and idempotent send queue are configured.</p></div>; }
