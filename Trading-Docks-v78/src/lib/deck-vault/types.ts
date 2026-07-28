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
