import {
  certificationFor,
  type Hardware,
  type HardwareSource,
} from "./catalog.ts";
export interface AffiliateConfig {
  enabled: boolean;
  amazonTag?: string;
  disclosure: string;
}
export const defaultDisclosure =
  "Some hardware links are affiliate links. Trading Docks may earn a commission from qualifying purchases at no additional cost to you.";
export const amazonDisclosure =
  "As an Amazon Associate I earn from qualifying purchases.";
const approvedHosts = new Set([
  "betckey.com",
  "www.betckey.com",
  "amazon.com",
  "www.amazon.com",
  "zebra.com",
  "www.zebra.com",
  "epson.com",
  "www.epson.com",
  "squareup.com",
  "www.squareup.com",
]);
export function approvedUrl(value: string): URL | null {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      approvedHosts.has(u.hostname)
      ? u
      : null;
  } catch {
    return null;
  }
}
export function amazonUrl(destination: string, config: AffiliateConfig) {
  const url = approvedUrl(destination);
  if (
    !url ||
    !["amazon.com", "www.amazon.com"].includes(url.hostname) ||
    !/^\/(?:dp\/[A-Z0-9]{10}|gp\/product\/[A-Z0-9]{10})\/?$/i.test(url.pathname)
  )
    return null;
  // Never honor an embedded tag when monetization is disabled.
  url.searchParams.delete("tag");
  url.hash = "";
  const affiliate =
    config.enabled && /^[a-zA-Z0-9_-]{1,80}-20$/.test(config.amazonTag ?? "");
  if (affiliate) url.searchParams.set("tag", config.amazonTag!);
  return {
    url: url.toString(),
    affiliate,
    retailer: "AMAZON_US" as const,
    label: "View current price on Amazon",
  };
}
export function purchaseLink(item: Hardware, config: AffiliateConfig) {
  if (item.purchase?.active && item.purchase.region === "US") {
    const link = amazonUrl(item.purchase.destination, config);
    if (link) return link;
  }
  const fallback = approvedUrl(item.manufacturerUrl);
  if (!fallback || ["amazon.com", "www.amazon.com"].includes(fallback.hostname))
    return null;
  return {
    url: fallback.toString(),
    affiliate: false,
    retailer: "MANUFACTURER" as const,
    label: item.fallbackLabel
      ? item.fallbackLabel
      : item.manufacturer === "Square"
        ? "View Square Terminal"
        : `View at ${item.manufacturer}`,
  };
}
export function hardwareSource(value: string | null): HardwareSource {
  return value === "pos_onboarding" || value === "pos_hardware"
    ? value
    : "public_hardware";
}
export function purchaseEvent(
  item: Hardware,
  retailer: string,
  source: HardwareSource,
) {
  return {
    event: "hardware_purchase_click",
    hardware_id: item.id,
    manufacturer: item.manufacturer,
    model: item.model,
    category: item.category,
    retailer,
    certification_status: certificationFor(item),
    source_page: source,
  };
}
