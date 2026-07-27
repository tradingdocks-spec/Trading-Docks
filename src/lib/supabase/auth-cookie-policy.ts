import type { CookieOptions } from "@supabase/ssr";

export const REMEMBER_ME_COOKIE = "trading-docks-remember-me";
export const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 30;

function isCookieRemoval(options: CookieOptions): boolean {
  if (typeof options.maxAge === "number" && options.maxAge <= 0) {
    return true;
  }

  return options.expires instanceof Date && options.expires.getTime() <= 0;
}

export function persistentAuthCookieOptions(
  options: CookieOptions = {},
  rememberMe: boolean,
): CookieOptions {
  // Supabase rotates refresh tokens and clears superseded/invalid cookie
  // chunks by writing Max-Age=0 (or an epoch expiry). Never replace that
  // deletion instruction with the 30-day Remember Me lifetime.
  if (isCookieRemoval(options)) {
    return {
      ...options,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    };
  }

  const persistent = rememberMe
    ? {
        maxAge: REMEMBER_ME_MAX_AGE,
        expires: new Date(Date.now() + REMEMBER_ME_MAX_AGE * 1000),
      }
    : {
        maxAge: undefined,
        expires: undefined,
      };

  return {
    ...options,
    ...persistent,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
