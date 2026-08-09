import { CANONICAL_HOST } from "./auth-cookie-policy.ts";

export function shouldRedirectToCanonicalHost(requestHost: string | null) {
  if (!requestHost || requestHost === CANONICAL_HOST) return false;

  return process.env.VERCEL_ENV === "production";
}

export function canonicalizeTradingDocksUrl(url: URL) {
  const canonicalUrl = new URL(url);
  canonicalUrl.protocol = "https";
  canonicalUrl.hostname = CANONICAL_HOST;
  canonicalUrl.port = "";
  return canonicalUrl;
}
