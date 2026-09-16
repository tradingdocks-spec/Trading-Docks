import { notFound, redirect } from "next/navigation";
import { ProspectDetail } from "@/components/dashboard/admin/marketing/ProspectDetail";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
export const dynamic = "force-dynamic";
export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) { const actor = await requireServerPlatformRole("admin"); if (!actor) redirect("/dashboard"); const { id } = await params; const { data, error } = await actor.supabase.from("marketing_prospects").select("*").eq("id", id).maybeSingle(); if (error || !data) notFound(); return <ProspectDetail prospect={data} />; }
