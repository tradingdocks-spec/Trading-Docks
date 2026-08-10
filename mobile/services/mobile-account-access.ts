import {
  normalizeAccountType,
  hasTrustedOwnerAccess,
  resolvePlatformAccessContext,
  type AccountType,
  type BillingStatus,
  type MembershipTier,
  type PlatformAccessContext,
  type PlatformRole,
} from './platform-access.ts';

export type MobileAccountAccessSnapshot = {
  accountType: AccountType;
  membershipTier: MembershipTier;
  billingStatus: BillingStatus;
  platformRole: PlatformRole;
  hasFullPlatformAccess: boolean;
  source: 'server' | 'local_fallback' | 'signed_out';
  warnings: string[];
};

export type MobileAccountAccessRows = {
  role?: Record<string, unknown> | null;
  preferences?: Record<string, unknown> | null;
  subscription?: Record<string, unknown> | null;
  override?: Record<string, unknown> | null;
  workspace?: Record<string, unknown> | null;
};

export type MobileAccessClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: Record<string, unknown> | null; error: { message?: string; code?: string } | null }>;
      };
    };
  };
};

export async function loadMobileAccountAccessSnapshot({
  client,
  userId,
  localAccountType,
}: {
  client: MobileAccessClient | null;
  userId: string | null;
  localAccountType: AccountType;
}): Promise<MobileAccountAccessSnapshot> {
  if (!userId) {
    return {
      accountType: normalizeAccountType(localAccountType),
      membershipTier: 'free',
      billingStatus: 'free',
      platformRole: 'user',
      hasFullPlatformAccess: false,
      source: 'signed_out',
      warnings: [],
    };
  }
  if (!client) {
    return localFallback(localAccountType, ['supabase_not_configured']);
  }

  const [role, preferences, subscription, override, workspace] = await Promise.all([
    safeMaybeSingle(client, 'user_roles', 'role', userId),
    safeMaybeSingle(client, 'user_preferences', 'preferences,active_workspace_id', userId),
    safeMaybeSingle(client, 'billing_subscriptions', 'plan_id,status,current_period_end,provider', userId),
    safeMaybeSingle(client, 'admin_membership_overrides', 'plan_id', userId),
    safeMaybeSingle(client, 'workspace_members', 'workspace_id,role', userId),
  ]);

  return resolveMobileAccountAccessSnapshot({
    userId,
    localAccountType,
    rows: {
      role: role.data,
      preferences: preferences.data,
      subscription: subscription.data,
      override: override.data,
      workspace: workspace.data,
    },
    queryErrors: [role.error, preferences.error, subscription.error, override.error, workspace.error]
      .filter((error): error is string => Boolean(error)),
  });
}

export function resolveMobileAccountAccessSnapshot({
  userId,
  localAccountType,
  rows,
  queryErrors = [],
  now,
}: {
  userId: string;
  localAccountType: AccountType;
  rows: MobileAccountAccessRows;
  queryErrors?: string[];
  now?: Date;
}): MobileAccountAccessSnapshot {
  const preferences = objectRecord(rows.preferences?.preferences);
  const activeWorkspaceId =
    stringValue(rows.preferences?.active_workspace_id) ??
    stringValue(preferences.active_workspace_id) ??
    stringValue(rows.workspace?.workspace_id);

  const access = resolvePlatformAccessContext({
    userId,
    authenticated: true,
    platformRole: stringValue(rows.role?.role),
    platformRoleAuthority: 'trusted',
    accountType: stringValue(preferences.account_type) ?? localAccountType,
    membershipOverride: stringValue(rows.override?.plan_id),
    billingPlan: stringValue(rows.subscription?.plan_id),
    billingStatus: stringValue(rows.subscription?.status),
    billingPeriodEnd: stringValue(rows.subscription?.current_period_end),
    workspaceId: activeWorkspaceId,
    workspaceRole: stringValue(rows.workspace?.role),
    providerState: providerState(rows.subscription, rows.override),
    now,
  });

  const membershipBackedAccountType = access.membershipTier === 'free'
    ? access.accountType
    : access.membershipTier;

  return {
    accountType: membershipBackedAccountType,
    membershipTier: access.membershipTier,
    billingStatus: access.billingStatus,
    platformRole: access.platformRole,
    hasFullPlatformAccess: hasTrustedOwnerAccess(access),
    source: queryErrors.length ? 'local_fallback' : 'server',
    warnings: [...access.warnings, ...queryErrors],
  };
}

function providerState(subscription?: Record<string, unknown> | null, override?: Record<string, unknown> | null): PlatformAccessContext['providerState'] {
  if (stringValue(override?.plan_id)) return 'manual';
  const provider = stringValue(subscription?.provider);
  if (provider === 'revenuecat') return 'revenuecat';
  if (provider === 'stripe') return 'stripe';
  if (stringValue(subscription?.plan_id)) return 'stripe';
  return 'none';
}

async function safeMaybeSingle(client: MobileAccessClient, table: string, columns: string, userId: string) {
  try {
    const { data, error } = await client.from(table).select(columns).eq('user_id', userId).maybeSingle();
    return { data, error: error?.message ?? null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : `${table} lookup failed`,
    };
  }
}

function localFallback(localAccountType: AccountType, warnings: string[]): MobileAccountAccessSnapshot {
  const accountType = normalizeAccountType(localAccountType);
  return {
    accountType,
    membershipTier: 'free',
    billingStatus: warnings.includes('supabase_not_configured') ? 'free' : 'unknown',
    platformRole: 'user',
    hasFullPlatformAccess: false,
    source: 'local_fallback',
    warnings: [...warnings, 'membership_requires_server_confirmation'],
  };
}

function objectRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
