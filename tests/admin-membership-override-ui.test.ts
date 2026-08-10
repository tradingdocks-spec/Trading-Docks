import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("web admin plan control writes canonical manual membership overrides", () => {
  const route = readFileSync(path.join(repoRoot, "src/app/api/admin/users/route.ts"), "utf8");
  const control = readFileSync(path.join(repoRoot, "src/components/dashboard/admin/AdminControlCenterWithPreview.tsx"), "utf8");

  assert.match(route, /requireServerPlatformRole\("admin"\)/);
  assert.match(route, /admin_membership_overrides/);
  assert.match(route, /action: "user\.plan\.changed"/);
  assert.doesNotMatch(route, /stripe/i);
  assert.doesNotMatch(route, /revenuecat/i);

  assert.match(control, /fetch\("\/api\/admin\/users"/);
  assert.match(control, /currentManualPlan === plan/);
  assert.doesNotMatch(control, /plan === selected\.membership_level/);
  assert.match(control, /membership_override: payload\.action === "plan" \? plan/);
});
