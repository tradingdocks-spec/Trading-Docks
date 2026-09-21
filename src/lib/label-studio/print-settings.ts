export const PRINT_FIELDS = [
  "name",
  "printing",
  "details",
  "game",
  "price",
  "location",
  "batch",
  "store",
] as const;
export type PrintField = (typeof PRINT_FIELDS)[number];
export type PrintSettings = {
  useUpc?: boolean;
  fields: PrintField[];
  fontPt: number;
  priceEmphasis: boolean;
  humanReadable: boolean;
  storeName: string;
  border: boolean;
  mode: "roll" | "sheet";
  sheet: {
    width: number;
    height: number;
    rows: number;
    columns: number;
    margin: number;
    gapX: number;
    gapY: number;
  };
};
export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  fields: ["name", "printing", "details", "price"],
  fontPt: 7,
  priceEmphasis: false,
  humanReadable: true,
  storeName: "Trading Docks",
  border: false,
  mode: "roll",
  sheet: {
    width: 215.9,
    height: 279.4,
    rows: 10,
    columns: 3,
    margin: 12.7,
    gapX: 3,
    gapY: 0,
  },
};
export type LabelTarget = {
  upc?: string | null;
  game?: string | null;
  key: string;
  itemId: string;
  positionId: string | null;
  name: string;
  set: string | null;
  number: string | null;
  condition: string | null;
  finish: string | null;
  language: string | null;
  location: string;
  batch: string | null;
  quantity: number;
  price: number | null;
  sku: string | null;
  identityId: string | null;
  qrToken: string | null;
};
export type PrintQueueEntry = { target: LabelTarget; copies: number };
export function validatePrintSettings(
  value: PrintSettings | undefined,
): string[] {
  if (!value) return [];
  if (typeof value !== "object" || Array.isArray(value))
    return ["Invalid print settings"];
  const errors: string[] = [];
  if (
    !Array.isArray(value.fields) ||
    value.fields.length > 8 ||
    new Set(value.fields).size !== value.fields.length ||
    value.fields.some((f) => !PRINT_FIELDS.includes(f))
  )
    errors.push("Invalid visible fields");
  if (!Number.isFinite(value.fontPt) || value.fontPt < 6 || value.fontPt > 14)
    errors.push("Font must be 6–14 pt");
  if (typeof value.storeName !== "string" || value.storeName.length > 80)
    errors.push("Store name must be at most 80 characters");
  if (!["roll", "sheet"].includes(value.mode))
    errors.push("Invalid print mode");
  for (const key of ["border", "humanReadable", "priceEmphasis"] as const)
    if (typeof value[key] !== "boolean") errors.push("Invalid print switch");
  const s = value.sheet;
  if (
    !s ||
    ![s.width, s.height, s.rows, s.columns, s.margin, s.gapX, s.gapY].every(
      Number.isFinite,
    ) ||
    s.width < 50 ||
    s.width > 500 ||
    s.height < 50 ||
    s.height > 500 ||
    !Number.isInteger(s.rows) ||
    !Number.isInteger(s.columns) ||
    s.rows < 1 ||
    s.rows > 30 ||
    s.columns < 1 ||
    s.columns > 10 ||
    s.margin < 0 ||
    s.margin > 50 ||
    s.gapX < 0 ||
    s.gapX > 50 ||
    s.gapY < 0 ||
    s.gapY > 50
  )
    errors.push("Invalid sheet dimensions");
  return errors;
}
