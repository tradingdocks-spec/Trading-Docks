import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCampaignDraftPlan, rankMarketingOpportunities } from "../src/lib/marketing/marketing-intelligence.ts";
import { marketingCaptureImportsAreSafe, validateCanonicalCaptureRequest } from "../src/lib/marketing/canonical-capture.ts";
import { getMarketingDemoFixture } from "../src/lib/marketing/marketing-demo-fixtures.ts";
import { MARKETING_PRODUCT_REGISTRY } from "../src/lib/marketing/product-marketing-registry.ts";
import { captureSecretFingerprint, createCanonicalCaptureToken, verifyCanonicalCaptureToken, verifyCanonicalCaptureTokenDetailed } from "../src/lib/marketing/canonical-capture-auth.ts";

const proof = { id: "capture-1", name: "Chaos Sort primary capture", featureIds: ["chaos-sort"], role: "primary", source: "canonical_product_capture", approved: true, marketingApproved: true, archived: false };

function signedClaims(claims: Record<string, unknown>, secret: string) {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `v1.${payload}.${signature}`;
}

function signedPayload(raw: string, secret: string) {
  const payload = Buffer.from(raw, "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `v1.${payload}.${signature}`;
}

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

test("canonical capture tokens are signed, short-lived, and fixture-scoped", () => {
  const secret = "test-only-capture-secret";
  const token = createCanonicalCaptureToken("chaos-sort", "primary", secret, 1_000);
  assert.equal(verifyCanonicalCaptureToken(token, "chaos-sort", "primary", secret, 1_001), true);
  assert.equal(verifyCanonicalCaptureToken(token, "chaos-sort", "primary", secret, 1_301), false);
  assert.equal(verifyCanonicalCaptureToken(token, "not-registered", "primary", secret, 1_001), false);
  assert.equal(verifyCanonicalCaptureToken(token, "chaos-sort", "locations", secret, 1_001), false);
  assert.equal(verifyCanonicalCaptureToken(`${token.slice(0, -1)}x`, "chaos-sort", "primary", secret, 1_001), false);
  assert.equal(verifyCanonicalCaptureToken(token, "chaos-sort", "primary", "different-secret", 1_001), false);
  assert.throws(() => createCanonicalCaptureToken("chaos-sort", "not-registered", secret, 1_000), /Unknown canonical capture fixture/);
});

test("canonical capture diagnostics distinguish safe token failures", () => {
  const secret = "test-only-capture-secret";
  const token = createCanonicalCaptureToken("chaos-sort", "primary", secret, 1_000);
  assert.equal(verifyCanonicalCaptureTokenDetailed(token, "chaos-sort", "primary", secret, 1_001).code, "VALID");
  assert.equal(verifyCanonicalCaptureTokenDetailed("", "chaos-sort", "primary", secret, 1_001).code, "TOKEN_MISSING");
  assert.equal(verifyCanonicalCaptureTokenDetailed(token, "chaos-sort", "primary", "", 1_001).code, "SECRET_MISSING");
  assert.equal(verifyCanonicalCaptureTokenDetailed(token, "not-registered", "primary", secret, 1_001).code, "FIXTURE_UNREGISTERED");
  assert.equal(verifyCanonicalCaptureTokenDetailed("bad", "chaos-sort", "primary", secret, 1_001).code, "TOKEN_FORMAT_INVALID");
  assert.equal(verifyCanonicalCaptureTokenDetailed(`v2.${token.split(".").slice(1).join(".")}`, "chaos-sort", "primary", secret, 1_001).code, "TOKEN_VERSION_INVALID");
  assert.equal(verifyCanonicalCaptureTokenDetailed(`${token.slice(0, -1)}x`, "chaos-sort", "primary", secret, 1_001).code, "SIGNATURE_INVALID");
  assert.equal(verifyCanonicalCaptureTokenDetailed(`v1.${token.split(".")[1]}.AA`, "chaos-sort", "primary", secret, 1_001).code, "SIGNATURE_LENGTH_INVALID");
  assert.equal(verifyCanonicalCaptureTokenDetailed(signedPayload("not-json", secret), "chaos-sort", "primary", secret, 1_001).code, "PAYLOAD_INVALID");
  const featureMismatchToken = createCanonicalCaptureToken("inventory", "locations", secret, 1_000);
  assert.equal(verifyCanonicalCaptureTokenDetailed(featureMismatchToken, "chaos-sort", "locations", secret, 1_001).code, "FEATURE_MISMATCH");
  const stateMismatchToken = createCanonicalCaptureToken("chaos-sort", "locations", secret, 1_000);
  assert.equal(verifyCanonicalCaptureTokenDetailed(stateMismatchToken, "chaos-sort", "primary", secret, 1_001).code, "STATE_MISMATCH");
  assert.equal(verifyCanonicalCaptureTokenDetailed(signedClaims({ feature: "chaos-sort", state: "primary", exp: 2_000, nonce: "bad" }, secret), "chaos-sort", "primary", secret, 1_001).code, "NONCE_INVALID");
  const previousDeploymentId = process.env.VERCEL_DEPLOYMENT_ID;
  process.env.VERCEL_DEPLOYMENT_ID = "verifier-deployment";
  try {
    assert.equal(verifyCanonicalCaptureTokenDetailed(signedClaims({ feature: "chaos-sort", state: "primary", exp: 2_000, nonce: "a".repeat(32), issuerDeploymentId: "issuer-deployment" }, secret), "chaos-sort", "primary", secret, 1_001).code, "CAPTURE_DEPLOYMENT_MISMATCH");
  } finally {
    if (previousDeploymentId === undefined) delete process.env.VERCEL_DEPLOYMENT_ID;
    else process.env.VERCEL_DEPLOYMENT_ID = previousDeploymentId;
  }
  assert.equal(verifyCanonicalCaptureTokenDetailed(token, "chaos-sort", "primary", secret, 1_301).code, "TOKEN_EXPIRED");
  assert.match(captureSecretFingerprint(secret), /^[a-f0-9]{8}$/);
  assert.notEqual(captureSecretFingerprint(secret), secret);
});

test("canonical capture auth remains limited to the synthetic internal page", () => {
  const page = readFileSync("src/app/internal/marketing-capture/[feature]/[state]/page.tsx", "utf8");
  const runner = readFileSync("src/lib/marketing/canonical-capture-runner.ts", "utf8");
  assert.match(page, /verifyCanonicalCaptureTokenDetailed/);
  assert.match(page, /requireServerPlatformRole\("admin"\)/);
  assert.match(page, /if \(token\) notFound\(\)/);
  assert.doesNotMatch(page, /"use client"/);
  assert.doesNotMatch(page, /NEXT_PUBLIC_MARKETING_CAPTURE_SECRET/);
  assert.doesNotMatch(runner, /storageState/);
  assert.match(runner, /MARKETING_CAPTURE_BASE_URL|options\.baseUrl/);
  assert.match(runner, /capture_token/);
  assert.equal(marketingCaptureImportsAreSafe(page), true);
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

test("campaign draft handoff exposes review and Creative Studio links", () => {
  const route = readFileSync("src/app/api/admin/marketing/intelligence/route.ts", "utf8");
  const workspace = readFileSync("src/components/dashboard/admin/marketing/MarketingIntelligenceWorkspace.tsx", "utf8");
  assert.match(route, /campaignReview/);
  assert.match(route, /creativeStudio/);
  assert.match(route, /marketing_creative_briefs/);
  assert.match(workspace, /Campaign draft created/);
  assert.match(workspace, /Review Campaign/);
  assert.match(workspace, /campaignReview/);
  assert.match(workspace, /handoff\.links\.creativeStudio/);
  assert.match(workspace, /No publishing or email sending occurred/);
});

test("campaign review and Creative Studio preserve draft-only handoff", () => {
  const review = readFileSync("src/components/dashboard/admin/marketing/CampaignDetailWorkspace.tsx", "utf8");
  const studio = readFileSync("src/components/dashboard/admin/marketing/CreativeRendererWorkspace.tsx", "utf8");
  assert.match(review, /Creative Strategy/);
  assert.match(review, /Product Proof/);
  assert.match(review, /Archive Draft/);
  assert.match(studio, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(studio, /campaigns\/\$\{selectedCampaignId\}/);
  assert.match(studio, /setProductAssetId/);
});

test("exports retain deterministic filenames and block missing product proof", () => {
  const exportRoute = readFileSync("src/app/api/admin/marketing/creative/renderer/export/route.ts", "utf8");
  const studio = readFileSync("src/components/dashboard/admin/marketing/CreativeRendererWorkspace.tsx", "utf8");
  assert.match(exportRoute, /product screenshot before exporting/);
  assert.match(exportRoute, /\$\{spec\.width\}x\$\{spec\.height\}/);
  assert.match(studio, /Download PNG/);
  assert.match(studio, /Add an approved .* product screenshot before exporting/);
});
