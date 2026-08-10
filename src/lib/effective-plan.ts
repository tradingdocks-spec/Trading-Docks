import { cookies } from "next/headers";

import { isPreviewPlan, PLAN_PREVIEW_COOKIE } from "@/lib/admin-plan-preview";
import type { AccountTier } from "@/lib/plan-entitlements";
import { resolveServerAccess } from "@/lib/identity/server-access";
import { createClient } from "@/lib/supabase/server";

export async function getEffectivePlan(): Promise<AccountTier> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "free";

  const access = await resolveServerAccess(supabase, user);
  const previewPlan = access.platformRole === "owner"
    ? (await cookies()).get(PLAN_PREVIEW_COOKIE)?.value
    : undefined;

  return isPreviewPlan(previewPlan)
    ? previewPlan
    : access.membershipTier;
}
