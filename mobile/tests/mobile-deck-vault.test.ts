import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  analyzeMobileDeck,
  colorIdentityLabel,
  formatDeckValue,
  summarizeMobileDeckVault,
  type DeckRecord,
} from '../services/mobile-deck-vault-model.ts';

const root = process.cwd();

test('mobile Deck Vault uses the shared Headquarters DeckRecord contract', () => {
  const service = readFileSync(join(root, 'services', 'mobile-deck-vault.ts'), 'utf8');
  const model = readFileSync(join(root, 'services', 'mobile-deck-vault-model.ts'), 'utf8');

  assert.match(model, /src\/lib\/deck-vault\/types/);
  assert.match(service, /deck_vault_decks/);
  assert.doesNotMatch(service, /from\('mobile_decks'\)|AsyncStorage.*deck/i);
});

test('Decks tab replaces standalone Intelligence without changing tab count', () => {
  const decksTab = readFileSync(join(root, 'app', '(tabs)', 'sell.tsx'), 'utf8');

  assert.match(decksTab, /Deck Vault/);
  assert.match(decksTab, /Decks/);
  assert.match(decksTab, /loadMobileDeckVault/);
  assert.doesNotMatch(decksTab, /Inventory Intelligence|Current signals|headlineForAccount/);
});

test('mobile Deck Vault summarizes only real saved deck values', () => {
  const summary = summarizeMobileDeckVault([
    deck({ id: 'one', marketValue: 12, cardCount: 100 }),
    deck({ id: 'two', marketValue: 0, cardCount: 60 }),
  ]);

  assert.equal(summary.deckCount, 2);
  assert.equal(summary.totalCards, 160);
  assert.equal(summary.knownValue, 12);
});

test('mobile deck analytics preserve missing value and ownership distinctions', () => {
  const analytics = analyzeMobileDeck(deck({
    id: 'analytics',
    cards: [
      card({ id: 'commander', name: 'Commander', board: 'commander', typeLine: 'Legendary Creature', manaValue: 4, price: 0, owned: true }),
      card({ id: 'missing', name: 'Missing Piece', typeLine: 'Instant', manaValue: 2, price: 0, owned: false }),
    ],
    cardCount: 2,
    ownedCount: 1,
    marketValue: 0,
  }));

  assert.equal(analytics.knownValue, null);
  assert.equal(analytics.missingCards, 1);
  assert.equal(analytics.averageManaValue, 3);
});

test('Deck detail and showcase routes are contextual outside the tab group', () => {
  const tabFiles = readFileSync(join(root, 'tests', 'navigation-polish.test.ts'), 'utf8');
  const detail = readFileSync(join(root, 'app', 'decks', '[deckId].tsx'), 'utf8');
  const showcase = readFileSync(join(root, 'app', 'decks', '[deckId]', 'showcase.tsx'), 'utf8');

  assert.match(tabFiles, /sell\.tsx/);
  assert.match(detail, /Deck Detail/);
  assert.match(showcase, /Deck Showcase/);
});

test('deck helpers format color identity and unavailable values honestly', () => {
  assert.equal(colorIdentityLabel(['W', 'U']), 'WU');
  assert.equal(colorIdentityLabel([]), 'C');
  assert.equal(formatDeckValue(null), 'Value unavailable');
  assert.equal(formatDeckValue(123.4), '$123');
});

function deck(overrides: Partial<DeckRecord> = {}): DeckRecord {
  return {
    id: 'deck',
    name: 'Test Deck',
    commander: 'Commander',
    format: 'EDH',
    theme: 'Testing',
    colors: ['U'],
    marketValue: 100,
    ownedCount: 100,
    cardCount: 100,
    power: 7,
    updatedAt: '2026-08-08T00:00:00Z',
    status: 'Building',
    cards: [card()],
    ...overrides,
  };
}

function card(overrides: Partial<DeckRecord['cards'][number]> = {}): DeckRecord['cards'][number] {
  return {
    id: 'card',
    name: 'Card',
    quantity: 1,
    manaValue: 1,
    colors: ['U'],
    typeLine: 'Creature',
    category: 'Creature',
    price: 1,
    owned: true,
    ...overrides,
  };
}
