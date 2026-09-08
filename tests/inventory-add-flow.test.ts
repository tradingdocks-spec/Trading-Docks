import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("Inventory + Add opens an intake chooser instead of Purchasing Intelligence", () => {
  const workspace = source("src/components/dashboard/collector-workspace/CollectorWorkspace.tsx");

  assert.match(workspace, /aria-haspopup="menu"/);
  assert.match(workspace, /Add inventory/);
  assert.match(workspace, /Upload CSV/);
  assert.match(workspace, /href="\/dashboard\/inventory\/import"/);
  assert.match(workspace, /href="\/dashboard\/card-photo-scanner"/);
  assert.doesNotMatch(workspace, /<Link href="\/dashboard\/card-photo-scanner" className="td-button-primary[\s\S]*Add<\/Link>/);
  assert.doesNotMatch(workspace, /href="\/dashboard\/purchasing-intelligence\?action=add-inventory"/);
});

test("Inventory CSV import route defaults to inventory review and accepts preselected storage", () => {
  const page = source("src/app/dashboard/inventory/import/page.tsx");
  const workspace = source("src/components/dashboard/collector-workspace/InventoryImportWorkspace.tsx");
  const csv = source("src/components/dashboard/tools/CsvConversionEngine.tsx");

  assert.match(page, /searchParams: Promise<\{ locationId\?: string; locationName\?: string \}>/);
  assert.match(page, /initialLocationId=\{params\.locationId \?\? ""\}/);
  assert.match(page, /initialLocationName=\{params\.locationName \?\? "Unassigned"\}/);
  assert.match(workspace, /initialDestination="inventory"/);
  assert.match(workspace, /initialLocationId=\{initialLocationId\}/);
  assert.match(workspace, /initialLocationName=\{initialLocationName \|\| "Unassigned"\}/);
  assert.match(csv, /initialDestination = "download"/);
  assert.match(csv, /useState<"download" \| "inventory">\(initialDestination\)/);
  assert.match(csv, /loadWebStorageLocationManager/);
  assert.match(csv, /<option value="__unassigned__">Unassigned<\/option>/);
  assert.match(csv, /location\.path\.label/);
  assert.match(csv, /if \(locationId && !selectedLocation\) return setNotice\("Choose one of your active storage locations or use Unassigned\."\)/);
});

test("Storage location import preselects the active location without immediate mutation", () => {
  const storage = source("src/components/dashboard/collector-workspace/StorageLocationManager.tsx");
  const csv = source("src/components/dashboard/tools/CsvConversionEngine.tsx");

  assert.match(storage, /Import CSV here/);
  assert.match(storage, /\/dashboard\/inventory\/import\?locationId=/);
  assert.match(storage, /location\.path\.label/);
  assert.match(csv, /function loadCsv/);
  assert.match(csv, /setNotice\(`\$\{nextRows\.length\.toLocaleString\(\)\} rows loaded\. Review the field mapping below\.`\)/);
  assert.match(csv, /async function saveToInventory/);
});

test("CSV import can create a storage destination without losing review state", () => {
  const csv = source("src/components/dashboard/tools/CsvConversionEngine.tsx");

  assert.match(csv, /Create location/);
  assert.match(csv, /createWebStorageLocation/);
  assert.match(csv, /parentId: newLocationParentId \|\| null/);
  assert.match(csv, /await refreshLocations\(result\.id\)/);
  assert.match(csv, /setRows\(nextRows\)/);
  assert.doesNotMatch(csv, /window\.location/);
});

test("bulk inventory removal is one server request with confirmation copy", () => {
  const workspace = source("src/components/dashboard/collector-workspace/CollectorWorkspace.tsx");
  const route = source("src/app/api/collector-workspace/bulk-remove/route.ts");

  assert.match(workspace, /Remove from collection/);
  assert.match(workspace, /\/api\/collector-workspace\/bulk-remove/);
  assert.match(workspace, /selectedQuantity/);
  assert.match(workspace, /Acquisition and history records are preserved/);
  assert.match(workspace, /quantity_removed/);
  assert.match(route, /requireApiCapability\("collection\.write"\)/);
  assert.match(route, /\.eq\("user_id", user\.id\)/);
  assert.match(route, /rows\.length !== ids\.length/);
  assert.match(route, /\.rpc\("remove_inventory_lot_quantity"/);
  assert.match(route, /MAX_BULK_REMOVE_ROWS = 1000/);
});

test("inventory workspace hides ledger rows after their quantity reaches zero", () => {
  const clientData = source("src/lib/collector-workspace-client-data.ts");
  const inventoryPersistence = source("src/lib/inventory-persistence.ts");
  const batchPage = source("src/app/dashboard/inventory/batches/[batchId]/page.tsx");

  assert.match(clientData, /let next = query\.gt\("quantity", 0\)/);
  assert.match(inventoryPersistence, /collection !== "items" \|\| Number\(record\.quantity \?\? 0\) > 0/);
  assert.match(inventoryPersistence, /\.gt\("quantity", 0\)/);
  assert.match(batchPage, /\.gt\("quantity", 0\)/);
});

test("bulk inventory removal dialog is fixed in the viewport center", () => {
  const workspace = source("src/components/dashboard/collector-workspace/CollectorWorkspace.tsx");

  assert.match(workspace, /createPortal/);
  assert.match(workspace, /document\.body/);
  assert.match(workspace, /fixed inset-0/);
  assert.match(workspace, /items-center justify-center/);
  assert.match(workspace, /max-h-\[calc\(100dvh-32px\)\]/);
  assert.match(workspace, /overflow-y-auto/);
  assert.doesNotMatch(workspace, /pt-\[12vh\]/);
  assert.doesNotMatch(workspace, /grid place-items-center bg-black\/60 p-4/);
});

test("Purchasing Intelligence remains an Acquire navigation surface", () => {
  const navigation = source("src/components/dashboard/navigation.ts");
  const routeAccess = source("src/lib/platform/route-access.ts");

  assert.match(navigation, /href: "\/dashboard\/purchasing-intelligence"/);
  assert.match(routeAccess, /purchasing-intelligence/);
});
