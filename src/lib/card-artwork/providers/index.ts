export type ArtworkGame = "magic" | "pokemon" | "pokemon-japan" | "lorcana" | "one-piece";
export type ArtworkProvider = "scryfall" | "pokemon-tcg-api" | "tcgdex" | "lorcast" | "optcg-api";

export const ARTWORK_PROVIDERS = {
  scryfall: { games: ["magic"], host: "cards.scryfall.io", attribution: "Artwork via Scryfall · © Wizards of the Coast" },
  "pokemon-tcg-api": { games: ["pokemon"], host: "images.pokemontcg.io", attribution: "Artwork via Pokémon TCG API · © Pokémon / Nintendo / Creatures / GAME FREAK" },
  tcgdex: { games: ["pokemon-japan"], host: "assets.tcgdex.net", attribution: "Japanese artwork via TCGdex · © Pokémon / Nintendo / Creatures / GAME FREAK" },
  lorcast: { games: ["lorcana"], host: "cards.lorcast.io", attribution: "Artwork via Lorcast · © Disney / Ravensburger" },
  "optcg-api": { games: ["one-piece"], host: "optcgapi.com", attribution: "Artwork via OPTCG API · © Eiichiro Oda / Shueisha / Toei Animation / Bandai" },
} as const;

export function isApprovedArtworkUrl(provider: ArtworkProvider, game: ArtworkGame, value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  const config = ARTWORK_PROVIDERS[provider];
  if (!config || !(config.games as readonly string[]).includes(game)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === config.host && !url.port && !url.username && !url.password
      && (game !== "pokemon-japan" || url.pathname.startsWith("/ja/"));
  } catch { return false; }
}

export type ProviderCard = {
  game: ArtworkGame;
  provider: ArtworkProvider;
  providerId: string;
  name: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  language: "English" | "Japanese";
  imageUrl: string | null;
  thumbnailUrl: string | null;
  providerCardUrl: string;
};

// Offline adapters: only metadata returned by a provider becomes an image URL.
// TCGdex's quality suffix is its documented asset API, not an inferred CDN path.
export function scryfallCard(card: { id: string; name: string; set: string; set_name: string; collector_number: string; scryfall_uri: string; image_uris: { normal: string; small: string } }): ProviderCard {
  return { game: "magic", provider: "scryfall", providerId: card.id, name: card.name, setCode: card.set, setName: card.set_name, collectorNumber: card.collector_number, language: "English", imageUrl: card.image_uris.normal, thumbnailUrl: card.image_uris.small, providerCardUrl: card.scryfall_uri };
}

export function pokemonCard(card: { id: string; name: string; number: string; images: { large: string; small: string } }, set: { id: string; name: string }): ProviderCard {
  return { game: "pokemon", provider: "pokemon-tcg-api", providerId: card.id, name: card.name, setCode: set.id, setName: set.name, collectorNumber: card.number, language: "English", imageUrl: card.images.large, thumbnailUrl: card.images.small, providerCardUrl: `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(card.id)}` };
}

export function japanesePokemonCard(card: { id: string; name: string; localId: string; image?: string; set: { id: string; name: string } }): ProviderCard {
  return { game: "pokemon-japan", provider: "tcgdex", providerId: card.id, name: card.name, setCode: card.set.id, setName: card.set.name, collectorNumber: card.localId, language: "Japanese", imageUrl: card.image ? `${card.image}/high.webp` : null, thumbnailUrl: card.image ? `${card.image}/low.webp` : null, providerCardUrl: `https://api.tcgdex.net/v2/ja/cards/${encodeURIComponent(card.id)}` };
}

export function lorcastCard(card: { id: string; name: string; version: string; collector_number: string; lang: string; set: { code: string; name: string }; image_uris: { digital: { large: string; small: string } } }): ProviderCard {
  if (card.lang !== "en") throw new Error("The Lorcana demo requires the English printing.");
  return { game: "lorcana", provider: "lorcast", providerId: card.id, name: `${card.name} — ${card.version}`, setCode: card.set.code, setName: card.set.name, collectorNumber: card.collector_number, language: "English", imageUrl: card.image_uris.digital.large, thumbnailUrl: card.image_uris.digital.small, providerCardUrl: `https://api.lorcast.com/v0/cards/${card.set.code}/${card.collector_number}` };
}

export function onePieceCard(card: { card_image_id: string; card_name: string; set_id: string; set_name: string; card_set_id: string; card_image: string }): ProviderCard {
  return { game: "one-piece", provider: "optcg-api", providerId: card.card_image_id, name: card.card_name, setCode: card.set_id, setName: card.set_name, collectorNumber: card.card_set_id, language: "English", imageUrl: card.card_image, thumbnailUrl: card.card_image, providerCardUrl: `https://optcgapi.com/api/sets/card/${card.card_set_id}/` };
}
