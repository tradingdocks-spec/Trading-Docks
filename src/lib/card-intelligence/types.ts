export type CardIntelligenceGame = "magic" | "pokemon" | "unknown";

export type CardRecognitionSignals = {
  game?: CardIntelligenceGame;
  cardName?: string | null;
  collectorNumber?: string | null;
  setCode?: string | null;
  setName?: string | null;
  language?: string | null;
  rarity?: string | null;
  finish?: string | null;
  foil?: boolean | null;
  ocrText?: string | null;
  ocrConfidence?: number | null;
  visualSimilarity?: number | null;
  visualPrintingId?: string | null;
  visualCandidates?: Array<{ printingId: string; similarity: number }>;
  imageHash?: string | null;
  providerIds?: Record<string, string | number | null | undefined>;
  orientation?: "portrait" | "landscape" | "unknown";
  dimensions?: { width: number; height: number } | null;
};

export type CardIntelligencePrice = {
  currency: "USD";
  market: number | null;
  low: number | null;
  high: number | null;
  source: string;
  updatedAt: string | null;
};

export type CanonicalPrinting = {
  canonicalCardId: string;
  printingId: string;
  game: Exclude<CardIntelligenceGame, "unknown">;
  name: string;
  setName: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  language: string | null;
  finishes: string[];
  rarity: string | null;
  imageUrl: string | null;
  providerIds: Record<string, string | number>;
  provenance: string[];
  identityAuthority: "provider_confirmed" | "synthetic_fallback";
  prices: CardIntelligencePrice[];
  legalities?: Record<string, string>;
};

export type CandidateSignal = {
  status: "exact" | "match" | "partial" | "missing" | "conflict";
  score: number | null;
  weight: number;
  observed?: string | number | boolean | null;
  expected?: string | number | boolean | null;
};

export type RankedPrintingCandidate = CanonicalPrinting & {
  score: number;
  confidenceTier: "high" | "medium" | "low";
  matchedSignals: string[];
  conflictingSignals: string[];
  reason: string;
  requiresConfirmation: boolean;
  diagnostics: Record<string, CandidateSignal>;
};

export type CardRecognitionResult = {
  candidates: RankedPrintingCandidate[];
  selectedPrintingId: string | null;
  requiresConfirmation: boolean;
  preservedSignals: CardRecognitionSignals;
  providers: Array<{ id: string; status: "available" | "failed" | "not_configured"; latencyMs?: number; error?: string }>;
};

export interface CardCatalogProvider {
  readonly id: string;
  search(signals: CardRecognitionSignals, options?: { limit?: number; signal?: AbortSignal }): Promise<CanonicalPrinting[]>;
  printing(id: string, options?: { signal?: AbortSignal }): Promise<CanonicalPrinting | null>;
}

export interface CardIntelligenceCache {
  get(key: string): Promise<CanonicalPrinting[] | null>;
  set(key: string, value: CanonicalPrinting[], ttlMs: number): Promise<void>;
}

export interface RecognitionRateLimiter {
  consume(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

export interface CardRecognitionProvider {
  readonly id: string;
  recognizeImage(input: { image: string; game: CardIntelligenceGame; limit: number }): Promise<CanonicalPrinting[]>;
}

export interface CardPricingProvider {
  readonly id: string;
  pricing(printing: CanonicalPrinting): Promise<CardIntelligencePrice[]>;
}

export interface CardImageProvider {
  readonly id: string;
  image(printing: CanonicalPrinting): Promise<string | null>;
}

export interface CardLegalityProvider {
  readonly id: string;
  legalities(printing: CanonicalPrinting): Promise<Record<string, string>>;
}
