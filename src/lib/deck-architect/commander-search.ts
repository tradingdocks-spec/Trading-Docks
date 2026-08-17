import { isCommanderEligible } from "./formats.ts";
import type { CollectionGraphCard, RecommendationSignal } from "./types.ts";

export type CommanderSearchMatchCategory =
  | "exact"
  | "prefix"
  | "word-prefix"
  | "contains"
  | "fuzzy"
  | "metadata";

export type RankedCommanderSearchResult = {
  card: CollectionGraphCard;
  category: CommanderSearchMatchCategory;
  score: number;
  diagnostics: {
    query: string;
    normalizedName: string;
    category: CommanderSearchMatchCategory;
    score: number;
  };
  signals: RecommendationSignal[];
};

const STRONG_CATEGORIES = new Set<CommanderSearchMatchCategory>([
  "exact",
  "prefix",
  "word-prefix",
  "contains",
  "fuzzy",
]);

export function normalizeCommanderSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['\u2019]/g, "")
    .replace(/[-_/,:;()[\]{}]/g, " ")
    .replace(/\bthe\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function rankCommanderSearchResults(
  cards: CollectionGraphCard[],
  query: string,
  options: { limit?: number; includeMetadataFallback?: boolean } = {},
): RankedCommanderSearchResult[] {
  const normalizedQuery = normalizeCommanderSearchText(query);
  if (normalizedQuery.length < 2) return [];
  const ranked = cards
    .filter(isCommanderEligible)
    .map((card) => rankCommanderCard(card, normalizedQuery, Boolean(options.includeMetadataFallback)))
    .filter((result): result is RankedCommanderSearchResult => Boolean(result))
    .sort((left, right) => right.score - left.score || left.card.name.localeCompare(right.card.name));

  const hasStrongNameMatch = ranked.some((result) => STRONG_CATEGORIES.has(result.category));
  const filtered = hasStrongNameMatch
    ? ranked.filter((result) => STRONG_CATEGORIES.has(result.category))
    : ranked;
  return filtered.slice(0, options.limit ?? 12);
}

function rankCommanderCard(
  card: CollectionGraphCard,
  normalizedQuery: string,
  includeMetadataFallback: boolean,
): RankedCommanderSearchResult | null {
  const normalizedName = normalizeCommanderSearchText(card.name);
  const compactName = normalizedName.replace(/\s+/g, "");
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  let category: CommanderSearchMatchCategory | null = null;
  let score = 0;

  if (normalizedName === normalizedQuery || compactName === compactQuery) {
    category = "exact";
    score = 1000;
  } else if (normalizedName.startsWith(normalizedQuery) || compactName.startsWith(compactQuery)) {
    category = "prefix";
    score = 900;
  } else if (normalizedName.split(" ").some((word) => word.startsWith(normalizedQuery))) {
    category = "word-prefix";
    score = 820;
  } else if (normalizedName.includes(normalizedQuery) || compactName.includes(compactQuery)) {
    category = "contains";
    score = 720;
  } else {
    const distance = boundedLevenshtein(compactName, compactQuery, 2);
    if (compactQuery.length >= 4 && distance <= 2) {
      category = "fuzzy";
      score = 610 - distance * 40;
    }
  }

  if (!category && includeMetadataFallback) {
    const haystack = normalizeCommanderSearchText(`${card.typeLine ?? ""} ${card.oracleText ?? ""} ${card.setCode ?? ""}`);
    if (haystack.includes(normalizedQuery)) {
      category = "metadata";
      score = 220;
    }
  }
  if (!category) return null;

  const exactPrintingBonus = card.quantityOwned > 0 ? 15 : 0;
  const finalScore = score + exactPrintingBonus;
  return {
    card,
    category,
    score: finalScore,
    diagnostics: {
      query: normalizedQuery,
      normalizedName,
      category,
      score: finalScore,
    },
    signals: [{
      label: "Name relevance",
      impact: category === "metadata" ? "neutral" : "positive",
      detail: `${card.name} matched by ${category.replace("-", " ")}.`,
    }],
  };
}

function boundedLevenshtein(left: string, right: string, maxDistance: number) {
  if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMin = current[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const value = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + cost,
      );
      current[rightIndex] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}
