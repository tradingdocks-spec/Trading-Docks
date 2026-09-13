import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function MarketingTemplatesPage() { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); return <Deferred title="Email Templates" copy="Template editing and safe variable rendering are planned for the next milestone. No template is sent or published from this page." />; }
function Deferred({ title, copy }: { title: string; copy: string }) { return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[.2em] text-td-accent">Admin marketing</p><h1 className="mt-2 text-3xl font-semibold text-td-primary">{title}</h1><p className="mt-4 text-sm leading-6 text-td-secondary">{copy}</p></div>; }
