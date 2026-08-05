import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCollectionCards,
  displayPrinting,
  displayStorageLocation,
  filterCollectionCards,
  priceLabel,
  resolveCollectionViewState,
  sortCollectionCards,
  summarizeCollectionCards,
} from '../mobile/services/collector-workspace.ts';

const cards = buildCollectionCards({
  locations: [
    {
      id: 'binder-1',
      name: 'Commander Binder',
      location_type: 'binder',
      data: { name: 'Commander Binder', type: 'binder' },
    },
  ],
  items: [
    {
      id: 'rhystic-wot-foil',
      card_name: 'Rhystic Study',
      set_code: 'wot',
      collector_number: '25',
      quantity: 2,
      inventory_value: 84,
      updated_at: '2026-08-03T12:00:00Z',
      data: {
        name: 'Rhystic Study',
        set: 'wot',
        setName: 'Wilds of Eldraine',
        collectorNumber: '25',
        finish: 'Foil',
        condition: 'Near Mint',
        locationId: 'binder-1',
        binderPage: 4,
        binderSlot: 'B2',
        imageUrl: 'https://cards.example/rhystic.jpg',
      },
    },
    {
      id: 'sol-ring',
      card_name: 'Sol Ring',
      set_code: 'ltc',
      collector_number: '301',
      quantity: 501,
      inventory_value: null,
      updated_at: '2026-08-01T12:00:00Z',
      data: {
        name: 'Sol Ring',
        set: 'ltc',
        collectorNumber: '301',
        finish: 'Normal',
        condition: 'Lightly Played',
      },
    },
  ],
  tradeStatuses: [
    { inventory_item_id: 'rhystic-wot-foil', status: 'available' },
  ],
  wishlist: [
    { card_name: 'Sol Ring', set_code: 'ltc', target_finish: 'normal' },
  ],
});

test('Collector Workspace search filters by card and set text', () => {
  assert.equal(filterCollectionCards(cards, { query: 'rhystic' }).length, 1);
  assert.equal(filterCollectionCards(cards, { query: 'ltc 301' }).length, 1);
});

test('Collector Workspace sorting supports quantity and set printing order', () => {
  assert.equal(sortCollectionCards(cards, 'quantity_desc')[0]?.cardName, 'Sol Ring');
  assert.equal(sortCollectionCards(cards, 'set_asc')[0]?.printing.setCode, 'ltc');
});

test('exact-printing display includes set and collector number', () => {
  assert.equal(displayPrinting(cards[0].printing), 'WOT #25');
});

test('storage-location display includes binder pocket details', () => {
  assert.equal(displayStorageLocation(cards[0]), 'Commander Binder - Page 4 - Slot B2');
});

test('trade-binder indicator is resolved from trade status rows', () => {
  assert.equal(cards[0].tradeBinderStatus, 'available');
  assert.equal(summarizeCollectionCards(cards, 'collector').tradeBinderCount, 1);
});

test('wishlist indicator is resolved from wishlist rows', () => {
  assert.equal(cards[1].wishlistStatus, 'wanted');
  assert.equal(summarizeCollectionCards(cards, 'collector').wishlistCount, 1);
});

test('Free card-limit behavior reports remaining and exceeded states', () => {
  const summary = summarizeCollectionCards(cards, 'free');
  assert.equal(summary.freeCardLimit, 500);
  assert.equal(summary.freeCardLimitRemaining, 0);
  assert.equal(summary.freeCardLimitExceeded, true);
});

test('empty state and no-results state are distinct', () => {
  assert.equal(resolveCollectionViewState({ loading: false, totalCount: 0, visibleCount: 0 }), 'empty');
  assert.equal(resolveCollectionViewState({ loading: false, totalCount: 2, visibleCount: 0 }), 'no_results');
});

test('missing price is shown as unavailable, not zero', () => {
  assert.equal(cards[1].marketPrice.amount, null);
  assert.equal(priceLabel(cards[1]), 'Price unavailable');
  assert.equal(summarizeCollectionCards(cards, 'collector').missingPriceCount, 1);
});
