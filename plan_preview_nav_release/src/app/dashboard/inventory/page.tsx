import { cookies } from "next/headers";

import { InventoryWorkspace } from "@/components/dashboard-v2/inventory/InventoryWorkspace";
import { isPreviewPlan, PLAN_PREVIEW_COOKIE } from "@/lib/admin-plan-preview";
import { createClient } from "@/lib/supabase/server";

export default async function InventoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = user
    ? await supabase
        .from("user_preferences")
        .select("preferences")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const preferences =
    data?.preferences &&
    typeof data.preferences === "object" &&
    !Array.isArray(data.preferences)
      ? data.preferences
      : {};
  const isOwner = user?.email?.trim().toLowerCase() === "tradingdocks@gmail.com";
  const cookieStore = await cookies();
  const previewPlan = isOwner
    ? cookieStore.get(PLAN_PREVIEW_COOKIE)?.value
    : undefined;
  const accountType = isPreviewPlan(previewPlan)
    ? previewPlan
    : typeof preferences.account_type === "string"
      ? preferences.account_type
      : "collector";

  return <InventoryWorkspace accountType={accountType} />;
}
