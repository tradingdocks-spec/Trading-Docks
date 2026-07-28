export type CsvFormatId =
  | "auto"
  | "generic"
  | "tcg-archivist"
  | "manabox"
  | "cardsphere"
  | "card-kingdom"
  | "deckbox"
  | "decked-builder"
  | "dragon-shield"
  | "helvault"
  | "moxfield"
  | "mtg-goldfish"
  | "mtg-manager"
  | "mtg-stocks"
  | "mtgo"
  | "tcgplayer";

export type CardRow = {
  sourceRow: number;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  quantity: number;
  condition: string;
  language: string;
  finish: "normal" | "foil" | "etched" | "";
  scryfallId: string;
  tcgplayerId: string;
  rarity: string;
  price: string;
  purchasePrice: string;
  title: string;
  photoUrl: string;
  warnings: string[];
};

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

export type CsvFormat = {
  id: Exclude<CsvFormatId, "auto">;
  name: string;
  description: string;
  signature: string[];
};

export const CSV_FORMATS: CsvFormat[] = [
  { id: "generic", name: "Generic CSV", description: "Flexible name, set, quantity, and identifier columns", signature: [] },
  { id: "tcg-archivist", name: "TCG Archivist", description: "Location, printing, finish, and Scryfall identity", signature: ["Location", "Colors", "CMC", "Scryfall ID"] },
  { id: "manabox", name: "ManaBox", description: "Collection export with condition and purchase metadata", signature: ["ManaBox ID", "Purchase price currency", "Set code"] },
  { id: "cardsphere", name: "Cardsphere", description: "Compact collection and trading export", signature: ["Name", "Set", "Condition", "Scryfall ID"] },
  { id: "card-kingdom", name: "Card Kingdom", description: "Card name, edition, foil, and quantity", signature: ["Card Name", "Edition", "Foil", "Quantity"] },
  { id: "deckbox", name: "Deckbox", description: "Detailed collection and tradelist export", signature: ["Tradelist Count", "Artist Proof", "Textless"] },
  { id: "decked-builder", name: "Decked Builder", description: "Separate regular and foil quantities", signature: ["Total Qty", "Reg Qty", "Foil Qty", "Mvid"] },
  { id: "dragon-shield", name: "Dragon Shield", description: "Folder, printing, condition, and price data", signature: ["Folder Name", "Trade Quantity", "Printing", "MARKET"] },
  { id: "helvault", name: "Helvault", description: "Scryfall and Oracle identifiers", signature: ["oracle_id", "scryfall_id", "set_code"] },
  { id: "moxfield", name: "Moxfield", description: "Collection or deck export", signature: ["Count", "Edition", "Proxy", "Collector Number"] },
  { id: "mtg-goldfish", name: "MTGGoldfish", description: "Printing-level export with Scryfall ID", signature: ["Set ID", "Variation", "Scryfall ID"] },
  { id: "mtg-manager", name: "MTG Manager", description: "Mobile collection export with coded values", signature: ["PurchasePrice", "PurchaseDate", "Code"] },
  { id: "mtg-stocks", name: "MTGStocks", description: "Portfolio export with price and condition", signature: ["Card", "Set", "Price", "Signed"] },
  { id: "mtgo", name: "MTGO", description: "Digital inventory with MTGO identity", signature: ["ID #", "Collector #", "Premium"] },
  { id: "tcgplayer", name: "TCGplayer Seller", description: "Accepted 16-column seller inventory format", signature: ["TCGplayer Id", "Product Line", "TCG Market Price", "Add to Quantity"] },
];

const aliases: Record<string, string[]> = {
  name: ["name", "card", "card name", "product name"],
  setCode: ["set code", "set id", "code", "edition code"],
  setName: ["set name", "set", "edition"],
  collectorNumber: ["collector number", "collector #", "card number", "number"],
  quantity: ["quantity", "count", "total qty", "total quantity", "add to quantity"],
  condition: ["condition"],
  language: ["language"],
  finish: ["finish", "foil", "printing", "premium"],
  scryfallId: ["scryfall id", "scryfall_id"],
  tcgplayerId: ["tcgplayer id"],
  rarity: ["rarity"],
  price: ["tcg marketplace price", "tcg market price", "price", "market"],
  purchasePrice: ["purchase price", "purchaseprice", "price bought"],
  title: ["title"],
  photoUrl: ["photo url"],
};

function normalizeHeader(value: string) {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase();
}

export function parseCsv(text: string): ParsedCsv {
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((cell) => cell.trim())) matrix.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field.replace(/\r$/, ""));
  if (row.some((cell) => cell.trim())) matrix.push(row);

  const headers = (matrix.shift() ?? []).map((header) => header.trim().replace(/^\uFEFF/, ""));
  return {
    headers,
    rows: matrix.map((cells) =>
      Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""])),
    ),
  };
}

export function detectCsvFormat(headers: string[]): CsvFormat {
  const normalized = new Set(headers.map(normalizeHeader));
  const scored = CSV_FORMATS.filter((format) => format.id !== "generic").map((format) => ({
    format,
    score: format.signature.filter((header) => normalized.has(normalizeHeader(header))).length / format.signature.length,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 0.6 ? scored[0].format : CSV_FORMATS[0];
}

function value(row: Record<string, string>, field: keyof typeof aliases) {
  const entries = Object.entries(row);
  for (const alias of aliases[field]) {
    const match = entries.find(([header]) => normalizeHeader(header) === alias);
    if (match?.[1] !== undefined) return match[1].trim();
  }
  return "";
}

function normalizeCondition(input: string) {
  const key = input.trim().toLowerCase().replace(/[^a-z]/g, "");
  const values: Record<string, string> = {
    m: "Near Mint",
    mint: "Near Mint",
    nm: "Near Mint",
    nearmint: "Near Mint",
    lp: "Lightly Played",
    lightlyplayed: "Lightly Played",
    mp: "Moderately Played",
    moderatelyplayed: "Moderately Played",
    hp: "Heavily Played",
    heavilyplayed: "Heavily Played",
    dmg: "Damaged",
    damaged: "Damaged",
  };
  return values[key] ?? input.trim();
}

function normalizeLanguage(input: string) {
  const key = input.trim().toLowerCase();
  if (!key || key === "0" || key === "en" || key === "eng" || key === "english") return "English";
  return input.trim();
}

function normalizeFinish(input: string): CardRow["finish"] {
  const key = input.trim().toLowerCase();
  if (!key) return "";
  if (["1", "yes", "foil", "premium", "true"].includes(key)) return "foil";
  if (key.includes("etched")) return "etched";
  if (["0", "no", "normal", "regular", "nonfoil", "non-foil", "false"].includes(key)) return "normal";
  return "";
}

function baseRow(row: Record<string, string>, sourceRow: number): CardRow {
  const name = value(row, "name");
  const quantity = Math.max(0, Number.parseInt(value(row, "quantity") || "1", 10) || 0);
  const normalized: CardRow = {
    sourceRow,
    name,
    setCode: value(row, "setCode").toLowerCase(),
    setName: value(row, "setName"),
    collectorNumber: value(row, "collectorNumber"),
    quantity,
    condition: normalizeCondition(value(row, "condition")),
    language: normalizeLanguage(value(row, "language")),
    finish: normalizeFinish(value(row, "finish")),
    scryfallId: value(row, "scryfallId"),
    tcgplayerId: value(row, "tcgplayerId"),
    rarity: value(row, "rarity"),
    price: value(row, "price"),
    purchasePrice: value(row, "purchasePrice"),
    title: value(row, "title"),
    photoUrl: value(row, "photoUrl"),
    warnings: [],
  };
  if (!name) normalized.warnings.push("Missing card name");
  if (!quantity) normalized.warnings.push("Quantity must be greater than zero");
  if (!normalized.setCode && !normalized.setName && !normalized.scryfallId && !normalized.tcgplayerId) {
    normalized.warnings.push("Missing printing identifier");
  }
  if (!normalized.condition) normalized.warnings.push("Condition needs review");
  if (!normalized.finish) normalized.warnings.push("Finish needs review");
  return normalized;
}

export function normalizeRows(parsed: ParsedCsv, formatId: CsvFormatId): CardRow[] {
  const detected = formatId === "auto" ? detectCsvFormat(parsed.headers).id : formatId;
  return parsed.rows.flatMap((row, index) => {
    if (detected === "decked-builder") {
      const regular = Number.parseInt(row["Reg Qty"] || "0", 10) || 0;
      const foil = Number.parseInt(row["Foil Qty"] || "0", 10) || 0;
      const base = baseRow({ ...row, Quantity: String(regular || foil) }, index + 2);
      const results: CardRow[] = [];
      if (regular) results.push({ ...base, quantity: regular, finish: "normal", warnings: base.warnings.filter((item) => item !== "Finish needs review") });
      if (foil) results.push({ ...base, quantity: foil, finish: "foil", warnings: base.warnings.filter((item) => item !== "Finish needs review") });
      return results.length ? results : [base];
    }
    const normalized = baseRow(row, index + 2);
    if (detected === "cardsphere") normalized.setCode = row.Set?.toLowerCase() ?? normalized.setCode;
    if (detected === "card-kingdom") normalized.setCode = row.Edition?.toLowerCase() ?? normalized.setCode;
    if (detected === "moxfield") normalized.setCode = row.Edition?.toLowerCase() ?? normalized.setCode;
    if (detected === "mtgo") {
      normalized.setCode = row.Set?.toLowerCase() ?? normalized.setCode;
      normalized.setName = "";
    }
    if (detected === "tcgplayer") normalized.setName = row["Set Name"] ?? normalized.setName;
    if (normalized.setCode || normalized.setName || normalized.scryfallId || normalized.tcgplayerId) {
      normalized.warnings = normalized.warnings.filter((warning) => warning !== "Missing printing identifier");
    }
    return [normalized];
  });
}

export function applyDefaults(rows: CardRow[], condition: string, finish: CardRow["finish"], language: string) {
  return rows.map((row) => {
    const next = {
      ...row,
      condition: row.condition || condition,
      finish: row.finish || finish,
      language: row.language || language,
    };
    next.warnings = row.warnings.filter((warning) =>
      !((warning === "Condition needs review" && next.condition) ||
        (warning === "Finish needs review" && next.finish)),
    );
    return next;
  });
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function makeCsv(headers: string[], rows: string[][]) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function foilFlag(row: CardRow) {
  return row.finish === "foil" || row.finish === "etched";
}

export function exportCsv(rows: CardRow[], output: Exclude<CsvFormatId, "auto" | "generic">) {
  switch (output) {
    case "tcgplayer": {
      const headers = ["TCGplayer Id", "Product Line", "Set Name", "Product Name", "Title", "Number", "Rarity", "Condition", "TCG Market Price", "TCG Direct Low", "TCG Low Price With Shipping", "TCG Low Price", "Total Quantity", "Add to Quantity", "TCG Marketplace Price", "Photo URL"];
      return makeCsv(headers, rows.map((row) => [row.tcgplayerId, "Magic", row.setName, row.name, row.title, row.collectorNumber, row.rarity, row.condition, row.price, "", "", "", String(row.quantity), String(row.quantity), row.price, row.photoUrl]));
    }
    case "manabox":
      return makeCsv(["Name", "Set code", "Set name", "Collector number", "Foil", "Rarity", "Quantity", "ManaBox ID", "Scryfall ID", "Purchase price", "Misprint", "Altered", "Condition", "Language", "Purchase price currency"], rows.map((row) => [row.name, row.setCode, row.setName, row.collectorNumber, foilFlag(row) ? "foil" : "", row.rarity, String(row.quantity), "", row.scryfallId, row.purchasePrice, "", "", row.condition, row.language === "English" ? "en" : row.language, row.purchasePrice ? "USD" : ""]));
    case "cardsphere":
      return makeCsv(["Name", "Set", "Condition", "Language", "Foil", "Quantity", "Scryfall ID"], rows.map((row) => [row.name, row.setCode, abbreviationCondition(row.condition), row.language === "English" ? "en" : row.language, foilFlag(row) ? "foil" : "", String(row.quantity), row.scryfallId]));
    case "card-kingdom":
      return makeCsv(["Card Name", "Edition", "Foil", "Quantity"], rows.map((row) => [row.name, row.setCode || row.setName, foilFlag(row) ? "1" : "0", String(row.quantity)]));
    case "deckbox":
      return makeCsv(["Count", "Tradelist Count", "Name", "Edition", "Card Number", "Condition", "Language", "Foil", "Signed", "Artist Proof", "Altered Art", "Misprint", "Promo", "Textless", "My Price"], rows.map((row) => [String(row.quantity), "", row.name, row.setName || row.setCode, row.collectorNumber, row.condition, row.language, foilFlag(row) ? "foil" : "", "", "", "", "", "", "", row.price]));
    case "decked-builder":
      return makeCsv(["Total Qty", "Reg Qty", "Foil Qty", "Card", "Set", "Mana Cost", "Card Type", "Color", "Rarity", "Mvid", "Single Price", "Single Foil Price", "Total Price", "Price Source", "Notes"], rows.map((row) => [String(row.quantity), foilFlag(row) ? "0" : String(row.quantity), foilFlag(row) ? String(row.quantity) : "0", row.name, row.setName || row.setCode, "", "", "", row.rarity, "", foilFlag(row) ? "" : row.price, foilFlag(row) ? row.price : "", "", "", ""]));
    case "dragon-shield":
      return makeCsv(["Folder Name", "Quantity", "Trade Quantity", "Card Name", "Set Code", "Set Name", "Card Number", "Condition", "Printing", "Language", "Price Bought", "Date Bought", "LOW", "MID", "MARKET"], rows.map((row) => ["", String(row.quantity), "0", row.name, row.setCode, row.setName, row.collectorNumber, row.condition, foilFlag(row) ? "Foil" : "Normal", row.language, row.purchasePrice, "", "", "", row.price]));
    case "helvault":
      return makeCsv(["collector_number", "extras", "language", "name", "oracle_id", "quantity", "scryfall_id", "set_code", "set_name"], rows.map((row) => [row.collectorNumber, foilFlag(row) ? "foil" : "", row.language === "English" ? "en" : row.language, row.name, "", String(row.quantity), row.scryfallId, row.setCode, row.setName]));
    case "moxfield":
      return makeCsv(["Count", "Tradelist Count", "Name", "Edition", "Condition", "Language", "Foil", "Alter", "Proxy", "Purchase Price", "Collector Number"], rows.map((row) => [String(row.quantity), "", row.name, row.setCode || row.setName, row.condition, row.language, foilFlag(row) ? "foil" : "", "", "", row.purchasePrice, row.collectorNumber]));
    case "mtg-goldfish":
      return makeCsv(["Card", "Set ID", "Set Name", "Quantity", "Foil", "Variation", "Collector Number", "Scryfall ID"], rows.map((row) => [row.name, row.setCode, row.setName, String(row.quantity), foilFlag(row) ? "FOIL" : "REGULAR", "", row.collectorNumber, row.scryfallId]));
    case "mtg-manager":
      return makeCsv(["Quantity", "Name", "Code", "PurchasePrice", "Foil", "Condition", "Language", "PurchaseDate"], rows.map((row) => [String(row.quantity), row.name, row.setCode, row.purchasePrice, foilFlag(row) ? "1" : "0", abbreviationCondition(row.condition), row.language === "English" ? "0" : row.language, ""]));
    case "mtg-stocks":
      return makeCsv(["Card", "Set", "Quantity", "Price", "Condition", "Language", "Foil", "Signed"], rows.map((row) => [row.name, row.setName || row.setCode, String(row.quantity), row.price, abbreviationCondition(row.condition), row.language === "English" ? "en" : row.language, foilFlag(row) ? "Yes" : "No", "No"]));
    case "mtgo":
      return makeCsv(["Card Name", "Quantity", "ID #", "Rarity", "Set", "Collector #", "Premium"], rows.map((row) => [row.name, String(row.quantity), "", row.rarity, row.setCode, row.collectorNumber, foilFlag(row) ? "Yes" : "No"]));
    case "tcg-archivist":
      return makeCsv(["Location", "Name", "Set code", "Collector number", "Finish", "Quantity", "Scryfall ID", "Colors", "CMC", "Type"], rows.map((row) => ["", row.name, row.setCode, row.collectorNumber, row.finish || "normal", String(row.quantity), row.scryfallId, "", "", ""]));
  }
}

function abbreviationCondition(condition: string) {
  const map: Record<string, string> = {
    "Near Mint": "NM",
    "Lightly Played": "LP",
    "Moderately Played": "MP",
    "Heavily Played": "HP",
    Damaged: "DMG",
  };
  return map[condition] ?? condition;
}

export function blockingIssues(rows: CardRow[], output: CsvFormatId) {
  return rows.reduce((count, row) => {
    let issues = row.warnings.filter((warning) => warning !== "Condition needs review" && warning !== "Finish needs review").length;
    if (!row.condition) issues += 1;
    if (!row.finish) issues += 1;
    if (output === "tcgplayer" && !row.tcgplayerId) issues += 1;
    return count + issues;
  }, 0);
}
