import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRevenueCatWebhook,
  planMappingForRevenueCatProduct,
  providerStateFromRevenueCatEvent,
  resolveCommercialEntitlement,
  resolveEffectiveMembership,
  shouldApplyProviderStateUpdate,
  verifyRevenueCatAuthorization,
} from "../src/lib/revenuecat/reconciliation.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-08-07T12:00:00.000Z");
const FUTURE = "2026-09-07T12:00:00.000Z";
const PAST = "2026-07-07T12:00:00.000Z";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      id: "event-1",
      type: "INITIAL_PURCHASE",
      app_user_id: USER_ID,
      product_id: "tradingdocks.collector.monthly",
      store: "APP_STORE",
      transaction_id: "tx-1",
      original_transaction_id: "sub-1",
      purchased_at_ms: Date.parse("2026-08-07T11:00:00.000Z"),
      expiration_at_ms: Date.parse(FUTURE),
      environment: "SANDBOX",
      will_renew: true,
      ...overrides,
    },
  };
}

test("authorized RevenueCat webhook accepts exact or bearer authorization", () => {
  assert.equal(verifyRevenueCatAuthorization("secret-value", "secret-value"), true);
  assert.equal(verifyRevenueCatAuthorization("Bearer secret-value", "secret-value"), true);
  assert.equal(verifyRevenueCatAuthorization("wrong", "secret-value"), false);
  assert.equal(verifyRevenueCatAuthorization(null, "secret-value"), false);
});

test("RevenueCat TEST event normalizes without a real Supabase user", () => {
  const event = normalizeRevenueCatWebhook({ event: { id: "test-1", type: "TEST" } });

  assert.ok(event);
  assert.equal(event.type, "TEST");
  assert.equal(event.appUserId, "revenuecat-test");
});

test("malformed RevenueCat event is rejected by normalization", () => {
  assert.equal(normalizeRevenueCatWebhook({}), null);
  assert.equal(normalizeRevenueCatWebhook(payload({ id: "" })), null);
  assert.equal(normalizeRevenueCatWebhook(payload({ app_user_id: "" })), null);
});

test("RevenueCat product mapping covers Collector, Seller, and Store", () => {
  assert.equal(planMappingForRevenueCatProduct("tradingdocks.collector.monthly")?.tier, "collector");
  assert.equal(planMappingForRevenueCatProduct("tradingdocks.collector.yearly")?.billingCycle, "annual");
  assert.equal(planMappingForRevenueCatProduct("tradingdocks.seller.monthly")?.tier, "seller");
  assert.equal(planMappingForRevenueCatProduct("tradingdocks.seller.yearly")?.billingCycle, "annual");
  assert.equal(planMappingForRevenueCatProduct("tradingdocks.store.monthly")?.tier, "store");
  assert.equal(planMappingForRevenueCatProduct("tradingdocks.store.yearly")?.billingCycle, "annual");
  assert.equal(planMappingForRevenueCatProduct("unknown.product"), null);
});

test("RevenueCat commercial entitlement resolver maps active entitlements to canonical tiers", () => {
  assert.deepEqual(resolveCommercialEntitlement({ revenueCatEntitlements: [] }), {
    tier: "free",
    source: "free",
    activeEntitlements: [],
  });
  assert.deepEqual(resolveCommercialEntitlement({ revenueCatEntitlements: ["Collector"] }), {
    tier: "collector",
    source: "revenuecat",
    activeEntitlements: ["Collector"],
  });
  assert.deepEqual(resolveCommercialEntitlement({ revenueCatEntitlements: ["Collector", "Seller", "Store"] }), {
    tier: "store",
    source: "revenuecat",
    activeEntitlements: ["Collector", "Seller", "Store"],
  });
  assert.deepEqual(resolveCommercialEntitlement({ revenueCatEntitlements: ["collector", "unknown"] }), {
    tier: "free",
    source: "free",
    activeEntitlements: [],
  });
});

test("purchase, renewal, product change, cancellation, expiration, and billing issue are classified", () => {
  for (const type of ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"]) {
    const event = normalizeRevenueCatWebhook(payload({ id: `event-${type}`, type }));
    assert.ok(event);
    assert.equal(providerStateFromRevenueCatEvent(event, NOW)?.status, "active");
  }

  const seller = normalizeRevenueCatWebhook(payload({
    type: "PRODUCT_CHANGE",
    product_id: "tradingdocks.seller.monthly",
  }));
  const store = normalizeRevenueCatWebhook(payload({
    type: "PRODUCT_CHANGE",
    product_id: "tradingdocks.store.yearly",
  }));
  const canceled = normalizeRevenueCatWebhook(payload({
    type: "CANCELLATION",
    expiration_at_ms: Date.parse(FUTURE),
    will_renew: false,
  }));
  const expired = normalizeRevenueCatWebhook(payload({
    type: "EXPIRATION",
    expiration_at_ms: Date.parse(PAST),
  }));
  const billingIssue = normalizeRevenueCatWebhook(payload({
    type: "BILLING_ISSUE",
    expiration_at_ms: Date.parse(FUTURE),
  }));

  assert.ok(seller);
  assert.ok(store);
  assert.ok(canceled);
  assert.ok(expired);
  assert.ok(billingIssue);
  assert.equal(providerStateFromRevenueCatEvent(seller, NOW)?.planId, "seller");
  assert.equal(providerStateFromRevenueCatEvent(store, NOW)?.planId, "store");
  assert.equal(providerStateFromRevenueCatEvent(canceled, NOW)?.status, "active");
  assert.equal(providerStateFromRevenueCatEvent(canceled, NOW)?.cancelAtPeriodEnd, true);
  assert.equal(providerStateFromRevenueCatEvent(expired, NOW)?.status, "canceled");
  assert.equal(providerStateFromRevenueCatEvent(billingIssue, NOW)?.status, "past_due");
});

test("missing app_user_id, invalid user id, or missing product prevents actionable provider state", () => {
  assert.equal(normalizeRevenueCatWebhook(payload({ app_user_id: null })), null);

  const invalidUser = normalizeRevenueCatWebhook(payload({ app_user_id: "not-a-uuid" }));
  const missingProduct = normalizeRevenueCatWebhook(payload({ product_id: null }));

  assert.ok(invalidUser);
  assert.ok(missingProduct);
  assert.equal(providerStateFromRevenueCatEvent(invalidUser, NOW), null);
  assert.equal(providerStateFromRevenueCatEvent(missingProduct, NOW), null);
});

test("legacy Stripe metadata no longer grants commercial membership", () => {
  const resolution = resolveEffectiveMembership({
    now: NOW,
    providerEntitlements: [
      { provider: "stripe", planId: "seller", status: "active", currentPeriodEnd: FUTURE },
    ],
  });

  assert.equal(resolution.tier, "free");
  assert.equal(resolution.source, "free");
});

test("legacy Stripe metadata does not downgrade an active Apple Store entitlement", () => {
  const resolution = resolveEffectiveMembership({
    now: NOW,
    providerEntitlements: [
      { provider: "stripe", planId: "business", status: "canceled", currentPeriodEnd: PAST },
      { provider: "apple", planId: "store", status: "active", currentPeriodEnd: FUTURE },
    ],
  });

  assert.equal(resolution.tier, "store");
  assert.equal(resolution.source, "apple");
});

test("manual admin override takes precedence and no valid provider resolves to Free", () => {
  const override = resolveEffectiveMembership({
    now: NOW,
    manualOverride: "collector",
    providerEntitlements: [
      { provider: "apple", planId: "store", status: "active", currentPeriodEnd: FUTURE },
    ],
  });
  const free = resolveEffectiveMembership({
    now: NOW,
    providerEntitlements: [
      { provider: "apple", planId: "collector", status: "canceled", currentPeriodEnd: PAST },
      { provider: "stripe", planId: "seller", status: "active", currentPeriodEnd: FUTURE },
    ],
  });

  assert.equal(override.tier, "collector");
  assert.equal(override.source, "manual");
  assert.equal(free.tier, "free");
  assert.equal(free.status, "free");
});

test("expired, unpaid, incomplete, incomplete_expired, and paused providers do not grant access", () => {
  for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
    const resolution = resolveEffectiveMembership({
      now: NOW,
      providerEntitlements: [
        {
          provider: "apple",
          planId: "store",
          status,
          currentPeriodEnd: status === "canceled" ? PAST : FUTURE,
        },
      ],
    });

    assert.equal(resolution.tier, "free", status);
    assert.equal(resolution.source, "free", status);
  }
});

test("past-due and canceled providers remain valid only through the current paid period", () => {
  const pastDue = resolveEffectiveMembership({
    now: NOW,
    providerEntitlements: [
      { provider: "apple", planId: "seller", status: "past_due", currentPeriodEnd: FUTURE },
    ],
  });
  const canceledGrace = resolveEffectiveMembership({
    now: NOW,
    providerEntitlements: [
      { provider: "google", planId: "collector", status: "canceled", currentPeriodEnd: FUTURE },
    ],
  });

  assert.equal(pastDue.tier, "seller");
  assert.equal(pastDue.status, "past_due");
  assert.equal(canceledGrace.tier, "collector");
  assert.equal(canceledGrace.status, "active");
});

test("provider state updates do not overwrite newer subscription periods with stale events", () => {
  assert.equal(
    shouldApplyProviderStateUpdate({
      existing: { planId: "store", status: "active", currentPeriodEnd: FUTURE },
      incoming: { planId: "store", status: "canceled", currentPeriodEnd: PAST },
    }),
    false,
  );
  assert.equal(
    shouldApplyProviderStateUpdate({
      existing: { planId: "seller", status: "active", currentPeriodEnd: PAST },
      incoming: { planId: "store", status: "active", currentPeriodEnd: FUTURE },
    }),
    true,
  );
  assert.equal(
    shouldApplyProviderStateUpdate({
      existing: { planId: "store", status: "active", currentPeriodEnd: FUTURE },
      incoming: { planId: "store", status: "active", currentPeriodEnd: FUTURE },
    }),
    true,
  );
});
