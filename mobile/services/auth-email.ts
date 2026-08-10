import { logAuthDiagnostic, logAuthWarning } from './auth-diagnostics.ts';

type AuthResult = {
  data: {
    user?: { id?: string } | null;
    session?: { user?: { id?: string } } | null;
  };
  error?: { message: string } | null;
};

export type EmailAuthClient = {
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<AuthResult>;
    signUp: (credentials: { email: string; password: string }) => Promise<AuthResult>;
  };
};

export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function signInWithEmailPassword(
  client: EmailAuthClient,
  email: string,
  password: string,
) {
  const normalizedEmail = normalizeAuthEmail(email);
  logAuthDiagnostic('email_signin_started');
  const result = await client.auth.signInWithPassword({ email: normalizedEmail, password });
  if (result.error) {
    logAuthWarning('email_signin_failed', { message: result.error.message });
  }
  return result;
}

export async function signUpWithEmailPassword(
  client: EmailAuthClient,
  email: string,
  password: string,
) {
  const normalizedEmail = normalizeAuthEmail(email);
  logAuthDiagnostic('email_signup_started');
  const result = await client.auth.signUp({ email: normalizedEmail, password });
  if (result.error) {
    logAuthWarning('email_signup_failed', { message: result.error.message });
  }
  return result;
}
