import type {
  TcgTrackingPriceSnapshot,
  TcgTrackingProduct,
  TcgTrackingSealedProduct,
  TcgTrackingSet,
  TcgTrackingSku,
} from "../providers/tcgtracking/types.ts";
import {
  activeSupportedGames,
  POKEMON_GAME_ID,
  TCGTRACKING_POKEMON_CATEGORY_ID,
  type GameIdentity,
} from "./registry.ts";

export type MultiTcgProofClient = {
  categories: () => Promise<Array<{ id: string; name: string }>>;
  sets: (category: string) => Promise<TcgTrackingSet[]>;
  cards: (category: string, set: string) => Promise<TcgTrackingProduct[]>;
  sealed: (category: string, set: string) => Promise<TcgTrackingSealedProduct[]>;
  skus: (category: string, set: string) => Promise<TcgTrackingSku[]>;
  pricing: (category: string, set: string) => Promise<TcgTrackingPriceSnapshot[]>;
};

export type GameProviderProofResult = {
  gameId: string;
  displayName: string;
  categoryId?: string;
  status: "skipped" | "available" | "partial" | "failed";
  categoryFound: boolean;
  setCount: number;
  sampleSet?: {
    id: string;
    name: string;
    code?: string;
  };
  cardCount: number;
  sealedCount: number;
  skuCount: number;
  pricingCount: number;
  sampleProducts: Array<{
    name: string;
    tcgplayerProductId?: number;
    collectorNumber?: string;
    imageUrlAvailable: boolean;
  }>;
  sampleSealed: Array<{
    name: string;
    tcgplayerProductId?: number;
    productType?: string;
    imageUrlAvailable: boolean;
  }>;
  variants: string[];
  languages: string[];
  error?: string;
};

export type MultiTcgProviderProof = {
  checkedAt: string;
  games: GameProviderProofResult[];
  pokemonProof: GameProviderProofResult | null;
};

export async function runMultiTcgProviderProof(input: {
  client: MultiTcgProofClient;
  sampleLimit?: number;
}): Promise<MultiTcgProviderProof> {
  const sampleLimit = Math.max(1, Math.min(input.sampleLimit ?? 5, 10));
  const categories = await input.client.categories();
  const games: GameProviderProofResult[] = [];

  for (const game of activeSupportedGames()) {
    games.push(
      await proveGameProviderSupport({
        client: input.client,
        game,
        categories,
        sampleLimit,
      }),
    );
  }

  return {
    checkedAt: new Date().toISOString(),
    games,
    pokemonProof:
      games.find((result) => result.gameId === POKEMON_GAME_ID) ?? null,
  };
}

async function proveGameProviderSupport(input: {
  client: MultiTcgProofClient;
  game: GameIdentity;
  categories: Array<{ id: string; name: string }>;
  sampleLimit: number;
}): Promise<GameProviderProofResult> {
  const categoryId = input.game.tcgTrackingCategoryId;
  const base = baseResult(input.game);
  if (!categoryId) return base;

  const categoryFound = input.categories.some(
    (category) => category.id === categoryId,
  );

  try {
    const sets = await input.client.sets(categoryId);
    const sampleSet = chooseSampleSet(sets);
    if (!sampleSet) {
      return {
        ...base,
        status: categoryFound ? "partial" : "failed",
        categoryFound,
        setCount: sets.length,
        error: "No provider sets were returned for this category.",
      };
    }

    const [cards, sealed, skus, pricing] = await Promise.all([
      input.client.cards(categoryId, sampleSet.id),
      input.client.sealed(categoryId, sampleSet.id).catch(() => []),
      input.client.skus(categoryId, sampleSet.id).catch(() => []),
      input.client.pricing(categoryId, sampleSet.id).catch(() => []),
    ]);

    return {
      ...base,
      status: cards.length || sealed.length ? "available" : "partial",
      categoryFound,
      setCount: sets.length,
      sampleSet: {
        id: sampleSet.id,
        name: sampleSet.name,
        code: sampleSet.abbreviation,
      },
      cardCount: cards.length,
      sealedCount: sealed.length,
      skuCount: skus.length,
      pricingCount: pricing.length,
      sampleProducts: cards.slice(0, input.sampleLimit).map((product) => ({
        name: product.name,
        tcgplayerProductId: product.tcgplayerProductId,
        collectorNumber: product.collectorNumber,
        imageUrlAvailable: Boolean(product.imageUrl),
      })),
      sampleSealed: sealed.slice(0, input.sampleLimit).map((product) => ({
        name: product.name,
        tcgplayerProductId: product.tcgplayerProductId,
        productType: product.productType,
        imageUrlAvailable: Boolean(product.imageUrl),
      })),
      variants: unique(skus.map((sku) => sku.variant).filter(isPresent)),
      languages: unique(skus.map((sku) => sku.language).filter(isPresent)),
    };
  } catch (error) {
    return {
      ...base,
      status: "failed",
      categoryFound,
      error: error instanceof Error ? error.message : "Provider proof failed.",
    };
  }
}

function baseResult(game: GameIdentity): GameProviderProofResult {
  return {
    gameId: game.id,
    displayName: game.displayName,
    categoryId: game.tcgTrackingCategoryId,
    status: game.tcgTrackingCategoryId ? "failed" : "skipped",
    categoryFound: false,
    setCount: 0,
    cardCount: 0,
    sealedCount: 0,
    skuCount: 0,
    pricingCount: 0,
    sampleProducts: [],
    sampleSealed: [],
    variants: [],
    languages: [],
  };
}

function chooseSampleSet(sets: TcgTrackingSet[]) {
  return (
    sets.find((set) => set.categoryId === TCGTRACKING_POKEMON_CATEGORY_ID) ??
    sets[0] ??
    null
  );
}

function unique(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isPresent(value: string | undefined): value is string {
  return Boolean(value);
}
