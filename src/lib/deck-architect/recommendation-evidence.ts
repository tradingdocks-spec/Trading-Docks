import type {
  ArchetypeCandidateEvaluation,
} from "./archetypes.ts";
import { classifyCardRoleSignals } from "./card-roles.ts";
import { normalizeCardKey } from "./ownership.ts";
import type {
  ArchetypeProfile,
  BuildIntentId,
  CollectionGraphCard,
  CommanderStrategyProfile,
  DeckArchitectRole,
  ProfessionalEvidenceQuality,
  RecommendationEvidence,
  RecommendationEvidenceProvenance,
} from "./types.ts";

export type RecommendationEvidenceContext = {
  commander: CollectionGraphCard;
  archetype: ArchetypeProfile | null;
  strategy: CommanderStrategyProfile | null;
  intentId: BuildIntentId;
  ownedQuantity: number;
  source: "curated" | "corpus" | "combo" | "inferred" | "owned";
  requiredRoles?: DeckArchitectRole[];
  comboCount?: number;
  nearComboCount?: number;
  winLineCount?: number;
};

const QUALITY_FLOOR_BY_INTENT: Record<BuildIntentId, number> = {
  "strongest-possible": 48,
  competitive: 54,
  budget: 46,
  casual: 50,
  "upgrade-over-time": 50,
  "use-collection": 44,
  "no-purchases": 42,
};

export function buildRecommendationEvidence(
  card: CollectionGraphCard,
  evaluation: ArchetypeCandidateEvaluation,
  context: RecommendationEvidenceContext,
): RecommendationEvidence {
  const highRoleSignals = classifyCardRoleSignals(card).filter((signal) => signal.confidence === "high");
  const requiredRoleHits = context.requiredRoles?.length
    ? highRoleSignals.filter((signal) => context.requiredRoles?.includes(signal.role)).length
    : 0;
  const roleFit = clamp01((highRoleSignals.length * 0.18) + (requiredRoleHits * 0.28));
  const archetypeAffinity = context.archetype
    ? clamp01(evaluation.score / Math.max(90, context.archetype.minimumRelevanceScore * 2.6))
    : null;
  const commanderAffinity = commanderAffinityScore(card, context.commander, evaluation);
  const strategyFit = strategyFitScore(card, context.strategy, evaluation);
  const curveFit = curveFitScore(card);
  const comboRelevance = context.comboCount || context.nearComboCount || context.winLineCount
    ? {
        comboCount: context.comboCount ?? 0,
        nearComboCount: context.nearComboCount ?? 0,
        winLineCount: context.winLineCount ?? 0,
      }
    : undefined;
  const evidenceScore =
    (archetypeAffinity ?? 0) * 34 +
    (commanderAffinity ?? 0) * 20 +
    roleFit * 18 +
    strategyFit * 18 +
    curveFit * 6 +
    (comboRelevance ? Math.min(10, comboRelevance.comboCount * 3 + comboRelevance.nearComboCount * 2 + comboRelevance.winLineCount * 4) : 0) +
    (context.source === "curated" ? 18 : 0) +
    (context.source === "owned" && context.ownedQuantity > 0 ? 16 : 0);
  const confidence: RecommendationEvidence["confidence"] =
    evidenceScore >= 78
      ? "strong"
      : evidenceScore >= 60
        ? "good"
        : evidenceScore >= QUALITY_FLOOR_BY_INTENT[context.intentId]
          ? "possible"
          : "insufficient";
  const sourceCategories = new Set<RecommendationEvidence["sourceCategories"][number]>([context.source, "inferred"]);
  if (context.ownedQuantity > 0) sourceCategories.add("owned");
  if (comboRelevance) sourceCategories.add("combo");
  const provenance = recommendationEvidenceProvenance(card, context, comboRelevance);
  const professionalQuality = ProfessionalEvidenceGate.classify({
    confidence,
    legalityVerified: card.legalities?.commander === "legal",
    archetypeAffinity,
    commanderAffinity,
    roleFit,
    strategyFit,
    sourceCategories: [...sourceCategories],
    comboRelevance,
  });

  return {
    legalityVerified: card.legalities?.commander === "legal",
    archetypeAffinity,
    commanderAffinity,
    roleFit,
    strategyFit,
    curveFit,
    comboRelevance,
    ownership: {
      owned: context.ownedQuantity > 0,
      quantity: Math.max(0, context.ownedQuantity),
    },
    confidence,
    professionalQuality,
    provenance,
    reasons: evidenceReasons(card, evaluation, context, { roleFit, strategyFit, comboRelevance }),
    rejectionReasons: confidence === "insufficient" || professionalQuality === "reject"
      ? rejectionReasons(card, evaluation, context, { roleFit, strategyFit, archetypeAffinity })
      : undefined,
    sourceCategories: [...sourceCategories],
  };
}

export function passesProfessionalQualityFloor(evidence: RecommendationEvidence, intentId: BuildIntentId) {
  return ProfessionalEvidenceGate.accepts(evidence, intentId);
}

export function recommendationEvidenceScore(evidence: RecommendationEvidence) {
  const confidenceScore = evidence.confidence === "strong" ? 100 : evidence.confidence === "good" ? 72 : evidence.confidence === "possible" ? 42 : -400;
  return confidenceScore +
    (evidence.archetypeAffinity ?? 0) * 40 +
    (evidence.commanderAffinity ?? 0) * 24 +
    evidence.roleFit * 16 +
    evidence.strategyFit * 18 +
    (evidence.comboRelevance ? Math.min(12, evidence.comboRelevance.comboCount * 3 + evidence.comboRelevance.winLineCount * 4) : 0);
}

function commanderAffinityScore(
  card: CollectionGraphCard,
  commander: CollectionGraphCard,
  evaluation: ArchetypeCandidateEvaluation,
) {
  const commanderText = `${commander.name} ${commander.typeLine ?? ""} ${commander.oracleText ?? ""}`.toLowerCase();
  const cardText = `${card.name} ${card.typeLine ?? ""} ${card.oracleText ?? ""}`.toLowerCase();
  const commanderTypes = commander.typeLine?.split(/\s+-\s+/)[1]?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  const typalHit = commanderTypes.some((type) => type.length > 3 && cardText.includes(type));
  const tokenHit = commanderText.includes("token") && (cardText.includes("token") || evaluation.tags.includes("token-payoff"));
  const sacrificeHit = commanderText.includes("sacrifice") && (cardText.includes("sacrifice") || evaluation.tags.includes("death-payoff"));
  const spellHit = commanderText.includes("instant or sorcery") && (cardText.includes("instant or sorcery") || evaluation.tags.includes("spellslinger"));
  return clamp01((typalHit ? 0.42 : 0) + (tokenHit ? 0.3 : 0) + (sacrificeHit ? 0.25 : 0) + (spellHit ? 0.25 : 0) + (evaluation.category === "core" ? 0.24 : evaluation.category === "synergy" ? 0.16 : 0));
}

function strategyFitScore(
  card: CollectionGraphCard,
  strategy: CommanderStrategyProfile | null,
  evaluation: ArchetypeCandidateEvaluation,
) {
  if (!strategy) return evaluation.category === "core" ? 0.8 : evaluation.category === "synergy" ? 0.62 : evaluation.category === "support" ? 0.42 : 0.18;
  const text = `${card.name} ${card.typeLine ?? ""} ${card.oracleText ?? ""}`.toLowerCase();
  const taxonomy = strategy.taxonomy;
  const termHits = [
    ...(taxonomy?.typal ?? []),
    ...(taxonomy?.themes ?? []),
    ...(taxonomy?.strategies ?? []),
    ...(taxonomy?.mechanics ?? []),
  ].filter((term) => term && text.includes(term.toLowerCase())).length;
  const roleHits = strategy.roles.filter((role) => evaluation.primaryRoles.includes(role) || evaluation.secondaryRoles.includes(role)).length;
  return clamp01(termHits * 0.22 + roleHits * 0.16 + (evaluation.category === "core" ? 0.32 : evaluation.category === "synergy" ? 0.2 : 0));
}

function curveFitScore(card: CollectionGraphCard) {
  const manaValue = card.manaValue ?? manaValueFromCost(card.manaCost ?? "");
  if (manaValue === null) return 0.5;
  if (manaValue <= 1) return 0.84;
  if (manaValue <= 3) return 1;
  if (manaValue <= 5) return 0.7;
  return 0.42;
}

function evidenceReasons(
  card: CollectionGraphCard,
  evaluation: ArchetypeCandidateEvaluation,
  context: RecommendationEvidenceContext,
  scores: { roleFit: number; strategyFit: number; comboRelevance?: RecommendationEvidence["comboRelevance"] },
) {
  const reasons: string[] = [];
  if (evaluation.category === "core") reasons.push(`Core ${context.archetype?.label ?? "strategy"} piece.`);
  if (evaluation.category === "synergy") reasons.push(`Strong ${context.archetype?.label ?? "strategy"} synergy.`);
  if (scores.strategyFit >= 0.55) reasons.push("Matches the selected Commander strategy.");
  if (scores.roleFit >= 0.55) reasons.push("Fills a high-confidence functional role.");
  if (scores.comboRelevance?.comboCount) reasons.push("Participates in known combo lines from the combo provider.");
  if (context.ownedQuantity > 0) reasons.push(`You own ${context.ownedQuantity}.`);
  if (!reasons.length) reasons.push(`${card.name} has limited evidence for this shell.`);
  return reasons;
}

function rejectionReasons(
  _card: CollectionGraphCard,
  evaluation: ArchetypeCandidateEvaluation,
  _context: RecommendationEvidenceContext,
  scores: { roleFit: number; strategyFit: number; archetypeAffinity: number | null },
) {
  return [
    evaluation.category === "reject" ? "poor archetype fit" : null,
    (scores.archetypeAffinity ?? 0) < 0.35 ? "poor commander/archetype affinity" : null,
    scores.roleFit < 0.35 ? "insufficient role need" : null,
    scores.strategyFit < 0.35 ? "strategy mismatch" : null,
    "insufficient confidence",
  ].filter((reason): reason is string => Boolean(reason));
}

function manaValueFromCost(manaCost: string) {
  if (!manaCost) return null;
  const generic = manaCost.match(/\{(\d+)\}/g)?.reduce((sum, token) => sum + Number(token.replace(/[{}]/g, "")), 0) ?? 0;
  const pips = manaCost.match(/\{[WUBRGC]\}/g)?.length ?? 0;
  return generic + pips;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function recommendationDiagnosticKey(card: Pick<CollectionGraphCard, "name">) {
  return normalizeCardKey(card.name);
}

export class ProfessionalEvidenceGate {
  static classify(evidence: Pick<
    RecommendationEvidence,
    "confidence" | "legalityVerified" | "archetypeAffinity" | "commanderAffinity" | "roleFit" | "strategyFit" | "sourceCategories" | "comboRelevance"
  >): ProfessionalEvidenceQuality {
    if (!evidence.legalityVerified) return "reject";
    const hasCuratedOrCorpus = evidence.sourceCategories.some((source) => source === "curated" || source === "corpus");
    const hasComboEvidence = Boolean(evidence.comboRelevance?.comboCount || evidence.comboRelevance?.nearComboCount || evidence.comboRelevance?.winLineCount);
    const archetypeAffinity = evidence.archetypeAffinity ?? 0;
    const commanderAffinity = evidence.commanderAffinity ?? 0;
    const strongDeckEvidence =
      archetypeAffinity >= 0.68 ||
      evidence.strategyFit >= 0.62 ||
      commanderAffinity >= 0.58 ||
      hasCuratedOrCorpus;
    const adequateRole = evidence.roleFit >= 0.5 || hasCuratedOrCorpus || hasComboEvidence;

    if (evidence.confidence === "strong" && strongDeckEvidence && adequateRole) return "verified-core";
    if ((evidence.confidence === "strong" || evidence.confidence === "good") && strongDeckEvidence && adequateRole) return "strong-match";
    if (hasCuratedOrCorpus && evidence.confidence !== "insufficient" && (archetypeAffinity >= 0.35 || evidence.strategyFit >= 0.35 || evidence.roleFit >= 0.35)) return "good-support";
    if (hasCuratedOrCorpus && (archetypeAffinity >= 0.2 || evidence.strategyFit >= 0.18 || evidence.roleFit >= 0.18)) return "good-support";
    if (evidence.confidence === "good" && archetypeAffinity >= 0.45 && evidence.roleFit >= 0.45) return "good-support";
    if (evidence.confidence === "possible" && archetypeAffinity >= 0.45 && evidence.roleFit >= 0.45) return "possible";
    return "reject";
  }

  static accepts(evidence: RecommendationEvidence, intentId: BuildIntentId) {
    if (evidence.professionalQuality === "verified-core" || evidence.professionalQuality === "strong-match" || evidence.professionalQuality === "good-support") {
      return true;
    }
    if (intentId === "no-purchases") {
      return evidence.ownership.owned && evidence.professionalQuality !== "reject";
    }
    if (intentId === "use-collection") {
      return evidence.ownership.owned && evidence.professionalQuality === "possible";
    }
    return false;
  }
}

function recommendationEvidenceProvenance(
  card: CollectionGraphCard,
  context: RecommendationEvidenceContext,
  comboRelevance?: RecommendationEvidence["comboRelevance"],
): RecommendationEvidenceProvenance {
  const source = context.source;
  return {
    canonicalCardSource:
      source === "curated" ? "curated" :
      source === "owned" ? "collection" :
      source === "corpus" ? "catalog" :
      source === "inferred" ? "global-provider" :
      "unknown",
    legalitySource:
      source === "curated" ? "curated" :
      source === "owned" ? "collection" :
      card.legalities?.commander === "legal" ? "scryfall" :
      "unknown",
    archetypeSource:
      source === "curated" ? "curated" :
      source === "corpus" ? "corpus" :
      "deterministic",
    roleSource: "deterministic-role-classifier",
    corpusSource: source === "corpus" ? "trading-docks-corpus" : undefined,
    comboSource: comboRelevance ? "commander-spellbook" : undefined,
    priceSource:
      card.marketPrice === null || card.marketPrice === undefined ? "unknown" :
      source === "owned" ? "collection" :
      source === "curated" ? "curated" :
      "provider",
    ownershipSource: "user-collection",
  };
}
