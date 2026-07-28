import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ModularWorkspace } from "@/components/dashboard/workspace/ModularWorkspace";
import { isPreviewPlan, PLAN_PREVIEW_COOKIE } from "@/lib/admin-plan-preview";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/dashboard");

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
  const cookieStore = await cookies();
  const previewPlan = isOwner
    ? cookieStore.get(PLAN_PREVIEW_COOKIE)?.value
    : undefined;

  if (preferences.onboarding_completed !== true) {
    redirect("/onboarding");
  }

  return (
    <ModularWorkspace
      accountType={
        isPreviewPlan(previewPlan)
          ? previewPlan
          : typeof preferences.account_type === "string"
          ? preferences.account_type
          : "seller"
      }
      inventoryModules={
        Array.isArray(preferences.inventory_modules)
          ? preferences.inventory_modules.filter(
              (item: unknown): item is string => typeof item === "string",
            )
          : []
      }
      initialLayouts={
        preferences.dashboard_layouts &&
        typeof preferences.dashboard_layouts === "object"
          ? preferences.dashboard_layouts
          : undefined
      }
    />
  );
}
