export type ManaColor =
  | "W"
  | "U"
  | "B"
  | "R"
  | "G"
  | "C";

export type DeckFormat =
  | "EDH"
  | "Pauper EDH"
  | "Standard"
  | "Modern"
  | "Pioneer"
  | "Legacy"
  | "Vintage"
  | "Alchemy"
  | "Premodern"
  | "Pauper";

export type DeckCard = {
  id: string;
  name: string;
  quantity: number;
  manaValue: number;
  colors: ManaColor[];
  typeLine: string;
  category: string;
  price: number;
  owned: boolean;
  image?: string;
  artCrop?: string;
  setCode?: string;
  collectorNumber?: string;
  gameChanger?: boolean;
  board?: "commander" | "main" | "sideboard" | "maybeboard";
  legalityStatus?: "legal" | "banned" | "not_legal" | "restricted";
  legalityMessage?: string;
  tokenNames?: string[];
  inventoryMatches?: InventoryMatch[];
  ownedQuantity?: number;
};

export type InventoryMatch = {
  inventoryId: string;
  quantity: number;
  location: string;
  locationId?: string;
  locationType?: string;
  binderPage?: number;
  binderSlot?: string;
  condition: string;
  printing?: string;
  platform?: "TCGplayer" | "eBay" | "ManaPool" | "Shopify" | "Unlisted";
  listingId?: string;
  reservedForDeck?: boolean;
};

export type TokenRecommendation = {
  name: string;
  image?: string;
  createdBy: string[];
  estimatedQuantity: string;
};

export type TokenSupportCard = {
  cardName: string;
  role: "multiplier" | "payoff" | "copier" | "consumer";
  explanation: string;
};

export type DeckValidationIssue = {
  cardId?: string;
  cardName?: string;
  severity: "error" | "warning";
  code: string;
  message: string;
};

export type DeckIntelligenceReport = {
  valid: boolean;
  issues: DeckValidationIssue[];
  tokens: TokenRecommendation[];
  tokenSupport: TokenSupportCard[];
  ownership: Array<{
    cardId: string;
    cardName: string;
    required: number;
    owned: number;
    matches: InventoryMatch[];
  }>;
};

export type ComboCard = {
  name: string;
  image?: string;
  inDeck: boolean;
  isCommander: boolean;
  ownedQuantity: number;
  inventoryLocations: string[];
  price: number | null;
};

export type DeckCombo = {
  id: string;
  cards: ComboCard[];
  missingCards: ComboCard[];
  produces: string[];
  prerequisites: string[];
  steps: string[];
  manaNeeded: string;
  popularity: number | null;
  bracketTag: string;
  estimatedComboValue: number | null;
  spellbookUrl: string;
};

export type DeckComboReport = {
  available: boolean;
  complete: DeckCombo[];
  oneCardAway: DeckCombo[];
  summary: {
    complete: number;
    oneCardAway: number;
    ownedMissingPieces: number;
    bracketSensitive: number;
  };
  source: "Commander Spellbook";
  message?: string;
};

export type DeckRecord = {
  id: string;
  name: string;
  commander?: string;
  commanders?: string[];
  format: DeckFormat;
  theme: string;
  colors: ManaColor[];
  marketValue: number;
  ownedCount: number;
  cardCount: number;
  power: number;
  updatedAt: string;
  status: "Complete" | "Building" | "Wishlist";
  cards: DeckCard[];
  architectMetadata?: DeckSuiteMetadata;
};

export type DeckSuiteMetadata = {
  source: "deck-architect" | "deck-builder" | "import" | "deck-vault";
  sourceDeckId?: string;
  buildIntentId?: string;
  strategyId?: string;
  lockedCardIds?: string[];
  mustIncludeCardIds?: string[];
  missingCardNames?: string[];
  recommendationIds?: string[];
  generatedAt: string;
};

export type ScryfallCardResult = {
  id: string;
  name: string;
  manaValue: number;
  colors: ManaColor[];
  colorIdentity: ManaColor[];
  typeLine: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  image: string;
  artCrop: string;
  price: number;
  gameChanger: boolean;
};
