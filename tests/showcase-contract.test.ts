import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync("supabase/migrations/202609090003_showcase_operations.sql", "utf8");
const pairingFixMigration = readFileSync("supabase/migrations/202609100001_showcase_kiosk_pairing_consume_fix.sql", "utf8");
const foundation = readFileSync("supabase/migrations/202609090001_showcase_v1.sql", "utf8");
const kioskRoute = readFileSync("src/app/api/showcase/kiosk/route.ts", "utf8");
const requestRoute = readFileSync("src/app/api/showcase/requests/route.ts", "utf8");
const pairRoute = readFileSync("src/app/api/showcase/kiosks/pair/route.ts", "utf8");
const pairingLib = readFileSync("src/lib/showcase-pairing.ts", "utf8");
const ownerKioskRoute = readFileSync("src/app/api/showcase/kiosks/route.ts", "utf8");
const kioskManagementPage = readFileSync("src/app/dashboard/showcase/kiosks/page.tsx", "utf8");
const settingsRoute = readFileSync("src/app/api/showcase/settings/route.ts", "utf8");
const settingsComponent = readFileSync("src/components/dashboard/showcase/ShowcaseSettings.tsx", "utf8");
const dashboardComponent = readFileSync("src/components/dashboard/showcase/ShowcaseDashboard.tsx", "utf8");

test("Showcase public projection omits private inventory fields", () => {
  assert.match(foundation, /get_public_showcase_inventory/);
  assert.match(foundation, /data->>'private'/);
  assert.doesNotMatch(foundation.slice(foundation.indexOf("returns table"), foundation.indexOf("language sql")), /costBasis|inventory_value|location_id|user_id/);
});

test("Showcase operations have durable picking and reservation state", () => {
  assert.match(migration, /picked_quantity integer not null default 0/);
  assert.match(migration, /showcase_inventory_reservations/);
  assert.match(migration, /Every requested quantity must be picked/);
  assert.match(migration, /status = 'consumed'/);
});

test("kiosk context is revocable and workspace-scoped", () => {
  assert.match(migration, /get_kiosk_context/);
  assert.match(migration, /d\.enabled and d\.revoked_at is null/);
  assert.match(migration, /p\.enabled and p\.kiosk_enabled/);
});


test("kiosk requests use the validated kiosk tenant and never expose dashboard access", () => {
  assert.match(kioskRoute, /getValidatedKioskContext/);
  assert.match(requestRoute, /const slug = kiosk\?\.showcase_slug \?\? body\.slug/);
  assert.match(requestRoute, /source: "kiosk"/);
  assert.match(pairRoute, /httpOnly: true/);
  assert.doesNotMatch(kioskRoute, /dashboard|admin/i);
});

test("owner pairing generation is secure and separate from public consumption", () => {
  assert.match(ownerKioskRoute, /randomInt\(100000, 1000000\)/);
  assert.match(pairingLib, /createHash\("sha256"\)/);
  assert.match(ownerKioskRoute, /expiresAt/);
  assert.match(ownerKioskRoute, /workspace admin access required/i);
  assert.match(ownerKioskRoute, /pairingCode/);
  assert.match(ownerKioskRoute, /PAIRING_CODE_CREATE_FAILED/);
  assert.match(ownerKioskRoute, /PGRST205/);
  assert.match(ownerKioskRoute, /showcase_kiosk_pairing_codes/);
  assert.match(ownerKioskRoute, /create_pairing_code/);
  assert.match(pairRoute, /action !== "consume"/);
});

test("pairing generation and consumption share formatted six-digit normalization", () => {
  assert.match(pairingLib, /replace\(\/\[\^0-9\]\/g, ""\)/);
  assert.match(pairingLib, /update\(normalizeShowcasePairingCode\(value\), "utf8"\)/);
  assert.match(pairRoute, /normalizedCode/);
  assert.match(migration, /extensions\.digest/);
  assert.match(migration, /convert_to/);
  assert.match(pairingFixMigration, /P0003/);
  assert.match(pairingFixMigration, /P0004/);
  assert.match(pairRoute, /PAIRING_CODE_ALREADY_USED/);
});

test("owner kiosk navigation resolves to the existing Showcase management component", () => {
  assert.match(kioskManagementPage, /KioskManagement/);
  assert.match(kioskManagementPage, /showcase_kiosk_devices/);
  assert.doesNotMatch(kioskManagementPage, /\/dashboard\/kiosk/);
});

test("Showcase onboarding creates and edits one workspace profile", () => {
  assert.match(settingsRoute, /upsert/);
  assert.match(settingsRoute, /onConflict: "workspace_id"/);
  assert.match(settingsRoute, /Display name is required/);
  assert.match(settingsRoute, /already in use/);
  assert.match(settingsComponent, /Create Showcase/);
  assert.match(settingsComponent, /Save changes/);
  assert.match(settingsComponent, /showcaseSlugError/);
});

test("Showcase checklist uses persisted profile and paired-device state", () => {
  assert.match(dashboardComponent, /pairedKioskCount > 0/);
  assert.match(dashboardComponent, /\/dashboard\/showcase\/settings/);
  assert.match(kioskManagementPage, /Create Showcase Profile/);
  assert.match(kioskManagementPage, /\/dashboard\/showcase\/settings/);
});

test("reservation lifecycle is guarded and idempotent", () => {
  assert.match(migration, /status = 'active'/);
  assert.match(migration, /status = 'released'/);
  assert.match(migration, /status = 'consumed'/);
  assert.match(migration, /where request_item_id = line\.id and status = 'active'/);
  assert.match(migration, /r\.status = 'ready' and next_status = 'completed'/);
});
test("Showcase routes are registered with explicit access rules", async () => {
  const { routeAccessRuleForPath } = await import("../src/lib/platform/route-access.ts");
  const { apiAccessRuleForPath } = await import("../src/lib/platform/api-access.ts");
  const { apiRequiresAuthentication } = await import("../src/lib/supabase/proxy-routing.ts");
  assert.notEqual(routeAccessRuleForPath("/dashboard/showcase")?.id, "dashboard-fallback");
  assert.notEqual(apiAccessRuleForPath("/api/showcase/kiosks/pair")?.id, "api-fallback");
  assert.equal(apiRequiresAuthentication("/api/showcase/kiosks/pair"), false);
  assert.equal(apiRequiresAuthentication("/api/showcase/kiosk"), false);
});
