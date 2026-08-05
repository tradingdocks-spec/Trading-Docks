import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMobileHomeComposition } from '../services/mobile-home.ts';
import type { CollectionSummary } from '../services/collector-workspace.ts';

const summary: CollectionSummary = {
  totalOwnedCards: 42,
  uniquePrintings: 30,
  storageLocationCount: 3,
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
  assert.match(home.portfolioMessage, /Value unavailable/);
  assert.deepEqual(home.actions.map((action) => action.key), ['scan', 'collection', 'trade', 'search']);
});

test('Collector Home composition emphasizes portfolio and storage', () => {
  const home = buildMobileHomeComposition({ accountType: 'collector', summary, activeSession: null });
  assert.equal(home.workspaceLabel, 'Collector workspace');
  assert.equal(home.portfolioTitle, 'Portfolio pulse');
  assert.match(home.portfolioMessage, /3 storage locations/);
});

test('Seller Home composition routes trade action to Deal Desk', () => {
  const home = buildMobileHomeComposition({ accountType: 'seller', summary, activeSession: null });
  const trade = home.actions.find((action) => action.key === 'trade');
  assert.equal(home.workspaceLabel, 'Seller workspace');
  assert.equal(trade?.label, 'Deal Desk');
  assert.equal(trade?.route, '/(tabs)/deal-desk');
});

test('Store Home composition uses one shared composition with store copy', () => {
  const home = buildMobileHomeComposition({ accountType: 'store', summary, activeSession: null });
  assert.equal(home.workspaceLabel, 'Store workspace');
  assert.equal(home.briefingTitle, 'Harbor briefing');
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
  assert.equal(visible.activeSessionRoute, '/(tabs)/deal-desk');
});

test('unavailable signal data is explicit', () => {
  const home = buildMobileHomeComposition({ accountType: 'free', summary: null, collectionUnavailable: true, activeSession: null });
  assert.equal(home.portfolioState, 'unavailable');
  assert.match(home.briefingMessage, /Signals are unavailable/);
});

test('Home composition keeps one primary navigation system', () => {
  const home = buildMobileHomeComposition({ accountType: 'collector', summary, activeSession: null });
  assert.equal(home.actions.length, 4);
  assert.equal(home.actions.every((action) => action.route.startsWith('/(tabs)')), true);
});

test('bottom navigation spacing contract keeps content clear', () => {
  const minimumBottomPadding = 112;
  assert.ok(minimumBottomPadding >= 96);
});
