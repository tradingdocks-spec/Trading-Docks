import { VERIFIED_DEMO_ARTWORK } from "./verified-demo-artwork.ts";
import { ARTWORK_PROVIDERS, isApprovedArtworkUrl, type ArtworkGame, type ArtworkProvider, type ProviderCard } from "./providers/index.ts";

export type ArtworkIdentity = Pick<ProviderCard, "game" | "provider" | "providerId" | "name" | "setCode" | "collectorNumber" | "language">;
export type DemoArtwork = {
  imageUrl: string | null;
  thumbnailUrl: string | null;
  imageSource: ArtworkProvider | null;
  hasVerifiedArtwork: boolean;
  attributionLabel: string | null;
  providerCardUrl: string | null;
};

export function resolveDemoCardArtwork(input: ArtworkIdentity): DemoArtwork {
  const entry = VERIFIED_DEMO_ARTWORK.find((card) => card.game === input.game && card.provider === input.provider && card.providerId === input.providerId
    && card.name === input.name && card.setCode === input.setCode && card.collectorNumber === input.collectorNumber && card.language === input.language);
  const verified = entry && [entry.imageUrl, entry.thumbnailUrl].every((url) => isApprovedArtworkUrl(entry.provider, entry.game, url)
    && entry.verification.images.some((image) => image.url === url && image.width >= 100 && image.height > image.width && image.sha256.length === 64));
  if (!entry || !verified) return { imageUrl: null, thumbnailUrl: null, imageSource: null, hasVerifiedArtwork: false, attributionLabel: null, providerCardUrl: null };
  return { imageUrl: entry.imageUrl, thumbnailUrl: entry.thumbnailUrl, imageSource: entry.provider, hasVerifiedArtwork: true, attributionLabel: ARTWORK_PROVIDERS[entry.provider].attribution, providerCardUrl: entry.providerCardUrl };
}

export type MarketMode = "trending" | "movers" | "volume" | "opportunities";
export type MarketCard = Omit<ProviderCard, "imageUrl" | "thumbnailUrl" | "providerCardUrl"> & DemoArtwork & {
  id: string;
  marketPrice: number;
  change24h: number;
  change7d: number;
  demand: "High" | "Medium";
  volumeScore: number;
  opportunityScore: number;
  source: string;
  suggestedAction: "REPRICE" | "HOLD" | "LIST" | "REVIEW";
};

export const GAME_TABS: Array<{ id: ArtworkGame; label: string; shortLabel: string }> = [
  { id: "magic", label: "Magic: The Gathering", shortLabel: "Magic" },
  { id: "pokemon", label: "Pokémon", shortLabel: "Pokemon" },
  { id: "pokemon-japan", label: "Pokémon · Japanese", shortLabel: "Pokemon JP" },
  { id: "lorcana", label: "Disney Lorcana", shortLabel: "Lorcana" },
  { id: "one-piece", label: "One Piece", shortLabel: "One Piece" },
];

export function artworkIssues(card: Pick<MarketCard, "name" | "game" | "provider" | "imageUrl" | "thumbnailUrl" | "hasVerifiedArtwork">, featured = false) {
  const issues: string[] = [];
  if (!card.imageUrl) issues.push(`${card.name}: missing imageUrl${card.imageUrl === "" ? " (empty string)" : ""}.`);
  if (!card.thumbnailUrl) issues.push(`${card.name}: missing thumbnailUrl.`);
  if (!card.hasVerifiedArtwork) issues.push(`${card.name}: unverified artwork in ${featured ? "featured" : "normal"} art mode.`);
  for (const url of [card.imageUrl, card.thumbnailUrl]) if (url && !isApprovedArtworkUrl(card.provider, card.game, url)) issues.push(`${card.name}: unsupported artwork host or game/provider mismatch.`);
  return issues;
}

export function warnArtworkIssues(issues: string[]) {
  if (process.env.NODE_ENV !== "production") for (const issue of issues) console.warn(`[Market Intelligence] ${issue}`);
}

export function artworkLayoutIssues(cards: MarketCard[], mode: "normal" | "preview") {
  return mode === "normal" && !selectFeaturedCard(cards) ? ["Visible tab has zero verified cards but renders normal artwork layout."] : [];
}

export function sampleCards(game: ArtworkGame): MarketCard[] {
  // Fictional opening quotes, not provider pricing. Each game has its own demo market.
  const openingPrices: Record<ArtworkGame, number[]> = {
    magic: [24.16, 12.48, 82.73, 31.92, 47.18],
    pokemon: [242.63, 173.46, 39.84],
    "pokemon-japan": [2.87, 5.64, 8.23],
    lorcana: [17.86, 8.42, 13.71],
    "one-piece": [7.63, 3.18, 11.24],
  };
  return VERIFIED_DEMO_ARTWORK.filter((card) => card.game === game).map((identity, index) => {
    const card: MarketCard = {
      ...identity, ...resolveDemoCardArtwork(identity), id: `${game}-${identity.providerId}`,
      marketPrice: openingPrices[game][index], change24h: [1.74, -0.82, 0.57, -1.36, 1.34][index], change7d: [6.43, -4.17, 2.38, -3.21, 5.82][index],
      demand: index === 0 || index === 4 ? "High" : "Medium", volumeScore: [80, 60, 95, 72, 86][index], opportunityScore: [65, 85, 40, 78, 70][index],
      source: "Illustrative sample", suggestedAction: index === 1 || index === 3 ? "REPRICE" : index === 2 ? "HOLD" : index === 4 ? "LIST" : "REVIEW",
    };
    warnArtworkIssues(artworkIssues(card));
    return card;
  });
}

export function selectFeaturedCard(cards: MarketCard[]) {
  return cards.find((card) => card.hasVerifiedArtwork && card.imageUrl && artworkIssues(card, true).length === 0) ?? null;
}

export function rankCards(cards: MarketCard[], mode: MarketMode) {
  return [...cards].sort((a, b) => {
    if (mode === "movers") return Math.abs(b.change7d) - Math.abs(a.change7d);
    if (mode === "volume") return b.volumeScore - a.volumeScore;
    if (mode === "opportunities") return b.opportunityScore - a.opportunityScore;
    return b.volumeScore + b.opportunityScore + Math.abs(b.change7d) - (a.volumeScore + a.opportunityScore + Math.abs(a.change7d));
  });
}
