import { availableMoney, totalInventoryValue } from "../intelligence-provenance.ts";

export type CanonicalKey =
  | "location" | "name" | "set" | "setName" | "collectorNumber"
  | "condition" | "language" | "finish" | "quantity" | "regularQuantity"
  | "foilQuantity" | "addQuantity" | "tradeQuantity"
  | "totalInventoryValue" | "askingPrice" | "marketPrice" | "lowPrice" | "midPrice" | "costBasis" | "sku"
  | "scryfallId" | "oracleId" | "tcgplayerId" | "tcgplayerProductId"
  | "manaBoxId" | "mtgoId"
  | "rarity" | "signed" | "artistProof" | "altered" | "misprint"
  | "promo" | "textless" | "proxy" | "notes" | "colors" | "cmc"
  | "cardType" | "manaCost" | "purchaseDate" | "purchaseCurrency"
  | "variation" | "priceSource" | "imageUrl" | "productLine" | "title"
  | "directLowPrice";

export type CanonicalRow = Record<CanonicalKey, string>;
export type CsvTemplate = {
  id: string;
  name: string;
  headers: string[];
  columns: Array<[string, CanonicalKey]>;
};

export const CANONICAL_FIELDS: Array<{ key: CanonicalKey; label: string; required?: boolean }> = [
  { key: "name", label: "Card / product name", required: true },
  { key: "set", label: "Set code" },
  { key: "setName", label: "Set name" },
  { key: "collectorNumber", label: "Collector number" },
  { key: "condition", label: "Condition" },
  { key: "language", label: "Language" },
  { key: "finish", label: "Finish / foil" },
  { key: "quantity", label: "Quantity" },
  { key: "regularQuantity", label: "Regular quantity" },
  { key: "foilQuantity", label: "Foil quantity" },
  { key: "addQuantity", label: "Add to quantity" },
  { key: "tradeQuantity", label: "Trade quantity" },
  { key: "marketPrice", label: "Unit market value" },
  { key: "totalInventoryValue", label: "Total row market value" },
  { key: "askingPrice", label: "Owner unit asking price" },
  { key: "lowPrice", label: "Low price" },
  { key: "midPrice", label: "Mid price" },
  { key: "costBasis", label: "Cost / purchase price" },
  { key: "sku", label: "SKU" },
  { key: "scryfallId", label: "Scryfall ID" },
  { key: "oracleId", label: "Oracle ID" },
  { key: "tcgplayerId", label: "TCGplayer ID" },
  { key: "tcgplayerProductId", label: "TCGplayer product ID" },
  { key: "manaBoxId", label: "ManaBox ID" },
  { key: "mtgoId", label: "MTGO ID" },
  { key: "rarity", label: "Rarity" },
  { key: "signed", label: "Signed" },
  { key: "artistProof", label: "Artist proof" },
  { key: "altered", label: "Altered" },
  { key: "misprint", label: "Misprint" },
  { key: "promo", label: "Promo" },
  { key: "textless", label: "Textless" },
  { key: "proxy", label: "Proxy" },
  { key: "location", label: "Source location" },
  { key: "notes", label: "Notes" },
  { key: "colors", label: "Colors" },
  { key: "cmc", label: "Mana value / CMC" },
  { key: "cardType", label: "Card type" },
  { key: "manaCost", label: "Mana cost" },
  { key: "purchaseDate", label: "Purchase date" },
  { key: "purchaseCurrency", label: "Purchase currency" },
  { key: "variation", label: "Variation" },
  { key: "priceSource", label: "Price source" },
  { key: "imageUrl", label: "Image / photo URL" },
  { key: "productLine", label: "Product line" },
  { key: "title", label: "Listing title" },
  { key: "directLowPrice", label: "Direct low price" },
];

export const CSV_TEMPLATES: CsvTemplate[] = [
  template("tcg-archivist", "TCG Archivist", [
    ["Location", "location"], ["Name", "name"], ["Set code", "set"],
    ["Collector number", "collectorNumber"], ["Finish", "finish"],
    ["Quantity", "quantity"], ["Scryfall ID", "scryfallId"],
    ["Colors", "colors"], ["CMC", "cmc"], ["Type", "cardType"],
  ]),
  template("manabox", "ManaBox", [
    ["Name", "name"], ["Set code", "set"], ["Set name", "setName"],
    ["Collector number", "collectorNumber"], ["Foil", "finish"],
    ["Rarity", "rarity"], ["Quantity", "quantity"], ["ManaBox ID", "manaBoxId"],
    ["Scryfall ID", "scryfallId"], ["Purchase price", "costBasis"],
    ["Misprint", "misprint"], ["Altered", "altered"], ["Condition", "condition"],
    ["Language", "language"], ["Purchase price currency", "purchaseCurrency"],
  ]),
  template("cardsphere", "CardSphere", [
    ["Name", "name"], ["Set", "set"], ["Condition", "condition"],
    ["Language", "language"], ["Foil", "finish"], ["Quantity", "quantity"],
    ["Scryfall ID", "scryfallId"],
  ]),
  template("card-kingdom", "Card Kingdom", [
    ["Card Name", "name"], ["Edition", "set"], ["Foil", "finish"],
    ["Quantity", "quantity"],
  ]),
  template("mtgstocks", "MTGStocks", [
    ["Card", "name"], ["Set", "setName"], ["Quantity", "quantity"],
    ["Price", "marketPrice"], ["Condition", "condition"], ["Language", "language"],
    ["Foil", "finish"], ["Signed", "signed"],
  ]),
  template("mtgo", "MTGO", [
    ["Card Name", "name"], ["Quantity", "quantity"], ["ID #", "mtgoId"],
    ["Rarity", "rarity"], ["Set", "set"], ["Collector #", "collectorNumber"],
    ["Premium", "finish"],
  ]),
  template("mtg-manager", "MTG Manager", [
    ["Quantity", "quantity"], ["Name", "name"], ["Code", "set"],
    ["PurchasePrice", "costBasis"], ["Foil", "finish"],
    ["Condition", "condition"], ["Language", "language"], ["PurchaseDate", "purchaseDate"],
  ]),
  template("mtggoldfish", "MTGGoldfish", [
    ["Card", "name"], ["Set ID", "set"], ["Set Name", "setName"],
    ["Quantity", "quantity"], ["Foil", "finish"], ["Variation", "variation"],
    ["Collector Number", "collectorNumber"], ["Scryfall ID", "scryfallId"],
  ]),
  template("moxfield", "Moxfield", [
    ["Count", "quantity"], ["Tradelist Count", "tradeQuantity"], ["Name", "name"],
    ["Edition", "set"], ["Condition", "condition"], ["Language", "language"],
    ["Foil", "finish"], ["Alter", "altered"], ["Proxy", "proxy"],
    ["Purchase Price", "costBasis"], ["Collector Number", "collectorNumber"],
  ]),
  template("helvault", "Helvault", [
    ["collector_number", "collectorNumber"], ["extras", "notes"],
    ["language", "language"], ["name", "name"], ["oracle_id", "oracleId"],
    ["quantity", "quantity"], ["scryfall_id", "scryfallId"],
    ["set_code", "set"], ["set_name", "setName"],
  ]),
  template("dragon-shield", "Dragon Shield", [
    ["Folder Name", "location"], ["Quantity", "quantity"],
    ["Trade Quantity", "tradeQuantity"], ["Card Name", "name"],
    ["Set Code", "set"], ["Set Name", "setName"],
    ["Card Number", "collectorNumber"], ["Condition", "condition"],
    ["Printing", "finish"], ["Language", "language"],
    ["Price Bought", "costBasis"], ["Date Bought", "purchaseDate"],
    ["LOW", "lowPrice"], ["MID", "midPrice"],
    ["MARKET", "marketPrice"],
  ]),
  template("deck-builder", "Deck Builder", [
    ["Total Qty", "quantity"], ["Reg Qty", "regularQuantity"], ["Foil Qty", "foilQuantity"],
    ["Card", "name"], ["Set", "setName"], ["Mana Cost", "manaCost"],
    ["Card Type", "cardType"], ["Color", "colors"], ["Rarity", "rarity"],
    ["Mvid", "tcgplayerId"], ["Single Price", "marketPrice"],
    ["Single Foil Price", "marketPrice"], ["Total Price", "totalInventoryValue"],
    ["Price Source", "priceSource"], ["Notes", "notes"],
  ]),
  template("deckbox", "Deckbox", [
    ["Count", "quantity"], ["Tradelist Count", "tradeQuantity"], ["Name", "name"],
    ["Edition", "setName"], ["Card Number", "collectorNumber"],
    ["Condition", "condition"], ["Language", "language"], ["Foil", "finish"],
    ["Signed", "signed"], ["Artist Proof", "artistProof"],
    ["Altered Art", "altered"], ["Misprint", "misprint"], ["Promo", "promo"],
    ["Textless", "textless"], ["My Price", "askingPrice"],
  ]),
  template("tcgplayer", "TCGplayer", [
    ["TCGplayer Id", "tcgplayerId"], ["Product Line", "productLine"],
    ["Set Name", "setName"], ["Product Name", "name"], ["Title", "title"],
    ["Number", "collectorNumber"],
    ["Rarity", "rarity"], ["Condition", "condition"],
    ["TCG Market Price", "marketPrice"], ["TCG Direct Low", "directLowPrice"],
    ["TCG Low Price With Shipping", "lowPrice"], ["TCG Low Price", "lowPrice"],
    ["Total Quantity", "quantity"], ["Add to Quantity", "addQuantity"],
    ["TCG Marketplace Price", "askingPrice"], ["Photo URL", "imageUrl"],
  ]),
  template("trading-docks", "Trading Docks Universal", [
    ["Location", "location"], ["Name", "name"], ["Set Code", "set"],
    ["Set Name", "setName"], ["Collector Number", "collectorNumber"],
    ["Condition", "condition"], ["Language", "language"], ["Finish", "finish"],
    ["Quantity", "quantity"], ["Market Price", "marketPrice"],
    ["Cost Basis", "costBasis"], ["SKU", "sku"], ["Scryfall ID", "scryfallId"],
    ["TCGplayer ID", "tcgplayerId"], ["TCGplayer Product ID", "tcgplayerProductId"],
  ]),
];

export function detectTemplate(headers: string[]) {
  const normalized = new Set(headers.map(normalizeHeader));
  return [...CSV_TEMPLATES]
    .map((item) => ({
      item,
      score: item.headers.filter((header) => normalized.has(normalizeHeader(header))).length /
        Math.max(item.headers.length, 1),
    }))
    .sort((a, b) => b.score - a.score)[0];
}

export function mappingForTemplate(headers: string[], selected?: CsvTemplate) {
  const templateMatch = selected ?? detectTemplate(headers).item;
  const byNormalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const mapped = Object.fromEntries(CANONICAL_FIELDS.map(({ key }) => [key, ""])) as Record<CanonicalKey, string>;
  templateMatch.columns.forEach(([header, key]) => {
    const actual = byNormalized.get(normalizeHeader(header));
    if (actual) mapped[key] = actual;
  });
  return mapped;
}

export function outputForTemplate(rows: Array<CanonicalRow & { tcgplayerPrinting?: Pick<CanonicalRow, "name" | "setName" | "collectorNumber"> }>, templateId: string) {
  const selected = CSV_TEMPLATES.find((item) => item.id === templateId) ?? CSV_TEMPLATES.at(-1)!;
  const exportRows = selected.id === "tcgplayer" ? dedupeTcgplayerRows(rows) : rows;
  return {
    headers: selected.headers,
    values: exportRows.map((source) => {
      const row = selected.id === "tcgplayer" ? { ...source, ...source.tcgplayerPrinting } : source;
      return selected.columns.map(([header, key]) => outputValue(row, key, selected.id, header));
    }),
  };
}

function dedupeTcgplayerRows<T extends CanonicalRow & { tcgplayerPrinting?: Pick<CanonicalRow, "name" | "setName" | "collectorNumber"> }>(rows: T[]) {
  const result: T[] = [];
  const byId = new Map<string, T>();
  for (const row of rows) {
    const id = (row.tcgplayerId ?? "").trim();
    const copy = { ...row } as T;
    if (!id || !byId.has(id)) {
      result.push(copy);
      if (id) byId.set(id, copy);
      continue;
    }
    const existing = byId.get(id)!;
    for (const key of ["askingPrice", "marketPrice", "lowPrice", "directLowPrice", "imageUrl", "title", "rarity", "productLine"] as CanonicalKey[]) {
      if (!existing[key] && row[key]) existing[key] = row[key];
    }
    for (const key of ["quantity", "addQuantity", "regularQuantity", "foilQuantity", "tradeQuantity"] as CanonicalKey[]) {
      const current = Number.parseInt(existing[key], 10);
      const additional = Number.parseInt(row[key], 10);
      if (Number.isFinite(additional)) existing[key] = String((Number.isFinite(current) ? current : 0) + additional);
    }
  }
  return result;
}

function outputValue(row: CanonicalRow, key: CanonicalKey, templateId: string, header: string) {
  if (templateId === "tcgplayer" && header === "TCG Marketplace Price") {
    // Export explicit owner pricing only; market references are not listing instructions.
    return row.askingPrice || "";
  }
  const value = row[key] ?? "";
  if (key === "finish") {
    const normalizedFinish = value.trim().toLowerCase();
    const foil =
      !["nonfoil", "non-foil", "normal", "regular", "false", "no", "0"].includes(normalizedFinish) &&
      /foil|etched|premium|true|yes|1/i.test(value);
    if (templateId === "tcg-archivist") return foil ? "foil" : "normal";
    if (templateId === "mtggoldfish") return foil ? "FOIL" : "REGULAR";
    if (templateId === "mtgo") return foil ? "Yes" : "No";
    if (templateId === "dragon-shield") return foil ? "Foil" : "Normal";
    if (["card-kingdom", "mtg-manager"].includes(templateId)) return foil ? "1" : "0";
    if (["cardsphere", "manabox", "moxfield", "deckbox"].includes(templateId)) {
      return normalizedFinish.includes("etched") ? "etched" : foil ? "foil" : "";
    }
  }
  if (header === "Add to Quantity") return row.addQuantity || row.quantity || "1";
  return value;
}

function template(id: string, name: string, columns: Array<[string, CanonicalKey]>): CsvTemplate {
  return { id, name, headers: columns.map(([header]) => header), columns };
}
function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** An explicit CSV row total wins; malformed explicit totals stay unresolved. */
export function inventoryValueForCsvRow(row: Partial<CanonicalRow>, quantity: number): number | null {
  return String(row.totalInventoryValue ?? '').trim()
    ? availableMoney(row.totalInventoryValue)
    : totalInventoryValue(row.marketPrice, quantity);
}
