export type IntelligenceStatus = "OBSERVED" | "CALCULATED" | "ESTIMATED" | "SYNTHETIC" | "INSUFFICIENT_DATA" | "UNAVAILABLE";
export type IntelligenceValue<T> = {
  value: T | null;
  status: IntelligenceStatus;
  confidence: number | null;
  observedAt: string | null;
  sources: string[];
  inputs: string[];
  explanation: string;
};

/** Deliberately strips synthetic and unsupported values at the production boundary. */
export function intelligenceValue<T>(input: IntelligenceValue<T>): IntelligenceValue<T> {
  const sourced = input.sources.length > 0;
  const available = !["SYNTHETIC", "UNAVAILABLE", "INSUFFICIENT_DATA"].includes(input.status);
  if (!available || !sourced || input.value === null || (typeof input.value === "number" && !Number.isFinite(input.value))) {
    return { ...input, value: null, confidence: null,
      status: input.status === "UNAVAILABLE" ? "UNAVAILABLE" : "INSUFFICIENT_DATA" };
  }
  return { ...input, confidence: typeof input.confidence === "number" && Number.isFinite(input.confidence)
    ? Math.min(1, Math.max(0, input.confidence)) : null };
}

export function missingIntelligence<T>(explanation: string): IntelligenceValue<T> {
  return { value: null, status: "INSUFFICIENT_DATA", confidence: null, observedAt: null, sources: [], inputs: [], explanation };
}

export { availableMoney, totalInventoryValue, trustedInventoryValue, summarizeInventoryValues } from "../../mobile/services/inventory-valuation.ts";
