import type { AccountTier } from "@/lib/plan-entitlements";

export type PaidPlan = Exclude<AccountTier, "free">;
export type BillingCycle = "monthly" | "annual";

type PriceDefinition = {
  env: string;
  fallback: string;
  amount: number;
};

export const STRIPE_PRICES: Record<
  PaidPlan,
  Record<BillingCycle, PriceDefinition>
> = {
  collector: {
    monthly: {
      env: "STRIPE_COLLECTOR_MONTHLY_PRICE_ID",
      fallback: "price_1TxvrLIU3P0Zz45XersDWqSc",
      amount: 4.99,
    },
    annual: {
      env: "STRIPE_COLLECTOR_ANNUAL_PRICE_ID",
      fallback: "price_1TxvvVIU3P0Zz45X6AQU2MyW",
      amount: 44.99,
    },
  },
  seller: {
    monthly: {
      env: "STRIPE_SELLER_MONTHLY_PRICE_ID",
      fallback: "price_1TxvujIU3P0Zz45XrSAiuGgS",
      amount: 19.99,
    },
    annual: {
      env: "STRIPE_SELLER_ANNUAL_PRICE_ID",
      fallback: "price_1TxvukIU3P0Zz45XDORx6qeH",
      amount: 179.99,
    },
  },
  business: {
    monthly: {
      env: "STRIPE_STORE_MONTHLY_PRICE_ID",
      fallback: "price_1TxvwWIU3P0Zz45Xn93kdlLP",
      amount: 49.99,
    },
    annual: {
      env: "STRIPE_STORE_ANNUAL_PRICE_ID",
      fallback: "price_1TxvwoIU3P0Zz45XaUB4cFCt",
      amount: 449.99,
    },
  },
};

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "collector" || value === "seller" || value === "business";
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
