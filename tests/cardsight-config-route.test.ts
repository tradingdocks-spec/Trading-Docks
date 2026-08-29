import assert from 'node:assert/strict';
import test from 'node:test';

import { readCardSightConfigProbe, logCardSightConfig } from '../src/lib/card-intelligence/cardsight-provider.ts';

test('scanner cardsight config probe returns sanitized development config', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    CARDSIGHT_API_KEY: process.env.CARDSIGHT_API_KEY,
    CARDSIGHT_BASE_URL: process.env.CARDSIGHT_BASE_URL,
  };
  const originalInfo = console.info;
  const events: unknown[] = [];
  console.info = (...args: unknown[]) => {
    events.push(args);
  };

  try {
    process.env.NODE_ENV = 'development';
    process.env.CARDSIGHT_API_KEY = 'probe-key';
    process.env.CARDSIGHT_BASE_URL = 'https://api.cardsight.ai/';

    const body = readCardSightConfigProbe();
    assert.equal(body.cardsightConfigured, true);
    assert.equal(body.cardsightBaseUrl, 'https://api.cardsight.ai');
    assert.equal(body.keyPresent, true);

    logCardSightConfig('/api/scanner/cardsight/config', process.env);

    const flattened = JSON.stringify(events);
    assert.match(flattened, /TD_CARDSIGHT_CONFIG/);
    assert.match(flattened, /api\.cardsight\.ai/);
    assert.doesNotMatch(flattened, /probe-key/);
  } finally {
    console.info = originalInfo;
    if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv.NODE_ENV;
    if (originalEnv.CARDSIGHT_API_KEY === undefined) delete process.env.CARDSIGHT_API_KEY;
    else process.env.CARDSIGHT_API_KEY = originalEnv.CARDSIGHT_API_KEY;
    if (originalEnv.CARDSIGHT_BASE_URL === undefined) delete process.env.CARDSIGHT_BASE_URL;
    else process.env.CARDSIGHT_BASE_URL = originalEnv.CARDSIGHT_BASE_URL;
  }
});
