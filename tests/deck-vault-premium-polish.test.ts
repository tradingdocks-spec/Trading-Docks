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
const deckPage = readFileSync(
  path.join(repoRoot, "src/app/dashboard/deck-vault/page.tsx"),
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

test("responsive Deck Vault layout uses bounded grids and avoids fixed overflow-prone widths", () => {
  assert.match(deckVaultHome, /max-w-\[1480px\]/);
  assert.match(deckVaultHome, /grid gap-4 lg:grid-cols-2 2xl:grid-cols-3/);
  assert.match(deckVaultHome, /min-w-0/);
  assert.match(deckVaultHome, /flex flex-wrap gap-2\.5/);
  assert.doesNotMatch(deckVaultHome, /(?<!max-)w-\[[1-9]\d{3,}px\]/);
});
