import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_AUTH_COOKIE_OPTIONS,
  persistentAuthCookieOptions,
} from "../src/lib/supabase/auth-cookie-policy.ts";

const repoRoot = process.cwd();

test("Supabase auth cookies are host-only and available across the application", () => {
  const persistent = persistentAuthCookieOptions({}, true);
  const sessionOnly = persistentAuthCookieOptions({}, false);
  const removal = persistentAuthCookieOptions({ maxAge: 0 }, true);

  for (const options of [DEFAULT_AUTH_COOKIE_OPTIONS, persistent, sessionOnly, removal]) {
    assert.equal(options.path, "/");
    assert.equal(options.sameSite, "lax");
    assert.equal(options.domain, undefined, "host-only cookies must work on Vercel previews and localhost");
  }
  assert.ok(Number(persistent.maxAge) > 0);
  assert.equal(sessionOnly.maxAge, undefined);
  assert.equal(removal.maxAge, 0);
});

test("the browser uses one persistent auto-refreshing Supabase client", () => {
  const source = readFileSync(path.join(repoRoot, "src/lib/supabase/client.ts"), "utf8");
  assert.match(source, /let browserClient/);
  assert.match(source, /if \(browserClient\) return browserClient/);
  assert.match(source, /persistSession: true/);
  assert.match(source, /autoRefreshToken: true/);
  assert.doesNotMatch(source, /signOut\(/);
});

test("the proxy propagates refreshed cookies to both the request and actual response", () => {
  const source = readFileSync(path.join(repoRoot, "src/lib/supabase/proxy.ts"), "utf8");
  assert.match(source, /getAll\(\)\s*\{\s*return request\.cookies\.getAll\(\)/s);
  assert.match(source, /request\.cookies\.set\(name, value\)/);
  assert.match(source, /response\.cookies\.set\(name, value, options\)/);
  assert.match(source, /redirectWithSessionCookies\(url, pendingCookies\)/);
  assert.match(source, /await supabase\.auth\.getUser\(\)/);
});

test("dashboard navigation contracts contain only same-origin application paths", () => {
  const files = [
    "src/components/dashboard/navigation.ts",
    "src/components/dashboard-v2/navigation.ts",
    "src/lib/navigation/contract.ts",
  ];
  for (const file of files) {
    const source = readFileSync(path.join(repoRoot, file), "utf8");
    assert.doesNotMatch(source, /https?:\/\/[^\s"']+\/dashboard/);
    for (const match of source.matchAll(/href:\s*["']([^"']+)["']/g)) {
      assert.ok(match[1].startsWith("/"), `${file} has a non-relative internal href: ${match[1]}`);
    }
  }
});

test("dashboard layout does not clear auth while mounting", () => {
  const source = readFileSync(path.join(repoRoot, "src/app/dashboard/layout.tsx"), "utf8");
  assert.match(source, /await supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(source, /signOut\(/);
  assert.doesNotMatch(source, /SIGNED_OUT/);
});
