import type { CardRecognitionResult } from "./types.ts";

export function sanitizedIntelligenceResponse(result: CardRecognitionResult | null) {
  if (!result) return null;
  const candidates = result.candidates.map((candidate) => ({
    canonicalCardId: candidate.canonicalCardId, printingId: candidate.printingId, game: candidate.game, name: candidate.name,
    setName: candidate.setName, setCode: candidate.setCode, collectorNumber: candidate.collectorNumber, language: candidate.language,
    finishes: candidate.finishes, rarity: candidate.rarity, imageUrl: candidate.imageUrl, providerIds: candidate.providerIds,
    provenance: candidate.provenance, identityAuthority: candidate.identityAuthority, prices: candidate.prices,
    score: candidate.score, confidenceTier: candidate.confidenceTier, requiresConfirmation: candidate.requiresConfirmation,
    matchedSignals: candidate.matchedSignals, conflictingSignals: candidate.conflictingSignals, reason: candidate.reason,
  }));
  return {
    selectedPrintingId: result.selectedPrintingId,
    candidates,
    score: candidates[0]?.score ?? 0,
    confidenceTier: candidates[0]?.confidenceTier ?? "low",
    requiresConfirmation: result.requiresConfirmation,
    matchedSignals: candidates[0]?.matchedSignals ?? [],
    conflictingSignals: candidates[0]?.conflictingSignals ?? [],
    providers: result.providers.map(({ id, status, latencyMs }) => ({ id, status, latencyMs })),
  };
}
