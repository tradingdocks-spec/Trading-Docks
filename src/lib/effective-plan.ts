import { cookies } from "next/headers";

import { isPreviewPlan, PLAN_PREVIEW_COOKIE } from "@/lib/admin-plan-preview";
import { normalizeAccountTier, type AccountTier } from "@/lib/plan-entitlements";
import { createClient } from "@/lib/supabase/server";

export async function getEffectivePlan(): Promise<AccountTier> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "free";

  const { data: subscription } = await supabase
    .from("billing_subscriptions")
    .select("plan_id,status,current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();
  const paidAccessIsCurrent =
    subscription &&
    (subscription.status === "active" ||
      subscription.status === "trialing" ||
      (subscription.status === "past_due" &&
        subscription.current_period_end &&
        new Date(subscription.current_period_end) > new Date()));

  const { data } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();
  const preferences =
    data?.preferences &&
    typeof data.preferences === "object" &&
    !Array.isArray(data.preferences)
      ? data.preferences
      : {};

  const isOwner = user.email?.trim().toLowerCase() === "tradingdocks@gmail.com";
  const previewPlan = isOwner
    ? (await cookies()).get(PLAN_PREVIEW_COOKIE)?.value
    : undefined;

  return isPreviewPlan(previewPlan)
    ? previewPlan
    : isOwner
      ? "business"
    : paidAccessIsCurrent
      ? normalizeAccountTier(subscription.plan_id)
      : normalizeAccountTier(preferences.account_type === "free" ? "free" : undefined);
}
