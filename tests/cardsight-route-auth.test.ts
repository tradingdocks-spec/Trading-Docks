import assert from 'node:assert/strict';
import test from 'node:test';

import { apiCapabilityDecision } from '../src/lib/platform/api-access.ts';
import { resolvePlatformAccessContext } from '../mobile/services/platform-access.ts';
import { authenticateScannerRequest } from '../src/app/api/scanner/cardsight/auth.ts';

function createRequest(headers: Record<string, string>) {
  return new Request('http://localhost/api/scanner/cardsight', { method: 'POST', headers });
}

test('scanner route bearer auth resolves user and capability before CardSight', async () => {
  const request = createRequest({ authorization: 'Bearer valid-token' });
  const access = resolvePlatformAccessContext({
    authenticated: true,
    membershipOverride: 'store',
  });
  access.entitlements.push('card-scanner');
  const result = await authenticateScannerRequest(request, {
    createSupabaseClient: () => ({
      auth: {
        getUser: async (jwt?: string) => {
          assert.equal(jwt, 'valid-token');
          return { data: { user: { id: 'user-1', email: 'user@example.com' } }, error: null };
        },
      },
    }) as never,
    createClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    }) as never,
    resolvePlatformAccessForUser: async () => access,
  });

  assert.equal(result.actor?.userId, 'user-1');
  assert.equal(result.capability.allowed, true);
  assert.equal(result.trace.authorizationHeaderPresent, true);
  assert.equal(result.trace.authorizationHeaderScheme, 'Bearer');
  assert.equal(result.trace.bearerTokenLength, 'valid-token'.length);
  assert.equal(result.trace.getUserAttempted, true);
  assert.equal(result.trace.getUserSucceeded, true);
  assert.equal(result.trace.resolvedUserIdPresent, true);
  assert.equal(result.trace.resolvedUserEmailPresent, true);
  assert.equal(result.trace.capabilityCheckAttempted, true);
  assert.equal(result.trace.capabilityCheckSucceeded, true);
  assert.equal(result.trace.finalAuthStatus, 'authenticated');
  assert.equal(apiCapabilityDecision(result.actor!.access, 'scanner.use').allowed, true);
});

test('scanner route invalid bearer remains unauthorized', async () => {
  const request = createRequest({ authorization: 'Bearer invalid-token' });
  const result = await authenticateScannerRequest(request, {
    createSupabaseClient: () => ({
      auth: {
        getUser: async (jwt?: string) => {
          assert.equal(jwt, 'invalid-token');
          return { data: { user: null }, error: new Error('invalid token') };
        },
      },
    }) as never,
    createClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: 'cookie-user' } }, error: null }),
      },
    }) as never,
    resolvePlatformAccessForUser: async () => resolvePlatformAccessContext({ authenticated: false }),
  });

  assert.equal(result.actor, null);
  assert.equal(result.capability.allowed, false);
  assert.equal(result.capability.status, 401);
  assert.equal(result.trace.authorizationHeaderPresent, true);
  assert.equal(result.trace.authorizationHeaderScheme, 'Bearer');
  assert.equal(result.trace.getUserAttempted, true);
  assert.equal(result.trace.getUserSucceeded, false);
  assert.equal(result.trace.finalAuthStatus, 'unauthorized');
});

test('scanner route cookie auth still works when bearer auth is absent', async () => {
  const request = createRequest({});
  const access = resolvePlatformAccessContext({
    authenticated: true,
    membershipOverride: 'store',
  });
  access.entitlements.push('card-scanner');
  const result = await authenticateScannerRequest(request, {
    createClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: 'cookie-user', email: 'cookie@example.com' } }, error: null }),
      },
    }) as never,
    resolvePlatformAccessForUser: async () => access,
  });

  assert.equal(result.actor?.userId, 'cookie-user');
  assert.equal(result.capability.allowed, true);
  assert.equal(result.trace.authorizationHeaderPresent, false);
  assert.equal(result.trace.authorizationHeaderScheme, null);
  assert.equal(result.trace.getUserAttempted, true);
  assert.equal(result.trace.getUserSucceeded, true);
  assert.equal(result.trace.authenticatedUserResolved, true);
});

test('scanner route bearer auth does not fall back to cookies when bearer is invalid', async () => {
  const request = createRequest({ authorization: 'Bearer invalid-token' });
  const result = await authenticateScannerRequest(request, {
    createSupabaseClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: null }, error: new Error('invalid token') }),
      },
    }) as never,
    createClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: 'cookie-user' } }, error: null }),
      },
    }) as never,
    resolvePlatformAccessForUser: async () => resolvePlatformAccessContext({ authenticated: false }),
  });

  assert.equal(result.actor, null);
  assert.equal(result.trace.finalAuthStatus, 'unauthorized');
  assert.equal(result.trace.getUserAttempted, true);
  assert.equal(result.trace.getUserSucceeded, false);
});
