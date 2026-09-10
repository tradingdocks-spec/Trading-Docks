import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync("supabase/migrations/202609090003_showcase_operations.sql", "utf8");
const foundation = readFileSync("supabase/migrations/202609090001_showcase_v1.sql", "utf8");
const kioskRoute = readFileSync("src/app/api/showcase/kiosk/route.ts", "utf8");
const requestRoute = readFileSync("src/app/api/showcase/requests/route.ts", "utf8");
const pairRoute = readFileSync("src/app/api/showcase/kiosks/pair/route.ts", "utf8");
const ownerKioskRoute = readFileSync("src/app/api/showcase/kiosks/route.ts", "utf8");
const kioskManagementPage = readFileSync("src/app/dashboard/showcase/kiosks/page.tsx", "utf8");

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
  assert.match(ownerKioskRoute, /createHash\("sha256"\)/);
  assert.match(ownerKioskRoute, /expiresAt/);
  assert.match(ownerKioskRoute, /workspace admin access required/i);
  assert.match(ownerKioskRoute, /pairingCode/);
  assert.match(ownerKioskRoute, /PAIRING_CODE_CREATE_FAILED/);
  assert.match(ownerKioskRoute, /PGRST205/);
  assert.match(ownerKioskRoute, /showcase_kiosk_pairing_codes/);
  assert.match(ownerKioskRoute, /create_pairing_code/);
  assert.match(pairRoute, /action !== "consume"/);
});

test("owner kiosk navigation resolves to the existing Showcase management component", () => {
  assert.match(kioskManagementPage, /KioskManagement/);
  assert.match(kioskManagementPage, /showcase_kiosk_devices/);
  assert.doesNotMatch(kioskManagementPage, /\/dashboard\/kiosk/);
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
  assert.notEqual(routeAccessRuleForPath("/dashboard/showcase")?.id, "dashboard-fallback");
  assert.notEqual(apiAccessRuleForPath("/api/showcase/kiosks/pair")?.id, "api-fallback");
});
