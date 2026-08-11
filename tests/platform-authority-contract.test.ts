import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEMBERSHIP_PLANS,
  MEMBERSHIP_PROVIDER_MAPPINGS,
  MEMBERSHIP_TIER_ORDER,
  normalizeAccountType,
  normalizeMembershipTier,
  type MembershipTier,
} from "../mobile/services/membership-catalog.ts";
import {
  REVENUECAT_PACKAGE_CATALOG,
  REVENUECAT_PRODUCT_IDS,
  packageIdentifierFor,
} from "../mobile/services/revenuecat.ts";
import * as webMembershipCatalog from "../src/lib/membership-catalog.ts";
import {
  REVENUECAT_PRODUCT_MAPPINGS,
  resolveEffectiveMembership,
} from "../src/lib/revenuecat/reconciliation.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalTiers: MembershipTier[] = ["free", "collector", "seller", "store"];

test("web and mobile consume one canonical membership catalog", () => {
  assert.deepEqual(Object.keys(MEMBERSHIP_PLANS), canonicalTiers);
  assert.deepEqual(Object.keys(webMembershipCatalog.MEMBERSHIP_PLANS), canonicalTiers);
  assert.strictEqual(webMembershipCatalog.MEMBERSHIP_PLANS, MEMBERSHIP_PLANS);
  assert.deepEqual(webMembershipCatalog.MEMBERSHIP_TIER_ORDER, MEMBERSHIP_TIER_ORDER);

  const webCatalogSource = readFileSync(path.join(repoRoot, "src/lib/membership-catalog.ts"), "utf8");
  assert.equal(/export\s+const\s+MEMBERSHIP_PLANS/.test(webCatalogSource), false);
  assert.equal(/collector_monthly|seller_monthly|store_monthly/.test(webCatalogSource), false);
});

test("business remains only a legacy alias for store", () => {
  assert.equal(normalizeMembershipTier("business"), "store");
  assert.equal(normalizeAccountType("business"), "store");
  assert.equal(normalizeMembershipTier("store"), "store");
  assert.equal(normalizeAccountType("store"), "store");
  assert.equal(normalizeMembershipTier("enterprise"), "free");
});

test("provider mappings reference only canonical membership tiers", () => {
  for (const mapping of MEMBERSHIP_PROVIDER_MAPPINGS) {
    assert.equal(canonicalTiers.includes(mapping.tier), true, `${mapping.provider} ${mapping.productId}`);
    assert.equal(mapping.provider, "revenuecat");
    assert.notEqual(mapping.tier, "business");
  }
});

test("RevenueCat mobile package identifiers match server reconciliation product mappings", () => {
  for (const [packageId, entry] of Object.entries(REVENUECAT_PACKAGE_CATALOG)) {
    const productId = REVENUECAT_PRODUCT_IDS[packageId as keyof typeof REVENUECAT_PRODUCT_IDS];
    const serverMapping = REVENUECAT_PRODUCT_MAPPINGS[productId];

    assert.equal(packageIdentifierFor(entry.tier, entry.cycle), packageId);
    assert.ok(serverMapping, `missing server mapping for ${productId}`);
    assert.equal(serverMapping.productId, productId);
    assert.equal(serverMapping.tier, entry.tier);
    assert.equal(serverMapping.billingCycle, entry.cycle === "yearly" ? "annual" : "monthly");
    assert.equal(serverMapping.provider, "apple");
  }

  assert.deepEqual(Object.values(REVENUECAT_PRODUCT_IDS).sort(), Object.keys(REVENUECAT_PRODUCT_MAPPINGS).sort());
});

test("route access matrix references only canonical membership tiers", () => {
  const routeMatrix = readFileSync(path.join(repoRoot, "docs/PLATFORM_ROUTE_ACCESS_MATRIX.md"), "utf8");
  const dashboardRows = routeMatrix
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| `/dashboard"));

  assert.ok(dashboardRows.length > 0, "expected dashboard route rows in the route access matrix");

  for (const row of dashboardRows) {
    const cells = row.split("|").map((cell) => cell.trim());
    const minimumMembership = cells[2];
    if (minimumMembership.startsWith("Role:")) continue;

    for (const token of minimumMembership.split("/")) {
      const normalized = token.replace("+", "").toLowerCase();
      assert.equal(canonicalTiers.includes(normalized as MembershipTier), true, `${minimumMembership} in ${row}`);
    }
  }
});

test("server billing resolution keeps manual override explicit and provider precedence deterministic", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");

  assert.deepEqual(
    resolveEffectiveMembership({
      now,
      manualOverride: "collector",
      providerEntitlements: [
        { provider: "apple", planId: "store", status: "active", currentPeriodEnd: "2026-09-01T00:00:00.000Z" },
      ],
    }),
    { tier: "collector", status: "active", source: "manual", periodEnd: null },
  );

  assert.deepEqual(
    resolveEffectiveMembership({
      now,
      providerEntitlements: [
        { provider: "stripe", planId: "seller", status: "active", currentPeriodEnd: "2026-09-01T00:00:00.000Z" },
        { provider: "apple", planId: "collector", status: "canceled", currentPeriodEnd: "2026-07-01T00:00:00.000Z" },
      ],
    }),
    { tier: "free", status: "free", source: "free", periodEnd: null },
  );

  assert.deepEqual(
    resolveEffectiveMembership({
      now,
      providerEntitlements: [
        { provider: "stripe", planId: "seller", status: "active", currentPeriodEnd: "2026-09-01T00:00:00.000Z" },
        { provider: "apple", planId: "store", status: "active", currentPeriodEnd: "2026-08-20T00:00:00.000Z" },
      ],
    }),
    { tier: "store", status: "active", source: "apple", periodEnd: "2026-08-20T00:00:00.000Z" },
  );
});

test("web and mobile access loaders read provider subscriptions instead of assuming Stripe", () => {
  const serverAccess = readFileSync(path.join(repoRoot, "src/lib/platform/server-access.ts"), "utf8");
  const mobileAccess = readFileSync(path.join(repoRoot, "mobile/services/mobile-account-access.ts"), "utf8");

  assert.match(serverAccess, /billing_provider_subscriptions/);
  assert.match(serverAccess, /stripe_subscription_id/);
  assert.match(serverAccess, /providerStates\.has\("revenuecat"\)/);
  assert.match(serverAccess, /providerState === "stripe" \? null/);
  assert.doesNotMatch(serverAccess, /return "stripe" as const;\s*\n}/);

  assert.match(mobileAccess, /billing_provider_subscriptions/);
  assert.match(mobileAccess, /stripe_subscription_id/);
  assert.match(mobileAccess, /provider === 'stripe' \? null/);
  assert.doesNotMatch(mobileAccess, /plan_id,status,current_period_end,provider/);
});
