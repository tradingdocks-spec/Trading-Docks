import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const deckVaultHome = readFileSync(
  path.join(repoRoot, "src/components/dashboard/deck-vault/DeckVaultHome.tsx"),
  "utf8",
);
const deckImportCenter = readFileSync(
  path.join(repoRoot, "src/components/dashboard/deck-vault/DeckImportCenter.tsx"),
  "utf8",
);
const deckDetailWorkspace = readFileSync(
  path.join(repoRoot, "src/components/dashboard/deck-vault/DeckDetailWorkspace.tsx"),
  "utf8",
);
const deckFormats = readFileSync(
  path.join(repoRoot, "src/lib/deck-vault/formats.ts"),
  "utf8",
);
const deckPage = readFileSync(
  path.join(repoRoot, "src/app/dashboard/deck-vault/page.tsx"),
  "utf8",
);
const deckCardImageRoute = readFileSync(
  path.join(repoRoot, "src/app/api/deck-vault/card-image/route.ts"),
  "utf8",
);
const deckPersistence = readFileSync(
  path.join(repoRoot, "src/lib/deck-vault/persistence.ts"),
  "utf8",
);
const legacyDeckVaultHome = readFileSync(
  path.join(repoRoot, "src/components/dashboard-v2/deck-vault/DeckVaultHome.tsx"),
  "utf8",
);

test("Deck Vault keeps Import deck as the primary hero CTA and Create deck available", () => {
  assert.match(deckVaultHome, /Build deeper\. Analyze smarter\. Know every deck\./);
  assert.match(deckVaultHome, /Import deck/);
  assert.match(deckVaultHome, /Create new deck/);
  assert.match(deckVaultHome, /Paste decklist/);
  assert.match(deckVaultHome, /href=\{limitReached \? "\/dashboard\/plans" : "\/dashboard\/deck-vault\/import"\}/);
  assert.match(deckVaultHome, /href=\{limitReached \? "\/dashboard\/plans" : "\/dashboard\/deck-vault\/new"\}/);
});

test("Deck Vault summary is one coherent surface instead of four equal KPI cards", () => {
  assert.match(deckVaultHome, /Vault summary/);
  assert.match(deckVaultHome, /deckCountLabel/);
  assert.match(deckVaultHome, /Total value/);
  assert.match(deckVaultHome, /Avg\. owned/);
  assert.match(deckVaultHome, /AI reviews/);
  assert.doesNotMatch(deckVaultHome, /function Kpi/);
  assert.doesNotMatch(deckVaultHome, /<Kpi/);
});

test("Deck cards use existing deck data and keep Rename secondary", () => {
  assert.match(deckVaultHome, /deck\.commander/);
  assert.match(deckVaultHome, /deck\.format/);
  assert.match(deckVaultHome, /deck\.cardCount/);
  assert.match(deckVaultHome, /deck\.marketValue/);
  assert.match(deckVaultHome, /deck\.power/);
  assert.match(deckVaultHome, /deck\.ownedCount/);
  assert.match(deckVaultHome, /Open deck/);
  assert.match(deckVaultHome, /Analyze/);
  assert.match(deckVaultHome, /aria-label=\{`Rename \$\{deck\.name\}`\}/);
  assert.doesNotMatch(deckVaultHome, />\s*Rename\s*<\/button>/);
});

test("AI empty state explains value and provides a clear CTA without fabricated insights", () => {
  assert.match(deckVaultHome, /AI Deck Review/);
  assert.match(deckVaultHome, /Analyze mana curve, interaction, removal, win conditions, weaknesses/);
  assert.match(deckVaultHome, /No saved reviews yet/);
  assert.match(deckVaultHome, /Analyze a deck/);
  assert.doesNotMatch(deckVaultHome, /3 new insights|7 upgrade opportunities found|Interaction density is below target/);
});

test("Collector loop is contextual and not permanent for established deck libraries", () => {
  assert.match(deckVaultHome, /!\s*hasDecks \? <CollectorLoopPanel \/> : null/);
  assert.match(deckVaultHome, /First deck workflow/);
  assert.match(deckVaultHome, /Import deck/);
  assert.match(deckVaultHome, /Compare to collection/);
  assert.match(deckVaultHome, /Analyze/);
  assert.match(deckVaultHome, /Upgrade/);
});

test("collection coverage and plan deck limits remain backed by existing contracts", () => {
  assert.match(deckPage, /getEffectivePlan/);
  assert.match(deckPage, /PLAN_ENTITLEMENTS\[plan\]\.deckLimit/);
  assert.match(deckVaultHome, /deckLimit !== null && savedDecks\.length >= deckLimit/);
  assert.match(deckVaultHome, /deck\.ownedCount/);
  assert.match(deckVaultHome, /deck\.cardCount/);
  assert.match(deckVaultHome, /Add cards to Collection/);
});

test("existing import formats remain visible and supported", () => {
  for (const format of ["Moxfield", "ManaBox", "MTGGoldfish", "Archidekt", "Deckstats", "Arena", "CSV", "plain text"]) {
    assert.match(deckVaultHome, new RegExp(format.replace(" ", "\\s+")));
  }

  assert.match(deckImportCenter, /Moxfield URL/);
  assert.match(deckImportCenter, /TXT, CSV, or DEK/);
  assert.match(deckImportCenter, /Arena export/);
  assert.match(deckImportCenter, /ManaBox export/);
  assert.match(deckImportCenter, /plain-text deck file/);
});

test("deck deletion cannot be undone by queued saves or demo-data rehydration", () => {
  assert.match(deckPersistence, /DELETED_PREFIX/);
  assert.match(deckPersistence, /markDeckDeleted\(userId, deckId\)/);
  assert.match(deckPersistence, /isDeckDeleted\(userId, deck\.id\)\) return/);
  assert.match(legacyDeckVaultHome, /DELETED_DECKS_KEY/);
  assert.match(legacyDeckVaultHome, /!deletedDeckIds\.has\(deck\.id\)/);
  assert.match(legacyDeckVaultHome, /deletedDeckIds\.add\(deckId\)/);
});

test("responsive Deck Vault layout uses bounded grids and avoids fixed overflow-prone widths", () => {
  assert.match(deckVaultHome, /max-w-\[1480px\]/);
  assert.match(deckVaultHome, /grid gap-4 lg:grid-cols-2 2xl:grid-cols-3/);
  assert.match(deckVaultHome, /min-w-0/);
  assert.match(deckVaultHome, /flex flex-wrap gap-2\.5/);
  assert.doesNotMatch(deckVaultHome, /(?<!max-)w-\[[1-9]\d{3,}px\]/);
});

test("Color Demand rows use full-width row structure with right-aligned percentages", () => {
  assert.match(deckDetailWorkspace, /aria-label="Color demand by cards"/);
  assert.match(deckDetailWorkspace, /group flex w-full min-w-0 items-start gap-3/);
  assert.match(deckDetailWorkspace, /grid min-w-0 grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(deckDetailWorkspace, /text-right text-\[13px\] font-semibold tabular-nums/);
  assert.match(deckDetailWorkspace, /mt-3 h-2 overflow-hidden rounded-full/);
  assert.doesNotMatch(deckDetailWorkspace, /min-w-\[48px\] shrink-0 rounded-lg border/);
});

test("Deck Vault home restores card hover preview using existing deck card identity", () => {
  assert.match(deckVaultHome, /function DeckCardHoverPreview/);
  assert.match(deckVaultHome, /createPortal/);
  assert.match(deckVaultHome, /role="tooltip"/);
  assert.match(deckVaultHome, /aria-label=\{`Card preview for \$\{card\.name\}`\}/);
  assert.match(deckVaultHome, /previewImageForCard\(card\)/);
  assert.match(deckVaultHome, /card\.image \|\| `\/api\/deck-vault\/card-image\?name=/);
  assert.match(deckVaultHome, /card\.setCode\?\.toUpperCase\(\)/);
  assert.match(deckVaultHome, /card\.collectorNumber/);
});

test("Commander bracket assessment uses shared evaluator and omits non-Commander formats", () => {
  assert.match(deckVaultHome, /evaluateCommanderBracket\(deck\.cards\)/);
  assert.match(deckVaultHome, /isCommanderDeckFormat\(deck\.format\)/);
  assert.match(deckVaultHome, /Commander bracket/);
  assert.match(deckVaultHome, /View bracket analysis/);
  assert.match(deckVaultHome, /\{isCommander \? \(/);
  assert.match(deckFormats, /commander \/ edh/);
  assert.match(deckFormats, /commander\/edh/);
  assert.match(deckFormats, /format === "EDH" \|\| format === "Pauper EDH"/);
});

test("missing Commander bracket data fails gracefully without affecting routes", () => {
  assert.match(deckVaultHome, /Commander bracket pending/);
  assert.match(deckVaultHome, /deck\.cards\.length \? evaluateCommanderBracket/);
  assert.match(deckVaultHome, /Open deck/);
  assert.match(deckVaultHome, /Analyze/);
  assert.match(deckVaultHome, /\/dashboard\/deck-vault\/decks\/\$\{deck\.id\}/);
});

test("Deck Detail live inspector separates hover preview from locked selection", () => {
  assert.match(deckDetailWorkspace, /const \[hoveredCardId, setHoveredCardId\]/);
  assert.match(deckDetailWorkspace, /const inspectorCard =\s*hoveredCard \?\?\s*selectedCard \?\?/);
  assert.match(deckDetailWorkspace, /function previewCard\(id: string\)/);
  assert.match(deckDetailWorkspace, /function clearCardPreview\(id\?: string\)/);
  assert.match(deckDetailWorkspace, /function selectCard\(id: string\)/);
  assert.match(deckDetailWorkspace, /onMouseEnter=\{onPreview\}/);
  assert.match(deckDetailWorkspace, /onMouseLeave=\{onPreviewEnd\}/);
  assert.doesNotMatch(deckDetailWorkspace, /onMouseEnter=\{onSelect\}/);
});

test("Deck Detail inspector uses existing exact card image path with loading and fallback states", () => {
  assert.match(deckDetailWorkspace, /function deckCardImageCandidates\(card: DeckCard\)/);
  assert.match(deckDetailWorkspace, /source: "direct"/);
  assert.match(deckDetailWorkspace, /source: "fallback-api"/);
  assert.match(deckDetailWorkspace, /function deckCardImageFallbackSource\(card: DeckCard\)/);
  assert.match(deckDetailWorkspace, /params\.set\("setCode", card\.setCode\)/);
  assert.match(deckDetailWorkspace, /params\.set\("collectorNumber", card\.collectorNumber\)/);
  assert.match(deckDetailWorkspace, /function InspectorCardImage/);
  assert.match(deckDetailWorkspace, /deckInspectorImageCache/);
  assert.match(deckDetailWorkspace, /INSPECTOR_IMAGE_TIMEOUT_MS/);
  assert.match(deckDetailWorkspace, /activeImageRequestRef/);
  assert.match(deckDetailWorkspace, /aspect-\[0\.715\]/);
  assert.match(deckDetailWorkspace, /object-contain/);
  assert.match(deckDetailWorkspace, /animate-pulse/);
  assert.match(deckDetailWorkspace, /Card image unavailable/);
});

test("Deck Detail card image fallback route supports exact printing lookup and bounded failures", () => {
  assert.match(deckCardImageRoute, /request\.nextUrl\.searchParams\.get\("set"\)/);
  assert.match(deckCardImageRoute, /request\.nextUrl\.searchParams\.get\("setCode"\)/);
  assert.match(deckCardImageRoute, /request\.nextUrl\.searchParams\s*\n\s*\.get\("collectorNumber"\)/);
  assert.match(deckCardImageRoute, /https:\/\/api\.scryfall\.com\/cards\/\$\{encodeURIComponent/);
  assert.match(deckCardImageRoute, /cards\/named\?/);
  assert.match(deckCardImageRoute, /SCRYFALL_TIMEOUT_MS/);
  assert.match(deckCardImageRoute, /Card image lookup timed out/);
  assert.match(deckCardImageRoute, /Card image fetch timed out/);
});

test("Deck Detail hover preview does not expose mutation actions until click selection locks the card", () => {
  assert.match(deckDetailWorkspace, /const inspectorLocked =/);
  assert.match(deckDetailWorkspace, /\{inspectorLocked \? \(/);
  assert.match(deckDetailWorkspace, /Click this card in Deck Canvas to lock it for editing/);
  assert.match(deckDetailWorkspace, /setReplacementCard\(inspectorCard\)/);
  assert.match(deckDetailWorkspace, /trashCardFromDeck\(inspectorCard\)/);
  assert.match(deckDetailWorkspace, /Remove one copy from deck/);
});

test("Deck Detail keeps Commander-only actions format gated through shared helper", () => {
  assert.match(deckDetailWorkspace, /import \{ isCommanderDeckFormat \}/);
  assert.match(deckDetailWorkspace, /const isCommander = isCommanderDeckFormat\(format\)/);
  assert.match(deckDetailWorkspace, /\{isCommander \? <InspectorAction/);
  assert.match(deckDetailWorkspace, /Analyze on EDHREC/);
  assert.match(deckFormats, /format === "EDH" \|\| format === "Pauper EDH"/);
});

test("Deck Detail touch and keyboard paths select cards without relying on hover", () => {
  assert.match(deckDetailWorkspace, /onClick=\{onSelect\}/);
  assert.match(deckDetailWorkspace, /onFocus=\{onPreview\}/);
  assert.match(deckDetailWorkspace, /focus-visible:ring-2 focus-visible:ring-cyan-300\/50/);
  assert.match(deckDetailWorkspace, /onSelect=\{selectCard\}/);
  assert.match(deckDetailWorkspace, /onPreview=\{previewCard\}/);
});
