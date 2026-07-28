import { DeckVaultHome } from "@/components/dashboard/deck-vault/DeckVaultHome";
import { getEffectivePlan } from "@/lib/effective-plan";
import { PLAN_ENTITLEMENTS } from "@/lib/plan-entitlements";

export default async function DeckVaultPage() {
  const plan = await getEffectivePlan();
  return <DeckVaultHome plan={plan} deckLimit={PLAN_ENTITLEMENTS[plan].deckLimit} />;
}
