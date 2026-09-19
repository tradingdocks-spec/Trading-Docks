import { lookup } from "node:dns/promises";
import net from "node:net";

export const STORE_SEARCH_PHRASES = [
  "trading card store",
  "TCG store",
  "card shop",
  "local game store",
  "collectible card shop",
  "sports card store",
  "Pokémon card store",
  "Magic The Gathering store",
  "Yu-Gi-Oh card store",
  "tabletop game store",
  "comic card shop",
] as const;

export const STORE_SEARCH_RADII = [5, 10, 25, 50, 100] as const;
export type StoreSearchRadius = (typeof STORE_SEARCH_RADII)[number];

export type StoreDiscoveryResult = {
  providerPlaceId: string;
  businessName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  websiteUrl: string | null;
  listingUrl: string | null;
  category: string | null;
  openNow: boolean | null;
  distanceMiles: number | null;
  sourcePhrase: string;
  relevance: StoreRelevance;
};

export type StoreRelevance = {
  relevance: "high" | "medium" | "low" | "excluded";
  score: number;
  reasons: string[];
};

type PlacesResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    websiteUri?: string;
    googleMapsUri?: string;
    primaryTypeDisplayName?: { text?: string };
    primaryType?: string;
    types?: string[];
    location?: { latitude?: number; longitude?: number };
    currentOpeningHours?: { openNow?: boolean };
  }>;
};

export function validateStoreSearch(postalCode: string, radius: number): { postalCode: string; radius: StoreSearchRadius } {
  const normalizedZip = postalCode.trim();
  if (!/^\d{5}(?:-\d{4})?$/.test(normalizedZip)) throw new Error("Enter a valid five-digit US ZIP code.");
  if (!STORE_SEARCH_RADII.includes(radius as StoreSearchRadius)) throw new Error("Choose a supported search radius.");
  return { postalCode: normalizedZip.slice(0, 5), radius: radius as StoreSearchRadius };
}

export async function discoverStores(postalCode: string, radius: StoreSearchRadius, fetcher: typeof fetch = fetch, options: { broaderMatches?: boolean } = {}): Promise<StoreDiscoveryResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new StoreFinderConfigurationError("Google Places is not configured. Add GOOGLE_PLACES_API_KEY to enable Store Finder searches.");
  const center = await geocodeZip(postalCode, apiKey, fetcher);
  const seen = new Map<string, StoreDiscoveryResult>();
  for (const phrase of STORE_SEARCH_PHRASES) {
    const response = await fetcher("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.primaryTypeDisplayName,places.primaryType,places.types,places.location,places.currentOpeningHours",
      },
      body: JSON.stringify({
        textQuery: `${phrase} near ${postalCode}`,
        pageSize: 20,
        locationBias: { circle: { center: { latitude: center.latitude, longitude: center.longitude }, radius: radius * 1609.34 } },
        languageCode: "en",
      }),
    });
    if (!response.ok) throw new StoreFinderProviderError(`Google Places returned ${response.status}.`);
    const payload = await response.json() as PlacesResponse;
    for (const place of payload.places ?? []) {
      if (!place.id || !place.displayName?.text) continue;
      const latitude = place.location?.latitude ?? null;
      const longitude = place.location?.longitude ?? null;
      const result: StoreDiscoveryResult = {
        providerPlaceId: place.id,
        businessName: place.displayName.text,
        address: place.formattedAddress ?? "",
        city: addressPart(place.formattedAddress, 2),
        state: addressPart(place.formattedAddress, 1),
        postalCode: addressPart(place.formattedAddress, 0),
        latitude,
        longitude,
        phone: place.nationalPhoneNumber ?? null,
        websiteUrl: safeHttpUrl(place.websiteUri),
        listingUrl: safeHttpUrl(place.googleMapsUri),
        category: place.primaryTypeDisplayName?.text ?? null,
        openNow: place.currentOpeningHours?.openNow ?? null,
        distanceMiles: latitude !== null && longitude !== null ? haversineMiles(center.latitude, center.longitude, latitude, longitude) : null,
        sourcePhrase: phrase,
        relevance: classifyStoreRelevance({
          businessName: place.displayName.text,
          primaryType: place.primaryType,
          primaryTypeDisplayName: place.primaryTypeDisplayName?.text,
          types: place.types,
          websiteUrl: safeHttpUrl(place.websiteUri),
        }, phrase),
      };
      const existing = seen.get(place.id);
      if (!existing) seen.set(place.id, result);
      else {
        const relevanceRank = { high: 4, medium: 3, low: 2, excluded: 1 } as const;
        const preferred = relevanceRank[result.relevance.relevance] > relevanceRank[existing.relevance.relevance] ? result : existing;
        seen.set(place.id, { ...existing, ...result, ...preferred, websiteUrl: result.websiteUrl ?? existing.websiteUrl, phone: result.phone ?? existing.phone });
      }
    }
  }
  return filterStoreResults([...seen.values()].filter((place) => place.distanceMiles === null || place.distanceMiles <= radius), options.broaderMatches).sort((a, b) => {
    const relevanceOrder = { high: 0, medium: 1, low: 2, excluded: 3 } as const;
    return relevanceOrder[a.relevance.relevance] - relevanceOrder[b.relevance.relevance] || (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999);
  }).slice(0, 100);
}

export function filterStoreResults(results: StoreDiscoveryResult[], broaderMatches = false) {
  return results.filter((result) => result.relevance.relevance === "high" || result.relevance.relevance === "medium" || (broaderMatches && result.relevance.relevance === "low"));
}

export function classifyStoreRelevance(input: { businessName: string; primaryType?: string; primaryTypeDisplayName?: string; types?: string[]; websiteUrl?: string | null }, sourcePhrase: string): StoreRelevance {
  const searchable = [input.businessName, input.primaryType, input.primaryTypeDisplayName, ...(input.types ?? []), input.websiteUrl].filter(Boolean).join(" ").toLowerCase();
  const sourceSearchable = sourcePhrase.toLowerCase();
  const name = input.businessName.toLowerCase();
  const reasons: string[] = [];
  let score = 0;
  const add = (amount: number, reason: string) => { score += amount; reasons.push(reason); };
  if (/trading\s*card|\btcgs?\b|card\s*shop|card\s*store|collectible\s*card|sports\s*card/.test(searchable)) add(6, "Card or TCG evidence");
  if (/pokemon|pokémon|magic\s*(the\s*gathering|tg)?|\bmtg\b|yu[- ]?gi[- ]?oh|lorcana|one\s*piece/.test(searchable)) add(5, "Named trading-card game evidence");
  if (/tabletop|\bgame(?:s)?\b/.test(searchable)) add(3, "Game or tabletop evidence");
  if (/comic(?:s)?/.test(searchable)) add(2, "Comic/card hybrid evidence");
  if (/art\s*supply|teaching\s*supply|school\s*supply|gift\s*shop|clothing|furniture|beauty|restaurant|grocery|department\s*store/.test(searchable)) add(-8, "Strong non-target category");
  if (/general\s*toy|\btoy\s*store\b/.test(searchable) && !/card|tcg|game|pokemon|magic|yugioh|lorcana|comic/.test(searchable)) add(-4, "Toy store without card or game evidence");
  if (/\bgame\s*store\b|tabletop|hobby/.test(name) || /\bgame_store\b|\bboard_game_store\b/.test(searchable)) add(2, "Local game-store evidence");
  if (/trading\s*card|\btcgs?\b|card\s*shop|sports\s*card|pokemon|magic|yu[- ]?gi[- ]?oh|lorcana|one\s*piece/.test(sourceSearchable)) reasons.push("Matched a focused card-store search");
  if (!reasons.length) reasons.push("No strong category evidence");
  if (score < 0) return { relevance: "excluded", score, reasons };
  if (score >= 5) return { relevance: "high", score, reasons };
  if (score >= 3) return { relevance: "medium", score, reasons };
  return { relevance: "low", score, reasons };
}

export async function geocodeZip(postalCode: string, apiKey: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`https://maps.googleapis.com/maps/api/geocode/json?components=country:US|postal_code:${encodeURIComponent(postalCode)}&key=${encodeURIComponent(apiKey)}`);
  const payload = await response.json().catch(() => null) as { status?: string; error_message?: string; results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }> } | null;
  if (!payload) throw new StoreFinderProviderError("Google Geocoding returned an invalid response.");
  if (!response.ok) throw new StoreFinderProviderError(geocodingErrorMessage(payload.status, payload.error_message));
  const location = payload.results?.[0]?.geometry?.location;
  if (payload.status !== "OK" || typeof location?.lat !== "number" || typeof location.lng !== "number") throw new StoreFinderProviderError(geocodingErrorMessage(payload.status, payload.error_message));
  return { latitude: location.lat, longitude: location.lng };
}

function geocodingErrorMessage(status: string | undefined, providerMessage: string | undefined) {
  const hasProviderDetail = typeof providerMessage === "string" && providerMessage.trim().length > 0;
  switch (status) {
    case "ZERO_RESULTS": return "Google could not locate that ZIP code.";
    case "REQUEST_DENIED": return "Google Geocoding denied the request. Check API key restrictions and Geocoding API access.";
    case "OVER_DAILY_LIMIT": return "Google Maps billing or quota configuration prevented the ZIP lookup.";
    case "OVER_QUERY_LIMIT": return "Google Maps quota was exceeded while looking up the ZIP code. Try again later.";
    case "INVALID_REQUEST": return "Google Geocoding rejected the ZIP lookup request.";
    case "UNKNOWN_ERROR": return hasProviderDetail ? "Google Geocoding temporarily failed. Try again." : "Google Geocoding returned an unknown error. Try again.";
    default: return "Google Geocoding could not complete the ZIP lookup.";
  }
}

function addressPart(address: string | undefined, index: number) {
  const parts = (address ?? "").split(",").map((part) => part.trim());
  if (index === 0) return parts.at(-1)?.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] ?? "";
  if (index === 1) return parts.at(-2)?.split(/\s+/).find((part) => /^[A-Z]{2}$/.test(part)) ?? "";
  return parts.at(-2)?.replace(/\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?$/, "") ?? "";
}

function safeHttpUrl(value: string | undefined) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null; } catch { return null; }
}

function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(bLat - aLat); const dLon = radians(bLon - aLon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}

export class StoreFinderConfigurationError extends Error {}
export class StoreFinderProviderError extends Error {}

export async function assertPublicHttpUrl(value: string, resolver: typeof lookup = lookup) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid website URL."); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("Only public HTTP(S) websites are supported.");
  const address = await resolver(url.hostname);
  if (isPrivateIp(address.address)) throw new Error("That website resolves to a private or internal network address.");
  return url;
}

function isPrivateIp(address: string) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return address === "::1" || address.toLowerCase().startsWith("fe80:") || address.toLowerCase().startsWith("fc") || address.toLowerCase().startsWith("fd");
}
