import assert from "node:assert/strict";
import test from "node:test";

import { resolveBillingAccessFromRows } from "../src/lib/platform/billing-access-resolution.ts";
import { resolvePlatformAccessContext } from "../mobile/services/platform-access.ts";
import { hasCapability } from "../mobile/services/platform-access.ts";

const NOW = new Date("2026-08-07T12:00:00.000Z");
const FUTURE = "2026-09-07T12:00:00.000Z";
const PAST = "2026-07-07T12:00:00.000Z";

function accessFromBilling(billing: ReturnType<typeof resolveBillingAccessFromRows>) {
  return resolvePlatformAccessContext({
    authenticated: true,
    accountType: "seller",
    workspaceId: "workspace-1",
    workspaceRole: "owner",
    billingPlan: billing.billingPlan,
    billingStatus: billing.billingStatus,
    billingPeriodEnd: billing.billingPeriodEnd,
    providerState: billing.providerState,
    now: NOW,
  });
}

test("server access uses RevenueCat provider state over stale canonical billing rows", async () => {
  const access = accessFromBilling(
    resolveBillingAccessFromRows({
      subscriptionError: null,
      subscriptionData: {
        plan_id: "store",
        status: "active",
        current_period_end: FUTURE,
      },
      providerRows: [
        {
          provider: "apple",
          plan_id: "store",
          status: "canceled",
          current_period_end: PAST,
          updated_at: PAST,
        },
      ],
      overridePlan: null,
      now: NOW,
    }),
  );

  assert.equal(access.membershipTier, "free");
  assert.equal(access.billingStatus, "free");
  assert.equal(access.providerState, "revenuecat");
  assert.equal(hasCapability(access, "orders.manage"), false);
});

test("server access keeps valid provider grace-period access", async () => {
  const access = accessFromBilling(
    resolveBillingAccessFromRows({
      subscriptionError: null,
      subscriptionData: {
        plan_id: "free",
        status: "free",
      },
      providerRows: [
        {
          provider: "google",
          plan_id: "seller",
          status: "past_due",
          current_period_end: FUTURE,
          updated_at: NOW.toISOString(),
        },
      ],
      overridePlan: null,
      now: NOW,
    }),
  );

  assert.equal(access.membershipTier, "seller");
  assert.equal(access.billingStatus, "past_due");
  assert.equal(hasCapability(access, "orders.manage"), true);
});

test("server access preserves manual override separate from provider and billing rows", async () => {
  const access = accessFromBilling(
    resolveBillingAccessFromRows({
      subscriptionError: null,
      subscriptionData: null,
      providerRows: [
        {
          provider: "apple",
          plan_id: "store",
          status: "canceled",
          current_period_end: PAST,
        },
      ],
      overridePlan: "seller",
      now: NOW,
    }),
  );

  assert.equal(access.membershipTier, "seller");
  assert.equal(access.providerState, "manual");
  assert.equal(hasCapability(access, "orders.manage"), true);
  assert.equal(hasCapability(access, "businessIntelligence.view"), false);
});

test("server access keeps legacy billing row as compatibility fallback without provider rows", async () => {
  const access = accessFromBilling(
    resolveBillingAccessFromRows({
      subscriptionError: null,
      subscriptionData: {
        plan_id: "collector",
        status: "active",
        current_period_end: FUTURE,
      },
      providerRows: [],
      overridePlan: null,
      now: NOW,
    }),
  );

  assert.equal(access.membershipTier, "collector");
  assert.equal(access.providerState, "unknown");
  assert.equal(hasCapability(access, "analytics.view"), true);
  assert.equal(hasCapability(access, "orders.manage"), false);
});
