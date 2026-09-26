import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  addCartLine, cartLineKey, cartStorageKey, parseStorefrontCart, removeCartLine,
  setCartQuantity, validateCartSubtotal, type CartValidation, type StorefrontCart,
} from "../src/lib/storefront/cart.ts";
import { buildStorefrontQuery, parseStorefrontQuery } from "../src/lib/storefront/query.ts";

const migration = readFileSync("supabase/migrations/20260925194250_storefront_v1a_forward_only.sql", "utf8");
const catalogRoute = readFileSync("src/app/api/storefront/catalog/route.ts", "utf8");
const tagsRoute = readFileSync("src/app/api/storefront/tags/route.ts", "utf8");
const catalogFunction = migration.slice(migration.indexOf("create or replace function public.search_public_storefront_catalog"));

test("cart persists only exact public identity, store, quantity, and added timestamp", () => {
  const key = cartStorageKey("trading-docks");
  const persisted = JSON.stringify({ version: 1, lines: [{
    publicId: "position:exact-position-1", storeSlug: "trading-docks", quantity: 2,
    addedAt: "2026-09-25T12:00:00.000Z", listingPrice: 999, price: 999,
  }] });
  const restored = parseStorefrontCart(persisted, "trading-docks");
  assert.match(key, /v1:trading-docks$/);
  assert.deepEqual(restored.lines, [{
    publicId: "position:exact-position-1", storeSlug: "trading-docks", quantity: 2,
    addedAt: "2026-09-25T12:00:00.000Z",
  }]);
  assert.equal(parseStorefrontCart(persisted, "another-store").lines.length, 0);
});

test("cart merges same exact variant but keeps distinct position/store identities separate", () => {
  let cart: StorefrontCart = { version: 1, lines: [] };
  cart = addCartLine(cart, "position:nm-foil", "trading-docks", 4, "2026-09-25T00:00:00Z");
  cart = addCartLine(cart, "position:nm-foil", "trading-docks", 4, "2026-09-26T00:00:00Z");
  cart = addCartLine(cart, "position:lp-normal", "trading-docks", 2);
  cart = addCartLine(cart, "position:nm-foil", "other-store", 2);
  assert.equal(cart.lines.length, 3);
  assert.equal(cart.lines.find((line) => line.publicId === "position:nm-foil" && line.storeSlug === "trading-docks")?.quantity, 2);
  assert.equal(cart.lines.find((line) => line.publicId === "position:nm-foil" && line.storeSlug === "trading-docks")?.addedAt, "2026-09-25T00:00:00Z");
  assert.equal(cartLineKey({ publicId: "position:nm-foil", storeSlug: "trading-docks" }), "trading-docks:position:nm-foil");
});

test("cart quantity is bounded, invalid values do not create or erase a line, and removal is explicit", () => {
  let cart = addCartLine({ version: 1, lines: [] }, "item:one", "trading-docks", 1);
  cart = setCartQuantity(cart, "item:one", 4);
  assert.equal(cart.lines[0].quantity, 4);
  assert.equal(setCartQuantity(cart, "item:one", 0).lines[0].quantity, 4);
  assert.equal(setCartQuantity(cart, "item:one", 1000).lines[0].quantity, 4);
  assert.equal(removeCartLine(cart, "item:one").lines.length, 0);
  assert.equal(addCartLine(cart, "item:sold-out", "trading-docks", 0).lines.length, 1);
});

test("cart subtotal uses only freshly supplied listing-price data and never cached values", () => {
  const lines = [{ publicId: "p1", storeSlug: "trading-docks", quantity: 2, addedAt: "2026-09-25" }];
  const current = new Map<string, CartValidation>([[cartLineKey(lines[0]), {
    listingPrice: 3.25, availableQuantity: 1, name: "Card", setName: "Set", collectorNumber: "1",
    condition: "NM", finish: "Foil", language: "EN", imageUrl: null, priceVisible: true, quantityVisible: true, isAvailable: true,
  }]]);
  assert.equal(validateCartSubtotal(lines, current), 6.5);
  assert.equal(validateCartSubtotal(lines, new Map()), 0);
});

test("filter query supports multi-select, ranges, sort, and shareable URL state", () => {
  const parsed = parseStorefrontQuery({
    q: "charizard holo", game: ["Pokemon"], rarity: ["Rare", "Ultra Rare"], finish: "Holo",
    minPrice: "1.25", maxPrice: "25", sort: "price_asc", page: "2",
  });
  assert.deepEqual(parsed.filters.rarity, ["Rare", "Ultra Rare"]);
  const url = buildStorefrontQuery(parsed);
  assert.match(url, /game=Pokemon/);
  assert.match(url, /rarity=Rare/);
  assert.ok(url.includes("rarity=Ultra+Rare"));
  assert.match(url, /minPrice=1.25/);
  assert.match(url, /page=2/);
  const natural = parseStorefrontQuery({ q: "artifact under 10" });
  assert.equal(natural.q, "artifact");
  assert.equal(natural.filters.maxPrice, "10");
});

test("forward-only catalog is public-listing and asking-price gated, with safe fields only", () => {
  assert.match(migration, /create table if not exists public\.storefront_profiles/);
  assert.match(migration, /create table if not exists public\.storefront_listings/);
  assert.match(migration, /create table if not exists public\.storefront_tags/);
  assert.match(migration, /create table if not exists public\.storefront_inventory_tags/);
  assert.match(migration, /public\.is_workspace_admin\(workspace_id\)/);
  assert.match(catalogFunction, /'asking_price',page\.asking_price/);
  assert.match(catalogFunction, /'card_type',page\.card_type/);
  assert.match(catalogFunction, /'colors',page\.colors/);
  assert.match(catalogFunction, /'custom_tags',page\.custom_tags/);
  assert.match(catalogFunction, /from public\.storefront_profiles p/);
  assert.match(catalogFunction, /from public\.storefront_listings l/);
  assert.match(catalogFunction, /i\.asking_price is not null and i\.asking_price >= 0/);
  assert.match(catalogFunction, /lower\(coalesce\(i\.data->>'private','false'\)\) <> 'true'/);
  assert.match(catalogFunction, /pos\.status = 'active'/);
  assert.doesNotMatch(catalogFunction, /showcase_inventory_reservations|showcase_requests|inventory_value|marketPrice|costBasis/);
  assert.doesNotMatch(migration, /create table public\.(showcase_inventory_reservations|showcase_requests|showcase_request_items|showcase_events|storefront_orders|storefront_payments)|create trigger[^;]*reservation|update public\.inventory_items/i);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/);
  assert.match(migration, /revoke all on function public\.search_public_storefront_catalog/);
  assert.match(migration, /grant execute on function public\.search_public_storefront_catalog[\s\S]*to anon, authenticated/);
});

test("cart survives a browser restart round-trip without storing price truth", () => {
  const original = addCartLine({ version: 1, lines: [] }, "position:variant-7", "trading-docks", 3, "2026-09-25T12:00:00Z");
  const browserStorage = JSON.stringify(original);
  const afterRestart = parseStorefrontCart(browserStorage, "trading-docks");
  assert.deepEqual(afterRestart, original);
  assert.equal(JSON.stringify(afterRestart).includes("listingPrice"), false);
});

test("public cart revalidation is read-only and custom tag/listing writes require workspace admin RLS", () => {
  assert.match(catalogRoute, /getStorefrontCatalog/);
  assert.doesNotMatch(catalogRoute, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(tagsRoute, /getShowcaseTagAdmin/);
  assert.match(tagsRoute, /workspaceId/);
  assert.match(migration, /Workspace admins manage storefront inventory tags/);
  assert.match(migration, /i\.workspace_id = storefront_inventory_tags\.workspace_id/);
  assert.match(migration, /t\.workspace_id = storefront_inventory_tags\.workspace_id/);
  assert.match(migration, /Workspace admins manage storefront listings/);
  assert.match(tagsRoute, /eq\("workspace_id", context\.workspaceId\)/);
});

test("V1A has no dependency on historical Showcase commerce schema or mutation endpoints", () => {
  const storefrontSources = [catalogRoute, tagsRoute, readFileSync("src/lib/showcase.ts", "utf8"), readFileSync("src/app/api/storefront/settings/route.ts", "utf8")].join("\n");
  assert.doesNotMatch(storefrontSources, /showcase_inventory_reservations|showcase_requests|showcase_request_items|showcase_events|submit_showcase_request/);
  assert.doesNotMatch(readFileSync("src/components/showcase/ShowcasePublicExperience.tsx", "utf8"), /api\/showcase\/requests|submitRequest|Customer request/);
  assert.match(readFileSync("src/components/showcase/ShowcasePublicExperience.tsx", "utf8"), /does not reserve stock or submit an order/);
});
