import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { buildCollectionCards } from "../mobile/services/collector-workspace.ts";
import {
  changedMutations,
  draftFromCard,
  draftsEqual,
} from "../src/lib/collector-card-detail-draft.ts";

const card = buildCollectionCards({
  locations: [
    { id: "loc-1", name: "Main Binder", location_type: "binder", data: {} },
  ],
  items: [
    {
      id: "inventory-1",
      card_name: "Test Card",
      set_code: "tst",
      collector_number: "1",
      quantity: 2,
      inventory_value: 10,
      updated_at: "2026-09-16T00:00:00Z",
      location_id: "loc-1",
      data: {
        name: "Test Card",
        set: "tst",
        setName: "Test Set",
        collectorNumber: "1",
        finish: "Nonfoil",
        condition: "Near Mint",
      },
    },
  ],
})[0]!;

test("card detail draft emits only changed fields, including quantity decreases to zero", () => {
  const base = draftFromCard(card);
  assert.equal(draftsEqual(base, draftFromCard(card)), true);

  const zero = { ...base, quantity: 0 };
  assert.deepEqual(changedMutations(card, zero, "user-1"), [
    {
      type: "quantity",
      userId: "user-1",
      inventoryItemId: "inventory-1",
      quantity: 0,
    },
  ]);

  const one = { ...base, quantity: 1 };
  assert.deepEqual(changedMutations(card, one, "user-1")[0], {
    type: "quantity",
    userId: "user-1",
    inventoryItemId: "inventory-1",
    quantity: 1,
  });
});

test("card detail draft preserves independent edits for condition, finish, storage, trade, and wishlist", () => {
  const draft = {
    ...draftFromCard(card),
    quantity: 4,
    condition: "Lightly Played" as const,
    finish: "Foil" as const,
    storageLocationId: null,
    tradeStatus: "available" as const,
    wishlisted: true,
  };
  const mutations = changedMutations(card, draft, "user-1");
  assert.deepEqual(
    mutations.map((mutation) => mutation.type),
    [
      "quantity",
      "condition",
      "finish",
      "storage",
      "trade_binder_status",
      "wishlist",
    ],
  );
  assert.deepEqual(
    mutations.find((mutation) => mutation.type === "condition"),
    {
      type: "condition",
      userId: "user-1",
      inventoryItemId: "inventory-1",
      condition: "Lightly Played",
    },
  );
  assert.deepEqual(
    mutations.find((mutation) => mutation.type === "finish"),
    {
      type: "finish",
      userId: "user-1",
      inventoryItemId: "inventory-1",
      finish: "Foil",
    },
  );
  assert.deepEqual(
    mutations.find((mutation) => mutation.type === "storage"),
    {
      type: "storage",
      userId: "user-1",
      inventoryItemId: "inventory-1",
      storageLocationId: null,
    },
  );
  assert.deepEqual(
    mutations.find((mutation) => mutation.type === "trade_binder_status"),
    {
      type: "trade_binder_status",
      userId: "user-1",
      inventoryItemId: "inventory-1",
      status: "available",
    },
  );
  assert.equal(
    mutations.find((mutation) => mutation.type === "wishlist")?.type,
    "wishlist",
  );
});

test("card detail save workflow has dirty, duplicate-submit, refresh, and failure-preservation safeguards", () => {
  const source = fs.readFileSync(
    new URL(
      "../src/components/dashboard/collector-workspace/CollectorCardDetail.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /const dirty = Boolean\(/);
  assert.match(source, /saveState === "saving"/);
  assert.match(source, /await refresh\(\);/);
  assert.match(source, /setSaveError\(/);
  assert.match(source, /beforeunload/);
  assert.match(source, /disabled=\{!dirty \|\| saveState === "saving"\}/);
  assert.match(source, /Couldn’t save changes/);
});
