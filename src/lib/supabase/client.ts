import { createBrowserClient } from "@supabase/ssr";
import { DEFAULT_AUTH_COOKIE_OPTIONS } from "@/lib/supabase/auth-cookie-policy";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: DEFAULT_AUTH_COOKIE_OPTIONS,
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
}
