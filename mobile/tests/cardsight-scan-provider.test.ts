import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { isCardSightScannerEnabled, scanCardSightWithFallback } from '../services/cardsight-scan-provider.ts';
import { ensureRuntimeGlobals } from '../polyfills/runtime-globals.ts';

const root = process.cwd().replace(/\\/g, '/').endsWith('/mobile') ? process.cwd() : join(process.cwd(), 'mobile');
const mapping = {
  cardCropPixels: { x: 12, y: 18, width: 280, height: 392 },
} as const;

test('CardSight feature flag is explicitly gated in development', () => {
  const service = readFileSync(join(root, 'services', 'cardsight-scan-provider.ts'), 'utf8');
  assert.equal(isCardSightScannerEnabled({ EXPO_PUBLIC_SCANNER_PROVIDER_CARDSIGHT_ENABLED: 'true' }), true);
  assert.equal(isCardSightScannerEnabled({ EXPO_PUBLIC_SCANNER_PROVIDER_CARDSIGHT_ENABLED: 'false' }), false);
  assert.equal(isCardSightScannerEnabled({}), false);
  assert.match(service, /TD_CARDSIGHT_REQUEST/);
  assert.match(service, /TD_CARDSIGHT_RESULT/);
  assert.doesNotMatch(service, /AbortSignal\.timeout/);
  assert.doesNotMatch(readFileSync(join(root, 'components', 'scanner', 'automatic-scanner-screen.tsx'), 'utf8'), /AbortSignal\.timeout/);
});

test('CardSight mobile request attaches the current bearer token', async () => {
  let authorizationHeader: string | null = null;
  const result = await scanCardSightWithFallback({
    imageUri: 'file:///tmp/private-card.jpg',
    mapping: mapping as never,
    online: true,
    getAccessToken: async () => 'mobile-access-token',
    prepareCardSightScanImage: async () => ({
      image: 'raw-image',
      width: 1440,
      height: 1920,
      bytes: 512,
      mimeType: 'image/jpeg',
    }),
    fetcher: (async (_url, init) => {
      authorizationHeader = typeof init?.headers === 'object' && init?.headers
        ? new Headers(init.headers as HeadersInit).get('authorization')
        : null;
      return new Response(JSON.stringify({
        status: 'candidates',
        mode: 'raw',
        candidates: [{
          canonicalCardId: 'oracle-raff',
          printingId: 'raff-printing',
          name: 'Raff Security Officer',
          confidence: 0.99,
        }],
        topCandidate: {
          canonicalCardId: 'oracle-raff',
          printingId: 'raff-printing',
          name: 'Raff Security Officer',
          confidence: 0.99,
        },
        intelligence: {
          selectedPrintingId: 'raff-printing',
          requiresConfirmation: false,
        },
        fallbackRecommended: false,
        latencyMs: 9,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });

  assert.equal(result.ok, true);
  assert.equal(authorizationHeader, 'Bearer mobile-access-token');
});

test('CardSight request still works when AbortSignal.timeout is unavailable', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis.AbortSignal, 'timeout');
  try {
    Object.defineProperty(globalThis.AbortSignal, 'timeout', {
      value: undefined,
      writable: true,
      configurable: true,
    });
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
      fetcher: (async () => new Response(JSON.stringify({
        status: 'candidates',
        mode: 'raw',
        candidates: [{
          canonicalCardId: 'oracle-raff',
          printingId: 'raff-printing',
          name: 'Raff Security Officer',
          confidence: 0.99,
        }],
        topCandidate: {
          canonicalCardId: 'oracle-raff',
          printingId: 'raff-printing',
          name: 'Raff Security Officer',
          confidence: 0.99,
        },
        intelligence: {
          selectedPrintingId: 'raff-printing',
          requiresConfirmation: false,
        },
        fallbackRecommended: false,
        latencyMs: 9,
      }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.candidates[0]?.name, 'Raff Security Officer');
    assert.equal(result.traces[0]?.status, 'candidates');
  } finally {
    if (original) {
      Object.defineProperty(globalThis.AbortSignal, 'timeout', original);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis.AbortSignal as any).timeout;
    }
  }
});

test('CardSight request clears its timeout timer after a successful response', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let setTimeoutCount = 0;
  let clearTimeoutCount = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).setTimeout = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
      setTimeoutCount += 1;
      return originalSetTimeout(handler, timeout ?? 0, ...args);
    }) as typeof setTimeout;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).clearTimeout = ((handle: Parameters<typeof clearTimeout>[0]) => {
      clearTimeoutCount += 1;
      return originalClearTimeout(handle);
    }) as typeof clearTimeout;

    const result = await scanCardSightWithFallback({
      imageUri: 'file:///tmp/private-card.jpg',
      mapping: mapping as never,
      online: true,
      timeoutMs: 25,
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
          confidence: 0.99,
        }],
        topCandidate: {
          canonicalCardId: 'oracle-raff',
          printingId: 'raff-printing',
          name: 'Raff Security Officer',
          confidence: 0.99,
        },
        intelligence: {
          selectedPrintingId: 'raff-printing',
          requiresConfirmation: false,
        },
        fallbackRecommended: false,
        latencyMs: 4,
      }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch,
    });

    assert.equal(result.ok, true);
    assert.equal(setTimeoutCount, 1);
    assert.equal(clearTimeoutCount, 1);
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).setTimeout = originalSetTimeout;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).clearTimeout = originalClearTimeout;
  }
});

test('CardSight request times out with a controlled provider timeout result', async () => {
  const result = await scanCardSightWithFallback({
    imageUri: 'file:///tmp/private-card.jpg',
    mapping: mapping as never,
    online: true,
    timeoutMs: 1,
    getAccessToken: async () => 'test-access-token',
    prepareCardSightScanImage: async () => ({
      image: 'raw-image',
      width: 1440,
      height: 1920,
      bytes: 512,
      mimeType: 'image/jpeg',
    }),
    fetcher: (async (_url, init) => {
      await new Promise<void>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal?.aborted) {
          reject(new Error('aborted by signal'));
          return;
        }
        signal?.addEventListener('abort', () => reject(new Error('aborted by signal')), { once: true });
      });
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.traces[0]?.status, 'timeout');
  assert.match(result.reason, /timed out/i);
});

test('CardSight caller abort remains distinguishable from provider timeout', async () => {
  const controller = new AbortController();
  const resultPromise = scanCardSightWithFallback({
    imageUri: 'file:///tmp/private-card.jpg',
    mapping: mapping as never,
    online: true,
    signal: controller.signal,
    timeoutMs: 50,
    getAccessToken: async () => 'test-access-token',
    prepareCardSightScanImage: async () => ({
      image: 'raw-image',
      width: 1440,
      height: 1920,
      bytes: 512,
      mimeType: 'image/jpeg',
    }),
    fetcher: (async (_url, init) => {
      await new Promise<void>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal?.aborted) {
          reject(new Error('aborted by caller'));
          return;
        }
        signal?.addEventListener('abort', () => reject(new Error('aborted by caller')), { once: true });
      });
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });
  controller.abort();
  const result = await resultPromise;

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.traces[0]?.status, 'aborted');
  assert.match(result.reason, /cancelled/i);
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
