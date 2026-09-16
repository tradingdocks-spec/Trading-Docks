import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { mobileSyncStatusFromScannerLine, mobileSyncStatusLabel } from '../services/mobile-sync-status.ts';

const mobileSupabase = readFileSync('lib/supabase.ts', 'utf8');
const webBrowserSupabase = readFileSync('../src/lib/supabase/client.ts', 'utf8');
const scannerData = readFileSync('services/scanner-data.ts', 'utf8');
const scannerSession = readFileSync('app/scanner-session.tsx', 'utf8');
const collectionRoute = readFileSync('app/(tabs)/collection.tsx', 'utf8');
const tradeWishlistData = readFileSync('services/trade-binder-wishlist-data.ts', 'utf8');

test('mobile and web Supabase clients use public project identity keys', () => {
  assert.match(mobileSupabase, /EXPO_PUBLIC_SUPABASE_URL/);
  assert.match(mobileSupabase, /EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(webBrowserSupabase, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(webBrowserSupabase, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(mobileSupabase, /keyLooksSecret/);
  assert.match(mobileSupabase, /!keyLooksSecret/);
  assert.doesNotMatch(mobileSupabase, /SERVICE_ROLE|service_role/i);
  assert.doesNotMatch(webBrowserSupabase, /SERVICE_ROLE|service_role|sb_secret/i);
});

test('mobile collection reads the canonical shared inventory source', () => {
  assert.match(collectionRoute, /loadCollectorCollectionPage/);
  assert.match(scannerData, /create_inventory_item_with_event/);
  assert.match(scannerData, /eq\('user_id', userId\)/);
});

test('scanner review finalization writes canonical shared inventory records', () => {
  assert.match(scannerSession, /buildScannerCollectionConfirmation/);
  assert.match(scannerSession, /saveScannerConfirmation/);
  assert.match(scannerData, /supabase\.rpc\('create_inventory_item_with_event'/);
  assert.match(scannerData, /p_inventory: payload/);
  assert.match(scannerData, /runMobileTradeWishlistMutation/);
  assert.match(scannerData, /clearScannerDraft/);
});

test('scanner sessions remain local-only until finalized', () => {
  assert.match(scannerSession, /continuousScannerSessionKey\(userId\)/);
  assert.match(scannerSession, /appStorage\.setItem/);
  assert.match(scannerSession, /readySessionLines/);
  assert.match(scannerSession, /Store .*ready cards/);
  assert.match(scannerSession, /destinationSyncState/);
});

test('Trade Binder and Wishlist use shared backend tables scoped by user', () => {
  assert.match(tradeWishlistData, /from\('binder_card_trade_status'\)/);
  assert.match(tradeWishlistData, /from\('collector_wishlist'\)/);
  assert.match(tradeWishlistData, /eq\('user_id', userId\)/);
});

test('shared mobile sync labels cover scanner finalize states', () => {
  assert.equal(mobileSyncStatusLabel('synced'), 'Synced');
  assert.equal(mobileSyncStatusFromScannerLine({ syncState: 'synced' }), 'synced');
  assert.equal(mobileSyncStatusFromScannerLine({ syncState: 'pending_sync' }), 'pending');
  assert.equal(mobileSyncStatusFromScannerLine({ syncState: 'local_only', online: false }), 'offline');
  assert.equal(mobileSyncStatusFromScannerLine({ syncState: 'failed' }), 'failed');
  assert.equal(mobileSyncStatusFromScannerLine({ syncState: 'pending_sync', syncing: true }), 'syncing');
});
