import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("Card Workspace establishes a canonical authenticated server loader", () => {
  const service = read("src/lib/card-workspace.ts");
  const page = read("src/app/dashboard/cards/[inventoryItemId]/page.tsx");

  assert.match(service, /export type CardWorkspaceData/);
  assert.match(service, /export async function getCardWorkspaceData/);
  assert.match(service, /\.from\("inventory_items"\)[\s\S]*\.eq\("user_id", userId\)[\s\S]*\.eq\("id", inventoryItemId\)/);
  assert.match(service, /relatedInventoryQuery\(supabase, userId/);
  assert.match(service, /\.from\("inventory_locations"\)[\s\S]*\.eq\("user_id", userId\)/);
  assert.match(service, /\.from\("marketplace_listing_mappings"\)[\s\S]*\.eq\("user_id", userId\)/);
  assert.match(service, /\.from\("deck_vault_decks"\)[\s\S]*\.eq\("user_id", userId\)/);
  assert.match(page, /supabase\.auth\.getUser/);
  assert.match(page, /redirect\(`\/sign-in\?next=\/dashboard\/cards/);
  assert.match(page, /notFound\(\)/);
});

test("Card Workspace separates aggregate position from inventory records and missing-data states", () => {
  const service = read("src/lib/card-workspace.ts");
  const view = read("src/components/dashboard/card-workspace/CardWorkspaceView.tsx");

  assert.match(service, /buildPosition/);
  assert.match(service, /knownCostQuantity/);
  assert.match(service, /resolveInventoryPositionFinancials/);
  assert.match(service, /financials\.coverageLabel/);
  assert.match(service, /Cost basis unavailable/);
  assert.match(service, /unrealizedGain: financials\.unrealizedGain/);
  assert.match(view, /Stored In/);
  assert.match(view, /Financial Position/);
  assert.match(view, /Average cost/);
  assert.match(view, /Gain \/ loss/);
  assert.match(view, /Only when cost and value exist/);
});

test("Card Workspace consumes shared inventory attention and exposes real actions only", () => {
  const service = read("src/lib/card-workspace.ts");
  const view = read("src/components/dashboard/card-workspace/CardWorkspaceView.tsx");

  assert.match(service, /buildInventoryAttentionSummary/);
  assert.match(service, /attentionTypes: issues\.map/);
  assert.match(service, /Edit inventory record/);
  assert.match(service, /Open Collection filter/);
  assert.match(service, /Open Deck Builder/);
  assert.doesNotMatch(service, /sell now|auto price|grade recommendation|future price/i);
  assert.match(view, /Missing price/);
  assert.match(view, /Missing cost basis/);
  assert.match(view, /Missing storage/);
  assert.match(view, /Unknown condition/);
  assert.match(view, /Unknown finish/);
});

test("Card Workspace route is reused by highest-value card encounter surfaces", () => {
  const collector = read("src/components/dashboard/collector-workspace/CollectorWorkspace.tsx");
  const inbox = read("src/app/dashboard/inventory/inbox/page.tsx");
  const globalSearch = read("src/components/dashboard/search/GlobalSearch.tsx");
  const view = read("src/components/dashboard/card-workspace/CardWorkspaceView.tsx");

  assert.match(collector, /\/dashboard\/cards\/\$\{encodeURIComponent\(card\.id\)\}/);
  assert.match(inbox, /\/dashboard\/cards\/\$\{encodeURIComponent\(item\.inventoryItemId\)\}/);
  assert.match(globalSearch, /\/dashboard\/cards\/\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(view, /Other Printings/);
  assert.match(view, /Performance Boundary/);
});

test("Card Workspace inventory history renders typed ledger details", () => {
  const service = read("src/lib/card-workspace.ts");
  const view = read("src/components/dashboard/card-workspace/CardWorkspaceView.tsx");

  assert.match(service, /previous_value,next_value,previous_location_id,next_location_id/);
  assert.match(service, /previousValue/);
  assert.match(service, /nextLocationId/);
  assert.match(view, /eventDetail\(event\)/);
  assert.match(view, /condition_changed/);
  assert.match(view, /location_changed/);
  assert.doesNotMatch(view, /JSON\.stringify\(event\.metadata/);
});
