import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeTradingDocksUrl,
  shouldRedirectToCanonicalHost,
} from "../src/lib/supabase/canonical-host.ts";
import {
  hasSupabasePublicConfig,
  routeNeedsSessionLookup,
} from "../src/lib/supabase/proxy-routing.ts";

const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;

async function withVercelEnv<T>(
  value: string | undefined,
  callback: () => T | Promise<T>,
): Promise<T> {
  if (value === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = value;
  }

  try {
    return await callback();
  } finally {
    if (ORIGINAL_VERCEL_ENV === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV;
    }
  }
}

test("production canonical host is not redirected", () => {
  return withVercelEnv("production", () => {
    assert.equal(shouldRedirectToCanonicalHost("www.tradingdocks.com"), false);
  });
});

test("production alias redirects to the canonical Trading Docks host", async () => {
  await withVercelEnv("production", async () => {
    assert.equal(
      shouldRedirectToCanonicalHost("tradingdocks.com"),
      true,
    );
    assert.equal(
      canonicalizeTradingDocksUrl(
        new URL("https://tradingdocks.com/dashboard/label-studio"),
      ).toString(),
      "https://www.tradingdocks.com/dashboard/label-studio",
    );
  });
});

test("Vercel preview deployment host is not canonicalized", () => {
  return withVercelEnv("preview", () => {
    assert.equal(
      shouldRedirectToCanonicalHost("trading-docks-346a.vercel.app"),
      false,
    );
  });
});

test("Vercel branch preview host is not canonicalized", () => {
  return withVercelEnv("preview", () => {
    assert.equal(
      shouldRedirectToCanonicalHost(
        "trading-docks-git-codex-trading-docks-os-ultimate-polish.vercel.app",
      ),
      false,
    );
  });
});

test("Vercel development deployment is not canonicalized", () => {
  return withVercelEnv("development", () => {
    assert.equal(
      shouldRedirectToCanonicalHost("trading-docks-development.vercel.app"),
      false,
    );
  });
});

test("local development is not canonicalized", () => {
  return withVercelEnv(undefined, () => {
    assert.equal(shouldRedirectToCanonicalHost("localhost"), false);
    assert.equal(shouldRedirectToCanonicalHost("127.0.0.1"), false);
  });
});

test("public routes that do not need auth skip Supabase session lookup", () => {
  assert.equal(routeNeedsSessionLookup("/pricing"), false);
  assert.equal(routeNeedsSessionLookup("/privacy"), false);
  assert.equal(routeNeedsSessionLookup("/security"), false);
  assert.equal(routeNeedsSessionLookup("/api/market-cards"), false);
  assert.equal(routeNeedsSessionLookup("/api/landing-card-image/mid/82"), false);
});

test("session-sensitive and protected routes still require Supabase lookup", () => {
  assert.equal(routeNeedsSessionLookup("/"), true);
  assert.equal(routeNeedsSessionLookup("/sign-in"), true);
  assert.equal(routeNeedsSessionLookup("/sign-up"), true);
  assert.equal(routeNeedsSessionLookup("/dashboard"), true);
  assert.equal(routeNeedsSessionLookup("/dashboard/orders"), true);
  assert.equal(routeNeedsSessionLookup("/onboarding"), true);
  assert.equal(routeNeedsSessionLookup("/api/admin/users"), true);
  assert.equal(routeNeedsSessionLookup("/api/orders/bulk"), true);
});

test("Supabase public config requires both URL and publishable key", () => {
  assert.equal(
    hasSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_placeholder",
    } as NodeJS.ProcessEnv),
    true,
  );
  assert.equal(
    hasSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    } as NodeJS.ProcessEnv),
    false,
  );
  assert.equal(
    hasSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_placeholder",
    } as NodeJS.ProcessEnv),
    false,
  );
});
