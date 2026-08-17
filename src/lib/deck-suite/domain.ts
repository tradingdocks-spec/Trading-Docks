import {
  analyzeDeckHealth,
  BUILD_INTENTS,
  calculateBuildabilityScore,
  classifyCardRoles,
  compareRequirementsToCollection,
  getFormatProfile,
  proposeDeckRecommendations,
  validateDeckRequirements,
  type BuildIntentId,
  type CollectionGraphCard,
  type DeckArchitectBoard,
  type DeckArchitectFormatId,
  type DeckRequirement,
} from "../deck-architect/index.ts";
import type { DeckCard, DeckFormat, DeckRecord, ManaColor, ScryfallCardResult } from "../deck-vault/types.ts";

export type DeckSuiteParsedEntry = {
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  board: DeckArchitectBoard;
};

export type CreateDeckFromArchitectInput = {
  id: string;
  name: string;
  formatId: DeckArchitectFormatId;
  requirements: DeckRequirement[];
  ownership?: Array<{ requirement: DeckRequirement; ownedQuantity: number; missingQuantity: number }>;
  commander?: CollectionGraphCard | null;
  buildIntentId: BuildIntentId;
  lockedCardIds?: string[];
  mustIncludeCardIds?: string[];
  sourceDeckId?: string;
  strategyId?: string;
};

export type DeckSuiteAnalysis = {
  requirements: DeckRequirement[];
  ownership: ReturnType<typeof compareRequirementsToCollection>;
  buildability: ReturnType<typeof calculateBuildabilityScore> | null;
  health: ReturnType<typeof analyzeDeckHealth> | null;
  validation: ReturnType<typeof validateDeckRequirements>;
  recommendations: ReturnType<typeof proposeDeckRecommendations>;
};

const FORMAT_TO_ARCHITECT: Record<DeckFormat, DeckArchitectFormatId> = {
  EDH: "commander",
  "Pauper EDH": "commander",
  Standard: "standard",
  Modern: "modern",
  Pioneer: "pioneer",
  Legacy: "legacy",
  Vintage: "vintage",
  Alchemy: "standard",
  Premodern: "custom",
  Pauper: "pauper",
};

const ARCHITECT_TO_FORMAT: Record<DeckArchitectFormatId, DeckFormat> = {
  commander: "EDH",
  standard: "Standard",
  modern: "Modern",
  pioneer: "Pioneer",
  pauper: "Pauper",
  legacy: "Legacy",
  vintage: "Vintage",
  brawl: "EDH",
  casual60: "Modern",
  custom: "Modern",
};

export function deckFormatToArchitectFormat(format: DeckFormat | string | null | undefined): DeckArchitectFormatId {
  return FORMAT_TO_ARCHITECT[format as DeckFormat] ?? "custom";
}

export function architectFormatToDeckFormat(formatId: DeckArchitectFormatId): DeckFormat {
  return ARCHITECT_TO_FORMAT[formatId] ?? "Modern";
}

export function createDeckRecordFromArchitectPlan(input: CreateDeckFromArchitectInput): DeckRecord {
  const missingCardNames = new Set(
    (input.ownership ?? [])
      .filter((match) => match.missingQuantity > 0)
      .map((match) => match.requirement.name),
  );
  const cards = input.requirements.map((requirement) => requirementToDeckCard(requirement, missingCardNames));
  const commandZone = cards.filter((card) => card.board === "commander" || card.category === "Commander");
  const mainCards = cards.filter((card) => card.board !== "commander" && card.category !== "Commander");
  const marketValue = cards.reduce((sum, card) => sum + card.price * card.quantity, 0);
  const ownedCount = input.ownership?.length
    ? Math.round(
      (input.ownership.reduce((sum, match) => sum + Math.min(match.ownedQuantity, match.requirement.requiredQuantity), 0) /
        Math.max(1, input.ownership.reduce((sum, match) => sum + match.requirement.requiredQuantity, 0))) * 100,
    )
    : 0;

  return {
    id: input.id,
    name: input.name.trim() || "Deck Architect Build",
    commander: commandZone[0]?.name ?? input.commander?.name,
    commanders: commandZone.map((card) => card.name),
    format: architectFormatToDeckFormat(input.formatId),
    theme: `${BUILD_INTENTS[input.buildIntentId]?.label ?? "Deck Architect"} plan`,
    colors: deckColorsFromRequirements(input.requirements),
    marketValue,
    ownedCount,
    cardCount: mainCards.reduce((sum, card) => sum + card.quantity, 0) + commandZone.length,
    power: 5,
    updatedAt: new Date().toISOString(),
    status: missingCardNames.size ? "Building" : "Complete",
    cards,
    architectMetadata: {
      source: "deck-architect",
      sourceDeckId: input.sourceDeckId,
      buildIntentId: input.buildIntentId,
      strategyId: input.strategyId,
      lockedCardIds: input.lockedCardIds ?? [],
      mustIncludeCardIds: input.mustIncludeCardIds ?? [],
      missingCardNames: Array.from(missingCardNames),
      generatedAt: new Date().toISOString(),
    },
  };
}

export function deckRecordToArchitectRequirements(deck: DeckRecord): DeckRequirement[] {
  return deck.cards.map((card) => deckCardToRequirement(card));
}

export function deckCardToRequirement(card: DeckCard): DeckRequirement {
  const board = card.board ?? (card.category === "Commander" ? "commander" : "main");
  return {
    id: card.id,
    name: card.name,
    requiredQuantity: card.quantity,
    board,
    roles: classifyCardRoles({
      name: card.name,
      typeLine: card.typeLine,
      oracleText: "",
      manaCost: "",
    }),
    estimatedPrice: Number.isFinite(card.price) ? card.price : null,
    imageUri: card.image,
    typeLine: card.typeLine,
    colorIdentity: card.colors,
    isCommander: board === "commander" || card.category === "Commander",
    legalityStatus: card.legalityStatus,
  };
}

export function analyzeDeckRecordAgainstCollection(deck: DeckRecord, collection: CollectionGraphCard[]): DeckSuiteAnalysis {
  const formatId = deckFormatToArchitectFormat(deck.format);
  const format = getFormatProfile(formatId);
  const requirements = deckRecordToArchitectRequirements(deck);
  const ownership = compareRequirementsToCollection(requirements, collection, format);
  const buildability = ownership.length ? calculateBuildabilityScore(ownership) : null;
  const health = requirements.length ? analyzeDeckHealth(requirements, format) : null;
  const validation = validateDeckRequirements(requirements, format);
  const commander = deck.commander
    ? collection.find((card) => card.name.toLowerCase() === deck.commander?.toLowerCase()) ?? null
    : null;
  const recommendations = proposeDeckRecommendations({
    requirements,
    collection,
    format,
    commander,
    lockedCardIds: new Set(deck.architectMetadata?.lockedCardIds ?? []),
    mustIncludeCardIds: new Set(deck.architectMetadata?.mustIncludeCardIds ?? []),
  });
  return { requirements, ownership, buildability, health, validation, recommendations };
}

export function parseDeckListText(value: string): DeckSuiteParsedEntry[] {
  const lines = value.replace(/^\uFEFF/, "").split(/\r?\n/);
  let board: DeckArchitectBoard = "main";
  const entries: DeckSuiteParsedEntry[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^\/\//.test(line) || /^#/.test(line)) continue;
    const heading = line.replace(/:$/, "").toLowerCase();
    if (["commander", "commanders"].includes(heading)) { board = "commander"; continue; }
    if (["deck", "mainboard", "main deck", "maindeck"].includes(heading)) { board = "main"; continue; }
    if (["sideboard", "side board"].includes(heading)) { board = "sideboard"; continue; }
    if (["maybeboard", "considering", "maybe board"].includes(heading)) { board = "maybeboard"; continue; }
    if (/^quantity\s*,\s*name/i.test(line)) continue;

    const csv = parseCsvLine(line);
    if (csv) {
      entries.push({ ...csv, board });
      continue;
    }

    const match = line.match(/^(\d+)\s*x?\s+(.+?)(?:\s+\(([A-Z0-9]{2,8})\)\s*([A-Za-z0-9-]+)?)?(?:\s+\*[A-Z]+\*)?$/i);
    if (!match) continue;

    entries.push({
      quantity: Number(match[1]),
      name: match[2].trim().replace(/\s+\[[^\]]+\]$/, "").replace(/\s+\*F\*$/i, "").trim(),
      setCode: match[3]?.toLowerCase(),
      collectorNumber: match[4],
      board,
    });
  }

  return entries;
}

export function detectDeckListSource(value: string, fileName = "") {
  if (/moxfield/i.test(fileName)) return "Moxfield";
  if (/manabox/i.test(fileName)) return "ManaBox";
  if (/\.csv$/i.test(fileName) || /^quantity\s*,\s*name/im.test(value)) return "CSV";
  if (/\([A-Z0-9]{2,8}\)\s+[A-Za-z0-9-]+/i.test(value)) return "ManaBox / Moxfield";
  if (/SIDEBOARD|MAYBEBOARD|COMMANDER/i.test(value)) return "Sectioned decklist";
  return value.trim() ? "Plain text" : "Unknown";
}

export function exportDeckPlainText(deck: DeckRecord): string {
  return exportSections(deck)
    .map(([label, cards]) => cards.length ? `${label}\n${cards.map(formatDeckLine).join("\n")}` : "")
    .filter(Boolean)
    .join("\n\n");
}

export function exportDeckCsv(deck: DeckRecord): string {
  const rows = [["section", "quantity", "name", "set", "collector_number"]];
  for (const card of deck.cards) {
    rows.push([
      card.board ?? (card.category === "Commander" ? "commander" : "main"),
      String(card.quantity),
      card.name,
      card.setCode ?? "",
      card.collectorNumber ?? "",
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function exportDeckMtgoText(deck: DeckRecord): string {
  return deck.cards
    .map((card) => `${card.board === "sideboard" ? "SB: " : ""}${formatDeckLine(card)}`)
    .join("\n");
}

export function exportDeckArenaText(deck: DeckRecord): string | null {
  const canExport = deck.cards.every((card) => card.setCode && card.collectorNumber);
  if (!canExport) return null;
  return deck.cards.map((card) => {
    const section = card.board === "sideboard" ? "Sideboard " : "";
    return `${section}${card.quantity} ${card.name} (${card.setCode?.toUpperCase()}) ${card.collectorNumber}`;
  }).join("\n");
}

export function canExportDeckToArena(deck: DeckRecord): boolean {
  return exportDeckArenaText(deck) !== null;
}

export function scryfallResultToPotentialCommander(card: ScryfallCardResult): CollectionGraphCard {
  return {
    inventoryId: `potential:${card.id}`,
    name: card.name,
    quantityOwned: 0,
    imageUri: card.image,
    setCode: card.setCode,
    collectorNumber: card.collectorNumber,
    scryfallId: card.id,
    typeLine: card.typeLine,
    manaValue: card.manaValue,
    colors: card.colors,
    colorIdentity: card.colorIdentity,
    marketPrice: card.price > 0 ? card.price : null,
  };
}

function requirementToDeckCard(requirement: DeckRequirement, missingCardNames: Set<string>): DeckCard {
  const colors = (requirement.colorIdentity?.length ? requirement.colorIdentity : ["C"])
    .filter((color): color is ManaColor => ["W", "U", "B", "R", "G", "C"].includes(color));
  return {
    id: requirement.id,
    name: requirement.name,
    quantity: requirement.requiredQuantity,
    manaValue: inferManaValue(requirement.manaCost),
    colors: colors.length ? colors : ["C"],
    typeLine: requirement.typeLine ?? "Card",
    category: requirement.board === "commander" || requirement.isCommander ? "Commander" : categoryFromType(requirement.typeLine),
    price: requirement.estimatedPrice ?? 0,
    owned: !missingCardNames.has(requirement.name),
    image: requirement.imageUri ?? undefined,
    board: requirement.board,
    legalityStatus: requirement.legalityStatus === "unknown" ? undefined : requirement.legalityStatus,
    ownedQuantity: missingCardNames.has(requirement.name) ? 0 : requirement.requiredQuantity,
  };
}

function deckColorsFromRequirements(requirements: DeckRequirement[]): ManaColor[] {
  const colors = new Set<ManaColor>();
  for (const requirement of requirements) {
    for (const color of requirement.colorIdentity ?? []) {
      if (["W", "U", "B", "R", "G"].includes(color)) colors.add(color as ManaColor);
    }
  }
  return colors.size ? Array.from(colors) : ["C"];
}

function inferManaValue(manaCost?: string | null) {
  if (!manaCost) return 0;
  const generic = manaCost.match(/\{(\d+)\}/);
  const genericValue = generic ? Number(generic[1]) : 0;
  const pips = (manaCost.match(/\{[WUBRGC]\}/g) ?? []).length;
  return genericValue + pips;
}

function categoryFromType(typeLine?: string | null) {
  if (!typeLine) return "Other";
  for (const type of ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land"]) {
    if (typeLine.includes(type)) return type;
  }
  return "Other";
}

function parseCsvLine(line: string): Omit<DeckSuiteParsedEntry, "board"> | null {
  const fields = line.match(/("(?:[^"]|"")*"|[^,]+)/g)?.map((field) =>
    field.trim().replace(/^"|"$/g, "").replace(/""/g, '"'),
  );
  if (!fields || fields.length < 2 || !/^\d+$/.test(fields[0])) return null;
  return {
    quantity: Number(fields[0]),
    name: fields[1],
    setCode: fields[2]?.toLowerCase(),
    collectorNumber: fields[3],
  };
}

function exportSections(deck: DeckRecord): Array<[string, DeckCard[]]> {
  return [
    ["Commander", deck.cards.filter((card) => card.board === "commander" || card.category === "Commander")],
    ["Deck", deck.cards.filter((card) => !card.board || card.board === "main")],
    ["Sideboard", deck.cards.filter((card) => card.board === "sideboard")],
    ["Maybeboard", deck.cards.filter((card) => card.board === "maybeboard")],
  ];
}

function formatDeckLine(card: DeckCard) {
  return `${card.quantity} ${card.name}`;
}

function csvEscape(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
