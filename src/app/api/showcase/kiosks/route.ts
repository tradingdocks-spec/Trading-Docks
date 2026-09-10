import { NextResponse } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

type DatabaseError = { code?: string; message?: string; details?: string };

function logDatabaseFailure(operation: string, context: { userId: string | null; workspaceId: string | null; table: string }, error: DatabaseError) {
  console.error("Showcase kiosk pairing operation failed", {
    operation,
    userId: context.userId,
    workspaceId: context.workspaceId,
    table: context.table,
    code: error.code,
    message: error.message,
    details: error.details,
  });
}

function databaseFailure(error: DatabaseError, context: { userId: string | null; workspaceId: string | null; table: string }) {
  logDatabaseFailure("create_pairing_code", context, error);
  if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST205" || error.code === "PGRST202") {
    return NextResponse.json({ error: "PAIRING_CODE_CREATE_FAILED", message: "Kiosk pairing database migration is not available." }, { status: 503 });
  }
  if (error.code === "42501") {
    return NextResponse.json({ error: "PAIRING_CODE_CREATE_FORBIDDEN", message: "You do not have permission to create kiosk pairing codes." }, { status: 403 });
  }
  if (error.code === "23502" || error.code === "23503" || error.code === "23514") {
    return NextResponse.json({ error: "PAIRING_CODE_CREATE_FAILED", message: "Kiosk pairing data could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ error: "PAIRING_CODE_CREATE_FAILED", message: "Unable to generate pairing code." }, { status: 500 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { name?: unknown; location?: unknown } | null;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Showcase kiosk pairing operation failed", { operation: "resolve_session", userId: null, workspaceId: null, table: "auth.sessions", code: authError.code, message: authError.message });
  }
  if (!user) return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });

  const { data: preference, error: preferenceError } = await supabase
    .from("user_preferences")
    .select("active_workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (preferenceError) {
    logDatabaseFailure("resolve_workspace", { userId: user.id, workspaceId: null, table: "user_preferences" }, preferenceError);
    return NextResponse.json({ error: "WORKSPACE_LOOKUP_FAILED", message: "Unable to resolve your Trading Docks workspace." }, { status: 503 });
  }
  const workspaceId = preference?.active_workspace_id;
  if (!workspaceId) return NextResponse.json({ error: "No active workspace." }, { status: 403 });

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) {
    logDatabaseFailure("resolve_workspace_membership", { userId: user.id, workspaceId, table: "workspace_members" }, membershipError);
    return NextResponse.json({ error: "WORKSPACE_ACCESS_LOOKUP_FAILED", message: "Unable to verify your Trading Docks workspace access." }, { status: 503 });
  }
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

  if (error) return databaseFailure(error, { userId: user.id, workspaceId, table: "showcase_kiosk_pairing_codes" });

  return NextResponse.json({
    deviceName,
    pairingCode: `${code.slice(0, 3)} ${code.slice(3)}`,
    expiresAt,
  });
}
