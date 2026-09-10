import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const transitions: Record<string, string[]> = { new: ["picking", "cancelled", "unavailable"], picking: ["ready", "cancelled", "unavailable"], ready: ["completed", "cancelled"], completed: [], cancelled: [], unavailable: [] };

export async function PATCH(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  const nextStatus = typeof body?.status === "string" ? body.status : "";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: preference } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle();
  const { data: requestRow } = await supabase.from("showcase_requests").select("id,workspace_id,status").eq("id", requestId).maybeSingle();
  if (!requestRow || requestRow.workspace_id !== preference?.active_workspace_id) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (!transitions[String(requestRow.status)]?.includes(nextStatus)) return NextResponse.json({ error: "That request transition is not allowed." }, { status: 409 });
  const { data, error } = await supabase.rpc("update_showcase_request_status", { requested_id: requestId, next_status: nextStatus, actor_id: user.id });
  if (error) return NextResponse.json({ error: error.message || "Request could not be updated." }, { status: error.code === "22023" ? 409 : 400 });
  return NextResponse.json({ request: data });
}
