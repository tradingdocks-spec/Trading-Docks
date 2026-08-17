import {
  normalizeMembershipTier,
  type BillingCycle,
  type MembershipTier,
} from "../membership-catalog.ts";

export type RevenueCatWebPurchasePlan = Exclude<MembershipTier, "free">;

export type RevenueCatWebPurchaseInput = {
  plan: RevenueCatWebPurchasePlan;
  billing: BillingCycle;
  appUserId: string;
  email?: string | null;
  returnUrl?: string | null;
};

export const REVENUECAT_WEB_PACKAGE_IDS: Record<
  RevenueCatWebPurchasePlan,
  Record<BillingCycle, string>
> = {
  collector: {
    monthly: "collector_monthly",
    annual: "collector_yearly",
  },
  seller: {
    monthly: "seller_monthly",
    annual: "seller_yearly",
  },
  store: {
    monthly: "store_monthly",
    annual: "store_yearly",
  },
};

const PACKAGE_LINK_ENV: Record<
  RevenueCatWebPurchasePlan,
  Record<BillingCycle, string>
> = {
  collector: {
    monthly: "REVENUECAT_WEB_COLLECTOR_MONTHLY_URL",
    annual: "REVENUECAT_WEB_COLLECTOR_YEARLY_URL",
  },
  seller: {
    monthly: "REVENUECAT_WEB_SELLER_MONTHLY_URL",
    annual: "REVENUECAT_WEB_SELLER_YEARLY_URL",
  },
  store: {
    monthly: "REVENUECAT_WEB_STORE_MONTHLY_URL",
    annual: "REVENUECAT_WEB_STORE_YEARLY_URL",
  },
};

export const REVENUECAT_WEB_BILLING_ENV_VARS = [
  "REVENUECAT_WEB_PURCHASE_LINK",
  "REVENUECAT_WEB_COLLECTOR_MONTHLY_URL",
  "REVENUECAT_WEB_COLLECTOR_YEARLY_URL",
  "REVENUECAT_WEB_SELLER_MONTHLY_URL",
  "REVENUECAT_WEB_SELLER_YEARLY_URL",
  "REVENUECAT_WEB_STORE_MONTHLY_URL",
  "REVENUECAT_WEB_STORE_YEARLY_URL",
  "REVENUECAT_WEB_CUSTOMER_PORTAL_URL",
  "REVENUECAT_WEB_MANAGEMENT_URL",
] as const;

export type RevenueCatWebBillingConfiguration = {
  purchasesConfigured: boolean;
  portalConfigured: boolean;
  missingPurchaseEnv: string[];
  missingPortalEnv: string[];
  configuredPurchaseEnv: string[];
  configuredPortalEnv: string[];
};

export function isRevenueCatWebPurchasePlan(
  value: unknown,
): value is RevenueCatWebPurchasePlan {
  return value === "collector" || value === "seller" || value === "store";
}

export function isRevenueCatWebBillingCycle(
  value: unknown,
): value is BillingCycle {
  return value === "monthly" || value === "annual";
}

export function revenueCatPackageIdFor(
  plan: RevenueCatWebPurchasePlan,
  billing: BillingCycle,
) {
  return REVENUECAT_WEB_PACKAGE_IDS[plan][billing];
}

export function revenueCatWebPurchaseBaseUrl({
  plan,
  billing,
  env = process.env,
}: {
  plan: RevenueCatWebPurchasePlan;
  billing: BillingCycle;
  env?: Record<string, string | undefined>;
}) {
  return env[PACKAGE_LINK_ENV[plan][billing]]?.trim()
    || env.REVENUECAT_WEB_PURCHASE_LINK?.trim()
    || null;
}

function safeUrl(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function buildRevenueCatWebPurchaseUrl({
  baseUrl,
  input,
}: {
  baseUrl: string;
  input: RevenueCatWebPurchaseInput;
}) {
  const url = safeUrl(baseUrl);
  if (!url) return null;
  url.searchParams.set("app_user_id", input.appUserId);
  url.searchParams.set("package_id", revenueCatPackageIdFor(input.plan, input.billing));
  if (input.email) url.searchParams.set("email", input.email);
  if (input.returnUrl) url.searchParams.set("return_url", input.returnUrl);
  return url.toString();
}

export function revenueCatWebPurchaseUrlFor(
  input: RevenueCatWebPurchaseInput,
  env: Record<string, string | undefined> = process.env,
) {
  const plan = normalizeMembershipTier(input.plan);
  if (!isRevenueCatWebPurchasePlan(plan)) return null;
  const baseUrl = revenueCatWebPurchaseBaseUrl({ plan, billing: input.billing, env });
  if (!baseUrl) return null;
  return buildRevenueCatWebPurchaseUrl({
    baseUrl,
    input: {
      ...input,
      plan,
    },
  });
}

export function revenueCatWebManagementUrlFor({
  appUserId,
  email,
  returnUrl,
  env = process.env,
}: {
  appUserId: string;
  email?: string | null;
  returnUrl?: string | null;
  env?: Record<string, string | undefined>;
}) {
  const baseUrl = env.REVENUECAT_WEB_CUSTOMER_PORTAL_URL?.trim()
    || env.REVENUECAT_WEB_MANAGEMENT_URL?.trim()
    || null;
  if (!baseUrl) return null;

  const url = safeUrl(baseUrl);
  if (!url) return null;
  url.searchParams.set("app_user_id", appUserId);
  if (email) url.searchParams.set("email", email);
  if (returnUrl) url.searchParams.set("return_url", returnUrl);
  return url.toString();
}

export function inspectRevenueCatWebBillingConfiguration(
  env: Record<string, string | undefined> = process.env,
): RevenueCatWebBillingConfiguration {
  const configuredPurchaseEnv = [
    "REVENUECAT_WEB_PURCHASE_LINK",
    "REVENUECAT_WEB_COLLECTOR_MONTHLY_URL",
    "REVENUECAT_WEB_COLLECTOR_YEARLY_URL",
    "REVENUECAT_WEB_SELLER_MONTHLY_URL",
    "REVENUECAT_WEB_SELLER_YEARLY_URL",
    "REVENUECAT_WEB_STORE_MONTHLY_URL",
    "REVENUECAT_WEB_STORE_YEARLY_URL",
  ].filter((name) => Boolean(env[name]?.trim()));
  const configuredPortalEnv = [
    "REVENUECAT_WEB_CUSTOMER_PORTAL_URL",
    "REVENUECAT_WEB_MANAGEMENT_URL",
  ].filter((name) => Boolean(env[name]?.trim()));
  const sharedPurchaseConfigured = Boolean(env.REVENUECAT_WEB_PURCHASE_LINK?.trim());
  const missingPurchaseEnv = sharedPurchaseConfigured
    ? []
    : [
      "REVENUECAT_WEB_COLLECTOR_MONTHLY_URL",
      "REVENUECAT_WEB_COLLECTOR_YEARLY_URL",
      "REVENUECAT_WEB_SELLER_MONTHLY_URL",
      "REVENUECAT_WEB_SELLER_YEARLY_URL",
      "REVENUECAT_WEB_STORE_MONTHLY_URL",
      "REVENUECAT_WEB_STORE_YEARLY_URL",
    ].filter((name) => !env[name]?.trim());

  return {
    purchasesConfigured: missingPurchaseEnv.length === 0,
    portalConfigured: configuredPortalEnv.length > 0,
    missingPurchaseEnv,
    missingPortalEnv: configuredPortalEnv.length ? [] : [
      "REVENUECAT_WEB_CUSTOMER_PORTAL_URL",
      "REVENUECAT_WEB_MANAGEMENT_URL",
    ],
    configuredPurchaseEnv,
    configuredPortalEnv,
  };
}
