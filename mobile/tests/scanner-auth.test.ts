import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveScannerAccessToken } from '../services/scanner-auth.ts';

test('scanner access token refreshes an expiring session when needed', async () => {
  let refreshCalls = 0;
  const result = await resolveScannerAccessToken({
    client: {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'expired-token', expires_at: Math.floor(Date.now() / 1000) - 1 } },
        }),
        refreshSession: async () => {
          refreshCalls += 1;
          return {
            data: { session: { access_token: 'refreshed-token', expires_at: Math.floor(Date.now() / 1000) + 3600 } },
          };
        },
      },
    },
  });

  assert.equal(refreshCalls, 1);
  assert.equal(result.refreshAttempted, true);
  assert.equal(result.refreshSucceeded, true);
  assert.equal(result.sessionPresent, true);
  assert.equal(result.accessTokenPresent, true);
  assert.equal(result.accessToken, 'refreshed-token');
});

test('scanner access token reports missing session cleanly', async () => {
  let refreshCalls = 0;
  const result = await resolveScannerAccessToken({
    client: {
      auth: {
        getSession: async () => ({ data: { session: null } }),
        refreshSession: async () => {
          refreshCalls += 1;
          return { data: { session: null } };
        },
      },
    },
  });

  assert.equal(refreshCalls, 1);
  assert.equal(result.refreshAttempted, true);
  assert.equal(result.refreshSucceeded, false);
  assert.equal(result.sessionPresent, false);
  assert.equal(result.accessTokenPresent, false);
  assert.equal(result.accessToken, null);
});
