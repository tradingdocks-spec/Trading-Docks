import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  advanceTcgplayerMagicStorageImport,
  downloadSupabaseStorageRange,
  importTcgplayerMagicCatalogCsv,
  mapTcgplayerMagicCsvRow,
  normalizeCollectorNumber,
  normalizeConditionFinish,
  resolveTcgplayerMagicStorageParts,
  resolveTcgplayerVariant,
  startTcgplayerMagicStorageImport,
  TCGPLAYER_CATALOG_DB_UPSERT_CHUNK_ROWS,
  TcgplayerCatalogImportStageError,
  validateTcgplayerMagicHeaders,
  verifyTcgplayerMagicStorageParts,
  type TcgplayerMagicCatalogRecord,
  type TcgplayerMagicCsvHeader,
} from "../src/lib/tcgplayer-catalog/index.ts";
import { serializeError } from "../src/lib/tcgplayer-catalog/error-serialization.ts";
import { createPrintingLookup, parseListCollector, catalogProductId } from "../src/lib/tcgplayer-catalog/printing-identity.ts";
import { normalizeRows, parseCsv, exportCsv } from "../src/lib/csv-converter.ts";
import {
  hasCapability,
  resolvePlatformAccessContext,
} from "../mobile/services/platform-access.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const printingFixture = JSON.parse(readFileSync(path.join(repoRoot, "tests/fixtures/converter-printing-families.json"), "utf8")) as {
  fixtures: Array<[string, string, string, number]>;
  responses: Record<string, unknown>;
};

function fixtureLookup(responses = printingFixture.responses) {
  return createPrintingLookup((async (url) => {
    const response = responses[String(url)];
    return new Response(JSON.stringify(response ?? {}), { status: response ? 200 : 404 });
  }) as typeof fetch);
}

test("all five review regressions resolve through public printing relationships without changing imported identifiers", async () => {
  const lookupPrinting = fixtureLookup();
  const rows = normalizeRows(parseCsv(readFileSync(path.join(repoRoot, "tests/fixtures/converter-review-regressions.csv"), "utf8")), "generic");
  const original = structuredClone(rows);
  const catalog: TcgplayerMagicCatalogRecord[] = [];
  for (const [index, row] of rows.entries()) {
    const printing = await lookupPrinting({ productName: row.name, setCode: row.setCode, collectorNumber: row.collectorNumber });
    assert.ok(printing);
    // SKU IDs here are deliberately synthetic; product identities are captured public metadata.
    for (const [variant, condition] of ["Near Mint", "Lightly Played", "Near Mint Foil"].entries()) {
      catalog.push({ ...mappedRecord(900000 + index * 10 + variant, printing.setName, printing.productName, printing.collectorNumber, condition), photo_url: `https://tcgplayer-cdn.tcgplayer.com/product/${printing.productId}_200w.jpg` });
    }
    if (row.setCode === "gk2") catalog.push({ ...catalog[catalog.length - 3], tcgplayer_id: 999999 });
  }
  const client = new FakeResolverClient(catalog.reverse());
  const results = [];
  for (const row of rows) results.push(await resolveTcgplayerVariant(client, {
    productName: row.name, setCode: row.setCode, collectorNumber: row.collectorNumber,
    condition: row.condition, finish: row.finish, lookupPrinting,
  }));
  assert.equal(results.filter((result) => result.status !== "matched").length, 0);
  assert.deepEqual(rows, original);
  results.forEach((result, index) => {
    assert.equal(result.status, "matched");
    if (result.status !== "matched") return;
    assert.equal(result.tcgplayerId, 900000 + index * 10);
    assert.equal(catalogProductId(result.row.photo_url), String(printingFixture.fixtures[index][3]));
    const exported = parseCsv(exportCsv([{ ...rows[index], tcgplayerId: String(result.tcgplayerId), setName: result.row.set_name, name: result.row.product_name, collectorNumber: result.row.collector_number! }], "tcgplayer"));
    assert.equal(exported.rows[0]["Number"], result.row.collector_number);
    assert.equal(exported.rows[0]["Set Name"], result.row.set_name);
    if (index < 4) {
      assert.equal(result.diagnostics.stage, "special-printing");
      assert.equal(result.diagnostics.collectorNumber, rows[index].collectorNumber);
    }
  });
});

test("List diagnostics expose compound parts and never substitute the original printing", async () => {
  const client = new FakeResolverClient([mappedRecord(1, "Guilds of Ravnica: Guild Kits", "Darkblast", "51", "Near Mint")]);
  const result = await resolveTcgplayerVariant(client, { productName: "Darkblast", setCode: "plst", collectorNumber: "GK1-51", condition: "NM", lookupPrinting: fixtureLookup() });
  assert.equal(result.status, "unresolved");
  assert.equal(result.status === "unresolved" && result.reasonCode, "PLST_COMPOUND_COLLECTOR_UNRESOLVED");
  assert.equal(result.diagnostics.sourceSetCode, "gk1");
  assert.equal(result.diagnostics.sourceCollectorNumber, "51");
  assert.equal(result.diagnostics.collectorNumber, "GK1-51");
  assert.deepEqual(parseListCollector(" gK1–51 "), { sourceSetCode: "gk1", sourceCollectorNumber: "51" });
});

test("a compound prefix must reference the same original card", async () => {
  const responses = { ...printingFixture.responses, "https://api.scryfall.com/cards/gk1/51": { name: "Different card" } };
  assert.equal(await fixtureLookup(responses)({ productName: "Darkblast", setCode: "plst", collectorNumber: "GK1-51" }), null);
});

test("exact SKU and product IDs precede conflicting textual printing metadata", async () => {
  const client = new FakeResolverClient([{ ...mappedRecord(123, "Set A", "Card A", "1", "Near Mint"), photo_url: "https://tcgplayer-cdn.tcgplayer.com/product/456_200w.jpg" }]);
  const sku = await resolveTcgplayerVariant(client, { productName: "Wrong name", setCode: "zzz", condition: "NM", tcgplayerId: " 000123 " });
  assert.equal(sku.status === "matched" && sku.tcgplayerId, 123);
  const product = await resolveTcgplayerVariant(client, { productName: "Wrong name", setCode: "zzz", condition: "NM", tcgplayerProductId: "000456" });
  assert.equal(product.status === "matched" && product.tcgplayerId, 123);
  assert.equal(catalogProductId("https://example.com/product/456_200w.jpg"), null);
});

test("different product IDs at the same name set and collector remain genuinely ambiguous", async () => {
  const rows = [1, 2].map((id) => ({ ...mappedRecord(id, "Ravnica Allegiance: Guild Kits", "Azorius Herald", "2", "Near Mint"), photo_url: `https://tcgplayer-cdn.tcgplayer.com/product/${id}_200w.jpg` }));
  const result = await resolveTcgplayerVariant(new FakeResolverClient(rows), { productName: "Azorius Herald", setCode: "gk2", collectorNumber: "2", condition: "NM" });
  assert.equal(result.status, "ambiguous");
});

test("name-only fallback resolves a unique identity and retains ambiguity across sets", async () => {
  const input = { productName: "Card A", condition: "NM" };
  const row = mappedRecord(1, "Set A", "Card A", "1", "Near Mint");
  assert.equal((await resolveTcgplayerVariant(new FakeResolverClient([row]), input)).status, "matched");
  assert.equal((await resolveTcgplayerVariant(new FakeResolverClient([row, mappedRecord(2, "Set B", "Card A", "1", "Near Mint")]), input)).status, "ambiguous");
});

test("normalized Magic collector resolution accepts padding and set-size suffixes without editing input", async () => {
  const input = { productName: "Azorius Herald", setCode: "gk2", collectorNumber: "2", condition: "NM" };
  const result = await resolveTcgplayerVariant(new FakeResolverClient([mappedRecord(1, "Ravnica Allegiance: Guild Kits", "Azorius Herald", "002/133", "Near Mint")]), input);
  assert.equal(result.status, "matched");
  assert.equal(input.collectorNumber, "2");
});

test("unavailable List metadata retains structured compound diagnostics", async () => {
  const result = await resolveTcgplayerVariant(new FakeResolverClient([]), {
    productName: "Darkblast", setCode: "plst", collectorNumber: "GK1-51", condition: "NM",
    lookupPrinting: async () => { throw new Error("Printing metadata lookup failed (503)."); },
  });
  assert.equal(result.status === "unresolved" && result.reasonCode, "PLST_COMPOUND_COLLECTOR_UNRESOLVED");
  assert.match(result.diagnostics.lookupError!, /503/);
  assert.equal(result.diagnostics.sourceSetCode, "gk1");
});

test("a linked external List product missing from the SKU catalog keeps compound diagnostics", async () => {
  const result = await resolveTcgplayerVariant(new FakeResolverClient([]), {
    productName: "Darkblast", setCode: "plst", collectorNumber: "GK1-51", condition: "NM", tcgplayerProductId: "203631", lookupPrinting: fixtureLookup(),
  });
  assert.equal(result.status === "unresolved" && result.reasonCode, "PLST_COMPOUND_COLLECTOR_UNRESOLVED");
  assert.equal(result.diagnostics.sourceSetCode, "gk1");
});
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

test("blank and currency numeric catalog fields normalize to database-safe values", () => {
  const mapped = mapTcgplayerMagicCsvRow(rowObject([
    "7,654,321",
    "Magic",
    "Test Set",
    "Test Card",
    "Test Card",
    "42a",
    "Mythic",
    "Near Mint",
    "$1,234.56",
    "",
    " ",
    "$0.09",
    "",
    "1,200",
    "",
    "",
  ]), { rowNumber: 2 });

  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  assert.equal(Number.isSafeInteger(mapped.record.tcgplayer_id), true);
  assert.equal(mapped.record.tcgplayer_id, 7654321);
  assert.equal(mapped.record.tcg_market_price, 1234.56);
  assert.equal(mapped.record.tcg_direct_low, null);
  assert.equal(mapped.record.tcg_low_price_with_shipping, null);
  assert.equal(mapped.record.tcg_low_price, 0.09);
  assert.equal(mapped.record.total_quantity, null);
  assert.equal(mapped.record.add_to_quantity, 1200);
  assert.equal(mapped.record.tcg_marketplace_price, null);
});

test("catalog payload column names match the tcgplayer_magic_catalog schema", () => {
  const migration = readFileSync(path.join(repoRoot, "supabase/migrations/202608100003_tcgplayer_magic_catalog.sql"), "utf8");
  const mapped = mapTcgplayerMagicCsvRow(rowObject([
    "12345", "Magic", "Set", "Card", "Card", "1", "Rare", "Near Mint", "", "", "", "", "", "", "", "",
  ]), { rowNumber: 2 });

  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  const createTable = migration.match(/create table if not exists public\.tcgplayer_magic_catalog \(([\s\S]*?)\n\);/)?.[1] ?? "";
  const columns = new Set(
    createTable
      .split("\n")
      .map((line) => line.trim().match(/^([a-z_][a-z0-9_]*)\s/)?.[1])
      .filter(Boolean),
  );
  for (const key of Object.keys(mapped.record)) {
    assert.equal(columns.has(key), true, `${key} must exist on tcgplayer_magic_catalog`);
  }
  assert.match(migration, /tcgplayer_id bigint not null/);
  assert.match(migration, /constraint tcgplayer_magic_catalog_tcgplayer_id_key unique \(tcgplayer_id\)/);
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

test("storage prefix plus filenames resolves object paths exactly once", async () => {
  const client = new FakeStorageCatalogClient({
    "tcgplayer/magic/2026-08-10/part-001.csv": csv([
      ["100", "Magic", "Set A", "Card A", "Card A", "1", "Rare", "Near Mint", "1.23", "", "", "0.99", "1", "", "", ""],
    ]),
  });

  const filenamePaths = await resolveTcgplayerMagicStorageParts(client, {
    bucket: "catalog-imports",
    prefix: "tcgplayer/magic/2026-08-10/",
    paths: ["part-001.csv"],
  });
  assert.deepEqual(filenamePaths, ["tcgplayer/magic/2026-08-10/part-001.csv"]);

  const fullPaths = await resolveTcgplayerMagicStorageParts(client, {
    bucket: "catalog-imports",
    prefix: "tcgplayer/magic/2026-08-10/",
    paths: ["tcgplayer/magic/2026-08-10/part-001.csv"],
  });
  assert.deepEqual(fullPaths, ["tcgplayer/magic/2026-08-10/part-001.csv"]);
});

test("blank storage prefix resolves root-level catalog objects", async () => {
  const client = new FakeStorageCatalogClient({
    "part-001.csv": csv([
      ["100", "Magic", "Set A", "Card A", "Card A", "1", "Rare", "Near Mint", "1.23", "", "", "0.99", "1", "", "", ""],
    ]),
    "part-002.csv": csv([
      ["200", "Magic", "Set B", "Card B", "Card B", "2", "Rare", "Near Mint", "2.23", "", "", "1.99", "1", "", "", ""],
    ]),
  });

  const paths = await resolveTcgplayerMagicStorageParts(client, {
    bucket: "catalog-imports",
    prefix: "",
    paths: ["part-001.csv", "part-002.csv"],
  });
  assert.deepEqual(paths, ["part-001.csv", "part-002.csv"]);

  const verified = await verifyTcgplayerMagicStorageParts(client, {
    bucket: "catalog-imports",
    prefix: "",
    paths,
  });
  assert.deepEqual(verified.map((part) => part.path), ["part-001.csv", "part-002.csv"]);
  assert.equal(verified.every((part) => part.exists), true);
});

test("default storage multipart import uses root-level catalog part names", async () => {
  const client = new FakeStorageCatalogClient({
    "part-001.csv": csv([
      ["100", "Magic", "Set A", "Card A", "Card A", "1", "Rare", "Near Mint", "1.23", "", "", "0.99", "1", "", "", ""],
    ]),
    "part-002.csv": csv([
      ["200", "Magic", "Set B", "Card B", "Card B", "2", "Rare", "Near Mint", "2.23", "", "", "1.99", "1", "", "", ""],
    ]),
    "part-003.csv": csv([
      ["300", "Magic", "Set C", "Card C", "Card C", "3", "Rare", "Near Mint", "3.23", "", "", "2.99", "1", "", "", ""],
    ]),
  });

  const result = await runStorageImportToCompletion(client, {
    bucket: "catalog-imports",
    batchSize: 1,
    byteLimit: 1024,
  });

  assert.deepEqual(client.downloadedPaths, ["part-001.csv", "part-002.csv", "part-003.csv"]);
  assert.equal(result.status, "completed");
  assert.equal(result.logicalImportKey, "storage://catalog-imports/part-001.csv|part-002.csv|part-003.csv");
});

test("storage verification reports existence size and content type before import", async () => {
  const client = new FakeStorageCatalogClient({
    "tcgplayer/magic/2026-08-10/part-001.csv": csv([
      ["100", "Magic", "Set A", "Card A", "Card A", "1", "Rare", "Near Mint", "1.23", "", "", "0.99", "1", "", "", ""],
    ]),
  });

  const parts = await verifyTcgplayerMagicStorageParts(client, {
    bucket: "catalog-imports",
    prefix: "tcgplayer/magic/2026-08-10/",
    paths: ["part-001.csv", "part-404.csv"],
  });

  assert.equal(parts[0].path, "tcgplayer/magic/2026-08-10/part-001.csv");
  assert.equal(parts[0].exists, true);
  assert.ok((parts[0].size ?? 0) > 0);
  assert.equal(parts[0].contentType, "text/csv");
  assert.equal(parts[1].exists, false);
});

test("private storage range requests use the authenticated Supabase object endpoint", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

  let requestedUrl = "";
  let requestedRange = "";
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input);
    requestedRange = new Headers(init?.headers).get("range") ?? "";
    return Promise.resolve(new Response("abc", {
      status: 206,
      headers: {
        "content-range": "bytes 0-2/9",
        "content-length": "3",
      },
    }));
  }) as typeof fetch;

  try {
    const result = await downloadSupabaseStorageRange(
      "catalog-imports",
      "tcgplayer/magic/2026-08-10/part-001.csv",
      0,
      3,
    );

    assert.equal(requestedUrl, "https://example.supabase.co/storage/v1/object/authenticated/catalog-imports/tcgplayer/magic/2026-08-10/part-001.csv");
    assert.equal(requestedRange, "bytes=0-2");
    assert.equal(result.totalBytes, 9);
    assert.equal(new TextDecoder().decode(result.bytes), "abc");
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});

test("storage range errors surface Supabase response details", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  globalThis.fetch = (() => Promise.resolve(new Response('{"error":"Invalid range"}', { status: 400 }))) as typeof fetch;

  try {
    await assert.rejects(
      () => downloadSupabaseStorageRange("catalog-imports", "part-001.csv", 0, 3),
      /HTTP 400.*Invalid range/,
    );
  } finally {
    globalThis.fetch = previousFetch;
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});

test("catalog error serializer never returns an empty message", () => {
  assert.equal(serializeError(new Error("")).message, "Unknown error");
  assert.equal(serializeError("").message, "Unknown error");
  assert.equal(serializeError("storage unavailable").message, "storage unavailable");

  const supabase = serializeError({
    message: "",
    code: "23505",
    details: "duplicate key",
    hint: "use upsert",
    status: 409,
  });
  assert.equal(supabase.message, JSON.stringify({
    message: "",
    code: "23505",
    details: "duplicate key",
    hint: "use upsert",
    status: 409,
  }));
  assert.equal(supabase.code, "23505");
  assert.equal(supabase.details, "duplicate key");
  assert.equal(supabase.hint, "use upsert");

  const plain = serializeError({ error: "", reason: "bad range" });
  assert.equal(plain.message, JSON.stringify({ error: "", reason: "bad range" }));
});

test("stage errors serialize original cause and context", () => {
  const error = new TcgplayerCatalogImportStageError(
    "",
    {
      stage: "range-fetch",
      bucket: "catalog-imports",
      objectPath: "part-001.csv",
      byteOffset: 0,
    },
    { message: "", code: "StorageApiError" },
    502,
  );

  const serialized = serializeError(error);
  assert.equal(serialized.message, "Catalog import batch failed");
  assert.equal(serialized.statusCode, 502);
  assert.equal(serialized.cause?.message, JSON.stringify({ message: "", code: "StorageApiError" }));
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

test("first batch failure marks storage import job failed with stage context", async () => {
  const client = new FakeStorageCatalogClient({
    "part-001.csv": csv([
      ["100", "Magic", "Set A", "Card A", "Card A", "1", "Rare", "Near Mint", "1.23", "", "", "0.99", "1", "", "", ""],
    ]),
  });

  await assert.rejects(
    () => advanceTcgplayerMagicStorageImport(client, {
      bucket: "catalog-imports",
      paths: ["part-001.csv"],
      batchSize: 1,
      byteLimit: 1024,
      downloadRange: async () => {
        throw new Error("");
      },
    }),
    (error: unknown) => {
      assert.equal(error instanceof TcgplayerCatalogImportStageError, true);
      const stageError = error as TcgplayerCatalogImportStageError;
      assert.equal(stageError.context.stage, "range-fetch");
      assert.equal(stageError.context.objectPath, "part-001.csv");
      assert.equal(stageError.context.byteOffset, 0);
      assert.notEqual(stageError.message, "");
      return true;
    },
  );

  const latest = client.imports.at(-1);
  assert.equal(latest?.status, "failed");
  const metadata = latest?.error_summary as { parts?: Array<{ status?: string; error?: string }> };
  assert.equal(metadata.parts?.[0]?.status, "failed");
  assert.notEqual(metadata.parts?.[0]?.error, "");
});

test("large storage batches are split into safe database upsert chunks", async () => {
  const rowCount = TCGPLAYER_CATALOG_DB_UPSERT_CHUNK_ROWS * 2 + 5;
  const client = new FakeStorageCatalogClient({
    "part-001.csv": csv(
      Array.from({ length: rowCount }, (_, index) => [
        String(100000 + index),
        "Magic",
        "Chunk Set",
        `Chunk Card ${index}`,
        `Chunk Card ${index}`,
        String(index + 1),
        "Rare",
        "Near Mint",
        "1.23",
        "",
        "",
        "0.99",
        "1",
        "",
        "",
        "",
      ]),
    ),
  });

  const result = await advanceTcgplayerMagicStorageImport(client, {
    bucket: "catalog-imports",
    paths: ["part-001.csv"],
    batchSize: rowCount,
    byteLimit: 1024 * 1024,
    downloadRange: client.downloadRange,
  });

  assert.equal(result.status, "completed");
  assert.deepEqual(client.upserts.map((chunk) => chunk.length), [
    TCGPLAYER_CATALOG_DB_UPSERT_CHUNK_ROWS,
    TCGPLAYER_CATALOG_DB_UPSERT_CHUNK_ROWS,
    5,
  ]);
  assert.deepEqual(client.existingLookups.map((chunk) => chunk.length), [
    TCGPLAYER_CATALOG_DB_UPSERT_CHUNK_ROWS,
    TCGPLAYER_CATALOG_DB_UPSERT_CHUNK_ROWS,
    5,
  ]);
  assert.deepEqual([...new Set(client.upsertConflicts)], ["tcgplayer_id"]);
});

test("Supabase upsert errors preserve code message details and hint", async () => {
  const client = new FailingUpsertStorageCatalogClient({
    "part-001.csv": csv([
      ["100", "Magic", "Set A", "Card A", "Card A", "1", "Rare", "Near Mint", "1.23", "", "", "0.99", "1", "", "", ""],
    ]),
  }, {
    message: "Could not find the 'collector_number' column of 'tcgplayer_magic_catalog' in the schema cache",
    code: "PGRST204",
    details: "Searched for the column public.tcgplayer_magic_catalog.collector_number.",
    hint: "Check the deployed database schema.",
  });

  await assert.rejects(
    () => advanceTcgplayerMagicStorageImport(client, {
      bucket: "catalog-imports",
      paths: ["part-001.csv"],
      batchSize: 1,
      byteLimit: 1024,
      downloadRange: client.downloadRange,
    }),
    (error: unknown) => {
      assert.equal(error instanceof TcgplayerCatalogImportStageError, true);
      const serialized = serializeError(error);
      assert.equal(serialized.message, "Could not find the 'collector_number' column of 'tcgplayer_magic_catalog' in the schema cache");
      assert.equal(serialized.cause?.code, "PGRST204");
      assert.equal(serialized.cause?.details, "Searched for the column public.tcgplayer_magic_catalog.collector_number.");
      assert.equal(serialized.cause?.hint, "Check the deployed database schema.");
      return true;
    },
  );

  const latest = client.imports.at(-1);
  assert.equal(latest?.status, "failed");
});

test("stale zero-row completed storage import can restart", async () => {
  const client = new FakeStorageCatalogClient({
    "tcgplayer/magic/2026-08-10/part-001.csv": csv([
      ["100", "Magic", "Set A", "Card A", "Card A", "1", "Rare", "Near Mint", "1.23", "", "", "0.99", "1", "", "", ""],
    ]),
  });
  client.imports.push({
    id: "stale",
    filename: "storage://catalog-imports/tcgplayer/magic/2026-08-10/",
    status: "completed",
    total_rows: 0,
    processed_rows: 0,
    inserted_rows: 0,
    updated_rows: 0,
    rejected_rows: 0,
    error_summary: {
      kind: "tcgplayer-storage-multipart",
      bucket: "catalog-imports",
      prefix: "tcgplayer/magic/2026-08-10/",
      parts: [],
      errors: [],
    },
  });

  const restarted = await startTcgplayerMagicStorageImport(client, {
    bucket: "catalog-imports",
    prefix: "tcgplayer/magic/2026-08-10/",
  });

  assert.equal(restarted.status, "processing");
  assert.notEqual(restarted.importRunId, "stale");
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

test("catalog resolver refuses non-Magic rows before querying Magic catalog", async () => {
  const client = new FakeResolverClient([
    mappedRecord(100, "Set A", "Pikachu", "1", "Near Mint"),
  ]);

  const result = await resolveTcgplayerVariant(client, {
    gameId: "pokemon",
    productName: "Pikachu",
    setName: "Set A",
    collectorNumber: "1",
    condition: "Near Mint",
    finish: "normal",
  });

  assert.equal(result.status, "unresolved");
  assert.equal(result.status === "unresolved" ? result.reasonCode : null, "UNSUPPORTED_GAME");
  assert.equal(client.queries.length, 0);
});

test("catalog resolver translates Scryfall set codes before exact TCGplayer matching", async () => {
  const rows: TcgplayerMagicCatalogRecord[] = [
    mappedRecord(4057536, "Modern Horizons", "Bazaar Trademage", "41", "Lightly Played Foil"),
    mappedRecord(700056, "Starter Commander Decks", "Laboratory Drudge", "56", "Lightly Played"),
    mappedRecord(700007, "Starter Commander Decks", "Archon of Redemption", "7", "Lightly Played Foil"),
    mappedRecord(123303, "Phyrexia: All Will Be One", "Unctus, Grand Metatect", "303", "Lightly Played Foil"),
  ];
  const client = new FakeResolverClient(rows);

  const bazaar = await resolveTcgplayerVariant(client, {
    productName: "Bazaar Trademage",
    setCode: "mh1",
    collectorNumber: "41",
    condition: "Lightly Played",
    finish: "foil",
  });
  assert.equal(bazaar.status, "matched");
  assert.equal(bazaar.status === "matched" ? bazaar.tcgplayerId : null, 4057536);
  assert.equal(bazaar.status === "matched" ? bazaar.diagnostics.translatedSetName : null, "Modern Horizons");

  const starter = await resolveTcgplayerVariant(client, {
    productName: "Archon of Redemption",
    setCode: "scd",
    collectorNumber: "7",
    condition: "Lightly Played",
    finish: "foil",
  });
  assert.equal(starter.status, "matched");
  assert.equal(starter.status === "matched" ? starter.tcgplayerId : null, 700007);

  const one = await resolveTcgplayerVariant(client, {
    productName: "Unctus, Grand Metatect",
    setCode: "one",
    collectorNumber: "303",
    condition: "Lightly Played",
    finish: "foil",
  });
  assert.equal(one.status, "matched");
  assert.equal(one.status === "matched" ? one.diagnostics.translatedSetName : null, "Phyrexia: All Will Be One");
});

test("catalog resolver reports unavailable finishes and safely resolves unique collector mismatches", async () => {
  const rows: TcgplayerMagicCatalogRecord[] = [
    mappedRecord(700056, "Starter Commander Decks", "Laboratory Drudge", "56", "Lightly Played"),
    mappedRecord(111075, "Phyrexia: All Will Be One", "Unctus, Grand Metatect", "75", "Lightly Played Foil"),
  ];
  const client = new FakeResolverClient(rows);

  const finishUnavailable = await resolveTcgplayerVariant(client, {
    productName: "Laboratory Drudge",
    setCode: "scd",
    collectorNumber: "56",
    condition: "Lightly Played",
    finish: "foil",
  });
  assert.equal(finishUnavailable.status, "unresolved");
  assert.equal(finishUnavailable.status === "unresolved" ? finishUnavailable.reasonCode : null, "FINISH_NOT_AVAILABLE");

  const collectorMismatch = await resolveTcgplayerVariant(client, {
    productName: "Unctus, Grand Metatect",
    setCode: "one",
    collectorNumber: "303",
    condition: "Lightly Played",
    finish: "foil",
  });
  assert.equal(collectorMismatch.status, "matched");
  assert.equal(collectorMismatch.status === "matched" ? collectorMismatch.tcgplayerId : null, 111075);
});

test("catalog resolver tolerates ManaBox punctuation and catalog collector markers safely", async () => {
  const rows: TcgplayerMagicCatalogRecord[] = [
    mappedRecord(900129, "Fallout", "CAMP", "129", "Moderately Played"),
    mappedRecord(900391, "Innistrad: Midnight Hunt", "Join the Dance", "391★", "Moderately Played"),
  ];
  const client = new FakeResolverClient(rows);
  const identities = [
    { code: "pip", name: "Fallout" },
    { code: "mid", name: "Innistrad: Midnight Hunt" },
  ];

  const camp = await resolveTcgplayerVariant(client, {
    productName: "C.A.M.P.",
    setCode: "pip",
    collectorNumber: "129",
    condition: "Moderately Played",
    finish: "normal",
    setIdentities: identities,
  });
  assert.equal(camp.status, "matched");
  assert.equal(camp.status === "matched" ? camp.tcgplayerId : null, 900129);

  const join = await resolveTcgplayerVariant(client, {
    productName: "Join the Dance",
    setCode: "mid",
    collectorNumber: "391",
    condition: "Moderately Played",
    finish: "normal",
    setIdentities: identities,
  });
  assert.equal(join.status, "matched");
  assert.equal(join.status === "matched" ? join.tcgplayerId : null, 900391);
});

test("catalog resolver reports unknown sets missing products and ambiguous printings", async () => {
  const rows: TcgplayerMagicCatalogRecord[] = [
    mappedRecord(1, "Modern Horizons", "Duplicate Card", "1", "Near Mint"),
    mappedRecord(2, "Modern Horizons", "Duplicate Card", "2", "Near Mint"),
  ];
  const client = new FakeResolverClient(rows);

  const unknownSet = await resolveTcgplayerVariant(client, {
    productName: "Duplicate Card",
    setCode: "zzz",
    collectorNumber: "1",
    condition: "Near Mint",
    finish: "normal",
  });
  assert.equal(unknownSet.status, "unresolved");
  assert.equal(unknownSet.status === "unresolved" ? unknownSet.reasonCode : null, "UNKNOWN_SET_CODE");

  const missingProduct = await resolveTcgplayerVariant(client, {
    productName: "Missing Card",
    setCode: "mh1",
    collectorNumber: "1",
    condition: "Near Mint",
    finish: "normal",
  });
  assert.equal(missingProduct.status, "unresolved");
  assert.equal(missingProduct.status === "unresolved" ? missingProduct.reasonCode : null, "SET_MAPPED_NO_PRODUCT");

  const ambiguous = await resolveTcgplayerVariant(client, {
    productName: "Duplicate Card",
    setCode: "mh1",
    condition: "Near Mint",
    finish: "normal",
  });
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(ambiguous.status === "ambiguous" ? ambiguous.reasonCode : null, "AMBIGUOUS_PRINTING");
});

test("authoritative set-code mapping narrows generic Duel Decks labels", async () => {
  const rows = [
    { ...mappedRecord(403168, "Duel Decks: Anthology", "Icatian Priest", "2", "Moderately Played"), normalized_set_name: "duel decks" },
    { ...mappedRecord(403174, "Duel Decks: Divine vs. Demonic", "Icatian Priest", "2", "Moderately Played"), normalized_set_name: "duel decks" },
  ];
  const result = await resolveTcgplayerVariant(new FakeResolverClient(rows), {
    productName: "Icatian Priest",
    setName: "Duel Decks",
    setCode: "dvd",
    collectorNumber: "2",
    condition: "Moderately Played",
    finish: "normal",
    setIdentities: [{ code: "dvd", name: "Duel Decks Anthology: Divine vs. Demonic" }],
  });
  assert.equal(result.status, "matched");
  assert.equal(result.status === "matched" ? result.tcgplayerId : null, 403168);
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
  assert.match(converter, /Match to TCGplayer/);
  assert.match(converter, /\/api\/tools\/csv\/tcgplayer-resolve/);
  assert.match(converter, /condition-specific TCGplayer ID/);
  assert.match(converter, /Trading Docks resolves the exact TCGplayer inventory SKU/);
  assert.doesNotMatch(converter, /Resolve exact TCGplayer IDs/);
});

test("CSV converter presents a clean TCGplayer match and download workflow", () => {
  const converter = readFileSync(path.join(repoRoot, "src/components/dashboard/tools/CsvConversionEngine.tsx"), "utf8");

  assert.match(converter, /Review and finish/);
  assert.match(converter, /Match to TCGplayer/);
  assert.match(converter, /Download TCGplayer CSV/);
  assert.match(converter, /All \$\{validRows\.length\.toLocaleString\(\)\} cards matched/);
  assert.match(converter, /Your cards have been matched to the correct TCGplayer printing, condition, and finish/);
  assert.match(converter, /Advanced options/);
  assert.match(converter, /TCGplayer reference export/);
  assert.match(converter, /Match product details/);
  assert.match(converter, /How TCGplayer matching works/);
  assert.match(converter, /TCGPLAYER_REASON_LABELS/);
  assert.match(converter, /collectorNumbersEquivalent/);
  assert.match(converter, /setNamesEquivalent/);
  assert.match(converter, /identityCandidates\.length === 1/);
  assert.match(converter, /Set could not be identified/);
  assert.match(converter, /hasAttemptedTcgplayerMatch && missingTcgplayerSkuCount/);
  assert.match(converter, /\["Card", "Set", "#", "Condition", "Finish", "Qty"/);
  assert.doesNotMatch(converter, /TCGplayer ID reference export/);
  assert.doesNotMatch(converter, /How ID verification works/);
  assert.doesNotMatch(converter, /Download ManaBox bridge instead/);
});

test("CSV converter keeps Nonfoil distinct from Foil during normalization", () => {
  const converter = readFileSync(path.join(repoRoot, "src/components/dashboard/tools/CsvConversionEngine.tsx"), "utf8");
  const nonfoilGuard = converter.indexOf('["0", "false", "no", "normal", "regular", "nonfoil", "non-foil"]');
  const foilGuard = converter.indexOf('["1", "true", "yes", "foil", "premium"]');
  assert.ok(nonfoilGuard >= 0, "Nonfoil aliases must be explicit");
  assert.ok(foilGuard >= 0, "Foil aliases must be explicit");
  assert.ok(nonfoilGuard < foilGuard, "Nonfoil must be checked before the broad foil substring match");
});

test("admin catalog UI requires storage verification before importing all parts", () => {
  const source = readFileSync(path.join(repoRoot, "src/components/dashboard/admin/catalog/TcgplayerCatalogManager.tsx"), "utf8");
  assert.match(source, /storage-verify/);
  assert.match(source, /storageVerified/);
  assert.match(source, /disabled=\{working !== null \|\| !storageVerified\}/);
  assert.match(source, /Verified storage objects/);
  assert.match(source, /useState\(""\)/);
  assert.doesNotMatch(source, /Processing" value=\{working \? "Active" : result \? "Complete" : "Idle"\}/);
});

test("admin catalog API failure responses include actionable stage context", () => {
  const source = readFileSync(path.join(repoRoot, "src/app/api/admin/tcgplayer-catalog/route.ts"), "utf8");
  assert.match(source, /catalogErrorResponse/);
  assert.match(source, /stage: stageError\?\.context\.stage/);
  assert.match(source, /part: stageError\?\.context\.objectPath/);
  assert.match(source, /byteOffset: stageError\?\.context\.byteOffset/);
  assert.match(source, /Catalog import batch failed/);
  assert.doesNotMatch(source, /error:\s*databaseError/);
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
  upsertConflicts: string[] = [];
  existingLookups: number[][] = [];
  imports: Record<string, unknown>[] = [];
  existingIds: number[];

  constructor(existingIds: number[]) {
    this.existingIds = existingIds;
  }

  from(table: string) {
    const existingIds = this.existingIds;
    const existingLookups = this.existingLookups;
    const upserts = this.upserts;
    const upsertConflicts = this.upsertConflicts;
    const imports = this.imports;
    return {
      select() {
        return {
          in(_column: string, values: number[]) {
            existingLookups.push(values);
            const data = values
              .filter((value) => existingIds.includes(value))
              .map((tcgplayer_id) => ({ tcgplayer_id }));
            return Promise.resolve({ data, error: null });
          },
        };
      },
      upsert(rows: TcgplayerMagicCatalogRecord[], options?: { onConflict: string }) {
        upserts.push(rows);
        upsertConflicts.push(options?.onConflict ?? "");
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
          .map((path) => ({
            name: path.slice(prefix.length),
            metadata: {
              size: this.encoder.encode(this.files[path]).length,
              mimetype: "text/csv",
            },
          }));
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

class FailingUpsertStorageCatalogClient extends FakeStorageCatalogClient {
  upsertError: { message: string; code: string; details: string; hint: string };

  constructor(files: Record<string, string>, upsertError: { message: string; code: string; details: string; hint: string }) {
    super(files);
    this.upsertError = upsertError;
  }

  override from(table: string) {
    if (table !== "tcgplayer_magic_catalog") return super.from(table);

    const base = super.from(table);
    return {
      ...base,
      upsert: (rows: TcgplayerMagicCatalogRecord[], options?: { onConflict: string }) => {
        this.upserts.push(rows);
        this.upsertConflicts.push(options?.onConflict ?? "");
        return Promise.resolve({ data: null, error: this.upsertError });
      },
    };
  }
}

class FakeResolverClient {
  rows: TcgplayerMagicCatalogRecord[];
  queries: string[] = [];

  constructor(rows: TcgplayerMagicCatalogRecord[]) {
    this.rows = rows;
  }

  from(table = "tcgplayer_magic_catalog") {
    this.queries.push(table);
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
