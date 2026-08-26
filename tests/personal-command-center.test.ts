import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildPersonalCommandCenterSummary,
  PERSONAL_COMMAND_CENTER_SAMPLE_SIZE,
} from "../src/lib/dashboard/personal-command-center.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const access = {
  userId: "user-1",
  workspaceId: "workspace-1",
};

test("personal command center does not fabricate collection activity for an empty account", () => {
  const summary = buildPersonalCommandCenterSummary({
    access,
    rows: [],
    totalInventoryRows: 0,
    now: new Date("2026-08-10T12:00:00.000Z"),
  });

  assert.equal(summary.totalInventoryRows, 0);
  assert.equal(summary.knownMarketValue, null);
  assert.equal(summary.sampledQuantity, 0);
  assert.equal(summary.storageCoveragePercent, 0);
  assert.match(summary.brief, /does not show demo collection activity/i);
  assert.deepEqual(summary.actions.map((action) => action.id), ["add-inventory", "scan-card"]);
});

test("personal command center derives storage and price actions from user-scoped inventory rows", () => {
  const summary = buildPersonalCommandCenterSummary({
    access,
    rows: [
      {
        id: "priced-located",
        quantity: 2,
        inventory_value: 42,
        location_id: "binder-1",
        data: { condition: "near_mint", finish: "foil" },
      },
      {
        id: "unassigned",
        quantity: "3",
        inventory_value: null,
        location_id: null,
        data: { condition: "unknown", finish: "" },
      },
    ],
    totalInventoryRows: 2,
    now: new Date("2026-08-10T12:00:00.000Z"),
  });

  assert.equal(summary.sampledQuantity, 5);
  assert.equal(summary.knownMarketValue, 42);
  assert.equal(summary.knownPriceRows, 1);
  assert.equal(summary.missingPriceRows, 1);
  assert.equal(summary.unassignedRows, 1);
  assert.equal(summary.unknownConditionRows, 1);
  assert.equal(summary.unknownFinishRows, 1);
  assert.equal(summary.storageCoveragePercent, 50);
  assert.equal(summary.priceCoveragePercent, 50);
  assert.deepEqual(summary.actions.map((action) => action.id), [
    "assign-storage",
    "review-missing-prices",
    "complete-card-details",
    "open-collection",
  ]);
  assert.ok(summary.actions.every((action) => action.evidence.length > 0));
});

test("personal command center labels bounded inventory analysis as a sample", () => {
  const rows = Array.from({ length: PERSONAL_COMMAND_CENTER_SAMPLE_SIZE }, (_, index) => ({
    id: `item-${index}`,
    quantity: 1,
    inventory_value: 1,
    location_id: "box-1",
    data: { condition: "near_mint", finish: "normal" },
  }));
  const summary = buildPersonalCommandCenterSummary({
    access,
    rows,
    totalInventoryRows: PERSONAL_COMMAND_CENTER_SAMPLE_SIZE + 1,
  });

  assert.equal(summary.sampleLimited, true);
  assert.match(summary.brief, /recent rows sampled/i);
  assert.equal(summary.knownMarketValue, PERSONAL_COMMAND_CENTER_SAMPLE_SIZE);
});

test("dashboard wires personal command center through the same authenticated dashboard page", () => {
  const page = readFileSync(path.join(repoRoot, "src/app/dashboard/page.tsx"), "utf8");
  const component = readFileSync(
    path.join(repoRoot, "src/components/dashboard/workspace/ModularWorkspace.tsx"),
    "utf8",
  );
  const service = readFileSync(path.join(repoRoot, "src/lib/dashboard/personal-command-center.ts"), "utf8");

  assert.match(page, /loadPersonalCommandCenter\(\{/);
  assert.match(page, /resolvePlatformAccessForUser\(supabase, user\)/);
  assert.match(page, /personalSummary=\{personalSummary\}/);
  assert.match(component, /personalSummary\?: PersonalCommandCenterSummary/);
  assert.match(component, /const brief = summary\?\.brief/);
  assert.doesNotMatch(component, /Open actions" value="3"/);
  assert.match(service, /\.eq\("user_id", access\.userId\)/);
  assert.match(service, /PERSONAL_COMMAND_CENTER_SAMPLE_SIZE/);
});
