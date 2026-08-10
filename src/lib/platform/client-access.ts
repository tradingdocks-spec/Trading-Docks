import {
  clientAccessFromTier,
  hasCapability,
  hasTrustedOwnerAccess,
  toClientSafeAccess,
  type ClientSafePlatformAccess,
  type PlatformAccessContext,
  type PlatformCapability,
} from "../../../mobile/services/platform-access.ts";
import { hasRouteAccess } from "./route-access";

export {
  clientAccessFromTier,
  hasCapability,
  hasTrustedOwnerAccess,
  toClientSafeAccess,
  type ClientSafePlatformAccess,
  type PlatformAccessContext,
  type PlatformCapability,
};

export function canShowCapability(access: ClientSafePlatformAccess, capability: PlatformCapability) {
  return hasCapability(access, capability);
}

export function canShowRoute(
  access: ClientSafePlatformAccess,
  pathname: string,
  env: "development" | "production" | "test" = "production",
) {
  return hasRouteAccess(access, pathname, env);
}
