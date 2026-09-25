import { physicalResolution } from '../src/lib/card-intelligence/resolution.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScannerCandidate, validateScannerConfirmation } from '../mobile/services/scanner-foundation.ts';
import { defaultFinishForPrinting } from '../mobile/services/exact-printing-recognition.ts';
import { reviewCollectionLocationImportRow } from '../src/lib/collection-location-import.ts';
import { rankCandidate } from '../src/lib/card-intelligence/ranking.ts';
import { addRecognitionToSession, createContinuousScannerSession, createRecognitionPipelineReport, bulkConfirmReviewedCards, buildScannerCollectionConfirmation } from '../mobile/services/continuous-offer-scanner.ts';
const printing = normalizeScannerCandidate({ id: 'p', name: 'Card', setCode: 'TST', collectorNumber: '1', identityAuthority: 'provider_confirmed', finishes: ['normal'], language: 'en' })!;
test('missing scanner attributes remain absent; singleton derivation requires catalog authority', () => {
  const missing = normalizeScannerCandidate({ id: 'p', name: 'Card' })!;
  assert.deepEqual(missing.finishes, []); assert.equal(missing.language, null);
  assert.equal(defaultFinishForPrinting(printing).evidence, 'DERIVED_FROM_AUTHORITATIVE_CATALOG');
  assert.equal(defaultFinishForPrinting({ ...printing, finishes: ['normal', 'foil'] }).finish, 'unknown');
  assert.equal(defaultFinishForPrinting({ ...printing, identityAuthority: 'synthetic_fallback' }).finish, 'unknown');
  assert.equal(defaultFinishForPrinting(printing, 'foil').finish, 'unknown');
});
test('unknown physical attributes cannot become a scanner save through bulk confirmation', () => {
  const recognition = createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [printing], confidence: { overall: 99, threshold: 80, requiresConfirmation: false, conflicts: [], signals: [] }, recognitionMethod: 'manual_search' });
  let session = addRecognitionToSession(createContinuousScannerSession({ id: 's', userId: 'owner', name: 'Review', mode: 'collection_intake', autoConfirm: 'auto_confirm_high_confidence' }), { stableScanId: 'scan', candidate: printing, recognition });
  assert.equal(session.lines[0].condition, 'unknown'); assert.equal(session.lines[0].reviewStatus, 'needs_review');
  session = bulkConfirmReviewedCards(session);
  assert.equal(buildScannerCollectionConfirmation(session.lines[0], 'owner'), null);
  const c = { userId: 'owner', candidate: printing, quantity: 1, condition: 'near_mint' as const, finish: 'normal' as const, language: null, storageLocationId: null, tradeStatus: 'not_for_trade' as const, addToWishlist: false };
  assert.equal(validateScannerConfirmation(c, { membershipTier: 'collector', currentTotalQuantity: 0 }).ok, false);
});
test('import omission cases require review instead of name-only financial identity', () => {
  const row = { name: 'Card', set: 'TST', collectorNumber: '1', condition: 'NM', finish: 'nonfoil', language: 'en', quantity: 1 };
  assert.equal(reviewCollectionLocationImportRow(row).ok, true);
  for (const key of ['set', 'collectorNumber', 'condition', 'finish', 'language'] as const) assert.equal(reviewCollectionLocationImportRow({ ...row, [key]: '' }).ok, false, key);
  assert.equal(reviewCollectionLocationImportRow({ name: 'Card', quantity: 1 }).ok, false);
});
test('a matching provider ID never overrides conflicting identity evidence', () => {
  const candidate = { printingId: 'p', gameId: 'magic', productType: 'card', name: 'Card', setCode: 'TST', setName: 'Test', collectorNumber: '1', finishes: ['normal'], language: 'en', providerIds: { scryfall: 'sf', tcgplayer: 123 }, identityAuthority: 'provider_confirmed' } as Parameters<typeof rankCandidate>[1];
  for (const signals of [
    { cardName: 'Card', providerIds: { scryfall: 'sf', tcgplayer: 999 } },
    { cardName: 'Card', providerIds: { scryfall: 'sf' }, collectorNumber: '2' },
    { cardName: 'Card', providerIds: { scryfall: 'sf' }, setCode: 'OTHER' },
    { cardName: 'Card' },
  ]) assert.equal(rankCandidate(signals, candidate).requiresConfirmation, true);
});

test('ambiguous import identities remain review-required at the shared resolution boundary', () => {
  const known = { exactPrinting: true, candidateCount: 1, condition: 'NM', finish: 'nonfoil', language: 'en' };
  for (const ambiguity of [{ exactPrinting: false }, { candidateCount: 2 }, { finish: null }, { condition: null }, { language: null }, { conflicts: ['collector number conflict'] }, { conflicts: ['set ambiguity'] }, { variantAmbiguous: true }]) {
    const result = physicalResolution({ ...known, ...ambiguity });
    assert.equal(result.canFinalize, false); assert.equal(result.state, 'REVIEW_REQUIRED');
  }
  assert.equal(physicalResolution(known).canFinalize, true);
});
