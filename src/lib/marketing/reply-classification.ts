export const REPLY_CLASSIFICATIONS = ["interested", "question", "demo_request", "trial_request", "not_interested", "unsubscribe", "out_of_office", "wrong_contact", "pricing_question", "integration_question", "support_question", "other"] as const;
export type ReplyClassification = typeof REPLY_CLASSIFICATIONS[number];
export type ReplyClassificationResult = { classification: ReplyClassification; confidence: "high" | "medium" | "low"; source: "deterministic"; matchedSignals: string[] };

export function classifyInboundReply(input: { text?: string; subject?: string; headers?: Record<string, string> }): ReplyClassificationResult {
  const text = `${input.subject ?? ""}\n${input.text ?? ""}`.toLowerCase();
  const headers = Object.fromEntries(Object.entries(input.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value.toLowerCase()]));
  if (headers["auto-submitted"] && headers["auto-submitted"] !== "no" || /out of office|automatic reply|autoreply|away from the office/.test(text)) return { classification: "out_of_office", confidence: "high", source: "deterministic", matchedSignals: ["auto_reply"] };
  if (/unsubscribe|remove me|stop emailing|do not contact|don't contact me|no more emails/.test(text)) return { classification: "unsubscribe", confidence: "high", source: "deterministic", matchedSignals: ["explicit_opt_out"] };
  if (/not the right person|wrong person|don't handle|do not handle|contact jane|contact .* instead/.test(text)) return { classification: "wrong_contact", confidence: "high", source: "deterministic", matchedSignals: ["wrong_contact"] };
  if (/demo|demonstration|walkthrough|schedule a call|book a call/.test(text)) return { classification: "demo_request", confidence: "high", source: "deterministic", matchedSignals: ["demo_language"] };
  if (/trial|try it|test account|sandbox access/.test(text)) return { classification: "trial_request", confidence: "high", source: "deterministic", matchedSignals: ["trial_language"] };
  if (/not interested|no thanks|pass for now|not a fit/.test(text)) return { classification: "not_interested", confidence: "high", source: "deterministic", matchedSignals: ["negative_interest"] };
  if (/how much|pricing|price|cost/.test(text)) return { classification: "pricing_question", confidence: "high", source: "deterministic", matchedSignals: ["pricing_question"] };
  if (/integrat|tcgplayer|ebay|api|import|export/.test(text)) return { classification: "integration_question", confidence: "medium", source: "deterministic", matchedSignals: ["integration_question"] };
  if (/help|support|bug|broken|issue/.test(text)) return { classification: "support_question", confidence: "medium", source: "deterministic", matchedSignals: ["support_question"] };
  if (/\?|interested|tell me more|sounds good|would like to learn/.test(text)) return { classification: /\?/.test(text) ? "question" : "interested", confidence: "medium", source: "deterministic", matchedSignals: ["reply_language"] };
  return { classification: "other", confidence: "low", source: "deterministic", matchedSignals: [] };
}

export function interestEventForClassification(classification: ReplyClassification) {
  const map: Partial<Record<ReplyClassification, string>> = { interested: "positive_reply", demo_request: "demo_request", trial_request: "trial_request", pricing_question: "pricing_question", integration_question: "integration_question", support_question: "support_question", unsubscribe: "unsubscribe", not_interested: "not_interested" };
  return map[classification] ?? "email_reply";
}

export function suggestReplyDraft(input: { classification: ReplyClassification; featureName?: string; approvedClaims?: string[] }) {
  const feature = input.featureName ?? "the relevant Trading Docks workflow";
  const claims = input.approvedClaims ?? [];
  if (input.classification === "integration_question") return { body: "Thanks for the question. I’m checking the current supported integration details before I give you a definitive answer. I’ll follow up with the exact capability and any limitations.", unsupportedQuestion: true, rationale: "Integration answers require an approved current product fact." };
  if (input.classification === "demo_request") return { body: `Thanks — happy to show you ${feature}. I’ll follow up with a few times for a short walkthrough.`, unsupportedQuestion: false, rationale: "Demo response uses the request context without adding product claims." };
  const claim = claims[0];
  return { body: claim ? `Thanks for getting back to us. ${claim} If useful, I can share more context or set up a short conversation.` : "Thanks for getting back to us. I’ll review this and follow up with the right details shortly.", unsupportedQuestion: false, rationale: "Draft is limited to supplied approved claims." };
}
