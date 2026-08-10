import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeTradingDocksUrl,
  shouldRedirectToCanonicalHost,
} from "../src/lib/supabase/canonical-host.ts";

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
