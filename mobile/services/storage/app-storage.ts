let asyncStorageModule: typeof import('@react-native-async-storage/async-storage') | null = null;

async function loadAsyncStorage() {
  if (asyncStorageModule) return asyncStorageModule;
  asyncStorageModule = await import('@react-native-async-storage/async-storage');
  return asyncStorageModule;
}

function isWebRuntime() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isReactNativeRuntime() {
  return typeof navigator !== 'undefined' && (navigator as Navigator & { product?: string }).product === 'ReactNative';
}

/**
 * Cross-platform storage adapter that is safe during Expo Router web SSR.
 * Native platforms use AsyncStorage. Web uses localStorage only after the
 * browser window exists; server-rendered reads return null and writes no-op.
 */
export const appStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isWebRuntime()) {
      return window.localStorage.getItem(key);
    }
    if (isReactNativeRuntime()) {
      const { default: AsyncStorage } = await loadAsyncStorage();
      return AsyncStorage.getItem(key);
    }
    return null;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWebRuntime()) {
      window.localStorage.setItem(key, value);
      return;
    }
    if (isReactNativeRuntime()) {
      const { default: AsyncStorage } = await loadAsyncStorage();
      await AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (isWebRuntime()) {
      window.localStorage.removeItem(key);
      return;
    }
    if (isReactNativeRuntime()) {
      const { default: AsyncStorage } = await loadAsyncStorage();
      await AsyncStorage.removeItem(key);
    }
  },
};
