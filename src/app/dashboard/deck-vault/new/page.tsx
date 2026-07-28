import { DeckImportCenter } from "@/components/dashboard/deck-vault/DeckImportCenter";
import { getEffectivePlan } from "@/lib/effective-plan";
import { PLAN_ENTITLEMENTS } from "@/lib/plan-entitlements";

export default async function NewDeckPage() {
  const plan = await getEffectivePlan();
  return <DeckImportCenter plan={plan} deckLimit={PLAN_ENTITLEMENTS[plan].deckLimit} />;
}
