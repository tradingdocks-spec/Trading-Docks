export const AUTOMATIC_SNAPSHOT_FALLBACK_DEADLINE_MS = 800;
export const AUTOMATIC_SNAPSHOT_FALLBACK_COOLDOWN_MS = 1500;

export type ScannerLiveFallbackDecisionInput = {
  cardPresent: boolean;
  hasCredibleCandidate: boolean;
  fallbackInFlight: boolean;
  liveOcrInFlight: boolean;
  cardPresentSinceAt: number | null;
  lastFallbackAt: number | null;
  now: number;
  deadlineMs?: number;
  cooldownMs?: number;
};

export type ScannerLiveFallbackDecision = {
  shouldTrigger: boolean;
  deadlineStartedAt: number | null;
  readyAt: number | null;
};

export function resolveScannerLiveFallbackDecision(input: ScannerLiveFallbackDecisionInput): ScannerLiveFallbackDecision {
  if (!input.cardPresent || input.hasCredibleCandidate) {
    return { shouldTrigger: false, deadlineStartedAt: null, readyAt: null };
  }
  if (input.fallbackInFlight) {
    return { shouldTrigger: false, deadlineStartedAt: input.cardPresentSinceAt, readyAt: input.cardPresentSinceAt === null ? null : input.cardPresentSinceAt + (input.deadlineMs ?? AUTOMATIC_SNAPSHOT_FALLBACK_DEADLINE_MS) };
  }

  const deadlineMs = input.deadlineMs ?? AUTOMATIC_SNAPSHOT_FALLBACK_DEADLINE_MS;
  const cooldownMs = input.cooldownMs ?? AUTOMATIC_SNAPSHOT_FALLBACK_COOLDOWN_MS;
  const startedAt = input.cardPresentSinceAt ?? input.now;
  const readyAt = startedAt + deadlineMs;
  const cooldownReady = input.lastFallbackAt === null || input.now - input.lastFallbackAt >= cooldownMs;
  return {
    shouldTrigger: input.now >= readyAt && cooldownReady,
    deadlineStartedAt: startedAt,
    readyAt,
  };
}
