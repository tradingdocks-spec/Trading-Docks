export type DeckArchitectFormatId =
  | "commander"
  | "standard"
  | "modern"
  | "pioneer"
  | "pauper"
  | "legacy"
  | "vintage"
  | "brawl"
  | "casual60"
  | "custom";

export type DeckArchitectBoard = "commander" | "main" | "sideboard" | "maybeboard";

export type DeckArchitectRole =
  | "ramp"
  | "card-advantage"
  | "interaction"
  | "removal"
  | "protection"
  | "threat"
  | "finisher"
  | "board-wipe"
  | "tutor"
  | "countermagic"
  | "graveyard-interaction"
  | "mana-fixing"
  | "synergy"
  | "combo-piece"
  | "land";

export type RecommendationProfile = {
  roleTargets: Partial<Record<DeckArchitectRole, { min?: number; ideal?: number }>>;
  preferredManaCurve?: Record<number, number>;
  notes: string[];
};

export type FormatProfile = {
  id: DeckArchitectFormatId;
  name: string;
  minimumMainDeckSize?: number;
  maximumMainDeckSize?: number;
  exactDeckSize?: number;
  maximumCopies?: number;
  sideboardAllowed: boolean;
  maximumSideboardSize?: number;
  commanderRequired: boolean;
  commanderCount?: number;
  singleton?: boolean;
  enforceColorIdentity?: boolean;
  legalityProvider: "scryfall" | "tcgtracking" | "manual" | "custom";
  recommendationProfile: RecommendationProfile;
};

export type BuildIntentId =
  | "use-collection"
  | "no-purchases"
  | "strongest-possible"
  | "budget"
  | "competitive"
  | "casual"
  | "upgrade-over-time";

export type BuildIntent = {
  id: BuildIntentId;
  label: string;
  ownershipWeight: number;
  priceWeight: number;
  powerWeight: number;
  synergyWeight: number;
  allowMissingCards: boolean;
  budgetCents?: number;
};

export type CollectionGraphCard = {
  inventoryId: string;
  name: string;
  quantityOwned: number;
  setCode?: string | null;
  collectorNumber?: string | null;
  scryfallId?: string | null;
  tcgplayerId?: string | number | null;
  typeLine?: string | null;
  colorIdentity?: string[];
  manaValue?: number | null;
  condition?: string | null;
  finish?: string | null;
  language?: string | null;
  location?: string | null;
  marketPrice?: number | null;
};

export type DeckRequirement = {
  id: string;
  name: string;
  requiredQuantity: number;
  board: DeckArchitectBoard;
  roles: DeckArchitectRole[];
  estimatedPrice?: number | null;
  importance?: number;
  typeLine?: string | null;
  colorIdentity?: string[];
  isCommander?: boolean;
  legalityStatus?: "legal" | "banned" | "not_legal" | "restricted" | "unknown";
};

export type OwnershipMatch = {
  requirement: DeckRequirement;
  ownedQuantity: number;
  missingQuantity: number;
  status: "owned" | "partial" | "missing";
  ownedRecords: CollectionGraphCard[];
  estimatedMissingValue: number | null;
};

export type BuildabilityScore = {
  score: number;
  requiredCards: number;
  ownedCards: number;
  missingCards: number;
  missingUniqueCards: number;
  estimatedCompletionCost: number | null;
  commanderOwned: boolean | null;
  factors: Array<{ label: string; value: string; impact: "positive" | "neutral" | "negative" }>;
};

export type DeckHealthCategory =
  | "overall"
  | "mana"
  | "consistency"
  | "interaction"
  | "card-advantage"
  | "synergy"
  | "format-legality";

export type DeckHealthReport = {
  overall: number;
  categories: Record<DeckHealthCategory, number>;
  strengths: string[];
  warnings: string[];
};

export type DeckChangeProposal = {
  id: string;
  status: "proposed" | "reviewing" | "applied" | "dismissed";
  removes: Array<{ name: string; quantity: number; reason: string }>;
  adds: Array<{ name: string; quantity: number; reason: string; ownedQuantity: number; additionalCost: number | null }>;
  projectedHealthDelta: { from: number; to: number } | null;
  additionalCost: number | null;
  explanation: string;
};

export type BuildOpportunity = {
  id: string;
  name: string;
  formatId: DeckArchitectFormatId;
  buildability: BuildabilityScore;
  source: "collection-calculation" | "template-provider" | "future-provider";
  disclosure: string;
};
