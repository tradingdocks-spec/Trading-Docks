import { assertPublicHttpUrl } from "./store-finder.ts";

const MAX_PAGES = 3;
const MAX_BYTES = 1_000_000;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export type PublicContactDiscovery = { email: string | null; sourceUrl: string | null; contactPageUrl: string | null; pagesVisited: string[] };

export async function discoverPublicContact(website: string, fetcher: typeof fetch = fetch): Promise<PublicContactDiscovery> {
  const queue = [await assertPublicHttpUrl(website)];
  const visited: string[] = [];
  const candidates: Array<{ email: string; sourceUrl: string }> = [];
  while (queue.length && visited.length < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.includes(url.toString())) continue;
    const response = await fetchBounded(url, fetcher);
    visited.push(url.toString());
    if (!response) continue;
    const html = await response.text();
    for (const email of extractPublicEmails(html)) candidates.push({ email, sourceUrl: url.toString() });
    if (visited.length < MAX_PAGES && /html/i.test(response.headers.get("content-type") ?? "")) {
      for (const href of likelyContactLinks(html, url)) {
        if (!visited.includes(href.toString()) && queue.length < MAX_PAGES - visited.length) queue.push(href);
      }
    }
  }
  const unique = [...new Set(candidates.map((candidate) => candidate.email))];
  const preferred = unique.sort((a, b) => scoreEmail(b) - scoreEmail(a))[0] ?? null;
  const source = candidates.find((candidate) => candidate.email === preferred)?.sourceUrl ?? null;
  return { email: preferred, sourceUrl: source, contactPageUrl: visited.find((url) => /contact|about|store|info/i.test(url)) ?? null, pagesVisited: visited };
}

export function extractPublicEmails(html: string) {
  const visible = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--([\s\S]*?)-->/gi, " ").replace(/<[^>]+>/g, " ");
  const mailtos = [...html.matchAll(/mailto:([^"'?#\s>]+)/gi)].map((match) => match[1]);
  return [...new Set([...visible.matchAll(EMAIL)].map((match) => normalizeEmail(match[0])).concat(mailtos.map((value) => normalizeEmail(value))).filter((value): value is string => Boolean(value)))];
}

function scoreEmail(email: string) { return /^(info|sales|hello|contact|store|support)@/i.test(email) ? 10 : 0; }
function normalizeEmail(value: string) { const email = value.trim().toLowerCase(); return new RegExp(`^${EMAIL.source}$`, "i").test(email) ? email : null; }
function likelyContactLinks(html: string, base: URL) {
  const links: URL[] = [];
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1], base);
      if (url.protocol.startsWith("http") && /contact|about|store|info/i.test(url.pathname + url.search)) links.push(url);
    } catch { /* Ignore malformed links. */ }
  }
  return links;
}

async function fetchBounded(url: URL, fetcher: typeof fetch) {
  let current = url;
  for (let redirect = 0; redirect <= 3; redirect++) {
    await assertPublicHttpUrl(current.toString());
    const response = await fetcher(current, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { Accept: "text/html,application/xhtml+xml" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === 3) return null;
      current = new URL(location, current);
      continue;
    }
    if (!response.ok || !/html|xhtml/i.test(response.headers.get("content-type") ?? "")) return null;
    const length = Number(response.headers.get("content-length") ?? 0);
    return length > MAX_BYTES ? null : response;
  }
  return null;
}
