import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCampaignDraftPlan, rankMarketingOpportunities } from "../src/lib/marketing/marketing-intelligence.ts";
import { marketingCaptureImportsAreSafe, validateCanonicalCaptureRequest } from "../src/lib/marketing/canonical-capture.ts";
import { getMarketingDemoFixture } from "../src/lib/marketing/marketing-demo-fixtures.ts";
import { MARKETING_PRODUCT_REGISTRY } from "../src/lib/marketing/product-marketing-registry.ts";

const proof = { id: "capture-1", name: "Chaos Sort primary capture", featureIds: ["chaos-sort"], role: "primary", source: "canonical_product_capture", approved: true, marketingApproved: true, archived: false };

test("product discovery registry covers the requested promotable features", () => {
  assert.deepEqual(MARKETING_PRODUCT_REGISTRY.map((feature) => feature.slug), ["chaos-sort", "inventory", "orders", "analytics", "collection-buying", "tournaments", "showcase", "marketplaces"]);
  assert.ok(MARKETING_PRODUCT_REGISTRY.every((feature) => feature.route.startsWith("/dashboard/")));
});

test("opportunity ranking is deterministic and prefers approved canonical proof", () => {
  const input = { audience: "local_game_store", objective: "awareness", channel: "instagram" };
  const first = rankMarketingOpportunities(MARKETING_PRODUCT_REGISTRY, [proof], [], [], input);
  const second = rankMarketingOpportunities(MARKETING_PRODUCT_REGISTRY, [proof], [], [], input);
  assert.deepEqual(first, second);
  assert.equal(first[0].feature.slug, "chaos-sort");
  assert.equal(first[0].productProof?.source, "canonical_product_capture");
  assert.equal(first[0].dataSource, "Approved product metadata + synthetic demo state");
});

test("unsupported claims are never introduced into a campaign plan", () => {
  const opportunity = rankMarketingOpportunities(MARKETING_PRODUCT_REGISTRY, [proof], [], [], { audience: "local_game_store", objective: "awareness", channel: "instagram" })[0];
  const plan = buildCampaignDraftPlan(opportunity, { audience: "local_game_store", objective: "awareness", channel: "instagram" });
  assert.deepEqual(plan.directions, ["product", "transformation", "editorial"]);
  assert.ok(plan.claims.every((claim) => !claim.toLowerCase().includes("10x")));
  assert.equal(plan.publishing, "admin_approval_required");
  assert.equal(plan.sending, "disabled_by_existing_flow");
});

test("canonical capture requests use synthetic fixtures and safe metadata", () => {
  const request = validateCanonicalCaptureRequest({ feature: "chaos-sort", state: "primary", viewport: "desktop", role: "primary" });
  assert.equal(request.feature, "chaos-sort");
  assert.equal(getMarketingDemoFixture("chaos-sort", "primary")?.dataSource, "synthetic_demo_state");
  assert.throws(() => validateCanonicalCaptureRequest({ feature: "chaos-sort", state: "missing" }), /Unknown synthetic/);
  assert.equal(marketingCaptureImportsAreSafe(readFileSync("src/app/internal/marketing-capture/[feature]/[state]/page.tsx", "utf8")), true);
  assert.equal(marketingCaptureImportsAreSafe(readFileSync("src/app/api/admin/marketing/intelligence/capture/route.ts", "utf8")), true);
});

test("intelligence endpoints remain admin-only and never send or publish", () => {
  const intelligenceRoute = readFileSync("src/app/api/admin/marketing/intelligence/route.ts", "utf8");
  const captureRoute = readFileSync("src/app/api/admin/marketing/intelligence/capture/route.ts", "utf8");
  assert.match(intelligenceRoute, /requireServerPlatformRole\("admin"\)/);
  assert.match(captureRoute, /requireServerPlatformRole\("admin"\)/);
  assert.match(intelligenceRoute, /publishing: "not performed"/);
  assert.match(intelligenceRoute, /sending: "not performed"/);
  assert.doesNotMatch(intelligenceRoute, /marketing_outreach_messages/);
  assert.doesNotMatch(intelligenceRoute, /resend|sendEmail|publishAd/i);
});
