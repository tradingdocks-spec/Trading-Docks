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

  assert.match(plans, /selectedPackage\?\.localizedPrice/);
  assert.match(plans, /Restore Purchases/);
  assert.match(plans, /purchaseRevenueCatPackage/);
  assert.match(plans, /restoreRevenueCatPurchases/);
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
