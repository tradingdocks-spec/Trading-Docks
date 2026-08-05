import { logAuthDiagnostic, logAuthWarning } from './auth-diagnostics.ts';
import { normalizePlatformRole } from './access-model.ts';

export type MobileAccountType = 'free' | 'collector' | 'seller' | 'store';

type RoleQueryResult = {
  data?: { role?: string | null } | null;
  error?: { message?: string } | Error | null;
};

export type RoleLookupClient = {
  from: (table: 'user_roles') => {
    select: (columns: 'role') => {
      eq: (column: 'user_id', value: string) => {
        maybeSingle: () => Promise<RoleQueryResult> | unknown;
      };
    };
  };
};

export function workspaceRouteForAccountType(accountType: MobileAccountType) {
  return accountType === 'seller' || accountType === 'store'
    ? '/(tabs)/deal-desk'
    : '/(tabs)';
}

export async function lookupAdminRole(
  client: RoleLookupClient,
  userId: string,
) {
  try {
    const { data, error } = await client
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle() as RoleQueryResult;

    if (error) {
      const message = error instanceof Error ? error.message : error.message;
      logAuthWarning('admin_role_lookup_failed', { message });
      return null;
    }

    const role = normalizePlatformRole(data?.role);
    return role !== 'user'
      ? role
      : null;
  } catch (error) {
    logAuthWarning('admin_role_lookup_failed', {
      message: error instanceof Error ? error.message : 'Unknown role lookup error',
    });
    return null;
  }
}

export async function resolvePostAuthRoute({
  client,
  userId,
  accountType,
}: {
  client: RoleLookupClient | null;
  userId: string | null;
  accountType: MobileAccountType;
}) {
  if (client && userId) {
    const role = await lookupAdminRole(client, userId);
    if (role) {
      logAuthDiagnostic('admin_role_available_after_auth', { role });
    }
  }

  const route = workspaceRouteForAccountType(accountType);
  logAuthDiagnostic('route_workspace_after_auth', { accountType, route });
  return route;
}

export function clearFocusedElementForWeb(
  platform: string,
  documentRef?: { activeElement?: { blur?: () => void } | null },
) {
  if (platform !== 'web') return;
  const activeElement = documentRef?.activeElement;
  if (activeElement && 'blur' in activeElement && typeof activeElement.blur === 'function') {
    activeElement.blur();
  }
}
