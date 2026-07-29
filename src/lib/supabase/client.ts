import { createBrowserClient } from "@supabase/ssr";
import {
  persistentAuthCookieOptions,
  REMEMBER_ME_COOKIE,
} from "@/lib/supabase/auth-cookie-policy";

function browserRememberPreference(): boolean {
  if (typeof document === "undefined") return true;

  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === `${REMEMBER_ME_COOKIE}=true`);
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
