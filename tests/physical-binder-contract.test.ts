import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BINDER_PLATFORM_BACKEND_TABLES,
  binderShareStatusLabel,
  binderSlotLabels,
  buildPhysicalBinderState,
  buildBinderSpread,
  createBinderSharePayload,
  normalizeBinderShareRequest,
  revokeBinderSharePayload,
  validateBinderPlacement,
  type PhysicalBinder,
  type PhysicalBinderCardPlacement,
} from "../mobile/services/physical-binder.ts";
import type { CollectionCard } from "../mobile/services/collector-workspace.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const binder: PhysicalBinder = {
  id: "binder-1",
  ownerUserId: "user-1",
  locationId: "loc-1",
  name: "Trade Night Binder",
  description: "Cards to bring to Friday night.",
  visibility: "unlisted",
  coverUrl: null,
  coverColor: "#172554",
  accentColor: "#67e8f9",
  pageCount: 20,
  rows: 3,
  columns: 3,
  isTradeBinder: true,
};

const card = {
  id: "card-1",
  cardName: "Unblinking Observer",
  quantityOwned: 2,
  printing: { setCode: "MID", collectorNumber: "82", finish: "normal", imageUrl: null },
  condition: "near_mint",
} as CollectionCard;

test("physical binder contract uses the existing web backend tables", () => {
  assert.deepEqual(BINDER_PLATFORM_BACKEND_TABLES, [
    "portfolio_binders",
    "portfolio_shares",
    "inventory_locations",
    "inventory_items",
  ]);

  const webAdapter = readFileSync(path.join(repoRoot, "src/lib/physical-binder.ts"), "utf8");
  assert.match(webAdapter, /mobile\/services\/physical-binder/);
});

test("binder pages render physical pocket grids with stable labels", () => {
  assert.deepEqual(binderSlotLabels(3, 3), ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"]);

  const placement: PhysicalBinderCardPlacement = { inventoryItemId: "card-1", card, page: 4, slot: "B2", quantity: 1 };
  const spread = buildBinderSpread(binder, 4, [placement]);

  assert.equal(spread.left.page, 3);
  assert.equal(spread.right.page, 4);
  assert.equal(spread.pageDepthLabel, "Pages 3-4 of 20");
  assert.equal(spread.right.pockets.find((pocket) => pocket.slot === "B2")?.placement?.card.cardName, "Unblinking Observer");
});

test("binder placement never infers quantity or pocket from card identity alone", () => {
  const valid = { inventoryItemId: "card-1", card, page: 1, slot: "A1", quantity: 2 };
  assert.deepEqual(validateBinderPlacement({ binder, placement: valid, existingPlacements: [] }), { ok: true });

  assert.equal(validateBinderPlacement({ binder, placement: { ...valid, quantity: 3 }, existingPlacements: [] }).ok, false);
  assert.equal(validateBinderPlacement({ binder, placement: { ...valid, slot: "Z9" }, existingPlacements: [] }).ok, false);
  assert.equal(validateBinderPlacement({ binder, placement: { ...valid, inventoryItemId: "other" }, existingPlacements: [] }).ok, false);
});

test("binder share requests normalize to the shared public link contract", () => {
  assert.deepEqual(
    normalizeBinderShareRequest({ binderId: "binder-1", scope: "spread", visibility: "public", page: 2.4 }),
    { binderId: "binder-1", scope: "spread", visibility: "public", page: 2 },
  );
  assert.deepEqual(
    normalizeBinderShareRequest({ binderId: "binder-1", scope: "market" as never, visibility: "secret" as never }),
    { binderId: "binder-1", scope: "binder", visibility: "unlisted", page: undefined },
  );
});

test("mobile and Headquarters binder state share the same location-backed entity", () => {
  const state = buildPhysicalBinderState({
    userId: "user-1",
    cards: [{
      ...card,
      storageLocation: { id: "loc-1", name: "Trade Night Binder", type: "binder", binderPage: 4, binderSlot: "B2" },
    } as CollectionCard],
    rawLocations: [{ id: "loc-1", name: "Trade Night Binder", location_type: "binder", data: { type: "binder", binderPages: 12, binderRows: 3, binderColumns: 3 } }],
    rawBinders: [{ id: "binder-1", user_id: "user-1", location_id: "loc-1", title: "HQ Binder", visibility: "unlisted" }],
    rawShares: [{ id: "share-1", token: "share-token", resource_id: "loc-1", visibility: "unlisted", is_active: true, revoked_at: null, share_type: "binder" }],
    activeBinderId: "binder-1",
    page: 4,
  });

  assert.equal(state.activeBinder?.id, "binder-1");
  assert.equal(state.activeBinder?.locationId, "loc-1");
  assert.equal(state.activeBinder?.name, "HQ Binder");
  assert.equal(state.activeSpread?.right.pockets.find((pocket) => pocket.slot === "B2")?.placement?.inventoryItemId, "card-1");
  assert.equal(state.activeBinder?.shareLink?.url, "/share/portfolio/share-token");
});

test("binder share create and revoke payloads use the canonical token contract", () => {
  assert.deepEqual(createBinderSharePayload({ binderId: "loc-1", scope: "binder", visibility: "unlisted" }), {
    scope: "binder",
    visibility: "unlisted",
    page: 1,
    binderLocationId: "loc-1",
  });

  assert.deepEqual(revokeBinderSharePayload({ token: "share-token" }).token, "share-token");
  assert.equal(binderShareStatusLabel({ token: "share-token", url: "/share/portfolio/share-token", visibility: "unlisted", scope: "binder", active: false }), "Revoked");
});
