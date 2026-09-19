import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { extractPublicEmails } from "../src/lib/marketing/contact-discovery.ts";
import { assertPublicHttpUrl, discoverStores, geocodeZip, validateStoreSearch } from "../src/lib/marketing/store-finder.ts";

test("store finder validates supported ZIP and radius values", () => {
  assert.deepEqual(validateStoreSearch("85001-1234", 25), { postalCode: "85001", radius: 25 });
  assert.throws(() => validateStoreSearch("8500", 25), /valid five-digit/);
  assert.throws(() => validateStoreSearch("85001", 7), /supported search radius/);
});

test("public contact extraction only returns visibly published, normalized addresses", () => {
  const emails = extractPublicEmails(`<script>bad@example.com</script><p>Contact us at INFO@Shop.example.com</p><a href="mailto:sales@shop.example.com">Email</a>`);
  assert.deepEqual(emails.sort(), ["info@shop.example.com", "sales@shop.example.com"]);
});

test("contact discovery URL guard rejects private and credential-bearing targets", async () => {
  await assert.rejects(() => assertPublicHttpUrl("http://127.0.0.1"), /private or internal/);
  await assert.rejects(() => assertPublicHttpUrl("https://user:pass@example.com"), /public HTTP/);
  const url = await assertPublicHttpUrl("https://example.com", async () => ({ address: "93.184.216.34", family: 4 }));
  assert.equal(url.hostname, "example.com");
});

test("ZIP geocoding uses component filtering exactly once", async () => {
  let requestedUrl = "";
  await geocodeZip("85387", "server-only-key", async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ status: "OK", results: [{ geometry: { location: { lat: 33.6, lng: -112.4 } } }] }), { status: 200 });
  });
  const url = new URL(requestedUrl);
  assert.equal(url.origin + url.pathname, "https://maps.googleapis.com/maps/api/geocode/json");
  assert.equal(url.searchParams.get("components"), "country:US|postal_code:85387");
  assert.equal(url.searchParams.has("address"), false);
  assert.equal((requestedUrl.match(/85387/g) ?? []).length, 1);
});

test("ZIP geocoding maps provider statuses to safe admin messages", async () => {
  const responseFor = (status: string) => async () => new Response(JSON.stringify({ status, error_message: "provider detail must not be surfaced" }), { status: 200 });
  await assert.rejects(() => geocodeZip("85387", "key", responseFor("ZERO_RESULTS")), /could not locate that ZIP/);
  await assert.rejects(() => geocodeZip("85387", "key", responseFor("REQUEST_DENIED")), /denied the request/);
  await assert.rejects(() => geocodeZip("85387", "key", responseFor("OVER_QUERY_LIMIT")), /quota was exceeded/);
  await assert.rejects(() => geocodeZip("85387", "key", responseFor("OVER_DAILY_LIMIT")), /billing or quota configuration/);
  await assert.rejects(() => geocodeZip("85387", "key", responseFor("INVALID_REQUEST")), /rejected the ZIP lookup/);
  await assert.rejects(() => geocodeZip("85387", "key", responseFor("UNKNOWN_ERROR")), /temporarily failed/);
  await assert.rejects(() => geocodeZip("85387", "key", responseFor("REQUEST_DENIED")), (error: Error) => !error.message.includes("provider detail"));
});

test("Store Finder keeps the API key server-side and Places New search unchanged", async () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/admin/marketing/store-finder/route.ts"), "utf8");
  const client = readFileSync(join(process.cwd(), "src/components/dashboard/admin/marketing/MarketingWorkspace.tsx"), "utf8");
  assert.match(route, /GOOGLE_PLACES_API_KEY|discoverStores/);
  assert.doesNotMatch(client, /GOOGLE_PLACES_API_KEY/);
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const previousKey = process.env.GOOGLE_PLACES_API_KEY;
  process.env.GOOGLE_PLACES_API_KEY = "test-server-key";
  let stores: Awaited<ReturnType<typeof discoverStores>> = [];
  try {
    stores = await discoverStores("85387", 25, async (input, init) => {
      calls.push({ url: String(input), init });
      if (String(input).includes("geocode/json")) return new Response(JSON.stringify({ status: "OK", results: [{ geometry: { location: { lat: 33.6, lng: -112.4 } } }] }), { status: 200 });
      return new Response(JSON.stringify({ places: [] }), { status: 200 });
    });
  } finally {
    if (previousKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = previousKey;
  }
  assert.deepEqual(stores, []);
  const placeCalls = calls.filter((call) => call.url === "https://places.googleapis.com/v1/places:searchText");
  assert.equal(placeCalls.length, 10);
  assert.ok(placeCalls.every((call) => call.init?.method === "POST" && String(call.init.body).includes('"locationBias"')));
});
