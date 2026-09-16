import assert from 'node:assert/strict';
import test from 'node:test';

import { CardSightProvider, cardSightUsageSnapshot, logCardSightConfig, resolveCardSightConfig } from '../src/lib/card-intelligence/cardsight-provider.ts';

test('CardSight provider reports unavailable when credentials are missing', async () => {
  let called = false;
  const provider = new CardSightProvider({
    apiKey: undefined,
    fetch: (async () => {
      called = true;
      throw new Error('should not be called');
    }) as typeof fetch,
  });

  const result = await provider.recognizeImage({ image: 'ZmFrZQ==', game: 'magic', limit: 5, mode: 'raw' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'unavailable');
  assert.equal(called, false);
});

test('CardSight provider sends raw and cropped identify requests and normalizes provider candidates', async () => {
  const requests: Array<{ url: string; requestIsRequest: boolean; contentType: string | null; headers: Headers }> = [];
  const provider = new CardSightProvider({
    apiKey: 'cardsight-secret',
    baseUrl: 'https://cardsight.example.test',
    fetch: (async (url, init) => {
      const requestHeaders = url instanceof Request ? new Headers(url.headers) : new Headers(init?.headers);
      requests.push({
        url: url instanceof Request ? url.url : String(url),
        requestIsRequest: url instanceof Request,
        contentType: url instanceof Request ? url.headers.get('content-type') : requestHeaders.get('content-type'),
        headers: requestHeaders,
      });
      return new Response(JSON.stringify({
        success: true,
        detections: [{
          confidence: 'High',
          providerIds: { scryfall: 'scryfall-raff-0033' },
          identifyId: 'cardsight-uuid-raff',
          card: {
            id: 'raff-msh-0033',
            game: 'magic',
            segmentId: 'magic',
            releaseId: 'release-1',
            setId: 'set-1',
            year: '2024',
            manufacturer: 'Wizards',
            releaseName: 'Murders at Karlov Manor',
            setName: 'Base Set',
            name: 'Raff Security Officer',
            number: '0033',
            fields: [{ key: 'CARD_LANGUAGE', value: 'en' }],
          },
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });

  const raw = await provider.recognizeImage({ image: 'raw-base64', game: 'magic', limit: 5, mode: 'raw' });
  const cropped = await provider.recognizeImage({ image: 'cropped-base64', game: 'magic', limit: 5, mode: 'cropped' });

  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.url, 'https://cardsight.example.test/v1/identify/card');
  assert.equal(requests[0]?.requestIsRequest, true);
  assert.equal(requests[0]?.headers.get('x-api-key'), 'cardsight-secret');
  assert.equal(requests[0]?.headers.get('authorization'), null);
  assert.match(requests[0]?.contentType ?? '', /multipart\/form-data/);
  assert.equal(requests[1]?.headers.get('x-api-key'), 'cardsight-secret');
  assert.match(requests[1]?.contentType ?? '', /multipart\/form-data/);
  assert.doesNotMatch(requests[0]?.url ?? '', /magic/i);

  assert.equal(raw.ok, true);
  if (raw.ok) {
    assert.equal(raw.topCandidate?.name, 'Raff Security Officer');
    assert.equal(raw.topCandidate?.printingId, 'raff-msh-0033');
    assert.equal(raw.topCandidate?.detectedSegment, 'magic');
    assert.equal(raw.topCandidate?.canonicalCardId, null);
    assert.equal(raw.topCandidate?.providerIds.cardsight, 'cardsight-uuid-raff');
    assert.equal(raw.intelligence.candidates[0]?.printingId, 'raff-msh-0033');
    assert.equal(raw.intelligence.requiresConfirmation, true);
  }
  assert.equal(cropped.ok, true);
  if (cropped.ok) {
    assert.equal(cropped.topCandidate?.name, 'Raff Security Officer');
    assert.equal(cropped.topCandidate?.printingId, 'raff-msh-0033');
  }
});

test('CardSight provider can probe catalog segments and logs a sanitized summary', async () => {
  const events: unknown[] = [];
  const originalInfo = console.info;
  console.info = (...args: unknown[]) => {
    events.push(args);
  };
  try {
    const provider = new CardSightProvider({
      apiKey: 'cardsight-secret',
      baseUrl: 'https://cardsight.example.test',
      fetch: (async (url, init) => {
        const requestUrl = url instanceof Request ? url.url : String(url);
        if (requestUrl.endsWith('/v1/catalog/segments')) {
          return new Response(JSON.stringify({
            segments: [
              { id: 'magic', name: 'Magic: The Gathering' },
              { id: 'pokemon', name: 'Pokémon' },
            ],
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        throw new Error(`unexpected request: ${requestUrl}`);
      }) as typeof fetch,
    });

    const summary = await provider.listSegments();
    assert.equal(summary.segmentCount, 2);
    assert.deepEqual(summary.ids, ['magic', 'pokemon']);
    assert.equal(summary.matchedMagicSegmentId, 'magic');
    assert.equal(summary.matchedMagicSegmentName, 'Magic: The Gathering');
  } finally {
    console.info = originalInfo;
  }

  const flattened = JSON.stringify(events);
  assert.match(flattened, /TD_CARDSIGHT_SEGMENTS/);
  assert.doesNotMatch(flattened, /cardsight-secret/);
});

test('CardSight provider rejects malformed payloads and preserves ambiguous candidates conservatively', async () => {
  const provider = new CardSightProvider({
    apiKey: 'cardsight-secret',
    fetch: (async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch,
  });

  const malformed = await provider.recognizeImage({ image: 'x', game: 'magic', limit: 5, mode: 'raw' });
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.status, 'malformed_response');

  const ambiguousProvider = new CardSightProvider({
    apiKey: 'cardsight-secret',
    fetch: (async () => new Response(JSON.stringify({
      cards: [{
        name: 'Goblin Electromancer',
        confidence: 0.41,
        setCode: 'DDS',
        collectorNumber: '022/065',
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch,
  });

  const ambiguous = await ambiguousProvider.recognizeImage({ image: 'x', game: 'magic', limit: 5, mode: 'raw' });
  assert.equal(ambiguous.ok, true);
  if (ambiguous.ok) {
    assert.equal(ambiguous.intelligence.requiresConfirmation, true);
    assert.equal(ambiguous.intelligence.selectedPrintingId, null);
    assert.equal(ambiguous.topCandidate?.name, 'Goblin Electromancer');
  }
});

test('CardSight provider times out cleanly and emits usage snapshots', async () => {
  const provider = new CardSightProvider({
    apiKey: 'cardsight-secret',
    timeoutMs: 1,
    fetch: (async (_url, init) => new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve(new Response(JSON.stringify({ success: true, detections: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
      }, 50);
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('aborted by timeout'));
      }, { once: true });
    })) as typeof fetch,
  });

  const result = await provider.recognizeImage({ image: 'x', game: 'magic', limit: 5, mode: 'raw' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 'timeout');
  const snapshot = cardSightUsageSnapshot({ planName: 'test-plan', includedRequests: 10, requestPriceUsd: 0.25 });
  assert.equal(snapshot.planName, 'test-plan');
  assert.equal(snapshot.includedRequests, 10);
  assert.equal(snapshot.requestPriceUsd, 0.25);
});

test('CardSight provider health check uses the configured SDK client and X-API-Key', async () => {
  const requests: Array<{ url: string; headers: Headers }> = [];
  const provider = new CardSightProvider({
    apiKey: 'cardsight-secret',
    baseUrl: 'https://cardsight.example.test',
    fetch: (async (url, init) => {
      const requestHeaders = url instanceof Request ? new Headers(url.headers) : new Headers(init?.headers);
      requests.push({
        url: url instanceof Request ? url.url : String(url),
        headers: requestHeaders,
      });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });

  const health = await provider.healthCheck();
  assert.equal(health.ok, true);
  if (health.ok) {
    assert.equal(health.authenticated, true);
  }
  assert.equal(requests[0]?.url, 'https://cardsight.example.test/health/auth');
  assert.equal(requests[0]?.headers.get('x-api-key'), 'cardsight-secret');
});

test('CardSight config resolves server-side secrets only from the environment', () => {
  const config = resolveCardSightConfig({
    CARDSIGHT_API_KEY: 'server-only',
    CARDSIGHT_BASE_URL: 'https://api.cardsight.ai/',
    CARDSIGHT_PLAN_NAME: 'pro',
    CARDSIGHT_INCLUDED_REQUESTS: '50',
    CARDSIGHT_REQUEST_PRICE_USD: '0.12',
  });
  assert.equal(config.configured, true);
  assert.equal(config.apiKey, 'server-only');
  assert.equal(config.baseUrl, 'https://api.cardsight.ai');
  assert.equal(config.planName, 'pro');
  assert.equal(config.includedRequests, 50);
  assert.equal(config.requestPriceUsd, 0.12);
  assert.equal(config.apiKeyPresent, true);
});

test('CardSight config logging is sanitized', () => {
  const originalInfo = console.info;
  const events: unknown[] = [];
  console.info = (...args: unknown[]) => {
    events.push(args);
  };
  try {
    logCardSightConfig('/api/scanner/cardsight', {
      NODE_ENV: 'development',
      CARDSIGHT_API_KEY: 'server-only',
      CARDSIGHT_BASE_URL: 'https://api.cardsight.ai/',
    });
  } finally {
    console.info = originalInfo;
  }

  const flattened = JSON.stringify(events);
  assert.match(flattened, /TD_CARDSIGHT_CONFIG/);
  assert.match(flattened, /api\.cardsight\.ai/);
  assert.doesNotMatch(flattened, /server-only/);
});

test('CardSight provider reflects current environment at construction time', () => {
  const original = process.env.CARDSIGHT_API_KEY;
  try {
    process.env.CARDSIGHT_API_KEY = 'constructed-key';
    assert.equal(new CardSightProvider().isConfigured(), true);
    process.env.CARDSIGHT_API_KEY = '';
    assert.equal(new CardSightProvider().isConfigured(), false);
  } finally {
    if (original === undefined) delete process.env.CARDSIGHT_API_KEY;
    else process.env.CARDSIGHT_API_KEY = original;
  }
});
