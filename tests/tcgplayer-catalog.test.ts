import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  advanceTcgplayerMagicStorageImport,
  importTcgplayerMagicCatalogCsv,
  mapTcgplayerMagicCsvRow,
  normalizeCollectorNumber,
  normalizeConditionFinish,
  resolveTcgplayerVariant,
  startTcgplayerMagicStorageImport,
  validateTcgplayerMagicHeaders,
  type TcgplayerMagicCatalogRecord,
  type TcgplayerMagicCsvHeader,
} from "../src/lib/tcgplayer-catalog/index.ts";
import {
  hasCapability,
  resolvePlatformAccessContext,
} from "../mobile/services/platform-access.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV_HEADER = [
  "TCGplayer Id",
  "Product Line",
  "Set Name",
  "Product Name",
  "Title",
  "Number",
  "Rarity",
  "Condition",
  "TCG Market Price",
  "TCG Direct Low",
  "TCG Low Price With Shipping",
  "TCG Low Price",
  "Total Quantity",
  "Add to Quantity",
  "TCG Marketplace Price",
  "Photo URL",
].join(",");

function csv(rows: string[][]) {
  return [CSV_HEADER, ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
}

test("TCGplayer Magic CSV header validation requires the canonical export columns", () => {
  assert.equal(validateTcgplayerMagicHeaders(CSV_HEADER.split(",")).ok, true);
  const invalid = validateTcgplayerMagicHeaders(["TCGplayer Id", "Product Name"]);
  assert.equal(invalid.ok, false);
  assert.ok(invalid.missing.includes("Product Line"));
  assert.ok(invalid.missing.includes("Condition"));
});

test("condition and foil normalization preserves raw source condition", () => {
  const foil = normalizeConditionFinish("Near Mint Foil");
  assert.deepEqual(foil, {
    rawCondition: "Near Mint Foil",
    condition: "Near Mint",
    finish: "Foil",
    normalizedCondition: "near mint",
    normalizedFinish: "foil",
  });

  const nonfoil = normalizeConditionFinish("Lightly Played");
  assert.equal(nonfoil.condition, "Lightly Played");
  assert.equal(nonfoil.finish, "Normal");
  assert.equal(normalizeConditionFinish("Unopened").finish, "Unopened");
});

test("collector-number normalization handles spacing case and punctuation safely", () => {
  assert.equal(normalizeCollectorNumber(" 082 A "), "082a");
  assert.equal(normalizeCollectorNumber("12-★"), "12-★");
  assert.equal(normalizeCollectorNumber(""), null);
});

test("catalog rows map condition-specific variants and null prices", () => {
  const row = rowObject([
    "12345",
    "Magic",
    "Innistrad: Midnight Hunt",
    "Unblinking Observer",
    "Unblinking Observer",
    "82",
    "Common",
    "Near Mint Foil",
    "",
    "0.20",
    "",
    "0.13",
    "10",
    "",
    "0.22",
    "https://example.test/card.jpg",
  ]);
  const mapped = mapTcgplayerMagicCsvRow(row, { rowNumber: 2, importedAt: "2026-08-10T00:00:00.000Z" });

  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  assert.equal(mapped.record.tcgplayer_id, 12345);
  assert.equal(mapped.record.condition, "Near Mint");
  assert.equal(mapped.record.finish, "Foil");
  assert.equal(mapped.record.tcg_market_price, null);
  assert.equal(mapped.record.tcg_low_price, 0.13);
  assert.equal(mapped.record.normalized_collector_number, "82");
});

test("malformed catalog rows are rejected without stopping the whole import", () => {
  const row = rowObject([
    "",
    "Magic",
    "Set",
    "Card",
    "Card",
    "1",
    "Rare",
    "Near Mint",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const mapped = mapTcgplayerMagicCsvRow(row, { rowNumber: 5 });

  assert.equal(mapped.ok, false);
  if (mapped.ok) return;
  assert.equal(mapped.row, 5);
  assert.match(mapped.error, /TCGplayer Id/);
});

test("catalog import is chunked idempotent and counts inserts updates and rejections", async () => {
  const client = new FakeCatalogClient([200]);
  const summary = await importTcgplayerMagicCatalogCsv(
    client,
    csv([
      ["100", "Magic", "Set A", "Card A", "Card A", "1", "Rare", "Near Mint", "1.23", "", "", "0.99", "1", "", "", ""],
      ["200", "Magic", "Set A", "Card B", "Card B", "2", "Rare", "Near Mint Foil", "2.23", "", "", "1.99", "1", "", "", ""],
      ["bad", "Magic", "Set A", "Card C", "Card C", "3", "Rare", "Near Mint", "", "", "", "", "", "", "", ""],
    ]),
    { batchSize: 2, importedAt: "2026-08-10T00:00:00.000Z" },
  );

  assert.equal(summary.totalRows, 3);
  assert.equal(summary.processedRows, 2);
  assert.equal(summary.insertedRows, 1);
  assert.equal(summary.updatedRows, 1);
  assert.equal(summary.rejectedRows, 1);
  assert.equal(client.upserts.length, 1);
  assert.equal(client.upserts[0].length, 2);
});

test("storage multipart catalog import processes parts in order as one logical import", async () => {
  const client = new FakeStorageCatalogClient({
    "tcgplayer/magic/2026-08-10/part-001.csv": csv([
      ["100", "Magic", "Set A", "Card A", "Card A", "1", "Rare", "Near Mint", "1.23", "", "", "0.99", "1", "", "", ""],
    ]),
    "tcgplayer/magic/2026-08-10/part-002.csv": csv([
      ["200", "Magic", "Set B", "Card B", "Card B", "2", "Rare", "Near Mint", "2.23", "", "", "1.99", "1", "", "", ""],
    ]),
    "tcgplayer/magic/2026-08-10/part-003.csv": csv([
      ["bad", "Magic", "Set C", "Card C", "Card C", "3", "Rare", "Near Mint", "", "", "", "", "", "", "", ""],
    ]),
  });

  const started = await startTcgplayerMagicStorageImport(client, {
    bucket: "catalog-imports",
    prefix: "tcgplayer/magic/2026-08-10/",
  });
  assert.equal(started.status, "processing");
  assert.equal(client.downloadedPaths.length, 0);

  const result = await runStorageImportToCompletion(client, {
    bucket: "catalog-imports",
    prefix: "tcgplayer/magic/2026-08-10/",
    batchSize: 1,
    byteLimit: 1024,
  });

  assert.equal(result.status, "completed");
  assert.equal(result.skippedCompletedImport, false);
  assert.deepEqual(client.downloadedPaths, [
    "tcgplayer/magic/2026-08-10/part-001.csv",
    "tcgplayer/magic/2026-08-10/part-002.csv",
    "tcgplayer/magic/2026-08-10/part-003.csv",
  ]);
  assert.equal(result.summary.totalRows, 3);
  assert.equal(result.summary.processedRows, 2);
  assert.equal(result.summary.insertedRows, 2);
  assert.equal(result.summary.updatedRows, 0);
  assert.equal(result.summary.rejectedRows, 1);
  assert.equal(result.parts.filter((part) => part.status === "completed").length, 3);
  assert.equal(client.imports.filter((row) => row.filename === "storage://catalog-imports/tcgplayer/magic/2026-08-10/").length, 1);
});

test("storage catalog import persists checkpoints and resumes after refresh or interrupted batch", async () => {
  const client = new FakeStorageCatalogClient({
    "tcgplayer/magic/2026-08-10/part-001.csv": csv([
      ["100", "Magic", "Set A", "Card A", "Card A", "1", "Rare", "Near Mint", "1.23", "", "", "0.99", "1", "", "", ""],
      ["101", "Magic", "Set A", "Card AA", "Card AA", "1", "Rare", "Near Mint", "1.23", "", "", "0.99", "1", "", "", ""],
    ]),
    "tcgplayer/magic/2026-08-10/part-002.csv": csv([
      ["200", "Magic", "Set B", "Card B", "Card B", "2", "Rare", "Near Mint", "2.23", "", "", "1.99", "1", "", "", ""],
    ]),
  });

  const first = await advanceTcgplayerMagicStorageImport(client, {
    bucket: "catalog-imports",
    paths: [
      "tcgplayer/magic/2026-08-10/part-001.csv",
      "tcgplayer/magic/2026-08-10/part-002.csv",
    ],
    batchSize: 1,
    byteLimit: 1024,
    downloadRange: client.downloadRange,
  });
  assert.equal(first.status, "processing");
  assert.equal(first.summary.processedRows, 1);
  assert.ok(first.parts[0].byteOffset > 0);

  const recovered = await startTcgplayerMagicStorageImport(client, {
    bucket: "catalog-imports",
    paths: [
      "tcgplayer/magic/2026-08-10/part-001.csv",
      "tcgplayer/magic/2026-08-10/part-002.csv",
    ],
  });
  assert.equal(recovered.summary.processedRows, 1);
  assert.equal(recovered.parts[0].byteOffset, first.parts[0].byteOffset);

  const result = await runStorageImportToCompletion(client, {
    bucket: "catalog-imports",
    paths: [
      "tcgplayer/magic/2026-08-10/part-001.csv",
      "tcgplayer/magic/2026-08-10/part-002.csv",
    ],
    batchSize: 1,
    byteLimit: 1024,
  });
  assert.equal(result.status, "completed");
  assert.equal(result.summary.processedRows, 3);
  assert.equal(result.parts[0].status, "completed");
  assert.equal(result.parts[1].status, "completed");
  assert.equal(new Set(client.upserts.flat().map((row) => row.tcgplayer_id)).size, 3);
});

test("completed storage catalog import is not processed twice", async () => {
  const client = new FakeStorageCatalogClient({
    "tcgplayer/magic/2026-08-10/part-001.csv": csv([
      ["100", "Magic", "Set A", "Card A", "Card A", "1", "Rare", "Near Mint", "1.23", "", "", "0.99", "1", "", "", ""],
    ]),
  });

  await runStorageImportToCompletion(client, {
    bucket: "catalog-imports",
    paths: ["tcgplayer/magic/2026-08-10/part-001.csv"],
    batchSize: 1,
    byteLimit: 1024,
  });
  client.downloadedPaths = [];

  const second = await advanceTcgplayerMagicStorageImport(client, {
    bucket: "catalog-imports",
    paths: ["tcgplayer/magic/2026-08-10/part-001.csv"],
    batchSize: 1,
    byteLimit: 1024,
    downloadRange: client.downloadRange,
  });

  assert.equal(second.skippedCompletedImport, true);
  assert.deepEqual(client.downloadedPaths, []);
  assert.equal(client.upserts.length, 1);
});

test("duplicate active storage import protection reuses the existing processing job", async () => {
  const client = new FakeStorageCatalogClient({
    "tcgplayer/magic/2026-08-10/part-001.csv": csv([
      ["100", "Magic", "Set A", "Card A", "Card A", "1", "Rare", "Near Mint", "1.23", "", "", "0.99", "1", "", "", ""],
    ]),
  });

  const first = await startTcgplayerMagicStorageImport(client, {
    bucket: "catalog-imports",
    paths: ["tcgplayer/magic/2026-08-10/part-001.csv"],
  });
  const second = await startTcgplayerMagicStorageImport(client, {
    bucket: "catalog-imports",
    paths: ["tcgplayer/magic/2026-08-10/part-001.csv"],
  });

  assert.equal(first.importRunId, second.importRunId);
  assert.equal(client.imports.length, 1);
});

test("catalog resolver returns exact TCGplayer IDs and refuses ambiguous or missing matches", async () => {
  const rows: TcgplayerMagicCatalogRecord[] = [
    mappedRecord(100, "Set A", "Card A", "1", "Near Mint"),
    mappedRecord(101, "Set A", "Card A", "1", "Near Mint Foil"),
    mappedRecord(102, "Set A", "Card A", "2", "Near Mint"),
  ];
  const client = new FakeResolverClient(rows);

  const exact = await resolveTcgplayerVariant(client, {
    productName: "Card A",
    setName: "Set A",
    collectorNumber: "1",
    condition: "Near Mint",
    finish: "Foil",
  });
  assert.equal(exact.status, "matched");
  assert.equal(exact.status === "matched" ? exact.tcgplayerId : null, 101);

  const ambiguous = await resolveTcgplayerVariant(client, {
    productName: "Card A",
    setName: "Set A",
    condition: "Near Mint",
  });
  assert.equal(ambiguous.status, "ambiguous");

  const missing = await resolveTcgplayerVariant(client, {
    productName: "Card Z",
    setName: "Set A",
    collectorNumber: "1",
    condition: "Near Mint",
  });
  assert.equal(missing.status, "unresolved");
});

test("only trusted Owner/Admin platform users may mutate the canonical TCGplayer catalog", () => {
  const route = readFileSync(path.join(repoRoot, "src/app/api/admin/tcgplayer-catalog/route.ts"), "utf8");
  assert.match(route, /requireServerPlatformRole\("admin"\)/);
  assert.doesNotMatch(route, /localStorage|email|tradingdocks@gmail\.com/i);

  const free = resolvePlatformAccessContext({
    authenticated: true,
    userId: "free-user",
    platformRole: "user",
    effectiveMembershipTier: "free",
  });
  const collector = resolvePlatformAccessContext({
    authenticated: true,
    userId: "collector-user",
    platformRole: "user",
    effectiveMembershipTier: "collector",
  });
  const seller = resolvePlatformAccessContext({
    authenticated: true,
    userId: "seller-user",
    platformRole: "user",
    effectiveMembershipTier: "seller",
  });
  const store = resolvePlatformAccessContext({
    authenticated: true,
    userId: "store-user",
    platformRole: "user",
    effectiveMembershipTier: "store",
  });
  const owner = resolvePlatformAccessContext({
    authenticated: true,
    userId: "owner",
    platformRole: "owner",
    platformRoleAuthority: "trusted",
    effectiveMembershipTier: "free",
  });
  const admin = resolvePlatformAccessContext({
    authenticated: true,
    userId: "admin",
    platformRole: "admin",
    platformRoleAuthority: "trusted",
    effectiveMembershipTier: "free",
  });

  for (const access of [free, collector, seller, store]) {
    assert.equal(hasCapability(access, "platform.admin"), false);
  }
  assert.equal(hasCapability(owner, "platform.admin"), true);
  assert.equal(hasCapability(admin, "platform.admin"), true);
});

test("CSV converter resolves exact TCGplayer IDs from the canonical catalog", () => {
  const route = readFileSync(path.join(repoRoot, "src/app/api/tools/csv/tcgplayer-resolve/route.ts"), "utf8");
  assert.match(route, /requireApiCapability\("csv.export"\)/);
  assert.match(route, /resolveTcgplayerVariant/);
  assert.match(route, /condition/);
  assert.match(route, /finish/);
  assert.doesNotMatch(route, /localStorage|email|tradingdocks@gmail\.com/i);

  const converter = readFileSync(path.join(repoRoot, "src/components/dashboard/tools/CsvConversionEngine.tsx"), "utf8");
  assert.match(converter, /Resolve exact TCGplayer IDs/);
  assert.match(converter, /\/api\/tools\/csv\/tcgplayer-resolve/);
  assert.match(converter, /condition-specific TCGplayer ID/);
  assert.match(converter, /Trading Docks resolves the exact TCGplayer inventory SKU/);
});

function rowObject(values: string[]) {
  return Object.fromEntries(CSV_HEADER.split(",").map((header, index) => [header, values[index] ?? ""])) as Record<TcgplayerMagicCsvHeader, string>;
}

function mappedRecord(
  id: number,
  setName: string,
  productName: string,
  number: string,
  condition: string,
) {
  const mapped = mapTcgplayerMagicCsvRow(rowObject([
    String(id),
    "Magic",
    setName,
    productName,
    productName,
    number,
    "Rare",
    condition,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]), { rowNumber: 2 });
  assert.equal(mapped.ok, true);
  if (!mapped.ok) throw new Error("Fixture failed to map.");
  return mapped.record;
}

function csvEscape(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;
}

async function runStorageImportToCompletion(
  client: FakeStorageCatalogClient,
  options: {
    bucket: string;
    prefix?: string;
    paths?: string[];
    batchSize: number;
    byteLimit: number;
  },
) {
  let result = await advanceTcgplayerMagicStorageImport(client, {
    ...options,
    downloadRange: client.downloadRange,
  });
  for (let index = 0; index < 20 && result.status !== "completed"; index += 1) {
    result = await advanceTcgplayerMagicStorageImport(client, {
      ...options,
      downloadRange: client.downloadRange,
    });
  }
  assert.equal(result.status, "completed");
  return result;
}

class FakeCatalogClient {
  upserts: TcgplayerMagicCatalogRecord[][] = [];
  imports: Record<string, unknown>[] = [];
  existingIds: number[];

  constructor(existingIds: number[]) {
    this.existingIds = existingIds;
  }

  from(table: string) {
    const existingIds = this.existingIds;
    const upserts = this.upserts;
    const imports = this.imports;
    return {
      select() {
        return {
          in(_column: string, values: number[]) {
            const data = values
              .filter((value) => existingIds.includes(value))
              .map((tcgplayer_id) => ({ tcgplayer_id }));
            return Promise.resolve({ data, error: null });
          },
        };
      },
      upsert(rows: TcgplayerMagicCatalogRecord[]) {
        upserts.push(rows);
        for (const row of rows) {
          if (!existingIds.includes(row.tcgplayer_id)) existingIds.push(row.tcgplayer_id);
        }
        return Promise.resolve({ data: null, error: null });
      },
      insert(row: Record<string, unknown>) {
        assert.equal(table, "tcgplayer_magic_catalog_imports");
        imports.push(row);
        return Promise.resolve({ data: null, error: null });
      },
      update(row: Record<string, unknown>) {
        return {
          eq(column: string, value: string) {
            assert.equal(column, "id");
            imports.push({ id: value, ...row });
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    };
  }
}

class FakeStorageCatalogClient extends FakeCatalogClient {
  files: Record<string, string>;
  downloadedPaths: string[] = [];
  encoder = new TextEncoder();

  constructor(files: Record<string, string>) {
    super([]);
    this.files = files;
  }

  override from(table: string) {
    if (table !== "tcgplayer_magic_catalog_imports") return super.from(table);

    const imports = this.imports;
    return {
      select() {
        const query = {
          filters: new Map<string, string>(),
          eq(column: string, value: string) {
            query.filters.set(column, value);
            return query;
          },
          order() {
            return query;
          },
          limit(count: number) {
            const data = imports
              .filter((row) => [...query.filters].every(([column, value]) => row[column] === value))
              .slice(-count)
              .reverse();
            return Promise.resolve({ data, error: null });
          },
        };
        return query;
      },
      insert(row: Record<string, unknown>) {
        imports.push({
          total_rows: 0,
          processed_rows: 0,
          inserted_rows: 0,
          updated_rows: 0,
          rejected_rows: 0,
          error_summary: [],
          ...row,
        });
        return Promise.resolve({ data: null, error: null });
      },
      update(row: Record<string, unknown>) {
        return {
          eq(column: string, value: string) {
            assert.equal(column, "id");
            const index = imports.findIndex((existing) => existing.id === value);
            assert.notEqual(index, -1);
            imports[index] = { ...imports[index], ...row };
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    };
  }

  storage = {
    from: (_bucket: string) => ({
      list: (prefix: string) => {
        const data = Object.keys(this.files)
          .filter((path) => path.startsWith(prefix))
          .map((path) => ({ name: path.slice(prefix.length) }));
        return Promise.resolve({ data, error: null });
      },
    }),
  };

  downloadRange = async (_bucket: string, path: string, startByte: number, byteLength: number) => {
    this.downloadedPaths.push(path);
    const file = this.files[path];
    if (!file) throw new Error("missing");
    const bytes = this.encoder.encode(file);
    const endExclusive = Math.min(bytes.length, startByte + byteLength);
    return {
      bytes: bytes.slice(startByte, endExclusive),
      start: startByte,
      end: endExclusive - 1,
      totalBytes: bytes.length,
    };
  };
}

class FakeResolverClient {
  rows: TcgplayerMagicCatalogRecord[];

  constructor(rows: TcgplayerMagicCatalogRecord[]) {
    this.rows = rows;
  }

  from() {
    const filters: Record<string, string> = {};
    const query = {
      select() {
        return query;
      },
      eq(column: string, value: string) {
        filters[column] = value;
        return query;
      },
      limit(count: number) {
        const data = this.rows
          .filter((row) =>
            Object.entries(filters).every(([column, value]) =>
              String((row as unknown as Record<string, unknown>)[column]) === value,
            ),
          )
          .slice(0, count);
        return Promise.resolve({ data, error: null });
      },
      rows: this.rows,
    };
    return query;
  }
}
