import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiCapability } from "@/lib/platform/server-access";

export const runtime = "nodejs";

const VALID_PLANS = new Set(["free", "collector", "seller", "business", "store"]);

type AuthDirectoryUser = {
  id: string;
  banned_until?: string | null;
  email_confirmed_at?: string | null;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function targetUser(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) throw error ?? new Error("User not found.");
  return data.user;
}

export async function GET() {
  const access = await requireApiCapability("platform.admin");
  if (!access.ok) return access.response;
  const adminClient = createAdminClient();

  try {
    const [{ data: directory, error: directoryError }, authResult] = await Promise.all([
      access.supabase.rpc("admin_directory"),
      adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (directoryError) throw directoryError;
    if (authResult.error) throw authResult.error;
    const authUsers = Array.isArray(authResult.data?.users)
      ? authResult.data.users
      : [];
    const directoryAccounts = Array.isArray(directory) ? directory : [];
    const authById = new Map<string, AuthDirectoryUser>(
      authUsers.map((user) => [String(user.id), user]),
    );
    const accounts = directoryAccounts.map((account: Record<string, unknown>) => {
      const authUser = authById.get(String(account.id));
      const bannedUntil = authUser?.banned_until ?? null;
      return {
        ...account,
        email_confirmed: Boolean(authUser?.email_confirmed_at),
        suspended: Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now()),
        banned_until: bannedUntil,
      };
    });
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Could not load users.") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const access = await requireApiCapability("platform.admin");
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null) as { userId?: string; action?: string; plan?: string } | null;
  if (!body?.userId || !body.action) return NextResponse.json({ error: "Invalid user-management request." }, { status: 400 });
  try {
    const target = await targetUser(body.userId);
    if (target.id === access.user?.id) throw new Error("You cannot modify your own active admin session.");

    if (body.action === "plan") {
      if (!body.plan || !VALID_PLANS.has(body.plan)) throw new Error("Choose a valid plan.");
      const { error } = await access.supabase.rpc("admin_set_membership_override", {
        target_user_id: body.userId,
        new_plan: body.plan,
      });
      if (error) throw error;
      await access.supabase.from("admin_audit_log").insert({
        actor_id: access.user?.id ?? "",
        action: "user.plan.changed",
        target_type: "user",
        target_id: body.userId,
        details: { plan: body.plan },
      });
      return NextResponse.json({ ok: true, message: `Plan changed to ${body.plan}.` });
    }

    if (body.action === "suspend" || body.action === "restore") {
      const admin = createAdminClient();
      const { error } = await admin.auth.admin.updateUserById(body.userId, {
        ban_duration: body.action === "suspend" ? "876000h" : "none",
      });
      if (error) throw error;
      await access.supabase.from("admin_audit_log").insert({
        actor_id: access.user?.id ?? "",
        action: body.action === "suspend" ? "user.suspended" : "user.restored",
        target_type: "user",
        target_id: body.userId,
        details: {},
      });
      return NextResponse.json({ ok: true, message: body.action === "suspend" ? "Account suspended." : "Account access restored." });
    }

    return NextResponse.json({ error: "Unsupported account action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Could not update user.") }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const access = await requireApiCapability("platform.admin");
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null) as { userId?: string; confirmation?: string } | null;
  if (!body?.userId || body.confirmation !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm permanent removal." }, { status: 400 });
  try {
    const target = await targetUser(body.userId);
    if (target.id === access.user?.id) throw new Error("You cannot delete your own active admin account.");
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(body.userId, false);
    if (error) throw error;
      await access.supabase.from("admin_audit_log").insert({
        actor_id: access.user?.id ?? "",
        action: "user.deleted",
        target_type: "user",
        target_id: body.userId,
        details: { email: target.email ?? "" },
      });
      return NextResponse.json({ ok: true, message: "Account permanently deleted." });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Could not delete user.") }, { status: 400 });
  }
}
