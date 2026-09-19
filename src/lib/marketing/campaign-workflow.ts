import { createHash } from "node:crypto";

export const CAMPAIGN_PLACEMENTS = {
  email_hero: { label: "Email Hero", platform: "email", width: 1200, height: 628 },
  instagram_square: { label: "Instagram Square", platform: "instagram_square", width: 1080, height: 1080 },
  instagram_portrait: { label: "Instagram Portrait", platform: "instagram_portrait", width: 1080, height: 1350 },
  instagram_story: { label: "Instagram Story", platform: "instagram_story", width: 1080, height: 1920 },
  facebook_feed: { label: "Facebook Feed", platform: "facebook", width: 1200, height: 1200 },
  google_square: { label: "Google Square", platform: "google_square", width: 1200, height: 1200 },
  google_landscape: { label: "Google Landscape", platform: "google_landscape", width: 1200, height: 628 },
  linkedin_feed: { label: "LinkedIn Feed", platform: "linkedin", width: 1200, height: 628 },
  x_feed: { label: "X Feed", platform: "x", width: 1200, height: 628 },
} as const;

export type CampaignPlacement = keyof typeof CAMPAIGN_PLACEMENTS;

export function validatePlacement(placement: string, creative: { status?: string; platform?: string | null; width?: number | null; height?: number | null }) {
  const target = CAMPAIGN_PLACEMENTS[placement as CampaignPlacement];
  if (!target) return "Unsupported campaign placement.";
  if (creative.status !== "approved") return "Only approved creatives can be attached to a campaign placement.";
  if (creative.platform !== target.platform || creative.width !== target.width || creative.height !== target.height) return `${target.label} requires an approved ${target.width}×${target.height} creative.`;
  return null;
}

export function normalizeClaims(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ claim: string; source: string; approved: boolean }>;
  return value.flatMap((entry) => {
    if (typeof entry === "string") return [{ claim: entry, source: "Feature Library", approved: true }];
    if (entry && typeof entry === "object" && "claim" in entry && typeof entry.claim === "string") return [{ claim: entry.claim, source: "Feature Library", approved: true }];
    return [];
  });
}

export function outreachApprovalChecks(input: { email?: string | null; subject?: string | null; bodyText?: string | null; cta?: string | null; campaignId?: string | null; featureId?: string | null; suppressed?: boolean; senderConfigured?: boolean; claimsApproved?: boolean }) {
  return [
    { key: "recipient", label: "Recipient email exists", ok: Boolean(input.email?.trim()) },
    { key: "subject", label: "Subject exists", ok: Boolean(input.subject?.trim()) },
    { key: "body", label: "Body exists", ok: Boolean(input.bodyText?.trim()) },
    { key: "campaign", label: "Campaign exists", ok: Boolean(input.campaignId) },
    { key: "feature", label: "Feature exists", ok: Boolean(input.featureId) },
    { key: "cta", label: "CTA is configured", ok: Boolean(input.cta?.trim()) },
    { key: "claims", label: "Claims are approved", ok: input.claimsApproved !== false },
    { key: "suppression", label: "Recipient is not suppressed", ok: input.suppressed !== true },
    { key: "sender", label: "Sender identity is configured", ok: input.senderConfigured === true },
  ];
}

export function hashApprovedBody(value: { subject: string; bodyText: string; creativeId?: string | null; campaignId?: string | null }) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
