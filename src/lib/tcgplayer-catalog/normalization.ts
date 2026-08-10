export type TcgplayerCondition =
  | "Near Mint"
  | "Lightly Played"
  | "Moderately Played"
  | "Heavily Played"
  | "Damaged"
  | "Unopened";

export type TcgplayerFinish = "Normal" | "Foil" | "Unopened";

export type NormalizedConditionFinish = {
  rawCondition: string;
  condition: TcgplayerCondition;
  finish: TcgplayerFinish;
  normalizedCondition: string;
  normalizedFinish: string;
};

const CONDITION_ALIASES: Record<string, TcgplayerCondition> = {
  "near mint": "Near Mint",
  nm: "Near Mint",
  "lightly played": "Lightly Played",
  lp: "Lightly Played",
  "moderately played": "Moderately Played",
  mp: "Moderately Played",
  "heavily played": "Heavily Played",
  hp: "Heavily Played",
  damaged: "Damaged",
  dmg: "Damaged",
  unopened: "Unopened",
};

export function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[^a-zA-Z0-9'#/+.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeCollectorNumber(value: unknown) {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();

  return normalized || null;
}

export function normalizeSetName(value: unknown) {
  return normalizeSearchText(value);
}

export function normalizeProductName(value: unknown) {
  return normalizeSearchText(value);
}

export function normalizeConditionFinish(value: unknown): NormalizedConditionFinish {
  const rawCondition = String(value ?? "").replace(/\s+/g, " ").trim();
  const lower = rawCondition.toLowerCase();
  const isFoil = /\bfoil\b/.test(lower);
  const withoutFoil = lower.replace(/\bfoil\b/g, "").replace(/\s+/g, " ").trim();
  const condition = CONDITION_ALIASES[withoutFoil] ?? CONDITION_ALIASES[lower];

  if (!condition) {
    throw new Error(`Unsupported TCGplayer condition: ${rawCondition || "(blank)"}`);
  }

  const finish: TcgplayerFinish = condition === "Unopened"
    ? "Unopened"
    : isFoil
      ? "Foil"
      : "Normal";

  return {
    rawCondition,
    condition,
    finish,
    normalizedCondition: normalizeSearchText(condition),
    normalizedFinish: normalizeSearchText(finish),
  };
}

export function parseNullableMoney(value: unknown) {
  const text = String(value ?? "").replace(/[$,\s]/g, "");
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

export function parseNullableInteger(value: unknown) {
  const text = String(value ?? "").replace(/[,\s]/g, "");
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
