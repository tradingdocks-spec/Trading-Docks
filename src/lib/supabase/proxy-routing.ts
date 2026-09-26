const PUBLIC_API_PREFIXES = [
  "/api/landing-card-image/",
  "/api/scryfall-card-image/",
  "/api/scryfall-image/",
  "/api/tcg-image",
  "/api/tcgcsv/image/",
  "/api/card-shows/image/",
  "/api/card-shows/search",
  "/api/market-cards",
  "/api/multi-game-market",
  "/api/storefront/catalog",
];

const API_AUTH_EXEMPT_PREFIXES = [
  "/api/webhooks/",
  "/api/marketplaces/",
  "/api/scanner/",
  "/api/showcase/kiosks/pair",
  "/api/showcase/kiosk",
];

export function apiRequiresAuthentication(pathname: string) {
  if (!pathname.startsWith("/api/")) return false;
  // Square authenticates the exact webhook route using its raw-body signature.
  if (pathname === "/api/payments/webhooks/square") return false;
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }
  if (API_AUTH_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }
  return true;
}

export function hasSupabasePublicConfig(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}

export function routeNeedsSessionLookup(pathname: string) {
  return (
    apiRequiresAuthentication(pathname) ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/onboarding") ||
    pathname === "/" ||
    pathname === "/sign-in" ||
    pathname === "/sign-up"
  );
}
