import type { BillingCycle, MembershipTier } from './membership-catalog.ts';

export type RevenueCatEntitlementIdentifier = 'Collector' | 'Seller' | 'Store';
export type RevenueCatPackageIdentifier =
  | 'collector_monthly'
  | 'collector_yearly'
  | 'seller_monthly'
  | 'seller_yearly'
  | 'store_monthly'
  | 'store_yearly';

export type RevenueCatPurchasePlan = Exclude<MembershipTier, 'free'>;
export type RevenueCatPurchaseCycle = 'monthly' | 'yearly';
export type RevenueCatPlanPackage = {
  identifier: RevenueCatPackageIdentifier;
  tier: RevenueCatPurchasePlan;
  cycle: RevenueCatPurchaseCycle;
  entitlement: RevenueCatEntitlementIdentifier;
};

export type RevenueCatCatalogPlan = {
  tier: RevenueCatPurchasePlan;
  packages: Partial<Record<RevenueCatPurchaseCycle, RevenueCatPackageSummary>>;
};

export type RevenueCatPackageSummary = {
  identifier: RevenueCatPackageIdentifier;
  tier: RevenueCatPurchasePlan;
  cycle: RevenueCatPurchaseCycle;
  localizedPrice: string;
  title: string;
};

export type RevenueCatCustomerSnapshot = {
  activeTier: MembershipTier;
  activeEntitlements: RevenueCatEntitlementIdentifier[];
  originalAppUserId: string | null;
  managementUrl: string | null;
};

export type RevenueCatStatus =
  | 'not_configured'
  | 'unavailable'
  | 'ready'
  | 'loading'
  | 'purchasing'
  | 'restoring'
  | 'synced'
  | 'failed';

export type RevenueCatPurchaseResult =
  | { ok: true; status: 'purchased' | 'restored'; snapshot: RevenueCatCustomerSnapshot }
  | { ok: false; status: 'cancelled' | 'pending' | 'failed' | 'not_configured' | 'unavailable'; message: string };

export type RevenueCatBackendSyncContract = {
  provider: 'revenuecat';
  appUserId: string;
  providerTier: MembershipTier;
  canonicalAuthority: 'trading_docks_backend';
  clientMayGrantEntitlements: false;
  requiresWebhookReconciliation: true;
};

type PurchasesModule = typeof import('react-native-purchases').default;
type PurchasesPackage = import('react-native-purchases').PurchasesPackage;
type CustomerInfo = import('react-native-purchases').CustomerInfo;

const ENTITLEMENT_TO_TIER: Record<RevenueCatEntitlementIdentifier, RevenueCatPurchasePlan> = {
  Collector: 'collector',
  Seller: 'seller',
  Store: 'store',
};

const TIER_ORDER: Record<MembershipTier, number> = {
  free: 0,
  collector: 1,
  seller: 2,
  store: 3,
};

export const REVENUECAT_PACKAGE_CATALOG: Record<RevenueCatPackageIdentifier, RevenueCatPlanPackage> = {
  collector_monthly: { identifier: 'collector_monthly', tier: 'collector', cycle: 'monthly', entitlement: 'Collector' },
  collector_yearly: { identifier: 'collector_yearly', tier: 'collector', cycle: 'yearly', entitlement: 'Collector' },
  seller_monthly: { identifier: 'seller_monthly', tier: 'seller', cycle: 'monthly', entitlement: 'Seller' },
  seller_yearly: { identifier: 'seller_yearly', tier: 'seller', cycle: 'yearly', entitlement: 'Seller' },
  store_monthly: { identifier: 'store_monthly', tier: 'store', cycle: 'monthly', entitlement: 'Store' },
  store_yearly: { identifier: 'store_yearly', tier: 'store', cycle: 'yearly', entitlement: 'Store' },
};

export const REVENUECAT_PRODUCT_IDS: Record<RevenueCatPackageIdentifier, string> = {
  collector_monthly: 'tradingdocks.collector.monthly',
  collector_yearly: 'tradingdocks.collector.yearly',
  seller_monthly: 'tradingdocks.seller.monthly',
  seller_yearly: 'tradingdocks.seller.yearly',
  store_monthly: 'tradingdocks.store.monthly',
  store_yearly: 'tradingdocks.store.yearly',
};

let configuredAppUserId: string | null = null;

export function getRevenueCatPublicConfig(env: Record<string, string | undefined> = process.env) {
  const iosApiKey = env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ?? '';
  const androidApiKey = env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() ?? '';
  const platform = getRevenueCatRuntimePlatform();
  const apiKey = platform === 'ios' ? iosApiKey : platform === 'android' ? androidApiKey : '';
  return {
    iosApiKey,
    androidApiKey,
    platformApiKey: apiKey,
    configured: Boolean(apiKey),
    platform,
  };
}

export function mapRevenueCatEntitlementsToTier(activeEntitlementIds: Iterable<string>): MembershipTier {
  let tier: MembershipTier = 'free';
  for (const id of activeEntitlementIds) {
    const normalized = normalizeRevenueCatEntitlement(id);
    if (!normalized) continue;
    const candidate = ENTITLEMENT_TO_TIER[normalized];
    if (TIER_ORDER[candidate] > TIER_ORDER[tier]) tier = candidate;
  }
  return tier;
}

export function packageIdentifierFor(tier: RevenueCatPurchasePlan, cycle: RevenueCatPurchaseCycle): RevenueCatPackageIdentifier {
  return `${tier}_${cycle}` as RevenueCatPackageIdentifier;
}

export function billingCycleToRevenueCatCycle(cycle: BillingCycle): RevenueCatPurchaseCycle {
  return cycle === 'annual' ? 'yearly' : 'monthly';
}

export function normalizeRevenueCatEntitlement(value: string): RevenueCatEntitlementIdentifier | null {
  return value === 'Collector' || value === 'Seller' || value === 'Store' ? value : null;
}

export function packageCatalogEntry(identifier: string): RevenueCatPlanPackage | null {
  return Object.prototype.hasOwnProperty.call(REVENUECAT_PACKAGE_CATALOG, identifier)
    ? REVENUECAT_PACKAGE_CATALOG[identifier as RevenueCatPackageIdentifier]
    : null;
}

export function buildRevenueCatBackendSyncContract(appUserId: string, snapshot: RevenueCatCustomerSnapshot): RevenueCatBackendSyncContract {
  return {
    provider: 'revenuecat',
    appUserId,
    providerTier: snapshot.activeTier,
    canonicalAuthority: 'trading_docks_backend',
    clientMayGrantEntitlements: false,
    requiresWebhookReconciliation: true,
  };
}

export async function configureRevenueCatForUser(userId: string): Promise<RevenueCatPurchaseResult> {
  const config = getRevenueCatPublicConfig();
  if (!config.configured) return { ok: false, status: 'not_configured', message: 'Mobile purchases are not configured for this build.' };
  if (config.platform !== 'ios' && config.platform !== 'android') return { ok: false, status: 'unavailable', message: 'Purchases are available only in native iOS and Android builds.' };
  try {
    const Purchases = await loadPurchases();
    if (configuredAppUserId !== userId) {
      Purchases.configure({ apiKey: config.platformApiKey, appUserID: userId });
      configuredAppUserId = userId;
    }
    const info = await Purchases.getCustomerInfo();
    return { ok: true, status: 'restored', snapshot: customerInfoToSnapshot(info) };
  } catch (error) {
    return { ok: false, status: 'failed', message: errorMessage(error, 'Purchases could not be prepared.') };
  }
}

export async function logOutRevenueCatUser() {
  const platform = getRevenueCatRuntimePlatform();
  if (!configuredAppUserId || (platform !== 'ios' && platform !== 'android')) {
    configuredAppUserId = null;
    return;
  }
  try {
    const Purchases = await loadPurchases();
    await Purchases.logOut();
  } finally {
    configuredAppUserId = null;
  }
}

export async function loadRevenueCatCatalog(): Promise<RevenueCatCatalogPlan[]> {
  const config = getRevenueCatPublicConfig();
  if (!config.configured || (config.platform !== 'ios' && config.platform !== 'android')) return emptyCatalog();
  const Purchases = await loadPurchases();
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  return summarizePackages(packages);
}

export async function purchaseRevenueCatPackage(identifier: RevenueCatPackageIdentifier): Promise<RevenueCatPurchaseResult> {
  if (!getRevenueCatPublicConfig().configured) return { ok: false, status: 'not_configured', message: 'Mobile purchases are not configured for this build.' };
  const Purchases = await loadPurchases();
  const packages = await currentPackages(Purchases);
  const target = packages.find((pkg) => pkg.identifier === identifier);
  if (!target) return { ok: false, status: 'failed', message: 'That subscription package is not available from the store right now.' };
  try {
    const result = await Purchases.purchasePackage(target);
    return { ok: true, status: 'purchased', snapshot: customerInfoToSnapshot(result.customerInfo) };
  } catch (error) {
    if (isUserCancelled(error)) return { ok: false, status: 'cancelled', message: 'Purchase cancelled.' };
    return { ok: false, status: 'failed', message: errorMessage(error, 'Purchase failed. Try again or restore purchases.') };
  }
}

export async function restoreRevenueCatPurchases(): Promise<RevenueCatPurchaseResult> {
  if (!getRevenueCatPublicConfig().configured) return { ok: false, status: 'not_configured', message: 'Mobile purchases are not configured for this build.' };
  try {
    const Purchases = await loadPurchases();
    const info = await Purchases.restorePurchases();
    return { ok: true, status: 'restored', snapshot: customerInfoToSnapshot(info) };
  } catch (error) {
    return { ok: false, status: 'failed', message: errorMessage(error, 'Restore failed. Check your connection and try again.') };
  }
}

export function customerInfoToSnapshot(info: CustomerInfo): RevenueCatCustomerSnapshot {
  const activeEntitlements = Object.keys(info.entitlements.active)
    .map(normalizeRevenueCatEntitlement)
    .filter((value): value is RevenueCatEntitlementIdentifier => Boolean(value));
  return {
    activeTier: mapRevenueCatEntitlementsToTier(activeEntitlements),
    activeEntitlements,
    originalAppUserId: info.originalAppUserId ?? null,
    managementUrl: info.managementURL ?? null,
  };
}

function summarizePackages(packages: PurchasesPackage[]): RevenueCatCatalogPlan[] {
  const plans: Record<RevenueCatPurchasePlan, RevenueCatCatalogPlan> = {
    collector: { tier: 'collector', packages: {} },
    seller: { tier: 'seller', packages: {} },
    store: { tier: 'store', packages: {} },
  };
  for (const pkg of packages) {
    const entry = packageCatalogEntry(pkg.identifier);
    if (!entry) continue;
    plans[entry.tier].packages[entry.cycle] = {
      identifier: entry.identifier,
      tier: entry.tier,
      cycle: entry.cycle,
      localizedPrice: pkg.product.priceString,
      title: pkg.product.title,
    };
  }
  return [plans.collector, plans.seller, plans.store];
}

function emptyCatalog(): RevenueCatCatalogPlan[] {
  return [
    { tier: 'collector', packages: {} },
    { tier: 'seller', packages: {} },
    { tier: 'store', packages: {} },
  ];
}

async function currentPackages(Purchases: PurchasesModule) {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

async function loadPurchases(): Promise<PurchasesModule> {
  const module = await import('react-native-purchases');
  return module.default;
}

function isUserCancelled(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'userCancelled' in error
    && Boolean((error as { userCancelled?: unknown }).userCancelled);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getRevenueCatRuntimePlatform() {
  try {
    // Keep React Native out of Node-only contract tests; RevenueCat SDK calls still run only in native app runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const reactNative = require('react-native') as { Platform?: { OS?: string } };
    return reactNative.Platform?.OS ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
