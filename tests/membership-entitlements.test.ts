import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MEMBERSHIP_PLANS,
  annualSavings,
  hasMembershipEntitlement,
  normalizeMembershipTier,
} from "../mobile/services/membership-catalog.ts";
import { resolveAccess } from "../mobile/services/access-model.ts";

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

test("annual savings are calculated from monthly times twelve", () => {
  assert.equal(annualSavings("free"), 0);
  assert.equal(annualSavings("collector"), 9.89);
  assert.equal(annualSavings("seller"), 29.89);
  assert.equal(annualSavings("store"), 99.89);
});

test("card and deck limits follow the canonical catalog", () => {
  assert.equal(MEMBERSHIP_PLANS.free.limits.cardLimit, 500);
  assert.equal(MEMBERSHIP_PLANS.free.limits.deckLimit, 5);
  assert.equal(MEMBERSHIP_PLANS.collector.limits.cardLimit, null);
  assert.equal(MEMBERSHIP_PLANS.collector.limits.deckLimit, null);
  assert.equal(MEMBERSHIP_PLANS.seller.limits.cardLimit, null);
  assert.equal(MEMBERSHIP_PLANS.store.limits.cardLimit, null);
});

test("Collector includes financial collection access", () => {
  assert.equal(hasMembershipEntitlement("collector", "collection-value"), true);
  assert.equal(hasMembershipEntitlement("collector", "price-history"), true);
  assert.equal(hasMembershipEntitlement("collector", "financial-insights"), true);
});

test("Seller includes Deal Desk and web workspace access", () => {
  assert.equal(hasMembershipEntitlement("seller", "deal-desk"), true);
  assert.equal(hasMembershipEntitlement("seller", "web-workspace"), true);
});

test("Store includes employee entitlement without a hard-coded seat count", () => {
  assert.equal(hasMembershipEntitlement("store", "employee-accounts"), true);
  assert.deepEqual(MEMBERSHIP_PLANS.store.limits.employeeAccounts, {
    kind: "pending_configuration",
  });
});

test("trusted Owner receives full effective entitlements without changing billing membership", () => {
  const access = resolveAccess({
    userId: "owner-1",
    platformRole: "owner",
    platformRoleAuthority: "trusted",
    accountType: "store",
    billingPlan: "free",
    billingStatus: "free",
  });

  assert.equal(access.membershipTier, "free");
  assert.equal(access.entitlementKeys.includes("deal-desk"), true);
  assert.equal(access.entitlementKeys.includes("employee-accounts"), true);
  assert.equal(access.entitlementKeys.includes("admin.command-center"), true);
});

test("trusted Admin receives full effective entitlements without changing billing membership", () => {
  const access = resolveAccess({
    userId: "admin-1",
    platformRole: "admin",
    platformRoleAuthority: "trusted",
    accountType: "store",
    billingPlan: "free",
    billingStatus: "free",
  });

  assert.equal(access.membershipTier, "free");
  assert.equal(access.entitlementKeys.includes("deal-desk"), true);
  assert.equal(access.entitlementKeys.includes("employee-accounts"), true);
  assert.equal(access.entitlementKeys.includes("admin.command-center"), true);
});

test("suspended or canceled billing falls back to Free entitlements", () => {
  const canceled = resolveAccess({
    platformRole: "user",
    accountType: "seller",
    billingPlan: "seller",
    billingStatus: "canceled",
  });
  const suspended = resolveAccess({
    platformRole: "user",
    accountType: "store",
    billingPlan: "store",
    billingStatus: "suspended",
  });

  assert.equal(canceled.membershipTier, "free");
  assert.equal(canceled.entitlementKeys.includes("deal-desk"), false);
  assert.equal(suspended.membershipTier, "free");
  assert.equal(suspended.entitlementKeys.length, 0);
});

test("unknown membership tier falls back to Free while legacy business normalizes to Store", () => {
  assert.equal(normalizeMembershipTier("enterprise"), "free");
  assert.equal(normalizeMembershipTier("business"), "store");
});

test("public pricing uses canonical membership catalog and signup routes", () => {
  const source = readFileSync("src/components/landing/PricingSection.tsx", "utf8");

  assert.match(source, /MEMBERSHIP_PLANS/);
  assert.match(source, /`\/sign-up\?plan=\$\{tier\}`/);
  assert.doesNotMatch(source, /\/signup\?plan=/);
  assert.doesNotMatch(source, /price:\s*"\$(12|39|99)"/);
  assert.doesNotMatch(source, /decks:\s*"10"/);
});
