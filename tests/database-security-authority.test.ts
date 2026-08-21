import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("Collector inventory authority migration enforces limits with transactional database guards", () => {
  const source = read("supabase/migrations/202608100002_security_authority.sql");

  assert.match(source, /create or replace function public\.collector_inventory_acting_user\(\)/);
  assert.match(source, /pg_advisory_xact_lock\(hashtextextended\('collector-inventory:'/);
  assert.match(source, /TD_COLLECTOR_FREE_LIMIT_EXCEEDED/);
  assert.match(source, /next_quantity_total > 500/);
  assert.match(source, /create or replace function public\.collector_mutate_inventory_item\(operation jsonb\)/);
  assert.match(source, /grant execute on function public\.collector_service_mutate_inventory_item\(uuid, jsonb\) to service_role/);
  assert.match(source, /revoke all on function public\.collector_service_mutate_inventory_item\(uuid, jsonb\) from authenticated/);
  assert.doesNotMatch(source, /Proposal:/);
});

test("binder share API derives public cards only from owned inventory records", () => {
  const source = read("src/app/api/binder-shares/route.ts");

  assert.match(source, /requireApiCapability\("binder\.manage"\)/);
  assert.match(source, /inventoryItemIds/);
  assert.match(source, /\.from\("inventory_items"\)/);
  assert.match(source, /\.eq\("user_id", userId\)/);
  assert.match(source, /rows\.length !== inventoryItemIds\.length/);
  assert.match(source, /Every shared card must belong to your inventory/);
  assert.match(source, /\.eq\("owner_id", user\.id\)/);
  assert.doesNotMatch(source, /sanitizeLegacyBinderPayload\(body\?\.payload\)/);
});

test("marketplace credentials include rotation-ready metadata without exposing secrets", () => {
  const migration = read("supabase/migrations/202608100002_security_authority.sql");
  const helper = read("src/lib/marketplaces/credentials.ts");
  const route = read("src/app/api/marketplaces/credentials/route.ts");

  assert.match(migration, /encryption_algorithm text not null default 'aes-256-gcm'/);
  assert.match(migration, /encryption_key_version text not null default 'v1'/);
  assert.match(helper, /MARKETPLACE_CREDENTIAL_KEY_VERSION/);
  assert.match(route, /encryptMarketplaceCredentials\(credentials\)/);
  assert.doesNotMatch(route, /createCipheriv/);
  assert.doesNotMatch(route, /createHash/);
  assert.doesNotMatch(route, /randomBytes/);
});

test("public binder shares preserve revoked and expired share protections", () => {
  const page = read("src/app/share/binder/[token]/page.tsx");

  assert.match(page, /is_active !== true/);
  assert.match(page, /revoked_at/);
  assert.match(page, /shareHasExpired\(data\.expires_at\)/);
  assert.match(page, /sanitizeLegacyBinderPayload\(data\.payload\)/);
});
