import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import {
  resolvePlatformAccessContext,
  type PlatformAccessContext,
  type PlatformCapability,
} from "../../../mobile/services/platform-access.ts";
import { createClient } from "@/lib/supabase/server";
import { hasCapability } from "../../../mobile/services/platform-access.ts";
import { apiCapabilityDecision } from "./api-access";
import { hasRouteAccess, routeAccessRuleForPath } from "./route-access";
import { resolveWorkspaceAccessFromRows } from "./workspace-resolution";

type AuthUser = {
  id: string;
  banned_until?: string | null;
};

type AccessSupabaseClient = {
  auth: {
    getUser: () => PromiseLike<{ data: { user: AuthUser | null } }>;
  };
  from: (table: string) => {
    select: (columns: string) => AccessFilterQuery;
  };
};

type AccessFilterQuery = PromiseLike<AccessListQueryResult> & {
  eq: (column: string, value: string) => AccessFilterQuery;
  order: (column: string, options?: { ascending?: boolean }) => AccessFilterQuery;
  limit: (count: number) => PromiseLike<AccessListQueryResult>;
  maybeSingle: () => PromiseLike<AccessQueryResult>;
};

type AccessQueryResult = {
  data: Record<string, unknown> | null;
  error: { message?: string; code?: string } | null;
};

type AccessListQueryResult = {
  data: Record<string, unknown>[] | null;
  error: { message?: string; code?: string } | null;
};

function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function providerStateFromRows(
  subscriptionError: unknown,
  subscriptionData: Record<string, unknown> | null,
  providerRows: Record<string, unknown>[] | null,
  overridePlan: string | null,
) {
  if (overridePlan) return "manual" as const;
  if (subscriptionError) return "unknown" as const;
  const providerStates = new Set<"stripe" | "revenuecat">();
  for (const row of providerRows ?? []) {
    const provider = stringValue(row.provider);
    if (provider === "apple" || provider === "google") providerStates.add("revenuecat");
    if (provider === "stripe") providerStates.add("stripe");
  }
  if (
    stringValue(subscriptionData?.stripe_subscription_id) ||
    stringValue(subscriptionData?.stripe_customer_id)
  ) {
    providerStates.add("stripe");
  }
  if (providerStates.size > 1) return "mixed" as const;
  if (providerStates.has("revenuecat")) return "revenuecat" as const;
  if (providerStates.has("stripe")) return "stripe" as const;
  if (!subscriptionData?.plan_id) return "none" as const;
  return "unknown" as const;
}

export async function resolvePlatformAccessForUser(
  supabase: unknown,
  user: AuthUser | null,
): Promise<PlatformAccessContext> {
  if (!user) return resolvePlatformAccessContext({ authenticated: false });
  const client = supabase as AccessSupabaseClient;

  const [roleResult, preferencesResult, subscriptionResult, providerSubscriptionsResult, overrideResult, membershipsResult] = await Promise.all([
    client.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    client.from("user_preferences").select("preferences,active_workspace_id").eq("user_id", user.id).maybeSingle(),
    client.from("billing_subscriptions").select("plan_id,status,current_period_end,stripe_customer_id,stripe_subscription_id").eq("user_id", user.id).maybeSingle(),
    client.from("billing_provider_subscriptions").select("provider,status,current_period_end,updated_at").eq("user_id", user.id),
    client.from("admin_membership_overrides").select("plan_id").eq("user_id", user.id).maybeSingle(),
    client.from("workspace_members").select("workspace_id,role").eq("user_id", user.id),
  ]);

  const preferences = objectRecord(preferencesResult.data?.preferences);
  const suspendedUntil = user.banned_until ? new Date(user.banned_until).getTime() : 0;
  const overridePlan = overrideResult.error ? null : stringValue(overrideResult.data?.plan_id);
  const explicitWorkspaceId =
    stringValue(preferencesResult.data?.active_workspace_id) ??
    stringValue(preferences.active_workspace_id);
  const workspaceAccess = membershipsResult.error
    ? { workspaceId: null, workspaceRole: null }
    : resolveWorkspaceAccessFromRows(explicitWorkspaceId, membershipsResult.data ?? []);
  const providerState = providerStateFromRows(
    subscriptionResult.error,
    subscriptionResult.data,
    providerSubscriptionsResult.error ? null : providerSubscriptionsResult.data,
    overridePlan,
  );
  const billingPlan = providerState === "stripe" ? null : stringValue(subscriptionResult.data?.plan_id);
  const billingStatus = providerState === "stripe" ? null : stringValue(subscriptionResult.data?.status);
  const billingPeriodEnd = providerState === "stripe" ? null : stringValue(subscriptionResult.data?.current_period_end);

  return resolvePlatformAccessContext({
    userId: user.id,
    authenticated: true,
    platformRole: roleResult.error ? null : stringValue(roleResult.data?.role),
    platformRoleAuthority: "trusted",
    accountType: stringValue(preferences.account_type),
    membershipOverride: overridePlan,
    billingPlan: subscriptionResult.error ? null : billingPlan,
    billingStatus: subscriptionResult.error ? null : billingStatus,
    billingPeriodEnd: subscriptionResult.error ? null : billingPeriodEnd,
    workspaceId: workspaceAccess.workspaceId,
    workspaceRole: workspaceAccess.workspaceRole,
    providerState,
    suspended: Boolean(suspendedUntil && suspendedUntil > Date.now()),
  });
}

export async function resolveCurrentPlatformAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const access = await resolvePlatformAccessForUser(supabase, user);
  return { supabase, user, access };
}

export async function requireServerCapability(capability: PlatformCapability, redirectTo = "/dashboard/plans") {
  const result = await resolveCurrentPlatformAccess();
  if (!result.user) redirect(`/sign-in?next=${encodeURIComponent(redirectTo)}`);
  if (!hasCapability(result.access, capability)) redirect(redirectTo);
  return result as typeof result & { user: NonNullable<typeof result.user> };
}

export async function requireRouteAccess(pathname: string, redirectTo = "/dashboard") {
  const result = await resolveCurrentPlatformAccess();
  const rule = routeAccessRuleForPath(pathname);
  if (!rule || rule.kind === "public") return result;
  if (!result.user) redirect(`/sign-in?next=${encodeURIComponent(pathname)}`);
  if (!hasRouteAccess(result.access, pathname, process.env.NODE_ENV)) redirect(redirectTo);
  return {
    ...result,
    user: result.user as NonNullable<typeof result.user>,
  };
}

export async function requireApiCapability(capability: PlatformCapability) {
  const result = await resolveCurrentPlatformAccess();
  const decision = apiCapabilityDecision(result.access, capability);
  if (!decision.allowed && decision.status === 401) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: decision.error }, { status: decision.status }),
    };
  }
  if (!decision.allowed) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: decision.error }, { status: decision.status }),
    };
  }
  return { ok: true as const, ...result, user: result.user };
}
