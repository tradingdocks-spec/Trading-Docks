import {
  loadLorcana,
} from "./adapters/lorcana";
import {
  loadMagic,
} from "./adapters/magic";
import {
  loadOnePiece,
} from "./adapters/one-piece";
import {
  loadPokemon,
} from "./adapters/pokemon";
import {
  fallbackCards,
} from "./fallbacks";
import type {
  GameId,
  MarketCard,
  MarketPayload,
} from "./types";

export const MARKET_REFRESH_SECONDS = 300;

export async function loadMarketPayload(
  requestedGame?: GameId,
): Promise<MarketPayload> {
  const games: GameId[] = requestedGame
    ? [requestedGame]
    : [
        "magic",
        "pokemon",
        "lorcana",
        "one-piece",
      ];

  const entries = await Promise.all(
    games.map(async (game) => [
      game,
      await safeLoad(game),
    ] as const),
  );

  const empty = {
    magic: [],
    pokemon: [],
    lorcana: [],
    "one-piece": [],
  } satisfies Record<GameId, MarketCard[]>;

  return {
    updatedAt: new Date().toISOString(),
    refreshSeconds: MARKET_REFRESH_SECONDS,
    games: {
      ...empty,
      ...Object.fromEntries(entries),
    },
  };
}

async function safeLoad(
  game: GameId,
): Promise<MarketCard[]> {
  try {
    if (game === "magic") return await loadMagic();
    if (game === "pokemon") return await loadPokemon();
    if (game === "lorcana") return await loadLorcana();
    return await loadOnePiece();
  } catch (error) {
    console.error(
      `${game} market adapter failed:`,
      error,
    );

    return fallbackCards(game);
  }
}

export type {
  GameId,
  MarketCard,
  MarketPayload,
} from "./types";
