type CardFactInput = {
  id?: string | null;
  scryfallId?: string | null;
  tcgplayerId?: string | number | null;
  name: string;
  typeLine?: string | null;
  oracleText?: string | null;
  colorIdentity?: string[] | null;
  legalities?: Record<string, string> | null;
  isCommander?: boolean;
};

export type CardMetadataIssue =
  | "missing-canonical-identifier"
  | "missing-color-identity"
  | "missing-commander-legality"
  | "illegal-commander-card"
  | "missing-oracle-text"
  | "missing-type-line"
  | "non-playable-object";

export function cardMetadataIssues(card: CardFactInput): CardMetadataIssue[] {
  const issues: CardMetadataIssue[] = [];
  const typeLine = card.typeLine?.trim() ?? "";
  const oracleText = card.oracleText?.trim() ?? "";
  const legalities = card.legalities ?? {};
  const hasStableIdentifier = Boolean(
    ("scryfallId" in card && card.scryfallId) ||
    ("tcgplayerId" in card && card.tcgplayerId) ||
    ("id" in card && card.id),
  );

  if (!hasStableIdentifier && !card.isCommander) issues.push("missing-canonical-identifier");
  if (!Array.isArray(card.colorIdentity)) issues.push("missing-color-identity");
  if (!legalities.commander) issues.push("missing-commander-legality");
  if (legalities.commander && legalities.commander !== "legal") issues.push("illegal-commander-card");
  if (!oracleText && !typeLine.toLowerCase().includes("land")) issues.push("missing-oracle-text");
  if (!typeLine) issues.push("missing-type-line");
  if (isNonPlayableCardObject(card)) issues.push("non-playable-object");

  return [...new Set(issues)];
}

export function hasCanonicalCommanderFacts(card: CardFactInput) {
  const issues = cardMetadataIssues(card);
  return !issues.some((issue) =>
    issue === "missing-color-identity" ||
    issue === "missing-commander-legality" ||
    issue === "illegal-commander-card" ||
    issue === "missing-type-line" ||
    issue === "non-playable-object",
  );
}

export function isNonPlayableCardObject(card: Pick<CardFactInput, "name" | "typeLine">) {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const name = card.name.toLowerCase();
  return (
    typeLine.includes("token") ||
    typeLine.includes("emblem") ||
    typeLine.includes("card //") ||
    typeLine.includes("plane ") ||
    typeLine.includes("scheme") ||
    typeLine.includes("vanguard") ||
    typeLine.includes("phenomenon") ||
    typeLine.includes("attraction") ||
    typeLine.includes("stickers") ||
    name.includes(" // token")
  );
}
