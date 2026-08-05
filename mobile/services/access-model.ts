export type PlatformRole = 'owner' | 'admin' | 'support' | 'analyst' | 'user';
export type AccountType = 'free' | 'collector' | 'seller' | 'store';
export type MembershipTier = 'free' | 'collector' | 'seller' | 'business';
export type BillingStatus =
  | 'free'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'suspended'
  | 'unknown';
export type EntitlementKey =
  | 'dashboard'
  | 'inventory'
  | 'deck-vault'
  | 'collector-analytics'
  | 'csv-tools'
  | 'purchasing'
  | 'crm'
  | 'selling'
  | 'marketplaces'
  | 'orders'
  | 'card-shows'
  | 'automation'
  | 'business-intelligence'
  | 'business-operations'
  | 'settings'
  | 'support'
  | 'admin.command-center';

export type ResolvedAccess = {
  userId: string | null;
  platformRole: PlatformRole;
  accountType: AccountType;
  membershipTier: MembershipTier;
  billingStatus: BillingStatus;
  entitlementKeys: EntitlementKey[];
  isAdmin: boolean;
  isSuspended: boolean;
  canAccessCommandCenter: boolean;
  warnings: string[];
};

export type AccessResolutionInput = {
  userId?: string | null;
  platformRole?: string | null;
  accountType?: string | null;
  membershipOverride?: string | null;
  billingPlan?: string | null;
  billingStatus?: string | null;
  billingPeriodEnd?: string | null;
  suspended?: boolean;
  now?: Date;
};

const ROLE_RANK: Record<PlatformRole, number> = {
  user: 0,
  analyst: 1,
  support: 2,
  admin: 3,
  owner: 4,
};

const TIER_ENTITLEMENTS: Record<MembershipTier, EntitlementKey[]> = {
  free: ['dashboard', 'inventory', 'deck-vault', 'settings', 'support'],
  collector: ['dashboard', 'inventory', 'deck-vault', 'collector-analytics', 'csv-tools', 'settings', 'support'],
  seller: ['dashboard', 'inventory', 'deck-vault', 'collector-analytics', 'csv-tools', 'purchasing', 'crm', 'selling', 'marketplaces', 'orders', 'card-shows', 'automation', 'settings', 'support'],
  business: ['dashboard', 'inventory', 'deck-vault', 'collector-analytics', 'csv-tools', 'purchasing', 'crm', 'selling', 'marketplaces', 'orders', 'card-shows', 'automation', 'business-intelligence', 'business-operations', 'settings', 'support'],
};

export function normalizePlatformRole(value: unknown): PlatformRole {
  return value === 'owner' || value === 'admin' || value === 'support' || value === 'analyst'
    ? value
    : 'user';
}

export function normalizeAccountType(value: unknown): AccountType {
  return value === 'collector' || value === 'seller' || value === 'store'
    ? value
    : 'free';
}

export function normalizeMembershipTier(value: unknown): MembershipTier {
  return value === 'business' || value === 'seller' || value === 'collector'
    ? value
    : 'free';
}

export function normalizeBillingStatus(value: unknown): BillingStatus {
  return value === 'trialing' ||
    value === 'active' ||
    value === 'past_due' ||
    value === 'canceled' ||
    value === 'incomplete' ||
    value === 'suspended'
    ? value
    : value === 'free'
      ? 'free'
      : 'unknown';
}

export function hasPlatformRole(role: PlatformRole, minimum: Exclude<PlatformRole, 'user'>) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function resolveAccess(input: AccessResolutionInput): ResolvedAccess {
  const warnings: string[] = [];
  const platformRole = normalizePlatformRole(input.platformRole);
  const accountType = normalizeAccountType(input.accountType);
  const billingStatus = normalizeBillingStatus(input.billingStatus ?? (input.billingPlan ? 'active' : 'free'));
  const now = input.now ?? new Date();
  const isPastDueCurrent =
    billingStatus === 'past_due' &&
    Boolean(input.billingPeriodEnd) &&
    new Date(String(input.billingPeriodEnd)).getTime() > now.getTime();
  const paidBillingIsCurrent = billingStatus === 'active' || billingStatus === 'trialing' || isPastDueCurrent;
  const billingTier = paidBillingIsCurrent
    ? normalizeMembershipTier(input.billingPlan)
    : 'free';
  const membershipTier = input.membershipOverride
    ? normalizeMembershipTier(input.membershipOverride)
    : billingTier;
  const isSuspended = Boolean(input.suspended) || billingStatus === 'suspended';

  if (!input.platformRole) warnings.push('missing_role');
  if (!input.accountType) warnings.push('missing_account_type');
  if (!input.membershipOverride && !input.billingPlan) warnings.push('missing_membership');
  if (billingStatus === 'past_due' && !isPastDueCurrent) warnings.push('stale_billing');
  if (isSuspended) warnings.push('suspended_account');

  const isAdmin = platformRole !== 'user';
  const entitlementKeys = isSuspended ? [] : [...TIER_ENTITLEMENTS[membershipTier]];
  if (isAdmin && !isSuspended) entitlementKeys.push('admin.command-center');

  return {
    userId: input.userId ?? null,
    platformRole,
    accountType,
    membershipTier,
    billingStatus,
    entitlementKeys,
    isAdmin,
    isSuspended,
    canAccessCommandCenter: isAdmin && !isSuspended,
    warnings,
  };
}
