import type {
  ComboKnowledgeProvider,
  ComboRecommendation,
  DeckComboResult,
  NearComboResult,
} from "./types.ts";

type SpellbookCard = {
  card?: { name?: string; imageUriFrontNormal?: string | null; colorIdentity?: string[] };
  quantity?: number;
  mustBeCommander?: boolean;
};

type SpellbookVariant = {
  id?: string;
  status?: string;
  uses?: SpellbookCard[];
  produces?: Array<{ feature?: { name?: string } }>;
  requires?: Array<{ template?: { name?: string } }>;
  description?: string;
  easyPrerequisites?: string;
  notablePrerequisites?: string;
  manaNeeded?: string;
  popularity?: number | null;
  bracketTag?: string;
  legalities?: { commander?: boolean; pauperCommander?: boolean };
};

type SpellbookPayload = {
  results?: {
    included?: SpellbookVariant[];
    almostIncluded?: SpellbookVariant[];
  };
};

type SpellbookProviderOptions = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  cacheTtlMs?: number;
  timeoutMs?: number;
  now?: () => number;
  logger?: Pick<Console, "info" | "warn" | "error">;
};

const DEFAULT_ENDPOINT = "https://backend.commanderspellbook.com/find-my-combos?limit=24&groupByCombo=true";
const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;

const cache = new Map<string, { expiresAt: number; result: DeckComboResult }>();

export class CommanderSpellbookProvider implements ComboKnowledgeProvider {
  private endpoint: string;
  private fetchImpl: typeof fetch;
  private cacheTtlMs: number;
  private timeoutMs: number;
  private now: () => number;
  private logger: Pick<Console, "info" | "warn" | "error">;

  constructor(options: SpellbookProviderOptions = {}) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.timeoutMs = options.timeoutMs ?? 12000;
    this.now = options.now ?? Date.now;
    this.logger = options.logger ?? console;
  }

  async findCombosForDeck(cardNames: string[], inventoryCardNames: string[] = []): Promise<DeckComboResult> {
    const started = this.now();
    const normalizedDeckNames = uniqueNames(cardNames);
    const normalizedInventoryNames = uniqueNames(inventoryCardNames);
    const cacheKey = JSON.stringify({ deck: normalizedDeckNames, inventory: normalizedInventoryNames });
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > this.now()) {
      this.logger.info("Commander Spellbook cache hit", { stage: "spellbook-cache", cardCount: normalizedDeckNames.length });
      return cached.result;
    }

    try {
      this.logger.info("Commander Spellbook request started", { stage: "spellbook-request", cardCount: normalizedDeckNames.length });
      const requestInit: RequestInit & { next?: { revalidate: number } } = {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          main: normalizedDeckNames.map((name) => ({ card: name, quantity: 1 })),
          commanders: [],
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
        next: { revalidate: Math.floor(this.cacheTtlMs / 1000) },
      };
      const response = await this.fetchImpl(this.endpoint, requestInit);

      if (!response.ok) {
        throw new Error(`Commander Spellbook returned HTTP ${response.status}.`);
      }

      const payload = await response.json() as SpellbookPayload;
      const result = normalizeSpellbookPayload(payload, normalizedDeckNames, normalizedInventoryNames);
      cache.set(cacheKey, { expiresAt: this.now() + this.cacheTtlMs, result });
      this.logger.info("Commander Spellbook request completed", {
        stage: "spellbook-response",
        latencyMs: this.now() - started,
        complete: result.summary.complete,
        nearCombos: result.summary.nearCombos,
      });
      return result;
    } catch (error) {
      this.logger.warn("Commander Spellbook unavailable", {
        stage: "spellbook-error",
        latencyMs: this.now() - started,
        message: error instanceof Error ? error.message : "Unknown Commander Spellbook error",
      });
      return unavailableComboResult("Combo data is temporarily unavailable. Deck generation can continue without combo enrichment.");
    }
  }

  async findCombosForCommander(commanderName: string): Promise<ComboRecommendation[]> {
    const result = await this.findCombosForDeck([commanderName]);
    return [...result.complete, ...result.nearCombos].filter((combo) =>
      combo.cards.some((card) => card.mustBeCommander || card.name.toLowerCase() === commanderName.toLowerCase()),
    );
  }

  async findNearCombos(cardNames: string[]): Promise<NearComboResult[]> {
    return (await this.findCombosForDeck(cardNames)).nearCombos;
  }
}

export const COMMANDER_SPELLBOOK_PROVIDER = new CommanderSpellbookProvider();

export function normalizeSpellbookPayload(
  payload: SpellbookPayload,
  deckCardNames: string[],
  inventoryCardNames: string[] = [],
): DeckComboResult {
  const deckNames = new Set(deckCardNames.map(key));
  const inventoryNames = new Set(inventoryCardNames.map(key));
  const results = payload?.results ?? {};
  const complete = uniqueVariants(results.included ?? [])
    .filter(legalCommanderVariant)
    .map((variant) => normalizeVariant(variant))
    .filter((combo) => combo.cards.every((card) => deckNames.has(key(card.name))))
    .slice(0, 12);
  const nearCombos = uniqueVariants(results.almostIncluded ?? [])
    .filter(legalCommanderVariant)
    .map((variant) => normalizeNearCombo(variant, deckNames, inventoryNames))
    .filter((combo) => combo.missingPieces.length > 0)
    .slice(0, 12);
  const fullyOwned = nearCombos
    .filter((combo) => combo.missingPieces.every((name) => inventoryNames.has(key(name))))
    .map((combo): ComboRecommendation => ({ ...combo, cards: combo.cards, results: combo.results }));
  const winLineCount = [...complete, ...nearCombos].filter((combo) => combo.winCondition).length;
  return {
    available: true,
    source: "Commander Spellbook",
    complete,
    fullyOwned,
    nearCombos,
    summary: {
      complete: complete.length,
      fullyOwned: fullyOwned.length,
      nearCombos: nearCombos.length,
      winLineCount,
    },
  };
}

export function unavailableComboResult(message: string): DeckComboResult {
  return {
    available: false,
    source: "Commander Spellbook",
    complete: [],
    fullyOwned: [],
    nearCombos: [],
    summary: { complete: 0, fullyOwned: 0, nearCombos: 0, winLineCount: 0 },
    message,
  };
}

function normalizeVariant(variant: SpellbookVariant): ComboRecommendation {
  const cards = (variant.uses ?? []).flatMap((use) => {
    const name = use.card?.name?.trim();
    if (!name) return [];
    return [{
      name,
      imageUri: use.card?.imageUriFrontNormal ?? null,
      mustBeCommander: Boolean(use.mustBeCommander),
    }];
  });
  const prerequisites = [variant.easyPrerequisites, variant.notablePrerequisites]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const results = (variant.produces ?? [])
    .map((item) => item.feature?.name?.trim())
    .filter((value): value is string => Boolean(value));
  return {
    id: variant.id ?? cards.map((card) => card.name).join("-"),
    source: "Commander Spellbook",
    cards,
    prerequisites,
    steps: (variant.description ?? "").split(/\n+/).map((step) => step.trim()).filter(Boolean),
    results,
    commanderRequirements: cards.filter((card) => card.mustBeCommander).map((card) => card.name),
    colorIdentity: [],
    legalities: {
      commander: Boolean(variant.legalities?.commander),
      pauperCommander: Boolean(variant.legalities?.pauperCommander),
    },
    popularity: variant.popularity ?? null,
    winCondition: results.some((result) => /infinite|win|damage|mill|draw|mana/i.test(result)),
    spellbookUrl: `https://commanderspellbook.com/combo/${encodeURIComponent(variant.id ?? "")}`,
  };
}

function normalizeNearCombo(variant: SpellbookVariant, deckNames: Set<string>, inventoryNames: Set<string>): NearComboResult {
  const combo = normalizeVariant(variant);
  const ownedPieces = combo.cards
    .filter((card) => deckNames.has(key(card.name)) || inventoryNames.has(key(card.name)))
    .map((card) => card.name);
  const missingPieces = combo.cards
    .filter((card) => !deckNames.has(key(card.name)))
    .map((card) => card.name);
  return { ...combo, ownedPieces, missingPieces };
}

function uniqueVariants(variants: SpellbookVariant[]) {
  return [...new Map(variants.map((variant) => [variant.id ?? JSON.stringify(variant.uses ?? []), variant])).values()];
}

function legalCommanderVariant(variant: SpellbookVariant) {
  return variant.status === "OK" && Boolean(variant.legalities?.commander);
}

function uniqueNames(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function key(value: string) {
  return value.trim().toLowerCase();
}
