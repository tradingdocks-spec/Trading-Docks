import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createMarketplaceAdapter, getMarketplaceCapabilities } from "../src/lib/selling/adapter.ts";
import { evaluateListingReadiness } from "../src/lib/selling/readiness.ts";

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
