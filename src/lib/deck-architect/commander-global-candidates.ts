import { classifyCardRoles } from "./card-roles.ts";
import { normalizeCardKey } from "./ownership.ts";
import type {
  BuildIntentId,
  CollectionGraphCard,
  CommanderStrategyProfile,
  DeckArchitectRole,
} from "./types.ts";

type ScryfallCard = {
  id?: string;
  name?: string;
  type_line?: string;
  oracle_text?: string;
  mana_cost?: string;
  cmc?: number;
  color_identity?: string[];
  colors?: string[];
  legalities?: Record<string, string>;
  image_uris?: { normal?: string; large?: string };
  card_faces?: Array<{ image_uris?: { normal?: string; large?: string }; oracle_text?: string }>;
  prices?: { usd?: string | null; usd_foil?: string | null };
  set?: string;
  collector_number?: string;
  tcgplayer_id?: number;
};

export type CommanderCandidateProvider = {
  search: (query: string, limit: number) => Promise<CollectionGraphCard[]>;
};

export function commanderColorIdentityQuery(commander: CollectionGraphCard) {
  const colors = commander.colorIdentity ?? [];
  if (!colors.length) return "id<=c";
  return `id<=${colors.join("")}`;
}

export function commanderStrategyQueries(
  commander: CollectionGraphCard,
  strategy: CommanderStrategyProfile | null,
) {
  const color = commanderColorIdentityQuery(commander);
  const typal = strategy?.taxonomy?.typal?.[0] ?? creatureType(commander);
  const strategyTerms = [
    ...(strategy?.taxonomy?.strategies ?? []),
    ...(strategy?.taxonomy?.themes ?? []),
    ...(strategy?.taxonomy?.mechanics ?? []),
  ].map((value) => value.toLowerCase());
  const queries = [
    `${color} f:commander -is:digital`,
    `${color} f:commander (t:land or o:"add one mana" or o:treasure) -is:digital`,
    `${color} f:commander (o:"draw a card" or o:"exile the top" or o:"impulse") -is:digital`,
    `${color} f:commander (o:"destroy target" or o:"exile target" or o:"damage to any target") -is:digital`,
  ];
  if (typal) queries.unshift(`${color} f:commander (t:${typal} or o:${typal}) -is:digital`);
  if (strategyTerms.some((term) => term.includes("token"))) {
    queries.unshift(`${color} f:commander (o:"create" o:"token") -is:digital`);
  }
  if (strategyTerms.some((term) => term.includes("aristocrat") || term.includes("sacrifice"))) {
    queries.unshift(`${color} f:commander (o:"sacrifice" or o:"dies") -is:digital`);
  }
  if (strategyTerms.some((term) => term.includes("combo"))) {
    queries.unshift(`${color} f:commander (o:"untap" or o:"add" or o:"sacrifice") -is:digital`);
  }
  return [...new Set(queries)].slice(0, 7);
}

export async function fetchCommanderGlobalCandidates({
  commander,
  strategy,
  intentId,
  budgetCents,
  provider = scryfallCommanderProvider(),
}: {
  commander: CollectionGraphCard;
  strategy: CommanderStrategyProfile | null;
  intentId: BuildIntentId;
  budgetCents?: number | null;
  provider?: CommanderCandidateProvider;
}) {
  if (intentId === "no-purchases") return [];
  const rows: CollectionGraphCard[] = [];
  for (const query of commanderStrategyQueries(commander, strategy)) {
    rows.push(...await provider.search(query, 45));
  }
  const budgetDollars = typeof budgetCents === "number" ? budgetCents / 100 : null;
  const deduped = new Map<string, CollectionGraphCard>();
  for (const card of rows) {
    if (!commanderColorIdentityFits(card, commander)) continue;
    if (card.legalities?.commander && card.legalities.commander !== "legal") continue;
    if (intentId === "budget" && budgetDollars !== null && card.marketPrice !== null && (card.marketPrice ?? 0) > Math.max(5, budgetDollars / 4)) continue;
    const key = normalizeCardKey(card.name);
    if (!deduped.has(key)) deduped.set(key, card);
  }
  return [...deduped.values()]
    .map((card) => ({ card, score: scoreGlobalCandidate(card, strategy, intentId) }))
    .sort((left, right) => right.score - left.score || left.card.name.localeCompare(right.card.name))
    .map((entry) => entry.card)
    .slice(0, 160)
    .map((card) => ({
      ...card,
      inventoryId: card.inventoryId.startsWith("global:") ? card.inventoryId : `global:${card.inventoryId}`,
      quantityOwned: 0,
    }));
}

export function scryfallCommanderProvider(fetcher = fetch): CommanderCandidateProvider {
  return {
    async search(query, limit) {
      const params = new URLSearchParams({
        q: query,
        unique: "cards",
        order: "edhrec",
        dir: "desc",
      });
      const response = await fetcher(`https://api.scryfall.com/cards/search?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "TradingDocks-DeckArchitect/1.0",
        },
        next: { revalidate: 3600 },
      } as RequestInit);
      if (!response.ok) return [];
      const payload = await response.json() as { data?: ScryfallCard[] };
      return (payload.data ?? []).slice(0, limit).map(scryfallToCollectionCard).filter(Boolean) as CollectionGraphCard[];
    },
  };
}

export function scryfallToCollectionCard(card: ScryfallCard): CollectionGraphCard | null {
  if (!card.id || !card.name) return null;
  const face = card.card_faces?.find((entry) => entry.image_uris) ?? card;
  const oracleText = [
    card.oracle_text,
    ...(card.card_faces?.map((entry) => entry.oracle_text).filter(Boolean) ?? []),
  ].filter(Boolean).join("\n");
  return {
    inventoryId: `scryfall:${card.id}`,
    name: card.name,
    quantityOwned: 0,
    imageUri: face.image_uris?.normal ?? face.image_uris?.large ?? null,
    setCode: card.set ?? null,
    collectorNumber: card.collector_number ?? null,
    scryfallId: card.id,
    tcgplayerId: card.tcgplayer_id ?? null,
    typeLine: card.type_line ?? null,
    oracleText,
    manaCost: card.mana_cost ?? null,
    manaValue: card.cmc ?? null,
    colors: card.colors ?? [],
    colorIdentity: card.color_identity ?? [],
    legalities: card.legalities ?? {},
    marketPrice: price(card.prices?.usd) ?? price(card.prices?.usd_foil),
  };
}

export function commanderColorIdentityFits(card: Pick<CollectionGraphCard, "colorIdentity">, commander: Pick<CollectionGraphCard, "colorIdentity">) {
  const allowed = commander.colorIdentity ?? [];
  return (card.colorIdentity ?? []).every((color) => allowed.includes(color));
}

function scoreGlobalCandidate(
  card: CollectionGraphCard,
  strategy: CommanderStrategyProfile | null,
  intentId: BuildIntentId,
) {
  const roles = classifyCardRoles(card);
  const targetRoles = strategy?.roles ?? [];
  const text = `${card.name} ${card.typeLine ?? ""} ${card.oracleText ?? ""}`.toLowerCase();
  const strategyTerms = [
    ...(strategy?.taxonomy?.strategies ?? []),
    ...(strategy?.taxonomy?.themes ?? []),
    ...(strategy?.taxonomy?.typal ?? []),
    ...(strategy?.taxonomy?.mechanics ?? []),
  ].map((value) => value.toLowerCase());
  let score = 20;
  score += roles.filter((role) => targetRoles.includes(role)).length * 18;
  score += strategyTerms.filter((term) => term && text.includes(term.toLowerCase())).length * 10;
  const marketPrice = card.marketPrice ?? null;
  if (roles.includes("ramp")) score += 8;
  if (roles.includes("card-advantage")) score += 8;
  if (roles.includes("interaction")) score += 7;
  if (roles.includes("land")) score += 2;
  if (intentId === "budget" && marketPrice !== null && marketPrice <= 3) score += 12;
  if (intentId === "strongest-possible" && marketPrice !== null && marketPrice > 5) score += 3;
  return score;
}

function creatureType(commander: CollectionGraphCard) {
  const typeLine = commander.typeLine ?? "";
  const parts = typeLine.split(/\s+-\s+/);
  const types = parts[1]?.trim().split(/\s+/).filter(Boolean) ?? [];
  return types.find((type) => !["Human", "Wizard", "Warrior", "Soldier", "Shaman"].includes(type)) ?? types[0] ?? null;
}

function price(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
