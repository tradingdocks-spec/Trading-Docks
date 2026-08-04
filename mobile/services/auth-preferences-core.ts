export const AUTH_PREFERENCE_KEYS = {
  email: 'td.auth.remembered-email',
  rememberEmail: 'td.auth.remember-email',
  keepSignedIn: 'td.auth.keep-signed-in',
  activeBrowserSession: 'td.auth.browser-session',
  biometricEnabled: 'td.auth.biometric-enabled',
};

export type AuthPreferenceStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type BrowserSessionStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export function normalizeRememberedEmail(email: string, rememberEmail: boolean) {
  return rememberEmail ? email.trim().toLowerCase() : null;
}

export async function saveLoginOptionsToStorage(
  storage: AuthPreferenceStorage,
  email: string,
  rememberEmail: boolean,
  keepSignedIn: boolean,
  browserSession?: BrowserSessionStorage | null,
) {
  const rememberedEmail = normalizeRememberedEmail(email, rememberEmail);

  await Promise.all([
    storage.setItem(AUTH_PREFERENCE_KEYS.rememberEmail, String(rememberEmail)),
    storage.setItem(AUTH_PREFERENCE_KEYS.keepSignedIn, String(keepSignedIn)),
    rememberedEmail
      ? storage.setItem(AUTH_PREFERENCE_KEYS.email, rememberedEmail)
      : storage.removeItem(AUTH_PREFERENCE_KEYS.email),
  ]);

  if (browserSession) {
    if (keepSignedIn) {
      browserSession.removeItem(AUTH_PREFERENCE_KEYS.activeBrowserSession);
    } else {
      browserSession.setItem(AUTH_PREFERENCE_KEYS.activeBrowserSession, 'true');
    }
  }
}

export async function shouldDiscardRestoredSessionFromStorage(
  storage: AuthPreferenceStorage,
  browserSession?: BrowserSessionStorage | null,
) {
  const keepSignedIn = await storage.getItem(AUTH_PREFERENCE_KEYS.keepSignedIn);
  if (keepSignedIn !== 'false') return false;
  if (browserSession) {
    return browserSession.getItem(AUTH_PREFERENCE_KEYS.activeBrowserSession) !== 'true';
  }
  return true;
}
