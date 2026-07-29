import { createBrowserClient } from "@supabase/ssr";
import {
  persistentAuthCookieOptions,
  REMEMBER_ME_COOKIE,
} from "@/lib/supabase/auth-cookie-policy";

const REMEMBER_DEVICE_STORAGE_KEY = "trading-docks-remember-device";

function browserRememberPreference(): boolean {
  if (typeof document === "undefined") return true;

  const cookiePreference = document.cookie
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === `${REMEMBER_ME_COOKIE}=true`);

  if (cookiePreference) return true;

  // The device preference is also stored locally by the sign-in form. Reading
  // both locations makes token refreshes resilient to older deployments where
  // the preference cookie was HttpOnly and therefore invisible here.
  try {
    return window.localStorage.getItem(REMEMBER_DEVICE_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function createClient() {
  const rememberMe = browserRememberPreference();

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Token refreshes can occur long after the login server action. Carry
      // the user's original choice into those browser-side cookie writes so a
      // remembered session does not silently become a session-only cookie.
      cookieOptions: persistentAuthCookieOptions({}, rememberMe),
    },
  );
}
