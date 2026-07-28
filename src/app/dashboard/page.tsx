import { redirect } from "next/navigation";

import { ModularWorkspace } from "@/components/dashboard/workspace/ModularWorkspace";
import { getEffectivePlan } from "@/lib/effective-plan";
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
  const effectivePlan = await getEffectivePlan();

  if (preferences.onboarding_completed !== true) {
    redirect("/onboarding");
  }

  return (
    <ModularWorkspace
      accountType={effectivePlan}
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
