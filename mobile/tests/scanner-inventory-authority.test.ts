import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ScannerInventoryAuthorityError,
  scannerCandidateProviderIds,
  validateScannerInventoryIdentity,
} from '../services/scanner-inventory-authority.ts';
import { buildScannerAddPayload, normalizeScannerCandidate, type ScannerConfirmation } from '../services/scanner-foundation.ts';

const candidate = normalizeScannerCandidate({
  id: 'tcgtracking:product-42',
  gameId: 'pokemon',
  name: 'Client Guess',
  setCode: 'BAD',
  collectorNumber: '0',
  finishes: ['normal', 'foil'],
  providerSource: 'multiple',
  providerSources: ['tcgtracking', 'tcgplayer'],
  providerIds: { tcgtracking: 'product-42', tcgplayer: 1234 },
  providerProductId: 'product-42',
  tcgplayerProductId: 1234,
  confidence: 0.95,
})!;

const confirmation: ScannerConfirmation = {
  userId: 'user-1', candidate, quantity: 2, condition: 'near_mint', finish: 'foil', language: 'en',
  storageLocationId: 'binder-1', tradeStatus: 'not_for_trade', addToWishlist: false,
};

test('online validation replaces client guesses with canonical multi-provider identity', async () => {
  let requestBody: Record<string, unknown> = {};
  const validated = await validateScannerInventoryIdentity({
    confirmation,
    accessToken: 'user-token',
    fetcher: async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return Response.json({
        valid: true,
        identity: {
          game: 'pokemon', canonicalCardId: 'tcgtracking:card-9', printingId: 'tcgtracking:product-42', finish: 'foil',
          providerIds: { tcgtracking: 'product-42', tcgplayer: 1234 }, name: 'Pikachu', setCode: 'SVP',
          setName: 'Scarlet & Violet Promos', collectorNumber: '088', language: 'en',
          provenance: ['tcgtracking', 'tcgplayer'], identityAuthority: 'provider_confirmed',
        },
      });
    },
  });

  assert.deepEqual(requestBody.providerIds, { tcgtracking: 'product-42', tcgplayer: 1234 });
  assert.equal(requestBody.finish, 'foil');
  assert.equal(validated.quantity, 2);
  assert.equal(validated.candidate.name, 'Pikachu');
  assert.equal(validated.candidate.setCode, 'SVP');
  assert.equal(validated.candidate.oracleId, 'tcgtracking:card-9');
  assert.equal(validated.candidate.identityAuthority, 'provider_confirmed');
  assert.deepEqual(validated.candidate.providerSources, ['tcgtracking', 'tcgplayer']);
  const mutation = buildScannerAddPayload(validated, 'scan-validated');
  assert.equal(mutation.card_name, 'Pikachu');
  assert.equal(mutation.tcgplayer_product_id, 1234);
  assert.equal(mutation.provider_product_id, 'product-42');
  assert.equal(mutation.data.exactPrintingId, 'tcgtracking:product-42');
  assert.equal(mutation.data.identityAuthority, 'provider_confirmed');
});

test('provider IDs preserve multi-provider identity without treating visual provenance as authority', () => {
  const ids = scannerCandidateProviderIds({ ...candidate, providerSources: ['visual_index', 'tcgtracking', 'tcgplayer'] });
  assert.deepEqual(ids, { tcgtracking: 'product-42', tcgplayer: 1234 });
});

test('synthetic, wrong-game, unsupported-finish, and provider-mismatch responses require review', async () => {
  for (const status of [400, 422]) {
    await assert.rejects(
      validateScannerInventoryIdentity({
        confirmation: { ...confirmation, candidate: { ...candidate, id: status === 400 ? 'synthetic:pikachu' : candidate.id } },
        accessToken: 'user-token',
        fetcher: async () => Response.json({ valid: false, error: 'Printing identity could not be authoritatively validated.' }, { status }),
      }),
      (error: unknown) => error instanceof ScannerInventoryAuthorityError && error.scannerCode === 'invalid_printing' && !error.offline,
    );
  }
});

test('backend network outage is explicitly recoverable as offline queue work', async () => {
  await assert.rejects(
    validateScannerInventoryIdentity({ confirmation, accessToken: 'user-token', fetcher: async () => { throw new TypeError('offline'); } }),
    (error: unknown) => error instanceof ScannerInventoryAuthorityError && error.offline,
  );
});

test('backend service failure never returns a client identity for insertion', async () => {
  await assert.rejects(
    validateScannerInventoryIdentity({
      confirmation,
      accessToken: 'user-token',
      fetcher: async () => Response.json({ error: 'provider unavailable' }, { status: 503 }),
    }),
    /temporarily unavailable/i,
  );
});
