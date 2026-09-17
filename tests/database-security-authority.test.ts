import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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

test("owner authority transition is role-based, idempotent, and keeps owners out of Free display", () => {
  const transition = read("supabase/migrations/20260917154750_platform_owner_role_authority_transition.sql");

  assert.match(transition, /if exists \(select 1 from public\.user_roles where role = 'owner'\) then/);
  assert.match(transition, /elsif bootstrap_user_id is not null then/);
  assert.match(transition, /elsif not exists \(select 1 from auth\.users\) then/);
  assert.match(transition, /Owner authority transition requires an existing owner or the historical bootstrap identity/);
  assert.match(transition, /on conflict \(user_id\) do update set role = 'owner'/);
  assert.match(transition, /ur\.role = 'owner'\s*\)\s*then 'store'/s);
  assert.doesNotMatch(transition, /ur\.role = 'owner'\)[\s\S]{0,500}else 'free'/);
  assert.match(transition, /old\.user_id and role = 'owner'/);
  assert.match(transition, /tg_op = 'DELETE' or new\.role <> 'owner'/);
  assert.match(transition, /The platform owner role cannot be removed/);
  assert.match(transition, /target_user_id and role = 'owner'/);
});

test("owner transition hardens search paths and preserves the earlier privilege boundary", () => {
  const privileges = read("supabase/migrations/20260917154008_production_function_privilege_hardening.sql");
  const transition = read("supabase/migrations/20260917154750_platform_owner_role_authority_transition.sql");

  for (const signature of [
    "public.is_platform_owner()",
    "public.protect_platform_owner()",
    "public.admin_set_membership_override(",
    "public.admin_directory()",
  ]) {
    const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(transition, new RegExp(`create or replace function ${escaped}[^]*?set search_path = pg_catalog`));
  }
  assert.doesNotMatch(transition, /set search_path = pg_catalog, public/);
  assert.match(privileges, /revoke all on function public\.is_platform_owner\(\) from public, anon/);
  assert.match(privileges, /grant execute on function public\.is_platform_owner\(\) to authenticated/);
  assert.match(privileges, /revoke all on function public\.inventory_event_workspace_for_user\(uuid\) from public, anon, authenticated/);
  const ledger = read("supabase/migrations/202608120002_inventory_event_ledger.sql");
  assert.match(ledger, /public\.inventory_event_workspace_for_user\(v_user_id\)/);
  assert.doesNotMatch(transition, /\b(grant|revoke)\s+(all|execute)/i);
});

test("owner bootstrap covers existing-owner, legacy-email, empty, and unsafe-populated paths", () => {
  const transition = read("supabase/migrations/20260917154750_platform_owner_role_authority_transition.sql");

  assert.match(transition, /exists \(select 1 from public\.user_roles where role = 'owner'\)/);
  assert.match(transition, /lower\(email::text\) = 'tradingdocks@gmail\.com'/);
  assert.match(transition, /not exists \(select 1 from auth\.users\)/);
  assert.match(transition, /requires an existing owner or the historical bootstrap identity/);
  assert.doesNotMatch(transition, /is_platform_owner\([^)]*email|auth\.users[^\n]*email[^\n]*owner/s);
});

test("owner transition migrations remain explicitly ordered", () => {
  const migrations = [
    "20260917154003_production_function_search_path_hardening.sql",
    "20260917154008_production_function_privilege_hardening.sql",
    "20260917154750_platform_owner_role_authority_transition.sql",
  ];
  assert.deepEqual([...migrations].sort(), migrations);
});

test("staging function-surface repair contains only the missing PR #93 objects", () => {
  const repair = read("supabase/staging-repair/20260917163455_staging_function_surface_repair.sql");
  const requiredSignatures = [
    "admin_directory()",
    "admin_list_users(search_text text default '', result_limit integer default 100)",
    "admin_overview()",
    "admin_update_user_access(",
    "apply_collector_inventory_mutation(",
    "create_inventory_item_with_event(",
    "move_inventory_lot_quantity(",
    "remove_inventory_lot_quantity(",
    "collector_inventory_acting_user()",
    "inventory_event_text_value(p_value jsonb)",
    "inventory_events_block_mutation()",
    "set_tcgtracking_updated_at()",
  ];

  for (const signature of requiredSignatures) {
    assert.ok(repair.includes(`create function public.${signature}`), `missing repair signature: ${signature}`);
  }
  assert.match(repair, /ukrcbmujzdyclrkghbvo/);
  assert.match(repair, /to_regclass\('public\.inventory_items'\)/);
  assert.match(repair, /to_regclass\('public\.inventory_events'\)/);
  assert.match(repair, /to_regclass\('public\.admin_audit_log'\)/);
  assert.match(repair, /to_regprocedure\('public\.inventory_event_workspace_for_user\(uuid\)'\)/);
  assert.match(repair, /provider_category_id/);
  assert.match(repair, /provider_product_id/);
  assert.match(repair, /provider_sku_id/);
  assert.match(repair, /inventory_events_append_only/);
  assert.match(repair, /Staging append-only trigger was not created/);
  assert.doesNotMatch(repair, /bohddnajlnmknngzjsjk/);
  assert.doesNotMatch(repair, /\b(drop|truncate|delete from)\b/i);
  assert.doesNotMatch(repair, /\balter table\b|\bcreate table\b|\bcreate type\b|\bcreate index\b/i);
  assert.doesNotMatch(repair, /marketplace|tournament|stripe|revenuecat/i);
});

test("staging prerequisite repair is canonical, forward-only, and limited to the four missing families", () => {
  const repair = read("supabase/staging-repair/20260917180121_staging_prerequisite_repair.sql");
  const canonicalAccess = read("supabase/migrations/202608100001_platform_role_authority_replayability.sql");
  const canonicalLedger = read("supabase/migrations/202608120002_inventory_event_ledger.sql");

  for (const dependency of [
    "auth.users",
    "public.workspaces",
    "public.inventory_items",
    "public.inventory_locations",
    "public.user_roles",
    "public.workspace_members",
    "public.admin_role",
  ]) {
    assert.ok(repair.includes(dependency), `missing dependency preflight: ${dependency}`);
  }
  assert.match(repair, /create table if not exists public\.admin_account_access/);
  assert.match(repair, /create type public\.inventory_event_type as enum/);
  assert.match(repair, /create type public\.inventory_event_source as enum/);
  assert.match(repair, /create table if not exists public\.inventory_events/);
  assert.match(repair, /create unique index if not exists inventory_events_user_idempotency_key_idx/);
  assert.match(repair, /alter table public\.inventory_events enable row level security/);
  assert.match(repair, /Users can view their inventory events/);
  assert.match(repair, /Users cannot update inventory events/);
  assert.match(repair, /Users cannot delete inventory events/);
  assert.match(repair, /account_type in \('free', 'collector', 'seller', 'store'\)/);
  assert.match(repair, /subscription_status in \('free', 'trialing', 'active', 'past_due', 'canceled', 'suspended'\)/);
  assert.match(repair, /inventory_events_inventory_item_fk/);
  assert.match(repair, /inventory_events_previous_location_fk/);
  assert.match(repair, /inventory_events_next_location_fk/);
  assert.match(repair, /inventory_events_currency_check/);
  assert.match(repair, /inventory_events_related_entity_check/);
  assert.match(repair, /add column if not exists provider_category_id text/);
  assert.match(repair, /add column if not exists provider_product_id text/);
  assert.match(repair, /add column if not exists provider_sku_id text/);
  assert.match(repair, /add column if not exists variant text/);
  assert.match(repair, /add column if not exists language text/);
  assert.match(repair, /create or replace function public\.inventory_event_workspace_for_user\(p_user_id uuid\)/);

  for (const value of [
    "inventory_created", "quantity_added", "quantity_removed", "quantity_adjusted",
    "location_changed", "condition_changed", "finish_changed", "cost_basis_changed",
    "inventory_archived", "inventory_restored", "imported",
    "collector_workspace", "manual", "mobile", "scanner", "scanner_replay",
    "purchasing_intelligence", "csv_import", "tcgplayer_import", "ebay_import",
    "shopify_import", "system",
  ]) {
    assert.ok(repair.includes(`'${value}'`), `missing canonical enum value: ${value}`);
  }

  assert.match(canonicalAccess, /create table if not exists public\.admin_account_access[\s\S]*?updated_by uuid references auth\.users\(id\)/);
  assert.match(canonicalLedger, /constraint inventory_events_inventory_item_fk[\s\S]*?references public\.inventory_items\(user_id, id\)/);
  assert.match(canonicalLedger, /create unique index if not exists inventory_events_user_idempotency_key_idx/);
  assert.doesNotMatch(repair, /\b(drop|truncate|delete from)\b/i);
  assert.doesNotMatch(repair, /bohddnajlnmknngzjsjk/);
  assert.doesNotMatch(repair, /marketplace|tournament|stripe|revenuecat/i);
  assert.doesNotMatch(repair, /create function public\.inventory_events_block_mutation/);
});

test("staging repair utilities stay outside the production migration stream", () => {
  const surface = read("supabase/staging-repair/20260917163455_staging_function_surface_repair.sql");
  const prerequisite = read("supabase/staging-repair/20260917180121_staging_prerequisite_repair.sql");
  const migrationFiles = readdirSync("supabase/migrations");

  assert.ok(!migrationFiles.includes("20260917163455_staging_function_surface_repair.sql"));
  assert.ok(!migrationFiles.includes("20260917180121_staging_prerequisite_repair.sql"));
  assert.match(surface, /staging/i);
  assert.match(prerequisite, /STAGING-ONLY/i);
  assert.match(surface, /inventory_events_append_only/);
  assert.match(surface, /not exists \([\s\S]*?pg_trigger[\s\S]*?tgname = 'inventory_events_append_only'/);
});
