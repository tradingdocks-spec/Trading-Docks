import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(repoRoot, "supabase/migrations");

test("Supabase root migrations use unique versions and avoid external include directives", () => {
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const versions = new Map<string, string[]>();

  for (const file of migrationFiles) {
    const version = file.split("_")[0];
    versions.set(version, [...(versions.get(version) ?? []), file]);
    const source = readFileSync(path.join(migrationsDir, file), "utf8");
    assert.doesNotMatch(source, /^\\i[r]?\s/m, `${file} depends on an external SQL include`);
  }

  const duplicates = [...versions.entries()].filter(([, files]) => files.length > 1);
  assert.deepEqual(duplicates, []);
});

test("canonical platform role authority is replayable from the root migration chain", () => {
  const authorityMigration = readFileSync(
    path.join(migrationsDir, "202608100001_platform_role_authority_replayability.sql"),
    "utf8",
  );
  const mobileOnlyMigration = readFileSync(
    path.join(repoRoot, "mobile/supabase/migrations/20260804_admin_command_center.sql"),
    "utf8",
  );

  for (const required of [
    "create type public.admin_role",
    "create table if not exists public.user_roles",
    "create table if not exists public.admin_account_access",
    "create or replace function public.current_admin_role",
    "create or replace function public.is_admin",
    "create or replace function public.promote_owner",
    "create or replace function public.admin_list_users",
    "create or replace function public.admin_overview",
    "create or replace function public.admin_update_user_access",
  ]) {
    assert.match(authorityMigration, new RegExp(escapeRegExp(required)), `${required} missing from root authority migration`);
    assert.match(mobileOnlyMigration, new RegExp(escapeRegExp(required)), `${required} missing from mobile reference migration`);
  }

  const isPlatformOwnerBody = authorityMigration.match(/create or replace function public\.is_platform_owner\(\)[\s\S]*?\$\$;/)?.[0] ?? "";
  assert.match(isPlatformOwnerBody, /current_admin_role\(\) = 'owner'/);
  assert.doesNotMatch(isPlatformOwnerBody, /tradingdocks@gmail\.com/i);
});

test("Collector mutation enforcement is represented as database-side trigger and RPC", () => {
  const migration = readFileSync(
    path.join(migrationsDir, "202608050001_collector_mutation_security_proposal.sql"),
    "utf8",
  );
  const verification = readFileSync(
    path.join(repoRoot, "supabase/verification/verify_collector_mutation_security.sql"),
    "utf8",
  );

  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /create trigger enforce_collector_inventory_mutation_insert/);
  assert.match(migration, /create trigger enforce_collector_inventory_mutation_update/);
  assert.match(migration, /create trigger enforce_collector_inventory_mutation_delete/);
  assert.match(migration, /create or replace function public\.collector_mutate_inventory_item\(operation jsonb\)/);
  assert.match(migration, /TD_COLLECTOR_FREE_LIMIT_EXCEEDED/);
  assert.match(migration, /TD_COLLECTOR_UNAUTHORIZED/);
  assert.match(verification, /Free user below and reaching limit/);
  assert.match(verification, /Quantity decrease then crossing-limit increase/);
  assert.match(verification, /Simultaneous inserts are protected by per-user advisory locks/);
});

test("fresh bootstrap verification covers core app tables RLS storage and enforcement objects", () => {
  const verification = readFileSync(
    path.join(repoRoot, "supabase/verification/verify_fresh_bootstrap_contract.sql"),
    "utf8",
  );

  for (const required of [
    "public.user_roles",
    "public.billing_provider_subscriptions",
    "public.inventory_items",
    "public.inventory_label_identities",
    "public.marketplace_orders",
    "public.workspace_documents",
    "public.collector_mutate_inventory_item(jsonb)",
    "feedback-attachments",
    "relrowsecurity",
    "enforce_collector_inventory_mutation_insert",
  ]) {
    assert.match(verification, new RegExp(escapeRegExp(required)), `${required} missing from bootstrap verification`);
  }
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
