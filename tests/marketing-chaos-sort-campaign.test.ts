import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateCreativeDirections } from "../src/lib/marketing/brand-system.ts";
import { buildChaosSortBenchmarkSpecs, CHAOS_SORT_PROFILE, selectChaosSortScreenshot } from "../src/lib/marketing/chaos-sort-campaign.ts";

const approved = (overrides: Record<string, unknown> = {}) => ({ id: "asset", name: "Chaos Sort workflow", asset_type: "product_screenshot", feature_ids: ["feature-chaos"], screenshot_role: "workflow", approval_status: "approved", marketing_use_approved: true, archived_at: null, ...overrides });

test("Chaos Sort screenshot selection rejects drafts, archived, and unrelated feature assets", () => {
  const assets = [approved({ id: "draft", approval_status: "draft" }), approved({ id: "other-feature", feature_ids: ["feature-inventory"] }), approved({ id: "archived", archived_at: "2026-09-19T00:00:00Z" }), approved({ id: "valid" })];
  assert.equal(selectChaosSortScreenshot(assets, "feature-chaos")?.id, "valid");
});

test("Chaos Sort screenshot selection prefers primary over workflow, detail, and mobile", () => {
  const assets = [approved({ id: "mobile", screenshot_role: "mobile" }), approved({ id: "detail", screenshot_role: "detail" }), approved({ id: "workflow", screenshot_role: "workflow" }), approved({ id: "primary", screenshot_role: "primary" })];
  assert.equal(selectChaosSortScreenshot(assets, "feature-chaos")?.id, "primary");
});

test("Chaos Sort profile keeps approved facts and prohibited unsupported claims", () => {
  assert.equal(CHAOS_SORT_PROFILE.description, "Turn unsorted cards into identifiable, trackable inventory.");
  assert.ok(CHAOS_SORT_PROFILE.approvedClaims.some((claim) => claim.includes("card intake")));
  assert.ok(CHAOS_SORT_PROFILE.prohibitedClaims.some((claim) => claim.includes("10x")));
});

test("first Chaos Sort benchmark produces three directions and six linked variants", () => {
  const concepts = generateCreativeDirections({ featureName: "Chaos Sort", customerDescription: CHAOS_SORT_PROFILE.description, cta: "See Chaos Sort" });
  assert.equal(concepts.length, 3);
  for (const concept of concepts) {
    const variants = buildChaosSortBenchmarkSpecs(concept, "/uploads/chaos-sort-primary.png");
    assert.equal(variants.length, 6);
    assert.ok(variants.every((variant) => variant.featureName === "Chaos Sort" && variant.conceptDirection === concept.direction && variant.productAssetUrl === "/uploads/chaos-sort-primary.png"));
  }
  assert.deepEqual([concepts[0].headline, concepts[0].subheadline], ["Sort the chaos.", "Turn unsorted cards into organized, trackable inventory."]);
  assert.deepEqual([concepts[1].headline, concepts[1].subheadline], ["Collections don't arrive organized.", "Move from unsorted intake to identifiable, trackable inventory."]);
  assert.equal(concepts[2].headline, "From collection buy to searchable inventory.");
});

test("Creative Studio supports manual screenshot swap and approval-gated Gold Standard promotion", () => {
  const studio = readFileSync("src/components/dashboard/admin/marketing/CreativeRendererWorkspace.tsx", "utf8");
  const goldRoute = readFileSync("src/app/api/admin/marketing/creative/[id]/route.ts", "utf8");
  assert.match(studio, /setProductAssetId/);
  assert.match(studio, /selectChaosSortScreenshot/);
  assert.match(goldRoute, /Only approved creatives can enter the Gold Standard Library/);
  assert.match(goldRoute, /approved authentic product screenshot proof/);
  assert.match(goldRoute, /campaign_visual_family_id/);
});
