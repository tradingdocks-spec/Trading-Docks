import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  persistentAuthCookieOptions,
  REMEMBER_ME_COOKIE,
} from "@/lib/supabase/auth-cookie-policy";

export async function createClient() {
  const cookieStore = await cookies();
  const rememberMe = cookieStore.get(REMEMBER_ME_COOKIE)?.value !== "false";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: persistentAuthCookieOptions({}, rememberMe),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(
                name,
                value,
                persistentAuthCookieOptions(options, rememberMe),
              );
            });
          } catch {
            // Cookies cannot always be written from Server Components.
            // The proxy will handle refreshing the session.
          }
        },
      },
    }
  );
}
