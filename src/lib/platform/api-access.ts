import {
  hasCapability,
  type ClientSafePlatformAccess,
  type PlatformAccessContext,
  type PlatformCapability,
} from "../../../mobile/services/platform-access.ts";

export type ApiAccessKind =
  | "public"
  | "authenticated"
  | "capability"
  | "admin-only"
  | "webhook"
  | "server-only";

export type ApiAccessRule = {
  id: string;
  pattern: RegExp;
  kind: ApiAccessKind;
  capability?: PlatformCapability;
  label: string;
};

export const API_ACCESS_REGISTRY: ApiAccessRule[] = [
  { id: "revenuecat-webhook", pattern: /^\/api\/webhooks\/revenuecat\/?$/, kind: "webhook", label: "RevenueCat webhook" },
  { id: "cloudflare-email-webhook", pattern: /^\/api\/webhooks\/cloudflare-email\/?$/, kind: "webhook", label: "Cloudflare email webhook" },
  { id: "public-card-images", pattern: /^\/api\/(landing-card-image|scryfall-image|scryfall-card-image|tcg-image|tcgcsv\/image|card-shows\/image)(\/|$)/, kind: "public", label: "Public card image proxy" },
  { id: "public-market-data", pattern: /^\/api\/(market-cards|multi-game-market|deck-vault\/game-changers)(\/|$)/, kind: "public", label: "Public market data" },
  { id: "admin", pattern: /^\/api\/admin(\/|$)/, kind: "admin-only", capability: "platform.admin", label: "Admin APIs" },
  { id: "billing", pattern: /^\/api\/billing\/revenuecat(\/|$)/, kind: "authenticated", label: "RevenueCat billing checkout and management" },
  { id: "collector-workspace", pattern: /^\/api\/collector-workspace(\/|$)/, kind: "capability", capability: "collection.write", label: "Collector Workspace mutations" },
  { id: "label-studio", pattern: /^\/api\/label-studio(\/|$)/, kind: "capability", capability: "label.view", label: "Label Studio APIs" },
  { id: "collector-portfolio", pattern: /^\/api\/collector-portfolio(\/|$)/, kind: "capability", capability: "binder.manage", label: "Collector portfolio APIs" },
  { id: "inventory", pattern: /^\/api\/inventory(\/|$)/, kind: "capability", capability: "collection.read", label: "Inventory APIs" },
  { id: "deck-vault", pattern: /^\/api\/deck-vault(\/|$)/, kind: "capability", capability: "deck.manage", label: "Deck Vault APIs" },
  { id: "csv", pattern: /^\/api\/(csv-converter|tools\/csv)(\/|$)/, kind: "capability", capability: "csv.export", label: "CSV APIs" },
  { id: "buying", pattern: /^\/api\/(buylist|market-intelligence|purchasing|precon-intelligence|tcgcsv\/sealed)(\/|$)/, kind: "capability", capability: "buying.manage", label: "Buying APIs" },
  { id: "card-shows", pattern: /^\/api\/card-shows(\/|$)/, kind: "capability", capability: "buying.manage", label: "Card Show APIs" },
  { id: "marketplaces", pattern: /^\/api\/marketplaces(\/|$)/, kind: "capability", capability: "marketplaces.manage", label: "Marketplace APIs" },
  { id: "orders", pattern: /^\/api\/orders(\/|$)/, kind: "capability", capability: "orders.manage", label: "Order APIs" },
  { id: "binder-shares", pattern: /^\/api\/binder-shares(\/|$)/, kind: "authenticated", label: "Binder share API" },
  { id: "tcgcsv-sync", pattern: /^\/api\/tcgcsv\/sync(\/|$)/, kind: "server-only", label: "TCGCSV server sync" },
];

const UNKNOWN_API_RULE: ApiAccessRule = {
  id: "api-fallback",
  pattern: /^\/api(\/|$)/,
  kind: "server-only",
  label: "Unclassified API route",
};

export function apiAccessRuleForPath(pathname: string) {
  return API_ACCESS_REGISTRY.find((rule) => rule.pattern.test(pathname))
    ?? (pathname.startsWith("/api") ? UNKNOWN_API_RULE : null);
}

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
