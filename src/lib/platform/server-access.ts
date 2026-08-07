import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import {
  resolvePlatformAccessContext,
  type PlatformAccessContext,
  type PlatformCapability,
} from "@/lib/platform-access";
import { createClient } from "@/lib/supabase/server";
import { hasCapability } from "@/lib/platform-access";
import { apiCapabilityDecision } from "./api-access";
import { hasRouteAccess, routeAccessRuleForPath } from "./route-access";

type AuthUser = {
  id: string;
  user_metadata?: {
    full_name?: string | null;
  } | null;
  email?: string | null;
  banned_until?: string | null;
};

export type AccessSupabaseClient = {
  auth: { getUser: () => PromiseLike<{ data: { user: AuthUser | null } }> };
  rpc: (rpcName: string, params?: Record<string, unknown>) => PromiseLike<{
    data: unknown | null;
    error: { message?: string; code?: string } | null;
  }>;
  from: (table: string) => AccessQuery;
};

type AccessQueryData = {
  data: Record<string, unknown> | null;
  error: { message?: string; code?: string } | null;
};

type AccessWhereQuery = {
  eq: (column: string, value: unknown) => AccessWhereQuery;
  in: (column: string, values: unknown[]) => AccessWhereQuery;
  ilike: (column: string, value: string) => AccessWhereQuery;
  order: (column: string, options?: { ascending?: boolean }) => AccessWhereQuery;
  maybeSingle: () => PromiseLike<AccessQueryData>;
  single: () => PromiseLike<AccessQueryData>;
};

type AccessInsertQuery = {
  select: (columns: string) => {
    single: () => PromiseLike<AccessQueryData>;
    maybeSingle: () => PromiseLike<AccessQueryData>;
  };
};

type AccessQuery = {
  select: (columns: string) => AccessWhereQuery;
  insert: (values: unknown) => AccessInsertQuery;
  update: (values: unknown) => AccessWhereQuery;
  upsert?: (values: unknown, options?: { onConflict?: string }) => AccessInsertQuery;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rowData(value: unknown) {
  return value && !Array.isArray(value) && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function providerStateFromRows(
  subscription: Record<string, unknown>,
  error: { message?: string; code?: string } | null,
  overridePlan: string | null,
) {
  if (overridePlan) return "manual" as const;
  if (error) return "unknown" as const;
  if (!subscription.plan_id) return "none" as const;
  return "stripe" as const;
}

export async function resolvePlatformAccessForUser(
  supabase: AccessSupabaseClient,
  user: AuthUser | null,
): Promise<PlatformAccessContext> {
  if (!user) return resolvePlatformAccessContext({ authenticated: false });

  const [roleResult, preferencesResult, subscriptionResult, overrideResult] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_preferences").select("preferences").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("billing_subscriptions")
      .select("plan_id,status,current_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("admin_membership_overrides")
      .select("plan_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const preferences = objectRecord((preferencesResult.data as Record<string, unknown>)?.preferences);
  const role = rowData(roleResult.data as Record<string, unknown>);
  const subscription = rowData(subscriptionResult.data as Record<string, unknown>);
  const override = rowData(overrideResult.data as Record<string, unknown>);
  const suspendedUntil = user.banned_until ? new Date(user.banned_until).getTime() : 0;
  const overridePlan = stringValue(override.plan_id);

  return resolvePlatformAccessContext({
    userId: user.id,
    authenticated: true,
    platformRole: stringValue(role.role),
    accountType: stringValue(preferences.account_type),
    membershipOverride: overridePlan,
    billingPlan: stringValue(subscription.plan_id),
    billingStatus: stringValue(subscription.status),
    billingPeriodEnd: stringValue(subscription.current_period_end),
    providerState: providerStateFromRows(subscription, subscriptionResult.error, overridePlan),
    suspended: Boolean(suspendedUntil && suspendedUntil > Date.now()),
  });
}

type ResolvedPlatformAccess = {
  supabase: AccessSupabaseClient;
  user: AuthUser | null;
  access: PlatformAccessContext;
};

export async function resolveCurrentPlatformAccess(): Promise<ResolvedPlatformAccess> {
  const supabase = (await createClient()) as unknown as AccessSupabaseClient;
  const { data: { user } } = await supabase.auth.getUser();
  const access = await resolvePlatformAccessForUser(supabase, user);
  return { supabase, user: user as AuthUser | null, access };
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
  if (!hasRouteAccess(result.access, pathname)) redirect(redirectTo);
  return { ...result, user: result.user as NonNullable<typeof result.user> };
}

type ApiCapabilityAccessFailure = {
  ok: false;
  response: ReturnType<typeof NextResponse.json>;
};

type ApiCapabilityAccessSuccess = {
  ok: true;
  supabase: AccessSupabaseClient;
  access: PlatformAccessContext;
  user: NonNullable<AuthUser>;
};

export async function requireApiCapability(
  capability: PlatformCapability,
): Promise<ApiCapabilityAccessSuccess | ApiCapabilityAccessFailure> {
  const result = await resolveCurrentPlatformAccess();
  const decision = apiCapabilityDecision(result.access, capability);

  if (!result.user || !decision.allowed) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: decision.error }, { status: decision.status }),
    };
  }

  return {
    ok: true as const,
    supabase: result.supabase,
    access: result.access,
    user: result.user,
  };
}
