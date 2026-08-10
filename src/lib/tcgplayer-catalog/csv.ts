import {
  normalizeCollectorNumber,
  normalizeConditionFinish,
  normalizeProductName,
  normalizeSetName,
  parseNullableInteger,
  parseNullableMoney,
} from "./normalization.ts";

export const TCGPLAYER_MAGIC_CSV_HEADERS = [
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
] as const;

export type TcgplayerMagicCsvHeader = (typeof TCGPLAYER_MAGIC_CSV_HEADERS)[number];

export type TcgplayerMagicCatalogRecord = {
  tcgplayer_id: number;
  product_line: "Magic";
  set_name: string;
  product_name: string;
  title: string | null;
  collector_number: string | null;
  rarity: string | null;
  raw_condition: string;
  condition: string;
  finish: string;
  normalized_set_name: string;
  normalized_product_name: string;
  normalized_collector_number: string | null;
  normalized_condition: string;
  normalized_finish: string;
  tcg_market_price: number | null;
  tcg_direct_low: number | null;
  tcg_low_price_with_shipping: number | null;
  tcg_low_price: number | null;
  total_quantity: number | null;
  add_to_quantity: number | null;
  tcg_marketplace_price: number | null;
  photo_url: string | null;
  source_imported_at: string;
};

export type ParsedCatalogRow = {
  ok: true;
  record: TcgplayerMagicCatalogRecord;
} | {
  ok: false;
  error: string;
  row: number;
};

export type CsvHeaderValidation = {
  ok: boolean;
  missing: string[];
  extra: string[];
};

export function validateTcgplayerMagicHeaders(headers: string[]): CsvHeaderValidation {
  const normalized = new Set(headers.map((header) => header.trim()));
  const expected = new Set<string>(TCGPLAYER_MAGIC_CSV_HEADERS);
  return {
    ok: TCGPLAYER_MAGIC_CSV_HEADERS.every((header) => normalized.has(header)),
    missing: TCGPLAYER_MAGIC_CSV_HEADERS.filter((header) => !normalized.has(header)),
    extra: headers.filter((header) => !expected.has(header.trim())),
  };
}

export async function* parseTcgplayerMagicCsv(
  source: string | ReadableStream<Uint8Array>,
): AsyncGenerator<Record<TcgplayerMagicCsvHeader, string>, void, void> {
  const iterator = parseCsvRows(source);
  const first = await iterator.next();
  if (first.done) throw new Error("The CSV is empty.");
  const headers = first.value.map((header) => header.trim());
  const validation = validateTcgplayerMagicHeaders(headers);
  if (!validation.ok) {
    throw new Error(`Missing required TCGplayer CSV headers: ${validation.missing.join(", ")}`);
  }

  for await (const row of iterator) {
    if (!row.some((cell) => cell.trim())) continue;
    const record = Object.fromEntries(
      TCGPLAYER_MAGIC_CSV_HEADERS.map((header) => [
        header,
        row[headers.indexOf(header)]?.trim() ?? "",
      ]),
    ) as Record<TcgplayerMagicCsvHeader, string>;
    yield record;
  }
}

export function mapTcgplayerMagicCsvRow(
  row: Record<TcgplayerMagicCsvHeader, string>,
  options: { rowNumber: number; importedAt?: string },
): ParsedCatalogRow {
  try {
    const tcgplayerId = Number.parseInt(row["TCGplayer Id"].replace(/[,\s]/g, ""), 10);
    if (!Number.isSafeInteger(tcgplayerId) || tcgplayerId <= 0) {
      throw new Error("TCGplayer Id must be a positive integer.");
    }
    if (row["Product Line"] !== "Magic") {
      throw new Error(`Unsupported product line: ${row["Product Line"] || "(blank)"}`);
    }
    if (!row["Set Name"] || !row["Product Name"]) {
      throw new Error("Set Name and Product Name are required.");
    }

    const condition = normalizeConditionFinish(row.Condition);
    const collectorNumber = row.Number.trim() || null;

    return {
      ok: true,
      record: {
        tcgplayer_id: tcgplayerId,
        product_line: "Magic",
        set_name: row["Set Name"],
        product_name: row["Product Name"],
        title: row.Title || null,
        collector_number: collectorNumber,
        rarity: row.Rarity || null,
        raw_condition: condition.rawCondition,
        condition: condition.condition,
        finish: condition.finish,
        normalized_set_name: normalizeSetName(row["Set Name"]),
        normalized_product_name: normalizeProductName(row["Product Name"]),
        normalized_collector_number: normalizeCollectorNumber(collectorNumber),
        normalized_condition: condition.normalizedCondition,
        normalized_finish: condition.normalizedFinish,
        tcg_market_price: parseNullableMoney(row["TCG Market Price"]),
        tcg_direct_low: parseNullableMoney(row["TCG Direct Low"]),
        tcg_low_price_with_shipping: parseNullableMoney(row["TCG Low Price With Shipping"]),
        tcg_low_price: parseNullableMoney(row["TCG Low Price"]),
        total_quantity: parseNullableInteger(row["Total Quantity"]),
        add_to_quantity: parseNullableInteger(row["Add to Quantity"]),
        tcg_marketplace_price: parseNullableMoney(row["TCG Marketplace Price"]),
        photo_url: row["Photo URL"] || null,
        source_imported_at: options.importedAt ?? new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      row: options.rowNumber,
      error: error instanceof Error ? error.message : "Malformed TCGplayer catalog row.",
    };
  }
}

async function* parseCsvRows(source: string | ReadableStream<Uint8Array>) {
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for await (const chunk of textChunks(source)) {
    for (let index = 0; index < chunk.length; index += 1) {
      const character = chunk[index];
      if (character === "\"" && quoted && chunk[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (character === "\"") {
        quoted = !quoted;
      } else if (character === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && chunk[index + 1] === "\n") index += 1;
        row.push(cell);
        yield row;
        row = [];
        cell = "";
      } else {
        cell += character;
      }
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    yield row;
  }
}

async function* textChunks(source: string | ReadableStream<Uint8Array>) {
  if (typeof source === "string") {
    yield source;
    return;
  }

  const reader = source.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
  const tail = decoder.decode();
  if (tail) yield tail;
}
