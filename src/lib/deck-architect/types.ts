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
  | "commander"
  | "ramp"
  | "card-draw"
  | "card-advantage"
  | "interaction"
  | "targeted-removal"
  | "removal"
  | "mass-removal"
  | "protection"
  | "threat"
  | "finisher"
  | "board-wipe"
  | "tutor"
  | "countermagic"
  | "recursion"
  | "graveyard-interaction"
  | "mana-fixing"
  | "synergy"
  | "combo-piece"
  | "token-generation"
  | "sacrifice-outlet"
  | "discard"
  | "lifegain"
  | "burn"
  | "artifact-interaction"
  | "enchantment-interaction"
  | "land";

export type RecommendationConfidence = "high" | "medium" | "low";

export type RecommendationSignal = {
  label: string;
  impact: "positive" | "neutral" | "negative";
  detail: string;
};

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
  imageUri?: string | null;
  setCode?: string | null;
  collectorNumber?: string | null;
  scryfallId?: string | null;
  tcgplayerId?: string | number | null;
  typeLine?: string | null;
  oracleText?: string | null;
  manaCost?: string | null;
  colors?: string[];
  colorIdentity?: string[];
  manaValue?: number | null;
  condition?: string | null;
  finish?: string | null;
  language?: string | null;
  location?: string | null;
  legalities?: Record<string, string>;
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
  imageUri?: string | null;
  typeLine?: string | null;
  oracleText?: string | null;
  manaCost?: string | null;
  colorIdentity?: string[];
  location?: string | null;
  legalities?: Record<string, string>;
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
  category?: "ready-now" | "nearly-complete" | "worth-considering";
  archetypeId?: string;
  missingCards?: OwnershipMatch[];
  ownedSubstitutions?: OwnedSubstitution[];
  confidence?: RecommendationConfidence;
  signals?: RecommendationSignal[];
  source: "collection-calculation" | "template-provider" | "future-provider";
  disclosure: string;
};

export type RecommendationSupportLevel = "full-intelligence" | "builder-legality" | "experimental";

export type DeckKnowledgeCardSeed = {
  name: string;
  quantity: number;
  roles: DeckArchitectRole[];
  importance?: number;
  estimatedPrice?: number | null;
  typeLine?: string;
  oracleText?: string;
  colorIdentity?: string[];
  tags?: string[];
};

export type DeckArchetypeProfile = {
  id: string;
  name: string;
  formatId: DeckArchitectFormatId;
  colors: string[];
  summary: string;
  roleTargets: RecommendationProfile["roleTargets"];
  coreCards: DeckKnowledgeCardSeed[];
  flexCards: DeckKnowledgeCardSeed[];
  landPlan?: DeckKnowledgeCardSeed[];
  sideboardPlan?: DeckKnowledgeCardSeed[];
  supportLevel?: RecommendationSupportLevel;
  provenance: string[];
  sourceType: "trading-docks-authored" | "external-provider";
};

export type CommanderStrategyProfile = {
  id: string;
  commanderName: string;
  label: string;
  summary: string;
  roles: DeckArchitectRole[];
  coreCards?: DeckKnowledgeCardSeed[];
  flexCards?: DeckKnowledgeCardSeed[];
  roleTargets?: RecommendationProfile["roleTargets"];
  confidence: RecommendationConfidence;
  signals: RecommendationSignal[];
  provenance: string[];
};

export type CommanderStrategyFit = {
  commander: CollectionGraphCard;
  strategy: CommanderStrategyProfile;
  score: number;
  fit: "strong" | "good" | "moderate" | "low";
  ownedSupportCount: number;
  missingCoreCards: OwnershipMatch[];
  estimatedBuildability: BuildabilityScore | null;
  signals: RecommendationSignal[];
};

export type OwnedSubstitution = {
  missingCardName: string;
  ownedCard: CollectionGraphCard;
  score: number;
  confidence: RecommendationConfidence;
  reasons: string[];
};

export type DeckRecommendation = {
  id: string;
  title: string;
  body: string;
  tone: "good" | "attention" | "neutral";
  confidence: RecommendationConfidence;
  signals: RecommendationSignal[];
  adds: Array<{
    name: string;
    quantity: number;
    reason: string;
    ownedQuantity: number;
    additionalCost: number | null;
  }>;
  cuts: Array<{
    name: string;
    quantity: number;
    reason: string;
  }>;
};

export type DeckValidationIssue = {
  code: string;
  severity: "error" | "warning";
  cardName?: string;
  message: string;
};

export type DeckValidationResult = {
  valid: boolean;
  issues: DeckValidationIssue[];
};

export type DeckArchitectIntelligence = {
  generatedAt: string;
  supportedFormats: DeckArchitectFormatId[];
  provider: {
    id: string;
    name: string;
    sourceType: "trading-docks-authored" | "external-provider";
    provenance: string[];
  };
  opportunities: BuildOpportunity[];
  commanderStrategies: Record<string, CommanderStrategyProfile[]>;
  recommendations: DeckRecommendation[];
  limitations: string[];
};

export type DeckArchitectSavedDeckSummary = {
  id: string;
  name: string;
  format: string | null;
  commander: string | null;
  cardCount: number | null;
  updatedAt: string | null;
};
