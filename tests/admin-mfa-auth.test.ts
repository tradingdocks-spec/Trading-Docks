import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("admin MFA enrollment uses the canonical server-cookie authentication path", () => {
  const actionSource = source("src/app/actions/admin-mfa.ts");

  assert.match(actionSource, /"use server"/);
  assert.match(actionSource, /resolveCurrentPlatformAccess/);
  assert.match(actionSource, /hasCapability\(context\.access,\s*"platform\.admin"\)/);
  assert.match(actionSource, /context\.supabase\.auth\.mfa\.enroll/);
  assert.match(actionSource, /context\.supabase\.auth\.mfa\.challengeAndVerify/);
  assert.match(actionSource, /context\.supabase\.auth\.mfa\.getAuthenticatorAssuranceLevel/);
  assert.match(actionSource, /context\.supabase\.auth\.mfa\.listFactors/);
});

test("signed-out and ordinary users cannot start owner authenticator enrollment", () => {
  const actionSource = source("src/app/actions/admin-mfa.ts");

  assert.match(actionSource, /if \(!context\.user\)/);
  assert.match(actionSource, /status:\s*401/);
  assert.match(actionSource, /Sign in before managing admin authenticator settings/);
  assert.match(actionSource, /status:\s*403/);
  assert.match(actionSource, /platform administrator access/);
});

test("admin MFA UI no longer calls Supabase MFA endpoints from the browser client", () => {
  for (const relativePath of [
    "src/components/dashboard/admin/AdminControlCenterWithPreview.tsx",
    "src/components/dashboard/admin/AdminControlCenter.tsx",
  ]) {
    const componentSource = source(relativePath);

    assert.match(componentSource, /beginAdminTotpEnrollment/);
    assert.match(componentSource, /loadAdminMfaSecurityState/);
    assert.match(componentSource, /verifyAdminTotpFactor/);
    assert.match(componentSource, /Set up a replacement authenticator/);
    assert.doesNotMatch(componentSource, /supabase\.auth\.mfa\.enroll/);
    assert.doesNotMatch(componentSource, /supabase\.auth\.mfa\.challengeAndVerify/);
    assert.doesNotMatch(componentSource, /supabase\.auth\.mfa\.listFactors/);
    assert.doesNotMatch(componentSource, /supabase\.auth\.mfa\.getAuthenticatorAssuranceLevel/);
  }
});

test("raw Supabase Bearer-token MFA errors are replaced with a safe session message", () => {
  const actionSource = source("src/app/actions/admin-mfa.ts");

  assert.match(actionSource, /valid bearer token/i);
  assert.match(actionSource, /Your secure admin session could not be verified/);
  assert.match(actionSource, /\/valid bearer token\/i\.test\(message\)/);
});
