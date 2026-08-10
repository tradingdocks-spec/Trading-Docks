import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { tdTokens } from '../design/shared-tokens.ts';
import {
  buildLaunchChoreographyContract,
  describeScanLockState,
  SCAN_LOCK_STATES,
  SIGNATURE_SKELETON_SURFACES,
  TRADING_DOCKS_HAPTIC_VOCABULARY,
  TRADING_DOCKS_SIGNATURE_INTERACTIONS,
} from '../services/signature-experience.ts';
import {
  getMobileTabs,
  MOBILE_PRIMARY_TAB_COUNT,
} from '../services/navigation-contract.ts';

const root = process.cwd();

test('semantic color roles use the Trading Docks signature palette', () => {
  assert.equal(tdTokens.color.role.activeNavigation, tdTokens.color.raw.cyan500);
  assert.equal(tdTokens.color.role.scanner, tdTokens.color.raw.cyan500);
  assert.equal(tdTokens.color.role.primaryAction, tdTokens.color.raw.blue500);
  assert.equal(tdTokens.color.role.success, tdTokens.color.raw.emerald500);
  assert.equal(tdTokens.color.role.attention, tdTokens.color.raw.amber500);
  assert.equal(tdTokens.color.role.decks, tdTokens.color.raw.purple500);
  assert.equal(tdTokens.color.role.structure, tdTokens.color.raw.navy900);
  assert.equal(tdTokens.color.role.content, tdTokens.color.raw.slate50);
  assert.equal(tdTokens.color.role.metadata, tdTokens.color.raw.slate500);
});

test('signature interactions and haptic vocabulary are frozen', () => {
  assert.deepEqual(TRADING_DOCKS_SIGNATURE_INTERACTIONS, ['dock', 'lift', 'slot', 'scanLock', 'reveal']);
  assert.equal(TRADING_DOCKS_HAPTIC_VOCABULARY.dock, 'light');
  assert.equal(TRADING_DOCKS_HAPTIC_VOCABULARY.lift, 'selection');
  assert.equal(TRADING_DOCKS_HAPTIC_VOCABULARY.slot, 'medium');
  assert.equal(TRADING_DOCKS_HAPTIC_VOCABULARY.scanLock, 'selection');
  assert.equal(TRADING_DOCKS_HAPTIC_VOCABULARY.reveal, 'success');
});

test('five-tab navigation remains frozen without Intelligence or Deal Desk primary tabs', () => {
  for (const accountType of ['free', 'collector', 'seller', 'store']) {
    const tabs = getMobileTabs(accountType);
    assert.equal(tabs.length, MOBILE_PRIMARY_TAB_COUNT);
    assert.deepEqual(tabs.map((tab) => tab.label), ['Home', 'Collection', 'Scan', 'Decks', 'Account']);
    assert.equal(tabs.some((tab) => tab.label === 'Intelligence' || tab.route === 'deal-desk' as never), false);
  }

  const tabLayout = readFileSync(join(root, 'app', '(tabs)', '_layout.tsx'), 'utf8');
  const tabScreens = Array.from(tabLayout.matchAll(/<Tabs\.Screen name="([^"]+)"/g)).map((match) => match[1]);
  assert.deepEqual(tabScreens, ['index', 'collection', 'scan', 'sell', 'profile']);
});

test('LocationBreadcrumb is adopted by active collection and storage surfaces', () => {
  for (const file of [
    join(root, 'app', '(tabs)', 'collection.tsx'),
    join(root, 'app', 'collection', '[cardId].tsx'),
    join(root, 'app', 'storage-locations.tsx'),
  ]) {
    assert.match(readFileSync(file, 'utf8'), /LocationBreadcrumb/);
  }
});

test('deck surfaces use collectible object primitives', () => {
  const decks = readFileSync(join(root, 'app', '(tabs)', 'sell.tsx'), 'utf8');
  const showcase = readFileSync(join(root, 'app', 'decks', '[deckId]', 'showcase.tsx'), 'utf8');

  assert.match(decks, /CollectibleHero/);
  assert.match(decks, /CollectibleThumbnail/);
  assert.match(showcase, /CollectibleHero/);
  assert.match(showcase, /Deck Showcase/);
});

test('launch choreography respects Reduce Motion and never blocks readiness', () => {
  const animated = buildLaunchChoreographyContract({ appReady: false, reduceMotion: false });
  assert.equal(animated.blocksAppReadiness, false);
  assert.equal(animated.minimumDurationMs, 700);
  assert.equal(animated.maximumDurationMs, 1000);
  assert.equal(animated.nextSurface, 'matching-skeleton');

  const reduced = buildLaunchChoreographyContract({ appReady: true, reduceMotion: true });
  assert.equal(reduced.targetDurationMs, 0);
  assert.equal(reduced.blocksAppReadiness, false);
  assert.equal(reduced.nextSurface, 'home');
});

test('scanner lock vocabulary exposes every production state', () => {
  assert.deepEqual(SCAN_LOCK_STATES, ['searching', 'found', 'locked', 'reading', 'added', 'remove', 'ready']);
  assert.equal(describeScanLockState('ready').label, 'Ready');
  assert.equal(describeScanLockState('added').tone, 'success');
});

test('material skeleton and accessibility contracts are available', () => {
  assert.deepEqual(SIGNATURE_SKELETON_SURFACES, ['home', 'collection', 'decks', 'account', 'binder', 'scanner']);

  const loading = readFileSync(join(root, 'components', 'signature-loading.tsx'), 'utf8');
  const designSystem = readFileSync(join(root, 'components', 'design-system.tsx'), 'utf8');
  assert.match(loading, /accessibilityRole="progressbar"/);
  assert.match(loading, /TradingDocksLaunchChoreography/);
  assert.match(designSystem, /accessibilityLabel=\{`\$\{title\} collectible thumbnail`\}/);
  assert.match(designSystem, /accessibilityLabel=\{accessibilityLabel \?\? `Location/);
});
