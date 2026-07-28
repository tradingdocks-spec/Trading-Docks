export const CARD_SHOW_GAMES = [
  { id: "pokemon", label: "Pokémon", apiName: "Pokemon" },
  { id: "pokemon-japan", label: "Pokémon Japan", apiName: "Pokemon Japan" },
  { id: "one-piece-card-game", label: "One Piece", apiName: "One Piece Card Game" },
  { id: "disney-lorcana", label: "Lorcana", apiName: "Disney Lorcana" },
  { id: "magic-the-gathering", label: "Magic", apiName: "Magic: The Gathering" },
] as const;

export type CardShowGameId = (typeof CARD_SHOW_GAMES)[number]["id"];

export function getCardShowGame(id: string) {
  return CARD_SHOW_GAMES.find((game) => game.id === id);
}
