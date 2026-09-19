import assert from "node:assert/strict";
import test from "node:test";
import { matchInboundEmail, parseResendInboundPayload, sanitizeInboundHtml } from "../src/lib/marketing/inbound-email.ts";
import { classifyInboundReply, suggestReplyDraft } from "../src/lib/marketing/reply-classification.ts";

const inbound = (overrides: Record<string, unknown> = {}) => parseResendInboundPayload({ type: "email.received", created_at: "2026-09-19T04:00:00.000Z", data: { email_id: "in_1", from: "Owner <owner@example.com>", to: ["reply@tradingdocks.com"], subject: "Re: Chaos Sort", text: "Sounds good", headers: { "in-reply-to": "<out_1>", references: "<out_1>" }, ...overrides } })!;

test("inbound parser normalizes provider message references and sender", () => {
  const value = inbound();
  assert.equal(value.providerMessageId, "in_1");
  assert.equal(value.from.email, "owner@example.com");
  assert.equal(value.inReplyToProviderMessageId, "out_1");
});

test("inbound matching prioritizes thread/reference and refuses ambiguity", () => {
  const value = inbound();
  assert.equal(matchInboundEmail(value, [{ id: "a", providerMessageId: "out_1", normalizedEmail: "owner@example.com", subject: "Chaos Sort" }]).kind, "matched");
  const ambiguous = inbound({ from: "owner@example.com", headers: {}, subject: "General" });
  assert.equal(matchInboundEmail(ambiguous, [{ id: "a", normalizedEmail: "owner@example.com", lastMessageAt: new Date().toISOString() }, { id: "b", normalizedEmail: "owner@example.com", lastMessageAt: new Date().toISOString() }]).kind, "unmatched");
});

test("inbound HTML is sanitized for admin rendering", () => {
  const safe = sanitizeInboundHtml('<p>Hello</p><script>alert(1)</script><a href="javascript:alert(1)" onclick="bad()">Open</a><iframe src="x"></iframe>');
  assert.match(safe, /<p>Hello<\/p>/);
  assert.doesNotMatch(safe, /script|iframe|onclick|javascript:/i);
});

test("deterministic classification gives unsubscribe and out-of-office precedence", () => {
  assert.equal(classifyInboundReply({ text: "Automatic reply: I am out of office. Unsubscribe me." }).classification, "out_of_office");
  assert.equal(classifyInboundReply({ text: "Please remove me from your list." }).classification, "unsubscribe");
  assert.equal(classifyInboundReply({ text: "I'd like to schedule a demo." }).classification, "demo_request");
  assert.equal(classifyInboundReply({ text: "I don't handle this, talk to Jane." }).classification, "wrong_contact");
});

test("suggested replies are drafts and do not invent unsupported integration claims", () => {
  const draft = suggestReplyDraft({ classification: "integration_question", featureName: "Inventory", approvedClaims: ["Keeps inventory records connected to physical context."] });
  assert.equal(draft.unsupportedQuestion, true);
  assert.match(draft.body, /definitive answer/i);
  assert.doesNotMatch(draft.body, /integrates with TCGplayer/i);
});
