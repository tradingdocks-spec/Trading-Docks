import test from "node:test";
import assert from "node:assert/strict";
import { CAMPAIGN_PLACEMENTS, hashApprovedBody, normalizeClaims, outreachApprovalChecks, validatePlacement } from "../src/lib/marketing/campaign-workflow.ts";
import { readFileSync } from "node:fs";

test("campaign placement validation requires exact approved dimensions", () => {
  assert.equal(validatePlacement("email_hero", { status: "draft", platform: "email", width: 1200, height: 628 }), "Only approved creatives can be attached to a campaign placement.");
  assert.match(validatePlacement("email_hero", { status: "approved", platform: "instagram_square", width: 1080, height: 1080 }) ?? "", /requires an approved/);
  assert.equal(validatePlacement("email_hero", { status: "approved", platform: "email", width: 1200, height: 628 }), null);
  assert.equal(Object.keys(CAMPAIGN_PLACEMENTS).length, 9);
});

test("outreach approval checks expose sender and suppression blockers", () => {
  const checks = outreachApprovalChecks({ email: "owner@example.com", subject: "Subject", bodyText: "Body", campaignId: "campaign", featureId: "feature", cta: "Explore", suppressed: false, senderConfigured: false });
  assert.equal(checks.find((check) => check.key === "recipient")?.ok, true);
  assert.equal(checks.find((check) => check.key === "sender")?.ok, false);
  assert.equal(outreachApprovalChecks({ email: "owner@example.com", subject: "Subject", bodyText: "Body", campaignId: "campaign", featureId: "feature", cta: "Explore", suppressed: true, senderConfigured: true }).find((check) => check.key === "suppression")?.ok, false);
});

test("claims normalize to approved feature-library provenance and body hashes are stable", () => {
  assert.deepEqual(normalizeClaims([{ claim: "Keeps locations connected" }, "Keeps batches visible"]), [{ claim: "Keeps locations connected", source: "Feature Library", approved: true }, { claim: "Keeps batches visible", source: "Feature Library", approved: true }]);
  const input = { subject: "Subject", bodyText: "Body", creativeId: "creative", campaignId: "campaign" };
  assert.equal(hashApprovedBody(input), hashApprovedBody(input));
});

test("workflow APIs remain admin-only, approval-gated, and mock-only", () => {
  const campaignRoute = readFileSync("src/app/api/admin/marketing/campaigns/[id]/route.ts", "utf8");
  const creativeRoute = readFileSync("src/app/api/admin/marketing/creative/[id]/route.ts", "utf8");
  const outreachRoute = readFileSync("src/app/api/admin/marketing/outreach/route.ts", "utf8");
  assert.match(campaignRoute, /requireServerPlatformRole\("admin"\)/);
  assert.match(campaignRoute, /validatePlacement/);
  assert.match(creativeRoute, /status === "approved"/);
  assert.match(creativeRoute, /marketing_use_approved/);
  assert.match(outreachRoute, /Only approved drafts can enter the mock send queue/);
  assert.match(outreachRoute, /createGrowthEmailProvider/);
  assert.match(outreachRoute, /mockOnly: true/);
});
