import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Logo } from '@/components/primitives';
import { TDButton, TDCard, TDErrorState, TDIconButton, TDInput, TDStatusIndicator, TDText } from '@/components/design-system';
import { color, radius, space, type } from '@/design';
import { signInWithEmailPassword, signUpWithEmailPassword } from '@/services/auth-email';
import { signInSocial } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { useAccount } from '@/providers/account';
import { useAuth } from '@/providers/auth';
import { logAuthDiagnostic, logAuthWarning } from '@/services/auth-diagnostics';
import { authPreferences } from '@/services/auth-preferences';
import {
  clearFocusedElementForWeb,
  resolvePostAuthRoute,
  type RoleLookupClient,
} from '@/services/auth-routing';

function CheckRow({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={s.checkRow}>
      <View style={[s.checkbox, checked && s.checkboxOn]}>
        {checked && <Ionicons name="checkmark" size={15} color="#02101C" />}
      </View>
      <TDText variant="small" tone="secondary" style={s.checkLabel}>{label}</TDText>
    </Pressable>
  );
}

function focusSafeRoute(pathname: string) {
  clearFocusedElementForWeb(
    Platform.OS,
    typeof document !== 'undefined'
      ? document as unknown as { activeElement?: { blur?: () => void } | null }
      : undefined,
  );
  router.replace(pathname as never);
}

export default function Auth() {
  const { width } = useWindowDimensions();
  const { accountType } = useAccount();
  const { session, loading: restoringSession } = useAuth();
  const desktop = width >= 900;
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    authPreferences.load().then((preferences) => {
      if (!mounted) return;
      setEmail(preferences.rememberEmail ? preferences.email : '');
      setRememberEmail(preferences.rememberEmail);
      setKeepSignedIn(preferences.keepSignedIn);
      setUseBiometrics(preferences.biometricEnabled);
      setLoadingPrefs(false);
    });
    return () => { mounted = false; };
  }, []);

  const routeAfterLogin = useCallback(async (userId: string | null) => {
    const route = await resolvePostAuthRoute({
      client: supabase as unknown as RoleLookupClient | null,
      userId,
      accountType,
    });
    focusSafeRoute(route);
  }, [accountType]);

  useEffect(() => {
    if (!restoringSession && session?.user.id) {
      void routeAfterLogin(session.user.id);
    }
  }, [restoringSession, routeAfterLogin, session?.user.id]);

  const persistChoices = async () => {
    await authPreferences.saveLoginOptions(email, rememberEmail, keepSignedIn);
    await authPreferences.setBiometricEnabled(Platform.OS !== 'web' && useBiometrics && keepSignedIn);
  };

  const submit = async () => {
    if (busy) return;
    setError(null);
    setNotice(null);

    const client = supabase;
    if (!client) {
      setError(authErrorMessage('configuration'));
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || password.length < 6) {
      setError('Use a valid email and a password with at least 6 characters.');
      return;
    }

    setBusy(true);
    logAuthDiagnostic(signup ? 'email_signup_submitted' : 'email_signin_submitted', {
      rememberEmail,
      keepSignedIn,
      platform: Platform.OS,
    });

    const result = signup
      ? await signUpWithEmailPassword(client, normalizedEmail, password)
      : await signInWithEmailPassword(client, normalizedEmail, password);

    if (result.error) {
      setBusy(false);
      setError(authErrorMessage(result.error.message));
      logAuthWarning(signup ? 'email_signup_failed' : 'email_signin_failed', {
        message: result.error.message,
      });
      return;
    }

    await persistChoices();
    setPassword('');

    if (signup && !result.data.session) {
      setBusy(false);
      setNotice('Confirm your email, then return to sign in.');
      logAuthDiagnostic('email_signup_confirmation_required');
      return;
    }

    const userId = result.data.user?.id ?? result.data.session?.user?.id ?? null;
    await routeAfterLogin(userId);
    setBusy(false);
  };

  const magic = async () => {
    setError(null);
    setNotice(null);
    if (!supabase) {
      setError(authErrorMessage('configuration'));
      return;
    }
    if (!email.trim()) {
      setError('Enter your email and we will send a secure sign-in link.');
      return;
    }
    setBusy(true);
    await authPreferences.saveLoginOptions(email, rememberEmail, true);
    const redirect = Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}/auth`
      : 'tradingdocks://auth/callback';
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirect },
    });
    setBusy(false);
    if (otpError) {
      setError(authErrorMessage(otpError.message));
      logAuthWarning('magic_link_failed', { message: otpError.message });
      return;
    }
    setNotice('Your secure Trading Docks sign-in link is on its way.');
    logAuthDiagnostic('magic_link_sent', { platform: Platform.OS });
  };

  const social = async (provider: 'google' | 'apple') => {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await authPreferences.saveLoginOptions(email, rememberEmail, keepSignedIn);
      const ok = await signInSocial(provider);
      if (!ok) {
        setBusy(false);
        return;
      }
      const { data: { user } } = supabase
        ? await supabase.auth.getUser()
        : { data: { user: null } };
      await routeAfterLogin(user?.id ?? null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Please try again.';
      setError(authErrorMessage(message));
      logAuthWarning('social_signin_failed', { provider, message });
    } finally {
      setBusy(false);
    }
  };

  if (loadingPrefs) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loading}>
          <ActivityIndicator color={color.primaryBright} />
          <TDText variant="caption" tone="muted">Restoring sign-in preferences...</TDText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.page, desktop && s.pageDesktop]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[s.shell, desktop && s.shellDesktop]}>
            <TDIconButton label="Back" iconName="chevron-back" onPress={() => router.back()} />
            <View style={[s.brandSide, desktop && s.brandSideDesktop]}>
              <Logo />
              <View>
                <TDText variant="label" tone="info">{signup ? 'Create account' : 'Welcome back'}</TDText>
                <TDText variant="heading" style={desktop && s.titleDesktop}>{signup ? 'Create your Trading Docks workspace.' : 'Sign in to Trading Docks.'}</TDText>
                <TDText variant="small" tone="secondary" style={s.sub}>{signup ? 'Start free, then choose the workspace that fits your collection or business.' : 'Access your cards, buying sessions, and protected workspace.'}</TDText>
              </View>
              <TDStatusIndicator label="Passwords are never stored on this device" tone="success" />
              <TDStatusIndicator label="One account across mobile and web" tone="info" />
            </View>
            <View style={[s.formSide, desktop && s.formSideDesktop]}>
              <TDCard style={s.panel} variant="elevated">
                <TDText variant="title">{signup ? 'Create your account' : 'Welcome back'}</TDText>
                <TDText variant="small" tone="secondary">{signup ? 'Use Google, Apple, or email to begin.' : 'Choose a secure sign-in method.'}</TDText>
                {error ? <TDErrorState title="We could not sign you in" message={error} accessibilityLabel="Authentication error" /> : null}
                {notice ? <TDText variant="small" tone="success" style={s.notice}>{notice}</TDText> : null}
                <View style={s.socials}>
                  <Pressable onPress={() => social('google')} disabled={busy} style={[s.social, busy && s.disabled]}>
                    <Ionicons name="logo-google" size={20} color={color.text} />
                    <TDText variant="small" style={s.socialText}>Continue with Google</TDText>
                  </Pressable>
                  {Platform.OS === 'ios' && (
                    <Pressable onPress={() => social('apple')} disabled={busy} style={[s.social, s.apple, busy && s.disabled]}>
                      <Ionicons name="logo-apple" size={21} color="#000" />
                      <Text style={[s.socialText, { color: '#000' }]}>Continue with Apple</Text>
                    </Pressable>
                  )}
                </View>
                <View style={s.or}><View style={s.rule} /><TDText variant="caption" tone="muted" style={s.orText}>Or continue with email</TDText><View style={s.rule} /></View>
                <TDInput label="Email address" value={email} onChangeText={setEmail} onSubmitEditing={submit} placeholder="Email address" autoCapitalize="none" autoComplete="email" keyboardType="email-address" returnKeyType="go" disabled={busy} leftIconName="mail-outline" />
                <TDInput
                  accessibilityLabel="Password"
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  disabled={busy}
                  leftIconName="lock-closed-outline"
                  onChangeText={setPassword}
                  onSubmitEditing={submit}
                  placeholder="Password"
                  returnKeyType="go"
                  rightAccessory={(
                    <Pressable accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} accessibilityRole="button" disabled={busy} hitSlop={10} onPress={() => setShowPassword((value) => !value)}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={color.textMuted} />
                    </Pressable>
                  )}
                  secureTextEntry={!showPassword}
                  value={password}
                />
                {!signup && (
                  <View style={s.options}>
                    <CheckRow checked={rememberEmail} label="Remember my email" onPress={() => setRememberEmail((value) => !value)} />
                    <CheckRow checked={keepSignedIn} label="Keep me signed in" onPress={() => setKeepSignedIn((value) => !value)} />
                    {Platform.OS !== 'web' && (
                      <CheckRow checked={useBiometrics} label={Platform.OS === 'ios' ? 'Use Face ID next time' : 'Use biometric unlock next time'} onPress={() => {
                        if (!keepSignedIn) Alert.alert('Keep me signed in required', 'Biometric unlock protects a saved session, so enable Keep me signed in first.');
                        else setUseBiometrics((value) => !value);
                      }} />
                    )}
                  </View>
                )}
                <TDButton label={busy ? (signup ? 'Creating account...' : 'Signing in...') : (signup ? 'Create account' : 'Sign in')} loading={busy} onPress={submit} iconName="arrow-forward" />
                {!signup && <Pressable accessibilityRole="button" onPress={magic} disabled={busy}><TDText variant="small" tone="info" style={[s.magic, busy && s.disabledText]}>Email me a secure sign-in link</TDText></Pressable>}
                <Pressable onPress={() => { setSignup((value) => !value); setError(null); setNotice(null); }} disabled={busy}>
                  <TDText variant="small" tone="secondary" style={s.switch}>{signup ? 'Already have an account? Sign in' : 'New here? Create a Trading Docks account'}</TDText>
                </Pressable>
              </TDCard>
              <View style={s.trust}><Ionicons name="lock-closed-outline" size={15} color={color.success} /><TDText variant="caption" tone="muted" style={s.trustText}>Face ID and biometric unlock protect an existing device session; they do not store credentials.</TDText></View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  page: { flexGrow: 1, padding: space.lg, paddingBottom: space.xxl },
  pageDesktop: { justifyContent: 'center', paddingHorizontal: 48 },
  shell: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: space.lg },
  shellDesktop: { maxWidth: 1160, flexDirection: 'row', alignItems: 'stretch', gap: 40 },
  brandSide: { gap: space.lg },
  brandSideDesktop: { flex: 1, justifyContent: 'center', paddingRight: 24 },
  formSide: { gap: space.md },
  formSideDesktop: { width: 520, justifyContent: 'center' },
  titleDesktop: { fontSize: 40, lineHeight: 45 },
  sub: { marginTop: space.sm, maxWidth: 520 },
  panel: { gap: space.sm, padding: space.lg },
  notice: { color: color.success, backgroundColor: color.success + '12', borderColor: color.success + '55', borderWidth: 1, borderRadius: radius.sm, padding: 12, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  socials: { gap: space.sm },
  social: { height: 56, borderRadius: radius.md, backgroundColor: color.canvasRaised, borderWidth: 1, borderColor: color.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  apple: { backgroundColor: '#fff', borderColor: '#fff' },
  socialText: { color: color.text, fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.56 },
  disabledText: { opacity: 0.5 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  rule: { height: 1, backgroundColor: color.border, flex: 1 },
  orText: { color: color.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  options: { gap: 10, paddingVertical: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  checkbox: { width: 21, height: 21, borderRadius: 7, borderWidth: 1, borderColor: color.border, backgroundColor: color.canvasRaised, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: color.success, borderColor: color.success },
  checkLabel: { flex: 1 },
  magic: { color: color.primaryBright, textAlign: 'center', fontWeight: '800', fontSize: 12, paddingVertical: 6 },
  switch: { color: color.textSecondary, textAlign: 'center', fontWeight: '800', fontSize: 12, paddingVertical: 6 },
  trust: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  trustText: { ...type.caption, color: color.textMuted, flex: 1, lineHeight: 18 },
});

function authErrorMessage(raw: string) {
  const providerMessage = raw.trim();
  const message = providerMessage.toLowerCase();
  if (message.includes('configuration') || message.includes('environment')) {
    return 'Trading Docks is not ready to sign in on this build. Please try again later.';
  }
  const withProviderDetail = (friendly: string) => `${friendly}\nSupabase: ${providerMessage}`;
  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return withProviderDetail('Check your email and password, then try again.');
  }
  if (message.includes('rate') || message.includes('too many')) {
    return withProviderDetail('Too many attempts. Wait a moment, then try again.');
  }
  if (message.includes('network') || message.includes('fetch')) {
    return withProviderDetail('Check your connection, then try again.');
  }
  if (message.includes('email')) {
    return withProviderDetail('Check your email address and try again.');
  }
  return withProviderDetail('Please try again. If the problem continues, contact support.');
}
