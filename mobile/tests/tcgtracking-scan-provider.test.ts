import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TCGTRACKING_MAGIC_GAME_ID,
  TCGTRACKING_POKEMON_GAME_ID,
  TCGTRACKING_SCAN_GAMES,
  TCGTRACKING_SCAN_MAX_IMAGE_BYTES,
  classifyTcgTrackingScanConfidence,
  decodedImageBytes,
  tcgTrackingCandidateToScannerCandidate,
  tcgTrackingScanGameId,
  tcgTrackingScanGameLabel,
} from '../services/tcgtracking-scan-contract.ts';
import { buildScannerAddPayload, type ScannerConfirmation } from '../services/scanner-foundation.ts';

test('TCGTracking mobile scan contract uses numeric Magic game id and 100KB image ceiling', () => {
  assert.equal(TCGTRACKING_MAGIC_GAME_ID, 1);
  assert.equal(TCGTRACKING_SCAN_MAX_IMAGE_BYTES, 100_000);
  assert.equal(decodedImageBytes('AAAA'), 3);
  assert.equal(classifyTcgTrackingScanConfidence(0.93), 'high');
  assert.equal(classifyTcgTrackingScanConfidence(0.8), 'medium');
  assert.equal(classifyTcgTrackingScanConfidence(0.5), 'low');
});

test('TCGTracking mobile scanner exposes explicit Magic and Pokemon game selection', () => {
  assert.equal(TCGTRACKING_MAGIC_GAME_ID, 1);
  assert.equal(TCGTRACKING_POKEMON_GAME_ID, 3);
  assert.deepEqual(
    TCGTRACKING_SCAN_GAMES.map((game) => [game.id, game.gameId, game.label]),
    [
      ['magic', 1, 'Magic'],
      ['pokemon', 3, 'Pokemon'],
    ],
  );
  assert.equal(tcgTrackingScanGameId('magic'), 1);
  assert.equal(tcgTrackingScanGameId('pokemon'), 3);
  assert.equal(tcgTrackingScanGameLabel('pokemon'), 'Pokemon');
});

test('TCGTracking candidate conversion preserves product identity without inventing condition or finish', () => {
  const candidate = tcgTrackingCandidateToScannerCandidate({
    source: 'tcgtracking',
    providerProductId: '456789',
    tcgplayerProductId: 456789,
    productIdentity: {
      scryfallId: '00000000-0000-4000-8000-000000000082',
      name: 'Unblinking Observer',
      setCode: 'MID',
      setName: 'Innistrad: Midnight Hunt',
      collectorNumber: '82',
      imageUrl: 'https://cdn.tcgtracking.test/card.jpg',
      tcgplayerProductId: 456789,
      providerProductId: '456789',
    },
    confidence: 0.97,
    requiresConfirmation: true,
  });
  assert.ok(candidate);
  assert.equal(candidate.providerSource, 'tcgtracking');
  assert.equal(candidate.gameId, 'magic');
  assert.equal(candidate.providerCategoryId, '1');
  assert.equal(candidate.tcgplayerProductId, 456789);
  assert.equal(candidate.providerProductId, '456789');
  assert.deepEqual(candidate.finishes, ['normal', 'foil', 'etched']);
});

test('TCGTracking Pokemon scan candidates preserve selected game, SKU, and variant identity', () => {
  const candidate = tcgTrackingCandidateToScannerCandidate({
    source: 'tcgtracking',
    gameId: TCGTRACKING_POKEMON_GAME_ID,
    providerCategoryId: '3',
    providerProductId: '553927',
    providerSkuId: 'sku-777',
    tcgplayerProductId: 553927,
    tcgplayerSkuId: 777,
    variant: 'Reverse Holofoil',
    productIdentity: {
      name: 'Pikachu ex',
      setCode: 'SV08',
      setName: 'Surging Sparks',
      collectorNumber: '057/191',
      providerProductId: '553927',
      providerSkuId: 'sku-777',
      tcgplayerProductId: 553927,
      tcgplayerSkuId: 777,
      providerCategoryId: '3',
      variant: 'Reverse Holofoil',
    },
    confidence: 0.91,
    requiresConfirmation: true,
  }, { game: 'pokemon' });

  assert.ok(candidate);
  assert.equal(candidate.gameId, 'pokemon');
  assert.equal(candidate.gameLabel, 'Pokemon');
  assert.equal(candidate.providerCategoryId, '3');
  assert.equal(candidate.providerSkuId, 'sku-777');
  assert.equal(candidate.tcgplayerSkuId, 777);
  assert.equal(candidate.variant, 'Reverse Holofoil');
  assert.deepEqual(candidate.finishes, ['normal']);
});

test('TCGTracking product-only candidates do not write provider ids as Scryfall ids', () => {
  const candidate = tcgTrackingCandidateToScannerCandidate({
    source: 'tcgtracking',
    providerProductId: '456789',
    tcgplayerProductId: 456789,
    productIdentity: {
      name: 'Unblinking Observer',
      setCode: 'MID',
      setName: 'Innistrad: Midnight Hunt',
      collectorNumber: '82',
      tcgplayerProductId: 456789,
      providerProductId: '456789',
    },
    confidence: 0.97,
    requiresConfirmation: true,
  });
  assert.ok(candidate);
  assert.equal(candidate.id, 'tcgtracking:456789');
  const payload = buildScannerAddPayload({
    userId: 'user-1',
    candidate,
    quantity: 1,
    condition: 'near_mint',
    finish: 'normal',
    language: 'en',
    storageLocationId: null,
    tradeStatus: 'not_for_trade',
    addToWishlist: false,
  } satisfies ScannerConfirmation, 'inventory-id-1');
  assert.equal(payload.scryfall_id, null);
  assert.equal(payload.game_id, 'magic');
  assert.equal(payload.tcgplayer_product_id, 456789);
  assert.equal(payload.data.tcgplayerProductId, 456789);
  assert.equal(payload.data.providerSource, 'tcgtracking');
});
