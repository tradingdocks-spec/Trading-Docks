import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MARKETING_EMAIL_TEMPLATES,
  campaignReadiness,
  evaluateMarketingAudience,
  normalizeMarketingStatus,
  type MarketingContact,
} from "../src/lib/marketing/campaigns.ts";
import { apiAccessRuleForPath } from "../src/lib/platform/api-access.ts";
import { hasRouteAccess } from "../src/lib/platform/route-access.ts";
import { getAccountAwareNavigationGroups } from "../src/components/dashboard/navigation.ts";
import { clientAccessFromTier, resolvePlatformAccessContext } from "../mobile/services/platform-access.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const contacts: MarketingContact[] = [
  {
    id: "subscribed",
    first_name: "Sub",
    last_name: "Scribed",
    email: "sub@example.com",
    tags: ["VIP", "Magic"],
    marketing_email_consent: true,
  },
  {
    id: "unknown",
    first_name: "Un",
    last_name: "Known",
    email: "unknown@example.com",
    tags: ["Magic"],
    marketing_email_consent: false,
  },
  {
    id: "missing-email",
    first_name: "Missing",
    last_name: "Email",
    email: null,
    tags: ["VIP"],
    marketing_email_consent: true,
  },
  {
    id: "unsubscribed",
    first_name: "Opted",
    last_name: "Out",
    email: "out@example.com",
    tags: ["VIP"],
    marketing_status: "unsubscribed",
    marketing_email_consent: true,
  },
  {
    id: "suppressed",
    first_name: "Hard",
    last_name: "Bounce",
    email: "bounce@example.com",
    tags: ["Pokemon"],
    marketing_status: "suppressed",
    suppression_reason: "hard_bounce",
    marketing_email_consent: true,
  },
];

test("marketing contact status never treats unknown consent as subscribed", () => {
  assert.equal(normalizeMarketingStatus(contacts[0]), "subscribed");
  assert.equal(normalizeMarketingStatus(contacts[1]), "unknown");
  assert.equal(normalizeMarketingStatus(contacts[3]), "unsubscribed");
  assert.equal(normalizeMarketingStatus(contacts[4]), "suppressed");
});

test("marketing audience summary separates eligible recipients from exclusions", () => {
  const summary = evaluateMarketingAudience(contacts, { mode: "all_subscribed" });

  assert.deepEqual(summary.eligible.map((contact) => contact.id), ["subscribed"]);
  assert.equal(summary.totalSelected, 5);
  assert.equal(summary.excluded.missing_email, 1);
  assert.equal(summary.excluded.unknown_consent, 1);
  assert.equal(summary.excluded.unsubscribed, 1);
  assert.equal(summary.excluded.suppressed, 1);
  assert.equal(summary.totalExcluded, 4);
});

test("tag and manual marketing audiences preserve consent filtering", () => {
  const tagged = evaluateMarketingAudience(contacts, { mode: "tagged", tags: ["VIP"] });
  assert.deepEqual(tagged.eligible.map((contact) => contact.id), ["subscribed"]);
  assert.equal(tagged.totalSelected, 3);

  const manual = evaluateMarketingAudience(contacts, { mode: "manual", contactIds: ["unknown", "subscribed"] });
  assert.deepEqual(manual.eligible.map((contact) => contact.id), ["subscribed"]);
  assert.equal(manual.excluded.unknown_consent, 1);
  assert.equal(manual.excluded.outside_audience, 3);
});

test("campaign readiness requires content sender identity and eligible audience", () => {
  const audience = evaluateMarketingAudience(contacts, { mode: "all_subscribed" });
  const ready = campaignReadiness({
    name: "Restock",
    subject: "New singles",
    previewText: "Fresh inventory",
    senderName: "Trading Docks",
    replyTo: "shop@example.com",
    content: "Come see what arrived.",
    audience: { mode: "all_subscribed" },
  }, audience);
  assert.equal(ready.ready, true);

  const blocked = campaignReadiness({
    name: "",
    subject: "",
    previewText: "",
    senderName: "",
    replyTo: "",
    content: "",
    audience: { mode: "manual", contactIds: [] },
  }, evaluateMarketingAudience(contacts, { mode: "manual", contactIds: [] }));
  assert.equal(blocked.ready, false);
  assert.match(blocked.reasons.join(" "), /Campaign name is required/);
  assert.match(blocked.reasons.join(" "), /At least one subscribed recipient/);
});

test("marketing templates cover the required reusable campaign starters", () => {
  const names = MARKETING_EMAIL_TEMPLATES.map((template) => template.name);
  for (const expected of [
    "New arrivals",
    "Restock",
    "Sale / promotion",
    "Event announcement",
    "Buying collections",
    "General newsletter",
  ]) {
    assert.ok(names.includes(expected), `Missing template ${expected}`);
  }
});

test("Marketing navigation and route access use canonical crm.manage entitlement", () => {
  const seller = clientAccessFromTier("seller", { workspaceRole: "manager" });
  const collector = clientAccessFromTier("collector");
  const owner = resolvePlatformAccessContext({
    authenticated: true,
    platformRole: "owner",
    platformRoleAuthority: "trusted",
    effectiveMembershipTier: "free",
  });
  const sellerHrefs = getAccountAwareNavigationGroups("seller", false, seller)
    .flatMap((group) => group.items)
    .map((item) => item.href);
  const collectorHrefs = getAccountAwareNavigationGroups("collector", false, collector)
    .flatMap((group) => group.items)
    .map((item) => item.href);

  assert.ok(sellerHrefs.includes("/dashboard/marketing"));
  assert.ok(sellerHrefs.includes("/dashboard/marketing/audiences"));
  assert.equal(collectorHrefs.includes("/dashboard/marketing"), false);
  assert.equal(hasRouteAccess(seller, "/dashboard/marketing"), true);
  assert.equal(hasRouteAccess(collector, "/dashboard/marketing"), false);
  assert.equal(hasRouteAccess(owner, "/dashboard/marketing/templates"), true);
});

test("marketing APIs are classified and private routes require crm.manage", () => {
  assert.equal(apiAccessRuleForPath("/api/marketing/audience")?.capability, "crm.manage");
  assert.equal(apiAccessRuleForPath("/api/marketing/send")?.capability, "crm.manage");
  assert.equal(apiAccessRuleForPath("/api/marketing/unsubscribe/token")?.kind, "public");

  for (const route of [
    "src/app/api/marketing/audience/route.ts",
    "src/app/api/marketing/send/route.ts",
    "src/app/api/marketing/send-test/route.ts",
  ]) {
    const source = readFileSync(path.join(repoRoot, route), "utf8");
    assert.match(source, /requireApiCapability\("crm\.manage"\)/, route);
  }
});

test("marketing migration proposal includes idempotency tokens suppression and RLS", () => {
  const migration = readFileSync(
    path.join(repoRoot, "supabase/migrations/202608270001_crm_marketing_campaigns_proposal.sql"),
    "utf8",
  );

  assert.match(migration, /add column if not exists marketing_status/);
  assert.match(migration, /create table if not exists public\.marketing_campaigns/);
  assert.match(migration, /create table if not exists public\.marketing_campaign_recipients/);
  assert.match(migration, /unsubscribe_token_hash/);
  assert.match(migration, /create table if not exists public\.marketing_suppressions/);
  assert.match(migration, /create table if not exists public\.marketing_send_jobs/);
  assert.match(migration, /unique \(workspace_id, idempotency_key\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
  assert.doesNotMatch(migration, /drop table|truncate table|delete from public\.crm_customers/i);
});

test("marketing provider abstraction keeps provider secrets out of browser component", () => {
  const provider = readFileSync(path.join(repoRoot, "src/lib/marketing/email-provider.ts"), "utf8");
  const workspace = readFileSync(
    path.join(repoRoot, "src/components/dashboard/marketing/MarketingCampaignWorkspace.tsx"),
    "utf8",
  );

  assert.match(provider, /MarketingEmailProvider/);
  assert.match(provider, /provider_not_configured/);
  assert.doesNotMatch(workspace, /process\.env|SERVICE_ROLE|API_KEY|SECRET/);
});

test("public unsubscribe route hashes tokens before lookup", () => {
  const route = readFileSync(
    path.join(repoRoot, "src/app/api/marketing/unsubscribe/[token]/route.ts"),
    "utf8",
  );

  assert.match(route, /createHash\("sha256"\)\.update\(normalizedToken\)\.digest\("hex"\)/);
  assert.match(route, /\.eq\("unsubscribe_token_hash", tokenHash\)/);
  assert.doesNotMatch(route, /\.eq\("unsubscribe_token", normalizedToken\)/);
});
