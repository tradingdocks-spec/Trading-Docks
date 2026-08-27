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
  assert.match(csv, /let location = locations\.find\(\(item\) => locationId && item\.id === locationId\)/);
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

test("Purchasing Intelligence remains an Acquire navigation surface", () => {
  const navigation = source("src/components/dashboard/navigation.ts");
  const routeAccess = source("src/lib/platform/route-access.ts");

  assert.match(navigation, /href: "\/dashboard\/purchasing-intelligence"/);
  assert.match(routeAccess, /purchasing-intelligence/);
});
