import {
  hasCapability,
  type ClientSafePlatformAccess,
  type PlatformAccessContext,
} from "../../mobile/services/platform-access.ts";

export const DECK_ARCHITECT_VISIBLE = false;
export const DECK_ARCHITECT_ROUTE = "/dashboard/deck-architect";

export function isDeckArchitectRoute(href: string) {
  return href === DECK_ARCHITECT_ROUTE || href.startsWith(`${DECK_ARCHITECT_ROUTE}/`);
}

export function shouldShowDeckArchitectEntry() {
  return DECK_ARCHITECT_VISIBLE;
}

export function canAccessHiddenDeckArchitect(
  access: PlatformAccessContext | ClientSafePlatformAccess,
) {
  return hasCapability(access, "platform.admin");
}
