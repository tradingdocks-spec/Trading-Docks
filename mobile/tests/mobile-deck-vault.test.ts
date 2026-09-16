import assert from 'node:assert/strict';
import test from 'node:test';

import { addScannerCardsToMobileDeck } from '../services/mobile-deck-vault.ts';
import type { ScannerSessionLine } from '../services/continuous-offer-scanner.ts';
import type { DeckRecord } from '../../src/lib/deck-vault/types.ts';

const line: ScannerSessionLine = {
  id: 'session-1:scan-1',
  stableScanId: 'scan-1',
  game: 'magic',
  cardName: 'Lightning Bolt',
  setCode: 'M10',
  collectorNumber: '146',
  exactPrintingId: 'scryfall-lightning-bolt',
  language: 'en',
  finish: 'normal',
  condition: 'near_mint',
  quantity: 2,
  confidence: 'high_confidence',
  confidenceScore: 96,
  marketPrice: 1.42,
  priceSource: 'scryfall',
  priceTimestamp: '2026-08-27T00:00:00.000Z',
  purchasePercentage: 70,
  cashOffer: 1.99,
  tradeValue: 2.27,
  estimatedMargin: 1.85,
  destination: 'deck',
  storageLocationId: null,
  binderId: null,
  binderPage: null,
  binderSlot: null,
  deckId: 'deck-1',
  deckName: 'Burn',
  tradeStatus: 'not_for_trade',
  destinationSyncState: 'local_only',
  destinationSyncError: null,
  reviewStatus: 'confirmed',
  syncState: 'synced',
  notes: '',
  recognition: {
    detectedGame: 'magic',
    topCandidate: {
      id: 'scryfall-lightning-bolt',
      name: 'Lightning Bolt',
      setCode: 'M10',
      setName: 'Magic 2010',
      collectorNumber: '146',
      finishes: ['normal'],
      language: 'en',
      confidence: 0.96,
      recognitionMode: 'assisted_capture',
    },
    topThree: [],
    overallConfidence: 96,
    confidenceState: 'high_confidence',
    signals: [],
    missingSignals: [],
    conflictingSignals: [],
    finish: {
      finish: 'nonfoil',
      confidence: 0.96,
      evidence: [],
      frameCount: 3,
    },
    recognitionMethod: 'metadata_assisted',
    requiresManualConfirmation: false,
  },
  createdAt: '2026-08-27T00:00:00.000Z',
};

const deck: DeckRecord = {
  id: 'deck-1',
  name: 'Burn',
  format: 'Modern',
  theme: 'Aggro',
  colors: ['R'],
  marketValue: 0,
  ownedCount: 0,
  cardCount: 60,
  power: 5,
  updatedAt: '2026-08-27T00:00:00.000Z',
  status: 'Building',
  cards: [],
};

test('deck assignment writes through the deck vault save path', async () => {
  const saves: DeckRecord[] = [];
  const results = await addScannerCardsToMobileDeck({
    deckId: 'deck-1',
    deckName: 'Burn',
    lines: [line],
    loadDeckRecordImpl: async () => deck,
    saveDeckRecordImpl: async (next) => {
      saves.push(next);
    },
    fetchImpl: async () => new Response(JSON.stringify({
      results: [{
        id: 'card-1',
        name: 'Lightning Bolt',
        manaValue: 1,
        colors: ['R'],
        colorIdentity: ['R'],
        typeLine: 'Instant',
        setCode: 'M10',
        collectorNumber: '146',
        image: 'https://example.com/lightning-bolt.jpg',
        artCrop: 'https://example.com/lightning-bolt-art.jpg',
        price: 1.42,
        legalities: { modern: 'legal' },
      }],
    }), { status: 200 }),
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].ok, true);
  assert.equal(saves.length, 1);
  assert.equal(saves[0].cards.length, 1);
  assert.equal(saves[0].cards[0].quantity, 2);
  assert.equal(saves[0].cards[0].name, 'Lightning Bolt');
});

test('deck assignment failure is recoverable and leaves the inventory item untouched', async () => {
  const results = await addScannerCardsToMobileDeck({
    deckId: 'deck-1',
    deckName: 'Burn',
    lines: [line],
    loadDeckRecordImpl: async () => deck,
    saveDeckRecordImpl: async () => {
      throw new Error('Deck write failed.');
    },
    fetchImpl: async () => new Response(JSON.stringify({
      results: [{
        id: 'card-1',
        name: 'Lightning Bolt',
        manaValue: 1,
        colors: ['R'],
        colorIdentity: ['R'],
        typeLine: 'Instant',
        setCode: 'M10',
        collectorNumber: '146',
        image: 'https://example.com/lightning-bolt.jpg',
        artCrop: 'https://example.com/lightning-bolt-art.jpg',
        price: 1.42,
        legalities: { modern: 'legal' },
      }],
    }), { status: 200 }),
  });

  assert.equal(results[0].ok, false);
  assert.equal(results[0].recoverable, true);
  assert.match(results[0].error, /Deck write failed/);
});
