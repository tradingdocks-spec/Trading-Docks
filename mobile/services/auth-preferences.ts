import { Platform } from 'react-native';
import { appStorage } from '@/services/storage/app-storage';
import {
  AUTH_PREFERENCE_KEYS,
  saveLoginOptionsToStorage,
  shouldDiscardRestoredSessionFromStorage,
} from '@/services/auth-preferences-core';

function browserSessionStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.sessionStorage
    : null;
}

export const authPreferences = {
  async load() {
    const [email, rememberEmail, keepSignedIn, biometricEnabled] = await Promise.all([
      appStorage.getItem(AUTH_PREFERENCE_KEYS.email),
      appStorage.getItem(AUTH_PREFERENCE_KEYS.rememberEmail),
      appStorage.getItem(AUTH_PREFERENCE_KEYS.keepSignedIn),
      appStorage.getItem(AUTH_PREFERENCE_KEYS.biometricEnabled),
    ]);
    return {
      email: email ?? '',
      rememberEmail: rememberEmail === 'true',
      keepSignedIn: keepSignedIn !== 'false',
      biometricEnabled: biometricEnabled === 'true',
    };
  },

  async saveLoginOptions(email: string, rememberEmail: boolean, keepSignedIn: boolean) {
    await saveLoginOptionsToStorage(
      appStorage,
      email,
      rememberEmail,
      keepSignedIn,
      browserSessionStorage(),
    );
  },

  async shouldDiscardRestoredSession() {
    return shouldDiscardRestoredSessionFromStorage(appStorage, browserSessionStorage());
  },

  async setBiometricEnabled(value: boolean) {
    await appStorage.setItem(AUTH_PREFERENCE_KEYS.biometricEnabled, String(value));
  },
};
