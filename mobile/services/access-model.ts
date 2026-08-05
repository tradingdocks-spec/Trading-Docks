import {
  billingStatusAllowsPaidEntitlements,
  getEntitlementsForTier,
  normalizeAccountType,
  normalizeBillingStatus,
  normalizeMembershipTier,
  type AccountType,
  type BillingStatus,
  type EntitlementKey,
  type MembershipTier,
} from './membership-catalog.ts';

export type PlatformRole = 'owner' | 'admin' | 'support' | 'analyst' | 'user';
export {
  normalizeAccountType,
  normalizeBillingStatus,
  normalizeMembershipTier,
};
export type {
  AccountType,
  BillingStatus,
  EntitlementKey,
  MembershipTier,
};

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

export function normalizePlatformRole(value: unknown): PlatformRole {
  return value === 'owner' || value === 'admin' || value === 'support' || value === 'analyst'
    ? value
    : 'user';
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
  const paidBillingIsCurrent = billingStatusAllowsPaidEntitlements({
    status: billingStatus,
    periodEnd: input.billingPeriodEnd,
    now,
  });
  const billingTier: MembershipTier = paidBillingIsCurrent
    ? normalizeMembershipTier(input.billingPlan)
    : 'free';
  const membershipTier = input.membershipOverride
    ? normalizeMembershipTier(input.membershipOverride)
    : billingTier;
  const isSuspended = Boolean(input.suspended) || billingStatus === 'suspended';

  if (!input.platformRole) warnings.push('missing_role');
  if (!input.accountType) warnings.push('missing_account_type');
  if (!input.membershipOverride && !input.billingPlan) warnings.push('missing_membership');
  if (billingStatus === 'past_due' && !paidBillingIsCurrent) warnings.push('stale_billing');
  if (isSuspended) warnings.push('suspended_account');

  const isAdmin = platformRole !== 'user';
  const entitlementKeys = isSuspended ? [] : getEntitlementsForTier(membershipTier);
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
