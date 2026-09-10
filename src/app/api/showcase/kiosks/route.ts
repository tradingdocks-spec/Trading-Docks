import { NextResponse } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

function generationError(error: { code?: string; message?: string } | null) {
  if (error?.code === "42P01" || error?.code === "42703") {
    return "Kiosk database migration is not applied.";
  }
  return "Unable to generate pairing code.";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { name?: unknown; location?: unknown } | null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });

  const { data: preference } = await supabase
    .from("user_preferences")
    .select("active_workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const workspaceId = preference?.active_workspace_id;
  if (!workspaceId) return NextResponse.json({ error: "No active workspace." }, { status: 403 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !["owner", "admin"].includes(String(membership.role))) {
    return NextResponse.json({ error: "Workspace admin access required." }, { status: 403 });
  }

  const deviceName = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "Front Counter";
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await supabase.from("showcase_kiosk_pairing_codes").insert({
    workspace_id: workspaceId,
    code_hash: createHash("sha256").update(code).digest("hex"),
    created_by: user.id,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("Showcase kiosk pairing code generation failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: generationError(error) }, { status: 400 });
  }

  return NextResponse.json({
    deviceName,
    pairingCode: `${code.slice(0, 3)} ${code.slice(3)}`,
    expiresAt,
  });
}