import test from "node:test";
import assert from "node:assert/strict";
import { squareRuntimeAllowed, POS_STAGING_DATABASE, POS_STAGING_ORIGIN } from "../src/lib/pos/payments/square/runtime.ts";
import { apiRequiresAuthentication } from "../src/lib/supabase/proxy-routing.ts";

const staging = {
  VERCEL: "1", VERCEL_ENV: "preview",
  VERCEL_PROJECT_ID: "prj_cthg5hX2ehylcwdnPMPw5ASyfRZX",
  VERCEL_GIT_COMMIT_REF: "codex/pos-foundation",
  POS_SQUARE_SANDBOX_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: POS_STAGING_DATABASE,
  SQUARE_ENVIRONMENT: "SANDBOX", SQUARE_APPLICATION_ID: "sandbox-fixture",
  SQUARE_OAUTH_REDIRECT_URL: `${POS_STAGING_ORIGIN}/api/pos/payments/square/callback`,
  SQUARE_WEBHOOK_NOTIFICATION_URL: `${POS_STAGING_ORIGIN}/api/payments/webhooks/square`,
};
test("Square permits the isolated Preview build and fails closed for every missing prerequisite", () => {
  assert.equal(squareRuntimeAllowed("production", staging), true);
  for (const key of Object.keys(staging)) {
    assert.equal(squareRuntimeAllowed("production", { ...staging, [key]: undefined }), false, key);
  }
  for (const changed of [
    { VERCEL_ENV: "production" }, { VERCEL_PROJECT_ID: "other" },
    { VERCEL_GIT_COMMIT_REF: "main" }, { POS_SQUARE_SANDBOX_ENABLED: "false" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://bohddnajlnmknngzjsjk.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: `${POS_STAGING_DATABASE}.evil.example` },
    { SQUARE_ENVIRONMENT: "PRODUCTION" }, { SQUARE_APPLICATION_ID: "production" },
    { SQUARE_OAUTH_REDIRECT_URL: "https://www.tradingdocks.com/api/pos/payments/square/callback" },
    { SQUARE_WEBHOOK_NOTIFICATION_URL: `${staging.SQUARE_WEBHOOK_NOTIFICATION_URL}?bypass=secret` },
  ]) assert.equal(squareRuntimeAllowed("production", { ...staging, ...changed }), false);
  assert.equal(squareRuntimeAllowed("production", {}), false);
  assert.equal(squareRuntimeAllowed("test", { ...staging, VERCEL_ENV: "production" }), false);
  assert.equal(squareRuntimeAllowed("test", staging), false);
  assert.equal(squareRuntimeAllowed("development", {}), true);
  assert.equal(squareRuntimeAllowed("test", {}), true);
});
test("only the exact Square webhook bypasses user-session authentication", () => {
  assert.equal(apiRequiresAuthentication("/api/payments/webhooks/square"), false);
  for (const path of ["/api/payments/webhooks/square/extra", "/api/payments/webhooks/square-spoof", "/api/pos/payments", "/api/pos/payments/square/callback"])
    assert.equal(apiRequiresAuthentication(path), true, path);
});
