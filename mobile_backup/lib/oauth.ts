import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export async function signInSocial(provider: 'google' | 'apple') {
  if (!supabase) throw new Error('Supabase is not configured.');
  const redirectTo = Linking.createURL('/auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No authorization URL was returned.');
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;
  const parsed = Linking.parse(result.url);
  const query = parsed.queryParams ?? {};
  const accessToken = typeof query.access_token === 'string' ? query.access_token : undefined;
  const refreshToken = typeof query.refresh_token === 'string' ? query.refresh_token : undefined;
  const code = typeof query.code === 'string' ? query.code : undefined;
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return true;
  }
  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (sessionError) throw sessionError;
    return true;
  }
  throw new Error('The provider returned without a usable session. Check the Supabase redirect URL configuration.');
}
