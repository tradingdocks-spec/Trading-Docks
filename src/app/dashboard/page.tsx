import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { BusinessCommandCenter } from "@/components/dashboard/business-command-center/BusinessCommandCenter";
import { ModularWorkspace } from "@/components/dashboard/workspace/ModularWorkspace";
import { isPreviewPlan, PLAN_PREVIEW_COOKIE } from "@/lib/admin-plan-preview";
import {
  canViewBusinessCommandCenter,
  loadBusinessCommandCenter,
  type BusinessDateRange,
  type DashboardSupabaseClient,
} from "@/lib/dashboard/business-command-center";
import { resolvePlatformAccessForUser } from "@/lib/platform/server-access";
import { createClient } from "@/lib/supabase/server";
import {
  clientAccessFromTier,
  toClientSafeAccess,
} from "../../../mobile/services/platform-access.ts";

export const dynamic = "force-dynamic";

function businessRange(value: unknown): BusinessDateRange {
  return value === "today" || value === "7d" || value === "30d" || value === "month" || value === "week"
    ? value
    : "7d";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/dashboard");

  const { data } = await supabase
    .from("user_preferences")
    .select("preferences,active_workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const preferences =
    data?.preferences &&
    typeof data.preferences === "object" &&
    !Array.isArray(data.preferences)
      ? data.preferences
      : {};
  const access = await resolvePlatformAccessForUser(supabase, user);
  const previewPlan = access.platformRole === "owner"
    ? (await cookies()).get(PLAN_PREVIEW_COOKIE)?.value
    : undefined;
  const effectivePlan = isPreviewPlan(previewPlan)
    ? previewPlan
    : access.membershipTier;
  const clientAccess = isPreviewPlan(previewPlan)
    ? clientAccessFromTier(previewPlan)
    : toClientSafeAccess(access);

  if (preferences.onboarding_completed !== true) {
    redirect("/onboarding");
  }

  if (canViewBusinessCommandCenter(access)) {
    const dashboardSupabase = supabase as unknown as DashboardSupabaseClient;
    const businessSummary = await loadBusinessCommandCenter({
      supabase: dashboardSupabase,
      access,
      range: businessRange(range),
    });

    if (businessSummary) {
      return <BusinessCommandCenter summary={businessSummary} />;
    }
  }

  return (
    <ModularWorkspace
      accountType={effectivePlan}
      access={clientAccess}
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
