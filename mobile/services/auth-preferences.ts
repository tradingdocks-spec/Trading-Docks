import { Platform } from 'react-native';
import { appStorage } from '@/services/storage/app-storage';

const KEYS = {
  email: 'td.auth.remembered-email',
  rememberEmail: 'td.auth.remember-email',
  keepSignedIn: 'td.auth.keep-signed-in',
  activeBrowserSession: 'td.auth.browser-session',
  biometricEnabled: 'td.auth.biometric-enabled',
};

export const authPreferences = {
  async load() {
    const [email, rememberEmail, keepSignedIn, biometricEnabled] = await Promise.all([
      appStorage.getItem(KEYS.email),
      appStorage.getItem(KEYS.rememberEmail),
      appStorage.getItem(KEYS.keepSignedIn),
      appStorage.getItem(KEYS.biometricEnabled),
    ]);
    return {
      email: email ?? '',
      rememberEmail: rememberEmail === 'true',
      keepSignedIn: keepSignedIn !== 'false',
      biometricEnabled: biometricEnabled === 'true',
    };
  },

  async saveLoginOptions(email: string, rememberEmail: boolean, keepSignedIn: boolean) {
    await Promise.all([
      appStorage.setItem(KEYS.rememberEmail, String(rememberEmail)),
      appStorage.setItem(KEYS.keepSignedIn, String(keepSignedIn)),
      rememberEmail ? appStorage.setItem(KEYS.email, email.trim().toLowerCase()) : appStorage.removeItem(KEYS.email),
    ]);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (keepSignedIn) window.localStorage.removeItem(KEYS.activeBrowserSession);
      else window.sessionStorage.setItem(KEYS.activeBrowserSession, 'true');
    }
  },

  async shouldDiscardRestoredSession() {
    const keepSignedIn = await appStorage.getItem(KEYS.keepSignedIn);
    if (keepSignedIn !== 'false') return false;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.sessionStorage.getItem(KEYS.activeBrowserSession) !== 'true';
    }
    return true;
  },

  async setBiometricEnabled(value: boolean) {
    await appStorage.setItem(KEYS.biometricEnabled, String(value));
  },
};
