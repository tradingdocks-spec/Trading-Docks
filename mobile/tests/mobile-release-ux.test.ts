import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  RELEASE_HAPTICS,
  RELEASE_SAFE_AREA,
  humanizeReleaseError,
  isMobileDevRouteEnabled,
  releaseEmptyState,
  releaseErrorState,
  releaseLoadingState,
  releaseMotion,
  releaseSyncCopy,
} from '../services/mobile-release-ux.ts';

const root = process.cwd();

test('shared release loading states avoid fake data and match final surfaces', () => {
  assert.deepEqual(releaseLoadingState('collection'), {
    title: 'Loading collection',
    message: 'Fetching your saved cards.',
  });
  assert.match(releaseLoadingState('membership').message, /StoreKit/);
  assert.doesNotMatch(JSON.stringify(releaseLoadingState('home_snapshot')), /\$|[0-9]{4,}/);
});

test('shared empty states provide one useful next action', () => {
  assert.equal(releaseEmptyState('collection').title, 'No cards yet');
  assert.equal(releaseEmptyState('collection').actionLabel, 'Scan a card');
  assert.equal(releaseEmptyState('review_cards').title, 'No cards need review');
  assert.equal(releaseEmptyState('storage_locations').actionLabel, 'Create location');
});

test('shared error recovery hides provider internals and exposes recovery actions', () => {
  const purchase = releaseErrorState('purchase_failed');
  const ocr = releaseErrorState('ocr_failed');
  const lookup = releaseErrorState('lookup_failed');

  assert.equal(purchase.title, "Purchase couldn't be completed");
  assert.doesNotMatch(`${purchase.title} ${purchase.message}`, /RevenueCat|StoreKit|stack|secret/i);
  assert.doesNotMatch(`${ocr.title} ${ocr.message}`, /Apple Vision|OCR provider|requested regions/i);
  assert.equal(lookup.actionLabel, 'Search manually');
});

test('auth and network errors are humanized without raw provider details', () => {
  assert.equal(humanizeReleaseError(new Error('JWT expired')).title, 'Sign in again');
  assert.equal(humanizeReleaseError('Scryfall lookup timeout').title, "Couldn't connect");
  assert.equal(humanizeReleaseError('Apple Vision OCR did not return readable text').title, "Couldn't read the card");
});

test('offline and sync copy stays quiet and understandable', () => {
  assert.deepEqual(releaseSyncCopy('pending_changes'), {
    label: 'Pending changes',
    message: "Saved on this device. Will sync when you're back online.",
  });
  assert.equal(releaseSyncCopy('online').label, 'Online');
  assert.equal(releaseSyncCopy('sync_failed').label, 'Sync failed');
});

test('release motion and haptic contracts respect Reduce Motion and scanner throughput', () => {
  assert.equal(releaseMotion('sheet', false).durationMs, 180);
  assert.equal(releaseMotion('sheet', true).durationMs, 0);
  assert.match(RELEASE_HAPTICS.medium, /scanner successful capture/);
  assert.doesNotMatch(RELEASE_HAPTICS.light, /frame analysis/i);
});

test('safe-area and small-screen release contracts cover target iPhone widths', () => {
  assert.equal(RELEASE_SAFE_AREA.minTouchTarget, 44);
  assert.deepEqual(RELEASE_SAFE_AREA.supportedWidths, [320, 375, 390, 430]);
  assert.ok(RELEASE_SAFE_AREA.bottomNavContentPadding >= 88);
});

test('production dev-route gating blocks diagnostics unless explicit flags are present', () => {
  const production = { NODE_ENV: 'production' };
  assert.equal(isMobileDevRouteEnabled('/dev/design-system', production), false);
  assert.equal(isMobileDevRouteEnabled('/dev/scanner-benchmark', production), false);
  assert.equal(isMobileDevRouteEnabled('/dev/camera-qa', production), false);
  assert.equal(isMobileDevRouteEnabled('/(tabs)', production), true);

  const development = {
    NODE_ENV: 'development',
    EXPO_PUBLIC_ENABLE_DESIGN_SYSTEM_SHOWCASE: 'true',
    EXPO_PUBLIC_ENABLE_SCANNER_BENCHMARK_BUILDER: 'true',
    EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS: 'true',
  };
  assert.equal(isMobileDevRouteEnabled('/dev/design-system', development), true);
  assert.equal(isMobileDevRouteEnabled('/dev/scanner-benchmark', development), true);
  assert.equal(isMobileDevRouteEnabled('/dev/camera-qa', development), true);
});

test('key mobile release routes consume shared release UX contracts', () => {
  const layout = readFileSync(join(root, 'app', '_layout.tsx'), 'utf8');
  const collection = readFileSync(join(root, 'app', '(tabs)', 'collection.tsx'), 'utf8');
  const recovery = readFileSync(join(root, 'app', 'scanner-recovery.tsx'), 'utf8');
  const designSystem = readFileSync(join(root, 'app', 'dev', 'design-system.tsx'), 'utf8');
  const benchmark = readFileSync(join(root, 'app', 'dev', 'scanner-benchmark.tsx'), 'utf8');
  const cameraQa = readFileSync(join(root, 'app', 'dev', 'camera-qa.tsx'), 'utf8');

  assert.match(layout, /releaseLoadingState\('profile'\)/);
  assert.match(collection, /releaseEmptyState\('collection'\)/);
  assert.match(collection, /humanizeReleaseError/);
  assert.match(recovery, /releaseSyncCopy\('pending_changes'\)/);
  assert.match(designSystem, /isMobileDevRouteEnabled\('\/dev\/design-system'\)/);
  assert.match(benchmark, /isMobileDevRouteEnabled\('\/dev\/scanner-benchmark'\)/);
  assert.match(cameraQa, /isMobileDevRouteEnabled\('\/dev\/camera-qa'\)/);
});
