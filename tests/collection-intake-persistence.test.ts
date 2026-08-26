import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { apiAccessRuleForPath } from "../src/lib/platform/api-access.ts";
import { collectionIntakeFromRow } from "../src/lib/collection-intake/server.ts";

const repoRoot = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

test("Collection Intake API is protected by buying.manage", () => {
  const rule = apiAccessRuleForPath("/api/collection-intake");
  assert.equal(rule?.kind, "capability");
  assert.equal(rule?.capability, "buying.manage");
});

test("Collection Intake schema creates server-backed drafts, items, purchases, and finalizer", () => {
  const migration = source("supabase/migrations/202608120004_collection_intake.sql");

  assert.match(migration, /create table if not exists public\.collection_intakes/);
  assert.match(migration, /create table if not exists public\.collection_intake_items/);
  assert.match(migration, /create table if not exists public\.collection_purchases/);
  assert.match(migration, /create or replace function public\.complete_collection_intake/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /status <> 'purchased'/);
});

test("Collection Intake finalization uses event ledger and collection_purchase source", () => {
  const sourceMigration = source("supabase/migrations/202608120003_inventory_event_collection_purchase_source.sql");
  const intakeMigration = source("supabase/migrations/202608120004_collection_intake.sql");

  assert.match(sourceMigration, /alter type public\.inventory_event_source add value if not exists 'collection_purchase'/);
  assert.match(intakeMigration, /public\.create_inventory_item_with_event/);
  assert.match(intakeMigration, /'collection_purchase'::public\.inventory_event_source/);
  assert.match(intakeMigration, /'collection_purchase'/);
  assert.match(intakeMigration, /p_idempotency_key/);
  assert.match(intakeMigration, /on conflict \(user_id, idempotency_key\)/);
});

test("Collection Intake RLS prevents cross-user and direct purchase writes", () => {
  const migration = source("supabase/migrations/202608120004_collection_intake.sql");

  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
  assert.match(migration, /public\.can_manage_workspace\(workspace_id\)/);
  assert.match(migration, /create policy "No direct collection purchase writes"/);
  assert.match(migration, /on public\.collection_purchases for all to authenticated\s+using \(false\)\s+with check \(false\)/);
});

test("Collection Intake server mapping preserves exact printing fields", () => {
  const intake = collectionIntakeFromRow({
    id: "intake-1",
    status: "offer_ready",
    title: "Friday buy",
    seller_name: "Walk-in seller",
    seller_contact: "555-0100",
    scenario_key: "standard",
    scenario: {},
    actual_offer: 42,
    notes: "Counter accepted",
    created_at: "2026-08-12T10:00:00.000Z",
    updated_at: "2026-08-12T11:00:00.000Z",
    collection_intake_items: [
      {
        id: "line-1",
        card_name: "Sol Ring",
        game_id: "magic",
        product_type: "card",
        set_code: "CMM",
        collector_number: "399",
        scryfall_id: "scryfall-1",
        tcgplayer_product_id: 123,
        tcgplayer_sku_id: 456,
        condition: "Near Mint",
        finish: "foil",
        language: "English",
        quantity: 2,
        unit_market_value: 1.5,
        review_state: "ready",
        notes: "",
      },
    ],
  });

  assert.equal(intake.items[0].setCode, "CMM");
  assert.equal(intake.items[0].collectorNumber, "399");
  assert.equal(intake.items[0].condition, "Near Mint");
  assert.equal(intake.items[0].finish, "foil");
  assert.equal(intake.items[0].language, "English");
  assert.equal(intake.items[0].tcgplayerProductId, 123);
  assert.equal(intake.items[0].tcgplayerSkuId, 456);
});

test("Collection Buying page renders the server-backed Collection Intake workspace", () => {
  const page = source("src/app/dashboard/collection-buying/page.tsx");
  const workspace = source("src/components/dashboard/collection-intake/CollectionIntakeWorkspace.tsx");

  assert.match(page, /CollectionIntakeWorkspace/);
  assert.match(workspace, /\/api\/collection-intake/);
  assert.match(workspace, /Complete purchase/);
  assert.match(workspace, /Product lookup/);
  assert.match(workspace, /Resolve blocking review lines/);
});
