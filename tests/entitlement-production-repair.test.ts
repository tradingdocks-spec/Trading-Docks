import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const migration = readFileSync(path.join(process.cwd(), 'supabase/migrations/20260917014520_entitlement_production_repair.sql'), 'utf8');

test('entitlement production repair is additive and restores only canonical collector objects', () => {
  for (const name of [
    'collector_effective_membership_tier',
    'collector_inventory_error_payload',
    'raise_collector_inventory_error',
    'collector_inventory_acting_user',
    'enforce_collector_inventory_mutation',
    'enforce_collector_inventory_mutation_insert',
    'enforce_collector_inventory_mutation_update',
    'enforce_collector_inventory_mutation_delete',
  ]) assert.match(migration, new RegExp(name));
  assert.match(migration, /security definer[\s\S]*set search_path = public/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /current_admin_role\(\)/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(migration, /drop\s+(table|schema)|truncate|delete\s+from|alter\s+table[\s\S]*drop/i);
});
