import {
  hasPlatformRole,
  normalizeAccountType,
  normalizeBillingStatus,
  normalizeMembershipTier,
  normalizePlatformRole,
  resolvePlatformAccessContext,
  type AccountType,
  type BillingStatus,
  type EntitlementKey,
  type MembershipTier,
  type PlatformRole,
} from './platform-access.ts';

export {
  hasPlatformRole,
  normalizeAccountType,
  normalizeBillingStatus,
  normalizeMembershipTier,
  normalizePlatformRole,
};
export type {
  AccountType,
  BillingStatus,
  EntitlementKey,
  MembershipTier,
  PlatformRole,
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
  effectiveMembershipTier?: string | null;
  membershipOverride?: string | null;
  billingPlan?: string | null;
  billingStatus?: string | null;
  billingPeriodEnd?: string | null;
  suspended?: boolean;
  now?: Date;
};

export function resolveAccess(input: AccessResolutionInput): ResolvedAccess {
  const access = resolvePlatformAccessContext({
    ...input,
    authenticated: Boolean(input.userId),
  });
  const isAdmin = access.platformRole !== 'user';

  return {
    userId: access.userId,
    platformRole: access.platformRole,
    accountType: access.accountType,
    membershipTier: access.membershipTier,
    billingStatus: access.billingStatus,
    entitlementKeys: access.entitlements,
    isAdmin,
    isSuspended: access.suspended,
    canAccessCommandCenter: isAdmin && !access.suspended,
    warnings: access.warnings,
  };
}
