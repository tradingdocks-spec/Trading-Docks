import { normalizeCardKey } from "./ownership.ts";
import type {
  CommanderCardEvidence,
  CommanderMetaProfile,
  CommanderMetaProvider,
  CommanderStrategyEvidence,
} from "./types.ts";

export type DeckCorpusSourceCategory =
  | "trading-docks-curated"
  | "trading-docks-user-aggregate"
  | "open-licensed-dataset"
  | "tournament-decklist-provider"
  | "combo-provider"
  | "licensed-commander-meta-provider";

export type DeckCorpusObservation = {
  commanderId: string;
  format: "commander" | string;
  archetypeId: string;
  strategyId: string | null;
  cardId: string;
  cardName: string;
  observedDeckCount: number;
  eligibleDeckCount: number;
  coOccurrenceCount: number | null;
  baselineInclusionRate: number | null;
  observedAt: string;
  sourceCategory: DeckCorpusSourceCategory;
  provenance: string[];
};

const MINIMUM_PUBLIC_SAMPLE_SIZE = 25;

export class TradingDocksCorpusMetaProvider implements CommanderMetaProvider {
  private observations: DeckCorpusObservation[];

  constructor(observations: DeckCorpusObservation[] = []) {
    this.observations = observations;
  }

  async getCommanderProfile(commanderId: string): Promise<CommanderMetaProfile | null> {
    const commanderObservations = this.observationsForCommander(commanderId);
    if (!commanderObservations.length) return null;
    const byStrategy = new Map<string, CommanderStrategyEvidence>();
    for (const observation of commanderObservations) {
      const strategyId = observation.strategyId ?? observation.archetypeId;
      const existing = byStrategy.get(strategyId) ?? {
        id: strategyId,
        label: titleCase(strategyId),
        sampleSize: observation.eligibleDeckCount,
        coreCards: [],
        synergyCards: [],
        flexCards: [],
        sourceDate: observation.observedAt,
        freshnessDays: freshnessDays(observation.observedAt),
      };
      const classification = classifyCorpusObservation(observation);
      if (classification === "core") existing.coreCards.push(observation.cardName);
      if (classification === "strong-synergy") existing.synergyCards.push(observation.cardName);
      if (classification === "flex") existing.flexCards.push(observation.cardName);
      existing.sampleSize = Math.max(existing.sampleSize ?? 0, observation.eligibleDeckCount);
      existing.sourceDate = newestDate(existing.sourceDate ?? null, observation.observedAt);
      existing.freshnessDays = existing.sourceDate ? freshnessDays(existing.sourceDate) : null;
      byStrategy.set(strategyId, existing);
    }
    return {
      commanderId,
      commanderName: commanderId,
      strategyEvidence: [...byStrategy.values()],
      source: "trading-docks-corpus",
      observedDeckCount: Math.max(...commanderObservations.map((observation) => observation.eligibleDeckCount)),
    };
  }

  async getCardEvidence(commanderId: string, cardId: string, strategyId?: string): Promise<CommanderCardEvidence | null> {
    const cardKey = normalizeCardKey(cardId);
    const match = this.observationsForCommander(commanderId)
      .filter((observation) => normalizeCardKey(observation.cardId) === cardKey || normalizeCardKey(observation.cardName) === cardKey)
      .filter((observation) => !strategyId || observation.strategyId === strategyId || observation.archetypeId === strategyId)
      .sort((left, right) => right.observedDeckCount - left.observedDeckCount)[0];
    if (!match) return null;
    const inclusionRate = match.eligibleDeckCount > 0 ? match.observedDeckCount / match.eligibleDeckCount : null;
    const baseline = match.baselineInclusionRate;
    return {
      commanderId,
      cardId,
      strategyId,
      observedInCorpus: true,
      inclusionRate: sampleIsDisplayable(match.eligibleDeckCount) ? inclusionRate : null,
      sampleSize: match.eligibleDeckCount,
      synergyLift: inclusionRate !== null && baseline !== null ? inclusionRate - baseline : null,
      coOccurrenceScore: match.coOccurrenceCount !== null && match.eligibleDeckCount > 0 ? match.coOccurrenceCount / match.eligibleDeckCount : null,
      classification: classifyCorpusObservation(match),
      sourceDate: match.observedAt,
      freshnessDays: freshnessDays(match.observedAt),
      provenance: match.provenance,
    };
  }

  async getStrategyProfiles(commanderId: string): Promise<CommanderStrategyEvidence[]> {
    return (await this.getCommanderProfile(commanderId))?.strategyEvidence ?? [];
  }

  private observationsForCommander(commanderId: string) {
    const commanderKey = normalizeCardKey(commanderId);
    return this.observations.filter((observation) => normalizeCardKey(observation.commanderId) === commanderKey);
  }
}

export const EMPTY_TRADING_DOCKS_CORPUS_PROVIDER = new TradingDocksCorpusMetaProvider();

export function classifyCorpusObservation(observation: DeckCorpusObservation): CommanderCardEvidence["classification"] {
  if (!sampleIsDisplayable(observation.eligibleDeckCount)) return "unsupported";
  const inclusionRate = observation.eligibleDeckCount > 0 ? observation.observedDeckCount / observation.eligibleDeckCount : 0;
  const synergyLift = observation.baselineInclusionRate === null ? 0 : inclusionRate - observation.baselineInclusionRate;
  if (inclusionRate >= 0.55 && synergyLift >= 0.12) return "core";
  if (inclusionRate >= 0.28 && synergyLift >= 0.08) return "strong-synergy";
  if (inclusionRate >= 0.12) return "flex";
  if (inclusionRate > 0) return "fringe";
  return "unsupported";
}

export function sampleIsDisplayable(sampleSize: number | null) {
  return typeof sampleSize === "number" && sampleSize >= MINIMUM_PUBLIC_SAMPLE_SIZE;
}

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function freshnessDays(observedAt: string) {
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function newestDate(left: string | null, right: string) {
  if (!left) return right;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime)) return right;
  if (!Number.isFinite(rightTime)) return left;
  return rightTime > leftTime ? right : left;
}
