"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { sanitizeDashboardLayoutsForPlan } from "@/lib/dashboard-entitlements";
import { getEffectivePlan } from "@/lib/effective-plan";

const ACCOUNT_TYPES = ["collector", "seller", "store", "large-seller"] as const;
const INVENTORY_MODULES = [
  "singles",
  "sealed",
  "graded",
  "binders",
  "bulk",
  "supplies",
] as const;

type AccountType = (typeof ACCOUNT_TYPES)[number];
type InventoryModule = (typeof INVENTORY_MODULES)[number];

function isAccountType(value: unknown): value is AccountType {
  return typeof value === "string" && ACCOUNT_TYPES.includes(value as AccountType);
}

function isInventoryModule(value: unknown): value is InventoryModule {
  return (
    typeof value === "string" &&
    INVENTORY_MODULES.includes(value as InventoryModule)
  );
}

export async function completeOnboarding(input: {
  accountType: string;
  modules: string[];
}) {
  if (
    !isAccountType(input.accountType) ||
    !Array.isArray(input.modules) ||
    input.modules.length === 0 ||
    !input.modules.every(isInventoryModule)
  ) {
    throw new Error("Please choose a valid workspace type and at least one module.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/sign-in?next=/onboarding");
  }

  const { data: existing, error: readError } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const currentPreferences =
    existing?.preferences &&
    typeof existing.preferences === "object" &&
    !Array.isArray(existing.preferences)
      ? existing.preferences
      : {};

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      preferences: {
        ...currentPreferences,
        account_type: input.accountType,
        inventory_modules: [...new Set(input.modules)],
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      },
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function saveDashboardLayouts(layouts: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/dashboard");
  }

  const { data: existing, error: readError } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .single();

  if (readError) {
    throw new Error(readError.message);
  }

  const preferences =
    existing.preferences &&
    typeof existing.preferences === "object" &&
    !Array.isArray(existing.preferences)
      ? existing.preferences
      : {};
  const effectivePlan = await getEffectivePlan();
  const safeLayouts = sanitizeDashboardLayoutsForPlan(layouts, effectivePlan);

  const { error } = await supabase
    .from("user_preferences")
    .update({
      preferences: {
        ...preferences,
        dashboard_layouts: safeLayouts,
      },
    })
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
