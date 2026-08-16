"use server";

import { hasCapability } from "@/lib/platform/client-access";
import { resolveCurrentPlatformAccess } from "@/lib/platform/server-access";

type AdminMfaFactor = {
  id: string;
  friendly_name?: string;
  status: string;
};

type AdminMfaResult<T> =
  | ({ ok: true } & T)
  | { ok: false; status: 400 | 401 | 403 | 500; error: string };

function adminMfaError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";

  if (/valid bearer token/i.test(message)) {
    return "Your secure admin session could not be verified. Refresh the page and sign in again.";
  }

  return message || fallback;
}

async function requireAdminMfaSession(): Promise<AdminMfaResult<Awaited<ReturnType<typeof resolveCurrentPlatformAccess>>>> {
  const context = await resolveCurrentPlatformAccess();

  if (!context.user) {
    return {
      ok: false,
      status: 401,
      error: "Sign in before managing admin authenticator settings.",
    };
  }

  if (!hasCapability(context.access, "platform.admin")) {
    return {
      ok: false,
      status: 403,
      error: "Admin authenticator settings require platform administrator access.",
    };
  }

  return { ok: true, ...context };
}

export async function loadAdminMfaSecurityState(): Promise<AdminMfaResult<{
  verified: boolean;
  factors: AdminMfaFactor[];
}>> {
  const context = await requireAdminMfaSession();
  if (!context.ok) return context;

  try {
    const [{ data: aal, error: aalError }, { data: factorData, error: factorError }] = await Promise.all([
      context.supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      context.supabase.auth.mfa.listFactors(),
    ]);

    if (aalError) throw aalError;
    if (factorError) throw factorError;

    return {
      ok: true,
      verified: aal?.currentLevel === "aal2",
      factors: (factorData?.totp ?? []) as AdminMfaFactor[],
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: adminMfaError(error, "Could not load admin authenticator state."),
    };
  }
}

export async function beginAdminTotpEnrollment(): Promise<AdminMfaResult<{
  enrollment: { id: string; qr: string; secret: string };
}>> {
  const context = await requireAdminMfaSession();
  if (!context.ok) return context;

  try {
    const { data, error } = await context.supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Trading Docks Admin",
    });

    if (error) throw error;
    if (!data?.totp) {
      throw new Error("Supabase did not return authenticator enrollment details.");
    }

    return {
      ok: true,
      enrollment: {
        id: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: adminMfaError(error, "Could not start authenticator setup."),
    };
  }
}

export async function verifyAdminTotpFactor(factorId: string, code: string): Promise<AdminMfaResult<{
  verified: boolean;
  factors: AdminMfaFactor[];
}>> {
  const context = await requireAdminMfaSession();
  if (!context.ok) return context;

  if (!factorId || !/^\d{6}$/.test(code)) {
    return {
      ok: false,
      status: 400,
      error: "Enter the current 6-digit code from your authenticator app.",
    };
  }

  try {
    const { error } = await context.supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (error) throw error;

    return loadAdminMfaSecurityState();
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: adminMfaError(error, "Could not verify authenticator code."),
    };
  }
}
