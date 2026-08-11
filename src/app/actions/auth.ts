"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import {
  isRevenueCatWebBillingCycle,
  isRevenueCatWebPurchasePlan,
} from "@/lib/revenuecat/web-billing";
import {
  persistentAuthCookieOptions,
  REMEMBER_ME_COOKIE,
} from "@/lib/supabase/auth-cookie-policy";

function getString(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

function withSignInEntrance(path: string) {
  const [pathnameAndQuery, hash = ""] = path.split("#", 2);
  const separator = pathnameAndQuery.includes("?") ? "&" : "?";
  return `${pathnameAndQuery}${separator}td_enter=1${hash ? `#${hash}` : ""}`;
}

async function getRequestOrigin() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");

  if (host) {
    const protocol =
      forwardedProtocol ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function loginWithGoogle(formData: FormData) {
  const next = getString(formData, "next");
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const origin = await getRequestOrigin();
  const cookieStore = await cookies();

  // OAuth is intentionally persistent. A user choosing a one-click identity
  // provider expects the session to survive a normal browser restart.
  cookieStore.set(REMEMBER_ME_COOKIE, "true", {
    ...persistentAuthCookieOptions({}, true),
    httpOnly: true,
  });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    redirectWithError(
      "/sign-in",
      error?.message ?? "Google sign-in could not be started. Please try again.",
    );
  }

  redirect(data.url);
}

export async function login(formData: FormData) {
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const rememberMe = formData.get("rememberMe") === "on";

  if (!email || !password) {
    redirectWithError(
      "/sign-in",
      "Please enter your email address and password.",
    );
  }

  const loginCookies = await cookies();
  loginCookies.set(
    REMEMBER_ME_COOKIE,
    rememberMe ? "true" : "false",
    {
      ...persistentAuthCookieOptions({}, rememberMe),
      // This cookie contains only a boolean preference, never credentials or
      // tokens. The browser client must be able to read it so later Supabase
      // token rotations keep the same persistent/session-only lifetime.
      httpOnly: false,
    },
  );
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectWithError("/sign-in", error.message);
  }

  // Force a server-side session read before redirecting. This makes sure the
  // freshly issued (and potentially chunked) Supabase cookies are committed in
  // the same response as the Remember Me preference.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    redirectWithError(
      "/sign-in",
      "Your credentials were accepted, but the browser session could not be saved. Please try again.",
    );
  }

  const next = getString(formData, "next");
  const safeNext = next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/dashboard";

  redirect(withSignInEntrance(safeNext));
}

export async function signUp(formData: FormData) {
  const name = getString(formData, "name");
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const confirmPassword = getString(formData, "confirmPassword");
  const termsAccepted = formData.get("terms") === "on";
  const requestedPlanValue = getString(formData, "plan");
  const requestedBillingValue = getString(formData, "billing");
  const requestedPlan = isRevenueCatWebPurchasePlan(requestedPlanValue)
    ? requestedPlanValue
    : null;
  const requestedBilling = isRevenueCatWebBillingCycle(requestedBillingValue)
    ? requestedBillingValue
    : null;
  const selectionQuery =
    requestedPlan && requestedBilling
      ? `?plan=${requestedPlan}&billing=${requestedBilling}`
      : "";
  const signUpPath = `/sign-up${selectionQuery}`;
  const onboardingPath = `/onboarding${selectionQuery}`;

  if (!name || !email || !password || !confirmPassword) {
    redirectWithError(
      signUpPath,
      "Please complete all required fields.",
    );
  }

  if (!termsAccepted) {
    redirectWithError(
      signUpPath,
      "You must agree to the Terms of Service and Privacy Policy.",
    );
  }

  if (password.length < 8) {
    redirectWithError(
      signUpPath,
      "Your password must contain at least 8 characters.",
    );
  }

  if (password !== confirmPassword) {
    redirectWithError(
      signUpPath,
      "The passwords you entered do not match.",
    );
  }

  const signupCookies = await cookies();
  signupCookies.set(REMEMBER_ME_COOKIE, "true", {
    ...persistentAuthCookieOptions({}, true),
    httpOnly: true,
  });
  const supabase = await createClient();
  const origin = await getRequestOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(onboardingPath)}`,
      data: {
        full_name: name,
        requested_plan: requestedPlan,
        requested_billing_cycle: requestedBilling,
      },
    },
  });

  if (error) {
    redirectWithError(signUpPath, error.message);
  }

  if (data.session) {
    redirect(onboardingPath);
  }

  redirect(
    `${signUpPath}${selectionQuery ? "&" : "?"}success=${encodeURIComponent(
      "Your account was created. Check your email to confirm your account before signing in.",
    )}`,
  );
}

export async function requestPasswordReset(formData: FormData) {
  const email = getString(formData, "email");

  if (!email) {
    redirectWithError("/forgot-password", "Please enter your email address.");
  }

  const origin = await getRequestOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  if (error) {
    redirectWithError("/forgot-password", error.message);
  }

  redirect(
    `/forgot-password?success=${encodeURIComponent(
      "If an account exists for that email, a password reset link has been sent.",
    )}`,
  );
}

export async function updatePassword(formData: FormData) {
  const password = getString(formData, "password");
  const confirmPassword = getString(formData, "confirmPassword");

  if (password.length < 8) {
    redirectWithError(
      "/update-password",
      "Your password must contain at least 8 characters.",
    );
  }

  if (password !== confirmPassword) {
    redirectWithError(
      "/update-password",
      "The passwords you entered do not match.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirectWithError("/update-password", error.message);
  }

  redirect(
    `/sign-in?success=${encodeURIComponent(
      "Your password has been updated. You can now sign in.",
    )}`,
  );
}

export async function logout() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(REMEMBER_ME_COOKIE);

  redirect("/sign-in");
}
