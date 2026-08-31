import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMobileHomeComposition, buildRecentAdds } from '../services/mobile-home.ts';
import type { CollectionCard, CollectionSummary } from '../services/collector-workspace.ts';
import { getMobileScrollBottomInset } from '../services/navigation-contract.ts';

const summary: CollectionSummary = {
  totalOwnedCards: 42,
  uniquePrintings: 30,
  games: [
    {
      gameId: 'magic',
      label: 'Magic: The Gathering',
      quantity: 42,
      uniquePrintings: 30,
      knownMarketValue: null,
    },
  ],
  productTypes: [
    {
      productType: 'card',
      quantity: 42,
      uniquePrintings: 30,
      knownMarketValue: null,
    },
  ],
  storageLocationCount: 3,
  storedCards: 24,
  unassignedCards: 6,
  storedQuantity: 36,
  unassignedQuantity: 6,
  tradeBinderCount: 2,
  wishlistCount: 1,
  knownMarketValue: null,
  missingPriceCount: 7,
  freeCardLimit: 500,
  freeCardLimitRemaining: 458,
  freeCardLimitExceeded: false,
};

test('Free Home composition focuses scan and collection without fake portfolio values', () => {
  const home = buildMobileHomeComposition({ accountType: 'free', summary, activeSession: null });
  assert.equal(home.workspaceLabel, 'Free workspace');
  assert.equal(home.portfolioState, 'ready');
  assert.equal(home.hero.title, 'Collection value');
  assert.match(home.portfolioMessage, /Value unavailable/);
  assert.deepEqual(home.actions.map((action) => action.key), ['scan', 'collection', 'find', 'binder', 'review']);
  assert.deepEqual(home.actions.map((action) => action.route), ['/(tabs)/scan', '/(tabs)/collection', '/storage-locations', '/physical-binders', '/scanner-session']);
});

test('Collector Home composition emphasizes portfolio and storage', () => {
  const home = buildMobileHomeComposition({ accountType: 'collector', summary, activeSession: null });
  assert.equal(home.workspaceLabel, 'Collector workspace');
  assert.equal(home.portfolioTitle, 'Portfolio pulse');
  assert.match(home.portfolioMessage, /3 storage locations/);
});

test('Seller Home composition keeps review contextual outside the tab bar', () => {
  const home = buildMobileHomeComposition({ accountType: 'seller', summary, activeSession: null });
  const trade = home.actions.find((action) => action.key === 'review');
  assert.equal(home.workspaceLabel, 'Seller workspace');
  assert.equal(trade?.label, 'Review');
  assert.equal(trade?.route, '/scanner-session');
});

test('Store Home composition uses one shared composition with store copy', () => {
  const home = buildMobileHomeComposition({ accountType: 'store', summary, activeSession: null });
  assert.equal(home.workspaceLabel, 'Store workspace');
  assert.equal(home.briefingTitle, 'Harbor briefing');
  assert.equal(home.hero.eyebrow, 'Business snapshot');
});

test('empty portfolio state avoids mock activity', () => {
  const emptySummary = { ...summary, totalOwnedCards: 0, uniquePrintings: 0, storageLocationCount: 0 };
  const home = buildMobileHomeComposition({ accountType: 'collector', summary: emptySummary, activeSession: null });
  assert.equal(home.portfolioState, 'empty');
  assert.match(home.activityMessage, /No saved collection activity/);
});

test('missing movement data is disclosed instead of charted', () => {
  const home = buildMobileHomeComposition({ accountType: 'collector', summary, activeSession: null });
  assert.match(home.briefingMessage, /Market movement is not available yet/);
  assert.match(home.insight.message, /unavailable prices/);
});

test('active session is visible only when real session exists', () => {
  const hidden = buildMobileHomeComposition({ accountType: 'free', summary, activeSession: null });
  const visible = buildMobileHomeComposition({
    accountType: 'seller',
    summary,
    activeSession: { id: 's1', type: 'buying', name: 'Saturday buying', startedAt: '2026-08-04T12:00:00Z', itemCount: 4, status: 'active' },
  });
  assert.equal(hidden.activeSessionVisible, false);
  assert.equal(visible.activeSessionVisible, true);
  assert.equal(visible.activeSessionRoute, '/deal-desk');
});

test('unavailable signal data is explicit', () => {
  const home = buildMobileHomeComposition({ accountType: 'free', summary: null, collectionUnavailable: true, activeSession: null });
  assert.equal(home.portfolioState, 'unavailable');
  assert.match(home.briefingMessage, /Signals are unavailable/);
});

test('Home composition keeps one primary navigation system', () => {
  const home = buildMobileHomeComposition({ accountType: 'collector', summary, activeSession: null });
  assert.equal(home.actions.length, 5);
  assert.equal(home.actions.filter((action) => action.key === 'scan').length, 1);
});

test('Recent Adds carousel uses real card records without invented price or image data', () => {
  const cards: CollectionCard[] = [
    collectionCard({ id: 'old', cardName: 'Older Card', updatedAt: '2026-08-01T12:00:00Z', imageUrl: null, price: null }),
    collectionCard({ id: 'new', cardName: 'New Card', updatedAt: '2026-08-05T12:00:00Z', imageUrl: 'https://example.test/new.jpg', price: 4.25 }),
  ];

  const recent = buildRecentAdds(cards, 2);

  assert.equal(recent[0].id, 'new');
  assert.equal(recent[0].imageUrl, 'https://example.test/new.jpg');
  assert.equal(recent[0].price, '$4.25');
  assert.equal(recent[1].imageUrl, null);
  assert.equal(recent[1].price, 'Price unavailable');
});

test('Home composition carries recent cards into the premium hierarchy', () => {
  const cards = [collectionCard({ id: 'one', cardName: 'Island', updatedAt: '2026-08-05T12:00:00Z' })];
  const home = buildMobileHomeComposition({ accountType: 'collector', summary, activeSession: null, recentCards: cards });

  assert.equal(home.recentAdds.length, 1);
  assert.equal(home.recentAdds[0].title, 'Island');
});

test('bottom navigation spacing contract keeps content clear', () => {
  const minimumBottomPadding = getMobileScrollBottomInset(21);
  assert.ok(minimumBottomPadding >= 96);
});

function collectionCard({
  id,
  cardName,
  updatedAt,
  imageUrl = null,
  price = null,
}: {
  id: string;
  cardName: string;
  updatedAt: string;
  imageUrl?: string | null;
  price?: number | null;
}): CollectionCard {
  return {
    id,
    cardName,
    game: 'Magic: The Gathering',
    gameId: 'magic',
    gameLabel: 'Magic: The Gathering',
    productType: 'card',
    printing: {
      scryfallId: id,
      setCode: 'tdo',
      setName: 'Trading Docks',
      collectorNumber: '1',
      language: 'en',
      finish: 'normal',
      treatment: null,
      imageUrl,
    },
    condition: 'near_mint',
    quantityOwned: 1,
    storageLocation: null,
    tradeBinderStatus: 'not_for_trade',
    wishlistStatus: 'not_wishlisted',
    costBasisKnown: false,
    marketPrice: {
      amount: price,
      currency: 'USD',
      source: price === null ? 'unavailable' : 'inventory',
      updatedAt,
    },
    updatedAt,
  };
}
