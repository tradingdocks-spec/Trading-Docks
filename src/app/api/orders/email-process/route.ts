import { NextResponse } from "next/server";
import { processWorkspaceBacklog } from "@/lib/email/process-inbound";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function workspaceId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: preferences } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", userId).maybeSingle();
  if (preferences?.active_workspace_id) return preferences.active_workspace_id as string;
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  return (membership?.workspace_id as string | undefined) ?? null;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const id = await workspaceId(supabase, user.id);
  if (!id) return NextResponse.json({ error: "No active workspace." }, { status: 409 });
  try {
    const result = await processWorkspaceBacklog(createAdminClient(), id, 250);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Email processing failed." }, { status: 500 });
  }
}
