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
  | "mana-rock"
  | "mana-dork"
  | "ritual"
  | "treasure-generation"
  | "cost-reduction"
  | "color-fixing"
  | "land-fixing"
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

export type DeckStrategyTag =
  | "goblin"
  | "goblin-payoff"
  | "goblin-token-maker"
  | "typal-lord"
  | "haste-enabler"
  | "untap-engine"
  | "mana-engine"
  | "sacrifice-outlet"
  | "death-payoff"
  | "token-payoff"
  | "token-maker"
  | "artifact-synergy"
  | "artifact"
  | "graveyard-enabler"
  | "recursion-target"
  | "recursion"
  | "spell-payoff"
  | "spellslinger"
  | "prowess"
  | "counters-payoff"
  | "proliferate"
  | "poison"
  | "infect"
  | "toxic"
  | "equipment-payoff"
  | "aura-payoff"
  | "voltron"
  | "blink-enabler"
  | "reanimation"
  | "card-advantage"
  | "interaction"
  | "ramp"
  | "protection"
  | "board-wipe";

export type ArchetypeCandidateCategory = "core" | "synergy" | "support" | "generic" | "reject";

export type RecommendationEvidenceConfidence = "strong" | "good" | "possible" | "insufficient";

export type RecommendationEvidence = {
  legalityVerified: boolean;
  archetypeAffinity: number | null;
  commanderAffinity: number | null;
  roleFit: number;
  strategyFit: number;
  curveFit: number;
  observedInCorpus?: boolean;
  inclusionRate?: number | null;
  synergyLift?: number | null;
  coOccurrenceScore?: number | null;
  comboRelevance?: {
    comboCount: number;
    nearComboCount: number;
    winLineCount: number;
  };
  ownership: {
    owned: boolean;
    quantity: number;
  };
  confidence: RecommendationEvidenceConfidence;
  reasons: string[];
  rejectionReasons?: string[];
  sourceCategories: Array<"curated" | "corpus" | "combo" | "inferred" | "owned">;
};

export type CardKnowledge = {
  cardId: string;
  name: string;
  colorIdentity: string[];
  typeLine: string | null;
  oracleText: string | null;
  legalities: Record<string, string>;
};

export type CommanderMetaProfile = {
  commanderId: string;
  commanderName: string;
  strategyEvidence: CommanderStrategyEvidence[];
  source: "trading-docks-corpus" | "licensed-provider" | "curated";
  observedDeckCount: number | null;
};

export type CommanderStrategyEvidence = {
  id: string;
  label: string;
  sampleSize: number | null;
  coreCards: string[];
  synergyCards: string[];
  flexCards: string[];
};

export type CommanderCardEvidence = {
  commanderId: string;
  cardId: string;
  strategyId?: string;
  observedInCorpus: boolean;
  inclusionRate: number | null;
  sampleSize: number | null;
  synergyLift: number | null;
  coOccurrenceScore: number | null;
  classification: "core" | "strong-synergy" | "flex" | "fringe" | "unsupported";
  provenance: string[];
};

export type CardKnowledgeProvider = {
  getCard(cardId: string): Promise<CardKnowledge | null>;
  getCards(cardIds: string[]): Promise<CardKnowledge[]>;
};

export type CommanderMetaProvider = {
  getCommanderProfile(commanderId: string): Promise<CommanderMetaProfile | null>;
  getCardEvidence(commanderId: string, cardId: string, strategyId?: string): Promise<CommanderCardEvidence | null>;
  getStrategyProfiles(commanderId: string): Promise<CommanderStrategyEvidence[]>;
};

export type ComboRecommendation = {
  id: string;
  source: "Commander Spellbook";
  cards: Array<{ name: string; mustBeCommander: boolean; imageUri?: string | null }>;
  prerequisites: string[];
  steps: string[];
  results: string[];
  commanderRequirements: string[];
  colorIdentity: string[];
  legalities: Record<string, boolean>;
  popularity: number | null;
  winCondition: boolean;
  spellbookUrl: string;
};

export type DeckComboResult = {
  available: boolean;
  source: "Commander Spellbook";
  complete: ComboRecommendation[];
  fullyOwned: ComboRecommendation[];
  nearCombos: NearComboResult[];
  summary: {
    complete: number;
    fullyOwned: number;
    nearCombos: number;
    winLineCount: number;
  };
  message?: string;
};

export type NearComboResult = ComboRecommendation & {
  ownedPieces: string[];
  missingPieces: string[];
};

export type ComboKnowledgeProvider = {
  findCombosForDeck(cardNames: string[], inventoryCardNames?: string[]): Promise<DeckComboResult>;
  findCombosForCommander(commanderName: string): Promise<ComboRecommendation[]>;
  findNearCombos(cardNames: string[]): Promise<NearComboResult[]>;
};

export type ArchetypeProfile = {
  id: string;
  label: string;
  description: string;
  requiredTags: DeckStrategyTag[];
  preferredTags: DeckStrategyTag[];
  discouragedTags: DeckStrategyTag[];
  excludedTags: DeckStrategyTag[];
  excludedNames?: string[];
  typal?: {
    creatureTypes: string[];
    minSupportCount: number;
    idealSupportCount: number;
  };
  roleTargets: Partial<Record<DeckArchitectRole, { min?: number; ideal?: number }>>;
  genericCardLimit: number;
  minimumCoreAndSynergy: number;
  minimumRelevanceScore: number;
};

export type CommanderProfile = {
  commanderName: string;
  colors: string[];
  creatureTypes: string[];
  mechanicalThemes: DeckStrategyTag[];
  viableArchetypes: ArchetypeProfile[];
  recommendedArchetypeId: string;
};

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
  strategyTags?: DeckStrategyTag[];
  archetypeCategory?: ArchetypeCandidateCategory;
  archetypeScore?: number;
  recommendationEvidence?: RecommendationEvidence;
  primaryRoles?: DeckArchitectRole[];
  secondaryRoles?: DeckArchitectRole[];
  whyThisCard?: string;
  estimatedPrice?: number | null;
  importance?: number;
  imageUri?: string | null;
  typeLine?: string | null;
  oracleText?: string | null;
  manaCost?: string | null;
  setCode?: string | null;
  collectorNumber?: string | null;
  tcgplayerId?: string | number | null;
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

export type BrewConstraintKey =
  | "more-aggressive"
  | "more-interaction"
  | "more-resilient"
  | "reduce-variance"
  | "collection-first"
  | "budget-cap"
  | "avoid-infinite-combos"
  | "less-commander-dependent"
  | "add-sacrifice-subtheme"
  | "more-unusual";

export type BrewConstraint = {
  key: BrewConstraintKey;
  label: string;
  detail: string;
  confidence: RecommendationConfidence;
};

export type HiddenSynergyCluster = {
  id: string;
  title: string;
  summary: string;
  cards: Array<{ name: string; role: DeckArchitectRole; owned: boolean }>;
  resources: string[];
  payoffs: string[];
  confidence: RecommendationConfidence;
};

export type DeckPersonalityDimension =
  | "explosive"
  | "interactive"
  | "resilient"
  | "linear"
  | "political"
  | "combo-reliance"
  | "complexity"
  | "variance"
  | "commander-dependence";

export type DeckPersonalityReport = {
  dimensions: Record<DeckPersonalityDimension, number>;
  explanations: Array<{ dimension: DeckPersonalityDimension; label: string; detail: string }>;
};

export type RoleCompressionInsight = {
  cardName: string;
  roles: DeckArchitectRole[];
  explanation: string;
  owned: boolean;
};

export type StrategyOverloadInsight = {
  themes: string[];
  overloaded: boolean;
  recommendation: string;
};

export type BrewStructuredProposal = {
  id: string;
  title: string;
  mode: "brew" | "what-if" | "surprise";
  intentChanges: BrewConstraint[];
  strategyChanges: string[];
  suggestedAdds: DeckChangeProposal["adds"];
  suggestedCuts: DeckChangeProposal["removes"];
  constraints: BrewConstraint[];
  explanation: string;
  validation: DeckValidationResult;
  projectedHealthDelta: DeckChangeProposal["projectedHealthDelta"];
  additionalCost: number | null;
};

export type DeckArchitectBrewAnalysis = {
  parsedConstraints: BrewConstraint[];
  hiddenSynergies: HiddenSynergyCluster[];
  personality: DeckPersonalityReport;
  roleCompression: RoleCompressionInsight[];
  strategyOverload: StrategyOverloadInsight;
  proposals: BrewStructuredProposal[];
  surpriseDirections: BuildOpportunity[];
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

export type DeckArchetypeTaxonomy = {
  primaryArchetypes: string[];
  strategies: string[];
  themes: string[];
  typal: string[];
  mechanics: string[];
};

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
  taxonomy?: DeckArchetypeTaxonomy;
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

export type DeckGenerationStatus = "complete" | "draft_shell" | "failed";

export type CommanderGenerationResult = {
  generationStatus: DeckGenerationStatus;
  requirements: DeckRequirement[];
  validation: DeckValidationResult;
  ownership: OwnershipMatch[];
  buildability: BuildabilityScore | null;
  qualityGates: {
    formatValid: boolean;
    commanderValid: boolean;
    canonicalFactsKnown: boolean;
    legalityKnown: boolean;
    colorIdentityValid: boolean;
    archetypeValid: boolean;
    archetypeDensityAcceptable: boolean;
    strategyCoherent: boolean;
    strategySynergyAcceptable: boolean;
    roleCoverageAcceptable: boolean;
    manaBaseAcceptable: boolean;
    candidateConfidenceAcceptable: boolean;
    deckIdentityAcceptable: boolean;
    noRejectedCards: boolean;
    noFiller: boolean;
  };
  pricingSummary: {
    knownCompletionCost: number | null;
    unavailablePriceCount: number;
  };
  strategyFit: CommanderStrategyFit | null;
  candidateSourcePolicy: string;
  candidateSource: "owned-only" | "owned-plus-curated" | "global-scryfall" | "global-fixture";
  generatedCardCount: number;
  archetypeProfile: ArchetypeProfile | null;
  diagnostics?: {
    commander: string;
    strategy: string | null;
    rejectionCounts: Record<string, number>;
    composition: Record<ArchetypeCandidateCategory, number>;
  };
  failure: string | null;
  warnings: string[];
  performanceMs?: number;
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
