// Reproduces the snapshot alias used by CsvConversionEngine.saveToInventory.
// Executes the real persistence helper with an in-memory database double.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

const writes = [];
const supabase = {
  auth: { getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }) },
  from: table => ({ upsert: async rows => { writes.push({ table, rows }); return { error: null }; } }),
};
const exports = {};
const source = fs.readFileSync('src/lib/inventory-persistence.ts', 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports,
  require(name) {
    if (name === '@/lib/supabase/client') return { createClient: () => supabase };
    throw new Error(`Unexpected dependency: ${name}`);
  },
});
const currentSnapshot = { locations: [], items: [], movements: [] };
// Same reference assignment and push as the actual CSV caller, lines 442 and 457.
const locations = currentSnapshot.locations;
locations.push({ id: 'location-a', name: 'CSV box', type: 'custom', itemCount: 1 });
await exports.persistInventorySnapshotDiff(currentSnapshot, {
  locations,
  items: [{ id: 'item-a', name: 'Test card', quantity: 1, locationId: 'location-a' }],
  movements: [],
});
assert.ok(writes.some(entry => entry.table === 'inventory_items'));
assert.equal(writes.some(entry => entry.table === 'inventory_locations'), false);
console.log(JSON.stringify({ reproduced: true, writtenTables: writes.map(entry => entry.table), locationWriteOmitted: true, expected: 'Persist location before referencing it from inventory', limitation: 'Real persistence helper, modeled CSV caller, in-memory database; production constraints not exercised' }, null, 2));
