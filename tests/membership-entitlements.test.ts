import assert from "node:assert/strict";
import test from "node:test";

import {
  MEMBERSHIP_PLANS,
  annualSavings,
  hasMembershipEntitlement,
  normalizeMembershipTier,
} from "../src/lib/membership-catalog.ts";

test("canonical membership prices match product-owner catalog", () => {
  assert.equal(MEMBERSHIP_PLANS.free.monthlyPrice, 0);
  assert.equal(MEMBERSHIP_PLANS.free.annualPrice, 0);
  assert.equal(MEMBERSHIP_PLANS.collector.monthlyPrice, 4.99);
  assert.equal(MEMBERSHIP_PLANS.collector.annualPrice, 49.99);
  assert.equal(MEMBERSHIP_PLANS.seller.monthlyPrice, 14.99);
  assert.equal(MEMBERSHIP_PLANS.seller.annualPrice, 149.99);
  assert.equal(MEMBERSHIP_PLANS.store.monthlyPrice, 49.99);
  assert.equal(MEMBERSHIP_PLANS.store.annualPrice, 499.99);
});

test("annual savings and limits follow the canonical catalog", () => {
  assert.equal(annualSavings("collector"), 9.89);
  assert.equal(annualSavings("seller"), 29.89);
  assert.equal(annualSavings("store"), 99.89);
  assert.equal(MEMBERSHIP_PLANS.free.limits.cardLimit, 500);
  assert.equal(MEMBERSHIP_PLANS.free.limits.deckLimit, 5);
  assert.equal(MEMBERSHIP_PLANS.store.limits.employeeAccounts.kind, "pending_configuration");
});

test("paid entitlements remain tier-specific", () => {
  assert.equal(hasMembershipEntitlement("collector", "financial-insights"), true);
  assert.equal(hasMembershipEntitlement("seller", "deal-desk"), true);
  assert.equal(hasMembershipEntitlement("seller", "web-workspace"), true);
  assert.equal(hasMembershipEntitlement("store", "employee-accounts"), true);
  assert.equal(hasMembershipEntitlement("free", "deal-desk"), false);
});

test("legacy business input normalizes to Store while unknown values fall back to Free", () => {
  assert.equal(normalizeMembershipTier("business"), "store");
  assert.equal(normalizeMembershipTier("enterprise"), "free");
});
