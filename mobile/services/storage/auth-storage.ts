import { Platform } from 'react-native';

import { appStorage } from './app-storage';
import { logAuthWarning } from '../auth-diagnostics.ts';

type SecureStoreModule = typeof import('expo-secure-store');

let secureStoreModulePromise: Promise<SecureStoreModule | null> | null = null;

function getSecureStore() {
  if (Platform.OS === 'web') return Promise.resolve<SecureStoreModule | null>(null);
  if (!secureStoreModulePromise) {
    secureStoreModulePromise = import('expo-secure-store')
      .then((module) => module)
      .catch((error) => {
        logAuthWarning('secure_store_module_load_failed', {
          message: error instanceof Error ? error.message : 'Unknown SecureStore module load error',
        });
        return null;
      });
  }
  return secureStoreModulePromise;
}

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    const secureStore = await getSecureStore();
    if (Platform.OS === 'web' || !secureStore) {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    }
    try {
      return await secureStore.getItemAsync(key);
    } catch (error) {
      logAuthWarning('secure_store_read_failed', {
        message: error instanceof Error ? error.message : 'Unknown SecureStore read error',
      });
      return appStorage.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const secureStore = await getSecureStore();
    if (Platform.OS === 'web' || !secureStore) {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
      return;
    }
    try {
      await secureStore.setItemAsync(key, value);
    } catch (error) {
      logAuthWarning('secure_store_write_failed', {
        message: error instanceof Error ? error.message : 'Unknown SecureStore write error',
      });
      await appStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    const secureStore = await getSecureStore();
    if (Platform.OS === 'web' || !secureStore) {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
      return;
    }
    try {
      await secureStore.deleteItemAsync(key);
    } catch (error) {
      logAuthWarning('secure_store_delete_failed', {
        message: error instanceof Error ? error.message : 'Unknown SecureStore delete error',
      });
    }
    await appStorage.removeItem(key);
  },
};
