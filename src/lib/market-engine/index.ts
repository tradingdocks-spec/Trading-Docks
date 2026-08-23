import { loadLorcana } from "./adapters/lorcana";
import { loadMagic } from "./adapters/magic";
import { loadOnePiece } from "./adapters/one-piece";
import { loadPokemon } from "./adapters/pokemon";
import { loadPokemonJapan } from "./adapters/pokemon-japan";
import { fallbackCards } from "./fallbacks";
import type {
  GameId,
  MarketCard,
  MarketGameStatus,
  MarketPayload,
} from "./types";

export const MARKET_REFRESH_SECONDS = 300;
export const MARKET_ADAPTER_TIMEOUT_MS = 4_000;

const ALL_GAMES: GameId[] = [
  "magic",
  "pokemon",
  "pokemon-japan",
  "lorcana",
  "one-piece",
];

const GAME_LABELS: Record<GameId, string> = {
  magic: "Magic: The Gathering",
  pokemon: "Pokémon",
  "pokemon-japan": "Pokémon Japan",
  lorcana: "Disney Lorcana",
  "one-piece": "One Piece",
};

export async function loadMarketPayload(
  requestedGame?: GameId,
): Promise<MarketPayload> {
  const requestedGames: GameId[] = requestedGame
    ? [requestedGame]
    : ALL_GAMES;

  const loadedEntries: Array<
    readonly [GameId, MarketCard[]]
  > = await Promise.all(
    requestedGames.map(
      async (game): Promise<
        readonly [GameId, MarketCard[]]
      > => [game, await safeLoad(game)] as const,
    ),
  );

  const gameData: Record<GameId, MarketCard[]> = {
    magic: [],
    pokemon: [],
    "pokemon-japan": [],
    lorcana: [],
    "one-piece": [],
  };

  for (const [game, cards] of loadedEntries) {
    gameData[game] = cards;
  }

  const status: Record<GameId, MarketGameStatus> = {
    magic: createGameStatus("magic", gameData.magic),
    pokemon: createGameStatus(
      "pokemon",
      gameData.pokemon,
    ),
    "pokemon-japan": createGameStatus(
      "pokemon-japan",
      gameData["pokemon-japan"],
    ),
    lorcana: createGameStatus(
      "lorcana",
      gameData.lorcana,
    ),
    "one-piece": createGameStatus(
      "one-piece",
      gameData["one-piece"],
    ),
  };

  return {
    updatedAt: new Date().toISOString(),
    refreshSeconds: MARKET_REFRESH_SECONDS,
    games: gameData,
    status,
  };
}

function createGameStatus(
  game: GameId,
  cards: MarketCard[],
): MarketGameStatus {
  const firstCard: MarketCard | undefined = cards[0];

  return {
    game,
    label: GAME_LABELS[game],
    source: firstCard?.source ?? "Unavailable",
    dataQuality:
      firstCard?.dataQuality ?? "fallback",
    cardCount: cards.length,
  };
}

async function safeLoad(
  game: GameId,
): Promise<MarketCard[]> {
  try {
    if (game === "magic") {
      return await withMarketAdapterTimeout(loadMagic(), game);
    }

    if (game === "pokemon") {
      return await withMarketAdapterTimeout(loadPokemon(), game);
    }

    if (game === "pokemon-japan") {
      return await withMarketAdapterTimeout(loadPokemonJapan(), game);
    }

    if (game === "lorcana") {
      return await withMarketAdapterTimeout(loadLorcana(), game);
    }

    return await withMarketAdapterTimeout(loadOnePiece(), game);
  } catch (error) {
    console.error(
      `${game} market adapter failed:`,
      error,
    );

    return fallbackCards(game);
  }
}

async function withMarketAdapterTimeout(
  promise: Promise<MarketCard[]>,
  game: GameId,
): Promise<MarketCard[]> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<MarketCard[]>((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            new Error(
              `${game} market adapter timed out after ${MARKET_ADAPTER_TIMEOUT_MS}ms.`,
            ),
          );
        }, MARKET_ADAPTER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export type {
  GameId,
  MarketCard,
  MarketGameStatus,
  MarketPayload,
} from "./types";
