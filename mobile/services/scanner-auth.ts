export type ScannerAuthTrace = {
  sessionPresent: boolean;
  accessTokenPresent: boolean;
  authorizationHeaderAttached: boolean;
  backendAuthorizationHeaderPresent: boolean | null;
  authenticatedUserResolved: boolean | null;
  capabilityResolved: boolean | null;
};

export type ScannerAccessTokenResolution = {
  accessToken: string | null;
  sessionPresent: boolean;
  accessTokenPresent: boolean;
  refreshAttempted: boolean;
  refreshSucceeded: boolean;
};

type SupabaseAuthClientLike = {
  auth: {
    getSession: () => Promise<{ data: { session: SessionLike | null }; error?: { message?: string } | null }>;
    refreshSession: () => Promise<{ data: { session: SessionLike | null }; error?: { message?: string } | null }>;
  };
};

type SessionLike = {
  access_token?: string | null;
  expires_at?: number | null;
};

export async function resolveScannerAccessToken(input: {
  getAccessToken?: () => Promise<string | null> | string | null;
  client?: SupabaseAuthClientLike | null;
  forceRefresh?: boolean;
  minimumFreshnessSeconds?: number;
} = {}): Promise<ScannerAccessTokenResolution> {
  if (input.getAccessToken) {
    const accessToken = await input.getAccessToken();
    return {
      accessToken,
      sessionPresent: Boolean(accessToken),
      accessTokenPresent: Boolean(accessToken),
      refreshAttempted: false,
      refreshSucceeded: false,
    };
  }

  const client = input.client ?? await loadSupabaseAuthClient();
  if (!client) {
    return {
      accessToken: null,
      sessionPresent: false,
      accessTokenPresent: false,
      refreshAttempted: false,
      refreshSucceeded: false,
    };
  }

  let refreshAttempted = false;
  let refreshSucceeded = false;
  const sessionResult = await client.auth.getSession().catch(() => ({ data: { session: null }, error: null }));
  let session = sessionResult.data.session ?? null;
  const shouldRefresh = input.forceRefresh || !session?.access_token || isSessionExpiringSoon(session, input.minimumFreshnessSeconds ?? 120);
  if (shouldRefresh) {
    refreshAttempted = true;
    const refreshed = await client.auth.refreshSession().catch(() => ({ data: { session: null }, error: null }));
    if (!refreshed.error && refreshed.data.session?.access_token) {
      session = refreshed.data.session;
      refreshSucceeded = true;
    }
  }

  return {
    accessToken: session?.access_token ?? null,
    sessionPresent: Boolean(session),
    accessTokenPresent: Boolean(session?.access_token),
    refreshAttempted,
    refreshSucceeded,
  };
}

export function logScannerAuthTrace(trace: ScannerAuthTrace) {
  if (!(typeof __DEV__ !== 'undefined' && __DEV__)) return;
  console.info('TD_SCANNER_AUTH', trace);
}

function isSessionExpiringSoon(session: SessionLike | null, minimumFreshnessSeconds: number) {
  if (!session?.expires_at) return false;
  const remainingSeconds = session.expires_at - Math.floor(Date.now() / 1000);
  return remainingSeconds <= Math.max(0, minimumFreshnessSeconds);
}

async function loadSupabaseAuthClient(): Promise<SupabaseAuthClientLike | null> {
  const { supabase } = await import('../lib/supabase.ts');
  if (!supabase) return null;
  return supabase as unknown as SupabaseAuthClientLike;
}
