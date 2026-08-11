import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildRevenueCatWebPurchaseUrl,
  revenueCatPackageIdFor,
  revenueCatWebManagementUrlFor,
  revenueCatWebPurchaseUrlFor,
} from "../src/lib/revenuecat/web-billing.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("RevenueCat web purchase links include Supabase app user identity and package", () => {
  const url = new URL(buildRevenueCatWebPurchaseUrl({
    baseUrl: "https://pay.rev.cat/trading-docks",
    input: {
      plan: "seller",
      billing: "annual",
      appUserId: "11111111-1111-4111-8111-111111111111",
      email: "owner@example.com",
      returnUrl: "https://www.tradingdocks.com/dashboard/settings",
    },
  }));

  assert.equal(url.searchParams.get("app_user_id"), "11111111-1111-4111-8111-111111111111");
  assert.equal(url.searchParams.get("package_id"), "seller_yearly");
  assert.equal(url.searchParams.get("email"), "owner@example.com");
  assert.equal(url.searchParams.get("return_url"), "https://www.tradingdocks.com/dashboard/settings");
});

test("RevenueCat package ids cover every paid web plan and billing cycle", () => {
  assert.equal(revenueCatPackageIdFor("collector", "monthly"), "collector_monthly");
  assert.equal(revenueCatPackageIdFor("collector", "annual"), "collector_yearly");
  assert.equal(revenueCatPackageIdFor("seller", "monthly"), "seller_monthly");
  assert.equal(revenueCatPackageIdFor("seller", "annual"), "seller_yearly");
  assert.equal(revenueCatPackageIdFor("store", "monthly"), "store_monthly");
  assert.equal(revenueCatPackageIdFor("store", "annual"), "store_yearly");
});

test("RevenueCat web billing supports shared and per-package purchase links", () => {
  assert.equal(
    revenueCatWebPurchaseUrlFor({
      plan: "collector",
      billing: "monthly",
      appUserId: "user-1",
    }, {
      REVENUECAT_WEB_PURCHASE_LINK: "https://pay.rev.cat/shared",
    }),
    "https://pay.rev.cat/shared?app_user_id=user-1&package_id=collector_monthly",
  );

  assert.equal(
    revenueCatWebPurchaseUrlFor({
      plan: "store",
      billing: "annual",
      appUserId: "user-2",
    }, {
      REVENUECAT_WEB_PURCHASE_LINK: "https://pay.rev.cat/shared",
      REVENUECAT_WEB_STORE_YEARLY_URL: "https://pay.rev.cat/store-yearly",
    }),
    "https://pay.rev.cat/store-yearly?app_user_id=user-2&package_id=store_yearly",
  );
});

test("RevenueCat customer management link includes app user identity", () => {
  assert.equal(
    revenueCatWebManagementUrlFor({
      appUserId: "user-3",
      email: "admin@example.com",
      env: {
        REVENUECAT_WEB_CUSTOMER_PORTAL_URL: "https://customers.rev.cat/trading-docks",
      },
    }),
    "https://customers.rev.cat/trading-docks?app_user_id=user-3&email=admin%40example.com",
  );
});

test("direct Stripe membership billing routes and package dependency are retired", () => {
  assert.equal(existsSync(path.join(repoRoot, "src/app/api/billing/checkout/route.ts")), false);
  assert.equal(existsSync(path.join(repoRoot, "src/app/api/billing/portal/route.ts")), false);
  assert.equal(existsSync(path.join(repoRoot, "src/app/api/billing/webhook/route.ts")), false);
  assert.equal(existsSync(path.join(repoRoot, "src/lib/stripe/server.ts")), false);
  assert.equal(existsSync(path.join(repoRoot, "src/lib/stripe/plans.ts")), false);

  const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  assert.equal(pkg.dependencies?.stripe, undefined);
  assert.equal(pkg.devDependencies?.stripe, undefined);
});
