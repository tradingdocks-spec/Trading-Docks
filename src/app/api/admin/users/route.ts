import { NextResponse } from "next/server";

import {
  buildInventoryUsageByUser,
  resolveAccountUsage,
  type InventoryUsageRow,
} from "@/lib/admin/account-usage";
import { resolveAccess } from "@/lib/identity/access-model";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const VALID_PLANS = new Set(["free", "collector", "seller", "store"]);
const INVENTORY_USAGE_PAGE_SIZE = 1000;

type AuthDirectoryUser = {
  id: string;
  email?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
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

function protectOwnerRole(role: unknown) {
  if (role === "owner") {
    throw new Error("The permanent owner account cannot be modified or deleted.");
  }
}

async function loadInventoryUsageByUser(admin: ReturnType<typeof createAdminClient>) {
  const rows: InventoryUsageRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await admin
      .from("inventory_items")
      .select("user_id,id,quantity,updated_at")
      .order("user_id", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + INVENTORY_USAGE_PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data ?? []) as InventoryUsageRow[];
    rows.push(...page);
    if (page.length < INVENTORY_USAGE_PAGE_SIZE) break;
    from += INVENTORY_USAGE_PAGE_SIZE;
  }

  return buildInventoryUsageByUser(rows);
}

export async function GET() {
  const actor = await requireServerPlatformRole("support");
  if (!actor) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const admin = createAdminClient();
    const [authResult, profiles, roles, subscriptions, overrides, usage, inventoryUsageById] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("profiles").select("id,full_name"),
      admin.from("user_roles").select("user_id,role"),
      admin.from("billing_subscriptions").select("user_id,plan_id,status,current_period_end"),
      admin.from("admin_membership_overrides").select("user_id,plan_id"),
      admin.from("account_card_usage").select("user_id,card_units,unique_inventory_rows,updated_at"),
      loadInventoryUsageByUser(admin),
    ]);
    if (authResult.error) throw authResult.error;
    if (profiles.error) throw profiles.error;
    if (roles.error) throw roles.error;
    if (subscriptions.error) throw subscriptions.error;
    if (overrides.error) throw overrides.error;
    if (usage.error) throw usage.error;

    const profilesById = new Map((profiles.data ?? []).map((row: Record<string, unknown>) => [String(row.id), row]));
    const rolesById = new Map((roles.data ?? []).map((row: Record<string, unknown>) => [String(row.user_id), row.role]));
    const subscriptionsById = new Map((subscriptions.data ?? []).map((row: Record<string, unknown>) => [String(row.user_id), row]));
    const overridesById = new Map((overrides.data ?? []).map((row: Record<string, unknown>) => [String(row.user_id), row.plan_id]));
    const usageById = new Map((usage.data ?? []).map((row: Record<string, unknown>) => [String(row.user_id), row]));

    const accounts = authResult.data.users.map((authUser: AuthDirectoryUser) => {
      const profile = profilesById.get(authUser.id);
      const subscription = subscriptionsById.get(authUser.id);
      const usageRow = usageById.get(authUser.id);
      const accountUsage = resolveAccountUsage({
        userId: authUser.id,
        inventoryUsage: inventoryUsageById,
        cachedUsage: usageRow,
      });
      const bannedUntil = authUser.banned_until ?? null;
      const access = resolveAccess({
        userId: authUser.id,
        platformRole: rolesById.get(authUser.id) as string | null | undefined,
        accountType: null,
        membershipOverride: overridesById.get(authUser.id) as string | null | undefined,
        billingPlan: subscription?.plan_id as string | null | undefined,
        billingStatus: subscription?.status as string | null | undefined,
        billingPeriodEnd: subscription?.current_period_end as string | null | undefined,
        suspended: Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now()),
      });
      return {
        id: authUser.id,
        email: authUser.email ?? "",
        full_name:
          typeof profile?.full_name === "string"
            ? profile.full_name
            : typeof authUser.user_metadata?.full_name === "string"
              ? authUser.user_metadata.full_name
              : null,
        role: access.platformRole,
        membership_level: access.membershipTier,
        membership_override: overridesById.get(authUser.id) ?? null,
        card_units: accountUsage.cardUnits,
        unique_inventory_rows: accountUsage.uniqueInventoryRows,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at ?? null,
        usage_updated_at: accountUsage.updatedAt,
        usage_source: accountUsage.source,
        email_confirmed: Boolean(authUser.email_confirmed_at),
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
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { userId?: string; action?: string; plan?: string } | null;
  if (!body?.userId || !body.action) return NextResponse.json({ error: "Invalid user-management request." }, { status: 400 });
  try {
    const target = await targetUser(body.userId);
    const { data: targetRole } = await actor.supabase.from("user_roles").select("role").eq("user_id", body.userId).maybeSingle();
    protectOwnerRole(targetRole?.role);
    if (target.id === actor.user.id) throw new Error("You cannot modify your own active admin session.");

    if (body.action === "plan") {
      if (!body.plan || !VALID_PLANS.has(body.plan)) throw new Error("Choose a valid plan.");
      const admin = createAdminClient();
      const { error } = await admin.from("admin_membership_overrides").upsert({
        user_id: body.userId,
        plan_id: body.plan,
        granted_by: actor.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      await admin.from("admin_audit_log").insert({ actor_id: actor.user.id, action: "user.plan.changed", target_type: "user", target_id: body.userId, details: { plan: body.plan } });
      return NextResponse.json({ ok: true, message: `Plan changed to ${body.plan}.` });
    }

    if (body.action === "suspend" || body.action === "restore") {
      const admin = createAdminClient();
      const { error } = await admin.auth.admin.updateUserById(body.userId, {
        ban_duration: body.action === "suspend" ? "876000h" : "none",
      });
      if (error) throw error;
      await admin.from("admin_audit_log").insert({ actor_id: actor.user.id, action: body.action === "suspend" ? "user.suspended" : "user.restored", target_type: "user", target_id: body.userId, details: {} });
      return NextResponse.json({ ok: true, message: body.action === "suspend" ? "Account suspended." : "Account access restored." });
    }

    return NextResponse.json({ error: "Unsupported account action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Could not update user.") }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const actor = await requireServerPlatformRole("owner");
  if (!actor) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { userId?: string; confirmation?: string } | null;
  if (!body?.userId || body.confirmation !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm permanent removal." }, { status: 400 });
  try {
    const target = await targetUser(body.userId);
    const { data: targetRole } = await actor.supabase.from("user_roles").select("role").eq("user_id", body.userId).maybeSingle();
    protectOwnerRole(targetRole?.role);
    if (target.id === actor.user.id) throw new Error("You cannot delete your own active admin account.");
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(body.userId, false);
    if (error) throw error;
    await admin.from("admin_audit_log").insert({ actor_id: actor.user.id, action: "user.deleted", target_type: "user", target_id: body.userId, details: { email: target.email ?? "" } });
    return NextResponse.json({ ok: true, message: "Account permanently deleted." });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Could not delete user.") }, { status: 400 });
  }
}
