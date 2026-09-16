export type MarketingStatus = "subscribed" | "unsubscribed" | "suppressed" | "unknown";

export type SuppressionReason =
  | "hard_bounce"
  | "spam_complaint"
  | "manual"
  | "provider_suppression"
  | "unknown";

export type MarketingContact = {
  id: string;
  workspace_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  tags?: string[] | null;
  marketing_email_consent?: boolean | null;
  marketing_status?: MarketingStatus | null;
  suppression_reason?: SuppressionReason | string | null;
};

export type MarketingAudienceRule =
  | { mode: "all_subscribed" }
  | { mode: "tagged"; tags: string[] }
  | { mode: "manual"; contactIds: string[] };

export type AudienceExclusionReason =
  | "missing_email"
  | "unknown_consent"
  | "unsubscribed"
  | "suppressed"
  | "outside_audience";

export type AudienceEligibility = {
  selected: MarketingContact[];
  eligible: MarketingContact[];
  excluded: Record<AudienceExclusionReason, number>;
  totalSelected: number;
  totalExcluded: number;
};

export type CampaignStatus =
  | "draft"
  | "queued"
  | "sending"
  | "sent"
  | "partial_failure"
  | "failed"
  | "cancelled"
  | "scheduled";

export type CampaignDraft = {
  name: string;
  subject: string;
  previewText: string;
  senderName: string;
  replyTo: string;
  content: string;
  audience: MarketingAudienceRule;
};

export type CampaignReadiness = {
  ready: boolean;
  reasons: string[];
};

export const MARKETING_EMAIL_TEMPLATES = [
  {
    id: "new-arrivals",
    name: "New arrivals",
    subject: "Fresh arrivals are ready to browse",
    previewText: "New singles and sealed products are now in stock.",
    body: "Hi {{first_name}},\n\nWe added new inventory this week. Reply to this email if you want us to hold anything before it sells.\n\nThanks,\n{{store_name}}",
  },
  {
    id: "restock",
    name: "Restock",
    subject: "A restock from your favorite categories",
    previewText: "Popular cards and products are back in stock.",
    body: "Hi {{first_name}},\n\nA few products customers have been asking for are back on the shelf. Stop by or reply if you want details.\n\n{{store_name}}",
  },
  {
    id: "sale-promotion",
    name: "Sale / promotion",
    subject: "This week's Trading Docks offers",
    previewText: "Limited-time offers for subscribers.",
    body: "Hi {{first_name}},\n\nWe are running a short promotion this week. Here are the highlights:\n\n- \n- \n- \n\n{{store_name}}",
  },
  {
    id: "event-announcement",
    name: "Event announcement",
    subject: "Upcoming events at the shop",
    previewText: "Reserve your spot for upcoming events.",
    body: "Hi {{first_name}},\n\nOur next event schedule is live. Reply if you want us to reserve a seat.\n\n{{store_name}}",
  },
  {
    id: "buying-collections",
    name: "Buying collections",
    subject: "We are buying collections this week",
    previewText: "Bring in cards or sealed product for an offer.",
    body: "Hi {{first_name}},\n\nWe are actively buying collections and sealed product this week. Reply with what you have or stop by the shop.\n\n{{store_name}}",
  },
  {
    id: "general-newsletter",
    name: "General newsletter",
    subject: "Trading Docks shop update",
    previewText: "A quick update from the shop.",
    body: "Hi {{first_name}},\n\nHere is what is happening this week:\n\n- \n- \n- \n\n{{store_name}}",
  },
] as const;

export function normalizeMarketingStatus(contact: MarketingContact): MarketingStatus {
  if (contact.marketing_status === "suppressed" || contact.suppression_reason) return "suppressed";
  if (contact.marketing_status === "unsubscribed") return "unsubscribed";
  if (contact.marketing_status === "subscribed") return "subscribed";
  return contact.marketing_email_consent === true ? "subscribed" : "unknown";
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

export function contactDisplayName(contact: MarketingContact) {
  const fullName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
  return fullName || contact.email || "Unnamed customer";
}

export function isInAudience(contact: MarketingContact, rule: MarketingAudienceRule) {
  if (rule.mode === "all_subscribed") return true;
  if (rule.mode === "manual") return new Set(rule.contactIds).has(contact.id);
  const wanted = new Set(rule.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  if (!wanted.size) return false;
  return (contact.tags ?? []).some((tag) => wanted.has(tag.trim().toLowerCase()));
}

export function evaluateMarketingAudience(
  contacts: MarketingContact[],
  rule: MarketingAudienceRule,
): AudienceEligibility {
  const excluded: Record<AudienceExclusionReason, number> = {
    missing_email: 0,
    unknown_consent: 0,
    unsubscribed: 0,
    suppressed: 0,
    outside_audience: 0,
  };
  const selected: MarketingContact[] = [];
  const eligible: MarketingContact[] = [];

  for (const contact of contacts) {
    if (!isInAudience(contact, rule)) {
      excluded.outside_audience += 1;
      continue;
    }
    selected.push(contact);
    const status = normalizeMarketingStatus(contact);
    if (!normalizeEmail(contact.email)) {
      excluded.missing_email += 1;
    } else if (status === "suppressed") {
      excluded.suppressed += 1;
    } else if (status === "unsubscribed") {
      excluded.unsubscribed += 1;
    } else if (status === "unknown") {
      excluded.unknown_consent += 1;
    } else {
      eligible.push(contact);
    }
  }

  return {
    selected,
    eligible,
    excluded,
    totalSelected: selected.length,
    totalExcluded:
      excluded.missing_email +
      excluded.unknown_consent +
      excluded.unsubscribed +
      excluded.suppressed,
  };
}

export function campaignReadiness(
  draft: CampaignDraft,
  audience: AudienceEligibility,
): CampaignReadiness {
  const reasons: string[] = [];
  if (!draft.name.trim()) reasons.push("Campaign name is required.");
  if (!draft.subject.trim()) reasons.push("Subject line is required.");
  if (!draft.senderName.trim()) reasons.push("Sender name is required.");
  if (!normalizeEmail(draft.replyTo)) reasons.push("Reply-to email is required.");
  if (!draft.content.trim()) reasons.push("Email content is required.");
  if (audience.eligible.length === 0) reasons.push("At least one subscribed recipient with an email address is required.");
  return { ready: reasons.length === 0, reasons };
}

export function buildCampaignIdempotencyKey(workspaceId: string, campaignId: string, audienceHash: string) {
  return `marketing:${workspaceId}:${campaignId}:${audienceHash}`;
}
