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

export type RevenueCatBillingSource = 'app_store' | 'web' | 'admin' | 'unknown';
export type RevenueCatPurchaseIntent = 'subscribe' | 'upgrade' | 'switch' | 'current' | 'manage';
export type RevenueCatSyncState = 'idle' | 'backend_pending' | 'membership_updated';

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
  | 'syncing_backend'
  | 'backend_pending'
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

export type RevenueCatCurrentMembershipSummary = {
  tier: MembershipTier;
  statusLabel: 'Active' | 'Free' | 'Unknown';
  billingSource: RevenueCatBillingSource;
  billingSourceLabel: 'App Store' | 'Web' | 'Admin' | 'Unknown';
};

export type RevenueCatSelectionSummary = {
  tier: RevenueCatPurchasePlan;
  cycle: RevenueCatPurchaseCycle;
  packageIdentifier: RevenueCatPackageIdentifier;
  package: RevenueCatPackageSummary | null;
  priceLabel: string;
  periodLabel: 'monthly' | 'yearly';
  savingsLabel: string | null;
  missingReason: 'package_missing' | 'localized_price_missing' | null;
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

export function findRevenueCatPackage(
  catalog: RevenueCatCatalogPlan[],
  tier: RevenueCatPurchasePlan,
  cycle: RevenueCatPurchaseCycle,
) {
  return catalog.find((plan) => plan.tier === tier)?.packages[cycle] ?? null;
}

export function summarizeRevenueCatSelection({
  catalog,
  tier,
  cycle,
}: {
  catalog: RevenueCatCatalogPlan[];
  tier: RevenueCatPurchasePlan;
  cycle: RevenueCatPurchaseCycle;
}): RevenueCatSelectionSummary {
  const selectedPackage = findRevenueCatPackage(catalog, tier, cycle);
  const monthly = findRevenueCatPackage(catalog, tier, 'monthly');
  const yearly = findRevenueCatPackage(catalog, tier, 'yearly');
  return {
    tier,
    cycle,
    packageIdentifier: packageIdentifierFor(tier, cycle),
    package: selectedPackage,
    priceLabel: selectedPackage?.localizedPrice?.trim() || 'Unavailable',
    periodLabel: cycle,
    savingsLabel: yearlySavingsLabel(monthly?.localizedPrice, yearly?.localizedPrice),
    missingReason: !selectedPackage
      ? 'package_missing'
      : selectedPackage.localizedPrice?.trim()
        ? null
        : 'localized_price_missing',
  };
}

export function summarizeRevenueCatCurrentMembership({
  canonicalTier,
  providerSnapshot,
}: {
  canonicalTier: MembershipTier;
  providerSnapshot?: RevenueCatCustomerSnapshot | null;
}): RevenueCatCurrentMembershipSummary {
  const providerTier = providerSnapshot?.activeTier ?? 'free';
  const billingSource = canonicalTier !== 'free' && providerTier === canonicalTier
    ? 'app_store'
    : canonicalTier !== 'free'
      ? 'web'
      : 'unknown';
  return {
    tier: canonicalTier,
    statusLabel: canonicalTier === 'free' ? 'Free' : 'Active',
    billingSource,
    billingSourceLabel: billingSourceLabel(billingSource),
  };
}

export function revenueCatPurchaseIntent({
  currentTier,
  selectedTier,
  billingSource,
}: {
  currentTier: MembershipTier;
  selectedTier: RevenueCatPurchasePlan;
  billingSource: RevenueCatBillingSource;
}): RevenueCatPurchaseIntent {
  if (currentTier === selectedTier) return billingSource === 'app_store' ? 'manage' : 'current';
  if (TIER_ORDER[currentTier] < TIER_ORDER[selectedTier]) return currentTier === 'free' ? 'subscribe' : 'upgrade';
  return 'switch';
}

export function revenueCatCtaLabel({
  currentTier,
  selectedTier,
  billingSource,
  status,
}: {
  currentTier: MembershipTier;
  selectedTier: RevenueCatPurchasePlan;
  billingSource: RevenueCatBillingSource;
  status: RevenueCatStatus;
}) {
  if (status === 'purchasing') return 'Processing...';
  if (status === 'syncing_backend' || status === 'backend_pending') return 'Refresh account';
  const selectedName = selectedTierName(selectedTier);
  const intent = revenueCatPurchaseIntent({ currentTier, selectedTier, billingSource });
  if (intent === 'manage') return 'Manage subscription';
  if (intent === 'current') return 'Current plan';
  if (intent === 'upgrade') return `Upgrade to ${selectedName}`;
  if (intent === 'switch') return `Switch to ${selectedName}`;
  return 'Subscribe';
}

export function revenueCatUserMessage(
  result: RevenueCatPurchaseResult,
  action: 'purchase' | 'restore',
) {
  if (result.ok) {
    if (action === 'restore' && result.snapshot.activeTier === 'free') {
      return 'No active App Store subscription was found for this Apple account.';
    }
    return action === 'restore'
      ? 'Purchases restored. Updating your account...'
      : 'Purchase confirmed. Updating your Trading Docks account...';
  }
  if (result.status === 'cancelled') return null;
  if (result.status === 'pending') return 'Purchase is pending. We will update your account when the store confirms it.';
  if (result.status === 'not_configured') return 'Mobile purchases are not configured for this build.';
  if (result.status === 'unavailable') return 'Purchases are available only in native iOS and Android builds.';
  return action === 'restore'
    ? 'Restore could not be completed. Check your connection and try again.'
    : 'Purchase could not be completed. Try again or restore purchases.';
}

export function revenueCatBackendSyncMessage({
  providerTier,
  canonicalTier,
  action,
}: {
  providerTier: MembershipTier;
  canonicalTier: MembershipTier;
  action: 'purchase' | 'restore';
}) {
  if (providerTier === 'free') {
    return action === 'restore'
      ? 'No active App Store subscription was found for this Apple account.'
      : 'The store returned no paid membership. Trading Docks access was not changed.';
  }
  if (TIER_ORDER[canonicalTier] >= TIER_ORDER[providerTier]) return 'Membership updated';
  return action === 'restore'
    ? 'Purchases restored. Updating your account...'
    : 'Purchase confirmed. Updating your Trading Docks account...';
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
    if (isPendingPurchase(error)) return { ok: false, status: 'pending', message: 'Purchase is pending.' };
    return { ok: false, status: 'failed', message: 'Purchase could not be completed. Try again or restore purchases.' };
  }
}

export async function restoreRevenueCatPurchases(): Promise<RevenueCatPurchaseResult> {
  if (!getRevenueCatPublicConfig().configured) return { ok: false, status: 'not_configured', message: 'Mobile purchases are not configured for this build.' };
  try {
    const Purchases = await loadPurchases();
    const info = await Purchases.restorePurchases();
    return { ok: true, status: 'restored', snapshot: customerInfoToSnapshot(info) };
  } catch {
    return { ok: false, status: 'failed', message: 'Restore could not be completed. Check your connection and try again.' };
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
  const purchasesModule = await import('react-native-purchases');
  return purchasesModule.default;
}

function isUserCancelled(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'userCancelled' in error
    && Boolean((error as { userCancelled?: unknown }).userCancelled);
}

function isPendingPurchase(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const code = String((error as { code?: unknown }).code).toUpperCase();
  return code.includes('PAYMENT_PENDING') || code.includes('PENDING');
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function selectedTierName(tier: RevenueCatPurchasePlan) {
  if (tier === 'collector') return 'Collector';
  if (tier === 'seller') return 'Seller';
  return 'Store';
}

function billingSourceLabel(source: RevenueCatBillingSource): RevenueCatCurrentMembershipSummary['billingSourceLabel'] {
  if (source === 'app_store') return 'App Store';
  if (source === 'web') return 'Web';
  if (source === 'admin') return 'Admin';
  return 'Unknown';
}

function yearlySavingsLabel(monthly: string | undefined, yearly: string | undefined) {
  const monthlyNumber = parseLocalizedPrice(monthly);
  const yearlyNumber = parseLocalizedPrice(yearly);
  if (monthlyNumber === null || yearlyNumber === null) return null;
  const savings = monthlyNumber * 12 - yearlyNumber;
  if (savings <= 0) return null;
  const percent = Math.round((savings / (monthlyNumber * 12)) * 100);
  return percent > 0 ? `Save ${percent}%` : null;
}

function parseLocalizedPrice(value: string | undefined) {
  if (!value) return null;
  const normalized = value.replace(/[^0-9.,]/g, '');
  if (!normalized) return null;
  const decimal = normalized.includes(',') && !normalized.includes('.')
    ? normalized.replace(',', '.')
    : normalized.replace(/,/g, '');
  const parsed = Number(decimal);
  return Number.isFinite(parsed) ? parsed : null;
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
