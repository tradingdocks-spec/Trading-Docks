import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createResendProvider, getMarketingEmailReadiness, verifyResendWebhook } from "../src/lib/marketing/email-delivery.ts";

const settings = { email_provider: "resend", from_name: "Trading Docks", from_email: "ops@example.com", reply_to: "reply@example.com", business_name: "Trading Docks", business_address: "1 Dock Way", unsubscribe_base_url: "https://example.com/unsubscribe" };

test("real delivery readiness is blocked by default and requires every control", () => {
  const blocked = getMarketingEmailReadiness(settings, { MARKETING_EMAIL_PROVIDER: "resend", MARKETING_EMAIL_API_KEY: "key", VERCEL_ENV: "preview", MARKETING_REAL_SEND_ENABLED: "true" });
  assert.equal(blocked.ready, false);
  assert.match(blocked.blockers.join(" "), /environment/);
  const ready = getMarketingEmailReadiness(settings, { MARKETING_EMAIL_PROVIDER: "resend", MARKETING_EMAIL_API_KEY: "key", VERCEL_ENV: "production", MARKETING_REAL_SEND_ENABLED: "true" });
  assert.equal(ready.ready, true);
  assert.match(getMarketingEmailReadiness({ ...settings, business_address: "" }, { MARKETING_EMAIL_PROVIDER: "resend", MARKETING_EMAIL_API_KEY: "key", VERCEL_ENV: "production", MARKETING_REAL_SEND_ENABLED: "true" }).blockers.join(" "), /physical address/);
  assert.match(getMarketingEmailReadiness({ ...settings, unsubscribe_base_url: "" }, { MARKETING_EMAIL_PROVIDER: "resend", MARKETING_EMAIL_API_KEY: "key", VERCEL_ENV: "production", MARKETING_REAL_SEND_ENABLED: "true" }).blockers.join(" "), /unsubscribe/);
  assert.match(getMarketingEmailReadiness(settings, { MARKETING_EMAIL_PROVIDER: "resend", VERCEL_ENV: "production", MARKETING_REAL_SEND_ENABLED: "true" }).blockers.join(" "), /API configuration/);
});

test("Resend adapter is injectable and sends only through the provider endpoint", async () => {
  let calls = 0;
  const provider = createResendProvider({ MARKETING_EMAIL_API_KEY: "secret" }, async (url, init) => { calls += 1; assert.equal(url, "https://api.resend.com/emails"); assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer secret"); return new Response(JSON.stringify({ id: "re_123" }), { status: 200 }); });
  const result = await provider.send({ idempotencyKey: "real:draft:v1", recipient: "store@example.com", subject: "Subject", previewText: "Preview", bodyHtml: "<p>Body</p>", bodyText: "Body", from: "Trading Docks <ops@example.com>", replyTo: "reply@example.com" });
  assert.equal(result.providerMessageId, "re_123");
  assert.equal(calls, 1);
});

test("Resend webhook signatures are verified and normalized", () => {
  const secret = `whsec_${Buffer.from("webhook-secret").toString("base64")}`;
  const body = JSON.stringify({ type: "email.delivered", created_at: "2026-09-19T03:00:00.000Z", data: { email_id: "re_123" } });
  const id = "evt_123"; const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", Buffer.from("webhook-secret")).update(`${id}.${timestamp}.${body}`).digest("base64");
  const headers = new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` });
  assert.equal(verifyResendWebhook(body, headers, secret)?.type, "delivered");
  assert.equal(verifyResendWebhook(body, new Headers({ ...Object.fromEntries(headers.entries()), "svix-signature": "v1,invalid" }), secret), null);
});

test("delivery routes preserve admin send safety and never persist provider secrets", () => {
  const route = readFileSync(path.join(process.cwd(), "src/app/api/admin/marketing/outreach/route.ts"), "utf8");
  const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260919031004_marketing_email_delivery.sql"), "utf8");
  assert.match(route, /context\.draft\.status !== "approved"/);
  assert.match(route, /context\.readiness\.ready/);
  assert.match(route, /window\.confirm|real_send/);
  assert.doesNotMatch(migration, /api[_-]?key|webhook[_-]?secret/i);
  const webhook = readFileSync(path.join(process.cwd(), "src/app/api/marketing/webhooks/resend/route.ts"), "utf8");
  assert.match(webhook, /verifyResendWebhook/);
  assert.match(webhook, /hard_bounce|complaint|unsubscribe/);
  assert.match(webhook, /marketing_email_webhook_events/);
});
