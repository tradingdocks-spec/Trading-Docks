import { calculateBuildabilityScore } from "./buildability.ts";
import { classifyCardRoles } from "./card-roles.ts";
import { getFormatProfile, maximumCopiesForCard } from "./formats.ts";
import { validateDeckRequirements } from "./legality.ts";
import {
  getLocalArchetypes,
  inferCommanderStrategies,
  LOCAL_DECK_KNOWLEDGE_PROVIDER,
  supportedRecommendationFormats,
} from "./local-knowledge.ts";
import { compareRequirementsToCollection, normalizeCardKey } from "./ownership.ts";
import type {
  BuildIntentId,
  BuildOpportunity,
  CollectionGraphCard,
  CommanderStrategyProfile,
  DeckArchitectFormatId,
  DeckArchitectIntelligence,
  DeckArchitectRole,
  DeckArchetypeProfile,
  DeckRecommendation,
  DeckRequirement,
  FormatProfile,
  OwnedSubstitution,
  OwnershipMatch,
  RecommendationConfidence,
} from "./types.ts";

export function generateDeckArchitectIntelligence({
  collection,
  generatedAt = new Date().toISOString(),
}: {
  collection: CollectionGraphCard[];
  generatedAt?: string;
}): DeckArchitectIntelligence {
  const opportunities = supportedRecommendationFormats()
    .flatMap((formatId) => rankBuildOpportunities(collection, formatId))
    .sort((left, right) => right.buildability.score - left.buildability.score)
    .slice(0, 8);
  const commanderStrategies: Record<string, CommanderStrategyProfile[]> = {};
  for (const commander of collection.filter((card) => card.typeLine?.toLowerCase().includes("legendary") && card.typeLine?.toLowerCase().includes("creature"))) {
    commanderStrategies[commander.inventoryId] = inferCommanderStrategies(commander);
  }

  return {
    generatedAt,
    supportedFormats: supportedRecommendationFormats(),
    provider: LOCAL_DECK_KNOWLEDGE_PROVIDER,
    opportunities,
    commanderStrategies,
    recommendations: opportunities.flatMap((opportunity) => opportunityToRecommendations(opportunity)).slice(0, 4),
    limitations: [
      "Pauper archetype recommendations use Trading Docks-authored role profiles and collection comparison.",
      "Commander strategy recommendations are deterministic rules based on owned commander metadata.",
      "Deck Vault proposal persistence and apply/revert remain disabled until a validated proposal table is approved.",
      "Combo providers are prepared as provider boundaries but not activated in this checkpoint.",
    ],
  };
}

export function rankBuildOpportunities(
  collection: CollectionGraphCard[],
  formatId: DeckArchitectFormatId,
): BuildOpportunity[] {
  if (formatId === "commander") return commanderOpportunities(collection);
  const format = getFormatProfile(formatId);
  return getLocalArchetypes(formatId).map((archetype) => archetypeOpportunity(archetype, collection, format));
}

export function assembleDeckRequirementsFromArchetype(
  archetype: DeckArchetypeProfile,
  format: FormatProfile,
): DeckRequirement[] {
  const seeds = [...archetype.coreCards, ...archetype.flexCards, ...(archetype.landPlan ?? [])];
  const requirements: DeckRequirement[] = [];
  let current = 0;
  const target = format.exactDeckSize ?? format.minimumMainDeckSize ?? 60;

  for (const seed of seeds) {
    if (current >= target) break;
    const quantity = Math.min(seed.quantity, maximumCopiesForCard(format, seed.name), target - current);
    if (quantity <= 0) continue;
    requirements.push({
      id: `${archetype.id}:${normalizeCardKey(seed.name)}`,
      name: seed.name,
      requiredQuantity: quantity,
      board: "main",
      roles: seed.roles,
      estimatedPrice: seed.estimatedPrice ?? null,
      importance: seed.importance ?? 1,
      typeLine: seed.typeLine,
      oracleText: seed.oracleText,
      colorIdentity: seed.colorIdentity,
      legalityStatus: "unknown",
    });
    current += quantity;
  }

  return requirements;
}

export function buildWorkingDeckRequirementsFromCollection(
  cards: CollectionGraphCard[],
  formatId: DeckArchitectFormatId,
  commander: CollectionGraphCard | null,
  intentId: BuildIntentId,
): DeckRequirement[] {
  const format = getFormatProfile(formatId);
  const targetSize = format.exactDeckSize ?? format.minimumMainDeckSize ?? 60;
  const pool = cards
    .filter((card) => !commander || card.inventoryId === commander.inventoryId || colorIdentityFits(card, commander))
    .sort((left, right) => scoreCardForIntent(right, intentId) - scoreCardForIntent(left, intentId));
  const requirements: DeckRequirement[] = [];

  if (commander) requirements.push(toRequirement(commander, 1, "commander", true));

  let currentCount = requirements.reduce((sum, card) => sum + card.requiredQuantity, 0);
  for (const card of pool) {
    if (commander && card.inventoryId === commander.inventoryId) continue;
    if (currentCount >= targetSize) break;
    const quantity = format.singleton ? 1 : Math.min(4, Math.max(1, Math.min(card.quantityOwned, 4)));
    const nextQuantity = Math.min(quantity, targetSize - currentCount);
    requirements.push(toRequirement(card, nextQuantity, "main", false));
    currentCount += nextQuantity;
  }

  return requirements;
}

export function recommendOwnedSubstitutions(
  missing: OwnershipMatch,
  collection: CollectionGraphCard[],
  format: FormatProfile,
  commander?: CollectionGraphCard | null,
) {
  return collection
    .filter((card) => card.quantityOwned > 0)
    .filter((card) => !commander || colorIdentityFits(card, commander))
    .filter((card) => !format.singleton || normalizeCardKey(card.name) !== normalizeCardKey(missing.requirement.name))
    .map((card): OwnedSubstitution => {
      const roles = classifyCardRoles(card);
      const roleOverlap = roles.filter((role) => missing.requirement.roles.includes(role)).length;
      const typeOverlap = card.typeLine && missing.requirement.typeLine && card.typeLine.split(" ")[0] === missing.requirement.typeLine.split(" ")[0] ? 1 : 0;
      const manaDelta = typeof card.manaValue === "number" && missing.requirement.manaCost
        ? Math.max(0, 4 - Math.abs(card.manaValue - estimateManaValue(missing.requirement.manaCost)))
        : 1;
      const score = roleOverlap * 34 + typeOverlap * 18 + manaDelta * 6 + Math.min(12, card.quantityOwned * 3);
      return {
        missingCardName: missing.requirement.name,
        ownedCard: card,
        score,
        confidence: confidenceForScore(score),
        reasons: [
          roleOverlap ? `${roleOverlap} role overlap${roleOverlap === 1 ? "" : "s"}` : "Role fit is weak",
          typeOverlap ? "Comparable card type" : "Different card type",
          card.location ? `Owned in ${card.location}` : "Owned in collection",
        ],
      };
    })
    .filter((item) => item.score >= 42)
    .sort((left, right) => right.score - left.score || left.ownedCard.name.localeCompare(right.ownedCard.name))
    .slice(0, 3);
}

export function proposeDeckRecommendations({
  requirements,
  collection,
  format,
  commander,
  lockedCardIds = new Set(),
  mustIncludeCardIds = new Set(),
}: {
  requirements: DeckRequirement[];
  collection: CollectionGraphCard[];
  format: FormatProfile;
  commander?: CollectionGraphCard | null;
  lockedCardIds?: Set<string>;
  mustIncludeCardIds?: Set<string>;
}): DeckRecommendation[] {
  const validation = validateDeckRequirements(requirements, format, {
    commander,
    lockedCardIds,
    mustIncludeCardIds,
  });
  if (!validation.valid) {
    return [{
      id: "validation-blocked",
      title: "Proposal blocked by validation",
      body: validation.issues[0]?.message ?? "Deck validation failed.",
      tone: "attention",
      confidence: "high",
      signals: validation.issues.slice(0, 3).map((issue) => ({
        label: issue.code,
        impact: issue.severity === "error" ? "negative" : "neutral",
        detail: issue.message,
      })),
      adds: [],
      cuts: [],
    }];
  }

  const matches = compareRequirementsToCollection(requirements, collection, format);
  const missing = matches.filter((match) => match.missingQuantity > 0);
  return missing.slice(0, 3).map((match) => {
    const substitutions = recommendOwnedSubstitutions(match, collection, format, commander);
    const best = substitutions[0];
    return {
      id: `substitute:${normalizeCardKey(match.requirement.name)}`,
      title: best ? `Use ${best.ownedCard.name} until ${match.requirement.name} is acquired` : `${match.requirement.name} is a real acquisition gap`,
      body: best
        ? `${best.ownedCard.name} is already owned and shares ${primaryRole(match.requirement.roles)} responsibilities.`
        : "No owned substitution scored highly enough to recommend.",
      tone: best ? "neutral" : "attention",
      confidence: best?.confidence ?? "medium",
      signals: best
        ? best.reasons.map((reason) => ({ label: "Substitution", impact: "neutral", detail: reason }))
        : [{ label: "Collection scan", impact: "negative", detail: "No role-compatible owned substitute found." }],
      adds: best ? [{
        name: best.ownedCard.name,
        quantity: Math.min(best.ownedCard.quantityOwned, match.missingQuantity),
        reason: `Owned substitute for ${match.requirement.name}.`,
        ownedQuantity: best.ownedCard.quantityOwned,
        additionalCost: 0,
      }] : [{
        name: match.requirement.name,
        quantity: match.missingQuantity,
        reason: `Missing ${primaryRole(match.requirement.roles)} role card.`,
        ownedQuantity: 0,
        additionalCost: match.estimatedMissingValue,
      }],
      cuts: [],
    };
  });
}

function archetypeOpportunity(
  archetype: DeckArchetypeProfile,
  collection: CollectionGraphCard[],
  format: FormatProfile,
): BuildOpportunity {
  const requirements = assembleDeckRequirementsFromArchetype(archetype, format);
  const matches = compareRequirementsToCollection(requirements, collection, format);
  const buildability = calculateBuildabilityScore(matches);
  const missingCards = matches.filter((match) => match.missingQuantity > 0);
  const ownedSubstitutions = missingCards.flatMap((match) => recommendOwnedSubstitutions(match, collection, format));
  const category = categoryForBuildability(buildability.score, buildability.missingUniqueCards, buildability.estimatedCompletionCost);
  return {
    id: archetype.id,
    name: archetype.name,
    formatId: archetype.formatId,
    archetypeId: archetype.id,
    buildability,
    category,
    missingCards,
    ownedSubstitutions,
    confidence: buildability.score >= 70 ? "high" : buildability.score >= 45 ? "medium" : "low",
    signals: [
      {
        label: "Owned coverage",
        impact: buildability.score >= 75 ? "positive" : buildability.score >= 45 ? "neutral" : "negative",
        detail: `${buildability.ownedCards} of ${buildability.requiredCards} required cards are already owned.`,
      },
      {
        label: "Missing unique cards",
        impact: buildability.missingUniqueCards <= 8 ? "positive" : "neutral",
        detail: `${buildability.missingUniqueCards} unique gaps remain.`,
      },
    ],
    source: "template-provider",
    disclosure: `${archetype.summary} ${archetype.provenance.join(" ")}`,
  };
}

function commanderOpportunities(collection: CollectionGraphCard[]): BuildOpportunity[] {
  const commanders = collection.filter((card) => card.typeLine?.toLowerCase().includes("legendary") && card.typeLine?.toLowerCase().includes("creature"));
  const format = getFormatProfile("commander");
  return commanders.slice(0, 6).map((commander) => {
    const requirements = buildWorkingDeckRequirementsFromCollection(collection, "commander", commander, "use-collection");
    const validation = validateDeckRequirements(requirements, format, { commander });
    const matches = compareRequirementsToCollection(requirements, collection, format);
    const buildability = calculateBuildabilityScore(matches);
    const strategies = inferCommanderStrategies(commander);
    return {
      id: `commander:${commander.inventoryId}`,
      name: `${commander.name} Commander Shell`,
      formatId: "commander",
      category: validation.valid && buildability.missingCards === 0 ? "ready-now" : "worth-considering",
      buildability,
      confidence: strategies[0]?.confidence ?? "medium",
      signals: [
        ...(strategies[0]?.signals ?? []),
        {
          label: "Validation",
          impact: validation.valid ? "positive" : "negative",
          detail: validation.valid ? "Working shell passes deterministic format checks." : validation.issues[0]?.message ?? "Working shell needs review.",
        },
      ],
      source: "collection-calculation",
      disclosure: "Commander shell assembled from owned cards, then checked for singleton and color identity rules.",
    };
  });
}

function opportunityToRecommendations(opportunity: BuildOpportunity): DeckRecommendation[] {
  if (!opportunity.missingCards?.length) {
    return [{
      id: `ready:${opportunity.id}`,
      title: `${opportunity.name} is buildable now`,
      body: "The required role profile is covered by cards already in this collection.",
      tone: "good",
      confidence: opportunity.confidence ?? "medium",
      signals: opportunity.signals ?? [],
      adds: [],
      cuts: [],
    }];
  }
  const firstMissing = opportunity.missingCards[0];
  const substitute = opportunity.ownedSubstitutions?.find((item) => item.missingCardName === firstMissing.requirement.name);
  return [{
    id: `gap:${opportunity.id}:${normalizeCardKey(firstMissing.requirement.name)}`,
    title: substitute ? `Owned substitute found for ${firstMissing.requirement.name}` : `${opportunity.name} needs ${firstMissing.requirement.name}`,
    body: substitute
      ? `${substitute.ownedCard.name} shares the most relevant role signals and can be reviewed as a temporary slot.`
      : "No owned replacement scored high enough for this gap.",
    tone: substitute ? "neutral" : "attention",
    confidence: substitute?.confidence ?? "medium",
    signals: substitute
      ? substitute.reasons.map((reason) => ({ label: "Owned substitute", impact: "neutral", detail: reason }))
      : opportunity.signals ?? [],
    adds: substitute ? [{
      name: substitute.ownedCard.name,
      quantity: 1,
      reason: `Owned alternative to ${firstMissing.requirement.name}.`,
      ownedQuantity: substitute.ownedCard.quantityOwned,
      additionalCost: 0,
    }] : [{
      name: firstMissing.requirement.name,
      quantity: firstMissing.missingQuantity,
      reason: `Required for ${opportunity.name}.`,
      ownedQuantity: 0,
      additionalCost: firstMissing.estimatedMissingValue,
    }],
    cuts: [],
  }];
}

function toRequirement(card: CollectionGraphCard, quantity: number, board: "commander" | "main", isCommander: boolean): DeckRequirement {
  return {
    id: `${board}:${card.inventoryId}`,
    name: card.name,
    requiredQuantity: quantity,
    board,
    roles: classifyCardRoles(card),
    estimatedPrice: card.marketPrice ?? null,
    importance: isCommander ? 1.5 : 1,
    imageUri: card.imageUri,
    typeLine: card.typeLine,
    oracleText: card.oracleText,
    manaCost: card.manaCost,
    colorIdentity: card.colorIdentity,
    location: card.location,
    isCommander,
    legalities: card.legalities,
    legalityStatus: "unknown",
  };
}

function colorIdentityFits(card: CollectionGraphCard, commander: CollectionGraphCard) {
  const colors = card.colorIdentity ?? [];
  const commanderColors = commander.colorIdentity ?? [];
  return colors.every((color) => commanderColors.includes(color));
}

function scoreCardForIntent(card: CollectionGraphCard, intentId: BuildIntentId) {
  const roles = classifyCardRoles(card);
  let score = card.quantityOwned * 4;
  if (roles.includes("land")) score += 8;
  if (roles.includes("ramp")) score += 7;
  if (roles.includes("interaction")) score += 6;
  if (roles.includes("card-advantage")) score += 5;
  if (intentId === "no-purchases" || intentId === "use-collection") score += card.quantityOwned * 2;
  if (intentId === "budget" && (card.marketPrice ?? 0) <= 5) score += 4;
  if (intentId === "competitive" && roles.some((role) => role === "interaction" || role === "ramp")) score += 4;
  return score;
}

function categoryForBuildability(
  score: number,
  missingUnique: number,
  estimatedCompletionCost: number | null,
): BuildOpportunity["category"] {
  if (missingUnique === 0) return "ready-now";
  if (score >= 75 && (missingUnique <= 8 || (estimatedCompletionCost !== null && estimatedCompletionCost <= 50))) {
    return "nearly-complete";
  }
  return "worth-considering";
}

function confidenceForScore(score: number): RecommendationConfidence {
  return score >= 82 ? "high" : score >= 58 ? "medium" : "low";
}

function primaryRole(roles: DeckArchitectRole[]) {
  return (roles[0] ?? "synergy").replace("-", " ");
}

function estimateManaValue(manaCost: string) {
  const generic = manaCost.match(/\{(\d+)\}/g)?.reduce((sum, token) => sum + Number(token.replace(/[{}]/g, "")), 0) ?? 0;
  const pips = manaCost.match(/\{[WUBRGC]\}/g)?.length ?? 0;
  return generic + pips;
}
