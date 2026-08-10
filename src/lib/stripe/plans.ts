import {
  MEMBERSHIP_PLANS,
  MEMBERSHIP_PROVIDER_MAPPINGS,
  type BillingCycle as CatalogBillingCycle,
  type MembershipTier,
} from "@/lib/membership-catalog";

export type PaidPlan = Exclude<MembershipTier, "free">;
export type BillingCycle = CatalogBillingCycle;

type PriceDefinition = {
  env: string;
  fallback: string;
  amount: number;
};

export const STRIPE_PRICES = Object.fromEntries(
  (["collector", "seller", "store"] as const).map((plan) => [
    plan,
    Object.fromEntries(
      (["monthly", "annual"] as const).map((billing) => {
        const mapping = MEMBERSHIP_PROVIDER_MAPPINGS.find(
          (entry: (typeof MEMBERSHIP_PROVIDER_MAPPINGS)[number]) =>
            entry.provider === "stripe" &&
            entry.tier === plan &&
            entry.billingCycle === billing,
        );
        if (!mapping?.envVar || !mapping.fallbackPriceId) {
          throw new Error(`Missing Stripe mapping for ${plan}:${billing}.`);
        }

        return [
          billing,
          {
            env: mapping.envVar,
            fallback: mapping.fallbackPriceId,
            amount:
              billing === "monthly"
                ? MEMBERSHIP_PLANS[plan].monthlyPrice
                : MEMBERSHIP_PLANS[plan].annualPrice,
          },
        ];
      }),
    ),
  ]),
) as Record<PaidPlan, Record<BillingCycle, PriceDefinition>>;

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "collector" || value === "seller" || value === "store";
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return value === "monthly" || value === "annual";
}

export function getPriceId(plan: PaidPlan, billing: BillingCycle) {
  const definition = STRIPE_PRICES[plan][billing];
  return process.env[definition.env] || definition.fallback;
}

export function planForPriceId(priceId: string) {
  for (const [plan, cycles] of Object.entries(STRIPE_PRICES)) {
    for (const [billing, definition] of Object.entries(cycles)) {
      if (
        priceId === process.env[definition.env] ||
        priceId === definition.fallback
      ) {
        return {
          plan: plan as PaidPlan,
          billing: billing as BillingCycle,
        };
      }
    }
  }
  return null;
}
