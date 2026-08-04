import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { logAuthWarning } from '@/services/auth-diagnostics';
import { authStorage } from '@/services/storage/auth-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const keyLooksSecret = key?.trim().toLowerCase().startsWith('sb_secret') ?? false;

if (keyLooksSecret) {
  logAuthWarning('supabase_client_secret_rejected', {
    source: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    credentialType: 'sb_secret',
    platform: Platform.OS,
  });
}

export const supabase = url && key && !keyLooksSecret
  ? createClient(url, key, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;
