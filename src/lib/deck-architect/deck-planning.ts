import { evaluateCandidate, type ArchetypeCandidateEvaluation } from "./archetypes.ts";
import { classifyCardRoles } from "./card-roles.ts";
import { getCommanderCatalogCandidates } from "./commander-catalog.ts";
import { inferCommanderStrategies } from "./local-knowledge.ts";
import { normalizeCardKey } from "./ownership.ts";
import type {
  BuildIntentId,
  CardInclusionJustification,
  CollectionGraphCard,
  CommanderMechanicalProfile,
  CommanderCardRecommendation,
  CommanderKnowledgeProvider,
  CommanderMetaProfile,
  CommanderShell,
  CommanderStrategyProfile,
  DeckArchitectRole,
  DeckBudgetConstraints,
  DeckCritique,
  DeckPlan,
  DeckRequirement,
  FinalHumanSanityReview,
  RecommendationEvidence,
} from "./types.ts";

type ComparableCandidate = {
  card: CollectionGraphCard;
  evaluation: ArchetypeCandidateEvaluation;
  evidence: RecommendationEvidence;
};

export class TradingDocksCommanderKnowledgeProvider implements CommanderKnowledgeProvider {
  async getCommanderProfile(commanderId: string): Promise<CommanderMetaProfile | null> {
    return {
      commanderId,
      commanderName: commanderId,
      strategyEvidence: [],
      source: "curated",
      observedDeckCount: null,
    };
  }

  async getStrategies(_commanderId: string) {
    return [];
  }

  async getRecommendedCards(commanderId: string, strategyId?: string): Promise<CommanderCardRecommendation[]> {
    const commander = commanderFromKnowledgeId(commanderId);
    const strategy = inferCommanderStrategies(commander).find((candidate) => !strategyId || candidate.id === strategyId) ?? null;
    return getCommanderCatalogCandidates({ commander, intentId: "strongest-possible", strategy })
      .map((seed) => ({
        ...seed,
        commanderId,
        strategyId: strategy?.id,
        tier: seed.roles.some((role) => strategy?.roles.includes(role)) ? "strong-synergy" : "generic-structural",
        commanderSynergyScore: seed.roles.some((role) => strategy?.roles.includes(role)) ? 0.82 : 0.55,
        inclusionFrequency: null,
        provenance: ["Trading Docks authored commander knowledge."],
      }));
  }

  async getAverageShell(commanderId: string, strategyId?: string): Promise<CommanderShell | null> {
    const commander = commanderFromKnowledgeId(commanderId);
    const strategy = inferCommanderStrategies(commander).find((candidate) => !strategyId || candidate.id === strategyId) ?? null;
    if (!strategy) return null;
    const plan = createCommanderDeckPlan({ commander, strategy, intentId: "strongest-possible", budget: { enabled: false } });
    return {
      commanderId,
      strategyId: strategy.id,
      coreCards: strategy.coreCards ?? [],
      strongSynergyCards: strategy.flexCards ?? [],
      flexibleRoleTargets: Object.entries(plan.desiredRoleRanges).map(([role, range]) => ({
        role: role as DeckArchitectRole,
        ...range,
      })),
      landTarget: {
        min: plan.desiredLandRampBehavior.landMin,
        ideal: Math.round((plan.desiredLandRampBehavior.landMin + plan.desiredLandRampBehavior.landMax) / 2),
        max: plan.desiredLandRampBehavior.landMax,
      },
      curveTarget: plan.desiredManaCurve,
    };
  }
}

export const TRADING_DOCKS_COMMANDER_KNOWLEDGE_PROVIDER = new TradingDocksCommanderKnowledgeProvider();

export function createCommanderDeckPlan({
  commander,
  strategy,
  intentId,
  budget,
}: {
  commander: CollectionGraphCard;
  strategy: CommanderStrategyProfile | null;
  intentId: BuildIntentId;
  budget: DeckBudgetConstraints;
}): DeckPlan {
  const mechanicalProfile = createCommanderMechanicalProfile(commander, strategy);
  const strategyLabel = strategy?.label ?? mechanicalProfile.commanderName;
  const desiredRoleRanges: DeckPlan["desiredRoleRanges"] = {};
  for (const metric of mechanicalProfile.qualityMetrics) {
    for (const role of metric.roles) {
      desiredRoleRanges[role] = { min: metric.min, ideal: metric.ideal };
    }
  }
  for (const role of mechanicalProfile.supportRoles) {
    desiredRoleRanges[role] ??= { min: role === "ramp" ? 8 : role === "interaction" ? 7 : 3, ideal: role === "ramp" ? 11 : role === "interaction" ? 10 : 5 };
  }

  return {
    commander: commander.name,
    selectedStrategy: strategyLabel,
    primaryGamePlan: strategy?.summary ?? primaryGamePlanForProfile(mechanicalProfile),
    secondaryGamePlan: secondaryGamePlanForProfile(mechanicalProfile),
    keyEnablers: mechanicalProfile.enablerRoles,
    keyPayoffs: mechanicalProfile.payoffRoles,
    requiredSupportRoles: mechanicalProfile.supportRoles,
    winConditions: mechanicalProfile.payoffRoles.includes("finisher") ? ["finisher"] : [...mechanicalProfile.payoffRoles, "finisher"],
    antiSynergies: mechanicalProfile.antiSynergies,
    commanderSpecificMechanicalRequirements: [
      ...mechanicalProfile.triggerModel,
      ...mechanicalProfile.payoffModel,
    ],
    desiredRoleRanges,
    desiredManaCurve: { earlyPlays: 12, midgamePlays: 18, topEndLimit: 10 },
    desiredLandRampBehavior: {
      landMin: 34,
      landMax: 39,
      rampMin: 8,
      fixingRequired: (commander.colorIdentity?.length ?? 0) >= 2,
    },
    buildIntent: intentId,
    budgetConstraints: budget,
    mechanicalProfile,
  };
}

export function createCommanderMechanicalProfile(
  commander: CollectionGraphCard,
  strategy: CommanderStrategyProfile | null = null,
): CommanderMechanicalProfile {
  const name = commander.name.toLowerCase();
  const strategyText = `${strategy?.id ?? ""} ${strategy?.label ?? ""} ${strategy?.summary ?? ""}`.toLowerCase();
  if (name.includes("winota")) {
    return {
      commanderName: commander.name,
      triggerModel: ["Non-Human creatures must attack to trigger Winota."],
      payoffModel: ["High-impact Humans are the payoff because Winota puts them into combat."],
      enablerRoles: ["non-human-enabler", "token-generation", "attack-support"],
      payoffRoles: ["human-payoff", "finisher"],
      supportRoles: ["ramp", "interaction", "protection"],
      antiSynergies: [
        "Weak Humans with poor hit quality.",
        "Expensive non-Humans that do not reliably attack.",
        "Generic fixing that does not accelerate the attack plan.",
      ],
      qualityMetrics: [
        { key: "non-human-enablers", label: "Non-Human enabler density", roles: ["non-human-enabler", "token-generation"], min: 12, ideal: 18 },
        { key: "human-payoffs", label: "Human payoff density", roles: ["human-payoff"], min: 8, ideal: 12 },
        { key: "attack-support", label: "Attack support", roles: ["attack-support", "protection"], min: 4, ideal: 8 },
      ],
      confidence: "curated",
    };
  }
  if (name.includes("nekusar") || strategyText.includes("wheel") || strategyText.includes("draw punishment")) {
    return {
      commanderName: commander.name,
      triggerModel: ["Opponents drawing cards causes damage.", "Wheels force multiple opponents to draw and discard."],
      payoffModel: ["Draw-punishment effects multiply Nekusar's pressure.", "Group-draw and hand-cycling effects create repeated triggers."],
      enablerRoles: ["wheel", "group-draw", "hand-cycling"],
      payoffRoles: ["draw-punishment", "burn", "finisher"],
      supportRoles: ["ramp", "interaction", "protection"],
      antiSynergies: ["Incidental cantrips as primary card advantage.", "Unrelated Grixis filler.", "Removal spells chosen only because they draw one card."],
      qualityMetrics: [
        { key: "wheel-density", label: "Wheel density", roles: ["wheel", "hand-cycling"], min: 6, ideal: 10 },
        { key: "punishment-density", label: "Draw punishment density", roles: ["draw-punishment"], min: 6, ideal: 10 },
      ],
      confidence: "curated",
    };
  }
  if (name.includes("krenko")) {
    return {
      commanderName: commander.name,
      triggerModel: ["Goblin density and token production scale Krenko's output."],
      payoffModel: ["Goblin payoffs, haste, and sacrifice outlets turn tokens into wins."],
      enablerRoles: ["goblin-token-maker", "token-generation", "haste-enabler" as DeckArchitectRole],
      payoffRoles: ["goblin-payoff" as DeckArchitectRole, "finisher", "sacrifice-outlet"],
      supportRoles: ["ramp", "interaction", "card-advantage"],
      antiSynergies: ["Excessive non-Goblin generic filler.", "Artifacts that do not accelerate or multiply Goblins."],
      qualityMetrics: [
        { key: "goblin-density", label: "Goblin density", roles: ["synergy", "token-generation"], min: 22, ideal: 32 },
        { key: "token-payoffs", label: "Token payoff density", roles: ["token-generation", "sacrifice-outlet", "finisher"], min: 12, ideal: 18 },
      ],
      confidence: "curated",
    };
  }
  if (name.includes("muldrotha")) {
    return {
      commanderName: commander.name,
      triggerModel: ["Muldrotha rewards permanents in the graveyard."],
      payoffModel: ["Permanent-based interaction and recursion create repeatable value."],
      enablerRoles: ["graveyard-interaction", "recursion"],
      payoffRoles: ["recursion", "card-advantage"],
      supportRoles: ["ramp", "interaction", "protection"],
      antiSynergies: ["Excessive instants and sorceries without strong justification.", "Cards that do not stock or use the graveyard."],
      qualityMetrics: [
        { key: "permanent-density", label: "Permanent density", roles: ["recursion", "graveyard-interaction"], min: 16, ideal: 26 },
        { key: "graveyard-setup", label: "Graveyard setup", roles: ["graveyard-interaction"], min: 8, ideal: 14 },
      ],
      confidence: "curated",
    };
  }
  if (name.includes("atraxa") && strategyText.includes("poison")) {
    return {
      commanderName: commander.name,
      triggerModel: ["Atraxa proliferates poison counters once opponents are marked."],
      payoffModel: ["Poison, infect, toxic, and proliferate pressure alternate win conditions."],
      enablerRoles: ["poison" as DeckArchitectRole, "infect" as DeckArchitectRole, "toxic" as DeckArchitectRole],
      payoffRoles: ["proliferate" as DeckArchitectRole, "finisher"],
      supportRoles: ["ramp", "interaction", "protection"],
      antiSynergies: ["Counter-only packages leaking into poison strategy.", "Slow value cards without poison or proliferate pressure."],
      qualityMetrics: [
        { key: "poison-density", label: "Poison card density", roles: ["poison" as DeckArchitectRole, "infect" as DeckArchitectRole, "toxic" as DeckArchitectRole], min: 8, ideal: 14 },
        { key: "proliferate-support", label: "Proliferate support", roles: ["proliferate" as DeckArchitectRole], min: 5, ideal: 9 },
      ],
      confidence: "curated",
    };
  }
  if (name.includes("atraxa")) {
    return {
      commanderName: commander.name,
      triggerModel: ["Atraxa proliferates counters already placed on permanents or players."],
      payoffModel: ["Counter placement plus proliferate grows threats and engines."],
      enablerRoles: ["synergy"],
      payoffRoles: ["threat", "finisher"],
      supportRoles: ["ramp", "interaction", "protection"],
      antiSynergies: ["Poison-only packages leaking into counters strategy when not selected."],
      qualityMetrics: [
        { key: "counter-density", label: "Counter placement density", roles: ["synergy"], min: 10, ideal: 18 },
        { key: "proliferate-support", label: "Proliferate support", roles: ["proliferate" as DeckArchitectRole], min: 5, ideal: 9 },
      ],
      confidence: "curated",
    };
  }
  const roles = strategy?.roles?.length ? strategy.roles : classifyCardRoles(commander);
  return {
    commanderName: commander.name,
    triggerModel: ["Inferred from commander text and selected strategy evidence."],
    payoffModel: ["Cards must support the selected commander strategy or a high-confidence support role."],
    enablerRoles: roles.slice(0, 3),
    payoffRoles: roles.filter((role) => role === "finisher" || role === "synergy" || role === "card-advantage").slice(0, 3),
    supportRoles: ["ramp", "interaction", "protection"],
    antiSynergies: ["Cards with only weak oracle-text relevance.", "Generic filler that does not advance the plan."],
    qualityMetrics: [
      { key: "strategy-density", label: "Strategy density", roles: roles.slice(0, 4), min: 10, ideal: 18 },
    ],
    confidence: "inferred",
  };
}

export function justifyCardInclusion({
  requirement,
  deckPlan,
}: {
  requirement: DeckRequirement;
  deckPlan: DeckPlan;
}): CardInclusionJustification {
  const roles = requirement.primaryRoles?.length ? requirement.primaryRoles : requirement.roles;
  const primaryRole = roles.find((role) => role !== "land") ?? roles[0] ?? "synergy";
  const evidence = requirement.recommendationEvidence;
  const evidenceClass = evidence?.professionalQuality === "verified-core"
    ? "verified_core"
    : evidence?.professionalQuality === "strong-match"
      ? "strong_match"
      : evidence?.professionalQuality === "good-support"
        ? "good_support"
        : evidence?.professionalQuality === "possible"
          ? "possible"
          : evidence?.professionalQuality === "reject"
            ? "reject"
            : requirement.archetypeCategory === "core"
              ? "verified_core"
              : requirement.archetypeCategory === "synergy"
                ? "strong_match"
                : requirement.archetypeCategory === "support" || requirement.archetypeCategory === "generic"
                  ? "good_support"
                  : "possible";
  const commanderRelationship = relationshipForRoles(primaryRole, deckPlan.mechanicalProfile.enablerRoles, "enables the commander trigger")
    .concat(relationshipForRoles(primaryRole, deckPlan.mechanicalProfile.payoffRoles, "converts the commander plan into pressure or a win"));
  const strategyRelationship = requirement.strategyTags?.length
    ? requirement.strategyTags.map((tag) => `Matches ${tag.replace(/-/g, " ")} strategy evidence.`)
    : evidence?.reasons?.filter((reason) => /strategy|core|synergy/i.test(reason)) ?? [];
  const deckPlanRelationship = [
    deckPlan.desiredRoleRanges[primaryRole] ? `Fills planned ${primaryRole.replace(/-/g, " ")} capacity.` : null,
    deckPlan.requiredSupportRoles.includes(primaryRole) ? "Supplies required support for the deck plan." : null,
  ].filter((value): value is string => Boolean(value));
  const confidence = confidenceForJustification(evidenceClass, commanderRelationship.length + strategyRelationship.length + deckPlanRelationship.length);
  return {
    cardId: requirement.id,
    primaryRole,
    secondaryRoles: requirement.secondaryRoles ?? requirement.roles.filter((role) => role !== primaryRole),
    commanderRelationship,
    strategyRelationship,
    deckPlanRelationship,
    evidenceClass,
    alternativeAdvantage: evidenceClass === "verified_core" || evidenceClass === "strong_match"
      ? ["Higher commander or strategy fit than generic alternatives for this slot."]
      : undefined,
    confidence,
    ownership: evidence?.ownership ?? { owned: false, quantity: 0 },
    budgetStatus: budgetStatusForRequirement(requirement, deckPlan),
  };
}

export function compareCommanderCandidates({
  left,
  right,
  role,
  deckPlan,
}: {
  left: ComparableCandidate;
  right: ComparableCandidate;
  role?: DeckArchitectRole;
  deckPlan: DeckPlan;
}) {
  const leftScore = contextualCandidateScore(left, deckPlan, role);
  const rightScore = contextualCandidateScore(right, deckPlan, role);
  const winner = leftScore >= rightScore ? "left" : "right";
  return {
    winner,
    leftScore,
    rightScore,
    reasons: [
      `Commander synergy ${Math.round((roleOverlap(left.evaluation.primaryRoles, deckPlan.keyEnablers) + roleOverlap(left.evaluation.primaryRoles, deckPlan.keyPayoffs)) * 10)} vs ${Math.round((roleOverlap(right.evaluation.primaryRoles, deckPlan.keyEnablers) + roleOverlap(right.evaluation.primaryRoles, deckPlan.keyPayoffs)) * 10)}.`,
      `Professional evidence ${left.evidence.professionalQuality} vs ${right.evidence.professionalQuality}.`,
      role ? `Contested role: ${role}.` : "General deck-plan comparison.",
    ],
  };
}

export function critiqueCommanderDeck({
  deckPlan,
  requirements,
}: {
  deckPlan: DeckPlan;
  requirements: DeckRequirement[];
}): DeckCritique {
  const mainNonland = requirements.filter((requirement) => requirement.board === "main" && !requirement.roles.includes("land"));
  const roleCounts = countRoles(mainNonland);
  const weakCards = mainNonland
    .filter((requirement) => !requirement.isCommander)
    .map((requirement) => {
      const justification = requirement.inclusionJustification ?? justifyCardInclusion({ requirement, deckPlan });
      const reasons = weakCardReasons(requirement, justification, deckPlan);
      return reasons.length
        ? {
            cardId: requirement.id,
            cardName: requirement.name,
            reasons,
            severity: reasons.some((reason) => /anti-synergy|low-confidence|wrong strategy|cannot answer|incidental draw/i.test(reason)) ? "high" as const : "medium" as const,
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const missingFunctions = Object.entries(deckPlan.desiredRoleRanges)
    .filter(([role, range]) => (roleCounts[role] ?? 0) < range.min)
    .map(([role]) => role as DeckArchitectRole);
  const overrepresentedFunctions = Object.entries(deckPlan.desiredRoleRanges)
    .filter(([role, range]) => typeof range.max === "number" && (roleCounts[role] ?? 0) > range.max)
    .map(([role]) => role as DeckArchitectRole);
  const structuralIssues = [
    ...deckPlan.mechanicalProfile.qualityMetrics
      .filter((metric) => metric.roles.reduce((sum, role) => sum + (roleCounts[role] ?? 0), 0) < metric.min)
      .map((metric) => `${metric.label} is below the planned floor.`),
    weakCards.filter((card) => card.severity === "high").length ? "One or more nonland cards cannot justify their place in this commander plan." : null,
  ].filter((issue): issue is string => Boolean(issue));
  const replacementRequests = weakCards
    .filter((card) => card.severity === "high")
    .map((card) => {
      const requirement = requirements.find((item) => item.id === card.cardId);
      return {
        cardId: card.cardId,
        replaceCardName: card.cardName,
        desiredRoles: missingFunctions.length ? missingFunctions : deckPlan.keyEnablers.concat(deckPlan.keyPayoffs).slice(0, 3),
        reasons: card.reasons,
        budgetConstraints: deckPlan.budgetConstraints,
      };
    });
  const confidence = Math.max(0, Math.min(1, 1 - (weakCards.length * 0.05) - (missingFunctions.length * 0.04) - (structuralIssues.length * 0.08)));
  return {
    weakCards,
    missingFunctions,
    overrepresentedFunctions,
    structuralIssues,
    replacementRequests,
    confidence,
  };
}

export function finalHumanSanityReview({
  deckPlan,
  critique,
  requirements,
}: {
  deckPlan: DeckPlan;
  critique: DeckCritique;
  requirements: DeckRequirement[];
}): FinalHumanSanityReview {
  const highSeverity = critique.weakCards.filter((card) => card.severity === "high");
  const unjustified = requirements.filter((requirement) =>
    requirement.board === "main" &&
    !requirement.roles.includes("land") &&
    !requirement.isCommander &&
    (requirement.inclusionJustification?.confidence ?? 0) < 0.58
  );
  const reasons = [
    highSeverity.length ? `${highSeverity.length} high-severity card critique finding${highSeverity.length === 1 ? "" : "s"} remain.` : null,
    unjustified.length ? `${unjustified.length} nonland card${unjustified.length === 1 ? "" : "s"} lack a strong inclusion justification.` : null,
    critique.structuralIssues.length ? critique.structuralIssues[0] : null,
    deckPlan.mechanicalProfile.confidence === "inferred" ? "Commander plan is inferred and should remain review-first." : null,
  ].filter((reason): reason is string => Boolean(reason));
  return {
    status: reasons.length ? "review_required" : "pass",
    reasons,
    confidence: Math.max(0, Math.min(1, critique.confidence - (unjustified.length * 0.03))),
  };
}

export function validateDeckCriticOutput(value: unknown): value is DeckCritique {
  if (!value || typeof value !== "object") return false;
  const output = value as Partial<DeckCritique>;
  return Array.isArray(output.weakCards) &&
    Array.isArray(output.missingFunctions) &&
    Array.isArray(output.overrepresentedFunctions) &&
    Array.isArray(output.structuralIssues) &&
    Array.isArray(output.replacementRequests) &&
    typeof output.confidence === "number";
}

function primaryGamePlanForProfile(profile: CommanderMechanicalProfile) {
  return `${profile.commanderName} should prioritize ${profile.enablerRoles.map((role) => role.replace(/-/g, " ")).join(", ")} before generic support.`;
}

function commanderFromKnowledgeId(commanderId: string): CollectionGraphCard {
  const name =
    commanderId.includes(",") || commanderId.includes(" ")
      ? commanderId
      : commanderId
          .split(/[-_]/g)
          .filter(Boolean)
          .map((part) => part[0]?.toUpperCase() + part.slice(1))
          .join(" ");
  const lower = name.toLowerCase();
  return {
    inventoryId: `knowledge:${normalizeCardKey(name)}`,
    name,
    quantityOwned: 0,
    typeLine: lower.includes("krenko")
      ? "Legendary Creature - Goblin Warrior"
      : lower.includes("winota")
        ? "Legendary Creature - Human Warrior"
        : "Legendary Creature",
    oracleText: lower.includes("krenko")
      ? "Tap: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control."
      : lower.includes("winota")
        ? "Whenever a non-Human creature you control attacks, look at the top six cards of your library. You may put a Human creature card from among them onto the battlefield tapped and attacking."
        : "",
    colorIdentity: lower.includes("krenko") ? ["R"] : lower.includes("winota") ? ["R", "W"] : [],
    legalities: { commander: "legal" },
    marketPrice: null,
  };
}

function secondaryGamePlanForProfile(profile: CommanderMechanicalProfile) {
  return `Support the primary plan with ${profile.supportRoles.map((role) => role.replace(/-/g, " ")).join(", ")} while avoiding low-confidence filler.`;
}

function relationshipForRoles(role: DeckArchitectRole, roles: DeckArchitectRole[], message: string) {
  return roles.includes(role) ? [message] : [];
}

function budgetStatusForRequirement(requirement: DeckRequirement, deckPlan: DeckPlan): CardInclusionJustification["budgetStatus"] {
  const budget = deckPlan.budgetConstraints;
  const owned = requirement.recommendationEvidence?.ownership.owned;
  if (owned) return "owned";
  if (!budget.enabled) return "not-budgeted";
  const price = requirement.estimatedPrice;
  if (price === null || price === undefined || !Number.isFinite(price)) return "unknown-price";
  if (typeof budget.maxMissingCardPriceCents === "number" && price * 100 > budget.maxMissingCardPriceCents) return "over-budget";
  return "within-budget";
}

function confidenceForJustification(evidenceClass: CardInclusionJustification["evidenceClass"], relationshipCount: number) {
  const base =
    evidenceClass === "verified_core" ? 0.92 :
    evidenceClass === "strong_match" ? 0.82 :
    evidenceClass === "good_support" ? 0.68 :
    evidenceClass === "possible" ? 0.44 : 0.12;
  return Math.min(0.98, base + Math.min(0.12, relationshipCount * 0.03));
}

function contextualCandidateScore(candidate: ComparableCandidate, deckPlan: DeckPlan, role?: DeckArchitectRole) {
  const primaryRoles = candidate.evaluation.primaryRoles;
  return candidate.evaluation.score +
    professionalQualityScore(candidate.evidence.professionalQuality) +
    roleOverlap(primaryRoles, deckPlan.keyEnablers) * 22 +
    roleOverlap(primaryRoles, deckPlan.keyPayoffs) * 22 +
    roleOverlap(primaryRoles, deckPlan.requiredSupportRoles) * 10 +
    (role && primaryRoles.includes(role) ? 28 : 0) +
    (candidate.evidence.ownership.owned ? 8 : 0);
}

function professionalQualityScore(quality: RecommendationEvidence["professionalQuality"]) {
  if (quality === "verified-core") return 48;
  if (quality === "strong-match") return 34;
  if (quality === "good-support") return 18;
  if (quality === "possible") return -12;
  return -1000;
}

function roleOverlap(left: DeckArchitectRole[], right: DeckArchitectRole[]) {
  return left.filter((role) => right.includes(role)).length;
}

function countRoles(requirements: DeckRequirement[]) {
  const counts: Record<string, number> = {};
  for (const requirement of requirements) {
    for (const role of requirement.roles) {
      counts[role] = (counts[role] ?? 0) + requirement.requiredQuantity;
    }
  }
  return counts;
}

function weakCardReasons(
  requirement: DeckRequirement,
  justification: CardInclusionJustification,
  deckPlan: DeckPlan,
) {
  const reasons: string[] = [];
  const roles = new Set(requirement.roles);
  if (justification.evidenceClass === "reject") reasons.push("Professional evidence rejects this card.");
  if (justification.evidenceClass === "possible" && justification.confidence < 0.58) reasons.push("Low-confidence inclusion cannot answer why this card belongs here.");
  if (isWeakCriticalSupportSlot(requirement, deckPlan)) {
    reasons.push("Low-confidence support role cannot fill a critical ramp, fixing, or card-advantage slot.");
  }
  if (!justification.commanderRelationship.length && !justification.strategyRelationship.length && !justification.deckPlanRelationship.length) {
    reasons.push("Cannot answer why this card belongs in this commander strategy.");
  }
  if (deckPlan.selectedStrategy.toLowerCase().includes("nekusar") || deckPlan.commander.toLowerCase().includes("nekusar") || deckPlan.selectedStrategy.toLowerCase().includes("wheel")) {
    if ((roles.has("incidental-draw") || roles.has("cantrip")) && !roles.has("wheel") && !roles.has("draw-punishment") && !roles.has("group-draw")) {
      reasons.push("Incidental draw is not a primary Nekusar Wheels card-advantage slot.");
    }
  }
  if (deckPlan.commander.toLowerCase().includes("muldrotha")) {
    const typeLine = requirement.typeLine?.toLowerCase() ?? "";
    if ((typeLine.includes("instant") || typeLine.includes("sorcery")) && !roles.has("graveyard-interaction") && !roles.has("recursion")) {
      reasons.push("Non-permanent spell reduces Muldrotha commander synergy without strong graveyard justification.");
    }
  }
  return reasons;
}

function isWeakCriticalSupportSlot(requirement: DeckRequirement, deckPlan: DeckPlan) {
  const acceptedProfessionalQualities = new Set(["verified-core", "strong-match", "good-support"]);
  const professionalQuality = requirement.recommendationEvidence?.professionalQuality;
  if (professionalQuality && acceptedProfessionalQualities.has(professionalQuality)) return false;
  if (requirement.archetypeCategory === "core" || requirement.archetypeCategory === "synergy") return false;
  const criticalRoles = new Set<DeckArchitectRole>([
    "ramp",
    "mana-rock",
    "mana-dork",
    "ritual",
    "cost-reduction",
    "mana-fixing",
    "color-fixing",
    "land-fixing",
    "card-draw",
    "card-advantage",
  ]);
  const fillsCriticalRole = requirement.roles.some((role) => criticalRoles.has(role) && deckPlan.desiredRoleRanges[role]);
  if (!fillsCriticalRole) return false;
  const justificationConfidence = requirement.inclusionJustification?.confidence ?? 0;
  const evidenceConfidence = requirement.recommendationEvidence?.confidence ?? "insufficient";
  return justificationConfidence < 0.62 || evidenceConfidence === "possible" || evidenceConfidence === "insufficient";
}
