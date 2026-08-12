import {
  activeSupportedGames,
  getSupportedGame,
  MAGIC_GAME_ID,
  POKEMON_GAME_ID,
  type GameIdentity,
  type SupportedGameId,
} from "./registry.ts";

export type GameContextId = "all" | SupportedGameId;

export type GameContextOption = {
  id: GameContextId;
  label: string;
  shortLabel: string;
  badge: string;
  status: "all" | GameIdentity["status"];
};

export type MarketSourceName =
  | "Scryfall"
  | "TCGplayer"
  | "Mana Pool"
  | "CardSphere"
  | "Cardmarket"
  | "TCGTracking";

const gameShortLabels: Partial<Record<SupportedGameId, string>> = {
  magic: "MTG",
  pokemon: "PKM",
};

const gameBadges: Partial<Record<SupportedGameId, string>> = {
  magic: "Magic",
  pokemon: "Pokemon Beta",
};

const variantLabels: Partial<Record<SupportedGameId, string[]>> = {
  magic: ["Nonfoil", "Foil", "Etched"],
  pokemon: ["Normal", "Holo", "Reverse Holo"],
};

const marketSources: Record<"magic" | "pokemon", MarketSourceName[]> = {
  magic: ["Scryfall", "TCGplayer", "Mana Pool", "CardSphere", "Cardmarket"],
  pokemon: ["TCGplayer", "TCGTracking", "Cardmarket"],
};

export function getGameContextOptions({
  includeAll = true,
}: {
  includeAll?: boolean;
} = {}): GameContextOption[] {
  const options = activeSupportedGames().map((game) => ({
    id: game.id,
    label: game.displayName,
    shortLabel: gameShortLabels[game.id] ?? game.displayName,
    badge: gameBadges[game.id] ?? game.displayName,
    status: game.status,
  }));

  return includeAll
    ? [
        {
          id: "all",
          label: "All Games",
          shortLabel: "All",
          badge: "All Games",
          status: "all",
        },
        ...options,
      ]
    : options;
}

export function normalizeGameContext(value: string | null | undefined): GameContextId {
  if (!value || value === "all") return "all";
  return getSupportedGame(value)?.id ?? "all";
}

export function displayGameBadge(value: string | null | undefined) {
  if (value === "all") return "All Games";
  const game = getSupportedGame(value);
  if (!game) return "Unknown Game";
  return gameBadges[game.id] ?? game.displayName;
}

export function shortGameLabel(value: string | null | undefined) {
  const game = getSupportedGame(value);
  if (!game) return "TCG";
  return gameShortLabels[game.id] ?? game.displayName;
}

export function variantLabelForGame(
  game: string | null | undefined,
  value: string | null | undefined,
) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const resolved = getSupportedGame(game)?.id;
  if (resolved === POKEMON_GAME_ID) {
    if (normalized === "foil" || normalized === "holofoil" || normalized === "holo") return "Holo";
    if (normalized === "reverse_foil" || normalized === "reverse holofoil" || normalized === "reverse holo") return "Reverse Holo";
    if (normalized === "normal" || normalized === "nonfoil") return "Normal";
  }
  if (resolved === MAGIC_GAME_ID) {
    if (normalized === "normal" || normalized === "nonfoil") return "Nonfoil";
    if (normalized === "foil") return "Foil";
    if (normalized === "etched") return "Etched";
  }
  return value ? titleCase(String(value).replace(/_/g, " ")) : "Variant unavailable";
}

export function variantOptionsForGame(game: string | null | undefined) {
  const resolved = getSupportedGame(game)?.id;
  return variantLabels[resolved ?? MAGIC_GAME_ID] ?? ["Normal"];
}

export function marketSourcesForGame(game: string | null | undefined) {
  const resolved = getSupportedGame(game)?.id;
  if (resolved === POKEMON_GAME_ID) return marketSources.pokemon;
  return marketSources.magic;
}

export function collectionGameEmptyTitle(game: GameContextId) {
  if (game === "all") return "No cards in this collection yet";
  return `No ${displayGameBadge(game)} cards yet`;
}

export function collectionGameEmptyMessage(game: GameContextId) {
  if (game === "all") {
    return "Saved inventory cards will appear here after they are added through supported collection tools.";
  }
  return `${displayGameBadge(game)} ownership records will appear here once they are added to Collection.`;
}

export function productIdentityLabel(input: {
  gameId: string;
  name: string;
  setCode?: string | null;
  collectorNumber?: string | null;
}) {
  const printing = [input.setCode?.toUpperCase(), input.collectorNumber ? `#${input.collectorNumber}` : null]
    .filter(Boolean)
    .join(" ");
  return `[${shortGameLabel(input.gameId)}] ${input.name}${printing ? ` - ${printing}` : ""}`;
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
