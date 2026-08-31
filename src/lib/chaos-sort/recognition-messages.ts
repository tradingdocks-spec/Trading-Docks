export const CHAOS_SORT_RECOGNITION_REASONS = [
  "configuration", "auth", "provider", "timeout", "parse", "image_decode", "catalog",
  "quota_exhausted", "rate_limited", "temporarily_unavailable", "tcgtracking_scan",
  "product_lookup", "malformed_provider", "image_normalization",
] as const;

export type ChaosSortRecognitionReason = (typeof CHAOS_SORT_RECOGNITION_REASONS)[number];
export type ChaosSortRecognitionStage = "normalization" | "tcgtracking_scan" | "product_lookup" | "scryfall_verify" | "response_parse";

const MESSAGES: Record<ChaosSortRecognitionReason, { message: string; stage: ChaosSortRecognitionStage }> = {
  configuration: { message: "Recognition is not configured on the server.", stage: "tcgtracking_scan" },
  auth: { message: "Recognition provider authentication failed.", stage: "tcgtracking_scan" },
  provider: { message: "Recognition provider failed.", stage: "tcgtracking_scan" },
  timeout: { message: "Recognition provider request timed out.", stage: "tcgtracking_scan" },
  parse: { message: "Malformed provider response.", stage: "response_parse" },
  image_decode: { message: "Image normalization failed.", stage: "normalization" },
  catalog: { message: "Card catalog lookup failed.", stage: "product_lookup" },
  quota_exhausted: { message: "API quota unavailable. Check the recognition provider account configuration.", stage: "tcgtracking_scan" },
  rate_limited: { message: "Recognition is temporarily rate limited.", stage: "tcgtracking_scan" },
  temporarily_unavailable: { message: "Recognition provider is temporarily unavailable.", stage: "tcgtracking_scan" },
  tcgtracking_scan: { message: "TCGTracking scan failed.", stage: "tcgtracking_scan" },
  product_lookup: { message: "Product metadata lookup failed.", stage: "product_lookup" },
  malformed_provider: { message: "Malformed provider response.", stage: "response_parse" },
  image_normalization: { message: "Image normalization failed.", stage: "normalization" },
};

export function chaosSortRecognitionMessage(reason: string | null | undefined) {
  return reason && reason in MESSAGES
    ? MESSAGES[reason as ChaosSortRecognitionReason]
    : { message: "Recognition failed. Retry this scan.", stage: "response_parse" as const };
}
