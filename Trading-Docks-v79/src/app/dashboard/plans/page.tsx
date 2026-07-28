import { TieredPlanComparison } from "./TieredPlanComparison";
import { getEffectivePlan } from "@/lib/effective-plan";

export default async function PlansPage() {
  const currentPlan = await getEffectivePlan();
  return <TieredPlanComparison currentPlan={currentPlan} />;
}
