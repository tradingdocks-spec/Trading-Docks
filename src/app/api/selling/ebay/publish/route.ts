import { NextResponse } from "next/server";

import { publishCandidatesInMockMode } from "@/lib/selling/ebay-publish";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: preferences } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle();
  const workspaceId = preferences?.active_workspace_id as string | null;
  if (!workspaceId) return NextResponse.json({ error: "An active workspace is required." }, { status: 400 });
  const body = await request.json().catch(() => null) as { candidateIds?: unknown } | null;
  if (!Array.isArray(body?.candidateIds) || body.candidateIds.some((id) => typeof id !== "string")) return NextResponse.json({ error: "Candidate ids are required." }, { status: 400 });
  try { return NextResponse.json(await publishCandidatesInMockMode({ supabase, userId: user.id, workspaceId, candidateIds: body.candidateIds })); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "eBay mock publish failed." }, { status: 400 }); }
}
