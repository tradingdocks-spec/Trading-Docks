export type SupportedGameId =
  | "magic"
  | "pokemon"
  | "yu-gi-oh"
  | "flesh-and-blood"
  | "digimon";

export type SupportedGameStatus =
  | "production"
  | "beta"
  | "planned";

export type GameCapability =
  | "cards"
  | "sealed"
  | "pricing"
  | "scanner"
  | "scryfall"
  | "manapool"
  | "commander"
  | "deck-vault";

export type GameIdentity = {
  id: SupportedGameId;
  displayName: string;
  tcgTrackingCategoryId?: string;
  tcgTrackingGameId?: number;
  status: SupportedGameStatus;
  aliases: string[];
  capabilities: GameCapability[];
};

export const MAGIC_GAME_ID = "magic" satisfies SupportedGameId;
export const POKEMON_GAME_ID = "pokemon" satisfies SupportedGameId;
export const TCGTRACKING_MAGIC_CATEGORY_ID = "1";
export const TCGTRACKING_MAGIC_GAME_ID = 1;
export const TCGTRACKING_POKEMON_CATEGORY_ID = "3";
export const TCGTRACKING_POKEMON_GAME_ID = 3;

export const SUPPORTED_GAMES: readonly GameIdentity[] = [
  {
    id: MAGIC_GAME_ID,
    displayName: "Magic: The Gathering",
    tcgTrackingCategoryId: TCGTRACKING_MAGIC_CATEGORY_ID,
    tcgTrackingGameId: TCGTRACKING_MAGIC_GAME_ID,
    status: "production",
    aliases: ["magic", "mtg", "magic: the gathering"],
    capabilities: [
      "cards",
      "sealed",
      "pricing",
      "scanner",
      "scryfall",
      "manapool",
      "commander",
      "deck-vault",
    ],
  },
  {
    id: POKEMON_GAME_ID,
    displayName: "Pokemon",
    tcgTrackingCategoryId: TCGTRACKING_POKEMON_CATEGORY_ID,
    tcgTrackingGameId: TCGTRACKING_POKEMON_GAME_ID,
    status: "beta",
    aliases: ["pokemon", "ptcg", "pkm"],
    capabilities: ["cards", "sealed", "pricing", "scanner"],
  },
  {
    id: "yu-gi-oh",
    displayName: "Yu-Gi-Oh!",
    status: "planned",
    aliases: ["yugioh", "yu-gi-oh", "ygo"],
    capabilities: [],
  },
  {
    id: "flesh-and-blood",
    displayName: "Flesh and Blood",
    status: "planned",
    aliases: ["fab", "flesh and blood"],
    capabilities: [],
  },
  {
    id: "digimon",
    displayName: "Digimon",
    status: "planned",
    aliases: ["digimon"],
    capabilities: [],
  },
];

export function supportedGames() {
  return [...SUPPORTED_GAMES];
}

export function activeSupportedGames() {
  return SUPPORTED_GAMES.filter((game) => game.status !== "planned");
}

export function getSupportedGame(value: string | undefined | null) {
  const normalized = normalizeGameLookup(value);
  if (!normalized) return null;
  return SUPPORTED_GAMES.find(
    (game) =>
      game.id === normalized ||
      game.displayName.toLowerCase() === normalized ||
      game.aliases.includes(normalized),
  ) ?? null;
}

export function getGameByTcgTrackingCategory(
  categoryId: string | number | undefined | null,
) {
  const normalized = String(categoryId ?? "").trim();
  if (!normalized) return null;
  return SUPPORTED_GAMES.find(
    (game) => game.tcgTrackingCategoryId === normalized,
  ) ?? null;
}

export function getGameByTcgTrackingGameId(
  gameId: number | string | undefined | null,
) {
  const numeric =
    typeof gameId === "number" ? gameId : Number(String(gameId ?? "").trim());
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return null;
  return SUPPORTED_GAMES.find((game) => game.tcgTrackingGameId === numeric) ?? null;
}

export function tcgTrackingCategoryForGame(
  value: string | undefined | null,
) {
  return getSupportedGame(value)?.tcgTrackingCategoryId ?? null;
}

export function tcgTrackingGameIdForGame(
  value: string | undefined | null,
) {
  return getSupportedGame(value)?.tcgTrackingGameId ?? null;
}

export function normalizeTcgTrackingCategoryPath(value: string) {
  const normalized = value.trim();
  const game = getSupportedGame(normalized) ?? getGameByTcgTrackingCategory(normalized);
  return game?.tcgTrackingCategoryId ?? normalized;
}

export function gameIdFromTcgTrackingCategory(value: string | undefined) {
  if (!value) return TCGTRACKING_MAGIC_GAME_ID;
  const game =
    getSupportedGame(value) ??
    getGameByTcgTrackingCategory(value);
  if (game?.tcgTrackingGameId) return game.tcgTrackingGameId;

  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0
    ? numeric
    : TCGTRACKING_MAGIC_GAME_ID;
}

export function isMagicGame(value: string | undefined | null) {
  return getSupportedGame(value)?.id === MAGIC_GAME_ID;
}

export function isGameCapabilitySupported(
  game: GameIdentity | SupportedGameId | string | undefined | null,
  capability: GameCapability,
) {
  const resolved = typeof game === "object"
    ? game
    : getSupportedGame(game);
  return resolved?.capabilities.includes(capability) ?? false;
}

function normalizeGameLookup(value: string | undefined | null) {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : "";
}
