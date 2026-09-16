import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync("supabase/migrations/202609090003_showcase_operations.sql", "utf8");
const foundation = readFileSync("supabase/migrations/202609090001_showcase_v1.sql", "utf8");
const imageMigration = readFileSync("supabase/migrations/202609100003_showcase_image_projection.sql", "utf8");
const publicExperience = readFileSync("src/components/showcase/ShowcasePublicExperience.tsx", "utf8");

test("Showcase public projection omits private inventory fields", () => {
  assert.match(foundation, /get_public_showcase_inventory/);
  assert.match(foundation, /data->>'private'/);
  assert.doesNotMatch(foundation.slice(foundation.indexOf("returns table"), foundation.indexOf("language sql")), /costBasis|inventory_value|location_id|user_id/);
});

test("Showcase operations have durable picking and reservation state", () => {
  assert.match(migration, /picked_quantity integer not null default 0/);
  assert.match(migration, /showcase_inventory_reservations/);
  assert.match(migration, /Every requested quantity must be picked/);
  assert.match(migration, /status = 'consumed'/);
});

test("Showcase public inventory exposes safe image identity and resolves fallback artwork", async () => {
  assert.match(foundation, /scryfall_id text/);
  assert.match(foundation, /provider_image_url text/);
  assert.match(imageMigration, /drop function if exists public\.get_public_showcase_inventory/);
  assert.match(imageMigration, /i\.scryfall_id/);
  assert.match(imageMigration, /provider_product_id text/);
  assert.match(publicExperience, /ShowcaseCardImage/);
  const { showcaseImageCandidates } = await import("../src/lib/showcase-image.ts");
  const candidates = showcaseImageCandidates({ game: "Magic: The Gathering", scryfall_id: "abc-123", set_code: "dpa", collector_number: "18" });
  assert.match(candidates[0], /api\.scryfall\.com\/cards\/abc-123/);
  assert.ok(candidates.some((candidate) => candidate.includes("version=small")));
});

test("kiosk context is revocable and workspace-scoped", () => {
  assert.match(migration, /get_kiosk_context/);
  assert.match(migration, /d\.enabled and d\.revoked_at is null/);
  assert.match(migration, /p\.enabled and p\.kiosk_enabled/);
});

test("Showcase routes are registered with explicit access rules", async () => {
  const { routeAccessRuleForPath } = await import("../src/lib/platform/route-access.ts");
  const { apiAccessRuleForPath } = await import("../src/lib/platform/api-access.ts");
  assert.notEqual(routeAccessRuleForPath("/dashboard/showcase")?.id, "dashboard-fallback");
  assert.notEqual(apiAccessRuleForPath("/api/showcase/kiosks/pair")?.id, "api-fallback");
});
