import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { apiCapabilityDecision } from "../../../../lib/platform/api-access.ts";
import type { PlatformAccessContext } from "../../../../../mobile/services/platform-access.ts";

export type ScannerAuthTrace = {
  authorizationHeaderPresent: boolean;
  authorizationHeaderScheme: string | null;
  bearerTokenLength: number | null;
  supabaseProjectHost: string | null;
  getUserAttempted: boolean;
  getUserSucceeded: boolean;
  resolvedUserIdPresent: boolean;
  resolvedUserEmailPresent: boolean;
  capabilityCheckAttempted: boolean;
  capabilityCheckSucceeded: boolean;
  finalAuthStatus: "authenticated" | "unauthorized" | "forbidden";
  sessionPresent: boolean;
  accessTokenPresent: boolean;
  authorizationHeaderAttached: boolean;
  backendAuthorizationHeaderPresent: boolean;
  authenticatedUserResolved: boolean;
  capabilityResolved: boolean;
};

export type ScannerAuthActor = {
  userId: string;
  access: PlatformAccessContext;
};

export type ScannerAuthCapability = {
  allowed: boolean;
  status: 200 | 401 | 403;
  error: string | null;
};

export type ScannerAuthDependencies = {
  createSupabaseClient?: typeof createSupabaseClient;
  createClient?: () => Promise<CookieClientLike>;
  resolvePlatformAccessForUser?: (supabase: unknown, user: AuthUser) => Promise<PlatformAccessContext>;
};

export async function authenticateScannerRequest(
  request: Request,
  deps: ScannerAuthDependencies = {},
): Promise<{ actor: ScannerAuthActor | null; capability: ScannerAuthCapability; trace: ScannerAuthTrace }> {
  const createBearerClient = deps.createSupabaseClient ?? createSupabaseClient;
  const createCookieClient = deps.createClient ?? loadCookieClient;
  const resolveAccess = deps.resolvePlatformAccessForUser ?? loadResolvedAccess;
  const authorization = request.headers.get("authorization");
  const authorizationHeaderPresent = Boolean(authorization?.trim());
  const authorizationHeaderScheme = authorizationHeaderPresent ? authorization!.trim().split(/\s+/)[0] ?? null : null;
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
  const supabaseProjectHost = safeSupabaseHost(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (bearerToken) {
    const trace = baseTrace({
      authorizationHeaderPresent,
      authorizationHeaderScheme,
      bearerTokenLength: bearerToken.length,
      supabaseProjectHost,
      authorizationHeaderAttached: true,
    });
    const client = createBearerClientForValidation(createBearerClient, deps);
    if (!client) {
      return {
        actor: null,
        capability: unauthorizedCapability(),
        trace: finalizeTrace(trace, "unauthorized", false, false, false, false),
      };
    }

    trace.getUserAttempted = true;
    const { data, error } = await client.auth.getUser(bearerToken);
    const user = data.user ?? null;
    trace.getUserSucceeded = !error && Boolean(user);
    trace.resolvedUserIdPresent = Boolean(user?.id);
    trace.resolvedUserEmailPresent = Boolean(user?.email);
    trace.sessionPresent = Boolean(user);
    trace.accessTokenPresent = true;
    trace.authenticatedUserResolved = Boolean(user);

    if (!user || error) {
      return {
        actor: null,
        capability: unauthorizedCapability(),
        trace: finalizeTrace(trace, "unauthorized", true, false, false, false),
      };
    }

    const access = await resolveAccess(client, user);
    const capability = apiCapabilityDecision(access, "scanner.use");
    trace.capabilityCheckAttempted = true;
    trace.capabilityCheckSucceeded = capability.allowed;
    trace.capabilityResolved = capability.allowed;
    return {
      actor: { userId: user.id, access },
      capability,
      trace: finalizeTrace(trace, capability.allowed ? "authenticated" : "forbidden", true, true, true, capability.allowed),
    };
  }

  const supabase = await createCookieClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const trace = baseTrace({
    authorizationHeaderPresent,
    authorizationHeaderScheme,
    bearerTokenLength: null,
    supabaseProjectHost,
    authorizationHeaderAttached: false,
  });
  trace.getUserAttempted = true;
  trace.getUserSucceeded = Boolean(user);
  trace.resolvedUserIdPresent = Boolean(user?.id);
  trace.resolvedUserEmailPresent = Boolean(user?.email);
  trace.sessionPresent = Boolean(user);
  trace.accessTokenPresent = Boolean(user);
  trace.authenticatedUserResolved = Boolean(user);
  if (!user) {
    return {
      actor: null,
      capability: unauthorizedCapability(),
      trace: finalizeTrace(trace, "unauthorized", true, false, false, false),
    };
  }
  const access = await resolveAccess(supabase, user);
  const capability = apiCapabilityDecision(access, "scanner.use");
  trace.capabilityCheckAttempted = true;
  trace.capabilityCheckSucceeded = capability.allowed;
  trace.capabilityResolved = capability.allowed;
  return {
    actor: { userId: user.id, access },
    capability,
    trace: finalizeTrace(trace, capability.allowed ? "authenticated" : "forbidden", true, true, true, capability.allowed),
  };
}

export function resolveScannerCapabilityTrace(trace: ScannerAuthTrace, capabilityAllowed: boolean): ScannerAuthTrace {
  return {
    ...trace,
    capabilityResolved: capabilityAllowed,
  };
}

export function logScannerAuthTrace(trace: ScannerAuthTrace) {
  if (process.env.NODE_ENV === "production") return;
  console.info("TD_SCANNER_AUTH_SERVER", trace);
}

export function scannerAuthFailureResponse(trace: ScannerAuthTrace, error: string, status = 401) {
  return {
    error,
    auth: trace,
    status,
  };
}

type AuthUser = {
  id: string;
  email?: string | null;
  banned_until?: string | null;
};

type CookieClientLike = {
  auth: {
    getUser: () => PromiseLike<{ data: { user: AuthUser | null } }>;
  };
};

async function loadCookieClient() {
  const { createClient } = await import("../../../../lib/supabase/server.ts");
  return createClient();
}

async function loadResolvedAccess(supabase: unknown, user: AuthUser) {
  const { resolvePlatformAccessForUser } = await import("../../../../lib/platform/server-access.ts");
  return resolvePlatformAccessForUser(supabase, user);
}

function baseTrace(input: {
  authorizationHeaderPresent: boolean;
  authorizationHeaderScheme: string | null;
  bearerTokenLength: number | null;
  supabaseProjectHost: string | null;
  authorizationHeaderAttached: boolean;
}): ScannerAuthTrace {
  return {
    authorizationHeaderPresent: input.authorizationHeaderPresent,
    authorizationHeaderScheme: input.authorizationHeaderScheme,
    bearerTokenLength: input.bearerTokenLength,
    supabaseProjectHost: input.supabaseProjectHost,
    getUserAttempted: false,
    getUserSucceeded: false,
    resolvedUserIdPresent: false,
    resolvedUserEmailPresent: false,
    capabilityCheckAttempted: false,
    capabilityCheckSucceeded: false,
    finalAuthStatus: "unauthorized",
    sessionPresent: false,
    accessTokenPresent: false,
    authorizationHeaderAttached: input.authorizationHeaderAttached,
    backendAuthorizationHeaderPresent: input.authorizationHeaderAttached,
    authenticatedUserResolved: false,
    capabilityResolved: false,
  };
}

function finalizeTrace(
  trace: ScannerAuthTrace,
  finalAuthStatus: ScannerAuthTrace["finalAuthStatus"],
  getUserAttempted: boolean,
  getUserSucceeded: boolean,
  capabilityCheckAttempted: boolean,
  capabilityCheckSucceeded: boolean,
): ScannerAuthTrace {
  return {
    ...trace,
    finalAuthStatus,
    getUserAttempted,
    getUserSucceeded,
    capabilityCheckAttempted,
    capabilityCheckSucceeded,
    capabilityResolved: capabilityCheckSucceeded,
  };
}

function unauthorizedCapability(): ScannerAuthCapability {
  return { allowed: false, status: 401, error: "Authentication required." };
}

function createBearerClientForValidation(
  createBearerClient: typeof createSupabaseClient,
  deps: ScannerAuthDependencies,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? (deps.createSupabaseClient ? "https://stub.supabase.co" : null);
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (deps.createSupabaseClient ? "stub-publishable-key" : null);
  if (!url || !key) return null;
  return createBearerClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function safeSupabaseHost(url: string | undefined) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
