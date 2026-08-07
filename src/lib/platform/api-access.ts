import {
  hasCapability,
  type ClientSafePlatformAccess,
  type PlatformAccessContext,
  type PlatformCapability,
} from "../../../mobile/services/platform-access.ts";

export function apiCapabilityDecision(
  access: PlatformAccessContext | ClientSafePlatformAccess,
  capability: PlatformCapability,
) {
  if (!access.authenticated) {
    return { allowed: false as const, status: 401 as const, error: "Authentication required." };
  }
  if (!hasCapability(access, capability)) {
    return { allowed: false as const, status: 403 as const, error: "You do not have access to this Trading Docks capability." };
  }
  return { allowed: true as const, status: 200 as const, error: null };
}
