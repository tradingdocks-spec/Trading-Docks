import type { DeckFormat } from "./types";

export const DECK_FORMATS: DeckFormat[] = [
  "EDH",
  "Pauper EDH",
  "Standard",
  "Modern",
  "Pioneer",
  "Legacy",
  "Vintage",
  "Alchemy",
  "Premodern",
  "Pauper",
];

export function normalizeDeckFormat(value: string): DeckFormat {
  const normalized = value.trim().toLowerCase();

  if (
    normalized === "commander" ||
    normalized === "edh" ||
    normalized === "commander / edh" ||
    normalized === "commander/edh"
  ) {
    return "EDH";
  }

  if (
    normalized === "pauper commander" ||
    normalized === "pauper edh" ||
    normalized === "pedh"
  ) {
    return "Pauper EDH";
  }

  return DECK_FORMATS.find((format) => format.toLowerCase() === normalized) ?? "EDH";
}

export function isCommanderDeckFormat(value: string): boolean {
  const format = normalizeDeckFormat(value);

  return format === "EDH" || format === "Pauper EDH";
}
