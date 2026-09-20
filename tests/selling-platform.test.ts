import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createMarketplaceAdapter, getMarketplaceCapabilities } from "../src/lib/selling/adapter.ts";
import { evaluateListingReadiness } from "../src/lib/selling/readiness.ts";
import { calculateAvailableQuantity, reserveSellingInventory } from "../src/lib/selling/allocation.ts";
import { normalizeCandidatePatch } from "../src/lib/selling/listing-service.ts";
import { createMockEbayAdapter, generateEbayTitle, mapEbayCondition, prepareEbayListing, stableEbaySku, validateEbayListing } from "../src/lib/selling/ebay.ts";
import { ebayApiBase, ebayAuthEndpoint, resolveEbayEnvironment } from "../src/lib/marketplaces/ebay-environment.ts";

test("selling adapters expose capabilities without forcing marketplace methods", () => {
  const ebay = createMarketplaceAdapter("ebay");
  const manaPool = createMarketplaceAdapter("mana_pool");
  assert.equal(ebay.capabilities.supportsPublishing, true);
  assert.equal(manaPool.capabilities.supportsShippingPolicies, false);
  assert.equal(typeof ebay.publishListing, "undefined");
  assert.equal(getMarketplaceCapabilities("shopify").supportsVariantListings, true);
});

test("readiness reports the first actionable missing field", () => {
  assert.deepEqual(evaluateListingReadiness({
    cardName: "Innkeeper's Talent",
    inventoryItemId: "inventory-1",
    quantity: 1,
    marketplaceSelected: true,
    condition: "NM",
    listingPrice: null,
  }), { code: "NEEDS_PRICE", message: "Set a listing price before publishing." });
});

test("ready listing candidates remain linked to physical inventory", () => {
  const candidate = {
    cardName: "Innkeeper's Talent",
    inventoryItemId: "inventory-1",
    quantity: 1,
    marketplaceSelected: true,
    categorySelected: true,
    shippingPolicySelected: true,
    imageAvailable: true,
    condition: "NM",
    listingPrice: 12.5,
  };
  assert.equal(evaluateListingReadiness(candidate).code, "READY");
  assert.equal(candidate.inventoryItemId, "inventory-1");
});

test("selling foundation migration is additive and user-scoped", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260918173226_selling_marketplace_platform_foundation.sql"), "utf8");
  for (const table of ["selling_listing_batches", "selling_listing_candidates", "selling_inventory_allocations", "selling_marketplace_listings", "selling_sync_events"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.doesNotMatch(migration, /create table if not exists public\.inventory_items/);
  assert.match(migration, /unique \(user_id, idempotency_key\)/);
});

test("allocation math never exposes negative availability", () => {
  assert.equal(calculateAvailableQuantity({ physicalQuantity: 4, activeReservations: 1 }), 3);
  assert.equal(calculateAvailableQuantity({ physicalQuantity: 2, activeReservations: 5 }), 0);
});

test("allocation client forwards workspace, quantity, and idempotency", async () => {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const result = await reserveSellingInventory({
    supabase: { rpc: async (name, args) => { calls.push([name, args]); return { data: { ok: true }, error: null }; } },
    workspaceId: "workspace-1", candidateId: "candidate-1", quantity: 2, idempotencyKey: "request-1",
  });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls[0], ["reserve_selling_inventory", { p_workspace_id: "workspace-1", p_candidate_id: "candidate-1", p_quantity: 2, p_idempotency_key: "request-1" }]);
  await assert.rejects(() => reserveSellingInventory({ supabase: { rpc: async () => ({ data: null, error: null }) }, workspaceId: "w", candidateId: "c", quantity: 0, idempotencyKey: "x" }));
});

test("candidate patch normalization accepts operational edits and rejects invalid quantity", () => {
  assert.deepEqual(normalizeCandidatePatch({ listingPrice: "12.50", condition: "NM", marketplaces: ["ebay", "ebay"], quantity: 2 }), { listing_price: 12.5, condition: "NM", selected_marketplaces: ["ebay"], quantity: 2 });
  assert.throws(() => normalizeCandidatePatch({ quantity: 0 }), /positive whole number/);
});

test("allocation workflow migration is additive, locked, and workspace scoped", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260918174321_selling_allocation_and_candidate_workflow.sql"), "utf8");
  assert.match(migration, /create or replace function public\.reserve_selling_inventory/);
  assert.match(migration, /create or replace function public\.update_selling_candidate_quantity/);
  assert.match(migration, /for update/);
  assert.match(migration, /is_workspace_member/);
  assert.match(migration, /source_provenance jsonb/);
  assert.doesNotMatch(migration, /create table if not exists public\.inventory_items/);
});

test("selling provenance correction permits multiple physical positions per item", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260918190000_selling_chaos_position_multiplicity.sql"), "utf8");
  assert.match(migration, /drop constraint if exists chaos_sort_inventory_positions_user_id_batch_id_item_id_key/);
  assert.match(migration, /chaos_sort_positions_user_batch_item_idx/);
});

test("eBay SKU and title generation are deterministic and bounded", () => {
  const input = { tradingDocksCandidateId: "candidate-1", inventoryItemId: "item-1", cardName: "Innkeeper's Talent", setCode: "BLB", collectorNumber: "180", game: "magic", condition: "NM" } as const;
  assert.equal(stableEbaySku(input), stableEbaySku(input));
  assert.match(stableEbaySku(input), /^TD-[A-Z0-9]+$/);
  assert.equal(generateEbayTitle(input, 80), "Innkeeper's Talent #180 BLB MTG NM");
  assert.ok(generateEbayTitle({ ...input, titleOverride: "A".repeat(100) }, 80).length <= 80);
});

test("eBay normalization maps conditions and filters unsafe images", () => {
  assert.equal(mapEbayCondition("NM"), "NEW");
  assert.equal(mapEbayCondition("unknown"), null);
  const prepared = prepareEbayListing({ tradingDocksCandidateId: "c", inventoryItemId: "i", cardName: "Card", condition: "LP", listingPrice: 4.5, quantity: 2, imageUrls: ["https://example.com/a.jpg", "http://unsafe.example/b.jpg"] });
  assert.equal(prepared.condition, "USED_EXCELLENT");
  assert.deepEqual(prepared.imageUrls, ["https://example.com/a.jpg"]);
});

test("eBay readiness reports exact blockers and mock publish is idempotent", async () => {
  const input = { tradingDocksCandidateId: "c", inventoryItemId: "i", cardName: "Card", condition: "NM", listingPrice: 4.5, quantity: 2, imageUrls: ["https://example.com/a.jpg"], sellerAccountId: "seller", merchantLocationKey: "loc", categoryId: "183454", fulfillmentPolicyId: "ship", paymentPolicyId: "pay", returnPolicyId: "return" };
  assert.deepEqual(validateEbayListing({ ...input, categoryId: null }).map((blocker) => blocker.code), ["NEEDS_EBAY_CATEGORY"]);
  const adapter = createMockEbayAdapter();
  const prepared = adapter.prepare(input);
  assert.equal(prepared.ok, true);
  const first = await adapter.publish(prepared.value!, "publish-1");
  const second = await adapter.publish(prepared.value!, "publish-1");
  assert.deepEqual(second, first);
});

test("marketplace operation migration stores normalized listing state without secrets", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260918191500_selling_marketplace_operations.sql"), "utf8");
  assert.match(migration, /selling_marketplace_settings/);
  assert.match(migration, /selling_marketplace_operations/);
  assert.match(migration, /prepared_payload jsonb/);
  assert.match(migration, /publish_succeeded/);
  assert.match(migration, /enable row level security/);
  assert.doesNotMatch(migration, /access_token|client_secret|refresh_token/);
});

test("eBay environment guard allows only explicit Sandbox credentials in staging", () => {
  assert.equal(resolveEbayEnvironment({ environment: "sandbox" }, "staging"), "sandbox");
  for (const credentials of [{}, { environment: "sandbx" }, { environment: "production" }]) {
    assert.throws(() => resolveEbayEnvironment(credentials, "staging"), /eBay configuration blocked/);
  }
});

test("eBay environment guard requires an explicit valid environment in production", () => {
  assert.equal(resolveEbayEnvironment({ environment: "production" }, "production"), "production");
  assert.throws(() => resolveEbayEnvironment({}, "production"), /explicitly sandbox or production/);
  assert.throws(() => resolveEbayEnvironment({ environment: "live" }, "production"), /explicitly sandbox or production/);
});

test("eBay endpoint selection is Sandbox-only for validated staging configuration", () => {
  assert.equal(ebayAuthEndpoint(resolveEbayEnvironment({ environment: "sandbox" }, "staging")), "https://auth.sandbox.ebay.com/oauth2/authorize");
  assert.equal(`${ebayApiBase(resolveEbayEnvironment({ environment: "sandbox" }, "staging"))}/identity/v1/oauth2/token`, "https://api.sandbox.ebay.com/identity/v1/oauth2/token");
  assert.equal(ebayApiBase(resolveEbayEnvironment({ environment: "sandbox" }, "staging")), "https://api.sandbox.ebay.com");
});

test("eBay environment errors never expose credential or token material", () => {
  const secret = "super-secret-client-value";
  assert.throws(() => resolveEbayEnvironment({ environment: secret }, "staging"), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.doesNotMatch(error.message, /super-secret-client-value|access_token|refresh_token|clientSecret/i);
    return true;
  });
});

test("all eBay OAuth paths use the shared validated environment resolver", () => {
  const authorize = readFileSync(join(process.cwd(), "src/app/api/marketplaces/ebay/authorize/route.ts"), "utf8");
  const callback = readFileSync(join(process.cwd(), "src/app/api/marketplaces/[marketplace]/callback/route.ts"), "utf8");
  const refresh = readFileSync(join(process.cwd(), "src/lib/marketplaces/ebay.ts"), "utf8");
  for (const source of [authorize, callback, refresh]) assert.match(source, /resolveEbayEnvironment/);
  assert.doesNotMatch(authorize, /environment === "sandbox"/);
  assert.doesNotMatch(callback, /credentials\.environment === "sandbox"/);
  assert.doesNotMatch(refresh, /credentials\.environment === "sandbox"/);
});

test("admin eBay configuration preserves the encrypted architecture and staging lock", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/admin/marketplace-integrations/route.ts"), "utf8");
  const adminPanel = readFileSync(join(process.cwd(), "src/components/dashboard/admin/AdminControlCenterWithPreview.tsx"), "utf8");
  assert.match(route, /requireServerPlatformRole\("admin"\)/);
  assert.match(route, /resolveEbayEnvironment/);
  assert.match(route, /currentEbayDeploymentEnvironment/);
  assert.match(route, /encryptMarketplaceCredentials/);
  assert.match(route, /key === "environment" \? value : mask\(value\)/);
  assert.doesNotMatch(route, /clientSecret\s*:/);
  assert.match(adminPanel, /type="password"/);
  assert.match(adminPanel, /environment: deploymentEnvironment === "production" \? "production" : "sandbox"/);
  assert.match(adminPanel, /credential_labels\.clientSecret/);
  assert.match(adminPanel, /saved secret is encrypted server-side and never displayed again/);
  assert.match(adminPanel, /href="\/api\/marketplaces\/ebay\/authorize"/);
  assert.match(adminPanel, /Reconnect eBay Sandbox/);
});


test("admin eBay connection UI distinguishes sandbox reconnect from legacy connection state", () => {
  const adminPanel = readFileSync(join(process.cwd(), "src/components/dashboard/admin/AdminControlCenterWithPreview.tsx"), "utf8");
  const connectionsPage = readFileSync(join(process.cwd(), "src/app/dashboard/selling/connections/page.tsx"), "utf8");
  assert.match(adminPanel, /ebayConnection/);
  assert.match(adminPanel, /Reconnect eBay Sandbox/);
  assert.match(adminPanel, /environment === "sandbox"/);
  assert.match(connectionsPage, /connectionEnvironment === "sandbox"/);
  assert.match(connectionsPage, /reconnect required/);
});
