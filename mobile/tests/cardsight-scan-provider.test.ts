import assert from 'node:assert/strict';
import test from 'node:test';

import { isCardSightScannerEnabled, scanCardSightWithFallback } from '../services/cardsight-scan-provider.ts';
import { ensureRuntimeGlobals } from '../polyfills/runtime-globals.ts';

const mapping = {
  cardCropPixels: { x: 12, y: 18, width: 280, height: 392 },
} as const;

test('CardSight feature flag is explicitly gated in development', () => {
  assert.equal(isCardSightScannerEnabled({ EXPO_PUBLIC_SCANNER_PROVIDER_CARDSIGHT_ENABLED: 'true' }), true);
  assert.equal(isCardSightScannerEnabled({ EXPO_PUBLIC_SCANNER_PROVIDER_CARDSIGHT_ENABLED: 'false' }), false);
  assert.equal(isCardSightScannerEnabled({}), false);
});

test('CardSight raw capture wins when the raw response is strong', async () => {
  const fetchModes: string[] = [];
  const result = await scanCardSightWithFallback({
    imageUri: 'file:///tmp/private-card.jpg',
    mapping: mapping as never,
    online: true,
    getAccessToken: async () => 'test-access-token',
    prepareCardSightScanImage: async (input) => ({
      image: input.mode === 'raw' ? 'raw-image' : 'cropped-image',
      width: input.mode === 'raw' ? 1440 : 960,
      height: input.mode === 'raw' ? 1920 : 1280,
      bytes: 512,
      mimeType: 'image/jpeg',
    }),
    fetcher: (async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { mode?: 'raw' | 'cropped' };
      fetchModes.push(body.mode ?? 'unknown');
      if (body.mode === 'raw') {
        return new Response(JSON.stringify({
          status: 'candidates',
          mode: 'raw',
          candidates: [{
            canonicalCardId: 'oracle-raff',
            printingId: 'raff-printing',
            name: 'Raff Security Officer',
            setCode: 'MSH',
            collectorNumber: '0033',
            language: 'en',
            finish: 'normal',
            confidence: 0.98,
            providerIds: { scryfall: 'raff-printing' },
          }],
          topCandidate: {
            canonicalCardId: 'oracle-raff',
            printingId: 'raff-printing',
            name: 'Raff Security Officer',
            setCode: 'MSH',
            collectorNumber: '0033',
            language: 'en',
            finish: 'normal',
            confidence: 0.98,
            providerIds: { scryfall: 'raff-printing' },
          },
          intelligence: {
            selectedPrintingId: 'raff-printing',
            requiresConfirmation: false,
          },
          fallbackRecommended: false,
          latencyMs: 28,
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        status: 'candidates',
        mode: 'cropped',
        candidates: [{
          canonicalCardId: 'oracle-other',
          printingId: 'other-printing',
          name: 'Other Card',
          confidence: 0.41,
        }],
        topCandidate: {
          canonicalCardId: 'oracle-other',
          printingId: 'other-printing',
          name: 'Other Card',
          confidence: 0.41,
        },
        intelligence: {
          selectedPrintingId: null,
          requiresConfirmation: true,
        },
        fallbackRecommended: true,
        latencyMs: 51,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.mode, 'raw');
  assert.equal(result.candidates[0]?.name, 'Raff Security Officer');
  assert.equal(result.fallbackRecommended, false);
  assert.deepEqual(fetchModes, ['raw']);
});

test('CardSight cropped capture wins when the raw response is weak', async () => {
  const fetchModes: string[] = [];
  const result = await scanCardSightWithFallback({
    imageUri: 'file:///tmp/private-card.jpg',
    mapping: mapping as never,
    online: true,
    getAccessToken: async () => 'test-access-token',
    prepareCardSightScanImage: async (input) => ({
      image: input.mode === 'raw' ? 'raw-image' : 'cropped-image',
      width: input.mode === 'raw' ? 1440 : 960,
      height: input.mode === 'raw' ? 1920 : 1280,
      bytes: 512,
      mimeType: 'image/jpeg',
    }),
    fetcher: (async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { mode?: 'raw' | 'cropped' };
      fetchModes.push(body.mode ?? 'unknown');
      if (body.mode === 'raw') {
        return new Response(JSON.stringify({
          status: 'candidates',
          mode: 'raw',
          candidates: [{
            canonicalCardId: 'oracle-weak',
            printingId: 'weak-printing',
            name: 'Unclear Card',
            confidence: 0.44,
          }],
          topCandidate: {
            canonicalCardId: 'oracle-weak',
            printingId: 'weak-printing',
            name: 'Unclear Card',
            confidence: 0.44,
          },
          intelligence: {
            selectedPrintingId: null,
            requiresConfirmation: true,
          },
          fallbackRecommended: true,
          latencyMs: 35,
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        status: 'candidates',
        mode: 'cropped',
        candidates: [{
          canonicalCardId: 'oracle-goblin',
          printingId: 'goblin-printing',
          name: 'Goblin Electromancer',
          setCode: 'DDS',
          collectorNumber: '022/065',
          language: 'en',
          finish: 'normal',
          confidence: 0.97,
          providerIds: { scryfall: 'goblin-printing' },
        }],
        topCandidate: {
          canonicalCardId: 'oracle-goblin',
          printingId: 'goblin-printing',
          name: 'Goblin Electromancer',
          setCode: 'DDS',
          collectorNumber: '022/065',
          language: 'en',
          finish: 'normal',
          confidence: 0.97,
          providerIds: { scryfall: 'goblin-printing' },
        },
        intelligence: {
          selectedPrintingId: 'goblin-printing',
          requiresConfirmation: false,
        },
        fallbackRecommended: false,
        latencyMs: 39,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.mode, 'cropped');
  assert.equal(result.candidates[0]?.name, 'Goblin Electromancer');
  assert.equal(result.candidates[0]?.setCode, 'DDS');
  assert.deepEqual(fetchModes, ['raw', 'cropped']);
});

test('CardSight prebuilt handoff accepts a canonical candidate even when exact printing remains unresolved', async () => {
  const result = await scanCardSightWithFallback({
    imageUri: 'file:///tmp/private-card.jpg',
    mapping: mapping as never,
    online: true,
    allowUnconfirmedCandidate: true,
    getAccessToken: async () => 'test-access-token',
    prepareCardSightScanImage: async () => ({
      image: 'raw-image',
      width: 1440,
      height: 1920,
      bytes: 512,
      mimeType: 'image/jpeg',
    }),
    fetcher: (async () => new Response(JSON.stringify({
      status: 'candidates',
      mode: 'raw',
      candidates: [{
        canonicalCardId: 'oracle-raff',
        printingId: 'raff-printing',
        name: 'Raff Security Officer',
        setCode: 'MSH',
        collectorNumber: '0033',
        language: 'en',
        finish: 'normal',
        confidence: 0.81,
        providerIds: { scryfall: 'raff-printing' },
      }],
      topCandidate: {
        canonicalCardId: 'oracle-raff',
        printingId: 'raff-printing',
        name: 'Raff Security Officer',
        setCode: 'MSH',
        collectorNumber: '0033',
        language: 'en',
        finish: 'normal',
        confidence: 0.81,
        providerIds: { scryfall: 'raff-printing' },
      },
      intelligence: {
        selectedPrintingId: null,
        requiresConfirmation: true,
      },
      fallbackRecommended: true,
      latencyMs: 47,
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.fallbackRecommended, true);
  assert.equal(result.candidates[0]?.name, 'Raff Security Officer');
  assert.equal(result.candidates[0]?.setCode, 'MSH');
});

test('CardSight reports unavailable when no authentication token is available', async () => {
  const result = await scanCardSightWithFallback({
    imageUri: 'file:///tmp/private-card.jpg',
    mapping: mapping as never,
    online: true,
    getAccessToken: async () => null,
    prepareCardSightScanImage: async () => {
      throw new Error('should not be called without authentication');
    },
    fetcher: (async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.provider, 'cardsight');
  assert.equal(result.traces[0]?.status, 'unavailable');
});

test('CardSight scan timeout handling stays safe when DOMException is missing', async () => {
  const originalDomException = globalThis.DOMException;
  try {
    // Simulate the Hermes runtime that triggered the iPhone crash.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).DOMException = undefined;
    ensureRuntimeGlobals();
    const result = await scanCardSightWithFallback({
      imageUri: 'file:///tmp/private-card.jpg',
      mapping: mapping as never,
      online: true,
      getAccessToken: async () => 'test-access-token',
      prepareCardSightScanImage: async () => ({
        image: 'raw-image',
        width: 1440,
        height: 1920,
        bytes: 512,
        mimeType: 'image/jpeg',
      }),
      fetcher: (async () => {
        throw new Error('forced fetch failure');
      }) as typeof fetch,
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.traces[0]?.status, 'provider_failed');
  } finally {
    Object.defineProperty(globalThis, 'DOMException', {
      value: originalDomException,
      writable: true,
      configurable: true,
    });
  }
});
