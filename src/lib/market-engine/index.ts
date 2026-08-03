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
  const games: GameId[] = requestedGame
    ? [requestedGame]
    : ["magic", "pokemon", "pokemon-japan", "lorcana", "one-piece"];

  const entries = await Promise.all(
    games.map(async (game) => [game, await safeLoad(game)] as const),
  );

  const empty = {
    magic: [],
    pokemon: [],
    "pokemon-japan": [],
    lorcana: [],
    "one-piece": [],
  } satisfies Record<GameId, MarketCard[]>;

  const gameData = {
    ...empty,
    ...Object.fromEntries(entries),
  };

  const status = Object.fromEntries(
    (Object.keys(gameData) as GameId[]).map((game) => {
      const cards = gameData[game];
      const first = cards[0];
      return [
        game,
        {
          game,
          label: GAME_LABELS[game],
          source: first?.source ?? "Unavailable",
          dataQuality: first?.dataQuality ?? "fallback",
          cardCount: cards.length,
        } satisfies MarketGameStatus,
      ];
    }),
  ) as Record<GameId, MarketGameStatus>;

  return {
    updatedAt: new Date().toISOString(),
    refreshSeconds: MARKET_REFRESH_SECONDS,
    games: gameData,
    status,
  };
}

async function safeLoad(game: GameId): Promise<MarketCard[]> {
  try {
    if (game === "magic") return await loadMagic();
    if (game === "pokemon") return await loadPokemon();
    if (game === "pokemon-japan") return await loadPokemonJapan();
    if (game === "lorcana") return await loadLorcana();
    return await loadOnePiece();
  } catch (error) {
    console.error(`${game} market adapter failed:`, error);
    return fallbackCards(game);
  }
}

export type {
  GameId,
  MarketCard,
  MarketGameStatus,
  MarketPayload,
} from "./types";
