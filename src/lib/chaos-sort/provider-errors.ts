export type ChaosSortProviderFailureReason = "provider" | "quota_exhausted" | "rate_limited" | "temporarily_unavailable";

export type ChaosSortProviderErrorDetails = {
  type: string | null;
  code: string | null;
  message: string | null;
};

export function providerFailureDetails(payload: unknown): ChaosSortProviderErrorDetails {
  const error = payload && typeof payload === "object" && "error" in payload ? payload.error : payload;
  if (!error || typeof error !== "object") return { type: null, code: null, message: null };
  const record = error as Record<string, unknown>;
  return {
    type: typeof record.type === "string" ? record.type : null,
    code: typeof record.code === "string" ? record.code : null,
    message: typeof record.message === "string" ? record.message : null,
  };
}

export function classifyProviderFailure(status: number, details: ChaosSortProviderErrorDetails): ChaosSortProviderFailureReason {
  if (details.code === "insufficient_quota" || details.type === "insufficient_quota") return "quota_exhausted";
  if (status === 429 || details.code === "rate_limit_exceeded" || details.type === "rate_limit_exceeded") return "rate_limited";
  if (status >= 500 || details.type === "server_error") return "temporarily_unavailable";
  return "provider";
}
