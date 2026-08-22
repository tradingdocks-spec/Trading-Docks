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
  | "utility-mana"
  | "card-draw"
  | "card-advantage"
  | "wheel"
  | "group-draw"
  | "draw-punishment"
  | "conditional-draw"
  | "incidental-draw"
  | "cantrip"
  | "hand-cycling"
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
  | "token-payoff"
  | "untap-engine"
  | "sacrifice-outlet"
  | "discard"
  | "lifegain"
  | "burn"
  | "artifact-interaction"
  | "enchantment-interaction"
  | "goblin-token-maker"
  | "goblin-payoff"
  | "haste-enabler"
  | "poison"
  | "infect"
  | "toxic"
  | "proliferate"
  | "non-human-enabler"
  | "human-payoff"
  | "attack-support"
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
  | "wheel"
  | "group-draw"
  | "draw-punishment"
  | "hand-cycling"
  | "group-slug"
  | "opponent-draw"
  | "discard"
  | "burn"
  | "non-human-enabler"
  | "human-payoff"
  | "attack-support"
  | "interaction"
  | "ramp"
  | "protection"
  | "board-wipe";

export type ArchetypeCandidateCategory = "core" | "synergy" | "support" | "generic" | "reject";

export type RecommendationEvidenceConfidence = "strong" | "good" | "possible" | "insufficient";
export type ProfessionalEvidenceQuality = "verified-core" | "strong-match" | "good-support" | "possible" | "reject";

export type RecommendationEvidenceProvenance = {
  canonicalCardSource: "catalog" | "curated" | "collection" | "global-provider" | "unknown";
  legalitySource: "scryfall" | "catalog" | "curated" | "collection" | "unknown";
  archetypeSource: "curated" | "corpus" | "licensed-provider" | "deterministic" | "none";
  roleSource: "deterministic-role-classifier";
  corpusSource?: string;
  comboSource?: string;
  priceSource: "collection" | "catalog" | "curated" | "provider" | "unknown";
  ownershipSource: "user-collection";
};

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
  professionalQuality: ProfessionalEvidenceQuality;
  provenance: RecommendationEvidenceProvenance;
  reasons: string[];
  rejectionReasons?: string[];
  sourceCategories: Array<"curated" | "corpus" | "combo" | "inferred" | "owned">;
};

export type DeckBudgetConstraints = {
  enabled?: boolean;
  maxMissingCardPriceCents?: number | null;
  maxTotalMissingCardBudgetCents?: number | null;
  strict?: boolean;
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
  sourceDate?: string | null;
  freshnessDays?: number | null;
  theme?: string | null;
  archetype?: string | null;
  observedDeckCount?: number | null;
  commanderAffinity?: number | null;
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
  sourceDate?: string | null;
  freshnessDays?: number | null;
  provenance: string[];
};

export type CommanderCardRecommendation = DeckKnowledgeCardSeed & {
  commanderId: string;
  strategyId?: string;
  tier: "core" | "strong-synergy" | "support" | "generic-structural";
  inclusionFrequency?: number | null;
  commanderSynergyScore?: number | null;
  provenance: string[];
};

export type CommanderShell = {
  commanderId: string;
  strategyId: string;
  coreCards: DeckKnowledgeCardSeed[];
  strongSynergyCards: DeckKnowledgeCardSeed[];
  flexibleRoleTargets: Array<{ role: DeckArchitectRole; min: number; ideal: number; max?: number }>;
  landTarget: { min: number; ideal: number; max: number };
  curveTarget?: {
    earlyPlays: number;
    midgamePlays: number;
    topEndLimit: number;
  };
};

export type CommanderKnowledgeProvider = {
  getCommanderProfile(commanderId: string): Promise<CommanderMetaProfile | null>;
  getStrategies(commanderId: string): Promise<CommanderStrategyEvidence[]>;
  getRecommendedCards(commanderId: string, strategyId?: string): Promise<CommanderCardRecommendation[]>;
  getAverageShell(commanderId: string, strategyId?: string): Promise<CommanderShell | null>;
};

export type CommanderMechanicalProfile = {
  commanderName: string;
  triggerModel: string[];
  payoffModel: string[];
  enablerRoles: DeckArchitectRole[];
  payoffRoles: DeckArchitectRole[];
  supportRoles: DeckArchitectRole[];
  antiSynergies: string[];
  qualityMetrics: Array<{
    key: string;
    label: string;
    roles: DeckArchitectRole[];
    min: number;
    ideal: number;
  }>;
  confidence: "curated" | "inferred";
};

export type DeckPlan = {
  commander: string;
  selectedStrategy: string;
  primaryGamePlan: string;
  secondaryGamePlan: string;
  keyEnablers: DeckArchitectRole[];
  keyPayoffs: DeckArchitectRole[];
  requiredSupportRoles: DeckArchitectRole[];
  winConditions: DeckArchitectRole[];
  antiSynergies: string[];
  commanderSpecificMechanicalRequirements: string[];
  desiredRoleRanges: Record<string, { min: number; ideal: number; max?: number }>;
  desiredManaCurve: {
    earlyPlays: number;
    midgamePlays: number;
    topEndLimit: number;
  };
  desiredLandRampBehavior: {
    landMin: number;
    landMax: number;
    rampMin: number;
    fixingRequired: boolean;
  };
  buildIntent: BuildIntentId;
  budgetConstraints: DeckBudgetConstraints;
  mechanicalProfile: CommanderMechanicalProfile;
};

export type CommanderStrategySignalSource =
  | "trading-docks-authored"
  | "licensed-external"
  | "collection-derived"
  | "combo-provider"
  | "future-edhrec-licensed";

export type CommanderStrategyCardSignal = {
  cardName: string;
  source: CommanderStrategySignalSource;
  commanderSpecificInclusion?: number | null;
  commanderSpecificSynergy?: number | null;
  archetypeFit?: number | null;
  deckCountConfidence?: number | null;
  category?: ArchetypeCandidateCategory;
  roles?: DeckArchitectRole[];
  highSynergy?: boolean;
  commonlyPairedWith?: string[];
  comboRelationships?: string[];
  budgetBand?: "budget" | "mid" | "premium" | "unknown";
  powerBand?: "casual" | "focused" | "competitive" | "unknown";
  reasons?: string[];
  provenance: string[];
};

export type CommanderFunctionalPackageId =
  | "ramp"
  | "card-advantage"
  | "interaction"
  | "removal"
  | "board-protection"
  | "strategy-engines"
  | "synergy-payoffs"
  | "win-conditions"
  | "utility"
  | "lands";

export type CommanderFunctionalPackageTarget = {
  id: CommanderFunctionalPackageId;
  label: string;
  roles: DeckArchitectRole[];
  min: number;
  ideal: number;
  max?: number;
  reason: string;
};

export type CommanderStrategyRecommendation = {
  card: CollectionGraphCard;
  packageId: CommanderFunctionalPackageId;
  role: DeckArchitectRole;
  synergyScore: number;
  archetypeFit: number;
  commanderFit: number;
  roleFit: number;
  ownership: {
    owned: boolean;
    quantity: number;
  };
  priority: number;
  reasons: string[];
  comboRelationships: string[];
  signals: CommanderStrategyCardSignal[];
};

export type CommanderCutRecommendation = {
  cardName: string;
  role: DeckArchitectRole;
  priority: number;
  reasons: string[];
  strongerAlternatives: string[];
};

export type CommanderStrategyIntelligenceResult = {
  provider: {
    id: string;
    name: string;
    sources: readonly CommanderStrategySignalSource[];
    edhrecStatus: "not-used" | "licensed-provider-ready" | "licensed-provider-configured";
  };
  packageTargets: CommanderFunctionalPackageTarget[];
  recommendations: CommanderStrategyRecommendation[];
  cuts: CommanderCutRecommendation[];
  limitations: string[];
};

export type CommanderStrategyIntelligenceInput = {
  commander: CollectionGraphCard;
  strategy: CommanderStrategyProfile | null;
  archetype: ArchetypeProfile | null;
  deckPlan: DeckPlan;
  intentId: BuildIntentId;
  collection: CollectionGraphCard[];
  candidates: CollectionGraphCard[];
  currentRequirements?: DeckRequirement[];
  externalSignals?: CommanderStrategyCardSignal[];
};

export type CommanderStrategyIntelligenceProvider = {
  id: string;
  name: string;
  supportedSources: readonly CommanderStrategySignalSource[];
  resolve(input: CommanderStrategyIntelligenceInput): CommanderStrategyIntelligenceResult;
};

export type CardInclusionJustification = {
  cardId: string;
  primaryRole: DeckArchitectRole;
  secondaryRoles: DeckArchitectRole[];
  commanderRelationship: string[];
  strategyRelationship: string[];
  deckPlanRelationship: string[];
  evidenceClass: "verified_core" | "strong_match" | "good_support" | "possible" | "reject";
  alternativeAdvantage?: string[];
  confidence: number;
  ownership: {
    owned: boolean;
    quantity: number;
  };
  budgetStatus: "owned" | "within-budget" | "over-budget" | "unknown-price" | "not-budgeted";
};

export type DeckReplacementRequest = {
  cardId: string;
  replaceCardName: string;
  desiredRoles: DeckArchitectRole[];
  reasons: string[];
  budgetConstraints?: DeckBudgetConstraints;
};

export type DeckCritique = {
  weakCards: Array<{
    cardId: string;
    cardName: string;
    reasons: string[];
    severity: "low" | "medium" | "high";
  }>;
  missingFunctions: DeckArchitectRole[];
  overrepresentedFunctions: DeckArchitectRole[];
  structuralIssues: string[];
  replacementRequests: DeckReplacementRequest[];
  confidence: number;
};

export type DeckCriticProvider = {
  critique(input: {
    deckPlan: DeckPlan;
    requirements: DeckRequirement[];
  }): Promise<DeckCritique>;
};

export type DeckRevision = {
  iteration: number;
  removedCardName: string;
  addedCardName: string | null;
  reason: string;
};

export type FinalHumanSanityReview = {
  status: "pass" | "review_required";
  reasons: string[];
  confidence: number;
};

export type CardKnowledgeProvider = {
  getCard(cardId: string): Promise<CardKnowledge | null>;
  getCards(cardIds: string[]): Promise<CardKnowledge[]>;
};

export type CommanderMetaProvider = {
  getCommanderProfile(commanderId: string): Promise<CommanderMetaProfile | null>;
  getCommanderStrategies?(commanderId: string): Promise<CommanderStrategyEvidence[]>;
  getCommanderCardEvidence?(commanderId: string, cardId: string): Promise<CommanderCardEvidence | null>;
  getStrategyCardEvidence?(commanderId: string, strategyId: string, cardId: string): Promise<CommanderCardEvidence | null>;
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
  inclusionJustification?: CardInclusionJustification;
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
    professionalEvidenceAcceptable: boolean;
    budgetSatisfied: boolean;
    noRejectedCards: boolean;
    noFiller: boolean;
    finalSanityReviewPassed: boolean;
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
  strategyIntelligence?: CommanderStrategyIntelligenceResult;
  deckPlan?: DeckPlan;
  critique?: DeckCritique;
  revisionHistory?: DeckRevision[];
  finalSanityReview?: FinalHumanSanityReview;
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
