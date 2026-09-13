import { lookup } from "node:dns/promises";
import net from "node:net";

export const STORE_SEARCH_PHRASES = [
  "trading card store",
  "card shop",
  "TCG store",
  "game store",
  "hobby shop",
  "collectibles store",
  "sports card store",
  "Pokémon card store",
  "Magic The Gathering store",
  "comic and card shop",
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

export async function discoverStores(postalCode: string, radius: StoreSearchRadius, fetcher: typeof fetch = fetch): Promise<StoreDiscoveryResult[]> {
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
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.primaryTypeDisplayName,places.location,places.currentOpeningHours",
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
      };
      const existing = seen.get(place.id);
      if (!existing || (result.websiteUrl && !existing.websiteUrl) || (result.phone && !existing.phone)) seen.set(place.id, { ...existing, ...result });
    }
  }
  return [...seen.values()].filter((place) => place.distanceMiles === null || place.distanceMiles <= radius).sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999)).slice(0, 100);
}

async function geocodeZip(postalCode: string, apiKey: string, fetcher: typeof fetch) {
  const response = await fetcher(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(postalCode)}&components=country:US|postal_code:${encodeURIComponent(postalCode)}&key=${encodeURIComponent(apiKey)}`);
  if (!response.ok) throw new StoreFinderProviderError(`Google geocoding returned ${response.status}.`);
  const payload = await response.json() as { status?: string; results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }> };
  const location = payload.results?.[0]?.geometry?.location;
  if (payload.status !== "OK" || typeof location?.lat !== "number" || typeof location.lng !== "number") throw new StoreFinderProviderError("Google could not locate that ZIP code.");
  return { latitude: location.lat, longitude: location.lng };
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
