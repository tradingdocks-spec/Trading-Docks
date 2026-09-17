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

test("production advisor follow-up restricts internal RPCs without removing authorized clients", () => {
  const privileges = read("supabase/migrations/20260917154008_production_function_privilege_hardening.sql");
  const paths = read("supabase/migrations/20260917154003_production_function_search_path_hardening.sql");

  assert.match(privileges, /revoke all on function public\.admin_overview\(\) from public, anon/);
  assert.match(privileges, /grant execute on function public\.admin_overview\(\) to authenticated/);
  assert.match(privileges, /revoke all on function public\.enforce_collector_inventory_mutation\(\) from public, anon, authenticated/);
  assert.match(privileges, /revoke all on function public\.inventory_events_block_mutation\(\) from public, anon, authenticated/);
  assert.match(privileges, /grant execute on function public\.apply_collector_inventory_mutation\(/);
  assert.match(privileges, /to authenticated/);
  assert.match(paths, /alter function public\.workspace_role_rank\(text\) set search_path = pg_catalog/);
  assert.match(paths, /alter function public\.raise_collector_inventory_error\(text, text, uuid\) set search_path = pg_catalog/);
});

test("admin RPCs retain server-side authorization and owner transition removes email branching", () => {
  const authority = read("supabase/migrations/202608100001_platform_role_authority_replayability.sql");
  const feedback = read("supabase/migrations/202607280008_feedback_center.sql");
  const overrides = read("supabase/migrations/202607280001_admin_membership_overrides.sql");
  const transition = read("supabase/migrations/20260917154750_platform_owner_role_authority_transition.sql");

  for (const functionName of ["admin_list_users", "admin_overview", "admin_update_user_access"]) {
    assert.match(authority, new RegExp(`create or replace function public\\.${functionName}`));
    assert.match(authority, /if not public\.is_admin\('/);
  }
  assert.match(feedback, /create or replace function public\.admin_feedback_queue\(\)/);
  assert.match(feedback, /where public\.is_platform_owner\(\)/);
  assert.match(overrides, /create or replace function public\.admin_set_membership_override\(/);
  assert.match(overrides, /if not public\.is_platform_owner\(\)/);
  assert.match(transition, /insert into public\.user_roles/);
  assert.match(transition, /role = 'owner'/);
  assert.doesNotMatch(transition, /tradingdocks@gmail\.com.*then/);
});
