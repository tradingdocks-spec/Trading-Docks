import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { appStorage } from './app-storage';
import { logAuthWarning } from '../auth-diagnostics.ts';

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      logAuthWarning('secure_store_read_failed', {
        message: error instanceof Error ? error.message : 'Unknown SecureStore read error',
      });
      return appStorage.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      logAuthWarning('secure_store_write_failed', {
        message: error instanceof Error ? error.message : 'Unknown SecureStore write error',
      });
      await appStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      logAuthWarning('secure_store_delete_failed', {
        message: error instanceof Error ? error.message : 'Unknown SecureStore delete error',
      });
    }
    await appStorage.removeItem(key);
  },
};
