import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  REVENUECAT_PACKAGE_CATALOG,
  REVENUECAT_PRODUCT_IDS,
  billingCycleToRevenueCatCycle,
  buildRevenueCatBackendSyncContract,
  mapRevenueCatEntitlementsToTier,
  packageCatalogEntry,
  packageIdentifierFor,
  revenueCatBackendSyncMessage,
  revenueCatCtaLabel,
  revenueCatPurchaseIntent,
  revenueCatUserMessage,
  summarizeRevenueCatCurrentMembership,
  summarizeRevenueCatSelection,
  type RevenueCatCatalogPlan,
  type RevenueCatCustomerSnapshot,
  type RevenueCatEntitlementIdentifier,
  type RevenueCatPurchaseCycle,
  type RevenueCatPurchasePlan,
  type RevenueCatPurchaseResult,
} from '../services/revenuecat.ts';

const root = process.cwd();

test('Supabase UUID is the RevenueCat appUserID after auth restoration', () => {
  const auth = readFileSync(join(root, 'providers', 'auth.tsx'), 'utf8');

  assert.match(auth, /configureRevenueCatForUser\(restored\.session\.user\.id\)/);
  assert.match(auth, /configureRevenueCatForUser\(next\.user\.id\)/);
  assert.doesNotMatch(auth, /configureRevenueCatForUser\(.*email/);
});

test('RevenueCat logout runs on sign-out or missing restored session', () => {
  const auth = readFileSync(join(root, 'providers', 'auth.tsx'), 'utf8');

  assert.match(auth, /logOutRevenueCatUser\(\)/);
  assert.match(auth, /event === 'SIGNED_OUT'/);
});

test('RevenueCat entitlements map to canonical memberships with Store precedence', () => {
  assert.equal(mapRevenueCatEntitlementsToTier([]), 'free');
  assert.equal(mapRevenueCatEntitlementsToTier(['Collector']), 'collector');
  assert.equal(mapRevenueCatEntitlementsToTier(['Seller']), 'seller');
  assert.equal(mapRevenueCatEntitlementsToTier(['Store']), 'store');
  assert.equal(mapRevenueCatEntitlementsToTier(['Collector', 'Seller', 'Store']), 'store');
  assert.equal(mapRevenueCatEntitlementsToTier(['collector', 'Unknown']), 'free');
});

test('RevenueCat package and product mappings match the approved catalog', () => {
  assert.equal(packageIdentifierFor('collector', 'monthly'), 'collector_monthly');
  assert.equal(packageIdentifierFor('seller', 'yearly'), 'seller_yearly');
  assert.equal(billingCycleToRevenueCatCycle('annual'), 'yearly');
  assert.equal(REVENUECAT_PRODUCT_IDS.collector_monthly, 'tradingdocks.collector.monthly');
  assert.equal(REVENUECAT_PRODUCT_IDS.collector_yearly, 'tradingdocks.collector.yearly');
  assert.equal(REVENUECAT_PRODUCT_IDS.seller_monthly, 'tradingdocks.seller.monthly');
  assert.equal(REVENUECAT_PRODUCT_IDS.seller_yearly, 'tradingdocks.seller.yearly');
  assert.equal(REVENUECAT_PRODUCT_IDS.store_monthly, 'tradingdocks.store.monthly');
  assert.equal(REVENUECAT_PRODUCT_IDS.store_yearly, 'tradingdocks.store.yearly');
  assert.deepEqual(packageCatalogEntry('store_yearly'), REVENUECAT_PACKAGE_CATALOG.store_yearly);
});

test('Plans screen uses RevenueCat localized pricing and restore purchases', () => {
  const plans = readFileSync(join(root, 'app', 'plans.tsx'), 'utf8');

  assert.match(plans, /summarizeRevenueCatSelection/);
  assert.match(plans, /Restore Purchases/);
  assert.match(plans, /purchaseRevenueCatPackage/);
  assert.match(plans, /restoreRevenueCatPurchases/);
  assert.match(plans, /Manage on web/);
  assert.match(plans, /Subscription renews automatically unless cancelled/);
  assert.doesNotMatch(plans, /six independent product cards/i);
  assert.doesNotMatch(plans, /\$4\.99|\$14\.99|\$49\.99|\$49\.99|\$149\.99|\$499\.99/);
});

test('RevenueCat provider state cannot escalate canonical access client-side', () => {
  const contract = buildRevenueCatBackendSyncContract('user-123', {
    activeTier: 'store',
    activeEntitlements: ['Store'],
    originalAppUserId: 'user-123',
    managementUrl: null,
  });
  const plans = readFileSync(join(root, 'app', 'plans.tsx'), 'utf8');

  assert.equal(contract.clientMayGrantEntitlements, false);
  assert.equal(contract.requiresWebhookReconciliation, true);
  assert.match(plans, /Trading Docks backend membership remains the authority/);
  assert.doesNotMatch(plans, /setAccountType\(.*snapshot|setAccountType\(.*providerTier/);
});

test('Stripe and Apple subscriber compatibility is documented in the mobile UI', () => {
  const plans = readFileSync(join(root, 'app', 'plans.tsx'), 'utf8');

  assert.match(plans, /Stripe subscriptions continue to sync/);
  assert.match(plans, /Apple purchases must be reconciled/);
});

test('Profile membership row opens Plans without duplicating purchase UI', () => {
  const profile = readFileSync(join(root, 'app', '(tabs)', 'profile.tsx'), 'utf8');

  assert.match(profile, /Manage Membership/);
  assert.match(profile, /Current plan: \$\{currentPlan\.name\}/);
  assert.match(profile, /router\.push\('\/plans'\)/);
  assert.doesNotMatch(profile, /purchaseRevenueCatPackage|restoreRevenueCatPurchases/);
});

test('RevenueCat package lookup supports every canonical tier and billing selection', () => {
  const catalog = fixtureCatalog();
  const cases: Array<[RevenueCatPurchasePlan, RevenueCatPurchaseCycle, string]> = [
    ['collector', 'monthly', 'collector_monthly'],
    ['collector', 'yearly', 'collector_yearly'],
    ['seller', 'monthly', 'seller_monthly'],
    ['seller', 'yearly', 'seller_yearly'],
    ['store', 'monthly', 'store_monthly'],
    ['store', 'yearly', 'store_yearly'],
  ];

  for (const [tier, cycle, identifier] of cases) {
    const selection = summarizeRevenueCatSelection({ catalog, tier, cycle });
    assert.equal(selection.packageIdentifier, identifier);
    assert.equal(selection.package?.identifier, identifier);
    assert.match(selection.priceLabel, /^Localized /);
    assert.equal(selection.missingReason, null);
  }
});

test('yearly savings displays only when localized package prices can be computed safely', () => {
  const catalog = fixtureCatalog({
    collector_monthly: '$4.99',
    collector_yearly: '$49.99',
  });
  assert.equal(summarizeRevenueCatSelection({ catalog, tier: 'collector', cycle: 'yearly' }).savingsLabel, 'Save 17%');

  const localized = fixtureCatalog({
    collector_monthly: 'US$4.99',
    collector_yearly: 'Annual',
  });
  assert.equal(summarizeRevenueCatSelection({ catalog: localized, tier: 'collector', cycle: 'yearly' }).savingsLabel, null);
});

test('current membership summary preserves canonical Free Collector Seller and Store states', () => {
  assert.deepEqual(summarizeRevenueCatCurrentMembership({ canonicalTier: 'free' }), {
    tier: 'free',
    statusLabel: 'Free',
    billingSource: 'unknown',
    billingSourceLabel: 'Unknown',
  });
  assert.equal(summarizeRevenueCatCurrentMembership({ canonicalTier: 'collector', providerSnapshot: snapshot('collector') }).billingSourceLabel, 'App Store');
  assert.equal(summarizeRevenueCatCurrentMembership({ canonicalTier: 'seller', providerSnapshot: snapshot('seller') }).statusLabel, 'Active');
  assert.equal(summarizeRevenueCatCurrentMembership({ canonicalTier: 'store', providerSnapshot: snapshot('store') }).tier, 'store');
});

test('web-paid Seller and Store stay current when RevenueCat has no Apple entitlement', () => {
  const seller = summarizeRevenueCatCurrentMembership({ canonicalTier: 'seller', providerSnapshot: snapshot('free') });
  const store = summarizeRevenueCatCurrentMembership({ canonicalTier: 'store', providerSnapshot: snapshot('free') });

  assert.equal(seller.billingSourceLabel, 'Web');
  assert.equal(store.billingSourceLabel, 'Web');
  assert.equal(revenueCatCtaLabel({ currentTier: 'seller', selectedTier: 'seller', billingSource: seller.billingSource, status: 'ready' }), 'Current plan');
  assert.equal(revenueCatCtaLabel({ currentTier: 'store', selectedTier: 'store', billingSource: store.billingSource, status: 'ready' }), 'Current plan');
});

test('purchase CTA distinguishes subscribe upgrade switch current and manage states', () => {
  assert.equal(revenueCatPurchaseIntent({ currentTier: 'free', selectedTier: 'collector', billingSource: 'unknown' }), 'subscribe');
  assert.equal(revenueCatCtaLabel({ currentTier: 'free', selectedTier: 'collector', billingSource: 'unknown', status: 'ready' }), 'Subscribe');
  assert.equal(revenueCatCtaLabel({ currentTier: 'collector', selectedTier: 'seller', billingSource: 'app_store', status: 'ready' }), 'Upgrade to Seller');
  assert.equal(revenueCatCtaLabel({ currentTier: 'store', selectedTier: 'collector', billingSource: 'app_store', status: 'ready' }), 'Switch to Collector');
  assert.equal(revenueCatCtaLabel({ currentTier: 'seller', selectedTier: 'seller', billingSource: 'app_store', status: 'ready' }), 'Manage subscription');
  assert.equal(revenueCatCtaLabel({ currentTier: 'seller', selectedTier: 'seller', billingSource: 'web', status: 'ready' }), 'Current plan');
  assert.equal(revenueCatCtaLabel({ currentTier: 'free', selectedTier: 'store', billingSource: 'unknown', status: 'purchasing' }), 'Processing...');
});

test('purchase and restore user messages handle success cancellation failure and empty restore safely', () => {
  const purchased: RevenueCatPurchaseResult = { ok: true, status: 'purchased', snapshot: snapshot('seller') };
  const cancelled: RevenueCatPurchaseResult = { ok: false, status: 'cancelled', message: 'raw provider cancel' };
  const failed: RevenueCatPurchaseResult = { ok: false, status: 'failed', message: 'raw provider failure' };
  const restoredEmpty: RevenueCatPurchaseResult = { ok: true, status: 'restored', snapshot: snapshot('free') };
  const restoredPaid: RevenueCatPurchaseResult = { ok: true, status: 'restored', snapshot: snapshot('store') };

  assert.equal(revenueCatUserMessage(purchased, 'purchase'), 'Purchase confirmed. Updating your Trading Docks account...');
  assert.equal(revenueCatUserMessage(cancelled, 'purchase'), null);
  assert.equal(revenueCatUserMessage(failed, 'purchase'), 'Purchase could not be completed. Try again or restore purchases.');
  assert.equal(revenueCatUserMessage(restoredEmpty, 'restore'), 'No active App Store subscription was found for this Apple account.');
  assert.equal(revenueCatUserMessage(restoredPaid, 'restore'), 'Purchases restored. Updating your account...');
});

test('backend sync pending and success do not grant client-side entitlements', () => {
  assert.equal(revenueCatBackendSyncMessage({ providerTier: 'seller', canonicalTier: 'free', action: 'purchase' }), 'Purchase confirmed. Updating your Trading Docks account...');
  assert.equal(revenueCatBackendSyncMessage({ providerTier: 'seller', canonicalTier: 'seller', action: 'purchase' }), 'Membership updated');
  assert.equal(revenueCatBackendSyncMessage({ providerTier: 'free', canonicalTier: 'free', action: 'restore' }), 'No active App Store subscription was found for this Apple account.');
});

test('missing package and missing localized price are visible catalog states', () => {
  const missing = summarizeRevenueCatSelection({ catalog: [], tier: 'collector', cycle: 'monthly' });
  assert.equal(missing.priceLabel, 'Unavailable');
  assert.equal(missing.missingReason, 'package_missing');

  const noPrice = summarizeRevenueCatSelection({
    catalog: [{ tier: 'collector', packages: { monthly: { identifier: 'collector_monthly', tier: 'collector', cycle: 'monthly', localizedPrice: '', title: 'Collector Monthly' } } }],
    tier: 'collector',
    cycle: 'monthly',
  });
  assert.equal(noPrice.missingReason, 'localized_price_missing');
});

function fixtureCatalog(overrides: Partial<Record<string, string>> = {}): RevenueCatCatalogPlan[] {
  return [
    plan('collector', overrides),
    plan('seller', overrides),
    plan('store', overrides),
  ];
}

function plan(tier: RevenueCatPurchasePlan, overrides: Partial<Record<string, string>>): RevenueCatCatalogPlan {
  return {
    tier,
    packages: {
      monthly: packageSummary(tier, 'monthly', overrides),
      yearly: packageSummary(tier, 'yearly', overrides),
    },
  };
}

function packageSummary(
  tier: RevenueCatPurchasePlan,
  cycle: RevenueCatPurchaseCycle,
  overrides: Partial<Record<string, string>>,
) {
  const identifier = packageIdentifierFor(tier, cycle);
  return {
    identifier,
    tier,
    cycle,
    localizedPrice: overrides[identifier] ?? `Localized ${identifier}`,
    title: `${tier} ${cycle}`,
  };
}

function snapshot(tier: 'free' | RevenueCatPurchasePlan): RevenueCatCustomerSnapshot {
  const entitlement = tier === 'collector' ? 'Collector' : tier === 'seller' ? 'Seller' : tier === 'store' ? 'Store' : null;
  return {
    activeTier: tier,
    activeEntitlements: entitlement ? [entitlement as RevenueCatEntitlementIdentifier] : [],
    originalAppUserId: 'user-123',
    managementUrl: null,
  };
}
