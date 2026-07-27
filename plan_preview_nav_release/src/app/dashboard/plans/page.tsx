import { PlanComparison } from "./PlanComparison";
import { createClient } from "@/lib/supabase/server";

export default async function PlansPage() {
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
  const currentPlan =
    typeof preferences.account_type === "string"
      ? preferences.account_type
      : "collector";

  return <PlanComparison currentPlan={currentPlan} />;
}
