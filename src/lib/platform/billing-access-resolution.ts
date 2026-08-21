import {
  resolveEffectiveMembership,
  type ProviderSubscriptionEntitlement,
  type SubscriptionProvider,
} from "../revenuecat/reconciliation.ts";

export type BillingProviderState = "none" | "stripe" | "revenuecat" | "manual" | "mixed" | "unknown";

export type BillingAccessResolution = {
  billingPlan: string | null;
  billingStatus: string | null;
  billingPeriodEnd: string | null;
  providerState: BillingProviderState;
};

export function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function subscriptionProvider(value: unknown): SubscriptionProvider | null {
  const provider = stringValue(value);
  if (provider === "apple" || provider === "google" || provider === "stripe" || provider === "manual") {
    return provider;
  }
  return null;
}

export function providerEntitlementsFromRows(rows: Record<string, unknown>[] | null): ProviderSubscriptionEntitlement[] {
  const entitlements: ProviderSubscriptionEntitlement[] = [];
  for (const row of rows ?? []) {
    const provider = subscriptionProvider(row.provider);
    if (!provider) continue;
    entitlements.push({
      provider,
      planId: stringValue(row.plan_id),
      status: stringValue(row.status),
      currentPeriodEnd: stringValue(row.current_period_end),
      updatedAt: stringValue(row.updated_at),
    });
  }
  return entitlements;
}

function hasRevenueCatProviderEntitlement(rows: ProviderSubscriptionEntitlement[]) {
  return rows.some((row) => row.provider === "apple" || row.provider === "google");
}

export function providerStateFromRows({
  subscriptionError,
  subscriptionData,
  providerRows,
  overridePlan,
}: {
  subscriptionError: unknown;
  subscriptionData: Record<string, unknown> | null;
  providerRows: Record<string, unknown>[] | null;
  overridePlan: string | null;
}): BillingProviderState {
  if (overridePlan) return "manual";
  if (subscriptionError) return "unknown";
  const providerStates = new Set<"stripe" | "revenuecat">();
  for (const row of providerRows ?? []) {
    const provider = stringValue(row.provider);
    if (provider === "apple" || provider === "google") providerStates.add("revenuecat");
    if (provider === "stripe") providerStates.add("stripe");
  }
  if (
    stringValue(subscriptionData?.stripe_subscription_id) ||
    stringValue(subscriptionData?.stripe_customer_id)
  ) {
    providerStates.add("stripe");
  }
  if (providerStates.size > 1) return "mixed";
  if (providerStates.has("revenuecat")) return "revenuecat";
  if (providerStates.has("stripe")) return "stripe";
  if (!subscriptionData?.plan_id) return "none";
  return "unknown";
}

export function resolveBillingAccessFromRows({
  subscriptionError,
  subscriptionData,
  providerRows,
  overridePlan,
  now,
}: {
  subscriptionError: unknown;
  subscriptionData: Record<string, unknown> | null;
  providerRows: Record<string, unknown>[] | null;
  overridePlan: string | null;
  now?: Date;
}): BillingAccessResolution {
  const providerState = providerStateFromRows({
    subscriptionError,
    subscriptionData,
    providerRows,
    overridePlan,
  });
  const providerEntitlements = providerEntitlementsFromRows(providerRows);
  const providerResolution = resolveEffectiveMembership({
    providerEntitlements,
    manualOverride: overridePlan,
    now,
  });
  const useProviderResolution = Boolean(overridePlan || hasRevenueCatProviderEntitlement(providerEntitlements));

  return {
    providerState,
    billingPlan: useProviderResolution
      ? providerResolution.tier
      : providerState === "stripe"
        ? null
        : stringValue(subscriptionData?.plan_id),
    billingStatus: useProviderResolution
      ? providerResolution.status
      : providerState === "stripe"
        ? null
        : stringValue(subscriptionData?.status),
    billingPeriodEnd: useProviderResolution
      ? providerResolution.periodEnd
      : providerState === "stripe"
        ? null
        : stringValue(subscriptionData?.current_period_end),
  };
}
