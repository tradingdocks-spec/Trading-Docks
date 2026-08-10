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

export type {
  AccountType,
  BillingStatus,
  EntitlementKey,
  MembershipTier,
};

export {
  normalizeAccountType,
  normalizeBillingStatus,
  normalizeMembershipTier,
};

export type PlatformRole = 'owner' | 'admin' | 'support' | 'analyst' | 'user';
export type PlatformRoleAuthority = 'trusted' | 'client';
export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export type PlatformCapability =
  | 'collection.read'
  | 'collection.write'
  | 'deck.manage'
  | 'scanner.use'
  | 'scanner.advanced'
  | 'binder.manage'
  | 'wishlist.manage'
  | 'inventory.manage'
  | 'label.view'
  | 'label.manage_templates'
  | 'label.print'
  | 'inventory.reprice'
  | 'pos.sell'
  | 'buying.manage'
  | 'orders.manage'
  | 'marketplaces.manage'
  | 'analytics.view'
  | 'automation.manage'
  | 'csv.export'
  | 'crm.manage'
  | 'employees.manage'
  | 'payroll.manage'
  | 'vendors.manage'
  | 'supplies.manage'
  | 'events.manage'
  | 'finances.manage'
  | 'businessIntelligence.view'
  | 'support.access'
  | 'workspace.manage'
  | 'workspace.members.manage'
  | 'billing.manage'
  | 'platform.admin';

export type PlatformAccessContext = {
  userId: string | null;
  authenticated: boolean;
  platformRole: PlatformRole;
  platformRoleAuthority: PlatformRoleAuthority;
  accountType: AccountType;
  membershipTier: MembershipTier;
  billingStatus: BillingStatus;
  entitlements: EntitlementKey[];
  workspaceId: string | null;
  workspaceRole: WorkspaceRole | null;
  providerState: 'none' | 'stripe' | 'revenuecat' | 'manual' | 'mixed' | 'unknown';
  suspended: boolean;
  warnings: string[];
};

export type PlatformAccessInput = {
  userId?: string | null;
  authenticated?: boolean;
  platformRole?: string | null;
  platformRoleAuthority?: PlatformRoleAuthority;
  accountType?: string | null;
  effectiveMembershipTier?: string | null;
  membershipOverride?: string | null;
  billingPlan?: string | null;
  billingStatus?: string | null;
  billingPeriodEnd?: string | null;
  workspaceId?: string | null;
  workspaceRole?: string | null;
  providerState?: PlatformAccessContext['providerState'];
  suspended?: boolean;
  now?: Date;
};

export type CapabilityRequirement = {
  capability: PlatformCapability;
  label: string;
  requiresAuth?: boolean;
  minimumTier?: MembershipTier;
  entitlement?: EntitlementKey;
  accountTypes?: AccountType[];
  minimumWorkspaceRole?: WorkspaceRole;
  platformRoles?: Exclude<PlatformRole, 'user'>[];
};

export type ClientSafePlatformAccess = Pick<
  PlatformAccessContext,
  | 'authenticated'
  | 'platformRole'
  | 'platformRoleAuthority'
  | 'accountType'
  | 'membershipTier'
  | 'billingStatus'
  | 'entitlements'
  | 'workspaceRole'
  | 'suspended'
>;

export const PLATFORM_ROLE_RANK: Record<PlatformRole, number> = {
  user: 0,
  analyst: 1,
  support: 2,
  admin: 3,
  owner: 4,
};

export const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  member: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export const CAPABILITY_REGISTRY: Record<PlatformCapability, CapabilityRequirement> = {
  'collection.read': { capability: 'collection.read', label: 'Read collection', minimumTier: 'free' },
  'collection.write': { capability: 'collection.write', label: 'Manage collection', minimumTier: 'free' },
  'deck.manage': { capability: 'deck.manage', label: 'Manage Deck Vault', minimumTier: 'free' },
  'scanner.use': { capability: 'scanner.use', label: 'Use scanner', minimumTier: 'free', entitlement: 'card-scanner' },
  'scanner.advanced': { capability: 'scanner.advanced', label: 'Advanced scanner tools', minimumTier: 'collector' },
  'binder.manage': { capability: 'binder.manage', label: 'Manage Trade Binder', minimumTier: 'collector', entitlement: 'trade-binder' },
  'wishlist.manage': { capability: 'wishlist.manage', label: 'Manage Wishlist', minimumTier: 'collector', entitlement: 'wishlist' },
  'inventory.manage': { capability: 'inventory.manage', label: 'Manage inventory', minimumTier: 'seller' },
  'label.view': { capability: 'label.view', label: 'View Label Studio', minimumTier: 'seller' },
  'label.manage_templates': { capability: 'label.manage_templates', label: 'Manage label templates', minimumTier: 'seller', minimumWorkspaceRole: 'manager' },
  'label.print': { capability: 'label.print', label: 'Print inventory labels', minimumTier: 'seller', minimumWorkspaceRole: 'member' },
  'inventory.reprice': { capability: 'inventory.reprice', label: 'Review inventory repricing', minimumTier: 'seller', minimumWorkspaceRole: 'manager' },
  'pos.sell': { capability: 'pos.sell', label: 'Sell through POS', minimumTier: 'seller', minimumWorkspaceRole: 'member' },
  'buying.manage': { capability: 'buying.manage', label: 'Manage buying workflows', minimumTier: 'seller', entitlement: 'deal-desk' },
  'orders.manage': { capability: 'orders.manage', label: 'Manage orders', minimumTier: 'seller' },
  'marketplaces.manage': { capability: 'marketplaces.manage', label: 'Manage marketplaces', minimumTier: 'seller' },
  'analytics.view': { capability: 'analytics.view', label: 'View analytics', minimumTier: 'collector' },
  'automation.manage': { capability: 'automation.manage', label: 'Manage automation', minimumTier: 'seller' },
  'csv.export': { capability: 'csv.export', label: 'Export CSV data', minimumTier: 'collector' },
  'crm.manage': { capability: 'crm.manage', label: 'Manage CRM', minimumTier: 'seller' },
  'employees.manage': { capability: 'employees.manage', label: 'Manage employees', minimumTier: 'store', minimumWorkspaceRole: 'manager' },
  'payroll.manage': { capability: 'payroll.manage', label: 'Manage payroll', minimumTier: 'store', minimumWorkspaceRole: 'admin' },
  'vendors.manage': { capability: 'vendors.manage', label: 'Manage vendors', minimumTier: 'store', minimumWorkspaceRole: 'manager' },
  'supplies.manage': { capability: 'supplies.manage', label: 'Manage supplies', minimumTier: 'store', minimumWorkspaceRole: 'member' },
  'events.manage': { capability: 'events.manage', label: 'Manage events', minimumTier: 'store', minimumWorkspaceRole: 'member' },
  'finances.manage': { capability: 'finances.manage', label: 'Manage finances', minimumTier: 'store', minimumWorkspaceRole: 'admin' },
  'businessIntelligence.view': { capability: 'businessIntelligence.view', label: 'View business intelligence', minimumTier: 'store' },
  'support.access': { capability: 'support.access', label: 'Access support', minimumTier: 'free' },
  'workspace.manage': { capability: 'workspace.manage', label: 'Manage workspace', minimumTier: 'store', minimumWorkspaceRole: 'admin' },
  'workspace.members.manage': { capability: 'workspace.members.manage', label: 'Manage workspace members', minimumTier: 'store', minimumWorkspaceRole: 'admin' },
  'billing.manage': { capability: 'billing.manage', label: 'Manage billing', minimumWorkspaceRole: 'owner' },
  'platform.admin': {
    capability: 'platform.admin',
    label: 'Access platform administration',
    platformRoles: ['owner', 'admin', 'support', 'analyst'],
  },
};

const MEMBERSHIP_TIER_RANK: Record<MembershipTier, number> = {
  free: 0,
  collector: 1,
  seller: 2,
  store: 3,
};

export function normalizePlatformRole(value: unknown): PlatformRole {
  return value === 'owner' || value === 'admin' || value === 'support' || value === 'analyst'
    ? value
    : 'user';
}

export function normalizeWorkspaceRole(value: unknown): WorkspaceRole | null {
  if (value === 'owner' || value === 'admin' || value === 'manager' || value === 'member' || value === 'viewer') {
    return value;
  }
  return null;
}

export function hasPlatformRole(role: PlatformRole, minimum: Exclude<PlatformRole, 'user'>) {
  return PLATFORM_ROLE_RANK[role] >= PLATFORM_ROLE_RANK[minimum];
}

export function hasTrustedOwnerAccess(access: Pick<PlatformAccessContext, 'platformRole' | 'platformRoleAuthority' | 'authenticated' | 'suspended'> | Pick<ClientSafePlatformAccess, 'platformRole' | 'platformRoleAuthority' | 'authenticated' | 'suspended'>) {
  return access.authenticated &&
    !access.suspended &&
    access.platformRole === 'owner' &&
    access.platformRoleAuthority === 'trusted';
}

export function hasTrustedFullPlatformAccess(access: Pick<PlatformAccessContext, 'platformRole' | 'platformRoleAuthority' | 'authenticated' | 'suspended'> | Pick<ClientSafePlatformAccess, 'platformRole' | 'platformRoleAuthority' | 'authenticated' | 'suspended'>) {
  return access.authenticated &&
    !access.suspended &&
    access.platformRoleAuthority === 'trusted' &&
    (access.platformRole === 'owner' || access.platformRole === 'admin');
}

export function hasWorkspaceRole(role: WorkspaceRole | null, minimum: WorkspaceRole) {
  return Boolean(role) && WORKSPACE_ROLE_RANK[role as WorkspaceRole] >= WORKSPACE_ROLE_RANK[minimum];
}

export function resolvePlatformAccessContext(input: PlatformAccessInput = {}): PlatformAccessContext {
  const warnings: string[] = [];
  const userId = input.userId ?? null;
  const authenticated = input.authenticated ?? Boolean(userId);
  const platformRole = normalizePlatformRole(input.platformRole);
  const platformRoleAuthority = input.platformRoleAuthority ?? (input.platformRole ? 'trusted' : 'client');
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
  const membershipTier = input.effectiveMembershipTier
    ? normalizeMembershipTier(input.effectiveMembershipTier)
    : input.membershipOverride
      ? normalizeMembershipTier(input.membershipOverride)
      : billingTier;
  const workspaceRole = normalizeWorkspaceRole(input.workspaceRole);
  const suspended = Boolean(input.suspended) || billingStatus === 'suspended';

  if (!input.platformRole && authenticated) warnings.push('missing_role');
  if (!input.accountType && authenticated) warnings.push('missing_account_type');
  if (!input.membershipOverride && !input.billingPlan && !input.effectiveMembershipTier && authenticated) {
    warnings.push('missing_membership');
  }
  if (billingStatus === 'past_due' && !paidBillingIsCurrent) warnings.push('stale_billing');
  if (suspended) warnings.push('suspended_account');

  const entitlements = suspended
    ? []
    : hasTrustedFullPlatformAccess({
        authenticated,
        platformRole,
        platformRoleAuthority,
        suspended,
      })
      ? uniqueEntitlements([
          ...getEntitlementsForTier('free'),
          ...getEntitlementsForTier('collector'),
          ...getEntitlementsForTier('seller'),
          ...getEntitlementsForTier('store'),
        ])
      : getEntitlementsForTier(membershipTier);
  if (platformRole !== 'user' && !suspended) entitlements.push('admin.command-center');

  return {
    userId,
    authenticated,
    platformRole,
    platformRoleAuthority,
    accountType,
    membershipTier,
    billingStatus,
    entitlements,
    workspaceId: input.workspaceId ?? null,
    workspaceRole,
    providerState: input.providerState ?? 'unknown',
    suspended,
    warnings,
  };
}

export function hasCapability(access: PlatformAccessContext | ClientSafePlatformAccess, capability: PlatformCapability) {
  const requirement = CAPABILITY_REGISTRY[capability];
  if (!requirement) return false;
  if (requirement.requiresAuth !== false && !access.authenticated) return false;
  if (access.suspended) return false;
  if (hasTrustedFullPlatformAccess(access)) return true;

  if (requirement.platformRoles?.length) {
    return access.platformRoleAuthority === 'trusted' &&
      requirement.platformRoles.includes(access.platformRole as Exclude<PlatformRole, 'user'>);
  }

  if (requirement.minimumTier && MEMBERSHIP_TIER_RANK[access.membershipTier] < MEMBERSHIP_TIER_RANK[requirement.minimumTier]) {
    return false;
  }
  if (requirement.accountTypes && !requirement.accountTypes.includes(access.accountType)) return false;
  if (requirement.entitlement && !access.entitlements.includes(requirement.entitlement)) return false;
  if (requirement.minimumWorkspaceRole && !hasWorkspaceRole(access.workspaceRole, requirement.minimumWorkspaceRole)) {
    return false;
  }
  return true;
}

export function toClientSafeAccess(access: PlatformAccessContext): ClientSafePlatformAccess {
  return {
    authenticated: access.authenticated,
    platformRole: access.platformRole,
    platformRoleAuthority: access.platformRoleAuthority,
    accountType: access.accountType,
    membershipTier: access.membershipTier,
    billingStatus: access.billingStatus,
    entitlements: [...access.entitlements],
    workspaceRole: access.workspaceRole,
    suspended: access.suspended,
  };
}

export function clientAccessFromTier(tier: unknown, options: Partial<ClientSafePlatformAccess> = {}): ClientSafePlatformAccess {
  const membershipTier = normalizeMembershipTier(tier);
  return {
    authenticated: options.authenticated ?? true,
    platformRole: 'user',
    platformRoleAuthority: 'client',
    accountType: options.accountType ?? normalizeAccountType(tier),
    membershipTier,
    billingStatus: options.billingStatus ?? (membershipTier === 'free' ? 'free' : 'active'),
    entitlements: options.entitlements ?? getEntitlementsForTier(membershipTier),
    workspaceRole: options.workspaceRole ?? (membershipTier === 'store' ? 'owner' : null),
    suspended: options.suspended ?? false,
  };
}

function uniqueEntitlements(entitlements: EntitlementKey[]) {
  return [...new Set(entitlements)];
}
