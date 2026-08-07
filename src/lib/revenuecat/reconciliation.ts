import {
  MEMBERSHIP_TIER_ORDER,
  normalizeMembershipTier,
  type BillingCycle,
  type BillingStatus,
  type MembershipTier,
} from "../membership-catalog.ts";

export type RevenueCatEventType =
  | "TEST"
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "PRODUCT_CHANGE"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "UNKNOWN";

export type RevenueCatProvider = "apple" | "google";
export type SubscriptionProvider = RevenueCatProvider | "stripe" | "manual";

export type RevenueCatPlanMapping = {
  productId: string;
  tier: Exclude<MembershipTier, "free">;
  billingCycle: BillingCycle;
  provider: RevenueCatProvider;
};

export type NormalizedRevenueCatEvent = {
  eventId: string;
  type: RevenueCatEventType;
  rawType: string;
  appUserId: string;
  productId: string | null;
  provider: RevenueCatProvider;
  providerSubscriptionId: string | null;
  providerTransactionId: string | null;
  purchasedAt: string | null;
  expiresAt: string | null;
  environment: string | null;
  willRenew: boolean | null;
};

export type ProviderSubscriptionEntitlement = {
  provider: SubscriptionProvider;
  planId: string | null | undefined;
  status: string | null | undefined;
  currentPeriodEnd?: string | null;
  updatedAt?: string | null;
};

export type EffectiveMembershipResolution = {
  tier: MembershipTier;
  status: BillingStatus;
  source: SubscriptionProvider | "free";
  periodEnd: string | null;
};

export type RevenueCatProviderState = {
  userId: string;
  provider: RevenueCatProvider;
  providerCustomerId: string;
  providerSubscriptionId: string;
  providerTransactionId: string | null;
  productId: string;
  planId: Exclude<MembershipTier, "free">;
  billingCycle: BillingCycle;
  status: BillingStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  environment: string | null;
  rawEventType: string;
};

export const REVENUECAT_PRODUCT_MAPPINGS: Record<string, RevenueCatPlanMapping> = {
  "tradingdocks.collector.monthly": {
    productId: "tradingdocks.collector.monthly",
    tier: "collector",
    billingCycle: "monthly",
    provider: "apple",
  },
  "tradingdocks.collector.yearly": {
    productId: "tradingdocks.collector.yearly",
    tier: "collector",
    billingCycle: "annual",
    provider: "apple",
  },
  "tradingdocks.seller.monthly": {
    productId: "tradingdocks.seller.monthly",
    tier: "seller",
    billingCycle: "monthly",
    provider: "apple",
  },
  "tradingdocks.seller.yearly": {
    productId: "tradingdocks.seller.yearly",
    tier: "seller",
    billingCycle: "annual",
    provider: "apple",
  },
  "tradingdocks.store.monthly": {
    productId: "tradingdocks.store.monthly",
    tier: "store",
    billingCycle: "monthly",
    provider: "apple",
  },
  "tradingdocks.store.yearly": {
    productId: "tradingdocks.store.yearly",
    tier: "store",
    billingCycle: "annual",
    provider: "apple",
  },
};

const KNOWN_EVENT_TYPES = new Set<RevenueCatEventType>([
  "INITIAL_PURCHASE",
  "TEST",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "CANCELLATION",
  "UNCANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
]);

export function verifyRevenueCatAuthorization(header: string | null, expectedSecret: string | undefined) {
  if (!header || !expectedSecret) return false;
  const supplied = header.replace(/^Bearer\s+/i, "").trim();
  const expected = expectedSecret.trim();
  if (!supplied || !expected || supplied.length !== expected.length) return false;

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return mismatch === 0;
}

export function isSupabaseUserId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function dateFromMillis(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value).toISOString()
    : null;
}

function eventRecord(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const outer = payload as Record<string, unknown>;
  const event = outer.event;
  return event && typeof event === "object" && !Array.isArray(event)
    ? event as Record<string, unknown>
    : null;
}

export function normalizeRevenueCatWebhook(payload: unknown): NormalizedRevenueCatEvent | null {
  const event = eventRecord(payload);
  if (!event) return null;

  const rawType = stringValue(event.type);
  const appUserId = stringValue(event.app_user_id);
  const eventId = stringValue(event.id);
  const productId = stringValue(event.product_id);
  const store = stringValue(event.store)?.toLowerCase();
  const provider: RevenueCatProvider = store === "play_store" || store === "google_play"
    ? "google"
    : "apple";

  if (!rawType || !eventId) return null;
  if (!appUserId && rawType !== "TEST") return null;

  return {
    eventId,
    type: KNOWN_EVENT_TYPES.has(rawType as RevenueCatEventType)
      ? rawType as RevenueCatEventType
      : "UNKNOWN",
    rawType,
    appUserId: appUserId ?? "revenuecat-test",
    productId,
    provider,
    providerSubscriptionId:
      stringValue(event.original_transaction_id) ??
      stringValue(event.transaction_id) ??
      stringValue(event.subscription_id),
    providerTransactionId: stringValue(event.transaction_id),
    purchasedAt: dateFromMillis(event.purchased_at_ms),
    expiresAt: dateFromMillis(event.expiration_at_ms),
    environment: stringValue(event.environment),
    willRenew: booleanValue(event.will_renew),
  };
}

export function planMappingForRevenueCatProduct(productId: string | null | undefined) {
  return productId ? REVENUECAT_PRODUCT_MAPPINGS[productId] ?? null : null;
}

export function providerStateFromRevenueCatEvent(
  event: NormalizedRevenueCatEvent,
  now = new Date(),
): RevenueCatProviderState | null {
  const mapping = planMappingForRevenueCatProduct(event.productId);
  if (!mapping || !event.providerSubscriptionId || !isSupabaseUserId(event.appUserId)) return null;

  const expiresAt = event.expiresAt;
  const hasFutureAccess = expiresAt ? new Date(expiresAt).getTime() > now.getTime() : true;
  const status: BillingStatus =
    event.type === "EXPIRATION"
      ? "canceled"
      : event.type === "BILLING_ISSUE"
        ? "past_due"
        : event.type === "CANCELLATION" && !hasFutureAccess
          ? "canceled"
          : "active";

  return {
    userId: event.appUserId,
    provider: event.provider,
    providerCustomerId: event.appUserId,
    providerSubscriptionId: event.providerSubscriptionId,
    providerTransactionId: event.providerTransactionId,
    productId: mapping.productId,
    planId: mapping.tier,
    billingCycle: mapping.billingCycle,
    status,
    currentPeriodStart: event.purchasedAt,
    currentPeriodEnd: event.expiresAt,
    cancelAtPeriodEnd: event.type === "CANCELLATION" || event.willRenew === false,
    environment: event.environment,
    rawEventType: event.rawType,
  };
}

export function providerEntitlementIsValid(
  entitlement: ProviderSubscriptionEntitlement,
  now = new Date(),
) {
  const status = entitlement.status;
  if (status === "active" || status === "trialing") return true;
  if ((status === "past_due" || status === "canceled") && entitlement.currentPeriodEnd) {
    return new Date(entitlement.currentPeriodEnd).getTime() > now.getTime();
  }
  return false;
}

export function resolveEffectiveMembership({
  providerEntitlements,
  manualOverride,
  now = new Date(),
}: {
  providerEntitlements: ProviderSubscriptionEntitlement[];
  manualOverride?: string | null;
  now?: Date;
}): EffectiveMembershipResolution {
  if (manualOverride) {
    return {
      tier: normalizeMembershipTier(manualOverride),
      status: "active",
      source: "manual",
      periodEnd: null,
    };
  }

  const valid = providerEntitlements
    .filter((entry) => providerEntitlementIsValid(entry, now))
    .map((entry) => ({
      ...entry,
      tier: normalizeMembershipTier(entry.planId),
    }))
    .filter((entry) => entry.tier !== "free")
    .sort((left, right) => {
      const tierDelta = MEMBERSHIP_TIER_ORDER[right.tier] - MEMBERSHIP_TIER_ORDER[left.tier];
      if (tierDelta !== 0) return tierDelta;
      return new Date(right.currentPeriodEnd ?? right.updatedAt ?? 0).getTime() -
        new Date(left.currentPeriodEnd ?? left.updatedAt ?? 0).getTime();
    });

  const winner = valid[0];
  if (!winner) {
    return { tier: "free", status: "free", source: "free", periodEnd: null };
  }

  return {
    tier: winner.tier,
    status: winner.status === "past_due" ? "past_due" : "active",
    source: winner.provider,
    periodEnd: winner.currentPeriodEnd ?? null,
  };
}
