import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHash, randomInt } from "node:crypto";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { action?: string; code?: string; name?: string } | null;
  const supabase = await createClient();
  if (body?.action === "consume") {
    const { data, error } = await supabase.rpc("consume_showcase_pairing_code", { input_code: body.code ?? "", device_name: body.name ?? "Front Counter" });
    return error ? NextResponse.json({ error: "Pairing code is invalid or expired." }, { status: 400 }) : NextResponse.json(data);
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: preference } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle();
  if (!preference?.active_workspace_id) return NextResponse.json({ error: "No active workspace." }, { status: 403 });
  const { data: membership } = await supabase.from("workspace_members").select("role").eq("workspace_id", preference.active_workspace_id).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin"].includes(String(membership.role))) return NextResponse.json({ error: "Workspace admin access required." }, { status: 403 });
  const code = String(randomInt(100000, 1000000)); const hash = createHash("sha256").update(code).digest("hex");
  const { error } = await supabase.from("showcase_kiosk_pairing_codes").insert({ workspace_id: preference.active_workspace_id, code_hash: hash, created_by: user.id, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  return error ? NextResponse.json({ error: "Could not create pairing code." }, { status: 400 }) : NextResponse.json({ code: `${code.slice(0, 3)} ${code.slice(3)}`, expiresInMinutes: 10 });
}
