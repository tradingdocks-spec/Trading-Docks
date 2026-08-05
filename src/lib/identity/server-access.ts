import {
  hasPlatformRole,
  resolveAccess,
  type PlatformRole,
  type ResolvedAccess,
} from "./access-model";

type AccessSupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{
          data: Record<string, unknown> | null;
          error: { message?: string; code?: string } | null;
        }>;
      };
    };
  };
};

type AuthUser = {
  id: string;
  banned_until?: string | null;
};

function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function resolveServerAccess(
  supabase: unknown,
  user: AuthUser | null,
): Promise<ResolvedAccess> {
  if (!user) return resolveAccess({});
  const client = supabase as AccessSupabaseClient;

  const [roleResult, preferencesResult, subscriptionResult, overrideResult] = await Promise.all([
    client.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    client.from("user_preferences").select("preferences").eq("user_id", user.id).maybeSingle(),
    client.from("billing_subscriptions").select("plan_id,status,current_period_end").eq("user_id", user.id).maybeSingle(),
    client.from("admin_membership_overrides").select("plan_id").eq("user_id", user.id).maybeSingle(),
  ]);

  const preferences = objectRecord(preferencesResult.data?.preferences);
  const suspendedUntil = user.banned_until ? new Date(user.banned_until).getTime() : 0;

  return resolveAccess({
    userId: user.id,
    platformRole: roleResult.error ? null : roleResult.data?.role as string | null | undefined,
    accountType: preferences.account_type as string | null | undefined,
    membershipOverride: overrideResult.error ? null : overrideResult.data?.plan_id as string | null | undefined,
    billingPlan: subscriptionResult.error ? null : subscriptionResult.data?.plan_id as string | null | undefined,
    billingStatus: subscriptionResult.error ? null : subscriptionResult.data?.status as string | null | undefined,
    billingPeriodEnd: subscriptionResult.error ? null : subscriptionResult.data?.current_period_end as string | null | undefined,
    suspended: Boolean(suspendedUntil && suspendedUntil > Date.now()),
  });
}

export function canAccessAdminRoute(access: ResolvedAccess) {
  return access.canAccessCommandCenter;
}

export function canPerformPlatformAction(
  access: ResolvedAccess,
  minimumRole: Exclude<PlatformRole, "user">,
) {
  return !access.isSuspended && hasPlatformRole(access.platformRole, minimumRole);
}
