import assert from 'node:assert/strict';
import test from 'node:test';
import {
  signInWithEmailPassword,
  normalizeAuthEmail,
} from '../services/auth-email.ts';
import {
  AUTH_PREFERENCE_KEYS,
  saveLoginOptionsToStorage,
  shouldDiscardRestoredSessionFromStorage,
} from '../services/auth-preferences-core.ts';
import {
  resolvePostAuthRoute,
  workspaceRouteForAccountType,
} from '../services/auth-routing.ts';
import { resolveRestoredSessionState } from '../services/auth-session-core.ts';
import {
  getMobileTabs,
  getMobileTabOptions,
  isMobileTabSelected,
  resolveProtectedRouteAccess,
} from '../services/navigation-contract.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      values.set(key, value);
    },
    async removeItem(key: string) {
      values.delete(key);
    },
  };
}

function roleClient(result: { role?: string | null; error?: Error | { message: string } | null }) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: result.role ? { role: result.role } : null,
                    error: result.error ?? null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

test('successful sign-in calls Supabase signInWithPassword with normalized email', async () => {
  const calls: { email: string; password: string }[] = [];
  const client = {
    auth: {
      async signInWithPassword(credentials: { email: string; password: string }) {
        calls.push(credentials);
        return { data: { user: { id: 'user-1' }, session: { user: { id: 'user-1' } } }, error: null };
      },
      async signUp() {
        throw new Error('not used');
      },
    },
  };

  const result = await signInWithEmailPassword(client, '  PERSON@Example.COM ', 'correct-password');

  assert.equal(result.error, null);
  assert.deepEqual(calls, [{ email: 'person@example.com', password: 'correct-password' }]);
});

test('invalid credentials return the exact Supabase error message', async () => {
  const client = {
    auth: {
      async signInWithPassword() {
        return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
      },
      async signUp() {
        throw new Error('not used');
      },
    },
  };

  const result = await signInWithEmailPassword(client, 'person@example.com', 'wrong-password');

  assert.equal(result.error?.message, 'Invalid login credentials');
});

test('session restoration keeps a saved web session unlocked after restore completes', () => {
  const session = { user: { id: 'user-1' } } as never;
  const restored = resolveRestoredSessionState({
    session,
    discard: false,
    preferences: { biometricEnabled: true },
    platform: 'web',
  });

  assert.equal(restored.session, session);
  assert.equal(restored.biometricLocked, false);
});

test('session restoration locks native sessions when biometrics are enabled', () => {
  const session = { user: { id: 'user-1' } } as never;
  const restored = resolveRestoredSessionState({
    session,
    discard: false,
    preferences: { biometricEnabled: true },
    platform: 'ios',
  });

  assert.equal(restored.session, session);
  assert.equal(restored.biometricLocked, true);
});

test('owner/admin users keep their workspace route after sign-in', async () => {
  const route = await resolvePostAuthRoute({
    client: roleClient({ role: 'owner' }),
    userId: 'owner-1',
    accountType: 'collector',
  });

  assert.equal(route, '/(tabs)');
});

test('normal users route by account type', async () => {
  assert.equal(workspaceRouteForAccountType('free'), '/(tabs)');
  assert.equal(workspaceRouteForAccountType('collector'), '/(tabs)');
  assert.equal(workspaceRouteForAccountType('seller'), '/(tabs)');
  assert.equal(workspaceRouteForAccountType('store'), '/(tabs)');

  const route = await resolvePostAuthRoute({
    client: roleClient({ role: null }),
    userId: 'user-1',
    accountType: 'seller',
  });

  assert.equal(route, '/(tabs)');
});

test('role lookup failure still routes safely for normal users', async () => {
  const route = await resolvePostAuthRoute({
    client: roleClient({ error: { message: 'relation user_roles does not exist' } }),
    userId: 'user-1',
    accountType: 'collector',
  });

  assert.equal(route, '/(tabs)');
});

test('remembered email is stored only when selected', async () => {
  const storage = memoryStorage();
  await saveLoginOptionsToStorage(storage, '  PERSON@Example.COM ', true, true);

  assert.equal(storage.values.get(AUTH_PREFERENCE_KEYS.email), 'person@example.com');
  assert.equal(storage.values.get(AUTH_PREFERENCE_KEYS.rememberEmail), 'true');

  await saveLoginOptionsToStorage(storage, 'person@example.com', false, true);

  assert.equal(storage.values.has(AUTH_PREFERENCE_KEYS.email), false);
  assert.equal(storage.values.get(AUTH_PREFERENCE_KEYS.rememberEmail), 'false');
});

test('keep me signed in controls restored session discard behavior', async () => {
  const storage = memoryStorage({ [AUTH_PREFERENCE_KEYS.keepSignedIn]: 'false' });
  const sessionStorage = memoryStorage().values;
  const browserSession = {
    getItem: (key: string) => sessionStorage.get(key) ?? null,
    setItem: (key: string, value: string) => { sessionStorage.set(key, value); },
    removeItem: (key: string) => { sessionStorage.delete(key); },
  };

  assert.equal(await shouldDiscardRestoredSessionFromStorage(storage, browserSession), true);

  browserSession.setItem(AUTH_PREFERENCE_KEYS.activeBrowserSession, 'true');

  assert.equal(await shouldDiscardRestoredSessionFromStorage(storage, browserSession), false);
});

test('auth email normalization trims and lowercases without touching passwords', () => {
  assert.equal(normalizeAuthEmail(' USER@Example.COM '), 'user@example.com');
});

test('protected route guard waits for session restoration before redirecting', () => {
  assert.deepEqual(
    resolveProtectedRouteAccess({ authLoading: true, sessionExists: false }),
    { state: 'loading', route: null },
  );
  assert.deepEqual(
    resolveProtectedRouteAccess({ authLoading: false, sessionExists: false }),
    { state: 'redirect', route: '/auth' },
  );
});

test('mobile collector navigation uses canonical release labels and selected state', () => {
  assert.deepEqual(getMobileTabs('collector').map((tab) => tab.label), [
    'Home',
    'Collection',
    'Scan',
    'Decks',
    'Account',
  ]);
  assert.equal(getMobileTabOptions('collector', 'scan').href, undefined);
  assert.equal(isMobileTabSelected('/(tabs)/collection', 'collection'), true);
});

test('mobile seller navigation keeps Scan primary and Deal Desk contextual', () => {
  assert.deepEqual(getMobileTabs('seller').map((tab) => tab.label), [
    'Home',
    'Collection',
    'Scan',
    'Decks',
    'Account',
  ]);
  assert.equal(getMobileTabOptions('seller', 'scan').href, undefined);
  assert.equal(getMobileTabOptions('seller', 'scan').prominent, true);
});

test('mobile store navigation keeps the same five primary destinations', () => {
  assert.deepEqual(getMobileTabs('store').map((tab) => tab.label), [
    'Home',
    'Collection',
    'Scan',
    'Decks',
    'Account',
  ]);
});

test('admin Command Center access is additive and protected', () => {
  assert.deepEqual(
    resolveProtectedRouteAccess({
      authLoading: false,
      sessionExists: true,
      adminLoading: false,
      isAdmin: true,
      requiresAdmin: true,
    }),
    { state: 'allowed', route: null },
  );
  assert.deepEqual(
    resolveProtectedRouteAccess({
      authLoading: false,
      sessionExists: true,
      adminLoading: false,
      isAdmin: false,
      requiresAdmin: true,
    }),
    { state: 'redirect', route: '/(tabs)' },
  );
});

test('missing mobile account type falls back to collector-safe free navigation', () => {
  assert.deepEqual(getMobileTabs(undefined).map((tab) => tab.label), [
    'Home',
    'Collection',
    'Scan',
    'Decks',
    'Account',
  ]);
});
