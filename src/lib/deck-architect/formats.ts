import type { DeckArchitectFormatId, FormatProfile } from "./types.ts";

const COMMANDER_RECOMMENDATIONS = {
  roleTargets: {
    ramp: { min: 8, ideal: 12 },
    "card-advantage": { min: 8, ideal: 12 },
    interaction: { min: 8, ideal: 12 },
    "board-wipe": { min: 2, ideal: 4 },
    land: { min: 34, ideal: 37 },
  },
  notes: [
    "Singleton rules and color identity are enforced before recommendations.",
    "Commander synergy is format-specific and must not be reused for 60-card formats.",
  ],
};

const CONSTRUCTED_RECOMMENDATIONS = {
  roleTargets: {
    land: { min: 20, ideal: 24 },
    threat: { min: 10, ideal: 18 },
    interaction: { min: 8, ideal: 14 },
    "card-advantage": { min: 4, ideal: 8 },
  },
  notes: [
    "Playset consistency matters more than singleton breadth.",
    "Sideboard intelligence is available only when the format allows sideboards.",
  ],
};

export const FORMAT_PROFILES: Record<DeckArchitectFormatId, FormatProfile> = {
  commander: {
    id: "commander",
    name: "Commander",
    exactDeckSize: 100,
    maximumCopies: 1,
    sideboardAllowed: false,
    commanderRequired: true,
    commanderCount: 1,
    singleton: true,
    enforceColorIdentity: true,
    legalityProvider: "scryfall",
    recommendationProfile: COMMANDER_RECOMMENDATIONS,
  },
  standard: {
    id: "standard",
    name: "Standard",
    minimumMainDeckSize: 60,
    maximumCopies: 4,
    sideboardAllowed: true,
    maximumSideboardSize: 15,
    commanderRequired: false,
    legalityProvider: "scryfall",
    recommendationProfile: CONSTRUCTED_RECOMMENDATIONS,
  },
  modern: {
    id: "modern",
    name: "Modern",
    minimumMainDeckSize: 60,
    maximumCopies: 4,
    sideboardAllowed: true,
    maximumSideboardSize: 15,
    commanderRequired: false,
    legalityProvider: "scryfall",
    recommendationProfile: CONSTRUCTED_RECOMMENDATIONS,
  },
  pioneer: {
    id: "pioneer",
    name: "Pioneer",
    minimumMainDeckSize: 60,
    maximumCopies: 4,
    sideboardAllowed: true,
    maximumSideboardSize: 15,
    commanderRequired: false,
    legalityProvider: "scryfall",
    recommendationProfile: CONSTRUCTED_RECOMMENDATIONS,
  },
  pauper: {
    id: "pauper",
    name: "Pauper",
    minimumMainDeckSize: 60,
    maximumCopies: 4,
    sideboardAllowed: true,
    maximumSideboardSize: 15,
    commanderRequired: false,
    legalityProvider: "scryfall",
    recommendationProfile: {
      ...CONSTRUCTED_RECOMMENDATIONS,
      notes: [
        "Pauper legality depends on common-printing eligibility from the legality provider.",
        ...CONSTRUCTED_RECOMMENDATIONS.notes,
      ],
    },
  },
  legacy: {
    id: "legacy",
    name: "Legacy",
    minimumMainDeckSize: 60,
    maximumCopies: 4,
    sideboardAllowed: true,
    maximumSideboardSize: 15,
    commanderRequired: false,
    legalityProvider: "scryfall",
    recommendationProfile: CONSTRUCTED_RECOMMENDATIONS,
  },
  vintage: {
    id: "vintage",
    name: "Vintage",
    minimumMainDeckSize: 60,
    maximumCopies: 4,
    sideboardAllowed: true,
    maximumSideboardSize: 15,
    commanderRequired: false,
    legalityProvider: "scryfall",
    recommendationProfile: CONSTRUCTED_RECOMMENDATIONS,
  },
  brawl: {
    id: "brawl",
    name: "Brawl",
    exactDeckSize: 60,
    maximumCopies: 1,
    sideboardAllowed: false,
    commanderRequired: true,
    commanderCount: 1,
    singleton: true,
    enforceColorIdentity: true,
    legalityProvider: "scryfall",
    recommendationProfile: COMMANDER_RECOMMENDATIONS,
  },
  casual60: {
    id: "casual60",
    name: "60-Card Casual",
    minimumMainDeckSize: 60,
    maximumCopies: 4,
    sideboardAllowed: true,
    maximumSideboardSize: 15,
    commanderRequired: false,
    legalityProvider: "manual",
    recommendationProfile: CONSTRUCTED_RECOMMENDATIONS,
  },
  custom: {
    id: "custom",
    name: "Custom Format",
    sideboardAllowed: true,
    commanderRequired: false,
    legalityProvider: "custom",
    recommendationProfile: {
      roleTargets: {},
      notes: ["Custom format rules are intentionally represented as a profile, not hard-coded UI logic."],
    },
  },
};

export const INITIAL_DECK_ARCHITECT_FORMATS: DeckArchitectFormatId[] = [
  "commander",
  "casual60",
  "pauper",
  "modern",
  "standard",
  "pioneer",
  "legacy",
  "vintage",
  "brawl",
  "custom",
];

export function getFormatProfile(formatId: DeckArchitectFormatId) {
  return FORMAT_PROFILES[formatId] ?? FORMAT_PROFILES.commander;
}

export function isBasicLand(cardName: string) {
  return /^(plains|island|swamp|mountain|forest|wastes)$/i.test(cardName.trim());
}

export function maximumCopiesForCard(format: FormatProfile, cardName: string) {
  if (isBasicLand(cardName)) return Number.POSITIVE_INFINITY;
  return format.maximumCopies ?? Number.POSITIVE_INFINITY;
}

export function isCommanderEligible(card: { typeLine?: string | null }) {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  return typeLine.includes("legendary") && typeLine.includes("creature");
}
