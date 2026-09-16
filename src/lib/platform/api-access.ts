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
  { id: "public-card-images", pattern: /^\/api\/(catalog\/product-image|landing-card-image|scryfall-image|scryfall-card-image|tcg-image|tcgcsv\/image|card-shows\/image)(\/|$)/, kind: "public", label: "Public card image proxy" },
  { id: "public-market-data", pattern: /^\/api\/(market-cards|multi-game-market|deck-vault\/game-changers)(\/|$)/, kind: "public", label: "Public market data" },
  { id: "card-intelligence-inventory-validation", pattern: /^\/api\/card-intelligence\/inventory-validation\/?$/, kind: "capability", capability: "collection.write", label: "Authoritative inventory printing validation" },
  { id: "public-card-intelligence", pattern: /^\/api\/card-intelligence(\/|$)/, kind: "public", label: "Rate-limited card intelligence lookup" },
  { id: "admin", pattern: /^\/api\/admin(\/|$)/, kind: "admin-only", capability: "platform.admin", label: "Admin APIs" },
  { id: "billing", pattern: /^\/api\/billing\/revenuecat(\/|$)/, kind: "authenticated", label: "RevenueCat billing checkout and management" },
  { id: "employee-invitation", pattern: /^\/api\/workspace\/employees\/invite\/?$/, kind: "authenticated", label: "Employee invitation; workspace manager role enforced by handler" },
  { id: "scanner", pattern: /^\/api\/scanner(\/|$)/, kind: "capability", capability: "scanner.use", label: "Mobile scanner provider APIs" },
  { id: "chaos-sort", pattern: /^\/api\/chaos-sort(\/|$)/, kind: "capability", capability: "collection.write", label: "Chaos Sort inventory commit" },
  { id: "collector-workspace", pattern: /^\/api\/collector-workspace(\/|$)/, kind: "capability", capability: "collection.write", label: "Collector Workspace mutations" },
  { id: "label-studio", pattern: /^\/api\/label-studio(\/|$)/, kind: "capability", capability: "label.view", label: "Label Studio APIs" },
  { id: "collector-portfolio", pattern: /^\/api\/collector-portfolio(\/|$)/, kind: "capability", capability: "binder.manage", label: "Collector portfolio APIs" },
  { id: "inventory", pattern: /^\/api\/inventory(\/|$)/, kind: "capability", capability: "collection.read", label: "Inventory APIs" },
  { id: "deck-vault", pattern: /^\/api\/deck-vault(\/|$)/, kind: "capability", capability: "deck.manage", label: "Deck Vault APIs" },
  { id: "deck-architect", pattern: /^\/api\/deck-architect(\/|$)/, kind: "capability", capability: "deck.manage", label: "Deck Architect APIs" },
  { id: "csv", pattern: /^\/api\/(csv-converter|tools\/csv)(\/|$)/, kind: "capability", capability: "csv.export", label: "CSV APIs" },
  { id: "buying", pattern: /^\/api\/(buylist|collection-intake|market-intelligence|purchasing|purchase-history|precon-intelligence|tcgcsv\/sealed)(\/|$)/, kind: "capability", capability: "buying.manage", label: "Buying APIs" },
  { id: "card-shows", pattern: /^\/api\/card-shows(\/|$)/, kind: "capability", capability: "buying.manage", label: "Card Show APIs" },
  { id: "marketplaces", pattern: /^\/api\/marketplaces(\/|$)/, kind: "capability", capability: "marketplaces.manage", label: "Marketplace APIs" },
  { id: "orders", pattern: /^\/api\/orders(\/|$)/, kind: "capability", capability: "orders.manage", label: "Order APIs" },
  { id: "marketing-unsubscribe", pattern: /^\/api\/marketing\/unsubscribe(\/|$)/, kind: "public", label: "Marketing unsubscribe API" },
  { id: "marketing", pattern: /^\/api\/marketing(\/|$)/, kind: "capability", capability: "crm.manage", label: "CRM marketing APIs" },
  { id: "binder-shares", pattern: /^\/api\/binder-shares(\/|$)/, kind: "capability", capability: "binder.manage", label: "Binder share API" },
  { id: "showcase", pattern: /^\/api\/showcase(\/|$)/, kind: "public", label: "Showcase public and guarded APIs" },
  { id: "public-tournament-registration", pattern: /^\/api\/events\/[^/]+\/register\/?$/, kind: "public", label: "Public tournament registration" },
  { id: "tournament-operations", pattern: /^\/api\/dashboard\/tournaments(\/|$)/, kind: "capability", capability: "events.manage", label: "Tournament operations" },
  { id: "discord-integrations", pattern: /^\/api\/integrations\/discord(\/|$)/, kind: "authenticated", label: "Discord integration" },
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
