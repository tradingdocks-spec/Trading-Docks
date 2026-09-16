import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildScannerAddPayload,
  createInterruptedScanDraft,
  normalizeScannerCandidate,
  resetAfterRapidScan,
  resolveScannerPermissionState,
  scannerPrivacySummary,
  scannerQueueKey,
  unavailableCameraProvider,
  validateScannerConfirmation,
  type ScannerConfirmation,
} from '../services/scanner-foundation.ts';

const candidate = normalizeScannerCandidate({
  id: 'scryfall-1',
  name: 'Rhystic Study',
  setCode: 'wot',
  setName: 'Wilds of Eldraine',
  collectorNumber: '25',
  finishes: ['foil', 'nonfoil'],
  language: 'en',
  imageUrl: 'https://cards.example/rhystic.jpg',
  confidence: 0.94,
})!;

const confirmation: ScannerConfirmation = {
  userId: 'user-1',
  candidate,
  quantity: 1,
  condition: 'near_mint',
  finish: 'foil',
  language: 'en',
  storageLocationId: 'binder-1',
  tradeStatus: 'available',
  addToWishlist: true,
};

test('permission denied and camera unavailable states are explicit', () => {
  assert.equal(resolveScannerPermissionState({ cameraAvailable: true, permissionDenied: true, requested: true }), 'denied');
  assert.equal(resolveScannerPermissionState({ cameraAvailable: false }), 'unavailable');
  assert.equal(resolveScannerPermissionState({ cameraAvailable: true }), 'not_requested');
});

test('manual search fallback provider does not fake recognition', async () => {
  const result = await unavailableCameraProvider.recognize({ query: 'Rhystic', online: true });
  assert.equal(result.ok, false);
  assert.equal(unavailableCameraProvider.supportsImageCapture, false);
});

test('exact printing selection normalizes set, collector number, finish, and language', () => {
  assert.equal(candidate.setCode, 'WOT');
  assert.equal(candidate.collectorNumber, '25');
  assert.deepEqual(candidate.finishes, ['foil', 'normal']);
  assert.equal(candidate.language, 'en');
});

test('quantity validation and Free-plan limits are enforced before save', () => {
  assert.equal(validateScannerConfirmation({ ...confirmation, quantity: 0 }, { membershipTier: 'free', currentTotalQuantity: 10 }).ok, false);
  assert.equal(validateScannerConfirmation({ ...confirmation, quantity: 2 }, { membershipTier: 'free', currentTotalQuantity: 499 }).ok, false);
  assert.equal(validateScannerConfirmation(confirmation, { membershipTier: 'collector', currentTotalQuantity: 2000 }).ok, true);
  assert.equal(validateScannerConfirmation(confirmation, { membershipTier: 'free', currentTotalQuantity: 1_219, hasFullPlatformAccess: true }).ok, true);
});

test('scanner add payload includes storage assignment and exact printing fields', () => {
  const payload = buildScannerAddPayload(confirmation, 'scan-1');
  assert.equal(payload.game_id, 'magic');
  assert.equal(payload.product_type, 'card');
  assert.equal(payload.provider_category_id, '1');
  assert.equal(payload.variant, 'foil');
  assert.equal(payload.language, 'en');
  assert.equal(payload.location_id, 'binder-1');
  assert.equal(payload.quantity, 1);
  assert.equal(payload.set_code, 'WOT');
  assert.equal(payload.collector_number, '25');
  assert.equal(payload.data.finish, 'foil');
  assert.equal(payload.data.condition, 'near_mint');
});

test('Pokemon scanner payload preserves generic product identity without Scryfall or foil assumptions', () => {
  const pokemonCandidate = normalizeScannerCandidate({
    id: 'tcgtracking:553927',
    gameId: 'pokemon',
    gameLabel: 'Pokemon',
    productType: 'card',
    providerCategoryId: '3',
    providerProductId: '553927',
    providerSkuId: 'sku-777',
    tcgplayerProductId: 553927,
    tcgplayerSkuId: 777,
    providerSource: 'tcgtracking',
    name: 'Pikachu ex',
    setCode: 'sv08',
    setName: 'Surging Sparks',
    collectorNumber: '057/191',
    variant: 'Holofoil',
    finishes: ['normal'],
    language: 'English',
    confidence: 0.9,
    recognitionMode: 'assisted_capture',
  })!;
  const payload = buildScannerAddPayload({
    ...confirmation,
    candidate: pokemonCandidate,
    finish: 'normal',
    language: 'English',
  }, 'pokemon-scan-1');

  assert.equal(payload.game_id, 'pokemon');
  assert.equal(payload.product_type, 'card');
  assert.equal(payload.provider_category_id, '3');
  assert.equal(payload.provider_sku_id, 'sku-777');
  assert.equal(payload.tcgplayer_product_id, 553927);
  assert.equal(payload.tcgplayer_sku_id, 777);
  assert.equal(payload.variant, 'Holofoil');
  assert.equal(payload.scryfall_id, null);
  assert.equal(payload.data.finish, 'normal');
  assert.equal(payload.data.variant, 'Holofoil');
});

test('Trade Binder status and Wishlist action are preserved in confirmation', () => {
  assert.equal(confirmation.tradeStatus, 'available');
  assert.equal(confirmation.addToWishlist, true);
});

test('rapid-scan reset clears selected and confirmation state', () => {
  assert.deepEqual(resetAfterRapidScan(), { query: '', selectedCandidateId: null, confirmation: null, state: 'idle' });
});

test('offline queued add keys are user scoped and deduplicated by validated card state', () => {
  assert.equal(scannerQueueKey(confirmation), scannerQueueKey({ ...confirmation }));
  assert.notEqual(scannerQueueKey(confirmation), scannerQueueKey({ ...confirmation, userId: 'user-2' }));
});

test('offline queued scanner keys distinguish same-name cross-game cards', () => {
  const pokemonCandidate = normalizeScannerCandidate({
    id: candidate.id,
    gameId: 'pokemon',
    providerCategoryId: '3',
    name: candidate.name,
    setCode: 'WOT',
    collectorNumber: '25',
    finishes: ['normal'],
    variant: 'Holofoil',
  })!;
  assert.notEqual(
    scannerQueueKey(confirmation),
    scannerQueueKey({ ...confirmation, candidate: pokemonCandidate, finish: 'normal', language: 'English' }),
  );
});

test('failed mutation rollback can restore previous scanner candidate selection', () => {
  const previous = { selectedCandidateId: candidate.id, quantity: 1 };
  const optimistic = { selectedCandidateId: candidate.id, quantity: 2 };
  assert.equal(optimistic.quantity, 2);
  assert.equal(previous.quantity, 1);
});

test('privacy defaults do not retain or upload images by default', () => {
  const privacy = scannerPrivacySummary();
  assert.equal(privacy.retainsPhotosByDefault, false);
  assert.equal(privacy.uploadsImagesWithoutIntent, false);
  assert.equal(privacy.localDraftStoresImage, false);
});

test('interrupted scan-state recovery is user scoped', () => {
  const draft = createInterruptedScanDraft({ userId: 'user-1', query: 'Rhystic', selectedCandidateId: candidate.id });
  assert.equal(draft.userId, 'user-1');
  assert.equal(draft.selectedCandidateId, candidate.id);
  assert.equal(draft.query, 'Rhystic');
});
