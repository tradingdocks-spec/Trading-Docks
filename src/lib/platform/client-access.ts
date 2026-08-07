import { createClient } from "@/lib/supabase/client";
import { resolvePlatformAccessContext } from "../platform-access";

export async function resolveClientPlatformAccess() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return resolvePlatformAccessContext({ authenticated: false });
  }

  const [roleResult, preferencesResult, subscriptionResult, overrideResult] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_preferences").select("preferences").eq("user_id", user.id).maybeSingle(),
    supabase.from("billing_subscriptions").select("plan_id,status,current_period_end").eq("user_id", user.id).maybeSingle(),
    supabase.from("admin_membership_overrides").select("plan_id").eq("user_id", user.id).maybeSingle(),
  ]);

  const preferences = preferencesResult.data?.preferences;
  const accountType =
    typeof preferences === "object" &&
    preferences &&
    !Array.isArray(preferences) &&
    "account_type" in preferences &&
    typeof preferences.account_type === "string"
      ? preferences.account_type
      : null;

  return resolvePlatformAccessContext({
    userId: user.id,
    authenticated: true,
    platformRole:
      roleResult.data && typeof roleResult.data === "object" && "role" in roleResult.data
        ? String(roleResult.data.role)
        : null,
    accountType,
    membershipOverride:
      overrideResult.data && typeof overrideResult.data === "object" && "plan_id" in overrideResult.data
        ? String(overrideResult.data.plan_id)
        : null,
    billingPlan:
      subscriptionResult.data && typeof subscriptionResult.data === "object" &&
      "plan_id" in subscriptionResult.data
        ? String(subscriptionResult.data.plan_id)
        : null,
    billingStatus:
      subscriptionResult.data && typeof subscriptionResult.data === "object" &&
      "status" in subscriptionResult.data
        ? String(subscriptionResult.data.status)
        : null,
    billingPeriodEnd:
      subscriptionResult.data && typeof subscriptionResult.data === "object" &&
      "current_period_end" in subscriptionResult.data
        ? String(subscriptionResult.data.current_period_end)
        : null,
  });
}
